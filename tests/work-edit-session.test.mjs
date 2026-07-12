import test from "node:test"
import assert from "node:assert/strict"

import {
  WorkEditSessionError,
  inspectWorkEditAvailability,
  openWorkEditSession,
  runWithWorkEditSession,
} from "../js/work-edit-session.js"
import {
  DATABASE_WRITE_LOCK_NAME,
  LIBRARY_SESSION_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
  getWorkLockName,
} from "../js/local-locks.js"
import {
  LOCAL_RESTORE_GENERATION_KEY,
  getWorkOwnerKey,
  readWorkOwner,
  writeAndVerifyWorkOwner,
} from "../js/local-write-metadata.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitFor(predicate, description) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await nextTurn()
  }
  assert.fail(`Timed out waiting for ${description}`)
}

function ownerRecord({
  workId = "work-a",
  ownerId = "owner-old",
  leaseId = "lease-old",
  heartbeatAt = 0,
} = {}) {
  return Object.freeze({
    version: 1,
    workId,
    ownerId,
    leaseId,
    heartbeatAt,
    expiresAt: heartbeatAt + 60_000,
  })
}

function generationRecord(generationId = "generation-a", changedAt = 1) {
  return Object.freeze({ version: 1, generationId, changedAt })
}

function createScheduler(events = []) {
  const intervals = new Map()
  let nextHandle = 1

  return Object.freeze({
    setInterval(callback, delay) {
      const handle = nextHandle
      nextHandle += 1
      intervals.set(handle, { callback, delay })
      events.push(["timer:set", handle, delay])
      return handle
    },
    clearInterval(handle) {
      events.push(["timer:clear", handle])
      intervals.delete(handle)
    },
    activeCount() {
      return intervals.size
    },
    delays() {
      return [...intervals.values()].map(interval => interval.delay)
    },
    tick(handle) {
      intervals.get(handle)?.callback()
    },
    tickAll() {
      for (const interval of [...intervals.values()]) interval.callback()
    },
  })
}

function createFixture({ storage, adapter: suppliedAdapter, manager: suppliedManager } = {}) {
  const manager = suppliedManager ?? createFakeLockManager()
  const adapter = suppliedAdapter ?? createWebLocksAdapter({
    locks: manager,
    isSecureContext: true,
  })
  const events = []
  const scheduler = createScheduler(events)
  const localStorage = storage ?? createKeyedStorage([["unrelated", "keep"]])
  let timestamp = 1_000
  const idCounts = { owner: 0, lease: 0 }

  return {
    adapter,
    events,
    manager,
    scheduler,
    storage: localStorage,
    advance(milliseconds) {
      timestamp += milliseconds
    },
    setNow(value) {
      timestamp = value
    },
    now() {
      return timestamp
    },
    createId(kind) {
      idCounts[kind] += 1
      return `${kind}-${idCounts[kind]}`
    },
    options(workId = "work-a", overrides = {}) {
      return {
        workId,
        storage: localStorage,
        lockManager: adapter,
        scheduler,
        now: () => timestamp,
        createId(kind) {
          idCounts[kind] += 1
          return `${kind}-${idCounts[kind]}`
        },
        ...overrides,
      }
    },
  }
}

test("exports the work edit session public API and stable error contract", () => {
  assert.equal(typeof openWorkEditSession, "function")
  assert.equal(typeof runWithWorkEditSession, "function")
  assert.equal(typeof inspectWorkEditAvailability, "function")

  const cause = new Error("native ownership ended")
  const details = Object.freeze({ workId: "work-a" })
  const error = new WorkEditSessionError(
    "The edit session is no longer writable",
    "mutation-lease-lost",
    cause,
    details,
  )

  assert.equal(error.name, "WorkEditSessionError")
  assert.equal(error.message, "The edit session is no longer writable")
  assert.equal(error.code, "mutation-lease-lost")
  assert.equal(error.cause, cause)
  assert.equal(error.details, details)
})

test("availability inspection is read-only, frozen, and uses the exact stale boundary", () => {
  const workId = "draft / 雪"
  const record = ownerRecord({ workId, heartbeatAt: 1_000 })
  const key = getWorkOwnerKey(workId)
  const storage = createKeyedStorage([[key, JSON.stringify(record)], ["unrelated", "keep"]])

  const fresh = inspectWorkEditAvailability({ workId, storage, now: () => 60_999 })
  const stale = inspectWorkEditAvailability({ workId, storage, now: () => 61_000 })

  assert.deepEqual(fresh, {
    ownerId: record.ownerId,
    leaseId: record.leaseId,
    expiresAt: record.expiresAt,
    isStale: false,
    canTakeover: false,
  })
  assert.deepEqual(stale, { ...fresh, isStale: true, canTakeover: true })
  assert.equal(Object.isFrozen(fresh), true)
  assert.equal(Object.isFrozen(stale), true)
  assert.equal(storage.peek(key), JSON.stringify(record))
  assert.equal(storage.peek("unrelated"), "keep")
  assert.deepEqual(
    storage.calls.map(call => call.method),
    ["getItem", "getItem"],
  )
  assert.equal(
    inspectWorkEditAvailability({
      workId: "missing",
      storage,
      now: () => 61_000,
    }),
    null,
  )
})

