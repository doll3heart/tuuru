import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { createInteractiveScene } from "../js/interactive-scene-model.js"
import { mountInteractiveScene } from "../js/interactive-scene-renderer.js"

test("preview controller updates scene content without replacing its root", () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    pretendToBeVisual:true,
  })
  const first = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  const second = createInteractiveScene({ id:"scene-1", stageId:"stage-2" })
  second.stages[0].dialogue = { speaker:"A", text:"updated" }
  const container = dom.window.document.getElementById("root")
  const controller = mountInteractiveScene(container, first, {
    documentObject:dom.window.document,
    interactive:false,
  })
  const root = container.firstElementChild

  controller.updateScene(second, "stage-2")

  assert.equal(container.firstElementChild, root)
  assert.equal(controller.stage.id, "stage-2")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, "updated")
  controller.destroy()
  dom.window.close()
})

function sceneFixture() {
  const scene = createInteractiveScene({
    id: "scene-1",
    nodeId: "node-1",
    stageId: "stage-1",
  })
  scene.title = "掌心"
  scene.stages[0] = {
    id: "stage-1",
    name: "初始",
    image: "https://example.test/hand.jpg",
    alt: "摊开的手掌",
    prompt: "碰一碰他的掌心",
    dialogue: { speaker: "裴亦惜", text: "你会碰哪里？" },
    hotspots: [{
      id: "hotspot-1",
      label: "掌心",
      x: 25,
      y: 30,
      width: 20,
      height: 20,
      trigger: "tap",
      targetStageId: "stage-2",
      dialogue: "抓到你了。",
    }],
  }
  scene.stages.push({
    id: "stage-2",
    name: "触碰后",
    image: "https://example.test/after.gif",
    alt: "手指收拢",
    prompt: "",
    dialogue: { speaker: "裴亦惜", text: "这次不许跑。" },
    hotspots: [],
  })
  return scene
}

test("shared renderer exposes the same stage, prompt, dialogue, and hotspot DOM", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")

  const controller = mountInteractiveScene(root, sceneFixture(), {
    documentObject: dom.window.document,
  })

  assert.equal(root.querySelector(".interactive-scene-media img").getAttribute("src"), "https://example.test/hand.jpg")
  assert.equal(root.querySelector(".interactive-scene-prompt").textContent, "碰一碰他的掌心")
  assert.equal(root.querySelector(".interactive-scene-prompt").dataset.position, "top")
  assert.equal(root.querySelector(".interactive-scene-prompt").style.getPropertyValue("--interactive-prompt-opacity"), "72%")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, "你会碰哪里？")
  assert.equal(root.querySelectorAll(".interactive-scene-hotspot").length, 1)
  assert.equal(controller.stage.id, "stage-1")
})

test("shared renderer respects each stage prompt visibility toggle", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].promptEnabled = false

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  assert.equal(root.querySelector(".interactive-scene-prompt").hidden, true)
  dom.window.close()
})

test("shared renderer reapplies the current stage prompt style when pictures switch", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  const firstStyle = {
    ...scene.promptStyle,
    surfaceColor:"#112233",
    textColor:"#fefefe",
    borderColor:"#445566",
    opacity:61,
    borderRadius:9,
    position:"free",
    x:22,
    y:31,
    width:64,
    fontFamily:"Georgia, serif",
    fontSize:18,
    lineHeight:1.8,
    letterSpacing:2,
  }
  const secondStyle = {
    ...firstStyle,
    surfaceColor:"#665544",
    position:"bottom",
    x:78,
    y:84,
    width:52,
    fontFamily:"ui-monospace, monospace",
    fontSize:24,
  }
  scene.promptStyle = firstStyle
  scene.stages[0].promptStyle = firstStyle
  scene.stages[1].prompt = "下一幕提示"
  scene.stages[1].promptEnabled = true
  scene.stages[1].promptStyle = secondStyle
  const controller = mountInteractiveScene(root, scene, { documentObject:dom.window.document })
  const prompt = root.querySelector(".interactive-scene-prompt")

  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-surface"), "#112233")
  assert.equal(prompt.dataset.position, "free")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-font-size"), "18px")

  controller.goToStage("stage-2")

  assert.equal(prompt.textContent, "下一幕提示")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-surface"), "#665544")
  assert.equal(prompt.dataset.position, "bottom")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-x"), "78%")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-y"), "84%")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-width"), "52%")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-font-family"), "ui-monospace, monospace")
  assert.equal(prompt.style.getPropertyValue("--interactive-prompt-font-size"), "24px")
  controller.destroy()
  dom.window.close()
})

