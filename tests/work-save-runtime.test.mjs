import assert from "node:assert/strict"
import test from "node:test"

import { openWorkSaveRuntime } from "../js/work-save-runtime.js"
import { createJsonToken } from "../js/local-database-mutation.js"
import {
  DATABASE_WRITE_LOCK_NAME,
  createWebLocksAdapter,
  getWorkLockName,
} from "../js/local-locks.js"
import {
  LOCAL_RESTORE_GENERATION_KEY,
  getWorkOwnerKey,
} from "../js/local-write-metadata.js"
import { LOCAL_DATABASE_KEY } from "../js/storage.js"
import { openWorkEditSession } from "../js/work-edit-session.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

function createScheduler() {
  let currentTime = 0
  let nextHandle = 0
  const intervals = new Map()
  const timeouts = new Map()
  const timeoutRecords = new Map()
  const scheduler = {
    setInterval(callback, delay) {
      nextHandle += 1
      intervals.set(nextHandle, { callback, delay })
      return nextHandle
    },
    clearInterval(handle) {
      intervals.delete(handle)
    },
    setTimeout(callback, delay) {
      nextHandle += 1
      const record = { callback, delay }
      timeouts.set(nextHandle, record)
      timeoutRecords.set(nextHandle, record)
      return nextHandle
    },
    clearTimeout(handle) {
      timeouts.delete(handle)
    },
    activeIntervals() {
      return intervals.size
    },
    activeTimeouts() {
      return timeouts.size
    },
    advance(milliseconds) {
      const target = currentTime + milliseconds
      while (true) {
        const next = [...timeouts.entries()]
          .filter(([, record]) => record.dueAt <= target)
          .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0]
        if (next === undefined) break
        currentTime = next[1].dueAt
        timeouts.delete(next[0])
        next[1].callback()
      }
      currentTime = target
    },
    timeoutHandles() {
      return [...timeouts.keys()]
    },
    fireTimeoutEvenIfCleared(handle) {
      timeoutRecords.get(handle)?.callback()
    },
  }
  const originalSetTimeout = scheduler.setTimeout
  scheduler.setTimeout = (callback, delay) => {
    const handle = originalSetTimeout(callback, delay)
    timeouts.get(handle).dueAt = currentTime + delay
    return handle
  }
  return scheduler
}

function createFixture({ database, raw, secure = true, now = 1_000, storage: suppliedStorage } = {}) {
  const nativeLocks = createFakeLockManager()
  const lockManager = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: secure })
  const initialRaw = raw ?? JSON.stringify(database ?? {
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })
  const storage = suppliedStorage ?? createKeyedStorage([
    [LOCAL_DATABASE_KEY, initialRaw],
    ["unrelated", "keep"],
  ])
  const scheduler = createScheduler()
  let sequence = 0
  return {
    lockManager,
    nativeLocks,
    now: () => now,
    scheduler,
    storage,
    createId(kind) {
      sequence += 1
      return `${kind}-${sequence}`
    },
    options(overrides = {}) {
      return {
        workId: "work-a",
        storage,
        lockManager,
        scheduler,
        now: () => now,
        createId(kind) {
          sequence += 1
          return `${kind}-${sequence}`
        },
        ...overrides,
      }
    },
  }
}

function createControlledStorage(database) {
  const base = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(database)]])
  let databaseWriteMode = "normal"
  let conflictRaw = null
  let readbackFailure = null
  let databaseWriteAttempts = 0

  const storage = {
    getItem(key) {
      if (String(key) === LOCAL_DATABASE_KEY && readbackFailure !== null) {
        const failure = readbackFailure
        readbackFailure = null
        throw failure
      }
      return base.getItem(key)
    },
    setItem(key, value) {
      const normalizedKey = String(key)
      if (normalizedKey !== LOCAL_DATABASE_KEY) return base.setItem(key, value)
      databaseWriteAttempts += 1
      const mode = databaseWriteMode
      databaseWriteMode = "normal"
      if (mode === "ignore") return
      base.setItem(key, value)
      if (mode === "readback-error") {
        readbackFailure = new Error("readback unavailable")
      } else if (mode === "replace-after-write") {
        base.setItem(key, conflictRaw)
      }
    },
    removeItem: base.removeItem.bind(base),
    key: base.key.bind(base),
    get length() {
      return base.length
    },
    peek: base.peek.bind(base),
    count: base.count.bind(base),
  }

  return {
    storage,
    base,
    armReadbackError() {
      databaseWriteMode = "readback-error"
    },
    armIgnoredWrite() {
      databaseWriteMode = "ignore"
    },
    armConflictAfterWrite(raw) {
      conflictRaw = raw
      databaseWriteMode = "replace-after-write"
    },
    databaseWriteAttempts() {
      return databaseWriteAttempts
    },
  }
}

function assertFailureSnapshot(snapshot, { state, error, availability = null }) {
  assert.deepEqual(snapshot, {
    state,
    pendingCount: 0,
    activeBatchId: null,
    lastSavedAt: null,
    error,
    canRetry: false,
    canRecheck: false,
    hasRecoverableCandidate: false,
    generation: 0,
    otherActiveEditors: [],
    availability,
  })
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.otherActiveEditors), true)
}

async function settleMicrotasks() {
  for (let index = 0; index < 32; index += 1) await Promise.resolve()
}

function titleOperation(title, key = "field:title") {
  return {
    key,
    payload: { title },
    apply(work, payload) {
      return { ...work, title: payload.title }
    },
  }
}

function ownerRecord({
  workId,
  ownerId,
  leaseId,
  heartbeatAt = 1_000,
}) {
  return {
    version: 1,
    workId,
    ownerId,
    leaseId,
    heartbeatAt,
    expiresAt: heartbeatAt + 60_000,
  }
}

