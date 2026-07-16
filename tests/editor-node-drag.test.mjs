import test from "node:test"
import assert from "node:assert/strict"

import { createEditorNodeDragController } from "../js/editor-node-drag.js"

class FakeClassList {
  constructor(...tokens) {
    this.tokens = new Set(tokens)
  }

  add(...tokens) {
    tokens.forEach(token => this.tokens.add(token))
  }

  remove(...tokens) {
    tokens.forEach(token => this.tokens.delete(token))
  }

  contains(token) {
    return this.tokens.has(token)
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event) {
    event.currentTarget = this
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event)
    return !event.defaultPrevented
  }
}

class FakeElement extends FakeEventTarget {
  constructor({ classes = [], dataset = {}, rect = {} } = {}) {
    super()
    this.classList = new FakeClassList(...classes)
    this.dataset = { ...dataset }
    this.parentElement = null
    this.children = []
    this.ownerDocument = null
    this.rect = { top: 0, bottom: 0, left: 0, right: 0, ...rect }
    this.capturedPointerId = null
    this.captureCalls = []
    this.releaseCalls = []
  }

  appendChild(child) {
    child.parentElement = this
    child.ownerDocument = this.ownerDocument
    this.children.push(child)
    child.children.forEach(descendant => assignDocument(descendant, this.ownerDocument))
    return child
  }

  matches(selector) {
    if (selector === ".wt-node-drag-handle") return this.classList.contains("wt-node-drag-handle")
    if (selector === ".wt-node[data-node-id]") {
      return this.classList.contains("wt-node") && typeof this.dataset.nodeId === "string"
    }
    if (selector === "[data-node-drop-chapter][data-chapter-id]") {
      return Object.hasOwn(this.dataset, "nodeDropChapter") && typeof this.dataset.chapterId === "string"
    }
    if (selector === "[data-chapter-id]") return typeof this.dataset.chapterId === "string"
    return false
  }

  closest(selector) {
    let current = this
    while (current) {
      if (current.matches(selector)) return current
      current = current.parentElement
    }
    return null
  }

  contains(element) {
    let current = element
    while (current) {
      if (current === this) return true
      current = current.parentElement
    }
    return false
  }

  getBoundingClientRect() {
    return { ...this.rect }
  }

  setPointerCapture(pointerId) {
    this.captureCalls.push(pointerId)
    this.capturedPointerId = pointerId
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointerId === pointerId
  }

  releasePointerCapture(pointerId) {
    this.releaseCalls.push(pointerId)
    if (this.capturedPointerId === pointerId) this.capturedPointerId = null
  }
}

function assignDocument(element, documentObject) {
  element.ownerDocument = documentObject
  element.children.forEach(child => assignDocument(child, documentObject))
}

function pointerEvent(type, target, {
  pointerId = 1,
  clientX = 0,
  clientY = 0,
  isPrimary = true,
  button = 0,
} = {}) {
  return {
    type,
    target,
    pointerId,
    clientX,
    clientY,
    isPrimary,
    button,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true },
  }
}