test("shared renderer keeps one logical artboard and renders extra layers and dialogue boxes", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.canvas = { width:1920, height:1080, backgroundColor:"#201b1d" }
  scene.stages[0].layers = [{
    id:"arrow",
    name:"箭头",
    source:"https://example.test/arrow.png",
    alt:"提示箭头",
    fit:"contain",
    transform:{ scale:1.2, x:8, y:-4 },
    opacity:70,
    visible:true,
  }]
  scene.stages[0].dialogues = [{
    id:"pressure",
    speaker:"B",
    text:"这里。",
    style:{ position:"free", x:24, y:32, width:50, height:12 },
  }]

  mountInteractiveScene(root, scene, { documentObject:dom.window.document })

  const artboard = root.querySelector(".interactive-scene")
  const layer = root.querySelector(".interactive-scene-authored-layer")
  const dialogue = root.querySelector(".interactive-scene-dialogue-extra")
  assert.equal(artboard.style.getPropertyValue("--interactive-canvas-aspect"), String(1920 / 1080))
  assert.equal(artboard.dataset.canvasOrientation, "landscape")
  assert.equal(layer.getAttribute("src"), "https://example.test/arrow.png")
  assert.equal(layer.style.opacity, "0.7")
  assert.equal(dialogue.querySelector(".interactive-scene-dialogue-text").textContent, "这里。")
  assert.equal(dialogue.style.getPropertyValue("--interactive-dialogue-x"), "24%")
  dom.window.close()
})

test("shared renderer applies author image composition, hotspot shapes, and PNG dialogue frame", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.dialogueStyle.frameImage = "https://example.test/frame.png"
  scene.dialogueStyle.frameOutset = 12
  scene.stages[0].mediaTransform = { scale: 1.75, x: 18, y: -9 }
  scene.stages[0].hotspots[0].shape = "polygon"
  scene.stages[0].hotspots[0].points = [
    { x: 0, y: 10 },
    { x: 100, y: 0 },
    { x: 80, y: 100 },
  ]

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const image = root.querySelector(".interactive-scene-media img")
  const hotspot = root.querySelector(".interactive-scene-hotspot")
  const frame = root.querySelector(".interactive-scene-dialogue-frame")
  assert.equal(image.style.getPropertyValue("--interactive-media-scale"), "1.75")
  assert.equal(image.style.getPropertyValue("--interactive-media-x"), "18%")
  assert.equal(image.style.getPropertyValue("--interactive-media-y"), "-9%")
  assert.equal(hotspot.dataset.shape, "polygon")
  assert.match(hotspot.style.clipPath, /^polygon\(/)
  assert.equal(frame.getAttribute("src"), "https://example.test/frame.png")
  assert.equal(frame.style.getPropertyValue("--interactive-dialogue-frame-outset"), "12px")
})

test("shared renderer composes an independently transformed background and character layer", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].characterImage = "https://example.test/character.png"
  scene.stages[0].characterAlt = "人物立绘"
  scene.stages[0].characterFit = "contain"
  scene.stages[0].characterTransform = { scale: 1.4, x: 12, y: -8 }

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const background = root.querySelector(".interactive-scene-background")
  const character = root.querySelector(".interactive-scene-character")
  assert.equal(background.getAttribute("src"), "https://example.test/hand.jpg")
  assert.equal(character.getAttribute("src"), "https://example.test/character.png")
  assert.equal(character.getAttribute("alt"), "人物立绘")
  assert.equal(character.style.objectFit, "contain")
  assert.equal(character.style.getPropertyValue("--interactive-media-scale"), "1.4")
  assert.equal(character.style.getPropertyValue("--interactive-media-x"), "12%")
  assert.equal(character.style.getPropertyValue("--interactive-media-y"), "-8%")
})

