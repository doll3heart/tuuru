import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/drag-work",
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
  id: "drag-work",
  schemaVersion: 1,
  type: "article",
  title: "Drag",
  chapters: [
    { id: "chapter-a", name: "A" },
    { id: "chapter-b", name: "B" },
  ],
  scenes: [],
  placeholders: [],
  phoneModules: [],
  editorSettings: {},
  nodes: [
    {
      id: "node-a",
      title: "A1",
      content: "",
      scene: "",
      chapterId: "chapter-a",
      choices: [{ id: "choice-a", text: "Next", targetId: "node-b" }],
    },
    { id: "node-b", title: "A2", content: "", scene: "", chapterId: "chapter-a", choices: [] },
    { id: "node-c", title: "B1", content: "", scene: "", chapterId: "chapter-b", choices: [] },
  ],
  startNode: "node-a",
}

localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))

const { getWork } = await import("../js/data.js")
const { renderEditor } = await import("../js/pages/editor.js")

function render() {
  const root = document.getElementById("app")
  root.innerHTML = renderEditor(work.id)
  return root
}

function pointer(type, init) {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    button: { value: init.button ?? 0 },
    isPrimary: { value: init.isPrimary ?? true },
  })
  return event
}

test("outline renders a handle and explicit chapter drop zones", () => {
  const root = render()
  const rows = [...root.querySelectorAll(".wt-node[data-node-id][data-chapter-id]")]
  const handles = [...root.querySelectorAll(".wt-node-drag-handle")]
  const chapterDrops = [...root.querySelectorAll(".wt-chapter-content[data-node-drop-chapter][data-chapter-id]")]
  const collapsedChapterDrops = [...root.querySelectorAll(".wt-chapter[data-node-drop-chapter][data-chapter-id]")]

  assert.equal(rows.length, 3)
  assert.equal(handles.length, 3)
  assert.equal(chapterDrops.length, 2)
  assert.equal(collapsedChapterDrops.length, 2)
  for (const handle of handles) {
    assert.equal(handle.tagName, "BUTTON")
    assert.equal(handle.type, "button")
    assert.ok(handle.getAttribute("aria-label")?.includes("拖动"))
  }
})

test("repeated dragging moves across chapters without changing ids or links", () => {
  const root = render()
  const handle = root.querySelector('.wt-node[data-node-id="node-a"] .wt-node-drag-handle')
  const target = root.querySelector('.wt-node[data-node-id="node-c"]')
  target.getBoundingClientRect = () => ({ top: 100, bottom: 140 })
  document.elementFromPoint = () => target

  handle.dispatchEvent(pointer("pointerdown", { clientY: 10 }))
  document.dispatchEvent(pointer("pointermove", { clientY: 130 }))
  document.dispatchEvent(pointer("pointerup", { clientY: 130 }))

  const saved = getWork(work.id)
  assert.deepEqual(saved.nodes.map(node => node.id), ["node-b", "node-c", "node-a"])
  assert.equal(saved.nodes[2].chapterId, "chapter-b")
  assert.equal(saved.nodes[2].choices[0].id, "choice-a")
  assert.equal(saved.nodes[2].choices[0].targetId, "node-b")
  assert.equal(saved.startNode, "node-a")

  const secondHandle = document.querySelector('.wt-node[data-node-id="node-a"] .wt-node-drag-handle')
  const secondTarget = document.querySelector('.wt-node[data-node-id="node-b"]')
  secondTarget.getBoundingClientRect = () => ({ top: 100, bottom: 140 })
  document.elementFromPoint = () => secondTarget

  secondHandle.dispatchEvent(pointer("pointerdown", { pointerId: 2, clientY: 10 }))
  document.dispatchEvent(pointer("pointermove", { pointerId: 2, clientY: 110 }))
  document.dispatchEvent(pointer("pointerup", { pointerId: 2, clientY: 110 }))

  const savedAgain = getWork(work.id)
  assert.deepEqual(savedAgain.nodes.map(node => node.id), ["node-a", "node-b", "node-c"])
  assert.equal(savedAgain.nodes[0].chapterId, "chapter-a")
  assert.equal(savedAgain.nodes[0].choices[0].id, "choice-a")
  assert.equal(savedAgain.nodes[0].choices[0].targetId, "node-b")
  assert.equal(savedAgain.startNode, "node-a")
})

test("drag affordance is handle-only and exposes insertion feedback", () => {
  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
  assert.match(css, /\.wt-node-drag-handle[^{}]*\{[^{}]*touch-action\s*:\s*none/s)
  assert.match(css, /\.wt-node\.drop-before/)
  assert.match(css, /\.wt-node\.drop-after/)
  assert.match(css, /\.drop-inside/)
  assert.match(css, /\.wt-chapter-content\[data-node-drop-chapter\]:empty\s*\{[^}]*min-height\s*:\s*44px/s)
})

test("mobile choice rows reflow controls instead of overflowing the modal", () => {
  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
  assert.match(css, /@media\(max-width:480px\)\{[\s\S]*?\.ch-item\s*\{[^}]*grid-template-columns\s*:\s*20px minmax\(0,1fr\) auto auto/)
  assert.match(css, /@media\(max-width:480px\)\{[\s\S]*?\.ch-text\s*\{[^}]*grid-column\s*:\s*2\/-1/)
})
