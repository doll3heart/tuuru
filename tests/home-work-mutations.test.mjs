import test from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_PHONE_SKIN,
  WORK_TYPE,
  avatarColor,
  createWorkRecord,
} from "../js/data.js"
import {
  createHomeWork,
  deleteHomeWork,
  duplicateHomeWork,
  requireVerifiedHomeMutation,
  updateHomeWorkInfo,
} from "../js/home-work-mutations.js"
import { createJsonToken } from "../js/local-database-mutation.js"
import { DATABASE_WRITE_LOCK_NAME, createWebLocksAdapter } from "../js/local-locks.js"
import { LOCAL_DATABASE_KEY } from "../js/storage.js"
import { openWorkEditSession } from "../js/work-edit-session.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

const PHONE_APP_TYPES = [
  "settings",
  "messages",
  "forum",
  "memo",
  "gallery",
  "browser",
  "shopping",
  "contacts",
]

function createScheduler() {
  let nextHandle = 1
  const active = new Set()
  return Object.freeze({
    setInterval() {
      const handle = nextHandle
      nextHandle += 1
      active.add(handle)
      return handle
    },
    clearInterval(handle) {
      active.delete(handle)
    },
    activeCount() {
      return active.size
    },
  })
}

function databaseWith(works = []) {
  return {
    works,
    contacts: [],
    groups: [],
    futureRoot: { preserved: true },
  }
}

function articleRecord({ id = "work-a", title = "原作", now = 100 } = {}) {
  const record = createWorkRecord({ type: WORK_TYPE.ARTICLE, title }, {
    workId: id,
    firstChapterId: `${id}-chapter`,
    firstNodeId: "start",
    firstSceneId: `${id}-scene`,
    colorSeedId: `${id}-color`,
    phoneAppIds: PHONE_APP_TYPES.map(type => `${id}-${type}`),
    now,
    updatedAt: now,
  })
  record.futureWork = { preserved: true }
  return JSON.parse(JSON.stringify(record))
}

function createIdProvider(overrides = {}) {
  const counts = new Map()
  const calls = []
  const queues = new Map(
    Object.entries(overrides).map(([kind, values]) => [kind, [...values]]),
  )
  function createId(kind) {
    calls.push(kind)
    const queue = queues.get(kind)
    if (queue?.length) return queue.shift()
    const count = (counts.get(kind) ?? 0) + 1
    counts.set(kind, count)
    return `${kind}-${count}`
  }
  return { calls, createId }
}

function createFixture({ database = databaseWith(), secure = true, locks = undefined } = {}) {
  const storage = createKeyedStorage([
    [LOCAL_DATABASE_KEY, JSON.stringify(database)],
    ["unrelated", "keep"],
  ])
  const nativeLocks = locks === undefined ? createFakeLockManager() : locks
  const lockManager = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: secure })
  const scheduler = createScheduler()
  const ids = createIdProvider({
    work: ["work-created"],
    operation: ["operation-created"],
    chapter: ["chapter-created"],
    node: ["start"],
    scene: ["scene-created"],
    color: ["color-created"],
    "phone-app": PHONE_APP_TYPES.map(type => `app-${type}`),
    owner: ["owner-created"],
    lease: ["lease-created"],
  })

  return {
    ids,
    lockManager,
    nativeLocks,
    scheduler,
    storage,
    dependencies(overrides = {}) {
      return {
        storage,
        lockManager,
        scheduler,
        now: () => 2_000,
        createId: ids.createId,
        ...overrides,
      }
    },
  }
}

function savedDatabase(fixture) {
  return JSON.parse(fixture.storage.peek(LOCAL_DATABASE_KEY))
}

function failSessionCleanupAfterCommit(fixture, cause) {
  const base = fixture.lockManager
  return Object.freeze({
    available: base.available,
    hold(...args) {
      return base.hold(...args)
    },
    request(name, options, callback) {
      if (
        name === DATABASE_WRITE_LOCK_NAME
        && fixture.storage.count("setItem", LOCAL_DATABASE_KEY) > 0
      ) {
        return Promise.reject(cause)
      }
      return base.request(name, options, callback)
    },
  })
}

