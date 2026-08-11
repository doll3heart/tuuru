import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const authorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

test("reader hotspots stay visually invisible during ordinary touch and hold", () => {
  const baseRule = readerCss.match(/\.interactive-scene-hotspot\s*\{([^}]*)\}/)?.[1] || ""

  assert.doesNotMatch(baseRule, /min-(?:width|height)\s*:/)
  assert.doesNotMatch(readerCss, /\.interactive-scene-hotspot:active\s*,/)
  assert.doesNotMatch(readerCss, /\.interactive-scene-hotspot\.is-holding\s*\{/)
})

test("reader hotspots expose keyboard focus without revealing armed proximity regions", () => {
  assert.match(readerCss, /\.interactive-scene-hotspot:focus-visible\s*\{[^}]*outline:/s)
  const armedRule = readerCss.match(
    /\.interactive-scene-hotspot\[data-face-armed="true"\]\s*\{([^}]*)\}/s,
  )?.[1] || ""
  assert.doesNotMatch(armedRule, /background\s*:\s*rgba\(/)
  assert.doesNotMatch(armedRule, /outline\s*:\s*[1-9]/)
})

test("failed optional pictures stay hidden and the Continue cue never shifts dialogue copy", () => {
  for (const css of [authorCss, readerCss]) {
    assert.match(css, /\.interactive-scene-media img\[hidden\][^{]*\{[^}]*display\s*:\s*none/s)
    const readyRule = css.match(/\.interactive-scene-dialogue\[data-advance-ready="true"\]\s*\{([^}]*)\}/s)?.[1] || ""
    assert.doesNotMatch(readyRule, /padding(?:-bottom)?\s*:/)
  }
})

test("lightweight picture choices have the same touch-safe overlay in author and reader styles", () => {
  for (const css of [authorCss, readerCss]) {
    assert.match(css, /\.interactive-scene-choices\s*\{[^}]*z-index:\s*12[^}]*width:\s*min\(82%,\s*420px\)/s)
    assert.match(css, /\.interactive-scene-choices\[hidden\]\s*\{[^}]*display:\s*none/s)
    assert.match(css, /\.interactive-scene-choice\s*\{[^}]*min-height:\s*44px/s)
    assert.match(css, /\.interactive-scene-choice:focus-visible\s*\{[^}]*outline:/s)
  }
})
