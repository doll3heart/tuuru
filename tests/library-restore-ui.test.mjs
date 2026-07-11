import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

import { startLocalLibraryRestore } from "../js/library-restore-ui.js"

function environment() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tuuru.local/" })
  const events = []
  return {
    dom,
    events,
    modal(title, body, footer, onClose) {
      const overlay = dom.window.document.createElement("div")
      overlay.innerHTML = `<section><h2>${title}</h2><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section>`
      overlay.closeModal = onClose
      dom.window.document.body.append(overlay)
      return overlay
    },
    download(blob, filename) { events.push(["download", filename, blob.type]) },
    notify(message, type) { events.push(["notify", message, type]) },
    reload() { events.push(["reload"]) },
  }
}

function backupRaw(database = { works: [], contacts: [], groups: [] }) {
  return JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database,
  })
}

function backupFile(raw, name = "backup.json") {
  return { name, size: raw.length, async text() { return raw } }
}

test("restore remains gated by recovery download and exact confirmation", async () => {
  const env = environment()
  const storage = {
    value: JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] }),
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
  const raw = backupRaw({ works: [{ id: "new" }], contacts: [], groups: [] })

  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
    now: () => new Date("2026-07-11T01:00:00.000Z"),
  })
  await controller.handleFile(backupFile(raw))

  const restore = env.dom.window.document.querySelector("#libraryRestoreCommit")
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  assert.match(env.dom.window.document.body.textContent, /当前创作库：作品 1；联系人 0；分组 0/)
  assert.match(env.dom.window.document.body.textContent, /备份：作品 1；联系人 0；分组 0/)
  assert.equal(restore.disabled, true)
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))
  assert.equal(restore.disabled, true)

  env.dom.window.document.querySelector("#libraryRestoreRecovery").click()
  assert.equal(restore.disabled, false)
  restore.click()
  restore.click()

  assert.equal(env.events.filter(event => event[0] === "download").length, 1)
  assert.equal(env.events.filter(event => event[0] === "reload").length, 1)
  assert.equal(JSON.parse(storage.value).works[0].id, "new")
})

test("restore preview shows the full current-versus-backup replacement impact and version", async () => {
  const env = environment()
  const storage = {
    value: JSON.stringify({
      works: [{ id: "kept-count" }],
      contacts: Array.from({ length: 100 }, (_, index) => ({ id: `contact-${index}` })),
      groups: Array.from({ length: 10 }, (_, index) => ({ id: `group-${index}` })),
    }),
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
    now: () => new Date("2026-07-11T01:00:00.000Z"),
  })

  await controller.handleFile(backupFile(backupRaw({
    works: [{ id: "same-work-count" }],
    contacts: [],
    groups: [],
  })))

  const preview = env.dom.window.document.querySelector(".library-restore-summary").textContent
  assert.match(preview, /当前创作库：作品 1；联系人 100；分组 10/)
  assert.match(preview, /备份：作品 1；联系人 0；分组 0/)
  assert.match(preview, /格式版本：v1/)
})

test("invalid files never open the destructive confirmation", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })

  await controller.handleFile({ name: "bad.json", size: 5, async text() { return "bad" } })

  assert.equal(env.dom.window.document.querySelector("#libraryRestoreCommit"), null)
  assert.equal(env.events.some(event => event[0] === "notify"), true)
})

test("a storage event invalidates an open restore plan", async () => {
  const env = environment()
  const raw = backupRaw()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile(backupFile(raw))

  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  const commit = env.dom.window.document.querySelector("#libraryRestoreCommit")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))
  assert.equal(commit.disabled, false)
  env.dom.window.dispatchEvent(new env.dom.window.StorageEvent("storage", { key: "unrelated" }))
  assert.equal(commit.disabled, false)
  env.dom.window.dispatchEvent(new env.dom.window.StorageEvent("storage", { key: "tuuru_works" }))

  assert.equal(commit.disabled, true)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /重新检查/)
})

