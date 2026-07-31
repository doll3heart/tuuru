const CHAT_APP_TARGET_TYPES = Object.freeze([
  "forum",
  "memo",
  "shopping",
  "gallery",
  "browser",
  "contacts",
])

export const CHAT_ACTIONABLE_MESSAGE_TYPES = Object.freeze([
  "link",
  "redpacket",
  "transfer",
  "familycard",
  "takeaway",
  "location",
  "contact-card",
  "file",
  "music",
  "forward",
  "schedule",
])

function text(value) {
  return String(value ?? "").trim()
}

function concise(value, maxLength = 54) {
  const normalized = text(value).replace(/\s+/g, " ")
  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd() + "…"
}

function plainRichText(value) {
  return concise(
    text(value)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  )
}

function pushTarget(targets, appType, itemId, contactId, label, detail) {
  const normalizedItemId = text(itemId)
  if (!normalizedItemId) return
  targets.push({
    appType,
    itemId:normalizedItemId,
    contactId:text(contactId),
    label:concise(label) || "未命名内容",
    detail,
  })
}

export function listChatAppTargets(phoneData) {
  const data = phoneData && typeof phoneData === "object" ? phoneData : {}
  const targets = []

  ;(Array.isArray(data.forumPosts) ? data.forumPosts : []).forEach(item => {
    pushTarget(targets, "forum", item?.id, item?.contactId, item?.title || item?.content, "论坛帖子")
  })
  ;(Array.isArray(data.memos) ? data.memos : []).forEach(item => {
    pushTarget(targets, "memo", item?.id, item?.contactId, plainRichText(item?.content) || item?.time, "备忘录")
  })
  ;(Array.isArray(data.shoppingItems) ? data.shoppingItems : []).forEach(item => {
    const price = Number(item?.price)
    const priceLabel = Number.isFinite(price) && price > 0 ? ` · ¥${price.toFixed(2)}` : ""
    pushTarget(targets, "shopping", item?.id, item?.contactId, `${text(item?.name) || "商品"}${priceLabel}`, item?.status === "order" ? "购物订单" : "购物记录")
  })
  ;(Array.isArray(data.photos) ? data.photos : []).forEach(item => {
    pushTarget(targets, "gallery", item?.id, item?.contactId, item?.caption || item?.title || item?.time, "相册照片")
  })
  ;(Array.isArray(data.browserHistory) ? data.browserHistory : []).forEach(item => {
    pushTarget(targets, "browser", item?.id, item?.contactId, item?.title || item?.url, "浏览记录")
  })
  ;(Array.isArray(data.contacts) ? data.contacts : []).forEach(item => {
    pushTarget(targets, "contacts", item?.id, item?.id, item?.name, "联系人")
  })

  return targets
}

export function normalizeChatAppTarget(message) {
  const legacyForumId = text(message?.forumPostId)
  const requestedType = text(message?.targetApp) || (legacyForumId ? "forum" : "")
  const appType = CHAT_APP_TARGET_TYPES.includes(requestedType) ? requestedType : ""
  if (!appType) return { appType:"", itemId:"", contactId:"" }
  const itemId = text(message?.targetItemId || (appType === "forum" ? legacyForumId : ""))
  if (!itemId) return { appType:"", itemId:"", contactId:"" }
  return {
    appType,
    itemId,
    contactId:text(message?.targetContactId),
  }
}

function callQuoteSummary(message) {
  const mode = message?.callMode === "video" ? "视频通话" : "语音通话"
  const outcome = {
    completed:"已通话",
    cancelled:"对方已取消",
    rejected:"对方已拒绝",
    missed:"无人接听",
    busy:"对方忙线",
    interrupted:"通话中断",
    "video-switch":"切换为视频通话",
  }[message?.callStatus]
  return [mode, outcome].filter(Boolean).join(" · ")
}

export function chatMessageQuoteSummary(message) {
  if (!message || typeof message !== "object") return "消息"
  const type = text(message.type) || "text"
  if (type === "text") return concise(message.text) || "文字消息"
  if (type === "image") return "图片"
  if (type === "voice") return `语音${text(message.text) ? `：${concise(message.text, 40)}` : ""}`
  if (type === "link") return `链接：${concise(message.linkTitle || message.text) || "未命名链接"}`
  if (type === "redpacket") return `红包：${text(message.redpacketMsg) || "恭喜发财"}`
  if (type === "transfer") return `转账：¥${Number(message.transferAmount || 0).toFixed(2)}`
  if (type === "familycard") return `亲属卡：${text(message.fcRelation) || "亲人"}`
  if (type === "takeaway") return `外卖：${concise(message.takeawayShop || message.takeawayOrder) || "订单"}`
  if (type === "location") return `位置：${concise(message.locationName || message.text) || "未命名地点"}`
  if (type === "contact-card") return `联系人：${concise(message.contactName) || "名片"}`
  if (type === "file") return `文件：${concise(message.fileName) || "未命名文件"}`
  if (type === "music") return `音乐：${concise(message.musicTitle) || "未命名音乐"}`
  if (type === "forward") return `合并转发：${concise(message.forwardTitle) || "聊天记录"}`
  if (type === "schedule") return `日程：${concise(message.scheduleTitle) || "未命名日程"}`
  if (type === "call") return callQuoteSummary(message)
  if (type === "system-event" || type === "contact-event") return concise(message.text || message.originalText) || "系统消息"
  if (type === "time") return concise(message.time) || "时间"
  return concise(message.text) || "消息"
}

export function messageRequiresAction(message) {
  return Boolean(
    message
    && message.actionRequired === true
    && CHAT_ACTIONABLE_MESSAGE_TYPES.includes(text(message.type)),
  )
}

function actionVerb(message) {
  const type = text(message?.type)
  if (type === "redpacket" || type === "transfer" || type === "familycard" || type === "takeaway") {
    return ["领取", "领取"]
  }
  if (type === "schedule") return ["回应", "回应"]
  if (type === "link" || type === "location" || type === "contact-card" || type === "file" || type === "forward") {
    return ["查看", "查看"]
  }
  return ["打开", "打开"]
}

export function messageActionLabel(message, completed) {
  if (!messageRequiresAction(message)) return ""
  const [pendingVerb, completeVerb] = actionVerb(message)
  return completed ? `已${completeVerb}` : `需${pendingVerb}`
}

export { CHAT_APP_TARGET_TYPES }
