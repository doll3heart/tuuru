import test from "node:test"
import assert from "node:assert/strict"

import { createKeyedStorage } from "./helpers/keyed-storage.mjs"
import {
  LOCAL_RESTORE_GENERATION_KEY,
  LocalWriteMetadataError,
  clearWorkOwnerIfOwned,
  getWorkOwnerKey,
  isWorkOwnerStale,
  listActiveWorkOwners,
  readRestoreGeneration,
  readWorkOwner,
  writeAndVerifyRestoreGeneration,
  writeAndVerifyWorkOwner,
} from "../js/local-write-metadata.js"

function generationRaw(generationId = "generation-1", changedAt = 100) {
  return JSON.stringify({ version: 1, generationId, changedAt })
}

function ownerRecord({
  workId = "work-1",
  ownerId = "owner-1",
  leaseId = "lease-1",
  heartbeatAt = 100,
} = {}) {
  return {
    version: 1,
    workId,
    ownerId,
    leaseId,
    heartbeatAt,
    expiresAt: heartbeatAt + 60_000,
  }
}

function ownerRaw(input) {
  return JSON.stringify(ownerRecord(input))
}

function mutationCalls(storage) {
  return storage.calls.filter(call => ["setItem", "removeItem", "clear"].includes(call.method))
}

function isProgrammerError(error) {
  return error instanceof TypeError || error instanceof RangeError
}

test("keyed storage follows Web Storage coercion, ordering, and missing-value semantics", () => {
  const storage = createKeyedStorage([[1, 2], ["second", "value"]])

  assert.equal(storage.length, 2)
  assert.equal(storage.getItem("1"), "2")
  assert.equal(storage.getItem("missing"), null)
  assert.equal(storage.key(0), "1")
  assert.equal(storage.key(1), "second")
  assert.equal(storage.key(2), null)

  storage.setItem(1, 3)
  storage.setItem("third", 4)
  assert.deepEqual([...storage.snapshot()], [["1", "3"], ["second", "value"], ["third", "4"]])

  storage.removeItem(1)
  storage.removeItem("missing")
  assert.deepEqual([...storage.snapshot()], [["second", "value"], ["third", "4"]])

  storage.clear()
  assert.equal(storage.length, 0)
  assert.equal(storage.key(0), null)
})

test("keyed storage records ordered calls with coerced keys and values", () => {
  const storage = createKeyedStorage()

  storage.setItem(7, 9)
  storage.getItem(7)
  storage.key(0)
  void storage.length
  storage.removeItem(7)
  storage.clear()

  assert.deepEqual(storage.calls, [
    { method: "setItem", key: "7", value: "9" },
    { method: "getItem", key: "7", value: "9" },
    { method: "key", key: 0, value: "7" },
    { method: "length", key: null, value: 1 },
    { method: "removeItem", key: "7", value: null },
    { method: "clear", key: null, value: null },
  ])
  assert.equal(storage.count("getItem", 7), 1)
  assert.equal(storage.count("setItem", "7"), 1)
})

test("keyed storage supports per-key read, set, and remove failures", () => {
  const readCause = new Error("read denied")
  const setCause = new Error("quota")
  const removeCause = new Error("remove denied")
  const storage = createKeyedStorage(
    [["read", "kept"], ["remove", "kept"]],
    {
      getErrors: new Map([["read", readCause]]),
      setErrors: new Map([["set", setCause]]),
      removeErrors: new Map([["remove", removeCause]]),
    },
  )

  assert.throws(() => storage.getItem("read"), error => error === readCause)
  assert.throws(() => storage.setItem("set", "new"), error => error === setCause)
  assert.throws(() => storage.removeItem("remove"), error => error === removeCause)
  assert.equal(storage.peek("read"), "kept")
  assert.equal(storage.peek("set"), null)
  assert.equal(storage.peek("remove"), "kept")
})

test("keyed storage supports scripted reads and a safe post-set mutation hook", () => {
  const storage = createKeyedStorage(
    [["race", "stored"]],
    {
      getSequences: new Map([["race", ["first", null, new Error("third read failed")]]]),
      afterSet(key, value, controls) {
        if (key === "mutated") controls.set("mutated", `${value}-changed`)
      },
    },
  )

  assert.equal(storage.getItem("race"), "first")
  assert.equal(storage.getItem("race"), null)
  assert.throws(() => storage.getItem("race"), /third read failed/)
  assert.equal(storage.getItem("race"), "stored")

  storage.setItem("mutated", "expected")
  assert.equal(storage.peek("mutated"), "expected-changed")
  assert.equal(storage.count("setItem", "mutated"), 1)
})

