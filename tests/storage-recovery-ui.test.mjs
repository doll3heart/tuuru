import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: "https://tuuru.local/",
  })
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalLocation = globalThis.location
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  t.after(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.location = originalLocation
  })
  return dom.window.document.getElementById("app")
}

test("corrupt storage offers backup restore before destructive reset", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(`../js/app.js?storage-recovery=${Date.now()}`)
  let restoreCalls = 0
  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-json",
    raw: "bad",
    message: "invalid",
  }, {
    startRestore() {
      return { pickFile() { restoreCalls += 1 } }
    },
  })

  const buttons = Array.from(container.querySelectorAll("button"))
  const labels = buttons.map(button => button.textContent)
  assert.deepEqual(labels, ["下载原始数据", "从完整备份恢复", "重新检测", "重置本地数据库"])
  buttons.find(button => button.textContent === "从完整备份恢复").click()
  assert.equal(restoreCalls, 1)
})

test("backup restore is absent when storage is unavailable or the state is unsupported", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(`../js/app.js?storage-recovery-absence=${Date.now()}`)
  let restoreCalls = 0
  const dependencies = {
    startRestore() {
      restoreCalls += 1
      return { pickFile() {} }
    },
  }

  for (const status of [
    { ok: false, code: "storage-unavailable", raw: null, message: "unavailable" },
    { ok: false, code: "unsupported", raw: "bad", message: "unsupported" },
  ]) {
    renderStorageRecovery(container, status, dependencies)
    const labels = Array.from(container.querySelectorAll("button"), button => button.textContent)
    assert.equal(labels.includes("从完整备份恢复"), false)
  }
  assert.equal(restoreCalls, 0)
})
