import test from "node:test"
import assert from "node:assert/strict"
import {
  compareReaderSlots,
  readerJourneyDirectory,
  readerUnlockedMemoir,
} from "../reader/reader-journey-insights.js"

function branchedWork() {
  return {
    type:"article",
    chapters:[
      { id:"chapter-1", name:"第一章" },
      { id:"chapter-2", name:"第二章" },
    ],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-1",
        title:"岔路",
        choices:[
          { id:"left", text:"走向灯塔", targetId:"lighthouse" },
          { id:"right", text:"留在车站", targetId:"station" },
        ],
        interactionGroups:[{
          id:"inspect",
          choices:[
            { id:"inspect-clock", text:"检查停住的钟", selectedText:"指针停在二十三点十七分。" },
            { id:"inspect-letter", text:"拆开来信", selectedText:"信纸上没有署名。" },
          ],
        }],
      },
      { id:"lighthouse", chapterId:"chapter-2", title:"灯塔", choices:[] },
      { id:"station", chapterId:"chapter-2", title:"车站", choices:[] },
      { id:"secret", chapterId:"chapter-2", title:"未解锁密室", choices:[] },
    ],
  }
}

function slot(path, choiceId) {
  return {
    id:`slot-${choiceId}`,
    name:"",
    progress:{
      kind:"article",
      path,
      choiceMemory:{ start:choiceId },
      interactionSelections:{},
      checkpoints:[],
    },
  }
}

test("memoir reveals only visited locations and selected choice text", () => {
  const memoir = readerUnlockedMemoir(branchedWork(), slot(["start", "lighthouse"], "left"))
  assert.deepEqual(memoir, [
    {
      nodeId:"start",
      chapterId:"chapter-1",
      chapterTitle:"第一章",
      title:"岔路",
      choiceText:"走向灯塔",
    },
    {
      nodeId:"lighthouse",
      chapterId:"chapter-2",
      chapterTitle:"第二章",
      title:"灯塔",
      choiceText:"",
    },
  ])
  assert.equal(JSON.stringify(memoir).includes("车站"), false)
  assert.equal(JSON.stringify(memoir).includes("未解锁密室"), false)
})

test("interactive directory preserves visited route order and exposes only recorded decisions", () => {
  const work = branchedWork()
  const readerSlot = slot(["start", "lighthouse", "start"], "left")
  readerSlot.progress.interactionSelections = {
    inspect:{nodeId:"start", choiceId:"inspect-clock"},
    forged:{nodeId:"secret", choiceId:"inspect-letter"},
  }

  const directory = readerJourneyDirectory(work, readerSlot)

  assert.deepEqual(directory.map(entry => entry.nodeId), ["start", "lighthouse", "start"])
  assert.deepEqual(directory.map(entry => entry.pathIndex), [0, 1, 2])
  assert.deepEqual(directory[0].decisions, [
    {kind:"branch", label:"走向灯塔"},
    {kind:"interaction", label:"检查停住的钟"},
  ])
  assert.deepEqual(directory[1].decisions, [])
  assert.deepEqual(directory[2].decisions, directory[0].decisions)
  assert.equal(JSON.stringify(directory).includes("留在车站"), false)
  assert.equal(JSON.stringify(directory).includes("拆开来信"), false)
  assert.equal(JSON.stringify(directory).includes("未解锁密室"), false)
})

test("route comparison reports only visited divergent selections", () => {
  const left = slot(["start", "lighthouse"], "left")
  const right = slot(["start", "station"], "right")
  assert.deepEqual(compareReaderSlots(branchedWork(), left, right), [{
    nodeId:"start",
    location:"第一章 · 岔路",
    leftText:"走向灯塔",
    rightText:"留在车站",
  }])

  const forged = {
    ...right,
    progress:{
      ...right.progress,
      path:["station"],
      choiceMemory:{ start:"right" },
    },
  }
  assert.deepEqual(compareReaderSlots(branchedWork(), left, forged), [])
  assert.deepEqual(compareReaderSlots(branchedWork(), left, left), [])
})

test("phone and malformed progress produce no article journey insights", () => {
  assert.deepEqual(readerUnlockedMemoir({ type:"phone" }, slot(["start"], "left")), [])
  assert.deepEqual(readerUnlockedMemoir(branchedWork(), { progress:null }), [])
  assert.deepEqual(compareReaderSlots(branchedWork(), { progress:null }, slot(["start"], "left")), [])
})
