const storyMarkup = () => `
  <section class="chapter-block">
    <div class="chapter-title"><span>第一章 · 雨夜相遇</span><small>3 节</small></div>
    <div class="node-list">
      ${nodeMarkup("opening", "开始", "起点 · 214 字", true)}
      ${nodeMarkup("shop", "便利店", "2 个选项 · 486 字")}
      ${nodeMarkup("rain", "雨中告白", "1 个选项 · 352 字")}
    </div>
  </section>
  <section class="chapter-block">
    <div class="chapter-title"><span>第二章 · 清晨</span><small>2 节</small></div>
    <div class="node-list">
      ${nodeMarkup("morning", "未读消息", "328 字")}
      ${nodeMarkup("reply", "回信", "结局 · 196 字")}
    </div>
  </section>`

function nodeMarkup(id, title, meta, current = false) {
  return `<div class="prototype-node${current ? " is-current" : ""}" data-node-id="${id}">
    <button type="button" class="drag-handle" aria-label="拖动节点「${title}」排序" title="按住拖动">⠿</button>
    <div class="node-copy"><strong>${title}</strong><small>${meta}</small></div>
    <button type="button" class="node-more" aria-label="${title}的更多操作">⋯</button>
  </div>`
}

const writingMarkup = () => `
  <div class="node-meta">
    <input aria-label="节点标题" value="开始">
    <select aria-label="所属章节"><option>第一章</option><option>第二章</option></select>
    <small>214 字</small>
  </div>
  <div class="writing-paper" contenteditable="true" role="textbox" aria-label="正文编辑区">
    <p>雨是在凌晨一点落下来的。</p>
    <p>便利店的灯隔着水汽，像一封迟迟没有寄出的信。</p>
  </div>`

function chapterCreator() {
  return `<div class="chapter-create" hidden>
    <input aria-label="新章节名称" placeholder="输入章节名称" maxlength="40">
    <button type="button" data-action="confirm-chapter" class="confirm">添加</button>
    <button type="button" data-action="cancel-chapter">取消</button>
  </div>`
}

function outlineMarkup(extraClass = "") {
  return `<div class="outline-head"><strong>作品结构</strong><button type="button" data-action="open-chapter">＋章节</button><button type="button" data-action="new-node">＋节点</button></div>
    ${chapterCreator()}
    <div class="outline-list ${extraClass}" data-chapter-list>${storyMarkup()}</div>`
}

function toolSheets() {
  return `<section class="tool-sheet" data-tool="insert" aria-label="插入内容" hidden>
      <div class="tool-sheet-head"><strong>插入内容</strong><button type="button" data-action="close-tool">完成</button></div>
      <div class="insert-grid"><button>占位符</button><button>选项跳转</button><button>图片</button><button>消息</button><button>论坛</button><button>备忘</button><button>相册</button><button>浏览器</button><button>购物</button></div>
    </section>
    <section class="tool-sheet" data-tool="format" aria-label="文字格式" hidden>
      <div class="tool-sheet-head"><strong>文字格式</strong><button type="button" data-action="close-tool">完成</button></div>
      <div class="format-grid"><button><b>B</b></button><button><i>I</i></button><button><u>U</u></button><button>左</button><button>中</button><button>右</button></div>
      <div class="format-fields"><label>字体<select><option>默认字体</option><option>宋体</option></select></label><label>字号<select><option>16 px</option><option>18 px</option></select></label><label>行距<select><option>1.9</option><option>2.2</option></select></label><label>页边距<select><option>舒适</option><option>紧凑</option></select></label></div>
    </section>`
}