test("missing Web Locks returns a read-only result without IDs, timers, or storage access", async () => {
  const storage = createKeyedStorage([["unrelated", "keep"]])
  const scheduler = createScheduler()
  const lockManager = createWebLocksAdapter({ locks: null, isSecureContext: true })
  let idCalls = 0
  let nowCalls = 0

  const result = await openWorkEditSession({
    workId: "work-a",
    storage,
    lockManager,
    scheduler,
    now() {
      nowCalls += 1
      return 1_000
    },
    createId() {
      idCalls += 1
      return "unused"
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "mutation-lock-unavailable")
  assert.ok(result.error instanceof LocalLockUnavailableError)
  assert.equal(result.error.code, "mutation-lock-unavailable")
  assert.equal(result.availability, null)
  assert.equal(idCalls, 0)
  assert.equal(nowCalls, 0)
  assert.equal(scheduler.activeCount(), 0)
  assert.deepEqual(storage.calls, [])
  assert.equal(storage.peek("unrelated"), "keep")
})

test("opening registers an immutable session only while all three locks are held", async () => {
  const manager = createFakeLockManager()
  const snapshots = []
  const workId = "draft / 雪"
  const key = getWorkOwnerKey(workId)
  const storage = createKeyedStorage([["unrelated", "keep"]], {
    afterSet(changedKey) {
      if (changedKey === key) snapshots.push(manager.snapshot())
    },
  })
  const fixture = createFixture({ manager, storage })

  const result = await openWorkEditSession(fixture.options(workId))

  assert.equal(result.ok, true)
  const { session } = result
  assert.equal(Object.isFrozen(session), true)
  assert.equal(session.ownerId, "owner-1")
  assert.equal(session.leaseId, "lease-1")
  assert.equal(session.restoreGeneration, null)
  assert.deepEqual(Object.keys(session), [
    "ownerId",
    "leaseId",
    "restoreGeneration",
    "assertWritable",
    "assertSessionAdmission",
    "assertOwnerFence",
    "refreshHeartbeat",
    "markLeaseLost",
    "dispose",
  ])
  assert.deepEqual(readWorkOwner(workId, storage), ownerRecord({
    workId,
    ownerId: "owner-1",
    leaseId: "lease-1",
    heartbeatAt: 1_000,
  }))
  assert.deepEqual(snapshots, [{
    held: [
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
      { name: getWorkLockName(workId), mode: "exclusive" },
      { name: DATABASE_WRITE_LOCK_NAME, mode: "exclusive" },
    ],
    pending: [],
  }])
  assert.deepEqual(fixture.scheduler.delays(), [15_000])
  assert.equal(storage.peek("unrelated"), "keep")

  await session.dispose()
})

test("same-work contention returns immediately, releases its library hold, and preserves owner data", async () => {
  const fixture = createFixture()
  const first = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(first.ok, true)
  const ownerBefore = fixture.storage.peek(getWorkOwnerKey("work-a"))

  const second = await openWorkEditSession(fixture.options("work-a"))

  assert.equal(second.ok, false)
  assert.equal(second.code, "work-locked")
  assert.ok(second.error instanceof WorkEditSessionError)
  assert.equal(second.error.code, "work-locked")
  assert.deepEqual(second.availability, {
    ownerId: "owner-1",
    leaseId: "lease-1",
    expiresAt: 61_000,
    isStale: false,
    canTakeover: false,
  })
  assert.deepEqual(fixture.manager.snapshot(), {
    held: [
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
      { name: getWorkLockName("work-a"), mode: "exclusive" },
    ],
    pending: [],
  })
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), ownerBefore)
  assert.equal(fixture.scheduler.activeCount(), 1)

  await first.session.dispose()
})

test("a failed work acquisition releases the temporary library handle without owner mutation", async () => {
  const fixture = createFixture()
  const externalWork = await fixture.adapter.hold(getWorkLockName("work-a"))

  const result = await openWorkEditSession(fixture.options("work-a"))

  assert.equal(result.ok, false)
  assert.equal(result.code, "work-locked")
  assert.deepEqual(fixture.manager.snapshot(), {
    held: [{ name: getWorkLockName("work-a"), mode: "exclusive" }],
    pending: [],
  })
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.equal(fixture.storage.count("setItem", getWorkOwnerKey("work-a")), 0)
  assert.equal(fixture.storage.count("removeItem", getWorkOwnerKey("work-a")), 0)
  assert.equal(fixture.scheduler.activeCount(), 0)

  externalWork.release()
  await externalWork.released
})

test("different works hold shared library sessions concurrently", async () => {
  const fixture = createFixture()
  const first = await openWorkEditSession(fixture.options("work-a"))
  const second = await openWorkEditSession(fixture.options("work-b"))

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual(fixture.manager.snapshot(), {
    held: [
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
      { name: getWorkLockName("work-a"), mode: "exclusive" },
      { name: getWorkLockName("work-b"), mode: "exclusive" },
    ],
    pending: [],
  })

  await Promise.all([first.session.dispose(), second.session.dispose()])
})

test("a free native work lock replaces a valid fresh orphan without steal", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const holdCalls = []
  const tracedAdapter = Object.freeze({
    available: true,
    request: adapter.request,
    hold(name, options) {
      holdCalls.push({ name, options: { ...options } })
      return adapter.hold(name, options)
    },
  })
  const orphan = ownerRecord({ heartbeatAt: 900 })
  const storage = createKeyedStorage([
    [getWorkOwnerKey(orphan.workId), JSON.stringify(orphan)],
    ["unrelated", "keep"],
  ])
  const fixture = createFixture({ storage, adapter: tracedAdapter, manager })

  const result = await openWorkEditSession(fixture.options(orphan.workId))

  assert.equal(result.ok, true)
  assert.deepEqual(readWorkOwner(orphan.workId, storage), ownerRecord({
    workId: orphan.workId,
    ownerId: "owner-1",
    leaseId: "lease-1",
    heartbeatAt: 1_000,
  }))
  assert.deepEqual(holdCalls, [
    {
      name: LIBRARY_SESSION_LOCK_NAME,
      options: { mode: "shared", ifAvailable: true },
    },
    {
      name: getWorkLockName(orphan.workId),
      options: { mode: "exclusive", ifAvailable: true },
    },
  ])
  assert.equal(storage.peek("unrelated"), "keep")

  await result.session.dispose()
})

test("programmer errors fail before locks, timers, or storage mutations", async () => {
  const cases = [
    { overrides: { workId: "" }, error: TypeError },
    { overrides: { now: () => -1 }, error: RangeError },
    { overrides: { createId: () => "" }, error: TypeError },
    { overrides: { takeover: "yes" }, error: TypeError },
  ]

  for (const { overrides, error } of cases) {
    const fixture = createFixture()
    await assert.rejects(
      openWorkEditSession({ ...fixture.options("work-a"), ...overrides }),
      error,
    )
    assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
    assert.equal(fixture.scheduler.activeCount(), 0)
    assert.deepEqual(fixture.storage.calls, [])
  }
})

