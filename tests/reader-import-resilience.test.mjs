import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function phoneWork() {
  return {
    schemaVersion: 1,
    id: "reader-memory-only-work",
    type: "phone",
    title: "Memory only",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [],
    },
  }
}

function unavailableStorage() {
  const values = new Map([["sentinel", "preserve me"]])
  const writes = []
  const removals = []

  return {
    values,
    writes,
    removals,
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key) {
      writes.push(key)
      const error = new Error("storage blocked")
      error.name = "SecurityError"
      throw error
    },
    removeItem(key) {
      removals.push(key)
      values.delete(key)
    },
  }
}

function recentQuotaStorage() {
  const originalRecent = JSON.stringify([{
    id: "existing-work",
    title: "Existing work",
    type: "phone",
    importedAt: 1,
  }])
  const values = new Map([
    ["sentinel", "preserve me"],
    ["moirain_recent", originalRecent],
  ])
  const writes = []
  const removals = []

  return {
    values,
    writes,
    removals,
    originalRecent,
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) {
      writes.push(key)
      if (key === "moirain_recent") {
        const error = new Error("quota exceeded")
        error.name = "QuotaExceededError"
        throw error
      }
      values.set(key, value)
    },
    removeItem(key) {
      removals.push(key)
      values.delete(key)
    },
  }
}

function installDom(t, storage, alerts) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = storage || dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = message => alerts.push(String(message))
  t.after(() => dom.window.close())
  return dom
}

function dropFile(dom, file) {
  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } })
  document.getElementById("dropInner").dispatchEvent(drop)
  return drop
}

function encodeRgbPayload(text) {
  const data = new TextEncoder().encode(text)
  const packed = new Uint8Array(4 + data.length)
  packed.set([
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
  ])
  packed.set(data, 4)

  const width = Math.ceil(packed.length / 3)
  const pixels = new Uint8ClampedArray(width * 4)
  for (let pixel = 0; pixel < width; pixel += 1) pixels[pixel * 4 + 3] = 255
  packed.forEach((byte, index) => {
    const pixelIndex = Math.floor(index / 3) * 4 + (index % 3)
    pixels[pixelIndex] = byte
  })
  return { width, height: 1, pixels }
}

function installPngReadFakes(t, imageData) {
  const createElement = document.createElement.bind(document)
  const OriginalImage = globalThis.Image
  const OriginalFileReader = globalThis.FileReader

  document.createElement = function(tagName, options) {
    if (String(tagName).toLowerCase() !== "canvas") {
      return createElement(tagName, options)
    }
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage() {},
          getImageData() { return { data: imageData.pixels } },
        }
      },
    }
  }
  globalThis.Image = class {
    width = imageData.width
    height = imageData.height
    set src(value) {
      this.currentSrc = value
      this.onload?.()
    }
  }
  globalThis.FileReader = class {
    readAsText() { throw new Error("unexpected JSON read") }
    readAsDataURL() {
      this.result = "data:image/png;base64,reader-test"
      this.onload?.()
    }
  }

  t.after(() => {
    document.createElement = createElement
    globalThis.Image = OriginalImage
    globalThis.FileReader = OriginalFileReader
  })
}

test("reader imports remain usable when local persistence is unavailable", async t => {
  const storage = unavailableStorage()
  const alerts = []
  const dom = installDom(t, storage, alerts)
  const serializedWork = JSON.stringify(phoneWork())

  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() {
      throw new Error("unexpected PNG read")
    }
  }

  await import(`../reader/reader.js?reader-import-storage=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()

  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", {
    value: { files: [{ name: "memory-only.json", size: serializedWork.length }] },
  })
  document.getElementById("dropInner").dispatchEvent(drop)

  assert.ok(document.getElementById("rdStartBtn"))
  assert.deepEqual(storage.writes, ["moirain_work_reader-memory-only-work"])
  assert.equal(storage.writes.includes("moirain_recent"), false)
  assert.equal(alerts.length, 1)
  assert.doesNotMatch(alerts[0], /JSON/)
  assert.match(alerts[0], /继续阅读/)
  assert.match(alerts[0], /刷新|关闭/)
  assert.match(alerts[0], /重新导入/)

  document.getElementById("rdStartBtn").click()

  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(alerts.length, 1)
  assert.equal(storage.writes.includes("moirain_recent"), false)
  assert.equal(storage.writes.includes("moirain_readerPhValues"), true)
  assert.deepEqual(storage.removals, [])
  assert.equal(storage.values.get("sentinel"), "preserve me")
})

test("reader keeps its cached work when only the recent list exceeds quota", async t => {
  const storage = recentQuotaStorage()
  const alerts = []
  const dom = installDom(t, storage, alerts)
  const work = phoneWork()
  work.id = "reader-recent-quota-work"
  work.title = "Recent quota"
  const serializedWork = JSON.stringify(work)

  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() {
      throw new Error("unexpected PNG read")
    }
  }

  await import(`../reader/reader.js?reader-import-recent-quota=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()

  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", {
    value: { files: [{ name: "recent-quota.json", size: serializedWork.length }] },
  })
  document.getElementById("dropInner").dispatchEvent(drop)

  assert.ok(document.getElementById("rdStartBtn"))
  assert.deepEqual(storage.writes, [
    "moirain_work_reader-recent-quota-work",
    "moirain_recent",
  ])
  assert.equal(storage.values.get("moirain_work_reader-recent-quota-work"), serializedWork)
  assert.equal(storage.values.get("moirain_recent"), storage.originalRecent)
  assert.equal(alerts.length, 1)

  document.getElementById("rdStartBtn").click()

  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(alerts.length, 1)
  assert.equal(storage.values.get("moirain_recent"), storage.originalRecent)
  assert.deepEqual(storage.removals, [])
  assert.equal(storage.values.get("sentinel"), "preserve me")
})

