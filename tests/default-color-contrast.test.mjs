import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function rootHexTokens(css) {
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] || ""
  return new Map(
    [...root.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})/gi)]
      .map(match => [match[1], match[2]]),
  )
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const linear = channels.map(channel => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (light + 0.05) / (dark + 0.05)
}

test("default secondary and accent text meet AA across light surfaces", () => {
  for (const [name, css] of [["editor", editorCss], ["reader", readerCss]]) {
    const tokens = rootHexTokens(css)
    const foregrounds = [tokens.get("--c-text2"), tokens.get("--c-primary-hover")]
    const backgrounds = [
      tokens.get("--c-surface"),
      tokens.get("--c-surface2"),
      tokens.get("--c-bg"),
    ]

    for (const foreground of foregrounds) {
      assert.ok(foreground, `${name} foreground token exists`)
      for (const background of backgrounds) {
        assert.ok(background, `${name} background token exists`)
        assert.ok(
          contrastRatio(foreground, background) >= 4.5,
          `${name} ${foreground} on ${background} meets 4.5:1`,
        )
      }
    }

    assert.ok(
      contrastRatio("#ffffff", tokens.get("--c-primary-hover")) >= 4.5,
      `${name} white text remains readable on the accent interaction background`,
    )
  }
})

test("editor placeholders reuse the accessible secondary text token", () => {
  assert.doesNotMatch(editorCss, /#c0c8d8/i)

  const placeholderRules = [
    ".editor-main .content-area::placeholder",
    ".editor-content .content-area::placeholder",
    ".editor-content .content-editable:empty::before",
    ".browser-url::placeholder",
  ]

  for (const selector of placeholderRules) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const rule = editorCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ""
    assert.match(rule, /color\s*:\s*var\(--c-text2\)/, selector)
  }
})
