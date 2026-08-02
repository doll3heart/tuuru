import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { createEditorChapterDragController } from "../js/editor-chapter-drag.js"

function createHarness({ pointerCapture = true } = {}) {
  const dom = new JSDOM(`<!doctype html><div id="root">
    <section class="wt-chapter" data-chapter-id="chapter-a"><div class="wt-chapter-title"><button class="wt-chapter-drag-handle" type="button">A</button><span class="body">A</span></div></section>
    <section class="wt-chapter" data-chapter-id="chapter-b"><div class="wt-chapter-title"><button class="wt-chapter-drag-handle" type="button">B</button><span class="body">B</span></div></section>
    <section class="wt-chapter" data-chapter-id="chapter-c"><div class="wt-chapter-title"><button class="wt-chapter-drag-handle" type="button">C</button><span class="body">C</span></div></section>
  </div>`)
  const { document } = dom.window
  const root = document.getElementById("root")
  const rows = [...root.querySelectorAll(".wt-chapter")]
  const handles = [...root.querySelectorAll(".wt-chapter-drag-handle")]
  const bodies = [...root.querySelectorAll(".body")]
  rows.forEach((row, index) => {
    row.getBoundingClientRect = () => ({ top: index * 100, bottom: index * 100 + 80 })
  })
  document.elementFromPoint = () => rows[1]
  if (pointerCapture) {
    handles.forEach(handle => {
      handle.captured = null
      handle.setPointerCapture = pointerId => { handle.captured = pointerId }
      handle.hasPointerCapture = pointerId => handle.captured === pointerId
      handle.releasePointerCapture = pointerId => {
        if (handle.captured === pointerId) handle.captured = null
      }
    })
  }

  const commits = []
  const controller = createEditorChapterDragController({
    root,
    threshold: 6,
    onCommit(payload) { commits.push(payload) },
  })

  function pointer(type, target, options = {}) {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      pointerId: { value: options.pointerId ?? 1 },
      clientX: { value: options.clientX ?? 10 },
      clientY: { value: options.clientY ?? 10 },
      button: { value: options.button ?? 0 },
      isPrimary: { value: options.isPrimary ?? true },
    })
    target.dispatchEvent(event)
    return event
  }

  function key(target, keyValue, options = {}) {
    const event = new dom.window.KeyboardEvent("keydown", {
      key: keyValue,
      altKey: options.altKey ?? false,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(event)
    return event
  }

  return { dom, document, root, rows, handles, bodies, commits, controller, pointer, key }
}

test("starts only from a chapter handle and ignores movement below the threshold", () => {
  const harness = createHarness()
  try {
    harness.pointer("pointerdown", harness.bodies[0], { clientY: 20 })
    harness.pointer("pointermove", harness.document, { clientY: 120 })
    harness.pointer("pointerup", harness.document, { clientY: 120 })
    assert.deepEqual(harness.commits, [])

    harness.pointer("pointerdown", harness.handles[0], { pointerId: 2, clientY: 20 })
    harness.pointer("pointermove", harness.document, { pointerId: 2, clientY: 24 })
    harness.pointer("pointerup", harness.document, { pointerId: 2, clientY: 24 })
    assert.deepEqual(harness.commits, [])
    assert.equal(harness.rows[0].classList.contains("dragging"), false)
  } finally {
    harness.controller.destroy()
  }
})

test("resolves before and after from the destination midpoint and commits once", () => {
  const harness = createHarness()
  try {
    harness.pointer("pointerdown", harness.handles[0], { clientY: 20 })
    const move = harness.pointer("pointermove", harness.document, { clientY: 110 })
    assert.equal(move.defaultPrevented, true)
    assert.equal(harness.rows[0].classList.contains("dragging"), true)
    assert.equal(harness.rows[1].classList.contains("drop-before"), true)

    harness.pointer("pointerup", harness.document, { clientY: 110 })
    harness.pointer("pointerup", harness.document, { clientY: 110 })
    assert.deepEqual(harness.commits, [{
      draggedId: "chapter-a",
      targetId: "chapter-b",
      placement: "before",
      inputMode: "pointer",
    }])
    assert.equal(harness.rows[0].classList.contains("dragging"), false)
    assert.equal(harness.rows[1].classList.contains("drop-before"), false)

    harness.document.elementFromPoint = () => harness.rows[2]
    harness.pointer("pointerdown", harness.handles[0], { pointerId: 2, clientY: 20 })
    harness.pointer("pointerup", harness.document, { pointerId: 2, clientY: 270 })
    assert.deepEqual(harness.commits[1], {
      draggedId: "chapter-a",
      targetId: "chapter-c",
      placement: "after",
      inputMode: "pointer",
    })
  } finally {
    harness.controller.destroy()
  }
})

test("cancels on Escape, pointer cancellation, blur, and reset", () => {
  const harness = createHarness({ pointerCapture: false })
  try {
    const cancelWith = action => {
      harness.pointer("pointerdown", harness.handles[0], { pointerId: action.id, clientY: 20 })
      harness.pointer("pointermove", harness.document, { pointerId: action.id, clientY: 110 })
      action.run()
      assert.equal(harness.rows[0].classList.contains("dragging"), false)
      assert.equal(harness.rows[1].classList.contains("drop-before"), false)
    }

    cancelWith({ id: 3, run: () => harness.key(harness.document, "Escape") })
    cancelWith({ id: 4, run: () => harness.pointer("pointercancel", harness.document, { pointerId: 4 }) })
    cancelWith({ id: 5, run: () => harness.dom.window.dispatchEvent(new harness.dom.window.Event("blur")) })
    cancelWith({ id: 6, run: () => harness.controller.reset() })
    assert.deepEqual(harness.commits, [])
  } finally {
    harness.controller.destroy()
  }
})

test("Alt+Arrow keys expose keyboard reordering and respect list boundaries", () => {
  const harness = createHarness()
  try {
    const firstUp = harness.key(harness.handles[0], "ArrowUp", { altKey: true })
    const middleUp = harness.key(harness.handles[1], "ArrowUp", { altKey: true })
    const middleDown = harness.key(harness.handles[1], "ArrowDown", { altKey: true })
    const lastDown = harness.key(harness.handles[2], "ArrowDown", { altKey: true })
    harness.key(harness.handles[1], "ArrowUp")

    assert.equal(firstUp.defaultPrevented, true)
    assert.equal(middleUp.defaultPrevented, true)
    assert.equal(middleDown.defaultPrevented, true)
    assert.equal(lastDown.defaultPrevented, true)
    assert.deepEqual(harness.commits, [
      {
        draggedId: "chapter-b",
        targetId: "chapter-a",
        placement: "before",
        inputMode: "keyboard",
      },
      {
        draggedId: "chapter-b",
        targetId: "chapter-c",
        placement: "after",
        inputMode: "keyboard",
      },
    ])
  } finally {
    harness.controller.destroy()
  }
})
