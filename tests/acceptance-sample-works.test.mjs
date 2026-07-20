import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { JSDOM } from "jsdom"

import { readSteganoPayload } from "../js/stegano.js"
import { validateWorkForImport } from "../js/work-schema.js"
import { resolvePhoneReadingFlowStep } from "../js/phone-reading-flow.js"
import { decodeRgbaPng } from "../scripts/acceptance-work-assets.mjs"
import {
  ACCEPTANCE_APP_TYPES,
  ACCEPTANCE_FILES,
  buildAcceptanceWorks,
} from "../scripts/acceptance-work-fixtures.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const samplesDirectory = join(projectRoot, "samples", "acceptance")
const textDecoder = new TextDecoder()

function sorted(values) {
  return [...values].sort()
}

function embeddedPngs(value, matches = []) {
  if (typeof value === "string" && value.startsWith("data:image/png;base64,")) matches.push(value)
  else if (Array.isArray(value)) value.forEach(item => embeddedPngs(item, matches))
  else if (value && typeof value === "object") Object.values(value).forEach(item => embeddedPngs(item, matches))
  return matches
}

async function waitFor(check, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail("timed out waiting for acceptance reader state")
}

async function readArtifactPair(kind) {
  const basename = ACCEPTANCE_FILES[kind]
  const jsonText = await readFile(join(samplesDirectory, `${basename}.json`), "utf8")
  const pngBuffer = await readFile(join(samplesDirectory, `${basename}.png`))
  const decodedPng = decodeRgbaPng(pngBuffer)
  const payload = readSteganoPayload(decodedPng.rgba)
  assert.ok(payload, `${basename}.png must contain a production-readable payload`)
  return {
    jsonText,
    jsonWork: JSON.parse(jsonText),
    pngWork: JSON.parse(textDecoder.decode(payload)),
    pngDimensions: [decodedPng.width, decodedPng.height],
  }
}

test("generated JSON and PNG artifacts are deterministic production-valid work pairs", async () => {
  const expectedWorks = buildAcceptanceWorks()

  for (const kind of ["article", "phone"]) {
    const pair = await readArtifactPair(kind)
    assert.deepEqual(pair.jsonWork, expectedWorks[kind], `${kind} JSON must match its canonical builder`)
    assert.deepEqual(pair.pngWork, pair.jsonWork, `${kind} PNG must carry the same work as JSON`)
    assert.ok(pair.pngDimensions[0] <= 4096 && pair.pngDimensions[1] <= 4096)
    assert.ok(pair.pngDimensions[0] * pair.pngDimensions[1] <= 4 * 1024 * 1024)

    for (const candidate of [pair.jsonWork, pair.pngWork]) {
      const validation = validateWorkForImport(candidate)
      assert.equal(validation.ok, true, validation.message)
      assert.equal(validation.work.schemaVersion, candidate.schemaVersion)
    }
  }
})

