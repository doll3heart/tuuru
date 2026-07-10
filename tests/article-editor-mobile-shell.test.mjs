import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const MOBILE_QUERY = "(max-width: 480px), (max-height: 480px) and (pointer: coarse)"

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

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "http://localhost/#/edit/test",
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
  matches: query === MOBILE_QUERY,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() { return true },
})

const editorModulePromise = import("../js/pages/editor.js")

function settings() {
  return {
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
  }
}

function node(id, chapterId, choices = []) {
  return {
    id,
    title: `Node ${id}`,
    content: `<p>${id}</p>`,
    choices,
    scene: "",
    chapterId,
  }
}

function article(id, nodeDefs) {
  const chapterId = `${id}-chapter`
  return {
    id,
    schemaVersion: 1,
    type: "article",
    title: id,
    nodes: nodeDefs.map(def => node(def.id, chapterId, def.choices || [])),
    chapters: [{ id: chapterId, name: "Chapter" }],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    editorSettings: settings(),
    startNode: nodeDefs[0]?.id || "",
  }
}

function seed(...works) {
  localStorage.setItem("tuuru_works", JSON.stringify({ works, contacts: [], groups: [] }))
  document.getElementById("app").replaceChildren()
}

async function render(workId) {
  const { renderEditor } = await editorModulePromise
  const root = document.getElementById("app")
  root.innerHTML = renderEditor(workId)
  return root
}

function paneButton(pane) {
  return document.getElementById("app").querySelector(`[data-a="mobile-pane"][data-pane="${pane}"]`)
}

test("the pane helper updates state without replacing editor content", async () => {
  const { applyEditorMobilePane } = await import("../js/editor-mobile-pane.js")
  const root = document.createElement("div")
  root.className = "editor-body-area"
  root.dataset.mobilePane = "editor"
  root.innerHTML = `
    <div class="editor-mobile-view-switch">
      <button data-a="mobile-pane" data-pane="editor" aria-pressed="true"></button>
      <button data-a="mobile-pane" data-pane="outline" aria-pressed="false"></button>
    </div>
    <div id="articleEditorPane"><div id="draft" contenteditable="true">draft</div></div>
    <div id="articleOutlinePane"></div>`
  const draft = root.querySelector("#draft")

  assert.equal(applyEditorMobilePane(root, "outline"), true)
  assert.equal(root.dataset.mobilePane, "outline")
  assert.equal(root.querySelector('[data-pane="editor"]').getAttribute("aria-pressed"), "false")
  assert.equal(root.querySelector('[data-pane="outline"]').getAttribute("aria-pressed"), "true")
  assert.equal(root.querySelector("#draft"), draft)

  const snapshot = root.innerHTML
  assert.equal(applyEditorMobilePane(root, "invalid"), false)
  assert.equal(root.innerHTML, snapshot)

  const helperSource = readFileSync(new URL("../js/editor-mobile-pane.js", import.meta.url), "utf8")
  assert.doesNotMatch(helperSource, /innerHTML|outerHTML|replaceChildren|localStorage|sessionStorage|location|history/)
})

test("rendered mobile view controls switch panes in place without a storage write", async () => {
  const work = article("switch-work", [{ id: "switch-node" }])
  seed(work)
  const root = await render(work.id)
  const shell = root.querySelector(".editor-body-area")
  const editable = root.querySelector(".content-editable")
  const editorButton = paneButton("editor")
  const outlineButton = paneButton("outline")

  assert.ok(shell)
  assert.equal(shell.dataset.mobilePane, "editor")
  assert.equal(editorButton?.tagName, "BUTTON")
  assert.equal(editorButton?.type, "button")
  assert.equal(editorButton?.textContent.trim(), "正文")
  assert.equal(editorButton?.getAttribute("aria-controls"), "articleEditorPane")
  assert.equal(outlineButton?.textContent.trim(), "大纲")
  assert.equal(outlineButton?.getAttribute("aria-controls"), "articleOutlinePane")

  const beforeStorage = localStorage.getItem("tuuru_works")
  const beforeHash = location.hash
  outlineButton.click()

  assert.equal(shell.dataset.mobilePane, "outline")
  assert.equal(paneButton("editor").getAttribute("aria-pressed"), "false")
  assert.equal(paneButton("outline").getAttribute("aria-pressed"), "true")
  assert.equal(root.querySelector(".content-editable"), editable)
  assert.equal(localStorage.getItem("tuuru_works"), beforeStorage)
  assert.equal(location.hash, beforeHash)
})

