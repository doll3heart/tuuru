function cloneValue(value, seen = new WeakMap()) {
  if (!value || typeof value !== "object") return value
  if (seen.has(value)) return seen.get(value)

  if (Array.isArray(value)) {
    const clone = []
    seen.set(value, clone)
    for (const entry of value) clone.push(cloneValue(entry, seen))
    return clone
  }

  const clone = {}
  seen.set(value, clone)
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = cloneValue(nestedValue, seen)
  }
  return clone
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isUsableId(id) {
  return (
    (typeof id === "string" && id.length > 0)
    || (typeof id === "number" && Number.isFinite(id))
  )
}

function isGeneratedItem(value, assignedId) {
  return isRecord(value) && Object.is(value.id, assignedId)
}

export function applyThreadChoice(items, ownerItemId, choiceIndex, options) {
  if (!Array.isArray(items)) {
    return { ok: false, reason: "items-array-required" }
  }

  const ownerIndexes = []
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.id === ownerItemId) ownerIndexes.push(index)
  }

  if (ownerIndexes.length === 0) {
    return { ok: false, reason: "owner-item-not-found" }
  }
  if (ownerIndexes.length > 1) {
    return { ok: false, reason: "owner-item-ambiguous" }
  }

  const ownerIndex = ownerIndexes[0]
  const owner = items[ownerIndex]
  if (!Array.isArray(owner?.choices)) {
    return { ok: false, reason: "owner-choices-required" }
  }

  if (
    !Number.isInteger(choiceIndex)
    || choiceIndex < 0
    || choiceIndex >= owner.choices.length
    || !isRecord(owner.choices[choiceIndex])
  ) {
    return { ok: false, reason: "choice-not-found" }
  }

  if (typeof options?.idFactory !== "function") {
    return { ok: false, reason: "id-factory-required" }
  }

  const choice = owner.choices[choiceIndex]
  const hasReply = typeof choice.replyText === "string" && choice.replyText.length > 0
  const followUps = Array.isArray(choice.followUpMessages)
    ? choice.followUpMessages
    : []

  if (hasReply && typeof options.createReply !== "function") {
    return { ok: false, reason: "create-reply-required" }
  }
  if (followUps.length > 0 && typeof options.createFollowUp !== "function") {
    return { ok: false, reason: "create-follow-up-required" }
  }

  const generationPlan = []
  if (hasReply) generationPlan.push({ type: "reply" })
  for (let index = 0; index < followUps.length; index += 1) {
    generationPlan.push({ type: "follow-up", index })
  }

  const existingIds = new Set(items.map(item => item?.id))
  const assignedIds = new Set()
  for (const entry of generationPlan) {
    let id
    try {
      id = options.idFactory()
    } catch {
      return { ok: false, reason: "id-factory-failed" }
    }

    if (!isUsableId(id)) {
      return { ok: false, reason: "invalid-generated-id" }
    }
    if (existingIds.has(id) || assignedIds.has(id)) {
      return { ok: false, reason: "generated-id-conflict" }
    }

    assignedIds.add(id)
    entry.id = id
  }

  const generatedItems = []
  let replyItemId = null

  for (const entry of generationPlan) {
    let generatedItem
    if (entry.type === "reply") {
      try {
        generatedItem = options.createReply({
          id: entry.id,
          owner: cloneValue(owner),
          choice: cloneValue(choice),
        })
      } catch {
        return { ok: false, reason: "create-reply-failed" }
      }

      if (!isGeneratedItem(generatedItem, entry.id)) {
        return { ok: false, reason: "invalid-reply-item" }
      }
      replyItemId = entry.id
    } else {
      try {
        generatedItem = options.createFollowUp({
          id: entry.id,
          owner: cloneValue(owner),
          choice: cloneValue(choice),
          template: cloneValue(followUps[entry.index]),
          index: entry.index,
        })
      } catch {
        return { ok: false, reason: "create-follow-up-failed" }
      }

      if (!isGeneratedItem(generatedItem, entry.id)) {
        return { ok: false, reason: "invalid-follow-up-item" }
      }
    }

    generatedItems.push(cloneValue(generatedItem))
  }

  const nextItems = cloneValue(items)
  nextItems.splice(ownerIndex + 1, 0, ...generatedItems)

  return {
    ok: true,
    items: nextItems,
    run: {
      ownerItemId,
      choiceIndex,
      generatedItemIds: generationPlan.map(entry => entry.id),
      replyItemId,
    },
  }
}

export function rollbackThreadChoice(items, run) {
  if (!Array.isArray(items)) return cloneValue(items)

  const generatedItemIds = new Set(
    Array.isArray(run?.generatedItemIds) ? run.generatedItemIds : [],
  )

  return cloneValue(items).filter(item => !generatedItemIds.has(item?.id))
}
