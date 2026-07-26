import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

const demoUrl = new URL("../prototypes/reader-ui-demo/index.html", import.meta.url)
const scriptUrl = new URL("../prototypes/reader-ui-demo/demo.js", import.meta.url)
const styleUrl = new URL("../prototypes/reader-ui-demo/demo.css", import.meta.url)
const authorStyleUrl = new URL("../css/styles.css", import.meta.url)

async function loadDemo() {
  const [html, script] = await Promise.all([
    readFile(demoUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ])
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://127.0.0.1:8765/prototypes/reader-ui-demo/index.html",
  })
  dom.window.eval(script)
  dom.window.SharedReaderDemo.init()
  return dom
}

test("demo imports the real author stylesheet and reuses author component classes", async () => {
  const dom = await loadDemo()
  const document = dom.window.document

  assert.ok(document.querySelector('link[href="../../css/styles.css"]'))
  assert.ok(document.querySelector(".editor-content .content-editable"))
  assert.ok(document.querySelector(".phone-editor-wrap .phone-frame .phone-profile"))
  assert.ok(document.querySelector(".phone-frame .phone-desktop .phone-app-icon"))
  assert.ok(document.querySelector(".forum-comment .forum-replies .forum-reply-item"))
  assert.ok(document.querySelector(".message-chat-card"))
  assert.ok(document.querySelector(".chat-author-shell"))
  assert.ok(document.querySelector(".moment-card"))
  assert.ok(document.querySelector(".ct-list"))
  assert.ok(document.querySelector(".memo-card"))
  assert.ok(document.querySelector(".gallery-grid"))
  assert.ok(document.querySelector(".browser-row"))
  assert.ok(document.querySelector(".shop-card-block"))
})

test("author and reader states switch the same component tree instead of separate copies", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const demo = document.querySelector("[data-shared-demo]")
  const content = document.querySelector(".content-editable")
  const phone = document.querySelector(".phone-frame")

  assert.equal(demo.dataset.mode, "reader")
  assert.equal(content.getAttribute("contenteditable"), "false")
  assert.equal(document.querySelectorAll(".phone-frame").length, 1)

  document.querySelector('[data-set-mode="author"]').click()
  assert.equal(demo.dataset.mode, "author")
  assert.equal(content.getAttribute("contenteditable"), "true")
  assert.equal(document.querySelector(".phone-frame"), phone)

  document.querySelector('[data-set-mode="reader"]').click()
  assert.equal(document.querySelector(".phone-frame"), phone)
})

test("reader mode removes author controls while preserving reader interactions", async () => {
  const dom = await loadDemo()
  const document = dom.window.document

  assert.ok(document.querySelector("[data-author-only]"))
  assert.ok(document.querySelector("[data-reader-only]"))

  document.querySelector('[data-view-target="phone"]').click()
  assert.equal(document.querySelector("[data-shared-demo]").dataset.view, "phone")
  document.querySelector('[data-app-type="forum"]').click()
  assert.equal(document.querySelector("[data-shared-demo]").dataset.view, "forum")

  const like = document.querySelector("[data-reader-like]")
  assert.equal(like.getAttribute("aria-pressed"), "false")
  like.click()
  assert.equal(like.getAttribute("aria-pressed"), "true")
  assert.match(like.textContent, /13/)
})

test("all phone apps route inside one shared phone frame", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const demo = document.querySelector("[data-shared-demo]")
  const phone = document.querySelector(".phone-frame")
  const expectedPanels = [
    "phone",
    "access",
    "messages",
    "chat",
    "forum",
    "contacts",
    "memo",
    "gallery",
    "browser",
    "shopping",
  ]

  assert.deepEqual(
    Array.from(document.querySelectorAll("[data-phone-panel]"), (panel) => panel.dataset.phonePanel),
    expectedPanels,
  )

  assert.equal(document.querySelector('[data-app-type="moments"]'), null)

  for (const app of ["messages", "forum", "contacts"]) {
    document.querySelector(`[data-app-type="${app}"]`).click()
    assert.equal(demo.dataset.view, app)
    assert.equal(document.querySelector(".phone-frame"), phone)
    assert.equal(document.querySelectorAll(".phone-frame").length, 1)
    document.querySelector("[data-phone-back]").click()
  }

  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector("[data-open-chat]").click()
  assert.equal(demo.dataset.view, "chat")
  assert.equal(document.querySelector(".phone-frame"), phone)
})

