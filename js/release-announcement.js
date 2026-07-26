export const RELEASE_ANNOUNCEMENT_STORAGE_KEY = "tuuru_release_announcement_seen"

// Major-release switch: change this id and copy only when a new announcement
// should appear once for every browser on the current site origin.
export const CURRENT_RELEASE_ANNOUNCEMENT = Object.freeze({
  id:"2026-07-26-article-memory-interactive-pages",
  title:"Tuuru 2026-07-26 互动文章更新",
  publishedAt:"2026-07-26",
  intro:"这次更新重新梳理了章节正文、剧情记忆与互动图片的阅读关系，也补齐作者设定、编辑状态延续、读者美化包和发布检查。下面是本次上线内容与旧作品兼容说明。",
  items:Object.freeze([
    Object.freeze({
      title:"节点真正成为章节内的正文段落",
      body:"普通节点现在按当前阅读路线合并到同一章节页面，节点标题只供作者整理结构，不再作为读者正文标题显示。没有选项的普通节点会顺延后续正文；到达章节末尾后，NEXT 会进入下一章。尚未作出剧情选择时，不会提前显示选项之后的汇合正文。",
    }),
    Object.freeze({
      title:"自动起点与结构顺序",
      body:"作品起点默认取最前章节里的第一个普通节点，不再需要单独维护起点标记。想更换起点时，直接把目标普通节点移动到最前面即可；隐藏节点不会被误设为起点，节点稳定 ID、选项关联和剧情去向在移动后继续保留。",
    }),
    Object.freeze({
      title:"可移动的多组普通互动",
      body:"普通互动现在与剧情分支彻底分开：作者可把光标放在正文任意位置插入普通互动，同一节点可以容纳多组，并可在卡片中编辑、删除或移动位置；每组会独立记录读者选择，不互相覆盖，也不改变剧情路线。承担跳转的剧情分支固定在节点末尾。普通互动继续分别提供按钮上的“选项文本”和点击后的“选择后内容”；后者支持分行，并跟随正文的字体、字号、行距、字距、段落间距、首行缩进和安全自定义样式。",
    }),
    Object.freeze({
      title:"隐藏节点与剧情记忆",
      body:"章节中可以添加隐藏节点，并按读者当前路线中选择过的选项决定是否显示。条件编辑器支持搜索选项文本、节点、章节或稳定 ID；同一条件组是“或”，附加条件组之间是“且”。新建节点会先放在本章末尾，可以按住节点左边的“⠿”拖到需要的正文位置。读者返回改选后会立即重新判断，不再满足的隐藏内容会消失，再次满足时会恢复；选项改名不会断开记忆关联，选项被删除时会明确提示条件失效。",
    }),
    Object.freeze({
      title:"互动图片成为独立阅读页面",
      body:"互动图片现在是章节结构中的独立节点，会自然分隔前后的正文页面。一个互动页可按列表顺序编排多个画面：有互动点时需探索完当前画面的全部互动再继续，没有互动点时可直接点击对话框前进。最后一个画面必须设置“后续跳转至”，完成后固定进入指定普通节点，也可以越过中间节点直接跳到更远位置。互动图片内部暂不承载剧情分支；需要分流时，请在后续普通节点设置选项组。",
    }),
    Object.freeze({
      title:"作者设定与编辑状态延续",
      body:"互动文章新增细化的作者设定区域，用于整理故事总纲、章节规划、伏笔回收、世界规则、地点与组织、人物档案、人物关系和灵感碎片；移动端位于正文与结构之间，电脑端位于右侧区域。作品会记住上次编辑位置、章节折叠状态和收起的节点按钮。编辑器字体颜色也可单独设置。以上内容均为作者本地资料，不进入读者预览，也不随作品导出。",
    }),
    Object.freeze({
      title:"读者美化包",
      body:"读者端外观支持单独导出与导入美化包，可分享文章、手机和 App 的阅读外观，并可包含个人主页顶部图。美化包不会包含读者昵称、头像、ID、阅读记录或作者作品内容；导入时只更新外观，不会覆盖读者个人资料。",
    }),
    Object.freeze({
      title:"编辑性能、发布检查与教程",
      body:"结构树与选项检索建立了可复用索引，频繁输入采用缓冲保存，字段和画面增多时可减少重复扫描与整页重绘。发布检查现在还会提示未放进正文、重复放置、选项不足或稳定标识异常的普通互动，并继续检查失效的隐藏条件、剧情去向和互动图片出口；内置教程已按现有格式补充多组普通互动的插入、编辑、移动、恢复、独立记忆，以及它和末尾剧情分支的区别。",
    }),
    Object.freeze({
      title:"旧作品与本地数据兼容",
      body:"本次更新不会清空 localStorage、已有作者作品或读者进度；只打开首页时，旧作品仅在内存中补齐安全默认值，不会立即回写。作者下次真正保存后，作品格式版本和缺少的空集合会按新版结构一并保存，原有正文、章节、节点、选项、小手机内容及附加字段继续保留；极早期没有归属章节的节点会保留原内容并归入第一章。既有互动文章会开始采用本次明确的新阅读规则：最前章节的第一个普通节点成为自动起点，同章普通节点按当前路线合并与顺延。互动图片是本次首次正式上线，不存在已发布旧版互动图片需要补出口或迁移的问题。若本地数据原本已经损坏，新版本会停止覆盖并保留原始数据供恢复。请继续定期导出备份；换浏览器、换域名或清除站点数据仍会进入不同的本地空间。本公告在当前浏览器首次打开时显示一次。",
    }),
  ]),
})

