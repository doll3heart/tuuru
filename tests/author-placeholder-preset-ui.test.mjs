import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const article = await readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const phone = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")

test("article and phone placeholder panels share local author preset controls", () => {
  for (const source of [article, phone]) {
    assert.match(source, /readAuthorPlaceholderPresets/)
    assert.match(source, /saveAuthorPlaceholderPreset/)
    assert.match(source, /instantiateAuthorPlaceholderPreset/)
    assert.match(source, /保存当前为预设/)
    assert.match(source, /套用预设/)
    assert.match(source, /删除预设/)
  }
})

test("author preset naming uses project modals instead of system dialogs", () => {
  assert.doesNotMatch(article, /(?:globalThis\.)?prompt\(/)
  assert.doesNotMatch(phone, /(?:globalThis\.)?prompt\(/)
})
