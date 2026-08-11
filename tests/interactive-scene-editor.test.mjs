import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

import { createInteractiveScene } from "../js/interactive-scene-model.js"
import { openInteractiveSceneEditor } from "../js/interactive-scene-editor.js"

const editorStyles = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

test("transparent extra-dialogue canvas never intercepts hotspot selection", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>${editorStyles}</style></head><body></body></html>`, {
    pretendToBeVisual:true,
  })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].dialogues = [{
    id:"dialogue-extra-1",
    speaker:"旁白",
    text:"只允许这个对话框本身接收拖动。",
    style:{ position:"free", x:50, y:50 },
  }]
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })
  const canvas = editor.overlay.querySelector(".interactive-scene-extra-dialogues")
  const dialogue = canvas.querySelector(".interactive-scene-dialogue-extra")

  assert.equal(dom.window.getComputedStyle(canvas).pointerEvents, "none")
  assert.equal(dom.window.getComputedStyle(dialogue).pointerEvents, "auto")
  editor.close()
  dom.window.close()
})

test("typing in a large scene reuses the mounted preview root", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages = Array.from({ length:40 }, (_, stageIndex) => ({
    ...scene.stages[0],
    id:`stage-${stageIndex + 1}`,
    name:`画面 ${stageIndex + 1}`,
    hotspots:Array.from({ length:20 }, (_, hotspotIndex) => ({
      id:`hotspot-${stageIndex}-${hotspotIndex}`,
      label:`区域 ${hotspotIndex}`,
      x:10,
      y:10,
      width:20,
      height:20,
      shape:"rect",
      trigger:"tap",
    })),
  }))
  scene.startStageId = "stage-1"
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })
  const preview = editor.overlay.querySelector(".interactive-scene-preview")
  const root = preview.firstElementChild
  const hotspot = root.querySelector(".interactive-scene-hotspot")
  const dialogue = editor.overlay.querySelector(".interactive-scene-properties textarea")

  for (const value of ["一", "一行", "一行台词"]) {
    dialogue.value = value
    dialogue.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
    assert.equal(preview.firstElementChild, root)
    assert.equal(root.querySelector(".interactive-scene-hotspot"), hotspot)
  }

  assert.equal(editor.scene.stages[0].dialogue.text, "一行台词")
  editor.close()
  dom.window.close()
})

test("author editor uses the shared scene renderer inside the approved three-column layout", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", nodeId: "node-1", stageId: "stage-1" })
  scene.stages[0].image = "https://example.test/hand.jpg"

  const editor = openInteractiveSceneEditor({
    scene,
    documentObject: dom.window.document,
    idFactory: () => "new-id",
  })

  assert.ok(editor.overlay.querySelector(".interactive-scene-stage-panel"))
  assert.ok(editor.overlay.querySelector(".interactive-scene-preview-panel .interactive-scene"))
  assert.ok(editor.overlay.querySelector(".interactive-scene-properties"))
  assert.match(editor.overlay.querySelector(".interactive-scene-editor-subtitle").textContent, /画面.*热区.*对话/)
  assert.deepEqual(
    [...editor.overlay.querySelectorAll(".interactive-scene-tool-group")].map(group => group.getAttribute("aria-label")),
    ["画面预览", "图片图层", "图片调整", "热区选择与创建"],
  )
  const mediaToolbar = editor.overlay.querySelector(".interactive-scene-canvas-toolbar")
  const hotspotToolbar = editor.overlay.querySelector(".interactive-scene-hotspot-toolbar")
  assert.ok(mediaToolbar.querySelector("[data-canvas-mode='pan']"))
  assert.ok(mediaToolbar.querySelector("[data-media-zoom]"))
  assert.equal(mediaToolbar.querySelector("[data-hotspot-shape]"), null)
  assert.ok(hotspotToolbar.querySelector("[data-canvas-mode='select']"))
  assert.ok(hotspotToolbar.querySelector("[data-hotspot-shape]"))
  assert.match(editor.overlay.querySelector(".interactive-scene-stage-summary").textContent, /背景图/)
  assert.match(editor.overlay.querySelector(".interactive-scene-properties").textContent, /触摸提示样式/)
  assert.deepEqual(
    [...editor.overlay.querySelectorAll("[data-inspector-section]")].map(control => control.textContent.trim()),
    ["画面就绪", "图层0", "文字1", "互动0"],
  )
  assert.equal(editor.overlay.querySelectorAll("[data-inspector-body]:not([hidden])").length, 1)
  assert.equal(editor.overlay.querySelector("[data-inspector-body='visual']").hidden, false)
  assert.ok(editor.overlay.querySelector(".interactive-scene-canvas-settings"))
  assert.equal(editor.overlay.querySelector(".interactive-scene-canvas-settings").open, false)
  assert.equal(editor.overlay.querySelector(".interactive-scene-media img").getAttribute("src"), "https://example.test/hand.jpg")
  editor.close()
  dom.window.close()
})

test("mobile scene editor exposes explicit stage, preview, and settings panes", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
  })
  const controls = editor.overlay.querySelectorAll("[data-scene-pane]")

  assert.deepEqual(Array.from(controls, control => control.dataset.scenePane), ["stages", "preview", "properties"])
  controls[2].click()
  assert.equal(editor.overlay.querySelector(".interactive-scene-editor").dataset.mobilePane, "properties")
  editor.close()
  dom.window.close()
})

test("reordering standalone stages keeps the first listed stage as the reader start", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].name = "原第一画面"
  scene.stages.push({
    ...structuredClone(scene.stages[0]),
    id:"stage-2",
    name:"原第二画面",
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })

  editor.overlay.querySelectorAll(".interactive-scene-stage-item")[1].click()
  const moveEarlier = [...editor.overlay.querySelectorAll(".interactive-scene-stage-management button")]
    .find(control => control.textContent === "上移")
  moveEarlier.click()
  assert.deepEqual(editor.scene.stages.map(stage => stage.id), ["stage-2", "stage-1"])
  assert.equal(editor.scene.startStageId, "stage-2")

  const moveLater = [...editor.overlay.querySelectorAll(".interactive-scene-stage-management button")]
    .find(control => control.textContent === "下移")
  moveLater.click()
  assert.deepEqual(editor.scene.stages.map(stage => stage.id), ["stage-1", "stage-2"])
  assert.equal(editor.scene.startStageId, "stage-1")
  assert.equal(editor.overlay.querySelector("#interactiveSceneEditorTitle").textContent, "Mini文游画面")
  assert.equal(editor.overlay.querySelector(".interactive-scene-sync"), null)
  assert.match(editor.overlay.querySelector(".interactive-scene-flow-rules").textContent, /完成页/)
  assert.doesNotMatch(editor.overlay.querySelector(".interactive-scene-flow-rules").textContent, /后续普通节点/)

  editor.close()
  dom.window.close()
})

test("standalone Mini scenes can author lightweight picture choices", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages.push(
    { ...structuredClone(scene.stages[0]), id:"stage-2", name:"追上去" },
    { ...structuredClone(scene.stages[0]), id:"stage-3", name:"留下" },
  )
  let id = 0
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject:dom.window.document,
    idFactory:() => `choice-${++id}`,
  })

  editor.overlay.querySelector("[data-inspector-section='interaction']").click()
  assert.match(editor.overlay.querySelector("[data-inspector-body='interaction']").textContent, /画面选项/)
  editor.overlay.querySelector("[data-stage-choice-add]").click()

  const label = editor.overlay.querySelector("[data-stage-choice-label]")
  const target = editor.overlay.querySelector("[data-stage-choice-target]")
  label.value = "留在这里"
  label.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  target.value = "stage-3"
  target.dispatchEvent(new dom.window.Event("change", { bubbles:true }))

  assert.deepEqual(editor.scene.stages[0].choices, [{
    id:"choice-1",
    label:"留在这里",
    targetStageId:"stage-3",
  }])
  editor.overlay.querySelector("[data-stage-choice-delete]").click()
  assert.deepEqual(editor.scene.stages[0].choices, [])
  editor.close()
  dom.window.close()
})

test("each stage can author, embed, preview, and clear a special BGM", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const reference = `asset://${"b".repeat(64)}`
  const editor = openInteractiveSceneEditor({
    scene:createInteractiveScene({ id:"scene-1", stageId:"stage-1" }),
    documentObject:dom.window.document,
    persistMediaBlob:async () => reference,
    probeAudioBlob:async file => ({ durationMs:30_000, bytes:file.size, type:file.type }),
  })
  assert.ok(editor.overlay.querySelector("[data-stage-bgm-source]"))
  const upload = editor.overlay.querySelector("[data-stage-bgm-upload]")
  const uploadTrigger = editor.overlay.querySelector("[data-bgm-file-trigger]")
  const initialFileName = editor.overlay.querySelector("[data-bgm-file-name]")
  const volume = editor.overlay.querySelector("[data-bgm-volume]")
  const volumeValue = editor.overlay.querySelector("[data-bgm-volume-value]")
  assert.ok(upload.classList.contains("sr-only"))
  assert.equal(uploadTrigger.tagName, "LABEL")
  assert.equal(uploadTrigger.htmlFor, upload.id)
  assert.equal(initialFileName.textContent.trim(), "未选择文件")
  assert.equal(initialFileName.getAttribute("for"), upload.id)
  assert.equal(volumeValue.textContent.trim(), "70%")
  volume.value = "37"
  volume.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  assert.equal(volumeValue.textContent.trim(), "37%")
  assert.equal(volume.getAttribute("aria-valuetext"), "37%")
  assert.equal(editor.scene.stages[0].bgm.volume, 37)
  const file = new dom.window.File(["audio"], "危险靠近.ogg", { type:"audio/ogg" })
  Object.defineProperty(upload, "files", { configurable:true, value:[file] })
  upload.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(editor.scene.stages[0].bgm.source, reference)
  assert.equal(editor.scene.stages[0].bgm.fileName, "危险靠近.ogg")
  assert.notEqual(editor.overlay.querySelector("[data-stage-bgm-upload]"), upload)
  assert.match(editor.overlay.querySelector("[data-bgm-file-name]").textContent, /危险靠近\.ogg/)
  assert.equal(editor.overlay.querySelector("[data-bgm-volume-value]").textContent.trim(), "37%")
  assert.ok(editor.overlay.querySelector("[data-audio-clip-preview]"))
  assert.ok(editor.overlay.querySelector("[data-audio-clip-start]"))
  editor.overlay.querySelector("[data-audio-clip-clear]").click()
  assert.equal(editor.scene.stages[0].bgm.source, reference)
  editor.overlay.querySelector("[data-audio-clip-clear]").click()
  assert.equal(editor.scene.stages[0].bgm.source, "")
  editor.close()
  dom.window.close()
})

