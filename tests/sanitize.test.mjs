import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import {
  escapeHtmlAttribute,
  isSafeImageUrl,
  sanitizeIconHtml,
  sanitizeImportedWork,
  sanitizeRichHtml,
} from "../js/sanitize.js"

const windowObject = new JSDOM("<!doctype html><html><body></body></html>").window

test("attribute escaping prevents quote breakout payloads", () => {
  const payload = '" autofocus onfocus="alert(1)\' & <tag>'
  const escaped = escapeHtmlAttribute(payload)

  assert.equal(escaped, '&quot; autofocus onfocus=&quot;alert(1)&#39; &amp; &lt;tag&gt;')
})

test("article HTML removes executable markup and unsafe styles", () => {
  const dirty = '<script>alert(1)</script><svg onload="alert(1)"></svg>' +
    '<img src="x" onerror="alert(1)"><b onclick="alert(1)">safe</b>' +
    '<div style="text-align:center;position:fixed;background:url(javascript:alert(1))">center</div>'
  const clean = sanitizeRichHtml(dirty, { windowObject })

  assert.doesNotMatch(clean, /script|svg|onerror|onclick|position|background/i)
  assert.match(clean, /<img src="x">/)
  assert.match(clean, /<b>safe<\/b>/)
  assert.match(clean, /style="text-align: center;"/)
})

test("unsafe image schemes are rejected while supported images remain", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false)
  assert.equal(isSafeImageUrl('image.png" onerror="alert(1)'), false)
  assert.equal(isSafeImageUrl("image.png);position:fixed"), false)
  assert.equal(isSafeImageUrl("data:image/svg+xml,<svg></svg>"), false)
  assert.equal(isSafeImageUrl("https://example.com/image.png"), true)
  assert.equal(isSafeImageUrl("/images/local.png"), true)
  assert.equal(isSafeImageUrl("data:image/png;base64,aGVsbG8="), true)

  const clean = sanitizeRichHtml(
    '<img src="javascript:alert(1)"><img src="data:image/svg+xml,<svg></svg>"><img src="https://example.com/a.png">',
    { windowObject },
  )
  assert.doesNotMatch(clean, /javascript|svg\+xml/i)
  assert.match(clean, /https:\/\/example\.com\/a\.png/)
})

test("valid phone module metadata survives but forged modules are neutralized", () => {
  const valid = sanitizeRichHtml(
    '<div class="pm-inline-card" data-pm-id="abc-123" data-pm-type="memo"><span class="pm-card-label">Memo</span></div>',
    { windowObject },
  )
  assert.match(valid, /class="pm-inline-card"/)
  assert.match(valid, /data-pm-id="abc-123"/)

  const forged = sanitizeRichHtml(
    '<div class="pm-inline-card evil" data-pm-id="x" data-pm-type="evil" onclick="alert(1)">bad</div>',
    { windowObject },
  )
  assert.doesNotMatch(forged, /pm-inline-card|data-pm|onclick|class=/)
})

test("memo profile preserves only the known checklist structure", () => {
  const clean = sanitizeRichHtml(
    '<div class="check-line checked unknown"><span class="check-dot"></span>Task</div><div class="evil">x</div>',
    { profile: "memo", windowObject },
  )

  assert.match(clean, /class="check-line checked"/)
  assert.match(clean, /class="check-dot"/)
  assert.doesNotMatch(clean, /unknown|evil/)
})

test("SVG icons keep safe shapes and remove scriptable content", () => {
  const clean = sanitizeIconHtml(
    '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0h1v1z"></path><script>alert(1)</script></svg>',
    windowObject,
  )

  assert.match(clean, /<svg/)
  assert.match(clean, /<path/)
  assert.doesNotMatch(clean, /onload|script|alert/i)
})

test("import sanitation is immutable and covers articles, memos, icons, and media", () => {
  const work = {
    type: "article",
    nodes: [{ id: "start", content: '<b>ok</b><img src="x" onerror="alert(1)">' }],
    phoneModules: [{ data: { memos: [{ content: '<svg onload="alert(1)"></svg><u>memo</u>' }] } }],
    phoneData: {
      wallpaperImage: "javascript:alert(1)",
      memos: [{ content: '<i onclick="alert(1)">memo</i>' }],
      apps: [{ icon: '<svg onload="alert(1)"><circle cx="1" cy="1" r="1"></circle></svg>' }],
    },
  }
  const original = JSON.parse(JSON.stringify(work))
  const clean = sanitizeImportedWork(work, windowObject)

  assert.deepEqual(work, original)
  assert.doesNotMatch(clean.nodes[0].content, /onerror/)
  assert.doesNotMatch(clean.phoneModules[0].data.memos[0].content, /svg|onload/)
  assert.doesNotMatch(clean.phoneData.memos[0].content, /onclick/)
  assert.doesNotMatch(clean.phoneData.apps[0].icon, /onload/)
  assert.equal(clean.phoneData.wallpaperImage, "")
})

test("malformed nested collections cannot crash import sanitation", () => {
  const clean = sanitizeImportedWork({
    nodes: [null, "bad", { id: "safe", content: "text" }],
    phoneData: { memos: "bad", apps: [null] },
    phoneModules: [{ data: { memos: "bad" } }, null],
  }, windowObject)

  assert.deepEqual(clean.nodes, [{ id: "safe", content: "text" }])
  assert.deepEqual(clean.phoneData.memos, [])
  assert.deepEqual(clean.phoneData.apps, [])
  assert.deepEqual(clean.phoneModules[0].data.memos, [])
})