test("owner and lease mismatches fail closed and disposal preserves the replacement", async () => {
  const replacements = [
    ownerRecord({ ownerId: "owner-other", leaseId: "lease-1", heartbeatAt: 2_000 }),
    ownerRecord({ ownerId: "owner-1", leaseId: "lease-other", heartbeatAt: 2_000 }),
    null,
  ]

  for (const replacement of replacements) {
    const fixture = createFixture()
    const result = await openWorkEditSession(fixture.options("work-a"))
    assert.equal(result.ok, true)
    const key = getWorkOwnerKey("work-a")
    if (replacement === null) fixture.storage.removeItem(key)
    else fixture.storage.setItem(key, JSON.stringify(replacement))

    assert.throws(
      () => result.session.assertSessionAdmission(),
      error => error instanceof WorkEditSessionError
        && error.code === "mutation-lease-lost",
    )
    await result.session.dispose()
    assert.equal(
      fixture.storage.peek(key),
      replacement === null ? null : JSON.stringify(replacement),
    )
    assert.equal(fixture.storage.peek("unrelated"), "keep")
  }
})

test("corrupt owner metadata remains the cause of a fail-closed lease loss", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const key = getWorkOwnerKey("work-a")
  fixture.storage.setItem(key, "{")

  assert.throws(
    () => result.session.assertOwnerFence(),
    error => error instanceof WorkEditSessionError
      && error.code === "mutation-lease-lost"
      && error.cause?.code === "metadata-corrupt",
  )
  await assert.rejects(result.session.dispose(), error => error.code === "metadata-corrupt")
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.storage.peek(key), "{")
})

test("restore generation is captured and every admission and owner fence rechecks it", async () => {
  const initial = generationRecord("generation-a", 100)
  const storage = createKeyedStorage([
    [LOCAL_RESTORE_GENERATION_KEY, JSON.stringify(initial)],
    ["unrelated", "keep"],
  ])
  const fixture = createFixture({ storage })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)

  assert.equal(result.session.restoreGeneration, "generation-a")
  assert.equal(result.session.assertSessionAdmission(), true)
  assert.equal(result.session.assertOwnerFence(), true)

  const changed = generationRecord("generation-b", 200)
  storage.setItem(LOCAL_RESTORE_GENERATION_KEY, JSON.stringify(changed))
  assert.throws(
    () => result.session.assertSessionAdmission(),
    error => error instanceof WorkEditSessionError
      && error.code === "mutation-lease-lost",
  )

  await result.session.dispose()
  assert.equal(storage.peek(LOCAL_RESTORE_GENERATION_KEY), JSON.stringify(changed))
  assert.equal(storage.peek("unrelated"), "keep")
})

test("generation corruption is retained as the cause of admission failure", async () => {
  const storage = createKeyedStorage([
    [LOCAL_RESTORE_GENERATION_KEY, JSON.stringify(generationRecord())],
  ])
  const fixture = createFixture({ storage })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  storage.setItem(LOCAL_RESTORE_GENERATION_KEY, "{")

  assert.throws(
    () => result.session.assertSessionAdmission(),
    error => error instanceof WorkEditSessionError
      && error.code === "mutation-lease-lost"
      && error.cause?.code === "metadata-corrupt",
  )
  await result.session.dispose()
})

test("native loss blocks admission immediately while an admitted owner fence ignores it", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)

  assert.equal(fixture.manager.terminateHeld(getWorkLockName("work-a")), true)
  await waitFor(
    () => {
      try {
        result.session.assertWritable()
        return false
      } catch {
        return true
      }
    },
    "the native work loss to become observable",
  )

  assert.throws(
    () => result.session.assertSessionAdmission(),
    error => error.code === "mutation-lease-lost",
  )
  assert.equal(result.session.assertOwnerFence(), true)
  await result.session.dispose()
})

test("heartbeat runs every 15 seconds under the database lock with exact readback", async () => {
  const manager = createFakeLockManager()
  const workId = "work-a"
  const key = getWorkOwnerKey(workId)
  const writeSnapshots = []
  const storage = createKeyedStorage([["unrelated", "keep"]], {
    afterSet(changedKey) {
      if (changedKey === key) writeSnapshots.push(manager.snapshot())
    },
  })
  const fixture = createFixture({ manager, storage })
  const result = await openWorkEditSession(fixture.options(workId))
  assert.equal(result.ok, true)
  fixture.advance(15_000)
  const setsBefore = storage.count("setItem", key)

  fixture.scheduler.tickAll()
  await waitFor(
    () => storage.count("setItem", key) === setsBefore + 1,
    "the scheduled heartbeat write",
  )

  assert.deepEqual(readWorkOwner(workId, storage), ownerRecord({
    workId,
    ownerId: "owner-1",
    leaseId: "lease-1",
    heartbeatAt: 16_000,
  }))
  assert.deepEqual(writeSnapshots.at(-1), {
    held: [
      { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
      { name: getWorkLockName(workId), mode: "exclusive" },
      { name: DATABASE_WRITE_LOCK_NAME, mode: "exclusive" },
    ],
    pending: [],
  })
  const lastSetIndex = storage.calls.findLastIndex(call => call.method === "setItem" && call.key === key)
  assert.deepEqual(
    storage.calls.slice(lastSetIndex - 2, lastSetIndex + 2).map(call => [call.method, call.key]),
    [
      ["getItem", key],
      ["getItem", LOCAL_RESTORE_GENERATION_KEY],
      ["setItem", key],
      ["getItem", key],
    ],
  )
  assert.equal(storage.peek("unrelated"), "keep")

  await result.session.dispose()
})

test("manual heartbeat refresh is single-flight while waiting for the database lock", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
  fixture.advance(15_000)
  const setsBefore = fixture.storage.count("setItem", getWorkOwnerKey("work-a"))

  const first = result.session.refreshHeartbeat()
  const second = result.session.refreshHeartbeat()

  assert.equal(first, second)
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 1,
    "one queued heartbeat database request",
  )
  databaseHolder.release()
  await databaseHolder.released
  await Promise.all([first, second])
  assert.equal(
    fixture.storage.count("setItem", getWorkOwnerKey("work-a")),
    setsBefore + 1,
  )

  await result.session.dispose()
})

