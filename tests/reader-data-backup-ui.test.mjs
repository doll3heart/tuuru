import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import {
  READER_LIBRARY_STORAGE_KEY,
  emptyReaderLibrary,
  rememberReaderWork,
  saveReaderProgress,
} from "../reader/reader-library-state.js"
import { serializeReaderDataPackage } from "../reader/reader-data-package.js"

const cssSource = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
  })
  Object.assign(globalThis, {
    window:dom.window,
    document:dom.window.document,
    localStorage:dom.window.localStorage,
    sessionStorage:dom.window.sessionStorage,
    Storage:dom.window.Storage,
    Element:dom.window.Element,
    HTMLElement:dom.window.HTMLElement,
    Node:dom.window.Node,
    Event:dom.window.Event,
    MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    File:dom.window.File,
    FileReader:dom.window.FileReader,
    Blob:dom.window.Blob,
    alert:() => {},
    requestAnimationFrame:callback => { callback(); return 1 },
  })
  t.after(() => dom.window.close())
  return dom
}

function readerLibrary(id, updatedAt, path) {
  const work = {
    id,
    type:"article",
    title:`Book ${id}`,
    author:"Author",
    placeholders:[],
  }
  let library = rememberReaderWork(emptyReaderLibrary(), work, updatedAt - 10)
  library = saveReaderProgress(library, id, {
    kind:"article",
    path,
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }, updatedAt)
  return { library, work }
}

function seedCurrentReaderData() {
  const { library, work } = readerLibrary("current-book", 400, ["current"])
  localStorage.setItem(READER_LIBRARY_STORAGE_KEY, JSON.stringify(library))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify({
    ...work,
    password:"private-work-password",
    chapters:[],
    nodes:[{ id:"current", content:"PRIVATE WORK BODY", choices:[] }],
    scenes:[],
    phoneModules:[],
    startNode:"current",
  }))
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
  localStorage.setItem("moirain_profile", JSON.stringify({
    readerId:"Current",
    bio:"Current bio",
    readerAvatar:"data:image/png;base64,YXZhdGFy",
  }))
  localStorage.setItem("moirain_placeholders", JSON.stringify({
    name:"Current name",
    nickname:"",
    webname:"",
  }))
  localStorage.setItem("moirain_readerSettings", JSON.stringify({
    fontSize:16,
    backgroundImage:"data:image/png;base64,YXJ0aWNsZQ==",
  }))
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    fontSize:11,
    wallpaperImage:"data:image/png;base64,d2FsbHBhcGVy",
  }))
}

function incomingPackage() {
  const { library } = readerLibrary("backup-book", 300, ["backup"])
  return serializeReaderDataPackage({
    library,
    profile:{ readerId:"Backup", bio:"Backup bio" },
    placeholderPresets:{ name:"Backup name", nickname:"Moon", webname:"night" },
    appearance:{
      article:{ fontSize:19 },
      phone:{ fontSize:15 },
    },
  }, new Date("2026-07-28T12:00:00.000Z"))
}

function openBookshelf() {
  document.querySelector('.rd-tab[data-tab="library"]').click()
}

function selectBackupFile(serialized) {
  const input = document.querySelector("[data-reader-data-file]")
  const file = new File([serialized], "reader-backup.json", {type:"application/json"})
  Object.defineProperty(input, "files", {
    configurable:true,
    value:[file],
  })
  input.dispatchEvent(new Event("change"))
}

function waitForFileRead() {
  return new Promise(resolve => setTimeout(resolve, 30))
}

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