function shellOne() {
  return `<article class="phone-shell shell-focus" data-variant="1" data-view-mode="swap">
    <header class="shell-topbar"><button class="back" aria-label="返回作品库">‹</button><div class="work-title"><strong>雨停之前</strong><small>已保存 · 本地作品</small></div><button class="top-action">预览</button></header>
    <main class="shell-scroll">
      <section class="view-pane" data-view="write">${writingMarkup()}</section>
      <section class="view-pane" data-view="outline" hidden>${outlineMarkup()}</section>
    </main>
    <nav class="focus-dock"><button data-action="view" data-target="write" aria-pressed="true">正文</button><button data-action="view" data-target="outline" aria-pressed="false">大纲</button><button data-action="tool" data-target="insert" aria-expanded="false">插入</button><button data-action="tool" data-target="format" aria-expanded="false">格式</button></nav>
    ${toolSheets()}
  </article>`
}

function shellTwo() {
  return `<article class="phone-shell shell-drawer" data-variant="2" data-view-mode="drawer">
    <header class="shell-topbar"><button class="back">‹</button><div class="work-title"><strong>开始</strong><small>第一章 · 214 字</small></div><button class="top-action" data-action="view" data-target="outline">结构</button></header>
    <div class="drawer-editor">
      <div class="format-strip"><button><b>B</b></button><button><i>I</i></button><button><u>U</u></button><button>左</button><button>中</button><button>右</button></div>
      <div class="shell-scroll">${writingMarkup()}</div>
    </div>
    <nav class="drawer-quickbar"><button data-action="view" data-target="outline">☰ 大纲</button><button class="primary" data-action="tool" data-target="insert">＋ 插入</button><button data-action="tool" data-target="format">Aa 格式</button></nav>
    <button class="drawer-scrim" data-action="close-view" aria-label="关闭大纲" hidden></button>
    <aside class="outline-drawer" data-overlay-view="outline">${outlineMarkup()}<button class="top-action" data-action="close-view">收起大纲</button></aside>
    ${toolSheets()}
  </article>`
}

function shellThree() {
  return `<article class="phone-shell shell-chapters" data-variant="3" data-view-mode="sheet">
    <header class="shell-topbar"><button class="back">‹</button><div class="work-title"><strong>雨停之前</strong><small>章节工作台</small></div><button class="top-action">预览</button></header>
    <nav class="chapter-ribbon"><button class="active">第一章</button><button>第二章</button><button data-action="open-structure">＋ 章节</button></nav>
    <main class="shell-scroll">${writingMarkup()}</main>
    <nav class="chapter-footer"><button data-action="view" data-target="outline">章节节点</button><button data-action="tool" data-target="insert">插入</button><button data-action="tool" data-target="format">格式</button></nav>
    <aside class="structure-tray" data-overlay-view="outline"><div class="tray-grip" aria-hidden="true"></div>${outlineMarkup()}<button class="top-action" data-action="close-view">完成排序</button></aside>
    ${toolSheets()}
  </article>`
}

function shellFour() {
  return `<article class="phone-shell shell-command" data-variant="4" data-view-mode="command">
    <header class="command-header"><button>‹</button><div class="breadcrumb"><strong>开始</strong><small>雨停之前 / 第一章</small></div><button>预览</button></header>
    <main class="shell-scroll">${writingMarkup()}</main>
    <nav class="command-bar"><button data-action="view" data-target="outline">结构</button><button class="command-plus" data-action="command" aria-expanded="false">＋</button><button data-action="tool" data-target="format">文字</button></nav>
    <section class="command-palette" data-command-palette hidden><div class="command-search"><input placeholder="输入命令或搜索功能" aria-label="命令搜索"></div><div class="command-options"><button data-action="new-node">新建节点</button><button data-action="open-chapter">新建章节</button><button data-action="tool" data-target="insert">插入内容</button><button data-action="tool" data-target="format">文字格式</button></div>${chapterCreator()}</section>
    <aside class="command-outline" data-overlay-view="outline"><header class="shell-topbar"><button data-action="close-view">‹</button><div class="work-title"><strong>作品结构</strong><small>按住 ⠿ 拖动排序</small></div><button data-action="open-chapter">＋章节</button></header>${chapterCreator()}<div class="outline-list" data-chapter-list>${storyMarkup()}</div></aside>
    ${toolSheets()}
  </article>`
}