test("dispose makes a queued heartbeat harmless before clearing its owner", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
  const key = getWorkOwnerKey("work-a")
  const setsBefore = fixture.storage.count("setItem", key)

  fixture.scheduler.tickAll()
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 1,
    "the queued timer heartbeat",
  )
  const disposal = result.session.dispose()
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 2,
    "heartbeat and disposal cleanup requests",
  )

  databaseHolder.release()
  await databaseHolder.released
  await disposal
  assert.equal(fixture.storage.count("setItem", key), setsBefore)
  assert.equal(fixture.storage.peek(key), null)
  assert.equal(fixture.scheduler.activeCount(), 0)
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
})

test("heartbeat owner failure loses and disposes the session without clearing a replacement", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const replacement = ownerRecord({
    ownerId: "owner-new",
    leaseId: "lease-new",
    heartbeatAt: 2_000,
  })
  const key = getWorkOwnerKey("work-a")
  fixture.storage.setItem(key, JSON.stringify(replacement))

  await assert.rejects(
    result.session.refreshHeartbeat(),
    error => error instanceof WorkEditSessionError
      && error.code === "mutation-lease-lost",
  )
  assert.equal(fixture.storage.peek(key), JSON.stringify(replacement))
  assert.equal(fixture.scheduler.activeCount(), 0)
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  assert.throws(
    () => result.session.assertWritable(),
    error => error.code === "work-session-disposed",
  )
})

test("stale metadata never causes an implicit takeover", async () => {
  const fixture = createFixture()
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)

  const result = await openWorkEditSession(fixture.options("work-a"))

  assert.equal(result.ok, false)
  assert.equal(result.code, "work-locked")
  assert.equal(result.availability.isStale, true)
  assert.equal(result.availability.canTakeover, true)
  assert.equal(old.session.assertWritable(), true)
  assert.equal(readWorkOwner("work-a", fixture.storage).ownerId, old.session.ownerId)
  await old.session.dispose()
})

test("explicit takeover is denied at 59,999 ms and steals exactly at 60,000 ms", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const holdCalls = []
  const tracedAdapter = Object.freeze({
    available: true,
    request: adapter.request,
    hold(name, options) {
      holdCalls.push({ name, options: { ...options } })
      return adapter.hold(name, options)
    },
  })
  const fixture = createFixture({ manager, adapter: tracedAdapter })
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)

  fixture.setNow(60_999)
  const early = await openWorkEditSession(fixture.options("work-a", { takeover: true }))
  assert.equal(early.ok, false)
  assert.equal(early.code, "work-locked")
  assert.equal(early.availability.isStale, false)
  assert.equal(holdCalls.some(call => call.options.steal === true), false)

  fixture.setNow(61_000)
  const replacement = await openWorkEditSession(fixture.options("work-a", { takeover: true }))
  assert.equal(replacement.ok, true)
  assert.equal(replacement.session.ownerId, "owner-3")
  assert.equal(replacement.session.leaseId, "lease-3")
  assert.deepEqual(
    holdCalls.filter(call => call.options.steal === true),
    [{
      name: getWorkLockName("work-a"),
      options: { mode: "exclusive", steal: true },
    }],
  )
  assert.deepEqual(readWorkOwner("work-a", fixture.storage), ownerRecord({
    ownerId: "owner-3",
    leaseId: "lease-3",
    heartbeatAt: 61_000,
  }))
  assert.throws(
    () => old.session.assertWritable(),
    error => error.code === "mutation-lease-lost",
  )

  await old.session.dispose()
  assert.equal(readWorkOwner("work-a", fixture.storage).ownerId, "owner-3")
  await replacement.session.dispose()
})

test("an already-admitted database commit finishes before takeover registration", async () => {
  const manager = createFakeLockManager()
  const events = []
  const workId = "work-a"
  const key = getWorkOwnerKey(workId)
  const storage = createKeyedStorage([], {
    afterSet(changedKey, raw) {
      if (changedKey !== key) return
      const owner = JSON.parse(raw)
      if (owner.ownerId !== "owner-1") events.push("takeover:register")
    },
  })
  const fixture = createFixture({ manager, storage })
  const old = await openWorkEditSession(fixture.options(workId))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  const admitted = deferred()
  const finish = deferred()

  const commit = fixture.adapter.request(DATABASE_WRITE_LOCK_NAME, async () => {
    old.session.assertSessionAdmission()
    events.push("commit:admitted")
    admitted.resolve()
    await finish.promise
    old.session.assertOwnerFence()
    events.push("commit:finished")
  })
  await admitted.promise

  const opening = openWorkEditSession(fixture.options(workId, { takeover: true }))
  await waitFor(
    () => {
      try {
        old.session.assertWritable()
        return false
      } catch {
        return true
      }
    },
    "takeover to end the old native work lock",
  )
  assert.deepEqual(events, ["commit:admitted"])

  finish.resolve()
  await commit
  const replacement = await opening
  assert.equal(replacement.ok, true)
  assert.deepEqual(events, ["commit:admitted", "commit:finished", "takeover:register"])

  await old.session.dispose()
  await replacement.session.dispose()
})

test("the exact stale token may perform its final admitted refresh before takeover registers", async () => {
  const fixture = createFixture()
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  const admitted = deferred()
  const finish = deferred()

  const finalRefresh = fixture.adapter.request(DATABASE_WRITE_LOCK_NAME, async () => {
    old.session.assertSessionAdmission()
    admitted.resolve()
    await finish.promise
    old.session.assertOwnerFence()
    writeAndVerifyWorkOwner({
      workId: "work-a",
      ownerId: old.session.ownerId,
      leaseId: old.session.leaseId,
      heartbeatAt: 61_000,
    }, fixture.storage)
  })
  await admitted.promise
  const opening = openWorkEditSession(fixture.options("work-a", { takeover: true }))
  await waitFor(
    () => fixture.manager.snapshot().pending.some(lock => lock.name === DATABASE_WRITE_LOCK_NAME),
    "takeover registration behind the admitted refresh",
  )
  finish.resolve()
  await finalRefresh

  const replacement = await opening
  assert.equal(replacement.ok, true)
  assert.equal(readWorkOwner("work-a", fixture.storage).ownerId, replacement.session.ownerId)

  await old.session.dispose()
  await replacement.session.dispose()
})