function generationRecord(generationId, changedAt = 1_000) {
  return { version: 1, generationId, changedAt }
}

function installGlobalEventTarget(t) {
  const originalAdd = globalThis.addEventListener
  const originalRemove = globalThis.removeEventListener
  const listeners = new Map()
  let removeFailure = null
  globalThis.addEventListener = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(listener)
  }
  globalThis.removeEventListener = (type, listener) => {
    if (removeFailure !== null) throw removeFailure
    listeners.get(type)?.delete(listener)
  }
  t.after(() => {
    if (originalAdd === undefined) delete globalThis.addEventListener
    else globalThis.addEventListener = originalAdd
    if (originalRemove === undefined) delete globalThis.removeEventListener
    else globalThis.removeEventListener = originalRemove
  })
  return {
    dispatch(type, event) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event)
    },
    count(type) {
      return listeners.get(type)?.size ?? 0
    },
    failRemove(error) {
      removeFailure = error
    },
  }
}

test("exports the per-work save runtime opener", () => {
  assert.equal(typeof openWorkSaveRuntime, "function")
})

test("missing work returns the exact read-only failure and releases its acquired session", async () => {
  const fixture = createFixture({ database: { works: [], contacts: [], groups: [] } })

  const result = await openWorkSaveRuntime(fixture.options())

  assert.deepEqual(Object.keys(result), ["ok", "code", "error", "work", "snapshot"])
  assert.equal(result.ok, false)
  assert.equal(result.code, "work-missing")
  assert.equal(result.error.code, "work-missing")
  assert.equal(result.work, null)
  assertFailureSnapshot(result.snapshot, {
    state: "conflict",
    error: result.error,
  })
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.storage.peek("unrelated"), "keep")
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("Web Locks unavailability preserves a cloned work for read-only rendering", async () => {
  const fixture = createFixture({ secure: false })
  const storedWork = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0]

  const result = await openWorkSaveRuntime(fixture.options())

  assert.equal(result.ok, false)
  assert.equal(result.code, "mutation-lock-unavailable")
  assert.notEqual(result.work, storedWork)
  assert.deepEqual(result.work, storedWork)
  assertFailureSnapshot(result.snapshot, {
    state: "lease-lost",
    error: result.error,
  })
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("held work exposes only validated stale takeover availability", async () => {
  const fixture = createFixture({ now: 61_000 })
  const old = await openWorkEditSession(fixture.options({
    now: () => 1_000,
    createId: kind => `${kind}-old`,
  }))
  assert.equal(old.ok, true)

  const result = await openWorkSaveRuntime(fixture.options())

  assert.equal(result.ok, false)
  assert.equal(result.code, "work-locked")
  assert.deepEqual(result.work, JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0])
  assert.deepEqual(result.snapshot.availability, {
    ownerId: "owner-old",
    leaseId: "lease-old",
    expiresAt: 61_000,
    isStale: true,
    canTakeover: true,
  })
  assertFailureSnapshot(result.snapshot, {
    state: "lease-lost",
    error: result.error,
    availability: result.snapshot.availability,
  })
  assert.equal(fixture.scheduler.activeIntervals(), 1)
  assert.deepEqual(fixture.nativeLocks.snapshot().held.map(lock => lock.name), [
    "tuuru:library-session",
    getWorkLockName("work-a"),
  ])

  await old.session.dispose()
})

test("post-session initialization failure clears only self and releases work then library", async () => {
  const fixture = createFixture({ raw: "{" })

  const result = await openWorkSaveRuntime(fixture.options())

  assert.equal(result.ok, false)
  assert.equal(result.code, "runtime-init-failed")
  assert.equal(result.work, null)
  assertFailureSnapshot(result.snapshot, {
    state: "conflict",
    error: result.error,
  })
  assert.equal(fixture.storage.peek(LOCAL_DATABASE_KEY), "{")
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.storage.peek("unrelated"), "keep")
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("coordinator construction failure disposes the partial runtime", async () => {
  const fixture = createFixture()
  const sessionOnlyScheduler = {
    setInterval: fixture.scheduler.setInterval,
    clearInterval: fixture.scheduler.clearInterval,
  }

  const result = await openWorkSaveRuntime(fixture.options({ scheduler: sessionOnlyScheduler }))

  assert.equal(result.ok, false)
  assert.equal(result.code, "runtime-init-failed")
  assert.deepEqual(result.work, JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0])
  assertFailureSnapshot(result.snapshot, {
    state: "conflict",
    error: result.error,
  })
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("two work runtimes serialize through the shared database lock without losing either edit", async () => {
  const nativeLocks = createFakeLockManager()
  const lockManager = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: true })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({
    works: [
      { id: "work-a", title: "A0", updatedAt: 0 },
      { id: "work-b", title: "B0", updatedAt: 0 },
    ],
    contacts: [],
    groups: [],
  })]])
  const scheduler = createScheduler()
  let sequence = 0
  const open = workId => openWorkSaveRuntime({
    workId,
    storage,
    lockManager,
    scheduler,
    now: () => 100,
    createId: kind => `${workId}-${kind}-${++sequence}`,
  })
  const [first, second] = await Promise.all([open("work-a"), open("work-b")])
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)

  first.runtime.stage(titleOperation("A1"))
  second.runtime.stage(titleOperation("B1"))
  await Promise.all([first.runtime.flush(), second.runtime.flush()])

  assert.deepEqual(
    JSON.parse(storage.peek(LOCAL_DATABASE_KEY)).works.map(work => [work.id, work.title]),
    [["work-a", "A1"], ["work-b", "B1"]],
  )
  await Promise.all([first.runtime.dispose(), second.runtime.dispose()])
  assert.deepEqual(nativeLocks.snapshot(), { held: [], pending: [] })
})

