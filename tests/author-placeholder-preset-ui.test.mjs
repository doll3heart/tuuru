import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const article = await readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const phone = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")
const forumStyles = await readFile(new URL("../css/phone-forum.css", import.meta.url), "utf8")

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

test("article and phone settings exchange complete placeholder preset libraries", () => {
  for (const source of [article, phone]) {
    assert.match(source, /serializeAuthorPlaceholderPresetBundle/)
    assert.match(source, /importAuthorPlaceholderPresetBundle/)
    assert.match(source, /导出预设/)
    assert.match(source, /导入预设/)
    assert.doesNotMatch(source, /导出违禁词|导入违禁词/)
  }
})

test("placeholder preset controls use the shared styled control vocabulary", () => {
  assert.match(styles, /\.ph-author-presets\s+\.ph-select/)
  assert.match(forumStyles, /\.phone-frame \.forum-comment-action-button/)
  assert.match(phone, /class="[^"]*btn[^"]*"[^>]*data-ct-account-add/)
})

test("article and phone placeholder panels expose one compact cleanup workflow", () => {
  for (const source of [article, phone]) {
    assert.match(source, /data-placeholder-search/)
    assert.match(source, /globalForbidden/)
    assert.match(source, /整理全部词库/)
    assert.match(source, /管理预设/)
    assert.match(source, /parseForbiddenWords/)
    assert.match(source, /dedupeForbiddenWords/)
  }
  assert.match(styles, /\.placeholder-tool-search/)
  assert.match(styles, /\.placeholder-global-forbidden/)
  assert.match(styles, /\.placeholder-preset-management/)
})

test("every placeholder card shows the global forbidden words it inherits", () => {
  for (const source of [article, phone]) {
    assert.match(source, /placeholder-inherited-forbidden/)
    assert.match(source, /全局生效/)
  }
  assert.match(styles, /\.placeholder-inherited-forbidden/)
  assert.match(styles, /\.placeholder-inherited-word/)
})
