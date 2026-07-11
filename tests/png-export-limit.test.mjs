import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { MAX_STEGANO_PAYLOAD_BYTES } from "../js/stegano.js"

test("an oversized PNG export restores its button and reports the limit", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  const alerts = []
  globalThis.alert = message => alerts.push(String(message))
  localStorage.setItem("tuuru_works", JSON.stringify({
    works: [{ id: "large-work", schemaVersion: 1, type: "article", title: "Large work" }],
    contacts: [],
    groups: [],
  }))
  t.after(() => dom.window.close())

  await import(`../js/pages/home.js?png-export-limit=${Date.now()}`)
  window.expPNG("large-work")
  const overlay = document.querySelector(".modal-overlay")
  const exportButton = overlay.querySelector("#pngExportBtn")
  const OriginalTextEncoder = globalThis.TextEncoder
  const createElement = document.createElement.bind(document)
  let canvasCreations = 0
  globalThis.TextEncoder = class {
    encode() { return { length: MAX_STEGANO_PAYLOAD_BYTES + 1 } }
  }
  document.createElement = function(tagName, options) {
    if (String(tagName).toLowerCase() === "canvas") {
      canvasCreations += 1
      throw new Error("canvas must not be created")
    }
    return createElement(tagName, options)
  }
  t.after(() => {
    globalThis.TextEncoder = OriginalTextEncoder
    document.createElement = createElement
  })

  exportButton.onclick()

  assert.equal(canvasCreations, 0)
  assert.equal(exportButton.disabled, false)
  assert.equal(exportButton.textContent, "导出 PNG")
  assert.equal(overlay.isConnected, true)
  assert.equal(alerts.length, 1)
  assert.match(alerts[0], /10 MB/)
  assert.match(alerts[0], /精简/)
})
