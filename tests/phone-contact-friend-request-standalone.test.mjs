import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("standalone contacts can stage a friend request and save it with the contact", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/",
  })
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    requestAnimationFrame: callback => { callback(); return 1 },
  })

  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "standalone-contact-friend-request",
    type: "phone",
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
      skin: { readerId: "Reader" },
      apps: [],
      readingFlow: { enabled: false, sequence: [] },
    },
  })
  const app = document.getElementById("app")
  app.innerHTML = renderPhoneEditor(draft.id)

  app.querySelector('[data-app-type="contacts"]').click()
  app.querySelector("#ctAddBtn").click()
  document.querySelector("#ctNewNameInput").value = "林雾"
  document.querySelector("#ctNewNameOk").click()

  const requestDialog = document.querySelector("[data-contact-friend-request-dialog]")
  assert.ok(requestDialog)
  requestDialog.querySelector("[data-contact-friend-request-note]").value = "我是林雾，昨晚见过。"
  requestDialog.closest(".modal-overlay").querySelector("[data-contact-friend-request-create]").click()

  assert.equal(draft.snapshot().phoneData.contacts.length, 0)
  app.querySelector("#ctSave").click()

  const saved = draft.snapshot().phoneData
  const contact = saved.contacts.find(item => item.name === "林雾")
  const request = saved.chats[0].rounds[0].messages[0]
  assert.ok(contact)
  assert.equal(request.actorContactId, contact.id)
  assert.equal(request.eventKind, "friend-request")
  assert.equal(request.originalText, "我是林雾，昨晚见过。")
  assert.equal(saved.readingFlow.enabled, true)
  assert.equal(saved.readingFlow.sequence[0].itemId, request.id)

  draft.dispose()
  await new Promise(resolve => setTimeout(resolve, 100))
  dom.window.close()
})
