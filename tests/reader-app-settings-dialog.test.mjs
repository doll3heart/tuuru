import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t) {
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
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function cssBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return readerCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? ""
}

function openGallerySettings() {
  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector('.rd-app-icon[data-app="gallery"]')
  trigger.focus()
  trigger.click()
  return trigger
}

test("reader App settings behave as a modal dialog and restore focus", async t => {
  const dom = installDom(t)
  await import(`../reader/reader.js?reader-app-settings-dialog=${Date.now()}`)

  const trigger = openGallerySettings()
  const overlay = document.querySelector(".cu-modal-overlay")
  const dialog = overlay.querySelector(".cu-modal")
  const closeButton = overlay.querySelector("#cuModalClose")
  const title = document.getElementById(dialog.getAttribute("aria-labelledby"))

  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.equal(dialog.getAttribute("aria-modal"), "true")
  assert.ok(title)
  assert.match(title.textContent, /gallery|相册/i)
  assert.equal(closeButton.type, "button")
  assert.ok(closeButton.getAttribute("aria-label"))
  assert.equal(document.activeElement, closeButton)

  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
  const first = focusable[0]
  const last = focusable.at(-1)
  last.focus()
  last.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
  assert.equal(document.activeElement, first)
  first.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }))
  assert.equal(document.activeElement, last)

  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(document.activeElement, trigger)

  trigger.click()
  document.getElementById("cuModalSave").click()
  const replacementTrigger = document.querySelector('.rd-app-icon[data-app="gallery"]')
  assert.notEqual(replacementTrigger, trigger)
  assert.equal(document.activeElement, replacementTrigger)
})

test("reader App settings primary modal actions expose 44px targets", () => {
  const closeRule = cssBody(".cu-modal-close")
  const saveRule = cssBody(".cu-btn-save")
  const cancelRule = cssBody(".cu-btn-cancel")

  assert.match(closeRule, /min-width:\s*44px;/)
  assert.match(closeRule, /min-height:\s*44px;/)
  assert.match(saveRule, /min-height:\s*44px;/)
  assert.match(cancelRule, /min-height:\s*44px;/)
})

test("reader App settings stay retryable when local persistence fails", async t => {
  const alerts = []
  installDom(t)
  globalThis.alert = message => alerts.push(String(message))
  await import(`../reader/reader.js?reader-app-settings-storage=${Date.now()}`)

  openGallerySettings()
  const overlay = document.querySelector(".cu-modal-overlay")
  const nativeStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: nativeStorage.getItem.bind(nativeStorage),
    removeItem: nativeStorage.removeItem.bind(nativeStorage),
    setItem() {
      const error = new Error("quota exceeded")
      error.name = "QuotaExceededError"
      throw error
    },
  }
  t.after(() => { globalThis.localStorage = nativeStorage })

  const saveButton = document.getElementById("cuModalSave")
  saveButton.focus()
  assert.doesNotThrow(() => saveButton.onclick())
  assert.equal(overlay.isConnected, true)
  assert.equal(document.activeElement, saveButton)
  assert.equal(alerts.length, 1)
  assert.match(alerts[0], /保存|存储/)

  const resetButton = document.getElementById("cuAppReset")
  resetButton.focus()
  assert.doesNotThrow(() => resetButton.onclick())
  assert.equal(overlay.isConnected, true)
  assert.equal(document.activeElement, resetButton)
  assert.equal(alerts.length, 2)
  assert.match(alerts[1], /恢复默认|存储/)
})
