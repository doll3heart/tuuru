import { resolvePhoneReadingFlowStep } from "./phone-reading-flow.js"
import { safeMessageCardUrl } from "./message-card-links.js"

function items(value) {
  return Array.isArray(value) ? value : []
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function addIssue(issues, code, level, title, location, action) {
  issues.push({ code, level, title, location, action })
}

function validImageSource(value) {
  const source = String(value || "").trim()
  return !source || /^data:image\/[a-z0-9.+-]+;base64,/i.test(source) || Boolean(safeMessageCardUrl(source))
}

function inspectPlaceholders(work, issues) {
  const usedKeys = new Set()
  for (const [index, placeholder] of items(work?.placeholders).entries()) {
    const key = String(placeholder?.key || "").trim()
    const location = `占位符 · 第 ${index + 1} 项`
    if (!key) {
      addIssue(
        issues,
        "placeholder-key-empty",
        "error",
        "占位符标记为空",
        location,
        "填写标记后再发布。",
      )
      continue
    }
    if (usedKeys.has(key)) {
      addIssue(
        issues,
        "placeholder-key-duplicate",
        "error",
        `占位符标记“${key}”重复`,
        location,
        "为重复项填写不同的标记。",
      )
      continue
    }
    usedKeys.add(key)
  }
}

function inspectArticle(work, issues) {
  const nodes = items(work?.nodes)
  if (!nodes.length) {
    addIssue(
      issues,
      "article-nodes-empty",
      "error",
      "文章还没有剧情节点",
      "互动文章 · 作品结构",
      "至少新建一个节点并填写正文。",
    )
    return
  }

  const nodeIdCounts = new Map()
  for (const node of nodes) {
    const id = String(node?.id || "")
    nodeIdCounts.set(id, (nodeIdCounts.get(id) || 0) + 1)
  }
  const uniqueNodeIds = new Set(
    Array.from(nodeIdCounts.entries())
      .filter(([id, count]) => id && count === 1)
      .map(([id]) => id),
  )

  if (!uniqueNodeIds.has(String(work?.startNode || ""))) {
    addIssue(
      issues,
      "article-start-invalid",
      "error",
      "开始节点已缺失",
      "互动文章 · 开始节点",
      "重新选择一个有效的开始节点。",
    )
  }

  for (const [id, count] of nodeIdCounts) {
    if (!id || count < 2) continue
    addIssue(
      issues,
      "article-node-id-duplicate",
      "error",
      `节点 ID“${id}”重复`,
      "互动文章 · 作品结构",
      "复制异常内容到新节点，并删除重复节点。",
    )
  }

  for (const [nodeIndex, node] of nodes.entries()) {
    const nodeTitle = plainText(node?.title)
    const location = `互动文章 · ${nodeTitle || `第 ${nodeIndex + 1} 个节点`}`
    if (!nodeTitle) {
      addIssue(
        issues,
        "article-node-title-empty",
        "warning",
        "节点标题为空",
        location,
        "填写便于辨认的节点标题。",
      )
    }

    const choices = items(node?.choices)
    if (!plainText(node?.content) && !choices.length) {
      addIssue(
        issues,
        "article-node-content-empty",
        "warning",
        "节点没有正文或选项",
        location,
        "补充正文、互动选项或删除这个空节点。",
      )
    }

    for (const [choiceIndex, choice] of choices.entries()) {
      const choiceLocation = `${location} · 第 ${choiceIndex + 1} 个选项`
      if (!plainText(choice?.text)) {
        addIssue(
          issues,
          "article-choice-text-empty",
          "warning",
          "选项文字为空",
          choiceLocation,
          "填写读者可以理解的选项文字。",
        )
      }
      if (choice?.mode === "interaction") continue
      if (!uniqueNodeIds.has(String(choice?.targetId || ""))) {
        addIssue(
          issues,
          "article-choice-target-missing",
          "error",
          "剧情选项没有有效目标",
          choiceLocation,
          "重新选择目标节点。",
        )
      }
    }
  }

  for (const [index, module] of items(work?.phoneModules).entries()) {
    if (uniqueNodeIds.has(String(module?.nodeId || ""))) continue
    addIssue(
      issues,
      "article-phone-module-node-missing",
      "error",
      "小手机内容引用了已删除节点",
      `互动文章 · 插入内容 · 第 ${index + 1} 项`,
      "把内容重新插入到现有节点，或删除这条失效引用。",
    )
  }
}

function chatMessages(chat) {
  const messages = [...items(chat?.messages)]
  for (const round of items(chat?.rounds)) messages.push(...items(round?.messages))
  return messages
}

function inspectPhoneContacts(phoneData, issues) {
  const contactIds = new Set(items(phoneData?.contacts).map(contact => String(contact?.id || "")).filter(Boolean))

  for (const chat of items(phoneData?.chats)) {
    for (const contactId of items(chat?.contactIds)) {
      if (contactIds.has(String(contactId))) continue
      addIssue(
        issues,
        "phone-chat-contact-missing",
        "error",
        "聊天引用了已删除联系人",
        `小手机 · 消息 · ${plainText(chat?.groupName) || "会话"}`,
        "重新选择会话成员，或删除这个会话。",
      )
    }
  }

  const collections = [
    ["moments", "动态"],
    ["forumPosts", "论坛"],
    ["memos", "备忘录"],
    ["photos", "相册"],
    ["browserHistory", "浏览记录"],
    ["shoppingItems", "购物"],
  ]
  for (const [key, label] of collections) {
    for (const [index, entry] of items(phoneData?.[key]).entries()) {
      const contactId = String(entry?.contactId || "")
      if (!contactId || contactIds.has(contactId)) continue
      addIssue(
        issues,
        "phone-content-contact-missing",
        "warning",
        `${label}内容缺少有效角色`,
        `小手机 · ${label} · 第 ${index + 1} 项`,
        "重新选择角色，或删除这条内容。",
      )
    }
  }
}

function inspectPhoneMessages(phoneData, issues) {
  const forumPostIds = new Set(items(phoneData?.forumPosts).map(post => String(post?.id || "")).filter(Boolean))
  for (const chat of items(phoneData?.chats)) {
    const chatLabel = plainText(chat?.groupName) || "会话"
    for (const [index, message] of chatMessages(chat).entries()) {
      const location = `小手机 · 消息 · ${chatLabel} · 第 ${index + 1} 条`
      if (message?.type === "image") {
        if (!String(message?.image || "").trim()) {
          addIssue(
            issues,
            "phone-image-message-empty",
            "error",
            "图片消息没有图片",
            location,
            "填写图片地址，或删除这条图片消息。",
          )
        } else if (!validImageSource(message.image)) {
          addIssue(
            issues,
            "phone-image-url-invalid",
            "warning",
            "图片地址无法加载",
            location,
            "填写有效的 http、https 或上传图片地址。",
          )
        }
      }
      if (message?.type !== "link") continue
      if (message?.forumPostId && !forumPostIds.has(String(message.forumPostId))) {
        addIssue(
          issues,
          "phone-forum-link-missing",
          "error",
          "站内链接引用了已删除帖子",
          location,
          "重新选择论坛帖子，或改成有效的外部网址。",
        )
      } else if (!message?.forumPostId && !String(message?.linkUrl || "").trim()) {
        addIssue(
          issues,
          "phone-link-target-missing",
          "error",
          "链接卡片没有打开目标",
          location,
          "选择站内帖子，或填写完整的外部网址。",
        )
      } else if (!message?.forumPostId && !safeMessageCardUrl(message.linkUrl)) {
        addIssue(
          issues,
          "phone-external-link-invalid",
          "warning",
          "外部链接无法打开",
          location,
          "填写以 http:// 或 https:// 开头的完整网址。",
        )
      }
    }
  }
}

function inspectPhoneImages(phoneData, issues) {
  const imageGroups = [
    ["动态", items(phoneData?.moments).flatMap(moment => items(moment?.images))],
    ["论坛", items(phoneData?.forumPosts).flatMap(post => [post?.imageUrl, ...items(post?.images)])],
    ["相册", items(phoneData?.photos).map(photo => photo?.imageUrl)],
    ["购物", items(phoneData?.shoppingItems).map(item => item?.imageUrl)],
  ]
  for (const [label, sources] of imageGroups) {
    sources.forEach((source, index) => {
      if (!String(source || "").trim() || validImageSource(source)) return
      addIssue(
        issues,
        "phone-image-url-invalid",
        "warning",
        "图片地址无法加载",
        `小手机 · ${label} · 第 ${index + 1} 张`,
        "填写有效的 http、https 或上传图片地址。",
      )
    })
  }
}

function inspectPhoneReadingFlow(phoneData, issues) {
  const flow = phoneData?.readingFlow
  if (!flow || flow.enabled !== true) return
  for (const [index, step] of items(flow.sequence).entries()) {
    if (resolvePhoneReadingFlowStep(phoneData, step)) continue
    addIssue(
      issues,
      "phone-reading-flow-target-missing",
      "error",
      "阅读节奏引用的内容已不存在",
      `小手机 · 阅读节奏控制 · 第 ${index + 1} 项`,
      "删除这张节奏卡片，或重新加入对应内容。",
    )
  }
}

function inspectHiddenPhoneApps(phoneData, issues) {
  const contentByApp = {
    messages:items(phoneData?.chats).length + items(phoneData?.moments).length,
    forum:items(phoneData?.forumPosts).length,
    memo:items(phoneData?.memos).length,
    gallery:items(phoneData?.photos).length,
    browser:items(phoneData?.browserHistory).length,
    shopping:items(phoneData?.shoppingItems).length,
  }
  for (const app of items(phoneData?.apps)) {
    if (app?.enabled !== false || !contentByApp[app?.type]) continue
    addIssue(
      issues,
      "phone-hidden-app-has-content",
      "warning",
      `隐藏的“${plainText(app?.name) || app?.type || "App"}”仍有内容`,
      "小手机 · App 管理",
      "需要读者查看时打开这个 App；不需要时可保留隐藏。",
    )
  }
}

function inspectPhone(work, issues) {
  const phoneData = work?.phoneData
  if (!phoneData || typeof phoneData !== "object") {
    addIssue(
      issues,
      "phone-data-missing",
      "error",
      "小手机数据缺失",
      "小手机 · 整体数据",
      "重新打开编辑器并保存；仍无法恢复时使用备份。",
    )
    return
  }
  inspectPhoneContacts(phoneData, issues)
  inspectPhoneMessages(phoneData, issues)
  inspectPhoneImages(phoneData, issues)
  inspectPhoneReadingFlow(phoneData, issues)
  inspectHiddenPhoneApps(phoneData, issues)
}

export function inspectWorkBeforePublish(work) {
  const issues = []
  if (!plainText(work?.title)) {
    addIssue(
      issues,
      "work-title-empty",
      "warning",
      "作品标题为空",
      "作品信息",
      "填写作品标题，便于读者识别。",
    )
  }
  inspectPlaceholders(work, issues)
  if (work?.type === "article") {
    inspectArticle(work, issues)
    if (work?.phoneData && typeof work.phoneData === "object") inspectPhone(work, issues)
  } else if (work?.type === "phone") inspectPhone(work, issues)

  return {
    issues,
    counts:{
      error:issues.filter(issue => issue.level === "error").length,
      warning:issues.filter(issue => issue.level === "warning").length,
    },
  }
}
