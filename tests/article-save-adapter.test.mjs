import assert from "node:assert/strict"
import test from "node:test"

import {
  ArticleSaveAdapterError,
  createArticleSaveAdapter,
} from "../js/article-save-adapter.js"

function createRecordingRuntime({ recoveryMaterial = null, onStage, onCommitNow } = {}) {
  const stageInputs = []
  const stageResults = []
  const commitInputs = []
  const commitResults = []
  let recoveryReads = 0

  const runtime = {
    stage(input) {
      onStage?.(input)
      stageInputs.push(input)
      const result = Object.freeze({
        id: `field-${stageInputs.length}`,
        key: input.key,
        kind: "field",
        payload: input.payload,
        apply: input.apply,
      })
      stageResults.push(result)
      return result
    },
    commitNow(input) {
      onCommitNow?.(input)
      commitInputs.push(input)
      const result = Promise.resolve(Object.freeze({
        ok: true,
        operationId: `commit-${commitInputs.length}`,
      }))
      commitResults.push(result)
      return result
    },
    recoveryMaterial() {
      recoveryReads += 1
      return recoveryMaterial
    },
  }

  return {
    runtime,
    stageInputs,
    stageResults,
    commitInputs,
    commitResults,
    recoveryReads: () => recoveryReads,
  }
}

function createHarness(options = {}) {
  const ids = []
  let sequence = 0
  let nowReads = 0
  const recording = createRecordingRuntime(options)
  const adapter = createArticleSaveAdapter({
    runtime: recording.runtime,
    createId(kind) {
      sequence += 1
      ids.push(kind)
      return `${kind}-prepared-${sequence}`
    },
    now() {
      nowReads += 1
      throw new Error("the article adapter must not read time")
    },
  })
  return {
    ...recording,
    adapter,
    allocatedKinds: ids,
    nowReads: () => nowReads,
  }
}

function articleWork(overrides = {}) {
  return {
    id: "work-a",
    type: "article",
    title: "Before",
    createdAt: 1,
    updatedAt: 2,
    futureWork: { keep: true },
    startNode: "node-a",
    chapters: [
      { id: "chapter-a", name: "A", futureChapter: "keep-a" },
      { id: "chapter-b", name: "B", futureChapter: "keep-b" },
    ],
    scenes: [{ id: "scene-a", name: "Scene A", futureScene: true }],
    placeholders: [{
      id: "placeholder-a",
      key: "name",
      label: "Name",
      futurePlaceholder: { keep: true },
    }],
    phoneModules: [],
    nodes: [
      {
        id: "node-a",
        title: "Node A",
        content: "<p>A</p>",
        choices: [],
        scene: "scene-a",
        chapterId: "chapter-a",
        futureNode: { keep: "a" },
      },
      {
        id: "node-b",
        title: "Node B",
        content: "<p>B</p>",
        choices: [],
        scene: "",
        chapterId: "chapter-b",
        futureNode: { keep: "b" },
      },
    ],
    ...overrides,
  }
}

function applyEnvelope(envelope, work) {
  return envelope.apply(structuredClone(work), envelope.payload)
}

function assertInvalid(action, reason, expectedDetails = {}) {
  assert.throws(action, error => {
    assert.equal(error instanceof ArticleSaveAdapterError, true)
    assert.equal(error.name, "ArticleSaveAdapterError")
    assert.equal(error.code, "article-save-invalid")
    assert.equal(error.details.reason, reason)
    assert.equal(Object.isFrozen(error.details), true)
    for (const [key, value] of Object.entries(expectedDetails)) {
      assert.deepEqual(error.details[key], value)
    }
    return true
  })
}

