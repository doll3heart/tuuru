export const CURRENT_WORK_SCHEMA_VERSION = 4

import { isSafeCssColor, isSafeIconValue, isSafeIdentifier } from "./safe-values.js"
import { normalizeWorkWatermark } from "./work-watermark.js"
import { normalizeWorkRelease } from "./work-release.js"
import { normalizeInteractiveScene } from "./interactive-scene-model.js"
import { normalizeArticleFormatting } from "./article-formatting.js"
import { normalizeInteractiveExperienceFields } from "./interactive-experience.js"
import {
  articleNodeHasInteractiveSceneCard,
  migrateInteractiveSceneCards,
} from "./interactive-scene-node.js"
import {
  articleNodeIsConditional,
  normalizeArticleDisplayCondition,
} from "./article-condition-model.js"
import { resolveAutomaticArticleStartNodeId } from "./article-start-node.js"
import {
  migrateLegacyArticleInteractions,
  normalizeArticleInteractionGroups,
} from "./article-interaction-group-model.js"

const SUPPORTED_WORK_TYPES = new Set(["article", "phone"])
const ARTICLE_COLLECTIONS = ["chapters", "phoneModules", "placeholders", "scenes", "interactiveScenes"]
const PHONE_COLLECTIONS = [
  "contacts", "chats", "moments", "forumPosts", "forumNpcs", "apps",
  "memos", "photos", "albums", "browserHistory", "shoppingItems",
]
const MAX_WORK_NESTING_DEPTH = 100

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

function invalidNesting(path) {
  return failure("invalid-work", "作品结构嵌套过深或无法安全检查。", [{
    code: "invalid-nesting",
    path,
    message: "作品结构嵌套过深、包含循环引用或无法检查。",
  }])
}

function inspectNesting(input, path) {
  const active = new WeakSet()
  const stack = [{ value: input, depth: 0, exiting: false }]

  try {
    while (stack.length > 0) {
      const frame = stack.pop()
      const value = frame.value
      if (value === null || typeof value !== "object") continue
      if (frame.exiting) {
        active.delete(value)
        continue
      }
      if (frame.depth > MAX_WORK_NESTING_DEPTH || active.has(value)) {
        return invalidNesting(path)
      }

      active.add(value)
      stack.push({ value, depth: frame.depth, exiting: true })
      const children = Array.isArray(value) ? value : Object.values(value)
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ value: children[index], depth: frame.depth + 1, exiting: false })
      }
    }
  } catch {
    return invalidNesting(path)
  }

  return { ok: true }
}

function failure(code, message, issues = []) {
  return { ok: false, code, message, issues }
}

function recordArray(value, path, { required = false } = {}) {
  if (value === undefined && !required) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return failure("invalid-record-array", "字段必须是对象数组。", [{
      code: "invalid-record-array",
      path,
      message: "字段必须是对象数组。",
    }])
  }
  const invalidIndex = value.findIndex(item => !isRecord(item))
  if (invalidIndex >= 0) {
    return failure("invalid-record-entry", "数组包含无效条目。", [{
      code: "invalid-record-entry",
      path: `${path}[${invalidIndex}]`,
      message: "数组条目必须是对象。",
    }])
  }
  return { ok: true, value: value.map(cloneJsonValue) }
}

function genericArray(value, path, { required = false } = {}) {
  if (value === undefined && !required) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return failure("invalid-array", "字段必须是数组。", [{
      code: "invalid-array",
      path,
      message: "字段必须是数组。",
    }])
  }
  return { ok: true, value: value.map(cloneJsonValue) }
}

function normalizeCollection(owner, key, path, validator = recordArray) {
  const result = validator(owner[key], `${path}.${key}`)
  if (result.ok) owner[key] = result.value
  return result
}

function normalizeChoices(owner, path) {
  const choicesResult = normalizeCollection(owner, "choices", path)
  if (!choicesResult.ok) return choicesResult

  for (let index = 0; index < owner.choices.length; index += 1) {
    const result = normalizeCollection(
      owner.choices[index],
      "followUpMessages",
      `${path}.choices[${index}]`,
    )
    if (!result.ok) return result
  }
  return { ok: true }
}

function normalizeMessages(messages, path) {
  for (let index = 0; index < messages.length; index += 1) {
    const result = normalizeChoices(messages[index], `${path}[${index}]`)
    if (!result.ok) return result
  }
  return { ok: true }
}

