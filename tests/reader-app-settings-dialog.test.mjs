import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const sharedChatCss = readFileSync(new URL("../css/phone-chat.css", import.meta.url), "utf8")

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

function sharedChatCssBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return sharedChatCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? ""
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
  assert.equal(document.getElementById("cuModalSave").disabled, true)
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
  const galleryGap = document.getElementById("cuGap")
  galleryGap.value = "8"
  galleryGap.dispatchEvent(new Event("input", { bubbles:true }))
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
  const galleryGap = document.getElementById("cuGap")
  galleryGap.value = "8"
  galleryGap.dispatchEvent(new Event("input", { bubbles:true }))
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
  assert.equal(alerts.length, 1)
  assert.equal(saveButton.disabled, true)
})

test("reader message appearance uses only named native color pickers", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-settings-colors=${Date.now()}`)

  openNamedAppSettings("messages")
  const groups = [...document.querySelectorAll(".cu-settings-section .cu-color-group")]
  const picker = document.querySelector('[data-cu-self-bg-picker]')

  assert.ok(groups.length > 0)
  assert.equal(groups.every(group => group.querySelectorAll(".cu-color-btn").length === 0), true)
  assert.equal(groups.every(group => group.querySelectorAll(".cu-color-picker").length === 1), true)
  assert.ok(picker.getAttribute("aria-label"))

  picker.value = "#123456"
  picker.dispatchEvent(new Event("input", { bubbles: true }))
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-pink"), "#123456")

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.selfBubbleBg, "#123456")
})

test("reader messages can preview, save, and clear a local chat background image", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  installFileReader(t, {result:imageUrl})
  installImageDecoder(t)
  await import(`../reader/reader.js?reader-chat-background-image=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  const fileInput = document.getElementById("cuChatBackgroundFile")
  assert.ok(document.getElementById("cuChatBackgroundUpload"))
  assert.ok(document.getElementById("cuChatBackgroundClear"))
  assert.ok(fileInput)

  setInputFiles(fileInput, [{type:"image/png", size:8}])
  await flushAsyncImageWork()
  await flushAsyncImageWork()

  const previewChat = document.querySelector(".rd-app-preview-chat")
  assert.match(previewChat.style.getPropertyValue("--chat-editor-image"), /^url\(/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.getElementById("cuModalSave").click()
  let saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.chatBgImage, imageUrl)

  openNamedAppSettings("messages")
  document.getElementById("cuChatBackgroundClear").click()
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-image"), "none")
  document.getElementById("cuModalSave").click()
  saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.chatBgImage, null)
})

test("reader message appearance previews and saves bubble weight and reply button color", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-message-weight-and-button=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const weightButtons = [...document.querySelectorAll("[data-cu-bubble-weight]")]
  const boldButton = document.querySelector('[data-cu-bubble-weight="800"]')
  const buttonColor = document.querySelector('[data-cu-send-bg-picker]')
  assert.deepEqual(weightButtons.map(button => Number(button.dataset.cuBubbleWeight)), [400, 500, 800])
  assert.ok(boldButton)
  assert.ok(buttonColor)

  boldButton.click()
  buttonColor.value = "#285c4d"
  buttonColor.dispatchEvent(new Event("input", { bubbles: true }))

  const previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(previewChat.style.getPropertyValue("--chat-bubble-weight"), "800")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-bg"), "#285c4d")

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.messages.bubbleFontWeight, 800)
  assert.equal(saved.appSettings.messages.sendButtonBg, "#285c4d")
})

