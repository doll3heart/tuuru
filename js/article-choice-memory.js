function isExactId(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function normalizedMemory(memory) {
  if (!memory || typeof memory !== "object" || Array.isArray(memory)) return {}

  return Object.fromEntries(Object.entries(memory).filter(([sourceNodeId, choiceId]) => (
    isExactId(sourceNodeId) && isExactId(choiceId)
  )))
}

function retainedIdSet(retainedNodeIds) {
  const values = retainedNodeIds instanceof Set || Array.isArray(retainedNodeIds)
    ? retainedNodeIds
    : []
  return new Set([...values].filter(isExactId))
}

/**
 * Records the latest exact choice made at a source node without mutating the
 * existing route memory. Malformed IDs are ignored rather than coerced.
 */
export function recordArticleChoice(memory, sourceNodeId, choiceId) {
  const current = normalizedMemory(memory)
  if (!isExactId(sourceNodeId) || !isExactId(choiceId)) return current
  return { ...current, [sourceNodeId]: choiceId }
}

/**
 * Keeps only choices whose source nodes remain on the current reading route.
 */
export function pruneArticleChoiceMemory(memory, retainedNodeIds) {
  const retained = retainedIdSet(retainedNodeIds)
  return Object.fromEntries(Object.entries(normalizedMemory(memory)).filter(([sourceNodeId]) => retained.has(sourceNodeId)))
}

/**
 * Returns the currently selected, exact stable choice IDs for this route.
 */
export function selectedArticleChoiceIds(memory) {
  return new Set(Object.values(normalizedMemory(memory)))
}
