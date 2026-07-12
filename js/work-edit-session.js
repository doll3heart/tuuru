import {
  DATABASE_WRITE_LOCK_NAME,
  LIBRARY_SESSION_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
  getWorkLockName,
} from "./local-locks.js"
import {
  clearWorkOwnerIfOwned,
  isWorkOwnerStale,
  readRestoreGeneration,
  readWorkOwner,
  writeAndVerifyWorkOwner,
} from "./local-write-metadata.js"

const HEARTBEAT_INTERVAL_MS = 15_000

const DEFAULT_SCHEDULER = Object.freeze({
  setInterval(callback, delay) {
    return globalThis.setInterval(callback, delay)
  },
  clearInterval(handle) {
    globalThis.clearInterval(handle)
  },
})

function defaultCreateId(kind) {
  const randomId = globalThis.crypto?.randomUUID?.()
  if (typeof randomId === "string" && randomId.length > 0) return `${kind}-${randomId}`
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export class WorkEditSessionError extends Error {
  constructor(message, code, cause, details) {
    super(message)
    this.name = "WorkEditSessionError"
    this.code = code
    if (cause !== undefined) this.cause = cause
    if (details !== undefined) this.details = details
  }
}

function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
}

function assertIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`)
}

function assertTimestamp(value, name) {
  if (typeof value !== "number") throw new TypeError(`${name} must return a number`)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must return a non-negative safe integer`)
  }
  return value
}

function resolveStorage(storage) {
  const resolved = storage ?? globalThis.localStorage
  assertRecord(resolved, "storage")
  assertFunction(resolved.getItem, "storage.getItem")
  assertFunction(resolved.setItem, "storage.setItem")
  assertFunction(resolved.removeItem, "storage.removeItem")
  return resolved
}

function normalizeInspectOptions(options) {
  assertRecord(options, "options")
  assertIdentifier(options.workId, "workId")
  const now = options.now ?? Date.now
  assertFunction(now, "now")
  return {
    workId: options.workId,
    storage: resolveStorage(options.storage),
    now,
  }
}

function normalizeOpenOptions(options) {
  assertRecord(options, "options")
  assertIdentifier(options.workId, "workId")
  const storage = resolveStorage(options.storage)
  const lockManager = options.lockManager ?? createWebLocksAdapter()
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER
  const now = options.now ?? Date.now
  const createId = options.createId ?? defaultCreateId

  assertRecord(lockManager, "lockManager")
  if (typeof lockManager.available !== "boolean") {
    throw new TypeError("lockManager.available must be a boolean")
  }
  assertFunction(lockManager.request, "lockManager.request")
  assertFunction(lockManager.hold, "lockManager.hold")
  assertRecord(scheduler, "scheduler")
  assertFunction(scheduler.setInterval, "scheduler.setInterval")
  assertFunction(scheduler.clearInterval, "scheduler.clearInterval")
  assertFunction(now, "now")
  assertFunction(createId, "createId")
  if (options.takeover !== undefined && typeof options.takeover !== "boolean") {
    throw new TypeError("takeover must be a boolean")
  }

  return {
    workId: options.workId,
    storage,
    lockManager,
    scheduler,
    now,
    createId,
    takeover: options.takeover ?? false,
  }
}

function readNow(now) {
  return assertTimestamp(now(), "now")
}

function createIdentity(createId, kind) {
  const value = createId(kind)
  assertIdentifier(value, `${kind}Id`)
  return value
}

function generationId(record) {
  return record?.generationId ?? null
}

function availabilityFromOwner(record, timestamp) {
  if (record === null) return null
  const isStale = isWorkOwnerStale(record, timestamp)
  return Object.freeze({
    ownerId: record.ownerId,
    leaseId: record.leaseId,
    expiresAt: record.expiresAt,
    isStale,
    canTakeover: isStale,
  })
}

