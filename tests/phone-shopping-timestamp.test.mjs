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
  return {
    contacts: [{ id: "contact-1", name: "裴亦惜", avatarUrl: "" }],
    chats: [],
    moments: [],
    forumPosts: [],
    forumNpcs: [],
    memos: [],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [{
      id: "order-1",
      contactId: "contact-1",
      name: "情趣内衣",
      price: 20.98,
      actualPay: 20.98,
      status: "order",
      checked: false,
      logistics: "已发货",
      time: "2026/6/26 23:13:25",
    }],
    appConnections: {
      shopping: { contactId: "contact-1", prompt: "" },
    },
    skin: { readerId: "Reader" },
    apps: [{ id: "shopping-app", type: "shopping", name: "购物", enabled: true }],
  }
}

test("shopping orders let authors edit or clear the displayed time", async t => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "shopping-order-time",
    type: "article",
    phoneData: makePhoneData(),
  })
  t.after(() => {
    draft.dispose()
    dom.window.close()
  })

  const overlay = openPhoneAppModal(draft.id, "shopping")
  overlay.querySelector("#characterAccessContinue").click()
  overlay.querySelectorAll(".shop-tab")[1].click()

  const card = overlay.querySelector('[data-item-id="order-1"]')
  card.dispatchEvent(new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
  document.querySelector("#spEdit").click()

  const editor = document.querySelector("#spSave").closest(".modal-overlay")
  assert.equal(editor.querySelector("#spTime").value, "2026/6/26 23:13:25")
  editor.querySelector("#spTime").value = ""
  editor.querySelector("#spSave").click()

  assert.equal(draft.snapshot().phoneData.shoppingItems[0].time, "")
})
