import test from "node:test"
import assert from "node:assert/strict"

import {
  createInteractiveSceneNodeDraft,
  interactiveSceneForNode,
  isInteractiveSceneNode,
  migrateInteractiveSceneCards,
} from "../js/interactive-scene-node.js"

test("a new interactive page is one chapter node linked to one scene", () => {
  const result = createInteractiveSceneNodeDraft({
    nodeId: "interactive-node-1",
    sceneId: "scene-1",
    stageId: "stage-1",
    chapterId: "chapter-1",
    title: "掌心",
  })

  assert.deepEqual(result.node, {
    id: "interactive-node-1",
    title: "掌心",
    content: "",
    choices: [],
    scene: "",
    chapterId: "chapter-1",
    kind: "interactive-scene",
    interactiveSceneId: "scene-1",
  })
  assert.equal(result.scene.id, "scene-1")
  assert.equal(result.scene.nodeId, "interactive-node-1")
  assert.equal(isInteractiveSceneNode(result.node), true)
  assert.equal(interactiveSceneForNode({ interactiveScenes: [result.scene] }, result.node), result.scene)
})

test("a legacy card-only node migrates in place into an interactive page", () => {
  const input = {
    nodes: [{
      id: "start",
      title: "开始",
      chapterId: "chapter-1",
      scene: "",
      choices: [],
      content: '<div class="interactive-scene-card" data-is-id="scene-1"><span>旧入口</span></div>',
    }],
    interactiveScenes: [{
      id: "scene-1",
      nodeId: "start",
      title: "掌心",
      stages: [],
    }],
  }

  const result = migrateInteractiveSceneCards(input)

  assert.equal(result.changed, true)
  assert.equal(result.work.nodes.length, 1)
  assert.equal(result.work.nodes[0].kind, "interactive-scene")
  assert.equal(result.work.nodes[0].interactiveSceneId, "scene-1")
  assert.equal(result.work.nodes[0].content, "")
  assert.equal(result.work.nodes[0].title, "掌心")
  assert.equal(result.work.interactiveScenes[0].nodeId, "start")
  assert.equal(input.nodes[0].kind, undefined, "migration must not mutate its input")
})

test("a legacy card inside prose becomes a sibling interactive node without deleting the prose", () => {
  const input = {
    nodes: [{
      id: "start",
      title: "开始",
      chapterId: "chapter-1",
      scene: "visual-1",
      choices: [],
      content: '<p>伸出手。</p><div class="interactive-scene-card" data-is-id="scene-1"><span>旧入口</span></div><p>然后等待。</p>',
    }],
    interactiveScenes: [{
      id: "scene-1",
      nodeId: "start",
      title: "掌心",
      stages: [],
    }],
  }

  const result = migrateInteractiveSceneCards(input, {
    idFactory: () => "interactive-node-1",
  })

  assert.equal(result.work.nodes.length, 2)
  assert.equal(result.work.nodes[0].id, "start")
  assert.match(result.work.nodes[0].content, /伸出手/)
  assert.match(result.work.nodes[0].content, /然后等待/)
  assert.doesNotMatch(result.work.nodes[0].content, /interactive-scene-card/)
  assert.equal(result.work.nodes[1].id, "interactive-node-1")
  assert.equal(result.work.nodes[1].chapterId, "chapter-1")
  assert.equal(result.work.nodes[1].kind, "interactive-scene")
  assert.equal(result.work.interactiveScenes[0].nodeId, "interactive-node-1")
})

test("migration never replaces an image-only article node with its interactive child", () => {
  const input = {
    nodes: [{
      id: "start",
      title: "开始",
      chapterId: "chapter-1",
      choices: [],
      content: '<img src="https://example.test/prologue.jpg"><div class="interactive-scene-card" data-is-id="scene-1"><span>旧入口</span></div>',
    }],
    interactiveScenes: [{
      id: "scene-1",
      nodeId: "start",
      title: "掌心",
      stages: [],
    }],
  }

  const result = migrateInteractiveSceneCards(input, {
    idFactory: () => "interactive-node-1",
  })

  assert.equal(result.work.nodes.length, 2)
  assert.match(result.work.nodes[0].content, /prologue\.jpg/)
  assert.equal(result.work.nodes[1].kind, "interactive-scene")
})
