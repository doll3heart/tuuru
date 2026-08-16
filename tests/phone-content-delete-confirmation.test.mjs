import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url:"http://localhost/" })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.FileReader = dom.window.FileReader
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  t.after(() => dom.window.close())
}

function phoneData() {
  return {
    contacts:[{ id:"contact-1", name:"林澈", avatarUrl:"" }],
    chats:[], moments:[], forumPosts:[], forumNpcs:[],
    memos:[{ id:"memo-1", contactId:"contact-1", content:"不能误删" }],
    browserHistory:[{ id:"history-1", contactId:"contact-1", title:"不能误删", url:"https://example.com", time:"今天" }],
    photos:[{ id:"photo-1", contactId:"contact-1", albumId:"album-1", caption:"不能误删", imageUrl:"" }],
    albums:[{ id:"album-1", contactId:"contact-1", name:"不能误删" }],
    shoppingItems:[{ id:"order-1", contactId:"contact-1", status:"order", name:"不能误删", price:12, time:"今天" }],
    appConnections:{
      memo:{ contactId:"contact-1", prompt:"" },
      browser:{ contactId:"contact-1", prompt:"" },
      gallery:{ contactId:"contact-1", prompt:"" },
      shopping:{ contactId:"contact-1", prompt:"" },
    },
    skin:{ readerId:"Reader" },
    apps:[],
  }
}

async function openEditor(t, type, suffix) {
  installDom(t)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({ id:`delete-confirm-${suffix}`, type:"article", phoneData:phoneData() })
  t.after(() => draft.dispose())
  const overlay = openPhoneAppModal(draft.id, type)
  const connectionContinue = overlay.querySelector("#characterAccessContinue")
  if (connectionContinue) connectionContinue.click()
  return { draft, overlay }
}

function confirmButton() {
  const button = document.querySelector("[data-phone-content-delete-confirm]")
  assert.ok(button, "a destructive content action should open a confirmation dialog")
  return button
}

test("memo deletion waits for explicit confirmation", async t => {
  const { draft, overlay } = await openEditor(t, "memo", "memo")
  overlay.querySelector('[data-memo-del="memo-1"]').click()
  assert.ok(draft.snapshot().phoneData.memos.some(item => item.id === "memo-1"))
  const cancel = document.querySelector("[data-phone-content-delete-cancel]")
  assert.ok(cancel)
  cancel.click()
  assert.ok(draft.snapshot().phoneData.memos.some(item => item.id === "memo-1"))
  overlay.querySelector('[data-memo-del="memo-1"]').click()
  confirmButton().click()
  assert.equal(draft.snapshot().phoneData.memos.some(item => item.id === "memo-1"), false)
})

test("browser history deletion waits for explicit confirmation", async t => {
  const { draft, overlay } = await openEditor(t, "browser", "browser")
  overlay.querySelector('[data-browser-del="history-1"]').click()
  assert.ok(draft.snapshot().phoneData.browserHistory.some(item => item.id === "history-1"))
  confirmButton().click()
  assert.equal(draft.snapshot().phoneData.browserHistory.some(item => item.id === "history-1"), false)
})

test("photo deletion waits for explicit confirmation", async t => {
  const { draft, overlay } = await openEditor(t, "gallery", "photo")
  overlay.querySelector('[data-album-id="album-1"]').click()
  overlay.querySelector('[data-photo-del="photo-1"]').click()
  assert.ok(draft.snapshot().phoneData.photos.some(item => item.id === "photo-1"))
  confirmButton().click()
  assert.equal(draft.snapshot().phoneData.photos.some(item => item.id === "photo-1"), false)
})

test("album deletion explains and delays moving its photos", async t => {
  const { draft, overlay } = await openEditor(t, "gallery", "album")
  overlay.querySelector('[data-album-id="album-1"]').click()
  overlay.querySelector("#gaDelAlbum").click()
  let snapshot = draft.snapshot().phoneData
  assert.ok(snapshot.albums.some(item => item.id === "album-1"))
  assert.equal(snapshot.photos.find(item => item.id === "photo-1").albumId, "album-1")
  assert.match(document.querySelector(".modal-overlay:last-of-type")?.textContent || "", /照片.*未归类/)
  confirmButton().click()
  snapshot = draft.snapshot().phoneData
  assert.equal(snapshot.albums.some(item => item.id === "album-1"), false)
  assert.equal(snapshot.photos.find(item => item.id === "photo-1").albumId, null)
})

test("shopping order deletion waits for explicit confirmation", async t => {
  const { draft, overlay } = await openEditor(t, "shopping", "shopping")
  overlay.querySelector("#shopTabOrder").click()
  overlay.querySelector('[data-more="order-1"]').click()
  document.querySelector("#spDelete").click()
  assert.ok(draft.snapshot().phoneData.shoppingItems.some(item => item.id === "order-1"))
  confirmButton().click()
  assert.equal(draft.snapshot().phoneData.shoppingItems.some(item => item.id === "order-1"), false)
})
