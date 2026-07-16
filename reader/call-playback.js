function normalizeCallLines(callLines, fallbackText) {
  const result = []

  if (Array.isArray(callLines)) {
    for (let index = 0; index < callLines.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(callLines, String(index))
      if (!descriptor || !("value" in descriptor)) continue
      const value = descriptor.value
      if (typeof value !== "string") continue
      const line = value.trim()
      if (line) result.push(line)
    }
  }

  if (result.length === 0 && typeof fallbackText === "string") {
    const fallback = fallbackText.trim()
    if (fallback) result.push(fallback)
  }

  return Object.freeze(result)
}

function createState(lines, currentIndex) {
  const isEmpty = lines.length === 0
  return Object.freeze({
    lines,
    currentIndex: isEmpty ? -1 : currentIndex,
    isEmpty,
    isComplete: isEmpty || currentIndex === lines.length - 1,
  })
}

export function createCallPlaybackState(callLines, fallbackText) {
  return createState(normalizeCallLines(callLines, fallbackText), 0)
}

export function advanceCallPlayback(state) {
  if (state.isComplete) return state
  return createState(state.lines, state.currentIndex + 1)
}
