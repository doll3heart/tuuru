import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url: "http://localhost/reader/" })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.KeyboardEvent = dom.window.KeyboardEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.Image = dom.window.Image
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function cacheWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([
    { id: work.id, title: work.title, type: work.type, importedAt: Date.now() },
  ]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

async function openCachedWork(work, tag) {
  cacheWork(work)
  await import(`../reader/reader.js?${tag}=${Date.now()}`)
  document.querySelector("[data-reader-recent-index]").click()
  document.getElementById("rdStartBtn").click()
}

test("article work watermark stays between reader appearance and content", async t => {
  installDom(t)
  await openCachedWork({
    schemaVersion: 1,
    id: "article-watermark",
    type: "article",
    title: "Article watermark",
    nodes: [{ id: "start", title: "Start", content: "<p>Protected text</p>", choices: [] }],
    chapters: [], scenes: [], placeholders: [], phoneModules: [], startNode: "start",
    watermark: {
      enabled: true,
      kind: "text",
      text: "纯代乙向禁止偷吃",
      opacity: 0.21,
      coverage: "full",
      position: "center",
      pattern: "cross",
      spacing: 130,
    },
  }, "article-work-watermark")

  const app = document.getElementById("app")
  const backdrop = document.querySelector(".article-reading-backdrop")
  const layer = document.querySelector(".work-watermark-layer.work-watermark-article")
  const reader = document.querySelector(".article-reader")
  assert.ok(layer)
  assert.equal(layer.getAttribute("aria-hidden"), "true")
  assert.equal(layer.dataset.coverage, "full")
  assert.equal(layer.dataset.pattern, "cross")
  assert.equal(layer.style.getPropertyValue("--work-watermark-opacity"), "0.21")
  assert.equal(layer.style.getPropertyValue("--work-watermark-spacing"), "130px")
  const patternPlanes = layer.querySelectorAll(":scope > .work-watermark-pattern")
  assert.equal(patternPlanes.length, 1)
  const patternRows = patternPlanes[0].querySelectorAll(":scope > .work-watermark-row")
  assert.ok(patternRows.length >= 4)
  assert.deepEqual(
    [...patternRows].slice(0, 4).map(row => row.dataset.offset),
    ["base", "staggered", "base", "staggered"],
  )
  assert.ok([...patternRows].every(row => row.querySelectorAll(":scope > .work-watermark-item").length >= 4))
  assert.ok(layer.querySelectorAll(".work-watermark-item").length >= 24)
  assert.match(layer.textContent, /纯代乙向禁止偷吃/)
  assert.ok([...app.children].indexOf(backdrop) < [...app.children].indexOf(layer))
  assert.ok([...app.children].indexOf(layer) < [...app.children].indexOf(reader))

  document.querySelector(".reader-settings-btn").click()
  const bg = document.getElementById("rsBgColor")
  bg.value = "#123456"
  bg.dispatchEvent(new Event("input", { bubbles: true }))
  const textColor = document.getElementById("rsTextColor")
  textColor.value = "#fefefe"
  textColor.dispatchEvent(new Event("input", { bubbles: true }))
  assert.equal(document.querySelector(".work-watermark-layer"), layer)
  assert.equal(layer.style.getPropertyValue("--work-watermark-ink"), "#fefefe")
  assert.equal(document.querySelector('[data-reader-watermark-control]'), null)
})

test("phone work watermark survives opening an App and returning to the desktop", async t => {
  installDom(t)
  const image = "data:image/png;base64,AA=="
  await openCachedWork({
    schemaVersion: 1,
    id: "phone-watermark",
    type: "phone",
    title: "Phone watermark",
    nodes: [], chapters: [], scenes: [], placeholders: [],
    watermark: {
      enabled: true,
      kind: "image",
      image,
      opacity: 0.17,
      coverage: "single",
      position: "top-left",
      pattern: "diagonal",
      spacing: 160,
    },
    phoneData: {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: { readerId: "Reader", showAppLabels: true },
      apps: [{ id: "messages", type: "messages", name: "消息", icon: "M", color: "#f0f0f0", desktopX: 0, desktopY: 0, enabled: true }],
    },
  }, "phone-work-watermark")

  let frame = document.querySelector(".phone-frame")
  let layer = frame.querySelector(".work-watermark-layer.work-watermark-phone")
  assert.ok(layer)
  assert.equal(layer.dataset.position, "top-left")
  assert.equal(layer.querySelector("img").getAttribute("src"), image)

  document.querySelector('[data-app-type="messages"]').click()
  frame = document.querySelector(".phone-frame")
  assert.ok(frame.querySelector(".work-watermark-layer.work-watermark-phone"))
  document.querySelector(".rd-back-btn").click()
  assert.ok(document.querySelector(".phone-frame .work-watermark-layer.work-watermark-phone"))
})

test("reader watermark layers are pointer-inert and ordered below content", () => {
  const base = readerCss.match(/\.work-watermark-layer\s*\{([^}]*)\}/)?.[1] ?? ""
  const article = readerCss.match(/\.work-watermark-article\s*\{([^}]*)\}/)?.[1] ?? ""
  const phone = readerCss.match(/\.work-watermark-phone\s*\{([^}]*)\}/)?.[1] ?? ""
  assert.match(base, /pointer-events:\s*none/)
  assert.match(base, /user-select:\s*none/)
  assert.match(article, /position:\s*fixed/)
  assert.match(article, /z-index:\s*1/)
  assert.match(phone, /position:\s*absolute/)
  assert.match(phone, /z-index:\s*1/)
  assert.match(readerCss, /\.work-watermark-pattern\s*\{[^}]*position:\s*absolute[^}]*display:\s*flex[^}]*flex-direction:\s*column/s)
  assert.match(readerCss, /\.work-watermark-row\s*\{[^}]*translateX\(calc\(var\(--work-watermark-spacing\)\s*\*\s*-1\)\)/s)
  assert.match(readerCss, /\.work-watermark-row\[data-offset="staggered"\][^}]*translateX\(calc\(var\(--work-watermark-spacing\)\s*\*\s*-.5\)\)/s)
  assert.match(readerCss, /\.work-watermark-row\s*>\s*\.work-watermark-item[^}]*rotate\(-24deg\)/s)
  assert.doesNotMatch(readerCss, /data-direction="ascending"|rotate\(24deg\)/s)
  assert.match(readerCss, /\.article-reader\s*\{[^}]*z-index:\s*2/s)
  assert.match(readerCss, /\.phone-frame\s*>\s*:not\(\.work-watermark-layer\)[^}]*z-index:\s*2/s)
})
