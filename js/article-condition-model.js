import { articleInteractionMarkerIds } from "./article-interaction-group-model.js"

export function normalizeArticleDisplayCondition(value) {
  const groups = Array.isArray(value?.all) ? value.all : []
  return {
    all: groups.map(group => ({
      anyChoiceIds: [...new Set(
        (Array.isArray(group?.anyChoiceIds) ? group.anyChoiceIds : [])
          .filter(id => typeof id === "string" && id.length > 0 && id.trim() === id),
      )],
    })).filter(group => group.anyChoiceIds.length > 0),
  }
}

export function articleNodeIsConditional(node) {
  return node?.kind === "conditional"
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function ownDataValue(record, key) {
  if (!isRecord(record)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function ownDataArrayElement(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index))
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function strictArticleDisplayConditionGroups(condition) {
  const all = ownDataValue(condition, "all")
  if (!Array.isArray(all) || all.length === 0) return null

  const groups = []
  for (let groupIndex = 0; groupIndex < all.length; groupIndex += 1) {
    const group = ownDataArrayElement(all, groupIndex)
    const anyChoiceIds = ownDataValue(group, "anyChoiceIds")
    if (!Array.isArray(anyChoiceIds) || anyChoiceIds.length === 0) return null

    const validatedChoiceIds = []
    for (let choiceIndex = 0; choiceIndex < anyChoiceIds.length; choiceIndex += 1) {
      const choiceId = ownDataArrayElement(anyChoiceIds, choiceIndex)
      if (typeof choiceId !== "string" || choiceId.length === 0 || choiceId.trim() !== choiceId) return null
      validatedChoiceIds.push(choiceId)
    }
    groups.push(validatedChoiceIds)
  }
  return groups
}

/**
 * Tests an AND-of-OR display condition against stable IDs selected on the
 * active route. This evaluator requires a same-realm `Set` and deliberately
 * validates raw authored input instead of using normalization: dropping one
 * malformed AND group could otherwise reveal a conditional node.
 */
export function articleDisplayConditionMatches(condition, selectedIds) {
  try {
    const groups = strictArticleDisplayConditionGroups(condition)
    if (!groups || !(selectedIds instanceof Set)) return false
    for (const group of groups) {
      let groupMatched = false
      for (const choiceId of group) {
        if (Set.prototype.has.call(selectedIds, choiceId)) {
          groupMatched = true
          break
        }
      }
      if (!groupMatched) return false
    }
    return true
  } catch {
    return false
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function safelyDisplayId(value) {
  try {
    return String(value)
  } catch {
    return "[unprintable id]"
  }
}

function authoredId(value) {
  if (typeof value !== "string") {
    return { display: safelyDisplayId(value), key: "", issue: "malformed" }
  }
  if (!value) return { display: "", key: "", issue: "missing" }
  if (value.trim() !== value) return { display: value, key: "", issue: "malformed" }
  return { display: value, key: value, issue: "" }
}

function displayText(value, fallback) {
  const text = typeof value === "string" ? value : ""
  return text || fallback
}

function addCount(counts, id) {
  if (!id) return
  counts.set(id, (counts.get(id) || 0) + 1)
}

function idIssueReason(prefix, id) {
  return `${prefix}-id-${id.issue}`
}

function choiceMode(choice) {
  if (choice?.mode === undefined || choice?.mode === "branch") return { value: "branch", reason: "" }
  if (choice.mode === "interaction") return { value: "interaction", reason: "" }
  return { value: "unknown", reason: "choice-mode-malformed" }
}

function sourceReferenceReason(choiceId, sourceNodeId, sourceNodeIds, chapterId, chapterIds, targetId, nodeIds, mode) {
  if (choiceId.issue) return idIssueReason("choice", choiceId)
  if (mode.reason) return mode.reason
  if (sourceNodeId.issue) return idIssueReason("source-node", sourceNodeId)
  if ((sourceNodeIds.get(sourceNodeId.key) || 0) !== 1) return "source-node-id-ambiguous"
  if (chapterId.issue) return idIssueReason("source-chapter", chapterId)
  if (!chapterIds.has(chapterId.key)) return "source-chapter-not-found"
  if ((chapterIds.get(chapterId.key) || 0) !== 1) return "source-chapter-id-ambiguous"

  if (mode.value === "branch") {
    if (targetId.issue) return idIssueReason("branch-target", targetId)
    if (!nodeIds.has(targetId.key)) return "branch-target-not-found"
    if ((nodeIds.get(targetId.key) || 0) !== 1) return "branch-target-ambiguous"
  }
  return ""
}

/**
 * Returns every authored choice in chapter and node structure order.  Catalog
 * records retain malformed references as disabled entries so condition editors
 * can explain the problem instead of linking to a different authored choice.
 */
export function buildArticleChoiceCatalog(work, options = {}) {
  const chapters = asArray(work?.chapters)
  const nodes = asArray(work?.nodes)
  const excludeNodeId = authoredId(options?.excludeNodeId)
  const rawQuery = typeof options?.query === "string" ? options.query : ""
  const query = rawQuery.trim().toLocaleLowerCase()
  const chapterIds = new Map()
  const sourceNodeIds = new Map()
  const nodeIds = new Map()
  const choiceIds = new Map()

  for (const chapter of chapters) addCount(chapterIds, authoredId(chapter?.id).key)
  for (const node of nodes) {
    const nodeId = authoredId(node?.id)
    addCount(sourceNodeIds, nodeId.key)
    addCount(nodeIds, nodeId.key)
    for (const group of asArray(node?.interactionGroups)) {
      for (const choice of asArray(group?.choices)) addCount(choiceIds, authoredId(choice?.id).key)
    }
    for (const choice of asArray(node?.choices)) addCount(choiceIds, authoredId(choice?.id).key)
  }
  const nodesByChapterId = new Map()
  const ungroupedNodes = []
  for (const node of nodes) {
    const chapterId = authoredId(node?.chapterId)
    if (!chapterId.key || !chapterIds.has(chapterId.key)) {
      ungroupedNodes.push(node)
      continue
    }
    const chapterNodes = nodesByChapterId.get(chapterId.key) || []
    chapterNodes.push(node)
    nodesByChapterId.set(chapterId.key, chapterNodes)
  }

  const catalog = []
  const appendNodeChoices = (node, chapter, fallbackChapterName) => {
    const sourceNodeId = authoredId(node?.id)
    if (excludeNodeId.key && sourceNodeId.key === excludeNodeId.key) return
    const chapterId = authoredId(node?.chapterId)
    const chapterName = displayText(chapter?.name, fallbackChapterName)
    const sourceNodeTitle = displayText(node?.title, "Untitled node")

    const appendChoice = (choice, interactionGroup = null) => {
      const choiceId = authoredId(choice?.id)
      const choiceText = displayText(choice?.text, "Untitled choice")
      const selectedText = typeof choice?.selectedText === "string" ? choice.selectedText : ""
      const mode = interactionGroup ? {value:"interaction", reason:""} : choiceMode(choice)
      const targetId = authoredId(choice?.targetId)
      const invalidReason = sourceReferenceReason(choiceId, sourceNodeId, sourceNodeIds, chapterId, chapterIds, targetId, nodeIds, mode)
      const ambiguous = choiceId.key && (choiceIds.get(choiceId.key) || 0) > 1
      const interactionGroupId = interactionGroup ? authoredId(interactionGroup.id) : {display:"", key:"", issue:""}
      const interactionGroupLabel = interactionGroup
        ? displayText(interactionGroup.label, "未命名")
        : ""
      const searchText = [chapterName, sourceNodeTitle, interactionGroupLabel, choiceText, selectedText, sourceNodeId.display, choiceId.display]
        .filter(Boolean)
        .join(" ")
      const searchableDetails = [chapterName, sourceNodeTitle, interactionGroupLabel, choiceText, selectedText, sourceNodeId.key]
        .filter(Boolean)
        .join(" ")

      catalog.push({
        choiceId: choiceId.display,
        choiceText,
        selectedText,
        choiceMode: mode.value,
        sourceNodeId: sourceNodeId.display,
        sourceNodeTitle,
        chapterId: chapterId.display,
        chapterName,
        interactionGroupId: interactionGroupId.display,
        interactionGroupLabel,
        searchText,
        disabled: Boolean(ambiguous || invalidReason),
        reason: ambiguous ? "ambiguous-choice-id" : invalidReason,
        _searchableDetails: searchableDetails,
        _exactChoiceId: choiceId.key,
      })
    }
    const storedGroups = asArray(node?.interactionGroups)
    const groupsById = new Map()
    for (const group of storedGroups) {
      const groupId = authoredId(group?.id)
      if (groupId.key && !groupsById.has(groupId.key)) groupsById.set(groupId.key, group)
    }
    const orderedGroups = []
    const seenGroupIds = new Set()
    for (const groupId of articleInteractionMarkerIds(node?.content || "")) {
      const group = groupsById.get(groupId)
      if (!group || seenGroupIds.has(groupId)) continue
      seenGroupIds.add(groupId)
      orderedGroups.push(group)
    }
    for (const group of storedGroups) {
      const groupId = authoredId(group?.id).key
      if (!groupId || seenGroupIds.has(groupId)) continue
      seenGroupIds.add(groupId)
      orderedGroups.push(group)
    }
    for (const group of orderedGroups) {
      for (const choice of asArray(group?.choices)) appendChoice(choice, group)
    }
    for (const choice of asArray(node?.choices)) appendChoice(choice)
  }

  const visitedChapterIds = new Set()
  for (const chapter of chapters) {
    const chapterId = authoredId(chapter?.id)
    if (!chapterId.key || visitedChapterIds.has(chapterId.key)) continue
    visitedChapterIds.add(chapterId.key)
    for (const node of nodesByChapterId.get(chapterId.key) || []) {
      appendNodeChoices(node, chapter, "Untitled chapter")
    }
  }
  for (const node of ungroupedNodes) appendNodeChoices(node, null, "Missing chapter")

  return catalog
    .filter(choice => !query || choice._exactChoiceId === rawQuery || choice._searchableDetails.toLocaleLowerCase().includes(query))
    .map(({ _searchableDetails, _exactChoiceId, ...choice }) => choice)
}
