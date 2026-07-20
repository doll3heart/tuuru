import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import {
  editorFontFormat,
  editorFontValue,
  installEditorCustomFonts,
  upsertEditorCustomFont,
} from "../js/editor-custom-fonts.js"

test("font extensions map to the correct CSS format", () => {
  assert.equal(editorFontFormat("novel.ttf"), "truetype")
  assert.equal(editorFontFormat("novel.otf"), "opentype")
  assert.equal(editorFontFormat("novel.woff"), "woff")
  assert.equal(editorFontFormat("novel.woff2"), "woff2")
})

test("saved font data is installed into one managed stylesheet", () => {
  const dom = new JSDOM("<!doctype html><head></head><body></body>")
  const font = {
    name: 'My "Font"',
    value: editorFontValue('My "Font"'),
    data: "data:font/ttf;base64,AA==",
    format: "truetype",
  }

  installEditorCustomFonts(dom.window.document, [font, { name: "legacy", value: '"legacy", sans-serif' }])
  const style = dom.window.document.getElementById("editor-custom-fonts-style")

  assert.ok(style)
  assert.match(style.textContent, /data:font\/ttf;base64,AA==/)
  assert.match(style.textContent, /format\("truetype"\)/)
  assert.doesNotMatch(style.textContent, /legacy/)

  installEditorCustomFonts(dom.window.document, [])
  assert.equal(dom.window.document.getElementById("editor-custom-fonts-style"), null)
})

test("reimporting a font replaces the same name instead of growing duplicates", () => {
  const first = { name: "Novel", value: editorFontValue("Novel"), data: "data:font/ttf;base64,AA==", format: "truetype" }
  const replacement = { name: "Novel", value: editorFontValue("Novel"), data: "data:font/woff2;base64,BB==", format: "woff2" }
  const result = upsertEditorCustomFont([first], replacement)

  assert.equal(result.length, 1)
  assert.equal(result[0].data, replacement.data)
  assert.equal(result[0].format, "woff2")
})