test("public methods select the required runtime boundary, stable key, and return value", () => {
  const harness = createHarness()
  const { adapter } = harness

  const staged = [
    adapter.stageNodeContent("node/1", "<p>body</p>"),
    adapter.updateWorkFields({ title: "Title", "future field": true }, {}),
    adapter.updateNode("node/1", { title: "Node", content: "<hr>" }),
    adapter.updateChapter("chapter/1", { name: "Chapter" }),
    adapter.updatePlaceholder("placeholder/1", { label: "Placeholder" }),
  ]
  const committed = [
    adapter.addNode({ afterId: "node/0", nodeId: "node/1" }),
    adapter.deleteNode("node/1"),
    adapter.replaceChoices("node/1", [{ id: "choice/1", text: "Go", targetId: "" }]),
    adapter.reorderNodes([{ id: "node/1", chapterId: "chapter/1" }]),
    adapter.addChapter({ chapterId: "chapter/1", name: "Chapter" }),
    adapter.deleteChapter("chapter/1"),
    adapter.addScene({ sceneId: "scene/1", name: "Scene" }),
    adapter.deleteScene("scene/1"),
    adapter.addPlaceholders([{ id: "placeholder/2", key: "hero" }]),
    adapter.deletePlaceholder("placeholder/1"),
    adapter.savePhoneModuleCard({
      moduleId: "module/1",
      nodeId: "node/1",
      type: "memo",
      data: { memos: [] },
    }),
    adapter.deletePhoneModuleCard({ moduleId: "module/1", nodeId: "node/1" }),
  ]

  assert.deepEqual(staged, harness.stageResults)
  assert.deepEqual(committed, harness.commitResults)
  assert.deepEqual(harness.stageInputs.map(input => input.key), [
    "node:node%2F1:content",
    "work:fields:future%20field,title",
    "node:node%2F1:fields:content,title",
    "chapter:chapter%2F1:fields:name",
    "placeholder:placeholder%2F1:fields:label",
  ])
  assert.deepEqual(harness.commitInputs.map(input => input.key), [
    "node:node%2F1:add",
    "node:node%2F1:delete",
    "node:node%2F1:choices",
    "nodes:reorder",
    "chapter:chapter%2F1:add",
    "chapter:chapter%2F1:delete",
    "scene:scene%2F1:add",
    "scene:scene%2F1:delete",
    "placeholder:placeholder%2F2:add",
    "placeholder:placeholder%2F1:delete",
    "phone-module:module%2F1:save",
    "phone-module:module%2F1:delete",
  ])
  for (const input of [...harness.stageInputs, ...harness.commitInputs]) {
    assert.equal(Object.hasOwn(input, "correctsOperationId"), false)
  }
  for (const input of harness.commitInputs.slice(0, -2)) {
    assert.equal(Object.hasOwn(input, "consumes"), false)
  }
  assert.deepEqual(harness.commitInputs.at(-2).consumes, ["node:node%2F1:content"])
  assert.deepEqual(harness.commitInputs.at(-1).consumes, ["node:node%2F1:content"])
  assert.equal(harness.nowReads(), 0)
})

test("patch operations merge into latest records, preserve unknown fields, and detach inputs", () => {
  const harness = createHarness()
  const workPatch = { title: "After", futurePatch: { nested: "original" } }
  const nodePatch = { title: "Node after", futurePatch: { nested: "node-original" } }
  const chapterPatch = { name: "Chapter after", futurePatch: ["chapter-original"] }
  const placeholderPatch = { label: "Label after", futurePatch: ["placeholder-original"] }

  harness.adapter.updateWorkFields(workPatch)
  harness.adapter.updateNode("node-a", nodePatch)
  harness.adapter.updateChapter("chapter-a", chapterPatch)
  harness.adapter.updatePlaceholder("placeholder-a", placeholderPatch)

  workPatch.futurePatch.nested = "mutated"
  nodePatch.futurePatch.nested = "mutated"
  chapterPatch.futurePatch.push("mutated")
  placeholderPatch.futurePatch.push("mutated")

  let candidate = articleWork()
  for (const input of harness.stageInputs) candidate = applyEnvelope(input, candidate)

  assert.equal(candidate.id, "work-a")
  assert.equal(candidate.updatedAt, 2)
  assert.deepEqual(candidate.futureWork, { keep: true })
  assert.deepEqual(candidate.futurePatch, { nested: "original" })
  assert.deepEqual(candidate.nodes[0].futureNode, { keep: "a" })
  assert.deepEqual(candidate.nodes[0].futurePatch, { nested: "node-original" })
  assert.deepEqual(candidate.chapters[0].futureChapter, "keep-a")
  assert.deepEqual(candidate.chapters[0].futurePatch, ["chapter-original"])
  assert.deepEqual(candidate.placeholders[0].futurePlaceholder, { keep: true })
  assert.deepEqual(candidate.placeholders[0].futurePatch, ["placeholder-original"])
})

