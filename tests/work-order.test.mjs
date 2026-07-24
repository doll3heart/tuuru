import test from "node:test"
import assert from "node:assert/strict"

import {
  moveWorkBefore,
  moveWorkByOffset,
  orderedWorks,
  toggleWorkPinnedRecord,
} from "../js/work-order.js"

const works = [
  { id:"normal-a", title:"A" },
  { id:"pinned-a", title:"置顶 A", pinned:true },
  { id:"normal-b", title:"B" },
  { id:"pinned-b", title:"置顶 B", pinned:true },
]

test("ordered works groups pinned records first while preserving group order", () => {
  assert.deepEqual(
    orderedWorks(works).map(work => work.id),
    ["pinned-a", "pinned-b", "normal-a", "normal-b"],
  )
  assert.deepEqual(works.map(work => work.id), ["normal-a", "pinned-a", "normal-b", "pinned-b"])
})

test("moving before reorders only within the same pin group", () => {
  assert.deepEqual(
    moveWorkBefore(works, "normal-b", "normal-a").works.map(work => work.id),
    ["pinned-a", "pinned-b", "normal-b", "normal-a"],
  )
  const blocked = moveWorkBefore(works, "normal-a", "pinned-a")
  assert.equal(blocked.changed, false)
  assert.deepEqual(blocked.works, works)
})

test("offset movement respects group boundaries", () => {
  assert.deepEqual(
    moveWorkByOffset(works, "normal-b", -1).works.map(work => work.id),
    ["pinned-a", "pinned-b", "normal-b", "normal-a"],
  )
  assert.equal(moveWorkByOffset(works, "normal-a", -1).changed, false)
  assert.equal(moveWorkByOffset(works, "pinned-b", 1).changed, false)
})

test("pinning appends to pinned works and unpinning leads ordinary works", () => {
  const pinned = toggleWorkPinnedRecord(works, "normal-a", true)
  assert.equal(pinned.changed, true)
  assert.deepEqual(
    orderedWorks(pinned.works).map(work => work.id),
    ["pinned-a", "pinned-b", "normal-a", "normal-b"],
  )
  assert.equal(pinned.works.find(work => work.id === "normal-a").pinned, true)

  const unpinned = toggleWorkPinnedRecord(works, "pinned-b", false)
  assert.deepEqual(
    orderedWorks(unpinned.works).map(work => work.id),
    ["pinned-a", "pinned-b", "normal-a", "normal-b"],
  )
  assert.notEqual(unpinned.works.find(work => work.id === "pinned-b").pinned, true)
})

test("missing work ids are safe no-ops", () => {
  for (const result of [
    moveWorkBefore(works, "missing", "normal-a"),
    moveWorkByOffset(works, "missing", 1),
    toggleWorkPinnedRecord(works, "missing", true),
  ]) {
    assert.equal(result.changed, false)
    assert.deepEqual(result.works, works)
  }
})
