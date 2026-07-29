export const RELEASE_ANNOUNCEMENT_STORAGE_KEY = "tuuru_release_announcement_seen"

// Major-release switch: change this id and copy only when a new announcement
// should appear once for every browser on the current site origin.
export const CURRENT_RELEASE_ANNOUNCEMENT = Object.freeze({
  id:"2026-07-29-reader-polish-and-release-workflow",
  title:"Tuuru 2026-07-29 体验优化更新",
  publishedAt:"2026-07-29",
  intro:"这次更新集中打磨了读者书架、作品更新、美化工作台和作者发布流程，让常用操作更顺手，也让本地阅读数据与旧作品在升级时更安心。下面是本次更新内容与兼容说明。",
  items:Object.freeze([
    Object.freeze({
      title:"书架与导入体验",
      body:"导入作品改为独立弹窗，书架页面更加清爽；书籍支持长按管理、置顶和取消置顶，置顶作品会在不同排序与身份组中优先展示。书架卡片统一采用简洁配色并跟随系统明暗模式，管理按钮、最近阅读和焦点反馈也进行了精简。每部作品填写过的占位符与阅读身份会自动保存，身份组可自由命名，默认保持空白。",
    }),
    Object.freeze({
      title:"识别同一作品的新旧版本",
      body:"作品现在带有稳定身份与发布版本信息。再次导入时，Tuuru 会区分新版本、相同版本、较早版本、版本冲突和旧格式作品，并在更新前展示不涉及剧情内容的变化摘要，例如新增章节、消息、帖子和图片数量。较早版本或冲突版本可以只在本次临时打开，不必覆盖书架中的正式版本。",
    }),
    Object.freeze({
      title:"更新时保留读者数据",
      body:"更新同一作品时，会尽量保留阅读进度、存档、阅读身份、占位符和书签。如果新版删除了原书签位置，书签会迁移到附近可用位置并标记提示。恢复书架备份时，会优先保留当前设备已经设置的置顶习惯。删除书签、移出书架等操作也加入限时撤销，减少误操作造成的损失。",
    }),
    Object.freeze({
      title:"统一的美化工作台",
      body:"文章、手机、个人主页、消息、论坛、备忘录、图库、浏览器、购物和联系人美化统一为折叠分区。电脑端保持左侧实时预览、右侧设置；手机端改为类似书页的预览与设置双页工作台，可点击或滑动切换。点击预览中的元素会直接展开对应设置，折叠栏会显示当前效果摘要与未保存状态。",
    }),
    Object.freeze({
      title:"消息背景与气泡素材",
      body:"聊天壁纸现在会真正应用到消息区域，并支持适配方式、焦点位置和明暗调整；可直接拖动预览改变壁纸重心，同时提供本地可读性保护。消息字体的常规、中等和加粗会呈现明确差异。我方与对方气泡样式可以互相复制，也可以分别上传本地 PNG、JPEG 或 WebP 对话框素材。",
    }),
    Object.freeze({
      title:"气泡细节与底部操作栏",
      body:"对话框素材支持完整显示与切片拉伸，整体大小最高可调整至 220%，并可设置边缘保留、文字留白和与头像中线对齐。颜色设置精简为取色器。底部回复输入框和操作按钮支持单独改色、圆角及安全自定义 CSS。上传图片后会显示尺寸、体积和透明边缘状态，并仅在确实能够减小体积时提供完全本地的压缩选项，不调用 API，也不会把图片发送给 AI。",
    }),
    Object.freeze({
      title:"美化操作更安心",
      body:"全部美化面板加入单步撤销、精确数值输入和分区恢复。按住预览可以临时查看修改前效果；没有修改时保存按钮会保持不可用，关闭未保存内容时会明确提醒。异常、过大或不支持的动态图片素材会被安全拦截，避免损坏当前美化设置。",
    }),
    Object.freeze({
      title:"作者端发布与保存流程",
      body:"发布前体检会遍历作品路线，问题项可通过“去修改”直接定位到作品信息、文章节点或手机应用中的对应位置；修复后可以返回并重新体检，检查通过后可直接导出加密作品。编辑器新增编辑中、保存中、已保存和保存失败状态。作品信息窗口加入未保存保护，全作品批量替换与时间调整支持撤销，导出和备份按钮也会显示明确的处理中状态。",
    }),
    Object.freeze({
      title:"全局交互与兼容说明",
      body:"弹窗统一支持 Escape、点击遮罩关闭、键盘焦点约束和关闭后焦点恢复；成功、失败、处理中和可撤销提示采用统一反馈样式，异步按钮执行期间会自动防止重复点击。作品身份与发布信息会随 JSON、PNG 和合集传输，并继续兼容旧作品、旧备份和历史阅读数据。本次更新不会主动清空作者作品、读者进度或现有本地设置；请继续定期导出备份。本公告在当前浏览器首次打开时显示一次。",
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
