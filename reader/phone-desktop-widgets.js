import { escapeHtmlAttribute, isSafeImageUrl, sanitizeCssColor } from "../js/sanitize.js"
import { phoneWidgetSystemSnapshot } from "./phone-widget-time.js"

export const PHONE_DESKTOP_WIDGET_KINDS = Object.freeze([
  { id:"resume", label:"阅读续页", appType:"messages" },
  { id:"voice", label:"留声", appType:"messages" },
  { id:"schedule", label:"日程", appType:"messages" },
  { id:"clock", label:"时钟", appType:"messages" },
  { id:"note", label:"摘句", appType:"memo" },
  { id:"journey", label:"阅读轨道", appType:"messages" },
  { id:"photo", label:"照片", appType:"gallery" },
  { id:"decor", label:"装饰", appType:"" },
])

// Kept as a compatibility export for older appearance records. V7 products own
// their approved composition and no longer expose arbitrary shell swapping.
export const PHONE_DESKTOP_WIDGET_SKINS = Object.freeze([
  { id:"polaroid", label:"拍立得叠层" },
  { id:"film", label:"胶片条" },
  { id:"torn-note", label:"撕边便签" },
  { id:"envelope", label:"信封" },
  { id:"ticket", label:"票根" },
  { id:"record", label:"磁带与唱片" },
  { id:"acrylic", label:"透明亚克力" },
  { id:"folder", label:"文件夹标签" },
  { id:"capsule", label:"横向胶囊" },
  { id:"floating", label:"无底色悬浮文字" },
  { id:"decoration", label:"透明 PNG 装饰" },
])

const products = [
  ["v7-resume-dessert", "续读横幅", "function", "resume", "resume-dessert", "wide", 0, "沿用阅读进度与作品标题"],
  ["v7-player-bunny", "氛围播放器", "function", "voice", "player-bunny", "wide", 1, "封面和文字都由读者自己选择"],
  ["v7-date-picture", "日期画片", "function", "schedule", "date-picture", "wide", 1, "系统日期旁保留一格自选照片"],
  ["v7-voice-medallion", "留声圆章", "function", "voice", "voice-medallion", "half", 0, "标题与短句由读者填写"],
  ["v7-countdown-cherry", "倒数标签", "function", "schedule", "countdown-cherry", "half", 0, "按读者填写的目标日期倒数"],
  ["v7-clock-dessert", "甜品时钟", "function", "clock", "clock-dessert", "half", 0, "读取当前桌面时间"],
  ["v7-schedule-ribbon", "日程丝带", "function", "schedule", "schedule-ribbon", "wide", 0, "系统日期搭配读者填写的事项"],
  ["v7-quote-blue", "今日摘句", "function", "note", "quote-blue", "wide", 0, "显示读者保存的本机摘句"],
  ["v7-journey-twilight", "阅读轨道", "function", "journey", "journey-twilight", "half", 0, "显示当前阅读进度"],
  ["v7-photo-double", "双幅画框", "photo", "photo", "photo-double", "wide", 2, "两张照片各自选择"],
  ["v7-photo-polaroid", "散落拍立得", "photo", "photo", "photo-polaroid", "half", 2, "两张相纸互不穿插"],
  ["v7-photo-hanging", "晾晒相片", "photo", "photo", "photo-hanging", "wide", 3, "三张照片分别添加"],
  ["v7-photo-heart", "心形相匣", "photo", "photo", "photo-heart", "half", 1, "提供心形裁切与蕾丝承托"],
  ["v7-photo-cameo", "丝带肖像", "photo", "photo", "photo-cameo", "half", 1, "提供椭圆肖像裁切"],
  ["v7-photo-round", "圆盘画片", "photo", "photo", "photo-round", "half", 1, "适合头像或剧情插画"],
  ["v7-photo-booth", "大头贴竖条", "photo", "photo", "photo-booth", "half", 3, "三格照片分别选择"],
  ["v7-photo-postcard", "胶带明信片", "photo", "photo", "photo-postcard", "wide", 1, "保留纸张留白与胶带"],
  ["v7-photo-wing", "翅膀小窗", "photo", "photo", "photo-wing", "half", 1, "一格轻量照片小窗"],
  ["v7-decor-parasol", "伞下摆件", "decor", "decor", "decor-parasol", "half", 0, "只摆着，不承担跳转"],
  ["v7-decor-cake", "甜品圆盘", "decor", "decor", "decor-cake", "half", 0, "同画风兔兔甜品摆件"],
  ["v7-decor-strawberry", "草莓吊饰", "decor", "decor", "decor-strawberry", "half", 0, "纯物件素材直接成立"],
  ["v7-decor-balloons", "气球心章", "decor", "decor", "decor-balloons", "half", 0, "兔兔与气球心形边框"],
  ["v7-decor-spoons", "三色试吃勺", "decor", "decor", "decor-spoons", "wide", 0, "不同口味组成桌面小托盘"],
  ["v7-decor-tickets", "收藏票根", "decor", "decor", "decor-tickets", "wide", 0, "票根作为桌面陈列物"],
  ["v7-decor-lace-heart", "蕾丝心章", "decor", "decor", "decor-lace-heart", "half", 0, "空心边框本身就是组件"],
  ["v7-decor-basket", "花篮置物", "decor", "decor", "decor-basket", "wide", 0, "无外框角色小物"],
]

