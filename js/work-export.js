import { encodeSteganoPNG, exportWorkAsJSON, getWork } from "./data.js"
import { downloadBlob } from "./download.js"
import { encryptPortableWorkPackage, encryptWorkPackage } from "./work-package.js"
import { loadEditorMediaAssets } from "./editor-media-storage.js"
import { MAX_WORK_PNG_FILE_BYTES } from "./png-payload.js"

export const TUURU_WORK_MIME = "application/vnd.tuuru.work"

export function safeExportFilename(value, fallback = "作品") {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, "-").trim() || fallback
}

function decodeBase64(value) {
  if (typeof globalThis.atob === "function") return globalThis.atob(value)
  throw new Error("当前环境无法读取 PNG 导出结果")
}

export function dataUrlToBlob(dataUrl, BlobConstructor = globalThis.Blob) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i)
  if (!match || typeof BlobConstructor !== "function") throw new TypeError("PNG 导出结果无效")
  const binary = decodeBase64(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new BlobConstructor([bytes], { type: match[1] })
}

export async function createWorkArtifact(workId, {
  format = "tuuru",
  coverUrl = "",
  getWorkById = getWork,
  exportWork = exportWorkAsJSON,
  encrypt = encryptWorkPackage,
  encryptPortable = encryptPortableWorkPackage,
  loadAssets = loadEditorMediaAssets,
  encodePng = encodeSteganoPNG,
  BlobConstructor = globalThis.Blob,
} = {}) {
  const work = getWorkById(workId)
  if (!work) throw new TypeError("作品不存在")
  const serialized = exportWork(workId)
  if (!serialized) throw new Error("作品数据无法读取")
  const assets = await loadAssets(JSON.parse(serialized))
  const encrypted = assets.length
    ? await encryptPortable(serialized, assets)
    : await encrypt(serialized)
  const title = String(work.title || "作品")
  const baseName = safeExportFilename(title)
  let blob
  let filename

  if (format === "png") {
    const dataUrl = await new Promise((resolve, reject) => {
      try {
        encodePng(encrypted, coverUrl, resolve, reject)
      } catch (error) {
        reject(error)
      }
    })
    blob = dataUrlToBlob(dataUrl, BlobConstructor)
    if (blob.size > MAX_WORK_PNG_FILE_BYTES) {
      throw new RangeError("生成的 PNG 超过 25 MB 阅读器导入上限，请更换体积更小的封面图片，或改用 .tuuru 格式导出")
    }
    filename = `${baseName}.png`
  } else if (format === "tuuru") {
    if (typeof BlobConstructor !== "function") throw new Error("当前环境无法生成作品文件")
    blob = new BlobConstructor([encrypted], { type: TUURU_WORK_MIME })
    filename = `${baseName}.tuuru`
  } else {
    throw new TypeError("不支持的作品导出格式")
  }

  return Object.freeze({
    blob,
    filename,
    title,
    format,
    bytes: Number(blob.size) || 0,
    entityType: "work",
    entityId: String(work.id),
    revision: Number(work.updatedAt || work.createdAt || 1),
  })
}

export async function deliverArtifact(artifact, {
  navigatorObject = globalThis.navigator,
  FileConstructor = globalThis.File,
  download = downloadBlob,
  shareText = "使用 Tuuru 读者端打开附件即可阅读；作品只在本机读取，不会上传。",
} = {}) {
  if (
    navigatorObject?.share
    && navigatorObject?.canShare
    && typeof FileConstructor === "function"
  ) {
    const file = new FileConstructor([artifact.blob], artifact.filename, { type: artifact.blob.type })
    const shareData = { files: [file], title: artifact.title, text: shareText }
    let supported = false
    try {
      supported = navigatorObject.canShare({ files: [file] })
    } catch {
      supported = false
    }
    if (supported) {
      try {
        await navigatorObject.share(shareData)
        return "shared"
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled"
      }
    }
  }

  download(artifact.blob, artifact.filename)
  return "downloaded"
}
