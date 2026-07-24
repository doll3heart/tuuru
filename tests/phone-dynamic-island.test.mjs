import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { normalizeDynamicIslandStyle } from "../js/phone-dynamic-island.js"

const root = new URL("../", import.meta.url)
const text = path => readFile(new URL(path, root), "utf8")

test("dynamic island style keeps legacy works on the capsule and supports a small circle", () => {
  assert.equal(normalizeDynamicIslandStyle(undefined), "pill")
  assert.equal(normalizeDynamicIslandStyle("pill"), "pill")
  assert.equal(normalizeDynamicIslandStyle("circle"), "circle")
  assert.equal(normalizeDynamicIslandStyle("square"), "pill")
})

test("author and reader renderers expose the shared island style to CSS", async () => {
  const [author, reader, authorCss, readerCss] = await Promise.all([
    text("js/pages/phone.js"),
    text("reader/reader.js"),
    text("css/styles.css"),
    text("reader/reader.css"),
  ])

  assert.match(author, /data-island-style/)
  assert.match(reader, /data-island-style/)
  assert.match(authorCss, /\.phone-island-pill\[data-island-style="pill"\][^{]*\{[^}]*border-radius:\s*999px/s)
  assert.match(authorCss, /\.phone-island-pill\[data-island-style="circle"\][^{]*\{[^}]*width:\s*18px[^}]*height:\s*18px[^}]*border-radius:\s*50%/s)
  assert.match(readerCss, /\.phone-island-pill\[data-island-style="circle"\]/)
})
