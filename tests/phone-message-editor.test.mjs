import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom() {
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
  return dom
}

function makePhoneData(
  contact = { id: "contact-1", name: "林澈", avatarUrl: "" },
  chatId = "chat-1",
) {
  return {
    contacts: [contact],
    chats: [{
      id: chatId,
      type: "single",
      contactIds: [contact.id],
      groupName: "",
      messages: [],
      rounds: [{ id: "round-1", label: "第1轮", messages: [] }],
    }],
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
  }
}

async function openMessageList(id, phoneData = makePhoneData()) {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({
    id,
    type: "article",
    phoneData,
  })
  const overlay = openPhoneAppModal(draft.id, "messages")
  return { dom, draft, overlay }
}

async function openSingleChat(id, phoneData = makePhoneData()) {
  const fixture = await openMessageList(id, phoneData)
  const { overlay } = fixture
  const chatCard = overlay.querySelector("[data-chat-id]")
  assert.ok(chatCard, "the seeded chat should be visible in the messages list")
  assert.equal(chatCard.dataset.chatId, phoneData.chats[0].id)
  chatCard.click()
  return fixture
}

function closeFixture({ dom, draft }) {
  draft.dispose()
  dom.window.close()
}

test("the author message page exposes the demo editor skeleton", async () => {
  const fixture = await openSingleChat("message-editor-skeleton")
  const { overlay } = fixture

  try {
    const shell = overlay.querySelector(".chat-author-shell")
    assert.ok(shell, "missing the author-only message editor shell")
    assert.ok(shell.querySelector(".chat-author-status"), "missing the author save/status row")
    assert.ok(shell.querySelector(".chat-round-header"), "missing the current round header")
    assert.equal(shell.querySelector("#chatBgBtn").textContent.trim(), "⋯")
    assert.ok(shell.querySelector("#chatMsgArea"), "missing the message canvas")

    const speakerStrip = shell.querySelector(".chat-speaker-strip")
    assert.ok(speakerStrip, "missing the speaker selection strip")
    for (const speaker of ["reader", "contact", "system", "add"]) {
      assert.equal(
        speakerStrip.querySelectorAll(`[data-speaker="${speaker}"]`).length,
        1,
        `expected one ${speaker} speaker button`,
      )
    }

    assert.ok(shell.querySelector("#chatPlusBtn"), "missing the compact composer multi-function button")
    assert.ok(shell.querySelector("#chatInput"), "missing the compact composer input")
    const sendButton = shell.querySelector("#chatSendBtn")
    assert.ok(sendButton, "missing the compact composer add button")
    assert.equal(sendButton.textContent.trim(), "添加")
    assert.ok(shell.querySelector(".chat-editor-modebar"), "missing the bottom editor mode bar")
  } finally {
    closeFixture(fixture)
  }
})

test("single and group conversations can be pinned and reordered inside their section", async () => {
  const phoneData = makePhoneData()
  phoneData.chats = [
    { ...phoneData.chats[0], id:"normal-a" },
    { id:"pinned-a", type:"group", contactIds:["contact-1"], groupName:"置顶群聊", pinned:true, messages:[], rounds:[] },
    { id:"normal-b", type:"group", contactIds:["contact-1"], groupName:"普通群聊", messages:[], rounds:[] },
  ]
  const fixture = await openMessageList("message-list-pin-order", phoneData)
  const { draft, overlay } = fixture

  try {
    const ids = () => Array.from(overlay.querySelectorAll("[data-chat-id]")).map(card => card.dataset.chatId)
    assert.deepEqual(ids(), ["pinned-a", "normal-a", "normal-b"])

    overlay.querySelector('[data-chat-pin="normal-b"]').click()
    assert.deepEqual(ids(), ["normal-b", "pinned-a", "normal-a"])
    assert.equal(draft.snapshot().phoneData.chats[0].id, "normal-b")
    assert.equal(draft.snapshot().phoneData.chats[0].pinned, true)

    const handle = overlay.querySelector('[data-chat-drag="pinned-a"]')
    handle.dispatchEvent(new window.KeyboardEvent("keydown", { key:"ArrowUp", bubbles:true }))
    assert.deepEqual(ids(), ["pinned-a", "normal-b", "normal-a"])
    assert.deepEqual(draft.snapshot().phoneData.chats.map(chat => chat.id), ["pinned-a", "normal-b", "normal-a"])
    assert.equal(document.activeElement?.dataset.chatDrag, "pinned-a")
  } finally {
    closeFixture(fixture)
  }
})

