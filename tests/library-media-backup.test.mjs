import test from "node:test"
import assert from "node:assert/strict"

import {
  attachLocalDatabaseBackupMedia,
  serializeLocalDatabaseBackupWithMedia,
  stageLocalDatabaseBackupMedia,
} from "../js/library-media-backup.js"
import { parseLocalDatabaseBackup } from "../js/storage.js"

function storageWith(database) {
  return { getItem() { return JSON.stringify(database) } }
}

test("full-library backup carries referenced binary media in version two", async () => {
  const id = "a".repeat(64)
  const database = {
    works:[{ id:"work-1", type:"article", title:"test", nodes:[], interactiveScenes:[] }],
    contacts:[],
    groups:[],
  }
  const serialized = await serializeLocalDatabaseBackupWithMedia(
    storageWith(database),
    new Date("2026-08-09T00:00:00.000Z"),
    async () => [{
      id,
      type:"image/png",
      fileName:"cover.png",
      blob:new Blob([Uint8Array.of(1, 2, 3)], { type:"image/png" }),
    }],
  )
  const backup = parseLocalDatabaseBackup(serialized)

  assert.equal(backup.backupVersion, 2)
  assert.equal(backup.mediaAssets.length, 1)
  assert.equal(backup.mediaAssets[0].id, id)
  assert.equal(backup.mediaAssets[0].data, "AQID")
})

test("restored backup media is hash-verified before library references attach", async () => {
  const id = "b".repeat(64)
  const calls = []
  const backup = {
    mediaAssets:[{ id, type:"image/png", fileName:"scene.png", data:"AQID" }],
  }
  await stageLocalDatabaseBackupMedia(backup, async (blob, options) => {
    calls.push([blob.size, options.fileName])
    return `asset://${id}`
  })
  await attachLocalDatabaseBackupMedia(
    { works:[{ id:"work-1" }] },
    async works => calls.push(["works", works.length]),
  )

  assert.deepEqual(calls, [[3, "scene.png"], ["works", 1]])
})

test("restored backup media rejects content whose persisted hash differs", async () => {
  const id = "c".repeat(64)
  await assert.rejects(
    stageLocalDatabaseBackupMedia(
      { mediaAssets:[{ id, type:"image/png", fileName:"scene.png", data:"AQID" }] },
      async () => `asset://${"d".repeat(64)}`,
    ),
    /校验失败/,
  )
})
