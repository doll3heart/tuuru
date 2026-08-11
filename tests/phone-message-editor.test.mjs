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

test("the author preview uses the same voice playback and transcript vocabulary as the reader", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id: "voice-preview",
    type: "voice",
    senderId: "contact-1",
    text: "别担心，我很快就到。",
    duration: 3,
  })
  const fixture = await openSingleChat("message-editor-voice-preview", phoneData)
  const { overlay } = fixture

  try {
    const voice = overlay.querySelector('[data-voice-message-id="voice-preview"]')
    assert.ok(voice)
    assert.ok(voice.querySelector(".rd-voice-playback"))
    const transcriptToggle = voice.querySelector(".rd-voice-transcript-toggle")
    const transcript = voice.querySelector(".rd-voice-transcript")
    assert.ok(transcriptToggle)
    assert.equal(transcript.hidden, true)
    transcriptToggle.click()
    assert.equal(transcript.hidden, false)
    assert.match(transcript.textContent, /别担心/)
  } finally {
    closeFixture(fixture)
  }
})

test("saved story events remain editable without occupying the attachment sheet", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id:"legacy-recall",
    type:"system-event",
    eventKind:"recall",
    actorContactId:"contact-1",
    originalText:"别回头。",
    allowReveal:true,
  })
  const fixture = await openSingleChat("message-editor-story-event", phoneData)
  const { draft, overlay } = fixture

  try {
    const eventRow = overlay.querySelector('[data-message-id="legacy-recall"]')
    assert.match(eventRow?.textContent || "", /撤回/)
    eventRow.dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:24,
      clientY:24,
    }))
    const editAction = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
      .find(button => button.textContent === "编辑")
    assert.ok(editAction)
    editAction.click()
    const editor = overlay.querySelector(".chat-event-editor")
    assert.ok(editor)
    editor.querySelector("#chatEventOriginal").value = "别再回头。"
    editor.querySelector("#chatEventSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.type, "system-event")
    assert.equal(saved.eventKind, "recall")
    assert.equal(saved.actorContactId, "contact-1")
    assert.equal(saved.originalText, "别再回头。")
    assert.equal(saved.allowReveal, true)
    assert.match(overlay.querySelector(".chat-story-system-row").textContent, /撤回/)
  } finally {
    closeFixture(fixture)
  }
})