test("all scene media links expose one accessible fixed help dialog with accurate package guidance", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>${editorStyles}</style></head><body></body></html>`, {
    pretendToBeVisual:true,
  })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].layers = [{
    id:"layer-1",
    name:"提示光圈",
    source:"",
    alt:"",
    fit:"contain",
    transform:{ scale:1, x:0, y:0 },
    opacity:100,
    visible:true,
  }]
  scene.stages[0].hotspots.push({
    id:"hotspot-1",
    label:"查看反馈",
    x:35,
    y:35,
    width:30,
    height:30,
    shape:"rect",
    trigger:"tap",
    actionFrame:{ enabled:true },
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })

  editor.overlay.querySelector(".interactive-scene-layer-item").click()
  editor.overlay.querySelector(".interactive-scene-hotspot-list button").click()

  const triggers = [...editor.overlay.querySelectorAll("[data-media-link-help-trigger]")]
  const labelFor = trigger => trigger.closest(".interactive-scene-field")
    ?.querySelector(".media-link-help-label-row label")?.textContent
  assert.deepEqual(triggers.map(labelFor), [
    "特殊 BGM 链接",
    "背景图 / GIF 链接",
    "立绘 / GIF 链接",
    "图片 / GIF 链接",
    "PNG 对话框素材链接",
    "动作帧图片 / GIF / 视频链接",
  ])

  const fileFields = [...editor.overlay.querySelectorAll("[data-media-file-picker]")]
  assert.equal(fileFields.length, 6)
  assert.deepEqual(new Set(fileFields.map(picker => (
    picker.closest(".media-file-field")?.querySelector(":scope > span")?.textContent
  ))), new Set([
    "本地嵌入音频",
    "背景图本地嵌入",
    "立绘本地嵌入",
    "本地图片",
    "本地 PNG 边框",
    "本地嵌入动作帧",
  ]))
  for (const picker of fileFields) {
    const input = picker.querySelector("[data-media-file-input]")
    const button = picker.querySelector("[data-media-file-trigger]")
    const fileName = picker.querySelector("[data-media-file-name]")
    assert.equal(input.type, "file")
    assert.ok(input.classList.contains("sr-only"))
    assert.equal(button.tagName, "LABEL")
    assert.equal(button.htmlFor, input.id)
    assert.equal(fileName.getAttribute("for"), input.id)
    assert.equal(input.getAttribute("aria-describedby"), fileName.id)
  }

  const portals = [...dom.window.document.querySelectorAll("[data-media-link-help-popover]")]
  assert.equal(portals.length, 1)
  const portal = portals[0]
  assert.equal(portal.parentElement, dom.window.document.body)
  assert.equal(dom.window.getComputedStyle(portal).position, "fixed")
  assert.equal(portal.getAttribute("role"), "dialog")
  assert.equal(portal.getAttribute("aria-modal"), "false")
  assert.ok(portal.getAttribute("aria-labelledby"))
  assert.equal(portal.hidden, true)

  for (const trigger of triggers) {
    const field = trigger.closest(".interactive-scene-field")
    const label = field.querySelector(".media-link-help-label-row label")
    const control = field.querySelector("input")
    assert.equal(trigger.tagName, "BUTTON")
    assert.equal(trigger.type, "button")
    assert.equal(trigger.textContent.trim(), "?")
    assert.match(trigger.getAttribute("aria-label"), new RegExp(label.textContent))
    assert.equal(trigger.getAttribute("aria-haspopup"), "dialog")
    assert.equal(trigger.getAttribute("aria-controls"), portal.id)
    assert.equal(trigger.getAttribute("aria-expanded"), "false")
    assert.ok(control.id)
    assert.equal(label.htmlFor, control.id)
  }

  const triggerFor = label => triggers.find(trigger => labelFor(trigger) === label)
  const imageHelp = triggerFor("背景图 / GIF 链接")
  imageHelp.getBoundingClientRect = () => ({ left:80, right:108, top:80, bottom:108, width:28, height:28 })
  imageHelp.click()
  assert.equal(portal.hidden, false)
  assert.equal(imageHelp.getAttribute("aria-expanded"), "true")
  assert.equal(dom.window.document.activeElement, portal)
  assert.match(portal.textContent, /只保存 URL/)
  assert.match(portal.textContent, /减少导出包体/)
  assert.match(portal.textContent, /本地素材名额/)
  assert.match(portal.textContent, /不会压缩图片/)
  assert.match(portal.textContent, /不会降低.*解码.*内存/)
  assert.match(portal.textContent, /联网/)
  assert.match(portal.textContent, /失效.*防盗链/)

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"Escape",
    bubbles:true,
    cancelable:true,
  }))
  assert.equal(portal.hidden, true)
  assert.equal(imageHelp.getAttribute("aria-expanded"), "false")
  assert.equal(dom.window.document.activeElement, imageHelp)
  assert.equal(editor.overlay.isConnected, true)

  const audioHelp = triggerFor("特殊 BGM 链接")
  audioHelp.click()
  assert.match(portal.textContent, /不会压缩音频/)
  assert.match(portal.textContent, /不会减少.*解码内存/)
  assert.match(portal.textContent, /只能设置播放区间/)
  assert.match(portal.textContent, /不能.*裁剪.*源文件/)
  portal.querySelector("[data-media-link-help-close]").click()
  assert.equal(portal.hidden, true)
  assert.equal(dom.window.document.activeElement, audioHelp)

  triggerFor("动作帧图片 / GIF / 视频链接").click()
  assert.match(portal.textContent, /GIF.*时长/)
  assert.match(portal.textContent, /备用播放时间/)
  portal.querySelector("[data-media-link-help-close]").click()

  triggerFor("PNG 对话框素材链接").click()
  assert.match(portal.textContent, /透明 PNG/)
  assert.match(portal.textContent, /基础对话框样式/)
  portal.querySelector("[data-media-link-help-close]").click()

  editor.close()
  assert.equal(portal.isConnected, false)
  dom.window.close()
})

test("work-wide style sync keeps the currently edited scene content and other scene dialogue", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].dialogue.text = "原台词"
  scene.nextNodeId = "node-next"
  const other = createInteractiveScene({ id: "scene-2", stageId: "stage-2" })
  other.stages[0].dialogue.text = "另一页台词"
  let saved
  const editor = openInteractiveSceneEditor({
    scene,
    allScenes: [scene, other],
    targetGroups: [{
      chapterId:"chapter-1",
      chapterName:"第一章",
      nodes:[{ nodeId:"node-next", title:"后续节点" }],
    }],
    documentObject: dom.window.document,
    onSave(nextScene, syncResult) {
      saved = { nextScene, syncResult }
    },
  })

  const dialogue = editor.overlay.querySelector(".interactive-scene-properties textarea")
  dialogue.value = "修改后的台词"
  dialogue.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  const sync = editor.overlay.querySelector(".interactive-scene-sync input")
  sync.click()
  editor.overlay.querySelector("[data-scene-save]").click()

  assert.equal(saved.nextScene.stages[0].dialogue.text, "修改后的台词")
  assert.equal(saved.syncResult.interactiveScenes.find(item => item.id === "scene-1").stages[0].dialogue.text, "修改后的台词")
  assert.equal(saved.syncResult.interactiveScenes.find(item => item.id === "scene-2").stages[0].dialogue.text, "另一页台词")
  dom.window.close()
})

test("typing initial dialogue no longer overwrites the character name", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  let saved
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
    onSave(scene) { saved = scene },
  })
  const fields = Array.from(editor.overlay.querySelectorAll(".interactive-scene-field"))
  const speaker = fields.find(item => item.querySelector(":scope > span")?.textContent === "说话人")?.querySelector("input")
  const dialogue = fields.find(item => item.querySelector(":scope > span")?.textContent === "初始台词")?.querySelector("textarea")

  speaker.value = "裴亦惜"
  speaker.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  dialogue.value = "水，给你。"
  dialogue.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  editor.overlay.querySelector("[data-scene-save]").click()

  assert.equal(saved.stages[0].dialogue.speaker, "裴亦惜")
  assert.equal(saved.stages[0].dialogue.text, "水，给你。")
  dom.window.close()
})

test("author preview exposes direct image and hotspot editing controls", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
    idFactory: () => "hotspot-new",
  })

  assert.ok(editor.overlay.querySelector("[data-canvas-mode='pan']"))
  assert.ok(editor.overlay.querySelector("[data-hotspot-shape='rect']"))
  assert.ok(editor.overlay.querySelector("[data-hotspot-shape='ellipse']"))
  assert.ok(editor.overlay.querySelector("[data-hotspot-shape='polygon']"))
  assert.ok(editor.overlay.querySelector("[data-media-zoom]"))
  assert.ok(editor.overlay.querySelector("[data-media-layer='background']"))
  assert.ok(editor.overlay.querySelector("[data-media-layer='character']"))
  dom.window.close()
})

for (const shape of ["rect", "ellipse"]) {
  test(`new ${shape} hotspots render selected and support immediate drag and resize`, () => {
    const dom = new JSDOM(`<!doctype html><html><head><style>${editorStyles}</style></head><body></body></html>`, {
      pretendToBeVisual:true,
    })
    const editor = openInteractiveSceneEditor({
      scene:createInteractiveScene({ id:"scene-1", stageId:"stage-1" }),
      documentObject:dom.window.document,
      idFactory:() => `hotspot-${shape}`,
    })
    let layer = editor.overlay.querySelector(".interactive-scene-hotspots")
    layer.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })

    editor.overlay.querySelector(`[data-hotspot-shape='${shape}']`).click()

    assert.equal(editor.scene.stages[0].hotspots.length, 1)
    assert.deepEqual(editor.scene.stages[0].hotspots[0].actionFrame, {
      enabled:false,
      source:"",
      type:"image",
      fit:"cover",
      fileName:"",
      durationMs:1800,
      gifDurationMs:0,
      transform:{ scale:1, x:0, y:0 },
    })
    layer = editor.overlay.querySelector(".interactive-scene-hotspots")
    layer.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
    let hotspot = layer.querySelector(".interactive-scene-hotspot")
    assert.ok(hotspot)
    assert.equal(hotspot.dataset.shape, shape)
    assert.equal(hotspot.classList.contains("is-selected"), true)
    assert.equal(hotspot.querySelectorAll("[data-resize-handle]").length, 4)
    assert.equal(dom.window.getComputedStyle(hotspot).borderStyle, "dashed")

    hotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
      bubbles:true,
      clientX:40,
      clientY:40,
    }))
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
      bubbles:true,
      clientX:50,
      clientY:60,
    }))
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))
    assert.deepEqual(
      (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[0]),
      { x:45, y:55, width:30, height:30 },
    )

    layer = editor.overlay.querySelector(".interactive-scene-hotspots")
    layer.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
    hotspot = layer.querySelector(".interactive-scene-hotspot")
    hotspot.querySelector("[data-resize-handle='se']").dispatchEvent(
      new dom.window.MouseEvent("pointerdown", { bubbles:true, clientX:75, clientY:85 }),
    )
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
      bubbles:true,
      clientX:85,
      clientY:95,
    }))
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))
    assert.deepEqual(
      (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[0]),
      { x:45, y:55, width:40, height:40 },
    )

    editor.close()
    dom.window.close()
  })
}

test("freehand hotspots draw across the whole canvas without creating a temporary default shape", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>${editorStyles}</style></head><body></body></html>`, {
    pretendToBeVisual:true,
  })
  const ids = ["hotspot-rect", "hotspot-polygon"]
  const editor = openInteractiveSceneEditor({
    scene:createInteractiveScene({ id:"scene-1", stageId:"stage-1" }),
    documentObject:dom.window.document,
    idFactory:() => ids.shift(),
  })
  let layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left:0, top:0, width:200, height:200 })
  editor.overlay.querySelector("[data-hotspot-shape='rect']").click()
  const existing = structuredClone(editor.scene.stages[0].hotspots[0])

  editor.overlay.querySelector("[data-hotspot-shape='polygon']").click()
  const root = editor.overlay.querySelector(".interactive-scene")
  const media = root.querySelector(".interactive-scene-media")
  media.getBoundingClientRect = () => ({ left:0, top:0, width:200, height:200 })
  assert.equal(root.dataset.canvasMode, "draw-polygon")
  assert.equal(editor.scene.stages[0].hotspots.length, 1)
  assert.equal(root.querySelector(".interactive-scene-hotspot.is-selected"), null)
  assert.equal(root.querySelectorAll("[data-resize-handle]").length, 0)
  assert.equal(dom.window.getComputedStyle(root.querySelector(".interactive-scene-hotspots")).pointerEvents, "none")

  root.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
    bubbles:true,
    clientX:10,
    clientY:10,
  }))
  for (const [clientX, clientY] of [[20, 10], [20, 20], [10, 20]]) {
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
      bubbles:true,
      clientX,
      clientY,
    }))
  }
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))

  assert.equal(editor.scene.stages[0].hotspots.length, 2)
  assert.deepEqual(editor.scene.stages[0].hotspots[0], existing)
  assert.deepEqual(
    (({ shape, x, y, width, height }) => ({ shape, x, y, width, height }))(
      editor.scene.stages[0].hotspots[1],
    ),
    { shape:"polygon", x:5, y:5, width:5, height:5 },
  )
  assert.ok(editor.scene.stages[0].hotspots[1].actionFrame)
  assert.equal(editor.overlay.querySelectorAll(".interactive-scene-hotspot").length, 2)
  assert.equal(
    editor.overlay.querySelector(".interactive-scene-hotspot.is-selected")?.dataset.hotspotId,
    "hotspot-polygon",
  )

  layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left:0, top:0, width:200, height:200 })
  let polygon = layer.querySelector(".interactive-scene-hotspot.is-selected")
  polygon.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
    bubbles:true,
    clientX:15,
    clientY:15,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
    bubbles:true,
    clientX:35,
    clientY:45,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))
  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[1]),
    { x:15, y:20, width:5, height:5 },
  )

  layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left:0, top:0, width:200, height:200 })
  polygon = layer.querySelector(".interactive-scene-hotspot.is-selected")
  polygon.querySelector("[data-resize-handle='se']").dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles:true, clientX:40, clientY:50 }),
  )
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
    bubbles:true,
    clientX:60,
    clientY:80,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))
  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[1]),
    { x:15, y:20, width:15, height:20 },
  )

  editor.close()
  dom.window.close()
})