function shellFive() {
  return `<article class="phone-shell shell-dual" data-variant="5" data-view-mode="swap">
    <header class="shell-topbar"><button class="back">‹</button><div class="work-title"><strong>雨停之前</strong><small>已保存</small></div><button class="top-action">预览</button></header>
    <nav class="dual-switch"><button data-action="view" data-target="write" aria-pressed="true">正文</button><button data-action="view" data-target="outline" aria-pressed="false">结构</button></nav>
    <main class="dual-main">
      <section class="view-pane shell-scroll" data-view="write">${writingMarkup()}</section>
      <section class="view-pane" data-view="outline" hidden>${outlineMarkup()}</section>
    </main>
    <footer class="dual-footer" data-context-footer="write"><button data-action="tool" data-target="format">Aa 格式</button><button data-action="tool" data-target="insert">＋ 插入</button><button class="primary">继续写作</button></footer>
    <footer class="dual-footer" data-context-footer="outline" hidden><button>设为起点</button><button data-action="open-chapter">＋章节</button><button class="primary" data-action="new-node">＋节点</button></footer>
    ${toolSheets()}
  </article>`
}

const variants = [shellOne(), shellTwo(), shellThree(), shellFour(), shellFive()]
const descriptions = {
  1:{title:"1 · 沉浸写作",summary:"把正文放在第一位，所有低频功能按需从底部展开。",facts:[["适合","长时间连续码字"],["大纲","整页切换"],["工具","底部上下文面板"]]},
  2:{title:"2 · 侧滑大纲",summary:"正文永远不离场，大纲像抽屉一样随看随收。",facts:[["适合","边写边频繁检查结构"],["大纲","左侧覆盖式抽屉"],["工具","常用格式常驻"]]},
  3:{title:"3 · 章节工作台",summary:"章节成为主要导航，节点结构从底部拉起。",facts:[["适合","章节多、节点多的作品"],["大纲","底部结构工作台"],["工具","随章节上下文变化"]]},
  4:{title:"4 · 命令中心",summary:"界面只保留两个入口，其余动作统一交给命令面板。",facts:[["适合","熟练作者、追求极简"],["大纲","独立全屏结构页"],["工具","集中式命令中心"]]},
  5:{title:"5 · 正文 / 结构双页",summary:"正文和结构是平级页面，底部操作会随页面切换。",facts:[["适合","希望逻辑最直白"],["大纲","一级结构页面"],["工具","上下文底栏"]]}
}

const mount = document.getElementById("prototypeMount")
mount.innerHTML = variants.join("")
let activeVariant = Number(location.hash.replace("#v", "")) || 1

