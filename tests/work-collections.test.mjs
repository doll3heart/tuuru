import test from "node:test"
import assert from "node:assert/strict"

import {
  WORK_COLLECTION_BUNDLE_TYPE,
  createWorkCollectionRecord,
  normalizeWorkCollection,
  prepareWorkCollectionBundle,
  serializeWorkCollectionBundle,
} from "../js/work-collections.js"

function article(id, title = id) {
  return { id, schemaVersion:1, type:"article", title, nodes:[], chapters:[], scenes:[], placeholders:[], phoneModules:[], startNode:"" }
}

test("collection records keep ordered unique references without copying works", () => {
  const record = createWorkCollectionRecord({ id:"collection-1", title:"夜航集", workIds:["a","b","a"], now:10 })
  assert.deepEqual(record.workIds, ["a", "b"])
  assert.equal(record.accessMode, "separate")
  assert.equal(record.createdAt, 10)
})

test("collection creation needs two distinct works", () => {
  assert.throws(() => createWorkCollectionRecord({ id:"c", title:"集", workIds:["a","a"] }), /至少需要两篇/)
})

test("normalization preserves a depleted collection without weakening creation", () => {
  assert.deepEqual(normalizeWorkCollection({ id:"c", title:"集", workIds:["a"] }).workIds, ["a"])
})

test("collection bundle resolves ordered latest share copies", () => {
  const collection = createWorkCollectionRecord({ id:"c", title:"集", workIds:["b","a"], now:1 })
  const raw = serializeWorkCollectionBundle(collection, [article("a", "A latest"), article("b", "B latest")], new Date(0))
  const parsed = JSON.parse(raw)
  assert.equal(parsed.type, WORK_COLLECTION_BUNDLE_TYPE)
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.works.map(work => work.title), ["B latest", "A latest"])
})

test("collection bundle rejects a missing member", () => {
  const collection = createWorkCollectionRecord({ id:"c", title:"集", workIds:["a","b"], now:1 })
  assert.throws(() => serializeWorkCollectionBundle(collection, [article("a")]), /已不存在/)
})

test("reader preparation validates and orders every bundled work", () => {
  const collection = createWorkCollectionRecord({ id:"c", title:"集", workIds:["b","a"], now:1 })
  const bundle = JSON.parse(serializeWorkCollectionBundle(collection, [article("a"), article("b")], new Date(0)))
  const result = prepareWorkCollectionBundle(bundle, { document: globalThis.document })
  assert.equal(result.ok, true)
  assert.deepEqual(result.works.map(work => work.id), ["b", "a"])
})

test("reader preparation rejects directory and payload disagreement", () => {
  const collection = createWorkCollectionRecord({ id:"c", title:"集", workIds:["a","b"], now:1 })
  const bundle = JSON.parse(serializeWorkCollectionBundle(collection, [article("a"), article("b")], new Date(0)))
  bundle.collection.workIds = ["a"]
  assert.equal(prepareWorkCollectionBundle(bundle).ok, false)
})
