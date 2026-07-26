import test from "node:test"
import assert from "node:assert/strict"

import {
  articleDisplayConditionMatches,
  articleNodeIsConditional,
  buildArticleChoiceCatalog,
  normalizeArticleDisplayCondition,
} from "../js/article-condition-model.js"

test("normalizes an AND-of-OR condition without duplicate or empty ids", () => {
  assert.deepEqual(normalizeArticleDisplayCondition({
    all: [
      { anyChoiceIds: ["choice-a", "choice-a", ""] },
      { anyChoiceIds: ["choice-b"] },
    ],
  }), {
    all: [
      { anyChoiceIds: ["choice-a"] },
      { anyChoiceIds: ["choice-b"] },
    ],
  })
})

test("identifies only conditional article nodes", () => {
  assert.equal(articleNodeIsConditional({ kind: "conditional" }), true)
  assert.equal(articleNodeIsConditional({ kind: "interactive-scene" }), false)
  assert.equal(articleNodeIsConditional(null), false)
})

test("evaluates AND-of-OR display conditions against selected choice IDs", () => {
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: ["choice-a", "choice-c"] }],
  }, new Set(["choice-c"])), true)
  assert.equal(articleDisplayConditionMatches({
    all: [
      { anyChoiceIds: ["choice-a", "choice-c"] },
      { anyChoiceIds: ["choice-b"] },
    ],
  }, new Set(["choice-a", "choice-b"])), true)
  assert.equal(articleDisplayConditionMatches({
    all: [
      { anyChoiceIds: ["choice-a", "choice-c"] },
      { anyChoiceIds: ["choice-b"] },
    ],
  }, new Set(["choice-c"])), false)
})

test("fails closed for empty, malformed, and dangling display conditions", () => {
  assert.equal(articleDisplayConditionMatches({ all: [] }, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({ all: [{ anyChoiceIds: [] }] }, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({ all: [{ anyChoiceIds: ["missing-choice"] }] }, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: [" choice-a "] }],
  }, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: [7] }],
  }, new Set(["7"])), false)
})

test("strictly rejects raw conditions that would otherwise lose required conjuncts during normalization", () => {
  const selectedIds = new Set(["choice-a", "choice-b"])

  assert.equal(articleDisplayConditionMatches({
    all: [
      { anyChoiceIds: ["choice-a"] },
      { anyChoiceIds: [] },
    ],
  }, selectedIds), false)

  for (const invalidAnyChoiceIds of [["choice-b", null], ["choice-b", ""], ["choice-b", 7], ["choice-b", " choice-c "]]) {
    assert.equal(articleDisplayConditionMatches({
      all: [
        { anyChoiceIds: ["choice-a"] },
        { anyChoiceIds: invalidAnyChoiceIds },
      ],
    }, selectedIds), false)
  }
})

