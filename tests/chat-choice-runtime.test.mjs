import test from "node:test"
import assert from "node:assert/strict"

import { applyChatChoice, rollbackChatChoice } from "../js/chat-choice-runtime.js"

function callApply(...args) {
  assert.equal(typeof applyChatChoice, "function", "applyChatChoice must be exported")
  return applyChatChoice(...args)
}

function callRollback(...args) {
  assert.equal(typeof rollbackChatChoice, "function", "rollbackChatChoice must be exported")
  return rollbackChatChoice(...args)
}

function fixtureRound() {
  return {
    id: "round-1",
    label: "First round",
    metadata: { mood: "quiet" },
    messages: [
      { id: "before", senderId: "contact-1", text: "Before" },
      {
        id: "owner",
        senderId: "contact-1",
        text: "Choose",
        choices: [
          {
            id: "choice-1",
            text: "Answer",
            replyText: "My answer",
            followUpMessages: [
              {
                id: "follow-template-1",
                senderId: "contact-1",
                text: "First follow-up",
                type: "text",
                metadata: { tone: "warm" },
              },
              {
                id: "follow-template-2",
                senderId: "contact-2",
                text: "Second follow-up",
                type: "text",
              },
            ],
          },
          {
            id: "choice-2",
            text: "Stay quiet",
            replyText: "",
            followUpMessages: [
              {
                id: "silent-template",
                senderId: "contact-1",
                text: "The silence is an answer.",
                type: "text",
              },
            ],
          },
        ],
      },
      { id: "suffix", senderId: "contact-2", text: "Already authored later" },
    ],
  }
}

test("inserts the reply and deep-cloned follow-ups directly after their owner", () => {
  const round = fixtureRound()
  const snapshot = structuredClone(round)
  let sequence = 0

  const result = callApply(round, "owner", 0, {
    idFactory: () => `generated-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.notEqual(result.round, round)
  assert.deepEqual(
    result.round.messages.map(message => message.id),
    ["before", "owner", "generated-1", "generated-2", "generated-3", "suffix"],
  )
  assert.deepEqual(result.round.messages[2], {
    id: "generated-1",
    senderId: "self",
    text: "My answer",
    type: "text",
  })
  assert.deepEqual(result.round.messages[3], {
    id: "generated-2",
    senderId: "contact-1",
    text: "First follow-up",
    type: "text",
    metadata: { tone: "warm" },
  })
  assert.deepEqual(result.round.messages[4], {
    id: "generated-3",
    senderId: "contact-2",
    text: "Second follow-up",
    type: "text",
  })
  assert.notEqual(
    result.round.messages[3].metadata,
    round.messages[1].choices[0].followUpMessages[0].metadata,
  )
  assert.equal(result.round.messages.at(-1).text, "Already authored later")
  assert.equal("used" in result.round.messages[1].choices[0], false)
  assert.deepEqual(result.run, {
    ownerMessageId: "owner",
    choiceIndex: 0,
    generatedMessageIds: ["generated-1", "generated-2", "generated-3"],
    replyMessageId: "generated-1",
  })
  assert.deepEqual(round, snapshot)
})

test("does not create a reply message or consume its id when replyText is empty", () => {
  const round = fixtureRound()
  let calls = 0

  const result = callApply(round, "owner", 1, {
    idFactory: () => `silent-${++calls}`,
  })

  assert.equal(result.ok, true)
  assert.equal(calls, 1)
  assert.deepEqual(
    result.round.messages.map(message => message.id),
    ["before", "owner", "silent-1", "suffix"],
  )
  assert.equal(result.round.messages[2].text, "The silence is an answer.")
  assert.deepEqual(result.run.generatedMessageIds, ["silent-1"])
  assert.equal(result.run.replyMessageId, null)
})

test("rollback removes exactly the generated ids without mutating round or run", () => {
  const original = fixtureRound()
  original.messages[2].text = "My answer"
  const applied = callApply(original, "owner", 0, {
    idFactory: (() => {
      let id = 0
      return () => `rollback-${++id}`
    })(),
  })
  const appliedSnapshot = structuredClone(applied.round)
  const runSnapshot = structuredClone(applied.run)

  const rolledBack = callRollback(applied.round, applied.run)

  assert.notEqual(rolledBack, applied.round)
  assert.deepEqual(rolledBack, original)
  assert.equal(rolledBack.messages.at(-1).id, "suffix")
  assert.equal(rolledBack.messages.at(-1).text, "My answer")
  assert.deepEqual(applied.round, appliedSnapshot)
  assert.deepEqual(applied.run, runSnapshot)
})

test("a rolled-back round can run a different choice", () => {
  const original = fixtureRound()
  let firstId = 0
  const firstRun = callApply(original, "owner", 0, {
    idFactory: () => `first-${++firstId}`,
  })
  const rolledBack = callRollback(firstRun.round, firstRun.run)

  const reselection = callApply(rolledBack, "owner", 1, {
    idFactory: () => "reselected-1",
  })

  assert.equal(reselection.ok, true)
  assert.deepEqual(
    reselection.round.messages.map(message => message.id),
    ["before", "owner", "reselected-1", "suffix"],
  )
})

test("reports a missing owner without mutation or id generation", () => {
  const round = fixtureRound()
  const snapshot = structuredClone(round)
  let calls = 0

  const result = callApply(round, "missing", 0, {
    idFactory: () => {
      calls += 1
      return "unused"
    },
  })

  assert.deepEqual(result, { ok: false, reason: "owner-message-not-found" })
  assert.equal(calls, 0)
  assert.deepEqual(round, snapshot)
})

test("reports an ambiguous owner id without mutation", () => {
  const round = fixtureRound()
  round.messages.push(structuredClone(round.messages[1]))
  const snapshot = structuredClone(round)

  const result = callApply(round, "owner", 0, {
    idFactory: () => "unused",
  })

  assert.deepEqual(result, { ok: false, reason: "owner-message-ambiguous" })
  assert.deepEqual(round, snapshot)
})

test("reports an invalid choice index without mutation", () => {
  const round = fixtureRound()
  const snapshot = structuredClone(round)

  const result = callApply(round, "owner", 99, {
    idFactory: () => "unused",
  })

  assert.deepEqual(result, { ok: false, reason: "choice-not-found" })
  assert.deepEqual(round, snapshot)
})
