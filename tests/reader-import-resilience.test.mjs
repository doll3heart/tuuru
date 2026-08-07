import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { JSDOM } from "jsdom"
import { CURRENT_WORK_SCHEMA_VERSION } from "../js/work-schema.js"
import { createWorkRelease } from "../js/work-release.js"

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

function articleWork(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "reader-recovery-article",
    type: "article",
    title: "雾灯来信",
    author: "测试作者",
    password: "",
    placeholders: [],
    chapters: [{ id:"chapter-a", name:"第一章" }],
    nodes: [
      {
        id:"start",
        chapterId:"chapter-a",
        title:"起点",
        content:"<p>开头正文</p>",
        choices:[{ id:"go", text:"继续", targetId:"ending" }],
      },
      {
        id:"ending",
        chapterId:"chapter-a",
        title:"旧位置",
        content:"<p>上次停在这里</p>",
        choices:[],
      },
    ],
    scenes: [],
    phoneModules: [],
    startNode:"start",
    ...overrides,
  }
}

function seedMissingArticleBook(work, progress = {}) {
  localStorage.setItem("moirain_readerLibrary", JSON.stringify({
    version:1,
    identities:[{
      id:"identity-a",
      name:"夜间阅读",
      values:{ 姓名:"云枝" },
      createdAt:1,
      updatedAt:2,
    }],
    books:[{
      id:work.id,
      type:"article",
      title:work.title,
      author:work.author,
      coverColor:"",
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[],
      placeholderValues:{},
      progress:{
        kind:"article",
        path:["start", "ending"],
        choiceMemory:{ start:"go" },
        interactionSelections:{},
        checkpoints:[],
        savedAt:3,
        ...progress,
      },
      completedAt:0,
      bookmarks:[{
        id:"bookmark-a",
        kind:"article",
        label:"旧位置",
        note:"保留这条备注",
        savedAt:4,
        path:["start", "ending"],
        choiceMemory:{ start:"go" },
        interactionSelections:{},
      }],
    }],
  }))
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

function openImportDialog() {
  const libraryTab = document.querySelector('[data-tab="library"]')
  assert.ok(libraryTab)
  libraryTab.click()
  const trigger = document.querySelector("[data-reader-open-import]")
  assert.ok(trigger)
  trigger.click()
  assert.ok(document.querySelector(".rd-import-dialog"))
}

function importStatus() {
  const status = document.querySelector("[data-reader-import-status]")
  assert.ok(status)
  return status
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
      this.result = pngHeaderDataUrl(imageData.width, imageData.height)
      this.onload?.()
    }
  }

  t.after(() => {
    document.createElement = createElement
    globalThis.Image = OriginalImage
    globalThis.FileReader = OriginalFileReader
  })
}

function pngHeaderDataUrl(width, height, validSignature = true) {
  const bytes = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write("IHDR", 12, "ascii")
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  if (!validSignature) bytes[0] = 0
  return `data:image/png;base64,${bytes.toString("base64")}`
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
  openImportDialog()

  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", {
    value: { files: [{ name: "memory-only.json", size: serializedWork.length }] },
  })
  document.getElementById("dropInner").dispatchEvent(drop)

  assert.ok(document.getElementById("rdStartBtn"))
  assert.deepEqual(storage.writes, [
    "moirain_work_reader-memory-only-work",
    "moirain_readerLibrary",
  ])
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
  assert.equal(storage.writes.includes("moirain_readerLibrary"), true)
  assert.equal(storage.writes.includes("moirain_readerPhValues"), false)
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
  const normalizedSerializedWork = JSON.stringify({
    ...work,
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
  })

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
  openImportDialog()

  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(drop, "dataTransfer", {
    value: { files: [{ name: "recent-quota.json", size: serializedWork.length }] },
  })
  document.getElementById("dropInner").dispatchEvent(drop)

  assert.ok(document.getElementById("rdStartBtn"))
  assert.deepEqual(storage.writes, [
    "moirain_work_reader-recent-quota-work",
    "moirain_readerLibrary",
    "moirain_recent",
  ])
  assert.equal(storage.values.get("moirain_work_reader-recent-quota-work"), normalizedSerializedWork)
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
  openImportDialog()

  const MiB = 1024 * 1024
  for (const file of [
    { name: "unknown-size.json" },
    { name: "empty.json", size: 0 },
    { name: "too-large.json", size: 10 * MiB + 1 },
    { name: "too-large.png", size: 25 * MiB + 1 },
  ]) {
    dropFile(dom, file)
    assert.equal(importStatus().dataset.state, "error")
    assert.ok(importStatus().textContent.trim())
  }

  assert.equal(constructions.length, 0)
  assert.deepEqual(reads, [])
  assert.equal(alerts.length, 0)

  const jsonAtLimit = { name: "limit.json", size: 10 * MiB }
  const pngAtLimit = { name: "limit.png", size: 25 * MiB }
  dropFile(dom, jsonAtLimit)
  assert.equal(importStatus().dataset.state, "loading")
  assert.equal(document.getElementById("pickFileBtn").disabled, true)
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
  openImportDialog()

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
  assert.equal(importStatus().dataset.state, "error")
  assert.match(importStatus().textContent, /无法读取/)

  mode = "abort"
  dropFile(dom, { name: "cancelled.json", size: 100 })

  assert.equal(alerts.length, 0)
  assert.equal(importStatus().dataset.state, "error")
  assert.match(importStatus().textContent, /取消/)
  assert.equal(document.getElementById("rdStartBtn"), null)
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
  openImportDialog()
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
  openImportDialog()
  dropFile(dom, { name: "truncated.png", size: pixels.byteLength })

  assert.equal(decodeCalls, 0)
  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.equal(alerts.length, 0)
  assert.equal(importStatus().dataset.state, "error")
  assert.ok(importStatus().textContent.trim())
})

