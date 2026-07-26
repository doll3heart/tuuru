import { createInteractiveScene } from "./interactive-scene-model.js"

export const INTERACTIVE_SCENE_NODE_KIND = "interactive-scene"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function sceneCardPattern(sceneId, flags = "gi") {
  return new RegExp(
    `<div\\s+class=["'][^"']*\\binteractive-scene-card\\b[^"']*["'][^>]*data-is-id=["']${escapeRegExp(sceneId)}["'][^>]*>[\\s\\S]*?<\\/div>`,
    flags,
  )
}

export function articleNodeHasInteractiveSceneCard(node, sceneId) {
  return sceneCardPattern(sceneId).test(String(node?.content || ""))
}

function hasVisibleArticleContent(value) {
  const html = String(value || "")
  if (/<(?:img|picture|video|audio|iframe|canvas|svg|table|hr|object|embed)\b/i.test(html)) {
    return true
  }
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, "")
    .trim().length > 0
}

function nextAvailableNodeId(nodes, sceneId, idFactory) {
  const used = new Set(nodes.map(node => String(node?.id || "")))
  if (typeof idFactory === "function") {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = String(idFactory() || "").trim()
      if (candidate && !used.has(candidate)) return candidate
    }
  }
  const safeSceneId = String(sceneId || "scene").replace(/[^a-z0-9_-]/gi, "-") || "scene"
  const base = `interactive-${safeSceneId}`
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export function isInteractiveSceneNode(node) {
  return node?.kind === INTERACTIVE_SCENE_NODE_KIND
    && typeof node?.interactiveSceneId === "string"
    && node.interactiveSceneId.length > 0
}

export function interactiveSceneForNode(work, node) {
  if (!isInteractiveSceneNode(node)) return null
  return (Array.isArray(work?.interactiveScenes) ? work.interactiveScenes : [])
    .find(scene => String(scene?.id || "") === node.interactiveSceneId) || null
}

export function createInteractiveSceneNodeDraft({
  nodeId,
  sceneId,
  stageId,
  chapterId = "",
  title = "互动场景",
} = {}) {
  const node = {
    id: String(nodeId || ""),
    title: String(title || "互动场景"),
    content: "",
    choices: [],
    scene: "",
    chapterId: String(chapterId || ""),
    kind: INTERACTIVE_SCENE_NODE_KIND,
    interactiveSceneId: String(sceneId || ""),
  }
  const scene = createInteractiveScene({
    id: node.interactiveSceneId,
    nodeId: node.id,
    stageId,
  })
  scene.title = node.title
  return { node, scene }
}

export function migrateInteractiveSceneCards(workValue, options = {}) {
  const work = clone(workValue || {})
  work.nodes = Array.isArray(work.nodes) ? work.nodes : []
  work.interactiveScenes = Array.isArray(work.interactiveScenes) ? work.interactiveScenes : []
  let changed = false

  for (const scene of work.interactiveScenes) {
    const sceneId = String(scene?.id || "")
    if (!sceneId) continue

    let linkedNode = work.nodes.find(node => (
      isInteractiveSceneNode(node) && node.interactiveSceneId === sceneId
    ))
    let ownerIndex = work.nodes.findIndex(node => articleNodeHasInteractiveSceneCard(node, sceneId))
    if (ownerIndex < 0 && scene.nodeId) {
      ownerIndex = work.nodes.findIndex(node => String(node?.id || "") === String(scene.nodeId))
    }

    if (!linkedNode && ownerIndex >= 0) {
      const owner = work.nodes[ownerIndex]
      const strippedContent = String(owner.content || "").replace(sceneCardPattern(sceneId), "")
      if (!hasVisibleArticleContent(strippedContent)) {
        owner.kind = INTERACTIVE_SCENE_NODE_KIND
        owner.interactiveSceneId = sceneId
        owner.title = String(scene.title || owner.title || "互动场景")
        owner.content = ""
        owner.choices = Array.isArray(owner.choices) ? owner.choices : []
        linkedNode = owner
        changed = true
      } else {
        owner.content = strippedContent
        const nodeId = nextAvailableNodeId(work.nodes, sceneId, options.idFactory)
        linkedNode = {
          id: nodeId,
          title: String(scene.title || "互动场景"),
          content: "",
          choices: [],
          scene: "",
          chapterId: String(owner.chapterId || ""),
          kind: INTERACTIVE_SCENE_NODE_KIND,
          interactiveSceneId: sceneId,
        }
        work.nodes.splice(ownerIndex + 1, 0, linkedNode)
        changed = true
      }
    }

    if (!linkedNode) {
      const fallbackOwner = work.nodes.find(node => !isInteractiveSceneNode(node)) || work.nodes[0]
      const nodeId = nextAvailableNodeId(work.nodes, sceneId, options.idFactory)
      linkedNode = {
        id: nodeId,
        title: String(scene.title || "互动场景"),
        content: "",
        choices: [],
        scene: "",
        chapterId: String(fallbackOwner?.chapterId || work.chapters?.[0]?.id || ""),
        kind: INTERACTIVE_SCENE_NODE_KIND,
        interactiveSceneId: sceneId,
      }
      work.nodes.push(linkedNode)
      changed = true
    }

    for (const node of work.nodes) {
      if (node === linkedNode) continue
      const content = String(node.content || "")
      const withoutCard = content.replace(sceneCardPattern(sceneId), "")
      if (withoutCard !== content) {
        node.content = withoutCard
        changed = true
      }
    }

    if (scene.nodeId !== linkedNode.id) {
      scene.nodeId = linkedNode.id
      changed = true
    }
    if (linkedNode.kind !== INTERACTIVE_SCENE_NODE_KIND) {
      linkedNode.kind = INTERACTIVE_SCENE_NODE_KIND
      changed = true
    }
    if (linkedNode.interactiveSceneId !== sceneId) {
      linkedNode.interactiveSceneId = sceneId
      changed = true
    }
  }

  return { work, changed }
}
