function exactId(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function normalizedSelections(memory) {
  if (!memory || typeof memory !== "object" || Array.isArray(memory)) return {}
  const normalized = {}
  for (const [groupId, selection] of Object.entries(memory)) {
    if (!exactId(groupId)) continue
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) continue
    if (!exactId(selection.nodeId) || !exactId(selection.choiceId)) continue
    normalized[groupId] = {
      nodeId:selection.nodeId,
      choiceId:selection.choiceId,
    }
    const gameResult = normalizeArticleGameResult(selection.gameResult)
    if (gameResult) normalized[groupId].gameResult = gameResult
  }
  return normalized
}

export function recordArticleInteractionSelection(memory, groupId, nodeId, choiceId, gameResult) {
  const current = normalizedSelections(memory)
  if (!exactId(groupId) || !exactId(nodeId) || !exactId(choiceId)) return current
  const selection = {nodeId, choiceId}
  const normalizedGameResult = normalizeArticleGameResult(gameResult)
  if (normalizedGameResult) selection.gameResult = normalizedGameResult
  return {
    ...current,
    [groupId]:selection,
  }
}

export function pruneArticleInteractionSelections(memory, retainedNodeIds) {
  const retained = new Set(
    (retainedNodeIds instanceof Set || Array.isArray(retainedNodeIds))
      ? [...retainedNodeIds].filter(exactId)
      : [],
  )
  return Object.fromEntries(
    Object.entries(normalizedSelections(memory)).filter(([, selection]) => (
      retained.has(selection.nodeId)
    )),
  )
}

export function selectedArticleInteractionChoiceIds(memory) {
  return new Set(
    Object.values(normalizedSelections(memory)).map(selection => selection.choiceId),
  )
}

export function selectedArticleInteractionChoice(memory, groupId) {
  if (!exactId(groupId)) return ""
  return normalizedSelections(memory)[groupId]?.choiceId || ""
}

export function selectedArticleInteractionResult(memory, groupId) {
  if (!exactId(groupId)) return null
  return normalizedSelections(memory)[groupId]?.gameResult || null
}
import { normalizeArticleGameResult } from "./article-random-game.js"
