import { toBlob } from "html-to-image"
import { Zip, ZipPassThrough } from "fflate"
import { inlinePhoneExportImages } from "./phone-export-assets.js"
import { waitForPhoneExportLayout } from "./phone-export-layout.js"
import { stabilizePhoneExportTextBoxes } from "./phone-export-text-layout.js"

const PHONE_EXPORT_MOSAIC = "▖▜▖▗"
const PHONE_EXPORT_WIDTH = 360
const PHONE_EXPORT_PAGE_HEIGHT = 1600
const PHONE_EXPORT_PIXEL_RATIO = 2
const PHONE_EXPORT_ASSET_TIMEOUT = 2500
const PHONE_EXPORT_FONT_TIMEOUT = 1800
const PHONE_EXPORT_BRANCH_STEP_LABEL_LENGTH = 12
const PHONE_EXPORT_CHAT_FONT_FAMILY = 'ui-monospace, "SFMono-Regular", Consolas, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", monospace'
const TRANSPARENT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
const PHONE_EXPORT_READER_AVATAR_SELECTORS = [
  ".rd-reader-chat-avatar",
  ".rd-forum-account-avatar",
  ".forum-comment.is-reader > .forum-comment-row > .forum-comment-avatar",
  ".forum-reply-item.is-reader > .forum-reply-line > .forum-reply-avatar",
].join(",")
const PHONE_EXPORT_BREAK_SELECTORS = [
  ".chat-msg",
  ".rd-chat-message",
  ".rd-chat-time",
  ".rd-chat-system",
  ".rd-call-card",
  ".rd-chat-story-event",
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
const PHONE_EXPORT_EAGER_LAYOUT_SELECTORS = [
  ".rd-chat-message",
  ".rd-chat-time",
  ".rd-post-card",
  ".rd-memo-note",
  ".rd-gallery-photo",
  ".rd-browser-entry",
].join(",")
const PHONE_EXPORT_IGNORED_SELECTORS = [
  ".chat-composer",
  ".rd-thread-choice-controls",
  ".rd-thread-choice-reselect",
].join(",")

function stringValues(value) {
  if (Array.isArray(value)) return value.flatMap(stringValues)
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues)
  const text = typeof value === "string" ? value.trim() : ""
  return text ? [text] : []
}

function truncatePhoneExportSegmentByCodePoint(value, maximumLength = 80) {
  let truncated = ""
  for (const character of String(value || "")) {
    if (truncated.length + character.length > maximumLength) break
    truncated += character
  }
  return truncated
}

export function safePhoneExportSegment(value, fallback = "未命名", options = {}) {
  const safeFallback = String(fallback || "未命名").trim() || "未命名"
  const normalized = String(value || "")
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
  const shortened = options?.unicodeSafeTruncation === true
    ? truncatePhoneExportSegmentByCodePoint(normalized)
    : normalized.slice(0, 80)
  return shortened.trim() || safeFallback
}

export function phoneExportBaseName({ workTitle, moduleLabel, itemLabel, unicodeSafeItemLabel = false } = {}) {
  return [
    safePhoneExportSegment(workTitle, "作品"),
    safePhoneExportSegment(moduleLabel, "小手机"),
    safePhoneExportSegment(itemLabel, "全部", { unicodeSafeTruncation:unicodeSafeItemLabel === true }),
  ].join("-")
}

export function phoneExportBranchLabel(path, zeroBasedIndex, total, options = {}) {
  if (!Array.isArray(path) || !path.length) return ""
  const branchNumber = Math.max(0, Number.parseInt(zeroBasedIndex, 10) || 0) + 1
  const branchDigits = Math.max(2, String(Math.max(branchNumber, Number.parseInt(total, 10) || 0)).length)
  const branchPrefix = `分支${String(branchNumber).padStart(branchDigits, "0")}`
  const steps = path.map(step => {
    const ownerOrdinal = Math.max(0, Number.parseInt(step?.ownerOrder, 10) || 0) + 1
    const choiceOrdinal = Math.max(0, Number.parseInt(step?.choiceIndex, 10) || 0) + 1
    const readableLabel = Array.from(maskPhoneExportText(step?.label, options?.maskValues).replace(/\s+/g, " ").trim())
      .slice(0, PHONE_EXPORT_BRANCH_STEP_LABEL_LENGTH)
      .join("")
    return `选项${ownerOrdinal}.${choiceOrdinal}-${safePhoneExportSegment(readableLabel, "未命名", { unicodeSafeTruncation:true })}`
  })
  return safePhoneExportSegment(`${branchPrefix}-${steps.join("→")}`, branchPrefix, { unicodeSafeTruncation:true })
}

