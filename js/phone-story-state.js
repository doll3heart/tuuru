import { articleDisplayConditionMatches, normalizeArticleDisplayCondition } from "./article-condition-model.js"

const MAX_PHONE_STORY_SELECTIONS = 500

function items(value) {
  return Array.isArray(value) ? value : []
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function exactId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200
}

function chatMessages(chat) {
  const messages = []
  messages.push(...items(chat?.messages))
  for (const round of items(chat?.rounds)) messages.push(...items(round?.messages))
  return messages
}

function phoneStoryMessages(phoneData) {
  const messages = []
  for (const chat of items(phoneData?.chats)) messages.push(...chatMessages(chat))
  return messages
}

function normalizedSelectionMap(selections) {
  const normalized = new Map()
  const entries = selections instanceof Map
    ? Array.from(selections.entries())
    : selections && typeof selections === "object" && !Array.isArray(selections)
      ? Object.keys(selections).map(key => [key, Object.prototype.hasOwnProperty.call(selections, key) ? selections[key] : undefined])
      : []
  for (const [ownerMessageId, choiceId] of entries) {
    if (!exactId(ownerMessageId) || !exactId(choiceId)) continue
    normalized.set(ownerMessageId, choiceId)
    if (normalized.size >= MAX_PHONE_STORY_SELECTIONS) break
  }
  return normalized
}

export function phoneStoryChoiceCatalog(phoneData) {
  const catalog = []
  const counts = new Map()

  for (const chat of items(phoneData?.chats)) {
    const chatId = exactId(chat?.id) ? chat.id : ""
    const chatLabel = plainText(chat?.groupName) || "会话"
    for (const message of chatMessages(chat)) {
      const ownerMessageId = exactId(message?.id) ? message.id : ""
      if (!ownerMessageId) continue
      const messageLabel = plainText(message?.text || message?.content) || "消息"
      for (const choice of items(message?.choices)) {
        if (!exactId(choice?.id)) continue
        counts.set(choice.id, (counts.get(choice.id) || 0) + 1)
        catalog.push({
          id:choice.id,
          ownerMessageId,
          chatId,
          label:plainText(choice.text || choice.replyText) || "未命名选项",
          detail:`${chatLabel} · ${messageLabel}`.slice(0, 160),
          ambiguous:false,
        })
      }
    }
  }

  return catalog.map(entry => ({ ...entry, ambiguous:counts.get(entry.id) !== 1 }))
}

export function selectedPhoneStoryChoiceIds(selections) {
  const selected = new Set()
  const values = selections instanceof Map
    ? Array.from(selections.values())
    : selections && typeof selections === "object" && !Array.isArray(selections)
      ? Object.keys(selections).map(key => Object.prototype.hasOwnProperty.call(selections, key) ? selections[key] : undefined)
      : []

  for (const value of values) {
    if (!exactId(value)) continue
    selected.add(value)
    if (selected.size >= MAX_PHONE_STORY_SELECTIONS) break
  }
  return selected
}

function hasOwn(record, key) {
  return Boolean(record) && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, key)
}

function rawPhoneStoryDisplayCondition(item) {
  if (hasOwn(item, "displayCondition")) return item.displayCondition
  if (exactId(item?.visibleAfterChoiceId)) {
    return { all:[{ anyChoiceIds:[item.visibleAfterChoiceId] }] }
  }
  return null
}

function strictConditionGroups(item) {
  const condition = rawPhoneStoryDisplayCondition(item)
  if (condition === null) return []
  if (!condition || typeof condition !== "object" || !Array.isArray(condition.all) || condition.all.length === 0) return null
  const groups = []
  for (const group of condition.all) {
    if (!group || typeof group !== "object" || !Array.isArray(group.anyChoiceIds) || group.anyChoiceIds.length === 0) return null
    const ids = []
    for (const choiceId of group.anyChoiceIds) {
      if (!exactId(choiceId) || choiceId.trim() !== choiceId) return null
      ids.push(choiceId)
    }
    groups.push([...new Set(ids)])
  }
  return groups
}

export function normalizePhoneStoryDisplayCondition(item) {
  const condition = rawPhoneStoryDisplayCondition(item)
  return condition === null ? { all:[] } : normalizeArticleDisplayCondition(condition)
}

export function phoneStoryItemHasValidConditionReferences(phoneData, item) {
  const groups = strictConditionGroups(item)
  if (groups === null) return false
  if (groups.length === 0) return true
  const validIds = new Set(
    phoneStoryChoiceCatalog(phoneData)
      .filter(choice => choice.ambiguous === false)
      .map(choice => choice.id),
  )
  return groups.every(group => group.every(choiceId => validIds.has(choiceId)))
}

