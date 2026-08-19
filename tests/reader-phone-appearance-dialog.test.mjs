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

async function waitForSelector(selector) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const element = document.querySelector(selector)
    if (element) return element
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail(`timed out waiting for ${selector}`)
}

async function openPhoneAppearance() {
  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector('[data-reader-phone-control="appearance"]')
  trigger.focus()
  trigger.click()
  await waitForSelector('.cu-modal.phone-appearance-workbench')
  return trigger
}

function dispatchInput(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

test("a first-load double activation opens one workbench without a false load error", async t => {
  installDom(t)
  await import(`../reader/reader.js?phone-appearance-double-activation=${Date.now()}-${Math.random()}`)

  document.querySelector('[data-tab="custom"]').click()
  const trigger = document.querySelector('[data-reader-phone-control="appearance"]')
  trigger.focus()
  trigger.click()
  trigger.click()

  await waitForSelector('.cu-modal.phone-appearance-workbench')
  await new Promise(resolve => setTimeout(resolve, 20))

  assert.equal(document.querySelectorAll('.cu-modal-overlay').length, 1)
  assert.equal(document.querySelectorAll('.cu-modal.phone-appearance-workbench').length, 1)
  assert.doesNotMatch(document.querySelector('[data-feedback-copy]')?.textContent || '', /外观编辑器加载失败/)

  document.getElementById('cuCancel').click()
  assert.equal(document.activeElement, trigger)
})

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

  const trigger = await openPhoneAppearance()
  const originalStorage = localStorage.getItem("moirain_phoneCustom")
  const dialog = document.querySelector(".cu-modal.phone-appearance-workbench")
  assert.ok(dialog)
  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.ok(document.querySelector(".reader-phone-css-preview-scope"))
  assert.ok(dialog.querySelector("[data-reader-appearance-export]"))
  assert.ok(dialog.querySelector("[data-reader-appearance-import]"))
  assert.ok(dialog.querySelector('[data-appearance-page="preview"]'))
  assert.ok(dialog.querySelector('[data-appearance-page="controls"]'))
  assert.deepEqual(
    [...dialog.querySelectorAll(".phone-appearance-controls > .cu-settings-section")].map(section => section.id),
    ["cuPhoneWallpaper", "cuPhoneWidgets", "cuPhoneDimensions", "cuPhoneSystem", "cuPhoneCss", "cuPhoneTransfer"],
  )
  assert.deepEqual(
    [...dialog.querySelectorAll(".phone-appearance-controls > .cu-settings-section")]
      .filter(section => section.open)
      .map(section => section.id),
    ["cuPhoneWallpaper"],
  )

  for (const id of [
    "cuWallpaperColor",
    "cuFrameColor",
    "cuRadius",
    "cuFontSize",
    "cuIconRadius",
    "cuMaterialOpacity",
    "cuWidgetWorkspace",
    "cuCustomCss",
  ]) assert.ok(document.getElementById(id), id)

  const customUpload = dialog.querySelector("[data-cu-custom-widget-upload]")
  assert.ok(customUpload)
  assert.equal(customUpload.textContent.trim(), "上传")
  assert.ok(customUpload.closest(".phone-widget-workspace-actions"))
  assert.equal(customUpload.closest(".phone-widget-workspace-actions").querySelector("[data-cu-widget-store-toggle]"), null)
  assert.equal(dialog.querySelector(".phone-custom-widget-uploader"), null)
  assert.match(document.getElementById("phoneCustomWidgetUploadHint").textContent, /PNG、JPEG、WebP/)
  assert.match(document.getElementById("phoneCustomWidgetUploadHint").textContent, /2 × 2、4 × 3、8 × 3/)
  assert.equal(dialog.querySelector(".phone-widget-empty [data-cu-widget-store-toggle]").textContent.trim(), "逛组件商店")

  assert.equal(document.querySelectorAll("#phoneAppearancePreview .phone-story-widget").length, 0)
  assert.ok(document.querySelector("#phoneAppearancePreview .phone-home.is-editable"))
  assert.equal(document.querySelectorAll("#phoneAppearancePreview [data-phone-home-key^='app:']").length, 7)
  assert.equal(document.querySelectorAll("#phoneAppearancePreview [data-phone-home-key='profile:identity']").length, 1)
  const homeUndo = dialog.querySelector(".appearance-workbench-undo")
  document.querySelector("#phoneAppearancePreview [data-phone-home-key='profile:identity']")
    .dispatchEvent(new KeyboardEvent("keydown", { key:"PageDown", bubbles:true }))
  assert.equal(document.querySelector("#phoneAppearancePreview [data-phone-home-key='profile:identity']").dataset.phoneHomeItemPage, "1")
  homeUndo.click()
  assert.equal(document.querySelector("#phoneAppearancePreview [data-phone-home-key='profile:identity']").dataset.phoneHomeItemPage, "0")
  const messagesHomeItem = document.querySelector("#phoneAppearancePreview [data-phone-home-key='app:messages']")
  messagesHomeItem.dispatchEvent(new KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }))
  assert.match(document.querySelector("#phoneAppearancePreview [data-phone-home-key='app:messages']").style.cssText, /--phone-home-left:\s*40px/)
  assert.doesNotMatch(document.querySelector("#phoneAppearancePreview [data-phone-home-key='app:forum']").style.cssText, /--phone-home-left:\s*80px/)
  assert.equal(homeUndo.disabled, false)
  homeUndo.click()
  assert.match(document.querySelector("#phoneAppearancePreview [data-phone-home-key='app:messages']").style.cssText, /--phone-home-left:\s*0px/)
  document.querySelector("#phoneAppearancePreview [data-phone-home-key='app:messages']")
    .dispatchEvent(new KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }))
  const storeToggle = dialog.querySelector("[data-cu-widget-store-toggle]")
  assert.equal(storeToggle.textContent.trim(), "逛组件商店")
  storeToggle.click()
  assert.equal(dialog.querySelectorAll("[data-cu-widget-store-card]").length, 26)
  assert.equal(dialog.querySelectorAll("[data-cu-widget-filter]").length, 4)
  dialog.querySelector('[data-cu-widget-filter="function"]').click()
  assert.equal(dialog.querySelectorAll("[data-cu-widget-store-card]").length, 9)
  dialog.querySelector('[data-cu-widget-filter="all"]').click()

  const addResume = dialog.querySelector('[data-cu-widget-add="v7-resume-dessert"]')
  assert.equal(addResume.textContent.trim(), "添加")
  addResume.click()
  assert.equal(document.querySelectorAll("#phoneAppearancePreview .phone-story-widget").length, 1)
  const resumeHomeItem = document.querySelector("#phoneAppearancePreview [data-phone-home-key='widget:v7-resume-dessert']")
  resumeHomeItem.dispatchEvent(new KeyboardEvent("keydown", { key:"PageDown", bubbles:true }))
  assert.equal(document.querySelector("#phoneAppearancePreview .phone-home").dataset.phoneHomePages, "2")
  assert.equal(document.querySelector("#phoneAppearancePreview [data-phone-home-key='widget:v7-resume-dessert']").dataset.phoneHomeItemPage, "1")
  assert.ok(dialog.querySelector('[data-cu-widget-installed="v7-resume-dessert"]'))
  assert.equal(dialog.querySelector("[data-cu-widget-style-toggle]"), null)

  dialog.querySelector("[data-cu-widget-store-toggle]").click()
  dialog.querySelector("[data-cu-widget-store-toggle]").click()
  dialog.querySelector('[data-cu-widget-add="v7-photo-double"]').click()
  assert.equal(dialog.querySelectorAll('[data-cu-widget-photo-product="v7-photo-double"]').length, 2)
  dialog.querySelector('[data-cu-widget-add="v7-decor-spoons"]').click()
  const decorPreview = document.querySelector('#phoneAppearancePreview [data-widget-product="v7-decor-spoons"]')
  assert.equal(decorPreview.tagName, "DIV")
  dialog.querySelector('[data-cu-widget-add="v7-countdown-cherry"]').click()
  const countdownTitle = dialog.querySelector('[data-cu-widget-field-product="v7-countdown-cherry"][data-cu-widget-field="title"]')
  const countdownTarget = dialog.querySelector('[data-cu-widget-field-product="v7-countdown-cherry"][data-cu-widget-field="targetDate"]')
  countdownTitle.value = "去看海"
  dispatchInput(countdownTitle)
  countdownTarget.value = "2026-08-05T18:30"
  dispatchInput(countdownTarget)

  assert.equal(document.querySelector('#phoneAppearancePreview [data-widget-product="v7-resume-dessert"]').dataset.widgetCategory, "function")

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
  assert.equal(stored.desktopWidgets.enabled, true)
  assert.equal(stored.desktopWidgets.items.find(item => item.productId === "v7-resume-dessert").enabled, true)
  assert.equal(stored.desktopWidgets.items.find(item => item.productId === "v7-photo-double").enabled, true)
  assert.equal(stored.homeLayout.pageCount, 2)
  assert.deepEqual(stored.homeLayout.items.find(item => item.key === "app:messages"), { key:"app:messages", page:0, x:1, y:3 })
  assert.deepEqual(stored.desktopWidgets.fields["v7-countdown-cherry"], {
    title:"去看海", targetDate:"2026-08-05T18:30",
  })
  assert.equal(stored.homeLayout.items.find(item => item.key === "widget:v7-resume-dessert").page, 1)
  assert.match(document.getElementById("reader-phone-user-css").textContent, /\.reader-phone-css-scope \.phone-profile/)
  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(document.activeElement.getAttribute("data-reader-phone-control"), trigger.getAttribute("data-reader-phone-control"))
})

