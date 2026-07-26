import test from "node:test"
import assert from "node:assert/strict"

import { resolveAutomaticArticleStartNodeId } from "../js/article-start-node.js"

test("the first ordinary node in the earliest authored chapter is always the start", () => {
  const work = {
    startNode: "legacy-manual-start",
    chapters: [
      { id: "chapter-1" },
      { id: "chapter-2" },
    ],
    nodes: [
      { id: "chapter-2-first", chapterId: "chapter-2" },
      { id: "chapter-1-first", chapterId: "chapter-1" },
      { id: "chapter-1-second", chapterId: "chapter-1" },
    ],
  }

  assert.equal(resolveAutomaticArticleStartNodeId(work), "chapter-1-first")
})

test("automatic start skips hidden nodes and empty chapters", () => {
  const work = {
    chapters: [
      { id: "empty-chapter" },
      { id: "chapter-2" },
    ],
    nodes: [
      { id: "hidden", chapterId: "chapter-2", kind: "conditional" },
      { id: "visible", chapterId: "chapter-2" },
    ],
  }

  assert.equal(resolveAutomaticArticleStartNodeId(work), "visible")
})

test("reordering nodes changes the automatic start without a separate start setting", () => {
  const work = {
    chapters: [{ id: "chapter-1" }],
    nodes: [
      { id: "second", chapterId: "chapter-1" },
      { id: "first", chapterId: "chapter-1" },
    ],
  }

  assert.equal(resolveAutomaticArticleStartNodeId(work), "second")
  assert.equal(
    resolveAutomaticArticleStartNodeId({ ...work, nodes: [work.nodes[1], work.nodes[0]] }),
    "first",
  )
})
