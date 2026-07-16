import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

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
  serializeLocalDatabaseBackupFromDatabase,
  serializeLocalDatabaseBackup,
  serializeValidatedLocalDatabase,
  validateLocalDatabase,
  writeLocalDatabase,
} from "../js/storage.js"

const storageSource = readFileSync(new URL("../js/storage.js", import.meta.url), "utf8")
const UNRELATED_KEY = "unrelated:key"
const UNRELATED_VALUE = "keep"

function javascriptDataUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`
}

let reliableWriteStorageModule

function loadStorageWithReliableWrites() {
  if (reliableWriteStorageModule) return reliableWriteStorageModule

  const workSchemaSpecifier = '"./work-schema.js"'
  const featureFlagsSpecifier = '"./feature-flags.js"'
  const localLocksSpecifier = '"./local-locks.js"'
  const localWriteMetadataSpecifier = '"./local-write-metadata.js"'
  assert.equal(storageSource.split(workSchemaSpecifier).length - 1, 1)
  assert.equal(storageSource.split(featureFlagsSpecifier).length - 1, 1)
  assert.equal(storageSource.split(localLocksSpecifier).length - 1, 1)
  assert.equal(storageSource.split(localWriteMetadataSpecifier).length - 1, 1)

  const enabledFeatureFlagsUrl = javascriptDataUrl(`
    export const FEATURE_FLAGS = Object.freeze({ reliableLocalWrites: true })

    export function featureEnabled(name, flags = FEATURE_FLAGS) {
      return flags?.[name] === true
    }
  `)
  const isolatedStorageSource = storageSource
    .replace(
      workSchemaSpecifier,
      JSON.stringify(new URL("../js/work-schema.js", import.meta.url).href),
    )
    .replace(featureFlagsSpecifier, JSON.stringify(enabledFeatureFlagsUrl))
    .replace(
      localLocksSpecifier,
      JSON.stringify(new URL("../js/local-locks.js", import.meta.url).href),
    )
    .replace(
      localWriteMetadataSpecifier,
      JSON.stringify(new URL("../js/local-write-metadata.js", import.meta.url).href),
    )

  reliableWriteStorageModule = import(javascriptDataUrl(isolatedStorageSource))
  return reliableWriteStorageModule
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

function databaseWithHiddenToJson(onCall) {
  const hidden = { original: true }
  Object.defineProperty(hidden, "toJSON", {
    configurable: true,
    enumerable: false,
    value() {
      onCall()
      return { replacement: true }
    },
  })
  return {
    works: [],
    contacts: [],
    groups: [],
    futureRoot: { hidden },
  }
}

function withTemporaryPrototypeToJson(prototype, hook, callback) {
  const previousDescriptor = Object.getOwnPropertyDescriptor(prototype, "toJSON")
  Object.defineProperty(prototype, "toJSON", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: hook,
  })
  try {
    return callback()
  } finally {
    if (previousDescriptor === undefined) delete prototype.toJSON
    else Object.defineProperty(prototype, "toJSON", previousDescriptor)
  }
}

test("exports pure local database validation and serialization helpers", () => {
  assert.equal(typeof validateLocalDatabase, "function")
  assert.equal(typeof serializeValidatedLocalDatabase, "function")
  assert.equal(typeof serializeLocalDatabaseBackupFromDatabase, "function")
})

test("pure database helpers validate and serialize normalized unknown JSON fields without storage", () => {
  const database = {
    works: [{ id: "work-1", privateEditorState: { zoom: 1.25 } }],
    contacts: [{ id: "contact-1", future: true }],
    groups: [{ id: "group-1" }],
    futureRoot: { enabled: true, values: [null, 1, "two"] },
  }

  const status = validateLocalDatabase(database)
  const raw = serializeValidatedLocalDatabase(database)

  assert.deepEqual(status, { ok: true, raw: null, data: database })
  assert.equal(raw, JSON.stringify(database))
  assert.deepEqual(inspectLocalDatabaseRaw(raw), { ok: true, raw, data: database })
})

test("pure database validation reports ordinary invalid structures without throwing", () => {
  const status = validateLocalDatabase({ works: {} })

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-structure")
  assert.equal(status.raw, null)
  assert.ok(status.issues.length > 0)
})

test("validated database serialization rejects invalid and non-JSON-compatible values", () => {
  const cyclic = { works: [], contacts: [], groups: [] }
  cyclic.future = cyclic
  const unsupported = {
    works: [],
    contacts: [],
    groups: [],
    future: undefined,
  }

  for (const database of [{ works: {} }, cyclic, unsupported]) {
    assert.throws(
      () => serializeValidatedLocalDatabase(database),
      error => error instanceof LocalDatabaseError
        && error.code === "invalid-write"
        && (error.details?.issues !== undefined || error.cause instanceof Error),
    )
  }
})

test("pure encoders reject hidden toJSON before it can replace unknown data", () => {
  for (const [name, encode, expectedCode] of [
    ["database", serializeValidatedLocalDatabase, "invalid-write"],
    [
      "backup",
      database => serializeLocalDatabaseBackupFromDatabase(
        database,
        "2026-07-12T00:00:00.000Z",
      ),
      "backup-failed",
    ],
  ]) {
    let callbackCalls = 0
    let raw
    let error
    try {
      raw = encode(databaseWithHiddenToJson(() => { callbackCalls += 1 }))
    } catch (caught) {
      error = caught
    }

    assert.deepEqual({
      name,
      errorCode: error?.code,
      callbackCalls,
      raw,
    }, {
      name,
      errorCode: expectedCode,
      callbackCalls: 0,
      raw: undefined,
    })
  }
})

test("pure encoders reject inherited Array prototype toJSON before works can disappear", () => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "toJSON")
  for (const [name, encode, expectedCode] of [
    ["database", serializeValidatedLocalDatabase, "invalid-write"],
    [
      "backup",
      database => serializeLocalDatabaseBackupFromDatabase(
        database,
        "2026-07-12T00:00:00.000Z",
      ),
      "backup-failed",
    ],
  ]) {
    let callbackCalls = 0
    let raw
    let error
    withTemporaryPrototypeToJson(
      Array.prototype,
      () => {
        callbackCalls += 1
        return []
      },
      () => {
        try {
          raw = encode({
            works: [{ id: "must-stay" }],
            contacts: [],
            groups: [],
          })
        } catch (caught) {
          error = caught
        }
      },
    )

    const parsed = raw === undefined ? undefined : JSON.parse(raw)
    assert.deepEqual({
      name,
      errorCode: error?.code,
      callbackCalls,
      encodedWorks: parsed?.database?.works ?? parsed?.works,
    }, {
      name,
      errorCode: expectedCode,
      callbackCalls: 0,
      encodedWorks: undefined,
    })
    assert.deepEqual(Object.getOwnPropertyDescriptor(Array.prototype, "toJSON"), previousDescriptor)
  }
})

test("database serialization rejects inherited Object prototype toJSON without calling it", () => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
  let callbackCalls = 0
  let error

  withTemporaryPrototypeToJson(
    Object.prototype,
    () => {
      callbackCalls += 1
      return []
    },
    () => {
      try {
        serializeValidatedLocalDatabase({ works: [], contacts: [], groups: [] })
      } catch (caught) {
        error = caught
      }
    },
  )

  assert.equal(error instanceof LocalDatabaseError, true)
  assert.equal(error.code, "invalid-write")
  assert.equal(callbackCalls, 0)
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, "toJSON"), previousDescriptor)
})

test("pure encoders reject named array fields at and above the array-index boundary", () => {
  const accepted = []
  for (const key of ["4294967295", "4294967296", "named"]) {
    for (const [name, encode] of [
      ["database", serializeValidatedLocalDatabase],
      [
        "backup",
        database => serializeLocalDatabaseBackupFromDatabase(
          database,
          "2026-07-12T00:00:00.000Z",
        ),
      ],
    ]) {
      const futureArray = []
      Object.defineProperty(futureArray, key, {
        configurable: true,
        enumerable: true,
        value: "must-not-disappear",
      })
      const database = {
        works: [],
        contacts: [],
        groups: [],
        futureArray,
      }
      try {
        encode(database)
        accepted.push(`${name}:${key}`)
      } catch (error) {
        assert.equal(error instanceof LocalDatabaseError, true)
      }
    }
  }
  assert.deepEqual(accepted, [])
})

test("pure backup serialization validates input and preserves the legacy byte format", () => {
  const exportedAt = "2026-07-10T05:30:00.000Z"
  const database = {
    works: [{ id: "work-1", future: { private: true } }],
    contacts: [],
    groups: [],
    futureRoot: "kept",
  }
  const expected = JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt,
    database,
  }, null, 2)

  assert.equal(serializeLocalDatabaseBackupFromDatabase(database, exportedAt), expected)
  assert.deepEqual(JSON.parse(expected).database, database)
})

test("pure backup serialization rejects invalid data and hostile timestamps without coercion", () => {
  let coercions = 0
  const hostileTimestamp = {
    toString() {
      coercions += 1
      throw new Error("must not stringify")
    },
    toJSON() {
      coercions += 1
      throw new Error("must not serialize")
    },
  }
  const validDatabase = { works: [], contacts: [], groups: [] }

  for (const [database, exportedAt] of [
    [{ works: {} }, "2026-07-10T05:30:00.000Z"],
    [validDatabase, "not-an-iso-timestamp"],
    [validDatabase, "2026-07-10T05:30:00Z"],
    [validDatabase, hostileTimestamp],
  ]) {
    assert.throws(
      () => serializeLocalDatabaseBackupFromDatabase(database, exportedAt),
      error => error instanceof LocalDatabaseError && error.code === "backup-failed",
    )
  }
  assert.equal(coercions, 0)
})

test("legacy backup serialization delegates with one clock read and identical bytes", () => {
  const exportedAt = "2026-07-10T05:30:00.000Z"
  const database = {
    works: [{ id: "work-1", future: true }],
    contacts: [],
    groups: [],
  }
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(database)]])
  let clockCalls = 0
  const clock = {
    toISOString() {
      clockCalls += 1
      return exportedAt
    },
  }

  const legacyRaw = serializeLocalDatabaseBackup(storage, clock)
  const pureRaw = serializeLocalDatabaseBackupFromDatabase(database, exportedAt)

  assert.equal(clockCalls, 1)
  assert.equal(legacyRaw, pureRaw)
  assert.equal(storage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("legacy backup delegation keeps a single backup error layer and the direct cause", () => {
  const database = { works: [], contacts: [], groups: [] }
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(database)]])
  const clockCause = new Error("clock failed")

  assert.throws(
    () => serializeLocalDatabaseBackup(storage, { toISOString() { throw clockCause } }),
    error => error instanceof LocalDatabaseError
      && error.code === "backup-failed"
      && error.cause === clockCause,
  )
  assert.throws(
    () => serializeLocalDatabaseBackup(storage, { toISOString() { return "not-canonical" } }),
    error => error instanceof LocalDatabaseError
      && error.code === "backup-failed"
      && error.cause instanceof RangeError,
  )
})

test("LocalDatabaseError preserves falsy causes and details", () => {
  const error = new LocalDatabaseError("failure", "test", 0, false)

  assert.equal(Object.hasOwn(error, "cause"), true)
  assert.equal(error.cause, 0)
  assert.equal(Object.hasOwn(error, "details"), true)
  assert.equal(error.details, false)
})

test("a missing database starts empty without writing", () => {
  const storage = createKeyedStorage([[UNRELATED_KEY, UNRELATED_VALUE]])

  assert.deepEqual(readLocalDatabase(storage), { works: [], contacts: [], groups: [] })
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("legacy valid data receives in-memory defaults without being rewritten", () => {
  const raw = JSON.stringify({ works: [{ id: "work-1" }], futureField: true })
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, raw],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])

  assert.deepEqual(readLocalDatabase(storage), {
    works: [{ id: "work-1" }],
    contacts: [],
    groups: [],
    futureField: true,
  })
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), raw)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
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
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, raw]])

  const status = inspectLocalDatabase(storage)

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-structure")
  assert.equal(status.raw, raw)
  assert.equal(status.issues[0].path, "$.works[0].phoneData.contacts[0]")
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
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
  const storage = createKeyedStorage([[
    LOCAL_DATABASE_KEY,
    JSON.stringify({ works: [], contacts: [], groups: [] }),
  ]])

  assert.throws(
    () => writeLocalDatabase({
      works: [{ type: "article", nodes: [{ choices: [null] }] }],
      contacts: [],
      groups: [],
    }, storage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-write",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
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

test("enabled reliable writes block the actual ordinary writer before storage access", async () => {
  const enabledStorageModule = await loadStorageWithReliableWrites()
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, JSON.stringify({ works: [], contacts: [], groups: [] })],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])

  assert.throws(
    () => enabledStorageModule.writeLocalDatabase(
      { works: [{ id: "blocked" }], contacts: [], groups: [] },
      storage,
    ),
    error => error instanceof enabledStorageModule.LocalDatabaseError
      && error.code === "legacy-write-disabled",
  )
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("enabled reliable writes block the actual restore writer before storage access", async () => {
  const enabledStorageModule = await loadStorageWithReliableWrites()
  const currentRaw = JSON.stringify({ works: [{ id: "current" }], contacts: [], groups: [] })
  const preparationStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, currentRaw]])
  const parsed = enabledStorageModule.parseLocalDatabaseBackup(JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database: { works: [{ id: "backup" }], contacts: [], groups: [] },
  }))
  const plan = enabledStorageModule.prepareLocalDatabaseRestore(
    parsed,
    preparationStorage,
    new Date("2026-07-11T01:00:00.000Z"),
  )
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, currentRaw],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])

  assert.equal(Object.isFrozen(plan), true)
  assert.throws(
    () => enabledStorageModule.restoreLocalDatabaseBackup(plan, storage),
    error => error instanceof enabledStorageModule.LocalDatabaseError
      && error.code === "legacy-write-disabled",
  )
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("enabled reliable writes block the legacy corrupt reset before storage access", async () => {
  const enabledStorageModule = await loadStorageWithReliableWrites()
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, "{broken"],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])

  assert.throws(
    () => enabledStorageModule.discardCorruptLocalDatabase(storage),
    error => error instanceof enabledStorageModule.LocalDatabaseError
      && error.code === "legacy-write-disabled",
  )
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), "{broken")
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
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
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, raw],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])
  const status = inspectLocalDatabase(storage)

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-json")
  assert.equal(status.raw, raw)
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.throws(() => writeLocalDatabase({ works: [] }, storage), LocalDatabaseError)
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), raw)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

for (const value of [null, [], "text", {}, { works: {} }]) {
  test(`invalid database structure is rejected: ${JSON.stringify(value)}`, () => {
    const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(value)]])
    const status = inspectLocalDatabase(storage)

    assert.equal(status.ok, false)
    assert.equal(status.code, "invalid-structure")
    assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  })
}

test("invalid outgoing data is never written", () => {
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({ works: [] })]])

  assert.throws(
    () => writeLocalDatabase({ works: {} }, storage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-write",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("write failures are wrapped without replacing the previous value", () => {
  const raw = JSON.stringify({ works: [] })
  const storage = createKeyedStorage(
    [[LOCAL_DATABASE_KEY, raw], [UNRELATED_KEY, UNRELATED_VALUE]],
    { setErrors: new Map([[LOCAL_DATABASE_KEY, new Error("quota exceeded")]]) },
  )

  assert.throws(
    () => writeLocalDatabase({ works: [{ id: "new" }] }, storage),
    error => error instanceof LocalDatabaseError && error.code === "write-failed",
  )
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), raw)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("ordinary database writes target only the database key", () => {
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, JSON.stringify({ works: [], contacts: [], groups: [] })],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])

  writeLocalDatabase({ works: [{ id: "new" }], contacts: [], groups: [] }, storage)

  assert.deepEqual(JSON.parse(storage.peek(LOCAL_DATABASE_KEY)), {
    works: [{ id: "new" }],
    contacts: [],
    groups: [],
  })
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("setItem", UNRELATED_KEY), 0)
  assert.equal(storage.count("removeItem", UNRELATED_KEY), 0)
})

test("a full library backup has a versioned envelope without writing", () => {
  const exportedAt = new Date("2026-07-10T05:30:00.000Z")
  const storage = createKeyedStorage([[UNRELATED_KEY, UNRELATED_VALUE]])

  const backup = JSON.parse(serializeLocalDatabaseBackup(storage, exportedAt))

  assert.deepEqual(backup, {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  })
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
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
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(database)]])

  const backup = JSON.parse(serializeLocalDatabaseBackup(
    storage,
    new Date("2026-07-10T05:30:00.000Z"),
  ))

  assert.deepEqual(backup.database, database)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("a full library backup refuses corrupt or unavailable storage", () => {
  const corruptStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, "not-json"]])
  const unavailableStorage = createKeyedStorage([], {
    getErrors: new Map([[LOCAL_DATABASE_KEY, new Error("denied")]]),
  })

  assert.throws(
    () => serializeLocalDatabaseBackup(corruptStorage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-json",
  )
  assert.throws(
    () => serializeLocalDatabaseBackup(unavailableStorage),
    error => error instanceof LocalDatabaseError && error.code === "storage-unavailable",
  )
  assert.equal(corruptStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(unavailableStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
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
    createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(database)]]),
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
  const storage = createKeyedStorage([[UNRELATED_KEY, UNRELATED_VALUE]], {
    getErrors: new Map([[LOCAL_DATABASE_KEY, new Error("denied")]]),
  })

  assert.equal(inspectLocalDatabase(storage).code, "storage-unavailable")
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.throws(() => writeLocalDatabase({ works: [] }, storage), LocalDatabaseError)
  assert.throws(
    () => discardCorruptLocalDatabase(storage),
    error => error instanceof LocalDatabaseError && error.code === "storage-unavailable",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("backup parsing rejects values that can escape into executable markup", () => {
  const base = {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-10T05:30:00.000Z",
  }
  const payloads = [
    {
      works: [{
        id: '\"><img src=x onerror="alert(1)">',
        type: "article",
        nodes: [],
      }],
      contacts: [],
      groups: [],
    },
    {
      works: [{
        id: "&apos;);alert(1);//",
        type: "article",
        nodes: [],
      }],
      contacts: [],
      groups: [],
    },
    {
      works: [{
        id: "phone-1",
        type: "phone",
        phoneData: {
          apps: [{
            id: "memo",
            type: "memo",
            color: 'red;\"><img src=x onerror="alert(1)">',
          }],
        },
      }],
      contacts: [],
      groups: [],
    },
    {
      works: [{
        id: "legacy-1",
        type: "legacy",
        phoneData: {
          apps: [{
            id: "memo",
            type: "memo",
            color: 'red;\"><img src=x onerror="alert(1)">',
          }],
        },
      }],
      contacts: [],
      groups: [],
    },
    {
      works: [{
        id: "phone-1",
        type: "phone",
        phoneData: {
          apps: [{
            id: "memo",
            type: "memo",
            color: "#f0f0f0",
            icon: '<svg onload="alert(1)"></svg>',
          }],
        },
      }],
      contacts: [],
      groups: [],
    },
  ]

  for (const database of payloads) {
    assert.throws(
      () => parseLocalDatabaseBackup(JSON.stringify({ ...base, database })),
      error => error instanceof LocalDatabaseError
        && error.code === "invalid-backup-database"
        && error.details?.issues?.some(issue => issue.code === "unsafe-render-value"),
    )
  }
})

test("only a confirmed corrupt database can be discarded", () => {
  const corruptStorage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, "not-json"],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])
  discardCorruptLocalDatabase(corruptStorage)
  assert.equal(corruptStorage.peek(LOCAL_DATABASE_KEY), null)
  assert.equal(corruptStorage.peek(UNRELATED_KEY), UNRELATED_VALUE)
  assert.equal(corruptStorage.count("removeItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(corruptStorage.count("removeItem", UNRELATED_KEY), 0)

  const validStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({ works: [] })]])
  assert.throws(
    () => discardCorruptLocalDatabase(validStorage),
    error => error instanceof LocalDatabaseError && error.code === "database-valid",
  )
  assert.equal(validStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("restore preparation is read-only and creates a valid-library recovery artifact", () => {
  const currentRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, currentRaw]])
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
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("restore preparation preserves corrupt raw data as the recovery artifact", () => {
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, '{"works":[']])
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
    new Date("2026-07-11T01:00:00.000Z"),
  )

  assert.equal(plan.previousState, "corrupt")
  assert.equal(plan.recoveryArtifact.kind, "corrupt-raw")
  assert.equal(plan.recoveryArtifact.contents, '{"works":[')
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("a successful restore performs one replacement and exact readback", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, oldRaw],
    [UNRELATED_KEY, UNRELATED_VALUE],
  ])
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [], future: true }),
    storage,
  )

  const result = restoreLocalDatabaseBackup(plan, storage)

  assert.equal(result.code, "restored")
  assert.equal(result.previousState, "valid")
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), plan.candidateRaw)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
  assert.deepEqual(
    storage.calls.map(call => [call.method, call.key]),
    [
      ["getItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
      ["setItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
    ],
  )
})

test("restore from corrupt storage bypasses only the ordinary-write guard", () => {
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, "not-json"]])
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => writeLocalDatabase(
      { works: [] },
      createKeyedStorage([[LOCAL_DATABASE_KEY, "not-json"]]),
    ),
    LocalDatabaseError,
  )
  assert.equal(restoreLocalDatabaseBackup(plan, storage).code, "restored")
})

test("a stale restore plan performs no write", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const changedRaw = JSON.stringify({ works: [{ id: "other-tab" }], contacts: [], groups: [] })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]], {
    getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, changedRaw]]]),
  })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "backup" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-conflict" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("quota failure preserves the exact old raw value", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createKeyedStorage(
    [[LOCAL_DATABASE_KEY, oldRaw], [UNRELATED_KEY, UNRELATED_VALUE]],
    { setErrors: new Map([[LOCAL_DATABASE_KEY, new Error("quota")]]) },
  )
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-write-failed" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), oldRaw)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("mutable forged restore plans are rejected before storage access", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]])
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
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), oldRaw)
})

test("frozen forged restore plans are rejected before storage access", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]])
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
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), oldRaw)
})

test("registered restore candidates are revalidated before storage access", { concurrency: false }, () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]])
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

  assert.deepEqual(storage.calls, [
    { method: "getItem", key: LOCAL_DATABASE_KEY, value: oldRaw },
  ])
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), oldRaw)
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
  const storage = createKeyedStorage([[
    LOCAL_DATABASE_KEY,
    JSON.stringify({ works: [], contacts: [], groups: [] }),
  ]])
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
  const storage = createKeyedStorage([[
    LOCAL_DATABASE_KEY,
    JSON.stringify({ works: [], contacts: [], groups: [] }),
  ]])
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

  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("restore commit returns the prepared UTF-8 byte count without fallible work after verify", { concurrency: false }, () => {
  const storage = createKeyedStorage([[
    LOCAL_DATABASE_KEY,
    JSON.stringify({ works: [], contacts: [], groups: [] }),
  ]])
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
  assert.deepEqual(
    storage.calls.map(call => [call.method, call.key]),
    [
      ["getItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
      ["setItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
    ],
  )
})

test("invalid and hostile restore times fail with a stable unchanged preparation error", () => {
  const cause = new Error("hostile clock")
  const values = [
    new Date("invalid"),
    { toISOString() { throw cause } },
    { toISOString() { return "not-an-iso-timestamp" } },
  ]

  for (const now of values) {
    const storage = createKeyedStorage([[
      LOCAL_DATABASE_KEY,
      JSON.stringify({ works: [], contacts: [], groups: [] }),
    ]])
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
    assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
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
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, currentRaw]])

  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
    now,
  )

  assert.equal(calls, 1)
  assert.equal(plan.recoveryArtifact.filename, "tuuru-library-before-restore-2026-07-11T01-02-03-004Z.json")
  assert.equal(JSON.parse(plan.recoveryArtifact.contents).exportedAt, iso)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("restore reads report preparation and replacement phases before writing", () => {
  const prepareCause = new Error("prepare read failed")
  const prepareStorage = createKeyedStorage([], {
    getErrors: new Map([[LOCAL_DATABASE_KEY, prepareCause]]),
  })
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
  assert.equal(prepareStorage.count("setItem", LOCAL_DATABASE_KEY), 0)

  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const replaceCause = new Error("replace read failed")
  const replaceStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]], {
    getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, replaceCause]]]),
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
  assert.deepEqual(
    replaceStorage.calls.map(call => [call.method, call.key]),
    [["getItem", LOCAL_DATABASE_KEY], ["getItem", LOCAL_DATABASE_KEY]],
  )
  assert.equal(replaceStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(replaceStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("a readback exception is unknown and never triggers retry or rollback", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const cause = new Error("readback failed")
  const storage = createKeyedStorage(
    [[LOCAL_DATABASE_KEY, oldRaw], [UNRELATED_KEY, UNRELATED_VALUE]],
    {
      getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, oldRaw, cause]]]),
    },
  )
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
  assert.deepEqual(
    storage.calls.map(call => [call.method, call.key]),
    [
      ["getItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
      ["setItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
    ],
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), plan.candidateRaw)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})

test("uncertain readback never reports success or rolls back", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const mismatchedRaw = JSON.stringify({ works: [{ id: "other" }], contacts: [], groups: [] })
  const storage = createKeyedStorage(
    [[LOCAL_DATABASE_KEY, oldRaw], [UNRELATED_KEY, UNRELATED_VALUE]],
    { getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, oldRaw, mismatchedRaw]]]) },
  )
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-verification-failed" && error.details.commitState === "unknown",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.peek(UNRELATED_KEY), UNRELATED_VALUE)
})
