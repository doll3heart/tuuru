import test from "node:test"
import assert from "node:assert/strict"

import {
  EXPORT_HISTORY_KEY,
  clearExportHistory,
  exportRecordStatus,
  readExportHistory,
  recordExport,
  removeExportRecord,
} from "../js/export-history.js"

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

function artifact(index = 1) {
  return {
    entityType: "work",
    entityId: `work-${index}`,
    title: `Story ${index}`,
    format: index % 2 ? "tuuru" : "png",
    bytes: index * 100,
    revision: index,
  }
}

test("export history records metadata only and orders newest first", () => {
  const storage = createStorage()
  const first = recordExport(artifact(1), "downloaded", {
    storage,
    now: () => 1000,
    createId: () => "record-1",
  })
  const second = recordExport(artifact(2), "shared", {
    storage,
    now: () => 2000,
    createId: () => "record-2",
  })

  assert.equal(first.id, "record-1")
  assert.equal(second.delivery, "shared")
  assert.deepEqual(readExportHistory(storage).map(record => record.id), ["record-2", "record-1"])
  assert.equal(JSON.stringify(readExportHistory(storage)).includes("blob"), false)
})

test("invalid stored records are ignored and history remains bounded", () => {
  const storage = createStorage({
    [EXPORT_HISTORY_KEY]: JSON.stringify([{ id: "", format: "exe" }, null]),
  })
  assert.deepEqual(readExportHistory(storage), [])

  for (let index = 1; index <= 125; index += 1) {
    recordExport(artifact(index), "downloaded", {
      storage,
      now: () => index,
      createId: () => `record-${index}`,
    })
  }
  const records = readExportHistory(storage)
  assert.equal(records.length, 120)
  assert.equal(records[0].id, "record-125")
  assert.equal(records.at(-1).id, "record-6")
})

test("records can be removed individually or cleared", () => {
  const storage = createStorage()
  recordExport(artifact(1), "downloaded", { storage, now: () => 1, createId: () => "one" })
  recordExport(artifact(2), "downloaded", { storage, now: () => 2, createId: () => "two" })

  assert.equal(removeExportRecord("one", storage), true)
  assert.deepEqual(readExportHistory(storage).map(record => record.id), ["two"])
  clearExportHistory(storage)
  assert.deepEqual(readExportHistory(storage), [])
})

test("record status distinguishes current, changed, and missing works", () => {
  const record = {
    id: "record-a",
    entityType: "work",
    entityId: "work-a",
    title: "Story",
    format: "tuuru",
    bytes: 100,
    revision: 10,
    exportedAt: 20,
    delivery: "downloaded",
  }

  assert.equal(exportRecordStatus(record, [{ id: "work-a", updatedAt: 10 }]), "current")
  assert.equal(exportRecordStatus(record, [{ id: "work-a", updatedAt: 11 }]), "changed")
  assert.equal(exportRecordStatus(record, []), "missing")
})
