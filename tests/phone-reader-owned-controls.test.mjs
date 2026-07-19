import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t, url = "http://localhost/") {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url })
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

function phoneApp(id, type, desktopX) {
  return {
    id,
    type,
    name: type,
    icon: "?",
    color: "#f0f0f0",
    desktopX,
    desktopY: 0,
    enabled: true,
  }
}

test("author phone removes reader-owned appearance and profile Apps from legacy work", async t => {
  installDom(t)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "reader-owned-legacy-apps",
    type: "phone",
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "读者", showAppLabels: true },
      apps: [
        phoneApp("settings", "settings", 0),
        phoneApp("customize", "customize", 1),
        phoneApp("profile", "profile", 2),
        phoneApp("messages", "messages", 3),
      ],
    },
  })

  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  await new Promise(resolve => setTimeout(resolve, 70))

  assert.equal(document.querySelector('[data-app-type="customize"]'), null)
  assert.equal(document.querySelector('[data-app-type="profile"]'), null)
  assert.ok(document.querySelector('[data-app-type="settings"]'))
  assert.ok(document.querySelector('[data-app-type="messages"]'))
  assert.deepEqual(
    draft.snapshot().phoneData.apps.filter(app => ["customize", "profile"].includes(app.type)),
    [],
  )

  draft.dispose()
})

test("reader exposes article, phone appearance, and profile as reader-owned controls", async t => {
  installDom(t, "http://localhost/reader/")
  await import(`../reader/reader.js?reader-owned-controls=${Date.now()}`)

  document.querySelector('[data-tab="custom"]').click()

  assert.equal(document.querySelector('.rd-app-icon[data-app="customize"]'), null)
  assert.equal(document.querySelector('.rd-app-icon[data-app="profile"]'), null)

  const reading = document.querySelector('[data-reader-phone-control="reading"]')
  const appearance = document.querySelector('[data-reader-phone-control="appearance"]')
  const profile = document.querySelector('[data-reader-phone-control="profile"]')
  assert.ok(reading)
  assert.ok(appearance)
  assert.ok(profile)
  assert.equal(reading.tagName, "BUTTON")
  assert.equal(appearance.tagName, "BUTTON")
  assert.equal(profile.tagName, "BUTTON")

  reading.click()
  assert.ok(document.querySelector(".rs-sheet"))
  document.getElementById("rsClose").click()

  appearance.click()
  assert.ok(document.getElementById("cuSave"))
  document.getElementById("cuCancel").click()

  profile.click()
  assert.ok(document.getElementById("rpSave"))
})

test("reader-owned phone controls keep large touch targets and visible focus", () => {
  const controlRule = readerCss.match(/\.rd-phone-owner-control\s*\{([^}]*)\}/)?.[1] ?? ""
  assert.match(controlRule, /min-height:\s*44px/)
  assert.match(
    readerCss,
    /\.rd-phone-owner-control:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-primary-hover\)/,
  )
})
