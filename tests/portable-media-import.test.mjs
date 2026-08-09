import test from "node:test"
import assert from "node:assert/strict"

import { installPortableWorkAssets, portableAssetOwnerId } from "../js/portable-media-import.js"

const HASH = "a".repeat(64)

test("portable assets are verified, persisted, and attached to the reader work", async () => {
  const payload = { id: "work-a", type: "article", image: `asset://${HASH}` }
  const persisted = []
  const synchronized = []

  const result = await installPortableWorkAssets(payload, [{
    id: HASH,
    type: "image/png",
    fileName: "image.png",
    bytes: new Uint8Array([1, 2, 3]),
  }], {
    persistAsset: async (blob, metadata) => {
      persisted.push([blob, metadata])
      return `asset://${HASH}`
    },
    syncReferences: async (ownerId, value) => synchronized.push([ownerId, value]),
  })

  assert.equal(result, 1)
  assert.equal(persisted[0][0].type, "image/png")
  assert.deepEqual([...new Uint8Array(await persisted[0][0].arrayBuffer())], [1, 2, 3])
  assert.equal(persisted[0][1].fileName, "image.png")
  assert.deepEqual(synchronized, [[portableAssetOwnerId(payload), payload]])
})

test("portable asset ids must match the imported binary content", async () => {
  await assert.rejects(
    installPortableWorkAssets({ id: "work-a" }, [{
      id: HASH,
      type: "image/png",
      bytes: new Uint8Array([1]),
    }], {
      persistAsset: async () => `asset://${"b".repeat(64)}`,
      syncReferences: async () => {},
    }),
    /校验失败/,
  )
})

test("legacy packages without assets do not require IndexedDB", async () => {
  assert.equal(await installPortableWorkAssets({ id: "legacy" }, []), 0)
})