test("strictly rejects inherited condition fields and non-record groups", () => {
  const inheritedAll = Object.create({ all: [{ anyChoiceIds: ["choice-a"] }] })
  const inheritedAnyChoiceIds = {
    all: [Object.create({ anyChoiceIds: ["choice-a"] })],
  }

  assert.equal(articleDisplayConditionMatches(inheritedAll, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches(inheritedAnyChoiceIds, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({ all: [null] }, new Set(["choice-a"])), false)
  assert.equal(articleDisplayConditionMatches({ all: [] }, new Set(["choice-a"])), false)
})

test("requires a real Set and fails closed when selected-ID access is spoofed or throws", () => {
  const condition = { all: [{ anyChoiceIds: ["choice-a"] }] }
  const fakeHas = { has: () => true }
  const throwingHas = { has() { throw new Error("unexpected has call") } }
  const throwingHasGetter = Object.defineProperty({}, "has", {
    get() { throw new Error("unexpected has read") },
  })
  const spoofedSetReceiver = Object.create(Set.prototype)

  assert.equal(articleDisplayConditionMatches(condition, fakeHas), false)
  assert.doesNotThrow(() => assert.equal(articleDisplayConditionMatches(condition, throwingHas), false))
  assert.doesNotThrow(() => assert.equal(articleDisplayConditionMatches(condition, throwingHasGetter), false))
  assert.doesNotThrow(() => assert.equal(articleDisplayConditionMatches(condition, spoofedSetReceiver), false))
})

function sparseArrayWithInheritedZero(value) {
  const sparse = []
  sparse.length = 1
  const inherited = Object.create(Array.prototype)
  Object.defineProperty(inherited, "0", { value, enumerable: true })
  Object.setPrototypeOf(sparse, inherited)
  return sparse
}

test("rejects sparse condition arrays and inherited numeric entries", () => {
  const selectedIds = new Set(["choice-a"])
  const inheritedGroup = sparseArrayWithInheritedZero({ anyChoiceIds: ["choice-a"] })
  const inheritedChoiceId = sparseArrayWithInheritedZero("choice-a")

  assert.equal(articleDisplayConditionMatches({ all: new Array(1) }, selectedIds), false)
  assert.equal(articleDisplayConditionMatches({ all: inheritedGroup }, selectedIds), false)
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: new Array(1) }],
  }, selectedIds), false)
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: inheritedChoiceId }],
  }, selectedIds), false)
})

test("rejects accessor array entries without invoking their getters", () => {
  const selectedIds = new Set(["choice-a"])
  const allWithAccessorGroup = []
  let groupGetterCalls = 0
  Object.defineProperty(allWithAccessorGroup, "0", {
    get() {
      groupGetterCalls += 1
      return { anyChoiceIds: ["choice-a"] }
    },
    enumerable: true,
  })
  const choiceIdsWithAccessor = []
  let choiceGetterCalls = 0
  Object.defineProperty(choiceIdsWithAccessor, "0", {
    get() {
      choiceGetterCalls += 1
      return "choice-a"
    },
    enumerable: true,
  })

  assert.equal(articleDisplayConditionMatches({ all: allWithAccessorGroup }, selectedIds), false)
  assert.equal(groupGetterCalls, 0)
  assert.equal(articleDisplayConditionMatches({
    all: [{ anyChoiceIds: choiceIdsWithAccessor }],
  }, selectedIds), false)
  assert.equal(choiceGetterCalls, 0)
})

const catalogWork = {
  chapters: [
    { id: "chapter-b", name: "Second chapter" },
    { id: "chapter-a", name: "First chapter" },
  ],
  nodes: [
    {
      id: "node-a",
      chapterId: "chapter-a",
      title: "Earlier node",
      choices: [
        { id: "choice-interaction", mode: "interaction", text: "Take the train", selectedText: "You board the night train." },
      ],
    },
    {
      id: "node-b",
      chapterId: "chapter-b",
      title: "Later node",
      choices: [
        { id: "choice-branch", text: "Stay behind", targetId: "node-a" },
        { id: "choice-branch-second", text: "Leave together", targetId: "node-a" },
      ],
    },
  ],
}

test("builds choices in chapter and author-node order with text as the visible label", () => {
  const catalog = buildArticleChoiceCatalog(catalogWork)

  assert.deepEqual(catalog.map(choice => ({
    choiceId: choice.choiceId,
    choiceText: choice.choiceText,
    choiceMode: choice.choiceMode,
    sourceNodeId: choice.sourceNodeId,
    sourceNodeTitle: choice.sourceNodeTitle,
    chapterId: choice.chapterId,
    chapterName: choice.chapterName,
    selectedText: choice.selectedText,
    disabled: choice.disabled,
  })), [
    {
      choiceId: "choice-branch",
      choiceText: "Stay behind",
      choiceMode: "branch",
      sourceNodeId: "node-b",
      sourceNodeTitle: "Later node",
      chapterId: "chapter-b",
      chapterName: "Second chapter",
      selectedText: "",
      disabled: false,
    },
    {
      choiceId: "choice-branch-second",
      choiceText: "Leave together",
      choiceMode: "branch",
      sourceNodeId: "node-b",
      sourceNodeTitle: "Later node",
      chapterId: "chapter-b",
      chapterName: "Second chapter",
      selectedText: "",
      disabled: false,
    },
    {
      choiceId: "choice-interaction",
      choiceText: "Take the train",
      choiceMode: "interaction",
      sourceNodeId: "node-a",
      sourceNodeTitle: "Earlier node",
      chapterId: "chapter-a",
      chapterName: "First chapter",
      selectedText: "You board the night train.",
      disabled: false,
    },
  ])
  assert.match(catalog[2].searchText, /You board the night train\./)
})

