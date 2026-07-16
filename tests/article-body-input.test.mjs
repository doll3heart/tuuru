import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { createArticleBodyInput } from "../js/article-body-input.js"

function createFixture(initialValue = "") {
  let value = initialValue
  let reads = 0
  const stages = []
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue() {
      reads += 1
      return value
    },
    stageValue(nodeId, candidate) {
      stages.push([nodeId, candidate])
    },
  })
  return {
    controller,
    stages,
    get reads() { return reads },
    setValue(nextValue) { value = nextValue },
  }
}

test("normal input immediately stages the newest local candidate", () => {
  const fixture = createFixture("first")

  assert.equal(fixture.controller.input(), true)
  fixture.setValue("second")
  assert.equal(fixture.controller.input(), true)

  assert.deepEqual(fixture.stages, [
    ["node-a", "first"],
    ["node-a", "second"],
  ])
  assert.equal(fixture.reads, 2)
  assert.equal(fixture.controller.isComposing(), false)
  assert.equal(fixture.controller.hasUnresolvedInput(), false)
})

test("composition caches intermediate input and stages only the final text", () => {
  const fixture = createFixture("before")

  assert.equal(fixture.controller.compositionStart(), true)
  assert.equal(fixture.controller.isComposing(), true)
  assert.equal(fixture.controller.hasUnresolvedInput(), true)

  fixture.setValue("z")
  assert.equal(fixture.controller.input(), true)
  fixture.setValue("中文")
  assert.equal(fixture.controller.input(), true)
  assert.deepEqual(fixture.stages, [])

  fixture.setValue("中文完成")
  assert.equal(fixture.controller.compositionEnd(), true)
  assert.deepEqual(fixture.stages, [["node-a", "中文完成"]])
  assert.equal(fixture.reads, 3)
  assert.equal(fixture.controller.isComposing(), false)
  assert.equal(fixture.controller.hasUnresolvedInput(), false)
})

test("a post-composition normal input stages immediately even when its value matches", () => {
  const fixture = createFixture("中")
  fixture.controller.compositionStart()
  fixture.controller.input()
  fixture.setValue("中文")
  fixture.controller.compositionEnd()

  assert.equal(fixture.controller.input(), true)
  assert.deepEqual(fixture.stages, [
    ["node-a", "中文"],
    ["node-a", "中文"],
  ])
})

test("a different post-composition value is a new normal input", () => {
  const fixture = createFixture("中")
  fixture.controller.compositionStart()
  fixture.controller.input()
  fixture.setValue("中文")
  fixture.controller.compositionEnd()
  fixture.setValue("中文!")

  assert.equal(fixture.controller.input(), true)
  assert.deepEqual(fixture.stages, [
    ["node-a", "中文"],
    ["node-a", "中文!"],
  ])
})

test("repeated composition boundaries are rejected without reading or staging", () => {
  const fixture = createFixture("value")

  assert.equal(fixture.controller.compositionEnd(), false)
  assert.equal(fixture.controller.compositionStart(), true)
  assert.equal(fixture.controller.compositionStart(), false)
  assert.equal(fixture.controller.compositionEnd(), true)
  assert.equal(fixture.controller.compositionEnd(), false)

  assert.equal(fixture.reads, 1)
  assert.deepEqual(fixture.stages, [["node-a", "value"]])
})

test("freeze is stable and immediately rejects late events when not composing", async () => {
  const fixture = createFixture("saved")
  fixture.controller.input()

  const first = fixture.controller.freeze()
  const second = fixture.controller.freeze()
  assert.equal(first, second)
  await first

  const readsBeforeLateEvents = fixture.reads
  fixture.setValue("late")
  assert.equal(fixture.controller.input(), false)
  assert.equal(fixture.controller.compositionStart(), false)
  assert.equal(fixture.controller.compositionEnd(), false)
  assert.equal(fixture.reads, readsBeforeLateEvents)
  assert.deepEqual(fixture.stages, [["node-a", "saved"]])
})

test("freeze during composition waits for final composition text", async () => {
  const fixture = createFixture("中")
  fixture.controller.compositionStart()
  fixture.controller.input()

  let settled = false
  const frozen = fixture.controller.freeze().then(() => { settled = true })
  assert.equal(fixture.controller.freeze(), fixture.controller.freeze())
  await Promise.resolve()
  assert.equal(settled, false)
  assert.equal(fixture.controller.isComposing(), true)
  assert.equal(fixture.controller.hasUnresolvedInput(), true)
  assert.equal(fixture.controller.compositionStart(), false)

  fixture.setValue("中文")
  assert.equal(fixture.controller.input(), true)
  assert.equal(fixture.controller.compositionEnd(), true)
  await frozen

  assert.equal(settled, true)
  assert.deepEqual(fixture.stages, [["node-a", "中文"]])
  assert.equal(fixture.controller.isComposing(), false)
  assert.equal(fixture.controller.hasUnresolvedInput(), false)
  assert.equal(fixture.controller.input(), false)
})

test("a staging error preserves unresolved input and freeze retries that candidate", async () => {
  let value = "recover me"
  let shouldFail = true
  const stages = []
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue: () => value,
    stageValue(nodeId, candidate) {
      stages.push([nodeId, candidate])
      if (shouldFail) throw new Error("stage rejected")
    },
  })

  assert.throws(() => controller.input(), /stage rejected/)
  assert.equal(controller.hasUnresolvedInput(), true)

  shouldFail = false
  await controller.freeze()
  assert.deepEqual(stages, [
    ["node-a", "recover me"],
    ["node-a", "recover me"],
  ])
  assert.equal(controller.hasUnresolvedInput(), false)

  value = "late"
  assert.equal(controller.input(), false)
})

