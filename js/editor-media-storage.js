import {
  EDITOR_MEDIA_REFERENCE_STORE,
  EDITOR_MEDIA_STORE,
  editorAssetRequest,
  editorAssetTransaction,
  openEditorAssetDatabase,
} from "./editor-asset-database.js"

const MEDIA_REFERENCE_PREFIX = "asset://"
const SHA256_PATTERN = /^[a-f0-9]{64}$/

async function defaultHashBytes(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("当前浏览器无法校验本地素材")
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")
}

const defaultRepository = {
  async getAsset(id) {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(EDITOR_MEDIA_STORE, "readonly")
    return editorAssetRequest(transaction.objectStore(EDITOR_MEDIA_STORE).get(id))
  },
  async putAsset(record) {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(EDITOR_MEDIA_STORE, "readwrite")
    transaction.objectStore(EDITOR_MEDIA_STORE).put(record)
    await editorAssetTransaction(transaction)
  },
  async syncReferences(workId, assetIds) {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(
      [EDITOR_MEDIA_REFERENCE_STORE, EDITOR_MEDIA_STORE],
      "readwrite",
    )
    const references = transaction.objectStore(EDITOR_MEDIA_REFERENCE_STORE)
    const media = transaction.objectStore(EDITOR_MEDIA_STORE)
    const previous = await editorAssetRequest(references.index("workId").getAll(workId))
    const desired = new Set(assetIds)
    const removed = []

    for (const reference of previous || []) {
      if (desired.has(reference.assetId)) continue
      references.delete(reference.key)
      removed.push(reference.assetId)
    }
    for (const assetId of desired) {
      references.put({ key: `${workId}:${assetId}`, workId, assetId })
    }
    for (const assetId of new Set(removed)) {
      const countRequest = references.index("assetId").count(assetId)
      countRequest.onsuccess = function() {
        if (countRequest.result === 0) media.delete(assetId)
      }
    }
    await editorAssetTransaction(transaction)
  },
  async listAssets() {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(EDITOR_MEDIA_STORE, "readonly")
    return editorAssetRequest(transaction.objectStore(EDITOR_MEDIA_STORE).getAll())
  },
  async countReferences(assetId) {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(EDITOR_MEDIA_REFERENCE_STORE, "readonly")
    return editorAssetRequest(transaction.objectStore(EDITOR_MEDIA_REFERENCE_STORE).index("assetId").count(assetId))
  },
  async deleteAsset(assetId) {
    const database = await openEditorAssetDatabase()
    const transaction = database.transaction(EDITOR_MEDIA_STORE, "readwrite")
    transaction.objectStore(EDITOR_MEDIA_STORE).delete(assetId)
    await editorAssetTransaction(transaction)
  },
  createObjectURL(blob) {
    return globalThis.URL.createObjectURL(blob)
  },
  revokeObjectURL(url) {
    globalThis.URL.revokeObjectURL(url)
  },
}

export function editorMediaAssetReference(assetId) {
  const normalized = String(assetId || "").toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) throw new TypeError("素材 ID 无效")
  return `${MEDIA_REFERENCE_PREFIX}${normalized}`
}

export function parseEditorMediaAssetId(value) {
  const source = String(value || "")
  if (!source.startsWith(MEDIA_REFERENCE_PREFIX)) return ""
  const assetId = source.slice(MEDIA_REFERENCE_PREFIX.length).toLowerCase()
  return SHA256_PATTERN.test(assetId) ? assetId : ""
}

export async function persistEditorMediaAsset(blob, options = {}, repository = defaultRepository) {
  if (!blob || typeof blob.arrayBuffer !== "function") throw new TypeError("本地素材文件无效")
  const bytes = await blob.arrayBuffer()
  const hashBytes = options.hashBytes || defaultHashBytes
  const assetId = String(await hashBytes(bytes)).toLowerCase()
  if (!SHA256_PATTERN.test(assetId)) throw new TypeError("素材摘要无效")

  const existing = await repository.getAsset(assetId)
  if (!existing) {
    await repository.putAsset({
      id: assetId,
      blob,
      type: String(blob.type || options.type || "application/octet-stream"),
      bytes: Number(blob.size) || bytes.byteLength,
      fileName: String(options.fileName || "").slice(0, 240),
      createdAt: Number((options.now || Date.now)()),
    })
  }
  return editorMediaAssetReference(assetId)
}

export function dataUrlToEditorMediaBlob(dataUrl, BlobConstructor = globalThis.Blob) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i)
  if (!match || typeof globalThis.atob !== "function" || typeof BlobConstructor !== "function") {
    throw new TypeError("本地素材数据无效")
  }
  const binary = globalThis.atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new BlobConstructor([bytes], { type: match[1] })
}

export async function persistEditorMediaDataUrl(dataUrl, options = {}, repository = defaultRepository) {
  return persistEditorMediaAsset(dataUrlToEditorMediaBlob(dataUrl), options, repository)
}