test("a merely queued old commit fails admission with zero writes after steal", async () => {
  const fixture = createFixture()
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
  let writes = 0

  const queuedCommit = fixture.adapter.request(DATABASE_WRITE_LOCK_NAME, () => {
    old.session.assertSessionAdmission()
    writes += 1
  })
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 1,
    "the queued old commit",
  )
  const opening = openWorkEditSession(fixture.options("work-a", { takeover: true }))
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 2,
    "old commit followed by takeover registration",
  )

  databaseHolder.release()
  await databaseHolder.released
  await assert.rejects(
    queuedCommit,
    error => error.code === "mutation-lease-lost",
  )
  const replacement = await opening
  assert.equal(replacement.ok, true)
  assert.equal(writes, 0)

  await old.session.dispose()
  await replacement.session.dispose()
})

test("a queued old heartbeat cannot overwrite the replacement after takeover", async () => {
  const fixture = createFixture()
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
  const key = getWorkOwnerKey("work-a")
  const setsBefore = fixture.storage.count("setItem", key)
  const lateHeartbeat = old.session.refreshHeartbeat()
  await waitFor(() => fixture.manager.snapshot().pending.length === 1, "the late heartbeat")

  const opening = openWorkEditSession(fixture.options("work-a", { takeover: true }))
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 2,
    "heartbeat followed by takeover registration",
  )
  databaseHolder.release()
  await databaseHolder.released

  await assert.rejects(
    lateHeartbeat,
    error => error.code === "mutation-lease-lost",
  )
  const replacement = await opening
  assert.equal(replacement.ok, true)
  assert.equal(fixture.storage.count("setItem", key), setsBefore + 1)
  assert.equal(readWorkOwner("work-a", fixture.storage).ownerId, replacement.session.ownerId)

  await replacement.session.dispose()
})

test("takeover refuses a different owner token or changed restore generation", async () => {
  for (const changedKind of ["owner", "generation"]) {
    const storage = createKeyedStorage([
      [LOCAL_RESTORE_GENERATION_KEY, JSON.stringify(generationRecord("generation-a", 1))],
      ["unrelated", "keep"],
    ])
    const fixture = createFixture({ storage })
    const old = await openWorkEditSession(fixture.options("work-a"))
    assert.equal(old.ok, true)
    fixture.setNow(61_000)
    const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
    const opening = openWorkEditSession(fixture.options("work-a", { takeover: true }))
    await waitFor(
      () => fixture.manager.snapshot().pending.length === 1,
      `the ${changedKind} revalidation gate`,
    )

    let expectedOwnerRaw
    if (changedKind === "owner") {
      const replacement = ownerRecord({
        ownerId: "owner-external",
        leaseId: "lease-external",
        heartbeatAt: 61_000,
      })
      expectedOwnerRaw = JSON.stringify(replacement)
      storage.setItem(getWorkOwnerKey("work-a"), expectedOwnerRaw)
    } else {
      expectedOwnerRaw = storage.peek(getWorkOwnerKey("work-a"))
      storage.setItem(
        LOCAL_RESTORE_GENERATION_KEY,
        JSON.stringify(generationRecord("generation-b", 2)),
      )
    }

    databaseHolder.release()
    await databaseHolder.released
    await assert.rejects(
      opening,
      error => error.code === "mutation-lease-lost",
    )
    assert.equal(storage.peek(getWorkOwnerKey("work-a")), expectedOwnerRaw)
    assert.equal(storage.peek("unrelated"), "keep")
    assert.deepEqual(fixture.manager.snapshot(), {
      held: [{ name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" }],
      pending: [],
    })
    await old.session.dispose()
    assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  }
})

test("two simultaneous explicit takeovers let only the final native holder register", async () => {
  const fixture = createFixture()
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  const databaseHolder = await fixture.adapter.hold(DATABASE_WRITE_LOCK_NAME)
  const key = getWorkOwnerKey("work-a")
  const setsBefore = fixture.storage.count("setItem", key)

  const first = openWorkEditSession(fixture.options("work-a", { takeover: true }))
  const second = openWorkEditSession(fixture.options("work-a", { takeover: true }))
  await waitFor(
    () => fixture.manager.snapshot().pending.length === 2,
    "both takeover registrations",
  )
  databaseHolder.release()
  await databaseHolder.released

  const settled = await Promise.allSettled([first, second])
  const successes = settled.filter(result => result.status === "fulfilled" && result.value.ok)
  const failures = settled.filter(result => result.status === "rejected")
  assert.equal(successes.length, 1)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].reason.code, "mutation-lease-lost")
  assert.equal(fixture.storage.count("setItem", key), setsBefore + 1)
  assert.equal(readWorkOwner("work-a", fixture.storage).ownerId, successes[0].value.session.ownerId)

  await old.session.dispose()
  await successes[0].value.session.dispose()
})

test("library contention is immediate and never reaches the work lock or owner storage", async () => {
  const fixture = createFixture()
  const libraryHolder = await fixture.adapter.hold(LIBRARY_SESSION_LOCK_NAME)

  const result = await openWorkEditSession(fixture.options("work-a"))

  assert.equal(result.ok, false)
  assert.equal(result.code, "work-locked")
  assert.equal(result.availability, null)
  assert.deepEqual(fixture.manager.snapshot(), {
    held: [{ name: LIBRARY_SESSION_LOCK_NAME, mode: "exclusive" }],
    pending: [],
  })
  assert.equal(fixture.storage.count("setItem", getWorkOwnerKey("work-a")), 0)
  assert.equal(fixture.storage.count("removeItem", getWorkOwnerKey("work-a")), 0)
  assert.equal(fixture.scheduler.activeCount(), 0)

  libraryHolder.release()
  await libraryHolder.released
})

