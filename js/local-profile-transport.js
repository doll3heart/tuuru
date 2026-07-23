export const LOCAL_PROFILE_FORMAT = "tuuru-local-profile"
export const LOCAL_PROFILE_VERSION = 1

const AUTHOR_DATABASE_KEY = "tuuru_works"
const AUTHOR_SETTING_KEYS = new Set([
  "tuuru_theme",
  "tuuru_author_placeholder_presets",
  "tuuru_editor_split",
])
const READER_PREFIX = "moirain_"

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseDatabase(raw) {
  const database = JSON.parse(raw || "null")
  if (!isRecord(database)
    || !Array.isArray(database.works)
    || !Array.isArray(database.contacts)
    || !Array.isArray(database.groups)
    || (Object.hasOwn(database, "collections") && !Array.isArray(database.collections))) {
    throw new TypeError("创作库结构无效")
  }
  return { ...database, collections: Array.isArray(database.collections) ? database.collections : [] }
}

function canonicalTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value)
  const iso = date.toISOString()
  if (new Date(iso).toISOString() !== iso) throw new TypeError("导出时间无效")
  return iso
}

function collectEntries(storage, predicate) {
  const entries = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !predicate(key)) continue
    const value = storage.getItem(key)
    if (typeof value === "string") entries[key] = value
  }
  return entries
}

function validateEntryMap(value, predicate, label) {
  if (!isRecord(value)) throw new TypeError(`${label}结构无效`)
  for (const [key, raw] of Object.entries(value)) {
    if (!predicate(key) || typeof raw !== "string") throw new TypeError(`${label}包含无效条目`)
  }
}

export function serializeLocalProfile(storage = localStorage, exportedAt = new Date()) {
  const database = parseDatabase(storage.getItem(AUTHOR_DATABASE_KEY)
    || JSON.stringify({ version: 1, works: [], contacts: [], groups: [] }))
  const profile = {
    format: LOCAL_PROFILE_FORMAT,
    version: LOCAL_PROFILE_VERSION,
    exportedAt: canonicalTimestamp(exportedAt),
    database,
    authorSettings: collectEntries(storage, key => AUTHOR_SETTING_KEYS.has(key)),
    readerEntries: collectEntries(storage, key => key.startsWith(READER_PREFIX)),
  }
  return JSON.stringify(profile, null, 2)
}

export function inspectLocalProfile(raw) {
  try {
    if (typeof raw !== "string") throw new TypeError("搬家包必须是 JSON 文本")
    const profile = JSON.parse(raw.replace(/^\uFEFF/, ""))
    if (!isRecord(profile) || profile.format !== LOCAL_PROFILE_FORMAT) throw new TypeError("不是 Tuuru 本地搬家包")
    if (profile.version !== LOCAL_PROFILE_VERSION) throw new TypeError("搬家包版本暂不支持")
    canonicalTimestamp(profile.exportedAt)
    parseDatabase(JSON.stringify(profile.database))
    validateEntryMap(profile.authorSettings, key => AUTHOR_SETTING_KEYS.has(key), "作者设置")
    validateEntryMap(profile.readerEntries, key => key.startsWith(READER_PREFIX), "读者数据")
    return {
      ok: true,
      profile,
      summary: {
        authorWorkCount: profile.database.works.length,
        authorSettingCount: Object.keys(profile.authorSettings).length,
        readerEntryCount: Object.keys(profile.readerEntries).length,
      },
    }
  } catch (error) {
    return { ok: false, error, message: error instanceof Error ? error.message : "搬家包无效" }
  }
}

function sameJson(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right) } catch { return false }
}

function uniqueId(base, used) {
  const cleanBase = String(base || "item")
  let index = 1
  let candidate = `${cleanBase}-imported-${index}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${cleanBase}-imported-${index}`
  }
  used.add(candidate)
  return candidate
}

function mergeRecordList(current, incoming) {
  const result = current.map(clone)
  const used = new Set(result.map(item => String(item?.id || "")))
  const idMap = new Map()
  let imported = 0
  incoming.forEach(source => {
    const item = clone(source)
    const id = String(item?.id || "")
    const existing = result.find(candidate => String(candidate?.id || "") === id)
    if (!existing) {
      if (!id) item.id = uniqueId("item", used)
      else used.add(id)
      if (id) idMap.set(id, item.id)
      result.push(item)
      imported += 1
      return
    }
    if (sameJson(existing, item)) {
      if (id) idMap.set(id, id)
      return
    }
    item.id = uniqueId(id, used)
    if (id) idMap.set(id, item.id)
    result.push(item)
    imported += 1
  })
  return { records: result, imported, idMap }
}

