import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

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
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  window.scrollTo = () => {}
  t.after(() => dom.window.close())
  return dom
}

function seedWork() {
  const work = {
    schemaVersion:1,
    id:"immersive-toolbar-work",
    type:"article",
    title:"夜航",
    author:"白榆",
    chapters:[{id:"chapter-a", name:"第一章"}],
    nodes:[{
      id:"start",
      chapterId:"chapter-a",
      title:"甲板",
      content:"<p>海面没有灯。</p>",
      choices:[{id:"wait", mode:"interaction", text:"等一会儿", selectedText:"风停了。"}],
    }],
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
}

function openArticle() {
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

test("article controls live in one toolbar that prose taps hide and reveal", async t => {
  installDom(t)
  seedWork()
  await import(`../reader/reader.js?reader-immersive-toolbar=${Date.now()}`)
  openArticle()

  const toolbar = document.querySelector("[data-reader-immersive-toolbar]")
  const reveal = document.querySelector("[data-reader-immersive-reveal]")
  assert.ok(toolbar)
  assert.equal(toolbar.getAttribute("aria-hidden"), "false")
  assert.equal(reveal.hidden, true)
  assert.equal(toolbar.querySelectorAll(".reader-back").length, 1)
  assert.equal(toolbar.querySelectorAll("[data-reader-search]").length, 1)
  assert.equal(toolbar.querySelectorAll("[data-reader-bookmark-current]").length, 1)
  assert.equal(toolbar.querySelectorAll(".reader-settings-btn").length, 1)

  document.querySelector(".article-content p").click()
  assert.equal(toolbar.getAttribute("aria-hidden"), "true")
  assert.equal(reveal.hidden, false)
  assert.equal(toolbar.querySelector("[data-reader-search]").tabIndex, -1)

  reveal.click()
  assert.equal(toolbar.getAttribute("aria-hidden"), "false")
  assert.equal(reveal.hidden, true)
  assert.equal(toolbar.querySelector(".reader-back").tabIndex, 0)
})

test("interactive controls do not toggle the toolbar and keyboard search opens it", async t => {
  const dom = installDom(t)
  seedWork()
  await import(`../reader/reader.js?reader-immersive-keyboard=${Date.now()}`)
  openArticle()

  const toolbar = document.querySelector("[data-reader-immersive-toolbar]")
  document.querySelector(".article-choice-btn").click()
  assert.equal(toolbar.isConnected, false, "the choice render replaces the old toolbar")
  const currentToolbar = document.querySelector("[data-reader-immersive-toolbar]")
  assert.equal(currentToolbar.getAttribute("aria-hidden"), "false")

  document.querySelector(".article-content p").click()
  assert.equal(currentToolbar.getAttribute("aria-hidden"), "true")
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"f",
    ctrlKey:true,
    bubbles:true,
  }))

  assert.ok(document.querySelector(".rd-reader-search-panel"))
  assert.equal(currentToolbar.getAttribute("aria-hidden"), "false")
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {key:"Escape", bubbles:true}))
  assert.equal(document.querySelector(".rd-reader-search-panel"), null)
})

test("immersive controls are safe-area aware, responsive, focus-visible, and motion-safe", () => {
  assert.match(readerCss, /\.reader-immersive-toolbar\s*\{[\s\S]*?--reader-safe-bottom/)
  assert.match(readerCss, /\.reader-immersive-toolbar \.(?:reader-back|reader-settings-btn)[\s\S]*?position:\s*static/)
  assert.match(readerCss, /\.reader-immersive-toolbar[^}]*transition:[^}]*\.18s/)
  assert.match(readerCss, /\.reader-immersive-toolbar button:focus-visible\s*\{[\s\S]*?outline:/)
  assert.match(readerCss, /@media \(max-width:\s*600px\)[\s\S]*?\.reader-immersive-toolbar\s*\{[\s\S]*?width:\s*calc\(100vw - 24px\)/)
  assert.match(readerCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*\.01ms !important/)
})
