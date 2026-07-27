const WORK_CACHE_PREFIX = "moirain_work_"
const QUOTA_ERROR_NAMES = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
])
const QUOTA_ERROR_CODES = new Set([22, 1014])

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).byteLength
}

function readerBooks(library) {
  return Array.isArray(library?.books)
    ? library.books.filter(book => book && typeof book.id === "string" && book.id)
    : []
}

function safeGet(storage, key) {
  try {
    const value = storage?.getItem(key)
    return typeof value === "string" ? value : null
  } catch {
    return null
  }
}

function restoreSnapshots(storage, snapshots, incomingKey, incomingBefore) {
  let rollbackOk = true
  try {
    if (incomingBefore === null) storage.removeItem(incomingKey)
    else storage.setItem(incomingKey, incomingBefore)
  } catch {
    rollbackOk = false
  }
  for (const [key, value] of snapshots) {
    try {
      storage.setItem(key, value)
    } catch {
      rollbackOk = false
    }
  }
  return rollbackOk
}

export function isReaderStorageQuotaError(error) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return false
  return QUOTA_ERROR_NAMES.has(String(error.name || ""))
    || QUOTA_ERROR_CODES.has(Number(error.code))
}

export function readerStorageRescueCandidates(storage, library, options = {}) {
  const excludeWorkId = String(options.excludeWorkId || "")
  const incomingSerialized = String(options.incomingSerialized || "")
  const incomingBytes = byteLength(incomingSerialized)
  const existingIncoming = excludeWorkId
    ? safeGet(storage, WORK_CACHE_PREFIX + excludeWorkId)
    : null
  const suggestedBytes = Math.max(1, incomingBytes - byteLength(existingIncoming))
  const candidates = []

  for (const book of readerBooks(library)) {
    if (book.id === excludeWorkId) continue
    const raw = safeGet(storage, WORK_CACHE_PREFIX + book.id)
    if (raw === null) continue
    candidates.push({
      id:book.id,
      title:typeof book.title === "string" && book.title.trim() ? book.title.trim() : "无标题作品",
      lastOpenedAt:Number.isFinite(Number(book.lastOpenedAt)) ? Number(book.lastOpenedAt) : 0,
      bytes:byteLength(raw),
    })
  }

  candidates.sort((left, right) => (
    left.lastOpenedAt - right.lastOpenedAt
    || right.bytes - left.bytes
    || left.id.localeCompare(right.id)
  ))
  return { candidates, incomingBytes, suggestedBytes }
}

export function installReaderCacheWithRescue(storage, input = {}) {
  const library = input.library
  const incomingWorkId = String(input.incomingWorkId || "")
  const incomingSerialized = String(input.incomingSerialized || "")
  const requestedIds = Array.isArray(input.clearWorkIds)
    ? [...new Set(input.clearWorkIds.map(id => String(id || "")).filter(Boolean))]
    : []
  const allowedIds = new Set(
    readerBooks(library)
      .map(book => book.id)
      .filter(id => id !== incomingWorkId),
  )
  if (!incomingWorkId || requestedIds.some(id => !allowedIds.has(id))) {
    return {
      ok:false,
      rollbackOk:true,
      clearedBytes:0,
      clearedWorkIds:[],
      error:new TypeError("Reader cache rescue contains an invalid work id"),
    }
  }

  const incomingKey = WORK_CACHE_PREFIX + incomingWorkId
  const incomingBefore = safeGet(storage, incomingKey)
  const snapshots = new Map()
  let clearedBytes = 0
  for (const id of requestedIds) {
    const key = WORK_CACHE_PREFIX + id
    const raw = safeGet(storage, key)
    if (raw === null) continue
    snapshots.set(key, raw)
    clearedBytes += byteLength(raw)
  }

  try {
    for (const key of snapshots.keys()) storage.removeItem(key)
    storage.setItem(incomingKey, incomingSerialized)
    return {
      ok:true,
      rollbackOk:true,
      clearedBytes,
      clearedWorkIds:requestedIds.filter(id => snapshots.has(WORK_CACHE_PREFIX + id)),
      error:null,
    }
  } catch (error) {
    return {
      ok:false,
      rollbackOk:restoreSnapshots(storage, snapshots, incomingKey, incomingBefore),
      clearedBytes:0,
      clearedWorkIds:[],
      error,
    }
  }
}
