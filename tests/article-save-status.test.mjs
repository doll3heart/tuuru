import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"

import { mountSaveStatus } from "../js/save-status-view.js"

function saveSnapshot(state = "clean", overrides = {}) {
  return Object.freeze({
    state,
    pendingCount: state === "clean" ? 0 : 1,
    activeBatchId: null,
    lastSavedAt: state === "clean" ? 1 : null,
    error: null,
    canRetry: state === "error-retryable",
    canRecheck: state === "error-unknown",
    hasRecoverableCandidate: state !== "clean",
    generation: 1,
    otherActiveEditors: Object.freeze([]),
    availability: null,
    ...overrides,
  })
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

async function settle() {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

function runtimeFixture(initialSnapshot, overrides = {}) {
  let current = initialSnapshot
  let listener = null
  let unsubscribeCalls = 0
  const calls = {
    retry: 0,
    recheck: 0,
    recoveryMaterial: 0,
    prepareEmergencyBackup: 0,
    stage: 0,
  }
  const runtime = {
    subscribe(nextListener) {
      listener = nextListener
      listener(current)
      return () => {
        unsubscribeCalls += 1
        listener = null
      }
    },
    snapshot: () => current,
    retry() {
      calls.retry += 1
      return Promise.resolve()
    },
    recheck() {
      calls.recheck += 1
      return Promise.resolve()
    },
    recoveryMaterial() {
      calls.recoveryMaterial += 1
      return null
    },
    prepareEmergencyBackup() {
      calls.prepareEmergencyBackup += 1
      return {
        artifacts: [],
        warning: {
          message: "此文件包含完整创作库和私密编辑数据，仅用于恢复；浏览器只确认已发起下载，不能保证已经写入磁盘。",
        },
      }
    },
    stage() {
      calls.stage += 1
    },
    ...overrides,
  }
  return {
    runtime,
    calls,
    emit(nextSnapshot) {
      current = nextSnapshot
      listener?.(nextSnapshot)
    },
    unsubscribeCalls: () => unsubscribeCalls,
  }
}

function mountFixture({
  snapshot = saveSnapshot(),
  runtime = null,
  callbacks = {},
  download = () => {},
} = {}) {
  const dom = new JSDOM("<!doctype html><html><body><main id=\"host\"></main></body></html>", {
    url: "https://tuuru.local/",
  })
  const container = dom.window.document.querySelector("#host")
  const defaults = {
    onReload() {},
    onLeave() {},
    onDiscardAndLeave() {},
    onCorrectInvalid() {},
    confirmDiscard: () => true,
    onRecheckLock() {},
    onTakeover() {},
    onExportWork() {},
  }
  const view = mountSaveStatus({
    container,
    runtime,
    initialSnapshot: runtime ? null : snapshot,
    download,
    ...defaults,
    ...callbacks,
  })
  return { dom, container, view }
}

function buttonLabels(container) {
  return [...container.querySelectorAll("button")].map(button => button.textContent.trim())
}

function errorCode(code) {
  return Object.freeze({ code, message: code })
}

test("renders the exact state copy, ordered controls, and ARIA roles", () => {
  const cases = [
    ["clean", null, "已保存", []],
    ["dirty", null, "未保存", []],
    ["saving", null, "正在保存", []],
    ["error-retryable", "quota-exceeded", "保存失败，原数据未改变", ["重试", "下载紧急备份", "放弃修改并离开"]],
    ["error-invalid", "candidate-invalid", "当前内容无法安全保存", ["纠正内容", "下载紧急备份"]],
    ["error-unknown", "readback-unknown", "无法确认刚才是否保存", ["重新检查", "下载紧急备份"]],
    ["conflict", "mutation-conflict", "本地创作库已发生冲突", ["下载紧急备份", "重新加载"]],
    ["lease-lost", "mutation-lease-lost", "此页面已失去编辑权", ["下载紧急备份", "返回作品列表"]],
    ["lease-lost", "work-locked", "此作品正在另一个标签页编辑", ["重新检查", "返回作品列表"]],
    ["lease-lost", "mutation-lock-unavailable", "当前浏览器不能保证可靠本地保存", ["导出已有作品", "返回作品列表"]],
  ]

  for (const [state, code, copy, actions] of cases) {
    const snapshot = saveSnapshot(state, { error: code ? errorCode(code) : null })
    const fixture = runtimeFixture(snapshot)
    const { container, view } = mountFixture({ runtime: fixture.runtime })
    const visible = container.querySelector(".save-status__label")
    const live = container.querySelector(".save-status__live")
    const alert = container.querySelector(".save-status__alert")

    assert.equal(visible.textContent, copy, state + " visible copy")
    assert.equal(visible.hasAttribute("role"), false)
    assert.equal(live.getAttribute("role"), "status")
    assert.equal(live.getAttribute("aria-live"), "polite")
    assert.equal(live.getAttribute("aria-atomic"), "true")
    assert.deepEqual(buttonLabels(container), actions, state + " controls")
    assert.equal(alert.hidden, !["error-retryable", "error-invalid", "error-unknown", "conflict", "lease-lost"].includes(state))
    if (!alert.hidden) {
      assert.equal(alert.getAttribute("role"), "alert")
      assert.equal(alert.getAttribute("aria-atomic"), "true")
      assert.equal(alert.getAttribute("tabindex"), "-1")
      assert.equal(alert.textContent.includes(copy), true)
      for (const button of container.querySelectorAll("button")) {
        assert.equal(button.tagName, "BUTTON")
        assert.equal(button.type, "button")
      }
    }
    if (code === "mutation-lock-unavailable") {
      const readonly = container.querySelector(".save-status__readonly")
      assert.equal(readonly.textContent.trim(), "保持只读")
      assert.equal(readonly.tagName, "SPAN")
    }
    view.dispose()
  }
})

test("quiet live announcements suppress routine autosave chatter and announce error recovery once", async () => {
  const fixture = runtimeFixture(saveSnapshot("clean"))
  const { container, dom, view } = mountFixture({ runtime: fixture.runtime })
  const live = container.querySelector(".save-status__live")
  const announcements = []
  const observer = new dom.window.MutationObserver(() => announcements.push(live.textContent))
  observer.observe(live, { childList: true, characterData: true, subtree: true })

  assert.equal(live.textContent, "")
  fixture.emit(saveSnapshot("dirty"))
  await settle()
  fixture.emit(saveSnapshot("saving"))
  await settle()
  fixture.emit(saveSnapshot("clean"))
  await settle()
  fixture.emit(saveSnapshot("dirty", { generation: 2 }))
  await settle()
  fixture.emit(saveSnapshot("saving", { generation: 2 }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 2 }))
  await settle()

  assert.equal(container.querySelector(".save-status__label").textContent, "已保存")
  assert.deepEqual(announcements, ["未保存", "已保存"])

  fixture.emit(saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") }))
  await settle()
  const firstAlert = container.querySelector(".save-status__alert")
  fixture.emit(saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") }))
  await settle()
  assert.equal(container.querySelector(".save-status__alert"), firstAlert)
  fixture.emit(saveSnapshot("dirty", { generation: 3 }))
  await settle()
  fixture.emit(saveSnapshot("saving", { generation: 3 }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 3 }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 4 }))
  await settle()

  assert.deepEqual(announcements.filter(Boolean), ["未保存", "已保存", "保存已恢复"])
  observer.disconnect()
  view.dispose()
})

test("errors suppress dirty chatter even before the first edit and every later recovery is announced", async () => {
  const fixture = runtimeFixture(saveSnapshot("clean"))
  const { container, dom, view } = mountFixture({ runtime: fixture.runtime })
  const live = container.querySelector(".save-status__live")
  const announcements = []
  const observer = new dom.window.MutationObserver(() => announcements.push(live.textContent))
  observer.observe(live, { childList: true, characterData: true, subtree: true })

  fixture.emit(saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") }))
  await settle()
  fixture.emit(saveSnapshot("dirty", { generation: 2 }))
  await settle()
  fixture.emit(saveSnapshot("saving", { generation: 2 }))
  await settle()
  assert.equal(live.textContent, "")
  fixture.emit(saveSnapshot("clean", { generation: 2 }))
  await settle()
  assert.equal(live.textContent, "保存已恢复")

  fixture.emit(saveSnapshot("error-unknown", { error: errorCode("readback-unknown"), generation: 3 }))
  await settle()
  assert.equal(live.textContent, "")
  fixture.emit(saveSnapshot("dirty", { generation: 4 }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 4 }))
  await settle()

  assert.equal(live.textContent, "保存已恢复")
  assert.deepEqual(announcements.filter(Boolean), ["保存已恢复", "保存已恢复"])
  observer.disconnect()
  view.dispose()
})

test("a recovery after the first dirty entry consumes the first-clean announcement", async () => {
  const fixture = runtimeFixture(saveSnapshot("clean"))
  const { container, dom, view } = mountFixture({ runtime: fixture.runtime })
  const live = container.querySelector(".save-status__live")
  const announcements = []
  const observer = new dom.window.MutationObserver(() => announcements.push(live.textContent))
  observer.observe(live, { childList: true, characterData: true, subtree: true })

  fixture.emit(saveSnapshot("dirty", { generation: 2 }))
  await settle()
  fixture.emit(saveSnapshot("error-retryable", {
    error: errorCode("quota-exceeded"),
    generation: 2,
  }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 2 }))
  await settle()
  fixture.emit(saveSnapshot("clean", { generation: 3 }))
  await settle()

  assert.equal(live.textContent, "保存已恢复")
  assert.deepEqual(announcements.filter(Boolean), ["未保存", "保存已恢复"])
  observer.disconnect()
  view.dispose()
})

