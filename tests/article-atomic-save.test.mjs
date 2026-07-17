import assert from "node:assert/strict"
import test from "node:test"

import { createArticleSaveAdapter } from "../js/article-save-adapter.js"
import { createWebLocksAdapter } from "../js/local-locks.js"
import { LOCAL_DATABASE_KEY } from "../js/storage.js"
import { openWorkSaveRuntime } from "../js/work-save-runtime.js"
import { createFakeLockManager } from "./helpers/fake-lock-manager.mjs"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

function createScheduler() {
  let nextHandle = 0
  const intervals = new Map()
  const timeouts = new Map()
  return {
    setInterval(callback, delay) {
      nextHandle += 1
      intervals.set(nextHandle, { callback, delay })
      return nextHandle
    },
    clearInterval(handle) {
      intervals.delete(handle)
    },
    setTimeout(callback, delay) {
      nextHandle += 1
      timeouts.set(nextHandle, { callback, delay })
      return nextHandle
    },
    clearTimeout(handle) {
      timeouts.delete(handle)
    },
  }
}

function node(id, content, overrides = {}) {
  return {
    id,
    title: id,
    content,
    choices: [],
    scene: "",
    chapterId: "chapter-a",
    futureNode: { keep: id },
    ...overrides,
  }
}

function articleWork(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "work-a",
    type: "article",
    title: "Atomic article",
    createdAt: 10,
    updatedAt: 20,
    startNode: "node-a",
    chapters: [{ id: "chapter-a", name: "Chapter" }],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    nodes: [node("node-a", "<p>verified body</p>")],
    futureWork: { keep: true },
    ...overrides,
  }
}

async function openFixture(work) {
  const nativeLocks = createFakeLockManager()
  const lockManager = createWebLocksAdapter({ locks: nativeLocks, isSecureContext: true })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify({
    works: [work],
    contacts: [],
    groups: [],
  })]])
  const scheduler = createScheduler()
  let runtimeSequence = 0
  const opened = await openWorkSaveRuntime({
    workId: "work-a",
    storage,
    lockManager,
    scheduler,
    now: () => 5_000,
    createId(kind) {
      runtimeSequence += 1
      return `${kind}-runtime-${runtimeSequence}`
    },
  })
  assert.equal(opened.ok, true)
  let adapterSequence = 0
  const adapter = createArticleSaveAdapter({
    runtime: opened.runtime,
    createId(kind) {
      adapterSequence += 1
      return `${kind}-adapter-${adapterSequence}`
    },
    now() {
      throw new Error("adapter now must remain unused")
    },
  })
  return { adapter, nativeLocks, runtime: opened.runtime, storage }
}

function storedWork(storage) {
  return JSON.parse(storage.peek(LOCAL_DATABASE_KEY)).works.find(work => work.id === "work-a")
}

test("pending body and phone module save land in one verified database commit", async () => {
  const fixture = await openFixture(articleWork())
  const stagedContent = '<p>before cursor</p><div class="pm-inline-card selected" data-pm-id="module-a" data-pm-type="old"><span>Memo</span></div><p>after cursor</p>'
  const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)
  try {
    fixture.adapter.stageNodeContent("node-a", stagedContent)
    const verifiedPromise = fixture.adapter.savePhoneModuleCard({
      moduleId: "module-a",
      nodeId: "node-a",
      type: "memo",
      data: { memos: [{ id: "memo-a", text: "atomic" }] },
    })
    const verified = await verifiedPromise

    assert.equal(verified.ok, true)
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 1)
    const saved = storedWork(fixture.storage)
    assert.equal(saved.updatedAt, 5_000)
    assert.equal(saved.nodes[0].content, stagedContent.replace('data-pm-type="old"', 'data-pm-type="memo"'))
    assert.deepEqual(saved.nodes[0].futureNode, { keep: "node-a" })
    assert.equal(saved.phoneModules.length, 1)
    assert.equal(saved.phoneModules[0].id, "module-a")
    assert.equal(saved.phoneModules[0].nodeId, "node-a")
    assert.equal(saved.phoneModules[0].type, "memo")
    assert.equal(saved.phoneModules[0].data.memos[0].text, "atomic")
    assert.deepEqual(saved.futureWork, { keep: true })
  } finally {
    await fixture.runtime.dispose()
  }
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("pending body removal and phone module delete land in one verified database commit", async () => {
  const card = '<div class="pm-inline-card" data-pm-id="module-a" data-pm-type="memo"><span>Memo</span></div>'
  const fixture = await openFixture(articleWork({
    phoneModules: [{
      id: "module-a",
      type: "memo",
      nodeId: "node-a",
      data: { memos: [{ id: "memo-a", text: "remove" }] },
      futureModule: { keep: true },
    }],
    nodes: [node("node-a", `<p>before</p>${card}<p>after</p>`) ],
  }))
  const stagedContent = "<p>body field already removed the card</p>"
  const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)
  try {
    fixture.adapter.stageNodeContent("node-a", stagedContent)
    const verified = await fixture.adapter.deletePhoneModuleCard({
      moduleId: "module-a",
      nodeId: "node-a",
    })

    assert.equal(verified.ok, true)
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 1)
    const saved = storedWork(fixture.storage)
    assert.equal(saved.nodes[0].content, stagedContent)
    assert.deepEqual(saved.phoneModules, [])
    assert.equal(saved.updatedAt, 5_000)
  } finally {
    await fixture.runtime.dispose()
  }
  assert.deepEqual(fixture.nativeLocks.snapshot(), { held: [], pending: [] })
})

test("horizontal-rule deletion is represented by one real node content field operation", () => {
  const staged = []
  const runtime = {
    stage(input) {
      staged.push(input)
      return Object.freeze({ id: "field-a", ...input })
    },
    commitNow() {
      throw new Error("horizontal-rule content is not structural")
    },
  }
  const adapter = createArticleSaveAdapter({
    runtime,
    createId: () => "unused",
    now: () => {
      throw new Error("unused")
    },
  })
  const content = "<p>before</p><p>after</p>"
  const operation = adapter.updateNode("node-a", { content })

  assert.equal(staged.length, 1)
  assert.equal(operation, staged[0] === undefined ? null : operation)
  assert.equal(staged[0].key, "node:node-a:fields:content")
  assert.equal(Object.hasOwn(staged[0], "correctsOperationId"), false)
  const result = staged[0].apply(articleWork({
    nodes: [node("node-a", "<p>before</p><hr><p>after</p>")],
  }), staged[0].payload)
  assert.equal(result.nodes[0].content, content)
})

test("candidate-domain errors cross the atomic boundary as mutation-invalid causes", async () => {
  const fixture = await openFixture(articleWork())
  const writesBefore = fixture.storage.count("setItem", LOCAL_DATABASE_KEY)
  try {
    await assert.rejects(
      fixture.adapter.deleteNode("missing-node"),
      error => error?.code === "mutation-invalid"
        && error?.cause?.code === "article-save-invalid"
        && error?.cause?.details?.reason === "node-not-found",
    )
    assert.equal(fixture.storage.count("setItem", LOCAL_DATABASE_KEY) - writesBefore, 0)
    const material = fixture.runtime.recoveryMaterial()
    assert.equal(material.kind, "ordinary")
    assert.equal(material.correctableOperationIds.length, 1)
    const exact = material.pendingOperations.find(
      operation => operation.id === material.correctableOperationIds[0],
    )
    assert.equal(exact?.key, "node:missing-node:delete")
  } finally {
    await fixture.runtime.dispose()
  }
})
