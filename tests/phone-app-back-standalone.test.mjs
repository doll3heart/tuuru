import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("an App Back control still restores the standalone phone desktop", async () => {
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

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "standalone-phone-back",
    type: "phone",
    phoneData: {
      contacts: [{ id: "contact-1", name: "Contact" }],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader" },
      apps: [],
    },
  })
  const app = document.getElementById("app")
  app.innerHTML = renderPhoneEditor(draft.id)
  const frame = document.getElementById("phoneFrame")
  const messagesIcon = frame.querySelector('[data-app-type="messages"]')
  assert.ok(messagesIcon)

  messagesIcon.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))

  assert.ok(frame.querySelector("#msgPanel"))
  frame.querySelector("#msgBack").click()

  assert.equal(frame.querySelector("#msgPanel"), null)
  assert.ok(frame.querySelector("#phoneDesktop"))
  draft.dispose()
  await new Promise(resolve => setTimeout(resolve, 60))
  dom.window.close()
})
