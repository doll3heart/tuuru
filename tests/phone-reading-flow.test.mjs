import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPhoneReadingFlowSequence,
  normalizePhoneReadingFlow,
  resolvePhoneReadingFlowStep,
} from "../js/phone-reading-flow.js"

function phoneData() {
  return {
    contacts: [{ id: "contact-1", name: "林澈" }],
    chats: [{
      id: "chat-1",
      contactIds: ["contact-1"],
      rounds: [{
        id: "round-1",
        messages: [
          { id: "message-1", type: "text", senderId: "contact-1", text: "先看消息" },
          { id: "call-1", type: "call", callMode: "voice", senderId: "contact-1", callLines: ["再接电话"] },
        ],
      }],
    }],
    memos: [{ id: "memo-1", contactId: "contact-1", content: "最后看备忘录" }],
    shoppingItems: [], forumPosts: [], moments: [], photos: [], browserHistory: [],
  }
}

test("the author reading-flow builder keeps every chat field in authored order", () => {
  const sequence = buildPhoneReadingFlowSequence(phoneData())
  const messageSteps = sequence.filter(step => step.type === "messages")

  assert.deepEqual(messageSteps.map(step => step.itemId), ["message-1", "call-1"])
  assert.deepEqual(messageSteps.map(step => step.roundId), ["round-1", "round-1"])
  assert.match(messageSteps[1].label, /语音通话/)
})

test("reader flow normalization expands a legacy round into its individual fields", () => {
  const data = phoneData()
  data.readingFlow = {
    enabled: true,
    sequence: [
      { type: "messages", itemId: "round-1", chatId: "chat-1", label: "旧作品第一轮" },
      { type: "messages", itemId: "missing", chatId: "chat-1", label: "已删除" },
      { type: "memo", itemId: "memo-1", label: "备忘录" },
    ],
  }

  const normalized = normalizePhoneReadingFlow(data)
  assert.equal(normalized.enabled, true)
  assert.deepEqual(normalized.sequence.map(step => step.itemId), ["message-1", "call-1", "memo-1"])
  assert.deepEqual(normalized.sequence.slice(0, 2).map(step => step.roundId), ["round-1", "round-1"])
  assert.equal(resolvePhoneReadingFlowStep(data, normalized.sequence[0]).kind, "message")
})

test("reading flow excludes content owned by hidden or removed apps", () => {
  const data = phoneData()
  data.shoppingItems = [{ id: "shopping-1", contactId: "contact-1", name: "手账胶带" }]
  data.forumPosts = [{ id: "forum-1", contactId: "contact-1", title: "已经删除的论坛" }]
  data.moments = [{ id: "moment-1", contactId: "contact-1", content: "隐藏消息 App 里的动态" }]
  data.apps = [
    { id: "messages-app", type: "messages", enabled: false },
    { id: "memo-app", type: "memo", enabled: true },
    { id: "shopping-app", type: "shopping", enabled: true },
  ]
  data.readingFlow = {
    enabled: true,
    sequence: [
      { type: "messages", itemId: "round-1", chatId: "chat-1", label: "隐藏消息" },
      { type: "moments", itemId: "moment-1", label: "隐藏动态" },
      { type: "forum", itemId: "forum-1", label: "已删除 App" },
      { type: "memo", itemId: "memo-1", label: "保留备忘录" },
      { type: "shopping", itemId: "shopping-1", label: "保留购物" },
    ],
  }

  assert.deepEqual(
    buildPhoneReadingFlowSequence(data).map(step => step.itemId),
    ["memo-1", "shopping-1"],
  )
  assert.deepEqual(
    normalizePhoneReadingFlow(data).sequence.map(step => step.itemId),
    ["memo-1", "shopping-1"],
  )
})
