export const EXPORT_HISTORY_KEY = "tuuru_export_history"
export const MAX_EXPORT_HISTORY_RECORDS = 120

const VALID_FORMATS = new Set(["tuuru", "png"])
const VALID_ENTITY_TYPES = new Set(["work", "collection"])
const VALID_DELIVERIES = new Set(["shared", "downloaded"])

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const id = typeof value.id === "string" ? value.id.trim().slice(0, 200) : ""
  const entityId = typeof value.entityId === "string" ? value.entityId.trim().slice(0, 200) : ""
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 300) : ""
  if (
    !id
    || !entityId
    || !title
    || !VALID_FORMATS.has(value.format)
    || !VALID_ENTITY_TYPES.has(value.entityType)
    || !VALID_DELIVERIES.has(value.delivery)
  ) return null
  const exportedAt = finiteNumber(value.exportedAt, NaN)
  const revision = finiteNumber(value.revision, NaN)
  if (!Number.isFinite(exportedAt) || !Number.isFinite(revision)) return null
  return Object.freeze({
    id,
    entityType: value.entityType,
    entityId,
    title,
    format: value.format,
    bytes: Math.max(0, Math.floor(finiteNumber(value.bytes))),
    revision,
    exportedAt,
    delivery: value.delivery,
  })
}

export function readExportHistory(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(EXPORT_HISTORY_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeRecord)
      .filter(Boolean)
      .sort((left, right) => right.exportedAt - left.exportedAt)
      .slice(0, MAX_EXPORT_HISTORY_RECORDS)
  } catch {
    return []
  }
}

function writeExportHistory(records, storage) {
  try {
    storage?.setItem(EXPORT_HISTORY_KEY, JSON.stringify(records.slice(0, MAX_EXPORT_HISTORY_RECORDS)))
    return true
  } catch {
    return false
  }
}

function defaultRecordId(now) {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
  } catch {}
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function recordExport(artifact, delivery, {
  storage = globalThis.localStorage,
  now = Date.now,
  createId = defaultRecordId,
} = {}) {
  const exportedAt = finiteNumber(now(), Date.now())
  const record = normalizeRecord({
    id: createId(exportedAt),
    entityType: artifact?.entityType,
    entityId: artifact?.entityId,
    title: artifact?.title,
    format: artifact?.format,
    bytes: artifact?.bytes,
    revision: artifact?.revision,
    exportedAt,
    delivery,
  })
  if (!record) throw new TypeError("导出记录信息无效")
  const records = readExportHistory(storage).filter(existing => existing.id !== record.id)
  writeExportHistory([record, ...records], storage)
  return record
}

export function removeExportRecord(recordId, storage = globalThis.localStorage) {
  const records = readExportHistory(storage)
  const next = records.filter(record => record.id !== recordId)
  if (next.length === records.length) return false
  writeExportHistory(next, storage)
  return true
}

export function clearExportHistory(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(EXPORT_HISTORY_KEY)
  } catch {}
}

export function exportRecordStatus(record, entities = []) {
  const entity = entities.find(candidate => String(candidate?.id) === String(record?.entityId))
  if (!entity) return "missing"
  const revision = Number(entity.updatedAt || entity.createdAt || 1)
  return revision === Number(record.revision) ? "current" : "changed"
}

export function formatExportBytes(value) {
  const bytes = Math.max(0, finiteNumber(value))
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
