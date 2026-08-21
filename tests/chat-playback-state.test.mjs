import test from "node:test"
import assert from "node:assert/strict"

import {
  advanceChatTextPlayback,
  chatMessageUsesTextStream,
  chatPlaybackInitialDelayMs,
  chatTextPlaybackSnapshot,
} from "../js/chat-playback-state.js"

test("initial playback delay keeps reader replies and typing presence immediate", () => {
  assert.equal(chatPlaybackInitialDelayMs({ type:"text", senderId:"self" }), 0)
  assert.equal(chatPlaybackInitialDelayMs({ type:"image", senderId:"self" }), 0)
  assert.equal(chatPlaybackInitialDelayMs({ type:"system-event", eventKind:"typing", senderId:"system" }), 0)
})

test("initial NPC and system responses use the same default delay as later messages", () => {
  assert.equal(chatPlaybackInitialDelayMs({ type:"text", senderId:"contact-1" }), 800)
  assert.equal(chatPlaybackInitialDelayMs({ type:"system", senderId:"system" }), 800)
  assert.equal(chatPlaybackInitialDelayMs({ type:"text", senderId:"contact-1", delayBeforeMs:0 }), 0)
  assert.equal(chatPlaybackInitialDelayMs({ type:"text", senderId:"contact-1", delayBeforeMs:2350 }), 2350)
})

test("authored reveal mode alone controls whether text streams", () => {
  assert.equal(chatMessageUsesTextStream({ type:"text", text:"normal" }), true)
  assert.equal(chatMessageUsesTextStream({ type:"text", text:"failed", failed:true }), true)
  assert.equal(chatMessageUsesTextStream({ type:"text", text:"whole", revealMode:"instant" }), false)
  assert.equal(chatMessageUsesTextStream({ type:"image", image:"x" }), false)
})

test("text playback snapshots clamp and resume by Unicode code point", () => {
  assert.deepEqual(chatTextPlaybackSnapshot("A🌙B", -20), {
    characters:["A", "🌙", "B"],
    index:0,
    visibleText:"",
    complete:false,
  })
  assert.deepEqual(advanceChatTextPlayback("A🌙B", 1), {
    characters:["A", "🌙", "B"],
    index:2,
    visibleText:"A🌙",
    complete:false,
  })
  assert.deepEqual(advanceChatTextPlayback("A🌙B", 3), {
    characters:["A", "🌙", "B"],
    index:3,
    visibleText:"A🌙B",
    complete:true,
  })
})
