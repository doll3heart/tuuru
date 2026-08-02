import test from "node:test"
import assert from "node:assert/strict"

import { phoneWidgetSystemSnapshot } from "../reader/phone-widget-time.js"

test("phone widget time uses the device-local calendar and a 24-hour clock", () => {
  const now = new Date(2026, 7, 2, 9, 5, 33)
  const snapshot = phoneWidgetSystemSnapshot(now)

  assert.deepEqual(snapshot, {
    day:"02",
    month:"AUGUST",
    monthDay:"08 · 02",
    weekday:"星期日",
    time:"09:05",
    weekdayTime:"星期日 · 09:05",
    countdownDays:"",
  })
})

test("countdown follows the local day boundary and stays blank without a valid reader target", () => {
  const now = new Date(2026, 7, 2, 23, 59, 59)

  assert.equal(phoneWidgetSystemSnapshot(now, "2026-08-05T18:30").countdownDays, "3")
  assert.equal(phoneWidgetSystemSnapshot(now, "2026-08-02T08:00").countdownDays, "0")
  assert.equal(phoneWidgetSystemSnapshot(now, "").countdownDays, "")
  assert.equal(phoneWidgetSystemSnapshot(now, "not-a-date").countdownDays, "")
})
