import test from "node:test"
import assert from "node:assert/strict"

import {
  applyThreadChoice,
  rollbackThreadChoice,
} from "../js/thread-choice-runtime.js"

function fixtureItems() {
  return [
    { id: "before", kind: "authored", text: "Before" },
    {
      id: "owner",
      kind: "prompt",
      text: "Choose",
      metadata: { untouched: true },
      choices: [
        {
          id: "choice-a",
          text: "Answer A",
          replyText: "My answer",
          metadata: { route: "a" },
          followUpMessages: [
            { kind: "character", text: "First", metadata: { tone: "warm" } },
            { kind: "character", text: "Second" },
          ],
        },
        {
          id: "choice-b",
          text: "Stay quiet",
          replyText: "",
          followUpMessages: [
            { kind: "character", text: "Silence is an answer." },
          ],
        },
      ],
    },
    { id: "authored-after", kind: "authored", text: "Already authored later" },
  ]
}

function callbacks() {
  return {
    createReply({ id, owner, choice }) {
      return {
        id,
        kind: "reader-reply",
        ownerId: owner.id,
        choiceId: choice.id,
        text: choice.replyText,
      }
    },
    createFollowUp({ id, owner, choice, template, index }) {
      return {
        ...template,
        id,
        ownerId: owner.id,
        choiceId: choice.id,
        followUpIndex: index,
      }
    },
  }
}