test("rich story cards share the paged plus sheet and save structured content", async () => {
  const fixture = await openSingleChat("message-editor-rich-card")
  const { draft, overlay } = fixture

  try {
    overlay.querySelector("#chatPlusBtn").click()
    overlay.querySelector("#chatToolNext").click()
    const fileButton = overlay.querySelector('[data-chat-tool="file"]')
    assert.ok(fileButton)
    fileButton.click()
    document.querySelector("#amFileName").value = "夜巡值班表.pdf"
    document.querySelector("#amFileType").value = "PDF"
    document.querySelector("#amFileSize").value = "1.2 MB"
    document.querySelector("#amFileContent").value = "23:00 北门交接"
    document.querySelector("#amSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.type, "file")
    assert.equal(saved.fileName, "夜巡值班表.pdf")
    assert.equal(saved.fileContent, "23:00 北门交接")
    assert.match(overlay.querySelector(".chat-file-card").textContent, /1.2 MB/)
  } finally {
    closeFixture(fixture)
  }
})

test("call outcomes can be authored without inventing call dialogue", async () => {
  const fixture = await openSingleChat("message-editor-call-outcome")
  const { draft, overlay } = fixture

  try {
    overlay.querySelector("#chatPlusBtn").click()
    overlay.querySelector('[data-chat-tool="voice-call"]').click()
    const editor = overlay.querySelector(".chat-call-editor")
    editor.querySelector("#chatCallStatus").value = "missed"
    editor.querySelector("#chatCallStatus").dispatchEvent(new window.Event("change", { bubbles:true }))
    assert.equal(editor.querySelector("#chatCallLines").closest(".chat-call-field").hidden, true)
    editor.querySelector("#chatCallSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.callStatus, "missed")
    assert.deepEqual(saved.callLines, [])
    assert.match(overlay.querySelector(".chat-story-call-outcome").textContent, /无人接听/)
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

    const normalActions = overlay.querySelector('[data-chat-actions="normal-b"]')
    assert.ok(normalActions)
    assert.equal(
      overlay.querySelector('[data-chat-id="normal-b"] .message-chat-controls').querySelectorAll("button").length,
      1,
      "conversation cards should expose one consolidated action button",
    )
    normalActions.click()
    const actionMenu = document.querySelector(".message-chat-action-menu")
    assert.ok(actionMenu)
    assert.ok(actionMenu.querySelector('[data-chat-del="normal-b"]'))
    actionMenu.querySelector('[data-chat-pin="normal-b"]').click()
    assert.deepEqual(ids(), ["normal-b", "pinned-a", "normal-a"])
    assert.equal(draft.snapshot().phoneData.chats[0].id, "normal-b")
    assert.equal(draft.snapshot().phoneData.chats[0].pinned, true)

    const handle = overlay.querySelector('[data-chat-actions="pinned-a"]')
    handle.dispatchEvent(new window.KeyboardEvent("keydown", { key:"ArrowUp", bubbles:true }))
    assert.deepEqual(ids(), ["pinned-a", "normal-b", "normal-a"])
    assert.deepEqual(draft.snapshot().phoneData.chats.map(chat => chat.id), ["pinned-a", "normal-b", "normal-a"])
    assert.equal(document.activeElement?.dataset.chatActions, "pinned-a")
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
    assert.equal(items.some(item => item.textContent === "撤回"), false)
    assert.equal(items.some(item => item.textContent === "发送失败"), false)
    items.at(-1).click()
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 0)
  } finally {
    closeFixture(fixture)
  }
})

test("a written message can be recalled and restored from its context menu", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id:"recall-source",
    type:"text",
    senderId:"contact-1",
    text:"别回头，我在楼下。",
    time:"今晚 22:10",
    customMetadata:{ keep:true },
  })
  const fixture = await openSingleChat("message-context-recall", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('[data-message-id="recall-source"]').dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:24,
      clientY:24,
    }))
    const recallAction = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
      .find(button => button.textContent === "撤回")
    assert.ok(recallAction)
    recallAction.click()

    let saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.id, "recall-source")
    assert.equal(saved.type, "system-event")
    assert.equal(saved.eventKind, "recall")
    assert.equal(saved.actorContactId, "contact-1")
    assert.equal(saved.originalText, "别回头，我在楼下。")
    assert.equal(saved.allowReveal, true)
    assert.deepEqual(saved.recalledMessage, {
      id:"recall-source",
      type:"text",
      senderId:"contact-1",
      text:"别回头，我在楼下。",
      time:"今晚 22:10",
      customMetadata:{ keep:true },
    })
    assert.equal(document.querySelector("#chatEventSave"), null)
    assert.match(overlay.querySelector('[data-message-id="recall-source"]')?.textContent || "", /撤回/)

    overlay.querySelector('[data-message-id="recall-source"]').dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:24,
      clientY:24,
    }))
    const restoreAction = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
      .find(button => button.textContent === "取消撤回")
    assert.ok(restoreAction)
    restoreAction.click()

    saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.type, "text")
    assert.equal(saved.text, "别回头，我在楼下。")
    assert.deepEqual(saved.customMetadata, { keep:true })
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
  assert.match(settings, /updateWork\(wid, \{ phoneData: pd, placeholders: placeholders, globalForbidden:globalForbidden, globalExactForbidden:globalExactForbidden \}\)/)
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
    const globalEditor = frame.querySelector(".placeholder-global-forbidden")
    assert.equal(globalEditor.tagName, "DETAILS")
    assert.equal(globalEditor.open, false)
    assert.match(globalEditor.querySelector("summary").textContent, /全局违禁词.*1 个/)
    const forbiddenEditors = frame.querySelectorAll("[data-placeholder-forbidden-editor]")
    assert.equal(forbiddenEditors.length, 2)
    for (const editor of forbiddenEditors) assert.equal(editor.open, false)
    for (const summary of initialSummaries) {
      assert.equal(summary.tagName, "DETAILS")
      assert.equal(summary.open, false)
      assert.match(summary.querySelector("summary").textContent, /全局生效.*1 个违禁词/)
      assert.match(summary.textContent, /老公/)
    }

    const search = frame.querySelector('[data-placeholder-search]')
    search.value = "坏蛋"
    search.dispatchEvent(new Event("input", { bubbles:true }))
    assert.equal(forbiddenEditors[0].open, false)
    assert.equal(forbiddenEditors[1].open, true)

    search.value = "老公"
    search.dispatchEvent(new Event("input", { bubbles:true }))
    assert.equal(globalEditor.open, true)
    for (const summary of initialSummaries) assert.equal(summary.open, true)

    frame.querySelector("#phoneGlobalForbidden").value = "老公，老婆/老公"
    frame.querySelector("#phoneGlobalForbidden").dispatchEvent(new Event("input", { bubbles:true }))
    assert.match(globalEditor.querySelector("summary").textContent, /2 个/)
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