export function phoneExportArchiveName(workTitle, branchMode = "current") {
  const modeLabel = branchMode === "all" ? "全部分支" : ""
  return `${safePhoneExportSegment(workTitle, "作品")}-小手机${modeLabel}图片.zip`
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
  const originalImages = [...source.querySelectorAll("img")]
  for (const [index, image] of [...clone.querySelectorAll("img")].entries()) {
    const selectedSource = originalImages[index]?.currentSrc
    if (selectedSource) {
      image.setAttribute("src", selectedSource)
      image.removeAttribute("srcset")
      image.removeAttribute("sizes")
    }
  }
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

function settleExportAsset(start, signal, timeoutMs = PHONE_EXPORT_ASSET_TIMEOUT) {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    let stop

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      signal?.removeEventListener("abort", onAbort)
      if (typeof stop === "function") {
        const currentStop = stop
        stop = undefined
        currentStop()
      }
    }
    const finish = (result, error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(result)
    }
    const onAbort = () => finish(undefined, abortError())

    signal?.addEventListener("abort", onAbort, { once:true })
    timer = setTimeout(() => finish("timeout"), timeoutMs)
    if (settled && timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    try {
      const currentStop = start(
        result => finish(result),
        error => finish(undefined, error),
      )
      if (typeof currentStop === "function") {
        if (settled) currentStop()
        else stop = currentStop
      }
    } catch (error) {
      finish(undefined, error)
    }
  })
}

function settleExportPromise(operation, signal, timeoutMs) {
  return settleExportAsset(resolve => {
    Promise.resolve()
      .then(operation)
      .then(
        () => resolve("load"),
        () => resolve("error"),
      )
  }, signal, timeoutMs)
}

function stabilizeFailedExportImage(image) {
  const rect = image.getBoundingClientRect?.()
  const width = Number(rect?.width)
  const height = Number(rect?.height)
  image.style.setProperty("box-sizing", "border-box", "important")
  if (Number.isFinite(width)) {
    image.style.setProperty("width", `${width}px`, "important")
  }
  if (Number.isFinite(height)) {
    image.style.setProperty("height", `${height}px`, "important")
  }
  image.removeAttribute("srcset")
  image.removeAttribute("sizes")
  image.setAttribute("src", TRANSPARENT_IMAGE)
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

  for (const chatShell of [
    ...(panel.matches?.(".chat-author-shell") ? [panel] : []),
    ...panel.querySelectorAll(".chat-author-shell"),
  ]) {
    chatShell.style.setProperty("font-family", PHONE_EXPORT_CHAT_FONT_FAMILY, "important")
  }

  for (const element of panel.querySelectorAll(".rd-phone-app-body, .chat-msg-area, .cu-body, .rd-forum-detail-scroll")) {
    element.style.setProperty("height", "auto", "important")
    element.style.setProperty("max-height", "none", "important")
    element.style.setProperty("min-height", "0", "important")
    element.style.setProperty("overflow", "visible", "important")
    element.style.setProperty("flex", "none", "important")
  }
  for (const element of panel.querySelectorAll(PHONE_EXPORT_EAGER_LAYOUT_SELECTORS)) {
    element.style.setProperty("content-visibility", "visible", "important")
    element.style.setProperty("contain-intrinsic-size", "none", "important")
  }
  for (const element of panel.querySelectorAll(PHONE_EXPORT_IGNORED_SELECTORS)) {
    element.dataset.phoneExportIgnore = "true"
    element.style.setProperty("display", "none", "important")
  }
  for (const image of panel.querySelectorAll("img")) {
    image.setAttribute("loading", "eager")
    image.setAttribute("decoding", "sync")
  }
}

async function waitForExportAssets(root, signal) {
  throwIfAborted(signal)
  const ownerDocument = root.ownerDocument
  if (ownerDocument?.fonts?.ready) {
    await settleExportPromise(() => ownerDocument.fonts.ready, signal, PHONE_EXPORT_FONT_TIMEOUT)
  }
  const pending = [...root.querySelectorAll("img")].map(async image => {
    image.setAttribute("loading", "eager")
    const loadResult = image.complete
      ? (image.naturalWidth > 0 ? "load" : "error")
      : await settleExportAsset(resolve => {
          const onLoad = () => resolve("load")
          const onError = () => resolve("error")
          image.addEventListener("load", onLoad, { once:true })
          image.addEventListener("error", onError, { once:true })
          return () => {
            image.removeEventListener("load", onLoad)
            image.removeEventListener("error", onError)
          }
        }, signal)
    if (loadResult === "error" || loadResult === "timeout") {
      stabilizeFailedExportImage(image)
      return
    }
    if (typeof image.decode === "function" && image.complete && image.naturalWidth > 0) {
      await settleExportPromise(() => image.decode(), signal, PHONE_EXPORT_ASSET_TIMEOUT)
    }
  })
  await Promise.all(pending)
  throwIfAborted(signal)
}

