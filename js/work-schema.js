export const CURRENT_WORK_SCHEMA_VERSION = 1

const SUPPORTED_WORK_TYPES = new Set(["article", "phone"])

function failure(code, message, details = {}) {
  return { ok: false, code, message, ...details }
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : []
}

function normalizePhoneData(phoneData) {
  return {
    ...phoneData,
    contacts: arrayOrEmpty(phoneData.contacts),
    chats: arrayOrEmpty(phoneData.chats),
    moments: arrayOrEmpty(phoneData.moments),
    forumPosts: arrayOrEmpty(phoneData.forumPosts),
    forumNpcs: arrayOrEmpty(phoneData.forumNpcs),
    apps: arrayOrEmpty(phoneData.apps),
    memos: arrayOrEmpty(phoneData.memos),
    photos: arrayOrEmpty(phoneData.photos),
    albums: arrayOrEmpty(phoneData.albums),
    browserHistory: arrayOrEmpty(phoneData.browserHistory),
    shoppingItems: arrayOrEmpty(phoneData.shoppingItems),
  }
}

export function validateWorkForImport(input) {
  if (!input || Array.isArray(input) || typeof input !== "object") {
    return failure("invalid-work", "文件内容不是有效的 Tuuru 作品对象。")
  }

  const sourceVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion
  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
    return failure("invalid-version", "作品格式版本无效。")
  }
  if (sourceVersion > CURRENT_WORK_SCHEMA_VERSION) {
    return failure(
      "unsupported-version",
      `该作品使用格式版本 ${sourceVersion}，当前阅读器最高支持版本 ${CURRENT_WORK_SCHEMA_VERSION}。请升级阅读器后重试。`,
      { sourceVersion },
    )
  }

  if (!SUPPORTED_WORK_TYPES.has(input.type)) {
    return failure("unsupported-type", "作品类型无效或当前阅读器不支持。")
  }

  if (input.type === "article" && !Array.isArray(input.nodes)) {
    return failure("invalid-article", "文章作品缺少有效的节点列表。")
  }

  if (input.type === "phone" && (!input.phoneData || Array.isArray(input.phoneData) || typeof input.phoneData !== "object")) {
    return failure("invalid-phone", "手机作品缺少有效的手机数据。")
  }

  const work = {
    ...input,
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    placeholders: arrayOrEmpty(input.placeholders),
    scenes: arrayOrEmpty(input.scenes),
  }

  if (work.type === "article") {
    work.chapters = arrayOrEmpty(input.chapters)
    work.phoneModules = arrayOrEmpty(input.phoneModules)
    if (!work.startNode && work.nodes.length > 0) work.startNode = work.nodes[0].id
  } else {
    work.phoneData = normalizePhoneData(input.phoneData)
  }

  return {
    ok: true,
    work,
    sourceVersion,
    migrated: sourceVersion < CURRENT_WORK_SCHEMA_VERSION,
  }
}
