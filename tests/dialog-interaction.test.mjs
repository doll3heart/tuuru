import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { installDialogInteraction } from "../js/dialog-interaction.js"

function fixture() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <button id="invoker">打开</button>
    <div id="overlay">
      <section id="dialog">
        <button id="first">第一项</button>
        <input id="field">
        <button id="last">最后一项</button>
      </section>
    </div>
  </body></html>`)
  const document = dom.window.document
  return {
    dom,
    document,
    overlay:document.getElementById("overlay"),
    dialog:document.getElementById("dialog"),
    invoker:document.getElementById("invoker"),
  }
}

test("dialog interaction focuses the first control and traps keyboard focus", () => {
  const {dom, document, overlay, dialog, invoker} = fixture()
  const closeReasons = []
  invoker.focus()
  const lifecycle = installDialogInteraction({
    overlay,
    dialog,
    invoker,
    onRequestClose:reason => closeReasons.push(reason),
  })

  assert.equal(document.activeElement, document.getElementById("first"))
  document.getElementById("last").focus()
  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"Tab",
    bubbles:true,
  }))
  assert.equal(document.activeElement, document.getElementById("first"))

  document.getElementById("first").focus()
  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"Tab",
    shiftKey:true,
    bubbles:true,
  }))
  assert.equal(document.activeElement, document.getElementById("last"))

  lifecycle.dispose({restoreFocus:true})
  assert.equal(document.activeElement, invoker)
  assert.deepEqual(closeReasons, [])
  dom.window.close()
})

test("dialog interaction requests close for escape and the backdrop", () => {
  const {dom, overlay, dialog, invoker} = fixture()
  const closeReasons = []
  const lifecycle = installDialogInteraction({
    overlay,
    dialog,
    invoker,
    onRequestClose:reason => closeReasons.push(reason),
  })

  dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key:"Escape",
    bubbles:true,
    cancelable:true,
  }))
  overlay.dispatchEvent(new dom.window.MouseEvent("click", {
    bubbles:true,
    cancelable:true,
  }))

  assert.deepEqual(closeReasons, ["escape", "backdrop"])
  lifecycle.dispose()
  dom.window.close()
})
