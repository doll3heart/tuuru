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
  assert.match(readerCss, /\.rd-book-manage\{[^}]*font:700 \.6rem/s)
  assert.match(readerCss, /\.rd-book-manage::before\{[^}]*inset:12px[^}]*border-radius:3px/s)
  assert.match(readerCss, /\.rd-book-updated\{[^}]*pointer-events:none/s)
  assert.match(readerCss, /\.rd-book-title-row\{[^}]*display:flex/s)
  assert.match(readerCss, /\.rd-book-pinned\{[^}]*white-space:nowrap/s)
  assert.match(readerCss, /\.rd-book-pin-row\{[^}]*display:flex/s)
  assert.match(readerCss, /\.rd-book-pin-actions\{[^}]*display:flex/s)
  assert.match(readerCss, /\.rd-book-pin-row button\{[^}]*min-height:40px/s)
  assert.match(readerSource, /原位置已变动，已定位到附近内容/)
  assert.match(readerSource, /restoreReaderBookmark/)
  assert.match(readerSource, /restoreReaderBook/)
  assert.match(readerSource, /书签已删除/)
  assert.match(readerSource, /已从书架移除/)
  assert.match(readerSource, /actionLabel:'撤销'/)
  assert.match(readerCss, /\.rd-bookmark-update-note\{[^}]*color:var\(--c-accent3\)/)
  assert.match(
    readerCss,
    /@media \(max-width: 480px\)\s*\{[\s\S]*?\.rd-bookshelf-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  )
  assert.match(
    readerCss,
    /@media \(max-width: 480px\)\s*\{[\s\S]*?\.rd-book-manager \.rd-book-manager-close:focus-visible\{outline-offset:-7px\}/,
  )
  assert.match(readerCss, /@media \(prefers-reduced-motion: reduce\)/)
})

test("the bookshelf shows an update marker once and dismisses it on explicit open", async t => {
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
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  t.after(() => dom.window.close())

  const work = {
    id:"updated-book",
    schemaVersion:4,
    type:"article",
    title:"更新后的作品",
    password:"",
    placeholders:[],
    chapters:[],
    scenes:[],
    phoneModules:[],
    interactiveScenes:[],
    nodes:[{id:"start", title:"开始", content:"正文", choices:[], interactionGroups:[]}],
    startNode:"start",
  }
  localStorage.setItem("moirain_work_updated-book", JSON.stringify(work))
  localStorage.setItem("moirain_readerLibrary", JSON.stringify({
    version:1,
    identities:[],
    books:[{
      id:work.id,
      type:"article",
      title:work.title,
      author:"",
      coverColor:"",
      addedAt:1,
      lastOpenedAt:2,
      unseenUpdateAt:3,
      placeholderDefinitions:[],
      placeholderValues:{},
      progress:null,
    }],
  }))

  await import(`../reader/reader.js?reader-updated-badge=${Date.now()}`)
  document.querySelector('[data-tab="library"]').click()

  const marker = document.querySelector(".rd-book-updated")
  assert.ok(marker)
  assert.equal(marker.textContent, "已更新")
  assert.equal(marker.getAttribute("aria-hidden"), "true")

  document.querySelector(".rd-book-cover").click()

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.equal(saved.books[0].unseenUpdateAt, undefined)
})

