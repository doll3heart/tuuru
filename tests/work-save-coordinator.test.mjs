import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

import { createWorkSaveCoordinator } from "../js/work-save-coordinator.js"

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function settleMicrotasks() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
}

function createFakeScheduler() {
  let currentTime = 0
  let nextHandle = 0
  const active = new Map()
  const records = new Map()

  const scheduler = {
    setTimeout(callback, delayMs) {
      nextHandle += 1
      const record = {
        callback,
        dueAt: currentTime + delayMs,
        handle: nextHandle,
      }
      active.set(record.handle, record)
      records.set(record.handle, record)
      return record.handle
    },
    clearTimeout(handle) {
      active.delete(handle)
    },
  }

  function advance(milliseconds) {
    const target = currentTime + milliseconds
    while (true) {
      const next = [...active.values()]
        .filter(record => record.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.handle - right.handle)[0]
      if (next === undefined) break
      currentTime = next.dueAt
      active.delete(next.handle)
      next.callback()
    }
    currentTime = target
  }

  return {
    scheduler,
    advance,
    fireEvenIfCleared(handle) {
      records.get(handle)?.callback()
    },
    activeHandles() {
      return [...active.keys()]
    },
    now() {
      return currentTime
    },
  }
}

function createThrowingClearScheduler({ always = false } = {}) {
  const failure = new Error(always ? "clear always failed" : "clear failed once")
  let nextHandle = 0
  let clearCalls = 0
  return {
    failure,
    scheduler: {
      setTimeout() {
        nextHandle += 1
        return nextHandle
      },
      clearTimeout() {
        clearCalls += 1
        if (always || clearCalls === 1) throw failure
      },
    },
    clearCalls() {
      return clearCalls
    },
  }
}

function createHarness(overrides = {}) {
  let idSequence = 0
  const idCalls = []
  const fakeScheduler = createFakeScheduler()
  const coordinator = createWorkSaveCoordinator({
    commitMutation: async batch => ({
      ok: true,
      operationId: batch.id,
      raw: "{}",
      database: {},
      workToken: "work-token",
    }),
    commitPreparedCandidate: async () => {
      throw new Error("prepared commits are unavailable in Task 7A")
    },
    recheckUnknown: async () => {
      throw new Error("unknown rechecks are unavailable in Task 7A")
    },
    scheduler: fakeScheduler.scheduler,
    now: () => 100,
    createOperationId(kind) {
      idCalls.push(kind)
      idSequence += 1
      return `${kind}-${idSequence}`
    },
    ...overrides,
  })
  return { coordinator, fakeScheduler, idCalls }
}

function verifiedResult(batch, suffix = "") {
  return {
    ok: true,
    operationId: batch.id,
    raw: `{${JSON.stringify(suffix)}}`,
    database: { suffix },
    workToken: `work-token${suffix}`,
  }
}

function mutationFailure(code, details, message = code) {
  const failure = new Error(message)
  failure.code = code
  Object.defineProperty(failure, "details", {
    value: details,
    enumerable: true,
    configurable: true,
    writable: true,
  })
  return failure
}

async function pauseCoordinatorAsUnknown({
  coordinator,
  attempt,
  batches,
  code = "mutation-readback-failed",
  expectedCurrentRaw = '{"works":[]}',
  candidateRaw = '{"works":[{"id":"candidate"}]}',
}) {
  coordinator.stage({ key: "field:uncertain", payload: "uncertain", apply() {} })
  const boundary = coordinator.flush()
  await settleMicrotasks()
  const batch = batches[0]
  const failure = mutationFailure(code, {
    operationId: batch.id,
    phase: code === "mutation-readback-failed" ? "readback" : "verify",
    commitState: "unknown",
    expectedCurrentRaw,
    candidateRaw,
  })
  attempt.reject(failure)
  await assert.rejects(boundary, reason => reason === failure)
  await settleMicrotasks()
  return { batch, failure }
}

test("exports the work save coordinator factory", () => {
  assert.equal(typeof createWorkSaveCoordinator, "function")
})

test("starts with the exact frozen snapshot and core frozen API", () => {
  const announcements = []
  const { coordinator } = createHarness({
    onSnapshot: snapshot => announcements.push(snapshot),
  })
  const expected = {
    state: "clean",
    pendingCount: 0,
    activeBatchId: null,
    lastSavedAt: null,
    error: null,
    canRetry: false,
    canRecheck: false,
    hasRecoverableCandidate: false,
    generation: 0,
    otherActiveEditors: [],
    availability: null,
  }

  assert.deepEqual(coordinator.snapshot(), expected)
  assert.equal(Object.isFrozen(coordinator), true)
  assert.equal(Object.isFrozen(coordinator.snapshot()), true)
  assert.equal(Object.isFrozen(coordinator.snapshot().otherActiveEditors), true)
  assert.equal(coordinator.snapshot(), coordinator.snapshot())
  assert.equal(coordinator.recoveryMaterial(), null)
  assert.deepEqual(Object.keys(coordinator), [
    "stage",
    "commitNow",
    "flush",
    "drain",
    "retry",
    "recheck",
    "markLeaseLost",
    "snapshot",
    "recoveryMaterial",
    "subscribe",
    "dispose",
  ])
  assert.deepEqual(announcements, [coordinator.snapshot()])
})

test("markLeaseLost synchronously closes an active commit and rejects its public waiters", async () => {
  const gate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return gate.promise
    },
  })
  coordinator.stage({ key: "field:title", payload: "draft", apply() {} })
  const commitOwner = coordinator.commitNow({
    key: "structure:first",
    payload: "first",
    consumes: [],
    apply() {},
  })
  const boundary = coordinator.flush()
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })

  const leaseFailure = mutationFailure("work-locked", {
    operationId: batches[0].id,
    commitState: "unchanged",
  })
  const leaseSnapshot = coordinator.markLeaseLost(leaseFailure)
  assert.equal(leaseSnapshot, coordinator.snapshot())
  assert.equal(leaseSnapshot.state, "lease-lost")
  assert.equal(leaseSnapshot.error, leaseFailure)
  assert.equal(coordinator.markLeaseLost(new Error("later")), leaseSnapshot)
  await assert.rejects(commitOwner, reason => reason === leaseFailure)
  await assert.rejects(boundary, reason => reason === leaseFailure)

  gate.resolve(verifiedResult(batches[0], "-late"))
  await settleMicrotasks()
  assert.equal(coordinator.snapshot().state, "lease-lost")
  assert.equal(coordinator.snapshot().error, leaseFailure)
  assert.equal(coordinator.snapshot().lastSavedAt, 100)
  assert.deepEqual(coordinator.recoveryMaterial().pendingOperations, [later])
})

test("markLeaseLost wraps a non-Error cause once with the stable coordinator code", () => {
  const { coordinator } = createHarness()
  const snapshot = coordinator.markLeaseLost(null)
  assert.equal(snapshot.state, "lease-lost")
  assert.equal(snapshot.error.code, "save-lease-lost")
  assert.equal(snapshot.error.cause, null)
  assert.equal(coordinator.markLeaseLost("later"), snapshot)
  assert.throws(
    () => coordinator.stage({ key: "field:closed", payload: null, apply() {} }),
    reason => reason === snapshot.error,
  )
})

test("ordinary recovery material is deeply frozen and generation ordered", async () => {
  const gate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return gate.promise
    },
  })
  const first = coordinator.stage({ key: "field:first", payload: "first", apply() {} })
  const structuralPromise = coordinator.commitNow({
    key: "structure:middle",
    payload: "middle",
    consumes: [],
    apply() {},
  })
  structuralPromise.catch(() => {})
  const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
  await settleMicrotasks()

  const material = coordinator.recoveryMaterial()
  assert.deepEqual(material, {
    kind: "ordinary",
    pendingOperations: [first, batches[0].operations.at(-1), later],
    correctableOperationIds: [],
  })
  assert.equal(Object.isFrozen(material), true)
  assert.equal(Object.isFrozen(material.pendingOperations), true)
  assert.equal(Object.isFrozen(material.correctableOperationIds), true)
  assert.deepEqual(material.pendingOperations.map(operation => operation.generation), [1, 2, 3])

  const disposed = coordinator.dispose()
  gate.resolve(verifiedResult(batches[0], "-late"))
  await disposed
})

test("invalid recovery exposes only blocked operation IDs as correctable", async () => {
  const firstGate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return firstGate.promise
    },
  })
  const blockedField = coordinator.stage({
    key: "field:blocked",
    payload: "blocked",
    apply() {},
  })
  const blockedCommit = coordinator.commitNow({
    key: "structure:blocked",
    payload: "blocked",
    consumes: [],
    apply() {},
  })
  const laterCommit = coordinator.commitNow({
    key: "structure:later",
    payload: "later",
    consumes: [],
    apply() {},
  })
  laterCommit.catch(() => {})
  const pending = coordinator.stage({ key: "field:pending", payload: "pending", apply() {} })
  await settleMicrotasks()
  const blockedBatch = batches[0]
  const failure = mutationFailure("mutation-invalid", {
    operationId: blockedBatch.id,
    phase: "apply",
    commitState: "unchanged",
  })
  firstGate.reject(failure)
  await assert.rejects(blockedCommit, reason => reason === failure)
  await settleMicrotasks()

  const material = coordinator.recoveryMaterial()
  assert.equal(material.kind, "ordinary")
  assert.deepEqual(material.correctableOperationIds, blockedBatch.operationIds)
  assert.equal(material.correctableOperationIds.includes(pending.id), false)
  assert.equal(material.pendingOperations[0], blockedField)
  assert.equal(material.pendingOperations.at(-1), pending)
  assert.deepEqual(
    material.pendingOperations.map(operation => operation.generation),
    [1, 2, 3, 4],
  )
  assert.equal(Object.isFrozen(material), true)
  assert.equal(Object.isFrozen(material.pendingOperations), true)
  assert.equal(Object.isFrozen(material.correctableOperationIds), true)

  await coordinator.dispose()
})

test("unknown recovery retains callback-free provenance through not-written and terminal states", async () => {
  const attempt = createDeferred()
  const batches = []
  const notWritten = Object.freeze({ outcome: "not-written" })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => notWritten,
  })
  coordinator.stage({ key: "field:uncertain", payload: "uncertain", apply() {} })
  const boundary = coordinator.flush()
  await settleMicrotasks()
  const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
  const batch = batches[0]
  const failure = mutationFailure("mutation-readback-failed", {
    operationId: batch.id,
    phase: "readback",
    commitState: "unknown",
    expectedCurrentRaw: null,
    candidateRaw: "{}",
  })
  attempt.reject(failure)
  await assert.rejects(boundary, reason => reason === failure)
  await settleMicrotasks()

  const unknown = coordinator.recoveryMaterial()
  assert.equal(unknown.kind, "unknown")
  assert.equal(Object.isFrozen(unknown), true)
  assert.equal(Object.isFrozen(unknown.laterPendingOperations), true)
  assert.equal(Object.isFrozen(unknown.uncertainBatch), true)
  assert.equal("operations" in unknown.uncertainBatch, false)
  assert.equal("apply" in unknown.uncertainBatch, false)
  assert.deepEqual(unknown.laterPendingOperations, [later])

  assert.equal(await coordinator.recheck(), notWritten)
  const afterNotWritten = coordinator.recoveryMaterial()
  assert.equal(afterNotWritten.uncertainBatch, unknown.uncertainBatch)
  assert.deepEqual(afterNotWritten.laterPendingOperations, [later])

  const leaseFailure = mutationFailure("mutation-lease-lost", {})
  coordinator.markLeaseLost(leaseFailure)
  const terminal = coordinator.recoveryMaterial()
  assert.equal(terminal.kind, "unknown")
  assert.equal(terminal.uncertainBatch, unknown.uncertainBatch)
  assert.deepEqual(terminal.laterPendingOperations, [later])
  const disposed = await coordinator.dispose()
  assert.equal(disposed.state, "disposed")
  assert.equal(coordinator.recoveryMaterial().kind, "unknown")
})

test("markLeaseLost immediately rejects active ordinary and prepared retry owners", async t => {
  await t.test("ordinary retry", async () => {
    const retryGate = createDeferred()
    const batches = []
    let calls = 0
    const { coordinator } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        calls += 1
        if (calls === 1) {
          return Promise.reject(mutationFailure("mutation-write-failed", {
            operationId: batch.id,
            phase: "write",
            commitState: "unchanged",
          }))
        }
        return retryGate.promise
      },
    })
    coordinator.stage({ key: "field:blocked", payload: "blocked", apply() {} })
    await assert.rejects(coordinator.flush())
    const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
    const retryOwner = coordinator.retry()
    await settleMicrotasks()
    assert.equal(calls, 2)

    const leaseFailure = mutationFailure("work-locked", {})
    coordinator.markLeaseLost(leaseFailure)
    await assert.rejects(retryOwner, reason => reason === leaseFailure)
    retryGate.resolve(verifiedResult(batches[1], "-retry-late"))
    await settleMicrotasks()
    assert.equal(coordinator.snapshot().state, "lease-lost")
    assert.equal(coordinator.snapshot().lastSavedAt, 100)
    assert.deepEqual(coordinator.recoveryMaterial().pendingOperations, [later])
  })

  await t.test("prepared retry", async () => {
    const attempt = createDeferred()
    const preparedGate = createDeferred()
    const batches = []
    const prepared = []
    const notWritten = Object.freeze({ outcome: "not-written" })
    const { coordinator } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        return attempt.promise
      },
      recheckUnknown: async () => notWritten,
      commitPreparedCandidate(envelope) {
        prepared.push(envelope)
        return preparedGate.promise
      },
    })
    await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
    assert.equal(await coordinator.recheck(), notWritten)
    const retryOwner = coordinator.retry()
    await settleMicrotasks()
    assert.equal(prepared.length, 1)

    const leaseFailure = mutationFailure("mutation-lock-unavailable", {})
    coordinator.markLeaseLost(leaseFailure)
    await assert.rejects(retryOwner, reason => reason === leaseFailure)
    preparedGate.resolve(verifiedResult(prepared[0], "-prepared-late"))
    await settleMicrotasks()
    assert.equal(coordinator.snapshot().state, "lease-lost")
    assert.equal(coordinator.snapshot().lastSavedAt, 100)
    assert.equal(coordinator.recoveryMaterial(), null)
  })
})

