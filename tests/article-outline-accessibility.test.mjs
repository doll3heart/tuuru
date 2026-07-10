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

test("chapter disclosure controls one container for nodes and choices", () => {
  const root = render()
  const chapter = root.querySelector(".wt-chapter")
  const heading = chapter.querySelector(":scope > .wt-chapter-title")
  const toggle = heading.querySelector(":scope > .wt-chapter-toggle")
  const actions = heading.querySelector(":scope > .chapter-actions")
  const contentId = toggle?.getAttribute("aria-controls")
  const content = contentId ? chapter.querySelector(`#${contentId}`) : null

  assert.equal(heading.hasAttribute("data-a"), false)
  assert.equal(toggle?.tagName, "BUTTON")
  assert.equal(toggle?.type, "button")
  assert.equal(toggle?.dataset.a, "ts")
  assert.equal(toggle?.getAttribute("aria-expanded"), "true")
  assert.ok(contentId)
  assert.ok(content)
  assert.equal(content.hidden, false)
  assert.equal(content.querySelectorAll(".wt-node").length, 2)
  assert.equal(content.querySelectorAll(".wt-choice").length, 1)
  assert.ok(actions)
  assert.equal(toggle.contains(actions), false)
  assert.equal(toggle.querySelector("button,select,input"), null)
  assert.equal(toggle.querySelector(".arrow").getAttribute("aria-hidden"), "true")
  assert.equal(toggle.querySelector(".arrow").classList.contains("open"), true)
  for (const button of actions.querySelectorAll("button")) {
    assert.equal(button.type, "button")
    assert.ok(button.getAttribute("aria-label")?.trim())
  }

  const before = localStorage.getItem("tuuru_works")
  toggle.click()
  assert.equal(toggle.getAttribute("aria-expanded"), "false")
  assert.equal(content.hidden, true)
  assert.equal(toggle.querySelector(".arrow").classList.contains("open"), false)
  assert.equal(localStorage.getItem("tuuru_works"), before)

  toggle.click()
  assert.equal(toggle.getAttribute("aria-expanded"), "true")
  assert.equal(content.hidden, false)
  assert.equal(toggle.querySelector(".arrow").classList.contains("open"), true)
  assert.equal(localStorage.getItem("tuuru_works"), before)

  assert.doesNotMatch(editorSource, /<div class="wt-chapter-title" data-a="ts"/)
})

test("chapter disclosure has visible focus and a bounded coarse-pointer target", () => {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  const title = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-title")
  const toggle = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-toggle")
  const focus = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-toggle:focus-visible")
  const actionsFocusWithin = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-title:focus-within .chapter-actions")
  const hiddenContent = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-content[hidden]")
  const boundedToggle = ruleBodiesFor(bounded || "", ".world-tree .wt-chapter-toggle")

  assert.doesNotMatch(title, /cursor\s*:\s*pointer/)
  assert.match(toggle, /appearance\s*:\s*none/)
  assert.match(toggle, /background\s*:\s*transparent/)
  assert.match(toggle, /text-align\s*:\s*left/)
  assert.match(focus, /outline\s*:\s*2px\s+solid/)
  assert.match(actionsFocusWithin, /display\s*:\s*flex/)
  assert.match(hiddenContent, /display\s*:\s*none/)
  assert.match(boundedToggle, /min-height\s*:\s*44px/)
})

