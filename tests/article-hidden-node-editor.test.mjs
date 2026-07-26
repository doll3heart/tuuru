import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/hidden-editor-work",
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

const baseWork = {
  id: "hidden-editor-work",
  schemaVersion: 3,
  type: "article",
  title: "Hidden editor",
  chapters: [{ id: "chapter-one", name: "约会" }],
  scenes: [],
  placeholders: [],
  phoneModules: [],
  editorSettings: {},
  startNode: "source",
  nodes: [
    {
      id: "source",
      title: "牵手问题",
      chapterId: "chapter-one",
      scene: "",
      content: "<p>问题</p>",
      choices: [
        { id: "choice-agree", text: "同意牵手", targetId: "target" },
        { id: "choice-refuse", mode: "interaction", text: "拒绝牵手", selectedText: "你拒绝了。", targetId: "" },
      ],
    },
    {
      id: "target",
      title: "后续",
      chapterId: "chapter-one",
      scene: "",
      content: "<p>后续</p>",
      choices: [],
    },
  ],
}

localStorage.setItem("tuuru_works", JSON.stringify({ works: [baseWork], contacts: [], groups: [] }))
const { getWork, deleteChoice } = await import("../js/data.js")
const { renderEditor } = await import("../js/pages/editor.js")

function render() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => overlay.remove())
  document.getElementById("app").innerHTML = renderEditor(baseWork.id)
  return document.getElementById("app")
}

test("authors create a hidden paragraph node with a badge and guarded tools", () => {
  const root = render()
  const chapterAction = root.querySelector('[data-a="chapter-add-conditional"]')
  assert.ok(chapterAction)
  assert.equal(chapterAction.getAttribute("aria-label"), "在本章添加隐藏节点")

  chapterAction.click()
  const created = getWork(baseWork.id).nodes.find(node => node.kind === "conditional")
  assert.ok(created)
  assert.deepEqual(created.displayCondition, { all: [] })
  assert.deepEqual(created.choices, [])

  const createdRow = document.querySelector(`.wt-node[data-node-id="${created.id}"]`)
  assert.match(createdRow.textContent, /隐藏/)
  assert.ok(document.querySelector('[data-a="edit-display-condition"]'))
  assert.equal(document.querySelector('[data-a="ch"]'), null)
  assert.equal(document.querySelector('[data-a="is"]'), null)
})

test("condition editor saves AND-of-OR stable choice ids and warns on deleted references", () => {
  const created = getWork(baseWork.id).nodes.find(node => node.kind === "conditional")
  assert.ok(created)
  document.querySelector('[data-a="edit-display-condition"]').click()

  let panel = document.querySelector(".condition-panel")
  assert.ok(panel)
  assert.match(panel.textContent, /以下条件全部满足时显示/)
  assert.match(panel.textContent, /任一项（或）/)
  assert.equal(panel.querySelectorAll(".condition-group-index").length, 1)
  assert.match(panel.querySelector("[data-condition-selected-count]").textContent, /0 项/)

  const firstSearch = panel.querySelector('.condition-group input[type="search"]')
  firstSearch.value = "同意牵手"
  firstSearch.dispatchEvent(new Event("input", { bubbles: true }))
  panel.querySelector('[data-condition-a="add-choice"][data-choice-id="choice-agree"]').click()

  panel.querySelector('[data-condition-a="add-group"]').click()
  panel = document.querySelector(".condition-panel")
  const groups = [...panel.querySelectorAll(".condition-group")]
  assert.equal(groups.length, 2)
  assert.equal(panel.querySelectorAll(".condition-group-index").length, 2)
  assert.match(panel.querySelector(".condition-group-join").textContent, /并且/)
  const secondSearch = groups[1].querySelector('input[type="search"]')
  secondSearch.value = "choice-refuse"
  secondSearch.dispatchEvent(new Event("input", { bubbles: true }))
  groups[1].querySelector('[data-condition-a="add-choice"][data-choice-id="choice-refuse"]').click()

  panel.querySelector('[data-condition-a="save"]').click()
  assert.deepEqual(getWork(baseWork.id).nodes.find(node => node.id === created.id).displayCondition, {
    all: [
      { anyChoiceIds: ["choice-agree"] },
      { anyChoiceIds: ["choice-refuse"] },
    ],
  })
  assert.match(document.querySelector(`.wt-node[data-node-id="${created.id}"]`).textContent, /且/)

  deleteChoice(baseWork.id, "source", "choice-refuse")
  render()
  document.querySelector('[data-a="edit-display-condition"]').click()
  panel = document.querySelector(".condition-panel")
  assert.match(panel.textContent, /条件已失效/)
  assert.match(panel.textContent, /choice-refuse/)
})

test("conditional nodes are disabled in branch target pickers", () => {
  render()
  const created = getWork(baseWork.id).nodes.find(node => node.kind === "conditional")
  assert.equal(document.querySelector('[data-a="pick-start"]'), null)
  document.querySelector('.wt-node-select[data-n="source"]').click()
  document.querySelector('[data-a="ch"]').click()
  document.querySelector('[data-ch-a="pick-target"]').click()
  const conditionalTarget = document.querySelector(`.wt-node[data-node-id="${created.id}"] [data-a="target-select"]`)
  assert.equal(conditionalTarget.disabled, true)
})
