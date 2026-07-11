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

test("corrupt raw download delegates the exact text Blob and reports initiation", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(`../js/app.js?storage-recovery-download=${Date.now()}`)
  const raw = "bad\n原始\u0000data"
  const downloads = []
  const notifications = []

  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-json",
    raw,
    message: "invalid",
  }, {
    download(blob, filename) { downloads.push({ blob, filename }) },
    notify(message, type) { notifications.push({ message, type }) },
    now: () => new Date("2026-07-11T12:34:56.789Z"),
  })

  const downloadButton = Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "下载原始数据")
  downloadButton.click()

  assert.equal(downloads.length, 1)
  assert.equal(downloads[0].blob.type, "text/plain;charset=utf-8")
  assert.equal(await downloads[0].blob.text(), raw)
  assert.equal(downloads[0].filename, "tuuru-recovery-2026-07-11T12-34-56-789Z.txt")
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].type, "success")
  assert.match(notifications[0].message, /下载已发起/)
  assert.match(notifications[0].message, /确认文件/)
  assert.match(notifications[0].message, /恢复或重置/)
  assert.doesNotMatch(notifications[0].message, /已保存/)
})

test("corrupt raw download reports helper failures without claiming success", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(`../js/app.js?storage-recovery-download-failure=${Date.now()}`)
  const notifications = []

  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-structure",
    raw: "broken",
    message: "invalid",
  }, {
    download() { throw new Error("download blocked") },
    notify(message, type) { notifications.push({ message, type }) },
    now: () => new Date("2026-07-11T12:34:56.789Z"),
  })

  const downloadButton = Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "下载原始数据")
  downloadButton.click()

  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].type, "error")
  assert.match(notifications[0].message, /原始数据下载失败/)
  assert.match(notifications[0].message, /download blocked/)
  assert.doesNotMatch(notifications[0].message, /已发起|已保存/)
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
