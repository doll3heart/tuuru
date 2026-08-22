import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePhoneStoryDisplayCondition,
  phoneStoryChatSelectionScope,
  phoneStoryChoiceCatalog,
  phoneStoryChoiceSelectionKey,
  phoneStoryItemHasValidConditionReferences,
  phoneStoryItemIsVisible,
  phoneStoryMessageBlockedByEndedRound,
  phoneStoryScopedChoiceSelectionKey,
  phoneStorySelectedChoiceId,
  prunePhoneStoryChoiceSelections,
  selectedPhoneStoryChoiceIds,
} from "../js/phone-story-state.js"

test("phone story choices form one stable cross-App catalog", () => {
  const phoneData = {
    contacts:[{ id:"contact-a", name:"林澈" }],
    chats:[
      {
        id:"chat-a",
        type:"single",
        contactIds:["contact-a"],
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
      detail:"林澈 · 第1轮 · 要一起去吗？",
      ambiguous:false,
    },
    {
      id:"choice-no",
      ownerMessageId:"message-a",
      chatId:"chat-a",
      label:"拒绝",
      detail:"林澈 · 第1轮 · 要一起去吗？",
      ambiguous:false,
    },
  ])
})

test("phone story choice catalog preserves group or contact and round source context", () => {
  const phoneData = {
    contacts:[{ id:"contact-a", name:"林澈" }],
    chats:[
      {
        id:"single-chat",
        type:"single",
        contactIds:["contact-a"],
        rounds:[{ id:"round-one", label:"第1轮", messages:[{
          id:"single-message",
          text:"明天见吗？",
          choices:[{ id:"single-choice", text:"明天见" }],
        }] }],
      },
      {
        id:"group-chat",
        type:"group",
        groupName:"夜谈组",
        rounds:[{ id:"round-two", label:"第2轮", messages:[{
          id:"group-message",
          text:"现在出发吗？",
          choices:[{ id:"group-choice", text:"出发" }],
        }] }],
      },
    ],
  }

  assert.deepEqual(
    phoneStoryChoiceCatalog(phoneData).map(choice => [choice.id, choice.detail]),
    [
      ["single-choice", "林澈 · 第1轮 · 明天见吗？"],
      ["group-choice", "夜谈组 · 第2轮 · 现在出发吗？"],
    ],
  )
  assert.equal(
    phoneStoryChoiceCatalog(phoneData, { includeSearchText:true })[0].searchText,
    "明天见 林澈 · 第1轮 · 明天见吗？ single-choice",
  )
})

