import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const authorSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const authorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const shoppingCss = readFileSync(new URL("../css/phone-shopping.css", import.meta.url), "utf8")
const authorHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const readerHtml = readFileSync(new URL("../reader/index.html", import.meta.url), "utf8")

test("reader scoped Apps render the shared author component vocabulary", () => {
  assert.match(source, /class="memo-card rd-memo-note/)
  assert.match(source, /class="memo-card-inner"/)
  assert.match(source, /class="memo-editor"/)
  assert.match(source, /class="memo-card-foot"/)
  assert.match(source, /class="browser-search-bar rd-browser-address"/)
  assert.match(source, /class="browser-row rd-browser-entry/)
  assert.match(source, /renderPhoneShoppingTabs/)
  assert.match(source, /renderPhoneShoppingList/)
  assert.doesNotMatch(source, /function readerShopListHtml/)
  assert.match(authorSource, /renderPhoneShoppingTabs/)
  assert.match(authorSource, /renderPhoneShoppingList/)
  assert.match(authorHtml, /css\/phone-shopping\.css/)
  assert.match(readerHtml, /\.\.\/css\/phone-shopping\.css/)
  assert.match(source, /class="gallery-photo-card rd-gallery-photo/)
})

test("reader scoped App CSS uses the shared shopping stylesheet", () => {
  assert.match(css, /\.rd-phone-app-memo\s+\.memo-card\s*\{/)
  assert.match(css, /\.rd-phone-app-browser\s+\.browser-search-bar\s*\{/)
  assert.match(css, /\.rd-phone-app-browser\s+\.browser-row\s*\{/)
  assert.match(shoppingCss, /\.phone-frame\s+\.shop-card-block\s*\{/)
  assert.match(shoppingCss, /\.phone-frame\s+\.shop-order-foot\s*\{/)
  assert.doesNotMatch(css, /\.rd-phone-app-shopping\s+\.shop-card-block\s*\{/)
  assert.doesNotMatch(authorCss, /(?:^|\n)\.shop-card-block\s*\{/)
  assert.match(css, /\.rd-phone-app-gallery\s+\.gallery-photo-card\s*\{/)
})
