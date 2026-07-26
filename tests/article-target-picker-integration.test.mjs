import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { readFile } from "node:fs/promises"

const stylesSource = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

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

function render(choices = null) {
  document.querySelectorAll(".modal-overlay").forEach(overlay => overlay.remove())
  const snapshot = structuredClone(work)
  if (choices) {
    snapshot.schemaVersion = 4
    snapshot.nodes[0].choices = choices
  }
  localStorage.setItem("tuuru_works", JSON.stringify({ works: [snapshot], contacts: [], groups: [] }))
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

test("an option group can be saved as ordinary interaction without branch targets", () => {
  render()
  const panel = openChoices()
  const mode = panel.querySelector("#chMode")
  assert.ok(mode)
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles:true }))
  assert.ok([...panel.querySelectorAll(".ch-target-pick")].every(button => button.hidden))
  panel.querySelectorAll(".ch-text")[0].value = "点点头"
  panel.querySelectorAll(".ch-text")[1].value = "摇摇头"
  panel.querySelector('[data-ch-a="save"]').click()

  const choices = getWork(work.id).nodes[0].choices
  assert.deepEqual(choices.map(choice => [choice.text, choice.mode, choice.targetId]), [
    ["点点头", "interaction", ""],
    ["摇摇头", "interaction", ""],
  ])
})

test("ordinary interaction rows expose a labeled multiline post-selection copy field", () => {
  render()
  const panel = openChoices()
  const mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))

  const first = panel.querySelector(".ch-item")
  const optionText = first.querySelector(".ch-text")
  const selectedText = first.querySelector(".ch-selected-text")
  assert.ok(optionText)
  assert.ok(selectedText)
  assert.equal(optionText.getAttribute("aria-label"), "选项文本")
  assert.equal(selectedText.getAttribute("aria-label"), "选择后内容")
  assert.equal(selectedText.tagName, "TEXTAREA")
  assert.ok(Number(selectedText.getAttribute("rows")) >= 3)
  assert.match(optionText.placeholder, /按钮/)
  assert.match(selectedText.placeholder, /选择后/)
  assert.match(first.querySelector(".ch-choice-text .ch-field-help").textContent, /按钮/)
  assert.match(first.querySelector(".ch-selected-field .ch-field-help").textContent, /每行.*正文段落/)
  assert.equal(selectedText.closest(".ch-field").hidden, false)
})

test("authored multiline response survives target picking, mode switching, saving, and reopening", () => {
  const response = "第一行\n\n末行 <b>仍是文字</b>"
  render([
    { id: "choice-a", text: "分支按钮", selectedText: response, targetId: "node-b" },
    { id: "choice-b", text: "另一项", targetId: "node-a" },
  ])
  let panel = openChoices()
  let first = panel.querySelector(".ch-item")
  assert.equal(first.querySelector(".ch-selected-text").value, response)
  first.querySelector(".ch-target-pick").click()
  document.querySelector('[data-a="target-select"][data-n="node-c"]').click()

  panel = document.querySelector(".ch-panel")
  const mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  first = panel.querySelector(".ch-item")
  assert.equal(first.querySelector(".ch-selected-text").value, response)
  panel.querySelector('[data-ch-a="save"]').click()

  assert.equal(getWork(work.id).nodes[0].choices[0].selectedText, response)
  document.getElementById("app").innerHTML = renderEditor(work.id)
  panel = openChoices()
  assert.equal(panel.querySelector(".ch-selected-text").value, response)
})

