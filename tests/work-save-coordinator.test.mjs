import test from "node:test"
import assert from "node:assert/strict"

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
  assert.deepEqual(Object.keys(coordinator), [
    "stage",
    "commitNow",
    "flush",
    "drain",
    "snapshot",
    "subscribe",
    "dispose",
  ])
  assert.deepEqual(announcements, [coordinator.snapshot()])
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
