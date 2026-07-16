import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const phone = fs.readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))]
    .map(match => match[1])
    .join(";")
}

test("phone UI defines a shared quiet system palette and geometry", () => {
  const wrap = rule(".phone-editor-wrap,.phone-frame,.phone-app-modal-inner")
  for (const token of [
    "--phone-system-surface",
    "--phone-system-border",
    "--phone-system-text",
    "--phone-system-muted",
    "--phone-system-accent",
    "--phone-system-radius-panel",
    "--phone-system-shadow"
  ]) assert.match(wrap, new RegExp(`${token}\\s*:`))
})

test("phone chrome uses a single divider and touch-sized navigation controls", () => {
  assert.match(rule(".cu-header"), /min-height\s*:\s*52px/)
  assert.match(rule(".cu-header"), /border-bottom\s*:\s*1px\s+solid/)
  assert.doesNotMatch(rule(".cu-header"), /double/)
  assert.match(rule(".cu-close-btn"), /width\s*:\s*44px/)
  assert.match(rule(".cu-close-btn"), /height\s*:\s*44px/)
})

test("representative apps share the same card surface language", () => {
  const surfaces = rule(".chat-round-card,.forum-list-card,.gallery-photo-card")
  assert.match(surfaces, /background\s*:\s*var\(--phone-system-surface\)/)
  assert.match(surfaces, /border\s*:\s*1px\s+solid\s+var\(--phone-system-border\)/)
  assert.match(surfaces, /border-radius\s*:\s*var\(--phone-system-radius-control\)/)
})

test("memo cards do not render a decorative thick side stripe", () => {
  assert.doesNotMatch(phone, /border-left\s*:\s*3px/)
})
