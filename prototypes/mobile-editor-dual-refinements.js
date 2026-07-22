const data = {
  chapters: [
    { title: "第一章 · 雨夜相遇", nodes: [
      ["opening", "开始", "起点 · 214 字", true],
      ["shop", "便利店", "2 个选项 · 486 字"],
      ["rain", "雨中告白", "1 个选项 · 352 字"]
    ]},
    { title: "第二章 · 清晨", nodes: [
      ["morning", "未读消息", "328 字"],
      ["reply", "回信", "结局 · 196 字"]
    ]}
  ]
}

function nodeMarkup([id, title, meta, current = false]) {
  return `<div class="node-row${current ? " is-current" : ""}" data-node-id="${id}">
    <button type="button" class="drag-handle" aria-label="拖动节点「${title}」排序" title="按住拖动"></button>
    <div class="node-copy"><strong>${title}</strong><span>${meta}</span></div>
    <button type="button" class="node-more" aria-label="${title}的更多操作">⋯</button>
  </div>`
}

function chapterMarkup(chapter, index) {
  return `<section class="chapter-group" data-chapter-index="${index}">
    <div class="chapter-heading"><strong>${chapter.title}</strong><span>${chapter.nodes.length} 节</span></div>
    <div class="node-list">${chapter.nodes.map(nodeMarkup).join("")}</div>
  </section>`
}

const fullOutlineMarkup = (extraClass = "") => `<div class="outline-scroll ${extraClass}" data-chapter-list>${data.chapters.map(chapterMarkup).join("")}</div>`

const focusedOutlineMarkup = () => `<div class="outline-scroll focused-chapter" data-chapter-list>
  ${chapterMarkup(data.chapters[0], 0)}
  <div class="collapsed-chapters"><button type="button">第二章 · 清晨　2 节　›</button><button type="button">查看全部章节　›</button></div>
</div>`

const chapterCreator = () => `<div class="chapter-create" hidden>
  <input aria-label="新章节名称" placeholder="输入章节名称" maxlength="40">
  <button type="button" class="confirm" data-action="confirm-chapter">添加</button>
  <button type="button" data-action="cancel-chapter">取消</button>
</div>`

const editorMarkup = () => `<section class="page-view" data-page="write">
  <div class="editor-context"><input aria-label="节点标题" value="开始"><span>214 字</span></div>
  <div class="writing-paper" contenteditable="true" role="textbox" aria-label="正文编辑区">
    <p>雨是在凌晨一点落下来的。</p>
    <p>便利店的灯隔着水汽，像一封迟迟没有寄出的信。</p>
  </div>
</section>`

function structureMarkup({extraClass = "", focused = false} = {}) {
  return `<section class="page-view" data-page="structure" hidden>
    <div class="structure-head"><strong>作品结构</strong><button type="button" data-action="open-chapter">＋ 章节</button><button type="button" data-action="new-node">＋ 节点</button></div>
    ${chapterCreator()}
    ${focused ? focusedOutlineMarkup() : fullOutlineMarkup(extraClass)}
  </section>`
}

const pageTabs = (extra = "") => `<nav class="page-tabs" aria-label="编辑器页面">
  <button type="button" class="page-button" data-action="page" data-target="write" aria-pressed="true">正文</button>
  <button type="button" class="page-button" data-action="page" data-target="structure" aria-pressed="false">结构</button>
  ${extra}
</nav>`

const appBar = (subtitle = "已保存") => `<header class="app-bar">
  <button type="button" class="hit-icon" aria-label="返回作品库"><span>‹</span></button>
  <div class="app-title"><strong>雨停之前</strong><span>${subtitle}</span></div>
  <button type="button" class="app-preview">预览</button>
</header>`

const tools = () => `<section class="tool-sheet" data-tool="insert" hidden>
    <div class="tool-head"><strong>插入内容</strong><button type="button" data-action="close-tool">完成</button></div>
    <div class="insert-grid"><button>占位符</button><button>选项跳转</button><button>图片</button><button>消息</button><button>论坛</button><button>备忘</button><button>相册</button><button>浏览器</button><button>购物</button></div>
  </section>
  <section class="tool-sheet" data-tool="format" hidden>
    <div class="tool-head"><strong>文字格式</strong><button type="button" data-action="close-tool">完成</button></div>
    <div class="format-row"><button><b>B</b></button><button><i>I</i></button><button><u>U</u></button><button>左</button><button>中</button><button>右</button></div>
  </section>`

