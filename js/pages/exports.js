import { getWorkCollections, getWorks, WORK_TYPE } from "../data.js"
import {
  clearExportHistory,
  exportRecordStatus,
  formatExportBytes,
  readExportHistory,
  removeExportRecord,
} from "../export-history.js"
import { navigate } from "../router.js"

const STATUS_COPY = Object.freeze({
  current: "当前版本",
  changed: "作品已在导出后修改",
  missing: "原作品已删除",
})

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function displayExportTime(value) {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return "时间未知"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function recordFilter(record) {
  if (record.entityType === "collection") return "collection"
  return record.format
}

function renderExportRecord(record, entities) {
  const status = exportRecordStatus(record, entities)
  const available = status !== "missing"
  const formatLabel = record.format === "png" ? "加密 PNG" : ".tuuru"
  const deliveryLabel = record.delivery === "shared" ? "已发送" : "已下载"
  const actionLabel = record.entityType === "collection"
    ? "重新下载"
    : record.format === "png" ? "重新生成" : "发送 / 下载"
  return `<li class="export-record" data-export-filter="${recordFilter(record)}" data-export-record="${escapeHtml(record.id)}">
    <div class="export-record-main">
      <div class="export-record-title"><strong>${escapeHtml(record.title)}</strong><span class="export-format">${formatLabel}</span></div>
      <div class="export-record-meta"><span>${displayExportTime(record.exportedAt)}</span><span>${formatExportBytes(record.bytes)}</span><span>${deliveryLabel}</span></div>
      <span class="export-record-status export-record-status-${status}">${STATUS_COPY[status]}</span>
    </div>
    <div class="export-record-actions">
      ${available ? `<button type="button" class="btn btn-sm btn-outline" data-export-regenerate="${escapeHtml(record.id)}">${actionLabel}</button><button type="button" class="btn btn-sm btn-ghost" data-export-open-work="${escapeHtml(record.entityId)}">打开作品</button>` : ""}
      <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-export-remove="${escapeHtml(record.id)}">移除记录</button>
    </div>
  </li>`
}

export function renderExportCenter({
  history = readExportHistory(),
  works = getWorks(),
  collections = getWorkCollections(),
} = {}) {
  const entities = [...works, ...collections]
  const records = history.map(record => renderExportRecord(record, entities)).join("")
  return `<section class="export-center" id="exportCenter">
    <div class="export-center-heading">
      <div><a class="export-center-back" href="#/">← 返回作品库</a><h1>导出中心</h1><p>这里仅保存导出时间与文件信息，不保存作品文件，也不会上传内容。</p></div>
      ${history.length ? '<button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-export-clear>清空记录</button>' : ""}
    </div>
    <div class="export-filters" role="group" aria-label="筛选导出记录">
      <button type="button" class="export-filter active" data-export-filter-button="all" aria-pressed="true">全部</button>
      <button type="button" class="export-filter" data-export-filter-button="tuuru" aria-pressed="false">.tuuru</button>
      <button type="button" class="export-filter" data-export-filter-button="png" aria-pressed="false">PNG</button>
      <button type="button" class="export-filter" data-export-filter-button="collection" aria-pressed="false">作品集</button>
    </div>
    ${history.length
      ? `<ul class="export-record-list">${records}</ul><p class="export-filter-empty" hidden>这个筛选下还没有记录。</p>`
      : '<div class="export-center-empty"><strong>还没有导出记录</strong><p>从作品卡片的「更多 → 发送与导出」开始。记录只留在当前浏览器。</p></div>'}
  </section>`
}

function replaceExportCenter(root) {
  root.outerHTML = renderExportCenter()
  bindExportCenter()
}

export function bindExportCenter() {
  const root = document.getElementById("exportCenter")
  if (!root) return
  const works = getWorks()
  const historyById = new Map(readExportHistory().map(record => [record.id, record]))

  root.querySelectorAll("[data-export-filter-button]").forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.dataset.exportFilterButton
      root.querySelectorAll("[data-export-filter-button]").forEach(candidate => {
        const active = candidate === button
        candidate.classList.toggle("active", active)
        candidate.setAttribute("aria-pressed", String(active))
      })
      let visible = 0
      root.querySelectorAll("[data-export-record]").forEach(row => {
        const show = selected === "all" || row.dataset.exportFilter === selected
        row.hidden = !show
        if (show) visible += 1
      })
      const empty = root.querySelector(".export-filter-empty")
      if (empty) empty.hidden = visible !== 0
    })
  })

  root.querySelectorAll("[data-export-regenerate]").forEach(button => {
    button.addEventListener("click", () => {
      const record = historyById.get(button.dataset.exportRegenerate)
      if (!record) return
      if (record.entityType === "collection") window.exportCollectionRecord?.(record.entityId, record.format)
      else if (record.format === "png") window.expPNG?.(record.entityId)
      else window.shareWork?.(record.entityId, button)
    })
  })
  root.querySelectorAll("[data-export-open-work]").forEach(button => {
    button.addEventListener("click", () => {
      const work = works.find(candidate => String(candidate.id) === button.dataset.exportOpenWork)
      if (!work) return
      navigate(`/${work.type === WORK_TYPE.PHONE ? "phone" : "edit"}/${work.id}`)
    })
  })
  root.querySelectorAll("[data-export-remove]").forEach(button => {
    button.addEventListener("click", () => {
      removeExportRecord(button.dataset.exportRemove)
      replaceExportCenter(root)
    })
  })
  root.querySelector("[data-export-clear]")?.addEventListener("click", () => {
    if (!globalThis.confirm?.("只清空导出记录，不会删除作品。继续吗？")) return
    clearExportHistory()
    replaceExportCenter(root)
  })
}