function hasSameOwnerToken(left, right) {
  return left !== null
    && right !== null
    && left.ownerId === right.ownerId
    && left.leaseId === right.leaseId
}

export function inspectWorkEditAvailability(options) {
  const normalized = normalizeInspectOptions(options)
  const timestamp = readNow(normalized.now)
  const owner = readWorkOwner(normalized.workId, normalized.storage)
  return availabilityFromOwner(owner, timestamp)
}

function workLockedResult(workId, availability) {
  const error = new WorkEditSessionError(
    `Work "${workId}" is already open for editing`,
    "work-locked",
    undefined,
    { workId },
  )
  return Object.freeze({ ok: false, code: "work-locked", error, availability })
}

function unavailableResult(error) {
  return Object.freeze({
    ok: false,
    code: "mutation-lock-unavailable",
    error,
    availability: null,
  })
}

async function requestDatabase(lockManager, callback) {
  return lockManager.request(
    DATABASE_WRITE_LOCK_NAME,
    { mode: "exclusive" },
    lock => {
      if (lock === null) {
        throw new LocalLockUnavailableError("The local database lock was unavailable")
      }
      return callback()
    },
  )
}

async function releaseHandle(handle) {
  if (handle === null) return
  handle.release()
  await handle.released
}

async function releaseHandles(workHandle, libraryHandle) {
  let firstError = null
  try {
    await releaseHandle(workHandle)
  } catch (error) {
    firstError = error
  }
  try {
    await releaseHandle(libraryHandle)
  } catch (error) {
    firstError ??= error
  }
  if (firstError !== null) throw firstError
}

function leaseLostError(workId, cause, message = "The edit session can no longer prove ownership") {
  if (cause instanceof WorkEditSessionError && cause.code === "mutation-lease-lost") {
    return cause
  }
  return new WorkEditSessionError(
    message,
    "mutation-lease-lost",
    cause,
    { workId },
  )
}

function disposedError(workId) {
  return new WorkEditSessionError(
    `The edit session for "${workId}" has been disposed`,
    "work-session-disposed",
    undefined,
    { workId },
  )
}

