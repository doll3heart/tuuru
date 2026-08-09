import {
  garbageCollectEditorMediaAssets,
  loadEditorMediaAssets,
  parseEditorMediaAssetId,
  persistEditorMediaAsset,
  replaceEditorMediaLibraryReferences,
} from "./editor-media-storage.js"
import {
  MAX_LOCAL_DATABASE_BACKUP_BYTES,
  serializeLocalDatabaseBackup,
} from "./storage.js"

function bytesToBase64(bytes) {
  let output = ""
  const chunkSize = 3 * 16384
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize))
    let binary = ""
    for (let index = 0; index < chunk.length; index += 1) binary += String.fromCharCode(chunk[index])
    output += globalThis.btoa(binary)
  }
  return output
}

function base64ToBytes(value) {
  const binary = globalThis.atob(String(value || ""))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function serializeLocalDatabaseBackupWithMedia(
  storage = localStorage,
  exportedAt = new Date(),
  loadAssets = loadEditorMediaAssets,
) {
  const backup = JSON.parse(serializeLocalDatabaseBackup(storage, exportedAt))
  const assets = await loadAssets(backup.database)
  backup.backupVersion = 2
  backup.mediaAssets = []
  for (const asset of assets) {
    const bytes = new Uint8Array(await asset.blob.arrayBuffer())
    backup.mediaAssets.push({
      id:String(asset.id || ""),
      type:String(asset.type || asset.blob.type || "application/octet-stream").slice(0, 120),
      fileName:String(asset.fileName || "").slice(0, 240),
      data:bytesToBase64(bytes),
    })
  }
  const serialized = JSON.stringify(backup, null, 2)
  if (new TextEncoder().encode(serialized).length > MAX_LOCAL_DATABASE_BACKUP_BYTES) {
    throw new RangeError("完整备份超过 25 MB 安全上限，请先移除较大的本地素材或分别导出作品")
  }
  return serialized
}

export async function stageLocalDatabaseBackupMedia(
  backup,
  persist = persistEditorMediaAsset,
  BlobConstructor = globalThis.Blob,
) {
  for (const asset of backup?.mediaAssets || []) {
    const blob = new BlobConstructor([base64ToBytes(asset.data)], { type:asset.type })
    const reference = await persist(blob, { fileName:asset.fileName, type:asset.type })
    if (parseEditorMediaAssetId(reference) !== asset.id) throw new Error("备份中的本地素材校验失败")
  }
}

export async function attachLocalDatabaseBackupMedia(
  database,
  replaceReferences = replaceEditorMediaLibraryReferences,
) {
  await replaceReferences(database?.works || [])
  await garbageCollectEditorMediaAssets().catch(() => {})
}
