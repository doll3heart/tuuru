import test from "node:test"
import assert from "node:assert/strict"

import { contactDisplayName, listForumIdentities, resolveContactIdentity } from "../js/contact-identity.js"

test("contact identities use per-App IDs while preserving name fallbacks", () => {
  const contact = {
    id: "contact-1",
    name: "林雾",
    msgId: "雾中来信",
    forumId: "北岸观测员",
    avatarUrl: "https://example.invalid/avatar.png",
    messageAvatarUrl: "https://example.invalid/message.png",
    forumAvatarUrl: "https://example.invalid/forum.png",
    forumIpLocation: "上海",
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
    avatar: "https://example.invalid/forum.png",
    ipLocation: "上海",
  })

  assert.deepEqual(resolveContactIdentity({ contacts: [] }, "npc-1", {
    surface: "forum",
    authoredName: "匿名 NPC",
    authoredAvatar: "npc.png",
  }), {
    contact: null,
    name: "匿名 NPC",
    avatar: "npc.png",
    ipLocation: "",
  })

  assert.equal(resolveContactIdentity({ contacts: [contact] }, "contact-1", { surface:"messages" }).avatar, "https://example.invalid/message.png")
  assert.equal(resolveContactIdentity({ contacts: [contact] }, "contact-1", { surface:"contacts" }).avatar, "https://example.invalid/avatar.png")
})

test("forum identities include contact aliases and resolve their own names and avatars", () => {
  const contact = {
    id:"contact-1", name:"林雾", forumId:"北岸观测员", avatarUrl:"main.png", forumAvatarUrl:"forum.png", forumIpLocation:"浙江",
    aliases:[
      { id:"alias-1", name:"匿名马甲", forumId:"无名路人", avatarUrl:"alias.png", forumIpLocation:"北京" },
      { id:"alias-2", name:"备用号", forumId:"", avatarUrl:"" },
    ],
  }
  assert.deepEqual(listForumIdentities({ contacts:[contact] }), [
    { contactId:"contact-1", aliasId:"", name:"北岸观测员", avatar:"forum.png", ipLocation:"浙江", parentName:"林雾" },
    { contactId:"contact-1", aliasId:"alias-1", name:"无名路人", avatar:"alias.png", ipLocation:"北京", parentName:"林雾" },
    { contactId:"contact-1", aliasId:"alias-2", name:"备用号", avatar:"forum.png", ipLocation:"浙江", parentName:"林雾" },
  ])
  assert.deepEqual(resolveContactIdentity({ contacts:[contact] }, "contact-1", {
    surface:"forum", aliasId:"alias-1", authoredName:"旧马甲", authoredAvatar:"old.png",
  }), { contact, name:"无名路人", avatar:"alias.png", ipLocation:"北京" })
})

test("forum NPC identities resolve their own avatar and IP location", () => {
  const npc = { id:"npc-1", name:"路人甲", avatarUrl:"npc.png", ipLocation:"广东" }
  assert.deepEqual(resolveContactIdentity({ contacts:[], forumNpcs:[npc] }, "npc-1", {
    surface:"forum", authoredName:"旧名字", authoredAvatar:"old.png", authoredIpLocation:"旧属地",
  }), { contact:null, npc, name:"路人甲", avatar:"npc.png", ipLocation:"广东" })
})
