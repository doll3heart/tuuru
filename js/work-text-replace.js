const ROOT_TEXT_KEYS = new Set(["title", "desc", "author", "authorNote"])
const VISIBLE_TEXT_KEYS = new Set([
  "alias",
  "alt",
  "answer",
  "author",
  "authoredName",
  "authorNote",
  "bio",
  "body",
  "caption",
  "content",
  "contactName",
  "default",
  "desc",
  "description",
  "detail",
  "dialogue",
  "displayName",
  "forumId",
  "forumIpLocation",
  "groupName",
  "hint",
  "ipLocation",
  "label",
  "location",
  "msgId",
  "name",
  "note",
  "prefix",
  "price",
  "prompt",
  "question",
  "reactionText",
  "reply",
  "replyText",
  "selectedText",
  "speaker",
  "status",
  "suffix",
  "text",
  "time",
  "title",
  "quoteText",
  "username",
])
const VISIBLE_STRING_ARRAY_KEYS = new Set([
  "exactForbidden",
  "forbidden",
  "followUpLines",
  "globalExactForbidden",
  "globalForbidden",
  "keywords",
  "tags",
  "values",
])
const APPROVED_ROOT_BRANCHES = new Set([
  "chapters",
  "globalExactForbidden",
  "globalForbidden",
  "interactiveScenes",
  "nodes",
  "phoneData",
  "phoneModules",
  "placeholders",
  "scenes",
  "watermark",
])
const DYNAMIC_VISIBLE_RECORD_KEYS = new Set(["groupTitles"])

const CATEGORY_BY_SEGMENT = new Map([
  ["chapters", "章节"],
  ["scenes", "场景"],
  ["nodes", "文章正文"],
  ["interactiveScenes", "互动图片"],
  ["phoneModules", "文章内手机"],
  ["placeholders", "占位符"],
  ["contacts", "联系人"],
  ["chats", "消息"],
  ["moments", "朋友圈"],
  ["forumPosts", "论坛"],
  ["forumNpcs", "论坛"],
  ["memos", "备忘录"],
  ["photos", "相册"],
  ["albums", "相册"],
  ["browserHistory", "浏览器"],
  ["shoppingItems", "购物"],
  ["apps", "App"],
])

const FIELD_LABELS = new Map([
  ["alias", "别名"],
  ["alt", "替代文字"],
  ["answer", "回答"],
  ["author", "作者"],
  ["authoredName", "署名"],
  ["authorNote", "作者说明"],
  ["bio", "简介"],
  ["body", "正文"],
  ["caption", "说明"],
  ["content", "正文"],
  ["contactName", "角色名"],
  ["default", "默认值"],
  ["desc", "作品描述"],
  ["description", "描述"],
  ["detail", "详情"],
  ["dialogue", "台词"],
  ["displayName", "显示名称"],
  ["forumId", "论坛昵称"],
  ["forumIpLocation", "IP 属地"],
  ["groupName", "群聊名称"],
  ["hint", "提示文字"],
  ["ipLocation", "IP 属地"],
  ["label", "名称"],
  ["location", "位置"],
  ["msgId", "聊天昵称"],
  ["name", "名称"],
  ["note", "备注"],
  ["prefix", "前缀"],
  ["price", "价格"],
  ["prompt", "提示"],
  ["question", "问题"],
  ["reactionText", "反馈文字"],
  ["reply", "回复"],
  ["replyText", "回复文字"],
  ["selectedText", "选择后文字"],
  ["speaker", "说话人"],
  ["status", "状态"],
  ["suffix", "后缀"],
  ["text", "文字"],
  ["time", "时间文字"],
  ["title", "标题"],
  ["quoteText", "引用文字"],
  ["username", "用户名"],
  ["values", "候选值"],
  ["exactForbidden", "完全匹配禁用词"],
  ["forbidden", "禁用词"],
  ["followUpLines", "后续文字"],
  ["globalExactForbidden", "全局完全匹配禁用词"],
  ["globalForbidden", "全局禁用词"],
  ["keywords", "关键词"],
  ["tags", "标签"],
])

const HTML_TOKEN_SOURCE = "<!--[\\s\\S]*?-->|<[^>]*>|&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);"

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function approvedScalarPath(path) {
  if (path.length === 1) return ROOT_TEXT_KEYS.has(path[0])
  return APPROVED_ROOT_BRANCHES.has(path[0])
}

function fieldKind(path) {
  return path[0] === "nodes"
    && typeof path[1] === "number"
    && path.length === 3
    && path[2] === "content"
    ? "html"
    : "plain"
}

function literalPattern(search, caseSensitive) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(escaped, caseSensitive ? "gu" : "giu")
}

function transformPlainText(source, search, replacement, caseSensitive, replace) {
  let occurrences = 0
  const output = source.replace(literalPattern(search, caseSensitive), match => {
    occurrences += 1
    return replace ? replacement : match
  })
  return { value: output, occurrences }
}

function transformHtmlText(source, search, replacement, caseSensitive, replace) {
  const tokenPattern = new RegExp(HTML_TOKEN_SOURCE, "gi")
  let cursor = 0
  let output = ""
  let occurrences = 0
  for (const token of source.matchAll(tokenPattern)) {
    const text = source.slice(cursor, token.index)
    const transformed = transformPlainText(text, search, replacement, caseSensitive, replace)
    output += transformed.value + token[0]
    occurrences += transformed.occurrences
    cursor = token.index + token[0].length
  }
  const tail = transformPlainText(source.slice(cursor), search, replacement, caseSensitive, replace)
  return {
    value: output + tail.value,
    occurrences: occurrences + tail.occurrences,
  }
}