function exportBreakpoints(panel) {
  const rootRect = panel.getBoundingClientRect()
  const ownerWindow = panel.ownerDocument?.defaultView
  return [...panel.querySelectorAll(PHONE_EXPORT_BREAK_SELECTORS)].flatMap(element => {
    const rect = element.getBoundingClientRect()
    const marginBottom = typeof ownerWindow?.getComputedStyle === "function"
      ? Math.max(0, Number.parseFloat(ownerWindow.getComputedStyle(element).marginBottom) || 0)
      : 0
    const points = [Math.ceil(rect.bottom - rootRect.top + marginBottom)]
    if (!element.parentElement?.closest?.(PHONE_EXPORT_BREAK_SELECTORS)) {
      points.push(Math.ceil(rect.top - rootRect.top))
    }
    return points
  }).filter(point => point > 0)
}

function copyPhoneFrameVariables(sourcePanel, viewport) {
  const sourceFrame = sourcePanel.closest?.(".phone-frame")
  if (!sourceFrame) return
  const frameStyle = sourceFrame.getAttribute("style")
  if (frameStyle) viewport.setAttribute("style", frameStyle)
}

function isolateExportStageZoom(stage) {
  const ownerWindow = stage.ownerDocument?.defaultView
  if (typeof ownerWindow?.getComputedStyle !== "function") return
  let ancestorZoom = 1
  for (let ancestor = stage.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const value = ownerWindow.getComputedStyle(ancestor).getPropertyValue("zoom").trim()
    const zoom = Number.parseFloat(value) / (value.endsWith("%") ? 100 : 1)
    if (Number.isFinite(zoom) && zoom > 0) ancestorZoom *= zoom
  }
  // The SVG includes only viewport, not its document ancestors. Measure at the
  // same scale it will use: otherwise CSS zoom rounds glyph advances/used
  // widths differently and a copied fixed-height text box can gain a line.
  // Keep this compensation OUTSIDE viewport so it is not serialized again.
  if (Number.isFinite(ancestorZoom) && ancestorZoom > 0) {
    const inverse = 1 / ancestorZoom
    stage.style.setProperty("zoom", String(inverse), "important")
    // Nested zoom multiplication can round just below 1 in the browser's
    // float layout scale (e.g. 110% × 90%). Avoid losing a layout subpixel.
    const effectiveZoom = stage.currentCSSZoom
    if (Number.isFinite(effectiveZoom) && effectiveZoom > 0 && effectiveZoom < 1) {
      stage.style.setProperty("zoom", String(inverse / effectiveZoom), "important")
    }
  }
}

function exportViewportBorderSize(viewport) {
  const ownerWindow = viewport?.ownerDocument?.defaultView
  const style = typeof ownerWindow?.getComputedStyle === "function"
    ? ownerWindow.getComputedStyle(viewport)
    : null
  const pixels = property => Math.max(0, Number.parseFloat(style?.getPropertyValue(property)) || 0)
  return {
    inline:Math.ceil(pixels("border-left-width") + pixels("border-right-width")),
    block:Math.ceil(pixels("border-top-width") + pixels("border-bottom-width")),
  }
}

function exportCloneStyleProperties(ownerDocument) {
  const ownerWindow = ownerDocument?.defaultView
  if (typeof ownerWindow?.getComputedStyle !== "function") return undefined
  const style = ownerWindow.getComputedStyle(ownerDocument.documentElement)
  // Keep measured dimensions. Dropping heights makes stylesheet-sized images,
  // avatars and headers reflow when the clone loses the document stylesheets.
  // Font sizes are already inlined exactly below: html-to-image otherwise
  // floors every pixel font size and subtracts 0.1px during its style copy.
  return Array.from(style).filter(property => property !== "font-size")
}

