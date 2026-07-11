import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

test("reader home controls navigate without relying on module globals", async t => {
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
  t.after(() => dom.window.close())

  const baseWork = title => ({
    schemaVersion: 1,
    type: "article",
    title,
    nodes: [{ id: "node-a", title: "Start", content: "<p>Safe</p>", choices: [] }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    startNode: "node-a",
  })
  const hostileId = `recent');window.__readerInjected=true;//`
  const cachedWorks = [
    { ...baseWork("Hostile ID, safe content"), id: hostileId },
    { ...baseWork("Null ID"), id: null },
    baseWork("Missing ID"),
    { ...baseWork("Control character ID"), id: "nul\u0000line\rbreak" },
  ]
  const recents = cachedWorks.map(work => {
    const recent = { title: work.title, type: work.type, importedAt: Date.now() }
    if (Object.hasOwn(work, "id")) recent.id = work.id
    localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
    return recent
  })
  localStorage.setItem("moirain_recent", JSON.stringify(recents))

  await import(`../reader/reader.js?reader-home-navigation=${Date.now()}`)
  assert.ok(document.querySelector(".rd-home"))
  assert.equal(window.renderHome, undefined)
  assert.doesNotMatch(readerSource, /onclick=["']renderHome\(\)["']/)
  assert.match(readerSource, /data-reader-home/)
  assert.doesNotMatch(readerSource, /onclick=["']reimportRecent\(/)
  assert.doesNotMatch(readerSource, /data-reader-recent-id/)
  assert.match(readerSource, /data-reader-recent-index/)

  const recentButtons = [...document.querySelectorAll(".rd-recent-item")]
  assert.equal(recentButtons.length, cachedWorks.length)
  for (const [index, recent] of recentButtons.entries()) {
    assert.equal(recent.tagName, "BUTTON")
    assert.equal(recent.type, "button")
    assert.equal(recent.getAttribute("onclick"), null)
    assert.equal(recent.dataset.readerRecentIndex, String(index))
    recent.click()
    assert.equal(window.__readerInjected, undefined)
    assert.equal(document.querySelector(".rd-landing-title").textContent, cachedWorks[index].title)
    document.querySelector(".modal-overlay").remove()
  }

  document.getElementById("app").innerHTML = `
    <div class="drop-zone">
      <button type="button" class="drop-btn" data-reader-home>返回首页</button>
    </div>`
  document.querySelector("[data-reader-home]").click()

  assert.ok(document.querySelector(".rd-home"))
  assert.ok(document.querySelector("#tabImport"))

  for (let index = 0; index < 2; index += 1) {
    document.getElementById("app").innerHTML = `
      <button type="button" data-reader-home>再次返回</button>`
    document.querySelector("[data-reader-home]").click()
  }

  let reads = 0
  globalThis.FileReader = class {
    readAsText() { reads += 1 }
    readAsDataURL() { reads += 1 }
  }
  const outsideDrop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(outsideDrop, "dataTransfer", {
    value: { files: [{ name: "work.json" }] },
  })
  document.dispatchEvent(outsideDrop)

  assert.equal(outsideDrop.defaultPrevented, false)
  assert.equal(reads, 0)

  document.querySelector('.rd-tab[data-tab="import"]').click()
  assert.equal(document.getElementById("tabImport").style.display, "block")
  const importDrop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(importDrop, "dataTransfer", {
    value: { files: [{ name: "work.json" }] },
  })
  document.getElementById("dropInner").dispatchEvent(importDrop)

  assert.equal(importDrop.defaultPrevented, true)
  assert.equal(reads, 1)
})
