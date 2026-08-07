const SUPPORTED_KINDS = new Set(["node", "choice", "contact", "npc"])

function items(value) {
  return Array.isArray(value) ? value : []
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

function text(value, fallback) {
  const normalized = String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return (normalized || fallback).slice(0, 80)
}

function chapterName(work, chapterId) {
  return items(work?.chapters).find(chapter => sameId(chapter?.id, chapterId))?.name || "未分章"
}

function nodeLocation(work, node) {
  return `互动文章 · ${text(chapterName(work, node?.chapterId), "未分章")} · ${text(node?.title, "未命名节点")}`
}

function createCollector() {
  const output = []
  const seen = new Set()
  return {
    add(path, category, location, locator = {}) {
      const key = `${category}:${path}`
      if (seen.has(key)) return
      seen.add(key)
      output.push(Object.freeze({
        id:key,
        category,
        location,
        ...locator,
      }))
    },
    finish() {
      return Object.freeze(output)
    },
  }
}

function findNodeReferences(work, id, collector) {
  for (const [nodeIndex, node] of items(work?.nodes).entries()) {
    for (const [choiceIndex, choice] of items(node?.choices).entries()) {
      if (!sameId(choice?.targetId, id)) continue
      collector.add(
        `nodes.${nodeIndex}.choices.${choiceIndex}.targetId`,
        "剧情分支",
        `${nodeLocation(work, node)} · ${text(choice?.text, `选项 ${choiceIndex + 1}`)}`,
        { sourceNodeId:String(node?.id || "") },
      )
    }
    for (const [groupIndex, group] of items(node?.interactionGroups).entries()) {
      if (group?.kind !== "random-game") continue
      for (const [choiceIndex, choice] of items(group?.choices).entries()) {
        if (!sameId(choice?.targetId, id)) continue
        collector.add(
          `nodes.${nodeIndex}.interactionGroups.${groupIndex}.choices.${choiceIndex}.targetId`,
          "小游戏结果",
          `${nodeLocation(work, node)} · ${text(group?.label, "小游戏")} · ${text(choice?.text, `结果 ${choiceIndex + 1}`)}`,
          { sourceNodeId:String(node?.id || "") },
        )
      }
    }
  }
  for (const [sceneIndex, scene] of items(work?.interactiveScenes).entries()) {
    if (!sameId(scene?.nextNodeId, id)) continue
    collector.add(
      `interactiveScenes.${sceneIndex}.nextNodeId`,
      "互动图片后续",
      `互动文章 · 互动图片 · ${text(scene?.title, `第 ${sceneIndex + 1} 页`)}`,
      { sourceNodeId:String(scene?.nodeId || "") },
    )
  }
  for (const [moduleIndex, module] of items(work?.phoneModules).entries()) {
    if (!sameId(module?.nodeId, id)) continue
    collector.add(
      `phoneModules.${moduleIndex}.nodeId`,
      "插入内容",
      `互动文章 · 插入内容 · ${text(module?.title || module?.type, `第 ${moduleIndex + 1} 项`)}`,
      { sourceNodeId:String(module?.nodeId || "") },
    )
  }
}

function findChoiceReferences(work, id, collector) {
  for (const [nodeIndex, node] of items(work?.nodes).entries()) {
    for (const [groupIndex, group] of items(node?.displayCondition?.all).entries()) {
      if (!items(group?.anyChoiceIds).some(choiceId => sameId(choiceId, id))) continue
      collector.add(
        `nodes.${nodeIndex}.displayCondition.all.${groupIndex}`,
        "显示条件",
        `${nodeLocation(work, node)} · 条件组 ${groupIndex + 1}`,
        { sourceNodeId:String(node?.id || "") },
      )
    }
  }
}

function contactIdentity(work, id) {
  const contacts = items(work?.phoneData?.contacts)
  const contact = contacts.find(candidate => sameId(candidate?.id, id))
  if (!contact) return { ids:new Set([String(id)]), names:new Map([[String(id), "该角色"]]) }
  const ids = new Set([String(contact.id)])
  const names = new Map([[String(contact.id), text(contact.name, "该角色")]])
  for (const alias of items(contact.aliases)) {
    if (!String(alias?.id || "")) continue
    ids.add(String(alias.id))
    names.set(String(alias.id), text(alias.name || alias.forumId, `${text(contact.name, "该角色")}的小号`))
  }
  return { ids, names }
}

function matchesAny(value, ids) {
  return value != null && ids.has(String(value))
}

function chatMessages(chat) {
  const output = [...items(chat?.messages)]
  for (const round of items(chat?.rounds)) output.push(...items(round?.messages))
  return output
}

function addNestedContactReferences({
  collector,
  values,
  ids,
  names,
  basePath,
  category,
  location,
  appType,
}) {
  const stack = items(values).map((value, index) => ({ value, path:`${basePath}.${index}`, index }))
  while (stack.length) {
    const current = stack.shift()
    const record = current.value
    if (!record || typeof record !== "object") continue
    const identityId = record.contactId ?? record.senderId ?? record.authorId
    if (matchesAny(identityId, ids)) {
      const identityName = names.get(String(identityId)) || "该角色"
      collector.add(
        current.path,
        category,
        `${location} · ${identityName} · 第 ${current.index + 1} 条`,
        { appType },
      )
    }
    for (const key of ["comments", "replies", "followUps"]) {
      items(record[key]).forEach((child, index) => {
        stack.push({ value:child, path:`${current.path}.${key}.${index}`, index })
      })
    }
  }
}

function findContactReferences(work, id, collector) {
  const phoneData = work?.phoneData || {}
  const { ids, names } = contactIdentity(work, id)

  for (const [chatIndex, chat] of items(phoneData.chats).entries()) {
    const chatLabel = text(chat?.groupName, `会话 ${chatIndex + 1}`)
    if (items(chat?.contactIds).some(contactId => matchesAny(contactId, ids))) {
      collector.add(
        `phoneData.chats.${chatIndex}.contactIds`,
        "消息",
        `小手机 · 消息 · ${chatLabel} · 会话成员`,
        { appType:"messages" },
      )
    }
    const roleIds = [
      chat?.groupOwnerId,
      ...items(chat?.groupAdminIds),
      ...Object.keys(chat?.groupTitles || {}),
    ]
    if (roleIds.some(contactId => matchesAny(contactId, ids))) {
      collector.add(
        `phoneData.chats.${chatIndex}.roles`,
        "消息",
        `小手机 · 消息 · ${chatLabel} · 群聊身份`,
        { appType:"messages" },
      )
    }
    for (const [messageIndex, message] of chatMessages(chat).entries()) {
      const identityId = message?.senderId
      const actorKey = String(message?.actorKey || "")
      if (!matchesAny(identityId, ids) && ![...ids].some(targetId => actorKey === targetId || actorKey.endsWith(`:${targetId}`))) continue
      const identityName = names.get(String(identityId)) || "该角色"
      collector.add(
        `phoneData.chats.${chatIndex}.messages.${messageIndex}`,
        "消息",
        `小手机 · 消息 · ${chatLabel} · ${identityName} · 第 ${messageIndex + 1} 条`,
        { appType:"messages" },
      )
    }
  }

  const collections = [
    ["moments", "动态", "messages"],
    ["forumPosts", "论坛", "forum"],
    ["memos", "备忘录", "memo"],
    ["photos", "相册", "gallery"],
    ["albums", "相册", "gallery"],
    ["browserHistory", "浏览记录", "browser"],
    ["shoppingItems", "购物", "shopping"],
  ]
  for (const [key, category, appType] of collections) {
    const records = items(phoneData[key])
    for (const [index, record] of records.entries()) {
      const recordLabel = text(
        record?.title || record?.content || record?.caption || record?.name,
        `第 ${index + 1} 项`,
      )
      const identityId = record?.contactId ?? record?.senderId ?? record?.authorId
      if (matchesAny(identityId, ids)) {
        const identityName = names.get(String(identityId)) || "该角色"
        collector.add(
          `phoneData.${key}.${index}`,
          category,
          `小手机 · ${category} · ${identityName} · ${recordLabel}`,
          { appType },
        )
      }
      addNestedContactReferences({
        collector,
        values:[...items(record?.comments), ...items(record?.replies)],
        ids,
        names,
        basePath:`phoneData.${key}.${index}.responses`,
        category,
        location:`小手机 · ${category} · ${recordLabel}`,
        appType,
      })
    }
  }
}

function findNpcReferences(work, id, collector) {
  const posts = items(work?.phoneData?.forumPosts)
  const stack = posts.map((post, index) => ({
    value:post,
    path:`phoneData.forumPosts.${index}`,
    label:text(post?.title || post?.content, `帖子 ${index + 1}`),
  }))
  while (stack.length) {
    const current = stack.shift()
    const record = current.value
    if (!record || typeof record !== "object") continue
    if (
      sameId(record.npcId, id)
      || sameId(record.authorNpcId, id)
      || (record.authorType === "npc" && sameId(record.authorId, id))
    ) {
      collector.add(
        current.path,
        "论坛",
        `小手机 · 论坛 · ${current.label}`,
        { appType:"forum" },
      )
    }
    for (const key of ["comments", "replies"]) {
      items(record[key]).forEach((child, index) => {
        stack.push({
          value:child,
          path:`${current.path}.${key}.${index}`,
          label:`${current.label} · ${key === "comments" ? "评论" : "回复"} ${index + 1}`,
        })
      })
    }
  }
}

export function findWorkReferences(work, request) {
  const kind = String(request?.kind || "")
  const id = String(request?.id || "")
  if (!work || typeof work !== "object" || !SUPPORTED_KINDS.has(kind) || !id) return []
  const collector = createCollector()
  if (kind === "node") findNodeReferences(work, id, collector)
  else if (kind === "choice") findChoiceReferences(work, id, collector)
  else if (kind === "contact") findContactReferences(work, id, collector)
  else if (kind === "npc") findNpcReferences(work, id, collector)
  return collector.finish()
}
