import {
  createWorkCollection,
  deleteWorkCollection,
  encodeSteganoPNG,
  exportWorkCollectionAsJSON,
  getWorkCollections,
  getWorks,
  updateWorkCollection,
} from "../data.js"
import { modal, showToast } from "../app.js"
import { downloadBlob } from "../download.js"
import { compressEditorImage } from "../image-compression.js"

export const COLLECTION_LONG_PRESS_MS = 550
export const COLLECTION_LONG_PRESS_MOVE_PX = 10

const selectedWorkIds = new Set()
let selectionActive = false
let activePress = null
let suppressCardClickUntil = 0
let refreshShelf = () => {}

function esc(value) {
  const node = document.createElement("div")
  node.textContent = String(value ?? "")
  return node.innerHTML
}

function attr(value) {
  return esc(value).replace(/"/g, "&quot;")
}

function safeFilename(value) {
  return String(value || "作品集").replace(/[\\/:*?"<>|]/g, "-").trim() || "作品集"
}

export function longPressMovedBeyondThreshold(startX, startY, x, y, threshold = COLLECTION_LONG_PRESS_MOVE_PX) {
  return Math.hypot(Number(x) - Number(startX), Number(y) - Number(startY)) > threshold
}

export function renderCollectionCards(collections, works) {
  const byId = new Map((works || []).map(work => [work.id, work]))
  return (collections || []).map(collection => {
    const count = (collection.workIds || []).filter(id => byId.has(id)).length
    const cover = collection.coverImage
      ? `<img class="work-collection-cover-image" src="${attr(collection.coverImage)}" alt="">`
      : `<span class="work-collection-stack" aria-hidden="true"><i></i><i></i><i></i></span>`
    return `<div class="card work-card work-card-collection" data-collection-id="${attr(collection.id)}">
      <div class="work-collection-cover">${cover}</div>
      <div class="work-card-body">
        <div class="work-card-title">${esc(collection.title)}</div>
        <div class="work-card-desc">${esc(collection.description || "暂无作品集简介")}</div>
        <div class="work-card-meta"><span>作品集</span>${collection.author ? `<span>${esc(collection.author)}</span>` : ""}<span>${count} 篇</span><span>${collection.accessMode === "unified" ? "统一进入" : "各篇独立"}</span></div>
      </div>
      <div class="work-card-actions work-collection-actions">
        <button type="button" class="btn btn-sm btn-primary" data-collection-manage="${attr(collection.id)}">管理</button>
        <div class="work-card-more-wrap">
          <button type="button" class="btn btn-sm btn-ghost work-card-more-btn" data-collection-menu="${attr(collection.id)}" aria-expanded="false">更多</button>
          <div class="work-card-more-popover" data-collection-popover="${attr(collection.id)}">
            <button type="button" class="btn btn-sm btn-ghost" data-collection-manage="${attr(collection.id)}">作品集信息</button>
            <button type="button" class="btn btn-sm btn-ghost" data-collection-export-json="${attr(collection.id)}">导出 JSON</button>
            <button type="button" class="btn btn-sm btn-ghost" data-collection-export-png="${attr(collection.id)}">导出 PNG</button>
            <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-collection-delete="${attr(collection.id)}">删除作品集</button>
          </div>
        </div>
      </div>
    </div>`
  }).join("")
}

export function renderCollectionSelectionBar() {
  return `<div class="collection-selection-bar" id="collectionSelectionBar" hidden>
    <span id="collectionSelectionCount" role="status" aria-live="polite">已选择 0 篇</span>
    <div class="collection-selection-actions">
      <button type="button" class="btn btn-sm btn-ghost" data-collection-cancel>取消</button>
      <button type="button" class="btn btn-sm btn-primary" data-collection-create disabled>创建作品集</button>
    </div>
  </div>`
}

export function renderWorkSelectionControl(work) {
  return `<button type="button" class="work-card-select" data-collection-select="${attr(work.id)}" aria-label="选择作品《${attr(work.title || "无标题作品")}》" aria-pressed="false"><span aria-hidden="true">✓</span></button>`
}

function syncSelectionUi() {
  document.documentElement.classList.toggle("collection-selection-active", selectionActive)
  document.querySelectorAll(".work-card[data-id]").forEach(card => {
    const selected = selectedWorkIds.has(card.dataset.id)
    card.classList.toggle("collection-selected", selected)
    card.querySelector("[data-collection-select]")?.setAttribute("aria-pressed", selected ? "true" : "false")
  })
  const bar = document.getElementById("collectionSelectionBar")
  const count = document.getElementById("collectionSelectionCount")
  const create = document.querySelector("[data-collection-create]")
  if (bar) bar.hidden = !selectionActive
  if (count) count.textContent = `已选择 ${selectedWorkIds.size} 篇`
  if (create) create.disabled = selectedWorkIds.size < 2
}

function clearPress() {
  if (activePress?.timer) clearTimeout(activePress.timer)
  activePress = null
}

function enterSelection(workId) {
  selectionActive = true
  selectedWorkIds.add(workId)
  syncSelectionUi()
}

function toggleSelection(workId) {
  if (!selectionActive) selectionActive = true
  if (selectedWorkIds.has(workId)) selectedWorkIds.delete(workId)
  else selectedWorkIds.add(workId)
  if (selectedWorkIds.size === 0) selectionActive = false
  syncSelectionUi()
}

export function resetCollectionSelection() {
  clearPress()
  selectedWorkIds.clear()
  selectionActive = false
  syncSelectionUi()
}

function commonAuthor(works) {
  const authors = [...new Set(works.map(work => String(work.author || "").trim()).filter(Boolean))]
  return authors.length === 1 ? authors[0] : ""
}

function openCollectionEditor(collection = null, initialWorkIds = []) {
  const works = getWorks()
  const byId = new Map(works.map(work => [work.id, work]))
  let memberIds = [...new Set((collection?.workIds || initialWorkIds).filter(id => byId.has(id)))]
  let coverImage = collection?.coverImage || ""
  const isCreate = !collection
  const body = `<div class="collection-editor">
    <label class="wi-row"><span class="wi-label">作品集名称</span><input class="wi-input" id="collectionTitle" maxlength="120" value="${attr(collection?.title || "新作品集")}"></label>
    <label class="wi-row"><span class="wi-label">作者署名</span><input class="wi-input" id="collectionAuthor" maxlength="120" value="${attr(collection?.author || commonAuthor(memberIds.map(id => byId.get(id))))}"></label>
    <label class="wi-row"><span class="wi-label">作品集简介</span><textarea class="wi-textarea" id="collectionDescription" rows="3" maxlength="1200">${esc(collection?.description || "")}</textarea></label>
    <label class="wi-row"><span class="wi-label">作者有话说</span><textarea class="wi-textarea" id="collectionAuthorNote" rows="3" maxlength="1200">${esc(collection?.authorNote || "")}</textarea></label>
    <div class="wi-row"><span class="wi-label">作品集封面</span><label class="btn btn-sm btn-outline collection-cover-picker">选择图片<input id="collectionCoverFile" type="file" accept="image/*"></label><button type="button" class="btn btn-sm btn-ghost" id="collectionCoverClear">清除封面</button><span id="collectionCoverStatus" class="collection-cover-status">${coverImage ? "已选择封面" : "未选择"}</span></div>
    <fieldset class="collection-access-fieldset"><legend>进入方式</legend>
      <label><input type="radio" name="collectionAccess" value="separate" ${collection?.accessMode !== "unified" ? "checked" : ""}> 各篇独立：保留每篇作品自己的信息、密码和占位符</label>
      <label><input type="radio" name="collectionAccess" value="unified" ${collection?.accessMode === "unified" ? "checked" : ""}> 作品集统一：进入作品集时填写一次</label>
    </fieldset>
    <label class="wi-row" id="collectionPasswordRow"><span class="wi-label">作品集密码</span><input class="wi-input" id="collectionPassword" maxlength="200" value="${attr(collection?.password || "")}" placeholder="可留空"></label>
    <section class="collection-member-editor" aria-labelledby="collectionMemberHeading"><div class="collection-member-heading"><strong id="collectionMemberHeading">收录作品</strong><span id="collectionMemberCount"></span></div><div id="collectionMemberList"></div>
      <div class="collection-member-add"><select class="form-select" id="collectionAddWork" aria-label="选择要加入的作品"></select><button type="button" class="btn btn-sm btn-outline" id="collectionAddWorkButton">加入</button></div>
    </section>
    <div class="collection-editor-status" id="collectionEditorStatus" role="alert"></div>
  </div>`
  const overlay = modal(isCreate ? "创建作品集" : "作品集信息", body,
    `<button type="button" class="btn btn-primary" id="collectionSave">保存</button><button type="button" class="btn btn-ghost" id="collectionCancel">取消</button>`)
  const list = overlay.querySelector("#collectionMemberList")
  const addSelect = overlay.querySelector("#collectionAddWork")
  const status = overlay.querySelector("#collectionEditorStatus")

  function renderMembers() {
    overlay.querySelector("#collectionMemberCount").textContent = `${memberIds.length} 篇`
    list.innerHTML = memberIds.map((id, index) => {
      const work = byId.get(id)
      return `<div class="collection-member-row" data-member-id="${attr(id)}"><span><strong>${esc(work?.title || "已删除作品")}</strong><small>${work?.type === "phone" ? "小手机" : "互动文章"}</small></span><div><button type="button" aria-label="上移" data-member-up="${index}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" aria-label="下移" data-member-down="${index}" ${index === memberIds.length - 1 ? "disabled" : ""}>↓</button><button type="button" aria-label="移除" data-member-remove="${index}">×</button></div></div>`
    }).join("")
    const available = works.filter(work => !memberIds.includes(work.id))
    addSelect.innerHTML = available.length
      ? available.map(work => `<option value="${attr(work.id)}">${esc(work.title || "无标题作品")}</option>`).join("")
      : `<option value="">没有其他作品</option>`
    overlay.querySelector("#collectionAddWorkButton").disabled = available.length === 0
  }

  function syncAccess() {
    const unified = overlay.querySelector('input[name="collectionAccess"]:checked')?.value === "unified"
    overlay.querySelector("#collectionPasswordRow").hidden = !unified
  }

  list.addEventListener("click", event => {
    const up = event.target.closest("[data-member-up]")
    const down = event.target.closest("[data-member-down]")
    const remove = event.target.closest("[data-member-remove]")
    if (up) {
      const index = Number(up.dataset.memberUp)
      ;[memberIds[index - 1], memberIds[index]] = [memberIds[index], memberIds[index - 1]]
    } else if (down) {
      const index = Number(down.dataset.memberDown)
      ;[memberIds[index + 1], memberIds[index]] = [memberIds[index], memberIds[index + 1]]
    } else if (remove) memberIds.splice(Number(remove.dataset.memberRemove), 1)
    else return
    renderMembers()
  })
  overlay.querySelector("#collectionAddWorkButton").onclick = () => {
    if (addSelect.value && !memberIds.includes(addSelect.value)) memberIds.push(addSelect.value)
    renderMembers()
  }
  overlay.querySelectorAll('input[name="collectionAccess"]').forEach(input => input.onchange = syncAccess)
  overlay.querySelector("#collectionCoverFile").onchange = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    const coverStatus = overlay.querySelector("#collectionCoverStatus")
    coverStatus.textContent = "正在处理…"
    try {
      const result = await compressEditorImage(file)
      coverImage = result.dataUrl
      overlay.querySelector("#collectionCoverStatus").textContent = coverImage ? "已选择封面" : "未选择"
    } catch (error) {
      coverStatus.textContent = error instanceof Error ? error.message : "无法处理封面"
    }
  }
  overlay.querySelector("#collectionCoverClear").onclick = () => {
    coverImage = ""
    overlay.querySelector("#collectionCoverStatus").textContent = "未选择"
  }
  overlay.querySelector("#collectionCancel").onclick = () => overlay.remove()
  overlay.querySelector("#collectionSave").onclick = () => {
    const accessMode = overlay.querySelector('input[name="collectionAccess"]:checked')?.value === "unified" ? "unified" : "separate"
    try {
      if (memberIds.length < 2) throw new TypeError("作品集至少需要两篇作品")
      const payload = {
        title: overlay.querySelector("#collectionTitle").value,
        author: overlay.querySelector("#collectionAuthor").value,
        description: overlay.querySelector("#collectionDescription").value,
        authorNote: overlay.querySelector("#collectionAuthorNote").value,
        coverImage,
        accessMode,
        password: accessMode === "unified" ? overlay.querySelector("#collectionPassword").value : "",
        workIds: memberIds,
      }
      if (collection) updateWorkCollection(collection.id, payload)
      else createWorkCollection(payload)
      overlay.remove()
      resetCollectionSelection()
      refreshShelf()
      showToast(collection ? "作品集已更新" : "作品集已创建", "success")
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "无法保存作品集"
    }
  }
  renderMembers()
  syncAccess()
}

function closeCollectionMenus(exceptId = "") {
  document.querySelectorAll("[data-collection-popover]").forEach(popover => {
    popover.classList.toggle("open", Boolean(exceptId) && popover.dataset.collectionPopover === exceptId)
  })
  document.querySelectorAll("[data-collection-menu]").forEach(button => {
    button.setAttribute("aria-expanded", button.dataset.collectionMenu === exceptId ? "true" : "false")
  })
}

function downloadCollectionJson(id) {
  const collection = getWorkCollections().find(candidate => candidate.id === id)
  const json = exportWorkCollectionAsJSON(id)
  if (!collection || !json) throw new TypeError("作品集不存在")
  downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${safeFilename(collection.title)}.tuuru.json`)
  showToast("作品集 JSON 已导出", "success")
}

function downloadCollectionPng(id) {
  const collection = getWorkCollections().find(candidate => candidate.id === id)
  const json = exportWorkCollectionAsJSON(id)
  if (!collection || !json) throw new TypeError("作品集不存在")
  encodeSteganoPNG(json, collection.coverImage || "", dataUrl => {
    const anchor = document.createElement("a")
    anchor.href = dataUrl
    anchor.download = `${safeFilename(collection.title)}.png`
    anchor.click()
    showToast("作品集 PNG 已导出", "success")
  }, error => alert(`PNG 导出失败：${error instanceof Error ? error.message : "请改用 JSON"}`))
}

export function bindCollectionShelf({ refresh } = {}) {
  refreshShelf = typeof refresh === "function" ? refresh : refreshShelf
  const list = document.getElementById("workList")
  if (!list || list.dataset.collectionBound === "true") return
  list.dataset.collectionBound = "true"

  list.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || event.button !== 0 || event.target.closest("button,a,input,textarea,select")) return
    const card = event.target.closest(".work-card[data-id]")
    if (!card) return
    clearPress()
    activePress = {
      pointerId: event.pointerId,
      workId: card.dataset.id,
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        const workId = activePress?.workId
        if (!workId) return
        suppressCardClickUntil = Date.now() + 650
        enterSelection(workId)
        globalThis.navigator?.vibrate?.(18)
        clearPress()
      }, COLLECTION_LONG_PRESS_MS),
    }
  })
  list.addEventListener("pointermove", event => {
    if (!activePress || event.pointerId !== activePress.pointerId) return
    if (longPressMovedBeyondThreshold(activePress.x, activePress.y, event.clientX, event.clientY)) clearPress()
  })
  ;["pointerup", "pointercancel", "lostpointercapture"].forEach(type => list.addEventListener(type, clearPress))
  list.addEventListener("contextmenu", event => {
    if (event.target.closest("button,a,input,textarea,select")) return
    const card = event.target.closest(".work-card[data-id]")
    if (!card) return
    event.preventDefault()
    clearPress()
    suppressCardClickUntil = Date.now() + 300
    enterSelection(card.dataset.id)
  })
  list.addEventListener("click", event => {
    const select = event.target.closest("[data-collection-select]")
    if (select) {
      event.preventDefault()
      event.stopPropagation()
      toggleSelection(select.dataset.collectionSelect)
      return
    }
    const workCard = event.target.closest(".work-card[data-id]")
    if (selectionActive && workCard && !event.target.closest("button,a,input,textarea,select")) {
      event.preventDefault()
      toggleSelection(workCard.dataset.id)
      return
    }
    if (Date.now() < suppressCardClickUntil && workCard) {
      event.preventDefault()
      return
    }

    const menu = event.target.closest("[data-collection-menu]")
    if (menu) {
      event.stopPropagation()
      const id = menu.dataset.collectionMenu
      const popover = [...document.querySelectorAll("[data-collection-popover]")]
        .find(candidate => candidate.dataset.collectionPopover === id)
      closeCollectionMenus(popover?.classList.contains("open") ? "" : id)
      return
    }
    const manage = event.target.closest("[data-collection-manage]")
    const exportJson = event.target.closest("[data-collection-export-json]")
    const exportPng = event.target.closest("[data-collection-export-png]")
    const remove = event.target.closest("[data-collection-delete]")
    try {
      if (manage) openCollectionEditor(getWorkCollections().find(item => item.id === manage.dataset.collectionManage))
      else if (exportJson) downloadCollectionJson(exportJson.dataset.collectionExportJson)
      else if (exportPng) downloadCollectionPng(exportPng.dataset.collectionExportPng)
      else if (remove) {
        const collection = getWorkCollections().find(item => item.id === remove.dataset.collectionDelete)
        if (collection && confirm(`删除作品集《${collection.title}》？其中的原作品不会被删除。`)) {
          deleteWorkCollection(collection.id)
          refreshShelf()
          showToast("作品集已删除，原作品保持不变", "success")
        }
      } else return
      closeCollectionMenus()
    } catch (error) {
      alert(error instanceof Error ? error.message : "作品集操作失败")
    }
  })

  document.querySelector("[data-collection-cancel]")?.addEventListener("click", resetCollectionSelection)
  document.querySelector("[data-collection-create]")?.addEventListener("click", () => {
    if (selectedWorkIds.size >= 2) openCollectionEditor(null, [...selectedWorkIds])
  })
  syncSelectionUi()
}
