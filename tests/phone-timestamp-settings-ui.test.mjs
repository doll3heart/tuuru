import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  return dom
}

test("phone settings persist global timestamp hiding without clearing authored times", async t => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "phone-timestamp-settings",
    type: "article",
    phoneData: {
      contacts: [],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [{ id: "memo-1", content: "keep me", time: "memo-time-kept" }],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader" },
      apps: [{ id: "settings-app", type: "settings", name: "Settings", enabled: true }],
    },
  })
  t.after(() => {
    draft.dispose()
    dom.window.close()
  })

  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  const frame = document.getElementById("phoneFrame")
  const settingsIcon = frame.querySelector('[data-app-type="settings"]')
  assert.ok(settingsIcon)
  settingsIcon.click()

  const toggle = frame.querySelector("#hideAllTimestamps")
  assert.ok(toggle)
  assert.equal(toggle.checked, false)

  toggle.click()
  frame.querySelector("#flowSave").click()

  const saved = draft.snapshot().phoneData
  assert.equal(saved.displaySettings.hideAllTimestamps, true)
  assert.equal(saved.memos[0].time, "memo-time-kept")
})
