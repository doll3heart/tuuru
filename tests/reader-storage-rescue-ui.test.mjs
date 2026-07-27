import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function incomingWork() {
  return {
    schemaVersion:1,
    id:"incoming-work",
    type:"article",
    title:"新导入作品",
    author:"作者",
    password:"",
    placeholders:[],
    chapters:[{id:"chapter", name:"第一章"}],
    nodes:[{
      id:"start",
      chapterId:"chapter",
      title:"起点",
      content:"<p>需要保存的新正文</p>",
      choices:[],
    }],
    scenes:[],
    phoneModules:[],
    startNode:"start",
  }
}

function oldLibrary() {
  return {
    version:1,
    identities:[{
      id:"identity-old",
      name:"保留身份",
      values:{姓名:"小云"},
      createdAt:1,
      updatedAt:2,
    }],
    books:[{
      id:"old-work",
      type:"article",
      title:"很久没读的旧作",
      author:"旧作者",
      addedAt:1,
      lastOpenedAt:2,
      placeholderDefinitions:[],
      placeholderValues:{},
      slots:[{
        id:"slot-old",
        name:"",
        identityId:"identity-old",
        progress:{
          kind:"article",
          path:["old-start"],
          choiceMemory:{},
          interactionSelections:{},
          checkpoints:[],
          savedAt:3,
        },
        bookmarks:[{
          id:"bookmark-old",
          kind:"article",
          label:"旧书签",
          note:"",
          savedAt:4,
          path:["old-start"],
          choiceMemory:{},
          interactionSelections:{},
        }],
        createdAt:1,
        updatedAt:4,
      }],
      activeSlotId:"slot-old",
      completedAt:0,
    }],
  }
}

function quotaStorage({alwaysFailIncoming = false} = {}) {
  const oldCache = JSON.stringify({
    id:"old-work",
    type:"article",
    title:"很久没读的旧作",
    body:"x".repeat(12_000),
  })
  const values = new Map([
    ["moirain_readerLibrary", JSON.stringify(oldLibrary())],
    ["moirain_work_old-work", oldCache],
    ["sentinel", "preserve"],
  ])
  return {
    values,
    oldCache,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      if (
        key === "moirain_work_incoming-work"
        && (alwaysFailIncoming || values.has("moirain_work_old-work"))
      ) {
        const error = new Error("quota exceeded")
        error.name = "QuotaExceededError"
        throw error
      }
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

function installDom(t, storage) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
  })
  const alerts = []
  Object.assign(globalThis, {
    window:dom.window,
    document:dom.window.document,
    localStorage:storage,
    sessionStorage:dom.window.sessionStorage,
    Element:dom.window.Element,
    HTMLElement:dom.window.HTMLElement,
    Node:dom.window.Node,
    Event:dom.window.Event,
    MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    Blob:dom.window.Blob,
    alert:message => alerts.push(String(message)),
    requestAnimationFrame:callback => { callback(); return 1 },
  })
  t.after(() => dom.window.close())
  return {dom, alerts}
}

function openImportDialog() {
  document.querySelector('.rd-tab[data-tab="library"]').click()
  document.querySelector("[data-reader-open-import]").click()
}

function importSerializedWork(serialized) {
  globalThis.FileReader = class {
    readAsText() {
      this.result = serialized
      this.onload?.()
    }
    readAsDataURL() {
      throw new Error("unexpected PNG read")
    }
  }
  const input = document.getElementById("fileInput")
  Object.defineProperty(input, "files", {
    configurable:true,
    value:[{name:"incoming.json", size:serialized.length}],
  })
  input.dispatchEvent(new Event("change"))
}

test("quota rescue clears only selected old bodies and continues the pending import", async t => {
  const storage = quotaStorage()
  const {alerts} = installDom(t, storage)
  const serialized = JSON.stringify(incomingWork())
  await import(`../reader/reader.js?reader-storage-rescue-success=${Date.now()}`)
  openImportDialog()
  importSerializedWork(serialized)

  const rescue = document.querySelector("[data-reader-storage-rescue]")
  assert.ok(rescue)
  assert.ok(document.querySelector(".rd-import-dialog"))
  assert.match(rescue.textContent, /存储空间不足/)
  assert.match(rescue.textContent, /很久没读的旧作/)
  assert.match(rescue.textContent, /进度.*身份.*书签/s)
  const candidate = rescue.querySelector("[data-reader-rescue-work]")
  assert.equal(candidate.checked, true)
  assert.equal(rescue.querySelector("[data-reader-rescue-continue]").disabled, false)

  rescue.querySelector("[data-reader-rescue-continue]").click()

  assert.equal(document.querySelector(".rd-import-dialog"), null)
  assert.ok(document.getElementById("rdStartBtn"))
  assert.equal(storage.values.has("moirain_work_old-work"), false)
  assert.ok(storage.values.has("moirain_work_incoming-work"))
  const library = JSON.parse(storage.values.get("moirain_readerLibrary"))
  const oldBook = library.books.find(book => book.id === "old-work")
  assert.ok(oldBook)
  assert.equal(oldBook.slots[0].bookmarks[0].label, "旧书签")
  assert.equal(library.identities[0].name, "保留身份")
  assert.equal(storage.values.get("sentinel"), "preserve")
  assert.equal(alerts.length, 0)
})

test("quota rescue restores selected bodies when retry still cannot write", async t => {
  const storage = quotaStorage({alwaysFailIncoming:true})
  const {alerts} = installDom(t, storage)
  const serialized = JSON.stringify(incomingWork())
  await import(`../reader/reader.js?reader-storage-rescue-rollback=${Date.now()}`)
  openImportDialog()
  importSerializedWork(serialized)

  const rescue = document.querySelector("[data-reader-storage-rescue]")
  rescue.querySelector("[data-reader-rescue-continue]").click()

  assert.ok(document.querySelector(".rd-import-dialog"))
  assert.equal(storage.values.get("moirain_work_old-work"), storage.oldCache)
  assert.equal(storage.values.has("moirain_work_incoming-work"), false)
  assert.match(rescue.querySelector("[data-reader-rescue-status]").textContent, /仍然不足.*恢复/s)
  assert.equal(alerts.length, 0)
})

test("quota rescue styles stay flat, responsive, and keyboard-visible", async () => {
  const css = await import("node:fs").then(fs => fs.readFileSync(
    new URL("../reader/reader.css", import.meta.url),
    "utf8",
  ))
  assert.match(css, /\.rd-storage-rescue-list\s*\{[^}]*border-top:/)
  assert.match(css, /\.rd-storage-rescue-row:focus-within/)
  assert.match(css, /\.rd-storage-rescue-actions button:focus-visible/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.rd-storage-rescue-actions/)
  assert.doesNotMatch(css, /\.rd-storage-rescue\s*\{[^}]*box-shadow:/)
})
