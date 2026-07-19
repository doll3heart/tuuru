import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

const bridgeSource = await readFile(new URL("../js/pages/reader.js", import.meta.url), "utf8")
const appSource = await readFile(new URL("../js/app.js", import.meta.url), "utf8")
const viteSource = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8")

test("the author read route is only a bridge to the real reader", () => {
  assert.match(bridgeSource, /export function buildReaderPreviewUrl/)
  assert.match(bridgeSource, /new URL\(["']reader\/index\.html["']/)
  assert.match(bridgeSource, /searchParams\.set\(["']preview["']/)
  assert.doesNotMatch(bridgeSource, /function renderNode|function renderArticleReader|pm-inline-card/)

  assert.match(appSource, /import\s*\{\s*openReaderPreview\s*\}\s*from\s*["']\.\/pages\/reader\.js["']/)
  assert.match(appSource, /router\(["']\/read\/:id["'][\s\S]*openReaderPreview\(p\.id\)/)
  assert.doesNotMatch(appSource, /import\s*\{\s*renderReader\s*\}\s*from\s*["']\.\/pages\/reader\.js["']/)
})

test("preview URLs stay same-origin under a subdirectory and encode the work id", async t => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test/tuuru/index.html#/read/old",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.alert = () => {}
  globalThis.confirm = () => false
  t.after(() => dom.window.close())

  const bridge = await import(`../js/pages/reader.js?preview-bridge=${Date.now()}`)
  assert.equal(typeof bridge.buildReaderPreviewUrl, "function")
  assert.equal(
    bridge.buildReaderPreviewUrl("work id/雪", dom.window.location.href),
    "https://example.test/tuuru/reader/index.html?preview=work+id%2F%E9%9B%AA",
  )
  assert.throws(() => bridge.buildReaderPreviewUrl("  ", dom.window.location.href), /work id/i)

  let replacedWith = ""
  const locationObject = {
    href: dom.window.location.href,
    replace(value) { replacedWith = value },
  }
  const openedUrl = bridge.openReaderPreview("work-1", locationObject)
  assert.equal(openedUrl, "https://example.test/tuuru/reader/index.html?preview=work-1")
  assert.equal(replacedWith, openedUrl)
})

test("the editor production build includes the real reader entry", () => {
  assert.match(viteSource, /const projectRoot = realpathSync\(__dirname\)/)
  assert.match(viteSource, /outDir:\s*path\.resolve\(projectRoot,\s*["']dist["']\)/)
  assert.match(viteSource, /reader\s*:\s*path\.resolve\(projectRoot,\s*["']reader\/index\.html["']\)/)
})
