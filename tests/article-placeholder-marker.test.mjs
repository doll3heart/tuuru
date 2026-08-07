import test from "node:test"
import assert from "node:assert/strict"

import {
  ARTICLE_PLACEHOLDER_MARKER_CLASS,
  articlePlaceholderMarkerHTML,
  articlePlaceholderMarkerIds,
  removeArticlePlaceholderMarkers,
} from "../js/article-placeholder-marker.js"

test("inline placeholder markers are atomic and preserve authored order", () => {
  const first = articlePlaceholderMarkerHTML("placeholder-a")
  const second = articlePlaceholderMarkerHTML("placeholder-b")

  assert.match(first, new RegExp(`class="${ARTICLE_PLACEHOLDER_MARKER_CLASS}"`))
  assert.match(first, /contenteditable="false"/)
  assert.deepEqual(
    articlePlaceholderMarkerIds(`<p>前文</p>${first}<p>中段</p>${second}${first}`),
    ["placeholder-a", "placeholder-b", "placeholder-a"],
  )
})

test("inline placeholder marker helpers reject unsafe ids and remove one definition exactly", () => {
  assert.equal(articlePlaceholderMarkerHTML(" bad "), "")
  assert.equal(articlePlaceholderMarkerHTML(`bad" onclick="x`), "")

  const first = articlePlaceholderMarkerHTML("placeholder-a")
  const second = articlePlaceholderMarkerHTML("placeholder-b")
  assert.deepEqual(
    articlePlaceholderMarkerIds(`<p>正文</p>${first}${second}`),
    ["placeholder-a", "placeholder-b"],
  )
  assert.equal(
    removeArticlePlaceholderMarkers(`<p>正文</p>${first}${second}`, "placeholder-a"),
    `<p>正文</p>${second}`,
  )
})
