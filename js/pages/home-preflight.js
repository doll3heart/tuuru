import { exportWorkAsJSON, getWork } from "../data.js"
import { modal, showToast } from "../app.js"
import { navigate } from "../router.js"
import { writeArticleEditorViewState } from "../article-editor-view-state.js"
import { inspectWorkBeforePublish } from "../work-preflight.js"
import { inspectArticleRoutes } from "../work-route-preflight.js"
import { inspectWorkSize } from "../work-size-report.js"
import { openPhoneAppModal } from "./phone.js"
import { buildReaderPreviewUrl } from "./reader.js"
import { encryptWorkPackage } from "../work-package.js"
import { downloadBlob } from "../download.js"
import { runButtonAction } from "../interaction-feedback.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderIssueList(issues, level, heading) {
  const matching = issues
    .map((issue, index) => ({issue, index}))
    .filter(entry => entry.issue.level === level)
  if (!matching.length) return ""
  return `<section class="work-preflight-group" aria-labelledby="workPreflight${level}Title">
    <h3 id="workPreflight${level}Title">${heading}（${matching.length}）</h3>
    <ul class="work-preflight-list">${matching.map(({issue, index}) => `<li class="work-preflight-item work-preflight-level-${level}">
      <strong>${esc(issue.title)}</strong>
      <span class="work-preflight-location">${esc(issue.location)}</span>
      <p>${esc(issue.action)}</p>
      ${issue.locator ? `<button type="button" class="btn btn-sm btn-outline work-preflight-edit" data-work-preflight-issue="${index}">去修改</button>` : ""}
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
      <button type="button" class="btn btn-outline" id="workRoutePreflightRun">重新检查</button>
    </div>
    <div id="workRoutePreflightResults" aria-live="polite"><p class="work-route-preflight-running" role="status">正在遍历作品路线…</p></div>
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
  const preflightReport = inspectWorkBeforePublish(work)
  const hasBlockingIssues = preflightReport.counts.error > 0
  const overlay = modal(
    "发布前体检",
    renderWorkPreflightBody(work, preflightReport, sizeReport),
    '<button type="button" class="btn btn-ghost" id="workPreflightClose">关闭</button>' +
      '<button type="button" class="btn ' + (hasBlockingIssues ? 'btn-primary' : 'btn-outline') + '" id="workPreflightPreview">预览作品</button>' +
      '<button type="button" class="btn btn-primary" id="workPreflightExport"' +
      (hasBlockingIssues ? ' disabled title="处理完需要处理的问题后即可导出"' : '') +
      '>导出加密作品</button>',
  )
  try {
    const pendingReturn = JSON.parse(sessionStorage.getItem("tuuru_preflight_return") || "null")
    if (pendingReturn?.workId === work.id) sessionStorage.removeItem("tuuru_preflight_return")
  } catch {}
  overlay.querySelector("#workPreflightClose")?.addEventListener("click", () => overlay.remove())
  overlay.querySelector("#workPreflightPreview")?.addEventListener("click", () => {
    const previewUrl = buildReaderPreviewUrl(work.id, globalThis.location?.href)
    overlay.remove()
    globalThis.location?.assign(previewUrl)
  })
  const exportButton = overlay.querySelector("#workPreflightExport")
  exportButton?.addEventListener("click", () => {
    if (exportButton.disabled) return
    runButtonAction(exportButton, async () => {
      const feedbackKey = `preflight-export-${work.id}`
      showToast("正在加密作品…", "info", {key:feedbackKey, duration:0})
      try {
        const json = exportWorkAsJSON(work.id)
        if (!json) throw new Error("作品数据无法读取")
        const encrypted = await encryptWorkPackage(json)
        downloadBlob(
          new Blob([encrypted], {type:"application/vnd.tuuru.work"}),
          `${work.title || "作品"}.tuuru`,
        )
        showToast("加密作品已导出", "success", {key:feedbackKey})
        overlay.remove()
      } catch (error) {
        showToast(`导出失败：${error instanceof Error ? error.message : "未知错误"}`, "error", {key:feedbackKey})
      }
    }, {pendingText:"正在打包…"})
  })
  const routeButton = overlay.querySelector("#workRoutePreflightRun")
  const routeResults = overlay.querySelector("#workRoutePreflightResults")
  function runRouteInspection() {
    if (!routeButton) return
    routeButton.disabled = true
    routeButton.textContent = "正在检查…"
    if (routeResults) routeResults.innerHTML = '<p class="work-route-preflight-running" role="status">正在遍历作品路线…</p>'
    Promise.resolve().then(() => {
      const report = inspectArticleRoutes(work)
      if (routeResults) routeResults.innerHTML = renderArticleRouteReport(report)
      routeButton.textContent = "重新检查"
      routeButton.disabled = false
    })
  }
  routeButton?.addEventListener("click", runRouteInspection)
  runRouteInspection()

  function rememberPreflightReturn() {
    try {
      sessionStorage.setItem("tuuru_preflight_return", JSON.stringify({
        workId:work.id,
        savedAt:Date.now(),
      }))
    } catch {}
  }

  function openLocator(locator) {
    if (!locator) return
    rememberPreflightReturn()
    overlay.remove()
    if (locator.surface === "work-info") {
      globalThis.editWorkInfo?.(work.id)
      return
    }
    if (locator.surface === "phone") {
      openPhoneAppModal(work.id, locator.appType || "profile")
      return
    }
    writeArticleEditorViewState(work.id, {
      nodeId:locator.nodeId,
      collapsedChapterIds:[],
    })
    navigate(`/edit/${work.id}`)
  }

  overlay.addEventListener("click", event => {
    const issueButton = event.target.closest("[data-work-preflight-issue]")
    if (issueButton) {
      const issue = preflightReport.issues[Number(issueButton.dataset.workPreflightIssue)]
      openLocator(issue?.locator)
      return
    }
    const sizeButton = event.target.closest("[data-work-size-locate]")
    if (sizeButton) {
      const asset = sizeReport.assets.find(item => item.id === sizeButton.dataset.workSizeLocate)
      if (!asset) return
      openLocator(asset.locator)
      return
    }
    const editButton = event.target.closest("[data-route-preflight-node]")
    if (!editButton) return
    openLocator({
      surface:"article",
      nodeId:editButton.dataset.routePreflightNode,
    })
  })
  return overlay
}