function validAnnouncement(announcement) {
  return Boolean(announcement && typeof announcement.id === "string" && announcement.id.trim())
}

function resolveStorage(storage) {
  return storage ?? globalThis.localStorage
}

export function shouldShowReleaseAnnouncement(options = {}) {
  const announcement = options.announcement ?? CURRENT_RELEASE_ANNOUNCEMENT
  if (!validAnnouncement(announcement)) return false
  try {
    return resolveStorage(options.storage).getItem(RELEASE_ANNOUNCEMENT_STORAGE_KEY) !== announcement.id
  } catch {
    return true
  }
}

export function acknowledgeReleaseAnnouncement(options = {}) {
  const announcement = options.announcement ?? CURRENT_RELEASE_ANNOUNCEMENT
  if (!validAnnouncement(announcement)) return false
  try {
    resolveStorage(options.storage).setItem(RELEASE_ANNOUNCEMENT_STORAGE_KEY, announcement.id)
    return true
  } catch {
    return false
  }
}

function appendTextElement(documentObject, parent, tagName, className, text) {
  const element = documentObject.createElement(tagName)
  if (className) element.className = className
  element.textContent = String(text ?? "")
  parent.appendChild(element)
  return element
}

export function showReleaseAnnouncementOnce(options = {}) {
  const announcement = options.announcement ?? CURRENT_RELEASE_ANNOUNCEMENT
  const documentObject = options.document ?? globalThis.document
  const storage = resolveStorage(options.storage)
  if (!documentObject?.body || !shouldShowReleaseAnnouncement({ storage, announcement })) return null

  const existing = documentObject.querySelector(".release-announcement-overlay")
  if (existing) return existing

  const previousFocus = documentObject.activeElement
  const overlay = documentObject.createElement("div")
  overlay.className = "release-announcement-overlay"
  overlay.setAttribute("role", "presentation")

  const dialog = documentObject.createElement("section")
  dialog.className = "release-announcement-dialog"
  dialog.setAttribute("role", "dialog")
  dialog.setAttribute("aria-modal", "true")
  dialog.setAttribute("aria-labelledby", "releaseAnnouncementTitle")
  dialog.setAttribute("aria-describedby", "releaseAnnouncementIntro")
  dialog.tabIndex = -1

  const header = documentObject.createElement("header")
  header.className = "release-announcement-header"
  const heading = documentObject.createElement("div")
  appendTextElement(documentObject, heading, "h2", "release-announcement-title", announcement.title)
  appendTextElement(documentObject, heading, "p", "release-announcement-date", `${announcement.publishedAt} · 更新公告`)
  heading.firstElementChild.id = "releaseAnnouncementTitle"
  header.appendChild(heading)

  const closeButton = documentObject.createElement("button")
  closeButton.type = "button"
  closeButton.className = "release-announcement-close"
  closeButton.dataset.releaseAnnouncementClose = ""
  closeButton.setAttribute("aria-label", "关闭更新公告")
  closeButton.textContent = "×"
  header.appendChild(closeButton)
  dialog.appendChild(header)

  const body = documentObject.createElement("div")
  body.className = "release-announcement-body"
  const intro = appendTextElement(documentObject, body, "p", "release-announcement-intro", announcement.intro)
  intro.id = "releaseAnnouncementIntro"
  const list = documentObject.createElement("div")
  list.className = "release-announcement-list"
  const items = Array.isArray(announcement.items) ? announcement.items : []
  items.forEach(item => {
    const section = documentObject.createElement("section")
    section.className = "release-announcement-item"
    appendTextElement(documentObject, section, "h3", "", item?.title)
    appendTextElement(documentObject, section, "p", "", item?.body)
    list.appendChild(section)
  })
  body.appendChild(list)
  dialog.appendChild(body)

  const footer = documentObject.createElement("footer")
  footer.className = "release-announcement-footer"
  appendTextElement(documentObject, footer, "p", "release-announcement-once", "本公告在当前浏览器只显示一次。")
  const confirmButton = documentObject.createElement("button")
  confirmButton.type = "button"
  confirmButton.className = "release-announcement-confirm"
  confirmButton.dataset.releaseAnnouncementConfirm = ""
  confirmButton.textContent = "知道了"
  footer.appendChild(confirmButton)
  dialog.appendChild(footer)
  overlay.appendChild(dialog)

  let closed = false
  function close() {
    if (closed) return
    closed = true
    acknowledgeReleaseAnnouncement({ storage, announcement })
    documentObject.removeEventListener("keydown", onKeydown)
    overlay.remove()
    if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) previousFocus.focus()
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== "Tab") return
    const controls = Array.from(dialog.querySelectorAll("button:not([disabled])"))
    if (!controls.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && documentObject.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && documentObject.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  closeButton.addEventListener("click", close)
  confirmButton.addEventListener("click", close)
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close()
  })
  documentObject.addEventListener("keydown", onKeydown)
  documentObject.body.appendChild(overlay)
  confirmButton.focus()
  return overlay
}
