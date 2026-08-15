import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const sharedChatCss = readFileSync(new URL("../css/phone-chat.css", import.meta.url), "utf8")

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

function choiceWork() {
  return {
    schemaVersion: 1,
    id: "reader-chat-choice-runtime",
    type: "phone",
    title: "Choice runtime",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-1", name: "林澈" }],
      chats: [{
        id: "chat-1",
        type: "single",
        contactIds: ["contact-1"],
        messages: [],
        rounds: [{
          id: "round-1",
          label: "第一轮",
          messages: [
            {
              id: "owner-message",
              type: "text",
              senderId: "contact-1",
              text: "今晚要不要见面？",
              choices: [
                {
                  id: "choice-a",
                  text: "好，我会准时到。",
                  replyText: "好，我会准时到。",
                  followUpMessages: [{
                    id: "authored-followup-a",
                    type: "text",
                    senderId: "contact-1",
                    text: "那我在老地方等你。",
                  }],
                },
                {
                  id: "choice-b",
                  text: "今晚不太方便，改天好吗？",
                  replyText: "今晚不太方便，改天好吗？",
                  followUpMessages: [{
                    id: "authored-followup-b",
                    type: "text",
                    senderId: "contact-1",
                    text: "好，那你方便时告诉我。",
                  }],
                },
              ],
            },
            {
              id: "authored-tail",
              type: "text",
              senderId: "contact-1",
              text: "这是作者原本排在后面的消息。",
            },
          ],
        }],
      }],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [{
        id: "messages-app",
        type: "messages",
        name: "消息",
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
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

async function openSeededChat(t, work = choiceWork(), phoneCustom) {
  installDom(t)
  seedPhoneWork(work)
  if (phoneCustom) localStorage.setItem("moirain_phoneCustom", JSON.stringify(phoneCustom))
  await import(`../reader/reader.js?reader-chat-choice-runtime=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
}

test("reader-authored messages use the reader profile avatar", async t => {
  const readerAvatar = "data:image/png;base64,cmVhZGVyLWF2YXRhcg=="
  await openSeededChat(t, choiceWork(), {
    readerId: "读者昵称",
    readerAvatar,
  })

  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()

  const selfMessage = document.querySelector(".rd-chat-message.is-self")
  assert.ok(selfMessage)
  const avatar = selfMessage.querySelector(".chat-avatar")
  assert.ok(avatar, "reader messages must render the reader-owned avatar")
  assert.equal(avatar.querySelector("img")?.getAttribute("src"), readerAvatar)
  assert.equal(avatar.getAttribute("aria-label"), "读者昵称")
})

test("an image choice previews and sends the same image without an extra text bubble", async t => {
  const work = choiceWork()
  const imageUrl = "data:image/png;base64,Y2hvaWNlLWltYWdl"
  work.phoneData.chats[0].rounds[0].messages[0].choices[0].imageUrl = imageUrl
  await openSeededChat(t, work)

  document.getElementById("chatInput").click()
  const option = document.querySelector('.rd-reply-option[data-ci="0"]')
  assert.ok(option.classList.contains("has-image"))
  assert.equal(option.querySelector("img")?.getAttribute("src"), imageUrl)
  assert.match(option.textContent, /好，我会准时到/)
  option.click()

  const selfMessages = [...document.querySelectorAll(".rd-chat-message.is-self")]
  assert.equal(selfMessages.length, 1)
  assert.equal(selfMessages[0].querySelector("img")?.getAttribute("src"), imageUrl)
  assert.doesNotMatch(selfMessages[0].textContent, /好，我会准时到/)
})

test("a newly loaded reply image keeps a followed chat pinned to its new bottom", async t => {
  const work = choiceWork()
  const imageUrl = "data:image/png;base64,Y2hvaWNlLWltYWdl"
  work.phoneData.chats[0].rounds[0].messages[0].choices[0].imageUrl = imageUrl
  await openSeededChat(t, work)

  let chatScrollHeight = 800
  const prototype = globalThis.HTMLElement.prototype
  const previousScrollHeight = Object.getOwnPropertyDescriptor(prototype, "scrollHeight")
  const previousClientHeight = Object.getOwnPropertyDescriptor(prototype, "clientHeight")
  Object.defineProperty(prototype, "scrollHeight", {
    configurable: true,
    get() { return this.id === "chatMsgArea" ? chatScrollHeight : 0 },
  })
  Object.defineProperty(prototype, "clientHeight", {
    configurable: true,
    get() { return this.id === "chatMsgArea" ? 200 : 0 },
  })
  t.after(() => {
    if (previousScrollHeight) Object.defineProperty(prototype, "scrollHeight", previousScrollHeight)
    else delete prototype.scrollHeight
    if (previousClientHeight) Object.defineProperty(prototype, "clientHeight", previousClientHeight)
    else delete prototype.clientHeight
  })

  const initialArea = document.getElementById("chatMsgArea")
  initialArea.scrollTop = 600
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const renderedArea = document.getElementById("chatMsgArea")
  assert.equal(renderedArea.scrollTop, 800)
  chatScrollHeight = 1200
  renderedArea.querySelector('.rd-chat-message.is-self img').dispatchEvent(new window.Event("load"))
  assert.equal(renderedArea.scrollTop, 1200)

  renderedArea.scrollTop = 240
  renderedArea.dispatchEvent(new window.Event("scroll"))
  chatScrollHeight = 1400
  renderedArea.querySelector('.rd-chat-message.is-self img').dispatchEvent(new window.Event("load"))
  assert.equal(renderedArea.scrollTop, 240, "image growth must not pull a reader away from older messages")
})

test("saved reader chat background reaches the actual conversation screen", async t => {
  const imageUrl = `data:image/png;base64,${Buffer.from("\x89PNG\r\n\x1a\n", "binary").toString("base64")}`
  await openSeededChat(t, choiceWork(), {
    appSettings:{
      messages:{
        chatBg:"#25435f",
        chatBgImage:imageUrl,
        chatBgFit:"contain",
        chatBgPositionX:22,
        chatBgPositionY:78,
        chatBgTone:-30,
        bubbleFontWeight:700,
        sendButtonBg:"#285c4d",
      },
    },
  })

  const chat = document.querySelector(".rd-phone-app-messages")
  assert.ok(chat)
  assert.equal(chat.style.getPropertyValue("--chat-editor-screen"), "#25435f")
  assert.match(chat.style.getPropertyValue("--chat-editor-image"), /^url\(/)
  assert.equal(chat.style.getPropertyValue("--chat-bg-size"), "contain")
  assert.equal(chat.style.getPropertyValue("--chat-bg-position"), "22% 78%")
  assert.equal(chat.style.getPropertyValue("--chat-bg-overlay-color"), "#000000")
  assert.equal(chat.style.getPropertyValue("--chat-bg-overlay-opacity"), "0.3")
  assert.equal(chat.style.getPropertyValue("--chat-bubble-weight"), "800")
  assert.equal(chat.style.getPropertyValue("--chat-send-bg"), "#285c4d")
  assert.equal(chat.style.getPropertyValue("--chat-send-ink"), "#ffffff")
})

test("a choice without reader text keeps reselection on its first generated follow-up", async t => {
  const work = choiceWork()
  const choice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  choice.text = "Stay silent and listen."
  choice.replyText = ""
  choice.followUpMessages = [{
    id: "silent-follow-up",
    type: "text",
    senderId: "contact-1",
    text: "Then just listen to me.",
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()

  assert.match(document.querySelector("#chatMsgArea").textContent, /Then just listen to me\./)
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.match(document.querySelector("#chatMsgArea").textContent, /Then just listen to me\./)
  const reselect = document.querySelector(".rd-chat-choice-reselect")
  assert.ok(reselect)
  reselect.click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /Then just listen to me\./)
  assert.ok(document.querySelector(".rd-reply-option"))
})

test("a silent important choice records progress and ends the current topic", async t => {
  const work = choiceWork()
  const choice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  choice.replyText = ""
  choice.silent = true
  choice.endRound = true

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const text = document.querySelector("#chatMsgArea").textContent
  assert.match(text, /那我在老地方等你/)
  assert.doesNotMatch(text, /这是作者原本排在后面的消息/)
  assert.equal(document.querySelectorAll(".rd-chat-message.is-self").length, 0)
  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.equal(library.books[0].progress.phoneChoiceSelections["owner-message"], "choice-a")
})

test("a later message follows the selected stable choice condition", async t => {
  const work = choiceWork()
  work.phoneData.chats[0].rounds[0].messages[1].visibleAfterChoiceId = "choice-b"

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /这是作者原本排在后面的消息/)

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()
  assert.match(document.querySelector("#chatMsgArea").textContent, /这是作者原本排在后面的消息/)
})

test("reselecting an earlier choice clears selections made in another hidden chat branch", async t => {
  const work = choiceWork()
  const sourceChoices = work.phoneData.chats[0].rounds[0].messages[0].choices
  sourceChoices[0].id = "branch-open"
  sourceChoices[1].id = "branch-close"
  work.phoneData.chats.push({
    id:"chat-2",
    type:"single",
    contactIds:["contact-1"],
    messages:[],
    rounds:[{
      id:"round-2",
      label:"分支聊天",
      messages:[{
        id:"dependent-owner",
        senderId:"contact-1",
        type:"text",
        text:"只有打开分支后才出现。",
        visibleAfterChoiceId:"branch-open",
        choices:[{
          id:"dependent-choice",
          text:"继续这个分支",
          replyText:"继续这个分支",
          followUpMessages:[],
        }],
      }],
    }],
  })

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()

  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.deepEqual(library.books[0].progress.phoneChoiceSelections, {
    "owner-message":"branch-close",
  })
})

test("a forum post appears like an update after its message choice is selected", async t => {
  const work = choiceWork()
  work.phoneData.apps.push({
    id:"forum-app",
    type:"forum",
    name:"论坛",
    icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
    desktopX:1,
    desktopY:0,
    enabled:true,
  })
  work.phoneData.forumPosts = [{
    id:"unlocked-post",
    contactId:"contact-1",
    contactName:"林澈",
    title:"刚刚发生的事",
    content:"只有作出决定之后才看得到。",
    time:"刚刚",
    images:[],
    comments:[],
    visibleAfterChoiceId:"choice-a",
  }]

  await openSeededChat(t, work)
  document.getElementById("chatBack").click()
  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="forum"]').click()
  assert.equal(document.querySelector(".rd-post-card"), null)

  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  document.getElementById("chatBack").click()
  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="forum"]').click()

  assert.match(document.querySelector(".rd-post-card").textContent, /刚刚发生的事/)
})

test("a hidden forum update cannot be opened early from an authored chat link", async t => {
  const work = choiceWork()
  work.phoneData.forumPosts = [{
    id:"hidden-linked-post",
    contactId:"contact-1",
    contactName:"林澈",
    title:"分支更新",
    content:"还不能提前看到。",
    images:[],
    comments:[],
    visibleAfterChoiceId:"choice-a",
  }]
  work.phoneData.chats[0].rounds[0].messages.unshift({
    id:"early-forum-link",
    type:"link",
    senderId:"contact-1",
    linkTitle:"查看分支更新",
    forumPostId:"hidden-linked-post",
  })

  await openSeededChat(t, work)
  assert.equal(document.querySelector(".rd-inline-forum-card"), null)
  assert.match(document.querySelector("#chatMsgArea").textContent, /帖子尚未出现/)

  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const link = document.querySelector(".rd-inline-forum-card")
  assert.ok(link)
  link.click()
  assert.match(document.querySelector(".rd-inline-forum-pip").textContent, /还不能提前看到/)
})

test("reader chat delegates choice application and rollback to the shared immutable runtime", () => {
  const start = readerSource.indexOf("function openReaderChat")
  const end = readerSource.indexOf("// ---- Forum post viewer ----", start)
  const chatSource = readerSource.slice(start, end)
  const visibilityStart = chatSource.indexOf("function isMessageVisible")
  const visibilityEnd = chatSource.indexOf("function hydratePersistedChatChoices", visibilityStart)
  const visibilitySource = chatSource.slice(visibilityStart, visibilityEnd)

  assert.match(readerSource, /import\s*\{[^}]*applyChatChoice[^}]*rollbackChatChoice[^}]*\}\s*from\s*['"]\.\.\/js\/chat-choice-runtime\.js['"]/s)
  assert.match(chatSource, /new Map\s*\(/)
  assert.match(chatSource, /applyChatChoice\s*\(/)
  assert.match(chatSource, /rollbackChatChoice\s*\(/)
  assert.match(visibilitySource, /phoneStoryMessageBlockedByEndedRound\s*\(/)
  assert.doesNotMatch(chatSource, /\.messages\.push\s*\(/)
  assert.doesNotMatch(chatSource, /choice\.used|\.used\s*=/)
})

test("a full-sentence choice is inserted after its owner and can be rolled back for reselection", async t => {
  await openSeededChat(t)

  assert.ok(document.querySelector(".chat-author-shell.chat-reader-shell"))
  assert.ok(document.querySelector(".chat-round-header"))
  assert.ok(document.querySelector("#chatMsgArea.chat-msg-area"))
  assert.ok(document.querySelector(".rd-chat-message.chat-msg"))
  assert.ok(document.querySelector(".rd-chat-composer.chat-input-bar.chat-composer"))
  const choiceField = document.querySelector(".rd-chat-choice-field")
  const initialChoiceList = document.querySelector("#rdChoiceList")
  assert.ok(choiceField)
  assert.equal(document.getElementById("chatInput").parentElement, choiceField)
  assert.equal(initialChoiceList.parentElement, choiceField)
  assert.match(readerCss, /\.rd-chat-choice-list\s*\{[^}]*bottom:\s*100%/s)
  assert.match(readerCss, /\.rd-reply-option\s*\{[^}]*text-align:\s*center/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-msg-area\s*\{[^}]*scrollbar-width:\s*none/s)
  assert.match(sharedChatCss, /\.phone-frame \.chat-msg-area::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
  assert.match(readerSource, /rd-app-preview-chat chat-author-shell chat-reader-shell/)

  const composer = document.getElementById("chatInput")
  assert.ok(composer)
  assert.equal(composer.readOnly, true, "the reader composer must not accept free text")
  composer.click()

  let options = [...document.querySelectorAll(".rd-reply-option")]
  assert.equal(options.length, 2)
  assert.equal(options[0].textContent.trim(), "好，我会准时到。")
  options[0].click()

  let messages = [...document.querySelectorAll(".rd-chat-message")]
  let visibleText = messages.map(message => message.textContent)
  assert.match(visibleText[0], /今晚要不要见面/)
  assert.match(visibleText[1], /好，我会准时到/)
  assert.match(visibleText[2], /那我在老地方等你/)
  assert.match(visibleText[3], /这是作者原本排在后面的消息/)

  const ids = messages.map(message => message.dataset.messageId)
  assert.equal(new Set(ids).size, ids.length, "generated reply and follow-up IDs must stay unique")
  assert.equal(document.querySelector("#rdChoiceList"), null, "the active group must not remain replayable")

  const reselect = document.querySelector(".rd-chat-choice-reselect")
  assert.ok(reselect, "the generated reader reply should keep a compact reselection entry")
  assert.match(reselect.textContent, /重选/)
  reselect.click()

  messages = [...document.querySelectorAll(".rd-chat-message")]
  visibleText = messages.map(message => message.textContent).join(" ")
  assert.doesNotMatch(visibleText, /好，我会准时到/)
  assert.doesNotMatch(visibleText, /那我在老地方等你/)
  assert.match(visibleText, /今晚要不要见面/)
  assert.doesNotMatch(visibleText, /这是作者原本排在后面的消息/)

  const choiceList = document.querySelector("#rdChoiceList")
  assert.ok(choiceList)
  assert.equal(choiceList.hidden, false, "rollback should reopen the original option group")
  options = [...choiceList.querySelectorAll(".rd-reply-option")]
  options[1].click()

  messages = [...document.querySelectorAll(".rd-chat-message")]
  visibleText = messages.map(message => message.textContent)
  assert.match(visibleText[1], /今晚不太方便，改天好吗/)
  assert.match(visibleText[2], /好，那你方便时告诉我/)
  assert.match(visibleText[3], /这是作者原本排在后面的消息/)
  assert.equal(document.querySelectorAll(".rd-chat-choice-reselect").length, 1)
})

test("separate message choice groups become available in conversation order", async t => {
  const work = choiceWork()
  work.phoneData.chats[0].type = "group"
  work.phoneData.chats[0].groupName = "Choice group"
  const messages = work.phoneData.chats[0].rounds[0].messages
  messages[0].choices = [{
    id:"first-choice",
    text:"Reply to the first message",
    replyText:"First reader reply",
    followUpMessages:[{
      id:"first-follow-up",
      type:"text",
      senderId:"contact-1",
      text:"First character follow-up",
    }],
  }]
  messages.splice(1, 0, {
    id:"second-system-message",
    type:"system",
    senderId:"system",
    text:"A second group system message.",
  }, {
    id:"second-owner-message",
    type:"text",
    senderId:"contact-1",
    text:"This is the second question.",
    choices:[{
      id:"second-choice",
      text:"Reply to the second message",
      replyText:"Second reader reply",
      followUpMessages:[{
        id:"second-follow-up",
        type:"text",
        senderId:"contact-1",
        text:"Second character follow-up",
      }],
    }],
  })

  await openSeededChat(t, work)

  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /This is the second question/,
    "later choice owners must stay hidden until the current gate is answered",
  )
  assert.match(
    document.querySelector("#chatMsgArea").textContent,
    /A second group system message/,
    "system messages in the current group segment must not be swallowed by the reply gate",
  )
  let options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the first message"])
  options[0].click()

  assert.match(document.querySelector("#chatMsgArea").textContent, /First reader reply/)
  assert.match(document.querySelector("#chatMsgArea").textContent, /First character follow-up/)
  assert.match(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
  options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the second message"])
  options[0].click()

  const renderedText = document.querySelector("#chatMsgArea").textContent
  assert.match(renderedText, /First reader reply/)
  assert.match(renderedText, /Second reader reply/)
  assert.match(renderedText, /Second character follow-up/)
  assert.equal(document.querySelectorAll(".rd-chat-choice-reselect").length, 2)

  document.querySelectorAll(".rd-chat-choice-reselect")[0].click()

  const rerolledText = document.querySelector("#chatMsgArea").textContent
  assert.doesNotMatch(rerolledText, /First reader reply/)
  assert.doesNotMatch(rerolledText, /First character follow-up/)
  assert.match(rerolledText, /A second group system message/)
  assert.doesNotMatch(rerolledText, /This is the second question/)
  assert.doesNotMatch(rerolledText, /Second reader reply/)
  assert.doesNotMatch(rerolledText, /Second character follow-up/)
  assert.equal(document.querySelectorAll(".rd-chat-choice-reselect").length, 0)
  options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the first message"])
})
