import { isSafeImageUrl } from "./sanitize.js"

export const WORK_WATERMARK_IMAGE_MAX_BYTES = 1024 * 1024

export const DEFAULT_WORK_WATERMARK = Object.freeze({
  enabled: false,
  kind: "text",
  text: "",
  image: null,
  opacity: 0.16,
  coverage: "single",
  position: "bottom-right",
  pattern: "diagonal",
  spacing: 160,
})

const KINDS = new Set(["text", "image"])
const COVERAGES = new Set(["single", "full"])
const POSITIONS = new Set(["top-left", "top-right", "center", "bottom-left", "bottom-right"])
const PATTERNS = new Set(["diagonal", "cross"])
const EMBEDDED_RASTER_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i

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

function normalizedText(value) {
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80)
}

function decodedBase64Bytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0)
  return (base64.length / 4 * 3) - padding
}

function normalizedImage(value) {
  if (typeof value !== "string") return null
  const image = value.trim()
  if (!EMBEDDED_RASTER_PATTERN.test(image) || !isSafeImageUrl(image)) return null
  const byteLength = decodedBase64Bytes(image)
  if (!Number.isFinite(byteLength) || byteLength <= 0 || byteLength > WORK_WATERMARK_IMAGE_MAX_BYTES) return null
  return image
}

export function normalizeWorkWatermark(candidate) {
  const source = plainRecord(candidate)
  const defaults = DEFAULT_WORK_WATERMARK
  return {
    enabled: source.enabled === true,
    kind: allowedValue(source.kind, KINDS, defaults.kind),
    text: normalizedText(source.text),
    image: normalizedImage(source.image),
    opacity: boundedNumber(source.opacity, defaults.opacity, 0.05, 0.45),
    coverage: allowedValue(source.coverage, COVERAGES, defaults.coverage),
    position: allowedValue(source.position, POSITIONS, defaults.position),
    pattern: allowedValue(source.pattern, PATTERNS, defaults.pattern),
    spacing: boundedNumber(source.spacing, defaults.spacing, 80, 260),
  }
}

export function hasRenderableWorkWatermark(candidate) {
  const watermark = normalizeWorkWatermark(candidate)
  if (!watermark.enabled) return false
  return watermark.kind === "image" ? Boolean(watermark.image) : Boolean(watermark.text)
}