test("switching an existing hotspot to freehand synchronizes the canvas before replacing its shape", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const editor = openInteractiveSceneEditor({
    scene:createInteractiveScene({ id:"scene-1", stageId:"stage-1" }),
    documentObject:dom.window.document,
    idFactory:() => "hotspot-replaced",
  })
  let layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
  editor.overlay.querySelector("[data-hotspot-shape='rect']").click()

  const shapeField = Array.from(editor.overlay.querySelectorAll(".interactive-scene-field"))
    .find(candidate => candidate.querySelector(":scope > span")?.textContent === "区域形状")
  const shape = shapeField.querySelector("select")
  shape.value = "polygon"
  shape.dispatchEvent(new dom.window.Event("change", { bubbles:true }))

  const root = editor.overlay.querySelector(".interactive-scene")
  const media = root.querySelector(".interactive-scene-media")
  media.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
  assert.equal(root.dataset.canvasMode, "draw-polygon")
  assert.equal(root.querySelector(".interactive-scene-hotspot.is-selected"), null)
  assert.equal(root.querySelectorAll("[data-resize-handle]").length, 0)

  root.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
    bubbles:true,
    clientX:5,
    clientY:5,
  }))
  for (const [clientX, clientY] of [[20, 5], [20, 40], [5, 40]]) {
    dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
      bubbles:true,
      clientX,
      clientY,
    }))
  }
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true }))

  assert.equal(editor.scene.stages[0].hotspots.length, 1)
  assert.equal(editor.scene.stages[0].hotspots[0].id, "hotspot-replaced")
  assert.deepEqual(
    (({ shape:nextShape, x, y, width, height }) => ({ shape:nextShape, x, y, width, height }))(
      editor.scene.stages[0].hotspots[0],
    ),
    { shape:"polygon", x:5, y:5, width:15, height:35 },
  )
  assert.ok(editor.scene.stages[0].hotspots[0].actionFrame)
  assert.equal(editor.overlay.querySelector(".interactive-scene-hotspot.is-selected")?.dataset.hotspotId, "hotspot-replaced")

  editor.close()
  dom.window.close()
})

