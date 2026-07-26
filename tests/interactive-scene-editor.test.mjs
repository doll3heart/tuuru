import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { createInteractiveScene } from "../js/interactive-scene-model.js"
import { openInteractiveSceneEditor } from "../js/interactive-scene-editor.js"

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
    ["图层", "画布操作", "热区工具"],
  )
  assert.match(editor.overlay.querySelector(".interactive-scene-stage-summary").textContent, /背景图/)
  assert.match(editor.overlay.querySelector(".interactive-scene-properties").textContent, /触摸提示样式/)
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

test("work-wide style sync keeps the currently edited scene content and other scene dialogue", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const scene = createInteractiveScene({ id: "scene-1", stageId: "stage-1" })
  scene.stages[0].dialogue.text = "原台词"
  const other = createInteractiveScene({ id: "scene-2", stageId: "stage-2" })
  other.stages[0].dialogue.text = "另一页台词"
  let saved
  const editor = openInteractiveSceneEditor({
    scene,
    allScenes: [scene, other],
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
  const editor = openInteractiveSceneEditor({ scene, documentObject: dom.window.document })
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