test("external lease loss keeps a late recheck conflict owner rejected and preserves unknown material", async () => {
  const attempt = createDeferred()
  const recheckGate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: () => recheckGate.promise,
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  const recheckOwner = coordinator.recheck()
  await settleMicrotasks()

  const leaseFailure = mutationFailure("mutation-lease-lost", {})
  coordinator.markLeaseLost(leaseFailure)
  await assert.rejects(recheckOwner, reason => reason === leaseFailure)
  const conflict = Object.freeze({
    outcome: "conflict",
    result: Object.freeze({ raw: "{}", database: Object.freeze({}), workToken: "other" }),
  })
  recheckGate.resolve(conflict)
  await settleMicrotasks()

  assert.equal(coordinator.snapshot().state, "lease-lost")
  assert.equal(coordinator.snapshot().error, leaseFailure)
  assert.equal(coordinator.recoveryMaterial().kind, "unknown")
})

test("a recognized recheck lease failure closes with exact identity and retains unknown provenance", async () => {
  const attempt = createDeferred()
  const batches = []
  const leaseFailure = mutationFailure("work-locked", {})
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => { throw leaseFailure },
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })

  await assert.rejects(coordinator.recheck(), reason => reason === leaseFailure)
  assert.equal(coordinator.snapshot().state, "lease-lost")
  assert.equal(coordinator.snapshot().error, leaseFailure)
  assert.equal(coordinator.recoveryMaterial().kind, "unknown")
})

test("terminal late commit failures retain safe recovery without starting more work", async t => {
  await t.test("unchanged retains ordinary callbacks", async () => {
    const gate = createDeferred()
    const batches = []
    const { coordinator, fakeScheduler } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        return gate.promise
      },
    })
    const active = coordinator.stage({ key: "field:active", payload: "active", apply() {} })
    const boundary = coordinator.flush()
    await settleMicrotasks()
    const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
    const leaseFailure = mutationFailure("work-locked", {})
    coordinator.markLeaseLost(leaseFailure)
    await assert.rejects(boundary, reason => reason === leaseFailure)
    assert.deepEqual(fakeScheduler.activeHandles(), [])

    gate.reject(mutationFailure("mutation-write-failed", {
      operationId: batches[0].id,
      phase: "write",
      commitState: "unchanged",
    }))
    await settleMicrotasks()
    const material = coordinator.recoveryMaterial()
    assert.equal(material.kind, "ordinary")
    assert.deepEqual(material.pendingOperations, [active, later])
    assert.equal(coordinator.snapshot().state, "lease-lost")
    assert.equal(coordinator.snapshot().error, leaseFailure)
    assert.equal(batches.length, 1)
    assert.deepEqual(fakeScheduler.activeHandles(), [])
  })

  await t.test("trusted unknown becomes callback-free before dispose completes", async () => {
    const gate = createDeferred()
    const batches = []
    const { coordinator, fakeScheduler } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        return gate.promise
      },
    })
    coordinator.stage({ key: "field:active", payload: "active", apply() {} })
    const boundary = coordinator.flush()
    await settleMicrotasks()
    const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
    const disposal = coordinator.dispose()
    let disposed = false
    disposal.then(() => { disposed = true })
    await assert.rejects(boundary, reason => reason.code === "save-disposed")
    await settleMicrotasks()
    assert.equal(disposed, false)

    gate.reject(mutationFailure("mutation-verification-failed", {
      operationId: batches[0].id,
      commitState: "unknown",
      expectedCurrentRaw: null,
      candidateRaw: "{}",
    }))
    await disposal
    const material = coordinator.recoveryMaterial()
    assert.equal(material.kind, "unknown")
    assert.equal("operations" in material.uncertainBatch, false)
    assert.equal("apply" in material.uncertainBatch, false)
    assert.deepEqual(material.laterPendingOperations, [later])
    assert.equal(coordinator.snapshot().state, "disposed")
    assert.equal(batches.length, 1)
    assert.deepEqual(fakeScheduler.activeHandles(), [])
  })
})

test("dispose waits through late saved recheck bookkeeping without reviving the pump", async () => {
  const attempt = createDeferred()
  const recheckGate = createDeferred()
  const laterCommitGate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return batches.length === 1 ? attempt.promise : laterCommitGate.promise
    },
    recheckUnknown: () => recheckGate.promise,
  })
  coordinator.stage({ key: "field:uncertain", payload: "uncertain", apply() {} })
  const boundary = coordinator.flush()
  await settleMicrotasks()
  const later = coordinator.stage({ key: "field:later", payload: "later", apply() {} })
  const unknownFailure = mutationFailure("mutation-readback-failed", {
    operationId: batches[0].id,
    commitState: "unknown",
    expectedCurrentRaw: null,
    candidateRaw: "{}",
  })
  attempt.reject(unknownFailure)
  await assert.rejects(boundary, reason => reason === unknownFailure)
  await settleMicrotasks()

  const recheckOwner = coordinator.recheck()
  await settleMicrotasks()
  const disposal = coordinator.dispose()
  let disposed = false
  disposal.then(() => { disposed = true })
  await assert.rejects(recheckOwner, reason => reason.code === "save-disposed")
  await settleMicrotasks()
  assert.equal(disposed, false)

  const saved = Object.freeze({
    outcome: "saved",
    result: Object.freeze({ raw: "{}", database: Object.freeze({}), workToken: "saved" }),
  })
  recheckGate.resolve(saved)
  await disposal
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(coordinator.snapshot().lastSavedAt, 100)
  assert.deepEqual(coordinator.recoveryMaterial().pendingOperations, [later])
  assert.equal(batches.length, 1)
})

test("dispose waits through late retry bookkeeping for ordinary and prepared actions", async t => {
  await t.test("ordinary retry", async () => {
    const retryGate = createDeferred()
    const batches = []
    let calls = 0
    const { coordinator } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        calls += 1
        if (calls === 1) {
          return Promise.reject(mutationFailure("mutation-write-failed", {
            operationId: batch.id,
            phase: "write",
            commitState: "unchanged",
          }))
        }
        return retryGate.promise
      },
    })
    coordinator.stage({ key: "field:retry", payload: "retry", apply() {} })
    await assert.rejects(coordinator.flush())
    const retryOwner = coordinator.retry()
    await settleMicrotasks()
    const disposal = coordinator.dispose()
    let disposed = false
    disposal.then(() => { disposed = true })
    await assert.rejects(retryOwner, reason => reason.code === "save-disposed")
    await settleMicrotasks()
    assert.equal(disposed, false)

    retryGate.resolve(verifiedResult(batches[1], "-ordinary-disposed"))
    await disposal
    assert.equal(coordinator.snapshot().state, "disposed")
    assert.equal(coordinator.snapshot().lastSavedAt, 100)
    assert.equal(coordinator.recoveryMaterial(), null)
  })

  await t.test("prepared retry", async () => {
    const attempt = createDeferred()
    const preparedGate = createDeferred()
    const batches = []
    const prepared = []
    const notWritten = Object.freeze({ outcome: "not-written" })
    const { coordinator } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        return attempt.promise
      },
      recheckUnknown: async () => notWritten,
      commitPreparedCandidate(envelope) {
        prepared.push(envelope)
        return preparedGate.promise
      },
    })
    await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
    assert.equal(await coordinator.recheck(), notWritten)
    const retryOwner = coordinator.retry()
    await settleMicrotasks()
    const disposal = coordinator.dispose()
    let disposed = false
    disposal.then(() => { disposed = true })
    await assert.rejects(retryOwner, reason => reason.code === "save-disposed")
    await settleMicrotasks()
    assert.equal(disposed, false)

    preparedGate.resolve(verifiedResult(prepared[0], "-prepared-disposed"))
    await disposal
    assert.equal(coordinator.snapshot().state, "disposed")
    assert.equal(coordinator.snapshot().lastSavedAt, 100)
    assert.equal(coordinator.recoveryMaterial(), null)
  })
})

test("stage clones and deeply freezes an ordinary JSON payload", () => {
  const { coordinator, idCalls } = createHarness()
  const payload = {
    nodeId: "node-1",
    content: { blocks: ["first", { text: "second" }] },
  }
  const apply = (work, acceptedPayload) => ({ ...work, acceptedPayload })

  const operation = coordinator.stage({
    key: "node:node-1:content",
    payload,
    apply,
  })
  payload.nodeId = "changed"
  payload.content.blocks[0] = "changed"
  payload.content.blocks[1].text = "changed"

  assert.deepEqual(operation, {
    id: "field-1",
    key: "node:node-1:content",
    kind: "field",
    generation: 1,
    payload: {
      nodeId: "node-1",
      content: { blocks: ["first", { text: "second" }] },
    },
    consumes: [],
    apply,
  })
  assert.equal(Object.isFrozen(operation), true)
  assert.equal(Object.isFrozen(operation.payload), true)
  assert.equal(Object.isFrozen(operation.payload.content), true)
  assert.equal(Object.isFrozen(operation.payload.content.blocks), true)
  assert.equal(Object.isFrozen(operation.payload.content.blocks[1]), true)
  assert.equal(Object.isFrozen(operation.consumes), true)
  assert.deepEqual(idCalls, ["field"])
  assert.equal(coordinator.snapshot().generation, 1)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.equal(coordinator.snapshot().state, "dirty")
})

test("invalid payloads invoke neither accessors nor toJSON and consume no ID or generation", () => {
  const { coordinator, idCalls } = createHarness()
  let accessorCalls = 0
  let toJsonCalls = 0
  const accessorPayload = {}
  Object.defineProperty(accessorPayload, "value", {
    enumerable: true,
    get() {
      accessorCalls += 1
      return "unsafe"
    },
  })
  const toJsonPayload = {
    value: 1,
    toJSON() {
      toJsonCalls += 1
      return { value: 2 }
    },
  }
  const cyclic = {}
  cyclic.self = cyclic
  const sparse = []
  sparse.length = 1

  for (const payload of [
    accessorPayload,
    toJsonPayload,
    cyclic,
    sparse,
    new Date("2026-07-12T00:00:00.000Z"),
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    () => {},
    Symbol("value"),
  ]) {
    assert.throws(
      () => coordinator.stage({ key: "node:one", payload, apply() {} }),
      TypeError,
    )
  }
  assert.throws(
    () => coordinator.stage({ key: "", payload: null, apply() {} }),
    TypeError,
  )
  assert.throws(
    () => coordinator.stage({ key: "node:one", payload: null, apply: null }),
    TypeError,
  )
  assert.throws(
    () => coordinator.commitNow({
      key: "structure:one",
      payload: accessorPayload,
      consumes: [],
      apply() {},
    }),
    TypeError,
  )

  assert.equal(accessorCalls, 0)
  assert.equal(toJsonCalls, 0)
  assert.deepEqual(idCalls, [])
  assert.equal(coordinator.snapshot().generation, 0)
})

test("rejects duplicate generated IDs without accepting another generation", () => {
  const idCalls = []
  const { coordinator } = createHarness({
    createOperationId(kind) {
      idCalls.push(kind)
      return "duplicate-id"
    },
  })

  const first = coordinator.stage({ key: "field:a", payload: 1, apply() {} })
  assert.equal(first.generation, 1)
  assert.throws(
    () => coordinator.stage({ key: "field:b", payload: 2, apply() {} }),
    TypeError,
  )
  assert.deepEqual(idCalls, ["field", "field"])
  assert.equal(coordinator.snapshot().generation, 1)
  assert.equal(coordinator.snapshot().pendingCount, 1)
})

test("flush coalesces fields by key and orders survivors by generation", async () => {
  const batches = []
  const { coordinator } = createHarness({
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })

  coordinator.stage({ key: "field:a", payload: "A1", apply() {} })
  coordinator.stage({ key: "field:b", payload: "B2", apply() {} })
  coordinator.stage({ key: "field:a", payload: "A3", apply() {} })
  const result = await coordinator.flush()

  assert.deepEqual(result, verifiedResult(batches[0]))
  assert.equal(batches.length, 1)
  assert.equal(Object.isFrozen(batches[0]), true)
  assert.equal(Object.isFrozen(batches[0].operations), true)
  assert.equal(Object.isFrozen(batches[0].operationIds), true)
  assert.equal(Object.isFrozen(batches[0].generations), true)
  assert.equal(batches[0].kind, "mutation")
  assert.equal(batches[0].id, "batch-4")
  assert.deepEqual(batches[0].operationIds, ["field-2", "field-3"])
  assert.deepEqual(batches[0].generations, [2, 3])
  assert.deepEqual(batches[0].operations.map(operation => operation.payload), ["B2", "A3"])
  assert.deepEqual(batches[0].operations.map(operation => operation.generation), [2, 3])
  assert.equal(coordinator.snapshot().state, "clean")
  assert.equal(coordinator.snapshot().pendingCount, 0)
  assert.equal(coordinator.snapshot().lastSavedAt, 100)
})

test("commitNow freezes a structural barrier and leaves later fields for another batch", async () => {
  const commits = []
  const firstCommit = createDeferred()
  const { coordinator } = createHarness({
    commitMutation(batch) {
      commits.push(batch)
      return commits.length === 1
        ? firstCommit.promise
        : Promise.resolve(verifiedResult(batch, "-second"))
    },
  })
  const fieldOne = coordinator.stage({ key: "field:body", payload: "F1", apply() {} })
  const structuralPayload = { nodeId: "node-1" }
  const structuralPromise = coordinator.commitNow({
    key: "structure:insert",
    payload: structuralPayload,
    consumes: ["field:body"],
    apply() {},
  })
  structuralPayload.nodeId = "changed"
  const fieldTwo = coordinator.stage({ key: "field:body", payload: "F2", apply() {} })
  await settleMicrotasks()

  assert.equal(commits.length, 1)
  assert.deepEqual(commits[0].operations.map(operation => operation.id), [fieldOne.id, "structural-2"])
  assert.deepEqual(commits[0].operations.map(operation => operation.payload), ["F1", { nodeId: "node-1" }])
  assert.deepEqual(commits[0].operations[1].consumes, ["field:body"])
  assert.equal(Object.isFrozen(commits[0].operations[1].consumes), true)
  assert.equal(coordinator.snapshot().pendingCount, 3)

  const firstResult = verifiedResult(commits[0], "-first")
  firstCommit.resolve(firstResult)
  assert.equal(await structuralPromise, firstResult)
  assert.equal(coordinator.snapshot().state, "dirty")
  assert.equal(coordinator.snapshot().pendingCount, 1)

  const secondResult = await coordinator.flush()
  assert.deepEqual(secondResult, verifiedResult(commits[1], "-second"))
  assert.equal(commits.length, 2)
  assert.deepEqual(commits[1].operations.map(operation => operation.id), [fieldTwo.id])
})

