import test from "node:test"
import assert from "node:assert/strict"

import {
  LOCAL_DATABASE_KEY,
  LocalDatabaseError,
  discardCorruptLocalDatabase,
  inspectLocalDatabase,
  inspectLocalDatabaseRaw,
  parseLocalDatabaseBackup,
  readLocalDatabaseBackupFile,
  readLocalDatabase,
  serializeLocalDatabaseBackup,
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

test("raw inspection normalizes missing legacy collections without writing", () => {
  const raw = JSON.stringify({
    works: [{ type: "article", nodes: [{ id: "start" }], future: true }],
    futureDatabaseField: { enabled: true },
  })

  const status = inspectLocalDatabaseRaw(raw)

  assert.equal(status.ok, true)
  assert.deepEqual(status.data.contacts, [])
  assert.deepEqual(status.data.groups, [])
  assert.deepEqual(status.data.works[0].nodes[0].choices, [])
  assert.deepEqual(status.data.futureDatabaseField, { enabled: true })
  assert.equal(status.raw, raw)
})

test("known nested corruption fails closed and preserves exact raw data", () => {
  const raw = JSON.stringify({
    works: [{ type: "phone", phoneData: { contacts: [null] } }],
    contacts: [],
    groups: [],
  })
  const storage = createStorage(raw)

  const status = inspectLocalDatabase(storage)

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-structure")
  assert.equal(status.raw, raw)
  assert.equal(status.issues[0].path, "$.works[0].phoneData.contacts[0]")
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.equal(storage.calls.set, 0)
})

test("present wrong-typed top-level collections are never defaulted away", () => {
  for (const database of [
    { works: [], contacts: null, groups: [] },
    { works: [], contacts: [], groups: "bad" },
    { works: [], contacts: [null], groups: [] },
  ]) {
    const status = inspectLocalDatabaseRaw(JSON.stringify(database))
    assert.equal(status.ok, false)
    assert.equal(status.code, "invalid-structure")
  }
})

test("invalid outgoing nested data never reaches setItem", () => {
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))

  assert.throws(
    () => writeLocalDatabase({
      works: [{ type: "article", nodes: [{ choices: [null] }] }],
      contacts: [],
      groups: [],
    }, storage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-write",
  )
  assert.equal(storage.calls.set, 0)
})

test("backup parsing and local inspection share nested work validation", () => {
  const database = {
    works: [{ type: "article", nodes: [{ choices: null }] }],
    contacts: [],
    groups: [],
  }
  const envelope = {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database,
  }

  assert.equal(inspectLocalDatabaseRaw(JSON.stringify(database)).code, "invalid-structure")
  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify(envelope)),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-database",
  )
})

