import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import {
  addStylesheetRecovery,
  tuuruStylesheetRecovery,
} from "../scripts/stylesheet-recovery.mjs"

const entries = [
  ["author", readFileSync(new URL("../index.html", import.meta.url), "utf8")],
  ["reader", readFileSync(new URL("../reader/index.html", import.meta.url), "utf8")],
]

test("both production entries retry a failed stylesheet exactly once with a fresh URL", () => {
  for (const [name, html] of entries) {
    const transformedHtml = addStylesheetRecovery(html)
    const dom = new JSDOM(transformedHtml, {
      runScripts: "dangerously",
      url: `https://tuuru.test/${name}/`,
    })
    const link = dom.window.document.querySelector("link[data-tuuru-stylesheet]")

    assert.ok(link, `${name} stylesheet is recoverable`)
    const initialHref = link.href
    link.dispatchEvent(new dom.window.Event("error"))

    assert.equal(link.dataset.retry, "1")
    assert.notEqual(link.href, initialHref)
    assert.match(link.href, /[?&]tuuru-style-retry=\d+$/)

    const retryHref = link.href
    link.dispatchEvent(new dom.window.Event("error"))
    assert.equal(link.href, retryHref, `${name} retry cannot loop`)
    dom.window.close()
  }
})

test("the post-build HTML transform covers Vite-generated stylesheet links", () => {
  const builtHtml = '<link rel="stylesheet" crossorigin href="./assets/main-abc.css">'
  const transformed = addStylesheetRecovery(builtHtml)
  const plugin = tuuruStylesheetRecovery()

  assert.match(transformed, /<link data-tuuru-stylesheet onerror=/)
  assert.equal(addStylesheetRecovery(transformed), transformed)
  assert.equal(plugin.transformIndexHtml.order, "post")
  assert.equal(plugin.transformIndexHtml.handler, addStylesheetRecovery)
})

test("Cloudflare revalidates entry documents and built assets", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8")

  for (const route of ["/", "/reader/", "/assets/*"]) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    assert.match(headers, new RegExp(`(?:^|\\n)${escapedRoute}\\s*\\n\\s+Cache-Control:\\s*public,\\s*no-cache,\\s*must-revalidate`, "i"))
  }
})