test("system time messages open the same author menu and can be deleted", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({ id: "system-time", type: "time", time: "2026/7/22 10:30" })
  const fixture = await openSingleChat("system-message-delete", phoneData)
  const { draft, overlay } = fixture

  try {
    const timestamp = overlay.querySelector('.chat-time-stamp[data-ri="0"][data-mi="0"]')
    assert.ok(timestamp)
    timestamp.dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 24,
    }))
    const items = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
    assert.ok(items.length > 0)
    items.at(-1).click()
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 0)
  } finally {
    closeFixture(fixture)
  }
})

test("special message cards reopen their typed editor and preserve message identity", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id: "takeaway-existing",
    type: "takeaway",
    senderId: "contact-1",
    text: "",
    time: "2026/7/23 08:10",
    takeawayShop: "旧餐厅",
    takeawayOrder: "旧订单",
    takeawayAmount: 18,
    takeawayStatus: "准备中",
    choices: [{ text: "保留选项" }],
    customMetadata: { keep: true },
  })
  const fixture = await openSingleChat("typed-message-reedit", phoneData)
  const { draft, overlay } = fixture

  try {
    const messageCard = overlay.querySelector('.chat-msg[data-ri="0"][data-mi="0"]')
    assert.ok(messageCard)
    messageCard.dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 24,
    }))
    document.querySelector(".chat-ctx-menu-item").click()

    const editor = document.querySelector("#amSave").closest(".modal-overlay")
    assert.equal(editor.querySelector("#amTkShop").value, "旧餐厅")
    assert.equal(editor.querySelector("#amTkOrder").value, "旧订单")
    assert.equal(editor.querySelector("#amTkAmt").value, "18")
    assert.equal(editor.querySelector("#amTkStatus").value, "准备中")
    assert.equal(editor.querySelector("#amSender").value, "contact-1")

    editor.querySelector("#amTkShop").value = "春风小馆"
    editor.querySelector("#amTkOrder").value = "番茄牛腩饭 × 1"
    editor.querySelector("#amTkAmt").value = "28.5"
    editor.querySelector("#amTkStatus").value = "骑手正在配送"
    editor.querySelector("#amSave").click()

    const messages = draft.snapshot().phoneData.chats[0].rounds[0].messages
    assert.equal(messages.length, 1)
    assert.deepEqual(messages[0], {
      ...messages[0],
      id: "takeaway-existing",
      takeawayShop: "春风小馆",
      takeawayOrder: "番茄牛腩饭 × 1",
      takeawayAmount: 28.5,
      takeawayStatus: "骑手正在配送",
      choices: [{ text: "保留选项" }],
      customMetadata: { keep: true },
    })
  } finally {
    closeFixture(fixture)
  }
})

test("authored calls reopen with their sender and script for editing", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id: "call-existing",
    type: "call",
    callMode: "video",
    senderId: "self",
    text: "视频通话",
    time: "2026/7/23 08:20",
    callLines: ["旧台词"],
    allowHangup: false,
    customMetadata: { keep: true },
  })
  const fixture = await openSingleChat("call-message-reedit", phoneData)
  const { draft, overlay } = fixture

  try {
    const messageCard = overlay.querySelector('.chat-msg[data-ri="0"][data-mi="0"]')
    assert.ok(messageCard)
    messageCard.dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 24,
    }))
    document.querySelector(".chat-ctx-menu-item").click()

    assert.equal(overlay.querySelector("#chatCallSender").value, "self")
    assert.equal(overlay.querySelector("#chatCallLines").value, "旧台词")
    overlay.querySelector("#chatCallLines").value = "第一句\n第二句"
    overlay.querySelector("#chatCallSave").click()

    const messages = draft.snapshot().phoneData.chats[0].rounds[0].messages
    assert.equal(messages.length, 1)
    assert.deepEqual(messages[0], {
      ...messages[0],
      id: "call-existing",
      type: "call",
      callMode: "video",
      senderId: "self",
      callLines: ["第一句", "第二句"],
      allowHangup: false,
      customMetadata: { keep: true },
    })
  } finally {
    closeFixture(fixture)
  }
})

