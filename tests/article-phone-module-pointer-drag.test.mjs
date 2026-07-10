import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

import {
  PHONE_MODULE_DRAG_PHASE,
  createEditorPhoneModuleDragController,
  createPhoneModuleDragLifecycle,
} from "../js/editor-phone-module-drag.js"

test("phone module drag lifecycle commits before returning to idle", () => {
  const transitions = []
  const lifecycle = createPhoneModuleDragLifecycle({
    threshold: 4,
    onTransition(previous, next, state) {
      transitions.push([previous, next, state.pointerId])
    },
  })

  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  assert.equal(lifecycle.begin({ pointerId: 7, isPrimary: true, button: 0, clientX: 10, clientY: 20 }), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  const belowThreshold = lifecycle.move({ pointerId: 7, clientX: 13, clientY: 23 })
  assert.equal(belowThreshold.accepted, true)
  assert.equal(belowThreshold.started, false)
  assert.equal(belowThreshold.dragging, false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  const started = lifecycle.move({ pointerId: 7, clientX: 14, clientY: 23 })
  assert.equal(started.accepted, true)
  assert.equal(started.started, true)
  assert.equal(started.dragging, true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.DRAGGING)

  const finished = lifecycle.finish({ pointerId: 7, clientX: 18, clientY: 25 })
  assert.equal(finished.accepted, true)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.deepEqual(lifecycle.current, {
    phase: PHONE_MODULE_DRAG_PHASE.COMMITTED,
    pointerId: 7,
    startX: 10,
    startY: 20,
    lastX: 18,
    lastY: 25,
  })

  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  assert.deepEqual(transitions, [
    [PHONE_MODULE_DRAG_PHASE.IDLE, PHONE_MODULE_DRAG_PHASE.PENDING, 7],
    [PHONE_MODULE_DRAG_PHASE.PENDING, PHONE_MODULE_DRAG_PHASE.DRAGGING, 7],
    [PHONE_MODULE_DRAG_PHASE.DRAGGING, PHONE_MODULE_DRAG_PHASE.COMMITTED, 7],
    [PHONE_MODULE_DRAG_PHASE.COMMITTED, PHONE_MODULE_DRAG_PHASE.IDLE, null],
  ])
})

test("pointer-up consumes its final coordinates before deciding whether to drag", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 11, isPrimary: true, button: 0, clientX: 2, clientY: 2 })
  const finished = lifecycle.finish({ pointerId: 11, clientX: 6, clientY: 2 })

  assert.equal(finished.accepted, true)
  assert.equal(finished.started, true)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.COMMITTED)
})

test("tap and below-threshold movement cancel without becoming a drag", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 3, isPrimary: true, button: 0, clientX: 8, clientY: 9 })
  lifecycle.move({ pointerId: 3, clientX: 11, clientY: 12 })
  const finished = lifecycle.finish({ pointerId: 3, clientX: 11, clientY: 12 })

  assert.equal(finished.accepted, true)
  assert.equal(finished.started, false)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
})

test("wrong pointers and non-primary starts cannot mutate the active lifecycle", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  assert.equal(lifecycle.begin({ pointerId: 1, isPrimary: false, button: 0, clientX: 0, clientY: 0 }), false)
  assert.equal(lifecycle.begin({ pointerId: 1, isPrimary: true, button: 2, clientX: 0, clientY: 0 }), false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)

  assert.equal(lifecycle.begin({ pointerId: 5, isPrimary: true, button: 0, clientX: 1, clientY: 1 }), true)
  assert.equal(lifecycle.begin({ pointerId: 6, isPrimary: true, button: 0, clientX: 1, clientY: 1 }), false)
  assert.equal(lifecycle.move({ pointerId: 6, clientX: 20, clientY: 20 }).accepted, false)
  assert.equal(lifecycle.cancel(6), false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  assert.equal(lifecycle.cancel(5), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.finish({ pointerId: 5, clientX: 20, clientY: 20 }).accepted, false)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
})

