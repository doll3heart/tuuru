export function resolvePlaceholderValue(placeholder, options = {}) {
  const valuesMap = options.valuesMap
  const values = valuesMap && valuesMap[placeholder.id]
    ? valuesMap[placeholder.id]
    : (placeholder.values || [])

  if (!values.length) return placeholder.default || ""
  if (values.length === 1) return values[0]

  const mode = options.usePlaceholderMode === false
    ? (options.defaultMode || "each")
    : (placeholder.mode || options.defaultMode || "each")
  if (mode === "locked") return values[0]

  if (mode === "scene") {
    const sceneId = options.sceneId
    if (sceneId && placeholder.sceneMap && placeholder.sceneMap[sceneId]) {
      return placeholder.sceneMap[sceneId]
    }
    return values[0]
  }

  const random = options.random || Math.random
  return values[Math.floor(random() * values.length)]
}

export function substitutePlaceholders(text, placeholders, options = {}) {
  if (!text || !placeholders || !placeholders.length) return text

  let result = text
  for (const placeholder of placeholders) {
    const patterns = options.patternsFor
      ? options.patternsFor(placeholder)
      : [placeholder.key || placeholder.label]
    const value = resolvePlaceholderValue(placeholder, options)

    for (const pattern of patterns) {
      result = result.replaceAll(pattern, value)
    }
  }
  return result
}
