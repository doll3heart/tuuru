export const RELEASE_ANNOUNCEMENT_STORAGE_KEY = "tuuru_release_announcement_seen"

// Major-release switch: change this id and copy only when a new announcement
// should appear once for every browser on the current site origin.
export const CURRENT_RELEASE_ANNOUNCEMENT = Object.freeze({
  id:"2026-07-22-phone-social-completeness",
  title:"Tuuru 2026-07-22 大型更新",
  publishedAt:"2026-07-22",
  intro:"这次集中更新覆盖互动文章、小手机、人物社交、论坛、写作习惯、教程和本地数据迁移。下面是本次上线功能与使用位置的完整说明。",
  items:Object.freeze([
    Object.freeze({
      title:"互动文章编辑器与作品结构",
      body:"移动端编辑器改为紧凑的“正文 / 结构”工作区；章节中可直接新增节点，节点可移动和排序。选项新增“剧情分支”和“不跳转的普通互动”两种模式；正文工具栏补充撤销、重做、格式状态和可持续使用的作者字体设置，作品简介也可继续编辑。",
    }),
    Object.freeze({
      title:"消息、通话与互动卡片",
      body:"长按聊天消息的编辑、引用等菜单会自动避开手机屏幕边缘；链接卡片和作品内论坛卡片更易阅读和打开，并新增可领取的外卖卡片。转账、红包等互动仍只记录在读者本地。视频通话可读取联系人“视频通话背景”，通话台词和消息会继续替换读者占位符。",
    }),
    Object.freeze({
      title:"联系人、头像、小号与排序",
      body:"联系人支持搜索、置顶、A–Z 和自定义排序，自定义模式可拖拽或用键盘调整。通用头像、消息头像、论坛头像已经分开，旧作品留空时仍回退到通用头像；原“固定脸”字段明确改作视频通话背景。论坛小号可设置独立名称、头像和 IP，论坛 NPC 也可设置 IP。",
    }),
    Object.freeze({
      title:"论坛发帖、评论与阅读体验",
      body:"论坛主楼现在保留回车分段，并在帖子详情提供明确“编辑”按钮，可重改标题、正文、时间和图片。帖子可自定义显示评论总数，主评论也可单独填写显示楼层；留空时仍按实际评论数和顺序计算。评论与楼中楼支持调整顺序、编辑显示时间和设置点赞数，主楼还可统一隐藏本帖全部回复时间；读者端可按热门或最新排序并在本次阅读中点赞。论坛 IP 开关默认关闭，开启后只显示作者配置的属地，不会给读者本人伪造 IP。",
    }),
    Object.freeze({
      title:"多角色续答与 @ 提及",
      body:"消息、动态和论坛的读者回复选项可以配置多条作者续答，每条续答都能单独选择联系人主号、论坛小号或 NPC。小手机中不再需要寻找单独的“@ 提及”按钮：在任意文本编辑框直接输入 @（包括手机输入法提交），即可从联系人、消息身份、小号、论坛 NPC、读者称呼和作品占位符中选择。动态评论新增正文与显示日期时间编辑。作品文件仍保存纯文本，作者预览和读者端负责识别与高亮。",
    }),
    Object.freeze({
      title:"占位符与跨作品写作习惯",
      body:"“新占位符”等显示名称现在可以直接修改；占位符标记完全由作者自定义，不要求方括号或固定名称。例如标记为“某某”时，“某某全肯定bot”和“@某某”会在填写后显示为“读者全肯定bot”和“@读者”，其中提及仍可识别并高亮。全文替换、随机替换和场景锁定继续保持作品内独立。替换覆盖作品中交给读者显示的整部小手机文本，包括联系人和 NPC 名称、消息、动态、论坛、备忘录、相册说明、浏览记录与购物内容；内部关联 ID、图片地址和链接地址不会被改写，但消息 ID、论坛 ID 等读者可见文字会正常替换。常用占位符可以保存为作者全局习惯并单独导入导出，套用时只创建当前作品副本。写作习惯页还可用带版本号的联系人包在两篇作品之间合并人物，遇到 ID 冲突会保留两边。",
    }),
    Object.freeze({
      title:"内置教程与功能答疑",
      body:"创作端和读者端切换按钮旁新增小巧“教程”入口。教程按第一次使用、互动文章、小手机、人物社交、占位符、文件与备份六个版块整理；每个版块都增加“我想要……该怎么做？”答疑，直接给出入口、按钮和功能位置，并说明章节与场景、别名与小号、各类头像等易混概念。",
    }),
    Object.freeze({
      title:"整机搬家与跨浏览器迁移",
      body:"首页新增“整机搬家”，可把作者作品库、作者本地设置和读者端本地作品 / 进度打包导出，再导入另一浏览器。数据包带格式版本并会先检查摘要；导入采用合并策略，同 ID 但内容不同的记录会换新 ID 保存，不要求清空新浏览器，也不会整库静默覆盖。",
    }),
    Object.freeze({
      title:"本批反馈修复",
      body:"动态头像恢复为正确的消息身份头像；备忘录、浏览记录、论坛主楼与评论的日期时间可由作者保留或修改，不再被现实时间自动覆盖；论坛正文空行、联系人身份解析、圆形头像和移动端顶部空间也已修正。",
    }),
    Object.freeze({
      title:"兼容、本地数据与公告规则",
      body:"本次更新不会主动清空 IndexedDB、localStorage 或已有作者 / 读者作品，旧字段继续兼容回退，JSON 与 PNG 导出保持相同作品语义。请继续使用原网址并定期备份；换浏览器、换域名或清站点数据仍会进入不同本地空间。本公告在每个浏览器更新后首次打开时显示一次，确认后不再重复。",
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