test("blur-style cancellation can terminate the current pointer without its id", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 21, isPrimary: true, button: 0, clientX: 0, clientY: 0 })
  lifecycle.move({ pointerId: 21, clientX: 8, clientY: 0 })

  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.DRAGGING)
  assert.equal(lifecycle.cancel(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.current.pointerId, null)
})

test("terminal operations are idempotent and cancellation snapshots stay complete", () => {
  const transitions = []
  const lifecycle = createPhoneModuleDragLifecycle({
    threshold: 4,
    onTransition(previous, next, state) {
      transitions.push({ previous, next, state })
    },
  })

  lifecycle.begin({ pointerId: 31, isPrimary: true, button: 0, clientX: 9, clientY: 9 })
  lifecycle.move({ pointerId: 31, clientX: 9, clientY: 5 })
  assert.equal(lifecycle.cancel(31), true)
  assert.equal(lifecycle.cancel(31), false)
  assert.equal(lifecycle.finish({ pointerId: 31, clientX: 0, clientY: 0 }).accepted, false)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.settle(), false)

  assert.deepEqual(transitions, [
    {
      previous: PHONE_MODULE_DRAG_PHASE.IDLE,
      next: PHONE_MODULE_DRAG_PHASE.PENDING,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.PENDING,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 9,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.PENDING,
      next: PHONE_MODULE_DRAG_PHASE.DRAGGING,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.DRAGGING,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 5,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.DRAGGING,
      next: PHONE_MODULE_DRAG_PHASE.CANCELLED,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.CANCELLED,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 5,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.CANCELLED,
      next: PHONE_MODULE_DRAG_PHASE.IDLE,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.IDLE,
        pointerId: null,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
      },
    },
  ])
})

function pointerEvent(windowObject, type, {
  pointerId = 1,
  isPrimary = true,
  clientX = 0,
  clientY = 0,
  button = 0,
  buttons = type === "pointerup" ? 0 : 1,
} = {}) {
  const event = new windowObject.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button,
    buttons,
  })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: isPrimary },
    pointerType: { value: "touch" },
  })
  return event
}