test("multiple pinned books stay first across shelf sorts and can be toggled in book management", async t => {
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

  const workFor = (id, title) => ({
    id,
    schemaVersion:4,
    type:"article",
    title,
    author:"作者",
    password:"",
    placeholders:[],
    chapters:[],
    scenes:[],
    phoneModules:[],
    interactiveScenes:[],
    nodes:[{id:"start", title:"开始", content:"正文", choices:[], interactionGroups:[]}],
    startNode:"start",
  })
  const books = [
    { id:"ordinary-a", title:"AAA 普通作品", addedAt:900, lastOpenedAt:900, progress:{kind:"article", path:["start"], choiceMemory:{}, interactionSelections:{}, checkpoints:[]} },
    { id:"pinned-old", title:"YYY 较早置顶", addedAt:1, lastOpenedAt:1, pinnedAt:200, completedAt:10 },
    { id:"ordinary-b", title:"BBB 普通作品", addedAt:800, lastOpenedAt:800 },
    { id:"pinned-new", title:"ZZZ 最近置顶", addedAt:2, lastOpenedAt:2, pinnedAt:300, completedAt:10 },
    { id:"ordinary-c", title:"CCC 普通作品", addedAt:700, lastOpenedAt:700 },
    { id:"ordinary-d", title:"DDD 普通作品", addedAt:600, lastOpenedAt:600 },
    { id:"ordinary-e", title:"EEE 普通作品", addedAt:500, lastOpenedAt:500 },
  ].map(book => ({
    type:"article",
    author:"作者",
    coverColor:"",
    placeholderDefinitions:[],
    placeholderValues:{},
    progress:null,
    addedAt:1,
    lastOpenedAt:1,
    ...book,
  }))
  books.forEach(book => {
    localStorage.setItem(`moirain_work_${book.id}`, JSON.stringify(workFor(book.id, book.title)))
  })
  localStorage.setItem("moirain_readerLibrary", JSON.stringify({
    version:1,
    identities:[],
    books,
  }))
  localStorage.setItem("moirain_collections", JSON.stringify([{
    id:"collection-pinned",
    title:"置顶排序作品集",
    accessMode:"separate",
    workIds:["ordinary-a", "pinned-old", "pinned-new"],
  }]))

  await import(`../reader/reader.js?reader-pinned-books=${Date.now()}`)
  document.querySelector('[data-tab="library"]').click()

  const renderedTitles = () => Array.from(document.querySelectorAll(".rd-book-title-row strong"))
    .map(element => element.textContent)
  const expectedPinned = ["ZZZ 最近置顶", "YYY 较早置顶"]
  assert.deepEqual(renderedTitles().slice(0, 2), expectedPinned)
  assert.equal(document.querySelectorAll(".rd-book-pinned").length, 2)
  assert.match(document.querySelector(".rd-book-cover").getAttribute("aria-label"), /^已置顶，/)

  const sort = document.querySelector("[data-reader-shelf-sort]")
  for (const value of ["title", "added", "status", "recent"]) {
    sort.value = value
    sort.dispatchEvent(new dom.window.Event("change", {bubbles:true}))
    assert.deepEqual(renderedTitles().slice(0, 2), expectedPinned)
  }

  document.querySelector('[data-reader-book-manage="0"]').click()
  const pinButton = document.querySelector("[data-reader-book-pin]")
  assert.equal(pinButton.textContent, "取消置顶")
  assert.equal(pinButton.getAttribute("aria-pressed"), "true")

  pinButton.click()
  let saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.equal(saved.books.find(book => book.id === "pinned-new").pinnedAt, undefined)
  assert.equal(pinButton.textContent, "置顶")
  assert.equal(pinButton.getAttribute("aria-pressed"), "false")
  assert.equal(document.querySelector(".rd-book-title-row strong").textContent, "YYY 较早置顶")
  assert.equal(document.querySelectorAll(".rd-book-pinned").length, 1)
  assert.equal(document.querySelector(".rd-book-manager-global-status").textContent, "已取消置顶。")

  pinButton.click()
  saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.equal(saved.books.find(book => book.id === "pinned-new").pinnedAt > 0, true)
  assert.equal(pinButton.textContent, "取消置顶")
  assert.equal(pinButton.getAttribute("aria-pressed"), "true")
  assert.equal(document.querySelector(".rd-book-title-row strong").textContent, "ZZZ 最近置顶")
  assert.equal(document.querySelectorAll(".rd-book-pinned").length, 2)
  assert.equal(document.querySelector(".rd-book-manager-global-status").textContent, "已置顶到书架顶部。")

  document.querySelector(".rd-book-manager-close").click()
  assert.equal(document.querySelector(".rd-book-manager-overlay"), null)
  assert.equal(document.activeElement?.dataset?.readerBookManageId, "pinned-new")

  document.querySelector('[data-reader-collection-index="0"]').click()
  assert.deepEqual(
    Array.from(document.querySelectorAll("[data-reader-collection-work]"))
      .map(button => button.dataset.readerCollectionWork),
    ["pinned-new", "pinned-old", "ordinary-a"],
  )
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