test("searches choice details and exact stable choice IDs without mutating work", () => {
  const before = structuredClone(catalogWork)

  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "night train" }).map(choice => choice.choiceId),
    ["choice-interaction"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "take the train" }).map(choice => choice.choiceId),
    ["choice-interaction"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "later node" }).map(choice => choice.choiceId),
    ["choice-branch", "choice-branch-second"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "first chapter" }).map(choice => choice.choiceId),
    ["choice-interaction"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "node-b" }).map(choice => choice.choiceId),
    ["choice-branch", "choice-branch-second"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "choice-branch" }).map(choice => choice.choiceId),
    ["choice-branch"],
  )
  assert.deepEqual(
    buildArticleChoiceCatalog(catalogWork, { query: "choice" }).map(choice => choice.choiceId),
    [],
  )
  assert.deepEqual(buildArticleChoiceCatalog(catalogWork, { excludeNodeId: "node-b" }).map(choice => choice.choiceId), ["choice-interaction"])
  assert.deepEqual(catalogWork, before)
})

test("keeps malformed authored IDs distinct, disabled, and unsearchable as stable references", () => {
  const work = {
    chapters: [
      { id: "chapter-a", name: "Valid chapter" },
      { id: " chapter-a ", name: "Padded chapter" },
      { id: 7, name: "Numeric chapter" },
    ],
    nodes: [
      {
        id: "node-a",
        chapterId: "chapter-a",
        title: "Valid source",
        choices: [
          { id: "choice-a", text: "Valid choice", targetId: "node-target" },
          { id: " choice-a ", text: "Padded choice", targetId: "node-target" },
          { id: 12, text: "Numeric choice", targetId: "node-target" },
          { id: "choice-padded-target", text: "Padded target", targetId: " node-target " },
          { id: "choice-numeric-target", text: "Numeric target", targetId: 99 },
        ],
      },
      {
        id: " node-padded ",
        chapterId: "chapter-a",
        title: "Padded source",
        choices: [{ id: "choice-padded-source", text: "Padded source choice", targetId: "node-target" }],
      },
      {
        id: 13,
        chapterId: "chapter-a",
        title: "Numeric source",
        choices: [{ id: "choice-numeric-source", text: "Numeric source choice", targetId: "node-target" }],
      },
      {
        id: "node-padded-chapter",
        chapterId: " chapter-a ",
        title: "Padded chapter source",
        choices: [{ id: "choice-padded-chapter", text: "Padded chapter choice", targetId: "node-target" }],
      },
      {
        id: "node-numeric-chapter",
        chapterId: 7,
        title: "Numeric chapter source",
        choices: [{ id: "choice-numeric-chapter", text: "Numeric chapter choice", targetId: "node-target" }],
      },
      { id: "node-target", chapterId: "chapter-a", title: "Target", choices: [] },
    ],
  }
  const before = structuredClone(work)
  const catalog = buildArticleChoiceCatalog(work)
  const byId = new Map(catalog.map(choice => [choice.choiceId, choice]))

  assert.equal(byId.get("choice-a").disabled, false)
  assert.equal(byId.get(" choice-a ").reason, "choice-id-malformed")
  assert.equal(byId.get("12").reason, "choice-id-malformed")
  assert.equal(byId.get("choice-padded-target").reason, "branch-target-id-malformed")
  assert.equal(byId.get("choice-numeric-target").reason, "branch-target-id-malformed")
  assert.equal(byId.get("choice-padded-source").reason, "source-node-id-malformed")
  assert.equal(byId.get("choice-numeric-source").reason, "source-node-id-malformed")
  assert.equal(byId.get("choice-padded-chapter").reason, "source-chapter-id-malformed")
  assert.equal(byId.get("choice-numeric-chapter").reason, "source-chapter-id-malformed")
  assert.deepEqual(buildArticleChoiceCatalog(work, { query: "choice-a" }).map(choice => choice.choiceId), ["choice-a"])
  assert.deepEqual(buildArticleChoiceCatalog(work, { query: " choice-a " }).map(choice => choice.choiceId), [])
  assert.deepEqual(buildArticleChoiceCatalog(work, { excludeNodeId: " node-a " }).map(choice => choice.choiceId), catalog.map(choice => choice.choiceId))
  assert.ok(!buildArticleChoiceCatalog(work, { excludeNodeId: "node-a" }).some(choice => choice.sourceNodeId === "node-a"))
  assert.deepEqual(buildArticleChoiceCatalog(work, { excludeNodeId: 13 }).map(choice => choice.choiceId), catalog.map(choice => choice.choiceId))
  assert.deepEqual(work, before)
})

