import test from "node:test"
import assert from "node:assert/strict"

import { splitMentionText } from "../js/mention-text.js"

test("mention parsing recognizes the longest authored name and preserves plain text", () => {
  assert.deepEqual(splitMentionText("请 @林雾助手 看看，@林雾 也来。", ["林雾", "林雾助手"]), [
    { text:"请 ", mention:false },
    { text:"@林雾助手", mention:true, name:"林雾助手" },
    { text:" 看看，", mention:false },
    { text:"@林雾", mention:true, name:"林雾" },
    { text:" 也来。", mention:false },
  ])
})

test("mention parsing leaves unknown, duplicate, and bare-at text readable", () => {
  assert.deepEqual(splitMentionText("@陌生人 @ @小白", ["小白", "小白", ""]), [
    { text:"@陌生人 @ ", mention:false },
    { text:"@小白", mention:true, name:"小白" },
  ])
})