test("group chats can update identity, membership, roles, and titles", async () => {
  const phoneData = makePhoneData()
  phoneData.contacts.push({ id: "contact-2", name: "周遥", avatarUrl: "" })
  Object.assign(phoneData.chats[0], {
    type: "group",
    groupName: "旧群名",
    groupOwnerId: "self",
    groupAdminIds: [],
    groupTitles: {},
  })
  const fixture = await openSingleChat("group-chat-management", phoneData)
  const { draft, overlay } = fixture
  try {
    overlay.querySelector("#chatBgBtn").click()
    document.querySelector("#chatManageGroup").click()
    const manager = document.querySelector("#groupEditSave").closest(".modal-overlay")
    manager.querySelector("#groupEditName").value = "新群名"
    manager.querySelector("#groupEditAvatar").value = "https://example.com/group.png"
    manager.querySelector('[data-group-include][value="contact-2"]').checked = true
    manager.querySelector("#groupOwner").value = "contact-2"
    manager.querySelector('[data-group-admin][value="contact-1"]').checked = true
    manager.querySelector('[data-group-member="contact-1"] [data-group-title]').value = "记录员"
    manager.querySelector("#groupEditSave").click()

    const group = draft.snapshot().phoneData.chats[0]
    assert.equal(group.groupName, "新群名")
    assert.equal(group.groupAvatarUrl, "https://example.com/group.png")
    assert.deepEqual(group.contactIds, ["contact-1", "contact-2"])
    assert.equal(group.groupOwnerId, "contact-2")
    assert.deepEqual(group.groupAdminIds, ["contact-1"])
    assert.deepEqual(group.groupTitles, { "contact-1": "记录员" })
  } finally {
    closeFixture(fixture)
  }
})

test("group composer inserts a selected @ mention and saves readable text", async () => {
  const phoneData = makePhoneData()
  phoneData.contacts.push({ id:"contact-2", name:"周遥", msgId:"遥遥", avatarUrl:"" })
  Object.assign(phoneData.chats[0], { type:"group", groupName:"测试群", contactIds:["contact-1", "contact-2"] })
  const fixture = await openSingleChat("group-chat-mention", phoneData)
  const { draft, overlay } = fixture
  try {
    const input = overlay.querySelector('#chatInput')
    input.value = "请 "
    input.setSelectionRange(input.value.length, input.value.length)
    input.value += '@'
    input.setSelectionRange(input.value.length, input.value.length)
    input.dispatchEvent(new window.InputEvent('input', { bubbles:true, data:'@', inputType:'insertText' }))
    Array.from(document.querySelectorAll('.phone-mention-picker-option')).find(button => button.querySelector('span')?.textContent === '遥遥').click()
    input.value += "看看"
    overlay.querySelector('#chatSendBtn').click()
    const message = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(message.text, "请 @遥遥 看看")
    assert.equal(overlay.querySelector('.mention-token').textContent, "@遥遥")
    assert.equal(overlay.querySelector('#chatMentionBtn'), null)
  } finally {
    closeFixture(fixture)
  }
})

test("the Settings App places editable placeholders and forbidden words before reading flow", async () => {
  const { readFile } = await import("node:fs/promises")
  const source = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")
  const settings = source.slice(source.indexOf("function openSettingsEditor"), source.indexOf("// ===== Phone Skin Customization"))
  assert.ok(settings.indexOf("phone-placeholder-settings") < settings.indexOf("阅读节奏控制"))
  assert.match(settings, />标记</)
  assert.match(settings, />问题</)
  assert.match(settings, />模式</)
  assert.match(settings, /添加 NAME 预设/)
  assert.match(settings, /data-ph-forbidden/)
  assert.doesNotMatch(settings, /placeholder="显示名称"/)
  assert.doesNotMatch(settings, /placeholder="正文中的占位文字"/)
  assert.match(settings, /updateWork\(wid, \{ phoneData: pd, placeholders: placeholders, globalForbidden:globalForbidden \}\)/)
})

