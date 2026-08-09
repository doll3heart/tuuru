import { isInteractiveExperienceWork } from "./interactive-experience.js"
import { ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES } from "./work-package.js"

export const WORK_SIZE_CAUTION_BYTES = 6 * 1024 * 1024
export const WORK_SIZE_HIGH_RISK_BYTES = 9 * 1024 * 1024

const DATA_URL_PATTERN = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+)((?:;[a-z0-9=.+-]+)*);base64,([a-z0-9+/=_-]+)/gi
const ASSET_REFERENCE_PATTERN = /^asset:\/\/([a-f0-9]{64})$/i

const PHONE_COLLECTIONS = Object.freeze({
  chats:{ appType:"messages", label:"消息" },
  moments:{ appType:"messages", label:"动态" },
  forumPosts:{ appType:"forum", label:"论坛" },
  forumNpcs:{ appType:"forum", label:"论坛 NPC" },
  memos:{ appType:"memo", label:"备忘录" },
  photos:{ appType:"gallery", label:"相册" },
  albums:{ appType:"gallery", label:"相册" },
  browserHistory:{ appType:"browser", label:"浏览记录" },
  shoppingItems:{ appType:"shopping", label:"购物" },
  skin:{ appType:"profile", label:"手机外观" },
})

function items(value) {
  return Array.isArray(value) ? value : []
}

function cleanLabel(value, fallback) {
  const text = String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return (text || fallback).slice(0, 80)
}

function pathKey(path) {
  return path.map(segment => typeof segment === "number" ? `[${segment}]` : String(segment)).join(".")
}

function base64Bytes(payload) {
  const normalized = String(payload || "").replace(/-/g, "+").replace(/_/g, "/")
  if (!normalized || normalized.length % 4 === 1 || /[^a-z0-9+/=]/i.test(normalized)) return null
  const firstPadding = normalized.indexOf("=")
  if (firstPadding >= 0 && !/^=*$/.test(normalized.slice(firstPadding))) return null
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0
  const unpaddedLength = normalized.length - padding
  if (unpaddedLength % 4 === 1) return null
  return Math.floor((normalized.length * 3) / 4) - padding
}

function articleNodeForScene(work, scene) {
  const sceneId = String(scene?.id || "")
  return items(work?.nodes).find(node => (
    String(node?.id || "") === String(scene?.nodeId || "")
    || (sceneId && String(node?.interactiveSceneId || "") === sceneId)
  )) || null
}

function phoneLocator(path) {
  const collection = String(path[1] || "")
  const config = PHONE_COLLECTIONS[collection] || { appType:"profile", label:"小手机" }
  return {
    surface:"phone",
    appType:config.appType,
    label:config.label,
  }
}

function locatorFor(work, path) {
  const root = String(path[0] || "")
  if (root === "watermark") {
    return { surface:"work-info", label:"作品信息 · 作者水印" }
  }
  if (root === "nodes") {
    const node = items(work?.nodes)[Number(path[1])]
    return {
      surface:"article",
      nodeId:String(node?.id || ""),
      label:`互动文章 · ${cleanLabel(node?.title, `节点 ${Number(path[1]) + 1}`)}`,
    }
  }
  if (root === "interactiveScenes") {
    const scene = items(work?.interactiveScenes)[Number(path[1])]
    if (isInteractiveExperienceWork(work)) {
      const stageIndex = String(path[2] || "") === "stages" ? Number(path[3]) : -1
      const stage = Number.isInteger(stageIndex) && stageIndex >= 0
        ? items(scene?.stages)[stageIndex]
        : null
      return {
        surface:"article",
        label:`Mini文游 · ${cleanLabel(stage?.name, cleanLabel(scene?.title, stage ? `画面 ${stageIndex + 1}` : "画面与互动"))}`,
      }
    }
    const node = articleNodeForScene(work, scene)
    return {
      surface:"article",
      nodeId:String(node?.id || scene?.nodeId || ""),
      label:`互动图片 · ${cleanLabel(scene?.title, `第 ${Number(path[1]) + 1} 页`)}`,
    }
  }
  if (root === "phoneModules") {
    const module = items(work?.phoneModules)[Number(path[1])]
    return {
      surface:"article",
      nodeId:String(module?.nodeId || ""),
      label:`插入内容 · ${cleanLabel(module?.title || module?.type, `第 ${Number(path[1]) + 1} 项`)}`,
    }
  }
  if (root === "phoneData") return phoneLocator(path)
  return {
    surface:work?.type === "phone" ? "phone" : "article",
    label:work?.type === "phone" ? "小手机 · 作品外观" : "互动文章 · 作品设置",
  }
}