test("exports the pure builder and four guarded home mutations", () => {
  assert.equal(typeof createWorkRecord, "function")
  assert.equal(typeof createHomeWork, "function")
  assert.equal(typeof updateHomeWorkInfo, "function")
  assert.equal(typeof duplicateHomeWork, "function")
  assert.equal(typeof deleteHomeWork, "function")
})

test("the UI success guard requires a real commit and action-specific work shape", () => {
  const work = articleRecord({ id: "work-a" })
  const database = databaseWith([work])
  const commit = {
    ok: true,
    operationId: "operation-a",
    raw: JSON.stringify(database),
    database,
    workToken: createJsonToken(work),
  }
  const saved = { ok: true, work, commit }
  const deleted = {
    ok: true,
    work: null,
    commit: { ...commit, workToken: createJsonToken(null) },
  }

  assert.equal(requireVerifiedHomeMutation(saved), saved)
  assert.equal(requireVerifiedHomeMutation(deleted, { expectDeleted: true }), deleted)
  for (const malformed of [
    { ok: true, work, commit: { ok: true } },
    { ok: true, work: undefined, commit },
    { ok: true, work: null, commit },
    { ok: true, work, commit: { ...commit, database: { works: [] } } },
  ]) {
    assert.throws(
      () => requireVerifiedHomeMutation(malformed),
      error => error?.code === "home-mutation-failed",
    )
  }
  assert.throws(
    () => requireVerifiedHomeMutation(saved, { expectDeleted: true }),
    error => error?.code === "home-mutation-failed",
  )
})

test("the pure builder reproduces article defaults from only prepared values", () => {
  const data = {
    type: WORK_TYPE.ARTICLE,
    title: "文章",
    desc: "描述",
    author: "作者",
    scenes: [],
    placeholders: [{ id: "placeholder-a", key: "name", future: "keep" }],
    ignoredFutureInput: "not copied",
  }
  const before = structuredClone(data)
  const ids = {
    workId: "article-a",
    firstChapterId: "chapter-a",
    firstNodeId: "start",
    firstSceneId: "scene-a",
    colorSeedId: "color-a",
    phoneAppIds: PHONE_APP_TYPES.map(type => `unused-${type}`),
    now: 100,
    updatedAt: 101,
  }

  const first = createWorkRecord(data, ids)
  const second = createWorkRecord(data, ids)

  assert.deepEqual(first, second)
  assert.deepEqual(data, before)
  assert.equal(first.id, "article-a")
  assert.equal(first.type, WORK_TYPE.ARTICLE)
  assert.equal(first.coverColor, avatarColor("color-a"))
  assert.equal(first.createdAt, 100)
  assert.equal(first.updatedAt, 101)
  assert.deepEqual(first.chapters, [{ id: "chapter-a", name: "第一章" }])
  assert.deepEqual(first.scenes, [{ id: "scene-a", name: "第一章" }])
  assert.deepEqual(first.nodes, [{
    id: "start",
    title: "开始",
    content: "",
    choices: [],
    scene: "scene-a",
    chapterId: "",
  }])
  assert.equal(first.startNode, "start")
  assert.deepEqual(first.phoneModules, [])
  assert.equal(first.phoneData, undefined)
  assert.equal(Object.hasOwn(first, "ignoredFutureInput"), false)
  assert.equal(first.placeholders[0].future, "keep")
})