test("outline actions expose one named disclosure and one sibling panel per item", () => {
  const root = render()
  const nodeRows = [...root.querySelectorAll(".wt-node")]
  const chapterRows = [...root.querySelectorAll(".wt-chapter-title")]

  assert.equal(nodeRows.length, 2)
  assert.equal(chapterRows.length, 1)

  for (const row of [...nodeRows, ...chapterRows]) {
    const trigger = row.querySelector(":scope > .wt-action-disclosure")
    const panelId = trigger?.getAttribute("aria-controls")
    const panel = panelId ? row.querySelector(`:scope > #${panelId}`) : null

    assert.equal(trigger?.tagName, "BUTTON")
    assert.equal(trigger?.type, "button")
    assert.equal(trigger?.dataset.a, "outline-actions")
    assert.equal(trigger?.getAttribute("aria-expanded"), "false")
    assert.ok(trigger?.getAttribute("aria-label")?.trim())
    assert.ok(panelId)
    assert.ok(panel)
    assert.equal(panel?.classList.contains("wt-action-panel"), true)
    assert.equal(panel?.getAttribute("role"), "group")
    assert.ok(panel?.getAttribute("aria-label")?.trim())
    assert.equal(trigger?.contains(panel), false)
    assert.equal(trigger?.querySelector("button,select,input"), null)
  }

  for (const row of nodeRows) {
    const panel = row.querySelector(":scope > .node-actions")
    const controls = [...panel.querySelectorAll(":scope > select, :scope > button")]
    assert.equal(panel.querySelectorAll(':scope > select[data-a="mc"]').length, 1)
    assert.equal(panel.querySelector(':scope > select[data-a="mc"]').disabled, true)
    assert.deepEqual(
      controls.filter(control => control.tagName === "BUTTON").map(control => control.dataset.a),
      ["rn2", "up", "dn", "dl"],
    )
    for (const control of controls) {
      assert.ok(control.getAttribute("aria-label")?.trim())
      if (control.tagName === "BUTTON") assert.equal(control.type, "button")
    }
  }

  assert.equal(nodeRows[0].querySelector('[data-a="up"]').disabled, true)
  assert.equal(nodeRows[0].querySelector('[data-a="dn"]').disabled, false)
  assert.equal(nodeRows[1].querySelector('[data-a="up"]').disabled, false)
  assert.equal(nodeRows[1].querySelector('[data-a="dn"]').disabled, true)

  assert.deepEqual(
    [...chapterRows[0].querySelectorAll(":scope > .chapter-actions > button")].map(button => button.dataset.a),
    ["chapter-rename", "chapter-delete"],
  )
})

test("outline action disclosures keep exactly one item open without writing", () => {
  const root = render()
  const triggers = [...root.querySelectorAll(".wt-action-disclosure")]
  const before = localStorage.getItem("tuuru_works")

  assert.equal(triggers.length, 3)
  triggers[1].click()
  const firstPanel = document.getElementById(triggers[1].getAttribute("aria-controls"))
  assert.equal(triggers[1].getAttribute("aria-expanded"), "true")
  assert.equal(document.activeElement, firstPanel.querySelector("select:not([disabled]),button:not([disabled])"))
  assert.equal(root.querySelectorAll('.wt-action-disclosure[aria-expanded="true"]').length, 1)

  triggers[2].click()
  const secondPanel = document.getElementById(triggers[2].getAttribute("aria-controls"))
  assert.equal(triggers[1].getAttribute("aria-expanded"), "false")
  assert.equal(triggers[2].getAttribute("aria-expanded"), "true")
  assert.equal(document.activeElement, secondPanel.querySelector("select:not([disabled]),button:not([disabled])"))
  assert.equal(root.querySelectorAll('.wt-action-disclosure[aria-expanded="true"]').length, 1)

  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  assert.equal(triggers[2].getAttribute("aria-expanded"), "false")
  assert.equal(document.activeElement, triggers[2])

  triggers[1].click()
  triggers[1].click()
  assert.equal(triggers[1].getAttribute("aria-expanded"), "false")
  assert.equal(document.activeElement, triggers[1])

  triggers[1].click()
  const outside = document.createElement("button")
  outside.type = "button"
  outside.textContent = "Outside"
  document.body.appendChild(outside)
  outside.focus()
  outside.dispatchEvent(new window.Event("pointerdown", { bubbles: true }))
  assert.equal(triggers[1].getAttribute("aria-expanded"), "false")
  assert.equal(document.activeElement, outside)
  outside.remove()

  assert.equal(localStorage.getItem("tuuru_works"), before)
})

test("outline action disclosures reset across pane, refresh, and work changes", () => {
  let root = render()
  let trigger = root.querySelector(".wt-node .wt-action-disclosure")

  trigger.click()
  root.querySelector('[data-a="mobile-pane"][data-pane="outline"]').click()
  assert.equal(trigger.getAttribute("aria-expanded"), "false")

  trigger.click()
  root.querySelector('.wt-node-select[data-n="node-b"]').click()
  assert.equal(trigger.getAttribute("aria-expanded"), "false")
  root = document.getElementById("app")
  assert.equal(root.querySelectorAll('.wt-action-disclosure[aria-expanded="true"]').length, 0)

  trigger = root.querySelector(".wt-node .wt-action-disclosure")
  trigger.click()
  const otherWork = JSON.parse(JSON.stringify(work))
  otherWork.id = "outline-work-other"
  localStorage.setItem("tuuru_works", JSON.stringify({ works: [work, otherWork], contacts: [], groups: [] }))
  renderEditor(otherWork.id)
  assert.equal(trigger.getAttribute("aria-expanded"), "false")

  localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
  render()
})