test("quiet autosave fires at 600 ms but not 599 ms", async () => {
  const batches = []
  const { coordinator, fakeScheduler } = createHarness({
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: "draft", apply() {} })

  fakeScheduler.advance(599)
  await settleMicrotasks()
  assert.equal(batches.length, 0)
  assert.equal(coordinator.snapshot().state, "dirty")

  fakeScheduler.advance(1)
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].operations.map(operation => operation.payload), ["draft"])
  assert.equal(coordinator.snapshot().state, "clean")
})

test("continuous input autosaves by 3000 ms from the first pending field", async () => {
  const batches = []
  const { coordinator, fakeScheduler } = createHarness({
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: 0, apply() {} })
  for (const [advanceBy, payload] of [
    [500, 500],
    [500, 1000],
    [500, 1500],
    [500, 2000],
    [500, 2500],
    [499, 2999],
  ]) {
    fakeScheduler.advance(advanceBy)
    coordinator.stage({ key: "field:body", payload, apply() {} })
    await settleMicrotasks()
    assert.equal(batches.length, 0)
  }

  fakeScheduler.advance(1)
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].operations.map(operation => operation.payload), [2999])

  fakeScheduler.advance(1000)
  await settleMicrotasks()
  assert.equal(batches.length, 1)
})

test("a quiet and max timer tie starts only one write", async () => {
  const batches = []
  const { coordinator, fakeScheduler } = createHarness({
    debounceMs: 600,
    maxWaitMs: 600,
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: "tied", apply() {} })
  assert.equal(fakeScheduler.activeHandles().length, 2)

  fakeScheduler.advance(600)
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.deepEqual(fakeScheduler.activeHandles(), [])
})

test("a cleared stale quiet callback cannot capture a newer pending field", async () => {
  const batches = []
  const { coordinator, fakeScheduler } = createHarness({
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: "first", apply() {} })
  const [staleQuietHandle] = fakeScheduler.activeHandles()
  fakeScheduler.advance(100)
  coordinator.stage({ key: "field:body", payload: "second", apply() {} })

  fakeScheduler.fireEvenIfCleared(staleQuietHandle)
  await settleMicrotasks()
  assert.equal(batches.length, 0)

  fakeScheduler.advance(599)
  await settleMicrotasks()
  assert.equal(batches.length, 0)
  fakeScheduler.advance(1)
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].operations.map(operation => operation.payload), ["second"])
})

test("an invalid clock is rejected before any commit starts", async () => {
  let commitCalls = 0
  const { coordinator } = createHarness({
    now: () => -1,
    commitMutation: async batch => {
      commitCalls += 1
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: "draft", apply() {} })

  await assert.rejects(coordinator.flush(), TypeError)
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().pendingCount, 1)
})

test("a failed batch ID allocation preserves every pending field", async () => {
  let commitCalls = 0
  const { coordinator } = createHarness({
    createOperationId(kind) {
      return kind === "field" ? "same-id" : "same-id"
    },
    commitMutation: async batch => {
      commitCalls += 1
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:body", payload: "draft", apply() {} })

  await assert.rejects(coordinator.flush(), /must be unique/)
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().pendingCount, 1)
})

test("a structural operation is not accepted when its batch ID cannot be allocated", () => {
  const ids = ["field-1", "structural-2", "field-1"]
  let commitCalls = 0
  const { coordinator } = createHarness({
    createOperationId() {
      return ids.shift()
    },
    commitMutation() {
      commitCalls += 1
    },
  })
  coordinator.stage({ key: "field:body", payload: "draft", apply() {} })

  assert.throws(
    () => coordinator.commitNow({
      key: "structure:insert",
      payload: "insert",
      consumes: ["field:body"],
      apply() {},
    }),
    /must be unique/,
  )
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().generation, 1)
  assert.equal(coordinator.snapshot().pendingCount, 1)
})

test("flush has a fixed target and the pump runs only one commit at a time", async () => {
  const batches = []
  const gates = []
  let inFlight = 0
  let maximumInFlight = 0
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      const gate = createDeferred()
      gates.push(gate)
      inFlight += 1
      maximumInFlight = Math.max(maximumInFlight, inFlight)
      return gate.promise.finally(() => {
        inFlight -= 1
      })
    },
  })

  const structuralPromise = coordinator.commitNow({
    key: "structure:a",
    payload: "A",
    consumes: [],
    apply() {},
  })
  coordinator.stage({ key: "field:b", payload: "B", apply() {} })
  const firstFlush = coordinator.flush()
  const sameTargetFlush = coordinator.flush()
  coordinator.stage({ key: "field:c", payload: "C", apply() {} })
  let structuralSettled = false
  let flushSettled = false
  structuralPromise.then(() => { structuralSettled = true })
  firstFlush.then(() => { flushSettled = true })
  await settleMicrotasks()

  assert.equal(firstFlush, sameTargetFlush)
  assert.equal(batches.length, 1)
  assert.equal(maximumInFlight, 1)
  assert.equal(structuralSettled, false)
  assert.equal(flushSettled, false)

  const firstResult = verifiedResult(batches[0], "-a")
  gates[0].resolve(firstResult)
  assert.equal(await structuralPromise, firstResult)
  await settleMicrotasks()
  assert.equal(structuralSettled, true)
  assert.equal(flushSettled, false)
  assert.equal(batches.length, 2)
  assert.equal(maximumInFlight, 1)
  assert.deepEqual(batches[1].operations.map(operation => operation.payload), ["B"])

  const secondResult = verifiedResult(batches[1], "-b")
  gates[1].resolve(secondResult)
  assert.equal(await firstFlush, secondResult)
  await settleMicrotasks()
  assert.equal(batches.length, 2)
  assert.equal(coordinator.snapshot().state, "dirty")
  assert.deepEqual(coordinator.snapshot().pendingCount, 1)

  const finalFlush = coordinator.flush()
  await settleMicrotasks()
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[2].operations.map(operation => operation.payload), ["C"])
  gates[2].resolve(verifiedResult(batches[2], "-c"))
  await finalFlush
  assert.equal(maximumInFlight, 1)
})

test("flush returns one shared null Promise while the same clean target is current", async () => {
  const { coordinator } = createHarness()

  const firstEmpty = coordinator.flush()
  const sameEmpty = coordinator.flush()
  assert.equal(firstEmpty, sameEmpty)
  assert.equal(await firstEmpty, null)

  coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  await coordinator.flush()
  const savedEmpty = coordinator.flush()
  const sameSavedEmpty = coordinator.flush()
  assert.equal(savedEmpty, sameSavedEmpty)
  assert.equal(await savedEmpty, null)
})

test("subscriber re-entry cannot change an already frozen active batch", async () => {
  const firstGate = createDeferred()
  const batches = []
  const snapshots = []
  const passiveSnapshots = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return batches.length === 1
        ? firstGate.promise
        : Promise.resolve(verifiedResult(batch, "-late"))
    },
  })
  let reentered = false
  coordinator.subscribe(snapshot => {
    snapshots.push(snapshot)
    if (snapshot.state === "saving" && !reentered) {
      reentered = true
      coordinator.stage({ key: "field:late", payload: "late", apply() {} })
    }
  })
  coordinator.subscribe(snapshot => {
    if (snapshot.state === "saving") throw new Error("observer failure")
  })
  coordinator.subscribe(snapshot => passiveSnapshots.push(snapshot))
  const firstField = coordinator.stage({ key: "field:first", payload: "first", apply() {} })
  const structuralPromise = coordinator.commitNow({
    key: "structure:first",
    payload: "structure",
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()

  assert.equal(reentered, true)
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].operations.map(operation => operation.id), [firstField.id, "structural-2"])
  assert.equal(Object.isFrozen(batches[0]), true)
  assert.throws(() => batches[0].operations.push("late"), TypeError)
  assert.equal(coordinator.snapshot().pendingCount, 3)
  assert.deepEqual(
    passiveSnapshots
      .filter(snapshot => snapshot.state === "saving")
      .map(snapshot => snapshot.generation),
    [2, 3],
  )

  const firstResult = verifiedResult(batches[0], "-first")
  firstGate.resolve(firstResult)
  assert.equal(await structuralPromise, firstResult)
  assert.equal(coordinator.snapshot().state, "dirty")
  await coordinator.flush()
  assert.deepEqual(batches[1].operations.map(operation => operation.payload), ["late"])
  assert.equal(snapshots.filter(snapshot => snapshot.state === "clean").length, 2)
})

test("a falsy synchronous commit failure fails closed without sticking the pump", async () => {
  const { coordinator } = createHarness({
    commitMutation() {
      throw null
    },
  })
  coordinator.stage({ key: "field:body", payload: "draft", apply() {} })
  let observedFailure

  await assert.rejects(coordinator.flush(), failure => {
    observedFailure = failure
    return failure.code === "save-action-unavailable" && failure.cause === null
  })
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, observedFailure)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.notEqual(coordinator.snapshot().activeBatchId, null)
  assert.throws(
    () => coordinator.stage({ key: "field:later", payload: "later", apply() {} }),
    failure => failure.code === "save-action-unavailable",
  )
  await assert.rejects(
    coordinator.flush(),
    failure => failure.code === "save-action-unavailable",
  )
})

test("concurrent drain calls share one task and include edits staged during active work", async () => {
  const batches = []
  const gates = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      const gate = createDeferred()
      gates.push(gate)
      return gate.promise
    },
  })
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })

  const firstDrain = coordinator.drain("navigation")
  const sameDrain = coordinator.drain("modal-close")
  let drainSettled = false
  firstDrain.then(() => { drainSettled = true })
  await settleMicrotasks()
  assert.equal(firstDrain, sameDrain)
  assert.equal(batches.length, 1)

  coordinator.stage({ key: "field:b", payload: "B", apply() {} })
  gates[0].resolve(verifiedResult(batches[0], "-a"))
  await settleMicrotasks()
  assert.equal(drainSettled, false)
  assert.equal(batches.length, 2)
  assert.deepEqual(batches[1].operations.map(operation => operation.payload), ["B"])

  coordinator.stage({ key: "field:c", payload: "C", apply() {} })
  gates[1].resolve(verifiedResult(batches[1], "-b"))
  await settleMicrotasks()
  assert.equal(drainSettled, false)
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[2].operations.map(operation => operation.payload), ["C"])

  gates[2].resolve(verifiedResult(batches[2], "-c"))
  const drainedSnapshot = await firstDrain
  assert.equal(drainedSnapshot, coordinator.snapshot())
  assert.equal(drainedSnapshot.state, "clean")
  assert.equal(drainedSnapshot.pendingCount, 0)
})

test("observer re-entry sees the already-created shared drain task", async () => {
  let reentrantDrain = null
  const { coordinator } = createHarness()
  coordinator.subscribe(snapshot => {
    if (snapshot.state === "saving" && reentrantDrain === null) {
      reentrantDrain = coordinator.drain("observer")
    }
  })
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })

  const firstDrain = coordinator.drain("navigation")
  await settleMicrotasks()
  assert.notEqual(reentrantDrain, null)
  assert.equal(reentrantDrain, firstDrain)
  await firstDrain
})

test("a disposed observer sees the already-created shared dispose Promise", async () => {
  const { coordinator } = createHarness()
  let reentrantDispose = null
  coordinator.subscribe(snapshot => {
    if (snapshot.state === "disposed" && reentrantDispose === null) {
      reentrantDispose = coordinator.dispose()
    }
  })

  const firstDispose = coordinator.dispose()
  assert.notEqual(reentrantDispose, null)
  assert.equal(reentrantDispose, firstDispose)
  assert.equal(await firstDispose, coordinator.snapshot())
})

test("dispose closes synchronously but waits for already-started I/O", async () => {
  const firstGate = createDeferred()
  const batches = []
  const announcements = []
  const { coordinator, fakeScheduler } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return firstGate.promise
    },
  })
  coordinator.subscribe(snapshot => announcements.push(snapshot))
  const activeStructural = coordinator.commitNow({
    key: "structure:a",
    payload: "A",
    consumes: [],
    apply() {},
  })
  coordinator.stage({ key: "field:b", payload: "B", apply() {} })
  const boundaryFlush = coordinator.flush()
  const laterStructural = coordinator.commitNow({
    key: "structure:c",
    payload: "C",
    consumes: [],
    apply() {},
  })
  coordinator.stage({ key: "field:d", payload: "D", apply() {} })
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.equal(fakeScheduler.activeHandles().length, 2)

  let activeFailure
  let flushFailure
  let laterFailure
  activeStructural.catch(failure => { activeFailure = failure })
  boundaryFlush.catch(failure => { flushFailure = failure })
  laterStructural.catch(failure => { laterFailure = failure })
  const firstDispose = coordinator.dispose()
  const sameDispose = coordinator.dispose()
  let disposeSettled = false
  firstDispose.then(() => { disposeSettled = true })

  assert.equal(firstDispose, sameDispose)
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(coordinator.snapshot().error?.code, "save-disposed")
  assert.equal(announcements.at(-1).state, "disposed")
  assert.equal(announcements.filter(snapshot => snapshot.state === "disposed").length, 1)
  assert.deepEqual(fakeScheduler.activeHandles(), [])
  assert.throws(
    () => coordinator.stage({ key: "field:closed", payload: null, apply() {} }),
    failure => failure.code === "save-disposed",
  )
  assert.throws(
    () => coordinator.commitNow({
      key: "structure:closed",
      payload: null,
      consumes: [],
      apply() {},
    }),
    failure => failure.code === "save-disposed",
  )
  await settleMicrotasks()
  assert.equal(activeFailure?.code, "save-disposed")
  assert.equal(activeFailure, coordinator.snapshot().error)
  assert.equal(flushFailure?.code, "save-disposed")
  assert.equal(flushFailure, coordinator.snapshot().error)
  assert.equal(laterFailure?.code, "save-disposed")
  assert.equal(laterFailure, coordinator.snapshot().error)
  assert.equal(disposeSettled, false)
  assert.equal(batches.length, 1)

  firstGate.resolve(verifiedResult(batches[0], "-late"))
  const disposedSnapshot = await firstDispose
  assert.equal(disposedSnapshot.state, "disposed")
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(batches.length, 1)
  assert.equal(announcements.filter(snapshot => snapshot.state === "disposed").length, 1)
  await assert.rejects(coordinator.flush(), failure => failure.code === "save-disposed")
  await assert.rejects(coordinator.drain(), failure => failure.code === "save-disposed")
})