test("database key remains a stable public storage contract", () => {
  assert.equal(LOCAL_DATABASE_KEY, "tuuru_works")
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

test("a full library backup has a versioned envelope without writing", () => {
  const exportedAt = new Date("2026-07-10T05:30:00.000Z")
  const storage = createStorage()

  const backup = JSON.parse(serializeLocalDatabaseBackup(storage, exportedAt))

  assert.deepEqual(backup, {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  })
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("a full library backup preserves private editor and future fields", () => {
  const database = {
    works: [{
      id: "work-1",
      password: "private",
      editorSettings: { fontSize: 18 },
      phoneData: { apps: [{ type: "settings" }, { type: "customize" }] },
    }],
    contacts: [{ id: "contact-1" }],
    groups: [{ id: "group-1" }],
    futureField: { enabled: true },
  }
  const storage = createStorage(JSON.stringify(database))

  const backup = JSON.parse(serializeLocalDatabaseBackup(
    storage,
    new Date("2026-07-10T05:30:00.000Z"),
  ))

  assert.deepEqual(backup.database, database)
  assert.equal(storage.calls.set, 0)
})

test("a full library backup refuses corrupt or unavailable storage", () => {
  const corruptStorage = createStorage("not-json")
  const unavailableStorage = createStorage(null, { getError: new Error("denied") })

  assert.throws(
    () => serializeLocalDatabaseBackup(corruptStorage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-json",
  )
  assert.throws(
    () => serializeLocalDatabaseBackup(unavailableStorage),
    error => error instanceof LocalDatabaseError && error.code === "storage-unavailable",
  )
  assert.equal(corruptStorage.calls.set, 0)
  assert.equal(unavailableStorage.calls.set, 0)
})

test("a full library backup can be parsed into a read-only summary", () => {
  const database = {
    works: [
      { id: "article-1", type: "article", nodes: [] },
      { id: "phone-1", type: "phone", phoneData: {} },
      { id: "legacy-1" },
    ],
    contacts: [{ id: "contact-1" }],
    groups: [{ id: "group-1" }, { id: "group-2" }],
    futureField: true,
  }
  const raw = serializeLocalDatabaseBackup(
    createStorage(JSON.stringify(database)),
    new Date("2026-07-10T05:30:00.000Z"),
  )

  const parsed = parseLocalDatabaseBackup("\uFEFF" + raw)

  assert.equal(parsed.exportedAt, "2026-07-10T05:30:00.000Z")
  assert.deepEqual(parsed.database, JSON.parse(raw).database)
  assert.deepEqual(parsed.summary, {
    workCount: 3,
    articleCount: 1,
    phoneCount: 1,
    otherCount: 1,
    contactCount: 1,
    groupCount: 2,
  })
})

test("backup parsing rejects invalid input and malformed JSON", () => {
  assert.throws(
    () => parseLocalDatabaseBackup(null),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-input",
  )
  assert.throws(
    () => parseLocalDatabaseBackup("{not-json"),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-json",
  )
  for (const value of ["null", "[]", '"backup"']) {
    assert.throws(
      () => parseLocalDatabaseBackup(value),
      error => error instanceof LocalDatabaseError && error.code === "invalid-backup-structure",
    )
  }
})

test("backup parsing distinguishes unrelated and newer backup formats", () => {
  const base = {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  }

  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify({ ...base, format: "other-format" })),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-format",
  )
  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify({ ...base, backupVersion: 2 })),
    error => error instanceof LocalDatabaseError && error.code === "backup-version-newer",
  )
  for (const backupVersion of [undefined, "1", 1.5, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => parseLocalDatabaseBackup(JSON.stringify({ ...base, backupVersion })),
      error => error instanceof LocalDatabaseError && error.code === "invalid-backup-version",
    )
  }
})

test("backup parsing rejects invalid dates and database collections", () => {
  const base = {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  }

  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify({ ...base, exportedAt: "yesterday" })),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-date",
  )
  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify({ ...base, exportedAt: "2026-07-10T05:30:00+00:00" })),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-date",
  )
  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify({ ...base, database: { works: [], contacts: {} } })),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-database",
  )

  for (const database of [
    { works: [null], contacts: [], groups: [] },
    { works: [], contacts: [null], groups: [] },
    { works: [], contacts: [], groups: ["bad"] },
  ]) {
    assert.throws(
      () => parseLocalDatabaseBackup(JSON.stringify({ ...base, database })),
      error => error instanceof LocalDatabaseError && error.code === "invalid-backup-database",
    )
  }
})

test("backup file reading accepts valid content without relying on MIME type", async () => {
  const raw = JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  })
  const file = {
    name: "backup.json",
    size: raw.length,
    type: "",
    async text() { return raw },
  }

  const parsed = await readLocalDatabaseBackupFile(file)

  assert.equal(parsed.summary.workCount, 0)
})

test("empty and oversized backup files are rejected before reading", async () => {
  let readCount = 0
  const text = async () => { readCount += 1; return "{}" }

  await assert.rejects(
    readLocalDatabaseBackupFile({ size: 0, text }),
    error => error instanceof LocalDatabaseError && error.code === "empty-backup-file",
  )
  await assert.rejects(
    readLocalDatabaseBackupFile({ size: 25 * 1024 * 1024 + 1, text }),
    error => error instanceof LocalDatabaseError && error.code === "backup-file-too-large",
  )
  assert.equal(readCount, 0)
})

test("backup file read failures use a stable local error", async () => {
  const cause = new Error("permission revoked")

  await assert.rejects(
    readLocalDatabaseBackupFile({
      size: 10,
      async text() { throw cause },
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "backup-file-unreadable"
      && error.cause === cause,
  )
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
