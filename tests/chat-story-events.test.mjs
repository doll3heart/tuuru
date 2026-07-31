import test from "node:test"
import assert from "node:assert/strict"

import {
  CHAT_STORY_CARD_TYPES,
  CHAT_STORY_EVENT_KINDS,
  applyChatStoryMessage,
  chatStoryMessageLabel,
  createChatStoryState,
  normalizeChatStoryMessage,
  storyEventText,
} from "../js/chat-story-events.js"

function phoneData() {
  return {
    contacts: [
      { id:"contact-1", name:"林晚", avatarUrl:"old.png", note:"旧签名" },
      { id:"contact-2", name:"周周", avatarUrl:"" },
    ],
  }
}

function groupChat() {
  return {
    id:"chat-1",
    type:"group",
    groupName:"夜巡组",
    groupAvatarUrl:"group-old.png",
    contactIds:["contact-1"],
    groupOwnerId:"contact-1",
    groupAdminIds:[],
    groupTitles:{},
  }
}

test("story capability allow-lists expose events and rich cards without treating arbitrary values as valid", () => {
  assert.ok(CHAT_STORY_EVENT_KINDS.includes("recall"))
  assert.ok(CHAT_STORY_EVENT_KINDS.includes("contact-update"))
  assert.ok(CHAT_STORY_EVENT_KINDS.includes("group-rename"))
  assert.ok(CHAT_STORY_CARD_TYPES.includes("location"))
  assert.ok(CHAT_STORY_CARD_TYPES.includes("schedule"))

  const normalized = normalizeChatStoryMessage({ type:"system-event", eventKind:"run-script", text:42 })
  assert.equal(normalized.eventKind, "notice")
  assert.equal(normalized.text, "42")
})

test("message normalization bounds timers and preserves old location data", () => {
  assert.deepEqual(
    normalizeChatStoryMessage({
      type:"system-event",
      eventKind:"typing",
      durationMs:999999,
      burnSeconds:-8,
    }),
    {
      type:"system-event",
      eventKind:"typing",
      text:"",
      durationMs:30000,
      burnSeconds:1,
      allowReveal:false,
      actorContactId:"",
      targetContactId:"",
      secondaryContactId:"",
      targetMessageId:"",
      relationshipState:"",
      reaction:"",
      roleChange:"",
      newName:"",
      newAvatarUrl:"",
      newBio:"",
      originalText:"",
    },
  )

  const location = normalizeChatStoryMessage({ type:"location", locationName:"旧城区", text:"旧城区" })
  assert.equal(location.locationName, "旧城区")
  assert.equal(location.locationAddress, "")
})

test("contact and group events apply to detached runtime state", () => {
  const data = phoneData()
  const chat = groupChat()
  const originalData = structuredClone(data)
  const originalChat = structuredClone(chat)
  let state = createChatStoryState(data, chat)

  state = applyChatStoryMessage(state, {
    type:"contact-event",
    eventKind:"contact-update",
    targetContactId:"contact-1",
    newName:"林雾",
    newAvatarUrl:"new.png",
    newBio:"正在离线",
  })
  state = applyChatStoryMessage(state, {
    type:"contact-event",
    eventKind:"relationship",
    targetContactId:"contact-1",
    relationshipState:"blocked",
  })
  state = applyChatStoryMessage(state, {
    type:"system-event",
    eventKind:"group-rename",
    newName:"凌晨三点",
  })
  state = applyChatStoryMessage(state, {
    type:"system-event",
    eventKind:"group-join",
    targetContactId:"contact-2",
  })
  state = applyChatStoryMessage(state, {
    type:"system-event",
    eventKind:"admin-change",
    targetContactId:"contact-2",
    roleChange:"add",
  })

  assert.equal(state.contacts.find(contact => contact.id === "contact-1").name, "林雾")
  assert.equal(state.contacts.find(contact => contact.id === "contact-1").avatarUrl, "new.png")
  assert.equal(state.contacts.find(contact => contact.id === "contact-1").note, "正在离线")
  assert.equal(state.relationships["contact-1"], "blocked")
  assert.equal(state.group.groupName, "凌晨三点")
  assert.deepEqual(state.group.contactIds, ["contact-1", "contact-2"])
  assert.deepEqual(state.group.groupAdminIds, ["contact-2"])
  assert.deepEqual(data, originalData)
  assert.deepEqual(chat, originalChat)
})

test("leaving, removing, ownership, avatar, and titles update group runtime state safely", () => {
  let state = createChatStoryState(phoneData(), {
    ...groupChat(),
    contactIds:["contact-1", "contact-2"],
    groupAdminIds:["contact-2"],
  })
  state = applyChatStoryMessage(state, { type:"system-event", eventKind:"owner-transfer", targetContactId:"contact-2" })
  state = applyChatStoryMessage(state, { type:"system-event", eventKind:"group-avatar", newAvatarUrl:"new-group.png" })
  state = applyChatStoryMessage(state, { type:"system-event", eventKind:"group-title", targetContactId:"contact-2", newName:"守夜人" })
  state = applyChatStoryMessage(state, { type:"system-event", eventKind:"group-leave", targetContactId:"contact-1" })

  assert.equal(state.group.groupOwnerId, "contact-2")
  assert.equal(state.group.groupAvatarUrl, "new-group.png")
  assert.equal(state.group.groupTitles["contact-2"], "守夜人")
  assert.deepEqual(state.group.contactIds, ["contact-2"])
})

test("story labels cover recall, call outcomes, and every rich-card family", () => {
  assert.match(chatStoryMessageLabel({ type:"system-event", eventKind:"recall", originalText:"别回头" }), /撤回/)
  assert.match(chatStoryMessageLabel({ type:"call", callMode:"video", callStatus:"rejected" }), /拒绝/)
  assert.match(chatStoryMessageLabel({ type:"location", locationName:"白石街" }), /白石街/)
  assert.match(chatStoryMessageLabel({ type:"contact-card", contactName:"林晚" }), /林晚/)
  assert.match(chatStoryMessageLabel({ type:"file", fileName:"值班表.pdf" }), /值班表/)
  assert.match(chatStoryMessageLabel({ type:"music", musicTitle:"失眠航线" }), /失眠航线/)
  assert.match(chatStoryMessageLabel({ type:"forward", forwardTitle:"聊天记录" }), /聊天记录/)
  assert.match(chatStoryMessageLabel({ type:"schedule", scheduleTitle:"去车站" }), /去车站/)
})

test("system-event copy remains readable when author fields are incomplete", () => {
  assert.equal(storyEventText({ type:"system-event", eventKind:"typing", actorName:"林晚" }), "林晚正在输入…")
  assert.equal(storyEventText({ type:"system-event", eventKind:"recall", actorName:"林晚" }), "林晚撤回了一条消息")
  assert.equal(storyEventText({ type:"system-event", eventKind:"group-join", actorName:"林晚" }), "林晚加入了群聊")
  assert.equal(storyEventText({ type:"contact-event", eventKind:"relationship", actorName:"林晚", relationshipState:"blocked" }), "林晚已将你拉黑")
})
