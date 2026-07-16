import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const editorSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function ruleBodiesFor(css, selector) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some(item => item.trim() === selector))
    .map(([, , body]) => body)
    .join(";")
}

function pseudoBodiesFor(css, selector) {
  return ["::before", "::after"]
    .map(pseudo => ruleBodiesFor(css, selector + pseudo))
    .filter(Boolean)
    .join(";")
}

test("author memo cards consume their per-character accent inside the shared phone surface", () => {
  assert.match(editorSource, /class=["']memo-card["'][^>]*--memo-accent\s*:/)
  const memo = ruleBodiesFor(editorCss, ".memo-card")
  assert.match(memo, /var\(--memo-accent\)/)
  assert.match(memo, /var\(--phone-system-(?:surface|border|radius|shadow)/)
})

test("author gallery photos keep a small film-frame detail without extra markup", () => {
  const photo = ruleBodiesFor(editorCss, ".gallery-photo-card")
  assert.match(photo, /var\(--phone-system-(?:surface|border|radius|shadow)/)
  assert.match(pseudoBodiesFor(editorCss, ".gallery-photo-card"), /content\s*:/)
})

test("author browser rows read as archive tickets", () => {
  const row = ruleBodiesFor(editorCss, ".browser-row")
  assert.match(row, /var\(--phone-system-(?:surface|border|radius|shadow)/)
  assert.match(pseudoBodiesFor(editorCss, ".browser-row"), /content\s*:/)
})

test("author shopping cards retain a receipt edge", () => {
  const receipt = ruleBodiesFor(editorCss, ".shop-card-block")
  assert.match(receipt, /var\(--phone-system-(?:surface|border|radius|shadow)/)
  assert.match(pseudoBodiesFor(editorCss, ".shop-card-block"), /content\s*:/)
})

test("author contact identity cards use compact non-circular geometry", () => {
  assert.match(ruleBodiesFor(editorCss, ".ct-card"), /var\(--phone-system-(?:surface|border|radius|shadow)/)
  const avatar = ruleBodiesFor(editorCss, ".ct-avatar")
  assert.match(avatar, /border-radius\s*:\s*var\(--phone-system-radius-/)
  assert.doesNotMatch(avatar, /border-radius\s*:\s*50%/)
})

test("reader simple apps expose semantic cards backed by phone-system tokens", () => {
  const semanticCards = [
    ".rd-memo-note",
    ".rd-gallery-photo",
    ".rd-browser-entry",
    ".rd-shop-receipt",
    ".rd-contact-entry",
    ".rd-profile-card-phone"
  ]

  for (const selector of semanticCards) {
    const className = selector.slice(1)
    assert.match(readerSource, new RegExp(`class=["'][^"']*\\b${className}\\b`), `${className} should be emitted by the reader`)
    assert.match(ruleBodiesFor(readerCss, selector), /var\(--phone-system-(?:surface|border|radius|shadow)/, `${selector} should consume a shared phone-system token`)
  }

  assert.match(readerSource, /--rd-browser-entry:[^\n]*sanitizeCssColor\(browserSettings\.entryBg\)/)
})
