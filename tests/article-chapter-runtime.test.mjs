import test from "node:test"
import assert from "node:assert/strict"

import {
  appendArticleChoice,
  currentArticleChapterEntries,
  previousArticleChapterPath,
} from "../js/article-chapter-runtime.js"

const nodes = [
  { id: "a", chapterId: "chapter-1" },
  { id: "b", chapterId: "chapter-1" },
  { id: "c", chapterId: "chapter-1" },
  { id: "d", chapterId: "chapter-2" },
  { id: "e", chapterId: "chapter-2" },
]

test("same-chapter choices append nodes to one visible page", () => {
  let path = ["a"]
  path = appendArticleChoice(nodes, path, 0, "b").path
  path = appendArticleChoice(nodes, path, 1, "c").path

  assert.deepEqual(path, ["a", "b", "c"])
  assert.deepEqual(currentArticleChapterEntries(nodes, path).map(entry => entry.node.id), ["a", "b", "c"])
})

test("reselecting an earlier choice truncates its old continuation", () => {
  const result = appendArticleChoice(nodes, ["a", "b", "c"], 0, "c")

  assert.equal(result.chapterChanged, false)
  assert.deepEqual(result.path, ["a", "c"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result.path).map(entry => entry.node.id), ["a", "c"])
})

test("cross-chapter choices retain history but show only the new chapter page", () => {
  const result = appendArticleChoice(nodes, ["a", "b"], 1, "d")

  assert.equal(result.chapterChanged, true)
  assert.deepEqual(result.path, ["a", "b", "d"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result.path).map(entry => entry.node.id), ["d"])
})

test("back from a chapter removes that chapter and restores the prior chapter path", () => {
  const result = previousArticleChapterPath(nodes, ["a", "b", "d", "e"])

  assert.deepEqual(result, ["a", "b"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result).map(entry => entry.node.id), ["a", "b"])
})
