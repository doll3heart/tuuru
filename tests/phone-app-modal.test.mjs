import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("the phone app modal close button settles and removes its overlay", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "article-1",
    type: "article",
    phoneData: {
      contacts: [],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader" },
      apps: [],
    },
  })
  let beforeCalls = 0
  let afterCalls = 0

  const overlay = openPhoneAppModal(draft.id, "messages", {
    beforeClose() {
      beforeCalls += 1
      return { saved: true }
    },
    afterClose(result, reason) {
      afterCalls += 1
      assert.deepEqual(result, { saved: true })
      assert.equal(reason, "button")
    },
  })

  assert.equal(overlay.isConnected, true)
  const closeButton = overlay.querySelector(".phone-app-modal-inner > div:first-child button")
  assert.ok(closeButton)
  closeButton.click()

  assert.equal(overlay.isConnected, false)
  assert.equal(beforeCalls, 1)
  assert.equal(afterCalls, 1)
  draft.dispose()
  dom.window.close()
})

test("a phone app render failure removes its overlay before rethrowing", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "article-1",
    type: "article",
    phoneData: {
      contacts: [],
      chats: [null],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader" },
      apps: [],
    },
  })

  assert.throws(() => openPhoneAppModal(draft.id, "messages"))
  assert.equal(document.querySelectorAll(".phone-app-modal-overlay").length, 0)

  draft.dispose()
  dom.window.close()
})

test("backdrop close flushes the focused app field before draft snapshot", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "article-focused-field",
    type: "article",
    phoneData: {
      contacts: [{ id: "contact-1", name: "Old name" }],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader" },
      apps: [],
    },
  })
  let allowClose = false
  const snapshots = []

  const overlay = openPhoneAppModal(draft.id, "contacts", {
    beforeClose() {
      snapshots.push(draft.snapshot().phoneData.contacts[0].name)
      return allowClose ? { saved: true } : false
    },
  })
  const input = overlay.querySelector(".ct-name")
  assert.ok(input)
  input.focus()
  input.value = "New name"

  overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))

  assert.deepEqual(snapshots, ["New name"])
  assert.equal(draft.snapshot().phoneData.contacts[0].name, "New name")
  assert.equal(overlay.isConnected, true)

  allowClose = true
  overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))

  assert.deepEqual(snapshots, ["New name", "New name"])
  assert.equal(overlay.isConnected, false)
  draft.dispose()
  dom.window.close()
})
