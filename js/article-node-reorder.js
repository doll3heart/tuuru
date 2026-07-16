function failure(reason, nodes) {
  return { ok: false, reason, nodes }
}

function matchingIndexes(nodes, id) {
  const indexes = []
  for (let index = 0; index < nodes.length; index += 1) {
    if (nodes[index]?.id === id) indexes.push(index)
  }
  return indexes
}

export function reorderArticleNode(nodes, options = {}) {
  if (!Array.isArray(nodes)) return failure("nodes-invalid", nodes)

  const draggedIndexes = matchingIndexes(nodes, options.draggedId)
  if (draggedIndexes.length === 0) return failure("dragged-node-not-found", nodes)
  if (draggedIndexes.length > 1) return failure("dragged-node-ambiguous", nodes)

  const placement = options.placement || "inside"
  const usesTarget = placement === "before" || placement === "after"
  let target = null
  if (usesTarget) {
    const targetIndexes = matchingIndexes(nodes, options.targetId)
    if (targetIndexes.length === 0) return failure("target-node-not-found", nodes)
    if (targetIndexes.length > 1) return failure("target-node-ambiguous", nodes)
    if (options.targetId === options.draggedId) return { ok: true, changed: false, nodes: nodes.slice() }
    target = nodes[targetIndexes[0]]
  } else if (placement !== "inside") {
    return failure("placement-invalid", nodes)
  }

  const draggedIndex = draggedIndexes[0]
  const dragged = nodes[draggedIndex]
  const targetChapterId = target
    ? (target.chapterId || "")
    : String(options.targetChapterId || "")
  const moved = targetChapterId === (dragged.chapterId || "")
    ? dragged
    : { ...dragged, chapterId: targetChapterId }
  const nextNodes = nodes.filter((_, index) => index !== draggedIndex)

  let insertIndex
  if (usesTarget) {
    const targetIndex = nextNodes.findIndex(node => node?.id === target.id)
    insertIndex = targetIndex + (placement === "after" ? 1 : 0)
  } else {
    let lastChapterIndex = -1
    for (let index = 0; index < nextNodes.length; index += 1) {
      if ((nextNodes[index]?.chapterId || "") === targetChapterId) lastChapterIndex = index
    }
    insertIndex = lastChapterIndex >= 0 ? lastChapterIndex + 1 : nextNodes.length
  }

  nextNodes.splice(insertIndex, 0, moved)
  const changed = nextNodes.some((node, index) => (
    node !== nodes[index]
    || node?.id !== nodes[index]?.id
    || (node?.chapterId || "") !== (nodes[index]?.chapterId || "")
  ))
  return { ok: true, changed, nodes: nextNodes }
}
