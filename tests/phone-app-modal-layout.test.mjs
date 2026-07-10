import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

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

function installVisualViewport(dom, initial = {}) {
  const listeners = {
    resize: new Set(),
    scroll: new Set(),
  }
  const viewport = {
    height: initial.height ?? 500,
    offsetTop: initial.offsetTop ?? 0,
    addEventListener(type, listener) {
      listeners[type]?.add(listener)
    },
    removeEventListener(type, listener) {
      listeners[type]?.delete(listener)
    },
    emit(type) {
      for (const listener of listeners[type] || []) listener()
    },
  }
  Object.defineProperty(dom.window, "visualViewport", {
    configurable: true,
    value: viewport,
  })
  return { viewport, listeners }
}

function makePhoneData(overrides = {}) {
  return {
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
    ...overrides,
  }
}

test("the phone App modal has a bounded single-scroll layout contract", () => {
  assert.match(cssWithoutComments, /--app-viewport-height\s*:\s*100vh/)
  assert.match(cssWithoutComments, /@supports\s*\(height\s*:\s*100dvh\)/)
  assert.match(cssWithoutComments, /--app-viewport-height\s*:\s*100dvh/)

  const overlay = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-overlay")
  const inner = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-inner")
  const header = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-header")
  const close = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-close")
  const content = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-content")
  const embeddedClose = ruleBodiesFor(cssWithoutComments, ".phone-app-modal-inner .cu-close-btn")

  assert.match(overlay, /height\s*:\s*var\(--phone-app-viewport-height\s*,\s*var\(--app-viewport-height\)\)/)
  assert.match(overlay, /top\s*:\s*var\(--phone-app-viewport-offset-top\s*,\s*0px\)/)
  assert.match(overlay, /overflow\s*:\s*hidden/)
  assert.match(overlay, /overscroll-behavior\s*:\s*contain/)
  assert.match(inner, /width\s*:\s*min\(360px\s*,\s*100%\)/)
  assert.match(inner, /height\s*:\s*min\(640px\s*,\s*100%\)/)
  assert.match(inner, /min-height\s*:\s*0/)
  assert.match(header, /display\s*:\s*grid/)
  assert.match(close, /width\s*:\s*44px/)
  assert.match(close, /height\s*:\s*44px/)
  assert.match(embeddedClose, /min-width\s*:\s*44px/)
  assert.match(embeddedClose, /min-height\s*:\s*44px/)
  assert.match(content, /min-height\s*:\s*0/)
  assert.match(content, /overflow\s*:\s*hidden/)
  assert.doesNotMatch(content, /overflow(?:-y)?\s*:\s*auto/)

  assert.match(phoneSource, /topBar\.className\s*=\s*['"]phone-app-modal-header['"]/)
  assert.match(phoneSource, /content\.className\s*=\s*['"]phone-app-modal-content['"]/)
  assert.match(phoneSource, /phone-app-modal-title/)
  assert.match(phoneSource, /phone-app-modal-close/)
  assert.doesNotMatch(phoneSource, /inner\.style\.cssText\s*=/)
  assert.doesNotMatch(phoneSource, /topBar\.style\.cssText\s*=/)
  assert.doesNotMatch(phoneSource, /content\.style\.cssText\s*=/)
  assert.doesNotMatch(phoneSource, /document\.body\.style\.(?:overflow|position)/)

  const mobileMatch = /@media\s*\(max-width\s*:\s*480px\)\s*\{([\s\S]*)\}\s*$/.exec(cssWithoutComments)
  assert.ok(mobileMatch, "missing the existing 480px mobile contract")
  const mobile = mobileMatch[1]
  assert.match(ruleBodiesFor(mobile, ".phone-app-modal-overlay"), /padding\s*:\s*0/)
  const mobileInner = ruleBodiesFor(mobile, ".phone-app-modal-inner")
  assert.match(mobileInner, /width\s*:\s*100%/)
  assert.match(mobileInner, /height\s*:\s*100%/)
  assert.match(mobileInner, /border-radius\s*:\s*0/)
})

test("each App modal exposes exactly one reachable header", async () => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "single-modal-header",
    type: "article",
    phoneData: makePhoneData(),
  })

  const messages = openPhoneAppModal(draft.id, "messages", {
    beforeClose() { return true },
  })
  assert.equal(messages.querySelector(".phone-app-modal-header"), null)
  assert.equal(messages.querySelectorAll("#msgBack").length, 1)
  messages.querySelector("#msgBack").click()
  assert.equal(messages.isConnected, false)

  const contacts = openPhoneAppModal(draft.id, "contacts")
  assert.equal(contacts.querySelectorAll(".phone-app-modal-header").length, 1)
  assert.equal(contacts.querySelectorAll(".phone-app-modal-close").length, 1)
  assert.equal(contacts.querySelector(".cu-panel-embedded"), null)
  contacts.querySelector(".phone-app-modal-close").click()
  assert.equal(contacts.isConnected, false)

  draft.dispose()
  dom.window.close()
})

test("Visual Viewport changes resize the modal and successful close cleans listeners", async () => {
  const dom = installDom()
  const { viewport, listeners } = installVisualViewport(dom, { height: 520, offsetTop: 12 })
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "visual-viewport-modal",
    type: "article",
    phoneData: makePhoneData(),
  })
  let allowClose = false
  const overlay = openPhoneAppModal(draft.id, "contacts", {
    beforeClose() { return allowClose },
  })

  assert.equal(overlay.style.getPropertyValue("--phone-app-viewport-height"), "520px")
  assert.equal(overlay.style.getPropertyValue("--phone-app-viewport-offset-top"), "12px")
  assert.equal(listeners.resize.size, 1)
  assert.equal(listeners.scroll.size, 1)

  viewport.height = 340
  viewport.offsetTop = 48
  viewport.emit("resize")
  assert.equal(overlay.style.getPropertyValue("--phone-app-viewport-height"), "340px")
  assert.equal(overlay.style.getPropertyValue("--phone-app-viewport-offset-top"), "48px")

  viewport.offsetTop = 64
  viewport.emit("scroll")
  assert.equal(overlay.style.getPropertyValue("--phone-app-viewport-offset-top"), "64px")

  overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  assert.equal(overlay.isConnected, true)
  assert.equal(listeners.resize.size, 1)
  assert.equal(listeners.scroll.size, 1)

  allowClose = true
  overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  assert.equal(overlay.isConnected, false)
  assert.equal(listeners.resize.size, 0)
  assert.equal(listeners.scroll.size, 0)
  draft.dispose()
  dom.window.close()
})

test("a render failure removes Visual Viewport listeners", async () => {
  const dom = installDom()
  const { listeners } = installVisualViewport(dom)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "visual-viewport-render-failure",
    type: "article",
    phoneData: makePhoneData({ chats: [null] }),
  })

  assert.throws(() => openPhoneAppModal(draft.id, "messages"))
  assert.equal(listeners.resize.size, 0)
  assert.equal(listeners.scroll.size, 0)
  draft.dispose()
  dom.window.close()
})
