const READER_LAYER_STATE_KEY = "__tuuruReaderLayer"

function validLayerKey(value) {
  return typeof value === "string" && value.trim().length > 0
}

export function createReaderLayerHistory(targetWindow = globalThis.window) {
  const targetHistory = targetWindow?.history
  const layers = []
  let nextToken = 1
  let ignoredPopstates = 0
  let disposed = false

  function invokeLayer(layer, source, detail) {
    if (!layer || typeof layer.onClose !== "function") return
    layer.onClose({ source, key:layer.key, ...(detail || {}) })
  }

  function handlePopstate() {
    if (disposed) return
    if (ignoredPopstates > 0) {
      ignoredPopstates -= 1
      return
    }
    const layer = layers.pop()
    if (layer) invokeLayer(layer, "history")
  }

  targetWindow?.addEventListener?.("popstate", handlePopstate)

  function open(key, onClose) {
    if (disposed || !validLayerKey(key) || typeof onClose !== "function") return null
    const normalizedKey = key.trim()
    const existing = layers.find(layer => layer.key === normalizedKey)
    if (existing) {
      existing.onClose = onClose
      return existing.token
    }

    const token = `reader-layer-${nextToken++}`
    layers.push({ key:normalizedKey, token, onClose })
    try {
      const currentState = targetHistory?.state && typeof targetHistory.state === "object"
        ? targetHistory.state
        : {}
      targetHistory?.pushState?.({
        ...currentState,
        [READER_LAYER_STATE_KEY]:token,
      }, "")
    } catch {
      // The UI layer still works when history is unavailable or restricted.
    }
    return token
  }

  function close(key, detail) {
    if (disposed || !validLayerKey(key)) return false
    const normalizedKey = key.trim()
    const index = layers.findIndex(layer => layer.key === normalizedKey)
    if (index < 0) return false
    const wasTop = index === layers.length - 1
    const [layer] = layers.splice(index, 1)
    invokeLayer(layer, "control", detail)

    if (wasTop && targetHistory?.state?.[READER_LAYER_STATE_KEY] === layer.token) {
      try {
        ignoredPopstates += 1
        targetHistory.back()
      } catch {
        ignoredPopstates = Math.max(0, ignoredPopstates - 1)
      }
    }
    return true
  }

  function has(key) {
    return validLayerKey(key) && layers.some(layer => layer.key === key.trim())
  }

  function dispose() {
    if (disposed) return
    disposed = true
    layers.length = 0
    targetWindow?.removeEventListener?.("popstate", handlePopstate)
  }

  return {
    open,
    close,
    has,
    dispose,
    depth:() => layers.length,
  }
}

export { READER_LAYER_STATE_KEY }
