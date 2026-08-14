import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

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

function storyWork() {
  return {
    schemaVersion:1,
    id:"reader-phone-story-events",
    type:"phone",
    title:"Story messages",
    placeholders:[],
    scenes:[],
    phoneData:{
      contacts:[
        { id:"contact-1", name:"林晚", avatarUrl:"", note:"旧签名" },
        { id:"contact-2", name:"周周", avatarUrl:"" },
      ],
      chats:[{
        id:"chat-1",
        type:"group",
        groupName:"夜巡组",
        groupAvatarUrl:"",
        contactIds:["contact-1", "contact-2"],
        groupOwnerId:"contact-1",
        groupAdminIds:[],
        groupTitles:{},
        messages:[],
        rounds:[{
          id:"round-1",
          messages:[
            { id:"system-note", type:"system", senderId:"system", text:"你撤回了一条消息" },
            { id:"failed-live", type:"text", senderId:"contact-1", text:"这条消息发送失败。", failed:true },
            {
              id:"recalled-live",
              type:"system-event",
              eventKind:"recall",
              actorContactId:"contact-1",
              originalText:"刚才那句话不算数。",
              allowReveal:true,
              recalledMessage:{ id:"recalled-live", type:"text", senderId:"contact-1", text:"刚才那句话不算数。" },
            },
            { id:"rename-contact", type:"contact-event", eventKind:"contact-update", targetContactId:"contact-1", newName:"林雾", newBio:"正在离线" },
            { id:"rename-group", type:"system-event", eventKind:"group-rename", newName:"凌晨三点" },
            { id:"recall-1", type:"system-event", eventKind:"recall", actorContactId:"contact-1", originalText:"别回头。", allowReveal:true },
            { id:"failed-1", type:"system-event", eventKind:"send-failed", originalText:"我马上到。" },
            { id:"reaction-1", type:"system-event", eventKind:"reaction", actorContactId:"contact-2", reaction:"♡" },
            { id:"friend-1", type:"contact-event", eventKind:"friend-request", actorContactId:"contact-2", originalText:"我们在旧城区见过。" },
            { id:"burn-1", type:"system-event", eventKind:"burn", actorContactId:"contact-1", originalText:"钥匙在花盆下面。", burnSeconds:1 },
            { id:"location-1", type:"location", senderId:"contact-1", locationName:"白石街", locationAddress:"旧城区 17 号" },
            { id:"contact-card-1", type:"contact-card", senderId:"contact-1", targetContactId:"contact-2", contactNote:"接应人" },
            { id:"contact-card-request", type:"contact-card", senderId:"contact-1", targetContactId:"contact-2", contactNote:"添加后可以私聊", contactAction:"request", contactRequestOutcome:"accepted", contactAcceptedText:"周周通过了你的好友申请。" },
            { id:"file-1", type:"file", senderId:"contact-1", fileName:"夜巡表.pdf", fileType:"PDF", fileSize:"1.2 MB", fileContent:"23:00 北门交接" },
            { id:"forward-1", type:"forward", senderId:"contact-1", forwardTitle:"旧群记录", forwardItems:[{ sender:"林晚", text:"不要开灯。" }, { sender:"周周", text:"收到。" }] },
            { id:"music-1", type:"music", senderId:"contact-1", musicTitle:"失眠航线", musicArtist:"匿名", musicUrl:"javascript:alert(1)" },
            { id:"schedule-1", type:"schedule", senderId:"contact-1", scheduleTitle:"车站接应", scheduleTime:"今晚 23:40", scheduleLocation:"旧城区车站", acceptLabel:"参加", declineLabel:"不去" },
            { id:"missed-call", type:"call", senderId:"contact-1", callMode:"voice", callStatus:"missed", callLines:[] },
          ],
        }],
      }],
      moments:[], forumPosts:[], forumNpcs:[], memos:[], photos:[], albums:[], browserHistory:[], shoppingItems:[],
      skin:{ readerId:"Reader", showDynamicIsland:false, showHomeIndicator:false },
      apps:[
        { id:"messages-app", type:"messages", name:"消息", icon:"M", desktopX:0, desktopY:0, enabled:true },
        { id:"contacts-app", type:"contacts", name:"联系人", icon:"C", desktopX:1, desktopY:0, enabled:true },
      ],
    },
  }
}

async function openStoryChat(t, key) {
  installDom(t)
  const work = storyWork()
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  return work
}