test("article sample covers chapters, branch navigation, images, all phone modules, and watermark metadata", async () => {
  const { jsonWork: work } = await readArtifactPair("article")

  assert.equal(work.type, "article")
  assert.equal(work.chapters.length, 3)
  assert.ok(work.nodes.length >= 9)
  assert.equal(work.startNode, "start")
  assert.equal(work.locked, true)
  assert.equal(work.password, "2468")
  for (const field of ["title", "desc", "author", "authorNote", "coverColor", "createdAt"]) {
    assert.ok(work[field], `article metadata ${field} must be filled`)
  }

  const nodeIds = new Set(work.nodes.map(node => node.id))
  const chapterIds = new Set(work.chapters.map(chapter => chapter.id))
  const choiceTargets = []
  for (const node of work.nodes) {
    assert.ok(chapterIds.has(node.chapterId), `${node.id} must belong to a real chapter`)
    for (const choice of node.choices) {
      assert.ok(nodeIds.has(choice.targetId), `${choice.id} must target a real node`)
      choiceTargets.push(choice.targetId)
    }
  }
  assert.ok(work.nodes.filter(node => node.choices.length >= 2).length >= 6)
  assert.ok(work.nodes.some(node => node.id === "quiet-room" && node.choices.some(choice => choice.targetId === "platform")), "article must include a deliberate loop")
  assert.ok(choiceTargets.filter(target => target === "ending").length >= 2, "separate routes must converge on the ending")

  assert.deepEqual(sorted(work.phoneModules.map(module => module.type)), sorted(ACCEPTANCE_APP_TYPES))
  for (const module of work.phoneModules) {
    const ownerNode = work.nodes.find(node => node.id === module.nodeId)
    assert.ok(ownerNode, `${module.id} must belong to a node`)
    assert.match(ownerNode.content, new RegExp(`data-pm-id="${module.id}"`))
    assert.match(ownerNode.content, new RegExp(`data-pm-type="${module.type}"`))
  }
  const moduleCollection = {
    messages: "chats",
    forum: "forumPosts",
    memo: "memos",
    gallery: "photos",
    browser: "browserHistory",
    shopping: "shoppingItems",
    contacts: "contacts",
  }
  for (const module of work.phoneModules) {
    assert.ok(module.data[moduleCollection[module.type]].length > 0, `${module.type} module must contain visible data`)
  }

  const inlineImageCount = work.nodes.reduce((count, node) => count + (node.content.match(/<img\s/gi)?.length ?? 0), 0)
  assert.ok(inlineImageCount >= 4)
  assert.ok(embeddedPngs(work).length >= 10)
  assert.deepEqual(work.watermark, {
    enabled: true,
    kind: "text",
    text: "纯代乙向禁止偷吃 · Tuuru 验收样例",
    image: null,
    opacity: 0.14,
    coverage: "full",
    position: "bottom-right",
    pattern: "cross",
    spacing: 112,
  })
})

test("phone sample covers every exported app, authored order, settings, gates, media, and choices", async () => {
  const { jsonWork: work } = await readArtifactPair("phone")
  const phone = work.phoneData

  assert.equal(work.type, "phone")
  assert.deepEqual(sorted(phone.apps.map(app => app.type)), sorted(ACCEPTANCE_APP_TYPES))
  assert.equal(phone.apps.some(app => ["settings", "customize", "profile"].includes(app.type)), false)
  assert.deepEqual(
    [...phone.apps]
      .sort((left, right) => (left.desktopY - right.desktopY) || (left.desktopX - right.desktopX))
      .map(app => app.type),
    ["gallery", "memo", "messages", "contacts", "browser", "forum", "shopping"],
  )
  assert.equal(new Set(phone.apps.map(app => `${app.desktopX}:${app.desktopY}`)).size, phone.apps.length)
  assert.ok(phone.apps.every(app => app.enabled && app.icon.includes("<svg") && app.name))

  assert.equal(phone.skin.wallpaperType, "image")
  assert.match(phone.skin.wallpaperImage, /^data:image\/png;base64,/)
  assert.match(phone.skin.topBgImage, /^data:image\/png;base64,/)
  assert.match(phone.skin.readerAvatar, /^data:image\/png;base64,/)
  assert.equal(phone.skin.borderRadius, 30)
  assert.equal(phone.skin.iconBorderRadius, 14)
  assert.equal(phone.skin.materialOpacity, 72)
  assert.equal(phone.skin.showDynamicIsland, true)
  assert.equal(phone.skin.showHomeIndicator, true)
  assert.equal(phone.skin.showAppLabels, true)

  for (const collection of [
    "contacts",
    "chats",
    "moments",
    "forumPosts",
    "forumNpcs",
    "memos",
    "photos",
    "albums",
    "browserHistory",
    "shoppingItems",
  ]) {
    assert.ok(phone[collection].length > 0, `${collection} must contain acceptance content`)
  }

  const contactIds = new Set(phone.contacts.map(contact => contact.id))
  assert.deepEqual(sorted(Object.keys(phone.appConnections)), ["browser", "gallery", "memo", "shopping"])
  for (const connection of Object.values(phone.appConnections)) {
    assert.ok(contactIds.has(connection.contactId))
    assert.ok(connection.prompt.length > 10)
  }
  assert.equal(phone.readingFlow.enabled, true)
  assert.ok(phone.readingFlow.sequence.length >= 9)
  assert.deepEqual(phone.readingFlow.sequence.slice(0, 6).map(step => step.type), ["messages", "messages", "messages", "messages", "messages", "messages"])
  assert.equal(phone.readingFlow.sequence[5].itemId, "message-call-1")
  assert.ok(phone.readingFlow.sequence.every(step => resolvePhoneReadingFlowStep(phone, step)))
  const linChatFlow = phone.readingFlow.sequence.filter(step => step.chatId === "chat-lin").map(step => step.itemId)
  assert.deepEqual(linChatFlow, [
    "message-time-1",
    "message-text-1",
    "message-image-1",
    "message-voice-1",
    "message-choice-owner",
    "message-call-1",
  ])

  const choiceMessage = phone.chats.flatMap(chat => chat.rounds).flatMap(round => round.messages).find(message => message.id === "message-choice-owner")
  assert.equal(choiceMessage.choices.length, 3)
  assert.ok(choiceMessage.choices.every(choice => choice.replyText && choice.followUpMessages.length > 0))
  assert.ok(phone.chats.flatMap(chat => chat.rounds).flatMap(round => round.messages).some(message => message.type === "call"))
  assert.ok(phone.moments.some(moment => moment.comments.some(comment => comment.choices.length >= 2)))
  assert.ok(phone.forumPosts.some(post => post.comments.some(comment => comment.choices.length >= 2 && comment.replies.length > 0)))

  const albumIds = new Set(phone.albums.map(album => album.id))
  assert.ok(phone.photos.some(photo => photo.albumId && albumIds.has(photo.albumId)))
  assert.ok(phone.photos.some(photo => photo.albumId === null))
  assert.deepEqual(sorted(new Set(phone.shoppingItems.map(item => item.status))), ["cart", "order"])
  assert.ok(embeddedPngs(work).length >= 20)
  assert.equal(work.watermark.kind, "image")
  assert.equal(work.watermark.coverage, "full")
  assert.equal(work.watermark.pattern, "cross")
  assert.match(work.watermark.image, /^data:image\/png;base64,/)
})

