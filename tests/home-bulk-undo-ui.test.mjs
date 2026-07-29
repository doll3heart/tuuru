import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const mutationSource = await readFile(new URL("../js/home-work-mutations.js", import.meta.url), "utf8")
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("successful text replacement and time shifting register one guarded undo", () => {
  assert.match(homeSource, /homeBulkUndoStore/)
  assert.match(homeSource, /全作品查找替换/)
  assert.match(homeSource, /批量顺延时间/)
  assert.match(homeSource, /registerBulkUndo/)
  assert.match(homeSource, /expectedWorkToken/)
  assert.match(homeSource, /actionLabel:"撤销"/)
  assert.match(homeSource, /onAction:\(\) => undoBulk/)
})

test("only the affected work card exposes the recent bulk undo action", () => {
  assert.match(homeSource, /data-work-bulk-undo/)
  assert.match(homeSource, /撤销上次批量操作/)
  assert.match(homeSource, /undoLastBulkWork/)
  assert.match(styles, /\.work-bulk-undo/)
})

test("undo restores through the guarded mutation and consumes state after verification", () => {
  assert.match(mutationSource, /export async function restoreHomeWorkSnapshot/)
  assert.match(homeSource, /restoreHomeWorkSnapshot/)
  assert.match(homeSource, /restoreReliable/)
  assert.match(homeSource, /consumeBulkUndo/)
})