test("reader message bottom actions expose custom input colors, radius, and a CSS shortcut", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-message-composer=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const autoToggle = document.getElementById("cuComposerAutoReadability")
  const barColor = document.querySelector("[data-cu-composer-bg-picker]")
  const inputColor = document.querySelector("[data-cu-composer-input-bg-picker]")
  const textColor = document.querySelector("[data-cu-composer-input-text-picker]")
  const borderColor = document.querySelector("[data-cu-composer-input-border-picker]")
  const radius = document.getElementById("cuComposerInputRadius")
  const cssShortcut = document.getElementById("cuMessageActionsCss")

  assert.equal(autoToggle.checked, true)
  assert.ok(barColor)
  assert.ok(inputColor)
  assert.ok(textColor)
  assert.ok(borderColor)
  assert.equal(radius.value, "2")
  assert.ok(cssShortcut)

  autoToggle.click()
  barColor.value = "#211a24"
  barColor.dispatchEvent(new Event("input", { bubbles: true }))
  inputColor.value = "#3a3040"
  inputColor.dispatchEvent(new Event("input", { bubbles: true }))
  textColor.value = "#fff4fa"
  textColor.dispatchEvent(new Event("input", { bubbles: true }))
  borderColor.value = "#b58da2"
  borderColor.dispatchEvent(new Event("input", { bubbles: true }))
  radius.value = "10"
  radius.dispatchEvent(new Event("input", { bubbles: true }))

  const previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-surface"), "#211a24")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-input"), "#3a3040")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-ink"), "#fff4fa")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-line"), "#b58da2")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-radius"), "10px")

  cssShortcut.click()
  assert.equal(document.getElementById("cuMessageMore").open, true)
  assert.equal(document.activeElement, document.getElementById("cuAppCustomCss"))

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.composerAutoReadability, false)
  assert.equal(saved.composerBg, "#211a24")
  assert.equal(saved.composerInputBg, "#3a3040")
  assert.equal(saved.composerInputText, "#fff4fa")
  assert.equal(saved.composerInputBorder, "#b58da2")
  assert.equal(saved.composerInputRadius, 10)
})

test("reader message appearance renders separate full bubble skins with adjustable size", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      selfBubbleSkinImage: imageUrl,
      selfBubbleSkinSize: 140,
      selfBubbleSkinSlice: 18,
      selfBubbleSkinPadding: 10,
      otherBubbleSkinImage: imageUrl,
      otherBubbleSkinSlice: 22,
      otherBubbleSkinPadding: 7,
    } },
  }))
  await import(`../reader/reader.js?reader-message-bubble-skins=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const preview = document.querySelector(".rd-app-preview-chat")
  assert.ok(document.getElementById("cuSelfBubbleSkinUpload"))
  assert.ok(document.getElementById("cuOtherBubbleSkinUpload"))
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-min-width"), "162px")
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-min-height"), "78px")
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-slice"), "18")
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-padding"), "10px")
  assert.equal(preview.style.getPropertyValue("--chat-other-bubble-slice"), "22")
  assert.equal(preview.style.getPropertyValue("--chat-other-bubble-padding"), "7px")
  assert.equal(preview.querySelector(".chat-msg.self").classList.contains("has-bubble-skin"), true)
  assert.equal(preview.querySelector(".chat-msg.other").classList.contains("has-bubble-skin"), true)
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("has-bubble-skin"), true)
  assert.equal(preview.querySelector(".chat-msg.other .chat-bubble").classList.contains("has-bubble-skin"), true)
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("bubble-skin-full"), true)
  assert.equal(preview.querySelector(".chat-msg.other .chat-bubble").classList.contains("bubble-skin-full"), true)
  assert.equal(document.querySelector('[data-cu-bubble-skin-mode="full"][data-cu-bubble-skin-side="self"]').classList.contains("active"), true)
  assert.equal(document.querySelector('[data-cu-bubble-skin-slice-row="self"]').hidden, true)
})

test("slice bubble skins use the size control and allow a larger 220 percent range", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      selfBubbleSkinImage: imageUrl,
      selfBubbleSkinMode: "slice",
      selfBubbleSkinSize: 220,
    } },
  }))
  await import(`../reader/reader.js?reader-message-slice-size=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const size = document.getElementById("cuSelfBubbleSkinSize")
  const preview = document.querySelector(".rd-app-preview-chat")
  assert.equal(size.max, "220")
  assert.equal(size.value, "220")
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-min-width"), "250px")
  assert.equal(preview.style.getPropertyValue("--chat-self-bubble-min-height"), "123px")
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("bubble-skin-slice"), true)
  assert.match(
    sharedChatCss,
    /\.phone-frame \.chat-msg\.self \.chat-bubble\.has-bubble-skin\.bubble-skin-slice\s*\{[^}]*min-width:\s*var\(--chat-self-bubble-min-width,\s*116px\);[^}]*min-height:\s*var\(--chat-self-bubble-min-height,\s*56px\);/s,
  )
})