test("phone authors can save and reapply their local placeholder preset", async () => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import(`../js/pages/phone.js?author-presets=${Date.now()}-${Math.random()}`)
  localStorage.removeItem("tuuru_author_placeholder_presets")
  const draft = createPhoneWorkDraft({
    id: "phone-author-placeholder-preset",
    type: "article",
    placeholders: [{ id:"placeholder-a", key:"某某", label:"姓名", prompt:"名字？", mode:"each", forbidden:[], values:[], default:"" }],
    phoneData: makePhoneData(),
  })
  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  document.querySelector('[data-app-type="settings"]').click()
  const frame = document.getElementById("phoneFrame")
  try {
    frame.querySelector("#phoneAuthorPresetSave").click()
    document.querySelector("#phoneAuthorPresetName").value = "手机常用"
    document.querySelector("#phoneAuthorPresetConfirm").click()
    const stored = JSON.parse(localStorage.getItem("tuuru_author_placeholder_presets"))
    assert.equal(stored.presets[0].name, "手机常用")

    const selector = frame.querySelector("#phoneAuthorPreset")
    assert.equal(selector.value, stored.presets[0].id)
    frame.querySelector("#phoneAuthorPresetApply").click()
    frame.querySelector("#flowSave").click()
    const placeholders = draft.snapshot().placeholders
    assert.equal(placeholders.length, 2)
    assert.notEqual(placeholders[0].id, placeholders[1].id)
  } finally {
    localStorage.removeItem("tuuru_author_placeholder_presets")
    draft.dispose()
    dom.window.close()
  }
})

test("phone placeholder cards reveal inherited global forbidden words after cleanup", async () => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import(`../js/pages/phone.js?global-forbidden-summary=${Date.now()}-${Math.random()}`)
  const draft = createPhoneWorkDraft({
    id: "phone-global-forbidden-summary",
    type: "article",
    globalForbidden: ["老公"],
    placeholders: [
      { id:"placeholder-a", key:"姓名", label:"姓名", prompt:"名字？", mode:"each", forbidden:[], values:[], default:"" },
      { id:"placeholder-b", key:"昵称", label:"昵称", prompt:"昵称？", mode:"each", forbidden:["坏蛋"], values:[], default:"" },
    ],
    phoneData: makePhoneData(),
  })
  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  document.querySelector('[data-app-type="settings"]').click()
  const frame = document.getElementById("phoneFrame")
  try {
    const initialSummaries = frame.querySelectorAll(".placeholder-inherited-forbidden")
    assert.equal(initialSummaries.length, 2)
    for (const summary of initialSummaries) assert.match(summary.textContent, /全局生效.*老公/)

    frame.querySelector("#phoneGlobalForbidden").value = "老公，老婆/老公"
    frame.querySelector("#phoneForbiddenCleanup").click()
    const cleanedSummaries = frame.querySelectorAll(".placeholder-inherited-forbidden")
    assert.equal(cleanedSummaries.length, 2)
    for (const summary of cleanedSummaries) {
      assert.match(summary.textContent, /全局生效.*老公.*老婆/)
    }
    frame.querySelector("#flowSave").click()
    assert.deepEqual(draft.snapshot().globalForbidden, ["老公", "老婆"])
  } finally {
    draft.dispose()
    dom.window.close()
  }
})

test("reading-flow cards reorder from a touch pointer and explain message-card granularity", async () => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import(`../js/pages/phone.js?flow-pointer=${Date.now()}-${Math.random()}`)
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages = [
    { id:"message-a", type:"text", senderId:"contact-1", text:"第一句" },
    { id:"message-b", type:"text", senderId:"contact-1", text:"第二句" },
  ]
  phoneData.readingFlow = {
    enabled:true,
    sequence:[
      { type:"messages", itemId:"message-a", chatId:"chat-1", roundId:"round-1", label:"第一句" },
      { type:"messages", itemId:"message-b", chatId:"chat-1", roundId:"round-1", label:"第二句" },
    ],
  }
  const draft = createPhoneWorkDraft({ id:"flow-pointer-reorder", type:"article", phoneData })
  document.getElementById("app").innerHTML = renderPhoneEditor(draft.id)
  document.querySelector('[data-app-type="settings"]').click()
  const frame = document.getElementById("phoneFrame")

  function pointer(type, clientY) {
    const event = new window.MouseEvent(type, { bubbles:true, cancelable:true, button:0, clientX:20, clientY })
    Object.defineProperty(event, "pointerId", { value:7 })
    Object.defineProperty(event, "pointerType", { value:"touch" })
    return event
  }

  try {
    assert.match(frame.textContent, /每个消息气泡是一张卡片/)
    const handles = frame.querySelectorAll(".flow-handle")
    assert.equal(handles.length, 2)
    handles[0].dispatchEvent(pointer("pointerdown", 10))
    document.dispatchEvent(pointer("pointermove", 80))
    document.dispatchEvent(pointer("pointerup", 80))
    frame.querySelector("#flowSave").click()
    assert.deepEqual(
      draft.snapshot().phoneData.readingFlow.sequence.map(step => step.itemId),
      ["message-b", "message-a"],
    )
  } finally {
    draft.dispose()
    dom.window.close()
  }
})

