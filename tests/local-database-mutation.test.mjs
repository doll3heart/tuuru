import test from "node:test"
import assert from "node:assert/strict"

import {
  commitLocalDatabaseMutation,
  commitPreparedLocalDatabaseCandidate,
  createJsonToken,
  recheckUnknownLocalDatabaseCommit,
} from "../js/local-database-mutation.js"
import {
  DATABASE_WRITE_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
} from "../js/local-locks.js"
import { LOCAL_DATABASE_KEY, LocalDatabaseError } from "../js/storage.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

function createMutationFixture({
  database = { works: [], contacts: [], groups: [] },
  raw: suppliedRaw,
  storageOptions,
} = {}) {
  const events = []
  const raw = suppliedRaw === undefined
    ? database === null ? null : JSON.stringify(database)
    : suppliedRaw
  const keyedStorage = createKeyedStorage(
    raw === null ? [] : [[LOCAL_DATABASE_KEY, raw]],
    storageOptions,
  )
  const storage = {
    getItem(key) {
      events.push(["get", String(key)])
      return keyedStorage.getItem(key)
    },
    setItem(key, value) {
      events.push(["set", String(key), String(value)])
      return keyedStorage.setItem(key, value)
    },
    removeItem(key) {
      events.push(["remove", String(key)])
      return keyedStorage.removeItem(key)
    },
  }
  const nativeLocks = createFakeLockManager()
  const webLocks = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: true })
  const lockManager = {
    available: webLocks.available,
    request(name, options, callback) {
      events.push(["request", name, options.mode])
      return webLocks.request(name, options, lock => {
        events.push(["lock", lock?.name, lock?.mode])
        return callback(lock)
      })
    },
  }
  const assertSessionAdmission = async () => {
    events.push(["admission"])
    return true
  }
  const assertOwnerFence = async () => {
    events.push(["fence"])
    return true
  }

  return {
    events,
    keyedStorage,
    lockManager,
    storage,
    assertSessionAdmission,
    assertOwnerFence,
  }
}

function mutationArgs(overrides = {}) {
  return {
    operationId: "operation-1",
    workId: "work-1",
    ownerId: "owner-1",
    leaseId: "lease-1",
    restoreGeneration: null,
    expectedWorkToken: createJsonToken(null),
    apply: database => database,
    ...overrides,
  }
}

function mutationDependencies(fixture, overrides = {}) {
  return {
    storage: fixture.storage,
    lockManager: fixture.lockManager,
    assertSessionAdmission: fixture.assertSessionAdmission,
    assertOwnerFence: fixture.assertOwnerFence,
    ...overrides,
  }
}

test("exports the local database mutation primitives", () => {
  assert.equal(typeof commitLocalDatabaseMutation, "function")
  assert.equal(typeof commitPreparedLocalDatabaseCandidate, "function")
  assert.equal(typeof recheckUnknownLocalDatabaseCommit, "function")
  assert.equal(typeof createJsonToken, "function")
})

test("JSON tokens are deterministic, type-tagged, and preserve array order", () => {
  const left = {
    z: [1, "1", true, null],
    a: { second: 2, first: 1 },
  }
  const right = {
    a: { first: 1, second: 2 },
    z: [1, "1", true, null],
  }

  assert.equal(createJsonToken(left), createJsonToken(right))
  assert.equal(createJsonToken(-0), createJsonToken(0))
  assert.notEqual(createJsonToken(1), createJsonToken("1"))
  assert.notEqual(createJsonToken(true), createJsonToken("true"))
  assert.notEqual(createJsonToken(null), createJsonToken("null"))
  assert.notEqual(createJsonToken([1, 2]), createJsonToken([2, 1]))
  assert.notEqual(createJsonToken({ a: 1 }), createJsonToken({ a: 1, b: null }))
})

test("JSON tokens reject non-JSON values and cycles without calling toJSON or mutating input", () => {
  const stable = { nested: { value: 1 }, list: [true, null] }
  const before = structuredClone(stable)
  const cyclic = {}
  cyclic.self = cyclic
  const sparse = []
  sparse.length = 1
  let toJsonCalls = 0
  const hostile = {
    value: 1,
    toJSON() {
      toJsonCalls += 1
      return { value: 2 }
    },
  }

  assert.equal(typeof createJsonToken(stable), "string")
  assert.deepEqual(stable, before)
  for (const value of [
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    () => {},
    Symbol("value"),
    sparse,
    cyclic,
    new Date("2026-07-12T00:00:00.000Z"),
    hostile,
  ]) {
    assert.throws(() => createJsonToken(value), error => error instanceof TypeError || error instanceof RangeError)
  }
  assert.equal(toJsonCalls, 0)
})

