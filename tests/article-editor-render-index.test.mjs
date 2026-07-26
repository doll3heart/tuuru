import test from "node:test"
import assert from "node:assert/strict"

import { createArticleEditorRenderIndex } from "../js/article-editor-render-index.js"

function choice(id, text, targetId, mode) {
  return { id, text, targetId, ...(mode ? { mode } : {}) }
}

test("editor render index preserves authored chapter, node, and choice order", () => {
  const nodeA = {
    id: "node-a",
    title: "相遇",
    chapterId: "chapter-1",
    choices: [choice("choice-a", "同意", "node-b")],
  }
  const nodeB = {
    id: "node-b",
    title: "回家",
    chapterId: "chapter-1",
    choices: [choice("choice-b", "微笑", "", "interaction")],
  }
  const work = {
    chapters: [{ id: "chapter-1", name: "第一章" }],
    nodes: [nodeA, nodeB],
  }

  const index = createArticleEditorRenderIndex(work)

  assert.deepEqual(index.nodesByChapterId.get("chapter-1"), [nodeA, nodeB])
  assert.deepEqual(index.siblingPositionByNodeId.get("node-a"), { index:0, count:2 })
  assert.deepEqual(index.siblingPositionByNodeId.get("node-b"), { index:1, count:2 })
  assert.equal(index.targetPathByNodeId.get("node-b"), "第一章 → 回家")
  assert.equal(index.conditionLabelByChoiceId.get("choice-a"), "同意")
  assert.equal(index.conditionLabelByChoiceId.get("choice-b"), "微笑")
})

test("editor render index retains ungrouped nodes and rejects ambiguous target paths", () => {
  const duplicateA = { id:"duplicate", title:"甲", chapterId:"missing", choices:[] }
  const duplicateB = { id:"duplicate", title:"乙", chapterId:"", choices:[] }
  const work = {
    chapters: [{ id:"chapter-1", name:"" }],
    nodes: [duplicateA, duplicateB],
  }

  const index = createArticleEditorRenderIndex(work)

  assert.deepEqual(index.nodesByChapterId.get("missing"), [duplicateA])
  assert.deepEqual(index.nodesByChapterId.get(""), [duplicateB])
  assert.equal(index.targetPathByNodeId.has("duplicate"), false)
})

test("editor render index builds one reusable catalog for a large outline", () => {
  const nodes = Array.from({ length:500 }, (_, index) => ({
    id:`node-${index}`,
    title:`节点 ${index}`,
    chapterId:`chapter-${index % 5}`,
    choices:[choice(`choice-${index}`, `选项 ${index}`, `node-${(index + 1) % 500}`)],
  }))
  const work = {
    chapters:Array.from({ length:5 }, (_, index) => ({ id:`chapter-${index}`, name:`章节 ${index}` })),
    nodes,
  }

  const index = createArticleEditorRenderIndex(work)

  assert.equal(index.nodesByChapterId.get("chapter-0").length, 100)
  assert.equal(index.siblingPositionByNodeId.size, 500)
  assert.equal(index.targetPathByNodeId.size, 500)
  assert.equal(index.conditionLabelByChoiceId.size, 500)
})