test("phone appearance invalid CSS stays unapplied and cancel preserves exact stored bytes", async t => {
  const dom = installDom(t)
  const raw = '{ "wallpaper": "#d0e8f5", "borderRadius": 11, "customCss": ".phone-profile { opacity: .9; }" }'
  localStorage.setItem("moirain_phoneCustom", raw)
  await import(`../reader/reader.js?phone-appearance-cancel=${Date.now()}-${Math.random()}`)

  const trigger = await openPhoneAppearance()
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

test("saved custom decorations can change occupied cells and be deleted", async t => {
  installDom(t)
  const image = "data:image/png;base64,YQ=="
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    desktopWidgets:{
      enabled:true,
      customDecorations:[{ id:"custom-sticker01", name:"我的贴纸", image, size:"small" }],
    },
    homeLayout:{
      pageCount:1,
      items:[{ key:"custom:custom-sticker01", page:0, x:6, y:10 }],
    },
  }))
  await import(`../reader/reader.js?phone-custom-decoration=${Date.now()}-${Math.random()}`)

  await openPhoneAppearance()
  const dialog = document.querySelector(".cu-modal.phone-appearance-workbench")
  let homeItem = document.querySelector("#phoneAppearancePreview [data-phone-home-key='custom:custom-sticker01']")
  assert.ok(homeItem)
  assert.equal(homeItem.dataset.phoneHomeSize, "small")
  assert.match(homeItem.style.cssText, /--phone-home-width:\s*80px/)
  assert.match(homeItem.style.cssText, /--phone-home-height:\s*84px/)
  assert.ok(homeItem.querySelector('[data-custom-decoration="custom-sticker01"] img'))

  const wideButton = dialog.querySelector('[data-cu-custom-widget-size="custom-sticker01"][data-cu-custom-widget-size-value="wide"]')
  assert.equal(wideButton.getAttribute("aria-pressed"), "false")
  wideButton.click()
  homeItem = document.querySelector("#phoneAppearancePreview [data-phone-home-key='custom:custom-sticker01']")
  assert.equal(homeItem.dataset.phoneHomeSize, "wide")
  assert.match(homeItem.style.cssText, /--phone-home-width:\s*320px/)
  assert.match(homeItem.style.cssText, /--phone-home-height:\s*126px/)
  assert.equal(dialog.querySelector('[data-cu-custom-widget-size-value="wide"]').getAttribute("aria-pressed"), "true")

  dialog.querySelector('[data-cu-custom-widget-remove="custom-sticker01"]').click()
  assert.equal(document.querySelector("#phoneAppearancePreview [data-phone-home-key='custom:custom-sticker01']"), null)
  assert.equal(dialog.querySelector('[data-cu-custom-widget-installed="custom-sticker01"]'), null)
})