test("the layer control stops at the same 24-layer limit enforced by normalization", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].layers = Array.from({ length:24 }, (_, index) => ({
    id:`layer-${index + 1}`,
    name:`图层 ${index + 1}`,
    source:"",
    alt:"",
    fit:"contain",
    transform:{ scale:1, x:0, y:0 },
    opacity:100,
    visible:true,
  }))
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })
  const addLayer = [...editor.overlay.querySelectorAll("button")]
    .find(control => control.textContent === "＋ 添加叠加图层")

  assert.ok(addLayer)
  assert.equal(addLayer.disabled, true)
  assert.match(editor.overlay.querySelector("[data-inspector-body='layers']").textContent, /最多 24 个/)

  editor.close()
  dom.window.close()
})

test("author editor explains ordered picture progression and removes per-hotspot picture jumps", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "掌心",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject:dom.window.document,
    targetGroups:[{
      chapterId:"chapter-1",
      chapterName:"第一章",
      nodes:[{ nodeId:"ending", title:"后续节点" }],
    }],
  })
  const progressionCopy = editor.overlay.querySelector(".interactive-scene-stage-panel").textContent

  assert.match(progressionCopy, /最后一个画面/)
  assert.match(progressionCopy, /后续普通节点/)
  assert.match(progressionCopy, /暂不支持.*剧情分支/)
  assert.match(progressionCopy, /选项组.*后续普通节点/)
  assert.match(editor.overlay.querySelector(".interactive-scene-stage-panel").textContent, /全部互动点/)
  assert.doesNotMatch(editor.overlay.querySelector(".interactive-scene-properties").textContent, /触发后切换/)
  assert.match(editor.overlay.querySelector(".interactive-scene-hotspot-meta").textContent, /点击/)

  editor.close()
  dom.window.close()
})

