function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function invalid(reason, details = {}) {
  return new ArticleSaveAdapterError(reason, details)
}

function cloneJson(value, reason = "invalid-payload", active = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value === null || typeof value !== "object") throw invalid(reason)
  if (active.has(value)) throw invalid(reason)

  const isArray = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw invalid(reason)
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Object.hasOwn(descriptors, "toJSON")) throw invalid(reason)
  const keys = Reflect.ownKeys(descriptors)
  if (keys.some(key => typeof key !== "string")) throw invalid(reason)
  active.add(value)
  try {
    if (isArray) {
      if (keys.some(key => key !== "length" && !/^(0|[1-9]\d*)$/.test(key))) {
        throw invalid(reason)
      }
      const result = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)]
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw invalid(reason)
        }
        result.push(cloneJson(descriptor.value, reason, active))
      }
      return result
    }

    const result = {}
    for (const key of keys) {
      const descriptor = descriptors[key]
      if (!("value" in descriptor) || !descriptor.enumerable) throw invalid(reason)
      Object.defineProperty(result, key, {
        value: cloneJson(descriptor.value, reason, active),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  } finally {
    active.delete(value)
  }
}

function candidateWork(work) {
  if (!isRecord(work)) throw invalid("invalid-work", { entity: "work" })
  return work
}

function candidateCollection(work, field, entity) {
  candidateWork(work)
  const value = work[field]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(record => !isRecord(record))) {
    throw invalid(`invalid-${entity}-collection`, { entity })
  }
  return value
}

function uniqueRecord(records, id, entity) {
  const matches = records.filter(record => record.id === id)
  if (matches.length === 0) throw invalid(`${entity}-not-found`, { entity, id })
  if (matches.length > 1) throw invalid(`${entity}-ambiguous`, { entity, id })
  return matches[0]
}

function applyWorkFields(work, payload) {
  candidateWork(work)
  return { ...work, ...payload.fields }
}

function applyNodeFields(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const target = uniqueRecord(nodes, payload.nodeId, "node")
  return {
    ...work,
    nodes: nodes.map(node => node === target ? { ...node, ...payload.fields } : node),
  }
}

function applyNodeContent(work, payload) {
  return applyNodeFields(work, { nodeId: payload.nodeId, fields: { content: payload.content } })
}

function applyChapterFields(work, payload) {
  const chapters = candidateCollection(work, "chapters", "chapter")
  const target = uniqueRecord(chapters, payload.chapterId, "chapter")
  return {
    ...work,
    chapters: chapters.map(chapter => chapter === target
      ? { ...chapter, ...payload.fields }
      : chapter),
  }
}

function applyPlaceholderFields(work, payload) {
  const placeholders = candidateCollection(work, "placeholders", "placeholder")
  const target = uniqueRecord(placeholders, payload.placeholderId, "placeholder")
  return {
    ...work,
    placeholders: placeholders.map(placeholder => placeholder === target
      ? { ...placeholder, ...payload.fields }
      : placeholder),
  }
}

function repairedStartNode(work, nodes) {
  return nodes.some(node => node.id === work.startNode) ? work.startNode : nodes[0]?.id ?? ""
}

function applyAddNode(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  if (nodes.some(node => node.id === payload.nodeId)) {
    throw invalid("node-id-collision", { entity: "node", id: payload.nodeId })
  }
  const chapters = candidateCollection(work, "chapters", "chapter")
  const node = {
    id: payload.nodeId,
    title: "新节点",
    content: "",
    choices: [],
    scene: "",
    chapterId: chapters[0]?.id ?? "",
  }
  let nextNodes
  if (Object.hasOwn(payload, "afterId")) {
    const after = uniqueRecord(nodes, payload.afterId, "node")
    const index = nodes.indexOf(after)
    nextNodes = [...nodes.slice(0, index + 1), node, ...nodes.slice(index + 1)]
  } else {
    nextNodes = [...nodes, node]
  }
  return { ...work, nodes: nextNodes, startNode: repairedStartNode(work, nextNodes) }
}

function applyDeleteNode(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const target = uniqueRecord(nodes, payload.nodeId, "node")
  const nextNodes = nodes
    .filter(node => node !== target)
    .map(node => ({
      ...node,
      choices: choiceCollection(node).filter(choice => choice.targetId !== payload.nodeId),
    }))
  return { ...work, nodes: nextNodes, startNode: repairedStartNode(work, nextNodes) }
}