test("uploading a wide raster automatically adds an 8 by 3 decoration and survives reopening", async t => {
  const dom = installDom(t)
  globalThis.Image = class TestImage {
    constructor() {
      this.naturalWidth = 1600
      this.naturalHeight = 600
      this.width = 1600
      this.height = 600
    }
    set src(value) {
      this.currentSrc = value
      queueMicrotask(() => this.onload && this.onload())
    }
  }
  await import(`../reader/reader.js?phone-custom-upload=${Date.now()}-${Math.random()}`)

  await openPhoneAppearance()
  let dialog = document.querySelector(".cu-modal.phone-appearance-workbench")
  const fileInput = dialog.querySelector("[data-cu-custom-widget-file]")
  const pngSignature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
  const file = new dom.window.File([pngSignature], "wide-sticker.png", { type:"image/png" })
  Object.defineProperty(fileInput, "files", { configurable:true, value:[file] })
  fileInput.dispatchEvent(new Event("change", { bubbles:true }))
  await new Promise(resolve => setTimeout(resolve, 40))

  const customCard = dialog.querySelector("[data-cu-custom-widget-installed]")
  assert.ok(customCard)
  assert.match(customCard.textContent, /wide-sticker/)
  assert.match(customCard.textContent, /8 × 3 格/)
  const customId = customCard.dataset.cuCustomWidgetInstalled
  let homeItem = document.querySelector(`#phoneAppearancePreview [data-phone-home-key="custom:${customId}"]`)
  assert.ok(homeItem)
  assert.equal(homeItem.dataset.phoneHomeSize, "wide")
  assert.match(homeItem.style.cssText, /--phone-home-width:\s*320px/)

  document.getElementById("cuSave").click()
  const stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.deepEqual(stored.desktopWidgets.customDecorations.map(item => ({ name:item.name, size:item.size })), [
    { name:"wide-sticker", size:"wide" },
  ])

  await openPhoneAppearance()
  dialog = document.querySelector(".cu-modal.phone-appearance-workbench")
  homeItem = document.querySelector(`#phoneAppearancePreview [data-phone-home-key="custom:${customId}"]`)
  assert.ok(homeItem)
  assert.equal(homeItem.dataset.phoneHomeSize, "wide")
  assert.ok(dialog.querySelector(`[data-cu-custom-widget-installed="${customId}"]`))
})

