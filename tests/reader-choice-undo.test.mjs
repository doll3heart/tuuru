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
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  window.scrollTo = () => {}
  t.after(() => dom.window.close())
  return dom
}

function seedArticleWork() {
  const work = {
    schemaVersion:1,
    id:"choice-undo-work",
    type:"article",
    title:"岔路",
    author:"白榆",
    chapters:[{id:"chapter-a", name:"第一章"}],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        title:"开始",
        content:"<p>你站在路口。</p>",
        choices:[{id:"go", text:"向前走", targetId:"middle"}],
      },
      {
        id:"middle",
        chapterId:"chapter-a",
        title:"中段",
        content:"<p>前方又出现了一扇门。</p>",
        choices:[{id:"open", text:"推开门", targetId:"ending"}],
      },
      {
        id:"ending",
        chapterId:"chapter-a",
        title:"结尾",
        content:"<p>门后是清晨。</p>",
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

function openArticle() {
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

function savedProgress(workId) {
  const library = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  return library.books.find(book => book.id === workId).progress
}

test("article choice undo restores the complete saved route and focus", async t => {
  installDom(t)
  const work = seedArticleWork()
  await import(`../reader/reader.js?reader-choice-undo=${Date.now()}`)
  openArticle()

  const firstChoice = document.querySelector('[data-choice-id="go"]')
  firstChoice.click()

  const undoBar = document.querySelector(".rd-article-choice-undo")
  assert.ok(undoBar)
  assert.match(undoBar.textContent, /已选择“向前走”/)
  assert.deepEqual(savedProgress(work.id).path, ["start", "middle"])
  assert.deepEqual(savedProgress(work.id).choiceMemory, {start:"go"})
  assert.equal(savedProgress(work.id).checkpoints.length, 1)

  undoBar.querySelector(".rd-article-choice-undo-action").click()

  const restoredChoice = document.querySelector('[data-choice-id="go"]')
  assert.equal(document.querySelector(".rd-article-choice-undo"), null)
  assert.equal(document.querySelectorAll(".article-node").length, 1)
  assert.equal(restoredChoice.getAttribute("aria-pressed"), "false")
  assert.equal(document.activeElement, restoredChoice)
  assert.deepEqual(savedProgress(work.id).path, ["start"])
  assert.deepEqual(savedProgress(work.id).choiceMemory, {})
  assert.deepEqual(savedProgress(work.id).interactionSelections, {})
  assert.deepEqual(savedProgress(work.id).checkpoints, [])
})

test("an article choice ignores repeated activation from the same rendered control", async t => {
  installDom(t)
  const work = seedArticleWork()
  await import(`../reader/reader.js?reader-choice-guard=${Date.now()}`)
  openArticle()

  const firstChoice = document.querySelector('[data-choice-id="go"]')
  firstChoice.click()
  firstChoice.click()

  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /门后是清晨/)
  assert.deepEqual(savedProgress(work.id).path, ["start", "middle"])
  assert.equal(firstChoice.dataset.choiceCommitLocked, "true")
  assert.equal(document.querySelectorAll(".rd-article-choice-undo").length, 1)
})

test("choice feedback stays compact, keyboard-visible, mobile-safe, and motion-safe", () => {
  assert.match(readerCss, /\.rd-article-choice-undo\s*\{[\s\S]*?max-width:\s*min\(420px,\s*calc\(100vw - 32px\)\)/)
  assert.match(readerCss, /\.rd-article-choice-undo-action:focus-visible\s*\{[\s\S]*?outline:/)
  assert.match(readerCss, /\.article-choice-btn\[data-choice-commit-locked="true"\]\s*\{[\s\S]*?pointer-events:\s*none/)
  assert.match(readerCss, /@media \(max-width:\s*480px\)[\s\S]*?\.rd-article-choice-undo\s*\{[\s\S]*?width:\s*calc\(100vw - 24px\)/)
  assert.match(readerCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*\.01ms !important/)
})
