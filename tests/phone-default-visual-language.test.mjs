import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const data = readFileSync(new URL("../js/data.js", import.meta.url), "utf8")
const editor = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const reader = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

test("new phones begin with the gray-pink compact visual preset", () => {
  assert.match(data, /wallpaper\s*:\s*["']#eee6e7["']/i)
  assert.match(data, /frameColor\s*:\s*["']#8f7b81["']/i)
  assert.match(data, /iconBorderRadius\s*:\s*6/)
  assert.match(data, /settings\s*:\s*["']#d7cfd1["']/i)
  assert.match(data, /memo\s*:\s*["']#efe5d4["']/i)
  assert.match(editorCss, /--phone-system-accent\s*:\s*#b88794/i)
})

test("editor and reader share the compact identity widget structure", () => {
  for (const source of [editor, reader]) {
    assert.match(source, /phone-widget-kicker/)
    assert.match(source, /phone-widget-copy/)
    assert.match(source, /phone-widget-status/)
  }
  for (const css of [editorCss, readerCss]) {
    assert.match(css, /\.phone-profile\s*\{[^}]*height\s*:\s*112px/is)
    assert.match(css, /\.phone-widget-kicker\s*\{/)
  }
})

test("opening the author preview never overwrites a reader-customized App color", () => {
  assert.doesNotMatch(editor, /if\s*\(app\.color\s*!==\s*def\.color\)\s*\{\s*app\.color\s*=\s*def\.color/)
  assert.match(editor, /app\.color\s*===\s*["']#f0f0f0["']/i)
})

test("reader desktop and appearance preview share one neutral icon surface", () => {
  assert.match(reader, /READER_DEFAULT_APP_ICON_SURFACE\s*=\s*["']#f0f0f0["']/i)
  assert.equal((reader.match(/READER_DEFAULT_APP_ICON_SURFACE/g) || []).length, 3)
  assert.doesNotMatch(reader, /background:\s*['"]?\s*\+\s*sanitizeCssColor\(app\.color\)/)
})