test("field patch ownership is exact and invalid field sets never reach runtime", () => {
  const harness = createHarness()

  assertInvalid(() => harness.adapter.updateWorkFields({}), "invalid-work-fields")
  for (const field of [
    "id", "type", "schemaVersion", "createdAt", "updatedAt",
    "nodes", "chapters", "scenes", "placeholders", "phoneModules",
  ]) {
    assertInvalid(
      () => harness.adapter.updateWorkFields({ [field]: "forbidden" }),
      "invalid-work-fields",
      { field },
    )
  }
  assertInvalid(() => harness.adapter.updateNode("node-a", {}), "invalid-node-fields")
  assertInvalid(
    () => harness.adapter.updateNode("node-a", { id: "changed" }),
    "invalid-node-fields",
    { field: "id" },
  )
  assertInvalid(
    () => harness.adapter.updateNode("node-a", { choices: [] }),
    "invalid-node-fields",
    { field: "choices" },
  )
  assertInvalid(() => harness.adapter.updateChapter("chapter-a", {}), "invalid-chapter-fields")
  assertInvalid(
    () => harness.adapter.updateChapter("chapter-a", { id: "changed" }),
    "invalid-chapter-fields",
    { field: "id" },
  )
  assertInvalid(
    () => harness.adapter.updatePlaceholder("placeholder-a", { id: "changed" }),
    "invalid-placeholder-fields",
    { field: "id" },
  )
  assert.equal(harness.stageInputs.length, 0)
})

test("candidate lookup failures are stable for missing and ambiguous records", () => {
  const harness = createHarness()
  harness.adapter.stageNodeContent("missing", "body")
  harness.adapter.updateChapter("missing", { name: "fixed" })
  harness.adapter.updatePlaceholder("missing", { label: "fixed" })

  assertInvalid(
    () => applyEnvelope(harness.stageInputs[0], articleWork()),
    "node-not-found",
    { entity: "node", id: "missing" },
  )
  assertInvalid(
    () => applyEnvelope(harness.stageInputs[1], articleWork()),
    "chapter-not-found",
    { entity: "chapter", id: "missing" },
  )
  assertInvalid(
    () => applyEnvelope(harness.stageInputs[2], articleWork()),
    "placeholder-not-found",
    { entity: "placeholder", id: "missing" },
  )

  const duplicateNode = articleWork({
    nodes: [
      { ...articleWork().nodes[0], id: "missing" },
      { ...articleWork().nodes[0], id: "missing", title: "duplicate" },
    ],
  })
  assertInvalid(
    () => applyEnvelope(harness.stageInputs[0], duplicateNode),
    "node-ambiguous",
    { entity: "node", id: "missing" },
  )
})

test("field and structural corrections forward only the selected recovery operation ID", () => {
  const fieldTarget = Object.freeze({
    id: "blocked-field",
    kind: "field",
    key: "node:node%2F1:fields:title",
  })
  const laterField = Object.freeze({
    id: "later-field",
    kind: "field",
    key: "work:fields:title",
  })
  const fieldMaterial = Object.freeze({
    kind: "ordinary",
    pendingOperations: Object.freeze([fieldTarget, laterField]),
    correctableOperationIds: Object.freeze([fieldTarget.id]),
  })
  const fieldHarness = createHarness({ recoveryMaterial: fieldMaterial })
  const selectedFieldId = fieldHarness.runtime.recoveryMaterial().correctableOperationIds[0]
  const resolvedField = fieldMaterial.pendingOperations.find(operation => operation.id === selectedFieldId)

  assert.equal(resolvedField, fieldTarget)
  assert.equal(fieldMaterial.correctableOperationIds.includes(laterField.id), false)
  fieldHarness.adapter.updateNode(
    "node/1",
    { title: "corrected" },
    { correctsOperationId: resolvedField.id },
  )
  assert.equal(fieldHarness.stageInputs[0].correctsOperationId, "blocked-field")
  assert.deepEqual(Object.keys(fieldHarness.stageInputs[0]).sort(), [
    "apply", "correctsOperationId", "key", "payload",
  ])
  assert.equal(fieldHarness.recoveryReads(), 1)

  const structuralTarget = Object.freeze({
    id: "blocked-structural",
    kind: "structural",
    key: "node:node%2F1:choices",
  })
  const laterStructural = Object.freeze({
    id: "later-structural",
    kind: "structural",
    key: "node:node%2F2:delete",
  })
  const structuralMaterial = Object.freeze({
    kind: "ordinary",
    pendingOperations: Object.freeze([structuralTarget, laterStructural]),
    correctableOperationIds: Object.freeze([structuralTarget.id]),
  })
  const structuralHarness = createHarness({ recoveryMaterial: structuralMaterial })
  const selectedStructuralId = structuralHarness.runtime.recoveryMaterial().correctableOperationIds[0]
  const resolvedStructural = structuralMaterial.pendingOperations.find(
    operation => operation.id === selectedStructuralId,
  )

  assert.equal(resolvedStructural, structuralTarget)
  assert.equal(structuralMaterial.correctableOperationIds.includes(laterStructural.id), false)
  structuralHarness.adapter.replaceChoices(
    "node/1",
    [{ id: "choice-a", text: "fixed", targetId: "" }],
    { correctsOperationId: resolvedStructural.id },
  )
  assert.equal(
    structuralHarness.commitInputs[0].correctsOperationId,
    "blocked-structural",
  )
  assert.deepEqual(Object.keys(structuralHarness.commitInputs[0]).sort(), [
    "apply", "correctsOperationId", "key", "payload",
  ])
  assert.equal(structuralHarness.recoveryReads(), 1)
})

