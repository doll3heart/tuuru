import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  LOCAL_DATABASE_KEY,
  LocalDatabaseError,
  assertLegacyWritesAllowed,
  discardCorruptLocalDatabase,
  inspectLocalDatabase,
  inspectLocalDatabaseRaw,
  parseLocalDatabaseBackup,
  prepareLocalDatabaseRestore,
  readLocalDatabaseBackupFile,
  readLocalDatabase,
  restoreLocalDatabaseBackup,
  serializeLocalDatabaseBackup,
  writeLocalDatabase,
} from "../js/storage.js"

const storageSource = readFileSync(new URL("../js/storage.js", import.meta.url), "utf8")

function createStorage(initialValue = null, options = {}) {
  let value = initialValue
  const calls = { get: 0, set: 0, remove: 0 }
  const events = []

  return {
    calls,
    events,
    get value() { return value },
    getItem() {
      calls.get += 1
      events.push("get")
      if (options.getErrorAt === calls.get) throw options.getError || new Error("read failed")
      if (options.getValues && calls.get <= options.getValues.length) {
        return options.getValues[calls.get - 1]
      }
      if (options.getError) throw options.getError
      return value
    },
    setItem(_key, nextValue) {
      calls.set += 1
      events.push("set")
      if (options.setError) throw options.setError
      value = nextValue
    },
    removeItem() {
      calls.remove += 1
      events.push("remove")
      if (options.removeError) throw options.removeError
      value = null
    },
  }
}

function parsedBackup(database) {
  return parseLocalDatabaseBackup(JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database,
  }))
}

function deeplyNestedDatabaseRaw(depth = 5000) {
  const nested = `${'{"child":'.repeat(depth)}null${"}".repeat(depth)}`
  return `{"works":[{"type":"article","nodes":[],"future":${nested}}],"contacts":[],"groups":[]}`
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

test("deep local work data fails closed and preserves the exact recovery raw value", () => {
  const raw = deeplyNestedDatabaseRaw()
  let status

  assert.doesNotThrow(() => {
    status = inspectLocalDatabaseRaw(raw)
  })
  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-structure")
  assert.equal(status.raw, raw)
  assert.equal(status.issues[0].code, "invalid-nesting")
})

test("deep backup work data reports the stable backup database error", () => {
  const databaseRaw = deeplyNestedDatabaseRaw()
  const raw = `{"format":"tuuru-local-library-backup","backupVersion":1,"exportedAt":"2026-07-11T00:00:00.000Z","database":${databaseRaw}}`

  assert.throws(
    () => parseLocalDatabaseBackup(raw),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-database",
  )
})

test("database key remains a stable public storage contract", () => {
  assert.equal(LOCAL_DATABASE_KEY, "tuuru_works")
})

test("legacy write assertion blocks only a strict enabled reliable-write flag", () => {
  assert.doesNotThrow(() => assertLegacyWritesAllowed({ reliableLocalWrites: false }))
  assert.doesNotThrow(() => assertLegacyWritesAllowed({ reliableLocalWrites: 1 }))
  assert.throws(
    () => assertLegacyWritesAllowed({ reliableLocalWrites: true }),
    error => error instanceof LocalDatabaseError && error.code === "legacy-write-disabled",
  )
})

test("enabled reliable writes stop before a fake storage records any mutation", () => {
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))

  assert.throws(
    () => {
      assertLegacyWritesAllowed({ reliableLocalWrites: true })
      storage.setItem(LOCAL_DATABASE_KEY, "replacement")
      storage.removeItem(LOCAL_DATABASE_KEY)
    },
    error => error instanceof LocalDatabaseError && error.code === "legacy-write-disabled",
  )
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("both legacy database writers call the shared guard before mutating storage", () => {
  const writerSource = storageSource.slice(
    storageSource.indexOf("export function writeLocalDatabase"),
    storageSource.indexOf("function serializeBackupDatabase"),
  )
  const restoreSource = storageSource.slice(
    storageSource.indexOf("export function restoreLocalDatabaseBackup"),
    storageSource.indexOf("export async function readLocalDatabaseBackupFile"),
  )

  for (const [name, source] of [
    ["writeLocalDatabase", writerSource],
    ["restoreLocalDatabaseBackup", restoreSource],
  ]) {
    const guardIndex = source.indexOf("assertLegacyWritesAllowed()")
    const mutationIndexes = [source.indexOf("storage.setItem("), source.indexOf("storage.removeItem(")]
      .filter(index => index >= 0)
    assert.notEqual(guardIndex, -1, `${name} must call the shared legacy-write guard`)
    assert.ok(mutationIndexes.length > 0, `${name} must expose a storage mutation boundary`)
    assert.ok(
      mutationIndexes.every(index => guardIndex < index),
      `${name} must guard before every storage mutation`,
    )
  }
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

test("restore preparation is read-only and creates a valid-library recovery artifact", () => {
  const currentRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(currentRaw)
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [], future: true }),
    storage,
    new Date("2026-07-11T01:00:00.000Z"),
  )

  assert.equal(Object.isFrozen(plan), true)
  assert.equal(plan.expectedCurrentRaw, currentRaw)
  assert.equal(plan.previousState, "valid")
  assert.equal(plan.currentSummary.workCount, 1)
  assert.equal(plan.recoveryArtifact.kind, "library-backup")
  assert.match(plan.recoveryArtifact.filename, /^tuuru-library-before-restore-/)
  assert.deepEqual(JSON.parse(plan.candidateRaw).future, true)
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("restore preparation preserves corrupt raw data as the recovery artifact", () => {
  const storage = createStorage('{"works":[')
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
    new Date("2026-07-11T01:00:00.000Z"),
  )

  assert.equal(plan.previousState, "corrupt")
  assert.equal(plan.recoveryArtifact.kind, "corrupt-raw")
  assert.equal(plan.recoveryArtifact.contents, '{"works":[')
  assert.equal(storage.calls.set, 0)
})

test("a successful restore performs one replacement and exact readback", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw)
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [], future: true }),
    storage,
  )

  const result = restoreLocalDatabaseBackup(plan, storage)

  assert.equal(result.code, "restored")
  assert.equal(result.previousState, "valid")
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
  assert.equal(storage.value, plan.candidateRaw)
  assert.deepEqual(storage.events, ["get", "get", "set", "get"])
})

