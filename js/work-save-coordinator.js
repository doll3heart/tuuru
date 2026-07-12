const EMPTY_EDITORS = Object.freeze([])
const MAX_JSON_ARRAY_INDEX = (2 ** 32) - 2

function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`)
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function cloneJsonPrimitive(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { matched: true, value }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { matched: true, value }
  }
  return { matched: false }
}

function assertNoJsonHook(value, prototype, isArray) {
  if (Object.getPrototypeOf(value) !== prototype) {
    throw new TypeError("JSON payload prototypes must remain stable during inspection")
  }
  if (isArray && Object.getPrototypeOf(Array.prototype) !== Object.prototype) {
    throw new TypeError("JSON Array.prototype must inherit directly from Object.prototype")
  }
  if (prototype !== null && Object.getPrototypeOf(Object.prototype) !== null) {
    throw new TypeError("JSON Object.prototype must terminate at null")
  }
  const visited = new WeakSet()
  const permittedChain = isArray
    ? [value, Array.prototype, Object.prototype]
    : prototype === null ? [value] : [value, Object.prototype]
  for (const current of permittedChain) {
    if (visited.has(current)) {
      throw new TypeError("JSON payload prototype chains must not contain cycles")
    }
    visited.add(current)
    if (Object.getOwnPropertyDescriptor(current, "toJSON") !== undefined) {
      throw new TypeError("JSON payloads must not define or inherit toJSON")
    }
  }
}

function isCanonicalArrayIndex(key) {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false
  const number = Number(key)
  return Number.isSafeInteger(number)
    && number >= 0
    && number <= MAX_JSON_ARRAY_INDEX
    && String(number) === key
}

function inspectJsonContainer(source) {
  const prototype = Object.getPrototypeOf(source)
  const isArray = Array.isArray(source)

  if (isArray) {
    if (prototype !== Array.prototype) {
      throw new TypeError("JSON arrays must use the ordinary Array prototype")
    }
  } else if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("JSON objects must use an ordinary or null prototype")
  }

  assertNoJsonHook(source, prototype, isArray)
  const descriptors = Object.getOwnPropertyDescriptors(source)
  const keys = Reflect.ownKeys(source)

  if (isArray) {
    const lengthDescriptor = descriptors.length
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) {
      throw new TypeError("JSON arrays must have an ordinary length")
    }
    const length = lengthDescriptor.value
    const entries = []
    for (const key of keys) {
      if (key === "length") continue
      if (typeof key !== "string" || !isCanonicalArrayIndex(key)) {
        throw new TypeError("JSON arrays must not contain named or symbol properties")
      }
      const descriptor = descriptors[key]
      if (!("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("JSON array entries must be enumerable data properties")
      }
      entries.push([key, descriptor.value])
    }
    if (entries.length !== length) throw new TypeError("JSON arrays must not be sparse")
    entries.sort((left, right) => Number(left[0]) - Number(right[0]))
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index][0] !== String(index)) {
        throw new TypeError("JSON arrays must not be sparse")
      }
    }
    return { target: new Array(length), entries }
  }

  const entries = []
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new TypeError("JSON objects must not contain symbol properties")
    }
    const descriptor = descriptors[key]
    if (!("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError("JSON object fields must be enumerable data properties")
    }
    entries.push([key, descriptor.value])
  }
  return {
    target: prototype === null ? Object.create(null) : {},
    entries,
  }
}

function defineJsonValue(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}

function cloneAndFreezeJson(value) {
  const primitive = cloneJsonPrimitive(value)
  if (primitive.matched) return primitive.value
  if (value === null || typeof value !== "object") {
    throw new TypeError("payload must be an ordinary JSON value")
  }

  const root = inspectJsonContainer(value)
  const states = new WeakMap([[value, "visiting"]])
  const clones = new WeakMap([[value, root.target]])
  const stack = [{ source: value, target: root.target, entries: root.entries, index: 0 }]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index >= frame.entries.length) {
      Object.freeze(frame.target)
      states.set(frame.source, "complete")
      stack.pop()
      continue
    }

    const [key, child] = frame.entries[frame.index]
    frame.index += 1
    const childPrimitive = cloneJsonPrimitive(child)
    if (childPrimitive.matched) {
      defineJsonValue(frame.target, key, childPrimitive.value)
      continue
    }
    if (child === null || typeof child !== "object") {
      throw new TypeError("payload must contain only ordinary JSON values")
    }

    const state = states.get(child)
    if (state === "visiting") throw new TypeError("payload must not contain cycles")
    if (state === "complete") {
      defineJsonValue(frame.target, key, clones.get(child))
      continue
    }

    const inspected = inspectJsonContainer(child)
    defineJsonValue(frame.target, key, inspected.target)
    states.set(child, "visiting")
    clones.set(child, inspected.target)
    stack.push({
      source: child,
      target: inspected.target,
      entries: inspected.entries,
      index: 0,
    })
  }

  return root.target
}

function validateConsumes(value) {
  const cloned = cloneAndFreezeJson(value)
  if (!Array.isArray(cloned)) throw new TypeError("consumes must be an array")
  const seen = new Set()
  for (const key of cloned) {
    assertNonEmptyString(key, "each consumes key")
    if (seen.has(key)) throw new TypeError("consumes keys must be unique")
    seen.add(key)
  }
  return cloned
}

function snapshotsEqual(left, right) {
  if (left === null || right === null) return false
  return left.state === right.state
    && left.pendingCount === right.pendingCount
    && left.activeBatchId === right.activeBatchId
    && left.lastSavedAt === right.lastSavedAt
    && left.error === right.error
    && left.canRetry === right.canRetry
    && left.canRecheck === right.canRecheck
    && left.hasRecoverableCandidate === right.hasRecoverableCandidate
    && left.generation === right.generation
    && left.otherActiveEditors === right.otherActiveEditors
    && left.availability === right.availability
}

export function createWorkSaveCoordinator(options) {
  assertRecord(options, "options")
  assertFunction(options.commitMutation, "commitMutation")
  const scheduler = options.scheduler ?? {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  }
  assertRecord(scheduler, "scheduler")
  assertFunction(scheduler.setTimeout, "scheduler.setTimeout")
  assertFunction(scheduler.clearTimeout, "scheduler.clearTimeout")
  const now = options.now ?? Date.now
  assertFunction(now, "now")
  const debounceMs = options.debounceMs ?? 600
  const maxWaitMs = options.maxWaitMs ?? 3000
  if (!Number.isSafeInteger(debounceMs) || debounceMs < 0) {
    throw new TypeError("debounceMs must be a non-negative safe integer")
  }
  if (!Number.isSafeInteger(maxWaitMs) || maxWaitMs < debounceMs) {
    throw new TypeError("maxWaitMs must be a safe integer at least debounceMs")
  }
  if (options.onSnapshot !== undefined) assertFunction(options.onSnapshot, "onSnapshot")

  let defaultIdSequence = 0
  const createOperationId = options.createOperationId ?? (kind => {
    defaultIdSequence += 1
    return `${kind}-${defaultIdSequence}`
  })
  assertFunction(createOperationId, "createOperationId")

  const listeners = new Set()
  const announcementQueue = []
  const usedIds = new Set()
  const pendingFields = new Map()
  const readyBatches = []
  const generationWaiters = new Set()
  const flushWaiters = new Map()
  let generation = 0
  let verifiedGeneration = 0
  let terminalEpoch = 0
  let state = "clean"
  let lastSavedAt = null
  let lastCommitResult = null
  let error = null
  let currentSnapshot = null
  let activeBatch = null
  let blockedBatch = null
  let activeAction = null
  let disposePromise = null
  let drainPromise = null
  let emptyFlushGeneration = null
  let emptyFlushPromise = null
  let disposedFailure = null
  let synchronousAdmission = false
  let announcingSnapshots = false
  let clearListenersAfterAnnouncements = false
  let quietTimerHandle = null
  let maxTimerHandle = null
  let quietTimerActive = false
  let maxTimerActive = false
  let quietTimerToken = 0
  let maxTimerToken = 0

  function isTerminalState() {
    return state === "conflict" || state === "disposed"
  }

  function createActionUnavailableError() {
    const unavailable = new Error("The save coordinator cannot start another action")
    unavailable.code = "save-action-unavailable"
    return unavailable
  }

  function terminalAdmissionFailure() {
    if (disposedFailure !== null && (state === "disposed" || error === disposedFailure)) {
      return disposedFailure
    }
    return createActionUnavailableError()
  }

  function beginSynchronousAdmission() {
    assertAvailable()
    if (terminalEpoch !== 0) throw terminalAdmissionFailure()
    if (synchronousAdmission) throw createActionUnavailableError()
    synchronousAdmission = true
    return terminalEpoch
  }

  function endSynchronousAdmission() {
    synchronousAdmission = false
  }

  function assertAdmissionCurrent(admissionEpoch) {
    if (admissionEpoch !== terminalEpoch || terminalEpoch !== 0 || isTerminalState()) {
      throw terminalAdmissionFailure()
    }
  }

  function pendingCount() {
    let count = pendingFields.size
    if (activeBatch !== null) count += activeBatch.operations.length
    if (blockedBatch !== null) count += blockedBatch.operations.length
    for (const batch of readyBatches) count += batch.operations.length
    return count
  }

  function createSnapshot() {
    const count = pendingCount()
    return Object.freeze({
      state,
      pendingCount: count,
      activeBatchId: activeBatch?.id ?? blockedBatch?.id ?? null,
      lastSavedAt,
      error,
      canRetry: false,
      canRecheck: false,
      hasRecoverableCandidate: count > 0,
      generation,
      otherActiveEditors: EMPTY_EDITORS,
      availability: null,
    })
  }

  function announceSnapshot() {
    const nextSnapshot = createSnapshot()
    if (snapshotsEqual(currentSnapshot, nextSnapshot)) return currentSnapshot
    currentSnapshot = nextSnapshot
    announcementQueue.push(nextSnapshot)
    if (announcingSnapshots) return currentSnapshot

    announcingSnapshots = true
    try {
      while (announcementQueue.length > 0) {
        const publishedSnapshot = announcementQueue.shift()
        for (const listener of [...listeners]) {
          try {
            listener(publishedSnapshot)
          } catch {
            // Observer failures cannot change coordinator state.
          }
        }
      }
    } finally {
      announcingSnapshots = false
      if (clearListenersAfterAnnouncements) listeners.clear()
    }
    return currentSnapshot
  }

  function createIdCandidate(kind, reservedIds = [], admissionEpoch = null) {
    const id = createOperationId(kind)
    if (admissionEpoch !== null) assertAdmissionCurrent(admissionEpoch)
    assertNonEmptyString(id, `${kind} operation ID`)
    if (usedIds.has(id) || reservedIds.includes(id)) {
      throw new TypeError(`operation ID "${id}" must be unique`)
    }
    return id
  }

  function allocateId(kind, admissionEpoch = null) {
    const id = createIdCandidate(kind, [], admissionEpoch)
    usedIds.add(id)
    return id
  }

  function assertAvailable() {
    if (state === "disposed") {
      if (disposedFailure === null) {
        disposedFailure = new Error("The save coordinator has been disposed")
        disposedFailure.code = "save-disposed"
      }
      throw disposedFailure
    }
    if (state === "conflict") {
      throw createActionUnavailableError()
    }
  }

  function prepareOperation(kind, input, admissionEpoch) {
    assertAdmissionCurrent(admissionEpoch)
    assertRecord(input, "operation input")
    const key = input.key
    assertNonEmptyString(key, "operation key")
    const apply = input.apply
    assertFunction(apply, "operation apply")
    const suppliedPayload = input.payload
    const payload = cloneAndFreezeJson(suppliedPayload)
    const suppliedConsumes = kind === "structural" ? input.consumes : undefined
    const consumes = kind === "structural"
      ? validateConsumes(suppliedConsumes ?? [])
      : Object.freeze([])
    assertAdmissionCurrent(admissionEpoch)
    return {
      key,
      payload,
      consumes,
      apply,
    }
  }

  function freezeOperation(kind, prepared, id, operationGeneration) {
    return Object.freeze({
      id,
      key: prepared.key,
      kind,
      generation: operationGeneration,
      payload: prepared.payload,
      consumes: prepared.consumes,
      apply: prepared.apply,
    })
  }

  function createOperation(kind, input, admissionEpoch) {
    const prepared = prepareOperation(kind, input, admissionEpoch)
    if (generation >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError("operation generation limit reached")
    }
    const id = allocateId(kind, admissionEpoch)
    assertAdmissionCurrent(admissionEpoch)
    generation += 1
    return freezeOperation(kind, prepared, id, generation)
  }

  function stage(input) {
    const admissionEpoch = beginSynchronousAdmission()
    let operation
    try {
      operation = createOperation("field", input, admissionEpoch)
      pendingFields.set(operation.key, operation)
      if (activeBatch === null) state = "dirty"
      try {
        schedulePendingTimers()
      } catch (failure) {
        throw enterConflict(failure)
      }
      assertAdmissionCurrent(admissionEpoch)
    } finally {
      endSynchronousAdmission()
    }
    announceSnapshot()
    return operation
  }

  function freezeBatch(operations, suppliedId = null, admissionEpoch = null) {
    const orderedOperations = Object.freeze([...operations])
    return Object.freeze({
      kind: "mutation",
      id: suppliedId ?? allocateId("batch", admissionEpoch),
      operationIds: Object.freeze(orderedOperations.map(operation => operation.id)),
      generations: Object.freeze(orderedOperations.map(operation => operation.generation)),
      operations: orderedOperations,
    })
  }

  function capturePending(admissionEpoch = terminalEpoch) {
    assertAdmissionCurrent(admissionEpoch)
    const fields = [...pendingFields.values()]
      .sort((left, right) => left.generation - right.generation)
    if (fields.length === 0) return null
    const batch = freezeBatch(fields, null, admissionEpoch)
    assertAdmissionCurrent(admissionEpoch)
    for (const operation of fields) {
      if (pendingFields.get(operation.key) === operation) {
        pendingFields.delete(operation.key)
      }
    }
    readyBatches.push(batch)
    const cancellation = cancelPendingTimers()
    if (cancellation.failed) throw cancellation.cause
    assertAdmissionCurrent(admissionEpoch)
    return batch
  }

  function capturePendingWithAdmission() {
    const admissionEpoch = beginSynchronousAdmission()
    try {
      return capturePending(admissionEpoch)
    } finally {
      endSynchronousAdmission()
    }
  }

  function acceptStructuralBatch(prepared, admissionEpoch) {
    assertAdmissionCurrent(admissionEpoch)
    if (generation >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError("operation generation limit reached")
    }
    const structuralId = createIdCandidate("structural", [], admissionEpoch)
    const batchId = createIdCandidate("batch", [structuralId], admissionEpoch)
    assertAdmissionCurrent(admissionEpoch)
    const nextGeneration = generation + 1
    const operation = freezeOperation(
      "structural",
      prepared,
      structuralId,
      nextGeneration,
    )
    const fields = [...pendingFields.values()]
      .sort((left, right) => left.generation - right.generation)
    const batch = freezeBatch([...fields, operation], batchId)

    assertAdmissionCurrent(admissionEpoch)
    usedIds.add(structuralId)
    usedIds.add(batchId)
    generation = nextGeneration
    for (const field of fields) {
      if (pendingFields.get(field.key) === field) pendingFields.delete(field.key)
    }
    readyBatches.push(batch)
    const cancellation = cancelPendingTimers()
    if (cancellation.failed) throw cancellation.cause
    assertAdmissionCurrent(admissionEpoch)
    return operation
  }

  function createGenerationWaiter(targetGeneration) {
    if (targetGeneration <= verifiedGeneration) return Promise.resolve(lastCommitResult)
    let resolve
    let reject
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    generationWaiters.add({ targetGeneration, resolve, reject })
    return promise
  }

  function settleVerifiedWaiters(result) {
    for (const waiter of [...generationWaiters]) {
      if (waiter.targetGeneration > verifiedGeneration) continue
      generationWaiters.delete(waiter)
      waiter.resolve(result)
    }
  }

  function rejectAllWaiters(failure) {
    for (const waiter of [...generationWaiters]) {
      generationWaiters.delete(waiter)
      waiter.reject(failure)
    }
  }

  function normalizeCommitFailure(cause) {
    if (cause instanceof Error) return cause
    const failure = new Error("The local save action failed", { cause })
    failure.code = "save-action-unavailable"
    return failure
  }

  function cancelQuietTimer() {
    quietTimerToken += 1
    const wasActive = quietTimerActive
    const handle = quietTimerHandle
    quietTimerActive = false
    quietTimerHandle = null
    if (wasActive) scheduler.clearTimeout(handle)
  }

  function cancelMaxTimer() {
    maxTimerToken += 1
    const wasActive = maxTimerActive
    const handle = maxTimerHandle
    maxTimerActive = false
    maxTimerHandle = null
    if (wasActive) scheduler.clearTimeout(handle)
  }

  function cancelPendingTimers() {
    let failed = false
    let cause
    try {
      cancelQuietTimer()
    } catch (failure) {
      failed = true
      cause = failure
    }
    try {
      cancelMaxTimer()
    } catch (failure) {
      if (!failed) {
        failed = true
        cause = failure
      }
    }
    return { failed, cause }
  }

  function enterConflict(suppliedFailure, batch = null) {
    const supplied = normalizeCommitFailure(suppliedFailure)
    if (state === "disposed") return disposedFailure ?? supplied
    if (batch !== null && blockedBatch === null) blockedBatch = batch
    if (state !== "conflict") {
      terminalEpoch += 1
      state = "conflict"
      error = supplied
    }
    const failure = error
    cancelPendingTimers()
    rejectAllWaiters(failure)
    announceSnapshot()
    return failure
  }

  function capturePendingFromTimer() {
    if (pendingFields.size === 0 || state === "conflict" || state === "disposed") return
    try {
      capturePendingWithAdmission()
    } catch (failure) {
      enterConflict(failure)
      return
    }
    if (activeBatch === null) state = "dirty"
    announceSnapshot()
    startNextBatch()
  }

  function schedulePendingTimers() {
    cancelQuietTimer()
    const nextQuietToken = quietTimerToken
    let nextQuietHandle = null
    nextQuietHandle = scheduler.setTimeout(() => {
      if (!quietTimerActive
        || quietTimerToken !== nextQuietToken
        || quietTimerHandle !== nextQuietHandle) {
        return
      }
      quietTimerActive = false
      quietTimerHandle = null
      capturePendingFromTimer()
    }, debounceMs)
    quietTimerHandle = nextQuietHandle
    quietTimerActive = true

    if (!maxTimerActive) {
      maxTimerToken += 1
      const nextMaxToken = maxTimerToken
      let nextMaxHandle = null
      nextMaxHandle = scheduler.setTimeout(() => {
        if (!maxTimerActive
          || maxTimerToken !== nextMaxToken
          || maxTimerHandle !== nextMaxHandle) {
          return
        }
        maxTimerActive = false
        maxTimerHandle = null
        capturePendingFromTimer()
      }, maxWaitMs)
      maxTimerHandle = nextMaxHandle
      maxTimerActive = true
    }
  }

  function validateCommitResult(result, batch) {
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      throw new TypeError("commitMutation must return an object")
    }
    if (result.ok !== true || result.operationId !== batch.id) {
      throw new TypeError("commitMutation returned a mismatched result")
    }
    return result
  }

  function recordVerifiedBatch(batch, result) {
    const batchGeneration = batch.generations[batch.generations.length - 1]
    verifiedGeneration = Math.max(verifiedGeneration, batchGeneration)
    lastCommitResult = result
    settleVerifiedWaiters(result)
  }

  function readAttemptTime() {
    const savedAt = now()
    if (!Number.isSafeInteger(savedAt) || savedAt < 0) {
      throw new TypeError("now() must return a non-negative safe integer")
    }
    return savedAt
  }

  function startNextBatch() {
    if (activeAction !== null
      || activeBatch !== null
      || readyBatches.length === 0
      || isTerminalState()) {
      return
    }

    const batch = readyBatches.shift()
    const admissionEpoch = terminalEpoch
    let settleAction
    const action = new Promise(resolve => {
      settleAction = resolve
    })
    activeAction = action
    activeBatch = batch
    state = "saving"
    announceSnapshot()

    function retainUnverifiedBatch() {
      if (activeBatch === batch) activeBatch = null
      if (blockedBatch === null) blockedBatch = batch
      else if (blockedBatch !== batch && !readyBatches.includes(batch)) readyBatches.unshift(batch)
      announceSnapshot()
    }

    function finishAction() {
      if (activeAction === action) activeAction = null
      settleAction()
      if (!isTerminalState()) startNextBatch()
    }

    if (isTerminalState() || terminalEpoch !== admissionEpoch) {
      retainUnverifiedBatch()
      finishAction()
      return
    }

    let attemptedAt
    try {
      attemptedAt = readAttemptTime()
    } catch (failure) {
      if (isTerminalState() || terminalEpoch !== admissionEpoch) {
        retainUnverifiedBatch()
        finishAction()
        return
      }
      activeBatch = null
      enterConflict(failure, batch)
      finishAction()
      return
    }
    if (isTerminalState() || terminalEpoch !== admissionEpoch) {
      retainUnverifiedBatch()
      finishAction()
      return
    }

    const skippedBeforeIo = Symbol("skipped-before-io")
    Promise.resolve()
      .then(() => {
        if (isTerminalState() || terminalEpoch !== admissionEpoch) return skippedBeforeIo
        return options.commitMutation(batch)
      })
      .then(
        suppliedResult => {
          if (suppliedResult === skippedBeforeIo) {
            retainUnverifiedBatch()
            return
          }
          const result = validateCommitResult(suppliedResult, batch)
          recordVerifiedBatch(batch, result)
          lastSavedAt = attemptedAt
          if (activeBatch === batch) activeBatch = null
          if (blockedBatch === batch) blockedBatch = null
          if (isTerminalState() || terminalEpoch !== admissionEpoch) {
            announceSnapshot()
            return
          }
          state = readyBatches.length > 0 || pendingFields.size > 0 ? "dirty" : "clean"
          announceSnapshot()
        },
        suppliedFailure => {
          if (isTerminalState() || terminalEpoch !== admissionEpoch) {
            retainUnverifiedBatch()
            return
          }
          activeBatch = null
          enterConflict(suppliedFailure, batch)
        },
      )
      .catch(suppliedFailure => {
        if (isTerminalState() || terminalEpoch !== admissionEpoch) {
          retainUnverifiedBatch()
          return
        }
        if (activeBatch === batch) activeBatch = null
        enterConflict(suppliedFailure, batch)
      })
      .finally(finishAction)
  }

  function commitNow(input) {
    const admissionEpoch = beginSynchronousAdmission()
    let prepared
    try {
      prepared = prepareOperation("structural", input, admissionEpoch)
    } catch (failure) {
      endSynchronousAdmission()
      throw failure
    }
    let operation
    try {
      operation = acceptStructuralBatch(prepared, admissionEpoch)
    } catch (failure) {
      endSynchronousAdmission()
      if (terminalEpoch !== admissionEpoch || terminalEpoch !== 0 || isTerminalState()) {
        throw terminalAdmissionFailure()
      }
      throw enterConflict(failure)
    }
    endSynchronousAdmission()
    const promise = createGenerationWaiter(operation.generation)
    if (activeBatch === null) state = "dirty"
    announceSnapshot()
    startNextBatch()
    return promise
  }

  function flush() {
    try {
      assertAvailable()
    } catch (failure) {
      return Promise.reject(failure)
    }
    const targetGeneration = generation
    if (pendingFields.size === 0
      && readyBatches.length === 0
      && activeBatch === null
      && blockedBatch === null) {
      if (emptyFlushPromise === null || emptyFlushGeneration !== generation) {
        emptyFlushGeneration = generation
        emptyFlushPromise = Promise.resolve(null)
      }
      return emptyFlushPromise
    }
    const existing = flushWaiters.get(targetGeneration)
    if (existing !== undefined) return existing

    let resolveFlush
    let rejectFlush
    const promise = new Promise((resolve, reject) => {
      resolveFlush = resolve
      rejectFlush = reject
    })
    flushWaiters.set(targetGeneration, promise)
    promise.then(
      () => {
        if (flushWaiters.get(targetGeneration) === promise) {
          flushWaiters.delete(targetGeneration)
        }
      },
      () => {
        if (flushWaiters.get(targetGeneration) === promise) {
          flushWaiters.delete(targetGeneration)
        }
      },
    )

    let admissionEpoch
    let admissionStarted = false
    try {
      admissionEpoch = beginSynchronousAdmission()
      admissionStarted = true
      capturePending(admissionEpoch)
      assertAdmissionCurrent(admissionEpoch)
    } catch (failure) {
      if (admissionStarted) endSynchronousAdmission()
      const finalFailure = admissionStarted
        ? terminalEpoch !== admissionEpoch || terminalEpoch !== 0 || isTerminalState()
          ? terminalAdmissionFailure()
          : enterConflict(failure)
        : failure
      rejectFlush(finalFailure)
      return promise
    }
    endSynchronousAdmission()

    createGenerationWaiter(targetGeneration).then(
      resolveFlush,
      rejectFlush,
    )
    if (activeBatch === null) state = "dirty"
    announceSnapshot()
    startNextBatch()
    return promise
  }

  async function runDrain() {
    while (true) {
      assertAvailable()
      const targetGeneration = generation
      if (pendingFields.size > 0) {
        try {
          capturePendingWithAdmission()
        } catch (failure) {
          throw enterConflict(failure)
        }
        if (activeBatch === null) state = "dirty"
        announceSnapshot()
      }
      startNextBatch()

      if (targetGeneration > verifiedGeneration) {
        await createGenerationWaiter(targetGeneration)
        continue
      }
      if (activeBatch !== null || readyBatches.length > 0 || pendingFields.size > 0) {
        await Promise.resolve()
        continue
      }

      await Promise.resolve()
      assertAvailable()
      if (generation === targetGeneration
        && activeBatch === null
        && readyBatches.length === 0
        && pendingFields.size === 0) {
        return currentSnapshot
      }
    }
  }

  function drain() {
    try {
      assertAvailable()
    } catch (failure) {
      return Promise.reject(failure)
    }
    if (drainPromise !== null) return drainPromise
    const promise = Promise.resolve().then(runDrain)
    drainPromise = promise
    promise.then(
      () => {
        if (drainPromise === promise) drainPromise = null
      },
      () => {
        if (drainPromise === promise) drainPromise = null
      },
    )
    return promise
  }

  function snapshot() {
    return currentSnapshot
  }

  function subscribe(listener) {
    assertFunction(listener, "listener")
    if (state === "disposed") {
      try {
        listener(currentSnapshot)
      } catch {
        // Observer failures cannot change coordinator state.
      }
      return () => {}
    }
    listeners.add(listener)
    try {
      listener(currentSnapshot)
    } catch {
      // Observer failures cannot change coordinator state.
    }
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      listeners.delete(listener)
    }
  }

  function dispose() {
    if (disposePromise !== null) return disposePromise
    const admittedAction = activeAction
    let settleDispose
    disposePromise = new Promise(resolve => {
      settleDispose = resolve
    })
    if (disposedFailure === null) {
      disposedFailure = new Error("The save coordinator has been disposed")
      disposedFailure.code = "save-disposed"
    }
    terminalEpoch += 1
    state = "disposed"
    error = disposedFailure
    cancelPendingTimers()
    rejectAllWaiters(disposedFailure)
    clearListenersAfterAnnouncements = true
    announceSnapshot()
    const quiescence = admittedAction ?? Promise.resolve()
    quiescence.then(
      () => settleDispose(currentSnapshot),
      () => settleDispose(currentSnapshot),
    )
    return disposePromise
  }

  currentSnapshot = createSnapshot()
  if (options.onSnapshot !== undefined) listeners.add(options.onSnapshot)
  for (const listener of [...listeners]) {
    try {
      listener(currentSnapshot)
    } catch {
      // Observer failures cannot change coordinator state.
    }
  }

  return Object.freeze({
    stage,
    commitNow,
    flush,
    drain,
    snapshot,
    subscribe,
    dispose,
  })
}
