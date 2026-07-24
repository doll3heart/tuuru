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
  globalThis.Image = dom.window.Image
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

function setInputFiles(input, files) {
  Object.defineProperty(input, "files", { configurable: true, value: files })
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function flushAsyncImageWork() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function installFileReader(t, { result, fail = false }) {
  const NativeFileReader = globalThis.FileReader
  let reads = 0
  globalThis.FileReader = class {
    readAsDataURL() {
      const readIndex = reads
      reads += 1
      queueMicrotask(() => {
        const shouldFail = typeof fail === "function" ? fail(readIndex) : fail
        if (shouldFail) this.onerror?.(new Event("error"))
        else {
          this.result = typeof result === "function" ? result(readIndex) : result
          this.onload?.({ target: this })
        }
      })
    }
  }
  t.after(() => { globalThis.FileReader = NativeFileReader })
  return () => reads
}

function installImageDecoder(t, { fail = false, width = 32, height = 24, controlled = false } = {}) {
  const NativeImage = globalThis.Image
  const pending = []
  globalThis.Image = class {
    constructor() {
      this.naturalWidth = width
      this.naturalHeight = height
      this.settled = false
    }
    set src(value) {
      this._src = value
      if (controlled) {
        pending.push(this)
        return
      }
      queueMicrotask(() => {
        if (fail) this.onerror?.()
        else this.onload?.()
      })
    }
    get src() {
      return this._src
    }
  }
  t.after(() => { globalThis.Image = NativeImage })

  function imageAt(index) {
    const image = pending[index]
    assert.ok(image, `expected pending Image at index ${index}`)
    assert.equal(image.settled, false, `Image at index ${index} already settled`)
    image.settled = true
    return image
  }

  return {
    pending,
    succeed(index = 0, dimensions = {}) {
      const image = imageAt(index)
      image.naturalWidth = dimensions.width ?? image.naturalWidth
      image.naturalHeight = dimensions.height ?? image.naturalHeight
      image.onload?.()
    },
    reject(index = 0) {
      imageAt(index).onerror?.()
    },
  }
}

function rasterDataUrl(mime, binary) {
  return `data:${mime};base64,${Buffer.from(binary, "binary").toString("base64")}`
}

const staticRasterCases = [
  ["image/png", rasterDataUrl("image/png", "\x89PNG\r\n\x1a\n")],
  ["image/jpeg", rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0")],
  ["image/webp", rasterDataUrl("image/webp", "RIFF\x04\x00\x00\x00WEBP")],
]

const animatedWebp = rasterDataUrl(
  "image/webp",
  "RIFF\x0c\x00\x00\x00WEBPANIM\x00\x00\x00\x00",
)
const animatedWebpFrame = rasterDataUrl(
  "image/webp",
  "RIFF\x0c\x00\x00\x00WEBPANMF\x00\x00\x00\x00",
)
const animatedPng = rasterDataUrl(
  "image/png",
  "\x89PNG\r\n\x1a\n\x00\x00\x00\x00acTL\x00\x00\x00\x00",
)
const malformedPngChunk = rasterDataUrl(
  "image/png",
  "\x89PNG\r\n\x1a\n\x00\x00\x00\x04IDATxx",
)
const malformedWebpLength = rasterDataUrl(
  "image/webp",
  "RIFF\x04\x00\x00\x00WEBPJUNK",
)
const malformedWebpHeader = rasterDataUrl(
  "image/webp",
  "RIFF\x08\x00\x00\x00WEBPJUNK",
)
const malformedWebpPadding = rasterDataUrl(
  "image/webp",
  "RIFF\x0d\x00\x00\x00WEBPVP8 \x01\x00\x00\x00x",
)

function oversizedPngDataUrl() {
  const bytes = Buffer.alloc((2 * 1024 * 1024) + 1)
  Buffer.from("\x89PNG\r\n\x1a\n", "binary").copy(bytes)
  return `data:image/png;base64,${bytes.toString("base64")}`
}

function rawPresetStorage(preset = "rose") {
  return `{"marker":"preserve exact bytes","appSettings":{"messages":{"selfBubbleBg":"#123456","callBackgroundType":"preset","callBackgroundPreset":"${preset}","callBackgroundImage":null}}}`
}

function assertRetryableUploadFailure(beforeRaw, preset = "rose") {
  const overlay = document.querySelector(".cu-modal-overlay")
  const error = document.getElementById("cuCallBackgroundError")
  assert.equal(overlay?.isConnected, true)
  assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, preset)
  assert.doesNotMatch(document.querySelector("#cuCallBackgroundPreview").getAttribute("style") || "", /--rd-call-image/)
  assert.equal(error.hidden, false)
  assert.ok(error.textContent.trim())
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
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

test("reader App appearance previews the real App shell and scopes live CSS", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-real-preview=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("browser")
  const dialog = document.querySelector(".cu-modal")
  const preview = document.getElementById("cuPreview")
  const cssInput = document.getElementById("cuAppCustomCss")
  const saveButton = document.getElementById("cuModalSave")

  assert.equal(dialog.classList.contains("app-appearance-workbench"), true)
  assert.ok(preview.querySelector(".phone-frame.reader-app-preview-frame"))
  assert.ok(preview.querySelector(".rd-phone-app-panel.rd-phone-app-browser.reader-app-preview-scope"))
  assert.ok(preview.querySelector(".rd-browser-history"))
  assert.ok(preview.querySelector(".rd-browser-address"))
  assert.ok(preview.querySelector(".rd-browser-entry"))
  assert.equal(preview.querySelector(".cu-preview-browser"), null)
  assert.ok(cssInput)

  cssInput.value = ".rd-browser-title { letter-spacing: .08em; }"
  cssInput.dispatchEvent(new Event("input", { bubbles: true }))
  const previewStyle = document.getElementById("reader-app-preview-user-css")
  assert.match(previewStyle.textContent, /\.reader-app-preview-scope\s+\.rd-browser-title/)
  assert.equal(saveButton.disabled, false)

  cssInput.value = ".rd-browser-title { position: fixed; }"
  cssInput.dispatchEvent(new Event("input", { bubbles: true }))
  assert.equal(saveButton.disabled, true)

  cssInput.value = ".rd-browser-title { letter-spacing: .08em; }"
  cssInput.dispatchEvent(new Event("input", { bubbles: true }))
  saveButton.click()

  const stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.appSettings.browser.customCss, ".rd-browser-title { letter-spacing: .08em; }")
  const runtimeStyle = document.getElementById("reader-app-browser-user-css")
  assert.match(runtimeStyle.textContent, /\.rd-phone-app-browser\s+\.rd-browser-title/)
})

