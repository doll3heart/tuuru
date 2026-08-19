import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

const readerCss = await readFile(new URL("../reader/reader.css", import.meta.url), "utf8")
const authorCss = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")
const authorPhoneSource = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")

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
}

function seedWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

async function startWork(work, key) {
  seedWork(work)
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

async function waitFor(check, timeoutMs = 2500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail("timed out waiting for reader flow state")
}

function articleWork() {
  return {
    schemaVersion: 1,
    id: "critical-article",
    type: "article",
    title: "Article",
    placeholders: [], scenes: [], chapters: [
      { id: "chapter-one", name: "第一节" },
      { id: "chapter-two", name: "第二节" },
    ],
    startNode: "start",
    nodes: [
      { id: "start", title: "第一节", chapterId: "chapter-one", content: '<p>开头</p><div class="pm-inline-card" data-pm-id="memo-module" data-pm-type="memo"><span>备忘录</span></div>', choices: [{ id: "go", text: "下一节", targetId: "second" }] },
      { id: "second", title: "第二节", chapterId: "chapter-two", content: "<p>继续</p>", choices: [] },
    ],
    phoneModules: [{
      id: "memo-module",
      nodeId: "start",
      type: "memo",
      label: "备忘录",
      data: { contacts: [], memos: [{ id: "memo-1", content: "直接打开我" }] },
    }],
  }
}

function flowPhoneWork() {
  return {
    schemaVersion: 1,
    id: "critical-flow-phone",
    type: "phone",
    title: "Flow phone",
    placeholders: [], scenes: [],
    phoneData: {
      contacts: [{ id: "contact-1", name: "林澈" }],
      chats: [{ id: "chat-1", type: "single", contactIds: ["contact-1"], rounds: [{
        id: "round-1",
        messages: [
          { id: "message-1", type: "text", senderId: "contact-1", text: "第一项消息" },
          { id: "choice-1", type: "text", senderId: "contact-1", text: "第二项选择", choices: [{ id: "choice-a", text: "我知道了", replyText: "我知道了", followUpMessages: [{ id: "choice-follow-up", type: "text", senderId: "contact-1", text: "那就接电话吧" }] }] },
          { id: "call-1", type: "call", callMode: "voice", senderId: "contact-1", callLines: ["第二项通话"] },
        ],
      }] }],
      moments: [], forumPosts: [], forumNpcs: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      memos: [{ id: "memo-1", contactId: "contact-1", content: "第三项备忘录" }],
      apps: [
        { id: "messages-app", type: "messages", name: "消息", icon: "M", desktopX: 0, desktopY: 0, enabled: true },
        { id: "memo-app", type: "memo", name: "备忘录", icon: "N", desktopX: 1, desktopY: 0, enabled: true },
      ],
      skin: { showDynamicIsland: false, showHomeIndicator: false },
      readingFlow: { enabled: true, sequence: [
        { type: "messages", itemId: "message-1", chatId: "chat-1", roundId: "round-1", label: "第一项消息" },
        { type: "messages", itemId: "choice-1", chatId: "chat-1", roundId: "round-1", label: "第二项选择" },
        { type: "messages", itemId: "call-1", chatId: "chat-1", roundId: "round-1", label: "第三项语音通话" },
        { type: "memo", itemId: "memo-1", contactId: "contact-1", label: "第四项备忘录" },
      ] },
    },
  }
}

test("non-message flow cues do not use a side-tab accent border", () => {
  const cueRule = readerCss.slice(
    readerCss.indexOf(".rd-flow-cue {"),
    readerCss.indexOf(".rd-phone-app-body > .rd-flow-cue"),
  )

  assert.match(cueRule, /border:\s*1px solid/)
  assert.doesNotMatch(cueRule, /border-left\s*:/)
})

test("flow notifications stay above the phone profile and retain reduced motion", () => {
  assert.match(
    readerCss,
    /\.phone-frame\s*>\s*\.phone-flow-notification\s*\{[^}]*z-index\s*:\s*20/,
  )
  assert.match(
    readerCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.phone-flow-notification\s*\{[^}]*animation\s*:\s*none/,
  )
})

test("inline forum picture-in-picture overrides direct-child panel positioning", () => {
  assert.match(
    readerCss,
    /\.rd-phone-app-panel\s*>\s*\.rd-inline-forum-pip\s*\{[^}]*position\s*:\s*absolute[^}]*z-index\s*:\s*40/,
  )
})

test("completed call records occupy separate centered rows", () => {
  const recordRule = readerCss.slice(
    readerCss.indexOf(".rd-call-card.rd-call-record {"),
    readerCss.indexOf(".rd-call-card.rd-call-record > .rd-call-record-icon"),
  )
  assert.match(recordRule, /width:\s*max-content/)
  assert.match(recordRule, /margin:\s*4px auto/)
  assert.match(recordRule, /display:\s*flex/)
})

