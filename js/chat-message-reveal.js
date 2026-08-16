export const CHAT_MESSAGE_REVEAL_MODES = Object.freeze([
  { value: "stream", label: "逐字出现" },
  { value: "instant", label: "整条出现" },
])

export function normalizeChatMessageRevealMode(value) {
  return value === "instant" ? "instant" : "stream"
}
