import test from "node:test"
import assert from "node:assert/strict"

import {
  buildArticleTargetList,
  describeArticleTarget,
  reconcileArticleChoices,
} from "../js/article-choice-model.js"

function fixtureWork() {
  return {
    chapters: [
      { id: "chapter-b", name: "Second" },
      { id: "chapter-a", name: "First" },
      { id: "chapter-empty", name: "Empty" },
    ],
    nodes: [
      { id: "a-2", title: "Shared", chapterId: "chapter-a" },
      { id: "b-1", title: "Shared", chapterId: "chapter-b" },
      { id: "loose", title: "Loose note", chapterId: "" },
      { id: "a-1", title: "Alpha", chapterId: "chapter-a" },
      { id: "b-2", title: "Beta", chapterId: "chapter-b" },
    ],
  }
}

test("reconciles matched choices without mutating input or losing unknown metadata", () => {
  const existing = [
    {
      id: "choice-a",
      text: "Old label",
      targetId: "node-old",
      analytics: { visits: 3 },
      customFlag: true,
    },
    { id: "choice-deleted", text: "Delete me", targetId: "node-old" },
  ]
  const drafts = [{ id: "choice-a", text: "New label", targetId: "node-new" }]
  const existingSnapshot = structuredClone(existing)
  const draftSnapshot = structuredClone(drafts)

  const result = reconcileArticleChoices(existing, drafts, () => "unused")

  assert.equal(result.ok, true)
  assert.deepEqual(result.choices, [{
    id: "choice-a",
    text: "New label",
    targetId: "node-new",
    analytics: { visits: 3 },
    customFlag: true,
  }])
  assert.notEqual(result.choices[0], existing[0])
  assert.deepEqual(existing, existingSnapshot)
  assert.deepEqual(drafts, draftSnapshot)
})

test("assigns fresh ids to new and unknown-id drafts while preserving draft order", () => {
  const generated = ["choice-new-a", "choice-new-b"]
  const result = reconcileArticleChoices(
    [{ id: "choice-existing", text: "Existing", targetId: "node-a" }],
    [
      { text: "Brand new", targetId: "node-b" },
      { id: "choice-existing", text: "Edited", targetId: "node-c" },
      { id: "choice-from-elsewhere", text: "Imported draft", targetId: "node-d" },
    ],
    () => generated.shift(),
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.choices.map(choice => choice.id), [
    "choice-new-a",
    "choice-existing",
    "choice-new-b",
  ])
  assert.deepEqual(result.choices.map(choice => choice.text), ["Brand new", "Edited", "Imported draft"])
})

test("rejects duplicate draft ids before allocating anything", () => {
  let allocations = 0
  const result = reconcileArticleChoices(
    [{ id: "choice-a", text: "A", targetId: "node-a" }],
    [
      { id: "choice-a", text: "First", targetId: "node-a" },
      { id: "choice-a", text: "Second", targetId: "node-b" },
    ],
    () => {
      allocations += 1
      return "choice-new"
    },
  )

  assert.deepEqual(result, { ok: false, reason: "duplicate-draft-id" })
  assert.equal(allocations, 0)
})

test("rejects ids generated in conflict with existing or newly generated ids", () => {
  const existingConflict = reconcileArticleChoices(
    [{ id: "choice-a", text: "A", targetId: "node-a" }],
    [{ text: "New", targetId: "node-b" }],
    () => "choice-a",
  )
  assert.deepEqual(existingConflict, { ok: false, reason: "generated-id-conflict" })

  const generatedConflict = reconcileArticleChoices(
    [],
    [
      { text: "First", targetId: "node-a" },
      { text: "Second", targetId: "node-b" },
    ],
    () => "same-id",
  )
  assert.deepEqual(generatedConflict, { ok: false, reason: "generated-id-conflict" })
})

test("builds stable chapter groups and keeps ungrouped nodes reachable", () => {
  const groups = buildArticleTargetList(fixtureWork())

  assert.deepEqual(groups.map(group => group.chapterName), ["Second", "First", "Empty", "未分章"])
  assert.deepEqual(groups.map(group => group.nodes.map(node => node.nodeId)), [
    ["b-1", "b-2"],
    ["a-2", "a-1"],
    [],
    ["loose"],
  ])
  assert.deepEqual(groups[0].nodes[0], {
    nodeId: "b-1",
    title: "Shared",
    chapterId: "chapter-b",
    chapterName: "Second",
    pathLabel: "Second → Shared",
    disabled: false,
  })
})

test("path labels disambiguate repeated node titles and keep self-loop targets available", () => {
  const groups = buildArticleTargetList(fixtureWork(), { sourceNodeId: "a-2" })
  const nodes = groups.flatMap(group => group.nodes)
  const shared = nodes.filter(node => node.title === "Shared")

  assert.deepEqual(shared.map(node => node.pathLabel), ["Second → Shared", "First → Shared"])
  assert.equal(nodes.find(node => node.nodeId === "a-2").disabled, false)
  assert.equal(nodes.find(node => node.nodeId === "b-1").disabled, false)
})

test("filters targets case-insensitively by node title, chapter name, or full path", () => {
  const byTitle = buildArticleTargetList(fixtureWork(), { query: "  bEtA  " })
  assert.deepEqual(byTitle.map(group => group.nodes.map(node => node.nodeId)), [["b-2"]])

  const byChapter = buildArticleTargetList(fixtureWork(), { query: "fIRst" })
  assert.deepEqual(byChapter.map(group => group.nodes.map(node => node.nodeId)), [["a-2", "a-1"]])

  const byPath = buildArticleTargetList(fixtureWork(), { query: "second → shared" })
  assert.deepEqual(byPath.map(group => group.nodes.map(node => node.nodeId)), [["b-1"]])
})

test("reconciles non-branch interaction choices without requiring or preserving a target", () => {
  const existing = [{ id:"choice-a", text:"旧文字", targetId:"node-b", customMeta:{ keep:true } }]
  const result = reconcileArticleChoices(existing, [
    { id:"choice-a", text:"点点头", targetId:"", mode:"interaction" },
    { text:"摇摇头", targetId:"", mode:"interaction" },
  ], () => "choice-b")

  assert.equal(result.ok, true)
  assert.deepEqual(result.choices.map(choice => ({ id:choice.id, text:choice.text, targetId:choice.targetId, mode:choice.mode })), [
    { id:"choice-a", text:"点点头", targetId:"", mode:"interaction" },
    { id:"choice-b", text:"摇摇头", targetId:"", mode:"interaction" },
  ])
  assert.deepEqual(result.choices[0].customMeta, { keep:true })
})

test("describes valid and dangling article targets", () => {
  const work = fixtureWork()
  const valid = describeArticleTarget(work, "a-1")

  assert.equal(valid.ok, true)
  assert.equal(valid.node, work.nodes[3])
  assert.equal(valid.chapter, work.chapters[1])
  assert.equal(valid.pathLabel, "First → Alpha")
  assert.deepEqual(describeArticleTarget(work, "missing"), {
    ok: false,
    reason: "target-not-found",
  })
})
