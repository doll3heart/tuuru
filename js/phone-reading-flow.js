const FLOW_COLLECTIONS = Object.freeze({
  memo: "memos",
  shopping: "shoppingItems",
  forum: "forumPosts",
  moments: "moments",
  gallery: "photos",
  browser: "browserHistory",
})

function items(value) {
  return Array.isArray(value) ? value : []
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

function plainText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function contactName(phoneData, contactId) {
  return items(phoneData?.contacts).find(contact => sameId(contact?.id, contactId))?.name || ""
}

function messageLabel(message) {
  if (!message || typeof message !== "object") return "消息"
  if (message.type === "call") return message.callMode === "video" ? "视频通话" : "语音通话"
  if (message.type === "redpacket") return `红包 ¥${Number(message.redpacketAmount || 0).toFixed(2)}`
  if (message.type === "transfer") return `转账 ¥${Number(message.transferAmount || 0).toFixed(2)}`
  if (message.type === "familycard") return "亲属卡"
  if (message.type === "image") return "图片"
  if (message.type === "voice") return `语音 ${message.duration || ""}秒`.trim()
  if (message.type === "time") return plainText(message.time) || "时间标记"
  return plainText(message.text) || "消息"
}

function prefixedLabel(prefix, label) {
  return [plainText(prefix), plainText(label)].filter(Boolean).join(" · ").slice(0, 80)
}

export function phoneReadingFlowAppType(step) {
  return step?.type === "moments" ? "messages" : String(step?.type || "")
}

function phoneReadingFlowAppIsAvailable(phoneData, step) {
  if (!Array.isArray(phoneData?.apps)) return true
  const appType = phoneReadingFlowAppType(step)
  return phoneData.apps.some(app => app?.type === appType && app.enabled !== false)
}

export function resolvePhoneReadingFlowStep(phoneData, step) {
  if (!phoneData || !step || typeof step !== "object") return null
  if (step.type === "messages") {
    let chats = items(phoneData.chats)
    if (step.chatId != null) chats = chats.filter(chat => sameId(chat?.id, step.chatId))
    const matches = []
    for (const chat of chats) {
      for (const round of items(chat?.rounds)) {
        for (const message of items(round?.messages)) {
          if (sameId(message?.id, step.itemId)) matches.push({ kind: "message", item: message, message, round, chat })
        }
        if (sameId(round?.id, step.itemId)) matches.push({ kind: "round", item: round, round, chat })
      }
      for (const message of items(chat?.messages)) {
        if (sameId(message?.id, step.itemId)) matches.push({ kind: "message", item: message, message, round: null, chat })
      }
    }
    return matches.length === 1 ? matches[0] : null
  }

  const collection = FLOW_COLLECTIONS[step.type]
  if (!collection) return null
  const matches = items(phoneData[collection]).filter(item => sameId(item?.id, step.itemId))
  return matches.length === 1 ? { kind: step.type, item: matches[0] } : null
}

export function normalizePhoneReadingFlow(phoneData) {
  const flow = phoneData?.readingFlow
  if (!flow || typeof flow !== "object" || flow.enabled !== true) {
    return { enabled: false, sequence: [] }
  }
  const sequence = expandPhoneReadingFlowSequence(phoneData, flow.sequence)
  return { enabled: sequence.length > 0, sequence }
}

export function expandPhoneReadingFlowSequence(phoneData, sequence) {
  const rebuilt = buildPhoneReadingFlowSequence(phoneData)
  const expanded = []
  for (const step of items(sequence)) {
    if (!phoneReadingFlowAppIsAvailable(phoneData, step)) continue
    const target = resolvePhoneReadingFlowStep(phoneData, step)
    if (!target) continue
    if (target.kind !== "round") {
      expanded.push({ ...step })
      continue
    }
    const roundSteps = rebuilt.filter(candidate => (
      candidate.type === "messages"
      && sameId(candidate.chatId, target.chat?.id)
      && sameId(candidate.roundId, target.round?.id)
    ))
    expanded.push(...roundSteps.map(candidate => ({ ...candidate })))
  }
  return expanded
}

export function buildPhoneReadingFlowSequence(phoneData) {
  const pd = phoneData || {}
  const sequence = []

  if (phoneReadingFlowAppIsAvailable(pd, { type: "memo" })) {
    for (const memo of items(pd.memos)) {
      sequence.push({ type: "memo", itemId: memo.id, contactId: memo.contactId, label: prefixedLabel(contactName(pd, memo.contactId), plainText(memo.content).slice(0, 30) || "备忘录") })
    }
  }
  if (phoneReadingFlowAppIsAvailable(pd, { type: "shopping" })) {
    for (const shopping of items(pd.shoppingItems)) {
      sequence.push({ type: "shopping", itemId: shopping.id, contactId: shopping.contactId, label: prefixedLabel(contactName(pd, shopping.contactId), shopping.name || "购物记录") })
    }
  }
  if (phoneReadingFlowAppIsAvailable(pd, { type: "forum" })) {
    for (const post of items(pd.forumPosts)) {
      sequence.push({ type: "forum", itemId: post.id, contactId: post.contactId, label: prefixedLabel(post.contactName || contactName(pd, post.contactId), plainText(post.title).slice(0, 30) || "论坛帖子") })
    }
  }
  if (phoneReadingFlowAppIsAvailable(pd, { type: "moments" })) {
    for (const moment of items(pd.moments)) {
      sequence.push({ type: "moments", itemId: moment.id, contactId: moment.contactId, label: prefixedLabel(moment.contactName || contactName(pd, moment.contactId), plainText(moment.content).slice(0, 30) || "动态") })
    }
    for (const chat of items(pd.chats)) {
      const name = chat.type === "group" ? (chat.groupName || "群聊") : contactName(pd, items(chat.contactIds)[0])
      for (const round of items(chat.rounds)) {
        for (const message of items(round.messages)) {
          sequence.push({ type: "messages", itemId: message.id, chatId: chat.id, roundId: round.id, contactId: items(chat.contactIds)[0], label: prefixedLabel(name, messageLabel(message)) })
        }
      }
      for (const message of items(chat.messages)) {
        sequence.push({ type: "messages", itemId: message.id, chatId: chat.id, roundId: null, contactId: items(chat.contactIds)[0], label: prefixedLabel(name, messageLabel(message)) })
      }
    }
  }
  if (phoneReadingFlowAppIsAvailable(pd, { type: "gallery" })) {
    for (const photo of items(pd.photos)) {
      sequence.push({ type: "gallery", itemId: photo.id, contactId: photo.contactId, label: prefixedLabel(contactName(pd, photo.contactId), plainText(photo.caption).slice(0, 30) || "照片") })
    }
  }
  if (phoneReadingFlowAppIsAvailable(pd, { type: "browser" })) {
    for (const history of items(pd.browserHistory)) {
      sequence.push({ type: "browser", itemId: history.id, contactId: history.contactId, label: prefixedLabel(contactName(pd, history.contactId), plainText(history.title).slice(0, 30) || "浏览记录") })
    }
  }
  return sequence
}
