import test from "node:test"
import assert from "node:assert/strict"

import {
  chatMessageDelayBeforeMs,
  formatChatMessageDelaySeconds,
  normalizeChatMessageDelayMs,
} from "../js/chat-message-delay.js"

test("message delays are exact, bounded, and retain the legacy fallback", () => {
  assert.equal(normalizeChatMessageDelayMs(1250), 1250)
  assert.equal(normalizeChatMessageDelayMs(90000), 60000)
  assert.equal(normalizeChatMessageDelayMs(-20), 0)
  assert.equal(normalizeChatMessageDelayMs("bad"), 800)
  assert.equal(chatMessageDelayBeforeMs({}, 800), 800)
  assert.equal(chatMessageDelayBeforeMs({ delayBeforeMs:0 }, 800), 0)
  assert.equal(chatMessageDelayBeforeMs({ delayBeforeMs:2350 }, 800), 2350)
  assert.equal(formatChatMessageDelaySeconds(2350), "2.35")
})
