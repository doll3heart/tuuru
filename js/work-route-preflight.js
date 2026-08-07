import { resolveAutomaticArticleStartNodeId } from "./article-start-node.js"

function records(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === "object" && !Array.isArray(item))
    : []
}

function text(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function idOf(value) {
  return typeof value?.id === "string" ? value.id : ""
}

function routeChoice(choice) {
  return choice?.mode !== "interaction"
}

function routeChoicesForNode(node) {
  const choices = records(node?.choices).filter(routeChoice)
  for (const group of records(node?.interactionGroups)) {
    if (group?.kind !== "random-game") continue
    choices.push(...records(group?.choices))
  }
  return choices
}

function emptyReport(supported) {
  return {
    supported,
    summary:{ totalNodes:0, reachableNodes:0, totalChoices:0, reachableChoices:0 },
    issues:[],
  }
}

function uniqueRecordsById(values) {
  const counts = new Map()
  for (const value of values) {
    const id = idOf(value)
    if (id) counts.set(id, (counts.get(id) || 0) + 1)
  }
  return new Map(
    values
      .filter(value => idOf(value) && counts.get(idOf(value)) === 1)
      .map(value => [idOf(value), value]),
  )
}

function chapterOrder(work, nodes) {
  const order = []
  for (const chapter of records(work?.chapters)) {
    const id = idOf(chapter)
    if (id && !order.includes(id)) order.push(id)
  }
  for (const node of nodes) {
    const id = typeof node?.chapterId === "string" ? node.chapterId : ""
    if (id && !order.includes(id)) order.push(id)
  }
  return order
}

function nodeLocation(node, chapterNames) {
  const chapterId = typeof node?.chapterId === "string" ? node.chapterId : ""
  const chapter = chapterNames.get(chapterId)
  const title = text(node?.title) || idOf(node) || "未命名节点"
  return chapter ? `互动文章 · ${chapter} · ${title}` : `互动文章 · ${title}`
}

function addIssue(issues, code, title, node, chapterNames, action) {
  issues.push({
    code,
    level:"warning",
    title,
    location:nodeLocation(node, chapterNames),
    action,
    nodeId:idOf(node),
  })
}

function collectChoiceSources(nodes, reachable) {
  const candidates = []
  for (const node of nodes) {
    const nodeId = idOf(node)
    if (!reachable.has(nodeId)) continue
    for (const choice of records(node?.choices)) {
      const choiceId = idOf(choice)
      if (choiceId) candidates.push({ id:choiceId, source:`node:${nodeId}` })
    }
    for (const group of records(node?.interactionGroups)) {
      const groupId = idOf(group)
      for (const choice of records(group?.choices)) {
        const choiceId = idOf(choice)
        if (choiceId) candidates.push({ id:choiceId, source:`group:${groupId}` })
      }
    }
  }
  const counts = new Map()
  for (const candidate of candidates) {
    counts.set(candidate.id, (counts.get(candidate.id) || 0) + 1)
  }
  return new Map(
    candidates
      .filter(candidate => counts.get(candidate.id) === 1)
      .map(candidate => [candidate.id, candidate.source]),
  )
}

function conditionCanBeSatisfied(condition, choiceSources) {
  const groups = records(condition?.all).map(group => (
    Array.isArray(group?.anyChoiceIds)
      ? [...new Set(group.anyChoiceIds)]
        .map(id => ({ id, source:choiceSources.get(id) }))
        .filter(candidate => typeof candidate.id === "string" && candidate.source)
      : []
  ))
  if (!groups.length || groups.some(group => group.length === 0)) return false

  let inspectedStates = 0
  const assignments = new Map()
  function visit(groupIndex) {
    inspectedStates += 1
    if (inspectedStates > 10_000) return true
    if (groupIndex >= groups.length) return true
    for (const candidate of groups[groupIndex]) {
      const selected = assignments.get(candidate.source)
      if (selected && selected !== candidate.id) continue
      if (!selected) assignments.set(candidate.source, candidate.id)
      if (visit(groupIndex + 1)) return true
      if (!selected) assignments.delete(candidate.source)
    }
    return false
  }
  return visit(0)
}

function cyclicComponents(edges, reachable) {
  let index = 0
  const indices = new Map()
  const lowLinks = new Map()
  const stack = []
  const stacked = new Set()
  const cycles = []

  function visit(id) {
    indices.set(id, index)
    lowLinks.set(id, index)
    index += 1
    stack.push(id)
    stacked.add(id)

    for (const targetId of edges.get(id) || []) {
      if (!reachable.has(targetId)) continue
      if (!indices.has(targetId)) {
        visit(targetId)
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(targetId)))
      } else if (stacked.has(targetId)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indices.get(targetId)))
      }
    }

    if (lowLinks.get(id) !== indices.get(id)) return
    const component = []
    let member
    do {
      member = stack.pop()
      stacked.delete(member)
      component.push(member)
    } while (member !== id)
    if (
      component.length > 1
      || (edges.get(component[0]) || new Set()).has(component[0])
    ) cycles.push(component)
  }

  for (const id of reachable) {
    if (!indices.has(id)) visit(id)
  }
  return cycles
}

