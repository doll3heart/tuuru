import test from "node:test"
import assert from "node:assert/strict"

import {
  LocalDatabaseError,
  discardCorruptLocalDatabase,
  inspectLocalDatabase,
  readLocalDatabase,
  writeLocalDatabase,
} from "../js/storage.js"

function createStorage(initialValue = null, options = {}) {
  let value = initialValue
  const calls = { get: 0, set: 0, remove: 0 }

  return {
    calls,
    get value() { return value },
    getItem() {
      calls.get += 1
      if (options.getError) throw options.getError
      return value
    },
    setItem(_key, nextValue) {
      calls.set += 1
      if (options.setError) throw options.setError
      value = nextValue
    },
    removeItem() {
      calls.remove += 1
      if (options.removeError) throw options.removeError
      value = null
    },
  }
}

test("a missing database starts empty without writing", () => {
  const storage = createStorage()

  assert.deepEqual(readLocalDatabase(storage), { works: [], contacts: [], groups: [] })
  assert.equal(storage.calls.set, 0)
})

test("legacy valid data receives in-memory defaults without being rewritten", () => {
  const raw = JSON.stringify({ works: [{ id: "work-1" }], futureField: true })
  const storage = createStorage(raw)

  assert.deepEqual(readLocalDatabase(storage), {
    works: [{ id: "work-1" }],
    contacts: [],
    groups: [],
    futureField: true,
  })
  assert.equal(storage.value, raw)
  assert.equal(storage.calls.set, 0)
})

test("invalid JSON is preserved and blocks every write", () => {
  const raw = '{"works":['
  const storage = createStorage(raw)
  const status = inspectLocalDatabase(storage)

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-json")
  assert.equal(status.raw, raw)
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.throws(() => writeLocalDatabase({ works: [] }, storage), LocalDatabaseError)
  assert.equal(storage.value, raw)
  assert.equal(storage.calls.set, 0)
})

for (const value of [null, [], "text", {}, { works: {} }]) {
  test(`invalid database structure is rejected: ${JSON.stringify(value)}`, () => {
    const storage = createStorage(JSON.stringify(value))
    const status = inspectLocalDatabase(storage)

    assert.equal(status.ok, false)
    assert.equal(status.code, "invalid-structure")
    assert.equal(storage.calls.set, 0)
  })
}

test("invalid outgoing data is never written", () => {
  const storage = createStorage(JSON.stringify({ works: [] }))

  assert.throws(
    () => writeLocalDatabase({ works: {} }, storage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-write",
  )
  assert.equal(storage.calls.set, 0)
})

test("write failures are wrapped without replacing the previous value", () => {
  const raw = JSON.stringify({ works: [] })
  const storage = createStorage(raw, { setError: new Error("quota exceeded") })

  assert.throws(
    () => writeLocalDatabase({ works: [{ id: "new" }] }, storage),
    error => error instanceof LocalDatabaseError && error.code === "write-failed",
  )
  assert.equal(storage.value, raw)
})

test("unavailable storage blocks reads, writes, and destructive reset", () => {
  const storage = createStorage(null, { getError: new Error("denied") })

  assert.equal(inspectLocalDatabase(storage).code, "storage-unavailable")
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.throws(() => writeLocalDatabase({ works: [] }, storage), LocalDatabaseError)
  assert.throws(
    () => discardCorruptLocalDatabase(storage),
    error => error instanceof LocalDatabaseError && error.code === "storage-unavailable",
  )
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("only a confirmed corrupt database can be discarded", () => {
  const corruptStorage = createStorage("not-json")
  discardCorruptLocalDatabase(corruptStorage)
  assert.equal(corruptStorage.value, null)

  const validStorage = createStorage(JSON.stringify({ works: [] }))
  assert.throws(
    () => discardCorruptLocalDatabase(validStorage),
    error => error instanceof LocalDatabaseError && error.code === "database-valid",
  )
  assert.equal(validStorage.calls.remove, 0)
})
