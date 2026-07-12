import {
  LOCAL_DATABASE_KEY,
  LocalDatabaseError,
  inspectLocalDatabaseRaw,
  serializeValidatedLocalDatabase,
} from "./storage.js"
import {
  DATABASE_WRITE_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
} from "./local-locks.js"

function notImplemented() {
  throw new Error("Local database mutation is not implemented")
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

function normalizeCommitArgs(args) {
  assertRecord(args, "args")
  for (const key of ["operationId", "workId", "ownerId", "leaseId", "expectedWorkToken"]) {
    assertIdentifier(args[key], key)
  }
  if (args.restoreGeneration !== null) {
    assertIdentifier(args.restoreGeneration, "restoreGeneration")
  }
  assertFunction(args.apply, "apply")
  return args
}

function normalizeDependencies(dependencies) {
  assertRecord(dependencies, "dependencies")
  const storage = dependencies.storage ?? globalThis.localStorage
  const lockManager = dependencies.lockManager ?? createWebLocksAdapter()
  assertRecord(storage, "storage")
  assertFunction(storage.getItem, "storage.getItem")
  assertFunction(storage.setItem, "storage.setItem")
  assertRecord(lockManager, "lockManager")
  assertFunction(lockManager.request, "lockManager.request")
  assertFunction(dependencies.assertSessionAdmission, "assertSessionAdmission")
  assertFunction(dependencies.assertOwnerFence, "assertOwnerFence")
  return {
    storage,
    lockManager,
    assertSessionAdmission: dependencies.assertSessionAdmission,
    assertOwnerFence: dependencies.assertOwnerFence,
  }
}

function mutationError(message, code, cause, details) {
  const availableDetails = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  )
  return new LocalDatabaseError(message, code, cause, availableDetails)
}

function getUniqueTargetWork(database, workId, details, phase = "check-work", commitState = "unchanged") {
  const matches = database.works.filter(work => work.id === workId)
  if (matches.length > 1) {
    throw mutationError(
      `The local database contains duplicate work id "${workId}".`,
      "mutation-invalid",
      undefined,
      {
        ...details,
        phase,
        commitState,
        issues: [{
          code: "duplicate-work-id",
          path: "$.works",
          message: `More than one work uses id "${workId}".`,
        }],
      },
    )
  }
  return matches[0] ?? null
}

