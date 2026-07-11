export const CURRENT_WORK_SCHEMA_VERSION = 1

const SUPPORTED_WORK_TYPES = new Set(["article", "phone"])
const ARTICLE_COLLECTIONS = ["chapters", "phoneModules", "placeholders", "scenes"]
const PHONE_COLLECTIONS = [
  "contacts", "chats", "moments", "forumPosts", "forumNpcs", "apps",
  "memos", "photos", "albums", "browserHistory", "shoppingItems",
]
const MAX_WORK_NESTING_DEPTH = 100

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

function invalidNesting(path) {
  return failure("invalid-work", "作品结构嵌套过深或无法安全检查。", [{
    code: "invalid-nesting",
    path,
    message: "作品结构嵌套过深、包含循环引用或无法检查。",
  }])
}

function inspectNesting(input, path) {
  const active = new WeakSet()
  const stack = [{ value: input, depth: 0, exiting: false }]

  try {
    while (stack.length > 0) {
      const frame = stack.pop()
      const value = frame.value
      if (value === null || typeof value !== "object") continue
      if (frame.exiting) {
        active.delete(value)
        continue
      }
      if (frame.depth > MAX_WORK_NESTING_DEPTH || active.has(value)) {
        return invalidNesting(path)
      }

      active.add(value)
      stack.push({ value, depth: frame.depth, exiting: true })
      const children = Array.isArray(value) ? value : Object.values(value)
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ value: children[index], depth: frame.depth + 1, exiting: false })
      }
    }
  } catch {
    return invalidNesting(path)
  }

  return { ok: true }
}

function failure(code, message, issues = []) {
  return { ok: false, code, message, issues }
}

function recordArray(value, path, { required = false } = {}) {
  if (value === undefined && !required) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return failure("invalid-record-array", "字段必须是对象数组。", [{
      code: "invalid-record-array",
      path,
      message: "字段必须是对象数组。",
    }])
  }
  const invalidIndex = value.findIndex(item => !isRecord(item))
  if (invalidIndex >= 0) {
    return failure("invalid-record-entry", "数组包含无效条目。", [{
      code: "invalid-record-entry",
      path: `${path}[${invalidIndex}]`,
      message: "数组条目必须是对象。",
    }])
  }
  return { ok: true, value: value.map(cloneJsonValue) }
}

function genericArray(value, path, { required = false } = {}) {
  if (value === undefined && !required) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return failure("invalid-array", "字段必须是数组。", [{
      code: "invalid-array",
      path,
      message: "字段必须是数组。",
    }])
  }
  return { ok: true, value: value.map(cloneJsonValue) }
}

function normalizeCollection(owner, key, path, validator = recordArray) {
  const result = validator(owner[key], `${path}.${key}`)
  if (result.ok) owner[key] = result.value
  return result
}

function normalizeChoices(owner, path) {
  const choicesResult = normalizeCollection(owner, "choices", path)
  if (!choicesResult.ok) return choicesResult

  for (let index = 0; index < owner.choices.length; index += 1) {
    const result = normalizeCollection(
      owner.choices[index],
      "followUpMessages",
      `${path}.choices[${index}]`,
    )
    if (!result.ok) return result
  }
  return { ok: true }
}

function normalizeMessages(messages, path) {
  for (let index = 0; index < messages.length; index += 1) {
    const result = normalizeChoices(messages[index], `${path}[${index}]`)
    if (!result.ok) return result
  }
  return { ok: true }
}

function asWorkFailure(result, code, message) {
  return result.ok ? result : failure(code, message, result.issues)
}

function normalizeArticle(input, path) {
  const nodesResult = recordArray(input.nodes, `${path}.nodes`, { required: true })
  if (!nodesResult.ok) return asWorkFailure(nodesResult, "invalid-article", "文章作品结构无效。")

  const work = cloneJsonValue(input)
  work.nodes = nodesResult.value
  for (const key of ARTICLE_COLLECTIONS) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work[key] = result.value
  }
  for (let index = 0; index < work.nodes.length; index += 1) {
    const result = recordArray(input.nodes[index].choices, `${path}.nodes[${index}].choices`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work.nodes[index].choices = result.value
  }
  for (let index = 0; index < work.phoneModules.length; index += 1) {
    const moduleData = input.phoneModules[index].data
    if (moduleData !== undefined && !isRecord(moduleData)) {
      return failure("invalid-article", "文章手机模块结构无效。", [{
        code: "invalid-record",
        path: `${path}.phoneModules[${index}].data`,
        message: "手机模块 data 必须是对象。",
      }])
    }
    if (moduleData !== undefined) {
      const result = normalizePhoneData(moduleData, `${path}.phoneModules[${index}].data`)
      if (!result.ok) return asWorkFailure(result, "invalid-article", "文章手机模块结构无效。")
      work.phoneModules[index].data = result.value
    }
  }
  if (!work.startNode && work.nodes.length > 0) work.startNode = work.nodes[0].id
  return { ok: true, work }
}

