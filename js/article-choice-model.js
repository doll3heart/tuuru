const UNGROUPED_CHAPTER_NAME = "未分章"
const UNTITLED_CHAPTER_NAME = "未命名章节"
const UNTITLED_NODE_TITLE = "未命名节点"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function hasId(value) {
  return typeof value === "string" && value.length > 0
}

function choiceText(draft) {
  return draft?.text ?? ""
}

function choiceTargetId(draft) {
  return draft?.targetId ?? ""
}

function applyChoiceMode(choice, draft) {
  if (draft?.mode === "interaction") choice.mode = "interaction"
  else delete choice.mode
  return choice
}

export function reconcileArticleChoices(existingChoices, drafts, idFactory) {
  const existing = asArray(existingChoices)
  const nextDrafts = asArray(drafts)
  const existingById = new Map()

  for (const choice of existing) {
    if (!hasId(choice?.id)) continue
    const matches = existingById.get(choice.id) || []
    matches.push(choice)
    existingById.set(choice.id, matches)
  }

  const suppliedDraftIds = new Set()
  for (const draft of nextDrafts) {
    if (!hasId(draft?.id)) continue
    if (suppliedDraftIds.has(draft.id)) {
      return { ok: false, reason: "duplicate-draft-id" }
    }
    suppliedDraftIds.add(draft.id)
  }

  const reservedIds = new Set(suppliedDraftIds)
  for (const choice of existing) {
    if (hasId(choice?.id)) reservedIds.add(choice.id)
  }

  const choices = []
  for (const draft of nextDrafts) {
    const matches = hasId(draft?.id) ? (existingById.get(draft.id) || []) : []
    if (matches.length > 1) {
      return { ok: false, reason: "existing-choice-id-ambiguous" }
    }

    if (matches.length === 1) {
      choices.push(applyChoiceMode({
        ...matches[0],
        text: choiceText(draft),
        targetId: choiceTargetId(draft),
      }, draft))
      continue
    }

    if (typeof idFactory !== "function") {
      return { ok: false, reason: "id-factory-required" }
    }

    let generatedId
    try {
      generatedId = idFactory()
    } catch {
      return { ok: false, reason: "id-factory-failed" }
    }

    if (!hasId(generatedId) || generatedId.trim().length === 0) {
      return { ok: false, reason: "invalid-generated-id" }
    }
    if (reservedIds.has(generatedId)) {
      return { ok: false, reason: "generated-id-conflict" }
    }
    reservedIds.add(generatedId)

    choices.push(applyChoiceMode({
      ...draft,
      id: generatedId,
      text: choiceText(draft),
      targetId: choiceTargetId(draft),
    }, draft))
  }

  return { ok: true, choices }
}

function chapterName(chapter) {
  return chapter?.name || UNTITLED_CHAPTER_NAME
}

function nodeTitle(node) {
  return node?.title || UNTITLED_NODE_TITLE
}

function targetEntry(node, group, sourceNodeId) {
  const title = nodeTitle(node)
  return {
    nodeId: node?.id ?? "",
    title,
    chapterId: group.chapterId,
    chapterName: group.chapterName,
    pathLabel: `${group.chapterName} → ${title}`,
    disabled: false,
  }
}

export function buildArticleTargetList(work, options = {}) {
  const chapters = asArray(work?.chapters)
  const nodes = asArray(work?.nodes)
  const sourceNodeId = options?.sourceNodeId || ""
  const query = String(options?.query || "").trim().toLocaleLowerCase()
  const groups = chapters.map(chapter => ({
    chapterId: chapter?.id ?? "",
    chapterName: chapterName(chapter),
    nodes: [],
  }))
  const firstGroupByChapterId = new Map()

  groups.forEach(group => {
    if (!firstGroupByChapterId.has(group.chapterId)) {
      firstGroupByChapterId.set(group.chapterId, group)
    }
  })

  let ungrouped = null
  for (const node of nodes) {
    const group = firstGroupByChapterId.get(node?.chapterId)
    if (group) {
      group.nodes.push(targetEntry(node, group, sourceNodeId))
      continue
    }

    if (!ungrouped) {
      ungrouped = {
        chapterId: "",
        chapterName: UNGROUPED_CHAPTER_NAME,
        nodes: [],
      }
    }
    ungrouped.nodes.push(targetEntry(node, ungrouped, sourceNodeId))
  }

  if (ungrouped) groups.push(ungrouped)
  if (!query) return groups

  return groups
    .map(group => ({
      ...group,
      nodes: group.nodes.filter(node => (
        node.title.toLocaleLowerCase().includes(query)
        || node.chapterName.toLocaleLowerCase().includes(query)
        || node.pathLabel.toLocaleLowerCase().includes(query)
      )),
    }))
    .filter(group => group.nodes.length > 0)
}

export function describeArticleTarget(work, nodeId) {
  const matches = asArray(work?.nodes).filter(node => node?.id === nodeId)
  if (matches.length === 0) {
    return { ok: false, reason: "target-not-found" }
  }
  if (matches.length > 1) {
    return { ok: false, reason: "target-ambiguous" }
  }

  const node = matches[0]
  const chapter = asArray(work?.chapters).find(item => item?.id === node?.chapterId) || null
  const displayChapterName = chapter ? chapterName(chapter) : UNGROUPED_CHAPTER_NAME
  return {
    ok: true,
    node,
    chapter,
    pathLabel: `${displayChapterName} → ${nodeTitle(node)}`,
  }
}
