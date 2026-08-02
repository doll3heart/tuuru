import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  PHONE_CUSTOM_DECORATION_MAX_ITEMS,
  PHONE_CUSTOM_DECORATION_SIZES,
  PHONE_DESKTOP_WIDGET_KINDS,
  PHONE_DESKTOP_WIDGET_PRODUCTS,
  defaultPhoneDesktopWidgets,
  normalizePhoneDesktopWidgets,
  phoneCustomDecorationSizeForDimensions,
  resolvePhoneDesktopWidgets,
  renderPhoneCustomDecoration,
  renderPhoneDesktopWidgets,
} from "../reader/phone-desktop-widgets.js"

test("V7 structural text wrappers keep their product positioning rules", async () => {
  const css = await readFile(new URL("../reader/reader.css", import.meta.url), "utf8")
  assert.doesNotMatch(css, /\.v7-widget\s+span[^{}]*\{[^}]*position\s*:\s*relative/i)
  for (const selector of ["v7-player-shell", "v7-date-card", "v7-countdown-copy", "v7-schedule-copy"]) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*position\\s*:\\s*absolute`, "i"))
  }
})

test("V7 store catalog exposes 26 unique products across the three approved categories", () => {
  assert.equal(PHONE_DESKTOP_WIDGET_PRODUCTS.length, 26)
  assert.equal(new Set(PHONE_DESKTOP_WIDGET_PRODUCTS.map(item => item.id)).size, 26)
  assert.deepEqual(
    Object.fromEntries(["function", "photo", "decor"].map(category => [
      category,
      PHONE_DESKTOP_WIDGET_PRODUCTS.filter(item => item.category === category).length,
    ])),
    { function:9, photo:9, decor:8 },
  )
  assert.equal(PHONE_DESKTOP_WIDGET_PRODUCTS.reduce((sum, item) => sum + item.photoSlots, 0), 17)
  assert.ok(PHONE_DESKTOP_WIDGET_KINDS.some(item => item.id === "resume"))
})

test("a fresh desktop is empty and every persisted item is keyed by product", () => {
  const config = defaultPhoneDesktopWidgets()
  assert.equal(config.items.length, 26)
  assert.equal(config.items.some(item => item.enabled), false)
  assert.deepEqual(config.items[0], {
    productId:"v7-resume-dessert",
    kind:"resume",
    enabled:false,
    size:"wide",
    photos:[],
  })
  assert.deepEqual(config.fields, {})
  assert.deepEqual(config.customDecorations, [])

  config.enabled = false
  config.items.find(item => item.productId === "v7-resume-dessert").enabled = true
  assert.deepEqual(resolvePhoneDesktopWidgets(config, {}, { progressLabel:"继续阅读" }).map(item => item.productId), ["v7-resume-dessert"])
})

test("widget settings normalize product order, photo slots, unsafe values and legacy kinds", () => {
  const normalized = normalizePhoneDesktopWidgets({
    enabled:true,
    accent:"#123456",
    surface:"javascript:bad",
    text:"#111111",
    note:"x".repeat(900),
    fields:{
      "v7-countdown-cherry":{ title:"  去看海  ", detail:"傍晚", targetDate:"2026-08-05T18:30" },
      "v7-player-bunny":{ title:"<b>我的歌</b>", detail:"x".repeat(300), unexpected:"drop" },
      "v7-photo-heart":{ title:"照片不收文字" },
      unknown:{ title:"drop" },
    },
    items:[
      { productId:"v7-photo-double", enabled:true, size:"half", photos:["https://img.test/a.png", "javascript:bad", "https://img.test/extra.png"] },
      { productId:"v7-photo-double", enabled:false },
      { productId:"unknown", enabled:true },
      { kind:"resume", enabled:true, skin:"film", size:"half" },
    ],
  })

  assert.equal(normalized.enabled, true)
  assert.equal(normalized.accent, "#123456")
  assert.equal(normalized.surface, "#fffaf9")
  assert.equal(normalized.note.length, 280)
  assert.deepEqual(normalized.fields["v7-countdown-cherry"], {
    title:"去看海", detail:"傍晚", targetDate:"2026-08-05T18:30",
  })
  assert.equal(normalized.fields["v7-player-bunny"].title, "<b>我的歌</b>")
  assert.equal(normalized.fields["v7-player-bunny"].detail.length, 120)
  assert.equal(Object.hasOwn(normalized.fields, "v7-photo-heart"), false)
  assert.equal(Object.hasOwn(normalized.fields, "unknown"), false)
  assert.equal(normalized.items.length, 26)
  assert.equal(normalized.items[0].productId, "v7-photo-double")
  assert.deepEqual(normalized.items[0].photos, ["https://img.test/a.png", null])
  assert.equal(normalized.items.filter(item => item.productId === "v7-photo-double").length, 1)
  assert.equal(normalized.items.find(item => item.productId === "v7-resume-dessert").enabled, true)
  assert.equal(normalized.items.find(item => item.productId === "v7-resume-dessert").size, "wide")
})

test("custom decorations normalize embedded raster images and match grid footprints", () => {
  const image = "data:image/png;base64,YQ=="
  assert.equal(PHONE_CUSTOM_DECORATION_MAX_ITEMS, 8)
  assert.deepEqual(PHONE_CUSTOM_DECORATION_SIZES.map(size => [size.id, size.width, size.height]), [
    ["small", 2, 2], ["half", 4, 3], ["wide", 8, 3],
  ])
  assert.equal(phoneCustomDecorationSizeForDimensions(600, 800), "small")
  assert.equal(phoneCustomDecorationSizeForDimensions(1200, 900), "half")
  assert.equal(phoneCustomDecorationSizeForDimensions(1600, 600), "wide")
  assert.equal(phoneCustomDecorationSizeForDimensions(0, 0), "half")

  const normalized = normalizePhoneDesktopWidgets({
    customDecorations:[
      { id:"custom-square01", name:"  我的透明贴纸  ", image, size:"small" },
      { id:"custom-square01", name:"重复", image, size:"wide" },
      { id:"custom-remote01", name:"远程追踪图", image:"https://img.test/tracker.png", size:"half" },
      { id:"unsafe", name:"错误 ID", image, size:"half" },
    ],
  })

  assert.deepEqual(normalized.customDecorations, [
    { id:"custom-square01", name:"我的透明贴纸", image, size:"small" },
  ])
  const html = renderPhoneCustomDecoration(normalized, "custom-square01")
  assert.match(html, /class="phone-story-widget phone-custom-decoration is-small"/)
  assert.match(html, /data-custom-decoration="custom-square01"/)
  assert.match(html, /<img[^>]+src="data:image\/png;base64,YQ=="/)
  assert.match(html, /aria-label="我的透明贴纸"/)
  assert.doesNotMatch(html, /<button/)
})

test("personal V7 copy stays reader-owned while date widgets use local system time", () => {
  const config = defaultPhoneDesktopWidgets()
  config.items.forEach(item => { item.enabled = true })
  config.fields = {
    "v7-player-bunny":{ title:"我的播放列表", detail:"雨天循环" },
    "v7-voice-medallion":{ title:"给自己的留言", detail:"00:07" },
    "v7-countdown-cherry":{ title:"去看海", detail:"傍晚出发", targetDate:"2026-08-05T18:30" },
    "v7-schedule-ribbon":{ title:"整理书架", detail:"书房" },
    "v7-quote-blue":{ title:"慢慢读，也很好。", detail:"本机摘句" },
  }
  config.items.find(item => item.productId === "v7-photo-heart").photos[0] = "https://img.test/chosen.png"
  const phoneData = {
    contacts:[{ id:"contact-1", name:"林晚", avatarUrl:"https://img.test/lin.png" }],
    chats:[{ id:"chat-1", contactId:"contact-1", rounds:[{ messages:[
      { id:"message-1", type:"voice", duration:7, text:"一段语音", senderId:"contact-1" },
      { id:"message-2", type:"schedule", scheduleTitle:"车站接应", scheduleTime:"22:30", scheduleLocation:"北站" },
    ] }] }],
    photos:[{ id:"story-photo", caption:"不应自动出现", imageUrl:"https://img.test/story.png" }],
  }
  const resolved = resolvePhoneDesktopWidgets(config, phoneData, {
    workTitle:"雾港来信",
    progressLabel:"第三章 · 候车厅",
    progressPercent:42,
    systemNow:new Date(2026, 7, 2, 9, 5),
  })

  assert.equal(resolved.length, 26)
  assert.equal(new Set(resolved.map(item => item.productId)).size, 26)
  assert.equal(resolved.find(item => item.productId === "v7-resume-dessert").title, "雾港来信")
  assert.equal(resolved.find(item => item.productId === "v7-player-bunny").title, "我的播放列表")
  assert.equal(resolved.find(item => item.productId === "v7-voice-medallion").title, "给自己的留言")
  assert.equal(resolved.find(item => item.productId === "v7-schedule-ribbon").title, "整理书架")
  assert.equal(resolved.find(item => item.productId === "v7-date-picture").meta, "AUGUST")
  assert.equal(resolved.find(item => item.productId === "v7-date-picture").systemDay, "02")
  assert.equal(resolved.find(item => item.productId === "v7-clock-dessert").title, "09:05")
  assert.equal(resolved.find(item => item.productId === "v7-countdown-cherry").countdownDays, "3")
  assert.equal(JSON.stringify(resolved).includes("林晚"), false)
  assert.equal(JSON.stringify(resolved).includes("车站接应"), false)
  assert.deepEqual(resolved.find(item => item.productId === "v7-photo-heart").photos, ["https://img.test/chosen.png"])
  assert.equal(JSON.stringify(resolved.filter(item => item.category === "photo")).includes("story.png"), false)
})

test("V7 markup shares product compositions, keeps photo slots empty, and makes decor non-interactive", () => {
  const config = defaultPhoneDesktopWidgets()
  for (const productId of ["v7-resume-dessert", "v7-photo-polaroid", "v7-decor-spoons"]) {
    config.items.find(item => item.productId === productId).enabled = true
  }
  const html = renderPhoneDesktopWidgets(config, {}, { progressLabel:"继续阅读" })

  assert.match(html, /class="phone-story-widgets is-v7"/)
  assert.match(html, /data-widget-product="v7-resume-dessert"/)
  assert.match(html, /data-widget-category="photo"/)
  assert.match(html, /data-widget-product="v7-decor-spoons"/)
  assert.match(html, /class="v7-photo-slot is-empty"/)
  assert.match(html, /<button[^>]+data-widget-product="v7-resume-dessert"/)
  assert.doesNotMatch(html, /<button[^>]+data-widget-product="v7-decor-spoons"/)
  assert.equal((html.match(/v7-polaroid-card/g) || []).length, 2)
  assert.doesNotMatch(html, /story\.png/)
})

test("unfilled personal widgets render blank copy instead of fictional characters or dates", () => {
  const config = defaultPhoneDesktopWidgets()
  for (const id of ["v7-voice-medallion", "v7-countdown-cherry", "v7-date-picture", "v7-clock-dessert", "v7-schedule-ribbon", "v7-quote-blue"]) {
    config.items.find(item => item.productId === id).enabled = true
  }
  const html = renderPhoneDesktopWidgets(config, {
    contacts:[{ id:"contact-1", name:"林晚" }],
    chats:[{ rounds:[{ messages:[{ type:"schedule", scheduleTitle:"旧站台见" }] }] }],
  }, { systemNow:new Date(2026, 7, 2, 9, 5) })

  assert.doesNotMatch(html, /林晚|旧站台|天后见面|20:07|>01<|>03</)
  assert.match(html, /data-v7-system-time[^>]*>09:05</)
  assert.match(html, /data-v7-system-day[^>]*>02</)
  assert.match(html, /data-v7-countdown-days[^>]*><\/strong>/)
})

test("user-provided widget text and photo URLs stay escaped and safe", () => {
  const config = defaultPhoneDesktopWidgets()
  const item = config.items.find(entry => entry.productId === "v7-photo-wing")
  item.enabled = true
  item.photos[0] = "https://img.test/a.png?slot=1&tone=pink"
  config.fields = { "v7-quote-blue":{ title:"<img src=x onerror=alert(1)>", detail:"我的摘句" } }
  config.items.find(entry => entry.productId === "v7-quote-blue").enabled = true
  const html = renderPhoneDesktopWidgets(config, {}, {})

  assert.doesNotMatch(html, /<img[^>]+onerror=/)
  assert.match(html, /&lt;img src=x/)
  assert.match(html, /a\.png\?slot=1&amp;tone=pink/)
})
