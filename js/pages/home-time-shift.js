import { modal, showToast } from "../app.js"
import { getWork } from "../data.js"
import { createJsonToken } from "../local-database-mutation.js"
import { findPhoneTimeEntries, shiftPhoneTimeValue } from "../work-time-shift.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function finiteInteger(input) {
  const value = Number(input?.value || 0)
  return Number.isSafeInteger(value) ? value : 0
}

function offsetFromInputs(days, hours, minutes) {
  return finiteInteger(days) * 24 * 60
    + finiteInteger(hours) * 60
    + finiteInteger(minutes)
}

export function renderPhoneTimeShiftMatches(matches, selectedMatchIds, offsetMinutes) {
  if (!matches.length) {
    return '<div class="work-time-shift-empty">没有找到格式明确、可以安全调整的时间。</div>'
  }
  return matches.map((match, index) => {
    const shifted = shiftPhoneTimeValue(match.value, offsetMinutes) || match.value
    return `<label class="work-time-shift-item">
      <input type="checkbox" data-time-shift-match="${index}"${selectedMatchIds.has(match.id) ? " checked" : ""}>
      <span class="work-time-shift-item-copy">
        <strong>${esc(match.location)}</strong>
        <span><del>${esc(match.value)}</del><b aria-hidden="true">→</b><ins>${esc(shifted)}</ins></span>
      </span>
    </label>`
  }).join("")
}

export function openWorkTimeShift(workId, options = {}) {
  const getWorkById = options.getWorkById || getWork
  const createDialog = options.createDialog || modal
  const notify = options.notify || showToast
  const save = options.save
  const work = getWorkById(workId)
  if (!work) {
    notify("作品未找到", "error")
    return null
  }
  const report = findPhoneTimeEntries(work)
  const expectedWorkToken = createJsonToken(work)
  let selectedMatchIds = new Set(report.matches.map(match => match.id))

  const overlay = createDialog(
    "批量顺延时间",
    `<div class="work-time-shift">
      <p class="work-time-shift-intro">统一调整消息、动态、帖子、备忘录、相册、浏览记录和购物内容中的明确日期时间。相对时间或自定义文字不会被猜测修改。</p>
      <div class="work-time-shift-offset">
        <label><span>天</span><input class="form-input" type="number" step="1" id="workTimeShiftDays" value="0"></label>
        <label><span>小时</span><input class="form-input" type="number" step="1" id="workTimeShiftHours" value="0"></label>
        <label><span>分钟</span><input class="form-input" type="number" step="1" id="workTimeShiftMinutes" value="0"></label>
      </div>
      <div class="work-time-shift-tools">
        <button type="button" class="btn btn-sm btn-outline" data-time-shift-select-all>全选结果</button>
        <button type="button" class="btn btn-sm btn-ghost" data-time-shift-select-none>全部取消</button>
      </div>
      <div class="work-time-shift-summary" id="workTimeShiftSummary" role="status" aria-live="polite"></div>
      <div class="work-time-shift-results" id="workTimeShiftResults" role="region" aria-label="时间调整预览"></div>
      <p class="work-time-shift-skipped">${report.skipped.length
        ? `${report.skipped.length} 个时间无法识别，将保持原样，例如“${esc(report.skipped[0].value)}”。`
        : "没有发现无法识别的时间。"
      }</p>
      <div class="work-time-shift-status" id="workTimeShiftStatus" role="status" aria-live="polite"></div>
    </div>`,
    '<button type="button" class="btn btn-primary" id="workTimeShiftConfirm" disabled>确认顺延</button><button type="button" class="btn btn-ghost" id="workTimeShiftCancel">取消</button>',
  )
  const days = overlay.querySelector("#workTimeShiftDays")
  const hours = overlay.querySelector("#workTimeShiftHours")
  const minutes = overlay.querySelector("#workTimeShiftMinutes")
  const results = overlay.querySelector("#workTimeShiftResults")
  const summary = overlay.querySelector("#workTimeShiftSummary")
  const status = overlay.querySelector("#workTimeShiftStatus")
  const confirm = overlay.querySelector("#workTimeShiftConfirm")
  const cancel = overlay.querySelector("#workTimeShiftCancel")

  function offsetMinutes() {
    return offsetFromInputs(days, hours, minutes)
  }

  function updateConfirmation() {
    if (!confirm) return
    const offset = offsetMinutes()
    confirm.disabled = offset === 0
      || !selectedMatchIds.size
      || Math.abs(offset) > 5_256_000
  }

  function renderPreview() {
    const offset = offsetMinutes()
    if (results) {
      results.innerHTML = renderPhoneTimeShiftMatches(report.matches, selectedMatchIds, offset)
    }
    if (summary) {
      summary.textContent = report.matches.length
        ? `找到 ${report.matches.length} 个可调整时间，已勾选 ${selectedMatchIds.size} 个。`
        : "没有找到格式明确、可以安全调整的时间。"
    }
    if (status) status.textContent = ""
    updateConfirmation()
  }

  for (const input of [days, hours, minutes]) input?.addEventListener("input", renderPreview)
  results?.addEventListener("change", event => {
    const input = event.target.closest("[data-time-shift-match]")
    if (!input) return
    const match = report.matches[Number(input.dataset.timeShiftMatch)]
    if (!match) return
    if (input.checked) selectedMatchIds.add(match.id)
    else selectedMatchIds.delete(match.id)
    renderPreview()
  })
  overlay.querySelector("[data-time-shift-select-all]")?.addEventListener("click", () => {
    selectedMatchIds = new Set(report.matches.map(match => match.id))
    renderPreview()
  })
  overlay.querySelector("[data-time-shift-select-none]")?.addEventListener("click", () => {
    selectedMatchIds.clear()
    renderPreview()
  })
  cancel?.addEventListener("click", () => overlay.remove())
  confirm?.addEventListener("click", () => {
    const offset = offsetMinutes()
    if (!offset || !selectedMatchIds.size || typeof save !== "function") {
      if (status) status.textContent = typeof save === "function"
        ? "请填写调整量并至少勾选一项。"
        : "当前页面无法安全保存，请刷新后重试。"
      updateConfirmation()
      return
    }
    confirm.disabled = true
    if (status) status.textContent = "正在保存时间调整…"
    const request = {
      workId,
      expectedWorkToken,
      offsetMinutes:offset,
      selectedMatchIds:report.matches
        .filter(match => selectedMatchIds.has(match.id))
        .map(match => match.id),
      close:() => overlay.remove(),
    }
    let task
    try {
      task = save(request)
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "时间调整没有保存，请重试。"
      updateConfirmation()
      return
    }
    if (task instanceof Promise) {
      task.catch(() => {
        if (overlay.isConnected) updateConfirmation()
      })
    }
  })

  renderPreview()
  days?.focus()
  return overlay
}