test("phone sample opens every App and its authored secondary navigation in the production reader", async t => {
  const { jsonWork: work } = await readArtifactPair("phone")
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

  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?acceptance-phone=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  const desktopTypes = [...document.querySelectorAll(".phone-app-icon")].map(icon => icon.dataset.appType)
  assert.deepEqual(desktopTypes, ["gallery", "memo", "messages", "contacts", "browser", "forum", "shopping"])

  function openApp(type) {
    const icon = document.querySelector(`[data-app-type="${type}"]`)
    assert.ok(icon, `${type} icon must be reachable from the desktop`)
    icon.click()
  }

  function confirmConnection(type) {
    const gate = document.querySelector(".rd-connection-gate")
    assert.ok(gate, `${type} must show its authored connection gate`)
    gate.querySelector('[data-connection-action="confirm"]').click()
    assert.ok(document.querySelector(`.rd-phone-app-${type}`), `${type} panel must open after confirmation`)
  }

  function returnToDesktop() {
    const back = document.querySelector(".rd-back-btn")
    assert.ok(back)
    back.click()
    assert.ok(document.getElementById("phoneDesktopReader"))
  }

  openApp("gallery")
  confirmConnection("gallery")
  const album = document.querySelector(".rd-album")
  assert.ok(album)
  album.click()
  assert.ok(document.querySelector(".rd-gallery-album-back"))
  document.querySelector(".rd-gallery-album-back").click()
  returnToDesktop()

  openApp("memo")
  confirmConnection("memo")
  assert.match(document.querySelector(".phone-frame").textContent, /桌面顺序/)
  returnToDesktop()

  openApp("messages")
  assert.ok(document.getElementById("chatMsgArea"), "the first authored message step opens its chat directly")
  assert.ok(document.querySelector('[data-message-id="message-time-1"].is-flow-target'))
  assert.equal(document.querySelector('[data-message-id="message-call-1"]'), null)
  assert.equal(document.querySelector(".rd-flow-next"), null)
  await waitFor(() => document.querySelector('[data-message-id="message-text-1"].is-flow-target'))
  await waitFor(() => document.querySelector('[data-message-id="message-image-1"].is-flow-target'))
  await waitFor(() => document.querySelector('[data-message-id="message-voice-1"].is-flow-target'))
  await waitFor(() => document.querySelector('[data-message-id="message-choice-owner"].is-flow-target'))
  await waitFor(() => document.querySelector(".rd-reply-option:not([disabled])"))
  assert.equal(document.querySelectorAll(".rd-reply-option").length, 3)
  document.querySelector(".rd-reply-option").click()
  await waitFor(() => document.querySelector(".rd-call-scene"), 8000)
  assert.ok(document.querySelector(".rd-call-scene"), "the authored call opens only after earlier bubbles and the choice")
  document.querySelector(".rd-call-hangup").click()
  assert.ok(document.getElementById("phoneDesktopReader"))

  openApp("messages")
  assert.ok(document.querySelector(".rd-phone-app-messages"))
  document.querySelector('[data-message-section="moments"]').click()
  assert.ok(document.querySelector(".rd-moment-card"))
  assert.equal(document.querySelectorAll('[data-thread-scope="moment"]').length, 2)
  document.querySelector('[data-message-section="chats"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.equal(document.querySelector(".rd-call-scene"), null, "a completed call must not auto-open again")
  assert.ok(document.querySelector('[data-message-id="message-call-1"]'))
  document.getElementById("chatBack").click()
  returnToDesktop()

  openApp("contacts")
  assert.equal(document.querySelectorAll(".rd-contact-entry").length, 3)
  returnToDesktop()

  openApp("browser")
  confirmConnection("browser")
  assert.ok(document.querySelectorAll(".rd-browser-entry").length >= 3)
  returnToDesktop()

  openApp("forum")
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  assert.match(document.querySelector(".phone-frame").textContent, /完整值夜规则/)
  assert.equal(document.querySelectorAll('[data-thread-scope="forum"]').length, 2)
  document.querySelector(".rd-back-btn").click()
  returnToDesktop()

  openApp("shopping")
  confirmConnection("shopping")
  const orderTab = document.getElementById("rdShopOrderTab")
  orderTab.click()
  assert.equal(orderTab.getAttribute("aria-selected"), "true")
  assert.match(document.getElementById("rdShopOrder").textContent, /旧站纪念票/)
  returnToDesktop()
})

test("article sample unlocks, substitutes the reader name, follows a complete branch, and opens all phone modules", async t => {
  const { jsonWork: work } = await readArtifactPair("article")
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

  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?acceptance-article=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdPwdInput").value = "2468"
  document.querySelector('[data-ph-id="placeholder-name"]').value = "阿雾"
  document.getElementById("rdStartBtn").click()

  assert.match(document.querySelector(".article-content").textContent, /阿雾/)
  assert.ok(document.querySelector('.work-watermark-article[data-pattern="cross"]'))
  assert.ok(document.querySelector('.work-watermark-row[data-offset="base"]'))
  assert.ok(document.querySelector('.work-watermark-row[data-offset="staggered"]'))

  function openModule(type) {
    const trigger = document.querySelector(`.rd-pm-trigger[data-pm-type="${type}"]`)
    assert.ok(trigger, `${type} module trigger must exist on the current node`)
    trigger.click()
    const overlay = document.querySelector(".rd-pm-modal")
    assert.ok(overlay)
    assert.equal(overlay.querySelectorAll(".phone-app-icon").length, 0)
    const gate = overlay.querySelector(".rd-connection-gate")
    if (gate) gate.querySelector('[data-connection-action="confirm"]').click()
    assert.ok(overlay.querySelector(`.rd-phone-app-${type}`), `${type} module data must open in its App`)
    overlay.querySelector(".rd-back-btn").click()
    assert.equal(document.querySelector(".rd-pm-modal"), null)
  }

  function goTo(targetId) {
    const choice = document.querySelector(`.article-choice-btn[data-target="${targetId}"]`)
    assert.ok(choice, `route to ${targetId} must be available`)
    choice.click()
  }

  openModule("messages")
  goTo("inbox")
  openModule("contacts")
  goTo("quiet-room")
  openModule("memo")
  goTo("platform")
  openModule("gallery")
  goTo("forum")
  openModule("forum")
  goTo("market")
  openModule("shopping")
  openModule("browser")
  goTo("rooftop")
  goTo("ending")

  assert.match(document.querySelector(".article-reader").textContent, /这一次，你没有来迟/)
  assert.equal(document.querySelectorAll(".article-node.is-active .article-choice-btn").length, 0)
  assert.ok(document.querySelectorAll(".article-choice-btn").length > 0, "earlier choices stay available for reselecting")
})
