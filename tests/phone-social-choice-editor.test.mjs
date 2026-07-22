import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { readFile } from "node:fs/promises"

const authorCss = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = await readFile(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  return dom
}

function makePhoneData() {
  const choice = {
    id: "social-choice-a",
    text: "我知道了。",
    replyText: "我知道了。",
    customMeta: { keep: true },
    followUpMessages: [{
      id: "social-follow-a",
      senderId: "contact-1",
      content: "legacy content",
      text: "那就好。",
      type: "text",
    }],
  }
  return {
    contacts: [
      { id: "contact-1", name: "林澈", avatarUrl: "", forumIpLocation:"上海", aliases:[{ id:"alias-1", name:"匿名马甲", forumId:"雨夜路人", avatarUrl:"alias.png", forumIpLocation:"北京" }] },
      { id: "contact-2", name: "白榆", avatarUrl: "", forumAvatarUrl:"forum-two.png", forumIpLocation:"广东", aliases:[] },
    ],
    chats: [],
    moments: [{
      id: "moment-a",
      contactId: "contact-1",
      content: "今天下雨。",
      images: [],
      time: "刚刚",
      comments: [{
        id: "moment-comment-a",
        contactId: "contact-1",
        contactName: "林澈",
        content: "记得带伞。",
        time: "刚刚",
        choices: [structuredClone(choice)],
      }],
    }],
    forumPosts: [{
      id: "post-a",
      contactId: "contact-1",
      contactName: "林澈",
      title: "天气",
      content: "外面下雨了。",
      time: "刚刚",
      images: [],
      comments: [{
        id: "forum-comment-a",
        contactId: "contact-1",
        contactName: "林澈",
        content: "你出门了吗？",
        time: "刚刚",
        replies: [{
          id: "forum-reply-a",
          contactId: "contact-1",
          contactName: "Nested author",
          content: "Nested reply",
          time: "later",
          replies: [{
            id: "forum-reply-child",
            contactId: "contact-1",
            contactName: "Deep nested author",
            content: "Deep nested reply",
            time: "latest",
            replies: [],
          }],
          choices: [structuredClone(choice)],
        }],
        choices: [structuredClone(choice)],
      }, {
        id: "forum-comment-b",
        contactId: "contact-1",
        contactName: "林澈",
        content: "第二条评论",
        time: "",
        replies: [],
      }],
    }],
    forumNpcs: [{ id: "npc-a", type: "npc", name: "路人", avatarUrl: "" }],
    memos: [],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [],
    skin: { readerId: "Reader" },
    apps: [],
  }
}

async function openApp(id, type) {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({ id, type: "article", phoneData: makePhoneData() })
  const overlay = openPhoneAppModal(draft.id, type)
  return { dom, draft, overlay }
}

function closeFixture({ dom, draft }) {
  draft.dispose()
  dom.window.close()
}

test("author moment choices open their local editor and preserve stable ids", async () => {
  const fixture = await openApp("moment-choice-editor", "messages")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector("#msgTabMoments").click()
    const choice = overlay.querySelector('.chat-choice-btn[data-moment-cid="moment-a"]')
    assert.ok(choice)
    choice.click()

    const editor = document.querySelector("#mcGroupsList")
    assert.ok(editor)
    assert.equal(draft.snapshot().phoneData.moments[0].comments.length, 1)
    editor.querySelector(".ch-grp-text").value = "改过的动态回复"
    document.querySelector("#mcSave").click()

    const saved = draft.snapshot().phoneData.moments[0].comments[0].choices[0]
    assert.equal(saved.id, "social-choice-a")
    assert.equal(saved.text, "改过的动态回复")
    assert.equal(saved.followUpMessages[0].id, "social-follow-a")
    assert.deepEqual(saved.customMeta, { keep: true })
    assert.equal(saved.used, undefined)
    assert.equal(draft.snapshot().phoneData.moments[0].comments.length, 1)
  } finally {
    closeFixture(fixture)
  }
})

test("author forum comments expose and edit reply choices without executing them", async () => {
  const fixture = await openApp("forum-choice-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const choice = overlay.querySelector('.chat-choice-btn[data-forum-comment-id="forum-comment-a"]')
    assert.ok(choice, "forum comments should render their authored reply choices")
    choice.click()

    const editor = document.querySelector("#threadChoiceGroups")
    assert.ok(editor)
    editor.querySelector(".thread-choice-text").value = "改过的论坛回复"
    editor.querySelector(".thread-choice-followups").value = "Updated follow-up"
    document.querySelector("#threadChoiceSave").click()

    const comment = draft.snapshot().phoneData.forumPosts[0].comments[0]
    assert.equal(comment.choices[0].id, "social-choice-a")
    assert.equal(comment.choices[0].text, "改过的论坛回复")
    assert.equal(comment.choices[0].followUpMessages[0].id, "social-follow-a")
    assert.equal(comment.choices[0].followUpMessages[0].text, "Updated follow-up")
    assert.equal(comment.choices[0].followUpMessages[0].content, "Updated follow-up")
    assert.deepEqual(comment.choices[0].customMeta, { keep: true })
    assert.equal(comment.replies.length, 1)
  } finally {
    closeFixture(fixture)
  }
})

