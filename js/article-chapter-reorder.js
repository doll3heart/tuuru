function failure(reason, chapters) {
  return { ok: false, reason, chapters }
}

function matchingIndexes(chapters, id) {
  const indexes = []
  for (let index = 0; index < chapters.length; index += 1) {
    if (chapters[index]?.id === id) indexes.push(index)
  }
  return indexes
}

export function reorderArticleChapter(chapters, options = {}) {
  if (!Array.isArray(chapters)) return failure("chapters-invalid", chapters)

  const placement = options.placement
  if (placement !== "before" && placement !== "after") {
    return failure("placement-invalid", chapters)
  }

  const draggedIndexes = matchingIndexes(chapters, options.draggedId)
  if (draggedIndexes.length === 0) return failure("dragged-chapter-not-found", chapters)
  if (draggedIndexes.length > 1) return failure("dragged-chapter-ambiguous", chapters)

  const targetIndexes = matchingIndexes(chapters, options.targetId)
  if (targetIndexes.length === 0) return failure("target-chapter-not-found", chapters)
  if (targetIndexes.length > 1) return failure("target-chapter-ambiguous", chapters)
  if (options.draggedId === options.targetId) {
    return { ok: true, changed: false, chapters: chapters.slice() }
  }

  const draggedIndex = draggedIndexes[0]
  const dragged = chapters[draggedIndex]
  const nextChapters = chapters.filter((_, index) => index !== draggedIndex)
  const targetIndex = nextChapters.findIndex(chapter => chapter?.id === options.targetId)
  const insertIndex = targetIndex + (placement === "after" ? 1 : 0)
  nextChapters.splice(insertIndex, 0, dragged)

  const changed = nextChapters.some((chapter, index) => chapter !== chapters[index])
  return { ok: true, changed, chapters: nextChapters }
}