test("a conflict raised before the commit microtask performs zero I/O and retains its batch", async () => {
  const ids = ["structural-a", "batch-a", "structural-b", "batch-a"]
  let commitCalls = 0
  let admissionFailure = null
  let coordinator
  ;({ coordinator } = createHarness({
    createOperationId() {
      return ids.shift()
    },
    commitMutation(batch) {
      commitCalls += 1
      return verifiedResult(batch)
    },
  }))
  coordinator.subscribe(snapshot => {
    if (snapshot.state !== "saving" || admissionFailure !== null) return
    try {
      coordinator.commitNow({
        key: "structure:reentrant",
        payload: "reentrant",
        consumes: [],
        apply() {},
      })
    } catch (failure) {
      admissionFailure = failure
    }
  })

  const admittedCommit = coordinator.commitNow({
    key: "structure:admitted",
    payload: "admitted",
    consumes: [],
    apply() {},
  })
  void admittedCommit.catch(() => {})
  await settleMicrotasks()

  assert.notEqual(admissionFailure, null)
  await assert.rejects(admittedCommit, failure => failure === admissionFailure)
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, admissionFailure)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.equal(coordinator.snapshot().hasRecoverableCandidate, true)
})

test("a late verified result cannot revive a conflict or start a later batch", async () => {
  const ids = ["structural-a", "batch-a", "field-b", "structural-c", "batch-a"]
  const gate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    createOperationId() {
      return ids.shift()
    },
    commitMutation(batch) {
      batches.push(batch)
      return gate.promise
    },
  })
  const admittedCommit = coordinator.commitNow({
    key: "structure:a",
    payload: "A",
    consumes: [],
    apply() {},
  })
  void admittedCommit.catch(() => {})
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  coordinator.stage({ key: "field:b", payload: "B", apply() {} })
  let terminalFailure
  assert.throws(
    () => coordinator.commitNow({
      key: "structure:c",
      payload: "C",
      consumes: [],
      apply() {},
    }),
    failure => {
      terminalFailure = failure
      return true
    },
  )
  await assert.rejects(admittedCommit, failure => failure === terminalFailure)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, terminalFailure)

  gate.resolve(verifiedResult(batches[0], "-late"))
  await settleMicrotasks()
  assert.equal(batches.length, 1)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, terminalFailure)
  assert.equal(coordinator.snapshot().lastSavedAt, 100)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.throws(
    () => coordinator.stage({ key: "field:later", payload: "later", apply() {} }),
    failure => failure.code === "save-action-unavailable",
  )
})

test("a one-time clearTimeout failure attempts both timers and loses no descriptor", async () => {
  const throwingScheduler = createThrowingClearScheduler()
  let commitCalls = 0
  const { coordinator } = createHarness({
    scheduler: throwingScheduler.scheduler,
    commitMutation(batch) {
      commitCalls += 1
      return verifiedResult(batch)
    },
  })
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  let flushPromise
  assert.doesNotThrow(() => {
    flushPromise = coordinator.flush()
  })
  await assert.rejects(flushPromise, failure => failure === throwingScheduler.failure)

  assert.equal(throwingScheduler.clearCalls(), 2)
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.equal(coordinator.snapshot().hasRecoverableCandidate, true)
  const disposed = await coordinator.dispose()
  assert.equal(disposed.state, "disposed")
})

test("dispose settles even when every clearTimeout call throws", async () => {
  const throwingScheduler = createThrowingClearScheduler({ always: true })
  const { coordinator } = createHarness({ scheduler: throwingScheduler.scheduler })
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  let disposePromise
  assert.doesNotThrow(() => {
    disposePromise = coordinator.dispose()
  })
  const disposed = await disposePromise

  assert.equal(throwingScheduler.clearCalls(), 2)
  assert.equal(disposed.state, "disposed")
  assert.equal(disposed.pendingCount, 1)
  assert.equal(disposed.error?.code, "save-disposed")
  assert.equal(coordinator.dispose(), disposePromise)
})

test("a null timer-cancellation failure keeps its exact cause and still disposes", async () => {
  let clearCalls = 0
  const scheduler = {
    setTimeout() {
      return Symbol("timer")
    },
    clearTimeout() {
      clearCalls += 1
      if (clearCalls === 1) throw null
    },
  }
  const { coordinator } = createHarness({ scheduler })
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })

  await assert.rejects(
    coordinator.flush(),
    failure => failure.code === "save-action-unavailable" && failure.cause === null,
  )
  assert.equal(clearCalls, 2)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.equal((await coordinator.dispose()).state, "disposed")
})

test("now re-entering dispose cannot start I/O or revive the coordinator", async () => {
  let coordinator
  let reentrantDispose = null
  let commitCalls = 0
  ;({ coordinator } = createHarness({
    now() {
      if (reentrantDispose === null) reentrantDispose = coordinator.dispose()
      return 100
    },
    commitMutation(batch) {
      commitCalls += 1
      return verifiedResult(batch)
    },
  }))
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  const flushPromise = coordinator.flush()
  void flushPromise.catch(() => {})
  await settleMicrotasks()

  assert.notEqual(reentrantDispose, null)
  await assert.rejects(flushPromise, failure => failure.code === "save-disposed")
  const disposed = await reentrantDispose
  assert.equal(coordinator.dispose(), reentrantDispose)
  assert.equal(disposed.state, "disposed")
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(commitCalls, 0)
  assert.throws(
    () => coordinator.stage({ key: "field:later", payload: "later", apply() {} }),
    failure => failure.code === "save-disposed",
  )
})

test("cyclic prototype traps fail in a bounded child process", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    let cyclicPrototype
    cyclicPrototype = new Proxy({}, {
      getPrototypeOf() { return cyclicPrototype },
    })
    try {
      coordinator.stage({ key: "field:a", payload: { child: cyclicPrototype }, apply() {} })
      process.exitCode = 2
    } catch (failure) {
      if (!(failure instanceof TypeError)) throw failure
      console.log("bounded-type-error")
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /bounded-type-error/)
})

test("null-prototype payloads remain isolated from Object prototype pollution", () => {
  const toJsonDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
  const inheritedKey = "__tuuruSaveCoordinatorInheritedProbe__"
  const inheritedDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, inheritedKey)
  let hookCalls = 0
  let clonedPrototype
  let inheritedValue
  let serialized
  try {
    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value() {
        hookCalls += 1
        return { poisoned: true }
      },
    })
    Object.defineProperty(Object.prototype, inheritedKey, {
      configurable: true,
      value: "inherited",
    })
    const payload = Object.create(null)
    payload.value = "safe"
    const { coordinator } = createHarness()
    const operation = coordinator.stage({ key: "field:a", payload, apply() {} })
    clonedPrototype = Object.getPrototypeOf(operation.payload)
    inheritedValue = operation.payload[inheritedKey]
    serialized = JSON.stringify(operation.payload)
  } finally {
    if (toJsonDescriptor === undefined) delete Object.prototype.toJSON
    else Object.defineProperty(Object.prototype, "toJSON", toJsonDescriptor)
    if (inheritedDescriptor === undefined) delete Object.prototype[inheritedKey]
    else Object.defineProperty(Object.prototype, inheritedKey, inheritedDescriptor)
  }

  assert.equal(clonedPrototype, null)
  assert.equal(inheritedValue, undefined)
  assert.equal(serialized, '{"value":"safe"}')
  assert.equal(hookCalls, 0)
})

test("operation envelope fields are captured exactly once before acceptance", async () => {
  const reads = { key: 0, payload: 0, apply: 0, consumes: 0 }
  const apply = () => {}
  const batches = []
  const envelope = {
    get key() {
      reads.key += 1
      return reads.key === 1 ? "structure:valid" : ""
    },
    get payload() {
      reads.payload += 1
      return reads.payload === 1 ? { value: "valid" } : undefined
    },
    get apply() {
      reads.apply += 1
      return reads.apply === 1 ? apply : null
    },
    get consumes() {
      reads.consumes += 1
      return reads.consumes === 1 ? ["field:a"] : null
    },
  }
  const { coordinator } = createHarness({
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  })

  await coordinator.commitNow(envelope)
  const operation = batches[0].operations.at(-1)
  assert.deepEqual(reads, { key: 1, payload: 1, apply: 1, consumes: 1 })
  assert.equal(operation.key, "structure:valid")
  assert.deepEqual(operation.payload, { value: "valid" })
  assert.equal(operation.apply, apply)
  assert.deepEqual(operation.consumes, ["field:a"])
})

test("an invalid first envelope read consumes no ID or generation", () => {
  let keyReads = 0
  let applyReads = 0
  const { coordinator, idCalls } = createHarness()
  assert.throws(
    () => coordinator.stage({
      get key() {
        keyReads += 1
        return keyReads === 1 ? "" : "field:valid"
      },
      payload: null,
      get apply() {
        applyReads += 1
        return applyReads === 1 ? null : () => {}
      },
    }),
    TypeError,
  )

  assert.equal(keyReads, 1)
  assert.equal(applyReads, 0)
  assert.deepEqual(idCalls, [])
  assert.equal(coordinator.snapshot().generation, 0)
  assert.equal(coordinator.snapshot().pendingCount, 0)
})

test("a field ID callback cannot accept work after re-entering dispose", async () => {
  let coordinator
  let reentrantDispose = null
  let commitCalls = 0
  const idCalls = []
  let stageFailure = null
  ;({ coordinator } = createHarness({
    createOperationId(kind) {
      idCalls.push(kind)
      if (kind === "field" && reentrantDispose === null) {
        reentrantDispose = coordinator.dispose()
      }
      return "field-discarded"
    },
    commitMutation(batch) {
      commitCalls += 1
      return verifiedResult(batch)
    },
  }))
  try {
    coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  } catch (failure) {
    stageFailure = failure
  }
  const flushOutcome = await coordinator.flush().then(
    value => ({ value }),
    failure => ({ failure }),
  )
  const disposed = await reentrantDispose

  assert.equal(stageFailure?.code, "save-disposed")
  assert.equal(flushOutcome.failure, stageFailure)
  assert.equal(disposed.state, "disposed")
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(coordinator.snapshot().generation, 0)
  assert.equal(coordinator.snapshot().pendingCount, 0)
  assert.deepEqual(idCalls, ["field"])
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.dispose(), reentrantDispose)
})

test("a batch ID callback cannot accept a structural operation after disposing", async () => {
  let coordinator
  let reentrantDispose = null
  let commitCalls = 0
  let sequence = 0
  ;({ coordinator } = createHarness({
    createOperationId(kind) {
      sequence += 1
      if (kind === "batch" && reentrantDispose === null) {
        reentrantDispose = coordinator.dispose()
      }
      return `${kind}-${sequence}`
    },
    commitMutation(batch) {
      commitCalls += 1
      return verifiedResult(batch)
    },
  }))
  coordinator.stage({ key: "field:a", payload: "A", apply() {} })
  let structuralFailure = null
  let structuralPromise = null
  try {
    structuralPromise = coordinator.commitNow({
      key: "structure:a",
      payload: "structure",
      consumes: ["field:a"],
      apply() {},
    })
  } catch (failure) {
    structuralFailure = failure
  }
  const structuralOutcome = structuralPromise === null
    ? null
    : await structuralPromise.then(
        value => ({ value }),
        failure => ({ failure }),
      )
  const disposed = await reentrantDispose

  assert.equal(structuralFailure?.code, "save-disposed")
  assert.equal(structuralOutcome, null)
  assert.equal(disposed.state, "disposed")
  assert.equal(coordinator.snapshot().state, "disposed")
  assert.equal(coordinator.snapshot().generation, 1)
  assert.equal(coordinator.snapshot().pendingCount, 1)
  assert.equal(commitCalls, 0)
  assert.equal(coordinator.dispose(), reentrantDispose)
})

test("a batch ID callback re-entering flush shares the fixed-target Promise", async () => {
  let coordinator
  let innerFlush = null
  let reentered = false
  let idSequence = 0
  const batches = []
  ;({ coordinator } = createHarness({
    createOperationId(kind) {
      idSequence += 1
      if (kind === "batch" && !reentered) {
        reentered = true
        innerFlush = coordinator.flush()
      }
      return `${kind}-${idSequence}`
    },
    commitMutation: async batch => {
      batches.push(batch)
      return verifiedResult(batch)
    },
  }))
  const field = coordinator.stage({ key: "field:a", payload: "A", apply() {} })

  const outerFlush = coordinator.flush()
  const [outerResult, innerResult] = await Promise.all([outerFlush, innerFlush])

  assert.equal(innerFlush, outerFlush)
  assert.equal(innerResult, outerResult)
  assert.equal(batches.length, 1)
  assert.equal(
    batches.flatMap(batch => batch.operationIds).filter(id => id === field.id).length,
    1,
  )
  assert.equal(coordinator.snapshot().state, "clean")
  assert.equal(coordinator.snapshot().pendingCount, 0)
})

