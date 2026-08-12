import { toBlob } from "html-to-image"
import { Zip, ZipPassThrough } from "fflate"

const PHONE_EXPORT_MOSAIC = "▖▜▖▗"
const PHONE_EXPORT_WIDTH = 360
const PHONE_EXPORT_PAGE_HEIGHT = 1600
const PHONE_EXPORT_PIXEL_RATIO = 2
const TRANSPARENT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
const PHONE_EXPORT_READER_AVATAR_SELECTORS = [
  ".rd-reader-chat-avatar",
  ".rd-forum-account-avatar",
  ".forum-comment.is-reader > .forum-comment-row > .forum-comment-avatar",
  ".forum-reply-item.is-reader > .forum-reply-line > .forum-reply-avatar",
].join(",")
const PHONE_EXPORT_BREAK_SELECTORS = [
  ".chat-msg",
  ".rd-system-message",
  ".rd-moment-card",
  ".rd-thread-comment",
  ".rd-forum-comment",
  ".rd-forum-floor",
  ".memo-card",
  ".rd-album",
  ".gallery-photo-card",
  ".rd-browser-entry",
  ".shop-item",
  ".rd-contact-entry",
].join(",")

function stringValues(value) {
  if (Array.isArray(value)) return value.flatMap(stringValues)
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues)
  const text = typeof value === "string" ? value.trim() : ""
  return text ? [text] : []
}

export function safePhoneExportSegment(value, fallback = "未命名") {
  const safeFallback = String(fallback || "未命名").trim() || "未命名"
  const normalized = String(value || "")
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 80)
    .trim()
  return normalized || safeFallback
}

export function phoneExportBaseName({ workTitle, moduleLabel, itemLabel } = {}) {
  return [
    safePhoneExportSegment(workTitle, "作品"),
    safePhoneExportSegment(moduleLabel, "小手机"),
    safePhoneExportSegment(itemLabel, "全部"),
  ].join("-")
}

export function phoneExportArchiveName(workTitle) {
  return `${safePhoneExportSegment(workTitle, "作品")}-小手机图片.zip`
}

export function placeholderMaskValues(placeholders, readerValues = {}) {
  const values = []
  const seen = new Set()
  function add(value) {
    for (const text of stringValues(value)) {
      if (seen.has(text)) continue
      seen.add(text)
      values.push(text)
    }
  }

  for (const placeholder of Array.isArray(placeholders) ? placeholders : []) {
    if (!placeholder || typeof placeholder !== "object") continue
    add(placeholder.values)
    add(placeholder.sceneMap)
    add(placeholder.key || placeholder.label)
    add(readerValues && readerValues[placeholder.id])
    add(placeholder.default)
  }

  return values.sort((left, right) => Array.from(right).length - Array.from(left).length)
}

export function maskPhoneExportText(value, maskValues, mosaic = PHONE_EXPORT_MOSAIC) {
  let text = String(value ?? "")
  for (const pattern of Array.isArray(maskValues) ? maskValues : []) {
    if (!pattern || !text.includes(pattern)) continue
    text = text.split(pattern).join(mosaic)
  }
  return text
}

function maskPhoneExportReaderAvatars(root) {
  if (!root || typeof root.querySelectorAll !== "function") return
  const avatars = [
    ...(root.matches?.(PHONE_EXPORT_READER_AVATAR_SELECTORS) ? [root] : []),
    ...root.querySelectorAll(PHONE_EXPORT_READER_AVATAR_SELECTORS),
  ]
  for (const avatar of avatars) {
    avatar.textContent = PHONE_EXPORT_MOSAIC
    avatar.dataset.phoneExportReaderAvatar = "masked"
    avatar.setAttribute("aria-label", "读者头像已打码")
    avatar.style.setProperty("background-image", "none", "important")
    avatar.style.setProperty("background-color", "#d8c8cd", "important")
    avatar.style.setProperty("color", "#6f5961", "important")
    avatar.style.setProperty("font-size", "7px", "important")
    avatar.style.setProperty("letter-spacing", "-1px", "important")
    avatar.style.setProperty("line-height", "1", "important")
    avatar.style.setProperty("overflow", "hidden", "important")
  }
}

