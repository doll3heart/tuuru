import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import {
  emptyReaderLibrary,
  rememberReaderWork,
  saveReaderProgress,
  writeReaderLibrary,
} from "../reader/reader-library-state.js"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerAppearanceWorkbenchSource = readFileSync(new URL("../reader/reader-appearance-workbench.js", import.meta.url), "utf8")
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
                  replyPace: "instant",
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
                  replyPace: "instant",
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
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn")?.click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
}

async function openSeededChatWithProgress(t, work, progress, chatIndex = 0) {
  installDom(t)
  seedPhoneWork(work)
  let library = rememberReaderWork(emptyReaderLibrary(), work, 100)
  library = saveReaderProgress(library, work.id, progress, 110)
  assert.equal(writeReaderLibrary(localStorage, library), true)
  await import(`../reader/reader.js?reader-chat-choice-legacy=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn")?.click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector(`.rd-chat-card[data-chat-index="${chatIndex}"]`).click()
}

async function openSeededReadingFlowChat(t, work) {
  installDom(t)
  seedPhoneWork(work)
  await import(`../reader/reader.js?reader-chat-choice-flow=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  if (!document.getElementById("chatMsgArea")) {
    document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  }
  assert.ok(document.getElementById("chatMsgArea"))
}

async function reopenPersistedChat(t, work, persisted, importLabel) {
  installDom(t)
  localStorage.setItem("moirain_recent", persisted.recent)
  localStorage.setItem(`moirain_work_${work.id}`, persisted.work)
  localStorage.setItem("moirain_readerLibrary", persisted.library)
  await import(`../reader/reader.js?reader-chat-choice-${importLabel}=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]')?.click()
  document.querySelector(".rd-recent-item")?.click()
  document.getElementById("rdStartBtn")?.click()
  document.querySelector('[data-app-type="messages"]')?.click()
  if (!document.getElementById("chatMsgArea")) {
    document.querySelector('.rd-chat-card[data-chat-index="0"]')?.click()
  }
  assert.ok(document.getElementById("chatMsgArea"))
}

async function waitFor(check, timeoutMs = 3500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail("timed out waiting for reader chat state")
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

test("claiming a required red packet resumes a group choice reply queue", async t => {
  const work = choiceWork()
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "夜巡群"
  chat.rounds[0].messages[0].choices[0].followUpMessages = [
    {
      id: "required-redpacket",
      type: "redpacket",
      senderId: "contact-1",
      redpacketAmount: 6.66,
      redpacketMsg: "夜巡辛苦了",
      actionRequired: true,
      delayBeforeMs: 0,
    },
    {
      id: "after-redpacket",
      type: "text",
      senderId: "contact-1",
      text: "领完红包继续说。",
      revealMode: "instant",
      delayBeforeMs: 0,
    },
  ]
  await openSeededChat(t, work)

  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const claim = await waitFor(() => document.querySelector(".rd-card-claim"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /领完红包继续说/)
  claim.click()

  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("领完红包继续说"))
  assert.match(document.getElementById("chatMsgArea").textContent, /夜巡辛苦了[\s\S]*领完红包继续说/)
})

function requiredActionHydrationWork(readingFlow, suffix) {
  const work = choiceWork()
  work.id = `reader-hydrated-required-action-${suffix}`
  const chat = work.phoneData.chats[0]
  const owner = chat.rounds[0].messages[0]
  owner.revealMode = "instant"
  owner.choices = [{
    id:"required-action-choice",
    text:"Continue",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[
      {
        id:"hydrated-required-redpacket",
        type:"redpacket",
        senderId:"contact-1",
        redpacketAmount:1,
        redpacketMsg:"Claim before continuing",
        actionRequired:true,
        delayBeforeMs:0,
      },
      {
        id:"hydrated-after-required-action",
        type:"text",
        senderId:"contact-1",
        text:"AFTER_REQUIRED_ACTION",
        revealMode:"instant",
        delayBeforeMs:0,
      },
    ],
  }]
  chat.rounds[0].messages = [owner]
  if (readingFlow) {
    work.phoneData.readingFlow = {
      enabled:true,
      sequence:[{
        type:"messages",
        itemId:owner.id,
        chatId:chat.id,
        roundId:chat.rounds[0].id,
        label:"Required action choice",
      }],
    }
  }
  return work
}

async function chooseRequiredActionBranch(t, work, readingFlow) {
  if (readingFlow) {
    await openSeededReadingFlowChat(t, work)
    await waitFor(() => document.getElementById("chatInput")?.disabled === false)
  } else {
    await openSeededChat(t, work)
    document.getElementById("chatInput").click()
  }
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  return waitFor(() => document.querySelector(".rd-card-claim"))
}

for (const readingFlow of [false, true]) {
  test(`a hydrated action-required branch stays paused until claimed (${readingFlow ? "reading flow" : "plain chat"})`, async t => {
    const work = requiredActionHydrationWork(readingFlow, readingFlow ? "pending-flow" : "pending-plain")
    await chooseRequiredActionBranch(t, work, readingFlow)
    assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /AFTER_REQUIRED_ACTION/)

    const persisted = {
      recent:localStorage.getItem("moirain_recent"),
      work:localStorage.getItem(`moirain_work_${work.id}`),
      library:localStorage.getItem("moirain_readerLibrary"),
    }
    window.close()
    await reopenPersistedChat(t, work, persisted, `hydrated-required-${readingFlow}`)

    const claim = await waitFor(() => document.querySelector(".rd-card-claim"))
    assert.doesNotMatch(
      document.getElementById("chatMsgArea").textContent,
      /AFTER_REQUIRED_ACTION/,
      "hydration must not reveal messages after an unfinished required action",
    )
    claim.click()
    await waitFor(
      () => document.getElementById("chatMsgArea")?.textContent.includes("AFTER_REQUIRED_ACTION"),
      5000,
    )
    const renderedText = document.getElementById("chatMsgArea").textContent
    assert.ok(
      renderedText.indexOf("Claim before continuing") < renderedText.indexOf("AFTER_REQUIRED_ACTION"),
      "hydrated playback must resume in authored order after the action completes",
    )
  })
}

test("a completed required action stays completed after hydration", async t => {
  const work = requiredActionHydrationWork(false, "completed-plain")
  const firstClaim = await chooseRequiredActionBranch(t, work, false)
  firstClaim.click()
  await waitFor(
    () => document.getElementById("chatMsgArea")?.textContent.includes("AFTER_REQUIRED_ACTION"),
    5000,
  )

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "hydrated-required-completed")

  const hydratedClaim = await waitFor(() => document.querySelector(".rd-card-claim"))
  assert.equal(hydratedClaim.disabled, true, "hydration must not ask the reader to repeat a completed action")
  assert.match(document.getElementById("chatMsgArea").textContent, /AFTER_REQUIRED_ACTION/)
})

test("a completed choice action does not transfer to a different action after a work update", async t => {
  const work = requiredActionHydrationWork(false, "semantic-update")
  const claim = await chooseRequiredActionBranch(t, work, false)
  claim.click()

  const updatedChoice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  updatedChoice.followUpMessages = [{
    id:"hydrated-required-redpacket",
    type:"location",
    senderId:"contact-1",
    locationName:"A newly authored action",
    locationAddress:"This was not the claimed red packet",
    actionRequired:true,
    delayBeforeMs:0,
  }]
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "updated-action-semantic-key")

  const updatedAction = await waitFor(
    () => document.querySelector('[data-story-card="location"]'),
  )
  assert.equal(
    updatedAction.querySelector(".chat-action-state.is-complete"),
    null,
    "completing one authored action must not auto-complete a replacement at the same ordinal",
  )
})

test("a standalone authored action does not transfer completion to updated content with the same id", async t => {
  const work = choiceWork()
  work.id = "reader-standalone-action-semantic-update"
  const location = {
    id:"stable-location-action",
    type:"location",
    senderId:"contact-1",
    locationName:"Old station",
    locationAddress:"Platform one",
    actionRequired:true,
    delayBeforeMs:0,
  }
  work.phoneData.chats[0].rounds[0].messages = [location]

  await openSeededChat(t, work)
  const firstLocation = await waitFor(() => document.querySelector('[data-story-card="location"]'))
  firstLocation.click()
  assert.ok(firstLocation.querySelector(".chat-action-state.is-complete"))

  location.locationName = "New station"
  location.locationAddress = "Platform nine"
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "updated-standalone-action-semantic-key")

  const updatedLocation = await waitFor(() => document.querySelector('[data-story-card="location"]'))
  assert.equal(
    updatedLocation.querySelector(".chat-action-state.is-complete"),
    null,
    "a stable message id must not make newly authored action content look completed",
  )
})

test("an updated standalone friend request does not inherit the old answer", async t => {
  const work = choiceWork()
  work.id = "reader-standalone-friend-request-semantic-update"
  const friendRequest = {
    id:"stable-friend-request",
    type:"contact-event",
    eventKind:"friend-request",
    actorContactId:"contact-1",
    originalText:"Old verification note",
    actionRequired:true,
    delayBeforeMs:0,
  }
  work.phoneData.chats[0].rounds[0].messages = [friendRequest]

  await openSeededChat(t, work)
  const accept = await waitFor(
    () => document.querySelector('[data-story-response="accepted"]'),
  )
  accept.click()

  friendRequest.originalText = "A different verification note"
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "updated-standalone-friend-request")

  const updatedRequest = await waitFor(
    () => document.querySelector('[data-story-event-id="stable-friend-request"]'),
  )
  assert.equal(updatedRequest.querySelector(".rd-story-event-response"), null)
  assert.equal(updatedRequest.querySelectorAll("[data-story-response]").length, 2)
})

test("changing a reader placeholder does not invalidate a completed authored action", async t => {
  const work = choiceWork()
  work.id = "reader-action-placeholder-stable"
  work.placeholders = [{
    id:"reader-name",
    key:"TOKEN",
    label:"Reader name",
    prompt:"Name",
    default:"Alice",
    values:[],
    forbidden:[],
  }]
  work.readerPhValues = { "reader-name":["Alice"] }
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"placeholder-friend-request",
    type:"contact-event",
    eventKind:"friend-request",
    actorContactId:"contact-1",
    originalText:"TOKEN wants to add you",
    actionRequired:true,
    delayBeforeMs:0,
  }]

  await openSeededChat(t, work)
  const accept = await waitFor(() => document.querySelector('[data-story-response="accepted"]'))
  accept.click()

  const persistedLibrary = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const persistedBook = persistedLibrary.books.find(book => book.id === work.id)
  persistedBook.placeholderValues = { "reader-name":["Bob"] }
  persistedBook.slots.forEach(slot => {
    if (slot.id === persistedBook.activeSlotId) slot.placeholderValues = { "reader-name":["Bob"] }
  })
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:JSON.stringify(persistedLibrary),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "placeholder-action-stability")

  const restoredRequest = await waitFor(
    () => document.querySelector('[data-story-event-id="placeholder-friend-request"]'),
  )
  assert.match(restoredRequest.textContent, /Bob/)
  assert.equal(restoredRequest.querySelectorAll("[data-story-response]").length, 0)
  assert.ok(restoredRequest.querySelector(".rd-story-event-response"))
})

test("hexadecimal placeholder keys cannot rewrite an authored action fingerprint", async t => {
  const work = choiceWork()
  work.id = "reader-action-fingerprint-structural-placeholder"
  const hexKeys = [..."0123456789abcdef"]
  work.placeholders = hexKeys.map((key, index) => ({
    id:`hex-${index}`,
    key,
    label:`Hex ${key}`,
    prompt:`Hex ${key}`,
    default:"X",
    values:[],
    forbidden:[],
  }))
  work.readerPhValues = Object.fromEntries(hexKeys.map((_key, index) => [`hex-${index}`, ["X"]]))
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"hex-placeholder-friend-request",
    type:"contact-event",
    eventKind:"friend-request",
    actorContactId:"contact-1",
    originalText:"abcdef wants to add you",
    actionRequired:true,
    delayBeforeMs:0,
  }]

  await openSeededChat(t, work)
  const accept = await waitFor(() => document.querySelector('[data-story-response="accepted"]'))
  accept.click()

  const persistedLibrary = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const persistedBook = persistedLibrary.books.find(book => book.id === work.id)
  const changedValues = Object.fromEntries(hexKeys.map((_key, index) => [`hex-${index}`, ["Y"]]))
  persistedBook.placeholderValues = changedValues
  persistedBook.slots.forEach(slot => {
    if (slot.id === persistedBook.activeSlotId) slot.placeholderValues = changedValues
  })
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:JSON.stringify(persistedLibrary),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "hex-placeholder-action-stability")

  const restoredRequest = await waitFor(
    () => document.querySelector('[data-story-event-id="hex-placeholder-friend-request"]'),
  )
  assert.equal(restoredRequest.querySelectorAll("[data-story-response]").length, 0)
  assert.ok(restoredRequest.querySelector(".rd-story-event-response"))
})

test("a unique legacy friend request containing a placeholder migrates after substitution", async t => {
  const work = choiceWork()
  work.id = "reader-legacy-placeholder-action"
  work.placeholders = [{
    id:"reader-name",
    key:"TOKEN",
    label:"Reader name",
    prompt:"Name",
    default:"Alice",
    values:[],
    forbidden:[],
  }]
  work.readerPhValues = { "reader-name":["Alice"] }
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"legacy-placeholder-request",
    type:"contact-event",
    eventKind:"friend-request",
    actorContactId:"contact-1",
    originalText:"TOKEN wants to add you",
    actionRequired:true,
  }]

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:0,
    friendRequestResponses:{ "legacy-placeholder-request":"accepted" },
  })

  const request = await waitFor(
    () => document.querySelector('[data-story-event-id="legacy-placeholder-request"]'),
  )
  assert.match(request.textContent, /Alice/)
  assert.equal(request.querySelectorAll("[data-story-response]").length, 0)
  assert.ok(request.querySelector(".rd-story-event-response"))
})

test("a completed schedule choice keeps its accepted response after hydration", async t => {
  const work = choiceWork()
  work.id = "reader-hydrated-schedule-response"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices = [{
    id:"schedule-choice",
    text:"Open the invitation",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"required-schedule",
      type:"schedule",
      senderId:"contact-1",
      scheduleTitle:"Dinner",
      acceptLabel:"Accept",
      declineLabel:"Decline",
      actionRequired:true,
      delayBeforeMs:0,
    }],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const accept = await waitFor(
    () => document.querySelector('[data-schedule-response="accepted"]'),
  )
  accept.click()
  assert.match(document.querySelector(".rd-story-event-response").textContent, /Accept/)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "hydrated-schedule-response")

  const hydratedSchedule = await waitFor(() => document.querySelector(".chat-schedule-card"))
  assert.match(
    hydratedSchedule.querySelector(".rd-story-event-response")?.textContent || "",
    /Accept/,
    "hydration must restore which schedule response the reader chose",
  )
  assert.equal(hydratedSchedule.querySelectorAll("[data-schedule-response]").length, 0)
})

test("an updated schedule does not inherit a response from an older schedule with the same id", async t => {
  const work = choiceWork()
  work.id = "reader-updated-schedule-response"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices = [{
    id:"schedule-choice",
    text:"Open the invitation",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"stable-schedule-id",
      type:"schedule",
      senderId:"contact-1",
      scheduleTitle:"Dinner on Friday",
      scheduleTime:"Friday 18:00",
      acceptLabel:"Accept",
      declineLabel:"Decline",
      actionRequired:true,
      delayBeforeMs:0,
    }],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const accept = await waitFor(
    () => document.querySelector('[data-schedule-response="accepted"]'),
  )
  accept.click()

  const updatedSchedule = owner.choices[0].followUpMessages[0]
  updatedSchedule.scheduleTitle = "Interview on Monday"
  updatedSchedule.scheduleTime = "Monday 09:00"
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "updated-schedule-semantic-key")

  const hydratedSchedule = await waitFor(() => document.querySelector(".chat-schedule-card"))
  assert.equal(
    hydratedSchedule.querySelector(".rd-story-event-response"),
    null,
    "changing a schedule's meaning must invalidate the old response even when its authored id stays stable",
  )
  assert.equal(hydratedSchedule.querySelectorAll("[data-schedule-response]").length, 2)
  assert.equal(hydratedSchedule.querySelector(".chat-action-state.is-complete"), null)
})

test("inserting a different follow-up before a schedule does not erase its saved response", async t => {
  const work = choiceWork()
  work.id = "reader-schedule-source-id-stability"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  const schedule = {
    id:"stable-schedule",
    type:"schedule",
    senderId:"contact-1",
    scheduleTitle:"Dinner",
    scheduleTime:"Friday 18:00",
    acceptLabel:"Accept",
    declineLabel:"Decline",
    actionRequired:true,
    delayBeforeMs:0,
  }
  owner.choices = [{
    id:"schedule-choice",
    text:"Open the invitation",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[schedule],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const accept = await waitFor(
    () => document.querySelector('[data-schedule-response="accepted"]'),
  )
  accept.click()

  owner.choices[0].followUpMessages.unshift({
    id:"new-preface",
    type:"text",
    senderId:"contact-1",
    text:"A newly inserted preface",
    revealMode:"instant",
    delayBeforeMs:0,
  })
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "stable-follow-up-source-key")

  const hydratedSchedule = await waitFor(() => document.querySelector(".chat-schedule-card"))
  assert.match(hydratedSchedule.querySelector(".rd-story-event-response")?.textContent || "", /Accept/)
  assert.equal(hydratedSchedule.querySelectorAll("[data-schedule-response]").length, 0)
})

test("reselecting a branch rolls back the hidden contact it unlocked", async t => {
  const work = choiceWork()
  work.id = "reader-branch-contact-friendship-rollback"
  work.phoneData.contacts.push({
    id:"contact-hidden",
    name:"Hidden Friend",
    readerAddMode:"hidden",
  })
  work.phoneData.apps.push({
    id:"contacts-app",
    type:"contacts",
    name:"Contacts",
    icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/></svg>',
    desktopX:1,
    desktopY:0,
    enabled:true,
  })
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices.forEach(choice => {
    choice.silent = true
    choice.replyText = ""
    choice.replyPace = "instant"
    choice.followUpMessages = []
  })
  owner.choices[0].followUpMessages = [{
    id:"branch-contact-card",
    type:"contact-card",
    senderId:"contact-1",
    targetContactId:"contact-hidden",
    contactName:"Hidden Friend",
    contactAction:"direct",
    contactAcceptedText:"Friend added",
    actionRequired:true,
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const card = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
  card.click()
  const add = document.querySelector(".rd-contact-card-action")
  assert.ok(add)
  add.click()
  document.querySelector(".rd-chat-story-pip-close").click()

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "hydrated-contact-friendship-rollback")

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()
  document.getElementById("chatBack").click()
  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="contacts"]').click()

  assert.doesNotMatch(
    document.querySelector(".rd-contact-book").textContent,
    /Hidden Friend/,
    "a contact unlocked only by a rolled-back branch must become hidden again",
  )
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(saved.progress.contactFriendships["contact-hidden"], undefined)
  assert.equal(saved.progress.contactFriendshipSources["contact-hidden"], undefined)
})

test("auto-advancing a completed contact-card detail does not leave a stale browser-history layer", async t => {
  const work = choiceWork()
  work.id = "reader-contact-card-pip-history-cleanup"
  work.phoneData.contacts.push({ id:"contact-2", name:"B", readerAddMode:"hidden" })
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices = [{
    id:"go",
    text:"go",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[
      {
        id:"required-card",
        type:"contact-card",
        senderId:"contact-1",
        targetContactId:"contact-2",
        contactName:"B",
        contactAction:"direct",
        actionRequired:true,
        delayBeforeMs:0,
      },
      {
        id:"after-card",
        type:"text",
        senderId:"contact-1",
        text:"AFTER_ACTION",
        revealMode:"instant",
        delayBeforeMs:0,
      },
    ],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()
  const card = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
  card.click()
  assert.ok(document.querySelector(".rd-chat-story-pip"))
  document.querySelector("[data-contact-card-action]").click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("AFTER_ACTION"))
  assert.equal(document.querySelector(".rd-chat-story-pip"), null)

  window.history.back()
  await waitFor(() => document.querySelector(".rd-chat-card"), 1000)
  assert.equal(document.getElementById("chatMsgArea"), null, "one Back must leave chat after the auto-dismissed PIP")
})

test("ambiguous legacy friend-request ids cannot be consumed by the wrong chat", async t => {
  const work = choiceWork()
  work.id = "reader-legacy-duplicate-friend-request-isolation"
  work.phoneData.chats = [0, 1].map(index => ({
    id:`chat-${index + 1}`,
    type:"single",
    contactIds:["contact-1"],
    messages:[],
    rounds:[{
      id:`round-${index + 1}`,
      messages:[{
        id:"shared-request",
        type:"contact-event",
        eventKind:"friend-request",
        senderId:"system",
        actorContactId:"contact-1",
        targetContactId:"self",
        originalText:`request ${index + 1}`,
        actionRequired:true,
      }],
    }],
  }))

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:0,
    friendRequestResponses:{ "shared-request":"accepted" },
  })

  assert.equal(document.querySelectorAll('[data-story-response]').length, 2)
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  assert.equal(document.querySelectorAll('[data-story-response]').length, 2)
})

test("a unique legacy contact-card response gains semantic rollback provenance", async t => {
  const work = choiceWork()
  work.id = "reader-legacy-contact-card-provenance"
  work.phoneData.contacts.push({ id:"contact-hidden", name:"Hidden", readerAddMode:"hidden" })
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"legacy-card",
    type:"contact-card",
    senderId:"contact-1",
    targetContactId:"contact-hidden",
    contactName:"Hidden",
    contactAction:"direct",
    actionRequired:true,
  }]

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:0,
    contactCardResponses:{ "legacy-card":"accepted" },
    contactFriendships:{ "contact-hidden":"accepted" },
  })

  assert.match(document.querySelector('[data-story-message-id="legacy-card"]').textContent, /已/)
  window.dispatchEvent(new window.Event("pagehide"))
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id).progress
  assert.equal(saved.contactCardResponses["legacy-card"], undefined)
  assert.match(saved.contactFriendshipSources["contact-hidden"], /^\["message","chat-id:chat-1","legacy-card",/)
})

test("pruning a hidden legacy contact-card branch removes its source-less friendship", async t => {
  const work = choiceWork()
  work.id = "reader-pruned-legacy-contact-card"
  work.phoneData.contacts.push({ id:"contact-hidden", name:"Hidden", readerAddMode:"hidden" })
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"hidden-owner",
    type:"text",
    senderId:"contact-1",
    text:"Hidden owner",
    displayCondition:{ all:[{ anyChoiceIds:["missing-choice"] }] },
    choices:[{
      id:"hidden-choice",
      text:"Hidden choice",
      replyText:"",
      silent:true,
      followUpMessages:[{
        id:"hidden-legacy-card",
        type:"contact-card",
        senderId:"contact-1",
        targetContactId:"contact-hidden",
        contactAction:"direct",
        actionRequired:true,
      }],
    }],
  }]

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:0,
    phoneChoiceSelections:{ "hidden-owner":"hidden-choice" },
    contactCardResponses:{ "hidden-legacy-card":"accepted" },
    contactFriendships:{ "contact-hidden":"accepted" },
  })
  window.dispatchEvent(new window.Event("pagehide"))
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id).progress
  assert.equal(saved.phoneChoiceSelections["hidden-owner"], undefined)
  assert.equal(saved.contactCardResponses["hidden-legacy-card"], undefined)
  assert.equal(saved.contactFriendships["contact-hidden"], undefined)
})

test("reselecting a branch immediately restores the authored group identity", async t => {
  const work = choiceWork()
  work.id = "reader-group-rename-reselect-baseline"
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "ORIGINAL_GROUP"
  chat.groupOwnerId = "contact-1"
  chat.groupAdminIds = []
  chat.groupTitles = {}
  const owner = chat.rounds[0].messages[0]
  owner.choices = [{
    id:"rename-branch",
    text:"Rename",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"branch-group-rename",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"BRANCH_GROUP",
      delayBeforeMs:0,
    }],
  }]
  chat.rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("BRANCH_GROUP"))
  document.querySelector(".rd-chat-choice-reselect").click()
  assert.match(document.querySelector(".chat-round-title strong").textContent, /ORIGINAL_GROUP/)
  assert.doesNotMatch(document.querySelector(".chat-round-title strong").textContent, /BRANCH_GROUP/)

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.match(document.querySelector(".chat-round-title strong").textContent, /ORIGINAL_GROUP/)
})

test("a played group update survives a full reader reload", async t => {
  const work = choiceWork()
  work.id = "reader-group-update-refresh"
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "BASE_GROUP"
  const owner = chat.rounds[0].messages[0]
  owner.revealMode = "instant"
  owner.choices = [{
    id:"rename-group",
    text:"Rename",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"persisted-group-rename",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"CHANGED_GROUP",
      revealMode:"instant",
      delayBeforeMs:0,
    }],
  }]
  chat.rounds[0].messages = [owner]

  await openSeededChat(t, work)
  chooseReaderChatOption(0)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("CHANGED_GROUP"))
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "group-update-refresh")
  assert.match(document.querySelector(".chat-round-title strong").textContent, /CHANGED_GROUP/)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /CHANGED_GROUP/)
})

test("a selected delayed group update waits again after a full reader reload", async t => {
  const work = choiceWork()
  work.id = "reader-delayed-group-effect-refresh"
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "BASE_GROUP"
  const owner = chat.rounds[0].messages[0]
  owner.revealMode = "instant"
  owner.choices = [{
    id:"delayed-group-choice",
    text:"Rename later",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"delayed-group-rename",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"DELAYED_GROUP",
      revealMode:"instant",
      delayBeforeMs:800,
    }],
  }]
  chat.rounds[0].messages = [owner]

  await openSeededChat(t, work)
  chooseReaderChatOption(0)
  assert.match(document.querySelector(".chat-round-title strong").textContent, /BASE_GROUP/)
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "delayed-group-effect-refresh")
  assert.match(document.querySelector(".chat-round-title strong").textContent, /BASE_GROUP/)
  await waitFor(
    () => document.querySelector(".chat-round-title strong")?.textContent.includes("DELAYED_GROUP"),
    3000,
  )
})

test("group state follows actual reading-flow playback order", async t => {
  const work = choiceWork()
  work.id = "reader-group-reading-flow-effect-order"
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "BASE_GROUP"
  chat.rounds[0].messages = [
    {
      id:"rename-a",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"GROUP_A",
      revealMode:"instant",
      delayBeforeMs:300,
    },
    {
      id:"rename-b",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"GROUP_B",
      revealMode:"instant",
      delayBeforeMs:0,
    },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"rename-b", chatId:chat.id, roundId:chat.rounds[0].id },
      { type:"messages", itemId:"rename-a", chatId:chat.id, roundId:chat.rounds[0].id },
    ],
  }

  await openSeededReadingFlowChat(t, work)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("GROUP_B"))
  await waitFor(
    () => document.querySelector(".chat-round-title strong")?.textContent.includes("GROUP_A"),
    3000,
  )
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.match(saved.progress.phoneStoryEffectOrder[0], /rename-b/)
  assert.match(saved.progress.phoneStoryEffectOrder[1], /rename-a/)
})

test("a legacy completed reading-flow save migrates story effects in playback order", async t => {
  const work = choiceWork()
  work.id = "reader-legacy-group-reading-flow-effect-order"
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "BASE_GROUP"
  chat.rounds[0].messages = [
    {
      id:"legacy-rename-a",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"GROUP_A",
      revealMode:"instant",
      delayBeforeMs:0,
    },
    {
      id:"legacy-rename-b",
      type:"system-event",
      eventKind:"group-rename",
      senderId:"system",
      newName:"GROUP_B",
      revealMode:"instant",
      delayBeforeMs:0,
    },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"legacy-rename-b", chatId:chat.id, roundId:chat.rounds[0].id },
      { type:"messages", itemId:"legacy-rename-a", chatId:chat.id, roundId:chat.rounds[0].id },
    ],
  }

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:2,
  })

  assert.match(document.querySelector(".chat-round-title strong").textContent, /GROUP_A/)
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(saved.progress.phoneStoryEffectOrder.length, 2)
  assert.match(saved.progress.phoneStoryEffectOrder[0], /legacy-rename-b/)
  assert.match(saved.progress.phoneStoryEffectOrder[1], /legacy-rename-a/)
})

test("idless group chats keep independent story overrides", async t => {
  const work = choiceWork()
  work.id = "reader-idless-group-effect-scope"
  work.phoneData.chats = ["GROUP_ONE", "GROUP_TWO"].map((groupName, chatIndex) => ({
    type:"group",
    groupName,
    contactIds:["contact-1"],
    messages:[],
    rounds:[{
      id:`round-${chatIndex}`,
      messages:[{
        id:`rename-${chatIndex}`,
        type:"system-event",
        eventKind:"group-rename",
        senderId:"system",
        newName:`CHANGED_${chatIndex}`,
        revealMode:"instant",
        delayBeforeMs:0,
      }],
    }],
  }))

  await openSeededChat(t, work)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("CHANGED_0"))
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /CHANGED_0/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /GROUP_TWO/)
  openReaderChatFromList(1)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("CHANGED_1"))
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /CHANGED_0/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /CHANGED_1/)
})

test("reselecting a branch immediately restores the authored contact identity", async t => {
  const work = choiceWork()
  work.id = "reader-contact-rename-reselect-baseline"
  work.phoneData.contacts[0].name = "ORIGINAL_CONTACT"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices = [{
    id:"rename-contact-branch",
    text:"Rename contact",
    replyText:"",
    silent:true,
    replyPace:"instant",
    followUpMessages:[{
      id:"branch-contact-rename",
      type:"contact-event",
      eventKind:"contact-update",
      senderId:"system",
      targetContactId:"contact-1",
      newName:"BRANCH_CONTACT",
      delayBeforeMs:0,
    }],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("BRANCH_CONTACT"))
  document.querySelector(".rd-chat-choice-reselect").click()
  assert.match(document.querySelector(".chat-round-title strong").textContent, /ORIGINAL_CONTACT/)
  assert.doesNotMatch(document.querySelector(".chat-round-title strong").textContent, /BRANCH_CONTACT/)

  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /ORIGINAL_CONTACT/)
})

function crossChatContactUpdateWork(id, sharedName = "") {
  function update(messageId, targetContactId, newName) {
    return {
      id:messageId,
      type:"contact-event",
      eventKind:"contact-update",
      senderId:"system",
      targetContactId,
      newName,
      delayBeforeMs:0,
      revealMode:"instant",
    }
  }
  function choice(choiceId, followUpMessages) {
    return {
      id:choiceId,
      text:choiceId,
      replyText:"",
      silent:true,
      replyPace:"instant",
      followUpMessages,
    }
  }
  function chat(chatId, contactId, choices = []) {
    return {
      id:chatId,
      type:"single",
      contactIds:[contactId],
      messages:[],
      rounds:[{
        id:`${chatId}-round`,
        messages:[{
          id:`${chatId}-owner`,
          type:"text",
          senderId:contactId,
          text:`owner-${chatId}`,
          ...(choices.length ? { choices } : {}),
        }],
      }],
    }
  }
  const work = choiceWork()
  work.id = id
  work.phoneData.contacts = [
    { id:"contact-1", name:"BASE_ONE" },
    { id:"contact-2", name:"BASE_TWO" },
    { id:"contact-3", name:"BASE_THREE" },
  ]
  work.phoneData.chats = [
    chat("chat-a", "contact-1", [
      choice("a-change", [
        update("a-update-one", "contact-1", sharedName || "A_ONE"),
        update("a-update-two", "contact-2", "A_TWO"),
      ]),
      choice("a-none", []),
    ]),
    chat("chat-b", "contact-2", [
      choice("b-change", [
        update("b-update-one", "contact-1", sharedName || "B_ONE"),
        update("b-update-three", "contact-3", "B_THREE"),
      ]),
      choice("b-none", []),
    ]),
    chat("chat-c", "contact-3"),
  ]
  return work
}

function chooseReaderChatOption(choiceIndex) {
  document.getElementById("chatInput").click()
  const option = document.querySelector(`.rd-reply-option[data-ci="${choiceIndex}"]`)
  assert.ok(option)
  option.click()
}

function openReaderChatFromList(chatIndex) {
  const card = document.querySelector(`.rd-chat-card[data-chat-index="${chatIndex}"]`)
  assert.ok(card)
  card.click()
  assert.ok(document.getElementById("chatMsgArea"))
}

test("cross-chat contact updates follow effect order instead of navigation order", async t => {
  const work = crossChatContactUpdateWork("reader-cross-chat-contact-effect-order")
  await openSeededChat(t, work)

  chooseReaderChatOption(0)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("A_ONE"))
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return saved?.progress?.phoneStoryEffectOrder?.length === 2
  })
  document.getElementById("chatBack").click()
  openReaderChatFromList(1)
  chooseReaderChatOption(0)
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return saved?.progress?.phoneStoryEffectOrder?.length === 4
  })
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /B_ONE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /A_TWO/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="2"]').textContent, /B_THREE/)

  openReaderChatFromList(0)
  assert.match(document.querySelector(".chat-round-title strong").textContent, /B_ONE/)
  document.querySelector(".rd-chat-choice-reselect").click()
  assert.match(document.querySelector(".chat-round-title strong").textContent, /B_ONE/)
  chooseReaderChatOption(1)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /B_ONE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /BASE_TWO/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="2"]').textContent, /B_THREE/)

  openReaderChatFromList(1)
  document.querySelector(".rd-chat-choice-reselect").click()
  chooseReaderChatOption(1)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /BASE_ONE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /BASE_TWO/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="2"]').textContent, /BASE_THREE/)
})

test("same-value contact updates remain independent when one branch is rolled back", async t => {
  const work = crossChatContactUpdateWork("reader-cross-chat-contact-same-value", "SAME_NAME")
  await openSeededChat(t, work)

  chooseReaderChatOption(0)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("SAME_NAME"))
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return saved?.progress?.phoneStoryEffectOrder?.length === 2
  })
  document.getElementById("chatBack").click()
  openReaderChatFromList(1)
  chooseReaderChatOption(0)
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return saved?.progress?.phoneStoryEffectOrder?.length === 4
  })
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /SAME_NAME/)
  openReaderChatFromList(0)
  document.querySelector(".rd-chat-choice-reselect").click()
  assert.match(document.querySelector(".chat-round-title strong").textContent, /SAME_NAME/)
})

test("persisted contact effect order rebuilds before its source chat is reopened", async t => {
  const work = crossChatContactUpdateWork("reader-cross-chat-contact-effect-refresh")
  await openSeededChat(t, work)
  document.getElementById("chatBack").click()
  openReaderChatFromList(1)
  chooseReaderChatOption(0)
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return saved?.progress?.phoneStoryEffectOrder?.length === 2
  })
  document.getElementById("chatBack").click()
  window.dispatchEvent(new window.Event("pagehide"))
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "cross-chat-contact-effect-refresh")
  assert.match(document.querySelector(".chat-round-title strong").textContent, /B_ONE/)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="2"]').textContent, /B_THREE/)
})

test("a delayed contact update is not persisted before it becomes visible", async t => {
  const work = crossChatContactUpdateWork("reader-delayed-contact-effect-gate")
  const delayedChoice = work.phoneData.chats[1].rounds[0].messages[0].choices[0]
  delayedChoice.followUpMessages = [
    {
      ...delayedChoice.followUpMessages[0],
      delayBeforeMs:1000,
    },
  ]
  await openSeededChat(t, work)
  document.getElementById("chatBack").click()
  openReaderChatFromList(1)
  chooseReaderChatOption(0)
  document.getElementById("chatBack").click()

  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /BASE_ONE/)
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.deepEqual(saved.progress.phoneStoryEffectOrder, [])
})

test("a failed choice contact update never changes or persists contact identity", async t => {
  const work = crossChatContactUpdateWork("reader-failed-contact-effect")
  work.phoneData.chats[0].rounds[0].messages[0].choices[0].followUpMessages = [{
    id:"failed-contact-update",
    type:"contact-event",
    eventKind:"contact-update",
    senderId:"system",
    targetContactId:"contact-1",
    newName:"SHOULD_NOT_APPLY",
    deliveryState:"failed",
    delayBeforeMs:0,
  }]

  await openSeededChat(t, work)
  chooseReaderChatOption(0)
  await waitFor(() => document.querySelector(".rd-chat-choice-reselect"))
  await new Promise(resolve => setTimeout(resolve, 50))

  assert.match(document.querySelector(".chat-round-title strong").textContent, /BASE_ONE/)
  assert.doesNotMatch(document.querySelector(".chat-round-title strong").textContent, /SHOULD_NOT_APPLY/)
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.deepEqual(saved.progress.phoneStoryEffectOrder, [])
})

test("duplicate authored message ids keep distinct contact-update effects", async t => {
  const work = crossChatContactUpdateWork("reader-duplicate-direct-contact-effects")
  work.phoneData.chats = [
    {
      id:"duplicate-source-chat",
      type:"single",
      contactIds:["contact-1"],
      messages:[],
      rounds:[{
        id:"duplicate-round",
        messages:[
          {
            id:"duplicate",
            type:"contact-event",
            eventKind:"contact-update",
            targetContactId:"contact-1",
            newName:"FIRST",
            revealMode:"instant",
            delayBeforeMs:0,
          },
          {
            id:"duplicate",
            type:"contact-event",
            eventKind:"contact-update",
            targetContactId:"contact-1",
            newName:"SECOND",
            revealMode:"instant",
            delayBeforeMs:0,
          },
          {
            id:"duplicate",
            type:"contact-event",
            eventKind:"contact-update",
            targetContactId:"contact-1",
            newName:"SECOND",
            revealMode:"instant",
            delayBeforeMs:0,
          },
        ],
      }],
    },
  ]

  await openSeededChat(t, work)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("SECOND"))
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(saved.progress.phoneStoryEffectOrder.length, 3)
  assert.equal(new Set(saved.progress.phoneStoryEffectOrder).size, 3)
})

test("a long effect ledger preserves every authored event without replay rotation", async t => {
  const work = crossChatContactUpdateWork("reader-contact-effect-compaction")
  work.phoneData.chats = [
    {
      id:"large-effect-chat",
      type:"single",
      contactIds:["contact-1"],
      messages:[],
      rounds:[{
        id:"large-effect-round",
        messages:[
          {
            id:"surviving-contact-one-update",
            type:"contact-event",
            eventKind:"contact-update",
            targetContactId:"contact-1",
            newName:"SHOULD_SURVIVE",
            revealMode:"instant",
            delayBeforeMs:0,
          },
          ...Array.from({ length:1000 }, (_, index) => ({
            id:`later-contact-two-update-${index}`,
            type:"contact-event",
            eventKind:"contact-update",
            targetContactId:"contact-2",
            newName:`LATER_${index}`,
            revealMode:"instant",
            delayBeforeMs:0,
          })),
        ],
      }],
    },
    {
      id:"contact-two-chat",
      type:"single",
      contactIds:["contact-2"],
      messages:[],
      rounds:[],
    },
  ]

  await openSeededChat(t, work)
  await waitFor(() => document.querySelector(".chat-round-title strong")?.textContent.includes("SHOULD_SURVIVE"), 10000)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /SHOULD_SURVIVE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /LATER_999/)
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(saved.progress.phoneStoryEffectOrder.length, 1001)
  assert.ok(saved.progress.phoneStoryEffectOrder.some(key => key.includes("surviving-contact-one-update")))
  openReaderChatFromList(0)
  assert.match(document.querySelector(".chat-round-title strong").textContent, /SHOULD_SURVIVE/)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /SHOULD_SURVIVE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /LATER_999/)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "long-effect-ledger-refresh")
  assert.match(document.querySelector(".chat-round-title strong").textContent, /SHOULD_SURVIVE/)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="0"]').textContent, /SHOULD_SURVIVE/)
  assert.match(document.querySelector('.rd-chat-card[data-chat-index="1"]').textContent, /LATER_999/)
  const restored = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(restored.progress.phoneStoryEffectOrder.length, 1001)
})

test("a selected delayed contact update waits again after a full reader reload", async t => {
  const work = crossChatContactUpdateWork("reader-delayed-contact-effect-refresh")
  const delayedChoice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  delayedChoice.followUpMessages = [{
    ...delayedChoice.followUpMessages[0],
    delayBeforeMs:800,
  }]
  await openSeededChat(t, work)
  chooseReaderChatOption(0)
  assert.match(document.querySelector(".chat-round-title strong").textContent, /BASE_ONE/)
  const beforeReload = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.deepEqual(beforeReload.progress.phoneStoryEffectOrder, [])
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "delayed-contact-effect-refresh")
  assert.match(document.querySelector(".chat-round-title strong").textContent, /BASE_ONE/)
  await waitFor(
    () => document.querySelector(".chat-round-title strong")?.textContent.includes("A_ONE"),
    3000,
  )
})

test("a selected delayed ordinary follow-up waits again after a full reader reload", async t => {
  const work = choiceWork()
  work.id = "reader-delayed-ordinary-follow-up-refresh"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"delayed-ordinary-follow-up",
    type:"text",
    senderId:"contact-1",
    text:"ORDINARY_DELAY_COMPLETE",
    revealMode:"instant",
    delayBeforeMs:1200,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /ORDINARY_DELAY_COMPLETE/)

  const beforeReload = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(Object.keys(beforeReload.progress.phonePendingChoicePlaybacks || {}).length, 1)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "delayed-ordinary-follow-up-refresh")
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /ORDINARY_DELAY_COMPLETE/)
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /ORDINARY_DELAY_COMPLETE/)
  await waitFor(
    () => document.getElementById("chatMsgArea")?.textContent.includes("ORDINARY_DELAY_COMPLETE"),
    3000,
  )
  await waitFor(() => {
    const afterPlayback = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    return afterPlayback.progress.phonePendingChoicePlaybacks === undefined
  }, 3000)
})

test("a completed reader reply stays complete while its delayed follow-up hydrates", async t => {
  const work = choiceWork()
  work.id = "reader-completed-reply-delayed-follow-up-refresh"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].text = "READER_REPLY_COMPLETE"
  owner.choices[0].replyText = "READER_REPLY_COMPLETE"
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"reply-delayed-follow-up",
    type:"text",
    senderId:"contact-1",
    text:"FOLLOW_UP_AFTER_RELOAD",
    revealMode:"instant",
    delayBeforeMs:1500,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => {
    const selfMessage = document.querySelector(".rd-chat-message.is-self")
    if (!selfMessage?.textContent.includes("READER_REPLY_COMPLETE")) return false
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
      .books.find(book => book.id === work.id)
    const pending = Object.values(saved.progress.phonePendingChoicePlaybacks || {})[0]
    return pending?.phase === "waiting" && pending?.nextIndex === 1
  }, 5000)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "completed-reader-reply-refresh")
  const restoredReply = document.querySelector(".rd-chat-message.is-self")
  assert.ok(restoredReply)
  assert.match(restoredReply.textContent, /READER_REPLY_COMPLETE/)
  assert.equal(restoredReply.querySelector(".rd-flow-stream-text"), null)
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.match(document.querySelector(".rd-chat-message.is-self").textContent, /READER_REPLY_COMPLETE/)
  assert.equal(document.querySelector(".rd-chat-message.is-self .rd-flow-stream-text"), null)
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /FOLLOW_UP_AFTER_RELOAD/)
})

test("a mid-stream ordinary follow-up resumes its saved prefix after a full reader reload", async t => {
  const work = choiceWork()
  work.id = "reader-stream-ordinary-follow-up-refresh"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"stream-ordinary-follow-up",
    type:"text",
    senderId:"contact-1",
    text:"ABCDEFGHIJKLMN",
    revealMode:"stream",
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const stream = await waitFor(() => {
    const candidate = document.querySelector(".rd-flow-stream-text")
    return candidate && candidate.textContent.length >= 3 && candidate.textContent.length < 14
      ? candidate
      : null
  })
  const prefix = stream.textContent
  window.dispatchEvent(new window.Event("pagehide"))
  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "stream-ordinary-follow-up-refresh")
  const resumed = document.querySelector(".rd-flow-stream-text")
  assert.ok(resumed)
  assert.equal(resumed.textContent, prefix)
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("ABCDEFGHIJKLMN"))
})

test("a mixed text system and image queue keeps its order across a full reader reload", async t => {
  const work = choiceWork()
  work.id = "reader-mixed-follow-up-refresh-order"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  const imageUrl = "data:image/png;base64,bWl4ZWQtcXVldWU="
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [
    {
      id:"mixed-first-text",
      type:"text",
      senderId:"contact-1",
      text:"FIRST_TEXT_READY",
      revealMode:"instant",
      delayBeforeMs:0,
    },
    {
      id:"mixed-system-notice",
      type:"system",
      senderId:"system",
      text:"SYSTEM_NOTICE_READY",
      delayBeforeMs:1200,
    },
    {
      id:"mixed-final-image",
      type:"image",
      senderId:"contact-1",
      image:imageUrl,
      delayBeforeMs:500,
    },
  ]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("FIRST_TEXT_READY"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /SYSTEM_NOTICE_READY/)
  assert.equal(document.querySelector(`#chatMsgArea img[src="${imageUrl}"]`), null)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()

  await reopenPersistedChat(t, work, persisted, "mixed-follow-up-refresh-order")
  assert.match(document.getElementById("chatMsgArea").textContent, /FIRST_TEXT_READY/)
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /SYSTEM_NOTICE_READY/)
  assert.equal(document.querySelector(`#chatMsgArea img[src="${imageUrl}"]`), null)
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /SYSTEM_NOTICE_READY/)

  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("SYSTEM_NOTICE_READY"), 3000)
  assert.equal(document.querySelector(`#chatMsgArea img[src="${imageUrl}"]`), null)
  await waitFor(() => document.querySelector(`#chatMsgArea img[src="${imageUrl}"]`), 3000)
  const text = document.getElementById("chatMsgArea").textContent
  assert.ok(text.indexOf("FIRST_TEXT_READY") < text.indexOf("SYSTEM_NOTICE_READY"))
})

