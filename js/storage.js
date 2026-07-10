const DATABASE_KEY = "tuuru_works"

export const LOCAL_DATABASE_BACKUP_FORMAT = "tuuru-local-library-backup"
export const LOCAL_DATABASE_BACKUP_VERSION = 1

function createEmptyDatabase() {
  return { works: [], contacts: [], groups: [] }
}

function describeError(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

export class LocalDatabaseError extends Error {
  constructor(message, code, cause) {
    super(message)
    this.name = "LocalDatabaseError"
    this.code = code
    if (cause) this.cause = cause
  }
}

export function inspectLocalDatabase(storage = localStorage) {
  let raw

  try {
    raw = storage.getItem(DATABASE_KEY)
  } catch (error) {
    return {
      ok: false,
      code: "storage-unavailable",
      raw: null,
      message: describeError(error, "浏览器无法读取本地作品数据。"),
    }
  }

  if (raw === null) {
    return { ok: true, data: createEmptyDatabase(), raw: null }
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch (error) {
    return {
      ok: false,
      code: "invalid-json",
      raw,
      message: describeError(error, "本地作品数据不是有效的 JSON。"),
    }
  }

  if (!data || Array.isArray(data) || typeof data !== "object" || !Array.isArray(data.works)) {
    return {
      ok: false,
      code: "invalid-structure",
      raw,
      message: "本地作品数据缺少有效的 works 数组。",
    }
  }

  return {
    ok: true,
    raw,
    data: {
      ...data,
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
    },
  }
}

function integrityError(status) {
  return new LocalDatabaseError(
    "本地作品数据已损坏。为防止覆盖原始数据，当前写入已被阻止。",
    status.code,
  )
}

export function readLocalDatabase(storage = localStorage) {
  const status = inspectLocalDatabase(storage)
  if (!status.ok) throw integrityError(status)
  return status.data
}

export function writeLocalDatabase(data, storage = localStorage) {
  const current = inspectLocalDatabase(storage)
  if (!current.ok) throw integrityError(current)

  if (!data || Array.isArray(data) || typeof data !== "object" || !Array.isArray(data.works)) {
    throw new LocalDatabaseError("拒绝写入无效的作品数据库。", "invalid-write")
  }

  try {
    storage.setItem(DATABASE_KEY, JSON.stringify(data))
  } catch (error) {
    throw new LocalDatabaseError(
      "作品保存失败。请检查浏览器存储空间并立即导出备份。",
      "write-failed",
      error,
    )
  }
}

export function serializeLocalDatabaseBackup(storage = localStorage, exportedAt = new Date()) {
  const database = readLocalDatabase(storage)

  try {
    return JSON.stringify({
      format: LOCAL_DATABASE_BACKUP_FORMAT,
      backupVersion: LOCAL_DATABASE_BACKUP_VERSION,
      exportedAt: exportedAt.toISOString(),
      database,
    }, null, 2)
  } catch (error) {
    throw new LocalDatabaseError(
      "无法创建完整创作库备份。请确认浏览器仍有足够可用内存。",
      "backup-failed",
      error,
    )
  }
}

export function discardCorruptLocalDatabase(storage = localStorage) {
  const status = inspectLocalDatabase(storage)
  if (status.ok) {
    throw new LocalDatabaseError("当前作品数据库有效，拒绝执行损坏数据重置。", "database-valid")
  }

  if (status.code === "storage-unavailable") {
    throw new LocalDatabaseError("无法确认本地数据是否损坏，拒绝执行重置。", status.code)
  }

  try {
    storage.removeItem(DATABASE_KEY)
  } catch (error) {
    throw new LocalDatabaseError("无法重置本地作品数据。", "reset-failed", error)
  }
}