test("reader bubble skin upload stays draft-only, clears per side, and resets with bubble group", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      otherBubbleSkinImage: imageUrl,
      otherBubbleSkinSlice: 20,
      otherBubbleSkinPadding: 9,
    } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  installFileReader(t, { result: imageUrl })
  installImageDecoder(t)
  await import(`../reader/reader.js?reader-message-bubble-skin-upload=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const selfFile = document.getElementById("cuSelfBubbleSkinFile")
  setInputFiles(selfFile, [{ type:"image/png", size:8 }])
  await flushAsyncImageWork()
  await flushAsyncImageWork()

  let preview = document.querySelector(".rd-app-preview-chat")
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("has-bubble-skin"), true)
  assert.equal(preview.querySelector(".chat-msg.other .chat-bubble").classList.contains("has-bubble-skin"), true)

  document.getElementById("cuSelfBubbleSkinClear").click()
  preview = document.querySelector(".rd-app-preview-chat")
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("has-bubble-skin"), false)
  assert.equal(preview.querySelector(".chat-msg.other .chat-bubble").classList.contains("has-bubble-skin"), true)

  setInputFiles(selfFile, [{ type:"image/png", size:8 }])
  await flushAsyncImageWork()
  await flushAsyncImageWork()
  document.getElementById("cuSelfBubbleSkinSize").value = "150"
  document.getElementById("cuSelfBubbleSkinSize").dispatchEvent(new Event("input", { bubbles:true }))
  document.getElementById("cuSelfBubbleSkinSlice").value = "24"
  document.getElementById("cuSelfBubbleSkinSlice").dispatchEvent(new Event("input", { bubbles:true }))
  document.getElementById("cuSelfBubbleSkinPadding").value = "11"
  document.getElementById("cuSelfBubbleSkinPadding").dispatchEvent(new Event("input", { bubbles:true }))
  document.getElementById("cuModalSave").click()

  let saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.selfBubbleSkinImage, imageUrl)
  assert.equal(saved.selfBubbleSkinMode, "full")
  assert.equal(saved.selfBubbleSkinSize, 150)
  assert.equal(saved.selfBubbleSkinSlice, 24)
  assert.equal(saved.selfBubbleSkinPadding, 11)
  assert.equal(saved.otherBubbleSkinImage, imageUrl)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-reset-message-section="bubbles"]').click()
  preview = document.querySelector(".rd-app-preview-chat")
  assert.equal(preview.querySelector(".chat-msg.self .chat-bubble").classList.contains("has-bubble-skin"), false)
  assert.equal(preview.querySelector(".chat-msg.other .chat-bubble").classList.contains("has-bubble-skin"), false)
  document.getElementById("cuModalSave").click()
  saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.selfBubbleSkinImage, null)
  assert.equal(saved.otherBubbleSkinImage, null)
})

test("local appearance image upload reports dimensions, size, and edge transparency status", async t => {
  installDom(t)
  installFileReader(t, { result: staticRasterCases[0][1] })
  installImageDecoder(t, { width:640, height:360 })
  await import(`../reader/reader.js?reader-image-inspection=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  setInputFiles(document.getElementById("cuSelfBubbleSkinFile"), [{
    name:"bubble.png",
    type:"image/png",
    size:512,
  }])
  await flushAsyncImageWork()
  await flushAsyncImageWork()
  await flushAsyncImageWork()

  const state = document.getElementById("cuSelfBubbleSkinState")
  assert.match(state.textContent, /640×360/)
  assert.match(state.textContent, /512 B/)
  assert.match(state.textContent, /透明边缘/)
})

test("reader message wallpaper controls preview and save fit, focus, tone, and automatic button contrast", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-message-wallpaper-controls=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-chat-bg-fit="contain"]').click()
  const tone = document.getElementById("cuChatBgTone")
  const positionX = document.getElementById("cuChatBgPosX")
  const positionY = document.getElementById("cuChatBgPosY")
  const buttonColor = document.querySelector('[data-cu-send-bg-picker]')
  tone.value = "-30"
  tone.dispatchEvent(new Event("input", { bubbles: true }))
  positionX.value = "22"
  positionX.dispatchEvent(new Event("input", { bubbles: true }))
  positionY.value = "78"
  positionY.dispatchEvent(new Event("input", { bubbles: true }))
  buttonColor.value = "#285c4d"
  buttonColor.dispatchEvent(new Event("input", { bubbles: true }))

  const previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(previewChat.style.getPropertyValue("--chat-bg-size"), "contain")
  assert.equal(previewChat.style.getPropertyValue("--chat-bg-position"), "22% 78%")
  assert.equal(previewChat.style.getPropertyValue("--chat-bg-overlay-color"), "#000000")
  assert.equal(previewChat.style.getPropertyValue("--chat-bg-overlay-opacity"), "0.3")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-ink"), "#ffffff")

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.chatBgFit, "contain")
  assert.equal(saved.chatBgPositionX, 22)
  assert.equal(saved.chatBgPositionY, 78)
  assert.equal(saved.chatBgTone, -30)
})