test("empty optional images do not resolve to the current page or show broken-image icons", () => {
  const dom = new JSDOM("<main id='root'></main>", {
    url: "https://tuuru.test/editor",
  })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].characterImage = ""
  scene.dialogueStyle.frameImage = ""

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const character = root.querySelector(".interactive-scene-character")
  const frame = root.querySelector(".interactive-scene-dialogue-frame")
  assert.equal(character.hasAttribute("src"), false)
  assert.equal(character.hidden, true)
  assert.equal(frame.hasAttribute("src"), false)
  assert.equal(frame.hidden, true)
})

test("shared renderer resolves local binary asset references on demand", async () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  const reference = `asset://${"a".repeat(64)}`
  scene.stages[0].image = reference
  const resolved = []

  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    resolveAssetUrl: async value => {
      resolved.push(value)
      return "blob:reader-scene"
    },
  })
  await new Promise(resolve => dom.window.queueMicrotask(resolve))

  assert.deepEqual(resolved, [reference])
  assert.equal(root.querySelector(".interactive-scene-background").getAttribute("src"), "blob:reader-scene")
  dom.window.close()
})

test("shared renderer projects author-canvas hotspots onto the same source pixels in landscape", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0] = {
    ...scene.stages[0].hotspots[0],
    x: 75,
    y: 40,
    width: 10,
    height: 20,
    referenceAspectRatio: 9 / 16,
  }

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const image = root.querySelector(".interactive-scene-background")
  const layer = root.querySelector(".interactive-scene-hotspots")
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 1600 },
    naturalHeight: { configurable: true, value: 900 },
  })
  layer.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1600,
    height: 900,
    right: 1600,
    bottom: 900,
  })
  image.dispatchEvent(new dom.window.Event("load"))

  const hotspot = layer.querySelector(".interactive-scene-hotspot")
  assert.equal(hotspot.style.left, "57.91%")
  assert.equal(hotspot.style.top, "40%")
  assert.equal(hotspot.style.width, "3.16%")
  assert.equal(hotspot.style.height, "20%")
})

test("shared renderer migrates legacy hotspots with the canonical author canvas ratio", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0] = {
    ...scene.stages[0].hotspots[0],
    x: 75,
    y: 40,
    width: 10,
    height: 20,
  }
  delete scene.stages[0].hotspots[0].referenceAspectRatio

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const image = root.querySelector(".interactive-scene-background")
  const layer = root.querySelector(".interactive-scene-hotspots")
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 1600 },
    naturalHeight: { configurable: true, value: 900 },
  })
  layer.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1600,
    height: 900,
    right: 1600,
    bottom: 900,
  })
  image.dispatchEvent(new dom.window.Event("load"))

  const hotspot = layer.querySelector(".interactive-scene-hotspot")
  assert.equal(hotspot.style.left, "57.91%")
  assert.equal(hotspot.style.top, "40%")
  assert.equal(hotspot.style.width, "3.16%")
  assert.equal(hotspot.style.height, "20%")
})

test("hotspot reactions can change both speaker and dialogue without changing the stage", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].speaker = "读者"
  scene.stages[0].hotspots[0].dialogue = "这里。"

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })
  root.querySelector(".interactive-scene-hotspot").click()

  assert.equal(root.querySelector(".interactive-scene-dialogue-speaker").textContent, "读者")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, "这里。")
})

test("a hotspot reaction stays on the current picture until the dialogue advances", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const controller = mountInteractiveScene(root, sceneFixture(), {
    documentObject: dom.window.document,
  })
  const mountedRoot = root.querySelector(".interactive-scene")

  root.querySelector(".interactive-scene-hotspot").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))

  assert.equal(controller.stage.id, "stage-1")
  assert.equal(root.querySelector(".interactive-scene-media img").getAttribute("src"), "https://example.test/hand.jpg")
  assert.equal(root.querySelector(".interactive-scene-dialogue").dataset.advanceReady, "true")

  root.querySelector(".interactive-scene-dialogue").click()

  assert.equal(controller.stage.id, "stage-2")
  assert.equal(root.querySelector(".interactive-scene-media img").getAttribute("src"), "https://example.test/after.gif")
  assert.equal(root.querySelector(".interactive-scene"), mountedRoot)
})

