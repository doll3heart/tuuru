import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { readFile } from "node:fs/promises"

const authorCss = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = await readFile(new URL("../reader/reader.css", import.meta.url), "utf8")
const sharedForumCss = await readFile(new URL("../css/phone-forum.css", import.meta.url), "utf8")

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
    }, {
      id: "post-b",
      contactId: "contact-2",
      contactName: "白榆",
      title: "第二个帖子",
      content: "用于测试排序。",
      time: "稍后",
      images: [],
      comments: [],
    }, {
      id: "post-c",
      contactId: "contact-1",
      contactName: "林澈",
      title: "第三个帖子",
      content: "继续测试排序。",
      time: "最后",
      images: [],
      comments: [],
    }],
    forumNpcs: [{ id: "npc-a", type: "npc", name: "路人", avatarUrl: "" }],
    memos: [],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [],
    skin: { readerId: "读者" },
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

test("moment comments can author and edit mentions with their display time", async () => {
  const fixture = await openApp("moment-comment-time-editor", "messages")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector("#msgTabMoments").click()
    overlay.querySelector('.moment-comment-edit-btn[data-moment-comment-edit="moment-a"]').click()
    document.querySelector('#momentCommentText').value = '@读者 updated'
    document.querySelector('#momentCommentTime').value = '2026/7/22 22:30'
    document.querySelector('#momentCommentSave').click()
    let saved = draft.snapshot().phoneData.moments[0].comments[0]
    assert.equal(saved.content, '@读者 updated')
    assert.equal(saved.time, '2026/7/22 22:30')

    overlay.querySelector('[data-moment-reply="moment-a"]').click()
    const replyInput = document.querySelector('#mrContent')
    replyInput.value = '@'
    replyInput.setSelectionRange(1, 1)
    replyInput.dispatchEvent(new window.InputEvent('input', { bubbles:true, data:'@', inputType:'insertText' }))
    const readerOption = Array.from(document.querySelectorAll('.phone-mention-picker-option')).find(button => button.querySelector('span')?.textContent === '读者')
    assert.ok(readerOption)
    readerOption.click()
    replyInput.value += 'new reply'
    document.querySelector('#mrTime').value = '2026/7/23 08:00'
    document.querySelector('#mrSave').click()
    saved = draft.snapshot().phoneData.moments[0].comments.at(-1)
    assert.equal(saved.content, '@读者 new reply')
    assert.equal(saved.time, '2026/7/23 08:00')
  } finally {
    closeFixture(fixture)
  }
})