test("reader message appearance groups stay compact and preview clicks reveal the matching section", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-message-appearance-sections=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const sections = [...document.querySelectorAll(".cu-settings-section")]
  assert.deepEqual(
    sections.slice(0, 4).map(section => section.id),
    ["cuMessageBubbles", "cuMessageBackground", "cuMessageActions", "cuMessageCall"],
  )
  assert.deepEqual(sections.filter(section => section.open).map(section => section.id), ["cuMessageBubbles"])

  document.querySelector(".rd-app-preview-chat .chat-msg-area").click()
  assert.equal(document.getElementById("cuMessageBackground").open, true)
  assert.equal(document.getElementById("cuMessageBubbles").open, false)

  document.querySelector(".rd-app-preview-chat .chat-bubble").click()
  assert.equal(document.getElementById("cuMessageBubbles").open, true)
  assert.equal(document.getElementById("cuMessageBackground").open, false)

  document.querySelector(".rd-app-preview-chat #chatSendBtn").click()
  assert.equal(document.getElementById("cuMessageActions").open, true)
  assert.equal(document.getElementById("cuMessageBubbles").open, false)
})

test("reader message bubble controls use collapsible groups and picker-only colors", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-message-bubble-groups=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const groups = [...document.querySelectorAll("#cuMessageBubbles > .cu-settings-section-body > details")]
  assert.deepEqual(
    groups.map(group => group.id),
    ["cuMessageAvatar", "cuMessageSelfBubble", "cuMessageOtherBubble", "cuMessageTypography"],
  )
  assert.deepEqual(groups.filter(group => group.open).map(group => group.id), ["cuMessageSelfBubble"])
  assert.equal(document.querySelectorAll("#cuMessageBubbles .cu-color-btn").length, 0)
  assert.equal(document.querySelectorAll("#cuMessageBubbles .cu-color-picker").length, 5)
  assert.equal(document.querySelectorAll("#cuMessageBackground .cu-color-btn").length, 0)
  assert.equal(document.querySelectorAll("#cuMessageActions .cu-color-btn").length, 0)

  document.querySelector(".rd-app-preview-chat .chat-msg.other .chat-bubble").click()
  assert.equal(document.getElementById("cuMessageOtherBubble").open, true)
  assert.equal(document.getElementById("cuMessageSelfBubble").open, false)

  document.querySelector(".rd-app-preview-chat .chat-avatar").click()
  assert.equal(document.getElementById("cuMessageAvatar").open, true)
  assert.equal(document.getElementById("cuMessageOtherBubble").open, false)
})

test("reader appearance ranges support exact numeric entry with clamping", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-exact-ranges=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const range = document.getElementById("cuSelfRadius")
  const exact = document.querySelector('[data-appearance-range-input="cuSelfRadius"]')
  assert.ok(exact)
  assert.equal(exact.value, "8")

  exact.value = "99"
  exact.dispatchEvent(new Event("change", { bubbles:true }))
  assert.equal(range.value, "20")
  assert.equal(exact.value, "20")
  assert.match(document.querySelector(".rd-app-preview-chat").innerHTML, /border-radius:20px 20px 2px 20px/)
})

test("reader appearance sections expose live summaries and one-step undo", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-section-state=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const section = document.getElementById("cuMessageBubbles")
  const summary = section.querySelector("[data-appearance-summary]")
  const undo = document.querySelector(".appearance-workbench-undo")
  assert.ok(summary)
  assert.ok(undo)
  assert.equal(section.classList.contains("is-appearance-modified"), false)
  assert.equal(undo.disabled, true)

  const range = document.getElementById("cuBubbleFs")
  range.dispatchEvent(new MouseEvent("pointerdown", { bubbles:true }))
  range.value = "16"
  range.dispatchEvent(new Event("input", { bubbles:true }))
  assert.equal(section.classList.contains("is-appearance-modified"), true)
  assert.match(summary.textContent, /16px/)
  assert.equal(undo.disabled, false)

  undo.click()
  assert.equal(range.value, "13")
  assert.equal(section.classList.contains("is-appearance-modified"), false)
  assert.match(document.querySelector(".rd-app-preview-chat").innerHTML, /font-size:13px/)
})

