import { substitutePlaceholders } from "./placeholders.js"

const STRUCTURAL_STRING_KEYS = new Set([
  "id", "type", "mode", "platform", "randomMode", "callMode", "surface", "appType",
  "contactId", "senderId", "aliasId", "parentId", "ownerId", "groupOwnerId", "forumPostId",
  "quoteId", "albumId", "itemId", "nodeId", "chapterId", "sceneId", "targetNodeId", "messageId",
])

function keepsRawString(key) {
  const normalized = String(key || "")
  if (STRUCTURAL_STRING_KEYS.has(normalized)) return true
  if (/Ids$/.test(normalized)) return true
  if (/(?:url|uri)$/i.test(normalized)) return true
  if (/(?:image|images|avatar|icon|data)$/i.test(normalized)) return true
  if (/(?:color|background)$/i.test(normalized)) return true
  return false
}

export function substitutePhoneTextData(phoneData, placeholders, options = {}) {
  function visit(value, key) {
    if (typeof value === "string") {
      return keepsRawString(key)
        ? value
        : substitutePlaceholders(value, placeholders, options)
    }
    if (Array.isArray(value)) return value.map(item => visit(item, key))
    if (!value || typeof value !== "object") return value
    const result = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = visit(childValue, childKey)
    }
    return result
  }
  return visit(phoneData || {}, "")
}
