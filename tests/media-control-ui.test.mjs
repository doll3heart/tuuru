import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url:"https://tuuru.local/#/edit/mini-media-controls",
  pretendToBeVisual:true,
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.location = dom.window.location
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = callback => { callback(); return 1 }
document.execCommand = () => true
window.matchMedia = query => ({
  matches:false,
  media:query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

const { createWork, getWork } = await import("../js/data.js")
const { INTERACTIVE_EXPERIENCE_MODE } = await import("../js/interactive-experience.js")
const { renderEditor, bindEditor } = await import(`../js/pages/editor.js?media-controls=${Date.now()}`)

function renderMini(interactiveBgm = {}) {
  localStorage.clear()
  const work = createWork({
    type:"article",
    experienceMode:INTERACTIVE_EXPERIENCE_MODE,
    title:"雨夜",
    interactiveBgm,
  })
  const root = document.getElementById("app")
  root.innerHTML = renderEditor(work.id)
  bindEditor(work.id)
  return { root, work }
}

test("Mini default BGM uses an accessible in-product file picker with persistent file state", () => {
  const reference = `asset://${"a".repeat(64)}`
  const { root } = renderMini({
    source:reference,
    fileName:"雨声循环.ogg",
    bytes:4096,
    volume:42,
    loop:true,
  })
  const input = root.querySelector("[data-bgm-file-input]")
  const trigger = root.querySelector("[data-bgm-file-trigger]")
  const status = root.querySelector("[data-bgm-file-name]")

  assert.equal(input.type, "file")
  assert.equal(input.dataset.a, "mini-bgm-file")
  assert.ok(input.classList.contains("sr-only"))
  assert.ok(input.id)
  assert.equal(input.tabIndex, 0)
  assert.equal(trigger.tagName, "LABEL")
  assert.equal(trigger.htmlFor, input.id)
  assert.match(trigger.textContent, /重新选择/)
  assert.equal(status.tagName, "OUTPUT")
  assert.equal(status.getAttribute("for"), input.id)
  assert.equal(input.getAttribute("aria-describedby"), status.id)
  assert.equal(status.getAttribute("aria-live"), "polite")
  assert.match(status.textContent, /雨声循环\.ogg/)

  let activations = 0
  input.addEventListener("click", () => { activations += 1 })
  trigger.click()
  assert.equal(activations, 1)
  input.focus()
  assert.equal(document.activeElement, input)
})

test("Mini default BGM volume exposes and updates a live numeric value before persistence", () => {
  const { root, work } = renderMini({ volume:42, loop:true })
  const volume = root.querySelector("[data-bgm-volume]")
  const value = root.querySelector("[data-bgm-volume-value]")

  assert.equal(volume.type, "range")
  assert.deepEqual([volume.min, volume.max, volume.step], ["0", "100", "1"])
  assert.equal(value.getAttribute("for"), volume.id)
  assert.equal(volume.getAttribute("aria-describedby"), value.id)
  assert.equal(value.textContent.trim(), "42%")
  assert.equal(volume.getAttribute("aria-valuetext"), "42%")

  volume.value = "37"
  volume.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  assert.equal(value.textContent.trim(), "37%")
  assert.equal(volume.getAttribute("aria-valuetext"), "37%")
  assert.equal(volume.style.getPropertyValue("--media-volume"), "37%")

  volume.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  assert.equal(getWork(work.id).interactiveBgm.volume, 37)
})

test("Mini studio exposes landing placeholders without article-only inline controls", () => {
  const { root } = renderMini()
  const entry = root.querySelector("[data-a='ph']")
  assert.ok(entry)
  assert.match(entry.closest(".mini-game-placeholder-card").textContent, /占位符/)

  entry.click()
  const panel = document.querySelector("#phPanel")
  assert.ok(panel)
  assert.match(panel.textContent, /画面中的提示、说话人、台词和选项文字/)
  panel.querySelector("[data-ph-a='add']").click()
  const card = panel.querySelector("[data-ph-id]")
  assert.ok(card)
  assert.equal(card.querySelector("[data-ph-a='insert-inline']"), null)
  assert.equal(card.querySelector("[id^='ph_fill_']"), null)
  assert.match(card.textContent, /阅读前集中填写/)
  panel.closest(".modal-overlay")?.remove()
})

test("shared media controls remain touch-safe, themed, and responsive", () => {
  assert.match(css, /\.media-file-picker-button\s*\{[^}]*min-height:\s*44px/s)
  assert.match(css, /\.media-file-picker-input:focus-visible\s*\+\s*\.media-file-picker-button/s)
  assert.match(css, /\.media-file-picker-status\s*\{[^}]*min-width:\s*0[^}]*text-overflow:\s*ellipsis/s)
  assert.match(css, /\.media-volume-range\s*\{[^}]*appearance:\s*none[^}]*min-height:\s*44px/s)
  assert.match(css, /\.media-volume-range::?-webkit-slider-thumb\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/s)
  assert.match(css, /@container\s*\(max-width:\s*360px\)[\s\S]*\.media-file-picker\s*\{[^}]*grid-template-columns:\s*1fr/s)
})