function collectStringAssets(work, value, path, output) {
  DATA_URL_PATTERN.lastIndex = 0
  let match
  let matchIndex = 0
  while ((match = DATA_URL_PATTERN.exec(value)) !== null) {
    const bytes = base64Bytes(match[3])
    if (!Number.isSafeInteger(bytes) || bytes <= 0) continue
    const locator = locatorFor(work, path)
    output.push({
      id:`${pathKey(path)}#${matchIndex}`,
      path:pathKey(path),
      bytes,
      mediaType:String(match[1] || "application/octet-stream").toLowerCase(),
      location:locator.label,
      locator,
    })
    matchIndex += 1
  }
}

function collectEmbeddedAssets(work) {
  const output = []
  const active = new Set()
  const stack = [{ value:work, path:[] }]
  while (stack.length) {
    const current = stack.pop()
    if (typeof current.value === "string") {
      collectStringAssets(work, current.value, current.path, output)
      continue
    }
    if (!current.value || typeof current.value !== "object") continue
    if (active.has(current.value)) continue
    active.add(current.value)
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value:current.value[index], path:[...current.path, index] })
      }
    } else {
      const keys = Object.keys(current.value)
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index]
        stack.push({ value:current.value[key], path:[...current.path, key] })
      }
    }
  }
  return output.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path))
}

function collectPortableAssetLocations(work) {
  const locations = new Map()
  const seenObjects = new WeakSet()
  const stack = [{ value:work, path:[] }]
  while (stack.length) {
    const current = stack.pop()
    if (typeof current.value === "string") {
      const match = current.value.match(ASSET_REFERENCE_PATTERN)
      if (match && !locations.has(match[1].toLowerCase())) {
        const locator = locatorFor(work, current.path)
        locations.set(match[1].toLowerCase(), { path:pathKey(current.path), locator })
      }
      continue
    }
    if (!current.value || typeof current.value !== "object" || seenObjects.has(current.value)) continue
    seenObjects.add(current.value)
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value:current.value[index], path:[...current.path, index] })
      }
    } else {
      for (const key of Object.keys(current.value)) {
        stack.push({ value:current.value[key], path:[...current.path, key] })
      }
    }
  }
  return locations
}

function freezeReport({ plaintextBytes, encryptedPackageBytes, embeddedAssetBytes, assets }) {
  const risk = encryptedPackageBytes >= WORK_SIZE_HIGH_RISK_BYTES
    ? "high"
    : encryptedPackageBytes >= WORK_SIZE_CAUTION_BYTES
      ? "caution"
      : "safe"
  return Object.freeze({
    plaintextBytes,
    encryptedPackageBytes,
    embeddedAssetBytes,
    risk,
    thresholds:Object.freeze({ caution:WORK_SIZE_CAUTION_BYTES, high:WORK_SIZE_HIGH_RISK_BYTES }),
    assets:Object.freeze(assets.map(asset => Object.freeze({
      ...asset,
      locator:Object.freeze({...asset.locator}),
    }))),
  })
}

export function inspectWorkSize(work) {
  const serialized = JSON.stringify(work ?? null)
  const plaintextBytes = new TextEncoder().encode(serialized).length
  const encryptedPackageBytes = plaintextBytes + ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES
  const assets = collectEmbeddedAssets(work)
  const embeddedAssetBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0)
  return freezeReport({
    plaintextBytes,
    encryptedPackageBytes,
    embeddedAssetBytes,
    assets,
  })
}

export async function inspectWorkSizeWithAssets(work, loadAssets) {
  const base = inspectWorkSize(work)
  if (typeof loadAssets !== "function") return base
  const portableAssets = await loadAssets(work)
  if (!portableAssets.length) return base
  const locations = collectPortableAssetLocations(work)
  const listed = portableAssets.map(asset => {
    const location = locations.get(String(asset.id || "").toLowerCase()) || {
      path:"interactiveScenes",
      locator:locatorFor(work, ["interactiveScenes"]),
    }
    return {
      id:`asset://${asset.id}`,
      path:location.path,
      bytes:Number(asset.blob?.size || asset.bytes?.length || 0),
      mediaType:String(asset.type || asset.blob?.type || "application/octet-stream"),
      location:location.locator.label,
      locator:location.locator,
    }
  })
  const portableBytes = listed.reduce((sum, asset) => sum + asset.bytes, 0)
  const manifestBytes = new TextEncoder().encode(JSON.stringify({
    assets:portableAssets.map(asset => ({
      id:asset.id,
      type:String(asset.type || asset.blob?.type || "application/octet-stream").slice(0, 120),
      fileName:String(asset.fileName || "").slice(0, 240),
      length:Number(asset.blob?.size || asset.bytes?.length || 0),
    })),
  })).length
  const bundleOverhead = 16 + manifestBytes
  return freezeReport({
    plaintextBytes:base.plaintextBytes,
    encryptedPackageBytes:base.encryptedPackageBytes + portableBytes + bundleOverhead,
    embeddedAssetBytes:base.embeddedAssetBytes + portableBytes,
    assets:[...base.assets, ...listed].sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path)),
  })
}