async function requestDatabaseLock(lockManager, callback) {
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

async function writeAndVerifyCandidate({
  storage,
  assertOwnerFence,
  candidateRaw,
  prewriteActualRaw,
  operationId,
  workId,
  details,
}) {
  try {
    await assertOwnerFence()
  } catch (cause) {
    throw mutationError(
      "The edit session lost ownership before the local database write.",
      "mutation-lease-lost",
      cause,
      {
        ...details,
        phase: "fence",
        commitState: "unchanged",
        candidateRaw,
        actualRaw: prewriteActualRaw,
      },
    )
  }
  try {
    storage.setItem(LOCAL_DATABASE_KEY, candidateRaw)
  } catch (cause) {
    throw mutationError(
      "Unable to write the local database mutation.",
      "mutation-write-failed",
      cause,
      {
        ...details,
        phase: "write",
        commitState: "unchanged",
        candidateRaw,
        actualRaw: prewriteActualRaw,
      },
    )
  }

  let readback
  try {
    readback = storage.getItem(LOCAL_DATABASE_KEY)
  } catch (cause) {
    throw mutationError(
      "Unable to read back the local database mutation.",
      "mutation-readback-failed",
      cause,
      {
        ...details,
        phase: "readback",
        commitState: "unknown",
        candidateRaw,
      },
    )
  }
  if (readback !== candidateRaw) {
    const readbackStatus = inspectLocalDatabaseRaw(readback)
    throw mutationError(
      "The local database mutation could not be verified exactly.",
      "mutation-verification-failed",
      undefined,
      {
        ...details,
        phase: "verify",
        commitState: "unknown",
        candidateRaw,
        actualRaw: readback,
        issues: readbackStatus.ok ? undefined : readbackStatus.issues,
      },
    )
  }
  const verifiedStatus = inspectLocalDatabaseRaw(readback)
  if (!verifiedStatus.ok) {
    throw mutationError(
      "The local database mutation readback is invalid.",
      "mutation-verification-failed",
      undefined,
      {
        ...details,
        phase: "verify",
        commitState: "unknown",
        candidateRaw,
        actualRaw: readback,
        issues: verifiedStatus.issues,
      },
    )
  }

  return Object.freeze({
    ok: true,
    operationId,
    raw: candidateRaw,
    database: verifiedStatus.data,
    workToken: createJsonToken(getUniqueTargetWork(
      verifiedStatus.data,
      workId,
      { ...details, candidateRaw, actualRaw: readback },
      "verify",
      "unknown",
    )),
  })
}

export async function commitLocalDatabaseMutation(args, dependencies = {}) {
  const normalizedArgs = normalizeCommitArgs(args)
  const normalizedDependencies = normalizeDependencies(dependencies)
  const {
    operationId,
    workId,
    expectedWorkToken,
    apply,
  } = normalizedArgs
  const {
    storage,
    lockManager,
    assertSessionAdmission,
    assertOwnerFence,
  } = normalizedDependencies
  const baseDetails = { operationId, workId }

  return requestDatabaseLock(lockManager, async () => {
    try {
      await assertSessionAdmission()
    } catch (cause) {
      throw mutationError(
        "The edit session lost admission to the local database.",
        "mutation-lease-lost",
        cause,
        { ...baseDetails, phase: "admission", commitState: "unchanged" },
      )
    }
    let expectedCurrentRaw
    try {
      expectedCurrentRaw = storage.getItem(LOCAL_DATABASE_KEY)
    } catch (cause) {
      throw mutationError(
        "Unable to read the current local database.",
        "mutation-read-failed",
        cause,
        { ...baseDetails, phase: "read-source", commitState: "unchanged" },
      )
    }
    const currentStatus = inspectLocalDatabaseRaw(expectedCurrentRaw)
    if (!currentStatus.ok) {
      throw mutationError(
        "The current local database is invalid.",
        "mutation-invalid",
        undefined,
        {
          ...baseDetails,
          phase: "validate-source",
          commitState: "unchanged",
          expectedCurrentRaw,
          actualRaw: expectedCurrentRaw,
          issues: currentStatus.issues,
        },
      )
    }

    const sourceDetails = { ...baseDetails, expectedCurrentRaw }
    const currentTarget = getUniqueTargetWork(currentStatus.data, workId, sourceDetails)
    if (createJsonToken(currentTarget) !== expectedWorkToken) {
      throw mutationError(
        "The target work changed before the mutation started.",
        "mutation-conflict",
        undefined,
        { ...sourceDetails, phase: "check-work", commitState: "unchanged" },
      )
    }

    let candidate
    try {
      candidate = apply(currentStatus.data)
    } catch (cause) {
      throw mutationError(
        "The local database mutation could not be applied.",
        "mutation-invalid",
        cause,
        { ...sourceDetails, phase: "apply", commitState: "unchanged" },
      )
    }

    let candidateRaw
    try {
      candidateRaw = serializeValidatedLocalDatabase(candidate)
    } catch (cause) {
      throw mutationError(
        "The local database mutation produced an invalid candidate.",
        "mutation-invalid",
        cause,
        {
          ...sourceDetails,
          phase: "validate-candidate",
          commitState: "unchanged",
          issues: cause?.details?.issues,
        },
      )
    }
    const candidateStatus = inspectLocalDatabaseRaw(candidateRaw)
    getUniqueTargetWork(
      candidateStatus.data,
      workId,
      { ...sourceDetails, candidateRaw },
      "validate-candidate",
    )
    let actualRaw
    try {
      actualRaw = storage.getItem(LOCAL_DATABASE_KEY)
    } catch (cause) {
      throw mutationError(
        "Unable to recheck the current local database.",
        "mutation-read-failed",
        cause,
        {
          ...sourceDetails,
          phase: "recheck-source",
          commitState: "unchanged",
          candidateRaw,
        },
      )
    }
    if (actualRaw !== expectedCurrentRaw) {
      throw mutationError(
        "The local database changed before the mutation could be written.",
        "mutation-conflict",
        undefined,
        {
          ...sourceDetails,
          phase: "recheck-source",
          commitState: "unchanged",
          candidateRaw,
          actualRaw,
        },
      )
    }

    return writeAndVerifyCandidate({
      storage,
      assertOwnerFence,
      candidateRaw,
      prewriteActualRaw: actualRaw,
      operationId,
      workId,
      details: sourceDetails,
    })
  })
}

function normalizePreparedArgs(args) {
  assertRecord(args, "args")
  for (const key of ["operationId", "workId", "ownerId", "leaseId"]) {
    assertIdentifier(args[key], key)
  }
  if (args.restoreGeneration !== null) {
    assertIdentifier(args.restoreGeneration, "restoreGeneration")
  }
  if (args.expectedCurrentRaw !== null && typeof args.expectedCurrentRaw !== "string") {
    throw new TypeError("expectedCurrentRaw must be a string or null")
  }
  if (typeof args.candidateRaw !== "string") {
    throw new TypeError("candidateRaw must be a string")
  }
  if (Object.hasOwn(args, "apply")) {
    throw new TypeError("prepared candidates do not accept apply")
  }
  return args
}

export async function commitPreparedLocalDatabaseCandidate(args, dependencies = {}) {
  const normalizedArgs = normalizePreparedArgs(args)
  const {
    operationId,
    workId,
    expectedCurrentRaw,
    candidateRaw,
  } = normalizedArgs
  const inputDetails = { operationId, workId, expectedCurrentRaw, candidateRaw }
  validateSuppliedRaw(expectedCurrentRaw, workId, inputDetails)
  validateSuppliedRaw(candidateRaw, workId, inputDetails)
  const {
    storage,
    lockManager,
    assertSessionAdmission,
    assertOwnerFence,
  } = normalizeDependencies(dependencies)

  return requestDatabaseLock(lockManager, async () => {
    try {
      await assertSessionAdmission()
    } catch (cause) {
      throw mutationError(
        "The edit session lost admission before the prepared write.",
        "mutation-lease-lost",
        cause,
        { ...inputDetails, phase: "admission", commitState: "unchanged" },
      )
    }

    let actualRaw
    try {
      actualRaw = storage.getItem(LOCAL_DATABASE_KEY)
    } catch (cause) {
      throw mutationError(
        "Unable to read the local database before the prepared write.",
        "mutation-read-failed",
        cause,
        { ...inputDetails, phase: "read-source", commitState: "unchanged" },
      )
    }
    if (actualRaw !== expectedCurrentRaw) {
      throw mutationError(
        "The local database changed before the prepared write.",
        "mutation-conflict",
        undefined,
        {
          ...inputDetails,
          phase: "check-source",
          commitState: "unchanged",
          actualRaw,
        },
      )
    }

    return writeAndVerifyCandidate({
      storage,
      assertOwnerFence,
      candidateRaw,
      prewriteActualRaw: actualRaw,
      operationId,
      workId,
      details: inputDetails,
    })
  })
}

function normalizeRecheckArgs(args) {
  assertRecord(args, "args")
  for (const key of ["workId", "ownerId", "leaseId"]) assertIdentifier(args[key], key)
  if (args.restoreGeneration !== null) {
    assertIdentifier(args.restoreGeneration, "restoreGeneration")
  }
  if (args.expectedCurrentRaw !== null && typeof args.expectedCurrentRaw !== "string") {
    throw new TypeError("expectedCurrentRaw must be a string or null")
  }
  if (typeof args.candidateRaw !== "string") {
    throw new TypeError("candidateRaw must be a string")
  }
  return args
}

function normalizeRecheckDependencies(dependencies) {
  assertRecord(dependencies, "dependencies")
  const storage = dependencies.storage ?? globalThis.localStorage
  const lockManager = dependencies.lockManager ?? createWebLocksAdapter()
  assertRecord(storage, "storage")
  assertFunction(storage.getItem, "storage.getItem")
  assertRecord(lockManager, "lockManager")
  assertFunction(lockManager.request, "lockManager.request")
  assertFunction(dependencies.assertSessionAdmission, "assertSessionAdmission")
  return {
    storage,
    lockManager,
    assertSessionAdmission: dependencies.assertSessionAdmission,
  }
}

function validateSuppliedRaw(raw, workId, details) {
  const status = inspectLocalDatabaseRaw(raw)
  if (!status.ok) {
    throw mutationError(
      "A supplied local database value is invalid.",
      "mutation-invalid",
      undefined,
      {
        ...details,
        phase: "validate-input",
        commitState: "unchanged",
        actualRaw: raw,
        issues: status.issues,
      },
    )
  }
  getUniqueTargetWork(status.data, workId, details, "validate-input", "unchanged")
  return status
}

function freezeRecheckResult(raw, status, workId, details) {
  const target = getUniqueTargetWork(status.data, workId, details, "recheck-validate", "unknown")
  return Object.freeze({
    raw,
    database: status.data,
    workToken: createJsonToken(target),
  })
}

export async function recheckUnknownLocalDatabaseCommit(args, dependencies = {}) {
  const normalizedArgs = normalizeRecheckArgs(args)
  const {
    workId,
    expectedCurrentRaw,
    candidateRaw,
  } = normalizedArgs
  const inputDetails = { workId, expectedCurrentRaw, candidateRaw }
  validateSuppliedRaw(expectedCurrentRaw, workId, inputDetails)
  validateSuppliedRaw(candidateRaw, workId, inputDetails)
  const {
    storage,
    lockManager,
    assertSessionAdmission,
  } = normalizeRecheckDependencies(dependencies)

  return requestDatabaseLock(lockManager, async () => {
    try {
      await assertSessionAdmission()
    } catch (cause) {
      throw mutationError(
        "The edit session lost admission before the unknown commit recheck.",
        "mutation-lease-lost",
        cause,
        { ...inputDetails, phase: "admission", commitState: "unchanged" },
      )
    }

    let actualRaw
    try {
      actualRaw = storage.getItem(LOCAL_DATABASE_KEY)
    } catch (cause) {
      throw mutationError(
        "Unable to read the local database while rechecking an unknown commit.",
        "mutation-readback-failed",
        cause,
        { ...inputDetails, phase: "recheck-read", commitState: "unknown" },
      )
    }

    if (actualRaw === candidateRaw) {
      const status = inspectLocalDatabaseRaw(actualRaw)
      if (!status.ok) {
        throw mutationError(
          "The saved local database candidate is invalid.",
          "mutation-invalid",
          undefined,
          {
            ...inputDetails,
            phase: "recheck-validate",
            commitState: "unknown",
            actualRaw,
            issues: status.issues,
          },
        )
      }
      return Object.freeze({
        outcome: "saved",
        result: freezeRecheckResult(actualRaw, status, workId, inputDetails),
      })
    }
    if (actualRaw === expectedCurrentRaw) {
      return Object.freeze({ outcome: "not-written" })
    }

    const status = inspectLocalDatabaseRaw(actualRaw)
    if (!status.ok) {
      throw mutationError(
        "The local database is corrupt while rechecking an unknown commit.",
        "mutation-invalid",
        undefined,
        {
          ...inputDetails,
          phase: "recheck-validate",
          commitState: "unknown",
          actualRaw,
          issues: status.issues,
        },
      )
    }
    return Object.freeze({
      outcome: "conflict",
      result: freezeRecheckResult(actualRaw, status, workId, inputDetails),
    })
  })
}

function canonicalizeJsonValue(value, active) {
  if (value === null) return ["null"]
  if (typeof value === "string") return ["string", value]
  if (typeof value === "boolean") return ["boolean", value]
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JSON token numbers must be finite")
    return ["number", Object.is(value, -0) ? 0 : value]
  }
  if (typeof value !== "object") {
    throw new TypeError("JSON tokens require JSON-compatible values")
  }
  if (active.has(value)) throw new RangeError("JSON tokens do not support cyclic values")

  active.add(value)
  try {
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "symbol") throw new TypeError("JSON arrays cannot have symbol fields")
        if (key === "length") continue
        const index = Number(key)
        if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key) {
          throw new TypeError("JSON arrays cannot have named fields")
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (!descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined) {
          throw new TypeError("JSON arrays require ordinary indexed values")
        }
      }
      const items = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError("JSON arrays cannot be sparse")
        items.push(canonicalizeJsonValue(value[index], active))
      }
      return ["array", items]
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("JSON tokens require plain objects")
    }
    const entries = []
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") throw new TypeError("JSON objects cannot have symbol fields")
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new TypeError("JSON objects require ordinary enumerable fields")
      }
      entries.push([key, descriptor.value])
    }
    entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return [
      "object",
      entries.map(([key, child]) => [key, canonicalizeJsonValue(child, active)]),
    ]
  } finally {
    active.delete(value)
  }
}

export function createJsonToken(value) {
  return JSON.stringify(canonicalizeJsonValue(value, new WeakSet()))
}