test("infinitely fresh forged prototypes fail in a bounded child process", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const freshHandler = {
      getPrototypeOf() { return new Proxy({}, freshHandler) },
    }
    let firstRead = true
    const source = new Proxy({}, {
      getPrototypeOf() {
        if (firstRead) {
          firstRead = false
          return Object.prototype
        }
        return new Proxy({}, freshHandler)
      },
    })
    try {
      coordinator.stage({ key: "field:a", payload: { child: source }, apply() {} })
      process.exitCode = 2
    } catch (failure) {
      if (!(failure instanceof TypeError)) throw failure
      console.log("bounded-fresh-type-error")
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /bounded-fresh-type-error/)
})

test("polluted Array prototype chains are rejected before inherited toJSON can run", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const originalPrototype = Object.getPrototypeOf(Array.prototype)
    const pollutedPrototype = Object.create(originalPrototype)
    let hookCalls = 0
    let stageFailure = null
    let operation = null
    Object.defineProperty(pollutedPrototype, "toJSON", {
      configurable: true,
      value() {
        hookCalls += 1
        return { polluted: true }
      },
    })
    try {
      Object.setPrototypeOf(Array.prototype, pollutedPrototype)
      try {
        operation = coordinator.stage({
          key: "field:a",
          payload: ["safe"],
          apply() {},
        })
      } catch (failure) {
        stageFailure = failure
      }
      if (operation !== null) JSON.stringify(operation.payload)
    } finally {
      Object.setPrototypeOf(Array.prototype, originalPrototype)
    }
    if (stageFailure instanceof TypeError && hookCalls === 0) {
      console.log("polluted-array-prototype-rejected")
    } else {
      console.error("polluted Array prototype was accepted or its hook ran")
      process.exitCode = 2
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /polluted-array-prototype-rejected/)
})

test("an Array ownKeys trap cannot pollute inherited toJSON after validation", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const originalPrototype = Object.getPrototypeOf(Array.prototype)
    const pollutedPrototype = Object.create(originalPrototype)
    let hookCalls = 0
    let ownKeysCalls = 0
    let stageFailure = null
    let operation = null
    Object.defineProperty(pollutedPrototype, "toJSON", {
      configurable: true,
      value() {
        hookCalls += 1
        return { polluted: true }
      },
    })
    const target = ["safe"]
    const source = new Proxy(target, {
      getPrototypeOf() {
        return Array.prototype
      },
      ownKeys(current) {
        ownKeysCalls += 1
        Object.setPrototypeOf(Array.prototype, pollutedPrototype)
        return Reflect.ownKeys(current)
      },
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
    })
    try {
      try {
        operation = coordinator.stage({
          key: "field:a",
          payload: source,
          apply() {},
        })
      } catch (failure) {
        stageFailure = failure
      }
      if (operation !== null) JSON.stringify(operation.payload)
    } finally {
      Object.setPrototypeOf(Array.prototype, originalPrototype)
    }
    if (stageFailure instanceof TypeError && hookCalls === 0 && ownKeysCalls === 1) {
      console.log("own-keys-pollution-rejected")
    } else {
      console.error(JSON.stringify({
        stageRejected: stageFailure instanceof TypeError,
        hookCalls,
        ownKeysCalls,
      }))
      process.exitCode = 2
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /own-keys-pollution-rejected/)
})

test("the final source prototype trap is followed by fixed-chain validation", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const originalPrototype = Object.getPrototypeOf(Array.prototype)
    const pollutedPrototype = Object.create(originalPrototype)
    let descriptorsCaptured = false
    let hookCalls = 0
    let prototypeReads = 0
    let stageFailure = null
    Object.defineProperty(pollutedPrototype, "toJSON", {
      configurable: true,
      value() {
        hookCalls += 1
        return { polluted: true }
      },
    })
    const target = ["safe"]
    const source = new Proxy(target, {
      getPrototypeOf() {
        prototypeReads += 1
        if (descriptorsCaptured) {
          Object.setPrototypeOf(Array.prototype, pollutedPrototype)
        }
        return Array.prototype
      },
      ownKeys(current) {
        descriptorsCaptured = true
        return Reflect.ownKeys(current)
      },
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
    })
    try {
      try {
        coordinator.stage({
          key: "field:a",
          payload: source,
          apply() {},
        })
      } catch (failure) {
        stageFailure = failure
      }
    } finally {
      Object.setPrototypeOf(Array.prototype, originalPrototype)
    }
    if (stageFailure instanceof TypeError && hookCalls === 0 && prototypeReads === 2) {
      console.log("final-prototype-pollution-rejected")
    } else {
      console.error(JSON.stringify({
        stageRejected: stageFailure instanceof TypeError,
        hookCalls,
        prototypeReads,
      }))
      process.exitCode = 2
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /final-prototype-pollution-rejected/)
})

test("a null-prototype child ownKeys trap cannot pollute its ordinary parent clone", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const originalToJson = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
    let hookCalls = 0
    let ownKeysCalls = 0
    let stageFailure = null
    let operation = null
    const childTarget = Object.create(null)
    childTarget.value = "safe"
    const child = new Proxy(childTarget, {
      ownKeys(current) {
        ownKeysCalls += 1
        Object.defineProperty(Object.prototype, "toJSON", {
          configurable: true,
          value() {
            hookCalls += 1
            return { polluted: true }
          },
        })
        return Reflect.ownKeys(current)
      },
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
    })
    try {
      try {
        operation = coordinator.stage({
          key: "field:a",
          payload: { child },
          apply() {},
        })
      } catch (failure) {
        stageFailure = failure
      }
      if (operation !== null) JSON.stringify(operation.payload)
    } finally {
      if (originalToJson === undefined) delete Object.prototype.toJSON
      else Object.defineProperty(Object.prototype, "toJSON", originalToJson)
    }
    if (stageFailure instanceof TypeError && hookCalls === 0 && ownKeysCalls === 1) {
      console.log("ordinary-parent-pollution-rejected")
    } else {
      console.error(JSON.stringify({
        stageRejected: stageFailure instanceof TypeError,
        hookCalls,
        ownKeysCalls,
      }))
      process.exitCode = 2
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /ordinary-parent-pollution-rejected/)
})

test("a null-prototype child descriptor trap cannot pollute its array parent clone", () => {
  const moduleUrl = new URL("../js/work-save-coordinator.js", import.meta.url).href
  const script = `
    import { createWorkSaveCoordinator } from ${JSON.stringify(moduleUrl)}
    const scheduler = { setTimeout() { return 1 }, clearTimeout() {} }
    const coordinator = createWorkSaveCoordinator({
      commitMutation: async batch => ({ ok: true, operationId: batch.id }),
      commitPreparedCandidate: async batch => ({ ok: true, operationId: batch.id }),
      recheckUnknown: async () => ({ outcome: "not-written" }),
      scheduler,
    })
    const originalToJson = Object.getOwnPropertyDescriptor(Array.prototype, "toJSON")
    let hookCalls = 0
    let descriptorCalls = 0
    let stageFailure = null
    let operation = null
    const childTarget = Object.create(null)
    childTarget.value = "safe"
    const child = new Proxy(childTarget, {
      ownKeys(current) {
        return Reflect.ownKeys(current)
      },
      getOwnPropertyDescriptor(current, key) {
        descriptorCalls += 1
        Object.defineProperty(Array.prototype, "toJSON", {
          configurable: true,
          value() {
            hookCalls += 1
            return { polluted: true }
          },
        })
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
    })
    try {
      try {
        operation = coordinator.stage({
          key: "field:a",
          payload: [child],
          apply() {},
        })
      } catch (failure) {
        stageFailure = failure
      }
      if (operation !== null) JSON.stringify(operation.payload)
    } finally {
      if (originalToJson === undefined) delete Array.prototype.toJSON
      else Object.defineProperty(Array.prototype, "toJSON", originalToJson)
    }
    if (stageFailure instanceof TypeError && hookCalls === 0 && descriptorCalls === 1) {
      console.log("array-parent-pollution-rejected")
    } else {
      console.error(JSON.stringify({
        stageRejected: stageFailure instanceof TypeError,
        hookCalls,
        descriptorCalls,
      }))
      process.exitCode = 2
    }
  `
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { encoding: "utf8", timeout: 2000 },
  )

  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /array-parent-pollution-rejected/)
})

test("unchanged mutation read and write failures pause as retryable with exact identity", async t => {
  for (const code of ["mutation-read-failed", "mutation-write-failed"]) {
    await t.test(code, async () => {
      const failure = mutationFailure(code, {
        operationId: "batch-2",
        phase: code === "mutation-read-failed" ? "read-source" : "write",
        commitState: "unchanged",
      })
      const { coordinator } = createHarness({
        commitMutation: async () => { throw failure },
      })

      coordinator.stage({ key: "field:title", payload: code, apply() {} })
      await assert.rejects(coordinator.flush(), supplied => supplied === failure)

      assert.equal(coordinator.snapshot().state, "error-retryable")
      assert.equal(coordinator.snapshot().error, failure)
      assert.equal(coordinator.snapshot().canRetry, true)
      assert.equal(coordinator.snapshot().canRecheck, false)
      assert.equal(coordinator.snapshot().activeBatchId, "batch-2")
    })
  }
})

test("only unchanged apply and candidate validation failures pause as correctable", async t => {
  for (const phase of ["apply", "validate-candidate"]) {
    await t.test(phase, async () => {
      const failure = mutationFailure("mutation-invalid", {
        operationId: "batch-2",
        phase,
        commitState: "unchanged",
      })
      const { coordinator } = createHarness({
        commitMutation: async () => { throw failure },
      })

      coordinator.stage({ key: "field:title", payload: phase, apply() {} })
      await assert.rejects(coordinator.flush(), supplied => supplied === failure)

      assert.equal(coordinator.snapshot().state, "error-invalid")
      assert.equal(coordinator.snapshot().error, failure)
      assert.equal(coordinator.snapshot().canRetry, false)
      assert.equal(coordinator.snapshot().canRecheck, false)
      assert.equal(coordinator.snapshot().activeBatchId, "batch-2")
    })
  }
})

test("untrusted or non-correctable failures still fail closed to conflict", async t => {
  const cases = [
    {
      name: "invalid source",
      failure: mutationFailure("mutation-invalid", {
        phase: "validate-source",
        commitState: "unchanged",
      }),
    },
    {
      name: "explicit conflict",
      failure: mutationFailure("mutation-conflict", {
        phase: "check-work",
        commitState: "unchanged",
      }),
    },
    {
      name: "retryable metadata operation ID mismatch",
      failure: mutationFailure("mutation-write-failed", {
        operationId: "another-batch",
        phase: "write",
        commitState: "unchanged",
      }),
    },
    {
      name: "retryable metadata missing operation ID",
      failure: mutationFailure("mutation-read-failed", {
        phase: "read-source",
        commitState: "unchanged",
      }),
    },
    {
      name: "unknown code",
      failure: mutationFailure("invented-failure", {
        phase: "write",
        commitState: "unchanged",
      }),
    },
    {
      name: "missing details",
      failure: Object.assign(new Error("missing details"), {
        code: "mutation-write-failed",
        commitState: "unchanged",
      }),
    },
    {
      name: "inherited metadata",
      failure: mutationFailure(
        "mutation-write-failed",
        Object.create({ phase: "write", commitState: "unchanged" }),
      ),
    },
  ]

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const { coordinator } = createHarness({
        commitMutation: async () => { throw entry.failure },
      })
      coordinator.stage({ key: "field:title", payload: entry.name, apply() {} })

      await assert.rejects(coordinator.flush(), supplied => supplied === entry.failure)
      assert.equal(coordinator.snapshot().state, "conflict")
      assert.equal(coordinator.snapshot().error, entry.failure)
      assert.equal(coordinator.snapshot().canRetry, false)
    })
  }
})

test("recognized lease failures close ordinary commits with exact error identity", async t => {
  for (const code of ["mutation-lease-lost", "work-locked", "mutation-lock-unavailable"]) {
    await t.test(code, async () => {
      const failure = mutationFailure(code, {
        operationId: "foreign-or-missing-is-irrelevant",
        phase: "admission",
        commitState: "unknown",
      })
      const { coordinator } = createHarness({
        commitMutation: async () => { throw failure },
      })
      coordinator.stage({ key: "field:title", payload: code, apply() {} })

      await assert.rejects(coordinator.flush(), reason => reason === failure)
      assert.equal(coordinator.snapshot().state, "lease-lost")
      assert.equal(coordinator.snapshot().error, failure)
      assert.equal(coordinator.snapshot().canRetry, false)
      assert.equal(coordinator.recoveryMaterial().kind, "ordinary")
    })
  }
})

test("failure metadata accessors are never invoked and fail closed", async () => {
  let detailReads = 0
  let commitStateReads = 0
  const failure = Object.assign(new Error("hostile metadata"), {
    code: "mutation-write-failed",
  })
  Object.defineProperty(failure, "details", {
    enumerable: true,
    get() {
      detailReads += 1
      return { commitState: "unchanged", phase: "write" }
    },
  })
  const details = {}
  Object.defineProperty(details, "commitState", {
    enumerable: true,
    get() {
      commitStateReads += 1
      return "unchanged"
    },
  })
  const nestedFailure = mutationFailure("mutation-write-failed", details)

  for (const suppliedFailure of [failure, nestedFailure]) {
    const { coordinator } = createHarness({
      commitMutation: async () => { throw suppliedFailure },
    })
    coordinator.stage({ key: "field:title", payload: null, apply() {} })
    await assert.rejects(coordinator.flush(), reason => reason === suppliedFailure)
    assert.equal(coordinator.snapshot().state, "conflict")
  }

  assert.equal(detailReads, 0)
  assert.equal(commitStateReads, 0)
})

