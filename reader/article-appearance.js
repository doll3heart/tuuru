import { isSafeImageUrl, sanitizeCssColor } from "../js/sanitize.js"

const DEFAULT_FONT_FAMILY = "'Noto Sans SC', sans-serif"
const EMPTY_FONTS = Object.freeze([])

export const READER_APPEARANCE_DEFAULTS = Object.freeze({
  fontSize: 18,
  lineHeight: 1.9,
  letterSpacing: 0,
  paragraphSpacing: 16,
  marginSize: 20,
  contentWidth: 720,
  fontFamily: DEFAULT_FONT_FAMILY,
  theme: "light",
  backgroundColor: "#f5f5f5",
  textColor: "#333333",
  backgroundImage: null,
  backgroundFit: "cover",
  backgroundPosition: "center",
  backgroundOverlay: 35,
  textAlign: "left",
  indentFirstLine: false,
  typingEffect: false,
  typingSpeed: 50,
  customFonts: EMPTY_FONTS,
})

export const READER_APPEARANCE_THEMES = Object.freeze([
  Object.freeze({ id: "light", name: "清亮", backgroundColor: "#f5f5f5", textColor: "#333333" }),
  Object.freeze({ id: "dark", name: "暗夜", backgroundColor: "#1a1a2e", textColor: "#e6e8f0" }),
  Object.freeze({ id: "green", name: "护眼", backgroundColor: "#c8dcc8", textColor: "#26352a" }),
  Object.freeze({ id: "parchment", name: "羊皮纸", backgroundColor: "#f5e6c8", textColor: "#4a3a2a" }),
  Object.freeze({ id: "gray", name: "浅灰", backgroundColor: "#e8e8e8", textColor: "#333333" }),
])

const THEME_IDS = new Set([...READER_APPEARANCE_THEMES.map(theme => theme.id), "custom"])
const TEXT_ALIGNMENTS = new Set(["left", "center", "right", "justify"])
const BACKGROUND_FITS = new Set(["cover", "contain", "tile"])
const BACKGROUND_POSITIONS = new Set(["center", "top", "bottom", "left", "right"])
const FONT_DATA_PATTERN = /^data:(?:font\/|application\/(?:font|x-font|octet-stream))/i
const SAFE_FONT_NAME_PATTERN = /^[^"'\\;{}<>\u0000-\u001f\u007f]{1,64}$/

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function boundedNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function allowedValue(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback
}

function safeFontFamily(value) {
  if (typeof value !== "string") return DEFAULT_FONT_FAMILY
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200 || /[{};]/.test(trimmed)) return DEFAULT_FONT_FAMILY
  return trimmed
}

function normalizeCustomFonts(value) {
  if (!Array.isArray(value)) return []
  const fonts = []
  for (const candidate of value) {
    const font = plainRecord(candidate)
    const name = typeof font.name === "string" ? font.name.trim() : ""
    const data = typeof font.data === "string" ? font.data.trim() : ""
    if (!SAFE_FONT_NAME_PATTERN.test(name) || !FONT_DATA_PATTERN.test(data)) continue
    fonts.push({ name, data })
    if (fonts.length === 12) break
  }
  return fonts
}

export function normalizeReaderAppearance(candidate) {
  const source = plainRecord(candidate)
  const defaults = READER_APPEARANCE_DEFAULTS
  const backgroundImage = typeof source.backgroundImage === "string"
    && isSafeImageUrl(source.backgroundImage)
    ? source.backgroundImage.trim()
    : null

  return {
    fontSize: boundedNumber(source.fontSize, defaults.fontSize, 12, 36),
    lineHeight: boundedNumber(source.lineHeight, defaults.lineHeight, 1.2, 3),
    letterSpacing: boundedNumber(source.letterSpacing, defaults.letterSpacing, -1, 10),
    paragraphSpacing: boundedNumber(source.paragraphSpacing, defaults.paragraphSpacing, 0, 48),
    marginSize: boundedNumber(source.marginSize, defaults.marginSize, 0, 64),
    contentWidth: boundedNumber(source.contentWidth, defaults.contentWidth, 420, 1080),
    fontFamily: safeFontFamily(source.fontFamily),
    theme: allowedValue(source.theme, THEME_IDS, defaults.theme),
    backgroundColor: sanitizeCssColor(source.backgroundColor, { fallback: defaults.backgroundColor }),
    textColor: sanitizeCssColor(source.textColor, { fallback: defaults.textColor }),
    backgroundImage,
    backgroundFit: allowedValue(source.backgroundFit, BACKGROUND_FITS, defaults.backgroundFit),
    backgroundPosition: allowedValue(source.backgroundPosition, BACKGROUND_POSITIONS, defaults.backgroundPosition),
    backgroundOverlay: boundedNumber(source.backgroundOverlay, defaults.backgroundOverlay, 0, 90),
    textAlign: allowedValue(source.textAlign, TEXT_ALIGNMENTS, defaults.textAlign),
    indentFirstLine: typeof source.indentFirstLine === "boolean" ? source.indentFirstLine : defaults.indentFirstLine,
    typingEffect: typeof source.typingEffect === "boolean" ? source.typingEffect : defaults.typingEffect,
    typingSpeed: boundedNumber(source.typingSpeed, defaults.typingSpeed, 10, 500),
    customFonts: normalizeCustomFonts(source.customFonts),
  }
}

export function resolveReaderAppearanceTheme(settings) {
  const normalized = normalizeReaderAppearance(settings)
  if (normalized.theme === "custom") {
    return {
      backgroundColor: normalized.backgroundColor,
      textColor: normalized.textColor,
    }
  }
  const preset = READER_APPEARANCE_THEMES.find(theme => theme.id === normalized.theme)
    || READER_APPEARANCE_THEMES[0]
  return {
    backgroundColor: preset.backgroundColor,
    textColor: preset.textColor,
  }
}