test("every reader App appearance preview uses its runtime component vocabulary", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-preview-vocabulary=${Date.now()}-${Math.random()}`)

  const expectedComponents = {
    messages: ".rd-chat-message",
    forum: ".rd-post-card",
    memo: ".rd-memo-note",
    gallery: ".rd-gallery-photo",
    browser: ".rd-browser-entry",
    shopping: ".shop-card-block",
    contacts: ".rd-contact-entry",
  }

  for (const [type, selector] of Object.entries(expectedComponents)) {
    openNamedAppSettings(type)
    const preview = document.getElementById("cuPreview")
    assert.ok(preview.querySelector(`.reader-app-preview-scope.rd-phone-app-${type}`), `${type} uses the real App shell`)
    assert.ok(preview.querySelector(selector), `${type} uses ${selector}`)
    document.getElementById("cuModalCancel").click()
  }
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

test("call background presets appear only in Messages and default safely", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      selfBubbleBg: "#123456",
      callBackgroundType: "script",
      callBackgroundPreset: "unknown",
      callBackgroundImage: "javascript:alert(1)",
    } },
  }))
  await import(`../reader/reader.js?call-background-defaults=${Date.now()}`)

  openNamedAppSettings("messages")
  const presets = [...document.querySelectorAll(".cu-call-background-preset")]
  assert.equal(presets.length, 4)
  assert.equal(presets.filter(button => button.getAttribute("aria-pressed") === "true").length, 1)
  assert.equal(presets.find(button => button.getAttribute("aria-pressed") === "true").dataset.cuCallBackgroundPreset, "plain")
  assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "plain")
  const callBackgroundCard = document.getElementById("cuCallBackgroundCard")
  const callBackgroundFile = callBackgroundCard.querySelector("#cuCallBackgroundFile")
  assert.equal(callBackgroundFile.type, "file")
  assert.equal(callBackgroundFile.accept, "image/png,image/jpeg,image/webp")
  assert.equal(callBackgroundCard.querySelector('input[type="url"], input[type="text"]'), null)
  document.getElementById("cuModalCancel").click()

  openNamedAppSettings("gallery")
  assert.equal(document.querySelector("#cuCallBackgroundCard"), null)
})

test("primitive and array-shaped phone customization cannot break settings", async t => {
  installDom(t)
  await import(`../reader/reader.js?call-background-corrupt-shapes=${Date.now()}`)

  const corruptValues = [
    "bad",
    [],
    { appSettings: "bad", customIcons: 42 },
    { appSettings: [], customIcons: [] },
  ]
  for (const value of corruptValues) {
    localStorage.setItem("moirain_phoneCustom", JSON.stringify(value))
    assert.doesNotThrow(() => openNamedAppSettings("messages"))
    assert.equal(
      document.querySelector('.cu-call-background-preset[aria-pressed="true"]').dataset.cuCallBackgroundPreset,
      "plain",
    )
    document.getElementById("cuModalCancel").click()
  }
})

test("magic customization keys cannot poison defensive settings copies", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", '{"__proto__":{"wallpaper":"#000000"},"hasOwnProperty":"blocked","customIcons":{"__proto__":{"messages":"prototype-icon"},"gallery":"kept-icon"},"appSettings":{"__proto__":{"messages":{"callBackgroundPreset":"water"}},"messages":{"__proto__":{"callBackgroundPreset":"rose"},"selfBubbleBg":"#123456","keptField":"kept"},"gallery":{"columns":2}}}')
  await import(`../reader/reader.js?call-background-magic-keys=${Date.now()}`)

  openNamedAppSettings("messages")
  assert.equal(document.querySelector('#cuIconUrl').value, "")
  assert.equal(
    document.querySelector('.cu-call-background-preset[aria-pressed="true"]').dataset.cuCallBackgroundPreset,
    "plain",
  )
  document.querySelector('[data-cu-call-background-preset="cream"]').click()
  document.getElementById("cuModalSave").click()
  assert.equal(document.querySelector(".cu-modal-overlay"), null)

  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.hasOwnProperty, "blocked")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "cream")
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
  assert.equal(saved.appSettings.messages.keptField, "kept")
  assert.equal(saved.appSettings.gallery.columns, 2)
  assert.equal(saved.customIcons.gallery, "kept-icon")
  assert.equal(Object.prototype.hasOwnProperty.call(saved.customIcons, "messages"), false)
})

test("call preset changes stay draft-only until Save and Cancel preserves raw storage", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    customIcons: { messages: "data:image/png;base64,AA==" },
    appSettings: { messages: { selfBubbleBg: "#123456" } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?call-background-draft=${Date.now()}`)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-call-background-preset="water"]').click()
  assert.equal(document.querySelector('#cuCallBackgroundPreview').dataset.callBackground, "water")
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  document.getElementById("cuModalCancel").click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-call-background-preset="rose"]').click()
  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "preset")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "rose")
  assert.equal(saved.appSettings.messages.callBackgroundImage, null)
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
  assert.equal(saved.customIcons.messages, "data:image/png;base64,AA==")
})