function preserveExportRasterStyles(root) {
  const ownerWindow = root.ownerDocument?.defaultView
  if (typeof ownerWindow?.getComputedStyle !== "function") return
  // Read before writing so freezing an ancestor cannot change a descendant's
  // inherited values. Only the disposable export tree is touched.
  const snapshots = [root, ...root.querySelectorAll("*")].filter(element => element.style).map(element => {
    const style = ownerWindow.getComputedStyle(element)
    const fontSize = style.getPropertyValue("font-size")
    // html-to-image deep-clones SVG children without decorating them. Their
    // stylesheet fill/stroke/opacity (e.g. voice waves) would otherwise vanish.
    const properties = element.ownerSVGElement ? Array.from(style) : ["font-size"]
    const values = properties.map(property => [property, style.getPropertyValue(property)])
    const pseudoFonts = []
    // Real browser CSSOM supports pseudo styles; DOM-only test environments
    // without CSS do not. Generated text may use a different size than its host.
    if (ownerWindow.CSS && !element.ownerSVGElement) {
      for (const pseudo of ["::before", "::after"]) {
        const pseudoStyle = ownerWindow.getComputedStyle(element, pseudo)
        const content = pseudoStyle.getPropertyValue("content")
        const size = pseudoStyle.getPropertyValue("font-size")
        if (content && content !== "none" && content !== "normal" && size && size !== fontSize) {
          pseudoFonts.push({ pseudo, size })
        }
      }
    }
    return { element, values, pseudoFonts }
  })
  const pseudoRules = []
  for (const [index, { element, values, pseudoFonts }] of snapshots.entries()) {
    for (const [property, value] of values) {
      if (value) element.style.setProperty(property, value, "important")
    }
    if (pseudoFonts.length) {
      element.setAttribute("data-phone-export-font", String(index))
      for (const { pseudo, size } of pseudoFonts) {
        pseudoRules.push(`[data-phone-export-font="${index}"]${pseudo}{font-size:${size}!important}`)
      }
    }
  }
  if (pseudoRules.length) {
    // The dependency's pseudo-element serializer shares the same property list,
    // so carry the omitted font sizes in clone-local rules (including root pseudos).
    const stylesheet = root.ownerDocument.createElement("style")
    stylesheet.setAttribute("data-phone-export-fonts", "")
    stylesheet.textContent = pseudoRules.join("\n")
    root.appendChild(stylesheet)
  }
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
    layoutScheduler,
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
  viewport.style.setProperty("box-sizing", "border-box", "important")
  viewport.style.setProperty("width", `${PHONE_EXPORT_WIDTH}px`, "important")
  viewport.style.setProperty("min-height", "0", "important")
  viewport.style.setProperty("margin", "0", "important")
  viewport.style.setProperty("overflow", "hidden", "important")
  const clone = maskPhoneExportClone(sourcePanel, maskValues)
  forceExportLayout(clone)
  clone.style.setProperty("width", "100%", "important")
  viewport.appendChild(clone)
  stage.appendChild(viewport)
  ownerDocument.body.appendChild(stage)

  try {
    isolateExportStageZoom(stage)
    const pendingImages = inlinePhoneExportImages(viewport, { signal })
    if (pendingImages) await pendingImages
    await waitForExportAssets(clone, signal)
    await waitForPhoneExportLayout(ownerDocument, signal, layoutScheduler)
    stabilizePhoneExportTextBoxes(viewport)
    preserveExportRasterStyles(viewport)
    const viewportBorder = exportViewportBorderSize(viewport)
    const measuredHeight = Math.max(
      644,
      Math.ceil(clone.scrollHeight || clone.getBoundingClientRect().height || 0),
    )
    const contentPageHeight = Math.max(320, Math.ceil(Number(maximumPageHeight) || PHONE_EXPORT_PAGE_HEIGHT) - viewportBorder.block)
    const windows = phoneExportPageWindows(measuredHeight, contentPageHeight, exportBreakpoints(clone))
    const includeStyleProperties = exportCloneStyleProperties(ownerDocument)
    const files = []
    for (const window of windows) {
      throwIfAborted(signal)
      const outputHeight = window.height + viewportBorder.block
      viewport.style.setProperty("height", `${outputHeight}px`, "important")
      clone.style.setProperty("transform", `translateY(-${window.top}px)`, "important")
      clone.style.setProperty("transform-origin", "top left", "important")
      await waitForPhoneExportLayout(ownerDocument, signal, layoutScheduler)
      const blob = await rasterize(viewport, {
        width:PHONE_EXPORT_WIDTH,
        height:outputHeight,
        pixelRatio,
        cacheBust:true,
        includeQueryParams:true,
        skipAutoScale:true,
        imagePlaceholder:TRANSPARENT_IMAGE,
        backgroundColor:"#fffafa",
        includeStyleProperties,
        filter:node => !node?.dataset?.phoneExportIgnore,
      })
      throwIfAborted(signal)
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
