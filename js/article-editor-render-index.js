import { buildArticleChoiceCatalog } from "./article-condition-model.js"

function list(value) {
  return Array.isArray(value) ? value : []
}

function countIds(records) {
  const counts = new Map()
  for (const record of records) {
    const id = typeof record?.id === "string" ? record.id : ""
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

export function createArticleEditorRenderIndex(work) {
  const chapters = list(work?.chapters)
  const nodes = list(work?.nodes)
  const nodesByChapterId = new Map()
  const siblingPositionByNodeId = new Map()
  const targetPathByNodeId = new Map()
  const conditionLabelByChoiceId = new Map()
  const chapterById = new Map()
  const nodeIdCounts = countIds(nodes)

  for (const chapter of chapters) {
    const chapterId = typeof chapter?.id === "string" ? chapter.id : ""
    if (!chapterById.has(chapterId)) chapterById.set(chapterId, chapter)
  }

  for (const node of nodes) {
    const chapterId = typeof node?.chapterId === "string" ? node.chapterId : ""
    const chapterNodes = nodesByChapterId.get(chapterId) || []
    chapterNodes.push(node)
    nodesByChapterId.set(chapterId, chapterNodes)
  }

  for (const chapterNodes of nodesByChapterId.values()) {
    const count = chapterNodes.length
    chapterNodes.forEach((node, index) => {
      if (typeof node?.id === "string" && node.id) {
        siblingPositionByNodeId.set(node.id, { index, count })
      }
    })
  }

  for (const node of nodes) {
    const nodeId = typeof node?.id === "string" ? node.id : ""
    if (!nodeId || nodeIdCounts.get(nodeId) !== 1) continue
    const chapter = chapterById.get(typeof node?.chapterId === "string" ? node.chapterId : "")
    const chapterName = chapter ? (chapter.name || "未命名章节") : "未分章"
    targetPathByNodeId.set(nodeId, `${chapterName} → ${node.title || "未命名节点"}`)
  }

  for (const item of buildArticleChoiceCatalog(work)) {
    if (!item.disabled && !conditionLabelByChoiceId.has(item.choiceId)) {
      conditionLabelByChoiceId.set(item.choiceId, item.choiceText)
    }
  }

  return {
    chapters,
    nodesByChapterId,
    siblingPositionByNodeId,
    targetPathByNodeId,
    conditionLabelByChoiceId,
  }
}