export function phoneStoryItemIsVisible(item, selectedChoiceIds) {
  const condition = rawPhoneStoryDisplayCondition(item)
  if (condition === null) return true
  return articleDisplayConditionMatches(condition, selectedChoiceIds)
}

export function phoneStoryChoiceById(phoneData, choiceId) {
  if (!exactId(choiceId)) return null
  const matches = phoneStoryChoiceCatalog(phoneData).filter(entry => entry.id === choiceId)
  return matches.length === 1 && matches[0].ambiguous === false ? matches[0] : null
}

export function prunePhoneStoryChoiceSelections(phoneData, selections) {
  const normalized = normalizedSelectionMap(selections)
  const messagesById = new Map()
  for (const message of phoneStoryMessages(phoneData)) {
    if (!exactId(message?.id)) continue
    const existing = messagesById.get(message.id)
    if (existing) existing.push(message)
    else messagesById.set(message.id, [message])
  }

  const choiceOwners = new Map()
  for (const choice of phoneStoryChoiceCatalog(phoneData)) {
    if (!choice.ambiguous) choiceOwners.set(choice.id, choice.ownerMessageId)
  }

  function removeInvalidOwners() {
    let changed = false
    for (const [ownerMessageId, choiceId] of normalized) {
      const ownerMatches = messagesById.get(ownerMessageId) || []
      const selectedMatches = ownerMatches.length === 1
        ? items(ownerMatches[0]?.choices).filter(choice => choice?.id === choiceId)
        : []
      if (ownerMatches.length === 1 && selectedMatches.length === 1) continue
      normalized.delete(ownerMessageId)
      changed = true
    }
    return changed
  }

  function removeUnreachableOwners() {
    const memo = new Map()
    function reachesVisibleRoot(ownerMessageId, visiting = new Set()) {
      if (memo.has(ownerMessageId)) return memo.get(ownerMessageId)
      if (visiting.has(ownerMessageId)) {
        memo.set(ownerMessageId, false)
        return false
      }
      const owner = (messagesById.get(ownerMessageId) || [])[0]
      if (!owner || !normalized.has(ownerMessageId)) {
        memo.set(ownerMessageId, false)
        return false
      }
      const groups = strictConditionGroups(owner)
      if (groups === null) {
        memo.set(ownerMessageId, false)
        return false
      }
      if (groups.length === 0) {
        memo.set(ownerMessageId, true)
        return true
      }
      const nextVisiting = new Set(visiting)
      nextVisiting.add(ownerMessageId)
      const reachable = groups.every(function(group) {
        return group.some(function(requiredChoiceId) {
          const dependencyOwnerId = choiceOwners.get(requiredChoiceId)
          if (!dependencyOwnerId || normalized.get(dependencyOwnerId) !== requiredChoiceId) return false
          return reachesVisibleRoot(dependencyOwnerId, nextVisiting)
        })
      })
      memo.set(ownerMessageId, reachable)
      return reachable
    }

    let changed = false
    for (const ownerMessageId of Array.from(normalized.keys())) {
      if (reachesVisibleRoot(ownerMessageId)) continue
      normalized.delete(ownerMessageId)
      changed = true
    }
    return changed
  }

  let changed = false
  do {
    changed = removeInvalidOwners()
    if (removeUnreachableOwners()) changed = true
    for (const ownerMessageId of Array.from(normalized.keys())) {
      if (!phoneStoryMessageBlockedByEndedRound(phoneData, ownerMessageId, normalized)) continue
      normalized.delete(ownerMessageId)
      changed = true
    }
  } while (changed)

  return normalized
}

export function phoneStoryMessageBlockedByEndedRound(phoneData, messageId, selections) {
  if (!exactId(messageId)) return false
  const matches = []
  for (const chat of items(phoneData?.chats)) {
    for (const round of items(chat?.rounds)) {
      const messages = items(round?.messages)
      messages.forEach(function(message, index) {
        if (message?.id === messageId) matches.push({ messages, index })
      })
    }
  }
  if (matches.length !== 1) return false
  const selectedChoiceForOwner = ownerMessageId => selections instanceof Map
    ? selections.get(ownerMessageId)
    : selections && typeof selections === "object"
      ? Object.prototype.hasOwnProperty.call(selections, ownerMessageId) ? selections[ownerMessageId] : undefined
      : undefined

  for (let index = 0; index < matches[0].index; index += 1) {
    const owner = matches[0].messages[index]
    const selectedChoiceId = selectedChoiceForOwner(owner?.id)
    if (!exactId(selectedChoiceId)) continue
    const selected = items(owner?.choices).filter(choice => choice?.id === selectedChoiceId)
    if (selected.length === 1 && selected[0].endRound === true) return true
  }
  return false
}