test("each forum follow-up can use a different authored role", async () => {
  const fixture = await openApp("forum-multi-actor-followups", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    overlay.querySelector('[data-forum-choice-edit="forum-comment-a"]').click()
    const editor = document.querySelector("#threadChoiceGroups")
    editor.querySelector('[data-thread-followup-add="0"]').click()
    const rows = document.querySelectorAll('#threadChoiceGroups .thread-choice-followup-row')
    assert.equal(rows.length, 2)
    rows[1].querySelector('.thread-choice-followup-sender').value = "contact-2::"
    rows[1].querySelector('.thread-choice-followups').value = "白榆接着回复。"
    document.querySelector("#threadChoiceSave").click()
    const followUps = draft.snapshot().phoneData.forumPosts[0].comments[0].choices[0].followUpMessages
    assert.deepEqual(followUps.map(message => message.senderId), ["contact-1", "contact-2"])
    assert.equal(followUps[1].text, "白榆接着回复。")
  } finally {
    closeFixture(fixture)
  }
})

test("forum IP labels default off, persist their switch, and forum composer inserts mentions", async () => {
  const fixture = await openApp("forum-ip-and-mentions", "forum")
  const { draft, overlay } = fixture
  try {
    const toggle = overlay.querySelector('#fbIpToggle')
    assert.equal(toggle.getAttribute('aria-pressed'), 'false')
    assert.equal(overlay.querySelector('.forum-ip-label'), null)
    toggle.click()
    assert.equal(draft.snapshot().phoneData.forumSettings.showIpLocation, true)
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    assert.match(overlay.querySelector('.forum-ip-label')?.textContent || '', /上海/)

    overlay.querySelector('#fbBack').click()
    overlay.querySelector('#fbAddPost').click()
    document.querySelector('#idOk').click()
    const postModal = document.querySelector('#fpSave').closest('.modal-overlay')
    postModal.querySelector('#fpMention').click()
    document.querySelector('[name="forumId"][data-identity-contact="contact-2"]').click()
    document.querySelector('#idOk').click()
    assert.match(postModal.querySelector('#fpContent').value, /@白榆/)
  } finally {
    closeFixture(fixture)
  }
})

test("author can edit choices attached to a nested forum reply", async () => {
  const fixture = await openApp("nested-forum-choice-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const choice = overlay.querySelector('.chat-choice-btn[data-forum-comment-id="forum-reply-a"]')
    assert.ok(choice)
    assert.ok(overlay.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-a"] .forum-reply-avatar'))
    assert.ok(overlay.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-a"] [data-forum-reply-delete="forum-reply-a"]'))
    assert.match(authorCss, /\.forum-delete-btn\.is-reply\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s)
    choice.click()

    const editor = document.querySelector("#threadChoiceGroups")
    assert.ok(editor)
    editor.querySelector(".thread-choice-text").value = "Edited nested choice"
    document.querySelector("#threadChoiceSave").click()

    const nested = draft.snapshot().phoneData.forumPosts[0].comments[0].replies[0]
    assert.equal(nested.choices[0].id, "social-choice-a")
    assert.equal(nested.choices[0].text, "Edited nested choice")
    assert.equal(nested.content, "Nested reply")
  } finally {
    closeFixture(fixture)
  }
})

test("forum post time starts empty and remains directly editable", async () => {
  const fixture = await openApp("forum-post-time-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector("#fbAddPost").click()
    document.querySelector("#idOk").click()
    const createModal = document.querySelector("#fpSave").closest(".modal-overlay")
    assert.equal(createModal.querySelector("#fpTime").value, "")
    createModal.querySelector("#fpTitle").value = "没有默认时间"
    createModal.querySelector("#fpSave").click()

    assert.equal(draft.snapshot().phoneData.forumPosts[0].time, "")
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const timeInput = overlay.querySelector(".forum-post-time-edit")
    assert.ok(timeInput)
    timeInput.value = "2026-07-22 20:30"
    timeInput.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.equal(draft.snapshot().phoneData.forumPosts.find(post => post.id === "post-a").time, "2026-07-22 20:30")
  } finally {
    closeFixture(fixture)
  }
})

test("forum post detail exposes a complete editor and preserves paragraph breaks", async () => {
  const fixture = await openApp("forum-post-full-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const editButton = overlay.querySelector("#fbEditPost")
    assert.ok(editButton, "post editing must be discoverable without a right-click gesture")
    editButton.click()

    const editor = document.querySelector("#editPostSave").closest(".modal-overlay")
    editor.querySelector("#editPostTitle").value = "更新后的主楼"
    editor.querySelector("#editPostContent").value = "第一段\n\n第二段"
    editor.querySelector("#editPostTime").value = "2026-07-22 23:10"
    editor.querySelector("#editPostImg").value = "https://example.com/post.png"
    editor.querySelector("#editPostSave").click()

    const saved = draft.snapshot().phoneData.forumPosts.find(post => post.id === "post-a")
    assert.equal(saved.title, "更新后的主楼")
    assert.equal(saved.content, "第一段\n\n第二段")
    assert.equal(saved.time, "2026-07-22 23:10")
    assert.equal(saved.imageUrl, "https://example.com/post.png")
    assert.match(overlay.querySelector(".forum-post-content").textContent, /第一段\n\n第二段/)
    assert.match(authorCss, /\.forum-post-content\s*\{[^}]*white-space:\s*pre-wrap/s)
    assert.match(readerCss, /\.rd-forum-post-content\s*\{[^}]*white-space:\s*pre-wrap/s)
  } finally {
    closeFixture(fixture)
  }
})

test("author can set like counts for top-level and nested forum comments", async () => {
  const fixture = await openApp("forum-comment-likes-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    assert.equal(overlay.querySelector('.forum-comment-floor').textContent, "1楼")

    overlay.querySelector('[data-forum-comment-likes="forum-comment-a"]').click()
    document.querySelector('#forumCommentLikesInput').value = "12"
    document.querySelector('#forumCommentLikesSave').click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments[0].likes, 12)

    overlay.querySelector('[data-forum-comment-likes="forum-reply-a"]').click()
    document.querySelector('#forumCommentLikesInput').value = "3"
    document.querySelector('#forumCommentLikesSave').click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments[0].replies[0].likes, 3)
  } finally {
    closeFixture(fixture)
  }
})

