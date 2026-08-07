import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tuuru.local/" })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.location = dom.window.location
globalThis.localStorage = dom.window.localStorage
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement

const { renderExportCenter } = await import("../js/pages/exports.js?export-center-ui")

const history = [
  { id: "a", entityType: "work", entityId: "current", title: "Current", format: "tuuru", bytes: 1000, revision: 2, exportedAt: 3, delivery: "shared" },
  { id: "b", entityType: "work", entityId: "changed", title: "Changed", format: "png", bytes: 2000, revision: 1, exportedAt: 2, delivery: "downloaded" },
  { id: "c", entityType: "work", entityId: "missing", title: "Missing", format: "tuuru", bytes: 3000, revision: 1, exportedAt: 1, delivery: "downloaded" },
]
const works = [
  { id: "current", type: "article", updatedAt: 2 },
  { id: "changed", type: "article", updatedAt: 9 },
]

test("export center separates current, changed, and missing work records", () => {
  document.body.innerHTML = renderExportCenter({ history, works, collections: [] })
  assert.match(document.body.textContent, /当前版本/)
  assert.match(document.body.textContent, /作品已在导出后修改/)
  assert.match(document.body.textContent, /原作品已删除/)
  assert.equal(document.querySelectorAll("[data-export-regenerate]").length, 2)
  assert.equal(document.querySelector("[data-export-record='c'] [data-export-regenerate]"), null)
})

test("export center keeps format filters and local-only explanation visible", () => {
  document.body.innerHTML = renderExportCenter({ history, works, collections: [] })
  assert.equal(document.querySelectorAll("[data-export-filter-button]").length, 4)
  assert.match(document.querySelector(".export-center-heading p").textContent, /不保存作品文件/)
  assert.match(document.querySelector(".export-center-heading p").textContent, /不会上传内容/)
})

test("empty export center relies on the global home navigation", () => {
  document.body.innerHTML = renderExportCenter({ history: [], works: [], collections: [] })
  assert.equal(document.querySelector(".export-center-empty a"), null)
  assert.doesNotMatch(document.querySelector(".export-center-empty").textContent, /返回作品库/)
})
