import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePhoneStoryDisplayCondition,
  phoneStoryChoiceCatalog,
  phoneStoryItemHasValidConditionReferences,
  phoneStoryItemIsVisible,
  phoneStoryMessageBlockedByEndedRound,
  prunePhoneStoryChoiceSelections,
  selectedPhoneStoryChoiceIds,
} from "../js/phone-story-state.js"

test("phone story choices form one stable cross-App catalog", () => {
  const phoneData = {
    chats:[
      {
        id:"chat-a",
        type:"single",
        groupName:"",
        rounds:[{
          id:"round-a",
          messages:[
            { id:"message-a", text:"要一起去吗？", choices:[
              { id:"choice-yes", text:"同意" },
              { id:"choice-no", text:"拒绝" },
            ] },
          ],
        }],
      },
    ],
  }

  assert.deepEqual(phoneStoryChoiceCatalog(phoneData), [
    {
      id:"choice-yes",
      ownerMessageId:"message-a",
      chatId:"chat-a",
      label:"同意",
      detail:"会话 · 要一起去吗？",
      ambiguous:false,
    },
    {
      id:"choice-no",
      ownerMessageId:"message-a",
      chatId:"chat-a",
      label:"拒绝",
      detail:"会话 · 要一起去吗？",
      ambiguous:false,
    },
  ])
})

test("phone story items unlock only after their referenced choice", () => {
  const post = { id:"post-a", visibleAfterChoiceId:"choice-no" }

  assert.equal(phoneStoryItemIsVisible(post, new Set()), false)
  assert.equal(phoneStoryItemIsVisible(post, new Set(["choice-yes"])), false)
  assert.equal(phoneStoryItemIsVisible(post, new Set(["choice-no"])), true)
  assert.equal(phoneStoryItemIsVisible({ id:"always" }, new Set()), true)
})

test("phone story conditions use OR inside groups and AND between groups", () => {
  const item = {
    id:"compound-item",
    displayCondition:{
      all:[
        { anyChoiceIds:["choice-yes", "choice-silent"] },
        { anyChoiceIds:["choice-invite"] },
      ],
    },
  }

  assert.equal(phoneStoryItemIsVisible(item, new Set(["choice-yes", "choice-invite"])), true)
  assert.equal(phoneStoryItemIsVisible(item, new Set(["choice-silent", "choice-invite"])), true)
  assert.equal(phoneStoryItemIsVisible(item, new Set(["choice-yes"])), false)
  assert.equal(phoneStoryItemIsVisible(item, new Set(["choice-invite"])), false)
})

test("legacy phone story conditions normalize to one compatible OR group", () => {
  assert.deepEqual(normalizePhoneStoryDisplayCondition({ visibleAfterChoiceId:"choice-old" }), {
    all:[{ anyChoiceIds:["choice-old"] }],
  })
  assert.deepEqual(normalizePhoneStoryDisplayCondition({}), { all:[] })
})

test("malformed and dangling compound conditions fail closed", () => {
  const phoneData = {
    chats:[{ id:"chat", rounds:[{ id:"round", messages:[{
      id:"owner",
      choices:[{ id:"choice-valid", text:"有效" }],
    }] }] }],
  }
  assert.equal(phoneStoryItemIsVisible({ displayCondition:{ all:[{ anyChoiceIds:[] }] } }, new Set()), false)
  assert.equal(phoneStoryItemHasValidConditionReferences(phoneData, {
    displayCondition:{ all:[{ anyChoiceIds:["choice-missing"] }] },
  }), false)
  assert.equal(phoneStoryItemHasValidConditionReferences(phoneData, {
    displayCondition:{ all:[{ anyChoiceIds:["choice-valid"] }] },
  }), true)
})

test("phone story selection values become a bounded safe Set", () => {
  const inherited = Object.create({ inherited:"choice-bad" })
  inherited["message-a"] = "choice-yes"
  inherited["message-b"] = ""
  inherited["message-c"] = 42

  assert.deepEqual(selectedPhoneStoryChoiceIds(inherited), new Set(["choice-yes"]))
})

test("ending a topic blocks only later authored messages in that round", () => {
  const phoneData = {
    chats:[{
      id:"chat-a",
      rounds:[{
        id:"round-a",
        messages:[
          { id:"owner", choices:[{ id:"choice-end", text:"同意", endRound:true }] },
          { id:"later", text:"本轮后续" },
        ],
      }, {
        id:"round-b",
        messages:[{ id:"next-round", text:"下一轮" }],
      }],
    }],
  }
  const selections = new Map([["owner", "choice-end"]])

  assert.equal(phoneStoryMessageBlockedByEndedRound(phoneData, "owner", selections), false)
  assert.equal(phoneStoryMessageBlockedByEndedRound(phoneData, "later", selections), true)
  assert.equal(phoneStoryMessageBlockedByEndedRound(phoneData, "next-round", selections), false)
})

test("reselecting an earlier branch prunes choices made inside the hidden branch", () => {
  const phoneData = {
    chats:[{
      id:"chat-a",
      rounds:[{
        id:"round-a",
        messages:[
          { id:"owner", choices:[
            { id:"choice-open", text:"打开分支" },
            { id:"choice-close", text:"关闭分支" },
          ] },
          {
            id:"dependent-owner",
            visibleAfterChoiceId:"choice-open",
            choices:[{ id:"dependent-choice", text:"继续" }],
          },
        ],
      }],
    }],
  }

  const stale = new Map([
    ["owner", "choice-close"],
    ["dependent-owner", "dependent-choice"],
  ])

  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, stale),
    new Map([["owner", "choice-close"]]),
  )
})

test("compound hidden-message selections require one reachable choice from every AND group", () => {
  const phoneData = {
    chats:[{
      id:"chat-a",
      rounds:[{
        id:"round-a",
        messages:[
          { id:"owner-a", choices:[{ id:"choice-a", text:"A" }] },
          { id:"owner-b", choices:[{ id:"choice-b", text:"B" }, { id:"choice-other", text:"其它" }] },
          {
            id:"dependent-owner",
            displayCondition:{ all:[
              { anyChoiceIds:["choice-a"] },
              { anyChoiceIds:["choice-b"] },
            ] },
            choices:[{ id:"dependent-choice", text:"继续" }],
          },
        ],
      }],
    }],
  }

  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, new Map([
      ["owner-a", "choice-a"],
      ["owner-b", "choice-other"],
      ["dependent-owner", "dependent-choice"],
    ])),
    new Map([
      ["owner-a", "choice-a"],
      ["owner-b", "choice-other"],
    ]),
  )
})

test("cyclic hidden-message selections cannot revive themselves from saved progress", () => {
  const phoneData = {
    chats:[{
      id:"chat-a",
      rounds:[{
        id:"round-a",
        messages:[
          {
            id:"owner-a",
            visibleAfterChoiceId:"choice-b",
            choices:[{ id:"choice-a", text:"A" }],
          },
          {
            id:"owner-b",
            visibleAfterChoiceId:"choice-a",
            choices:[{ id:"choice-b", text:"B" }],
          },
        ],
      }],
    }],
  }

  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, new Map([
      ["owner-a", "choice-a"],
      ["owner-b", "choice-b"],
    ])),
    new Map(),
  )
})
