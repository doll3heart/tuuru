import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("the real reader substitutes placeholders in scene prompt, speaker, and reaction dialogue", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
    pretendToBeVisual: true,
  })
  const previousNavigator = globalThis.navigator
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
  t.after(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previousNavigator,
    })
    dom.window.close()
  })

  const work = {
    schemaVersion: 1,
    id: "placeholder-scene-work",
    type: "article",
    title: "宝宝文游",
    placeholders: [{
      id: "reader-name",
      key: "name",
      label: "姓名",
      prompt: "输入姓名",
      values: [],
    }],
    scenes: [],
    chapters: [{ id: "chapter-1", name: "第一章" }],
    startNode: "interactive-node-1",
    nodes: [{
      id: "interactive-node-1",
      title: "给name的互动",
      chapterId: "chapter-1",
      kind: "interactive-scene",
      interactiveSceneId: "touch-1",
      choices: [],
      content: "",
    }],
    phoneModules: [],
    interactiveScenes: [{
      id: "touch-1",
      nodeId: "interactive-node-1",
      title: "给name的互动",
      startStageId: "stage-1",
      stages: [{
        id: "stage-1",
        image: "https://example.test/background.jpg",
        characterImage: "https://example.test/character.png",
        prompt: "触碰name",
        dialogue: { speaker: "name", text: "name，水给你。" },
        hotspots: [{
          id: "hand",
          label: "name的手",
          x: 30,
          y: 30,
          width: 40,
          height: 40,
          trigger: "tap",
          speaker: "name",
          dialogue: "抓到name了。",
        }],
      }],
    }],
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?scene-placeholders=${Date.now()}-${Math.random()}`)

  document.querySelector(".rd-recent-item").click()
  const nameInput = document.querySelector('[data-ph-id="reader-name"]')
  nameInput.value = "阿雾"
  document.getElementById("rdStartBtn").click()

  assert.ok(document.querySelector(".rd-interactive-scene-page"))
  assert.equal(document.querySelector(".rd-interactive-scene-trigger"), null)
  assert.equal(document.querySelector(".interactive-scene-prompt").textContent, "触碰阿雾")
  assert.equal(document.querySelector(".interactive-scene-dialogue-speaker").textContent, "阿雾")
  assert.equal(document.querySelector(".interactive-scene-dialogue-text").textContent, "阿雾，水给你。")
  document.querySelector(".interactive-scene-hotspot").click()
  assert.equal(document.querySelector(".interactive-scene-dialogue-speaker").textContent, "阿雾")
  assert.equal(document.querySelector(".interactive-scene-dialogue-text").textContent, "抓到阿雾了。")
})
