import test from "node:test"
import assert from "node:assert/strict"

import { resolveArticleChoiceTarget } from "../js/article-reader-navigation.js"

function fixtureNodes() {
  return [
    { id: "opening", title: "Opening", chapterId: "chapter-a" },
    { id: "same-node", title: "Stay here", chapterId: "chapter-a" },
    { id: "far-away", title: "Across chapters", chapterId: "chapter-b" },
  ]
}

test("accepts a unique self-loop target", () => {
  const nodes = fixtureNodes()

  const result = resolveArticleChoiceTarget(nodes, "same-node")

  assert.deepEqual(result, {
    ok: true,
    status: "valid",
    targetId: "same-node",
    target: nodes[1],
  })
})

test("accepts a unique target in another chapter", () => {
  const nodes = fixtureNodes()

  const result = resolveArticleChoiceTarget(nodes, "far-away")

  assert.equal(result.ok, true)
  assert.equal(result.status, "valid")
  assert.equal(result.target, nodes[2])
})

test("rejects an empty target without choosing a fallback", () => {
  assert.deepEqual(resolveArticleChoiceTarget(fixtureNodes(), ""), {
    ok: false,
    status: "empty",
    targetId: "",
    target: null,
  })
  assert.deepEqual(resolveArticleChoiceTarget(fixtureNodes(), "   "), {
    ok: false,
    status: "empty",
    targetId: "",
    target: null,
  })
  assert.deepEqual(resolveArticleChoiceTarget(fixtureNodes(), null), {
    ok: false,
    status: "empty",
    targetId: "",
    target: null,
  })
})

test("rejects a dangling target without falling back to the first node", () => {
  const nodes = fixtureNodes()

  assert.deepEqual(resolveArticleChoiceTarget(nodes, "deleted-node"), {
    ok: false,
    status: "missing",
    targetId: "deleted-node",
    target: null,
  })
})

test("rejects an ambiguous target id", () => {
  const nodes = [
    { id: "duplicate", title: "First", chapterId: "chapter-a" },
    { id: "duplicate", title: "Second", chapterId: "chapter-b" },
  ]

  assert.deepEqual(resolveArticleChoiceTarget(nodes, "duplicate"), {
    ok: false,
    status: "duplicate",
    targetId: "duplicate",
    target: null,
  })
})

test("does not mutate the supplied node list", () => {
  const nodes = fixtureNodes()
  const snapshot = structuredClone(nodes)

  resolveArticleChoiceTarget(nodes, "far-away")
  resolveArticleChoiceTarget(nodes, "missing")

  assert.deepEqual(nodes, snapshot)
})