test("a changed pending choice branch restarts instead of skipping its new playback", async t => {
  const work = choiceWork()
  work.id = "reader-changed-pending-choice-playback"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"changed-pending-follow-up",
    type:"text",
    senderId:"contact-1",
    text:"UPDATED_PENDING_CONTENT",
    revealMode:"instant",
    delayBeforeMs:700,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]
  const playbackKey = JSON.stringify(["choice-playback", "chat-id:chat-1", owner.id])

  await openSeededChatWithProgress(t, work, {
    kind:"phone",
    flowIndex:0,
    phoneChoiceSelections:{ [owner.id]:owner.choices[0].id },
    phonePendingChoicePlaybacks:{
      [playbackKey]:{
        chatPersistenceKey:"chat-id:chat-1",
        ownerMessageId:owner.id,
        selectedChoiceId:owner.choices[0].id,
        playbackSignature:"stale-signature",
        nextIndex:0,
        phase:"waiting",
        textIndex:0,
        advanceDeadline:Date.now() + 10_000,
      },
    },
  })

  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /UPDATED_PENDING_CONTENT/)
  await new Promise(resolve => setTimeout(resolve, 250))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /UPDATED_PENDING_CONTENT/)
  await waitFor(
    () => document.getElementById("chatMsgArea")?.textContent.includes("UPDATED_PENDING_CONTENT"),
    2500,
  )
})

