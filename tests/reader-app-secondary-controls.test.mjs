import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function ruleBodiesFor(selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(readerCss))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

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
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function seedPhoneWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

function phoneWork() {
  const hostilePostId = 'post-1" autofocus data-forged="yes'
  const icon = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>'
  return {
    schemaVersion: 1,
    id: "reader-secondary-controls",
    type: "phone",
    title: "Reader controls",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-a", name: "Alice" }],
      chats: [{ id: "chat-a", type: "single", contactIds: ["contact-a"], messages: [] }],
      moments: [],
      forumPosts: [{
        id: hostilePostId,
        contactId: "contact-a",
        contactName: "Alice",
        title: "First post",
        content: "Post body",
        time: "",
      }],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [
        { id: "cart-a", contactId: "contact-a", status: "cart", name: "Cart item", price: 10 },
        { id: "order-a", contactId: "contact-a", status: "order", name: "Order item", price: 20 },
      ],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [
        { id: "messages-app", type: "messages", name: "Messages", icon, desktopX: 0, desktopY: 0, enabled: true },
        { id: "forum-app", type: "forum", name: "Forum", icon, desktopX: 1, desktopY: 0, enabled: true },
        { id: "shopping-app", type: "shopping", name: "Shopping", icon, desktopX: 2, desktopY: 0, enabled: true },
      ],
    },
  }
}

function returnToDesktop() {
  document.querySelector(".rd-back-btn").click()
  assert.ok(document.getElementById("phoneDesktopReader"))
}

test("reader App lists and shopping tabs use native controls with focus continuity", async t => {
  const dom = installDom(t)
  const work = phoneWork()
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-secondary-controls=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  document.querySelector('[data-app-type="messages"]').click()
  let chat = document.querySelector(".rd-chat-card")
  assert.equal(chat.tagName, "BUTTON")
  assert.equal(chat.type, "button")
  assert.equal(chat.dataset.chatIndex, "0")
  assert.match(chat.getAttribute("aria-label") ?? "", /Alice/)
  chat.focus()
  chat.click()
  assert.ok(document.getElementById("chatBack"))
  document.getElementById("chatBack").click()
  chat = document.querySelector('.rd-chat-card[data-chat-index="0"]')
  assert.equal(document.activeElement, chat)
  returnToDesktop()

  document.querySelector('[data-app-type="forum"]').click()
  let post = document.querySelector(".rd-post-card")
  assert.equal(post.tagName, "BUTTON")
  assert.equal(post.type, "button")
  assert.equal(post.dataset.postIndex, "0")
  assert.equal(post.getAttribute("data-post-id"), null)
  assert.equal(document.querySelector("[data-forged]"), null)
  assert.match(post.getAttribute("aria-label") ?? "", /First post/)
  assert.equal(post.querySelector(".rd-forum-meta").textContent, "Alice")
  post.focus()
  post.click()
  assert.match(document.querySelector(".phone-frame").textContent, /First post/)
  assert.equal(document.querySelector(".rd-forum-post-author time"), null)
  document.querySelector(".rd-back-btn").click()
  post = document.querySelector('.rd-post-card[data-post-index="0"]')
  assert.equal(document.activeElement, post)
  returnToDesktop()

  document.querySelector('[data-app-type="shopping"]').click()
  const tabList = document.querySelector(".rd-shop-tabs")
  const tabs = [...tabList.querySelectorAll(".rd-shop-tab")]
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")))

  assert.equal(tabList.getAttribute("role"), "tablist")
  assert.equal(tabs.length, 2)
  for (const [index, tab] of tabs.entries()) {
    assert.equal(tab.tagName, "BUTTON")
    assert.equal(tab.type, "button")
    assert.equal(tab.getAttribute("role"), "tab")
    assert.equal(tab.getAttribute("aria-selected"), index === 0 ? "true" : "false")
    assert.equal(tab.getAttribute("tabindex"), index === 0 ? "0" : "-1")
    assert.equal(panels[index].getAttribute("role"), "tabpanel")
    assert.equal(panels[index].hidden, index !== 0)
  }

  tabs[0].focus()
  tabs[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  assert.equal(document.activeElement, tabs[1])
  assert.equal(tabs[1].getAttribute("aria-selected"), "true")
  assert.equal(panels[0].hidden, true)
  assert.equal(panels[1].hidden, false)
  assert.match(panels[1].textContent, /Order item/)

  tabs[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  assert.equal(document.activeElement, tabs[0])
  tabs[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }))
  assert.equal(document.activeElement, tabs[1])
  tabs[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }))
  assert.equal(document.activeElement, tabs[0])
})

test("reader App secondary controls keep touch-sized focus contracts", () => {
  const rows = ruleBodiesFor(".rd-chat-card") + ruleBodiesFor(".rd-post-card")
  const rowFocus = ruleBodiesFor(".rd-chat-card:focus-visible") + ruleBodiesFor(".rd-post-card:focus-visible")
  const shopTab = ruleBodiesFor(".rd-shop-tab")
  const shopFocus = ruleBodiesFor(".rd-shop-tab:focus-visible")

  assert.match(rows, /min-height\s*:\s*(?:44|[5-9]\d|[1-9]\d{2,})px/)
  assert.match(rows, /appearance\s*:\s*none/)
  assert.match(rows, /width\s*:\s*100%/)
  assert.match(rowFocus, /outline\s*:\s*2px solid var\(--c-primary-hover\)/)
  assert.match(shopTab, /min-height\s*:\s*44px/)
  assert.match(shopTab, /appearance\s*:\s*none/)
  assert.match(shopFocus, /outline\s*:\s*2px solid var\(--c-primary-hover\)/)
})

test("reader forum keeps pinned posts first and shows authored post states", async t => {
  installDom(t)
  const work = phoneWork()
  work.id = "reader-forum-post-states"
  work.phoneData.forumPosts.push({
    id:"post-pinned",
    contactId:"contact-a",
    contactName:"Alice",
    title:"Pinned featured post",
    content:"Important post body",
    pinned:true,
    featured:true,
    comments:[],
  })
  seedPhoneWork(work)

  await import(`../reader/reader.js?reader-forum-post-states=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="forum"]').click()

  const cards = [...document.querySelectorAll(".rd-post-card")]
  assert.deepEqual(cards.map(card => card.querySelector(".rd-forum-title").textContent), ["Pinned featured post", "First post"])
  assert.equal(cards[0].querySelector(".rd-forum-post-pinned").textContent, "置顶")
  assert.equal(cards[0].querySelector(".rd-forum-post-featured").textContent, "精华")
  assert.equal(cards[1].querySelector(".rd-forum-post-state"), null)
})
