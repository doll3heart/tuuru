import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url:"http://localhost/#/edit/inline-interactions",
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
globalThis.location = dom.window.location
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.requestAnimationFrame = callback => { callback(); return 1 }
globalThis.alert = () => {}
globalThis.confirm = () => true
globalThis.prompt = () => null
document.execCommand = () => true
window.matchMedia = query => ({
  matches:false,
  media:query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

const work = {
  id:"inline-interactions",
  schemaVersion:4,
  type:"article",
  title:"Inline",
  chapters:[{id:"chapter-a", name:"第一章"}],
  scenes:[],
  placeholders:[],
  phoneModules:[],
  interactiveScenes:[],
  editorSettings:{},
  nodes:[
    {
      id:"node-a",
      title:"开始",
      chapterId:"chapter-a",
      content:"<p>第一段</p><p>第二段</p>",
      choices:[
        {id:"branch-a", text:"前往", targetId:"node-b"},
        {id:"branch-b", text:"留下", targetId:"node-a"},
      ],
      interactionGroups:[],
    },
    {
      id:"node-b",
      title:"后续",
      chapterId:"chapter-a",
      content:"<p>后续</p>",
      choices:[],
      interactionGroups:[],
    },
  ],
  startNode:"node-a",
}

const { getWork } = await import("../js/data.js")
const { renderEditor } = await import("../js/pages/editor.js")

function render(snapshot = work) {
  document.querySelectorAll(".modal-overlay").forEach(overlay => overlay.remove())
  localStorage.setItem("tuuru_works", JSON.stringify({
    works:[structuredClone(snapshot)],
    contacts:[],
    groups:[],
  }))
  document.getElementById("app").innerHTML = renderEditor(snapshot.id)
}

function placeCaretAtEnd() {
  const editable = document.querySelector(".content-editable")
  const range = document.createRange()
  range.selectNodeContents(editable)
  range.collapse(false)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  return editable
}

test("ordinary interaction and tail branch controls are separate author actions", () => {
  render()
  assert.match(document.querySelector('[data-a="ig"]').getAttribute("aria-label"), /普通互动/)
  assert.match(document.querySelector('[data-a="ch"]').getAttribute("aria-label"), /剧情分支/)
  document.querySelector('[data-a="ch"]').click()
  const panel = document.querySelector(".ch-panel")
  assert.ok(panel)
  assert.equal(panel.querySelector("#chMode").hidden, true)
  assert.equal(panel.querySelectorAll(".ch-item").length, 2)
})

test("the SVG game shortcut opens a progressive random-game builder and inserts at the caret", () => {
  render()
  placeCaretAtEnd()
  const shortcut = document.querySelector('[data-a="game"]')
  assert.ok(shortcut)
  assert.equal(shortcut.getAttribute("title"), "小游戏")
  assert.match(shortcut.getAttribute("aria-label"), /小游戏/)
  assert.ok(shortcut.querySelector("svg"))
  const toolbarItems = Array.from(shortcut.closest(".editor-iconbar").children)
  const interactivePage = shortcut.closest(".editor-iconbar").querySelector('[data-a="is"]')
  const messageShortcut = shortcut.closest(".editor-iconbar").querySelector('[data-a="pa-msg"]')
  assert.equal(toolbarItems.indexOf(shortcut), toolbarItems.indexOf(interactivePage) + 1)
  assert.ok(toolbarItems[toolbarItems.indexOf(shortcut) + 1].classList.contains("divider"))
  assert.equal(toolbarItems.indexOf(messageShortcut), toolbarItems.indexOf(shortcut) + 2)
  shortcut.click()

  const panel = document.querySelector(".random-game-panel")
  assert.ok(panel)
  assert.equal(panel.querySelector('[data-game-type="dice"]').getAttribute("aria-pressed"), "true")
  assert.equal(panel.querySelectorAll(".random-game-outcome-row").length, 2)
  panel.querySelector("[data-game-label]").value = "命运骰"
  panel.querySelectorAll("[data-game-target]")[0].value = "node-a"
  panel.querySelectorAll("[data-game-target]")[1].value = "node-b"
  panel.querySelector('[data-game-action="save"]').click()

  const saved = getWork(work.id).nodes[0]
  assert.equal(saved.interactionGroups.length, 1)
  assert.equal(saved.interactionGroups[0].kind, "random-game")
  assert.equal(saved.interactionGroups[0].game.type, "dice")
  assert.deepEqual(saved.interactionGroups[0].choices.map(choice => choice.targetId), ["node-a", "node-b"])
  assert.match(saved.content, /data-article-interaction-group=/)
  assert.ok(document.querySelector(".article-interaction-editor-card.is-random-game"))
})

test("an ordinary group inserts at the caret and saves independently from branches", () => {
  render()
  placeCaretAtEnd()
  document.querySelector('[data-a="ig"]').click()

  const panel = document.querySelector(".interaction-group-panel")
  assert.ok(panel)
  const rows = panel.querySelectorAll(".interaction-group-choice-row")
  assert.equal(rows.length, 2)
  rows[0].querySelector("[data-interaction-choice-text]").value = "点头"
  rows[0].querySelector("[data-interaction-selected-text]").value = "你点了点头。"
  rows[1].querySelector("[data-interaction-choice-text]").value = "摇头"
  rows[1].querySelector("[data-interaction-selected-text]").value = "你摇了摇头。"
  panel.querySelector('[data-interaction-action="save"]').click()

  const saved = getWork(work.id).nodes[0]
  assert.equal(saved.interactionGroups.length, 1)
  assert.deepEqual(saved.interactionGroups[0].choices.map(choice => choice.text), ["点头", "摇头"])
  assert.deepEqual(saved.choices.map(choice => choice.id), ["branch-a", "branch-b"])
  assert.match(saved.content, /data-article-interaction-group=/)
  assert.ok(document.querySelector(".article-interaction-editor-card"))
})

test("multiple groups keep independent ids and missing markers remain recoverable", () => {
  const snapshot = structuredClone(work)
  snapshot.nodes[0].interactionGroups = [
    {id:"group-a", label:"反应", choices:[{id:"a", text:"A", selectedText:"AA"}, {id:"b", text:"B", selectedText:"BB"}]},
    {id:"group-b", label:"追问", choices:[{id:"c", text:"C", selectedText:"CC"}, {id:"d", text:"D", selectedText:"DD"}]},
  ]
  snapshot.nodes[0].content = '<p>正文</p><div class="article-interaction-anchor" data-article-interaction-group="group-a" contenteditable="false"></div>'
  render(snapshot)

  assert.equal(document.querySelectorAll(".article-interaction-editor-card").length, 1)
  const recovery = document.querySelector("[data-unplaced-interaction-group='group-b']")
  assert.ok(recovery)
  assert.match(recovery.textContent, /追问/)
})

test("authors can choose in-article filling and insert an atomic placeholder at the caret", () => {
  const snapshot = structuredClone(work)
  snapshot.placeholders = [{
    id:"cat-name",
    key:"123",
    label:"小猫的名字",
    prompt:"你想叫它什么？",
    fillMode:"landing",
    mode:"each",
    forbidden:[],
    values:[],
    default:"",
  }]
  render(snapshot)
  placeCaretAtEnd()
  document.querySelector('[data-a="ph"]').click()

  const panel = document.querySelector(".ph-panel")
  const fillMode = panel.querySelector("#ph_fill_cat-name")
  assert.ok(fillMode)
  fillMode.value = "inline"
  panel.querySelector('[data-ph-id="cat-name"] [data-ph-a="insert-inline"]').click()

  const saved = getWork(work.id)
  assert.equal(saved.placeholders[0].fillMode, "inline")
  assert.match(saved.nodes[0].content, /class="article-placeholder-anchor"/)
  assert.match(saved.nodes[0].content, /data-article-placeholder="cat-name"/)
  assert.ok(document.querySelector(".article-placeholder-editor-card"))
})

test("switching an inline placeholder back to landing removes its body marker", () => {
  const snapshot = structuredClone(work)
  snapshot.placeholders = [{
    id:"cat-name", key:"123", label:"小猫的名字", prompt:"叫什么？",
    fillMode:"inline", mode:"each", forbidden:[], values:[], default:"",
  }]
  snapshot.nodes[0].content += '<span class="article-placeholder-anchor" data-article-placeholder="cat-name" contenteditable="false"></span>'
  render(snapshot)
  document.querySelector('[data-a="ph"]').click()

  const panel = document.querySelector(".ph-panel")
  panel.querySelector("#ph_fill_cat-name").value = "landing"
  panel.querySelector('[data-ph-id="cat-name"] [data-ph-a="save"]').click()

  const saved = getWork(work.id)
  assert.equal(saved.placeholders[0].fillMode, "landing")
  assert.doesNotMatch(saved.nodes[0].content, /article-placeholder-anchor/)
  assert.equal(document.querySelector(".article-placeholder-editor-card"), null)
})
