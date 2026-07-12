import createDOMPurify from "dompurify"
import { normalizeCssColor } from "./safe-values.js"

const ALLOWED_TAGS = [
  "p", "div", "br", "b", "strong", "i", "em", "u", "span", "img",
]
const ALLOWED_ATTRIBUTES = [
  "class", "style", "src", "alt", "title", "align", "data-pm-id", "data-pm-type",
]
const ALIGNMENTS = new Set(["left", "center", "right", "justify"])
const PHONE_MODULE_TYPES = new Set([
  "settings", "customize", "messages", "forum", "memo", "gallery",
  "browser", "shopping", "profile", "contacts",
])
const ARTICLE_CLASSES = new Map([
  ["pm-inline-card", "DIV"],
  ["pm-card-icon", "SPAN"],
  ["pm-card-label", "SPAN"],
])
const MEMO_CLASSES = new Map([
  ["check-line", "DIV"],
  ["checked", "DIV"],
  ["check-dot", "SPAN"],
  ["num-line", "DIV"],
  ["num-label", "SPAN"],
  ["num-text", "SPAN"],
])
const IMAGE_FIELD_NAMES = new Set([
  "avatar", "avatarUrl", "faceUrl", "image", "imageUrl", "readerAvatar",
  "topBgImage", "wallpaperImage",
])
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i
const MAX_DATA_IMAGE_LENGTH = 10 * 1024 * 1024
const purifierCache = new WeakMap()

export function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getPurifier(windowObject) {
  if (!purifierCache.has(windowObject)) {
    purifierCache.set(windowObject, createDOMPurify(windowObject))
  }
  return purifierCache.get(windowObject)
}

export function isSafeImageUrl(value) {
  if (typeof value !== "string") return false
  const url = value.trim()
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return false
  if (DATA_IMAGE_PATTERN.test(url)) return url.length <= MAX_DATA_IMAGE_LENGTH
  if (/[\s"'<>`]/.test(url) || /[();{}\\]/.test(url)) return false
  if (/^https?:\/\//i.test(url) || /^\/\//.test(url)) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(url)
}

export function sanitizeCssColor(value, { fallback = "#f0f0f0" } = {}) {
  return normalizeCssColor(value, fallback)
}

function allowedClassMap(profile) {
  return profile === "memo"
    ? new Map([...ARTICLE_CLASSES, ...MEMO_CLASSES])
    : ARTICLE_CLASSES
}

function cleanElementPolicy(element, profile) {
  const classRules = allowedClassMap(profile)
  const safeClasses = Array.from(element.classList).filter(className => {
    return classRules.get(className) === element.tagName
  })
  if (safeClasses.length) element.className = safeClasses.join(" ")
  else element.removeAttribute("class")

  const textAlign = element.style.getPropertyValue("text-align").trim().toLowerCase()
  element.removeAttribute("style")
  if (ALIGNMENTS.has(textAlign)) element.style.textAlign = textAlign

  const align = (element.getAttribute("align") || "").toLowerCase()
  if (!ALIGNMENTS.has(align)) element.removeAttribute("align")

  if (element.tagName === "IMG") {
    const src = element.getAttribute("src") || ""
    if (!isSafeImageUrl(src)) element.removeAttribute("src")
  }

  if (element.classList.contains("pm-inline-card")) {
    const id = element.getAttribute("data-pm-id") || ""
    const type = element.getAttribute("data-pm-type") || ""
    const validId = /^[a-z0-9_-]{1,128}$/i.test(id)
    if (!validId || !PHONE_MODULE_TYPES.has(type)) {
      element.classList.remove("pm-inline-card")
      if (!element.classList.length) element.removeAttribute("class")
      element.removeAttribute("data-pm-id")
      element.removeAttribute("data-pm-type")
    }
  } else {
    element.removeAttribute("data-pm-id")
    element.removeAttribute("data-pm-type")
  }
}

export function sanitizeRichHtml(html, options = {}) {
  const windowObject = options.windowObject || window
  const profile = options.profile === "memo" ? "memo" : "article"
  const purifier = getPurifier(windowObject)
  const sanitized = purifier.sanitize(String(html || ""), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  })
  const template = windowObject.document.createElement("template")
  template.innerHTML = sanitized
  template.content.querySelectorAll("*").forEach(element => cleanElementPolicy(element, profile))
  return template.innerHTML
}

export function sanitizeIconHtml(icon, windowObject = window) {
  if (typeof icon !== "string") return ""
  if (!icon.includes("<")) return icon
  return getPurifier(windowObject).sanitize(icon, {
    USE_PROFILES: { svg: true, svgFilters: false },
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ["a", "foreignObject", "script"],
    FORBID_ATTR: ["focusable", "tabindex"],
  })
}

function sanitizeKnownMedia(value, key) {
  if (typeof value === "string" && IMAGE_FIELD_NAMES.has(key)) {
    return isSafeImageUrl(value) ? value.trim() : ""
  }
  if (Array.isArray(value)) {
    if (key === "images") {
      return value.map(item => typeof item === "string" && isSafeImageUrl(item) ? item.trim() : "")
    }
    return value.map(item => sanitizeKnownMedia(item, ""))
  }
  if (value && typeof value === "object") {
    const result = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = sanitizeKnownMedia(childValue, childKey)
    }
    return result
  }
  return value
}

export function sanitizeImportedWork(work, windowObject = window) {
  const copy = sanitizeKnownMedia(work, "")

  if (Array.isArray(copy.nodes)) {
    copy.nodes = copy.nodes.filter(node => node && typeof node === "object" && !Array.isArray(node)).map(node => ({
      ...node,
      content: sanitizeRichHtml(node.content, { profile: "article", windowObject }),
    }))
  }

  if (copy.phoneData) {
    const memos = Array.isArray(copy.phoneData.memos) ? copy.phoneData.memos : []
    const apps = Array.isArray(copy.phoneData.apps) ? copy.phoneData.apps : []
    copy.phoneData.memos = memos.filter(memo => memo && typeof memo === "object" && !Array.isArray(memo)).map(memo => ({
      ...memo,
      content: sanitizeRichHtml(memo.content, { profile: "memo", windowObject }),
    }))
    copy.phoneData.apps = apps.filter(app => app && typeof app === "object" && !Array.isArray(app)).map(app => ({
      ...app,
      color: sanitizeCssColor(app.color),
      icon: sanitizeIconHtml(app.icon, windowObject),
    }))
  }

  if (Array.isArray(copy.phoneModules)) {
    copy.phoneModules = copy.phoneModules.filter(module => module && typeof module === "object" && !Array.isArray(module)).map(module => ({
      ...module,
      data: module.data ? {
        ...module.data,
        apps: (Array.isArray(module.data.apps) ? module.data.apps : []).filter(app => app && typeof app === "object" && !Array.isArray(app)).map(app => ({
          ...app,
          color: sanitizeCssColor(app.color),
          icon: sanitizeIconHtml(app.icon, windowObject),
        })),
        memos: (Array.isArray(module.data.memos) ? module.data.memos : []).filter(memo => memo && typeof memo === "object" && !Array.isArray(memo)).map(memo => ({
          ...memo,
          content: sanitizeRichHtml(memo.content, { profile: "memo", windowObject }),
        })),
      } : module.data,
    }))
  }

  return copy
}