test("outline rename and delete hand focus to their existing dialogs", () => {
  let root = render()
  let trigger = root.querySelector(".wt-chapter-title > .wt-action-disclosure")
  const before = localStorage.getItem("tuuru_works")

  trigger.click()
  document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="chapter-rename"]').click()
  assert.equal(trigger.getAttribute("aria-expanded"), "false")
  assert.equal(document.activeElement?.id, "pI")
  assert.notEqual(document.activeElement, trigger)
  document.getElementById("modalClose").click()
  assert.equal(document.activeElement, trigger)

  root = render()
  trigger = root.querySelector(".wt-chapter-title > .wt-action-disclosure")
  trigger.click()
  document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="chapter-delete"]').click()
  assert.equal(trigger.getAttribute("aria-expanded"), "false")
  assert.equal(document.activeElement?.id, "cN")
  assert.notEqual(document.activeElement, trigger)
  document.getElementById("cN").click()
  assert.equal(document.activeElement, trigger)

  root = render()
  trigger = root.querySelector(".wt-chapter-title > .wt-action-disclosure")
  trigger.click()
  document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="chapter-delete"]').click()
  document.getElementById("modalClose").click()
  assert.equal(document.activeElement, trigger)

  root = render()
  trigger = root.querySelector(".wt-chapter-title > .wt-action-disclosure")
  trigger.click()
  document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="chapter-delete"]').click()
  document.querySelector(".modal-overlay").click()
  assert.equal(document.activeElement, trigger)

  assert.equal(localStorage.getItem("tuuru_works"), before)
})

test("desktop outline actions regain focus after cancellation", () => {
  let root = render()
  let action = root.querySelector('.wt-chapter-title .chapter-actions [data-a="chapter-rename"]')

  action.click()
  assert.equal(document.activeElement?.id, "pI")
  document.getElementById("modalClose").click()
  assert.equal(document.activeElement, action)

  root = render()
  action = root.querySelector('.wt-chapter-title .chapter-actions [data-a="chapter-delete"]')
  action.click()
  assert.equal(document.activeElement?.id, "cN")
  document.getElementById("cN").click()
  assert.equal(document.activeElement, action)

  root = render()
  action = root.querySelector('.wt-node-select[data-n="node-a"]').closest(".wt-node").querySelector('[data-a="dl"]')
  const originalConfirm = globalThis.confirm
  const before = localStorage.getItem("tuuru_works")
  try {
    globalThis.confirm = () => false
    action.click()
    assert.equal(document.activeElement, action)
    assert.equal(localStorage.getItem("tuuru_works"), before)
  } finally {
    globalThis.confirm = originalConfirm
  }
})