function choiceCollection(node) {
  if (node.choices === undefined) return []
  if (!Array.isArray(node.choices) || node.choices.some(choice => !isRecord(choice))) {
    throw invalid("invalid-choice-collection", { entity: "choice", id: node.id })
  }
  return node.choices
}

function validateChoiceTarget(nodes, targetId) {
  if (targetId === undefined || targetId === "") return
  if (typeof targetId !== "string") {
    throw invalid("invalid-choice-target", { entity: "node", id: targetId })
  }
  uniqueRecord(nodes, targetId, "node")
}

function applyReplaceChoices(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const node = uniqueRecord(nodes, payload.nodeId, "node")
  const existing = choiceCollection(node)
  const generated = new Set(payload.generatedChoiceIds)
  const replacement = payload.choices.map(choice => {
    validateChoiceTarget(nodes, choice.targetId)
    const localMatches = existing.filter(candidate => candidate.id === choice.id)
    const foreignMatches = nodes
      .filter(candidate => candidate !== node)
      .flatMap(choiceCollection)
      .filter(candidate => candidate.id === choice.id)
    if (foreignMatches.length > 0 || (generated.has(choice.id) && localMatches.length > 0)) {
      throw invalid("choice-id-collision", { entity: "choice", id: choice.id })
    }
    if (localMatches.length > 1) {
      throw invalid("choice-ambiguous", { entity: "choice", id: choice.id })
    }
    return localMatches.length === 1 ? { ...localMatches[0], ...choice } : { ...choice }
  })
  return {
    ...work,
    nodes: nodes.map(candidate => candidate === node
      ? { ...candidate, choices: replacement }
      : candidate),
  }
}

function applyReorderNodes(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const byId = new Map()
  for (const node of nodes) {
    if (byId.has(node.id)) {
      throw invalid("node-ambiguous", { entity: "node", id: node.id })
    }
    byId.set(node.id, node)
  }
  if (payload.order.length !== nodes.length) {
    throw invalid("invalid-node-order", { entity: "node", issue: "missing" })
  }
  const reordered = payload.order.map(position => {
    const node = byId.get(position.id)
    if (node === undefined) {
      throw invalid("invalid-node-order", {
        entity: "node",
        id: position.id,
        issue: "foreign",
      })
    }
    return { ...node, chapterId: position.chapterId }
  })
  return { ...work, nodes: reordered }
}

function applyAddPlaceholders(work, payload) {
  const placeholders = candidateCollection(work, "placeholders", "placeholder")
  for (const placeholder of payload.placeholders) {
    if (placeholders.some(candidate => candidate.id === placeholder.id)) {
      throw invalid("placeholder-id-collision", {
        entity: "placeholder",
        id: placeholder.id,
      })
    }
  }
  return { ...work, placeholders: [...placeholders, ...payload.placeholders] }
}

function applyAddChapter(work, payload) {
  const chapters = candidateCollection(work, "chapters", "chapter")
  if (chapters.some(chapter => chapter.id === payload.chapterId)) {
    throw invalid("chapter-id-collision", {
      entity: "chapter",
      id: payload.chapterId,
    })
  }
  return {
    ...work,
    chapters: [...chapters, { id: payload.chapterId, name: payload.name }],
  }
}

function applyDeleteChapter(work, payload) {
  const chapters = candidateCollection(work, "chapters", "chapter")
  const target = uniqueRecord(chapters, payload.chapterId, "chapter")
  const nextChapters = chapters.filter(chapter => chapter !== target)
  const nodes = candidateCollection(work, "nodes", "node")
  const fallbackId = nextChapters[0]?.id ?? ""
  return {
    ...work,
    chapters: nextChapters,
    nodes: nodes.map(node => node.chapterId === payload.chapterId
      ? { ...node, chapterId: fallbackId }
      : node),
  }
}

function applyAddScene(work, payload) {
  const scenes = candidateCollection(work, "scenes", "scene")
  if (scenes.some(scene => scene.id === payload.sceneId)) {
    throw invalid("scene-id-collision", { entity: "scene", id: payload.sceneId })
  }
  return { ...work, scenes: [...scenes, { id: payload.sceneId, name: payload.name }] }
}

