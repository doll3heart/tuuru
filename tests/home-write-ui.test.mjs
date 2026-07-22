import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"
import { createJsonToken } from "../js/local-database-mutation.js"

const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
  url: "https://tuuru.local/",
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.location = dom.window.location
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage

const { WORK_TYPE } = await import("../js/data.js")
const { createHomeWriteController } = await import("../js/pages/home.js?home-write-controller")
const { createNewWorkController } = await import("../js/pages/new.js?new-work-controller")

const LEGACY_FLAGS = Object.freeze({ reliableLocalWrites: false })
const RELIABLE_FLAGS = Object.freeze({ reliableLocalWrites: true })

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function unexpected(name) {
  return () => assert.fail(`${name} must not run`)
}

function verifiedOutcome(work) {
  const database = { works: work === null ? [] : [work] }
  return {
    ok: true,
    work,
    commit: {
      ok: true,
      operationId: "operation-a",
      raw: JSON.stringify(database),
      database,
      workToken: createJsonToken(work),
    },
  }
}

test("new-work legacy mode remains synchronous with the exact effect order", () => {
  const events = []
  const controller = createNewWorkController({
    flags: LEGACY_FLAGS,
    createLegacy(data) {
      events.push(["legacy", data])
      return { id: data.type === WORK_TYPE.PHONE ? "phone-a" : "article-a" }
    },
    createReliable: unexpected("createReliable"),
    notify(message) { events.push(["notify", message]) },
    navigate(path) { events.push(["navigate", path]) },
    publish: unexpected("publish"),
  })

  const article = controller.submit({
    type: WORK_TYPE.ARTICLE,
    title: "   ",
    desc: "  文章描述  ",
    author: "  作者  ",
  })
  assert.equal(article.id, "article-a")
  assert.equal(article instanceof Promise, false)
  assert.deepEqual(events, [
    ["legacy", {
      type: WORK_TYPE.ARTICLE,
      title: "未命名互动文章",
      desc: "文章描述",
      author: "作者",
    }],
    ["notify", "作品已创建"],
    ["navigate", "/edit/article-a"],
  ])

  events.length = 0
  const phone = controller.submit({ type: WORK_TYPE.PHONE, title: "", desc: "", author: "" })
  assert.equal(phone.id, "phone-a")
  assert.deepEqual(events, [
    ["legacy", {
      type: WORK_TYPE.PHONE,
      title: "未命名小手机",
      desc: "",
      author: "",
    }],
    ["notify", "作品已创建"],
    ["navigate", "/phone/phone-a"],
  ])
})

test("reliable creation is single-flight and delays success effects until verification", async () => {
  const gate = deferred()
  const events = []
  let calls = 0
  const controller = createNewWorkController({
    flags: RELIABLE_FLAGS,
    createLegacy: unexpected("createLegacy"),
    createReliable(data) {
      calls += 1
      events.push(["reliable", data])
      return gate.promise
    },
    notify(message) { events.push(["notify", message]) },
    navigate(path) { events.push(["navigate", path]) },
    publish(action, key, state) { events.push(["publish", action, key, state.status]) },
  })
  const input = { type: WORK_TYPE.ARTICLE, title: " 新作 ", desc: " 描述 ", author: " 作者 " }

  const first = controller.submit(input)
  const second = controller.submit(input)
  assert.equal(first, second)
  await Promise.resolve()
  assert.equal(calls, 1)
  assert.deepEqual(events, [
    ["publish", "create", WORK_TYPE.ARTICLE, "pending"],
    ["reliable", {
      type: WORK_TYPE.ARTICLE,
      title: "新作",
      desc: "描述",
      author: "作者",
    }],
  ])

  gate.resolve(verifiedOutcome({ id: "verified-a" }))
  const result = await first
  assert.equal(result.work.id, "verified-a")
  assert.deepEqual(events.slice(-3), [
    ["publish", "create", WORK_TYPE.ARTICLE, "success"],
    ["notify", "作品已创建"],
    ["navigate", "/edit/verified-a"],
  ])
})

test("a reliable locked create keeps its form and publishes a persistent other-tab error", async () => {
  const states = []
  let successEffects = 0
  const controller = createNewWorkController({
    flags: RELIABLE_FLAGS,
    createLegacy: unexpected("createLegacy"),
    createReliable: () => ({ ok: false, code: "work-locked", availability: null }),
    notify() { successEffects += 1 },
    navigate() { successEffects += 1 },
    publish(action, key, state) { states.push({ action, key, ...state }) },
  })

  await assert.rejects(
    controller.submit({ type: WORK_TYPE.PHONE, title: "保留输入", desc: "x", author: "y" }),
    error => error?.code === "work-locked",
  )
  assert.equal(successEffects, 0)
  assert.equal(states.at(-1).status, "error")
  assert.equal(states.at(-1).persistent, true)
  assert.match(states.at(-1).message, /另一个标签页/)
})

