export const CHAT_FOLLOW_UP_DELIVERY_STATES = Object.freeze([
  Object.freeze({ value:"normal", label:"正常发送" }),
  Object.freeze({ value:"failed", label:"发送失败" }),
  Object.freeze({ value:"recalled", label:"发送后撤回" }),
])

const CHAT_FOLLOW_UP_DELIVERY_VALUES = new Set(
  CHAT_FOLLOW_UP_DELIVERY_STATES.map(option => option.value),
)

export function normalizeChatFollowUpDeliveryState(value) {
  return CHAT_FOLLOW_UP_DELIVERY_VALUES.has(value) ? value : "normal"
}
