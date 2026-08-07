function items(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return String(value ?? "").trim()
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

function singleContactChat(chat, contactId) {
  return chat?.type === "single"
    && items(chat.contactIds).length === 1
    && sameId(chat.contactIds[0], contactId)
}

export function createContactFriendRequest(phoneData, contactId, options = {}) {
  const next = cloneJson(phoneData, {})
  const normalizedContactId = text(contactId)
  const contacts = items(next.contacts)
  const matches = contacts.filter(contact => sameId(contact?.id, normalizedContactId))
  if (!normalizedContactId || matches.length !== 1) {
    return { created:false, phoneData:next, chatId:"", messageId:"" }
  }

  const createId = typeof options.createId === "function"
    ? options.createId
    : () => `friend-request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const contact = matches[0]
  const chats = items(next.chats)
  let chat = chats.find(candidate => singleContactChat(candidate, normalizedContactId)) || null
  let chatId = text(chat?.id)
  if (!chat) {
    chatId = text(createId())
    if (!chatId) return { created:false, phoneData:next, chatId:"", messageId:"" }
    chat = {
      id:chatId,
      type:"single",
      contactIds:[normalizedContactId],
      groupName:"",
      messages:[],
      rounds:[],
    }
    chats.push(chat)
  }

  const roundId = text(createId())
  const messageId = text(createId())
  if (!roundId || !messageId) return { created:false, phoneData:next, chatId:"", messageId:"" }
  const request = {
    id:messageId,
    type:"contact-event",
    eventKind:"friend-request",
    senderId:"system",
    actorContactId:normalizedContactId,
    originalText:text(options.verificationText),
    actionRequired:true,
    time:text(options.createdAt) || new Date().toLocaleString(),
  }
  chat.rounds = [{ id:roundId, label:"好友申请", messages:[request] }, ...items(chat.rounds)]
  chat.messages = items(chat.messages)
  next.chats = chats

  const previousFlow = next.readingFlow && typeof next.readingFlow === "object"
    ? next.readingFlow
    : {}
  const sequence = items(previousFlow.sequence)
  const step = {
    type:"messages",
    itemId:messageId,
    chatId,
    roundId,
    contactId:normalizedContactId,
    label:`${text(contact.name) || "联系人"} · 好友申请`,
  }
  const firstChatStep = sequence.findIndex(candidate => sameId(candidate?.chatId, chatId))
  sequence.splice(firstChatStep >= 0 ? firstChatStep : sequence.length, 0, step)
  next.readingFlow = { ...previousFlow, enabled:true, sequence }

  return { created:true, phoneData:next, chatId, messageId }
}
