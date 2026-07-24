import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const resources = await readFile(new URL("../js/pages/resources.js", import.meta.url), "utf8")
const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("writing habits exposes named contact and author-global NPC packs", () => {
  assert.match(resources, /联系人包名称/)
  assert.match(resources, /serializeContactBundle\(contacts,\s*\{\s*name\s*\}\)/)
  assert.match(resources, /论坛 NPC 包/)
  assert.match(resources, /保存到通用 NPC 包/)
  assert.match(resources, /data-npc-pack-name/)
  assert.match(resources, /readNpcPacks\(\)/)
  assert.match(resources, /saveNpcPack\(/)
})

test("NPC pack library supports file portability and safe deletion", () => {
  assert.match(resources, /导出全部 NPC 包/)
  assert.match(resources, /导入 NPC 包文件/)
  assert.match(resources, /serializeNpcPackLibrary/)
  assert.match(resources, /importNpcPackLibrary/)
  assert.match(resources, /各作品中已导入的 NPC 不会受影响/)
})

test("NPC pack UI reuses current compact author surface vocabulary", () => {
  assert.match(resources, /class="habit-section"/)
  assert.match(resources, /class="btn btn-primary"/)
  assert.match(resources, /class="form-input"/)
  assert.match(css, /\.npc-pack-row\{[^}]*border-bottom:1px solid var\(--c-border\)/s)
  assert.match(css, /@media \(max-width:600px\)\{[\s\S]*\.npc-pack-row\{[^}]*flex-direction:column/s)
})
