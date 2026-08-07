import test from "node:test"
import assert from "node:assert/strict"

import { createContactFriendRequest } from "../js/contact-friend-request.js"

function phoneData(overrides = {}) {
  return {
    contacts:[{ id:"contact-a", name:"林雾" }],
    chats:[],
    readingFlow:{ enabled:false, sequence:[] },
    ...overrides,
  }
}

function ids(...values) {
  let index = 0
  return () => values[index++]
}

test("creating a contact friend request adds a private chat and puts its notification first", () => {
  const source = phoneData()
  const result = createContactFriendRequest(source, "contact-a", {
    verificationText:"我是林雾，昨晚见过。",
    createId:ids("chat-new", "round-new", "request-new"),
    createdAt:"2026/8/7 10:00:00",
  })

  assert.equal(result.created, true)
  assert.equal(result.chatId, "chat-new")
  assert.equal(result.messageId, "request-new")
  assert.equal(result.phoneData.chats[0].type, "single")
  assert.deepEqual(result.phoneData.chats[0].contactIds, ["contact-a"])
  assert.deepEqual(result.phoneData.chats[0].rounds[0].messages[0], {
    id:"request-new",
    type:"contact-event",
    eventKind:"friend-request",
    senderId:"system",
    actorContactId:"contact-a",
    originalText:"我是林雾，昨晚见过。",
    actionRequired:true,
    time:"2026/8/7 10:00:00",
  })
  assert.equal(result.phoneData.readingFlow.enabled, true)
  assert.deepEqual(result.phoneData.readingFlow.sequence[0], {
    type:"messages",
    itemId:"request-new",
    chatId:"chat-new",
    roundId:"round-new",
    contactId:"contact-a",
    label:"林雾 · 好友申请",
  })
  assert.deepEqual(source, phoneData())
})

test("creating a request reuses the contact chat and places it before that chat's existing flow", () => {
  const source = phoneData({
    chats:[{
      id:"chat-a",
      type:"single",
      contactIds:["contact-a"],
      messages:[],
      rounds:[{ id:"round-old", label:"第一轮", messages:[{ id:"hello", type:"text", text:"你好" }] }],
    }],
    readingFlow:{ enabled:true, sequence:[
      { type:"memo", itemId:"memo-a", label:"备忘" },
      { type:"messages", itemId:"hello", chatId:"chat-a", roundId:"round-old", contactId:"contact-a", label:"林雾 · 你好" },
    ] },
  })

  const result = createContactFriendRequest(source, "contact-a", {
    createId:ids("round-request", "request-a"),
    createdAt:"刚刚",
  })

  assert.equal(result.chatId, "chat-a")
  assert.equal(result.phoneData.chats[0].rounds[0].id, "round-request")
  assert.equal(result.phoneData.chats[0].rounds[1].id, "round-old")
  assert.deepEqual(result.phoneData.readingFlow.sequence.map(step => step.itemId), ["memo-a", "request-a", "hello"])
})

test("a missing or ambiguous contact does not create a friend request", () => {
  assert.equal(createContactFriendRequest(phoneData(), "missing").created, false)
  assert.equal(createContactFriendRequest(phoneData({ contacts:[{ id:"same" }, { id:"same" }] }), "same").created, false)
})
