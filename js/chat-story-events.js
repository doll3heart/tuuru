import { normalizeChatMessageDelayMs } from "./chat-message-delay.js"

const EVENT_KINDS = [
  "notice",
  "typing",
  "read",
  "unread",
  "rejected",
  "send-failed",
  "recall",
  "burn",
  "nudge",
  "reaction",
  "edited",
  "group-join",
  "group-leave",
  "group-remove",
  "group-invite",
  "owner-transfer",
  "admin-change",
  "group-rename",
  "group-avatar",
  "group-title",
  "announcement",
  "mute",
  "contact-update",
  "relationship",
  "friend-request",
]

const CARD_TYPES = ["location", "contact-card", "file", "music", "forward", "schedule"]
const CALL_STATUSES = ["pending", "completed", "cancelled", "rejected", "missed", "busy", "interrupted", "video-switch"]
const CONTACT_CARD_ACTIONS = new Set(["view", "direct", "request"])
const CONTACT_CARD_OUTCOMES = new Set(["accepted", "declined", "pending"])

export const CHAT_STORY_EVENT_KINDS = Object.freeze(EVENT_KINDS.slice())
export const CHAT_STORY_CARD_TYPES = Object.freeze(CARD_TYPES.slice())
export const CHAT_CALL_STATUSES = Object.freeze(CALL_STATUSES.slice())

function text(value) {
  return String(value ?? "").trim()
}