test("the selected speaker owns each complete sentence added by the author", async () => {
  const fixture = await openSingleChat("message-editor-speakers")
  const { draft, overlay } = fixture

  try {
    const contactSpeaker = overlay.querySelector(
      '.chat-speaker-strip [data-speaker="contact"][data-sender-id="contact-1"]',
    )
    assert.ok(contactSpeaker, "missing the seeded contact speaker button")
    contactSpeaker.click()

    let input = overlay.querySelector("#chatInput")
    let addButton = overlay.querySelector("#chatSendBtn")
    assert.ok(input)
    assert.ok(addButton)
    input.value = "你今天是不是又忘记带伞了？"
    addButton.click()

    let messages = draft.snapshot().phoneData.chats[0].rounds[0].messages
    assert.equal(messages.at(-1).senderId, "contact-1")
    assert.equal(messages.at(-1).text, "你今天是不是又忘记带伞了？")

    const readerSpeaker = overlay.querySelector(
      '.chat-speaker-strip [data-speaker="reader"][data-sender-id="self"]',
    )
    assert.ok(readerSpeaker, "missing the reader speaker button")
    readerSpeaker.click()

    input = overlay.querySelector("#chatInput")
    addButton = overlay.querySelector("#chatSendBtn")
    assert.ok(input)
    assert.ok(addButton)
    input.value = "没有，我只是想等你来接我。"
    addButton.click()

    messages = draft.snapshot().phoneData.chats[0].rounds[0].messages
    assert.equal(messages.at(-1).senderId, "self")
    assert.equal(messages.at(-1).text, "没有，我只是想等你来接我。")
  } finally {
    closeFixture(fixture)
  }
})

test("the author multi-function tools open as an in-editor sheet", async () => {
  const fixture = await openSingleChat("message-editor-tool-sheet")
  const { overlay } = fixture

  try {
    const shell = overlay.querySelector(".chat-author-shell")
    assert.ok(shell)
    const bodyModalCount = document.body.querySelectorAll(":scope > .modal-overlay").length
    shell.querySelector("#chatPlusBtn").click()

    const sheet = shell.querySelector(".chat-tool-sheet")
    assert.ok(sheet, "the tools should stay inside the author editor shell")
    assert.equal(sheet.closest(".chat-author-shell"), shell)
    assert.ok(sheet.querySelector(".chat-tool-grid"), "missing the tool grid")

    for (const tool of [
      "image",
      "voice-call",
      "video-call",
      "voice",
      "transfer",
      "location",
      "time",
      "system",
    ]) {
      assert.ok(sheet.querySelector(`[data-chat-tool="${tool}"]`), `missing ${tool} tool`)
    }

    assert.ok(sheet.querySelector("#chatToolClose"), "missing the tool sheet close button")
    assert.equal(
      document.body.querySelectorAll(":scope > .modal-overlay").length,
      bodyModalCount,
      "opening tools should not append a generic document-level modal",
    )
  } finally {
    closeFixture(fixture)
  }
})