test("a retryable failed batch rejects only its owners and pauses later work", async () => {
  const firstAttempt = createDeferred()
  const batches = []
  const failure = mutationFailure("mutation-write-failed", {
    operationId: "batch-2",
    phase: "write",
    commitState: "unchanged",
  })
  const { coordinator, fakeScheduler, idCalls } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return firstAttempt.promise
    },
  })

  const failedCommit = coordinator.commitNow({
    key: "structure:first",
    payload: "first",
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()
  const laterCommit = coordinator.commitNow({
    key: "structure:later",
    payload: "later",
    consumes: [],
    apply() {},
  })
  const crossingFlush = coordinator.flush()
  const crossingDrain = coordinator.drain()
  firstAttempt.reject(failure)

  await assert.rejects(failedCommit, reason => reason === failure)
  await assert.rejects(crossingFlush, reason => reason === failure)
  await assert.rejects(crossingDrain, reason => reason === failure)
  let laterSettled = false
  laterCommit.then(
    () => { laterSettled = true },
    () => { laterSettled = true },
  )
  await settleMicrotasks()
  assert.equal(laterSettled, false)
  assert.equal(batches.length, 1)

  const beforeDeniedIds = idCalls.length
  const beforeDeniedGeneration = coordinator.snapshot().generation
  const queued = coordinator.stage({ key: "field:queued", payload: "queued", apply() {} })
  assert.equal(queued.kind, "field")
  assert.deepEqual(fakeScheduler.activeHandles(), [])
  let unavailableFailure
  assert.throws(
    () => coordinator.commitNow({
      key: "structure:denied",
      payload: null,
      consumes: [],
      apply() {},
    }),
    reason => {
      unavailableFailure = reason
      return reason.code === "save-action-unavailable"
    },
  )
  await assert.rejects(coordinator.flush(), reason => reason === unavailableFailure)
  await assert.rejects(coordinator.drain(), reason => reason === unavailableFailure)
  assert.equal(idCalls.length, beforeDeniedIds + 1)
  assert.equal(coordinator.snapshot().generation, beforeDeniedGeneration + 1)
  assert.equal(coordinator.snapshot().pendingCount, 3)
  assert.equal(coordinator.snapshot().activeBatchId, batches[0].id)
  assert.equal(batches.length, 1)

  laterCommit.catch(() => {})
  await coordinator.dispose()
})

test("an invalid pause rejects ordinary admission before IDs, timers, or boundaries", async () => {
  const failure = mutationFailure("mutation-invalid", {
    operationId: "batch-2",
    phase: "apply",
    commitState: "unchanged",
  })
  const { coordinator, fakeScheduler, idCalls } = createHarness({
    commitMutation: async () => { throw failure },
  })
  coordinator.stage({ key: "field:title", payload: "bad", apply() {} })
  await assert.rejects(coordinator.flush(), reason => reason === failure)
  const beforeIds = idCalls.length
  const beforeSnapshot = coordinator.snapshot()

  let unavailableFailure
  assert.throws(
    () => coordinator.stage({ key: "field:later", payload: null, apply() {} }),
    reason => {
      unavailableFailure = reason
      return reason.code === "save-action-unavailable"
    },
  )
  assert.throws(
    () => coordinator.commitNow({
      key: "structure:later",
      payload: null,
      consumes: [],
      apply() {},
    }),
    reason => reason === unavailableFailure,
  )
  await assert.rejects(coordinator.flush(), reason => reason === unavailableFailure)
  await assert.rejects(coordinator.drain(), reason => reason === unavailableFailure)
  await assert.rejects(coordinator.retry(), reason => reason === unavailableFailure)
  assert.equal(idCalls.length, beforeIds)
  assert.deepEqual(fakeScheduler.activeHandles(), [])
  assert.equal(coordinator.snapshot(), beforeSnapshot)
})

test("ordinary inputs must omit correctsOperationId without invoking accessors", () => {
  for (const method of ["stage", "commitNow"]) {
    const { coordinator, idCalls } = createHarness()
    const baseInput = method === "stage"
      ? { key: "field:title", payload: null, apply() {} }
      : { key: "structure:chapter", payload: null, consumes: [], apply() {} }
    Object.defineProperty(baseInput, "correctsOperationId", {
      value: undefined,
      enumerable: true,
    })

    assert.throws(() => coordinator[method](baseInput), TypeError)
    assert.deepEqual(idCalls, [])
    assert.equal(coordinator.snapshot().generation, 0)
  }

  let accessorCalls = 0
  const { coordinator, idCalls } = createHarness()
  const hostileInput = { key: "field:title", payload: null, apply() {} }
  Object.defineProperty(hostileInput, "correctsOperationId", {
    enumerable: true,
    get() {
      accessorCalls += 1
      return undefined
    },
  })

  assert.throws(() => coordinator.stage(hostileInput), TypeError)
  assert.equal(accessorCalls, 0)
  assert.deepEqual(idCalls, [])
  assert.equal(coordinator.snapshot().generation, 0)
})

test("retry is single-flight, reuses the exact batch, and resumes queued work serially", async () => {
  const gates = [createDeferred(), createDeferred(), createDeferred(), createDeferred()]
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      const gate = gates[batches.length]
      batches.push(batch)
      return gate.promise
    },
  })

  const failedCommit = coordinator.commitNow({
    key: "structure:first",
    payload: "first",
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()
  const blockedBatch = batches[0]
  const laterCommit = coordinator.commitNow({
    key: "structure:later",
    payload: "later",
    consumes: [],
    apply() {},
  })
  const firstFailure = mutationFailure("mutation-write-failed", {
    operationId: blockedBatch.id,
    phase: "write",
    commitState: "unchanged",
  })
  gates[0].reject(firstFailure)
  await assert.rejects(failedCommit, reason => reason === firstFailure)
  await settleMicrotasks()

  const queuedField = coordinator.stage({
    key: "field:queued",
    payload: "queued",
    apply() {},
  })
  let reentrantRetry = null
  let verifiedReentrantRetry = null
  coordinator.subscribe(snapshot => {
    if (snapshot.state === "saving"
      && snapshot.activeBatchId === blockedBatch.id
      && reentrantRetry === null) {
      reentrantRetry = coordinator.retry()
    }
    if (snapshot.state === "dirty" && verifiedReentrantRetry === null) {
      verifiedReentrantRetry = coordinator.retry()
    }
  })
  const retryPromise = coordinator.retry()
  assert.equal(reentrantRetry, retryPromise)
  assert.equal(coordinator.retry(), retryPromise)
  assert.equal(coordinator.snapshot().state, "saving")
  assert.equal(coordinator.snapshot().error, null)
  assert.equal(coordinator.snapshot().canRetry, false)
  assert.equal(coordinator.snapshot().activeBatchId, blockedBatch.id)
  await settleMicrotasks()
  assert.equal(batches.length, 2)
  assert.equal(batches[1], blockedBatch)

  const retryResult = verifiedResult(blockedBatch, "-retry")
  gates[1].resolve(retryResult)
  assert.equal(await retryPromise, retryResult)
  assert.equal(verifiedReentrantRetry, retryPromise)
  await settleMicrotasks()
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[2].operations.map(operation => operation.payload), ["later"])

  const laterResult = verifiedResult(batches[2], "-later")
  gates[2].resolve(laterResult)
  assert.equal(await laterCommit, laterResult)
  await settleMicrotasks()
  assert.equal(batches.length, 4)
  assert.deepEqual(batches[3].operations, [queuedField])

  const drainPromise = coordinator.drain()
  gates[3].resolve(verifiedResult(batches[3], "-queued"))
  assert.equal((await drainPromise).state, "clean")
  assert.equal(coordinator.snapshot().pendingCount, 0)
})

test("a retryable batch can fail repeatedly without changing its frozen identity", async () => {
  const gates = [createDeferred(), createDeferred(), createDeferred()]
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      const gate = gates[batches.length]
      batches.push(batch)
      return gate.promise
    },
  })
  const commitPromise = coordinator.commitNow({
    key: "structure:first",
    payload: null,
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()
  const blockedBatch = batches[0]
  const firstFailure = mutationFailure("mutation-read-failed", {
    operationId: blockedBatch.id,
    phase: "read-source",
    commitState: "unchanged",
  })
  gates[0].reject(firstFailure)
  await assert.rejects(commitPromise, reason => reason === firstFailure)
  await settleMicrotasks()

  const firstRetry = coordinator.retry()
  assert.equal(coordinator.retry(), firstRetry)
  await settleMicrotasks()
  assert.equal(batches[1], blockedBatch)
  const secondFailure = mutationFailure("mutation-write-failed", {
    operationId: blockedBatch.id,
    phase: "write",
    commitState: "unchanged",
  })
  gates[1].reject(secondFailure)
  await assert.rejects(firstRetry, reason => reason === secondFailure)
  assert.equal(coordinator.snapshot().state, "error-retryable")
  assert.equal(coordinator.snapshot().error, secondFailure)
  assert.equal(coordinator.snapshot().activeBatchId, blockedBatch.id)

  const secondRetry = coordinator.retry()
  assert.notEqual(secondRetry, firstRetry)
  await settleMicrotasks()
  assert.equal(batches[2], blockedBatch)
  const result = verifiedResult(blockedBatch, "-eventual")
  gates[2].resolve(result)
  assert.equal(await secondRetry, result)
  assert.equal(coordinator.snapshot().state, "clean")
})

test("a field correction replaces only its blocked operation and preserves later same-key input", async () => {
  const gates = [createDeferred(), createDeferred(), createDeferred()]
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      const gate = gates[batches.length]
      batches.push(batch)
      return gate.promise
    },
  })
  const blockedTitle = coordinator.stage({
    key: "field:title",
    payload: "invalid title",
    apply() {},
  })
  const untouchedSummary = coordinator.stage({
    key: "field:summary",
    payload: "summary",
    apply() {},
  })
  const blockedStructuralPromise = coordinator.commitNow({
    key: "structure:chapter",
    payload: "chapter",
    consumes: ["field:title"],
    apply() {},
  })
  await settleMicrotasks()
  const originalBatch = batches[0]
  const untouchedStructural = originalBatch.operations.at(-1)
  const laterTitle = coordinator.stage({
    key: "field:title",
    payload: "later title",
    apply() {},
  })
  const invalidFailure = mutationFailure("mutation-invalid", {
    operationId: originalBatch.id,
    phase: "apply",
    commitState: "unchanged",
  })
  gates[0].reject(invalidFailure)
  await assert.rejects(blockedStructuralPromise, reason => reason === invalidFailure)
  await settleMicrotasks()
  const generationBeforeCorrection = coordinator.snapshot().generation

  const replacement = coordinator.stage({
    key: blockedTitle.key,
    payload: "corrected title",
    correctsOperationId: blockedTitle.id,
    apply() {},
  })
  assert.notEqual(replacement.id, blockedTitle.id)
  assert.equal(replacement.generation, blockedTitle.generation)
  assert.equal(coordinator.snapshot().generation, generationBeforeCorrection)
  assert.equal(coordinator.snapshot().state, "saving")
  assert.equal(coordinator.snapshot().error, null)
  await settleMicrotasks()

  const correctedBatch = batches[1]
  assert.notEqual(correctedBatch.id, originalBatch.id)
  assert.deepEqual(correctedBatch.operationIds, [
    replacement.id,
    untouchedSummary.id,
    untouchedStructural.id,
  ])
  assert.equal(correctedBatch.operations[0], replacement)
  assert.equal(correctedBatch.operations[1], untouchedSummary)
  assert.equal(correctedBatch.operations[2], untouchedStructural)
  assert.equal(correctedBatch.generations[0], blockedTitle.generation)
  assert.equal(correctedBatch.operations.includes(laterTitle), false)

  const drainPromise = coordinator.drain()
  gates[1].resolve(verifiedResult(correctedBatch, "-corrected"))
  await settleMicrotasks()
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[2].operations, [laterTitle])
  gates[2].resolve(verifiedResult(batches[2], "-later"))
  assert.equal((await drainPromise).state, "clean")
})