test("an untouched response preserves its original CRLF and CR bytes through picker, save, and reopen", () => {
  const response = "A\r\nB\rC\nD"
  render([
    { id: "choice-a", text: "分支按钮", selectedText: response, targetId: "node-b" },
    { id: "choice-b", text: "另一项", targetId: "node-a" },
  ])
  let panel = openChoices()
  panel.querySelector(".ch-target-pick").click()
  document.querySelector('[data-a="target-select"][data-n="node-c"]').click()

  panel = document.querySelector(".ch-panel")
  const mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  panel.querySelector('[data-ch-a="save"]').click()
  assert.equal(getWork(work.id).nodes[0].choices[0].selectedText, response)

  document.getElementById("app").innerHTML = renderEditor(work.id)
  panel = openChoices()
  panel.querySelector("#chMode").value = "interaction"
  panel.querySelector("#chMode").dispatchEvent(new window.Event("change", { bubbles: true }))
  panel.querySelector('[data-ch-a="save"]').click()
  assert.equal(getWork(work.id).nodes[0].choices[0].selectedText, response)
})

test("a real textarea edit may normalize line endings after the pristine response is replaced", () => {
  const original = "A\r\nB\rC\nD"
  render([
    { id: "choice-a", text: "按钮", selectedText: original, mode: "interaction", targetId: "" },
    { id: "choice-b", text: "另一项", mode: "interaction", targetId: "" },
  ])
  const panel = openChoices()
  const selected = panel.querySelector(".ch-selected-text")
  selected.value = "edited\r\nline"
  selected.dispatchEvent(new window.Event("input", { bubbles: true }))
  panel.querySelector('[data-ch-a="save"]').click()

  assert.equal(getWork(work.id).nodes[0].choices[0].selectedText, "edited\nline")
})

test("existing and newly added authored responses remain dormant through a branch save and reopen", () => {
  const existingResponse = "已有回应\n第二行"
  const newResponse = "新增回应\n第二行"
  render([
    { id: "choice-a", text: "已有按钮", selectedText: existingResponse, mode: "interaction", targetId: "" },
    { id: "choice-b", text: "另一项", mode: "interaction", targetId: "" },
  ])
  let panel = openChoices()
  panel.querySelector('[data-ch-a="add-choice"]').click()
  const added = panel.querySelectorAll(".ch-item")[2]
  added.querySelector(".ch-text").value = "新增按钮"
  const addedResponse = added.querySelector(".ch-selected-text")
  addedResponse.value = newResponse
  addedResponse.dispatchEvent(new window.Event("input", { bubbles: true }))
  const mode = panel.querySelector("#chMode")
  mode.value = "branch"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  ;[...panel.querySelectorAll(".ch-target-pick")].forEach((target, index) => {
    target.dataset.targetId = ["node-b", "node-c", "node-a"][index]
  })
  panel.querySelector('[data-ch-a="save"]').click()

  const saved = getWork(work.id).nodes[0].choices
  assert.deepEqual(saved.map(choice => choice.id).slice(0, 2), ["choice-a", "choice-b"])
  assert.equal(saved[0].selectedText, existingResponse)
  assert.equal(saved[2].selectedText, newResponse)
  assert.equal(saved[2].mode, undefined)
  const newId = saved[2].id

  document.getElementById("app").innerHTML = renderEditor(work.id)
  panel = openChoices()
  const reopenedMode = panel.querySelector("#chMode")
  reopenedMode.value = "interaction"
  reopenedMode.dispatchEvent(new window.Event("change", { bubbles: true }))
  const reopened = panel.querySelectorAll(".ch-item")
  assert.equal(reopened[0].dataset.choiceId, "choice-a")
  assert.equal(reopened[2].dataset.choiceId, newId)
  assert.equal(reopened[0].querySelector(".ch-selected-text").value, existingResponse)
  assert.equal(reopened[2].querySelector(".ch-selected-text").value, newResponse)
})

test("a new interaction row starts with two empty copy inputs", () => {
  render()
  const panel = openChoices()
  const mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  panel.querySelector('[data-ch-a="add-choice"]').click()

  const added = panel.querySelectorAll(".ch-item")[2]
  assert.equal(added.querySelector(".ch-text").value, "")
  assert.equal(added.querySelector(".ch-selected-text").value, "")
})