function applyDeleteScene(work, payload) {
  const scenes = candidateCollection(work, "scenes", "scene")
  const target = uniqueRecord(scenes, payload.sceneId, "scene")
  const nodes = candidateCollection(work, "nodes", "node")
  return {
    ...work,
    scenes: scenes.filter(scene => scene !== target),
    nodes: nodes.map(node => node.scene === payload.sceneId
      ? { ...node, scene: "" }
      : node),
  }
}

function applyDeletePlaceholder(work, payload) {
  const placeholders = candidateCollection(work, "placeholders", "placeholder")
  const target = uniqueRecord(placeholders, payload.placeholderId, "placeholder")
  return { ...work, placeholders: placeholders.filter(placeholder => placeholder !== target) }
}

function isTagNameCharacter(character) {
  return character !== undefined && /[A-Za-z0-9:_-]/.test(character)
}

function finishNonElementTag(content, start) {
  if (content.startsWith("<!--", start)) {
    const commentEnd = content.indexOf("-->", start + 4)
    return commentEnd < 0 ? null : { end: commentEnd + 3, other: true }
  }
  const end = content.indexOf(">", start + 2)
  return end < 0 ? null : { end: end + 1, other: true }
}

function readHtmlTag(content, start) {
  if (content[start] !== "<") return null
  let index = start + 1
  if (content[index] === "!" || content[index] === "?") {
    return finishNonElementTag(content, start)
  }
  const closing = content[index] === "/"
  if (closing) index += 1
  while (/\s/.test(content[index] ?? "")) index += 1
  const nameStart = index
  if (!/[A-Za-z]/.test(content[index] ?? "")) return null
  while (isTagNameCharacter(content[index])) index += 1
  const name = content.slice(nameStart, index)
  const nameEnd = index - start
  let quote = null
  while (index < content.length) {
    const character = content[index]
    if (quote !== null) {
      if (character === quote) quote = null
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === ">") {
      let beforeClose = index - 1
      while (/\s/.test(content[beforeClose] ?? "")) beforeClose -= 1
      const tag = content.slice(start, index + 1)
      return {
        start,
        end: index + 1,
        tag,
        name,
        nameEnd,
        closing,
        selfClosing: !closing && content[beforeClose] === "/",
      }
    }
    index += 1
  }
  return null
}

function scanHtmlTags(content, start = 0) {
  const tags = []
  let cursor = start
  while (cursor < content.length) {
    const next = content.indexOf("<", cursor)
    if (next < 0) break
    const tag = readHtmlTag(content, next)
    if (tag === null) {
      cursor = next + 1
      continue
    }
    cursor = tag.end
    if (!tag.other) tags.push(tag)
  }
  return tags
}

function parseAttributes(reference) {
  if (reference.closing) return []
  const attributes = []
  const tag = reference.tag
  let index = reference.nameEnd
  const contentEnd = tag.length - 1
  while (index < contentEnd) {
    while (/\s/.test(tag[index] ?? "")) index += 1
    if (tag[index] === "/" || tag[index] === ">" || index >= contentEnd) break
    const start = index
    while (index < contentEnd && !/[\s=/>]/.test(tag[index])) index += 1
    if (index === start) {
      index += 1
      continue
    }
    const name = tag.slice(start, index).toLowerCase()
    while (/\s/.test(tag[index] ?? "")) index += 1
    let value = ""
    if (tag[index] === "=") {
      index += 1
      while (/\s/.test(tag[index] ?? "")) index += 1
      const quote = tag[index] === '"' || tag[index] === "'" ? tag[index] : null
      if (quote !== null) {
        index += 1
        const valueStart = index
        while (index < contentEnd && tag[index] !== quote) index += 1
        value = tag.slice(valueStart, index)
        if (tag[index] === quote) index += 1
      } else {
        const valueStart = index
        while (index < contentEnd && !/[\s>]/.test(tag[index])) index += 1
        value = tag.slice(valueStart, index)
      }
    }
    attributes.push({ name, value, start, end: index })
  }
  return attributes
}

function attribute(attributes, name) {
  return attributes.find(candidate => candidate.name === name) ?? null
}

