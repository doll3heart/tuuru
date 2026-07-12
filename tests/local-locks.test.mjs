import test from "node:test"
import assert from "node:assert/strict"

import {
  DATABASE_WRITE_LOCK_NAME,
  LIBRARY_SESSION_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
  getWorkLockName,
} from "../js/local-locks.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

async function waitFor(predicate, description) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return
    await nextTurn()
  }
  assert.fail(`Timed out waiting for ${description}`)
}

function assertAdapterError(error, { code, cause } = {}) {
  assert.ok(error instanceof LocalLockUnavailableError)
  if (code !== undefined) assert.equal(error.code, code)
  if (cause !== undefined) assert.equal(error.cause, cause)
  return true
}

function createAvailableAdapter() {
  const manager = createFakeLockManager()
  const adapter = createWebLocksAdapter({ locks: manager, isSecureContext: true })
  return { adapter, manager }
}

test("exports stable lock names, encoded work names, and the adapter error contract", () => {
  assert.equal(LIBRARY_SESSION_LOCK_NAME, "tuuru:library-session")
  assert.equal(DATABASE_WRITE_LOCK_NAME, "tuuru:database-write")
  assert.equal(getWorkLockName("draft one"), "tuuru:work:draft%20one")
  assert.equal(getWorkLockName("folder/draft"), "tuuru:work:folder%2Fdraft")
  assert.equal(getWorkLockName("雪"), "tuuru:work:%E9%9B%AA")
  assert.equal(getWorkLockName({ toString: () => "coerced / 雪" }), "tuuru:work:coerced%20%2F%20%E9%9B%AA")

  const defaultError = new LocalLockUnavailableError("closed")
  assert.equal(defaultError.name, "LocalLockUnavailableError")
  assert.equal(defaultError.message, "closed")
  assert.equal(defaultError.code, "mutation-lock-unavailable")
  assert.equal(Object.hasOwn(defaultError, "cause"), false)

  const cause = new Error("native failure")
  const causedError = new LocalLockUnavailableError("closed", "custom-code", cause)
  assert.equal(causedError.cause, cause)
})

test("availability fails closed before making any manager request", async () => {
  let managerRequests = 0
  const locks = {
    request() {
      managerRequests += 1
      throw new Error("must not be reached")
    },
  }
  const insecure = createWebLocksAdapter({ locks, isSecureContext: false })
  const missing = createWebLocksAdapter({ locks: null, isSecureContext: true })
  const nonCallable = createWebLocksAdapter({ locks: { request: true }, isSecureContext: true })

  assert.equal(createWebLocksAdapter({ locks, isSecureContext: true }).available, true)
  assert.equal(insecure.available, false)
  assert.equal(missing.available, false)
  assert.equal(nonCallable.available, false)

  for (const adapter of [insecure, missing, nonCallable]) {
    await assert.rejects(
      adapter.request("resource", () => "unused"),
      error => assertAdapterError(error, { code: "mutation-lock-unavailable" }),
    )
    await assert.rejects(
      adapter.hold("resource"),
      error => assertAdapterError(error, { code: "mutation-lock-unavailable" }),
    )
  }
  assert.equal(managerRequests, 0)
})

test("invalid option combinations reject deterministically before manager access", async () => {
  let managerRequests = 0
  const locks = {
    request() {
      managerRequests += 1
      return Promise.resolve()
    },
  }
  const adapter = createWebLocksAdapter({ locks, isSecureContext: true })
  const signal = new AbortController().signal
  const cases = [
    [{ ifAvailable: true, steal: true }, "ifAvailable and steal cannot be combined"],
    [{ mode: "shared", steal: true }, "steal requires exclusive mode"],
    [{ ifAvailable: true, signal }, "signal cannot be combined with ifAvailable or steal"],
    [{ steal: true, signal }, "signal cannot be combined with ifAvailable or steal"],
    [{ mode: "write" }, "mode must be \"exclusive\" or \"shared\""],
  ]

  for (const [options, message] of cases) {
    for (const operation of [
      () => adapter.request("resource", options, () => "unused"),
      () => adapter.hold("resource", options),
    ]) {
      await assert.rejects(operation(), error => {
        assert.ok(error instanceof TypeError)
        assert.equal(error.code, "mutation-lock-invalid-options")
        assert.equal(error.message, message)
        return true
      })
    }
  }
  assert.equal(managerRequests, 0)
})

