import test from "node:test"
import assert from "node:assert/strict"
import {
  advanceCallPlayback,
  createCallPlaybackState,
} from "../reader/call-playback.js"

test("normalizes string lines without mutating inputs", () => {
  const input = ["  第一行  ", "", "   ", "第二行"]
  const snapshot = input.slice()
  const state = createCallPlaybackState(input, "备用台词")

  assert.deepEqual(state.lines, ["第一行", "第二行"])
  assert.deepEqual(input, snapshot)
  assert.equal(Object.isFrozen(state), true)
  assert.equal(Object.isFrozen(state.lines), true)
})

test("uses fallback text only when no valid call line remains", () => {
  assert.deepEqual(
    createCallPlaybackState([null, "  ", 42], "  旧格式台词  ").lines,
    ["旧格式台词"],
  )
  assert.deepEqual(
    createCallPlaybackState(["新格式台词"], "旧格式台词").lines,
    ["新格式台词"],
  )
})

test("represents an empty call as complete at index minus one", () => {
  const state = createCallPlaybackState([null, "  "], " ")
  assert.deepEqual(state, {
    lines: [],
    currentIndex: -1,
    isEmpty: true,
    isComplete: true,
  })
})

test("starts a non-empty call at its first line", () => {
  const state = createCallPlaybackState(["一", "二", "三"])
  assert.equal(state.currentIndex, 0)
  assert.equal(state.isEmpty, false)
  assert.equal(state.isComplete, false)
  assert.equal(state.lines[state.currentIndex], "一")
})

test("reveals exactly one line per advance without changing prior states", () => {
  const first = createCallPlaybackState(["一", "二", "三"])
  const second = advanceCallPlayback(first)
  const third = advanceCallPlayback(second)

  assert.equal(first.currentIndex, 0)
  assert.equal(second.currentIndex, 1)
  assert.equal(third.currentIndex, 2)
  assert.equal(first.isComplete, false)
  assert.equal(second.isComplete, false)
  assert.equal(third.isComplete, true)
  assert.strictEqual(first.lines, second.lines)
  assert.strictEqual(second.lines, third.lines)
  assert.equal(Object.isFrozen(second), true)
})

test("returns the identical state after completion", () => {
  const complete = createCallPlaybackState(["只有一句"])
  assert.strictEqual(advanceCallPlayback(complete), complete)
})

test("creates independent fresh state for every reopen", () => {
  const lines = ["一", "二"]
  const firstOpening = advanceCallPlayback(createCallPlaybackState(lines))
  const secondOpening = createCallPlaybackState(lines)

  assert.equal(firstOpening.currentIndex, 1)
  assert.equal(secondOpening.currentIndex, 0)
  assert.notStrictEqual(firstOpening, secondOpening)
})

test("skips hostile values and accessor entries without coercion", () => {
  let getterRuns = 0
  let coercions = 0
  const lines = []
  Object.defineProperty(lines, "0", {
    configurable: true,
    get() {
      getterRuns += 1
      return "泄漏台词"
    },
  })
  lines.length = 1
  lines.push({
    toString() {
      coercions += 1
      return "对象台词"
    },
  })

  const state = createCallPlaybackState(lines, "安全备用")
  assert.deepEqual(state.lines, ["安全备用"])
  assert.equal(getterRuns, 0)
  assert.equal(coercions, 0)
})