test("bookshelf reader data panel exports a private package and previews before merging import", async t => {
  installDom(t)
  seedCurrentReaderData()
  let downloadedBlob = null
  let downloadedName = ""
  window.URL.createObjectURL = blob => {
    downloadedBlob = blob
    return "blob:reader-data"
  }
  window.URL.revokeObjectURL = () => {}
  const originalClick = HTMLElement.prototype.click
  HTMLElement.prototype.click = function() {
    if (this.tagName === "A" && this.download) {
      downloadedName = this.download
      return
    }
    return originalClick.call(this)
  }
  t.after(() => { HTMLElement.prototype.click = originalClick })

  await import(`../reader/reader.js?reader-data-backup-ui=${Date.now()}`)
  openBookshelf()
  const toggle = document.querySelector("[data-reader-data-toggle]")
  assert.ok(toggle)
  assert.equal(toggle.getAttribute("aria-expanded"), "false")
  toggle.click()

  const panel = document.querySelector("[data-reader-data-panel]")
  assert.equal(panel.hidden, false)
  assert.match(panel.textContent, /不包含.*作品|作品.*不包含/s)
  assert.match(panel.textContent, /图片/)
  document.querySelector("[data-reader-data-export]").click()
  assert.equal(downloadedName, "Tuuru-reader-data.json")
  const exported = await readBlobText(downloadedBlob)
  assert.doesNotMatch(exported, /PRIVATE WORK BODY|private-work-password|YXZhdGFy|YXJ0aWNsZQ/)

  selectBackupFile(incomingPackage())
  await waitForFileRead()
  const preview = document.querySelector("[data-reader-data-preview]")
  assert.equal(preview.hidden, false)
  assert.equal(preview.querySelector("[data-reader-data-books]").textContent, "1")
  assert.equal(preview.querySelector("[data-reader-data-slots]").textContent, "1")
  assert.equal(document.querySelector("[data-reader-data-apply]").hidden, false)

  document.querySelector("[data-reader-data-apply]").click()
  const mergedLibrary = JSON.parse(localStorage.getItem(READER_LIBRARY_STORAGE_KEY))
  assert.deepEqual(mergedLibrary.books.map(book => book.id).sort(), ["backup-book", "current-book"])
  assert.deepEqual(JSON.parse(localStorage.getItem("moirain_profile")), {
    readerId:"Backup",
    bio:"Backup bio",
    readerAvatar:"data:image/png;base64,YXZhdGFy",
  })
  assert.equal(JSON.parse(localStorage.getItem("moirain_readerSettings")).fontSize, 19)
  assert.equal(
    JSON.parse(localStorage.getItem("moirain_readerSettings")).backgroundImage,
    "data:image/png;base64,YXJ0aWNsZQ==",
  )
  assert.match(document.querySelector("[data-reader-data-status]").textContent, /恢复|导入/)
})

test("reader data import rolls every storage key back when one write fails", async t => {
  installDom(t)
  seedCurrentReaderData()
  await import(`../reader/reader.js?reader-data-backup-rollback=${Date.now()}`)
  openBookshelf()
  document.querySelector("[data-reader-data-toggle]").click()
  selectBackupFile(incomingPackage())
  await waitForFileRead()

  const keys = [
    READER_LIBRARY_STORAGE_KEY,
    "moirain_profile",
    "moirain_placeholders",
    "moirain_readerSettings",
    "moirain_phoneCustom",
  ]
  const before = new Map(keys.map(key => [key, localStorage.getItem(key)]))
  const originalSetItem = Storage.prototype.setItem
  let failed = false
  Storage.prototype.setItem = function(key, value) {
    if (!failed && key === "moirain_phoneCustom") {
      failed = true
      throw new Error("quota")
    }
    return originalSetItem.call(this, key, value)
  }
  document.querySelector("[data-reader-data-apply]").click()
  Storage.prototype.setItem = originalSetItem

  keys.forEach(key => assert.equal(localStorage.getItem(key), before.get(key)))
  assert.match(document.querySelector("[data-reader-data-status]").textContent, /失败|空间/)
})

test("reader data controls stay compact and responsive", () => {
  assert.match(cssSource, /\.rd-bookshelf-head-actions\s*\{[^}]*display:flex/)
  assert.match(cssSource, /\.rd-reader-data-panel\s*\{[^}]*border-top:/)
  assert.match(cssSource, /\.rd-reader-data-toggle:focus-visible/)
  assert.match(cssSource, /@media\s*\(max-width:\s*480px\)[\s\S]*\.rd-bookshelf-head-actions/)
  assert.doesNotMatch(cssSource, /\.rd-reader-data-panel\s*\{[^}]*box-shadow:/)
})