export const PHONE_DESKTOP_WIDGET_PRODUCTS = Object.freeze(products.map(product => Object.freeze({
  id:product[0],
  label:product[1],
  category:product[2],
  kind:product[3],
  layout:product[4],
  defaultSize:product[5],
  photoSlots:product[6],
  hint:product[7],
  appType:PHONE_DESKTOP_WIDGET_KINDS.find(kind => kind.id === product[3])?.appType || "",
})))

const PRODUCT_BY_ID = new Map(PHONE_DESKTOP_WIDGET_PRODUCTS.map(product => [product.id, product]))
const PRODUCT_IDS = new Set(PRODUCT_BY_ID.keys())
const ASSET_ROOT = "assets/widgets/v7/"

export const PHONE_CUSTOM_DECORATION_MAX_ITEMS = 8
export const PHONE_CUSTOM_DECORATION_SIZES = Object.freeze([
  Object.freeze({ id:"small", label:"2 × 2 格", width:2, height:2 }),
  Object.freeze({ id:"half", label:"4 × 3 格", width:4, height:3 }),
  Object.freeze({ id:"wide", label:"8 × 3 格", width:8, height:3 }),
])

const CUSTOM_DECORATION_ID_PATTERN = /^custom-[a-z0-9-]{8,80}$/
const CUSTOM_DECORATION_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,/i
const CUSTOM_DECORATION_SIZE_IDS = new Set(PHONE_CUSTOM_DECORATION_SIZES.map(size => size.id))

export function phoneCustomDecorationSizeForDimensions(width, height) {
  const ratio = Number(width) / Number(height)
  if (!Number.isFinite(ratio) || ratio <= 0) return "half"
  if (ratio >= 1.65) return "wide"
  if (ratio >= 1.1) return "half"
  return "small"
}

export const PHONE_DESKTOP_WIDGET_FIELDS = Object.freeze({
  "v7-player-bunny":Object.freeze([
    Object.freeze({ key:"title", label:"播放标题", placeholder:"留空则不显示" }),
    Object.freeze({ key:"detail", label:"副标题", placeholder:"由读者填写" }),
  ]),
  "v7-date-picture":Object.freeze([
    Object.freeze({ key:"detail", label:"日期旁文字", placeholder:"由读者填写" }),
  ]),
  "v7-voice-medallion":Object.freeze([
    Object.freeze({ key:"title", label:"留言标题", placeholder:"由读者填写" }),
    Object.freeze({ key:"detail", label:"时长或短句", placeholder:"例如 00:17，也可留空" }),
  ]),
  "v7-countdown-cherry":Object.freeze([
    Object.freeze({ key:"title", label:"事件名称", placeholder:"由读者填写" }),
    Object.freeze({ key:"detail", label:"补充说明", placeholder:"由读者填写" }),
    Object.freeze({ key:"targetDate", label:"目标日期", type:"datetime-local" }),
  ]),
  "v7-clock-dessert":Object.freeze([
    Object.freeze({ key:"detail", label:"时钟说明", placeholder:"由读者填写" }),
  ]),
  "v7-schedule-ribbon":Object.freeze([
    Object.freeze({ key:"title", label:"事项", placeholder:"由读者填写" }),
    Object.freeze({ key:"detail", label:"地点或备注", placeholder:"由读者填写" }),
  ]),
  "v7-quote-blue":Object.freeze([
    Object.freeze({ key:"title", label:"摘句", placeholder:"由读者填写" }),
    Object.freeze({ key:"detail", label:"署名或备注", placeholder:"由读者填写" }),
  ]),
})

function ownRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null ? value : {}
}

function ownValue(record, key) {
  const descriptor = Object.getOwnPropertyDescriptor(ownRecord(record), key)
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function safeText(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeImage(value) {
  return typeof value === "string" && isSafeImageUrl(value) ? value.trim() : ""
}

function safeCustomDecorationImage(value) {
  const image = safeImage(value)
  return CUSTOM_DECORATION_IMAGE_PATTERN.test(image) ? image : ""
}

function defaultItem(product) {
  return {
    productId:product.id,
    kind:product.kind,
    enabled:false,
    size:product.defaultSize,
    photos:Array(product.photoSlots).fill(null),
  }
}

export function defaultPhoneDesktopWidgets() {
  return {
    enabled:false,
    accent:"#c7a1aa",
    surface:"#fffaf9",
    text:"#40383b",
    note:"",
    fields:{},
    decorationImage:null,
    customDecorations:[],
    items:PHONE_DESKTOP_WIDGET_PRODUCTS.map(defaultItem),
  }
}

function normalizedFields(value, legacyNote) {
  const source = ownRecord(value)
  const fields = {}
  for (const [productId, definitions] of Object.entries(PHONE_DESKTOP_WIDGET_FIELDS)) {
    const raw = ownRecord(ownValue(source, productId))
    const normalized = {}
    for (const definition of definitions) {
      const text = safeText(ownValue(raw, definition.key), definition.key === "targetDate" ? 32 : 120)
      if (text) normalized[definition.key] = text
    }
    if (productId === "v7-quote-blue" && !normalized.title && legacyNote) normalized.title = legacyNote
    if (Object.keys(normalized).length) fields[productId] = normalized
  }
  return fields
}

function productForLegacyKind(kind, seen) {
  return PHONE_DESKTOP_WIDGET_PRODUCTS.find(product => product.kind === kind && !seen.has(product.id)) || null
}

function normalizedPhotos(value, count) {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length:count }, (_, index) => safeImage(source[index]) || null)
}

function normalizedCustomDecorations(value) {
  const source = Array.isArray(value) ? value : []
  const seen = new Set()
  const decorations = []
  for (const rawValue of source) {
    if (decorations.length >= PHONE_CUSTOM_DECORATION_MAX_ITEMS) break
    const raw = ownRecord(rawValue)
    const id = safeText(ownValue(raw, "id"), 87)
    const image = safeCustomDecorationImage(ownValue(raw, "image"))
    if (!CUSTOM_DECORATION_ID_PATTERN.test(id) || !image || seen.has(id)) continue
    const rawSize = ownValue(raw, "size")
    decorations.push({
      id,
      name:safeText(ownValue(raw, "name"), 40) || "自定义装饰",
      image,
      size:CUSTOM_DECORATION_SIZE_IDS.has(rawSize) ? rawSize : "half",
    })
    seen.add(id)
  }
  return decorations
}