test("request callbacks are asynchronous and preserve modes, values, and arbitrary errors", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const value = { saved: true }
  let synchronous = true

  const request = adapter.request("default-mode", lock => {
    assert.equal(synchronous, false)
    assert.equal(lock.name, "default-mode")
    assert.equal(lock.mode, "exclusive")
    return value
  })
  synchronous = false
  assert.equal(await request, value)

  assert.equal(
    await manager.request("direct-shared", { mode: "shared" }, lock => `${lock.name}:${lock.mode}`),
    "direct-shared:shared",
  )

  for (const callbackError of [
    new Error("callback failed"),
    new DOMException("callback aborted itself", "AbortError"),
  ]) {
    await assert.rejects(
      adapter.request("callback-error", () => { throw callbackError }),
      error => error === callbackError,
    )
  }
})

test("native setup failures are wrapped without losing their original causes", async () => {
  const rejectedCause = new Error("request rejected")
  const rejectedAdapter = createWebLocksAdapter({
    locks: { request: () => Promise.reject(rejectedCause) },
    isSecureContext: true,
  })
  await assert.rejects(
    rejectedAdapter.request("resource", () => "unused"),
    error => assertAdapterError(error, {
      code: "mutation-lock-unavailable",
      cause: rejectedCause,
    }),
  )

  const thrownCause = new Error("request threw")
  const thrownAdapter = createWebLocksAdapter({
    locks: { request: () => { throw thrownCause } },
    isSecureContext: true,
  })
  await assert.rejects(
    thrownAdapter.hold("resource"),
    error => assertAdapterError(error, {
      code: "mutation-lock-unavailable",
      cause: thrownCause,
    }),
  )
})

test("exclusive requests serialize by exact resource name", async () => {
  const { adapter } = createAvailableAdapter()
  const firstGate = deferred()
  const secondGate = deferred()
  const events = []

  const first = adapter.request("same", async lock => {
    events.push(`first:${lock.mode}`)
    await firstGate.promise
    return "first-value"
  })
  const second = adapter.request("same", async lock => {
    events.push(`second:${lock.mode}`)
    await secondGate.promise
    return "second-value"
  })

  await waitFor(() => events.length === 1, "the first exclusive holder")
  assert.deepEqual(events, ["first:exclusive"])

  firstGate.resolve()
  assert.equal(await first, "first-value")
  await waitFor(() => events.length === 2, "the second exclusive holder")
  assert.deepEqual(events, ["first:exclusive", "second:exclusive"])

  secondGate.resolve()
  assert.equal(await second, "second-value")
})

test("shared holders overlap while an exclusive request waits for all of them", async () => {
  const { adapter } = createAvailableAdapter()
  const firstGate = deferred()
  const secondGate = deferred()
  const exclusiveGate = deferred()
  const events = []

  const first = adapter.request("readers", { mode: "shared" }, async () => {
    events.push("shared-1")
    await firstGate.promise
  })
  const second = adapter.request("readers", { mode: "shared" }, async () => {
    events.push("shared-2")
    await secondGate.promise
  })
  const exclusive = adapter.request("readers", async () => {
    events.push("exclusive")
    await exclusiveGate.promise
  })

  await waitFor(() => events.length === 2, "both shared holders")
  assert.deepEqual(events, ["shared-1", "shared-2"])

  firstGate.resolve()
  await first
  await nextTurn()
  assert.deepEqual(events, ["shared-1", "shared-2"])

  secondGate.resolve()
  await second
  await waitFor(() => events.includes("exclusive"), "the exclusive holder")
  exclusiveGate.resolve()
  await exclusive
})

test("FIFO fairness prevents a later shared request from barging ahead of an exclusive waiter", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const initialGate = deferred()
  const writerGate = deferred()
  const laterReaderGate = deferred()
  const events = []

  const initialReader = adapter.request("fair", { mode: "shared" }, async () => {
    events.push("initial-reader")
    await initialGate.promise
  })
  await waitFor(() => events.length === 1, "the initial shared holder")

  const writer = adapter.request("fair", async () => {
    events.push("writer")
    await writerGate.promise
  })
  const laterReader = adapter.request("fair", { mode: "shared" }, async () => {
    events.push("later-reader")
    await laterReaderGate.promise
  })

  await waitFor(
    () => manager.snapshot().pending.length === 2,
    "the FIFO wait queue",
  )
  assert.deepEqual(manager.snapshot(), {
    held: [{ name: "fair", mode: "shared" }],
    pending: [
      { name: "fair", mode: "exclusive" },
      { name: "fair", mode: "shared" },
    ],
  })

  initialGate.resolve()
  await initialReader
  await waitFor(() => events.includes("writer"), "the queued exclusive holder")
  assert.deepEqual(events, ["initial-reader", "writer"])

  writerGate.resolve()
  await writer
  await waitFor(() => events.includes("later-reader"), "the later shared holder")
  laterReaderGate.resolve()
  await laterReader
})