test("reader story events expose recall, retry, reaction, friend request, and burn interactions", async t => {
  await openStoryChat(t, "reader-story-interactions")

  const systemNote = document.querySelector('.rd-chat-system[data-message-id="system-note"]')
  assert.ok(systemNote)
  assert.match(systemNote.textContent, /你撤回了一条消息/)
  assert.equal(systemNote.querySelector(".chat-bubble"), null)

  const recall = document.querySelector('[data-story-event-id="recall-1"]')
  assert.match(recall.textContent, /林雾撤回/)
  const recallDetail = recall.querySelector(".rd-story-event-detail")
  assert.equal(recallDetail.hidden, true)
  recall.querySelector('[data-story-reveal="recall"]').click()
  assert.equal(document.querySelector('[data-story-event-id="recall-1"] .rd-story-event-detail').hidden, false)
  assert.match(document.querySelector('[data-story-event-id="recall-1"]').textContent, /别回头/)

  document.querySelector('[data-story-event-id="failed-1"] [data-story-retry]').click()
  assert.match(document.querySelector('[data-story-event-id="failed-1"]').textContent, /重新发送/)

  document.querySelector('[data-story-event-id="reaction-1"] [data-story-reaction]').click()
  assert.equal(document.querySelector('[data-story-event-id="reaction-1"] [data-story-reaction]').getAttribute("aria-pressed"), "true")

  document.querySelector('[data-story-event-id="friend-1"] [data-story-response="accepted"]').click()
  assert.match(document.querySelector('[data-story-event-id="friend-1"]').textContent, /已同意/)
  assert.match(document.querySelector('[data-story-event-id="friend-1"]').textContent, /我们在旧城区见过/)

  const burn = document.querySelector('[data-story-event-id="burn-1"]')
  burn.querySelector('[data-story-reveal="burn"]').click()
  assert.match(burn.textContent, /钥匙在花盆下面/)
  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.match(burn.textContent, /内容已焚毁/)
  assert.doesNotMatch(burn.textContent, /钥匙在花盆下面/)
})

test("friend request notifications wait for a response and persist it with phone progress", async t => {
  installDom(t)
  const work = storyWork()
  work.id = "reader-friend-request-flow"
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[{ type:"messages", itemId:"friend-1", chatId:"chat-1", roundId:"round-1", contactId:"contact-2", label:"周周 · 好友申请" }],
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?friend-request-flow=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  const notification = document.querySelector('.phone-flow-notification[data-flow-notification-app="messages"]')
  assert.ok(notification)
  assert.match(notification.textContent, /好友申请/)
  notification.click()
  assert.ok(document.querySelector('[data-story-event-id="friend-1"] [data-story-response="accepted"]'))

  await new Promise(resolve => setTimeout(resolve, 900))
  let saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(saved.progress.flowIndex, 0)

  document.querySelector('[data-story-event-id="friend-1"] [data-story-response="accepted"]').click()
  await new Promise(resolve => setTimeout(resolve, 900))
  saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(saved.progress.flowIndex, 1)
  assert.equal(saved.progress.friendRequestResponses["friend-1"], "accepted")
})

test("failed and recalled messages settle into different reader history states", async t => {
  await openStoryChat(t, "reader-message-transitions")

  const failedPreview = document.querySelector('[data-transient-kind="failed"][data-message-id="failed-live"]')
  const recallPreview = document.querySelector('[data-transient-kind="recall"][data-message-id="recalled-live"]')
  assert.ok(failedPreview)
  assert.match(failedPreview.textContent, /这条消息发送失败/)
  assert.ok(recallPreview)
  assert.match(recallPreview.textContent, /刚才那句话不算数/)
  assert.equal(document.querySelector('[data-story-event-id="recalled-live"]'), null)

  await new Promise(resolve => setTimeout(resolve, 900))

  assert.equal(document.querySelector('[data-message-id="failed-live"]'), null)
  const recallEvent = document.querySelector('[data-story-event-id="recalled-live"]')
  assert.ok(recallEvent)
  assert.match(recallEvent.textContent, /撤回/)
  recallEvent.querySelector('[data-story-reveal="recall"]').click()
  assert.match(document.querySelector('[data-story-event-id="recalled-live"]').textContent, /刚才那句话不算数/)

  document.getElementById("chatBack").click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.equal(document.querySelector('[data-transient-kind="failed"]'), null)
  assert.equal(document.querySelector('[data-transient-kind="recall"]'), null)
  assert.ok(document.querySelector('[data-story-event-id="recalled-live"]'))
})

test("visible contact and group changes update later reader surfaces without mutating the imported work", async t => {
  const authored = await openStoryChat(t, "reader-story-state")

  assert.equal(document.querySelector(".chat-round-title strong").textContent, "凌晨三点")
  assert.match(document.querySelector('[data-story-event-id="recall-1"]').textContent, /林雾/)
  document.getElementById("chatBack").click()
  assert.match(document.querySelector(".rd-chat-card").textContent, /凌晨三点/)
  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="contacts"]').click()
  assert.match(document.querySelector(".rd-contact-book").textContent, /林雾/)

  const stored = JSON.parse(localStorage.getItem(`moirain_work_${authored.id}`))
  assert.equal(stored.phoneData.contacts[0].name, "林晚")
  assert.equal(stored.phoneData.chats[0].groupName, "夜巡组")
})