test("author must choose one fixed ordinary-node continuation before saving an interactive picture", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  let saved = null
  const scene = createInteractiveScene({ id: "scene-5", nodeId: "node-5", stageId: "stage-1" })
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject: dom.window.document,
    targetGroups: [{
      chapterId: "chapter-1",
      chapterName: "第一章",
      nodes: [
        { nodeId: "node-9", title: "节点 9" },
        { nodeId: "node-10", title: "节点 10" },
      ],
    }],
    onSave(nextScene) { saved = nextScene },
  })

  const selector = editor.overlay.querySelector("[data-scene-next-node]")
  assert.ok(selector)
  assert.equal(selector.required, true)
  assert.equal(selector.value, "")
  assert.match(editor.overlay.querySelector(".interactive-scene-stage-panel").textContent, /后续跳转至/)
  assert.match(editor.overlay.querySelector(".interactive-scene-stage-note").textContent, /固定跳转/)

  editor.overlay.querySelector("[data-scene-save]").click()
  assert.equal(saved, null)
  assert.match(editor.overlay.querySelector(".interactive-scene-editor-status").textContent, /请选择.*后续跳转/)
  assert.equal(dom.window.document.activeElement, selector)

  selector.value = "node-9"
  selector.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  editor.overlay.querySelector("[data-scene-save]").click()
  assert.equal(saved.nextNodeId, "node-9")
  dom.window.close()
})