test("independent resource names proceed concurrently", async () => {
  const { adapter } = createAvailableAdapter()
  const alphaGate = deferred()
  const betaGate = deferred()
  const events = []

  const alpha = adapter.request("alpha", async () => {
    events.push("alpha")
    await alphaGate.promise
  })
  const beta = adapter.request("beta", async () => {
    events.push("beta")
    await betaGate.promise
  })

  await waitFor(() => events.length === 2, "holders for independent names")
  assert.deepEqual(new Set(events), new Set(["alpha", "beta"]))
  alphaGate.resolve()
  betaGate.resolve()
  await Promise.all([alpha, beta])
})

test("ifAvailable returns null asynchronously without joining the wait queue", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const holder = await adapter.hold("conditional")
  let synchronous = true
  let callbackLock = "not-called"

  const unavailable = adapter.request("conditional", { ifAvailable: true }, lock => {
    assert.equal(synchronous, false)
    callbackLock = lock
    return "not-acquired"
  })
  synchronous = false
  await Promise.resolve()
  assert.deepEqual(manager.snapshot().pending, [])
  assert.equal(await unavailable, "not-acquired")
  assert.equal(callbackLock, null)
  assert.equal(await adapter.hold("conditional", { ifAvailable: true }), null)
  assert.deepEqual(manager.snapshot().pending, [])

  assert.equal(
    await adapter.request("free-conditional", { ifAvailable: true }, lock => lock.mode),
    "exclusive",
  )
  holder.release()
  await holder.released
})

test("a signal aborts pending requests with a stable code and the original cause", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const holder = await adapter.hold("abort-pending")
  const controller = new AbortController()
  const abortCause = new DOMException("caller cancelled", "AbortError")
  let callbackCalls = 0

  const pendingRequest = adapter.request(
    "abort-pending",
    { signal: controller.signal },
    () => { callbackCalls += 1 },
  )
  await waitFor(() => manager.snapshot().pending.length === 1, "the pending request")
  controller.abort(abortCause)

  await assert.rejects(
    pendingRequest,
    error => assertAdapterError(error, {
      code: "mutation-lock-aborted",
      cause: abortCause,
    }),
  )
  assert.equal(callbackCalls, 0)
  assert.deepEqual(manager.snapshot().pending, [])
  assert.equal(holder.isLost(), false)

  const holdController = new AbortController()
  const pendingHold = adapter.hold("abort-pending", { signal: holdController.signal })
  await waitFor(() => manager.snapshot().pending.length === 1, "the pending hold")
  const holdAbortCause = new DOMException("hold cancelled", "AbortError")
  holdController.abort(holdAbortCause)
  await assert.rejects(
    pendingHold,
    error => assertAdapterError(error, {
      code: "mutation-lock-aborted",
      cause: holdAbortCause,
    }),
  )

  holder.release()
  await holder.released
})

test("AbortSignal is ignored after its request has been granted", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const controller = new AbortController()
  const gate = deferred()
  let started = false

  const request = adapter.request("granted-signal", { signal: controller.signal }, async () => {
    started = true
    await gate.promise
    return "completed"
  })
  await waitFor(() => started, "the signal-bearing holder")
  controller.abort(new DOMException("too late", "AbortError"))
  await nextTurn()

  assert.deepEqual(manager.snapshot().held, [{ name: "granted-signal", mode: "exclusive" }])
  assert.equal(
    await adapter.request("granted-signal", { ifAvailable: true }, lock => lock),
    null,
  )
  gate.resolve()
  assert.equal(await request, "completed")
})

