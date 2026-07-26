export const ARTICLE_INTERACTION_MARKER_CLASS = "article-interaction-anchor"
export const ARTICLE_INTERACTION_MARKER_ATTRIBUTE = "data-article-interaction-group"

const SAFE_GROUP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function exactId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.trim() === value
}

function safeGroupId(value) {
  return exactId(value) && SAFE_GROUP_ID.test(value)
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key)
}

function choiceRecord(choice) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return null
  if (!exactId(choice.id)) return null
  const next = {
    ...choice,
    id:choice.id,
    text:typeof choice.text === "string" ? choice.text : "",
    selectedText:own(choice, "selectedText")
      ? (typeof choice.selectedText === "string" ? choice.selectedText : "")
      : (typeof choice.text === "string" ? choice.text : ""),
  }
  delete next.mode
  delete next.targetId
  return next
}

function groupRecord(group) {
  if (!group || typeof group !== "object" || Array.isArray(group)) return null
  if (!safeGroupId(group.id)) return null
  return {
    ...group,
    id:group.id,
    label:typeof group.label === "string" ? group.label : "",
    legacyAdvanceOnSelect:group.legacyAdvanceOnSelect === true,
  }
}

function generatedExactId(idFactory, reserved, kind) {
  if (typeof idFactory !== "function") return {ok:false, reason:`${kind}-id-factory-required`}
  let id
  try {
    id = idFactory()
  } catch {
    return {ok:false, reason:`${kind}-id-factory-failed`}
  }
  if (!exactId(id) || (kind === "group" && !safeGroupId(id))) {
    return {ok:false, reason:`invalid-generated-${kind}-id`}
  }
  if (reserved.has(id)) return {ok:false, reason:`generated-${kind}-id-conflict`}
  reserved.add(id)
  return {ok:true, id}
}

export function articleInteractionMarkerHTML(groupId) {
  if (!safeGroupId(groupId)) return ""
  return `<div class="${ARTICLE_INTERACTION_MARKER_CLASS}" ${ARTICLE_INTERACTION_MARKER_ATTRIBUTE}="${groupId}" contenteditable="false"></div>`
}

export function articleInteractionMarkerIds(content) {
  if (typeof content !== "string" || !content) return []
  const ids = []
  const markerPattern = new RegExp(
    `<div\\b(?=[^>]*\\bclass=(?:"[^"]*\\b${ARTICLE_INTERACTION_MARKER_CLASS}\\b[^"]*"|'[^']*\\b${ARTICLE_INTERACTION_MARKER_CLASS}\\b[^']*'))(?=[^>]*\\b${ARTICLE_INTERACTION_MARKER_ATTRIBUTE}=(?:"([^"]*)"|'([^']*)'))[^>]*>\\s*<\\/div>`,
    "gi",
  )
  let match
  while ((match = markerPattern.exec(content))) {
    const id = match[1] ?? match[2] ?? ""
    if (safeGroupId(id)) ids.push(id)
  }
  return ids
}

export function normalizeArticleInteractionGroups(groups) {
  const source = asArray(groups)
  const groupIds = new Set()
  const choiceIds = new Set()
  const normalized = []

  for (const rawGroup of source) {
    const group = groupRecord(rawGroup)
    if (!group) return {ok:false, reason:"invalid-group"}
    if (groupIds.has(group.id)) return {ok:false, reason:"duplicate-group-id"}
    groupIds.add(group.id)

    const choices = []
    for (const rawChoice of asArray(rawGroup.choices)) {
      const choice = choiceRecord(rawChoice)
      if (!choice) return {ok:false, reason:"invalid-choice"}
      if (choiceIds.has(choice.id)) return {ok:false, reason:"duplicate-choice-id"}
      choiceIds.add(choice.id)
      choices.push(choice)
    }
    group.choices = choices
    normalized.push(group)
  }
  return {ok:true, groups:normalized}
}