test("metadata constants and owner keys are exact and preserve identifier bytes", () => {
  assert.equal(LOCAL_RESTORE_GENERATION_KEY, "tuuru:restore-generation")
  assert.equal(getWorkOwnerKey("work /雪"), "tuuru:work-owner:work%20%2F%E9%9B%AA")
  assert.equal(getWorkOwnerKey(" work "), "tuuru:work-owner:%20work%20")

  for (const invalid of ["", null, undefined, 1, {}]) {
    assert.throws(() => getWorkOwnerKey(invalid), TypeError)
  }
})

test("metadata errors expose stable name, code, cause, and details properties", () => {
  const cause = new Error("cause")
  const details = { key: "key" }
  const error = new LocalWriteMetadataError("message", "test-code", cause, details)

  assert.equal(error.name, "LocalWriteMetadataError")
  assert.equal(error.message, "message")
  assert.equal(error.code, "test-code")
  assert.equal(error.cause, cause)
  assert.equal(error.details, details)
  assert.equal(Object.hasOwn(error, "cause"), true)
  assert.equal(Object.hasOwn(error, "details"), true)
})

test("generation reads distinguish missing data and normalize valid fixed-order records", () => {
  const missingStorage = createKeyedStorage([["unrelated", "keep"]])
  assert.equal(readRestoreGeneration(missingStorage), null)
  assert.deepEqual(missingStorage.calls, [
    { method: "getItem", key: LOCAL_RESTORE_GENERATION_KEY, value: null },
  ])

  const raw = JSON.stringify({ changedAt: 321, generationId: " generation ", version: 1 })
  const storage = createKeyedStorage([[LOCAL_RESTORE_GENERATION_KEY, raw], ["unrelated", "keep"]])
  const record = readRestoreGeneration(storage)

  assert.deepEqual(record, { version: 1, generationId: " generation ", changedAt: 321 })
  assert.deepEqual(Object.keys(record), ["version", "generationId", "changedAt"])
  assert.equal(Object.isFrozen(record), true)
  assert.throws(() => { record.generationId = "changed" }, TypeError)
  assert.deepEqual([...storage.snapshot()], [
    [LOCAL_RESTORE_GENERATION_KEY, raw],
    ["unrelated", "keep"],
  ])
  assert.deepEqual(mutationCalls(storage), [])
})

test("corrupt generation bytes fail closed with their exact key and raw value", () => {
  const invalidRecords = [
    "{",
    "null",
    "[]",
    JSON.stringify({}),
    JSON.stringify({ version: 2, generationId: "generation", changedAt: 1 }),
    JSON.stringify({ version: 1, generationId: "", changedAt: 1 }),
    JSON.stringify({ version: 1, generationId: 7, changedAt: 1 }),
    JSON.stringify({ version: 1, generationId: "generation", changedAt: -1 }),
    JSON.stringify({ version: 1, generationId: "generation", changedAt: 1.5 }),
    JSON.stringify({ version: 1, generationId: "generation", changedAt: Number.MAX_SAFE_INTEGER + 1 }),
    JSON.stringify({ version: 1, generationId: "generation", changedAt: 1, unexpected: true }),
  ]

  for (const raw of invalidRecords) {
    const storage = createKeyedStorage([[LOCAL_RESTORE_GENERATION_KEY, raw], ["unrelated", "keep"]])
    assert.throws(
      () => readRestoreGeneration(storage),
      error => error instanceof LocalWriteMetadataError
        && error.code === "metadata-corrupt"
        && error.details.key === LOCAL_RESTORE_GENERATION_KEY
        && error.details.raw === raw,
    )
    assert.deepEqual(mutationCalls(storage), [])
    assert.equal(storage.peek("unrelated"), "keep")
  }
})

test("generation read failures preserve the original cause without mutation", () => {
  const cause = new Error("storage denied")
  const storage = createKeyedStorage([], {
    getErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, cause]]),
  })

  assert.throws(
    () => readRestoreGeneration(storage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-read-failed"
      && error.cause === cause
      && error.details.key === LOCAL_RESTORE_GENERATION_KEY,
  )
  assert.equal(storage.count("getItem", LOCAL_RESTORE_GENERATION_KEY), 1)
  assert.deepEqual(mutationCalls(storage), [])
})

