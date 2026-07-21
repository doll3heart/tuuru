import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { createEditorSplitPaneController, outlineWidthFromPointer, readEditorSplitPreference } from "../js/editor-split-pane.js"

test("outline width follows the pointer from the shell right edge", () => {
  assert.equal(outlineWidthFromPointer({left:0, right:1024, width:1024}, 744), 280)
  assert.equal(outlineWidthFromPointer({left:0, right:1024, width:1024}, 1010), 14)
})

test("stored split preference is bounded and defaults safely", () => {
  assert.deepEqual(readEditorSplitPreference({getItem:() => JSON.stringify({width:360, collapsed:true})}), {width:360, collapsed:true})
  assert.deepEqual(readEditorSplitPreference({getItem:() => "broken"}), {width:280, collapsed:false})
})

test("dragging to the edge collapses the outline and reopening uses an overlay", () => {
  const dom = new JSDOM(`<!doctype html><body><div class="editor-body-area" style="--editor-outline-width:280px"><div data-editor-splitter tabindex="0"></div><aside class="world-tree"></aside><button data-editor-outline-reopen></button></div></body>`, {pretendToBeVisual:true})
  const shell = dom.window.document.querySelector(".editor-body-area")
  shell.getBoundingClientRect = () => ({left:0, right:1024, width:1024})
  const writes = []
  const controller = createEditorSplitPaneController(dom.window.document, {getItem:() => null, setItem:(_key,value) => writes.push(JSON.parse(value))})

  controller.resize(shell, 20)
  assert.equal(shell.dataset.outlineCollapsed, "true")
  assert.equal(writes.at(-1).collapsed, true)
  controller.openOverlay(shell)
  assert.equal(shell.dataset.outlineOverlay, "true")
  controller.resize(shell, 320)
  assert.equal(shell.dataset.outlineCollapsed, undefined)
  assert.equal(shell.dataset.outlineOverlay, undefined)
  assert.equal(shell.style.getPropertyValue("--editor-outline-width"), "320px")
})

test("separator arrow keys resize and End collapses without pointer-only controls", () => {
  const dom = new JSDOM(`<!doctype html><body><div class="editor-body-area" style="--editor-outline-width:280px"><div data-editor-splitter tabindex="0"></div></div></body>`)
  const shell = dom.window.document.querySelector(".editor-body-area")
  const separator = shell.querySelector("[data-editor-splitter]")
  createEditorSplitPaneController(dom.window.document, {getItem:() => null, setItem() {}})
  separator.dispatchEvent(new dom.window.KeyboardEvent("keydown", {key:"ArrowLeft", bubbles:true}))
  assert.equal(shell.style.getPropertyValue("--editor-outline-width"), "296px")
  separator.dispatchEvent(new dom.window.KeyboardEvent("keydown", {key:"End", bubbles:true}))
  assert.equal(shell.dataset.outlineCollapsed, "true")
})
