import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
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

function seedRecentWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

test("article gallery modules preserve album-only data in the reader overlay", async t => {
  installDom(t)
  const work = {
    schemaVersion: 1,
    id: "article-gallery-albums",
    type: "article",
    title: "Gallery article",
    author: "Author",
    nodes: [{
      id: "node-a",
      title: "Start",
      content: '<div class="pm-inline-card" data-pm-id="gallery-module" data-pm-type="gallery"><span>Gallery</span></div>',
      choices: [],
    }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [{
      id: "gallery-module",
      type: "gallery",
      nodeId: "node-a",
      data: {
        photos: [],
        albums: [{ id: "album-a", name: "Summer album" }],
      },
    }],
    startNode: "node-a",
  }
  seedRecentWork(work)

  await import(`../reader/reader.js?reader-gallery-albums=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector(".rd-pm-trigger").click()

  const galleryIcon = document.querySelector('[data-app-type="gallery"]')
  assert.ok(galleryIcon)
  assert.ok(galleryIcon.querySelector('[style*="#ef4444"]'))

  galleryIcon.click()
  const album = document.querySelector('.rd-album[data-album-id="album-a"]')
  assert.ok(album)
  assert.match(album.textContent, /Summer album/)
})