test("actions are component-wide single-flight and rejection restores focus without hiding the alert", async () => {
  const pending = deferred()
  const snapshot = saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") })
  const fixture = runtimeFixture(snapshot, {
    retry() {
      fixture.calls.retry += 1
      return pending.promise
    },
  })
  const { container, dom, view } = mountFixture({ runtime: fixture.runtime })
  const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "重试")
  retry.click()
  retry.click()

  assert.equal(fixture.calls.retry, 1)
  assert.equal(container.querySelector(".save-status__actions").getAttribute("aria-busy"), "true")
  assert.equal([...container.querySelectorAll("button")].every(button => button.disabled), true)

  pending.reject(new Error("blocked"))
  await settle()

  assert.equal(container.querySelector(".save-status__alert").hidden, false)
  assert.equal(container.querySelector(".save-status__actions").getAttribute("aria-busy"), "false")
  assert.equal([...container.querySelectorAll("button")].every(button => !button.disabled), true)
  assert.match(container.textContent, /操作未完成，请重试。/)
  assert.equal(dom.window.document.activeElement.textContent, "重试")
  view.dispose()
})

test("an action failure remains a persistent alert when the save snapshot changes while pending", async () => {
  const pending = deferred()
  const snapshot = saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") })
  const fixture = runtimeFixture(snapshot, {
    retry() {
      fixture.calls.retry += 1
      return pending.promise
    },
  })
  const { container, view } = mountFixture({ runtime: fixture.runtime })
  const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "重试")

  retry.click()
  fixture.emit(saveSnapshot("clean", { generation: 2 }))
  assert.equal(container.querySelector(".save-status__label").textContent, "已保存")
  pending.reject(new Error("late retry failure"))
  await settle()

  const alert = container.querySelector(".save-status__alert")
  assert.equal(alert.hidden, false)
  assert.match(alert.textContent, /操作未完成，请重试。/)
  assert.equal(container.querySelector(".save-status__label").textContent, "已保存")
  assert.equal(view.focusError(), true)
  view.dispose()
})

