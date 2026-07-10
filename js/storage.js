const DATABASE_KEY = "tuuru_works"

export const LOCAL_DATABASE_BACKUP_FORMAT = "tuuru-local-library-backup"
export const LOCAL_DATABASE_BACKUP_VERSION = 1
export const MAX_LOCAL_DATABASE_BACKUP_BYTES = 25 * 1024 * 1024

const SUPPORTED_LOCAL_DATABASE_BACKUP_VERSIONS = new Set([1])

function createEmptyDatabase() {
  return { works: [], contacts: [], groups: [] }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
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

function backupValidationError(message, code) {
  return new LocalDatabaseError(message, code)
}

export function parseLocalDatabaseBackup(raw) {
  if (typeof raw !== "string") {
    throw backupValidationError("备份内容必须是 JSON 文本。", "invalid-backup-input")
  }

  let backup
  try {
    backup = JSON.parse(raw.replace(/^\uFEFF/, ""))
  } catch (error) {
    throw new LocalDatabaseError("备份文件不是有效的 JSON。", "invalid-backup-json", error)
  }

  if (!isRecord(backup)) {
    throw backupValidationError("备份文件缺少有效的顶层对象。", "invalid-backup-structure")
  }

  if (!Object.hasOwn(backup, "format") || backup.format !== LOCAL_DATABASE_BACKUP_FORMAT) {
    throw backupValidationError("该文件不是 Tuuru 完整创作库备份。", "invalid-backup-format")
  }

  if (!Object.hasOwn(backup, "backupVersion")
    || !Number.isSafeInteger(backup.backupVersion)
    || backup.backupVersion < 1) {
    throw backupValidationError("备份文件缺少有效的格式版本。", "invalid-backup-version")
  }
  if (backup.backupVersion > LOCAL_DATABASE_BACKUP_VERSION) {
    throw backupValidationError("该备份由更新版本的 Tuuru 创建，请升级后再检查。", "backup-version-newer")
  }
  if (!SUPPORTED_LOCAL_DATABASE_BACKUP_VERSIONS.has(backup.backupVersion)) {
    throw backupValidationError("当前版本不支持该备份格式。", "backup-version-unsupported")
  }

  const exportedAt = Object.hasOwn(backup, "exportedAt") && typeof backup.exportedAt === "string"
    ? new Date(backup.exportedAt)
    : null
  if (!exportedAt || Number.isNaN(exportedAt.getTime()) || exportedAt.toISOString() !== backup.exportedAt) {
    throw backupValidationError("备份文件包含无效的导出时间。", "invalid-backup-date")
  }

  const database = Object.hasOwn(backup, "database") ? backup.database : null
  const validCollections = isRecord(database)
    && ["works", "contacts", "groups"].every(key => {
      return Object.hasOwn(database, key) && Array.isArray(database[key])
    })
  const validEntries = validCollections
    && ["works", "contacts", "groups"].every(key => database[key].every(isRecord))
  if (!validEntries) {
    throw backupValidationError("备份文件中的创作库结构无效。", "invalid-backup-database")
  }

  const articleCount = database.works.filter(work => isRecord(work) && work.type === "article").length
  const phoneCount = database.works.filter(work => isRecord(work) && work.type === "phone").length

  return {
    format: backup.format,
    backupVersion: backup.backupVersion,
    exportedAt: backup.exportedAt,
    database,
    summary: {
      workCount: database.works.length,
      articleCount,
      phoneCount,
      otherCount: database.works.length - articleCount - phoneCount,
      contactCount: database.contacts.length,
      groupCount: database.groups.length,
    },
  }
}

export async function readLocalDatabaseBackupFile(file) {
  const validFile = file !== null
    && typeof file === "object"
    && Number.isSafeInteger(file.size)
    && file.size >= 0
    && typeof file.text === "function"
  if (!validFile) {
    throw backupValidationError("请选择有效的 JSON 备份文件。", "invalid-backup-file")
  }
  if (file.size === 0) {
    throw backupValidationError("备份文件为空。", "empty-backup-file")
  }
  if (file.size > MAX_LOCAL_DATABASE_BACKUP_BYTES) {
    throw backupValidationError("备份文件超过 25 MB 安全读取上限。", "backup-file-too-large")
  }

  let raw
  try {
    raw = await file.text()
  } catch (error) {
    throw new LocalDatabaseError(
      "无法读取备份文件；文件可能已被移动或浏览器权限已失效。",
      "backup-file-unreadable",
      error,
    )
  }
  return parseLocalDatabaseBackup(raw)
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
