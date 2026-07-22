import test from "node:test"
import assert from "node:assert/strict"

import { reorderForumCommentByOffset, reorderForumCommentTree } from "../js/forum-comment-reorder.js"

function comments() {
  return [
    { id:"a", content:"A", future:{ keep:true }, replies:[
      { id:"a1", content:"A1", replies:[] },
      { id:"a2", content:"A2", replies:[] },
    ] },
    { id:"b", content:"B", replies:[] },
    { id:"c", content:"C", replies:[] },
  ]
}

test("forum roots reorder before or after a sibling without losing metadata", () => {
  const source = comments()
  const result = reorderForumCommentTree(source, "c", "a", "before")
  assert.equal(result.ok, true)
  assert.deepEqual(result.comments.map(item => item.id), ["c", "a", "b"])
  assert.deepEqual(result.comments[1].future, { keep:true })
  assert.deepEqual(source.map(item => item.id), ["a", "b", "c"])
})

test("nested replies reorder only inside their own reply level", () => {
  const nested = reorderForumCommentTree(comments(), "a2", "a1", "before")
  assert.equal(nested.ok, true)
  assert.deepEqual(nested.comments[0].replies.map(item => item.id), ["a2", "a1"])

  const crossLevel = reorderForumCommentTree(comments(), "a1", "b", "before")
  assert.equal(crossLevel.ok, false)
  assert.equal(crossLevel.reason, "different-container")
})

test("keyboard offsets move one sibling at a time and stop at the edge", () => {
  const moved = reorderForumCommentByOffset(comments(), "b", -1)
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.comments.map(item => item.id), ["b", "a", "c"])
  assert.equal(reorderForumCommentByOffset(moved.comments, "b", -1).ok, false)
})
