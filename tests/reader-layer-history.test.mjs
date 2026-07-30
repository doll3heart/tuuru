import test from "node:test"
import assert from "node:assert/strict"
import {
  createReaderLayerHistory,
  READER_LAYER_STATE_KEY,
} from "../reader/reader-layer-history.js"

function fakeWindow() {
  const listeners = new Map()
  const states = [{}]
  let index = 0
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler)
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type)
    },
    history:{
      get state() {
        return states[index]
      },
      pushState(state) {
        states.splice(index + 1)
        states.push(state)
        index += 1
      },
      back() {
        if (index === 0) return
        index -= 1
        listeners.get("popstate")?.({ state:states[index] })
      },
    },
    browserBack() {
      if (index === 0) return
      index -= 1
      listeners.get("popstate")?.({ state:states[index] })
    },
  }
  return target
}

test("browser Back closes one reader layer at a time", () => {
  const target = fakeWindow()
  const closed = []
  const stack = createReaderLayerHistory(target)
  stack.open("appearance", event => closed.push(["appearance", event.source]))
  stack.open("picker", event => closed.push(["picker", event.source]))

  assert.equal(stack.depth(), 2)
  assert.match(target.history.state[READER_LAYER_STATE_KEY], /^reader-layer-/)

  target.browserBack()
  assert.deepEqual(closed, [["picker", "history"]])
  assert.equal(stack.depth(), 1)

  target.browserBack()
  assert.deepEqual(closed, [
    ["picker", "history"],
    ["appearance", "history"],
  ])
  assert.equal(stack.depth(), 0)
})

test("control close consumes its own history entry without closing the layer below", () => {
  const target = fakeWindow()
  const closed = []
  const stack = createReaderLayerHistory(target)
  stack.open("phone-app", event => closed.push(["phone-app", event.source]))
  stack.open("phone-detail", event => closed.push(["phone-detail", event.source]))

  assert.equal(stack.close("phone-detail"), true)
  assert.deepEqual(closed, [["phone-detail", "control"]])
  assert.equal(stack.has("phone-app"), true)
  assert.equal(stack.depth(), 1)

  target.browserBack()
  assert.deepEqual(closed, [
    ["phone-detail", "control"],
    ["phone-app", "history"],
  ])
})

test("reopening the same layer updates its close behavior without pushing twice", () => {
  const target = fakeWindow()
  const closed = []
  const stack = createReaderLayerHistory(target)
  const firstToken = stack.open("appearance", () => closed.push("old"))
  const secondToken = stack.open("appearance", () => closed.push("new"))

  assert.equal(firstToken, secondToken)
  assert.equal(stack.depth(), 1)
  target.browserBack()
  assert.deepEqual(closed, ["new"])
})