test("article nodes flow as chapter text with a one-and-a-half paragraph boundary", () => {
  const contentRule = readerCss.slice(
    readerCss.indexOf(".article-content {"),
    readerCss.indexOf(".article-node:not(:last-child)"),
  )
  const previousNodeEndingRule = readerCss.slice(
    readerCss.indexOf(".article-node:not(:last-child)"),
    readerCss.indexOf(".article-node + .article-node {"),
  )
  const adjacentNodeRule = readerCss.slice(
    readerCss.indexOf(".article-node + .article-node {"),
    readerCss.indexOf(".article-node-title {"),
  )

  assert.match(contentRule, /margin-bottom:\s*0/)
  assert.match(previousNodeEndingRule, /margin-bottom:\s*0/)
  assert.match(adjacentNodeRule, /margin-top:\s*0/)
  assert.match(
    adjacentNodeRule,
    /padding-top:\s*calc\(var\(--rd-paragraph-spacing,\s*1em\)\s*\*\s*1\.5\)/,
  )
  assert.match(adjacentNodeRule, /border-top:\s*0/)
})

test("reader desktop keeps authored App colors on the neutral default surface", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "reader-neutral-app-surfaces"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.apps[0].color = "#ff0000"
  work.phoneData.apps[1].color = "#00ff00"

  await startWork(work, "reader-neutral-app-surfaces")

  const surfaces = [...document.querySelectorAll(".phone-app-icon .phone-icon-body")]
  assert.equal(surfaces.length, 2)
  surfaces.forEach(surface => {
    assert.match(surface.getAttribute("style"), /background:#f0f0f0/)
  })
})

test("reader contact remarks stay local to the reading slot and carry into messages", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "reader-local-contact-remarks"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = work.phoneData.chats[0].rounds[0].messages.filter(message => message.type !== "call")
  work.phoneData.apps.push({
    id:"contacts-app",
    type:"contacts",
    name:"联系人",
    icon:"C",
    desktopX:2,
    desktopY:0,
    enabled:true,
  })

  await startWork(work, "reader-local-contact-remarks")

  document.querySelector('[data-app-type="contacts"]').click()
  const contactEntry = document.querySelector('.rd-contact-entry[data-contact-id="contact-1"]')
  assert.match(contactEntry.textContent, /林澈.*设置备注/s)
  contactEntry.click()

  const input = document.getElementById("rdContactRemarkInput")
  assert.ok(input)
  assert.match(document.querySelector(".rd-contact-remark-form").textContent, /不会修改作者设定.*不会影响论坛身份/s)
  input.value = "  阿澈  "
  document.getElementById("cuModalSave").click()

  const updatedEntry = document.querySelector('.rd-contact-entry[data-contact-id="contact-1"]')
  assert.match(updatedEntry.textContent, /阿澈.*原名：林澈/s)

  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const rememberedBook = library.books.find(book => book.id === work.id)
  assert.deepEqual(rememberedBook.progress.contactRemarks, { "contact-1":"阿澈" })

  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="messages"]').click()
  const chatCard = document.querySelector('.rd-chat-card[data-chat-index="0"]')
  assert.match(chatCard.textContent, /阿澈/)
  chatCard.click()
  assert.equal(document.querySelector(".chat-round-title strong").textContent, "阿澈")
})

test("article phone cards open their App directly and App back closes the overlay", async t => {
  installDom(t)
  await startWork(articleWork(), "article-module-direct")

  document.querySelector('.rd-pm-trigger[data-pm-type="memo"]').click()
  const overlay = document.querySelector(".rd-pm-modal")
  assert.ok(overlay.querySelector(".rd-phone-app-memo"))
  assert.equal(overlay.querySelector(".phone-app-icon"), null)

  overlay.querySelector(".rd-back-btn").click()
  assert.equal(document.querySelector(".rd-pm-modal"), null)
  assert.equal(document.querySelector(".article-title").textContent, "第一节")
})

test("article back returns to the previous chapter before it exits the reader", async t => {
  installDom(t)
  await startWork(articleWork(), "article-previous-section")

  document.querySelector('.article-choice-btn[data-target="second"]').click()
  const previous = document.querySelector(".reader-back")
  assert.equal(previous.dataset.readerPrevious, "")
  assert.equal(previous.getAttribute("aria-label"), "返回上一章")
  previous.click()

  assert.equal(document.querySelector(".article-title").textContent, "第一节")
  assert.ok(document.querySelector(".rd-home") === null)
})