test("reader rich cards open safe in-phone details and keep schedule response state", async t => {
  await openStoryChat(t, "reader-story-cards")

  document.querySelector('[data-story-message-id="location-1"]').click()
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /旧城区 17 号/)
  document.querySelector(".rd-chat-story-pip-close").click()

  document.querySelector('[data-story-message-id="file-1"]').click()
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /23:00 北门交接/)
  document.querySelector(".rd-chat-story-pip-close").click()

  document.querySelector('[data-story-message-id="forward-1"]').click()
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /不要开灯/)
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /收到/)
  document.querySelector(".rd-chat-story-pip-close").click()

  const music = document.querySelector(".chat-music-card")
  assert.equal(music.tagName, "DIV")
  assert.equal(music.hasAttribute("href"), false)

  document.querySelector('[data-story-message-id="schedule-1"] [data-schedule-response="accepted"]').click()
  assert.match(document.querySelector('[data-story-message-id="schedule-1"]').textContent, /已参加/)
})

test("reader contact-card friendship actions persist and cannot be submitted twice", async t => {
  const work = await openStoryChat(t, "reader-contact-card-request")

  document.querySelector('[data-story-message-id="contact-card-request"]').click()
  const action = document.querySelector('[data-contact-card-action="contact-card-request"]')
  assert.ok(action)
  assert.match(action.textContent, /发送好友申请/)
  action.click()

  const settledAction = document.querySelector('[data-contact-card-action="contact-card-request"]')
  assert.equal(settledAction.disabled, true)
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /已添加/)
  assert.match(document.querySelector(".rd-chat-story-pip").textContent, /周周通过了你的好友申请/)
  settledAction.click()

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(saved.progress.contactCardResponses["contact-card-request"], "accepted")
  assert.equal(saved.progress.contactFriendships["contact-2"], "accepted")
})

test("reader Contacts can search authored contacts and direct-add or send a friend request", async t => {
  installDom(t)
  const work = storyWork()
  work.id = "reader-contact-search-add"
  work.phoneData.contacts = [
    { id:"contact-existing", name:"林晚", avatarUrl:"", readerAddMode:"existing" },
    { id:"contact-direct", name:"周周", alias:"小周", avatarUrl:"", note:"旧城区接应人", readerAddMode:"direct", readerAddAcceptedText:"周周已加入联系人。" },
    { id:"contact-request", name:"白榆", avatarUrl:"", note:"需要验证", readerAddMode:"request", readerAddOutcome:"pending", readerAddPendingText:"白榆还没有回复。" },
  ]
  work.phoneData.chats = []
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?contact-search-add=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="contacts"]').click()

  assert.match(document.querySelector(".rd-contact-book").textContent, /林晚/)
  assert.doesNotMatch(document.querySelector(".rd-contact-book").textContent, /周周|白榆/)
  const addButton = document.querySelector("[data-reader-contact-add]")
  assert.ok(addButton)
  assert.equal(addButton.getAttribute("aria-label"), "搜索并添加联系人")

  addButton.click()
  const search = document.querySelector("[data-reader-contact-search]")
  assert.ok(search)
  search.value = "小周"
  search.dispatchEvent(new window.Event("input", { bubbles:true }))
  assert.equal(document.querySelectorAll(".rd-contact-search-result:not([hidden])").length, 1)
  assert.match(document.querySelector(".rd-contact-search-result:not([hidden])").textContent, /周周/)
  document.querySelector('[data-reader-contact-submit="contact-direct"]').click()

  assert.match(document.querySelector(".rd-contact-book").textContent, /周周/)
  document.querySelector("[data-reader-contact-add]").click()
  const requestSearch = document.querySelector("[data-reader-contact-search]")
  requestSearch.value = "白榆"
  requestSearch.dispatchEvent(new window.Event("input", { bubbles:true }))
  const requestButton = document.querySelector('[data-reader-contact-submit="contact-request"]')
  assert.match(requestButton.textContent, /发送好友申请/)
  requestButton.click()
  assert.match(document.querySelector('[data-contact-search-result-id="contact-request"]').textContent, /申请中/)
  assert.match(document.querySelector('[data-contact-search-result-id="contact-request"]').textContent, /白榆还没有回复/)

  const saved = JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.find(book => book.id === work.id)
  assert.equal(saved.progress.contactFriendships["contact-direct"], "accepted")
  assert.equal(saved.progress.contactFriendships["contact-request"], "pending")
})