function asWorkFailure(result, code, message) {
  return result.ok ? result : failure(code, message, result.issues)
}

function unsafeRenderValue(path, message) {
  return failure("unsafe-render-value", "作品包含不安全的显示字段。", [{
    code: "unsafe-render-value",
    path,
    message,
  }])
}

function validateOptionalIdentifier(value, path) {
  if (value === undefined) return { ok: true }
  return isSafeIdentifier(value)
    ? { ok: true }
    : unsafeRenderValue(path, "标识符包含不能安全显示的字符。")
}

function validateAppsForRendering(value, path) {
  if (!Array.isArray(value)) return { ok: true }
  for (let index = 0; index < value.length; index += 1) {
    const app = value[index]
    if (!isRecord(app)) continue
    const appPath = `${path}[${index}]`
    const idResult = validateOptionalIdentifier(app.id, `${appPath}.id`)
    if (!idResult.ok) return idResult
    if (app.type !== undefined && !isSafeIdentifier(app.type)) {
      return unsafeRenderValue(`${appPath}.type`, "App 类型包含不能安全显示的字符。")
    }
    if (app.color !== undefined && !isSafeCssColor(app.color)) {
      return unsafeRenderValue(`${appPath}.color`, "App 颜色不是受支持的安全颜色。")
    }
    if (app.icon !== undefined && !isSafeIconValue(app.icon)) {
      return unsafeRenderValue(`${appPath}.icon`, "App 图标包含可执行内容。")
    }
  }
  return { ok: true }
}

function normalizeForumComments(comments, path) {
  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index]
    const commentPath = `${path}[${index}]`
    const choicesResult = normalizeChoices(comment, commentPath)
    if (!choicesResult.ok) return choicesResult
    const repliesResult = normalizeCollection(comment, "replies", commentPath)
    if (!repliesResult.ok) return repliesResult
    const nestedResult = normalizeForumComments(comment.replies, `${commentPath}.replies`)
    if (!nestedResult.ok) return nestedResult
  }
  return { ok: true }
}

function validateWorkRenderValues(work, path, { strictPresentation }) {
  if (!strictPresentation) return { ok: true }
  const idResult = validateOptionalIdentifier(work.id, `${path}.id`)
  if (!idResult.ok) return idResult

  const phoneAppsResult = validateAppsForRendering(work.phoneData?.apps, `${path}.phoneData.apps`)
  if (!phoneAppsResult.ok) return phoneAppsResult
  if (Array.isArray(work.phoneModules)) {
    for (let index = 0; index < work.phoneModules.length; index += 1) {
      const result = validateAppsForRendering(
        work.phoneModules[index]?.data?.apps,
        `${path}.phoneModules[${index}].data.apps`,
      )
      if (!result.ok) return result
    }
  }
  return { ok: true }
}

function migrateLegacyArticleChapterMembership(work, sourceVersion) {
  if (sourceVersion > 1 || !work.chapters.length) return
  const firstChapterId = String(work.chapters[0]?.id || "")
  if (!firstChapterId) return

  const legacyUngrouped = work.nodes.filter(node => !String(node?.chapterId || ""))
  if (!legacyUngrouped.length) return

  const orderedNodes = work.nodes.filter(node => String(node?.chapterId || ""))
  let insertIndex = -1
  for (let index = 0; index < orderedNodes.length; index += 1) {
    if (String(orderedNodes[index]?.chapterId || "") === firstChapterId) insertIndex = index
  }
  const migratedNodes = legacyUngrouped.map(node => ({ ...node, chapterId: firstChapterId }))
  orderedNodes.splice(insertIndex + 1, 0, ...migratedNodes)
  work.nodes = orderedNodes
}

function conditionalInvariantFailure(code, path, message) {
  return failure("invalid-article", message, [{ code, path, message }])
}

function canonicalArticleNodeId(value) {
  return String(value || "")
}

