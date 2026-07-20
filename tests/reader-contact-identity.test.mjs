import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("reader phone Apps resolve current contact avatar and per-App IDs", async t => {
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

  const icon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'
  const avatar = "data:image/png;base64,iVBORw0KGgo="
  const work = {
    schemaVersion: 1,
    id: "reader-contact-identity",
    type: "phone",
    title: "Identity",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{
        id: "contact-1",
        name: "林雾",
        msgId: "雾中来信",
        forumId: "北岸观测员",
        avatarUrl: avatar,
      }],
      chats: [{ id: "chat-1", type: "single", contactIds: ["contact-1"], rounds: [] }],
      moments: [],
      forumPosts: [{
        id: "post-1",
        contactId: "contact-1",
        contactName: "创建时旧姓名",
        contactAvatar: "",
        title: "测试帖子",
        content: "正文",
        comments: [],
      }],
      forumNpcs: [], memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [
        { id: "messages-app", type: "messages", name: "消息", icon, desktopX: 0, desktopY: 0, enabled: true },
        { id: "forum-app", type: "forum", name: "论坛", icon, desktopX: 1, desktopY: 0, enabled: true },
        { id: "contacts-app", type: "contacts", name: "联系人", icon, desktopX: 2, desktopY: 0, enabled: true },
      ],
    },
  }

  localStorage.setItem("moirain_recent", JSON.stringify([{ id: work.id, title: work.title, type: work.type }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?reader-contact-identity=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  document.querySelector('[data-app-type="messages"]').click()
  assert.match(document.querySelector(".phone-frame").textContent, /雾中来信/)
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /林雾/)
  document.querySelector(".rd-back-btn").click()

  document.querySelector('[data-app-type="forum"]').click()
  const forumFrame = document.querySelector(".phone-frame")
  assert.match(forumFrame.textContent, /北岸观测员/)
  assert.doesNotMatch(forumFrame.textContent, /创建时旧姓名/)
  assert.ok(forumFrame.querySelector('.rd-forum-avatar img[src^="data:image/png"]'))
  document.querySelector(".rd-back-btn").click()

  document.querySelector('[data-app-type="contacts"]').click()
  assert.ok(document.querySelector('.rd-contact-avatar img[src^="data:image/png"]'))
})