test("phone appearance restores valid adjustments after an accidental close", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    borderRadius:18,
    fontSize:12,
    customCss:"",
  }))
  await import(`../reader/reader.js?phone-appearance-draft=${Date.now()}-${Math.random()}`)

  await openPhoneAppearance()
  const originalStorage = localStorage.getItem("moirain_phoneCustom")
  const radius = document.getElementById("cuRadius")
  radius.value = "30"
  dispatchInput(radius)
  document.getElementById("cuCancel").click()

  assert.equal(document.querySelector(".cu-modal-overlay"), null)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), originalStorage)

  await openPhoneAppearance()
  assert.equal(document.getElementById("cuRadius").value, "30")
  assert.match(document.getElementById("cuLiveStatus").textContent, /已恢复/)
  document.getElementById("cuSave").click()
  assert.equal(JSON.parse(localStorage.getItem("moirain_phoneCustom")).borderRadius, 30)
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
    desktopWidgets: {
      enabled: true,
      items: [{ kind: "resume", enabled: true, skin: "acrylic", size: "wide" }],
    },
    homeLayout: {
      pageCount:2,
      items:[
        { key:"widget:v7-resume-dessert", page:0, x:0, y:0 },
        { key:"app:memo", page:1, x:0, y:0 },
      ],
    },
    customCss: ".phone-profile { box-shadow: none; }",
  }))

  await import(`../reader/reader.js?phone-appearance-runtime=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
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
  assert.equal(frame.querySelector(".phone-home").dataset.phoneHomePages, "2")
  assert.ok(frame.querySelector("[data-phone-home-key='profile:identity'] .phone-profile"))
  assert.equal(frame.querySelector("[data-phone-home-key='app:memo']").dataset.phoneHomeItemPage, "1")
  frame.querySelector('[data-phone-home-page="1"]').click()
  assert.equal(frame.querySelector(".phone-home").dataset.phoneHomeActive, "1")
  assert.equal(frame.querySelector(".phone-home-track").style.transform, "translateX(-100%)")
  const functionalWidget = frame.querySelector('.phone-story-widget[data-widget-kind="resume"][data-widget-app="messages"]')
  assert.ok(functionalWidget)
  functionalWidget.click()
  assert.ok(document.querySelector(".rd-phone-app-messages"))
  assert.match(document.getElementById("reader-phone-user-css").textContent, /\.reader-phone-css-scope \.phone-profile/)
})

test("saved reader profile images can be replaced and cleared after reopening", async t => {
  const dom = installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    readerId:"旧昵称",
    readerSignature:"旧签名",
    readerAvatar:"data:image/png;base64,b2xkLWF2YXRhcg==",
    topBgImage:"data:image/png;base64,b2xkLWNvdmVy",
    homeLayout:{ pageCount:2, items:[{ key:"profile:identity", page:1, x:0, y:0 }] },
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
  await waitForSelector('.cu-modal.profile-appearance-workbench')

  const profileDialog = document.querySelector(".cu-modal.profile-appearance-workbench")
  assert.ok(profileDialog)
  assert.ok(profileDialog.querySelector('[data-appearance-page="preview"]'))
  assert.ok(profileDialog.querySelector('[data-appearance-page="controls"]'))
  assert.deepEqual(
    [...profileDialog.querySelectorAll(".profile-appearance-controls > .cu-settings-section")].map(section => section.id),
    ["cuProfileIdentity", "cuProfileAvatar", "cuProfileCover"],
  )
  assert.equal(document.getElementById("rpSignature").value, "旧签名")
  assert.equal(document.querySelector("#profileAppearancePreview .phone-home").dataset.phoneHomeActive, "1")
  document.getElementById("rpSignature").value = "慢慢读，慢慢喜欢。"
  document.getElementById("rpSignature").dispatchEvent(new Event("input", { bubbles:true }))
  assert.match(document.querySelector("#profileAppearancePreview .phone-profile-signature").textContent, /慢慢读/)
  assert.deepEqual(
    [...profileDialog.querySelectorAll(".profile-appearance-controls > .cu-settings-section")]
      .filter(section => section.open)
      .map(section => section.id),
    ["cuProfileIdentity"],
  )

  document.getElementById("rpUploadAv").click()
  assert.equal(document.getElementById("rpAvatarUrl").value, "data:image/png;base64,bmV3LWF2YXRhcg==")
  document.getElementById("rpSave").click()

  let stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.readerAvatar, "data:image/png;base64,bmV3LWF2YXRhcg==")
  assert.equal(stored.readerSignature, "慢慢读，慢慢喜欢。")

  document.querySelector('[data-reader-phone-control="profile"]').click()
  await waitForSelector('.cu-modal.profile-appearance-workbench')
  document.getElementById("rpClearAv").click()
  assert.equal(document.getElementById("rpAvatarUrl").value, "")
  document.getElementById("rpSave").click()

  stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.readerAvatar, null)

  document.querySelector('[data-reader-phone-control="profile"]').click()
  await waitForSelector('.cu-modal.profile-appearance-workbench')
  document.getElementById("rpClearTop").click()
  assert.equal(document.getElementById("rpTopBgUrl").value, "")
  document.getElementById("rpSave").click()

  stored = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(stored.topBgImage, null)
})

test("reader profile restores an accidentally closed draft", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({ readerId:"原昵称" }))
  await import(`../reader/reader.js?reader-profile-draft=${Date.now()}-${Math.random()}`)

  document.querySelector('[data-tab="custom"]').click()
  document.querySelector('[data-reader-phone-control="profile"]').click()
  await waitForSelector('.cu-modal.profile-appearance-workbench')
  const name = document.getElementById("rpName")
  name.value = "暂存昵称"
  name.dispatchEvent(new Event("input", { bubbles:true }))
  document.getElementById("rpCancel").click()

  assert.equal(JSON.parse(localStorage.getItem("moirain_phoneCustom")).readerId, "原昵称")
  document.querySelector('[data-reader-phone-control="profile"]').click()
  await waitForSelector('.cu-modal.profile-appearance-workbench')
  assert.equal(document.getElementById("rpName").value, "暂存昵称")
  assert.match(document.querySelector(".phone-appearance-status").textContent, /已恢复/)
  document.getElementById("rpSave").click()
  assert.equal(JSON.parse(localStorage.getItem("moirain_phoneCustom")).readerId, "暂存昵称")
})
