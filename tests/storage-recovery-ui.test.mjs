import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const LEGACY_FLAGS = Object.freeze({ reliableLocalWrites: false })
const RELIABLE_FLAGS = Object.freeze({ reliableLocalWrites: true })

function unexpectedMutation(name) {
  return () => assert.fail(`${name} must not run in this fixture`)
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flushAsyncEvents() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

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
    flags: LEGACY_FLAGS,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked: unexpectedMutation("resetLocked"),
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
    flags: LEGACY_FLAGS,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked: unexpectedMutation("resetLocked"),
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
    flags: LEGACY_FLAGS,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked: unexpectedMutation("resetLocked"),
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
    flags: LEGACY_FLAGS,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked: unexpectedMutation("resetLocked"),
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

test("corrupt reset controller requires exact RESET and the legacy branch alone reloads", async t => {
  installDom(t)
  const { startCorruptLocalDatabaseReset } = await import(
    `../js/app.js?storage-reset-controller-legacy=${Date.now()}-${Math.random()}`
  )
  assert.equal(typeof startCorruptLocalDatabaseReset, "function")

  let legacyCalls = 0
  let lockedCalls = 0
  let reloadCalls = 0
  const controller = startCorruptLocalDatabaseReset({
    expectedCurrentRaw: "bad raw",
    flags: LEGACY_FLAGS,
    storage: { name: "unused-storage" },
    lockManager: { name: "unused-lock-manager" },
    createGenerationId: () => "unused-generation",
    now: () => 123,
    resetLegacy() { legacyCalls += 1 },
    resetLocked() { lockedCalls += 1 },
    reload() { reloadCalls += 1 },
    notify() {},
  })

  for (const answer of [null, "", "reset", " RESET", "RESET "]) {
    await controller.confirm(answer)
  }
  assert.equal(legacyCalls, 0)
  assert.equal(lockedCalls, 0)
  assert.equal(reloadCalls, 0)

  await controller.confirm("RESET")
  assert.equal(legacyCalls, 1)
  assert.equal(lockedCalls, 0)
  assert.equal(reloadCalls, 1)
})

test("legacy corrupt reset remains retryable after a failed reset", async t => {
  installDom(t)
  const { startCorruptLocalDatabaseReset } = await import(
    `../js/app.js?storage-reset-controller-legacy-retry=${Date.now()}-${Math.random()}`
  )
  let legacyCalls = 0
  let reloadCalls = 0
  const states = []
  const controller = startCorruptLocalDatabaseReset({
    expectedCurrentRaw: "bad raw",
    flags: LEGACY_FLAGS,
    storage: { name: "legacy-storage" },
    lockManager: { name: "unused-lock-manager" },
    createGenerationId: () => "unused-generation",
    now: () => 123,
    resetLegacy() {
      legacyCalls += 1
      if (legacyCalls === 1) {
        throw Object.assign(new Error("legacy reset failed"), { code: "reset-failed" })
      }
    },
    resetLocked: unexpectedMutation("resetLocked"),
    reload() { reloadCalls += 1 },
    notify() {},
    onState(state) { states.push(state) },
  })

  assert.equal(await controller.confirm("RESET"), false)
  assert.equal(legacyCalls, 1)
  assert.equal(reloadCalls, 0)
  assert.equal(states.at(-1).disabled, false)

  assert.equal(await controller.confirm("RESET"), true)
  assert.equal(legacyCalls, 2)
  assert.equal(reloadCalls, 1)
})

test("reliable corrupt reset passes the exact raw snapshot and locked dependencies only", async t => {
  installDom(t)
  const { startCorruptLocalDatabaseReset } = await import(
    `../js/app.js?storage-reset-controller-locked=${Date.now()}-${Math.random()}`
  )
  assert.equal(typeof startCorruptLocalDatabaseReset, "function")

  const expectedCurrentRaw = "bad\n原始\u0000raw"
  const storage = { name: "storage" }
  const lockManager = { available: true, request() {} }
  const createGenerationId = () => "generation-reset"
  const numericNow = 1_789_000_000_123
  const now = () => numericNow
  const lockedCalls = []
  let reloadCalls = 0

  const controller = startCorruptLocalDatabaseReset({
    expectedCurrentRaw,
    flags: RELIABLE_FLAGS,
    storage,
    lockManager,
    createGenerationId,
    now,
    resetLegacy: unexpectedMutation("resetLegacy"),
    async resetLocked(options) {
      lockedCalls.push(options)
      return { ok: true, code: "discarded", generationId: "generation-reset" }
    },
    reload() { reloadCalls += 1 },
    notify() {},
  })

  await controller.confirm("RESET")
  assert.equal(lockedCalls.length, 1)
  assert.strictEqual(lockedCalls[0].storage, storage)
  assert.strictEqual(lockedCalls[0].lockManager, lockManager)
  assert.strictEqual(lockedCalls[0].createGenerationId, createGenerationId)
  assert.strictEqual(lockedCalls[0].now, now)
  assert.equal(lockedCalls[0].now(), numericNow)
  assert.equal(lockedCalls[0].expectedCurrentRaw, expectedCurrentRaw)
  assert.equal(reloadCalls, 1)
})

test("unknown restore generation permanently settles corrupt reset without retry", async t => {
  installDom(t)
  const { startCorruptLocalDatabaseReset } = await import(
    `../js/app.js?storage-reset-controller-generation-unknown=${Date.now()}-${Math.random()}`
  )
  let lockedCalls = 0
  let reloadCalls = 0
  const states = []
  const controller = startCorruptLocalDatabaseReset({
    expectedCurrentRaw: "bad raw",
    flags: RELIABLE_FLAGS,
    storage: { name: "storage" },
    lockManager: { available: true, request() {} },
    createGenerationId: () => "generation-reset",
    now: () => 1_789_000_000_123,
    resetLegacy: unexpectedMutation("resetLegacy"),
    async resetLocked() {
      lockedCalls += 1
      throw Object.assign(new Error("restore generation could not be verified"), {
        code: "restore-generation-unknown",
        details: { commitState: "unchanged", generationState: "unknown" },
      })
    },
    reload() { reloadCalls += 1 },
    notify() {},
    onState(state) { states.push(state) },
  })

  assert.equal(await controller.confirm("RESET"), false)
  assert.equal(lockedCalls, 1)
  assert.equal(reloadCalls, 0)
  assert.equal(states.at(-1).disabled, true)
  assert.match(states.at(-1).message, /无法确认|重新加载.*检查/)

  assert.equal(await controller.confirm("RESET"), false)
  assert.equal(lockedCalls, 1)
  assert.equal(reloadCalls, 0)
})

test("rendered corrupt reset uses the injectable controller boundary and exact prompt answer", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(
    `../js/app.js?storage-reset-render-boundary=${Date.now()}-${Math.random()}`
  )
  const raw = "{broken exact raw"
  const calls = []

  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-json",
    raw,
    message: "invalid",
  }, {
    flags: RELIABLE_FLAGS,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked: unexpectedMutation("resetLocked"),
    prompt: () => "RESET",
    startReset(options) {
      calls.push({ type: "start", options })
      return {
        confirm(answer) {
          calls.push({ type: "confirm", answer })
          return Promise.resolve(false)
        },
      }
    },
  })

  const reset = Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "重置本地数据库")
  reset.click()
  await flushAsyncEvents()

  assert.equal(calls.length, 2)
  assert.equal(calls[0].type, "start")
  assert.equal(calls[0].options.expectedCurrentRaw, raw)
  assert.deepEqual(calls[0].options.flags, RELIABLE_FLAGS)
  assert.equal(calls[1].type, "confirm")
  assert.equal(calls[1].answer, "RESET")
})

