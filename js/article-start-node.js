function records(value) {
  return Array.isArray(value) ? value : []
}

function readableNode(node) {
  return Boolean(
    node
    && typeof node === "object"
    && !Array.isArray(node)
    && typeof node.id === "string"
    && node.id.length > 0
    && node.kind !== "conditional",
  )
}

export function resolveAutomaticArticleStartNodeId(work) {
  const nodes = records(work?.nodes)
  const chapterIds = []

  records(work?.chapters).forEach(chapter => {
    const id = typeof chapter?.id === "string" ? chapter.id : ""
    if (id && !chapterIds.includes(id)) chapterIds.push(id)
  })

  for (const chapterId of chapterIds) {
    const first = nodes.find(node => readableNode(node) && node.chapterId === chapterId)
    if (first) return first.id
  }

  const authoredChapterIds = new Set(chapterIds)
  return nodes.find(node => (
    readableNode(node)
    && !authoredChapterIds.has(typeof node.chapterId === "string" ? node.chapterId : "")
  ))?.id ?? ""
}
