import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

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