test("interaction mode gives legacy choices a separate response fallback and persists both fields with stable ids", () => {
  render([
    { id: "choice-a", text: "旧选项", mode: "interaction", targetId: "" },
    { id: "choice-b", text: "保留", mode: "interaction", targetId: "" },
  ])
  const panel = openChoices()
  const first = panel.querySelector(".ch-item")
  assert.equal(first.querySelector(".ch-selected-text").value, "旧选项")

  first.querySelector(".ch-text").value = "按钮上的文字"
  const selectedInput = first.querySelector(".ch-selected-text")
  selectedInput.value = "读者点击后显示的内容"
  selectedInput.dispatchEvent(new window.Event("input", { bubbles: true }))
  panel.querySelector('[data-ch-a="save"]').click()

  const choices = getWork(work.id).nodes[0].choices
  assert.deepEqual(choices.map(choice => choice.id), ["choice-a", "choice-b"])
  assert.deepEqual(choices[0], {
    id: "choice-a",
    text: "按钮上的文字",
    selectedText: "读者点击后显示的内容",
    mode: "interaction",
    targetId: "",
  })
})

test("choice copy textarea round-trips quotes, markup, closing tags, and newlines without injection", () => {
  const optionPayload = 'button " & < > "><img onerror="globalThis.choiceXss=1">'
  const selectedPayload = 'response " & < > </textarea><img onerror="globalThis.choiceXss=2">\nsecond line'
  render([
    { id: "choice-a", text: optionPayload, selectedText: selectedPayload, mode: "interaction", targetId: "" },
    { id: "choice-b", text: "safe", selectedText: "safe response", mode: "interaction", targetId: "" },
  ])
  const panel = openChoices()
  const first = panel.querySelector(".ch-item")

  assert.equal(first.querySelector(".ch-text").value, optionPayload)
  assert.equal(first.querySelector(".ch-selected-text").value, selectedPayload)
  assert.equal(first.querySelectorAll("img").length, 0)
  assert.equal(first.querySelectorAll("[onerror]").length, 0)
  assert.equal(globalThis.choiceXss, undefined)
})

test("legacy fallback follows the current branch label through target-picker roundtrips without becoming authored", () => {
  render()
  let panel = openChoices()
  let first = panel.querySelector(".ch-item")
  first.querySelector(".ch-text").value = "current unsaved branch label"
  first.querySelector(".ch-target-pick").click()
  document.querySelector('[data-a="target-select"][data-n="node-c"]').click()

  panel = document.querySelector(".ch-panel")
  first = panel.querySelector(".ch-item")
  const mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))

  assert.equal(first.querySelector(".ch-selected-text").dataset.selectedAuthored, "false")
  assert.equal(first.querySelector(".ch-selected-text").value, "current unsaved branch label")
  assert.equal(Object.hasOwn(getWork(work.id).nodes[0].choices[0], "selectedText"), false)
  panel.querySelector('[data-ch-a="save"]').click()
  const saved = getWork(work.id).nodes[0].choices[0]
  assert.equal(saved.text, "current unsaved branch label")
  assert.equal(Object.hasOwn(saved, "selectedText"), false)
})

test("new branch rows retain a current-label fallback while authored selected copy survives target-picker roundtrips", () => {
  render([
    { id: "choice-a", text: "branch label", selectedText: "authored response", targetId: "node-b" },
    { id: "choice-b", text: "second branch", targetId: "node-a" },
  ])
  let panel = openChoices()
  let first = panel.querySelector(".ch-item")
  first.querySelector(".ch-text").value = "edited branch label"
  first.querySelector(".ch-target-pick").click()
  document.querySelector('[data-a="target-select"][data-n="node-c"]').click()

  panel = document.querySelector(".ch-panel")
  first = panel.querySelector(".ch-item")
  let mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  assert.equal(first.querySelector(".ch-selected-text").value, "authored response")

  render()
  panel = openChoices()
  panel.querySelector('[data-ch-a="add-choice"]').click()
  let added = panel.querySelectorAll(".ch-item")[2]
  added.querySelector(".ch-text").value = "new branch draft"
  added.querySelector(".ch-target-pick").click()
  document.querySelector('[data-a="target-select"][data-n="node-c"]').click()
  panel = document.querySelector(".ch-panel")
  mode = panel.querySelector("#chMode")
  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  added = panel.querySelectorAll(".ch-item")[2]
  assert.equal(added.querySelector(".ch-selected-text").dataset.selectedAuthored, "false")
  assert.equal(added.querySelector(".ch-selected-text").value, "new branch draft")
})

