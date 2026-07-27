const PHONE_KINDS = new Map([
  ["messages", { label:"消息", collection:"chats" }],
  ["forum", { label:"论坛", collection:"forumPosts" }],
  ["memo", { label:"备忘录", collection:"memos" }],
])

const SEARCHABLE_TEXT_KEYS = new Set([
  "answer",
  "authoredName",
  "body",
  "caption",
  "contactName",
  "content",
  "description",
  "dialogue",
  "displayName",
  "followUpLines",
  "groupName",
  "label",
  "name",
  "note",
  "prompt",
  "question",
  "quoteText",
  "reactionText",
  "reply",
  "replyText",
  "selectedText",
  "speaker",
  "status",
  "text",
  "title",
  "username",
])

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function exactId(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function decodeEntity(entity) {
  const body = entity.slice(1, -1)
  if (body[0] === "#") {
    const hexadecimal = body[1]?.toLowerCase() === "x"
    const raw = hexadecimal ? body.slice(2) : body.slice(1)
    const codePoint = Number.parseInt(raw, hexadecimal ? 16 : 10)
    if (Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
      try {
        return String.fromCodePoint(codePoint)
      } catch (_) {
        return " "
      }
    }
    return " "
  }
  return {
    amp:"&",
    apos:"'",
    gt:">",
    lt:"<",
    nbsp:" ",
    quot:'"',
  }[body.toLowerCase()] || " "
}

function htmlText(value) {
  return compact(
    String(value || "")
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, decodeEntity),
  )
}

function uniqueRecordIndex(items) {
  const index = new Map()
  const duplicates = new Set()
  for (const item of Array.isArray(items) ? items : []) {
    const id = item?.id
    if (!exactId(id)) continue
    if (index.has(id)) duplicates.add(id)
    else index.set(id, item)
  }
  for (const id of duplicates) index.delete(id)
  return index
}

function collectVisibleText(value, output = [], seen = new WeakSet(), depth = 0, key = "") {
  if (depth > 12 || output.length >= 300) return output
  if (typeof value === "string") {
    if (!SEARCHABLE_TEXT_KEYS.has(key)) return output
    const text = compact(value)
    if (text) output.push(text)
    return output
  }
  if (!value || typeof value !== "object") return output
  if (seen.has(value)) return output
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectVisibleText(item, output, seen, depth + 1, key)
    return output
  }
  for (const [childKey, child] of Object.entries(value)) {
    collectVisibleText(child, output, seen, depth + 1, childKey)
  }
  return output
}

function selectedNodeText(node, state) {
  const pieces = []
  const choiceMemory = record(state?.choiceMemory) ? state.choiceMemory : {}
  const selectedChoiceId = exactId(choiceMemory[node.id]) ? choiceMemory[node.id] : ""
  if (selectedChoiceId) {
    const matches = (Array.isArray(node.choices) ? node.choices : [])
      .filter(choice => choice?.id === selectedChoiceId)
    if (matches.length === 1) {
      const choice = matches[0]
      pieces.push(compact(choice.text), compact(choice.selectedText))
    }
  }
  const interactionSelections = record(state?.interactionSelections)
    ? state.interactionSelections
    : {}
  for (const group of Array.isArray(node.interactionGroups) ? node.interactionGroups : []) {
    const selection = interactionSelections[group?.id]
    if (!record(selection) || selection.nodeId !== node.id || !exactId(selection.choiceId)) continue
    const matches = (Array.isArray(group.choices) ? group.choices : [])
      .filter(choice => choice?.id === selection.choiceId)
    if (matches.length !== 1) continue
    pieces.push(compact(matches[0].text), compact(matches[0].selectedText))
  }
  return pieces.filter(Boolean).join(" ")
}

