import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t, url = "http://localhost/reader/") {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.KeyboardEvent = dom.window.KeyboardEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.Image = dom.window.Image
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function cssBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return readerCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? ""
}

function dispatchInput(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

test("reader beauty hub opens a reader-owned article appearance dialog", async t => {
  const dom = installDom(t)
  await import(`../reader/reader.js?reader-article-appearance-dialog=${Date.now()}`)

  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector('[data-reader-phone-control="reading"]')
  assert.ok(trigger)
  trigger.focus()
  trigger.click()

  const overlay = document.querySelector(".rs-overlay")
  const dialog = overlay.querySelector(".rs-sheet")
  const close = document.getElementById("rsClose")
  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.equal(dialog.getAttribute("aria-modal"), "true")
  assert.ok(document.getElementById(dialog.getAttribute("aria-labelledby")))
  assert.equal(document.activeElement, close)

  for (const id of [
    "rsFontSize",
    "rsLineH",
    "rsLetterS",
    "rsParaS",
    "rsMargin",
    "rsContentWidth",
    "rsBgColor",
    "rsTextColor",
    "rsBgUrl",
    "rsBgOverlay",
    "rsIndent",
  ]) assert.ok(document.getElementById(id), id)

  const fontSize = document.getElementById("rsFontSize")
  fontSize.value = "30"
  dispatchInput(fontSize)
  const background = document.getElementById("rsBgColor")
  background.value = "#123456"
  dispatchInput(background)
  const text = document.getElementById("rsTextColor")
  text.value = "#fefefe"
  dispatchInput(text)
  document.querySelector('[data-rs-align="justify"]').click()
  const indent = document.getElementById("rsIndent")
  indent.checked = true
  indent.dispatchEvent(new Event("change", { bubbles: true }))

  const stored = JSON.parse(localStorage.getItem("moirain_readerSettings"))
  assert.equal(stored.fontSize, 30)
  assert.equal(stored.theme, "custom")
  assert.equal(stored.backgroundColor, "#123456")
  assert.equal(stored.textColor, "#fefefe")
  assert.equal(stored.textAlign, "justify")
  assert.equal(stored.indentFirstLine, true)
  assert.equal(document.querySelector(".rs-preview-copy").style.fontSize, "30px")

  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  assert.equal(document.querySelector(".rs-overlay"), null)
  assert.equal(document.activeElement, trigger)
})

test("saved article appearance applies below content when a cached work opens", async t => {
  installDom(t)
  const work = {
    schemaVersion: 1,
    id: "appearance-work",
    type: "article",
    title: "Appearance",
    author: "Reader",
    nodes: [{ id: "start", title: "Start", content: "<p>Readable paragraph</p>", choices: [] }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    startNode: "start",
  }
  localStorage.setItem("moirain_recent", JSON.stringify([
    { id: work.id, title: work.title, type: work.type, importedAt: Date.now() },
  ]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_readerSettings", JSON.stringify({
    fontSize: 30,
    lineHeight: 2.2,
    letterSpacing: 1.5,
    paragraphSpacing: 24,
    marginSize: 34,
    contentWidth: 840,
    textAlign: "justify",
    indentFirstLine: true,
    theme: "custom",
    backgroundColor: "#123456",
    textColor: "#fefefe",
    backgroundImage: "/reader/backgrounds/night.png",
    backgroundFit: "contain",
    backgroundOverlay: 44,
  }))

  await import(`../reader/reader.js?reader-article-appearance-apply=${Date.now()}`)
  document.querySelector("[data-reader-recent-index]").click()
  document.getElementById("rdStartBtn").click()
  await new Promise(resolve => setTimeout(resolve, 20))

  const backdrop = document.querySelector(".article-reading-backdrop")
  const reader = document.querySelector(".article-reader")
  const content = document.querySelector(".article-content")
  const paragraph = content.querySelector("p")
  assert.ok(backdrop)
  assert.match(backdrop.style.backgroundImage, /night\.png/)
  assert.equal(backdrop.style.backgroundSize, "contain")
  assert.equal(reader.style.maxWidth, "840px")
  assert.equal(content.style.fontSize, "30px")
  assert.equal(content.style.lineHeight, "2.2")
  assert.equal(content.style.letterSpacing, "1.5px")
  assert.equal(content.style.padding, "0px 34px")
  assert.equal(content.style.textAlign, "justify")
  assert.equal(paragraph.style.marginBottom, "24px")
  assert.equal(paragraph.style.textIndent, "2em")
  assert.equal(reader.style.getPropertyValue("--rd-reading-text"), "#fefefe")

  document.querySelector(".reader-settings-btn").click()
  assert.ok(document.querySelector(".rs-sheet"))
})

test("article appearance controls are touch-safe and keyboard-visible", () => {
  for (const selector of [".rs-close-btn", ".rs-align-btn", ".rs-action-btn"]) {
    const rule = cssBody(selector)
    assert.match(rule, /min-height:\s*44px/, selector)
  }
  assert.match(cssBody(".rs-close-btn"), /min-width:\s*44px/)
  assert.match(readerCss, /\.rs-align-btn:focus-visible[^}]*outline:\s*2px solid var\(--c-primary-hover\)/s)
  assert.match(cssBody(".article-reading-backdrop"), /position:\s*fixed/)
  assert.match(cssBody(".article-reading-backdrop"), /pointer-events:\s*none/)
})
