import test from "node:test"
import assert from "node:assert/strict"
import {
  installReaderCacheWithRescue,
  isReaderStorageQuotaError,
  readerStorageRescueCandidates,
} from "../reader/reader-storage-rescue.js"

function memoryStorage(entries = [], options = {}) {
  const values = new Map(entries)
  const removals = []
  const writes = []
  return {
    values,
    removals,
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      writes.push(key)
      if (options.failWrite?.(key, value, values)) {
        const error = new Error("quota exceeded")
        error.name = "QuotaExceededError"
        throw error
      }
      values.set(key, value)
    },
    removeItem(key) {
      removals.push(key)
      if (options.failRemove?.(key)) throw new Error("remove blocked")
      values.delete(key)
    },
  }
}

function library() {
  return {
    version:1,
    identities:[],
    books:[
      { id:"current", title:"Current", lastOpenedAt:300 },
      { id:"old-small", title:"Old small", lastOpenedAt:10 },
      { id:"old-large", title:"Old large", lastOpenedAt:10 },
      { id:"recent", title:"Recent", lastOpenedAt:200 },
      { id:"missing", title:"Missing", lastOpenedAt:1 },
    ],
  }
}

test("recognizes browser quota failures without treating security errors as quota", () => {
  assert.equal(isReaderStorageQuotaError({name:"QuotaExceededError"}), true)
  assert.equal(isReaderStorageQuotaError({name:"NS_ERROR_DOM_QUOTA_REACHED"}), true)
  assert.equal(isReaderStorageQuotaError({code:22}), true)
  assert.equal(isReaderStorageQuotaError({name:"SecurityError", code:18}), false)
  assert.equal(isReaderStorageQuotaError(null), false)
})

test("lists cached works from oldest to newest and excludes the incoming work", () => {
  const storage = memoryStorage([
    ["moirain_work_current", "current cache"],
    ["moirain_work_old-small", "small"],
    ["moirain_work_old-large", "a much larger cached work"],
    ["moirain_work_recent", "recent cache"],
  ])
  const result = readerStorageRescueCandidates(storage, library(), {
    excludeWorkId:"current",
    incomingSerialized:"incoming work body that is larger than current",
  })

  assert.deepEqual(result.candidates.map(candidate => candidate.id), [
    "old-large",
    "old-small",
    "recent",
  ])
  assert.equal(result.candidates[0].title, "Old large")
  assert.ok(result.candidates[0].bytes > result.candidates[1].bytes)
  assert.equal(result.incomingBytes > 0, true)
  assert.equal(result.suggestedBytes, result.incomingBytes - new TextEncoder().encode("current cache").byteLength)
  assert.equal(Object.hasOwn(result.candidates[0], "raw"), false)
})

test("clears only selected work bodies and installs the pending cache", () => {
  const storage = memoryStorage([
    ["moirain_work_old-small", "small"],
    ["moirain_work_old-large", "large cache"],
    ["moirain_readerLibrary", "keep library"],
  ])
  const result = installReaderCacheWithRescue(storage, {
    library:library(),
    incomingWorkId:"current",
    incomingSerialized:"new current cache",
    clearWorkIds:["old-small", "old-large"],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.clearedWorkIds, ["old-small", "old-large"])
  assert.equal(storage.values.has("moirain_work_old-small"), false)
  assert.equal(storage.values.has("moirain_work_old-large"), false)
  assert.equal(storage.values.get("moirain_work_current"), "new current cache")
  assert.equal(storage.values.get("moirain_readerLibrary"), "keep library")
})

test("restores every selected cache when the pending cache still cannot be written", () => {
  const originals = [
    ["moirain_work_old-small", "small"],
    ["moirain_work_old-large", "large cache"],
    ["moirain_readerLibrary", "keep library"],
  ]
  const storage = memoryStorage(originals, {
    failWrite:key => key === "moirain_work_current",
  })
  const result = installReaderCacheWithRescue(storage, {
    library:library(),
    incomingWorkId:"current",
    incomingSerialized:"new current cache",
    clearWorkIds:["old-small", "old-large"],
  })

  assert.equal(result.ok, false)
  assert.equal(result.rollbackOk, true)
  assert.equal(result.error.name, "QuotaExceededError")
  originals.forEach(([key, value]) => assert.equal(storage.values.get(key), value))
  assert.equal(storage.values.has("moirain_work_current"), false)
})

test("rejects cleanup ids that do not belong to cached library books", () => {
  const storage = memoryStorage([
    ["moirain_work_old-small", "small"],
    ["moirain_work_not-in-library", "private"],
  ])
  const result = installReaderCacheWithRescue(storage, {
    library:library(),
    incomingWorkId:"current",
    incomingSerialized:"new current cache",
    clearWorkIds:["not-in-library"],
  })

  assert.equal(result.ok, false)
  assert.match(result.error.message, /invalid/i)
  assert.equal(storage.values.get("moirain_work_not-in-library"), "private")
  assert.equal(storage.removals.length, 0)
})
