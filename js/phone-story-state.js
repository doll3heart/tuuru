import { articleDisplayConditionMatches, normalizeArticleDisplayCondition } from "./article-condition-model.js"

const MAX_PHONE_STORY_SELECTIONS = 1000
const NO_PHONE_STORY_DISPLAY_CONDITION = Symbol("no-phone-story-display-condition")
const PHONE_STORY_SCOPED_SELECTION_TAG = "chat-choice"
const PHONE_STORY_AUTHORED_CHAT_SOURCE_FIELD = "__readerAuthoredChatSourceKey"

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

export function phoneStoryChatSelectionScope(chat, chatIndex, phoneData) {
  const authoredSourceKey = typeof chat?.[PHONE_STORY_AUTHORED_CHAT_SOURCE_FIELD] === "string"
    ? chat[PHONE_STORY_AUTHORED_CHAT_SOURCE_FIELD]
    : ""
  if (exactId(chat?.id) && authoredSourceKey === chat.id) {
    return `chat-id:${chat.id}`
  }
  if (!exactId(chat?.id) && authoredSourceKey === `chat#${chatIndex}`) {
    return `chat-index:${chatIndex}`
  }
  if (authoredSourceKey) return `chat-source:${authoredSourceKey}`
  if (!exactId(chat?.id)) return `chat-index:${chatIndex}`
  const chats = items(phoneData?.chats)
  const matchingIndexes = []
  chats.forEach(function(candidate, candidateIndex) {
    if (candidate?.id === chat.id) matchingIndexes.push(candidateIndex)
  })
  if (matchingIndexes.length <= 1) return `chat-id:${chat.id}`
  const occurrence = matchingIndexes.indexOf(chatIndex)
  return `chat-source:${chat.id}#${occurrence >= 0 ? occurrence : chatIndex}`
}

function parsedScopedChoiceSelectionKey(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096 || value.trim() !== value) return null
  try {
    const parts = JSON.parse(value)
    if (
      !Array.isArray(parts)
      || parts.length !== 3
      || parts[0] !== PHONE_STORY_SCOPED_SELECTION_TAG
      || typeof parts[1] !== "string"
      || parts[1].length === 0
      || parts[1].length > 1024
      || !exactId(parts[2])
    ) return null
    return { chatPersistenceKey:parts[1], ownerMessageId:parts[2] }
  } catch {
    return null
  }
}

function validChoiceSelectionKey(value) {
  return exactId(value) || parsedScopedChoiceSelectionKey(value) !== null
}

export function isPhoneStoryChoiceSelectionKey(value) {
  return validChoiceSelectionKey(value)
}

export function phoneStoryScopedChoiceSelectionKey(chatPersistenceKey, ownerMessageId) {
  if (
    typeof chatPersistenceKey !== "string"
    || chatPersistenceKey.length === 0
    || chatPersistenceKey.length > 1024
    || !exactId(ownerMessageId)
  ) return ""
  return JSON.stringify([
    PHONE_STORY_SCOPED_SELECTION_TAG,
    chatPersistenceKey,
    ownerMessageId,
  ])
}

function selectionValue(selections, key) {
  if (!key) return undefined
  if (selections instanceof Map) return selections.get(key)
  if (!selections || typeof selections !== "object" || Array.isArray(selections)) return undefined
  return Object.prototype.hasOwnProperty.call(selections, key) ? selections[key] : undefined
}

export function phoneStorySelectedChoiceId(selections, chatPersistenceKey, ownerMessageId) {
  const scopedKey = phoneStoryScopedChoiceSelectionKey(chatPersistenceKey, ownerMessageId)
  const scopedValue = selectionValue(selections, scopedKey)
  return exactId(scopedValue) ? scopedValue : selectionValue(selections, ownerMessageId)
}

function phoneStoryMessageEntries(phoneData) {
  const entries = []
  items(phoneData?.chats).forEach(function(chat, chatIndex) {
    const chatPersistenceKey = phoneStoryChatSelectionScope(chat, chatIndex, phoneData)
    for (const message of items(chat?.messages)) {
      entries.push({ chat, chatIndex, chatPersistenceKey, message, roundMessages:null, messageIndex:-1 })
    }
    for (const round of items(chat?.rounds)) {
      const messages = items(round?.messages)
      messages.forEach(function(message, messageIndex) {
        entries.push({ chat, chatIndex, chatPersistenceKey, message, roundMessages:messages, messageIndex })
      })
    }
  })
  return entries
}

