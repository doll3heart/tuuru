import test from "node:test"
import assert from "node:assert/strict"

import {
  recordArticleInteractionSelection,
  pruneArticleInteractionSelections,
  selectedArticleInteractionChoiceIds,
  selectedArticleInteractionChoice,
} from "../js/article-interaction-memory.js"

test("random-game selections retain bounded roll details", () => {
  const memory = recordArticleInteractionSelection({}, "game-a", "node-a", "win", {
    type:"versus",
    player:6,
    opponent:2,
    sides:6,
  })
  assert.deepEqual(memory["game-a"], {
    nodeId:"node-a",
    choiceId:"win",
    gameResult:{type:"versus", player:6, opponent:2, sides:6},
  })
})

test("selections from two ordinary groups in one node coexist", () => {
  let memory = recordArticleInteractionSelection({}, "group-a", "node-a", "choice-a")
  memory = recordArticleInteractionSelection(memory, "group-b", "node-a", "choice-b")
  assert.deepEqual([...selectedArticleInteractionChoiceIds(memory)], ["choice-a", "choice-b"])
  assert.equal(selectedArticleInteractionChoice(memory, "group-a"), "choice-a")
  assert.equal(selectedArticleInteractionChoice(memory, "group-b"), "choice-b")
})

test("reselecting one group leaves every other group untouched", () => {
  const current = {
    "group-a":{nodeId:"node-a", choiceId:"choice-a"},
    "group-b":{nodeId:"node-a", choiceId:"choice-b"},
  }
  const next = recordArticleInteractionSelection(current, "group-a", "node-a", "choice-c")
  assert.equal(next["group-a"].choiceId, "choice-c")
  assert.equal(next["group-b"].choiceId, "choice-b")
  assert.equal(current["group-a"].choiceId, "choice-a")
})

test("route pruning keeps groups from retained nodes and drops abandoned nodes", () => {
  const memory = {
    "group-a":{nodeId:"node-a", choiceId:"choice-a"},
    "group-b":{nodeId:"node-b", choiceId:"choice-b"},
    "group-c":{nodeId:"node-c", choiceId:"choice-c"},
  }
  const pruned = pruneArticleInteractionSelections(memory, ["node-a", "node-c"])
  assert.deepEqual(Object.keys(pruned), ["group-a", "group-c"])
})

test("malformed ids and records fail closed without mutating valid selections", () => {
  const current = {"group-a":{nodeId:"node-a", choiceId:"choice-a"}}
  assert.deepEqual(recordArticleInteractionSelection(current, " bad ", "node-a", "choice-b"), current)
  assert.deepEqual(recordArticleInteractionSelection(current, "group-b", "", "choice-b"), current)
  assert.deepEqual(selectedArticleInteractionChoiceIds({
    ...current,
    bad:null,
    "group-b":{nodeId:"node-b", choiceId:" bad "},
  }), new Set(["choice-a"]))
})