test("inserts the reply and follow-ups immediately after the unique owner", () => {
  const items = fixtureItems()
  const snapshot = structuredClone(items)
  let sequence = 0
  const seen = []

  const result = applyThreadChoice(items, "owner", 0, {
    idFactory: () => `generated-${++sequence}`,
    createReply(payload) {
      seen.push({ type: "reply", payload })
      assert.notEqual(payload.owner, items[1])
      assert.notEqual(payload.choice, items[1].choices[0])
      payload.owner.metadata.untouched = false
      payload.choice.metadata.route = "mutated-copy"
      return callbacks().createReply(payload)
    },
    createFollowUp(payload) {
      seen.push({ type: "follow-up", payload })
      assert.notEqual(payload.owner, items[1])
      assert.notEqual(payload.choice, items[1].choices[0])
      assert.notEqual(
        payload.template,
        items[1].choices[0].followUpMessages[payload.index],
      )
      if (payload.template.metadata) payload.template.metadata.tone = "mutated-copy"
      return callbacks().createFollowUp(payload)
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.items.map(item => item.id),
    [
      "before",
      "owner",
      "generated-1",
      "generated-2",
      "generated-3",
      "authored-after",
    ],
  )
  assert.deepEqual(result.items.slice(2, 5), [
    {
      id: "generated-1",
      kind: "reader-reply",
      ownerId: "owner",
      choiceId: "choice-a",
      text: "My answer",
    },
    {
      id: "generated-2",
      kind: "character",
      text: "First",
      metadata: { tone: "mutated-copy" },
      ownerId: "owner",
      choiceId: "choice-a",
      followUpIndex: 0,
    },
    {
      id: "generated-3",
      kind: "character",
      text: "Second",
      ownerId: "owner",
      choiceId: "choice-a",
      followUpIndex: 1,
    },
  ])
  assert.deepEqual(
    seen.map(entry => entry.type),
    ["reply", "follow-up", "follow-up"],
  )
  assert.deepEqual(result.run, {
    ownerItemId: "owner",
    choiceIndex: 0,
    generatedItemIds: ["generated-1", "generated-2", "generated-3"],
    replyItemId: "generated-1",
  })
  assert.deepEqual(items, snapshot)
})

test("an empty reply skips createReply and does not consume a reply id", () => {
  const items = fixtureItems()
  let ids = 0
  let replyCalls = 0

  const result = applyThreadChoice(items, "owner", 1, {
    idFactory: () => `silent-${++ids}`,
    createReply() {
      replyCalls += 1
      return { id: "should-not-exist" }
    },
    createFollowUp: callbacks().createFollowUp,
  })

  assert.equal(result.ok, true)
  assert.equal(ids, 1)
  assert.equal(replyCalls, 0)
  assert.deepEqual(
    result.items.map(item => item.id),
    ["before", "owner", "silent-1", "authored-after"],
  )
  assert.deepEqual(result.run.generatedItemIds, ["silent-1"])
  assert.equal(result.run.replyItemId, null)
})

test("rollback removes only generated ids and keeps authored items", () => {
  const items = fixtureItems()
  let id = 0
  const applied = applyThreadChoice(items, "owner", 0, {
    idFactory: () => `run-${++id}`,
    ...callbacks(),
  })
  assert.equal(applied.ok, true)
  const playedItems = [
    ...applied.items,
    { id: "authored-appended", kind: "authored", text: "Keep me too" },
  ]
  const itemsSnapshot = structuredClone(playedItems)
  const runSnapshot = structuredClone(applied.run)

  const rolledBack = rollbackThreadChoice(playedItems, applied.run)

  assert.deepEqual(
    rolledBack.map(item => item.id),
    ["before", "owner", "authored-after", "authored-appended"],
  )
  assert.deepEqual(playedItems, itemsSnapshot)
  assert.deepEqual(applied.run, runSnapshot)
})

test("a rolled-back thread can apply a different choice", () => {
  const items = fixtureItems()
  let firstId = 0
  const first = applyThreadChoice(items, "owner", 0, {
    idFactory: () => `first-${++firstId}`,
    ...callbacks(),
  })
  assert.equal(first.ok, true)

  const rolledBack = rollbackThreadChoice(first.items, first.run)
  const reselection = applyThreadChoice(rolledBack, "owner", 1, {
    idFactory: () => "second-1",
    ...callbacks(),
  })

  assert.equal(reselection.ok, true)
  assert.deepEqual(
    reselection.items.map(item => item.id),
    ["before", "owner", "second-1", "authored-after"],
  )
})

test("rejects missing or duplicate owners and owners without choices", () => {
  const items = fixtureItems()
  const snapshot = structuredClone(items)
  const duplicate = [...items, structuredClone(items[1])]
  const withoutChoices = items.map(item => (
    item.id === "owner" ? { id: "owner", text: "No choices" } : item
  ))
  const options = { idFactory: () => "unused", ...callbacks() }

  assert.deepEqual(
    applyThreadChoice(items, "missing", 0, options),
    { ok: false, reason: "owner-item-not-found" },
  )
  assert.deepEqual(
    applyThreadChoice(duplicate, "owner", 0, options),
    { ok: false, reason: "owner-item-ambiguous" },
  )
  assert.deepEqual(
    applyThreadChoice(withoutChoices, "owner", 0, options),
    { ok: false, reason: "owner-choices-required" },
  )
  assert.deepEqual(items, snapshot)
})

test("rejects an invalid choice or missing id factory before callbacks run", () => {
  const items = fixtureItems()
  const snapshot = structuredClone(items)
  let calls = 0
  const createReply = () => {
    calls += 1
    return { id: "unused" }
  }

  assert.deepEqual(
    applyThreadChoice(items, "owner", 99, {
      idFactory: () => "unused",
      createReply,
      createFollowUp: callbacks().createFollowUp,
    }),
    { ok: false, reason: "choice-not-found" },
  )
  assert.deepEqual(
    applyThreadChoice(items, "owner", 0, {
      createReply,
      createFollowUp: callbacks().createFollowUp,
    }),
    { ok: false, reason: "id-factory-required" },
  )
  assert.equal(calls, 0)
  assert.deepEqual(items, snapshot)
})

test("rejects missing creation callbacks before allocating ids", () => {
  const items = fixtureItems()
  let idCalls = 0
  const idFactory = () => `unused-${++idCalls}`

  assert.deepEqual(
    applyThreadChoice(items, "owner", 0, {
      idFactory,
      createFollowUp: callbacks().createFollowUp,
    }),
    { ok: false, reason: "create-reply-required" },
  )
  assert.deepEqual(
    applyThreadChoice(items, "owner", 1, {
      idFactory,
      createReply: callbacks().createReply,
    }),
    { ok: false, reason: "create-follow-up-required" },
  )
  assert.equal(idCalls, 0)
})

test("rejects invalid callback results atomically", () => {
  const items = fixtureItems()
  const snapshot = structuredClone(items)

  const invalidReply = applyThreadChoice(items, "owner", 0, {
    idFactory: (() => {
      let id = 0
      return () => `invalid-reply-${++id}`
    })(),
    createReply: () => null,
    createFollowUp: callbacks().createFollowUp,
  })
  assert.deepEqual(invalidReply, { ok: false, reason: "invalid-reply-item" })

  const invalidFollowUp = applyThreadChoice(items, "owner", 1, {
    idFactory: () => "invalid-follow-up-1",
    createReply: callbacks().createReply,
    createFollowUp: () => [],
  })
  assert.deepEqual(invalidFollowUp, {
    ok: false,
    reason: "invalid-follow-up-item",
  })

  const wrongId = applyThreadChoice(items, "owner", 1, {
    idFactory: () => "assigned-id",
    createReply: callbacks().createReply,
    createFollowUp: () => ({ id: "different-id" }),
  })
  assert.deepEqual(wrongId, {
    ok: false,
    reason: "invalid-follow-up-item",
  })
  assert.deepEqual(items, snapshot)
})
