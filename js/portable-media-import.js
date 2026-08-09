import {
  editorMediaAssetReference,
  persistEditorMediaAsset,
  syncEditorMediaAssetReferences,
} from "./editor-media-storage.js"

export function portableAssetOwnerId(payload) {
  if (payload?.type === "tuuru-work-collection") {
    return `reader:collection:${String(payload.collection?.id || "unknown")}`
  }
  return `reader:work:${String(payload?.id || "unknown")}`
}

export async function installPortableWorkAssets(payload, assets, options = {}) {
  if (!Array.isArray(assets) || assets.length === 0) return 0
  const BlobConstructor = options.BlobConstructor || globalThis.Blob
  if (typeof BlobConstructor !== "function") throw new Error("当前环境无法保存作品素材")
  const persistAsset = options.persistAsset || persistEditorMediaAsset
  const syncReferences = options.syncReferences || syncEditorMediaAssetReferences

  for (const asset of assets) {
    const blob = new BlobConstructor([asset.bytes], {
      type: String(asset.type || "application/octet-stream"),
    })
    const reference = await persistAsset(blob, {
      fileName: String(asset.fileName || ""),
      type: String(asset.type || "application/octet-stream"),
    })
    if (reference !== editorMediaAssetReference(asset.id)) {
      throw new Error(`作品素材校验失败：${String(asset.id || "").slice(0, 12)}`)
    }
  }
  await syncReferences(portableAssetOwnerId(payload), payload)
  return assets.length
}
