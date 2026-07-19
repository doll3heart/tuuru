import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t, previewId) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: `http://localhost/reader/index.html?preview=${encodeURIComponent(previewId)}`,
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
  return dom
}

function previewArticleWork() {
  return {
    schemaVersion: 1,
    id: "author-preview-article",
    type: "article",
    title: "Author preview article",
    author: "Author",
    nodes: [{
      id: "node-a",
      title: "Start",
      content: '<p>Before signal.</p><div class="pm-inline-card" data-pm-id="memo-module" data-pm-type="memo"><span>Memo</span><button data-a="pm-hamburger">Edit</button></div><p>After signal.</p>',
      choices: [],
      scene: "",
      chapterId: "",
    }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [{
      id: "memo-module",
      type: "memo",
      nodeId: "node-a",
      data: {
        contacts: [
          { id: "contact-a", name: "Alice" },
          { id: "contact-b", name: "Bob" },
        ],
        chats: [],
        forumPosts: [],
        memos: [
          { id: "memo-a", contactId: "contact-a", content: "Alice private memo" },
          { id: "memo-b", contactId: "contact-b", content: "Bob private memo" },
        ],
        photos: [],
        albums: [],
        browserHistory: [],
        shoppingItems: [],
        appConnections: {
          memo: { contactId: "contact-b", prompt: "Signal from Bob. Confirm before connecting." },
        },
      },
    }],
    startNode: "node-a",
  }
}

function seedAuthorDatabase(works) {
  localStorage.setItem("tuuru_works", JSON.stringify({ works, contacts: [], groups: [] }))
}

test("author preview uses the real reader connection flow without author controls or reader cache writes", async t => {
  installDom(t, "author-preview-article")
  const work = previewArticleWork()
  seedAuthorDatabase([work])
  localStorage.setItem("moirain_recent", JSON.stringify([{ id: "older-reader-work" }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify({ sentinel: true }))

  const databaseBefore = localStorage.getItem("tuuru_works")
  const recentBefore = localStorage.getItem("moirain_recent")
  const cacheBefore = localStorage.getItem(`moirain_work_${work.id}`)

  await import(`../reader/reader.js?author-preview=${Date.now()}-${Math.random()}`)

  assert.ok(document.querySelector(".rd-landing"))
  assert.match(document.querySelector(".rd-landing").textContent, /Author preview article/)
  document.getElementById("rdStartBtn").click()

  assert.equal(document.querySelector(".pm-inline-card"), null)
  assert.equal(document.querySelector('[data-a="pm-hamburger"]'), null)
  const trigger = document.querySelector(".rd-pm-trigger")
  assert.ok(trigger)
  trigger.click()

  const gate = document.querySelector(".rd-connection-gate")
  assert.ok(gate)
  assert.equal(document.querySelector('.phone-app-icon'), null)
  assert.match(gate.textContent, /Bob/)
  assert.match(gate.textContent, /Signal from Bob\. Confirm before connecting\./)
  assert.doesNotMatch(gate.textContent, /Bob private memo/)

  gate.querySelector('[data-connection-action="confirm"]').click()
  const frame = document.querySelector(".phone-frame")
  assert.match(frame.textContent, /Bob private memo/)
  assert.doesNotMatch(frame.textContent, /Alice private memo/)

  assert.equal(localStorage.getItem("tuuru_works"), databaseBefore)
  assert.equal(localStorage.getItem("moirain_recent"), recentBefore)
  assert.equal(localStorage.getItem(`moirain_work_${work.id}`), cacheBefore)
})

test("a missing author preview work fails closed without showing another local work", async t => {
  installDom(t, "missing-work")
  const otherWork = previewArticleWork()
  otherWork.id = "other-work"
  otherWork.title = "Do not reveal this work"
  seedAuthorDatabase([otherWork])
  const databaseBefore = localStorage.getItem("tuuru_works")

  await import(`../reader/reader.js?missing-author-preview=${Date.now()}-${Math.random()}`)

  const error = document.querySelector(".rd-preview-error")
  assert.ok(error)
  assert.doesNotMatch(error.textContent, /Do not reveal this work/)
  assert.equal(document.querySelector(".rd-landing"), null)
  assert.equal(localStorage.getItem("tuuru_works"), databaseBefore)
})

test("duplicate author preview ids fail closed without choosing either work", async t => {
  installDom(t, "author-preview-article")
  const firstWork = previewArticleWork()
  firstWork.title = "First duplicate must stay hidden"
  const secondWork = previewArticleWork()
  secondWork.title = "Second duplicate must stay hidden"
  seedAuthorDatabase([firstWork, secondWork])

  await import(`../reader/reader.js?duplicate-author-preview=${Date.now()}-${Math.random()}`)

  const error = document.querySelector(".rd-preview-error")
  assert.ok(error)
  assert.doesNotMatch(error.textContent, /First duplicate|Second duplicate/)
  assert.equal(document.querySelector(".rd-landing"), null)
})

test("a corrupt author database shows a bounded preview error", async t => {
  installDom(t, "author-preview-article")
  localStorage.setItem("tuuru_works", "{not-json")

  await import(`../reader/reader.js?corrupt-author-preview=${Date.now()}-${Math.random()}`)

  assert.ok(document.querySelector(".rd-preview-error"))
  assert.equal(document.querySelector(".rd-landing"), null)
  assert.equal(localStorage.getItem("tuuru_works"), "{not-json")
})
