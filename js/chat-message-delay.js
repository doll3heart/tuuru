export const DEFAULT_CHAT_MESSAGE_GAP_MS = 800
export const MAX_CHAT_MESSAGE_DELAY_MS = 60_000

function bounded(value) {
  return Math.round(Math.max(0, Math.min(MAX_CHAT_MESSAGE_DELAY_MS, value)))
}

export function normalizeChatMessageDelayMs(value, fallback = DEFAULT_CHAT_MESSAGE_GAP_MS) {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return bounded(parsed)
  const parsedFallback = Number(fallback)
  return Number.isFinite(parsedFallback) ? bounded(parsedFallback) : DEFAULT_CHAT_MESSAGE_GAP_MS
}

export function chatMessageDelayBeforeMs(message, fallback = DEFAULT_CHAT_MESSAGE_GAP_MS) {
  if (!message || typeof message !== "object" || !Object.hasOwn(message, "delayBeforeMs")) {
    return normalizeChatMessageDelayMs(fallback)
  }
  return normalizeChatMessageDelayMs(message.delayBeforeMs, fallback)
}

export function formatChatMessageDelaySeconds(value) {
  return (normalizeChatMessageDelayMs(value, 0) / 1000)
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, "")
}
