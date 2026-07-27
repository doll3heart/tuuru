import test from "node:test"
import assert from "node:assert/strict"

import { createHomeBulkUndoStore } from "../js/home-bulk-undo.js"

function record() {
  return {
    workId:"work-1",
    label:"全作品查找替换",
    beforeWork:{id:"work-1", title:"修改前", nested:{value:1}},
    expectedWorkToken:"after-token",
  }
}

test("stores exactly one detached recent bulk operation", () => {
  const store = createHomeBulkUndoStore()
  const input = record()
  store.register(input)
  input.beforeWork.nested.value = 99

  const saved = store.peek("work-1")
  assert.equal(saved.label, "全作品查找替换")
  assert.equal(saved.beforeWork.nested.value, 1)
  saved.beforeWork.nested.value = 88
  assert.equal(store.peek("work-1").beforeWork.nested.value, 1)

  store.register({
    workId:"work-2",
    label:"批量顺延时间",
    beforeWork:{id:"work-2", title:"另一部作品"},
    expectedWorkToken:"work-2-after",
  })
  assert.equal(store.peek("work-1"), null)
  assert.equal(store.peek("work-2").label, "批量顺延时间")
})

test("consume and clear remove only the current matching record", () => {
  const store = createHomeBulkUndoStore()
  store.register(record())
  assert.equal(store.consume("other"), null)
  assert.ok(store.peek("work-1"))

  const consumed = store.consume("work-1")
  assert.equal(consumed.workId, "work-1")
  assert.equal(store.peek("work-1"), null)

  store.register(record())
  store.clear()
  assert.equal(store.peek("work-1"), null)
})

test("invalid or mismatched snapshots fail closed", () => {
  const store = createHomeBulkUndoStore()
  assert.throws(() => store.register(null), TypeError)
  assert.throws(() => store.register({
    workId:"work-1",
    label:"替换",
    beforeWork:{id:"other"},
    expectedWorkToken:"token",
  }), /snapshot/i)
  assert.equal(store.peek("work-1"), null)
})
