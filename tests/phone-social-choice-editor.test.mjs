import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

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
    contacts: [{ id: "contact-1", name: "林澈", avatarUrl: "" }],
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
          replies: [],
          choices: [structuredClone(choice)],
        }],
        choices: [structuredClone(choice)],
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

test("author can edit choices attached to a nested forum reply", async () => {
  const fixture = await openApp("nested-forum-choice-editor", "forum")
  const { draft, overlay } = fixture
  try {
    overlay.querySelector('.forum-list-card[data-post-id="post-a"]').click()
    const choice = overlay.querySelector('.chat-choice-btn[data-forum-comment-id="forum-reply-a"]')
    assert.ok(choice)
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
