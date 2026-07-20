const DATABASE_NAME = "tuuru_editor_assets"
const DATABASE_VERSION = 1
const FONT_STORE = "fonts"

let databasePromise = null

function requestResult(request) {
  return new Promise(function(resolve, reject) {
    request.onsuccess = function() { resolve(request.result) }
    request.onerror = function() { reject(request.error || new Error("字体资产存储失败")) }
  })
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("当前浏览器不支持本地字体资产存储"))
  if (databasePromise) return databasePromise
  databasePromise = new Promise(function(resolve, reject) {
    var request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = function() {
      if (!request.result.objectStoreNames.contains(FONT_STORE)) request.result.createObjectStore(FONT_STORE, {keyPath:"key"})
    }
    request.onsuccess = function() { resolve(request.result) }
    request.onerror = function() { reject(request.error || new Error("无法打开本地字体资产库")) }
  })
  return databasePromise
}

const defaultRepository = {
  async put(record) {
    var db = await openDatabase()
    var tx = db.transaction(FONT_STORE, "readwrite")
    await requestResult(tx.objectStore(FONT_STORE).put(record))
  },
  async get(key) {
    var db = await openDatabase()
    var tx = db.transaction(FONT_STORE, "readonly")
    return requestResult(tx.objectStore(FONT_STORE).get(key))
  },
  async delete(key) {
    var db = await openDatabase()
    var tx = db.transaction(FONT_STORE, "readwrite")
    await requestResult(tx.objectStore(FONT_STORE).delete(key))
  },
}

export function editorFontAssetKey(workId, fontId) {
  return String(workId) + ":" + String(fontId)
}

export async function persistEditorFontAsset(font, repository = defaultRepository) {
  var metadata = {id:font.fontId, name:font.name, value:font.value, format:font.format}
  await repository.put({key:editorFontAssetKey(font.workId, font.fontId), blob:font.blob})
  return metadata
}

export async function resolveEditorFontAssets(workId, fonts, repository = defaultRepository) {
  var createObjectURL = repository.createObjectURL || function(blob) { return URL.createObjectURL(blob) }
  var resolved = []
  for (var i = 0; i < (fonts || []).length; i++) {
    var font = fonts[i]
    if (!font?.id || font.data) continue
    var record = await repository.get(editorFontAssetKey(workId, font.id))
    if (record?.blob) resolved.push(Object.assign({}, font, {url:createObjectURL(record.blob)}))
  }
  return resolved
}

export async function deleteEditorFontAsset(workId, fontId, repository = defaultRepository) {
  if (fontId) await repository.delete(editorFontAssetKey(workId, fontId))
}
