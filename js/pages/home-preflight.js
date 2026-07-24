import { getWork } from "../data.js"
import { modal, showToast } from "../app.js"
import { inspectWorkBeforePublish } from "../work-preflight.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderIssueList(issues, level, heading) {
  const matching = issues.filter(issue => issue.level === level)
  if (!matching.length) return ""
  return `<section class="work-preflight-group" aria-labelledby="workPreflight${level}Title">
    <h3 id="workPreflight${level}Title">${heading}（${matching.length}）</h3>
    <ul class="work-preflight-list">${matching.map(issue => `<li class="work-preflight-item work-preflight-level-${level}">
      <strong>${esc(issue.title)}</strong>
      <span class="work-preflight-location">${esc(issue.location)}</span>
      <p>${esc(issue.action)}</p>
    </li>`).join("")}</ul>
  </section>`
}

export function renderWorkPreflightBody(work, report = inspectWorkBeforePublish(work)) {
  const clean = report.counts.error === 0 && report.counts.warning === 0
  const summary = clean
    ? `<div class="work-preflight-summary is-clean" role="status"><strong>未发现需要处理的问题</strong><p>仍建议在导出前完整阅读预览一次。</p></div>`
    : `<div class="work-preflight-summary" role="status"><strong>${report.counts.error} 项需要处理 · ${report.counts.warning} 项建议检查</strong><p>体检只读取作品内容，不会自动修改数据。</p></div>`
  return `<div class="work-preflight-results" aria-labelledby="workPreflightResultsTitle">
    <h2 class="sr-only" id="workPreflightResultsTitle">《${esc(work?.title || "无标题作品")}》发布前体检结果</h2>
    ${summary}
    ${renderIssueList(report.issues, "error", "需要处理")}
    ${renderIssueList(report.issues, "warning", "建议检查")}
  </div>`
}

export function openWorkPreflight(workId) {
  const work = getWork(workId)
  if (!work) {
    showToast("作品未找到", "error")
    return null
  }
  const overlay = modal(
    "发布前体检",
    renderWorkPreflightBody(work),
    '<button type="button" class="btn btn-primary" id="workPreflightClose">知道了</button>',
  )
  overlay.querySelector("#workPreflightClose")?.addEventListener("click", () => overlay.remove())
  return overlay
}
