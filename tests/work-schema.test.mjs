import test from "node:test"
import assert from "node:assert/strict"

import {
  CURRENT_WORK_SCHEMA_VERSION,
  validateAndNormalizeWork,
  validateWorkForImport,
} from "../js/work-schema.js"

const VALIDATION_CONTEXTS = ["reader-import", "local-database", "backup"]

function nestedUnknownField(depth) {
  let value = { leaf: true }
  for (let index = 0; index < depth; index += 1) value = { child: value }
  return value
}

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

test("article normalization repairs a dangling start node to the first valid node", () => {
  const result = validateWorkForImport({
    type: "article",
    startNode: "deleted-node",
    nodes: [
      { id: "node-a", content: "A" },
      { id: "node-b", content: "B" },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.startNode, "node-a")
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

test("phone imports preserve authored character connection metadata", () => {
  const appConnections = {
    memo: { contactId: "contact-1", prompt: "A signal from the train station." },
  }
  const result = validateWorkForImport({
    type: "phone",
    phoneData: {
      contacts: [{ id: "contact-1" }],
      appConnections,
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.work.phoneData.appConnections, appConnections)
  assert.notEqual(result.work.phoneData.appConnections, appConnections)
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

for (const { name, input, path } of [
  {
    name: "chat contactIds must be an array",
    input: { type: "phone", phoneData: { chats: [{ contactIds: {} }] } },
    path: "$.phoneData.chats[0].contactIds",
  },
  {
    name: "moment images must be an array",
    input: { type: "phone", phoneData: { moments: [{ images: {} }] } },
    path: "$.phoneData.moments[0].images",
  },
  {
    name: "forum post images must be an array",
    input: { type: "phone", phoneData: { forumPosts: [{ images: "bad" }] } },
    path: "$.phoneData.forumPosts[0].images",
  },
  {
    name: "message choices must be an array",
    input: { type: "phone", phoneData: { chats: [{ messages: [{ choices: {} }] }] } },
    path: "$.phoneData.chats[0].messages[0].choices",
  },
  {
    name: "message choices must contain records",
    input: { type: "phone", phoneData: { chats: [{ messages: [{ choices: [null] }] }] } },
    path: "$.phoneData.chats[0].messages[0].choices[0]",
  },
  {
    name: "round message choices must contain records",
    input: { type: "phone", phoneData: { chats: [{ rounds: [{ messages: [{ choices: [false] }] }] }] } },
    path: "$.phoneData.chats[0].rounds[0].messages[0].choices[0]",
  },
  {
    name: "choice follow-ups must be an array",
    input: { type: "phone", phoneData: { chats: [{ messages: [{ choices: [{ followUpMessages: {} }] }] }] } },
    path: "$.phoneData.chats[0].messages[0].choices[0].followUpMessages",
  },
  {
    name: "choice follow-ups must contain records",
    input: { type: "phone", phoneData: { chats: [{ messages: [{ choices: [{ followUpMessages: [null] }] }] }] } },
    path: "$.phoneData.chats[0].messages[0].choices[0].followUpMessages[0]",
  },
  {
    name: "moment comment choices must be an array",
    input: { type: "phone", phoneData: { moments: [{ comments: [{ choices: {} }] }] } },
    path: "$.phoneData.moments[0].comments[0].choices",
  },
  {
    name: "moment comment choices must contain records",
    input: { type: "phone", phoneData: { moments: [{ comments: [{ choices: [null] }] }] } },
    path: "$.phoneData.moments[0].comments[0].choices[0]",
  },
  {
    name: "moment choice follow-ups must be an array",
    input: { type: "phone", phoneData: { moments: [{ comments: [{ choices: [{ followUpMessages: false }] }] }] } },
    path: "$.phoneData.moments[0].comments[0].choices[0].followUpMessages",
  },
  {
    name: "moment choice follow-ups must contain records",
    input: { type: "phone", phoneData: { moments: [{ comments: [{ choices: [{ followUpMessages: [7] }] }] }] } },
    path: "$.phoneData.moments[0].comments[0].choices[0].followUpMessages[0]",
  },
  {
    name: "forum comment choices must be an array",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ choices: {} }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].choices",
  },
  {
    name: "forum comment choices must contain records",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ choices: [null] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].choices[0]",
  },
  {
    name: "forum choice follow-ups must be an array",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ choices: [{ followUpMessages: false }] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].choices[0].followUpMessages",
  },
  {
    name: "forum choice follow-ups must contain records",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ choices: [{ followUpMessages: [7] }] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].choices[0].followUpMessages[0]",
  },
  {
    name: "forum comment replies must be an array",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ replies: {} }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].replies",
  },
  {
    name: "forum comment replies must contain records",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ replies: [null] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].replies[0]",
  },
  {
    name: "nested forum reply choices must be arrays",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ replies: [{ choices: {} }] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].replies[0].choices",
  },
  {
    name: "nested forum replies must contain records",
    input: { type: "phone", phoneData: { forumPosts: [{ comments: [{ replies: [{ replies: [null] }] }] }] } },
    path: "$.phoneData.forumPosts[0].comments[0].replies[0].replies[0]",
  },
  {
    name: "article phone-module data uses phone collection validation",
    input: { type: "article", nodes: [], phoneModules: [{ data: { contacts: {} } }] },
    path: "$.phoneModules[0].data.contacts",
  },
]) {
  test(`${name} in every validation context`, () => {
    for (const context of VALIDATION_CONTEXTS) {
      const result = validateAndNormalizeWork(input, { context, path: "$" })
      assert.equal(result.ok, false, `${context} accepted an unsafe collection`)
      assert.equal(result.issues[0].path, path)
    }
  })
}

