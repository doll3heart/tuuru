import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url:"http://localhost/#/edit/module-transfer-ui",
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
globalThis.cancelAnimationFrame = () => {}
globalThis.alert = () => {}
globalThis.confirm = () => true
globalThis.prompt = () => null
document.execCommand = () => true
window.matchMedia = query => ({
  matches:false,
  media:query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

function moduleCard(id, type = "forum") {
  return `<div class="pm-inline-card" contenteditable="false" data-pm-id="${id}" data-pm-type="${type}" draggable="false"><span class="pm-card-label">论坛</span><button class="pm-card-hamburger" data-a="pm-hamburger" data-pm-id="${id}" type="button" aria-label="编辑或删除手机模块">≡</button></div>`
}

function workFixture(id = "module-transfer-ui") {
  return {
    id,
    schemaVersion:4,
    type:"article",
    title:"模块搬家",
    chapters:[
      {id:"chapter-a", name:"第一章"},
      {id:"chapter-b", name:"第二章"},
    ],
    scenes:[],
    placeholders:[],
    interactiveScenes:[],
    editorSettings:{},
    startNode:"node-a",
    nodes:[
      {
        id:"node-a", title:"旧节点", chapterId:"chapter-a",
        content:`<p>旧正文</p>${moduleCard("module-a")}`,
        choices:[], interactionGroups:[],
      },
      {
        id:"node-b", title:"新节点", chapterId:"chapter-b",
        content:"<p>新正文</p>", choices:[], interactionGroups:[],
      },
      {
        id:"hidden", title:"隐藏节点", kind:"conditional", chapterId:"chapter-b",
        content:"<p>隐藏</p>", choices:[], interactionGroups:[],
      },
      {
        id:"interactive", title:"互动页", kind:"interactive-scene", chapterId:"chapter-b",
        content:"", choices:[], interactionGroups:[],
      },
    ],
    phoneModules:[{
      id:"module-a", type:"forum", nodeId:"node-a",
      data:{posts:[{id:"post-a", title:"写好的帖子"}]},
    }],
  }
}

const {getWork, updateNode} = await import("../js/data.js")
const {renderEditor} = await import("../js/pages/editor.js")

function render(work = workFixture()) {
  document.querySelectorAll(".modal-overlay,.pm-context-menu,[data-feedback-root]").forEach(element => element.remove())
  localStorage.setItem("tuuru_works", JSON.stringify({works:[structuredClone(work)], contacts:[], groups:[]}))
  document.getElementById("app").innerHTML = renderEditor(work.id)
}

function openModuleMenu() {
  document.querySelector(".pm-card-hamburger").click()
  return document.querySelector(".pm-context-menu")
}

test("module menu moves a whole module through the existing cross-chapter target picker", () => {
  const work = workFixture()
  render(work)

  const menu = openModuleMenu()
  assert.deepEqual(
    [...menu.querySelectorAll("[data-pm-act]")].map(button => button.textContent.trim()),
    ["编辑", "移动到其他节点", "复制到其他节点", "删除"],
  )
  menu.querySelector('[data-pm-act="move"]').click()

  assert.match(document.querySelector(".target-picker-head").textContent, /移动手机模块/)
  assert.match(document.querySelector(".target-picker-head").textContent, /正文末尾/)
  assert.equal(document.querySelector('[data-a="target-select"][data-n="node-a"]').disabled, true)
  assert.equal(document.querySelector('[data-a="target-select"][data-n="hidden"]').disabled, true)
  assert.equal(document.querySelector('[data-a="target-select"][data-n="interactive"]').disabled, true)

  const nativeSetItem = window.Storage.prototype.setItem
  let databaseWrites = 0
  window.Storage.prototype.setItem = function(key, value) {
    if (key === "tuuru_works") databaseWrites += 1
    return nativeSetItem.call(this, key, value)
  }
  try {
    document.querySelector('[data-a="target-select"][data-n="node-b"]').click()
  } finally {
    window.Storage.prototype.setItem = nativeSetItem
  }

  const saved = getWork(work.id)
  assert.equal(databaseWrites, 1)
  assert.equal(saved.phoneModules[0].nodeId, "node-b")
  assert.doesNotMatch(saved.nodes[0].content, /module-a/)
  assert.match(saved.nodes[1].content, /module-a/)
  assert.ok(document.getElementById("ce_node-b"))
  assert.match(document.querySelector("[data-feedback-copy]").textContent, /已移动到/)

  document.querySelector("[data-feedback-action]").click()
  const restored = getWork(work.id)
  assert.equal(restored.phoneModules[0].nodeId, "node-a")
  assert.match(restored.nodes[0].content, /module-a/)
  assert.doesNotMatch(restored.nodes[1].content, /module-a/)
})

test("copy keeps the source module and appends an independent module at the destination", () => {
  const work = workFixture("module-transfer-copy-ui")
  render(work)

  const menu = openModuleMenu()
  menu.querySelector('[data-pm-act="copy"]').click()
  assert.match(document.querySelector(".target-picker-head").textContent, /复制手机模块/)
  assert.equal(document.querySelector('[data-a="target-select"][data-n="node-a"]').disabled, false)
  document.querySelector('[data-a="target-select"][data-n="node-b"]').click()

  const saved = getWork(work.id)
  assert.equal(saved.phoneModules.length, 2)
  assert.equal(saved.phoneModules[0].nodeId, "node-a")
  assert.equal(saved.phoneModules[1].nodeId, "node-b")
  assert.notEqual(saved.phoneModules[1].id, "module-a")
  assert.deepEqual(saved.phoneModules[1].data, saved.phoneModules[0].data)
  assert.match(saved.nodes[0].content, /module-a/)
  assert.match(saved.nodes[1].content, new RegExp(saved.phoneModules[1].id))
  assert.match(document.querySelector("[data-feedback-copy]").textContent, /已复制到/)
})

test("cancelling module transfer returns to its source without changing the work", () => {
  const work = workFixture("module-transfer-cancel-ui")
  render(work)
  openModuleMenu().querySelector('[data-pm-act="move"]').click()
  document.querySelector('[data-a="target-cancel"]').click()

  assert.ok(document.getElementById("ce_node-a"))
  assert.equal(getWork(work.id).phoneModules[0].nodeId, "node-a")
  assert.deepEqual(getWork(work.id).phoneModules[0].data.posts, work.phoneModules[0].data.posts)
  assert.equal(document.querySelector(".target-picker-head"), null)
})

test("transfer undo refuses to overwrite a newer edit", async () => {
  const work = workFixture("module-transfer-guarded-undo-ui")
  render(work)
  openModuleMenu().querySelector('[data-pm-act="move"]').click()
  document.querySelector('[data-a="target-select"][data-n="node-b"]').click()

  updateNode(work.id, "node-b", {title:"搬移后的新修改"})
  document.querySelector("[data-feedback-action]").click()
  await new Promise(resolve => setTimeout(resolve, 0))

  const current = getWork(work.id)
  assert.equal(current.phoneModules[0].nodeId, "node-b")
  assert.equal(current.nodes.find(node => node.id === "node-b").title, "搬移后的新修改")
  assert.match(document.querySelector("[data-feedback-copy]").textContent, /无法安全撤销/)
})
