function record(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function string(value) {
  return typeof value === "string" ? value : ""
}

function uniqueIndex(items) {
  const index = new Map()
  const duplicates = new Set()
  for (const item of Array.isArray(items) ? items : []) {
    const id = string(item?.id)
    if (!id) continue
    if (index.has(id)) duplicates.add(id)
    else index.set(id, item)
  }
  for (const id of duplicates) index.delete(id)
  return index
}

function articleProgress(slot) {
  const progress = slot?.progress
  if (!record(progress) || progress.kind !== "article" || !Array.isArray(progress.path)) return null
  return progress
}

function selectedChoiceText(node, choiceId) {
  if (!choiceId) return ""
  const choices = Array.isArray(node?.choices) ? node.choices : []
  const matches = choices.filter(choice => string(choice?.id) === choiceId)
  return matches.length === 1 ? string(matches[0].text).trim() : ""
}

function journeyIndexes(work) {
  return {
    nodes:uniqueIndex(work?.nodes),
    chapters:uniqueIndex(work?.chapters),
  }
}

function selectedJourneyDecisions(node, progress) {
  const decisions = []
  const choiceMemory = record(progress?.choiceMemory) ? progress.choiceMemory : {}
  const branchLabel = selectedChoiceText(node, string(choiceMemory[node?.id]))
  if (branchLabel) decisions.push({kind:"branch", label:branchLabel})

  const interactionSelections = record(progress?.interactionSelections)
    ? progress.interactionSelections
    : {}
  for (const group of Array.isArray(node?.interactionGroups) ? node.interactionGroups : []) {
    const groupId = string(group?.id)
    const selection = record(interactionSelections[groupId])
      ? interactionSelections[groupId]
      : null
    if (!selection || string(selection.nodeId) !== string(node?.id)) continue
    const choiceId = string(selection.choiceId)
    const matches = (Array.isArray(group?.choices) ? group.choices : [])
      .filter(choice => string(choice?.id) === choiceId)
    if (matches.length !== 1) continue
    const label = string(matches[0].text).trim()
    if (label) decisions.push({kind:"interaction", label})
  }
  return decisions
}

export function readerJourneyDirectory(work, slot) {
  if (!record(work) || work.type === "phone") return []
  const progress = articleProgress(slot)
  if (!progress) return []
  const {nodes, chapters} = journeyIndexes(work)
  const entries = []
  progress.path.forEach((nodeId, pathIndex) => {
    const node = nodes.get(nodeId)
    if (!node) return
    const chapterId = string(node.chapterId)
    entries.push({
      nodeId,
      pathIndex,
      chapterId,
      chapterTitle:string(chapters.get(chapterId)?.name).trim(),
      title:string(node.title).trim() || "阅读片段",
      decisions:selectedJourneyDecisions(node, progress),
    })
  })
  return entries
}

export function readerUnlockedMemoir(work, slot) {
  if (!record(work) || work.type === "phone") return []
  const progress = articleProgress(slot)
  if (!progress) return []
  const { nodes, chapters } = journeyIndexes(work)
  const choiceMemory = record(progress.choiceMemory) ? progress.choiceMemory : {}
  const seen = new Set()
  const result = []
  for (const nodeId of progress.path) {
    if (seen.has(nodeId)) continue
    const node = nodes.get(nodeId)
    if (!node) continue
    seen.add(nodeId)
    const chapterId = string(node.chapterId)
    const chapter = chapters.get(chapterId)
    result.push({
      nodeId,
      chapterId,
      chapterTitle:string(chapter?.name).trim(),
      title:string(node.title).trim() || "阅读片段",
      choiceText:selectedChoiceText(node, string(choiceMemory[nodeId])),
    })
  }
  return result
}

export function compareReaderSlots(work, leftSlot, rightSlot) {
  if (!record(work) || work.type === "phone") return []
  const left = articleProgress(leftSlot)
  const right = articleProgress(rightSlot)
  if (!left || !right) return []
  const { nodes, chapters } = journeyIndexes(work)
  const leftVisited = new Set(left.path)
  const rightVisited = new Set(right.path)
  const leftMemory = record(left.choiceMemory) ? left.choiceMemory : {}
  const rightMemory = record(right.choiceMemory) ? right.choiceMemory : {}
  const sourceIds = new Set([...Object.keys(leftMemory), ...Object.keys(rightMemory)])
  const result = []
  for (const nodeId of sourceIds) {
    if (!leftVisited.has(nodeId) || !rightVisited.has(nodeId)) continue
    const node = nodes.get(nodeId)
    if (!node) continue
    const leftChoiceId = string(leftMemory[nodeId])
    const rightChoiceId = string(rightMemory[nodeId])
    if (!leftChoiceId || !rightChoiceId || leftChoiceId === rightChoiceId) continue
    const leftText = selectedChoiceText(node, leftChoiceId)
    const rightText = selectedChoiceText(node, rightChoiceId)
    if (!leftText || !rightText) continue
    const chapter = chapters.get(string(node.chapterId))
    const chapterTitle = string(chapter?.name).trim()
    const nodeTitle = string(node.title).trim() || "选择点"
    result.push({
      nodeId,
      location:[chapterTitle, nodeTitle].filter(Boolean).join(" · "),
      leftText,
      rightText,
    })
  }
  return result
}
