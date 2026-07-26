import { isSafeImageUrl } from "../js/sanitize.js"
import { normalizeReaderAppearance } from "./article-appearance.js"
import { READER_CUSTOM_CSS_MAX_LENGTH } from "./custom-style.js"

export const READER_APPEARANCE_PACKAGE_FORMAT = "tuuru-reader-appearance"
export const READER_APPEARANCE_PACKAGE_VERSION = 1
export const READER_APPEARANCE_PACKAGE_MAX_BYTES = 24 * 1024 * 1024

const ARTICLE_FIELDS = Object.freeze([
  "fontSize", "lineHeight", "letterSpacing", "paragraphSpacing", "marginSize",
  "contentWidth", "fontFamily", "theme", "backgroundColor", "textColor",
  "backgroundImage", "backgroundFit", "backgroundPosition", "backgroundOverlay",
  "textAlign", "indentFirstLine", "typingEffect", "typingSpeed", "titleSize",
  "titleWeight", "titleSpacing", "metaSpacing", "sectionSpacing", "imageRadius",
  "choiceGap", "choiceRadius", "accentColor", "customCss", "customFonts",
])

const PHONE_SCALAR_FIELDS = Object.freeze([
  "wallpaper", "wallpaperType", "frameColor", "borderRadius", "fontFamily",
  "fontSize", "showDynamicIsland", "dynamicIslandStyle", "showHomeIndicator",
  "showAppLabels", "showIconShadow", "iconBorderRadius", "iconColumns",
  "materialType", "materialOpacity", "timeColor", "customCss",
])

const PHONE_IMAGE_FIELDS = Object.freeze(["wallpaperImage", "topBgImage"])
const PHONE_RECORD_FIELDS = Object.freeze(["appBgs", "appSettings", "customIcons"])
const APP_TYPES = Object.freeze(["messages", "forum", "memo", "gallery", "browser", "shopping", "contacts"])