test("readWork clones the verified baseline plus ordinary pending operations before debounce", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)

  opened.runtime.stage(titleOperation("pending"))
  const candidate = opened.runtime.readWork()
  candidate.title = "mutated-return-value"

  assert.equal(opened.runtime.readWork().title, "pending")
  assert.equal(JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0].title, "before")
  assert.equal(fixture.scheduler.activeTimeouts(), 2)

  await opened.runtime.flush()
  await opened.runtime.dispose()
})

test("another-work database storage event reinspects latest raw and later commit preserves it", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture({ database: {
    works: [
      { id: "work-a", title: "A0", updatedAt: 0 },
      { id: "work-b", title: "B0", updatedAt: 0 },
    ],
    contacts: [],
    groups: [],
  } })
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  assert.equal(events.count("storage"), 1)
  const readsBefore = fixture.storage.count("getItem", LOCAL_DATABASE_KEY)
  const changedRaw = JSON.stringify({
    works: [
      { id: "work-a", title: "A0", updatedAt: 0 },
      { id: "work-b", title: "B-external", updatedAt: 50 },
    ],
    contacts: [],
    groups: [],
  })
  fixture.storage.setItem(LOCAL_DATABASE_KEY, changedRaw)

  events.dispatch("storage", {
    key: LOCAL_DATABASE_KEY,
    newValue: changedRaw,
    storageArea: fixture.storage,
  })
  await settleMicrotasks()

  assert.ok(fixture.storage.count("getItem", LOCAL_DATABASE_KEY) > readsBefore)
  assert.equal(opened.runtime.snapshot().state, "clean")
  opened.runtime.stage(titleOperation("A1"))
  await opened.runtime.flush()
  assert.deepEqual(
    JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works.map(work => work.title),
    ["A1", "B-external"],
  )

  await opened.runtime.dispose()
  assert.equal(events.count("storage"), 0)
})

test("readWork preserves a structural barrier before a later same-key field", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  const databaseHold = await fixture.lockManager.hold(DATABASE_WRITE_LOCK_NAME)

  const barrier = opened.runtime.commitNow({
    key: "structure:barrier",
    payload: { suffix: "|barrier" },
    consumes: [],
    apply(work, payload) {
      return { ...work, title: `${work.title}${payload.suffix}` }
    },
  })
  const later = opened.runtime.stage(titleOperation("after-barrier"))

  assert.equal(later.generation, 2)
  assert.equal(opened.runtime.readWork().title, "after-barrier")

  databaseHold.release()
  await databaseHold.released
  await barrier
  await opened.runtime.flush()
  await opened.runtime.dispose()
})

test("active other owners populate warnings and owner events update only that overlay", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const otherKey = getWorkOwnerKey("work-b")
  const other = ownerRecord({
    workId: "work-b",
    ownerId: "owner-b",
    leaseId: "lease-b",
  })
  fixture.storage.setItem(otherKey, JSON.stringify(other))
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)

  assert.deepEqual(opened.runtime.snapshot().otherActiveEditors, [other])
  assert.equal(opened.runtime.snapshot().state, "clean")
  fixture.storage.removeItem(otherKey)
  events.dispatch("storage", {
    key: otherKey,
    newValue: null,
    storageArea: fixture.storage,
  })

  assert.deepEqual(opened.runtime.snapshot().otherActiveEditors, [])
  assert.equal(opened.runtime.snapshot().state, "clean")
  await opened.runtime.dispose()
})

test("current owner loss stays first-wins across later current-database events", async t => {
  const events = installGlobalEventTarget(t)
  for (const [mode, replacement] of [
    ["missing", null],
    ["corrupt", "{"],
    ["changed", JSON.stringify(ownerRecord({
      workId: "work-a",
      ownerId: "owner-external",
      leaseId: "lease-external",
      heartbeatAt: 2_000,
    }))],
  ]) {
    const fixture = createFixture()
    const opened = await openWorkSaveRuntime(fixture.options())
    assert.equal(opened.ok, true, mode)
    opened.runtime.stage(titleOperation(`recover-${mode}`))
    assert.equal(fixture.scheduler.activeTimeouts(), 2, mode)
    assert.equal(fixture.scheduler.activeIntervals(), 1, mode)
    const ownerKey = getWorkOwnerKey("work-a")
    if (replacement === null) fixture.storage.removeItem(ownerKey)
    else fixture.storage.setItem(ownerKey, replacement)

    events.dispatch("storage", {
      key: ownerKey,
      newValue: replacement,
      storageArea: fixture.storage,
    })

    const snapshot = opened.runtime.snapshot()
    assert.equal(snapshot.state, "lease-lost", mode)
    assert.equal(snapshot.error.code, "mutation-lease-lost", mode)
    assert.equal(fixture.scheduler.activeTimeouts(), 0, mode)
    assert.equal(fixture.scheduler.activeIntervals(), 0, mode)
    assert.throws(() => opened.runtime.stage(titleOperation("denied")), reason => (
      reason === snapshot.error
    ), mode)
    assert.equal(opened.runtime.readWork().title, `recover-${mode}`, mode)
    assert.equal(opened.runtime.recoveryMaterial().kind, "ordinary", mode)

    const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
    const changedRaw = JSON.stringify({
      ...database,
      works: [{ ...database.works[0], title: "external-after-loss", updatedAt: 90 }],
    })
    fixture.storage.setItem(LOCAL_DATABASE_KEY, changedRaw)
    events.dispatch("storage", {
      key: LOCAL_DATABASE_KEY,
      newValue: changedRaw,
      storageArea: fixture.storage,
    })
    assert.equal(opened.runtime.snapshot().state, "lease-lost", mode)
    assert.equal(opened.runtime.snapshot().error, snapshot.error, mode)

    await opened.runtime.dispose()
    assert.equal(fixture.storage.peek(ownerKey), replacement, mode)
  }
})

