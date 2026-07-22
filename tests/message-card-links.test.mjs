import test from "node:test"
import assert from "node:assert/strict"
import { buildTakeawayOpenTarget, buildTakeawaySearchUrl, safeMessageCardUrl } from "../js/message-card-links.js"

test("message card links allow only absolute HTTP(S) URLs", () => {
  assert.equal(safeMessageCardUrl("https://example.com/a?q=1"), "https://example.com/a?q=1")
  assert.equal(safeMessageCardUrl("http://example.com/"), "http://example.com/")
  assert.equal(safeMessageCardUrl("javascript:alert(1)"), "")
  assert.equal(safeMessageCardUrl("data:text/html,bad"), "")
  assert.equal(safeMessageCardUrl("/relative"), "")
})

test("takeaway searches encode shop and order text without exposing a brand label", () => {
  const url = buildTakeawaySearchUrl("春风小馆", "番茄牛腩饭 少辣")
  assert.match(url, /^https:\/\/www\.meituan\.com\/s\//)
  assert.equal(decodeURIComponent(url.split("/s/")[1]), "春风小馆 番茄牛腩饭 少辣")
  assert.equal(buildTakeawaySearchUrl("", ""), "")
})

test("Android takeaway cards request the installed Meituan app with a web fallback", () => {
  const target = buildTakeawayOpenTarget(
    "春风小馆",
    "番茄牛腩饭 少辣",
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138 Mobile Safari/537.36",
  )

  assert.equal(target.opensApp, true)
  assert.match(target.href, /^intent:\/\/www\.meituan\.com\/s\//)
  assert.match(target.href, /;scheme=https;/)
  assert.match(target.href, /;package=com\.sankuai\.meituan;/)
  const encodedFallback = target.href.match(/;S\.browser_fallback_url=([^;]+);end$/)?.[1]
  assert.equal(decodeURIComponent(encodedFallback || ""), buildTakeawaySearchUrl("春风小馆", "番茄牛腩饭 少辣"))
})

test("non-Android takeaway cards keep the ordinary web search", () => {
  const target = buildTakeawayOpenTarget(
    "春风小馆",
    "番茄牛腩饭",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)",
  )

  assert.deepEqual(target, {
    href: buildTakeawaySearchUrl("春风小馆", "番茄牛腩饭"),
    opensApp: false,
  })
  assert.deepEqual(buildTakeawayOpenTarget("", "", "Android"), { href: "", opensApp: false })
})
