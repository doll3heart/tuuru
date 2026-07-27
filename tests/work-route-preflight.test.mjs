import test from "node:test"
import assert from "node:assert/strict"

import { inspectArticleRoutes } from "../js/work-route-preflight.js"

function article(overrides = {}) {
  return {
    id:"route-check",
    type:"article",
    title:"路线检查",
    chapters:[
      { id:"chapter-1", name:"第一章" },
      { id:"chapter-2", name:"第二章" },
    ],
    nodes:[],
    interactiveScenes:[],
    ...overrides,
  }
}

test("deep route inspection reports coverage, unreachable nodes, early endings, and loops", () => {
  const report = inspectArticleRoutes(article({
    nodes:[
      {
        id:"start",
        chapterId:"chapter-1",
        title:"开始",
        content:"开始",
        choices:[
          { id:"choose-left", text:"向左", targetId:"left" },
          { id:"choose-loop", text:"循环", targetId:"loop" },
          { id:"choose-ending", text:"直接结束", targetId:"ending" },
        ],
      },
      {
        id:"left",
        chapterId:"chapter-1",
        title:"提前结束",
        content:"这里停住",
        choices:[],
      },
      {
        id:"loop",
        chapterId:"chapter-1",
        title:"循环房间",
        content:"回到原处",
        choices:[{ id:"loop-again", text:"再来一次", targetId:"loop" }],
      },
      {
        id:"ending",
        chapterId:"chapter-2",
        title:"正常结尾",
        content:"结束",
        choices:[],
      },
      {
        id:"orphan",
        chapterId:"chapter-2",
        title:"孤立内容",
        content:"没人能看到",
        choices:[{ id:"orphan-choice", text:"孤立选项", targetId:"orphan" }],
      },
    ],
  }))

  assert.deepEqual(report.summary, {
    totalNodes:5,
    reachableNodes:4,
    totalChoices:5,
    reachableChoices:4,
  })
  assert.deepEqual(
    report.issues.map(issue => [issue.code, issue.nodeId]),
    [
      ["route-node-unreachable", "orphan"],
      ["route-node-early-end", "left"],
      ["route-cycle", "loop"],
    ],
  )
  assert.ok(report.issues.every(issue => issue.level === "warning"))
})

test("deep route inspection follows automatic chapter flow and interactive-picture exits", () => {
  const report = inspectArticleRoutes(article({
    nodes:[
      { id:"start", chapterId:"chapter-1", title:"开始", content:"", choices:[] },
      {
        id:"scene-node",
        chapterId:"chapter-1",
        title:"互动图片",
        kind:"interactive-scene",
        interactiveSceneId:"scene-1",
        choices:[],
      },
      { id:"ending", chapterId:"chapter-2", title:"结尾", content:"结束", choices:[] },
    ],
    interactiveScenes:[
      { id:"scene-1", nodeId:"scene-node", nextNodeId:"ending", stages:[] },
    ],
  }))

  assert.deepEqual(report.summary, {
    totalNodes:3,
    reachableNodes:3,
    totalChoices:0,
    reachableChoices:0,
  })
  assert.deepEqual(report.issues, [])
})

test("deep route inspection identifies a condition that requires conflicting choices", () => {
  const report = inspectArticleRoutes(article({
    chapters:[{ id:"chapter-1", name:"第一章" }],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-1",
        title:"开始",
        content:"开始",
        choices:[
          { id:"route-a", text:"选择 A", targetId:"ending" },
          { id:"route-b", text:"选择 B", targetId:"ending" },
        ],
      },
      {
        id:"hidden",
        kind:"conditional",
        chapterId:"chapter-1",
        title:"不可能出现",
        content:"隐藏",
        displayCondition:{
          all:[
            { anyChoiceIds:["route-a"] },
            { anyChoiceIds:["route-b"] },
          ],
        },
        choices:[],
      },
      { id:"ending", chapterId:"chapter-1", title:"结尾", content:"结束", choices:[] },
    ],
  }))

  assert.deepEqual(
    report.issues.map(issue => [issue.code, issue.nodeId]),
    [["conditional-condition-impossible", "hidden"]],
  )
})

test("hidden conditions cannot rely only on choices from unreachable nodes", () => {
  const report = inspectArticleRoutes(article({
    chapters:[{ id:"chapter-1", name:"第一章" }],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-1",
        title:"开始",
        content:"开始",
        choices:[{ id:"finish", text:"结束", targetId:"ending" }],
      },
      {
        id:"orphan",
        chapterId:"chapter-1",
        title:"孤立分支",
        content:"孤立",
        choices:[{ id:"orphan-choice", text:"秘密选择", targetId:"orphan" }],
      },
      {
        id:"hidden",
        kind:"conditional",
        chapterId:"chapter-1",
        title:"无法出现",
        content:"隐藏",
        displayCondition:{ all:[{ anyChoiceIds:["orphan-choice"] }] },
        choices:[],
      },
      { id:"ending", chapterId:"chapter-1", title:"结尾", content:"结束", choices:[] },
    ],
  }))

  assert.ok(report.issues.some(issue => (
    issue.code === "conditional-condition-impossible" && issue.nodeId === "hidden"
  )))
})

test("deep route inspection fails safely for unsupported or empty works", () => {
  assert.deepEqual(inspectArticleRoutes({ type:"phone" }), {
    supported:false,
    summary:{ totalNodes:0, reachableNodes:0, totalChoices:0, reachableChoices:0 },
    issues:[],
  })
  assert.deepEqual(inspectArticleRoutes({ type:"article", nodes:[] }).summary, {
    totalNodes:0,
    reachableNodes:0,
    totalChoices:0,
    reachableChoices:0,
  })
})