test("unrelated corrupt owner metadata never revokes the current work", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const retainedKey = getWorkOwnerKey("work-retained")
  const retained = ownerRecord({
    workId: "work-retained",
    ownerId: "owner-retained",
    leaseId: "lease-retained",
  })
  fixture.storage.setItem(retainedKey, JSON.stringify(retained))
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  assert.deepEqual(opened.runtime.snapshot().otherActiveEditors, [retained])
  const otherKey = getWorkOwnerKey("work-corrupt")
  fixture.storage.setItem(otherKey, "{")

  events.dispatch("storage", {
    key: otherKey,
    newValue: "{",
    storageArea: fixture.storage,
  })

  assert.equal(opened.runtime.snapshot().state, "clean")
  assert.deepEqual(opened.runtime.snapshot().otherActiveEditors, [retained])
  opened.runtime.stage(titleOperation("still-writable"))
  await opened.runtime.flush()
  assert.equal(opened.runtime.snapshot().state, "clean")
  await opened.runtime.dispose()
})

test("missing, corrupt, or changed restore-generation events synchronously lose the lease", async t => {
  const events = installGlobalEventTarget(t)
  for (const [label, replacement] of [
    ["missing", null],
    ["corrupt", "{"],
    ["changed", JSON.stringify(generationRecord("generation-b", 2_000))],
  ]) {
    const fixture = createFixture()
    fixture.storage.setItem(
      LOCAL_RESTORE_GENERATION_KEY,
      JSON.stringify(generationRecord("generation-a")),
    )
    const opened = await openWorkSaveRuntime(fixture.options())
    assert.equal(opened.ok, true, label)
    opened.runtime.stage(titleOperation(`recover-${label}`))
    if (replacement === null) fixture.storage.removeItem(LOCAL_RESTORE_GENERATION_KEY)
    else fixture.storage.setItem(LOCAL_RESTORE_GENERATION_KEY, replacement)

    events.dispatch("storage", {
      key: LOCAL_RESTORE_GENERATION_KEY,
      newValue: replacement,
      storageArea: fixture.storage,
    })

    assert.equal(opened.runtime.snapshot().state, "lease-lost", label)
    assert.equal(fixture.scheduler.activeTimeouts(), 0, label)
    assert.equal(fixture.scheduler.activeIntervals(), 0, label)
    assert.equal(opened.runtime.readWork().title, `recover-${label}`, label)
    await opened.runtime.dispose()
  }
})

test("a key-null storage clear synchronously loses the current lease", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  opened.runtime.stage(titleOperation("recover-clear"))

  events.dispatch("storage", {
    key: null,
    newValue: null,
    storageArea: fixture.storage,
  })

  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.equal(opened.runtime.readWork().title, "recover-clear")
  await opened.runtime.dispose()
})

test("external current-work replacement or deletion becomes public conflict and retains candidate", async t => {
  const events = installGlobalEventTarget(t)
  for (const mode of ["replacement", "deletion"]) {
    const fixture = createFixture()
    const opened = await openWorkSaveRuntime(fixture.options())
    assert.equal(opened.ok, true)
    opened.runtime.stage(titleOperation(`local-${mode}`))
    const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
    const works = mode === "replacement"
      ? [{ ...database.works[0], title: "external", updatedAt: 90 }]
      : []
    const changedRaw = JSON.stringify({ ...database, works })
    fixture.storage.setItem(LOCAL_DATABASE_KEY, changedRaw)

    events.dispatch("storage", {
      key: LOCAL_DATABASE_KEY,
      newValue: changedRaw,
      storageArea: fixture.storage,
    })

    const snapshot = opened.runtime.snapshot()
    assert.equal(snapshot.state, "conflict", mode)
    assert.equal(snapshot.error.code, "mutation-conflict", mode)
    assert.equal(fixture.scheduler.activeTimeouts(), 0, mode)
    assert.throws(() => opened.runtime.stage(titleOperation("denied")), reason => (
      reason === snapshot.error
    ))
    assert.equal(opened.runtime.readWork().title, `local-${mode}`, mode)
    assert.equal(opened.runtime.recoveryMaterial().kind, "ordinary", mode)
    await opened.runtime.dispose()
  }
})

test("verified batches advance the expected token and set updatedAt once per batch", async () => {
  let clock = 100
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => clock }))
  assert.equal(opened.ok, true)
  const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)

  opened.runtime.stage(titleOperation("first"))
  const first = await opened.runtime.flush()
  assert.equal(
    first.workToken,
    createJsonToken(first.database.works.find(work => work.id === "work-a")),
  )
  assert.equal(opened.runtime.readWork().updatedAt, 100)
  clock = 200
  opened.runtime.stage(titleOperation("second"))
  const second = await opened.runtime.flush()

  const stored = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0]
  assert.equal(stored.title, "second")
  assert.equal(stored.updatedAt, 200)
  assert.notEqual(second.workToken, first.workToken)
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 2)
  assert.equal(opened.runtime.snapshot().state, "clean")
  await opened.runtime.dispose()
})

