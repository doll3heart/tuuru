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

  await import(`../reader/reader.js?reader-home-navigation=${Date.now()}`)
  assert.ok(document.querySelector(".rd-home"))
  assert.equal(window.renderHome, undefined)
  assert.doesNotMatch(readerSource, /onclick=["']renderHome\(\)["']/)
  assert.match(readerSource, /data-reader-home/)

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
  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", {
    value: { files: [{ name: "work.json" }] },
  })
  document.dispatchEvent(drop)

  assert.equal(drop.defaultPrevented, true)
  assert.equal(reads, 1)
})
