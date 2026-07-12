const SAFE_IDENTIFIER = /^[^\u0000-\u001f\u007f&<>"'`=\\]{1,256}$/
const SAFE_HEX_COLOR = /^#[0-9a-f]{3,8}$/i
const SAFE_NAMED_COLOR = /^[a-z]{1,32}$/i
const SAFE_COLOR_FUNCTION = /^(?:rgb|rgba|hsl|hsla)\([0-9\s.,%/+\-]+\)$/i
const SAFE_CSS_VARIABLE = /^var\(--[a-z0-9_-]{1,64}\)$/i
const UNSAFE_ICON_MARKUP = /<\s*(?:script|iframe|object|embed|foreignobject|a)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|javascript\s*:|url\s*\(/i

export function isSafeIdentifier(value) {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value)
}

export function isSafeCssColor(value) {
  if (typeof value !== "string") return false
  const color = value.trim()
  if (!color || color.length > 128) return false
  return SAFE_HEX_COLOR.test(color)
    || SAFE_NAMED_COLOR.test(color)
    || SAFE_COLOR_FUNCTION.test(color)
    || SAFE_CSS_VARIABLE.test(color)
}

export function normalizeCssColor(value, fallback = "#f0f0f0") {
  return isSafeCssColor(value) ? value.trim() : fallback
}

export function isSafeIconValue(value) {
  return typeof value === "string"
    && value.length <= 64 * 1024
    && !UNSAFE_ICON_MARKUP.test(value)
}