test("generation writes use deterministic compact bytes and one exact readback", () => {
  const storage = createKeyedStorage([["unrelated", "keep"]])
  const input = { changedAt: 456, ignored: true, generationId: "generation-2", version: 1 }

  const record = writeAndVerifyRestoreGeneration(input, storage)
  const expectedRaw = '{"version":1,"generationId":"generation-2","changedAt":456}'

  assert.deepEqual(record, { version: 1, generationId: "generation-2", changedAt: 456 })
  assert.equal(Object.isFrozen(record), true)
  assert.equal(storage.peek(LOCAL_RESTORE_GENERATION_KEY), expectedRaw)
  assert.equal(storage.peek("unrelated"), "keep")
  assert.deepEqual(storage.calls, [
    { method: "setItem", key: LOCAL_RESTORE_GENERATION_KEY, value: expectedRaw },
    { method: "getItem", key: LOCAL_RESTORE_GENERATION_KEY, value: expectedRaw },
  ])
})

test("invalid generation write arguments fail before storage access", () => {
  const invalidInputs = [
    null,
    {},
    { generationId: "", changedAt: 1 },
    { generationId: 1, changedAt: 1 },
    { generationId: "generation", changedAt: "1" },
    { generationId: "generation", changedAt: -1 },
    { generationId: "generation", changedAt: Number.MAX_SAFE_INTEGER + 1 },
    { version: 2, generationId: "generation", changedAt: 1 },
    { version: undefined, generationId: "generation", changedAt: 1 },
  ]

  for (const input of invalidInputs) {
    const storage = createKeyedStorage()
    assert.throws(() => writeAndVerifyRestoreGeneration(input, storage), isProgrammerError)
    assert.deepEqual(storage.calls, [])
  }
})

test("generation set failures preserve cause and never read, retry, or remove", () => {
  const cause = new Error("quota")
  const storage = createKeyedStorage([["unrelated", "keep"]], {
    setErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, cause]]),
  })

  assert.throws(
    () => writeAndVerifyRestoreGeneration({ generationId: "generation", changedAt: 1 }, storage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-write-failed"
      && error.cause === cause,
  )
  assert.equal(storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 1)
  assert.equal(storage.count("getItem", LOCAL_RESTORE_GENERATION_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
  assert.equal(storage.peek("unrelated"), "keep")
})

test("generation readback failures preserve cause and never retry or roll back", () => {
  const cause = new Error("readback denied")
  const storage = createKeyedStorage([["unrelated", "keep"]], {
    getErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, cause]]),
  })

  assert.throws(
    () => writeAndVerifyRestoreGeneration({ generationId: "generation", changedAt: 1 }, storage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-readback-failed"
      && error.cause === cause,
  )
  assert.equal(storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 1)
  assert.equal(storage.count("getItem", LOCAL_RESTORE_GENERATION_KEY), 1)
  assert.equal(storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
  assert.equal(storage.peek("unrelated"), "keep")
})

