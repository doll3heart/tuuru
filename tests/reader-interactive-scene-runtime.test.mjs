import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition-timeout")
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function installDom(t) {
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
  return dom
}

function cameraArticle() {
  return {
    schemaVersion: 1,
    id: "camera-article",
    type: "article",
    title: "掌心",
    placeholders: [],
    scenes: [],
    chapters: [{ id: "chapter-1", name: "第一章" }],
    startNode: "start",
    nodes: [{
      id: "start",
      title: "开始",
      chapterId: "chapter-1",
      choices: [{ id: "open-touch", text: "伸出手", targetId: "touch-node" }],
      content: '<p>伸出手。</p>',
    }, {
      id: "touch-node",
      title: "掌心",
      chapterId: "chapter-1",
      kind: "interactive-scene",
      interactiveSceneId: "touch-1",
      choices: [],
      content: "",
    }],
    phoneModules: [],
    interactiveScenes: [{
      id: "touch-1",
      nodeId: "touch-node",
      title: "掌心",
      startStageId: "stage-1",
      stages: [{
        id: "stage-1",
        image: "https://example.test/hand.jpg",
        prompt: "靠近或长按",
        dialogue: { speaker: "裴亦惜", text: "你会碰哪里？" },
        hotspots: [{
          id: "palm",
          label: "掌心",
          x: 30, y: 30, width: 40, height: 40,
          trigger: "face-near",
          fallbackTrigger: "hold",
          holdMs: 300,
          targetStageId: "stage-2",
        }],
      }, {
        id: "stage-2",
        image: "https://example.test/after.gif",
        dialogue: { speaker: "裴亦惜", text: "抓到你了。" },
        hotspots: [],
      }],
    }],
  }
}

test("camera work asks at entry and denied permission uses the authored fallback", async t => {
  const dom = installDom(t)
  let cameraRequests = 0
  const navigatorObject = {
    mediaDevices: {
      async getUserMedia(constraints) {
        cameraRequests += 1
        assert.equal(constraints.audio, false)
        const error = new Error("denied")
        error.name = "NotAllowedError"
        throw error
      },
    },
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorObject,
  })
  const work = cameraArticle()
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id, title: work.title, type: work.type, importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?interactive-runtime=${Date.now()}-${Math.random()}`)

  document.querySelector(".rd-recent-item").click()
  assert.match(document.querySelector(".rd-camera-preflight").textContent, /不录制、不保存、不上传/)
  document.getElementById("rdStartBtn").click()
  await waitFor(() => cameraRequests === 1 && document.querySelector(".article-choice-btn"))
  assert.equal(cameraRequests, 1)

  document.querySelector(".article-choice-btn").click()
  const page = document.querySelector(".rd-interactive-scene-page")
  assert.ok(page)
  const hotspot = page.querySelector(".interactive-scene-hotspot")
  assert.equal(hotspot.dataset.activeTrigger, "hold")
  hotspot.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, detail: 1 }))
  assert.equal(page.querySelector(".interactive-scene-media img").getAttribute("src"), "https://example.test/hand.jpg")
  assert.equal(cameraRequests, 1, "the scene must not ask for camera permission again")

  page.querySelector(".rd-interactive-scene-exit").click()
  assert.ok(document.querySelector(".article-content"))
  assert.match(document.querySelector(".article-content").textContent, /伸出手/)
})