test("correction options use only an own data ID and completeness updates validate IDs", () => {
  const harness = createHarness()
  const inherited = Object.create({ correctsOperationId: "must-not-forward" })
  harness.adapter.updateWorkFields({ title: "ordinary" }, inherited)
  assert.equal(Object.hasOwn(harness.stageInputs[0], "correctsOperationId"), false)

  const accessor = {}
  Object.defineProperty(accessor, "correctsOperationId", {
    get() {
      throw new Error("correction getters must not run")
    },
  })
  harness.adapter.updateWorkFields({ author: "ordinary" }, accessor)
  assert.equal(Object.hasOwn(harness.stageInputs[1], "correctsOperationId"), false)

  assertInvalid(
    () => harness.adapter.updateChapter("", { name: "invalid" }),
    "invalid-chapter-id",
    { entity: "chapter", id: "" },
  )
  assertInvalid(
    () => harness.adapter.updatePlaceholder(null, { label: "invalid" }),
    "invalid-placeholder-id",
    { entity: "placeholder", id: null },
  )
})

test("all retryable entity IDs are prepared before admission and apply reads only payload", () => {
  let admitting = false
  const allocated = []
  let sequence = 0
  const recording = createRecordingRuntime({
    onCommitNow() {
      admitting = true
      admitting = false
    },
  })
  const adapter = createArticleSaveAdapter({
    runtime: recording.runtime,
    createId(kind) {
      assert.equal(admitting, false)
      allocated.push(kind)
      sequence += 1
      return `${kind}-${sequence}`
    },
    now() {
      throw new Error("now must not be called")
    },
  })
  const choices = [{ text: "One", targetId: "" }, { text: "Two", targetId: "node-a" }]
  const placeholders = [{ key: "hero", future: { original: true } }]
  const moduleData = { memos: [{ id: "memo-a", text: "original" }] }

  adapter.addNode({})
  adapter.addChapter({ name: "Chapter" })
  adapter.addScene({ name: "Scene" })
  adapter.replaceChoices("node-a", choices)
  adapter.addPlaceholders(placeholders)
  adapter.savePhoneModuleCard({ nodeId: "node-a", type: "memo", data: moduleData })

  assert.deepEqual(allocated, [
    "node", "chapter", "scene", "choice", "choice", "placeholder", "phone-module",
  ])
  choices[0].text = "mutated"
  placeholders[0].future.original = false
  moduleData.memos[0].text = "mutated"

  const addNodeResult = applyEnvelope(recording.commitInputs[0], articleWork())
  assert.equal(addNodeResult.nodes.at(-1).id, "node-1")
  assert.deepEqual(addNodeResult.nodes.at(-1), {
    id: "node-1",
    title: "新节点",
    content: "",
    choices: [],
    scene: "",
    chapterId: "chapter-a",
  })

  const choicesResult = applyEnvelope(recording.commitInputs[3], articleWork())
  assert.deepEqual(choicesResult.nodes[0].choices.map(choice => [choice.id, choice.text]), [
    ["choice-4", "One"],
    ["choice-5", "Two"],
  ])
  const placeholdersResult = applyEnvelope(recording.commitInputs[4], articleWork())
  assert.deepEqual(placeholdersResult.placeholders.at(-1), {
    id: "placeholder-6",
    key: "hero",
    future: { original: true },
  })
  const moduleEnvelope = recording.commitInputs[5]
  const moduleId = moduleEnvelope.payload.moduleId
  const moduleWork = articleWork({
    nodes: [{
      ...articleWork().nodes[0],
      content: `<p>before</p><div class="pm-inline-card" data-pm-id="${moduleId}" data-pm-type="old"></div><p>after</p>`,
    }],
  })
  const moduleResult = applyEnvelope(moduleEnvelope, moduleWork)
  assert.equal(moduleResult.phoneModules[0].id, "phone-module-7")
  assert.equal(moduleResult.phoneModules[0].data.memos[0].text, "original")
})