test("author can drag and resize a hotspot directly on the shared preview", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "掌心",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })
  let layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 })
  let hotspot = layer.querySelector(".interactive-scene-hotspot")

  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 40, clientY: 40 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 60 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 50, clientY: 60 }))

  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[0]),
    { x: 45, y: 55, width: 30, height: 30 },
  )
  assert.equal(editor.scene.stages[0].hotspots[0].referenceAspectRatio, 1)

  layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 })
  hotspot = layer.querySelector(".interactive-scene-hotspot")
  const handle = hotspot.querySelector("[data-resize-handle='se']")
  handle.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 75, clientY: 85 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 85, clientY: 95 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 85, clientY: 95 }))

  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[0]),
    { x: 45, y: 55, width: 40, height: 40 },
  )
  editor.close()
  dom.window.close()
})

test("hotspot gestures continue from the geometry currently visible on canvas", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "可见区域",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "rect",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })
  const layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 })
  const hotspot = layer.querySelector(".interactive-scene-hotspot")
  hotspot.style.left = "10%"
  hotspot.style.top = "20%"
  hotspot.style.width = "40%"
  hotspot.style.height = "25%"

  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 30 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 50 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 30, clientY: 50 }))

  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(editor.scene.stages[0].hotspots[0]),
    { x: 20, y: 40, width: 40, height: 25 },
  )
  editor.close()
  dom.window.close()
})

test("new stages expose their own enabled touch prompt", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].promptStyle = {
    ...scene.promptStyle,
    surfaceColor:"#123456",
    position:"free",
    x:37,
    y:42,
    fontSize:19,
  }
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject: dom.window.document,
    idFactory: () => "stage-2",
  })

  editor.overlay.querySelector(".interactive-scene-stage-panel .interactive-scene-add").click()

  assert.equal(editor.scene.stages[1].promptEnabled, true)
  assert.ok(editor.scene.stages[1].prompt)
  assert.deepEqual(editor.scene.stages[1].promptStyle, editor.scene.stages[0].promptStyle)
  assert.notStrictEqual(editor.scene.stages[1].promptStyle, editor.scene.stages[0].promptStyle)
  const toggle = editor.overlay.querySelector("[data-prompt-enabled]")
  assert.equal(toggle.checked, true)
  toggle.checked = false
  toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  assert.equal(editor.scene.stages[1].promptEnabled, false)
  assert.equal(editor.overlay.querySelector(".interactive-scene-prompt").hidden, true)
  editor.close()
  dom.window.close()
})

test("new stages copy the currently selected picture prompt style", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].promptStyle = { ...scene.promptStyle, surfaceColor:"#111111", fontSize:12 }
  scene.stages.push({
    ...structuredClone(scene.stages[0]),
    id:"stage-2",
    name:"第二幕",
    promptStyle:{ ...scene.promptStyle, surfaceColor:"#abcdef", fontSize:26 },
  })
  const editor = openInteractiveSceneEditor({
    scene,
    stageId:"stage-2",
    documentObject:dom.window.document,
    idFactory:() => "stage-3",
  })

  editor.overlay.querySelector(".interactive-scene-stage-panel .interactive-scene-add").click()

  assert.deepEqual(editor.scene.stages[2].promptStyle, editor.scene.stages[1].promptStyle)
  assert.notDeepEqual(editor.scene.stages[2].promptStyle, editor.scene.stages[0].promptStyle)
  assert.notStrictEqual(editor.scene.stages[2].promptStyle, editor.scene.stages[1].promptStyle)
  editor.close()
  dom.window.close()
})