test("reselecting a partially played branch clears its persisted playback cursor", async t => {
  const work = choiceWork()
  work.id = "reader-pending-choice-reselect-cleanup"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [
    {
      id:"reselect-first-visible",
      type:"text",
      senderId:"contact-1",
      text:"FIRST_BEFORE_RESELECT",
      revealMode:"instant",
      delayBeforeMs:0,
    },
    {
      id:"reselect-still-pending",
      type:"text",
      senderId:"contact-1",
      text:"MUST_NOT_SURVIVE_RESELECT",
      revealMode:"instant",
      delayBeforeMs:1500,
    },
  ]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("FIRST_BEFORE_RESELECT"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /MUST_NOT_SURVIVE_RESELECT/)
  document.querySelector(".rd-chat-choice-reselect").click()

  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /FIRST_BEFORE_RESELECT/)
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /MUST_NOT_SURVIVE_RESELECT/)
  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(saved.progress.phonePendingChoicePlaybacks, undefined)
  assert.equal(saved.progress.phoneChoiceSelections[owner.id], undefined)
})

test("reselecting a branch rolls back a display-mode contact card friendship", async t => {
  const work = choiceWork()
  work.id = "reader-display-contact-friendship-rollback"
  work.phoneData.contacts.push({
    id:"contact-hidden",
    name:"Hidden Friend",
    readerAddMode:"hidden",
  })
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices.forEach(choice => {
    choice.silent = true
    choice.replyText = ""
    choice.replyPace = "instant"
    choice.followUpMessages = []
  })
  owner.choices[0].followUpMessages = [{
    id:"display-contact-card",
    type:"contact-card",
    senderId:"contact-1",
    targetContactId:"contact-hidden",
    contactName:"Hidden Friend",
    contactAction:"direct",
    contactAcceptedText:"Friend added",
    actionRequired:false,
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const card = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
  card.click()
  document.querySelector(".rd-contact-card-action").click()
  document.querySelector(".rd-chat-story-pip-close").click()
  document.querySelector(".rd-chat-choice-reselect").click()

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(
    saved.progress.contactFriendships["contact-hidden"],
    undefined,
    "a display-mode contact action must remain owned by the branch that exposed it",
  )
  assert.equal(saved.progress.contactFriendshipSources["contact-hidden"], undefined)
  assert.equal(Object.keys(saved.progress.contactCardResponses || {}).length, 0)
})

test("reselecting a branch rolls back an authored continuation contact card", async t => {
  const work = choiceWork()
  work.id = "reader-authored-contact-friendship-rollback"
  work.phoneData.contacts.push({
    id:"contact-hidden",
    name:"Hidden Friend",
    readerAddMode:"hidden",
  })
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices.forEach(choice => {
    choice.silent = true
    choice.replyText = ""
    choice.replyPace = "instant"
    choice.followUpMessages = []
  })
  work.phoneData.chats[0].rounds = [{
    id:"round-1",
    messages:[owner],
  }, {
    id:"round-2",
    messages:[{
      id:"authored-contact-card",
      type:"contact-card",
      senderId:"contact-1",
      targetContactId:"contact-hidden",
      contactName:"Hidden Friend",
      contactAction:"direct",
      contactAcceptedText:"Friend added",
      actionRequired:true,
      visibleAfterChoiceId:"choice-a",
      delayBeforeMs:0,
    }],
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const card = await waitFor(
    () => document.querySelector('[data-story-message-id="authored-contact-card"]'),
  )
  card.click()
  document.querySelector(".rd-contact-card-action").click()
  document.querySelector(".rd-chat-story-pip-close").click()
  document.querySelector(".rd-chat-choice-reselect").click()

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(
    saved.progress.contactFriendships["contact-hidden"],
    undefined,
    "an authored action hidden by rollback must not keep its contact unlocked",
  )
  assert.equal(saved.progress.contactFriendshipSources["contact-hidden"], undefined)
  assert.equal(saved.progress.contactCardResponses["authored-contact-card"], undefined)
})

for (const actionRequired of [true, false]) {
  test(`an updated authored contact card does not reuse its old target (${actionRequired ? "required" : "display"})`, async t => {
    const work = choiceWork()
    work.id = `reader-updated-contact-target-${actionRequired ? "required" : "display"}`
    work.phoneData.contacts.push(
      { id:"contact-old-target", name:"Old Target", readerAddMode:"hidden" },
      { id:"contact-new-target", name:"New Target", readerAddMode:"hidden" },
    )
    const owner = work.phoneData.chats[0].rounds[0].messages[0]
    owner.choices = [{
      id:"choice-a",
      text:"Choose A",
      replyText:"",
      silent:true,
      replyPace:"instant",
      followUpMessages:[],
    }]
    const contactCard = {
      id:"stable-authored-contact-card",
      type:"contact-card",
      senderId:"contact-1",
      targetContactId:"contact-old-target",
      contactName:"Old Target",
      contactAction:"direct",
      contactAcceptedText:"Friend added",
      actionRequired,
      visibleAfterChoiceId:"choice-a",
      delayBeforeMs:0,
    }
    work.phoneData.chats[0].rounds = [{
      id:"round-1",
      messages:[owner],
    }, {
      id:"round-2",
      messages:[contactCard],
    }]

    await openSeededChat(t, work)
    document.getElementById("chatInput").click()
    document.querySelector('.rd-reply-option[data-ci="0"]').click()
    const firstCard = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
    firstCard.click()
    const firstAdd = await waitFor(() => document.querySelector("[data-contact-card-action]"))
    firstAdd.click()

    contactCard.targetContactId = "contact-new-target"
    contactCard.contactName = "New Target"
    const persisted = {
      recent:localStorage.getItem("moirain_recent"),
      work:JSON.stringify(work),
      library:localStorage.getItem("moirain_readerLibrary"),
    }
    window.close()
    await reopenPersistedChat(t, work, persisted, `updated-contact-target-${actionRequired}`)

    const updatedCard = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
    assert.equal(updatedCard.querySelector(".chat-action-state.is-complete"), null)
    updatedCard.click()
    const updatedAdd = await waitFor(() => document.querySelector("[data-contact-card-action]"))
    assert.equal(updatedAdd.disabled, false)
    const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
    assert.equal(saved.progress.contactFriendships["contact-new-target"], undefined)
  })
}

test("choice selections stay isolated when two chats reuse an owner message id", async t => {
  const work = choiceWork()
  work.id = "reader-duplicate-choice-owner-chat-scope"
  const template = work.phoneData.chats[0]
  work.phoneData.chats = ["chat-a", "chat-b"].map((chatId, index) => {
    const chat = JSON.parse(JSON.stringify(template))
    chat.id = chatId
    chat.rounds[0].id = `round-${index}`
    const owner = chat.rounds[0].messages[0]
    owner.choices = [{
      id:`choice-${index}`,
      text:`Reply ${index}`,
      replyText:"",
      silent:true,
      replyPace:"instant",
      followUpMessages:[{
        id:`follow-up-${index}`,
        type:"text",
        senderId:"contact-1",
        text:`CHAT_${index}_FOLLOW_UP`,
        revealMode:"instant",
        delayBeforeMs:0,
      }],
    }]
    chat.rounds[0].messages = [owner]
    return chat
  })

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("CHAT_0_FOLLOW_UP"))

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("CHAT_1_FOLLOW_UP"))

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.deepEqual(saved.progress.phoneChoiceSelections, {
    '["chat-choice","chat-id:chat-a","owner-message"]':"choice-0",
    '["chat-choice","chat-id:chat-b","owner-message"]':"choice-1",
  })

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "duplicate-owner-full-reload")

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("CHAT_0_FOLLOW_UP"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /CHAT_1_FOLLOW_UP/)

  document.querySelector(".rd-chat-choice-reselect").click()
  const afterReselect = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.deepEqual(afterReselect.progress.phoneChoiceSelections, {
    '["chat-choice","chat-id:chat-b","owner-message"]':"choice-1",
  })

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("CHAT_1_FOLLOW_UP"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /CHAT_0_FOLLOW_UP/)
})

test("duplicate-owner chats resume two independent delayed choice queues after reload", async t => {
  const work = choiceWork()
  work.id = "reader-duplicate-choice-owner-pending-reload"
  const template = work.phoneData.chats[0]
  work.phoneData.chats = ["chat-a", "chat-b"].map((chatId, index) => {
    const chat = JSON.parse(JSON.stringify(template))
    chat.id = chatId
    chat.rounds[0].id = `round-${index}`
    const owner = chat.rounds[0].messages[0]
    owner.choices = [{
      id:`choice-${index}`,
      text:`Reply ${index}`,
      replyText:"",
      silent:true,
      replyPace:"instant",
      followUpMessages:[{
        id:`delayed-follow-up-${index}`,
        type:"text",
        senderId:"contact-1",
        text:`DELAYED_CHAT_${index}`,
        revealMode:"instant",
        delayBeforeMs:1200,
      }],
    }]
    chat.rounds[0].messages = [owner]
    return chat
  })

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const beforeReload = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
    .books.find(book => book.id === work.id)
  assert.equal(Object.keys(beforeReload.progress.phoneChoiceSelections).length, 2)
  assert.equal(Object.keys(beforeReload.progress.phonePendingChoicePlaybacks).length, 2)

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:JSON.stringify(work),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "duplicate-owner-pending-reload")

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("DELAYED_CHAT_1"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /DELAYED_CHAT_0/)

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  await waitFor(() => document.getElementById("chatMsgArea")?.textContent.includes("DELAYED_CHAT_0"))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /DELAYED_CHAT_1/)
})

