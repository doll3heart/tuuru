import test from "node:test"
import assert from "node:assert/strict"

import { createEditorPersistenceBuffer } from "../js/editor-persistence-buffer.js"

function fakeTimers() {
  let nextId = 1
  const callbacks = new Map()
  return {
    setTimer(callback) {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    },
    clearTimer(id) {
      callbacks.delete(id)
    },
    run(id) {
      const callback = callbacks.get(id)
      callbacks.delete(id)
      callback?.()
    },
    runAll() {
      for (const id of [...callbacks.keys()]) this.run(id)
    },
    get size() {
      return callbacks.size
    },
  }
}

test("persistence buffer coalesces repeated writes for one editor field", () => {
  const timers = fakeTimers()
  const writes = []
  const buffer = createEditorPersistenceBuffer({
    delay: 180,
    setTimer: callback => timers.setTimer(callback),
    clearTimer: id => timers.clearTimer(id),
  })

  buffer.schedule("node:1", () => writes.push("old"))
  buffer.schedule("node:1", () => writes.push("new"))

  assert.equal(buffer.pendingCount, 1)
  assert.equal(timers.size, 1)
  assert.deepEqual(writes, [])

  buffer.flush("node:1")
  assert.deepEqual(writes, ["new"])
  assert.equal(buffer.pendingCount, 0)
  assert.equal(timers.size, 0)
})

test("persistence buffer keeps independent node and note writes", () => {
  const timers = fakeTimers()
  const writes = []
  const buffer = createEditorPersistenceBuffer({
    setTimer: callback => timers.setTimer(callback),
    clearTimer: id => timers.clearTimer(id),
  })

  buffer.schedule("node:1", () => writes.push("node"))
  buffer.schedule("note:outline", () => writes.push("note"))
  buffer.flush()

  assert.deepEqual(writes, ["node", "note"])
  assert.equal(buffer.pendingCount, 0)
  assert.equal(timers.size, 0)
})

test("timer flush and cancellation execute at most the latest write once", () => {
  const timers = fakeTimers()
  const writes = []
  const buffer = createEditorPersistenceBuffer({
    setTimer: callback => timers.setTimer(callback),
    clearTimer: id => timers.clearTimer(id),
  })

  buffer.schedule("node:1", () => writes.push("node"))
  timers.runAll()
  buffer.flush("node:1")
  assert.deepEqual(writes, ["node"])

  buffer.schedule("note:outline", () => writes.push("note"))
  assert.equal(buffer.cancel("note:outline"), true)
  timers.runAll()
  assert.deepEqual(writes, ["node"])
})

test("a write scheduled while flushing remains pending for the next pass", () => {
  const timers = fakeTimers()
  const writes = []
  const buffer = createEditorPersistenceBuffer({
    setTimer: callback => timers.setTimer(callback),
    clearTimer: id => timers.clearTimer(id),
  })

  buffer.schedule("node:1", () => {
    writes.push("first")
    buffer.schedule("node:1", () => writes.push("second"))
  })
  buffer.flush("node:1")

  assert.deepEqual(writes, ["first"])
  assert.equal(buffer.pendingCount, 1)
  buffer.flush("node:1")
  assert.deepEqual(writes, ["first", "second"])
})

test("persistence buffer reports editing, saving, saved, and failed states", () => {
  const timers = fakeTimers()
  const states = []
  const buffer = createEditorPersistenceBuffer({
    setTimer: callback => timers.setTimer(callback),
    clearTimer: id => timers.clearTimer(id),
    onStateChange(snapshot) {
      states.push({
        state:snapshot.state,
        pendingCount:snapshot.pendingCount,
        message:snapshot.error?.message || "",
      })
    },
  })

  buffer.schedule("node:1", () => {})
  timers.runAll()

  buffer.schedule("node:2", () => { throw new Error("quota") })
  assert.throws(() => timers.runAll(), /quota/)

  assert.deepEqual(states, [
    {state:"editing", pendingCount:1, message:""},
    {state:"saving", pendingCount:0, message:""},
    {state:"saved", pendingCount:0, message:""},
    {state:"editing", pendingCount:1, message:""},
    {state:"saving", pendingCount:0, message:""},
    {state:"error", pendingCount:0, message:"quota"},
  ])
})