test("disables unknown choice modes while retaining missing modes as legacy branches", () => {
  const catalog = buildArticleChoiceCatalog({
    chapters: [{ id: "chapter-a", name: "Chapter" }],
    nodes: [
      {
        id: "node-a",
        chapterId: "chapter-a",
        title: "Source",
        choices: [
          { id: "choice-legacy", text: "Legacy branch", targetId: "node-target" },
          { id: "choice-unknown", mode: "teleport", text: "Unknown mode", targetId: "node-target" },
        ],
      },
      { id: "node-target", chapterId: "chapter-a", title: "Target", choices: [] },
    ],
  })

  assert.deepEqual(catalog.map(choice => ({ choiceId: choice.choiceId, choiceMode: choice.choiceMode, disabled: choice.disabled, reason: choice.reason })), [
    { choiceId: "choice-legacy", choiceMode: "branch", disabled: false, reason: "" },
    { choiceId: "choice-unknown", choiceMode: "unknown", disabled: true, reason: "choice-mode-malformed" },
  ])
})

test("marks ambiguous and malformed choice references disabled instead of resolving them", () => {
  const catalog = buildArticleChoiceCatalog({
    chapters: [{ id: "chapter-a", name: "Chapter" }],
    nodes: [
      {
        id: "node-a",
        chapterId: "chapter-a",
        title: "First source",
        choices: [{ id: "choice-duplicate", text: "First duplicate" }, { id: "", text: "Missing ID" }],
      },
      {
        id: "node-b",
        chapterId: "chapter-a",
        title: "Second source",
        choices: [{ id: "choice-duplicate", text: "Second duplicate" }],
      },
      {
        id: "",
        chapterId: "chapter-a",
        title: "Malformed source",
        choices: [{ id: "choice-no-source", text: "No source ID" }],
      },
      {
        id: "node-c",
        chapterId: "chapter-a",
        title: "Dangling branch",
        choices: [{ id: "choice-dangling", text: "Missing target", targetId: "missing-node" }],
      },
    ],
  })

  assert.deepEqual(catalog.map(choice => ({ choiceId: choice.choiceId, disabled: choice.disabled, reason: choice.reason })), [
    { choiceId: "choice-duplicate", disabled: true, reason: "ambiguous-choice-id" },
    { choiceId: "", disabled: true, reason: "choice-id-missing" },
    { choiceId: "choice-duplicate", disabled: true, reason: "ambiguous-choice-id" },
    { choiceId: "choice-no-source", disabled: true, reason: "source-node-id-missing" },
    { choiceId: "choice-dangling", disabled: true, reason: "branch-target-not-found" },
  ])
})
