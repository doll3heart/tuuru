import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  buildAuthorHomeUrl,
  buildReaderHomeUrl,
} from "../js/app-entry-links.js"

test("product links preserve an application subdirectory", () => {
  assert.equal(
    buildReaderHomeUrl("https://example.test/tuuru/index.html#new"),
    "https://example.test/tuuru/reader/index.html",
  )
  assert.equal(
    buildAuthorHomeUrl("https://example.test/tuuru/reader/index.html#library"),
    "https://example.test/tuuru/index.html",
  )
})

test("product links reject a missing browser location", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.throws(() => buildReaderHomeUrl(value), TypeError)
    assert.throws(() => buildAuthorHomeUrl(value), TypeError)
  }
})

test("author drafts and imported reader works keep separate storage namespaces", async () => {
  const [authorStorage, readerRuntime] = await Promise.all([
    readFile(new URL("../js/storage.js", import.meta.url), "utf8"),
    readFile(new URL("../reader/reader.js", import.meta.url), "utf8"),
  ])

  assert.match(authorStorage, /LOCAL_DATABASE_KEY\s*=\s*["']tuuru_works["']/)
  assert.match(readerRuntime, /localStorage\.getItem\(['"]moirain_['"]\s*\+\s*key\)/)
  assert.match(readerRuntime, /localStorage\.getItem\(['"]moirain_work_['"]\s*\+\s*id\)/)
  assert.doesNotMatch(readerRuntime, /tuuru_works/)
})
