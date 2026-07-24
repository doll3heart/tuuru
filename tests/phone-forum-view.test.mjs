import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"
import { renderPhoneForumComment, renderPhoneForumPost } from "../js/phone-forum-view.js"

const sharedCss = await readFile(new URL("../css/phone-forum.css", import.meta.url), "utf8")

function parse(html) {
  return new JSDOM(`<body>${html}</body>`).window.document
}

const rootComment = {
  id:"comment-a",
  contactId:"contact-a",
  contactName:"顾逢川",
  content:"一级评论",
  time:"21:01",
  likes:2,
  replies:[{
    id:"reply-a",
    contactId:"contact-b",
    contactName:"MAY",
    content:"第一层回复",
    time:"21:02",
    replies:[{
      id:"reply-b",
      contactId:"contact-a",
      contactName:"顾逢川",
      content:"第二层回复",
      replyToName:"MAY",
      replies:[],
    }],
  }],
}

const baseOptions = {
  resolveIdentity:item => ({ name:item.contactName, avatar:"", ipLocation:"" }),
  avatarColor:() => "#789",
  renderText:value => String(value),
  showTimestamp:() => true,
  displayFloor:(comment, floor) => comment.displayFloor || floor,
}

test("author and reader forum comments share one flat component tree", () => {
  const author = parse(renderPhoneForumComment(rootComment, { floor:1, containerKey:"root" }, {
    ...baseOptions,
    editable:true,
  }))
  const reader = parse(renderPhoneForumComment(rootComment, { floor:1, containerKey:"root" }, {
    ...baseOptions,
    isLiked:item => item.id === "comment-a",
  }))

  for (const document of [author, reader]) {
    assert.ok(document.querySelector(".forum-comment > .forum-comment-row"))
    assert.equal(document.querySelectorAll(".forum-reply-item").length, 2)
    assert.match(document.querySelector('[data-forum-comment-id="reply-b"] .forum-reply-meta').textContent, /顾逢川\s*回复\s*MAY/)
    assert.equal(document.querySelector("[style*='--rd-thread-depth']"), null)
    assert.equal(document.querySelector(".rd-forum-comment"), null)
  }

  assert.ok(author.querySelector('[data-forum-comment-likes="comment-a"]'))
  assert.ok(author.querySelector('[data-forum-comment-action="comment-a"]'))
  assert.ok(reader.querySelector('[data-forum-comment-like="comment-a"]'))
  assert.equal(reader.querySelector('[data-forum-comment-action="comment-a"]'), null)
})

test("author and reader forum posts share the authored post structure", () => {
  const post = { id:"post-a", contactId:"contact-a", contactName:"顾逢川", title:"主楼", content:"正文", time:"21:00" }
  const author = parse(renderPhoneForumPost(post, {
    ...baseOptions,
    renderPostMeta:item => `<input data-post-time="${item.id}">`,
  }))
  const reader = parse(renderPhoneForumPost(post, {
    ...baseOptions,
    renderActions:item => `<span>评论 ${item.id}</span>`,
  }))

  for (const document of [author, reader]) {
    assert.ok(document.querySelector(".forum-post-full > .forum-post-head"))
    assert.equal(document.querySelector(".forum-post-title").textContent, "主楼")
    assert.equal(document.querySelector(".forum-post-content").textContent, "正文")
  }
  assert.ok(author.querySelector("[data-post-time]"))
  assert.equal(reader.querySelector("[data-post-time]"), null)
})

test("shared forum CSS removes recursive cards and restores width for deep replies", () => {
  assert.match(sharedCss, /\.phone-frame \.forum-comment\s*\{[^}]*border-bottom:\s*1px solid/s)
  assert.doesNotMatch(sharedCss, /\.phone-frame \.forum-comment\s*\{[^}]*border:\s*1px solid/s)
  assert.match(sharedCss, /\.phone-frame \.forum-replies\s*\{[^}]*border:\s*0/s)
  assert.match(sharedCss, /\.phone-frame \.forum-reply-copy > \.forum-replies\s*\{[^}]*width:\s*calc\(100% \+ 32px\)[^}]*margin-left:\s*-32px/s)
})