test("an input read failure is synchronously unresolved and freeze retries the DOM read", async () => {
  let shouldFail = true
  const stages = []
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue() {
      if (shouldFail) throw new Error("DOM read failed")
      return "recovered"
    },
    stageValue(nodeId, candidate) {
      stages.push([nodeId, candidate])
    },
  })

  assert.throws(() => controller.input(), /DOM read failed/)
  assert.equal(controller.hasUnresolvedInput(), true)

  shouldFail = false
  await controller.freeze()
  assert.deepEqual(stages, [["node-a", "recovered"]])
  assert.equal(controller.hasUnresolvedInput(), false)
})

test("a composition-end read failure rejects freeze instead of hanging", async () => {
  let value = "中"
  let failRead = false
  const stages = []
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue() {
      if (failRead) throw new Error("final DOM read failed")
      return value
    },
    stageValue(nodeId, candidate) {
      stages.push([nodeId, candidate])
    },
  })
  controller.compositionStart()
  controller.input()
  const frozen = controller.freeze()
  const rejection = assert.rejects(frozen, /final DOM read failed/)
  failRead = true

  assert.throws(() => controller.compositionEnd(), /final DOM read failed/)
  await rejection
  assert.equal(controller.isComposing(), false)
  assert.equal(controller.hasUnresolvedInput(), true)
  assert.deepEqual(stages, [])

  failRead = false
  value = "中文"
  assert.equal(controller.input(), true)
  assert.deepEqual(stages, [["node-a", "中文"]])
})

test("a composition-end staging error rejects freeze without losing the candidate", async () => {
  let value = "中"
  let shouldFail = true
  const stages = []
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue: () => value,
    stageValue(nodeId, candidate) {
      stages.push([nodeId, candidate])
      if (shouldFail) throw new Error("final stage failed")
    },
  })
  controller.compositionStart()
  controller.input()
  const frozen = controller.freeze()
  value = "中文"

  assert.throws(() => controller.compositionEnd(), /final stage failed/)
  await assert.rejects(frozen, /final stage failed/)
  assert.equal(controller.isComposing(), false)
  assert.equal(controller.hasUnresolvedInput(), true)

  shouldFail = false
  value = "中文修复"
  assert.equal(controller.input(), true)
  await controller.freeze()
  assert.deepEqual(stages, [
    ["node-a", "中文"],
    ["node-a", "中文修复"],
  ])
  assert.equal(controller.hasUnresolvedInput(), false)
})

test("dispose rejects a freeze waiting for composition and later freeze calls", async () => {
  const fixture = createFixture("中")
  fixture.controller.compositionStart()
  fixture.controller.input()
  const frozen = fixture.controller.freeze()
  const rejection = assert.rejects(frozen, /disposed/i)

  fixture.controller.dispose()
  await rejection
  await assert.rejects(fixture.controller.freeze(), /disposed/i)
  assert.equal(fixture.controller.hasUnresolvedInput(), true)
  assert.deepEqual(fixture.stages, [])
})

test("dispose remains terminal after an earlier successful freeze", async () => {
  const fixture = createFixture("saved")
  fixture.controller.input()
  await fixture.controller.freeze()
  fixture.controller.dispose()

  await assert.rejects(fixture.controller.freeze(), /disposed/i)
})

test("stageValue is a synchronous admission boundary", () => {
  const controller = createArticleBodyInput({
    nodeId: "node-a",
    readValue: () => "candidate",
    stageValue: () => ({ then() {} }),
  })

  assert.throws(() => controller.input(), /synchronous/i)
  assert.equal(controller.hasUnresolvedInput(), true)
})

test("dispose rejects late DOM events and retains unresolved composition state", () => {
  const fixture = createFixture("kept")
  fixture.controller.input()
  fixture.controller.compositionStart()
  fixture.setValue("intermediate")
  fixture.controller.input()
  const readsBeforeDispose = fixture.reads

  assert.equal(fixture.controller.dispose(), true)
  assert.equal(fixture.controller.dispose(), false)
  assert.equal(fixture.controller.input(), false)
  assert.equal(fixture.controller.compositionStart(), false)
  assert.equal(fixture.controller.compositionEnd(), false)

  assert.equal(fixture.reads, readsBeforeDispose)
  assert.deepEqual(fixture.stages, [["node-a", "kept"]])
  assert.equal(fixture.controller.isComposing(), false)
  assert.equal(fixture.controller.hasUnresolvedInput(), true)
})

test("the controller validates its dependencies", () => {
  const valid = {
    nodeId: "node-a",
    readValue: () => "value",
    stageValue() {},
  }
  assert.throws(() => createArticleBodyInput(), TypeError)
  assert.throws(() => createArticleBodyInput({ ...valid, nodeId: "" }), TypeError)
  assert.throws(() => createArticleBodyInput({ ...valid, readValue: null }), TypeError)
  assert.throws(() => createArticleBodyInput({ ...valid, stageValue: null }), TypeError)
})

test("the body controller owns no debounce, max-wait, or animation timer", async () => {
  const source = await readFile(new URL("../js/article-body-input.js", import.meta.url), "utf8")

  assert.doesNotMatch(source, /setTimeout|setInterval|requestAnimationFrame/)
})
