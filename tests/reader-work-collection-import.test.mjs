import test from "node:test"
import assert from "node:assert/strict"
import {
  inspectReaderCollectionBundle,
  installReaderCollection,
  READER_COLLECTIONS_KEY,
  READER_WORK_KEY_PREFIX,
} from "../reader/work-collection-import.js"

function storage(initial = {}, failAt = Infinity) {
  const values = new Map(Object.entries(initial))
  let writes = 0
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) {
      writes += 1
      if (writes === failAt) throw new Error("quota")
      values.set(key, String(value))
    },
    removeItem(key) { values.delete(key) },
    snapshot() { return Object.fromEntries(values) },
  }
}

function article(id, title) {
  return { id, schemaVersion: 1, title, type: "article", nodes: [], chapters: [], scenes: [], placeholders: [], phoneModules: [], startNode: "" }
}

function bundle() {
  return {
    type: "tuuru-work-collection",
    version: 1,
    exportedAt: "2026-07-23T00:00:00.000Z",
    collection: { id: "c1", title: "清晨集", accessMode: "separate", workIds: ["a", "b"] },
    works: [article("a", "A"), article("b", "B")],
  }
}

test("reader inspection reports replacements without writing", () => {
  const local = storage({
    [READER_COLLECTIONS_KEY]: JSON.stringify([{ id: "c1", title: "旧集" }]),
    [READER_WORK_KEY_PREFIX + "a"]: JSON.stringify(article("a", "旧 A")),
  })
  const before = local.snapshot()
  const result = inspectReaderCollectionBundle(bundle(), local, {})
  assert.equal(result.ok, true)
  assert.equal(result.replacingCollection, true)
  assert.equal(result.existingWorkCount, 1)
  assert.deepEqual(local.snapshot(), before)
})

test("reader install writes ordered works and one collection directory", () => {
  const local = storage()
  const inspected = inspectReaderCollectionBundle(bundle(), local, {})
  const result = installReaderCollection(local, inspected, 123)
  assert.equal(result.collection.importedAt, 123)
  assert.equal(JSON.parse(local.getItem(READER_WORK_KEY_PREFIX + "a")).title, "A")
  assert.deepEqual(JSON.parse(local.getItem(READER_COLLECTIONS_KEY))[0].workIds, ["a", "b"])
})

test("reader install restores every affected key after a failed batch", () => {
  const oldA = JSON.stringify(article("a", "旧 A"))
  const oldCollections = JSON.stringify([{ id: "old", title: "旧集" }])
  const local = storage({
    [READER_COLLECTIONS_KEY]: oldCollections,
    [READER_WORK_KEY_PREFIX + "a"]: oldA,
  }, 2)
  const inspected = inspectReaderCollectionBundle(bundle(), local, {})
  assert.throws(() => installReaderCollection(local, inspected, 123), /quota/)
  assert.equal(local.getItem(READER_COLLECTIONS_KEY), oldCollections)
  assert.equal(local.getItem(READER_WORK_KEY_PREFIX + "a"), oldA)
  assert.equal(local.getItem(READER_WORK_KEY_PREFIX + "b"), null)
})