test("all non-Save call background dismissals preserve raw storage", async t => {
  const dom = installDom(t)
  const originalRaw = JSON.stringify({
    customIcons: { messages: "kept-icon" },
    appSettings: { messages: {
      selfBubbleBg: "#123456",
      callBackgroundType: "preset",
      callBackgroundPreset: "rose",
      callBackgroundImage: null,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", originalRaw)
  await import(`../reader/reader.js?call-background-dismissals=${Date.now()}`)

  const dismissalCases = [
    {
      name: "Close",
      dismiss() { document.getElementById("cuModalClose").click() },
    },
    {
      name: "Escape",
      dismiss() {
        document.querySelector(".cu-modal").dispatchEvent(new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }))
      },
    },
    {
      name: "overlay click",
      dismiss() {
        const overlay = document.querySelector(".cu-modal-overlay")
        overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
      },
    },
  ]

  for (const dismissal of dismissalCases) {
    openNamedAppSettings("messages")
    assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "rose")
    document.querySelector('[data-cu-call-background-preset="water"]').click()
    assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "water")
    assert.equal(localStorage.getItem("moirain_phoneCustom"), originalRaw)

    dismissal.dismiss()

    assert.equal(document.querySelector(".cu-modal-overlay"), null, `${dismissal.name} closes the modal`)
    assert.equal(localStorage.getItem("moirain_phoneCustom"), originalRaw, `${dismissal.name} preserves storage`)
  }
})