export function normalizePhoneDesktopWidgets(candidate) {
  const defaults = defaultPhoneDesktopWidgets()
  const source = ownRecord(candidate)
  const sourceItems = Array.isArray(ownValue(source, "items")) ? ownValue(source, "items") : []
  const seen = new Set()
  const items = []
  for (const rawItem of sourceItems) {
    const item = ownRecord(rawItem)
    const rawProductId = ownValue(item, "productId")
    const product = PRODUCT_IDS.has(rawProductId)
      ? PRODUCT_BY_ID.get(rawProductId)
      : productForLegacyKind(ownValue(item, "kind"), seen)
    if (!product || seen.has(product.id)) continue
    items.push({
      productId:product.id,
      kind:product.kind,
      enabled:typeof ownValue(item, "enabled") === "boolean" ? ownValue(item, "enabled") : false,
      size:product.defaultSize,
      photos:normalizedPhotos(ownValue(item, "photos"), product.photoSlots),
    })
    seen.add(product.id)
  }
  for (const product of PHONE_DESKTOP_WIDGET_PRODUCTS) {
    if (!seen.has(product.id)) items.push(defaultItem(product))
  }
  const rawDecoration = ownValue(source, "decorationImage")
  const legacyNote = safeText(ownValue(source, "note"), 280)
  return {
    enabled:typeof ownValue(source, "enabled") === "boolean" ? ownValue(source, "enabled") : defaults.enabled,
    accent:sanitizeCssColor(ownValue(source, "accent"), { fallback:defaults.accent }),
    surface:sanitizeCssColor(ownValue(source, "surface"), { fallback:defaults.surface }),
    text:sanitizeCssColor(ownValue(source, "text"), { fallback:defaults.text }),
    note:legacyNote,
    fields:normalizedFields(ownValue(source, "fields"), legacyNote),
    decorationImage:rawDecoration === null ? null : (safeImage(rawDecoration) || null),
    customDecorations:normalizedCustomDecorations(ownValue(source, "customDecorations")),
    items,
  }
}

function resolvedContent(product, config, phoneData, context) {
  const fields = ownRecord(config.fields?.[product.id])
  const system = phoneWidgetSystemSnapshot(context.systemNow instanceof Date ? context.systemNow : new Date(), fields.targetDate)
  const progress = Math.max(0, Math.min(100, Math.round(Number(context.progressPercent) || 0)))
  if (product.kind === "resume") return {
    title:safeText(context.workTitle) || "正在阅读",
    detail:safeText(context.progressLabel) || "从上次停下的位置继续",
    meta:"继续阅读",
    progress,
  }
  if (product.kind === "voice") return {
    title:safeText(fields.title), detail:safeText(fields.detail), meta:safeText(fields.detail),
  }
  if (product.kind === "schedule") return {
    title:safeText(fields.title), detail:safeText(fields.detail), meta:product.layout === "date-picture" ? system.month : system.monthDay,
    systemDay:system.day, weekdayTime:system.weekdayTime, countdownDays:system.countdownDays,
    targetDate:safeText(fields.targetDate, 32),
  }
  if (product.kind === "clock") return {
    title:system.time,
    detail:safeText(fields.detail),
    meta:system.monthDay,
  }
  if (product.kind === "note") return {
    title:safeText(fields.title),
    detail:safeText(fields.detail),
    meta:system.monthDay,
  }
  if (product.kind === "journey") return {
    title:`${progress}%`,
    detail:safeText(context.progressLabel) || "第三章",
    meta:"阅读轨道",
    progress,
  }
  return { title:product.label, detail:product.hint, meta:product.category === "photo" ? "用户照片" : "桌面摆件" }
}

export function resolvePhoneDesktopWidgets(candidate, phoneData = {}, context = {}) {
  const config = normalizePhoneDesktopWidgets(candidate)
  const safeContext = ownRecord(context)
  return config.items.filter(item => item.enabled).map(item => {
    const product = PRODUCT_BY_ID.get(item.productId)
    return {
      ...item,
      ...resolvedContent(product, config, phoneData, safeContext),
      label:product.label,
      category:product.category,
      layout:product.layout,
      photoSlots:product.photoSlots,
      appType:product.appType,
    }
  })
}

function asset(name, className = "v7-frame") {
  return `<img class="${className}" src="${ASSET_ROOT}${name}" alt="">`
}

function photoSlot(url, label = "用户照片", extraClass = "") {
  const image = safeImage(url)
  const classes = ["v7-photo-slot", image ? "has-image" : "is-empty", extraClass].filter(Boolean).join(" ")
  return `<span class="${classes}" aria-label="${escapeHtmlAttribute(label)}">${image ? `<img src="${escapeHtmlAttribute(image)}" alt="">` : ""}</span>`
}

