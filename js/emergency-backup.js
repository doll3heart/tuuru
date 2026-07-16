import { createJsonToken } from "./local-database-mutation.js"
import {
  LOCAL_DATABASE_KEY,
  inspectLocalDatabaseRaw,
  serializeLocalDatabaseBackupFromDatabase,
} from "./storage.js"

const PRIVATE_WARNING = "此紧急备份包含完整创作库和私密编辑数据，仅用于恢复，不适合作为单篇作品分享；浏览器只能确认已发起下载，不能保证文件已永久写入磁盘。"

function backupError(message, code, cause) {
  const error = new Error(message)
  error.name = "EmergencyBackupError"
  error.code = code
  if (cause !== undefined) error.cause = cause
  return error
}

function uniqueWork(database, workId) {
  const matches = database.works.filter(work => work.id === workId)
  return matches.length === 1 ? matches[0] : null
}

function validRaw(raw) {
  const status = inspectLocalDatabaseRaw(raw)
  return status.ok ? status : null
}

function isSafeJsonText(raw) {
  if (typeof raw !== "string") return false
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

function replaceWork(database, workId, replacement) {
  return {
    ...database,
    works: database.works.map(work => work.id === workId ? replacement : work),
  }
}

function recoveryCopy(work, {
  workId,
  recoveryWorkId,
  sourceState,
  recoveredAt,
}) {
  const baseTitle = typeof work.title === "string" && work.title.trim().length > 0
    ? work.title
    : "未命名作品"
  return {
    ...work,
    id: recoveryWorkId,
    title: `${baseTitle}（冲突恢复副本）`,
    recoveryMetadata: {
      sourceWorkId: workId,
      sourceState,
      recoveredAt,
    },
  }
}

function tryAppendRecoveryWork(database, localWork, {
  workId,
  recoveryWorkId,
  sourceState,
  recoveredAt,
}) {
  if (database.works.some(work => work.id === recoveryWorkId)) return null
  const candidate = {
    ...database,
    works: [...database.works, recoveryCopy(localWork, {
      workId,
      recoveryWorkId,
      sourceState,
      recoveredAt,
    })],
  }
  try {
    serializeLocalDatabaseBackupFromDatabase(candidate, recoveredAt)
    return candidate
  } catch {
    return null
  }
}

function projectOtherEditors(saveSnapshot) {
  const editors = Array.isArray(saveSnapshot?.otherActiveEditors)
    ? saveSnapshot.otherActiveEditors
    : []
  const projected = editors.map(editor => ({
    workId: editor.workId,
    ownerId: editor.ownerId,
    expiresAt: editor.expiresAt,
  }))
  projected.sort((left, right) => {
    const leftWork = String(left.workId)
    const rightWork = String(right.workId)
    if (leftWork < rightWork) return -1
    if (leftWork > rightWork) return 1
    const leftOwner = String(left.ownerId)
    const rightOwner = String(right.ownerId)
    if (leftOwner < rightOwner) return -1
    if (leftOwner > rightOwner) return 1
    return Number(left.expiresAt) - Number(right.expiresAt)
  })
  return Object.freeze(projected.map(editor => Object.freeze(editor)))
}

function freezeResult({ artifacts, warning, otherActiveEditors }) {
  return Object.freeze({
    artifacts: Object.freeze(artifacts.map(artifact => Object.freeze(artifact))),
    warning: Object.freeze(warning),
    otherActiveEditors,
  })
}

export function prepareEmergencyLocalDatabaseBackup({
  storage,
  workId,
  saveSnapshot,
  lastValidRaw,
  localCandidateRaw,
  now,
  recoveryWorkId,
}) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("now must be a non-negative safe integer")
  }
  if (typeof workId !== "string" || workId.length === 0) {
    throw new TypeError("workId must be a non-empty string")
  }
  if (typeof recoveryWorkId !== "string" || recoveryWorkId.length === 0) {
    throw new TypeError("recoveryWorkId must be a non-empty string")
  }

  const iso = new Date(now).toISOString()
  const stamp = iso.replace(/[:.]/g, "-")
  let currentRaw
  let currentStatus = null
  let browserStorageStatus
  try {
    currentRaw = storage.getItem(LOCAL_DATABASE_KEY)
    currentStatus = validRaw(currentRaw)
    browserStorageStatus = currentStatus === null ? "invalid" : "confirmed"
  } catch {
    browserStorageStatus = "unreadable"
  }
  const lastStatus = validRaw(lastValidRaw)
  const unknownCandidate = localCandidateRaw?.kind === "unknown"
    ? localCandidateRaw
    : null
  const expectedStatus = unknownCandidate === null
    ? null
    : validRaw(unknownCandidate.expectedCurrentRaw)
  const baseline = currentStatus ?? expectedStatus ?? lastStatus
  if (baseline === null) {
    throw backupError(
      "No valid local library is available for an emergency backup.",
      "emergency-backup-unavailable",
    )
  }

  let database = baseline.data
  let rawDraft = null
  let draftUnavailable = false
  if (localCandidateRaw?.kind === "ordinary") {
    const candidateBytes = localCandidateRaw.candidateRaw
    const candidateStatus = typeof candidateBytes === "string"
      ? validRaw(candidateBytes)
      : null
    if (candidateStatus === null) {
      if (isSafeJsonText(candidateBytes)) rawDraft = candidateBytes
      else draftUnavailable = true
    }
    const localWork = candidateStatus === null
      ? null
      : uniqueWork(candidateStatus.data, workId)
    const baselineWork = uniqueWork(database, workId)
    const lastWork = lastStatus === null ? null : uniqueWork(lastStatus.data, workId)
    const terminal = saveSnapshot?.state === "conflict"
      || saveSnapshot?.state === "lease-lost"
    if (localWork === null) {
      if (candidateStatus !== null) rawDraft = candidateBytes
    } else if (!terminal
      && baselineWork !== null
      && lastWork !== null
      && createJsonToken(baselineWork) === createJsonToken(lastWork)) {
      database = replaceWork(database, workId, localWork)
    } else {
      const appended = tryAppendRecoveryWork(database, localWork, {
        workId,
        recoveryWorkId,
        sourceState: saveSnapshot?.state,
        recoveredAt: iso,
      })
      if (appended === null) rawDraft = candidateBytes
      else database = appended
    }
  } else if (unknownCandidate !== null) {
    const finalRaw = unknownCandidate.laterCandidateRaw
    const finalStatus = typeof finalRaw === "string" ? validRaw(finalRaw) : null
    if (finalStatus === null) {
      if (isSafeJsonText(finalRaw)) rawDraft = finalRaw
      else draftUnavailable = true
    } else {
      const finalLocalWork = uniqueWork(finalStatus.data, workId)
      const terminal = saveSnapshot?.state === "conflict"
        || saveSnapshot?.state === "lease-lost"
      if (finalLocalWork === null) {
        rawDraft = finalRaw
      } else {
        const currentLocalWork = currentStatus === null
          ? null
          : uniqueWork(currentStatus.data, workId)
        if (!terminal
          && currentStatus !== null
          && currentRaw === unknownCandidate.candidateRaw
          && currentLocalWork !== null) {
          database = replaceWork(currentStatus.data, workId, finalLocalWork)
        } else if (!terminal
          && currentStatus !== null
          && currentRaw === unknownCandidate.expectedCurrentRaw) {
          database = finalStatus.data
        } else {
          const appended = tryAppendRecoveryWork(database, finalLocalWork, {
            workId,
            recoveryWorkId,
            sourceState: saveSnapshot?.state,
            recoveredAt: iso,
          })
          if (appended === null) rawDraft = finalRaw
          else database = appended
        }
      }
    }
  }

  const mainArtifact = {
    kind: "library-backup",
    restorable: true,
    filename: `tuuru-emergency-backup-${stamp}.json`,
    mimeType: "application/json;charset=utf-8",
    contents: serializeLocalDatabaseBackupFromDatabase(database, iso),
  }
  const artifacts = [mainArtifact]
  if (rawDraft !== null) {
    artifacts.push({
      kind: "raw-draft",
      restorable: false,
      filename: `tuuru-emergency-unverified-draft-${stamp}.txt`,
      mimeType: "text/plain;charset=utf-8",
      contents: rawDraft,
    })
  }
  const otherActiveEditors = projectOtherEditors(saveSnapshot)
  const warnings = [PRIVATE_WARNING]
  if (otherActiveEditors.length > 0) {
    warnings.push("此文件未包含其他编辑器的内存中改动。")
  }
  if (rawDraft !== null) {
    warnings.push("未验证草稿不可直接恢复，仅供人工找回内容。")
  } else if (draftUnavailable) {
    warnings.push("当前未验证候选无法安全序列化，因此未生成草稿文件。")
  }
  const message = warnings.join(" ")
  return freezeResult({
    artifacts,
    warning: {
      containsPrivateFullLibraryData: true,
      browserStorageStatus,
      omitsOtherEditorMemory: otherActiveEditors.length > 0,
      message,
    },
    otherActiveEditors,
  })
}
