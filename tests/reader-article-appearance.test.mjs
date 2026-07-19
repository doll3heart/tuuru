import test from "node:test"
import assert from "node:assert/strict"

import {
  READER_APPEARANCE_DEFAULTS,
  normalizeReaderAppearance,
  resolveReaderAppearanceTheme,
} from "../reader/article-appearance.js"

test("reader article appearance starts from complete detached defaults", () => {
  const first = normalizeReaderAppearance()
  const second = normalizeReaderAppearance(null)

  assert.deepEqual(first, READER_APPEARANCE_DEFAULTS)
  assert.deepEqual(second, READER_APPEARANCE_DEFAULTS)
  assert.notEqual(first, second)
  assert.notEqual(first.customFonts, second.customFonts)
})

test("reader article appearance clamps numbers and rejects invalid enums", () => {
  const normalized = normalizeReaderAppearance({
    fontSize: 999,
    lineHeight: Number.POSITIVE_INFINITY,
    letterSpacing: -12,
    paragraphSpacing: 999,
    marginSize: -10,
    contentWidth: 120,
    backgroundOverlay: 120,
    typingSpeed: 2,
    theme: "author-theme",
    textAlign: "diagonal",
    backgroundFit: "stretch",
  })

  assert.equal(normalized.fontSize, 36)
  assert.equal(normalized.lineHeight, READER_APPEARANCE_DEFAULTS.lineHeight)
  assert.equal(normalized.letterSpacing, -1)
  assert.equal(normalized.paragraphSpacing, 48)
  assert.equal(normalized.marginSize, 0)
  assert.equal(normalized.contentWidth, 420)
  assert.equal(normalized.backgroundOverlay, 90)
  assert.equal(normalized.typingSpeed, 10)
  assert.equal(normalized.theme, "light")
  assert.equal(normalized.textAlign, "left")
  assert.equal(normalized.backgroundFit, "cover")
})

test("reader article appearance keeps safe custom surfaces and rejects unsafe images", () => {
  const safe = normalizeReaderAppearance({
    theme: "custom",
    backgroundColor: "#123456",
    textColor: "#fefefe",
    backgroundImage: "/reader/backgrounds/night.png",
    backgroundFit: "contain",
    textAlign: "justify",
    indentFirstLine: true,
  })
  const unsafe = normalizeReaderAppearance({
    theme: "custom",
    backgroundColor: "not-a-color",
    textColor: "url(javascript:alert(1))",
    backgroundImage: "javascript:alert(1)",
  })

  assert.equal(safe.backgroundImage, "/reader/backgrounds/night.png")
  assert.equal(safe.backgroundFit, "contain")
  assert.equal(safe.textAlign, "justify")
  assert.equal(safe.indentFirstLine, true)
  assert.deepEqual(resolveReaderAppearanceTheme(safe), {
    backgroundColor: "#123456",
    textColor: "#fefefe",
  })
  assert.equal(unsafe.backgroundImage, null)
  assert.equal(unsafe.backgroundColor, READER_APPEARANCE_DEFAULTS.backgroundColor)
  assert.equal(unsafe.textColor, READER_APPEARANCE_DEFAULTS.textColor)
})

test("reader article appearance detaches valid custom fonts and ignores hostile entries", () => {
  const source = [{ name: "Local Serif", data: "data:font/woff;base64,AA==" }]
  const normalized = normalizeReaderAppearance({
    customFonts: [
      ...source,
      null,
      { name: "bad};font-family:x", data: "data:font/woff;base64,AA==" },
      { name: "Missing data" },
    ],
  })

  assert.deepEqual(normalized.customFonts, source)
  assert.notEqual(normalized.customFonts, source)
  assert.notEqual(normalized.customFonts[0], source[0])
  source[0].name = "Changed"
  assert.equal(normalized.customFonts[0].name, "Local Serif")
})
