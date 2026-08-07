export const CHAT_REPLY_PACES = Object.freeze([
  Object.freeze({ value:"instant", label:"直接出现", durationMs:0 }),
  Object.freeze({ value:"quick", label:"很快回复", durationMs:700 }),
  Object.freeze({ value:"normal", label:"正在输入后回复", durationMs:1600 }),
  Object.freeze({ value:"delayed", label:"稍后回复", durationMs:4200 }),
])

const CHAT_REPLY_PACE_VALUES = new Set(CHAT_REPLY_PACES.map(option => option.value))

export function normalizeChatReplyPace(value, fallback = "instant") {
  if (CHAT_REPLY_PACE_VALUES.has(value)) return value
  return CHAT_REPLY_PACE_VALUES.has(fallback) ? fallback : "instant"
}

export function chatReplyTypingDuration(value) {
  const pace = CHAT_REPLY_PACES.find(option => option.value === normalizeChatReplyPace(value))
  return pace ? pace.durationMs : 0
}