test("restore from corrupt storage bypasses only the ordinary-write guard", () => {
  const storage = createStorage("not-json")
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(() => writeLocalDatabase({ works: [] }, createStorage("not-json")), LocalDatabaseError)
  assert.equal(restoreLocalDatabaseBackup(plan, storage).code, "restored")
})

test("a stale restore plan performs no write", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const changedRaw = JSON.stringify({ works: [{ id: "other-tab" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { getValues: [oldRaw, changedRaw] })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "backup" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-conflict" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.calls.set, 0)
})

test("quota failure preserves the exact old raw value", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { setError: new Error("quota") })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-write-failed" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.value, oldRaw)
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
})

test("mutable forged restore plans are rejected before storage access", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createStorage(oldRaw)
  const forgedPlan = {
    candidateRaw: JSON.stringify({ works: [{ id: "forged" }], contacts: [], groups: [] }),
    expectedCurrentRaw: oldRaw,
    summary: {},
    previousState: "valid",
  }

  assert.throws(
    () => restoreLocalDatabaseBackup(forgedPlan, storage),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-serialize-failed"
      && error.details.phase === "replace"
      && error.details.commitState === "unchanged",
  )
  assert.deepEqual(storage.events, [])
  assert.deepEqual(storage.calls, { get: 0, set: 0, remove: 0 })
  assert.equal(storage.value, oldRaw)
})

test("frozen forged restore plans are rejected before storage access", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createStorage(oldRaw)
  const forgedPlan = Object.freeze({
    candidateRaw: JSON.stringify({ works: [{ id: "forged" }], contacts: [], groups: [] }),
    expectedCurrentRaw: oldRaw,
    summary: Object.freeze({}),
    previousState: "valid",
  })

  assert.throws(
    () => restoreLocalDatabaseBackup(forgedPlan, storage),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-serialize-failed"
      && error.details.phase === "replace"
      && error.details.commitState === "unchanged",
  )
  assert.deepEqual(storage.events, [])
  assert.deepEqual(storage.calls, { get: 0, set: 0, remove: 0 })
  assert.equal(storage.value, oldRaw)
})

test("registered restore candidates are revalidated before storage access", { concurrency: false }, () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createStorage(oldRaw)
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )
  const originalParse = JSON.parse

  try {
    JSON.parse = () => { throw new Error("forced validation failure") }
    assert.throws(
      () => restoreLocalDatabaseBackup(plan, storage),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-serialize-failed"
        && error.details.phase === "replace"
        && error.details.commitState === "unchanged",
    )
  } finally {
    JSON.parse = originalParse
  }

  assert.deepEqual(storage.events, ["get"])
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
  assert.equal(storage.value, oldRaw)
})

test("restore summaries are derived from the revalidated candidate", () => {
  const backup = parsedBackup({
    works: [{ id: "new-1" }, { id: "new-2" }],
    contacts: [{ id: "contact-1" }],
    groups: [{ id: "group-1" }],
  })
  backup.summary = {
    workCount: 999,
    articleCount: 999,
    phoneCount: 999,
    otherCount: 999,
    contactCount: 999,
    groupCount: 999,
  }
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))
  const plan = prepareLocalDatabaseRestore(backup, storage)
  const expectedSummary = {
    workCount: 2,
    articleCount: 0,
    phoneCount: 0,
    otherCount: 2,
    contactCount: 1,
    groupCount: 1,
  }

  assert.deepEqual(plan.summary, expectedSummary)
  assert.deepEqual(restoreLocalDatabaseBackup(plan, storage).summary, expectedSummary)
})

