function structureNodes(nodes) {
  return Array.isArray(nodes) ? nodes : []
}

function isNodeRecord(node) {
  return Boolean(node) && typeof node === "object" && !Array.isArray(node)
}

function nodeId(node) {
  try {
    return String(node?.id || "")
  } catch (error) {
    return ""
  }
}

function chapterId(node) {
  try {
    return String(node?.chapterId || "")
  } catch (error) {
    return ""
  }
}

function uniqueNode(nodes, id) {
  var lookupId = String(id || "")
  if (!lookupId) return null
  var matches = structureNodes(nodes).filter(function(node) {
    return isNodeRecord(node) && nodeId(node) === lookupId
  })
  return matches.length === 1 ? matches[0] : null
}

function isUniqueStructureNode(nodes, node) {
  var id = nodeId(node)
  return Boolean(id) && uniqueNode(nodes, id) === node
}

function validEntries(nodes, path) {
  var entries = []
  for (var i = 0; i < (path || []).length; i++) {
    var node = uniqueNode(nodes, path[i])
    if (node) entries.push({node:node, pathIndex:i})
  }
  return entries
}

function pathCopy(path) {
  return Array.isArray(path) ? path.slice() : []
}

function isConditionalArticleNode(node) {
  return node?.kind === "conditional"
}

function isVisibleArticleNode(node, options) {
  if (!isConditionalArticleNode(node)) return true
  if (typeof options?.isNodeVisible !== "function") return true
  try {
    return options.isNodeVisible(node) === true
  } catch (error) {
    return false
  }
}

function isNodeInteractionComplete(node, options) {
  if (typeof options?.isNodeInteractionComplete !== "function") return true
  try {
    return options.isNodeInteractionComplete(node) === true
  } catch (error) {
    return false
  }
}

function isArticleFlowBarrier(node, options) {
  if (isConditionalArticleNode(node)) return false
  return (Array.isArray(node?.choices) && node.choices.length > 0)
    || node?.kind === "interactive-scene"
    || !isNodeInteractionComplete(node, options)
}

function incomingBranchChoiceIds(nodes) {
  var nodeById = new Map()
  var duplicateNodeIds = new Set()
  var choiceIdCounts = new Map()
  var incoming = new Map()
  var orderedNodes = structureNodes(nodes)

  orderedNodes.forEach(function(node) {
    if (!isNodeRecord(node)) return
    var id = nodeId(node)
    if (!id) return
    if (nodeById.has(id)) duplicateNodeIds.add(id)
    else nodeById.set(id, node)
    ;(Array.isArray(node.choices) ? node.choices : []).forEach(function(choice) {
      if (!isNodeRecord(choice) || choice.mode === "interaction") return
      var choiceId = String(choice.id || "")
      if (choiceId) choiceIdCounts.set(choiceId, (choiceIdCounts.get(choiceId) || 0) + 1)
    })
  })

  orderedNodes.forEach(function(source) {
    if (!isNodeRecord(source) || duplicateNodeIds.has(nodeId(source))) return
    ;(Array.isArray(source.choices) ? source.choices : []).forEach(function(choice) {
      if (!isNodeRecord(choice) || choice.mode === "interaction") return
      var choiceId = String(choice.id || "")
      var targetId = String(choice.targetId || "")
      var target = duplicateNodeIds.has(targetId) ? null : nodeById.get(targetId)
      if (!choiceId || !target || isConditionalArticleNode(target)) return
      var choiceIds = incoming.get(targetId) || []
      if (!choiceIds.includes(choiceId)) choiceIds.push(choiceId)
      incoming.set(targetId, choiceIds)
    })
  })
  return { incoming:incoming, choiceIdCounts:choiceIdCounts }
}

function isSelectedBranchTarget(node, branchChoices, options) {
  var choiceIds = branchChoices.incoming.get(nodeId(node))
  if (!choiceIds?.length || !(options?.selectedChoiceIds instanceof Set)) return true
  return choiceIds.some(function(choiceId) {
    return branchChoices.choiceIdCounts.get(choiceId) === 1
      && options.selectedChoiceIds.has(choiceId)
  })
}

function appendTransitionNodes(path, nodes) {
  var addedIds = []
  ;(nodes || []).forEach(function(node) {
    var id = nodeId(node)
    if (!id || addedIds.includes(id)) return
    addedIds.push(id)
    path.push(node.id)
  })
}

function lastValidPathNode(nodes, path) {
  var rawPath = pathCopy(path)
  for (var index = rawPath.length - 1; index >= 0; index--) {
    var node = uniqueNode(nodes, rawPath[index])
    if (node) return node
  }
  return null
}

function appendFollowingChapterNodes(nodes, path, current, options) {
  var orderedNodes = structureNodes(nodes)
  var incomingChoices = incomingBranchChoiceIds(nodes)
  var start = orderedNodes.indexOf(current)
  if (start < 0 || !isUniqueStructureNode(nodes, current)) return path
  var currentChapterId = chapterId(current)
  for (var index = start + 1; index < orderedNodes.length; index++) {
    var next = orderedNodes[index]
    if (!isNodeRecord(next)) continue
    if (chapterId(next) !== currentChapterId) break
    if (!isUniqueStructureNode(nodes, next)) break
    if (!isVisibleArticleNode(next, options)) continue
    if (!isSelectedBranchTarget(next, incomingChoices, options)) continue
    appendTransitionNodes(path, [next])
    if (isArticleFlowBarrier(next, options)) break
  }
  return path
}

