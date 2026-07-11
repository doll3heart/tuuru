import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")

function blockFrom(source, marker) {
  const markerStart = source.indexOf(marker)
  assert.notEqual(markerStart, -1, `missing ${marker}`)
  const open = source.indexOf("{", markerStart)
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++
    if (source[index] !== "}") continue
    depth--
    if (depth === 0) return source.slice(open + 1, index)
  }
  assert.fail(`unterminated ${marker}`)
}

function ruleBodiesFor(source, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(source))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

const bounded = blockFrom(
  css,
  "@media(max-width:480px),(max-height:480px) and (pointer:coarse)",
)
const shortLandscape = blockFrom(
  css,
  "@media(max-height:480px) and (pointer:coarse)",
)

test("the standalone phone editor follows the application viewport", () => {
  const wrap = ruleBodiesFor(css, ".phone-editor-wrap")
  assert.match(
    wrap,
    /min-height\s*:\s*calc\(var\(--app-viewport-height\)\s*-\s*var\(--app-header-height\)\)/,
  )
  assert.doesNotMatch(wrap, /min-height\s*:\s*calc\(100vh\s*-\s*56px\)/)
})

test("bounded phone editors fit short screens without clipping their desktop", () => {
  const wrap = ruleBodiesFor(bounded, ".phone-editor-wrap")
  const frame = ruleBodiesFor(bounded, ".phone-editor-wrap > .phone-frame")
  const desktop = ruleBodiesFor(bounded, ".phone-editor-wrap > .phone-frame > .phone-desktop")
  const controls = ruleBodiesFor(bounded, ".phone-editor-controls")
  const toggle = ruleBodiesFor(bounded, ".phone-arrange-toggle")
  const moveControls = ruleBodiesFor(
    bounded,
    '.phone-editor-wrap[data-phone-arrange-mode="true"] .phone-arrange-move-controls',
  )
  const moveButton = ruleBodiesFor(bounded, ".phone-arrange-move")
  const icon = ruleBodiesFor(bounded, ".phone-editor-wrap .phone-app-icon")
  const arrangingIcon = ruleBodiesFor(
    bounded,
    '.phone-editor-wrap[data-phone-arrange-mode="true"] .phone-app-icon',
  )

  assert.match(
    wrap,
    /height\s*:\s*calc\(var\(--app-viewport-height\)\s*-\s*var\(--app-header-height\)\)/,
  )
  assert.match(wrap, /min-height\s*:\s*0/)
  assert.match(wrap, /overflow\s*:\s*hidden/)

  assert.match(frame, /height\s*:\s*100%/)
  assert.match(frame, /min-height\s*:\s*0/)
  assert.match(frame, /max-height\s*:\s*680px/)
  assert.doesNotMatch(frame, /min-height\s*:\s*(?:600|680)px/)

  assert.match(desktop, /min-height\s*:\s*0/)
  assert.match(desktop, /overflow-y\s*:\s*auto/)
  assert.match(desktop, /overscroll-behavior\s*:\s*contain/)

  assert.match(controls, /display\s*:\s*flex/)
  assert.match(controls, /flex-shrink\s*:\s*0/)
  assert.match(toggle, /min-height\s*:\s*44px/)
  assert.match(moveControls, /display\s*:\s*flex/)
  assert.match(moveButton, /width\s*:\s*44px/)
  assert.match(moveButton, /height\s*:\s*44px/)
  assert.match(icon, /touch-action\s*:\s*pan-y/)
  assert.match(arrangingIcon, /touch-action\s*:\s*none/)
})

test("short coarse-pointer layouts reserve the phone frame for Apps", () => {
  for (const selector of [
    ".phone-editor-wrap > .phone-frame > .phone-island",
    ".phone-editor-wrap > .phone-frame > .phone-profile",
    ".phone-editor-wrap > .phone-frame > .phone-home-bar",
  ]) {
    assert.match(ruleBodiesFor(shortLandscape, selector), /display\s*:\s*none/, selector)
  }
})
