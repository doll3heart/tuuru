import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const rootHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const readerHtml = readFileSync(new URL("../reader/index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function viewportDirectives(html) {
  const document = new JSDOM(html).window.document
  const viewports = [...document.querySelectorAll('meta[name="viewport"]')]
  assert.equal(viewports.length, 1)

  return new Map(
    viewports[0].content
      .split(",")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [key, ...value] = part.split("=")
        return [key.trim().toLowerCase(), value.join("=").trim().toLowerCase()]
      }),
  )
}

function ruleBodiesFor(selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssWithoutComments))) {
    const selectors = match[1]
      .split(",")
      .map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies
}

function joinedRuleBodies(selector) {
  return ruleBodiesFor(selector).join("\n")
}

function sourceBetween(startMarker, endMarker) {
  const start = readerSource.indexOf(startMarker)
  const end = readerSource.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return readerSource.slice(start, end)
}

test("both entries allow zoom while only the reader covers display cutouts", () => {
  const root = viewportDirectives(rootHtml)
  const reader = viewportDirectives(readerHtml)

  for (const directives of [root, reader]) {
    assert.equal(directives.get("width"), "device-width")
    assert.equal(Number(directives.get("initial-scale")), 1)
    assert.equal(directives.has("maximum-scale"), false)
    assert.notEqual(directives.get("user-scalable"), "no")
  }

  assert.equal(root.has("viewport-fit"), false)
  assert.equal(reader.get("viewport-fit"), "cover")
})

test("reader CSS exposes a dynamic viewport and all safe-area tokens", () => {
  const rootRules = joinedRuleBodies(":root")

  assert.match(rootRules, /--reader-viewport-height\s*:\s*100vh/)
  assert.match(rootRules, /--reader-viewport-height\s*:\s*100dvh/)
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(
      rootRules,
      new RegExp(`--reader-safe-${edge}\\s*:\\s*env\\(safe-area-inset-${edge},\\s*0px\\)`),
    )
  }

  assert.match(joinedRuleBodies("body"), /min-height\s*:\s*var\(--reader-viewport-height\)/)
  assert.match(joinedRuleBodies("#app"), /min-height\s*:\s*var\(--reader-viewport-height\)/)
})

test("bounded phone mode covers narrow portrait and coarse-pointer landscape", () => {
  assert.match(
    cssWithoutComments,
    /@media\s*\(max-width:\s*480px\)\s*,\s*\(max-height:\s*480px\)\s*and\s*\(pointer:\s*coarse\)/,
  )

  const reader = joinedRuleBodies(".phone-reader")
  const frame = joinedRuleBodies(".phone-reader > .phone-frame")
  const desktop = joinedRuleBodies(".phone-reader > .phone-frame > #phoneDesktopReader")

  assert.match(reader, /position\s*:\s*fixed/)
  assert.match(reader, /inset\s*:\s*0/)
  assert.match(reader, /height\s*:\s*var\(--reader-viewport-height\)/)
  assert.match(reader, /min-height\s*:\s*0/)
  assert.match(reader, /overflow\s*:\s*hidden/)
  assert.match(reader, /--reader-safe-top/)
  assert.match(reader, /--reader-safe-right/)
  assert.match(reader, /--reader-safe-bottom/)
  assert.match(reader, /--reader-safe-left/)

  assert.match(frame, /height\s*:\s*100%/)
  assert.match(frame, /min-height\s*:\s*0/)
  assert.match(frame, /max-height\s*:\s*100%/)

  assert.match(desktop, /min-height\s*:\s*0\s*!important/)
  assert.match(desktop, /overflow-y\s*:\s*auto/)
  assert.match(desktop, /overscroll-behavior\s*:\s*contain/)

  assert.equal(ruleBodiesFor(".phone-frame").length, 1)
})

test("standalone controls and feedback stay inside safe areas", () => {
  const back = joinedRuleBodies(".reader-back")
  const settings = joinedRuleBodies(".reader-settings-btn")
  const toast = joinedRuleBodies(".rd-toast")

  assert.match(back, /top\s*:[^;]*--reader-safe-top/)
  assert.match(back, /left\s*:[^;]*--reader-safe-left/)
  assert.match(back, /width\s*:\s*44px/)
  assert.match(back, /height\s*:\s*44px/)

  assert.match(settings, /top\s*:[^;]*--reader-safe-top/)
  assert.match(settings, /right\s*:[^;]*--reader-safe-right/)
  assert.match(settings, /width\s*:\s*44px/)
  assert.match(settings, /height\s*:\s*44px/)

  assert.match(toast, /bottom\s*:[^;]*--reader-safe-bottom/)
})

