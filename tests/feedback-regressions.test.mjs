import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("browser history keeps an author-editable date and time instead of overwriting it", async () => {
  const source = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")

  assert.match(source, /class=["']browser-time browser-time-input["']/)
  assert.match(source, /existing\.time\s*=\s*timeEl\s*\?\s*timeEl\.value\.trim\(\)\s*:\s*existing\.time/)
})

test("reader phone messages resolve author placeholders for bubbles and streamed text", async () => {
  const source = await readFile(new URL("../reader/reader.js", import.meta.url), "utf8")

  assert.match(source, /function readerPhoneText\(value\)/)
  assert.match(source, /renderReaderMentionText\(readerPhoneText\(msg\.text\),\s*chatMentionNames\)/)
  assert.match(source, /Array\.from\(readerPhoneText\(message\.text\)\)/)
})

test("format buttons preserve the text selection before applying visibly active state", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8"),
    readFile(new URL("../css/styles.css", import.meta.url), "utf8"),
  ])

  assert.match(source, /addEventListener\(["']pointerdown["'][\s\S]*FORMAT_COMMANDS\[button\.dataset\.a\][\s\S]*preventDefault\(\)/)
  assert.match(styles, /button\.is-active[^}]*font-weight\s*:\s*700[^}]*box-shadow/s)
})

test("contact and forum author controls keep their visual hierarchy on narrow screens", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8"),
    readFile(new URL("../css/styles.css", import.meta.url), "utf8"),
  ])

  assert.match(styles, /\.sr-only\s*\{[^}]*clip-path\s*:\s*inset\(50%\)/s)
  assert.match(source, /class=["']forum-reply-controls["']/)
  assert.match(source, /data-forum-comment-delete=/)
  assert.match(source, /data-forum-reply-delete=/)
  assert.doesNotMatch(source, /delBtn\.className\s*=\s*["']browser-del["']/)
  assert.doesNotMatch(styles, /\.forum-replies\s*\{[^}]*margin\s*:\s*6px\s+0\s+0\s+36px/s)
  assert.match(styles, /@media\(max-width:520px\)[\s\S]*\.ct-account-row/s)
})

test("message context menus use the viewport placement helper and accessible menu items", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8"),
    readFile(new URL("../css/styles.css", import.meta.url), "utf8"),
  ])

  assert.match(source, /placeFixedMenuWithinViewport\(menu,\s*\{\s*x:\s*e\.clientX,\s*y:\s*e\.clientY\s*\}/)
  assert.match(source, /document\.body\.appendChild\(menu\)/)
  assert.match(styles, /\.chat-ctx-menu-item\s*\{[^}]*min-height\s*:\s*44px/s)
})

test("Moments use message identity avatars in author and reader views", async () => {
  const [author, reader] = await Promise.all([
    readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8"),
    readFile(new URL("../reader/reader.js", import.meta.url), "utf8"),
  ])

  assert.match(author, /var momentAvatar = contactAvatar\(c, 'messages'\)/)
  assert.match(reader, /resolveContactIdentity\(pd, moment\.contactId, \{ surface: 'messages'/)
  assert.match(reader, /momentIdentity\.avatar/)
})

test("placeholder display names, comment times, and memo times remain author editable", async () => {
  const [editor, phone] = await Promise.all([
    readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8"),
    readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8"),
  ])

  assert.match(editor, /id=["']ph_label_/)
  assert.match(editor, /label:\s*document\.getElementById\('ph_label_'/)
  assert.match(phone, /id=["']ecTime["']/)
  assert.match(phone, /c\.time\s*=\s*ov\.querySelector\('#ecTime'\)\.value\.trim\(\)/)
  assert.match(phone, /class=["']memo-time-input["']/)
  assert.doesNotMatch(phone, /existing\.time\s*=\s*new Date\(\)\.toLocaleString\(\)/)
})

test("chapters expose direct node creation and pass the selected chapter id", async () => {
  const [editor, data] = await Promise.all([
    readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8"),
    readFile(new URL("../js/data.js", import.meta.url), "utf8"),
  ])

  assert.match(editor, /data-a=["']chapter-add-node["']/)
  assert.match(editor, /addNode\(w,\s*undefined,\s*sid\)/)
  assert.match(data, /function addNode\(workId,afterId,chapterId\)/)
})
