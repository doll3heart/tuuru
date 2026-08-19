import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("author modal and feedback share accessible interaction foundations", async t => {
  const dom = new JSDOM("<!doctype html><html><body><button id=trigger>打开</button><div id=app></div></body></html>", {
    url:"http://localhost/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.location = dom.window.location
  globalThis.history = dom.window.history
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  t.after(() => dom.window.close())

  const {modal, showToast} = await import(`../js/app.js?interaction-foundation=${Date.now()}`)
  const trigger = document.getElementById("trigger")
  trigger.focus()
  const overlay = modal(
    "确认操作",
    "<p>内容</p>",
    '<button type="button" class="btn btn-primary" id="confirmAction">确认</button>',
  )
  const dialog = overlay.querySelector(".modal")

  assert.equal(dialog.getAttribute("role"), "dialog")
  assert.equal(dialog.getAttribute("aria-modal"), "true")
  assert.ok(dialog.getAttribute("aria-labelledby"))
  assert.equal(document.activeElement?.id, "confirmAction")

  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"Escape",
    bubbles:true,
    cancelable:true,
  }))
  assert.equal(document.querySelector(".modal-overlay"), null)
  assert.equal(document.activeElement?.id, trigger.id)

  const formOverlay = modal(
    "编辑资料",
    '<label for="profileName">名称</label><input id="profileName"><details><summary>更多设置</summary><input id="hiddenExtra"></details>',
    '<button type="button" class="btn btn-primary" id="saveProfile">保存</button><button type="button" class="btn btn-ghost" id="cancelProfile">取消</button>',
  )
  assert.equal(document.activeElement?.id, "profileName", "long forms should start at their first visible field")
  assert.deepEqual(
    [...formOverlay.querySelectorAll(".modal-footer > button")].map(button => button.id),
    ["cancelProfile", "saveProfile"],
    "modal actions should end with cancel then primary regardless of call-site order",
  )
  formOverlay.remove()

  const firstToast = showToast("正在处理", "info", {key:"operation"})
  const secondToast = showToast("处理完成", "success", {key:"operation"})
  assert.equal(firstToast, secondToast)
  assert.equal(document.querySelectorAll(".toast").length, 1)
  assert.equal(secondToast.textContent, "处理完成")
})