test("friend request responses stay isolated when two chats reuse a message id", async t => {
  const work = choiceWork()
  work.id = "reader-duplicate-friend-request-chat-scope"
  const duplicateId = "duplicate-request-id"
  work.phoneData.chats = ["chat-a", "chat-b"].map((chatId, index) => ({
    id:chatId,
    type:"single",
    contactIds:["contact-1"],
    messages:[],
    rounds:[{
      id:`round-${index}`,
      messages:[{
        id:duplicateId,
        type:"contact-event",
        eventKind:"friend-request",
        actorContactId:"contact-1",
        originalText:index === 0 ? "Only A" : "Only B",
        actionRequired:true,
        delayBeforeMs:0,
      }],
    }],
  }))

  await openSeededChat(t, work)
  const acceptA = await waitFor(
    () => document.querySelector(`[data-story-event-id="${duplicateId}"] [data-story-response="accepted"]`),
  )
  acceptA.click()
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()

  const requestB = await waitFor(
    () => document.querySelector(`[data-story-event-id="${duplicateId}"]`),
  )
  assert.equal(requestB.querySelector(".rd-story-event-response"), null)
  assert.equal(requestB.querySelectorAll("[data-story-response]").length, 2)
})

test("contact card responses stay isolated when two chats reuse a message id", async t => {
  const work = choiceWork()
  work.id = "reader-duplicate-contact-card-chat-scope"
  work.phoneData.contacts.push(
    { id:"contact-old-target", name:"Old Target", readerAddMode:"hidden" },
    { id:"contact-new-target", name:"New Target", readerAddMode:"hidden" },
  )
  const duplicateId = "duplicate-card-id"
  work.phoneData.chats = [
    { chatId:"chat-a", targetId:"contact-old-target", targetName:"Old Target" },
    { chatId:"chat-b", targetId:"contact-new-target", targetName:"New Target" },
  ].map((definition, index) => ({
    id:definition.chatId,
    type:"single",
    contactIds:["contact-1"],
    messages:[],
    rounds:[{
      id:`round-${index}`,
      messages:[{
        id:duplicateId,
        type:"contact-card",
        senderId:"contact-1",
        targetContactId:definition.targetId,
        contactName:definition.targetName,
        contactAction:"direct",
        contactAcceptedText:"Friend added",
        actionRequired:true,
        delayBeforeMs:0,
      }],
    }],
  }))

  await openSeededChat(t, work)
  const cardA = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
  cardA.click()
  const addA = await waitFor(() => document.querySelector("[data-contact-card-action]"))
  addA.click()
  document.querySelector(".rd-chat-story-pip-close").click()
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="1"]').click()

  const cardB = await waitFor(() => document.querySelector('[data-story-card="contact-card"]'))
  assert.equal(cardB.querySelector(".chat-action-state.is-complete"), null)
  cardB.click()
  const addB = await waitFor(() => document.querySelector("[data-contact-card-action]"))
  assert.equal(addB.disabled, false)
})

