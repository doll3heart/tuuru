import test from "node:test"
import assert from "node:assert/strict"

import {
  normalizeArticleRandomGame,
  playArticleRandomGame,
  randomIntegerInclusive,
} from "../js/article-random-game.js"

function diceGroup(overrides = {}) {
  return {
    id:"game-a",
    kind:"random-game",
    label:"命运骰",
    game:{type:"dice", sides:6, buttonLabel:"掷骰子"},
    choices:[
      {id:"low", text:"低点数", selectedText:"骰子停在低点数。", targetId:"node-low", rangeMin:1, rangeMax:3},
      {id:"high", text:"高点数", selectedText:"骰子停在高点数。", targetId:"node-high", rangeMin:4, rangeMax:6},
    ],
    ...overrides,
  }
}

test("dice games normalize complete non-overlapping ranges and preserve branch targets", () => {
  const result = normalizeArticleRandomGame(diceGroup())
  assert.equal(result.ok, true)
  assert.equal(result.group.game.type, "dice")
  assert.equal(result.group.game.sides, 6)
  assert.deepEqual(result.group.choices.map(choice => ({
    id:choice.id,
    targetId:choice.targetId,
    rangeMin:choice.rangeMin,
    rangeMax:choice.rangeMax,
  })), [
    {id:"low", targetId:"node-low", rangeMin:1, rangeMax:3},
    {id:"high", targetId:"node-high", rangeMin:4, rangeMax:6},
  ])
})

test("dice games reject gaps, overlaps, and results without a target", () => {
  const gap = diceGroup({
    choices:[
      {...diceGroup().choices[0], rangeMax:2},
      {...diceGroup().choices[1], rangeMin:4},
    ],
  })
  assert.equal(normalizeArticleRandomGame(gap).reason, "game-range-gap")

  const overlap = diceGroup({
    choices:[
      {...diceGroup().choices[0], rangeMax:4},
      {...diceGroup().choices[1], rangeMin:4},
    ],
  })
  assert.equal(normalizeArticleRandomGame(overlap).reason, "game-range-overlap")

  const missingTarget = diceGroup()
  missingTarget.choices[0].targetId = ""
  assert.equal(normalizeArticleRandomGame(missingTarget).reason, "game-target-required")
})

test("random-number and opposed-roll games resolve deterministic authored outcomes", () => {
  const numberGame = diceGroup({
    game:{type:"number", min:10, max:20, buttonLabel:"抽取数字"},
    choices:[
      {...diceGroup().choices[0], rangeMin:10, rangeMax:14},
      {...diceGroup().choices[1], rangeMin:15, rangeMax:20},
    ],
  })
  const numberResult = playArticleRandomGame(numberGame, () => 17)
  assert.equal(numberResult.choice.id, "high")
  assert.deepEqual(numberResult.roll, {type:"number", value:17})

  const versus = {
    id:"game-b",
    kind:"random-game",
    label:"和角色比大小",
    game:{type:"versus", sides:6, buttonLabel:"开始判定", opponentLabel:"林秋"},
    choices:[
      {id:"win", result:"win", text:"你赢了", selectedText:"你赢了。", targetId:"node-win"},
      {id:"draw", result:"draw", text:"平局", selectedText:"平局。", targetId:"node-draw"},
      {id:"lose", result:"lose", text:"你输了", selectedText:"你输了。", targetId:"node-lose"},
    ],
  }
  const rolls = [6, 2]
  const versusResult = playArticleRandomGame(versus, () => rolls.shift())
  assert.equal(versusResult.choice.id, "win")
  assert.deepEqual(versusResult.roll, {type:"versus", player:6, opponent:2, sides:6})
})

test("secure integer sampling stays inside inclusive bounds", () => {
  const cryptoLike = {getRandomValues(array) { array[0] = 0xffffffff; return array }}
  assert.equal(randomIntegerInclusive(3, 3, cryptoLike), 3)
  assert.throws(() => randomIntegerInclusive(4, 3, cryptoLike), /invalid-random-range/)
})
