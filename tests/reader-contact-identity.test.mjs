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
  const avatar = "data:image/png;base64,Y29udGFjdA=="
  const messageAvatar = "data:image/png;base64,bWVzc2FnZQ=="
  const forumAvatar = "data:image/png;base64,Zm9ydW0="
  const work = {
    schemaVersion: 1,
    id: "reader-contact-identity",
    type: "phone",
    title: "Identity",
    placeholders: [{ id:"reader-name", key:"某某", label:"读者姓名", prompt:"你的名字？", default:"读者", values:[] }],
    scenes: [],
    phoneData: {
      contacts: [{
        id: "contact-1",
        name: "林雾",
        msgId: "雾中来信",
        forumId: "北岸观测员",
        avatarUrl: avatar,
        messageAvatarUrl: messageAvatar,
        forumAvatarUrl: forumAvatar,
        forumIpLocation: "上海",
        pinned: true,
      }, { id:"contact-2", name:"安安", avatarUrl:"" }],
      contactSortMode: "az",
      chats: [
        { id: "chat-1", type: "single", contactIds: ["contact-1"], rounds: [] },
        { id:"chat-2", type:"group", groupName:"测试群", contactIds:["contact-1", "contact-2"], rounds:[{ id:"round-1", label:"第1轮", messages:[{ id:"mention-message", type:"text", senderId:"contact-1", text:"@安安 看这里" }] }] },
      ],
      moments: [{ id:"moment-placeholder", contactId:"contact-1", content:"@某某 你好", time:"给某某", images:[], comments:[{ id:"moment-comment-placeholder", contactId:"contact-1", content:"支持某某", time:"现在" }] }],
      forumPosts: [{
        id: "post-1",
        contactId: "contact-1",
        contactName: "创建时旧姓名",
        contactAvatar: "",
        title: "测试帖子",
        content: "@北岸观测员 正文",
        comments: [],
      }],
      forumSettings: { showIpLocation:true },
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
  document.querySelector('[data-ph-id="reader-name"]').value = "读者"
  document.getElementById("rdStartBtn").click()

  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('[data-message-section="moments"]').click()
  assert.match(document.querySelector('.rd-moment-content').textContent, /@读者 你好/)
  assert.equal(document.querySelector('.rd-moment-content .rd-mention')?.textContent, '@读者')
  assert.match(document.querySelector('.rd-thread-comment-content').textContent, /支持读者/)
  document.querySelector('[data-message-section="chats"]').click()
  assert.match(document.querySelector(".phone-frame").textContent, /雾中来信/)
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /林雾/)
  assert.equal(document.querySelector('.rd-message-avatar img')?.getAttribute('src'), messageAvatar)
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  assert.equal(document.querySelector('.rd-mention')?.textContent, '@安安')
  document.querySelector('#chatBack').click()
  document.querySelector(".rd-back-btn").click()

  document.querySelector('[data-app-type="forum"]').click()
  const forumFrame = document.querySelector(".phone-frame")
  assert.match(forumFrame.textContent, /北岸观测员/)
  assert.doesNotMatch(forumFrame.textContent, /创建时旧姓名/)
  assert.equal(forumFrame.querySelector('.rd-forum-avatar img')?.getAttribute('src'), forumAvatar)
  forumFrame.querySelector('.rd-post-card').click()
  assert.match(forumFrame.querySelector('.rd-forum-ip')?.textContent || '', /上海/)
  assert.equal(forumFrame.querySelector('.rd-mention')?.textContent, '@北岸观测员')
  forumFrame.querySelector('.rd-back-btn').click()
  document.querySelector(".rd-back-btn").click()

  document.querySelector('[data-app-type="contacts"]').click()
  assert.equal(document.querySelector('.rd-contact-entry:first-child .rd-contact-name').textContent, "林雾")
  assert.equal(document.querySelector('.rd-contact-avatar img')?.getAttribute('src'), avatar)
})