function legacyInteractionGroupId(node, nodeIndex, usedIds) {
  const source = String(node?.id || `node-${nodeIndex + 1}`)
  const stem = source
    .replace(/[^a-z0-9._:-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || `node-${nodeIndex + 1}`
  let candidate = `interaction-${stem}`
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `interaction-${stem}-${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function validateAuthoredConditionalArticleInvariants(work, path) {
  const conditionalNodeIds = new Set()
  const normalizedInteractiveScenes = work.interactiveScenes.map(normalizeInteractiveScene)
  for (let nodeIndex = 0; nodeIndex < work.nodes.length; nodeIndex += 1) {
    const node = work.nodes[nodeIndex]
    if (!articleNodeIsConditional(node)) continue
    conditionalNodeIds.add(canonicalArticleNodeId(node.id))
    if (node.interactionGroups?.length) {
      return conditionalInvariantFailure(
        "conditional-interaction-groups",
        `${path}.nodes[${nodeIndex}].interactionGroups`,
        "隐藏节点不能包含普通互动组。",
      )
    }
    if (node.interactiveSceneId !== undefined && node.interactiveSceneId !== "") {
      return conditionalInvariantFailure(
        "conditional-interactive-scene",
        `${path}.nodes[${nodeIndex}].interactiveSceneId`,
        "条件节点不能是互动场景节点。",
      )
    }
  }
  for (let nodeIndex = 0; nodeIndex < work.nodes.length; nodeIndex += 1) {
    const node = work.nodes[nodeIndex]
    if (node?.kind !== "interactive-scene" || !node.interactionGroups?.length) continue
    return conditionalInvariantFailure(
      "interactive-scene-interaction-groups",
      `${path}.nodes[${nodeIndex}].interactionGroups`,
      "互动场景节点不能包含普通互动组。",
    )
  }
  if (conditionalNodeIds.has(canonicalArticleNodeId(work.startNode))) {
    return conditionalInvariantFailure(
      "conditional-start-node",
      `${path}.startNode`,
      "条件节点不能作为文章起点。",
    )
  }
  for (let nodeIndex = 0; nodeIndex < work.nodes.length; nodeIndex += 1) {
    const choices = work.nodes[nodeIndex].choices
    for (let choiceIndex = 0; choiceIndex < choices.length; choiceIndex += 1) {
      if (choices[choiceIndex].mode === "interaction") continue
      if (!conditionalNodeIds.has(canonicalArticleNodeId(choices[choiceIndex].targetId))) continue
      return conditionalInvariantFailure(
        "conditional-choice-target",
        `${path}.nodes[${nodeIndex}].choices[${choiceIndex}].targetId`,
        "分支选项不能指向条件节点。",
      )
    }
  }
  for (let sceneIndex = 0; sceneIndex < work.interactiveScenes.length; sceneIndex += 1) {
    if (!conditionalNodeIds.has(normalizedInteractiveScenes[sceneIndex].nodeId)) continue
    return conditionalInvariantFailure(
      "conditional-interactive-scene",
      `${path}.interactiveScenes[${sceneIndex}].nodeId`,
      "条件节点不能是互动场景节点。",
    )
  }
  for (let sceneIndex = 0; sceneIndex < work.interactiveScenes.length; sceneIndex += 1) {
    const sceneId = normalizedInteractiveScenes[sceneIndex].id
    const ownerIndex = work.nodes.findIndex(node => (
      articleNodeIsConditional(node) && articleNodeHasInteractiveSceneCard(node, sceneId)
    ))
    if (ownerIndex < 0) continue
    return conditionalInvariantFailure(
      "conditional-interactive-scene",
      `${path}.nodes[${ownerIndex}].content`,
      "条件节点不能拥有互动场景入口。",
    )
  }
  return { ok: true }
}

function normalizeArticle(input, path, sourceVersion) {
  const nodesResult = recordArray(input.nodes, `${path}.nodes`, { required: true })
  if (!nodesResult.ok) return asWorkFailure(nodesResult, "invalid-article", "文章作品结构无效。")

  const work = cloneJsonValue(input)
  normalizeInteractiveExperienceFields(work)
  if (Object.hasOwn(input, "articleFormatting")) {
    work.articleFormatting = normalizeArticleFormatting(input.articleFormatting)
  }
  work.nodes = nodesResult.value
  for (const key of ARTICLE_COLLECTIONS) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work[key] = result.value
  }
  const usedInteractionGroupIds = new Set()
  for (const sourceNode of work.nodes) {
    for (const group of Array.isArray(sourceNode?.interactionGroups) ? sourceNode.interactionGroups : []) {
      if (typeof group?.id === "string") usedInteractionGroupIds.add(group.id)
    }
  }
  for (let index = 0; index < work.nodes.length; index += 1) {
    const result = recordArray(input.nodes[index].choices, `${path}.nodes[${index}].choices`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work.nodes[index].choices = result.value
    if (sourceVersion < 3 && articleNodeIsConditional(work.nodes[index])) {
      const legacyKindKeyBase = "__legacyConditionalKindV2"
      let legacyKindKey = legacyKindKeyBase
      let suffix = 2
      while (Object.hasOwn(work.nodes[index], legacyKindKey)) {
        legacyKindKey = `${legacyKindKeyBase}_${suffix}`
        suffix += 1
      }
      work.nodes[index][legacyKindKey] = work.nodes[index].kind
      delete work.nodes[index].kind
    }
    if (sourceVersion >= 3 && articleNodeIsConditional(work.nodes[index])) {
      if (sourceVersion >= 4 && Array.isArray(input.nodes[index].interactionGroups) && input.nodes[index].interactionGroups.length) {
        return conditionalInvariantFailure(
          "conditional-interaction-groups",
          `${path}.nodes[${index}].interactionGroups`,
          "隐藏节点不能包含普通互动组。",
        )
      }
      work.nodes[index].choices = []
      work.nodes[index].displayCondition = normalizeArticleDisplayCondition(
        input.nodes[index].displayCondition,
      )
    }
    if (sourceVersion >= 4) {
      const groupsResult = recordArray(
        input.nodes[index].interactionGroups,
        `${path}.nodes[${index}].interactionGroups`,
      )
      if (!groupsResult.ok) return asWorkFailure(groupsResult, "invalid-article", "普通互动组结构无效。")
      for (let groupIndex = 0; groupIndex < groupsResult.value.length; groupIndex += 1) {
        const choicesResult = recordArray(
          input.nodes[index].interactionGroups[groupIndex].choices,
          `${path}.nodes[${index}].interactionGroups[${groupIndex}].choices`,
        )
        if (!choicesResult.ok) return asWorkFailure(choicesResult, "invalid-article", "普通互动组选项结构无效。")
        groupsResult.value[groupIndex].choices = choicesResult.value
      }
      const normalizedGroups = normalizeArticleInteractionGroups(groupsResult.value)
      if (!normalizedGroups.ok) {
        return conditionalInvariantFailure(
          normalizedGroups.reason,
          `${path}.nodes[${index}].interactionGroups`,
          "普通互动组包含无效或重复的稳定 ID。",
        )
      }
      work.nodes[index].interactionGroups = normalizedGroups.groups
    } else if (!articleNodeIsConditional(work.nodes[index])) {
      const migrated = migrateLegacyArticleInteractions(
        work.nodes[index],
        () => legacyInteractionGroupId(work.nodes[index], index, usedInteractionGroupIds),
      )
      if (!migrated.ok) {
        return conditionalInvariantFailure(
          migrated.reason,
          `${path}.nodes[${index}].choices`,
          "旧版普通互动选项无法安全迁移。",
        )
      }
      work.nodes[index] = migrated.node
    } else {
      work.nodes[index].interactionGroups = []
    }
    if (
      sourceVersion >= 4
      && work.nodes[index]?.kind === "interactive-scene"
      && work.nodes[index].interactionGroups.length
    ) {
      return conditionalInvariantFailure(
        "interactive-scene-interaction-groups",
        `${path}.nodes[${index}].interactionGroups`,
        "互动场景节点不能包含普通互动组。",
      )
    }
  }
  work.startNode = resolveAutomaticArticleStartNodeId(work)
  if (sourceVersion >= 3) {
    const conditionalInvariantResult = validateAuthoredConditionalArticleInvariants(work, path)
    if (!conditionalInvariantResult.ok) return conditionalInvariantResult
  }
  migrateLegacyArticleChapterMembership(work, sourceVersion)
  for (let sceneIndex = 0; sceneIndex < work.interactiveScenes.length; sceneIndex += 1) {
    const sourceScene = input.interactiveScenes[sceneIndex]
    const stagesResult = recordArray(
      sourceScene.stages,
      `${path}.interactiveScenes[${sceneIndex}].stages`,
    )
    if (!stagesResult.ok) return asWorkFailure(stagesResult, "invalid-article", "互动场景结构无效。")
    for (let stageIndex = 0; stageIndex < stagesResult.value.length; stageIndex += 1) {
      const hotspotsResult = recordArray(
        sourceScene.stages[stageIndex].hotspots,
        `${path}.interactiveScenes[${sceneIndex}].stages[${stageIndex}].hotspots`,
      )
      if (!hotspotsResult.ok) return asWorkFailure(hotspotsResult, "invalid-article", "互动场景结构无效。")
    }
    work.interactiveScenes[sceneIndex] = normalizeInteractiveScene(sourceScene)
  }
  for (let index = 0; index < work.phoneModules.length; index += 1) {
    const moduleData = input.phoneModules[index].data
    if (moduleData !== undefined && !isRecord(moduleData)) {
      return failure("invalid-article", "文章手机模块结构无效。", [{
        code: "invalid-record",
        path: `${path}.phoneModules[${index}].data`,
        message: "手机模块 data 必须是对象。",
      }])
    }
    if (moduleData !== undefined) {
      const result = normalizePhoneData(moduleData, `${path}.phoneModules[${index}].data`)
      if (!result.ok) return asWorkFailure(result, "invalid-article", "文章手机模块结构无效。")
      work.phoneModules[index].data = result.value
    }
  }
  const interactiveNodeMigration = migrateInteractiveSceneCards(work)
  work.nodes = interactiveNodeMigration.work.nodes
  work.interactiveScenes = interactiveNodeMigration.work.interactiveScenes
  work.startNode = resolveAutomaticArticleStartNodeId(work)
  return { ok: true, work }
}

function normalizePhoneData(phoneData, path) {
  const normalized = cloneJsonValue(phoneData)
  for (const key of PHONE_COLLECTIONS) {
    const result = recordArray(phoneData[key], `${path}.${key}`)
    if (!result.ok) return result
    normalized[key] = result.value
  }

  for (let index = 0; index < normalized.chats.length; index += 1) {
    const chat = normalized.chats[index]
    const contactIdsResult = normalizeCollection(chat, "contactIds", `${path}.chats[${index}]`, genericArray)
    if (!contactIdsResult.ok) return contactIdsResult
    for (const key of ["messages", "rounds"]) {
      const result = normalizeCollection(chat, key, `${path}.chats[${index}]`)
      if (!result.ok) return result
    }
    const messagesResult = normalizeMessages(chat.messages, `${path}.chats[${index}].messages`)
    if (!messagesResult.ok) return messagesResult
    for (let roundIndex = 0; roundIndex < chat.rounds.length; roundIndex += 1) {
      const round = chat.rounds[roundIndex]
      const roundPath = `${path}.chats[${index}].rounds[${roundIndex}]`
      const result = normalizeCollection(round, "messages", roundPath)
      if (!result.ok) return result
      const nestedResult = normalizeMessages(round.messages, `${roundPath}.messages`)
      if (!nestedResult.ok) return nestedResult
    }
  }

  for (let index = 0; index < normalized.moments.length; index += 1) {
    const moment = normalized.moments[index]
    const momentPath = `${path}.moments[${index}]`
    const imagesResult = normalizeCollection(moment, "images", momentPath, genericArray)
    if (!imagesResult.ok) return imagesResult
    const commentsResult = normalizeCollection(moment, "comments", momentPath)
    if (!commentsResult.ok) return commentsResult
    for (let commentIndex = 0; commentIndex < moment.comments.length; commentIndex += 1) {
      const result = normalizeChoices(
        moment.comments[commentIndex],
        `${momentPath}.comments[${commentIndex}]`,
      )
      if (!result.ok) return result
    }
  }

  for (let index = 0; index < normalized.forumPosts.length; index += 1) {
    const post = normalized.forumPosts[index]
    const postPath = `${path}.forumPosts[${index}]`
    const imagesResult = normalizeCollection(post, "images", postPath, genericArray)
    if (!imagesResult.ok) return imagesResult
    const commentsResult = normalizeCollection(post, "comments", postPath)
    if (!commentsResult.ok) return commentsResult
    const nestedCommentsResult = normalizeForumComments(post.comments, `${postPath}.comments`)
    if (!nestedCommentsResult.ok) return nestedCommentsResult
  }
  return { ok: true, value: normalized }
}

function validateAndNormalizeWorkUnchecked(input, {
  context = "reader-import",
  path = "$",
} = {}) {
  if (!isRecord(input)) {
    return failure("invalid-work", "文件内容不是有效的 Tuuru 作品对象。", [{
      code: "invalid-record", path, message: "作品必须是对象。",
    }])
  }

  const sourceVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion
  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
    return failure("invalid-version", "作品格式版本无效。", [{
      code: "invalid-version", path: `${path}.schemaVersion`, message: "格式版本必须是非负整数。",
    }])
  }
  if (sourceVersion > CURRENT_WORK_SCHEMA_VERSION) {
    return failure(
      "unsupported-version",
      `该作品使用格式版本 ${sourceVersion}，当前阅读器最高支持版本 ${CURRENT_WORK_SCHEMA_VERSION}。请升级阅读器后重试。`,
      [{ code: "unsupported-version", path: `${path}.schemaVersion`, message: "作品来自更新版本。" }],
    )
  }

  if (context !== "reader-import") {
    const identityResult = validateOptionalIdentifier(input.id, `${path}.id`)
    if (!identityResult.ok) return identityResult
  }

  if (!SUPPORTED_WORK_TYPES.has(input.type)) {
    const preservesLegacyType = context !== "reader-import"
      && (input.type === undefined || typeof input.type === "string")
    if (preservesLegacyType) {
      const nestingResult = inspectNesting(input, path)
      if (!nestingResult.ok) return nestingResult
      if (input.type !== undefined && !isSafeIdentifier(input.type)) {
        return unsafeRenderValue(`${path}.type`, "作品类型包含不能安全显示的字符。")
      }
      const renderValuesResult = validateWorkRenderValues(input, path, { strictPresentation: true })
      if (!renderValuesResult.ok) return renderValuesResult
      return {
        ok: true,
        work: cloneJsonValue(input),
        sourceVersion,
        migrated: false,
        warnings: [],
      }
    }
    return failure("unsupported-type", "作品类型无效或当前阅读器不支持。", [{
      code: "unsupported-type", path: `${path}.type`, message: "作品类型不受支持。",
    }])
  }

  const nestingResult = inspectNesting(input, path)
  if (!nestingResult.ok) return nestingResult

  let normalized
  if (input.type === "article") normalized = normalizeArticle(input, path, sourceVersion)
  else if (!isRecord(input.phoneData)) {
    normalized = failure("invalid-phone", "手机作品缺少有效的手机数据。", [{
      code: "invalid-record", path: `${path}.phoneData`, message: "phoneData 必须是对象。",
    }])
  } else {
    const phoneResult = normalizePhoneData(input.phoneData, `${path}.phoneData`)
    normalized = phoneResult.ok
      ? { ok: true, work: { ...cloneJsonValue(input), phoneData: phoneResult.value } }
      : asWorkFailure(phoneResult, "invalid-phone", "手机作品结构无效。")
  }
  if (!normalized.ok) return normalized

  if (Object.hasOwn(input, "watermark")) {
    normalized.work.watermark = normalizeWorkWatermark(input.watermark)
  }
  const release = normalizeWorkRelease(input.release, normalized.work.id)
  if (release) normalized.work.release = release
  else delete normalized.work.release

  const renderValuesResult = validateWorkRenderValues(normalized.work, path, {
    strictPresentation: context !== "reader-import",
  })
  if (!renderValuesResult.ok) return renderValuesResult

  normalized.work.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  for (const key of ["placeholders", "scenes"]) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, `invalid-${input.type}`, "作品公共结构无效。")
    normalized.work[key] = result.value
  }
  return {
    ok: true,
    work: normalized.work,
    sourceVersion,
    migrated: sourceVersion < CURRENT_WORK_SCHEMA_VERSION,
    warnings: [],
  }
}

export function validateAndNormalizeWork(input, options = {}) {
  let failurePath = "$"
  try {
    if (typeof options?.path === "string") failurePath = options.path
    return validateAndNormalizeWorkUnchecked(input, options)
  } catch {
    return invalidNesting(failurePath)
  }
}

export function validateWorkForImport(input) {
  return validateAndNormalizeWork(input, { context: "reader-import", path: "$" })
}