test("the pure builder reproduces phone defaults with stable prepared App ids", () => {
  const phoneAppIds = PHONE_APP_TYPES.map(type => `phone-${type}`)
  const first = createWorkRecord({ type: WORK_TYPE.PHONE, title: "手机" }, {
    workId: "phone-a",
    firstChapterId: "phone-chapter",
    firstNodeId: "start",
    firstSceneId: "unused-scene",
    colorSeedId: "phone-color",
    phoneAppIds,
    now: 200,
  })
  const second = createWorkRecord({ type: WORK_TYPE.PHONE, title: "手机" }, {
    workId: "phone-a",
    firstChapterId: "phone-chapter",
    firstNodeId: "start",
    firstSceneId: "unused-scene",
    colorSeedId: "phone-color",
    phoneAppIds,
    now: 200,
  })

  assert.deepEqual(first, second)
  assert.deepEqual(first.nodes, [])
  assert.deepEqual(first.chapters, [{ id: "phone-chapter", name: "第一章" }])
  assert.equal(first.startNode, "start")
  assert.equal(first.phoneModules, undefined)
  assert.deepEqual(first.phoneData.apps.map(app => app.id), phoneAppIds)
  assert.deepEqual(first.phoneData.apps.map(app => app.type), PHONE_APP_TYPES)
  assert.deepEqual(first.phoneData.skin, DEFAULT_PHONE_SKIN)
  assert.notEqual(first.phoneData.skin, DEFAULT_PHONE_SKIN)
  assert.deepEqual(first.phoneData.contacts, [])
  assert.deepEqual(first.phoneData.shoppingItems, [])
})

test("create locks the prepared destination and performs one verified database write", async () => {
  const other = articleRecord({ id: "other", title: "保留" })
  const fixture = createFixture({ database: databaseWith([other]) })

  const result = await createHomeWork({
    type: WORK_TYPE.ARTICLE,
    title: "新作",
    futureInput: "ignored",
  }, fixture.dependencies())

  assert.equal(result.ok, true)
  assert.equal(result.work.id, "work-created")
  assert.equal(result.work.title, "新作")
  assert.equal(result.commit.ok, true)
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(fixture.storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  assert.deepEqual(savedDatabase(fixture).works.find(work => work.id === "other"), other)
  assert.deepEqual(savedDatabase(fixture).futureRoot, { preserved: true })
  assert.equal(fixture.scheduler.activeCount(), 0)
  assert.deepEqual(
    fixture.ids.calls.slice(0, 6),
    ["work", "operation", "chapter", "node", "scene", "color"],
  )
})

test("create snapshots nested prepared input before requesting the work session", async () => {
  const scenes = [{ id: "provided-scene", name: "Before", future: { kept: true } }]
  const placeholders = [{
    id: "placeholder-a",
    key: "name",
    label: "Name",
    prompt: "Enter a name",
    mode: "each",
    forbidden: [],
    values: ["before"],
    default: "",
  }]
  const fixture = createFixture({ database: databaseWith([]) })

  const pending = createHomeWork({
    type: WORK_TYPE.ARTICLE,
    title: "Snapshot",
    scenes,
    placeholders,
  }, fixture.dependencies())
  scenes[0].name = "After"
  scenes[0].future.kept = false
  scenes.push({ id: "late-scene", name: "Late" })
  placeholders[0].values[0] = "after"

  const result = await pending
  assert.deepEqual(result.work.scenes, [{
    id: "provided-scene",
    name: "Before",
    future: { kept: true },
  }])
  assert.deepEqual(result.work.placeholders[0].values, ["before"])
})

test("verified home commits remain successful when only session cleanup fails", async () => {
  const source = articleRecord({ id: "source" })
  const cases = [
    {
      name: "create",
      database: databaseWith([]),
      run: (fixture, dependencies) => createHomeWork(
        { type: WORK_TYPE.ARTICLE, title: "created" },
        dependencies,
      ),
    },
    {
      name: "update",
      database: databaseWith([source]),
      run: (fixture, dependencies) => updateHomeWorkInfo({
        workId: source.id,
        expectedWorkToken: createJsonToken(source),
        patch: { title: "updated" },
      }, dependencies),
    },
    {
      name: "duplicate",
      database: databaseWith([source]),
      run: (fixture, dependencies) => duplicateHomeWork(
        { workId: source.id },
        dependencies,
      ),
    },
    {
      name: "delete",
      database: databaseWith([source]),
      run: (fixture, dependencies) => deleteHomeWork({
        workId: source.id,
        expectedWorkToken: createJsonToken(source),
      }, dependencies),
    },
  ]

  for (const entry of cases) {
    const fixture = createFixture({ database: entry.database })
    const cleanupError = new Error(`${entry.name} cleanup failed`)
    const lockManager = failSessionCleanupAfterCommit(fixture, cleanupError)
    const result = await entry.run(fixture, fixture.dependencies({ lockManager }))

    assert.equal(result.ok, true, entry.name)
    assert.equal(result.commit.ok, true, entry.name)
    assert.equal(result.cleanupError, cleanupError, entry.name)
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1, entry.name)
  }
})

