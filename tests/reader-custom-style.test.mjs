import test from "node:test"
import assert from "node:assert/strict"

import {
  READER_CUSTOM_CSS_MAX_LENGTH,
  compileScopedReaderCss,
} from "../reader/custom-style.js"

test("reader custom CSS scopes ordinary rules and selector lists", () => {
  const result = compileScopedReaderCss(`
    .article-title, .article-node-title {
      letter-spacing: .08em;
      color: #7d5260;
    }
    :scope {
      --rd-reading-accent: #a06b7b;
    }
  `, ".reader-article-css-scope")

  assert.equal(result.ok, true)
  assert.equal(result.ruleCount, 2)
  assert.match(result.css, /\.reader-article-css-scope \.article-title/)
  assert.match(result.css, /\.reader-article-css-scope \.article-node-title/)
  assert.match(result.css, /\.reader-article-css-scope\s*\{\s*--rd-reading-accent:/)
  assert.doesNotMatch(result.css, /(^|,)\s*\.article-title/)
})

test("reader custom CSS preserves safe strings, functions, and pseudo selectors", () => {
  const result = compileScopedReaderCss(`
    /* Local decoration only */
    :scope .article-choice-btn:hover {
      background: linear-gradient(90deg, #fffafa, #f2e4e8);
      transform: translateY(-1px);
    }
    .article-title::after { content: " · 私人排版"; }
  `, ".reader-article-css-scope")

  assert.equal(result.ok, true)
  assert.equal(result.ruleCount, 2)
  assert.match(result.css, /linear-gradient/)
  assert.match(result.css, /content:\s*" · 私人排版"/)
})

test("reader custom CSS accepts an empty draft", () => {
  assert.deepEqual(compileScopedReaderCss(" \n ", ".reader-phone-css-scope"), {
    ok: true,
    css: "",
    error: "",
    errorCode: "",
    ruleCount: 0,
  })
})

test("reader custom CSS rejects malformed and nested rules", () => {
  for (const css of [
    ".article-title { color: red",
    ".article-title { .child { color: red; } }",
    "color: red; }",
    "{ color: red; }",
    ".article-title { color red; }",
  ]) {
    const result = compileScopedReaderCss(css, ".reader-article-css-scope")
    assert.equal(result.ok, false, css)
    assert.equal(result.css, "")
  }
})

test("reader custom CSS rejects at-rules, external resources, and escaped obfuscation", () => {
  for (const css of [
    '@import "https://tracker.example/style.css";',
    "@media (min-width: 1px) { .phone-frame { color: red; } }",
    "@font-face { font-family: x; src: local(x); }",
    '.phone-frame { background-image: url("https://tracker.example/pixel"); }',
    '.phone-frame { background-image: image-set("https://tracker.example/pixel" 1x); }',
    ".phone-frame { background: u\\72l(https://tracker.example/pixel); }",
  ]) {
    const result = compileScopedReaderCss(css, ".reader-phone-css-scope")
    assert.equal(result.ok, false, css)
    assert.equal(result.css, "")
  }
})

test("reader custom CSS rejects declarations that can cover or disable the reader shell", () => {
  for (const css of [
    ".article-title { position: fixed; }",
    ".article-title { position: sticky; }",
    ".article-title { z-index: 9999; }",
    ".article-title { pointer-events: none; }",
    ".article-title { behavior: url(x); }",
    ".article-title { -moz-binding: url(x); }",
  ]) {
    const result = compileScopedReaderCss(css, ".reader-article-css-scope")
    assert.equal(result.ok, false, css)
    assert.equal(result.errorCode, "forbidden_declaration")
  }
})

test("reader custom CSS enforces a bounded local-storage budget", () => {
  const result = compileScopedReaderCss(
    `.article-title { color: red; }\n${" ".repeat(READER_CUSTOM_CSS_MAX_LENGTH)}`,
    ".reader-article-css-scope",
  )

  assert.equal(result.ok, false)
  assert.equal(result.errorCode, "too_long")
})

test("reader custom CSS rejects invalid internal scope selectors", () => {
  const result = compileScopedReaderCss(".x { color: red; }", "body, html")
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, "invalid_scope")
})
