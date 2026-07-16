import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const previewSource = await readFile(new URL("../reader/reader.js", import.meta.url), "utf8")
const securityCopy = homeSource + "\n" + previewSource

test("reading-password UI never claims that works are encrypted", () => {
  assert.doesNotMatch(securityCopy, /已加密|此作品已加密/)
  assert.match(homeSource, /需阅读密码/)
  assert.match(previewSource, /阅读密码/)
  assert.match(homeSource, /不会加密导出的 JSON 或 PNG 文件/)
})
