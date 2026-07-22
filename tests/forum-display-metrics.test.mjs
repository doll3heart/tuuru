import test from "node:test"
import assert from "node:assert/strict"
import { forumDisplayCommentCount, forumDisplayFloor } from "../js/forum-display-metrics.js"

test("forum display comment count falls back to authored comments", () => {
  assert.equal(forumDisplayCommentCount({ comments:[{}, {}] }), 2)
  assert.equal(forumDisplayCommentCount({ comments:[{}], displayCommentCount:"" }), 1)
  assert.equal(forumDisplayCommentCount({ comments:[{}], displayCommentCount:-2 }), 1)
})

test("forum display comment count accepts zero and large authored values", () => {
  assert.equal(forumDisplayCommentCount({ comments:[{}], displayCommentCount:0 }), 0)
  assert.equal(forumDisplayCommentCount({ comments:[], displayCommentCount:"1288" }), 1288)
})

test("forum display floor falls back to position and accepts positive authored values", () => {
  assert.equal(forumDisplayFloor({}, 3), 3)
  assert.equal(forumDisplayFloor({ displayFloor:0 }, 4), 4)
  assert.equal(forumDisplayFloor({ displayFloor:"520" }, 2), 520)
})