test("dialogue click reports the number of unexplored hotspots before advancing", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots.push({
    ...scene.stages[0].hotspots[0],
    id: "hotspot-2",
    label: "第二处",
  })

  const controller = mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
  })
  const dialogue = root.querySelector(".interactive-scene-dialogue")

  dialogue.click()
  assert.equal(controller.stage.id, "stage-1")
  assert.match(root.querySelector(".interactive-scene-status").textContent, /2/)

  root.querySelector("[data-hotspot-id='hotspot-1']").click()
  dialogue.click()
  assert.equal(controller.stage.id, "stage-1")
  assert.match(root.querySelector(".interactive-scene-status").textContent, /1/)

  root.querySelector("[data-hotspot-id='hotspot-2']").click()
  assert.equal(dialogue.dataset.advanceReady, "true")
  dialogue.click()
  assert.equal(controller.stage.id, "stage-2")
})

test("the final picture completes once only after all of its interaction points are explored", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.startStageId = "stage-2"
  scene.stages = [{
    ...scene.stages[1],
    hotspots: [{
      id: "final-hotspot",
      label: "Final",
      x: 20,
      y: 20,
      width: 30,
      height: 30,
      trigger: "tap",
      dialogue: "Done",
    }],
  }]
  let completed = 0
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    onSceneComplete() { completed += 1 },
  })

  const dialogue = root.querySelector(".interactive-scene-dialogue")
  dialogue.click()
  assert.equal(completed, 0)
  assert.equal(root.querySelector(".interactive-scene").dataset.advanceBlocked, "true")

  root.querySelector(".interactive-scene-hotspot").click()
  assert.equal(dialogue.dataset.advanceReady, "true")
  dialogue.click()
  dialogue.click()
  assert.equal(completed, 1)
})

test("an empty final picture completes when its dialogue is activated", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.startStageId = "stage-2"
  scene.stages = [scene.stages[1]]
  let completedStageId = ""
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    onSceneComplete({ stage }) { completedStageId = stage.id },
  })

  const dialogue = root.querySelector(".interactive-scene-dialogue")
  assert.equal(dialogue.dataset.advanceReady, "true")
  dialogue.click()
  assert.equal(completedStageId, "stage-2")
})

test("swiping across a hotspot activates it while a short movement does not", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].trigger = "swipe"
  const controller = mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
  })
  const hotspot = root.querySelector(".interactive-scene-hotspot")

  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }))
  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 25, clientY: 10 }))
  assert.equal(controller.stage.id, "stage-1")

  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }))
  hotspot.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 60, clientY: 10 }))
  assert.equal(controller.stage.id, "stage-1")
  assert.equal(hotspot.dataset.explored, "true")

  root.querySelector(".interactive-scene-dialogue").click()
  assert.equal(controller.stage.id, "stage-2")
})

test("camera-combination triggers arm first and then wait for tap or hold", async () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  let near
  let completed = 0
  const controller = mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: {
      granted: true,
      detectorAvailable: true,
      subscribe(listener) { near = listener; return () => {} },
    },
    onComplete() { completed += 1 },
  })
  const hotspot = root.querySelector(".interactive-scene-hotspot")

  near()
  assert.equal(hotspot.dataset.faceArmed, "true")
  hotspot.click()
  assert.equal(completed, 1)

  controller.destroy()
  scene.stages[0].hotspots[0].trigger = "face-near-hold"
  scene.stages[0].hotspots[0].holdMs = 300
  let nearHold
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: {
      granted: true,
      detectorAvailable: true,
      subscribe(listener) { nearHold = listener; return () => {} },
    },
    onComplete() { completed += 1 },
  })
  const holdHotspot = root.querySelector(".interactive-scene-hotspot")
  nearHold()
  holdHotspot.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true }))
  await new Promise(resolve => setTimeout(resolve, 330))
  assert.equal(completed, 2)
})