test("branch prose reveals below the choice without forcing the reader back to the top", async t => {
  installDom(t)
  const work = articleWork()
  work.id = "branch-reading-continuity"
  work.chapters = [{ id: "chapter-one", name: "同一章" }]
  work.nodes[1].chapterId = "chapter-one"

  let scrollY = 640
  Object.defineProperty(window, "scrollY", {
    configurable:true,
    get:() => scrollY,
  })
  window.scrollTo = options => { scrollY = Number(options?.top || 0) }
  const scrollIntoViewCalls = []
  HTMLElement.prototype.scrollIntoView = function(options) {
    scrollIntoViewCalls.push({ element:this, options })
  }

  await startWork(work, "branch-reading-continuity")
  document.querySelector('.article-choice-btn[data-target="second"]').click()

  const incoming = document.querySelector('.article-node[data-article-path-index="1"]')
  assert.ok(incoming)
  assert.equal(incoming.classList.contains("is-choice-reveal"), true)
  assert.equal(scrollY, 640)
  assert.equal(scrollIntoViewCalls.length, 0)
  assert.match(readerCss, /\.article-node\.is-choice-reveal/)
  assert.match(readerCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.article-node\.is-choice-reveal/)
})

test("a cross-chapter branch starts at the beginning of the target chapter", async t => {
  installDom(t)
  const work = articleWork()
  work.id = "cross-chapter-branch-position"

  let scrollY = 640
  Object.defineProperty(window, "scrollY", {
    configurable:true,
    get:() => scrollY,
  })
  const scrollCalls = []
  window.scrollTo = options => {
    scrollCalls.push(options)
    scrollY = Number(options?.top || 0)
  }

  await startWork(work, "cross-chapter-branch-position")
  document.querySelector('.article-choice-btn[data-target="second"]').click()

  assert.equal(document.querySelector(".article-title").textContent, "第二节")
  assert.equal(scrollY, 0)
  assert.deepEqual(scrollCalls, [{ top:0, left:0, behavior:"auto" }])
})

test("a chapter ending without choices uses NEXT to open the next non-empty chapter", async t => {
  installDom(t)
  const work = articleWork()
  work.id = "next-chapter-without-choice"
  work.nodes[0].choices = []
  work.chapters.splice(1, 0, { id: "empty-chapter", name: "空章" })

  await startWork(work, "next-chapter-without-choice")

  const next = document.querySelector("[data-reader-next]")
  assert.ok(next)
  assert.equal(next.textContent.trim(), "NEXT")
  assert.equal(document.querySelector("[data-reader-home].drop-btn"), null)

  next.click()

  assert.equal(document.querySelector(".article-title").textContent, "第二节")
  assert.match(document.querySelector(".article-reader").textContent, /继续/)
  assert.equal(document.querySelector("[data-reader-next]"), null)
  assert.ok(document.querySelector("[data-reader-home].drop-btn"))
  assert.ok(document.querySelector("[data-reader-previous]"))
})

test("one chapter renders ordered no-choice nodes as one page without node headings", async t => {
  installDom(t)
  const work = articleWork()
  work.id = "linear-article-chapter"
  work.chapters = [{ id: "chapter-one", name: "第一章" }]
  work.nodes = [
    {
      id: "start",
      title: "作者用节点一",
      chapterId: "chapter-one",
      content: "<p>第一段正文</p>",
      choices: [],
    },
    {
      id: "second-paragraph",
      title: "作者用节点二",
      chapterId: "chapter-one",
      content: "<p>第二段正文</p>",
      choices: [],
    },
  ]
  await startWork(work, "linear-article-chapter")

  assert.equal(document.querySelector(".article-title").textContent, "第一章")
  assert.equal(document.querySelectorAll(".article-node").length, 2)
  assert.match(document.querySelector(".article-reader").textContent, /第一段正文.*第二段正文/s)
  assert.equal(document.querySelector(".article-node-title"), null)
  assert.ok(document.querySelector(".drop-btn[data-reader-home]"))
})

test("a version 1 article created with an ungrouped initial node keeps the editor order and renders both paragraphs", async t => {
  installDom(t)
  const work = articleWork()
  work.schemaVersion = 1
  work.id = "legacy-linear-article"
  work.chapters = [{ id: "chapter-one", name: "111" }]
  work.startNode = "new-node"
  work.nodes = [
    {
      id: "start",
      title: "开始",
      chapterId: "",
      content: "<p>222</p>",
      choices: [],
    },
    {
      id: "new-node",
      title: "新节点",
      chapterId: "chapter-one",
      content: "<p>111</p>",
      choices: [],
    },
  ]
  await startWork(work, "legacy-linear-article")

  assert.equal(document.querySelectorAll(".article-node").length, 2)
  assert.match(document.querySelector(".article-reader").textContent, /111.*222/s)
  assert.equal(document.querySelector(".article-node-title"), null)
  assert.ok(document.querySelector(".drop-btn[data-reader-home]"))
})