const writeBar = () => `<footer class="context-bar" data-context="write">
  <button type="button" data-action="tool" data-target="format"><span>Aa</span></button>
  <button type="button" data-action="tool" data-target="insert"><span>＋</span></button>
  <button type="button"><span>↶</span></button><button type="button"><span>↷</span></button>
  <button type="button" class="context-label"><span>已保存</span></button>
</footer>`

function shellA() {
  return `<article class="phone-shell shell-a" data-variant="1">
    ${appBar()}${pageTabs('<span class="page-spacer"></span><span class="quiet-stat">第一章</span>')}
    <main class="dual-main">${editorMarkup()}${structureMarkup()}</main>${writeBar()}${tools()}
  </article>`
}

function shellB() {
  return `<article class="phone-shell shell-b" data-variant="2">
    ${appBar("开始 · 第一章")}
    <main class="dual-main">${editorMarkup()}${structureMarkup()}</main>
    <nav class="bottom-deck" aria-label="页面与工具">
      <button type="button" class="page-button" data-action="page" data-target="write" aria-pressed="true">正文</button>
      <button type="button" class="page-button" data-action="page" data-target="structure" aria-pressed="false">结构</button>
      <button type="button" class="mini-action" data-action="tool" data-target="format">Aa</button>
      <button type="button" class="mini-action" data-action="tool" data-target="insert">＋</button>
    </nav>${tools()}
  </article>`
}

function shellC() {
  return `<article class="phone-shell shell-c" data-variant="3">
    ${appBar()}${pageTabs()}
    <main class="dual-main">${editorMarkup()}<section class="page-view" data-page="structure" hidden>
      <div class="structure-head"><strong>章节与节点</strong><button type="button" data-action="open-chapter">＋ 章节</button><button type="button" data-action="new-node">＋ 节点</button></div>
      ${chapterCreator()}
      <nav class="chapter-index" aria-label="章节索引"><button class="active">第一章</button><button>第二章</button><button>＋ 新章</button></nav>
      ${focusedOutlineMarkup()}
    </section></main>${writeBar()}${tools()}
  </article>`
}

function shellD() {
  return `<article class="phone-shell shell-d" data-variant="4">
    ${appBar()}${pageTabs('<span class="page-spacer"></span><span class="quiet-stat">5 个节点</span>')}
    <main class="dual-main">${editorMarkup()}${structureMarkup({extraClass:"tree-list"})}</main>${writeBar()}${tools()}
  </article>`
}

function shellE() {
  return `<article class="phone-shell shell-e" data-variant="5">
    <header class="app-bar"><button type="button" class="hit-icon" aria-label="返回作品库"><span>‹</span></button><div class="app-title"><strong>开始</strong><span>雨停之前 / 第一章</span></div><button type="button" class="hit-icon" aria-label="预览"><span>⌁</span></button></header>
    <nav class="integrated-bar" aria-label="页面与工具">
      <button type="button" class="page-button" data-action="page" data-target="write" aria-pressed="true">正文</button>
      <button type="button" class="page-button" data-action="page" data-target="structure" aria-pressed="false">结构</button>
      <span></span>
      <button type="button" class="tool-button" data-action="tool" data-target="format">Aa</button>
      <button type="button" class="tool-button" data-action="tool" data-target="insert">＋</button>
    </nav>
    <main class="dual-main">${editorMarkup()}${structureMarkup()}</main>${tools()}
  </article>`
}

const descriptions = {
  1:{title:"5A · 顶部线签",summary:"正文与结构保持一级关系，用文字和细线区分，不再画成两个大按钮。",facts:[["层级","线签 > 节点 > 工具"],["结构","全章节平铺"],["气质","稳妥、直白"]]},
  2:{title:"5B · 底部切页",summary:"顶部只显示作品上下文，正文与结构固定在拇指最容易触达的底部。",facts:[["层级","内容 > 底部页签"],["结构","全章节平铺"],["气质","更像移动 App"]]},
  3:{title:"5C · 章节索引",summary:"结构页先选章节，再处理本章节点，长篇作品不会堆成一条很长的列表。",facts:[["层级","章节 > 节点"],["结构","单章聚焦"],["气质","适合长篇"]]},
  4:{title:"5D · 紧凑目录树",summary:"不用章节卡片，用缩进和引导线表达层级，同屏能看到更多节点。",facts:[["层级","树线 + 缩进"],["结构","全局目录树"],["气质","最高密度"]]},
  5:{title:"5E · 编辑器原生感",summary:"页签和格式工具合成一条轻工具栏，正文区最干净，操作最接近原生编辑器。",facts:[["层级","工作标题 > 轻工具栏"],["结构","紧凑分组"],["气质","小巧、克制"]]}
}

