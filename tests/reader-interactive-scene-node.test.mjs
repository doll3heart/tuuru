import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("an interactive start node explores its hotspot before dialogue advances to the next picture", async t => {
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
    id: "interactive-node-work",
    type: "article",
    title: "宝宝文游",
    placeholders: [],
    scenes: [],
    chapters: [{ id: "chapter-1", name: "第一章" }],
    startNode: "interactive-node-1",
    nodes: [{
      id: "interactive-node-1",
      title: "掌心",
      chapterId: "chapter-1",
      kind: "interactive-scene",
      interactiveSceneId: "scene-1",
      choices: [],
      content: "",
    }, {
      id: "after-interaction",
      title: "作者用后续文段",
      chapterId: "chapter-1",
      choices: [],
      content: "<p>互动结束后的正文</p>",
    }],
    phoneModules: [],
    interactiveScenes: [{
      id: "scene-1",
      nodeId: "interactive-node-1",
      title: "掌心",
      startStageId: "stage-1",
      stages: [{
        id: "stage-1",
        image: "https://example.test/before.jpg",
        dialogue: { speaker: "裴亦惜", text: "初始台词" },
        hotspots: [{
          id: "hand",
          label: "手",
          x: 20,
          y: 20,
          width: 40,
          height: 40,
          trigger: "tap",
          speaker: "裴亦惜",
          dialogue: "热区台词",
          targetStageId: "stage-2",
        }],
      }, {
        id: "stage-2",
        image: "https://example.test/after.jpg",
        dialogue: { speaker: "裴亦惜", text: "画面初始台词" },
        hotspots: [],
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

  await import(`../reader/reader.js?interactive-node=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  assert.ok(document.querySelector(".rd-interactive-scene-page"))
  assert.equal(document.querySelector(".rd-interactive-scene-trigger"), null)
  document.querySelector(".interactive-scene-hotspot").click()
  assert.equal(document.querySelector(".interactive-scene-dialogue-text").textContent, "热区台词")
  assert.equal(
    document.querySelector(".interactive-scene-background").getAttribute("src"),
    "https://example.test/before.jpg",
  )

  document.querySelector(".interactive-scene-dialogue").click()
  assert.equal(
    document.querySelector(".interactive-scene-background").getAttribute("src"),
    "https://example.test/after.jpg",
  )
  assert.equal(document.querySelector(".interactive-scene-dialogue-text").textContent, "画面初始台词")

  document.querySelector(".rd-interactive-scene-exit").click()
  assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
  assert.match(document.querySelector(".article-reader").textContent, /互动结束后的正文/)
  assert.equal(document.querySelectorAll(".article-node").length, 1)
})

test("one chapter renders branch prose, an interactive page, and following prose as separate pages", async t => {
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
    schemaVersion: 3,
    id: "interactive-page-separator",
    type: "article",
    title: "Interactive page separator",
    placeholders: [],
    scenes: [],
    phoneModules: [],
    chapters: [{ id: "chapter", name: "Chapter" }],
    startNode: "node-1",
    nodes: [
      {
        id: "node-1",
        title: "Node 1",
        chapterId: "chapter",
        content: "<p>Opening prose</p>",
        choices: [
          { id: "choice-a", mode: "branch", text: "A", targetId: "node-2" },
          { id: "choice-b", mode: "branch", text: "B", targetId: "node-3" },
        ],
      },
      { id: "node-2", title: "Node 2", chapterId: "chapter", content: "<p>Branch A prose</p>", choices: [] },
      { id: "node-3", title: "Node 3", chapterId: "chapter", content: "<p>Branch B prose</p>", choices: [] },
      { id: "node-4", title: "Node 4", chapterId: "chapter", content: "<p>Merged prose</p>", choices: [] },
      {
        id: "node-5",
        title: "Node 5",
        chapterId: "chapter",
        kind: "interactive-scene",
        interactiveSceneId: "scene-5",
        content: "",
        choices: [],
      },
      { id: "node-6", title: "Node 6", chapterId: "chapter", content: "<p>Following prose only</p>", choices: [] },
    ],
    interactiveScenes: [{
      id: "scene-5",
      nodeId: "node-5",
      nextNodeId: "node-6",
      title: "Scene 5",
      startStageId: "picture-1",
      stages: [
        {
          id: "picture-1",
          image: "https://example.test/picture-1.jpg",
          dialogue: { speaker: "Guide", text: "Explore both" },
          hotspots: [
            { id: "point-1", label: "One", x: 10, y: 10, width: 20, height: 20, trigger: "tap" },
            { id: "point-2", label: "Two", x: 50, y: 50, width: 20, height: 20, trigger: "tap" },
          ],
        },
        {
          id: "picture-2",
          image: "https://example.test/picture-2.jpg",
          dialogue: { speaker: "Guide", text: "No interactions" },
          hotspots: [],
        },
        {
          id: "picture-3",
          image: "https://example.test/picture-3.jpg",
          dialogue: { speaker: "Guide", text: "Final interaction" },
          hotspots: [
            { id: "point-3", label: "Three", x: 30, y: 30, width: 20, height: 20, trigger: "tap" },
          ],
        },
      ],
    }],
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?interactive-separator=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  let readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Opening prose/)
  assert.doesNotMatch(readerText, /Branch A prose|Branch B prose|Merged prose|Following prose only/)

  document.querySelector('[data-choice-id="choice-a"]').click()
  readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Opening prose/)
  assert.match(readerText, /Branch A prose/)
  assert.match(readerText, /Merged prose/)
  assert.doesNotMatch(readerText, /Branch B prose|Following prose only/)
  assert.equal(document.querySelector(".rd-interactive-scene-page"), null)

  const enterScene = document.querySelector("[data-reader-enter-interactive-scene]")
  assert.ok(enterScene)
  enterScene.click()
  assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")

  let dialogue = document.querySelector(".interactive-scene-dialogue")
  dialogue.click()
  assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")
  document.querySelector('[data-hotspot-id="point-1"]').click()
  dialogue.click()
  assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")
  document.querySelector('[data-hotspot-id="point-2"]').click()
  dialogue.click()
  assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-2")

  dialogue = document.querySelector(".interactive-scene-dialogue")
  dialogue.click()
  assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-3")
  document.querySelector('[data-hotspot-id="point-3"]').click()
  document.querySelector(".interactive-scene-dialogue").click()

  assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
  readerText = document.querySelector(".article-reader").textContent
  assert.match(readerText, /Following prose only/)
  assert.doesNotMatch(readerText, /Opening prose|Branch A prose|Branch B prose|Merged prose/)
  assert.equal(document.querySelectorAll(".article-node").length, 1)
})

test("only the interactive choice splits a seven-node chapter while its required exit may jump farther ahead", async () => {
  async function runRoute(firstChoiceId, secondChoiceId, nextNodeId, verifyInteractiveProgression = false) {
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

    const work = {
      schemaVersion: 3,
      id: `seven-node-${firstChoiceId}-${secondChoiceId}`,
      type: "article",
      title: "Seven node route",
      placeholders: [],
      scenes: [],
      phoneModules: [],
      chapters: [
        { id: "chapter", name: "Chapter" },
        { id: "other-chapter", name: "Other chapter" },
      ],
      startNode: "node-1",
      nodes: [
        {
          id: "node-1",
          title: "Node 1",
          chapterId: "chapter",
          content: "<p>Text 1</p>",
          choices: [
            { id: "choice-a", mode: "branch", text: "A", targetId: "node-2" },
            { id: "choice-b", mode: "branch", text: "B", targetId: "node-3" },
          ],
        },
        { id: "node-2", title: "Node 2", chapterId: "chapter", content: "<p>Text 2</p>", choices: [] },
        { id: "node-3", title: "Node 3", chapterId: "chapter", content: "<p>Text 3</p>", choices: [] },
        {
          id: "node-4",
          title: "Node 4",
          chapterId: "chapter",
          content: "<p>Text 4</p>",
          choices: [
            { id: "choice-c", mode: "branch", text: "C", targetId: "node-5" },
            { id: "choice-d", mode: "branch", text: "D", targetId: "node-6" },
          ],
        },
        {
          id: "node-5",
          title: "Node 5",
          chapterId: "chapter",
          kind: "interactive-scene",
          interactiveSceneId: "scene-5",
          content: "",
          choices: [],
        },
        { id: "node-6", title: "Node 6", chapterId: "chapter", content: "<p>Text 6</p>", choices: [] },
        { id: "node-7", title: "Node 7", chapterId: "chapter", content: "<p>Text 7</p>", choices: [] },
        { id: "node-9", title: "Node 9", chapterId: "chapter", content: "<p>Text 9</p>", choices: [] },
        { id: "node-10", title: "Node 10", chapterId: "chapter", content: "<p>Text 10</p>", choices: [] },
        {
          id: "node-8",
          title: "Node 8",
          chapterId: "other-chapter",
          content: "<p>Text 8</p>",
          choices: [
            { id: "choice-to-9", mode: "branch", text: "To 9", targetId: "node-9" },
            { id: "choice-to-10", mode: "branch", text: "To 10", targetId: "node-10" },
          ],
        },
      ],
      interactiveScenes: [{
        id: "scene-5",
        nodeId: "node-5",
        nextNodeId,
        title: "Scene 5",
        startStageId: "picture-1",
        stages: [
          {
            id: "picture-1",
            image: "https://example.test/picture-1.jpg",
            dialogue: { speaker: "Guide", text: "Explore all points" },
            hotspots: [
              { id: "point-1", label: "One", x: 10, y: 10, width: 20, height: 20, trigger: "tap" },
              { id: "point-2", label: "Two", x: 50, y: 50, width: 20, height: 20, trigger: "tap" },
            ],
          },
          {
            id: "picture-2",
            image: "https://example.test/picture-2.jpg",
            dialogue: { speaker: "Guide", text: "No interactions" },
            hotspots: [],
          },
          {
            id: "picture-3",
            image: "https://example.test/picture-3.jpg",
            dialogue: { speaker: "Guide", text: "Final picture" },
            hotspots: [],
          },
        ],
      }],
    }
    localStorage.setItem("moirain_recent", JSON.stringify([{
      id: work.id,
      title: work.title,
      type: work.type,
      importedAt: Date.now(),
    }]))
    localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

    try {
      await import(`../reader/reader.js?seven-node=${Date.now()}-${Math.random()}`)
      document.querySelector(".rd-recent-item").click()
      document.getElementById("rdStartBtn").click()

      let readerText = document.querySelector(".article-reader").textContent
      assert.match(readerText, /Text 1/)
      assert.doesNotMatch(readerText, /Text (?:2|3|4|5|6|7|8|9|10)/)

      document.querySelector(`[data-choice-id="${firstChoiceId}"]`).click()
      readerText = document.querySelector(".article-reader").textContent
      assert.match(readerText, /Text 1/)
      assert.match(readerText, firstChoiceId === "choice-a" ? /Text 2/ : /Text 3/)
      assert.match(readerText, /Text 4/)
      assert.doesNotMatch(readerText, firstChoiceId === "choice-a" ? /Text 3/ : /Text 2/)
      assert.doesNotMatch(readerText, /Text (?:5|6|7|8|9|10)/)

      document.querySelector(`[data-choice-id="${secondChoiceId}"]`).click()
      if (secondChoiceId === "choice-d") {
        assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
        readerText = document.querySelector(".article-reader").textContent
        const expectedBranchText = firstChoiceId === "choice-a" ? /Text 1[\s\S]*Text 2/ : /Text 1[\s\S]*Text 3/
        assert.match(readerText, expectedBranchText)
        assert.match(readerText, /Text 4[\s\S]*Text 6[\s\S]*Text 7/)
        assert.doesNotMatch(readerText, firstChoiceId === "choice-a" ? /Text 3/ : /Text 2/)
        assert.doesNotMatch(readerText, /Text (?:5|8|9|10)/)
        return
      }

      assert.ok(document.querySelector(".rd-interactive-scene-page"))
      assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")
      assert.equal(document.querySelector(".article-reader"), null)

      if (verifyInteractiveProgression) {
        let dialogue = document.querySelector(".interactive-scene-dialogue")
        dialogue.click()
        assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")
        document.querySelector('[data-hotspot-id="point-1"]').click()
        dialogue.click()
        assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-1")
        document.querySelector('[data-hotspot-id="point-2"]').click()
        dialogue.click()
        assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-2")

        dialogue = document.querySelector(".interactive-scene-dialogue")
        dialogue.click()
        assert.equal(document.querySelector(".interactive-scene").dataset.stageId, "picture-3")
        document.querySelector(".interactive-scene-dialogue").click()

        assert.equal(document.querySelector(".rd-interactive-scene-page"), null)
        if (nextNodeId === "gone") {
          assert.equal(document.querySelector(".article-reader"), null)
          assert.match(document.querySelector(".drop-zone").textContent, /后续跳转节点已失效/)
          return
        }
        readerText = document.querySelector(".article-reader").textContent
        assert.match(readerText, new RegExp(`Text ${nextNodeId === "node-9" ? "9" : "10"}`))
        assert.doesNotMatch(readerText, nextNodeId === "node-9" ? /Text 10/ : /Text 9/)
        assert.doesNotMatch(readerText, /Text (?:1|2|3|4|5|6|7|8)\b/)
        assert.equal(document.querySelectorAll(".article-node").length, 1)
      }
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      })
      dom.window.close()
    }
  }

  await runRoute("choice-a", "choice-c", "node-9", true)
  await runRoute("choice-b", "choice-c", "node-10", true)
  await runRoute("choice-a", "choice-d", "node-9")
  await runRoute("choice-b", "choice-d", "node-10")
  await runRoute("choice-a", "choice-c", "gone", true)
})
