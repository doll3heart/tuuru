import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {url:"http://localhost/reader/"})
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

function gameWork() {
  return {
    schemaVersion:4,
    id:"reader-random-game",
    type:"article",
    title:"Random game",
    author:"Author",
    placeholders:[], scenes:[], interactiveScenes:[], phoneModules:[],
    chapters:[{id:"chapter-a", name:"第一章"}],
    startNode:"start",
    nodes:[
      {
        id:"start", title:"开始", chapterId:"chapter-a",
        content:'<p>骰子已经准备好了。</p><div class="article-interaction-anchor" data-article-interaction-group="game-a" contenteditable="false"></div><p>这段在判定前不能出现。</p>',
        interactionGroups:[{
          id:"game-a", kind:"random-game", label:"命运骰",
          game:{type:"dice", sides:6, buttonLabel:"掷骰子"},
          choices:[
            {id:"low", text:"低点数", selectedText:"骰子停在低点数。", targetId:"low-node", rangeMin:1, rangeMax:3},
            {id:"high", text:"高点数", selectedText:"骰子停在高点数。", targetId:"high-node", rangeMin:4, rangeMax:6},
          ],
        }],
        choices:[],
      },
      {id:"low-node", title:"低点数路线", chapterId:"chapter-a", content:"<p>进入低点数剧情。</p>", interactionGroups:[], choices:[]},
      {id:"high-node", title:"高点数路线", chapterId:"chapter-a", content:"<p>进入高点数剧情。</p>", interactionGroups:[], choices:[]},
    ],
  }
}

async function startWork(work, key) {
  localStorage.setItem("moirain_recent", JSON.stringify([{id:work.id, title:work.title, type:work.type, importedAt:Date.now()}]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?${key}=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
}

test("a random game gates prose, rolls once, records the value, and follows its authored target", async t => {
  installDom(t)
  const work = gameWork()
  await startWork(work, "random-game")

  const game = document.querySelector(".article-random-game")
  assert.ok(game)
  assert.match(game.textContent, /命运骰|D6/)
  assert.doesNotMatch(document.body.textContent, /这段在判定前不能出现|进入低点数剧情|进入高点数剧情/)

  game.querySelector("[data-random-game-roll]").click()

  const result = document.querySelector(".article-random-game-result")
  assert.ok(result)
  assert.match(result.textContent, /本次点数：[1-6]/)
  const body = document.body.textContent
  assert.match(body, /进入低点数剧情|进入高点数剧情/)
  assert.equal(/进入低点数剧情/.test(body) && /进入高点数剧情/.test(body), false)
  assert.match(body, /这段在判定前不能出现/)

  const library = JSON.parse(localStorage.getItem("moirain_readerLibrary"))
  const selection = library.books[0].progress.interactionSelections["game-a"]
  assert.match(selection.choiceId, /low|high/)
  assert.equal(selection.gameResult.type, "dice")
  assert.ok(selection.gameResult.value >= 1 && selection.gameResult.value <= 6)
  assert.equal(document.querySelector("[data-random-game-roll]"), null)
})
