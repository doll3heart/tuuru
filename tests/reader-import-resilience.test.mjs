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
  globalThis.localStorage = storage
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
