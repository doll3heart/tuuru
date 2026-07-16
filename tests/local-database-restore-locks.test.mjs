import test from "node:test"
import assert from "node:assert/strict"

import {
  LOCAL_DATABASE_KEY,
  LocalDatabaseError,
  discardCorruptLocalDatabaseLocked,
  parseLocalDatabaseBackup,
  prepareLocalDatabaseRestore,
  restoreLocalDatabaseBackupLocked,
} from "../js/storage.js"
import {
  DATABASE_WRITE_LOCK_NAME,
  LIBRARY_SESSION_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
} from "../js/local-locks.js"
import { LOCAL_RESTORE_GENERATION_KEY } from "../js/local-write-metadata.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

const OLD_DATABASE = Object.freeze({
  works: [{ id: "old", type: "article", title: "Old", nodes: [], chapters: [], scenes: [], placeholders: [] }],
  contacts: [],
  groups: [],
})
const NEW_DATABASE = Object.freeze({
  works: [{ id: "new", type: "article", title: "New", nodes: [], chapters: [], scenes: [], placeholders: [] }],
  contacts: [],
  groups: [],
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitFor(predicate, message = "condition") {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.fail(`Timed out waiting for ${message}`)
}

function backup(database = NEW_DATABASE) {
  return parseLocalDatabaseBackup(JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-17T00:00:00.000Z",
    database,
  }))
}

function generationRaw(generationId = "generation-new", changedAt = 123) {
  return JSON.stringify({ version: 1, generationId, changedAt })
}

function secureLocks(manager = createFakeLockManager()) {
  return {
    manager,
    lockManager: createWebLocksAdapter({ locks: manager, isSecureContext: true }),
  }
}

function restoreFixture(storageOptions = {}) {
  const oldRaw = JSON.stringify(OLD_DATABASE)
  const locks = secureLocks()
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]], storageOptions)
  const plan = prepareLocalDatabaseRestore(
    backup(),
    storage,
    new Date("2026-07-17T00:00:01.000Z"),
  )
  storage.calls.length = 0
  return { ...locks, storage, plan, oldRaw }
}

function lockedOptions(fixture, overrides = {}) {
  return {
    storage: fixture.storage,
    lockManager: fixture.lockManager,
    createGenerationId: () => "generation-new",
    now: () => 123,
    ...overrides,
  }
}

test("locked restore uses library then database locks and advances generation before replacement", async () => {
  let manager
  const observations = []
  const oldRaw = JSON.stringify(OLD_DATABASE)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]], {
    afterSet(key) {
      observations.push({ key, snapshot: manager.snapshot() })
    },
  })
  const locks = secureLocks()
  manager = locks.manager
  const plan = prepareLocalDatabaseRestore(backup(), storage)
  storage.calls.length = 0

  const result = await restoreLocalDatabaseBackupLocked(plan, {
    storage,
    lockManager: locks.lockManager,
    createGenerationId: () => "generation-new",
    now: () => 123,
  })

  assert.equal(result.ok, true)
  assert.equal(result.code, "restored")
  assert.equal(result.generationId, "generation-new")
  assert.deepEqual(result.summary, plan.summary)
  assert.equal(storage.peek(LOCAL_RESTORE_GENERATION_KEY), generationRaw())
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), plan.candidateRaw)
  assert.deepEqual(
    storage.calls.map(call => [call.method, call.key]),
    [
      ["getItem", LOCAL_DATABASE_KEY],
      ["setItem", LOCAL_RESTORE_GENERATION_KEY],
      ["getItem", LOCAL_RESTORE_GENERATION_KEY],
      ["setItem", LOCAL_DATABASE_KEY],
      ["getItem", LOCAL_DATABASE_KEY],
    ],
  )
  assert.deepEqual(observations.map(item => item.key), [
    LOCAL_RESTORE_GENERATION_KEY,
    LOCAL_DATABASE_KEY,
  ])
  for (const observation of observations) {
    assert.deepEqual(observation.snapshot.held, [
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "exclusive" },
      { name: DATABASE_WRITE_LOCK_NAME, mode: "exclusive" },
    ])
  }
  assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
})

