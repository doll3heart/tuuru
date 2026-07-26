import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
}

function seedWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

async function startWork(work, key) {
  seedWork(work)
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

function hiddenNodeWork() {
  return {
    schemaVersion: 3,
    id: "reader-hidden-node-memory",
    type: "article",
    title: "Hidden node memory",
    placeholders: [],
    scenes: [],
    chapters: [
      { id: "chapter-one", name: "第一章" },
      { id: "chapter-two", name: "第二章" },
    ],
    startNode: "prelude",
    nodes: [
      {
        id: "prelude",
        title: "前言",
        chapterId: "chapter-one",
        content: "<p>前言正文</p>",
        choices: [{
          id: "early",
          mode: "interaction",
          text: "点头",
          selectedText: "你轻轻点了点头。",
          targetId: "",
        }],
      },
      {
        id: "first",
        title: "第一选择",
        chapterId: "chapter-one",
        content: "<p>岔路口</p>",
        choices: [
          { id: "b", mode: "branch", text: "走蓝路", targetId: "second" },
          { id: "other", mode: "branch", text: "走灰路", targetId: "second" },
        ],
      },
      {
        id: "second",
        title: "第二选择",
        chapterId: "chapter-two",
        content: "<p>第二章开头</p>",
        choices: [{ id: "d", mode: "branch", text: "继续", targetId: "target" }],
      },
      {
        id: "hidden",
        kind: "conditional",
        title: "作者专用标题",
        chapterId: "chapter-two",
        content: "<p>隐藏段落</p>",
        choices: [],
        displayCondition: {
          all: [
            { anyChoiceIds: ["early"] },
            { anyChoiceIds: ["b"] },
            { anyChoiceIds: ["d"] },
          ],
        },
      },
      {
        id: "target",
        title: "结尾",
        chapterId: "chapter-two",
        content: "<p>目标段落</p>",
        choices: [],
      },
    ],
  }
}

test("reader records route-local choices, renders matching hidden prose, and removes it after backtracking", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  const authoredChoices = structuredClone(work.nodes.map(node => node.choices))
  await startWork(work, "hidden-node-memory")

  const interaction = document.querySelector('.article-choice-btn[data-choice-id="early"]')
  assert.equal(interaction.textContent.trim(), "1.点头")
  assert.equal(document.querySelector(".article-interaction-response"), null)
  interaction.click()
  assert.equal(document.querySelector('.article-choice-btn[data-choice-id="early"]').getAttribute("aria-pressed"), "true")
  assert.match(document.querySelector(".article-interaction-response").textContent, /你轻轻点了点头/)

  document.querySelector('.article-choice-btn[data-choice-id="b"]').click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /隐藏段落/)
  document.querySelector('.article-choice-btn[data-choice-id="d"]').click()
  const afterD = document.querySelector(".article-reader").textContent
  assert.match(afterD, /第二章开头.*隐藏段落.*目标段落/s)
  assert.doesNotMatch(afterD, /作者专用标题/)

  document.querySelector("[data-reader-previous]").click()
  document.querySelector('.article-choice-btn[data-choice-id="other"]').click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /隐藏段落/)
  document.querySelector('.article-choice-btn[data-choice-id="d"]').click()
  const afterReselect = document.querySelector(".article-reader").textContent
  assert.doesNotMatch(afterReselect, /隐藏段落/)
  assert.deepEqual(work.nodes.map(node => node.choices), authoredChoices)
})

