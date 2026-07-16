import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] || ""
}

test("author shell exposes one restrained toy-like surface language", () => {
  assert.match(css, /--ui-raised-shadow\s*:/)
  assert.match(css, /--ui-pressed-shadow\s*:/)
  assert.match(rule(".app-header"), /box-shadow\s*:\s*var\(--ui-raised-shadow\)/)
  assert.match(rule(".card"), /box-shadow\s*:\s*var\(--ui-raised-shadow\)/)
  assert.match(rule(".editor-iconbar"), /background-image\s*:/)
  assert.match(rule(".world-tree"), /background-image\s*:/)
})

test("author controls stay compact, squared, and keyboard-visible", () => {
  assert.match(rule(".btn"), /border-radius\s*:\s*3px/)
  assert.match(rule(".editor-toolbar button"), /border-radius\s*:\s*2px/)
  assert.match(css, /\.btn:focus-visible[^}]*outline\s*:\s*2px solid var\(--c-primary-hover\)/s)
  assert.doesNotMatch(css, /rgba\(164\s*,\s*198\s*,\s*235/)
})