test("an authored friend request response cannot leak back after branch rollback and hydration", async t => {
  const work = choiceWork()
  work.id = "reader-authored-friend-request-response-rollback"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices.forEach(choice => {
    choice.silent = true
    choice.replyText = ""
    choice.replyPace = "instant"
    choice.followUpMessages = []
  })
  work.phoneData.chats[0].rounds = [{
    id:"round-1",
    messages:[owner],
  }, {
    id:"round-2",
    messages:[{
      id:"authored-friend-request",
      type:"contact-event",
      eventKind:"friend-request",
      actorContactId:"contact-1",
      originalText:"This response belongs only to branch A.",
      visibleAfterChoiceId:"choice-a",
      delayBeforeMs:0,
    }, {
      id:"after-authored-friend-request",
      type:"text",
      senderId:"contact-1",
      text:"AFTER_FRIEND_REQUEST",
      visibleAfterChoiceId:"choice-a",
      revealMode:"instant",
      delayBeforeMs:0,
    }],
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const accept = await waitFor(
    () => document.querySelector('[data-story-event-id="authored-friend-request"] [data-story-response="accepted"]'),
  )
  accept.click()
  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  window.close()
  await reopenPersistedChat(t, work, persisted, "hydrated-friend-request-rollback")

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const replayedRequest = await waitFor(
    () => document.querySelector('[data-story-event-id="authored-friend-request"]'),
  )
  assert.equal(
    replayedRequest.querySelector(".rd-story-event-response"),
    null,
    "a rolled-back friend request must not reuse its old persisted response",
  )
  assert.equal(
    replayedRequest.querySelectorAll("[data-story-response]").length,
    2,
    "the replayed request must remain answerable instead of becoming a dead end",
  )
})

test("an instant silent choice still streams every follow-up one bubble at a time", async t => {
  const work = choiceWork()
  const choice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  choice.silent = true
  choice.replyText = ""
  choice.replyPace = "instant"
  choice.followUpMessages = [
    { id:"silent-stream-a", type:"text", senderId:"contact-1", text:"甲乙" },
    { id:"silent-stream-b", type:"text", senderId:"contact-1", text:"丙丁" },
  ]
  work.phoneData.chats[0].rounds[0].messages = [work.phoneData.chats[0].rounds[0].messages[0]]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.equal(document.querySelectorAll(".rd-chat-message.is-self").length, 0)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /甲乙/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /丙丁/)

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("甲乙"))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /丙丁/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("丙丁"))
})

