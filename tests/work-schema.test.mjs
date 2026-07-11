import test from "node:test"
import assert from "node:assert/strict"

import {
  CURRENT_WORK_SCHEMA_VERSION,
  validateAndNormalizeWork,
  validateWorkForImport,
} from "../js/work-schema.js"

test("legacy article works remain importable and receive defaults", () => {
  const result = validateWorkForImport({
    id: "legacy",
    type: "article",
    nodes: [{ id: "start", content: "Hello" }],
  })

  assert.equal(result.ok, true)
  assert.equal(result.sourceVersion, 0)
  assert.equal(result.migrated, true)
  assert.equal(result.work.schemaVersion, CURRENT_WORK_SCHEMA_VERSION)
  assert.equal(result.work.startNode, "start")
  assert.deepEqual(result.work.placeholders, [])
})

test("legacy phone works receive safe collection defaults", () => {
  const result = validateWorkForImport({
    type: "phone",
    phoneData: { contacts: [{ id: "contact-1" }] },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.work.phoneData.contacts, [{ id: "contact-1" }])
  assert.deepEqual(result.work.phoneData.chats, [])
  assert.deepEqual(result.work.phoneData.forumPosts, [])
})

test("current work versions remain unchanged", () => {
  const input = {
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "article",
    nodes: [],
    placeholders: [{ id: "name" }],
  }
  const result = validateWorkForImport(input)

  assert.equal(result.ok, true)
  assert.equal(result.migrated, false)
  assert.deepEqual(result.work.placeholders, input.placeholders)
})

test("newer work versions are rejected with an upgrade message", () => {
  const result = validateWorkForImport({
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION + 1,
    type: "article",
    nodes: [],
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "unsupported-version")
  assert.match(result.message, /升级阅读器/)
})

for (const input of [null, [], "work"]) {
  test(`non-object work input is rejected: ${JSON.stringify(input)}`, () => {
    assert.equal(validateWorkForImport(input).code, "invalid-work")
  })
}

test("invalid and unknown schema versions are rejected", () => {
  assert.equal(validateWorkForImport({ schemaVersion: "1", type: "article", nodes: [] }).code, "invalid-version")
  assert.equal(validateWorkForImport({ schemaVersion: -1, type: "article", nodes: [] }).code, "invalid-version")
})

test("unknown work types are rejected", () => {
  assert.equal(validateWorkForImport({ type: "video" }).code, "unsupported-type")
})

test("required type-specific structures are validated", () => {
  assert.equal(validateWorkForImport({ type: "article" }).code, "invalid-article")
  assert.equal(validateWorkForImport({ type: "phone" }).code, "invalid-phone")
})

test("missing legacy collections normalize without mutating source", () => {
  const input = {
    type: "article",
    nodes: [{ id: "start", content: "hello" }],
    futureField: { enabled: true },
  }
  const original = structuredClone(input)

  const result = validateAndNormalizeWork(input, { context: "reader-import", path: "$" })

  assert.equal(result.ok, true)
  assert.deepEqual(input, original)
  assert.deepEqual(result.work.nodes[0].choices, [])
  assert.deepEqual(result.work.chapters, [])
  assert.deepEqual(result.work.futureField, { enabled: true })
  assert.notEqual(result.work.futureField, input.futureField)
})

test("present wrong-typed article collections fail at a stable path", () => {
  const result = validateAndNormalizeWork({
    type: "article",
    nodes: [{ id: "start", choices: null }],
  }, { context: "reader-import", path: "$" })

  assert.equal(result.ok, false)
  assert.equal(result.code, "invalid-article")
  assert.equal(result.issues[0].code, "invalid-record-array")
  assert.equal(result.issues[0].path, "$.nodes[0].choices")
})

test("null and primitive collection entries fail without incidental throws", () => {
  for (const input of [
    { type: "article", nodes: [null] },
    { type: "article", nodes: [{ choices: ["bad"] }] },
    { type: "phone", phoneData: { contacts: [null] } },
    { type: "phone", phoneData: { chats: [{ messages: [7] }] } },
    { type: "phone", phoneData: { chats: [{ rounds: [{ messages: null }] }] } },
    { type: "phone", phoneData: { moments: [{ comments: [false] }] } },
    { type: "phone", phoneData: { forumPosts: [{ comments: {} }] } },
  ]) {
    const result = validateAndNormalizeWork(input, { context: "reader-import", path: "$" })
    assert.equal(result.ok, false)
    assert.ok(result.issues[0].path.startsWith("$"))
  }
})

test("local and backup contexts preserve unknown legacy work types", () => {
  const input = { id: "legacy", type: "legacy-tool", future: { value: 1 } }

  for (const context of ["local-database", "backup"]) {
    const result = validateAndNormalizeWork(input, { context, path: "$.works[0]" })
    assert.equal(result.ok, true)
    assert.deepEqual(result.work, input)
    assert.notEqual(result.work, input)
  }
  assert.equal(validateWorkForImport(input).code, "unsupported-type")
})

test("future schema versions fail in every context without downgrade", () => {
  const input = {
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION + 1,
    type: "article",
    nodes: [],
  }

  for (const context of ["reader-import", "local-database", "backup"]) {
    const result = validateAndNormalizeWork(input, { context, path: "$" })
    assert.equal(result.ok, false)
    assert.equal(result.code, "unsupported-version")
  }
  assert.equal(input.schemaVersion, CURRENT_WORK_SCHEMA_VERSION + 1)
})
