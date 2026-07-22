import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const home = readFileSync(new URL("../js/pages/home.js", import.meta.url), "utf8")
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ""
}

test("the author shell uses one tactile gray-pink component language", () => {
  assert.match(rule(".app-header"), /box-shadow\s*:/)
  assert.match(rule(".btn"), /border-radius\s*:\s*3px/)
  assert.match(rule(".btn"), /box-shadow\s*:/)
  assert.match(rule(".editor-iconbar"), /box-shadow\s*:/)
  assert.match(rule(".editor-area"), /background-image\s*:/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})

test("the empty library renders the designed empty-state ornament", () => {
  assert.match(home, /class="empty-icon"/)
  assert.doesNotMatch(home, /class="icon"><\/div><h3>还没有作品/)
  assert.match(rule(".empty-state"), /border\s*:/)
  assert.match(rule(".empty-state"), /background\s*:/)
})

test("the library heading keeps compact backup actions beside its title", () => {
  assert.match(home, /class="library-heading mb-4"/)
  assert.match(home, /class="library-heading-actions"/)
  assert.match(home, /class="library-action-label library-action-label-short"/)
  assert.doesNotMatch(home, /class="library-heading-actions"[\s\S]*navigate\('\/new'\)/)
  assert.match(home, /点击右上角「新建」开始创作/)

  assert.match(rule(".library-heading"), /display\s*:\s*flex/)
  assert.match(rule(".library-heading-actions"), /display\s*:\s*flex/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.library-heading\s*\{[^}]*flex-direction\s*:\s*row/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.library-heading-actions\s+\.btn\s*\{[^}]*min-height\s*:\s*44px/)
})

test("the author shell exposes an accessible product mode switch", () => {
  assert.match(app, /class="app-mode-switch"/)
  assert.match(app, /aria-label="应用模式"/)
  assert.match(app, /aria-current="page"[^>]*>创作端</)
  assert.match(app, />读者端</)
  assert.match(rule(".app-mode-link"), /min-height\s*:\s*44px/)
  assert.match(css, /\.app-mode-link:focus-visible[^}]*outline\s*:/s)
  assert.match(app, /app-resources-link/)
  assert.match(app, /aria-label="写作习惯与使用教程"/)
  assert.match(rule(".app-resources-link"), /min-height\s*:\s*44px/)
  assert.match(css, /\.app-resources-link:focus-visible[^}]*outline\s*:/s)
})

test("the article editor route can collapse secondary global navigation on phones", () => {
  assert.match(app, /path\.startsWith\("\/edit\/"\)/)
  assert.match(app, /app-header-editor/)
  assert.match(css, /\.app-header-editor\s+\.logo/)
  assert.match(css, /\.app-header-editor\s+\.theme-wrap/)
  assert.match(css, /\.app-header-editor\s+\.app-header-actions\s*>\s*nav:not\(\.app-mode-switch\)/)
})

test("the shared header compacts before a 500px viewport can overflow", () => {
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.app-header \.logo span\{display:none\}/)
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.app-header nav a\{white-space:nowrap\}/)
})
