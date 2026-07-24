import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { colorContrastRatio } from "../js/color-contrast.js"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function ruleBodiesFor(selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(readerCss))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

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
  return dom
}

function phoneWork() {
  const secondContactId = 'contact-b" data-forged="yes'
  const icon = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>'

  return {
    schemaVersion: 1,
    id: "reader-contact-context",
    type: "phone",
    title: "Contact context",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [
        { id: "contact-a", name: "Alice" },
        { id: secondContactId, name: "Bob <script>" },
      ],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [
        { id: "memo-a", contactId: "contact-a", content: "Alice memo" },
        { id: "memo-b", contactId: secondContactId, content: "Bob memo" },
      ],
      photos: [
        { id: "photo-a", contactId: "contact-a", albumId: null, caption: "Alice photo", imageUrl: "" },
        { id: "photo-b", contactId: secondContactId, albumId: null, caption: "Bob photo", imageUrl: "" },
      ],
      albums: [],
      browserHistory: [
        { id: "history-a", contactId: "contact-a", title: "Alice history", url: "https://a.invalid" },
        { id: "history-b", contactId: secondContactId, title: "Bob history", url: "https://b.invalid" },
      ],
      shoppingItems: [
        { id: "shop-a", contactId: "contact-a", status: "cart", name: "Alice item", price: 1 },
        { id: "shop-b", contactId: secondContactId, status: "cart", name: "Bob item", price: 2 },
      ],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [
        { id: "memo-app", type: "memo", name: "Memo", icon, desktopX: 0, desktopY: 0, enabled: true },
        { id: "gallery-app", type: "gallery", name: "Gallery", icon, desktopX: 1, desktopY: 0, enabled: true },
        { id: "browser-app", type: "browser", name: "Browser", icon, desktopX: 2, desktopY: 0, enabled: true },
        { id: "shopping-app", type: "shopping", name: "Shopping", icon, desktopX: 3, desktopY: 0, enabled: true },
      ],
    },
  }
}

function seedPhoneWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

function assertLegacyConnectionFlow(type, firstText, secondText) {
  const frame = document.querySelector(".phone-frame")
  const gate = frame.querySelector('.rd-connection-gate[data-connection-state="choose"]')
  assert.ok(gate)
  assert.doesNotMatch(gate.textContent, new RegExp(`${firstText}|${secondText}`))
  assert.equal(frame.querySelector(".rd-contact-select"), null)

  const sources = [...gate.querySelectorAll("[data-connection-source-index]")]
  assert.equal(sources.length, 2)
  assert.deepEqual(sources.map(source => source.dataset.connectionSourceIndex), ["0", "1"])
  assert.match(sources[1].textContent, /Bob <script>/)
  sources[1].click()
  assert.equal(sources[1].getAttribute("aria-pressed"), "true")
  assert.equal(sources[0].getAttribute("aria-pressed"), "false")
  assert.equal(document.querySelector("[data-forged]"), null)
  assert.equal(frame.querySelector("script"), null)

  gate.querySelector('[data-connection-action="confirm"]').click()

  const title = frame.querySelector(".rd-phone-app-header .cu-title")
  assert.match(title.textContent, new RegExp(`Bob <script> ·`))
  assert.doesNotMatch(frame.textContent, new RegExp(firstText))
  assert.match(frame.textContent, new RegExp(secondText))
  assert.equal(frame.querySelector(".rd-contact-source"), null)
  assert.equal(frame.querySelector(".rd-contact-select"), null)
  assert.equal(document.querySelector("[data-forged]"), null)
  assert.equal(frame.querySelector("script"), null)
}

test("legacy contact-scoped reader Apps use the access page instead of an in-App selector", async t => {
  installDom(t)
  const work = phoneWork()
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-contact-context=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  for (const [type, firstText, secondText] of [
    ["memo", "Alice memo", "Bob memo"],
    ["gallery", "Alice photo", "Bob photo"],
    ["browser", "Alice history", "Bob history"],
    ["shopping", "Alice item", "Bob item"],
  ]) {
    document.querySelector(`[data-app-type="${type}"]`).click()
    assertLegacyConnectionFlow(type, firstText, secondText)
    document.querySelector(".rd-back-btn").click()
    assert.ok(document.getElementById("phoneDesktopReader"))
  }
})

