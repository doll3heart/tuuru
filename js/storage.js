import { validateAndNormalizeWork } from "./work-schema.js"
import { FEATURE_FLAGS, featureEnabled } from "./feature-flags.js"

export const LOCAL_DATABASE_KEY = "tuuru_works"
const DATABASE_KEY = LOCAL_DATABASE_KEY

export const LOCAL_DATABASE_BACKUP_FORMAT = "tuuru-local-library-backup"
export const LOCAL_DATABASE_BACKUP_VERSION = 1
export const MAX_LOCAL_DATABASE_BACKUP_BYTES = 25 * 1024 * 1024

const SUPPORTED_LOCAL_DATABASE_BACKUP_VERSIONS = new Set([1])
const preparedRestorePlans = new WeakSet()

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
  constructor(message, code, cause, details) {
    super(message)
    this.name = "LocalDatabaseError"
    this.code = code
    if (cause) this.cause = cause
    if (details) this.details = details
  }
}

export function assertLegacyWritesAllowed(flags = FEATURE_FLAGS) {
  if (featureEnabled("reliableLocalWrites", flags)) {
    throw new LocalDatabaseError(
      "旧版本地写入已关闭。请重新加载页面后重试。",
      "legacy-write-disabled",
    )
  }
}

function recordArray(value, path, { optional = false } = {}) {
  if (value === undefined && optional) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ code: "invalid-record-array", path, message: "字段必须是对象数组。" }],
    }
  }
  const invalidIndex = value.findIndex(item => !isRecord(item))
  if (invalidIndex >= 0) {
    return {
      ok: false,
      issues: [{
        code: "invalid-record-entry",
        path: `${path}[${invalidIndex}]`,
        message: "数组条目必须是对象。",
      }],
    }
  }
  return { ok: true, value: value.map(item => ({ ...item })) }
}

function validateDatabaseObject(data, { context = "local-database", raw = null } = {}) {
  if (!isRecord(data)) {
    return {
      ok: false,
      code: "invalid-structure",
      raw,
      issues: [{ code: "invalid-record", path: "$", message: "创作库必须是对象。" }],
      message: "本地作品数据缺少有效的顶层对象。",
    }
  }

  const works = recordArray(data.works, "$.works")
  const contacts = recordArray(data.contacts, "$.contacts", {
    optional: !Object.hasOwn(data, "contacts"),
  })
  const groups = recordArray(data.groups, "$.groups", {
    optional: !Object.hasOwn(data, "groups"),
  })
  const failed = [works, contacts, groups].find(result => !result.ok)
  if (failed) {
    return {
      ok: false,
      code: "invalid-structure",
      raw,
      issues: failed.issues,
      message: "本地作品数据包含无效的集合结构。",
    }
  }

  const normalizedWorks = []
  for (let index = 0; index < works.value.length; index += 1) {
    const result = validateAndNormalizeWork(works.value[index], {
      context,
      path: `$.works[${index}]`,
    })
    if (!result.ok) {
      return {
        ok: false,
        code: "invalid-structure",
        raw,
        issues: result.issues,
        message: result.message,
      }
    }
    normalizedWorks.push(result.work)
  }

  return {
    ok: true,
    raw,
    data: {
      ...data,
      works: normalizedWorks,
      contacts: contacts.value,
      groups: groups.value,
    },
  }
}