test("editing and dragging a touch prompt style only changes the selected stage", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].prompt = "第一幕提示"
  scene.stages[0].promptStyle = {
    ...scene.promptStyle,
    surfaceColor:"#123456",
    position:"top",
    x:15,
    y:20,
  }
  scene.stages.push({
    ...structuredClone(scene.stages[0]),
    id:"stage-2",
    name:"第二幕",
    prompt:"第二幕提示",
    promptStyle:{
      ...scene.promptStyle,
      surfaceColor:"#654321",
      position:"bottom",
      x:75,
      y:80,
    },
  })
  let saved
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject:dom.window.document,
    onSave(value) { saved = value },
  })
  editor.overlay.querySelector("[data-inspector-section='text']").click()
  const surfaceField = Array.from(
    editor.overlay.querySelectorAll("[data-inspector-body='text'] .interactive-scene-field"),
  ).find(candidate => candidate.querySelector(":scope > span")?.textContent === "底色")
  const surfaceControl = surfaceField.querySelector("input")

  surfaceControl.value = "#aa0000"
  surfaceControl.dispatchEvent(new dom.window.Event("input", { bubbles:true }))

  const artboard = editor.overlay.querySelector(".interactive-scene")
  artboard.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
  const prompt = artboard.querySelector(".interactive-scene-prompt")
  prompt.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles:true, clientX:15, clientY:20 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles:true, clientX:44, clientY:50 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles:true, clientX:44, clientY:50 }))

  assert.deepEqual(
    {
      surfaceColor:editor.scene.stages[0].promptStyle.surfaceColor,
      position:editor.scene.stages[0].promptStyle.position,
      x:editor.scene.stages[0].promptStyle.x,
      y:editor.scene.stages[0].promptStyle.y,
    },
    { surfaceColor:"#aa0000", position:"free", x:44, y:50 },
  )
  assert.deepEqual(
    {
      surfaceColor:editor.scene.stages[1].promptStyle.surfaceColor,
      position:editor.scene.stages[1].promptStyle.position,
      x:editor.scene.stages[1].promptStyle.x,
      y:editor.scene.stages[1].promptStyle.y,
    },
    { surfaceColor:"#654321", position:"bottom", x:75, y:80 },
  )
  assert.equal(editor.scene.stages[0].prompt, "第一幕提示")
  assert.equal(editor.scene.stages[1].prompt, "第二幕提示")

  editor.overlay.querySelector("[data-scene-save]").click()
  assert.equal(saved.stages[0].promptStyle.surfaceColor, "#aa0000")
  assert.equal(saved.stages[1].promptStyle.surfaceColor, "#654321")
  dom.window.close()
})

test("every hotspot has a visible delete action beside its selector", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "误触区域",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })

  const remove = editor.overlay.querySelector("[data-hotspot-delete='hotspot-1']")
  assert.ok(remove)
  remove.click()

  assert.equal(editor.scene.stages[0].hotspots.length, 0)
  editor.close()
  dom.window.close()
})

test("saving upgrades existing canvas hotspots with the current author canvas ratio", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "鎺屽績",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  let saved
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject: dom.window.document,
    onSave(value) { saved = value },
  })
  const layer = editor.overlay.querySelector(".interactive-scene-hotspots")
  layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 400 })

  editor.overlay.querySelector("[data-scene-save]").click()

  assert.equal(saved.stages[0].hotspots[0].referenceAspectRatio, 0.75)
  dom.window.close()
})

test("author can select and compose the character layer without moving the background", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].image = "https://example.test/background.jpg"
  scene.stages[0].characterImage = "https://example.test/character.png"
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })

  editor.overlay.querySelector("[data-media-layer='character']").click()
  const media = editor.overlay.querySelector(".interactive-scene-media")
  media.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 })
  const root = editor.overlay.querySelector(".interactive-scene")
  root.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 50 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 65, clientY: 40 }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 65, clientY: 40 }))

  assert.deepEqual(editor.scene.stages[0].mediaTransform, { scale: 1, x: 0, y: 0 })
  assert.deepEqual(editor.scene.stages[0].characterTransform, { scale: 1, x: 15, y: -10 })

  editor.overlay.querySelector("[data-media-zoom='0.1']").click()
  assert.equal(editor.scene.stages[0].characterTransform.scale, 1.1)
  editor.close()
  dom.window.close()
})

test("author can configure and preview a hotspot action frame beside its reaction dialogue", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "hotspot",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })
  editor.overlay.querySelector(".interactive-scene-hotspot-list button").click()

  const enabled = editor.overlay.querySelector("[data-action-frame-enabled]")
  enabled.checked = true
  enabled.dispatchEvent(new dom.window.Event("change", { bubbles: true }))

  const source = editor.overlay.querySelector("[data-action-frame-source]")
  source.value = "https://example.test/reaction.gif"
  source.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  editor.overlay.querySelector("[data-action-frame-preview]").click()

  assert.deepEqual(editor.scene.stages[0].hotspots[0].actionFrame, {
    enabled: true,
    source: "https://example.test/reaction.gif",
    type: "image",
    fit: "cover",
    fileName: "",
    durationMs: 1800,
    gifDurationMs: 0,
    transform: { scale: 1, x: 0, y: 0 },
  })
  assert.equal(
    editor.overlay.querySelector(".interactive-scene-action-image").getAttribute("src"),
    "https://example.test/reaction.gif",
  )
  assert.equal(editor.overlay.querySelector("[data-action-frame-preview]").textContent, "返回基础画面")
  editor.overlay.querySelector("[data-action-frame-preview]").click()
  assert.equal(editor.overlay.querySelector(".interactive-scene").dataset.actionFrameActive, "false")
  editor.close()
  dom.window.close()
})

