import test from "node:test"
import assert from "node:assert/strict"

import { orderedContacts, reorderContacts } from "../js/contact-order.js"

const contacts = () => [
  { id:"c", name:"周周", pinned:false },
  { id:"a", name:"安安", pinned:true },
  { id:"b", name:"白白", pinned:false },
  { id:"d", name:"丁丁", pinned:true },
]

test("contact ordering keeps pinned contacts first in custom and A-Z modes", () => {
  const source = contacts()
  assert.deepEqual(orderedContacts(source, "custom").map(contact => contact.id), ["a", "d", "c", "b"])
  assert.deepEqual(orderedContacts(source, "az").map(contact => contact.id), ["a", "d", "b", "c"])
  assert.deepEqual(source.map(contact => contact.id), ["c", "a", "b", "d"])
})

test("custom contact reordering is stable and cannot cross the pinned boundary", () => {
  const source = contacts()
  const moved = reorderContacts(source, "c", "b", "after")
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.contacts.map(contact => contact.id), ["a", "d", "b", "c"])
  assert.equal(reorderContacts(source, "a", "b", "before").ok, false)
  assert.deepEqual(source.map(contact => contact.id), ["c", "a", "b", "d"])
})
