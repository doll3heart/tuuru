import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const dialogSource = await readFile(new URL("../js/pages/home-time-shift.js", import.meta.url), "utf8")
const mutationSource = await readFile(new URL("../js/home-work-mutations.js", import.meta.url), "utf8")
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("works with phone content expose bulk timestamp shifting from the work menu", () => {
  assert.match(homeSource, /批量顺延时间/)
  assert.match(homeSource, /data-work-time-shift/)
  assert.match(homeSource, /openWorkTimeShift/)
  assert.match(homeSource, /shiftHomeWorkTimes/)
})

test("the dialog previews each exact old and new timestamp before saving", () => {
  assert.match(dialogSource, /findPhoneTimeEntries/)
  assert.match(dialogSource, /shiftPhoneTimeValue/)
  assert.match(dialogSource, /workTimeShiftDays/)
  assert.match(dialogSource, /workTimeShiftHours/)
  assert.match(dialogSource, /workTimeShiftMinutes/)
  assert.match(dialogSource, /data-time-shift-match/)
  assert.match(dialogSource, /selectedMatchIds/)
  assert.match(dialogSource, /无法识别/)
  assert.match(dialogSource, /disabled/)
})

test("timestamp shifting uses the guarded home mutation and modal write state", () => {
  assert.match(mutationSource, /export async function shiftHomeWorkTimes/)
  assert.match(homeSource, /shiftTimeReliable/)
  assert.match(homeSource, /workTimeShiftConfirm/)
  assert.match(homeSource, /workTimeShiftStatus/)
})

test("timestamp preview remains usable on narrow phones", () => {
  assert.match(styles, /\.work-time-shift/)
  assert.match(styles, /\.work-time-shift-offset/)
  assert.match(styles, /\.work-time-shift-results/)
  assert.match(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*\.work-time-shift-offset\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
})
