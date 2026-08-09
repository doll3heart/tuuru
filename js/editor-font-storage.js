import {
  EDITOR_FONT_STORE,
  editorAssetRequest,
  editorAssetTransaction,
  openEditorAssetDatabase,
} from "./editor-asset-database.js"

const defaultRepository = {
  async put(record) {
    var db = await openEditorAssetDatabase()
    var tx = db.transaction(EDITOR_FONT_STORE, "readwrite")
    tx.objectStore(EDITOR_FONT_STORE).put(record)
    await editorAssetTransaction(tx)
  },
  async get(key) {
    var db = await openEditorAssetDatabase()
    var tx = db.transaction(EDITOR_FONT_STORE, "readonly")
    return editorAssetRequest(tx.objectStore(EDITOR_FONT_STORE).get(key))
  },
  async delete(key) {
    var db = await openEditorAssetDatabase()
    var tx = db.transaction(EDITOR_FONT_STORE, "readwrite")
    tx.objectStore(EDITOR_FONT_STORE).delete(key)
    await editorAssetTransaction(tx)
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