test("article phone overlay uses bounded classes and clears its runtime context", () => {
  const source = sourceBetween("var hadPhoneData", "bindOverlayApps(phoneWrapper)")
  const overlay = joinedRuleBodies(".rd-pm-modal")
  const wrapper = joinedRuleBodies(".rd-pm-phone-wrap")
  const frame = joinedRuleBodies(".rd-pm-phone-wrap > .phone-frame")
  const desktop = joinedRuleBodies(".rd-pm-phone-wrap > .phone-frame > #phoneDesktopReader")
  const back = joinedRuleBodies(".rd-pm-back")

  assert.match(source, /overlay\.className\s*=\s*['"]rd-pm-modal['"]/)
  assert.match(source, /hadPhoneData\s*=\s*Object\.prototype\.hasOwnProperty\.call\(_work,\s*['"]phoneData['"]\)/)
  assert.match(source, /previousPhoneData\s*=\s*_work\.phoneData/)
  assert.match(source, /phoneWrapper\.className\s*=\s*['"]rd-pm-phone-wrap['"]/)
  assert.match(source, /backBtn\.className\s*=\s*['"]reader-back rd-pm-back['"]/)
  assert.doesNotMatch(source, /style\.cssText/)
  assert.doesNotMatch(source, /document\.body\.style\.overflow/)
  assert.match(source, /_work\._overlayWrapper\s*=\s*null/)
  assert.match(source, /_work\._inOverlay\s*=\s*false/)
  assert.match(source, /_work\.phoneData\s*=\s*previousPhoneData/)
  assert.match(source, /delete\s+_work\.phoneData/)

  assert.match(overlay, /position\s*:\s*fixed/)
  assert.match(overlay, /inset\s*:\s*0/)
  assert.match(overlay, /height\s*:\s*var\(--reader-viewport-height\)/)
  assert.match(overlay, /overflow\s*:\s*hidden/)
  assert.match(overlay, /overscroll-behavior\s*:\s*none/)
  assert.match(overlay, /--reader-safe-top/)
  assert.match(overlay, /--reader-safe-right/)
  assert.match(overlay, /--reader-safe-bottom/)
  assert.match(overlay, /--reader-safe-left/)

  assert.match(wrapper, /width\s*:\s*375px/)
  assert.match(wrapper, /max-width\s*:\s*100%/)
  assert.match(wrapper, /height\s*:\s*700px/)
  assert.match(wrapper, /max-height\s*:\s*100%/)
  assert.match(wrapper, /min-height\s*:\s*0/)

  assert.match(frame, /height\s*:\s*100%/)
  assert.match(frame, /min-height\s*:\s*0/)
  assert.match(frame, /max-height\s*:\s*100%/)

  assert.match(desktop, /min-height\s*:\s*0\s*!important/)
  assert.match(desktop, /overflow-y\s*:\s*auto/)
  assert.match(desktop, /overscroll-behavior\s*:\s*contain/)

  assert.match(back, /top\s*:[^;]*--reader-safe-top/)
  assert.match(back, /left\s*:[^;]*--reader-safe-left/)
  assert.match(back, /z-index\s*:\s*1510/)
})

test("per-App customization modal assigns scrolling to its body", () => {
  const source = sourceBetween("function openCuModal", "function cuCard")
  const overlay = joinedRuleBodies(".cu-modal-overlay")
  const modal = joinedRuleBodies(".cu-modal")
  const header = joinedRuleBodies(".cu-modal-header")
  const body = joinedRuleBodies(".cu-modal-body")
  const footer = joinedRuleBodies(".cu-modal-footer")

  assert.doesNotMatch(source, /style\.cssText/)
  assert.doesNotMatch(source, /document\.body\.style\.overflow/)

  assert.match(overlay, /position\s*:\s*fixed/)
  assert.match(overlay, /inset\s*:\s*0/)
  assert.match(overlay, /height\s*:\s*var\(--reader-viewport-height\)/)
  assert.match(overlay, /overflow\s*:\s*hidden/)
  assert.match(overlay, /overscroll-behavior\s*:\s*none/)
  assert.match(overlay, /--reader-safe-top/)
  assert.match(overlay, /--reader-safe-right/)
  assert.match(overlay, /--reader-safe-bottom/)
  assert.match(overlay, /--reader-safe-left/)

  assert.match(modal, /max-height\s*:\s*88vh/)
  assert.match(modal, /max-height\s*:\s*min\(88dvh,\s*100%\)/)
  assert.match(modal, /overflow\s*:\s*hidden/)

  assert.match(header, /flex-shrink\s*:\s*0/)
  assert.match(body, /flex\s*:\s*1/)
  assert.match(body, /min-height\s*:\s*0/)
  assert.match(body, /overflow-y\s*:\s*auto/)
  assert.match(body, /overscroll-behavior\s*:\s*contain/)
  assert.match(footer, /flex-shrink\s*:\s*0/)
})