test("pre-write conflict and invalid identity leave stored updatedAt unchanged", async () => {
  for (const mode of ["conflict", "identity"] ) {
    const fixture = createFixture()
    const opened = await openWorkSaveRuntime(fixture.options({ now: () => 500 }))
    assert.equal(opened.ok, true)
    const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)
    let boundary
    if (mode === "conflict") {
      opened.runtime.stage(titleOperation("local"))
      const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
      fixture.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify({
        ...database,
        works: [{ ...database.works[0], title: "external", updatedAt: 77 }],
      }))
      boundary = opened.runtime.flush()
    } else {
      opened.runtime.stage({
        key: "field:identity",
        payload: null,
        apply(work) {
          return { ...work, id: "work-other", updatedAt: 999 }
        },
      })
      boundary = opened.runtime.flush()
    }

    await assert.rejects(boundary)
    const stored = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0]
    assert.equal(stored.updatedAt, mode === "conflict" ? 77 : 10)
    assert.equal(
      fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore,
      mode === "conflict" ? 1 : 0,
    )
    await opened.runtime.dispose()
  }
})

test("unknown saved recheck adopts verified raw then applies only later operations", async () => {
  const controlled = createControlledStorage({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })
  const fixture = createFixture({ storage: controlled.storage })
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => 100 }))
  assert.equal(opened.ok, true)
  let uncertainApplyCalls = 0
  controlled.armReadbackError()
  opened.runtime.stage({
    key: "field:uncertain",
    payload: { title: "uncertain" },
    apply(work, payload) {
      uncertainApplyCalls += 1
      if (uncertainApplyCalls > 1) throw new Error("uncertain callback replayed")
      return { ...work, title: payload.title }
    },
  })
  const boundary = opened.runtime.flush()
  opened.runtime.stage(titleOperation("later", "field:later"))

  await assert.rejects(boundary, error => error.code === "mutation-readback-failed")
  assert.equal(opened.runtime.snapshot().state, "error-unknown")
  assert.equal(opened.runtime.readWork().title, "later")
  const outcome = await opened.runtime.recheck()
  assert.equal(outcome.outcome, "saved")
  await opened.runtime.drain()

  assert.equal(uncertainApplyCalls, 1)
  assert.equal(JSON.parse(controlled.storage.peek(LOCAL_DATABASE_KEY)).works[0].title, "later")
  assert.equal(opened.runtime.snapshot().state, "clean")
  await opened.runtime.dispose()
})

test("a saved unknown recheck cannot re-enable editing after native ownership loss", async () => {
  const controlled = createControlledStorage({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })
  let fixture
  let loseOwnershipOnRead = false
  const storage = {
    getItem(key) {
      const value = controlled.storage.getItem(key)
      if (loseOwnershipOnRead && String(key) === LOCAL_DATABASE_KEY) {
        loseOwnershipOnRead = false
        fixture.nativeLocks.terminateHeld(getWorkLockName("work-a"))
      }
      return value
    },
    setItem: controlled.storage.setItem.bind(controlled.storage),
    removeItem: controlled.storage.removeItem.bind(controlled.storage),
    key: controlled.storage.key.bind(controlled.storage),
    get length() {
      return controlled.storage.length
    },
  }
  fixture = createFixture({ storage })
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => 100 }))
  assert.equal(opened.ok, true)
  controlled.armReadbackError()
  opened.runtime.stage(titleOperation("uncertain"))
  await assert.rejects(
    opened.runtime.flush(),
    error => error.code === "mutation-readback-failed",
  )
  loseOwnershipOnRead = true

  await assert.rejects(opened.runtime.recheck(), error => (
    error.code === "mutation-lease-lost"
  ))

  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.equal(opened.runtime.readWork().title, "uncertain")
  assert.throws(() => opened.runtime.stage(titleOperation("denied")), error => (
    error.code === "mutation-lease-lost"
  ))
  await opened.runtime.dispose()
})

test("a not-written recheck cannot become retryable after native ownership loss", async () => {
  const controlled = createControlledStorage({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })
  let fixture
  let loseOwnershipOnRead = false
  const storage = {
    getItem(key) {
      const value = controlled.storage.getItem(key)
      if (loseOwnershipOnRead && String(key) === LOCAL_DATABASE_KEY) {
        loseOwnershipOnRead = false
        fixture.nativeLocks.terminateHeld(getWorkLockName("work-a"))
      }
      return value
    },
    setItem: controlled.storage.setItem.bind(controlled.storage),
    removeItem: controlled.storage.removeItem.bind(controlled.storage),
    key: controlled.storage.key.bind(controlled.storage),
    get length() {
      return controlled.storage.length
    },
  }
  fixture = createFixture({ storage })
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => 100 }))
  assert.equal(opened.ok, true)
  controlled.armIgnoredWrite()
  opened.runtime.stage(titleOperation("uncertain"))
  await assert.rejects(
    opened.runtime.flush(),
    error => error.code === "mutation-verification-failed",
  )
  loseOwnershipOnRead = true

  await assert.rejects(opened.runtime.recheck(), error => (
    error.code === "mutation-lease-lost"
  ))

  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.equal(opened.runtime.recoveryMaterial().kind, "unknown")
  await assert.rejects(opened.runtime.retry(), error => (
    error.code === "mutation-lease-lost"
  ))
  await opened.runtime.dispose()
})