function createControllerHarness({ captureMode = "success", dropMode = "after-b" } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="editor" class="content-editable" data-n="node-a" contenteditable="true">
      <span data-text="before">Before</span>
      <div class="pm-inline-card" data-pm-id="module-a" data-pm-type="memo"><span>A</span><button type="button" class="pm-card-hamburger">Menu A</button></div>
      <span data-text="middle">Middle</span>
      <div class="pm-inline-card" data-pm-id="module-b" data-pm-type="memo"><span>B</span><button type="button" class="pm-card-hamburger">Menu B</button></div>
      <span data-text="after">After</span>
    </div>
  </body></html>`, { url: "http://localhost/" })
  const documentObject = dom.window.document
  const windowObject = dom.window
  const editable = documentObject.getElementById("editor")
  const cardA = editable.querySelector('[data-pm-id="module-a"]')
  const cardB = editable.querySelector('[data-pm-id="module-b"]')
  const originalHtml = editable.innerHTML
  const commits = []
  const events = []
  const temporaryListeners = {
    added: { pointermove: 0, pointerup: 0, pointercancel: 0 },
    removed: { pointermove: 0, pointerup: 0, pointercancel: 0 },
  }
  let currentWorkId = "work-a"

  const nativeAdd = documentObject.addEventListener.bind(documentObject)
  const nativeRemove = documentObject.removeEventListener.bind(documentObject)
  documentObject.addEventListener = function(type, listener, options) {
    if (Object.hasOwn(temporaryListeners.added, type)) temporaryListeners.added[type] += 1
    return nativeAdd(type, listener, options)
  }
  documentObject.removeEventListener = function(type, listener, options) {
    if (Object.hasOwn(temporaryListeners.removed, type)) temporaryListeners.removed[type] += 1
    return nativeRemove(type, listener, options)
  }

  const lifecycle = createPhoneModuleDragLifecycle({
    threshold: 4,
    onTransition(previous, next) {
      events.push(`phase:${previous}->${next}`)
    },
  })

  function makeRange() {
    const range = documentObject.createRange()
    if (dropMode === "after-b") {
      range.setStartAfter(cardB)
    } else if (dropMode === "before-a") {
      const marker = editable.querySelector('[data-text="before"]')
      range.setStartAfter(marker)
    } else {
      range.setStart(documentObject.body, 0)
    }
    range.collapse(true)
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({ left: 20, top: 30, width: 0, height: 18 }),
    })
    return range
  }

  const controller = createEditorPhoneModuleDragController({
    documentObject,
    windowObject,
    lifecycle,
    getWorkId: () => currentWorkId,
    resolveDropRange: makeRange,
    requestFrame: callback => { callback(); return 1 },
    cancelFrame: () => {},
    onCommit(payload) {
      events.push("commit")
      commits.push(payload)
    },
  })

  const captures = new Map()
  for (const card of [cardA, cardB]) {
    let capturedPointer = null
    if (captureMode !== "missing") {
      card.setPointerCapture = pointerId => {
        events.push(`capture:${pointerId}`)
        if (captureMode === "throws") throw new Error("capture unavailable")
        if (captureMode === "success") capturedPointer = pointerId
      }
      card.hasPointerCapture = pointerId => captureMode === "success" && capturedPointer === pointerId
      card.releasePointerCapture = pointerId => {
        if (capturedPointer !== pointerId) return
        events.push(`release:${lifecycle.phase}`)
        capturedPointer = null
        card.dispatchEvent(pointerEvent(windowObject, "lostpointercapture", { pointerId }))
      }
    }
    captures.set(card, () => capturedPointer)
  }

  return {
    dom,
    windowObject,
    documentObject,
    editable,
    cardA,
    cardB,
    originalHtml,
    commits,
    events,
    temporaryListeners,
    lifecycle,
    controller,
    captures,
    setWorkId(value) { currentWorkId = value },
    dispatch(target, type, options) {
      const event = pointerEvent(windowObject, type, options)
      target.dispatchEvent(event)
      return event
    },
    cleanup() {
      controller.dispose()
      dom.window.close()
    },
  }
}

test("captured module drag commits once before release and suppresses only its card", () => {
  const harness = createControllerHarness()
  const { cardA, cardB, editable, controller, lifecycle } = harness

  try {
    harness.dispatch(cardA, "pointerdown", { pointerId: 9, clientX: 10, clientY: 10 })
    harness.setWorkId("work-b")
    editable.dataset.n = "node-b"
    harness.dispatch(cardA, "pointermove", { pointerId: 9, clientX: 30, clientY: 10 })

    assert.equal(cardA.parentElement, editable)
    assert.equal(harness.captures.get(cardA)(), 9)
    assert.equal(cardA.classList.contains("pm-card-dragging"), true)
    const preview = harness.documentObject.querySelector(".pm-card-drag-preview")
    assert.ok(preview)
    assert.equal(preview.parentElement, harness.documentObject.body)
    assert.equal(preview.getAttribute("aria-hidden"), "true")
    assert.equal(preview.hasAttribute("data-pm-id"), false)
    assert.equal(preview.querySelector("[data-pm-id]"), null)

    harness.dispatch(cardA, "pointerup", { pointerId: 9, clientX: 40, clientY: 10 })

    assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
    assert.deepEqual([...editable.querySelectorAll(".pm-inline-card")].map(card => card.dataset.pmId), ["module-b", "module-a"])
    assert.equal(harness.commits.length, 1)
    assert.equal(harness.commits[0].workId, "work-a")
    assert.equal(harness.commits[0].nodeId, "node-a")
    assert.equal(harness.commits[0].editable, editable)
    assert.equal(harness.commits[0].content, editable.innerHTML)
    assert.equal(harness.events.includes("release:committed"), true)
    assert.ok(harness.events.indexOf("phase:dragging->committed") < harness.events.indexOf("release:committed"))
    assert.equal(cardA.classList.contains("pm-card-dragging"), false)
    assert.equal(cardA.getAttribute("style"), null)
    assert.equal(harness.documentObject.querySelector(".pm-card-drag-preview"), null)
    assert.equal([...editable.childNodes].some(node => node.nodeType === 8), false)
    assert.equal(harness.documentObject.querySelector(".pm-drop-indicator")?.style.display, "none")

    assert.equal(controller.consumeClick(cardB, { detail: 1 }), false)
    assert.equal(controller.consumeClick(cardA, { detail: 1 }), true)
    assert.equal(controller.consumeClick(cardA, { detail: 1 }), false)

    harness.dispatch(cardA, "lostpointercapture", { pointerId: 9 })
    harness.dispatch(cardA, "pointerup", { pointerId: 9, clientX: 50, clientY: 10 })
    assert.equal(harness.commits.length, 1)
  } finally {
    harness.cleanup()
  }
})

test("module pointer-up can cross the threshold and commit on its final coordinates", () => {
  const harness = createControllerHarness()
  try {
    harness.dispatch(harness.cardA, "pointerdown", { pointerId: 10, clientX: 10, clientY: 10 })
    harness.dispatch(harness.cardA, "pointerup", { pointerId: 10, clientX: 20, clientY: 10 })

    assert.equal(harness.commits.length, 1)
    assert.deepEqual(
      [...harness.editable.querySelectorAll(".pm-inline-card")].map(card => card.dataset.pmId),
      ["module-b", "module-a"],
    )
    assert.equal(harness.events.includes("release:committed"), true)
    assert.equal(harness.lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  } finally {
    harness.cleanup()
  }
})

test("tap, below-threshold movement, and hamburger gestures never reorder", () => {
  const harness = createControllerHarness()
  const { cardA, editable, lifecycle, controller } = harness

  try {
    const down = harness.dispatch(cardA, "pointerdown", { pointerId: 2, clientX: 10, clientY: 10 })
    harness.dispatch(cardA, "pointermove", { pointerId: 2, clientX: 13, clientY: 13 })
    harness.dispatch(cardA, "pointerup", { pointerId: 2, clientX: 13, clientY: 13 })

    assert.equal(down.defaultPrevented, false)
    assert.equal(editable.innerHTML, harness.originalHtml)
    assert.equal(harness.commits.length, 0)
    assert.equal(controller.consumeClick(cardA, { detail: 1 }), false)
    assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)

    const hamburger = cardA.querySelector(".pm-card-hamburger")
    const menuDown = harness.dispatch(hamburger, "pointerdown", { pointerId: 3, clientX: 10, clientY: 10 })
    harness.dispatch(hamburger, "pointermove", { pointerId: 3, clientX: 30, clientY: 10 })
    harness.dispatch(hamburger, "pointerup", { pointerId: 3, clientX: 30, clientY: 10 })
    assert.equal(menuDown.defaultPrevented, false)
    assert.equal(editable.innerHTML, harness.originalHtml)
    assert.equal(harness.commits.length, 0)
    assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  } finally {
    harness.cleanup()
  }
})

test("captured cancellation paths restore the original DOM without writes", async t => {
  const cases = ["pointercancel", "lostpointercapture", "blur", "refresh"]

  for (const cancellation of cases) {
    await t.test(cancellation, () => {
      const harness = createControllerHarness()
      const { cardA, editable, lifecycle } = harness
      try {
        harness.dispatch(cardA, "pointerdown", { pointerId: 12, clientX: 10, clientY: 10 })
        harness.dispatch(cardA, "pointermove", { pointerId: 12, clientX: 30, clientY: 10 })

        if (cancellation === "pointercancel") {
          harness.dispatch(cardA, "pointercancel", { pointerId: 12, clientX: 30, clientY: 10 })
        } else if (cancellation === "lostpointercapture") {
          harness.dispatch(cardA, "lostpointercapture", { pointerId: 12, clientX: 30, clientY: 10 })
        } else if (cancellation === "blur") {
          harness.windowObject.dispatchEvent(new harness.windowObject.Event("blur"))
        } else {
          harness.controller.reset("refresh")
        }

        assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
        assert.equal(cardA.parentElement, editable)
        assert.equal(editable.innerHTML, harness.originalHtml)
        assert.equal(harness.commits.length, 0)
        assert.equal(cardA.classList.contains("pm-card-dragging"), false)
        assert.equal(cardA.getAttribute("style"), null)
        assert.equal(harness.documentObject.querySelector(".pm-card-drag-preview"), null)
        assert.equal(harness.documentObject.querySelector(".pm-drop-indicator")?.style.display, "none")

        harness.dispatch(cardA, "pointerup", { pointerId: 12, clientX: 50, clientY: 10 })
        assert.equal(harness.commits.length, 0)
      } finally {
        harness.cleanup()
      }
    })
  }
})

test("capture failures use temporary document listeners and clean every terminal path", async t => {
  for (const captureMode of ["missing", "throws", "unconfirmed"]) {
    await t.test(captureMode, () => {
      const harness = createControllerHarness({ captureMode })
      try {
        harness.dispatch(harness.cardA, "pointerdown", { pointerId: 15, clientX: 10, clientY: 10 })
        harness.dispatch(harness.documentObject, "pointermove", { pointerId: 15, clientX: 30, clientY: 10 })
        harness.dispatch(harness.documentObject, "pointerup", { pointerId: 15, clientX: 40, clientY: 10 })

        assert.equal(harness.commits.length, 1)
        assert.deepEqual(harness.temporaryListeners.added, { pointermove: 1, pointerup: 1, pointercancel: 1 })
        assert.deepEqual(harness.temporaryListeners.removed, { pointermove: 1, pointerup: 1, pointercancel: 1 })
        harness.dispatch(harness.documentObject, "pointerup", { pointerId: 15, clientX: 50, clientY: 10 })
        assert.equal(harness.commits.length, 1)
      } finally {
        harness.cleanup()
      }
    })
  }

  await t.test("fallback cancellation", () => {
    const harness = createControllerHarness({ captureMode: "missing" })
    try {
      harness.dispatch(harness.cardA, "pointerdown", { pointerId: 16, clientX: 10, clientY: 10 })
      harness.dispatch(harness.documentObject, "pointermove", { pointerId: 16, clientX: 30, clientY: 10 })
      harness.dispatch(harness.documentObject, "pointercancel", { pointerId: 16, clientX: 30, clientY: 10 })

      assert.equal(harness.editable.innerHTML, harness.originalHtml)
      assert.equal(harness.commits.length, 0)
      assert.deepEqual(harness.temporaryListeners.added, { pointermove: 1, pointerup: 1, pointercancel: 1 })
      assert.deepEqual(harness.temporaryListeners.removed, { pointermove: 1, pointerup: 1, pointercancel: 1 })
    } finally {
      harness.cleanup()
    }
  })
})

test("invalid drops roll back without writes and click suppression is consumed safely", () => {
  const harness = createControllerHarness({ dropMode: "invalid" })
  const { cardA, controller, editable } = harness

  try {
    harness.dispatch(cardA, "pointerdown", { pointerId: 18, clientX: 10, clientY: 10 })
    harness.dispatch(cardA, "pointermove", { pointerId: 18, clientX: 30, clientY: 10 })
    harness.dispatch(cardA, "pointerup", { pointerId: 18, clientX: 40, clientY: 10 })

    assert.equal(editable.innerHTML, harness.originalHtml)
    assert.equal(harness.commits.length, 0)
    assert.equal(controller.consumeClick(cardA, { detail: 0 }), false)
    assert.equal(controller.consumeClick(cardA, { detail: 1 }), false)

    harness.dispatch(cardA, "pointerdown", { pointerId: 19, clientX: 10, clientY: 10 })
    harness.dispatch(cardA, "pointermove", { pointerId: 19, clientX: 30, clientY: 10 })
    harness.dispatch(cardA, "pointerup", { pointerId: 19, clientX: 40, clientY: 10 })
    harness.dispatch(cardA, "pointerdown", { pointerId: 20, clientX: 10, clientY: 10 })
    harness.dispatch(cardA, "pointerup", { pointerId: 20, clientX: 10, clientY: 10 })
    assert.equal(controller.consumeClick(cardA, { detail: 1 }), false)
  } finally {
    harness.cleanup()
  }
})

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

test("article phone module arrangement is wired only through Pointer Events", () => {
  const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")
  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const dragStart = editorSource.indexOf("// ====== Phone Module Card Pointer Events ======")
  const dragEnd = editorSource.indexOf("// Auto-save content on input", dragStart)
  const dragSource = dragStart >= 0 && dragEnd > dragStart ? editorSource.slice(dragStart, dragEnd) : ""
  const cardRules = ruleBodiesFor(cssWithoutComments, ".pm-inline-card")
  const editableRules = ruleBodiesFor(cssWithoutComments, ".editor-content .content-editable")

  assert.match(editorSource, /createEditorPhoneModuleDragController/)
  assert.match(editorSource, /_phoneModuleDragController\?\.reset\(["']refresh["']\)/)
  assert.match(editorSource, /consumeClick\(phoneModuleCard,\s*e\)/)
  assert.ok(dragSource)
  assert.doesNotMatch(dragSource, /addEventListener\(['"]mousedown['"]/)
  assert.doesNotMatch(dragSource, /addEventListener\(['"]mousemove['"]/)
  assert.doesNotMatch(dragSource, /addEventListener\(['"]mouseup['"]/)
  assert.doesNotMatch(dragSource, /_pmDragState|_nodeId/)
  assert.match(dragSource, /updateNode\(workId,\s*nodeId,\s*\{content:\s*content\}\)/)
  assert.match(editorSource, /class="pm-card-hamburger"[^>]*type="button"[^>]*aria-label="编辑或删除手机模块"/)
  assert.match(cardRules, /touch-action\s*:\s*none/)
  assert.doesNotMatch(editableRules, /touch-action\s*:\s*none/)
  assert.match(css, /Phone module bounded touch targets[\s\S]*?\.pm-inline-card\s*\{[^}]*min-height\s*:\s*44px/)
  assert.match(css, /Phone module bounded touch targets[\s\S]*?\.pm-card-hamburger\s*\{[^}]*min-width\s*:\s*44px[^}]*min-height\s*:\s*44px/)
})

test("rendered article cards preserve tap, menu, drag, and write-count behavior", async t => {
  const card = (id, label) => `<div class="pm-inline-card" contenteditable="false" data-pm-id="${id}" data-pm-type="memo" draggable="false"><span class="pm-card-label">${label}</span><button class="pm-card-hamburger" data-a="pm-hamburger" data-pm-id="${id}" type="button" aria-label="编辑或删除手机模块">≡</button></div>`
  const work = {
    id: "module-drag-work",
    schemaVersion: 1,
    type: "article",
    title: "Module drag",
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [
      { id: "module-a", type: "memo", nodeId: "node-a", data: { memos: [{ id: "memo-a", title: "A", content: "A" }] } },
      { id: "module-b", type: "memo", nodeId: "node-a", data: { memos: [{ id: "memo-b", title: "B", content: "B" }] } },
    ],
    editorSettings: {
      fontFamily: "var(--font)", fontSize: 16, marginTop: 24, marginBottom: 24,
      marginLeft: 32, marginRight: 32, letterSpacing: 0, lineHeight: 1.9,
      indentFirstLine: false, customFonts: [],
    },
    nodes: [{
      id: "node-a",
      title: "Opening",
      content: `<p>Before</p>${card("module-a", "A")}<p>Middle</p>${card("module-b", "B")}<p>After</p>`,
      scene: "",
      chapterId: "",
      choices: [],
    }],
    startNode: "node-a",
  }
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/#/edit/module-drag-work",
  })
  const { window: integrationWindow } = dom
  const { document: integrationDocument } = integrationWindow

  globalThis.window = integrationWindow
  globalThis.document = integrationDocument
  globalThis.localStorage = integrationWindow.localStorage
  globalThis.location = integrationWindow.location
  globalThis.Element = integrationWindow.Element
  globalThis.HTMLElement = integrationWindow.HTMLElement
  globalThis.Node = integrationWindow.Node
  globalThis.Event = integrationWindow.Event
  globalThis.MouseEvent = integrationWindow.MouseEvent
  globalThis.MutationObserver = integrationWindow.MutationObserver
  globalThis.getComputedStyle = integrationWindow.getComputedStyle.bind(integrationWindow)
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.cancelAnimationFrame = () => {}
  globalThis.confirm = () => true
  globalThis.prompt = () => null
  globalThis.alert = () => {}
  integrationDocument.execCommand = () => true
  integrationWindow.matchMedia = query => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })

  localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
  const nativeSetItem = integrationWindow.Storage.prototype.setItem
  let databaseWrites = 0
  integrationWindow.Storage.prototype.setItem = function(key, value) {
    if (key === "tuuru_works") databaseWrites += 1
    return nativeSetItem.call(this, key, value)
  }
  t.after(() => {
    integrationWindow.Storage.prototype.setItem = nativeSetItem
    dom.window.close()
  })

  const { renderEditor } = await import("../js/pages/editor.js")
  const root = integrationDocument.getElementById("app")
  root.innerHTML = renderEditor(work.id)
  const editable = integrationDocument.getElementById("ce_node-a")
  const cardA = editable.querySelector('[data-pm-id="module-a"]')
  const cardB = editable.querySelector('[data-pm-id="module-b"]')

  for (const moduleCard of [cardA, cardB]) {
    let captured = null
    moduleCard.setPointerCapture = pointerId => { captured = pointerId }
    moduleCard.hasPointerCapture = pointerId => captured === pointerId
    moduleCard.releasePointerCapture = pointerId => {
      if (captured !== pointerId) return
      captured = null
      moduleCard.dispatchEvent(pointerEvent(integrationWindow, "lostpointercapture", { pointerId }))
    }
  }

  integrationDocument.caretRangeFromPoint = () => {
    const range = integrationDocument.createRange()
    range.setStartAfter(cardB)
    range.collapse(true)
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 10, width: 0, height: 18 }),
    })
    return range
  }

  cardB.dispatchEvent(pointerEvent(integrationWindow, "pointerdown", { pointerId: 40, clientX: 10, clientY: 10 }))
  cardB.dispatchEvent(pointerEvent(integrationWindow, "pointermove", { pointerId: 40, clientX: 13, clientY: 13 }))
  cardB.dispatchEvent(pointerEvent(integrationWindow, "pointerup", { pointerId: 40, clientX: 13, clientY: 13 }))
  assert.equal(databaseWrites, 0)
  cardB.dispatchEvent(new integrationWindow.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  assert.ok(integrationDocument.querySelector(".phone-app-modal-overlay"))
  integrationDocument.querySelector(".phone-app-modal-overlay").remove()

  cardA.dispatchEvent(pointerEvent(integrationWindow, "pointerdown", { pointerId: 41, clientX: 10, clientY: 10 }))
  cardA.dispatchEvent(pointerEvent(integrationWindow, "pointermove", { pointerId: 41, clientX: 30, clientY: 10 }))
  cardA.dispatchEvent(pointerEvent(integrationWindow, "pointerup", { pointerId: 41, clientX: 40, clientY: 10 }))

  assert.equal(databaseWrites, 1)
  assert.deepEqual([...editable.querySelectorAll(".pm-inline-card")].map(moduleCard => moduleCard.dataset.pmId), ["module-b", "module-a"])
  const storedContent = JSON.parse(localStorage.getItem("tuuru_works")).works[0].nodes[0].content
  assert.ok(storedContent.indexOf('data-pm-id="module-b"') < storedContent.indexOf('data-pm-id="module-a"'))

  cardA.dispatchEvent(new integrationWindow.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  assert.equal(integrationDocument.querySelector(".phone-app-modal-overlay"), null)

  cardB.querySelector(".pm-card-hamburger").dispatchEvent(new integrationWindow.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  assert.ok(integrationDocument.querySelector(".pm-context-menu"))
  assert.equal(integrationDocument.querySelector(".phone-app-modal-overlay"), null)
  integrationDocument.querySelector(".pm-context-menu").remove()

  cardA.dispatchEvent(new integrationWindow.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  assert.ok(integrationDocument.querySelector(".phone-app-modal-overlay"))
  assert.equal(databaseWrites, 1)
})