test("legacy ordinary interactions use their label as the selected response", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-hidden-node-legacy-interaction"
  work.nodes = [
    {
      id: "legacy",
      title: "旧互动",
      chapterId: "chapter-one",
      content: "<p>旧互动前</p>",
      choices: [{ id: "legacy-choice", mode: "interaction", text: "旧版按钮文字", targetId: "" }],
    },
    {
      id: "after-legacy",
      title: "后续",
      chapterId: "chapter-one",
      content: "<p>旧互动后</p>",
      choices: [],
    },
  ]
  work.chapters = [{ id: "chapter-one", name: "第一章" }]
  work.startNode = "legacy"
  await startWork(work, "legacy-interaction")

  const button = document.querySelector('.article-choice-btn[data-choice-id="legacy-choice"]')
  assert.equal(button.textContent.trim(), "1.旧版按钮文字")
  button.click()
  assert.match(document.querySelector(".article-interaction-response").textContent, /旧版按钮文字/)
  assert.match(document.querySelector(".article-reader").textContent, /旧互动后/)
})

test("reader distinguishes legacy fallback from an authored empty interaction response and escapes authored prose", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-interaction-response-presence"
  work.nodes = [{
    id: "response-node",
    title: "Responses",
    chapterId: "chapter-one",
    content: "<p>Response node</p>",
    choices: [
      { id: "legacy", mode: "interaction", text: "Legacy button", targetId: "" },
      { id: "empty", mode: "interaction", text: "Empty authored button", selectedText: "", targetId: "" },
      { id: "markup", mode: "interaction", text: "Markup button", selectedText: '<img src=x onerror="globalThis.readerXss=1"> & <b>authored</b>', targetId: "" },
    ],
  }]
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "response-node"
  await startWork(work, "interaction-response-presence")

  document.querySelector('[data-choice-id="legacy"]').click()
  assert.equal(document.querySelector(".article-interaction-response").textContent, "Legacy button")

  document.querySelector('[data-choice-id="empty"]').click()
  assert.equal(document.querySelector(".article-interaction-response"), null)

  document.querySelector('[data-choice-id="markup"]').click()
  const response = document.querySelector(".article-interaction-response")
  assert.equal(response.textContent, '<img src=x onerror="globalThis.readerXss=1"> & <b>authored</b>')
  assert.equal(response.querySelector("img"), null)
  assert.equal(response.querySelector("b"), null)
  assert.equal(globalThis.readerXss, undefined)
})

test("reader renders every authored response line as safe article prose and keeps blank lines", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-multiline-interaction-response"
  work.nodes = [{
    id: "response-node",
    title: "Responses",
    chapterId: "chapter-one",
    content: "<p>Response node</p>",
    choices: [
      { id: "multiline", mode: "interaction", text: "Button only", selectedText: '第一行\r\n\r\n</textarea><img src=x onerror="globalThis.readerMultilineXss=1">', targetId: "" },
      { id: "null", mode: "interaction", text: "Null authored", selectedText: null, targetId: "" },
    ],
  }]
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "response-node"
  await startWork(work, "multiline-interaction-response")

  document.querySelector('[data-choice-id="multiline"]').click()
  const response = document.querySelector(".article-interaction-response")
  const paragraphs = response.querySelectorAll("p")
  assert.ok(response.classList.contains("article-content"))
  assert.equal(paragraphs.length, 3)
  assert.equal(paragraphs[0].textContent, "第一行")
  assert.equal(paragraphs[1].textContent, "")
  assert.equal(paragraphs[1].querySelector("br") !== null, true)
  assert.equal(paragraphs[2].textContent, '</textarea><img src=x onerror="globalThis.readerMultilineXss=1">')
  assert.equal(response.querySelector("img"), null)
  assert.equal(globalThis.readerMultilineXss, undefined)

  document.querySelector('[data-choice-id="null"]').click()
  assert.equal(document.querySelector(".article-interaction-response"), null)
})

