import { getWork, updateWork } from "./data.js"

const DRAFT_PREFIX = "phone-draft:"

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function defaultSessionId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createPhoneWorkAccess({
  readStoredWork,
  updateStoredWork,
  createSessionId = defaultSessionId,
  now = Date.now,
}) {
  const drafts = new Map()

  function isDraftId(id) {
    return String(id).startsWith(DRAFT_PREFIX)
  }

  function getPhoneWork(id) {
    if (!isDraftId(id)) return readStoredWork(id)
    const work = drafts.get(id)
    return work ? clone(work) : null
  }

  function updatePhoneWork(id, patch) {
    if (!isDraftId(id)) return updateStoredWork(id, patch)
    const current = drafts.get(id)
    if (!current) return null

    const next = {
      ...current,
      ...clone(patch),
      updatedAt: now(),
    }
    drafts.set(id, next)
    return clone(next)
  }

  function createPhoneWorkDraft(initialWork) {
    let id
    do {
      id = DRAFT_PREFIX + createSessionId()
    } while (drafts.has(id))

    drafts.set(id, { ...clone(initialWork), id })
    let disposed = false

    return {
      id,
      snapshot() {
        return disposed ? null : clone(drafts.get(id))
      },
      dispose() {
        if (disposed) return
        disposed = true
        drafts.delete(id)
      },
    }
  }

  return { getPhoneWork, updatePhoneWork, createPhoneWorkDraft }
}

const phoneWorkAccess = createPhoneWorkAccess({
  readStoredWork: getWork,
  updateStoredWork: updateWork,
})

export const getPhoneWork = phoneWorkAccess.getPhoneWork
export const updatePhoneWork = phoneWorkAccess.updatePhoneWork
export const createPhoneWorkDraft = phoneWorkAccess.createPhoneWorkDraft
