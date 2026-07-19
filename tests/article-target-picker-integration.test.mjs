import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/target-work",
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
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = callback => { callback(); return 1 }
globalThis.confirm = () => true
globalThis.prompt = () => null
globalThis.alert = () => {}
document.execCommand = () => true
window.matchMedia = query => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

const work = {
  id: "target-work",
  schemaVersion: 1,
  type: "article",
  title: "Targets",
  chapters: [
    { id: "chapter-a", name: "第一章" },
    { id: "chapter-b", name: "第二章" },
  ],
  scenes: [],
  placeholders: [],
  phoneModules: [],
  editorSettings: {},
  nodes: [
    {
      id: "node-a",
      title: "开场",
      content: "<p>A</p>",
      scene: "",
      chapterId: "chapter-a",
      choices: [
        { id: "choice-a", text: "原选项", targetId: "node-b", customMeta: { keep: true } },
        { id: "choice-b", text: "留下", targetId: "node-a" },
      ],
    },
    { id: "node-b", title: "相遇", content: "<p>B</p>", scene: "", chapterId: "chapter-a", choices: [] },
    { id: "node-c", title: "相遇", content: "<p>C</p>", scene: "", chapterId: "chapter-b", choices: [] },
  ],
  startNode: "node-a",
}

const { getWork } = await import("../js/data.js")
const { renderEditor } = await import("../js/pages/editor.js")

function render() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => overlay.remove())
  localStorage.setItem("tuuru_works", JSON.stringify({ works: [structuredClone(work)], contacts: [], groups: [] }))
  document.getElementById("app").innerHTML = renderEditor(work.id)
  return document.getElementById("app")
}

function openChoices() {
  if (!document.getElementById("ce_node-a")) {
    document.querySelector('.wt-node-select[data-n="node-a"]')?.click()
  }
  document.querySelector('[data-a="ch"]').click()
  return document.querySelector(".ch-panel")
}

test("choice rows show a chapter path button instead of a plain target select", () => {
  render()
  const panel = openChoices()
  const rows = [...panel.querySelectorAll(".ch-item")]

  assert.equal(rows.length, 2)
  assert.equal(panel.querySelector("select.ch-target"), null)
  assert.match(rows[0].querySelector(".ch-target-pick").textContent, /第一章\s*→\s*相遇/)
  assert.equal(rows[0].dataset.choiceId, "choice-a")
})

test("target picking happens in the outline and restores unsaved choice drafts", () => {
  render()
  let panel = openChoices()
  panel.querySelectorAll(".ch-text")[0].value = "改过但还没保存"
  panel.querySelectorAll(".ch-target-pick")[0].click()

  const outline = document.querySelector(".world-tree.target-pick-mode")
  assert.ok(outline)
  assert.ok(outline.querySelector('.target-picker-search[aria-label="搜索目标节点"]'))
  assert.equal(outline.querySelector('[data-a="target-select"][data-n="node-a"]').disabled, false)

  outline.querySelector('[data-a="target-select"][data-n="node-c"]').click()
  panel = document.querySelector(".ch-panel")
  assert.ok(panel)
  assert.equal(panel.querySelectorAll(".ch-text")[0].value, "改过但还没保存")
  assert.match(panel.querySelectorAll(".ch-target-pick")[0].textContent, /第二章\s*→\s*相遇/)
})

test("an option can target its own source node", () => {
  render()
  let panel = openChoices()
  panel.querySelectorAll(".ch-target-pick")[0].click()

  document.querySelector('[data-a="target-select"][data-n="node-a"]').click()
  panel = document.querySelector(".ch-panel")
  assert.equal(panel.querySelectorAll(".ch-target-pick")[0].dataset.targetId, "node-a")
})

test("saving choices is atomic from the editor point of view and preserves stable ids", () => {
  render()
  const panel = openChoices()
  const first = panel.querySelectorAll(".ch-item")[0]
  first.querySelector(".ch-text").value = "新的文字"
  first.querySelector(".ch-target-pick").dataset.targetId = "node-c"
  first.querySelector(".ch-target-pick").textContent = "第二章 → 相遇"
  panel.querySelector('[data-ch-a="save"]').click()

  const choices = getWork(work.id).nodes[0].choices
  assert.deepEqual(choices.map(choice => choice.id), ["choice-a", "choice-b"])
  assert.equal(choices[0].text, "新的文字")
  assert.equal(choices[0].targetId, "node-c")
  assert.deepEqual(choices[0].customMeta, { keep: true })
})

test("deleting an option group persists immediately", () => {
  render()
  const panel = openChoices()
  panel.querySelector('[data-ch-a="delete-all"]').click()
  document.getElementById("cK").click()

  assert.deepEqual(getWork(work.id).nodes[0].choices, [])
  assert.equal(document.querySelector(".ch-panel"), null)
})

test("start node uses the same searchable outline target picker", () => {
  render()
  document.querySelector('[data-a="pick-start"]').click()
  const outline = document.querySelector('.world-tree.target-pick-mode[data-target-purpose="start"]')
  assert.ok(outline)

  outline.querySelector('[data-a="target-select"][data-n="node-c"]').click()

  assert.equal(getWork(work.id).startNode, "node-c")
  assert.ok(document.querySelector('.wt-node[data-node-id="node-c"] .wt-start-badge'))
})

test("an option target can be inspected and returned from without losing drafts", () => {
  render()
  let panel = openChoices()
  panel.querySelectorAll(".ch-text")[0].value = "查看前的草稿"
  panel.querySelectorAll(".ch-target-inspect")[0].click()

  assert.ok(document.getElementById("ce_node-b"))
  const returnButton = document.querySelector('[data-a="target-return"]')
  assert.ok(returnButton)
  assert.match(returnButton.closest(".article-target-return").textContent, /第一章\s*→\s*相遇/)

  returnButton.click()
  panel = document.querySelector(".ch-panel")
  assert.ok(document.getElementById("ce_node-a"))
  assert.equal(panel.querySelectorAll(".ch-text")[0].value, "查看前的草稿")
})