test("UTF-8 byte measurement failures stop during preparation without writing", { concurrency: false }, () => {
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))
  const cause = new Error("encoder unavailable")
  const OriginalTextEncoder = globalThis.TextEncoder

  try {
    globalThis.TextEncoder = class {
      constructor() { throw cause }
    }
    assert.throws(
      () => prepareLocalDatabaseRestore(
        parsedBackup({ works: [{ id: "作品" }], contacts: [], groups: [] }),
        storage,
      ),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-serialize-failed"
        && error.details.phase === "prepare"
        && error.details.commitState === "unchanged"
        && error.cause === cause,
    )
  } finally {
    globalThis.TextEncoder = OriginalTextEncoder
  }

  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("restore commit returns the prepared UTF-8 byte count without fallible work after verify", { concurrency: false }, () => {
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "作品" }], contacts: [], groups: [] }),
    storage,
  )
  const expectedBytes = new TextEncoder().encode(plan.candidateRaw).length
  const OriginalTextEncoder = globalThis.TextEncoder
  let result

  try {
    globalThis.TextEncoder = class {
      constructor() { throw new Error("commit must not encode") }
    }
    result = restoreLocalDatabaseBackup(plan, storage)
  } finally {
    globalThis.TextEncoder = OriginalTextEncoder
  }

  assert.equal(plan.restoredBytes, expectedBytes)
  assert.equal(result.restoredBytes, expectedBytes)
  assert.deepEqual(storage.events, ["get", "get", "set", "get"])
})

test("invalid and hostile restore times fail with a stable unchanged preparation error", () => {
  const cause = new Error("hostile clock")
  const values = [
    new Date("invalid"),
    { toISOString() { throw cause } },
    { toISOString() { return "not-an-iso-timestamp" } },
  ]

  for (const now of values) {
    const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))
    assert.throws(
      () => prepareLocalDatabaseRestore(
        parsedBackup({ works: [], contacts: [], groups: [] }),
        storage,
        now,
      ),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-serialize-failed"
        && error.details.phase === "prepare"
        && error.details.commitState === "unchanged",
    )
    assert.equal(storage.calls.set, 0)
    assert.equal(storage.calls.remove, 0)
  }
})

test("restore preparation serializes time once and reuses its ISO value", () => {
  const iso = "2026-07-11T01:02:03.004Z"
  let calls = 0
  const now = {
    toISOString() {
      calls += 1
      if (calls > 1) throw new Error("timestamp serialized twice")
      return iso
    },
  }
  const currentRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(currentRaw)

  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
    now,
  )

  assert.equal(calls, 1)
  assert.equal(plan.recoveryArtifact.filename, "tuuru-library-before-restore-2026-07-11T01-02-03-004Z.json")
  assert.equal(JSON.parse(plan.recoveryArtifact.contents).exportedAt, iso)
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("restore reads report preparation and replacement phases before writing", () => {
  const prepareCause = new Error("prepare read failed")
  const prepareStorage = createStorage(null, { getError: prepareCause })
  assert.throws(
    () => prepareLocalDatabaseRestore(
      parsedBackup({ works: [], contacts: [], groups: [] }),
      prepareStorage,
    ),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-readback-failed"
      && error.details.phase === "prepare"
      && error.details.commitState === "unchanged"
      && error.cause === prepareCause,
  )
  assert.equal(prepareStorage.calls.set, 0)

  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const replaceCause = new Error("replace read failed")
  const replaceStorage = createStorage(oldRaw, {
    getValues: [oldRaw],
    getErrorAt: 2,
    getError: replaceCause,
  })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    replaceStorage,
  )
  assert.throws(
    () => restoreLocalDatabaseBackup(plan, replaceStorage),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-readback-failed"
      && error.details.phase === "replace"
      && error.details.commitState === "unchanged"
      && error.cause === replaceCause,
  )
  assert.deepEqual(replaceStorage.events, ["get", "get"])
  assert.equal(replaceStorage.calls.set, 0)
  assert.equal(replaceStorage.calls.remove, 0)
})

test("a readback exception is unknown and never triggers retry or rollback", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const cause = new Error("readback failed")
  const storage = createStorage(oldRaw, {
    getValues: [oldRaw, oldRaw],
    getErrorAt: 3,
    getError: cause,
  })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-readback-failed"
      && error.details.phase === "verify"
      && error.details.commitState === "unknown"
      && error.cause === cause,
  )
  assert.deepEqual(storage.events, ["get", "get", "set", "get"])
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
  assert.equal(storage.value, plan.candidateRaw)
})

test("uncertain readback never reports success or rolls back", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const mismatchedRaw = JSON.stringify({ works: [{ id: "other" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { getValues: [oldRaw, oldRaw, mismatchedRaw] })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-verification-failed" && error.details.commitState === "unknown",
  )
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
})
