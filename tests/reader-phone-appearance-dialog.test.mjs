import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

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
  globalThis.KeyboardEvent = dom.window.KeyboardEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.Image = dom.window.Image
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function openPhoneAppearance() {
  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector('[data-reader-phone-control="appearance"]')
  trigger.focus()
  trigger.click()
  return trigger
}

function dispatchInput(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

test("phone appearance workbench previews drafts live and saves only on confirmation", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    wallpaper: "#eee6e7",
    frameColor: "#8f7b81",
    borderRadius: 18,
    fontSize: 12,
    iconBorderRadius: 6,
    materialOpacity: 65,
    showIconShadow: true,
    customCss: "",
  }))
  await import(`../reader/reader.js?phone-appearance-workbench=${Date.now()}-${Math.random()}`)

  const trigger = openPhoneAppearance()
  const originalStorage = localStorage.getItem("moirain_phoneCustom")
  const dialog = document.querySelector(".cu-modal.phone-appearance-workbench")
  assert.ok(dialog)
  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.ok(document.querySelector(".reader-phone-css-preview-scope"))

  for (const id of [
    "cuWallpaperColor",
    "cuFrameColor",
    "cuRadius",
    "cuFontSize",
    "cuIconRadius",
    "cuMaterialOpacity",
    "cuCustomCss",
  ]) assert.ok(document.getElementById(id), id)

  const radius = document.getElementById("cuRadius")
  radius.value = "32"
  dispatchInput(radius)
  const fontSize = document.getElementById("cuFontSize")
  fontSize.value = "16"
  dispatchInput(fontSize)
  const iconRadius = document.getElementById("cuIconRadius")
  iconRadius.value = "18"
  dispatchInput(iconRadius)
  const material = document.getElementById("cuMaterialOpacity")
  material.value = "82"
  dispatchInput(material)
  const shadow = document.getElementById("cuShadow")
  shadow.checked = false
  shadow.dispatchEvent(new Event("change", { bubbles: true }))

  const previewFrame = document.querySelector(".reader-phone-css-preview-scope")
  assert.equal(previewFrame.style.getPropertyValue("--phone-radius"), "32px")
  assert.equal(previewFrame.style.getPropertyValue("--phone-fontsize"), "16px")
  assert.equal(previewFrame.style.getPropertyValue("--phone-icon-radius"), "18px")
  assert.equal(previewFrame.style.getPropertyValue("--phone-material-opacity"), "82%")
  assert.equal(previewFrame.querySelector(".phone-icon-body").classList.contains("icon-shadow"), false)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), originalStorage)

  const customCss = document.getElementById("cuCustomCss")
  customCss.value = ".phone-profile { box-shadow: none; }"
  dispatchInput(customCss)
  assert.match(
    document.getElementById("reader-phone-preview-user-css").textContent,
    /\.reader-phone-css-preview-scope \.phone-profile/,
  )
  assert.equal(document.getElementById("cuSave").disabled, false)

  document.getElementById("cuSave").click()
  const stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.borderRadius, 32)
  assert.equal(stored.fontSize, 16)
  assert.equal(stored.iconBorderRadius, 18)
  assert.equal(stored.materialOpacity, 82)
  assert.equal(stored.showIconShadow, false)
  assert.equal(stored.customCss, ".phone-profile { box-shadow: none; }")
  assert.match(document.getElementById("reader-phone-user-css").textContent, /\.reader-phone-css-scope \.phone-profile/)
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(document.activeElement.getAttribute("data-reader-phone-control"), trigger.getAttribute("data-reader-phone-control"))
})

