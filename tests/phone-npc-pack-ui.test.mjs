import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const phone = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("forum NPC management can save to and import from the author pack library", () => {
  assert.match(phone, /id="fbNpcPackSave"/)
  assert.match(phone, /id="fbNpcPackImport"/)
  assert.match(phone, /function saveCurrentNpcPack\(\)/)
  assert.match(phone, /function importNpcPackIntoWork\(\)/)
  assert.match(phone, /saveNpcPack\(\{/)
  assert.match(phone, /mergeNpcPack\(npcs,\s*pack/)
})

test("work-level NPC import explains append behavior and persists once", () => {
  assert.match(phone, /导入会追加 NPC，不覆盖当前作品已有角色；相同 ID 会自动换新/)
  assert.match(phone, /pd\.forumNpcs = npcs[\s\S]*saveData\(\)[\s\S]*renderForum\(\)/)
  assert.match(phone, /当前作品还没有可保存的 NPC/)
})

test("NPC pack tools fit the existing phone editor at narrow widths", () => {
  assert.match(css, /\.forum-npc-pack-tools\{[^}]*background:var\(--c-surface2\)/s)
  assert.match(css, /@media \(max-width:600px\)\{\.forum-npc-pack-tools\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s)
})
