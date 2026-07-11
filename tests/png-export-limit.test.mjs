import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { MAX_STEGANO_PAYLOAD_BYTES } from "../js/stegano.js"

async function openPngExport(t, workId, importTag) {
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
    works: [{ id: workId, schemaVersion: 1, type: "article", title: "PNG work" }],
    contacts: [],
    groups: [],
  }))
  t.after(() => dom.window.close())

  await import(`../js/pages/home.js?${importTag}=${Date.now()}`)
  window.expPNG(workId)
  const overlay = document.querySelector(".modal-overlay")
  return { alerts, dom, overlay, exportButton: overlay.querySelector("#pngExportBtn") }
}

test("an oversized PNG export restores its button and reports the limit", async t => {
  const { alerts, overlay, exportButton } = await openPngExport(t, "large-work", "png-export-limit")
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

test("an asynchronous cover encoding failure restores the PNG export", async t => {
  const { alerts, overlay, exportButton } = await openPngExport(t, "cover-work", "png-cover-failure")
  const OriginalFileReader = globalThis.FileReader
  const OriginalImage = globalThis.Image
  const createElement = document.createElement.bind(document)
  const asyncThrows = []
  let fileInput = null

  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = "data:image/png;base64,cover"
      this.onload?.()
    }
  }
  globalThis.Image = class {
    width = 100
    height = 100
    set src(value) {
      this.currentSrc = value
      setTimeout(() => {
        try { this.onload?.() } catch (error) { asyncThrows.push(error) }
      }, 0)
    }
  }
  document.createElement = function(tagName, options) {
    const normalizedName = String(tagName).toLowerCase()
    if (normalizedName === "input") {
      fileInput = createElement(tagName, options)
      return fileInput
    }
    if (normalizedName === "canvas") {
      return {
        getContext() {
          return {
            fillRect() {},
            drawImage() { throw new Error("cover draw failed") },
          }
        },
      }
    }
    return createElement(tagName, options)
  }
  t.after(() => {
    globalThis.FileReader = OriginalFileReader
    globalThis.Image = OriginalImage
    document.createElement = createElement
  })

  overlay.querySelector("#pngCoverBtn").onclick()
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [{ name: "cover.png" }],
  })
  fileInput.onchange()
  exportButton.onclick()
  await new Promise(resolve => setTimeout(resolve, 10))

  assert.deepEqual(asyncThrows, [])
  assert.equal(exportButton.disabled, false)
  assert.equal(exportButton.textContent, "导出 PNG")
  assert.equal(overlay.isConnected, true)
  assert.equal(alerts.length, 1)
  assert.match(alerts[0], /cover draw failed/)
})