function visibleConditionalPreludes(nodes, target, options) {
  var orderedNodes = structureNodes(nodes)
  var index = orderedNodes.indexOf(target)
  if (index < 0) return []

  var preludes = []
  for (var cursor = index - 1; cursor >= 0; cursor--) {
    var node = orderedNodes[cursor]
    if (!isNodeRecord(node)) continue
    if (chapterId(node) !== chapterId(target)) break
    if (!isUniqueStructureNode(nodes, node)) break
    if (!isConditionalArticleNode(node)) break
    if (isVisibleArticleNode(node, options)) preludes.unshift(node)
  }
  return preludes
}

function firstVisibleChapterNode(nodes, wantedChapterId, options) {
  var chapter = String(wantedChapterId || "")
  var orderedNodes = structureNodes(nodes)
  var incomingChoices = incomingBranchChoiceIds(nodes)
  for (var index = 0; index < orderedNodes.length; index++) {
    var node = orderedNodes[index]
    if (!isNodeRecord(node) || chapterId(node) !== chapter) continue
    if (!isUniqueStructureNode(nodes, node)) return null
    if (
      isVisibleArticleNode(node, options)
      && isSelectedBranchTarget(node, incomingChoices, options)
    ) return node
  }
  return null
}

export function expandArticleChapterPath(nodes, path, options) {
  var nextPath = pathCopy(path)
  var current = lastValidPathNode(nodes, nextPath)
  if (current && !isArticleFlowBarrier(current, options)) {
    appendFollowingChapterNodes(nodes, nextPath, current, options)
  }
  return nextPath
}

export function reconcileArticleConditionalPath(nodes, path, options) {
  var routeEntries = validEntries(nodes, path).filter(function(entry) {
    return !isConditionalArticleNode(entry.node)
  })
  if (!routeEntries.length) return pathCopy(path)

  var nextPath = []
  routeEntries.forEach(function(entry) {
    appendTransitionNodes(nextPath, visibleConditionalPreludes(nodes, entry.node, options))
    appendTransitionNodes(nextPath, [entry.node])
  })
  return expandArticleChapterPath(nodes, nextPath, options)
}

export function currentArticleChapterEntries(nodes, path) {
  var entries = validEntries(nodes, path)
  if (!entries.length) return []
  var chapterId = String(entries[entries.length - 1].node.chapterId || "")
  var start = entries.length - 1
  while (start > 0 && String(entries[start - 1].node.chapterId || "") === chapterId) {
    if (entries[start - 1].node?.kind === "interactive-scene") break
    start--
  }
  return entries.slice(start)
}

export function appendArticleChoice(nodes, path, sourcePathIndex, targetId, options) {
  var originalPath = pathCopy(path)
  var source = uniqueNode(nodes, originalPath[sourcePathIndex])
  var target = uniqueNode(nodes, targetId)
  if (!source || !target || isConditionalArticleNode(target)) {
    return {ok:false, path:originalPath, chapterChanged:false}
  }
  var nextPath = originalPath.slice(0, sourcePathIndex + 1)
  appendTransitionNodes(nextPath, visibleConditionalPreludes(nodes, target, options).concat([target]))
  return {
    ok:true,
    path:expandArticleChapterPath(nodes, nextPath, options),
    chapterChanged:String(source.chapterId || "") !== String(target.chapterId || ""),
  }
}

export function continueArticleChapterPath(nodes, path, sourcePathIndex, options) {
  var originalPath = pathCopy(path)
  var source = uniqueNode(nodes, originalPath[sourcePathIndex])
  if (!source) return {ok:false, path:originalPath, chapterChanged:false}
  var nextPath = originalPath.slice(0, sourcePathIndex + 1)
  appendFollowingChapterNodes(nodes, nextPath, source, options)
  return {
    ok:true,
    path:nextPath,
    chapterChanged:false,
  }
}

export function continueArticleInteraction(nodes, path, sourcePathIndex, options) {
  return continueArticleChapterPath(nodes, path, sourcePathIndex, options)
}

export function nextArticleChapterPath(nodes, chapters, path, options) {
  var originalPath = pathCopy(path)
  var source = lastValidPathNode(nodes, originalPath)
  if (!source) return {ok:false, path:originalPath, chapterChanged:false}

  var chapterOrder = []
  ;(chapters || []).forEach(function(chapter) {
    var chapterId = String(chapter?.id || "")
    if (chapterId && !chapterOrder.includes(chapterId)) chapterOrder.push(chapterId)
  })
  structureNodes(nodes).forEach(function(node) {
    var id = chapterId(node)
    if (isUniqueStructureNode(nodes, node) && id && !chapterOrder.includes(id)) chapterOrder.push(id)
  })

  var currentChapterIndex = chapterOrder.indexOf(String(source.chapterId || ""))
  if (currentChapterIndex < 0) {
    return {ok:false, path:originalPath, chapterChanged:false}
  }
  for (var index = currentChapterIndex + 1; index < chapterOrder.length; index++) {
    var firstNode = firstVisibleChapterNode(nodes, chapterOrder[index], options)
    if (!firstNode) continue
    var nextPath = originalPath.slice()
    appendTransitionNodes(nextPath, [firstNode])
    return {
      ok:true,
      path:expandArticleChapterPath(nodes, nextPath, options),
      chapterChanged:true,
    }
  }
  return {ok:false, path:originalPath, chapterChanged:false}
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
