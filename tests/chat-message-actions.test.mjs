import test from "node:test"
import assert from "node:assert/strict"

import {
  CHAT_ACTIONABLE_MESSAGE_TYPES,
  chatMessageQuoteSummary,
  listChatAppTargets,
  messageActionLabel,
  messageRequiresAction,
  normalizeChatAppTarget,
} from "../js/chat-message-actions.js"

test("chat App targets expose authored content with stable destination metadata", () => {
  const targets = listChatAppTargets({
    forumPosts:[{ id:"post-1", title:"北门值班记录", contactId:"contact-1" }],
    memos:[{ id:"memo-1", content:"<p>钥匙放在花盆下。</p>", contactId:"contact-1" }],
    shoppingItems:[{ id:"order-1", name:"旧站钥匙", price:23.17, status:"order", contactId:"contact-1" }],
    photos:[{ id:"photo-1", caption:"北门监控", contactId:"contact-1" }],
    browserHistory:[{ id:"history-1", title:"末班车时刻表", url:"https://example.com", contactId:"contact-1" }],
    contacts:[{ id:"contact-1", name:"林晚" }],
  })

  assert.deepEqual(targets.map(item => item.appType), [
    "forum",
    "memo",
    "shopping",
    "gallery",
    "browser",
    "contacts",
  ])
  assert.deepEqual(targets[1], {
    appType:"memo",
    itemId:"memo-1",
    contactId:"contact-1",
    label:"钥匙放在花盆下。",
    detail:"备忘录",
  })
})

test("legacy forum links normalize into the shared App destination", () => {
  assert.deepEqual(normalizeChatAppTarget({ forumPostId:"post-1" }), {
    appType:"forum",
    itemId:"post-1",
    contactId:"",
  })
  assert.deepEqual(normalizeChatAppTarget({
    targetApp:"memo",
    targetItemId:"memo-1",
    targetContactId:"contact-1",
  }), {
    appType:"memo",
    itemId:"memo-1",
    contactId:"contact-1",
  })
  assert.deepEqual(normalizeChatAppTarget({ targetApp:"unknown", targetItemId:"x" }), {
    appType:"",
    itemId:"",
    contactId:"",
  })
})

test("quote summaries remain concise across rich message families", () => {
  assert.equal(chatMessageQuoteSummary({ type:"text", text:"今晚别走北门。" }), "今晚别走北门。")
  assert.equal(chatMessageQuoteSummary({ type:"image" }), "图片")
  assert.equal(chatMessageQuoteSummary({ type:"voice", text:"小心身后。" }), "语音：小心身后。")
  assert.equal(chatMessageQuoteSummary({ type:"file", fileName:"线索.pdf" }), "文件：线索.pdf")
  assert.equal(chatMessageQuoteSummary({ type:"location", locationName:"白石街" }), "位置：白石街")
  assert.equal(chatMessageQuoteSummary({ type:"schedule", scheduleTitle:"车站接应" }), "日程：车站接应")
  assert.equal(chatMessageQuoteSummary({ type:"call", callMode:"video", callStatus:"missed" }), "视频通话 · 无人接听")
})

test("required message actions expose a verb that matches the interaction", () => {
  assert.equal(CHAT_ACTIONABLE_MESSAGE_TYPES.includes("location"), true)
  assert.equal(messageRequiresAction({ type:"location", actionRequired:true }), true)
  assert.equal(messageRequiresAction({ type:"text", actionRequired:true }), false)
  assert.equal(messageActionLabel({ type:"location", actionRequired:true }, false), "需查看")
  assert.equal(messageActionLabel({ type:"redpacket", actionRequired:true }, true), "已领取")
  assert.equal(messageActionLabel({ type:"schedule", actionRequired:true }, false), "需回应")
  assert.equal(messageActionLabel({ type:"link", actionRequired:false }, false), "")
})
