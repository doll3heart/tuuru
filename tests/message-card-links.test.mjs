import test from "node:test"
import assert from "node:assert/strict"
import { buildTakeawaySearchUrl, safeMessageCardUrl } from "../js/message-card-links.js"

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