test("pending corrupt reset is single-flight, persistent, and reloads only after success", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(
    `../js/app.js?storage-reset-pending=${Date.now()}-${Math.random()}`
  )
  const operation = deferred()
  let lockedCalls = 0
  let reloadCalls = 0
  let replacementEvents = 0
  window.addEventListener("tuuru:local-database-replaced", () => { replacementEvents += 1 })

  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-json",
    raw: "bad",
    message: "invalid",
  }, {
    flags: RELIABLE_FLAGS,
    storage: { name: "storage" },
    lockManager: { available: true, request() {} },
    createGenerationId: () => "generation-reset",
    now: () => 1_789_000_000_123,
    resetLegacy: unexpectedMutation("resetLegacy"),
    resetLocked() {
      lockedCalls += 1
      return operation.promise
    },
    prompt: () => "RESET",
    reload() { reloadCalls += 1 },
    notify() {},
  })

  const reset = Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "重置本地数据库")
  reset.click()
  await Promise.resolve()

  const status = container.querySelector("#storageResetStatus")
  assert.ok(status)
  assert.equal(status.getAttribute("role"), "status")
  assert.match(status.textContent, /正在.*重置|安全重置.*进行/)
  assert.equal(reset.disabled, true)
  assert.equal(lockedCalls, 1)
  assert.equal(reloadCalls, 0)

  reset.click()
  await Promise.resolve()
  assert.equal(lockedCalls, 1)
  assert.equal(reloadCalls, 0)

  operation.resolve({ ok: true, code: "discarded", generationId: "generation-reset" })
  await flushAsyncEvents()
  assert.equal(reloadCalls, 1)
  assert.equal(replacementEvents, 0)
  assert.equal(reset.disabled, true)
})

