import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(selector) {
  const bodies = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = rulePattern.exec(cssWithoutComments))) {
    const selectors = match[1]
      .split(",")
      .map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

test("reader App panels have a scoped, bounded layout", () => {
  assert.match(
    readerSource,
    /class="(?=[^"]*\bcu-panel\b)(?=[^"]*\bcu-panel-embedded\b)[^"]*"/,
  )

  const panel = ruleBodiesFor(".phone-frame > .cu-panel.cu-panel-embedded")
  const header = ruleBodiesFor(".phone-frame > .cu-panel.cu-panel-embedded > .cu-header")
  const body = ruleBodiesFor(".phone-frame > .cu-panel.cu-panel-embedded > .cu-body")

  assert.match(panel, /position\s*:\s*absolute/)
  assert.match(panel, /inset\s*:\s*0/)
  assert.match(panel, /display\s*:\s*flex/)
  assert.match(panel, /flex-direction\s*:\s*column/)
  assert.match(panel, /min-height\s*:\s*0/)
  assert.match(panel, /overflow\s*:\s*hidden/)
  assert.match(panel, /background\s*:\s*var\(--c-bg\)/)
  assert.match(panel, /color\s*:\s*var\(--c-text\)/)

  assert.match(header, /display\s*:\s*flex/)
  assert.match(header, /align-items\s*:\s*center/)
  assert.match(header, /flex-shrink\s*:\s*0/)
  assert.match(header, /background\s*:\s*var\(--c-surface\)/)

  assert.match(body, /flex\s*:\s*1/)
  assert.match(body, /min-height\s*:\s*0/)
  assert.match(body, /overflow-y\s*:\s*auto/)
  assert.match(body, /overscroll-behavior\s*:\s*contain/)
})

test("reader App panel rules do not leak through bare cu selectors", () => {
  assert.equal(ruleBodiesFor(".cu-panel"), "")
  assert.equal(ruleBodiesFor(".cu-header"), "")
  assert.equal(ruleBodiesFor(".cu-body"), "")
})

test("reader App surfaces do not derive their backgrounds from the home wallpaper", () => {
  const appSurfaces = [
    ".rd-message-section-tabs",
    ".rd-moment-card",
    ".rd-forum-detail",
  ]

  for (const selector of appSurfaces) {
    const body = ruleBodiesFor(selector)
    assert.ok(body, `${selector} must define its own App surface`)
    assert.doesNotMatch(body, /--phone-bg/)
    assert.match(body, /--phone-system-(?:bg|surface)/)
  }
})
