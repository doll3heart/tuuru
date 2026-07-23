import { prepareWorkCollectionBundle } from "../js/work-collections.js"

export const READER_COLLECTIONS_KEY = "moirain_collections"
export const READER_WORK_KEY_PREFIX = "moirain_work_"

function parseStoredCollections(raw) {
  if (raw == null) return []
  const value = JSON.parse(raw)
  if (!Array.isArray(value)) throw new TypeError("本地作品集目录已损坏")
  return value
}

export function inspectReaderCollectionBundle(input, storage, windowObject = globalThis.window || {}) {
  const prepared = prepareWorkCollectionBundle(input, windowObject)
  if (!prepared.ok) return prepared
  const existingCollections = parseStoredCollections(storage.getItem(READER_COLLECTIONS_KEY))
  const existingWorkCount = prepared.works.filter(work => storage.getItem(READER_WORK_KEY_PREFIX + work.id) !== null).length
  return {
    ...prepared,
    existingCollections,
    replacingCollection: existingCollections.some(collection => collection?.id === prepared.collection.id),
    existingWorkCount,
  }
}

export function installReaderCollection(storage, inspected, now = Date.now()) {
  if (!inspected?.ok) throw new TypeError("作品集尚未通过导入检查")
  const workKeys = inspected.works.map(work => READER_WORK_KEY_PREFIX + work.id)
  const keys = [...new Set([READER_COLLECTIONS_KEY, ...workKeys])]
  const before = new Map(keys.map(key => [key, storage.getItem(key)]))
  const importedCollection = {
    ...inspected.collection,
    importedAt: Number(now),
  }
  const nextCollections = inspected.existingCollections
    .filter(collection => collection?.id !== importedCollection.id)
    .concat(importedCollection)
  try {
    inspected.works.forEach((work, index) => storage.setItem(workKeys[index], JSON.stringify(work)))
    storage.setItem(READER_COLLECTIONS_KEY, JSON.stringify(nextCollections))
  } catch (error) {
    keys.forEach(key => {
      const previous = before.get(key)
      try {
        if (previous === null) storage.removeItem(key)
        else storage.setItem(key, previous)
      } catch (_) {}
    })
    throw error
  }
  return { collection: importedCollection, works: inspected.works }
}
