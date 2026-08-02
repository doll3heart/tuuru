import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  PHONE_GRID_METRICS,
  getPhoneGridPosition,
  phoneGridContainerStyle,
  phoneGridItemStyle,
} from "../reader/phone-grid.js"
import {
  PHONE_HOME_CELL_HEIGHT,
  PHONE_HOME_COLUMNS,
  PHONE_HOME_ROWS,
} from "../reader/phone-home-layout.js"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssText))) {
    const selectors = match[1]
      .split(",")
      .map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

function atRuleBody(pattern) {
  const match = pattern.exec(cssWithoutComments)
  assert.ok(match, `missing at-rule: ${pattern}`)
  const open = cssWithoutComments.indexOf("{", match.index)
  let depth = 0

  for (let index = open; index < cssWithoutComments.length; index += 1) {
    if (cssWithoutComments[index] === "{") depth += 1
    if (cssWithoutComments[index] === "}") depth -= 1
    if (depth === 0) return cssWithoutComments.slice(open + 1, index)
  }

  assert.fail("unterminated at-rule")
}

test("a 320px phone desktop keeps all four legacy columns in bounds", () => {
  const positions = Array.from({ length: PHONE_GRID_METRICS.columns }, (_, column) => (
    getPhoneGridPosition(320, column, 0)
  ))

  assert.deepEqual(positions.map(position => position.left), [4, 84, 164, 244])
  assert.deepEqual(positions.map(position => position.top), [36, 36, 36, 36])

  positions.forEach((position, index) => {
    assert.ok(position.left >= 0)
    assert.ok(position.left + PHONE_GRID_METRICS.iconWidth <= 320)
    if (index > 0) {
      const previous = positions[index - 1]
      assert.ok(previous.left + PHONE_GRID_METRICS.iconWidth <= position.left)
    }
  })

  const leftMargin = positions[0].left
  const rightMargin = 320 - positions.at(-1).left - PHONE_GRID_METRICS.iconWidth
  assert.equal(leftMargin, rightMargin)
})

test("a 314px bordered editor desktop keeps all four columns in bounds", () => {
  const positions = Array.from({ length: PHONE_GRID_METRICS.columns }, (_, column) => (
    getPhoneGridPosition(314, column, 0)
  ))

  assert.deepEqual(positions.map(position => position.left), [1, 81, 161, 241])
  assert.equal(positions.at(-1).left + PHONE_GRID_METRICS.iconWidth, 313)
})

test("legacy framed phone widths preserve their exact column positions", () => {
  const frame = ruleBodiesFor(cssWithoutComments, ".phone-frame")
  const preview = ruleBodiesFor(cssWithoutComments, ".phone-frame.custom-preview")
  const frameWidth = Number(frame.match(/width\s*:\s*(\d+)px/)[1])
  const previewWidth = Number(preview.match(/width\s*:\s*(\d+)px/)[1])
  const borderWidth = Number(frame.match(/border\s*:\s*(\d+)px/)[1])

  assert.equal(frameWidth, 360)
  assert.equal(frameWidth, previewWidth)

  for (const innerWidth of [previewWidth - borderWidth * 2, frameWidth - borderWidth * 2]) {
    const positions = Array.from({ length: PHONE_GRID_METRICS.columns }, (_, column) => (
      getPhoneGridPosition(innerWidth, column, 0).left
    ))
    assert.deepEqual(positions, [20, 100, 180, 260])
  }
})

test("intermediate phone widths remain centered before reaching the legacy cap", () => {
  for (const [innerWidth, expectedMargin] of [[330, 9], [340, 14]]) {
    const positions = Array.from({ length: PHONE_GRID_METRICS.columns }, (_, column) => (
      getPhoneGridPosition(innerWidth, column, 0)
    ))
    const leftMargin = positions[0].left
    const rightMargin = innerWidth - positions.at(-1).left - PHONE_GRID_METRICS.iconWidth

    assert.equal(leftMargin, expectedMargin)
    assert.equal(rightMargin, expectedMargin)
  }
})

test("row coordinates retain existing spacing without sharing mutable state", () => {
  const first = getPhoneGridPosition(320, 1, 0)
  const second = getPhoneGridPosition(320, 1, 1)

  first.left = -1

  assert.deepEqual(second, { left: 84, top: 131 })
  assert.equal(second.top - PHONE_GRID_METRICS.cellHeight, PHONE_GRID_METRICS.offsetY)
})

test("grid styles use container-relative lengths without CSS multiplication", () => {
  const container = phoneGridContainerStyle()
  const item = phoneGridItemStyle(3, 1)

  assert.match(container, /--phone-grid-origin-x\s*:\s*clamp\(0px,\s*max\(calc\(50% - 156px\),\s*calc\(100% - 330px\)\),\s*20px\)/)
  assert.match(item, /--phone-grid-x\s*:\s*240px/)
  assert.match(item, /--phone-grid-y\s*:\s*131px/)
  assert.doesNotMatch(item, /var\([^)]*\)\s*\*/)
})