function normalizePhoneData(phoneData, path) {
  const normalized = cloneJsonValue(phoneData)
  for (const key of PHONE_COLLECTIONS) {
    const result = recordArray(phoneData[key], `${path}.${key}`)
    if (!result.ok) return result
    normalized[key] = result.value
  }

  for (let index = 0; index < normalized.chats.length; index += 1) {
    const chat = normalized.chats[index]
    const contactIdsResult = normalizeCollection(chat, "contactIds", `${path}.chats[${index}]`, genericArray)
    if (!contactIdsResult.ok) return contactIdsResult
    for (const key of ["messages", "rounds"]) {
      const result = normalizeCollection(chat, key, `${path}.chats[${index}]`)
      if (!result.ok) return result
    }
    const messagesResult = normalizeMessages(chat.messages, `${path}.chats[${index}].messages`)
    if (!messagesResult.ok) return messagesResult
    for (let roundIndex = 0; roundIndex < chat.rounds.length; roundIndex += 1) {
      const round = chat.rounds[roundIndex]
      const roundPath = `${path}.chats[${index}].rounds[${roundIndex}]`
      const result = normalizeCollection(round, "messages", roundPath)
      if (!result.ok) return result
      const nestedResult = normalizeMessages(round.messages, `${roundPath}.messages`)
      if (!nestedResult.ok) return nestedResult
    }
  }

  for (let index = 0; index < normalized.moments.length; index += 1) {
    const moment = normalized.moments[index]
    const momentPath = `${path}.moments[${index}]`
    const imagesResult = normalizeCollection(moment, "images", momentPath, genericArray)
    if (!imagesResult.ok) return imagesResult
    const commentsResult = normalizeCollection(moment, "comments", momentPath)
    if (!commentsResult.ok) return commentsResult
    for (let commentIndex = 0; commentIndex < moment.comments.length; commentIndex += 1) {
      const result = normalizeChoices(
        moment.comments[commentIndex],
        `${momentPath}.comments[${commentIndex}]`,
      )
      if (!result.ok) return result
    }
  }

  for (let index = 0; index < normalized.forumPosts.length; index += 1) {
    const post = normalized.forumPosts[index]
    const postPath = `${path}.forumPosts[${index}]`
    const imagesResult = normalizeCollection(post, "images", postPath, genericArray)
    if (!imagesResult.ok) return imagesResult
    const commentsResult = normalizeCollection(post, "comments", postPath)
    if (!commentsResult.ok) return commentsResult
    for (let commentIndex = 0; commentIndex < post.comments.length; commentIndex += 1) {
      const result = normalizeCollection(
        post.comments[commentIndex],
        "replies",
        `${postPath}.comments[${commentIndex}]`,
      )
      if (!result.ok) return result
    }
  }
  return { ok: true, value: normalized }
}

function validateAndNormalizeWorkUnchecked(input, {
  context = "reader-import",
  path = "$",
} = {}) {
  if (!isRecord(input)) {
    return failure("invalid-work", "文件内容不是有效的 Tuuru 作品对象。", [{
      code: "invalid-record", path, message: "作品必须是对象。",
    }])
  }

  const sourceVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion
  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
    return failure("invalid-version", "作品格式版本无效。", [{
      code: "invalid-version", path: `${path}.schemaVersion`, message: "格式版本必须是非负整数。",
    }])
  }
  if (sourceVersion > CURRENT_WORK_SCHEMA_VERSION) {
    return failure(
      "unsupported-version",
      `该作品使用格式版本 ${sourceVersion}，当前阅读器最高支持版本 ${CURRENT_WORK_SCHEMA_VERSION}。请升级阅读器后重试。`,
      [{ code: "unsupported-version", path: `${path}.schemaVersion`, message: "作品来自更新版本。" }],
    )
  }

  if (!SUPPORTED_WORK_TYPES.has(input.type)) {
    const preservesLegacyType = context !== "reader-import"
      && (input.type === undefined || typeof input.type === "string")
    if (preservesLegacyType) {
      const nestingResult = inspectNesting(input, path)
      if (!nestingResult.ok) return nestingResult
      return {
        ok: true,
        work: cloneJsonValue(input),
        sourceVersion,
        migrated: false,
        warnings: [],
      }
    }
    return failure("unsupported-type", "作品类型无效或当前阅读器不支持。", [{
      code: "unsupported-type", path: `${path}.type`, message: "作品类型不受支持。",
    }])
  }

  const nestingResult = inspectNesting(input, path)
  if (!nestingResult.ok) return nestingResult

  let normalized
  if (input.type === "article") normalized = normalizeArticle(input, path)
  else if (!isRecord(input.phoneData)) {
    normalized = failure("invalid-phone", "手机作品缺少有效的手机数据。", [{
      code: "invalid-record", path: `${path}.phoneData`, message: "phoneData 必须是对象。",
    }])
  } else {
    const phoneResult = normalizePhoneData(input.phoneData, `${path}.phoneData`)
    normalized = phoneResult.ok
      ? { ok: true, work: { ...cloneJsonValue(input), phoneData: phoneResult.value } }
      : asWorkFailure(phoneResult, "invalid-phone", "手机作品结构无效。")
  }
  if (!normalized.ok) return normalized

  normalized.work.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  for (const key of ["placeholders", "scenes"]) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, `invalid-${input.type}`, "作品公共结构无效。")
    normalized.work[key] = result.value
  }
  return {
    ok: true,
    work: normalized.work,
    sourceVersion,
    migrated: sourceVersion < CURRENT_WORK_SCHEMA_VERSION,
    warnings: [],
  }
}

export function validateAndNormalizeWork(input, options = {}) {
  let failurePath = "$"
  try {
    if (typeof options?.path === "string") failurePath = options.path
    return validateAndNormalizeWorkUnchecked(input, options)
  } catch {
    return invalidNesting(failurePath)
  }
}

export function validateWorkForImport(input) {
  return validateAndNormalizeWork(input, { context: "reader-import", path: "$" })
}