function transformField(source, kind, search, replacement, caseSensitive, replace) {
  return kind === "html"
    ? transformHtmlText(source, search, replacement, caseSensitive, replace)
    : transformPlainText(source, search, replacement, caseSensitive, replace)
}

function visiblePreview(source, kind) {
  const text = kind === "html"
    ? source.replace(new RegExp(HTML_TOKEN_SOURCE, "gi"), " ")
    : source
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= 120) return compact
  return `${compact.slice(0, 117)}…`
}

function categoryDetails(path) {
  let category = "作品信息"
  let collectionIndex = -1
  for (let index = 0; index < path.length; index += 1) {
    const mapped = CATEGORY_BY_SEGMENT.get(path[index])
    if (!mapped) continue
    category = mapped
    collectionIndex = index
  }
  const itemIndex = collectionIndex >= 0 && typeof path[collectionIndex + 1] === "number"
    ? path[collectionIndex + 1]
    : null
  return {
    category,
    location: itemIndex === null ? category : `${category} · 第 ${itemIndex + 1} 项`,
  }
}

function matchFor(path, source, search, caseSensitive) {
  const kind = fieldKind(path)
  const { occurrences } = transformField(source, kind, search, "", caseSensitive, false)
  if (!occurrences) return null
  const rawField = typeof path.at(-1) === "number" ? path.at(-2) : path.at(-1)
  const { category, location } = categoryDetails(path)
  return {
    id: JSON.stringify(path),
    path: path.slice(),
    category,
    location,
    field: FIELD_LABELS.get(rawField) || String(rawField),
    preview: visiblePreview(source, kind),
    occurrences,
    kind,
  }
}

function collectMatches(work, search, caseSensitive) {
  const matches = []
  const stack = [{ value:work, path:[], dynamicVisible:false }]
  while (stack.length) {
    const current = stack.pop()
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        const child = current.value[index]
        const path = [...current.path, index]
        if (typeof child === "string" && VISIBLE_STRING_ARRAY_KEYS.has(current.path.at(-1)) && approvedScalarPath(path)) {
          const match = matchFor(path, child, search, caseSensitive)
          if (match) matches.push(match)
        } else if (isRecord(child) || Array.isArray(child)) {
          stack.push({ value:child, path, dynamicVisible:current.dynamicVisible })
        }
      }
      continue
    }
    if (!isRecord(current.value)) continue
    const entries = Object.entries(current.value)
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, child] = entries[index]
      const path = [...current.path, key]
      const dynamicVisible = current.dynamicVisible || DYNAMIC_VISIBLE_RECORD_KEYS.has(current.path.at(-1))
      if (
        typeof child === "string"
        && approvedScalarPath(path)
        && (VISIBLE_TEXT_KEYS.has(key) || dynamicVisible)
      ) {
        const match = matchFor(path, child, search, caseSensitive)
        if (match) matches.push(match)
      } else if (isRecord(child) || Array.isArray(child)) {
        stack.push({
          value:child,
          path,
          dynamicVisible:DYNAMIC_VISIBLE_RECORD_KEYS.has(key),
        })
      }
    }
  }
  return matches
}

function valueAtPath(root, path) {
  let value = root
  for (const segment of path) value = value?.[segment]
  return value
}

function setValueAtPath(root, path, value) {
  let target = root
  for (let index = 0; index < path.length - 1; index += 1) target = target[path[index]]
  target[path.at(-1)] = value
}

export function findWorkTextMatches(work, options = {}) {
  const search = typeof options.search === "string" ? options.search : ""
  if (!isRecord(work) || !search) return []
  return collectMatches(work, search, options.caseSensitive === true)
}

export function replaceWorkText(work, options = {}) {
  const search = typeof options.search === "string" ? options.search : ""
  const replacement = typeof options.replacement === "string" ? options.replacement : ""
  if (!isRecord(work) || !search) {
    return { work, matchedFields:0, replacementCount:0, changed:false }
  }
  const matches = collectMatches(work, search, options.caseSensitive === true)
  const selected = Array.isArray(options.selectedMatchIds)
    ? new Set(options.selectedMatchIds.filter(id => typeof id === "string"))
    : null
  const chosen = selected ? matches.filter(match => selected.has(match.id)) : matches
  if (!chosen.length) return { work, matchedFields:0, replacementCount:0, changed:false }

  let next = null
  let matchedFields = 0
  let replacementCount = 0
  for (const match of chosen) {
    const source = valueAtPath(work, match.path)
    if (typeof source !== "string") continue
    const transformed = transformField(
      source,
      match.kind,
      search,
      replacement,
      options.caseSensitive === true,
      true,
    )
    if (!transformed.occurrences || transformed.value === source) continue
    if (!next) next = structuredClone(work)
    setValueAtPath(next, match.path, transformed.value)
    matchedFields += 1
    replacementCount += transformed.occurrences
  }
  return next
    ? { work:next, matchedFields, replacementCount, changed:true }
    : { work, matchedFields:0, replacementCount:0, changed:false }
}
