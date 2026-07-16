import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const editorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

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

function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ""
}

function hexTokenAnywhere(css, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*:\\s*(#[0-9a-f]{6})`, "i"))?.[1]
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

    assert.ok(tokens.get("--c-btn-hover-text"), `${name} hover ink token exists`)
    assert.ok(
      contrastRatio(tokens.get("--c-btn-hover-text"), tokens.get("--c-primary-hover")) >= 4.5,
      `${name} hover ink remains readable on the accent interaction background`,
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
    const rule = ruleBody(editorCss, selector)
    assert.match(rule, /color\s*:\s*var\(--c-text2\)/, selector)
  }
})

test("light primary and hover fills use their readable ink tokens", () => {
  for (const [name, css] of [["editor", editorCss], ["reader", readerCss]]) {
    const tokens = rootHexTokens(css)
    assert.ok(tokens.get("--c-btn-text"), `${name} primary ink token exists`)
    assert.ok(
      contrastRatio(tokens.get("--c-btn-text"), tokens.get("--c-primary")) >= 4.5,
      `${name} primary ink meets 4.5:1 on the light primary fill`,
    )
  }

  const lightPrimarySelectors = new Map([
    [editorCss, [
      ".btn-primary",
      ".editor-sidebar-item.active",
      ".toast.info",
      ".scene-tag.active",
      ".choice-btn:hover",
      ".cu-tab.active",
      ".ct-add-btn",
      ".memo-toolbar button.active",
      ".memo-editor .check-dot.checked",
      ".shop-checkout",
    ]],
    [readerCss, [
      ".rd-preset-save:hover",
      ".drop-btn",
      ".rd-landing-preset-btn:hover",
      ".rd-landing-start-btn",
      ".rs-font-btn.active",
      ".rd-custom-upload-btn:hover",
      ".cu-btn-save",
    ]],
  ])

  for (const [css, selectors] of lightPrimarySelectors) {
    for (const selector of selectors) {
      assert.match(ruleBody(css, selector), /color\s*:\s*var\(--c-btn-text\)/, selector)
    }
  }

  const darkHoverSelectors = new Map([
    [editorCss, [
      ".btn-primary:hover",
      ".toast.success",
      ".ct-avatar-badge",
      ".ct-add-btn:hover",
      ".shop-checkout:hover",
    ]],
    [readerCss, [".drop-btn:hover", ".rd-landing-start-btn:hover", ".cu-btn-save:hover"]],
  ])

  for (const [css, selectors] of darkHoverSelectors) {
    for (const selector of selectors) {
      const rule = ruleBody(css, selector)
      assert.match(rule, /background\s*:\s*var\(--c-primary-hover\)/, selector)
      assert.match(rule, /color\s*:\s*var\(--c-btn-hover-text\)/, selector)
    }
  }

  assert.match(ruleBody(editorCss, ".shop-circle.checked::after"), /border\s*:\s*2px\s+solid\s+var\(--c-btn-text\)/)
  assert.doesNotMatch(readerSource, /background\s*:\s*#a4c6eb\s*;\s*color\s*:\s*#fff/i)
  assert.match(readerSource, /background:var\(--c-primary\);color:var\(--c-btn-text\)[^"']*" id="cuSave"/)
  assert.match(readerSource, /background:var\(--c-primary\);color:var\(--c-btn-text\)[^"']*" id="rpSave"/)
})

test("every generated theme chooses readable primary and hover ink", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tuuru.local/" })
  const previous = new Map()
  for (const key of ["window", "document", "localStorage"]) {
    previous.set(key, globalThis[key])
  }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage

  try {
    const { THEME_PRESETS, generateVars } = await import("../js/app.js?contrast-test")
    const generatedThemes = THEME_PRESETS.filter(preset => preset.bg)
    assert.ok(generatedThemes.length > 0)

    for (const preset of generatedThemes) {
      const vars = generateVars(preset)
      assert.ok(
        contrastRatio(vars["--c-btn-text"], vars["--c-primary"]) >= 4.5,
        `${preset.id} primary ink meets 4.5:1`,
      )
      assert.ok(
        contrastRatio(vars["--c-btn-hover-text"], vars["--c-primary-hover"]) >= 4.5,
        `${preset.id} hover ink meets 4.5:1`,
      )
    }
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
    dom.window.close()
  }
})

test("reader call presets and transcript paper preserve AA contrast", () => {
  const ink = hexTokenAnywhere(readerCss, "--rd-call-ink")
  const oldInk = hexTokenAnywhere(readerCss, "--rd-call-old-ink")
  const paper = hexTokenAnywhere(readerCss, "--rd-call-paper")
  const surfaces = [
    "--rd-call-plain-start", "--rd-call-plain-end",
    "--rd-call-rose-start", "--rd-call-rose-end",
    "--rd-call-water-start", "--rd-call-water-end",
    "--rd-call-cream-start", "--rd-call-cream-end",
  ].map(name => [name, hexTokenAnywhere(readerCss, name)])

  assert.ok(ink && oldInk && paper)
  for (const [name, surface] of surfaces) {
    assert.ok(surface, `${name} exists`)
    assert.ok(contrastRatio(ink, surface) >= 4.5, `${name} keeps call ink readable`)
  }
  assert.ok(contrastRatio(ink, paper) >= 4.5)
  assert.ok(contrastRatio(oldInk, paper) >= 4.5)
  assert.match(ruleBody(readerCss, ".rd-call-scene"), /rgba\(0,\s*0,\s*0,\s*\.58\)/)
  for (const selector of [".rd-call-duration", ".rd-call-note", ".rd-call-line.old"]) {
    assert.doesNotMatch(ruleBody(readerCss, selector), /opacity\s*:\s*(?:0?\.)\d+/)
  }
})
