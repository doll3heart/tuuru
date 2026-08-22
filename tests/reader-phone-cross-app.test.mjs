import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
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

function crossAppWork(id) {
  return {
    schemaVersion:1,
    id,
    type:"phone",
    title:"Cross App",
    placeholders:[],
    scenes:[],
    phoneData:{
      contacts:[{ id:"contact-1", name:"林晚", avatarUrl:"" }],
      chats:[{
        id:"chat-1",
        type:"single",
        contactIds:["contact-1"],
        messages:[],
        rounds:[{
          id:"round-1",
          messages:[
            { id:"memo-link", type:"link", senderId:"contact-1", linkTitle:"花盆下的钥匙", targetApp:"memo", targetItemId:"memo-1", targetContactId:"contact-1", actionRequired:true },
            { id:"forum-link", type:"link", senderId:"contact-1", linkTitle:"北门值班记录", targetApp:"forum", targetItemId:"post-1" },
            { id:"order-link", type:"link", senderId:"contact-1", linkTitle:"旧站钥匙", targetApp:"shopping", targetItemId:"order-1", targetContactId:"contact-1" },
            { id:"contact-link", type:"link", senderId:"contact-1", linkTitle:"林晚", targetApp:"contacts", targetItemId:"contact-1", targetContactId:"contact-1" },
            { id:"quoted", type:"text", senderId:"self", text:"我会去找。", quoteId:"memo-link", quoteText:"链接：花盆下的钥匙", quoteSenderName:"林晚" },
          ],
        }],
      }],
      moments:[],
      forumPosts:[{ id:"post-1", title:"北门值班记录", content:"今晚换岗。", contactId:"contact-1", comments:[] }],
      forumNpcs:[],
      memos:[{ id:"memo-1", contactId:"contact-1", content:"<p>钥匙放在花盆下。</p>", time:"今晚" }],
      photos:[],
      albums:[],
      browserHistory:[],
      shoppingItems:[{ id:"order-1", contactId:"contact-1", name:"旧站钥匙", price:23.17, status:"order", logistics:"已送达" }],
      skin:{ readerId:"Reader", showDynamicIsland:false, showHomeIndicator:false },
      apps:[
        { id:"messages-app", type:"messages", name:"消息", icon:"M", desktopX:0, desktopY:0, enabled:true },
        { id:"forum-app", type:"forum", name:"论坛", icon:"F", desktopX:1, desktopY:0, enabled:true },
        { id:"memo-app", type:"memo", name:"备忘录", icon:"N", desktopX:2, desktopY:0, enabled:true },
        { id:"shopping-app", type:"shopping", name:"购物", icon:"S", desktopX:3, desktopY:0, enabled:true },
        { id:"contacts-app", type:"contacts", name:"联系人", icon:"C", desktopX:0, desktopY:1, enabled:true },
      ],
    },
  }
}

async function startWork(t, work, key) {
  const dom = installDom(t)
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?cross-app=${key}-${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]')?.click()
  return dom
}

function waitForPopstate(window) {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 80)
    window.addEventListener("popstate", () => {
      clearTimeout(fallback)
      setTimeout(resolve, 0)
    }, { once:true })
  })
}

function clickMessage(id) {
  const message = document.querySelector(`[data-message-id="${id}"]`)
  assert.ok(message, `missing message ${id}`)
  const card = message.querySelector("[data-chat-deep-link]")
  assert.ok(card, `missing deep link for ${id}`)
  card.click()
}

async function waitFor(read, timeout = 1600) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = read()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail("timed out waiting for reader state")
}

test("message cards open real App content and return to the exact source message", async t => {
  const work = crossAppWork("cross-app-memo-return")
  await startWork(t, work, "memo")

  clickMessage("memo-link")
  const memo = document.querySelector('[data-memo-id="memo-1"]')
  assert.ok(memo)
  assert.equal(memo.classList.contains("is-deep-link-target"), true)
  assert.equal(document.querySelector(".rd-connection-gate"), null)

  document.querySelector(".rd-phone-app-memo .rd-back-btn").click()
  const source = await waitFor(() => document.querySelector('[data-message-id="memo-link"]'))
  assert.equal(source.classList.contains("is-return-target"), true)
  assert.match(source.textContent, /已查看/)
})

