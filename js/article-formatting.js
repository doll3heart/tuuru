export const DEFAULT_ARTICLE_FORMATTING = Object.freeze({
  indentFirstLine: false,
})

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function normalizeArticleFormatting(candidate) {
  const source = plainRecord(candidate) ? candidate : {}
  return {
    indentFirstLine: source.indentFirstLine === true,
  }
}

export function articleFormattingFromEditorSettings(editorSettings) {
  return normalizeArticleFormatting(editorSettings)
}