test("forum posts can use a contact alias without losing the parent contact", async () => {
  const fixture = await openApp("forum-alias-author", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('#fbAddPost').click()
    const aliasOption = document.querySelector('[name="forumId"][data-identity-alias="alias-1"]')
    assert.ok(aliasOption)
    aliasOption.click()
    document.querySelector('#idOk').click()
    document.querySelector('#fpTitle').value = "匿名发帖"
    document.querySelector('#fpSave').click()

    const post = draft.snapshot().phoneData.forumPosts[0]
    assert.equal(post.contactId, "contact-1")
    assert.equal(post.aliasId, "alias-1")
    assert.equal(post.contactName, "雨夜路人")
    assert.equal(post.contactAvatar, "alias.png")
  } finally {
    closeFixture(fixture)
  }
})

test("new forum comments omit time by default and reveal it only on request", async () => {
  const fixture = await openApp("forum-optional-comment-time", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    overlay.querySelector('#fbAddComment').click()
    document.querySelector('#idOk').click()
    const commentModal = document.querySelector('#fcSave').closest('.modal-overlay')
    const timeField = commentModal.querySelector('#fcTimeField')
    assert.ok(timeField.hidden)
    commentModal.querySelector('#fcAddTime').click()
    assert.equal(timeField.hidden, false)
    commentModal.querySelector('#fcTime').value = "2026/7/22 21:30"
    commentModal.querySelector('#fcContent').value = "带时间的评论"
    commentModal.querySelector('#fcSave').click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments.at(-1).time, "2026/7/22 21:30")
  } finally {
    closeFixture(fixture)
  }
})

test("deep forum replies stay aligned and delete by stable id", async () => {
  const fixture = await openApp("forum-deep-reply-delete", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const deep = overlay.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-child"]')
    assert.ok(deep)
    assert.equal(deep.getAttribute('style'), null)
    deep.querySelector('[data-forum-reply-delete="forum-reply-child"]').click()
    const root = draft.snapshot().phoneData.forumPosts[0].comments[0]
    assert.equal(root.replies.length, 1)
    assert.equal(root.replies[0].id, "forum-reply-a")
    assert.equal(root.replies[0].replies.length, 0)
    assert.match(authorCss, /\.forum-reply-controls\s*\{[^}]*display:\s*flex/s)
    assert.doesNotMatch(authorCss, /\.forum-replies\s*\{[^}]*margin:\s*6px\s+0\s+0\s+36px/s)
  } finally {
    closeFixture(fixture)
  }
})

test("forum comment drag handles support keyboard floor reordering", async () => {
  const fixture = await openApp("forum-comment-keyboard-reorder", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const handle = overlay.querySelector('[data-forum-comment-drag="forum-comment-a"]')
    assert.ok(handle)
    handle.dispatchEvent(new window.KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }))
    assert.deepEqual(draft.snapshot().phoneData.forumPosts[0].comments.map(comment => comment.id), ["forum-comment-b", "forum-comment-a"])
  } finally {
    closeFixture(fixture)
  }
})
