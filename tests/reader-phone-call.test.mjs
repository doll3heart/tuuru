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
  globalThis.Image = dom.window.Image
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function flushAsyncImageWork() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function installImageDecoder(t, { fail = false, width = 32, height = 24, controlled = false } = {}) {
  const NativeImage = globalThis.Image
  const pending = []
  globalThis.Image = class {
    constructor() {
      this.naturalWidth = width
      this.naturalHeight = height
      this.settled = false
    }
    set src(value) {
      this._src = value
      if (controlled) {
        pending.push(this)
        return
      }
      queueMicrotask(() => fail ? this.onerror?.() : this.onload?.())
    }
    get src() {
      return this._src
    }
  }
  t.after(() => { globalThis.Image = NativeImage })

  function imageAt(index) {
    const image = pending[index]
    assert.ok(image, `expected pending Image at index ${index}`)
    assert.equal(image.settled, false, `Image at index ${index} already settled`)
    image.settled = true
    return image
  }

  return {
    pending,
    succeed(index = 0, dimensions = {}) {
      const image = imageAt(index)
      image.naturalWidth = dimensions.width ?? image.naturalWidth
      image.naturalHeight = dimensions.height ?? image.naturalHeight
      image.onload?.()
    },
    reject(index = 0) {
      imageAt(index).onerror?.()
    },
  }
}

function rasterDataUrl(mime, binary) {
  return `data:${mime};base64,${Buffer.from(binary, "binary").toString("base64")}`
}

const staticPngDataUrl = rasterDataUrl("image/png", "\x89PNG\r\n\x1a\n")
const animatedCallPng = rasterDataUrl(
  "image/png",
  "\x89PNG\r\n\x1a\n\x00\x00\x00\x00acTL\x00\x00\x00\x00",
)
const animatedCallWebp = rasterDataUrl(
  "image/webp",
  "RIFF\x0c\x00\x00\x00WEBPANIM\x00\x00\x00\x00",
)
const malformedCallWebp = rasterDataUrl(
  "image/webp",
  "RIFF\x0d\x00\x00\x00WEBPVP8 \x01\x00\x00\x00x",
)

