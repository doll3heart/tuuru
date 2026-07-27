function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function normalizeRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("undo record must be an object")
  }
  const workId = String(input.workId || "")
  const label = String(input.label || "")
  const expectedWorkToken = String(input.expectedWorkToken || "")
  if (!workId || !label || !expectedWorkToken) {
    throw new TypeError("undo record requires workId, label, and expectedWorkToken")
  }
  if (!input.beforeWork || typeof input.beforeWork !== "object" || Array.isArray(input.beforeWork)) {
    throw new TypeError("undo snapshot must be an object")
  }
  if (String(input.beforeWork.id || "") !== workId) {
    throw new TypeError("undo snapshot id must match workId")
  }
  return {
    workId,
    label,
    expectedWorkToken,
    beforeWork:clone(input.beforeWork),
  }
}

export function createHomeBulkUndoStore() {
  let current = null
  return Object.freeze({
    register(input) {
      current = normalizeRecord(input)
      return clone(current)
    },
    peek(workId) {
      if (!current || (workId !== undefined && String(workId) !== current.workId)) return null
      return clone(current)
    },
    consume(workId) {
      if (!current || String(workId || "") !== current.workId) return null
      const consumed = clone(current)
      current = null
      return consumed
    },
    clear() {
      current = null
    },
  })
}

export const homeBulkUndoStore = createHomeBulkUndoStore()
