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

function readOwnDataProperty(value, key) {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return { found: false }
  }
  let descriptor
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key)
  } catch {
    return { found: false }
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    return { found: false }
  }
  return { found: true, value: descriptor.value }
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

function assertSafeJsonBuiltins(usesObjectPrototype, usesArrayPrototype) {
  if (usesArrayPrototype) {
    if (Object.getPrototypeOf(Array.prototype) !== Object.prototype) {
      throw new TypeError("JSON Array.prototype must inherit directly from Object.prototype")
    }
    if (Object.getOwnPropertyDescriptor(Array.prototype, "toJSON") !== undefined) {
      throw new TypeError("JSON payloads must not define or inherit toJSON")
    }
  }
  if (usesObjectPrototype) {
    if (Object.getPrototypeOf(Object.prototype) !== null) {
      throw new TypeError("JSON Object.prototype must terminate at null")
    }
    if (Object.getOwnPropertyDescriptor(Object.prototype, "toJSON") !== undefined) {
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
  const usesArrayPrototype = isArray
  const usesObjectPrototype = prototype !== null

  if (isArray) {
    if (prototype !== Array.prototype) {
      throw new TypeError("JSON arrays must use the ordinary Array prototype")
    }
  } else if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("JSON objects must use an ordinary or null prototype")
  }

  assertSafeJsonBuiltins(usesObjectPrototype, usesArrayPrototype)
  const descriptors = Object.getOwnPropertyDescriptors(source)
  const keys = Reflect.ownKeys(descriptors)
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index] === "toJSON") {
      throw new TypeError("JSON payloads must not define or inherit toJSON")
    }
  }
  if (Object.getPrototypeOf(source) !== prototype) {
    throw new TypeError("JSON payload prototypes must remain stable during inspection")
  }
  assertSafeJsonBuiltins(usesObjectPrototype, usesArrayPrototype)

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
    return {
      target: new Array(length),
      entries,
      usesObjectPrototype,
      usesArrayPrototype,
    }
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
    usesObjectPrototype,
    usesArrayPrototype,
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
  let usesObjectPrototype = root.usesObjectPrototype
  let usesArrayPrototype = root.usesArrayPrototype
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
    usesObjectPrototype ||= inspected.usesObjectPrototype
    usesArrayPrototype ||= inspected.usesArrayPrototype
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

  assertSafeJsonBuiltins(usesObjectPrototype, usesArrayPrototype)
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
  assertFunction(options.commitPreparedCandidate, "commitPreparedCandidate")
  assertFunction(options.recheckUnknown, "recheckUnknown")
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
  const recoveryResumeBatches = new WeakSet()
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
  let uncertainBatch = null
  let unknownFailure = null
  let activeAction = null
  let activeActionControl = null
  let disposePromise = null
  let drainPromise = null
  let emptyFlushGeneration = null
  let emptyFlushPromise = null
  let disposedFailure = null
  let actionUnavailableFailure = null
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

  function isRecoveryPaused() {
    return state === "error-retryable"
      || state === "error-invalid"
      || state === "error-unknown"
  }

  function createActionUnavailableError() {
    if (actionUnavailableFailure === null) {
      actionUnavailableFailure = new Error("The save coordinator cannot start another action")
      actionUnavailableFailure.code = "save-action-unavailable"
    }
    return actionUnavailableFailure
  }

  function terminalAdmissionFailure() {
    if (disposedFailure !== null && (state === "disposed" || error === disposedFailure)) {
      return disposedFailure
    }
    return createActionUnavailableError()
  }

  function beginSynchronousAdmission({
    allowRetryableField = false,
    allowInvalidCorrection = false,
  } = {}) {
    if (state === "disposed") assertAvailable()
    if (state === "conflict"
      || (isRecoveryPaused()
        && !(allowRetryableField && state === "error-retryable")
        && !(allowInvalidCorrection && state === "error-invalid"))) {
      throw createActionUnavailableError()
    }
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
    if (uncertainBatch !== null) count += uncertainBatch.operationIds.length
    for (const batch of readyBatches) count += batch.operations.length
    return count
  }

  function createSnapshot() {
    const count = pendingCount()
    return Object.freeze({
      state,
      pendingCount: count,
      activeBatchId: activeBatch?.id ?? blockedBatch?.id ?? uncertainBatch?.id ?? null,
      lastSavedAt,
      error,
      canRetry: state === "error-retryable",
      canRecheck: state === "error-unknown",
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
    if (state === "conflict" || isRecoveryPaused()) {
      throw createActionUnavailableError()
    }
  }

  function prepareOperation(kind, input, admissionEpoch, { correctionMode = false } = {}) {
    assertAdmissionCurrent(admissionEpoch)
    assertRecord(input, "operation input")
    const correctionDescriptor = Object.getOwnPropertyDescriptor(input, "correctsOperationId")
    assertAdmissionCurrent(admissionEpoch)
    if (!correctionMode && correctionDescriptor !== undefined) {
      throw new TypeError("ordinary operation input must omit correctsOperationId")
    }
    const key = input.key
    assertNonEmptyString(key, "operation key")
    assertAdmissionCurrent(admissionEpoch)
    let correctedOperation = null
    if (correctionMode) {
      if (correctionDescriptor === undefined || !("value" in correctionDescriptor)) {
        throw createActionUnavailableError()
      }
      const correctionId = correctionDescriptor.value
      if (typeof correctionId !== "string" || correctionId.length === 0) {
        throw createActionUnavailableError()
      }
      correctedOperation = blockedBatch?.operations.find(operation => operation.id === correctionId) ?? null
      if (correctedOperation === null
        || correctedOperation.kind !== kind
        || correctedOperation.key !== key) {
        throw createActionUnavailableError()
      }
    }
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
      correctedOperation,
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

  function acceptCorrection(kind, prepared, admissionEpoch) {
    assertAdmissionCurrent(admissionEpoch)
    const originalBatch = blockedBatch
    const correctedOperation = prepared.correctedOperation
    if (state !== "error-invalid"
      || originalBatch === null
      || correctedOperation === null
      || !originalBatch.operations.includes(correctedOperation)) {
      throw createActionUnavailableError()
    }
    const replacementId = createIdCandidate(kind, [], admissionEpoch)
    const replacementBatchId = createIdCandidate("batch", [replacementId], admissionEpoch)
    const replacement = freezeOperation(
      kind,
      prepared,
      replacementId,
      correctedOperation.generation,
    )
    const replacementOperations = originalBatch.operations.map(operation => (
      operation === correctedOperation ? replacement : operation
    ))
    const replacementBatch = freezeBatch(replacementOperations, replacementBatchId)
    assertAdmissionCurrent(admissionEpoch)
    if (state !== "error-invalid" || blockedBatch !== originalBatch) {
      throw terminalAdmissionFailure()
    }

    usedIds.add(replacementId)
    usedIds.add(replacementBatchId)
    blockedBatch = null
    readyBatches.unshift(replacementBatch)
    recoveryResumeBatches.add(replacementBatch)
    state = "dirty"
    error = null
    return replacement
  }

  function stage(input) {
    const correctionMode = state === "error-invalid"
    const admissionEpoch = beginSynchronousAdmission({
      allowRetryableField: true,
      allowInvalidCorrection: correctionMode,
    })
    let operation
    try {
      if (correctionMode) {
        const prepared = prepareOperation("field", input, admissionEpoch, { correctionMode: true })
        operation = acceptCorrection("field", prepared, admissionEpoch)
      } else {
        operation = createOperation("field", input, admissionEpoch)
        pendingFields.set(operation.key, operation)
      }
      if (!correctionMode && state !== "error-retryable") {
        if (activeBatch === null) state = "dirty"
        try {
          schedulePendingTimers()
        } catch (failure) {
          throw enterConflict(failure)
        }
      }
      assertAdmissionCurrent(admissionEpoch)
    } finally {
      endSynchronousAdmission()
    }
    announceSnapshot()
    if (correctionMode) startNextBatch()
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

  function createGenerationWaiter(targetGeneration, kind, operationId = null) {
    if (targetGeneration <= verifiedGeneration) return Promise.resolve(lastCommitResult)
    let resolve
    let reject
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    generationWaiters.add({
      kind,
      targetGeneration,
      operationId,
      resolve,
      reject,
    })
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

  function rejectFailedBatchWaiters(batch, failure) {
    const batchOperationIds = new Set(batch.operationIds)
    const batchGeneration = batch.generations[batch.generations.length - 1]
    for (const waiter of [...generationWaiters]) {
      const ownsFailedOperation = waiter.kind === "commit"
        && batchOperationIds.has(waiter.operationId)
      const crossesFailedBatch = (waiter.kind === "flush" || waiter.kind === "drain")
        && waiter.targetGeneration >= batchGeneration
      if (!ownsFailedOperation && !crossesFailedBatch) continue
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

  function classifyOrdinaryFailure(failure, batch) {
    const codeProperty = readOwnDataProperty(failure, "code")
    const detailsProperty = readOwnDataProperty(failure, "details")
    if (!codeProperty.found || !detailsProperty.found) return { state: "conflict" }
    const details = detailsProperty.value
    if (details === null || typeof details !== "object" || Array.isArray(details)) {
      return { state: "conflict" }
    }
    const operationId = readOwnDataProperty(details, "operationId")
    const commitState = readOwnDataProperty(details, "commitState")
    const phase = readOwnDataProperty(details, "phase")
    if (!operationId.found
      || operationId.value !== batch.id
      || !commitState.found) {
      return { state: "conflict" }
    }

    const isUnknownCode = codeProperty.value === "mutation-readback-failed"
      || codeProperty.value === "mutation-verification-failed"
    if (isUnknownCode && commitState.value === "unknown") {
      const expectedCurrentRaw = readOwnDataProperty(details, "expectedCurrentRaw")
      const candidateRaw = readOwnDataProperty(details, "candidateRaw")
      if (!expectedCurrentRaw.found
        || (expectedCurrentRaw.value !== null && typeof expectedCurrentRaw.value !== "string")
        || !candidateRaw.found
        || typeof candidateRaw.value !== "string") {
        return { state: "conflict" }
      }
      return {
        state: "error-unknown",
        uncertainBatch: Object.freeze({
          kind: "unknown",
          id: batch.id,
          operationIds: Object.freeze([...batch.operationIds]),
          generations: Object.freeze([...batch.generations]),
          expectedCurrentRaw: expectedCurrentRaw.value,
          candidateRaw: candidateRaw.value,
        }),
      }
    }

    if (commitState.value !== "unchanged") {
      return { state: "conflict" }
    }
    if (codeProperty.value === "mutation-read-failed"
      || codeProperty.value === "mutation-write-failed") {
      return { state: "error-retryable" }
    }
    if (codeProperty.value === "mutation-invalid"
      && phase.found
      && (phase.value === "apply" || phase.value === "validate-candidate")) {
      return { state: "error-invalid" }
    }
    return { state: "conflict" }
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

  function enterOrdinaryFailure(suppliedFailure, batch) {
    const failure = normalizeCommitFailure(suppliedFailure)
    const classification = classifyOrdinaryFailure(failure, batch)
    if (isTerminalState()) return error ?? failure
    if (classification.state === "conflict") {
      return enterConflict(failure, batch.kind === "unknown" ? null : batch)
    }
    if (classification.state === "error-unknown") {
      if (blockedBatch !== null && blockedBatch !== batch) {
        return enterConflict(failure, batch)
      }
      blockedBatch = null
      uncertainBatch = classification.uncertainBatch
      unknownFailure = failure
      state = "error-unknown"
      error = failure
      cancelPendingTimers()
      rejectFailedBatchWaiters(batch, failure)
      announceSnapshot()
      return failure
    }
    if (batch.kind === "unknown") {
      if (classification.state !== "error-retryable") {
        return enterConflict(failure)
      }
      uncertainBatch = batch
      state = "error-retryable"
      error = failure
      cancelPendingTimers()
      rejectFailedBatchWaiters(batch, failure)
      announceSnapshot()
      return failure
    }
    if (blockedBatch !== null && blockedBatch !== batch) {
      return enterConflict(failure, batch)
    }
    blockedBatch = batch
    state = classification.state
    error = failure
    cancelPendingTimers()
    rejectFailedBatchWaiters(batch, failure)
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
      || isTerminalState()
      || isRecoveryPaused()) {
      return
    }

    const batch = readyBatches.shift()
    const admissionEpoch = terminalEpoch
    let settleCompletion
    const completion = new Promise(resolve => {
      settleCompletion = resolve
    })
    const action = Object.freeze({
      kind: "commit",
      materialId: batch.id,
      publicPromise: completion,
      completion,
      epoch: admissionEpoch,
    })
    activeAction = action
    activeActionControl = null
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
      if (activeAction === action) {
        activeAction = null
        activeActionControl = null
      }
      settleCompletion()
      if (!isTerminalState() && !isRecoveryPaused()) startNextBatch()
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
          const resumesRecovery = recoveryResumeBatches.has(batch)
          recoveryResumeBatches.delete(batch)
          if (isTerminalState() || terminalEpoch !== admissionEpoch) {
            announceSnapshot()
            return
          }
          if (resumesRecovery && pendingFields.size > 0) {
            try {
              capturePendingWithAdmission()
            } catch (failure) {
              if (isTerminalState() || terminalEpoch !== admissionEpoch) {
                announceSnapshot()
                return
              }
              enterConflict(failure)
              return
            }
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
          enterOrdinaryFailure(suppliedFailure, batch)
        },
      )
      .catch(suppliedFailure => {
        if (isTerminalState() || terminalEpoch !== admissionEpoch) {
          retainUnverifiedBatch()
          return
        }
        if (activeBatch === batch) activeBatch = null
        enterOrdinaryFailure(suppliedFailure, batch)
      })
      .finally(finishAction)
  }

  function commitNow(input) {
    const correctionMode = state === "error-invalid"
    const admissionEpoch = beginSynchronousAdmission({
      allowInvalidCorrection: correctionMode,
    })
    let prepared
    try {
      prepared = prepareOperation(
        "structural",
        input,
        admissionEpoch,
        { correctionMode },
      )
    } catch (failure) {
      endSynchronousAdmission()
      throw failure
    }
    let operation
    try {
      operation = correctionMode
        ? acceptCorrection("structural", prepared, admissionEpoch)
        : acceptStructuralBatch(prepared, admissionEpoch)
    } catch (failure) {
      endSynchronousAdmission()
      if (terminalEpoch !== admissionEpoch || terminalEpoch !== 0 || isTerminalState()) {
        throw terminalAdmissionFailure()
      }
      if (correctionMode) throw failure
      throw enterConflict(failure)
    }
    endSynchronousAdmission()
    const promise = createGenerationWaiter(operation.generation, "commit", operation.id)
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
      && blockedBatch === null
      && uncertainBatch === null) {
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

    createGenerationWaiter(targetGeneration, "flush").then(
      resolveFlush,
      rejectFlush,
    )
    if (activeBatch === null && activeAction === null) state = "dirty"
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
        await createGenerationWaiter(targetGeneration, "drain")
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

  function retry() {
    if (activeAction !== null) {
      if (activeAction.kind === "retry") return activeAction.publicPromise
      return Promise.reject(createActionUnavailableError())
    }
    if (state !== "error-retryable") {
      return Promise.reject(createActionUnavailableError())
    }

    const usesPreparedCandidate = blockedBatch === null && uncertainBatch !== null
    const batch = usesPreparedCandidate ? uncertainBatch : blockedBatch
    if (batch === null) return Promise.reject(createActionUnavailableError())

    const actionEpoch = terminalEpoch
    let resolveOwner
    let rejectOwner
    const publicPromise = new Promise((resolve, reject) => {
      resolveOwner = resolve
      rejectOwner = reject
    })
    let settleCompletion
    const completion = new Promise(resolve => {
      settleCompletion = resolve
    })
    const action = Object.freeze({
      kind: "retry",
      materialId: batch.id,
      publicPromise,
      completion,
      epoch: actionEpoch,
    })
    activeAction = action
    activeActionControl = { rejectOwner }
    state = "saving"
    error = null
    announceSnapshot()

    let finished = false
    function finishAction() {
      if (finished) return
      finished = true
      if (activeAction === action) {
        activeAction = null
        activeActionControl = null
      }
      settleCompletion()
      if (!isTerminalState() && !isRecoveryPaused()) startNextBatch()
    }

    function currentTerminalFailure() {
      if (state === "disposed" && disposedFailure !== null) return disposedFailure
      return error ?? createActionUnavailableError()
    }

    function rejectForTerminalState() {
      const failure = currentTerminalFailure()
      finishAction()
      rejectOwner(failure)
    }

    function handleFailure(suppliedFailure) {
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      const failure = enterOrdinaryFailure(suppliedFailure, batch)
      finishAction()
      rejectOwner(failure)
    }

    function handleSuccess(suppliedResult, attemptedAt) {
      let result
      try {
        result = validateCommitResult(suppliedResult, batch)
      } catch (failure) {
        handleFailure(failure)
        return
      }
      recordVerifiedBatch(batch, result)
      lastSavedAt = attemptedAt
      if (usesPreparedCandidate) {
        if (uncertainBatch === batch) uncertainBatch = null
        unknownFailure = null
      } else {
        if (blockedBatch === batch) blockedBatch = null
        recoveryResumeBatches.delete(batch)
      }
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        announceSnapshot()
        rejectForTerminalState()
        return
      }

      state = readyBatches.length > 0 || pendingFields.size > 0 ? "dirty" : "clean"
      error = null
      if (pendingFields.size > 0) {
        try {
          capturePendingWithAdmission()
        } catch (failure) {
          if (isTerminalState() || terminalEpoch !== actionEpoch) {
            announceSnapshot()
            rejectForTerminalState()
            return
          }
          enterConflict(failure)
          finishAction()
          resolveOwner(result)
          return
        }
      }
      state = readyBatches.length > 0 || pendingFields.size > 0 ? "dirty" : "clean"
      announceSnapshot()
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      finishAction()
      resolveOwner(result)
    }

    if (isTerminalState() || terminalEpoch !== actionEpoch) {
      rejectForTerminalState()
      return publicPromise
    }

    let attemptedAt
    try {
      attemptedAt = readAttemptTime()
    } catch (failure) {
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
      } else {
        const finalFailure = enterConflict(failure, usesPreparedCandidate ? null : batch)
        finishAction()
        rejectOwner(finalFailure)
      }
      return publicPromise
    }
    if (isTerminalState() || terminalEpoch !== actionEpoch) {
      rejectForTerminalState()
      return publicPromise
    }

    Promise.resolve()
      .then(() => {
        if (isTerminalState() || terminalEpoch !== actionEpoch) {
          throw currentTerminalFailure()
        }
        return usesPreparedCandidate
          ? options.commitPreparedCandidate(batch)
          : options.commitMutation(batch)
      })
      .then(
        result => handleSuccess(result, attemptedAt),
        handleFailure,
      )
      .catch(handleFailure)
    return publicPromise
  }

  function validateRecheckResult(suppliedResult) {
    if (suppliedResult === null
      || typeof suppliedResult !== "object"
      || Array.isArray(suppliedResult)) {
      throw new TypeError("recheckUnknown result must be an object")
    }
    const raw = readOwnDataProperty(suppliedResult, "raw")
    const database = readOwnDataProperty(suppliedResult, "database")
    const workToken = readOwnDataProperty(suppliedResult, "workToken")
    if (!raw.found || typeof raw.value !== "string"
      || !database.found
      || database.value === null
      || typeof database.value !== "object"
      || Array.isArray(database.value)
      || !workToken.found
      || typeof workToken.value !== "string") {
      throw new TypeError("recheckUnknown returned a malformed result")
    }
    return {
      raw: raw.value,
      database: database.value,
      workToken: workToken.value,
    }
  }

  function validateRecheckOutcome(suppliedOutcome) {
    if (suppliedOutcome === null
      || typeof suppliedOutcome !== "object"
      || Array.isArray(suppliedOutcome)) {
      throw new TypeError("recheckUnknown must return an outcome object")
    }
    const outcome = readOwnDataProperty(suppliedOutcome, "outcome")
    if (!outcome.found) throw new TypeError("recheckUnknown outcome must be own data")
    if (outcome.value === "not-written") {
      return { kind: "not-written", suppliedOutcome }
    }
    if (outcome.value !== "saved" && outcome.value !== "conflict") {
      throw new TypeError("recheckUnknown returned an unknown outcome")
    }
    const result = readOwnDataProperty(suppliedOutcome, "result")
    if (!result.found) throw new TypeError("recheckUnknown outcome must include a result")
    return {
      kind: outcome.value,
      suppliedOutcome,
      result: validateRecheckResult(result.value),
    }
  }

  function recheck() {
    if (activeAction !== null) {
      if (activeAction.kind === "recheck") return activeAction.publicPromise
      return Promise.reject(createActionUnavailableError())
    }
    if (state !== "error-unknown" || uncertainBatch === null) {
      return Promise.reject(createActionUnavailableError())
    }

    const batch = uncertainBatch
    const actionEpoch = terminalEpoch
    let resolveOwner
    let rejectOwner
    const publicPromise = new Promise((resolve, reject) => {
      resolveOwner = resolve
      rejectOwner = reject
    })
    let settleCompletion
    const completion = new Promise(resolve => {
      settleCompletion = resolve
    })
    const action = Object.freeze({
      kind: "recheck",
      materialId: batch.id,
      publicPromise,
      completion,
      epoch: actionEpoch,
    })
    activeAction = action
    activeActionControl = { rejectOwner }

    let finished = false
    function finishAction() {
      if (finished) return
      finished = true
      if (activeAction === action) {
        activeAction = null
        activeActionControl = null
      }
      settleCompletion()
      if (!isTerminalState() && !isRecoveryPaused()) startNextBatch()
    }

    function currentTerminalFailure() {
      if (state === "disposed" && disposedFailure !== null) return disposedFailure
      return error ?? createActionUnavailableError()
    }

    function rejectForTerminalState() {
      const failure = currentTerminalFailure()
      finishAction()
      rejectOwner(failure)
    }

    function failClosed(suppliedFailure) {
      const failure = enterConflict(suppliedFailure)
      finishAction()
      rejectOwner(failure)
    }

    function handleOutcome(suppliedOutcome) {
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      let outcome
      try {
        outcome = validateRecheckOutcome(suppliedOutcome)
      } catch (failure) {
        failClosed(failure)
        return
      }

      if (outcome.kind === "not-written") {
        state = "error-retryable"
        error = unknownFailure
        announceSnapshot()
        finishAction()
        resolveOwner(outcome.suppliedOutcome)
        return
      }

      if (outcome.kind === "conflict") {
        enterConflict(outcome.suppliedOutcome)
        finishAction()
        resolveOwner(outcome.suppliedOutcome)
        return
      }

      let savedAt
      try {
        savedAt = readAttemptTime()
      } catch (failure) {
        failClosed(failure)
        return
      }
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      const commitResult = Object.freeze({
        ok: true,
        operationId: batch.id,
        raw: outcome.result.raw,
        database: outcome.result.database,
        workToken: outcome.result.workToken,
      })
      recordVerifiedBatch(batch, commitResult)
      lastSavedAt = savedAt
      if (uncertainBatch === batch) uncertainBatch = null
      unknownFailure = null
      error = null
      state = readyBatches.length > 0 || pendingFields.size > 0 ? "dirty" : "clean"
      if (pendingFields.size > 0) {
        try {
          capturePendingWithAdmission()
        } catch (failure) {
          failClosed(failure)
          return
        }
      }
      state = readyBatches.length > 0 || pendingFields.size > 0 ? "dirty" : "clean"
      announceSnapshot()
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      finishAction()
      resolveOwner(outcome.suppliedOutcome)
    }

    function handleFailure(suppliedFailure) {
      if (isTerminalState() || terminalEpoch !== actionEpoch) {
        rejectForTerminalState()
        return
      }
      const failure = normalizeCommitFailure(suppliedFailure)
      const code = readOwnDataProperty(failure, "code")
      if (code.found && code.value === "mutation-conflict") {
        const terminalFailure = enterConflict(failure)
        finishAction()
        rejectOwner(terminalFailure)
        return
      }
      state = "error-unknown"
      error = failure
      unknownFailure = failure
      announceSnapshot()
      finishAction()
      rejectOwner(failure)
    }

    Promise.resolve()
      .then(() => {
        if (isTerminalState() || terminalEpoch !== actionEpoch) {
          throw currentTerminalFailure()
        }
        return options.recheckUnknown(batch)
      })
      .then(handleOutcome, handleFailure)
      .catch(handleFailure)
    return publicPromise
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
    activeActionControl?.rejectOwner(disposedFailure)
    clearListenersAfterAnnouncements = true
    announceSnapshot()
    const quiescence = admittedAction?.completion ?? Promise.resolve()
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
    retry,
    recheck,
    snapshot,
    subscribe,
    dispose,
  })
}
