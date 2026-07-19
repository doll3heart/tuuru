import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const homeSource = readFileSync(new URL("../js/pages/home.js", import.meta.url), "utf8")

function cssBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ""
}

async function openWorkInfo(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url: "http://localhost/" })
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
  globalThis.Image = dom.window.Image
  globalThis.alert = () => {}
  t.after(() => dom.window.close())

  localStorage.setItem("tuuru_works", JSON.stringify({
    works: [{
      id: "watermark-author-work",
      schemaVersion: 1,
      type: "article",
      title: "Watermark author",
      author: "BA",
      nodes: [{ id: "start", title: "Start", content: "<p>Text</p>", choices: [] }],
      chapters: [], scenes: [], placeholders: [], phoneModules: [], startNode: "start",
      watermark: {
        enabled: true,
        kind: "text",
        text: "纯代乙向禁止偷吃",
        opacity: 0.18,
        coverage: "single",
        position: "bottom-right",
        pattern: "diagonal",
        spacing: 160,
      },
    }],
    contacts: [],
    groups: [],
  }))

  await import(`../js/pages/home.js?work-watermark-ui=${Date.now()}`)
  window.editWorkInfo("watermark-author-work")
  return dom
}

test("work info exposes progressive author watermark controls and a live preview", async t => {
  await openWorkInfo(t)

  for (const id of [
    "wiWatermarkEnabled",
    "wiWatermarkText",
    "wiWatermarkImage",
    "wiWatermarkOpacity",
    "wiWatermarkCoverage",
    "wiWatermarkPosition",
    "wiWatermarkPattern",
    "wiWatermarkSpacing",
    "wiWatermarkPreview",
    "wiWatermarkStatus",
  ]) assert.ok(document.getElementById(id), id)

  assert.equal(document.getElementById("wiWatermarkEnabled").checked, true)
  assert.equal(document.getElementById("wiWatermarkText").value, "纯代乙向禁止偷吃")
  assert.match(document.getElementById("wiWatermarkPreview").textContent, /纯代乙向禁止偷吃/)

  const text = document.getElementById("wiWatermarkText")
  text.value = "ABCP 作者署名"
  text.dispatchEvent(new Event("input", { bubbles: true }))
  assert.match(document.getElementById("wiWatermarkPreview").textContent, /ABCP 作者署名/)

  const coverage = document.getElementById("wiWatermarkCoverage")
  const preview = document.getElementById("wiWatermarkPreview")
  Object.defineProperty(preview, "clientWidth", { configurable: true, value: 620 })
  Object.defineProperty(preview, "clientHeight", { configurable: true, value: 190 })
  coverage.value = "full"
  coverage.dispatchEvent(new Event("change", { bubbles: true }))
  assert.ok(document.querySelectorAll("#wiWatermarkPreview .wi-watermark-preview-item").length > 4)

  const spacing = document.getElementById("wiWatermarkSpacing")
  spacing.value = "80"
  spacing.dispatchEvent(new Event("input", { bubbles: true }))
  const minimumSpacingRows = document.querySelectorAll("#wiWatermarkPreview .wi-watermark-preview-row")
  assert.ok(minimumSpacingRows.length >= 8)
  assert.ok([...minimumSpacingRows].every(row => row.querySelectorAll(":scope > .wi-watermark-preview-item").length >= 20))

  const pattern = document.getElementById("wiWatermarkPattern")
  pattern.value = "cross"
  pattern.dispatchEvent(new Event("change", { bubbles: true }))
  const patternPlanes = document.querySelectorAll("#wiWatermarkPreview .wi-watermark-preview-pattern")
  assert.equal(patternPlanes.length, 1)
  const patternRows = patternPlanes[0].querySelectorAll(":scope > .wi-watermark-preview-row")
  assert.ok(patternRows.length >= 4)
  assert.deepEqual(
    [...patternRows].slice(0, 4).map(row => row.dataset.offset),
    ["base", "staggered", "base", "staggered"],
  )

  pattern.value = "diagonal"
  pattern.dispatchEvent(new Event("change", { bubbles: true }))
  assert.ok([...document.querySelectorAll("#wiWatermarkPreview .wi-watermark-preview-row")]
    .every(row => row.dataset.offset === "base"))
})

test("work watermark author controls are touch-safe, focused, and saved through normalization", () => {
  for (const selector of [".wi-watermark-toggle", ".wi-watermark-choice", ".wi-watermark-upload"]) {
    assert.match(cssBody(selector), /min-height:\s*44px/, selector)
  }
  assert.match(css, /\.wi-watermark-choice:focus-within[^}]*outline:\s*2px solid var\(--c-primary-hover\)/s)
  assert.match(cssBody(".wi-modal"), /max-height:\s*calc\(100dvh/)
  assert.match(homeSource, /watermark:\s*normalizeWorkWatermark\(watermarkDraft\)/)
  assert.match(homeSource, /WORK_WATERMARK_IMAGE_MAX_BYTES/)
})
