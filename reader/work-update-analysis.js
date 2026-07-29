const MAX_SUMMARY_ITEMS = 4

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function array(value) {
  return Array.isArray(value) ? value.filter(record) : []
}

function exactId(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function recordsById(values) {
  const result = new Map()
  for (const value of array(values)) {
    if (exactId(value.id) && !result.has(value.id)) result.set(value.id, value)
  }
  return result
}

function countAddedRecords(previous, incoming) {
  const before = recordsById(previous)
  let count = 0
  for (const id of recordsById(incoming).keys()) {
    if (!before.has(id)) count += 1
  }
  return count
}

function stableValue(value, key = "") {
  if (key === "release" || key === "updatedAt") return undefined
  if (Array.isArray(value)) return value.map(item => stableValue(item) ?? null)
  if (record(value)) {
    const result = {}
    for (const childKey of Object.keys(value).sort()) {
      const child = stableValue(value[childKey], childKey)
      if (child !== undefined) result[childKey] = child
    }
    return result
  }
  return value
}

function countChangedRecords(previous, incoming) {
  const before = recordsById(previous)
  let count = 0
  for (const [id, value] of recordsById(incoming)) {
    const oldValue = before.get(id)
    if (!oldValue) continue
    if (JSON.stringify(stableValue(oldValue)) !== JSON.stringify(stableValue(value))) count += 1
  }
  return count
}

function phoneRoots(work) {
  const roots = []
  if (record(work?.phoneData)) roots.push(work.phoneData)
  for (const module of array(work?.phoneModules)) {
    if (record(module.data)) roots.push(module.data)
  }
  return roots
}

function phoneRecords(work, key) {
  return phoneRoots(work).flatMap(root => array(root[key]))
}

function phoneMessages(work) {
  const result = []
  for (const chat of phoneRecords(work, "chats")) {
    result.push(...array(chat.messages))
    for (const round of array(chat.rounds)) result.push(...array(round.messages))
  }
  return result
}

function imageValues(work) {
  const values = []
  for (const root of phoneRoots(work)) {
    for (const owner of [
      ...array(root.forumPosts),
      ...array(root.moments),
      ...phoneMessages({ phoneData:root }),
    ]) {
      if (typeof owner.image === "string" && owner.image) values.push(owner.image)
      for (const image of Array.isArray(owner.images) ? owner.images : []) {
        if (typeof image === "string" && image) values.push(image)
      }
    }
  }
  return values
}

function countAddedValues(previous, incoming) {
  const remaining = new Map()
  for (const value of previous) remaining.set(value, (remaining.get(value) || 0) + 1)
  let added = 0
  for (const value of incoming) {
    const count = remaining.get(value) || 0
    if (count > 0) remaining.set(value, count - 1)
    else added += 1
  }
  return added
}

function pushCount(items, count, unit, label) {
  if (count > 0 && items.length < MAX_SUMMARY_ITEMS) {
    items.push(`新增 ${count} ${unit}${label}`)
  }
}

export function summarizeReaderWorkUpdate(previous, incoming) {
  if (
    !record(previous)
    || !record(incoming)
    || !exactId(previous.id)
    || previous.id !== incoming.id
    || previous.type !== incoming.type
  ) {
    return []
  }

  const items = []
  if (incoming.type === "article") {
    pushCount(items, countAddedRecords(previous.chapters, incoming.chapters), "个", "章节")
    pushCount(items, countAddedRecords(previous.nodes, incoming.nodes), "段", "正文")
    const changed = countChangedRecords(previous.nodes, incoming.nodes)
    if (changed > 0 && items.length < MAX_SUMMARY_ITEMS) items.push(`修改 ${changed} 段正文`)
  }

  pushCount(items, countAddedRecords(phoneMessages(previous), phoneMessages(incoming)), "条", "消息")
  pushCount(
    items,
    countAddedRecords(phoneRecords(previous, "forumPosts"), phoneRecords(incoming, "forumPosts")),
    "篇",
    "帖子",
  )
  pushCount(
    items,
    countAddedRecords(phoneRecords(previous, "memos"), phoneRecords(incoming, "memos")),
    "条",
    "备忘录",
  )
  const addedImages = countAddedRecords(
    phoneRecords(previous, "photos"),
    phoneRecords(incoming, "photos"),
  ) + countAddedValues(imageValues(previous), imageValues(incoming))
  pushCount(items, addedImages, "张", "图片")
  return items.slice(0, MAX_SUMMARY_ITEMS)
}