function ownerMessageIdCounts(entries) {
  const counts = new Map()
  for (const entry of entries) {
    const ownerMessageId = entry?.message?.id
    if (!exactId(ownerMessageId)) continue
    counts.set(ownerMessageId, (counts.get(ownerMessageId) || 0) + 1)
  }
  return counts
}

function choiceSelectionKeyForEntry(entry, ownerCounts) {
  const ownerMessageId = entry?.message?.id
  if (!exactId(ownerMessageId)) return ""
  return ownerCounts.get(ownerMessageId) === 1
    ? ownerMessageId
    : phoneStoryScopedChoiceSelectionKey(entry.chatPersistenceKey, ownerMessageId)
}

export function phoneStoryChoiceSelectionKey(phoneData, chatPersistenceKey, ownerMessageId) {
  if (!exactId(ownerMessageId)) return ""
  const entries = phoneStoryMessageEntries(phoneData).filter(entry => entry?.message?.id === ownerMessageId)
  if (entries.length <= 1) return ownerMessageId
  return entries.filter(entry => entry.chatPersistenceKey === chatPersistenceKey).length === 1
    ? phoneStoryScopedChoiceSelectionKey(chatPersistenceKey, ownerMessageId)
    : ""
}

function normalizedSelectionMap(selections) {
  const entries = selections instanceof Map
    ? Array.from(selections.entries())
    : selections && typeof selections === "object" && !Array.isArray(selections)
      ? Object.keys(selections).map(key => [key, Object.prototype.hasOwnProperty.call(selections, key) ? selections[key] : undefined])
      : []
  const newest = []
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const [ownerMessageId, choiceId] = entries[index]
    if (!validChoiceSelectionKey(ownerMessageId) || !exactId(choiceId)) continue
    newest.push([ownerMessageId, choiceId])
    if (newest.length >= MAX_PHONE_STORY_SELECTIONS) break
  }
  return new Map(newest.reverse())
}

export function phoneStoryChoiceCatalog(phoneData, options) {
  const catalog = []
  const counts = new Map()
  const includeSearchText = options?.includeSearchText === true
  const contactNames = new Map()

  for (const contact of items(phoneData?.contacts)) {
    const contactId = contact?.id
    if (!exactId(contactId) || contactNames.has(contactId)) continue
    contactNames.set(contactId, plainText(contact?.name))
  }

  function chatLabel(chat) {
    if (chat?.type === "group") return plainText(chat?.groupName) || "群聊"
    const contactId = items(chat?.contactIds).find(exactId)
      || (exactId(chat?.contactId) ? chat.contactId : "")
    return contactNames.get(contactId) || plainText(chat?.groupName) || "会话"
  }

  function addMessageChoices(chat, sourceChatLabel, message, roundLabel) {
    const choices = items(message?.choices)
    if (!choices.length) return
    const chatId = exactId(chat?.id) ? chat.id : ""
    const ownerMessageId = exactId(message?.id) ? message.id : ""
    if (!ownerMessageId) return
    const messageLabel = plainText(message?.text || message?.content) || "消息"
    const fullDetail = [sourceChatLabel, roundLabel, messageLabel]
      .filter(Boolean)
      .join(" · ")
    const detail = fullDetail.length > 160 ? `${fullDetail.slice(0, 159)}…` : fullDetail
    for (const choice of choices) {
      if (!exactId(choice?.id)) continue
      const label = plainText(choice.text || choice.replyText) || "未命名选项"
      counts.set(choice.id, (counts.get(choice.id) || 0) + 1)
      const entry = {
        id:choice.id,
        ownerMessageId,
        chatId,
        label,
        detail,
        ambiguous:false,
      }
      if (includeSearchText) entry.searchText = [label, fullDetail, choice.id].join(" ")
      catalog.push(entry)
    }
  }

  for (const chat of items(phoneData?.chats)) {
    const sourceChatLabel = chatLabel(chat)
    for (const message of items(chat?.messages)) addMessageChoices(chat, sourceChatLabel, message, "")
    items(chat?.rounds).forEach(function(round, roundIndex) {
      const roundLabel = plainText(round?.label) || `第${roundIndex + 1}轮`
      for (const message of items(round?.messages)) addMessageChoices(chat, sourceChatLabel, message, roundLabel)
    })
  }

  return catalog.map(entry => ({ ...entry, ambiguous:counts.get(entry.id) !== 1 }))
}

