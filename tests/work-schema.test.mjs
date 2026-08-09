import test from "node:test"
import assert from "node:assert/strict"

import {
  CURRENT_WORK_SCHEMA_VERSION,
  validateAndNormalizeWork,
  validateWorkForImport,
} from "../js/work-schema.js"
import { createWorkRelease } from "../js/work-release.js"

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
  assert.deepEqual(result.work.interactiveScenes, [])
})

test("reader imports preserve valid release identity and discard invalid metadata", () => {
  const source = {
    id: "release-work",
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "article",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    nodes: [{ id: "start", content: "Hello", choices: [], interactionGroups: [] }],
  }
  source.release = createWorkRelease(source, {
    exportedAt: "2026-07-28T00:00:00.000Z",
  })

  const valid = validateWorkForImport(source)
  assert.equal(valid.ok, true)
  assert.deepEqual(valid.work.release, source.release)

  const mismatched = validateWorkForImport({
    ...source,
    release: { ...source.release, workId: "another-work" },
  })
  assert.equal(mismatched.ok, true)
  assert.equal(mismatched.work.release, undefined)

  const malformed = validateWorkForImport({
    ...source,
    release: { ...source.release, revision: 0 },
  })
  assert.equal(malformed.ok, true)
  assert.equal(malformed.work.release, undefined)
})

