export const ARTICLE_PLACEHOLDER_MARKER_CLASS = "article-placeholder-anchor"
export const ARTICLE_PLACEHOLDER_MARKER_ATTRIBUTE = "data-article-placeholder"

const SAFE_PLACEHOLDER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function safePlaceholderId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.trim() === value
    && SAFE_PLACEHOLDER_ID.test(value)
}

function markerPattern() {
  return new RegExp(
    `<span\\b(?=[^>]*\\bclass=(?:"[^"]*\\b${ARTICLE_PLACEHOLDER_MARKER_CLASS}\\b[^"]*"|'[^']*\\b${ARTICLE_PLACEHOLDER_MARKER_CLASS}\\b[^']*'))(?=[^>]*\\b${ARTICLE_PLACEHOLDER_MARKER_ATTRIBUTE}=(?:"([^"]*)"|'([^']*)'))[^>]*>\\s*<\\/span>`,
    "gi",
  )
}

export function articlePlaceholderMarkerHTML(placeholderId) {
  if (!safePlaceholderId(placeholderId)) return ""
  return `<span class="${ARTICLE_PLACEHOLDER_MARKER_CLASS}" ${ARTICLE_PLACEHOLDER_MARKER_ATTRIBUTE}="${placeholderId}" contenteditable="false"></span>`
}

export function articlePlaceholderMarkerIds(content) {
  if (typeof content !== "string" || !content) return []
  const ids = []
  const pattern = markerPattern()
  let match
  while ((match = pattern.exec(content))) {
    const id = match[1] ?? match[2] ?? ""
    if (safePlaceholderId(id)) ids.push(id)
  }
  return ids
}

export function removeArticlePlaceholderMarkers(content, placeholderId) {
  if (typeof content !== "string" || !content || !safePlaceholderId(placeholderId)) {
    return typeof content === "string" ? content : ""
  }
  return content.replace(markerPattern(), function(marker, doubleQuotedId, singleQuotedId) {
    return (doubleQuotedId ?? singleQuotedId ?? "") === placeholderId ? "" : marker
  })
}