test("phone appearance invalid CSS stays unapplied and cancel preserves exact stored bytes", async t => {
  const dom = installDom(t)
  const raw = '{ "wallpaper": "#d0e8f5", "borderRadius": 11, "customCss": ".phone-profile { opacity: .9; }" }'
  localStorage.setItem("moirain_phoneCustom", raw)
  await import(`../reader/reader.js?phone-appearance-cancel=${Date.now()}-${Math.random()}`)

  const trigger = openPhoneAppearance()
  const customCss = document.getElementById("cuCustomCss")
  const previousPreviewCss = document.getElementById("reader-phone-preview-user-css").textContent
  customCss.value = ".phone-profile { position: fixed; }"
  dispatchInput(customCss)

  assert.equal(document.getElementById("cuCssError").hidden, false)
  assert.equal(document.getElementById("cuSave").disabled, true)
  assert.equal(document.getElementById("reader-phone-preview-user-css").textContent, previousPreviewCss)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), raw)

  document.querySelector(".cu-modal").dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  )
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(document.getElementById("reader-phone-preview-user-css"), null)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), raw)
  assert.equal(document.activeElement, trigger)
})

test("saved phone appearance reaches the standalone reader phone", async t => {
  installDom(t)
  const work = {
    schemaVersion: 1,
    id: "appearance-phone-work",
    type: "phone",
    title: "Appearance phone",
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
      skin: {},
      apps: [{
        id: "memo-app",
        type: "memo",
        name: "备忘录",
        icon: "记",
        color: "#f0f0f0",
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    borderRadius: 29,
    fontSize: 15,
    iconBorderRadius: 17,
    materialOpacity: 78,
    showIconShadow: false,
    customCss: ".phone-profile { box-shadow: none; }",
  }))

  await import(`../reader/reader.js?phone-appearance-runtime=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  const frame = document.querySelector(".phone-reader > .phone-frame")
  assert.ok(frame)
  assert.equal(frame.classList.contains("reader-phone-css-scope"), true)
  assert.equal(frame.style.getPropertyValue("--phone-radius"), "29px")
  assert.equal(frame.style.getPropertyValue("--phone-fontsize"), "15px")
  assert.equal(frame.style.getPropertyValue("--phone-icon-radius"), "17px")
  assert.equal(frame.style.getPropertyValue("--phone-material-opacity"), "78%")
  assert.equal(frame.querySelector(".phone-icon-body").classList.contains("icon-shadow"), false)
  assert.match(document.getElementById("reader-phone-user-css").textContent, /\.reader-phone-css-scope \.phone-profile/)
})

test("saved reader profile images can be replaced and cleared after reopening", async t => {
  const dom = installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    readerId:"旧昵称",
    readerAvatar:"data:image/png;base64,b2xkLWF2YXRhcg==",
    topBgImage:"data:image/png;base64,b2xkLWNvdmVy",
  }))
  globalThis.FileReader = class {
    readAsDataURL(file) {
      this.result = file.dataUrl
      if (this.onload) this.onload()
    }
  }
  const originalInputClick = dom.window.HTMLInputElement.prototype.click
  dom.window.HTMLInputElement.prototype.click = function() {
    if (this.type === "file") {
      Object.defineProperty(this, "files", {
        configurable:true,
        value:[{ dataUrl:"data:image/png;base64,bmV3LWF2YXRhcg==" }],
      })
      if (this.onchange) this.onchange()
      return
    }
    return originalInputClick.call(this)
  }

  await import(`../reader/reader.js?reader-profile-reedit=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="custom"]').click()
  document.querySelector('[data-reader-phone-control="profile"]').click()

  document.getElementById("rpUploadAv").click()
  assert.equal(document.getElementById("rpAvatarUrl").value, "data:image/png;base64,bmV3LWF2YXRhcg==")
  document.getElementById("rpSave").click()

  let stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.readerAvatar, "data:image/png;base64,bmV3LWF2YXRhcg==")

  document.querySelector('[data-reader-phone-control="profile"]').click()
  document.getElementById("rpClearAv").click()
  assert.equal(document.getElementById("rpAvatarUrl").value, "")
  document.getElementById("rpSave").click()

  stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.readerAvatar, null)

  document.querySelector('[data-reader-phone-control="profile"]').click()
  document.getElementById("rpClearTop").click()
  assert.equal(document.getElementById("rpTopBgUrl").value, "")
  document.getElementById("rpSave").click()

  stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.topBgImage, null)
})