test("article imports normalize interactive scene stages and hotspots", () => {
  const result = validateWorkForImport({
    type: "article",
    nodes: [{ id: "start", content: "Hello" }],
    interactiveScenes: [{
      id: "touch-1",
      nodeId: "start",
      stages: [{
        id: "stage-1",
        image: "https://example.test/hand.gif",
        hotspots: [{ id: "palm", trigger: "face-near", fallbackTrigger: "hold" }],
      }],
    }],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.interactiveScenes[0].startStageId, "stage-1")
  assert.equal(result.work.interactiveScenes[0].stages[0].hotspots[0].trigger, "face-near")
  assert.equal(result.work.interactiveScenes[0].stages[0].hotspots[0].fallbackTrigger, "hold")
  const interactiveNode = result.work.nodes.find(node => node.kind === "interactive-scene")
  assert.ok(interactiveNode)
  assert.equal(interactiveNode.interactiveSceneId, "touch-1")
  assert.equal(result.work.interactiveScenes[0].nodeId, interactiveNode.id)
})

test("standalone interactive works preserve their mode and normalize default BGM", () => {
  const result = validateWorkForImport({
    type:"article",
    experienceMode:"interactive",
    interactiveBgm:{ source:"https://example.test/default.mp3", volume:38, loop:false },
    nodes:[],
    interactiveScenes:[{ id:"scene-1", stages:[{ id:"stage-1" }] }],
  })
  assert.equal(result.ok, true)
  assert.equal(result.work.experienceMode, "interactive")
  assert.deepEqual(result.work.interactiveBgm, {
    source:"https://example.test/default.mp3",
    fileName:"",
    volume:38,
    loop:false,
    durationMs:0,
    bytes:0,
    startMs:0,
    endMs:null,
  })
  assert.deepEqual(result.work.interactiveScenes[0].stages[0].bgm, {
    source:"",
    fileName:"",
    volume:70,
    loop:true,
    durationMs:0,
    bytes:0,
    startMs:0,
    endMs:null,
  })
})

test("legacy inline interactive cards become chapter nodes during import", () => {
  const result = validateWorkForImport({
    type: "article",
    chapters: [{ id: "chapter-1", name: "第一章" }],
    nodes: [{
      id: "start",
      title: "开始",
      chapterId: "chapter-1",
      content: '<div class="interactive-scene-card" data-is-id="touch-1"><span>旧入口</span></div>',
    }],
    interactiveScenes: [{
      id: "touch-1",
      nodeId: "start",
      title: "掌心",
      stages: [{ id: "stage-1", hotspots: [] }],
    }],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.nodes.length, 1)
  assert.equal(result.work.nodes[0].kind, "interactive-scene")
  assert.equal(result.work.nodes[0].interactiveSceneId, "touch-1")
  assert.equal(result.work.nodes[0].content, "")
})

test("interactive scene nested collections reject invalid entries at stable paths", () => {
  const invalidStages = validateWorkForImport({
    type: "article",
    nodes: [],
    interactiveScenes: [{ id: "touch-1", stages: [null] }],
  })
  assert.equal(invalidStages.ok, false)
  assert.equal(invalidStages.issues[0].path, "$.interactiveScenes[0].stages[0]")

  const invalidHotspots = validateWorkForImport({
    type: "article",
    nodes: [],
    interactiveScenes: [{ id: "touch-1", stages: [{ id: "stage-1", hotspots: [false] }] }],
  })
  assert.equal(invalidHotspots.ok, false)
  assert.equal(invalidHotspots.issues[0].path, "$.interactiveScenes[0].stages[0].hotspots[0]")
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

test("version 3 ordinary choices migrate into a version 4 anchored interaction group", () => {
  const result = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [
      {
        id: "start",
        content: "Start",
        choices: [{ id: "choice-a", mode: "interaction", text: "Choose", targetId: "" }],
        futureNodeMetadata: { keep: true },
      },
      {
        id: "memory",
        kind: "conditional",
        content: "Memory",
        choices: [{ id: "must-be-removed" }],
        displayCondition: { all: [{ anyChoiceIds: ["choice-a", "choice-a", ""] }] },
        futureConditionalMetadata: { keep: true },
      },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.schemaVersion, 4)
  assert.deepEqual(result.work.nodes[0].choices, [])
  assert.equal(result.work.nodes[0].interactionGroups.length, 1)
  assert.deepEqual(result.work.nodes[0].interactionGroups[0].choices[0], {
    id: "choice-a", text: "Choose", selectedText: "Choose",
  })
  assert.equal(result.work.nodes[0].interactionGroups[0].legacyAdvanceOnSelect, true)
  assert.match(result.work.nodes[0].content, /data-article-interaction-group=/)
  assert.deepEqual(result.work.nodes[1].choices, [])
  assert.deepEqual(result.work.nodes[1].displayCondition, { all: [{ anyChoiceIds: ["choice-a"] }] })
  assert.deepEqual(result.work.nodes[1].futureConditionalMetadata, { keep: true })
  assert.deepEqual(result.work.nodes[0].futureNodeMetadata, { keep: true })
})

test("version 3 mixed choices preserve branch targets and ordinary stable ids separately", () => {
  const result = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    chapters: [{id:"chapter-a", name:"第一章"}],
    nodes: [
      {
        id:"start",
        chapterId:"chapter-a",
        content:"<p>正文</p>",
        choices:[
          {id:"ordinary-a", mode:"interaction", text:"点头", selectedText:"你点了点头。", targetId:"", extra:{keep:true}},
          {id:"branch-a", text:"离开", targetId:"target", extra:{keep:true}},
        ],
      },
      {id:"target", chapterId:"chapter-a", content:"<p>后续</p>", choices:[]},
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.schemaVersion, 4)
  assert.deepEqual(result.work.nodes[0].choices, [
    {id:"branch-a", text:"离开", targetId:"target", extra:{keep:true}},
  ])
  assert.equal(result.work.nodes[0].interactionGroups[0].choices[0].id, "ordinary-a")
  assert.deepEqual(result.work.nodes[0].interactionGroups[0].choices[0].extra, {keep:true})
  assert.equal(result.work.nodes[0].interactionGroups[0].legacyAdvanceOnSelect, true)
})

test("version 4 rejects interaction groups on hidden and interactive-scene nodes", () => {
  for (const node of [
    {
      id:"hidden",
      kind:"conditional",
      displayCondition:{all:[{anyChoiceIds:["choice-a"]}]},
      interactionGroups:[{id:"group-a", choices:[{id:"choice-a", text:"A"}]}],
    },
    {
      id:"scene",
      kind:"interactive-scene",
      interactiveSceneId:"scene-a",
      interactionGroups:[{id:"group-a", choices:[{id:"choice-a", text:"A"}]}],
    },
  ]) {
    const result = validateWorkForImport({
      schemaVersion: 4,
      type:"article",
      nodes:[node],
      interactiveScenes:node.kind === "interactive-scene"
        ? [{id:"scene-a", nodeId:"scene", stages:[]}]
        : [],
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, "invalid-article")
  }
})

test("version 2 quarantines conditional-shaped unknown kinds without overwriting metadata", () => {
  const fixtures = [
    { name: "string", metadata: "keep this string" },
    { name: "array", metadata: ["keep", { nested: true }] },
    { name: "object", metadata: { keep: { nested: true } } },
    { name: "primitive", metadata: false },
    { name: "quarantine-key collision", metadata: "keep", quarantineCollision: "existing" },
  ]

  for (const fixture of fixtures) {
    const input = {
      schemaVersion: 2,
      type: "article",
      nodes: [{
        id: "legacy-node",
        kind: "conditional",
        content: "Legacy unknown kind",
        choices: [{ id: "legacy-choice", text: "Keep", targetId: "" }],
        displayCondition: { all: [{ anyChoiceIds: ["legacy-choice", "legacy-choice", ""] }] },
        legacySchemaV2: fixture.metadata,
        ...(fixture.quarantineCollision === undefined ? {} : {
          __legacyConditionalKindV2: fixture.quarantineCollision,
        }),
      }],
    }

    const first = validateWorkForImport(input)

    assert.equal(first.ok, true, fixture.name)
    assert.equal(first.work.schemaVersion, 4, fixture.name)
    assert.equal(Object.hasOwn(first.work.nodes[0], "kind"), false, fixture.name)
    assert.deepEqual(first.work.nodes[0].legacySchemaV2, fixture.metadata, fixture.name)
    assert.deepEqual(first.work.nodes[0].choices, input.nodes[0].choices, fixture.name)
    assert.deepEqual(first.work.nodes[0].displayCondition, input.nodes[0].displayCondition, fixture.name)
    const quarantineKeys = Object.keys(first.work.nodes[0]).filter(key => (
      (key === "__legacyConditionalKindV2" || /^__legacyConditionalKindV2_\d+$/.test(key))
      && first.work.nodes[0][key] === "conditional"
    ))
    assert.equal(quarantineKeys.length, 1, fixture.name)
    const quarantineKey = quarantineKeys[0]
    if (fixture.quarantineCollision !== undefined) {
      assert.equal(first.work.nodes[0].__legacyConditionalKindV2, fixture.quarantineCollision)
      assert.equal(quarantineKey, "__legacyConditionalKindV2_2")
    }

    const second = validateWorkForImport(first.work)
    assert.equal(second.ok, true, fixture.name)
    assert.deepEqual(second.work, first.work, fixture.name)
  }
})

test("legacy manual starts are canonicalized while conditional branch targets remain invalid", () => {
  const startResult = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    startNode: "memory",
    nodes: [
      { id: "memory", kind: "conditional", choices: [] },
      { id: "ordinary", choices: [] },
    ],
  })
  assert.equal(startResult.ok, true)
  assert.equal(startResult.work.startNode, "ordinary")

  const targetResult = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [
      { id: "start", choices: [{ id: "branch", text: "Go", targetId: "memory" }] },
      { id: "memory", kind: "conditional", choices: [] },
    ],
  })
  assert.equal(targetResult.ok, false)
  assert.equal(targetResult.issues[0].path, "$.nodes[0].choices[0].targetId")
})

test("version 3 rejects authored conditional scene hybrids before interactive-scene migration", () => {
  const result = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [{ id: "start", choices: [{ id: "go", text: "Go", targetId: "memory" }] }, {
      id: "memory",
      kind: "conditional",
      interactiveSceneId: "scene-a",
      content: "",
      choices: [],
    }],
    interactiveScenes: [{ id: "scene-a", nodeId: "memory", stages: [{ id: "stage-a", hotspots: [] }] }],
  })

  assert.equal(result.ok, false)
  assert.equal(result.issues[0].path, "$.nodes[1].interactiveSceneId")
})