test("unknown not-written retry commits the prepared bytes without callback replay", async () => {
  const controlled = createControlledStorage({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })
  const fixture = createFixture({ storage: controlled.storage })
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => 100 }))
  assert.equal(opened.ok, true)
  let uncertainApplyCalls = 0
  controlled.armIgnoredWrite()
  opened.runtime.stage({
    key: "field:uncertain",
    payload: { title: "prepared" },
    apply(work, payload) {
      uncertainApplyCalls += 1
      if (uncertainApplyCalls > 1) throw new Error("uncertain callback replayed")
      return { ...work, title: payload.title }
    },
  })
  const boundary = opened.runtime.flush()
  opened.runtime.stage(titleOperation("later", "field:later"))

  await assert.rejects(boundary, error => error.code === "mutation-verification-failed")
  assert.equal((await opened.runtime.recheck()).outcome, "not-written")
  await opened.runtime.retry()
  await opened.runtime.drain()

  assert.equal(uncertainApplyCalls, 1)
  assert.equal(controlled.databaseWriteAttempts(), 3)
  assert.equal(JSON.parse(controlled.storage.peek(LOCAL_DATABASE_KEY)).works[0].title, "later")
  await opened.runtime.dispose()
})

test("unknown conflict freezes with candidate and later edits without replay", async () => {
  const initial = {
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  }
  const thirdRaw = JSON.stringify({
    ...initial,
    works: [{ ...initial.works[0], title: "third", updatedAt: 90 }],
  })
  const controlled = createControlledStorage(initial)
  const fixture = createFixture({ storage: controlled.storage })
  const opened = await openWorkSaveRuntime(fixture.options({ now: () => 100 }))
  assert.equal(opened.ok, true)
  let uncertainApplyCalls = 0
  controlled.armConflictAfterWrite(thirdRaw)
  opened.runtime.stage({
    key: "field:uncertain",
    payload: { title: "uncertain" },
    apply(work, payload) {
      uncertainApplyCalls += 1
      if (uncertainApplyCalls > 1) throw new Error("uncertain callback replayed")
      return { ...work, title: payload.title }
    },
  })
  const boundary = opened.runtime.flush()
  opened.runtime.stage(titleOperation("later", "field:later"))

  await assert.rejects(boundary, error => error.code === "mutation-verification-failed")
  const outcome = await opened.runtime.recheck()
  assert.equal(outcome.outcome, "conflict")
  assert.equal(opened.runtime.snapshot().state, "conflict")
  assert.equal(opened.runtime.readWork().title, "later")
  assert.equal(opened.runtime.recoveryMaterial().kind, "unknown")
  assert.equal(uncertainApplyCalls, 1)
  assert.throws(() => opened.runtime.stage(titleOperation("denied")))
  await opened.runtime.dispose()
})

test("prepareEmergencyBackup includes a staged sub-debounce recovery-only candidate", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  opened.runtime.stage(titleOperation("emergency"))

  const backup = opened.runtime.prepareEmergencyBackup()

  assert.deepEqual(backup, {
    kind: "recovery-only",
    workId: "work-a",
    candidate: { id: "work-a", title: "emergency", updatedAt: 10 },
  })
  assert.equal(Object.isFrozen(backup), true)
  assert.equal(JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0].title, "before")
  await opened.runtime.dispose()
})

test("suspend gates every public save action synchronously, drains, and releases ownership", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  opened.runtime.stage(titleOperation("suspended-save"))

  const suspension = opened.runtime.suspend()
  let gateError
  assert.throws(() => opened.runtime.stage(titleOperation("denied")), error => {
    gateError = error
    return error.code === "runtime-suspended"
  })
  assert.throws(() => opened.runtime.commitNow({
    key: "structure:denied",
    payload: null,
    consumes: [],
    apply: work => work,
  }), error => error === gateError)
  for (const method of ["flush", "drain", "retry", "recheck"]) {
    await assert.rejects(opened.runtime[method](), error => error === gateError, method)
  }
  const snapshot = await suspension

  assert.equal(snapshot.state, "clean")
  assert.equal(opened.runtime.readWork().title, "suspended-save")
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })

  await opened.runtime.resume()
  opened.runtime.stage(titleOperation("resumed-save"))
  await opened.runtime.flush()
  assert.equal(opened.runtime.readWork().title, "resumed-save")
  await opened.runtime.dispose()
})

test("suspend releases ownership and retains recovery when its best-effort drain fails", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  opened.runtime.stage(titleOperation("recover-after-failed-drain"))
  const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
  fixture.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify({
    ...database,
    works: [{ ...database.works[0], title: "external", updatedAt: 90 }],
  }))

  const snapshot = await opened.runtime.suspend()

  assert.equal(snapshot.state, "conflict")
  assert.equal(snapshot.error.code, "mutation-conflict")
  assert.equal(opened.runtime.readWork().title, "recover-after-failed-drain")
  assert.equal(opened.runtime.recoveryMaterial().kind, "ordinary")
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  await opened.runtime.dispose()
})

test("dispose cannot be reopened after an in-flight suspend settles", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  const databaseHold = await fixture.lockManager.hold(
    DATABASE_WRITE_LOCK_NAME,
    { mode: "exclusive" },
  )
  opened.runtime.stage(titleOperation("blocked-suspend"))

  const suspension = opened.runtime.suspend()
  const reopenAttempt = suspension.then(() => opened.runtime.resume())
  const disposal = opened.runtime.dispose()
  databaseHold.release()
  await databaseHold.released

  await assert.rejects(reopenAttempt, error => error.code === "save-disposed")
  const disposed = await disposal
  assert.equal(disposed.state, "disposed")
  assert.equal(opened.runtime.snapshot().state, "disposed")
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
})