test("ordinary article interactions record the response then continue chapter text", async t => {
  installDom(t)
  const work = articleWork()
  work.id = "ordinary-article-interactions"
  work.nodes[0].choices = [
    { id:"nod", text:"点点头", mode:"interaction", targetId:"" },
    { id:"shake", text:"摇摇头", mode:"interaction", targetId:"" },
  ]
  work.nodes = [work.nodes[0], {
    id: "after-reaction",
    title: "作者用后续文段",
    chapterId: "chapter-one",
    content: "<p>互动后的正文</p>",
    choices: [],
  }, work.nodes[1]]
  await startWork(work, "ordinary-article-interactions")

  let buttons = [...document.querySelectorAll('.article-choice-btn[data-choice-mode="interaction"]')]
  assert.equal(buttons.length, 2)
  assert.equal(document.querySelector(".drop-btn[data-reader-home]"), null)
  buttons[0].click()
  buttons = [...document.querySelectorAll('.article-choice-btn[data-choice-mode="interaction"]')]
  assert.equal(buttons[0].getAttribute("aria-pressed"), "true")
  assert.equal(document.querySelectorAll(".article-node").length, 2)
  assert.match(document.querySelector(".article-reader").textContent, /互动后的正文/)
  assert.ok(document.querySelector(".drop-btn[data-reader-next]"))
  assert.equal(document.querySelector(".drop-btn[data-reader-home]"), null)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /继续/)
  buttons[1].click()
  buttons = [...document.querySelectorAll('.article-choice-btn[data-choice-mode="interaction"]')]
  assert.equal(buttons[0].getAttribute("aria-pressed"), "false")
  assert.equal(buttons[1].getAttribute("aria-pressed"), "true")
  assert.equal(document.querySelectorAll(".article-node").length, 2)
})

test("standalone author flow guides one conversation and schedules calls", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.phoneData.contacts[0].avatarUrl = "data:image/png;base64,iVBORw0KGgo="
  await startWork(work, "standalone-reading-flow")

  assert.equal(document.querySelectorAll(".phone-flow-badge").length, 1)
  assert.ok(document.querySelector('[data-app-type="messages"] .phone-flow-badge'))
  const notification = document.querySelector(".phone-flow-notification")
  assert.ok(notification, "the current conversation should arrive as a phone notification")
  assert.match(notification.textContent, /消息.*林澈.*第一项消息/s)
  const notificationVisual = notification.querySelector(".phone-flow-notification-icon")
  assert.ok(notificationVisual.classList.contains("is-contact-avatar"))
  assert.equal(notificationVisual.querySelector("img")?.getAttribute("src"), work.phoneData.contacts[0].avatarUrl)

  notification.click()
  assert.ok(document.getElementById("chatMsgArea"), "the current chat step should open directly")
  assert.equal(document.querySelector(".rd-call-scene"), null, "a later call must not jump ahead")
  assert.ok(document.querySelector('[data-message-id="message-1"].is-flow-target'))
  assert.equal(document.querySelector('[data-message-id="choice-1"]'), null)
  assert.equal(document.querySelector('[data-message-id="call-1"]'), null)
  assert.equal(document.querySelector(".rd-flow-cue"), null, "the conversation must not expose per-bubble guide cards")

  const flowOutlineRule = readerCss.slice(
    readerCss.indexOf(".rd-memo-note.is-flow-target"),
    readerCss.indexOf(".rd-chat-message.is-flow-target"),
  )
  assert.doesNotMatch(flowOutlineRule, /rd-chat-message|rd-chat-time|rd-call-card/)

  assert.equal(document.querySelector(".rd-flow-next"), null, "chat bubbles advance without a manual next button")
  await waitFor(() => document.querySelector('[data-message-id="choice-1"].is-flow-target'))
  assert.ok(document.getElementById("chatMsgArea"), "consecutive chat fields should stay inside the chat")
  assert.ok(document.querySelector('[data-message-id="message-1"]'))
  assert.equal(document.querySelector('[data-message-id="call-1"]'), null)
  await waitFor(() => document.querySelector(".rd-reply-option:not([disabled])"))

  document.querySelector(".rd-reply-option").click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("那就接电话吧"), 5000)
  await waitFor(() => document.querySelector(".rd-call-scene"), 5000)
  assert.match(document.querySelector(".rd-call-scene").textContent, /第二项通话/)
  assert.doesNotMatch(document.querySelector(".rd-call-scene").textContent, /通话是剧情的一部分/)
  assert.equal(document.querySelector(".rd-call-scene .rd-flow-cue"), null)

  document.querySelector(".rd-call-hangup").click()
  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.ok(document.querySelector('[data-app-type="memo"] .phone-flow-badge'))

  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  const endedCall = document.querySelector('.rd-call-record[data-message-id="call-1"]')
  assert.ok(endedCall, "a call already completed by the reading flow should stay compact when the chat is reopened")
  assert.match(endedCall.textContent, /语音通话\s*已通话 00:\d{2}/)
})

