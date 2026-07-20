import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
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
  assert.equal(outlineButton?.textContent.trim(), "结构")
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

test("the compact mobile writing dock progressively discloses insert and format tools", async () => {
  const work = article("mobile-command-work", [{ id: "mobile-command-node" }])
  seed(work)
  const root = await render(work.id)
  const shell = root.querySelector(".editor-body-area")
  const editable = root.querySelector(".content-editable")
  const commandbar = root.querySelector(".editor-mobile-commandbar")
  assert.ok(commandbar)

  const dockLabels = [...commandbar.querySelectorAll(".editor-mobile-dock > button")]
    .map(button => button.getAttribute("aria-label"))
  const insertTrigger = commandbar.querySelector('[data-a="mobile-tools"][data-panel="insert"]')
  const formatTrigger = commandbar.querySelector('[data-a="mobile-tools"][data-panel="format"]')
  const insertPanel = commandbar.querySelector('[data-mobile-tool-panel="insert"]')
  const formatPanel = commandbar.querySelector('[data-mobile-tool-panel="format"]')
  const outlineTrigger = paneButton("outline")

  assert.deepEqual(dockLabels, ["文字格式", "插入内容", "撤回", "重做"])
  assert.equal(insertPanel.hidden, true)
  assert.equal(formatPanel.hidden, true)
  assert.equal(insertTrigger.getAttribute("aria-expanded"), "false")
  assert.equal(formatTrigger.getAttribute("aria-expanded"), "false")
  assert.ok(insertPanel.querySelector('[data-a="ph"]'))
  assert.ok(insertPanel.querySelector('[data-a="pa-msg"]'))
  assert.ok(commandbar.querySelector('.editor-mobile-dock [data-a="undo"]'))
  assert.ok(commandbar.querySelector('.editor-mobile-dock [data-a="redo"]'))
  assert.equal(formatPanel.querySelector('[data-a="undo"]'), null)
  assert.equal(formatPanel.querySelector('[data-a="redo"]'), null)
  assert.ok(formatPanel.querySelector('[data-a="bold"]'))
  assert.ok(formatPanel.querySelector('[data-a="fs-font"]'))
  assert.ok(formatPanel.querySelector('[data-a="fs-mt"]'))

  insertTrigger.click()
  assert.equal(insertPanel.hidden, false)
  assert.equal(formatPanel.hidden, true)
  assert.equal(insertTrigger.getAttribute("aria-expanded"), "true")

  formatTrigger.click()
  assert.equal(insertPanel.hidden, true)
  assert.equal(formatPanel.hidden, false)
  assert.equal(insertTrigger.getAttribute("aria-expanded"), "false")
  assert.equal(formatTrigger.getAttribute("aria-expanded"), "true")

  outlineTrigger.click()
  assert.equal(shell.dataset.mobilePane, "outline")
  assert.equal(formatPanel.hidden, true)
  assert.equal(formatTrigger.getAttribute("aria-expanded"), "false")
  assert.equal(root.querySelector(".content-editable"), editable)
})

test("undo and redo are available in both toolbars and persist their resulting HTML", async t => {
  const work = article("history-work", [{ id: "history-node" }])
  seed(work)
  const root = await render(work.id)
  const editable = root.querySelector(".content-editable")
  const desktopToolbar = root.querySelector(".editor-toolbar")
  const mobileToolbar = root.querySelector(".editor-mobile-dock")
  const originalExecCommand = document.execCommand
  const commands = []

  document.execCommand = command => {
    commands.push(command)
    editable.innerHTML = command === "undo" ? "<p>undone</p>" : "<p>redone</p>"
    return true
  }
  t.after(() => { document.execCommand = originalExecCommand })

  assert.ok(desktopToolbar.querySelector('[data-a="undo"]'))
  assert.ok(desktopToolbar.querySelector('[data-a="redo"]'))
  assert.ok(mobileToolbar.querySelector('[data-a="undo"]'))
  assert.ok(mobileToolbar.querySelector('[data-a="redo"]'))

  desktopToolbar.querySelector('[data-a="undo"]').click()
  let saved = JSON.parse(localStorage.getItem("tuuru_works"))
  assert.equal(saved.works[0].nodes[0].content, "<p>undone</p>")

  mobileToolbar.querySelector('[data-a="redo"]').click()
  saved = JSON.parse(localStorage.getItem("tuuru_works"))
  assert.equal(saved.works[0].nodes[0].content, "<p>redone</p>")
  assert.deepEqual(commands, ["undo", "redo"])
})