test("availability inspection fails closed for corrupt or unreadable owner metadata", () => {
  const key = getWorkOwnerKey("work-a")
  const corrupt = createKeyedStorage([[key, "{"], ["unrelated", "keep"]])
  assert.throws(
    () => inspectWorkEditAvailability({ workId: "work-a", storage: corrupt, now: () => 1 }),
    error => error.code === "metadata-corrupt",
  )
  assert.equal(corrupt.peek(key), "{")
  assert.equal(corrupt.peek("unrelated"), "keep")

  const cause = new Error("storage denied")
  const unreadable = createKeyedStorage([], {
    getErrors: new Map([[key, cause]]),
  })
  assert.throws(
    () => inspectWorkEditAvailability({ workId: "work-a", storage: unreadable, now: () => 1 }),
    error => error.code === "metadata-read-failed" && error.cause === cause,
  )
  assert.equal(unreadable.count("setItem", key), 0)
  assert.equal(unreadable.count("removeItem", key), 0)
})

test("dispose is idempotent, clears exactly its token, and releases work before library", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const releases = []
  const tracedAdapter = Object.freeze({
    available: true,
    request: adapter.request,
    async hold(name, options) {
      const handle = await adapter.hold(name, options)
      if (handle === null) return null
      return Object.freeze({
        name: handle.name,
        mode: handle.mode,
        isLost: handle.isLost,
        lost: handle.lost,
        released: handle.released,
        release() {
          releases.push(name)
          handle.release()
        },
      })
    },
  })
  const fixture = createFixture({ manager, adapter: tracedAdapter })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const key = getWorkOwnerKey("work-a")

  const first = result.session.dispose()
  const second = result.session.dispose()
  assert.equal(first, second)
  await Promise.all([first, second])

  assert.equal(fixture.storage.count("removeItem", key), 1)
  assert.equal(fixture.storage.peek(key), null)
  assert.deepEqual(releases, [getWorkLockName("work-a"), LIBRARY_SESSION_LOCK_NAME])
  assert.equal(fixture.scheduler.activeCount(), 0)
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  assert.throws(
    () => result.session.assertOwnerFence(),
    error => error.code === "work-session-disposed",
  )
  await assert.rejects(
    result.session.refreshHeartbeat(),
    error => error.code === "work-session-disposed",
  )
})

test("markLeaseLost is stable, cancels heartbeat, and does not mutate metadata or release locks", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const key = getWorkOwnerKey("work-a")
  const raw = fixture.storage.peek(key)
  const mutationsBefore = fixture.storage.calls.filter(call => (
    call.method === "setItem" || call.method === "removeItem"
  )).length
  const cause = new Error("context suspended")

  const first = result.session.markLeaseLost(cause)
  const second = result.session.markLeaseLost(new Error("later reason"))

  assert.equal(first, second)
  assert.equal(first.code, "mutation-lease-lost")
  assert.equal(first.cause, cause)
  assert.equal(fixture.scheduler.activeCount(), 0)
  assert.equal(fixture.storage.peek(key), raw)
  assert.equal(
    fixture.storage.calls.filter(call => call.method === "setItem" || call.method === "removeItem").length,
    mutationsBefore,
  )
  assert.equal(fixture.manager.snapshot().held.length, 2)
  assert.throws(() => result.session.assertWritable(), error => error === first)

  await result.session.dispose()
})

test("simulated context loss releases native locks while the owner record expires naturally", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const key = getWorkOwnerKey("work-a")
  const raw = fixture.storage.peek(key)

  assert.equal(fixture.manager.terminateHeld(getWorkLockName("work-a")), true)
  assert.equal(fixture.manager.terminateHeld(LIBRARY_SESSION_LOCK_NAME), true)
  await waitFor(
    () => fixture.manager.snapshot().held.length === 0
      && fixture.scheduler.activeCount() === 0,
    "both destroyed-context locks and their watcher to terminate",
  )

  fixture.setNow(61_000)
  assert.equal(fixture.storage.peek(key), raw)
  assert.equal(
    inspectWorkEditAvailability({
      workId: "work-a",
      storage: fixture.storage,
      now: fixture.now,
    }).isStale,
    true,
  )
  await result.session.dispose()
})