test("a newly published moment can reopen the same form and keep its attached data", async () => {
  const fixture = await openApp("moment-reopen-editor", "messages")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector("#msgTabMoments").click()
    overlay.querySelector("#msgAddMoment").click()
    document.querySelector("#moContent").value = "刚发布的动态"
    document.querySelector("#moImgs").value = "first.png\nsecond.png"
    document.querySelector("#moSender").value = "contact-1"
    document.querySelector("#moTime").value = "发布时刻"
    document.querySelector("#moSave").click()

    const created = draft.snapshot().phoneData.moments[0]
    assert.equal(created.content, "刚发布的动态")
    const editButton = overlay.querySelector(`[data-moment-edit="${created.id}"]`)
    assert.ok(editButton)
    editButton.click()
    assert.equal(document.querySelector("#moContent").value, "刚发布的动态")
    assert.equal(document.querySelector("#moImgs").value, "first.png\nsecond.png")
    assert.equal(document.querySelector("#moSender").value, "contact-1")
    assert.equal(document.querySelector("#moTime").value, "发布时刻")

    document.querySelector("#moContent").value = "重新编辑后的动态"
    document.querySelector("#moImgs").value = "updated.png"
    document.querySelector("#moSender").value = "contact-2"
    document.querySelector("#moTime").value = "修改时刻"
    document.querySelector("#moSave").click()

    const saved = draft.snapshot().phoneData.moments.find(moment => moment.id === created.id)
    assert.equal(saved.content, "重新编辑后的动态")
    assert.deepEqual(saved.images, ["updated.png"])
    assert.equal(saved.contactId, "contact-2")
    assert.equal(saved.time, "修改时刻")
    assert.deepEqual(saved.likes, [])
    assert.deepEqual(saved.comments, [])
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
    overlay.querySelector('.chat-choice-btn[data-forum-comment-id="forum-comment-a"]').click()
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
    const content = postModal.querySelector('#fpContent')
    content.value = '@'
    content.setSelectionRange(1, 1)
    content.dispatchEvent(new window.InputEvent('input', { bubbles:true, data:'@', inputType:'insertText' }))
    const mentionOverlay = document.querySelector('.phone-mention-picker')?.closest('.modal-overlay')
    assert.ok(mentionOverlay?.classList.contains('phone-mention-picker-overlay'))
    Array.from(document.querySelectorAll('.phone-mention-picker-option')).find(button => button.querySelector('span')?.textContent === '白榆').click()
    assert.match(postModal.querySelector('#fpContent').value, /@白榆/)
    assert.equal(postModal.querySelector('#fpMention'), null)
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
    assert.ok(overlay.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-a"] [data-forum-comment-action="forum-reply-a"]'))
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
    const contentInput = editor.querySelector("#editPostContent")
    contentInput.value = "正文@"
    contentInput.setSelectionRange(contentInput.value.length, contentInput.value.length)
    contentInput.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles:true }))
    contentInput.dispatchEvent(new window.InputEvent("input", { bubbles:true, data:"@", isComposing:true }))
    assert.equal(document.querySelector(".phone-mention-picker"), null)
    contentInput.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles:true, data:"@" }))
    const mentionPicker = document.querySelector(".phone-mention-picker")
    assert.ok(mentionPicker, "mobile composition must open the mention picker after @ is committed")
    Array.from(mentionPicker.querySelectorAll(".phone-mention-picker-option"))
      .find(button => button.querySelector("span")?.textContent === "白榆")
      .click()
    assert.match(contentInput.value, /@白榆/)
    editor.querySelector("#editPostTitle").value = "更新后的主楼"
    contentInput.value = "第一段\n\n第二段"
    editor.querySelector("#editPostTime").value = "2026-07-22 23:10"
    editor.querySelector("#editPostImg").value = "https://example.com/post.png"
    editor.querySelector("#editPostSave").click()

    const saved = draft.snapshot().phoneData.forumPosts.find(post => post.id === "post-a")
    assert.equal(saved.title, "更新后的主楼")
    assert.equal(saved.content, "第一段\n\n第二段")
    assert.equal(saved.time, "2026-07-22 23:10")
    assert.equal(saved.imageUrl, "https://example.com/post.png")
    assert.match(overlay.querySelector(".forum-post-content").textContent, /第一段\n\n第二段/)
    assert.match(sharedForumCss, /\.phone-frame \.forum-post-content\s*\{[^}]*white-space:\s*pre-wrap/s)
    assert.doesNotMatch(authorCss, /^\.forum-post-content\s*\{/m)
    assert.doesNotMatch(readerCss, /\.rd-forum-post-content\s*\{/)
  } finally {
    closeFixture(fixture)
  }
})

test("forum authors can set a displayed comment count and custom comment floor", async () => {
  const fixture = await openApp("forum-display-metrics-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    overlay.querySelector('#fbEditPost').click()
    document.querySelector('#editPostCommentCount').value = '1288'
    document.querySelector('#editPostSave').click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].displayCommentCount, 1288)
    assert.match(overlay.querySelector('.forum-comments-title').textContent, /1288/)

    overlay.querySelector('[data-forum-comment-action="forum-comment-a"]').click()
    document.querySelector('[data-forum-comment-menu-action="edit"]').click()
    document.querySelector('#ecFloor').value = '520'
    document.querySelector('#ecSave').click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments[0].displayFloor, 520)
    assert.match(overlay.querySelector('.forum-comment-floor').textContent, /520/)
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