test("structural correction requires the exact blocked ID, key, and method kind", async () => {
  const gates = [createDeferred(), createDeferred()]
  const batches = []
  const { coordinator, idCalls } = createHarness({
    commitMutation(batch) {
      const gate = gates[batches.length]
      batches.push(batch)
      return gate.promise
    },
  })
  const blockedField = coordinator.stage({
    key: "field:title",
    payload: "title",
    apply() {},
  })
  const failedCommit = coordinator.commitNow({
    key: "structure:chapter",
    payload: "invalid",
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()
  const originalBatch = batches[0]
  const blockedStructural = originalBatch.operations.at(-1)
  const invalidFailure = mutationFailure("mutation-invalid", {
    operationId: originalBatch.id,
    phase: "validate-candidate",
    commitState: "unchanged",
  })
  gates[0].reject(invalidFailure)
  await assert.rejects(failedCommit, reason => reason === invalidFailure)
  await settleMicrotasks()
  const beforeIds = idCalls.length
  const beforeGeneration = coordinator.snapshot().generation
  let unavailableFailure

  assert.throws(
    () => coordinator.stage({
      key: blockedStructural.key,
      payload: null,
      correctsOperationId: blockedStructural.id,
      apply() {},
    }),
    reason => {
      unavailableFailure = reason
      return reason.code === "save-action-unavailable"
    },
  )
  assert.throws(
    () => coordinator.commitNow({
      key: blockedField.key,
      payload: null,
      consumes: [],
      correctsOperationId: blockedField.id,
      apply() {},
    }),
    reason => reason === unavailableFailure,
  )
  for (const [operationId, key] of [
    [blockedStructural.id, "structure:wrong"],
    ["missing-operation", blockedStructural.key],
  ]) {
    assert.throws(
      () => coordinator.commitNow({
        key,
        payload: null,
        consumes: [],
        correctsOperationId: operationId,
        apply() {},
      }),
      reason => reason === unavailableFailure,
    )
  }
  assert.equal(idCalls.length, beforeIds)
  assert.equal(coordinator.snapshot().generation, beforeGeneration)

  const correctedCommit = coordinator.commitNow({
    key: blockedStructural.key,
    payload: "corrected",
    consumes: blockedStructural.consumes,
    correctsOperationId: blockedStructural.id,
    apply() {},
  })
  await settleMicrotasks()
  const correctedBatch = batches[1]
  const replacement = correctedBatch.operations.at(-1)
  assert.notEqual(correctedBatch.id, originalBatch.id)
  assert.notEqual(replacement.id, blockedStructural.id)
  assert.equal(replacement.generation, blockedStructural.generation)
  assert.equal(correctedBatch.operations[0], blockedField)
  assert.equal(coordinator.snapshot().generation, beforeGeneration)

  const result = verifiedResult(correctedBatch, "-structural-correction")
  gates[1].resolve(result)
  assert.equal(await correctedCommit, result)
  assert.equal(coordinator.snapshot().state, "clean")
})

test("correction ID callbacks cannot publish a replacement after re-entering dispose", async t => {
  for (const triggerKind of ["field", "batch"]) {
    await t.test(triggerKind, async () => {
      const attempt = createDeferred()
      const batches = []
      let coordinator
      let correctionAllocation = false
      let disposePromise = null
      let sequence = 0
      ;({ coordinator } = createHarness({
        commitMutation(batch) {
          batches.push(batch)
          return attempt.promise
        },
        createOperationId(kind) {
          sequence += 1
          if (correctionAllocation && kind === triggerKind && disposePromise === null) {
            disposePromise = coordinator.dispose()
          }
          return `${kind}-${sequence}`
        },
      }))
      const blockedField = coordinator.stage({
        key: "field:title",
        payload: "invalid",
        apply() {},
      })
      const boundary = coordinator.flush()
      await settleMicrotasks()
      const originalBatch = batches[0]
      const failure = mutationFailure("mutation-invalid", {
        operationId: originalBatch.id,
        phase: "apply",
        commitState: "unchanged",
      })
      attempt.reject(failure)
      await assert.rejects(boundary, reason => reason === failure)
      await settleMicrotasks()
      const originalGeneration = coordinator.snapshot().generation
      correctionAllocation = true

      assert.throws(
        () => coordinator.stage({
          key: blockedField.key,
          payload: "corrected",
          correctsOperationId: blockedField.id,
          apply() {},
        }),
        reason => reason.code === "save-disposed",
      )
      assert.notEqual(disposePromise, null)
      assert.equal(coordinator.snapshot().state, "disposed")
      assert.equal(coordinator.snapshot().generation, originalGeneration)
      assert.equal(coordinator.snapshot().activeBatchId, originalBatch.id)
      assert.equal(coordinator.snapshot().pendingCount, originalBatch.operations.length)
      assert.equal(batches.length, 1)
      await disposePromise
    })
  }
})

test("a trusted unknown failure becomes one frozen callback-free envelope and pauses admission", async () => {
  const attempt = createDeferred()
  const laterAttempt = createDeferred()
  const recheckGate = createDeferred()
  const preparedGate = createDeferred()
  const committedBatches = []
  const recheckedEnvelopes = []
  const preparedEnvelopes = []
  const { coordinator, idCalls } = createHarness({
    commitMutation(batch) {
      committedBatches.push(batch)
      return committedBatches.length === 1 ? attempt.promise : laterAttempt.promise
    },
    commitPreparedCandidate(envelope) {
      preparedEnvelopes.push(envelope)
      return preparedGate.promise
    },
    recheckUnknown(envelope) {
      recheckedEnvelopes.push(envelope)
      return recheckGate.promise
    },
  })

  const failedCommit = coordinator.commitNow({
    key: "structure:first",
    payload: "first",
    consumes: [],
    apply() {},
  })
  await settleMicrotasks()
  const mutationBatch = committedBatches[0]
  const laterOperation = coordinator.stage({
    key: "field:later",
    payload: "later",
    apply() {},
  })
  const unknownFailure = mutationFailure("mutation-readback-failed", {
    operationId: mutationBatch.id,
    phase: "readback",
    commitState: "unknown",
    expectedCurrentRaw: null,
    candidateRaw: '{"works":[{"id":"saved-or-not"}]}',
  })
  attempt.reject(unknownFailure)
  await assert.rejects(failedCommit, reason => reason === unknownFailure)
  await settleMicrotasks()

  assert.equal(coordinator.snapshot().state, "error-unknown")
  assert.equal(coordinator.snapshot().error, unknownFailure)
  assert.equal(coordinator.snapshot().canRetry, false)
  assert.equal(coordinator.snapshot().canRecheck, true)
  assert.equal(coordinator.snapshot().activeBatchId, mutationBatch.id)
  assert.equal(coordinator.snapshot().pendingCount, mutationBatch.operations.length + 1)

  const beforeDeniedIds = idCalls.length
  const beforeDeniedGeneration = coordinator.snapshot().generation
  assert.throws(
    () => coordinator.stage({ key: "field:denied", payload: null, apply() {} }),
    reason => reason.code === "save-action-unavailable",
  )
  assert.equal(idCalls.length, beforeDeniedIds)
  assert.equal(coordinator.snapshot().generation, beforeDeniedGeneration)

  const recheckPromise = coordinator.recheck()
  assert.equal(coordinator.recheck(), recheckPromise)
  await assert.rejects(coordinator.retry(), reason => reason.code === "save-action-unavailable")
  await settleMicrotasks()
  assert.equal(recheckedEnvelopes.length, 1)
  const envelope = recheckedEnvelopes[0]
  assert.deepEqual(envelope, {
    kind: "unknown",
    id: mutationBatch.id,
    operationIds: mutationBatch.operationIds,
    generations: mutationBatch.generations,
    expectedCurrentRaw: null,
    candidateRaw: '{"works":[{"id":"saved-or-not"}]}',
  })
  assert.equal(Object.isFrozen(envelope), true)
  assert.equal(Object.isFrozen(envelope.operationIds), true)
  assert.equal(Object.isFrozen(envelope.generations), true)
  assert.equal("operations" in envelope, false)
  assert.equal("apply" in envelope, false)
  assert.equal(envelope.operationIds.includes(laterOperation.id), false)

  const notWritten = Object.freeze({ outcome: "not-written" })
  recheckGate.resolve(notWritten)
  assert.equal(await recheckPromise, notWritten)
  assert.equal(coordinator.snapshot().state, "error-retryable")
  assert.equal(coordinator.snapshot().error, unknownFailure)
  assert.equal(coordinator.snapshot().canRetry, true)
  assert.equal(coordinator.snapshot().canRecheck, false)

  const retryPromise = coordinator.retry()
  assert.equal(coordinator.retry(), retryPromise)
  await assert.rejects(coordinator.recheck(), reason => reason.code === "save-action-unavailable")
  await settleMicrotasks()
  assert.deepEqual(preparedEnvelopes, [envelope])
  assert.equal(committedBatches.length, 1)

  const preparedResult = verifiedResult(envelope, "-prepared")
  preparedGate.resolve(preparedResult)
  assert.equal(await retryPromise, preparedResult)
  await settleMicrotasks()
  assert.equal(committedBatches.length, 2)
  assert.deepEqual(committedBatches[1].operations, [laterOperation])
  const drainPromise = coordinator.drain()
  laterAttempt.resolve(verifiedResult(committedBatches[1], "-later"))
  assert.equal((await drainPromise).state, "clean")
})

test("only recognized own-data unknown metadata creates an uncertain envelope", async t => {
  const trustedRaw = {
    expectedCurrentRaw: '{"works":[]}',
    candidateRaw: '{"works":[{"id":"candidate"}]}',
  }

  for (const code of ["mutation-readback-failed", "mutation-verification-failed"]) {
    await t.test(`accepts ${code}`, async () => {
      const attempt = createDeferred()
      const recheckGate = createDeferred()
      const batches = []
      const envelopes = []
      const { coordinator } = createHarness({
        commitMutation(batch) {
          batches.push(batch)
          return attempt.promise
        },
        recheckUnknown(envelope) {
          envelopes.push(envelope)
          return recheckGate.promise
        },
      })
      coordinator.stage({ key: "field:title", payload: code, apply() {} })
      const boundary = coordinator.flush()
      await settleMicrotasks()
      const batch = batches[0]
      const failure = mutationFailure(code, {
        operationId: batch.id,
        phase: code === "mutation-readback-failed" ? "readback" : "verify",
        commitState: "unknown",
        ...trustedRaw,
      })
      attempt.reject(failure)
      await assert.rejects(boundary, reason => reason === failure)
      assert.equal(coordinator.snapshot().state, "error-unknown")
      const recheckPromise = coordinator.recheck()
      await settleMicrotasks()
      assert.equal(envelopes[0].expectedCurrentRaw, trustedRaw.expectedCurrentRaw)
      assert.equal(envelopes[0].candidateRaw, trustedRaw.candidateRaw)
      const notWritten = Object.freeze({ outcome: "not-written" })
      recheckGate.resolve(notWritten)
      assert.equal(await recheckPromise, notWritten)
      await coordinator.dispose()
    })
  }

  const cases = [
    {
      name: "wrong batch ID",
      createFailure: batch => mutationFailure("mutation-readback-failed", {
        operationId: `${batch.id}-wrong`,
        phase: "readback",
        commitState: "unknown",
        ...trustedRaw,
      }),
    },
    {
      name: "missing expected raw",
      createFailure: batch => mutationFailure("mutation-readback-failed", {
        operationId: batch.id,
        phase: "readback",
        commitState: "unknown",
        candidateRaw: trustedRaw.candidateRaw,
      }),
    },
    {
      name: "missing candidate raw",
      createFailure: batch => mutationFailure("mutation-verification-failed", {
        operationId: batch.id,
        phase: "verify",
        commitState: "unknown",
        expectedCurrentRaw: trustedRaw.expectedCurrentRaw,
      }),
    },
    {
      name: "invalid raw types",
      createFailure: batch => mutationFailure("mutation-readback-failed", {
        operationId: batch.id,
        phase: "readback",
        commitState: "unknown",
        expectedCurrentRaw: 0,
        candidateRaw: null,
      }),
    },
    {
      name: "top-level lookalikes",
      createFailure: batch => Object.assign(
        mutationFailure("mutation-readback-failed", {
          operationId: batch.id,
          phase: "readback",
          commitState: "unknown",
        }),
        trustedRaw,
      ),
    },
    {
      name: "unrecognized code",
      createFailure: batch => mutationFailure("invented-unknown", {
        operationId: batch.id,
        phase: "readback",
        commitState: "unknown",
        ...trustedRaw,
      }),
    },
  ]

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const attempt = createDeferred()
      const batches = []
      const { coordinator } = createHarness({
        commitMutation(batch) {
          batches.push(batch)
          return attempt.promise
        },
      })
      coordinator.stage({ key: "field:title", payload: entry.name, apply() {} })
      const boundary = coordinator.flush()
      await settleMicrotasks()
      const failure = entry.createFailure(batches[0])
      attempt.reject(failure)
      await assert.rejects(boundary, reason => reason === failure)
      assert.equal(coordinator.snapshot().state, "conflict")
      assert.equal(coordinator.snapshot().error, failure)
    })
  }
})

test("unknown metadata accessors are never invoked and fail closed", async () => {
  let detailsReads = 0
  let rawReads = 0
  const outerFailure = Object.assign(new Error("outer accessor"), {
    code: "mutation-readback-failed",
  })
  Object.defineProperty(outerFailure, "details", {
    get() {
      detailsReads += 1
      return {}
    },
  })

  for (const createFailure of [
    () => outerFailure,
    batch => {
      const details = {
        operationId: batch.id,
        phase: "readback",
        commitState: "unknown",
        expectedCurrentRaw: null,
      }
      Object.defineProperty(details, "candidateRaw", {
        get() {
          rawReads += 1
          return "{}"
        },
      })
      return mutationFailure("mutation-readback-failed", details)
    },
  ]) {
    const attempt = createDeferred()
    const batches = []
    const { coordinator } = createHarness({
      commitMutation(batch) {
        batches.push(batch)
        return attempt.promise
      },
    })
    coordinator.stage({ key: "field:title", payload: null, apply() {} })
    const boundary = coordinator.flush()
    await settleMicrotasks()
    const failure = createFailure(batches[0])
    attempt.reject(failure)
    await assert.rejects(boundary, reason => reason === failure)
    assert.equal(coordinator.snapshot().state, "conflict")
  }
  assert.equal(detailsReads, 0)
  assert.equal(rawReads, 0)
})

test("a saved recheck resolves by identity and resumes only later generations", async () => {
  const attempt = createDeferred()
  const recheckGate = createDeferred()
  const laterGate = createDeferred()
  const batches = []
  const envelopes = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return batches.length === 1 ? attempt.promise : laterGate.promise
    },
    recheckUnknown(envelope) {
      envelopes.push(envelope)
      return recheckGate.promise
    },
  })

  coordinator.stage({ key: "field:uncertain", payload: "uncertain", apply() {} })
  const uncertainBoundary = coordinator.flush()
  await settleMicrotasks()
  const uncertainBatch = batches[0]
  const laterCommit = coordinator.commitNow({
    key: "structure:later",
    payload: "later",
    consumes: [],
    apply() {},
  })
  const failure = mutationFailure("mutation-verification-failed", {
    operationId: uncertainBatch.id,
    phase: "verify",
    commitState: "unknown",
    expectedCurrentRaw: '{"works":[]}',
    candidateRaw: '{"works":[{"id":"candidate"}]}',
  })
  attempt.reject(failure)
  await assert.rejects(uncertainBoundary, reason => reason === failure)
  await settleMicrotasks()

  const recheckPromise = coordinator.recheck()
  assert.equal(coordinator.recheck(), recheckPromise)
  await settleMicrotasks()
  const saved = Object.freeze({
    outcome: "saved",
    result: Object.freeze({
      raw: '{"works":[{"id":"candidate"}]}',
      database: Object.freeze({ works: Object.freeze([{ id: "candidate" }]) }),
      workToken: "saved-token",
    }),
  })
  recheckGate.resolve(saved)
  assert.equal(await recheckPromise, saved)
  await settleMicrotasks()

  assert.equal(envelopes.length, 1)
  assert.equal(batches.length, 2)
  assert.deepEqual(batches[1].operations.map(operation => operation.payload), ["later"])
  let laterSettled = false
  laterCommit.finally(() => { laterSettled = true })
  await settleMicrotasks()
  assert.equal(laterSettled, false)

  const laterResult = verifiedResult(batches[1], "-later-after-saved")
  laterGate.resolve(laterResult)
  assert.equal(await laterCommit, laterResult)
  assert.equal(coordinator.snapshot().state, "clean")
  assert.equal(coordinator.snapshot().pendingCount, 0)
})

