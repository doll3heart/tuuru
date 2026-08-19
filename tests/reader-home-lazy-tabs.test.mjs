import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("reader home renders inactive tabs only when they are activated", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    FileReader: dom.window.FileReader,
    requestAnimationFrame: callback => { callback(); return 1 },
    alert: () => {},
  })
  t.after(() => dom.window.close())

  const work = {
    id: "lazy-tab-book",
    schemaVersion: 4,
    type: "article",
    title: "Cached book",
    password: "",
    placeholders: [],
    chapters: [],
    scenes: [],
    phoneModules: [],
    interactiveScenes: [],
    nodes: [{ id: "start", title: "Start", content: "<p>Cached</p>", choices: [], interactionGroups: [] }],
    startNode: "start",
  }
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_readerLibrary", JSON.stringify({
    version: 1,
    identities: [],
    books: [{
      id: work.id,
      type: work.type,
      title: work.title,
      author: "",
      coverColor: "",
      placeholderDefinitions: [],
      placeholderValues: {},
      progress: null,
      addedAt: 1,
      lastOpenedAt: 1,
    }],
  }))

  await import(`../reader/reader.js?reader-home-lazy-tabs=${Date.now()}`)

  const personal = document.querySelector("#tabPersonal")
  const library = document.querySelector("#tabLibrary")
  const custom = document.querySelector("#tabCustom")
  assert.ok(personal?.querySelector(".rd-personal"))
  assert.ok(library)
  assert.equal(library.childElementCount, 0)
  assert.equal(library.textContent, "")
  assert.ok(custom)
  assert.equal(custom.childElementCount, 0)
  assert.equal(custom.textContent, "")
  assert.doesNotMatch(document.body.textContent, /undefined/)
  assert.equal(document.querySelector('[data-tab="personal"]').getAttribute("aria-selected"), "true")
  assert.equal(library.hidden, true)
  assert.equal(custom.hidden, true)

  document.querySelector('[data-tab="library"]').click()
  assert.ok(document.querySelector("#tabLibrary .rd-bookshelf"))
  assert.equal(document.querySelector('[data-tab="library"]').getAttribute("aria-selected"), "true")
  assert.equal(library.hidden, false)

  document.querySelector('[data-tab="custom"]').click()
  assert.ok(document.querySelector("#tabCustom .rd-custom"))
  assert.equal(document.querySelector('[data-tab="custom"]').getAttribute("aria-selected"), "true")
  assert.equal(custom.hidden, false)
})