test("group message flow notifications use the group avatar and open that conversation", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "group-flow-notification"
  work.phoneData.chats[0].type = "group"
  work.phoneData.chats[0].groupName = "夜航组"
  work.phoneData.chats[0].groupAvatarUrl = "data:image/png;base64,iVBORw0KGgo="

  await startWork(work, work.id)

  const notification = document.querySelector('.phone-flow-notification[data-flow-notification-app="messages"]')
  assert.ok(notification)
  assert.match(notification.textContent, /消息.*夜航组.*第一项消息/s)
  assert.equal(
    notification.querySelector(".phone-flow-notification-icon img")?.getAttribute("src"),
    work.phoneData.chats[0].groupAvatarUrl,
  )

  notification.click()
  assert.ok(document.getElementById("chatMsgArea"))
  assert.match(document.querySelector(".chat-round-title")?.textContent || "", /夜航组/)
})

test("phone flow notifications guide memo and shopping modules", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "module-flow-notifications"
  work.phoneData.shoppingItems = [{
    id: "shopping-1",
    contactId: "contact-1",
    name: "手账胶带",
    price: 18,
    status: "cart",
  }]
  work.phoneData.apps.push({
    id: "shopping-app",
    type: "shopping",
    name: "购物",
    icon: "S",
    desktopX: 2,
    desktopY: 0,
    enabled: true,
  })
  work.phoneData.readingFlow.sequence = [
    { type: "memo", itemId: "memo-1", contactId: "contact-1", label: "林澈 · 第四项备忘录" },
    { type: "shopping", itemId: "shopping-1", contactId: "contact-1", label: "林澈 · 手账胶带" },
  ]

  await startWork(work, "module-flow-notifications")

  let notification = document.querySelector('.phone-flow-notification[data-flow-notification-app="memo"]')
  assert.ok(notification, "memo must receive the same phone notification guide as Messages")
  assert.match(notification.textContent, /备忘录.*林澈.*第三项备忘录/s)
  assert.ok(notification.querySelector(".phone-flow-notification-icon").classList.contains("is-app-icon"))
  assert.match(notification.querySelector(".phone-flow-notification-icon").textContent, /N/)
  notification.click()
  assert.ok(document.querySelector('.rd-connection-gate[data-connection-state="choose"]'))
  document.querySelector('[data-connection-action="confirm"]').click()
  assert.ok(document.querySelector(".rd-phone-app-memo"))
  assert.ok(document.querySelector('[data-memo-id="memo-1"].is-flow-target'))

  document.querySelector(".rd-flow-next").click()
  notification = document.querySelector('.phone-flow-notification[data-flow-notification-app="shopping"]')
  assert.ok(notification, "shopping must receive the same phone notification guide as Messages")
  assert.match(notification.textContent, /购物.*手账胶带/)
  notification.click()
  assert.ok(document.querySelector('.rd-connection-gate[data-connection-state="choose"]'))
  document.querySelector('[data-connection-action="confirm"]').click()
  assert.ok(document.querySelector(".rd-phone-app-shopping"))
  assert.ok(document.querySelector('[data-shopping-id="shopping-1"].is-flow-target'))
})

test("reader skips hidden apps left in an imported author flow", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "hidden-app-reading-flow"
  work.phoneData.apps.find(app => app.type === "messages").enabled = false

  await startWork(work, "hidden-app-reading-flow")

  assert.equal(document.querySelector('[data-app-type="messages"]'), null)
  assert.equal(document.querySelector('.phone-flow-badge[data-flow-app="messages"]'), null)
  assert.ok(document.querySelector('[data-app-type="memo"] .phone-flow-badge'))
  assert.ok(document.querySelector('.phone-flow-notification[data-flow-notification-app="memo"]'))
})