test("Restore Default changes only the call background draft", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    customIcons: { messages: "kept-icon" },
    appSettings: { messages: {
      selfBubbleBg: "#123456",
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: "data:image/png;base64,AA==",
    } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?call-background-restore=${Date.now()}`)

  openNamedAppSettings("messages")
  document.getElementById("cuCallBackgroundRestore").click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  assert.equal(document.querySelector('#cuCallBackgroundPreview').dataset.callBackground, "plain")
  document.getElementById("cuModalSave").click()

  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "preset")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "plain")
  assert.equal(saved.appSettings.messages.callBackgroundImage, null)
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
  assert.equal(saved.customIcons.messages, "kept-icon")
})

test("call background controls keep 44px targets and visible focus", () => {
  assert.match(
    readerCss,
    /\.cu-call-background-preset\s*,\s*\.cu-call-background-actions button\s*\{[^}]*min-height:\s*44px;/,
  )
  assert.match(
    readerCss,
    /\.cu-call-background-preset:focus-visible\s*,\s*\.cu-call-background-actions button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-primary-hover\);/,
  )
})

for (const [mime, dataUrl] of staticRasterCases) {
  test(`validated ${mime} upload stays draft-only until Save`, async t => {
    installDom(t)
    const beforeRaw = rawPresetStorage("rose")
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    const reads = installFileReader(t, { result: dataUrl })
    installImageDecoder(t)
    await import(`../reader/reader.js?call-background-upload-success=${encodeURIComponent(mime)}-${Date.now()}-${Math.random()}`)

    openNamedAppSettings("messages")
    const save = document.getElementById("cuModalSave")
    setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
      name: `background.${mime.split("/")[1]}`,
      type: mime,
      size: 128,
    }])
    assert.equal(save.disabled, true, "Save is disabled while decode is pending")
    assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "rose")
    assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

    await flushAsyncImageWork()
    await flushAsyncImageWork()

    const preview = document.querySelector("#cuCallBackgroundPreview")
    assert.equal(reads(), 1)
    assert.equal(save.disabled, false)
    assert.equal(preview.dataset.callBackground, "image")
    assert.match(preview.getAttribute("style") || "", /--rd-call-image/)
    assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

    save.click()
    const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
    assert.equal(saved.appSettings.messages.callBackgroundType, "image")
    assert.equal(saved.appSettings.messages.callBackgroundPreset, "rose")
    assert.equal(saved.appSettings.messages.callBackgroundImage, dataUrl)
  })
}

const rejectedBeforeRead = [
  { name: "vector.svg", type: "image/svg+xml", size: 100 },
  { name: "animated.gif", type: "image/gif", size: 100 },
  { name: "nonstandard.jpg", type: "image/jpg", size: 100 },
  { name: "unknown.bin", type: "", size: 100 },
  { name: "large.png", type: "image/png", size: (2 * 1024 * 1024) + 1 },
]

for (const rejectedFile of rejectedBeforeRead) {
  test(`rejects ${rejectedFile.name} before FileReader`, async t => {
    installDom(t)
    const beforeRaw = rawPresetStorage("rose")
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    const reads = installFileReader(t, { result: staticRasterCases[0][1] })
    const decoder = installImageDecoder(t, { controlled: true })
    await import(`../reader/reader.js?call-background-before-read=${encodeURIComponent(rejectedFile.name)}-${Date.now()}-${Math.random()}`)

    openNamedAppSettings("messages")
    setInputFiles(document.getElementById("cuCallBackgroundFile"), [rejectedFile])
    await flushAsyncImageWork()
    await flushAsyncImageWork()

    assert.equal(reads(), 0)
    assert.equal(decoder.pending.length, 0)
    assertRetryableUploadFailure(beforeRaw)
  })
}

const rejectedDataUrlCases = [
  {
    name: "a MIME-mismatched JPEG result for a PNG file",
    fileType: "image/png",
    dataUrl: staticRasterCases[1][1],
  },
  {
    name: "an image/jpg data URL",
    fileType: "image/jpeg",
    dataUrl: rasterDataUrl("image/jpg", "\xff\xd8\xff\xe0"),
  },
  {
    name: "a non-canonical uppercase MIME data URL",
    fileType: "image/png",
    dataUrl: rasterDataUrl("IMAGE/PNG", "\x89PNG\r\n\x1a\n"),
  },
  {
    name: "a remote URL",
    fileType: "image/png",
    dataUrl: "https://example.com/background.png",
  },
  {
    name: "malformed base64",
    fileType: "image/png",
    dataUrl: "data:image/png;base64,%%%",
  },
  {
    name: "a PNG MIME with a JPEG signature",
    fileType: "image/png",
    dataUrl: rasterDataUrl("image/png", "\xff\xd8\xff\xe0"),
  },
  {
    name: "APNG acTL content",
    fileType: "image/png",
    dataUrl: animatedPng,
  },
  {
    name: "animated WebP ANIM content",
    fileType: "image/webp",
    dataUrl: animatedWebp,
  },
  {
    name: "animated WebP ANMF content",
    fileType: "image/webp",
    dataUrl: animatedWebpFrame,
  },
  {
    name: "a PNG with an incomplete chunk payload and CRC",
    fileType: "image/png",
    dataUrl: malformedPngChunk,
  },
  {
    name: "a WebP whose RIFF length omits trailing bytes",
    fileType: "image/webp",
    dataUrl: malformedWebpLength,
  },
  {
    name: "a WebP with an incomplete trailing chunk header",
    fileType: "image/webp",
    dataUrl: malformedWebpHeader,
  },
  {
    name: "a WebP with missing odd-byte padding",
    fileType: "image/webp",
    dataUrl: malformedWebpPadding,
  },
  {
    name: "a post-read data URL over 2 MiB",
    fileType: "image/png",
    dataUrl: oversizedPngDataUrl(),
  },
]

for (const scenario of rejectedDataUrlCases) {
  test(`rejects ${scenario.name} without changing the draft`, async t => {
    installDom(t)
    const beforeRaw = rawPresetStorage("rose")
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    const reads = installFileReader(t, { result: scenario.dataUrl })
    const decoder = installImageDecoder(t, { controlled: true })
    await import(`../reader/reader.js?call-background-data-reject=${encodeURIComponent(scenario.name)}-${Date.now()}-${Math.random()}`)

    openNamedAppSettings("messages")
    setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
      name: "candidate",
      type: scenario.fileType,
      size: 100,
    }])
    await flushAsyncImageWork()
    await flushAsyncImageWork()

    assert.equal(reads(), 1)
    assert.equal(decoder.pending.length, 0, "static validation rejects before Image decode")
    assertRetryableUploadFailure(beforeRaw)
  })
}

test("FileReader errors preserve the current draft and exact storage", async t => {
  installDom(t)
  const beforeRaw = rawPresetStorage("rose")
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  const reads = installFileReader(t, { result: staticRasterCases[0][1], fail: true })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-file-reader-error=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
    name: "read-error.png",
    type: "image/png",
    size: 100,
  }])
  await flushAsyncImageWork()
  await flushAsyncImageWork()

  assert.equal(reads(), 1)
  assert.equal(decoder.pending.length, 0)
  assertRetryableUploadFailure(beforeRaw)
})

const decoderFailureCases = [
  { name: "Image decode error", decoder: { fail: true } },
  { name: "zero naturalWidth", decoder: { width: 0, height: 24 } },
  { name: "zero naturalHeight", decoder: { width: 32, height: 0 } },
]

for (const scenario of decoderFailureCases) {
  test(`${scenario.name} preserves the current upload draft and exact storage`, async t => {
    installDom(t)
    const beforeRaw = rawPresetStorage("rose")
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    installFileReader(t, { result: staticRasterCases[0][1] })
    installImageDecoder(t, scenario.decoder)
    await import(`../reader/reader.js?call-background-decode-reject=${encodeURIComponent(scenario.name)}-${Date.now()}-${Math.random()}`)

    openNamedAppSettings("messages")
    setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
      name: "decode.png",
      type: "image/png",
      size: 100,
    }])
    await flushAsyncImageWork()
    await flushAsyncImageWork()

    assertRetryableUploadFailure(beforeRaw)
  })
}

test("persisted images stay preset-only until canonical current-session decode succeeds", async t => {
  installDom(t)
  const canonicalUrl = staticRasterCases[0][1]
  const beforeRaw = JSON.stringify({
    marker: "raw persisted image",
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: `  ${canonicalUrl}  `,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-persisted-pending=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const save = document.getElementById("cuModalSave")
  let preview = document.getElementById("cuCallBackgroundPreview")
  assert.equal(decoder.pending.length, 1)
  assert.equal(decoder.pending[0].src, canonicalUrl, "Image receives the one canonical trimmed URL")
  assert.equal(save.disabled, true)
  assert.equal(preview.dataset.callBackground, "water")
  assert.doesNotMatch(preview.outerHTML, /--rd-call-image|data:image/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  decoder.succeed()
  await flushAsyncImageWork()
  preview = document.getElementById("cuCallBackgroundPreview")
  assert.equal(save.disabled, false)
  assert.equal(preview.dataset.callBackground, "image")
  assert.match(preview.getAttribute("style") || "", /--rd-call-image/)
  assert.match(preview.getAttribute("style") || "", new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.getElementById("cuModalCancel").click()
  openNamedAppSettings("messages")
  preview = document.getElementById("cuCallBackgroundPreview")
  assert.equal(decoder.pending.length, 1, "verified canonical URL is reused from the session Set")
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  assert.equal(preview.dataset.callBackground, "image")
})

const invalidPersistedCandidates = [
  ["APNG", animatedPng],
  ["animated WebP", animatedWebp],
  ["malformed WebP", malformedWebpPadding],
  ["oversized PNG", oversizedPngDataUrl()],
]

for (const [name, dataUrl] of invalidPersistedCandidates) {
  test(`persisted ${name} stays on the safe preset and reports a retryable error`, async t => {
    installDom(t)
    const beforeRaw = JSON.stringify({
      marker: `persisted ${name}`,
      appSettings: { messages: {
        callBackgroundType: "image",
        callBackgroundPreset: "water",
        callBackgroundImage: dataUrl,
      } },
    })
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    const decoder = installImageDecoder(t, { controlled: true })
    await import(`../reader/reader.js?call-background-persisted-invalid=${encodeURIComponent(name)}-${Date.now()}-${Math.random()}`)

    openNamedAppSettings("messages")
    await flushAsyncImageWork()
    await flushAsyncImageWork()

    const preview = document.getElementById("cuCallBackgroundPreview")
    const error = document.getElementById("cuCallBackgroundError")
    assert.equal(decoder.pending.length, 0)
    assert.equal(preview.dataset.callBackground, "water")
    assert.doesNotMatch(preview.outerHTML, /--rd-call-image|data:image/)
    assert.equal(error.hidden, false)
    assert.ok(error.textContent.trim())
    assert.equal(document.getElementById("cuModalSave").disabled, false)
    assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  })
}

test("persisted Image failure keeps storage exact and leaves a usable safe-preset draft", async t => {
  installDom(t)
  const dataUrl = staticRasterCases[0][1]
  const beforeRaw = JSON.stringify({
    marker: "persisted decode error",
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "cream",
      callBackgroundImage: dataUrl,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-persisted-decode-error=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  assert.equal(document.getElementById("cuModalSave").disabled, true)
  decoder.reject()
  await flushAsyncImageWork()

  const preview = document.getElementById("cuCallBackgroundPreview")
  assert.equal(preview.dataset.callBackground, "cream")
  assert.doesNotMatch(preview.outerHTML, /--rd-call-image|data:image/)
  assert.equal(document.getElementById("cuCallBackgroundError").hidden, false)
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  assert.equal(document.querySelector(".cu-modal-overlay").isConnected, true)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("a preset selection invalidates never-settling persisted verification", async t => {
  installDom(t)
  const dataUrl = staticRasterCases[0][1]
  const beforeRaw = JSON.stringify({
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: dataUrl,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-persisted-stale=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const save = document.getElementById("cuModalSave")
  assert.equal(save.disabled, true)
  document.querySelector('[data-cu-call-background-preset="cream"]').click()
  assert.equal(save.disabled, false, "recovery must not wait for the old decoder")
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "cream")

  decoder.succeed()
  await flushAsyncImageWork()
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "cream")
  assert.doesNotMatch(document.getElementById("cuCallBackgroundPreview").outerHTML, /--rd-call-image|data:image/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("Restore Default invalidates a pending upload and re-enables Save", async t => {
  installDom(t)
  const beforeRaw = rawPresetStorage("rose")
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  installFileReader(t, { result: staticRasterCases[0][1] })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-upload-restore-race=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
    name: "pending.png",
    type: "image/png",
    size: 100,
  }])
  await flushAsyncImageWork()
  assert.equal(decoder.pending.length, 1)
  assert.equal(document.getElementById("cuModalSave").disabled, true)

  document.getElementById("cuCallBackgroundRestore").click()
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "plain")
  decoder.succeed()
  await flushAsyncImageWork()

  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "plain")
  assert.doesNotMatch(document.getElementById("cuCallBackgroundPreview").outerHTML, /--rd-call-image|data:image/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("failed replacement upload cannot expose an unverified persisted image to Save", async t => {
  installDom(t)
  const persistedUrl = staticRasterCases[0][1]
  const replacementUrl = rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0R")
  const beforeRaw = JSON.stringify({
    marker: "unverified persisted candidate",
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: persistedUrl,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  installFileReader(t, { result: replacementUrl })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-persisted-upload-failure=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  assert.equal(decoder.pending.length, 1, "persisted decode is pending")
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "water")
  assert.equal(document.getElementById("cuModalSave").disabled, true)

  setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
    name: "replacement.jpg",
    type: "image/jpeg",
    size: 100,
  }])
  await flushAsyncImageWork()
  assert.deepEqual(decoder.pending.map(image => image.src), [persistedUrl, replacementUrl])
  decoder.reject(1)
  await flushAsyncImageWork()

  assert.equal(document.getElementById("cuModalSave").disabled, false)
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "water")
  assert.doesNotMatch(document.getElementById("cuCallBackgroundPreview").outerHTML, /--rd-call-image|data:image/)
  assert.equal(document.getElementById("cuCallBackgroundError").hidden, false)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "preset")
  assert.equal(saved.appSettings.messages.callBackgroundPreset, "water")
  assert.equal(saved.appSettings.messages.callBackgroundImage, null)

  decoder.succeed(0)
  await flushAsyncImageWork()
  assert.equal(JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages.callBackgroundType, "preset")
})

test("invalidating a pending upload still permits immediate same-file retry", async t => {
  installDom(t)
  const firstUrl = rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0A")
  const secondUrl = rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0B")
  const beforeRaw = rawPresetStorage("rose")
  const sameFile = { name: "same.jpg", type: "image/jpeg", size: 100 }
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  const reads = installFileReader(t, { result: index => [firstUrl, secondUrl][index] })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-same-file-retry=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const input = document.getElementById("cuCallBackgroundFile")
  Object.defineProperty(input, "value", {
    configurable: true,
    writable: true,
    value: "C:\\fakepath\\same.jpg",
  })

  setInputFiles(input, [sameFile])
  assert.equal(input.value, "", "capturing the File immediately resets native same-file suppression")
  await flushAsyncImageWork()
  assert.equal(reads(), 1)
  assert.equal(decoder.pending.length, 1)

  document.getElementById("cuCallBackgroundRestore").click()
  input.value = "C:\\fakepath\\same.jpg"
  setInputFiles(input, [sameFile])
  assert.equal(input.value, "")
  await flushAsyncImageWork()
  assert.equal(reads(), 2, "the same File can start a newer operation")
  assert.deepEqual(decoder.pending.map(image => image.src), [firstUrl, secondUrl])

  decoder.succeed(1)
  await flushAsyncImageWork()
  assert.ok((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(secondUrl))
  decoder.succeed(0)
  await flushAsyncImageWork()
  assert.ok((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(secondUrl))
  assert.equal((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(firstUrl), false)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("only the latest upload may replace the draft when decodes finish out of order", async t => {
  installDom(t)
  const firstUrl = rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0A")
  const secondUrl = rasterDataUrl("image/jpeg", "\xff\xd8\xff\xe0B")
  const beforeRaw = rawPresetStorage("rose")
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  installFileReader(t, { result: index => [firstUrl, secondUrl][index] })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-upload-order=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const input = document.getElementById("cuCallBackgroundFile")
  setInputFiles(input, [{ name: "first.jpg", type: "image/jpeg", size: 100 }])
  await flushAsyncImageWork()
  setInputFiles(input, [{ name: "second.jpg", type: "image/jpeg", size: 100 }])
  await flushAsyncImageWork()
  assert.deepEqual(decoder.pending.map(image => image.src), [firstUrl, secondUrl])

  decoder.succeed(1)
  await flushAsyncImageWork()
  assert.equal(document.getElementById("cuCallBackgroundPreview").dataset.callBackground, "image")
  assert.ok((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(secondUrl))
  decoder.succeed(0)
  await flushAsyncImageWork()
  assert.ok((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(secondUrl))
  assert.equal((document.getElementById("cuCallBackgroundPreview").getAttribute("style") || "").includes(firstUrl), false)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundImage, secondUrl)
})

test("a dismissed modal ignores a late successful upload", async t => {
  installDom(t)
  const beforeRaw = rawPresetStorage("rose")
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  installFileReader(t, { result: staticRasterCases[0][1] })
  const decoder = installImageDecoder(t, { controlled: true })
  await import(`../reader/reader.js?call-background-upload-dismissed=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
    name: "late.png",
    type: "image/png",
    size: 100,
  }])
  await flushAsyncImageWork()
  document.getElementById("cuModalCancel").click()
  assert.equal(document.querySelector(".cu-modal-overlay"), null)

  decoder.succeed()
  await flushAsyncImageWork()
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("call image storage failure keeps the same modal, draft, raw storage, and retry path", async t => {
  const alerts = []
  installDom(t)
  globalThis.alert = message => alerts.push(String(message))
  const beforeRaw = rawPresetStorage("rose")
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  installFileReader(t, { result: staticRasterCases[0][1] })
  installImageDecoder(t)
  await import(`../reader/reader.js?call-background-storage-retry=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  setInputFiles(document.getElementById("cuCallBackgroundFile"), [{
    name: "valid.png",
    type: "image/png",
    size: 100,
  }])
  await flushAsyncImageWork()
  await flushAsyncImageWork()
  const previewStyle = document.getElementById("cuCallBackgroundPreview").getAttribute("style")

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

  const save = document.getElementById("cuModalSave")
  save.click()
  assert.equal(document.querySelector(".cu-modal-overlay").isConnected, true)
  assert.equal(document.activeElement, save)
  assert.equal(document.getElementById("cuCallBackgroundPreview").getAttribute("style"), previewStyle)
  assert.equal(document.getElementById("cuCallBackgroundError").hidden, false)
  assert.ok(document.getElementById("cuCallBackgroundError").textContent.trim())
  assert.equal(nativeStorage.getItem("moirain_phoneCustom"), beforeRaw)
  assert.equal(alerts.length, 1)

  globalThis.localStorage = nativeStorage
  save.click()
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  const saved = JSON.parse(nativeStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.callBackgroundType, "image")
  assert.equal(saved.appSettings.messages.callBackgroundImage, staticRasterCases[0][1])
})