test("authored stream mode still types on devices that request reduced motion", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"reduced-motion-stream",
    type:"text",
    senderId:"contact-1",
    text:"ABCD",
    revealMode:"stream",
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  const previousMatchMedia = globalThis.matchMedia
  globalThis.matchMedia = query => ({ matches:String(query).includes("prefers-reduced-motion") })
  t.after(() => {
    if (previousMatchMedia === undefined) delete globalThis.matchMedia
    else globalThis.matchMedia = previousMatchMedia
  })

  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const stream = await waitFor(() => document.querySelector(".rd-flow-stream-text"))
  assert.equal(stream.textContent, "")
  await new Promise(resolve => setTimeout(resolve, 180))
  assert.ok(stream.textContent.length > 0 && stream.textContent.length < 4)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("ABCD"))
})

test("a silent choice applies the default wait before its first NPC response", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"default-first-delay",
    type:"text",
    senderId:"contact-1",
    text:"DEFAULT_WAIT_DONE",
    revealMode:"instant",
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /DEFAULT_WAIT_DONE/)
  await new Promise(resolve => setTimeout(resolve, 500))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /DEFAULT_WAIT_DONE/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("DEFAULT_WAIT_DONE"), 1600)
})

test("a mid-stream chat render resumes from its saved character prefix", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"rerender-stream",
    type:"text",
    senderId:"contact-1",
    text:"ABCDEFGHIJK",
    revealMode:"stream",
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"earlier-reaction",
    type:"system-event",
    eventKind:"reaction",
    senderId:"system",
    actorContactId:"contact-1",
    reaction:"♡",
  }, owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const stream = await waitFor(() => {
    const candidate = document.querySelector(".rd-flow-stream-text")
    return candidate && candidate.textContent.length >= 2 ? candidate : null
  })
  const prefix = stream.textContent
  document.querySelector("[data-story-reaction]").click()
  const resumed = document.querySelector(".rd-flow-stream-text")
  assert.ok(resumed)
  assert.equal(resumed.textContent, prefix)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("ABCDEFGHIJK"))
})

test("leaving and reopening a chat resumes a message that is mid-stream", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"navigation-stream",
    type:"text",
    senderId:"contact-1",
    text:"ABCDEFGHIJK",
    revealMode:"stream",
    delayBeforeMs:0,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const stream = await waitFor(() => {
    const candidate = document.querySelector(".rd-flow-stream-text")
    return candidate && candidate.textContent.length >= 2 ? candidate : null
  })
  const prefix = stream.textContent
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const resumed = document.querySelector(".rd-flow-stream-text")
  assert.ok(resumed)
  assert.equal(resumed.textContent, prefix)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("ABCDEFGHIJK"))
})

