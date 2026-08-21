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
            replyPace: "instant",
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
            replyPace: "instant",
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

test("an image choice sends the selected image instead of an extra text reply", () => {
  const round = fixtureRound()
  round.messages[1].choices[0].imageUrl = "https://example.invalid/choice.png"
  let sequence = 0

  const result = callApply(round, "owner", 0, {
    idFactory: () => `image-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.round.messages[2], {
    id: "image-1",
    senderId: "self",
    image: "https://example.invalid/choice.png",
    type: "image",
  })
  assert.equal(result.round.messages.some(message => message.text === "My answer"), false)
  assert.equal(result.run.replyMessageId, "image-1")
})

test("an explicit silent choice suppresses stale saved reply text", () => {
  const round = fixtureRound()
  round.messages[1].choices[0].silent = true
  let sequence = 0

  const result = callApply(round, "owner", 0, {
    idFactory: () => `silent-follow-up-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.equal(result.run.replyMessageId, null)
  assert.deepEqual(result.run.generatedMessageIds, ["silent-follow-up-1", "silent-follow-up-2"])
  assert.equal(result.round.messages[2].text, "First follow-up")
})

test("an important choice records that the current round must end", () => {
  const round = fixtureRound()
  round.messages[1].choices[1].endRound = true

  const result = callApply(round, "owner", 1, {
    idFactory: () => "ending-follow-up",
  })

  assert.equal(result.ok, true)
  assert.equal(result.run.endRound, true)
  assert.equal(result.round.messages.at(-1).id, "suffix")
})

test("a paced character reply inserts a temporary typing event before follow-ups", () => {
  const round = fixtureRound()
  round.messages[1].choices[0].replyPace = "quick"
  let sequence = 0

  const result = callApply(round, "owner", 0, {
    idFactory: () => `paced-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.round.messages.map(message => message.id),
    ["before", "owner", "paced-1", "paced-2", "paced-3", "paced-4", "paced-5", "suffix"],
  )
  assert.deepEqual(result.round.messages[3], {
    id: "paced-2",
    type: "system-event",
    eventKind: "typing",
    senderId: "system",
    actorContactId: "contact-1",
    durationMs: 700,
    transientTyping: true,
  })
  assert.deepEqual(result.round.messages[5], {
    id: "paced-4",
    type: "system-event",
    eventKind: "typing",
    senderId: "system",
    actorContactId: "contact-2",
    durationMs: 700,
    transientTyping: true,
  })
  assert.deepEqual(result.run.generatedMessageIds, ["paced-1", "paced-2", "paced-3", "paced-4", "paced-5"])
})

test("legacy choices without a reply pace use the current normal default", () => {
  const round = fixtureRound()
  const choice = round.messages[1].choices[1]
  delete choice.replyPace
  let sequence = 0

  const result = callApply(round, "owner", 1, {
    idFactory: () => `legacy-paced-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.round.messages[2], {
    id:"legacy-paced-1",
    type:"system-event",
    eventKind:"typing",
    senderId:"system",
    actorContactId:"contact-1",
    durationMs:1600,
    transientTyping:true,
  })
  assert.equal(result.round.messages[3].text, "The silence is an answer.")
})

test("each character follow-up can override pace and render as failed or recalled", () => {
  const round = fixtureRound()
  const choice = round.messages[1].choices[0]
  choice.replyText = ""
  choice.replyPace = "quick"
  choice.followUpMessages = [
    {
      id:"failed-template",
      senderId:"contact-1",
      text:"This one fails.",
      type:"text",
      replyPace:"instant",
      deliveryState:"failed",
    },
    {
      id:"recalled-template",
      senderId:"contact-2",
      text:"This one is recalled.",
      type:"text",
      replyPace:"delayed",
      deliveryState:"recalled",
      delayBeforeMs:1250,
    },
    {
      id:"inherited-template",
      senderId:"contact-1",
      text:"This one inherits the choice pace.",
      type:"text",
    },
  ]
  let sequence = 0

  const result = callApply(round, "owner", 0, {
    idFactory: () => `state-${++sequence}`,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.round.messages.map(message => message.id),
    ["before", "owner", "state-1", "state-2", "state-3", "state-4", "state-5", "suffix"],
  )
  assert.deepEqual(result.round.messages[2], {
    id:"state-1",
    senderId:"contact-1",
    text:"This one fails.",
    type:"text",
    failed:true,
  })
  assert.deepEqual(result.round.messages[3], {
    id:"state-2",
    type:"system-event",
    eventKind:"typing",
    senderId:"system",
    actorContactId:"contact-2",
    durationMs:4200,
    transientTyping:true,
  })
  assert.deepEqual(result.round.messages[4], {
    id:"state-3",
    type:"system-event",
    eventKind:"recall",
    senderId:"system",
    actorContactId:"contact-2",
    originalText:"This one is recalled.",
    allowReveal:false,
    delayBeforeMs:1250,
    recalledMessage:{
      id:"recalled-template",
      senderId:"contact-2",
      text:"This one is recalled.",
      type:"text",
      delayBeforeMs:1250,
    },
  })
  assert.deepEqual(result.round.messages[5], {
    id:"state-4",
    type:"system-event",
    eventKind:"typing",
    senderId:"system",
    actorContactId:"contact-1",
    durationMs:700,
    transientTyping:true,
  })
  assert.deepEqual(result.round.messages[6], {
    id:"state-5",
    senderId:"contact-1",
    text:"This one inherits the choice pace.",
    type:"text",
  })
  assert.deepEqual(result.run.generatedMessageIds, ["state-1", "state-2", "state-3", "state-4", "state-5"])
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