test("message bubble appearance can be copied between both sides", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-bubble-style-copy=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const selfColor = document.querySelector("[data-cu-self-bg-picker]")
  selfColor.value = "#123456"
  selfColor.dispatchEvent(new Event("input", { bubbles:true }))
  const selfRadius = document.getElementById("cuSelfRadius")
  selfRadius.value = "17"
  selfRadius.dispatchEvent(new Event("input", { bubbles:true }))

  document.querySelector('[data-cu-copy-bubble-style="self-to-other"]').click()
  assert.equal(document.querySelector("[data-cu-other-bg-picker]").value, "#123456")
  assert.equal(document.getElementById("cuOtherRadius").value, "17")
  assert.equal(document.getElementById("cuMessageOtherBubble").open, true)
  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.otherBubbleBg, "#123456")
  assert.equal(saved.otherBubbleRadius, 17)
})

test("non-message App preview clicks reveal their matching settings", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-preview-targets=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("forum")
  document.querySelector(".rd-forum-title").click()
  assert.equal(document.getElementById("cuForumTypography").open, true)
  assert.equal(document.querySelector(".appearance-workbench-pages").dataset.appearanceActivePage, "controls")
  document.getElementById("cuModalCancel").click()

  openNamedAppSettings("gallery")
  document.querySelector(".rd-gallery-photo").click()
  assert.equal(document.getElementById("cuGalleryAppearance").open, true)
})

test("every reader App appearance editor uses collapsible groups and shared preview pages", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-all-app-disclosures=${Date.now()}-${Math.random()}`)

  const expectedSections = {
    forum: ["cuForumAvatar", "cuForumCards", "cuForumTypography", "cuAppMore"],
    memo: ["cuMemoStyle", "cuMemoAppearance", "cuAppMore"],
    gallery: ["cuGalleryGrid", "cuGalleryAppearance", "cuAppMore"],
    browser: ["cuBrowserTypography", "cuBrowserEntries", "cuAppMore"],
    shopping: ["cuShoppingNames", "cuShoppingPrices", "cuAppMore"],
    contacts: ["cuContactsAvatar", "cuContactsNames", "cuAppMore"],
  }

  for (const [type, sectionIds] of Object.entries(expectedSections)) {
    openNamedAppSettings(type)
    const workbench = document.querySelector(".app-appearance-workbench")
    const sections = [...workbench.querySelectorAll(".app-appearance-controls > .cu-settings-section")]
    assert.equal(workbench.querySelectorAll(".app-appearance-controls > .cu-card").length, 0, type)
    assert.deepEqual(sections.map(section => section.id), sectionIds, type)
    assert.deepEqual(sections.filter(section => section.open).map(section => section.id), [sectionIds[0]], type)
    assert.ok(workbench.querySelector('[data-appearance-page="preview"]'), type)
    assert.ok(workbench.querySelector('[data-appearance-page="controls"]'), type)
    assert.ok(workbench.querySelector('[data-appearance-page-target="preview"]'), type)
    assert.ok(workbench.querySelector('[data-appearance-page-target="controls"]'), type)

    workbench.querySelector('[data-appearance-page-target="controls"]').click()
    assert.equal(workbench.querySelector(".appearance-workbench-pages").dataset.appearanceActivePage, "controls")
    document.getElementById("cuModalCancel").click()
  }
})

test("reader App preview scales to the available height on short wide screens", async t => {
  const dom = installDom(t)
  Object.defineProperty(dom.window, "innerWidth", { configurable: true, value: 1100 })
  await import(`../reader/reader.js?reader-app-preview-height=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const modalBody = document.querySelector(".app-appearance-workbench .cu-modal-body")
  const previewLabel = document.querySelector(".app-appearance-preview-pane .cu-preview-label")
  const previewStatus = document.querySelector(".app-appearance-preview-pane .phone-appearance-status")
  const previewFrame = document.querySelector(".reader-app-preview-frame")
  const previewWrap = document.querySelector(".app-appearance-preview-pane .rd-phone-preview")
  Object.defineProperty(modalBody, "clientHeight", { configurable: true, value: 520 })
  Object.defineProperty(previewLabel, "offsetHeight", { configurable: true, value: 24 })
  Object.defineProperty(previewStatus, "offsetHeight", { configurable: true, value: 22 })
  Object.defineProperty(previewFrame, "offsetHeight", { configurable: true, value: 640 })

  dom.window.dispatchEvent(new Event("resize"))

  assert.equal(document.querySelector(".app-appearance-workbench").style.getPropertyValue("--reader-app-preview-scale"), "0.659")
  assert.equal(previewWrap.style.height, "422px")
  assert.equal(previewWrap.style.overflow, "hidden")
})

