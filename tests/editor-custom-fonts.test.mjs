import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import {
  activateEditorCustomFonts,
  editorFontFormat,
  editorFontValue,
  installEditorCustomFonts,
  removeEditorCustomFont,
  renameEditorCustomFont,
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

test("an existing local author font can be renamed without changing its asset id", () => {
  const font = { id: "font-1", name: "Old Name", value: editorFontValue("Old Name"), format: "truetype" }
  const result = renameEditorCustomFont([font], "font-1", "New Name")

  assert.equal(result[0].id, "font-1")
  assert.equal(result[0].name, "New Name")
  assert.equal(result[0].value, editorFontValue("New Name"))
  assert.throws(
    () => renameEditorCustomFont([font, { id: "font-2", name: "Used" }], "font-1", "Used"),
    /已存在/,
  )
})

test("an existing local author font can be removed by asset id", () => {
  const result = removeEditorCustomFont([
    { id: "font-1", name: "Keep" },
    { id: "font-2", name: "Remove" },
  ], "font-2")

  assert.deepEqual(result, [{ id: "font-1", name: "Keep" }])
})

test("font import success waits for the browser font engine to load and register the face", async () => {
  const events = []
  class FakeFontFace {
    constructor(name, source) { this.family = name; this.source = source }
    async load() { events.push("loaded"); return this }
  }
  const doc = {
    fonts: {
      add(face) { events.push(`added:${face.family}`) },
      delete() {},
    },
  }

  await activateEditorCustomFonts(doc, [{
    name: "Engine Font",
    url: "blob:engine-font",
    format: "truetype",
  }], FakeFontFace)

  assert.deepEqual(events, ["loaded", "added:Engine Font"])
})

test("font engine rejection propagates instead of reporting a false import success", async () => {
  class BrokenFontFace {
    async load() { throw new Error("invalid font") }
  }
  const doc = { fonts: { add() {}, delete() {} } }

  await assert.rejects(
    activateEditorCustomFonts(doc, [{ name: "Broken", url: "blob:broken", format: "truetype" }], BrokenFontFace),
    /invalid font/,
  )
})
