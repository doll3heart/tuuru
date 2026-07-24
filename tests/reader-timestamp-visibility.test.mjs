import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
}

function seedWork() {
  const icon = '<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>'
  const contactId = "contact-a"
  const work = {
    schemaVersion: 1,
    id: "reader-hidden-phone-times",
    type: "phone",
    title: "Hidden phone times",
    placeholders: [],
    scenes: [],
    phoneData: {
      displaySettings: { hideAllTimestamps: true },
      contacts: [{ id: contactId, name: "Alice" }],
      chats: [{
        id: "chat-a",
        type: "private",
        contactIds: [contactId],
        rounds: [{ id: "round-a", messages: [
          { id: "chat-time", type: "time", time: "CHAT_TIME_MARKER" },
          { id: "chat-copy", type: "text", senderId: contactId, text: "chat content" },
        ] }],
      }],
      moments: [{
        id: "moment-a",
        contactId,
        contactName: "Alice",
        content: "moment content",
        time: "MOMENT_TIME_MARKER",
        comments: [{ id: "moment-comment-a", contactId, content: "moment comment", time: "MOMENT_COMMENT_TIME_MARKER" }],
      }],
      forumPosts: [{
        id: "post-a",
        contactId,
        contactName: "Alice",
        title: "forum content",
        content: "forum body",
        time: "FORUM_TIME_MARKER",
        comments: [{ id: "comment-a", contactId, content: "forum comment", time: "FORUM_COMMENT_TIME_MARKER" }],
      }],
      forumNpcs: [],
      memos: [{ id: "memo-a", contactId, content: "memo content", time: "MEMO_TIME_MARKER" }],
      photos: [{ id: "photo-a", contactId, albumId: null, caption: "photo content", imageUrl: "", time: "PHOTO_TIME_MARKER" }],
      albums: [],
      browserHistory: [{ id: "history-a", contactId, title: "browser content", url: "https://example.invalid", time: "BROWSER_TIME_MARKER" }],
      shoppingItems: [{
        id: "order-a",
        contactId,
        status: "order",
        name: "order content",
        price: 20,
        actualPay: 20,
        time: "ORDER_TIME_MARKER",
      }],
      appConnections: {
        memo: { contactId, prompt: "" },
        gallery: { contactId, prompt: "" },
        browser: { contactId, prompt: "" },
        shopping: { contactId, prompt: "" },
      },
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [
        { id: "messages-app", type: "messages", name: "Messages", icon, desktopX: 0, desktopY: 0, enabled: true },
        { id: "forum-app", type: "forum", name: "Forum", icon, desktopX: 1, desktopY: 0, enabled: true },
        { id: "memo-app", type: "memo", name: "Memo", icon, desktopX: 2, desktopY: 0, enabled: true },
        { id: "gallery-app", type: "gallery", name: "Gallery", icon, desktopX: 3, desktopY: 0, enabled: true },
        { id: "browser-app", type: "browser", name: "Browser", icon, desktopX: 0, desktopY: 1, enabled: true },
        { id: "shopping-app", type: "shopping", name: "Shopping", icon, desktopX: 1, desktopY: 1, enabled: true },
      ],
    },
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

function returnToDesktop() {
  const back = document.querySelector(".rd-back-btn")
  assert.ok(back)
  back.click()
  assert.ok(document.getElementById("phoneDesktopReader"))
}

test("reader Apps hide every content timestamp when the phone setting is enabled", async t => {
  installDom(t)
  seedWork()
  await import(`../reader/reader.js?reader-hidden-phone-times=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  document.querySelector('[data-app-type="messages"]').click()
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /CHAT_TIME_MARKER/)
  document.querySelector('[data-message-section="moments"]').click()
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /MOMENT_TIME_MARKER|MOMENT_COMMENT_TIME_MARKER/)
  returnToDesktop()

  document.querySelector('[data-app-type="forum"]').click()
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /FORUM_TIME_MARKER/)
  document.querySelector('[data-post-index="0"]').click()
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /FORUM_TIME_MARKER|FORUM_COMMENT_TIME_MARKER/)
  document.querySelector(".rd-back-btn").click()
  returnToDesktop()

  for (const [type, marker] of [
    ["memo", /MEMO_TIME_MARKER/],
    ["gallery", /PHOTO_TIME_MARKER/],
    ["browser", /BROWSER_TIME_MARKER/],
    ["shopping", /ORDER_TIME_MARKER/],
  ]) {
    document.querySelector(`[data-app-type="${type}"]`).click()
    document.querySelector('[data-connection-action="confirm"]').click()
    if (type === "shopping") document.querySelectorAll(".rd-shop-tab")[1].click()
    assert.doesNotMatch(document.querySelector(".phone-frame").textContent, marker)
    returnToDesktop()
  }
})