function cardReferences(content, moduleId) {
  const references = []
  for (const reference of scanHtmlTags(content)) {
    if (reference.closing) continue
    const attributes = parseAttributes(reference)
    const classes = attribute(attributes, "class")?.value ?? null
    const cardId = attribute(attributes, "data-pm-id")?.value ?? null
    if (classes?.split(/\s+/).includes("pm-inline-card") && cardId === moduleId) {
      references.push({ ...reference, attributes })
    }
  }
  return references
}

function escapedAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
}

function normalizeCardType(content, reference, type) {
  const replacement = `data-pm-type="${escapedAttribute(type)}"`
  const existing = attribute(reference.attributes, "data-pm-type")
  let tag
  if (existing !== null) {
    tag = `${reference.tag.slice(0, existing.start)}${replacement}${reference.tag.slice(existing.end)}`
  } else {
    let insertion = reference.tag.length - 1
    let beforeClose = insertion - 1
    while (/\s/.test(reference.tag[beforeClose] ?? "")) beforeClose -= 1
    if (reference.tag[beforeClose] === "/") insertion = beforeClose
    const spacing = /\s$/.test(reference.tag.slice(0, insertion)) ? "" : " "
    tag = `${reference.tag.slice(0, insertion)}${spacing}${replacement}${reference.tag.slice(insertion)}`
  }
  return `${content.slice(0, reference.start)}${tag}${content.slice(reference.end)}`
}

const VOID_HTML_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
])

function cardElementRange(content, reference, moduleId) {
  if (reference.selfClosing || VOID_HTML_ELEMENTS.has(reference.name.toLowerCase())) {
    return { start: reference.start, end: reference.end }
  }
  let depth = 1
  for (const tag of scanHtmlTags(content, reference.end)) {
    if (tag.name.toLowerCase() !== reference.name.toLowerCase()) continue
    if (tag.closing) depth -= 1
    else if (!tag.selfClosing && !VOID_HTML_ELEMENTS.has(tag.name.toLowerCase())) depth += 1
    if (depth === 0) return { start: reference.start, end: tag.end }
  }
  throw invalid("invalid-phone-card-reference", {
    entity: "phone-card-reference",
    id: moduleId,
  })
}

