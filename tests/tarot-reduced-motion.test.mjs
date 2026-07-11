import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  TAROT_TRANSITION_DURATION_MS,
  runTarotTransition,
} from "../js/tarot-transition.js"

const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

function motionEnvironment(reduced) {
  return {
    matchMedia(query) {
      assert.equal(query, "(prefers-reduced-motion: reduce)")
      return { matches: reduced }
    },
  }
}

test("reduced motion swaps tarot content and unlocks synchronously", () => {
  const calls = []
  const scheduled = []

  const animated = runTarotTransition({
    environment: motionEnvironment(true),
    start() { calls.push("start") },
    midpoint() { calls.push("midpoint") },
    complete() { calls.push("complete") },
    schedule(callback, delay) { scheduled.push({ callback, delay }) },
  })

  assert.equal(animated, false)
  assert.deepEqual(calls, ["midpoint", "complete"])
  assert.deepEqual(scheduled, [])
})

test("normal motion preserves the existing tarot timing", () => {
  const calls = []
  const scheduled = []

  const animated = runTarotTransition({
    environment: motionEnvironment(false),
    start() { calls.push("start") },
    midpoint() { calls.push("midpoint") },
    complete() { calls.push("complete") },
    schedule(callback, delay) { scheduled.push({ callback, delay }) },
  })

  assert.equal(animated, true)
  assert.deepEqual(calls, ["start"])
  assert.equal(TAROT_TRANSITION_DURATION_MS, 550)
  assert.deepEqual(scheduled.map(item => item.delay), [275, 630])
  assert.match(editorCss, /\.tarot-card\s*\{[^}]*transition\s*:\s*all\s+\.55s\b/)

  scheduled[0].callback()
  scheduled[1].callback()
  assert.deepEqual(calls, ["start", "midpoint", "complete"])
})

test("reduced motion still unlocks when the content swap fails", () => {
  const calls = []
  assert.throws(() => runTarotTransition({
    environment: motionEnvironment(true),
    start() { calls.push("start") },
    midpoint() {
      calls.push("midpoint")
      throw new Error("swap failed")
    },
    complete() { calls.push("complete") },
  }), /swap failed/)
  assert.deepEqual(calls, ["midpoint", "complete"])
})

test("the phone tarot delegates its timers to the motion-aware transition", () => {
  const switchStart = phoneSource.indexOf("function switchTo(dir)")
  const switchEnd = phoneSource.indexOf("function bindTarotCloseInternal()", switchStart)
  assert.ok(switchStart >= 0 && switchEnd > switchStart)
  const switchSource = phoneSource.slice(switchStart, switchEnd)

  assert.match(phoneSource, /import\s*\{\s*runTarotTransition\s*\}\s*from\s*["']\.\.\/tarot-transition\.js["']/)
  assert.match(switchSource, /runTarotTransition\(\{[\s\S]*?start\(\)\s*\{[\s\S]*?midpoint\(\)\s*\{[\s\S]*?complete\(\)\s*\{/)
  assert.match(switchSource, /activeIdx\s*=\s*wrap\(activeIdx\s*\+\s*dir\)/)
  assert.match(switchSource, /updateCardContent\(0\)[\s\S]*updateCardContent\(1\)[\s\S]*updateCardContent\(2\)/)
  assert.match(switchSource, /animating\s*=\s*false/)
  assert.doesNotMatch(switchSource, /setTimeout\s*\(/)
})
