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
  assert.match(editorSource, /from\s*["']\.\.\/phone-grid\.js["']/)
  assert.match(editorSource, /PHONE_GRID_METRICS/)
  assert.match(editorSource, /getPhoneGridCell/)
  assert.match(editorSource, /getPhoneGridItemOffset/)
  assert.match(editorSource, /phoneGridContainerStyle/)
  assert.match(editorSource, /phoneGridItemStyle/)
  assert.doesNotMatch(editorSource, /var (?:CELL_W|CELL_H|GRID_COLS|GRID_ROWS|OFFSET_X|OFFSET_Y)\s*=/)
})