test("reader message section reset stays draft-only and preserves other groups", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      avatarShape: "square",
      avatarSize: 52,
      selfBubbleBg: "#123456",
      bubbleFontWeight: 800,
      chatBg: "#25435f",
      chatBgImage: imageUrl,
      chatBgFit: "contain",
      chatBgPositionX: 22,
      sendButtonBg: "#285c4d",
    } },
  }))
  await import(`../reader/reader.js?reader-message-section-reset=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const rawBefore = localStorage.getItem("moirain_phoneCustom")
  const resetButtons = [...document.querySelectorAll("[data-cu-reset-message-section]")]
  assert.deepEqual(resetButtons.map(button => button.dataset.cuResetMessageSection), ["bubbles", "background", "actions", "call"])

  document.querySelector('[data-cu-reset-message-section="bubbles"]').click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), rawBefore)
  assert.equal(document.querySelector('[data-cu-shape="circle"]').classList.contains("active"), true)
  assert.equal(document.getElementById("cuMsgAvSize").value, "36")
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-bubble-weight"), "400")
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-bg-size"), "contain")

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.avatarShape, "circle")
  assert.equal(saved.avatarSize, 36)
  assert.equal(saved.selfBubbleBg, "#555")
  assert.equal(saved.bubbleFontWeight, 400)
  assert.equal(saved.chatBg, "#25435f")
  assert.equal(saved.chatBgImage, imageUrl)
  assert.equal(saved.chatBgFit, "contain")
  assert.equal(saved.chatBgPositionX, 22)
  assert.equal(saved.sendButtonBg, "#285c4d")
})

test("reader message wallpaper focus can be dragged directly in the preview", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: { chatBgImage: staticRasterCases[0][1] } },
  }))
  await import(`../reader/reader.js?reader-message-wallpaper-drag=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const area = document.querySelector(".rd-app-preview-chat .chat-msg-area")
  area.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100, right: 210, bottom: 120 })
  const pointer = (type, x, y) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      clientX: { value: x },
      clientY: { value: y },
      pointerId: { value: 1 },
    })
    return event
  }

  area.dispatchEvent(pointer("pointerdown", 30, 30))
  document.dispatchEvent(pointer("pointermove", 170, 90))
  document.dispatchEvent(pointer("pointerup", 170, 90))

  assert.equal(document.getElementById("cuChatBgPosX").value, "80")
  assert.equal(document.getElementById("cuChatBgPosY").value, "70")
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-bg-position"), "80% 70%")
})

test("reader message section resets stay draft-only and do not affect sibling groups", async t => {
  installDom(t)
  const imageUrl = staticRasterCases[0][1]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      bubbleFontSize: 17,
      bubbleFontWeight: 800,
      chatBg: "#1a1a2e",
      chatBgImage: imageUrl,
      chatBgFit: "contain",
      chatBgPositionX: 20,
      chatBgPositionY: 80,
      chatBgTone: -30,
      sendButtonBg: "#493b40",
    } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?reader-message-section-reset=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  document.querySelector('[data-cu-reset-message-section="background"]').click()

  let previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(document.getElementById("cuChatBgTone").value, "0")
  assert.equal(document.getElementById("cuChatBgPosX").value, "50")
  assert.equal(document.getElementById("cuChatBgPosY").value, "50")
  assert.equal(document.querySelector('[data-cu-chat-bg-fit="cover"]').classList.contains("active"), true)
  assert.equal(previewChat.style.getPropertyValue("--chat-editor-image"), "none")
  assert.equal(document.getElementById("cuBubbleFs").value, "17")
  assert.equal(previewChat.style.getPropertyValue("--chat-bubble-weight"), "800")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-bg"), "#493b40")
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.querySelector('[data-cu-reset-message-section="bubbles"]').click()
  previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(document.getElementById("cuBubbleFs").value, "13")
  assert.equal(previewChat.style.getPropertyValue("--chat-bubble-weight"), "400")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-bg"), "#493b40")

  document.querySelector('[data-cu-reset-message-section="actions"]').click()
  previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-bg"), "#cda9b1")
  assert.equal(previewChat.style.getPropertyValue("--chat-send-ink"), "#241d20")

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages
  assert.equal(saved.bubbleFontSize, 13)
  assert.equal(saved.bubbleFontWeight, 400)
  assert.equal(saved.chatBg, "#f0f0f0")
  assert.equal(saved.chatBgImage, null)
  assert.equal(saved.chatBgFit, "cover")
  assert.equal(saved.chatBgPositionX, 50)
  assert.equal(saved.chatBgPositionY, 50)
  assert.equal(saved.chatBgTone, 0)
  assert.equal(saved.sendButtonBg, "#cda9b1")
})