test("add and delete node are single atomic transforms with start and choice repair", () => {
  const harness = createHarness()
  harness.adapter.addNode({ afterId: "node-a", nodeId: "node-new" })
  harness.adapter.deleteNode("node-b")

  const added = applyEnvelope(
    harness.commitInputs[0],
    articleWork({ startNode: "missing-start" }),
  )
  assert.deepEqual(added.nodes.map(node => node.id), ["node-a", "node-new", "node-b"])
  assert.equal(added.startNode, "node-a")
  assert.deepEqual(added.nodes[1], {
    id: "node-new",
    title: "新节点",
    content: "",
    choices: [],
    scene: "",
    chapterId: "chapter-a",
  })

  const withIncomingChoices = articleWork({
    startNode: "node-b",
    nodes: [
      {
        ...articleWork().nodes[0],
        choices: [
          { id: "choice-drop", text: "drop", targetId: "node-b" },
          { id: "choice-keep", text: "keep", targetId: "node-a", futureChoice: true },
        ],
      },
      articleWork().nodes[1],
    ],
  })
  const deleted = applyEnvelope(harness.commitInputs[1], withIncomingChoices)
  assert.deepEqual(deleted.nodes.map(node => node.id), ["node-a"])
  assert.deepEqual(deleted.nodes[0].choices, [
    { id: "choice-keep", text: "keep", targetId: "node-a", futureChoice: true },
  ])
  assert.equal(deleted.startNode, "node-a")

  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork({
      nodes: [...articleWork().nodes, { ...articleWork().nodes[0], id: "node-new" }],
    })),
    "node-id-collision",
    { entity: "node", id: "node-new" },
  )
})

test("replaceChoices replaces once, preserves unique matching choice fields, and validates IDs and targets", () => {
  const harness = createHarness()
  const replacement = [
    { id: "choice-existing", text: "Updated", targetId: "node-b" },
    { text: "Fresh", targetId: "" },
  ]
  harness.adapter.replaceChoices("node-a", replacement)
  assert.equal(harness.commitInputs.length, 1)

  const work = articleWork({
    nodes: [
      {
        ...articleWork().nodes[0],
        choices: [
          {
            id: "choice-existing",
            text: "Before",
            targetId: "",
            futureChoice: { keep: true },
          },
          { id: "choice-removed", text: "Removed", targetId: "" },
        ],
      },
      articleWork().nodes[1],
    ],
  })
  const result = applyEnvelope(harness.commitInputs[0], work)
  assert.deepEqual(result.nodes[0].choices, [
    {
      id: "choice-existing",
      text: "Updated",
      targetId: "node-b",
      futureChoice: { keep: true },
    },
    { id: "choice-prepared-1", text: "Fresh", targetId: "" },
  ])

  const duplicateInput = createHarness()
  assertInvalid(
    () => duplicateInput.adapter.replaceChoices("node-a", [
      { id: "same", targetId: "" },
      { id: "same", targetId: "" },
    ]),
    "choice-id-collision",
    { entity: "choice", id: "same" },
  )

  const missingTarget = createHarness()
  missingTarget.adapter.replaceChoices("node-a", [{ id: "choice-a", targetId: "missing" }])
  assertInvalid(
    () => applyEnvelope(missingTarget.commitInputs[0], articleWork()),
    "node-not-found",
    { entity: "node", id: "missing" },
  )

  const ambiguousExisting = createHarness()
  ambiguousExisting.adapter.replaceChoices("node-a", [{ id: "choice-existing", targetId: "" }])
  assertInvalid(
    () => applyEnvelope(ambiguousExisting.commitInputs[0], articleWork({
      nodes: [{
        ...articleWork().nodes[0],
        choices: [
          { id: "choice-existing", targetId: "" },
          { id: "choice-existing", targetId: "" },
        ],
      }],
    })),
    "choice-ambiguous",
    { entity: "choice", id: "choice-existing" },
  )
})

test("chapter and scene deletion update every affected latest node without losing unknown fields", () => {
  const harness = createHarness()
  harness.adapter.deleteChapter("chapter-a")
  harness.adapter.deleteScene("scene-a")

  const chapterResult = applyEnvelope(harness.commitInputs[0], articleWork())
  assert.deepEqual(chapterResult.chapters.map(chapter => chapter.id), ["chapter-b"])
  assert.equal(chapterResult.nodes[0].chapterId, "chapter-b")
  assert.deepEqual(chapterResult.nodes[0].futureNode, { keep: "a" })

  const lastChapterResult = applyEnvelope(harness.commitInputs[0], articleWork({
    chapters: [{ id: "chapter-a", name: "Only" }],
  }))
  assert.equal(lastChapterResult.nodes[0].chapterId, "")

  const sceneResult = applyEnvelope(harness.commitInputs[1], articleWork())
  assert.deepEqual(sceneResult.scenes, [])
  assert.equal(sceneResult.nodes[0].scene, "")
  assert.deepEqual(sceneResult.nodes[0].futureNode, { keep: "a" })
})