test("discard requires a second strict affirmative confirmation", async () => {
  let allowDiscard = false
  let confirmationCalls = 0
  let discardCalls = 0
  const snapshot = saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") })
  const fixture = runtimeFixture(snapshot)
  const { container, view } = mountFixture({
    runtime: fixture.runtime,
    callbacks: {
      confirmDiscard() {
        confirmationCalls += 1
        return allowDiscard
      },
      onDiscardAndLeave() {
        discardCalls += 1
      },
    },
  })
  const discard = () => [...container.querySelectorAll("button")]
    .find(button => button.textContent === "放弃修改并离开")

  discard().click()
  await settle()
  assert.equal(confirmationCalls, 1)
  assert.equal(discardCalls, 0)

  allowDiscard = true
  discard().click()
  await settle()
  assert.equal(confirmationCalls, 2)
  assert.equal(discardCalls, 1)
  view.dispose()
})

test("invalid correction forwards the exact frozen recovery record and performs no mutation or retry", async () => {
  const operation = Object.freeze({ id: "blocked-op", generation: 1 })
  const later = Object.freeze({ id: "later-op", generation: 2 })
  const material = Object.freeze({
    kind: "ordinary",
    pendingOperations: Object.freeze([operation, later]),
    correctableOperationIds: Object.freeze(["blocked-op"]),
  })
  let received = null
  const snapshot = saveSnapshot("error-invalid", { error: errorCode("candidate-invalid") })
  const fixture = runtimeFixture(snapshot, {
    recoveryMaterial() {
      fixture.calls.recoveryMaterial += 1
      return material
    },
  })
  const { container, view } = mountFixture({
    runtime: fixture.runtime,
    callbacks: {
      onCorrectInvalid(value) {
        received = value
      },
    },
  })

  ;[...container.querySelectorAll("button")].find(button => button.textContent === "纠正内容").click()
  await settle()

  assert.equal(received, material)
  assert.equal(Object.isFrozen(received), true)
  assert.deepEqual(received.correctableOperationIds, ["blocked-op"])
  assert.equal(fixture.calls.recoveryMaterial, 1)
  assert.equal(fixture.calls.retry, 0)
  assert.equal(fixture.calls.stage, 0)
  assert.doesNotMatch(container.textContent, /later-op/)
  view.dispose()
})