test("authored unsuccessful calls render as compact outcomes and never auto-open a call scene", async t => {
  await openStoryChat(t, "reader-story-calls")

  const outcome = document.querySelector('[data-message-id="missed-call"]')
  assert.ok(outcome.classList.contains("rd-call-outcome"))
  assert.match(outcome.textContent, /无人接听/)
  assert.equal(document.querySelector(".rd-call-scene"), null)
  assert.equal(outcome.tagName, "DIV")
})

test("the next authored bubble uses its own exact delay instead of the fixed chat gap", async t => {
  installDom(t)
  const work = storyWork()
  work.id = "reader-exact-message-delay"
  work.phoneData.chats[0].rounds[0].messages = [
    { id:"delay-first", type:"system", senderId:"system", text:"第一条" },
    { id:"delay-second", type:"system", senderId:"system", text:"第二条", delayBeforeMs:120 },
  ]
  work.phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"delay-first", chatId:"chat-1", roundId:"round-1", contactId:"contact-1", label:"第一条" },
      { type:"messages", itemId:"delay-second", chatId:"chat-1", roundId:"round-1", contactId:"contact-1", label:"第二条" },
    ],
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?exact-message-delay=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('.phone-flow-notification[data-flow-notification-app="messages"]').click()

  assert.ok(document.querySelector('[data-message-id="delay-first"]'))
  assert.equal(document.querySelector('[data-message-id="delay-second"]'), null)
  await new Promise(resolve => setTimeout(resolve, 70))
  assert.equal(document.querySelector('[data-message-id="delay-second"]'), null)
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(document.querySelector('[data-message-id="delay-second"]'))
})

test("unsequenced authored bubbles after a choice honor their individual delays", async t => {
  installDom(t)
  const work = storyWork()
  work.id = "reader-unsequenced-authored-delay"
  work.phoneData.chats[0].rounds[0].messages = [
    {
      id:"authored-delay-choice-owner",
      type:"text",
      senderId:"contact-1",
      text:"Ready?",
      choices:[{
        id:"authored-delay-choice",
        text:"Ready",
        replyText:"",
        silent:true,
      }],
    },
    { id:"authored-delay-text", type:"text", senderId:"contact-1", text:"First", delayBeforeMs:120 },
    { id:"authored-delay-image-one", type:"image", senderId:"contact-1", image:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", delayBeforeMs:120 },
    { id:"authored-delay-image-two", type:"image", senderId:"contact-2", image:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", delayBeforeMs:120 },
  ]
  delete work.phoneData.readingFlow
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?unsequenced-authored-delay=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  document.querySelector("#chatSendBtn").click()
  document.querySelector(".rd-reply-option").click()

  assert.equal(document.querySelector('[data-message-id="authored-delay-text"]'), null)
  assert.equal(document.querySelector('[data-message-id="authored-delay-image-one"]'), null)
  assert.equal(document.querySelector('[data-message-id="authored-delay-image-two"]'), null)
  await new Promise(resolve => setTimeout(resolve, 70))
  assert.equal(document.querySelector('[data-message-id="authored-delay-text"]'), null)
  await new Promise(resolve => setTimeout(resolve, 90))
  assert.ok(document.querySelector('[data-message-id="authored-delay-text"]'))
  assert.equal(document.querySelector('[data-message-id="authored-delay-image-one"]'), null)
  await new Promise(resolve => setTimeout(resolve, 140))
  assert.ok(document.querySelector('[data-message-id="authored-delay-image-one"]'))
  assert.equal(document.querySelector('[data-message-id="authored-delay-image-two"]'), null)
  await new Promise(resolve => setTimeout(resolve, 140))
  assert.ok(document.querySelector('[data-message-id="authored-delay-image-two"]'))
})

test("an unsequenced reply branch also honors the first follow-up bubble delay", async t => {
  installDom(t)
  const work = storyWork()
  work.id = "reader-reply-branch-delay"
  work.phoneData.chats[0].rounds[0].messages = [{
    id:"delay-choice-owner",
    type:"text",
    senderId:"contact-1",
    text:"要现在说吗？",
    choices:[{
      id:"delay-choice",
      text:"点头",
      replyText:"",
      replyPace:"instant",
      followUpMessages:[{ id:"authored-follow-up", type:"text", senderId:"contact-1", text:"那我说了。", delayBeforeMs:120 }],
    }],
  }]
  delete work.phoneData.readingFlow
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?reply-branch-delay=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  document.querySelector("#chatSendBtn").click()
  document.querySelector(".rd-reply-option").click()

  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /那我说了/)
  await new Promise(resolve => setTimeout(resolve, 70))
  assert.doesNotMatch(document.querySelector("#chatMsgArea").textContent, /那我说了/)
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.match(document.querySelector("#chatMsgArea").textContent, /那我说了/)
})
