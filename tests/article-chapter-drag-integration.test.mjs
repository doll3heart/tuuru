import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/chapter-drag-work",
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
  id: "chapter-drag-work",
  schemaVersion: 1,
  type: "article",
  title: "Chapter Drag",
  chapters: [
    { id: "chapter-a", name: "第一章", cover: "keep-a" },
    { id: "chapter-b", name: "第二章", cover: "keep-b" },
    { id: "chapter-c", name: "第三章", cover: "keep-c" },
  ],
  scenes: [],
  placeholders: [],
  phoneModules: [],
  editorSettings: {},
  nodes: [
    {
      id: "node-a",
      title: "A1",
      content: "<p>A</p>",
      scene: "",
      chapterId: "chapter-a",
      choices: [{ id: "choice-a", text: "Next", targetId: "node-c" }],
    },
    { id: "node-b", title: "B1", content: "<p>B</p>", scene: "", chapterId: "chapter-b", choices: [] },
    { id: "node-c", title: "C1", content: "<p>C</p>", scene: "", chapterId: "chapter-c", choices: [] },
  ],
  startNode: "node-a",
}

localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
localStorage.setItem("tuuru_article_editor_view", JSON.stringify({
  version: 1,
  works: {
    [work.id]: {
      nodeId: "node-b",
      collapsedChapterIds: ["chapter-b"],
      collapsedChoiceNodeIds: [],
      sidePane: "outline",
      noteSection: "outline",
    },
  },
}))

const { getWork } = await import("../js/data.js")
const { renderEditor } = await import("../js/pages/editor.js")

function render() {
  const root = document.getElementById("app")
  root.innerHTML = renderEditor(work.id)
  return root
}

function pointer(type, target, init = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    button: { value: init.button ?? 0 },
    isPrimary: { value: init.isPrimary ?? true },
  })
  target.dispatchEvent(event)
  return event
}

function chapterIds(root = document) {
  return [...root.querySelectorAll(".wt-chapter[data-chapter-id]")].map(chapter => chapter.dataset.chapterId)
}

test("whole chapters reorder by pointer and keyboard while story relationships remain intact", () => {
  let root = render()
  const handles = [...root.querySelectorAll(".wt-chapter-drag-handle")]
  assert.equal(handles.length, 3)
  for (const handle of handles) {
    assert.equal(handle.tagName, "BUTTON")
    assert.equal(handle.type, "button")
    assert.match(handle.getAttribute("aria-label"), /^拖动章节：/)
    assert.match(handle.title, /Alt/)
  }
  assert.ok(document.getElementById("ce_node-b"))
  assert.equal(root.querySelector('.wt-chapter[data-chapter-id="chapter-b"] .wt-chapter-content').hidden, true)

  const draggedHandle = root.querySelector('.wt-chapter[data-chapter-id="chapter-a"] .wt-chapter-drag-handle')
  const targetChapter = root.querySelector('.wt-chapter[data-chapter-id="chapter-c"]')
  targetChapter.getBoundingClientRect = () => ({ top: 200, bottom: 280 })
  document.elementFromPoint = () => targetChapter

  pointer("pointerdown", draggedHandle, { clientY: 20 })
  pointer("pointermove", document, { clientY: 270 })
  pointer("pointerup", document, { clientY: 270 })

  assert.deepEqual(getWork(work.id).chapters.map(chapter => chapter.id), ["chapter-b", "chapter-c", "chapter-a"])
  assert.deepEqual(chapterIds(), ["chapter-b", "chapter-c", "chapter-a"])
  assert.ok(document.getElementById("ce_node-b"))
  assert.equal(document.querySelector('.wt-chapter[data-chapter-id="chapter-b"] .wt-chapter-content').hidden, true)

  const keyboardHandle = document.querySelector('.wt-chapter[data-chapter-id="chapter-c"] .wt-chapter-drag-handle')
  keyboardHandle.dispatchEvent(new window.KeyboardEvent("keydown", {
    key: "ArrowUp",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }))

  const saved = getWork(work.id)
  assert.deepEqual(saved.chapters.map(chapter => chapter.id), ["chapter-c", "chapter-b", "chapter-a"])
  assert.deepEqual(saved.chapters.map(chapter => chapter.cover), ["keep-c", "keep-b", "keep-a"])
  assert.deepEqual(saved.nodes.map(node => [node.id, node.chapterId]), [
    ["node-a", "chapter-a"],
    ["node-b", "chapter-b"],
    ["node-c", "chapter-c"],
  ])
  assert.equal(saved.nodes[0].choices[0].id, "choice-a")
  assert.equal(saved.nodes[0].choices[0].targetId, "node-c")
  assert.equal(saved.startNode, "node-c")
  assert.equal(document.activeElement?.closest(".wt-chapter")?.dataset.chapterId, "chapter-c")

  root = render()
  assert.deepEqual(chapterIds(root), ["chapter-c", "chapter-b", "chapter-a"])
  assert.ok(document.getElementById("ce_node-b"))
  assert.equal(root.querySelector('.wt-chapter[data-chapter-id="chapter-b"] .wt-chapter-content').hidden, true)
})

test("chapter drag feedback follows the outline touch and focus contracts", () => {
  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
  assert.match(css, /\.wt-chapter-drag-handle[^{}]*\{[^{}]*touch-action\s*:\s*none/s)
  assert.match(css, /\.wt-chapter-drag-handle:focus-visible[^{}]*\{[^{}]*outline\s*:\s*2px\s+solid/s)
  assert.match(css, /\.wt-chapter\.drop-before::before/)
  assert.match(css, /\.wt-chapter\.drop-after::after/)
  assert.match(css, /@media\(pointer:coarse\)[^{]*\{[\s\S]*?\.wt-chapter-drag-handle[^{}]*\{[^{}]*min-width\s*:\s*44px/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^{]*\{[\s\S]*?\.wt-chapter/)
})
