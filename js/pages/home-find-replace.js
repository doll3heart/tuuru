import { modal, showToast } from "../app.js"
import { getWork } from "../data.js"
import { createJsonToken } from "../local-database-mutation.js"
import { findWorkTextMatches } from "../work-text-replace.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function renderWorkFindReplaceMatches(matches, selectedMatchIds = new Set()) {
  if (!matches.length) {
    return '<div class="work-find-replace-empty">没有找到可安全替换的可见文字。</div>'
  }
  return matches.map((match, index) => `
    <label class="work-find-replace-item">
      <input type="checkbox" data-find-match="${index}"${selectedMatchIds.has(match.id) ? " checked" : ""}>
      <span class="work-find-replace-item-copy">
        <span class="work-find-replace-item-meta">
          <strong>${esc(match.location)} · ${esc(match.field)}</strong>
          <span>${match.occurrences} 处</span>
        </span>
        <span class="work-find-replace-preview">${esc(match.preview || "（空文字）")}</span>
      </span>
    </label>
  `).join("")
}

export function openWorkFindReplace(workId, options = {}) {
  const getWorkById = options.getWorkById || getWork
  const createDialog = options.createDialog || modal
  const notify = options.notify || showToast
  const save = options.save
  const setTimer = options.setTimer || globalThis.setTimeout
  const clearTimer = options.clearTimer || globalThis.clearTimeout
  const work = getWorkById(workId)
  if (!work) {
    notify("作品未找到", "error")
    return null
  }

  const body = `
    <div class="work-find-replace">
      <p class="work-find-replace-intro">只检查作者和读者能看到的文字；不会修改节点 ID、跳转目标、图片链接或内部标记。</p>
      <div class="work-find-replace-fields">
        <label class="form-group">
          <span class="form-label">查找文字</span>
          <input class="form-input" id="workFindSearch" autocomplete="off" placeholder="例如：旧角色名">
        </label>
        <label class="form-group">
          <span class="form-label">替换为</span>
          <textarea class="form-textarea" id="workFindReplacement" rows="2" placeholder="留空表示删除命中的文字"></textarea>
        </label>
      </div>
      <label class="work-find-replace-option">
        <input type="checkbox" id="workFindCaseSensitive">
        <span>区分英文字母大小写</span>
      </label>
      <div class="work-find-replace-tools">
        <button type="button" class="btn btn-sm btn-outline" data-find-select-all>全选结果</button>
        <button type="button" class="btn btn-sm btn-ghost" data-find-select-none>全部取消</button>
      </div>
      <div class="work-find-replace-summary" id="workFindReplaceSummary" role="status" aria-live="polite">输入查找文字后显示预览。</div>
      <div class="work-find-replace-results" id="workFindReplaceResults" role="region" aria-label="查找替换预览"></div>
      <p class="work-find-replace-warning">确认后会一次性保存全部勾选项。建议先检查预览；正在其他页面编辑的作品不会被覆盖。</p>
      <div class="work-find-replace-status" id="workFindReplaceStatus" role="status" aria-live="polite"></div>
    </div>
  `
  const overlay = createDialog(
    "全作品查找替换",
    body,
    '<button type="button" class="btn btn-primary" id="workFindReplaceConfirm" disabled>确认替换</button><button type="button" class="btn btn-ghost" id="workFindReplaceCancel">取消</button>',
  )
  const searchInput = overlay.querySelector("#workFindSearch")
  const replacementInput = overlay.querySelector("#workFindReplacement")
  const caseInput = overlay.querySelector("#workFindCaseSensitive")
  const results = overlay.querySelector("#workFindReplaceResults")
  const summary = overlay.querySelector("#workFindReplaceSummary")
  const status = overlay.querySelector("#workFindReplaceStatus")
  const confirm = overlay.querySelector("#workFindReplaceConfirm")
  const cancel = overlay.querySelector("#workFindReplaceCancel")
  let matches = []
  let selectedMatchIds = new Set()
  let previewKey = ""
  let previewTimer = null
  const expectedWorkToken = createJsonToken(work)

  function currentPreviewKey() {
    return `${searchInput?.value || ""}\u0000${caseInput?.checked === true ? "1" : "0"}`
  }

  function updateConfirmation() {
    const search = searchInput?.value || ""
    const replacement = replacementInput?.value || ""
    if (confirm) {
      confirm.disabled = !search
        || !selectedMatchIds.size
        || replacement === search
        || currentPreviewKey() !== previewKey
    }
  }

  function renderPreview() {
    const search = searchInput?.value || ""
    const caseSensitive = caseInput?.checked === true
    const nextKey = currentPreviewKey()
    matches = findWorkTextMatches(work, { search, caseSensitive })
    selectedMatchIds = new Set(matches.map(match => match.id))
    previewKey = nextKey
    if (results) results.innerHTML = search
      ? renderWorkFindReplaceMatches(matches, selectedMatchIds)
      : ""
    const occurrences = matches.reduce((sum, match) => sum + match.occurrences, 0)
    if (summary) {
      summary.textContent = !search
        ? "输入查找文字后显示预览。"
        : matches.length
          ? `找到 ${matches.length} 个字段、${occurrences} 处文字；默认全部勾选。`
          : "没有找到可安全替换的可见文字。"
    }
    if (status) status.textContent = ""
    updateConfirmation()
  }

  function schedulePreview() {
    if (previewTimer !== null) clearTimer(previewTimer)
    previewTimer = setTimer(() => {
      previewTimer = null
      renderPreview()
    }, 120)
    previewKey = ""
    updateConfirmation()
  }

  searchInput?.addEventListener("input", schedulePreview)
  caseInput?.addEventListener("change", schedulePreview)
  replacementInput?.addEventListener("input", updateConfirmation)
  results?.addEventListener("change", event => {
    const input = event.target.closest("[data-find-match]")
    if (!input) return
    const match = matches[Number(input.dataset.findMatch)]
    if (!match) return
    if (input.checked) selectedMatchIds.add(match.id)
    else selectedMatchIds.delete(match.id)
    updateConfirmation()
  })
  overlay.querySelector("[data-find-select-all]")?.addEventListener("click", () => {
    selectedMatchIds = new Set(matches.map(match => match.id))
    results?.querySelectorAll("[data-find-match]").forEach(input => { input.checked = true })
    updateConfirmation()
  })
  overlay.querySelector("[data-find-select-none]")?.addEventListener("click", () => {
    selectedMatchIds.clear()
    results?.querySelectorAll("[data-find-match]").forEach(input => { input.checked = false })
    updateConfirmation()
  })
  cancel?.addEventListener("click", () => {
    if (previewTimer !== null) clearTimer(previewTimer)
    overlay.remove()
  })
  confirm?.addEventListener("click", () => {
    if (previewTimer !== null || currentPreviewKey() !== previewKey) {
      if (previewTimer !== null) clearTimer(previewTimer)
      previewTimer = null
      renderPreview()
    }
    const selected = matches.filter(match => selectedMatchIds.has(match.id))
    if (!selected.length || typeof save !== "function") {
      if (status) status.textContent = selected.length ? "当前页面无法安全保存，请刷新后重试。" : "请至少勾选一项结果。"
      updateConfirmation()
      return
    }
    confirm.disabled = true
    if (status) status.textContent = "正在保存替换结果…"
    const request = {
      workId,
      expectedWorkToken,
      search: searchInput?.value || "",
      replacement: replacementInput?.value || "",
      caseSensitive: caseInput?.checked === true,
      selectedMatchIds: selected.map(match => match.id),
      close: () => overlay.remove(),
    }
    let task
    try {
      task = save(request)
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "替换没有保存，请重试。"
      updateConfirmation()
      return
    }
    if (task instanceof Promise) {
      task.catch(() => {
        if (overlay.isConnected) updateConfirmation()
      })
    }
  })

  searchInput?.focus()
  return overlay
}