test("an active shared editor makes restore and reset fail immediately with zero writes", async () => {
  const { manager, lockManager } = secureLocks()
  const gate = deferred()
  const held = lockManager.request(
    LIBRARY_SESSION_LOCK_NAME,
    { mode: "shared" },
    () => gate.promise,
  )
  await waitFor(
    () => manager.snapshot().held.some(lock => lock.name === LIBRARY_SESSION_LOCK_NAME),
    "shared library lock",
  )

  const restore = restoreFixture()
  const corruptRaw = "{broken"
  const resetStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]])

  for (const operation of [
    () => restoreLocalDatabaseBackupLocked(restore.plan, {
      ...lockedOptions(restore),
      lockManager,
    }),
    () => discardCorruptLocalDatabaseLocked({
      storage: resetStorage,
      lockManager,
      expectedCurrentRaw: corruptRaw,
      createGenerationId: () => "generation-reset",
      now: () => 456,
    }),
  ]) {
    await assert.rejects(
      operation(),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-editors-active"
        && error.details?.commitState === "unchanged"
        && error.details?.generationState === "unchanged",
    )
  }

  assert.deepEqual(restore.storage.calls, [])
  assert.deepEqual(resetStorage.calls, [])
  assert.deepEqual(manager.snapshot(), {
    held: [{ name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" }],
    pending: [],
  })
  gate.resolve()
  await held
})

test("exclusive restore admission blocks a new shared editor while the database lock drains", async () => {
  const fixture = restoreFixture()
  const gate = deferred()
  const databaseOwner = fixture.lockManager.request(
    DATABASE_WRITE_LOCK_NAME,
    { mode: "exclusive" },
    () => gate.promise,
  )
  await waitFor(
    () => fixture.manager.snapshot().held.some(lock => lock.name === DATABASE_WRITE_LOCK_NAME),
    "database owner",
  )

  const restoring = restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture))
  await waitFor(() => {
    const snapshot = fixture.manager.snapshot()
    return snapshot.held.some(lock => lock.name === LIBRARY_SESSION_LOCK_NAME && lock.mode === "exclusive")
      && snapshot.pending.some(lock => lock.name === DATABASE_WRITE_LOCK_NAME)
  }, "restore library admission")

  const editorLibraryLock = await fixture.lockManager.request(
    LIBRARY_SESSION_LOCK_NAME,
    { mode: "shared", ifAvailable: true },
    lock => lock,
  )
  assert.equal(editorLibraryLock, null)
  assert.deepEqual(fixture.storage.calls, [])

  gate.resolve()
  await databaseOwner
  assert.equal((await restoring).code, "restored")
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
})

test("missing or insecure Web Locks fail both operations before storage or generation work", async () => {
  const fixture = restoreFixture()
  const unavailable = createWebLocksAdapter({ locks: undefined, isSecureContext: false })
  let generationCalls = 0
  const corruptRaw = "{broken"
  const resetStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]])

  for (const operation of [
    () => restoreLocalDatabaseBackupLocked(fixture.plan, {
      ...lockedOptions(fixture),
      lockManager: unavailable,
      createGenerationId() { generationCalls += 1; return "unused" },
    }),
    () => discardCorruptLocalDatabaseLocked({
      storage: resetStorage,
      lockManager: unavailable,
      expectedCurrentRaw: corruptRaw,
      createGenerationId() { generationCalls += 1; return "unused" },
      now: () => 1,
    }),
  ]) {
    await assert.rejects(
      operation(),
      error => error instanceof LocalLockUnavailableError
        && error.code === "mutation-lock-unavailable",
    )
  }

  assert.equal(generationCalls, 0)
  assert.deepEqual(fixture.storage.calls, [])
  assert.deepEqual(resetStorage.calls, [])
})

test("a null database lock fails restore and reset before storage or generation work", async () => {
  const fixture = restoreFixture()
  const corruptRaw = "{broken"
  const resetStorage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]])
  let generationCalls = 0
  const nullDatabaseLockManager = Object.freeze({
    available: true,
    request(name, options, callback) {
      if (name === LIBRARY_SESSION_LOCK_NAME) {
        return Promise.resolve(callback(Object.freeze({ name, mode: options.mode })))
      }
      assert.equal(name, DATABASE_WRITE_LOCK_NAME)
      return Promise.resolve(callback(null))
    },
  })

  const outcomes = await Promise.allSettled([
    restoreLocalDatabaseBackupLocked(fixture.plan, {
      storage: fixture.storage,
      lockManager: nullDatabaseLockManager,
      createGenerationId() { generationCalls += 1; return "unused-restore" },
      now: () => 1,
    }),
    discardCorruptLocalDatabaseLocked({
      storage: resetStorage,
      lockManager: nullDatabaseLockManager,
      expectedCurrentRaw: corruptRaw,
      createGenerationId() { generationCalls += 1; return "unused-reset" },
      now: () => 1,
    }),
  ])

  for (const [index, outcome] of outcomes.entries()) {
    assert.equal(outcome.status, "rejected", index === 0 ? "restore" : "reset")
    assert.equal(outcome.reason instanceof LocalLockUnavailableError, true)
    assert.equal(outcome.reason.code, "mutation-lock-unavailable")
  }
  assert.equal(generationCalls, 0)
  assert.deepEqual(fixture.storage.calls, [])
  assert.deepEqual(resetStorage.calls, [])
})

