function visibleText(html) {
  return String(html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, function(_match, code) { return String.fromCodePoint(Number(code)) })
    .replace(/\s+/g, " ")
    .trim()
}

function excerptAround(text, query) {
  var lower = text.toLocaleLowerCase()
  var index = lower.indexOf(query)
  var start = Math.max(0, index < 0 ? 0 : index - 28)
  var excerpt = text.slice(start, start + 96)
  return (start > 0 ? "…" : "") + excerpt + (start + 96 < text.length ? "…" : "")
}

export function searchArticleWork(work, rawQuery) {
  var query = String(rawQuery || "").trim().toLocaleLowerCase()
  if (!query) return []
  var chapters = new Map((work?.chapters || []).map(function(chapter) { return [String(chapter.id || ""), String(chapter.name || "")] }))
  return (work?.nodes || []).map(function(node, index) {
    var title = String(node.title || "")
    var chapterName = chapters.get(String(node.chapterId || "")) || "未分章"
    var body = visibleText(node.content)
    var choices = (node.choices || []).map(function(choice) { return String(choice.text || "") }).join(" ")
    var titleLower = title.toLocaleLowerCase()
    var chapterLower = chapterName.toLocaleLowerCase()
    var bodyLower = body.toLocaleLowerCase()
    var choicesLower = choices.toLocaleLowerCase()
    var score = 0
    if (titleLower === query) score += 120
    else if (titleLower.startsWith(query)) score += 90
    else if (titleLower.includes(query)) score += 70
    if (chapterLower.includes(query)) score += 45
    if (choicesLower.includes(query)) score += 35
    if (bodyLower.includes(query)) score += 25
    if (!score) return null
    var excerptSource = bodyLower.includes(query) ? body : (choicesLower.includes(query) ? choices : body)
    return {nodeId:node.id, title:title || "未命名节点", chapterName:chapterName, excerpt:excerptAround(excerptSource, query), score:score, index:index}
  }).filter(Boolean).sort(function(a, b) { return b.score - a.score || a.index - b.index }).slice(0, 50)
}
