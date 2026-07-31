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

function seedVoiceWork() {
  const work = {
    schemaVersion: 1,
    id: "reader-phone-voice",
    type: "phone",
    title: "Voice playback",
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
          messages: [
            { id: "voice-1", type: "voice", senderId: "contact-1", text: "第一条语音转写", duration: 1 },
            { id: "voice-2", type: "voice", senderId: "self", text: "第二条语音转写", duration: 2 },
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
        icon: "M",
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

async function openVoiceChat(t, key) {
  installDom(t)
  seedVoiceWork()
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
}

async function waitFor(check, timeoutMs = 2000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  assert.fail("timed out waiting for voice playback state")
}

test("reader voice messages expose separate playback and transcript controls", async t => {
  await openVoiceChat(t, "reader-voice-controls")

  const message = document.querySelector('[data-voice-message-id="voice-1"]')
  const playback = message.querySelector(".rd-voice-playback")
  const transcriptToggle = message.querySelector(".rd-voice-transcript-toggle")
  const transcript = message.querySelector(".rd-voice-transcript")

  assert.equal(playback.tagName, "BUTTON")
  assert.equal(playback.type, "button")
  assert.equal(playback.getAttribute("aria-pressed"), "false")
  assert.match(playback.getAttribute("aria-label"), /播放语音消息/)
  assert.equal(message.dataset.voiceStatus, "idle")
  assert.equal(transcript.hidden, true)

  transcriptToggle.click()
  assert.equal(transcriptToggle.getAttribute("aria-expanded"), "true")
  assert.equal(transcript.hidden, false)
  assert.match(transcript.textContent, /第一条语音转写/)
  assert.equal(message.dataset.voiceStatus, "idle")
})

test("reader voice playback pauses, completes, replays, and activates waveform progress", async t => {
  await openVoiceChat(t, "reader-voice-timeline")

  const message = document.querySelector('[data-voice-message-id="voice-1"]')
  const playback = message.querySelector(".rd-voice-playback")
  playback.click()

  assert.equal(message.dataset.voiceStatus, "playing")
  assert.equal(playback.getAttribute("aria-pressed"), "true")
  await waitFor(() => message.querySelectorAll(".rd-voice-bar.is-active").length > 0)

  playback.click()
  assert.equal(message.dataset.voiceStatus, "paused")
  const pausedBars = message.querySelectorAll(".rd-voice-bar.is-active").length
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(message.querySelectorAll(".rd-voice-bar.is-active").length, pausedBars)

  playback.click()
  await waitFor(() => message.dataset.voiceStatus === "completed")
  assert.equal(message.querySelector(".rd-voice-remaining").textContent, "0:00")
  assert.match(playback.getAttribute("aria-label"), /重新播放语音消息/)

  playback.click()
  assert.equal(message.dataset.voiceStatus, "playing")
  assert.notEqual(message.querySelector(".rd-voice-remaining").textContent, "0:00")
})

test("starting another voice or leaving the chat stops the current playback", async t => {
  await openVoiceChat(t, "reader-voice-stop")

  const first = document.querySelector('[data-voice-message-id="voice-1"]')
  const second = document.querySelector('[data-voice-message-id="voice-2"]')
  first.querySelector(".rd-voice-playback").click()
  await waitFor(() => first.querySelectorAll(".rd-voice-bar.is-active").length > 0)

  second.querySelector(".rd-voice-playback").click()
  assert.equal(first.dataset.voiceStatus, "idle")
  assert.equal(second.dataset.voiceStatus, "playing")

  document.getElementById("chatBack").click()
  assert.equal(document.querySelector(".rd-voice-message"), null)
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()

  const reopenedSecond = document.querySelector('[data-voice-message-id="voice-2"]')
  assert.equal(reopenedSecond.dataset.voiceStatus, "idle")
  assert.equal(reopenedSecond.querySelector(".rd-voice-remaining").textContent, "0:02")
})
