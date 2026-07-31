import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const phoneChatCss = fs.readFileSync(new URL("../css/phone-chat.css", import.meta.url), "utf8")
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

test("conversation action control stays visually tiny without losing its touch target", () => {
  const action = rule(".message-chat-action-button")
  const hitArea = rule(".message-chat-action-button::before")
  const icon = rule(".message-chat-action-button span")
  assert.match(action, /width\s*:\s*22px/)
  assert.match(action, /height\s*:\s*22px/)
  assert.match(hitArea, /inset\s*:\s*-11px/)
  assert.match(phone, /<span aria-hidden="true">⋯<\/span>/)
  assert.doesNotMatch(phone, /•••/)
  assert.match(icon, /letter-spacing\s*:\s*0/)
})

test("voice playback has shared progress, focus, touch, and reduced-motion states", () => {
  assert.match(phoneChatCss, /\.rd-voice-playback\s*\{[^}]*display\s*:\s*flex/s)
  assert.match(phoneChatCss, /\.rd-voice-bar\.is-active\s*\{/)
  assert.match(phoneChatCss, /\.rd-voice-playback:focus-visible/)
  assert.match(phoneChatCss, /@media\s*\(pointer:\s*coarse\)[\s\S]*?\.rd-voice-playback\s*\{[^}]*min-height\s*:\s*44px/)
  assert.match(phoneChatCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rd-voice-bar\s*\{[^}]*transition\s*:\s*none/)
})

test("story events and rich cards share centered, touchable, reduced-motion phone states", () => {
  assert.match(phoneChatCss, /\.rd-chat-story-event\s*\{[^}]*justify-content\s*:\s*center/s)
  assert.match(phoneChatCss, /\.chat-story-card\s*\{[^}]*width\s*:\s*174px/s)
  assert.match(phoneChatCss, /\.rd-chat-story-pip\s*\{[^}]*position\s*:\s*absolute/s)
  assert.match(phoneChatCss, /\.chat-story-card:focus-visible/)
  assert.doesNotMatch(phoneChatCss, /\.rd-chat-story-event[^,{]*\{[^}]*border-(?:left|right)\s*:\s*(?:[2-9]|[1-9]\d)px/s)
  assert.match(phoneChatCss, /@media\s*\(pointer:\s*coarse\)[\s\S]*?\.rd-story-event-action[\s\S]*?min-height\s*:\s*44px/)
  assert.match(phoneChatCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rd-chat-typing-dots i\s*\{[^}]*animation\s*:\s*none/)
})

test("cross-App actions and quotes keep compact focus and reduced-motion feedback", () => {
  assert.match(phoneChatCss, /\.chat-quote-preview\s*\{[^}]*border-bottom\s*:\s*1px/s)
  assert.match(phoneChatCss, /\.chat-action-state\s*\{[^}]*font-size\s*:\s*7px/s)
  assert.match(phoneChatCss, /\.rd-chat-deep-link\s*\{[^}]*width\s*:\s*174px/s)
  assert.match(phoneChatCss, /\.chat-msg\.is-return-target/)
  assert.match(phoneChatCss, /\.chat-msg\.is-quote-target/)
  assert.match(phoneChatCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.chat-msg\.is-return-target[\s\S]*?transition\s*:\s*none/)
})