test("restore checks its exact prepared raw before generation mutation", async () => {
  const fixture = restoreFixture()
  const changedRaw = JSON.stringify({ ...OLD_DATABASE, external: true })
  fixture.storage.setItem(LOCAL_DATABASE_KEY, changedRaw)
  fixture.storage.calls.length = 0

  await assert.rejects(
    restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-conflict"
      && error.details?.commitState === "unchanged"
      && error.details?.generationState === "unchanged",
  )

  assert.deepEqual(fixture.storage.calls.map(call => [call.method, call.key]), [
    ["getItem", LOCAL_DATABASE_KEY],
  ])
  assert.equal(fixture.storage.peek(LOCAL_RESTORE_GENERATION_KEY), null)
  assert.equal(fixture.storage.peek(LOCAL_DATABASE_KEY), changedRaw)
})

test("generation write failure leaves the database and generation unchanged", async () => {
  const fixture = restoreFixture({
    setErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, new Error("generation quota")]]),
  })

  await assert.rejects(
    restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-generation-write-failed"
      && error.details?.commitState === "unchanged"
      && error.details?.generationState === "unchanged",
  )

  assert.equal(fixture.storage.peek(LOCAL_DATABASE_KEY), fixture.oldRaw)
  assert.equal(fixture.storage.peek(LOCAL_RESTORE_GENERATION_KEY), null)
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(fixture.storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
})

test("generation readback failures and mismatches leave the database untouched and generation unknown", async () => {
  const cases = [
    {
      name: "readback",
      options: {
        getErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, new Error("generation read denied")]]),
      },
    },
    {
      name: "mismatch",
      options: {
        afterSet(key, _value, controls) {
          if (key === LOCAL_RESTORE_GENERATION_KEY) {
            controls.set(LOCAL_RESTORE_GENERATION_KEY, generationRaw("other", 999))
          }
        },
      },
    },
  ]

  for (const { name, options } of cases) {
    const fixture = restoreFixture(options)
    await assert.rejects(
      restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture)),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-generation-unknown"
        && error.details?.commitState === "unchanged"
        && error.details?.generationState === "unknown",
      name,
    )
    assert.equal(fixture.storage.peek(LOCAL_DATABASE_KEY), fixture.oldRaw, name)
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0, name)
    assert.equal(fixture.storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 1, name)
    assert.equal(fixture.storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0, name)
  }
})

test("reset generation failures never remove the corrupt database or roll generation back", async () => {
  const corruptRaw = "{broken"
  const cases = [
    {
      name: "write",
      code: "restore-generation-write-failed",
      generationState: "unchanged",
      options: {
        setErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, new Error("generation quota")]]),
      },
    },
    {
      name: "readback",
      code: "restore-generation-unknown",
      generationState: "unknown",
      options: {
        getErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, new Error("generation denied")]]),
      },
    },
    {
      name: "mismatch",
      code: "restore-generation-unknown",
      generationState: "unknown",
      options: {
        afterSet(key, _value, controls) {
          if (key === LOCAL_RESTORE_GENERATION_KEY) {
            controls.set(LOCAL_RESTORE_GENERATION_KEY, generationRaw("other", 999))
          }
        },
      },
    },
  ]

  for (const item of cases) {
    const locks = secureLocks()
    const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]], item.options)
    await assert.rejects(
      discardCorruptLocalDatabaseLocked({
        storage,
        lockManager: locks.lockManager,
        expectedCurrentRaw: corruptRaw,
        createGenerationId: () => "generation-reset",
        now: () => 456,
      }),
      error => error instanceof LocalDatabaseError
        && error.code === item.code
        && error.details?.commitState === "unchanged"
        && error.details?.generationState === item.generationState,
      item.name,
    )
    assert.equal(storage.peek(LOCAL_DATABASE_KEY), corruptRaw, item.name)
    assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0, item.name)
    assert.equal(storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0, item.name)
  }
})