test("the system remains a composer speaker and creates a system message instead of a time marker", async () => {
  const fixture = await openSingleChat("message-editor-system-speaker")
  const { draft, overlay } = fixture

  try {
    const systemSpeaker = overlay.querySelector('.chat-speaker-btn[data-sender-id="system"]')
    assert.ok(systemSpeaker)
    systemSpeaker.click()

    const input = overlay.querySelector("#chatInput")
    input.value = "你撤回了一条消息"
    overlay.querySelector("#chatSendBtn").click()

    const message = draft.snapshot().phoneData.chats[0].rounds[0].messages.at(-1)
    assert.equal(message.type, "system")
    assert.equal(message.senderId, "system")
    assert.equal(message.text, "你撤回了一条消息")
    assert.match(overlay.querySelector('[data-message-id="' + message.id + '"]')?.textContent || "", /你撤回了一条消息/)
  } finally {
    closeFixture(fixture)
  }
})

test("the author attachment sheet keeps only actual attachments and cards", async () => {
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
    ]) {
      assert.ok(sheet.querySelector(`[data-chat-tool="${tool}"]`), `missing ${tool} tool`)
    }
    for (const redundantTool of ["time", "system", "forward", "status-event", "contact-event", "group-event"]) {
      assert.equal(sheet.querySelector(`[data-chat-tool="${redundantTool}"]`), null)
    }

    sheet.querySelector("#chatToolNext").click()
    const secondPage = shell.querySelector(".chat-tool-sheet")
    assert.ok(secondPage.querySelector('[data-chat-tool="schedule"]'))
    assert.match(secondPage.querySelector(".chat-tool-pager")?.textContent || "", /2\s*\/\s*2/)
    assert.equal(secondPage.querySelector("#chatToolNext").disabled, true)
    for (const redundantTool of ["time", "system", "forward", "status-event", "contact-event", "group-event"]) {
      assert.equal(secondPage.querySelector(`[data-chat-tool="${redundantTool}"]`), null)
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

test("message multi-select forwards an automatic transcript to other contacts", async () => {
  const phoneData = makePhoneData()
  phoneData.contacts.push({ id:"contact-2", name:"周宁", avatarUrl:"" })
  phoneData.chats[0].rounds[0].messages.push(
    { id:"source-a", type:"text", senderId:"contact-1", text:"钥匙在花盆下面。" },
    { id:"source-b", type:"file", senderId:"self", fileName:"值班表.pdf", fileType:"PDF" },
  )
  const fixture = await openSingleChat("message-editor-multi-forward", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('[data-message-id="source-a"]').dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:24,
      clientY:24,
    }))
    const multiAction = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
      .find(button => button.textContent === "多选")
    assert.ok(multiAction)
    multiAction.click()

    assert.ok(overlay.querySelector(".chat-multi-select-bar"))
    assert.equal(overlay.querySelector("#chatInput"), null)
    assert.ok(overlay.querySelector('[data-message-id="source-a"]').classList.contains("is-selected"))
    overlay.querySelector('[data-message-id="source-b"]').click()
    assert.match(overlay.querySelector(".chat-multi-select-count").textContent, /2/)

    overlay.querySelector("#chatMultiForward").click()
    const recipient = document.querySelector('[data-forward-recipient="contact-2"]')
    assert.ok(recipient)
    assert.equal(document.querySelector('[data-forward-recipient="contact-1"]'), null)
    recipient.click()
    document.querySelector("#chatForwardConfirm").click()

    const saved = draft.snapshot().phoneData
    const destination = saved.chats.find(chat => chat.type === "single" && chat.contactIds[0] === "contact-2")
    assert.ok(destination)
    const forwarded = destination.rounds[0].messages.at(-1)
    assert.equal(forwarded.type, "forward")
    assert.equal(forwarded.senderId, "self")
    assert.equal(forwarded.forwardItems.length, 2)
    assert.deepEqual(forwarded.forwardItems.map(item => item.text), [
      "钥匙在花盆下面。",
      "文件：值班表.pdf",
    ])
    assert.equal(overlay.querySelector(".chat-multi-select-bar"), null)
    assert.ok(overlay.querySelector("#chatInput"))
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
    assert.equal(document.querySelector("#chatManageGroup"), null)
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

test("author link cards can open existing App content and require completion", async () => {
  const phoneData = makePhoneData()
  phoneData.memos = [{ id:"memo-1", contactId:"contact-1", content:"<p>钥匙放在花盆下。</p>", time:"今晚" }]
  const fixture = await openSingleChat("message-editor-cross-app-card", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector("#chatPlusBtn").click()
    overlay.querySelector('[data-chat-tool="link"]').click()

    const targetSelect = document.querySelector("#amAppTarget")
    const memoOption = Array.from(targetSelect.options).find(option => option.dataset.targetApp === "memo")
    assert.ok(memoOption)
    targetSelect.value = memoOption.value
    targetSelect.dispatchEvent(new window.Event("change", { bubbles:true }))
    document.querySelector("#amActionMode").value = "required"
    document.querySelector("#amSave").click()

    const message = draft.snapshot().phoneData.chats[0].rounds[0].messages.at(-1)
    assert.equal(message.type, "link")
    assert.equal(message.targetApp, "memo")
    assert.equal(message.targetItemId, "memo-1")
    assert.equal(message.targetContactId, "contact-1")
    assert.equal(message.actionRequired, true)
    assert.equal(message.forumPostId, "")
    assert.match(overlay.querySelector(".chat-link-card")?.textContent || "", /备忘录/)
    assert.match(overlay.querySelector(".chat-link-card")?.textContent || "", /需查看/)
  } finally {
    closeFixture(fixture)
  }
})

test("quote replies use the selected speaker and summarize rich cards", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id:"file-source",
    type:"file",
    senderId:"contact-1",
    fileName:"线索.pdf",
    fileType:"PDF",
  })
  const fixture = await openSingleChat("message-editor-rich-quote", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('.chat-speaker-btn[data-sender-id="self"]').click()
    overlay.querySelector('[data-message-id="file-source"]').dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:24,
      clientY:24,
    }))
    const quoteAction = Array.from(document.querySelectorAll(".chat-ctx-menu-item")).find(button => button.textContent === "引用")
    assert.ok(quoteAction)
    quoteAction.click()
    document.querySelector("#quoteMsgText").value = "我会核对。"
    document.querySelector("#quoteMsgSave").click()

    const quoted = draft.snapshot().phoneData.chats[0].rounds[0].messages.at(-1)
    assert.equal(quoted.senderId, "self")
    assert.equal(quoted.quoteId, "file-source")
    assert.equal(quoted.quoteText, "文件：线索.pdf")
    assert.equal(quoted.quoteSenderName, "林澈")
    assert.match(overlay.querySelector('[data-quote-target="file-source"]')?.textContent || "", /文件：线索\.pdf/)
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

    const editor = document.querySelector("#threadChoiceGroups")
    assert.ok(editor, "clicking an authored choice should open its local option editor")
    const pace = editor.querySelector(".thread-choice-reply-pace")
    assert.ok(pace)
    assert.equal(pace.value, "instant")
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 1)

    editor.querySelectorAll(".thread-choice-text")[0].value = "改过的第一句"
    pace.value = "delayed"
    document.querySelector("#threadChoiceSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0]
    assert.equal(saved.choices[0].id, "choice-stable-a")
    assert.equal(saved.choices[0].text, "改过的第一句")
    assert.equal(saved.choices[0].followUpMessages[0].id, "follow-stable-a")
    assert.equal(saved.choices[0].replyPace, "delayed")
    assert.deepEqual(saved.choices[0].customMeta, { keep: true })
    assert.equal(saved.choices[0].used, undefined)
    assert.equal(draft.snapshot().phoneData.chats[0].rounds[0].messages.length, 1)
  } finally {
    closeFixture(fixture)
  }
})