test("camera-combination tap accepts a touch immediately before proximity confirmation", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  let near
  let completed = 0
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: {
      granted: true,
      detectorAvailable: true,
      subscribe(listener) { near = listener; return () => {} },
    },
    onComplete() { completed += 1 },
  })

  root.querySelector(".interactive-scene-hotspot").click()
  assert.equal(completed, 0)
  near()
  assert.equal(completed, 1)
})

test("camera-combination tap discards an old distant click before proximity confirmation", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  let near
  let completed = 0
  let now = 1000
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    now: () => now,
    cameraState: {
      granted: true,
      detectorAvailable: true,
      subscribe(listener) { near = listener; return () => {} },
    },
    onComplete() { completed += 1 },
  })

  root.querySelector(".interactive-scene-hotspot").click()
  now += 2000
  near()

  assert.equal(completed, 0)
  assert.equal(root.querySelector(".interactive-scene-hotspot").dataset.faceArmed, "true")
})

test("camera-combination proximity permission expires after three seconds", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  let near
  let completed = 0
  let now = 1000
  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    now: () => now,
    cameraState: {
      granted: true,
      detectorAvailable: true,
      subscribe(listener) { near = listener; return () => {} },
    },
    onComplete() { completed += 1 },
  })

  near()
  now += 3001
  root.querySelector(".interactive-scene-hotspot").click()

  assert.equal(completed, 0)
  assert.equal(root.querySelector(".interactive-scene-hotspot").dataset.faceArmed, "false")
})

test("unavailable camera interactions use the author fallback trigger without requesting camera mid-scene", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].trigger = "face-near"
  scene.stages[0].hotspots[0].fallbackTrigger = "tap"

  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: { granted: false, detectorAvailable: false },
  })

  const hotspot = root.querySelector(".interactive-scene-hotspot")
  assert.equal(hotspot.dataset.activeTrigger, "tap")
  assert.match(root.querySelector(".interactive-scene-status").textContent, /备用互动/)
})

test("camera-combination triggers also fall back to the authored tap or hold action", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  scene.stages[0].hotspots[0].fallbackTrigger = "hold"

  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: { granted: false, detectorAvailable: false },
  })

  assert.equal(root.querySelector(".interactive-scene-hotspot").dataset.activeTrigger, "hold")
  assert.match(root.querySelector(".interactive-scene-status").textContent, /备用互动/)
})

test("granted camera permission never degrades a proximity combination into an ordinary click", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].trigger = "face-near-tap"
  scene.stages[0].hotspots[0].fallbackTrigger = "tap"
  let completed = 0
  const controller = mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    cameraState: { granted: true, detectorAvailable: false, reason: "detector-unavailable" },
    onComplete() { completed += 1 },
  })
  const hotspot = root.querySelector(".interactive-scene-hotspot")

  hotspot.click()

  assert.equal(hotspot.dataset.activeTrigger, "face-near-tap")
  assert.equal(controller.stage.id, "stage-1")
  assert.equal(completed, 0)
})

test("shared renderer applies the author dialogue height beside its existing width", () => {
  const dom = new JSDOM("<main id='root'></main>")
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.dialogueStyle.height = 24

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })

  const dialogue = root.querySelector(".interactive-scene-dialogue")
  assert.equal(dialogue.style.getPropertyValue("--interactive-dialogue-width"), "88%")
  assert.equal(dialogue.style.getPropertyValue("--interactive-dialogue-height"), "24%")
})