test("an uncertain readback disables retry and never reloads", async () => {
  const env = environment()
  const raw = backupRaw()
  const mismatch = JSON.stringify({ works: [{ id: "other-tab" }], contacts: [], groups: [] })
  let reads = 0
  const controller = startLocalLibraryRestore({
    storage: {
      getItem() { reads += 1; return reads < 3 ? null : mismatch },
      setItem() {},
    },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile(backupFile(raw))
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  const commit = env.dom.window.document.querySelector("#libraryRestoreCommit")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))
  commit.click()

  assert.equal(commit.disabled, true)
  assert.equal(env.events.some(event => event[0] === "reload"), false)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /不能再次提交/)
})

test("a failed recovery download keeps destructive restore gated", async () => {
  const env = environment()
  const storage = {
    value: JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] }),
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download() { return Promise.reject(new Error("download blocked")) },
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile(backupFile(backupRaw()))
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  const commit = env.dom.window.document.querySelector("#libraryRestoreCommit")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))

  env.dom.window.document.querySelector("#libraryRestoreRecovery").click()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.equal(commit.disabled, true)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /下载失败/)
  assert.equal(env.events.some(event => event[0] === "notify" && event[2] === "error"), true)
})

test("clearing storage invalidates an open restore plan", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile(backupFile(backupRaw()))

  env.dom.window.dispatchEvent(new env.dom.window.StorageEvent("storage", { key: null }))

  assert.equal(env.dom.window.document.querySelector("#libraryRestoreCommit").disabled, true)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /重新检查/)
})

test("opening a new file disposes the prior restore plan", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  const first = await controller.handleFile(backupFile(backupRaw(), "first.json"))
  const second = await controller.handleFile(backupFile(backupRaw(), "second.json"))
  first.overlay.closeModal()

  assert.equal(first.overlay.isConnected, false)
  assert.equal(second.overlay.isConnected, true)
  assert.equal(env.dom.window.document.querySelectorAll("#libraryRestoreCommit").length, 1)
})

test("a slower file read cannot replace a newer restore plan", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  let finishFirstRead
  const firstRead = new Promise(resolve => { finishFirstRead = resolve })
  const firstRequest = controller.handleFile({
    name: "slow.json",
    size: backupRaw().length,
    text() { return firstRead },
  })
  const second = await controller.handleFile(backupFile(backupRaw(), "newer.json"))
  finishFirstRead(backupRaw())
  const first = await firstRequest

  assert.equal(first, null)
  assert.equal(second.overlay.isConnected, true)
  assert.match(second.overlay.textContent, /newer\.json/)
  assert.doesNotMatch(second.overlay.textContent, /slow\.json/)
})

test("controller-local dialog semantics close on Escape and return focus", async () => {
  const env = environment()
  const trigger = env.dom.window.document.createElement("button")
  trigger.textContent = "restore"
  env.dom.window.document.body.append(trigger)
  const createElement = env.dom.window.document.createElement.bind(env.dom.window.document)
  let picker
  env.dom.window.document.createElement = function(tagName, options) {
    const element = createElement(tagName, options)
    if (String(tagName).toLowerCase() === "input") picker = element
    return element
  }
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })

  controller.pickFile(trigger)
  Object.defineProperty(picker, "files", { value: [backupFile(backupRaw())] })
  picker.dispatchEvent(new env.dom.window.Event("change"))
  await new Promise(resolve => setTimeout(resolve, 0))

  const overlay = env.dom.window.document.querySelector('[role="dialog"]')
  const phrase = overlay.querySelector("#libraryRestorePhrase")
  assert.equal(overlay.getAttribute("aria-modal"), "true")
  assert.equal(overlay.getAttribute("aria-labelledby"), "libraryRestoreTitle")
  assert.equal(overlay.querySelector("#libraryRestoreStatus").getAttribute("aria-live"), "polite")
  assert.equal(env.dom.window.document.activeElement, phrase)
  assert.equal(trigger.disabled, true)

  env.dom.window.document.dispatchEvent(new env.dom.window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  }))

  assert.equal(overlay.isConnected, false)
  assert.equal(trigger.disabled, false)
  assert.equal(env.dom.window.document.activeElement, trigger)
})

