import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

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
  t.after(() => dom.window.close())
  return dom
}

function seedArticleWork() {
  const work = {
    schemaVersion:1,
    id:"reading-continuity-work",
    type:"article",
    title:"雨夜来信",
    author:"白榆",
    chapters:[{id:"chapter-a", name:"第一章"}],
    nodes:[{
      id:"start",
      chapterId:"chapter-a",
      title:"开始",
      content:[
        '<p>窗外的雨落了一整夜。</p>',
        '<p>你把信纸慢慢翻到下一页。</p>',
        '<div class="pm-inline-card" data-pm-id="memo-module" data-pm-type="memo"><span>Memo</span></div>',
        '<div class="interactive-scene-card" data-is-id="window-scene"><span>Window</span></div>',
      ].join(""),
      choices:[],
    }],
    scenes:[],
    placeholders:[],
    phoneModules:[{
      id:"memo-module",
      type:"memo",
      nodeId:"start",
      data:{memos:[{id:"memo-a", title:"纸条", content:"记得回信"}]},
    }],
    interactiveScenes:[{
      id:"window-scene",
      title:"靠近窗边",
      startStageId:"stage-a",
      stages:[{
        id:"stage-a",
        image:"https://example.test/window.jpg",
        dialogue:{speaker:"", text:"雨声更近了。"},
        hotspots:[],
      }],
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
}

function openArticle() {
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

function mockReadingLayout() {
  let scrollY = 480
  const scrollCalls = []
  Object.defineProperty(window, "scrollY", {
    configurable:true,
    get:() => scrollY,
  })
  window.scrollTo = options => {
    scrollY = Number(options?.top || 0)
    scrollCalls.push(options)
  }
  let anchorTop = 120
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function() {
    if (this.matches?.(".article-node .article-content > p:first-child")) {
      return {
        top:anchorTop,
        bottom:anchorTop + 28,
        left:0,
        right:320,
        width:320,
        height:28,
      }
    }
    if (this.closest?.(".article-node")) {
      return {
        top:520,
        bottom:560,
        left:0,
        right:320,
        width:320,
        height:40,
      }
    }
    return originalRect.call(this)
  }
  return {
    scrollCalls,
    setAnchorTop:value => { anchorTop = value },
    setScrollY:value => { scrollY = value },
  }
}

test("article settings and phone modules return to the same visible passage", async t => {
  installDom(t)
  seedArticleWork()
  await import(`../reader/reader.js?reader-reading-continuity=${Date.now()}`)
  openArticle()

  const layout = mockReadingLayout()
  const settingsTrigger = document.querySelector(".reader-settings-btn")
  settingsTrigger.focus()
  settingsTrigger.click()
  layout.setAnchorTop(184)
  document.getElementById("rsClose").click()

  assert.equal(layout.scrollCalls.at(-1).top, 544)
  assert.equal(document.activeElement, settingsTrigger)

  layout.setScrollY(620)
  layout.setAnchorTop(76)
  const phoneTrigger = document.querySelector(".rd-pm-trigger")
  phoneTrigger.focus()
  phoneTrigger.click()
  assert.ok(document.querySelector(".rd-pm-modal"))
  assert.equal(document.querySelector(".rd-pm-back").hidden, true)
  layout.setAnchorTop(103)
  document.querySelector(".rd-pm-back").click()

  assert.equal(document.querySelector(".rd-pm-modal"), null)
  assert.equal(layout.scrollCalls.at(-1).top, 647)
  assert.equal(document.activeElement, phoneTrigger)

  layout.setScrollY(700)
  layout.setAnchorTop(90)
  const sceneTrigger = document.querySelector("[data-reader-enter-interactive-scene]")
  sceneTrigger.focus()
  sceneTrigger.click()
  assert.ok(document.querySelector(".rd-interactive-scene-page"))
  layout.setAnchorTop(130)
  document.querySelector(".rd-interactive-scene-exit").click()

  const restoredSceneTrigger = document.querySelector("[data-reader-enter-interactive-scene]")
  assert.equal(layout.scrollCalls.at(-1).top, 740)
  assert.equal(document.activeElement, restoredSceneTrigger)
})
