import { prepareImportedWork } from "./work-import.js"

export const WORK_COLLECTION_BUNDLE_TYPE = "tuuru-work-collection"
export const WORK_COLLECTION_BUNDLE_VERSION = 1
export const WORK_COLLECTION_ACCESS_MODES = Object.freeze(["separate", "unified"])
export const MAX_WORK_COLLECTION_ITEMS = 100

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function cleanWorkIds(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const ids = []
  value.forEach(raw => {
    const id = cleanText(raw, 200)
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })
  return ids
}

export function normalizeWorkCollection(input, { requireTwoWorks = false } = {}) {
  if (!isRecord(input)) throw new TypeError("作品集结构无效")
  const id = cleanText(input.id, 200)
  const title = cleanText(input.title, 120)
  const workIds = cleanWorkIds(input.workIds)
  if (!id) throw new TypeError("作品集缺少有效 ID")
  if (!title) throw new TypeError("请填写作品集名称")
  if (workIds.length > MAX_WORK_COLLECTION_ITEMS) throw new TypeError("单个作品集最多收录 100 篇作品")
  if (requireTwoWorks && workIds.length < 2) throw new TypeError("作品集至少需要两篇作品")

  const accessMode = input.accessMode === "unified" ? "unified" : "separate"
  const createdAt = Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now()
  const updatedAt = Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : createdAt
  return {
    id,
    title,
    author: cleanText(input.author, 120),
    description: cleanText(input.description, 1200),
    authorNote: cleanText(input.authorNote, 1200),
    coverImage: typeof input.coverImage === "string" ? input.coverImage : "",
    accessMode,
    password: accessMode === "unified" ? cleanText(input.password, 200) : "",
    workIds,
    createdAt,
    updatedAt,
  }
}

export function createWorkCollectionRecord({
  id,
  title,
  author = "",
  description = "",
  authorNote = "",
  coverImage = "",
  accessMode = "separate",
  password = "",
  workIds = [],
  now = Date.now(),
}) {
  return normalizeWorkCollection({
    id,
    title,
    author,
    description,
    authorNote,
    coverImage,
    accessMode,
    password,
    workIds,
    createdAt: now,
    updatedAt: now,
  }, { requireTwoWorks: true })
}

function canonicalExportTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  const iso = date.toISOString()
  if (new Date(iso).toISOString() !== iso) throw new TypeError("作品集导出时间无效")
  return iso
}

export function serializeWorkCollectionBundle(collectionInput, shareableWorks, exportedAt = new Date()) {
  const collection = normalizeWorkCollection(collectionInput)
  if (!Array.isArray(shareableWorks)) throw new TypeError("作品集内容无效")
  const byId = new Map()
  shareableWorks.forEach(work => {
    const id = cleanText(work?.id, 200)
    if (!id || byId.has(id)) throw new TypeError("作品集包含重复或无效作品")
    byId.set(id, cloneJson(work))
  })
  const works = collection.workIds.map(id => {
    const work = byId.get(id)
    if (!work) throw new TypeError("作品集中的作品已不存在，请先编辑作品集")
    return work
  })
  if (works.length === 0) throw new TypeError("空作品集无法导出")
  return JSON.stringify({
    type: WORK_COLLECTION_BUNDLE_TYPE,
    version: WORK_COLLECTION_BUNDLE_VERSION,
    exportedAt: canonicalExportTime(exportedAt),
    collection,
    works,
  }, null, 2)
}

function bundleFailure(message, code = "invalid-work-collection") {
  return { ok: false, code, message }
}

export function prepareWorkCollectionBundle(input, windowObject = globalThis.window || {}) {
  if (!isRecord(input) || input.type !== WORK_COLLECTION_BUNDLE_TYPE) {
    return bundleFailure("该文件不是 Tuuru 作品集")
  }
  if (input.version !== WORK_COLLECTION_BUNDLE_VERSION) {
    return bundleFailure(
      input.version > WORK_COLLECTION_BUNDLE_VERSION
        ? "该作品集由更新版本的 Tuuru 创建，请升级后再导入"
        : "暂不支持该作品集版本",
      "unsupported-work-collection-version",
    )
  }
  let collection
  try {
    collection = normalizeWorkCollection(input.collection)
  } catch (error) {
    return bundleFailure(error instanceof Error ? error.message : "作品集信息无效")
  }
  if (!Array.isArray(input.works) || input.works.length === 0) {
    return bundleFailure("作品集没有包含可导入的作品")
  }
  if (input.works.length > MAX_WORK_COLLECTION_ITEMS) {
    return bundleFailure("单个作品集最多包含 100 篇作品")
  }

  const works = []
  const ids = new Set()
  for (let index = 0; index < input.works.length; index += 1) {
    const result = prepareImportedWork(input.works[index], windowObject)
    if (!result.ok) {
      return bundleFailure(`第 ${index + 1} 篇作品无效：${result.message}`, "invalid-collection-work")
    }
    const id = cleanText(result.work.id, 200)
    if (!id || ids.has(id)) return bundleFailure("作品集包含重复或无效的作品 ID")
    ids.add(id)
    works.push(result.work)
  }
  if (collection.workIds.length !== works.length
    || collection.workIds.some(id => !ids.has(id))) {
    return bundleFailure("作品集目录与实际作品不一致")
  }
  const byId = new Map(works.map(work => [String(work.id), work]))
  return {
    ok: true,
    collection,
    works: collection.workIds.map(id => byId.get(id)),
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
  }
}