export function maskPhoneExportClone(source, maskValues) {
  if (!source || typeof source.cloneNode !== "function") {
    throw new TypeError("需要可复制的小手机内容节点")
  }
  const clone = source.cloneNode(true)
  const ownerDocument = clone.ownerDocument || source.ownerDocument
  const NodeFilterObject = ownerDocument?.defaultView?.NodeFilter || globalThis.NodeFilter
  if (ownerDocument && NodeFilterObject) {
    const walker = ownerDocument.createTreeWalker(clone, NodeFilterObject.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      node.nodeValue = maskPhoneExportText(node.nodeValue, maskValues)
      node = walker.nextNode()
    }
  }

  const attributeNames = ["aria-label", "alt", "title", "placeholder", "data-label"]
  const elements = [clone, ...clone.querySelectorAll("*")]
  for (const element of elements) {
    for (const attribute of attributeNames) {
      if (!element.hasAttribute?.(attribute)) continue
      element.setAttribute(attribute, maskPhoneExportText(element.getAttribute(attribute), maskValues))
    }
    if ("value" in element && typeof element.value === "string") {
      element.value = maskPhoneExportText(element.value, maskValues)
      if (element.hasAttribute?.("value")) element.setAttribute("value", element.value)
    }
  }
  maskPhoneExportReaderAvatars(clone)
  return clone
}

export function phoneExportPageWindows(totalHeight, maximumHeight = 1600, breakpoints = []) {
  const total = Math.max(0, Math.ceil(Number(totalHeight) || 0))
  const limit = Math.max(320, Math.ceil(Number(maximumHeight) || 1600))
  if (!total) return []
  if (total <= limit) return [{ top:0, height:total, page:1, total:1 }]

  const points = [...new Set((Array.isArray(breakpoints) ? breakpoints : [])
    .map(point => Math.ceil(Number(point) || 0))
    .filter(point => point > 0 && point < total))]
    .sort((left, right) => left - right)
  const windows = []
  let top = 0
  while (top < total) {
    const desiredBottom = Math.min(total, top + limit)
    let bottom = desiredBottom
    if (desiredBottom < total) {
      const minimumUsefulBottom = top + Math.floor(limit * 0.4)
      const candidates = points.filter(point => point > minimumUsefulBottom && point <= desiredBottom)
      if (candidates.length) bottom = candidates[candidates.length - 1]
    }
    if (bottom <= top) bottom = desiredBottom
    windows.push({ top, height:bottom - top })
    top = bottom
  }
  return windows.map((window, index) => ({
    ...window,
    page:index + 1,
    total:windows.length,
  }))
}

function abortError() {
  if (typeof DOMException === "function") return new DOMException("已取消图片导出", "AbortError")
  const error = new Error("已取消图片导出")
  error.name = "AbortError"
  return error
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError()
}

function forceExportLayout(panel) {
  panel.classList.add("rd-phone-export-panel")
  panel.style.setProperty("position", "relative", "important")
  panel.style.setProperty("inset", "auto", "important")
  panel.style.setProperty("top", "auto", "important")
  panel.style.setProperty("right", "auto", "important")
  panel.style.setProperty("bottom", "auto", "important")
  panel.style.setProperty("left", "auto", "important")
  panel.style.setProperty("width", `${PHONE_EXPORT_WIDTH}px`, "important")
  panel.style.setProperty("height", "auto", "important")
  panel.style.setProperty("min-height", "644px", "important")
  panel.style.setProperty("overflow", "visible", "important")

  for (const element of panel.querySelectorAll(".rd-phone-app-body, .chat-msg-area, .cu-body, .rd-forum-detail-scroll")) {
    element.style.setProperty("height", "auto", "important")
    element.style.setProperty("max-height", "none", "important")
    element.style.setProperty("min-height", "0", "important")
    element.style.setProperty("overflow", "visible", "important")
    element.style.setProperty("flex", "none", "important")
  }
  for (const element of panel.querySelectorAll(".chat-composer, .rd-thread-choice-controls, .rd-thread-choice-reselect")) {
    element.dataset.phoneExportIgnore = "true"
  }
}

async function waitForExportAssets(root, signal) {
  throwIfAborted(signal)
  const ownerDocument = root.ownerDocument
  if (ownerDocument?.fonts?.ready) {
    await Promise.race([
      ownerDocument.fonts.ready.catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, 1800)),
    ])
  }
  const pending = [...root.querySelectorAll("img")].map(image => {
    if (image.complete) return Promise.resolve()
    return new Promise(resolve => {
      const finish = () => resolve()
      image.addEventListener("load", finish, { once:true })
      image.addEventListener("error", finish, { once:true })
      setTimeout(finish, 2500)
    })
  })
  await Promise.all(pending)
  throwIfAborted(signal)
}

function exportBreakpoints(panel) {
  const rootRect = panel.getBoundingClientRect()
  return [...panel.querySelectorAll(PHONE_EXPORT_BREAK_SELECTORS)].map(element => {
    const rect = element.getBoundingClientRect()
    return Math.ceil(rect.bottom - rootRect.top)
  }).filter(point => point > 0)
}