test("phone story choice catalog resolves each contact label once for a large chat", () => {
  let contactIdReads = 0
  const trackedContact = { name:"林澈" }
  Object.defineProperty(trackedContact, "id", {
    enumerable:true,
    get() {
      contactIdReads += 1
      return "contact-a"
    },
  })
  const messages = Array.from({ length:40 }, function(_, index) {
    return {
      id:`message-${index}`,
      text:`原消息 ${index}`,
      choices:[{ id:`choice-${index}`, text:`选项 ${index}` }],
    }
  })
  const phoneData = {
    contacts:[trackedContact],
    chats:[{
      id:"chat-a",
      type:"single",
      contactIds:["contact-a"],
      rounds:[{ id:"round-a", label:"第一轮", messages }],
    }],
  }

  assert.equal(phoneStoryChoiceCatalog(phoneData).length, 40)
  assert.equal(contactIdReads, 1)
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

test("an explicit null phone story display condition fails closed", () => {
  const item = { displayCondition:null }
  const validAndVisible = phoneStoryItemHasValidConditionReferences({ chats:[] }, item)
    && phoneStoryItemIsVisible(item, new Set())

  assert.equal(validAndVisible, false)
})

test("an overlong legacy phone story choice id fails closed", () => {
  const overlongChoiceId = "x".repeat(201)
  const item = { visibleAfterChoiceId:overlongChoiceId }
  const validAndVisible = phoneStoryItemHasValidConditionReferences({ chats:[] }, item)
    && phoneStoryItemIsVisible(item, new Set([overlongChoiceId]))

  assert.equal(validAndVisible, false)
})

test("phone story selection values become a bounded safe Set", () => {
  const inherited = Object.create({ inherited:"choice-bad" })
  inherited["message-a"] = "choice-yes"
  inherited["message-b"] = ""
  inherited["message-c"] = 42

  assert.deepEqual(selectedPhoneStoryChoiceIds(inherited), new Set(["choice-yes"]))
})

test("phone story selection bounds keep the newest choices active", () => {
  const selections = new Map(
    Array.from({ length:1001 }, (_, index) => [`message-${index}`, `choice-${index}`]),
  )

  const selected = selectedPhoneStoryChoiceIds(selections)

  assert.equal(selected.size, 1000)
  assert.equal(selected.has("choice-0"), false)
  assert.equal(selected.has("choice-1000"), true)
})

test("phone story selection pruning keeps the newest valid owners", () => {
  const messages = Array.from({ length:1001 }, (_, index) => ({
    id:`message-${index}`,
    choices:[{ id:`choice-${index}`, text:`choice ${index}` }],
  }))
  const phoneData = {
    chats:[{ id:"chat-a", rounds:[{ id:"round-a", messages }] }],
  }
  const selections = new Map(
    messages.map((message, index) => [message.id, `choice-${index}`]),
  )

  const pruned = prunePhoneStoryChoiceSelections(phoneData, selections)

  assert.equal(pruned.size, 1000)
  assert.equal(pruned.has("message-0"), false)
  assert.equal(pruned.get("message-1000"), "choice-1000")
})

test("phone story selection pruning preserves a thousand-step dependency chain", () => {
  const messages = Array.from({ length:1000 }, (_, index) => ({
    id:`chain-message-${index}`,
    ...(index > 0 ? { visibleAfterChoiceId:`chain-choice-${index - 1}` } : {}),
    choices:[{ id:`chain-choice-${index}`, text:`choice ${index}` }],
  }))
  const phoneData = {
    chats:[{ id:"chat-chain", rounds:[{ id:"round-chain", messages }] }],
  }
  const selections = new Map(
    messages.map((message, index) => [message.id, `chain-choice-${index}`]),
  )

  const pruned = prunePhoneStoryChoiceSelections(phoneData, selections)

  assert.equal(pruned.size, 1000)
  assert.equal(pruned.get("chain-message-999"), "chain-choice-999")
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

test("duplicate owner ids keep independent scoped selections across chats", () => {
  const phoneData = {
    chats:[
      {
        id:"chat-a",
        rounds:[{
          id:"round-a",
          messages:[{
            id:"shared-owner",
            choices:[{ id:"choice-a", text:"A" }],
          }],
        }],
      },
      {
        id:"chat-b",
        rounds:[{
          id:"round-b",
          messages:[{
            id:"shared-owner",
            choices:[{ id:"choice-b", text:"B" }],
          }],
        }],
      },
    ],
  }
  const keyA = phoneStoryChoiceSelectionKey(phoneData, "chat-id:chat-a", "shared-owner")
  const keyB = phoneStoryChoiceSelectionKey(phoneData, "chat-id:chat-b", "shared-owner")
  const selections = new Map([
    [keyA, "choice-a"],
    [keyB, "choice-b"],
  ])

  const pruned = prunePhoneStoryChoiceSelections(phoneData, selections)

  assert.notEqual(keyA, keyB)
  assert.deepEqual(pruned, selections)
  assert.equal(phoneStorySelectedChoiceId(pruned, "chat-id:chat-a", "shared-owner"), "choice-a")
  assert.equal(phoneStorySelectedChoiceId(pruned, "chat-id:chat-b", "shared-owner"), "choice-b")
})

test("duplicate raw chat ids still receive distinct stable choice scopes", () => {
  const phoneData = {
    chats:[0, 1].map(index => ({
      id:"duplicate-chat",
      rounds:[{
        id:`round-${index}`,
        messages:[{
          id:"shared-owner",
          choices:[{ id:`choice-${index}`, text:String(index) }],
        }],
      }],
    })),
  }
  const scopes = phoneData.chats.map((chat, index) => phoneStoryChatSelectionScope(chat, index, phoneData))
  const keys = scopes.map(scope => phoneStoryChoiceSelectionKey(phoneData, scope, "shared-owner"))
  const selections = new Map([
    [keys[0], "choice-0"],
    [keys[1], "choice-1"],
  ])

  assert.notEqual(scopes[0], scopes[1])
  assert.deepEqual(prunePhoneStoryChoiceSelections(phoneData, selections), selections)
})

test("legacy duplicate-owner selection migrates only when its choice identifies one chat", () => {
  const phoneData = {
    chats:[
      {
        id:"chat-a",
        rounds:[{ messages:[{
          id:"shared-owner",
          choices:[{ id:"choice-a", text:"A" }],
        }] }],
      },
      {
        id:"chat-b",
        rounds:[{ messages:[{
          id:"shared-owner",
          choices:[{ id:"choice-b", text:"B" }],
        }] }],
      },
    ],
  }
  const migratedKey = phoneStoryScopedChoiceSelectionKey("chat-id:chat-a", "shared-owner")

  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, new Map([["shared-owner", "choice-a"]])),
    new Map([[migratedKey, "choice-a"]]),
  )

  phoneData.chats[1].rounds[0].messages[0].choices[0].id = "choice-a"
  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, new Map([["shared-owner", "choice-a"]])),
    new Map(),
  )
})