test("group chat reply branches let every follow-up choose its sender", async () => {
  const phoneData = makePhoneData()
  phoneData.contacts = [
    { id:"contact-1", name:"林澈", avatarUrl:"" },
    { id:"contact-2", name:"沈岚", avatarUrl:"" },
    { id:"contact-3", name:"小满", avatarUrl:"" },
  ]
  phoneData.chats[0].type = "group"
  phoneData.chats[0].groupName = "夜谈组"
  phoneData.chats[0].contactIds = ["contact-1", "contact-2", "contact-3"]
  phoneData.chats[0].rounds[0].messages.push({
    id:"group-choice-owner",
    type:"text",
    senderId:"contact-1",
    text:"大家怎么看？",
    choices:[{
      id:"group-choice",
      text:"我先说说。",
      replyText:"",
      replyPace:"quick",
      followUpMessages:[
        { id:"group-follow-1", senderId:"contact-1", type:"text", text:"林澈接话。", deliveryState:"failed", replyPace:"delayed" },
        { id:"group-follow-2", senderId:"contact-2", type:"text", text:"沈岚也接话。" },
      ],
    }],
  })
  const fixture = await openSingleChat("message-group-choice-senders", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector(".chat-choice-btn").click()

    const editor = document.querySelector("#threadChoiceGroups")
    assert.ok(editor, "group reply branches should use the sender-aware editor")
    const senders = [...editor.querySelectorAll(".thread-choice-followup-sender")]
    assert.equal(senders.length, 2)
    assert.deepEqual(senders.map(select => select.value), ["contact-1::", "contact-2::"])
    assert.deepEqual(
      [...senders[0].options].map(option => option.textContent),
      ["林澈", "沈岚", "小满"],
    )
    assert.equal(editor.querySelector(".thread-choice-reply-pace").value, "quick")
    assert.deepEqual(
      [...editor.querySelectorAll(".thread-choice-followup-delivery")].map(select => select.value),
      ["failed", "normal"],
    )
    assert.deepEqual(
      [...editor.querySelectorAll(".thread-choice-followup-pace")].map(select => select.value),
      ["delayed", "inherit"],
    )

    editor.querySelector('[data-thread-followup-add="0"]').click()
    const updatedSenders = [...editor.querySelectorAll(".thread-choice-followup-sender")]
    assert.equal(updatedSenders[2].value, "contact-1::", "new follow-ups default to the owner of the choice message")
    assert.equal(editor.querySelectorAll(".thread-choice-followup-delivery")[2].value, "normal")
    assert.equal(editor.querySelectorAll(".thread-choice-followup-pace")[2].value, "inherit")
    updatedSenders[0].value = "contact-3::"
    updatedSenders[2].value = "contact-2::"
    editor.querySelectorAll(".thread-choice-followups")[2].value = "沈岚补充一句。"
    editor.querySelectorAll(".thread-choice-followup-delivery")[0].value = "recalled"
    editor.querySelectorAll(".thread-choice-followup-pace")[0].value = "instant"
    editor.querySelectorAll(".thread-choice-followup-delivery")[2].value = "failed"
    editor.querySelectorAll(".thread-choice-followup-pace")[2].value = "quick"
    document.querySelector("#threadChoiceSave").click()

    const saved = draft.snapshot().phoneData.chats[0].rounds[0].messages[0].choices[0]
    assert.equal(saved.replyPace, "quick")
    assert.equal(saved.replyText, "", "a deliberately silent reader choice must stay silent")
    assert.deepEqual(saved.followUpMessages.map(message => message.senderId), ["contact-3", "contact-2", "contact-2"])
    assert.deepEqual(
      saved.followUpMessages.map(message => message.deliveryState),
      ["recalled", undefined, "failed"],
    )
    assert.deepEqual(
      saved.followUpMessages.map(message => message.replyPace),
      ["instant", undefined, "quick"],
    )
    assert.deepEqual(saved.followUpMessages.map(message => message.type), ["text", "text", "text"])
    assert.equal(Object.hasOwn(saved.followUpMessages[0], "failed"), false)
    assert.equal(Object.hasOwn(saved.followUpMessages[0], "eventKind"), false)
    assert.equal(Object.hasOwn(saved.followUpMessages[0], "contactId"), false)
    assert.equal(Object.hasOwn(saved.followUpMessages[0], "likes"), false)
  } finally {
    closeFixture(fixture)
  }
})

