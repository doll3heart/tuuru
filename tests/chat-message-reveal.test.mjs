import test from "node:test"
import assert from "node:assert/strict"
import {
  CHAT_MESSAGE_REVEAL_MODES,
  normalizeChatMessageRevealMode,
} from "../js/chat-message-reveal.js"

test("legacy and invalid message reveal modes keep the streamed default", () => {
  assert.equal(normalizeChatMessageRevealMode(undefined), "stream")
  assert.equal(normalizeChatMessageRevealMode("unknown"), "stream")
  assert.equal(normalizeChatMessageRevealMode("instant"), "instant")
  assert.deepEqual(CHAT_MESSAGE_REVEAL_MODES.map(option => option.value), ["stream", "instant"])
})
