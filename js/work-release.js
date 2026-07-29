export const WORK_RELEASE_VERSION = 1

const FINGERPRINT_PATTERN = /^fnv1a32:[0-9a-f]{8}$/
const OMITTED_FINGERPRINT_FIELDS = new Set([
  "editorSettings",
  "readerPhValues",
  "release",
  "updatedAt",
])

function plainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/.test(value)
}

function canonicalValue(value, key = "") {
  if (OMITTED_FINGERPRINT_FIELDS.has(key)) return undefined
  if (Array.isArray(value)) {
    return value.map(item => canonicalValue(item) ?? null)
  }
  if (plainRecord(value)) {
    const result = {}
    for (const childKey of Object.keys(value).sort()) {
      const child = canonicalValue(value[childKey], childKey)
      if (child !== undefined) result[childKey] = child
    }
    return result
  }
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
  ) {
    return value
  }
  return undefined
}

function canonicalExportTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time)) throw new TypeError("作品发布时间无效")
  return date.toISOString()
}

function releaseRevision(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

function fnv1a32(value) {
  const bytes = new TextEncoder().encode(value)
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function workContentFingerprint(work) {
  if (!plainRecord(work)) throw new TypeError("作品内容必须是对象")
  return `fnv1a32:${fnv1a32(JSON.stringify(canonicalValue(work)))}`
}

export function createWorkRelease(work, options = {}) {
  if (!plainRecord(work) || !exactId(work.id)) {
    throw new TypeError("作品缺少有效的永久 ID")
  }
  const revision = releaseRevision(options.revision)
    || releaseRevision(work.updatedAt)
    || releaseRevision(work.createdAt)
    || 1
  return {
    version: WORK_RELEASE_VERSION,
    workId: work.id,
    revision,
    exportedAt: canonicalExportTime(options.exportedAt ?? new Date()),
    fingerprint: workContentFingerprint(work),
  }
}

export function normalizeWorkRelease(value, workId) {
  if (
    !plainRecord(value)
    || value.version !== WORK_RELEASE_VERSION
    || !exactId(workId)
    || value.workId !== workId
    || !releaseRevision(value.revision)
    || typeof value.exportedAt !== "string"
    || typeof value.fingerprint !== "string"
    || !FINGERPRINT_PATTERN.test(value.fingerprint)
  ) {
    return null
  }
  let exportedAt
  try {
    exportedAt = canonicalExportTime(value.exportedAt)
  } catch {
    return null
  }
  if (exportedAt !== value.exportedAt) return null
  return {
    version: WORK_RELEASE_VERSION,
    workId,
    revision: value.revision,
    exportedAt,
    fingerprint: value.fingerprint,
  }
}

export function workReleaseFingerprintMatches(work) {
  if (!plainRecord(work) || !exactId(work.id)) return null
  const release = normalizeWorkRelease(work.release, work.id)
  if (!release) return null
  return workContentFingerprint(work) === release.fingerprint
}

export function classifyWorkRelease(incoming, existing, options = {}) {
  if (!plainRecord(incoming) || !plainRecord(existing)) return "unknown"
  if (!exactId(incoming.id) || !exactId(existing.id) || incoming.id !== existing.id) {
    return "unrelated"
  }
  const incomingRelease = normalizeWorkRelease(incoming.release, incoming.id)
  const existingRelease = normalizeWorkRelease(existing.release, existing.id)
  if (!incomingRelease || !existingRelease) return "unknown"

  if (
    options.verifyContent !== false
    && (
      workReleaseFingerprintMatches(incoming) === false
      || workReleaseFingerprintMatches(existing) === false
    )
  ) {
    return "conflict"
  }
  if (incomingRelease.revision > existingRelease.revision) return "newer"
  if (incomingRelease.revision < existingRelease.revision) return "older"
  return incomingRelease.fingerprint === existingRelease.fingerprint ? "same" : "conflict"
}
