import test from "node:test"
import assert from "node:assert/strict"

import {
  ARTICLE_INTERACTION_MARKER_CLASS,
  articleInteractionMarkerHTML,
  articleInteractionMarkerIds,
  migrateLegacyArticleInteractions,
  normalizeArticleInteractionGroups,
  reconcileArticleInteractionGroup,
  moveArticleInteractionGroup,
} from "../js/article-interaction-group-model.js"

test("normalization preserves validated random-game rules and outcome targets", () => {
  const result = normalizeArticleInteractionGroups([{
    id:"game-a",
    kind:"random-game",
    label:"命运骰",
    game:{type:"dice", sides:6, buttonLabel:"掷骰子"},
    choices:[
      {id:"low", text:"低点数", selectedText:"失败", targetId:"node-low", rangeMin:1, rangeMax:3},
      {id:"high", text:"高点数", selectedText:"成功", targetId:"node-high", rangeMin:4, rangeMax:6},
    ],
  }])

  assert.equal(result.ok, true)
  assert.equal(result.groups[0].kind, "random-game")
  assert.equal(result.groups[0].choices[1].targetId, "node-high")
  assert.equal(result.groups[0].choices[1].rangeMin, 4)
})

test("marker HTML is atomic and marker parsing keeps exact body order", () => {
  const first = articleInteractionMarkerHTML("group-a")
  const second = articleInteractionMarkerHTML("group-b")
  assert.match(first, new RegExp(`class="${ARTICLE_INTERACTION_MARKER_CLASS}"`))
  assert.match(first, /contenteditable="false"/)
  assert.deepEqual(
    articleInteractionMarkerIds(`<p>A</p>${first}<p>B</p>${second}${first}`),
    ["group-a", "group-b", "group-a"],
  )
})

test("marker helpers reject unsafe or inexact ids", () => {
  assert.equal(articleInteractionMarkerHTML(" bad "), "")
  assert.equal(articleInteractionMarkerHTML(`bad" onclick="x`), "")
  assert.deepEqual(articleInteractionMarkerIds(`
    <div class="${ARTICLE_INTERACTION_MARKER_CLASS}" data-article-interaction-group=" bad "></div>
    <div class="${ARTICLE_INTERACTION_MARKER_CLASS}" data-article-interaction-group="good"></div>
  `), ["good"])
})

test("normalization preserves valid unknown own fields and rejects ambiguous ids", () => {
  const result = normalizeArticleInteractionGroups([
    {
      id:"group-a",
      label:"第一组",
      extra:{keep:true},
      choices:[
        {id:"choice-a", text:"点头", selectedText:"你点了点头。", extra:{keep:true}},
        {id:"choice-b", text:"摇头", selectedText:"你摇了摇头。"},
      ],
    },
  ])
  assert.equal(result.ok, true)
  assert.deepEqual(result.groups[0].extra, {keep:true})
  assert.deepEqual(result.groups[0].choices[0].extra, {keep:true})

  assert.deepEqual(normalizeArticleInteractionGroups([
    {id:"same", choices:[{id:"a", text:"A"}]},
    {id:"same", choices:[{id:"b", text:"B"}]},
  ]), {ok:false, reason:"duplicate-group-id"})
  assert.deepEqual(normalizeArticleInteractionGroups([
    {id:"one", choices:[{id:"same", text:"A"}, {id:"same", text:"B"}]},
  ]), {ok:false, reason:"duplicate-choice-id"})
})

test("legacy interaction choices become one anchored group without losing stable data", () => {
  const node = {
    id:"node-a",
    content:"<p>正文</p>",
    choices:[
      {
        id:"ordinary-a",
        mode:"interaction",
        text:"点头",
        selectedText:"你点了点头。",
        targetId:"",
        extra:{keep:true},
      },
      {id:"branch-a", text:"离开", targetId:"node-b", extra:{branch:true}},
    ],
  }
  const result = migrateLegacyArticleInteractions(node, () => "group-a")
  assert.equal(result.ok, true)
  assert.deepEqual(result.node.choices, [
    {id:"branch-a", text:"离开", targetId:"node-b", extra:{branch:true}},
  ])
  assert.equal(result.node.interactionGroups[0].id, "group-a")
  assert.equal(result.node.interactionGroups[0].legacyAdvanceOnSelect, true)
  assert.deepEqual(result.node.interactionGroups[0].choices[0], {
    id:"ordinary-a",
    text:"点头",
    selectedText:"你点了点头。",
    extra:{keep:true},
  })
  assert.deepEqual(articleInteractionMarkerIds(result.node.content), ["group-a"])
  assert.deepEqual(node.choices.map(choice => choice.id), ["ordinary-a", "branch-a"])
})

test("legacy ordinary-only choices retain their advance-on-select behavior", () => {
  const result = migrateLegacyArticleInteractions({
    id:"node-a",
    content:"",
    choices:[
      {id:"ordinary-a", mode:"interaction", text:"A", targetId:""},
      {id:"ordinary-b", mode:"interaction", text:"B", targetId:""},
    ],
  }, () => "group-a")
  assert.equal(result.ok, true)
  assert.equal(result.node.choices.length, 0)
  assert.equal(result.node.interactionGroups[0].legacyAdvanceOnSelect, true)
})

test("group reconciliation retains ids and selected copy while reordering drafts", () => {
  let nextId = 0
  const result = reconcileArticleInteractionGroup({
    id:"group-a",
    extra:{keep:true},
    choices:[
      {id:"choice-a", text:"A", selectedText:"Response A", extra:{keep:true}},
      {id:"choice-b", text:"B", selectedText:"Response B"},
    ],
  }, {
    id:"group-a",
    label:"修改后",
    choices:[
      {id:"choice-b", text:"B2", selectedText:"Response B2"},
      {text:"C", selectedText:"Response C"},
      {id:"choice-a", text:"A2", selectedText:"Response A2"},
    ],
  }, () => `choice-new-${++nextId}`)
  assert.equal(result.ok, true)
  assert.equal(result.group.id, "group-a")
  assert.deepEqual(result.group.extra, {keep:true})
  assert.deepEqual(result.group.choices.map(choice => choice.id), [
    "choice-b", "choice-new-1", "choice-a",
  ])
  assert.deepEqual(result.group.choices[2].extra, {keep:true})
})

test("moving a group is immutable and keeps its full record", () => {
  const groups = [
    {id:"a", choices:[]},
    {id:"b", choices:[], extra:{keep:true}},
    {id:"c", choices:[]},
  ]
  const moved = moveArticleInteractionGroup(groups, "b", 0)
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.groups.map(group => group.id), ["b", "a", "c"])
  assert.deepEqual(moved.groups[0].extra, {keep:true})
  assert.deepEqual(groups.map(group => group.id), ["a", "b", "c"])
})