export function migrateLegacyArticleInteractions(node, idFactory) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return {ok:false, reason:"invalid-node"}
  }
  const existingGroups = normalizeArticleInteractionGroups(node.interactionGroups)
  if (!existingGroups.ok) return existingGroups

  const branchChoices = []
  const interactionChoices = []
  for (const choice of asArray(node.choices)) {
    if (choice?.mode === "interaction") {
      const normalizedChoice = choiceRecord(choice)
      if (!normalizedChoice) return {ok:false, reason:"invalid-legacy-choice"}
      interactionChoices.push(normalizedChoice)
    } else {
      branchChoices.push(choice)
    }
  }

  if (!interactionChoices.length) {
    return {
      ok:true,
      migrated:false,
      node:{
        ...node,
        choices:branchChoices.slice(),
        interactionGroups:existingGroups.groups,
      },
    }
  }

  const reserved = new Set(existingGroups.groups.map(group => group.id))
  const generated = generatedExactId(idFactory, reserved, "group")
  if (!generated.ok) return generated
  const group = {
    id:generated.id,
    label:"",
    choices:interactionChoices,
    // Version 3 interaction choices always continued the chapter after selection,
    // including when the same node also carried plot branches. Keep that route
    // behavior only on migrated groups; newly authored version 4 groups stay inline.
    legacyAdvanceOnSelect:true,
  }
  const marker = articleInteractionMarkerHTML(group.id)
  const content = `${typeof node.content === "string" ? node.content : ""}${marker}`
  return {
    ok:true,
    migrated:true,
    node:{
      ...node,
      content,
      choices:branchChoices.slice(),
      interactionGroups:[...existingGroups.groups, group],
    },
  }
}

export function reconcileArticleInteractionGroup(existingGroup, draft, idFactory) {
  const existing = groupRecord(existingGroup)
  if (!existing || !draft || typeof draft !== "object" || Array.isArray(draft)) {
    return {ok:false, reason:"invalid-group"}
  }
  const groupId = safeGroupId(draft.id) ? draft.id : existing.id
  if (groupId !== existing.id) return {ok:false, reason:"group-id-mismatch"}

  const existingChoices = new Map()
  for (const rawChoice of asArray(existingGroup.choices)) {
    const choice = choiceRecord(rawChoice)
    if (!choice) return {ok:false, reason:"invalid-existing-choice"}
    if (existingChoices.has(choice.id)) return {ok:false, reason:"duplicate-existing-choice-id"}
    existingChoices.set(choice.id, choice)
  }

  const supplied = new Set()
  const reserved = new Set(existingChoices.keys())
  const choices = []
  for (const rawDraft of asArray(draft.choices)) {
    if (!rawDraft || typeof rawDraft !== "object" || Array.isArray(rawDraft)) {
      return {ok:false, reason:"invalid-choice-draft"}
    }
    let id = exactId(rawDraft.id) ? rawDraft.id : ""
    if (id) {
      if (supplied.has(id)) return {ok:false, reason:"duplicate-choice-id"}
      supplied.add(id)
    } else {
      const generated = generatedExactId(idFactory, reserved, "choice")
      if (!generated.ok) return generated
      id = generated.id
    }
    const prior = existingChoices.get(id)
    const selectedText = typeof rawDraft.selectedText === "string"
      ? rawDraft.selectedText
      : (prior?.selectedText ?? "")
    choices.push({
      ...(prior || {}),
      ...rawDraft,
      id,
      text:typeof rawDraft.text === "string" ? rawDraft.text : "",
      selectedText,
    })
  }

  return {
    ok:true,
    group:{
      ...existing,
      label:typeof draft.label === "string" ? draft.label : existing.label,
      legacyAdvanceOnSelect:draft.legacyAdvanceOnSelect === true,
      choices,
    },
  }
}

export function moveArticleInteractionGroup(groups, groupId, toIndex) {
  const source = asArray(groups)
  const fromIndex = source.findIndex(group => group?.id === groupId)
  if (fromIndex < 0) return {ok:false, reason:"group-not-found", groups:source.slice()}
  const boundedIndex = Math.max(0, Math.min(Number(toIndex) || 0, source.length - 1))
  const next = source.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(boundedIndex, 0, moved)
  return {ok:true, groups:next}
}