test("chapter and scene additions initialize optional collections and reject ID collisions", () => {
  const harness = createHarness()
  harness.adapter.addChapter({ chapterId: "chapter-new", name: "New chapter" })
  harness.adapter.addScene({ sceneId: "scene-new", name: "New scene" })

  const withoutCollections = articleWork()
  delete withoutCollections.chapters
  delete withoutCollections.scenes
  const addedChapter = applyEnvelope(harness.commitInputs[0], withoutCollections)
  const addedScene = applyEnvelope(harness.commitInputs[1], withoutCollections)
  assert.deepEqual(addedChapter.chapters, [{ id: "chapter-new", name: "New chapter" }])
  assert.deepEqual(addedScene.scenes, [{ id: "scene-new", name: "New scene" }])

  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork({
      chapters: [{ id: "chapter-new", name: "collision" }],
    })),
    "chapter-id-collision",
    { entity: "chapter", id: "chapter-new" },
  )
  assertInvalid(
    () => applyEnvelope(harness.commitInputs[1], articleWork({
      scenes: [{ id: "scene-new", name: "collision" }],
    })),
    "scene-id-collision",
    { entity: "scene", id: "scene-new" },
  )
})

test("reorderNodes applies an exact permutation to latest nodes and rejects malformed orders", () => {
  const harness = createHarness()
  const order = [
    { id: "node-b", chapterId: "chapter-a" },
    { id: "node-a", chapterId: "chapter-b" },
  ]
  harness.adapter.reorderNodes(order)
  order[0].chapterId = "mutated"

  const latest = articleWork({
    nodes: [
      { ...articleWork().nodes[0], content: "latest-a", futureLatest: "a" },
      { ...articleWork().nodes[1], content: "latest-b", futureLatest: "b" },
    ],
  })
  const reordered = applyEnvelope(harness.commitInputs[0], latest)
  assert.deepEqual(reordered.nodes.map(node => [node.id, node.chapterId, node.content]), [
    ["node-b", "chapter-a", "latest-b"],
    ["node-a", "chapter-b", "latest-a"],
  ])
  assert.equal(reordered.nodes[0].futureLatest, "b")

  const duplicateHarness = createHarness()
  assertInvalid(
    () => duplicateHarness.adapter.reorderNodes([
      { id: "node-a", chapterId: "chapter-a" },
      { id: "node-a", chapterId: "chapter-b" },
    ]),
    "invalid-node-order",
  )

  for (const malformed of [
    [{ id: "node-a", chapterId: "chapter-a" }],
    [
      { id: "node-a", chapterId: "chapter-a" },
      { id: "foreign", chapterId: "chapter-b" },
    ],
  ]) {
    const invalidHarness = createHarness()
    invalidHarness.adapter.reorderNodes(malformed)
    assertInvalid(
      () => applyEnvelope(invalidHarness.commitInputs[0], articleWork()),
      "invalid-node-order",
    )
  }
})

test("placeholder add, update, and delete preserve detached unknown data and reject collisions", () => {
  const harness = createHarness()
  const additions = [{ id: "placeholder-new", key: "hero", future: { keep: true } }]
  harness.adapter.addPlaceholders(additions)
  harness.adapter.updatePlaceholder("placeholder-a", { label: "Updated" })
  harness.adapter.deletePlaceholder("placeholder-a")
  additions[0].future.keep = false

  const added = applyEnvelope(harness.commitInputs[0], articleWork())
  assert.deepEqual(added.placeholders.at(-1), {
    id: "placeholder-new",
    key: "hero",
    future: { keep: true },
  })
  const updated = applyEnvelope(harness.stageInputs[0], articleWork())
  assert.deepEqual(updated.placeholders[0].futurePlaceholder, { keep: true })
  assert.equal(updated.placeholders[0].label, "Updated")
  const deleted = applyEnvelope(harness.commitInputs[1], articleWork())
  assert.deepEqual(deleted.placeholders, [])

  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork({
      placeholders: [{ id: "placeholder-new", key: "collision" }],
    })),
    "placeholder-id-collision",
    { entity: "placeholder", id: "placeholder-new" },
  )
})