test("reader App preview uses the dynamic desktop scale variable", () => {
  assert.match(
    readerCss,
    /@media \(min-width: 861px\)\s*\{[\s\S]*?\.app-appearance-workbench \.reader-app-preview-frame\s*\{[^}]*transform:\s*scale\(var\(--reader-app-preview-scale,\s*1\)\);[^}]*transform-origin:\s*top center;[^}]*\}[\s\S]*?\}/,
  )
})

test("mobile appearance history reserves its full height before the first settings group", () => {
  assert.match(
    readerCss,
    /@media \(max-width: 860px\)\s*\{[\s\S]*?\.app-appearance-controls,[\s\S]*?\.rs-controls\s*\{[^}]*padding:\s*0 16px 24px;[^}]*\}/,
  )
  assert.match(
    readerCss,
    /@media \(max-width: 860px\)\s*\{[\s\S]*?\.appearance-workbench-history\s*\{[^}]*margin:\s*0;[^}]*\}/,
  )
  assert.match(
    readerCss,
    /@media \(max-width: 860px\)\s*\{[\s\S]*?\.appearance-workbench-history\s*\{[^}]*background:\s*var\(--c-surface\);[^}]*\}/,
  )
  assert.doesNotMatch(
    readerCss,
    /\.appearance-workbench-history\s*\{[^}]*margin-top:\s*-\d/,
  )
})