test("database write failure preserves the old database but keeps verified generation advanced", async () => {
  const fixture = restoreFixture({
    setErrors: new Map([[LOCAL_DATABASE_KEY, new Error("database quota")]]),
  })

  await assert.rejects(
    restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "restore-write-failed"
      && error.details?.commitState === "unchanged"
      && error.details?.generationState === "advanced"
      && error.details?.generationId === "generation-new",
  )

  assert.equal(fixture.storage.peek(LOCAL_DATABASE_KEY), fixture.oldRaw)
  assert.equal(fixture.storage.peek(LOCAL_RESTORE_GENERATION_KEY), generationRaw())
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
})

test("database readback uncertainty never rolls back the advanced generation or database", async () => {
  const oldRaw = JSON.stringify(OLD_DATABASE)
  const mismatchRaw = JSON.stringify({ ...NEW_DATABASE, external: true })
  const cases = [
    {
      name: "readback",
      code: "restore-readback-failed",
      options: { getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, oldRaw, new Error("readback denied")]]]) },
    },
    {
      name: "mismatch",
      code: "restore-verification-failed",
      options: { getSequences: new Map([[LOCAL_DATABASE_KEY, [oldRaw, oldRaw, mismatchRaw]]]) },
    },
  ]

  for (const { name, code, options } of cases) {
    const fixture = restoreFixture(options)
    await assert.rejects(
      restoreLocalDatabaseBackupLocked(fixture.plan, lockedOptions(fixture)),
      error => error instanceof LocalDatabaseError
        && error.code === code
        && error.details?.commitState === "unknown"
        && error.details?.generationState === "advanced",
      name,
    )
    assert.equal(fixture.storage.peek(LOCAL_RESTORE_GENERATION_KEY), generationRaw(), name)
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1, name)
    assert.equal(fixture.storage.count("removeItem", LOCAL_DATABASE_KEY), 0, name)
    assert.equal(fixture.storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0, name)
  }
})

test("locked corrupt reset rereads exact raw, advances generation, removes once, and verifies absence", async () => {
  const corruptRaw = "{broken"
  const locks = secureLocks()
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]])

  const result = await discardCorruptLocalDatabaseLocked({
    storage,
    lockManager: locks.lockManager,
    expectedCurrentRaw: corruptRaw,
    createGenerationId: () => "generation-reset",
    now: () => 456,
  })

  assert.deepEqual(result, {
    ok: true,
    code: "discarded",
    generationId: "generation-reset",
  })
  assert.equal(storage.peek(LOCAL_DATABASE_KEY), null)
  assert.equal(storage.peek(LOCAL_RESTORE_GENERATION_KEY), generationRaw("generation-reset", 456))
  assert.deepEqual(storage.calls.map(call => [call.method, call.key]), [
    ["getItem", LOCAL_DATABASE_KEY],
    ["setItem", LOCAL_RESTORE_GENERATION_KEY],
    ["getItem", LOCAL_RESTORE_GENERATION_KEY],
    ["removeItem", LOCAL_DATABASE_KEY],
    ["getItem", LOCAL_DATABASE_KEY],
  ])
  assert.deepEqual(locks.manager.snapshot(), { held: [], pending: [] })
})

test("locked reset refuses changed, valid, or missing current data before generation mutation", async () => {
  const expectedCurrentRaw = "{broken"
  const cases = [
    ["changed", "{different", "reset-conflict"],
    ["valid", JSON.stringify({ works: [], contacts: [], groups: [] }), "reset-conflict"],
    ["missing", null, "reset-conflict"],
  ]

  for (const [name, currentRaw, code] of cases) {
    const locks = secureLocks()
    const entries = currentRaw === null ? [] : [[LOCAL_DATABASE_KEY, currentRaw]]
    const storage = createKeyedStorage(entries)
    await assert.rejects(
      discardCorruptLocalDatabaseLocked({
        storage,
        lockManager: locks.lockManager,
        expectedCurrentRaw,
        createGenerationId: () => "generation-reset",
        now: () => 456,
      }),
      error => error instanceof LocalDatabaseError
        && error.code === code
        && error.details?.commitState === "unchanged",
      name,
    )
    assert.equal(storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 0, name)
    assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0, name)
  }
})

