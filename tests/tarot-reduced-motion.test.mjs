import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const tarotTransitionUrl = new URL("../js/tarot-transition.js", import.meta.url)

test("the editor no longer ships the legacy tarot contact selector", () => {
  assert.equal(existsSync(tarotTransitionUrl), false)
  assert.doesNotMatch(phoneSource, /tarot-transition|runTarotTransition|openTarotPanel|bindTarotEvents|bindTarotClose|openTarotDetail/)
  assert.doesNotMatch(phoneSource, /tarot-card|tarot-deck|_tarot/)
  assert.doesNotMatch(editorCss, /\.tarot-(?:card|deck|front|back|hint)/)
})

test("character access opens a neutrally named app editor", () => {
  assert.match(phoneSource, /function\s+openCharacterAppEditor\s*\(frame,\s*wid,\s*type,\s*contact\)/)
  assert.match(phoneSource, /openCharacterAppEditor\(frame,\s*wid,\s*type,\s*selectedContact\)/)
})

test("character access transitions respect reduced motion", () => {
  assert.match(editorCss, /\.character-access-option\s*\{[^}]*transition\s*:\s*background\s+\.18s[^}]*color\s+\.18s/)
  assert.match(
    editorCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.character-access-option[\s\S]*?\.character-access-actions button[\s\S]*?transition\s*:\s*none\s*!important[\s\S]*?\.character-access-actions button:active[\s\S]*?transform\s*:\s*translateY\(0\)[\s\S]*?\}/,
  )
})