test("browser Back from a linked App returns to the exact source chat", async t => {
  const work = crossAppWork("cross-app-browser-back-return")
  const dom = await startWork(t, work, "browser-back-return")

  clickMessage("memo-link")
  assert.ok(document.querySelector(".rd-phone-app-memo"))

  const popped = waitForPopstate(dom.window)
  dom.window.history.back()
  await popped

  const source = await waitFor(() => document.querySelector('[data-message-id="memo-link"]'))
  assert.ok(document.getElementById("chatBack"), "browser Back must keep the reader in the source chat")
  assert.equal(source.classList.contains("is-return-target"), true)
})

test("late image load after browser Back preserves the restored source-chat reading position", async t => {
  const work = crossAppWork("reader-cross-app-late-image-scroll")
  work.phoneData.chats[0].rounds[0].messages.unshift({
    id:"late-image",
    type:"image",
    senderId:"contact-1",
    image:"data:image/png;base64,YQ==",
  })
  const dom = await startWork(t, work, "reader-test-cross-app-late-image-scroll")

  let chatScrollHeight = 1000
  const previousScrollHeight = Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, "scrollHeight")
  const previousClientHeight = Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, "clientHeight")
  const previousRect = dom.window.HTMLElement.prototype.getBoundingClientRect
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", {
    configurable:true,
    get() { return this.id === "chatMsgArea" ? chatScrollHeight : 0 },
  })
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
    configurable:true,
    get() { return this.id === "chatMsgArea" ? 200 : 0 },
  })
  dom.window.HTMLElement.prototype.getBoundingClientRect = function() {
    if (this.id === "chatMsgArea") {
      return { top:0, bottom:200, left:0, right:320, width:320, height:200, x:0, y:0 }
    }
    if (this.matches?.("[data-message-id]")) {
      const top = 200 - (document.getElementById("chatMsgArea")?.scrollTop || 0)
      return { top, bottom:top + 50, left:0, right:300, width:300, height:50, x:0, y:top }
    }
    return previousRect.call(this)
  }
  t.after(() => {
    if (previousScrollHeight) Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", previousScrollHeight)
    else delete dom.window.HTMLElement.prototype.scrollHeight
    if (previousClientHeight) Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", previousClientHeight)
    else delete dom.window.HTMLElement.prototype.clientHeight
    dom.window.HTMLElement.prototype.getBoundingClientRect = previousRect
  })

  const sourceArea = document.getElementById("chatMsgArea")
  sourceArea.scrollTop = 100
  sourceArea.dispatchEvent(new dom.window.Event("scroll"))
  clickMessage("memo-link")

  const rafQueue = []
  const previousRaf = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length }
  t.after(() => { globalThis.requestAnimationFrame = previousRaf })

  const popped = waitForPopstate(dom.window)
  dom.window.history.back()
  await popped
  const returnedArea = await waitFor(() => document.getElementById("chatMsgArea"))
  while (rafQueue.length) rafQueue.shift()()
  assert.equal(returnedArea.scrollTop, 100)

  chatScrollHeight = 1200
  returnedArea.querySelector('[data-message-id="late-image"] img')
    .dispatchEvent(new dom.window.Event("load"))
  while (rafQueue.length) rafQueue.shift()()
  assert.equal(
    returnedArea.scrollTop,
    100,
    "late media growth must not snap a restored reading position to the bottom",
  )
})

test("browser Back from a linked forum post returns to the exact source chat", async t => {
  const work = crossAppWork("cross-app-forum-browser-back-return")
  const dom = await startWork(t, work, "forum-browser-back-return")

  clickMessage("forum-link")
  assert.ok(document.querySelector(".rd-forum-detail"))

  const popped = waitForPopstate(dom.window)
  dom.window.history.back()
  await popped

  const source = await waitFor(() => document.querySelector('[data-message-id="forum-link"]'))
  assert.ok(document.getElementById("chatBack"), "browser Back must keep the reader in the source chat")
  assert.equal(source.classList.contains("is-return-target"), true)
})

test("forum, shopping, and contact cards land on the authored item", async t => {
  const work = crossAppWork("cross-app-destinations")
  await startWork(t, work, "destinations")

  clickMessage("forum-link")
  assert.ok(document.querySelector(".rd-forum-detail"))
  assert.match(document.querySelector(".rd-forum-detail").textContent, /北门值班记录/)
  document.querySelector(".rd-forum-detail-header .rd-back-btn").click()
  await waitFor(() => document.querySelector('[data-message-id="forum-link"].is-return-target'))

  clickMessage("order-link")
  assert.equal(document.querySelector("#rdShopOrderTab").getAttribute("aria-selected"), "true")
  assert.ok(document.querySelector('[data-shopping-id="order-1"].is-deep-link-target'))
  document.querySelector(".rd-phone-app-shopping .rd-back-btn").click()
  await waitFor(() => document.querySelector('[data-message-id="order-link"].is-return-target'))

  clickMessage("contact-link")
  assert.ok(document.querySelector('[data-contact-id="contact-1"].is-deep-link-target'))
  document.querySelector(".rd-phone-app-contacts .rd-back-btn").click()
  await waitFor(() => document.querySelector('[data-message-id="contact-link"].is-return-target'))
})