test("hold resolves on acquisition and releases explicitly and idempotently", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const handle = await adapter.hold("long-held", { mode: "shared" })
  const events = []
  let lostSettlements = 0
  let releasedSettlements = 0

  assert.equal(handle.name, "long-held")
  assert.equal(handle.mode, "shared")
  assert.equal(handle.isLost(), false)
  assert.deepEqual(manager.snapshot().held, [{ name: "long-held", mode: "shared" }])

  const lost = handle.lost.then(result => {
    lostSettlements += 1
    events.push("lost")
    return result
  })
  const released = handle.released.then(result => {
    releasedSettlements += 1
    events.push("released")
    return result
  })
  await nextTurn()
  assert.deepEqual(events, [])

  handle.release()
  handle.release()
  assert.equal(handle.isLost(), true)
  assert.deepEqual(await lost, { reason: "released", error: null })
  await released

  assert.deepEqual(events, ["lost", "released"])
  assert.equal(lostSettlements, 1)
  assert.equal(releasedSettlements, 1)
  assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
})

test("the fake manager steals held locks and grants the replacement before queued requests", async () => {
  const manager = createFakeLockManager()
  const oldGate = deferred()
  const stealGate = deferred()
  const queuedGate = deferred()
  const events = []

  const oldRequest = manager.request("preempt", async () => {
    events.push("old")
    await oldGate.promise
  })
  const oldOutcome = oldRequest.then(
    value => ({ status: "fulfilled", value }),
    error => ({ status: "rejected", error }),
  )
  await waitFor(() => events.length === 1, "the old holder")

  const queued = manager.request("preempt", async () => {
    events.push("queued")
    await queuedGate.promise
  })
  await waitFor(() => manager.snapshot().pending.length === 1, "the ordinary queued request")

  const stealing = manager.request("preempt", { steal: true }, async () => {
    events.push("steal")
    await stealGate.promise
    return "replacement-value"
  })
  await waitFor(() => events.includes("steal"), "the stealing replacement")

  const oldResult = await oldOutcome
  assert.equal(oldResult.status, "rejected")
  assert.equal(oldResult.error.name, "AbortError")
  assert.deepEqual(events, ["old", "steal"])

  stealGate.resolve()
  assert.equal(await stealing, "replacement-value")
  await waitFor(() => events.includes("queued"), "the previously queued request")
  queuedGate.resolve()
  oldGate.resolve()
  await queued
})

test("steal marks a held adapter handle lost before the replacement callback", async () => {
  const { adapter } = createAvailableAdapter()
  const oldHandle = await adapter.hold("adapter-steal")
  const events = []

  const lost = oldHandle.lost.then(result => {
    events.push("lost")
    return result
  })
  const released = oldHandle.released.then(result => {
    events.push("released")
    return result
  })
  const replacement = adapter.request("adapter-steal", { steal: true }, lock => {
    assert.equal(oldHandle.isLost(), true)
    events.push(`replacement:${lock.mode}`)
    return "replacement"
  })

  assert.equal(await replacement, "replacement")
  const loss = await lost
  await released

  assert.equal(loss.reason, "stolen")
  assertAdapterError(loss.error, { code: "mutation-lock-stolen" })
  assert.ok(loss.error.cause instanceof DOMException)
  assert.equal(loss.error.cause.name, "AbortError")
  assert.ok(events.indexOf("lost") < events.indexOf("released"))

  oldHandle.release()
  oldHandle.release()
  assert.equal((await oldHandle.lost).reason, "stolen")
})

test("modeled held-lock termination reports aborted and settles each lifecycle once", async () => {
  const { adapter, manager } = createAvailableAdapter()
  const handle = await adapter.hold("terminated")
  const terminationCause = new Error("context terminated")
  let lostSettlements = 0
  let releasedSettlements = 0

  handle.lost.then(() => { lostSettlements += 1 })
  handle.released.then(() => { releasedSettlements += 1 })

  assert.equal(manager.terminateHeld("terminated", terminationCause), true)
  assert.equal(manager.terminateHeld("terminated", new Error("duplicate")), false)
  const loss = await handle.lost
  handle.release()
  handle.release()

  await handle.released
  await nextTurn()

  assert.equal(handle.isLost(), true)
  assert.equal(loss.reason, "aborted")
  assertAdapterError(loss.error, {
    code: "mutation-lock-aborted",
    cause: terminationCause,
  })
  assert.equal(lostSettlements, 1)
  assert.equal(releasedSettlements, 1)
  assert.deepEqual(manager.snapshot(), { held: [], pending: [] })
})