test("a verified commit with cleanup trouble remains success with a visible do-not-repeat warning", async () => {
  const states = []
  let reliableCalls = 0
  let successEffects = 0
  const outcome = verifiedOutcome({ id: "verified-a" })
  outcome.cleanupError = new Error("cleanup failed after commit")
  const controller = createNewWorkController({
    flags: RELIABLE_FLAGS,
    createLegacy: unexpected("createLegacy"),
    createReliable() {
      reliableCalls += 1
      return outcome
    },
    notify() { successEffects += 1 },
    navigate() { successEffects += 1 },
    publish(action, key, state) { states.push({ action, key, ...state }) },
  })

  const input = {
    type: WORK_TYPE.ARTICLE,
    title: "Saved",
    desc: "",
    author: "",
  }
  const first = controller.submit(input)
  assert.equal(await first, outcome)
  assert.equal(await controller.submit(input), outcome)
  assert.equal(reliableCalls, 1)
  assert.equal(successEffects, 0)
  assert.deepEqual(states.map(state => state.status), ["pending", "warning"])
  assert.equal(states.at(-1).persistent, true)
  assert.equal(states.at(-1).blocked, true)
  assert.equal(states.at(-1).message.length > 0, true)
})

test("home legacy update, duplicate, and delete preserve synchronous edge behavior", () => {
  const events = []
  let updateResult = { id: "work-a" }
  const controller = createHomeWriteController({
    flags: LEGACY_FLAGS,
    updateLegacy(workId, patch) {
      events.push(["update", workId, patch])
      return updateResult
    },
    duplicateLegacy(workId) {
      events.push(["duplicate", workId])
      return null
    },
    deleteLegacy(workId) { events.push(["delete", workId]) },
    updateReliable: unexpected("updateReliable"),
    duplicateReliable: unexpected("duplicateReliable"),
    deleteReliable: unexpected("deleteReliable"),
    notify(message, type) { events.push(["notify", message, type]) },
    refresh() { events.push(["refresh"]) },
    publish: unexpected("publish"),
  })

  const close = () => events.push(["close"])
  const updated = controller.update({ workId: "work-a", patch: { title: "新" }, close })
  assert.equal(updated, updateResult)
  assert.deepEqual(events, [
    ["update", "work-a", { title: "新" }],
    ["notify", "作品信息已更新", undefined],
    ["close"],
    ["refresh"],
  ])

  events.length = 0
  updateResult = null
  assert.equal(controller.update({ workId: "missing", patch: {}, close }), null)
  assert.deepEqual(events, [["update", "missing", {}], ["close"]])

  events.length = 0
  assert.equal(controller.duplicate({ workId: "missing" }), null)
  assert.deepEqual(events, [
    ["duplicate", "missing"],
    ["notify", "已复制", "info"],
    ["refresh"],
  ])

  events.length = 0
  assert.equal(controller.remove({ workId: "work-a", confirmed: false }), undefined)
  assert.deepEqual(events, [])
  assert.equal(controller.remove({ workId: "work-a", confirmed: true }), undefined)
  assert.deepEqual(events, [
    ["delete", "work-a"],
    ["notify", "已删除", "info"],
    ["refresh"],
  ])
})

function createReliableHomeHarness(action, mutation) {
  const events = []
  const controller = createHomeWriteController({
    flags: RELIABLE_FLAGS,
    updateLegacy: unexpected("updateLegacy"),
    duplicateLegacy: unexpected("duplicateLegacy"),
    deleteLegacy: unexpected("deleteLegacy"),
    updateReliable: action === "update" ? mutation : unexpected("updateReliable"),
    duplicateReliable: action === "duplicate" ? mutation : unexpected("duplicateReliable"),
    deleteReliable: action === "delete" ? mutation : unexpected("deleteReliable"),
    notify(message, type) { events.push(["notify", message, type]) },
    refresh() { events.push(["refresh"]) },
    publish(name, workId, state) { events.push(["publish", name, workId, state.status]) },
  })
  return { controller, events }
}

