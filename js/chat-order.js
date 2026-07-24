function chats(value) {
  return Array.isArray(value) ? value.slice() : []
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

export function orderedChats(value) {
  const source = chats(value)
  return source.filter(chat => chat?.pinned === true)
    .concat(source.filter(chat => chat?.pinned !== true))
}

export function toggleChatPinned(value, chatId) {
  const source = chats(value)
  const index = source.findIndex(chat => sameId(chat?.id, chatId))
  if (index < 0) return { ok:false, reason:"missing-chat", chats:orderedChats(source) }

  const updated = { ...source[index], pinned:source[index]?.pinned !== true }
  source.splice(index, 1)
  const ordered = orderedChats(source)
  if (updated.pinned) {
    ordered.unshift(updated)
  } else {
    const firstOrdinary = ordered.findIndex(chat => chat?.pinned !== true)
    ordered.splice(firstOrdinary < 0 ? ordered.length : firstOrdinary, 0, updated)
  }
  return { ok:true, chats:ordered }
}

export function reorderChats(value, sourceId, targetId, position = "before") {
  const ordered = orderedChats(value)
  const sourceIndex = ordered.findIndex(chat => sameId(chat?.id, sourceId))
  const targetIndex = ordered.findIndex(chat => sameId(chat?.id, targetId))
  if (sourceIndex < 0 || targetIndex < 0) {
    return { ok:false, reason:"missing-chat", chats:ordered }
  }
  if (sourceIndex === targetIndex) return { ok:true, chats:ordered }
  if ((ordered[sourceIndex]?.pinned === true) !== (ordered[targetIndex]?.pinned === true)) {
    return { ok:false, reason:"pin-boundary", chats:ordered }
  }

  const moved = ordered.splice(sourceIndex, 1)[0]
  const nextTargetIndex = ordered.findIndex(chat => sameId(chat?.id, targetId))
  ordered.splice(nextTargetIndex + (position === "after" ? 1 : 0), 0, moved)
  return { ok:true, chats:ordered }
}
