import test from "node:test"
import assert from "node:assert/strict"

import {
  dedupeForbiddenWords,
  effectiveExactForbiddenWords,
  effectiveForbiddenWords,
  filterForbiddenWords,
  matchForbiddenWord,
  parseForbiddenWords,
} from "../js/forbidden-words.js"

test("bulk forbidden words split common Chinese and keyboard separators", () => {
  assert.deepEqual(
    parseForbiddenWords("粉毛、黑龙，老公\n老婆；MOMO/momo｜白月光|替身"),
    ["粉毛", "黑龙", "老公", "老婆", "MOMO", "白月光", "替身"],
  )
  assert.deepEqual(parseForbiddenWords([" 粉毛 ", "黑龙，老公", "", null]), ["粉毛", "黑龙", "老公"])
})

test("forbidden word dedupe is stable and case-insensitive", () => {
  const input = ["粉毛", " 黑龙 ", "MOMO", "momo", "粉毛", "", 7]
  assert.deepEqual(dedupeForbiddenWords(input), ["粉毛", "黑龙", "MOMO", "7"])
  assert.deepEqual(input, ["粉毛", " 黑龙 ", "MOMO", "momo", "粉毛", "", 7])
})

test("search filters forbidden words without changing their order", () => {
  assert.deepEqual(filterForbiddenWords(["粉毛", "黑龙", "MOMO"], "毛"), ["粉毛"])
  assert.deepEqual(filterForbiddenWords(["粉毛", "黑龙", "MOMO"], "mo"), ["MOMO"])
  assert.deepEqual(filterForbiddenWords(["粉毛", "黑龙"], ""), ["粉毛", "黑龙"])
})

test("effective forbidden words merge global and placeholder-specific words", () => {
  const placeholder = { forbidden:["粉毛", "专属称呼", "momo"] }
  assert.deepEqual(
    effectiveForbiddenWords(placeholder, ["老公", "MOMO", "粉毛"]),
    ["老公", "MOMO", "粉毛", "专属称呼"],
  )
  assert.deepEqual(placeholder.forbidden, ["粉毛", "专属称呼", "momo"])
})

test("exact forbidden words merge global and placeholder-specific words", () => {
  const placeholder = { exactForbidden:["哥哥", "MOMO", "哥哥"] }
  assert.deepEqual(
    effectiveExactForbiddenWords(placeholder, ["昵称", "momo"]),
    ["昵称", "momo", "哥哥"],
  )
  assert.deepEqual(placeholder.exactForbidden, ["哥哥", "MOMO", "哥哥"])
})

test("forbidden word matching keeps substring and exact rules distinct", () => {
  const placeholder = {
    forbidden:["蠢"],
    exactForbidden:["哥哥"],
  }

  assert.deepEqual(
    matchForbiddenWord("小蠢蛋", placeholder, [], []),
    { word:"蠢", mode:"contains" },
  )
  assert.deepEqual(
    matchForbiddenWord(" 哥哥 ", placeholder, [], []),
    { word:"哥哥", mode:"exact" },
  )
  assert.equal(matchForbiddenWord("不算依赖哥哥算长大吗", placeholder, [], []), null)
  assert.equal(matchForbiddenWord("哥哥！", placeholder, [], []), null)
  assert.deepEqual(
    matchForbiddenWord("momo", {}, [], ["MOMO"]),
    { word:"MOMO", mode:"exact" },
  )
})
