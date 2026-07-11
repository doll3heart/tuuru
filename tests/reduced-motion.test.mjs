import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const stylesheets = new Map([
  ["editor", readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")],
  ["reader", readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")],
])

test("editor and reader respect the reduced-motion preference", () => {
  for (const [name, css] of stylesheets) {
    const mediaQuery = css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    assert.notEqual(mediaQuery, -1, `${name} media query`)

    const reducedMotion = css.slice(mediaQuery)
    assert.match(reducedMotion, /animation-duration\s*:\s*\.01ms\s*!important/, `${name} animation duration`)
    assert.match(reducedMotion, /animation-iteration-count\s*:\s*1\s*!important/, `${name} animation count`)
    assert.match(reducedMotion, /transition-duration\s*:\s*\.01ms\s*!important/, `${name} transition duration`)
    assert.match(reducedMotion, /scroll-behavior\s*:\s*auto\s*!important/, `${name} scrolling`)
    assert.doesNotMatch(reducedMotion, /transform\s*:\s*none\s*!important/, `${name} keeps layout transforms`)
  }
})
