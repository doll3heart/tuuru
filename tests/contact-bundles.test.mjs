import test from "node:test"
import assert from "node:assert/strict"

import {
  CONTACT_BUNDLE_TYPE,
  CONTACT_BUNDLE_VERSION,
  mergeContactBundle,
  parseContactBundle,
  serializeContactBundle,
} from "../js/contact-bundles.js"

const contact = {
  id: "contact-a",
  name: "林雾",
  alias: "小雾",
  aliases: [{
    id: "account-a",
    name: "匿名小号",
    forumId: "mist-alt",
    avatarUrl: "https://example.invalid/alt.png",
    forumIpLocation: "上海",
    ignored: "drop-me",
  }],
  avatarUrl: "https://example.invalid/card.png",
  messageAvatarUrl: "https://example.invalid/message.png",
  forumAvatarUrl: "https://example.invalid/forum.png",
  forumIpLocation: "浙江",
  pinned: true,
  note: "大学同学",
  faceUrl: "https://example.invalid/call-background.png",
  msgId: "mist-message",
  forumId: "mist-forum",
  future: { private: true },
}

test("contact bundles round-trip the supported author fields with explicit metadata", () => {
  const serialized = serializeContactBundle([contact], { now: () => 123 })
  const bundle = parseContactBundle(serialized)

  assert.equal(bundle.type, CONTACT_BUNDLE_TYPE)
  assert.equal(bundle.version, CONTACT_BUNDLE_VERSION)
  assert.equal(bundle.exportedAt, 123)
  assert.equal(bundle.contacts.length, 1)
  assert.deepEqual(bundle.contacts[0], {
    id: "contact-a",
    name: "林雾",
    alias: "小雾",
    aliases: [{
      id: "account-a",
      name: "匿名小号",
      forumId: "mist-alt",
      avatarUrl: "https://example.invalid/alt.png",
      forumIpLocation: "上海",
    }],
    avatarUrl: "https://example.invalid/card.png",
    messageAvatarUrl: "https://example.invalid/message.png",
    forumAvatarUrl: "https://example.invalid/forum.png",
    forumIpLocation: "浙江",
    pinned: true,
    note: "大学同学",
    faceUrl: "https://example.invalid/call-background.png",
    msgId: "mist-message",
    forumId: "mist-forum",
  })
})

test("contact bundle parsing rejects unrelated, unsupported, and malformed packets", () => {
  assert.throws(() => parseContactBundle("not json"), /联系人包/)
  assert.throws(() => parseContactBundle('{"type":"other","version":1,"contacts":[]}'), /联系人包/)
  assert.throws(() => parseContactBundle(`{"type":"${CONTACT_BUNDLE_TYPE}","version":2,"contacts":[]}`), /版本/)
  assert.throws(() => parseContactBundle(`{"type":"${CONTACT_BUNDLE_TYPE}","version":1,"contacts":{}}`), /联系人包/)
})

test("contact bundle merge appends records and reassigns colliding contact and account ids", () => {
  const existing = [{
    id: "contact-a",
    name: "原联系人",
    aliases: [{ id: "account-a", name: "原小号" }],
  }]
  const generated = ["contact-imported", "account-imported"]
  const merged = mergeContactBundle(existing, serializeContactBundle([contact]), {
    idFactory: () => generated.shift(),
  })

  assert.equal(merged.added, 1)
  assert.equal(merged.reassignedIds, 2)
  assert.equal(merged.contacts.length, 2)
  assert.deepEqual(merged.contacts[0], existing[0])
  assert.notEqual(merged.contacts[0], existing[0])
  assert.equal(merged.contacts[1].id, "contact-imported")
  assert.equal(merged.contacts[1].aliases[0].id, "account-imported")
  assert.equal(existing.length, 1, "the target array must not be mutated")
})

test("contact bundle merge preserves non-colliding imported ids and accepts parsed packets", () => {
  const bundle = parseContactBundle(serializeContactBundle([contact]))
  const merged = mergeContactBundle([{ id: "contact-z", name: "周周", aliases: [] }], bundle)

  assert.equal(merged.added, 1)
  assert.equal(merged.reassignedIds, 0)
  assert.equal(merged.contacts[1].id, "contact-a")
  assert.equal(merged.contacts[1].aliases[0].id, "account-a")
})

test("contact and small-account ids share one collision domain", () => {
  const bundle = serializeContactBundle([{
    id: "existing-account",
    name: "导入联系人",
    aliases: [{ id:"existing-contact", name:"导入小号" }],
  }])
  const generated = ["fresh-contact", "fresh-account"]
  const merged = mergeContactBundle([{
    id: "existing-contact",
    name: "原联系人",
    aliases: [{ id:"existing-account", name:"原小号" }],
  }], bundle, { idFactory:() => generated.shift() })

  assert.equal(merged.contacts[1].id, "fresh-contact")
  assert.equal(merged.contacts[1].aliases[0].id, "fresh-account")
  assert.equal(merged.reassignedIds, 2)
})
