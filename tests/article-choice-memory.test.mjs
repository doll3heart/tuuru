import test from "node:test"
import assert from "node:assert/strict"

import {
  pruneArticleChoiceMemory,
  recordArticleChoice,
  selectedArticleChoiceIds,
} from "../js/article-choice-memory.js"

test("reselecting at one source replaces its old choice without mutating memory", () => {
  const first = recordArticleChoice({}, "node-1", "choice-a")
  const withAnotherSource = recordArticleChoice(first, "node-2", "choice-c")
  const second = recordArticleChoice(withAnotherSource, "node-1", "choice-b")

  assert.deepEqual(first, { "node-1": "choice-a" })
  assert.deepEqual(withAnotherSource, { "node-1": "choice-a", "node-2": "choice-c" })
  assert.deepEqual(second, { "node-1": "choice-b", "node-2": "choice-c" })
})

test("prunes abandoned downstream sources while retaining earlier route choices", () => {
  const memory = {
    "node-early": "choice-a",
    "node-abandoned": "choice-b",
    "node-current": "choice-c",
  }

  const pruned = pruneArticleChoiceMemory(memory, new Set(["node-early", "node-current"]))

  assert.deepEqual(pruned, {
    "node-early": "choice-a",
    "node-current": "choice-c",
  })
  assert.deepEqual(memory, {
    "node-early": "choice-a",
    "node-abandoned": "choice-b",
    "node-current": "choice-c",
  })
})

test("returns exact selected IDs and safely ignores malformed legacy entries", () => {
  const memory = Object.freeze({
    "node-a": "choice-a",
    " node-b ": "choice-b",
    "node-c": " choice-c ",
    "node-d": 4,
  })

  assert.deepEqual([...selectedArticleChoiceIds(memory)], ["choice-a"])
  assert.deepEqual(recordArticleChoice(memory, " node-e ", "choice-e"), { "node-a": "choice-a" })
  assert.deepEqual(recordArticleChoice(memory, "node-e", " choice-e "), { "node-a": "choice-a" })
})