test("runWithWorkEditSession returns exact values and always cleans callback failures", async () => {
  const successFixture = createFixture()
  const value = Object.freeze({ saved: true })
  const success = await runWithWorkEditSession(
    successFixture.options("work-a"),
    session => {
      assert.equal(session.assertWritable(), true)
      return value
    },
  )
  assert.deepEqual(success, { ok: true, value })
  assert.equal(success.value, value)
  assert.equal(successFixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(successFixture.manager.snapshot(), { held: [], pending: [] })

  for (const callbackKind of ["throw", "reject"]) {
    const fixture = createFixture()
    const cause = new Error(`${callbackKind} failed`)
    await assert.rejects(
      runWithWorkEditSession(fixture.options("work-a"), () => {
        if (callbackKind === "throw") throw cause
        return Promise.reject(cause)
      }),
      error => error === cause,
    )
    assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
    assert.equal(fixture.scheduler.activeCount(), 0)
    assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  }
})

test("runWithWorkEditSession skips callbacks for read-only opens", async () => {
  const fixture = createFixture()
  const first = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(first.ok, true)
  let callbackCalls = 0

  const result = await runWithWorkEditSession(fixture.options("work-a"), () => {
    callbackCalls += 1
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "work-locked")
  assert.equal(callbackCalls, 0)
  await first.session.dispose()
})

test("callback failure remains primary when runWith cleanup also fails", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const callbackCause = new Error("callback failed")
  const cleanupCause = new Error("cleanup database unavailable")
  let failDatabase = false
  const failingAdapter = Object.freeze({
    available: true,
    hold: adapter.hold,
    request(name, options, callback) {
      if (name === DATABASE_WRITE_LOCK_NAME && failDatabase) {
        return Promise.reject(cleanupCause)
      }
      return adapter.request(name, options, callback)
    },
  })
  const fixture = createFixture({ manager, adapter: failingAdapter })

  await assert.rejects(
    runWithWorkEditSession(fixture.options("work-a"), () => {
      failDatabase = true
      throw callbackCause
    }),
    error => error === callbackCause,
  )
  assert.notEqual(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeCount(), 0)
})

test("registration metadata failures preserve the original error and release every lock", async () => {
  const workId = "work-a"
  const key = getWorkOwnerKey(workId)
  const expectedRaw = JSON.stringify(ownerRecord({
    workId,
    ownerId: "owner-1",
    leaseId: "lease-1",
    heartbeatAt: 1_000,
  }))
  const cases = [
    {
      name: "generation read",
      cause: new Error("generation denied"),
      createStorage(cause) {
        return createKeyedStorage([], {
          getErrors: new Map([[LOCAL_RESTORE_GENERATION_KEY, cause]]),
        })
      },
      code: "metadata-read-failed",
    },
    {
      name: "owner read",
      cause: new Error("owner denied"),
      createStorage(cause) {
        return createKeyedStorage([], { getErrors: new Map([[key, cause]]) })
      },
      code: "metadata-read-failed",
    },
    {
      name: "owner write",
      cause: new Error("quota"),
      createStorage(cause) {
        return createKeyedStorage([], { setErrors: new Map([[key, cause]]) })
      },
      code: "metadata-write-failed",
    },
    {
      name: "owner readback",
      cause: new Error("readback denied"),
      createStorage(cause) {
        return createKeyedStorage([], {
          getSequences: new Map([[key, [null, cause, expectedRaw, null]]]),
        })
      },
      code: "metadata-readback-failed",
    },
  ]

  for (const entry of cases) {
    const manager = createFakeLockManager()
    const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
    let databaseRequests = 0
    const countedAdapter = Object.freeze({
      available: true,
      hold: adapter.hold,
      request(name, options, callback) {
        if (name === DATABASE_WRITE_LOCK_NAME) databaseRequests += 1
        return adapter.request(name, options, callback)
      },
    })
    const storage = entry.createStorage(entry.cause)
    const fixture = createFixture({ manager, adapter: countedAdapter, storage })

    await assert.rejects(
      openWorkEditSession(fixture.options(workId)),
      error => error.code === entry.code && error.cause === entry.cause,
      entry.name,
    )
    assert.equal(databaseRequests, 1, `${entry.name} cleanup must stay in its current database callback`)
    assert.equal(storage.peek(key), null)
    assert.equal(fixture.scheduler.activeCount(), 0)
    assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
  }
})

test("heartbeat readback failure clears exact self inside that database callback", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  let databaseRequests = 0
  const countedAdapter = Object.freeze({
    available: true,
    hold: adapter.hold,
    request(name, options, callback) {
      if (name === DATABASE_WRITE_LOCK_NAME) databaseRequests += 1
      return adapter.request(name, options, callback)
    },
  })
  const key = getWorkOwnerKey("work-a")
  const baseStorage = createKeyedStorage([["unrelated", "keep"]])
  const cause = new Error("heartbeat readback denied")
  let armed = false
  let failNextOwnerRead = false
  const storage = {
    getItem(storageKey) {
      if (storageKey === key && failNextOwnerRead) {
        failNextOwnerRead = false
        throw cause
      }
      return baseStorage.getItem(storageKey)
    },
    setItem(storageKey, value) {
      baseStorage.setItem(storageKey, value)
      if (storageKey === key && armed) {
        armed = false
        failNextOwnerRead = true
      }
    },
    removeItem: baseStorage.removeItem.bind(baseStorage),
  }
  const fixture = createFixture({ manager, adapter: countedAdapter, storage })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  armed = true
  fixture.advance(15_000)

  await assert.rejects(
    result.session.refreshHeartbeat(),
    error => error.code === "mutation-lease-lost"
      && error.cause?.code === "metadata-readback-failed"
      && error.cause.cause === cause,
  )
  assert.equal(databaseRequests, 2)
  assert.equal(baseStorage.peek(key), null)
  assert.equal(baseStorage.peek("unrelated"), "keep")
  assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeCount(), 0)
})

test("database cleanup failure leaves expiring metadata but still releases native handles", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const cause = new Error("database cleanup rejected")
  let failDatabase = false
  const failingAdapter = Object.freeze({
    available: true,
    hold: adapter.hold,
    request(name, options, callback) {
      if (name === DATABASE_WRITE_LOCK_NAME && failDatabase) return Promise.reject(cause)
      return adapter.request(name, options, callback)
    },
  })
  const fixture = createFixture({ manager, adapter: failingAdapter })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const key = getWorkOwnerKey("work-a")
  const raw = fixture.storage.peek(key)
  failDatabase = true

  await assert.rejects(result.session.dispose(), error => error === cause)
  assert.equal(fixture.storage.peek(key), raw)
  assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeCount(), 0)
})

