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

function seedWork(work) {
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
}

function articleWork() {
  return {
    schemaVersion:1,
    id:"precise-article",
    type:"article",
    title:"After the Rain",
    author:"Tuuru",
    password:"",
    chapters:[{ id:"chapter-a", name:"Chapter One" }],
    nodes:[{
      id:"start",
      chapterId:"chapter-a",
      title:"By the Window",
      content:"<p>The rain stopped.</p><p>The letter stayed on the desk.</p><p>You kept reading.</p>",
      choices:[],
    }],
    scenes:[],
    placeholders:[],
    phoneModules:[],
    startNode:"start",
  }
}

function phoneWork() {
  return {
    schemaVersion:1,
    id:"precise-phone",
    type:"phone",
    title:"Night Phone",
    author:"Tuuru",
    password:"",
    placeholders:[],
    phoneData:{
      skin:{},
      apps:[{ type:"messages", name:"Messages", desktopX:0, desktopY:0 }],
      contacts:[{ id:"contact-a", name:"Aster" }],
      chats:[{
        id:"chat-a",
        type:"private",
        contactIds:["contact-a"],
        rounds:[{
          id:"round-a",
          messages:[
            { id:"message-1", senderId:"contact-a", type:"text", text:"Are you here?" },
            { id:"message-2", senderId:"self", type:"text", text:"Just arrived." },
            { id:"message-3", senderId:"contact-a", type:"text", text:"Waiting." },
          ],
        }],
      }],
      moments:[],
    },
  }
}

function openRecentAndStart() {
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

function copyReaderStorage() {
  return {
    library:localStorage.getItem(READER_LIBRARY_STORAGE_KEY),
    recent:localStorage.getItem("moirain_recent"),
  }
}

test("article resume persists an anchor-relative passage and restores it on reopen", async t => {
  installDom(t)
  const work = articleWork()
  seedWork(work)
  let scrollY = 500
  const scrollCalls = []
  Object.defineProperty(window, "scrollY", { configurable:true, get:() => scrollY })
  window.scrollTo = options => {
    scrollY = Number(options?.top || 0)
    scrollCalls.push(options)
  }
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function() {
    if (this.matches?.(".article-content > p")) {
      const paragraphs = [...this.parentElement.children]
      const documentTop = [640, 900, 1100][paragraphs.indexOf(this)] || 1100
      return { top:documentTop - scrollY, bottom:documentTop + 28 - scrollY, left:0, right:320, width:320, height:28 }
    }
    return originalRect.call(this)
  }

  await import(`../reader/reader.js?precise-article-save=${Date.now()}`)
  openRecentAndStart()
  window.dispatchEvent(new Event("pagehide"))

  const saved = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  assert.deepEqual(saved.books[0].progress.readingPosition, {
    kind:"article",
    pathIndex:0,
    anchorIndex:0,
    viewportTop:140,
    scrollY:500,
  })

  document.querySelector("[data-reader-home]").click()
  scrollY = 0
  document.querySelector(".rd-recent-item").click()
  assert.equal(document.querySelector(".rd-landing-modal"), null)
  assert.equal(scrollCalls.at(-1).top, 500)
})

test("phone resume reopens the saved chat and restores its message position", async t => {
  installDom(t)
  const work = phoneWork()
  seedWork(work)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function() {
    if (this.matches?.("#chatMsgArea")) {
      return { top:100, bottom:500, left:0, right:320, width:320, height:400 }
    }
    if (this.dataset?.messageId === "message-2") {
      const area = this.closest("#chatMsgArea")
      const top = 420 - Number(area?.scrollTop || 0)
      return { top, bottom:top + 44, left:0, right:320, width:320, height:44 }
    }
    return originalRect.call(this)
  }

  await import(`../reader/reader.js?precise-phone-save=${Date.now()}`)
  openRecentAndStart()
  document.querySelector('.phone-app-icon[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  const firstArea = document.getElementById("chatMsgArea")
  firstArea.scrollTop = 300
  window.dispatchEvent(new Event("pagehide"))
  const saved = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  assert.equal(saved.books[0].progress.readingPosition.appType, "messages")
  assert.equal(saved.books[0].progress.readingPosition.view, "chat")
  assert.equal(saved.books[0].progress.readingPosition.itemId, "chat-a")
  assert.equal(saved.books[0].progress.readingPosition.anchorId, "message-2")
  assert.equal(saved.books[0].progress.readingPosition.anchorOffset, 20)

  const persisted = copyReaderStorage()
  document.getElementById("chatBack").click()
  document.querySelector(".rd-back-btn").click()
  document.querySelector("[data-reader-home]").click()
  localStorage.setItem(READER_LIBRARY_STORAGE_KEY, persisted.library)
  localStorage.setItem("moirain_recent", persisted.recent)
  document.querySelector(".rd-recent-item").click()

  const restoredArea = document.getElementById("chatMsgArea")
  assert.ok(restoredArea)
  assert.equal(restoredArea.scrollTop, 300)
})
