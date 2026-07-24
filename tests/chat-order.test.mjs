import test from "node:test"
import assert from "node:assert/strict"

import {
  orderedChats,
  reorderChats,
  toggleChatPinned,
} from "../js/chat-order.js"

const CHATS = Object.freeze([
  Object.freeze({ id:"normal-a", groupName:"普通 A" }),
  Object.freeze({ id:"pinned-a", groupName:"置顶 A", pinned:true }),
  Object.freeze({ id:"normal-b", groupName:"普通 B" }),
  Object.freeze({ id:"pinned-b", groupName:"置顶 B", pinned:true }),
])

test("chat ordering keeps pinned conversations first and preserves authored order", () => {
  assert.deepEqual(orderedChats(CHATS).map(chat => chat.id), ["pinned-a", "pinned-b", "normal-a", "normal-b"])
  assert.deepEqual(CHATS.map(chat => chat.id), ["normal-a", "pinned-a", "normal-b", "pinned-b"])
  assert.deepEqual(orderedChats(null), [])
})

test("pinning moves a conversation into its section without mutating input", () => {
  const pinned = toggleChatPinned(CHATS, "normal-b")
  assert.equal(pinned.ok, true)
  assert.deepEqual(pinned.chats.map(chat => chat.id), ["normal-b", "pinned-a", "pinned-b", "normal-a"])
  assert.equal(pinned.chats[0].pinned, true)
  assert.equal(CHATS[2].pinned, undefined)

  const unpinned = toggleChatPinned(pinned.chats, "pinned-a")
  assert.equal(unpinned.ok, true)
  assert.deepEqual(unpinned.chats.map(chat => chat.id), ["normal-b", "pinned-b", "pinned-a", "normal-a"])
  assert.equal(unpinned.chats[2].pinned, false)
})

test("manual chat reorder works inside a pin group and rejects crossing its boundary", () => {
  const moved = reorderChats(CHATS, "pinned-b", "pinned-a", "before")
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.chats.map(chat => chat.id), ["pinned-b", "pinned-a", "normal-a", "normal-b"])

  assert.deepEqual(reorderChats(CHATS, "normal-a", "pinned-a", "before"), {
    ok:false,
    reason:"pin-boundary",
    chats:orderedChats(CHATS),
  })
  assert.equal(reorderChats(CHATS, "missing", "normal-a", "after").ok, false)
})
