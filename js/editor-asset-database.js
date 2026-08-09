export const EDITOR_ASSET_DATABASE_NAME = "tuuru_editor_assets"
export const EDITOR_ASSET_DATABASE_VERSION = 2
export const EDITOR_FONT_STORE = "fonts"
export const EDITOR_MEDIA_STORE = "media"
export const EDITOR_MEDIA_REFERENCE_STORE = "mediaRefs"

let databasePromise = null

export function editorAssetRequest(request, fallbackMessage = "本地素材存储失败") {
  return new Promise(function(resolve, reject) {
    request.onsuccess = function() { resolve(request.result) }
    request.onerror = function() { reject(request.error || new Error(fallbackMessage)) }
  })
}

export function editorAssetTransaction(transaction, fallbackMessage = "本地素材存储失败") {
  return new Promise(function(resolve, reject) {
    transaction.oncomplete = function() { resolve() }
    transaction.onabort = function() { reject(transaction.error || new Error(fallbackMessage)) }
    transaction.onerror = function() { reject(transaction.error || new Error(fallbackMessage)) }
  })
}

export function openEditorAssetDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("当前浏览器不支持本地素材存储"))
  if (databasePromise) return databasePromise
  databasePromise = new Promise(function(resolve, reject) {
    const request = globalThis.indexedDB.open(EDITOR_ASSET_DATABASE_NAME, EDITOR_ASSET_DATABASE_VERSION)
    request.onupgradeneeded = function() {
      const database = request.result
      if (!database.objectStoreNames.contains(EDITOR_FONT_STORE)) {
        database.createObjectStore(EDITOR_FONT_STORE, { keyPath: "key" })
      }
      if (!database.objectStoreNames.contains(EDITOR_MEDIA_STORE)) {
        database.createObjectStore(EDITOR_MEDIA_STORE, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(EDITOR_MEDIA_REFERENCE_STORE)) {
        const references = database.createObjectStore(EDITOR_MEDIA_REFERENCE_STORE, { keyPath: "key" })
        references.createIndex("workId", "workId", { unique: false })
        references.createIndex("assetId", "assetId", { unique: false })
      }
    }
    request.onsuccess = function() {
      const database = request.result
      database.onversionchange = function() {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = function() {
      databasePromise = null
      reject(request.error || new Error("无法打开本地素材库"))
    }
    request.onblocked = function() {
      databasePromise = null
      reject(new Error("本地素材库正在被另一个页面使用，请关闭其他编辑页后重试"))
    }
  })
  return databasePromise
}
