import {
  applyWorkInteractiveDialogueStyle,
  DEFAULT_INTERACTIVE_PROMPT_TEXT,
  INTERACTIVE_TEXT_FONTS,
  normalizeInteractiveCanvas,
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
import {
  createEditorMediaUrlResolver,
  garbageCollectEditorMediaAssets,
  loadEditorMediaAsset,
  parseEditorMediaAssetId,
  persistEditorMediaAsset,
  persistEditorMediaDataUrl,
} from "./editor-media-storage.js"
import { createInteractiveBgmController, normalizeInteractiveBgm } from "./interactive-bgm.js"
import { probeAudioBlob, probeAudioUrl } from "./audio-clip.js"
import { createInteractiveBgmClipEditor } from "./interactive-bgm-clip-editor.js"
import {
  importInteractiveBgmFile,
  replaceInteractiveBgmWithCompressedClip,
} from "./interactive-bgm-clip.js"

let interactiveSceneFieldSequence = 0
let interactiveSceneMediaHelpSequence = 0

const MEDIA_LINK_HELP_COPY = Object.freeze({
  image:"使用 HTTPS 图片直链时，作品只保存 URL，不会把图片文件嵌入导出包，因此能减少导出包体，并且不会占用本地素材名额。它不会压缩图片，也不会降低图片解码后的内存占用；高分辨率图片和大型 GIF 仍可能占用较多运行内存。读者需要联网，链接失效、图床防盗链或格式不兼容时会加载失败。",
  action:"使用 HTTPS 直链时，动作帧文件不会嵌入导出包，因此能减少导出包体，并且不会占用本地素材名额。它不会压缩素材，也不会减少图片、GIF 或视频解码后的内存占用。读者需要联网，链接失效、图床防盗链或格式不兼容时会加载失败；图床不允许跨域读取 GIF 时长时，将使用备用播放时间。",
  audio:"使用 HTTPS 音乐直链时，作品只保存 URL，不会把音频文件嵌入导出包，因此能减少导出包体，并且不会占用本地素材名额。它不会压缩音频，也不会减少播放时的解码内存。读者需要联网；链接失效、防盗链、跨域限制或格式不兼容时可能无法读取时长或播放。远程音乐只能设置播放区间，不能在这里裁剪或缩小源文件。",
  frame:"使用透明 PNG 的 HTTPS 直链时，作品只保存 URL，不会把 PNG 文件嵌入导出包，因此能减少导出包体，并且不会占用本地素材名额。它不会压缩图片，也不会降低图片解码后的内存占用。读者需要联网；链接失效或图床防盗链时会显示基础对话框样式。",
})

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

function field(documentObject, labelText, control, help = null) {
  if (help) {
    const wrapper = documentObject.createElement("div")
    wrapper.className = "interactive-scene-field"
    const caption = documentObject.createElement("div")
    caption.className = "media-link-help-label-row"
    const label = documentObject.createElement("label")
    if (!control.id) control.id = `interactiveSceneField-${++interactiveSceneFieldSequence}`
    label.htmlFor = control.id
    label.textContent = labelText
    const helpButton = documentObject.createElement("button")
    helpButton.type = "button"
    helpButton.className = "media-link-help-trigger"
    helpButton.dataset.mediaLinkHelpTrigger = help.kind
    const helpMark = documentObject.createElement("span")
    helpMark.setAttribute("aria-hidden", "true")
    helpMark.textContent = "?"
    helpButton.appendChild(helpMark)
    helpButton.setAttribute("aria-label", `查看「${labelText}」的链接与体积说明`)
    helpButton.setAttribute("aria-haspopup", "dialog")
    helpButton.setAttribute("aria-controls", help.controlsId)
    helpButton.setAttribute("aria-expanded", "false")
    helpButton.addEventListener("click", () => help.onOpen(helpButton, labelText, help.kind))
    caption.append(label, helpButton)
    wrapper.append(caption, control)
    return wrapper
  }
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

function mediaFileStatus(source, fileName) {
  if (fileName) return `已嵌入 · ${fileName}`
  if (parseEditorMediaAssetId(source)) return "已嵌入本地素材"
  if (/^data:/i.test(String(source || ""))) return "已嵌入旧版本地素材"
  if (source) return "当前使用链接素材"
  return "未选择文件"
}

function mediaFileField(documentObject, labelText, control, options = {}) {
  if (!control.id) control.id = `interactiveSceneFile-${++interactiveSceneFieldSequence}`
  control.classList.add("sr-only", "media-file-picker-input")
  control.dataset.mediaFileInput = ""

  const wrapper = documentObject.createElement("div")
  wrapper.className = "interactive-scene-field media-file-field"
  const caption = documentObject.createElement("span")
  caption.id = `${control.id}Label`
  caption.textContent = labelText
  const picker = documentObject.createElement("div")
  picker.className = "media-file-picker"
  picker.dataset.mediaFilePicker = ""
  picker.setAttribute("role", "group")
  picker.setAttribute("aria-labelledby", caption.id)

  const source = String(options.source || "")
  const fileName = String(options.fileName || "")
  const localSource = Boolean(fileName || parseEditorMediaAssetId(source) || /^data:/i.test(source))
  const trigger = documentObject.createElement("label")
  trigger.className = "btn btn-secondary media-file-picker-button"
  trigger.htmlFor = control.id
  trigger.dataset.mediaFileTrigger = ""
  trigger.dataset.idleLabel = localSource
    ? `重新选择${options.kind || "文件"}`
    : source
    ? `改用本地${options.kind || "文件"}`
    : `选择${options.kind || "文件"}`
  trigger.textContent = trigger.dataset.idleLabel

  const state = documentObject.createElement("output")
  state.id = `${control.id}Status`
  state.className = "media-file-picker-status"
  state.dataset.mediaFileName = ""
  state.setAttribute("for", control.id)
  state.setAttribute("aria-live", "polite")
  state.setAttribute("aria-atomic", "true")
  state.textContent = options.statusText || mediaFileStatus(source, fileName)
  state.title = state.textContent
  control.setAttribute("aria-label", `${labelText}，${trigger.textContent}`)
  control.setAttribute("aria-describedby", state.id)

  if (options.bgm) {
    control.dataset.bgmFileInput = ""
    trigger.dataset.bgmFileTrigger = ""
    state.dataset.bgmFileName = ""
  }
  if (options.statusDataset) state.dataset[options.statusDataset] = ""

  picker.dataset.state = localSource ? "embedded" : source ? "remote" : "empty"
  picker.append(control, trigger, state)
  wrapper.append(caption, picker)
  return wrapper
}

function setMediaFilePickerState(control, state, text) {
  const picker = control.closest("[data-media-file-picker]")
  if (!picker) return
  const trigger = picker.querySelector("[data-media-file-trigger]")
  const status = picker.querySelector("[data-media-file-name]")
  picker.dataset.state = state
  picker.setAttribute("aria-busy", state === "busy" ? "true" : "false")
  if (trigger) trigger.textContent = state === "busy" ? "正在处理…" : trigger.dataset.idleLabel
  if (status) {
    status.textContent = text
    status.title = text
  }
}

function beginMediaFileImport(control, file) {
  control.disabled = true
  setMediaFilePickerState(control, "busy", `正在导入：${file.name}…`)
}

function failMediaFileImport(control, message) {
  control.disabled = false
  control.value = ""
  setMediaFilePickerState(control, "error", message)
}

function mediaVolumeField(documentObject, control, options = {}) {
  if (!control.id) control.id = `interactiveSceneVolume-${++interactiveSceneFieldSequence}`
  control.min = "0"
  control.max = "100"
  control.step = "1"
  control.classList.add("media-volume-range")
  control.dataset.mediaVolume = ""

  const wrapper = documentObject.createElement("div")
  wrapper.className = "media-volume-control"
  const heading = documentObject.createElement("div")
  heading.className = "media-volume-heading"
  const label = documentObject.createElement("label")
  label.htmlFor = control.id
  label.textContent = options.label || "音量"
  const value = documentObject.createElement("output")
  value.id = `${control.id}Value`
  value.className = "media-volume-value"
  value.dataset.mediaVolumeValue = ""
  value.setAttribute("for", control.id)
  control.setAttribute("aria-describedby", value.id)

  function syncValue() {
    const amount = Math.min(100, Math.max(0, Math.round(Number(control.value) || 0)))
    const text = `${amount}%`
    value.textContent = text
    control.setAttribute("aria-valuetext", text)
    control.style.setProperty("--media-volume", text)
  }

  if (options.bgm) {
    control.dataset.bgmVolume = ""
    value.dataset.bgmVolumeValue = ""
  }
  control.addEventListener("input", syncValue)
  syncValue()
  heading.append(label, value)
  wrapper.append(heading, control)
  return wrapper
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
  const persistMediaAsset = options.persistMediaAsset || persistEditorMediaDataUrl
  const persistMediaBlob = options.persistMediaBlob || persistEditorMediaAsset
  const ownedMediaResolver = options.resolveMediaAsset ? null : createEditorMediaUrlResolver()
  const resolveMediaAsset = options.resolveMediaAsset || ownedMediaResolver.resolve
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
  let selectedLayerId = ""
  let selectedDialogueId = ""
  let previewController = null
  let audioPreviewController = null
  let audioClipEditor = null
  let syncWorkStyle = false
  let canvasMode = "select"
  let activeMediaLayer = "background"
  let previewDevice = "phone"
  let inspectorSection = "visual"
  let stageBgmExpanded = false
  let drawingReplaceHotspotId = ""
  let cancelActionFramePan = null

  const overlay = documentObject.createElement("div")
  overlay.className = "interactive-scene-editor-overlay"
  overlay.innerHTML = `
    <section class="interactive-scene-editor" role="dialog" aria-modal="true" aria-labelledby="interactiveSceneEditorTitle">
      <header class="interactive-scene-editor-head">
        <div><h2 id="interactiveSceneEditorTitle">互动图片</h2><p class="interactive-scene-editor-subtitle">左侧选画面 · 中间构图热区 · 右侧设置图层与对话</p></div>
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
          <div class="interactive-scene-canvas-toolbar" role="toolbar" aria-label="画面工具">
            <strong class="interactive-scene-toolbar-label">画面</strong>
            <span class="interactive-scene-tool-group" role="group" aria-label="画面预览">
              <button type="button" data-preview-device="phone" aria-pressed="true">手机竖屏</button>
              <button type="button" data-preview-device="landscape" aria-pressed="false">手机横屏</button>
              <button type="button" data-preview-device="desktop" aria-pressed="false">电脑</button>
            </span>
            <span class="interactive-scene-tool-group" role="group" aria-label="图片图层">
              <button type="button" data-media-layer="background" aria-pressed="true">背景图</button>
              <button type="button" data-media-layer="character" aria-pressed="false">立绘</button>
            </span>
            <span class="interactive-scene-tool-group" role="group" aria-label="图片调整">
              <button type="button" data-canvas-mode="pan" aria-pressed="false">移动图片</button>
              <button type="button" data-media-zoom="-0.1" aria-label="缩小图片">−</button>
              <output data-media-zoom-value aria-live="polite">100%</output>
              <button type="button" data-media-zoom="0.1" aria-label="放大图片">＋</button>
              <button type="button" data-media-zoom-reset>复位</button>
            </span>
          </div>
          <div class="interactive-scene-preview-viewport">
            <div class="interactive-scene-preview"></div>
          </div>
          <div class="interactive-scene-hotspot-toolbar" role="toolbar" aria-label="热区工具">
            <strong class="interactive-scene-toolbar-label">热区</strong>
            <span class="interactive-scene-tool-group" role="group" aria-label="热区选择与创建">
              <button type="button" data-canvas-mode="select" aria-pressed="true">选择热区</button>
              <button type="button" data-hotspot-shape="rect">＋矩形</button>
              <button type="button" data-hotspot-shape="ellipse">＋椭圆</button>
              <button type="button" data-hotspot-shape="polygon">手绘热区</button>
            </span>
          </div>
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

  const mediaLinkHelpNumber = ++interactiveSceneMediaHelpSequence
  const mediaLinkHelpPopover = documentObject.createElement("section")
  const mediaLinkHelpId = `interactiveSceneMediaHelp-${mediaLinkHelpNumber}`
  const mediaLinkHelpTitleId = `${mediaLinkHelpId}-title`
  const mediaLinkHelpCopyId = `${mediaLinkHelpId}-copy`
  mediaLinkHelpPopover.id = mediaLinkHelpId
  mediaLinkHelpPopover.className = "media-link-help-popover"
  mediaLinkHelpPopover.dataset.mediaLinkHelpPopover = ""
  mediaLinkHelpPopover.setAttribute("role", "dialog")
  mediaLinkHelpPopover.setAttribute("aria-modal", "false")
  mediaLinkHelpPopover.setAttribute("aria-labelledby", mediaLinkHelpTitleId)
  mediaLinkHelpPopover.setAttribute("aria-describedby", mediaLinkHelpCopyId)
  mediaLinkHelpPopover.tabIndex = -1
  mediaLinkHelpPopover.hidden = true
  mediaLinkHelpPopover.innerHTML = `
    <div class="media-link-help-head">
      <strong id="${mediaLinkHelpTitleId}" data-media-link-help-title></strong>
      <button type="button" class="media-link-help-close" data-media-link-help-close aria-label="关闭链接与体积说明">×</button>
    </div>
    <p class="media-link-help-copy" id="${mediaLinkHelpCopyId}" data-media-link-help-copy></p>
  `
  documentObject.body.appendChild(mediaLinkHelpPopover)

  let mediaLinkHelpInvoker = null

  function positionMediaLinkHelp() {
    if (mediaLinkHelpPopover.hidden || !mediaLinkHelpInvoker?.isConnected) return
    const view = documentObject.defaultView
    const viewportWidth = Number(view?.innerWidth) || documentObject.documentElement?.clientWidth || 1024
    const viewportHeight = Number(view?.innerHeight) || documentObject.documentElement?.clientHeight || 768
    const triggerRect = mediaLinkHelpInvoker.getBoundingClientRect()
    const popoverRect = mediaLinkHelpPopover.getBoundingClientRect()
    const popoverWidth = popoverRect.width || Math.min(340, viewportWidth - 24)
    const popoverHeight = popoverRect.height || 176
    const edge = 12
    const gap = 8
    const triggerBottom = Number.isFinite(triggerRect.bottom)
      ? triggerRect.bottom
      : triggerRect.top + triggerRect.height
    const preferredTop = triggerBottom + gap
    const top = preferredTop + popoverHeight <= viewportHeight - edge
      ? preferredTop
      : Math.max(edge, triggerRect.top - popoverHeight - gap)
    const left = clamp(triggerRect.left, edge, Math.max(edge, viewportWidth - popoverWidth - edge), edge)
    mediaLinkHelpPopover.style.setProperty("--media-link-help-left", `${Math.round(left)}px`)
    mediaLinkHelpPopover.style.setProperty("--media-link-help-top", `${Math.round(top)}px`)
  }

  function closeMediaLinkHelp(restoreFocus = true) {
    if (mediaLinkHelpPopover.hidden) return
    const invoker = mediaLinkHelpInvoker
    mediaLinkHelpPopover.hidden = true
    invoker?.setAttribute("aria-expanded", "false")
    mediaLinkHelpInvoker = null
    documentObject.removeEventListener("keydown", handleMediaLinkHelpKeydown, true)
    documentObject.removeEventListener("pointerdown", handleMediaLinkHelpOutsidePointer, true)
    documentObject.removeEventListener("scroll", positionMediaLinkHelp, true)
    documentObject.defaultView?.removeEventListener("resize", positionMediaLinkHelp)
    if (restoreFocus && invoker?.isConnected) invoker.focus()
  }

  function handleMediaLinkHelpKeydown(event) {
    if (event.key !== "Escape" || mediaLinkHelpPopover.hidden) return
    event.preventDefault()
    event.stopImmediatePropagation()
    closeMediaLinkHelp(true)
  }

  function handleMediaLinkHelpOutsidePointer(event) {
    if (
      mediaLinkHelpPopover.hidden
      || mediaLinkHelpPopover.contains(event.target)
      || mediaLinkHelpInvoker?.contains(event.target)
    ) return
    closeMediaLinkHelp(false)
  }

  function openMediaLinkHelp(trigger, title, kind) {
    if (!mediaLinkHelpPopover.hidden && mediaLinkHelpInvoker === trigger) {
      closeMediaLinkHelp(true)
      return
    }
    closeMediaLinkHelp(false)
    mediaLinkHelpInvoker = trigger
    mediaLinkHelpPopover.querySelector("[data-media-link-help-title]").textContent = title
    mediaLinkHelpPopover.querySelector("[data-media-link-help-copy]").textContent = MEDIA_LINK_HELP_COPY[kind]
    trigger.setAttribute("aria-expanded", "true")
    mediaLinkHelpPopover.hidden = false
    positionMediaLinkHelp()
    documentObject.addEventListener("keydown", handleMediaLinkHelpKeydown, true)
    documentObject.addEventListener("pointerdown", handleMediaLinkHelpOutsidePointer, true)
    documentObject.addEventListener("scroll", positionMediaLinkHelp, true)
    documentObject.defaultView?.addEventListener("resize", positionMediaLinkHelp)
    try { mediaLinkHelpPopover.focus({ preventScroll:true }) } catch (_) { mediaLinkHelpPopover.focus() }
  }

  function mediaLinkField(labelText, control, kind) {
    return field(documentObject, labelText, control, {
      kind,
      controlsId:mediaLinkHelpId,
      onOpen:openMediaLinkHelp,
    })
  }

  mediaLinkHelpPopover.querySelector("[data-media-link-help-close]").addEventListener("click", () => {
    closeMediaLinkHelp(true)
  })

  const stagePanel = overlay.querySelector(".interactive-scene-stage-panel")
  const properties = overlay.querySelector(".interactive-scene-properties")
  const preview = overlay.querySelector(".interactive-scene-preview")
  const status = overlay.querySelector(".interactive-scene-editor-status")
  const deleteSceneButton = overlay.querySelector("[data-scene-delete]")
  deleteSceneButton.hidden = options.allowDelete === false
  const requiresNextNode = Array.isArray(options.targetGroups)
  overlay.querySelector("#interactiveSceneEditorTitle").textContent = requiresNextNode ? "互动图片" : "Mini文游画面"
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
    if (!selectedStage()?.layers.some(layer => layer.id === selectedLayerId)) selectedLayerId = ""
    if (!selectedStage()?.dialogues.some(dialogue => dialogue.id === selectedDialogueId)) selectedDialogueId = ""
  }

  function mutateStage(fields) {
    updateScene({
      ...scene,
      stages: scene.stages.map(stage => stage.id === selectedStageId ? { ...stage, ...fields } : stage),
    })
  }

  function stopAudioPreview() {
    audioPreviewController?.destroy()
    audioPreviewController = null
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

  function mutatePromptStyle(fields) {
    const stage = selectedStage()
    if (!stage) return
    mutateStage({
      promptStyle:normalizeInteractivePromptStyle({
        ...stage.promptStyle,
        ...fields,
      }),
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

  function mutateLayer(fields) {
    const stage = selectedStage()
    if (!stage) return
    mutateStage({
      layers:stage.layers.map(layer => layer.id === selectedLayerId ? { ...layer, ...fields } : layer),
    })
  }

  function mutateExtraDialogue(fields) {
    const stage = selectedStage()
    if (!stage) return
    mutateStage({
      dialogues:stage.dialogues.map(dialogue => (
        dialogue.id === selectedDialogueId ? { ...dialogue, ...fields } : dialogue
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
    updateScene(normalizeInteractiveScene({
      ...scene,
      stages:scene.stages.map(candidate => candidate.id === stage.id
        ? { ...candidate, hotspots:[...candidate.hotspots, next] }
        : candidate),
    }))
    selectedHotspotId = id
    return id
  }

  function applyHotspotGeometry(element, hotspot) {
    element.style.left = `${hotspot.x}%`
    element.style.top = `${hotspot.y}%`
    element.style.width = `${hotspot.width}%`
    element.style.height = `${hotspot.height}%`
  }

  function visibleHotspotGeometry(element, fallback) {
    function percentage(property, fallbackValue) {
      const parsed = Number.parseFloat(element.style[property])
      return Number.isFinite(parsed) ? parsed : fallbackValue
    }
    return {
      x: percentage("left", fallback.x),
      y: percentage("top", fallback.y),
      width: percentage("width", fallback.width),
      height: percentage("height", fallback.height),
    }
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
    overlay.querySelectorAll("[data-preview-device]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.previewDevice === previewDevice))
    })
    preview.dataset.device = previewDevice
    const previewRatio = previewDevice === "phone" ? 9 / 16 : previewDevice === "landscape" ? 16 / 9 : 16 / 10
    preview.style.setProperty(
      "--interactive-preview-aspect",
      previewDevice === "phone" ? "9 / 16" : previewDevice === "landscape" ? "16 / 9" : "16 / 10",
    )
    preview.style.setProperty("--interactive-preview-ratio", String(previewRatio))
    preview.style.setProperty("--interactive-preview-inverse-ratio", String(1 / previewRatio))
    const stage = selectedStage()
    const transform = activeMediaLayer === "character" ? stage?.characterTransform : stage?.mediaTransform
    const zoom = transform?.scale || 1
    const output = overlay.querySelector("[data-media-zoom-value]")
    if (output) output.textContent = `${Math.round(zoom * 100)}%`
    const help = overlay.querySelector("[data-canvas-help]")
    if (help) {
      help.textContent = canvasMode === "draw-polygon"
          ? "在画面上按住并沿目标轮廓描一圈，松手完成不规则热区。"
          : canvasMode === "pan"
            ? "点击“选择热区”返回互动区域编辑。"
            : "拖动热区移动，拖四角调整大小；也可在右侧精确调整。"
    }
  }

  function enterFreehandHotspotMode(replaceHotspotId = "") {
    canvasMode = "draw-polygon"
    drawingReplaceHotspotId = replaceHotspotId
    selectedHotspotId = ""
    render()
  }

  function beginHotspotGesture(event, element, hotspot) {
    if (canvasMode !== "select") return
    event.preventDefault()
    event.stopPropagation()
    selectedHotspotId = hotspot.id
    inspectorSection = "interaction"
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
    const start = visibleHotspotGeometry(element, hotspot)
    let latestGeometry = start
    let moved = false
    element.classList.add("is-gesturing")
    try { element.setPointerCapture?.(event.pointerId) } catch (_) {}
    renderProperties()

    const move = moveEvent => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100
      latestGeometry = handle
        ? resizeInteractiveHotspot(start, handle, deltaX, deltaY)
        : moveInteractiveHotspot(start, deltaX, deltaY)
      moved = true
      applyHotspotGeometry(element, latestGeometry)
    }
    const end = () => {
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
      element.classList.remove("is-gesturing")
      try { element.releasePointerCapture?.(event.pointerId) } catch (_) {}
      if (moved) {
        mutateHotspot({
          ...latestGeometry,
          referenceAspectRatio: Math.round((rect.width / rect.height) * 10000) / 10000,
        })
      }
      renderProperties()
      refreshPreview()
    }
    documentObject.addEventListener("pointermove", move)
    documentObject.addEventListener("pointerup", end)
    documentObject.addEventListener("pointercancel", end)
  }

  function beginImagePan(event) {
    if (canvasMode !== "pan") return
    inspectorSection = "visual"
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

  function beginActionFramePan(event, element) {
    if (event.isPrimary === false) return
    if (typeof event.button === "number" && event.button !== 0) return
    const root = preview.querySelector(".interactive-scene")
    const hotspot = selectedHotspot()
    if (root?.dataset.actionFrameActive !== "true" || !hotspot?.actionFrame?.enabled) return
    const rect = root.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return

    cancelActionFramePan?.()
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const currentTransform = hotspot.actionFrame.transform || { scale:1, x:0, y:0 }
    const start = {
      scale:clamp(currentTransform.scale, .5, 4, 1),
      x:clamp(currentTransform.x, -200, 200, 0),
      y:clamp(currentTransform.y, -200, 200, 0),
    }
    let latestTransform = start
    let moved = false
    let ended = false
    const mediaElements = element.querySelectorAll(
      ".interactive-scene-action-image, .interactive-scene-action-video",
    )
    element.classList.add("is-positioning")
    try { element.setPointerCapture?.(event.pointerId) } catch (_) {}

    const move = moveEvent => {
      latestTransform = {
        ...start,
        x:clamp(start.x + ((moveEvent.clientX - startX) / rect.width) * 100, -200, 200, start.x),
        y:clamp(start.y + ((moveEvent.clientY - startY) / rect.height) * 100, -200, 200, start.y),
      }
      moved = true
      mediaElements.forEach(mediaElement => {
        mediaElement.style.setProperty("--interactive-action-x", `${latestTransform.x}%`)
        mediaElement.style.setProperty("--interactive-action-y", `${latestTransform.y}%`)
      })
    }
    const finish = (commit = true) => {
      if (ended) return
      ended = true
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
      element.removeEventListener("lostpointercapture", end)
      element.classList.remove("is-positioning")
      try { element.releasePointerCapture?.(event.pointerId) } catch (_) {}
      if (cancelActionFramePan === cancel) cancelActionFramePan = null
      const currentHotspot = selectedHotspot()
      if (!commit || !moved || currentHotspot?.id !== hotspot.id) return
      mutateHotspot({
        actionFrame:{
          ...currentHotspot.actionFrame,
          transform:latestTransform,
        },
      })
      overlay.querySelectorAll("[data-action-frame-transform]").forEach(control => {
        const key = control.dataset.actionFrameTransform
        if (key in latestTransform) control.value = String(latestTransform[key])
      })
    }
    const end = () => finish(true)
    const cancel = () => finish(false)
    cancelActionFramePan = cancel
    documentObject.addEventListener("pointermove", move)
    documentObject.addEventListener("pointerup", end)
    documentObject.addEventListener("pointercancel", end)
    element.addEventListener("lostpointercapture", end)
  }

  function beginOverlayPan(event, kind, element, dialogueId = "") {
    if (canvasMode !== "select") return
    inspectorSection = "text"
    event.preventDefault()
    event.stopPropagation()
    const root = preview.querySelector(".interactive-scene")
    const rect = root?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return
    element.classList.add("is-positioning")
    const move = moveEvent => {
      const x = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100, 50)
      const y = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100, 50)
      element.style.setProperty(`--interactive-${kind}-x`, `${x}%`)
      element.style.setProperty(`--interactive-${kind}-y`, `${y}%`)
      if (kind === "prompt") {
        mutatePromptStyle({ position:"free", x, y })
      } else if (dialogueId) {
        const current = selectedStage().dialogues.find(dialogue => dialogue.id === dialogueId)
        if (current) {
          mutateStage({
            dialogues:selectedStage().dialogues.map(dialogue => dialogue.id === dialogueId
              ? { ...dialogue, style:normalizeInteractiveDialogueStyle({ ...dialogue.style, position:"free", x, y }) }
              : dialogue),
          })
        }
      } else {
        mutateDialogueStyle({ position:"free", x, y })
      }
      element.dataset.position = "free"
    }
    const end = () => {
      documentObject.removeEventListener("pointermove", move)
      documentObject.removeEventListener("pointerup", end)
      documentObject.removeEventListener("pointercancel", end)
      element.classList.remove("is-positioning")
      renderProperties()
      refreshPreview()
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
    const promptElement = root.querySelector(".interactive-scene-prompt")
    if (promptElement && !promptElement.hidden) {
      promptElement.title = "拖动调整提示位置"
      promptElement.onpointerdown = event => beginOverlayPan(event, "prompt", promptElement)
    }
    const dialogueElement = root.querySelector(".interactive-scene-dialogue")
    if (dialogueElement) {
      dialogueElement.title = "拖动调整对话框位置"
      dialogueElement.onpointerdown = event => beginOverlayPan(event, "dialogue", dialogueElement)
    }
    root.querySelectorAll(".interactive-scene-dialogue-extra").forEach(element => {
      element.title = "拖动调整叠加对话框位置"
      element.onpointerdown = event => beginOverlayPan(event, "dialogue", element, element.dataset.dialogueId)
    })
    const actionFrameElement = root.querySelector(".interactive-scene-action-frame")
    if (actionFrameElement) {
      actionFrameElement.title = "拖动调整动作帧位置"
      actionFrameElement.onpointerdown = event => beginActionFramePan(event, actionFrameElement)
    }
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
    cancelActionFramePan?.()
    if (previewController?.updateScene) {
      previewController.updateScene(scene, selectedStageId, { normalized:true })
    } else {
      previewController = mountInteractiveScene(preview, scene, {
        documentObject,
        stageId: selectedStageId,
        normalized: true,
        cameraState: { granted: false, detectorAvailable: false },
        interactive: false,
        autoFinishActionFrame: false,
        resolveAssetUrl: resolveMediaAsset,
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
    heading.innerHTML = `<strong>画面流程</strong><small>${scene.stages.length} 幕 · ${requiresNextNode ? "按顺序播放" : "可设置轻量分支"}</small>`
    stagePanel.appendChild(heading)

    const title = input(documentObject, scene.title)
    title.maxLength = 120
    title.addEventListener("input", () => {
      scene.title = title.value
    })
    stagePanel.appendChild(field(documentObject, "场景名称", title))

    const canvasSettings = documentObject.createElement("details")
    canvasSettings.className = "interactive-scene-canvas-settings"
    const canvasSettingsSummary = documentObject.createElement("summary")
    canvasSettingsSummary.innerHTML = `<span><strong>画布规格</strong><small>${scene.canvas.width} × ${scene.canvas.height}</small></span><span aria-hidden="true">⌄</span>`
    const canvasSettingsBody = documentObject.createElement("div")
    canvasSettingsBody.className = "interactive-scene-canvas-settings-body"
    canvasSettings.append(canvasSettingsSummary, canvasSettingsBody)

    const canvasPreset = documentObject.createElement("select")
    canvasPreset.append(
      option(documentObject, "1080x1920", "9:16 竖屏（推荐）"),
      option(documentObject, "1920x1080", "16:9 横屏"),
      option(documentObject, "1080x1440", "3:4 竖屏"),
      option(documentObject, "1080x1080", "1:1 方形"),
      option(documentObject, "custom", "自定义尺寸"),
    )
    const canvasKey = `${scene.canvas.width}x${scene.canvas.height}`
    canvasPreset.value = Array.from(canvasPreset.options).some(item => item.value === canvasKey)
      ? canvasKey
      : "custom"
    canvasPreset.addEventListener("change", () => {
      if (canvasPreset.value === "custom") return
      const [width, height] = canvasPreset.value.split("x").map(Number)
      scene.canvas = normalizeInteractiveCanvas({ ...scene.canvas, width, height })
      render()
    })
    canvasSettingsBody.appendChild(field(documentObject, "逻辑画布", canvasPreset))

    const canvasDimensions = documentObject.createElement("div")
    canvasDimensions.className = "interactive-scene-coordinate-grid"
    const canvasWidth = input(documentObject, scene.canvas.width, "number")
    canvasWidth.min = "320"
    canvasWidth.max = "3840"
    const canvasHeight = input(documentObject, scene.canvas.height, "number")
    canvasHeight.min = "320"
    canvasHeight.max = "3840"
    const updateCanvasDimension = () => {
      scene.canvas = normalizeInteractiveCanvas({
        ...scene.canvas,
        width: Number(canvasWidth.value),
        height: Number(canvasHeight.value),
      })
      refreshPreview()
    }
    canvasWidth.addEventListener("change", updateCanvasDimension)
    canvasHeight.addEventListener("change", updateCanvasDimension)
    canvasDimensions.append(
      field(documentObject, "宽度", canvasWidth),
      field(documentObject, "高度", canvasHeight),
    )
    canvasSettingsBody.appendChild(canvasDimensions)

    const canvasBackground = input(documentObject, scene.canvas.backgroundColor, "color")
    canvasBackground.addEventListener("input", () => {
      scene.canvas = normalizeInteractiveCanvas({ ...scene.canvas, backgroundColor: canvasBackground.value })
      refreshPreview()
    })
    canvasSettingsBody.appendChild(field(documentObject, "画布留白颜色", canvasBackground))

    const canvasNote = documentObject.createElement("p")
    canvasNote.className = "interactive-scene-canvas-note"
    canvasNote.textContent = "所有位置都以这张固定画布为准；手机与电脑预览只改变外部窗口，不会再改变热区和构图。"
    canvasSettingsBody.appendChild(canvasNote)

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
      const choiceSummary = !requiresNextNode && stage.choices?.length ? ` · ${stage.choices.length} 个选项` : ""
      summary.textContent = `${mediaSummary} · ${stage.hotspots.length} 个互动点${choiceSummary}`
      copy.append(name, summary)
      control.append(number, copy)
      control.addEventListener("click", () => {
        selectedStageId = stage.id
        selectedHotspotId = ""
        selectedLayerId = ""
        selectedDialogueId = ""
        inspectorSection = "visual"
        render()
      })
      list.appendChild(control)
    })
    stagePanel.appendChild(list)
    stagePanel.appendChild(canvasSettings)

    const progressionDetails = documentObject.createElement("details")
    progressionDetails.className = "interactive-scene-flow-rules"
    const progressionSummary = documentObject.createElement("summary")
    progressionSummary.textContent = "画面如何依次播放？"
    const progressionNote = documentObject.createElement("p")
    progressionNote.className = "interactive-scene-stage-note"
    progressionNote.textContent = requiresNextNode
      ? "读者探索完当前画面的全部互动点后，点击对话框按列表顺序进入下一画面；没有互动点的画面可直接点击。最后一个画面完成后会固定跳转到下方选择的后续普通节点。互动图片暂不支持承载剧情分支，也不能在画面内设置选项组；需要分流时，请把选项组设置在所选的后续普通节点。"
      : "默认按左侧列表顺序播放；某个画面设置选项后，读者探索完该画面的互动点会看到选项，并跳到作者指定的画面。最后一个没有选项的画面会进入完成页。这里只提供轻量画面分支，不包含变量、条件判断、背包或脚本系统。"
    progressionDetails.append(progressionSummary, progressionNote)
    stagePanel.appendChild(progressionDetails)

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
        fit: "contain",
        mediaTransform: { scale: 1, x: 0, y: 0 },
        characterImage: "",
        characterAlt: "",
        characterFit: "contain",
        characterTransform: { scale: 1, x: 0, y: 0 },
        bgm: normalizeInteractiveBgm(),
        layers: [],
        prompt: DEFAULT_INTERACTIVE_PROMPT_TEXT,
        promptEnabled: true,
        promptStyle:normalizeInteractivePromptStyle(selectedStage()?.promptStyle || scene.promptStyle),
        dialogue: { speaker: "", text: "" },
        dialogues: [],
        choices: [],
        hotspots: [],
      })
      selectedStageId = id
      selectedHotspotId = ""
      selectedLayerId = ""
      selectedDialogueId = ""
      inspectorSection = "visual"
      updateScene(scene)
      render()
    })
    stagePanel.insertBefore(addStage, canvasSettings)

    if (scene.stages.length > 1) {
      const stageOrder = documentObject.createElement("div")
      stageOrder.className = "interactive-scene-stage-management"
      const selectedIndex = scene.stages.findIndex(stage => stage.id === selectedStageId)
      const moveEarlier = button(documentObject, "上移", "interactive-scene-add")
      const moveLater = button(documentObject, "下移", "interactive-scene-add")
      moveEarlier.disabled = selectedIndex <= 0
      moveLater.disabled = selectedIndex < 0 || selectedIndex >= scene.stages.length - 1
      const moveStage = offset => {
        const index = scene.stages.findIndex(stage => stage.id === selectedStageId)
        const target = index + offset
        if (index < 0 || target < 0 || target >= scene.stages.length) return
        const stages = [...scene.stages]
        const [moved] = stages.splice(index, 1)
        stages.splice(target, 0, moved)
        updateScene({ ...scene, stages, startStageId:stages[0].id })
        render()
      }
      moveEarlier.addEventListener("click", () => moveStage(-1))
      moveLater.addEventListener("click", () => moveStage(1))
      stageOrder.append(moveEarlier, moveLater)
      stagePanel.insertBefore(stageOrder, canvasSettings)

      const removeStage = button(documentObject, "删除", "interactive-scene-remove")
      removeStage.addEventListener("click", () => {
        const removedId = selectedStageId
        const stages = scene.stages.filter(stage => stage.id !== removedId)
        stages.forEach(stage => {
          stage.hotspots = stage.hotspots.map(hotspot => (
            hotspot.targetStageId === removedId ? { ...hotspot, targetStageId: "" } : hotspot
          ))
          stage.choices = (stage.choices || []).filter(choice => choice.targetStageId !== removedId)
        })
        selectedStageId = stages[0].id
        selectedHotspotId = ""
        updateScene({ ...scene, stages, startStageId:stages[0].id })
        render()
      })
      stageOrder.appendChild(removeStage)
    }
  }

  function renderHotspotEditor(parent) {
    const stage = selectedStage()
    const intro = documentObject.createElement("div")
    intro.className = "interactive-scene-section-intro"
    intro.innerHTML = stage.hotspots.length
      ? `<strong>设置互动区域</strong><p>先在下方选择区域，再在画布拖动位置和四角；触发后的反馈也在这里设置。</p>`
      : `<strong>让画面可以被点击</strong><p>创建第一个互动区域后，在画布上把它拖到读者需要发现的位置。</p>`
    parent.appendChild(intro)
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
      const row = documentObject.createElement("div")
      row.className = "interactive-scene-hotspot-row"
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
        inspectorSection = "interaction"
        render()
      })
      const removeControl = button(documentObject, "删除", "interactive-scene-hotspot-delete")
      removeControl.dataset.hotspotDelete = hotspot.id
      removeControl.setAttribute("aria-label", `删除互动区域：${hotspot.label}`)
      removeControl.addEventListener("click", () => {
        mutateStage({ hotspots: selectedStage().hotspots.filter(item => item.id !== hotspot.id) })
        if (selectedHotspotId === hotspot.id) selectedHotspotId = ""
        render()
      })
      row.append(control, removeControl)
      chips.appendChild(row)
    })
    const addHotspot = button(documentObject, "＋ 默认椭圆")
    addHotspot.addEventListener("click", () => {
      createHotspot("ellipse")
      canvasMode = "select"
      inspectorSection = "interaction"
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
        enterFreehandHotspotMode(hotspot.id)
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
      parent.appendChild(mediaLinkField("动作帧图片 / GIF / 视频链接", actionSource, "action"))

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

      const actionTransformGrid = documentObject.createElement("div")
      actionTransformGrid.className = "interactive-scene-coordinate-grid"
      for (const [key, caption, minimum, maximum, step] of [
        ["scale", "动作缩放", .5, 4, .05],
        ["x", "横向偏移", -200, 200, 1],
        ["y", "纵向偏移", -200, 200, 1],
      ]) {
        const control = input(documentObject, hotspot.actionFrame.transform?.[key] ?? (key === "scale" ? 1 : 0), "number")
        control.dataset.actionFrameTransform = key
        control.min = String(minimum)
        control.max = String(maximum)
        control.step = String(step)
        control.addEventListener("change", () => {
          const current = selectedHotspot()?.actionFrame || hotspot.actionFrame
          mutateActionFrame({
            transform:{
              ...(current.transform || { scale:1, x:0, y:0 }),
              [key]:Number(control.value),
            },
          })
          refreshPreview()
          previewController?.previewHotspotReaction(hotspot.id)
        })
        actionTransformGrid.appendChild(field(documentObject, caption, control))
      }
      parent.appendChild(actionTransformGrid)

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
      const actionUploadField = mediaFileField(documentObject, "本地嵌入动作帧", actionUpload, {
        source:hotspot.actionFrame.source,
        fileName:hotspot.actionFrame.fileName,
        kind:"动作帧",
        statusDataset:"actionFrameFileState",
      })
      actionUpload.addEventListener("change", async () => {
        const file = actionUpload.files?.[0]
        if (!file) return
        beginMediaFileImport(actionUpload, file)
        try {
          const isVideo = file.type.startsWith("video/")
          const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name)
          let source
          let outputBytes = file.size
          let compressed = false
          if (isVideo || isGif) {
            source = await persistMediaBlob(file, {
              fileName:file.name,
              type:file.type,
            })
          } else {
            const result = await compressImage(file)
            source = await persistMediaAsset(result.dataUrl, {
              fileName: file.name,
              type: file.type,
            })
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
          actionUpload.closest("[data-media-file-picker]").querySelector("[data-media-file-trigger]").dataset.idleLabel = "重新选择动作帧"
          setMediaFilePickerState(actionUpload, "embedded", `已嵌入 · ${file.name} · ${formatBytes(outputBytes)}`)
          status.textContent = compressed
            ? `已压缩并嵌入动作帧 ${file.name}（${formatBytes(file.size)} → ${formatBytes(outputBytes)}）`
            : `已嵌入动作帧 ${file.name}（${formatBytes(file.size)}）`
          if (detectedGifDuration) {
            status.textContent += `，首轮约 ${(detectedGifDuration / 1000).toFixed(2)} 秒`
          }
          previewAction.disabled = false
          refreshPreview()
        } catch (error) {
          const message = `动作帧导入失败：${String(error?.message || "请更换素材后重试")}`
          status.textContent = message
          failMediaFileImport(actionUpload, "导入失败，可重新选择")
        } finally {
          actionUpload.disabled = false
        }
      })
      parent.appendChild(actionUploadField)

      const actionNote = documentObject.createElement("p")
      actionNote.className = "interactive-scene-media-note"
      const actionAssetNote = parseEditorMediaAssetId(hotspot.actionFrame.source)
        ? "当前动作帧已存入本地素材库；导出作品时会自动打包一次，不会因复制图层而重复占用空间。"
        : dataUrlBytes(hotspot.actionFrame.source)
        ? `当前动作帧约 ${formatBytes(dataUrlBytes(hotspot.actionFrame.source))}，会计入作品导出体积。大型 GIF 或视频建议使用 HTTPS 图床。`
        : "支持静态图、GIF、WebP 动图、MP4 和 WebM；大型素材建议使用 HTTPS 图床。"
      actionNote.textContent = `动作帧建议沿用逻辑画布比例；点“预览动作帧”后可直接在画布拖动位置。${actionAssetNote}`
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

  function renderStageChoiceEditor(parent) {
    if (requiresNextNode) return
    const stage = selectedStage()
    const intro = documentObject.createElement("div")
    intro.className = "interactive-scene-section-intro interactive-scene-choice-intro"
    intro.innerHTML = "<strong>画面选项</strong><p>读者探索完本画面的互动点后显示。没有设置选项时，会继续播放左侧列表中的下一画面。</p>"
    parent.appendChild(intro)

    const list = documentObject.createElement("div")
    list.className = "interactive-scene-choice-editor"
    const targetStages = scene.stages.filter(candidate => candidate.id !== stage.id)
    const mutateChoice = (choiceId, fields) => {
      const currentStage = selectedStage()
      mutateStage({
        choices:(currentStage.choices || []).map(choice => (
          choice.id === choiceId ? { ...choice, ...fields } : choice
        )),
      })
    }
    for (const choice of stage.choices || []) {
      const row = documentObject.createElement("div")
      row.className = "interactive-scene-choice-row"
      row.dataset.stageChoiceId = choice.id
      const choiceLabel = input(documentObject, choice.label)
      choiceLabel.dataset.stageChoiceLabel = ""
      choiceLabel.maxLength = 120
      choiceLabel.placeholder = "例如：追上去"
      choiceLabel.addEventListener("input", () => mutateChoice(choice.id, { label:choiceLabel.value }))
      const target = documentObject.createElement("select")
      target.dataset.stageChoiceTarget = ""
      target.appendChild(option(documentObject, "", "请选择目标画面"))
      targetStages.forEach((candidate, index) => {
        const stageNumber = scene.stages.findIndex(item => item.id === candidate.id) + 1
        target.appendChild(option(
          documentObject,
          candidate.id,
          `${String(stageNumber).padStart(2, "0")} · ${candidate.name || `画面 ${index + 1}`}`,
        ))
      })
      target.value = choice.targetStageId
      target.addEventListener("change", () => mutateChoice(choice.id, { targetStageId:target.value }))
      const remove = button(documentObject, "删除", "interactive-scene-choice-delete")
      remove.dataset.stageChoiceDelete = choice.id
      remove.setAttribute("aria-label", `删除画面选项：${choice.label || "未命名选项"}`)
      remove.addEventListener("click", () => {
        mutateStage({ choices:(selectedStage().choices || []).filter(item => item.id !== choice.id) })
        renderProperties()
        refreshPreview()
      })
      row.append(
        field(documentObject, "选项文字", choiceLabel),
        field(documentObject, "跳转画面", target),
        remove,
      )
      list.appendChild(row)
    }
    parent.appendChild(list)

    const add = button(documentObject, "＋ 添加画面选项", "interactive-scene-add")
    add.dataset.stageChoiceAdd = ""
    add.disabled = (stage.choices || []).length >= 6 || targetStages.length === 0
    add.addEventListener("click", () => {
      const id = options.idFactory?.() || `choice-${Date.now().toString(36)}`
      mutateStage({
        choices:[...(selectedStage().choices || []), {
          id,
          label:`选项 ${(selectedStage().choices || []).length + 1}`,
          targetStageId:targetStages[0]?.id || "",
        }],
      })
      renderProperties()
      refreshPreview()
      properties.querySelector(`[data-stage-choice-id="${id}"] [data-stage-choice-label]`)?.focus()
    })
    parent.appendChild(add)

    const note = documentObject.createElement("p")
    note.className = "interactive-scene-stage-note"
    note.textContent = targetStages.length
      ? "每个画面最多 6 个选项，可跳到任意其他画面。请避免让选项彼此循环，导致读者无法到达完成页。"
      : "请先在左侧添加另一个画面，再为当前画面设置选项。"
    parent.appendChild(note)
  }

  function renderProperties() {
    closeMediaLinkHelp(false)
    audioClipEditor?.destroy()
    audioClipEditor = null
    properties.replaceChildren()
    const stage = selectedStage()

    const heading = documentObject.createElement("div")
    heading.className = "interactive-scene-inspector-head"
    const stageIndex = Math.max(0, scene.stages.findIndex(candidate => candidate.id === stage.id))
    heading.innerHTML = `<span class="interactive-scene-inspector-kicker">当前画面 ${String(stageIndex + 1).padStart(2, "0")}</span><strong>${stage.name || "未命名画面"}</strong><small>${stage.image || stage.characterImage || stage.layers.some(layer => layer.source) ? "画面素材已就绪" : "先添加背景图或立绘"} · ${stage.hotspots.length} 个互动区域</small>`

    const inspectorNav = documentObject.createElement("nav")
    inspectorNav.className = "interactive-scene-inspector-nav"
    inspectorNav.setAttribute("aria-label", "画面设置分类")
    const sectionConfig = [
      ["visual", "画面", stage.image || stage.characterImage ? "就绪" : "待加图"],
      ["layers", "图层", String(stage.layers.length)],
      ["text", "文字", String(1 + stage.dialogues.length)],
      ["interaction", "互动", String(stage.hotspots.length)],
    ]
    sectionConfig.forEach(([key, label, meta]) => {
      const control = button(documentObject, "")
      control.dataset.inspectorSection = key
      control.setAttribute("aria-pressed", String(inspectorSection === key))
      control.innerHTML = `<span>${label}</span><small>${meta}</small>`
      control.addEventListener("click", () => {
        inspectorSection = key
        renderProperties()
      })
      inspectorNav.appendChild(control)
    })

    const visualBody = documentObject.createElement("section")
    const layersBody = documentObject.createElement("section")
    const textBody = documentObject.createElement("section")
    const interactionBody = documentObject.createElement("section")
    const inspectorBodies = { visual:visualBody, layers:layersBody, text:textBody, interaction:interactionBody }
    Object.entries(inspectorBodies).forEach(([key, body]) => {
      body.className = "interactive-scene-inspector-body"
      body.dataset.inspectorBody = key
      body.hidden = inspectorSection !== key
    })
    properties.append(heading, inspectorNav, visualBody, layersBody, textBody, interactionBody)
    let propertyTarget = visualBody

    function appendInspectorIntro(target, title, copy) {
      const intro = documentObject.createElement("div")
      intro.className = "interactive-scene-section-intro"
      const introTitle = documentObject.createElement("strong")
      introTitle.textContent = title
      const introCopy = documentObject.createElement("p")
      introCopy.textContent = copy
      intro.append(introTitle, introCopy)
      target.appendChild(intro)
    }

    appendInspectorIntro(
      visualBody,
      "先搭好这一幕",
      `背景图建议与逻辑画布使用同一比例（当前 ${scene.canvas.width}×${scene.canvas.height}）；透明立绘可沿用画布尺寸，并在人物周围保留透明边距。新画面默认完整显示，确认构图后再按需改为铺满裁切。`,
    )

    const name = input(documentObject, stage.name)
    name.addEventListener("input", () => mutateStage({ name: name.value }))
    propertyTarget.appendChild(field(documentObject, "画面名称", name))

    const stageBgm = normalizeInteractiveBgm(stage.bgm)
    const stageBgmDetails = documentObject.createElement("details")
    stageBgmDetails.className = "interactive-scene-bgm-details"
    stageBgmDetails.open = stageBgmExpanded
    stageBgmDetails.addEventListener("toggle", () => { stageBgmExpanded = stageBgmDetails.open })
    const stageBgmSummary = documentObject.createElement("summary")
    const stageBgmSummaryTitle = documentObject.createElement("strong")
    stageBgmSummaryTitle.textContent = "本画面特殊 BGM"
    const stageBgmSummaryMeta = documentObject.createElement("small")
    stageBgmSummaryMeta.textContent = stageBgm.source
      ? `${stageBgm.fileName || "已设置音乐"} · ${stageBgm.loop ? "循环" : "单次播放"}`
      : "可选 · 未设置时继续默认音乐"
    stageBgmSummary.append(stageBgmSummaryTitle, stageBgmSummaryMeta)
    const stageBgmBody = documentObject.createElement("div")
    stageBgmBody.className = "interactive-scene-bgm-details-body"
    stageBgmDetails.append(stageBgmSummary, stageBgmBody)
    propertyTarget.appendChild(stageBgmDetails)
    propertyTarget = stageBgmBody
    const bgmSource = input(documentObject, /^asset:\/\//i.test(stageBgm.source) ? "" : stageBgm.source)
    bgmSource.placeholder = "https://…/special.mp3"
    bgmSource.dataset.stageBgmSource = ""
    bgmSource.addEventListener("input", () => {
      stopAudioPreview()
      mutateStage({ bgm:normalizeInteractiveBgm({
        ...selectedStage().bgm,
        source:bgmSource.value.trim(),
        fileName:"",
        durationMs:0,
        bytes:0,
        startMs:0,
        endMs:null,
      }) })
      const previewControl = properties.querySelector("[data-audio-clip-preview]")
      if (previewControl) previewControl.disabled = !bgmSource.value.trim()
    })
    bgmSource.addEventListener("change", renderProperties)
    propertyTarget.appendChild(mediaLinkField("特殊 BGM 链接", bgmSource, "audio"))

    const bgmUpload = input(documentObject, "", "file")
    bgmUpload.accept = "audio/*,.mp3,.ogg,.wav,.m4a,.aac,.webm"
    bgmUpload.dataset.stageBgmUpload = ""
    const bgmUploadField = mediaFileField(documentObject, "本地嵌入音频", bgmUpload, {
      source:stageBgm.source,
      fileName:stageBgm.fileName,
      kind:"音频",
      bgm:true,
    })
    bgmUpload.addEventListener("change", async () => {
      const file = bgmUpload.files?.[0]
      if (!file) return
      beginMediaFileImport(bgmUpload, file)
      try {
        const imported = await (options.importBgmFile || importInteractiveBgmFile)(
          file,
          selectedStage().bgm,
          {
            persistAsset:persistMediaBlob,
            probeAudio:options.probeAudioBlob || probeAudioBlob,
            environment:{ documentObject },
          },
        )
        stopAudioPreview()
        mutateStage({ bgm:imported })
        status.textContent = `已嵌入本画面特殊 BGM：${file.name}（${formatBytes(file.size)}）`
        renderProperties()
      } catch (error) {
        const message = String(error?.message || "请更换音频后重试")
        status.textContent = `音频导入失败：${message}`
        failMediaFileImport(bgmUpload, `导入失败：${message}`)
      }
    })
    propertyTarget.appendChild(bgmUploadField)

    const bgmControls = documentObject.createElement("div")
    bgmControls.className = "interactive-scene-bgm-controls media-playback-settings"
    const bgmVolume = input(documentObject, stageBgm.volume, "range")
    bgmVolume.addEventListener("input", () => {
      mutateStage({ bgm:normalizeInteractiveBgm({ ...selectedStage().bgm, volume:Number(bgmVolume.value) }) })
    })
    bgmControls.appendChild(mediaVolumeField(documentObject, bgmVolume, { bgm:true }))
    const bgmLoopLabel = documentObject.createElement("label")
    bgmLoopLabel.className = "interactive-scene-toggle-row media-loop-toggle"
    const bgmLoop = input(documentObject, "", "checkbox")
    bgmLoop.checked = stageBgm.loop
    bgmLoop.addEventListener("change", () => {
      mutateStage({ bgm:normalizeInteractiveBgm({ ...selectedStage().bgm, loop:bgmLoop.checked }) })
    })
    const bgmLoopCopy = documentObject.createElement("span")
    bgmLoopCopy.textContent = "循环播放"
    bgmLoopLabel.append(bgmLoop, bgmLoopCopy)
    bgmControls.appendChild(bgmLoopLabel)
    propertyTarget.appendChild(bgmControls)
    if (stageBgm.source) {
      audioClipEditor = createInteractiveBgmClipEditor({
        documentObject,
        compact:true,
        label:"本画面特殊 BGM 播放片段",
        track:stageBgm,
        onRangeChange(range) {
          stopAudioPreview()
          mutateStage({ bgm:normalizeInteractiveBgm({ ...selectedStage().bgm, ...range }) })
        },
        async onProbe() {
          const current = normalizeInteractiveBgm(selectedStage().bgm)
          if (/^asset:\/\//i.test(current.source)) {
            const asset = await (options.loadMediaAsset || loadEditorMediaAsset)(current.source)
            return (options.probeAudioBlob || probeAudioBlob)(asset.blob, { documentObject })
          }
          return (options.probeAudioUrl || probeAudioUrl)(current.source, { documentObject })
        },
        onMetadata(metadata) {
          mutateStage({ bgm:normalizeInteractiveBgm({ ...selectedStage().bgm, ...metadata }) })
        },
        onPreview() {
          stopAudioPreview()
          audioPreviewController = createInteractiveBgmController({
            documentObject,
            globalBgm:selectedStage().bgm,
            resolveAssetUrl:resolveMediaAsset,
          })
          audioPreviewController.setStage({bgm:{}})
          audioPreviewController.unlock()
        },
        onStop:stopAudioPreview,
        onClear() {
          stopAudioPreview()
          mutateStage({ bgm:normalizeInteractiveBgm() })
          renderProperties()
        },
        async onTrim(range, handlers) {
          const clipped = await (options.replaceBgmClip || replaceInteractiveBgmWithCompressedClip)(
            selectedStage().bgm,
            range,
            {
              loadAsset:options.loadMediaAsset || loadEditorMediaAsset,
              persistAsset:persistMediaBlob,
              createClip:options.createAudioClip,
              signal:handlers.signal,
              onProgress:handlers.onProgress,
              environment:{ documentObject },
            },
          )
          stopAudioPreview()
          mutateStage({ bgm:clipped.track })
          status.textContent = `特殊 BGM 已裁剪：${clipped.track.fileName}（${formatBytes(clipped.result.bytes)}）`
          renderProperties()
        },
      })
      propertyTarget.appendChild(audioClipEditor.element)
    } else {
      const bgmNote = documentObject.createElement("p")
      bgmNote.className = "interactive-scene-media-note"
      bgmNote.textContent = "不设置时继续播放作品默认 BGM；嵌入普通文章时则保持安静。"
      propertyTarget.appendChild(bgmNote)
    }

    propertyTarget = visualBody

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
      propertyTarget.appendChild(mediaHeading)

      const imageUrl = input(documentObject, stage[imageKey])
      imageUrl.placeholder = "https://…"
      imageUrl.addEventListener("change", () => {
        activeMediaLayer = layer
        mutateStage({ [imageKey]: imageUrl.value.trim() })
        render()
      })
      propertyTarget.appendChild(mediaLinkField(`${title} / GIF 链接`, imageUrl, "image"))

      const upload = input(documentObject, "", "file")
      upload.accept = "image/png,image/jpeg,image/webp,image/gif"
      const uploadField = mediaFileField(documentObject, `${title}本地嵌入`, upload, {
        source:stage[imageKey],
        kind:"图片",
      })
      upload.addEventListener("change", async () => {
        const file = upload.files?.[0]
        if (!file) return
        beginMediaFileImport(upload, file)
        try {
          const result = await compressImage(file)
          activeMediaLayer = layer
          const storedSource = await persistMediaAsset(result.dataUrl, {
            fileName: file.name,
            type: file.type,
          })
          mutateStage({ [imageKey]: storedSource })
          status.textContent = result.compressed
            ? `已压缩并嵌入${title} ${file.name}（${formatBytes(file.size)} → ${formatBytes(result.outputBytes)}）`
            : `已嵌入${title} ${file.name}（${formatBytes(file.size)}）`
          render()
        } catch (error) {
          status.textContent = `${title}导入失败：${String(error?.message || "请更换素材后重试")}`
          failMediaFileImport(upload, "导入失败，可重新选择")
        } finally {
          upload.disabled = false
        }
      })
      propertyTarget.appendChild(uploadField)

      const mediaNote = documentObject.createElement("p")
      mediaNote.className = "interactive-scene-media-note"
      const embeddedBytes = dataUrlBytes(stage[imageKey])
      mediaNote.textContent = parseEditorMediaAssetId(stage[imageKey])
        ? `当前${title}已存入本地素材库；复制图层只会复用同一份素材。`
        : embeddedBytes
        ? `当前${title}约 ${formatBytes(embeddedBytes)}，会计入作品导出体积。大型 GIF 建议使用 HTTPS 图床。`
        : "支持 PNG、JPG、WebP 和 GIF。大型 GIF 建议使用 HTTPS 图床。"
      propertyTarget.appendChild(mediaNote)

      const fit = documentObject.createElement("select")
      fit.append(option(documentObject, "cover", "铺满裁切"), option(documentObject, "contain", "完整显示"))
      fit.value = stage[fitKey] || defaultFit
      fit.addEventListener("change", () => {
        mutateStage({ [fitKey]: fit.value })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, `${title}适应`, fit))

      const alt = input(documentObject, stage[altKey])
      alt.addEventListener("input", () => mutateStage({ [altKey]: alt.value }))
      propertyTarget.appendChild(field(documentObject, `${title}替代文字`, alt))

      if (stage[imageKey]) {
        const clear = button(documentObject, `清除${title}`, "interactive-scene-remove")
        clear.addEventListener("click", () => {
          mutateStage({ [imageKey]: "" })
          render()
        })
        propertyTarget.appendChild(clear)
      }
    }

    appendMediaFields({
      title: "背景图",
      layer: "background",
      imageKey: "image",
      altKey: "alt",
      fitKey: "fit",
      defaultFit: "contain",
    })
    appendMediaFields({
      title: "立绘",
      layer: "character",
      imageKey: "characterImage",
      altKey: "characterAlt",
      fitKey: "characterFit",
      defaultFit: "contain",
    })

    propertyTarget = layersBody
    appendInspectorIntro(layersBody, "叠加辅助素材", "需要光圈、箭头或更多立绘时再添加；没有需要可以留空。")
    const layerHeading = documentObject.createElement("div")
    layerHeading.className = "interactive-scene-property-heading"
    layerHeading.innerHTML = "<strong>叠加图层</strong><small>光圈、箭头与额外立绘可独立排序 · 最多 24 个</small>"
    propertyTarget.appendChild(layerHeading)
    const layerList = documentObject.createElement("div")
    layerList.className = "interactive-scene-layer-list"
    stage.layers.forEach((layer, index) => {
      const selectLayer = button(documentObject, "")
      selectLayer.className = "interactive-scene-layer-item"
      selectLayer.setAttribute("aria-pressed", String(layer.id === selectedLayerId))
      selectLayer.textContent = `${String(index + 1).padStart(2, "0")} · ${layer.name}${layer.visible ? "" : "（隐藏）"}`
      selectLayer.addEventListener("click", () => {
        selectedLayerId = layer.id
        inspectorSection = "layers"
        render()
      })
      layerList.appendChild(selectLayer)
    })
    propertyTarget.appendChild(layerList)

    const addLayer = button(documentObject, "＋ 添加叠加图层", "interactive-scene-add")
    addLayer.disabled = stage.layers.length >= 24
    addLayer.addEventListener("click", () => {
      if (selectedStage().layers.length >= 24) return
      const id = options.idFactory?.() || `layer-${Date.now().toString(36)}`
      mutateStage({
        layers:[...stage.layers, {
          id,
          name:`图层 ${stage.layers.length + 1}`,
          source:"",
          alt:"",
          fit:"contain",
          transform:{ scale:1, x:0, y:0 },
          opacity:100,
          visible:true,
        }],
      })
      selectedLayerId = id
      inspectorSection = "layers"
      render()
    })
    propertyTarget.appendChild(addLayer)

    const selectedLayer = stage.layers.find(layer => layer.id === selectedLayerId)
    if (selectedLayer) {
      const layerName = input(documentObject, selectedLayer.name)
      layerName.addEventListener("input", () => mutateLayer({ name:layerName.value }))
      propertyTarget.appendChild(field(documentObject, "图层名称", layerName))

      const layerVisible = documentObject.createElement("label")
      layerVisible.className = "interactive-scene-toggle-row"
      const layerVisibleInput = input(documentObject, "", "checkbox")
      layerVisibleInput.checked = selectedLayer.visible
      layerVisibleInput.addEventListener("change", () => {
        mutateLayer({ visible:layerVisibleInput.checked })
        refreshPreview()
      })
      const layerVisibleCopy = documentObject.createElement("span")
      layerVisibleCopy.textContent = "显示这个图层"
      layerVisible.append(layerVisibleInput, layerVisibleCopy)
      propertyTarget.appendChild(layerVisible)

      const layerSource = input(documentObject, selectedLayer.source)
      layerSource.placeholder = "https://…"
      layerSource.addEventListener("change", () => {
        mutateLayer({ source:layerSource.value.trim() })
        refreshPreview()
      })
      propertyTarget.appendChild(mediaLinkField("图片 / GIF 链接", layerSource, "image"))

      const layerUpload = input(documentObject, "", "file")
      layerUpload.accept = "image/png,image/jpeg,image/webp,image/gif"
      const layerUploadField = mediaFileField(documentObject, "本地图片", layerUpload, {
        source:selectedLayer.source,
        kind:"图片",
      })
      layerUpload.addEventListener("change", async () => {
        const file = layerUpload.files?.[0]
        if (!file) return
        beginMediaFileImport(layerUpload, file)
        try {
          let source
          if (file.type === "image/gif" || /\.gif$/i.test(file.name)) {
            source = await persistMediaBlob(file, { fileName:file.name, type:file.type })
          } else {
            const result = await compressImage(file)
            source = await persistMediaAsset(result.dataUrl, { fileName:file.name, type:file.type })
          }
          mutateLayer({ source })
          status.textContent = `已加入图层 ${file.name}（${formatBytes(file.size)}）`
          render()
        } catch (error) {
          status.textContent = `图层导入失败：${String(error?.message || "请更换图片后重试")}`
          failMediaFileImport(layerUpload, "导入失败，可重新选择")
        } finally {
          layerUpload.disabled = false
        }
      })
      propertyTarget.appendChild(layerUploadField)

      const layerFit = documentObject.createElement("select")
      layerFit.append(option(documentObject, "contain", "完整显示"), option(documentObject, "cover", "铺满裁切"))
      layerFit.value = selectedLayer.fit
      layerFit.addEventListener("change", () => {
        mutateLayer({ fit:layerFit.value })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, "填充方式", layerFit))

      const layerTransform = documentObject.createElement("div")
      layerTransform.className = "interactive-scene-coordinate-grid"
      for (const [key, caption, minimum, maximum, step] of [
        ["scale", "缩放", .5, 4, .05],
        ["x", "横向偏移", -200, 200, 1],
        ["y", "纵向偏移", -200, 200, 1],
        ["opacity", "透明度", 0, 100, 1],
      ]) {
        const value = key === "opacity" ? selectedLayer.opacity : selectedLayer.transform[key]
        const control = input(documentObject, value, "number")
        control.min = String(minimum)
        control.max = String(maximum)
        control.step = String(step)
        control.addEventListener("change", () => {
          if (key === "opacity") mutateLayer({ opacity:Number(control.value) })
          else {
            const currentLayer = selectedStage().layers.find(layer => layer.id === selectedLayerId) || selectedLayer
            mutateLayer({ transform:{ ...currentLayer.transform, [key]:Number(control.value) } })
          }
          refreshPreview()
        })
        layerTransform.appendChild(field(documentObject, caption, control))
      }
      propertyTarget.appendChild(layerTransform)

      const layerActions = documentObject.createElement("div")
      layerActions.className = "interactive-scene-stage-order"
      const layerIndex = stage.layers.findIndex(layer => layer.id === selectedLayer.id)
      const moveDown = button(documentObject, "下移一层", "interactive-scene-add")
      const moveUp = button(documentObject, "上移一层", "interactive-scene-add")
      moveDown.disabled = layerIndex <= 0
      moveUp.disabled = layerIndex >= stage.layers.length - 1
      const reorderLayer = offset => {
        const layers = [...selectedStage().layers]
        const index = layers.findIndex(layer => layer.id === selectedLayerId)
        const target = index + offset
        if (index < 0 || target < 0 || target >= layers.length) return
        const [moved] = layers.splice(index, 1)
        layers.splice(target, 0, moved)
        mutateStage({ layers })
        render()
      }
      moveDown.addEventListener("click", () => reorderLayer(-1))
      moveUp.addEventListener("click", () => reorderLayer(1))
      layerActions.append(moveDown, moveUp)
      propertyTarget.appendChild(layerActions)

      const removeLayer = button(documentObject, "删除这个图层", "interactive-scene-remove")
      removeLayer.addEventListener("click", () => {
        mutateStage({ layers:selectedStage().layers.filter(layer => layer.id !== selectedLayerId) })
        selectedLayerId = ""
        render()
      })
      propertyTarget.appendChild(removeLayer)
    }

    propertyTarget = textBody
    appendInspectorIntro(textBody, "安排读者看到的文字", "先写提示和主对话；样式与精确排版按需展开。")
    const promptToggle = documentObject.createElement("label")
    promptToggle.className = "interactive-scene-toggle-row"
    const promptEnabled = input(documentObject, "", "checkbox")
    promptEnabled.dataset.promptEnabled = ""
    promptEnabled.checked = stage.promptEnabled
    const promptToggleCopy = documentObject.createElement("span")
    promptToggleCopy.textContent = "在当前画面显示触摸提示"
    promptToggle.append(promptEnabled, promptToggleCopy)
    propertyTarget.appendChild(promptToggle)

    const prompt = input(documentObject, stage.prompt)
    prompt.disabled = !stage.promptEnabled
    promptEnabled.addEventListener("change", () => {
      const nextPrompt = promptEnabled.checked && !selectedStage().prompt
        ? DEFAULT_INTERACTIVE_PROMPT_TEXT
        : selectedStage().prompt
      mutateStage({ promptEnabled: promptEnabled.checked, prompt: nextPrompt })
      prompt.value = nextPrompt
      prompt.disabled = !promptEnabled.checked
      refreshPreview()
    })
    prompt.addEventListener("input", () => {
      mutateStage({ prompt: prompt.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "触摸提示", prompt))

    const textRoot = propertyTarget
    const promptAdvanced = documentObject.createElement("details")
    promptAdvanced.className = "interactive-scene-advanced-group"
    const promptAdvancedSummary = documentObject.createElement("summary")
    promptAdvancedSummary.innerHTML = "<span><strong>提示样式与排版</strong><small>颜色、位置、字体与间距</small></span><span aria-hidden=\"true\">⌄</span>"
    const promptAdvancedBody = documentObject.createElement("div")
    promptAdvancedBody.className = "interactive-scene-advanced-group-body"
    promptAdvanced.append(promptAdvancedSummary, promptAdvancedBody)
    textRoot.appendChild(promptAdvanced)
    propertyTarget = promptAdvancedBody

    const promptStyleHeading = documentObject.createElement("div")
    promptStyleHeading.className = "interactive-scene-property-heading"
    promptStyleHeading.innerHTML = "<strong>触摸提示样式</strong><small>仅作用于当前画面</small>"
    propertyTarget.appendChild(promptStyleHeading)
    const stagePromptStyle = stage.promptStyle
    const promptStyleGrid = documentObject.createElement("div")
    promptStyleGrid.className = "interactive-scene-style-grid"
    for (const [key, caption] of [
      ["surfaceColor", "底色"],
      ["textColor", "文字"],
      ["borderColor", "边框"],
    ]) {
      const control = input(documentObject, stagePromptStyle[key], "color")
      control.addEventListener("input", () => {
        mutatePromptStyle({ [key]:control.value })
        refreshPreview()
      })
      promptStyleGrid.appendChild(field(documentObject, caption, control))
    }
    propertyTarget.appendChild(promptStyleGrid)
    for (const [key, caption, minimum, maximum] of [
      ["opacity", "透明度", 20, 100],
      ["borderRadius", "圆角", 0, 24],
    ]) {
      const control = input(documentObject, stagePromptStyle[key], "range")
      control.min = String(minimum)
      control.max = String(maximum)
      control.addEventListener("input", () => {
        mutatePromptStyle({ [key]:Number(control.value) })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, caption, control))
    }
    const promptPosition = documentObject.createElement("select")
    promptPosition.append(
      option(documentObject, "top", "顶部"),
      option(documentObject, "bottom", "底部"),
      option(documentObject, "free", "自由位置"),
    )
    promptPosition.value = stagePromptStyle.position
    promptPosition.addEventListener("change", () => {
      mutatePromptStyle({ position:promptPosition.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "提示位置", promptPosition))

    const promptTypography = documentObject.createElement("div")
    promptTypography.className = "interactive-scene-coordinate-grid"
    for (const [key, caption, minimum, maximum, step] of [
      ["x", "横向位置", 0, 100, 1],
      ["y", "纵向位置", 0, 100, 1],
      ["width", "提示宽度", 20, 100, 1],
      ["fontSize", "字号", 9, 36, 1],
      ["lineHeight", "行距", 1, 2.5, .05],
      ["letterSpacing", "字距", -1, 12, .25],
    ]) {
      const control = input(documentObject, stagePromptStyle[key], "number")
      control.min = String(minimum)
      control.max = String(maximum)
      control.step = String(step)
      control.addEventListener("change", () => {
        mutatePromptStyle({
          [key]: Number(control.value),
          ...(key === "x" || key === "y" ? { position:"free" } : {}),
        })
        refreshPreview()
      })
      promptTypography.appendChild(field(documentObject, caption, control))
    }
    propertyTarget.appendChild(promptTypography)
    const promptFont = documentObject.createElement("select")
    const fontLabels = ["系统黑体", "衬线体", "等宽体", "楷体"]
    INTERACTIVE_TEXT_FONTS.forEach((font, index) => promptFont.appendChild(option(documentObject, font, fontLabels[index])))
    promptFont.value = stagePromptStyle.fontFamily
    promptFont.addEventListener("change", () => {
      mutatePromptStyle({ fontFamily:promptFont.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "提示字体", promptFont))
    propertyTarget = textRoot

    const speaker = input(documentObject, stage.dialogue.speaker)
    speaker.addEventListener("input", () => {
      mutateStageDialogue({ speaker: speaker.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "说话人", speaker))

    const dialogueText = documentObject.createElement("textarea")
    dialogueText.rows = 3
    dialogueText.value = stage.dialogue.text
    dialogueText.addEventListener("input", () => {
      mutateStageDialogue({ text: dialogueText.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "初始台词", dialogueText))

    const extraDialogueHeading = documentObject.createElement("div")
    extraDialogueHeading.className = "interactive-scene-property-heading"
    extraDialogueHeading.innerHTML = "<strong>叠加对话框</strong><small>同一画面最多 12 个，可用于重叠压迫感</small>"
    propertyTarget.appendChild(extraDialogueHeading)
    const extraDialogueList = documentObject.createElement("div")
    extraDialogueList.className = "interactive-scene-layer-list"
    stage.dialogues.forEach((dialogue, index) => {
      const control = button(documentObject, "")
      control.className = "interactive-scene-layer-item"
      control.setAttribute("aria-pressed", String(dialogue.id === selectedDialogueId))
      control.textContent = `${String(index + 1).padStart(2, "0")} · ${dialogue.speaker || dialogue.text.slice(0, 16) || "空对话框"}`
      control.addEventListener("click", () => {
        selectedDialogueId = dialogue.id
        inspectorSection = "text"
        render()
      })
      extraDialogueList.appendChild(control)
    })
    propertyTarget.appendChild(extraDialogueList)
    const addDialogue = button(documentObject, "＋ 添加叠加对话框", "interactive-scene-add")
    addDialogue.disabled = stage.dialogues.length >= 12
    addDialogue.addEventListener("click", () => {
      const id = options.idFactory?.() || `dialogue-${Date.now().toString(36)}`
      const index = stage.dialogues.length
      mutateStage({ dialogues:[...stage.dialogues, {
        id,
        speaker:"",
        text:"新对话",
        style:normalizeInteractiveDialogueStyle({
          ...scene.dialogueStyle,
          position:"free",
          x:50,
          y:Math.min(92, 28 + index * 18),
        }),
      }] })
      selectedDialogueId = id
      inspectorSection = "text"
      render()
    })
    propertyTarget.appendChild(addDialogue)

    const extraDialogue = stage.dialogues.find(dialogue => dialogue.id === selectedDialogueId)
    if (extraDialogue) {
      const extraSpeaker = input(documentObject, extraDialogue.speaker)
      extraSpeaker.addEventListener("input", () => {
        mutateExtraDialogue({ speaker:extraSpeaker.value })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, "叠加框说话人", extraSpeaker))
      const extraText = documentObject.createElement("textarea")
      extraText.rows = 3
      extraText.value = extraDialogue.text
      extraText.addEventListener("input", () => {
        mutateExtraDialogue({ text:extraText.value })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, "叠加框台词", extraText))

      const extraStyleGrid = documentObject.createElement("div")
      extraStyleGrid.className = "interactive-scene-coordinate-grid"
      for (const [key, caption, minimum, maximum, step] of [
        ["x", "横向位置", 0, 100, 1],
        ["y", "纵向位置", 0, 100, 1],
        ["width", "宽度", 40, 100, 1],
        ["height", "高度", 8, 45, 1],
        ["fontSize", "字号", 10, 48, 1],
        ["lineHeight", "行距", 1, 2.5, .05],
        ["letterSpacing", "字距", -1, 12, .25],
        ["opacity", "透明度", 20, 100, 1],
      ]) {
        const control = input(documentObject, extraDialogue.style[key], "number")
        control.min = String(minimum)
        control.max = String(maximum)
        control.step = String(step)
        control.addEventListener("change", () => {
          const current = selectedStage().dialogues.find(dialogue => dialogue.id === selectedDialogueId) || extraDialogue
          mutateExtraDialogue({
            style:normalizeInteractiveDialogueStyle({
              ...current.style,
              position:"free",
              [key]:Number(control.value),
            }),
          })
          refreshPreview()
        })
        extraStyleGrid.appendChild(field(documentObject, caption, control))
      }
      propertyTarget.appendChild(extraStyleGrid)
      const extraFont = documentObject.createElement("select")
      INTERACTIVE_TEXT_FONTS.forEach((font, index) => extraFont.appendChild(option(documentObject, font, ["系统黑体", "衬线体", "等宽体", "楷体"][index])))
      extraFont.value = extraDialogue.style.fontFamily
      extraFont.addEventListener("change", () => {
        mutateExtraDialogue({ style:normalizeInteractiveDialogueStyle({ ...extraDialogue.style, fontFamily:extraFont.value }) })
        refreshPreview()
      })
      propertyTarget.appendChild(field(documentObject, "叠加框字体", extraFont))
      const removeDialogue = button(documentObject, "删除这个叠加对话框", "interactive-scene-remove")
      removeDialogue.addEventListener("click", () => {
        mutateStage({ dialogues:selectedStage().dialogues.filter(dialogue => dialogue.id !== selectedDialogueId) })
        selectedDialogueId = ""
        render()
      })
      propertyTarget.appendChild(removeDialogue)
    }

    const dialogueAdvanced = documentObject.createElement("details")
    dialogueAdvanced.className = "interactive-scene-advanced-group"
    const dialogueAdvancedSummary = documentObject.createElement("summary")
    dialogueAdvancedSummary.innerHTML = "<span><strong>主对话框样式</strong><small>边框、字体、位置与尺寸</small></span><span aria-hidden=\"true\">⌄</span>"
    const dialogueAdvancedBody = documentObject.createElement("div")
    dialogueAdvancedBody.className = "interactive-scene-advanced-group-body"
    dialogueAdvanced.append(dialogueAdvancedSummary, dialogueAdvancedBody)
    textRoot.appendChild(dialogueAdvanced)
    propertyTarget = dialogueAdvancedBody

    const styleHeading = documentObject.createElement("div")
    styleHeading.className = "interactive-scene-property-heading"
    styleHeading.innerHTML = "<strong>对话框样式</strong><small>只同步样式，不覆盖内容</small>"
    propertyTarget.appendChild(styleHeading)
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
    propertyTarget.appendChild(styleGrid)

    const frameUrl = input(documentObject, scene.dialogueStyle.frameImage)
    frameUrl.placeholder = "https://…/dialogue-frame.png"
    frameUrl.addEventListener("change", () => {
      mutateDialogueStyle({ frameImage:frameUrl.value.trim() })
      refreshPreview()
    })
    propertyTarget.appendChild(mediaLinkField("PNG 对话框素材链接", frameUrl, "frame"))

    const frameUpload = input(documentObject, "", "file")
    frameUpload.accept = "image/png"
    const frameUploadField = mediaFileField(documentObject, "本地 PNG 边框", frameUpload, {
      source:scene.dialogueStyle.frameImage,
      kind:"PNG",
    })
    frameUpload.addEventListener("change", async () => {
      const file = frameUpload.files?.[0]
      if (!file) return
      beginMediaFileImport(frameUpload, file)
      try {
        const source = await persistMediaBlob(file, { fileName:file.name, type:file.type })
        mutateDialogueStyle({ frameImage:source })
        status.textContent = `已嵌入透明 PNG ${file.name}（${formatBytes(file.size)}）`
        render()
      } catch (error) {
        status.textContent = `对话框素材导入失败：${String(error?.message || "请更换图片后重试")}`
        failMediaFileImport(frameUpload, "导入失败，可重新选择")
      } finally {
        frameUpload.disabled = false
      }
    })
    propertyTarget.appendChild(frameUploadField)

    if (scene.dialogueStyle.frameImage) {
      const clearFrame = button(documentObject, "清除 PNG 对话框素材", "interactive-scene-remove")
      clearFrame.addEventListener("click", () => {
        mutateDialogueStyle({ frameImage:"" })
        render()
      })
      propertyTarget.appendChild(clearFrame)
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
      propertyTarget.appendChild(field(documentObject, caption, control))
    }

    const position = documentObject.createElement("select")
    position.append(
      option(documentObject, "top", "顶部"),
      option(documentObject, "center", "居中"),
      option(documentObject, "bottom", "底部"),
      option(documentObject, "free", "自由位置"),
    )
    position.value = scene.dialogueStyle.position
    position.addEventListener("change", () => {
      mutateDialogueStyle({ position:position.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "位置", position))

    const dialogueTypography = documentObject.createElement("div")
    dialogueTypography.className = "interactive-scene-coordinate-grid"
    for (const [key, caption, minimum, maximum, step] of [
      ["x", "横向位置", 0, 100, 1],
      ["y", "纵向位置", 0, 100, 1],
      ["fontSize", "字号", 10, 48, 1],
      ["lineHeight", "行距", 1, 2.5, .05],
      ["letterSpacing", "字距", -1, 12, .25],
    ]) {
      const control = input(documentObject, scene.dialogueStyle[key], "number")
      control.min = String(minimum)
      control.max = String(maximum)
      control.step = String(step)
      control.addEventListener("change", () => {
        mutateDialogueStyle({
          [key]:Number(control.value),
          ...(key === "x" || key === "y" ? { position:"free" } : {}),
        })
        refreshPreview()
      })
      dialogueTypography.appendChild(field(documentObject, caption, control))
    }
    propertyTarget.appendChild(dialogueTypography)
    const dialogueFont = documentObject.createElement("select")
    INTERACTIVE_TEXT_FONTS.forEach((font, index) => dialogueFont.appendChild(option(documentObject, font, fontLabels[index])))
    dialogueFont.value = scene.dialogueStyle.fontFamily
    dialogueFont.addEventListener("change", () => {
      mutateDialogueStyle({ fontFamily:dialogueFont.value })
      refreshPreview()
    })
    propertyTarget.appendChild(field(documentObject, "对话字体", dialogueFont))
    propertyTarget = textRoot

    if (requiresNextNode) {
      const sync = documentObject.createElement("label")
      sync.className = "interactive-scene-sync"
      const checkbox = input(documentObject, "", "checkbox")
      checkbox.checked = syncWorkStyle
      checkbox.addEventListener("change", () => { syncWorkStyle = checkbox.checked })
      const syncCopy = documentObject.createElement("span")
      syncCopy.innerHTML = "<strong>同步到作品全部互动页</strong><small>互动文章专用 · 仅同步对话框外观与 PNG 素材，不覆盖角色名和台词</small>"
      sync.append(checkbox, syncCopy)
      propertyTarget.appendChild(sync)
    }

    propertyTarget = interactionBody
    renderHotspotEditor(propertyTarget)
    renderStageChoiceEditor(propertyTarget)
  }

  function render() {
    renderStages()
    renderProperties()
    refreshPreview()
  }

  function close() {
    cancelActionFramePan?.()
    closeMediaLinkHelp(false)
    previewController?.destroy()
    stopAudioPreview()
    audioClipEditor?.destroy()
    audioClipEditor = null
    ownedMediaResolver?.release()
    if (ownedMediaResolver) garbageCollectEditorMediaAssets().catch(() => {})
    mediaLinkHelpPopover.remove()
    overlay.remove()
  }

  overlay.querySelector("[data-scene-close]").addEventListener("click", close)
  overlay.querySelector("[data-scene-cancel]").addEventListener("click", close)
  overlay.querySelector("[data-scene-save]").addEventListener("click", async () => {
    const invalidChoice = !requiresNextNode
      ? scene.stages.flatMap(stage => (stage.choices || []).map(choice => ({ stage, choice }))).find(({ stage, choice }) => (
        !choice.label?.trim()
        || !scene.stages.some(candidate => candidate.id === choice.targetStageId && candidate.id !== stage.id)
      ))
      : null
    if (invalidChoice) {
      selectedStageId = invalidChoice.stage.id
      inspectorSection = "interaction"
      render()
      status.textContent = "请为画面选项填写文字，并选择另一个有效的目标画面"
      overlay.querySelector(`[data-stage-choice-id="${invalidChoice.choice.id}"] [data-stage-choice-label]`)?.focus()
      return
    }
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
  overlay.querySelectorAll("[data-preview-device]").forEach(control => {
    control.addEventListener("click", () => {
      previewDevice = control.dataset.previewDevice
      updateCanvasToolbar()
    })
  })
  overlay.querySelectorAll("[data-media-layer]").forEach(control => {
    control.addEventListener("click", () => {
      activeMediaLayer = control.dataset.mediaLayer
      inspectorSection = "visual"
      canvasMode = "pan"
      renderProperties()
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
      inspectorSection = "interaction"
      if (shape === "polygon") {
        enterFreehandHotspotMode()
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