function numberBetween(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function normalizedEvent(message) {
  const eventKind = EVENT_KINDS.includes(message?.eventKind) ? message.eventKind : "notice"
  return {
    type: message?.type === "contact-event" ? "contact-event" : "system-event",
    eventKind,
    text:text(message?.text),
    durationMs:Math.round(numberBetween(message?.durationMs, 300, 30000, 1800)),
    burnSeconds:Math.round(numberBetween(message?.burnSeconds, 1, 60, 5)),
    allowReveal:message?.allowReveal === true,
    actorContactId:text(message?.actorContactId),
    targetContactId:text(message?.targetContactId),
    secondaryContactId:text(message?.secondaryContactId),
    targetMessageId:text(message?.targetMessageId),
    relationshipState:text(message?.relationshipState),
    reaction:text(message?.reaction),
    roleChange:text(message?.roleChange),
    newName:text(message?.newName),
    newAvatarUrl:text(message?.newAvatarUrl),
    newBio:text(message?.newBio),
    originalText:text(message?.originalText),
  }
}

export function normalizeChatStoryMessage(message) {
  if (!message || typeof message !== "object") return { type:"text", text:"" }
  if (message.type === "system-event" || message.type === "contact-event") return normalizedEvent(message)
  const next = { ...message, type:text(message.type) || "text" }
  if (Object.hasOwn(message, "delayBeforeMs")) next.delayBeforeMs = normalizeChatMessageDelayMs(message.delayBeforeMs)
  if (next.type === "call") {
    next.callStatus = CALL_STATUSES.includes(next.callStatus) ? next.callStatus : "pending"
  }
  if (next.type === "location") {
    next.locationName = text(next.locationName || next.text)
    next.locationAddress = text(next.locationAddress)
    next.locationImage = text(next.locationImage)
  }
  if (next.type === "contact-card") {
    next.targetContactId = text(next.targetContactId)
    next.contactName = text(next.contactName)
    next.contactNote = text(next.contactNote)
    next.contactAction = CONTACT_CARD_ACTIONS.has(next.contactAction) ? next.contactAction : "view"
    next.contactRequestOutcome = CONTACT_CARD_OUTCOMES.has(next.contactRequestOutcome) ? next.contactRequestOutcome : "accepted"
    next.contactAcceptedText = text(next.contactAcceptedText)
    next.contactDeclinedText = text(next.contactDeclinedText)
    next.contactPendingText = text(next.contactPendingText)
  }
  if (next.type === "file") {
    next.fileName = text(next.fileName) || "未命名文件"
    next.fileType = text(next.fileType)
    next.fileSize = text(next.fileSize)
    next.fileContent = text(next.fileContent)
  }
  if (next.type === "music") {
    next.musicTitle = text(next.musicTitle) || "未命名音乐"
    next.musicArtist = text(next.musicArtist)
    next.musicCover = text(next.musicCover)
    next.musicUrl = text(next.musicUrl)
  }
  if (next.type === "forward") {
    next.forwardTitle = text(next.forwardTitle) || "聊天记录"
    next.forwardItems = Array.isArray(next.forwardItems)
      ? next.forwardItems.slice(0, 50).map(item => ({ sender:text(item?.sender), text:text(item?.text) })).filter(item => item.sender || item.text)
      : []
  }
  if (next.type === "schedule") {
    next.scheduleTitle = text(next.scheduleTitle) || "日程邀请"
    next.scheduleTime = text(next.scheduleTime)
    next.scheduleLocation = text(next.scheduleLocation)
    next.scheduleDetails = text(next.scheduleDetails)
    next.acceptLabel = text(next.acceptLabel) || "接受"
    next.declineLabel = text(next.declineLabel) || "拒绝"
  }
  return next
}

function actor(message) {
  return text(message?.actorName) || "对方"
}

export function storyEventText(message) {
  const event = normalizedEvent(message)
  const name = actor(message)
  const target = text(message?.targetName) || "你"
  if (event.text) return event.text
  switch (event.eventKind) {
    case "typing": return `${name}正在输入…`
    case "read": return "消息已读"
    case "unread": return "消息未读"
    case "rejected": return "消息已发出，但被对方拒收了"
    case "send-failed": return "消息发送失败"
    case "recall": return `${name}撤回了一条消息`
    case "burn": return `${name}发来一条阅后即焚消息`
    case "nudge": return `${name}拍了拍${target}`
    case "reaction": return `${name}回应了 ${event.reaction || "♡"}`
    case "edited": return `${name}修改了一条消息`
    case "group-join": return `${name}加入了群聊`
    case "group-leave": return `${name}退出了群聊`
    case "group-remove": return `${name}被移出了群聊`
    case "group-invite": return `${name}邀请${target}加入群聊`
    case "owner-transfer": return `${name}成为了新群主`
    case "admin-change": return event.roleChange === "remove" ? `${name}已被取消管理员` : `${name}已成为管理员`
    case "group-rename": return `群聊名称已改为“${event.newName || "未命名群聊"}”`
    case "group-avatar": return "群头像已更新"
    case "group-title": return `${name}的群头衔已改为“${event.newName || "成员"}”`
    case "announcement": return event.originalText ? `群公告：${event.originalText}` : "群公告已更新"
    case "mute": return event.durationMs > 0 ? `${name}被禁言` : "群聊已开启全体禁言"
    case "contact-update": return `${name}更新了联系人资料`
    case "relationship": {
      const relationship = event.relationshipState
      if (relationship === "blocked") return `${name}已将你拉黑`
      if (relationship === "deleted") return `${name}已将你删除`
      if (relationship === "friend") return `你和${name}已成为好友`
      return `${name}的联系人关系已变化`
    }
    case "friend-request": return `${name}请求添加你为好友`
    default: return "系统消息"
  }
}

export function createChatStoryState(phoneData, chat) {
  return {
    contacts:clone(Array.isArray(phoneData?.contacts) ? phoneData.contacts : []) || [],
    group:clone(chat || {}) || {},
    relationships:{},
    messageStates:{},
    scheduleResponses:{},
    friendRequestResponses:{},
  }
}

function nextState(state) {
  return {
    contacts:clone(Array.isArray(state?.contacts) ? state.contacts : []) || [],
    group:clone(state?.group || {}) || {},
    relationships:{ ...(state?.relationships || {}) },
    messageStates:clone(state?.messageStates || {}) || {},
    scheduleResponses:{ ...(state?.scheduleResponses || {}) },
    friendRequestResponses:{ ...(state?.friendRequestResponses || {}) },
  }
}

function addUnique(items, value) {
  const id = text(value)
  if (!id || items.some(item => String(item) === id)) return items
  return items.concat(id)
}

function removeId(items, value) {
  const id = text(value)
  return items.filter(item => String(item) !== id)
}

export function applyChatStoryMessage(state, message) {
  const next = nextState(state)
  if (message?.failed === true || message?.deliveryState === "failed" || message?.deliveryState === "recalled") return next
  if (!message || (message.type !== "system-event" && message.type !== "contact-event")) return next
  const event = normalizedEvent(message)
  const contactId = event.targetContactId
  const contact = next.contacts.find(item => String(item?.id) === contactId)

  if (event.eventKind === "contact-update" && contact) {
    if (event.newName) contact.name = event.newName
    if (event.newAvatarUrl) {
      contact.avatarUrl = event.newAvatarUrl
      contact.messageAvatarUrl = event.newAvatarUrl
    }
    if (event.newBio) contact.note = event.newBio
  }
  if (event.eventKind === "relationship" && contactId) next.relationships[contactId] = event.relationshipState || "changed"

  next.group.contactIds = Array.isArray(next.group.contactIds) ? next.group.contactIds : []
  next.group.groupAdminIds = Array.isArray(next.group.groupAdminIds) ? next.group.groupAdminIds : []
  next.group.groupTitles = next.group.groupTitles && typeof next.group.groupTitles === "object" ? next.group.groupTitles : {}
  if (event.eventKind === "group-join" || event.eventKind === "group-invite") next.group.contactIds = addUnique(next.group.contactIds, contactId)
  if (event.eventKind === "group-leave" || event.eventKind === "group-remove") {
    next.group.contactIds = removeId(next.group.contactIds, contactId)
    next.group.groupAdminIds = removeId(next.group.groupAdminIds, contactId)
    delete next.group.groupTitles[contactId]
  }
  if (event.eventKind === "owner-transfer" && contactId) next.group.groupOwnerId = contactId
  if (event.eventKind === "admin-change" && contactId) {
    next.group.groupAdminIds = event.roleChange === "remove"
      ? removeId(next.group.groupAdminIds, contactId)
      : addUnique(next.group.groupAdminIds, contactId)
  }
  if (event.eventKind === "group-rename" && event.newName) next.group.groupName = event.newName
  if (event.eventKind === "group-avatar" && event.newAvatarUrl) next.group.groupAvatarUrl = event.newAvatarUrl
  if (event.eventKind === "group-title" && contactId) next.group.groupTitles[contactId] = event.newName
  return next
}

function callOutcome(message) {
  const status = CALL_STATUSES.includes(message?.callStatus) ? message.callStatus : "pending"
  const labels = {
    completed:"已通话",
    cancelled:"对方已取消",
    rejected:"对方已拒绝",
    missed:"无人接听",
    busy:"对方忙线",
    interrupted:"通话中断",
    "video-switch":"切换为视频通话",
  }
  return labels[status] || ""
}

export function chatStoryMessageLabel(message) {
  const normalized = normalizeChatStoryMessage(message)
  if (normalized.type === "system-event" || normalized.type === "contact-event") return storyEventText(message)
  if (normalized.type === "call") {
    const mode = normalized.callMode === "video" ? "视频通话" : "语音通话"
    return [mode, callOutcome(normalized)].filter(Boolean).join(" · ")
  }
  if (normalized.type === "location") return `位置 · ${normalized.locationName || "未命名地点"}`
  if (normalized.type === "contact-card") return `联系人名片 · ${normalized.contactName || "联系人"}`
  if (normalized.type === "file") return `文件 · ${normalized.fileName}`
  if (normalized.type === "music") return `音乐 · ${normalized.musicTitle}`
  if (normalized.type === "forward") return `合并转发 · ${normalized.forwardTitle}`
  if (normalized.type === "schedule") return `日程 · ${normalized.scheduleTitle}`
  return text(normalized.text) || "消息"
}
