import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function functionBody(name, nextMarker) {
  const pattern = new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)${nextMarker}`)
  const match = readerSource.match(pattern)
  assert.ok(match, `${name} source is available`)
  return match[1]
}

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

test("reader phone desktops render native named App controls", () => {
  const desktop = functionBody("buildPhoneHTML", "// ====== PHONE READER")
  const preview = functionBody("renderPhonePreview", "function showReaderToast")

  for (const renderer of [desktop, preview]) {
    assert.match(renderer, /<button type="button" class="phone-app-icon/)
    assert.match(renderer, /aria-label="['"]?\s*\+\s*escapeHtmlAttribute\(appName\)/)
    assert.match(renderer, /<span class="phone-icon-body/)
    assert.match(renderer, /<\/button>/)
    assert.match(renderer, /readerCustomIconUrl\([^\n]*customIcons/)
    assert.match(renderer, /src="['"]?\s*\+\s*escapeHtmlAttribute\(customIcon\)/)
    assert.doesNotMatch(renderer, /<div class="phone-app-icon/)
    assert.doesNotMatch(renderer, /outline:none!important/)
  }

  assert.match(desktop, /<img[^>]+alt=""/)
  assert.match(preview, /<img[^>]+alt=""/)
  assert.match(readerSource, /function isSafeReaderCallBackgroundDataUrl/)
  assert.match(readerSource, /isSafeImageUrl\(value\)/)
})

test("reader App Back controls are named 44px targets with focus continuity", () => {
  const backButtons = [...readerSource.matchAll(
    /<button type="button" class="rd-back-btn" aria-label="([^"]+)"/g,
  )]
  const backRule = ruleBodiesFor(cssWithoutComments, ".rd-back-btn")
  const backFocus = ruleBodiesFor(cssWithoutComments, ".rd-back-btn:focus-visible")
  const backSpacer = ruleBodiesFor(cssWithoutComments, ".rd-back-spacer")

  assert.deepEqual(backButtons.map(match => match[1]), ["返回手机桌面", "返回论坛列表"])
  assert.match(backRule, /width\s*:\s*44px/)
  assert.match(backRule, /height\s*:\s*44px/)
  assert.match(backFocus, /outline\s*:\s*2px\s+solid/)
  assert.equal([...readerSource.matchAll(/class="rd-back-spacer"/g)].length, 2)
  assert.match(backSpacer, /width\s*:\s*44px/)
  assert.match(readerSource, /backBtn\.focus\(\)/)
  assert.match(readerSource, /focusReaderAppIcon\([^)]*type\)/)
})

test("reader App controls keep a visible bounded focus treatment", () => {
  const icon = ruleBodiesFor(cssWithoutComments, ".phone-app-icon")
  const focusBody = ruleBodiesFor(cssWithoutComments, ".phone-app-icon:focus-visible .phone-icon-body")
  const label = ruleBodiesFor(cssWithoutComments, ".phone-icon-label")

  assert.match(icon, /appearance\s*:\s*none/)
  assert.match(icon, /background\s*:\s*transparent/)
  assert.match(icon, /font\s*:\s*inherit/)
  assert.match(focusBody, /outline\s*:\s*2px\s+solid\s+var\(--c-text\)/)
  assert.match(focusBody, /outline-offset\s*:\s*2px/)
  assert.match(label, /display\s*:\s*block/)
})

test("reader calls expose native focusable controls without a dotted call surface", () => {
  const scene = ruleBodiesFor(cssWithoutComments, ".rd-call-scene")
  const advance = ruleBodiesFor(cssWithoutComments, ".rd-call-advance")
  const hangup = ruleBodiesFor(cssWithoutComments, ".rd-call-hangup")
  const advanceFocus = ruleBodiesFor(cssWithoutComments, ".rd-call-advance:focus-visible")
  const hangupFocus = ruleBodiesFor(cssWithoutComments, ".rd-call-hangup:focus-visible")

  assert.match(readerSource, /var transcriptTag = playback\.isComplete \? 'div' : 'button'/)
  assert.match(readerSource, /type="button" class="rd-call-transcript rd-call-advance/)
  assert.doesNotMatch(readerSource, /rd-call-advance[^\n]+onkeydown/)
  assert.doesNotMatch(scene, /radial-gradient\s*\(/)
  assert.match(advance, /min-height\s*:\s*44px/)
  assert.match(hangup, /min-height\s*:\s*44px/)
  assert.match(advanceFocus, /outline\s*:\s*2px\s+solid/)
  assert.match(advanceFocus, /outline-offset\s*:\s*2px/)
  assert.match(hangupFocus, /outline\s*:\s*2px\s+solid/)
})

test("reader call line motion has an explicit reduced-motion override", () => {
  const reducedStart = css.lastIndexOf("@media (prefers-reduced-motion: reduce)")
  assert.notEqual(reducedStart, -1)
  const reduced = css.slice(reducedStart)
  assert.match(reduced, /\.rd-call-line\.current\.is-entering[\s\S]*animation\s*:\s*none\s*!important/)
  assert.match(reduced, /\.rd-call-line\.current\.is-entering[\s\S]*transform\s*:\s*none/)
})