test("emergency backup downloads every artifact in order, discloses limits, and never changes save state", async () => {
  const artifacts = Object.freeze([
    Object.freeze({
      filename: "tuuru-emergency-backup.json",
      mimeType: "application/json;charset=utf-8",
      contents: "{\"safe\":true}",
    }),
    Object.freeze({
      filename: "tuuru-emergency-draft.txt",
      mimeType: "text/plain;charset=utf-8",
      contents: "draft",
    }),
  ])
  const warning = "此文件包含完整创作库和私密编辑数据，仅用于恢复，不适合作为单篇作品分享。浏览器只确认已发起下载，不能保证已经写入磁盘。"
  const snapshot = saveSnapshot("error-invalid", { error: errorCode("candidate-invalid") })
  const fixture = runtimeFixture(snapshot, {
    prepareEmergencyBackup() {
      fixture.calls.prepareEmergencyBackup += 1
      return { artifacts, warning: { message: warning } }
    },
  })
  const downloaded = []
  const { container, view } = mountFixture({
    runtime: fixture.runtime,
    download(blob, filename) {
      downloaded.push({ blob, filename })
    },
  })

  assert.match(container.textContent, /完整创作库/)
  assert.match(container.textContent, /私密编辑数据/)
  assert.match(container.textContent, /只能确认已发起下载/)
  ;[...container.querySelectorAll("button")].find(button => button.textContent === "下载紧急备份").click()
  await settle()

  assert.equal(fixture.calls.prepareEmergencyBackup, 1)
  assert.deepEqual(downloaded.map(item => item.filename), artifacts.map(item => item.filename))
  assert.deepEqual(downloaded.map(item => item.blob.type), artifacts.map(item => item.mimeType))
  assert.deepEqual(await Promise.all(downloaded.map(item => item.blob.text())), artifacts.map(item => item.contents))
  assert.equal(container.querySelector(".save-status__label").textContent, "当前内容无法安全保存")
  assert.match(container.textContent, /不能保证已经写入磁盘/)
  view.dispose()
})

