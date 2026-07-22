function normalizedNames(names) {
  return Array.from(new Set((Array.isArray(names) ? names : [])
    .map(name => String(name || "").trim())
    .filter(Boolean)))
    .sort((left, right) => right.length - left.length || left.localeCompare(right, "zh-CN"))
}

export function splitMentionText(value, names) {
  const text = String(value ?? "")
  const candidates = normalizedNames(names)
  if (!text || candidates.length === 0 || !text.includes("@")) {
    return text ? [{ text, mention:false }] : []
  }

  const segments = []
  let scan = 0
  let plainStart = 0
  while (scan < text.length) {
    const at = text.indexOf("@", scan)
    if (at < 0) break
    const name = candidates.find(candidate => text.startsWith(candidate, at + 1))
    if (!name) {
      scan = at + 1
      continue
    }
    if (at > plainStart) segments.push({ text:text.slice(plainStart, at), mention:false })
    segments.push({ text:"@" + name, mention:true, name })
    scan = at + name.length + 1
    plainStart = scan
  }
  if (plainStart < text.length) segments.push({ text:text.slice(plainStart), mention:false })
  if (segments.length === 0) return [{ text, mention:false }]
  return segments
}