test("both reader phone renderers are wired to the shared multi-screen home layout", () => {
  assert.ok(/from ['"]\.\/phone-home-layout\.js['"]/.test(readerSource))
  assert.equal((readerSource.match(/renderReaderPhoneHome\(/g) || []).length, 3)
  assert.match(readerSource, /normalizePhoneHomeLayout\(candidate, definitions\)/)
  assert.match(readerSource, /Number\(app\.desktopX\) \* 2/)
  assert.match(readerSource, /Number\(app\.desktopY\) \* 2/)
  assert.match(readerSource, /phoneHomeItemStyle\(item\)/)
  assert.doesNotMatch(readerSource, /var CELL_W = 80, CELL_H = 95, OFFSET_X = 20, OFFSET_Y = 36/)

  const items = ruleBodiesFor(cssWithoutComments, ".phone-home-item")
  assert.match(items, /left\s*:\s*var\(--phone-home-left\)/)
  assert.match(items, /top\s*:\s*var\(--phone-home-top\)/)
})

test("custom decoration uploads are wired to grid-size controls and contained artwork", () => {
  assert.match(readerSource, /data-cu-custom-widget-upload/)
  assert.match(readerSource, /data-cu-custom-widget-size/)
  assert.match(readerSource, /data-cu-custom-widget-remove/)
  assert.match(readerSource, /phoneCustomDecorationSizeForDimensions/)
  assert.match(readerSource, /renderPhoneCustomDecoration/)

  const customDecoration = ruleBodiesFor(cssWithoutComments, ".phone-custom-decoration img")
  assert.match(customDecoration, /object-fit\s*:\s*contain/)
  assert.match(customDecoration, /width\s*:\s*100%/)
  assert.match(customDecoration, /height\s*:\s*100%/)

  const uploadAction = ruleBodiesFor(cssWithoutComments, ".phone-custom-widget-upload-action")
  assert.match(uploadAction, /font\s*:\s*600\s+\.5rem\/1\s+var\(--font\)/)

  const undoAction = ruleBodiesFor(cssWithoutComments, ".appearance-workbench-undo")
  assert.match(undoAction, /min-height\s*:\s*30px/)
  assert.match(undoAction, /font\s*:\s*600\s+\.6rem\/1\s+var\(--font\)/)
})

test("multi-screen home uses the full lower screen and centers its fixed grid", () => {
  const viewport = ruleBodiesFor(cssWithoutComments, ".phone-home-viewport")
  const page = ruleBodiesFor(cssWithoutComments, ".phone-home-page")

  assert.equal(PHONE_HOME_COLUMNS, 8)
  assert.equal(PHONE_HOME_ROWS, 13)
  assert.match(viewport, /width\s*:\s*min\(320px,\s*100%\)/)
  assert.doesNotMatch(viewport, /calc\(100%\s*-\s*40px\)/)
  assert.match(viewport, /margin\s*:\s*0\s+auto/)
  assert.match(page, new RegExp(`height\\s*:\\s*${PHONE_HOME_ROWS * PHONE_HOME_CELL_HEIGHT}px`))
})

test("bounded mobile article overlays fill the viewport while preserving legacy grid positions", () => {
  const bounded = atRuleBody(
    /@media\s*\(max-width:\s*480px\)\s*,\s*\(max-height:\s*500px\)\s*and\s*\(pointer:\s*coarse\)/,
  )
  const overlay = ruleBodiesFor(bounded, ".rd-pm-modal")
  const boundedWrapper = ruleBodiesFor(bounded, ".rd-pm-phone-wrap")
  const frame = ruleBodiesFor(bounded, ".rd-pm-phone-wrap > .phone-frame")
  const baseWrapper = ruleBodiesFor(cssWithoutComments, ".rd-pm-phone-wrap")

  assert.match(overlay, /padding\s*:\s*var\(--reader-safe-top\)\s+var\(--reader-safe-right\)\s+var\(--reader-safe-bottom\)\s+var\(--reader-safe-left\)/)
  assert.match(baseWrapper, /width\s*:\s*360px/)
  assert.match(baseWrapper, /max-width\s*:\s*100%/)
  assert.match(boundedWrapper, /width\s*:\s*100%/)
  assert.match(boundedWrapper, /max-width\s*:\s*none/)
  assert.match(boundedWrapper, /height\s*:\s*100%/)
  assert.match(frame, /border\s*:\s*none/)
  assert.match(frame, /border-radius\s*:\s*0/)
  assert.match(frame, /box-shadow\s*:\s*none/)

  assert.equal(getPhoneGridPosition(360, 3, 0).left, 260)
  assert.equal(getPhoneGridPosition(390, 3, 0).left, 260)
})

test("grid coordinates preserve numeric strings and reject non-finite values", () => {
  assert.deepEqual(getPhoneGridPosition(320, "2", "1"), { left: 164, top: 131 })
  assert.deepEqual(getPhoneGridPosition(320, Number.NaN, Number.POSITIVE_INFINITY), { left: 4, top: 36 })
  assert.match(phoneGridItemStyle(Number.NaN, Number.NEGATIVE_INFINITY), /--phone-grid-x:0px;--phone-grid-y:36px;/)
})
