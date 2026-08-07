import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
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
}

function inlinePlaceholderWork() {
  return {
    schemaVersion:4,
    id:"reader-inline-placeholder",
    type:"article",
    title:"Inline placeholder",
    author:"Author",
    placeholders:[{
      id:"cat-name",
      key:"123",
      label:"小猫的名字",
      prompt:"你想叫它什么？",
      fillMode:"inline",
      forbidden:["坏名字"],
      values:[],
      default:"",
      mode:"each",
    }],
    globalForbidden:[],
    scenes:[],
    interactiveScenes:[],
    phoneModules:[],
    chapters:[{id:"chapter-a", name:"第一章"}],
    startNode:"start",
    nodes:[
      {
        id:"start",
        title:"开始",
        chapterId:"chapter-a",
        content:[
          "<p>这是你见到的一只小猫，你为它取名叫做",
          '<span class="article-placeholder-anchor" data-article-placeholder="cat-name" contenteditable="false"></span>',
          "。</p><p>123今天又不肯吃饭。</p>",
        ].join(""),
        interactionGroups:[],
        choices:[],
      },
      {
        id:"later",
        title:"后续",
        chapterId:"chapter-a",
        content:"<p>你抱起123。</p>",
        interactionGroups:[],
        choices:[],
      },
    ],
  }
}

async function openWork(work, key) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id, title:work.title, type:work.type, importedAt:Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
}

test("an inline placeholder skips the landing form and gates all following prose until saved", async t => {
  installDom(t)
  await openWork(inlinePlaceholderWork(), "inline-placeholder-gate")

  assert.equal(document.querySelector('[data-ph-id="cat-name"]'), null)
  document.getElementById("rdStartBtn").click()
  const field = document.querySelector('[data-inline-placeholder-id="cat-name"]')
  assert.ok(field)
  assert.match(document.body.textContent, /这是你见到的一只小猫/)
  assert.doesNotMatch(document.body.textContent, /今天又不肯吃饭|你抱起/)

  document.querySelector("[data-reader-search]").click()
  const search = document.querySelector("[data-reader-unlocked-search-input]")
  search.value = "今天又不肯吃饭"
  search.dispatchEvent(new Event("input", {bubbles:true}))
  assert.equal(document.querySelector("[data-reader-search-result]"), null)
  document.querySelector("[data-reader-search-close]").click()

  field.querySelector("input").value = "坏名字"
  field.querySelector("button").click()
  assert.match(field.querySelector(".rd-placeholder-error").textContent, /违禁词/)
  assert.doesNotMatch(document.body.textContent, /今天又不肯吃饭|你抱起/)

  field.querySelector("input").value = "小咪"
  field.querySelector("button").click()

  assert.equal(document.querySelector('[data-inline-placeholder-id="cat-name"]'), null)
  assert.match(document.body.textContent, /小咪今天又不肯吃饭/)
  assert.match(document.body.textContent, /你抱起小咪/)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /123/)

  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.deepEqual(library.books[0].placeholderValues, {"cat-name":["小咪"]})
})

test("landing and inline placeholders save together without erasing either value", async t => {
  installDom(t)
  const work = inlinePlaceholderWork()
  work.id = "reader-mixed-placeholders"
  work.placeholders.unshift({
    id:"reader-name", key:"NAME", label:"读者名字", prompt:"你的名字？",
    fillMode:"landing", forbidden:[], values:[], default:"", mode:"each",
  })
  work.nodes[0].content = work.nodes[0].content.replace("这是你", "NAME，这是你")
  await openWork(work, "mixed-placeholder-values")

  const landingInput = document.querySelector('[data-ph-id="reader-name"]')
  assert.ok(landingInput)
  assert.equal(document.querySelector('[data-ph-id="cat-name"]'), null)
  landingInput.value = "阿雾"
  document.getElementById("rdStartBtn").click()

  const field = document.querySelector('[data-inline-placeholder-id="cat-name"]')
  field.querySelector("input").value = "小咪"
  field.querySelector("button").click()

  assert.match(document.body.textContent, /阿雾，这是你/)
  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.deepEqual(library.books[0].placeholderValues, {
    "reader-name":["阿雾"],
    "cat-name":["小咪"],
  })
})
