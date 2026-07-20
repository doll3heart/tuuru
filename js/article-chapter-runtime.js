function uniqueNode(nodes, id) {
  var matches = (nodes || []).filter(function(node) { return String(node?.id || "") === String(id || "") })
  return matches.length === 1 ? matches[0] : null
}

function validEntries(nodes, path) {
  var entries = []
  for (var i = 0; i < (path || []).length; i++) {
    var node = uniqueNode(nodes, path[i])
    if (node) entries.push({node:node, pathIndex:i})
  }
  return entries
}

export function currentArticleChapterEntries(nodes, path) {
  var entries = validEntries(nodes, path)
  if (!entries.length) return []
  var chapterId = String(entries[entries.length - 1].node.chapterId || "")
  var start = entries.length - 1
  while (start > 0 && String(entries[start - 1].node.chapterId || "") === chapterId) start--
  return entries.slice(start)
}

export function appendArticleChoice(nodes, path, sourcePathIndex, targetId) {
  var source = uniqueNode(nodes, path?.[sourcePathIndex])
  var target = uniqueNode(nodes, targetId)
  if (!source || !target) return {ok:false, path:(path || []).slice(), chapterChanged:false}
  var nextPath = (path || []).slice(0, sourcePathIndex + 1)
  nextPath.push(target.id)
  return {
    ok:true,
    path:nextPath,
    chapterChanged:String(source.chapterId || "") !== String(target.chapterId || ""),
  }
}

export function previousArticleChapterPath(nodes, path) {
  var entries = validEntries(nodes, path)
  if (!entries.length) return []
  var chapterId = String(entries[entries.length - 1].node.chapterId || "")
  var cut = entries.length - 1
  while (cut >= 0 && String(entries[cut].node.chapterId || "") === chapterId) cut--
  if (cut < 0) return (path || []).slice()
  return entries.slice(0, cut + 1).map(function(entry) { return entry.node.id })
}
