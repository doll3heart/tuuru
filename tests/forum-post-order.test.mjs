import test from "node:test"
import assert from "node:assert/strict"

import {
  orderedForumPosts,
  reorderForumPosts,
  toggleForumPostFlag,
} from "../js/forum-post-order.js"

const POSTS = Object.freeze([
  Object.freeze({ id:"normal-a", title:"普通 A" }),
  Object.freeze({ id:"pinned-a", title:"置顶 A", pinned:true }),
  Object.freeze({ id:"normal-b", title:"普通 B", featured:true }),
  Object.freeze({ id:"pinned-b", title:"置顶 B", pinned:true, featured:true }),
])

test("forum ordering keeps pinned posts first and preserves each authored group", () => {
  const ordered = orderedForumPosts(POSTS)
  assert.deepEqual(ordered.map(post => post.id), ["pinned-a", "pinned-b", "normal-a", "normal-b"])
  assert.deepEqual(POSTS.map(post => post.id), ["normal-a", "pinned-a", "normal-b", "pinned-b"])
  assert.equal(orderedForumPosts(null).length, 0)
})

test("pinning moves a post into the pinned group while featuring leaves order alone", () => {
  const pinned = toggleForumPostFlag(POSTS, "normal-b", "pinned")
  assert.equal(pinned.ok, true)
  assert.deepEqual(pinned.posts.map(post => post.id), ["normal-b", "pinned-a", "pinned-b", "normal-a"])
  assert.equal(pinned.posts[0].pinned, true)

  const featured = toggleForumPostFlag(POSTS, "normal-a", "featured")
  assert.equal(featured.ok, true)
  assert.deepEqual(featured.posts.map(post => post.id), POSTS.map(post => post.id))
  assert.equal(featured.posts[0].featured, true)
  assert.equal(POSTS[0].featured, undefined)
})

test("manual forum reorder works inside a pin group and rejects crossing its boundary", () => {
  const moved = reorderForumPosts(POSTS, "pinned-b", "pinned-a", "before")
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.posts.map(post => post.id), ["pinned-b", "pinned-a", "normal-a", "normal-b"])

  const crossed = reorderForumPosts(POSTS, "normal-a", "pinned-a", "before")
  assert.deepEqual(crossed, {
    ok:false,
    reason:"pin-boundary",
    posts:orderedForumPosts(POSTS),
  })
  assert.equal(reorderForumPosts(POSTS, "missing", "normal-a", "after").ok, false)
})