test("opening Messages out of author order never reveals or auto-opens a future call", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "out-of-order-call"
  work.phoneData.readingFlow.sequence = [
    { type: "memo", itemId: "memo-1", contactId: "contact-1", label: "先看备忘录" },
    { type: "messages", itemId: "call-1", chatId: "chat-1", roundId: "round-1", label: "之后才接电话" },
  ]
  await startWork(work, "out-of-order-call")

  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  assert.equal(document.querySelector(".rd-call-scene"), null)
  assert.equal(document.querySelector('[data-message-id="call-1"]'), null)
  assert.match(document.getElementById("chatMsgArea").textContent, /还没有按作者顺序解锁的消息/)
})

test("chat flow streams text and waits 0.8 seconds before revealing the next bubble", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "streamed-chat-flow"
  work.phoneData.chats[0].rounds[0].messages = [
    { id: "stream-1", type: "text", senderId: "contact-1", text: "甲乙" },
    { id: "stream-2", type: "text", senderId: "contact-1", text: "丙丁" },
  ]
  work.phoneData.readingFlow.sequence = [
    { type: "messages", itemId: "stream-1", chatId: "chat-1", roundId: "round-1", label: "第一条" },
    { type: "messages", itemId: "stream-2", chatId: "chat-1", roundId: "round-1", label: "第二条" },
  ]
  await startWork(work, "streamed-chat-flow")
  document.querySelector('[data-app-type="messages"]').click()

  const first = document.querySelector('[data-message-id="stream-1"]')
  assert.ok(first)
  assert.notEqual(first.textContent.trim(), "甲乙", "the first frame must not contain the complete sentence")
  await new Promise(resolve => setTimeout(resolve, 195))
  assert.notEqual(first.textContent.trim(), "甲乙", "two characters should still be streaming at the old 90ms cadence boundary")
  await waitFor(() => first.textContent.includes("甲乙"))
  const completedAt = Date.now()
  await new Promise(resolve => setTimeout(resolve, 500))
  assert.equal(document.querySelector('[data-message-id="stream-2"]'), null)
  await waitFor(() => document.querySelector('[data-message-id="stream-2"]'), 1000)
  assert.ok(Date.now() - completedAt >= 700, "the inter-bubble pause should remain close to 0.8 seconds")
})

test("paced choice follow-ups show typing before the character reply without a reading flow", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "paced-choice-without-flow"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"paced-owner",
    type:"text",
    senderId:"contact-1",
    text:"你决定好了吗？",
    choices:[{
      id:"paced-choice",
      text:"决定好了",
      replyText:"好了",
      replyPace:"quick",
      followUpMessages:[{ id:"paced-follow", type:"text", senderId:"contact-1", text:"那就出发吧。" }],
    }],
  }]

  await startWork(work, "paced-choice-without-flow")
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  document.querySelector(".rd-reply-option").click()

  await waitFor(() => document.querySelector(".rd-chat-typing"), 4000)
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /那就出发吧。/)
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("那就出发吧。"), 4000)
  assert.equal(document.querySelector(".rd-chat-typing"), null)
})

test("reader placeholder presets have an explicit local save action", async t => {
  installDom(t)
  await import(`../reader/reader.js?preset-save=${Date.now()}-${Math.random()}`)

  const save = document.getElementById("rdPresetSave")
  assert.equal(save?.tagName, "BUTTON")
  assert.equal(document.getElementById("ps_name").hasAttribute("placeholder"), false)
  assert.equal(document.getElementById("ps_nickname").hasAttribute("placeholder"), false)
  assert.equal(document.getElementById("ps_webname").hasAttribute("placeholder"), false)
  document.getElementById("ps_name").value = "阿雾"
  document.getElementById("ps_nickname").value = "小雾"
  document.getElementById("ps_webname").value = "mist"
  save.click()

  assert.deepEqual(JSON.parse(localStorage.getItem("moirain_placeholders")), {
    name: "阿雾", nickname: "小雾", webname: "mist",
  })
  assert.match(document.getElementById("rdPresetStatus").textContent, /已保存到本地/)
})

test("red packets and transfers share one card geometry and both name their type", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "payment-cards"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = [
    { id: "red", type: "redpacket", senderId: "contact-1", redpacketAmount: 66, redpacketMsg: "收下吧" },
    { id: "transfer", type: "transfer", senderId: "contact-1", transferAmount: 88, transferNote: "夜宵" },
  ]
  await startWork(work, "payment-card-geometry")
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const cards = [...document.querySelectorAll(".chat-payment-card")]
  assert.equal(cards.length, 2)
  assert.deepEqual(cards.map(card => card.querySelector(".chat-payment-type").textContent), ["红包", "转账"])
  assert.match(readerCss, /\.chat-payment-card\s*\{[^}]*width:\s*165px[^}]*min-height:/s)
  assert.match(authorCss, /\.chat-payment-card\s*\{[^}]*width:\s*165px[^}]*min-height:/s)
  assert.match(authorPhoneSource, /chat-payment-card/)
  assert.doesNotMatch(authorPhoneSource, /微信红包/)
  assert.match(authorCss, /\.chat-round-control\{[^}]*box-sizing:border-box[^}]*padding:0/s)
  assert.match(authorCss, /#chatBgBtn\{[^}]*margin-right:\s*6px[^}]*letter-spacing:\s*0/s)
})