test("forum comment timestamps can be edited directly or hidden", async () => {
  const fixture = await openApp("forum-comment-time-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    assert.ok(overlay.querySelector('[data-forum-comment-time="forum-comment-a"]'))
    const nestedTime = overlay.querySelector('[data-forum-comment-time="forum-reply-a"]')
    assert.ok(nestedTime)

    nestedTime.click()
    assert.equal(document.querySelector("#forumCommentTimeInput").value, "later")
    document.querySelector("#forumCommentTimeInput").value = "2026/6/27"
    document.querySelector("#forumCommentTimeSave").click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments[0].replies[0].time, "2026/6/27")

    overlay.querySelector('[data-forum-comment-time="forum-reply-a"]').click()
    document.querySelector("#forumCommentTimeHide").click()
    assert.equal(draft.snapshot().phoneData.forumPosts[0].comments[0].replies[0].time, "")
    assert.equal(overlay.querySelector('[data-forum-comment-time="forum-reply-a"]'), null)
  } finally {
    closeFixture(fixture)
  }
})

test("a post can hide every reply timestamp without deleting saved times", async () => {
  const fixture = await openApp("forum-post-reply-time-toggle", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const toggle = overlay.querySelector('[data-post-reply-time-toggle="post-a"]')
    assert.ok(toggle)
    assert.equal(toggle.getAttribute("aria-pressed"), "false")
    assert.equal(overlay.querySelectorAll("[data-forum-comment-time]").length, 3)

    toggle.click()
    let savedPost = draft.snapshot().phoneData.forumPosts[0]
    assert.equal(savedPost.hideReplyTimes, true)
    assert.equal(savedPost.comments[0].time, "刚刚")
    assert.equal(savedPost.comments[0].replies[0].time, "later")
    assert.equal(savedPost.comments[0].replies[0].replies[0].time, "latest")
    assert.equal(overlay.querySelectorAll("[data-forum-comment-time]").length, 0)
    assert.equal(overlay.querySelector('[data-post-reply-time-toggle="post-a"]').getAttribute("aria-pressed"), "true")

    overlay.querySelector('[data-post-reply-time-toggle="post-a"]').click()
    savedPost = draft.snapshot().phoneData.forumPosts[0]
    assert.equal(savedPost.hideReplyTimes, false)
    assert.equal(overlay.querySelectorAll("[data-forum-comment-time]").length, 3)
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
    deep.querySelector('[data-forum-comment-action="forum-reply-child"]').click()
    document.querySelector('[data-forum-comment-menu-action="delete"]').click()
    const root = draft.snapshot().phoneData.forumPosts[0].comments[0]
    assert.equal(root.replies.length, 1)
    assert.equal(root.replies[0].id, "forum-reply-a")
    assert.equal(root.replies[0].replies.length, 0)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment-footer\s*\{[^}]*display:\s*flex/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-reply-copy > \.forum-replies\s*\{[^}]*margin-left:\s*-32px/s)
  } finally {
    closeFixture(fixture)
  }
})

test("an NPC can reply to a nested forum reply and keeps the reply target", async () => {
  const fixture = await openApp("forum-nested-reply-create", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const nested = overlay.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-a"]')
    assert.ok(nested, "nested replies need their own reply surface")
    nested.dispatchEvent(new window.MouseEvent("click", { bubbles:true }))

    const identity = document.querySelector('[name="forumId"][data-identity-contact="contact-2"][data-identity-alias=""]')
    assert.ok(identity)
    identity.click()
    document.querySelector("#idOk").click()
    document.querySelector("#fcContent").value = "我是在回复林澈"
    document.querySelector("#fcSave").click()

    const post = draft.snapshot().phoneData.forumPosts.find(item => item.id === "post-a")
    const target = post.comments[0].replies[0]
    assert.equal(post.comments.length, 2, "replying must not create another top-level comment")
    assert.equal(target.replies.length, 2)
    assert.deepEqual(target.replies.at(-1), {
      ...target.replies.at(-1),
      contactId: "contact-2",
      content: "我是在回复林澈",
      replyToCommentId: "forum-reply-a",
      replyToContactId: "contact-1",
      replyToAliasId: "",
      replyToName: "林澈",
    })

    const savedReply = overlay.querySelector(`[data-forum-comment-id="${target.replies.at(-1).id}"]`)
    assert.match(savedReply?.querySelector(".forum-reply-meta")?.textContent || "", /白榆\s*回复\s*林澈/)
  } finally {
    closeFixture(fixture)
  }
})