test("a scoped duplicate-owner save migrates back when an update leaves one owner", () => {
  const phoneData = {
    chats:[{
      id:"chat-a",
      rounds:[{ messages:[{
        id:"shared-owner",
        choices:[{ id:"choice-a", text:"A" }],
      }] }],
    }],
  }
  const oldScopedKey = phoneStoryScopedChoiceSelectionKey("chat-id:chat-a", "shared-owner")

  assert.deepEqual(
    prunePhoneStoryChoiceSelections(phoneData, new Map([[oldScopedKey, "choice-a"]])),
    new Map([["shared-owner", "choice-a"]]),
  )
})

test("an ending choice blocks only its own duplicate-owner chat", () => {
  const phoneData = {
    chats:[
      {
        id:"chat-a",
        rounds:[{ messages:[
          { id:"shared-owner", choices:[{ id:"choice-end", text:"End", endRound:true }] },
          { id:"later", text:"A later" },
        ] }],
      },
      {
        id:"chat-b",
        rounds:[{ messages:[
          { id:"shared-owner", choices:[{ id:"choice-continue", text:"Continue" }] },
          { id:"later", text:"B later" },
        ] }],
      },
    ],
  }
  const selections = new Map([[
    phoneStoryScopedChoiceSelectionKey("chat-id:chat-a", "shared-owner"),
    "choice-end",
  ]])

  assert.equal(phoneStoryMessageBlockedByEndedRound(
    phoneData,
    "later",
    selections,
    { chatPersistenceKey:"chat-id:chat-a" },
  ), true)
  assert.equal(phoneStoryMessageBlockedByEndedRound(
    phoneData,
    "later",
    selections,
    { chatPersistenceKey:"chat-id:chat-b" },
  ), false)

  const ambiguousLegacy = new Map([["shared-owner", "choice-end"]])
  assert.equal(phoneStoryMessageBlockedByEndedRound(
    phoneData,
    "later",
    ambiguousLegacy,
    { chatPersistenceKey:"chat-id:chat-a" },
  ), false)
  assert.equal(phoneStoryMessageBlockedByEndedRound(
    phoneData,
    "later",
    ambiguousLegacy,
    { chatPersistenceKey:"chat-id:chat-b" },
  ), false)
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
