import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const home = readFileSync(new URL("../js/pages/home.js", import.meta.url), "utf8")

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ""
}

test("the author shell uses one tactile gray-pink component language", () => {
  assert.match(rule(".app-header"), /box-shadow\s*:/)
  assert.match(rule(".btn"), /border-radius\s*:\s*3px/)
  assert.match(rule(".btn"), /box-shadow\s*:/)
  assert.match(rule(".editor-iconbar"), /box-shadow\s*:/)
  assert.match(rule(".editor-area"), /background-image\s*:/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})

test("the empty library renders the designed empty-state ornament", () => {
  assert.match(home, /class="empty-icon"/)
  assert.doesNotMatch(home, /class="icon"><\/div><h3>还没有作品/)
  assert.match(rule(".empty-state"), /border\s*:/)
  assert.match(rule(".empty-state"), /background\s*:/)
})
