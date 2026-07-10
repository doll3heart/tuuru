import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  PHONE_GRID_METRICS,
  getPhoneGridCell,
  getPhoneGridItemOffset,
  getPhoneGridPosition,
} from "../js/phone-grid.js"

const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

test("shared grid geometry round-trips the bordered editor positions", () => {
  const expected = [1, 81, 161, 241]
  for (let column = 0; column < PHONE_GRID_METRICS.columns; column += 1) {
    const position = getPhoneGridPosition(314, column, 2)
    assert.equal(position.left, expected[column])
    assert.equal(position.top, 226)
    assert.deepEqual(getPhoneGridCell(314, position.left, position.top), {
      x: column,
      y: 2,
    })
  }

  assert.deepEqual(getPhoneGridItemOffset(3, 1), { left: 240, top: 131 })
  assert.deepEqual(getPhoneGridCell(314, -100, -100), { x: -1, y: -1 })
})

test("the editor renderer uses container-relative grid variables", () => {
  const desktop = ruleBodiesFor(cssWithoutComments, ".phone-desktop")
  const icon = ruleBodiesFor(cssWithoutComments, ".phone-app-icon")

  assert.match(phoneSource, /phoneGridContainerStyle\(\)/)
  assert.match(phoneSource, /phoneGridItemStyle\(desktopX, desktopY\)/)
  assert.match(phoneSource, /data-desktop-x=/)
  assert.match(phoneSource, /data-desktop-y=/)
  assert.match(desktop + phoneSource, /--phone-grid-origin-x/)
  assert.match(icon, /left\s*:\s*calc\(var\(--phone-grid-origin-x[^;]*var\(--phone-grid-x/)
  assert.match(icon, /top\s*:\s*var\(--phone-grid-y/)
  assert.doesNotMatch(phoneSource, /style="left:' \+ x/)
})

test("drag snapping returns temporary pixels to logical grid variables", () => {
  assert.match(phoneSource, /getPhoneGridCell\((?:_dragState|state)\.containerWidth, left, top\)/)
  assert.match(phoneSource, /applyPhoneGridItemPosition\(icon, col, row\)/)
  assert.match(phoneSource, /applyPhoneGridItemPosition\(oi, a\.desktopX, a\.desktopY\)/)
  assert.match(phoneSource, /removeProperty\(['"]left['"]\)/)
  assert.match(phoneSource, /removeProperty\(['"]top['"]\)/)
  assert.doesNotMatch(phoneSource, /Math\.round\(\(left - OFFSET_X\) \/ CELL_W\)/)
})
