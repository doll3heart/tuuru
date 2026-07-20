import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const appSource = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

test("the author editor defaults to the Tuuru gray-pink preset", () => {
  assert.match(appSource, /DEFAULT_EDITOR_THEME\s*=\s*["']tuuru["']/)
  assert.match(appSource, /id\s*:\s*["']tuuru["'][^\n]*name\s*:\s*["']灰粉波点["']/)
  assert.match(appSource, /localStorage\.getItem\(["']tuuru_theme["']\)\s*\|\|\s*DEFAULT_EDITOR_THEME/)

  const root = editorCss.match(/:root\s*\{([^}]*)\}/)?.[1] || ""
  assert.match(root, /--c-bg\s*:\s*#EEE6E7/i)
  assert.match(root, /--c-primary\s*:\s*#C7A1AA/i)
  assert.match(root, /--c-text\s*:\s*#40383B/i)
  assert.match(root, /--c-dot\s*:/i)
})

test("gray-pink dots belong to the author shell, not reader defaults", () => {
  assert.match(editorCss, /body\s*\{[^}]*background-image\s*:\s*radial-gradient/is)
  assert.doesNotMatch(readerCss, /--c-dot\s*:/i)
})

test("the reader shell defaults to the same restrained gray-pink family", () => {
  const root = readerCss.match(/:root\s*\{([^}]*)\}/)?.[1] || ""
  assert.match(root, /--c-bg\s*:\s*#EEE6E7/i)
  assert.match(root, /--c-surface\s*:\s*#FFFAF9/i)
  assert.match(root, /--c-primary\s*:\s*#C7A1AA/i)
  assert.match(root, /--c-primary-hover\s*:\s*#6F4A55/i)
  assert.match(root, /--c-text\s*:\s*#40383B/i)
  assert.doesNotMatch(readerCss, /#(?:ECF4FE|D3E5F8|A4C6EB|416598)|rgba\(164\s*,\s*198\s*,\s*235/i)
  assert.doesNotMatch(readerSource, /#(?:ECF4FE|D3E5F8|A4C6EB|416598)/i)
})