test("message context menus expose a dedicated per-choice reply pace editor", async () => {
  const phoneData = makePhoneData()
  phoneData.chats[0].rounds[0].messages.push({
    id:"reply-pace-owner",
    type:"text",
    senderId:"contact-1",
    text:"你准备怎么回答？",
    choices:[
      { id:"pace-a", text:"马上回答", replyText:"好", replyPace:"instant", followUpMessages:[] },
      { id:"pace-b", text:"再想一下", replyText:"让我想想", replyPace:"delayed", followUpMessages:[] },
    ],
  })
  const fixture = await openSingleChat("message-reply-pace-context-menu", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('[data-message-id="reply-pace-owner"]').dispatchEvent(new window.MouseEvent("contextmenu", {
      bubbles:true,
      cancelable:true,
      clientX:120,
      clientY:180,
    }))
    const menuItems = Array.from(document.querySelectorAll(".chat-ctx-menu-item"))
    assert.equal(menuItems[1].textContent, "设置回复节奏")
    const paceAction = menuItems
      .find(button => button.textContent === "设置回复节奏")
    assert.ok(paceAction)
    paceAction.click()

    const paceEditor = document.querySelector(".chat-reply-pace-editor")
    assert.ok(paceEditor)
    const selects = paceEditor.querySelectorAll(".chat-reply-pace-select")
    assert.equal(selects.length, 2)
    assert.equal(selects[0].value, "instant")
    assert.equal(selects[1].value, "delayed")

    selects[0].value = "quick"
    document.getElementById("chatReplyPaceSave").click()

    const savedChoices = draft.snapshot().phoneData.chats[0].rounds[0].messages[0].choices
    assert.equal(savedChoices[0].id, "pace-a")
    assert.equal(savedChoices[0].replyPace, "quick")
    assert.equal(savedChoices[1].replyPace, "delayed")
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
    const actionButton = overlay.querySelector("[data-chat-actions]")
    assert.equal(chatCard.dataset.chatId, maliciousChatId)
    assert.equal(actionButton.dataset.chatActions, maliciousChatId)
    assert.equal(actionButton.hasAttribute("data-pwned"), false)
    actionButton.click()
    const deleteButton = document.querySelector("[data-chat-del]")
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

test("article message modules can hide unused contacts but keep referenced contacts visible", async () => {
  const phoneData = makePhoneData()
  phoneData.contacts.push({ id:"contact-secret", name:"尚未登场", avatarUrl:"" })
  phoneData.visibleContactIds = ["contact-1", "contact-secret"]
  const fixture = await openMessageList("message-module-contact-visibility", phoneData)
  const { draft, overlay } = fixture

  try {
    overlay.querySelector("#msgTabContacts").click()

    const referenced = overlay.querySelector('[data-contact-visibility="contact-1"]')
    const unused = overlay.querySelector('[data-contact-visibility="contact-secret"]')
    assert.ok(referenced)
    assert.ok(unused)
    assert.equal(referenced.disabled, true)
    assert.match(referenced.getAttribute("title"), /剧情使用/)
    assert.equal(unused.getAttribute("aria-pressed"), "true")
    assert.match(overlay.querySelector(".message-contact-visibility-summary").textContent, /本模块可见 2 \/ 2/)

    unused.click()

    assert.deepEqual(draft.snapshot().phoneData.visibleContactIds, ["contact-1"])
    assert.equal(
      overlay.querySelector('[data-contact-visibility="contact-secret"]').getAttribute("aria-pressed"),
      "false",
    )
    assert.match(overlay.querySelector(".message-contact-visibility-summary").textContent, /本模块可见 1 \/ 2/)
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