test("a saved editor font is reinstalled and applied when the editor opens again", async () => {
  const work = article("font-work", [{ id: "font-node" }])
  work.editorSettings.customFonts = [{
    name: "Saved Font",
    value: "'Saved Font', sans-serif",
    data: "data:font/ttf;base64,AA==",
    format: "truetype",
  }]
  work.editorSettings.fontFamily = "'Saved Font', sans-serif"
  seed(work)

  const root = await render(work.id)
  const style = document.getElementById("editor-custom-fonts-style")

  assert.ok(style)
  assert.match(style.textContent, /Saved Font/)
  assert.equal(root.querySelector('[data-a="fs-font"] option:checked').value, "'Saved Font', sans-serif")
  assert.match(root.querySelector(".content-editable").getAttribute("style"), /Saved Font/)
})

test("chapter creation stays inline and the editor source has no native dialogs", async () => {
  const work = article("inline-chapter-work", [{ id: "inline-chapter-node" }])
  seed(work)
  const root = await render(work.id)
  const addChapter = root.querySelector('[data-a="as"]')

  assert.ok(addChapter)
  addChapter.click()

  const creator = root.querySelector(".wt-chapter-create")
  assert.ok(creator)
  assert.equal(creator.hidden, false)
  assert.equal(document.activeElement, creator.querySelector("input"))

  creator.querySelector("input").value = "第二章"
  creator.querySelector('[data-a="chapter-create-confirm"]').click()

  const saved = JSON.parse(localStorage.getItem("tuuru_works"))
  assert.ok(saved.works[0].chapters.some(chapter => chapter.name === "第二章"))
  assert.doesNotMatch(editorSource, /\b(?:prompt|confirm|alert)\s*\(/)
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
  document.querySelector('.wt-node-select[data-n="focus-b"]').click()
  assert.equal(document.querySelector(".editor-body-area").dataset.mobilePane, "editor")
  assert.equal(document.activeElement, paneButton("editor"))
  assert.ok(document.getElementById("ce_focus-b"))

  paneButton("outline").click()
  document.querySelector('.wt-node-select[data-n="focus-a"]').click()
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
  document.getElementById("cK").click()
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

test("the editor height and scroll chain follow the usable application viewport", () => {
  const editorStart = css.indexOf("/* ====== Three-Column Editor Layout")
  const editorEnd = css.indexOf("/* Responsive */", editorStart)
  const editorSection = css.slice(editorStart, editorEnd).replace(/\/\*[\s\S]*?\*\//g, "")
  const header = ruleBodiesFor(cssWithoutComments, ".app-header")
  const page = ruleBodiesFor(editorSection, ".editor-page")
  const bodyArea = ruleBodiesFor(editorSection, ".editor-body-area")
  const editorArea = ruleBodiesFor(editorSection, ".editor-area")
  const editorContent = ruleBodiesFor(editorSection, ".editor-content")
  const worldTree = ruleBodiesFor(editorSection, ".world-tree")
  const treeBody = ruleBodiesFor(cssWithoutComments, ".world-tree .wt-body")
  const documentBody = ruleBodiesFor(cssWithoutComments, "body")
  const narrow = cssBlockAfterMarker(css, "@media(max-width:480px)")
  const dynamicViewportSupport = cssBlockAfterMarker(css, "@supports (height:100dvh)")

  assert.match(css, /:root\s*\{[^}]*--app-viewport-height\s*:\s*100vh/)
  assert.ok(dynamicViewportSupport)
  assert.match(dynamicViewportSupport, /:root\s*\{[^}]*--app-viewport-height\s*:\s*100dvh/)
  assert.match(css, /:root\s*\{[^}]*--app-header-height\s*:\s*56px/)
  assert.match(header, /height\s*:\s*var\(--app-header-height\)/)
  assert.match(page, /height\s*:\s*calc\(var\(--app-viewport-height\)\s*-\s*var\(--app-header-height\)\)/)
  assert.doesNotMatch(page, /100vh|56px/)
  assert.ok(narrow)
  assert.match(narrow, /:root\s*\{[^}]*--app-header-height\s*:\s*48px/)

  for (const rule of [page, bodyArea, editorArea, editorContent, worldTree, treeBody]) {
    assert.match(rule, /min-height\s*:\s*0/)
  }
  assert.match(page, /overflow\s*:\s*hidden/)
  assert.match(bodyArea, /overflow\s*:\s*hidden/)
  assert.match(editorArea, /overflow\s*:\s*hidden/)
  assert.match(worldTree, /overflow\s*:\s*hidden/)
  assert.match(editorContent, /overflow-y\s*:\s*auto/)
  assert.match(treeBody, /overflow-y\s*:\s*auto/)
  assert.match(editorContent, /overscroll-behavior\s*:\s*contain/)
  assert.match(treeBody, /overscroll-behavior\s*:\s*contain/)
  assert.match(documentBody, /min-height\s*:\s*var\(--app-viewport-height\)/)
  assert.doesNotMatch(documentBody, /min-height\s*:\s*100vh/)
  assert.doesNotMatch(documentBody, /overflow(?:-x|-y)?\s*:\s*hidden/)
})

test("the bounded editor header keeps title and scene controls usable in one row", async () => {
  const work = article("bounded-header-work", [{ id: "bounded-header-node" }])
  work.scenes = [{ id: "scene-a", name: "A scene name that is intentionally very long" }]
  seed(work)
  const root = await render(work.id)
  const title = root.querySelector(".editor-header .node-name")
  const scene = root.querySelector('.editor-header [data-a="ss"]')

  assert.equal(title.getAttribute("aria-label"), "节点标题")
  assert.equal(scene.getAttribute("aria-label"), "节点场景")

  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  assert.ok(bounded)
  const header = ruleBodiesFor(bounded, ".editor-header")
  const boundedTitle = ruleBodiesFor(bounded, ".editor-header .node-name")
  const actions = ruleBodiesFor(bounded, ".editor-header .editor-actions")
  const boundedScene = ruleBodiesFor(bounded, ".editor-header .editor-actions select")
  const count = ruleBodiesFor(bounded, ".editor-header .word-count")

  assert.match(header, /min-width\s*:\s*0/)
  assert.match(header, /gap\s*:\s*4px/)
  assert.match(boundedTitle, /min-width\s*:\s*0/)
  assert.match(boundedTitle, /min-height\s*:\s*44px/)
  assert.match(actions, /min-width\s*:\s*0/)
  assert.match(actions, /flex\s*:\s*0\s+1\s+88px/)
  assert.match(boundedScene, /width\s*:\s*100%/)
  assert.match(boundedScene, /max-width\s*:\s*88px/)
  assert.match(boundedScene, /min-height\s*:\s*44px/)
  assert.match(count, /flex-shrink\s*:\s*0/)
  assert.match(count, /white-space\s*:\s*nowrap/)

  const shortLandscape = cssBlockAfterMarker(
    css,
    "@media(max-height:480px) and (pointer:coarse)",
  )
  assert.ok(shortLandscape)
  assert.match(ruleBodiesFor(shortLandscape, ":root"), /--app-header-height\s*:\s*48px/)
  for (const selector of [
    ".editor-iconbar",
    ".editor-mobile-view-switch",
    ".editor-header",
    ".editor-toolbar-scroll",
  ]) {
    assert.match(ruleBodiesFor(shortLandscape, selector), /padding-block\s*:\s*0/, selector)
  }
  assert.match(
    ruleBodiesFor(shortLandscape, ".editor-content"),
    /padding-block\s*:\s*8px/,
  )
})

test("short fine-pointer viewports keep the editor icon rail usable", () => {
  const marker = "/* Article editor short viewport fallback */"
  const fallback = cssBlockAfterMarker(css, marker)
  const boundedMarker = "/* Article editor bounded mobile workspace */"

  assert.ok(fallback)
  assert.match(css, /@media\(min-width:481px\) and \(max-height:480px\)/)
  assert.ok(css.indexOf(marker) < css.indexOf(boundedMarker))

  const iconRail = ruleBodiesFor(fallback, ".editor-iconbar")
  const iconButton = ruleBodiesFor(fallback, ".editor-iconbar button")
  const divider = ruleBodiesFor(fallback, ".editor-iconbar .divider")

  assert.match(iconRail, /width\s*:\s*64px/)
  assert.match(iconRail, /min-height\s*:\s*0/)
  assert.match(iconRail, /overflow-x\s*:\s*hidden/)
  assert.match(iconRail, /overflow-y\s*:\s*auto/)
  assert.match(iconRail, /touch-action\s*:\s*pan-y/)
  assert.match(iconButton, /width\s*:\s*44px/)
  assert.match(iconButton, /height\s*:\s*44px/)
  assert.match(iconButton, /min-width\s*:\s*44px/)
  assert.match(iconButton, /min-height\s*:\s*44px/)
  assert.match(iconButton, /flex-shrink\s*:\s*0/)
  assert.match(divider, /flex-shrink\s*:\s*0/)
})

test("scene selection persists on change without a click double-write", async () => {
  const work = article("scene-change-work", [{ id: "scene-change-node" }])
  work.scenes = [{ id: "scene-a", name: "Scene A" }]
  seed(work)
  const root = await render(work.id)
  const scene = root.querySelector('.editor-header [data-a="ss"]')
  const storagePrototype = Object.getPrototypeOf(localStorage)
  const originalSetItem = storagePrototype.setItem
  let databaseWrites = 0
  storagePrototype.setItem = function(key, value) {
    if (key === "tuuru_works") databaseWrites += 1
    return originalSetItem.call(this, key, value)
  }

  try {
    scene.value = "scene-a"
    scene.dispatchEvent(new dom.window.Event("change", { bubbles: true }))

    const saved = JSON.parse(localStorage.getItem("tuuru_works"))
    const savedNode = saved.works[0].nodes.find(item => item.id === "scene-change-node")
    assert.equal(savedNode.scene, "scene-a")
    assert.equal(databaseWrites, 1)

    scene.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    assert.equal(databaseWrites, 1)
  } finally {
    storagePrototype.setItem = originalSetItem
  }
})

test("word count consistently measures visible text and keeps its label", async () => {
  const cases = [
    ["", "0 字"],
    ["<strong>甲乙</strong>", "2 字"],
    ["甲<br>乙", "2 字"],
    ["甲 乙", "3 字"],
    ["&amp;&nbsp;", "2 字"],
  ]

  for (const [index, [content, expected]] of cases.entries()) {
    const work = article(`word-count-${index}`, [{ id: `word-count-node-${index}` }])
    work.nodes[0].content = content
    seed(work)
    const root = await render(work.id)
    assert.equal(root.querySelector(".word-count").textContent, expected)
  }

  const work = article("word-count-live", [{ id: "word-count-live-node" }])
  work.nodes[0].content = "<strong>甲乙</strong>"
  seed(work)
  const root = await render(work.id)
  const editable = root.querySelector(".content-editable")
  const count = root.querySelector(".word-count")

  assert.equal(count.textContent, "2 字")

  editable.innerHTML = "<em>甲</em><br>乙&amp;&nbsp;"
  editable.dispatchEvent(new dom.window.Event("input", { bubbles: true }))

  assert.equal(count.textContent, "4 字")
  const saved = JSON.parse(localStorage.getItem("tuuru_works"))
  assert.equal(saved.works[0].nodes[0].content, "<em>甲</em><br>乙&amp;&nbsp;")
  assert.doesNotMatch(editorSource, /ce\.innerText/)
})

test("article action rails expose named native controls and an unclipped margin panel", async () => {
  const work = article("action-rail-work", [{ id: "action-rail-node" }])
  seed(work)
  const root = await render(work.id)
  const iconButtons = [...root.querySelectorAll(".editor-iconbar button")]
  const toolbarButtons = [...root.querySelectorAll(".editor-toolbar button")]
  const toolbarSettings = [...root.querySelectorAll(".editor-toolbar .toolbar-setting")]
  const toolbar = root.querySelector(".editor-toolbar")
  const scroller = root.querySelector(".editor-toolbar-scroll")
  const marginTrigger = root.querySelector('[data-a="fs-margin-toggle"]')
  const marginPanel = root.querySelector("#marginPopover")

  assert.ok(iconButtons.length >= 10)
  for (const button of iconButtons) {
    assert.equal(button.type, "button")
    assert.ok(button.getAttribute("aria-label")?.trim())
  }
  for (const button of toolbarButtons) {
    assert.equal(button.type, "button")
    assert.ok(button.getAttribute("aria-label")?.trim())
  }
  for (const setting of toolbarSettings) {
    assert.ok(setting.getAttribute("aria-label")?.trim())
  }

  assert.equal(root.querySelector('[data-a="bold"]').getAttribute("aria-label"), "加粗")
  assert.equal(root.querySelector('[data-a="im"]').getAttribute("aria-label"), "插入图片")
  assert.ok(scroller)
  assert.ok(scroller.contains(marginTrigger))
  assert.equal(marginPanel.parentElement, toolbar)
  assert.equal(scroller.contains(marginPanel), false)
  assert.equal(marginTrigger.getAttribute("aria-controls"), "marginPopover")
  assert.equal(marginTrigger.getAttribute("aria-expanded"), "false")
  toolbar.getBoundingClientRect = () => ({ left: 10, width: 500 })
  marginTrigger.getBoundingClientRect = () => ({ left: 410 })
  Object.defineProperty(marginPanel, "offsetWidth", { configurable: true, value: 120 })
  marginTrigger.click()
  assert.equal(marginPanel.classList.contains("open"), true)
  assert.equal(marginTrigger.getAttribute("aria-expanded"), "true")
  assert.equal(marginPanel.style.getPropertyValue("--margin-popover-left"), "372px")
})

test("bounded action rails scroll horizontally with touch-safe targets", () => {
  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  assert.ok(bounded)

  const iconRail = ruleBodiesFor(bounded, ".editor-iconbar")
  const iconButton = ruleBodiesFor(bounded, ".editor-iconbar button")
  const toolbar = ruleBodiesFor(cssWithoutComments, ".editor-toolbar")
  const toolbarScroller = ruleBodiesFor(bounded, ".editor-toolbar-scroll")
  const toolbarButton = ruleBodiesFor(bounded, ".editor-toolbar button")
  const toolbarSetting = ruleBodiesFor(bounded, ".editor-toolbar .toolbar-setting")
  const toolbarNumber = ruleBodiesFor(bounded, ".editor-toolbar .toolbar-number")
  const toolbarCheckbox = ruleBodiesFor(bounded, ".editor-toolbar .toolbar-checkbox")
  const checkboxGlyph = ruleBodiesFor(cssWithoutComments, ".editor-toolbar .toolbar-checkbox input")
  const marginPanel = ruleBodiesFor(bounded, ".margin-popover")
  const allMarginPanelRules = ruleBodiesFor(cssWithoutComments, ".margin-popover")
  const marginInputFocus = ruleBodiesFor(cssWithoutComments, ".margin-grid .margin-cell .margin-num:focus")
  const iconFocus = ruleBodiesFor(bounded, ".editor-iconbar button:focus-visible")
  const toolbarFocus = ruleBodiesFor(bounded, ".editor-toolbar button:focus-visible")

  assert.match(toolbar, /position\s*:\s*relative/)
  assert.match(iconRail, /overflow-x\s*:\s*auto/)
  assert.match(iconRail, /touch-action\s*:\s*pan-x/)
  assert.match(iconButton, /(?:width|min-width)\s*:\s*44px/)
  assert.match(iconButton, /(?:height|min-height)\s*:\s*44px/)
  assert.match(toolbarScroller, /flex-wrap\s*:\s*nowrap/)
  assert.match(toolbarScroller, /overflow-x\s*:\s*auto/)
  assert.match(toolbarScroller, /touch-action\s*:\s*pan-x/)
  assert.match(toolbarButton, /min-width\s*:\s*44px/)
  assert.match(toolbarButton, /min-height\s*:\s*44px/)
  for (const rule of [toolbarSetting, toolbarNumber, toolbarCheckbox]) {
    assert.match(rule, /min-height\s*:\s*44px/)
  }
  assert.match(checkboxGlyph, /width\s*:\s*13px/)
  assert.match(checkboxGlyph, /height\s*:\s*13px/)
  assert.match(marginPanel, /left\s*:\s*8px/)
  assert.match(marginPanel, /right\s*:\s*8px/)
  assert.match(marginPanel, /max-width\s*:\s*calc\(100%\s*-\s*16px\)/)
  assert.match(allMarginPanelRules, /left\s*:\s*var\(--margin-popover-left\s*,\s*0px\)/)
  assert.doesNotMatch(allMarginPanelRules, /right\s*:\s*16px/)
  assert.doesNotMatch(marginInputFocus, /outline\s*:\s*none/)
  assert.match(iconFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(toolbarFocus, /outline\s*:\s*2px\s+solid/)
})

test("bounded phone authoring separates primary page tabs from a compact writing dock", () => {
  const bounded = cssBlockAfterMarker(css, "/* Article editor bounded mobile workspace */")
  assert.ok(bounded)

  assert.match(ruleBodiesFor(cssWithoutComments, ".editor-mobile-commandbar"), /display\s*:\s*none/)
  assert.match(ruleBodiesFor(bounded, ".editor-iconbar"), /display\s*:\s*none/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-view-switch"), /display\s*:\s*flex/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-view-switch button"), /min-height\s*:\s*44px/)
  assert.match(ruleBodiesFor(bounded, '.editor-mobile-view-switch button[aria-pressed="true"]::after'), /height\s*:\s*2px/)
  assert.match(ruleBodiesFor(bounded, ".editor-toolbar"), /display\s*:\s*none/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-commandbar"), /display\s*:\s*flex/)
  assert.match(ruleBodiesFor(bounded, '.editor-body-area[data-mobile-pane="outline"] .editor-mobile-commandbar'), /display\s*:\s*none/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-dock"), /min-height\s*:\s*52px/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-dock > button"), /min-width\s*:\s*44px/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-dock > button"), /min-height\s*:\s*44px/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-tool-panel"), /position\s*:\s*absolute/)
  assert.match(ruleBodiesFor(bounded, ".editor-mobile-tool-panel"), /bottom\s*:\s*52px/)
  assert.match(ruleBodiesFor(bounded, ".world-tree .wt-chapter-content"), /border-left\s*:\s*1px\s+solid/)
  assert.match(ruleBodiesFor(bounded, ".world-tree .wt-node-drag-handle"), /opacity\s*:\s*1/)
  assert.match(ruleBodiesFor(bounded, ".editor-area"), /flex\s*:\s*1\s+1\s+0/)
})
