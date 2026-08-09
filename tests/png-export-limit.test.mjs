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
    works: [{ id: workId, schemaVersion: 1, type: "article", title: "PNG work", nodes: [] }],
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
  let encodeCalls = 0
  globalThis.TextEncoder = class {
    encode(value) {
      encodeCalls += 1
      if (encodeCalls > 1) return { length: MAX_STEGANO_PAYLOAD_BYTES + 1 }
      return new OriginalTextEncoder().encode(value)
    }
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

  await exportButton.onclick()

  assert.equal(canvasCreations, 0)
  assert.equal(exportButton.disabled, false)
  assert.equal(exportButton.textContent, "导出 PNG")
  assert.equal(overlay.isConnected, true)
  assert.equal(alerts.length, 0)
  const feedback = document.querySelector(".toast")
  assert.ok(feedback)
  assert.match(feedback.textContent, /10 MB/)
  assert.match(feedback.textContent, /精简/)
})

test("PNG export stays unavailable while the selected cover is still being read", async t => {
  const { overlay, exportButton } = await openPngExport(t, "slow-cover-work", "png-cover-reading")
  const OriginalFileReader = globalThis.FileReader
  const createElement = document.createElement.bind(document)
  let fileInput = null
  let pendingReader = null

  globalThis.FileReader = class {
    constructor() {
      pendingReader = this
    }

    readAsDataURL(file) {
      this.file = file
    }
  }
  document.createElement = function(tagName, options) {
    if (String(tagName).toLowerCase() === "input") {
      fileInput = createElement(tagName, options)
      return fileInput
    }
    return createElement(tagName, options)
  }
  t.after(() => {
    globalThis.FileReader = OriginalFileReader
    document.createElement = createElement
  })

  const coverButton = overlay.querySelector("#pngCoverBtn")
  coverButton.onclick()
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [{ name: "slow-cover.png" }],
  })
  fileInput.onchange()

  assert.ok(pendingReader)
  assert.equal(pendingReader.file.name, "slow-cover.png")
  assert.equal(exportButton.disabled, true)
  assert.equal(coverButton.disabled, true)
  assert.match(exportButton.textContent, /读取封面/)
  assert.match(overlay.querySelector("#pngCoverLabel").textContent, /正在读取/)

  exportButton.click()
  assert.equal(document.querySelector(".toast"), null)
})

for (const scenario of [
  { eventName: "onerror", labelPattern: /读取失败/, title: "failure" },
  { eventName: "onabort", labelPattern: /读取已取消/, title: "cancellation" },
]) {
  test(`a FileReader ${scenario.title} restores the cover UI and blocks default export`, async t => {
    const { overlay, exportButton } = await openPngExport(t, `cover-read-${scenario.title}`, `png-cover-read-${scenario.title}`)
    const OriginalFileReader = globalThis.FileReader
    const createElement = document.createElement.bind(document)
    let fileInput = null
    let activeReader = null
    let canvasCreations = 0

    globalThis.FileReader = class {
      constructor() {
        activeReader = this
      }

      readAsDataURL() {}
    }
    document.createElement = function(tagName, options) {
      const normalizedName = String(tagName).toLowerCase()
      if (normalizedName === "input") {
        fileInput = createElement(tagName, options)
        return fileInput
      }
      if (normalizedName === "canvas") {
        canvasCreations += 1
        throw new Error("default PNG export must not start after a cover read error")
      }
      return createElement(tagName, options)
    }
    t.after(() => {
      globalThis.FileReader = OriginalFileReader
      document.createElement = createElement
    })

    const coverButton = overlay.querySelector("#pngCoverBtn")
    coverButton.onclick()
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [{ name: "broken-cover.png" }],
    })
    fileInput.onchange()
    activeReader[scenario.eventName]?.()

    assert.equal(exportButton.disabled, false)
    assert.equal(coverButton.disabled, false)
    assert.equal(exportButton.textContent, "导出 PNG")
    assert.match(overlay.querySelector("#pngCoverLabel").textContent, scenario.labelPattern)
    const readFeedback = document.querySelector(".toast")
    assert.ok(readFeedback)
    assert.match(readFeedback.textContent, scenario.labelPattern)

    await exportButton.onclick()
    assert.equal(canvasCreations, 0)
    assert.equal(overlay.isConnected, true)
  })
}

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
  await exportButton.onclick()
  await new Promise(resolve => setTimeout(resolve, 10))

  assert.deepEqual(asyncThrows, [])
  assert.equal(exportButton.disabled, false)
  assert.equal(exportButton.textContent, "导出 PNG")
  assert.equal(overlay.isConnected, true)
  assert.equal(alerts.length, 0)
  const feedback = document.querySelector(".toast")
  assert.ok(feedback)
  assert.match(feedback.textContent, /cover draw failed/)
})
