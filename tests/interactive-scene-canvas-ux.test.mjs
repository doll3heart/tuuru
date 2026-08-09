import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { openInteractiveSceneEditor } from "../js/interactive-scene-editor.js"
import { createInteractiveScene, normalizeInteractiveScene } from "../js/interactive-scene-model.js"

test("new pictures start with the complete image visible", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })

  assert.equal(scene.stages[0].fit, "contain")

  const editor = openInteractiveSceneEditor({
    scene,
    documentObject:dom.window.document,
    idFactory:() => "stage-2",
  })
  editor.overlay.querySelector(".interactive-scene-stage-panel .interactive-scene-add").click()
  assert.equal(editor.scene.stages[1].fit, "contain")

  editor.close()
  dom.window.close()
})

test("legacy pictures without an explicit fit keep their original cover layout", () => {
  const scene = normalizeInteractiveScene({
    stages:[{
      id:"stage-1",
      image:"https://example.test/legacy-background.png",
    }],
  })

  assert.equal(scene.stages[0].fit, "cover")
})

test("an active action frame stays open and can be positioned directly on the author canvas", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].hotspots.push({
    id:"hotspot-1",
    label:"反馈",
    x:35,
    y:35,
    width:30,
    height:30,
    shape:"ellipse",
    trigger:"tap",
    actionFrame:{
      enabled:true,
      source:"https://example.test/reaction.png",
      type:"image",
      fit:"contain",
      durationMs:300,
      gifDurationMs:0,
      fileName:"reaction.png",
      transform:{ scale:1, x:0, y:0 },
    },
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })
  editor.overlay.querySelector(".interactive-scene-hotspot-list button").click()
  editor.overlay.querySelector("[data-action-frame-preview]").click()

  const root = editor.overlay.querySelector(".interactive-scene")
  root.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:200 })
  const actionImage = editor.overlay.querySelector(".interactive-scene-action-image")
  actionImage.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
    bubbles:true,
    clientX:50,
    clientY:100,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
    bubbles:true,
    clientX:60,
    clientY:120,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", {
    bubbles:true,
    clientX:60,
    clientY:120,
  }))

  assert.deepEqual(editor.scene.stages[0].hotspots[0].actionFrame.transform, {
    scale:1,
    x:10,
    y:10,
  })

  await new Promise(resolve => dom.window.setTimeout(resolve, 340))
  assert.equal(root.dataset.actionFrameActive, "true")

  actionImage.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
    bubbles:true,
    clientX:60,
    clientY:120,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointermove", {
    bubbles:true,
    clientX:1000,
    clientY:-1000,
  }))
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("pointerup", {
    bubbles:true,
    clientX:1000,
    clientY:-1000,
  }))
  assert.deepEqual(editor.scene.stages[0].hotspots[0].actionFrame.transform, {
    scale:1,
    x:200,
    y:-200,
  })
  editor.close()
  dom.window.close()
})

test("closing the editor cancels an unfinished action-frame drag", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].hotspots.push({
    id:"hotspot-1",
    label:"反馈",
    x:35,
    y:35,
    width:30,
    height:30,
    shape:"ellipse",
    trigger:"tap",
    actionFrame:{
      enabled:true,
      source:"https://example.test/reaction.png",
      type:"image",
      fit:"contain",
      transform:{ scale:1, x:0, y:0 },
    },
  })
  const editor = openInteractiveSceneEditor({ scene, documentObject:dom.window.document })
  editor.overlay.querySelector(".interactive-scene-hotspot-list button").click()
  editor.overlay.querySelector("[data-action-frame-preview]").click()
  const root = editor.overlay.querySelector(".interactive-scene")
  root.getBoundingClientRect = () => ({ left:0, top:0, width:100, height:100 })
  editor.overlay.querySelector(".interactive-scene-action-image").dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles:true, clientX:20, clientY:20 }),
  )
  dom.window.document.dispatchEvent(
    new dom.window.MouseEvent("pointermove", { bubbles:true, clientX:60, clientY:60 }),
  )

  editor.close()
  dom.window.document.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles:true, clientX:60, clientY:60 }),
  )

  assert.deepEqual(editor.scene.stages[0].hotspots[0].actionFrame.transform, {
    scale:1,
    x:0,
    y:0,
  })
  dom.window.close()
})

test("device frames change only the preview viewport", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const scene = createInteractiveScene({ id:"scene-1", stageId:"stage-1" })
  scene.stages[0].mediaTransform = { scale:1.25, x:12, y:-8 }
  scene.stages[0].characterTransform = { scale:.8, x:-5, y:17 }
  scene.stages[0].hotspots.push({
    id:"hotspot-1",
    label:"保持不动",
    x:14,
    y:23,
    width:31,
    height:19,
    shape:"rect",
    actionFrame:{
      enabled:true,
      source:"https://example.test/action.png",
      transform:{ scale:1.4, x:8, y:-9 },
    },
  })
  const editor = openInteractiveSceneEditor({
    scene,
    documentObject:dom.window.document,
  })
  const preview = editor.overlay.querySelector(".interactive-scene-preview")
  assert.equal(preview.parentElement.className, "interactive-scene-preview-viewport")
  const artboard = editor.overlay.querySelector(".interactive-scene")
  const before = structuredClone(editor.scene)

  for (const [device, aspect] of [
    ["phone", "9 / 16"],
    ["landscape", "16 / 9"],
    ["desktop", "16 / 10"],
  ]) {
    editor.overlay.querySelector(`[data-preview-device='${device}']`).click()
    assert.equal(preview.dataset.device, device)
    assert.equal(preview.style.getPropertyValue("--interactive-preview-aspect"), aspect)
    const numericRatio = device === "phone" ? 9 / 16 : device === "landscape" ? 16 / 9 : 16 / 10
    assert.equal(Number(preview.style.getPropertyValue("--interactive-preview-ratio")), numericRatio)
    assert.equal(Number(preview.style.getPropertyValue("--interactive-preview-inverse-ratio")), 1 / numericRatio)
    assert.equal(
      Array.from(editor.overlay.querySelectorAll("[data-preview-device]"))
        .filter(control => control.getAttribute("aria-pressed") === "true").length,
      1,
    )
    assert.strictEqual(editor.overlay.querySelector(".interactive-scene"), artboard)
    assert.deepEqual(editor.scene, before)
  }

  editor.close()
  dom.window.close()
})

test("the picture inspector gives concrete background and character preparation guidance", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const editor = openInteractiveSceneEditor({
    scene:createInteractiveScene({ id:"scene-1", stageId:"stage-1" }),
    documentObject:dom.window.document,
  })
  const visualCopy = editor.overlay.querySelector("[data-inspector-body='visual']").textContent

  assert.match(visualCopy, /背景图.*逻辑画布.*同一比例/)
  assert.match(visualCopy, /透明立绘.*透明边距/)
  assert.match(visualCopy, /新画面.*完整显示/)

  editor.close()
  dom.window.close()
})