test("a hotspot action image appears with its dialogue and returns to the base picture while exploration remains", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].actionFrame = {
    enabled: true,
    source: "https://example.test/palm-reaction.gif",
    type: "image",
    fit: "contain",
    durationMs: 1800,
    gifDurationMs: 0,
    fileName: "",
  }
  scene.stages[0].hotspots.push({
    ...scene.stages[0].hotspots[0],
    id: "hotspot-2",
    label: "second",
    actionFrame: {
      enabled: false,
      source: "",
      type: "image",
      fit: "cover",
      durationMs: 1800,
      gifDurationMs: 0,
      fileName: "",
    },
  })

  mountInteractiveScene(root, scene, { documentObject: dom.window.document })
  root.querySelector("[data-hotspot-id='hotspot-1']").click()

  const actionFrame = root.querySelector(".interactive-scene-action-frame")
  const actionImage = root.querySelector(".interactive-scene-action-image")
  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "true")
  assert.equal(actionFrame.hidden, false)
  assert.equal(actionImage.getAttribute("src"), "https://example.test/palm-reaction.gif")
  assert.equal(actionImage.style.objectFit, "contain")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, scene.stages[0].hotspots[0].dialogue)

  root.querySelector(".interactive-scene-dialogue").click()

  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "false")
  assert.equal(actionFrame.hidden, true)
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, scene.stages[0].dialogue.text)
})

test("a hotspot action video is inline, muted, plays once, and returns on ended", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].actionFrame = {
    enabled: true,
    source: "https://example.test/reaction.webm",
    type: "video",
    fit: "cover",
    durationMs: 1800,
    gifDurationMs: 0,
    fileName: "reaction.webm",
  }

  const controller = mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    playActionMedia: false,
  })
  root.querySelector(".interactive-scene-hotspot").click()

  const video = root.querySelector(".interactive-scene-action-video")
  assert.equal(video.getAttribute("src"), "https://example.test/reaction.webm")
  assert.equal(video.muted, true)
  assert.equal(video.loop, false)
  assert.equal(video.playsInline, true)
  assert.equal(controller.stage.id, "stage-1")

  video.dispatchEvent(new dom.window.Event("ended"))
  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "false")
  assert.equal(controller.stage.id, "stage-1")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, scene.stages[0].dialogue.text)
})

test("a static action image automatically returns after the author duration", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].actionFrame = {
    enabled: true,
    source: "https://example.test/reaction.png",
    type: "image",
    fit: "cover",
    durationMs: 2750,
    gifDurationMs: 0,
    fileName: "reaction.png",
  }
  const scheduled = []
  let ended = 0

  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay })
      return scheduled.length
    },
    clearTimeout() {},
    onActionFrameEnd() { ended += 1 },
  })
  root.querySelector(".interactive-scene-hotspot").click()

  assert.equal(scheduled.at(-1).delay, 2750)
  scheduled.at(-1).callback()
  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "false")
  assert.equal(root.querySelector(".interactive-scene-dialogue-text").textContent, scene.stages[0].dialogue.text)
  assert.equal(ended, 1)
})

test("an author preview can keep an action frame visible until it is cleared", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].actionFrame = {
    enabled:true,
    source:"https://example.test/reaction.png",
    type:"image",
    fit:"contain",
    durationMs:300,
    gifDurationMs:0,
    fileName:"reaction.png",
  }
  const scheduled = []
  const controller = mountInteractiveScene(root, scene, {
    documentObject:dom.window.document,
    autoFinishActionFrame:false,
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay })
      return scheduled.length
    },
    clearTimeout() {},
  })

  controller.previewHotspotReaction("hotspot-1")

  assert.equal(scheduled.length, 0)
  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "true")
  controller.clearHotspotReaction()
  assert.equal(root.querySelector(".interactive-scene").dataset.actionFrameActive, "false")
  controller.destroy()
  dom.window.close()
})

test("a GIF action frame uses its detected first-loop duration", () => {
  const dom = new JSDOM("<main id='root'></main>", { pretendToBeVisual: true })
  const root = dom.window.document.getElementById("root")
  const scene = sceneFixture()
  scene.stages[0].hotspots[0].targetStageId = ""
  scene.stages[0].hotspots[0].actionFrame = {
    enabled: true,
    source: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    type: "image",
    fit: "cover",
    durationMs: 1800,
    gifDurationMs: 840,
    fileName: "reaction.gif",
  }
  const scheduled = []

  mountInteractiveScene(root, scene, {
    documentObject: dom.window.document,
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay })
      return scheduled.length
    },
    clearTimeout() {},
  })
  root.querySelector(".interactive-scene-hotspot").click()

  assert.equal(scheduled.at(-1).delay, 840)
})
