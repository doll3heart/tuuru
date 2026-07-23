import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const home = readFileSync(new URL("../js/pages/home.js", import.meta.url), "utf8")
const collections = readFileSync(new URL("../js/pages/home-collections.js", import.meta.url), "utf8")
const authorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const reader = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

test("author shelf exposes bounded long-press selection and persistent collection cards", () => {
  assert.match(collections, /COLLECTION_LONG_PRESS_MS = 550/)
  assert.match(collections, /COLLECTION_LONG_PRESS_MOVE_PX = 10/)
  assert.match(collections, /pointerdown/)
  assert.match(collections, /event\.pointerType === "mouse"/)
  assert.match(collections, /contextmenu/)
  assert.match(collections, /enterSelection\(card\.dataset\.id\)/)
  assert.match(collections, /pointercancel/)
  assert.match(collections, /lostpointercapture/)
  assert.match(collections, /selectedWorkIds\.size < 2/)
  assert.doesNotMatch(collections, /\bdeleteWork\b/)
  assert.match(home, /renderCollectionCards\(collections, getWorks\(\)\)/)
  assert.match(home, /filter === 'all' \? getWorkCollections\(\) : \[\]/)
})

test("collection controls use safe-area and touch-target styling", () => {
  assert.match(authorCss, /\.collection-selection-bar\{[^}]*safe-area-inset-bottom/)
  assert.match(authorCss, /\.collection-selection-bar \.btn\{min-height:44px\}/)
  assert.match(authorCss, /\.work-card\.collection-selected/)
  assert.match(authorCss, /\.work-card-select\{[^}]*visibility:hidden[^}]*pointer-events:none/)
  assert.match(authorCss, /\.collection-selection-active \.work-card-select\{visibility:visible;opacity:1;pointer-events:auto\}/)
})

test("reader routes collection files to a separate library and keeps directory navigation", () => {
  assert.match(reader, /payload\.type === WORK_COLLECTION_BUNDLE_TYPE/)
  assert.match(reader, /我的作品集/)
  assert.match(reader, /data-reader-collection-work/)
  assert.match(reader, /skipLanding: true/)
  assert.match(reader, /if \(_activeReaderCollectionId\) renderReaderCollectionById/)
})