test("takeaway lives in the plus sheet while ending a round lives in the header menu", async () => {
  const fixture = await openSingleChat("message-editor-takeaway")
  const { draft, overlay } = fixture

  try {
    let shell = overlay.querySelector(".chat-author-shell")
    shell.querySelector("#chatPlusBtn").click()
    shell.querySelector("#chatToolNext").click()
    const takeaway = shell.querySelector('[data-chat-tool="takeaway"]')
    assert.ok(takeaway)
    assert.equal(shell.querySelector('[data-chat-tool="round"]'), null)
    takeaway.click()

    document.querySelector("#amTkShop").value = "春风小馆"
    document.querySelector("#amTkOrder").value = "番茄牛腩饭 × 1"
    document.querySelector("#amTkAmt").value = "28.5"
    document.querySelector("#amTkStatus").value = "骑手正在配送"
    document.querySelector("#amSave").click()

    const message = draft.snapshot().phoneData.chats[0].rounds[0].messages.at(-1)
    assert.deepEqual(
      { type:message.type, shop:message.takeawayShop, order:message.takeawayOrder, amount:message.takeawayAmount, status:message.takeawayStatus },
      { type:"takeaway", shop:"春风小馆", order:"番茄牛腩饭 × 1", amount:28.5, status:"骑手正在配送" },
    )
    shell = overlay.querySelector(".chat-author-shell")
    const card = shell.querySelector(".chat-takeaway-card")
    assert.equal(card?.tagName, "A")
    assert.match(card.href, /meituan\.com\/s\//)

    shell.querySelector("#chatBgBtn").click()
    assert.ok(document.querySelector("#chatEndRound"))
    assert.equal(document.querySelector("#bsSelfColor"), null)
    document.querySelector("#chatEndRound").click()
    assert.equal(draft.snapshot().phoneData.chats[0].rounds.length, 2)
  } finally {
    closeFixture(fixture)
  }
})

test("author link cards can target an existing forum post", async () => {
  const phoneData = makePhoneData()
  phoneData.forumPosts = [{ id:"post-1", title:"夜雨讨论", content:"帖子正文", comments:[] }]
  const fixture = await openSingleChat("message-editor-inline-post", phoneData)
  const { draft, overlay } = fixture

  try {
    const shell = overlay.querySelector(".chat-author-shell")
    shell.querySelector("#chatPlusBtn").click()
    shell.querySelector("#chatToolNext").click()
    shell.querySelector('[data-chat-tool="link"]').click()
    const postSelect = document.querySelector("#amForumPost")
    assert.ok(postSelect)
    postSelect.value = "post-1"
    document.querySelector("#amSave").click()

    const message = draft.snapshot().phoneData.chats[0].rounds[0].messages.at(-1)
    assert.equal(message.forumPostId, "post-1")
    assert.equal(message.linkTitle, "夜雨讨论")
    assert.match(overlay.querySelector(".chat-link-card")?.textContent || "", /内联论坛帖子/)
  } finally {
    closeFixture(fixture)
  }
})

test("saving an authored voice call appends its scripted lines to the draft", async () => {
  const fixture = await openSingleChat("message-editor-voice-call")
  const { draft, overlay } = fixture

  try {
    const shell = overlay.querySelector(".chat-author-shell")
    assert.ok(shell)
    shell.querySelector("#chatPlusBtn").click()
    const voiceCallTool = shell.querySelector('[data-chat-tool="voice-call"]')
    assert.ok(voiceCallTool, "missing the voice call tool")
    voiceCallTool.click()

    const lines = shell.querySelector("#chatCallLines")
    const save = shell.querySelector("#chatCallSave")
    assert.ok(lines, "missing the call script textarea")
    assert.ok(save, "missing the call save button")

    lines.value = "Can you hear me?\nI will wait downstairs."
    save.click()

    const messages = draft.snapshot().phoneData.chats[0].rounds[0].messages
    assert.deepEqual(messages.at(-1), {
      ...messages.at(-1),
      type: "call",
      callMode: "voice",
      senderId: "contact-1",
      callLines: ["Can you hear me?", "I will wait downstairs."],
    })
  } finally {
    closeFixture(fixture)
  }
})

test("contact ids stay data instead of becoming injected author-editor attributes", async () => {
  const maliciousId = 'contact-1" data-pwned="yes'
  const fixture = await openSingleChat(
    "message-editor-contact-attribute-safety",
    makePhoneData({ id: maliciousId, name: "林澈", avatarUrl: "" }),
  )
  const { overlay } = fixture

  try {
    const contactSpeaker = overlay.querySelector('.chat-speaker-btn[data-speaker="contact"]')
    assert.ok(contactSpeaker)
    assert.equal(contactSpeaker.dataset.senderId, maliciousId)
    assert.equal(contactSpeaker.hasAttribute("data-pwned"), false)

    overlay.querySelector("#chatPlusBtn").click()
    overlay.querySelector('[data-chat-tool="voice-call"]').click()
    const contactOption = overlay.querySelector("#chatCallSender option")
    assert.ok(contactOption)
    assert.equal(contactOption.value, maliciousId)
    assert.equal(contactOption.hasAttribute("data-pwned"), false)

    overlay.querySelector("#chatCallCancel").click()
    overlay.querySelector('.chat-speaker-btn[data-speaker="add"]').click()
    const picker = document.querySelector('.chat-speaker-pick[data-sender-id]:not([data-sender-id="self"])')
    assert.ok(picker)
    assert.equal(picker.dataset.senderId, maliciousId)
    assert.equal(picker.hasAttribute("data-pwned"), false)
  } finally {
    closeFixture(fixture)
  }
})

test("mixed legacy messages and rounds are merged instead of hiding old messages", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id: "round-message",
    type: "text",
    senderId: "contact-1",
    text: "轮次里的消息",
  })
  phoneData.chats[0].messages.push({
    id: "legacy-message",
    type: "text",
    senderId: "self",
    text: "旧字段里的消息",
  })
  const fixture = await openSingleChat("message-editor-mixed-chat-shapes", phoneData)
  const { draft, overlay } = fixture

  try {
    const visibleText = [...overlay.querySelectorAll(".chat-bubble")]
      .map(bubble => bubble.textContent)
      .join("\n")
    assert.match(visibleText, /轮次里的消息/)
    assert.match(visibleText, /旧字段里的消息/)

    const chat = draft.snapshot().phoneData.chats[0]
    assert.deepEqual(chat.messages, [])
    assert.equal(chat.rounds[0].messages.length, 2)
  } finally {
    closeFixture(fixture)
  }
})