test("version 3 canonicalizes explicit interactive-scene node links before conditional validation", () => {
  for (const nodeId of [" memory ", "\tmemory\n"]) {
    const result = validateWorkForImport({
      schemaVersion: 3,
      type: "article",
      nodes: [{ id: "start", choices: [] }, {
        id: "memory",
        kind: "conditional",
        content: "",
        choices: [],
      }],
      interactiveScenes: [{ id: "scene-a", nodeId, stages: [{ id: "stage-a", hotspots: [] }] }],
    })

    assert.equal(result.ok, false, JSON.stringify(nodeId))
    assert.equal(result.issues[0].path, "$.interactiveScenes[0].nodeId")
  }
})

test("version 3 canonicalizes numeric conditional starts but rejects branch and scene references", () => {
  const startResult = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    startNode: "123",
    nodes: [{ id: 123, kind: "conditional", choices: [] }, { id: "ordinary", choices: [] }],
  })
  assert.equal(startResult.ok, true)
  assert.equal(startResult.work.startNode, "ordinary")

  const branchResult = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [
      { id: "start", choices: [{ id: "go", text: "Go", targetId: "123" }] },
      { id: 123, kind: "conditional", choices: [] },
    ],
  })
  assert.equal(branchResult.ok, false)
  assert.equal(branchResult.issues[0].path, "$.nodes[0].choices[0].targetId")

  const sceneResult = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [{ id: "start", choices: [] }, { id: 123, kind: "conditional", choices: [] }],
    interactiveScenes: [{ id: "scene-a", nodeId: "123", stages: [{ id: "stage-a", hotspots: [] }] }],
  })
  assert.equal(sceneResult.ok, false)
  assert.equal(sceneResult.issues[0].path, "$.interactiveScenes[0].nodeId")
})

