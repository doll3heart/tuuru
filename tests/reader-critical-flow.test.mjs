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

test("standalone author flow guides one conversation and schedules calls", async t => {
  installDom(t)
  await startWork(flowPhoneWork(), "standalone-reading-flow")

  assert.equal(document.querySelectorAll(".phone-flow-badge").length, 1)
  assert.ok(document.querySelector('[data-app-type="messages"] .phone-flow-badge'))
  const notification = document.querySelector(".phone-flow-notification")
  assert.ok(notification, "the current conversation should arrive as a phone notification")
  assert.match(notification.textContent, /林澈.*有一段新对话/)

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
  assert.match(notification.textContent, /备忘录.*林澈/)
  notification.click()
  assert.ok(document.querySelector(".rd-phone-app-memo"))

  document.querySelector(".rd-flow-next").click()
  notification = document.querySelector('.phone-flow-notification[data-flow-notification-app="shopping"]')
  assert.ok(notification, "shopping must receive the same phone notification guide as Messages")
  assert.match(notification.textContent, /购物.*手账胶带/)
  notification.click()
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

test("reader placeholder presets have an explicit local save action", async t => {
  installDom(t)
  await import(`../reader/reader.js?preset-save=${Date.now()}-${Math.random()}`)

  const save = document.getElementById("rdPresetSave")
  assert.equal(save?.tagName, "BUTTON")
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
})