function productMarkup(widget) {
  const p = widget.photos || []
  const title = escapeHtml(widget.title)
  const detail = escapeHtml(widget.detail)
  const meta = escapeHtml(widget.meta)
  switch (widget.layout) {
    case "resume-dessert":
      return `${asset("frame-dessert-strip.png")}<span class="v7-resume-copy"><small>${meta}</small><strong>${title}</strong><span>${detail}</span><b>${widget.progress}%</b></span>`
    case "player-bunny":
      return `<span class="v7-player-shell"><span class="v7-player-inner">${photoSlot(p[0], "播放器封面", "v7-album")}<span class="v7-track"><small>正在播放</small><strong>${title}</strong><span>${detail}</span><i class="v7-progress"><i></i></i><span class="v7-controls" aria-hidden="true"><i>↶</i><i>◀</i><b>Ⅱ</b><i>▶</i><i>♡</i></span></span></span></span>`
    case "date-picture":
      return `<span class="v7-date-card"><span class="v7-date-copy"><small data-v7-system-month>${meta}</small><strong data-v7-system-day>${escapeHtml(widget.systemDay)}</strong><span data-v7-system-weekday-time>${escapeHtml(widget.weekdayTime)}</span>${detail ? `<em>${detail}</em>` : ""}<i></i></span>${photoSlot(p[0], "日期画片", "v7-date-art")}</span>`
    case "voice-medallion":
      return `${asset("round-pink-bow.png", "v7-round")}<span class="v7-voice-copy"><small>${title}</small><strong>${meta}</strong><span class="v7-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span>`
    case "countdown-cherry":
      return `${asset("frame-cherry-note.png")}<span class="v7-countdown-copy" data-v7-countdown-target="${escapeHtmlAttribute(widget.targetDate || "")}"><strong data-v7-countdown-days>${escapeHtml(widget.countdownDays)}</strong><span data-v7-countdown-label>${widget.countdownDays === "" ? "" : "天"}</span><small>${title}</small>${detail ? `<em>${detail}</em>` : ""}</span>`
    case "clock-dessert":
      return `${asset("frame-dessert-round.png", "v7-round")}<span class="v7-clock-copy"><strong data-v7-system-time>${title}</strong><span>${detail}</span><i></i></span>`
    case "schedule-ribbon":
      return `${asset("frame-ribbon-landscape.png")}<span class="v7-schedule-copy"><b data-v7-system-day>${escapeHtml(widget.systemDay)}<small data-v7-system-month-day>${meta}</small></b><span><strong>${title}</strong><small>${detail}</small><i></i></span></span>`
    case "quote-blue":
      return `${asset("frame-ribbon-blue.png")}<span class="v7-quote-copy"><q>${title}</q><small><span data-v7-system-month-day>${meta}</span>${detail ? ` · ${detail}` : ""}</small></span>`
    case "journey-twilight":
      return `${asset("round-twilight.png", "v7-round")}<span class="v7-journey-ring" style="--v7-progress:${widget.progress * 3.6}deg"><span><strong>${title}</strong><small>${detail}</small></span></span>`
    case "photo-double":
      return `<span class="v7-double-frame">${photoSlot(p[0], "照片一")}${photoSlot(p[1], "照片二")}</span>`
    case "photo-polaroid":
      return `<span class="v7-polaroid-stack"><span class="v7-polaroid-card p1">${photoSlot(p[0], "照片一")}</span><span class="v7-polaroid-card p2">${photoSlot(p[1], "照片二")}</span></span>`
    case "photo-hanging":
      return `<span class="v7-hanging">${photoSlot(p[0], "照片一", "a")}${photoSlot(p[1], "照片二", "b")}${photoSlot(p[2], "照片三", "c")}${asset("polaroids-hanging.png")}</span>`
    case "photo-heart":
      return `${photoSlot(p[0], "心形照片", "v7-heart-photo")}${asset("frame-heart-pink.png")}`
    case "photo-cameo":
      return `${photoSlot(p[0], "椭圆照片", "v7-cameo-photo")}${asset("frame-ribbon-cameo.png")}`
    case "photo-round":
      return `${photoSlot(p[0], "圆形照片", "v7-round-photo")}${asset("round-rose.png", "v7-round")}`
    case "photo-booth":
      return `<span class="v7-booth">${photoSlot(p[0], "照片一")}${photoSlot(p[1], "照片二")}${photoSlot(p[2], "照片三")}<small>OUR LITTLE DAY</small></span>`
    case "photo-postcard":
      return `${photoSlot(p[0], "明信片照片", "v7-postcard-photo")}${asset("polaroids-taped.png")}`
    case "photo-wing":
      return `${photoSlot(p[0], "小窗照片", "v7-wing-photo")}${asset("label-wing-note.png")}`
    case "decor-parasol":
      return `<span class="v7-decor-blob"></span>${asset("rabbit-parasol.png", "v7-center-art")}<i class="v7-spark s1">✦</i><i class="v7-spark s2">✦</i>`
    case "decor-cake":
      return `${asset("frame-dessert-round.png", "v7-round")}${asset("rabbit-cake.png", "v7-center-art")}`
    case "decor-strawberry":
      return asset("ornament-strawberries.png", "v7-object-art")
    case "decor-balloons":
      return `${asset("frame-dessert-heart.png", "v7-round")}${asset("rabbit-balloons.png", "v7-center-art")}`
    case "decor-spoons":
      return `<span class="v7-spoon-plate"></span>${asset("spoon-blue.png", "v7-spoon blue")}${asset("spoon-pink.png", "v7-spoon pink")}${asset("spoon-vanilla.png", "v7-spoon vanilla")}`
    case "decor-tickets":
      return `${asset("ticket-rose.png", "v7-ticket rose")}${asset("ticket-ferry-pair.png", "v7-ticket blue")}`
    case "decor-lace-heart":
      return asset("frame-heart-lace.png")
    case "decor-basket":
      return `${asset("rabbit-basket.png", "v7-basket-art")}<i class="v7-spark s1">✦</i><i class="v7-spark s2">·</i><i class="v7-spark s3">✧</i>`
    default:
      return `<span class="v7-fallback"><strong>${escapeHtml(widget.label)}</strong><small>${detail}</small></span>`
  }
}