test("repeated source nodes fail closed when truncation removes a later occurrence", async t => {
  installDom(t)
  const work = {
    schemaVersion: 3,
    id: "reader-repeated-source-memory",
    type: "article",
    title: "Repeated source memory",
    placeholders: [], scenes: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "a",
    nodes: [
      {
        id: "a", title: "A", chapterId: "chapter", content: "<p>A</p>",
        choices: [
          { id: "a-to-b", mode: "branch", text: "A to B", targetId: "b" },
          { id: "a-later", mode: "branch", text: "Remember", targetId: "b" },
        ],
      },
      {
        id: "hidden", kind: "conditional", title: "Hidden title", chapterId: "chapter", content: "<p>Repeated-secret</p>", choices: [],
        displayCondition: { all: [{ anyChoiceIds: ["a-later"] }] },
      },
      { id: "b", title: "B", chapterId: "chapter", content: "<p>B</p>", choices: [{ id: "b-to-c", mode: "branch", text: "B to C", targetId: "c" }] },
      { id: "c", title: "C", chapterId: "chapter", content: "<p>C</p>", choices: [{ id: "c-to-a", mode: "branch", text: "C to A", targetId: "a" }] },
    ],
  }
  await startWork(work, "repeated-source")

  document.querySelector('.article-choice-btn[data-choice-id="a-to-b"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="b-to-c"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="c-to-a"]').click()
  const laterA = [...document.querySelectorAll('.article-choice-btn[data-choice-id="a-later"]')].at(-1)
  laterA.click()
  assert.match(document.querySelector(".article-reader").textContent, /Repeated-secret/)

  document.querySelector('.article-choice-btn[data-source-path-index="1"][data-choice-id="b-to-c"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="c-to-a"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="a-to-b"]').click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Repeated-secret/)
})

test("branch selection remains pressed when a visible conditional prelude sits before its target", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-branch-prelude-pressed"
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "source"
  work.nodes = [
    { id: "source", title: "Source", chapterId: "chapter-one", content: "<p>Source</p>", choices: [{ id: "open", mode: "branch", text: "Open", targetId: "target" }] },
    { id: "prelude", kind: "conditional", title: "Private prelude title", chapterId: "chapter-one", content: "<p>Prelude prose</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["open"] }] } },
    { id: "target", title: "Target", chapterId: "chapter-one", content: "<p>Target prose</p>", choices: [] },
  ]
  await startWork(work, "branch-prelude-pressed")

  document.querySelector('.article-choice-btn[data-choice-id="open"]').click()
  const button = document.querySelector('.article-choice-btn[data-choice-id="open"]')
  assert.equal(button.getAttribute("aria-pressed"), "true")
  assert.ok(button.classList.contains("is-selected"))
  assert.match(document.querySelector(".article-reader").textContent, /Prelude prose.*Target prose/s)
})

test("empty chapter names never expose conditional titles as reader headings", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-hidden-heading"
  work.chapters = [{ id: "chapter-one", name: "" }]
  work.startNode = "source"
  work.nodes = [
    { id: "source", title: "Source title", chapterId: "chapter-one", content: "<p>Source</p>", choices: [{ id: "show", mode: "branch", text: "Show", targetId: "target" }] },
    { id: "prelude", kind: "conditional", title: "Leaked conditional title", chapterId: "chapter-one", content: "<p>Hidden prose</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["show"] }] } },
    { id: "target", title: "Target title", chapterId: "chapter-one", content: "<p>Target</p>", choices: [] },
  ]
  await startWork(work, "hidden-heading")
  document.querySelector('.article-choice-btn[data-choice-id="show"]').click()

  assert.doesNotMatch(document.querySelector(".article-title").textContent, /Leaked conditional title|Source title|Target title/)
})

