import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("standalone phone Apps restore the desktop and open the mention picker", async () => {
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
      contacts: [{ id: "contact-1", name: "读者" }],
      chats: [{
        id: "chat-1",
        type: "single",
        contactIds: ["contact-1"],
        rounds: [{ id: "round-1", label: "读者", messages: [] }],
        messages: [],
      }],
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

  const forumIcon = frame.querySelector('[data-app-type="forum"]')
  assert.ok(forumIcon)
  forumIcon.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  frame.querySelector("#fbAddPost").click()
  document.querySelector("#idOk").click()
  const content = document.querySelector("#fpContent")
  content.value = "@"
  content.setSelectionRange(1, 1)
  content.dispatchEvent(new dom.window.InputEvent("input", {
    bubbles: true,
    data: "@",
    inputType: "insertText",
  }))
  assert.ok(document.querySelector(".phone-mention-picker"))
  document.querySelector(".phone-mention-picker-option").click()
  document.querySelector("#fpCancel").click()
  frame.querySelector("#forumBack").click()

  frame.querySelector('[data-app-type="messages"]').click()
  frame.querySelector('[data-chat-id="chat-1"]').click()
  const chatInput = frame.querySelector("#chatInput")
  chatInput.value = "@"
  chatInput.setSelectionRange(1, 1)
  chatInput.dispatchEvent(new dom.window.InputEvent("input", {
    bubbles: true,
    data: "@",
    inputType: "insertText",
  }))
  assert.ok(document.querySelector(".phone-mention-picker"))

  draft.dispose()
  await new Promise(resolve => setTimeout(resolve, 60))
  dom.window.close()
})
