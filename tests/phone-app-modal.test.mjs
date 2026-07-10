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
  assert.equal(document.activeElement, overlay.querySelector(".phone-app-modal-close"))

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
  assert.equal(document.activeElement, overlay.querySelector("#memoBack"))
  assert.deepEqual(afterReasons, [])

  allowClose = true
  overlay.querySelector("#memoBack").click()

  assert.deepEqual(snapshots, ["New memo", "New memo"])
  assert.deepEqual(afterReasons, ["app-back"])
  assert.equal(overlay.isConnected, false)
  draft.dispose()
  dom.window.close()
})

test("phone App dialogs label themselves and restore focus after close", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id=launcher>Open</button><div id=app></div></body></html>", {
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
    id: "dialog-semantics",
    type: "article",
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader" }, apps: [],
    },
  })
  const launcher = document.getElementById("launcher")
  launcher.focus()

  const contacts = openPhoneAppModal(draft.id, "contacts")
  const contactsDialog = contacts.querySelector(".phone-app-modal-inner")
  const outerClose = contacts.querySelector(".phone-app-modal-close")
  assert.equal(contactsDialog.getAttribute("role"), "dialog")
  assert.ok(contactsDialog.getAttribute("aria-label"))
  assert.equal(contactsDialog.hasAttribute("aria-modal"), false)
  assert.equal(outerClose.type, "button")
  assert.ok(outerClose.getAttribute("aria-label"))
  assert.equal(document.activeElement, outerClose)

  outerClose.click()
  assert.equal(document.activeElement, launcher)

  const messages = openPhoneAppModal(draft.id, "messages")
  const messagesDialog = messages.querySelector(".phone-app-modal-inner")
  const appBack = messages.querySelector("#msgBack")
  assert.equal(messagesDialog.getAttribute("role"), "dialog")
  assert.equal(messagesDialog.hasAttribute("aria-modal"), false)
  assert.equal(appBack.type, "button")
  assert.ok(appBack.getAttribute("aria-label"))
  assert.equal(document.activeElement, appBack)

  appBack.click()
  assert.equal(document.activeElement, launcher)
  draft.dispose()
  dom.window.close()
})

test("Escape closes only the topmost phone modal", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id=launcher>Open</button><div id=app></div></body></html>", {
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
    id: "dialog-stack",
    type: "article",
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader" }, apps: [],
    },
  })
  const launcher = document.getElementById("launcher")
  launcher.focus()
  const closeReasons = []
  let allowSecondClose = false
  const first = openPhoneAppModal(draft.id, "contacts", {
    afterClose(_result, reason) { closeReasons.push(["first", reason]) },
  })
  const firstClose = first.querySelector(".phone-app-modal-close")
  const second = openPhoneAppModal(draft.id, "profile", {
    beforeClose() { return allowSecondClose },
    afterClose(_result, reason) { closeReasons.push(["second", reason]) },
  })
  const secondClose = second.querySelector(".phone-app-modal-close")

  const nested = document.createElement("div")
  nested.className = "modal-overlay"
  nested.innerHTML = '<button type="button">Nested</button>'
  document.body.appendChild(nested)
  nested.querySelector("button").focus()

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }))
  assert.equal(first.isConnected, true)
  assert.equal(second.isConnected, true)
  assert.deepEqual(closeReasons, [])

  nested.remove()
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }))
  assert.equal(second.isConnected, true)
  assert.deepEqual(closeReasons, [])
  assert.equal(document.activeElement, secondClose)

  allowSecondClose = true
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }))
  assert.equal(second.isConnected, false)
  assert.equal(first.isConnected, true)
  assert.deepEqual(closeReasons, [["second", "escape"]])
  assert.equal(document.activeElement, firstClose)

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }))
  assert.equal(first.isConnected, false)
  assert.deepEqual(closeReasons, [["second", "escape"], ["first", "escape"]])
  assert.equal(document.activeElement, launcher)

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }))
  assert.deepEqual(closeReasons, [["second", "escape"], ["first", "escape"]])
  draft.dispose()
  dom.window.close()
})

test("a render failure removes the phone modal keyboard listener", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id=launcher>Open</button><div id=app></div></body></html>", {
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

  const keydownListeners = new Set()
  let keydownAdds = 0
  let keydownRemoves = 0
  const addEventListener = document.addEventListener.bind(document)
  const removeEventListener = document.removeEventListener.bind(document)
  document.addEventListener = function(type, listener, options) {
    if (type === "keydown") {
      keydownAdds += 1
      keydownListeners.add(listener)
    }
    return addEventListener(type, listener, options)
  }
  document.removeEventListener = function(type, listener, options) {
    if (type === "keydown") {
      keydownRemoves += 1
      keydownListeners.delete(listener)
    }
    return removeEventListener(type, listener, options)
  }

  const launcher = document.getElementById("launcher")
  launcher.focus()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "dialog-render-failure",
    type: "article",
    phoneData: {
      contacts: [], chats: [null], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader" }, apps: [],
    },
  })

  assert.throws(() => openPhoneAppModal(draft.id, "messages"))
  assert.equal(keydownAdds, 1)
  assert.equal(keydownRemoves, 1)
  assert.equal(keydownListeners.size, 0)
  assert.equal(document.activeElement, launcher)
  draft.dispose()
  dom.window.close()
})

test("a close error keeps the dialog focused and retryable", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id=launcher>Open</button><div id=app></div></body></html>", {
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
    id: "dialog-close-error",
    type: "article",
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader" }, apps: [],
    },
  })
  let shouldThrow = true
  const reported = []
  const originalError = console.error
  console.error = (...args) => { reported.push(args) }

  try {
    const overlay = openPhoneAppModal(draft.id, "contacts", {
      beforeClose() {
        if (shouldThrow) throw new Error("save failed")
        return true
      },
    })
    const closeButton = overlay.querySelector(".phone-app-modal-close")

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true,
    }))
    assert.equal(overlay.isConnected, true)
    assert.equal(document.activeElement, closeButton)
    assert.equal(reported.length, 1)
    assert.match(String(reported[0][0]), /Failed to close phone App modal/)

    shouldThrow = false
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true,
    }))
    assert.equal(overlay.isConnected, false)
  } finally {
    console.error = originalError
    draft.dispose()
    dom.window.close()
  }
})

test("focus restoration falls back to the underlying modal", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id=launcher>Open</button><div id=app></div></body></html>", {
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
    id: "dialog-focus-fallback",
    type: "article",
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader" }, apps: [],
    },
  })
  const launcher = document.getElementById("launcher")
  launcher.focus()
  const underlying = openPhoneAppModal(draft.id, "contacts")
  const replacedLauncher = underlying.querySelector(".phone-app-modal-close")
  const top = openPhoneAppModal(draft.id, "profile")

  replacedLauncher.remove()
  top.querySelector(".phone-app-modal-close").click()

  assert.equal(top.isConnected, false)
  assert.equal(underlying.isConnected, true)
  assert.notEqual(document.activeElement, document.body)
  assert.equal(underlying.contains(document.activeElement), true)

  underlying.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  assert.equal(underlying.isConnected, false)
  assert.equal(document.activeElement, launcher)
  draft.dispose()
  dom.window.close()
})
