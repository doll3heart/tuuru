import test from "node:test"
import assert from "node:assert/strict"

import {
  findWorkTextMatches,
  replaceWorkText,
} from "../js/work-text-replace.js"

function fixture() {
  return {
    id: "work-Alice",
    type: "article",
    title: "Alice 的故事",
    desc: "写给 Alice",
    author: "Alice",
    startNode: "node-Alice",
    chapters: [{ id: "chapter-Alice", name: "Alice 章" }],
    scenes: [{ id: "scene-Alice", name: "Alice 场景" }],
    nodes: [{
      id: "node-Alice",
      chapterId: "chapter-Alice",
      title: "遇见 Alice",
      content: '<p>Alice <a href="https://example.test/Alice">Alice</a><!--TUURU:Alice-->&Alice;</p>',
      choices: [{
        id: "choice-Alice",
        text: "询问 Alice",
        selectedText: "Alice 回头了",
        targetId: "target-Alice",
      }],
      interactionGroups: [{
        id: "group-Alice",
        label: "Alice 的回答",
        choices: [{ id: "inline-Alice", text: "告诉 Alice", selectedText: "Alice 笑了" }],
      }],
    }],
    phoneData: {
      contacts: [{
        id: "contact-Alice",
        name: "Alice",
        note: "Alice 的备注",
        avatarUrl: "https://example.test/Alice.png",
        aliases: [{ id: "alias-Alice", name: "小 Alice" }],
      }],
      chats: [{
        id: "chat-Alice",
        contactIds: ["contact-Alice"],
        groupName: "Alice 小组",
        groupAvatarUrl: "https://example.test/Alice-group.png",
        messages: [{
          id: "message-Alice",
          senderId: "contact-Alice",
          text: "Alice：你好",
          image: "https://example.test/Alice-message.png",
          choices: [{ id: "message-choice-Alice", text: "回复 Alice", followUps: [{ id: "follow-Alice", text: "Alice 收到了" }] }],
        }],
      }],
      moments: [{
        id: "moment-Alice",
        contactId: "contact-Alice",
        content: "Alice 的朋友圈",
        images: ["https://example.test/Alice-moment.png"],
        comments: [{ id: "comment-Alice", contactId: "contact-Alice", text: "Alice 评论" }],
      }],
      forumPosts: [{
        id: "post-Alice",
        contactId: "contact-Alice",
        title: "Alice 发帖",
        content: "Alice 的帖子",
        comments: [{ id: "forum-comment-Alice", contactId: "contact-Alice", text: "Alice 回复" }],
      }],
      forumNpcs: [{ id: "npc-Alice", name: "路人 Alice", bio: "认识 Alice" }],
      memos: [{ id: "memo-Alice", title: "Alice 备忘", content: "联系 Alice" }],
      photos: [{ id: "photo-Alice", caption: "Alice 的照片", url: "https://example.test/Alice-photo.png" }],
      albums: [{ id: "album-Alice", name: "Alice 相册", photoIds: ["photo-Alice"] }],
      browserHistory: [{ id: "history-Alice", title: "搜索 Alice", url: "https://example.test/Alice-search" }],
      shoppingItems: [{ id: "shop-Alice", name: "Alice 的礼物", description: "送给 Alice", image: "https://example.test/Alice-shop.png" }],
      apps: [{ id: "app-Alice", type: "messages", name: "Alice 消息" }],
    },
    unknown: {
      id: "unknown-Alice",
      url: "https://example.test/Alice-unknown",
      structuralKey: "Alice",
    },
  }
}

test("indexes reader-visible article and phone text without indexing identifiers or media links", () => {
  const work = fixture()
  const matches = findWorkTextMatches(work, { search: "Alice" })

  assert.ok(matches.length > 20)
  assert.ok(matches.some(match => match.category === "文章正文" && match.field === "正文" && match.occurrences === 2))
  assert.ok(matches.some(match => match.category === "消息" && match.field === "文字"))
  assert.ok(matches.some(match => match.category === "朋友圈"))
  assert.ok(matches.some(match => match.category === "论坛"))
  assert.ok(matches.some(match => match.category === "备忘录"))
  assert.ok(matches.some(match => match.category === "联系人"))
  assert.equal(matches.some(match => match.path.at(-1) === "id"), false)
  assert.equal(matches.some(match => /url|image|targetId|senderId|contactId/i.test(String(match.path.at(-1)))), false)
  assert.equal(matches.some(match => match.path.includes("unknown")), false)
})

test("replaces selected visible fields immutably and preserves HTML structure, entities, comments, ids, and URLs", () => {
  const source = fixture()
  const before = structuredClone(source)
  const matches = findWorkTextMatches(source, { search: "Alice" })
  const body = matches.find(match => match.category === "文章正文" && match.field === "正文")
  const message = matches.find(match => match.category === "消息" && match.field === "文字")

  const result = replaceWorkText(source, {
    search: "Alice",
    replacement: "白榆",
    selectedMatchIds: [body.id, message.id],
  })

  assert.equal(result.changed, true)
  assert.equal(result.matchedFields, 2)
  assert.equal(result.replacementCount, 3)
  assert.equal(
    result.work.nodes[0].content,
    '<p>白榆 <a href="https://example.test/Alice">白榆</a><!--TUURU:Alice-->&Alice;</p>',
  )
  assert.equal(result.work.phoneData.chats[0].messages[0].text, "白榆：你好")
  assert.equal(result.work.nodes[0].id, "node-Alice")
  assert.equal(result.work.nodes[0].choices[0].targetId, "target-Alice")
  assert.equal(result.work.phoneData.contacts[0].avatarUrl, "https://example.test/Alice.png")
  assert.deepEqual(source, before)
})

test("supports literal metacharacters, optional case sensitivity, and deleting matched text", () => {
  const work = {
    id: "work",
    title: "A.B a.b aXb",
    nodes: [{ id: "node", title: "a.b", content: "<p>A.B a.b</p>", choices: [] }],
  }

  assert.equal(findWorkTextMatches(work, { search: "a.b" })[0].occurrences, 2)
  assert.equal(
    findWorkTextMatches(work, { search: "a.b", caseSensitive: true })
      .reduce((sum, match) => sum + match.occurrences, 0),
    3,
  )

  const result = replaceWorkText(work, {
    search: "a.b",
    replacement: "",
    caseSensitive: true,
  })
  assert.equal(result.work.title, "A.B  aXb")
  assert.equal(result.work.nodes[0].title, "")
  assert.equal(result.work.nodes[0].content, "<p>A.B </p>")
})

test("fails safely for empty searches, unsupported work values, and unknown selections", () => {
  assert.deepEqual(findWorkTextMatches(null, { search: "Alice" }), [])
  assert.deepEqual(findWorkTextMatches(fixture(), { search: "" }), [])

  const source = fixture()
  const result = replaceWorkText(source, {
    search: "Alice",
    replacement: "Bob",
    selectedMatchIds: ["[\"missing\"]"],
  })
  assert.equal(result.changed, false)
  assert.equal(result.work, source)
  assert.equal(result.replacementCount, 0)
})