export function inspectLocalDatabaseRaw(raw) {
  if (raw === null) return { ok: true, data: createEmptyDatabase(), raw: null }

  let data
  try {
    data = JSON.parse(raw)
  } catch (error) {
    return {
      ok: false,
      code: "invalid-json",
      raw,
      issues: [{ code: "invalid-json", path: "$", message: "JSON 无法解析。" }],
      message: describeError(error, "本地作品数据不是有效的 JSON。"),
    }
  }

  return validateDatabaseObject(data, { context: "local-database", raw })
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
  return inspectLocalDatabaseRaw(raw)
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
  assertLegacyWritesAllowed()

  const current = inspectLocalDatabase(storage)
  if (!current.ok) throw integrityError(current)

  const candidate = validateDatabaseObject(data, { context: "local-database" })
  if (!candidate.ok) {
    throw new LocalDatabaseError(
      "拒绝写入无效的作品数据库。",
      "invalid-write",
      undefined,
      { issues: candidate.issues },
    )
  }

  try {
    storage.setItem(DATABASE_KEY, JSON.stringify(candidate.data))
  } catch (error) {
    throw new LocalDatabaseError(
      "作品保存失败。请检查浏览器存储空间并立即导出备份。",
      "write-failed",
      error,
    )
  }
}

function serializeBackupDatabase(database, exportedAt) {
  return JSON.stringify({
    format: LOCAL_DATABASE_BACKUP_FORMAT,
    backupVersion: LOCAL_DATABASE_BACKUP_VERSION,
    exportedAt,
    database,
  }, null, 2)
}

function summarizeDatabase(database) {
  const articleCount = database.works.filter(work => isRecord(work) && work.type === "article").length
  const phoneCount = database.works.filter(work => isRecord(work) && work.type === "phone").length
  return {
    workCount: database.works.length,
    articleCount,
    phoneCount,
    otherCount: database.works.length - articleCount - phoneCount,
    contactCount: database.contacts.length,
    groupCount: database.groups.length,
  }
}

function restoreError(message, code, phase, commitState, cause) {
  return new LocalDatabaseError(message, code, cause, { phase, commitState })
}

function readExactRaw(storage, phase) {
  try {
    return storage.getItem(DATABASE_KEY)
  } catch (error) {
    throw restoreError(
      "浏览器无法读取当前本地创作库。",
      "restore-readback-failed",
      phase,
      "unchanged",
      error,
    )
  }
}

function freezeRestorePlan(plan) {
  if (plan.summary) Object.freeze(plan.summary)
  if (plan.currentSummary) Object.freeze(plan.currentSummary)
  if (plan.recoveryArtifact) Object.freeze(plan.recoveryArtifact)
  const frozenPlan = Object.freeze(plan)
  preparedRestorePlans.add(frozenPlan)
  return frozenPlan
}