function createSession({
  workId,
  ownerId,
  leaseId,
  restoreGeneration,
  storage,
  lockManager,
  scheduler,
  now,
  libraryHandle,
  workHandle,
}) {
  let state = "active"
  let timerHandle
  let timerScheduled = false
  let heartbeatPromise = null
  let disposePromise = null
  let lossError = null
  let ownerCleanupAttempted = false

  function cancelHeartbeat() {
    if (!timerScheduled) return null
    const handle = timerHandle
    timerScheduled = false
    timerHandle = undefined
    try {
      scheduler.clearInterval(handle)
      return null
    } catch (error) {
      return error
    }
  }

  function markLeaseLost(error) {
    if (lossError !== null) return lossError
    lossError = leaseLostError(workId, error)
    cancelHeartbeat()
    return lossError
  }

  function assertNotDisposed() {
    if (state !== "active") throw disposedError(workId)
  }

  function assertWritable() {
    assertNotDisposed()
    if (lossError !== null) throw lossError
    if (libraryHandle.isLost() || workHandle.isLost()) {
      throw markLeaseLost(undefined)
    }
    return true
  }

  function verifyMetadataFence() {
    let owner
    let currentGeneration
    try {
      owner = readWorkOwner(workId, storage)
      currentGeneration = generationId(readRestoreGeneration(storage))
    } catch (cause) {
      throw markLeaseLost(cause)
    }

    if (owner === null || owner.ownerId !== ownerId || owner.leaseId !== leaseId) {
      throw markLeaseLost(undefined)
    }
    if (currentGeneration !== restoreGeneration) {
      throw markLeaseLost(undefined)
    }
    return true
  }

  function assertSessionAdmission() {
    assertWritable()
    return verifyMetadataFence()
  }

  function assertOwnerFence() {
    assertNotDisposed()
    return verifyMetadataFence()
  }

  async function runHeartbeat() {
    assertWritable()
    await requestDatabase(lockManager, () => {
      assertSessionAdmission()
      try {
        writeAndVerifyWorkOwner({
          workId,
          ownerId,
          leaseId,
          heartbeatAt: readNow(now),
        }, storage)
      } catch (error) {
        ownerCleanupAttempted = true
        try {
          clearWorkOwnerIfOwned(workId, ownerId, leaseId, storage)
        } catch {
          // Preserve the heartbeat failure that made storage state uncertain.
        }
        throw error
      }
    })
  }

  function refreshHeartbeat() {
    if (heartbeatPromise !== null) return heartbeatPromise

    const operation = (async () => {
      try {
        await runHeartbeat()
      } catch (cause) {
        if (state !== "active") throw cause
        const error = markLeaseLost(cause)
        try {
          await dispose()
        } catch {
          // The lease-loss error is the primary heartbeat failure.
        }
        throw error
      }
    })()
    heartbeatPromise = operation
    void operation.finally(() => {
      if (heartbeatPromise === operation) heartbeatPromise = null
    }).catch(() => {})
    return operation
  }

  async function performDispose(cancellationError) {
    let firstError = cancellationError

    if (!ownerCleanupAttempted) {
      try {
        await requestDatabase(lockManager, () => {
          ownerCleanupAttempted = true
          clearWorkOwnerIfOwned(workId, ownerId, leaseId, storage)
        })
      } catch (error) {
        firstError = error
      }
    }

    try {
      await releaseHandles(workHandle, libraryHandle)
    } catch (error) {
      firstError ??= error
    }
    state = "disposed"
    if (firstError !== null) throw firstError
  }

  function dispose() {
    if (disposePromise === null) {
      let resolveDispose
      let rejectDispose
      disposePromise = new Promise((resolve, reject) => {
        resolveDispose = resolve
        rejectDispose = reject
      })
      state = "disposing"
      const cancellationError = cancelHeartbeat()
      void performDispose(cancellationError).then(resolveDispose, rejectDispose)
    }
    return disposePromise
  }

  const session = Object.freeze({
    ownerId,
    leaseId,
    restoreGeneration,
    assertWritable,
    assertSessionAdmission,
    assertOwnerFence,
    refreshHeartbeat,
    markLeaseLost,
    dispose,
  })

  for (const handle of [libraryHandle, workHandle]) {
    void handle.lost.then(({ reason, error }) => {
      if (reason !== "released") markLeaseLost(error)
    })
  }

  timerHandle = scheduler.setInterval(() => {
    void refreshHeartbeat().catch(() => {})
  }, HEARTBEAT_INTERVAL_MS)
  timerScheduled = true

  return session
}

async function cleanupFailedOpen({
  workId,
  ownerId,
  leaseId,
  storage,
  lockManager,
  libraryHandle,
  workHandle,
  ownerMayExist,
  ownerCleanupAttempted,
}) {
  if (ownerMayExist && !ownerCleanupAttempted) {
    try {
      await requestDatabase(lockManager, () => {
        clearWorkOwnerIfOwned(workId, ownerId, leaseId, storage)
      })
    } catch {
      // Cleanup is best effort; the original opening failure remains primary.
    }
  }
  try {
    await releaseHandles(workHandle, libraryHandle)
  } catch {
    // Cleanup is best effort; the original opening failure remains primary.
  }
}