test("a conditional prelude is shown before a branch-target scene and scene exit returns to its branch source", async t => {
  installDom(t)
  const work = {
    schemaVersion: 3,
    id: "reader-scene-prelude",
    type: "article",
    title: "Scene prelude",
    placeholders: [], scenes: [], phoneModules: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "source",
    nodes: [
      { id: "source", title: "Source", chapterId: "chapter", content: "<p>Source</p>", choices: [{ id: "scene-choice", mode: "branch", text: "Enter", targetId: "scene-node" }] },
      { id: "prelude", kind: "conditional", title: "Scene prelude title", chapterId: "chapter", content: "<p>Scene prelude prose</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["scene-choice"] }] } },
      { id: "scene-node", title: "Scene", chapterId: "chapter", kind: "interactive-scene", interactiveSceneId: "scene-1", content: "", choices: [] },
    ],
    interactiveScenes: [{
      id: "scene-1", nodeId: "scene-node", title: "Scene", startStageId: "stage-1",
      stages: [{ id: "stage-1", image: "https://example.test/scene.jpg", dialogue: { speaker: "Narrator", text: "Scene" }, hotspots: [] }],
    }],
  }
  await startWork(work, "scene-prelude")
  document.querySelector('.article-choice-btn[data-choice-id="scene-choice"]').click()

  assert.match(document.querySelector(".article-reader").textContent, /Scene prelude prose/)
  assert.ok(document.querySelector("[data-reader-enter-interactive-scene]"))
  assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
  document.querySelector("[data-reader-enter-interactive-scene]").click()
  assert.ok(document.querySelector(".rd-interactive-scene-page"))
  document.querySelector(".rd-interactive-scene-exit").click()
  assert.match(document.querySelector(".article-reader").textContent, /Source/)
  assert.equal(document.querySelector(".rd-home"), null)
})

test("a failed branch transition never commits visibility memory", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-failed-choice-transaction"
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "source"
  work.nodes = [
    {
      id: "source", title: "Source", chapterId: "chapter-one", content: "<p>Source</p>",
      choices: [
        { id: "leak", mode: "branch", text: "Leak", targetId: "target" },
        { id: "safe", mode: "branch", text: "Safe", targetId: "target" },
      ],
    },
    { id: "prelude", kind: "conditional", title: "Private", chapterId: "chapter-one", content: "<p>Transaction-secret</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["leak"] }] } },
    { id: "target", title: "Target", chapterId: "chapter-one", content: "<p>Target</p>", choices: [] },
  ]
  await startWork(work, "failed-choice-transaction")

  const malformed = document.querySelector('.article-choice-btn[data-choice-id="leak"]')
  malformed.dataset.sourcePathIndex = "999"
  malformed.click()
  document.querySelector('.article-choice-btn[data-choice-id="safe"]').click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Transaction-secret/)
})

test("a malformed choice ID cannot reveal conditional prose", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-malformed-choice-id"
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "source"
  work.nodes = [
    { id: "source", title: "Source", chapterId: "chapter-one", content: "<p>Source</p>", choices: [{ id: "valid", mode: "branch", text: "Open", targetId: "target" }] },
    { id: "prelude", kind: "conditional", title: "Private", chapterId: "chapter-one", content: "<p>Malformed-secret</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["valid"] }] } },
    { id: "target", title: "Target", chapterId: "chapter-one", content: "<p>Target</p>", choices: [] },
  ]
  await startWork(work, "malformed-choice-id")

  const button = document.querySelector('.article-choice-btn[data-choice-id="valid"]')
  button.dataset.choiceId = " malformed "
  button.click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Malformed-secret/)
})