export function serializeLocalDatabaseBackup(storage = localStorage, exportedAt = new Date()) {
  const database = readLocalDatabase(storage)

  try {
    return serializeBackupDatabase(database, exportedAt.toISOString())
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
  const databaseResult = validateDatabaseObject(database, { context: "backup" })
  if (!databaseResult.ok) {
    throw new LocalDatabaseError(
      "备份文件中的创作库结构无效。",
      "invalid-backup-database",
      undefined,
      { issues: databaseResult.issues },
    )
  }
  const validatedDatabase = databaseResult.data

  return {
    format: backup.format,
    backupVersion: backup.backupVersion,
    exportedAt: backup.exportedAt,
    database: validatedDatabase,
    summary: summarizeDatabase(validatedDatabase),
  }
}

export function prepareLocalDatabaseRestore(parsedBackup, storage = localStorage, now = new Date()) {
  if (!isRecord(parsedBackup) || !isRecord(parsedBackup.database)) {
    throw restoreError(
      "恢复计划缺少有效备份。",
      "restore-serialize-failed",
      "prepare",
      "unchanged",
    )
  }

  let candidateRaw
  try {
    candidateRaw = JSON.stringify(parsedBackup.database)
  } catch (error) {
    throw restoreError(
      "无法序列化待恢复的创作库。",
      "restore-serialize-failed",
      "prepare",
      "unchanged",
      error,
    )
  }
  const candidateStatus = inspectLocalDatabaseRaw(candidateRaw)
  if (!candidateStatus.ok) {
    throw restoreError(
      "待恢复的创作库未通过完整校验。",
      "restore-serialize-failed",
      "prepare",
      "unchanged",
    )
  }

  let exportedAt
  let restoredBytes
  try {
    exportedAt = now.toISOString()
    if (typeof exportedAt !== "string") throw new TypeError("restore timestamp must be an ISO string")
    const validatedTime = new Date(exportedAt)
    if (Number.isNaN(validatedTime.getTime()) || validatedTime.toISOString() !== exportedAt) {
      throw new TypeError("restore timestamp must be a canonical ISO string")
    }
    restoredBytes = new TextEncoder().encode(candidateRaw).length
  } catch (error) {
    throw restoreError(
      "无法序列化待恢复的创作库。",
      "restore-serialize-failed",
      "prepare",
      "unchanged",
      error,
    )
  }

  const expectedCurrentRaw = readExactRaw(storage, "prepare")
  const currentStatus = inspectLocalDatabaseRaw(expectedCurrentRaw)
  const previousState = expectedCurrentRaw === null ? "missing" : currentStatus.ok ? "valid" : "corrupt"
  const stamp = exportedAt.replace(/[:.]/g, "-")
  let recoveryArtifact = null
  if (previousState === "valid") {
    recoveryArtifact = {
      kind: "library-backup",
      filename: `tuuru-library-before-restore-${stamp}.json`,
      mimeType: "application/json;charset=utf-8",
      contents: serializeBackupDatabase(currentStatus.data, exportedAt),
    }
  } else if (previousState === "corrupt") {
    recoveryArtifact = {
      kind: "corrupt-raw",
      filename: `tuuru-corrupt-before-restore-${stamp}.txt`,
      mimeType: "text/plain;charset=utf-8",
      contents: expectedCurrentRaw,
    }
  }

  return freezeRestorePlan({
    candidateRaw,
    expectedCurrentRaw,
    summary: summarizeDatabase(candidateStatus.data),
    currentSummary: currentStatus.ok ? summarizeDatabase(currentStatus.data) : null,
    previousState,
    recoveryArtifact,
    restoredBytes,
  })
}

export function restoreLocalDatabaseBackup(plan, storage = localStorage) {
  assertLegacyWritesAllowed()

  if (!preparedRestorePlans.has(plan)) {
    throw restoreError(
      "恢复计划无效，请重新检查备份。",
      "restore-serialize-failed",
      "replace",
      "unchanged",
    )
  }

  const candidateStatus = inspectLocalDatabaseRaw(plan.candidateRaw)
  if (!candidateStatus.ok) {
    throw restoreError(
      "恢复计划中的创作库未通过完整校验。",
      "restore-serialize-failed",
      "replace",
      "unchanged",
    )
  }

  const currentRaw = readExactRaw(storage, "replace")
  if (currentRaw !== plan.expectedCurrentRaw) {
    throw restoreError(
      "当前创作库已发生变化，请重新检查备份。",
      "restore-conflict",
      "replace",
      "unchanged",
    )
  }

  try {
    storage.setItem(DATABASE_KEY, plan.candidateRaw)
  } catch (error) {
    throw restoreError(
      "恢复写入失败，原创作库保持不变。",
      "restore-write-failed",
      "replace",
      "unchanged",
      error,
    )
  }

  let readback
  try {
    readback = storage.getItem(DATABASE_KEY)
  } catch (error) {
    throw restoreError(
      "恢复后无法确认本地数据状态，请重新加载检查。",
      "restore-readback-failed",
      "verify",
      "unknown",
      error,
    )
  }
  const verified = readback === plan.candidateRaw && inspectLocalDatabaseRaw(readback).ok
  if (!verified) {
    throw restoreError(
      "恢复结果无法确认，请重新加载检查。",
      "restore-verification-failed",
      "verify",
      "unknown",
    )
  }

  return {
    ok: true,
    code: "restored",
    summary: plan.summary,
    previousState: plan.previousState,
    restoredBytes: plan.restoredBytes,
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
