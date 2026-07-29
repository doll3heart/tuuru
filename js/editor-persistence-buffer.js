export function createEditorPersistenceBuffer(options = {}) {
  const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 180
  const setTimer = options.setTimer || ((callback, milliseconds) => globalThis.setTimeout(callback, milliseconds))
  const clearTimer = options.clearTimer || (timer => globalThis.clearTimeout(timer))
  const onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null
  const pending = new Map()
  let lastStateKey = ""

  function publish(state, error = null) {
    if (!onStateChange) return
    const snapshot = {
      state,
      pendingCount:pending.size,
      error:error instanceof Error ? error : null,
    }
    const key = state + ":" + snapshot.pendingCount + ":" + (snapshot.error?.message || "")
    if (key === lastStateKey) return
    lastStateKey = key
    onStateChange(snapshot)
  }

  function executeWrite(write) {
    publish("saving")
    try {
      write()
      publish(pending.size ? "editing" : "saved")
    } catch (error) {
      publish("error", error)
      throw error
    }
  }

  function clearEntryTimer(entry) {
    if (entry?.timer !== undefined && entry.timer !== null) clearTimer(entry.timer)
  }

  function flush(key) {
    if (key !== undefined) {
      const entry = pending.get(key)
      if (!entry) return false
      pending.delete(key)
      clearEntryTimer(entry)
      executeWrite(entry.write)
      return true
    }

    const entries = [...pending.entries()]
    pending.clear()
    for (const [, entry] of entries) clearEntryTimer(entry)
    if (entries.length) {
      publish("saving")
      try {
        for (const [, entry] of entries) entry.write()
        publish(pending.size ? "editing" : "saved")
      } catch (error) {
        publish("error", error)
        throw error
      }
    }
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
      executeWrite(entry.write)
    }, delay)
    pending.set(key, entry)
    publish("editing")
  }

  function cancel(key) {
    if (key !== undefined) {
      const entry = pending.get(key)
      if (!entry) return false
      pending.delete(key)
      clearEntryTimer(entry)
      publish(pending.size ? "editing" : "saved")
      return true
    }
    const entries = [...pending.values()]
    pending.clear()
    entries.forEach(clearEntryTimer)
    if (entries.length) publish("saved")
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