function parseJsonOrNull(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

function mergeReaderMapEntry(storage, key, raw, readerIdMap) {
  const currentRaw = storage.getItem(key)
  if (currentRaw === null) {
    storage.setItem(key, raw)
    return { imported: 1, preserved: 0 }
  }
  if (currentRaw === raw) return { imported: 0, preserved: 0 }
  const current = parseJsonOrNull(currentRaw)
  const incoming = parseJsonOrNull(raw)
  if (key === "moirain_recent" && Array.isArray(current) && Array.isArray(incoming)) {
    const merged = current.slice()
    const used = new Set(merged.map(item => String(item?.id || "")))
    incoming.forEach(item => {
      const next = clone(item)
      next.id = readerIdMap.get(String(next.id)) || next.id
      if (!used.has(String(next.id))) {
        used.add(String(next.id))
        merged.push(next)
      }
    })
    storage.setItem(key, JSON.stringify(merged))
    return { imported: 1, preserved: 0 }
  }
  if (key === "moirain_collections" && Array.isArray(current) && Array.isArray(incoming)) {
    const adjusted = incoming.map(collection => ({
      ...clone(collection),
      workIds: Array.isArray(collection?.workIds)
        ? collection.workIds.map(id => readerIdMap.get(String(id)) || id)
        : [],
    }))
    const merged = mergeRecordList(current, adjusted)
    storage.setItem(key, JSON.stringify(merged.records))
    return { imported: merged.imported ? 1 : 0, preserved: 0 }
  }
  if ((key === "moirain_placeholders" || key === "moirain_readerPhValues")
    && isRecord(current) && isRecord(incoming)) {
    const merged = { ...current }
    for (const [sourceId, value] of Object.entries(incoming)) {
      const targetId = readerIdMap.get(sourceId) || sourceId
      if (!Object.hasOwn(merged, targetId)) merged[targetId] = clone(value)
    }
    storage.setItem(key, JSON.stringify(merged))
    return { imported: 1, preserved: 0 }
  }
  return { imported: 0, preserved: 1 }
}

export function mergeLocalProfile(storage = localStorage, profile) {
  const inspected = inspectLocalProfile(JSON.stringify(profile))
  if (!inspected.ok) throw inspected.error
  const incoming = inspected.profile
  const currentDatabase = parseDatabase(storage.getItem(AUTHOR_DATABASE_KEY)
    || JSON.stringify({ version: 1, works: [], contacts: [], groups: [] }))
  const workMerge = mergeRecordList(currentDatabase.works, incoming.database.works)
  const contactMerge = mergeRecordList(currentDatabase.contacts, incoming.database.contacts)
  const groupMerge = mergeRecordList(currentDatabase.groups, incoming.database.groups)
  const incomingCollections = incoming.database.collections.map(collection => ({
    ...clone(collection),
    workIds: Array.isArray(collection?.workIds)
      ? collection.workIds.map(id => workMerge.idMap.get(String(id)) || id)
      : [],
  }))
  const collectionMerge = mergeRecordList(currentDatabase.collections, incomingCollections)
  const nextDatabase = {
    ...currentDatabase,
    works: workMerge.records,
    contacts: contactMerge.records,
    groups: groupMerge.records,
    collections: collectionMerge.records,
  }
  storage.setItem(AUTHOR_DATABASE_KEY, JSON.stringify(nextDatabase))

  let importedAuthorSettings = 0
  let importedReaderEntries = 0
  let preservedConflicts = 0
  for (const [key, raw] of Object.entries(incoming.authorSettings)) {
    const currentRaw = storage.getItem(key)
    if (currentRaw === null) {
      storage.setItem(key, raw)
      importedAuthorSettings += 1
    } else if (currentRaw !== raw) {
      preservedConflicts += 1
    }
  }

  const readerEntries = Object.entries(incoming.readerEntries)
  const readerIdMap = new Map()
  const workEntries = readerEntries.filter(([key]) => key.startsWith("moirain_work_"))
  for (const [key, raw] of workEntries) {
    const currentRaw = storage.getItem(key)
    if (currentRaw === null) {
      storage.setItem(key, raw)
      importedReaderEntries += 1
      continue
    }
    if (currentRaw === raw) continue
    const work = parseJsonOrNull(raw)
    const sourceId = String(work?.id || key.slice("moirain_work_".length))
    const used = new Set()
    for (let index = 0; index < storage.length; index += 1) {
      const storedKey = storage.key(index)
      if (storedKey?.startsWith("moirain_work_")) used.add(storedKey.slice("moirain_work_".length))
    }
    const targetId = uniqueId(sourceId, used)
    readerIdMap.set(sourceId, targetId)
    if (isRecord(work)) work.id = targetId
    storage.setItem("moirain_work_" + targetId, JSON.stringify(work ?? raw))
    importedReaderEntries += 1
    preservedConflicts += 1
  }

  for (const [key, raw] of readerEntries.filter(([entryKey]) => !entryKey.startsWith("moirain_work_"))) {
    const outcome = mergeReaderMapEntry(storage, key, raw, readerIdMap)
    importedReaderEntries += outcome.imported
    preservedConflicts += outcome.preserved
  }

  return {
    importedAuthorWorks: workMerge.imported,
    importedAuthorContacts: contactMerge.imported,
    importedAuthorGroups: groupMerge.imported,
    importedAuthorSettings,
    importedReaderEntries,
    preservedConflicts,
  }
}