function createHarness({ rootIsDocument = false, pointerCapture = true } = {}) {
  const windowObject = new FakeEventTarget()
  const root = new FakeElement()
  const documentObject = rootIsDocument ? root : {}
  documentObject.defaultView = windowObject
  documentObject.hit = null
  documentObject.elementFromPoint = function() { return this.hit }
  root.ownerDocument = documentObject

  const chapterA = root.appendChild(new FakeElement({
    dataset: { nodeDropChapter: "", chapterId: "chapter-a" },
  }))
  const nodeA = chapterA.appendChild(new FakeElement({
    classes: ["wt-node"],
    dataset: { nodeId: "node-a", chapterId: "chapter-a" },
    rect: { top: 10, bottom: 50 },
  }))
  const handleA = nodeA.appendChild(new FakeElement({ classes: ["wt-node-drag-handle"] }))
  const nodeBodyA = nodeA.appendChild(new FakeElement())

  const chapterB = root.appendChild(new FakeElement({
    dataset: { nodeDropChapter: "", chapterId: "chapter-b" },
  }))
  const nodeB = chapterB.appendChild(new FakeElement({
    classes: ["wt-node"],
    dataset: { nodeId: "node-b", chapterId: "chapter-b" },
    rect: { top: 100, bottom: 140 },
  }))
  const handleB = nodeB.appendChild(new FakeElement({ classes: ["wt-node-drag-handle"] }))
  const emptyChapter = root.appendChild(new FakeElement({
    dataset: { nodeDropChapter: "", chapterId: "chapter-empty" },
  }))
  assignDocument(root, documentObject)
  if (!pointerCapture) {
    handleA.setPointerCapture = undefined
    handleB.setPointerCapture = undefined
  }

  const commits = []
  const controller = createEditorNodeDragController({
    root,
    threshold: 6,
    onCommit(payload) { commits.push(payload) },
  })

  function emit(type, target, options) {
    const event = pointerEvent(type, target, options)
    root.dispatchEvent(event)
    return event
  }

  return {
    windowObject,
    documentObject,
    root,
    chapterA,
    nodeA,
    handleA,
    nodeBodyA,
    chapterB,
    nodeB,
    handleB,
    emptyChapter,
    commits,
    controller,
    emit,
  }
}

test("starts only from a node drag handle and ignores below-threshold movement", () => {
  const harness = createHarness()
  try {
    harness.emit("pointerdown", harness.nodeBodyA, { pointerId: 1, clientX: 10, clientY: 20 })
    harness.documentObject.hit = harness.nodeB
    harness.emit("pointermove", harness.nodeBodyA, { pointerId: 1, clientX: 30, clientY: 110 })
    harness.emit("pointerup", harness.nodeBodyA, { pointerId: 1, clientX: 30, clientY: 110 })

    assert.deepEqual(harness.handleA.captureCalls, [])
    assert.deepEqual(harness.commits, [])

    harness.emit("pointerdown", harness.handleA, { pointerId: 2, clientX: 10, clientY: 20 })
    harness.emit("pointermove", harness.handleA, { pointerId: 2, clientX: 14, clientY: 23 })
    harness.emit("pointerup", harness.handleA, { pointerId: 2, clientX: 14, clientY: 23 })

    assert.deepEqual(harness.handleA.captureCalls, [2])
    assert.deepEqual(harness.handleA.releaseCalls, [2])
    assert.deepEqual(harness.commits, [])
    assert.equal(harness.nodeA.classList.contains("dragging"), false)
    assert.equal(harness.nodeB.classList.contains("drop-before"), false)
  } finally {
    harness.controller.destroy()
  }
})

test("commits a before-node destination once and clears drag classes", () => {
  const harness = createHarness()
  try {
    harness.documentObject.hit = harness.nodeB
    harness.emit("pointerdown", harness.handleA, { pointerId: 3, clientX: 10, clientY: 20 })
    const move = harness.emit("pointermove", harness.handleA, { pointerId: 3, clientX: 30, clientY: 110 })

    assert.equal(move.defaultPrevented, true)
    assert.equal(harness.nodeA.classList.contains("dragging"), true)
    assert.equal(harness.nodeB.classList.contains("drop-before"), true)
    assert.equal(harness.nodeB.classList.contains("drop-after"), false)

    harness.emit("pointerup", harness.handleA, { pointerId: 3, clientX: 30, clientY: 110 })
    harness.emit("pointerup", harness.handleA, { pointerId: 3, clientX: 30, clientY: 110 })

    assert.deepEqual(harness.commits, [{
      draggedId: "node-a",
      targetId: "node-b",
      targetChapterId: "chapter-b",
      placement: "before",
    }])
    assert.equal(harness.nodeA.classList.contains("dragging"), false)
    assert.equal(harness.nodeB.classList.contains("drop-before"), false)
    assert.deepEqual(harness.handleA.releaseCalls, [3])
  } finally {
    harness.controller.destroy()
  }
})

test("uses the target midpoint for after placement, including pointer-up threshold crossing", () => {
  const harness = createHarness()
  try {
    harness.documentObject.hit = harness.nodeB
    harness.emit("pointerdown", harness.handleA, { pointerId: 4, clientX: 10, clientY: 20 })
    harness.emit("pointerup", harness.handleA, { pointerId: 4, clientX: 30, clientY: 130 })

    assert.deepEqual(harness.commits, [{
      draggedId: "node-a",
      targetId: "node-b",
      targetChapterId: "chapter-b",
      placement: "after",
    }])
  } finally {
    harness.controller.destroy()
  }
})