test("JSON tokens remain stack-safe for deeply nested valid values", () => {
  let value = { leaf: "end" }
  for (let depth = 0; depth < 5000; depth += 1) value = { child: value }

  const token = createJsonToken(value)

  assert.equal(typeof token, "string")
  assert.equal(token.includes('"end"'), true)
})

test("JSON tokens reject named array fields at and above the array-index boundary", () => {
  const accepted = []
  for (const key of ["4294967295", "4294967296", "named"]) {
    const value = []
    Object.defineProperty(value, key, {
      configurable: true,
      enumerable: true,
      value: "must-not-disappear",
    })
    try {
      createJsonToken(value)
      accepted.push(key)
    } catch (error) {
      assert.equal(error instanceof TypeError, true)
    }
  }
  assert.deepEqual(accepted, [])
})

test("normal mutation commits the latest validated database in the exact locked order", async () => {
  const before = {
    works: [{ id: "work-1", title: "before", future: { kept: true } }],
    contacts: [],
    groups: [],
    futureRoot: "preserved",
  }
  const fixture = createMutationFixture({ database: before })
  const expectedWorkToken = createJsonToken(before.works[0])
  const candidate = {
    ...before,
    works: [{ ...before.works[0], title: "after" }],
  }

  const result = await commitLocalDatabaseMutation(
    mutationArgs({
      expectedWorkToken,
      apply(latestDatabase) {
        fixture.events.push(["apply"])
        assert.deepEqual(latestDatabase, before)
        return candidate
      },
    }),
    {
      storage: fixture.storage,
      lockManager: fixture.lockManager,
      assertSessionAdmission: fixture.assertSessionAdmission,
      assertOwnerFence: fixture.assertOwnerFence,
    },
  )

  const candidateRaw = JSON.stringify(candidate)
  assert.deepEqual(fixture.events, [
    ["request", DATABASE_WRITE_LOCK_NAME, "exclusive"],
    ["lock", DATABASE_WRITE_LOCK_NAME, "exclusive"],
    ["admission"],
    ["get", LOCAL_DATABASE_KEY],
    ["apply"],
    ["get", LOCAL_DATABASE_KEY],
    ["fence"],
    ["set", LOCAL_DATABASE_KEY, candidateRaw],
    ["get", LOCAL_DATABASE_KEY],
  ])
  assert.deepEqual(result, {
    ok: true,
    operationId: "operation-1",
    raw: candidateRaw,
    database: candidate,
    workToken: createJsonToken(candidate.works[0]),
  })
  assert.equal(Object.isFrozen(result), true)
  assert.equal(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY), candidateRaw)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 3)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("normal mutation rejects programmer inputs before requesting a lock or reading storage", async () => {
  const cases = [
    { args: { operationId: "" } },
    { args: { workId: "" } },
    { args: { ownerId: "" } },
    { args: { leaseId: "" } },
    { args: { expectedWorkToken: "" } },
    { args: { restoreGeneration: "" } },
    { args: { restoreGeneration: 0 } },
    { args: { apply: null } },
    { dependencies: { assertSessionAdmission: null } },
    { dependencies: { assertOwnerFence: null } },
  ]

  for (const entry of cases) {
    const fixture = createMutationFixture()
    const dependencies = {
      storage: fixture.storage,
      lockManager: fixture.lockManager,
      assertSessionAdmission: fixture.assertSessionAdmission,
      assertOwnerFence: fixture.assertOwnerFence,
      ...entry.dependencies,
    }

    await assert.rejects(
      commitLocalDatabaseMutation(mutationArgs(entry.args), dependencies),
      error => error instanceof TypeError,
    )
    assert.deepEqual(fixture.events, [])
    assert.deepEqual(fixture.keyedStorage.calls, [])
  }
})

test("native database lock unavailability stays a LocalLockUnavailableError without storage access", async () => {
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({ works: [], contacts: [], groups: [] })]])
  const lockManager = createWebLocksAdapter({ locks: undefined, isSecureContext: false })

  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs(), {
      storage,
      lockManager,
      assertSessionAdmission() {},
      assertOwnerFence() {},
    }),
    error => error instanceof LocalLockUnavailableError
      && error.code === "mutation-lock-unavailable",
  )
  assert.deepEqual(storage.calls, [])
})

