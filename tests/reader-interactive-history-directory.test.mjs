import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { READER_LIBRARY_STORAGE_KEY } from "../reader/reader-library-state.js"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t) {
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
    KeyboardEvent:dom.window.KeyboardEvent,
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    Blob:dom.window.Blob,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  window.scrollTo = () => {}
  t.after(() => dom.window.close())
}

function seedWork() {
  const work = {
    schemaVersion:1,
    id:"interactive-history-work",
    type:"article",
    title:"雾港",
    author:"白榫",
    chapters:[
      {id:"chapter-a", name:"雨夜"},
      {id:"chapter-b", name:"清晨"},
    ],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        title:"岔路",
        content:"<p>已解锁正文写着：钟停在二十三点十七分。</p>",
        choices:[
          {id:"left", text:"走向灯塔", targetId:"lighthouse"},
          {id:"right", text:"留在车站", targetId:"locked"},
        ],
      },
      {
        id:"lighthouse",
        chapterId:"chapter-b",
        title:"灯塔",
        content:"<p>灯塔门口放着一封已经拆开的信。</p>",
        choices:[],
      },
      {
        id:"locked",
        chapterId:"chapter-b",
        title:"未解锁车站",
        content:"<p>另一条路线藏着剧透答案。</p>",
        choices:[],
      },
    ],
    scenes:[],
    placeholders:[],
    phoneModules:[],
    startNode:"start",
  }
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
  return work
}

function openManagerAfterChoosingRoute() {
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-choice-id="left"]').click()
  document.querySelector("[data-reader-home]").click()
  document.querySelector('.rd-tab[data-tab="library"]').click()
  document.querySelector("[data-reader-book-manage]").click()
  document.querySelector(".rd-reader-record summary").click()
}

test("reading record becomes a spoiler-safe interactive directory with read-only previews", async t => {
  installDom(t)
  const work = seedWork()
  await import(`../reader/reader.js?reader-interactive-history=${Date.now()}`)
  openManagerAfterChoosingRoute()

  const libraryBefore = localStorage.getItem(READER_LIBRARY_STORAGE_KEY)
  const entries = [...document.querySelectorAll("[data-reader-journey-entry]")]
  assert.equal(entries.length, 2)
  assert.match(entries[0].textContent, /雨夜/)
  assert.match(entries[0].textContent, /岔路/)
  assert.match(entries[0].textContent, /走向灯塔/)
  assert.match(entries[1].textContent, /灯塔/)
  assert.doesNotMatch(document.querySelector(".rd-reader-journey-directory").textContent, /未解锁车站|剧透答案|留在车站/)

  entries[0].focus()
  entries[0].click()
  const preview = document.querySelector(".rd-reader-search-preview")
  assert.ok(preview)
  assert.match(preview.textContent, /已解锁正文写着：钟停在二十三点十七分/)
  assert.match(preview.textContent, /仅供回看，不会改变当前路线/)
  assert.equal(localStorage.getItem(READER_LIBRARY_STORAGE_KEY), libraryBefore)

  preview.querySelector("[data-reader-search-preview-close]").click()
  assert.equal(document.querySelector(".rd-reader-search-preview"), null)
  assert.equal(document.activeElement, entries[0])
  assert.equal(localStorage.getItem(READER_LIBRARY_STORAGE_KEY), libraryBefore)
  assert.equal(JSON.parse(libraryBefore).books.find(book => book.id === work.id).progress.path.at(-1), "lighthouse")
})

test("interactive directory stays compact, responsive, and keyboard visible", () => {
  assert.match(readerCss, /\.rd-reader-journey-directory\s*\{[^}]*list-style:\s*none/)
  assert.match(readerCss, /\.rd-reader-journey-entry:focus-visible\s*\{[^}]*outline:/)
  assert.match(readerCss, /\.rd-reader-journey-entry\s*\{[^}]*min-height:\s*56px/)
  assert.match(readerCss, /\.rd-reader-search-preview\s*\{[^}]*z-index:\s*2500/)
  assert.match(
    readerCss,
    /@media \(max-width:\s*480px\)[\s\S]*?\.rd-reader-journey-entry\s*\{[^}]*grid-template-columns:\s*34px minmax\(0,1fr\)/,
  )
})