test("reader validates PNG dimensions before constructing an Image", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  let imageConstructions = 0
  let canvasConstructions = 0
  globalThis.Image = class {
    width = 240
    height = 240
    constructor() { imageConstructions += 1 }
    set src(value) {
      this.currentSrc = value
      this.onload?.()
    }
  }
  globalThis.FileReader = class {
    readAsText() { throw new Error("unexpected JSON read") }
    readAsDataURL(file) {
      this.result = file.dataUrl
      this.onload?.()
    }
  }

  await import(`../reader/reader.js?reader-png-dimensions=${Date.now()}`)
  openImportDialog()
  const createElement = document.createElement.bind(document)
  document.createElement = function(tagName, options) {
    if (String(tagName).toLowerCase() !== "canvas") return createElement(tagName, options)
    canvasConstructions += 1
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage() {},
          getImageData() { return { data: new Uint8ClampedArray(240 * 240 * 4) } },
        }
      },
    }
  }
  t.after(() => { document.createElement = createElement })

  for (const [name, dataUrl] of [
    ["valid.png", pngHeaderDataUrl(240, 240)],
    ["wide.png", pngHeaderDataUrl(4097, 1)],
    ["dense.png", pngHeaderDataUrl(2049, 2048)],
    ["invalid.png", pngHeaderDataUrl(240, 240, false)],
  ]) {
    dropFile(dom, { name, size: 100, dataUrl })
  }

  assert.equal(imageConstructions, 1)
  assert.equal(canvasConstructions, 1)
  assert.equal(alerts.length, 0)
  assert.equal(importStatus().dataset.state, "error")
  assert.match(importStatus().textContent, /PNG/)
})