test("forum comments use a compact social layout with heart and action controls", async () => {
  const fixture = await openApp("forum-compact-social-layout", "forum")
  const { overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const parent = overlay.querySelector('.forum-comment[data-forum-comment-id="forum-comment-a"]')
    const nested = parent.querySelector('.forum-reply-item[data-forum-comment-id="forum-reply-a"]')
    assert.ok(parent.querySelector(".forum-comment-row"))
    assert.ok(parent.querySelector('[data-forum-comment-likes="forum-comment-a"] .forum-like-heart'))
    assert.ok(parent.querySelector('[data-forum-comment-action="forum-comment-a"]'))
    assert.ok(nested.querySelector('[data-forum-comment-likes="forum-reply-a"] .forum-like-heart'))
    assert.ok(nested.querySelector('[data-forum-comment-action="forum-reply-a"]'))
    assert.equal(parent.querySelector(".forum-comment-actions, .forum-reply-controls, [data-forum-comment-drag]"), null)
    assert.equal(parent.querySelector('[data-forum-reply-to]'), null)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment-row,[\s\S]*?display:\s*flex/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment-action-button\s*\{[^}]*width:\s*32px/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment-by,[\s\S]*?align-items:\s*center/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-reply-meta\s*\{[^}]*line-height:\s*1\.4/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment\s*\{[^}]*border-bottom:\s*1px solid/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-replies\s*\{[^}]*border:\s*0/s)
    assert.match(sharedForumCss, /\.phone-frame \.forum-comment-time-button\s*\{[^}]*min-height:\s*32px/s)
    assert.doesNotMatch(readerCss, /\.rd-forum-comment\s*\{[^}]*border:/s)

    parent.querySelector('[data-forum-comment-action="forum-comment-a"]').click()
    assert.ok(document.querySelector('.forum-comment-action-menu [data-forum-comment-menu-action="edit"]'))
    assert.ok(document.querySelector('.forum-comment-action-menu [data-forum-comment-menu-action="delete"]'))
  } finally {
    closeFixture(fixture)
  }
})

test("forum comment surfaces support keyboard sibling reordering", async () => {
  const fixture = await openApp("forum-comment-keyboard-reorder", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const comment = overlay.querySelector('[data-forum-comment-id="forum-comment-a"]')
    assert.ok(comment)
    comment.dispatchEvent(new window.KeyboardEvent('keydown', { key:'ArrowDown', altKey:true, bubbles:true }))
    assert.deepEqual(draft.snapshot().phoneData.forumPosts[0].comments.map(comment => comment.id), ["forum-comment-b", "forum-comment-a"])
  } finally {
    closeFixture(fixture)
  }
})

test("selecting the reader as reply author unlocks choices without adding a fixed reply", async () => {
  const fixture = await openApp("forum-reader-reply-branches", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const target = overlay.querySelector('[data-forum-comment-id="forum-comment-b"]')
    target.dispatchEvent(new window.MouseEvent("click", { bubbles:true }))

    const readerIdentity = document.querySelector('[name="forumId"][data-identity-reader="self"]')
    assert.ok(readerIdentity)
    readerIdentity.click()
    document.querySelector("#idOk").click()

    const replyModal = document.querySelector("#fcSave").closest(".modal-overlay")
    assert.equal(replyModal.querySelector("#fcContent"), null)
    replyModal.querySelector("#fcReaderChoices").click()
    const choiceEditor = document.querySelector("#threadChoiceGroups")
    choiceEditor.querySelector(".thread-choice-text").value = "我先想一想。"
    choiceEditor.querySelector(".thread-choice-reply").value = "我先想一想。"
    document.querySelector('[data-thread-followup-add="0"]').click()
    choiceEditor.querySelector(".thread-choice-followups").value = "好，我等你。"
    document.querySelector("#threadChoiceSave").click()
    replyModal.querySelector("#fcSave").click()

    const saved = draft.snapshot().phoneData.forumPosts[0].comments[1]
    assert.equal(saved.replies.length, 0)
    assert.equal(saved.choices[0].text, "我先想一想。")
    assert.equal(saved.choices[0].followUpMessages[0].text, "好，我等你。")
  } finally {
    closeFixture(fixture)
  }
})