test("reader message wallpaper readability stays local and protects dark backgrounds", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      chatBgImage:staticRasterCases[0][1],
      chatBgLuminance:0.08,
      chatAutoReadability:true,
    } },
  }))
  await import(`../reader/reader.js?reader-message-readability=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const previewChat = document.querySelector(".rd-app-preview-chat")
  assert.equal(document.getElementById("cuChatAutoReadability").checked, true)
  assert.equal(previewChat.style.getPropertyValue("--chat-time-color"), "#ffffff")
  assert.equal(previewChat.style.getPropertyValue("--chat-composer-ink"), "#ffffff")
  assert.match(previewChat.style.getPropertyValue("--chat-composer-surface"), /^rgba\(/)

  document.getElementById("cuChatAutoReadability").click()
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-time-color"), "#b0b8c4")
})

test("reader App settings restore an accidentally closed draft", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-dirty-draft=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const save = document.getElementById("cuModalSave")
  const status = document.getElementById("cuAppLiveStatus")
  assert.equal(save.disabled, true)
  assert.match(status.textContent, /尚未修改/)

  const size = document.getElementById("cuBubbleFs")
  size.value = "15"
  size.dispatchEvent(new Event("input", { bubbles:true }))
  assert.equal(save.disabled, false)
  assert.match(status.textContent, /未保存/)

  document.getElementById("cuModalClose").click()
  assert.equal(document.querySelector(".app-appearance-workbench"), null)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), null)

  openNamedAppSettings("messages")
  assert.equal(document.getElementById("cuBubbleFs").value, "15")
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  document.getElementById("cuModalSave").click()
  assert.equal(
    JSON.parse(localStorage.getItem("moirain_phoneCustom")).appSettings.messages.bubbleFontSize,
    15,
  )
})

test("reader App Restore Default is draft-only and immediately undoable", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings:{ messages:{ selfBubbleBg:"#3b82f6" } },
  }))
  const beforeRaw = localStorage.getItem("moirain_phoneCustom")
  await import(`../reader/reader.js?reader-app-reset-undo=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  document.getElementById("cuAppReset").click()
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-pink"), "#555")
  assert.equal(document.getElementById("cuModalSave").disabled, false)
  const undo = document.querySelector('[data-feedback-action]')
  assert.equal(undo.textContent, "撤销")

  undo.click()
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-pink"), "#3b82f6")
  assert.equal(document.getElementById("cuModalSave").disabled, true)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

test("reader App preview supports press-and-hold original comparison", async t => {
  installDom(t)
  await import(`../reader/reader.js?reader-app-hold-comparison=${Date.now()}-${Math.random()}`)

  openNamedAppSettings("messages")
  const picker = document.querySelector('[data-cu-self-bg-picker]')
  picker.value = "#3b82f6"
  picker.dispatchEvent(new Event("input", { bubbles:true }))
  await new Promise(resolve => setTimeout(resolve, 60))

  const frame = document.querySelector(".reader-app-preview-frame")
  const pointer = type => {
    const event = new Event(type, { bubbles:true, cancelable:true })
    Object.defineProperties(event, {
      pointerId:{ value:1 },
      pointerType:{ value:"mouse" },
      button:{ value:0 },
      clientX:{ value:20 },
      clientY:{ value:20 },
    })
    return event
  }
  frame.dispatchEvent(pointer("pointerdown"))
  await new Promise(resolve => setTimeout(resolve, 240))
  assert.equal(document.querySelector(".app-appearance-workbench").classList.contains("is-comparing-original"), true)
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-pink"), "#555")

  document.dispatchEvent(pointer("pointerup"))
  assert.equal(document.querySelector(".app-appearance-workbench").classList.contains("is-comparing-original"), false)
  assert.equal(document.querySelector(".rd-app-preview-chat").style.getPropertyValue("--chat-editor-pink"), "#3b82f6")
})

test("phone chat keeps the selected wallpaper layer and uses appearance variables", () => {
  const messageAreaRule = sharedChatCssBody(".phone-frame .chat-msg-area")
  const bubbleRule = sharedChatCssBody(".phone-frame .chat-bubble")
  const sendButtonRule = sharedChatCssBody(".phone-frame .chat-composer #chatSendBtn")

  assert.match(messageAreaRule, /background-color:\s*var\(--chat-editor-screen\);/)
  assert.match(messageAreaRule, /background-image:\s*var\(--chat-editor-image,\s*none\);/)
  assert.match(messageAreaRule, /background-position:\s*var\(--chat-bg-position,\s*center\);/)
  assert.match(messageAreaRule, /background-size:\s*var\(--chat-bg-size,\s*cover\);/)
  assert.doesNotMatch(messageAreaRule, /(?:^|;)\s*background:\s*/)
  assert.match(bubbleRule, /font-weight:\s*var\(--chat-bubble-weight,\s*400\);/)
  assert.match(sharedChatCss, /\.phone-frame \.chat-bubble\.has-bubble-skin\.bubble-skin-slice\s*\{[^}]*border-image-repeat:\s*stretch;[^}]*background:\s*transparent\s*!important;/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-msg\.has-bubble-skin\s*\{[^}]*align-items:\s*center;/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-bubble\.has-bubble-skin\.bubble-skin-full\s*\{[^}]*background-size:\s*100% 100%\s*!important;/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-msg\.self \.chat-bubble\.has-bubble-skin\.bubble-skin-slice\s*\{[^}]*border-image-source:\s*var\(--chat-self-bubble-skin\);[^}]*border-image-slice:\s*var\(--chat-self-bubble-slice,\s*16\)\s+fill;/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-msg\.other \.chat-bubble\.has-bubble-skin\.bubble-skin-slice\s*\{[^}]*border-image-source:\s*var\(--chat-other-bubble-skin\);[^}]*border-image-slice:\s*var\(--chat-other-bubble-slice,\s*16\)\s+fill;/s)
  assert.match(sendButtonRule, /background:\s*var\(--chat-send-bg,\s*#cda9b1\);/)
  assert.match(sendButtonRule, /color:\s*var\(--chat-send-ink,\s*#241d20\);/)
  assert.match(sharedChatCss, /--chat-composer-surface/)
  assert.match(sharedChatCss, /--chat-time-color/)
  assert.match(
    sharedChatCss,
    /\.phone-frame \.chat-msg-area::before\s*\{[^}]*background:\s*var\(--chat-bg-overlay-color,\s*#000000\);[^}]*opacity:\s*var\(--chat-bg-overlay-opacity,\s*0\);/s,
  )
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
  assert.equal(document.querySelector('#cuCallBackgroundPreview').dataset.callBackground, "water")
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

    openNamedAppSettings("messages")
    assert.equal(document.querySelector("#cuCallBackgroundPreview").dataset.callBackground, "water")
    document.querySelector('[data-cu-call-background-preset="rose"]').click()
    dismissal.dismiss()
    assert.equal(document.querySelector(".cu-modal-overlay"), null)
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
  assert.equal(save.disabled, true)
  assert.equal(preview.dataset.callBackground, "image")
  assert.match(preview.getAttribute("style") || "", /--rd-call-image/)
  assert.match(preview.getAttribute("style") || "", new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  document.getElementById("cuModalCancel").click()
  openNamedAppSettings("messages")
  preview = document.getElementById("cuCallBackgroundPreview")
  assert.equal(decoder.pending.length, 1, "verified canonical URL is reused from the session Set")
  assert.equal(document.getElementById("cuModalSave").disabled, true)
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
    assert.equal(document.getElementById("cuModalSave").disabled, true)
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
