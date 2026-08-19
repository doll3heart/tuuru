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

test("standalone interactive works switch from default BGM to a stage special and finish as a mini game", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
    pretendToBeVisual:true,
  })
  const previousNavigator = globalThis.navigator
  Object.assign(globalThis, {
    window:dom.window,
    document:dom.window.document,
    localStorage:dom.window.localStorage,
    sessionStorage:dom.window.sessionStorage,
    Element:dom.window.Element,
    HTMLElement:dom.window.HTMLElement,
    Node:dom.window.Node,
    Event:dom.window.Event,
    MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  class FakeAudio {
    static instances = []
    constructor() { this.src=""; this.currentTime=0; this.paused=true; FakeAudio.instances.push(this) }
    async play() { this.paused=false; this.playCount=(this.playCount || 0) + 1 }
    pause() { this.paused=true }
    removeAttribute(name) { if (name === "src") this.src="" }
  }
  Object.defineProperty(dom.window, "Audio", { configurable:true, value:FakeAudio })
  t.after(() => {
    Object.defineProperty(globalThis, "navigator", { configurable:true, value:previousNavigator })
    dom.window.close()
  })

  const work = {
    schemaVersion:4,
    id:"mini-game-1",
    type:"article",
    experienceMode:"interactive",
    title:"门后",
    placeholders:[{
      id:"reader-name",
      key:"name",
      label:"姓名",
      prompt:"输入姓名",
      values:[],
      fillMode:"landing",
    }],
    nodes:[],
    chapters:[],
    scenes:[],
    phoneModules:[],
    interactiveBgm:{ source:"https://example.test/default.mp3", volume:60, loop:true },
    interactiveScenes:[{
      id:"scene-1",
      title:"门后",
      startStageId:"stage-1",
      stages:[{
        id:"stage-1",
        name:"门外",
        image:"https://example.test/door.jpg",
        dialogue:{speaker:"", text:"推门。"},
        hotspots:[],
        choices:[{ id:"enter", label:"name，推门进去", targetStageId:"stage-2" }],
      }, {
        id:"stage-2",
        name:"门内",
        image:"https://example.test/inside.jpg",
        bgm:{ source:"https://example.test/danger.ogg", volume:35, loop:true },
        dialogue:{speaker:"", text:"它看见你了。"},
        hotspots:[],
      }],
    }],
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:Date.now() }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  await import(`../reader/reader.js?mini-runtime=${Date.now()}-${Math.random()}`)

  document.querySelector('[data-tab="library"]').click()
  document.querySelector(".rd-recent-item").click()
  document.querySelector('[data-ph-id="reader-name"]').value = "阿雾"
  document.getElementById("rdStartBtn").click()
  await waitFor(() => document.querySelector(".rd-interactive-scene-page"))
  const page = document.querySelector(".rd-interactive-scene-page")
  const audio = FakeAudio.instances.at(-1)
  assert.equal(audio.playCount || 0, 0, "autoplay must wait for a reader gesture")
  page.dispatchEvent(new dom.window.Event("pointerdown", { bubbles:true }))
  await waitFor(() => audio.src === "https://example.test/default.mp3" && audio.playCount > 0)

  const choice = page.querySelector(".interactive-scene-choice")
  assert.equal(choice.textContent, "阿雾，推门进去")
  choice.click()
  await waitFor(() => audio.src === "https://example.test/danger.ogg")
  assert.equal(audio.volume, .35)
  page.querySelector(".interactive-scene-dialogue").click()
  await waitFor(() => document.querySelector(".rd-mini-complete"))
  assert.match(document.querySelector(".rd-mini-complete").textContent, /重新开始/)
})