test("a failed later backup artifact keeps the prepared warning, save state, controls, and focus", async () => {
  for (const failureMode of ["sync", "async"]) {
    const warning = "完整创作库含私密编辑数据；浏览器已发起部分下载，但不能保证文件已经写入磁盘。"
    const artifacts = Object.freeze([
      Object.freeze({ filename: "first.json", mimeType: "application/json", contents: "{}" }),
      Object.freeze({ filename: "second.txt", mimeType: "text/plain", contents: "draft" }),
    ])
    const snapshot = saveSnapshot("error-invalid", { error: errorCode("candidate-invalid") })
    const fixture = runtimeFixture(snapshot, {
      prepareEmergencyBackup() {
        fixture.calls.prepareEmergencyBackup += 1
        return { artifacts, warning: { message: warning } }
      },
    })
    const attempts = []
    const { container, dom, view } = mountFixture({
      runtime: fixture.runtime,
      download(_blob, filename) {
        attempts.push(filename)
        if (attempts.length !== 2) return undefined
        if (failureMode === "sync") throw new Error("download blocked")
        return Promise.reject(new Error("download blocked"))
      },
    })
    const backup = [...container.querySelectorAll("button")]
      .find(button => button.textContent === "下载紧急备份")

    backup.click()
    await settle()

    assert.deepEqual(attempts, ["first.json", "second.txt"], failureMode)
    assert.match(container.textContent, /浏览器已发起部分下载/)
    assert.match(container.textContent, /仅用于恢复/)
    assert.match(container.textContent, /不适合作为单篇作品分享/)
    assert.match(container.textContent, /操作未完成，请重试。/)
    assert.equal(container.querySelector(".save-status__label").textContent, "当前内容无法安全保存")
    assert.equal([...container.querySelectorAll("button")].every(button => !button.disabled), true)
    assert.equal(dom.window.document.activeElement.textContent, "下载紧急备份")
    view.dispose()
  }
})

test("a backup failure after the save state becomes clean retains baseline and prepared disclosure", async () => {
  const pending = deferred()
  const preparedWarning = "第二个文件未完成，请检查浏览器下载记录。"
  const snapshot = saveSnapshot("error-invalid", { error: errorCode("candidate-invalid") })
  const fixture = runtimeFixture(snapshot, {
    prepareEmergencyBackup() {
      fixture.calls.prepareEmergencyBackup += 1
      return {
        artifacts: Object.freeze([
          Object.freeze({ filename: "backup.json", mimeType: "application/json", contents: "{}" }),
        ]),
        warning: { message: preparedWarning },
      }
    },
  })
  const { container, view } = mountFixture({
    runtime: fixture.runtime,
    download() {
      return pending.promise
    },
  })
  const backup = [...container.querySelectorAll("button")]
    .find(button => button.textContent === "下载紧急备份")

  backup.click()
  fixture.emit(saveSnapshot("clean", { generation: 2 }))
  pending.reject(new Error("download blocked"))
  await settle()

  const alert = container.querySelector(".save-status__alert")
  assert.equal(alert.hidden, false)
  assert.match(alert.textContent, /完整创作库/)
  assert.match(alert.textContent, /私密编辑数据/)
  assert.match(alert.textContent, /仅用于恢复/)
  assert.match(alert.textContent, /不适合作为单篇作品分享/)
  assert.match(alert.textContent, /第二个文件未完成/)
  assert.match(alert.textContent, /操作未完成，请重试。/)
  view.dispose()
})

test("takeover is hidden for a valid lease and shown only when explicitly available", async () => {
  let takeoverCalls = 0
  const locked = saveSnapshot("lease-lost", {
    error: errorCode("work-locked"),
    availability: Object.freeze({
      ownerId: "owner-b",
      leaseId: "lease-b",
      expiresAt: 99,
      isStale: false,
      canTakeover: false,
    }),
  })
  const fixture = runtimeFixture(locked)
  const { container, view } = mountFixture({
    runtime: fixture.runtime,
    callbacks: { onTakeover() { takeoverCalls += 1 } },
  })

  assert.equal(buttonLabels(container).includes("确认接管"), false)
  fixture.emit(saveSnapshot("lease-lost", {
    error: errorCode("work-locked"),
    availability: Object.freeze({
      ownerId: "owner-b",
      leaseId: "lease-b",
      expiresAt: 1,
      isStale: true,
      canTakeover: true,
    }),
  }))
  assert.equal(buttonLabels(container).includes("确认接管"), true)
  ;[...container.querySelectorAll("button")].find(button => button.textContent === "确认接管").click()
  await settle()
  assert.equal(takeoverCalls, 1)
  view.dispose()
})

