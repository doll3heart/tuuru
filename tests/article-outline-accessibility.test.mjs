import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

function cssBlockAfterMarker(cssText, marker) {
  const markerIndex = cssText.indexOf(marker)
  if (markerIndex < 0) return null
  const open = cssText.indexOf("{", markerIndex + marker.length)
  if (open < 0) return null

  let depth = 0
  for (let index = open; index < cssText.length; index += 1) {
    if (cssText[index] === "{") depth += 1
    if (cssText[index] !== "}") continue
    depth -= 1
    if (depth === 0) return cssText.slice(open + 1, index)
  }
  return null
}

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/outline-work",
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
  id: "outline-work",
  schemaVersion: 1,
  type: "article",
  title: "Outline",
  chapters: [{ id: "chapter-a", name: "Chapter A" }],
  scenes: [],
  placeholders: [],
  phoneModules: [],
  editorSettings: {
    fontFamily: "var(--font)",
    fontSize: 16,
    marginTop: 24,
    marginBottom: 24,
    marginLeft: 32,
    marginRight: 32,
    letterSpacing: 0,
    lineHeight: 1.9,
    indentFirstLine: false,
    customFonts: [],
  },
  nodes: [
    {
      id: "node-a",
      title: "Opening",
      content: "<p>A</p>",
      scene: "",
      chapterId: "chapter-a",
      choices: [{ id: "choice-a", text: "Continue", targetId: "node-b" }],
    },
    {
      id: "node-b",
      title: "Ending",
      content: "<p>B</p>",
      scene: "",
      chapterId: "chapter-a",
      choices: [],
    },
  ],
  startNode: "node-a",
}

localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
const { renderEditor } = await import("../js/pages/editor.js")

function render() {
  const root = document.getElementById("app")
  root.innerHTML = renderEditor(work.id)
  return root
}

test("outline destinations render as native controls without nested actions", () => {
  const root = render()
  const rows = [...root.querySelectorAll(".wt-node")]
  const choices = [...root.querySelectorAll(".wt-choice")]

  assert.equal(rows.length, 2)
  for (const row of rows) {
    assert.equal(row.hasAttribute("data-a"), false)
    const destination = row.querySelector(":scope > .wt-node-select")
    const actions = row.querySelector(":scope > .node-actions")
    assert.equal(destination?.tagName, "BUTTON")
    assert.equal(destination?.type, "button")
    assert.equal(destination?.dataset.a, "sl")
    assert.ok(destination?.textContent.trim())
    assert.ok(actions)
    assert.equal(destination.contains(actions), false)
    assert.equal(destination.querySelector("button,select,input"), null)
  }

  assert.equal(rows[0].querySelector(".wt-node-select").getAttribute("aria-current"), "true")
  assert.equal(rows[1].querySelector(".wt-node-select").hasAttribute("aria-current"), false)
  assert.equal(choices.length, 1)
  assert.equal(choices[0].tagName, "BUTTON")
  assert.equal(choices[0].type, "button")
  assert.equal(choices[0].dataset.a, "sl")
  assert.equal(choices[0].dataset.n, "node-b")
  assert.match(choices[0].textContent, /Continue/)

  assert.doesNotMatch(editorSource, /<div class="wt-choice" data-a="sl"/)
  assert.doesNotMatch(editorSource, /<div class="wt-node[^>]*data-a="sl"/)
})

test("native node activation preserves selection behavior without a storage write", () => {
  const root = render()
  const before = localStorage.getItem("tuuru_works")
  root.querySelector('.wt-node-select[data-n="node-b"]').click()

  assert.ok(document.getElementById("ce_node-b"))
  assert.equal(localStorage.getItem("tuuru_works"), before)
})

test("native choice activation preserves destination behavior without a storage write", () => {
  let root = render()
  root.querySelector('.wt-node-select[data-n="node-a"]').click()
  root = document.getElementById("app")
  const before = localStorage.getItem("tuuru_works")
  root.querySelector('.wt-choice[data-n="node-b"]').click()

  assert.ok(document.getElementById("ce_node-b"))
  assert.equal(localStorage.getItem("tuuru_works"), before)
})

test("outline destinations have visible focus and coarse-pointer target contracts", () => {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  const nodeControl = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-node-select")
  const choiceControl = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-choice")
  const nodeFocus = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-node-select:focus-visible")
  const choiceFocus = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-choice:focus-visible")
  const actionsFocusWithin = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-node:focus-within .node-actions")
  const boundedNode = ruleBodiesFor(bounded || "", ".world-tree .wt-node-select")
  const boundedChoice = ruleBodiesFor(bounded || "", ".world-tree .wt-choice")

  assert.match(nodeControl, /appearance\s*:\s*none/)
  assert.match(nodeControl, /background\s*:\s*transparent/)
  assert.match(nodeControl, /text-align\s*:\s*left/)
  assert.match(choiceControl, /appearance\s*:\s*none/)
  assert.match(choiceControl, /width\s*:\s*100%/)
  assert.match(nodeFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(choiceFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(actionsFocusWithin, /display\s*:\s*flex/)
  assert.match(boundedNode, /min-height\s*:\s*44px/)
  assert.match(boundedChoice, /min-height\s*:\s*44px/)
})
