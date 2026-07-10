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

  const overlay = openPhoneAppModal(draft.id, "contacts", {
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
  const closeButton = overlay.querySelector(".phone-app-modal-close")
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

test("every embedded app Back control settles the hosting modal", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const appCases = [
    ["messages", "#msgBack"],
    ["forum", "#forumBack"],
    ["memo", "#memoBack"],
    ["gallery", "#galleryBack"],
    ["browser", "#browserBack"],
    ["shopping", "#shopBack"],
  ]

  for (const [appType, backSelector] of appCases) {
    const draft = createPhoneWorkDraft({
      id: `article-${appType}-back`,
      type: "article",
      phoneData: {
        contacts: [{ id: "contact-1", name: "Contact" }],
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
    const closeEvents = []
    const overlay = openPhoneAppModal(draft.id, appType, {
      beforeClose(reason) {
        closeEvents.push(["before", reason])
        return { saved: true }
      },
      afterClose(_result, reason) {
        closeEvents.push(["after", reason])
      },
    })
    const back = overlay.querySelector(backSelector)
    assert.ok(back, `${appType} exposes its top-level Back control`)

    back.click()

    assert.equal(overlay.isConnected, false, `${appType} removes its hosting modal`)
    assert.deepEqual(closeEvents, [
      ["before", "app-back"],
      ["after", "app-back"],
    ], `${appType} enters the shared close lifecycle once`)
    draft.dispose()
  }

  dom.window.close()
})

test("an app Back veto keeps saved memo edits available for retry", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "article-memo-back-veto",
    type: "article",
    phoneData: {
      contacts: [{ id: "contact-1", name: "Contact" }],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [{ id: "memo-1", contactId: "contact-1", content: "Old memo" }],
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
  const afterReasons = []
  const overlay = openPhoneAppModal(draft.id, "memo", {
    beforeClose() {
      snapshots.push(draft.snapshot().phoneData.memos[0].content)
      return allowClose ? { saved: true } : false
    },
    afterClose(_result, reason) {
      afterReasons.push(reason)
    },
  })
  const editor = overlay.querySelector(".memo-editor")
  assert.ok(editor)
  editor.focus()
  editor.innerHTML = "New memo"

  overlay.querySelector("#memoBack").click()

  assert.deepEqual(snapshots, ["New memo"])
  assert.equal(overlay.isConnected, true)
  assert.ok(overlay.querySelector("#memoPanel"))
  assert.deepEqual(afterReasons, [])

  allowClose = true
  overlay.querySelector("#memoBack").click()

  assert.deepEqual(snapshots, ["New memo", "New memo"])
  assert.deepEqual(afterReasons, ["app-back"])
  assert.equal(overlay.isConnected, false)
  draft.dispose()
  dom.window.close()
})