test("leaving and reopening a chat preserves elapsed reply delay", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [{
    id:"navigation-delayed-reply",
    type:"text",
    senderId:"contact-1",
    text:"DELAY_COMPLETE",
    revealMode:"instant",
    delayBeforeMs:1800,
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  await new Promise(resolve => setTimeout(resolve, 1250))
  assert.doesNotMatch(document.getElementById("chatMsgArea").textContent, /DELAY_COMPLETE/)
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  await new Promise(resolve => setTimeout(resolve, 1050))
  assert.match(
    document.getElementById("chatMsgArea").textContent,
    /DELAY_COMPLETE/,
    "reopening must resume the remaining authored delay instead of restarting it",
  )
})

test("reselecting an earlier reading-flow reply does not advance the current message", async t => {
  const work = choiceWork()
  work.id = "reader-flow-earlier-reselect"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.text = "先选一条旧回复"
  owner.choices.forEach(function(choice, choiceIndex) {
    choice.replyText = choiceIndex === 0 ? "A" : "B"
    choice.replyPace = "instant"
    choice.followUpMessages = []
  })
  const middleText = "MIDDLE-CURRENT-STEP-MUST-FINISH-BEFORE-AFTER"
  work.phoneData.chats[0].rounds[0].messages = [
    owner,
    { id:"middle-flow-step", type:"text", senderId:"contact-1", text:middleText, revealMode:"stream" },
    { id:"after-flow-step", type:"text", senderId:"contact-1", text:"AFTER-MUST-WAIT", revealMode:"instant" },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:owner.id, chatId:"chat-1", roundId:"round-1", label:"旧回复" },
      { type:"messages", itemId:"middle-flow-step", chatId:"chat-1", roundId:"round-1", label:"当前消息" },
      { type:"messages", itemId:"after-flow-step", chatId:"chat-1", roundId:"round-1", label:"后续消息" },
    ],
  }

  await openSeededReadingFlowChat(t, work)
  await waitFor(() => document.getElementById("chatInput")?.disabled === false)
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const middleStream = await waitFor(() => {
    const stream = document.querySelector('[data-message-id="middle-flow-step"] .rd-flow-stream-text')
    return stream && stream.textContent.length >= 2 && stream.textContent.length < middleText.length
      ? stream
      : null
  }, 5000)
  const prefix = middleStream.textContent
  document.querySelector(".rd-chat-choice-reselect").click()
  const replacement = document.querySelector('.rd-reply-option[data-ci="1"]')
  assert.equal(replacement.disabled, false)
  replacement.click()

  await new Promise(resolve => setTimeout(resolve, 1500))
  assert.equal(
    document.querySelector('[data-message-id="after-flow-step"]'),
    null,
    "replaying an earlier choice must not complete the unrelated current flow step",
  )
  const resumedMiddle = document.querySelector('[data-message-id="middle-flow-step"] .rd-flow-stream-text')
  assert.ok(resumedMiddle, "the interrupted current flow message must remain the active streamed step")
  assert.ok(resumedMiddle.textContent.length >= prefix.length)
})

