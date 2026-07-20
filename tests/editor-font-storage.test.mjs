import test from "node:test"
import assert from "node:assert/strict"

import {
  editorFontAssetKey,
  persistEditorFontAsset,
  resolveEditorFontAssets,
} from "../js/editor-font-storage.js"

test("font asset keys stay local to one author work", () => {
  assert.equal(editorFontAssetKey("work-a", "font-a"), "work-a:font-a")
})

test("font blobs are persisted without Base64 conversion or an application size ceiling", async () => {
  const largeFont = { size: 28 * 1024 * 1024, type: "font/ttf" }
  const writes = []
  const metadata = await persistEditorFontAsset({
    workId: "work-a",
    fontId: "font-a",
    name: "Large Local Font",
    value: "'Large Local Font', sans-serif",
    format: "truetype",
    blob: largeFont,
  }, {
    put: async record => { writes.push(record) },
  })

  assert.equal(writes.length, 1)
  assert.equal(writes[0].blob, largeFont)
  assert.equal(writes[0].key, "work-a:font-a")
  assert.deepEqual(metadata, {
    id: "font-a",
    name: "Large Local Font",
    value: "'Large Local Font', sans-serif",
    format: "truetype",
  })
})

test("stored font blobs resolve to temporary browser URLs for font-face installation", async () => {
  const urls = []
  const fonts = await resolveEditorFontAssets("work-a", [{
    id: "font-a",
    name: "Stored Font",
    value: "'Stored Font', sans-serif",
    format: "truetype",
  }], {
    get: async key => ({ key, blob: { type: "font/ttf" } }),
    createObjectURL: blob => { urls.push(blob); return "blob:stored-font" },
  })

  assert.equal(urls.length, 1)
  assert.equal(fonts[0].url, "blob:stored-font")
  assert.equal(fonts[0].data, undefined)
})