test("reader can claim every benefit card without changing authored data", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "claimable-benefit-cards"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"red", type:"redpacket", senderId:"contact-1", redpacketAmount:66, redpacketMsg:"收下吧" },
    { id:"transfer", type:"transfer", senderId:"contact-1", transferAmount:88, transferNote:"夜宵" },
    { id:"family", type:"familycard", senderId:"contact-1", fcRelation:"姐姐", fcAmount:100 },
    { id:"takeaway", type:"takeaway", senderId:"contact-1", takeawayShop:"春风小馆", takeawayOrder:"番茄牛腩饭", takeawayAmount:28.5, takeawayStatus:"配送中" },
  ]
  const authoredBefore = structuredClone(work.phoneData.chats[0].rounds[0].messages)
  await startWork(work, "claimable-benefit-cards")
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const buttons = [...document.querySelectorAll(".rd-card-claim")]
  assert.equal(buttons.length, 4)
  assert.match(document.querySelector(".chat-payment-redpacket").textContent, /红包/)
  assert.doesNotMatch(document.querySelector(".chat-payment-redpacket").textContent, /微信红包/)
  assert.match(document.querySelector(".chat-takeaway-card").textContent, /点击查看/)
  for (const button of buttons) button.click()
  assert.deepEqual(buttons.map(button => button.textContent), ["已领取", "已收款", "已领取", "已领取"])
  assert.ok(buttons.every(button => button.disabled))

  document.querySelector("#chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.ok([...document.querySelectorAll(".rd-card-claim")].every(button => button.disabled))
  assert.deepEqual(work.phoneData.chats[0].rounds[0].messages, authoredBefore)
})

test("reader link and takeaway cards open safe external searches", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "clickable-message-cards"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"link", type:"link", senderId:"contact-1", linkTitle:"站点", linkUrl:"https://example.com/story" },
    { id:"unsafe", type:"link", senderId:"contact-1", linkTitle:"无效", linkUrl:"javascript:alert(1)" },
    { id:"takeaway", type:"takeaway", senderId:"contact-1", takeawayShop:"春风小馆", takeawayOrder:"番茄牛腩饭", takeawayAmount:28.5, takeawayStatus:"配送中" },
  ]
  await startWork(work, "clickable-message-cards")
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const link = document.querySelector('a.chat-link-card')
  assert.equal(link?.href, "https://example.com/story")
  assert.equal(link?.rel, "noopener noreferrer")
  assert.equal(document.querySelectorAll(".chat-link-card").length, 2)
  assert.equal(document.querySelectorAll("a.chat-link-card").length, 1)
  const takeaway = document.querySelector("a.chat-takeaway-card")
  assert.match(takeaway?.href || "", /meituan\.com\/s\//)
  assert.match(takeaway?.textContent || "", /外卖.*春风小馆.*番茄牛腩饭/s)
  assert.match(takeaway?.textContent || "", /点击查看/)
  assert.doesNotMatch(takeaway?.textContent || "", /点击搜索/)
})

test("reader opens an authored forum post inside a closable chat picture-in-picture", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "inline-forum-message-card"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.forumPosts = [{
    id: "post-inline",
    contactId: "contact-1",
    title: "夜雨讨论",
    content: "这是内联帖子正文",
    time: "",
    comments: [],
  }]
  work.phoneData.chats[0].rounds[0].messages = [{
    id: "inline-link",
    type: "link",
    senderId: "contact-1",
    linkTitle: "夜雨讨论",
    forumPostId: "post-inline",
  }]

  await startWork(work, "inline-forum-message-card")
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const card = document.querySelector("button.rd-inline-forum-card")
  assert.ok(card)
  assert.equal(card.getAttribute("href"), null)
  card.click()
  const pip = document.querySelector(".rd-inline-forum-pip")
  assert.match(pip?.textContent || "", /夜雨讨论.*这是内联帖子正文/s)
  assert.equal(pip.parentElement.classList.contains("chat-reader-shell"), true)
  pip.querySelector(".rd-inline-forum-close").click()
  assert.equal(document.querySelector(".rd-inline-forum-pip"), null)
  assert.equal(document.activeElement, card)
})