test("other active editor memory warning remains visible without entering the quiet live region", () => {
  const peers = Object.freeze([
    Object.freeze({ workId: "other-work", ownerId: "owner-b", expiresAt: 99 }),
  ])
  const fixture = runtimeFixture(saveSnapshot("clean", { otherActiveEditors: peers }))
  const { container, view } = mountFixture({ runtime: fixture.runtime })
  const warning = container.querySelector(".save-status__peer-note")

  assert.equal(warning.hidden, false)
  assert.match(warning.textContent, /其他标签页/)
  assert.match(warning.textContent, /内存中的修改/)
  assert.match(warning.textContent, /不会包含/)
  assert.equal(container.querySelector(".save-status__live").textContent, "")

  fixture.emit(saveSnapshot("saving", { otherActiveEditors: peers }))
  assert.equal(warning.hidden, false)
  assert.equal(container.querySelector(".save-status__live").textContent, "")
  view.dispose()
})

test("runtime subscription, failed-open snapshots, focus, disposal, and late actions are safe", async () => {
  const pending = deferred()
  const snapshot = saveSnapshot("error-retryable", { error: errorCode("quota-exceeded") })
  const fixture = runtimeFixture(snapshot, {
    retry() {
      fixture.calls.retry += 1
      return pending.promise
    },
  })
  const { container, view } = mountFixture({ runtime: fixture.runtime })
  assert.equal(view.focusError(), true)
  const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "重试")
  retry.click()
  view.dispose()
  view.dispose()
  assert.equal(fixture.unsubscribeCalls(), 1)
  assert.equal(container.children.length, 0)
  pending.reject(new Error("late"))
  await settle()
  fixture.emit(saveSnapshot("clean"))
  assert.equal(container.children.length, 0)

  const failedOpen = mountFixture({
    snapshot: saveSnapshot("lease-lost", { error: errorCode("work-locked") }),
  })
  assert.equal(failedOpen.container.querySelector(".save-status__label").textContent, "此作品正在另一个标签页编辑")
  assert.equal(failedOpen.view.focusError(), true)
  failedOpen.view.dispose()

  const clean = mountFixture({ snapshot: saveSnapshot("clean") })
  assert.equal(clean.view.focusError(), false)
  clean.view.dispose()
})

test("unknown or disposed states fail closed instead of claiming saved", () => {
  for (const state of ["disposed", "future-state"]) {
    const { container, view } = mountFixture({ snapshot: saveSnapshot(state) })
    assert.equal(container.querySelector(".save-status__label").textContent, "无法确认当前保存状态")
    assert.equal(container.querySelector(".save-status__alert").hidden, false)
    assert.deepEqual(buttonLabels(container), [])
    view.dispose()
  }
})

test("rendering null, undefined, or malformed snapshots replaces a prior saved claim with a fail-closed alert", () => {
  const { container, view } = mountFixture({ snapshot: saveSnapshot("clean") })
  for (const value of [null, undefined, {}, { state: null }]) {
    view.render(value)
    assert.equal(container.querySelector(".save-status__label").textContent, "无法确认当前保存状态")
    assert.equal(container.querySelector(".save-status__alert").hidden, false)
  }
  view.dispose()
})

test("component CSS guarantees touch targets, narrow wrapping, safe areas, focus, disabled state, and reduced motion", async () => {
  const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

  assert.match(css, /\.save-status-action\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s)
  assert.match(css, /@media\s*\(max-width:\s*320px\)[\s\S]*?\.save-status__actions/)
  assert.match(css, /env\(safe-area-inset-top,\s*0px\)/)
  assert.match(css, /env\(safe-area-inset-right,\s*0px\)/)
  assert.match(css, /env\(safe-area-inset-bottom,\s*0px\)/)
  assert.match(css, /env\(safe-area-inset-left,\s*0px\)/)
  assert.match(css, /\.save-status-action:focus-visible/)
  assert.match(css, /\.save-status-action:disabled/)
  assert.match(css, /\.save-status__detail,\s*\.save-status__backup-note,\s*\.save-status__prepared-note,\s*\.save-status__action-feedback\s*\{\s*margin:\s*0/s)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.save-status/)
})