export async function openWorkEditSession(options) {
  const normalized = normalizeOpenOptions(options)
  const {
    workId,
    storage,
    lockManager,
    scheduler,
    now,
    createId,
    takeover,
  } = normalized

  if (!lockManager.available) {
    return unavailableResult(new LocalLockUnavailableError("Web Locks are unavailable in this context"))
  }

  const openingTimestamp = readNow(now)
  const ownerId = createIdentity(createId, "owner")
  const leaseId = createIdentity(createId, "lease")
  let libraryHandle = null
  let workHandle = null
  let ownerMayExist = false
  let ownerCleanupAttempted = false
  let takeoverPreflight = null

  try {
    libraryHandle = await lockManager.hold(
      LIBRARY_SESSION_LOCK_NAME,
      { mode: "shared", ifAvailable: true },
    )
    if (libraryHandle === null) {
      const availability = inspectWorkEditAvailability({
        workId,
        storage,
        now: () => openingTimestamp,
      })
      return workLockedResult(workId, availability)
    }

    workHandle = await lockManager.hold(
      getWorkLockName(workId),
      { mode: "exclusive", ifAvailable: true },
    )
    if (workHandle === null) {
      const takeoverTimestamp = readNow(now)
      const preflightRestoreGeneration = takeover
        ? generationId(readRestoreGeneration(storage))
        : null
      const currentOwner = readWorkOwner(workId, storage)
      const availability = availabilityFromOwner(currentOwner, takeoverTimestamp)

      if (!takeover || currentOwner === null || !availability.isStale) {
        await releaseHandle(libraryHandle)
        libraryHandle = null
        return workLockedResult(workId, availability)
      }

      takeoverPreflight = Object.freeze({
        owner: currentOwner,
        restoreGeneration: preflightRestoreGeneration,
      })
      workHandle = await lockManager.hold(
        getWorkLockName(workId),
        { mode: "exclusive", steal: true },
      )
      if (workHandle === null) {
        throw new LocalLockUnavailableError("The stolen work lock was unavailable")
      }
    }

    let restoreGeneration
    await requestDatabase(lockManager, () => {
      restoreGeneration = generationId(readRestoreGeneration(storage))
      const currentOwner = readWorkOwner(workId, storage)

      if (takeoverPreflight !== null) {
        if (workHandle.isLost()) {
          throw leaseLostError(
            workId,
            undefined,
            "The takeover work lock ended before owner registration",
          )
        }
        if (restoreGeneration !== takeoverPreflight.restoreGeneration) {
          throw leaseLostError(
            workId,
            undefined,
            "The restore generation changed during takeover",
          )
        }
        if (currentOwner !== null && !hasSameOwnerToken(currentOwner, takeoverPreflight.owner)) {
          throw leaseLostError(
            workId,
            undefined,
            "The work owner changed during takeover",
          )
        }
      }

      ownerMayExist = true
      try {
        writeAndVerifyWorkOwner({
          workId,
          ownerId,
          leaseId,
          heartbeatAt: readNow(now),
        }, storage)
      } catch (error) {
        ownerCleanupAttempted = true
        try {
          clearWorkOwnerIfOwned(workId, ownerId, leaseId, storage)
        } catch {
          // Preserve the registration error that made storage state uncertain.
        }
        throw error
      }
    })

    const session = createSession({
      workId,
      ownerId,
      leaseId,
      restoreGeneration,
      storage,
      lockManager,
      scheduler,
      now,
      libraryHandle,
      workHandle,
    })
    return Object.freeze({ ok: true, session })
  } catch (error) {
    await cleanupFailedOpen({
      workId,
      ownerId,
      leaseId,
      storage,
      lockManager,
      libraryHandle,
      workHandle,
      ownerMayExist,
      ownerCleanupAttempted,
    })
    throw error
  }
}

export async function runWithWorkEditSession(options, callback) {
  assertFunction(callback, "callback")
  const result = await openWorkEditSession(options)
  if (!result.ok) return result

  let value
  let callbackError = null
  try {
    value = await callback(result.session)
  } catch (error) {
    callbackError = error
  }

  let cleanupError = null
  try {
    await result.session.dispose()
  } catch (error) {
    cleanupError = error
  }

  if (callbackError !== null) throw callbackError
  if (cleanupError !== null) throw cleanupError
  return Object.freeze({ ok: true, value })
}