const mount = document.getElementById("prototypeMount")
mount.innerHTML = [shellA(), shellB(), shellC(), shellD(), shellE()].join("")
let activeVariant = Number(location.hash.replace("#v", "")) || 1

function selectVariant(index) {
  activeVariant = Math.max(1, Math.min(5, Number(index) || 1))
  mount.querySelectorAll("[data-variant]").forEach(shell => { shell.hidden = Number(shell.dataset.variant) !== activeVariant })
  document.querySelectorAll("[data-select-variant]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.selectVariant) === activeVariant)))
  const info = descriptions[activeVariant]
  document.getElementById("variantTitle").textContent = info.title
  document.getElementById("variantSummary").textContent = info.summary
  document.getElementById("variantFacts").innerHTML = info.facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")
  history.replaceState(null, "", `${location.pathname}${location.search}#v${activeVariant}`)
}

function currentShell() { return mount.querySelector(`[data-variant="${activeVariant}"]`) }

function closeTools(shell) {
  shell.querySelectorAll("[data-tool]").forEach(tool => { tool.hidden = true })
}

function switchPage(shell, target) {
  closeTools(shell)
  shell.querySelectorAll("[data-page]").forEach(page => { page.hidden = page.dataset.page !== target })
  shell.querySelectorAll('[data-action="page"]').forEach(button => button.setAttribute("aria-pressed", String(button.dataset.target === target)))
  shell.querySelectorAll("[data-context]").forEach(bar => { bar.hidden = bar.dataset.context !== target })
}

function showToast(shell, message) {
  shell.querySelector(".toast")?.remove()
  const toast = document.createElement("div")
  toast.className = "toast"
  toast.textContent = message
  shell.append(toast)
  setTimeout(() => toast.remove(), 1200)
}

function openChapterCreator(button) {
  const page = button.closest('[data-page="structure"]')
  const creator = page?.querySelector(".chapter-create")
  if (!creator) return
  creator.hidden = false
  creator.querySelector("input")?.focus()
}

function confirmChapter(button) {
  const shell = button.closest(".phone-shell")
  const creator = button.closest(".chapter-create")
  const input = creator?.querySelector("input")
  const name = input?.value.trim()
  if (!name) { input?.focus(); return }
  const block = document.createElement("section")
  block.className = "chapter-group"
  block.innerHTML = `<div class="chapter-heading"><strong>${name}</strong><span>0 节</span></div><div class="node-list"></div>`
  creator.parentElement.querySelector("[data-chapter-list]")?.append(block)
  input.value = ""
  creator.hidden = true
  showToast(shell, `已添加「${name}」`)
}

document.addEventListener("click", event => {
  const variantButton = event.target.closest("[data-select-variant]")
  if (variantButton) { selectVariant(variantButton.dataset.selectVariant); return }
  const widthButton = event.target.closest("[data-preview-width]")
  if (widthButton) {
    document.getElementById("phoneViewport").style.setProperty("--preview-width", `${widthButton.dataset.previewWidth}px`)
    document.querySelectorAll("[data-preview-width]").forEach(button => button.setAttribute("aria-pressed", String(button === widthButton)))
    return
  }
  const button = event.target.closest("[data-action]")
  if (!button) return
  const shell = button.closest(".phone-shell")
  if (button.dataset.action === "page") switchPage(shell, button.dataset.target)
  if (button.dataset.action === "tool") {
    const tool = shell.querySelector(`[data-tool="${button.dataset.target}"]`)
    const shouldOpen = tool?.hidden
    closeTools(shell)
    if (tool && shouldOpen) tool.hidden = false
  }
  if (button.dataset.action === "close-tool") closeTools(shell)
  if (button.dataset.action === "open-chapter") openChapterCreator(button)
  if (button.dataset.action === "confirm-chapter") confirmChapter(button)
  if (button.dataset.action === "cancel-chapter") button.closest(".chapter-create").hidden = true
  if (button.dataset.action === "new-node") showToast(shell, "原型：这里会直接新增节点")
})

let dragState = null
document.addEventListener("pointerdown", event => {
  const handle = event.target.closest(".drag-handle")
  if (!handle || event.isPrimary === false) return
  const node = handle.closest(".node-row")
  dragState = {node, handle, target:null, after:false, pointerId:event.pointerId}
  try { handle.setPointerCapture?.(event.pointerId) } catch {}
  node.classList.add("dragging")
  event.preventDefault()
})

document.addEventListener("pointermove", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  document.querySelectorAll(".drop-before,.drop-after").forEach(node => node.classList.remove("drop-before", "drop-after"))
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".node-row")
  if (!target || target === dragState.node || target.closest(".phone-shell") !== dragState.node.closest(".phone-shell")) return
  const rect = target.getBoundingClientRect()
  dragState.target = target
  dragState.after = event.clientY > rect.top + rect.height / 2
  target.classList.add(dragState.after ? "drop-after" : "drop-before")
})

