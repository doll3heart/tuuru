import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
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

function workFixture() {
  return {
    schemaVersion:4,
    id:"reader-inline-groups",
    type:"article",
    title:"Inline groups",
    author:"Author",
    placeholders:[],
    scenes:[],
    interactiveScenes:[],
    phoneModules:[],
    chapters:[{id:"chapter-a", name:"第一章"}],
    startNode:"start",
    nodes:[
      {
        id:"start",
        title:"开始",
        chapterId:"chapter-a",
        content:[
          "<p>第一段</p>",
          '<div class="article-interaction-anchor" data-article-interaction-group="group-a" contenteditable="false"></div>',
          "<p>第二段</p>",
          '<div class="article-interaction-anchor" data-article-interaction-group="group-b" contenteditable="false"></div>',
          "<p>第三段</p>",
        ].join(""),
        interactionGroups:[
          {
            id:"group-a",
            label:"第一反应",
            choices:[
              {id:"ordinary-a", text:"点头", selectedText:"你点了点头。\n然后认真听下去。"},
              {id:"ordinary-a2", text:"摇头", selectedText:"你摇了摇头。"},
            ],
          },
          {
            id:"group-b",
            label:"第二反应",
            choices:[
              {id:"ordinary-b", text:"追问", selectedText:"你继续追问。"},
              {id:"ordinary-b2", text:"沉默", selectedText:"你保持沉默。"},
            ],
          },
        ],
        choices:[
          {id:"branch-a", text:"继续", targetId:"target"},
          {id:"branch-b", text:"回头", targetId:"alternate"},
        ],
      },
      {
        id:"memory",
        kind:"conditional",
        title:"隐藏",
        chapterId:"chapter-a",
        content:"<p>两次反应共同触发的隐藏内容</p>",
        interactionGroups:[],
        choices:[],
        displayCondition:{all:[
          {anyChoiceIds:["ordinary-a"]},
          {anyChoiceIds:["ordinary-b"]},
        ]},
      },
      {
        id:"target",
        title:"目标",
        chapterId:"chapter-a",
        content:"<p>目标正文</p>",
        interactionGroups:[],
        choices:[],
      },
      {
        id:"alternate",
        title:"另一边",
        chapterId:"chapter-a",
        content:"<p>另一边正文</p>",
        interactionGroups:[],
        choices:[],
      },
    ],
  }
}

async function startWork(work, key) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id, title:work.title, type:work.type, importedAt:Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