test("author choice buttons edit their owner instead of executing a reader branch", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id: "owner-message",
    type: "text",
    senderId: "contact-1",
    text: "你想怎么回答？",
    choices: [
      {
        id: "choice-stable-a",
        text: "第一句",
        replyText: "第一句",
        customMeta: { keep: true },
        followUpMessages: [{
          id: "follow-stable-a",
          senderId: "contact-1",
          text: "我听见了。",
          type: "text",
        }],
      },
      { id: "choice-stable-b", text: "第二句", replyText: "第二句", followUpMessages: [] },
    ],
  })
  const fixture = await openSingleChat("message-editor-choice-owner", phoneData)
  const { draft, overlay } = fixture

  try {
    const choiceButton = overlay.querySelector(".chat-choice-btn")
    assert.ok(choiceButton)
    choiceButton.click()

    const editor = document.querySelector("#chGroupsList")
    assert.ok(editor, "clicking an authored choice should open its local option editor")
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 1)

    editor.querySelectorAll(".ch-grp-text")[0].value = "改过的第一句"
    document.querySelector("#chSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.choices[0].id, "choice-stable-a")
    assert.equal(saved.choices[0].text, "改过的第一句")
    assert.equal(saved.choices[0].followUpMessages[0].id, "follow-stable-a")
    assert.deepEqual(saved.choices[0].customMeta, { keep: true })
    assert.equal(saved.choices[0].used, undefined)
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 1)
  } finally {
    closeFixture(fixture)
  }
})