function repeatedSelectionWork() {
  return {
    schemaVersion: 3,
    id: "reader-repeated-selection",
    type: "article",
    title: "Repeated selection",
    placeholders: [], scenes: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "a",
    nodes: [
      {
        id: "a", title: "A", chapterId: "chapter", content: "<p>A</p>",
        choices: [
          { id: "a-initial", mode: "branch", text: "Initial", targetId: "b" },
          { id: "a-later", mode: "branch", text: "Later", targetId: "b" },
          { id: "a-fresh-branch", mode: "branch", text: "Fresh branch", targetId: "b" },
          { id: "a-fresh-interaction", mode: "interaction", text: "Fresh interaction", selectedText: "Fresh response", targetId: "" },
        ],
      },
      { id: "stale", kind: "conditional", title: "Stale title", chapterId: "chapter", content: "<p>Stale-repeat</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["a-later"] }] } },
      { id: "fresh-branch", kind: "conditional", title: "Fresh branch title", chapterId: "chapter", content: "<p>Fresh-branch</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["a-fresh-branch"] }] } },
      { id: "fresh-interaction", kind: "conditional", title: "Fresh interaction title", chapterId: "chapter", content: "<p>Fresh-interaction</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["a-fresh-interaction"] }] } },
      { id: "b", title: "B", chapterId: "chapter", content: "<p>B</p>", choices: [{ id: "b-to-c", mode: "branch", text: "B to C", targetId: "c" }] },
      { id: "c", title: "C", chapterId: "chapter", content: "<p>C</p>", choices: [{ id: "c-to-a", mode: "branch", text: "C to A", targetId: "a" }] },
    ],
  }
}

function reachLaterAThenB() {
  document.querySelector('.article-choice-btn[data-choice-id="a-initial"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="b-to-c"]').click()
  document.querySelector('.article-choice-btn[data-choice-id="c-to-a"]').click()
  ;[...document.querySelectorAll('.article-choice-btn[data-choice-id="a-later"]')].at(-1).click()
  assert.match(document.querySelector(".article-reader").textContent, /Stale-repeat/)
}

test("an earlier repeated branch selection prunes stale later memory before computing visibility", async t => {
  installDom(t)
  await startWork(repeatedSelectionWork(), "repeated-fresh-branch")
  reachLaterAThenB()

  document.querySelector('.article-choice-btn[data-source-path-index="0"][data-choice-id="a-fresh-branch"]').click()
  const fresh = document.querySelector('.article-choice-btn[data-source-path-index="0"][data-choice-id="a-fresh-branch"]')
  assert.equal(fresh.getAttribute("aria-pressed"), "true")
  assert.match(document.querySelector(".article-reader").textContent, /Fresh-branch/)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Stale-repeat/)
})

test("an earlier repeated interaction selection prunes stale later memory before computing visibility", async t => {
  installDom(t)
  const work = repeatedSelectionWork()
  work.id = "reader-repeated-fresh-interaction"
  await startWork(work, "repeated-fresh-interaction")
  reachLaterAThenB()

  document.querySelector('.article-choice-btn[data-source-path-index="0"][data-choice-id="a-fresh-interaction"]').click()
  const fresh = document.querySelector('.article-choice-btn[data-source-path-index="0"][data-choice-id="a-fresh-interaction"]')
  assert.equal(fresh.getAttribute("aria-pressed"), "true")
  assert.match(document.querySelector(".article-interaction-response").textContent, /Fresh response/)
  assert.match(document.querySelector(".article-reader").textContent, /Fresh-interaction/)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Stale-repeat/)
})

test("a malformed re-selection clears an existing valid source choice before it can reveal prose", async t => {
  installDom(t)
  const work = hiddenNodeWork()
  work.id = "reader-malformed-reselection"
  work.chapters = [{ id: "chapter-one", name: "Chapter" }]
  work.startNode = "source"
  work.nodes = [
    { id: "source", title: "Source", chapterId: "chapter-one", content: "<p>Source</p>", choices: [{ id: "valid", mode: "branch", text: "Open", targetId: "target" }] },
    { id: "prelude", kind: "conditional", title: "Private", chapterId: "chapter-one", content: "<p>Reselection-secret</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["valid"] }] } },
    { id: "target", title: "Target", chapterId: "chapter-one", content: "<p>Target</p>", choices: [] },
  ]
  await startWork(work, "malformed-reselection")
  document.querySelector('.article-choice-btn[data-choice-id="valid"]').click()
  assert.match(document.querySelector(".article-reader").textContent, /Reselection-secret/)

  const malformed = document.querySelector('.article-choice-btn[data-choice-id="valid"]')
  malformed.dataset.choiceId = " malformed "
  malformed.click()
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /Reselection-secret/)
  assert.equal(document.querySelector('.article-choice-btn[data-target="target"]').getAttribute("aria-pressed"), "false")
})

test("scene prelude gates keep same-page source choices operable", async t => {
  installDom(t)
  const work = {
    schemaVersion: 3,
    id: "reader-scene-prelude-reselect",
    type: "article",
    title: "Scene prelude reselect",
    placeholders: [], scenes: [], phoneModules: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "source",
    nodes: [
      { id: "source", title: "Source", chapterId: "chapter", content: "<p>Source</p>", choices: [{ id: "scene-choice", mode: "branch", text: "Enter", targetId: "scene-node" }, { id: "alternate", mode: "branch", text: "Alternate", targetId: "alternate-node" }] },
      { id: "prelude", kind: "conditional", title: "Scene prelude", chapterId: "chapter", content: "<p>Scene gate prose</p>", choices: [], displayCondition: { all: [{ anyChoiceIds: ["scene-choice"] }] } },
      { id: "scene-node", title: "Scene", chapterId: "chapter", kind: "interactive-scene", interactiveSceneId: "scene-1", content: "", choices: [] },
      { id: "alternate-node", title: "Alternate", chapterId: "chapter", content: "<p>Alternate prose</p>", choices: [] },
    ],
    interactiveScenes: [{ id: "scene-1", nodeId: "scene-node", title: "Scene", startStageId: "stage-1", stages: [{ id: "stage-1", image: "https://example.test/scene.jpg", dialogue: { speaker: "Narrator", text: "Scene" }, hotspots: [] }] }],
  }
  await startWork(work, "scene-prelude-reselect")
  document.querySelector('.article-choice-btn[data-choice-id="scene-choice"]').click()
  assert.ok(document.querySelector("[data-reader-enter-interactive-scene]"))
  document.querySelector('.article-choice-btn[data-choice-id="alternate"]').click()
  assert.match(document.querySelector(".article-reader").textContent, /Alternate prose/)
  assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
})

test("reader keeps sibling choice targets hidden and joins the unreferenced mainline afterward", async t => {
  installDom(t)
  const work = {
    schemaVersion: 3,
    id: "reader-implicit-branch-merge",
    type: "article",
    title: "Implicit branch merge",
    placeholders: [],
    scenes: [],
    phoneModules: [],
    interactiveScenes: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "node-3",
    nodes: [
      {
        id: "node-1",
        title: "Node 1",
        chapterId: "chapter",
        content: "<p>Opening-only</p>",
        choices: [
          { id: "choice-a", mode: "branch", text: "A", targetId: "node-2" },
          { id: "choice-b", mode: "branch", text: "B", targetId: "node-3" },
        ],
      },
      { id: "node-2", title: "Node 2", chapterId: "chapter", content: "<p>Branch-A-only</p>", choices: [] },
      { id: "node-3", title: "Node 3", chapterId: "chapter", content: "<p>Branch-B-only</p>", choices: [] },
      { id: "node-4", title: "Node 4", chapterId: "chapter", content: "<p>Merged-mainline</p>", choices: [] },
    ],
  }

  await startWork(work, "implicit-branch-merge")
  let readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Opening-only/)
  assert.doesNotMatch(readerText, /Branch-A-only|Branch-B-only|Merged-mainline/)

  document.querySelector('[data-choice-id="choice-a"]').click()
  readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Opening-only/)
  assert.match(readerText, /Branch-A-only/)
  assert.match(readerText, /Merged-mainline/)
  assert.doesNotMatch(readerText, /Branch-B-only/)

  document.querySelector('[data-choice-id="choice-b"]').click()
  readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Opening-only/)
  assert.match(readerText, /Branch-B-only/)
  assert.match(readerText, /Merged-mainline/)
  assert.doesNotMatch(readerText, /Branch-A-only/)
})