function finishDrag(event) {
  if (!dragState || (event.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return
  const {node, target, after, handle, pointerId} = dragState
  if (target) target.parentElement.insertBefore(node, after ? target.nextSibling : target)
  try { handle.releasePointerCapture?.(pointerId) } catch {}
  node.classList.remove("dragging")
  document.querySelectorAll(".drop-before,.drop-after").forEach(item => item.classList.remove("drop-before", "drop-after"))
  if (target) showToast(node.closest(".phone-shell"), `已移动「${node.querySelector("strong").textContent}」`)
  dragState = null
}
document.addEventListener("pointerup", finishDrag)
document.addEventListener("pointercancel", finishDrag)
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return
  closeTools(currentShell())
  currentShell().querySelectorAll(".chapter-create").forEach(creator => { creator.hidden = true })
})

selectVariant(activeVariant)
const query = new URLSearchParams(location.search)
if (["320", "390"].includes(query.get("width"))) {
  document.getElementById("phoneViewport").style.setProperty("--preview-width", `${query.get("width")}px`)
}
if (query.get("screen") === "structure") requestAnimationFrame(() => switchPage(currentShell(), "structure"))

if (query.has("audit")) {
  requestAnimationFrame(() => {
    const audit = []
    for (let index = 1; index <= 5; index += 1) {
      selectVariant(index)
      const shell = currentShell()
      switchPage(shell, "structure")
      const handles = [...shell.querySelectorAll('.node-row:not([hidden]) .drag-handle')].filter(handle => handle.offsetParent)
      let pointerDragReordered = null
      if (index === 1 && handles.length >= 2) {
        const first = handles[0].closest(".node-row")
        const second = handles[1].closest(".node-row")
        const handleRect = handles[0].getBoundingClientRect()
        const targetRect = second.getBoundingClientRect()
        const before = [...first.parentElement.children].map(node => node.dataset.nodeId).join(",")
        handles[0].dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, pointerId:77, isPrimary:true, button:0, clientX:handleRect.left + 8, clientY:handleRect.top + 8}))
        document.dispatchEvent(new PointerEvent("pointermove", {bubbles:true, pointerId:77, isPrimary:true, clientX:targetRect.left + 20, clientY:targetRect.bottom - 3}))
        document.dispatchEvent(new PointerEvent("pointerup", {bubbles:true, pointerId:77, isPrimary:true, button:0, clientX:targetRect.left + 20, clientY:targetRect.bottom - 3}))
        const after = [...first.parentElement.children].map(node => node.dataset.nodeId).join(",")
        pointerDragReordered = before !== after
      }
      const addChapter = [...shell.querySelectorAll('[data-action="open-chapter"]')].find(button => button.offsetParent)
      addChapter?.click()
      const creator = [...shell.querySelectorAll(".chapter-create")].find(item => !item.hidden)
      const input = creator?.querySelector("input")
      if (input) input.value = `测试章节 ${index}`
      creator?.querySelector('[data-action="confirm-chapter"]')?.click()
      audit.push({
        variant:index,
        noHorizontalOverflow:shell.scrollWidth <= shell.clientWidth,
        visibleDragHandles:handles.length,
        dragTargetAtLeast44:handles.every(handle => handle.getBoundingClientRect().width >= 44 && handle.getBoundingClientRect().height >= 44),
        pointerDragReordered,
        inlineChapterCreated:[...shell.querySelectorAll(".chapter-heading strong")].some(label => label.textContent === `测试章节 ${index}`)
      })
    }
    selectVariant(activeVariant)
    const output = document.createElement("output")
    output.id = "prototypeAudit"
    output.hidden = true
    output.textContent = JSON.stringify(audit)
    document.body.append(output)
  })
}