function oversizedCallPngDataUrl() {
  const bytes = Buffer.alloc((2 * 1024 * 1024) + 1)
  Buffer.from("\x89PNG\r\n\x1a\n", "binary").copy(bytes)
  return `data:image/png;base64,${bytes.toString("base64")}`
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

function callPhoneWork({ contactName = "林澈", messages, legacyMessages = [] } = {}) {
  const callMessages = messages || [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["你终于接了。", "先别挂，我有话想告诉你。"],
  }]
  return {
    schemaVersion: 1,
    id: "reader-phone-call",
    type: "phone",
    title: "Phone call",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-1", name: contactName }],
      chats: [{
        id: "chat-1",
        type: "single",
        contactIds: ["contact-1"],
        messages: legacyMessages,
        rounds: [{
          id: "round-1",
          label: "第 1 轮",
          messages: callMessages,
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

async function openFirstCall(moduleKey) {
  await import(`../reader/reader.js?${moduleKey}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  return document.querySelector(".rd-call-scene")
}

function snapshotLocalStorage() {
  const entries = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    entries.push([key, localStorage.getItem(key)])
  }
  return entries.sort(([left], [right]) => left.localeCompare(right))
}

test("reader call initially mounts only the first line and focuses a native advance button", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  const scene = await openFirstCall("reader-call-first-line")
  assert.ok(scene)
  assert.match(scene.textContent, /第一句/)
  assert.doesNotMatch(scene.outerHTML, /第二句|第三句/)
  const advance = scene.querySelector(".rd-call-advance")
  assert.equal(advance.tagName, "BUTTON")
  assert.equal(advance.type, "button")
  assert.match(advance.getAttribute("aria-label"), /下一句/)
  assert.match(scene.querySelector(".rd-call-progress").textContent, /1\s*\/\s*3/)
  assert.equal(document.activeElement, advance)
})

test("each pointer activation reveals exactly one line and preserves prior lines", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "video",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  let scene = await openFirstCall("reader-call-pointer")
  const storageBeforeAdvance = snapshotLocalStorage()
  scene.querySelector(".rd-call-advance").dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    detail: 1,
  }))
  scene = document.querySelector(".rd-call-scene")
  assert.deepEqual(
    [...scene.querySelectorAll(".rd-call-line")].map(line => line.textContent),
    ["第一句", "第二句"],
  )
  assert.equal(scene.querySelector(".rd-call-line.old").textContent, "第一句")
  assert.equal(scene.querySelector(".rd-call-line.current").textContent, "第二句")
  assert.doesNotMatch(scene.outerHTML, /第三句/)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-advance"))
  assert.deepEqual(snapshotLocalStorage(), storageBeforeAdvance)
})

test("the completed call remains visible, focuses Hang Up, and restores its card", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句"],
  }] }))

  let scene = await openFirstCall("reader-call-complete")
  scene.querySelector(".rd-call-advance").click()
  scene = document.querySelector(".rd-call-scene")
  assert.ok(scene)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.match(scene.querySelector(".rd-call-complete").textContent, /通话内容已结束/)
  const hangup = scene.querySelector(".rd-call-hangup")
  assert.equal(document.activeElement, hangup)

  hangup.click()
  assert.equal(document.querySelector(".rd-call-scene"), null)
  const card = document.querySelector('.rd-call-card[data-call-key="0-0"]')
  assert.ok(card)
  assert.equal(document.activeElement, card)
})

test("early Hang Up restores its card and reopening restarts at line one", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    callLines: ["第一句", "第二句", "第三句"],
  }] }))

  let scene = await openFirstCall("reader-call-reopen")
  scene.querySelector(".rd-call-advance").click()
  scene.querySelector(".rd-call-hangup").click()
  const card = document.querySelector('.rd-call-card[data-call-key="0-0"]')
  assert.ok(card)
  assert.equal(document.activeElement, card)

  card.click()
  scene = document.querySelector(".rd-call-scene")
  assert.match(scene.textContent, /第一句/)
  assert.doesNotMatch(scene.outerHTML, /第二句|第三句/)
})

test("legacy text calls are escaped, complete, and focus Hang Up", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "legacy-call",
    type: "call",
    callMode: "voice",
    senderId: "contact-1",
    text: '<img src=x onerror="globalThis.pwned=true">旧台词',
  }] }))

  const scene = await openFirstCall("reader-call-legacy-text")
  assert.match(scene.textContent, /<img src=x/)
  assert.equal(scene.querySelector("img[src=x]"), null)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.match(scene.querySelector(".rd-call-complete").textContent, /通话内容已结束/)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-hangup"))
})

test("empty calls show an explicit empty state and keep Hang Up available", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "empty-call",
    type: "call",
    callMode: "video",
    senderId: "contact-1",
    callLines: [null, "   "],
    text: " ",
  }] }))

  const scene = await openFirstCall("reader-call-empty")
  assert.match(scene.querySelector(".rd-call-empty").textContent, /本次通话没有台词/)
  assert.equal(scene.querySelector(".rd-call-line"), null)
  assert.equal(scene.querySelector(".rd-call-advance"), null)
  assert.equal(document.activeElement, scene.querySelector(".rd-call-hangup"))
})

test("hanging up one of several calls returns to chat instead of auto-opening the next", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({
    messages: [
      {
        id: "call-1",
        type: "call",
        callMode: "voice",
        senderId: "contact-1",
        callLines: ["第一通第一句", "第一通第二句"],
      },
      {
        id: "call-2",
        type: "call",
        callMode: "video",
        senderId: "contact-1",
        callLines: ["第二通第一句", "第二通第二句"],
      },
    ],
  }))

  let firstScene = await openFirstCall("reader-phone-multi-call")
  assert.ok(firstScene)
  assert.equal(document.querySelectorAll(".rd-call-scene").length, 1)
  assert.match(firstScene.textContent, /第一通第一句/)
  assert.doesNotMatch(firstScene.outerHTML, /第一通第二句|第二通第一句|第二通第二句/)
  firstScene.querySelector(".rd-call-advance").click()
  firstScene = document.querySelector(".rd-call-scene")
  firstScene.querySelector(".rd-call-hangup").click()

  assert.equal(document.querySelector(".rd-call-scene"), null)
  assert.ok(document.getElementById("chatMsgArea"), "hang up must visibly return to chat")

  const secondCall = document.querySelector('.rd-call-card[data-call-key="0-1"]')
  assert.ok(secondCall, "the later call should remain available from its chat card")
  secondCall.click()
  let secondScene = document.querySelector(".rd-call-scene")
  assert.equal(document.querySelectorAll(".rd-call-scene").length, 1)
  assert.match(secondScene.textContent, /第二通第一句/)
  assert.doesNotMatch(secondScene.outerHTML, /第二通第二句|第一通第一句|第一通第二句/)
  secondScene.querySelector(".rd-call-hangup").click()

  assert.equal(document.querySelector(".rd-call-scene"), null)
  const returnedSecondCall = document.querySelector('.rd-call-card[data-call-key="0-1"]')
  assert.equal(document.activeElement, returnedSecondCall)
  const firstCall = document.querySelector('.rd-call-card[data-call-key="0-0"]')
  firstCall.click()
  firstScene = document.querySelector(".rd-call-scene")
  assert.equal(document.querySelectorAll(".rd-call-scene").length, 1)
  assert.match(firstScene.textContent, /第一通第一句/)
  assert.doesNotMatch(firstScene.outerHTML, /第一通第二句|第二通第一句|第二通第二句/)
})

test("caller names stay data instead of becoming injected call-scene attributes", async t => {
  installDom(t)
  const maliciousName = '林澈" data-pwned="yes'
  seedPhoneWork(callPhoneWork({ contactName: maliciousName }))

  await import(`../reader/reader.js?reader-phone-call-attribute-safety=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const scene = document.querySelector(".rd-call-scene")
  assert.ok(scene)
  assert.match(scene.getAttribute("aria-label"), /data-pwned="yes/)
  assert.equal(scene.hasAttribute("data-pwned"), false)
})

test("voice and video calls share the safe persisted call background preset", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { messages: {
      callBackgroundType: "preset",
      callBackgroundPreset: "cream",
      callBackgroundImage: "javascript:alert(1)",
      callBackgroundCss: "persisted-unknown-css:hotpink",
    } },
  }))
  seedPhoneWork(callPhoneWork({
    messages: [
      {
        id: "voice-call",
        type: "call",
        callMode: "voice",
        senderId: "contact-1",
        callLines: ["语音台词"],
      },
      {
        id: "video-call",
        type: "call",
        callMode: "video",
        senderId: "contact-1",
        callLines: ["视频台词"],
      },
    ],
  }))

  let scene = await openFirstCall("reader-call-background-shared-preset")
  assert.equal(scene.dataset.callBackground, "cream")
  assert.doesNotMatch(scene.getAttribute("style") || "", /persisted-unknown-css/)
  scene.querySelector(".rd-call-hangup").click()

  document.querySelector('.rd-call-card[data-call-key="0-1"]').click()
  scene = document.querySelector(".rd-call-scene")
  assert.equal(scene.dataset.callBackground, "cream")
  assert.doesNotMatch(scene.getAttribute("style") || "", /persisted-unknown-css/)
})

test("corrupt phone customization shapes fall back to the plain call background", async t => {
  installDom(t)
  const corruptValues = ["bad", [], { appSettings: "bad" }]
  localStorage.setItem("moirain_phoneCustom", JSON.stringify(corruptValues[0]))
  seedPhoneWork(callPhoneWork())

  let scene = await openFirstCall("reader-call-background-corrupt-shapes")
  assert.equal(scene.dataset.callBackground, "plain")
  scene.querySelector(".rd-call-hangup").click()

  for (const value of corruptValues.slice(1)) {
    localStorage.setItem("moirain_phoneCustom", JSON.stringify(value))
    document.querySelector('.rd-call-card[data-call-key="0-0"]').click()
    scene = document.querySelector(".rd-call-scene")
    assert.equal(scene.dataset.callBackground, "plain")
    scene.querySelector(".rd-call-hangup").click()
  }
})

test("persisted call images stay preset-only until canonical current-session decode succeeds", async t => {
  installDom(t)
  const beforeRaw = JSON.stringify({
    marker: "call image raw",
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "water",
      callBackgroundImage: `  ${staticPngDataUrl}  `,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  seedPhoneWork(callPhoneWork())
  const decoder = installImageDecoder(t, { controlled: true })

  let scene = await openFirstCall("reader-call-image-pending-gate")
  assert.equal(decoder.pending.length, 1)
  assert.equal(decoder.pending[0].src, staticPngDataUrl)
  assert.equal(scene.dataset.callBackground, "water")
  assert.doesNotMatch(scene.outerHTML, /--rd-call-image|data:image/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  decoder.succeed()
  await flushAsyncImageWork()
  assert.equal(scene.dataset.callBackground, "image")
  assert.match(scene.style.getPropertyValue("--rd-call-image"), /data:image\/png;base64/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)

  scene.querySelector(".rd-call-hangup").click()
  document.querySelector('.rd-call-card[data-call-key="0-0"]').click()
  scene = document.querySelector(".rd-call-scene")
  assert.equal(decoder.pending.length, 1, "the current-session verified Set avoids another decode")
  assert.equal(scene.dataset.callBackground, "image")
  assert.match(scene.style.getPropertyValue("--rd-call-image"), /data:image\/png;base64/)
})

test("a decode tied to a disconnected call render cannot style its replacement", async t => {
  installDom(t)
  const beforeRaw = JSON.stringify({
    appSettings: { messages: {
      callBackgroundType: "image",
      callBackgroundPreset: "cream",
      callBackgroundImage: staticPngDataUrl,
    } },
  })
  localStorage.setItem("moirain_phoneCustom", beforeRaw)
  seedPhoneWork(callPhoneWork({ messages: [{
    id: "call-1",
    type: "call",
    callMode: "video",
    senderId: "contact-1",
    callLines: ["first line", "second line"],
  }] }))
  const decoder = installImageDecoder(t, { controlled: true })

  let scene = await openFirstCall("reader-call-image-stale-render")
  assert.equal(decoder.pending.length, 1)
  scene.querySelector(".rd-call-advance").click()
  scene = document.querySelector(".rd-call-scene")
  assert.equal(decoder.pending.length, 2)
  assert.equal(scene.dataset.callBackground, "cream")

  decoder.succeed(0)
  await flushAsyncImageWork()
  assert.equal(scene.dataset.callBackground, "cream")
  assert.doesNotMatch(scene.outerHTML, /--rd-call-image|data:image/)

  decoder.succeed(1)
  await flushAsyncImageWork()
  assert.equal(scene.dataset.callBackground, "image")
  assert.match(scene.style.getPropertyValue("--rd-call-image"), /data:image\/png;base64/)
  assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
})

const rejectedPersistedCallBackgrounds = [
  {
    name: "Image decode error",
    dataUrl: staticPngDataUrl,
    settle(decoder) { decoder.reject() },
  },
  {
    name: "zero naturalWidth",
    dataUrl: staticPngDataUrl,
    settle(decoder) { decoder.succeed(0, { width: 0 }) },
  },
  {
    name: "zero naturalHeight",
    dataUrl: staticPngDataUrl,
    settle(decoder) { decoder.succeed(0, { height: 0 }) },
  },
  { name: "APNG", dataUrl: animatedCallPng },
  { name: "animated WebP", dataUrl: animatedCallWebp },
  { name: "malformed WebP", dataUrl: malformedCallWebp },
  { name: "oversized PNG", dataUrl: oversizedCallPngDataUrl() },
]

for (const [index, scenario] of rejectedPersistedCallBackgrounds.entries()) {
  test(`persisted ${scenario.name} cannot block or style a ${index % 2 ? "video" : "voice"} call`, async t => {
    installDom(t)
    const beforeRaw = JSON.stringify({
      marker: scenario.name,
      appSettings: { messages: {
        callBackgroundType: "image",
        callBackgroundPreset: "cream",
        callBackgroundImage: scenario.dataUrl,
      } },
    })
    localStorage.setItem("moirain_phoneCustom", beforeRaw)
    seedPhoneWork(callPhoneWork({ messages: [{
      id: "call-1",
      type: "call",
      callMode: index % 2 ? "video" : "voice",
      senderId: "contact-1",
      callLines: ["閫氳瘽浠嶅彲浣跨敤"],
    }] }))
    const decoder = installImageDecoder(t, { controlled: true })

    const scene = await openFirstCall(`reader-call-image-reject-${index}-${Date.now()}-${Math.random()}`)
    assert.ok(scene)
    assert.equal(scene.dataset.callBackground, "cream")
    assert.doesNotMatch(scene.outerHTML, /--rd-call-image|data:image/)

    if (scenario.settle) {
      assert.equal(decoder.pending.length, 1)
      scenario.settle(decoder)
    } else {
      assert.equal(decoder.pending.length, 0, "static rejection happens before Image decode")
    }
    await flushAsyncImageWork()

    assert.equal(scene.isConnected, true)
    assert.equal(scene.dataset.callBackground, "cream")
    assert.doesNotMatch(scene.outerHTML, /--rd-call-image|data:image/)
    assert.equal(localStorage.getItem("moirain_phoneCustom"), beforeRaw)
    scene.querySelector(".rd-call-hangup").click()
    assert.ok(document.getElementById("chatMsgArea"))
  })
}

test("reader merges mixed legacy messages with existing rounds", async t => {
  installDom(t)
  seedPhoneWork(callPhoneWork({
    messages: [{
      id: "round-text",
      type: "text",
      senderId: "contact-1",
      text: "轮次里的消息",
    }],
    legacyMessages: [{
      id: "legacy-text",
      type: "text",
      senderId: "self",
      text: "旧字段里的消息",
    }],
  }))

  await import(`../reader/reader.js?reader-phone-mixed-chat=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const chat = document.getElementById("chatMsgArea")
  assert.ok(chat)
  assert.match(chat.textContent, /轮次里的消息/)
  assert.match(chat.textContent, /旧字段里的消息/)
})