test("phone module save creates or merges the module and normalizes exactly one existing card", () => {
  const harness = createHarness()
  const data = { memos: [{ id: "memo-a", text: "prepared" }] }
  harness.adapter.savePhoneModuleCard({
    moduleId: "module-a",
    nodeId: "node-a",
    type: "memo",
    data,
  })
  data.memos[0].text = "mutated"

  const content = '<p>before</p><div data-pm-type="old" data-pm-id="module-a" class="selected pm-inline-card future-card"><span>card</span></div><p>after</p>'
  const created = applyEnvelope(harness.commitInputs[0], articleWork({
    nodes: [{ ...articleWork().nodes[0], content }],
  }))
  assert.deepEqual(created.phoneModules, [{
    id: "module-a",
    type: "memo",
    nodeId: "node-a",
    data: { memos: [{ id: "memo-a", text: "prepared" }] },
  }])
  assert.equal(
    created.nodes[0].content,
    content.replace('data-pm-type="old"', 'data-pm-type="memo"'),
  )
  assert.ok(created.nodes[0].content.indexOf("<p>before</p>") < created.nodes[0].content.indexOf("module-a"))
  assert.ok(created.nodes[0].content.indexOf("module-a") < created.nodes[0].content.indexOf("<p>after</p>"))

  const merged = applyEnvelope(harness.commitInputs[0], articleWork({
    phoneModules: [{
      id: "module-a",
      type: "old",
      nodeId: "node-a",
      data: { old: true },
      futureModule: { keep: true },
    }],
    nodes: [{ ...articleWork().nodes[0], content }],
  }))
  assert.deepEqual(merged.phoneModules[0].futureModule, { keep: true })
  assert.equal(merged.phoneModules[0].type, "memo")
  assert.deepEqual(merged.phoneModules[0].data, {
    memos: [{ id: "memo-a", text: "prepared" }],
  })
})

test("phone module save reports stable node, module binding, and card-reference failures", () => {
  const harness = createHarness()
  harness.adapter.savePhoneModuleCard({
    moduleId: "module-a",
    nodeId: "node-a",
    type: "memo",
    data: {},
  })
  const envelope = harness.commitInputs[0]

  assertInvalid(
    () => applyEnvelope(envelope, articleWork({ nodes: [] })),
    "node-not-found",
    { entity: "node", id: "node-a" },
  )
  assertInvalid(
    () => applyEnvelope(envelope, articleWork()),
    "phone-card-reference-not-found",
    { entity: "phone-card-reference", id: "module-a" },
  )
  const card = '<div class="pm-inline-card" data-pm-id="module-a"></div>'
  assertInvalid(
    () => applyEnvelope(envelope, articleWork({
      nodes: [{ ...articleWork().nodes[0], content: `${card}${card}` }],
    })),
    "phone-card-reference-ambiguous",
    { entity: "phone-card-reference", id: "module-a" },
  )
  assertInvalid(
    () => applyEnvelope(envelope, articleWork({
      phoneModules: [{ id: "module-a", type: "memo", nodeId: "node-b", data: {} }],
      nodes: [{ ...articleWork().nodes[0], content: card }],
    })),
    "phone-module-node-mismatch",
    { entity: "phone-module", id: "module-a" },
  )

  const forgedAttribute = '<div class="pm-inline-card" title="fake data-pm-id=\'module-a\'"></div>'
  assertInvalid(
    () => applyEnvelope(envelope, articleWork({
      nodes: [{ ...articleWork().nodes[0], content: forgedAttribute }],
    })),
    "phone-card-reference-not-found",
    { entity: "phone-card-reference", id: "module-a" },
  )
})

test("phone module save parses actual quoted attributes", () => {
  const quotedHarness = createHarness()
  quotedHarness.adapter.savePhoneModuleCard({
    moduleId: "module-a",
    nodeId: "node-a",
    type: "memo",
    data: {},
  })
  const content = '<div class="pm-inline-card" title="1 > 0" data-pm-id="module-a" data-pm-type="old"><span>Card</span></div>'
  const normalized = applyEnvelope(quotedHarness.commitInputs[0], articleWork({
    nodes: [{ ...articleWork().nodes[0], content }],
  }))
  assert.equal(
    normalized.nodes[0].content,
    content.replace('data-pm-type="old"', 'data-pm-type="memo"'),
  )

})

test("phone module save rejects a generated ID collision", () => {
  const generatedHarness = createHarness()
  generatedHarness.adapter.savePhoneModuleCard({
    nodeId: "node-a",
    type: "memo",
    data: { replacement: true },
  })
  const generatedId = generatedHarness.commitInputs[0].payload.moduleId
  const card = `<div class="pm-inline-card" data-pm-id="${generatedId}" data-pm-type="memo"></div>`
  assertInvalid(
    () => applyEnvelope(generatedHarness.commitInputs[0], articleWork({
      phoneModules: [{
        id: generatedId,
        type: "memo",
        nodeId: "node-a",
        data: { original: true },
      }],
      nodes: [{ ...articleWork().nodes[0], content: card }],
    })),
    "phone-module-id-collision",
    { entity: "phone-module", id: generatedId },
  )
})

