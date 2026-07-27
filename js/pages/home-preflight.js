import { getWork } from "../data.js"
import { modal, showToast } from "../app.js"
import { navigate } from "../router.js"
import { writeArticleEditorViewState } from "../article-editor-view-state.js"
import { inspectWorkBeforePublish } from "../work-preflight.js"
import { inspectArticleRoutes } from "../work-route-preflight.js"
import { inspectWorkSize } from "../work-size-report.js"
import { openPhoneAppModal } from "./phone.js"

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

function renderRouteIssueList(issues) {
  if (!issues.length) return ""
  return `<section class="work-preflight-group" aria-labelledby="workRoutePreflightWarningTitle">
    <h3 id="workRoutePreflightWarningTitle">路线建议检查（${issues.length}）</h3>
    <ul class="work-preflight-list">${issues.map(issue => `<li class="work-preflight-item work-preflight-level-warning">
      <strong>${esc(issue.title)}</strong>
      <span class="work-preflight-location">${esc(issue.location)}</span>
      <p>${esc(issue.action)}</p>
      ${issue.nodeId ? `<button type="button" class="btn btn-sm btn-outline work-preflight-edit" data-route-preflight-node="${esc(issue.nodeId)}">去修改</button>` : ""}
    </li>`).join("")}</ul>
  </section>`
}

export function renderArticleRouteReport(report) {
  const summary = report.summary
  const clean = report.issues.length === 0
  return `<div class="work-route-preflight-report">
    <div class="work-preflight-summary${clean ? " is-clean" : ""}" role="status">
      <strong>${clean ? "路线检查完成，未发现异常" : `路线检查完成 · ${report.issues.length} 项建议确认`}</strong>
      <p class="work-route-preflight-coverage">节点覆盖 ${summary.reachableNodes}/${summary.totalNodes} · 选项覆盖 ${summary.reachableChoices}/${summary.totalChoices}</p>
    </div>
    ${renderRouteIssueList(report.issues)}
  </div>`
}