test("Escape and cancel cannot close the dialog during the storage transaction", async () => {
  const env = environment()
  const observations = []
  const storage = {
    value: null,
    getItem() { return this.value },
    setItem(_key, value) {
      env.dom.window.document.dispatchEvent(new env.dom.window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }))
      env.dom.window.document.querySelector("#libraryRestoreCancel").click()
      observations.push(env.dom.window.document.querySelector("#libraryRestoreCommit")?.isConnected)
      this.value = value
    },
  }
  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile(backupFile(backupRaw()))
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))

  env.dom.window.document.querySelector("#libraryRestoreCommit").click()

  assert.deepEqual(observations, [true])
  assert.equal(env.dom.window.document.querySelector("#libraryRestoreCommit").isConnected, true)
  assert.equal(env.events.filter(event => event[0] === "reload").length, 1)
})

test("filenames are rendered as text rather than executable markup", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  const filename = '<img src=x onerror="window.pwned=true">.json'

  await controller.handleFile(backupFile(backupRaw(), filename))

  assert.equal(env.dom.window.document.querySelector(".library-restore-summary img"), null)
  assert.match(env.dom.window.document.querySelector(".library-restore-summary").textContent, /<img src=x/)
  assert.equal(env.dom.window.pwned, undefined)
})

test("post-commit callback failures never reclassify a successful restore", async () => {
  const env = environment()
  const storage = {
    value: null,
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
  const events = []
  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify() { events.push("notify"); throw new Error("toast unavailable") },
    reload() { events.push("reload"); throw new Error("reload unavailable") },
  })
  await controller.handleFile(backupFile(backupRaw({ works: [{ id: "restored" }], contacts: [], groups: [] })))
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  const commit = env.dom.window.document.querySelector("#libraryRestoreCommit")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))

  commit.click()

  assert.deepEqual(events, ["notify", "reload"])
  assert.equal(JSON.parse(storage.value).works[0].id, "restored")
  assert.equal(commit.disabled, true)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /恢复成功/)
  assert.doesNotMatch(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /无法确认|不能再次提交/)
})

test("homepage uses the guarded restore controller and accurate download copy", async () => {
  const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")

  assert.match(homeSource, /import \{ startLocalLibraryRestore \} from "\.\.\/library-restore-ui\.js"/)
  assert.match(homeSource, /onclick="restoreLibraryBackup\(\)"/)
  assert.match(homeSource, />检查 \/ 恢复备份<\/button>/)
  assert.match(homeSource, /备份下载已发起；文件包含私密内容，请妥善保管/)
  assert.doesNotMatch(homeSource, /inspectLibraryBackup|showBackupPreview|readLocalDatabaseBackupFile/)
})

test("homepage restore handler opens the guarded controller file picker at runtime", async t => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><button id="backupInspectBtn">restore</button></body></html>', {
    url: "https://tuuru.local/",
  })
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalLocalStorage = globalThis.localStorage
  const originalLocation = globalThis.location
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.location = dom.window.location
  t.after(() => {
    dom.window.close()
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.localStorage = originalLocalStorage
    globalThis.location = originalLocation
  })

  const createElement = dom.window.document.createElement.bind(dom.window.document)
  let picker
  let pickerClicks = 0
  dom.window.document.createElement = function(tagName, options) {
    const element = createElement(tagName, options)
    if (String(tagName).toLowerCase() === "input") {
      picker = element
      element.click = () => { pickerClicks += 1 }
    }
    return element
  }

  await import(`../js/pages/home.js?restore-runtime=${Date.now()}`)
  dom.window.restoreLibraryBackup()

  assert.equal(picker?.type, "file")
  assert.equal(picker?.accept, ".json,application/json")
  assert.equal(pickerClicks, 1)
})
