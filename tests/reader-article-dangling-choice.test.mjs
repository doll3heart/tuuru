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
  return dom
}

test("reader disables a dangling article choice instead of silently restarting", async t => {
  installDom(t)
  const work = {
    schemaVersion: 1,
    id: "dangling-choice-work",
    type: "article",
    title: "Target guard",
    nodes: [
      {
        id: "start",
        title: "Start",
        content: "<p>Opening</p>",
        choices: [
          { id: "valid-choice", text: "Continue", targetId: "ending" },
          { id: "dangling-choice", text: "Deleted route", targetId: "missing-node" },
        ],
      },
      { id: "ending", title: "Ending", content: "<p>Done</p>", choices: [] },
    ],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    startNode: "start",
  }
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))

  await import(`../reader/reader.js?dangling-choice=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.querySelector("#rdStartBtn").click()

  const choices = [...document.querySelectorAll(".article-choice-btn")]
  assert.equal(choices.length, 2)
  assert.equal(choices[0].disabled, false)
  assert.equal(choices[1].disabled, true)
  assert.match(choices[1].textContent, /去向已失效/)
  assert.equal(document.querySelector(".article-title").textContent, "Start")

  choices[1].click()
  assert.equal(document.querySelector(".article-title").textContent, "Start")

  choices[0].click()
  assert.equal(document.querySelector(".article-title").textContent, "Ending")
})