function renderRouteInspectionEntry(work) {
  if (work?.type !== "article") return ""
  return `<section class="work-route-preflight" aria-labelledby="workRoutePreflightTitle">
    <div class="work-route-preflight-intro">
      <div>
        <h3 id="workRoutePreflightTitle">深度路线检查</h3>
        <p>模拟作品的章节推进与剧情跳转，检查不可达节点、提前结束、循环路线和互斥的隐藏条件。</p>
      </div>
      <button type="button" class="btn btn-outline" id="workRoutePreflightRun">开始路线试跑</button>
    </div>
    <div id="workRoutePreflightResults" aria-live="polite"></div>
  </section>`
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MiB`
  if (value >= 1024) return `${Math.round(value / 1024)} KiB`
  return `${value} B`
}

export function renderWorkSizeReport(report) {
  const riskCopy = report.risk === "high"
    ? "已超过 2 MiB，部分浏览器可能只能临时导入，关闭后无法继续保存。"
    : report.risk === "caution"
      ? "已超过 1.5 MiB，正在接近部分浏览器容易保存失败的区间。"
      : "当前低于 1.5 MiB；浏览器实际可用空间仍会受设备和已有数据影响。"
  const visibleAssets = report.assets.slice(0, 8)
  const assets = visibleAssets.length
    ? `<ol class="work-size-asset-list">${visibleAssets.map(asset => `<li>
        <span class="work-size-asset-copy"><strong>${esc(asset.location)}</strong><small>${esc(asset.mediaType)} · ${formatBytes(asset.bytes)}</small></span>
        <button type="button" class="btn btn-sm btn-outline work-size-locate" data-work-size-locate="${esc(asset.id)}">去处理</button>
      </li>`).join("")}</ol>`
    : '<p class="work-size-empty">没有发现内嵌图片、动图或视频；远程图片链接不会计入导出文件本体。</p>'
  return `<section class="work-size-report is-${report.risk}" aria-labelledby="workSizeReportTitle">
    <div class="work-size-heading">
      <div><h3 id="workSizeReportTitle">作品体积账单</h3><p>${riskCopy}</p></div>
      <strong class="work-size-total">${formatBytes(report.encryptedPackageBytes)}</strong>
    </div>
    <dl class="work-size-metrics">
      <div><dt>预计加密导出</dt><dd>${formatBytes(report.encryptedPackageBytes)}</dd></div>
      <div><dt>内嵌素材内容</dt><dd>${formatBytes(report.embeddedAssetBytes)}</dd></div>
      <div><dt>内嵌素材数量</dt><dd>${report.assets.length}</dd></div>
    </dl>
    ${report.assets.length ? `<h4>最占空间的素材${report.assets.length > visibleAssets.length ? `（前 ${visibleAssets.length} 项）` : ""}</h4>` : ""}
    ${assets}
  </section>`
}

export function renderWorkPreflightBody(
  work,
  report = inspectWorkBeforePublish(work),
  sizeReport = inspectWorkSize(work),
) {
  const clean = report.counts.error === 0 && report.counts.warning === 0
  const summary = clean
    ? `<div class="work-preflight-summary is-clean" role="status"><strong>未发现需要处理的问题</strong><p>仍建议在导出前完整阅读预览一次。</p></div>`
    : `<div class="work-preflight-summary" role="status"><strong>${report.counts.error} 项需要处理 · ${report.counts.warning} 项建议检查</strong><p>体检只读取作品内容，不会自动修改数据。</p></div>`
  return `<div class="work-preflight-results" aria-labelledby="workPreflightResultsTitle">
    <h2 class="sr-only" id="workPreflightResultsTitle">《${esc(work?.title || "无标题作品")}》发布前体检结果</h2>
    ${summary}
    ${renderIssueList(report.issues, "error", "需要处理")}
    ${renderIssueList(report.issues, "warning", "建议检查")}
    ${renderWorkSizeReport(sizeReport)}
    ${renderRouteInspectionEntry(work)}
  </div>`
}

export function openWorkPreflight(workId) {
  const work = getWork(workId)
  if (!work) {
    showToast("作品未找到", "error")
    return null
  }
  const sizeReport = inspectWorkSize(work)
  const overlay = modal(
    "发布前体检",
    renderWorkPreflightBody(work, inspectWorkBeforePublish(work), sizeReport),
    '<button type="button" class="btn btn-primary" id="workPreflightClose">知道了</button>',
  )
  overlay.querySelector("#workPreflightClose")?.addEventListener("click", () => overlay.remove())
  const routeButton = overlay.querySelector("#workRoutePreflightRun")
  const routeResults = overlay.querySelector("#workRoutePreflightResults")
  routeButton?.addEventListener("click", () => {
    routeButton.disabled = true
    routeButton.textContent = "正在检查…"
    if (routeResults) routeResults.innerHTML = '<p class="work-route-preflight-running" role="status">正在遍历作品路线…</p>'
    Promise.resolve().then(() => {
      const report = inspectArticleRoutes(work)
      if (routeResults) routeResults.innerHTML = renderArticleRouteReport(report)
      routeButton.textContent = "重新检查"
      routeButton.disabled = false
    })
  })
  overlay.addEventListener("click", event => {
    const sizeButton = event.target.closest("[data-work-size-locate]")
    if (sizeButton) {
      const asset = sizeReport.assets.find(item => item.id === sizeButton.dataset.workSizeLocate)
      if (!asset) return
      overlay.remove()
      if (asset.locator.surface === "work-info") {
        globalThis.editWorkInfo?.(work.id)
        return
      }
      if (asset.locator.surface === "phone") {
        openPhoneAppModal(work.id, asset.locator.appType || "profile")
        return
      }
      writeArticleEditorViewState(work.id, {
        nodeId:asset.locator.nodeId,
        collapsedChapterIds:[],
      })
      navigate(`/edit/${work.id}`)
      return
    }
    const editButton = event.target.closest("[data-route-preflight-node]")
    if (!editButton) return
    writeArticleEditorViewState(work.id, {
      nodeId:editButton.dataset.routePreflightNode,
      collapsedChapterIds:[],
    })
    overlay.remove()
    navigate(`/edit/${work.id}`)
  })
  return overlay
}
