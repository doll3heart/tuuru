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
    assert.match(source, /<details class="placeholder-global-forbidden"/)
    assert.match(source, /data-placeholder-forbidden-editor/)
  }
  assert.match(styles, /\.placeholder-tool-search/)
  assert.match(styles, /\.placeholder-global-forbidden/)
  assert.match(styles, /\.placeholder-preset-management/)
})

test("global forbidden editors explain substring and exact matching", () => {
  for (const source of [article, phone]) {
    assert.match(source, /包含匹配/)
    assert.match(source, /完全匹配/)
    assert.match(source, /单字也会生效/)
    assert.match(source, /不会拦截包含它的长句/)
    assert.match(source, /globalExactForbidden/)
    assert.match(source, /data-ph-exact-forbidden/)
  }
  assert.match(styles, /\.placeholder-forbidden-groups/)
  assert.match(styles, /\.placeholder-forbidden-group/)
})

test("the inline placeholder help explains forbidden scope and preset merging", () => {
  assert.match(article, /单项词只限制当前占位符[^。]*全局词会叠加到本作品全部占位符/)
  assert.match(article, /包含匹配会拦截含有该词的长句/)
  assert.match(article, /完全匹配只拦截去除首尾空格后整段相同的答案/)
  assert.match(article, /预设中的全局违禁词会与当前作品词库合并去重[^。]*不会覆盖原词/)
})

test("global forbidden editors use a scoped responsive hierarchy", () => {
  for (const source of [article, phone]) {
    assert.match(source, /placeholder-global-heading/)
    assert.match(source, /placeholder-scope-badge[^>]*>全作品</)
    assert.match(source, /placeholder-forbidden-actions/)
    assert.match(source, /支持换行、逗号、顿号、分号或斜杠分隔/)
  }
  assert.match(styles, /\.placeholder-global-forbidden\{[^}]*container-type:inline-size/)
  assert.match(styles, /\.placeholder-global-forbidden>\.placeholder-forbidden-body\{[^}]*grid-template-columns:1fr/)
  assert.match(styles, /@container placeholder-global \(min-width:520px\)/)
  assert.match(styles, /\.placeholder-forbidden-actions\{[^}]*justify-content:space-between/)
})

test("global and per-placeholder forbidden editors start collapsed", () => {
  for (const source of [article, phone]) {
    assert.match(source, /<details class="placeholder-global-forbidden"/)
    assert.match(source, /<details class="[^"]*placeholder-forbidden-editor[^"]*"[^>]*data-placeholder-forbidden-editor/)
    assert.doesNotMatch(source, /<section class="placeholder-global-forbidden"/)
  }
  assert.match(styles, /\.placeholder-forbidden-editor>summary/)
  assert.match(styles, /\.placeholder-forbidden-body/)
})

test("every placeholder card collapses the global forbidden words it inherits", () => {
  for (const source of [article, phone]) {
    assert.match(source, /placeholder-inherited-forbidden/)
    assert.match(source, /全局生效/)
    assert.match(source, /<details class="placeholder-inherited-forbidden"/)
    assert.match(source, /个违禁词/)
    assert.match(source, /inheritedWords\.includes\(query\)/)
  }
  assert.match(styles, /\.placeholder-inherited-forbidden/)
  assert.match(styles, /\.placeholder-inherited-forbidden>summary/)
  assert.match(styles, /\.placeholder-inherited-forbidden\[open\]/)
  assert.match(styles, /\.placeholder-inherited-word/)
})
