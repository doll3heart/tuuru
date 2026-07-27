import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const dialogSource = await readFile(new URL("../js/deletion-impact-ui.js", import.meta.url), "utf8")
const editorSource = await readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const phoneSource = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("shared deletion impact dialog lists references and keeps deletion explicit", () => {
  assert.match(dialogSource, /openDeletionImpactDialog/)
  assert.match(dialogSource, /data-deletion-impact-locate/)
  assert.match(dialogSource, /仍然删除/)
  assert.match(dialogSource, /不会自动修改这些引用/)
  assert.match(styles, /\.deletion-impact-list/)
})

test("article node and choice deletion inspect references before mutating", () => {
  assert.match(editorSource, /findWorkReferences/)
  assert.match(editorSource, /kind:\s*"node"/)
  assert.match(editorSource, /kind:\s*"choice"/)
  assert.match(editorSource, /openDeletionImpactDialog/)
  assert.match(editorSource, /writeArticleEditorViewState/)
})

test("phone contact and NPC deletion inspect references and can open the owning App", () => {
  assert.match(phoneSource, /findWorkReferences/)
  assert.match(phoneSource, /kind:\s*["']contact["']/)
  assert.match(phoneSource, /kind:\s*["']npc["']/)
  assert.match(phoneSource, /openDeletionImpactDialog/)
  assert.match(phoneSource, /reference\.appType/)
})
