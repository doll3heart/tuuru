export function createEditorPersistenceBuffer(options = {}) {
  const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 180
  const setTimer = options.setTimer || ((callback, milliseconds) => globalThis.setTimeout(callback, milliseconds))
  const clearTimer = options.clearTimer || (timer => globalThis.clearTimeout(timer))
  const pending = new Map()

  function clearEntryTimer(entry) {
    if (entry?.timer !== undefined && entry.timer !== null) clearTimer(entry.timer)
  }

  function flush(key) {
    if (key !== undefined) {
      const entry = pending.get(key)
      if (!entry) return false
      pending.delete(key)
      clearEntryTimer(entry)
      entry.write()
      return true
    }

    const entries = [...pending.entries()]
    pending.clear()
    for (const [, entry] of entries) clearEntryTimer(entry)
    for (const [, entry] of entries) entry.write()
    return entries.length > 0
  }

  function schedule(key, write) {
    if ((typeof key !== "string" && typeof key !== "number") || typeof write !== "function") {
      throw new TypeError("persistence buffer requires a stable key and write callback")
    }
    const previous = pending.get(key)
    clearEntryTimer(previous)
    const entry = { write, timer: null }
    entry.timer = setTimer(() => {
      if (pending.get(key) !== entry) return
      pending.delete(key)
      entry.write()
    }, delay)
    pending.set(key, entry)
  }

  function cancel(key) {
    if (key !== undefined) {
      const entry = pending.get(key)
      if (!entry) return false
      pending.delete(key)
      clearEntryTimer(entry)
      return true
    }
    const entries = [...pending.values()]
    pending.clear()
    entries.forEach(clearEntryTimer)
    return entries.length > 0
  }

  return {
    schedule,
    flush,
    cancel,
    get pendingCount() {
      return pending.size
    },
  }
}