test("reader reviews a same-work update before replacing cached content and preserves progress", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const previousWork = phoneWork()
  previousWork.id = "reader-duplicate-work"
  previousWork.title = "Old title"
  const updatedWork = phoneWork()
  updatedWork.id = previousWork.id
  updatedWork.title = "Updated title"
  for (const candidate of [previousWork, updatedWork]) {
    candidate.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
    candidate.phoneData.memos = [
      {id:"memo-1", content:"第一条"},
      {id:"memo-2", content:"第二条"},
      {id:"memo-3", content:"第三条"},
    ]
    candidate.phoneData.apps = [
      {id:"memo-app", type:"memo", name:"备忘录", enabled:true},
    ]
    candidate.phoneData.readingFlow = {
      enabled:true,
      sequence:[
        {type:"memo", itemId:"memo-1"},
        {type:"memo", itemId:"memo-2"},
        {type:"memo", itemId:"memo-3"},
      ],
    }
  }
  previousWork.phoneData.memos = previousWork.phoneData.memos.slice(0, 2)
  previousWork.updatedAt = 20
  previousWork.release = createWorkRelease(previousWork, {
    revision:20,
    exportedAt:"2026-07-27T00:00:00.000Z",
  })
  updatedWork.updatedAt = 21
  updatedWork.release = createWorkRelease(updatedWork, {
    revision:21,
    exportedAt:"2026-07-28T00:00:00.000Z",
  })
  const serializedWork = JSON.stringify(updatedWork)
  const previousCached = JSON.stringify(previousWork)
  localStorage.setItem(`moirain_work_${previousWork.id}`, previousCached)
  localStorage.setItem("moirain_readerLibrary", JSON.stringify({
    version:1,
    books:[{
      id:previousWork.id,
      type:"phone",
      title:previousWork.title,
      author:"",
      coverColor:"",
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[],
      placeholderValues:{},
      progress:{kind:"phone", flowIndex:2, savedAt:3},
    }],
  }))

  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() { throw new Error("unexpected PNG read") }
  }

  await import(`../reader/reader.js?reader-import-duplicate=${Date.now()}`)
  openImportDialog()
  dropFile(dom, {name:"updated.json", size:serializedWork.length})

  const review = document.querySelector(".rd-import-review")
  assert.ok(review)
  assert.equal(review.hidden, false)
  assert.equal(review.dataset.releaseState, "newer")
  assert.match(review.textContent, /发现作品更新/)
  assert.match(review.textContent, /作者新发布的版本/)
  assert.match(review.textContent, /新增 1 条备忘录/)
  assert.match(review.textContent, /保留存档、身份、占位符与书签/)
  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.equal(localStorage.getItem(`moirain_work_${previousWork.id}`), previousCached)

  const confirmUpdate = review.querySelector("[data-reader-import-confirm]")
  assert.equal(document.activeElement, confirmUpdate)
  confirmUpdate.dispatchEvent(new dom.window.KeyboardEvent("keydown", {key:"Tab", bubbles:true}))
  assert.equal(document.activeElement, document.querySelector(".rd-import-close"))
  confirmUpdate.focus()
  confirmUpdate.click()

  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(
    JSON.parse(localStorage.getItem(`moirain_work_${previousWork.id}`)).title,
    updatedWork.title,
  )
  const savedLibrary = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const savedBook = savedLibrary.books.find(book => book.id === previousWork.id)
  assert.equal(savedBook.progress.kind, "phone")
  assert.equal(savedBook.progress.flowIndex, 2)
  assert.equal(savedBook.unseenUpdateAt > 0, true)
  assert.equal(alerts.length, 0)
})

test("same release continues from the cached copy without rewriting it", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const candidate = phoneWork()
  candidate.id = "reader-same-release"
  candidate.title = "Same release"
  candidate.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  candidate.updatedAt = 21
  candidate.release = createWorkRelease(candidate, {
    revision:21,
    exportedAt:"2026-07-28T00:00:00.000Z",
  })
  const cachedRaw = ` \n${JSON.stringify(candidate)}`
  const libraryRaw = JSON.stringify({
    version:1,
    identities:[],
    books:[{
      id:candidate.id,
      type:"phone",
      title:candidate.title,
      author:"",
      coverColor:"",
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[],
      placeholderValues:{},
      progress:null,
    }],
  })
  localStorage.setItem(`moirain_work_${candidate.id}`, cachedRaw)
  localStorage.setItem("moirain_readerLibrary", libraryRaw)
  const serializedWork = JSON.stringify(candidate)
  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() { throw new Error("unexpected PNG read") }
  }

  await import(`../reader/reader.js?reader-import-same-release=${Date.now()}`)
  openImportDialog()
  dropFile(dom, {name:"same.json", size:serializedWork.length})

  const review = document.querySelector(".rd-import-review")
  assert.equal(review.dataset.releaseState, "same")
  assert.equal(review.querySelector("[data-reader-import-confirm]").textContent, "继续阅读")
  assert.equal(review.querySelector("[data-reader-import-secondary]").textContent, "重新写入缓存")

  review.querySelector("[data-reader-import-confirm]").click()

  assert.equal(localStorage.getItem(`moirain_work_${candidate.id}`), cachedRaw)
  assert.equal(document.querySelector(".rd-import-dialog"), null)
  assert.equal(document.querySelector(".rd-landing-title").textContent, candidate.title)
  assert.equal(alerts.length, 0)
})

