import test from "node:test"
import assert from "node:assert/strict"

import {
  findPhoneTimeEntries,
  shiftPhoneTimeValue,
  shiftPhoneTimes,
} from "../js/work-time-shift.js"

function fixture() {
  return {
    id:"phone-time",
    type:"phone",
    phoneData:{
      chats:[{
        id:"chat-1",
        groupName:"夜谈",
        rounds:[{
          id:"round-1",
          messages:[
            {id:"message-1", senderId:"contact-1", time:"2026/7/22 21:30", text:"在吗"},
            {id:"message-2", type:"time", time:"23:50"},
          ],
        }],
      }],
      moments:[{
        id:"moment-1",
        time:"2026年7月23日 08:05",
        content:"早",
        comments:[{id:"comment-1", time:"昨天", content:"相对时间"}],
      }],
      forumPosts:[{id:"post-1", time:"2026-07-23 09:00:15", title:"帖子"}],
      memos:[],
      photos:[],
      browserHistory:[],
      shoppingItems:[{id:"shop-1", time:"刚刚", name:"商品"}],
    },
  }
}

test("indexes only supported visible phone time fields and reports skipped labels", () => {
  const report = findPhoneTimeEntries(fixture())
  assert.equal(report.matches.length, 4)
  assert.equal(report.skipped.length, 2)
  assert.ok(report.matches.some(match => match.value === "2026/7/22 21:30" && match.category === "消息"))
  assert.ok(report.matches.some(match => match.value === "2026年7月23日 08:05" && match.category === "动态"))
  assert.ok(report.skipped.some(match => match.value === "昨天"))
  assert.ok(report.skipped.some(match => match.value === "刚刚"))
})

test("shifts selected entries immutably and preserves their authored format", () => {
  const source = fixture()
  const report = findPhoneTimeEntries(source)
  const message = report.matches.find(match => match.value === "2026/7/22 21:30")
  const clock = report.matches.find(match => match.value === "23:50")
  const result = shiftPhoneTimes(source, {
    offsetMinutes:90,
    selectedMatchIds:[message.id, clock.id],
  })

  assert.equal(result.changed, true)
  assert.equal(result.changedCount, 2)
  assert.equal(result.work.phoneData.chats[0].rounds[0].messages[0].time, "2026/7/22 23:00")
  assert.equal(result.work.phoneData.chats[0].rounds[0].messages[1].time, "01:20")
  assert.equal(result.work.phoneData.moments[0].time, "2026年7月23日 08:05")
  assert.equal(source.phoneData.chats[0].rounds[0].messages[0].time, "2026/7/22 21:30")
})

test("handles day boundaries, leap days, seconds, and negative offsets", () => {
  assert.equal(shiftPhoneTimeValue("2024/2/28 23:30", 60), "2024/2/29 00:30")
  assert.equal(shiftPhoneTimeValue("2026-01-01 00:00:15", -1), "2025-12-31 23:59:15")
  assert.equal(shiftPhoneTimeValue("00:10:05", -30), "23:40:05")
  assert.equal(shiftPhoneTimeValue("2026年7月23日 08:05", 24 * 60), "2026年7月24日 08:05")
})

test("rejects invalid dates, guesses nothing, and treats zero/no-selection as no change", () => {
  assert.equal(shiftPhoneTimeValue("2026/2/30 12:00", 60), null)
  assert.equal(shiftPhoneTimeValue("昨天", 60), null)
  assert.equal(shiftPhoneTimeValue("25:00", 60), null)

  const source = fixture()
  assert.equal(shiftPhoneTimes(source, {offsetMinutes:0}).changed, false)
  assert.equal(shiftPhoneTimes(source, {offsetMinutes:60, selectedMatchIds:[]}).changed, false)
  assert.equal(shiftPhoneTimes(source, {offsetMinutes:60, selectedMatchIds:["missing"]}).changed, false)
})
