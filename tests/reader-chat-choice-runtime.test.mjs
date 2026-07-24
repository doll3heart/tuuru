import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
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

test("reader chat delegates choice application and rollback to the shared immutable runtime", () => {
  const start = readerSource.indexOf("function openReaderChat")
  const end = readerSource.indexOf("// ---- Forum post viewer ----", start)
  const chatSource = readerSource.slice(start, end)

  assert.match(readerSource, /import\s*\{[^}]*applyChatChoice[^}]*rollbackChatChoice[^}]*\}\s*from\s*['"]\.\.\/js\/chat-choice-runtime\.js['"]/s)
  assert.match(chatSource, /new Map\s*\(/)
  assert.match(chatSource, /applyChatChoice\s*\(/)
  assert.match(chatSource, /rollbackChatChoice\s*\(/)
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
  assert.match(visibleText, /这是作者原本排在后面的消息/)

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