test("configured locked Apps require reader confirmation and keep the authored source visible", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-authored-character-access"
  work.phoneData.appConnections = Object.fromEntries(
    ["memo", "gallery", "browser", "shopping"].map(type => [type, {
      contactId: work.phoneData.contacts[1].id,
      prompt: `${type} 的剧情接入提示`,
    }]),
  )
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-authored-character-access=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  for (const [type, firstText, secondText] of [
    ["memo", "Alice memo", "Bob memo"],
    ["gallery", "Alice photo", "Bob photo"],
    ["browser", "Alice history", "Bob history"],
    ["shopping", "Alice item", "Bob item"],
  ]) {
    document.querySelector(`[data-app-type="${type}"]`).click()
    let frame = document.querySelector(".phone-frame")
    const gate = frame.querySelector(".rd-connection-gate")
    assert.ok(gate, `${type} should pause at the authored connection gate`)
    assert.match(gate.textContent, /Bob <script>的手机/)
    assert.match(gate.textContent, new RegExp(`${type} 的剧情接入提示`))
    assert.doesNotMatch(gate.textContent, new RegExp(secondText))
    assert.equal(frame.querySelector(".rd-contact-select"), null)
    assert.equal(frame.querySelector("script"), null)
    assert.equal(document.querySelector("[data-forged]"), null)

    const confirm = gate.querySelector('[data-connection-action="confirm"]')
    assert.ok(confirm)
    confirm.click()

    frame = document.querySelector(".phone-frame")
    assert.equal(frame.querySelector(".rd-connection-gate"), null)
    const title = frame.querySelector(".rd-phone-app-header .cu-title")
    assert.match(title.textContent, /Bob <script> ·/)
    assert.doesNotMatch(frame.textContent, new RegExp(firstText))
    assert.match(frame.textContent, new RegExp(secondText))
    assert.equal(frame.querySelector(".rd-contact-source"), null)
    assert.equal(frame.querySelector(".rd-contact-select"), null)

    frame.querySelector(".rd-back-btn").click()
    assert.ok(document.getElementById("phoneDesktopReader"))
  }
})

test("reader can decline a configured character connection without seeing its content", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-declines-character-access"
  work.phoneData.appConnections = {
    memo: { contactId: "contact-a", prompt: "先确认再查看。" },
  }
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-declines-character-access=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="memo"]').click()

  const gate = document.querySelector(".rd-connection-gate")
  assert.ok(gate)
  assert.doesNotMatch(gate.textContent, /Alice memo/)
  gate.querySelector('[data-connection-action="cancel"]').click()

  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(document.querySelector(".rd-connection-gate"), null)
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /Alice memo/)
})

test("a configured connection to a deleted character fails closed", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-missing-character-access"
  work.phoneData.appConnections = {
    memo: { contactId: "deleted-contact", prompt: "This source no longer exists." },
  }
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-missing-character-access=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="memo"]').click()

  const frame = document.querySelector(".phone-frame")
  const unavailable = frame.querySelector('.rd-connection-gate[data-connection-state="unavailable"]')
  assert.ok(unavailable)
  assert.equal(unavailable.querySelector('[data-connection-action="confirm"]'), null)
  assert.equal(frame.querySelector(".rd-contact-select"), null)
  assert.doesNotMatch(frame.textContent, /Alice memo|Bob memo/)

  unavailable.querySelector('[data-connection-action="cancel"]').click()
  assert.ok(document.getElementById("phoneDesktopReader"))
})

test("a configured connection with an ambiguous character id fails closed", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-ambiguous-character-access"
  work.phoneData.contacts[1].id = "contact-a"
  work.phoneData.appConnections = {
    memo: { contactId: "contact-a", prompt: "This source is ambiguous." },
  }
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-ambiguous-character-access=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="memo"]').click()

  const frame = document.querySelector(".phone-frame")
  assert.ok(frame.querySelector('.rd-connection-gate[data-connection-state="unavailable"]'))
  assert.equal(frame.querySelector(".rd-contact-select"), null)
  assert.doesNotMatch(frame.textContent, /Alice memo|Bob memo/)
})