test("node action panels reuse move, reorder, and delete command paths", () => {
  const originalConfirm = globalThis.confirm

  try {
    const movableWork = JSON.parse(JSON.stringify(work))
    movableWork.chapters.push({ id: "chapter-b", name: "Chapter B" })
    localStorage.setItem("tuuru_works", JSON.stringify({ works: [movableWork], contacts: [], groups: [] }))

    let root = render()
    let row = root.querySelector('.wt-node-select[data-n="node-a"]').closest(".wt-node")
    let trigger = row.querySelector(".wt-action-disclosure")
    trigger.click()
    const move = document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="mc"]')
    move.value = "chapter-b"
    move.dispatchEvent(new window.Event("change", { bubbles: true }))

    assert.equal(trigger.getAttribute("aria-expanded"), "false")
    assert.equal(
      JSON.parse(localStorage.getItem("tuuru_works")).works[0].nodes.find(node => node.id === "node-a").chapterId,
      "chapter-b",
    )
    assert.equal(document.querySelectorAll('.wt-action-disclosure[aria-expanded="true"]').length, 0)

    localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
    root = render()
    row = root.querySelector('.wt-node-select[data-n="node-b"]').closest(".wt-node")
    trigger = row.querySelector(".wt-action-disclosure")
    trigger.click()
    document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="up"]').click()

    assert.equal(trigger.getAttribute("aria-expanded"), "false")
    assert.deepEqual(
      JSON.parse(localStorage.getItem("tuuru_works")).works[0].nodes.map(node => node.id),
      ["node-b", "node-a"],
    )
    assert.equal(document.querySelectorAll('.wt-action-disclosure[aria-expanded="true"]').length, 0)

    localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
    root = render()
    row = root.querySelector('.wt-node-select[data-n="node-a"]').closest(".wt-node")
    trigger = row.querySelector(".wt-action-disclosure")
    const beforeDelete = localStorage.getItem("tuuru_works")
    globalThis.confirm = () => {
      assert.equal(trigger.getAttribute("aria-expanded"), "false")
      return false
    }
    trigger.click()
    document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="dl"]').click()

    assert.equal(trigger.getAttribute("aria-expanded"), "false")
    assert.equal(document.activeElement, trigger)
    assert.equal(localStorage.getItem("tuuru_works"), beforeDelete)

    trigger.click()
    const unavailableUp = document.getElementById(trigger.getAttribute("aria-controls")).querySelector('[data-a="up"]')
    unavailableUp.disabled = false
    unavailableUp.click()
    assert.equal(trigger.getAttribute("aria-expanded"), "false")
    assert.equal(document.activeElement, trigger)
    assert.equal(localStorage.getItem("tuuru_works"), beforeDelete)
  } finally {
    globalThis.confirm = originalConfirm
    localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
    render()
  }
})

test("outline action disclosures preserve desktop access and fit bounded touch panes", () => {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  const trigger = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-action-disclosure")
  const triggerFocus = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-action-disclosure:focus-visible")
  const desktopNodeActions = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-node:hover .node-actions")
  const desktopChapterActions = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-chapter-title:hover .chapter-actions")
  const boundedTrigger = ruleBodiesFor(bounded || "", ".world-tree .wt-action-disclosure")
  const boundedClosedNode = ruleBodiesFor(bounded || "", ".world-tree .wt-node .node-actions")
  const boundedClosedChapter = ruleBodiesFor(bounded || "", ".world-tree .wt-chapter-title .chapter-actions")
  const boundedOpenNode = ruleBodiesFor(bounded || "", '.world-tree .wt-node[data-outline-actions-open="true"] > .node-actions')
  const boundedOpenChapter = ruleBodiesFor(bounded || "", '.world-tree .wt-chapter-title[data-outline-actions-open="true"] > .chapter-actions')
  const boundedPanel = ruleBodiesFor(bounded || "", ".world-tree .wt-action-panel")
  const boundedButtons = ruleBodiesFor(bounded || "", ".world-tree .wt-action-panel > button")
  const boundedSelect = ruleBodiesFor(bounded || "", ".world-tree .wt-action-panel > select")
  const boundedMove = ruleBodiesFor(bounded || "", ".world-tree .wt-node .node-actions > .chapter-move")

  assert.match(trigger, /display\s*:\s*none/)
  assert.match(triggerFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(desktopNodeActions, /display\s*:\s*flex/)
  assert.match(desktopChapterActions, /display\s*:\s*flex/)
  assert.match(boundedTrigger, /display\s*:\s*(?:inline-)?flex/)
  assert.match(boundedTrigger, /min-width\s*:\s*44px/)
  assert.match(boundedTrigger, /min-height\s*:\s*44px/)
  assert.match(boundedClosedNode, /display\s*:\s*none/)
  assert.match(boundedClosedNode, /margin-left\s*:\s*0/)
  assert.match(boundedClosedChapter, /display\s*:\s*none/)
  assert.match(boundedOpenNode, /display\s*:\s*flex/)
  assert.match(boundedOpenChapter, /display\s*:\s*flex/)
  assert.match(boundedPanel, /width\s*:\s*100%/)
  assert.match(boundedPanel, /max-width\s*:\s*100%/)
  assert.match(boundedPanel, /flex-wrap\s*:\s*wrap/)
  assert.match(boundedButtons, /min-height\s*:\s*44px/)
  assert.match(boundedSelect, /min-height\s*:\s*44px/)
  assert.match(boundedMove, /max-width\s*:\s*100%/)
})