test("commits an inside-chapter destination", () => {
  const harness = createHarness()
  try {
    harness.documentObject.hit = harness.emptyChapter
    harness.emit("pointerdown", harness.handleA, { pointerId: 5, clientX: 10, clientY: 20 })
    harness.emit("pointermove", harness.handleA, { pointerId: 5, clientX: 30, clientY: 80 })

    assert.equal(harness.emptyChapter.classList.contains("drop-inside"), true)
    harness.emit("pointerup", harness.handleA, { pointerId: 5, clientX: 30, clientY: 80 })

    assert.deepEqual(harness.commits, [{
      draggedId: "node-a",
      targetChapterId: "chapter-empty",
      placement: "inside",
    }])
    assert.equal(harness.emptyChapter.classList.contains("drop-inside"), false)
  } finally {
    harness.controller.destroy()
  }
})

test("a fallback drag does not remove document-root listeners needed by a later captured drag", () => {
  const harness = createHarness({ rootIsDocument: true, pointerCapture: false })
  try {
    harness.documentObject.hit = harness.nodeB

    harness.emit("pointerdown", harness.handleA, { pointerId: 8, clientX: 10, clientY: 20 })
    harness.emit("pointermove", harness.handleA, { pointerId: 8, clientX: 30, clientY: 110 })
    harness.emit("pointerup", harness.handleA, { pointerId: 8, clientX: 30, clientY: 110 })

    harness.handleA.setPointerCapture = FakeElement.prototype.setPointerCapture
    harness.emit("pointerdown", harness.handleA, { pointerId: 9, clientX: 10, clientY: 20 })
    harness.emit("pointermove", harness.handleA, { pointerId: 9, clientX: 30, clientY: 110 })
    harness.emit("pointerup", harness.handleA, { pointerId: 9, clientX: 30, clientY: 110 })

    assert.equal(harness.commits.length, 2)
  } finally {
    harness.controller.destroy()
  }
})

test("pointer cancellation, lost capture, blur, and reset all clean without committing", async t => {
  for (const ending of ["pointercancel", "lostpointercapture", "blur", "reset"]) {
    await t.test(ending, () => {
      const harness = createHarness()
      try {
        harness.documentObject.hit = harness.nodeB
        harness.emit("pointerdown", harness.handleA, { pointerId: 6, clientX: 10, clientY: 20 })
        harness.emit("pointermove", harness.handleA, { pointerId: 6, clientX: 30, clientY: 110 })

        if (ending === "blur") {
          harness.windowObject.dispatchEvent({ type: "blur", target: harness.windowObject })
        } else if (ending === "reset") {
          harness.controller.reset()
        } else {
          harness.emit(ending, harness.handleA, { pointerId: 6, clientX: 30, clientY: 110 })
        }

        assert.deepEqual(harness.commits, [])
        assert.equal(harness.nodeA.classList.contains("dragging"), false)
        assert.equal(harness.nodeB.classList.contains("drop-before"), false)
        assert.equal(harness.handleA.capturedPointerId, null)

        harness.emit("pointerup", harness.handleA, { pointerId: 6, clientX: 30, clientY: 110 })
        assert.deepEqual(harness.commits, [])
      } finally {
        harness.controller.destroy()
      }
    })
  }
})

test("destroy removes listeners and prevents future gestures", () => {
  const harness = createHarness()
  harness.controller.destroy()
  harness.documentObject.hit = harness.nodeB
  harness.emit("pointerdown", harness.handleA, { pointerId: 7, clientX: 10, clientY: 20 })
  harness.emit("pointermove", harness.handleA, { pointerId: 7, clientX: 30, clientY: 110 })
  harness.emit("pointerup", harness.handleA, { pointerId: 7, clientX: 30, clientY: 110 })

  assert.deepEqual(harness.handleA.captureCalls, [])
  assert.deepEqual(harness.commits, [])
})