test("contact-scoped reader Apps keep legacy content without contacts", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-contact-context-legacy"
  work.phoneData.contacts = []
  work.phoneData.memos = [{ id: "memo-legacy", content: "Legacy memo" }]
  work.phoneData.photos = [{ id: "photo-legacy", albumId: null, caption: "Legacy photo", imageUrl: "" }]
  work.phoneData.browserHistory = [{ id: "history-legacy", title: "Legacy history", url: "https://legacy.invalid" }]
  work.phoneData.shoppingItems = [{ id: "shop-legacy", status: "cart", name: "Legacy item", price: 3 }]
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-contact-context-legacy=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  for (const [type, content] of [
    ["memo", "Legacy memo"],
    ["gallery", "Legacy photo"],
    ["browser", "Legacy history"],
    ["shopping", "Legacy item"],
  ]) {
    document.querySelector(`[data-app-type="${type}"]`).click()
    const frame = document.querySelector(".phone-frame")
    assert.equal(frame.querySelector(".rd-contact-select"), null)
    assert.match(frame.textContent, new RegExp(content))
    frame.querySelector(".rd-back-btn").click()
  }
})

test("a single contact still confirms access before showing the App", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-contact-context-single"
  work.phoneData.contacts = work.phoneData.contacts.slice(0, 1)
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-contact-context-single=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  for (const [type, firstText, secondText] of [
    ["memo", "Alice memo", "Bob memo"],
    ["gallery", "Alice photo", "Bob photo"],
    ["browser", "Alice history", "Bob history"],
    ["shopping", "Alice item", "Bob item"],
  ]) {
    document.querySelector(`[data-app-type="${type}"]`).click()
    let frame = document.querySelector(".phone-frame")
    const gate = frame.querySelector('.rd-connection-gate[data-connection-state="choose"]')
    assert.ok(gate)
    assert.doesNotMatch(gate.textContent, new RegExp(firstText))
    gate.querySelector('[data-connection-action="confirm"]').click()
    frame = document.querySelector(".phone-frame")
    assert.equal(frame.querySelector(".rd-contact-select"), null)
    assert.match(frame.querySelector(".rd-phone-app-header .cu-title").textContent, /Alice ·/)
    assert.match(frame.textContent, new RegExp(firstText))
    assert.doesNotMatch(frame.textContent, new RegExp(secondText))
    frame.querySelector(".rd-back-btn").click()
  }
})

test("the reader access source picker remains usable on touch and keyboard", () => {
  const source = ruleBodiesFor(".rd-connection-source")
  const focus = ruleBodiesFor(".rd-connection-source:focus-visible")

  assert.match(source, /min-height\s*:\s*(?:44|[5-9]\d|[1-9]\d{2,})px/)
  assert.match(source, /font\s*:\s*inherit/)
  assert.match(focus, /outline\s*:\s*2px\s+solid/)
})

test("the reader connection gate has touch-safe actions, visible focus, and reduced-motion support", () => {
  const gate = ruleBodiesFor(".rd-connection-gate")
  const action = ruleBodiesFor(".rd-connection-action")
  const focus = ruleBodiesFor(".rd-connection-action:focus-visible")
  const source = ruleBodiesFor(".rd-contact-source")
  const primaryHover = ruleBodiesFor(".rd-connection-action.primary:hover")
  const primary = readerCss.match(/--phone-system-primary\s*:\s*(#[0-9a-f]{6})\s*;/i)?.[1]
  const primaryHoverColor = readerCss.match(/--phone-system-primary-hover\s*:\s*(#[0-9a-f]{6})\s*;/i)?.[1]
  const primaryInk = readerCss.match(/--phone-system-primary-ink\s*:\s*(#[0-9a-f]{6})\s*;/i)?.[1]

  assert.match(gate, /overflow-y\s*:\s*auto/)
  assert.match(action, /min-height\s*:\s*44px/)
  assert.match(action, /font\s*:\s*inherit/)
  assert.match(focus, /outline\s*:\s*2px\s+solid/)
  assert.match(source, /position\s*:\s*sticky/)
  assert.match(source, /top\s*:\s*0/)
  assert.ok(primary, "the default primary color should be an auditable hex value")
  assert.ok(primaryHoverColor, "the primary hover color should be explicit")
  assert.ok(primaryInk, "the primary ink color should be an auditable hex value")
  assert.ok(colorContrastRatio(primaryInk, primary) >= 4.5)
  assert.ok(colorContrastRatio(primaryInk, primaryHoverColor) >= 4.5)
  assert.match(primaryHover, /background\s*:\s*var\(--phone-system-primary-hover\)/)
  assert.match(readerCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.rd-connection-gate/)
})
