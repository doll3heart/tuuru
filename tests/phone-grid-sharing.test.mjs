import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const sharedUrl = new URL("../js/phone-grid.js", import.meta.url)
const readerFacadeUrl = new URL("../reader/phone-grid.js", import.meta.url)
const editorUrl = new URL("../js/pages/phone.js", import.meta.url)

test("reader and editor use one phone grid metrics implementation", async () => {
  assert.equal(existsSync(sharedUrl), true, "missing shared phone grid module")

  const shared = await import(sharedUrl.href)
  const reader = await import(readerFacadeUrl.href)
  const readerFacade = readFileSync(readerFacadeUrl, "utf8")
  const editorSource = readFileSync(editorUrl, "utf8")

  assert.equal(reader.PHONE_GRID_METRICS, shared.PHONE_GRID_METRICS)
  assert.equal(reader.getPhoneGridPosition, shared.getPhoneGridPosition)
  assert.equal(reader.phoneGridContainerStyle, shared.phoneGridContainerStyle)
  assert.equal(reader.phoneGridItemStyle, shared.phoneGridItemStyle)
  assert.equal(shared.PHONE_GRID_METRICS.columns, 4)
  assert.equal(shared.PHONE_GRID_METRICS.rows, 4)

  assert.match(readerFacade, /from\s+["']\.\.\/js\/phone-grid\.js["']/)
  assert.doesNotMatch(readerFacade, /cellWidth\s*:/)
  assert.match(editorSource, /import\s*\{\s*PHONE_GRID_METRICS\s*\}\s*from\s*["']\.\.\/phone-grid\.js["']/)
  assert.match(editorSource, /var CELL_W\s*=\s*PHONE_GRID_METRICS\.cellWidth/)
  assert.match(editorSource, /var CELL_H\s*=\s*PHONE_GRID_METRICS\.cellHeight/)
  assert.match(editorSource, /var GRID_COLS\s*=\s*PHONE_GRID_METRICS\.columns/)
  assert.match(editorSource, /var GRID_ROWS\s*=\s*PHONE_GRID_METRICS\.rows/)
  assert.match(editorSource, /var OFFSET_X\s*=\s*PHONE_GRID_METRICS\.legacyOriginX/)
  assert.match(editorSource, /var OFFSET_Y\s*=\s*PHONE_GRID_METRICS\.offsetY/)
  assert.doesNotMatch(editorSource, /var CELL_W\s*=\s*80/)
  assert.doesNotMatch(editorSource, /var CELL_H\s*=\s*95/)
})