const APP_SETTING_FIELDS = Object.freeze({
  messages: [
    "avatarShape", "avatarSize", "selfBubbleBg", "selfBubbleText", "selfBubbleRadius",
    "otherBubbleBg", "otherBubbleText", "otherBubbleRadius", "bubbleFontSize",
    "timeColor", "chatBg", "callBackgroundType", "callBackgroundPreset",
    "callBackgroundImage", "customCss",
  ],
  forum: [
    "avatarShape", "cardBg", "cardBorder", "cardRadius", "titleColor", "titleSize",
    "titleWeight", "contentColor", "contentSize", "timeColor", "customCss",
  ],
  memo: ["cardStyle", "cardBg", "cardBorder", "cardRadius", "textColor", "fontSize", "lineHeight", "customCss"],
  gallery: ["columns", "imageRadius", "gap", "customCss"],
  browser: ["entryBg", "entryRadius", "titleColor", "titleSize", "urlColor", "timeColor", "customCss"],
  shopping: ["cardBg", "cardRadius", "nameColor", "nameSize", "priceColor", "customCss"],
  contacts: ["avatarShape", "nameColor", "nameSize", "nameWeight", "customCss"],
})

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownDataValue(record, key) {
  if (!isRecord(record)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function primitive(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
}

function pickPrimitiveFields(record, fields) {
  const picked = {}
  for (const key of fields) {
    const value = ownDataValue(record, key)
    if (primitive(value)) picked[key] = value
  }
  return picked
}

function safeImage(value) {
  return typeof value === "string" && isSafeImageUrl(value) ? value.trim() : null
}

function pickImageRecord(record) {
  const picked = {}
  for (const type of APP_TYPES) {
    const value = ownDataValue(record, type)
    const image = safeImage(value)
    if (image) picked[type] = image
  }
  return picked
}

function pickAppSettings(record) {
  const picked = {}
  for (const type of APP_TYPES) {
    const source = ownDataValue(record, type)
    if (!isRecord(source)) continue
    const settings = pickPrimitiveFields(source, APP_SETTING_FIELDS[type])
    if (typeof settings.customCss === "string") {
      settings.customCss = settings.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    }
    if (type === "messages" && Object.hasOwn(settings, "callBackgroundImage")) {
      settings.callBackgroundImage = safeImage(settings.callBackgroundImage)
    }
    picked[type] = settings
  }
  return picked
}

function pickCustomFonts(value) {
  if (!Array.isArray(value)) return []
  const safeFonts = []
  for (const candidate of value.slice(0, 12)) {
    const name = ownDataValue(candidate, "name")
    const data = ownDataValue(candidate, "data")
    if (typeof name === "string" && typeof data === "string") {
      safeFonts.push({ name, data })
    }
  }
  return normalizeReaderAppearance({ customFonts:safeFonts }).customFonts
}

function pickArticleAppearance(candidate) {
  const safeSource = {}
  for (const key of ARTICLE_FIELDS) {
    const value = ownDataValue(candidate, key)
    if (key === "customFonts") {
      safeSource.customFonts = pickCustomFonts(value)
      continue
    }
    if (primitive(value)) safeSource[key] = value
  }
  return normalizeReaderAppearance(safeSource)
}

function pickPhoneAppearance(candidate) {
  const picked = pickPrimitiveFields(candidate, PHONE_SCALAR_FIELDS)
  for (const key of PHONE_IMAGE_FIELDS) {
    const image = safeImage(ownDataValue(candidate, key))
    if (image) picked[key] = image
    else if (ownDataValue(candidate, key) === null) picked[key] = null
  }
  const customFonts = ownDataValue(candidate, "customFonts")
  picked.customFonts = pickCustomFonts(customFonts)
  const appBgs = ownDataValue(candidate, "appBgs")
  const appSettings = ownDataValue(candidate, "appSettings")
  const customIcons = ownDataValue(candidate, "customIcons")
  picked.appBgs = pickImageRecord(appBgs)
  picked.appSettings = pickAppSettings(appSettings)
  picked.customIcons = pickImageRecord(customIcons)
  return picked
}

function utf8Size(text) {
  return new TextEncoder().encode(text).byteLength
}

function parseInput(input) {
  if (typeof input === "string") {
    if (utf8Size(input) > READER_APPEARANCE_PACKAGE_MAX_BYTES) {
      throw new TypeError("美化包过大，无法导入")
    }
    try {
      return JSON.parse(input)
    } catch {
      throw new TypeError("美化包 JSON 无法解析")
    }
  }
  if (!isRecord(input)) throw new TypeError("美化包格式无效")
  return input
}

export function createReaderAppearancePackage(input) {
  const source = isRecord(input) ? input : {}
  return {
    format: READER_APPEARANCE_PACKAGE_FORMAT,
    version: READER_APPEARANCE_PACKAGE_VERSION,
    appearance: {
      article: pickArticleAppearance(ownDataValue(source, "article")),
      phone: pickPhoneAppearance(ownDataValue(source, "phone")),
    },
  }
}

export function serializeReaderAppearancePackage(input) {
  const serialized = JSON.stringify(createReaderAppearancePackage(input), null, 2)
  if (utf8Size(serialized) > READER_APPEARANCE_PACKAGE_MAX_BYTES) {
    throw new TypeError("美化包过大，无法导出")
  }
  return serialized
}

export function inspectReaderAppearancePackage(input) {
  const parsed = parseInput(input)
  if (ownDataValue(parsed, "format") !== READER_APPEARANCE_PACKAGE_FORMAT) {
    throw new TypeError("这不是 Tuuru 读者美化包，格式无法识别")
  }
  if (ownDataValue(parsed, "version") !== READER_APPEARANCE_PACKAGE_VERSION) {
    throw new TypeError("美化包版本暂不支持")
  }
  const appearance = ownDataValue(parsed, "appearance")
  if (!isRecord(appearance)
    || !isRecord(ownDataValue(appearance, "article"))
    || !isRecord(ownDataValue(appearance, "phone"))) {
    throw new TypeError("美化包缺少完整外观数据")
  }
  const normalized = createReaderAppearancePackage({
    article: ownDataValue(appearance, "article"),
    phone: ownDataValue(appearance, "phone"),
  })
  return {
    article: normalized.appearance.article,
    phone: normalized.appearance.phone,
  }
}
