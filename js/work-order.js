function isPinned(work) {
  return work?.pinned === true
}

function cloneList(works) {
  return Array.isArray(works) ? works.slice() : []
}

function combineGroups(works, pinned, orderedGroup) {
  const otherGroup = works.filter(work => isPinned(work) !== pinned)
  return pinned ? orderedGroup.concat(otherGroup) : otherGroup.concat(orderedGroup)
}

export function orderedWorks(works) {
  const list = cloneList(works)
  return list.filter(isPinned).concat(list.filter(work => !isPinned(work)))
}

export function moveWorkBefore(works, workId, targetId) {
  const list = cloneList(works)
  const source = list.find(work => String(work?.id) === String(workId))
  const target = list.find(work => String(work?.id) === String(targetId))
  if (!source || !target || source === target || isPinned(source) !== isPinned(target)) {
    return { works:list, changed:false }
  }
  const pinned = isPinned(source)
  const group = list.filter(work => isPinned(work) === pinned)
  const from = group.indexOf(source)
  const to = group.indexOf(target)
  group.splice(from, 1)
  group.splice(to > from ? to - 1 : to, 0, source)
  const next = combineGroups(list, pinned, group)
  const changed = next.some((work, index) => work !== list[index])
  return { works:next, changed }
}

export function moveWorkByOffset(works, workId, offset) {
  const list = cloneList(works)
  const source = list.find(work => String(work?.id) === String(workId))
  if (!source || !Number.isInteger(offset) || offset === 0) return { works:list, changed:false }
  const pinned = isPinned(source)
  const group = list.filter(work => isPinned(work) === pinned)
  const from = group.indexOf(source)
  const to = Math.max(0, Math.min(group.length - 1, from + offset))
  if (from === to) return { works:list, changed:false }
  group.splice(from, 1)
  group.splice(to, 0, source)
  return { works:combineGroups(list, pinned, group), changed:true }
}

export function toggleWorkPinnedRecord(works, workId, pinned) {
  const list = cloneList(works)
  const index = list.findIndex(work => String(work?.id) === String(workId))
  if (index < 0 || isPinned(list[index]) === (pinned === true)) return { works:list, changed:false }
  const nextRecord = { ...list[index] }
  if (pinned === true) nextRecord.pinned = true
  else delete nextRecord.pinned
  list.splice(index, 1)
  if (pinned === true) {
    const lastPinned = list.reduce((found, work, current) => isPinned(work) ? current : found, -1)
    list.splice(lastPinned + 1, 0, nextRecord)
  } else {
    const firstOrdinary = list.findIndex(work => !isPinned(work))
    list.splice(firstOrdinary < 0 ? list.length : firstOrdinary, 0, nextRecord)
  }
  return { works:list, changed:true }
}