test("metadata update uses the confirmation token and preserves unknown fields", async () => {
  const source = articleRecord({ id: "work-a", title: "以前", now: 100 })
  source.desc = "不能由信息补丁改写"
  const other = articleRecord({ id: "other", title: "别的作品" })
  const fixture = createFixture({ database: databaseWith([source, other]) })

  const result = await updateHomeWorkInfo({
    workId: source.id,
    expectedWorkToken: createJsonToken(source),
    patch: {
      title: "以后",
      author: "作者",
      authorNote: "备注",
      password: "1234",
      locked: true,
      id: "must-not-change",
      desc: "must-not-change",
      futureWork: { overwritten: true },
    },
  }, fixture.dependencies())

  assert.equal(result.ok, true)
  assert.equal(result.work.id, "work-a")
  assert.equal(result.work.title, "以后")
  assert.equal(result.work.author, "作者")
  assert.equal(result.work.updatedAt, 2_000)
  assert.equal(result.work.desc, "不能由信息补丁改写")
  assert.deepEqual(result.work.futureWork, { preserved: true })
  assert.deepEqual(savedDatabase(fixture).works.find(work => work.id === "other"), other)
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1)
})

test("a stale metadata token rejects before the database write", async () => {
  const source = articleRecord({ id: "work-a" })
  const fixture = createFixture({ database: databaseWith([source]) })

  await assert.rejects(
    updateHomeWorkInfo({
      workId: source.id,
      expectedWorkToken: createJsonToken({ ...source, title: "旧快照" }),
      patch: { title: "不应写入" },
    }, fixture.dependencies()),
    error => error?.code === "mutation-conflict",
  )
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(savedDatabase(fixture).works[0].title, source.title)
})

test("missing update, duplicate, and delete targets fail closed without a database write", async () => {
  const missingSnapshot = articleRecord({ id: "missing" })

  for (const operation of [
    fixture => updateHomeWorkInfo({
      workId: "missing",
      expectedWorkToken: createJsonToken(missingSnapshot),
      patch: { title: "not written" },
    }, fixture.dependencies()),
    fixture => duplicateHomeWork({ workId: "missing" }, fixture.dependencies()),
    fixture => deleteHomeWork({
      workId: "missing",
      expectedWorkToken: createJsonToken(missingSnapshot),
    }, fixture.dependencies()),
  ]) {
    const fixture = createFixture({ database: databaseWith([]) })
    try {
      const result = await operation(fixture)
      assert.equal(result.ok, false)
      assert.equal(result.code, "work-missing")
    } catch (error) {
      assert.equal(error?.code, "mutation-conflict")
    }
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
    assert.deepEqual(savedDatabase(fixture).works, [])
  }
})

