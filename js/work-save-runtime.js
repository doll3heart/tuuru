import {
  commitLocalDatabaseMutation,
  commitPreparedLocalDatabaseCandidate,
  createJsonToken,
  recheckUnknownLocalDatabaseCommit,
} from "./local-database-mutation.js"
import { prepareEmergencyLocalDatabaseBackup } from "./emergency-backup.js"
import {
  LOCAL_RESTORE_GENERATION_KEY,
  getWorkOwnerKey,
  listActiveWorkOwners,
  readRestoreGeneration,
  readWorkOwner,
} from "./local-write-metadata.js"
import {
  LOCAL_DATABASE_KEY,
  LocalDatabaseError,
  inspectLocalDatabaseRaw,
  serializeValidatedLocalDatabase,
} from "./storage.js"
import { openWorkEditSession } from "./work-edit-session.js"
import { createWorkSaveCoordinator } from "./work-save-coordinator.js"

const EMPTY_EDITORS = Object.freeze([])

function runtimeError(message, code, cause, details) {
  const error = new Error(message)
  error.name = "WorkSaveRuntimeError"
  error.code = code
  if (cause !== undefined) error.cause = cause
  if (details !== undefined) error.details = details
  return error
}

function cloneJson(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value))
}

function defaultRecoveryId(kind) {
  const randomId = globalThis.crypto?.randomUUID?.()
  if (typeof randomId === "string" && randomId.length > 0) return `${kind}-${randomId}`
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function uniqueWork(database, workId) {
  const matches = database.works.filter(work => work.id === workId)
  if (matches.length > 1) {
    throw new LocalDatabaseError(
      `The local database contains duplicate work id "${workId}".`,
      "invalid-structure",
      undefined,
      { issues: [{ code: "duplicate-work-id", path: "$.works" }] },
    )
  }
  return matches[0] ?? null
}

function readInitialCandidate(storage, workId) {
  let raw
  try {
    raw = storage.getItem(LOCAL_DATABASE_KEY)
  } catch (cause) {
    throw new LocalDatabaseError(
      "Unable to read the local database while opening the editor.",
      "storage-unavailable",
      cause,
    )
  }
  const status = inspectLocalDatabaseRaw(raw)
  if (!status.ok) {
    throw new LocalDatabaseError(
      "The local database is invalid while opening the editor.",
      status.code,
      undefined,
      { issues: status.issues, raw },
    )
  }
  const work = uniqueWork(status.data, workId)
  return {
    raw,
    database: status.data,
    work,
    workToken: createJsonToken(work),
  }
}

function readSafeWork(storage, workId) {
  try {
    return cloneJson(readInitialCandidate(storage, workId).work)
  } catch {
    return null
  }
}

function createFailureSnapshot(error, state, availability = null) {
  return Object.freeze({
    state,
    pendingCount: 0,
    activeBatchId: null,
    lastSavedAt: null,
    error,
    canRetry: false,
    canRecheck: false,
    hasRecoverableCandidate: false,
    generation: 0,
    otherActiveEditors: EMPTY_EDITORS,
    availability,
  })
}

function failureResult(code, error, work, state, availability = null) {
  return Object.freeze({
    ok: false,
    code,
    error,
    work: cloneJson(work),
    snapshot: createFailureSnapshot(error, state, availability),
  })
}

async function disposeAfterFailedInitialization(session) {
  await session.dispose()
}

function applyOrderedOperationsToWork(work, operations, workId) {
  let candidate = cloneJson(work)
  for (const operation of operations) {
    candidate = operation.apply(candidate, operation.payload)
    if (!isRecord(candidate) || candidate.id !== workId) {
      throw runtimeError(
        "A save operation changed or removed the target work identity.",
        "mutation-invalid",
        undefined,
        { operationId: operation.id, workId },
      )
    }
  }
  return candidate
}

function applyBatchOperationsToWork(work, operations, workId) {
  const ordered = [
    ...operations.filter(operation => operation.kind === "field"),
    ...operations.filter(operation => operation.kind === "structural"),
  ]
  return applyOrderedOperationsToWork(work, ordered, workId)
}

function workFromRaw(raw, workId) {
  const status = inspectLocalDatabaseRaw(raw)
  if (!status.ok) {
    throw new LocalDatabaseError(
      "A retained save candidate is invalid.",
      "mutation-invalid",
      undefined,
      { issues: status.issues, raw },
    )
  }
  return uniqueWork(status.data, workId)
}

function replaceTargetWork(database, workId, replacement) {
  let replacements = 0
  const works = database.works.map(work => {
    if (work.id !== workId) return work
    replacements += 1
    return replacement
  })
  if (replacements !== 1) {
    throw runtimeError(
      "The recovery database no longer contains one unambiguous target work.",
      "mutation-invalid",
      undefined,
      { workId, replacements },
    )
  }
  return { ...database, works }
}

function serializeRecoveryCandidate(database) {
  try {
    return serializeValidatedLocalDatabase(database)
  } catch (error) {
    const safelyInspectedSchemaFailure = error?.code === "invalid-write"
      && Array.isArray(error?.details?.issues)
    if (!safelyInspectedSchemaFailure) return null
    try {
      const raw = JSON.stringify(database)
      return typeof raw === "string" ? raw : null
    } catch {
      return null
    }
  }
}

export async function openWorkSaveRuntime({
  workId,
  storage = globalThis.localStorage,
  lockManager,
  scheduler,
  now = Date.now,
  createId,
  takeover = false,
  onSnapshot,
}) {
  const readableWork = readSafeWork(storage, workId)
  let opened
  try {
    opened = await openWorkEditSession({
      workId,
      storage,
      lockManager,
      scheduler,
      now,
      createId,
      takeover,
    })
  } catch (cause) {
    const error = runtimeError(
      "Unable to initialize the reliable work runtime.",
      "runtime-init-failed",
      cause,
      { workId },
    )
    return failureResult("runtime-init-failed", error, readableWork, "conflict")
  }

  if (!opened.ok) {
    return failureResult(
      opened.code,
      opened.error,
      readableWork,
      "lease-lost",
      opened.availability,
    )
  }

  const { session } = opened
  let candidate
  let coordinator = null
  let removeCoordinatorSubscription = null
  let storageListener = null
  let storageListenerRegistered = false
  try {
    candidate = readInitialCandidate(storage, workId)
    if (candidate.work === null) {
      const error = runtimeError(
        `Work "${workId}" is missing from the local database.`,
        "work-missing",
        undefined,
        { workId },
      )
      await disposeAfterFailedInitialization(session)
      return failureResult("work-missing", error, null, "conflict")
    }

    let activeSession = session
    const expectedRestoreGeneration = session.restoreGeneration
    let lifecycleState = "active"
    let lifecycleGateError = null
    let suspendPromise = null
    let resumePromise = null
    let disposePromise = null
    let verifiedRaw = candidate.raw
    let verifiedDatabase = candidate.database
    let verifiedWork = candidate.work
    let expectedWorkToken = candidate.workToken
    let runtimeOverride = null
    let otherActiveEditors = EMPTY_EDITORS
    let currentRuntimeSnapshot = null
    let emergencyBackupIdentity = null
    const runtimeListeners = new Set()

    function adoptVerifiedResult(result) {
      const work = uniqueWork(result.database, workId)
      if (work === null || createJsonToken(work) !== result.workToken) {
        throw runtimeError(
          "A verified save result did not contain the expected target work.",
          "mutation-invalid",
          undefined,
          { workId, operationId: result.operationId },
        )
      }
      verifiedRaw = result.raw
      verifiedDatabase = result.database
      verifiedWork = work
      expectedWorkToken = result.workToken
    }

    function buildOrdinaryPendingCandidate() {
      const material = coordinator?.recoveryMaterial() ?? null
      if (material === null) return cloneJson(verifiedWork)
      if (material.kind === "ordinary") {
        return applyOrderedOperationsToWork(
          verifiedWork,
          material.pendingOperations,
          workId,
        )
      }
      const unknownBase = workFromRaw(material.uncertainBatch.candidateRaw, workId)
      if (unknownBase === null) {
        throw runtimeError(
          "The unknown save candidate no longer contains the target work.",
          "mutation-invalid",
          undefined,
          { workId },
        )
      }
      return applyOrderedOperationsToWork(
        unknownBase,
        material.laterPendingOperations,
        workId,
      )
    }

    function applyRecoveryOperationsToDatabase(database, operations) {
      const target = uniqueWork(database, workId)
      if (target === null) {
        throw runtimeError(
          "The recovery database no longer contains the target work.",
          "mutation-invalid",
          undefined,
          { workId },
        )
      }
      const localWork = applyOrderedOperationsToWork(target, operations, workId)
      return replaceTargetWork(database, workId, localWork)
    }

    function buildEmergencyLocalCandidateRaw() {
      const material = coordinator.recoveryMaterial()
      if (material?.kind === "unknown") {
        const { uncertainBatch, laterPendingOperations } = material
        let laterCandidateRaw = uncertainBatch.candidateRaw
        if (laterPendingOperations.length > 0) {
          try {
            const status = inspectLocalDatabaseRaw(uncertainBatch.candidateRaw)
            if (!status.ok) {
              throw new LocalDatabaseError(
                "A retained save candidate is invalid.",
                "mutation-invalid",
                undefined,
                { issues: status.issues, raw: uncertainBatch.candidateRaw },
              )
            }
            laterCandidateRaw = serializeRecoveryCandidate(
              applyRecoveryOperationsToDatabase(status.data, laterPendingOperations),
            )
          } catch {
            laterCandidateRaw = null
          }
        }
        return Object.freeze({
          kind: "unknown",
          expectedCurrentRaw: uncertainBatch.expectedCurrentRaw,
          candidateRaw: uncertainBatch.candidateRaw,
          laterCandidateRaw,
        })
      }

      const operations = material?.kind === "ordinary"
        ? material.pendingOperations
        : []
      let candidateRaw = null
      try {
        candidateRaw = serializeRecoveryCandidate(
          applyRecoveryOperationsToDatabase(verifiedDatabase, operations),
        )
      } catch {
        candidateRaw = null
      }
      return Object.freeze({
        kind: "ordinary",
        candidateRaw,
      })
    }

    function emergencyIdentityForGeneration(generation) {
      if (emergencyBackupIdentity?.generation === generation) {
        if (emergencyBackupIdentity.status === "failed") {
          throw emergencyBackupIdentity.failure
        }
        return emergencyBackupIdentity
      }
      const recoveryIdFactory = createId ?? defaultRecoveryId
      let recoveryWorkId
      try {
        recoveryWorkId = recoveryIdFactory("recovery-work")
      } catch (failure) {
        emergencyBackupIdentity = Object.freeze({
          generation,
          status: "failed",
          failure,
          recoveryWorkId: null,
        })
        throw failure
      }
      let timestamp
      try {
        timestamp = now()
      } catch (failure) {
        emergencyBackupIdentity = Object.freeze({
          generation,
          status: "failed",
          failure,
          recoveryWorkId,
        })
        throw failure
      }
      const identity = Object.freeze({
        generation,
        status: "ready",
        recoveryWorkId,
        now: timestamp,
      })
      emergencyBackupIdentity = identity
      return identity
    }

    function wrappedSnapshot() {
      const source = coordinator.snapshot()
      const state = runtimeOverride?.state ?? source.state
      const error = runtimeOverride?.error ?? source.error
      const availability = runtimeOverride?.availability ?? source.availability
      const next = {
        ...source,
        state,
        error,
        canRetry: runtimeOverride === null ? source.canRetry : false,
        canRecheck: runtimeOverride === null ? source.canRecheck : false,
        otherActiveEditors,
        availability,
      }
      const previous = currentRuntimeSnapshot
      if (previous !== null && Object.keys(next).every(key => previous[key] === next[key])) {
        return previous
      }
      currentRuntimeSnapshot = Object.freeze(next)
      return currentRuntimeSnapshot
    }

    function announceRuntimeSnapshot() {
      const snapshot = wrappedSnapshot()
      for (const listener of [...runtimeListeners]) {
        try {
          listener(snapshot)
        } catch {
          // Observer failures cannot change runtime state.
        }
      }
      return snapshot
    }

    function currentTerminalError() {
      if (runtimeOverride !== null) return runtimeOverride.error
      const source = coordinator.snapshot()
      if (source.state === "conflict"
        || source.state === "lease-lost"
        || source.state === "disposed") {
        return source.error
      }
      return null
    }

    function markExternalConflict(cause) {
      const terminalError = currentTerminalError()
      if (terminalError !== null) return terminalError
      const error = runtimeError(
        "The target work changed outside this editor.",
        "mutation-conflict",
        cause,
        { workId },
      )
      runtimeOverride = Object.freeze({ state: "conflict", error, availability: null })
      coordinator.markLeaseLost(error)
      announceRuntimeSnapshot()
      return error
    }

    function markRuntimeLeaseLost(cause) {
      const terminalError = currentTerminalError()
      if (terminalError !== null) return terminalError
      const error = activeSession === null
        ? runtimeError(
            "The work runtime can no longer prove ownership.",
            "mutation-lease-lost",
            cause,
            { workId },
          )
        : activeSession.markLeaseLost(cause)
      coordinator.markLeaseLost(error)
      announceRuntimeSnapshot()
      return error
    }

    function refreshOtherActiveEditors() {
      try {
        const active = listActiveWorkOwners(storage, now())
          .filter(record => record.workId !== workId)
        otherActiveEditors = active.length === 0
          ? EMPTY_EDITORS
          : Object.freeze(active)
        announceRuntimeSnapshot()
      } catch {
        // Unrelated corrupt owner metadata cannot revoke this runtime. Keep the last warning.
      }
    }

    function lifecycleFailure() {
      if (lifecycleGateError !== null) return lifecycleGateError
      const disposed = lifecycleState === "disposing" || lifecycleState === "disposed"
      lifecycleGateError = runtimeError(
        disposed
          ? "The work runtime is being disposed."
          : "The work runtime is suspended.",
        disposed ? "save-disposed" : "runtime-suspended",
        undefined,
        { workId },
      )
      return lifecycleGateError
    }

    function assertRuntimeWritable() {
      if (runtimeOverride !== null) throw runtimeOverride.error
      const source = coordinator.snapshot()
      if (source.state === "conflict"
        || source.state === "lease-lost"
        || source.state === "disposed") {
        throw source.error
      }
      if (lifecycleState !== "active") throw lifecycleFailure()
      if (activeSession === null) throw lifecycleFailure()
      try {
        return activeSession.assertWritable()
      } catch (error) {
        coordinator.markLeaseLost(error)
        throw error
      }
    }

    function sessionForAdapter() {
      if (activeSession === null) throw lifecycleFailure()
      return activeSession
    }

    function finishAdmittedSession(admittedSession) {
      try {
        admittedSession.assertWritable()
      } catch (cause) {
        const leaseError = admittedSession.markLeaseLost(cause)
        coordinator.markLeaseLost(leaseError)
      }
    }

    async function finishVerifiedAdapter(result, admittedSession) {
      adoptVerifiedResult(result)
      finishAdmittedSession(admittedSession)
      return result
    }

    coordinator = createWorkSaveCoordinator({
      async commitMutation(batch) {
        const admittedSession = sessionForAdapter()
        const result = await commitLocalDatabaseMutation({
          operationId: batch.id,
          workId,
          ownerId: admittedSession.ownerId,
          leaseId: admittedSession.leaseId,
          restoreGeneration: admittedSession.restoreGeneration,
          expectedWorkToken,
          apply(database) {
            const target = uniqueWork(database, workId)
            if (target === null) {
              throw runtimeError(
                "The target work was deleted before the save could be applied.",
                "mutation-conflict",
                undefined,
                { workId },
              )
            }
            const nextWork = applyBatchOperationsToWork(
              target,
              batch.operations,
              workId,
            )
            const timestamp = now()
            if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
              throw new TypeError("now() must return a non-negative safe integer")
            }
            const savedWork = { ...nextWork, updatedAt: timestamp }
            let replacements = 0
            const works = database.works.map(work => {
              if (work.id !== workId) return work
              replacements += 1
              return savedWork
            })
            if (replacements !== 1) {
              throw runtimeError(
                "The target work identity became ambiguous during save.",
                "mutation-invalid",
                undefined,
                { workId, replacements },
              )
            }
            return { ...database, works }
          },
        }, {
          storage,
          lockManager,
          assertSessionAdmission: admittedSession.assertSessionAdmission,
          assertOwnerFence: admittedSession.assertOwnerFence,
        })
        return finishVerifiedAdapter(result, admittedSession)
      },
      async commitPreparedCandidate(envelope) {
        const admittedSession = sessionForAdapter()
        const result = await commitPreparedLocalDatabaseCandidate({
          operationId: envelope.id,
          workId,
          ownerId: admittedSession.ownerId,
          leaseId: admittedSession.leaseId,
          restoreGeneration: admittedSession.restoreGeneration,
          expectedCurrentRaw: envelope.expectedCurrentRaw,
          candidateRaw: envelope.candidateRaw,
        }, {
          storage,
          lockManager,
          assertSessionAdmission: admittedSession.assertSessionAdmission,
          assertOwnerFence: admittedSession.assertOwnerFence,
        })
        return finishVerifiedAdapter(result, admittedSession)
      },
      async recheckUnknown(envelope) {
        const admittedSession = sessionForAdapter()
        const outcome = await recheckUnknownLocalDatabaseCommit({
          workId,
          ownerId: admittedSession.ownerId,
          leaseId: admittedSession.leaseId,
          restoreGeneration: admittedSession.restoreGeneration,
          expectedCurrentRaw: envelope.expectedCurrentRaw,
          candidateRaw: envelope.candidateRaw,
        }, {
          storage,
          lockManager,
          assertSessionAdmission: admittedSession.assertSessionAdmission,
        })
        if (outcome.outcome === "saved") {
          await finishVerifiedAdapter(outcome.result, admittedSession)
        } else if (outcome.outcome === "not-written") {
          finishAdmittedSession(admittedSession)
        }
        return outcome
      },
      scheduler,
      now,
      createOperationId: createId,
    })

    removeCoordinatorSubscription = coordinator.subscribe(() => {
      announceRuntimeSnapshot()
    })
    refreshOtherActiveEditors()
    if (onSnapshot !== undefined) {
      if (typeof onSnapshot !== "function") throw new TypeError("onSnapshot must be a function")
      runtimeListeners.add(onSnapshot)
      try {
        onSnapshot(wrappedSnapshot())
      } catch {
        // Observer failures cannot change runtime state.
      }
    }

    storageListener = event => {
      if (!storageListenerRegistered) return
      if (event?.storageArea !== undefined
        && event.storageArea !== null
        && event.storageArea !== storage) return
      if (event?.key === null) {
        markRuntimeLeaseLost(runtimeError(
          "Local storage was cleared while this work was open.",
          "mutation-lease-lost",
          undefined,
          { workId },
        ))
        return
      }
      const ownerKey = getWorkOwnerKey(workId)
      if (event?.key === ownerKey) {
        try {
          const owner = readWorkOwner(workId, storage)
          const current = activeSession
          if (owner === null
            || current === null
            || owner.ownerId !== current.ownerId
            || owner.leaseId !== current.leaseId) {
            markRuntimeLeaseLost(runtimeError(
              "The current work owner record changed.",
              "mutation-lease-lost",
              undefined,
              { workId },
            ))
          }
        } catch (cause) {
          markRuntimeLeaseLost(cause)
        }
        return
      }
      if (event?.key === LOCAL_RESTORE_GENERATION_KEY) {
        try {
          const generation = readRestoreGeneration(storage)
          if (generation === null
            || generation.generationId !== expectedRestoreGeneration) {
            markRuntimeLeaseLost(runtimeError(
              "The local restore generation changed.",
              "mutation-lease-lost",
              undefined,
              { workId },
            ))
          }
        } catch (cause) {
          markRuntimeLeaseLost(cause)
        }
        return
      }
      if (typeof event?.key === "string"
        && event.key.startsWith("tuuru:work-owner:")) {
        refreshOtherActiveEditors()
        return
      }
      if (event?.key !== LOCAL_DATABASE_KEY) return
      try {
        const latest = readInitialCandidate(storage, workId)
        if (latest.work === null || latest.workToken !== expectedWorkToken) {
          markExternalConflict()
          return
        }
        verifiedRaw = latest.raw
        verifiedDatabase = latest.database
        verifiedWork = latest.work
      } catch (cause) {
        markExternalConflict(cause)
      }
    }
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("storage", storageListener)
      storageListenerRegistered = true
    }

    function removeStorageListener() {
      if (!storageListenerRegistered) return
      storageListenerRegistered = false
      try {
        globalThis.removeEventListener?.("storage", storageListener)
      } catch {
        // Listener teardown cannot prevent releasing the owned edit session.
      }
    }

    function stage(operation) {
      assertRuntimeWritable()
      return coordinator.stage(operation)
    }

    function commitNow(operation) {
      assertRuntimeWritable()
      return coordinator.commitNow(operation)
    }

    function runPublicCoordinatorAction(method) {
      try {
        assertRuntimeWritable()
      } catch (error) {
        return Promise.reject(error)
      }
      return coordinator[method]()
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function")
      runtimeListeners.add(listener)
      try {
        listener(wrappedSnapshot())
      } catch {
        // Observer failures cannot change runtime state.
      }
      let active = true
      return () => {
        if (!active) return
        active = false
        runtimeListeners.delete(listener)
      }
    }

    function prepareEmergencyBackup() {
      const saveSnapshot = wrappedSnapshot()
      const identity = emergencyIdentityForGeneration(saveSnapshot.generation)
      return prepareEmergencyLocalDatabaseBackup({
        storage,
        workId,
        saveSnapshot,
        lastValidRaw: verifiedRaw,
        localCandidateRaw: buildEmergencyLocalCandidateRaw(),
        now: identity.now,
        recoveryWorkId: identity.recoveryWorkId,
      })
    }

    function suspend() {
      if (lifecycleState === "suspending" && suspendPromise !== null) {
        return suspendPromise
      }
      const terminalError = currentTerminalError()
      if (terminalError !== null) return Promise.reject(terminalError)
      if (lifecycleState !== "active") return Promise.reject(lifecycleFailure())
      lifecycleState = "suspending"
      lifecycleGateError = null
      resumePromise = null
      const operation = (async () => {
        try {
          await coordinator.drain()
        } catch {
          // Draining is best effort; the coordinator retains recovery material.
        } finally {
          const closingSession = activeSession
          activeSession = null
          try {
            await closingSession?.dispose()
          } catch {
            // Native handles still release; retained coordinator state is primary.
          }
          if (lifecycleState === "suspending") {
            lifecycleState = "suspended"
            lifecycleGateError = null
          }
        }
        return wrappedSnapshot()
      })()
      suspendPromise = operation
      void operation.then(
        () => {
          if (suspendPromise === operation) suspendPromise = null
        },
        () => {
          if (suspendPromise === operation) suspendPromise = null
        },
      )
      return suspendPromise
    }

    function resume() {
      if (resumePromise !== null) return resumePromise
      if (lifecycleState === "active") return Promise.resolve(wrappedSnapshot())
      if (lifecycleState !== "suspended") return Promise.reject(lifecycleFailure())
      const existingTerminalError = currentTerminalError()
      if (existingTerminalError !== null) return Promise.reject(existingTerminalError)
      lifecycleState = "resuming"
      lifecycleGateError = null
      const operation = (async () => {
        let provisional = null
        try {
          const result = await openWorkEditSession({
            workId,
            storage,
            lockManager,
            scheduler,
            now,
            createId,
            takeover: false,
          })
          if (!result.ok) throw result.error
          provisional = result.session
          const terminalBeforeRead = currentTerminalError()
          if (terminalBeforeRead !== null) throw terminalBeforeRead
          const latest = readInitialCandidate(storage, workId)
          if (latest.work === null
            || provisional.restoreGeneration !== expectedRestoreGeneration
            || latest.workToken !== expectedWorkToken) {
            throw runtimeError(
              "The work or restore generation changed while the page was suspended.",
              "mutation-lease-lost",
              undefined,
              { workId },
            )
          }
          await Promise.resolve()
          provisional.assertWritable()
          const terminalBeforePublish = currentTerminalError()
          if (terminalBeforePublish !== null) throw terminalBeforePublish
          if (lifecycleState !== "resuming") throw lifecycleFailure()
          verifiedRaw = latest.raw
          verifiedDatabase = latest.database
          verifiedWork = latest.work
          activeSession = provisional
          provisional = null
          lifecycleState = "active"
          lifecycleGateError = null
          suspendPromise = null
          refreshOtherActiveEditors()
          return wrappedSnapshot()
        } catch (cause) {
          try {
            await provisional?.dispose()
          } catch {
            // The resume failure remains primary.
          }
          if (lifecycleState === "disposing" || lifecycleState === "disposed") {
            throw lifecycleFailure()
          }
          lifecycleState = "suspended"
          lifecycleGateError = null
          const terminalError = currentTerminalError()
          if (terminalError !== null) {
            announceRuntimeSnapshot()
            throw terminalError
          }
          const preservesOperationalCode = cause?.code === "mutation-lease-lost"
            || cause?.code === "work-locked"
            || cause?.code === "mutation-lock-unavailable"
          const error = preservesOperationalCode
            ? cause
            : runtimeError(
                "Unable to resume the work runtime safely.",
                "mutation-lease-lost",
                cause,
                { workId },
              )
          coordinator.markLeaseLost(error)
          announceRuntimeSnapshot()
          throw error
        }
      })()
      resumePromise = operation
      void operation.then(
        () => {
          if (resumePromise === operation) resumePromise = null
        },
        () => {
          if (resumePromise === operation) resumePromise = null
        },
      )
      return resumePromise
    }

    function dispose() {
      if (disposePromise !== null) return disposePromise
      lifecycleState = "disposing"
      lifecycleGateError = null
      disposePromise = (async () => {
        const pendingResume = resumePromise
        if (pendingResume !== null) {
          try {
            await pendingResume
          } catch {
            // A concurrent resume must settle and release its provisional session.
          }
        }
        if (suspendPromise !== null) {
          try {
            await suspendPromise
          } catch {
            // Continue deterministic teardown.
          }
        } else if (activeSession !== null) {
          try {
            await coordinator.drain()
          } catch {
            // Disposal is best effort and recovery material remains on the coordinator.
          }
        }
        runtimeOverride = null
        try {
          await coordinator.dispose()
        } catch {
          // Coordinator disposal is designed to settle; continue releasing ownership.
        }
        removeCoordinatorSubscription?.()
        removeCoordinatorSubscription = null
        removeStorageListener()
        runtimeListeners.clear()
        const closingSession = activeSession
        activeSession = null
        try {
          await closingSession?.dispose()
        } catch {
          // Exact-self cleanup is best effort; native handles still release.
        }
        lifecycleState = "disposed"
        lifecycleGateError = null
        return wrappedSnapshot()
      })()
      return disposePromise
    }

    const runtime = Object.freeze({
      workId,
      readWork() {
        return cloneJson(buildOrdinaryPendingCandidate())
      },
      stage,
      commitNow,
      flush: () => runPublicCoordinatorAction("flush"),
      drain: () => runPublicCoordinatorAction("drain"),
      retry: () => runPublicCoordinatorAction("retry"),
      recheck: () => runPublicCoordinatorAction("recheck"),
      snapshot: wrappedSnapshot,
      recoveryMaterial: coordinator.recoveryMaterial,
      subscribe,
      prepareEmergencyBackup,
      suspend,
      resume,
      dispose,
    })
    return Object.freeze({ ok: true, runtime })
  } catch (cause) {
    try {
      await coordinator?.dispose()
    } catch {
      // The initialization failure remains primary.
    }
    try {
      removeCoordinatorSubscription?.()
    } catch {
      // The initialization failure remains primary.
    }
    if (storageListenerRegistered) {
      try {
        globalThis.removeEventListener?.("storage", storageListener)
      } catch {
        // The initialization failure remains primary.
      }
      storageListenerRegistered = false
    }
    try {
      await disposeAfterFailedInitialization(session)
    } catch {
      // The initialization failure remains primary; session disposal is best effort.
    }
    const error = runtimeError(
      "Unable to initialize the reliable work runtime.",
      "runtime-init-failed",
      cause,
      { workId },
    )
    return failureResult(
      "runtime-init-failed",
      error,
      candidate?.work ?? readableWork,
      "conflict",
    )
  }
}
