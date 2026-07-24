export const DEFAULT_PHONE_DISPLAY_SETTINGS = Object.freeze({
  hideAllTimestamps: false,
})

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

export function normalizePhoneDisplaySettings(value) {
  const source = plainRecord(value)
  return {
    hideAllTimestamps: source.hideAllTimestamps === true,
  }
}

export function phoneTimestampsHidden(phoneData) {
  return normalizePhoneDisplaySettings(phoneData?.displaySettings).hideAllTimestamps
}

export function shouldShowPhoneTimestamp(phoneData, value, locallyHidden = false) {
  if (locallyHidden === true || phoneTimestampsHidden(phoneData)) return false
  return String(value ?? "").trim().length > 0
}