test("a terminal owner event while resume waits cannot publish its provisional session", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  await opened.runtime.suspend()
  const databaseHold = await fixture.lockManager.hold(
    DATABASE_WRITE_LOCK_NAME,
    { mode: "exclusive" },
  )

  const resumption = opened.runtime.resume()
  await settleMicrotasks()
  assert.equal(
    fixture.nativeLocks.snapshot().pending.some(lock => (
      lock.name === DATABASE_WRITE_LOCK_NAME
    )),
    true,
  )
  const ownerKey = getWorkOwnerKey("work-a")
  assert.equal(fixture.storage.peek(ownerKey), null)
  events.dispatch("storage", {
    key: ownerKey,
    newValue: null,
    storageArea: fixture.storage,
  })
  const terminalError = opened.runtime.snapshot().error
  assert.equal(opened.runtime.snapshot().state, "lease-lost")

  databaseHold.release()
  await databaseHold.released
  await assert.rejects(resumption, error => error === terminalError)
  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.equal(opened.runtime.snapshot().error, terminalError)
  assert.equal(fixture.storage.peek(ownerKey), null)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  await opened.runtime.dispose()
})

test("resume rechecks provisional native ownership before publishing", async () => {
  const base = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })]])
  let fixture
  let loseOwnershipOnRead = false
  const storage = {
    getItem(key) {
      const value = base.getItem(key)
      if (loseOwnershipOnRead && String(key) === LOCAL_DATABASE_KEY) {
        loseOwnershipOnRead = false
        fixture.nativeLocks.terminateHeld(getWorkLockName("work-a"))
      }
      return value
    },
    setItem: base.setItem.bind(base),
    removeItem: base.removeItem.bind(base),
    key: base.key.bind(base),
    get length() {
      return base.length
    },
  }
  fixture = createFixture({ storage })
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  await opened.runtime.suspend()
  loseOwnershipOnRead = true

  await assert.rejects(opened.runtime.resume(), error => (
    error.code === "mutation-lease-lost"
  ))

  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.equal(base.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  await opened.runtime.dispose()
})

test("settled suspension cannot bypass disposed or lease-lost lifecycle gates", async t => {
  const events = installGlobalEventTarget(t)
  const disposedFixture = createFixture()
  const disposedOpen = await openWorkSaveRuntime(disposedFixture.options())
  assert.equal(disposedOpen.ok, true)
  const firstSuspension = disposedOpen.runtime.suspend()
  await firstSuspension
  const disposed = await disposedOpen.runtime.dispose()

  const afterDispose = disposedOpen.runtime.suspend()
  assert.notEqual(afterDispose, firstSuspension)
  await assert.rejects(afterDispose, error => error === disposed.error)

  const lostFixture = createFixture()
  const lostOpen = await openWorkSaveRuntime(lostFixture.options())
  assert.equal(lostOpen.ok, true)
  const cleanSuspension = lostOpen.runtime.suspend()
  await cleanSuspension
  events.dispatch("storage", {
    key: getWorkOwnerKey("work-a"),
    newValue: null,
    storageArea: lostFixture.storage,
  })
  const terminalError = lostOpen.runtime.snapshot().error
  assert.equal(lostOpen.runtime.snapshot().state, "lease-lost")

  const afterLoss = lostOpen.runtime.suspend()
  assert.notEqual(afterLoss, cleanSuspension)
  await assert.rejects(afterLoss, error => error === terminalError)
  await lostOpen.runtime.dispose()
})

test("resume rejects a changed work token or restore generation and cannot write back", async () => {
  for (const mode of ["work-token", "generation"]) {
    const fixture = createFixture()
    fixture.storage.setItem(
      LOCAL_RESTORE_GENERATION_KEY,
      JSON.stringify(generationRecord("generation-a")),
    )
    const opened = await openWorkSaveRuntime(fixture.options())
    assert.equal(opened.ok, true)
    await opened.runtime.suspend()
    if (mode === "work-token") {
      const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
      fixture.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify({
        ...database,
        works: [{ ...database.works[0], title: "restored", updatedAt: 999 }],
      }))
    } else {
      fixture.storage.setItem(
        LOCAL_RESTORE_GENERATION_KEY,
        JSON.stringify(generationRecord("generation-b", 2_000)),
      )
    }

    await assert.rejects(opened.runtime.resume(), error => error.code === "mutation-lease-lost")
    assert.equal(opened.runtime.snapshot().state, "lease-lost", mode)
    assert.throws(() => opened.runtime.stage(titleOperation("must-not-write")), error => (
      error.code === "mutation-lease-lost"
    ))
    assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
    assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
    await opened.runtime.dispose()
  }
})

test("resume accepts another-work changes and the next save preserves them", async () => {
  const fixture = createFixture({
    database: {
      works: [
        { id: "work-a", title: "before", updatedAt: 10 },
        { id: "work-b", title: "other-before", updatedAt: 20 },
      ],
      contacts: [],
      groups: [],
    },
  })
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  await opened.runtime.suspend()
  const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
  fixture.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify({
    ...database,
    works: database.works.map(work => work.id === "work-b"
      ? { ...work, title: "other-external", updatedAt: 90 }
      : work),
  }))

  await opened.runtime.resume()
  opened.runtime.stage(titleOperation("after-resume"))
  await opened.runtime.flush()

  const stored = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
  assert.equal(stored.works.find(work => work.id === "work-a").title, "after-resume")
  assert.equal(stored.works.find(work => work.id === "work-b").title, "other-external")
  await opened.runtime.dispose()
})

test("dispose wins a suspended resume race without reviving ownership", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  await opened.runtime.suspend()

  const resumption = opened.runtime.resume()
  const disposal = opened.runtime.dispose()
  const [resumeOutcome, disposed] = await Promise.all([
    resumption.then(
      value => ({ status: "fulfilled", value }),
      reason => ({ status: "rejected", reason }),
    ),
    disposal,
  ])

  assert.equal(resumeOutcome.status, "rejected")
  assert.equal(resumeOutcome.reason.code, "save-disposed")
  assert.equal(disposed.state, "disposed")
  assert.equal(opened.runtime.snapshot().state, "disposed")
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.equal(events.count("storage"), 0)
})