function articleEntries(work, path, state) {
  const nodeIndex = uniqueRecordIndex(work.nodes)
  const chapterIndex = uniqueRecordIndex(work.chapters)
  const seen = new Set()
  const entries = []
  for (let pathIndex = 0; pathIndex < path.length; pathIndex += 1) {
    const nodeId = path[pathIndex]
    if (!exactId(nodeId) || seen.has(nodeId)) continue
    const node = nodeIndex.get(nodeId)
    if (!node || node.kind === "conditional" || node.kind === "interactive-scene") continue
    seen.add(nodeId)
    const chapterTitle = compact(chapterIndex.get(node.chapterId)?.name)
    const nodeTitle = compact(node.title) || "阅读片段"
    const text = compact([htmlText(node.content), selectedNodeText(node, state)].filter(Boolean).join(" "))
    if (!text) continue
    entries.push({
      id:`article:${nodeId}`,
      kind:"article",
      kindLabel:"正文",
      nodeId,
      pathIndex,
      location:[chapterTitle, nodeTitle].filter(Boolean).join(" · "),
      title:nodeTitle,
      text,
    })
  }
  return entries
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function moduleOwnedByUnlockedNode(module, unlockedNodes, unlockedNodeRecords) {
  if (exactId(module?.nodeId) && unlockedNodes.has(module.nodeId)) return module.nodeId
  if (!exactId(module?.id)) return ""
  const marker = new RegExp(
    `data-pm-id\\s*=\\s*(?:"${escapePattern(module.id)}"|'${escapePattern(module.id)}')`,
    "i",
  )
  const owner = unlockedNodeRecords.find(node => marker.test(String(node?.content || "")))
  return exactId(owner?.id) ? owner.id : ""
}

function itemLabel(kind, item, index) {
  const preferred = kind === "messages"
    ? item?.groupName || item?.name || item?.title || item?.contactName
    : item?.title || item?.name || item?.username || item?.authoredName
  return compact(preferred) || `${PHONE_KINDS.get(kind).label} ${index + 1}`
}

function phoneEntries(work, path) {
  const unlockedNodes = new Set(path.filter(exactId))
  const nodeIndex = uniqueRecordIndex(work.nodes)
  const chapterIndex = uniqueRecordIndex(work.chapters)
  const unlockedNodeRecords = [...unlockedNodes].map(id => nodeIndex.get(id)).filter(Boolean)
  const entries = []
  for (const module of Array.isArray(work.phoneModules) ? work.phoneModules : []) {
    const definition = PHONE_KINDS.get(module?.type)
    if (!definition) continue
    const ownerNodeId = moduleOwnedByUnlockedNode(module, unlockedNodes, unlockedNodeRecords)
    if (!ownerNodeId) continue
    const ownerNode = nodeIndex.get(ownerNodeId)
    if (!ownerNode) continue
    const collection = module?.data?.[definition.collection]
    if (!Array.isArray(collection)) continue
    collection.forEach((item, itemIndex) => {
      if (!record(item)) return
      const text = compact(collectVisibleText(item).join(" "))
      if (!text) return
      const chapterTitle = compact(chapterIndex.get(ownerNode.chapterId)?.name)
      const ownerTitle = compact(ownerNode.title) || "阅读片段"
      const title = itemLabel(module.type, item, itemIndex)
      entries.push({
        id:`${module.type}:${module.id || ownerNodeId}:${itemIndex}`,
        kind:module.type,
        kindLabel:definition.label,
        nodeId:ownerNodeId,
        moduleId:exactId(module.id) ? module.id : "",
        itemIndex,
        location:[chapterTitle, ownerTitle, definition.label].filter(Boolean).join(" · "),
        title,
        text,
      })
    })
  }
  return entries
}

function searchSnippet(text, originalIndex, queryLength) {
  const start = Math.max(0, originalIndex - 42)
  const end = Math.min(text.length, originalIndex + queryLength + 68)
  return {
    before:(start > 0 ? "…" : "") + text.slice(start, originalIndex),
    match:text.slice(originalIndex, originalIndex + queryLength),
    after:text.slice(originalIndex + queryLength, end) + (end < text.length ? "…" : ""),
  }
}

export function buildUnlockedReaderSearchIndex(work, path, state = {}) {
  if (!record(work) || work.type !== "article" || !Array.isArray(path)) return []
  const cleanPath = path.filter(exactId)
  if (!cleanPath.length) return []
  return [
    ...articleEntries(work, cleanPath, state),
    ...phoneEntries(work, cleanPath),
  ]
}

export function searchUnlockedReaderIndex(entries, query, limit = 50) {
  if (!Array.isArray(entries)) return []
  const needle = compact(query).toLocaleLowerCase()
  if (!needle) return []
  const safeLimit = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 50
  const results = []
  for (const entry of entries) {
    if (!record(entry) || typeof entry.text !== "string") continue
    const index = entry.text.toLocaleLowerCase().indexOf(needle)
    if (index < 0) continue
    results.push({
      ...entry,
      snippet:searchSnippet(entry.text, index, needle.length),
    })
    if (results.length >= safeLimit) break
  }
  return results
}