test("reader rejects unsafe import sizes before creating a FileReader", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const constructions = []
  const reads = []

  globalThis.FileReader = class {
    constructor() { constructions.push(this) }
    readAsText(file) { reads.push(["text", file]) }
    readAsDataURL(file) { reads.push(["data-url", file]) }
  }

  await import(`../reader/reader.js?reader-import-limits=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()

  const MiB = 1024 * 1024
  for (const file of [
    { name: "unknown-size.json" },
    { name: "empty.json", size: 0 },
    { name: "too-large.json", size: 10 * MiB + 1 },
    { name: "too-large.png", size: 25 * MiB + 1 },
  ]) {
    dropFile(dom, file)
  }

  assert.equal(constructions.length, 0)
  assert.deepEqual(reads, [])
  assert.equal(alerts.length, 4)

  const jsonAtLimit = { name: "limit.json", size: 10 * MiB }
  const pngAtLimit = { name: "limit.png", size: 25 * MiB }
  dropFile(dom, jsonAtLimit)
  dropFile(dom, pngAtLimit)

  assert.equal(constructions.length, 2)
  assert.deepEqual(reads, [
    ["text", jsonAtLimit],
    ["data-url", pngAtLimit],
  ])
})

test("reader reports FileReader errors and cancellations without parsing", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  let mode = "error"

  globalThis.FileReader = class {
    readAsText() {
      if (mode === "error") this.onerror?.()
      else this.onabort?.()
    }
    readAsDataURL() {
      throw new Error("unexpected PNG read")
    }
  }

  await import(`../reader/reader.js?reader-import-read-failure=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()

  const input = document.getElementById("fileInput")
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [{ name: "unreadable.json", size: 100 }],
  })
  Object.defineProperty(input, "value", {
    configurable: true,
    writable: true,
    value: "selected-file",
  })
  input.onchange()
  assert.equal(input.value, "")

  mode = "abort"
  dropFile(dom, { name: "cancelled.json", size: 100 })

  assert.equal(alerts.length, 2)
  assert.match(alerts[0], /无法读取/)
  assert.match(alerts[1], /取消/)
  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.equal(alerts.some(message => /JSON 解析失败/.test(message)), false)
})

test("reader decodes the four-byte PNG header from RGB channels", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const work = phoneWork()
  work.id = "reader-rgb-header-work"
  work.title = "RGB header"
  const serializedWork = JSON.stringify(work)
  const imageData = encodeRgbPayload(serializedWork)
  installPngReadFakes(t, imageData)

  await import(`../reader/reader.js?reader-import-rgb-header=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()
  dropFile(dom, { name: "editor-export.png", size: imageData.pixels.byteLength })

  assert.ok(document.getElementById("rdStartBtn"))
  assert.equal(document.querySelector(".rd-landing-title")?.textContent, work.title)
  assert.deepEqual(alerts, [])
})

test("reader rejects PNG payload lengths that overlap the four-byte header", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 3,
    3, 0, 0, 255,
  ])
  installPngReadFakes(t, { width: 2, height: 1, pixels })
  const OriginalTextDecoder = globalThis.TextDecoder
  let decodeCalls = 0
  globalThis.TextDecoder = class {
    decode() {
      decodeCalls += 1
      return JSON.stringify(phoneWork())
    }
  }
  t.after(() => { globalThis.TextDecoder = OriginalTextDecoder })

  await import(`../reader/reader.js?reader-import-header-capacity=${Date.now()}`)
  document.querySelector('[data-tab="import"]').click()
  dropFile(dom, { name: "truncated.png", size: pixels.byteLength })

  assert.equal(decodeCalls, 0)
  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.equal(alerts.length, 1)
})
