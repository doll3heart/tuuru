const FORBIDDEN_WORD_SEPARATOR = /[\r\n,，、;；/／|｜]+/

export function dedupeForbiddenWords(words) {
  const result = []
  const seen = new Set()
  for (const value of Array.isArray(words) ? words : []) {
    const word = String(value ?? "").trim()
    if (!word) continue
    const key = word.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(word)
  }
  return result
}

export function parseForbiddenWords(value) {
  const source = Array.isArray(value) ? value : [value]
  const words = source.flatMap(item => String(item ?? "").split(FORBIDDEN_WORD_SEPARATOR))
  return dedupeForbiddenWords(words)
}

export function filterForbiddenWords(words, query) {
  const normalizedQuery = String(query ?? "").trim().toLocaleLowerCase()
  const source = dedupeForbiddenWords(words)
  if (!normalizedQuery) return source
  return source.filter(word => word.toLocaleLowerCase().includes(normalizedQuery))
}

export function effectiveForbiddenWords(placeholder, globalForbidden) {
  return dedupeForbiddenWords([
    ...parseForbiddenWords(globalForbidden),
    ...parseForbiddenWords(placeholder?.forbidden),
  ])
}