test("cleanup-only success leaves every home action terminal, visible, and non-repeatable", async () => {
  for (const action of ["update", "duplicate", "delete"]) {
    const states = []
    let reliableCalls = 0
    let successEffects = 0
    const outcome = verifiedOutcome(action === "delete" ? null : { id: "work-a" })
    outcome.cleanupError = new Error(`${action} cleanup failed after commit`)
    const mutation = () => {
      reliableCalls += 1
      return outcome
    }
    const controller = createHomeWriteController({
      flags: RELIABLE_FLAGS,
      updateLegacy: unexpected("updateLegacy"),
      duplicateLegacy: unexpected("duplicateLegacy"),
      deleteLegacy: unexpected("deleteLegacy"),
      updateReliable: action === "update" ? mutation : unexpected("updateReliable"),
      duplicateReliable: action === "duplicate" ? mutation : unexpected("duplicateReliable"),
      deleteReliable: action === "delete" ? mutation : unexpected("deleteReliable"),
      notify() { successEffects += 1 },
      refresh() { successEffects += 1 },
      publish(name, workId, state) { states.push({ name, workId, ...state }) },
    })
    const close = () => { successEffects += 1 }
    const invoke = () => action === "update"
      ? controller.update({
        workId: "work-a",
        expectedWorkToken: "token",
        patch: { title: "Saved" },
        close,
      })
      : action === "delete"
        ? controller.remove({
          workId: "work-a",
          expectedWorkToken: "token",
          confirmed: true,
          close,
        })
        : controller.duplicate({ workId: "work-a" })

    assert.equal(await invoke(), outcome)
    assert.equal(await invoke(), outcome)
    assert.equal(reliableCalls, 1, action)
    assert.equal(successEffects, 0, action)
    assert.deepEqual(states.map(state => state.status), ["pending", "warning"], action)
    assert.equal(states.at(-1).persistent, true, action)
    assert.equal(states.at(-1).blocked, true, action)
    assert.equal(states.at(-1).message.length > 0, true, action)
  }
})

test("each reliable home action is single-flight and closes or refreshes only after success", async () => {
  for (const action of ["update", "duplicate", "delete"]) {
    const gate = deferred()
    let calls = 0
    const harness = createReliableHomeHarness(action, () => {
      calls += 1
      return gate.promise
    })
    const close = () => harness.events.push(["close"])
    const args = action === "update"
      ? { workId: "work-a", expectedWorkToken: "token", patch: { title: "新" }, close }
      : action === "delete"
        ? { workId: "work-a", expectedWorkToken: "token", confirmed: true, close }
        : { workId: "work-a" }
    const invoke = () => action === "update"
      ? harness.controller.update(args)
      : action === "delete"
        ? harness.controller.remove(args)
        : harness.controller.duplicate(args)

    const first = invoke()
    const second = invoke()
    assert.equal(first, second)
    await Promise.resolve()
    assert.equal(calls, 1)
    assert.deepEqual(harness.events, [["publish", action, "work-a", "pending"]])

    gate.resolve(verifiedOutcome(action === "delete" ? null : { id: "work-a" }))
    await first
    assert.equal(harness.events.some(event => event[0] === "refresh"), true)
    if (action !== "duplicate") {
      assert.equal(harness.events.some(event => event[0] === "close"), true)
    }
    assert.equal(harness.events.at(-1)[0], "refresh")
  }
})

test("reliable home failures retain dialogs, restore action state, and never run success effects", async () => {
  for (const failure of [
    Object.assign(new Error("sync"), { code: "mutation-conflict" }),
    Object.assign(new Error("async"), {
      code: "mutation-verification-failed",
      details: { commitState: "unknown" },
    }),
  ]) {
    const states = []
    let successEffects = 0
    const controller = createHomeWriteController({
      flags: RELIABLE_FLAGS,
      updateLegacy: unexpected("updateLegacy"),
      duplicateLegacy: unexpected("duplicateLegacy"),
      deleteLegacy: unexpected("deleteLegacy"),
      updateReliable: unexpected("updateReliable"),
      duplicateReliable() {
        if (failure.message === "sync") throw failure
        return Promise.reject(failure)
      },
      deleteReliable: unexpected("deleteReliable"),
      notify() { successEffects += 1 },
      refresh() { successEffects += 1 },
      publish(action, workId, state) { states.push({ action, workId, ...state }) },
    })

    await assert.rejects(controller.duplicate({ workId: "work-a" }), error => error === failure)
    assert.equal(successEffects, 0)
    assert.equal(states.at(-1).status, "error")
    assert.equal(states.at(-1).persistent, true)
    if (failure.code === "mutation-verification-failed") {
      assert.match(states.at(-1).message, /无法确认/)
    } else {
      assert.match(states.at(-1).message, /已变化|不存在/)
    }
  }
})

