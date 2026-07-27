import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

test("bookshelf has a deliberate responsive cover system and accessible alternatives to hold", () => {
  assert.match(readerSource, /data-tab="library">书架/)
  assert.match(readerSource, /createBookCoverHold/)
  assert.match(readerSource, /data-reader-book-manage/)
  assert.match(readerSource, /contextmenu/)
  assert.match(readerSource, /aria-label="' \+ escapeHtmlAttribute\('管理《/)

  assert.match(
    readerCss,
    /\.rd-bookshelf-grid\{[^}]*grid-template-columns:repeat\(auto-fill,minmax\(138px,1fr\)\)/,
  )
  assert.match(readerCss, /\.rd-book-cover\{[^}]*aspect-ratio:3\/4\.25[^}]*touch-action:pan-y/s)
  assert.match(readerCss, /--rd-book-cover-bg: #FFFFFF;/)
  assert.match(readerCss, /--rd-book-cover-ink: #171516;/)
  assert.match(readerCss, /\.rd-book-cover\{[^}]*background:var\(--rd-book-cover-bg\)[^}]*color:var\(--rd-book-cover-ink\)/s)
  assert.doesNotMatch(readerSource, /style="--rd-book-color:/)
  assert.match(readerCss, /\.rd-book-manage\{[^}]*width:44px[^}]*height:44px/s)
  assert.match(readerCss, /\.rd-book-manage::before\{[^}]*inset:8px[^}]*border-radius:3px/s)
  assert.match(
    readerCss,
    /@media \(max-width: 480px\)\s*\{[\s\S]*?\.rd-bookshelf-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  )
  assert.match(readerCss, /@media \(prefers-reduced-motion: reduce\)/)
})

test("an empty library teaches the import path without duplicating recents on profile", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
  })
  Object.assign(globalThis, {
    window:dom.window,
    document:dom.window.document,
    localStorage:dom.window.localStorage,
    sessionStorage:dom.window.sessionStorage,
    Element:dom.window.Element,
    HTMLElement:dom.window.HTMLElement,
    Node:dom.window.Node,
    Event:dom.window.Event,
    MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  t.after(() => dom.window.close())

  await import(`../reader/reader.js?reader-empty-bookshelf=${Date.now()}`)
  assert.equal(document.querySelector("#tabPersonal .rd-recent-item"), null)
  document.querySelector('[data-tab="library"]').click()

  const shelf = document.querySelector(".rd-bookshelf")
  assert.ok(shelf)
  assert.match(shelf.textContent, /书架还是空的/)
  const importButton = shelf.querySelector("[data-reader-open-import]")
  assert.ok(importButton)
  importButton.focus()
  importButton.click()
  assert.equal(document.querySelector('[data-tab="import"]'), null)
  const dialog = document.querySelector(".rd-import-dialog")
  assert.ok(dialog)
  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.equal(dialog.getAttribute("aria-modal"), "true")
  assert.ok(dialog.querySelector("#dropInner"))
  assert.equal(dialog.querySelector("[data-reader-import-status]").getAttribute("role"), "status")
  assert.ok(dialog.querySelector(".rd-import-review").hidden)
  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key:"Escape", bubbles:true }))
  assert.equal(document.querySelector(".rd-import-overlay"), null)
  assert.equal(document.activeElement, importButton)
})
