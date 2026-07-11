import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { prefersReducedMotion, shouldUseMotion } from "../js/motion-preference.js"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

function mediaEnvironment(matches) {
  const environment = {
    matchMedia(query) {
      assert.equal(this, environment)
      assert.equal(query, "(prefers-reduced-motion: reduce)")
      return { matches }
    },
  }
  return environment
}

test("motion preference detection fails open when the browser API is unavailable", () => {
  assert.equal(prefersReducedMotion({}), false)
  assert.equal(prefersReducedMotion(null), false)
  assert.equal(prefersReducedMotion({ matchMedia() { throw new Error("blocked") } }), false)
})

test("motion preference detection follows the system media query", () => {
  assert.equal(prefersReducedMotion(mediaEnvironment(true)), true)
  assert.equal(prefersReducedMotion(mediaEnvironment(false)), false)
})

test("optional motion requires both a feature opt-in and system permission", () => {
  assert.equal(shouldUseMotion(false, mediaEnvironment(false)), false)
  assert.equal(shouldUseMotion(true, mediaEnvironment(true)), false)
  assert.equal(shouldUseMotion(true, mediaEnvironment(false)), true)
})

test("reader typing is gated by the shared motion preference", () => {
  assert.match(readerSource, /if\s*\(ac\s*&&\s*shouldUseMotion\(rs\.typingEffect\)\)/)
})