function selectVariant(index) {
  activeVariant = Math.max(1, Math.min(5, Number(index) || 1))
  mount.querySelectorAll("[data-variant]").forEach(shell => { shell.hidden = Number(shell.dataset.variant) !== activeVariant })
  document.querySelectorAll("[data-select-variant]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.selectVariant) === activeVariant)))
  const info = descriptions[activeVariant]
  document.getElementById("variantTitle").textContent = info.title
  document.getElementById("variantSummary").textContent = info.summary
  document.getElementById("variantFacts").innerHTML = info.facts.map(([term,value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")
  history.replaceState(null, "", `#v${activeVariant}`)
}

function closeTools(shell) {
  shell.querySelectorAll("[data-tool]").forEach(panel => { panel.hidden = true })
  shell.querySelectorAll('[data-action="tool"]').forEach(button => button.setAttribute("aria-expanded", "false"))
}

function showToast(shell, message) {
  shell.querySelector(".drag-toast")?.remove()
  const toast = document.createElement("div")
  toast.className = "drag-toast"
  toast.textContent = message
  shell.append(toast)
  setTimeout(() => toast.remove(), 1200)
}

function openOverlay(shell, target) {
  const overlay = shell.querySelector(`[data-overlay-view="${target}"]`)
  if (!overlay) return
  overlay.classList.add("is-open")
  shell.querySelector(".drawer-scrim")?.removeAttribute("hidden")
}

function closeOverlay(shell) {
  shell.querySelectorAll("[data-overlay-view]").forEach(overlay => overlay.classList.remove("is-open"))
  shell.querySelector(".drawer-scrim")?.setAttribute("hidden", "")
}

function switchView(shell, target) {
  closeTools(shell)
  if (shell.dataset.viewMode !== "swap") {
    openOverlay(shell, target)
    return
  }
  shell.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== target })
  shell.querySelectorAll('[data-action="view"]').forEach(button => button.setAttribute("aria-pressed", String(button.dataset.target === target)))
  shell.querySelectorAll("[data-context-footer]").forEach(footer => { footer.hidden = footer.dataset.contextFooter !== target })
}

function openChapterCreator(scope) {
  const creator = scope.querySelector(".chapter-create")
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
  block.className = "chapter-block"
  block.innerHTML = `<div class="chapter-title"><span>${name}</span><small>0 节</small></div><div class="node-list"></div>`
  const list = creator.parentElement.querySelector("[data-chapter-list]") || shell.querySelector("[data-chapter-list]")
  list?.append(block)
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
  const action = button.dataset.action
  if (action === "view") switchView(shell, button.dataset.target)
  if (action === "close-view") closeOverlay(shell)
  if (action === "open-structure") { openOverlay(shell, "outline"); setTimeout(() => openChapterCreator(shell.querySelector('[data-overlay-view="outline"]')), 220) }
  if (action === "tool") {
    const panel = shell.querySelector(`[data-tool="${button.dataset.target}"]`)
    const shouldOpen = panel?.hidden
    closeTools(shell)
    closeOverlay(shell)
    if (panel && shouldOpen) { panel.hidden = false; button.setAttribute("aria-expanded", "true") }
  }
  if (action === "close-tool") closeTools(shell)
  if (action === "open-chapter") {
    const scope = button.closest("[data-overlay-view],.view-pane,.command-palette") || shell
    openChapterCreator(scope)
    button.closest(".command-palette")?.removeAttribute("hidden")
  }
  if (action === "confirm-chapter") confirmChapter(button)
  if (action === "cancel-chapter") button.closest(".chapter-create").hidden = true
  if (action === "new-node") showToast(shell, "原型：这里会直接新增节点")
  if (action === "command") {
    const palette = shell.querySelector("[data-command-palette]")
    palette.hidden = !palette.hidden
    button.setAttribute("aria-expanded", String(!palette.hidden))
  }
})

let dragState = null
document.addEventListener("pointerdown", event => {
  const handle = event.target.closest(".drag-handle")
  if (!handle || event.isPrimary === false) return
  const node = handle.closest(".prototype-node")
  dragState = {node, handle, target:null, after:false, pointerId:event.pointerId}
  try { handle.setPointerCapture?.(event.pointerId) } catch {}
  node.classList.add("dragging")
  event.preventDefault()
})

document.addEventListener("pointermove", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  document.querySelectorAll(".drop-before,.drop-after").forEach(node => node.classList.remove("drop-before","drop-after"))
  const underPointer = document.elementFromPoint(event.clientX,event.clientY)?.closest(".prototype-node")
  if (!underPointer || underPointer === dragState.node || !underPointer.closest(".phone-shell")?.contains(dragState.node)) return
  const rect = underPointer.getBoundingClientRect()
  dragState.target = underPointer
  dragState.after = event.clientY > rect.top + rect.height / 2
  underPointer.classList.add(dragState.after ? "drop-after" : "drop-before")
})

