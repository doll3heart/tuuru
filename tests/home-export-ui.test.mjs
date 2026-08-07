import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "https://tuuru.local/",
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.location = dom.window.location
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.MutationObserver = dom.window.MutationObserver
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
})
globalThis.alert = () => {}
globalThis.confirm = () => true

localStorage.setItem("tuuru_works", JSON.stringify({
  works: [{
    id: "work-a",
    schemaVersion: 1,
    type: "article",
    title: "Story",
    desc: "Description",
    createdAt: 1,
    updatedAt: 2,
    nodes: [],
  }],
  contacts: [],
  groups: [],
}))

const { renderHome } = await import("../js/pages/home.js?home-export-ui")

test("work cards consolidate export actions and keep delete inside More", () => {
  document.getElementById("app").innerHTML = renderHome()
  const card = document.querySelector(".work-card[data-id='work-a']")
  assert.ok(card)
  assert.equal(card.querySelectorAll("[data-work-export]").length, 1)
  assert.equal(card.querySelector("[data-work-export]").textContent.trim(), "发送与导出")
  assert.equal(card.querySelector(".work-card-actions-left [id^='deleteWork-']"), null)
  const deleteAction = card.querySelector(".work-card-more-popover [id^='deleteWork-']")
  assert.ok(deleteAction)
  assert.match(deleteAction.className, /btn-danger-text/)
  assert.equal(card.querySelectorAll(".work-card-more-popover").length, 1)
})

test("the work export sheet exposes one primary share action and local fallbacks", () => {
  window.openWorkExport("work-a")
  const overlay = document.querySelector(".work-export-overlay")
  assert.ok(overlay)
  assert.equal(overlay.querySelector("[data-work-share]").textContent.trim(), "发送作品文件")
  assert.equal(overlay.querySelector("[data-work-download]").textContent.trim(), "下载 .tuuru")
  assert.equal(overlay.querySelector("[data-work-png]").textContent.trim(), "生成加密 PNG")
  assert.equal(overlay.querySelector("[data-work-copy]").textContent.trim(), "复制打开说明")
  assert.ok(overlay.querySelector("a[href='#/exports']"))
})