test("older releases can open once without replacing the bookshelf copy", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const currentWork = phoneWork()
  currentWork.id = "reader-preview-old-release"
  currentWork.title = "Current release"
  currentWork.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  currentWork.updatedAt = 21
  currentWork.release = createWorkRelease(currentWork, {
    revision:21,
    exportedAt:"2026-07-28T00:00:00.000Z",
  })
  const olderWork = JSON.parse(JSON.stringify(currentWork))
  olderWork.title = "Older release"
  olderWork.updatedAt = 20
  delete olderWork.release
  olderWork.release = createWorkRelease(olderWork, {
    revision:20,
    exportedAt:"2026-07-27T00:00:00.000Z",
  })
  const cachedRaw = JSON.stringify(currentWork)
  const libraryRaw = JSON.stringify({
    version:1,
    identities:[],
    books:[{
      id:currentWork.id,
      type:"phone",
      title:currentWork.title,
      author:"",
      coverColor:"",
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[],
      placeholderValues:{},
      progress:null,
    }],
  })
  localStorage.setItem(`moirain_work_${currentWork.id}`, cachedRaw)
  localStorage.setItem("moirain_readerLibrary", libraryRaw)
  const serializedWork = JSON.stringify(olderWork)
  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() { throw new Error("unexpected PNG read") }
  }

  await import(`../reader/reader.js?reader-import-old-preview=${Date.now()}`)
  openImportDialog()
  dropFile(dom, {name:"older.json", size:serializedWork.length})

  const review = document.querySelector(".rd-import-review")
  assert.equal(review.dataset.releaseState, "older")
  assert.equal(review.querySelector("[data-reader-import-secondary]").textContent, "仅本次打开")
  review.querySelector("[data-reader-import-secondary]").click()

  assert.equal(localStorage.getItem(`moirain_work_${currentWork.id}`), cachedRaw)
  assert.equal(localStorage.getItem("moirain_readerLibrary"), libraryRaw)
  assert.equal(document.querySelector(".rd-landing-title").textContent, olderWork.title)
  assert.equal(alerts.length, 0)
})

test("cache recovery rejects a different work instead of importing it as a new book", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const expectedWork = articleWork()
  const wrongWork = articleWork({
    id:"different-reader-work",
    title:"另一封信",
  })
  seedMissingArticleBook(expectedWork)
  const serializedWrongWork = JSON.stringify(wrongWork)

  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWrongWork
      this.onload?.()
    }
    readAsDataURL() { throw new Error("unexpected PNG read") }
  }

  await import(`../reader/reader.js?reader-import-recovery-mismatch=${Date.now()}`)
  document.querySelector('.rd-tab[data-tab="library"]').click()
  document.querySelector('[data-reader-book-recover]').click()

  const dialog = document.querySelector(".rd-import-dialog")
  assert.ok(dialog)
  assert.match(dialog.textContent, /雾灯来信/)
  assert.match(dialog.textContent, /重新导入/)

  dropFile(dom, {name:"wrong.json", size:serializedWrongWork.length})

  assert.ok(document.querySelector(".rd-import-dialog"))
  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.equal(importStatus().dataset.state, "error")
  assert.match(importStatus().textContent, /雾灯来信/)
  assert.equal(localStorage.getItem(`moirain_work_${wrongWork.id}`), null)
  assert.equal(alerts.length, 0)
})

test("cache recovery reconnects the exact work and resumes its saved article position", async t => {
  const alerts = []
  const dom = installDom(t, null, alerts)
  const expectedWork = articleWork()
  seedMissingArticleBook(expectedWork)
  const serializedWork = JSON.stringify(expectedWork)

  globalThis.FileReader = class {
    readAsText() {
      this.result = serializedWork
      this.onload?.()
    }
    readAsDataURL() { throw new Error("unexpected PNG read") }
  }

  await import(`../reader/reader.js?reader-import-recovery-resume=${Date.now()}`)
  document.querySelector('.rd-tab[data-tab="library"]').click()
  document.querySelector('[data-reader-book-recover]').click()
  dropFile(dom, {name:"same-work.json", size:serializedWork.length})

  const review = document.querySelector(".rd-import-review")
  assert.ok(review)
  assert.equal(review.hidden, false)
  assert.match(review.textContent, /恢复书架内容/)
  assert.match(review.textContent, /存档、身份、占位符与书签/)
  assert.equal(review.querySelector("[data-reader-import-confirm]").textContent, "恢复并继续")
  assert.equal(localStorage.getItem(`moirain_work_${expectedWork.id}`), null)

  review.querySelector("[data-reader-import-confirm]").click()

  assert.equal(document.getElementById("rdStartBtn"), null)
  assert.ok(document.querySelector(".article-reader"))
  assert.equal(document.querySelector('.article-content[data-active="true"]').textContent.trim(), "上次停在这里")
  assert.ok(localStorage.getItem(`moirain_work_${expectedWork.id}`))
  const savedLibrary = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const savedBook = savedLibrary.books.find(book => book.id === expectedWork.id)
  assert.equal(savedBook.bookmarks[0].note, "保留这条备注")
  assert.equal(savedLibrary.identities[0].name, "夜间阅读")
  assert.equal(alerts.length, 0)
})
