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

function openNamedAppSettings(type) {
  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector(`.rd-app-icon[data-app="${type}"]`)
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

test("reader App color choices expose names and synchronize selection state", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-settings-colors=${Date.now()}`)

  openNamedAppSettings("messages")
  const group = document.querySelector(".cu-color-group")
  const buttons = [...group.querySelectorAll(".cu-color-btn")]
  const picker = group.querySelector(".cu-color-picker")

  assert.ok(buttons.length > 1)
  assert.equal(buttons.filter(button => button.getAttribute("aria-pressed") === "true").length, 1)
  buttons.forEach(button => {
    assert.equal(button.type, "button")
    assert.ok(button.getAttribute("aria-label"))
    assert.ok(button.querySelector('.cu-color-swatch[aria-hidden="true"]'))
    assert.ok(["true", "false"].includes(button.getAttribute("aria-pressed")))
  })
  assert.ok(picker.getAttribute("aria-label"))

  const previous = buttons.find(button => button.getAttribute("aria-pressed") === "true")
  const next = buttons.find(button => button !== previous)
  next.click()
  assert.equal(previous.getAttribute("aria-pressed"), "false")
  assert.equal(next.getAttribute("aria-pressed"), "true")
  assert.equal(next.classList.contains("active"), true)

  picker.value = "#123456"
  picker.dispatchEvent(new Event("input", { bubbles: true }))
  assert.equal(group.querySelector(".cu-color-btn.active"), null)
  assert.equal(buttons.every(button => button.getAttribute("aria-pressed") === "false"), true)

  next.click()
  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.selfBubbleBg, next.getAttribute("data-cu-self-bg"))
})

test("reader App color controls keep 44px targets and visible focus", () => {
  const buttonRule = cssBody(".cu-color-btn")
  const swatchRule = cssBody(".cu-color-swatch")
  const pickerRule = cssBody(".cu-color-picker")

  assert.match(buttonRule, /width:\s*44px;/)
  assert.match(buttonRule, /height:\s*44px;/)
  assert.doesNotMatch(buttonRule, /outline:\s*none;/)
  assert.match(swatchRule, /width:\s*26px;/)
  assert.match(swatchRule, /height:\s*26px;/)
  assert.match(pickerRule, /width:\s*44px;/)
  assert.match(pickerRule, /height:\s*44px;/)
  assert.match(
    readerCss,
    /\.cu-color-btn:focus-visible\s*,\s*\.cu-color-picker:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-primary-hover\);/,
  )
})
