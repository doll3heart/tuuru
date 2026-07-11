import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

function blockFrom(source, marker) {
  const markerStart = source.indexOf(marker)
  assert.notEqual(markerStart, -1, `missing ${marker}`)
  const open = source.indexOf("{", markerStart)
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++
    if (source[index] !== "}") continue
    depth--
    if (depth === 0) return source.slice(open + 1, index)
  }
  assert.fail(`unterminated ${marker}`)
}

function ruleBodiesFor(source, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(source))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

const boundedPhone = blockFrom(
  css,
  "@media (max-width: 480px), (max-height: 500px) and (pointer: coarse)",
)

test("reader settings render named hooks for their compact controls", () => {
  assert.match(readerSource, /class=["']rs-upload-font-btn["'][^>]*id=["']rsUploadFont["']/)
  assert.match(readerSource, /class=["']rs-delete-font-btn["'][^>]*data-rs-del-font=/)
  assert.match(readerSource, /class=["']rs-close-btn["'][^>]*aria-label=["']关闭排版设置["'][^>]*id=["']rsClose["']/)
})

test("bounded reader settings expose 44px touch targets", () => {
  for (const selector of [
    ".rs-font-btn",
    ".rs-theme-btn",
    ".rs-reset-btn",
    ".rs-upload-font-btn",
    ".rs-delete-font-btn",
    ".rd-checkbox",
    ".rs-range",
  ]) {
    assert.match(ruleBodiesFor(boundedPhone, selector), /min-height\s*:\s*44px/, selector)
  }

  const close = ruleBodiesFor(boundedPhone, ".rs-close-btn")
  assert.match(close, /width\s*:\s*44px/)
  assert.match(close, /height\s*:\s*44px/)
  assert.match(close, /display\s*:\s*flex/)

  assert.match(ruleBodiesFor(boundedPhone, ".rs-delete-font-btn"), /min-width\s*:\s*44px/)
})