export function inspectArticleRoutes(work) {
  if (work?.type !== "article") return emptyReport(false)

  const authoredNodes = records(work?.nodes)
  const uniqueNodes = uniqueRecordsById(authoredNodes)
  const routeNodes = authoredNodes.filter(node => (
    node?.kind !== "conditional" && uniqueNodes.get(idOf(node)) === node
  ))
  if (!routeNodes.length) return emptyReport(true)

  const routeNodeById = new Map(routeNodes.map(node => [idOf(node), node]))
  const routeNodeIndex = new Map(routeNodes.map((node, index) => [idOf(node), index]))
  const routeChoices = routeNodes.flatMap(node => (
    routeChoicesForNode(node).map(choice => ({ source:idOf(node), choice }))
  ))
  const incomingBranchTargets = new Set(
    routeChoices
      .map(({ choice }) => typeof choice?.targetId === "string" ? choice.targetId : "")
      .filter(id => routeNodeById.has(id)),
  )
  const orderedChapters = chapterOrder(work, routeNodes)
  const chapterIndex = new Map(orderedChapters.map((id, index) => [id, index]))
  const scenesById = uniqueRecordsById(records(work?.interactiveScenes))
  const scenesByNodeId = new Map(
    records(work?.interactiveScenes)
      .filter(scene => typeof scene?.nodeId === "string")
      .map(scene => [scene.nodeId, scene]),
  )
  const edges = new Map(routeNodes.map(node => [idOf(node), new Set()]))

  function nextAutomaticNode(node) {
    const sourceIndex = routeNodeIndex.get(idOf(node))
    const sourceChapterId = typeof node?.chapterId === "string" ? node.chapterId : ""
    for (let index = sourceIndex + 1; index < routeNodes.length; index += 1) {
      const candidate = routeNodes[index]
      const candidateChapterId = typeof candidate?.chapterId === "string" ? candidate.chapterId : ""
      if (candidateChapterId !== sourceChapterId) break
      if (!incomingBranchTargets.has(idOf(candidate))) return candidate
    }
    const sourceChapterIndex = chapterIndex.get(sourceChapterId)
    if (sourceChapterIndex == null) return null
    for (let wanted = sourceChapterIndex + 1; wanted < orderedChapters.length; wanted += 1) {
      const candidate = routeNodes.find(item => (
        item.chapterId === orderedChapters[wanted]
        && !incomingBranchTargets.has(idOf(item))
      ))
      if (candidate) return candidate
    }
    return null
  }

  for (const node of routeNodes) {
    const sourceId = idOf(node)
    const nodeEdges = edges.get(sourceId)
    if (node?.kind === "interactive-scene") {
      const scene = scenesById.get(String(node?.interactiveSceneId || ""))
        || scenesByNodeId.get(sourceId)
      const targetId = typeof scene?.nextNodeId === "string" ? scene.nextNodeId : ""
      if (routeNodeById.has(targetId)) nodeEdges.add(targetId)
      continue
    }

    const choices = routeChoicesForNode(node)
    if (choices.length) {
      for (const choice of choices) {
        const targetId = typeof choice?.targetId === "string" ? choice.targetId : ""
        if (routeNodeById.has(targetId)) nodeEdges.add(targetId)
      }
      continue
    }

    const next = nextAutomaticNode(node)
    if (next) nodeEdges.add(idOf(next))
  }

  const startId = resolveAutomaticArticleStartNodeId(work)
  const reachable = new Set()
  const pending = routeNodeById.has(startId) ? [startId] : []
  while (pending.length) {
    const id = pending.shift()
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const targetId of edges.get(id) || []) {
      if (!reachable.has(targetId)) pending.push(targetId)
    }
  }

  const chapterNames = new Map(
    records(work?.chapters).map(chapter => [idOf(chapter), text(chapter?.name)]),
  )
  const issues = []
  for (const node of routeNodes) {
    if (reachable.has(idOf(node))) continue
    addIssue(
      issues,
      "route-node-unreachable",
      "节点无法从作品起点到达",
      node,
      chapterNames,
      "检查前置选项或章节顺序；不需要的草稿节点可以删除。",
    )
  }

  const finalRouteNodeId = idOf(
    [...routeNodes].reverse().find(node => reachable.has(idOf(node))),
  )
  for (const node of routeNodes) {
    const nodeId = idOf(node)
    if (
      reachable.has(nodeId)
      && nodeId !== finalRouteNodeId
      && (edges.get(nodeId)?.size || 0) === 0
    ) {
      addIssue(
        issues,
        "route-node-early-end",
        "路线可能在这里提前结束",
        node,
        chapterNames,
        "确认这里是否为有意设计的结局；否则补充后续节点或有效跳转。",
      )
    }
  }

  for (const component of cyclicComponents(edges, reachable)) {
    const node = routeNodeById.get(component[0])
    addIssue(
      issues,
      "route-cycle",
      component.length > 1 ? `路线可能在 ${component.length} 个节点间循环` : "路线可能反复回到同一节点",
      node,
      chapterNames,
      "确认循环中存在读者可以选择的出口；若为有意循环，可以保留。",
    )
  }

  const choiceSources = collectChoiceSources(authoredNodes, reachable)
  for (const node of authoredNodes) {
    if (node?.kind !== "conditional" || !idOf(node)) continue
    if (conditionCanBeSatisfied(node.displayCondition, choiceSources)) continue
    addIssue(
      issues,
      "conditional-condition-impossible",
      "隐藏节点的条件无法同时满足",
      node,
      chapterNames,
      "重新选择条件中的选项，避免要求读者在同一次选择中同时选中互斥项。",
    )
  }

  return {
    supported:true,
    summary:{
      totalNodes:routeNodes.length,
      reachableNodes:reachable.size,
      totalChoices:routeChoices.length,
      reachableChoices:routeChoices.filter(({ source }) => reachable.has(source)).length,
    },
    issues,
  }
}
