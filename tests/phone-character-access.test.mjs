import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
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
  t.after(() => dom.window.close())
}

function makePhoneData() {
  return {
    contacts: [
      { id: "contact-a", name: "林澈", avatarUrl: "" },
      { id: "contact-b", name: "阿满", avatarUrl: "" },
    ],
    chats: [],
    moments: [],
    forumPosts: [],
    forumNpcs: [],
    memos: [
      { id: "memo-a", contactId: "contact-a", content: "林澈的备忘录" },
      { id: "memo-b", contactId: "contact-b", content: "阿满的备忘录" },
    ],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [],
    skin: { readerId: "Reader" },
    apps: [{ id: "memo-app", type: "memo", name: "备忘录", enabled: true }],
  }
}

test("author assigns the connected character and story hint before editing a locked App", async t => {
  installDom(t)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id: "character-access-author",
    type: "article",
    phoneData: makePhoneData(),
  })
  t.after(() => draft.dispose())

  const overlay = openPhoneAppModal(draft.id, "memo")
  const panel = overlay.querySelector(".character-access-panel")
  assert.ok(panel, "locked Apps should open the author connection setup first")
  assert.equal(panel.querySelector(".tarot-card"), null)
  assert.match(panel.textContent, /读者不会在这里选择角色/)

  const contacts = panel.querySelectorAll(".character-access-option")
  assert.equal(contacts.length, 2)
  assert.deepEqual([...contacts].map(option => option.dataset.contactId), ["contact-a", "contact-b"])

  contacts[1].click()
  const prompt = panel.querySelector("#characterAccessPrompt")
  const continueButton = panel.querySelector("#characterAccessContinue")
  assert.ok(prompt)
  assert.ok(continueButton)
  prompt.value = "这段信号来自刚才在车站遇见的人。"
  continueButton.click()

  const connection = draft.snapshot().phoneData.appConnections.memo
  assert.deepEqual(connection, {
    contactId: "contact-b",
    prompt: "这段信号来自刚才在车站遇见的人。",
  })
  assert.ok(overlay.querySelector("#memoPanel"))
  assert.match(overlay.textContent, /阿满的备忘录/)
  assert.doesNotMatch(overlay.textContent, /林澈的备忘录/)
})

test("the standalone phone icon opens the same character connection setup", async t => {
  installDom(t)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import(`../js/pages/phone.js?character-access-standalone=${Date.now()}`)
  const draft = createPhoneWorkDraft({
    id: "character-access-standalone",
    type: "phone",
    phoneData: makePhoneData(),
  })
  t.after(() => draft.dispose())

  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  const frame = document.getElementById("phoneFrame")
  const memoIcon = frame.querySelector('[data-app-type="memo"]')
  assert.ok(memoIcon)

  memoIcon.dispatchEvent(new MouseEvent("click", { bubbles: true }))

  const panel = frame.querySelector(".character-access-panel")
  assert.ok(panel)
  assert.equal(panel.querySelector(".tarot-card"), null)
  assert.equal(panel.querySelectorAll(".character-access-option").length, 2)
  assert.ok(panel.querySelector("#characterAccessContinue"))
  assert.equal(document.activeElement, panel.querySelector('.character-access-option[aria-pressed="true"]'))

  panel.querySelector("#characterAccessBack").click()
  const restoredMemoIcon = frame.querySelector('[data-app-type="memo"]')
  assert.ok(restoredMemoIcon)
  assert.equal(document.activeElement, restoredMemoIcon)
})

test("an existing author connection is selected when its App is reopened", async t => {
  installDom(t)
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const phoneData = makePhoneData()
  phoneData.appConnections = {
    memo: { contactId: "contact-b", prompt: "上次保存的提示。" },
  }
  const draft = createPhoneWorkDraft({
    id: "character-access-existing",
    type: "article",
    phoneData,
  })
  t.after(() => draft.dispose())

  const overlay = openPhoneAppModal(draft.id, "memo")
  const selected = overlay.querySelector('.character-access-option[aria-pressed="true"]')
  assert.ok(selected)
  assert.equal(selected.dataset.contactId, "contact-b")
  assert.equal(overlay.querySelector("#characterAccessPrompt").value, "上次保存的提示。")
})
