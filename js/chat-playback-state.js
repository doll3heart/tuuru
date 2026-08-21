import {
  DEFAULT_CHAT_MESSAGE_GAP_MS,
  chatMessageDelayBeforeMs,
} from "./chat-message-delay.js"
import { normalizeChatMessageRevealMode } from "./chat-message-reveal.js"

function isImmediatePlaybackItem(message) {
  if (!message || typeof message !== "object") return true
  if (message.senderId === "self") return true
  return message.type === "system-event" && message.eventKind === "typing"
}

export function chatPlaybackInitialDelayMs(message, fallbackMs = DEFAULT_CHAT_MESSAGE_GAP_MS) {
  return chatMessageDelayBeforeMs(message, isImmediatePlaybackItem(message) ? 0 : fallbackMs)
}

export function chatMessageUsesTextStream(message) {
  return Boolean(
    message
    && (!message.type || message.type === "text")
    && normalizeChatMessageRevealMode(message.revealMode) === "stream"
  )
}

export function chatTextPlaybackSnapshot(text, index = 0) {
  const characters = Array.from(String(text ?? ""))
  const parsedIndex = Number(index)
  const boundedIndex = Number.isFinite(parsedIndex)
    ? Math.max(0, Math.min(characters.length, Math.floor(parsedIndex)))
    : 0
  return {
    characters,
    index: boundedIndex,
    visibleText: characters.slice(0, boundedIndex).join(""),
    complete: boundedIndex >= characters.length,
  }
}

export function advanceChatTextPlayback(text, index = 0) {
  const current = chatTextPlaybackSnapshot(text, index)
  return chatTextPlaybackSnapshot(text, current.index + 1)
}