test("generation missing, mismatched, and corrupt readbacks report exact uncertain state", () => {
  const expectedRaw = generationRaw("generation", 1)
  const cases = [
    { actualRaw: null, mutate: controls => controls.remove(LOCAL_RESTORE_GENERATION_KEY) },
    { actualRaw: generationRaw("other", 2), mutate: controls => controls.set(LOCAL_RESTORE_GENERATION_KEY, generationRaw("other", 2)) },
    { actualRaw: "{", mutate: controls => controls.set(LOCAL_RESTORE_GENERATION_KEY, "{") },
  ]

  for (const { actualRaw, mutate } of cases) {
    const storage = createKeyedStorage([["unrelated", "keep"]], {
      afterSet(key, _value, controls) {
        if (key === LOCAL_RESTORE_GENERATION_KEY) mutate(controls)
      },
    })
    assert.throws(
      () => writeAndVerifyRestoreGeneration({ generationId: "generation", changedAt: 1 }, storage),
      error => error instanceof LocalWriteMetadataError
        && error.code === "metadata-verification-failed"
        && error.details.key === LOCAL_RESTORE_GENERATION_KEY
        && error.details.expectedRaw === expectedRaw
        && error.details.actualRaw === actualRaw,
    )
    assert.equal(storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 1)
    assert.equal(storage.count("getItem", LOCAL_RESTORE_GENERATION_KEY), 1)
    assert.equal(storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
    assert.equal(storage.peek("unrelated"), "keep")
  }
})

test("owner reads distinguish missing data and return frozen fixed-order records", () => {
  const workId = "work /雪"
  const key = getWorkOwnerKey(workId)
  const raw = JSON.stringify({
    expiresAt: 60_777,
    leaseId: " lease ",
    ownerId: " owner ",
    heartbeatAt: 777,
    workId,
    version: 1,
  })
  const storage = createKeyedStorage([[key, raw], ["unrelated", "keep"]])

  assert.equal(readWorkOwner("missing", storage), null)
  const record = readWorkOwner(workId, storage)

  assert.deepEqual(record, {
    version: 1,
    workId,
    ownerId: " owner ",
    leaseId: " lease ",
    heartbeatAt: 777,
    expiresAt: 60_777,
  })
  assert.deepEqual(Object.keys(record), [
    "version", "workId", "ownerId", "leaseId", "heartbeatAt", "expiresAt",
  ])
  assert.equal(Object.isFrozen(record), true)
  assert.throws(() => { record.leaseId = "changed" }, TypeError)
  assert.deepEqual(mutationCalls(storage), [])
  assert.equal(storage.peek("unrelated"), "keep")
})

test("owner reads reject invalid records, expiry mismatches, and exact key mismatches", () => {
  const workId = "work-a"
  const key = getWorkOwnerKey(workId)
  const invalidRecords = [
    "{",
    "null",
    "[]",
    JSON.stringify({}),
    ownerRaw({ workId: "work-b" }),
    JSON.stringify({ ...ownerRecord({ workId }), expiresAt: 60_101 }),
    JSON.stringify({ ...ownerRecord({ workId }), ownerId: "" }),
    JSON.stringify({ ...ownerRecord({ workId }), leaseId: 1 }),
    JSON.stringify({ ...ownerRecord({ workId }), heartbeatAt: -1, expiresAt: 59_999 }),
    JSON.stringify({ ...ownerRecord({ workId }), version: 2 }),
    JSON.stringify({ ...ownerRecord({ workId }), unexpected: true }),
  ]

  for (const raw of invalidRecords) {
    const storage = createKeyedStorage([[key, raw], ["unrelated", "keep"]])
    assert.throws(
      () => readWorkOwner(workId, storage),
      error => error instanceof LocalWriteMetadataError
        && error.code === "metadata-corrupt"
        && error.details.key === key
        && error.details.raw === raw,
    )
    assert.deepEqual(mutationCalls(storage), [])
    assert.equal(storage.peek("unrelated"), "keep")
  }
})

test("owner read failures preserve their original cause", () => {
  const key = getWorkOwnerKey("work")
  const cause = new Error("denied")
  const storage = createKeyedStorage([], { getErrors: new Map([[key, cause]]) })

  assert.throws(
    () => readWorkOwner("work", storage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-read-failed"
      && error.cause === cause
      && error.details.key === key,
  )
  assert.equal(storage.count("getItem", key), 1)
  assert.deepEqual(mutationCalls(storage), [])
})

test("owner writes compute expiry and serialize exact fixed-order bytes", () => {
  const input = {
    heartbeatAt: 1_000,
    ignored: true,
    leaseId: "lease",
    ownerId: "owner",
    workId: "work",
    version: 1,
    expiresAt: 61_000,
  }
  const storage = createKeyedStorage([["unrelated", "keep"]])
  const record = writeAndVerifyWorkOwner(input, storage)
  const key = getWorkOwnerKey("work")
  const expectedRaw = '{"version":1,"workId":"work","ownerId":"owner","leaseId":"lease","heartbeatAt":1000,"expiresAt":61000}'

  assert.deepEqual(record, ownerRecord({ workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1_000 }))
  assert.equal(Object.isFrozen(record), true)
  assert.equal(storage.peek(key), expectedRaw)
  assert.equal(storage.peek("unrelated"), "keep")
  assert.deepEqual(storage.calls, [
    { method: "setItem", key, value: expectedRaw },
    { method: "getItem", key, value: expectedRaw },
  ])
})

test("owner writes reject mismatched or overflowing expiry before storage access", () => {
  const cases = [
    { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1, expiresAt: 60_002 },
    { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: Number.MAX_SAFE_INTEGER - 59_999 },
  ]

  for (const input of cases) {
    const storage = createKeyedStorage()
    assert.throws(() => writeAndVerifyWorkOwner(input, storage), RangeError)
    assert.deepEqual(storage.calls, [])
  }
})

test("invalid owner write arguments fail before storage access", () => {
  const valid = { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1 }
  const cases = [
    null,
    {},
    { ...valid, workId: "" },
    { ...valid, ownerId: 1 },
    { ...valid, leaseId: "" },
    { ...valid, heartbeatAt: "1" },
    { ...valid, heartbeatAt: -1 },
    { ...valid, version: 2 },
    { ...valid, version: undefined },
    { ...valid, expiresAt: "60001" },
  ]

  for (const input of cases) {
    const storage = createKeyedStorage()
    assert.throws(() => writeAndVerifyWorkOwner(input, storage), isProgrammerError)
    assert.deepEqual(storage.calls, [])
  }
})

test("owner write failures and uncertain readbacks never retry or remove", () => {
  const input = { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1 }
  const key = getWorkOwnerKey(input.workId)
  const setCause = new Error("quota")
  const setStorage = createKeyedStorage([], { setErrors: new Map([[key, setCause]]) })

  assert.throws(
    () => writeAndVerifyWorkOwner(input, setStorage),
    error => error.code === "metadata-write-failed" && error.cause === setCause,
  )
  assert.equal(setStorage.count("setItem", key), 1)
  assert.equal(setStorage.count("getItem", key), 0)
  assert.equal(setStorage.count("removeItem", key), 0)

  const readCause = new Error("readback")
  const readStorage = createKeyedStorage([], { getErrors: new Map([[key, readCause]]) })
  assert.throws(
    () => writeAndVerifyWorkOwner(input, readStorage),
    error => error.code === "metadata-readback-failed" && error.cause === readCause,
  )
  assert.equal(readStorage.count("setItem", key), 1)
  assert.equal(readStorage.count("getItem", key), 1)
  assert.equal(readStorage.count("removeItem", key), 0)

  const mismatchStorage = createKeyedStorage([], {
    afterSet(_key, _value, controls) { controls.set(key, "{") },
  })
  assert.throws(
    () => writeAndVerifyWorkOwner(input, mismatchStorage),
    error => error.code === "metadata-verification-failed"
      && error.details.actualRaw === "{",
  )
  assert.equal(mismatchStorage.count("setItem", key), 1)
  assert.equal(mismatchStorage.count("getItem", key), 1)
  assert.equal(mismatchStorage.count("removeItem", key), 0)
})

test("conditional owner clear removes and verifies only an exact owner and lease match", () => {
  const input = { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1 }
  const key = getWorkOwnerKey(input.workId)
  const raw = ownerRaw(input)
  const storage = createKeyedStorage([[key, raw], ["unrelated", "keep"]])

  assert.equal(clearWorkOwnerIfOwned("work", "owner", "lease", storage), true)
  assert.equal(storage.peek(key), null)
  assert.equal(storage.peek("unrelated"), "keep")
  assert.deepEqual(storage.calls, [
    { method: "getItem", key, value: raw },
    { method: "removeItem", key, value: null },
    { method: "getItem", key, value: null },
  ])
})

test("conditional owner clear leaves missing and nonmatching ownership untouched", () => {
  const key = getWorkOwnerKey("work")
  const raw = ownerRaw({ workId: "work", ownerId: "other-owner", leaseId: "other-lease" })
  const cases = [
    createKeyedStorage([["unrelated", "keep"]]),
    createKeyedStorage([[key, raw], ["unrelated", "keep"]]),
  ]

  assert.equal(clearWorkOwnerIfOwned("work", "owner", "lease", cases[0]), false)
  assert.equal(clearWorkOwnerIfOwned("work", "owner", "lease", cases[1]), false)

  for (const storage of cases) {
    assert.equal(storage.count("getItem", key), 1)
    assert.equal(storage.count("removeItem", key), 0)
    assert.equal(storage.peek("unrelated"), "keep")
  }
  assert.equal(cases[1].peek(key), raw)
})

test("conditional owner clear validates identifiers and corrupt bytes before removal", () => {
  const key = getWorkOwnerKey("work")
  const storage = createKeyedStorage([[key, "{"], ["unrelated", "keep"]])

  assert.throws(
    () => clearWorkOwnerIfOwned("work", "owner", "lease", storage),
    error => error.code === "metadata-corrupt",
  )
  assert.equal(storage.count("removeItem", key), 0)
  assert.equal(storage.peek(key), "{")

  const untouched = createKeyedStorage([[key, ownerRaw({ workId: "work" })]])
  assert.throws(() => clearWorkOwnerIfOwned("", "owner", "lease", untouched), TypeError)
  assert.throws(() => clearWorkOwnerIfOwned("work", "", "lease", untouched), TypeError)
  assert.throws(() => clearWorkOwnerIfOwned("work", "owner", "", untouched), TypeError)
  assert.deepEqual(untouched.calls, [])
})

test("conditional owner clear wraps remove failures without retry or readback", () => {
  const input = { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1 }
  const key = getWorkOwnerKey(input.workId)
  const raw = ownerRaw(input)
  const cause = new Error("remove denied")
  const storage = createKeyedStorage([[key, raw], ["unrelated", "keep"]], {
    removeErrors: new Map([[key, cause]]),
  })

  assert.throws(
    () => clearWorkOwnerIfOwned("work", "owner", "lease", storage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-remove-failed"
      && error.cause === cause,
  )
  assert.equal(storage.count("getItem", key), 1)
  assert.equal(storage.count("removeItem", key), 1)
  assert.equal(storage.peek(key), raw)
  assert.equal(storage.peek("unrelated"), "keep")
})

test("conditional owner clear treats readback failure or a surviving value as uncertain", () => {
  const input = { workId: "work", ownerId: "owner", leaseId: "lease", heartbeatAt: 1 }
  const key = getWorkOwnerKey(input.workId)
  const raw = ownerRaw(input)
  const cause = new Error("readback denied")
  const failedReadStorage = createKeyedStorage([[key, raw]], {
    getSequences: new Map([[key, [raw, cause]]]),
  })

  assert.throws(
    () => clearWorkOwnerIfOwned("work", "owner", "lease", failedReadStorage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-clear-verification-failed"
      && error.cause === cause,
  )
  assert.equal(failedReadStorage.count("getItem", key), 2)
  assert.equal(failedReadStorage.count("removeItem", key), 1)

  const survivingStorage = createKeyedStorage([[key, raw]], {
    getSequences: new Map([[key, [raw, raw]]]),
  })
  assert.throws(
    () => clearWorkOwnerIfOwned("work", "owner", "lease", survivingStorage),
    error => error instanceof LocalWriteMetadataError
      && error.code === "metadata-clear-verification-failed"
      && error.details.key === key
      && error.details.actualRaw === raw,
  )
  assert.equal(survivingStorage.count("getItem", key), 2)
  assert.equal(survivingStorage.count("removeItem", key), 1)
})

test("work owner staleness uses the boundary and requires both elapsed conditions", () => {
  const record = Object.freeze(ownerRecord({ heartbeatAt: 1_000 }))

  assert.equal(isWorkOwnerStale(record, 60_999), false)
  assert.equal(isWorkOwnerStale(record, 61_000), true)
  assert.equal(isWorkOwnerStale(record, 999), false)
  assert.equal(isWorkOwnerStale(record, 31_000, 30_000), false)
  assert.equal(isWorkOwnerStale(record, 61_000, 70_000), false)
  assert.equal(isWorkOwnerStale(record, 71_000, 70_000), true)
})

test("work owner staleness rejects invalid programmer inputs", () => {
  const valid = ownerRecord()

  assert.throws(() => isWorkOwnerStale({ ...valid, expiresAt: valid.expiresAt + 1 }, 100_000), RangeError)
  assert.throws(() => isWorkOwnerStale(valid, -1), RangeError)
  assert.throws(() => isWorkOwnerStale(valid, 1.5), RangeError)
  assert.throws(() => isWorkOwnerStale(valid, 100_000, -1), RangeError)
  assert.throws(() => isWorkOwnerStale(valid, 100_000, "60000"), TypeError)
})

test("active owner enumeration snapshots keys, ignores unrelated data, and sorts deterministically", () => {
  const now = 200_000
  const activeB = ownerRecord({ workId: "work-b", ownerId: "owner-b", leaseId: "lease-b", heartbeatAt: 150_000 })
  const activeA = ownerRecord({ workId: "work-a", ownerId: "owner-a", leaseId: "lease-a", heartbeatAt: 150_000 })
  const stale = ownerRecord({ workId: "work-c", ownerId: "owner-c", leaseId: "lease-c", heartbeatAt: 100_000 })
  const entries = [
    ["unrelated:first", "keep-first"],
    [getWorkOwnerKey(activeB.workId), JSON.stringify(activeB)],
    [getWorkOwnerKey(stale.workId), JSON.stringify(stale)],
    ["tuuru:work-ownerish:not-a-match", "keep-second"],
    [getWorkOwnerKey(activeA.workId), JSON.stringify(activeA)],
  ]
  const storage = createKeyedStorage(entries)

  const records = listActiveWorkOwners(storage, now)

  assert.deepEqual(records, [activeA, activeB])
  assert.equal(records.every(Object.isFrozen), true)
  assert.deepEqual(
    storage.calls.filter(call => call.method === "key").map(call => call.key),
    [0, 1, 2, 3, 4],
  )
  assert.deepEqual(
    storage.calls.filter(call => call.method === "getItem").map(call => call.key),
    [getWorkOwnerKey("work-a"), getWorkOwnerKey("work-b"), getWorkOwnerKey("work-c")],
  )
  assert.deepEqual([...storage.snapshot()], entries)
  assert.deepEqual(mutationCalls(storage), [])
})

test("active owner enumeration skips matching keys that disappear before reading", () => {
  const record = ownerRecord({ workId: "work" })
  const key = getWorkOwnerKey(record.workId)
  const storage = createKeyedStorage([[key, JSON.stringify(record)], ["unrelated", "keep"]], {
    getSequences: new Map([[key, [null]]]),
  })

  assert.deepEqual(listActiveWorkOwners(storage, 100), [])
  assert.equal(storage.count("getItem", key), 1)
  assert.equal(storage.peek("unrelated"), "keep")
  assert.deepEqual(mutationCalls(storage), [])
})

test("active owner enumeration fails closed for corrupt or noncanonical matching keys", () => {
  const corruptKey = getWorkOwnerKey("work")
  const corruptStorage = createKeyedStorage([[corruptKey, "{"], ["unrelated", "keep"]])
  assert.throws(
    () => listActiveWorkOwners(corruptStorage, 100),
    error => error.code === "metadata-corrupt"
      && error.details.key === corruptKey
      && error.details.raw === "{",
  )
  assert.equal(corruptStorage.peek("unrelated"), "keep")
  assert.deepEqual(mutationCalls(corruptStorage), [])

  const noncanonicalKey = "tuuru:work-owner:%77ork"
  const noncanonicalRaw = ownerRaw({ workId: "work" })
  const noncanonicalStorage = createKeyedStorage([[noncanonicalKey, noncanonicalRaw]])
  assert.throws(
    () => listActiveWorkOwners(noncanonicalStorage, 100),
    error => error.code === "metadata-corrupt" && error.details.key === noncanonicalKey,
  )
})

test("active owner enumeration wraps length, key, and matching read failures", () => {
  const lengthCause = new Error("length denied")
  const lengthStorage = createKeyedStorage([], { lengthError: lengthCause })
  assert.throws(
    () => listActiveWorkOwners(lengthStorage, 100),
    error => error.code === "metadata-read-failed" && error.cause === lengthCause,
  )

  const keyCause = new Error("key denied")
  const keyStorage = createKeyedStorage([["unrelated", "keep"]], {
    keyErrors: new Map([[0, keyCause]]),
  })
  assert.throws(
    () => listActiveWorkOwners(keyStorage, 100),
    error => error.code === "metadata-read-failed" && error.cause === keyCause,
  )

  const record = ownerRecord({ workId: "work" })
  const key = getWorkOwnerKey(record.workId)
  const readCause = new Error("read denied")
  const readStorage = createKeyedStorage([[key, JSON.stringify(record)], ["unrelated", "keep"]], {
    getErrors: new Map([[key, readCause]]),
  })
  assert.throws(
    () => listActiveWorkOwners(readStorage, 100),
    error => error.code === "metadata-read-failed"
      && error.cause === readCause
      && error.details.key === key,
  )
  assert.equal(readStorage.peek("unrelated"), "keep")
  assert.deepEqual(mutationCalls(readStorage), [])
})