test("a conflict recheck resolves its owner but rejects every other waiter with one caused error", async () => {
  const attempt = createDeferred()
  const recheckGate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown() {
      return recheckGate.promise
    },
  })

  coordinator.stage({ key: "field:uncertain", payload: "uncertain", apply() {} })
  const uncertainBoundary = coordinator.flush()
  await settleMicrotasks()
  const uncertainBatch = batches[0]
  const laterCommit = coordinator.commitNow({
    key: "structure:later",
    payload: "later",
    consumes: [],
    apply() {},
  })
  const failure = mutationFailure("mutation-readback-failed", {
    operationId: uncertainBatch.id,
    phase: "readback",
    commitState: "unknown",
    expectedCurrentRaw: null,
    candidateRaw: "{}",
  })
  attempt.reject(failure)
  await assert.rejects(uncertainBoundary, reason => reason === failure)
  await settleMicrotasks()

  const recheckPromise = coordinator.recheck()
  const conflict = Object.freeze({
    outcome: "conflict",
    result: Object.freeze({
      raw: '{"works":[{"id":"other"}]}',
      database: Object.freeze({ works: Object.freeze([{ id: "other" }]) }),
      workToken: "other-token",
    }),
  })
  recheckGate.resolve(conflict)
  assert.equal(await recheckPromise, conflict)
  let terminalFailure
  await assert.rejects(laterCommit, reason => {
    terminalFailure = reason
    return reason.code === "save-action-unavailable" && reason.cause === conflict
  })
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, terminalFailure)
  assert.equal(coordinator.snapshot().pendingCount, 2)
  assert.equal(batches.length, 1)
})

test("a conflict recheck owner still resolves when its terminal observer disposes re-entrantly", async () => {
  const attempt = createDeferred()
  const recheckGate = createDeferred()
  const batches = []
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: () => recheckGate.promise,
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  let disposal = null
  coordinator.subscribe(snapshot => {
    if (snapshot.state === "conflict" && disposal === null) disposal = coordinator.dispose()
  })

  const owner = coordinator.recheck()
  await settleMicrotasks()
  const conflict = Object.freeze({
    outcome: "conflict",
    result: Object.freeze({ raw: "{}", database: Object.freeze({}), workToken: "other" }),
  })
  recheckGate.resolve(conflict)

  assert.equal(await owner, conflict)
  assert.notEqual(disposal, null)
  assert.equal((await disposal).state, "disposed")
})

test("malformed recheck outcomes fail closed without invoking accessors", async t => {
  let accessorReads = 0
  const hostileOutcome = {}
  Object.defineProperty(hostileOutcome, "outcome", {
    get() {
      accessorReads += 1
      return "not-written"
    },
  })
  const malformed = [
    null,
    Object.freeze({ outcome: "invented" }),
    Object.freeze({ outcome: "saved" }),
    Object.freeze({ outcome: "saved", result: Object.freeze({ raw: 1, database: {}, workToken: "x" }) }),
    Object.freeze({ outcome: "saved", result: Object.create({ raw: "{}", database: {}, workToken: "x" }) }),
    Object.freeze({ outcome: "conflict" }),
    hostileOutcome,
  ]

  for (const [index, suppliedOutcome] of malformed.entries()) {
    await t.test(String(index), async () => {
      const attempt = createDeferred()
      const batches = []
      const { coordinator } = createHarness({
        commitMutation(batch) {
          batches.push(batch)
          return attempt.promise
        },
        recheckUnknown: async () => suppliedOutcome,
      })
      await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
      let finalFailure
      await assert.rejects(coordinator.recheck(), reason => {
        finalFailure = reason
        return reason instanceof TypeError
      })
      assert.equal(coordinator.snapshot().state, "conflict")
      assert.equal(coordinator.snapshot().error, finalFailure)
    })
  }
  assert.equal(accessorReads, 0)
})

test("failed rechecks stay unknown and retain exact or falsy causes for another recheck", async t => {
  for (const suppliedFailure of [
    mutationFailure("mutation-invalid", {
      phase: "recheck-validate",
      commitState: "unknown",
    }),
    null,
  ]) {
    await t.test(suppliedFailure === null ? "falsy" : "typed", async () => {
      const attempt = createDeferred()
      const batches = []
      let calls = 0
      const saved = Object.freeze({
        outcome: "saved",
        result: Object.freeze({ raw: "{}", database: Object.freeze({}), workToken: "token" }),
      })
      const { coordinator } = createHarness({
        commitMutation(batch) {
          batches.push(batch)
          return attempt.promise
        },
        recheckUnknown() {
          calls += 1
          if (calls === 1) return Promise.reject(suppliedFailure)
          return Promise.resolve(saved)
        },
      })
      await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })

      let receivedFailure
      await assert.rejects(coordinator.recheck(), reason => {
        receivedFailure = reason
        return suppliedFailure === null
          ? reason.code === "save-action-unavailable" && reason.cause === null
          : reason === suppliedFailure
      })
      assert.equal(coordinator.snapshot().state, "error-unknown")
      assert.equal(coordinator.snapshot().error, receivedFailure)
      assert.equal(coordinator.snapshot().canRecheck, true)
      assert.equal(await coordinator.recheck(), saved)
      assert.equal(coordinator.snapshot().state, "clean")
    })
  }
})

test("an unknown prepared retry never restores mutation callbacks and can return to recheck", async () => {
  const attempt = createDeferred()
  const batches = []
  const preparedEnvelopes = []
  let recheckCalls = 0
  const notWritten = Object.freeze({ outcome: "not-written" })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => {
      recheckCalls += 1
      return notWritten
    },
    commitPreparedCandidate: async envelope => {
      preparedEnvelopes.push(envelope)
      throw mutationFailure("mutation-verification-failed", {
        operationId: envelope.id,
        phase: "verify",
        commitState: "unknown",
        expectedCurrentRaw: envelope.expectedCurrentRaw,
        candidateRaw: envelope.candidateRaw,
      })
    },
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  assert.equal(await coordinator.recheck(), notWritten)

  let retryFailure
  await assert.rejects(coordinator.retry(), reason => {
    retryFailure = reason
    return reason.code === "mutation-verification-failed"
  })
  assert.equal(coordinator.snapshot().state, "error-unknown")
  assert.equal(coordinator.snapshot().error, retryFailure)
  assert.equal(coordinator.snapshot().canRecheck, true)
  assert.equal(batches.length, 1)
  assert.equal(preparedEnvelopes.length, 1)
  assert.equal("operations" in preparedEnvelopes[0], false)
  assert.equal("apply" in preparedEnvelopes[0], false)
  assert.equal(await coordinator.recheck(), notWritten)
  assert.equal(recheckCalls, 2)
})

test("a prepared conflict keeps callback-free unknown provenance and disposes cleanly", async () => {
  const attempt = createDeferred()
  const batches = []
  const preparedEnvelopes = []
  const notWritten = Object.freeze({ outcome: "not-written" })
  const conflict = mutationFailure("mutation-conflict", {
    operationId: "foreign-batch",
    commitState: "changed",
  })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => notWritten,
    commitPreparedCandidate(envelope) {
      preparedEnvelopes.push(envelope)
      return Promise.reject(conflict)
    },
  })
  const { batch } = await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  assert.equal(await coordinator.recheck(), notWritten)

  await assert.rejects(coordinator.retry(), reason => reason === conflict)
  assert.equal(preparedEnvelopes.length, 1)
  assert.equal(preparedEnvelopes[0].id, batch.id)
  assert.equal("operations" in preparedEnvelopes[0], false)
  assert.equal("apply" in preparedEnvelopes[0], false)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(coordinator.snapshot().error, conflict)
  assert.equal(coordinator.snapshot().activeBatchId, batch.id)
  assert.equal(coordinator.snapshot().pendingCount, batch.operations.length)

  const disposed = await coordinator.dispose()
  assert.equal(disposed.state, "disposed")
  assert.equal(coordinator.snapshot().state, "disposed")
})

test("flush waits for an in-flight prepared retry without replacing saving state", async () => {
  const attempt = createDeferred()
  const preparedGate = createDeferred()
  const batches = []
  const preparedEnvelopes = []
  const notWritten = Object.freeze({ outcome: "not-written" })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => notWritten,
    commitPreparedCandidate(envelope) {
      preparedEnvelopes.push(envelope)
      return preparedGate.promise
    },
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  assert.equal(await coordinator.recheck(), notWritten)

  const retryPromise = coordinator.retry()
  await settleMicrotasks()
  assert.equal(preparedEnvelopes.length, 1)
  assert.equal(coordinator.snapshot().state, "saving")

  const flushPromise = coordinator.flush()
  let flushSettled = false
  flushPromise.then(
    () => { flushSettled = true },
    () => { flushSettled = true },
  )
  await settleMicrotasks()
  assert.equal(flushSettled, false)
  assert.equal(coordinator.snapshot().state, "saving")

  const result = verifiedResult(preparedEnvelopes[0], "-prepared-flush")
  preparedGate.resolve(result)
  assert.equal(await retryPromise, result)
  assert.equal(await flushPromise, result)
  assert.equal(coordinator.snapshot().state, "clean")
})

test("trusted unknown metadata needs no phase and later mutation cannot alter its copied raw envelope", async () => {
  const attempt = createDeferred()
  const batches = []
  const envelopes = []
  const details = {
    operationId: null,
    commitState: "unknown",
    expectedCurrentRaw: '{"before":true}',
    candidateRaw: '{"candidate":true}',
  }
  const notWritten = Object.freeze({ outcome: "not-written" })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown(envelope) {
      envelopes.push(envelope)
      return Promise.resolve(notWritten)
    },
  })
  coordinator.stage({ key: "field:title", payload: "draft", apply() {} })
  const boundary = coordinator.flush()
  await settleMicrotasks()
  details.operationId = batches[0].id
  const failure = mutationFailure("mutation-readback-failed", details)
  attempt.reject(failure)
  await assert.rejects(boundary, reason => reason === failure)
  await settleMicrotasks()

  details.expectedCurrentRaw = '{"mutated":"before"}'
  details.candidateRaw = '{"mutated":"candidate"}'
  assert.equal(await coordinator.recheck(), notWritten)
  assert.equal(envelopes[0].expectedCurrentRaw, '{"before":true}')
  assert.equal(envelopes[0].candidateRaw, '{"candidate":true}')
})

test("an unchanged prepared failure retries only the same uncertain envelope", async () => {
  const attempt = createDeferred()
  const batches = []
  const preparedEnvelopes = []
  const notWritten = Object.freeze({ outcome: "not-written" })
  let preparedCalls = 0
  let eventualPreparedResult = null
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => notWritten,
    commitPreparedCandidate: async envelope => {
      preparedCalls += 1
      preparedEnvelopes.push(envelope)
      if (preparedCalls === 1) {
        throw mutationFailure("mutation-write-failed", {
          operationId: envelope.id,
          phase: "write",
          commitState: "unchanged",
          expectedCurrentRaw: envelope.expectedCurrentRaw,
          candidateRaw: envelope.candidateRaw,
        })
      }
      eventualPreparedResult = verifiedResult(envelope, "-prepared-retry")
      return eventualPreparedResult
    },
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  assert.equal(await coordinator.recheck(), notWritten)

  let unchangedFailure
  await assert.rejects(coordinator.retry(), reason => {
    unchangedFailure = reason
    return reason.code === "mutation-write-failed"
  })
  assert.equal(coordinator.snapshot().state, "error-retryable")
  assert.equal(coordinator.snapshot().error, unchangedFailure)
  const secondRetry = coordinator.retry()
  assert.equal(coordinator.retry(), secondRetry)
  assert.equal(await secondRetry, eventualPreparedResult)
  assert.equal(preparedEnvelopes.length, 2)
  assert.equal(preparedEnvelopes[1], preparedEnvelopes[0])
  assert.equal("operations" in preparedEnvelopes[1], false)
  assert.equal(batches.length, 1)
})

test("nested recheck result accessors fail closed without being invoked", async () => {
  const attempt = createDeferred()
  const batches = []
  let databaseReads = 0
  let tokenReads = 0
  const result = { raw: "{}" }
  Object.defineProperty(result, "database", {
    get() {
      databaseReads += 1
      return {}
    },
  })
  Object.defineProperty(result, "workToken", {
    get() {
      tokenReads += 1
      return "token"
    },
  })
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    recheckUnknown: async () => ({ outcome: "saved", result }),
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  await assert.rejects(coordinator.recheck(), TypeError)
  assert.equal(coordinator.snapshot().state, "conflict")
  assert.equal(databaseReads, 0)
  assert.equal(tokenReads, 0)
})

test("a failure after not-written and a repeated unknown prepared write retain recheck safety", async () => {
  const attempt = createDeferred()
  const batches = []
  const recheckedEnvelopes = []
  const notWritten = Object.freeze({ outcome: "not-written" })
  const laterRecheckFailure = new Error("later recheck failed")
  let recheckCalls = 0
  const { coordinator } = createHarness({
    commitMutation(batch) {
      batches.push(batch)
      return attempt.promise
    },
    commitPreparedCandidate: async envelope => {
      throw mutationFailure("mutation-readback-failed", {
        operationId: envelope.id,
        commitState: "unknown",
        expectedCurrentRaw: envelope.expectedCurrentRaw,
        candidateRaw: envelope.candidateRaw,
      })
    },
    recheckUnknown(envelope) {
      recheckedEnvelopes.push(envelope)
      recheckCalls += 1
      if (recheckCalls === 1) return Promise.resolve(notWritten)
      return Promise.reject(laterRecheckFailure)
    },
  })
  await pauseCoordinatorAsUnknown({ coordinator, attempt, batches })
  assert.equal(await coordinator.recheck(), notWritten)
  await assert.rejects(coordinator.retry(), reason => reason.code === "mutation-readback-failed")
  assert.equal(coordinator.snapshot().state, "error-unknown")
  await assert.rejects(coordinator.recheck(), reason => reason === laterRecheckFailure)
  assert.equal(coordinator.snapshot().state, "error-unknown")
  assert.equal(coordinator.snapshot().error, laterRecheckFailure)
  assert.equal(recheckedEnvelopes.length, 2)
  assert.equal("operations" in recheckedEnvelopes[1], false)
})
