import test from "node:test"
import assert from "node:assert/strict"

import { createPhoneWorkAccess } from "../js/phone-work-access.js"

test("real work ids delegate to the existing data layer", () => {
  const writes = []
  const access = createPhoneWorkAccess({
    readStoredWork: id => ({ id, phoneData: { chats: [] } }),
    updateStoredWork: (id, patch) => {
      writes.push({ id, patch })
      return { id, ...patch }
    },
    createSessionId: () => "one",
    now: () => 10,
  })

  assert.equal(access.getPhoneWork("work-1").id, "work-1")
  assert.deepEqual(
    access.updatePhoneWork("work-1", { title: "x" }),
    { id: "work-1", title: "x" },
  )
  assert.deepEqual(writes, [{ id: "work-1", patch: { title: "x" } }])
})

test("draft writes never reach the formal work", () => {
  const formal = { id: "article-1", type: "article" }
  let writes = 0
  const access = createPhoneWorkAccess({
    readStoredWork: () => formal,
    updateStoredWork: () => { writes += 1 },
    createSessionId: () => "one",
    now: () => 10,
  })
  const draft = access.createPhoneWorkDraft({
    ...formal,
    phoneData: { chats: [] },
  })

  access.updatePhoneWork(draft.id, {
    phoneData: { chats: [{ id: "chat-1" }] },
  })

  assert.equal(writes, 0)
  assert.equal(Object.hasOwn(formal, "phoneData"), false)
  assert.deepEqual(draft.snapshot().phoneData.chats, [{ id: "chat-1" }])
})

test("draft reads, writes, snapshots, and concurrent sessions are clone isolated", () => {
  let nextId = 0
  const access = createPhoneWorkAccess({
    readStoredWork: () => null,
    updateStoredWork: () => null,
    createSessionId: () => String(++nextId),
    now: () => 10,
  })
  const initial = {
    id: "article-1",
    phoneData: { contacts: [{ id: "c1", name: "A" }] },
  }
  const first = access.createPhoneWorkDraft(initial)
  const second = access.createPhoneWorkDraft(initial)

  const read = access.getPhoneWork(first.id)
  read.phoneData.contacts[0].name = "changed outside"
  assert.equal(access.getPhoneWork(first.id).phoneData.contacts[0].name, "A")

  access.updatePhoneWork(first.id, {
    phoneData: { contacts: [{ id: "c1", name: "B" }] },
  })
  const snapshot = first.snapshot()
  snapshot.phoneData.contacts[0].name = "changed snapshot"

  assert.equal(first.snapshot().phoneData.contacts[0].name, "B")
  assert.equal(second.snapshot().phoneData.contacts[0].name, "A")
  assert.equal(first.snapshot().updatedAt, 10)
})

test("disposed and unknown draft ids fail closed", () => {
  const access = createPhoneWorkAccess({
    readStoredWork: id => ({ id, leaked: true }),
    updateStoredWork: () => ({ leaked: true }),
    createSessionId: () => "one",
    now: () => 10,
  })
  const draft = access.createPhoneWorkDraft({ id: "article-1" })

  draft.dispose()
  draft.dispose()

  assert.equal(draft.snapshot(), null)
  assert.equal(access.getPhoneWork(draft.id), null)
  assert.equal(access.updatePhoneWork(draft.id, { leaked: true }), null)
  assert.equal(access.getPhoneWork("phone-draft:missing"), null)
})