test("dispose drains pending work, unregisters once, and stale timers stay harmless", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  opened.runtime.stage(titleOperation("dispose-save"))
  const staleTimers = fixture.scheduler.timeoutHandles()
  const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)

  const first = opened.runtime.dispose()
  const second = opened.runtime.dispose()
  assert.equal(first, second)
  const disposed = await first

  assert.equal(disposed.state, "disposed")
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 1)
  assert.equal(JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY)).works[0].title, "dispose-save")
  assert.equal(events.count("storage"), 0)
  assert.equal(fixture.storage.count("removeItem", getWorkOwnerKey("work-a")), 1)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
  for (const handle of staleTimers) fixture.scheduler.fireTimeoutEvenIfCleared(handle)
  await settleMicrotasks()
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 1)
})

test("a failed listener removal leaves an inert disposed storage handler", async t => {
  const events = installGlobalEventTarget(t)
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)
  events.failRemove(new Error("remove listener failed"))

  const disposed = await opened.runtime.dispose()
  const terminalError = disposed.error
  const readsBeforeEvent = fixture.storage.count("getItem", LOCAL_DATABASE_KEY)

  const database = JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
  const changedRaw = JSON.stringify({
    ...database,
    works: [{ ...database.works[0], title: "after-dispose", updatedAt: 90 }],
  })
  fixture.storage.setItem(LOCAL_DATABASE_KEY, changedRaw)
  events.dispatch("storage", {
    key: LOCAL_DATABASE_KEY,
    newValue: changedRaw,
    storageArea: fixture.storage,
  })

  assert.equal(disposed.state, "disposed")
  assert.equal(opened.runtime.snapshot(), disposed)
  assert.equal(opened.runtime.snapshot().error, terminalError)
  assert.equal(fixture.storage.count("getItem", LOCAL_DATABASE_KEY), readsBeforeEvent)
  assert.throws(() => opened.runtime.stage(titleOperation("denied")), error => (
    error === terminalError
  ))
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.scheduler.activeIntervals(), 0)
  assert.equal(fixture.scheduler.activeTimeouts(), 0)
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("a verified admitted batch stays lease-lost when native ownership is stolen", async () => {
  const nativeLocks = createFakeLockManager()
  const lockManager = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: true })
  const base = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({
    works: [{ id: "work-a", title: "before", updatedAt: 10 }],
    contacts: [],
    groups: [],
  })]])
  let stealOnDatabaseRead = false
  const storage = {
    getItem(key) {
      const value = base.getItem(key)
      if (stealOnDatabaseRead && String(key) === LOCAL_DATABASE_KEY) {
        stealOnDatabaseRead = false
        nativeLocks.terminateHeld(getWorkLockName("work-a"))
      }
      return value
    },
    setItem: base.setItem.bind(base),
    removeItem: base.removeItem.bind(base),
    key: base.key.bind(base),
    get length() {
      return base.length
    },
  }
  const scheduler = createScheduler()
  let sequence = 0
  const opened = await openWorkSaveRuntime({
    workId: "work-a",
    storage,
    lockManager,
    scheduler,
    now: () => 100,
    createId: kind => `${kind}-${++sequence}`,
  })
  assert.equal(opened.ok, true)
  stealOnDatabaseRead = true
  opened.runtime.stage(titleOperation("verified-before-loss"))

  await assert.rejects(opened.runtime.flush(), error => error.code === "mutation-lease-lost")

  assert.equal(JSON.parse(base.peek(LOCAL_DATABASE_KEY)).works[0].title, "verified-before-loss")
  assert.equal(opened.runtime.snapshot().state, "lease-lost")
  assert.throws(() => opened.runtime.stage(titleOperation("denied")), error => (
    error.code === "mutation-lease-lost"
  ))
  await opened.runtime.dispose()
})

test("two suspend-resume cycles reacquire fresh sessions while concurrent resumes share one Promise", async () => {
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options())
  assert.equal(opened.ok, true)

  await opened.runtime.suspend()
  const firstResume = opened.runtime.resume()
  const sameFirstResume = opened.runtime.resume()
  assert.equal(firstResume, sameFirstResume)
  await firstResume
  const firstOwner = JSON.parse(fixture.storage.peek(getWorkOwnerKey("work-a")))

  await opened.runtime.suspend()
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  const secondResume = opened.runtime.resume()
  assert.notEqual(secondResume, firstResume)
  await secondResume
  const secondOwner = JSON.parse(fixture.storage.peek(getWorkOwnerKey("work-a")))

  assert.notEqual(secondOwner.ownerId, firstOwner.ownerId)
  assert.notEqual(secondOwner.leaseId, firstOwner.leaseId)
  opened.runtime.stage(titleOperation("second-cycle"))
  await opened.runtime.flush()
  await opened.runtime.dispose()
})

test("resume never reuses initial takeover permission to steal a newly active editor", async () => {
  let clock = 1_000
  const fixture = createFixture()
  const opened = await openWorkSaveRuntime(fixture.options({
    takeover: true,
    now: () => clock,
  }))
  assert.equal(opened.ok, true)
  await opened.runtime.suspend()
  const external = await openWorkEditSession(fixture.options({
    now: () => 1_000,
    createId: kind => `${kind}-external`,
  }))
  assert.equal(external.ok, true)
  clock = 61_000

  await assert.rejects(opened.runtime.resume(), error => error.code === "work-locked")

  assert.equal(external.session.assertWritable(), true)
  assert.equal(
    JSON.parse(fixture.storage.peek(getWorkOwnerKey("work-a"))).ownerId,
    "owner-external",
  )
  await opened.runtime.dispose()
  await external.session.dispose()
})