function removeCardReferences(content, references, moduleId) {
  const ranges = references
    .map(reference => cardElementRange(content, reference, moduleId))
    .sort((left, right) => left.start - right.start || right.end - left.end)
  const merged = []
  for (const range of ranges) {
    const previous = merged.at(-1)
    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  let result = content
  for (const range of merged.reverse()) {
    result = `${result.slice(0, range.start)}${result.slice(range.end)}`
  }
  return result
}

function moduleCollection(work) {
  return candidateCollection(work, "phoneModules", "phone-module")
}

function applySavePhoneModuleCard(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const node = uniqueRecord(nodes, payload.nodeId, "node")
  if (typeof node.content !== "string") {
    throw invalid("invalid-node-content", { entity: "node", id: payload.nodeId })
  }
  const references = cardReferences(node.content, payload.moduleId)
  if (references.length === 0) {
    throw invalid("phone-card-reference-not-found", {
      entity: "phone-card-reference",
      id: payload.moduleId,
    })
  }
  if (references.length > 1) {
    throw invalid("phone-card-reference-ambiguous", {
      entity: "phone-card-reference",
      id: payload.moduleId,
    })
  }

  const modules = moduleCollection(work)
  const matches = modules.filter(module => module.id === payload.moduleId)
  if (matches.length > 1) {
    throw invalid("phone-module-ambiguous", {
      entity: "phone-module",
      id: payload.moduleId,
    })
  }
  if (payload.generatedModuleId && matches.length > 0) {
    throw invalid("phone-module-id-collision", {
      entity: "phone-module",
      id: payload.moduleId,
    })
  }
  const existing = matches[0]
  if (existing !== undefined && existing.nodeId !== payload.nodeId) {
    throw invalid("phone-module-node-mismatch", {
      entity: "phone-module",
      id: payload.moduleId,
    })
  }
  const module = {
    ...(existing ?? {}),
    id: payload.moduleId,
    type: payload.type,
    nodeId: payload.nodeId,
    data: payload.data,
  }
  return {
    ...work,
    nodes: nodes.map(candidate => candidate === node
      ? { ...candidate, content: normalizeCardType(node.content, references[0], payload.type) }
      : candidate),
    phoneModules: existing === undefined
      ? [...modules, module]
      : modules.map(candidate => candidate === existing ? module : candidate),
  }
}

function applyDeletePhoneModuleCard(work, payload) {
  const nodes = candidateCollection(work, "nodes", "node")
  const node = uniqueRecord(nodes, payload.nodeId, "node")
  if (typeof node.content !== "string") {
    throw invalid("invalid-node-content", { entity: "node", id: payload.nodeId })
  }
  const modules = moduleCollection(work)
  const module = uniqueRecord(modules, payload.moduleId, "phone-module")
  if (module.nodeId !== payload.nodeId) {
    throw invalid("phone-module-node-mismatch", {
      entity: "phone-module",
      id: payload.moduleId,
    })
  }
  const references = cardReferences(node.content, payload.moduleId)
  const content = removeCardReferences(node.content, references, payload.moduleId)
  return {
    ...work,
    nodes: nodes.map(candidate => candidate === node ? { ...candidate, content } : candidate),
    phoneModules: modules.filter(candidate => candidate !== module),
  }
}

const FORBIDDEN_PATCH_FIELDS = Object.freeze({
  work: new Set([
    "id", "type", "schemaVersion", "createdAt", "updatedAt",
    "nodes", "chapters", "scenes", "placeholders", "phoneModules",
  ]),
  node: new Set(["id", "choices"]),
  chapter: new Set(["id"]),
  placeholder: new Set(["id"]),
})

function preparePatch(fields, entity) {
  const reason = `invalid-${entity}-fields`
  const prepared = cloneJson(fields, reason)
  if (!isRecord(prepared)) throw invalid(reason)
  const names = Object.keys(prepared)
  if (names.length === 0) throw invalid(reason)
  const forbidden = FORBIDDEN_PATCH_FIELDS[entity]
  const forbiddenField = names.find(field => forbidden.has(field))
  if (forbiddenField !== undefined) throw invalid(reason, { field: forbiddenField })
  return prepared
}

function preparedIdentifier(value, entity, createId) {
  if (value === undefined || value === null || value === "") {
    const allocated = createId(entity)
    if (typeof allocated !== "string" || allocated.length === 0) {
      throw invalid(`invalid-${entity}-id`, { entity, id: allocated })
    }
    return allocated
  }
  if (typeof value !== "string") throw invalid(`invalid-${entity}-id`, { entity, id: value })
  return value
}

function explicitIdentifier(value, entity) {
  if (typeof value !== "string" || value.length === 0) {
    throw invalid(`invalid-${entity}-id`, { entity, id: value })
  }
  return value
}

function encoded(value) {
  return encodeURIComponent(value)
}

function fieldKey(prefix, fields) {
  return `${prefix}:fields:${Object.keys(fields).map(encoded).sort().join(",")}`
}

function correctionEnvelope(envelope, options) {
  if ((typeof options !== "object" && typeof options !== "function") || options === null) {
    return envelope
  }
  const descriptor = Object.getOwnPropertyDescriptor(options, "correctsOperationId")
  if (descriptor !== undefined
    && "value" in descriptor
    && typeof descriptor.value === "string"
    && descriptor.value.length > 0) {
    return { ...envelope, correctsOperationId: descriptor.value }
  }
  return envelope
}

export class ArticleSaveAdapterError extends Error {
  constructor(reason = "invalid-article-mutation", details = {}) {
    super(`The article mutation is invalid: ${reason}`)
    this.name = "ArticleSaveAdapterError"
    this.code = "article-save-invalid"
    this.details = Object.freeze({ reason, ...details })
  }
}

export function createArticleSaveAdapter({ runtime, createId }) {
  function stage(key, payload, apply, options) {
    return runtime.stage(correctionEnvelope({ key, payload, apply }, options))
  }

  function commit(key, payload, apply, options, consumes) {
    let envelope = { key, payload, apply }
    if (consumes !== undefined) envelope = { ...envelope, consumes }
    return runtime.commitNow(correctionEnvelope(envelope, options))
  }

  return Object.freeze({
    stageNodeContent(nodeId, content, options) {
      const preparedNodeId = explicitIdentifier(nodeId, "node")
      const preparedContent = cloneJson(content, "invalid-node-content")
      if (typeof preparedContent !== "string") throw invalid("invalid-node-content")
      return stage(
        `node:${encoded(preparedNodeId)}:content`,
        { nodeId: preparedNodeId, content: preparedContent },
        applyNodeContent,
        options,
      )
    },
    updateWorkFields(fields, options) {
      const preparedFields = preparePatch(fields, "work")
      return stage(
        fieldKey("work", preparedFields),
        { fields: preparedFields },
        applyWorkFields,
        options,
      )
    },
    addNode(input, options) {
      if (!isRecord(input)) throw invalid("invalid-node", { entity: "node" })
      const nodeId = preparedIdentifier(input.nodeId, "node", createId)
      const payload = { nodeId }
      if (input.afterId !== undefined && input.afterId !== null && input.afterId !== "") {
        payload.afterId = explicitIdentifier(input.afterId, "node")
      }
      return commit(`node:${encoded(nodeId)}:add`, payload, applyAddNode, options)
    },
    updateNode(nodeId, fields, options) {
      const preparedNodeId = explicitIdentifier(nodeId, "node")
      const preparedFields = preparePatch(fields, "node")
      return stage(
        fieldKey(`node:${encoded(preparedNodeId)}`, preparedFields),
        { nodeId: preparedNodeId, fields: preparedFields },
        applyNodeFields,
        options,
      )
    },
    deleteNode(nodeId, options) {
      const preparedNodeId = explicitIdentifier(nodeId, "node")
      return commit(
        `node:${encoded(preparedNodeId)}:delete`,
        { nodeId: preparedNodeId },
        applyDeleteNode,
        options,
      )
    },
    replaceChoices(nodeId, choices, options) {
      const preparedNodeId = explicitIdentifier(nodeId, "node")
      const preparedChoices = cloneJson(choices, "invalid-choices")
      if (!Array.isArray(preparedChoices)
        || preparedChoices.some(choice => !isRecord(choice))) {
        throw invalid("invalid-choices", { entity: "choice" })
      }
      const generatedChoiceIds = []
      for (const choice of preparedChoices) {
        const generated = choice.id === undefined || choice.id === null || choice.id === ""
        choice.id = preparedIdentifier(choice.id, "choice", createId)
        if (generated) generatedChoiceIds.push(choice.id)
      }
      const seen = new Set()
      for (const choice of preparedChoices) {
        if (seen.has(choice.id)) {
          throw invalid("choice-id-collision", { entity: "choice", id: choice.id })
        }
        seen.add(choice.id)
      }
      return commit(
        `node:${encoded(preparedNodeId)}:choices`,
        { nodeId: preparedNodeId, choices: preparedChoices, generatedChoiceIds },
        applyReplaceChoices,
        options,
      )
    },
    reorderNodes(order, options) {
      const preparedOrder = cloneJson(order, "invalid-node-order")
      if (!Array.isArray(preparedOrder)
        || preparedOrder.some(position => !isRecord(position))) {
        throw invalid("invalid-node-order", { entity: "node" })
      }
      const seen = new Set()
      for (const position of preparedOrder) {
        position.id = explicitIdentifier(position.id, "node")
        if (typeof position.chapterId !== "string") {
          throw invalid("invalid-node-order", {
            entity: "node",
            id: position.id,
            issue: "chapter",
          })
        }
        if (seen.has(position.id)) {
          throw invalid("invalid-node-order", {
            entity: "node",
            id: position.id,
            issue: "duplicate",
          })
        }
        seen.add(position.id)
      }
      return commit("nodes:reorder", { order: preparedOrder }, applyReorderNodes, options)
    },
    addChapter(input, options) {
      if (!isRecord(input)) throw invalid("invalid-chapter", { entity: "chapter" })
      const chapterId = preparedIdentifier(input.chapterId, "chapter", createId)
      const name = cloneJson(input.name, "invalid-chapter")
      return commit(
        `chapter:${encoded(chapterId)}:add`,
        { chapterId, name },
        applyAddChapter,
        options,
      )
    },
    updateChapter(chapterId, fields, options) {
      const preparedChapterId = explicitIdentifier(chapterId, "chapter")
      const preparedFields = preparePatch(fields, "chapter")
      return stage(
        fieldKey(`chapter:${encoded(preparedChapterId)}`, preparedFields),
        { chapterId: preparedChapterId, fields: preparedFields },
        applyChapterFields,
        options,
      )
    },
    deleteChapter(chapterId, options) {
      const preparedChapterId = explicitIdentifier(chapterId, "chapter")
      return commit(
        `chapter:${encoded(preparedChapterId)}:delete`,
        { chapterId: preparedChapterId },
        applyDeleteChapter,
        options,
      )
    },
    addScene(input, options) {
      if (!isRecord(input)) throw invalid("invalid-scene", { entity: "scene" })
      const sceneId = preparedIdentifier(input.sceneId, "scene", createId)
      const name = cloneJson(input.name, "invalid-scene")
      return commit(`scene:${encoded(sceneId)}:add`, { sceneId, name }, applyAddScene, options)
    },
    deleteScene(sceneId, options) {
      const preparedSceneId = explicitIdentifier(sceneId, "scene")
      return commit(
        `scene:${encoded(preparedSceneId)}:delete`,
        { sceneId: preparedSceneId },
        applyDeleteScene,
        options,
      )
    },
    addPlaceholders(placeholders, options) {
      const prepared = cloneJson(placeholders, "invalid-placeholders")
      if (!Array.isArray(prepared) || prepared.length === 0
        || prepared.some(placeholder => !isRecord(placeholder))) {
        throw invalid("invalid-placeholders", { entity: "placeholder" })
      }
      for (const placeholder of prepared) {
        placeholder.id = preparedIdentifier(placeholder.id, "placeholder", createId)
      }
      const seen = new Set()
      for (const placeholder of prepared) {
        if (seen.has(placeholder.id)) {
          throw invalid("placeholder-id-collision", {
            entity: "placeholder",
            id: placeholder.id,
          })
        }
        seen.add(placeholder.id)
      }
      const ids = prepared.map(placeholder => encoded(placeholder.id)).join(",")
      return commit(
        `placeholder:${ids}:add`,
        { placeholders: prepared },
        applyAddPlaceholders,
        options,
      )
    },
    updatePlaceholder(placeholderId, fields, options) {
      const preparedPlaceholderId = explicitIdentifier(placeholderId, "placeholder")
      const preparedFields = preparePatch(fields, "placeholder")
      return stage(
        fieldKey(`placeholder:${encoded(preparedPlaceholderId)}`, preparedFields),
        { placeholderId: preparedPlaceholderId, fields: preparedFields },
        applyPlaceholderFields,
        options,
      )
    },
    deletePlaceholder(placeholderId, options) {
      const preparedPlaceholderId = explicitIdentifier(placeholderId, "placeholder")
      return commit(
        `placeholder:${encoded(preparedPlaceholderId)}:delete`,
        { placeholderId: preparedPlaceholderId }, applyDeletePlaceholder,
        options,
      )
    },
    savePhoneModuleCard(input, options) {
      if (!isRecord(input)) throw invalid("invalid-phone-module", { entity: "phone-module" })
      const generatedModuleId = input.moduleId === undefined
        || input.moduleId === null
        || input.moduleId === ""
      const moduleId = preparedIdentifier(input.moduleId, "phone-module", createId)
      const nodeId = explicitIdentifier(input.nodeId, "node")
      const type = explicitIdentifier(input.type, "phone-module-type")
      const data = cloneJson(input.data, "invalid-phone-module")
      if (!isRecord(data)) throw invalid("invalid-phone-module", { entity: "phone-module" })
      const contentKey = `node:${encoded(nodeId)}:content`
      return commit(
        `phone-module:${encoded(moduleId)}:save`,
        { moduleId, nodeId, type, data, generatedModuleId }, applySavePhoneModuleCard,
        options,
        [contentKey],
      )
    },
    deletePhoneModuleCard(input, options) {
      if (!isRecord(input)) throw invalid("invalid-phone-module", { entity: "phone-module" })
      const moduleId = explicitIdentifier(input.moduleId, "phone-module")
      const nodeId = explicitIdentifier(input.nodeId, "node")
      const contentKey = `node:${encoded(nodeId)}:content`
      return commit(
        `phone-module:${encoded(moduleId)}:delete`,
        { moduleId, nodeId }, applyDeletePhoneModuleCard,
        options,
        [contentKey],
      )
    },
  })
}