test("post-commit UI callback failures are not reclassified as storage failures", async () => {
  const createStates = []
  const navigationError = new Error("navigation failed after commit")
  const createController = createNewWorkController({
    flags: RELIABLE_FLAGS,
    createLegacy: unexpected("createLegacy"),
    createReliable: () => verifiedOutcome({ id: "verified-a" }),
    notify() {},
    navigate() { return Promise.reject(navigationError) },
    publish(action, key, state) { createStates.push({ action, key, ...state }) },
  })

  await assert.rejects(
    createController.submit({ type: WORK_TYPE.ARTICLE, title: "Saved", desc: "", author: "" }),
    error => error === navigationError,
  )
  assert.deepEqual(createStates.map(state => state.status), ["pending", "success", "warning"])
  assert.equal(createStates.at(-1).persistent, true)
  assert.equal(createStates.at(-1).message.length > 0, true)

  const homeStates = []
  const refreshError = new Error("refresh failed after commit")
  const homeController = createHomeWriteController({
    flags: RELIABLE_FLAGS,
    updateLegacy: unexpected("updateLegacy"),
    duplicateLegacy: unexpected("duplicateLegacy"),
    deleteLegacy: unexpected("deleteLegacy"),
    updateReliable: unexpected("updateReliable"),
    duplicateReliable: () => verifiedOutcome({ id: "copy-a" }),
    deleteReliable: unexpected("deleteReliable"),
    notify() {},
    refresh() { throw refreshError },
    publish(action, workId, state) { homeStates.push({ action, workId, ...state }) },
  })

  await assert.rejects(homeController.duplicate({ workId: "work-a" }), error => error === refreshError)
  assert.deepEqual(homeStates.map(state => state.status), ["pending", "success", "warning"])
  assert.equal(homeStates.at(-1).persistent, true)
  assert.equal(homeStates.at(-1).message.length > 0, true)
})

test("production pages keep one closed shared flag and import only the reliable home boundary", async () => {
  const [flagsSource, homeSource, newSource] = await Promise.all([
    readFile(new URL("../js/feature-flags.js", import.meta.url), "utf8"),
    readFile(new URL("../js/pages/home.js", import.meta.url), "utf8"),
    readFile(new URL("../js/pages/new.js", import.meta.url), "utf8"),
  ])

  assert.match(flagsSource, /reliableLocalWrites:\s*false/)
  assert.match(homeSource, /FEATURE_FLAGS/)
  assert.match(newSource, /FEATURE_FLAGS/)
  assert.match(homeSource, /from\s+["']\.\.\/home-work-mutations\.js["']/)
  assert.match(newSource, /from\s+["']\.\.\/home-work-mutations\.js["']/)
  assert.match(homeSource, /export function renderHome\(\)/)
  assert.match(newSource, /export function renderNew\(\)/)
  assert.doesNotMatch(homeSource, /renderHome\([^)]*flags/)
  assert.doesNotMatch(newSource, /renderNew\([^)]*flags/)
})

test("the new-work chooser keeps the article action without the oversized RW decoration", async () => {
  const newSource = await readFile(new URL("../js/pages/new.js", import.meta.url), "utf8")

  assert.match(newSource, />互动文章</)
  assert.match(newSource, /id="articleForm"/)
  assert.doesNotMatch(newSource, />\s*RW\s*</)
})

test("work information can edit the description and an open card menu owns the top stacking layer", async () => {
  const [homeSource, stylesSource] = await Promise.all([
    readFile(new URL("../js/pages/home.js", import.meta.url), "utf8"),
    readFile(new URL("../css/styles.css", import.meta.url), "utf8"),
  ])

  assert.match(homeSource, /id=["']wiDesc["']/)
  assert.match(homeSource, /desc:\s*\(document\.getElementById\(["']wiDesc["']\)/)
  assert.match(homeSource, /classList\.toggle\(["']menu-open["']/)
  assert.match(stylesSource, /\.work-card\.menu-open\s*\{[^}]*z-index\s*:\s*60/s)
})
test("home exposes a compact author and reader local profile transfer", async () => {
  const source = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
  assert.match(source, /openLocalProfileTransfer\(\)/)
  assert.match(source, /serializeLocalProfile\(localStorage/)
  assert.match(source, /mergeLocalProfile\(localStorage/)
  assert.match(source, /整机搬家/)
})