test("locked reset refuses same-value valid and missing data as database-valid", async () => {
  const validRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const cases = [
    ["valid", validRaw, [[LOCAL_DATABASE_KEY, validRaw]]],
    ["missing", null, []],
  ]

  for (const [name, expectedCurrentRaw, entries] of cases) {
    const locks = secureLocks()
    const storage = createKeyedStorage(entries)
    await assert.rejects(
      discardCorruptLocalDatabaseLocked({
        storage,
        lockManager: locks.lockManager,
        expectedCurrentRaw,
        createGenerationId: () => "generation-reset",
        now: () => 456,
      }),
      error => error instanceof LocalDatabaseError
        && error.code === "database-valid"
        && error.details?.commitState === "unchanged"
        && error.details?.generationState === "unchanged",
      name,
    )
    assert.deepEqual(storage.calls.map(call => [call.method, call.key]), [
      ["getItem", LOCAL_DATABASE_KEY],
    ], name)
    assert.equal(storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 0, name)
    assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0, name)
  }
})

test("reset removal and readback failures keep generation advanced without rollback", async () => {
  const corruptRaw = "{broken"
  const cases = [
    {
      name: "remove",
      code: "reset-failed",
      commitState: "unchanged",
      storage: createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]], {
        removeErrors: new Map([[LOCAL_DATABASE_KEY, new Error("remove denied")]]),
      }),
    },
    {
      name: "readback",
      code: "reset-readback-failed",
      commitState: "unknown",
      storage: createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]], {
        getSequences: new Map([[LOCAL_DATABASE_KEY, [corruptRaw, new Error("readback denied")]]]),
      }),
    },
  ]

  for (const item of cases) {
    const locks = secureLocks()
    await assert.rejects(
      discardCorruptLocalDatabaseLocked({
        storage: item.storage,
        lockManager: locks.lockManager,
        expectedCurrentRaw: corruptRaw,
        createGenerationId: () => "generation-reset",
        now: () => 456,
      }),
      error => error instanceof LocalDatabaseError
        && error.code === item.code
        && error.details?.commitState === item.commitState
        && error.details?.generationState === "advanced",
      item.name,
    )
    assert.equal(
      item.storage.peek(LOCAL_RESTORE_GENERATION_KEY),
      generationRaw("generation-reset", 456),
      item.name,
    )
    assert.equal(item.storage.count("setItem", LOCAL_RESTORE_GENERATION_KEY), 1, item.name)
    assert.equal(item.storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0, item.name)
  }
})

test("reset non-null readback is unknown and never retries or rolls generation back", async () => {
  const corruptRaw = "{broken"
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, corruptRaw]], {
    getSequences: new Map([[LOCAL_DATABASE_KEY, [corruptRaw, "{reappeared"]]]),
  })
  const locks = secureLocks()

  await assert.rejects(
    discardCorruptLocalDatabaseLocked({
      storage,
      lockManager: locks.lockManager,
      expectedCurrentRaw: corruptRaw,
      createGenerationId: () => "generation-reset",
      now: () => 456,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "reset-verification-failed"
      && error.details?.commitState === "unknown"
      && error.details?.generationState === "advanced"
      && error.details?.generationId === "generation-reset",
  )

  assert.equal(storage.peek(LOCAL_RESTORE_GENERATION_KEY), generationRaw("generation-reset", 456))
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_RESTORE_GENERATION_KEY), 0)
})

test("locked restore rejects forged plans before locks, storage, or generation work", async () => {
  const oldRaw = JSON.stringify(OLD_DATABASE)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, oldRaw]])
  let lockCalls = 0
  let generationCalls = 0
  const lockManager = Object.freeze({
    available: true,
    request() {
      lockCalls += 1
      return Promise.reject(new Error("locks must not be reached"))
    },
  })
  const forgedPlans = [
    {
      candidateRaw: JSON.stringify(NEW_DATABASE),
      expectedCurrentRaw: oldRaw,
      summary: {},
      previousState: "valid",
      restoredBytes: 1,
    },
    Object.freeze({
      candidateRaw: JSON.stringify(NEW_DATABASE),
      expectedCurrentRaw: oldRaw,
      summary: Object.freeze({}),
      previousState: "valid",
      restoredBytes: 1,
    }),
  ]

  for (const plan of forgedPlans) {
    await assert.rejects(
      restoreLocalDatabaseBackupLocked(plan, {
        storage,
        lockManager,
        createGenerationId() { generationCalls += 1; return "unused" },
        now: () => 1,
      }),
      error => error instanceof LocalDatabaseError
        && error.code === "restore-serialize-failed"
        && error.details?.commitState === "unchanged",
    )
  }
  assert.equal(lockCalls, 0)
  assert.equal(generationCalls, 0)
  assert.deepEqual(storage.calls, [])
})