test("switching choice modes keeps draft option text and preserves an authored selected response", () => {
  render([
    { id: "choice-a", text: "分支文本", selectedText: "已写回应", targetId: "node-b" },
    { id: "choice-b", text: "另一个分支", targetId: "node-a" },
  ])
  const panel = openChoices()
  const mode = panel.querySelector("#chMode")
  const first = panel.querySelector(".ch-item")
  first.querySelector(".ch-text").value = "未保存的按钮文案"

  mode.value = "interaction"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  assert.equal(first.querySelector(".ch-text").value, "未保存的按钮文案")
  assert.equal(first.querySelector(".ch-selected-text").value, "已写回应")

  mode.value = "branch"
  mode.dispatchEvent(new window.Event("change", { bubbles: true }))
  assert.equal(first.querySelector(".ch-selected-text").closest(".ch-field").hidden, true)
  assert.equal(first.dataset.choiceId, "choice-a")
})

test("the 480px layout positions choice field wrappers, not their nested inputs", () => {
  const mobileCss = cssBlockAfterMarker(stylesSource, "@media(max-width:480px)")
  assert.ok(mobileCss)
  assert.match(mobileCss, /\.ch-choice-text\{grid-column:2\/-1\}/)
  assert.doesNotMatch(mobileCss, /\.ch-text\{grid-column/)

  const style = document.createElement("style")
  style.textContent = mobileCss
  document.head.append(style)
  const fixture = document.createElement("div")
  fixture.innerHTML = `
    <div class="ch-panel" data-choice-mode="branch"><div class="ch-item"><span class="ch-num"></span><label class="ch-field ch-choice-text"><input class="ch-text"></label><button class="ch-target-pick"></button><button class="ch-del-btn"></button></div></div>
    <div class="ch-panel" data-choice-mode="interaction"><div class="ch-item"><span class="ch-num"></span><label class="ch-field ch-choice-text"><input class="ch-text"></label><label class="ch-field ch-selected-field"><input class="ch-selected-text"></label><button class="ch-del-btn"></button></div></div>`
  document.body.append(fixture)

  const branchField = fixture.querySelector('[data-choice-mode="branch"] .ch-choice-text')
  const branchInput = branchField.querySelector(".ch-text")
  const interactionFields = fixture.querySelectorAll('[data-choice-mode="interaction"] .ch-field')
  assert.match(getComputedStyle(branchField).gridColumn.replace(/\s/g, ""), /^2\/-1$/)
  assert.equal(getComputedStyle(branchInput).gridColumn, "")
  assert.ok([...interactionFields].every(field => getComputedStyle(field).gridColumn.replace(/\s/g, "") === "2"))
  fixture.remove()
  style.remove()
})

test("deleting an option group persists immediately", () => {
  render()
  const panel = openChoices()
  panel.querySelector('[data-ch-a="delete-all"]').click()
  document.getElementById("cK").click()

  assert.deepEqual(getWork(work.id).nodes[0].choices, [])
  assert.equal(document.querySelector(".ch-panel"), null)
})

test("the structure tree exposes only the automatic start badge, not a manual start picker", () => {
  render()
  assert.equal(document.querySelector('[data-a="pick-start"]'), null)
  assert.ok(document.querySelector('.wt-node[data-node-id="node-a"] .wt-start-badge'))
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
