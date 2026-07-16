import test from "node:test"
import assert from "node:assert/strict"

import { reorderArticleNode } from "../js/article-node-reorder.js"

function fixtureNodes() {
  return [
    { id: "a-1", title: "A1", chapterId: "chapter-a", choices: [{ id: "choice-a", text: "go", targetId: "b-1" }] },
    { id: "a-2", title: "A2", chapterId: "chapter-a", choices: [] },
    { id: "b-1", title: "B1", chapterId: "chapter-b", choices: [] },
    { id: "b-2", title: "B2", chapterId: "chapter-b", choices: [] },
  ]
}

test("reorders a node before a sibling without changing stable ids or links", () => {
  const original = fixtureNodes()
  const snapshot = structuredClone(original)

  const result = reorderArticleNode(original, {
    draggedId: "a-2",
    targetId: "a-1",
    placement: "before",
  })

  assert.equal(result.ok, true)
  assert.equal(result.changed, true)
  assert.deepEqual(result.nodes.map(node => node.id), ["a-2", "a-1", "b-1", "b-2"])
  assert.equal(result.nodes.find(node => node.id === "a-1").choices[0].targetId, "b-1")
  assert.deepEqual(original, snapshot)
})

test("moves a node across chapters at an exact insertion point", () => {
  const original = fixtureNodes()

  const result = reorderArticleNode(original, {
    draggedId: "a-2",
    targetId: "b-2",
    targetChapterId: "chapter-b",
    placement: "before",
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.nodes.map(node => node.id), ["a-1", "b-1", "a-2", "b-2"])
  assert.equal(result.nodes.find(node => node.id === "a-2").chapterId, "chapter-b")
})

test("dropping on a chapter appends after that chapter's last node", () => {
  const result = reorderArticleNode(fixtureNodes(), {
    draggedId: "a-1",
    targetChapterId: "chapter-b",
    placement: "inside",
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.nodes.map(node => node.id), ["a-2", "b-1", "b-2", "a-1"])
  assert.equal(result.nodes.at(-1).chapterId, "chapter-b")
})

test("dropping on an empty chapter keeps the node reachable in the array", () => {
  const result = reorderArticleNode(fixtureNodes(), {
    draggedId: "b-1",
    targetChapterId: "chapter-empty",
    placement: "inside",
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.nodes.map(node => node.id), ["a-1", "a-2", "b-2", "b-1"])
  assert.equal(result.nodes.at(-1).chapterId, "chapter-empty")
})

test("reports invalid and ambiguous node targets without mutating input", () => {
  const original = fixtureNodes()

  assert.deepEqual(
    reorderArticleNode(original, { draggedId: "missing", targetId: "a-1", placement: "before" }),
    { ok: false, reason: "dragged-node-not-found", nodes: original },
  )
  assert.deepEqual(
    reorderArticleNode(original, { draggedId: "a-1", targetId: "missing", placement: "before" }),
    { ok: false, reason: "target-node-not-found", nodes: original },
  )

  const duplicate = fixtureNodes()
  duplicate.push({ id: "a-1", title: "duplicate", chapterId: "chapter-c", choices: [] })
  const ambiguous = reorderArticleNode(duplicate, {
    draggedId: "a-1",
    targetId: "b-1",
    placement: "after",
  })
  assert.equal(ambiguous.ok, false)
  assert.equal(ambiguous.reason, "dragged-node-ambiguous")
  assert.equal(ambiguous.nodes, duplicate)
})