test("active editors leave a persistent retryable corrupt-reset error", async t => {
  const container = installDom(t)
  const { renderStorageRecovery } = await import(
    `../js/app.js?storage-reset-active-editors=${Date.now()}-${Math.random()}`
  )
  let attempts = 0
  let reloadCalls = 0

  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-structure",
    raw: "broken",
    message: "invalid",
  }, {
    flags: RELIABLE_FLAGS,
    storage: { name: "storage" },
    lockManager: { available: true, request() {} },
    createGenerationId: () => "generation-reset",
    now: () => 1_789_000_000_123,
    resetLegacy: unexpectedMutation("resetLegacy"),
    async resetLocked() {
      attempts += 1
      if (attempts === 1) {
        throw Object.assign(new Error("editors active"), {
          code: "restore-editors-active",
          details: { commitState: "unchanged", generationState: "unchanged" },
        })
      }
      return { ok: true, code: "discarded", generationId: "generation-reset" }
    },
    prompt: () => "RESET",
    reload() { reloadCalls += 1 },
    notify() {},
  })

  const reset = Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "重置本地数据库")
  reset.click()
  await flushAsyncEvents()

  const status = container.querySelector("#storageResetStatus")
  assert.ok(status)
  assert.match(status.textContent, /关闭.*编辑器|编辑器.*重试/)
  assert.equal(reset.disabled, false)
  assert.equal(reloadCalls, 0)

  reset.click()
  await flushAsyncEvents()
  assert.equal(attempts, 2)
  assert.equal(reloadCalls, 1)
})

for (const scenario of [
  {
    name: "missing Web Locks",
    error: Object.assign(new Error("Web Locks unavailable"), {
      code: "mutation-lock-unavailable",
    }),
    statusPattern: /无法安全重置|安全重置.*不可用|不支持.*安全重置/,
  },
  {
    name: "unknown reset result",
    error: Object.assign(new Error("readback unknown"), {
      code: "reset-readback-failed",
      details: { commitState: "unknown", generationState: "advanced" },
    }),
    statusPattern: /无法确认|重新加载.*检查/,
  },
]) {
  test(`${scenario.name} leaves corrupt reset persistently settled without reload`, async t => {
    const container = installDom(t)
    const { renderStorageRecovery } = await import(
      `../js/app.js?storage-reset-settled=${scenario.name}-${Date.now()}-${Math.random()}`
    )
    let lockedCalls = 0
    let reloadCalls = 0

    renderStorageRecovery(container, {
      ok: false,
      code: "invalid-json",
      raw: "bad",
      message: "invalid",
    }, {
      flags: RELIABLE_FLAGS,
      storage: { name: "storage" },
      lockManager: { available: false, request() {} },
      createGenerationId: () => "generation-reset",
      now: () => 1_789_000_000_123,
      resetLegacy: unexpectedMutation("resetLegacy"),
      async resetLocked() {
        lockedCalls += 1
        throw scenario.error
      },
      prompt: () => "RESET",
      reload() { reloadCalls += 1 },
      notify() {},
    })

    const reset = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent === "重置本地数据库")
    reset.click()
    await flushAsyncEvents()

    const status = container.querySelector("#storageResetStatus")
    assert.ok(status)
    assert.match(status.textContent, scenario.statusPattern)
    assert.equal(reset.disabled, true)
    assert.equal(reloadCalls, 0)

    reset.click()
    await flushAsyncEvents()
    assert.equal(lockedCalls, 1)
    assert.equal(reloadCalls, 0)
  })
}
