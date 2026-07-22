function cloneItems(items) {
  return (Array.isArray(items) ? items : []).map(item => ({
    ...item,
    replies: cloneItems(item?.replies),
  }))
}

function locate(items, id, containerKey = "root") {
  if (!Array.isArray(items)) return null
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (String(item?.id) === String(id)) return { items, index, containerKey }
    const nested = locate(item?.replies, id, `${containerKey}/${String(item?.id)}`)
    if (nested) return nested
  }
  return null
}

export function reorderForumCommentTree(input, sourceId, targetId, position = "before") {
  const comments = cloneItems(input)
  if (String(sourceId) === String(targetId)) return { ok:false, reason:"same-item", comments }
  const source = locate(comments, sourceId)
  const target = locate(comments, targetId)
  if (!source || !target) return { ok:false, reason:"missing-item", comments }
  if (source.containerKey !== target.containerKey) return { ok:false, reason:"different-container", comments }

  const [moved] = source.items.splice(source.index, 1)
  const targetIndex = target.items.findIndex(item => String(item?.id) === String(targetId))
  if (targetIndex < 0) return { ok:false, reason:"missing-target", comments:cloneItems(input) }
  const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex
  target.items.splice(insertionIndex, 0, moved)
  return { ok:true, comments, movedId:String(sourceId) }
}

export function reorderForumCommentByOffset(input, sourceId, offset) {
  const comments = cloneItems(input)
  const source = locate(comments, sourceId)
  if (!source) return { ok:false, reason:"missing-item", comments }
  const targetIndex = source.index + (Number(offset) < 0 ? -1 : 1)
  if (targetIndex < 0 || targetIndex >= source.items.length) return { ok:false, reason:"edge", comments }
  const targetId = source.items[targetIndex]?.id
  return reorderForumCommentTree(comments, sourceId, targetId, Number(offset) < 0 ? "before" : "after")
}