test("duplicate deep-clones the fresh source with one prepared destination id", async () => {
  const source = articleRecord({ id: "source", title: "原作" })
  source.futureWork = { nested: { kept: true } }
  const other = articleRecord({ id: "other", title: "别的作品" })
  const fixture = createFixture({ database: databaseWith([source, other]) })

  const result = await duplicateHomeWork({ workId: source.id }, fixture.dependencies())

  assert.equal(result.ok, true)
  assert.equal(result.work.id, "work-created")
  assert.equal(result.work.title, "原作 (副本)")
  assert.equal(result.work.createdAt, 2_000)
  assert.equal(result.work.updatedAt, 2_000)
  assert.deepEqual(result.work.futureWork, source.futureWork)
  assert.notEqual(result.work.futureWork, source.futureWork)
  assert.deepEqual(savedDatabase(fixture).works.find(work => work.id === "source"), source)
  assert.deepEqual(savedDatabase(fixture).works.find(work => work.id === "other"), other)
  assert.equal(savedDatabase(fixture).works.filter(work => work.id === "work-created").length, 1)
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1)
})

test("a prepared duplicate destination collision fails with zero database writes", async () => {
  const source = articleRecord({ id: "source" })
  const collision = articleRecord({ id: "work-created", title: "已存在" })
  const fixture = createFixture({ database: databaseWith([source, collision]) })

  await assert.rejects(
    duplicateHomeWork({ workId: source.id }, fixture.dependencies()),
    error => error?.code === "mutation-invalid" && error?.cause?.code === "home-work-id-collision",
  )
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.deepEqual(savedDatabase(fixture).works, [source, collision])
})

test("delete compares its confirmation token and removes only the selected work", async () => {
  const source = articleRecord({ id: "source" })
  const other = articleRecord({ id: "other" })
  const fixture = createFixture({ database: databaseWith([source, other]) })

  const result = await deleteHomeWork({
    workId: source.id,
    expectedWorkToken: createJsonToken(source),
  }, fixture.dependencies())

  assert.equal(result.ok, true)
  assert.equal(result.work, null)
  assert.deepEqual(savedDatabase(fixture).works, [other])
  assert.deepEqual(savedDatabase(fixture).futureRoot, { preserved: true })
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 1)
})

test("an active editor blocks update, duplicate, and delete with zero database writes", async t => {
  const source = articleRecord({ id: "source" })
  const fixture = createFixture({ database: databaseWith([source]) })
  const blocker = await openWorkEditSession({
    workId: source.id,
    storage: fixture.storage,
    lockManager: fixture.lockManager,
    scheduler: fixture.scheduler,
    now: () => 1_000,
    createId: kind => `blocker-${kind}`,
  })
  assert.equal(blocker.ok, true)
  t.after(() => blocker.session.dispose())

  const expectedWorkToken = createJsonToken(source)
  for (const operation of [
    () => updateHomeWorkInfo({
      workId: source.id,
      expectedWorkToken,
      patch: { title: "blocked" },
    }, fixture.dependencies()),
    () => duplicateHomeWork({ workId: source.id }, fixture.dependencies()),
    () => deleteHomeWork({ workId: source.id, expectedWorkToken }, fixture.dependencies()),
  ]) {
    const result = await operation()
    assert.equal(result.ok, false)
    assert.equal(result.code, "work-locked")
  }
  assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("missing or insecure Web Locks make every home mutation read-only", async () => {
  const source = articleRecord({ id: "source" })
  for (const lockCase of [
    { secure: false, locks: createFakeLockManager() },
    { secure: true, locks: null },
  ]) {
    for (const run of [
      fixture => createHomeWork({ type: WORK_TYPE.ARTICLE }, fixture.dependencies()),
      fixture => updateHomeWorkInfo({
        workId: source.id,
        expectedWorkToken: createJsonToken(source),
        patch: { title: "blocked" },
      }, fixture.dependencies()),
      fixture => duplicateHomeWork({ workId: source.id }, fixture.dependencies()),
      fixture => deleteHomeWork({
        workId: source.id,
        expectedWorkToken: createJsonToken(source),
      }, fixture.dependencies()),
    ]) {
      const fixture = createFixture({ database: databaseWith([source]), ...lockCase })
      const result = await run(fixture)
      assert.equal(result.ok, false)
      assert.equal(result.code, "mutation-lock-unavailable")
      assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY), 0)
      assert.deepEqual(fixture.storage.calls, [])
    }
  }
})
