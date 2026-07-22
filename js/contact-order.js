const SORT_MODES = new Set(["custom", "az"])

export function normalizeContactSortMode(value) {
  return SORT_MODES.has(value) ? value : "custom"
}

function contactName(contact) {
  return String(contact?.name || contact?.msgId || contact?.forumId || "").trim()
}

function compareNames(left, right) {
  return contactName(left).localeCompare(contactName(right), "zh-CN", {
    numeric: true,
    sensitivity: "base",
  })
}

export function orderedContacts(contacts, mode = "custom") {
  const source = Array.isArray(contacts) ? contacts.filter(Boolean) : []
  const normalizedMode = normalizeContactSortMode(mode)
  const pinned = source.filter(contact => contact.pinned === true)
  const regular = source.filter(contact => contact.pinned !== true)
  if (normalizedMode === "az") {
    pinned.sort(compareNames)
    regular.sort(compareNames)
  }
  return pinned.concat(regular)
}

export function reorderContacts(contacts, sourceId, targetId, position = "before") {
  const ordered = orderedContacts(contacts, "custom")
  const sourceIndex = ordered.findIndex(contact => String(contact.id) === String(sourceId))
  const targetIndex = ordered.findIndex(contact => String(contact.id) === String(targetId))
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return { ok:false, contacts:ordered, reason:"contact-not-found" }
  }
  if ((ordered[sourceIndex].pinned === true) !== (ordered[targetIndex].pinned === true)) {
    return { ok:false, contacts:ordered, reason:"pin-boundary" }
  }
  const next = ordered.slice()
  const [source] = next.splice(sourceIndex, 1)
  let insertionIndex = next.findIndex(contact => String(contact.id) === String(targetId))
  if (position === "after") insertionIndex += 1
  next.splice(insertionIndex, 0, source)
  return { ok:true, contacts:next }
}