test("registration database and scheduler failures clean up without hiding the original cause", async () => {
  const databaseManager = createFakeLockManager()
  const databaseAdapter = createWebLocksAdapter({
    locks: databaseManager,
    isSecureContext: true,
  })
  const databaseCause = new Error("database request failed")
  const rejectedDatabase = Object.freeze({
    available: true,
    hold: databaseAdapter.hold,
    request(name, options, callback) {
      if (name === DATABASE_WRITE_LOCK_NAME) return Promise.reject(databaseCause)
      return databaseAdapter.request(name, options, callback)
    },
  })
  const databaseFixture = createFixture({
    manager: databaseManager,
    adapter: rejectedDatabase,
  })
  await assert.rejects(
    openWorkEditSession(databaseFixture.options("work-a")),
    error => error === databaseCause,
  )
  assert.deepEqual(databaseManager.snapshot(), { held: [], pending: [] })
  assert.equal(databaseFixture.storage.peek(getWorkOwnerKey("work-a")), null)

  const schedulerFixture = createFixture()
  const schedulerCause = new Error("timer registration failed")
  const failedScheduler = Object.freeze({
    setInterval() {
      throw schedulerCause
    },
    clearInterval() {
      assert.fail("a timer that was never installed cannot be cleared")
    },
  })
  await assert.rejects(
    openWorkEditSession(schedulerFixture.options("work-a", { scheduler: failedScheduler })),
    error => error === schedulerCause,
  )
  assert.equal(schedulerFixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(schedulerFixture.manager.snapshot(), { held: [], pending: [] })
})

test("timer callback failures are caught without an unhandled rejection", async () => {
  const fixture = createFixture()
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  const replacement = ownerRecord({ ownerId: "external", leaseId: "external", heartbeatAt: 2_000 })
  fixture.storage.setItem(getWorkOwnerKey("work-a"), JSON.stringify(replacement))
  const unhandled = []
  const listener = error => unhandled.push(error)
  process.on("unhandledRejection", listener)

  try {
    fixture.scheduler.tickAll()
    await waitFor(
      () => fixture.manager.snapshot().held.length === 0,
      "timer failure cleanup",
    )
    await nextTurn()
    await nextTurn()
    assert.deepEqual(unhandled, [])
    assert.equal(
      fixture.storage.peek(getWorkOwnerKey("work-a")),
      JSON.stringify(replacement),
    )
  } finally {
    process.off("unhandledRejection", listener)
  }
})

test("the exact owner token is the last metadata read immediately before steal", async () => {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  const events = []
  const tracedAdapter = Object.freeze({
    available: true,
    request: adapter.request,
    hold(name, options) {
      if (options?.steal) events.push(["hold:steal", name])
      return adapter.hold(name, options)
    },
  })
  const baseStorage = createKeyedStorage()
  const storage = {
    getItem(key) {
      events.push(["get", key])
      return baseStorage.getItem(key)
    },
    setItem: baseStorage.setItem.bind(baseStorage),
    removeItem: baseStorage.removeItem.bind(baseStorage),
  }
  const fixture = createFixture({ manager, adapter: tracedAdapter, storage })
  const old = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(old.ok, true)
  fixture.setNow(61_000)
  events.length = 0

  const replacement = await openWorkEditSession(fixture.options("work-a", { takeover: true }))
  assert.equal(replacement.ok, true)
  const stealIndex = events.findIndex(event => event[0] === "hold:steal")
  assert.ok(stealIndex > 0)
  assert.deepEqual(events[stealIndex - 1], ["get", getWorkOwnerKey("work-a")])

  await old.session.dispose()
  await replacement.session.dispose()
})

test("takeover preflight and native steal failures preserve the old session", async () => {
  const ownerKey = getWorkOwnerKey("work-a")

  {
    const baseStorage = createKeyedStorage()
    const cause = new Error("preflight owner denied")
    let failOwnerRead = false
    const storage = {
      getItem(key) {
        if (failOwnerRead && key === ownerKey) throw cause
        return baseStorage.getItem(key)
      },
      setItem: baseStorage.setItem.bind(baseStorage),
      removeItem: baseStorage.removeItem.bind(baseStorage),
    }
    const fixture = createFixture({ storage })
    const old = await openWorkEditSession(fixture.options("work-a"))
    assert.equal(old.ok, true)
    const oldRaw = baseStorage.peek(ownerKey)
    fixture.setNow(61_000)
    failOwnerRead = true

    await assert.rejects(
      openWorkEditSession(fixture.options("work-a", { takeover: true })),
      error => error.code === "metadata-read-failed" && error.cause === cause,
    )
    assert.equal(baseStorage.peek(ownerKey), oldRaw)
    assert.equal(fixture.manager.snapshot().held.length, 2)
    failOwnerRead = false
    await old.session.dispose()
  }

  {
    const manager = createFakeLockManager()
    const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
    const cause = new Error("native steal rejected")
    const failingAdapter = Object.freeze({
      available: true,
      request: adapter.request,
      hold(name, options) {
        if (options?.steal) return Promise.reject(cause)
        return adapter.hold(name, options)
      },
    })
    const fixture = createFixture({ manager, adapter: failingAdapter })
    const old = await openWorkEditSession(fixture.options("work-a"))
    assert.equal(old.ok, true)
    const oldRaw = fixture.storage.peek(ownerKey)
    fixture.setNow(61_000)

    await assert.rejects(
      openWorkEditSession(fixture.options("work-a", { takeover: true })),
      error => error === cause,
    )
    assert.equal(fixture.storage.peek(ownerKey), oldRaw)
    assert.deepEqual(manager.snapshot(), {
      held: [
        { name: LIBRARY_SESSION_LOCK_NAME, mode: "shared" },
        { name: getWorkLockName("work-a"), mode: "exclusive" },
      ],
      pending: [],
    })
    await old.session.dispose()
  }
})

test("clearInterval failure cannot block exact cleanup or reverse-order lock release", async () => {
  const fixture = createFixture()
  const cause = new Error("timer cancellation failed")
  const scheduler = Object.freeze({
    setInterval: fixture.scheduler.setInterval,
    clearInterval(handle) {
      fixture.scheduler.clearInterval(handle)
      throw cause
    },
  })
  const result = await openWorkEditSession(fixture.options("work-a", { scheduler }))
  assert.equal(result.ok, true)

  await assert.rejects(result.session.dispose(), error => error === cause)
  assert.equal(fixture.storage.peek(getWorkOwnerKey("work-a")), null)
  assert.deepEqual(fixture.manager.snapshot(), { held: [], pending: [] })
  assert.equal(fixture.scheduler.activeCount(), 0)
})

test("owner storage access failures remain lease-loss causes", async () => {
  const baseStorage = createKeyedStorage()
  const cause = new Error("owner read blocked")
  let failOwnerRead = false
  const key = getWorkOwnerKey("work-a")
  const storage = {
    getItem(storageKey) {
      if (failOwnerRead && storageKey === key) throw cause
      return baseStorage.getItem(storageKey)
    },
    setItem: baseStorage.setItem.bind(baseStorage),
    removeItem: baseStorage.removeItem.bind(baseStorage),
  }
  const fixture = createFixture({ storage })
  const result = await openWorkEditSession(fixture.options("work-a"))
  assert.equal(result.ok, true)
  failOwnerRead = true

  assert.throws(
    () => result.session.assertSessionAdmission(),
    error => error.code === "mutation-lease-lost"
      && error.cause?.code === "metadata-read-failed"
      && error.cause.cause === cause,
  )
  failOwnerRead = false
  await result.session.dispose()
})