function renderResolvedPhoneDesktopWidget(widget, staticPreview) {
  const interactive = widget.category === "function" && !staticPreview
  const tag = interactive ? "button" : "div"
  const behavior = interactive
    ? ` type="button" aria-label="打开${escapeHtmlAttribute(widget.label)}"`
    : ` role="img" aria-label="${escapeHtmlAttribute(widget.label)}"`
  const app = widget.appType ? ` data-widget-app="${escapeHtmlAttribute(widget.appType)}"` : ""
  let html = `<${tag}${behavior} class="phone-story-widget phone-story-widget-v7 is-${widget.size}" data-widget-kind="${escapeHtmlAttribute(widget.kind)}" data-widget-product="${escapeHtmlAttribute(widget.productId)}" data-widget-category="${escapeHtmlAttribute(widget.category)}"${app}>`
  html += `<span class="v7-widget v7-${escapeHtmlAttribute(widget.layout)}">${productMarkup(widget)}</span></${tag}>`
  return html
}

export function renderPhoneDesktopWidget(candidate, productId, phoneData = {}, context = {}) {
  const widget = resolvePhoneDesktopWidgets(candidate, phoneData, context)
    .find(item => item.productId === productId)
  if (!widget) return ""
  return renderResolvedPhoneDesktopWidget(widget, ownValue(ownRecord(context), "staticPreview") === true)
}

export function renderPhoneDesktopWidgets(candidate, phoneData = {}, context = {}) {
  const widgets = resolvePhoneDesktopWidgets(candidate, phoneData, context)
  if (!widgets.length) return ""
  const staticPreview = ownValue(ownRecord(context), "staticPreview") === true
  let html = `<section class="phone-story-widgets is-v7" aria-label="剧情桌面组件">`
  for (const widget of widgets) {
    html += renderResolvedPhoneDesktopWidget(widget, staticPreview)
  }
  html += "</section>"
  return html
}

export function renderPhoneCustomDecoration(candidate, decorationId) {
  const config = normalizePhoneDesktopWidgets(candidate)
  const decoration = config.customDecorations.find(item => item.id === decorationId)
  if (!decoration) return ""
  return `<div class="phone-story-widget phone-custom-decoration is-${escapeHtmlAttribute(decoration.size)}" role="img" aria-label="${escapeHtmlAttribute(decoration.name)}" data-custom-decoration="${escapeHtmlAttribute(decoration.id)}"><img src="${escapeHtmlAttribute(decoration.image)}" alt=""></div>`
}