test("a held forum comment suppresses its reply click and enters drag mode", async () => {
  const fixture = await openApp("forum-comment-long-press", "forum")
  const { overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const comment = overlay.querySelector('[data-forum-comment-id="forum-comment-b"]')
    const down = new window.MouseEvent("pointerdown", { bubbles:true, button:0, clientX:20, clientY:20 })
    Object.defineProperties(down, { pointerId:{ value:1 }, pointerType:{ value:"touch" } })
    comment.dispatchEvent(down)
    await new Promise(resolve => setTimeout(resolve, 440))
    assert.ok(comment.classList.contains("is-forum-dragging"))
    const up = new window.MouseEvent("pointerup", { bubbles:true, button:0, clientX:20, clientY:20 })
    Object.defineProperties(up, { pointerId:{ value:1 }, pointerType:{ value:"touch" } })
    document.dispatchEvent(up)
    comment.dispatchEvent(new window.MouseEvent("click", { bubbles:true }))
    assert.equal(document.querySelector("#idOk"), null)
  } finally {
    closeFixture(fixture)
  }
})

test("forum posts can be featured, pinned, and reordered without opening the post", async () => {
  const fixture = await openApp("forum-post-order-controls", "forum")
  const { draft, overlay } = fixture
  try {
    const postBAction = overlay.querySelector('[data-post-actions="post-b"]')
    assert.ok(postBAction)
    const postBActionImage = postBAction.querySelector('img')
    assert.equal(postBActionImage?.getAttribute('width'), '24')
    assert.equal(postBActionImage?.getAttribute('height'), '12')
    assert.equal(overlay.querySelectorAll('[data-post-actions]').length, 3)
    assert.equal(overlay.querySelector('[data-post-feature], [data-post-pin], [data-post-drag]'), null)
    postBAction.click()
    const featureAction = document.querySelector('[data-forum-post-state="featured"]')
    assert.ok(featureAction)
    assert.ok(Number(featureAction.closest('.forum-post-action-menu')?.style.zIndex) > 1000)
    assert.ok(document.querySelector('[data-forum-post-state="pinned"]'))
    featureAction.click()
    assert.equal(draft.snapshot().phoneData.forumPosts.find(post => post.id === "post-b").featured, true)
    assert.ok(overlay.querySelector('.forum-list-card[data-post-id="post-b"] .forum-post-state-featured'))
    assert.ok(overlay.querySelector("#fbAddPost"), "state controls must not open post detail")

    overlay.querySelector('[data-post-actions="post-b"]').click()
    document.querySelector('[data-forum-post-state="pinned"]').click()
    assert.equal(draft.snapshot().phoneData.forumPosts.find(post => post.id === "post-b").pinned, true)
    assert.deepEqual(
      [...overlay.querySelectorAll(".forum-list-card")].map(card => card.dataset.postId),
      ["post-b", "post-a", "post-c"],
    )

    const handle = overlay.querySelector('[data-post-actions="post-a"]')
    handle.dispatchEvent(new window.KeyboardEvent("keydown", { key:"ArrowDown", bubbles:true }))
    assert.deepEqual(
      draft.snapshot().phoneData.forumPosts.map(post => post.id),
      ["post-b", "post-c", "post-a"],
    )

    const dragHandle = overlay.querySelector('[data-post-actions="post-a"]')
    const targetCard = overlay.querySelector('.forum-list-card[data-post-id="post-c"]')
    targetCard.getBoundingClientRect = () => ({ top:40, height:40, bottom:80, left:0, right:300, width:300 })
    document.elementFromPoint = () => targetCard
    function pointer(type, clientY) {
      const event = new window.MouseEvent(type, { bubbles:true, cancelable:true, button:0, clientX:20, clientY })
      Object.defineProperty(event, "pointerId", { value:11 })
      Object.defineProperty(event, "pointerType", { value:"touch" })
      return event
    }
    dragHandle.dispatchEvent(pointer("pointerdown", 100))
    await new Promise(resolve => setTimeout(resolve, 440))
    document.dispatchEvent(pointer("pointermove", 48))
    document.dispatchEvent(pointer("pointerup", 48))
    assert.deepEqual(
      draft.snapshot().phoneData.forumPosts.map(post => post.id),
      ["post-b", "post-a", "post-c"],
    )
  } finally {
    closeFixture(fixture)
  }
})
