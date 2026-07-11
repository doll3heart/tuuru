function normalizeHex(value) {
  const input = String(value || "").trim().toLowerCase()
  const short = input.match(/^#([0-9a-f]{3})$/i)
  if (short) return "#" + [...short[1]].map(channel => channel + channel).join("")
  return /^#[0-9a-f]{6}$/i.test(input) ? input : null
}

function relativeLuminance(value) {
  const hex = normalizeHex(value)
  if (!hex) throw new TypeError("A hexadecimal color is required")

  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const linear = channels.map(channel => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

export function colorContrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (light + 0.05) / (dark + 0.05)
}

export function pickReadableColor(background, preferredColors = [], minimum = 4.5) {
  const candidates = [
    ...(Array.isArray(preferredColors) ? preferredColors : [preferredColors]),
    "#ffffff",
    "#111827",
    "#000000",
  ]
    .map(normalizeHex)
    .filter((color, index, colors) => color && colors.indexOf(color) === index)

  let bestColor = candidates[0]
  let bestRatio = -Infinity
  for (const color of candidates) {
    const ratio = colorContrastRatio(color, background)
    if (ratio >= minimum) return color
    if (ratio > bestRatio) {
      bestColor = color
      bestRatio = ratio
    }
  }
  return bestColor
}