test("character-scoped apps keep the author access page and reader confirmation gate", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const demo = document.querySelector("[data-shared-demo]")
  const phone = document.querySelector(".phone-frame")
  const scopedApps = ["memo", "gallery", "browser", "shopping"]

  document.querySelector('[data-view-target="phone"]').click()
  for (const app of scopedApps) {
    document.querySelector(`[data-app-type="${app}"]`).click()
    assert.equal(demo.dataset.view, "access")
    assert.equal(demo.dataset.pendingApp, app)
    assert.equal(document.querySelector('[data-phone-panel="access"]').classList.contains("is-active"), true)
    assert.equal(document.querySelector(".phone-frame"), phone)
    document.querySelector("[data-connection-confirm]").click()
    assert.equal(demo.dataset.view, app)
    document.querySelector("[data-phone-back]").click()
  }

  document.querySelector('[data-set-mode="author"]').click()
  document.querySelector('[data-app-type="browser"]').click()
  assert.equal(demo.dataset.view, "access")
  assert.match(document.querySelector("[data-access-title]").textContent, /浏览记录 · 接入设置/)

  document.querySelector('[data-access-contact="林晚"]').click()
  document.querySelector("[data-access-prompt]").value = "从林晚的设备接入。"
  document.querySelector("[data-access-continue]").click()
  assert.equal(demo.dataset.view, "browser")
  assert.match(document.querySelector('[data-phone-panel="browser"] .cu-title').textContent, /林晚 · 浏览记录/)

  document.querySelector("[data-phone-back]").click()
  document.querySelector('[data-set-mode="reader"]').click()
  document.querySelector('[data-app-type="browser"]').click()
  assert.equal(demo.dataset.view, "access")
  assert.match(document.querySelector("[data-connection-device-name]").textContent, /林晚的手机/)
  assert.equal(document.querySelector("[data-connection-prompt]").textContent, "从林晚的设备接入。")
})

test("reader app interactions remain local to the shared components", async () => {
  const dom = await loadDemo()
  const document = dom.window.document

  document.querySelector('[data-app-type="contacts"]').click()
  const search = document.querySelector("[data-reader-contact-search]")
  search.value = "林晚"
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  assert.equal(document.querySelector('[data-reader-contact="顾逢川"]').hidden, true)
  assert.equal(document.querySelector('[data-reader-contact="林晚"]').hidden, false)
  assert.equal(document.querySelector("[data-reader-contact-count]").textContent, "1 人")

  document.querySelector('[data-view-target="phone"]').click()
  document.querySelector('[data-app-type="shopping"]').click()
  document.querySelector("[data-connection-confirm]").click()
  const cart = document.querySelector("[data-shop-toggle]")
  cart.click()
  assert.equal(cart.getAttribute("aria-checked"), "true")

  document.querySelector("[data-phone-back]").click()
  document.querySelector('[data-app-type="gallery"]').click()
  document.querySelector("[data-connection-confirm]").click()
  const photo = document.querySelector("[data-reader-photo]")
  photo.click()
  assert.equal(photo.getAttribute("aria-pressed"), "true")
})

test("forum reply remains inside an existing root comment", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const root = document.querySelector('.forum-comment[data-forum-comment-id="comment-gu"]')
  const reply = root.querySelector('.forum-replies .forum-reply-item[data-parent-id="comment-gu"]')

  assert.ok(root)
  assert.ok(reply)
  assert.equal(reply.querySelector(".forum-reply-target").textContent.trim(), "顾逢川")
})

test("messages keep the author editor structure while reader-only residue is removed", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const panel = document.querySelector('[data-phone-panel="messages"]')
  const body = panel.querySelector(".message-list-body")
  const tabs = panel.querySelector(".shop-tabs")
  const firstCard = panel.querySelector(".message-chat-card")
  const pinned = firstCard.querySelector(".message-chat-pinned-label")
  const css = await readFile(styleUrl, "utf8")

  assert.ok(body.compareDocumentPosition(tabs) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
  assert.equal(firstCard.matches("[data-open-chat]"), true)
  assert.ok(pinned.closest(".forum-list-title"))
  assert.equal(pinned.closest(".forum-list-title-row"), null)
  assert.match(css, /\[data-mode="reader"\]\s+\.message-chat-card::after\s*\{[^}]*display:\s*none/s)
})