test("valid renderer collections and nested defaults normalize in every context", () => {
  const input = {
    type: "phone",
    phoneData: {
      chats: [{
        contactIds: ["contact-1"],
        messages: [{ choices: [{ followUpMessages: [{ text: "later", future: true }] }] }],
        rounds: [{ messages: [{ choices: [{ followUpMessages: [] }] }] }],
      }],
      moments: [{
        images: ["moment.png"],
        comments: [{ choices: [{ followUpMessages: [{ text: "reply" }] }] }],
      }],
      forumPosts: [{
        images: ["post.png"],
        comments: [{
          choices: [{
            id: "forum-choice-1",
            text: "Answer plainly",
            futureChoiceMetadata: { preserved: true },
            followUpMessages: [{
              id: "forum-follow-up-1",
              content: "nested follow-up",
              futureFollowUpMetadata: true,
            }],
          }],
          replies: [{ content: "nested" }],
        }],
      }],
    },
  }
  const original = structuredClone(input)

  for (const context of VALIDATION_CONTEXTS) {
    const result = validateAndNormalizeWork(input, { context, path: "$" })
    assert.equal(result.ok, true)
    assert.deepEqual(result.work.phoneData.chats[0].contactIds, ["contact-1"])
    assert.equal(result.work.phoneData.chats[0].messages[0].choices[0].followUpMessages[0].future, true)
    assert.deepEqual(result.work.phoneData.moments[0].images, ["moment.png"])
    assert.deepEqual(result.work.phoneData.forumPosts[0].images, ["post.png"])
    const forumComment = result.work.phoneData.forumPosts[0].comments[0]
    assert.equal(forumComment.choices[0].id, "forum-choice-1")
    assert.deepEqual(forumComment.choices[0].futureChoiceMetadata, { preserved: true })
    assert.equal(forumComment.choices[0].followUpMessages[0].id, "forum-follow-up-1")
    assert.equal(forumComment.choices[0].followUpMessages[0].futureFollowUpMetadata, true)
    assert.equal(forumComment.replies[0].content, "nested")
  }
  assert.deepEqual(input, original)
})

test("missing renderer collections retain nested empty-array defaults", () => {
  const result = validateWorkForImport({
    type: "phone",
    phoneData: {
      chats: [{ messages: [{}], rounds: [{ messages: [{}] }] }],
      moments: [{ comments: [{ choices: [{}] }] }],
      forumPosts: [{ comments: [{}] }],
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.work.phoneData.chats[0].contactIds, [])
  assert.deepEqual(result.work.phoneData.chats[0].messages[0].choices, [])
  assert.deepEqual(result.work.phoneData.chats[0].rounds[0].messages[0].choices, [])
  assert.deepEqual(result.work.phoneData.moments[0].images, [])
  assert.deepEqual(result.work.phoneData.moments[0].comments[0].choices[0].followUpMessages, [])
  assert.deepEqual(result.work.phoneData.forumPosts[0].images, [])
  assert.deepEqual(result.work.phoneData.forumPosts[0].comments[0].choices, [])
  assert.deepEqual(result.work.phoneData.forumPosts[0].comments[0].replies, [])
})

test("defined article phone-module data shares phone normalization while absent data remains absent", () => {
  const result = validateWorkForImport({
    type: "article",
    nodes: [],
    phoneModules: [
      { id: "defined", data: { contacts: [{ id: "contact-1" }], chats: [{}], future: true } },
      { id: "absent" },
    ],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.work.phoneModules[0].data.contacts, [{ id: "contact-1" }])
  assert.deepEqual(result.work.phoneModules[0].data.chats[0].contactIds, [])
  assert.deepEqual(result.work.phoneModules[0].data.moments, [])
  assert.equal(result.work.phoneModules[0].data.future, true)
  assert.equal(Object.hasOwn(result.work.phoneModules[1], "data"), false)
})

for (const { name, createInput } of [
  {
    name: "excessive nesting",
    createInput: () => ({ type: "article", nodes: [], future: nestedUnknownField(5000) }),
  },
  {
    name: "cyclic data",
    createInput: () => {
      const input = { type: "article", nodes: [] }
      input.future = input
      return input
    },
  },
  {
    name: "uninspectable data",
    createInput: () => {
      const input = { type: "article", nodes: [] }
      Object.defineProperty(input, "future", {
        enumerable: true,
        get() { throw new Error("hostile getter") },
      })
      return input
    },
  },
]) {
  test(`public validation fails closed for ${name}`, () => {
    let result
    assert.doesNotThrow(() => {
      result = validateWorkForImport(createInput())
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, "invalid-work")
    assert.equal(result.issues[0].code, "invalid-nesting")
  })
}
