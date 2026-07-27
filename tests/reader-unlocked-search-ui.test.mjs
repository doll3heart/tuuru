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
    KeyboardEvent:dom.window.KeyboardEvent,
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  window.scrollTo = () => {}
  t.after(() => dom.window.close())
}

function seedWork() {
  const work = {
    schemaVersion:1,
    id:"reader-search-ui-work",
    type:"article",
    title:"雾港",
    author:"白榆",
    chapters:[
      {id:"chapter-a", name:"雨夜"},
      {id:"chapter-b", name:"清晨"},
    ],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        title:"旧站",
        content:[
          "<p>name在停住的钟下等了一分钟。</p>",
          '<div class="pm-inline-card" data-pm-id="memo-open" data-pm-type="memo"></div>',
        ].join(""),
        choices:[{id:"go", text:"继续", targetId:"locked"}],
      },
      {
        id:"locked",
        chapterId:"chapter-b",
        title:"灯塔",
        content:"<p>尚未走到的灯塔藏着剧透答案。</p>",
        choices:[],
      },
    ],
    placeholders:[{
      id:"reader-name",
      key:"name",
      label:"姓名",
      prompt:"输入姓名",
      default:"某某",
      forbiddenWords:[],
    }],
    readerPhValues:{"reader-name":["阿雾"]},
    scenes:[],
    phoneModules:[{
      id:"memo-open",
      type:"memo",
      nodeId:"start",
      data:{memos:[{id:"memo-id", title:"票根", content:"背面写着不要回头。"}]},
    }],
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
  document.querySelector('[data-ph-id="reader-name"]').value = "阿雾"
  document.getElementById("rdStartBtn").click()
}

function savedProgress(workId) {
  const library = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  return structuredClone(library.books.find(book => book.id === workId).progress)
}

function typeSearch(value) {
  const input = document.querySelector("[data-reader-unlocked-search-input]")
  input.value = value
  input.dispatchEvent(new Event("input", {bubbles:true}))
  return input
}

test("reader search exposes unlocked substituted prose and owned memo text without spoilers", async t => {
  installDom(t)
  const work = seedWork()
  await import(`../reader/reader.js?reader-unlocked-search-ui=${Date.now()}`)
  openArticle()
  const progressBefore = savedProgress(work.id)

  const trigger = document.querySelector("[data-reader-search]")
  trigger.click()
  const input = typeSearch("阿雾")
  assert.equal(document.activeElement, input)
  assert.match(document.querySelector(".rd-reader-search-results").textContent, /雨夜 · 旧站/)

  typeSearch("不要回头")
  assert.match(document.querySelector(".rd-reader-search-results").textContent, /备忘录/)

  typeSearch("剧透答案")
  assert.match(document.querySelector(".rd-reader-search-status").textContent, /没有找到/)
  assert.equal(document.querySelector("[data-reader-search-result]"), null)
  assert.deepEqual(savedProgress(work.id), progressBefore)
})

test("search preview is read-only and returns focus to its result and trigger", async t => {
  installDom(t)
  const work = seedWork()
  await import(`../reader/reader.js?reader-unlocked-search-preview=${Date.now()}`)
  openArticle()
  const progressBefore = savedProgress(work.id)

  const trigger = document.querySelector("[data-reader-search]")
  trigger.focus()
  trigger.click()
  typeSearch("停住的钟")
  const result = document.querySelector("[data-reader-search-result]")
  result.click()

  const preview = document.querySelector(".rd-reader-search-preview")
  assert.ok(preview)
  assert.match(preview.textContent, /阿雾在停住的钟下等了一分钟/)
  assert.deepEqual(savedProgress(work.id), progressBefore)

  preview.querySelector("[data-reader-search-preview-close]").click()
  assert.equal(document.querySelector(".rd-reader-search-preview"), null)
  assert.equal(document.activeElement, result)

  document.querySelector("[data-reader-search-close]").click()
  assert.equal(document.querySelector(".rd-reader-search-panel"), null)
  assert.equal(document.activeElement, trigger)
  assert.deepEqual(savedProgress(work.id), progressBefore)
})
