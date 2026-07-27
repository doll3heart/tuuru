import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { READER_LIBRARY_STORAGE_KEY } from "../reader/reader-library-state.js"

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
  t.after(() => dom.window.close())
  return dom
}

function articleWork(overrides = {}) {
  return {
    schemaVersion:1,
    id:"progress-work",
    type:"article",
    title:"山茶书简",
    author:"白榆",
    coverColor:"#8f6672",
    password:"",
    chapters:[{ id:"chapter-a", name:"第一章" }],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        title:"开始",
        content:"<p>你好，name</p>",
        choices:[{ id:"stay", text:"留下", targetId:"ending" }],
      },
      {
        id:"ending",
        chapterId:"chapter-a",
        title:"结尾",
        content:"<p>你留了下来。</p>",
        choices:[],
      },
    ],
    scenes:[],
    placeholders:[{
      id:"name",
      key:"name",
      label:"姓名",
      prompt:"你的名字",
      default:"某某",
      forbiddenWords:[],
    }],
    phoneModules:[],
    startNode:"start",
    ...overrides,
  }
}

function seedWork(work) {
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
}

function openShelf() {
  document.querySelector('.rd-tab[data-tab="library"]').click()
}

test("reader resumes an article route and remembers every work placeholder", async t => {
  installDom(t)
  const work = articleWork()
  seedWork(work)
  await import(`../reader/reader.js?reader-progress=${Date.now()}`)

  openShelf()
  document.querySelector(".rd-book-cover").click()
  const placeholder = document.querySelector('[data-ph-id="name"]')
  assert.ok(placeholder)
  placeholder.value = "云枝"
  document.querySelector("#rdStartBtn").click()
  assert.match(document.querySelector(".article-reader").textContent, /你好，云枝/)

  document.querySelector('.article-choice-btn[data-choice-id="stay"]').click()
  assert.match(document.querySelector(".article-reader").textContent, /你留了下来/)
  document.querySelector("[data-reader-home]").click()

  openShelf()
  assert.match(document.querySelector(".rd-book-meta").textContent, /继续阅读/)
  document.querySelector(".rd-book-cover").click()
  assert.equal(document.querySelector(".rd-landing-modal"), null)
  assert.match(document.querySelector(".article-reader").textContent, /你好，云枝[\s\S]*你留了下来/)

  document.querySelector("[data-reader-home]").click()
  openShelf()
  document.querySelector("[data-reader-book-manage]").click()
  assert.equal(document.querySelector('[data-reader-book-placeholder="name"]').value, "云枝")
  document.querySelector('[data-reader-book-placeholder="name"]').value = "松月"
  document.querySelector("[data-reader-book-save]").click()
  assert.match(document.querySelector(".rd-book-manager-status").textContent, /已保存/)

  const library = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  assert.deepEqual(library.books[0].placeholderValues, { name:["松月"] })
  assert.equal(JSON.parse(localStorage.getItem(`moirain_work_${work.id}`)).readerPhValues, undefined)
})

test("reader can roll back to the latest saved choice point and restart", async t => {
  installDom(t)
  const work = articleWork({ id:"checkpoint-work", placeholders:[] })
  seedWork(work)
  await import(`../reader/reader.js?reader-checkpoint=${Date.now()}`)

  openShelf()
  document.querySelector(".rd-book-cover").click()
  document.querySelector("#rdStartBtn").click()
  document.querySelector('.article-choice-btn[data-choice-id="stay"]').click()
  document.querySelector("[data-reader-home]").click()

  openShelf()
  document.querySelector("[data-reader-book-manage]").click()
  const checkpoint = document.querySelector("[data-reader-book-checkpoint]")
  assert.ok(checkpoint)
  assert.match(checkpoint.textContent, /留下/)
  checkpoint.click()
  assert.equal(document.querySelectorAll(".article-node").length, 1)
  assert.equal(
    document.querySelector('.article-choice-btn[data-choice-id="stay"]').getAttribute("aria-pressed"),
    "false",
  )

  document.querySelector("[data-reader-home]").click()
  openShelf()
  document.querySelector("[data-reader-book-manage]").click()
  document.querySelector("[data-reader-book-restart]").click()
  assert.equal(document.querySelectorAll(".article-node").length, 1)
  assert.equal(
    document.querySelector('.article-choice-btn[data-choice-id="stay"]').getAttribute("aria-pressed"),
    "false",
  )
})

test("saved placeholders prefill password-protected works without persisting passwords", async t => {
  installDom(t)
  const work = articleWork({ id:"password-work", password:"secret" })
  seedWork(work)
  localStorage.setItem(READER_LIBRARY_STORAGE_KEY, JSON.stringify({
    version:1,
    books:[{
      id:work.id,
      type:"article",
      title:work.title,
      author:work.author,
      coverColor:work.coverColor,
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[{ id:"name", label:"姓名", prompt:"", default:"某某" }],
      placeholderValues:{ name:["旧雨"] },
      progress:null,
    }],
  }))
  await import(`../reader/reader.js?reader-password-progress=${Date.now()}`)

  openShelf()
  document.querySelector(".rd-book-cover").click()
  assert.ok(document.querySelector("#rdPwdInput"))
  assert.equal(document.querySelector('[data-ph-id="name"]').value, "旧雨")
  assert.doesNotMatch(localStorage.getItem(READER_LIBRARY_STORAGE_KEY), /secret/)
})
