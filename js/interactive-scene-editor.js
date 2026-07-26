import {
  applyWorkInteractiveDialogueStyle,
  normalizeInteractiveDialogueStyle,
  normalizeInteractiveScene,
  normalizeInteractivePromptStyle,
} from "./interactive-scene-model.js"
import {
  freehandPointsToHotspot,
  moveInteractiveHotspot,
  resizeInteractiveHotspot,
} from "./interactive-scene-geometry.js"
import { mountInteractiveScene } from "./interactive-scene-renderer.js"
import { compressEditorImage } from "./image-compression.js"
import { gifDurationMs, isGifMedia } from "./interactive-scene-gif.js"

function clamp(value, minimum, maximum, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function dataUrlBytes(value) {
  const match = String(value || "").match(/^data:[^;,]+;base64,(.+)$/i)
  if (!match) return 0
  return Math.floor(match[1].length * 0.75)
}

function option(documentObject, value, label) {
  const element = documentObject.createElement("option")
  element.value = value
  element.textContent = label
  return element
}

function field(documentObject, labelText, control) {
  const label = documentObject.createElement("label")
  label.className = "interactive-scene-field"
  const caption = documentObject.createElement("span")
  caption.textContent = labelText
  label.append(caption, control)
  return label
}

function input(documentObject, value, type = "text") {
  const control = documentObject.createElement("input")
  control.type = type
  control.value = value ?? ""
  return control
}

function button(documentObject, label, className = "") {
  const control = documentObject.createElement("button")
  control.type = "button"
  control.className = className
  control.textContent = label
  return control
}

function readFile(documentObject, file, method) {
  return new Promise((resolve, reject) => {
    const Reader = documentObject.defaultView?.FileReader || globalThis.FileReader
    const reader = new Reader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader[method](file)
  })
}

function describeSaveError(error) {
  if (error?.code === "write-failed" || error?.name === "QuotaExceededError") {
    return "保存失败：浏览器存储空间不足。请缩小本地素材或改用 HTTPS 图床后重试。"
  }
  return `保存失败：${String(error?.message || "请检查素材后重试")}`
}

export function openInteractiveSceneEditor(options = {}) {
  const documentObject = options.documentObject || document
  const compressImage = options.compressImage || compressEditorImage
  let scene = normalizeInteractiveScene(options.scene)
  const legacyHotspotKeys = new Set()
  scene.stages.forEach((stage, stageIndex) => {
    stage.hotspots.forEach((hotspot, hotspotIndex) => {
      const sourceHotspot = options.scene?.stages?.[stageIndex]?.hotspots?.[hotspotIndex]
      const sourceRatio = Number(sourceHotspot?.referenceAspectRatio)
      if (!Number.isFinite(sourceRatio) || sourceRatio <= 0) {
        legacyHotspotKeys.add(`${stage.id}\u0000${hotspot.id}`)
      }
    })
  })
  let selectedStageId = options.stageId || scene.startStageId
  let selectedHotspotId = ""
  let previewController = null
  let syncWorkStyle = false
  let canvasMode = "select"
  let activeMediaLayer = "background"
  let drawingReplaceHotspotId = ""

  const overlay = documentObject.createElement("div")
  overlay.className = "interactive-scene-editor-overlay"
  overlay.innerHTML = `
    <section class="interactive-scene-editor" role="dialog" aria-modal="true" aria-labelledby="interactiveSceneEditorTitle">
      <header class="interactive-scene-editor-head">
        <div><h2 id="interactiveSceneEditorTitle">互动图片</h2><p class="interactive-scene-editor-subtitle">编排画面、热区与对话反馈</p></div>
        <button type="button" data-scene-close aria-label="关闭">×</button>
      </header>
      <nav class="interactive-scene-editor-mobile-tabs" aria-label="互动场景编辑步骤">
        <button type="button" data-scene-pane="stages" aria-pressed="false">画面</button>
        <button type="button" data-scene-pane="preview" aria-pressed="true">预览</button>
        <button type="button" data-scene-pane="properties" aria-pressed="false">设置</button>
      </nav>
      <div class="interactive-scene-editor-grid">
        <aside class="interactive-scene-stage-panel" aria-label="画面列表"></aside>
        <main class="interactive-scene-preview-panel">
          <div class="interactive-scene-canvas-toolbar" role="toolbar" aria-label="画布工具">
            <span class="interactive-scene-tool-group" role="group" aria-label="图层">
              <button type="button" data-media-layer="background" aria-pressed="true">背景图</button>
              <button type="button" data-media-layer="character" aria-pressed="false">立绘</button>
            </span>
            <span class="interactive-scene-tool-group" role="group" aria-label="画布操作">
              <button type="button" data-canvas-mode="select" aria-pressed="true">选择热区</button>
              <button type="button" data-canvas-mode="pan" aria-pressed="false">移动图片</button>
              <button type="button" data-media-zoom="-0.1" aria-label="缩小图片">−</button>
              <output data-media-zoom-value aria-live="polite">100%</output>
              <button type="button" data-media-zoom="0.1" aria-label="放大图片">＋</button>
              <button type="button" data-media-zoom-reset>复位</button>
            </span>
            <span class="interactive-scene-tool-group" role="group" aria-label="热区工具">
              <button type="button" data-hotspot-shape="rect">＋矩形</button>
              <button type="button" data-hotspot-shape="ellipse">＋椭圆</button>
              <button type="button" data-hotspot-shape="polygon">手绘热区</button>
            </span>
          </div>
          <div class="interactive-scene-preview"></div>
          <p class="interactive-scene-canvas-help" data-canvas-help>拖动热区移动，拖四角调整大小。</p>
        </main>
        <aside class="interactive-scene-properties" aria-label="属性设置"></aside>
      </div>
      <footer class="interactive-scene-editor-actions">
        <button type="button" class="btn btn-danger" data-scene-delete>删除场景</button>
        <span class="interactive-scene-editor-status" role="status" aria-live="polite"></span>
        <button type="button" class="btn btn-ghost" data-scene-cancel>取消</button>
        <button type="button" class="btn btn-primary" data-scene-save>保存</button>
      </footer>
    </section>
  `
  documentObject.body.appendChild(overlay)

  const stagePanel = overlay.querySelector(".interactive-scene-stage-panel")
  const properties = overlay.querySelector(".interactive-scene-properties")
  const preview = overlay.querySelector(".interactive-scene-preview")
  const status = overlay.querySelector(".interactive-scene-editor-status")
  const deleteSceneButton = overlay.querySelector("[data-scene-delete]")
  deleteSceneButton.hidden = options.allowDelete === false
  const requiresNextNode = Array.isArray(options.targetGroups)
  const validNextNodeIds = new Set(
    (options.targetGroups || []).flatMap(group => (
      Array.isArray(group?.nodes) ? group.nodes : []
    )).map(node => String(node?.nodeId || "")).filter(Boolean),
  )

  function selectedStage() {
    return scene.stages.find(stage => stage.id === selectedStageId) || scene.stages[0]
  }

  function selectedHotspot() {
    return selectedStage()?.hotspots.find(hotspot => hotspot.id === selectedHotspotId) || null
  }

  function updateScene(next) {
    scene = next
    if (!scene.stages.some(stage => stage.id === selectedStageId)) selectedStageId = scene.startStageId
    if (!selectedStage()?.hotspots.some(hotspot => hotspot.id === selectedHotspotId)) selectedHotspotId = ""
  }

  function mutateStage(fields) {
    updateScene({
      ...scene,
      stages: scene.stages.map(stage => stage.id === selectedStageId ? { ...stage, ...fields } : stage),
    })
  }

  function mutateStageDialogue(fields) {
    const stage = selectedStage()
    if (!stage) return
    mutateStage({
      dialogue: {
        ...stage.dialogue,
        ...fields,
      },
    })
  }

  function mutateHotspot(fields) {
    const stage = selectedStage()
    if (!stage) return
    mutateStage({
      hotspots: stage.hotspots.map(hotspot => (
        hotspot.id === selectedHotspotId ? { ...hotspot, ...fields } : hotspot
      )),
    })
  }

  function mutateDialogueStyle(fields) {
    scene = {
      ...scene,
      dialogueStyle:normalizeInteractiveDialogueStyle({
        ...scene.dialogueStyle,
        ...fields,
      }),
      stages:scene.stages.map(stage => ({
        ...stage,
        dialogue:{
          speaker:stage.dialogue.speaker,
          text:stage.dialogue.text,
        },
      })),
    }
  }

  function currentCanvasAspectRatio() {
    const layer = preview.querySelector(".interactive-scene-hotspots")
    const rect = layer?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return 0
    return Math.round((rect.width / rect.height) * 10000) / 10000
  }

  function createHotspot(shape, fields = {}) {
    const stage = selectedStage()
    if (!stage) return null
    const id = fields.id || options.idFactory?.() || `hotspot-${Date.now().toString(36)}`
    const referenceAspectRatio = fields.referenceAspectRatio || currentCanvasAspectRatio()
    const next = {
      id,
      label: fields.label || `互动区域 ${stage.hotspots.length + 1}`,
      x: fields.x ?? 35,
      y: fields.y ?? 35,
      width: fields.width ?? 30,
      height: fields.height ?? 30,
      shape,
      points: fields.points || [],
      trigger: "tap",
      fallbackTrigger: "tap",
      holdMs: 900,
      targetStageId: "",
      speaker: "",
      dialogue: "",
      ...(referenceAspectRatio ? { referenceAspectRatio } : {}),
    }
    mutateStage({ hotspots: [...stage.hotspots, next] })
    selectedHotspotId = id
    return id
  }

  function applyHotspotGeometry(element, hotspot) {
    element.style.left = `${hotspot.x}%`
    element.style.top = `${hotspot.y}%`
    element.style.width = `${hotspot.width}%`
    element.style.height = `${hotspot.height}%`
  }

  function canvasPoint(event, rect) {
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 0),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100, 0),
    }
  }

  function updateCanvasToolbar() {
    overlay.querySelectorAll("[data-canvas-mode]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.canvasMode === canvasMode))
    })
    overlay.querySelectorAll("[data-media-layer]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.mediaLayer === activeMediaLayer))
    })
    const stage = selectedStage()
    const transform = activeMediaLayer === "character" ? stage?.characterTransform : stage?.mediaTransform
    const zoom = transform?.scale || 1
    const output = overlay.querySelector("[data-media-zoom-value]")
    if (output) output.textContent = `${Math.round(zoom * 100)}%`
    const help = overlay.querySelector("[data-canvas-help]")
    if (help) {
      help.textContent = canvasMode === "pan"
        ? `正在调整${activeMediaLayer === "character" ? "立绘" : "背景图"}：拖动画面平移；滚轮或上方按钮缩放。`
        : canvasMode === "draw-polygon"
          ? "在画面上按住并沿目标轮廓描一圈，松手完成不规则热区。"
          : "拖动热区移动，拖四角调整大小；也可在右侧精确调整。"
    }
  }

  function beginHotspotGesture(event, element, hotspot) {
    if (canvasMode !== "select") return
    event.preventDefault()
    event.stopPropagation()
    selectedHotspotId = hotspot.id
    const handle = event.target.closest?.("[data-resize-handle]")?.dataset.resizeHandle || ""
    const layer = preview.querySelector(".interactive-scene-hotspots")
    const rect = layer?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) {
      renderProperties()
      refreshPreview()
      return
    }
    const startX = event.clientX
    const startY = event.clientY
    const start = { x: hotspot.x, y: hotspot.y, width: hotspot.width, height: hotspot.height }

    const move = moveEvent => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100
      const geometry = handle
        ? resizeInteractiveHotspot(start, handle, deltaX, deltaY)
        : moveInteractiveHotspot(start, deltaX, deltaY)
      mutateHotspot({
        ...geometry,
        referenceAspectRatio: Math.round((rect.width / rect.height) * 10000) / 10000,
      })
      applyHotspotGeometry(element, geometry)
    }
    const end = () => {
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
      renderProperties()
      refreshPreview()
    }
    documentObject.addEventListener("pointermove", move)
    documentObject.addEventListener("pointerup", end)
    documentObject.addEventListener("pointercancel", end)
  }

  function beginImagePan(event) {
    if (canvasMode !== "pan") return
    event.preventDefault()
    const media = preview.querySelector(".interactive-scene-media")
    const image = media?.querySelector(
      activeMediaLayer === "character" ? ".interactive-scene-character" : ".interactive-scene-background",
    )
    const rect = media?.getBoundingClientRect()
    if (!rect?.width || !rect?.height || !image) return
    const startX = event.clientX
    const startY = event.clientY
    const transformKey = activeMediaLayer === "character" ? "characterTransform" : "mediaTransform"
    const start = { ...selectedStage()[transformKey] }
    const move = moveEvent => {
      const transform = {
        ...start,
        x: clamp(start.x + ((moveEvent.clientX - startX) / rect.width) * 100, -200, 200, start.x),
        y: clamp(start.y + ((moveEvent.clientY - startY) / rect.height) * 100, -200, 200, start.y),
      }
      mutateStage({ [transformKey]: transform })
      image.style.setProperty("--interactive-media-x", `${transform.x}%`)
      image.style.setProperty("--interactive-media-y", `${transform.y}%`)
    }
    const end = () => {
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
    }
    documentObject.addEventListener("pointermove", move)
    documentObject.addEventListener("pointerup", end)
    documentObject.addEventListener("pointercancel", end)
  }

  function beginFreehandHotspot(event) {
    if (canvasMode !== "draw-polygon") return
    event.preventDefault()
    const media = preview.querySelector(".interactive-scene-media")
    const rect = media?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return
    const points = [canvasPoint(event, rect)]
    const guide = documentObject.createElementNS("http://www.w3.org/2000/svg", "svg")
    guide.classList.add("interactive-scene-drawing-guide")
    guide.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`)
    const path = documentObject.createElementNS("http://www.w3.org/2000/svg", "path")
    guide.appendChild(path)
    media.appendChild(guide)

    const move = moveEvent => {
      const point = canvasPoint(moveEvent, rect)
      const previous = points[points.length - 1]
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1.2) return
      points.push(point)
      path.setAttribute("d", points.map((item, index) => (
        `${index ? "L" : "M"} ${(item.x / 100) * rect.width} ${(item.y / 100) * rect.height}`
      )).join(" "))
    }
    const end = () => {
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
      guide.remove()
      const hotspot = freehandPointsToHotspot(points, {
        id: options.idFactory?.() || `hotspot-${Date.now().toString(36)}`,
        label: `互动区域 ${selectedStage().hotspots.length + 1}`,
        referenceAspectRatio: Math.round((rect.width / rect.height) * 10000) / 10000,
      })
      canvasMode = "select"
      if (hotspot && drawingReplaceHotspotId) {
        selectedHotspotId = drawingReplaceHotspotId
        mutateHotspot({
          shape: "polygon",
          x: hotspot.x,
          y: hotspot.y,
          width: hotspot.width,
          height: hotspot.height,
          points: hotspot.points,
          referenceAspectRatio: hotspot.referenceAspectRatio,
        })
      } else if (hotspot) {
        createHotspot("polygon", hotspot)
      }
      drawingReplaceHotspotId = ""
      render()
    }
    documentObject.addEventListener("pointermove", move)
    documentObject.addEventListener("pointerup", end)
    documentObject.addEventListener("pointercancel", end)
  }

  function decoratePreview() {
    const root = preview.querySelector(".interactive-scene")
    if (!root) return
    root.dataset.canvasMode = canvasMode
    root.querySelectorAll(".interactive-scene-resize-handle").forEach(element => element.remove())
    root.querySelectorAll(".interactive-scene-hotspot").forEach(element => {
      const hotspot = selectedStage().hotspots.find(item => item.id === element.dataset.hotspotId)
      if (!hotspot) return
      const isSelected = hotspot.id === selectedHotspotId
      element.classList.toggle("is-selected", isSelected)
      element.setAttribute("aria-label", `${hotspot.label}，拖动调整`)
      if (isSelected) {
        for (const handle of ["nw", "ne", "sw", "se"]) {
          const grip = documentObject.createElement("span")
          grip.className = "interactive-scene-resize-handle"
          grip.dataset.resizeHandle = handle
          element.appendChild(grip)
        }
      }
      element.onpointerdown = event => beginHotspotGesture(event, element, hotspot)
    })
    root.onpointerdown = event => {
      if (canvasMode === "pan") beginImagePan(event)
      else if (canvasMode === "draw-polygon") beginFreehandHotspot(event)
    }
    root.onwheel = event => {
      if (canvasMode !== "pan") return
      event.preventDefault()
      const stage = selectedStage()
      const transformKey = activeMediaLayer === "character" ? "characterTransform" : "mediaTransform"
      const currentTransform = stage[transformKey]
      const nextScale = clamp(currentTransform.scale + (event.deltaY < 0 ? 0.1 : -0.1), 0.5, 4, 1)
      mutateStage({ [transformKey]: { ...currentTransform, scale: nextScale } })
      root.querySelector(
        activeMediaLayer === "character" ? ".interactive-scene-character" : ".interactive-scene-background",
      )?.style.setProperty("--interactive-media-scale", String(nextScale))
      updateCanvasToolbar()
    }
    updateCanvasToolbar()
  }

  function refreshPreview() {
    if (previewController?.updateScene) {
      previewController.updateScene(scene, selectedStageId, { normalized:true })
    } else {
      previewController = mountInteractiveScene(preview, scene, {
        documentObject,
        stageId: selectedStageId,
        normalized: true,
        cameraState: { granted: false, detectorAvailable: false },
      interactive: false,
      onActionFrameEnd() {
        const control = overlay.querySelector("[data-action-frame-preview]")
        if (control) control.textContent = "预览动作帧"
      },
      })
    }
    decoratePreview()
  }

  function renderStages() {
    stagePanel.replaceChildren()
    const heading = documentObject.createElement("div")
    heading.className = "interactive-scene-panel-heading"
    heading.innerHTML = "<strong>画面</strong><small>可用图片或 GIF</small>"
    stagePanel.appendChild(heading)

    const title = input(documentObject, scene.title)
    title.maxLength = 120
    title.addEventListener("input", () => {
      scene.title = title.value
    })
    stagePanel.appendChild(field(documentObject, "场景名称", title))

    const list = documentObject.createElement("div")
    list.className = "interactive-scene-stage-list"
    scene.stages.forEach((stage, index) => {
      const control = button(documentObject, "")
      control.className = "interactive-scene-stage-item"
      control.setAttribute("aria-pressed", String(stage.id === selectedStageId))
      const number = documentObject.createElement("span")
      number.className = "interactive-scene-stage-number"
      number.textContent = String(index + 1).padStart(2, "0")
      const copy = documentObject.createElement("span")
      copy.className = "interactive-scene-stage-copy"
      const name = documentObject.createElement("strong")
      name.textContent = stage.name
      const summary = documentObject.createElement("small")
      summary.className = "interactive-scene-stage-summary"
      const mediaSummary = stage.image
        ? "背景图"
        : (stage.characterImage ? "仅立绘" : "未添加画面")
      summary.textContent = `${mediaSummary} · ${stage.hotspots.length} 个互动点`
      copy.append(name, summary)
      control.append(number, copy)
      control.addEventListener("click", () => {
        selectedStageId = stage.id
        selectedHotspotId = ""
        render()
      })
      list.appendChild(control)
    })
    stagePanel.appendChild(list)

    const progressionNote = documentObject.createElement("p")
    progressionNote.className = "interactive-scene-stage-note"
    progressionNote.textContent = "读者探索完当前画面的全部互动点后，点击对话框按列表顺序进入下一画面；没有互动点的画面可直接点击。最后一个画面完成后会固定跳转到下方选择的后续普通节点。互动图片暂不支持承载剧情分支，也不能在画面内设置选项组；需要分流时，请把选项组设置在所选的后续普通节点。"
    stagePanel.appendChild(progressionNote)

    if (requiresNextNode) {
      const nextNode = documentObject.createElement("select")
      nextNode.required = true
      nextNode.dataset.sceneNextNode = ""
      nextNode.appendChild(option(
        documentObject,
        "",
        validNextNodeIds.size ? "请选择后续节点" : "请先在作品结构中创建普通节点",
      ))
      ;(options.targetGroups || []).forEach(group => {
        const groupNodes = Array.isArray(group?.nodes) ? group.nodes : []
        if (!groupNodes.length) return
        const optionGroup = documentObject.createElement("optgroup")
        optionGroup.label = String(group.chapterName || "未分组")
        groupNodes.forEach(node => {
          optionGroup.appendChild(option(
            documentObject,
            String(node.nodeId || ""),
            String(node.title || "未命名节点"),
          ))
        })
        nextNode.appendChild(optionGroup)
      })
      if (scene.nextNodeId && !validNextNodeIds.has(scene.nextNodeId)) {
        const invalidOption = option(
          documentObject,
          scene.nextNodeId,
          `已失效 · ${scene.nextNodeId}`,
        )
        invalidOption.disabled = true
        nextNode.appendChild(invalidOption)
      }
      nextNode.value = validNextNodeIds.has(scene.nextNodeId) ? scene.nextNodeId : ""
      nextNode.addEventListener("change", () => {
        scene.nextNodeId = nextNode.value
        status.textContent = ""
      })
      stagePanel.appendChild(field(documentObject, "后续跳转至（必选）", nextNode))

      const nextNodeNote = documentObject.createElement("p")
      nextNodeNote.className = "interactive-scene-stage-note"
      nextNodeNote.textContent = "保存的是节点 ID；节点改名或移动后仍会跳到同一节点。若目标被删除，请在这里重新选择。"
      stagePanel.appendChild(nextNodeNote)
    }

    const addStage = button(documentObject, "＋ 添加画面", "interactive-scene-add")
    addStage.addEventListener("click", () => {
      const id = options.idFactory?.() || `stage-${Date.now().toString(36)}`
      scene.stages.push({
        id,
        name: `画面 ${scene.stages.length + 1}`,
        image: "",
        alt: "",
        fit: "cover",
        mediaTransform: { scale: 1, x: 0, y: 0 },
        characterImage: "",
        characterAlt: "",
        characterFit: "contain",
        characterTransform: { scale: 1, x: 0, y: 0 },
        prompt: "",
        dialogue: { speaker: "", text: "" },
        hotspots: [],
      })
      selectedStageId = id
      selectedHotspotId = ""
      updateScene(scene)
      render()
    })
    stagePanel.appendChild(addStage)

    if (scene.stages.length > 1) {
      const removeStage = button(documentObject, "删除当前画面", "interactive-scene-remove")
      removeStage.addEventListener("click", () => {
        const removedId = selectedStageId
        scene.stages = scene.stages.filter(stage => stage.id !== removedId)
        scene.stages.forEach(stage => {
          stage.hotspots = stage.hotspots.map(hotspot => (
            hotspot.targetStageId === removedId ? { ...hotspot, targetStageId: "" } : hotspot
          ))
        })
        selectedStageId = scene.stages[0].id
        selectedHotspotId = ""
        updateScene(scene)
        render()
      })
      stagePanel.appendChild(removeStage)
    }
  }

  function renderHotspotEditor(parent) {
    const stage = selectedStage()
    const heading = documentObject.createElement("div")
    heading.className = "interactive-scene-property-heading"
    heading.innerHTML = "<strong>互动区域</strong><small>位置使用画面百分比</small>"
    parent.appendChild(heading)

    const chips = documentObject.createElement("div")
    chips.className = "interactive-scene-hotspot-list"
    const triggerLabels = {
      tap:"点击",
      hold:"长按",
      swipe:"滑动",
      "face-near":"脸部靠近",
      "face-near-tap":"靠近后点击",
      "face-near-hold":"靠近后长按",
    }
    stage.hotspots.forEach(hotspot => {
      const control = button(documentObject, "")
      control.setAttribute("aria-pressed", String(hotspot.id === selectedHotspotId))
      const label = documentObject.createElement("span")
      label.textContent = hotspot.label
      const meta = documentObject.createElement("small")
      meta.className = "interactive-scene-hotspot-meta"
      meta.textContent = `${triggerLabels[hotspot.trigger] || "点击"} · ${hotspot.shape === "polygon" ? "手绘" : hotspot.shape === "rect" ? "矩形" : "椭圆"}`
      control.append(label, meta)
      control.addEventListener("click", () => {
        selectedHotspotId = hotspot.id
        render()
      })
      chips.appendChild(control)
    })
    const addHotspot = button(documentObject, "＋ 默认椭圆")
    addHotspot.addEventListener("click", () => {
      createHotspot("ellipse")
      canvasMode = "select"
      render()
    })
    chips.appendChild(addHotspot)
    parent.appendChild(chips)

    const hotspot = selectedHotspot()
    if (!hotspot) return
    const grid = documentObject.createElement("div")
    grid.className = "interactive-scene-coordinate-grid"

    const label = input(documentObject, hotspot.label)
    label.addEventListener("input", () => mutateHotspot({ label: label.value }))
    parent.appendChild(field(documentObject, "区域名称", label))

    const shape = documentObject.createElement("select")
    shape.append(
      option(documentObject, "rect", "矩形"),
      option(documentObject, "ellipse", "椭圆"),
      option(documentObject, "polygon", "手绘不规则"),
    )
    shape.value = hotspot.shape
    shape.addEventListener("change", () => {
      if (shape.value === "polygon" && hotspot.points.length < 3) {
        canvasMode = "draw-polygon"
        drawingReplaceHotspotId = hotspot.id
        updateCanvasToolbar()
        status.textContent = "请在中间画面上按住并沿目标轮廓描画。"
        return
      }
      mutateHotspot({ shape: shape.value })
      refreshPreview()
    })
    parent.appendChild(field(documentObject, "区域形状", shape))

    const precision = documentObject.createElement("details")
    precision.className = "interactive-scene-precision"
    const precisionSummary = documentObject.createElement("summary")
    precisionSummary.textContent = "精确位置与尺寸"
    precision.appendChild(precisionSummary)
    for (const [key, caption] of [["x", "左"], ["y", "上"], ["width", "宽"], ["height", "高"]]) {
      const control = input(documentObject, hotspot[key], "number")
      control.min = key === "width" || key === "height" ? "1" : "0"
      control.max = "100"
      control.addEventListener("input", () => {
        mutateHotspot({ [key]: clamp(control.value, Number(control.min), 100, hotspot[key]) })
        refreshPreview()
      })
      grid.appendChild(field(documentObject, caption, control))
    }
    precision.appendChild(grid)
    parent.appendChild(precision)

    const trigger = documentObject.createElement("select")
    trigger.append(
      option(documentObject, "tap", "点击"),
      option(documentObject, "hold", "长按"),
      option(documentObject, "swipe", "滑动"),
      option(documentObject, "face-near", "脸部靠近"),
      option(documentObject, "face-near-tap", "靠近后点击"),
      option(documentObject, "face-near-hold", "靠近后长按"),
    )
    trigger.value = hotspot.trigger
    trigger.addEventListener("change", () => {
      mutateHotspot({ trigger: trigger.value })
      render()
    })
    parent.appendChild(field(documentObject, "触发方式", trigger))

    if (["face-near", "face-near-tap", "face-near-hold"].includes(hotspot.trigger)) {
      const fallback = documentObject.createElement("select")
      fallback.append(option(documentObject, "tap", "点击"), option(documentObject, "hold", "长按"))
      fallback.value = hotspot.fallbackTrigger
      fallback.addEventListener("change", () => mutateHotspot({ fallbackTrigger: fallback.value }))
      parent.appendChild(field(documentObject, "摄像头不可用时", fallback))
    }
    if (hotspot.trigger === "hold" || hotspot.trigger === "face-near-hold" || hotspot.fallbackTrigger === "hold") {
      const holdMs = input(documentObject, hotspot.holdMs, "number")
      holdMs.min = "300"
      holdMs.max = "5000"
      holdMs.step = "100"
      holdMs.addEventListener("input", () => mutateHotspot({ holdMs: Number(holdMs.value) }))
      parent.appendChild(field(documentObject, "长按毫秒", holdMs))
    }

    const response = documentObject.createElement("textarea")
    response.rows = 2
    response.value = hotspot.dialogue
    response.addEventListener("input", () => mutateHotspot({ dialogue: response.value }))
    parent.appendChild(field(documentObject, "触发时台词", response))

    const responseSpeaker = input(documentObject, hotspot.speaker)
    responseSpeaker.placeholder = stage.dialogue.speaker ? `留空则使用 ${stage.dialogue.speaker}` : "留空则不改变说话人"
    responseSpeaker.addEventListener("input", () => mutateHotspot({ speaker: responseSpeaker.value }))
    parent.appendChild(field(documentObject, "触发时说话人", responseSpeaker))

    const actionToggle = documentObject.createElement("label")
    actionToggle.className = "interactive-scene-sync"
    const actionEnabled = input(documentObject, "", "checkbox")
    actionEnabled.dataset.actionFrameEnabled = ""
    actionEnabled.checked = hotspot.actionFrame.enabled
    actionEnabled.addEventListener("change", () => {
      const current = selectedHotspot()?.actionFrame || hotspot.actionFrame
      mutateHotspot({ actionFrame: { ...current, enabled: actionEnabled.checked } })
      render()
    })
    const actionCopy = documentObject.createElement("span")
    actionCopy.innerHTML = "<strong>触发动作帧</strong><small>与本热区的说话人和台词同时出现，不计入左侧画面序列</small>"
    actionToggle.append(actionEnabled, actionCopy)
    parent.appendChild(actionToggle)

    if (hotspot.actionFrame.enabled) {
      const mutateActionFrame = fields => {
        const current = selectedHotspot()?.actionFrame || hotspot.actionFrame
        mutateHotspot({ actionFrame: { ...current, ...fields } })
      }

      const actionSource = input(documentObject, hotspot.actionFrame.source)
      actionSource.dataset.actionFrameSource = ""
      actionSource.placeholder = "https://…/reaction.gif 或 reaction.webm"
      let previewAction
      actionSource.addEventListener("input", () => {
        mutateActionFrame({
          source: actionSource.value.trim(),
          fileName: "",
          gifDurationMs: 0,
        })
        if (previewAction) previewAction.disabled = !actionSource.value.trim()
      })
      actionSource.addEventListener("change", async () => {
        const source = actionSource.value.trim()
        if (!isGifMedia(source, "") || !/^https:\/\//i.test(source)) return
        try {
          const response = await (options.fetch || globalThis.fetch)(source)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const detected = gifDurationMs(await response.arrayBuffer())
          mutateActionFrame({ gifDurationMs: detected })
          status.textContent = detected
            ? `已读取 GIF 首轮时长：${(detected / 1000).toFixed(2)} 秒`
            : "未读取到 GIF 动画时长，将使用备用播放时间。"
        } catch {
          status.textContent = "图床未允许读取 GIF 时长，将使用备用播放时间。"
        }
      })
      parent.appendChild(field(documentObject, "动作帧图片 / GIF / 视频链接", actionSource))

      const actionType = documentObject.createElement("select")
      actionType.append(
        option(documentObject, "image", "图片 / GIF / WebP 动图"),
        option(documentObject, "video", "MP4 / WebM 视频动图"),
      )
      actionType.value = hotspot.actionFrame.type
      actionType.addEventListener("change", () => {
        mutateActionFrame({ type: actionType.value })
        refreshPreview()
      })
      parent.appendChild(field(documentObject, "动作帧类型", actionType))

      const actionFit = documentObject.createElement("select")
      actionFit.append(
        option(documentObject, "cover", "铺满画面"),
        option(documentObject, "contain", "完整显示"),
      )
      actionFit.value = hotspot.actionFrame.fit
      actionFit.addEventListener("change", () => {
        mutateActionFrame({ fit: actionFit.value })
        refreshPreview()
      })
      parent.appendChild(field(documentObject, "动作帧填充", actionFit))

      if (hotspot.actionFrame.type === "image") {
        const duration = input(documentObject, hotspot.actionFrame.durationMs / 1000, "number")
        duration.dataset.actionFrameDuration = ""
        duration.min = "0.3"
        duration.max = "30"
        duration.step = "0.1"
        duration.addEventListener("change", () => {
          mutateActionFrame({ durationMs: clamp(Number(duration.value) * 1000, 300, 30000, 1800) })
        })
        parent.appendChild(field(
          documentObject,
          isGifMedia(hotspot.actionFrame.source, hotspot.actionFrame.fileName)
            ? "GIF 备用播放时间（秒）"
            : "静态动作帧播放时间（秒）",
          duration,
        ))
      }

      const actionUpload = input(documentObject, "", "file")
      actionUpload.dataset.actionFrameUpload = ""
      actionUpload.accept = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
      const actionFileState = documentObject.createElement("output")
      actionFileState.dataset.actionFrameFileState = ""
      actionFileState.className = "interactive-scene-media-note"
      actionFileState.textContent = hotspot.actionFrame.fileName
        ? `已嵌入：${hotspot.actionFrame.fileName}`
        : "尚未嵌入本地动作帧"
      actionUpload.addEventListener("change", async () => {
        const file = actionUpload.files?.[0]
        if (!file) return
        actionUpload.disabled = true
        try {
          const isVideo = file.type.startsWith("video/")
          const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name)
          let source
          let outputBytes = file.size
          let compressed = false
          if (isVideo || isGif) {
            source = String(await readFile(documentObject, file, "readAsDataURL") || "")
          } else {
            const result = await compressImage(file)
            source = result.dataUrl
            outputBytes = result.outputBytes
            compressed = result.compressed
          }
          const detectedGifDuration = isGif
            ? gifDurationMs(await readFile(documentObject, file, "readAsArrayBuffer"))
            : 0
          mutateActionFrame({
            source,
            type: isVideo ? "video" : "image",
            fileName: file.name,
            gifDurationMs: detectedGifDuration,
          })
          actionSource.value = source
          actionType.value = isVideo ? "video" : "image"
          actionFileState.textContent = `已嵌入：${file.name}（${formatBytes(outputBytes)}）`
          status.textContent = compressed
            ? `已压缩并嵌入动作帧 ${file.name}（${formatBytes(file.size)} → ${formatBytes(outputBytes)}）`
            : `已嵌入动作帧 ${file.name}（${formatBytes(file.size)}）`
          if (detectedGifDuration) {
            status.textContent += `，首轮约 ${(detectedGifDuration / 1000).toFixed(2)} 秒`
          }
          previewAction.disabled = false
          refreshPreview()
        } catch (error) {
          status.textContent = `动作帧导入失败：${String(error?.message || "请更换素材后重试")}`
        } finally {
          actionUpload.disabled = false
        }
      })
      parent.appendChild(field(documentObject, "本地嵌入动作帧", actionUpload))
      parent.appendChild(actionFileState)

      const actionNote = documentObject.createElement("p")
      actionNote.className = "interactive-scene-media-note"
      actionNote.textContent = dataUrlBytes(hotspot.actionFrame.source)
        ? `当前动作帧约 ${formatBytes(dataUrlBytes(hotspot.actionFrame.source))}，会计入作品导出体积。大型 GIF 或视频建议使用 HTTPS 图床。`
        : "支持静态图、GIF、WebP 动图、MP4 和 WebM；大型素材建议使用 HTTPS 图床。"
      parent.appendChild(actionNote)

      previewAction = button(documentObject, "预览动作帧", "interactive-scene-add")
      previewAction.dataset.actionFramePreview = ""
      previewAction.disabled = !hotspot.actionFrame.source
      previewAction.addEventListener("click", () => {
        const previewRoot = preview.querySelector(".interactive-scene")
        if (previewRoot?.dataset.actionFrameActive === "true") {
          previewController?.clearHotspotReaction()
          previewAction.textContent = "预览动作帧"
          return
        }
        refreshPreview()
        previewController?.previewHotspotReaction(hotspot.id)
        previewAction.textContent = "返回基础画面"
      })
      parent.appendChild(previewAction)
    }

    const remove = button(documentObject, "删除这个区域", "interactive-scene-remove")
    remove.addEventListener("click", () => {
      mutateStage({ hotspots: stage.hotspots.filter(item => item.id !== hotspot.id) })
      selectedHotspotId = ""
      render()
    })
    parent.appendChild(remove)
  }

  function renderProperties() {
    properties.replaceChildren()
    const stage = selectedStage()

    const heading = documentObject.createElement("div")
    heading.className = "interactive-scene-panel-heading"
    heading.innerHTML = "<strong>画面设置</strong><small>预览和读者端使用同一组件</small>"
    properties.appendChild(heading)

    const name = input(documentObject, stage.name)
    name.addEventListener("input", () => mutateStage({ name: name.value }))
    properties.appendChild(field(documentObject, "画面名称", name))

    function appendMediaFields({
      title,
      layer,
      imageKey,
      altKey,
      fitKey,
      defaultFit,
    }) {
      const mediaHeading = documentObject.createElement("div")
      mediaHeading.className = "interactive-scene-property-heading interactive-scene-media-heading"
      mediaHeading.innerHTML = `<strong>${title}</strong><small>可单独移动和缩放</small>`
      properties.appendChild(mediaHeading)

      const imageUrl = input(documentObject, stage[imageKey])
      imageUrl.placeholder = "https://…"
      imageUrl.addEventListener("change", () => {
        activeMediaLayer = layer
        mutateStage({ [imageKey]: imageUrl.value.trim() })
        render()
      })
      properties.appendChild(field(documentObject, `${title} / GIF 链接`, imageUrl))

      const upload = input(documentObject, "", "file")
      upload.accept = "image/png,image/jpeg,image/webp,image/gif"
      upload.addEventListener("change", async () => {
        const file = upload.files?.[0]
        if (!file) return
        upload.disabled = true
        try {
          const result = await compressImage(file)
          activeMediaLayer = layer
          mutateStage({ [imageKey]: result.dataUrl })
          status.textContent = result.compressed
            ? `已压缩并嵌入${title} ${file.name}（${formatBytes(file.size)} → ${formatBytes(result.outputBytes)}）`
            : `已嵌入${title} ${file.name}（${formatBytes(file.size)}）`
          render()
        } catch (error) {
          status.textContent = `${title}导入失败：${String(error?.message || "请更换素材后重试")}`
        } finally {
          upload.disabled = false
        }
      })
      properties.appendChild(field(documentObject, `${title}本地嵌入`, upload))

      const mediaNote = documentObject.createElement("p")
      mediaNote.className = "interactive-scene-media-note"
      const embeddedBytes = dataUrlBytes(stage[imageKey])
      mediaNote.textContent = embeddedBytes
        ? `当前${title}约 ${formatBytes(embeddedBytes)}，会计入作品导出体积。大型 GIF 建议使用 HTTPS 图床。`
        : "支持 PNG、JPG、WebP 和 GIF。大型 GIF 建议使用 HTTPS 图床。"
      properties.appendChild(mediaNote)

      const fit = documentObject.createElement("select")
      fit.append(option(documentObject, "cover", "铺满裁切"), option(documentObject, "contain", "完整显示"))
      fit.value = stage[fitKey] || defaultFit
      fit.addEventListener("change", () => {
        mutateStage({ [fitKey]: fit.value })
        refreshPreview()
      })
      properties.appendChild(field(documentObject, `${title}适应`, fit))

      const alt = input(documentObject, stage[altKey])
      alt.addEventListener("input", () => mutateStage({ [altKey]: alt.value }))
      properties.appendChild(field(documentObject, `${title}替代文字`, alt))

      if (stage[imageKey]) {
        const clear = button(documentObject, `清除${title}`, "interactive-scene-remove")
        clear.addEventListener("click", () => {
          mutateStage({ [imageKey]: "" })
          render()
        })
        properties.appendChild(clear)
      }
    }

    appendMediaFields({
      title: "背景图",
      layer: "background",
      imageKey: "image",
      altKey: "alt",
      fitKey: "fit",
      defaultFit: "cover",
    })
    appendMediaFields({
      title: "立绘",
      layer: "character",
      imageKey: "characterImage",
      altKey: "characterAlt",
      fitKey: "characterFit",
      defaultFit: "contain",
    })

    const prompt = input(documentObject, stage.prompt)
    prompt.addEventListener("input", () => {
      mutateStage({ prompt: prompt.value })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "触摸提示", prompt))

    const promptStyleHeading = documentObject.createElement("div")
    promptStyleHeading.className = "interactive-scene-property-heading"
    promptStyleHeading.innerHTML = "<strong>触摸提示样式</strong><small>作用于当前互动页全部画面</small>"
    properties.appendChild(promptStyleHeading)
    const promptStyleGrid = documentObject.createElement("div")
    promptStyleGrid.className = "interactive-scene-style-grid"
    for (const [key, caption] of [
      ["surfaceColor", "底色"],
      ["textColor", "文字"],
      ["borderColor", "边框"],
    ]) {
      const control = input(documentObject, scene.promptStyle[key], "color")
      control.addEventListener("input", () => {
        scene.promptStyle = normalizeInteractivePromptStyle({ ...scene.promptStyle, [key]:control.value })
        refreshPreview()
      })
      promptStyleGrid.appendChild(field(documentObject, caption, control))
    }
    properties.appendChild(promptStyleGrid)
    for (const [key, caption, minimum, maximum] of [
      ["opacity", "透明度", 20, 100],
      ["borderRadius", "圆角", 0, 24],
    ]) {
      const control = input(documentObject, scene.promptStyle[key], "range")
      control.min = String(minimum)
      control.max = String(maximum)
      control.addEventListener("input", () => {
        scene.promptStyle = normalizeInteractivePromptStyle({ ...scene.promptStyle, [key]:Number(control.value) })
        refreshPreview()
      })
      properties.appendChild(field(documentObject, caption, control))
    }
    const promptPosition = documentObject.createElement("select")
    promptPosition.append(option(documentObject, "top", "顶部"), option(documentObject, "bottom", "底部"))
    promptPosition.value = scene.promptStyle.position
    promptPosition.addEventListener("change", () => {
      scene.promptStyle = normalizeInteractivePromptStyle({ ...scene.promptStyle, position:promptPosition.value })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "提示位置", promptPosition))

    const speaker = input(documentObject, stage.dialogue.speaker)
    speaker.addEventListener("input", () => {
      mutateStageDialogue({ speaker: speaker.value })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "说话人", speaker))

    const dialogueText = documentObject.createElement("textarea")
    dialogueText.rows = 3
    dialogueText.value = stage.dialogue.text
    dialogueText.addEventListener("input", () => {
      mutateStageDialogue({ text: dialogueText.value })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "初始台词", dialogueText))

    const styleHeading = documentObject.createElement("div")
    styleHeading.className = "interactive-scene-property-heading"
    styleHeading.innerHTML = "<strong>对话框样式</strong><small>只同步样式，不覆盖内容</small>"
    properties.appendChild(styleHeading)
    const styleGrid = documentObject.createElement("div")
    styleGrid.className = "interactive-scene-style-grid"
    for (const [key, caption] of [
      ["surfaceColor", "底色"],
      ["textColor", "文字"],
      ["accentColor", "强调"],
      ["borderColor", "边框"],
    ]) {
      const control = input(documentObject, scene.dialogueStyle[key], "color")
      control.addEventListener("input", () => {
        mutateDialogueStyle({ [key]:control.value })
        refreshPreview()
      })
      styleGrid.appendChild(field(documentObject, caption, control))
    }
    properties.appendChild(styleGrid)

    const frameUrl = input(documentObject, scene.dialogueStyle.frameImage)
    frameUrl.placeholder = "https://…/dialogue-frame.png"
    frameUrl.addEventListener("change", () => {
      mutateDialogueStyle({ frameImage:frameUrl.value.trim() })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "PNG 对话框素材链接", frameUrl))

    const frameUpload = input(documentObject, "", "file")
    frameUpload.accept = "image/png"
    frameUpload.addEventListener("change", () => {
      const file = frameUpload.files?.[0]
      if (!file) return
      const Reader = documentObject.defaultView?.FileReader || globalThis.FileReader
      const reader = new Reader()
      reader.onload = () => {
        mutateDialogueStyle({ frameImage:String(reader.result || "") })
        status.textContent = `已嵌入透明 PNG ${file.name}（${formatBytes(file.size)}）`
        render()
      }
      reader.readAsDataURL(file)
    })
    properties.appendChild(field(documentObject, "本地 PNG 边框", frameUpload))

    if (scene.dialogueStyle.frameImage) {
      const clearFrame = button(documentObject, "清除 PNG 对话框素材", "interactive-scene-remove")
      clearFrame.addEventListener("click", () => {
        mutateDialogueStyle({ frameImage:"" })
        render()
      })
      properties.appendChild(clearFrame)
    }

    for (const [key, caption, minimum, maximum] of [
      ["opacity", "透明度", 20, 100],
      ["borderRadius", "圆角", 0, 24],
      ["width", "宽度", 40, 100],
      ["height", "高度", 8, 45],
      ["frameOutset", "PNG 向外延伸", 0, 32],
    ]) {
      const control = input(documentObject, scene.dialogueStyle[key], "range")
      control.dataset.dialogueStyleKey = key
      control.min = String(minimum)
      control.max = String(maximum)
      control.addEventListener("input", () => {
        mutateDialogueStyle({ [key]:Number(control.value) })
        refreshPreview()
      })
      properties.appendChild(field(documentObject, caption, control))
    }

    const position = documentObject.createElement("select")
    position.append(option(documentObject, "top", "顶部"), option(documentObject, "center", "居中"), option(documentObject, "bottom", "底部"))
    position.value = scene.dialogueStyle.position
    position.addEventListener("change", () => {
      mutateDialogueStyle({ position:position.value })
      refreshPreview()
    })
    properties.appendChild(field(documentObject, "位置", position))

    const sync = documentObject.createElement("label")
    sync.className = "interactive-scene-sync"
    const checkbox = input(documentObject, "", "checkbox")
    checkbox.checked = syncWorkStyle
    checkbox.addEventListener("change", () => { syncWorkStyle = checkbox.checked })
    const syncCopy = documentObject.createElement("span")
    syncCopy.innerHTML = "<strong>同步到作品全部互动页</strong><small>仅同步对话框外观与 PNG 素材，不覆盖角色名和台词</small>"
    sync.append(checkbox, syncCopy)
    properties.appendChild(sync)

    renderHotspotEditor(properties)
  }

  function render() {
    renderStages()
    renderProperties()
    refreshPreview()
  }

  function close() {
    previewController?.destroy()
    overlay.remove()
  }

  overlay.querySelector("[data-scene-close]").addEventListener("click", close)
  overlay.querySelector("[data-scene-cancel]").addEventListener("click", close)
  overlay.querySelector("[data-scene-save]").addEventListener("click", async () => {
    if (requiresNextNode && !validNextNodeIds.has(scene.nextNodeId)) {
      status.textContent = "请选择互动图片完成后的后续跳转节点"
      overlay.querySelector(".interactive-scene-editor").dataset.mobilePane = "stages"
      const nextNode = overlay.querySelector("[data-scene-next-node]")
      nextNode?.focus()
      return
    }
    const referenceAspectRatio = currentCanvasAspectRatio()
    const sceneWithReferences = referenceAspectRatio
      ? {
        ...scene,
        stages: scene.stages.map(stage => ({
          ...stage,
          hotspots: stage.hotspots.map(hotspot => (
            hotspot.referenceAspectRatio
              && !legacyHotspotKeys.has(`${stage.id}\u0000${hotspot.id}`)
              ? hotspot
              : { ...hotspot, referenceAspectRatio }
          )),
        })),
      }
      : scene
    const normalized = normalizeInteractiveScene(sceneWithReferences)
    const scenesForSync = (options.allScenes || []).map(candidate => (
      candidate.id === normalized.id ? normalized : candidate
    ))
    if (!scenesForSync.some(candidate => candidate.id === normalized.id)) scenesForSync.push(normalized)
    const result = syncWorkStyle
      ? applyWorkInteractiveDialogueStyle({
        interactiveDialogueStyle: options.workStyle,
        interactiveScenes: scenesForSync,
      }, normalized.dialogueStyle)
      : null
    try {
      await options.onSave?.(normalized, result)
      close()
    } catch (error) {
      status.textContent = describeSaveError(error)
      overlay.querySelector("[data-scene-save]").focus()
    }
  })
  deleteSceneButton.addEventListener("click", () => {
    options.onDelete?.(scene)
    close()
  })
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close()
  })
  overlay.querySelectorAll("[data-scene-pane]").forEach(control => {
    control.addEventListener("click", () => {
      overlay.querySelector(".interactive-scene-editor").dataset.mobilePane = control.dataset.scenePane
      overlay.querySelectorAll("[data-scene-pane]").forEach(candidate => {
        candidate.setAttribute("aria-pressed", String(candidate === control))
      })
    })
  })
  overlay.querySelectorAll("[data-canvas-mode]").forEach(control => {
    control.addEventListener("click", () => {
      canvasMode = control.dataset.canvasMode
      drawingReplaceHotspotId = ""
      refreshPreview()
    })
  })
  overlay.querySelectorAll("[data-media-layer]").forEach(control => {
    control.addEventListener("click", () => {
      activeMediaLayer = control.dataset.mediaLayer
      canvasMode = "pan"
      refreshPreview()
    })
  })
  overlay.querySelectorAll("[data-media-zoom]").forEach(control => {
    control.addEventListener("click", () => {
      const stage = selectedStage()
      const transformKey = activeMediaLayer === "character" ? "characterTransform" : "mediaTransform"
      const transform = stage[transformKey]
      const scale = clamp(transform.scale + Number(control.dataset.mediaZoom), 0.5, 4, 1)
      mutateStage({ [transformKey]: { ...transform, scale } })
      refreshPreview()
    })
  })
  overlay.querySelector("[data-media-zoom-reset]").addEventListener("click", () => {
    const transformKey = activeMediaLayer === "character" ? "characterTransform" : "mediaTransform"
    mutateStage({ [transformKey]: { scale: 1, x: 0, y: 0 } })
    refreshPreview()
  })
  overlay.querySelectorAll("[data-hotspot-shape]").forEach(control => {
    control.addEventListener("click", () => {
      const shape = control.dataset.hotspotShape
      if (shape === "polygon") {
        canvasMode = "draw-polygon"
        drawingReplaceHotspotId = ""
        refreshPreview()
        return
      }
      createHotspot(shape)
      canvasMode = "select"
      drawingReplaceHotspotId = ""
      render()
    })
  })

  render()
  overlay.querySelector(".interactive-scene-editor").dataset.mobilePane = "preview"
  overlay.querySelector("[data-scene-close]").focus()
  return { overlay, close, get scene() { return scene } }
}