test("a second-stage local character image is compressed before save and survives normalization", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  let saved
  const compressedSource = "data:image/webp;base64,Y29tcHJlc3NlZA=="
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
    idFactory: () => "stage-2",
    compressImage: async file => ({
      dataUrl: compressedSource,
      originalBytes: file.size,
      outputBytes: 128,
      compressed: true,
    }),
    persistMediaAsset: async dataUrl => dataUrl,
    onSave(scene) { saved = scene },
  })

  editor.overlay.querySelector(".interactive-scene-stage-panel .interactive-scene-add").click()
  const characterUpload = Array.from(editor.overlay.querySelectorAll(".interactive-scene-field"))
    .find(item => item.querySelector(":scope > span")?.textContent === "立绘本地嵌入")
    ?.querySelector("input[type='file']")
  const file = new dom.window.File(["x".repeat(600 * 1024)], "character.png", { type: "image/png" })
  Object.defineProperty(characterUpload, "files", { configurable: true, value: [file] })
  characterUpload.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  editor.overlay.querySelector("[data-scene-save]").click()
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(saved.stages[1].characterImage, compressedSource)
  assert.equal(editor.overlay.isConnected, false)
  dom.window.close()
})

test("new local scene media is stored as a binary asset reference", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const stored = []
  const reference = `asset://${"a".repeat(64)}`
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
    compressImage: async file => ({
      dataUrl: "data:image/webp;base64,Y29tcHJlc3NlZA==",
      originalBytes: file.size,
      outputBytes: 10,
      compressed: true,
    }),
    persistMediaAsset: async (dataUrl, metadata) => {
      stored.push([dataUrl, metadata])
      return reference
    },
    resolveMediaAsset: async () => "blob:scene-media",
  })
  const backgroundUpload = Array.from(editor.overlay.querySelectorAll(".interactive-scene-field"))
    .find(item => item.querySelector(":scope > span")?.textContent === "背景图本地嵌入")
    ?.querySelector("input[type='file']")
  const file = new dom.window.File(["source"], "background.png", { type: "image/png" })
  Object.defineProperty(backgroundUpload, "files", { configurable: true, value: [file] })
  backgroundUpload.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(editor.scene.stages[0].image, reference)
  assert.equal(stored.length, 1)
  assert.equal(stored[0][1].fileName, "background.png")
  editor.close()
  dom.window.close()
})

test("local action-frame selection keeps a persistent embedded-file state instead of resetting to an empty chooser", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].hotspots.push({
    id: "hotspot-1",
    label: "hotspot",
    x: 35,
    y: 35,
    width: 30,
    height: 30,
    shape: "ellipse",
    trigger: "tap",
  })
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject: dom.window.document,
    compressImage: async file => ({
      dataUrl: "data:image/webp;base64,YWN0aW9u",
      originalBytes: file.size,
      outputBytes: 6,
      compressed: true,
    }),
    persistMediaAsset: async dataUrl => dataUrl,
  })
  editor.overlay.querySelector(".interactive-scene-hotspot-list button").click()
  const enabled = editor.overlay.querySelector("[data-action-frame-enabled]")
  enabled.checked = true
  enabled.dispatchEvent(new dom.window.Event("change", { bubbles: true }))

  const upload = editor.overlay.querySelector("[data-action-frame-upload]")
  const file = new dom.window.File(["action"], "触碰反馈.png", { type: "image/png" })
  Object.defineProperty(upload, "files", { configurable: true, value: [file] })
  upload.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(editor.overlay.querySelector("[data-action-frame-upload]"), upload)
  assert.match(editor.overlay.querySelector("[data-action-frame-file-state]").textContent, /触碰反馈\.png/)
  assert.equal(editor.scene.stages[0].hotspots[0].actionFrame.fileName, "触碰反馈.png")
  editor.close()
  dom.window.close()
})

test("save errors remain visible in the scene editor instead of closing with a false success", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
    onSave() {
      const error = new Error("quota")
      error.code = "write-failed"
      throw error
    },
  })

  editor.overlay.querySelector("[data-scene-save]").click()
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(editor.overlay.isConnected, true)
  assert.match(editor.overlay.querySelector(".interactive-scene-editor-status").textContent, /存储空间|保存失败/)
  editor.close()
  dom.window.close()
})

test("dialogue height uses the same range-control pattern as dialogue width", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const editor = openInteractiveSceneEditor({
    scene: createInteractiveScene({ id: "scene-1", stageId: "stage-1" }),
    documentObject: dom.window.document,
  })

  const width = editor.overlay.querySelector("[data-dialogue-style-key='width']")
  const height = editor.overlay.querySelector("[data-dialogue-style-key='height']")
  assert.equal(width.type, "range")
  assert.equal(height.type, "range")

  height.value = "26"
  height.dispatchEvent(new dom.window.Event("input", { bubbles: true }))

  assert.equal(editor.scene.dialogueStyle.height, 26)
  assert.equal(
    editor.overlay.querySelector(".interactive-scene-dialogue").style.getPropertyValue("--interactive-dialogue-height"),
    "26%",
  )
  editor.close()
  dom.window.close()
})
