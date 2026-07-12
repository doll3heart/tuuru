export const LOCAL_RESTORE_GENERATION_KEY = "tuuru:restore-generation"
const WORK_OWNER_KEY_PREFIX = "tuuru:work-owner:"
const METADATA_VERSION = 1
const DEFAULT_STALE_MS = 60_000

const GENERATION_FIELDS = ["version", "generationId", "changedAt"]
const OWNER_FIELDS = [
  "version",
  "workId",
  "ownerId",
  "leaseId",
  "heartbeatAt",
  "expiresAt",
]

export class LocalWriteMetadataError extends Error {
  constructor(message, code, cause, details) {
    super(message)
    this.name = "LocalWriteMetadataError"
    this.code = code
    this.cause = cause
    this.details = details
  }
}

function metadataError(code, cause, details) {
  return new LocalWriteMetadataError(code, code, cause, details)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function assertRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`)
}

function assertIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function assertTimestamp(value, name) {
  if (typeof value !== "number") throw new TypeError(`${name} must be a number`)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
}

function assertExactFields(value, fields, name) {
  const keys = Object.keys(value)
  if (keys.length !== fields.length || !fields.every(field => Object.hasOwn(value, field))) {
    throw new TypeError(`${name} has invalid fields`)
  }
}

function assertOptionalVersion(input) {
  if (Object.hasOwn(input, "version") && input.version !== METADATA_VERSION) {
    throw new TypeError("version must be exactly 1 when provided")
  }
}

function computedExpiry(heartbeatAt) {
  if (heartbeatAt > Number.MAX_SAFE_INTEGER - DEFAULT_STALE_MS) {
    throw new RangeError("expiresAt must remain a safe integer")
  }
  return heartbeatAt + DEFAULT_STALE_MS
}

function normalizeGeneration(value, exactFields) {
  assertRecord(value, "restore generation")
  if (exactFields) assertExactFields(value, GENERATION_FIELDS, "restore generation")
  if (exactFields) {
    if (value.version !== METADATA_VERSION) throw new TypeError("unsupported metadata version")
  } else {
    assertOptionalVersion(value)
  }
  assertIdentifier(value.generationId, "generationId")
  assertTimestamp(value.changedAt, "changedAt")
  return Object.freeze({
    version: METADATA_VERSION,
    generationId: value.generationId,
    changedAt: value.changedAt,
  })
}

function normalizeOwner(value, exactFields, key) {
  assertRecord(value, "work owner")
  if (exactFields) assertExactFields(value, OWNER_FIELDS, "work owner")
  if (exactFields) {
    if (value.version !== METADATA_VERSION) throw new TypeError("unsupported metadata version")
  } else {
    assertOptionalVersion(value)
  }
  assertIdentifier(value.workId, "workId")
  assertIdentifier(value.ownerId, "ownerId")
  assertIdentifier(value.leaseId, "leaseId")
  assertTimestamp(value.heartbeatAt, "heartbeatAt")
  const expiresAt = computedExpiry(value.heartbeatAt)

  if (exactFields || Object.hasOwn(value, "expiresAt")) {
    assertTimestamp(value.expiresAt, "expiresAt")
    if (value.expiresAt !== expiresAt) {
      throw new RangeError("expiresAt must equal heartbeatAt + 60000")
    }
  }

  if (key !== undefined && getWorkOwnerKey(value.workId) !== key) {
    throw new TypeError("work owner key does not match workId")
  }

  return Object.freeze({
    version: METADATA_VERSION,
    workId: value.workId,
    ownerId: value.ownerId,
    leaseId: value.leaseId,
    heartbeatAt: value.heartbeatAt,
    expiresAt,
  })
}

function parseRecord(raw, key, normalize) {
  let parsed
  try {
    if (typeof raw !== "string") throw new TypeError("stored metadata must be a string")
    parsed = JSON.parse(raw)
    return normalize(parsed)
  } catch (cause) {
    throw metadataError("metadata-corrupt", cause, { key, raw })
  }
}

function parseGeneration(raw, key = LOCAL_RESTORE_GENERATION_KEY) {
  return parseRecord(raw, key, value => normalizeGeneration(value, true))
}

function parseOwner(raw, key) {
  return parseRecord(raw, key, value => normalizeOwner(value, true, key))
}

function readRaw(storage, key) {
  try {
    return storage.getItem(key)
  } catch (cause) {
    throw metadataError("metadata-read-failed", cause, { key })
  }
}

function verifyWrite(storage, key, raw, parse) {
  try {
    storage.setItem(key, raw)
  } catch (cause) {
    throw metadataError("metadata-write-failed", cause, { key })
  }

  let actualRaw
  try {
    actualRaw = storage.getItem(key)
  } catch (cause) {
    throw metadataError("metadata-readback-failed", cause, { key })
  }

  if (actualRaw !== raw) {
    throw metadataError("metadata-verification-failed", undefined, {
      key,
      expectedRaw: raw,
      actualRaw,
    })
  }

  try {
    return parse(actualRaw, key)
  } catch (cause) {
    throw metadataError("metadata-verification-failed", cause, {
      key,
      expectedRaw: raw,
      actualRaw,
    })
  }
}

function compareStrings(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function getWorkOwnerKey(workId) {
  assertIdentifier(workId, "workId")
  return `${WORK_OWNER_KEY_PREFIX}${encodeURIComponent(workId)}`
}

export function readRestoreGeneration(storage = localStorage) {
  const raw = readRaw(storage, LOCAL_RESTORE_GENERATION_KEY)
  if (raw === null) return null
  return parseGeneration(raw)
}

export function writeAndVerifyRestoreGeneration(input, storage = localStorage) {
  const record = normalizeGeneration(input, false)
  const raw = JSON.stringify(record)
  return verifyWrite(storage, LOCAL_RESTORE_GENERATION_KEY, raw, parseGeneration)
}

export function readWorkOwner(workId, storage = localStorage) {
  const key = getWorkOwnerKey(workId)
  const raw = readRaw(storage, key)
  if (raw === null) return null
  return parseOwner(raw, key)
}

export function writeAndVerifyWorkOwner(input, storage = localStorage) {
  const record = normalizeOwner(input, false)
  const key = getWorkOwnerKey(record.workId)
  const raw = JSON.stringify(record)
  return verifyWrite(storage, key, raw, parseOwner)
}

export function clearWorkOwnerIfOwned(
  workId,
  ownerId,
  leaseId,
  storage = localStorage,
) {
  assertIdentifier(workId, "workId")
  assertIdentifier(ownerId, "ownerId")
  assertIdentifier(leaseId, "leaseId")
  const key = getWorkOwnerKey(workId)
  const record = readWorkOwner(workId, storage)

  if (record === null || record.ownerId !== ownerId || record.leaseId !== leaseId) return false

  try {
    storage.removeItem(key)
  } catch (cause) {
    throw metadataError("metadata-remove-failed", cause, { key })
  }

  let actualRaw
  try {
    actualRaw = storage.getItem(key)
  } catch (cause) {
    throw metadataError("metadata-clear-verification-failed", cause, { key })
  }
  if (actualRaw !== null) {
    throw metadataError("metadata-clear-verification-failed", undefined, { key, actualRaw })
  }
  return true
}

export function isWorkOwnerStale(record, now, staleMs = DEFAULT_STALE_MS) {
  const normalized = normalizeOwner(record, true)
  assertTimestamp(now, "now")
  assertTimestamp(staleMs, "staleMs")
  return now - normalized.heartbeatAt >= staleMs && now >= normalized.expiresAt
}

export function listActiveWorkOwners(storage = localStorage, now = Date.now()) {
  assertTimestamp(now, "now")

  let length
  try {
    length = storage.length
  } catch (cause) {
    throw metadataError("metadata-read-failed", cause, { operation: "length" })
  }
  if (!Number.isSafeInteger(length) || length < 0) {
    throw metadataError("metadata-read-failed", undefined, { operation: "length", length })
  }

  const matchingKeys = []
  for (let index = 0; index < length; index += 1) {
    let key
    try {
      key = storage.key(index)
    } catch (cause) {
      throw metadataError("metadata-read-failed", cause, { operation: "key", index })
    }
    if (typeof key === "string" && key.startsWith(WORK_OWNER_KEY_PREFIX)) {
      matchingKeys.push(key)
    }
  }
  matchingKeys.sort(compareStrings)

  const active = []
  for (const key of matchingKeys) {
    const raw = readRaw(storage, key)
    if (raw === null) continue
    const record = parseOwner(raw, key)
    if (!isWorkOwnerStale(record, now)) active.push(record)
  }

  active.sort((left, right) => (
    compareStrings(left.workId, right.workId)
    || compareStrings(left.ownerId, right.ownerId)
    || compareStrings(left.leaseId, right.leaseId)
  ))
  return active
}