test("reader blocks forbidden placeholder values before entering a phone work", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "forbidden-phone-placeholder"
  work.phoneData.readingFlow.enabled = false
  work.placeholders = [{ id:"reader-name", label:"读者名字", key:"{{reader}}", prompt:"填写名字", forbidden:["偷吃"] }]
  seedWork(work)
  await import(`../reader/reader.js?forbidden=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  const input = document.querySelector('[data-ph-id="reader-name"]')
  input.value = "禁止偷吃"
  document.getElementById("rdStartBtn").click()
  assert.ok(document.querySelector(".rd-landing"), "forbidden input must keep the landing page open")
  assert.match(input.parentElement.querySelector(".rd-placeholder-error").textContent, /违禁词/)
  input.value = "小雨"
  document.getElementById("rdStartBtn").click()
  assert.ok(document.querySelector(".phone-frame"), "valid input should enter the phone work")
})

test("reader applies one global forbidden word list to every placeholder", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "global-forbidden-phone-placeholder"
  work.phoneData.readingFlow.enabled = false
  work.placeholders = [
    { id:"reader-name", label:"姓名", key:"{{reader}}", prompt:"填写名字", forbidden:[] },
    { id:"reader-nickname", label:"昵称", key:"{{nickname}}", prompt:"填写昵称", forbidden:["专属词"] },
  ]
  work.globalForbidden = ["老公"]
  seedWork(work)
  await import(`../reader/reader.js?global-forbidden=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()

  const name = document.querySelector('[data-ph-id="reader-name"]')
  const nickname = document.querySelector('[data-ph-id="reader-nickname"]')
  name.value = "叫我老公"
  nickname.value = "普通昵称"
  document.getElementById("rdStartBtn").click()
  assert.match(name.parentElement.querySelector(".rd-placeholder-error").textContent, /违禁词/)

  name.value = "小雨"
  nickname.value = "专属词昵称"
  document.getElementById("rdStartBtn").click()
  assert.match(nickname.parentElement.querySelector(".rd-placeholder-error").textContent, /违禁词/)
  assert.ok(document.querySelector(".rd-landing"))
})

test("reader exact forbidden words reject only the complete trimmed value", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "exact-forbidden-phone-placeholder"
  work.phoneData.readingFlow.enabled = false
  work.placeholders = [{
    id:"reader-name",
    label:"姓名",
    key:"{{reader}}",
    prompt:"填写名字",
    forbidden:[],
    exactForbidden:["哥哥"],
  }]
  work.globalExactForbidden = ["MOMO"]
  seedWork(work)
  await import(`../reader/reader.js?exact-forbidden=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()

  const input = document.querySelector('[data-ph-id="reader-name"]')
  input.value = " 哥哥 "
  document.getElementById("rdStartBtn").click()
  assert.ok(document.querySelector(".rd-landing"), "the complete trimmed exact value must remain blocked")
  assert.match(input.parentElement.querySelector(".rd-placeholder-error").textContent, /违禁词/)

  input.value = "不算依赖哥哥算长大吗"
  document.getElementById("rdStartBtn").click()
  assert.ok(document.querySelector(".phone-frame"), "a longer value containing an exact rule should be allowed")
})

test("reader message list and bubbles show group avatar and roles", async t => {
  installDom(t)
  const work = flowPhoneWork()
  work.id = "reader-group-identity"
  work.phoneData.readingFlow.enabled = false
  work.phoneData.chats[0].rounds[0].messages = work.phoneData.chats[0].rounds[0].messages.filter(message => message.type !== "call")
  Object.assign(work.phoneData.chats[0], {
    type:"group", groupName:"编辑部", groupAvatarUrl:"https://example.com/group.png",
    groupOwnerId:"contact-1", groupAdminIds:[], groupTitles:{ "contact-1":"主笔" },
  })
  await startWork(work, "reader-group-identity")
  document.querySelector('[data-app-type="messages"]').click()
  const avatar = document.querySelector('.rd-chat-card[data-chat-index="0"] .rd-message-avatar img')
  assert.equal(avatar?.src, "https://example.com/group.png")
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  const role = document.querySelector(".rd-chat-group-role")
  assert.ok(role, document.querySelector(".phone-frame")?.innerHTML || "missing phone frame")
  assert.match(role.textContent, /群主.*主笔/)
  const senderName = document.querySelector(".rd-chat-group-sender-name")
  assert.ok(senderName, "group bubbles should always identify the NPC sender")
  assert.equal(senderName.textContent.trim(), "林澈")
  const messageAvatar = document.querySelector(".rd-chat-message.is-other .chat-avatar")
  assert.equal(messageAvatar?.getAttribute("aria-label"), "林澈")
})