test("version 3 rejects a conditional node that owns a legacy inline interactive-scene card", () => {
  const result = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    nodes: [{ id: "start", choices: [] }, {
      id: "memory",
      kind: "conditional",
      content: '<div class="interactive-scene-card" data-is-id="scene-a"><span>Legacy</span></div>',
      choices: [],
    }],
    interactiveScenes: [{ id: "scene-a", stages: [{ id: "stage-a", hotspots: [] }] }],
  })

  assert.equal(result.ok, false)
  assert.equal(result.issues[0].path, "$.nodes[1].content")
})

test("version 3 detects normalized fallback IDs for conditional legacy inline cards", () => {
  for (const scene of [
    { stages: [{ id: "stage-a", hotspots: [] }] },
    { id: "", stages: [{ id: "stage-a", hotspots: [] }] },
  ]) {
    const result = validateWorkForImport({
      schemaVersion: 3,
      type: "article",
      nodes: [{ id: "start", choices: [] }, {
        id: "memory",
        kind: "conditional",
        content: '<div class="interactive-scene-card" data-is-id="interactive-scene"><span>Legacy</span></div>',
        choices: [],
      }],
      interactiveScenes: [scene],
    })

    assert.equal(result.ok, false)
    assert.equal(result.issues[0].path, "$.nodes[1].content")
  }
})

test("dangling starts repair to the first ordinary node rather than a leading conditional", () => {
  const result = validateWorkForImport({
    schemaVersion: 3,
    type: "article",
    startNode: "missing",
    nodes: [
      { id: "memory", kind: "conditional", choices: [] },
      { id: "ordinary", choices: [] },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.startNode, "ordinary")
})

test("version 1 articles move legacy ungrouped nodes into the first chapter after its authored nodes", () => {
  const result = validateWorkForImport({
    schemaVersion: 1,
    type: "article",
    startNode: "new-node",
    chapters: [{ id: "chapter-one", name: "111" }],
    nodes: [
      { id: "start", title: "开始", chapterId: "", content: "222", choices: [] },
      { id: "new-node", title: "新节点", chapterId: "chapter-one", content: "111", choices: [] },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.migrated, true)
  assert.deepEqual(
    result.work.nodes.map(node => [node.id, node.chapterId]),
    [
      ["new-node", "chapter-one"],
      ["start", "chapter-one"],
    ],
  )
  assert.equal(result.work.startNode, "new-node")
})

test("article normalization makes the sole node the start node", () => {
  const result = validateWorkForImport({
    type: "article",
    startNode: "",
    nodes: [{
      id: "interactive-node",
      kind: "interactive-scene",
      interactiveSceneId: "scene-a",
      content: "",
    }],
    interactiveScenes: [{
      id: "scene-a",
      nodeId: "interactive-node",
      stages: [{ id: "stage-a", hotspots: [] }],
    }],
  })

  assert.equal(result.ok, true)
  assert.equal(result.work.startNode, "interactive-node")
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