test("quoted previews focus the original message without leaving the chat", async t => {
  const work = crossAppWork("cross-app-quote-focus")
  await startWork(t, work, "quote")

  const quote = document.querySelector('[data-message-id="quoted"] .chat-quote-preview')
  assert.ok(quote)
  quote.click()
  const original = document.querySelector('[data-message-id="memo-link"]')
  assert.equal(original.classList.contains("is-quote-target"), true)
  assert.ok(document.getElementById("chatMsgArea"))
})

test("a required card holds the authored flow until the reader completes its action", async t => {
  const work = crossAppWork("cross-app-required-flow")
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"required-location", type:"location", senderId:"contact-1", locationName:"白石街", locationAddress:"旧城区 17 号", actionRequired:true },
    { id:"after-action", type:"text", senderId:"contact-1", text:"现在可以继续了。" },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"required-location", chatId:"chat-1", roundId:"round-1", label:"查看位置" },
      { type:"messages", itemId:"after-action", chatId:"chat-1", roundId:"round-1", label:"继续消息" },
    ],
  }
  await startWork(t, work, "required")

  const card = document.querySelector('[data-message-id="required-location"] [data-story-card="location"]')
  assert.ok(card)
  assert.match(card.textContent, /需查看/)
  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.equal(document.querySelector('[data-message-id="after-action"]'), null)

  card.click()
  assert.match(document.querySelector('[data-message-id="required-location"]').textContent, /已查看/)
  await waitFor(() => document.querySelector('[data-message-id="after-action"]'), 1800)
})

test("a required cross-App card resumes the flow only after returning to chat", async t => {
  const work = crossAppWork("cross-app-required-return")
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"memo-link", type:"link", senderId:"contact-1", linkTitle:"花盆下的钥匙", targetApp:"memo", targetItemId:"memo-1", targetContactId:"contact-1", actionRequired:true },
    { id:"after-memo", type:"text", senderId:"contact-1", text:"你已经看到了。" },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"memo-link", chatId:"chat-1", roundId:"round-1", label:"查看备忘录" },
      { type:"messages", itemId:"after-memo", chatId:"chat-1", roundId:"round-1", label:"继续消息" },
    ],
  }
  await startWork(t, work, "required-return")

  clickMessage("memo-link")
  assert.ok(document.querySelector(".rd-phone-app-memo"))
  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.ok(document.querySelector(".rd-phone-app-memo"), "the target App should not be replaced while the reader is viewing it")

  document.querySelector(".rd-phone-app-memo .rd-back-btn").click()
  await waitFor(() => document.querySelector('[data-message-id="after-memo"]'), 1800)
})

test("opening a linked App pauses an unsequenced choice branch until chat resumes", async t => {
  const work = crossAppWork("cross-app-choice-playback-pause")
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"memo-link", type:"link", senderId:"contact-1", linkTitle:"花盆下的钥匙", targetApp:"memo", targetItemId:"memo-1", targetContactId:"contact-1" },
    {
      id:"choice-owner",
      type:"text",
      senderId:"contact-1",
      text:"要现在去看吗？",
      choices:[{
        id:"choice-open",
        text:"先去看看",
        replyText:"",
        silent:true,
        replyPace:"instant",
        followUpMessages:[{
          id:"delayed-follow-up",
          type:"text",
          senderId:"contact-1",
          text:"看完再回来告诉我。",
          revealMode:"instant",
          delayBeforeMs:900,
        }],
      }],
    },
  ]
  await startWork(t, work, "choice-playback-pause")

  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  clickMessage("memo-link")
  assert.ok(document.querySelector(".rd-phone-app-memo"))

  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.ok(
    document.querySelector(".rd-phone-app-memo"),
    "a pending chat timer must not replace the linked App or advance the branch in the background",
  )

  document.querySelector(".rd-phone-app-memo .rd-back-btn").click()
  assert.equal(document.querySelector('[data-message-id="delayed-follow-up"]'), null)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("看完再回来告诉我。"), 2200)
})