export function selectedPhoneStoryChoiceIds(selections) {
  const values = selections instanceof Map
    ? Array.from(selections.values())
    : selections && typeof selections === "object" && !Array.isArray(selections)
      ? Object.keys(selections).map(key => Object.prototype.hasOwnProperty.call(selections, key) ? selections[key] : undefined)
      : []
  const newest = []
  const seen = new Set()
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (!exactId(value)) continue
    if (seen.has(value)) continue
    seen.add(value)
    newest.push(value)
    if (newest.length >= MAX_PHONE_STORY_SELECTIONS) break
  }
  return new Set(newest.reverse())
}

function hasOwn(record, key) {
  return Boolean(record) && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, key)
}

function rawPhoneStoryDisplayCondition(item) {
  if (hasOwn(item, "displayCondition")) return item.displayCondition
  if (hasOwn(item, "visibleAfterChoiceId")) {
    const legacyChoiceId = item.visibleAfterChoiceId
    if (legacyChoiceId == null || (typeof legacyChoiceId === "string" && legacyChoiceId.trim() === "")) {
      return NO_PHONE_STORY_DISPLAY_CONDITION
    }
    if (exactId(legacyChoiceId)) {
      return { all:[{ anyChoiceIds:[legacyChoiceId] }] }
    }
    return null
  }
  return NO_PHONE_STORY_DISPLAY_CONDITION
}

function strictConditionGroups(item) {
  const condition = rawPhoneStoryDisplayCondition(item)
  if (condition === NO_PHONE_STORY_DISPLAY_CONDITION) return []
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
  return condition === NO_PHONE_STORY_DISPLAY_CONDITION ? { all:[] } : normalizeArticleDisplayCondition(condition)
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
  if (condition === NO_PHONE_STORY_DISPLAY_CONDITION) return true
  if (strictConditionGroups(item) === null) return false
  return articleDisplayConditionMatches(condition, selectedChoiceIds)
}

export function phoneStoryChoiceById(phoneData, choiceId) {
  if (!exactId(choiceId)) return null
  const matches = phoneStoryChoiceCatalog(phoneData).filter(entry => entry.id === choiceId)
  return matches.length === 1 && matches[0].ambiguous === false ? matches[0] : null
}

