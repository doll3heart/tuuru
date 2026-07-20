import test from "node:test"
import assert from "node:assert/strict"

import { contactDisplayName, resolveContactIdentity } from "../js/contact-identity.js"

test("contact identities use per-App IDs while preserving name fallbacks", () => {
  const contact = {
    id: "contact-1",
    name: "林雾",
    msgId: "雾中来信",
    forumId: "北岸观测员",
    avatarUrl: "https://example.invalid/avatar.png",
  }

  assert.equal(contactDisplayName(contact, "messages"), "雾中来信")
  assert.equal(contactDisplayName(contact, "forum"), "北岸观测员")
  assert.equal(contactDisplayName(contact, "contacts"), "林雾")
  assert.equal(contactDisplayName({ name: "旧联系人" }, "forum"), "旧联系人")

  assert.deepEqual(resolveContactIdentity({ contacts: [contact] }, "contact-1", {
    surface: "forum",
    authoredName: "旧快照名",
    authoredAvatar: "old.png",
  }), {
    contact,
    name: "北岸观测员",
    avatar: "https://example.invalid/avatar.png",
  })

  assert.deepEqual(resolveContactIdentity({ contacts: [] }, "npc-1", {
    surface: "forum",
    authoredName: "匿名 NPC",
    authoredAvatar: "npc.png",
  }), {
    contact: null,
    name: "匿名 NPC",
    avatar: "npc.png",
  })
})
