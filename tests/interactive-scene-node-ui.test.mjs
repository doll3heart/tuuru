import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

const [editorSource, css] = await Promise.all([
  readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8"),
  readFile(new URL("../css/styles.css", import.meta.url), "utf8"),
])

test("authoring creates a chapter node instead of inserting an inline scene card", () => {
  assert.match(editorSource, /function createInteractiveSceneNode\(/)
  assert.match(editorSource, /createInteractiveSceneNodeDraft\(/)
  assert.match(editorSource, /data-a="chapter-add-interactive"/)
  assert.match(editorSource, /data-a="edit-interactive-node"/)
  assert.match(editorSource, /buildInteractiveSceneContinuationGroups\(/)
  assert.match(editorSource, /targetGroups:buildInteractiveSceneContinuationGroups/)
  assert.doesNotMatch(editorSource, /function insertInteractiveSceneCard\(/)
  assert.doesNotMatch(editorSource, /function buildInteractiveSceneCardHTML\(/)
})

test("interactive nodes are identified in the chapter tree and use a page workspace", () => {
  assert.match(editorSource, /wt-node-kind-badge/)
  assert.match(editorSource, /buildInteractiveNodeEditor/)
  assert.match(editorSource, /独立阅读页面/)
  assert.match(css, /\.interactive-node-workspace\s*\{[^}]*grid-template-rows:/s)
  assert.match(css, /\.interactive-node-preview\s*\{[^}]*min-height:\s*280px/s)
})

test("the real author editor renders an interactive chapter node as a page workspace", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/#/edit/interactive-node-work",
    pretendToBeVisual: true,
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
  document.execCommand = () => true
  window.matchMedia = query => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
  t.after(() => dom.window.close())

  const work = {
    id: "interactive-node-work",
    schemaVersion: 1,
    type: "article",
    title: "宝宝文游",
    chapters: [{ id: "chapter-1", name: "第一章" }],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    editorSettings: {},
    startNode: "interactive-node-1",
    nodes: [{
      id: "interactive-node-1",
      title: "掌心",
      content: "",
      choices: [],
      scene: "",
      chapterId: "chapter-1",
      kind: "interactive-scene",
      interactiveSceneId: "scene-1",
    }],
    interactiveScenes: [{
      id: "scene-1",
      nodeId: "interactive-node-1",
      title: "掌心",
      startStageId: "stage-1",
      stages: [{
        id: "stage-1",
        image: "https://example.test/hand.jpg",
        characterImage: "",
        dialogue: { speaker: "", text: "" },
        hotspots: [],
      }],
    }],
  }
  localStorage.setItem("tuuru_works", JSON.stringify({ works: [work], contacts: [], groups: [] }))
  const { renderEditor } = await import(`../js/pages/editor.js?interactive-node-ui=${Date.now()}-${Math.random()}`)
  document.getElementById("app").innerHTML = renderEditor(work.id)

  assert.equal(document.querySelectorAll(".wt-node").length, 1)
  assert.equal(document.querySelector(".wt-node-kind-badge").textContent, "互动")
  assert.ok(document.querySelector(".interactive-node-workspace"))
  assert.ok(document.querySelector('[data-a="edit-interactive-node"]'))
  assert.equal(document.querySelector(".content-editable"), null)
})