function copyPhoneFrameVariables(sourcePanel, viewport) {
  const sourceFrame = sourcePanel.closest?.(".phone-frame")
  if (!sourceFrame) return
  const frameStyle = sourceFrame.getAttribute("style")
  if (frameStyle) viewport.setAttribute("style", frameStyle)
}

export async function capturePhonePanelPages(sourcePanel, options = {}) {
  if (!sourcePanel?.ownerDocument) throw new TypeError("找不到要导出的小手机内容")
  const {
    baseName = "作品-小手机-内容",
    maskValues = [],
    maximumPageHeight = PHONE_EXPORT_PAGE_HEIGHT,
    pixelRatio = PHONE_EXPORT_PIXEL_RATIO,
    signal,
    rasterize = toBlob,
    onPage,
  } = options
  throwIfAborted(signal)

  const ownerDocument = sourcePanel.ownerDocument
  const stage = ownerDocument.createElement("div")
  stage.className = "rd-phone-export-stage"
  stage.setAttribute("aria-hidden", "true")
  stage.style.cssText = "position:fixed;left:-20000px;top:0;width:360px;pointer-events:none;z-index:-1;overflow:visible;"
  const viewport = ownerDocument.createElement("div")
  viewport.className = "phone-frame reader-phone-css-scope rd-phone-export-viewport"
  copyPhoneFrameVariables(sourcePanel, viewport)
  viewport.style.setProperty("position", "relative", "important")
  viewport.style.setProperty("width", `${PHONE_EXPORT_WIDTH}px`, "important")
  viewport.style.setProperty("min-height", "0", "important")
  viewport.style.setProperty("margin", "0", "important")
  viewport.style.setProperty("overflow", "hidden", "important")
  const clone = maskPhoneExportClone(sourcePanel, maskValues)
  forceExportLayout(clone)
  viewport.appendChild(clone)
  stage.appendChild(viewport)
  ownerDocument.body.appendChild(stage)

  try {
    await waitForExportAssets(clone, signal)
    const measuredHeight = Math.max(
      644,
      Math.ceil(clone.scrollHeight || clone.getBoundingClientRect().height || 0),
    )
    const windows = phoneExportPageWindows(measuredHeight, maximumPageHeight, exportBreakpoints(clone))
    const files = []
    for (const window of windows) {
      throwIfAborted(signal)
      viewport.style.setProperty("height", `${window.height}px`, "important")
      clone.style.setProperty("transform", `translateY(-${window.top}px)`, "important")
      clone.style.setProperty("transform-origin", "top left", "important")
      const blob = await rasterize(viewport, {
        width:PHONE_EXPORT_WIDTH,
        height:window.height,
        pixelRatio,
        cacheBust:true,
        includeQueryParams:true,
        skipAutoScale:true,
        imagePlaceholder:TRANSPARENT_IMAGE,
        backgroundColor:"#fffafa",
        filter:node => !node?.dataset?.phoneExportIgnore,
      })
      if (!blob) throw new Error("浏览器没有生成 PNG 图片")
      const pageSuffix = window.total > 1 ? `-${String(window.page).padStart(2, "0")}` : ""
      files.push({ filename:`${baseName}${pageSuffix}.png`, blob })
      if (typeof onPage === "function") onPage({ ...window, filename:files.at(-1).filename })
    }
    return files
  } finally {
    stage.remove()
  }
}

export async function createPhoneContentArchive(files, BlobConstructor = globalThis.Blob) {
  if (typeof BlobConstructor !== "function") throw new Error("当前浏览器无法生成 ZIP 文件")
  const entries = Array.isArray(files) ? files : []
  if (!entries.length) throw new Error("没有可保存的小手机图片")
  return new Promise((resolve, reject) => {
    const chunks = []
    const archive = new Zip((error, chunk, final) => {
      if (error) {
        reject(error)
        return
      }
      if (chunk?.length) chunks.push(chunk)
      if (final) resolve(new BlobConstructor(chunks, { type:"application/zip" }))
    })
    ;(async () => {
      try {
        for (const file of entries) {
          const rawFilename = String(file?.filename || "小手机.png")
          const portableFilename = rawFilename
            .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, " ")
            .slice(0, 220)
            .replace(/\.+$/g, "")
          const entry = new ZipPassThrough(/\.png$/i.test(portableFilename) ? portableFilename : `${portableFilename || "小手机"}.png`)
          archive.add(entry)
          const bytes = new Uint8Array(await file.blob.arrayBuffer())
          entry.push(bytes, true)
        }
        archive.end()
      } catch (error) {
        reject(error)
      }
    })()
  })
}

export { PHONE_EXPORT_MOSAIC }
