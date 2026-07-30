export const APPEARANCE_DRAFT_TTL_MS = 30 * 60 * 1000

function cloneDraft(value) {
  if (!value || typeof value !== "object") return null
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

export function createAppearanceDraftSession(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? options.ttlMs
    : APPEARANCE_DRAFT_TTL_MS
  const now = typeof options.now === "function" ? options.now : Date.now
  const drafts = new Map()

  function read(key) {
    if (typeof key !== "string" || !key.trim()) return null
    const normalizedKey = key.trim()
    const entry = drafts.get(normalizedKey)
    if (!entry) return null
    if (now() - entry.savedAt > ttlMs) {
      drafts.delete(normalizedKey)
      return null
    }
    return cloneDraft(entry.value)
  }

  function write(key, value) {
    if (typeof key !== "string" || !key.trim()) return false
    const cloned = cloneDraft(value)
    if (!cloned) return false
    drafts.set(key.trim(), { value:cloned, savedAt:now() })
    return true
  }

  function clear(key) {
    if (typeof key !== "string" || !key.trim()) return false
    return drafts.delete(key.trim())
  }

  return { read, write, clear }
}

const appearanceDraftSessions = new WeakMap()
const fallbackAppearanceDraftSession = createAppearanceDraftSession()

function sharedAppearanceDraftSession() {
  const owner = globalThis.window
  if (!owner || (typeof owner !== "object" && typeof owner !== "function")) {
    return fallbackAppearanceDraftSession
  }
  let session = appearanceDraftSessions.get(owner)
  if (!session) {
    session = createAppearanceDraftSession()
    appearanceDraftSessions.set(owner, session)
  }
  return session
}

export function readAppearanceDraft(key) {
  return sharedAppearanceDraftSession().read(key)
}

export function writeAppearanceDraft(key, value) {
  return sharedAppearanceDraftSession().write(key, value)
}

export function clearAppearanceDraft(key) {
  return sharedAppearanceDraftSession().clear(key)
}