function finishDrag(event) {
  if (!dragState || (event.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return
  const {node,target,after,handle,pointerId} = dragState
  if (target) target.parentElement.insertBefore(node, after ? target.nextSibling : target)
  try { handle.releasePointerCapture?.(pointerId) } catch {}
  node.classList.remove("dragging")
  document.querySelectorAll(".drop-before,.drop-after").forEach(item => item.classList.remove("drop-before","drop-after"))
  if (target) showToast(node.closest(".phone-shell"), `已移动「${node.querySelector("strong").textContent}」`)
  dragState = null
}
document.addEventListener("pointerup", finishDrag)
document.addEventListener("pointercancel", finishDrag)
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return
  const shell = mount.querySelector(`[data-variant="${activeVariant}"]`)
  closeTools(shell); closeOverlay(shell)
  shell.querySelector("[data-command-palette]")?.setAttribute("hidden", "")
})

selectVariant(activeVariant)

const reviewQuery = new URLSearchParams(location.search)
if (reviewQuery.get("screen") === "outline") {
  requestAnimationFrame(() => {
    const shell = mount.querySelector(`[data-variant="${activeVariant}"]`)
    if (shell.dataset.viewMode === "swap") switchView(shell, "outline")
    else openOverlay(shell, "outline")
  })
}

if (reviewQuery.has("audit")) {
  requestAnimationFrame(() => {
    const audit = []
    for (let index = 1; index <= 5; index += 1) {
      selectVariant(index)
      const shell = mount.querySelector(`[data-variant="${index}"]`)
      if (shell.dataset.viewMode === "swap") switchView(shell, "outline")
      else openOverlay(shell, "outline")
      const visibleOutline = [...shell.querySelectorAll('[data-view="outline"],[data-overlay-view="outline"]')].find(element => !element.hidden && getComputedStyle(element).display !== "none")
      const handles = [...visibleOutline.querySelectorAll(".drag-handle")]
      let pointerDragReordered = null
      if (index === 1 && handles.length >= 2) {
        const first = handles[0].closest(".prototype-node")
        const second = handles[1].closest(".prototype-node")
        const handleRect = handles[0].getBoundingClientRect()
        const targetRect = second.getBoundingClientRect()
        const beforeOrder = [...first.parentElement.children].map(node => node.dataset.nodeId).join(",")
        handles[0].dispatchEvent(new PointerEvent("pointerdown", {bubbles:true,pointerId:91,isPrimary:true,button:0,clientX:handleRect.left + 8,clientY:handleRect.top + 8}))
        document.dispatchEvent(new PointerEvent("pointermove", {bubbles:true,pointerId:91,isPrimary:true,clientX:targetRect.left + targetRect.width / 2,clientY:targetRect.bottom - 4}))
        document.dispatchEvent(new PointerEvent("pointerup", {bubbles:true,pointerId:91,isPrimary:true,button:0,clientX:targetRect.left + targetRect.width / 2,clientY:targetRect.bottom - 4}))
        const afterOrder = [...first.parentElement.children].map(node => node.dataset.nodeId).join(",")
        pointerDragReordered = beforeOrder !== afterOrder
      }
      const openChapter = [...visibleOutline.querySelectorAll('[data-action="open-chapter"]')].find(button => button.offsetParent)
      openChapter?.click()
      const creator = [...visibleOutline.querySelectorAll(".chapter-create")].find(element => !element.hidden)
      const input = creator?.querySelector("input")
      if (input) input.value = `测试章节 ${index}`
      creator?.querySelector('[data-action="confirm-chapter"]')?.click()
      audit.push({
        variant:index,
        noHorizontalOverflow:shell.scrollWidth <= shell.clientWidth,
        visibleDragHandles:handles.length,
        dragTargetAtLeast44:handles.every(handle => handle.getBoundingClientRect().width >= 44 && handle.getBoundingClientRect().height >= 44),
        pointerDragReordered,
        inlineChapterCreated:[...visibleOutline.querySelectorAll(".chapter-title span:first-child")].some(label => label.textContent === `测试章节 ${index}`)
      })
      closeOverlay(shell)
    }
    selectVariant(activeVariant)
    const output = document.createElement("output")
    output.id = "prototypeAudit"
    output.hidden = true
    output.textContent = JSON.stringify(audit)
    document.body.append(output)
  })
}