test("message tabs stay inside Messages and contacts reuse the shared records with message identities", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const demo = document.querySelector("[data-shared-demo]")

  document.querySelector('[data-app-type="messages"]').click()
  const contactsTab = document.querySelector('[data-message-tab="contacts"]')
  contactsTab.click()

  assert.equal(demo.dataset.view, "messages")
  assert.equal(contactsTab.getAttribute("aria-selected"), "true")
  assert.equal(document.querySelector('[data-message-section="contacts"]').hidden, false)

  const messageContacts = Array.from(document.querySelectorAll("[data-message-contact]"))
  const addressBookContacts = Array.from(document.querySelectorAll("[data-reader-contact]"))
  assert.deepEqual(
    messageContacts.map((contact) => contact.dataset.contactId),
    addressBookContacts.map((contact) => contact.dataset.contactId),
  )

  const messageContact = messageContacts.find((contact) => contact.dataset.contactId === "gu")
  const addressBookContact = addressBookContacts.find((contact) => contact.dataset.contactId === "gu")
  assert.equal(messageContact.querySelector("[data-contact-display-name]").textContent, "Aster")
  assert.equal(addressBookContact.querySelector(".ct-name").value, "顾逢川")

  document.querySelector('[data-set-mode="author"]').click()
  const contactName = addressBookContact.querySelector(".ct-name")
  contactName.value = "顾川"
  contactName.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  assert.match(
    document.querySelector('[data-message-contact][data-contact-id="gu"] .forum-npc-meta').textContent,
    /顾川/,
  )

  document.querySelector('[data-message-tab="moments"]').click()
  assert.equal(demo.dataset.view, "messages")
  assert.equal(document.querySelector('[data-message-section="moments"]').hidden, false)
})

test("bottom message navigation has no full-width divider or selected top stripe", async () => {
  const css = await readFile(styleUrl, "utf8")

  assert.doesNotMatch(css, /\.messages-tabs\s*\{[^}]*border-top\s*:/s)
  assert.doesNotMatch(css, /\.messages-tabs\s+\.shop-tab\.active\s*\{[^}]*border-top-color\s*:/s)
  assert.match(css, /\.messages-tabs\s*\{[^}]*padding\s*:/s)
})

test("reader chat removes author chrome and keeps the bottom composer", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const panel = document.querySelector('[data-phone-panel="chat"]')
  const shell = panel.querySelector(".chat-author-shell")
  const messageArea = shell.querySelector("[data-chat-log]")
  const composer = shell.querySelector("[data-reader-chat-composer]")

  assert.ok(shell.querySelector(".chat-author-status[data-author-only]"))
  assert.ok(shell.querySelector(".chat-round-header[data-author-only]"))
  assert.ok(composer)
  assert.ok(composer.hasAttribute("data-reader-only"))
  assert.ok(messageArea.compareDocumentPosition(composer) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
  assert.ok(composer.querySelector("input"))
})

test("browser copies the author editor row without duplicate reader fields or forced overflow", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const panel = document.querySelector('[data-phone-panel="browser"]')
  const rows = panel.querySelectorAll(".browser-row")
  const search = panel.querySelector(".browser-search-bar")
  const css = await readFile(styleUrl, "utf8")

  assert.equal(search.tagName, "DIV")
  assert.equal(panel.querySelectorAll(".browser-time").length, rows.length)
  assert.equal(panel.querySelectorAll(".browser-time[data-reader-only]").length, 0)
  assert.doesNotMatch(css, /\.browser-search-bar\s*\{[^}]*width:\s*100%/s)
})

test("the demo follows the production four-by-four phone grid", async () => {
  const dom = await loadDemo()
  const document = dom.window.document
  const css = await readFile(authorStyleUrl, "utf8")
  const desktop = document.querySelector('[data-phone-panel="phone"] .phone-desktop')
  const icons = Array.from(desktop.querySelectorAll(".phone-app-icon"))

  assert.match(
    css,
    /\.phone-desktop\s*\{[^}]*--phone-grid-origin-x:\s*20px/s,
  )
  assert.match(
    desktop.style.getPropertyValue("--phone-grid-origin-x"),
    /clamp\(0px,\s*max\(calc\(50% - 156px\),\s*calc\(100% - 330px\)\),\s*20px\)/,
  )
  assert.deepEqual(
    icons.map((icon) => icon.dataset.appType),
    ["messages", "forum", "contacts", "memo", "gallery", "browser", "shopping"],
  )
  assert.deepEqual(
    icons.map((icon) => icon.style.getPropertyValue("--phone-grid-x")),
    ["0px", "80px", "160px", "240px", "0px", "80px", "160px"],
  )
  assert.deepEqual(
    icons.map((icon) => icon.style.getPropertyValue("--phone-grid-y")),
    ["36px", "36px", "36px", "36px", "131px", "131px", "131px"],
  )
})