test("chat ids and avatar urls cannot inject attributes into author message views", async () => {
  const maliciousChatId = 'chat-1" data-pwned="chat'
  const maliciousAvatar = 'x)" onmouseover="globalThis.__avatarPwned=1" data-pwned="avatar'
  const phoneData = makePhoneData(
    { id: "contact-1", name: "林澈", avatarUrl: maliciousAvatar },
    maliciousChatId,
  )
  phoneData.chats[0].rounds[0].messages.push({
    id: "avatar-message",
    type: "text",
    senderId: "contact-1",
    text: "看这里。",
  })
  const fixture = await openSingleChat("message-editor-attribute-boundaries", phoneData)
  const { overlay } = fixture

  try {
    const messageAvatar = overlay.querySelector(".chat-avatar")
    assert.ok(messageAvatar)
    assert.equal(messageAvatar.hasAttribute("onmouseover"), false)
    assert.equal(messageAvatar.hasAttribute("data-pwned"), false)

    overlay.querySelector("#chatBack").click()
    const chatCard = overlay.querySelector("[data-chat-id]")
    const deleteButton = overlay.querySelector("[data-chat-del]")
    assert.equal(chatCard.dataset.chatId, maliciousChatId)
    assert.equal(deleteButton.dataset.chatDel, maliciousChatId)
    assert.equal(chatCard.hasAttribute("data-pwned"), false)
    assert.equal(deleteButton.hasAttribute("data-pwned"), false)

    overlay.querySelector("#msgTabContacts").click()
    const contactAvatar = overlay.querySelector(".forum-npc-avatar")
    assert.ok(contactAvatar)
    assert.equal(contactAvatar.hasAttribute("onmouseover"), false)
    assert.equal(contactAvatar.hasAttribute("data-pwned"), false)
    assert.equal(globalThis.__avatarPwned, undefined)
  } finally {
    delete globalThis.__avatarPwned
    closeFixture(fixture)
  }
})

test("single-chat list renders the current contact avatar", async () => {
  const avatar = "data:image/png;base64,iVBORw0KGgo="
  const phoneData = makePhoneData({ id: "contact-1", name: "林澈", avatarUrl: avatar })
  const fixture = await openSingleChat("message-list-contact-avatar", phoneData)

  try {
    fixture.overlay.querySelector("#chatBack").click()
    const listAvatar = fixture.overlay.querySelector(".forum-list-avatar")
    assert.ok(listAvatar)
    assert.match(listAvatar.getAttribute("style"), /background-image:url\(data:image\/png;base64,iVBORw0KGgo=\)/)
    assert.equal(listAvatar.querySelector("span"), null)
  } finally {
    closeFixture(fixture)
  }
})

test("contact editor filters a long contact list by name without losing the original indexes", async () => {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const phoneData = makePhoneData()
  phoneData.contacts.push(
    { id:"contact-2", name:"周遥", alias:"小周", avatarUrl:"" },
    { id:"contact-3", name:"顾声", alias:"", avatarUrl:"" },
  )
  const draft = createPhoneWorkDraft({ id:"contact-search", type:"article", phoneData })
  const overlay = openPhoneAppModal(draft.id, "contacts")
  try {
    const search = overlay.querySelector("[data-contact-search]")
    assert.ok(search)
    assert.equal(overlay.querySelectorAll(".ct-card").length, 3)
    search.value = "周遥"
    search.dispatchEvent(new window.Event("input", { bubbles:true }))
    const visible = [...overlay.querySelectorAll(".ct-card")].filter(card => !card.hidden)
    assert.equal(visible.length, 1)
    assert.equal(visible[0].querySelector("[data-ct-name]").value, "周遥")
    assert.equal(visible[0].querySelector("[data-ct-name]").dataset.ctIdx, "1")
  } finally {
    draft.dispose()
    dom.window.close()
  }
})

test("legacy addChatMessage writes into the active round when rounds already exist", async () => {
  const dom = installDom()
  const {
    WORK_TYPE,
    addChatMessage,
    createWork,
    deleteWork,
    getWork,
    updateWork,
  } = await import("../js/data.js")
  const work = createWork({ type: WORK_TYPE.PHONE, title: "round api test" })

  try {
    const phoneData = getWork(work.id).phoneData
    phoneData.chats = [{
      id: "chat-api",
      type: "single",
      contactIds: [],
      messages: [],
      rounds: [{ id: "round-api", label: "第1轮", messages: [] }],
    }]
    updateWork(work.id, { phoneData })

    addChatMessage(work.id, "chat-api", {
      senderId: "self",
      text: "写进当前轮次",
      time: "12:00",
    })

    const savedChat = getWork(work.id).phoneData.chats[0]
    assert.equal(savedChat.messages.length, 0)
    assert.equal(savedChat.rounds[0].messages.length, 1)
    assert.equal(savedChat.rounds[0].messages[0].text, "写进当前轮次")
  } finally {
    deleteWork(work.id)
    dom.window.close()
  }
})