export async function resolveEditorMediaAssetUrl(value, repository = defaultRepository) {
  const assetId = parseEditorMediaAssetId(value)
  if (!assetId) return String(value || "")
  const record = await repository.getAsset(assetId)
  if (!record?.blob) return ""
  const createObjectURL = repository.createObjectURL || defaultRepository.createObjectURL
  return createObjectURL(record.blob)
}

export async function loadEditorMediaAsset(value, repository = defaultRepository) {
  const assetId = parseEditorMediaAssetId(value)
  if (!assetId) throw new TypeError("不是本地素材引用")
  const record = await repository.getAsset(assetId)
  if (!record?.blob) throw new Error(`本地素材缺失：${assetId.slice(0, 12)}`)
  return {
    id:assetId,
    blob:record.blob,
    type:String(record.type || record.blob.type || "application/octet-stream"),
    fileName:String(record.fileName || ""),
    bytes:Number(record.bytes || record.blob.size) || 0,
  }
}

export function createEditorMediaUrlResolver(repository = defaultRepository) {
  const urls = new Map()
  const pending = new Map()
  let released = false
  return {
    async resolve(value) {
      const assetId = parseEditorMediaAssetId(value)
      if (!assetId) return String(value || "")
      if (released) return ""
      if (urls.has(assetId)) return urls.get(assetId)
      if (!pending.has(assetId)) {
        pending.set(assetId, resolveEditorMediaAssetUrl(value, repository).then(url => {
          pending.delete(assetId)
          if (released && url) {
            const revokeObjectURL = repository.revokeObjectURL || defaultRepository.revokeObjectURL
            try { revokeObjectURL(url) } catch (_) {}
            return ""
          }
          if (url) urls.set(assetId, url)
          return url
        }))
      }
      return pending.get(assetId)
    },
    release() {
      released = true
      const revokeObjectURL = repository.revokeObjectURL || defaultRepository.revokeObjectURL
      for (const url of urls.values()) {
        try { revokeObjectURL(url) } catch (_) {}
      }
      urls.clear()
    },
  }
}

export function collectEditorMediaAssetIds(value) {
  const ids = []
  const seenIds = new Set()
  const seenObjects = new WeakSet()
  const stack = [value]
  while (stack.length) {
    const current = stack.pop()
    if (typeof current === "string") {
      const assetId = parseEditorMediaAssetId(current)
      if (assetId && !seenIds.has(assetId)) {
        seenIds.add(assetId)
        ids.push(assetId)
      }
      continue
    }
    if (!current || typeof current !== "object") continue
    if (seenObjects.has(current)) continue
    seenObjects.add(current)
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) stack.push(current[index])
    } else {
      const values = Object.values(current)
      for (let index = values.length - 1; index >= 0; index -= 1) stack.push(values[index])
    }
  }
  return ids
}

export async function syncEditorMediaAssetReferences(workId, value, repository = defaultRepository) {
  const normalizedWorkId = String(workId || "").trim()
  if (!normalizedWorkId) throw new TypeError("作品 ID 无效")
  const assetIds = collectEditorMediaAssetIds(value)
  if (repository === defaultRepository && !globalThis.indexedDB && assetIds.length === 0) return
  await repository.syncReferences(normalizedWorkId, assetIds)
}

export async function replaceEditorMediaLibraryReferences(works) {
  if (!globalThis.indexedDB) return
  const database = await openEditorAssetDatabase()
  const readTransaction = database.transaction(EDITOR_MEDIA_REFERENCE_STORE, "readonly")
  const previous = await editorAssetRequest(readTransaction.objectStore(EDITOR_MEDIA_REFERENCE_STORE).getAll())
  const desired = []
  for (const work of Array.isArray(works) ? works : []) {
    const workId = String(work?.id || "").trim()
    if (!workId) continue
    for (const assetId of collectEditorMediaAssetIds(work)) {
      desired.push({ key:`${workId}:${assetId}`, workId, assetId })
    }
  }
  const transaction = database.transaction(EDITOR_MEDIA_REFERENCE_STORE, "readwrite")
  const references = transaction.objectStore(EDITOR_MEDIA_REFERENCE_STORE)
  for (const reference of previous || []) {
    if (!String(reference?.workId || "").startsWith("reader:")) references.delete(reference.key)
  }
  for (const reference of desired) references.put(reference)
  await editorAssetTransaction(transaction)
  await garbageCollectEditorMediaAssets()
}

export async function loadEditorMediaAssets(value, repository = defaultRepository) {
  const assets = []
  for (const assetId of collectEditorMediaAssetIds(value)) {
    const record = await repository.getAsset(assetId)
    if (!record?.blob) throw new Error(`本地素材缺失：${assetId.slice(0, 12)}`)
    assets.push({
      id: assetId,
      type: String(record.type || record.blob.type || "application/octet-stream"),
      fileName: String(record.fileName || ""),
      blob: record.blob,
    })
  }
  return assets
}

export async function garbageCollectEditorMediaAssets(repository = defaultRepository) {
  const assets = await repository.listAssets()
  let removed = 0
  for (const asset of assets || []) {
    if (!asset?.id) continue
    if (await repository.countReferences(asset.id)) continue
    await repository.deleteAsset(asset.id)
    removed += 1
  }
  return removed
}