test("leaving a chat flow step disconnects its bottom-tracking observer", async t => {
  installDom(t)
  const previousResizeObserver = globalThis.ResizeObserver
  const observers = []
  globalThis.ResizeObserver = class {
    constructor() {
      this.disconnected = false
      observers.push(this)
    }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  t.after(() => {
    if (previousResizeObserver === undefined) delete globalThis.ResizeObserver
    else globalThis.ResizeObserver = previousResizeObserver
  })

  const work = choiceWork()
  work.id = "reader-flow-observer-cleanup"
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"flow-exit-message",
    type:"text",
    senderId:"contact-1",
    text:"Leave this chat after this whole message.",
    revealMode:"instant",
    delayBeforeMs:0,
  }]
  work.phoneData.memos = [{ id:"next-memo", contactId:"contact-1", content:"Next flow step" }]
  work.phoneData.apps.push({
    id:"memo-app",
    type:"memo",
    name:"Memo",
    icon:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
    desktopX:1,
    desktopY:0,
    enabled:true,
  })
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"flow-exit-message", chatId:"chat-1", roundId:"round-1" },
      { type:"memo", itemId:"next-memo", contactId:"contact-1" },
    ],
  }

  seedPhoneWork(work)
  await import(`../reader/reader.js?reader-chat-observer-cleanup=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  if (!document.getElementById("chatMsgArea")) {
    document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  }
  assert.ok(document.getElementById("chatMsgArea"))
  assert.ok(observers.length > 0)

  await waitFor(() => document.getElementById("chatMsgArea") === null, 2500)
  assert.equal(
    observers.every(observer => observer.disconnected),
    true,
    "the detached chat must not remain retained by its ResizeObserver",
  )
})

test("a system notice before a choice does not disappear while its branch streams", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [
    { id:"notice-follow-up", type:"text", senderId:"contact-1", text:"甲乙" },
  ]
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"choice-system-notice",
    type:"system",
    senderId:"system",
    text:"群聊系统提示",
  }, owner, {
    id:"notice-later-owner",
    type:"text",
    senderId:"contact-1",
    text:"下一题",
    choices:[{ id:"notice-later-choice", text:"继续", replyText:"继续", followUpMessages:[] }],
  }]

  await openSeededChat(t, work)
  assert.match(document.querySelector("#chatMsgArea").textContent, /群聊系统提示/)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.match(document.querySelector("#chatMsgArea").textContent, /群聊系统提示/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /下一题/)
})

test("a system notice after a choice waits for the streamed branch to finish", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [
    { id:"system-gate-follow-up", type:"text", senderId:"contact-1", text:"先播放这句话" },
  ]
  work.phoneData.chats[0].rounds[0].messages = [owner, {
    id:"system-after-stream",
    type:"system",
    senderId:"system",
    text:"然后显示系统消息",
  }]

  await openSeededChat(t, work)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /然后显示系统消息/)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /先播放这句话/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /然后显示系统消息/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("先播放这句话"))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /然后显示系统消息/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("然后显示系统消息"))
})

test("whole-message text, system notices, and streamed text still play in one authored queue", async t => {
  const work = choiceWork()
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.choices[0].silent = true
  owner.choices[0].replyText = ""
  owner.choices[0].replyPace = "instant"
  owner.choices[0].followUpMessages = [
    { id:"whole-follow-up", type:"text", senderId:"contact-1", text:"整条出现", revealMode:"instant", delayBeforeMs:0 },
    { id:"queued-system", type:"system", senderId:"system", text:"系统随后", delayBeforeMs:0 },
    { id:"stream-follow-up", type:"text", senderId:"contact-1", text:"逐字随后", revealMode:"stream", delayBeforeMs:0 },
  ]
  work.phoneData.chats[0].rounds[0].messages = [owner]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const whole = await waitFor(() => document.querySelector('[data-message-id][data-message-id*="whole-follow-up"]') ||
    [...document.querySelectorAll('[data-message-id]')].find(element => element.textContent.includes("整条出现")), 5000)
  assert.match(whole.textContent, /整条出现/)
  assert.equal(whole.querySelector(".rd-flow-stream-text"), null)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /系统随后/)

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("系统随后"), 5000)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /逐字随后/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("逐字随后"), 5000)
  const text = document.querySelector("#chatMsgArea").textContent
  assert.ok(text.indexOf("整条出现") < text.indexOf("系统随后"))
  assert.ok(text.indexOf("系统随后") < text.indexOf("逐字随后"))
})

test("an instant image choice finishes its streamed branch before revealing the next option group", async t => {
  const work = choiceWork()
  const firstOwner = work.phoneData.chats[0].rounds[0].messages[0]
  firstOwner.choices = [{
    id:"image-first-choice",
    text:"发送图片",
    replyText:"发送图片",
    imageUrl:"data:image/png;base64,Y2hvaWNlLWltYWdl",
    replyPace:"instant",
    followUpMessages:[{ id:"image-follow-up", type:"text", senderId:"contact-1", text:"收到" }],
  }]
  work.phoneData.chats[0].rounds[0].messages = [firstOwner, {
    id:"later-choice-owner",
    type:"text",
    senderId:"contact-1",
    text:"现在继续吗？",
    choices:[{
      id:"later-choice",
      text:"继续",
      replyText:"继续",
      replyPace:"instant",
      followUpMessages:[],
    }],
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.ok(document.querySelector(".rd-chat-message.is-self img"))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /收到/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /现在继续吗/)
  assert.equal(document.querySelector(".rd-reply-option"), null)

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("收到"))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /现在继续吗/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("现在继续吗"))
  assert.match(document.querySelector(".rd-reply-option")?.textContent || "", /继续/)
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

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("Then just listen to me."), 5000)
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

test("a silent default-paced choice keeps reselection when typing is the first generated item", async t => {
  const work = choiceWork()
  const choice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  choice.silent = true
  choice.replyText = ""
  delete choice.replyPace
  choice.followUpMessages = [{
    id: "silent-default-paced-follow-up",
    type: "text",
    senderId: "contact-1",
    text: "The reply after the typing indicator.",
    revealMode: "instant",
    delayBeforeMs: 0,
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector(".rd-reply-option").click()

  await waitFor(
    () => document.querySelector("#chatMsgArea")?.textContent.includes("The reply after the typing indicator."),
    5000,
  )
  const reselect = document.querySelector(".rd-chat-choice-reselect")
  assert.ok(reselect, "a transient typing row cannot consume the only reselection anchor")
  reselect.click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /The reply after the typing indicator\./)
  assert.ok(document.querySelector(".rd-reply-option"))
})

test("reselecting a generated pending call auto-opens the call scene again", async t => {
  const work = choiceWork()
  const choice = work.phoneData.chats[0].rounds[0].messages[0].choices[0]
  choice.silent = true
  choice.replyText = ""
  choice.replyPace = "instant"
  choice.followUpMessages = [{
    id:"generated-call",
    type:"call",
    senderId:"contact-1",
    callMode:"voice",
    callLines:["Are you there?"],
    delayBeforeMs:0,
  }]

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.querySelector(".rd-call-scene"))

  document.querySelector(".rd-call-hangup").click()
  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  await waitFor(
    () => document.querySelector(".rd-call-scene"),
    1200,
  )
})

test("reselecting an authored continuation pending call auto-opens the call scene again", async t => {
  const work = choiceWork()
  const chat = work.phoneData.chats[0]
  const owner = chat.rounds[0].messages[0]
  owner.choices.forEach(function(choice) {
    choice.silent = true
    choice.replyText = ""
    choice.replyPace = "instant"
    choice.endRound = true
    choice.followUpMessages = []
  })
  chat.rounds[0].messages = [owner]
  chat.rounds.push({
    id:"round-2",
    label:"Second round",
    messages:[{
      id:"authored-continuation-call",
      type:"call",
      senderId:"contact-1",
      callMode:"voice",
      callLines:["This authored call should ring again."],
      visibleAfterChoiceId:"choice-a",
      delayBeforeMs:0,
    }],
  })

  await openSeededChat(t, work)
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.querySelector(".rd-call-scene"))
  document.querySelector(".rd-call-hangup").click()

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()
  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  await waitFor(
    () => document.querySelector(".rd-call-scene"),
    1200,
  )
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

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("那我在老地方等你"), 5000)
  const text = document.querySelector("#chatMsgArea").textContent
  assert.match(text, /那我在老地方等你/)
  assert.doesNotMatch(text, /这是作者原本排在后面的消息/)
  assert.equal(document.querySelectorAll(".rd-chat-message.is-self").length, 0)
  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  assert.equal(library.books[0].progress.phoneChoiceSelections["owner-message"], "choice-a")
})

test("ending a group-chat round plays its follow-ups before an eligible next round", async t => {
  const work = choiceWork()
  const chat = work.phoneData.chats[0]
  chat.type = "group"
  chat.groupName = "跨轮测试群"
  chat.contactIds = ["contact-1"]
  chat.rounds[0].messages[0].choices[0].endRound = true
  chat.rounds.push({
    id: "round-2",
    label: "第二轮",
    messages: [
      {
        id: "round-2-system",
        type: "system",
        senderId: "system",
        text: "第二轮系统提示。",
        visibleAfterChoiceId: "choice-a",
      },
      {
        id: "round-2-matching",
        type: "text",
        senderId: "contact-1",
        text: "第二轮已经按选择继续。",
        visibleAfterChoiceId: "choice-a",
      },
      {
        id: "round-2-other-branch",
        type: "text",
        senderId: "contact-1",
        text: "另一条分支不该出现。",
        visibleAfterChoiceId: "choice-b",
      },
    ],
  })

  await openSeededChat(t, work)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /第二轮已经按选择继续/)

  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("那我在老地方等你"), 10000)
  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /第二轮系统提示|第二轮已经按选择继续/,
    "the next round must wait until the selected branch finishes",
  )
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("第二轮系统提示"), 5000)
  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /第二轮已经按选择继续/,
    "next-round system and text messages must remain separate playback steps",
  )
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("第二轮已经按选择继续"), 10000)
  const renderedArea = document.querySelector("#chatMsgArea")
  const text = renderedArea.textContent
  assert.match(text, /那我在老地方等你/)
  assert.match(text, /第二轮系统提示/)
  assert.match(text, /第二轮已经按选择继续/)
  assert.doesNotMatch(text, /这是作者原本排在后面的消息/)
  assert.doesNotMatch(text, /另一条分支不该出现/)
  const visibleMessages = [...renderedArea.querySelectorAll(".rd-chat-message")]
  const followUpIndex = visibleMessages.findIndex(message => /那我在老地方等你/.test(message.textContent))
  const nextRoundIndex = visibleMessages.findIndex(message => /第二轮已经按选择继续/.test(message.textContent))
  assert.ok(followUpIndex >= 0 && nextRoundIndex > followUpIndex, "next-round content must follow generated replies")
  assert.ok(
    text.indexOf("那我在老地方等你") < text.indexOf("第二轮系统提示")
      && text.indexOf("第二轮系统提示") < text.indexOf("第二轮已经按选择继续"),
    "generated replies, system messages, and next-round bubbles must preserve authored order",
  )

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.match(document.querySelector("#chatMsgArea").textContent, /第二轮已经按选择继续/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /这是作者原本排在后面的消息/)
})

test("ending a round without generated replies still evaluates the next round", async t => {
  const work = choiceWork()
  const chat = work.phoneData.chats[0]
  const choice = chat.rounds[0].messages[0].choices[0]
  choice.replyText = ""
  choice.silent = true
  choice.followUpMessages = []
  choice.endRound = true
  chat.rounds.push({
    id: "round-2",
    label: "第二轮",
    messages: [{
      id: "round-2-after-silence",
      type: "text",
      senderId: "contact-1",
      text: "沉默之后也能进入下一轮。",
      visibleAfterChoiceId: "choice-a",
    }],
  })

  await openSeededChat(t, work)
  document.getElementById("chatInput").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /沉默之后也能进入下一轮/,
    "a next-round message must honor its playback delay even when the choice generated no bubble",
  )
  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /沉默之后也能进入下一轮/,
    "reopening during the initial delay must resume waiting instead of skipping it",
  )
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("沉默之后也能进入下一轮"), 5000)
  const text = document.querySelector("#chatMsgArea").textContent
  assert.match(text, /沉默之后也能进入下一轮/)
  assert.doesNotMatch(text, /这是作者原本排在后面的消息/)
  assert.equal(document.querySelectorAll(".rd-chat-message.is-self").length, 0)
})

test("reselecting an end-round branch resets authored continuation action state", async t => {
  const work = choiceWork()
  work.id = "reader-end-round-continuation-reselect"
  const chat = work.phoneData.chats[0]
  const owner = chat.rounds[0].messages[0]
  owner.choices.forEach(function(choice) {
    choice.replyText = ""
    choice.silent = true
    choice.endRound = true
    choice.followUpMessages = []
  })
  chat.rounds[0].messages = [owner]
  chat.rounds.push({
    id:"round-2",
    label:"第二轮",
    messages:[{
      id:"branch-location",
      type:"location",
      senderId:"contact-1",
      locationName:"A 分支地点",
      locationAddress:"只属于 A 分支",
      actionRequired:true,
      visibleAfterChoiceId:"choice-a",
    }],
  })

  await openSeededChat(t, work)
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const firstLocation = await waitFor(() => document.querySelector('[data-story-message-id="branch-location"]'))
  firstLocation.click()
  assert.ok(firstLocation.querySelector(".chat-action-state.is-complete"))
  document.querySelector(".rd-chat-story-pip-close").click()

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()
  assert.equal(document.querySelector('[data-message-id="branch-location"]'), null)

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  const replayedLocation = await waitFor(() => document.querySelector('[data-story-message-id="branch-location"]'))
  assert.equal(
    replayedLocation.querySelector(".chat-action-state.is-complete"),
    null,
    "returning to a rolled-back authored continuation must not revive its completed action",
  )
  assert.ok(replayedLocation.querySelector(".chat-action-state:not(.is-complete)"))
})

test("a hydrated end-round branch resets authored continuation action state on reselection", async t => {
  const work = choiceWork()
  work.id = "reader-hydrated-end-round-continuation-reselect"
  const chat = work.phoneData.chats[0]
  const owner = chat.rounds[0].messages[0]
  owner.choices.forEach(function(choice) {
    choice.replyText = ""
    choice.silent = true
    choice.endRound = true
    choice.followUpMessages = []
  })
  chat.rounds[0].messages = [owner]
  chat.rounds.push({
    id:"round-2",
    label:"Second round",
    messages:[{
      id:"hydrated-branch-location",
      type:"location",
      senderId:"contact-1",
      locationName:"A branch location",
      locationAddress:"Only visible on A",
      actionRequired:true,
      visibleAfterChoiceId:"choice-a",
      delayBeforeMs:0,
    }],
  })

  await openSeededChat(t, work)
  document.querySelector('.rd-reply-option[data-ci="0"]').click()
  await waitFor(() => document.querySelector('[data-story-message-id="hydrated-branch-location"]'))

  const persisted = {
    recent:localStorage.getItem("moirain_recent"),
    work:localStorage.getItem(`moirain_work_${work.id}`),
    library:localStorage.getItem("moirain_readerLibrary"),
  }
  installDom(t)
  localStorage.setItem("moirain_recent", persisted.recent)
  localStorage.setItem(`moirain_work_${work.id}`, persisted.work)
  localStorage.setItem("moirain_readerLibrary", persisted.library)
  await import(`../reader/reader.js?reader-chat-choice-hydrated=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]')?.click()
  document.querySelector(".rd-recent-item")?.click()
  document.getElementById("rdStartBtn")?.click()
  document.querySelector('[data-app-type="messages"]')?.click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]')?.click()

  const hydratedLocation = await waitFor(
    () => document.querySelector('[data-story-message-id="hydrated-branch-location"]'),
  )
  hydratedLocation.click()
  assert.ok(hydratedLocation.querySelector(".chat-action-state.is-complete"))
  document.querySelector(".rd-chat-story-pip-close").click()

  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="1"]').click()
  document.querySelector(".rd-chat-choice-reselect").click()
  document.querySelector('.rd-reply-option[data-ci="0"]').click()

  const replayedLocation = await waitFor(
    () => document.querySelector('[data-story-message-id="hydrated-branch-location"]'),
  )
  assert.equal(
    replayedLocation.querySelector(".chat-action-state.is-complete"),
    null,
    "hydrated branch metadata must retain authored continuation ids for runtime rollback",
  )
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
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("这是作者原本排在后面的消息"), 10000)
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
  assert.match(readerAppearanceWorkbenchSource, /rd-app-preview-chat chat-author-shell chat-reader-shell/)

  const composer = document.getElementById("chatInput")
  assert.ok(composer)
  assert.equal(composer.readOnly, true, "the reader composer must not accept free text")
  composer.click()

  let options = [...document.querySelectorAll(".rd-reply-option")]
  assert.equal(options.length, 2)
  assert.equal(options[0].textContent.trim(), "好，我会准时到。")
  options[0].click()

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("这是作者原本排在后面的消息"), 10000)
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

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("这是作者原本排在后面的消息"), 10000)
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
    replyPace:"instant",
    text:"Reply to the first message",
    replyText:"First reader reply",
    followUpMessages:[{
      id:"first-follow-up",
      type:"text",
      senderId:"contact-1",
      text:"First character follow-up",
      revealMode:"instant",
      delayBeforeMs:0,
    }],
  }]
  messages.splice(1, 0, {
    id:"second-system-message",
    type:"system",
    senderId:"system",
    text:"A second group system message.",
    revealMode:"instant",
    delayBeforeMs:300,
  }, {
    id:"second-owner-message",
    type:"text",
    senderId:"contact-1",
    text:"This is the second question.",
    revealMode:"instant",
    delayBeforeMs:300,
    choices:[{
      id:"second-choice",
      replyPace:"instant",
      text:"Reply to the second message",
      replyText:"Second reader reply",
      followUpMessages:[{
        id:"second-follow-up",
        type:"text",
        senderId:"contact-1",
        text:"Second character follow-up",
        revealMode:"instant",
        delayBeforeMs:0,
      }],
    }],
  })

  await openSeededChat(t, work)

  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /This is the second question/,
    "later choice owners must stay hidden until the current gate is answered",
  )
  assert.doesNotMatch(
    document.querySelector("#chatMsgArea").textContent,
    /A second group system message/,
    "a system message after the current choice must wait behind the reply gate",
  )
  let options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the first message"])
  options[0].click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /A second group system message/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("First character follow-up"), 20000)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /A second group system message/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("A second group system message"), 20000)
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("This is the second question"), 20000)
  assert.match(document.querySelector("#chatMsgArea").textContent, /First reader reply/)
  assert.match(document.querySelector("#chatMsgArea").textContent, /First character follow-up/)
  assert.match(document.querySelector("#chatMsgArea").textContent, /This is the second question/)
  options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the second message"])
  options[0].click()

  await waitFor(() => document.querySelector("#chatMsgArea")?.textContent.includes("Second character follow-up"), 20000)
  const renderedText = document.querySelector("#chatMsgArea").textContent
  assert.match(renderedText, /First reader reply/)
  assert.match(renderedText, /Second reader reply/)
  assert.match(renderedText, /Second character follow-up/)
  assert.equal(document.querySelectorAll(".rd-chat-choice-reselect").length, 2)

  document.querySelectorAll(".rd-chat-choice-reselect")[0].click()

  const rerolledText = document.querySelector("#chatMsgArea").textContent
  assert.doesNotMatch(rerolledText, /First reader reply/)
  assert.doesNotMatch(rerolledText, /First character follow-up/)
  assert.doesNotMatch(rerolledText, /A second group system message/)
  assert.doesNotMatch(rerolledText, /This is the second question/)
  assert.doesNotMatch(rerolledText, /Second reader reply/)
  assert.doesNotMatch(rerolledText, /Second character follow-up/)
  assert.equal(document.querySelectorAll(".rd-chat-choice-reselect").length, 0)
  options = [...document.querySelectorAll(".rd-reply-option")]
  assert.deepEqual(options.map(option => option.textContent.trim()), ["Reply to the first message"])
})