test("inline ordinary groups progressively reveal prose before the tail branch", async t => {
  installDom(t)
  await startWork(workFixture(), "inline-groups-independent")

  assert.equal(document.querySelectorAll(".article-interaction-group").length, 1)
  assert.match(document.body.textContent, /第一段/)
  assert.doesNotMatch(document.body.textContent, /第二段|第三段/)
  assert.equal(document.querySelectorAll(".article-choices.is-branch").length, 0)

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').click()
  assert.equal(document.querySelectorAll(".article-interaction-response p").length, 2)
  assert.equal(document.querySelectorAll(".article-interaction-group").length, 2)
  assert.match(document.body.textContent, /第二段/)
  assert.doesNotMatch(document.body.textContent, /第三段/)
  assert.equal(document.querySelectorAll(".article-choices.is-branch").length, 0)
  assert.doesNotMatch(document.body.textContent, /目标正文/)

  document.querySelector('[data-interaction-group-id="group-b"][data-choice-id="ordinary-b"]').click()
  assert.equal(document.querySelectorAll(".article-interaction-response").length, 2)
  assert.match(document.body.textContent, /第三段/)
  assert.equal(document.querySelectorAll(".article-choices.is-branch").length, 1)
  assert.equal(document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').getAttribute("aria-pressed"), "true")
  assert.equal(document.querySelector('[data-interaction-group-id="group-b"][data-choice-id="ordinary-b"]').getAttribute("aria-pressed"), "true")
  assert.doesNotMatch(document.body.textContent, /目标正文/)
})

test("an ordinary interaction gates the following scene until it is selected", async t => {
  installDom(t)
  const work = workFixture()
  work.id = "reader-inline-following-scene-gate"
  work.nodes[0].content = [
    "<p>互动前</p>",
    '<div class="article-interaction-anchor" data-article-interaction-group="group-a" contenteditable="false"></div>',
    "<p>互动后</p>",
  ].join("")
  work.nodes[0].interactionGroups = [work.nodes[0].interactionGroups[0]]
  work.nodes[0].choices = []
  work.nodes.splice(1, 0, {
    id:"following-scene",
    title:"第二个场景",
    chapterId:"chapter-a",
    content:"<p>第二个场景正文</p>",
    interactionGroups:[],
    choices:[{id:"scene-branch", text:"继续", targetId:"target"}],
  })
  await startWork(work, "inline-following-scene-gate")

  assert.match(document.body.textContent, /互动前/)
  assert.doesNotMatch(document.body.textContent, /互动后|第二个场景正文/)
  assert.equal(document.querySelector("[data-reader-next]"), null)

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').click()

  assert.match(document.body.textContent, /互动后/)
  assert.match(document.body.textContent, /第二个场景正文/)
})

test("ordinary interaction copy substitutes reader placeholders", async t => {
  installDom(t)
  const work = workFixture()
  work.id = "reader-inline-placeholder-copy"
  work.placeholders = [{
    id:"reader-name",
    key:"NAME",
    label:"读者姓名",
    values:["默认名"],
  }]
  work.readerPhValues = {"reader-name":["阿雾"]}
  work.nodes[0].content = [
    "<p>NAME走近了。</p>",
    '<div class="article-interaction-anchor" data-article-interaction-group="group-a" contenteditable="false"></div>',
  ].join("")
  work.nodes[0].interactionGroups = [{
    id:"group-a",
    label:"NAME的反应",
    choices:[
      {id:"ordinary-a", text:"向NAME点头", selectedText:"NAME也向你点了点头。"},
      {id:"ordinary-a2", text:"避开NAME", selectedText:"你避开了NAME。"},
    ],
  }]
  work.nodes[0].choices = [{id:"branch-a", text:"跟随NAME", targetId:"target"}]
  await startWork(work, "inline-placeholder-copy")

  assert.match(document.querySelector(".article-interaction-label").textContent, /阿雾的反应/)
  assert.match(document.querySelector('[data-choice-id="ordinary-a"]').textContent, /向阿雾点头/)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /NAME/)

  document.querySelector('[data-choice-id="ordinary-a"]').click()

  assert.match(document.querySelector(".article-interaction-response").textContent, /阿雾也向你点了点头/)
  assert.match(document.querySelector('[data-choice-id="branch-a"]').textContent, /跟随阿雾/)
  assert.doesNotMatch(document.querySelector(".article-reader").textContent, /NAME/)
})

test("ordinary selections from separate groups jointly unlock a hidden prelude", async t => {
  installDom(t)
  await startWork(workFixture(), "inline-groups-hidden")

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').click()
  document.querySelector('[data-interaction-group-id="group-b"][data-choice-id="ordinary-b"]').click()
  document.querySelector('.article-choices.is-branch [data-choice-id="branch-a"]').click()

  assert.match(document.body.textContent, /两次反应共同触发的隐藏内容/)
  assert.match(document.body.textContent, /目标正文/)
})

test("reselecting an ordinary choice immediately reconciles hidden prose without losing the route", async t => {
  installDom(t)
  await startWork(workFixture(), "inline-groups-reselection")

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').click()
  document.querySelector('[data-interaction-group-id="group-b"][data-choice-id="ordinary-b"]').click()
  document.querySelector('.article-choices.is-branch [data-choice-id="branch-a"]').click()

  assert.match(document.body.textContent, /两次反应共同触发的隐藏内容/)
  assert.match(document.body.textContent, /目标正文/)

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a2"]').click()

  assert.doesNotMatch(document.body.textContent, /两次反应共同触发的隐藏内容/)
  assert.match(document.body.textContent, /目标正文/)

  document.querySelector('[data-interaction-group-id="group-a"][data-choice-id="ordinary-a"]').click()

  assert.match(document.body.textContent, /两次反应共同触发的隐藏内容/)
  assert.match(document.body.textContent, /目标正文/)
})
