import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const previewSource = await readFile(new URL("../reader/reader.js", import.meta.url), "utf8")
const securityCopy = homeSource + "\n" + previewSource

test("reading-password UI accurately describes encrypted and legacy exports", () => {
  assert.doesNotMatch(securityCopy, /无法破解|绝对安全/)
  assert.match(homeSource, /新导出的 \.tuuru 和 PNG 会隐藏密码与正文/)
  assert.match(homeSource, /旧 JSON、旧 PNG 不受保护/)
  assert.match(homeSource, /不等同于 DRM/)
})