test("outline selection returns to editing while an editor choice does not steal focus", async t => {
  const work = article("focus-work", [
    { id: "focus-a", choices: [{ id: "choice-a", text: "Next", targetId: "focus-b" }] },
    { id: "focus-b" },
  ])
  seed(work)
  await render(work.id)

  const decoy = document.createElement("button")
  decoy.dataset.a = "mobile-pane"
  decoy.dataset.pane = "editor"
  document.body.insertBefore(decoy, document.getElementById("app"))
  t.after(() => decoy.remove())

  paneButton("outline").click()
  document.querySelector('.wt-node[data-n="focus-b"]').click()
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "editor")
  assert.equal(document.activeElement, paneButton("editor"))
  assert.ok(document.getElementById("ce_focus-b"))

  paneButton("outline").click()
  document.querySelector('.wt-node[data-n="focus-a"]').click()
  const choice = document.querySelector('[data-a="ch-go"][data-target="focus-b"]')
  choice.focus()
  choice.click()
  assert.ok(document.getElementById("ce_focus-b"))
  assert.notEqual(document.activeElement, paneButton("editor"))
})

test("empty, first-node, last-node, and cross-work transitions choose a reachable pane", async () => {
  const empty = article("empty-work", [])
  seed(empty)
  await render(empty.id)

  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "outline")
  document.querySelector('[data-a="an"]').click()
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "editor")
  assert.equal(document.activeElement, paneButton("editor"))

  paneButton("outline").click()
  document.querySelector('.wt-node [data-a="dl"]').click()
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "outline")
  assert.equal(document.activeElement, paneButton("outline"))

  const first = article("first-work", [{ id: "first-node" }])
  const second = article("second-work", [{ id: "second-node" }])
  seed(first, second)
  await render(first.id)
  paneButton("outline").click()
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "outline")

  await render(second.id)
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "editor")
})

test("bounded phone layouts expose one editor pane without changing desktop coexistence", () => {
  assert.match(css, /\.editor-mobile-view-switch\s*\{[^}]*display\s*:\s*none/)
  assert.match(
    css,
    /@media\s*\(max-width\s*:\s*480px\)\s*,\s*\(max-height\s*:\s*480px\)\s*and\s*\(pointer\s*:\s*coarse\)/,
  )

  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  assert.ok(bounded)
  assert.match(bounded, /\.editor-body-area\s*\{[^}]*flex-direction\s*:\s*column/)
  assert.match(bounded, /\.editor-iconbar\s*\{[^}]*flex-direction\s*:\s*row/)
  assert.match(bounded, /\.editor-mobile-view-switch\s*\{[^}]*display\s*:/)
  assert.match(bounded, /\.editor-mobile-view-switch\s+button\s*\{[^}]*min-height\s*:\s*44px/)
  assert.match(bounded, /\[data-mobile-pane=["']?editor["']?\]\s+\.world-tree\s*\{[^}]*display\s*:\s*none/)
  assert.match(bounded, /\[data-mobile-pane=["']?outline["']?\]\s+\.editor-area\s*\{[^}]*display\s*:\s*none/)
  assert.match(bounded, /\.editor-area\s*,\s*\.world-tree\s*\{[^}]*min-height\s*:\s*0/)

  assert.match(editorSource, /id="articleEditorPane"/)
  assert.match(editorSource, /id="articleOutlinePane"/)
  assert.doesNotMatch(editorSource, /aria-modal="true"|editor-mobile-drawer|editor-mobile-overlay/)
})
