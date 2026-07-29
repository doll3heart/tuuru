import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import {
  createFeedbackCenter,
  runButtonAction,
} from "../js/interaction-feedback.js"

test("feedback center updates one live region instead of stacking notices", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const timers = []
  const center = createFeedbackCenter({
    documentObject:dom.window.document,
    className:"toast",
    setTimer(callback) {
      timers.push(callback)
      return timers.length
    },
    clearTimer() {},
  })

  const first = center.show("正在导出…", "info", {key:"export"})
  const second = center.show("导出完成", "success", {key:"export"})

  assert.equal(first, second)
  assert.equal(dom.window.document.querySelectorAll(".toast").length, 1)
  assert.equal(second.getAttribute("role"), "status")
  assert.equal(second.getAttribute("aria-live"), "polite")
  assert.equal(second.dataset.feedbackType, "success")
  assert.equal(second.querySelector("[data-feedback-copy]").textContent, "导出完成")

  center.dismiss()
  assert.equal(dom.window.document.querySelector(".toast"), null)
  dom.window.close()
})

test("feedback action runs once and dismisses the notice", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  let actions = 0
  const center = createFeedbackCenter({
    documentObject:dom.window.document,
    setTimer() { return 1 },
    clearTimer() {},
  })

  center.show("作品已置顶", "success", {
    actionLabel:"撤销",
    onAction() { actions += 1 },
  })
  const action = dom.window.document.querySelector("[data-feedback-action]")
  action.click()
  action.click()

  assert.equal(actions, 1)
  assert.equal(dom.window.document.querySelector("[data-feedback-root]"), null)
  dom.window.close()
})

test("button actions acknowledge immediately, reject duplicates, and restore controls", async () => {
  const dom = new JSDOM("<!doctype html><html><body><button>导出</button></body></html>")
  const button = dom.window.document.querySelector("button")
  let resolveAction
  let calls = 0
  const operation = () => {
    calls += 1
    return new Promise(resolve => { resolveAction = resolve })
  }

  const first = runButtonAction(button, operation, {pendingText:"正在打包…"})
  const second = runButtonAction(button, operation, {pendingText:"正在打包…"})

  assert.equal(calls, 1)
  assert.equal(button.disabled, true)
  assert.equal(button.getAttribute("aria-busy"), "true")
  assert.equal(button.textContent, "正在打包…")
  assert.equal(await second, undefined)

  resolveAction("done")
  assert.equal(await first, "done")
  assert.equal(button.disabled, false)
  assert.equal(button.getAttribute("aria-busy"), null)
  assert.equal(button.textContent, "导出")
  dom.window.close()
})
