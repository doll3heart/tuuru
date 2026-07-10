import test from "node:test"
import assert from "node:assert/strict"

import {
  CURRENT_WORK_SCHEMA_VERSION,
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
