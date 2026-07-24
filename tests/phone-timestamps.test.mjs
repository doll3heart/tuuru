import test from "node:test"
import assert from "node:assert/strict"

import {
  normalizePhoneDisplaySettings,
  phoneTimestampsHidden,
  shouldShowPhoneTimestamp,
} from "../js/phone-timestamps.js"

test("phone timestamp settings default to visible and reject non-boolean values", () => {
  assert.deepEqual(normalizePhoneDisplaySettings(), { hideAllTimestamps: false })
  assert.deepEqual(normalizePhoneDisplaySettings({ hideAllTimestamps: "true" }), { hideAllTimestamps: false })
  assert.deepEqual(normalizePhoneDisplaySettings({ hideAllTimestamps: true }), { hideAllTimestamps: true })
})

test("global timestamp hiding preserves authored values while suppressing display", () => {
  const phoneData = {
    displaySettings: { hideAllTimestamps: true },
    shoppingItems: [{ id: "order-1", time: "2026/7/24 20:30" }],
  }

  assert.equal(phoneTimestampsHidden(phoneData), true)
  assert.equal(shouldShowPhoneTimestamp(phoneData, phoneData.shoppingItems[0].time), false)
  assert.equal(phoneData.shoppingItems[0].time, "2026/7/24 20:30")
})

test("individual empty timestamps stay hidden when the global switch is off", () => {
  const phoneData = { displaySettings: { hideAllTimestamps: false } }

  assert.equal(shouldShowPhoneTimestamp(phoneData, "刚刚"), true)
  assert.equal(shouldShowPhoneTimestamp(phoneData, "   "), false)
  assert.equal(shouldShowPhoneTimestamp(phoneData, null), false)
})
