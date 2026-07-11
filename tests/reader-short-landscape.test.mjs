import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function sourceBetween(startMarker, endMarker) {
  const start = readerSource.indexOf(startMarker)
  const end = readerSource.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return readerSource.slice(start, end)
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

test("the runtime phone exposes reusable chrome classes", () => {
  const builder = sourceBetween("function buildPhoneHTML", "// ====== PHONE READER")

  for (const className of ["phone-island", "phone-profile", "phone-home-bar"]) {
    assert.match(builder, new RegExp(`class=["']${className}["']`), className)
  }
  assert.doesNotMatch(
    builder,
    /class=["'](?:phone-island|phone-profile|phone-home-bar)["'][^>]*display\s*:/,
  )
})

test("short coarse-pointer readers reserve their height for Apps", () => {
  const short = atRuleBody(
    /@media\s*\(max-height:\s*500px\)\s*and\s*\(pointer:\s*coarse\)/,
  )

  for (const host of [".phone-reader", ".rd-pm-phone-wrap"]) {
    for (const chrome of [".phone-island", ".phone-profile", ".phone-home-bar"]) {
      const selector = `${host} > .phone-frame > ${chrome}`
      assert.match(ruleBodiesFor(short, selector), /display\s*:\s*none/, selector)
    }
  }
})