test("phone module delete removes the unique module and every matching card while allowing zero references", () => {
  const harness = createHarness()
  harness.adapter.deletePhoneModuleCard({ moduleId: "module-a", nodeId: "node-a" })
  const cardA = '<div class="pm-inline-card" data-pm-id="module-a"><span>A</span></div>'
  const other = '<div class="pm-inline-card" data-pm-id="module-b"><span>B</span></div>'
  const work = articleWork({
    phoneModules: [
      { id: "module-a", type: "memo", nodeId: "node-a", data: {}, future: true },
      { id: "module-b", type: "memo", nodeId: "node-a", data: {} },
    ],
    nodes: [{
      ...articleWork().nodes[0],
      content: `<p>before</p>${cardA}${other}${cardA}<p>after</p>`,
    }],
  })
  const deleted = applyEnvelope(harness.commitInputs[0], work)
  assert.deepEqual(deleted.phoneModules.map(module => module.id), ["module-b"])
  assert.doesNotMatch(deleted.nodes[0].content, /module-a/)
  assert.match(deleted.nodes[0].content, /module-b/)
  assert.match(deleted.nodes[0].content, /before/)
  assert.match(deleted.nodes[0].content, /after/)

  const alreadyAbsent = applyEnvelope(harness.commitInputs[0], articleWork({
    phoneModules: [{ id: "module-a", type: "memo", nodeId: "node-a", data: {} }],
  }))
  assert.deepEqual(alreadyAbsent.phoneModules, [])

  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork()),
    "phone-module-not-found",
    { entity: "phone-module", id: "module-a" },
  )
})

test("phone module delete preserves suffixes around void and nested matching references", () => {
  const harness = createHarness()
  harness.adapter.deletePhoneModuleCard({ moduleId: "module-a", nodeId: "node-a" })
  const module = { id: "module-a", type: "memo", nodeId: "node-a", data: {} }

  const voidCard = '<hr class="pm-inline-card" title="1 > 0" data-pm-id="module-a">'
  const voidResult = applyEnvelope(harness.commitInputs[0], articleWork({
    phoneModules: [module],
    nodes: [{
      ...articleWork().nodes[0],
      content: `<p>before</p>${voidCard}<p>after</p>`,
    }],
  }))
  assert.equal(voidResult.nodes[0].content, "<p>before</p><p>after</p>")

  const nestedCards = '<div class="pm-inline-card" data-pm-id="module-a"><span>outer</span><div class="pm-inline-card" data-pm-id="module-a"><span>inner</span></div></div>'
  const nestedResult = applyEnvelope(harness.commitInputs[0], articleWork({
    phoneModules: [module],
    nodes: [{
      ...articleWork().nodes[0],
      content: `<p>before</p>${nestedCards}<p>after suffix</p>`,
    }],
  }))
  assert.equal(nestedResult.nodes[0].content, "<p>before</p><p>after suffix</p>")
})

test("phone module delete rejects ambiguous or cross-node modules and preserves other unknown records", () => {
  const harness = createHarness()
  harness.adapter.deletePhoneModuleCard({ moduleId: "module-a", nodeId: "node-a" })
  const card = '<div class="pm-inline-card" data-pm-id="module-a"></div>'
  const baseModule = { id: "module-a", type: "memo", nodeId: "node-a", data: {} }

  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork({
      phoneModules: [baseModule, { ...baseModule }],
      nodes: [{ ...articleWork().nodes[0], content: card }],
    })),
    "phone-module-ambiguous",
    { entity: "phone-module", id: "module-a" },
  )
  assertInvalid(
    () => applyEnvelope(harness.commitInputs[0], articleWork({
      phoneModules: [{ ...baseModule, nodeId: "node-b" }],
      nodes: [{ ...articleWork().nodes[0], content: card }],
    })),
    "phone-module-node-mismatch",
    { entity: "phone-module", id: "module-a" },
  )

  const preserved = applyEnvelope(harness.commitInputs[0], articleWork({
    phoneModules: [
      baseModule,
      {
        id: "module-b",
        type: "memo",
        nodeId: "node-a",
        data: {},
        futureModule: { keep: true },
      },
    ],
    nodes: [{ ...articleWork().nodes[0], content: card }],
  }))
  assert.deepEqual(preserved.phoneModules, [{
    id: "module-b",
    type: "memo",
    nodeId: "node-a",
    data: {},
    futureModule: { keep: true },
  }])
})