export function prunePhoneStoryChoiceSelections(phoneData, selections) {
  const normalized = normalizedSelectionMap(selections)
  const messageEntries = phoneStoryMessageEntries(phoneData)
  const ownerCounts = ownerMessageIdCounts(messageEntries)
  const entriesBySelectionKey = new Map()
  for (const entry of messageEntries) {
    const selectionKey = choiceSelectionKeyForEntry(entry, ownerCounts)
    if (!selectionKey) continue
    const existing = entriesBySelectionKey.get(selectionKey)
    if (existing) existing.push(entry)
    else entriesBySelectionKey.set(selectionKey, [entry])
  }

  for (const [savedSelectionKey, choiceId] of Array.from(normalized.entries())) {
    if (entriesBySelectionKey.has(savedSelectionKey)) continue
    const scopedIdentity = parsedScopedChoiceSelectionKey(savedSelectionKey)
    const candidates = messageEntries.filter(function(entry) {
      if (scopedIdentity) {
        return entry.chatPersistenceKey === scopedIdentity.chatPersistenceKey
          && entry.message?.id === scopedIdentity.ownerMessageId
      }
      return entry.message?.id === savedSelectionKey
        && items(entry.message?.choices).some(choice => choice?.id === choiceId)
    })
    const matchingCandidates = candidates.filter(function(entry) {
      return items(entry.message?.choices).filter(choice => choice?.id === choiceId).length === 1
    })
    if (matchingCandidates.length !== 1) continue
    const migratedKey = choiceSelectionKeyForEntry(matchingCandidates[0], ownerCounts)
    if (!migratedKey || migratedKey === savedSelectionKey) continue
    normalized.delete(savedSelectionKey)
    if (!normalized.has(migratedKey)) normalized.set(migratedKey, choiceId)
  }

  const choiceCounts = new Map()
  for (const entry of messageEntries) {
    for (const choice of items(entry?.message?.choices)) {
      if (!exactId(choice?.id)) continue
      choiceCounts.set(choice.id, (choiceCounts.get(choice.id) || 0) + 1)
    }
  }
  const choiceOwners = new Map()
  for (const entry of messageEntries) {
    const selectionKey = choiceSelectionKeyForEntry(entry, ownerCounts)
    if (!selectionKey) continue
    for (const choice of items(entry?.message?.choices)) {
      if (exactId(choice?.id) && choiceCounts.get(choice.id) === 1) {
        choiceOwners.set(choice.id, selectionKey)
      }
    }
  }

  function removeInvalidOwners() {
    let changed = false
    for (const [selectionKey, choiceId] of normalized) {
      const ownerMatches = entriesBySelectionKey.get(selectionKey) || []
      const selectedMatches = ownerMatches.length === 1
        ? items(ownerMatches[0]?.message?.choices).filter(choice => choice?.id === choiceId)
        : []
      if (ownerMatches.length === 1 && selectedMatches.length === 1) continue
      normalized.delete(selectionKey)
      changed = true
    }
    return changed
  }

  function removeUnreachableOwners() {
    const memo = new Map()
    function reachesVisibleRoot(selectionKey, visiting = new Set()) {
      if (memo.has(selectionKey)) return memo.get(selectionKey)
      if (visiting.has(selectionKey)) {
        memo.set(selectionKey, false)
        return false
      }
      const ownerEntry = (entriesBySelectionKey.get(selectionKey) || [])[0]
      const owner = ownerEntry?.message
      if (!owner || !normalized.has(selectionKey)) {
        memo.set(selectionKey, false)
        return false
      }
      const groups = strictConditionGroups(owner)
      if (groups === null) {
        memo.set(selectionKey, false)
        return false
      }
      if (groups.length === 0) {
        memo.set(selectionKey, true)
        return true
      }
      const nextVisiting = new Set(visiting)
      nextVisiting.add(selectionKey)
      const reachable = groups.every(function(group) {
        return group.some(function(requiredChoiceId) {
          const dependencySelectionKey = choiceOwners.get(requiredChoiceId)
          if (!dependencySelectionKey || normalized.get(dependencySelectionKey) !== requiredChoiceId) return false
          return reachesVisibleRoot(dependencySelectionKey, nextVisiting)
        })
      })
      memo.set(selectionKey, reachable)
      return reachable
    }

    let changed = false
    for (const selectionKey of Array.from(normalized.keys())) {
      if (reachesVisibleRoot(selectionKey)) continue
      normalized.delete(selectionKey)
      changed = true
    }
    return changed
  }

  function selectionBlockedByEndedRound(selectionKey) {
    const entry = (entriesBySelectionKey.get(selectionKey) || [])[0]
    if (!entry || !Array.isArray(entry.roundMessages) || entry.messageIndex < 0) return false
    for (let index = 0; index < entry.messageIndex; index += 1) {
      const owner = entry.roundMessages[index]
      const ownerEntry = {
        chatPersistenceKey:entry.chatPersistenceKey,
        message:owner,
      }
      const ownerSelectionKey = choiceSelectionKeyForEntry(ownerEntry, ownerCounts)
      const selectedChoiceId = normalized.get(ownerSelectionKey)
      if (!exactId(selectedChoiceId)) continue
      const selected = items(owner?.choices).filter(choice => choice?.id === selectedChoiceId)
      if (selected.length === 1 && selected[0].endRound === true) return true
    }
    return false
  }

  let changed = false
  do {
    changed = removeInvalidOwners()
    if (removeUnreachableOwners()) changed = true
    for (const selectionKey of Array.from(normalized.keys())) {
      if (!selectionBlockedByEndedRound(selectionKey)) continue
      normalized.delete(selectionKey)
      changed = true
    }
  } while (changed)

  return normalized
}

export function phoneStoryMessageBlockedByEndedRound(phoneData, messageId, selections, options) {
  if (!exactId(messageId)) return false
  const requestedChatPersistenceKey = typeof options?.chatPersistenceKey === "string"
    ? options.chatPersistenceKey
    : ""
  const messageEntries = phoneStoryMessageEntries(phoneData)
  const ownerCounts = ownerMessageIdCounts(messageEntries)
  const matches = messageEntries.filter(function(entry) {
    return entry.message?.id === messageId
      && Array.isArray(entry.roundMessages)
      && (!requestedChatPersistenceKey || entry.chatPersistenceKey === requestedChatPersistenceKey)
  })
  if (matches.length !== 1) return false

  for (let index = 0; index < matches[0].messageIndex; index += 1) {
    const owner = matches[0].roundMessages[index]
    const ownerSelectionKey = choiceSelectionKeyForEntry({
      chatPersistenceKey:matches[0].chatPersistenceKey,
      message:owner,
    }, ownerCounts)
    const selectedChoiceId = selectionValue(selections, ownerSelectionKey)
    if (!exactId(selectedChoiceId)) continue
    const selected = items(owner?.choices).filter(choice => choice?.id === selectedChoiceId)
    if (selected.length === 1 && selected[0].endRound === true) return true
  }
  return false
}
