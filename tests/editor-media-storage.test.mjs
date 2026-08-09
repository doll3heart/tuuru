import test from "node:test"
import assert from "node:assert/strict"

import {
  collectEditorMediaAssetIds,
  createEditorMediaUrlResolver,
  editorMediaAssetReference,
  garbageCollectEditorMediaAssets,
  loadEditorMediaAssets,
  parseEditorMediaAssetId,
  persistEditorMediaAsset,
  resolveEditorMediaAssetUrl,
  syncEditorMediaAssetReferences,
} from "../js/editor-media-storage.js"

const HASH = "a".repeat(64)

test("binary media assets deduplicate by content hash", async () => {
  const records = new Map()
  const repository = {
    getAsset: async id => records.get(id),
    putAsset: async record => records.set(record.id, record),
  }
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
  const options = { hashBytes: async () => HASH, now: () => 123 }

  const first = await persistEditorMediaAsset(blob, { ...options, fileName: "first.png" }, repository)
  const second = await persistEditorMediaAsset(blob, { ...options, fileName: "copy.png" }, repository)

  assert.equal(first, editorMediaAssetReference(HASH))
  assert.equal(second, first)
  assert.equal(records.size, 1)
  assert.deepEqual(records.get(HASH), {
    id: HASH,
    blob,
    type: "image/png",
    bytes: 3,
    fileName: "first.png",
    createdAt: 123,
  })
})

test("garbage collection removes only assets without work references", async () => {
  const removed = []
  const countById = new Map([[HASH, 1], ["b".repeat(64), 0]])

  const count = await garbageCollectEditorMediaAssets({
    listAssets: async () => [{ id: HASH }, { id: "b".repeat(64) }],
    countReferences: async id => countById.get(id),
    deleteAsset: async id => removed.push(id),
  })

  assert.equal(count, 1)
  assert.deepEqual(removed, ["b".repeat(64)])
})

test("portable export loads each referenced Blob exactly once", async () => {
  const blob = new Blob(["image"], { type: "image/png" })
  const assets = await loadEditorMediaAssets({
    image: editorMediaAssetReference(HASH),
    duplicate: editorMediaAssetReference(HASH),
  }, {
    getAsset: async id => ({ id, blob, type: "image/png", fileName: "image.png" }),
  })

  assert.deepEqual(assets, [{
    id: HASH,
    blob,
    type: "image/png",
    fileName: "image.png",
  }])
})

test("stored media assets resolve to temporary object URLs", async () => {
  const blob = new Blob(["image"], { type: "image/webp" })
  const urls = []
  const url = await resolveEditorMediaAssetUrl(editorMediaAssetReference(HASH), {
    getAsset: async id => ({ id, blob }),
    createObjectURL(value) {
      urls.push(value)
      return "blob:tuuru-media"
    },
  })

  assert.equal(url, "blob:tuuru-media")
  assert.deepEqual(urls, [blob])
  assert.equal(await resolveEditorMediaAssetUrl("https://example.test/image.png"), "https://example.test/image.png")
})

test("media URL resolvers reuse and revoke one object URL per asset", async () => {
  const blob = new Blob(["image"], { type: "image/png" })
  const created = []
  const revoked = []
  const resolver = createEditorMediaUrlResolver({
    getAsset: async id => ({ id, blob }),
    createObjectURL(value) {
      created.push(value)
      return "blob:shared-media"
    },
    revokeObjectURL: url => revoked.push(url),
  })
  const reference = editorMediaAssetReference(HASH)

  assert.deepEqual(await Promise.all([resolver.resolve(reference), resolver.resolve(reference)]), [
    "blob:shared-media",
    "blob:shared-media",
  ])
  assert.equal(created.length, 1)
  resolver.release()
  assert.deepEqual(revoked, ["blob:shared-media"])
})

test("work media references are collected once and synchronized for garbage collection", async () => {
  const reference = editorMediaAssetReference(HASH)
  const otherHash = "b".repeat(64)
  const other = editorMediaAssetReference(otherHash)
  const work = {
    cover: reference,
    interactiveBgm:{ source:other },
    interactiveScenes: [{ stages: [{ image: reference, bgm:{ source:other }, layers: [{ source:other }] }] }],
  }
  const syncCalls = []

  assert.equal(parseEditorMediaAssetId(reference), HASH)
  assert.equal(parseEditorMediaAssetId("data:image/png;base64,AQ=="), "")
  assert.deepEqual(collectEditorMediaAssetIds(work), [HASH, otherHash])

  await syncEditorMediaAssetReferences("work-a", work, {
    syncReferences: async (workId, ids) => syncCalls.push([workId, ids]),
  })
  assert.deepEqual(syncCalls, [["work-a", [HASH, otherHash]]])
})