test("normal mutation maps source read and validation failures without writing", async () => {
  const readCause = new Error("read denied")
  const readFixture = createMutationFixture({
    storageOptions: { getErrors: new Map([[LOCAL_DATABASE_KEY, readCause]]) },
  })

  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs(), {
      storage: readFixture.storage,
      lockManager: readFixture.lockManager,
      assertSessionAdmission: readFixture.assertSessionAdmission,
      assertOwnerFence: readFixture.assertOwnerFence,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-read-failed"
      && error.cause === readCause
      && error.details.phase === "read-source"
      && error.details.commitState === "unchanged"
      && error.details.operationId === "operation-1"
      && error.details.workId === "work-1",
  )
  assert.equal(readFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(readFixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)

  const corruptRaw = '{"works":['
  const corruptFixture = createMutationFixture({ raw: corruptRaw })
  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs(), {
      storage: corruptFixture.storage,
      lockManager: corruptFixture.lockManager,
      assertSessionAdmission: corruptFixture.assertSessionAdmission,
      assertOwnerFence: corruptFixture.assertOwnerFence,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-invalid"
      && error.details.phase === "validate-source"
      && error.details.commitState === "unchanged"
      && error.details.expectedCurrentRaw === corruptRaw
      && error.details.actualRaw === corruptRaw
      && error.details.issues.length > 0,
  )
  assert.equal(corruptFixture.keyedStorage.peek(LOCAL_DATABASE_KEY), corruptRaw)
  assert.equal(corruptFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("normal mutation rejects duplicate targets and stale work tokens with zero writes", async () => {
  const duplicateDatabase = {
    works: [{ id: "work-1", value: 1 }, { id: "work-1", value: 2 }],
    contacts: [],
    groups: [],
  }
  const duplicateFixture = createMutationFixture({ database: duplicateDatabase })
  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs({ expectedWorkToken: createJsonToken(duplicateDatabase.works[0]) }), {
      storage: duplicateFixture.storage,
      lockManager: duplicateFixture.lockManager,
      assertSessionAdmission: duplicateFixture.assertSessionAdmission,
      assertOwnerFence: duplicateFixture.assertOwnerFence,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-invalid"
      && error.details.phase === "check-work"
      && error.details.commitState === "unchanged"
      && error.details.issues[0].code === "duplicate-work-id",
  )
  assert.equal(duplicateFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)

  const database = {
    works: [{ id: "work-1", value: "current" }],
    contacts: [],
    groups: [],
  }
  const conflictFixture = createMutationFixture({ database })
  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs({ expectedWorkToken: createJsonToken({ id: "work-1", value: "stale" }) }), {
      storage: conflictFixture.storage,
      lockManager: conflictFixture.lockManager,
      assertSessionAdmission: conflictFixture.assertSessionAdmission,
      assertOwnerFence: conflictFixture.assertOwnerFence,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-conflict"
      && error.details.phase === "check-work"
      && error.details.commitState === "unchanged"
      && error.details.expectedCurrentRaw === JSON.stringify(database),
  )
  assert.equal(conflictFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("normal mutation detects an exact source change before the fence and writes nothing", async () => {
  const before = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const changed = {
    works: [{ id: "work-1", value: "concurrent" }],
    contacts: [],
    groups: [],
  }
  const expectedCurrentRaw = JSON.stringify(before)
  const actualRaw = JSON.stringify(changed)
  const fixture = createMutationFixture({
    database: before,
    storageOptions: {
      getSequences: new Map([[LOCAL_DATABASE_KEY, [expectedCurrentRaw, actualRaw]]]),
    },
  })
  let applyCalls = 0

  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs({
      expectedWorkToken: createJsonToken(before.works[0]),
      apply(database) {
        applyCalls += 1
        return {
          ...database,
          works: [{ ...database.works[0], value: "candidate" }],
        }
      },
    }), {
      storage: fixture.storage,
      lockManager: fixture.lockManager,
      assertSessionAdmission: fixture.assertSessionAdmission,
      assertOwnerFence: fixture.assertOwnerFence,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-conflict"
      && error.details.phase === "recheck-source"
      && error.details.commitState === "unchanged"
      && error.details.expectedCurrentRaw === expectedCurrentRaw
      && error.details.actualRaw === actualRaw
      && typeof error.details.candidateRaw === "string",
  )
  assert.equal(applyCalls, 1)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(fixture.events.some(([event]) => event === "fence"), false)
})

test("admission and final owner fence failures become lease-lost with zero writes", async () => {
  for (const phase of ["admission", "fence"]) {
    const database = {
      works: [{ id: "work-1", value: "before" }],
      contacts: [],
      groups: [],
    }
    const fixture = createMutationFixture({ database })
    const cause = Object.assign(new Error(`${phase} lost`), { code: "mutation-lease-lost" })
    let applyCalls = 0
    const overrides = phase === "admission"
      ? {
          async assertSessionAdmission() {
            fixture.events.push(["admission"])
            throw cause
          },
        }
      : {
          async assertOwnerFence() {
            fixture.events.push(["fence"])
            throw cause
          },
        }

    await assert.rejects(
      commitLocalDatabaseMutation(mutationArgs({
        expectedWorkToken: createJsonToken(database.works[0]),
        apply(latest) {
          applyCalls += 1
          return latest
        },
      }), mutationDependencies(fixture, overrides)),
      error => error instanceof LocalDatabaseError
        && error.code === "mutation-lease-lost"
        && error.cause === cause
        && error.details.phase === phase
        && error.details.commitState === "unchanged"
        && error.details.operationId === "operation-1"
        && error.details.workId === "work-1",
    )
    assert.equal(applyCalls, phase === "admission" ? 0 : 1)
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  }
})

test("an admitted mutation can finish when its metadata-only owner fence still passes", async () => {
  const database = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const fixture = createMutationFixture({ database })
  let admitted = false
  let nativeLost = false

  const result = await commitLocalDatabaseMutation(mutationArgs({
    expectedWorkToken: createJsonToken(database.works[0]),
    apply(latest) {
      assert.equal(admitted, true)
      nativeLost = true
      return {
        ...latest,
        works: [{ ...latest.works[0], value: "after" }],
      }
    },
  }), mutationDependencies(fixture, {
    async assertSessionAdmission() {
      admitted = true
    },
    async assertOwnerFence() {
      assert.equal(nativeLost, true)
      return true
    },
  }))

  assert.equal(result.ok, true)
  assert.equal(JSON.parse(result.raw).works[0].value, "after")
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
})

test("apply failures and invalid candidates are mutation-invalid and never write", async () => {
  const applyCause = new Error("apply failed")
  const cases = [
    {
      phase: "apply",
      apply() {
        throw applyCause
      },
      cause: applyCause,
    },
    { phase: "validate-candidate", apply: () => ({ works: {} }) },
    {
      phase: "validate-candidate",
      apply(database) {
        const candidate = { ...database }
        candidate.future = candidate
        return candidate
      },
    },
    {
      phase: "validate-candidate",
      apply: database => ({ ...database, future: undefined }),
    },
    {
      phase: "validate-candidate",
      apply: database => ({
        ...database,
        works: [database.works[0], { ...database.works[0] }],
      }),
    },
  ]

  for (const entry of cases) {
    const database = {
      works: [{ id: "work-1", value: "before" }],
      contacts: [],
      groups: [],
    }
    const fixture = createMutationFixture({ database })
    let applyCalls = 0
    await assert.rejects(
      commitLocalDatabaseMutation(mutationArgs({
        expectedWorkToken: createJsonToken(database.works[0]),
        apply(latest) {
          applyCalls += 1
          return entry.apply(latest)
        },
      }), mutationDependencies(fixture)),
      error => error instanceof LocalDatabaseError
        && error.code === "mutation-invalid"
        && error.details.phase === entry.phase
        && error.details.commitState === "unchanged"
        && (entry.cause === undefined || error.cause === entry.cause),
    )
    assert.equal(applyCalls, 1)
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  }
})

test("normal mutation rejects a hidden candidate toJSON before callback or storage write", async () => {
  const database = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const fixture = createMutationFixture({ database })
  let callbackCalls = 0
  let result
  let error

  try {
    result = await commitLocalDatabaseMutation(mutationArgs({
      expectedWorkToken: createJsonToken(database.works[0]),
      apply(latest) {
        const hidden = { original: true }
        Object.defineProperty(hidden, "toJSON", {
          configurable: true,
          enumerable: false,
          value() {
            callbackCalls += 1
            return { replacement: true }
          },
        })
        return { ...latest, futureRoot: { hidden } }
      },
    }), mutationDependencies(fixture))
  } catch (caught) {
    error = caught
  }

  assert.deepEqual({
    errorCode: error?.code,
    phase: error?.details?.phase,
    commitState: error?.details?.commitState,
    callbackCalls,
    setCalls: fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY),
    removeCalls: fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY),
    resultOk: result?.ok,
  }, {
    errorCode: "mutation-invalid",
    phase: "validate-candidate",
    commitState: "unchanged",
    callbackCalls: 0,
    setCalls: 0,
    removeCalls: 0,
    resultOk: undefined,
  })
})

test("setItem failure is unchanged, retains both exact raws, and is never retried", async () => {
  const database = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const expectedCurrentRaw = JSON.stringify(database)
  const cause = new Error("quota exceeded")
  const fixture = createMutationFixture({
    database,
    storageOptions: { setErrors: new Map([[LOCAL_DATABASE_KEY, cause]]) },
  })

  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs({
      expectedWorkToken: createJsonToken(database.works[0]),
      apply: latest => ({
        ...latest,
        works: [{ ...latest.works[0], value: "after" }],
      }),
    }), mutationDependencies(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-write-failed"
      && error.cause === cause
      && error.details.phase === "write"
      && error.details.commitState === "unchanged"
      && error.details.expectedCurrentRaw === expectedCurrentRaw
      && JSON.parse(error.details.candidateRaw).works[0].value === "after",
  )
  assert.equal(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY), expectedCurrentRaw)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 2)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("different-work mutations share one database lock and preserve both changes", async () => {
  const database = {
    works: [
      { id: "work-1", value: "before-1" },
      { id: "work-2", value: "before-2" },
    ],
    contacts: [],
    groups: [],
  }
  const fixture = createMutationFixture({ database })
  const seenByApply = []
  const createOperation = (workId, value, operationId) => commitLocalDatabaseMutation(
    mutationArgs({
      operationId,
      workId,
      expectedWorkToken: createJsonToken(database.works.find(work => work.id === workId)),
      apply(latest) {
        seenByApply.push(structuredClone(latest))
        return {
          ...latest,
          works: latest.works.map(work => work.id === workId ? { ...work, value } : work),
        }
      },
    }),
    mutationDependencies(fixture),
  )

  const [firstResult, secondResult] = await Promise.all([
    createOperation("work-1", "after-1", "operation-1"),
    createOperation("work-2", "after-2", "operation-2"),
  ])

  assert.equal(firstResult.database.works[0].value, "after-1")
  assert.equal(secondResult.database.works[0].value, "after-1")
  assert.equal(secondResult.database.works[1].value, "after-2")
  assert.equal(seenByApply[1].works[0].value, "after-1")
  assert.deepEqual(JSON.parse(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY)).works.map(work => work.value), [
    "after-1",
    "after-2",
  ])
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 2)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("a post-write readback exception is unknown and never retries or rolls back", async () => {
  const database = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const expectedCurrentRaw = JSON.stringify(database)
  const cause = new Error("readback denied")
  const fixture = createMutationFixture({
    database,
    storageOptions: {
      getSequences: new Map([[LOCAL_DATABASE_KEY, [expectedCurrentRaw, expectedCurrentRaw, cause]]]),
    },
  })
  let applyCalls = 0

  await assert.rejects(
    commitLocalDatabaseMutation(mutationArgs({
      expectedWorkToken: createJsonToken(database.works[0]),
      apply(latest) {
        applyCalls += 1
        return {
          ...latest,
          works: [{ ...latest.works[0], value: "after" }],
        }
      },
    }), mutationDependencies(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-readback-failed"
      && error.cause === cause
      && error.details.phase === "readback"
      && error.details.commitState === "unknown"
      && error.details.expectedCurrentRaw === expectedCurrentRaw
      && JSON.parse(error.details.candidateRaw).works[0].value === "after"
      && !Object.hasOwn(error.details, "actualRaw"),
  )
  assert.equal(applyCalls, 1)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 3)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(JSON.parse(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY)).works[0].value, "after")
})

test("missing, different, and corrupt readbacks are unknown and never retry or roll back", async () => {
  const database = {
    works: [{ id: "work-1", value: "before" }],
    contacts: [],
    groups: [],
  }
  const expectedCurrentRaw = JSON.stringify(database)
  const readbacks = [
    null,
    JSON.stringify({
      works: [{ id: "work-1", value: "different" }],
      contacts: [],
      groups: [],
    }),
    '{"works":[',
  ]

  for (const actualRaw of readbacks) {
    const fixture = createMutationFixture({
      database,
      storageOptions: {
        getSequences: new Map([[
          LOCAL_DATABASE_KEY,
          [expectedCurrentRaw, expectedCurrentRaw, actualRaw],
        ]]),
      },
    })
    let applyCalls = 0
    await assert.rejects(
      commitLocalDatabaseMutation(mutationArgs({
        expectedWorkToken: createJsonToken(database.works[0]),
        apply(latest) {
          applyCalls += 1
          return {
            ...latest,
            works: [{ ...latest.works[0], value: "after" }],
          }
        },
      }), mutationDependencies(fixture)),
      error => error instanceof LocalDatabaseError
        && error.code === "mutation-verification-failed"
        && error.details.phase === "verify"
        && error.details.commitState === "unknown"
        && error.details.expectedCurrentRaw === expectedCurrentRaw
        && error.details.actualRaw === actualRaw
        && JSON.parse(error.details.candidateRaw).works[0].value === "after"
        && (actualRaw !== '{"works":[' || error.details.issues.length > 0),
    )
    assert.equal(applyCalls, 1)
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
    assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 3)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(JSON.parse(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY)).works[0].value, "after")
  }
})

function recheckArgs(overrides = {}) {
  return {
    workId: "work-1",
    ownerId: "owner-1",
    leaseId: "lease-1",
    restoreGeneration: null,
    expectedCurrentRaw: JSON.stringify({
      works: [{ id: "work-1", value: "before" }],
      contacts: [],
      groups: [],
    }),
    candidateRaw: JSON.stringify({
      works: [{ id: "work-1", value: "after" }],
      contacts: [],
      groups: [],
    }),
    ...overrides,
  }
}

test("unknown commit recheck validates supplied raw inputs before lock or storage", async () => {
  const cases = [
    { expectedCurrentRaw: 1 },
    { candidateRaw: null },
    { expectedCurrentRaw: '{"works":[' },
    { candidateRaw: '{"works":[' },
    {
      candidateRaw: JSON.stringify({
        works: [{ id: "work-1" }, { id: "work-1" }],
        contacts: [],
        groups: [],
      }),
    },
  ]

  for (const overrides of cases) {
    const fixture = createMutationFixture()
    await assert.rejects(
      recheckUnknownLocalDatabaseCommit(
        recheckArgs(overrides),
        {
          storage: fixture.storage,
          lockManager: fixture.lockManager,
          assertSessionAdmission: fixture.assertSessionAdmission,
          assertOwnerFence() {
            throw new Error("owner fence must not run")
          },
        },
      ),
      error => error instanceof TypeError
        || (error instanceof LocalDatabaseError
          && error.code === "mutation-invalid"
          && error.details.phase === "validate-input"),
    )
    assert.deepEqual(fixture.events, [])
    assert.deepEqual(fixture.keyedStorage.calls, [])
  }
})

test("unknown commit recheck returns only saved, not-written, or conflict under the database lock", async () => {
  const args = recheckArgs()
  const conflictRaw = JSON.stringify({
    works: [{ id: "work-1", value: "third" }],
    contacts: [],
    groups: [],
  })
  const cases = [
    { currentRaw: args.candidateRaw, outcome: "saved", value: "after" },
    { currentRaw: args.expectedCurrentRaw, outcome: "not-written" },
    { currentRaw: conflictRaw, outcome: "conflict", value: "third" },
  ]

  for (const entry of cases) {
    const fixture = createMutationFixture({ raw: entry.currentRaw })
    const result = await recheckUnknownLocalDatabaseCommit(args, {
      storage: fixture.storage,
      lockManager: fixture.lockManager,
      assertSessionAdmission: fixture.assertSessionAdmission,
      assertOwnerFence() {
        fixture.events.push(["unexpected-fence"])
        throw new Error("owner fence must not run")
      },
    })

    assert.equal(result.outcome, entry.outcome)
    assert.equal(Object.isFrozen(result), true)
    assert.equal(Object.hasOwn(result, "ok"), false)
    assert.equal(Object.hasOwn(result, "operationId"), false)
    if (entry.outcome === "not-written") {
      assert.deepEqual(result, { outcome: "not-written" })
    } else {
      assert.equal(Object.isFrozen(result.result), true)
      assert.equal(Object.hasOwn(result.result, "ok"), false)
      assert.equal(Object.hasOwn(result.result, "operationId"), false)
      assert.equal(result.result.raw, entry.currentRaw)
      assert.equal(result.result.database.works[0].value, entry.value)
      assert.equal(result.result.workToken, createJsonToken(result.result.database.works[0]))
    }
    assert.deepEqual(fixture.events, [
      ["request", DATABASE_WRITE_LOCK_NAME, "exclusive"],
      ["lock", DATABASE_WRITE_LOCK_NAME, "exclusive"],
      ["admission"],
      ["get", LOCAL_DATABASE_KEY],
    ])
    assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 1)
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  }
})

test("equal expected and candidate bytes resolve as saved before not-written", async () => {
  const raw = JSON.stringify({
    works: [],
    contacts: [],
    groups: [],
  })
  const fixture = createMutationFixture({ raw })

  const result = await recheckUnknownLocalDatabaseCommit(recheckArgs({
    expectedCurrentRaw: raw,
    candidateRaw: raw,
  }), {
    storage: fixture.storage,
    lockManager: fixture.lockManager,
    assertSessionAdmission: fixture.assertSessionAdmission,
  })

  assert.equal(result.outcome, "saved")
  assert.equal(result.result.workToken, createJsonToken(null))
})

test("recheck read failure and corrupt third state fail closed as unknown without writes", async () => {
  const args = recheckArgs()
  const readCause = new Error("recheck denied")
  const readFixture = createMutationFixture({
    storageOptions: { getErrors: new Map([[LOCAL_DATABASE_KEY, readCause]]) },
  })

  await assert.rejects(
    recheckUnknownLocalDatabaseCommit(args, {
      storage: readFixture.storage,
      lockManager: readFixture.lockManager,
      assertSessionAdmission: readFixture.assertSessionAdmission,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-readback-failed"
      && error.cause === readCause
      && error.details.phase === "recheck-read"
      && error.details.commitState === "unknown"
      && error.details.expectedCurrentRaw === args.expectedCurrentRaw
      && error.details.candidateRaw === args.candidateRaw,
  )
  assert.equal(readFixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(readFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)

  const corruptRaw = '{"works":['
  const corruptFixture = createMutationFixture({ raw: corruptRaw })
  await assert.rejects(
    recheckUnknownLocalDatabaseCommit(args, {
      storage: corruptFixture.storage,
      lockManager: corruptFixture.lockManager,
      assertSessionAdmission: corruptFixture.assertSessionAdmission,
    }),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-invalid"
      && error.details.phase === "recheck-validate"
      && error.details.commitState === "unknown"
      && error.details.actualRaw === corruptRaw
      && error.details.issues.length > 0,
  )
  assert.equal(corruptFixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(corruptFixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(corruptFixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

function preparedArgs(overrides = {}) {
  return {
    operationId: "prepared-operation-1",
    workId: "work-1",
    ownerId: "owner-1",
    leaseId: "lease-1",
    restoreGeneration: null,
    expectedCurrentRaw: JSON.stringify({
      works: [{ id: "work-1", value: "before" }],
      contacts: [],
      groups: [],
    }),
    candidateRaw: JSON.stringify({
      works: [{ id: "work-1", value: "after" }],
      contacts: [],
      groups: [],
    }, null, 2),
    ...overrides,
  }
}

test("prepared commit validates exact raw inputs and rejects apply before lock or storage", async () => {
  const cases = [
    { operationId: "" },
    { workId: "" },
    { ownerId: "" },
    { leaseId: "" },
    { restoreGeneration: "" },
    { expectedCurrentRaw: 1 },
    { candidateRaw: null },
    { expectedCurrentRaw: '{"works":[' },
    { candidateRaw: '{"works":[' },
    {
      candidateRaw: JSON.stringify({
        works: [{ id: "work-1" }, { id: "work-1" }],
        contacts: [],
        groups: [],
      }),
    },
    { apply() { throw new Error("must not run") } },
  ]

  for (const overrides of cases) {
    const fixture = createMutationFixture()
    await assert.rejects(
      commitPreparedLocalDatabaseCandidate(
        preparedArgs(overrides),
        mutationDependencies(fixture),
      ),
      error => error instanceof TypeError
        || (error instanceof LocalDatabaseError
          && error.code === "mutation-invalid"
          && error.details.phase === "validate-input"),
    )
    assert.deepEqual(fixture.events, [])
    assert.deepEqual(fixture.keyedStorage.calls, [])
  }
})

test("prepared commit writes the exact supplied candidate once in locked order", async () => {
  const args = preparedArgs()
  const fixture = createMutationFixture({ raw: args.expectedCurrentRaw })

  const result = await commitPreparedLocalDatabaseCandidate(args, mutationDependencies(fixture))

  assert.deepEqual(fixture.events, [
    ["request", DATABASE_WRITE_LOCK_NAME, "exclusive"],
    ["lock", DATABASE_WRITE_LOCK_NAME, "exclusive"],
    ["admission"],
    ["get", LOCAL_DATABASE_KEY],
    ["fence"],
    ["set", LOCAL_DATABASE_KEY, args.candidateRaw],
    ["get", LOCAL_DATABASE_KEY],
  ])
  assert.equal(result.ok, true)
  assert.equal(result.operationId, args.operationId)
  assert.equal(result.raw, args.candidateRaw)
  assert.equal(result.database.works[0].value, "after")
  assert.equal(result.workToken, createJsonToken(result.database.works[0]))
  assert.equal(Object.isFrozen(result), true)
  assert.equal(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY), args.candidateRaw)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 2)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("prepared commit conflicts on changed current raw before fence with zero writes", async () => {
  const args = preparedArgs()
  const actualRaw = JSON.stringify({
    works: [{ id: "work-1", value: "concurrent" }],
    contacts: [],
    groups: [],
  })
  const fixture = createMutationFixture({ raw: actualRaw })

  await assert.rejects(
    commitPreparedLocalDatabaseCandidate(args, mutationDependencies(fixture)),
    error => error instanceof LocalDatabaseError
      && error.code === "mutation-conflict"
      && error.details.phase === "check-source"
      && error.details.commitState === "unchanged"
      && error.details.expectedCurrentRaw === args.expectedCurrentRaw
      && error.details.candidateRaw === args.candidateRaw
      && error.details.actualRaw === actualRaw,
  )
  assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(fixture.events.some(([event]) => event === "fence"), false)
})

test("prepared commit uses admission and owner fence and preserves unchanged failures", async () => {
  for (const phase of ["admission", "fence", "write"]) {
    const args = preparedArgs()
    const cause = new Error(`${phase} failure`)
    const fixture = createMutationFixture({
      raw: args.expectedCurrentRaw,
      storageOptions: phase === "write"
        ? { setErrors: new Map([[LOCAL_DATABASE_KEY, cause]]) }
        : undefined,
    })
    const dependencyOverrides = phase === "admission"
      ? { assertSessionAdmission() { throw cause } }
      : phase === "fence"
        ? { assertOwnerFence() { throw cause } }
        : {}
    const expectedCode = phase === "write" ? "mutation-write-failed" : "mutation-lease-lost"

    await assert.rejects(
      commitPreparedLocalDatabaseCandidate(
        args,
        mutationDependencies(fixture, dependencyOverrides),
      ),
      error => error instanceof LocalDatabaseError
        && error.code === expectedCode
        && error.cause === cause
        && error.details.phase === phase
        && error.details.commitState === "unchanged"
        && error.details.expectedCurrentRaw === args.expectedCurrentRaw
        && error.details.candidateRaw === args.candidateRaw,
    )
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), phase === "write" ? 1 : 0)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY), args.expectedCurrentRaw)
  }
})

test("prepared readback failures are unknown and never retry or roll back", async () => {
  const args = preparedArgs()
  const readCause = new Error("prepared readback denied")
  const readbacks = [readCause, null, "different", '{"works":[']

  for (const actualRaw of readbacks) {
    const fixture = createMutationFixture({
      raw: args.expectedCurrentRaw,
      storageOptions: {
        getSequences: new Map([[
          LOCAL_DATABASE_KEY,
          [args.expectedCurrentRaw, actualRaw],
        ]]),
      },
    })
    const expectedCode = actualRaw instanceof Error
      ? "mutation-readback-failed"
      : "mutation-verification-failed"
    await assert.rejects(
      commitPreparedLocalDatabaseCandidate(args, mutationDependencies(fixture)),
      error => error instanceof LocalDatabaseError
        && error.code === expectedCode
        && error.details.commitState === "unknown"
        && error.details.expectedCurrentRaw === args.expectedCurrentRaw
        && error.details.candidateRaw === args.candidateRaw
        && (actualRaw instanceof Error
          ? error.cause === actualRaw && !Object.hasOwn(error.details, "actualRaw")
          : error.details.actualRaw === actualRaw),
    )
    assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
    assert.equal(fixture.keyedStorage.count("getItem", LOCAL_DATABASE_KEY), 2)
    assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
    assert.equal(fixture.keyedStorage.peek(LOCAL_DATABASE_KEY), args.candidateRaw)
  }
})

test("confirmed-not-written prepared retry keeps one preallocated id and never reapplies", async () => {
  const expectedCurrentRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const candidateRaw = JSON.stringify({
    works: [{ id: "preallocated-id", value: "created-once" }],
    contacts: [],
    groups: [],
  })
  const fixture = createMutationFixture({ raw: expectedCurrentRaw })
  const common = {
    workId: "preallocated-id",
    ownerId: "owner-1",
    leaseId: "lease-1",
    restoreGeneration: null,
    expectedCurrentRaw,
    candidateRaw,
  }

  const checked = await recheckUnknownLocalDatabaseCommit(common, {
    storage: fixture.storage,
    lockManager: fixture.lockManager,
    assertSessionAdmission: fixture.assertSessionAdmission,
  })
  assert.deepEqual(checked, { outcome: "not-written" })

  const result = await commitPreparedLocalDatabaseCandidate({
    ...common,
    operationId: "retry-operation",
  }, mutationDependencies(fixture))

  assert.equal(result.ok, true)
  assert.equal(result.raw, candidateRaw)
  assert.equal(result.database.works.filter(work => work.id === "preallocated-id").length, 1)
  assert.equal(fixture.keyedStorage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.keyedStorage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})
