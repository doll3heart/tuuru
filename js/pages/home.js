import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork, updateWork, exportWorkAsJSON, encodeSteganoPNG, WORK_TYPE, uid } from "../data.js"
import { navigate } from "../router.js"
import { modal, showToast } from "../app.js"
import { downloadBlob } from "../download.js"
import { startLocalLibraryRestore } from "../library-restore-ui.js"
import { serializeLocalDatabaseBackup } from "../storage.js"
import { inspectLocalProfile, mergeLocalProfile, serializeLocalProfile } from "../local-profile-transport.js"
import { FEATURE_FLAGS } from "../feature-flags.js"
import {
  deleteHomeWork,
  describeHomeMutationFailure,
  duplicateHomeWork,
  requireVerifiedHomeMutation,
  updateHomeWorkInfo,
} from "../home-work-mutations.js"
import { createJsonToken } from "../local-database-mutation.js"
import {
  WORK_WATERMARK_IMAGE_MAX_BYTES,
  hasRenderableWorkWatermark,
  normalizeWorkWatermark,
} from "../work-watermark.js"

const CLEANUP_WARNING = "作品已经保存，但编辑锁清理未完成；请稍后刷新查看，不要重复操作。"
const POST_COMMIT_UI_WARNING = "作品已经保存，但页面更新未完成；请刷新查看，不要重复操作。"

export function renderHome(){
  const works = getWorks()
  const articles = works.filter(w=>w.type===WORK_TYPE.ARTICLE)
  const phones = works.filter(w=>w.type===WORK_TYPE.PHONE)
  
  // Bind tab switching after DOM is ready
  setTimeout(function() {
    var tabs = document.querySelectorAll('#workTabs .tab')
    var list = document.getElementById('workList')
    if (!tabs.length || !list) return
    tabs.forEach(function(t) {
      t.onclick = function() {
        tabs.forEach(function(x) { x.classList.remove('active') })
        t.classList.add('active')
        var filter = t.dataset.tab
        var filtered = filter === 'all' ? getWorks()
          : getWorks().filter(function(w) { return w.type === (filter === 'phone' ? WORK_TYPE.PHONE : WORK_TYPE.ARTICLE) })
        list.innerHTML = renderWorkList(filtered)
      }
    })
  }, 50)

  return `
    <div class="library-heading mb-4">
      <h2 class="library-heading-title">我的作品</h2>
      <div class="library-heading-actions">
        <button class="btn btn-sm btn-outline" onclick="backupLibrary()" aria-label="备份全部作品" title="包含密码、私密内容、编辑设置与作者配置，仅下载到本机"><span class="library-action-label library-action-label-long">备份全部</span><span class="library-action-label library-action-label-short" aria-hidden="true">备份</span></button>
        <button class="btn btn-sm btn-outline" id="backupInspectBtn" onclick="restoreLibraryBackup()" aria-label="检查或恢复备份" title="检查备份并可在确认后替换整个本地创作库；所有操作仅在当前浏览器内完成"><span class="library-action-label library-action-label-long">检查 / 恢复</span><span class="library-action-label library-action-label-short" aria-hidden="true">恢复</span></button>
        <button class="btn btn-sm btn-outline" onclick="openLocalProfileTransfer()" aria-label="导出或导入作者端和读者端本地数据" title="把作者创作库、写作设置和读者端本地信息打包迁移到其他浏览器"><span class="library-action-label library-action-label-long">整机搬家</span><span class="library-action-label library-action-label-short" aria-hidden="true">搬家</span></button>
      </div>
    </div>
    
    <div class="tabs" id="workTabs">
      <div class="tab active" data-tab="all">全部 (${works.length})</div>
      <div class="tab" data-tab="article">文章 (${articles.length})</div>
      <div class="tab" data-tab="phone">小手机 (${phones.length})</div>
    </div>
    
    <div id="workList">${renderWorkList(works)}</div>
  `
}

function renderWorkList(works){
  if(!works.length){
    return `<div class="empty-state"><div class="empty-icon" aria-hidden="true"></div><h3>还没有作品</h3><p>点击右上角「新建」开始创作</p></div>`
  }
  
  return `<div class="work-grid">${works.map(w=>`
    <div class="card work-card" data-id="${w.id}">
      <div class="work-card-body">
        <div class="work-card-title">${escHtml(w.title)}</div>
        <div class="work-card-desc">${escHtml(w.desc||"无描述")}</div>
        <div class="work-card-meta">
          <span>${w.type===WORK_TYPE.PHONE?"小手机":"互动文章"}</span>
          <span>${timeAgo(w.updatedAt)}</span>
${w.locked?`<span style="color:var(--c-accent3)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> 需阅读密码</span>`:""}
        </div>
      </div>
      <div class="work-card-actions">
        <div class="work-card-actions-left">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();navigate('/${w.type===WORK_TYPE.PHONE?'phone':'edit'}/${w.id}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();navigate('/read/${w.id}')"${w.type===WORK_TYPE.PHONE?' style="display:none"':''}>阅读</button>
          <button class="btn btn-sm btn-danger" id="deleteWork-${w.id}" onclick="event.stopPropagation();delWork('${w.id}')">删除</button>
        </div>
        <div class="work-card-more-wrap">
          <button class="btn btn-sm btn-ghost work-card-more-btn" onclick="event.stopPropagation();toggleWorkMenu(event,'${w.id}')">更多</button>
          <div class="work-card-more-popover" id="workMenu-${w.id}">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();editWorkInfo('${w.id}');closeWorkMenu('${w.id}')">作品信息</button>
            <button class="btn btn-sm btn-ghost" id="duplicateWork-${w.id}" onclick="event.stopPropagation();dupWork('${w.id}');closeWorkMenu('${w.id}')">复制作品</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();expWork('${w.id}');closeWorkMenu('${w.id}')">导出 JSON</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();expPNG('${w.id}');closeWorkMenu('${w.id}')">导出 PNG</button>
          </div>
        </div>
      </div>
      <div id="workWriteStatus-${w.id}" role="status" aria-live="polite" style="min-height:1em;margin-top:6px;color:var(--c-accent3);font-size:.75rem"></div>
    </div>
  `).join("")}</div>`
}

function escHtml(s){
  if(!s) return ""
  const d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

function timeAgo(ts){
  if(!ts) return ""
  const diff = Date.now()-ts
  if(diff<60000) return "刚刚"
  if(diff<3600000) return Math.floor(diff/60000)+"分钟前"
  if(diff<86400000) return Math.floor(diff/3600000)+"小时前"
  return Math.floor(diff/86400000)+"天前"
}

export function createHomeWriteController({
  flags,
  updateLegacy,
  duplicateLegacy,
  deleteLegacy,
  updateReliable,
  duplicateReliable,
  deleteReliable,
  notify,
  refresh,
  publish = () => {},
}) {
  const pending = new Map()
  const blocked = new Map()

  function runReliable(action, workId, mutation, onSuccess) {
    const key = `${action}:${workId}`
    if (pending.has(key)) return pending.get(key)
    if (blocked.has(key)) return blocked.get(key)
    publish(action, workId, { status: "pending", pending: true, message: "正在保存…" })
    let task
    task = Promise.resolve()
      .then(mutation)
      .then(outcome => requireVerifiedHomeMutation(outcome, {
        expectDeleted: action === "delete",
      }))
      .then(
        async outcome => {
          const cleanupWarning = Object.hasOwn(outcome, "cleanupError")
          if (cleanupWarning) {
            blocked.set(key, task)
            publish(action, workId, {
              status: "warning",
              pending: false,
              blocked: true,
              persistent: true,
              message: CLEANUP_WARNING,
            })
            return outcome
          }
          publish(action, workId, {
            status: "success",
            pending: false,
            persistent: false,
            message: "",
          })
          try {
            await onSuccess(outcome)
          } catch (error) {
            publish(action, workId, {
              status: "warning",
              pending: false,
              persistent: true,
              message: POST_COMMIT_UI_WARNING,
              error,
            })
            throw error
          }
          return outcome
        },
        error => {
          publish(action, workId, {
            status: "error",
            pending: false,
            persistent: true,
            message: describeHomeMutationFailure(error),
            error,
          })
          throw error
        },
      )
      .finally(() => {
        if (pending.get(key) === task) pending.delete(key)
      })
    pending.set(key, task)
    return task
  }

  function update({ workId, expectedWorkToken, patch, close = () => {} }) {
    if (!flags.reliableLocalWrites) {
      const updated = updateLegacy(workId, patch)
      if (!updated) {
        close()
        return updated
      }
      notify("作品信息已更新")
      close()
      refresh()
      return updated
    }
    return runReliable(
      "update",
      workId,
      () => updateReliable({ workId, expectedWorkToken, patch }),
      () => {
        notify("作品信息已更新")
        close()
        refresh()
      },
    )
  }

  function duplicate({ workId }) {
    if (!flags.reliableLocalWrites) {
      const duplicated = duplicateLegacy(workId)
      notify("已复制", "info")
      refresh()
      return duplicated
    }
    return runReliable(
      "duplicate",
      workId,
      () => duplicateReliable({ workId }),
      () => {
        notify("已复制", "info")
        refresh()
      },
    )
  }

  function remove({ workId, expectedWorkToken, confirmed, close = () => {} }) {
    if (!confirmed) return undefined
    if (!flags.reliableLocalWrites) {
      const removed = deleteLegacy(workId)
      notify("已删除", "info")
      refresh()
      return removed
    }
    return runReliable(
      "delete",
      workId,
      () => deleteReliable({ workId, expectedWorkToken }),
      () => {
        notify("已删除", "info")
        close()
        refresh()
      },
    )
  }

  return Object.freeze({ update, duplicate, remove })
}

function refreshHomeWorkList() {
  const list = document.getElementById("workList")
  if (list) list.innerHTML = renderWorkList(getWorks())
}

function homeWriteElements(action, workId) {
  if (action === "update") {
    return {
      button: document.getElementById("wiSaveBtn"),
      status: document.getElementById("wiStatus"),
    }
  }
  if (action === "delete") {
    return {
      button: document.getElementById(`deleteWorkConfirm-${workId}`),
      status: document.getElementById(`deleteWorkStatus-${workId}`),
    }
  }
  return {
    button: document.getElementById(`duplicateWork-${workId}`),
    status: document.getElementById(`workWriteStatus-${workId}`),
  }
}

function publishHomeWriteState(action, workId, state) {
  const { button, status } = homeWriteElements(action, workId)
  if (button) button.disabled = state.pending === true || state.blocked === true
  if (status) status.textContent = state.message || ""
  if (state.status === "error") button?.focus()
}

const homeWriteController = createHomeWriteController({
  flags: FEATURE_FLAGS,
  updateLegacy: updateWork,
  duplicateLegacy: duplicateWork,
  deleteLegacy: deleteWork,
  updateReliable: updateHomeWorkInfo,
  duplicateReliable: duplicateHomeWork,
  deleteReliable: deleteHomeWork,
  notify: showToast,
  refresh: refreshHomeWorkList,
  publish: publishHomeWriteState,
})

// Global handlers for inline onclick
window.backupLibrary = function(){
  try {
    var exportedAt = new Date()
    var json = serializeLocalDatabaseBackup(localStorage, exportedAt)
    var blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    var filename = 'tuuru-library-backup-' + exportedAt.toISOString().replace(/[:.]/g, '-') + '.json'
    downloadBlob(blob, filename)
    showToast('备份下载已发起；文件包含私密内容，请妥善保管', 'success')
  } catch(e) {
    alert('备份失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

let libraryRestoreController
window.restoreLibraryBackup = function() {
  if (!libraryRestoreController) {
    libraryRestoreController = startLocalLibraryRestore({
      storage: localStorage,
      modal,
      notify: showToast,
      reload: () => location.reload(),
    })
  }
  libraryRestoreController.pickFile(document.getElementById("backupInspectBtn"))
}

window.openLocalProfileTransfer = function() {
  var selectedProfile = null
  var body = '<div class="local-profile-transfer">'
    + '<p>搬家包同时包含作者创作库、写作习惯，以及当前浏览器的读者作品、阅读资料与小手机个性化设置。</p>'
    + '<p class="local-profile-warning">文件可能含密码、私密内容和读者资料，请只保存在可信设备，不要公开分享。</p>'
    + '<label class="btn btn-sm btn-outline local-profile-file">选择搬家包<input id="localProfileFile" type="file" accept="application/json,.json"></label>'
    + '<div id="localProfileSummary" class="local-profile-summary" role="status" aria-live="polite">导入时会合并数据；同 ID 的不同作品会另存，已有个人设置不会被静默覆盖。</div>'
    + '</div>'
  var ov = modal('作者端＋读者端整机搬家', body,
    '<button id="localProfileExport" class="btn btn-primary btn-sm">导出搬家包</button><button id="localProfileImport" class="btn btn-outline btn-sm" disabled>确认导入</button><button id="localProfileCancel" class="btn btn-ghost btn-sm">关闭</button>')
  var fileInput = ov.querySelector('#localProfileFile')
  var summary = ov.querySelector('#localProfileSummary')
  var importButton = ov.querySelector('#localProfileImport')

  ov.querySelector('#localProfileExport').onclick = function() {
    try {
      var exportedAt = new Date()
      var json = serializeLocalProfile(localStorage, exportedAt)
      downloadBlob(new Blob([json], { type:'application/json;charset=utf-8' }),
        'tuuru-local-profile-' + exportedAt.toISOString().replace(/[:.]/g, '-') + '.json')
      showToast('整机搬家包下载已发起，请妥善保管', 'success')
    } catch (error) {
      summary.textContent = '导出失败：' + (error instanceof Error ? error.message : '未知错误')
    }
  }

  fileInput.onchange = async function() {
    selectedProfile = null
    importButton.disabled = true
    var file = fileInput.files && fileInput.files[0]
    if (!file) return
    try {
      var inspected = inspectLocalProfile(await file.text())
      if (!inspected.ok) throw inspected.error
      selectedProfile = inspected.profile
      importButton.disabled = false
      summary.textContent = '已检查：' + inspected.summary.authorWorkCount + ' 篇作者作品、'
        + inspected.summary.authorSettingCount + ' 项作者设置、'
        + inspected.summary.readerEntryCount + ' 项读者端数据。'
    } catch (error) {
      summary.textContent = '无法导入：' + (error instanceof Error ? error.message : '文件无效')
    }
  }

  importButton.onclick = function() {
    if (!selectedProfile) return
    if (!confirm('确认合并这个搬家包？请先关闭其他正在编辑作品的标签页。现有冲突设置会保留，不会整库覆盖。')) return
    try {
      var result = mergeLocalProfile(localStorage, selectedProfile)
      summary.textContent = '导入完成：新增 ' + result.importedAuthorWorks + ' 篇作者作品、'
        + result.importedReaderEntries + ' 项读者端数据；保留 ' + result.preservedConflicts + ' 项现有冲突数据。'
      importButton.disabled = true
      showToast('整机搬家包已合并，正在刷新', 'success')
      setTimeout(function() { location.reload() }, 500)
    } catch (error) {
      summary.textContent = '导入失败，原数据未清空：' + (error instanceof Error ? error.message : '未知错误')
    }
  }
  ov.querySelector('#localProfileCancel').onclick = function() { ov.remove() }
}

function openReliableDeleteDialog(id) {
  const trigger = document.activeElement
  const work = getWorks().find(candidate => candidate.id === id)
  const ov = document.createElement("div")
  ov.className = "modal-overlay"
  ov.style.cssText = "z-index:2000"

  if (!work) {
    ov.innerHTML = `<div class="modal" role="dialog" aria-labelledby="deleteWorkTitle-${id}">
      <div class="modal-header"><span class="modal-title" id="deleteWorkTitle-${id}">无法删除作品</span></div>
      <div class="modal-body"><div role="status" aria-live="polite" style="color:var(--c-accent3)">作品已变化或不存在，请刷新作品列表后重试。</div></div>
      <div class="modal-footer"><button class="btn btn-ghost" id="deleteWorkClose-${id}">关闭</button></div>
    </div>`
    document.body.appendChild(ov)
    document.getElementById(`deleteWorkClose-${id}`)?.addEventListener("click", () => {
      ov.remove()
      trigger?.focus?.()
    })
    return
  }

  const expectedWorkToken = createJsonToken(work)
  ov.innerHTML = `<div class="modal" role="dialog" aria-labelledby="deleteWorkTitle-${id}">
    <div class="modal-header"><span class="modal-title" id="deleteWorkTitle-${id}">删除作品</span><button class="btn-icon" id="deleteWorkClose-${id}" type="button" aria-label="关闭">&times;</button></div>
    <div class="modal-body"><p>确定删除「${escHtml(work.title || "无标题作品")}」吗？</p><div id="deleteWorkStatus-${id}" role="status" aria-live="polite" style="min-height:1.4em;margin-top:10px;color:var(--c-accent3)"></div></div>
    <div class="modal-footer"><button class="btn btn-danger" id="deleteWorkConfirm-${id}" type="button">确认删除</button><button class="btn btn-ghost" id="deleteWorkCancel-${id}" type="button">取消</button></div>
  </div>`
  document.body.appendChild(ov)
  const confirmButton = document.getElementById(`deleteWorkConfirm-${id}`)
  const requestClose = () => {
    if (confirmButton?.disabled) return
    ov.remove()
    trigger?.focus?.()
  }
  document.getElementById(`deleteWorkClose-${id}`)?.addEventListener("click", requestClose)
  document.getElementById(`deleteWorkCancel-${id}`)?.addEventListener("click", requestClose)
  ov.addEventListener("click", event => {
    if (event.target === ov) requestClose()
  })
  confirmButton?.addEventListener("click", () => {
    const result = homeWriteController.remove({
      workId: id,
      expectedWorkToken,
      confirmed: true,
      close: () => ov.remove(),
    })
    if (result instanceof Promise) result.catch(() => {})
  })
  confirmButton?.focus()
}

window.delWork = function(id){
  if (FEATURE_FLAGS.reliableLocalWrites) {
    openReliableDeleteDialog(id)
    return
  }
  if(!confirm("确定删除这个作品吗？")) return
  return homeWriteController.remove({workId:id,confirmed:true})
}

window.expPNG = function(id){
  try {
    var json = exportWorkAsJSON(id)
    if (!json) { alert('导出失败'); return }
    var w = getWorks().find(function(x) { return x.id === id })
    // Offer to use a cover image
    var title = w ? w.title : '作品'
    var ov = document.createElement('div')
    ov.className = 'modal-overlay'
    ov.style.cssText = 'z-index:2000'
    ov.innerHTML = '<div class="modal"><div class="modal-header"><span class="modal-title">PNG 隐写导出</span><button class="modal-close" style="border:none;background:transparent;cursor:pointer;font-size:1.2rem">&times;</button></div><div class="modal-body"><p style="font-size:.85rem;color:var(--c-text2);margin-bottom:12px">可选：选择一张封面图片作为 PNG 宿主图（不选则使用默认渐变图）</p><button id="pngCoverBtn" class="btn btn-sm btn-outline" style="width:100%;margin-bottom:12px">选择封面图片</button><div style="text-align:center;margin:8px 0"><span style="font-size:.75rem;color:var(--c-text2)" id="pngCoverLabel">未选择封面</span></div><button id="pngExportBtn" class="btn btn-sm btn-primary" style="width:100%">导出 PNG</button></div></div>'
    document.body.appendChild(ov)
    var coverUrl = ''
    var label = ov.querySelector('#pngCoverLabel')
    ov.querySelector('.modal-close').onclick = function() { ov.remove() }
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
    ov.querySelector('#pngCoverBtn').onclick = function() {
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = function() {
        var file = input.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function() {
          coverUrl = reader.result
          label.textContent = file.name
          label.style.color = 'var(--c-primary-hover)'
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
    var exportButton = ov.querySelector('#pngExportBtn')
    function handleExportError(error) {
      exportButton.textContent = '导出 PNG'
      exportButton.disabled = false
      alert('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
    exportButton.onclick = function() {
      exportButton.textContent = '编码中...'
      exportButton.disabled = true
      try {
        encodeSteganoPNG(json, coverUrl, function(dataUrl) {
          var a = document.createElement('a')
          a.href = dataUrl
          a.download = title + '.png'
          a.click()
          showToast('PNG 已导出', 'success')
          ov.remove()
        }, handleExportError)
      } catch(e) {
        handleExportError(e)
      }
    }
  } catch(e) {
    alert('导出失败：' + e.message)
  }
}

window.expWork = function(id){
  try {
    var json = exportWorkAsJSON(id)
    if (!json) { alert('导出失败'); return }
    var blob = new Blob([json], { type: 'application/json' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    var w = getWorks().find(function(x) { return x.id === id })
    a.download = (w ? w.title : '作品') + '.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出', 'success')
  } catch(e) {
    alert('导出失败：' + e.message)
  }
}

window.dupWork = function(id){
  const result = homeWriteController.duplicate({workId:id})
  if (result instanceof Promise) result.catch(() => {})
  return result
}

function renderWorkWatermarkPreview(container, candidate) {
  if (!container) return
  var watermark = normalizeWorkWatermark(candidate)
  container.className = 'wi-watermark-preview is-' + watermark.coverage + ' is-' + watermark.pattern
  container.dataset.position = watermark.position
  container.style.setProperty('--wi-wm-opacity', String(watermark.opacity))
  container.style.setProperty('--wi-wm-spacing', watermark.spacing + 'px')
  container.innerHTML = ''

  if (!hasRenderableWorkWatermark(watermark)) {
    var empty = document.createElement('span')
    empty.className = 'wi-watermark-preview-empty'
    empty.textContent = watermark.enabled ? '补充水印内容后可预览' : '启用后可预览水印位置'
    container.appendChild(empty)
    return
  }

  function appendWatermarkPreviewItem(target) {
    var item = document.createElement('span')
    item.className = 'wi-watermark-preview-item'
    if (watermark.kind === 'image') {
      var image = document.createElement('img')
      image.src = watermark.image
      image.alt = ''
      item.appendChild(image)
    } else {
      item.textContent = watermark.text
    }
    target.appendChild(item)
  }

  if (watermark.coverage === 'full') {
    var previewCell = Math.min(66, Math.max(38, watermark.spacing / 4))
    var previewWidth = Math.max(620, Number(container.clientWidth) || 0)
    var previewHeight = Math.max(190, Number(container.clientHeight) || 0)
    var columnCount = Math.ceil(previewWidth / previewCell) + 3
    var rowCount = Math.ceil(previewHeight / previewCell) + 3
    var pattern = document.createElement('div')
    pattern.className = 'wi-watermark-preview-pattern'
    for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      var row = document.createElement('div')
      row.className = 'wi-watermark-preview-row'
      row.dataset.offset = watermark.pattern === 'cross' && rowIndex % 2 === 1 ? 'staggered' : 'base'
      for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) appendWatermarkPreviewItem(row)
      pattern.appendChild(row)
    }
    container.appendChild(pattern)
  } else {
    appendWatermarkPreviewItem(container)
  }
}

function watermarkSelectOptions(options, selected) {
  return options.map(function(option) {
    return '<option value="' + option.value + '"' + (option.value === selected ? ' selected' : '') + '>' + option.label + '</option>'
  }).join('')
}

function workWatermarkSettingsHtml(candidate) {
  var watermark = normalizeWorkWatermark(candidate)
  var kind = watermark.kind
  return '<section class="wi-watermark-section" aria-labelledby="wiWatermarkHeading">' +
    '<div class="wi-watermark-heading"><span><strong id="wiWatermarkHeading">作者水印</strong><small>随导出文件传播，读者界面不提供关闭入口</small></span>' +
    '<label class="wi-watermark-toggle"><input type="checkbox" id="wiWatermarkEnabled"' + (watermark.enabled ? ' checked' : '') + '><span>启用</span></label></div>' +
    '<div class="wi-watermark-fields" id="wiWatermarkFields">' +
    '<div class="wi-watermark-choice-row" role="radiogroup" aria-label="水印内容类型">' +
    '<label class="wi-watermark-choice"><input type="radio" name="wiWatermarkKind" value="text"' + (kind === 'text' ? ' checked' : '') + '><span>文字</span></label>' +
    '<label class="wi-watermark-choice"><input type="radio" name="wiWatermarkKind" value="image"' + (kind === 'image' ? ' checked' : '') + '><span>图片</span></label></div>' +
    '<div class="wi-watermark-kind" data-wi-watermark-kind="text"><label class="wi-label" for="wiWatermarkText">水印文字</label><input class="wi-input" id="wiWatermarkText" maxlength="80" value="' + escHtml(watermark.text) + '" placeholder="例如：纯代乙向禁止偷吃"></div>' +
    '<div class="wi-watermark-kind" data-wi-watermark-kind="image"><span class="wi-label">水印图片</span><div class="wi-watermark-image-actions"><input class="wi-visually-hidden" type="file" id="wiWatermarkImage" accept="image/png,image/jpeg,image/webp"><label class="wi-watermark-upload" for="wiWatermarkImage" role="button" tabindex="0">选择本地图片</label><button class="btn btn-sm btn-ghost" type="button" id="wiWatermarkImageClear">清除图片</button><span id="wiWatermarkImageName" class="wi-help">' + (watermark.image ? '已选择内嵌图片' : 'PNG、JPG 或 WebP，最大 1 MiB') + '</span></div></div>' +
    '<div class="wi-watermark-grid">' +
    '<label class="wi-row" for="wiWatermarkOpacity"><span class="wi-label">透明度 <output id="wiWatermarkOpacityValue">' + Math.round(watermark.opacity * 100) + '%</output></span><input type="range" id="wiWatermarkOpacity" min="5" max="45" step="1" value="' + Math.round(watermark.opacity * 100) + '"></label>' +
    '<label class="wi-row" for="wiWatermarkCoverage"><span class="wi-label">显示范围</span><select class="wi-input" id="wiWatermarkCoverage">' + watermarkSelectOptions([{value:'single',label:'固定在一处'},{value:'full',label:'铺满页面'}], watermark.coverage) + '</select></label>' +
    '<label class="wi-row" for="wiWatermarkPosition" data-wi-watermark-single><span class="wi-label">水印位置</span><select class="wi-input" id="wiWatermarkPosition">' + watermarkSelectOptions([{value:'top-left',label:'左上'},{value:'top-right',label:'右上'},{value:'center',label:'居中'},{value:'bottom-left',label:'左下'},{value:'bottom-right',label:'右下'}], watermark.position) + '</select></label>' +
    '<label class="wi-row" for="wiWatermarkPattern" data-wi-watermark-full><span class="wi-label">铺放样式</span><select class="wi-input" id="wiWatermarkPattern">' + watermarkSelectOptions([{value:'diagonal',label:'同向斜排'},{value:'cross',label:'交叉斜排'}], watermark.pattern) + '</select></label>' +
    '<label class="wi-row" for="wiWatermarkSpacing" data-wi-watermark-full><span class="wi-label">水印间距 <output id="wiWatermarkSpacingValue">' + watermark.spacing + 'px</output></span><input type="range" id="wiWatermarkSpacing" min="80" max="260" step="10" value="' + watermark.spacing + '"></label>' +
    '</div>' +
    '<div class="wi-watermark-preview" id="wiWatermarkPreview" aria-label="水印效果预览"></div>' +
    '<p class="wi-watermark-status" id="wiWatermarkStatus" role="status" aria-live="polite"></p>' +
    '</div></section>'
}

window.editWorkInfo = function(id){
  var w = getWorks().find(function(x){ return x.id === id })
  if (!w) return
  var expectedWorkToken = createJsonToken(w)
  var trigger = document.activeElement
  var watermarkDraft = normalizeWorkWatermark(w.watermark)
  var body = '<div class="wi-form">'
  body += '<div class="wi-row"><label class="wi-label">作品标题</label><input class="wi-input" id="wiTitle" value="' + escHtml(w.title || '') + '" placeholder="作品标题"></div>'
  body += '<div class="wi-row"><label class="wi-label">作品描述</label><textarea class="wi-textarea" id="wiDesc" rows="3" placeholder="简单介绍这部作品...">' + escHtml(w.desc || '') + '</textarea></div>'
  body += '<div class="wi-row"><label class="wi-label">作者署名</label><input class="wi-input" id="wiAuthor" value="' + escHtml(w.author || '') + '" placeholder="作者署名"></div>'
  body += '<div class="wi-row"><label class="wi-label">作者有话说</label><textarea class="wi-textarea" id="wiNote" rows="3" placeholder="想对读者说的话...">' + escHtml(w.authorNote || '') + '</textarea></div>'
  body += '<div class="wi-row"><label class="wi-label">阅读密码（选填）</label><input class="wi-input" id="wiPwd" value="' + escHtml(w.password || '') + '" placeholder="设置后读者需输入密码"><div class="wi-help">阅读密码仅限制通过阅读界面进入，不会加密导出的 JSON 或 PNG 文件。</div></div>'
  body += workWatermarkSettingsHtml(watermarkDraft)
  body += '</div>'
  var ov = document.createElement('div')
  ov.className = 'modal-overlay'
  ov.style.cssText = 'z-index:2000'
  ov.innerHTML = '<div class="modal wi-modal" role="dialog" aria-labelledby="wiTitleLabel"><div class="modal-header"><span class="modal-title" id="wiTitleLabel">作品信息</span><button class="btn-icon" id="wiCloseBtn" type="button" aria-label="关闭" style="font-size:1.2rem;cursor:pointer;border:none;background:transparent;color:var(--c-text2)">&times;</button></div><div class="modal-body">' + body + '<div id="wiStatus" role="status" aria-live="polite" style="min-height:1.4em;margin-top:10px;color:var(--c-accent3)"></div></div><div class="modal-footer"><button class="btn btn-primary" id="wiSaveBtn">保存</button><button class="btn btn-ghost" id="wiCancelBtn" type="button">取消</button></div></div>'
  document.body.appendChild(ov)
  var watermarkFields = ov.querySelector('#wiWatermarkFields')
  var watermarkStatus = ov.querySelector('#wiWatermarkStatus')
  var watermarkPreview = ov.querySelector('#wiWatermarkPreview')
  var watermarkImageName = ov.querySelector('#wiWatermarkImageName')

  function setWatermarkStatus(message, error) {
    if (!watermarkStatus) return
    watermarkStatus.textContent = message || ''
    watermarkStatus.classList.toggle('is-error', !!error)
  }

  function refreshWatermarkControls() {
    watermarkDraft = normalizeWorkWatermark(watermarkDraft)
    if (watermarkFields) watermarkFields.hidden = !watermarkDraft.enabled
    ov.querySelectorAll('[data-wi-watermark-kind]').forEach(function(panel) {
      panel.hidden = panel.dataset.wiWatermarkKind !== watermarkDraft.kind
    })
    ov.querySelectorAll('[data-wi-watermark-single]').forEach(function(row) {
      row.hidden = watermarkDraft.coverage !== 'single'
    })
    ov.querySelectorAll('[data-wi-watermark-full]').forEach(function(row) {
      row.hidden = watermarkDraft.coverage !== 'full'
    })
    var opacityValue = ov.querySelector('#wiWatermarkOpacityValue')
    if (opacityValue) opacityValue.textContent = Math.round(watermarkDraft.opacity * 100) + '%'
    var spacingValue = ov.querySelector('#wiWatermarkSpacingValue')
    if (spacingValue) spacingValue.textContent = watermarkDraft.spacing + 'px'
    if (watermarkImageName) watermarkImageName.textContent = watermarkDraft.image ? '已选择内嵌图片' : 'PNG、JPG 或 WebP，最大 1 MiB'
    renderWorkWatermarkPreview(watermarkPreview, watermarkDraft)
  }

  var watermarkEnabled = ov.querySelector('#wiWatermarkEnabled')
  if (watermarkEnabled) watermarkEnabled.onchange = function() {
    watermarkDraft.enabled = this.checked
    setWatermarkStatus('')
    refreshWatermarkControls()
  }
  ov.querySelectorAll('input[name="wiWatermarkKind"]').forEach(function(input) {
    input.onchange = function() {
      if (!this.checked) return
      watermarkDraft.kind = this.value
      setWatermarkStatus('')
      refreshWatermarkControls()
    }
  })
  var watermarkText = ov.querySelector('#wiWatermarkText')
  if (watermarkText) watermarkText.oninput = function() {
    watermarkDraft.text = this.value
    setWatermarkStatus('')
    refreshWatermarkControls()
  }
  var watermarkOpacity = ov.querySelector('#wiWatermarkOpacity')
  if (watermarkOpacity) watermarkOpacity.oninput = function() {
    watermarkDraft.opacity = Number(this.value) / 100
    refreshWatermarkControls()
  }
  var watermarkCoverage = ov.querySelector('#wiWatermarkCoverage')
  if (watermarkCoverage) watermarkCoverage.onchange = function() {
    watermarkDraft.coverage = this.value
    refreshWatermarkControls()
  }
  var watermarkPosition = ov.querySelector('#wiWatermarkPosition')
  if (watermarkPosition) watermarkPosition.onchange = function() {
    watermarkDraft.position = this.value
    refreshWatermarkControls()
  }
  var watermarkPattern = ov.querySelector('#wiWatermarkPattern')
  if (watermarkPattern) watermarkPattern.onchange = function() {
    watermarkDraft.pattern = this.value
    refreshWatermarkControls()
  }
  var watermarkSpacing = ov.querySelector('#wiWatermarkSpacing')
  if (watermarkSpacing) watermarkSpacing.oninput = function() {
    watermarkDraft.spacing = Number(this.value)
    refreshWatermarkControls()
  }
  var watermarkImage = ov.querySelector('#wiWatermarkImage')
  var watermarkUpload = ov.querySelector('.wi-watermark-upload')
  if (watermarkUpload) watermarkUpload.onkeydown = function(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    watermarkImage?.click()
  }
  if (watermarkImage) watermarkImage.onchange = function() {
    var file = this.files && this.files[0]
    if (!file) return
    if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type || '') || !Number.isFinite(file.size) || file.size <= 0 || file.size > WORK_WATERMARK_IMAGE_MAX_BYTES) {
      setWatermarkStatus('请选择 1 MiB 以内的 PNG、JPG 或 WebP 图片。', true)
      this.value = ''
      return
    }
    var reader = new FileReader()
    reader.onerror = function() { setWatermarkStatus('图片读取失败，请换一张再试。', true) }
    reader.onload = function() {
      var candidate = normalizeWorkWatermark(Object.assign({}, watermarkDraft, { image: reader.result }))
      if (!candidate.image) {
        setWatermarkStatus('图片内容无效，请换一张再试。', true)
        return
      }
      watermarkDraft = candidate
      setWatermarkStatus('图片已嵌入作品，导出后可离线显示。')
      refreshWatermarkControls()
    }
    reader.readAsDataURL(file)
  }
  var clearWatermarkImage = ov.querySelector('#wiWatermarkImageClear')
  if (clearWatermarkImage) clearWatermarkImage.onclick = function() {
    watermarkDraft.image = null
    if (watermarkImage) watermarkImage.value = ''
    setWatermarkStatus('已清除水印图片。')
    refreshWatermarkControls()
  }
  refreshWatermarkControls()

  var requestClose = function(){
    if (ov.querySelector('#wiSaveBtn')?.disabled) return
    ov.remove()
    trigger?.focus?.()
  }
  ov.querySelector('#wiCloseBtn').onclick = requestClose
  ov.querySelector('#wiCancelBtn').onclick = requestClose
  ov.addEventListener('click', function(e) { if (e.target === ov) requestClose() })
  ov.querySelector('#wiSaveBtn').onclick = function(){
    var password = (document.getElementById('wiPwd')?.value || '').trim()
    watermarkDraft = normalizeWorkWatermark(watermarkDraft)
    if (watermarkDraft.enabled && !hasRenderableWorkWatermark(watermarkDraft)) {
      setWatermarkStatus(watermarkDraft.kind === 'image' ? '请先选择一张水印图片。' : '请填写水印文字。', true)
      if (watermarkDraft.kind === 'image') ov.querySelector('.wi-watermark-upload')?.focus()
      else watermarkText?.focus()
      return
    }
    var result = homeWriteController.update({
      workId: id,
      expectedWorkToken: expectedWorkToken,
      patch: {
        title: (document.getElementById('wiTitle')?.value || '').trim() || w.title,
        desc: (document.getElementById('wiDesc')?.value || '').trim(),
        author: (document.getElementById('wiAuthor')?.value || '').trim(),
        authorNote: (document.getElementById('wiNote')?.value || '').trim(),
        password: password,
        locked: !!password,
        watermark: normalizeWorkWatermark(watermarkDraft)
      },
      close: function(){ ov.remove() }
    })
    if (result instanceof Promise) result.catch(function(){})
    return result
  }
}


// Work card dropdown menu handlers
window.toggleWorkMenu = function(event, id) {
  var menu = document.getElementById('workMenu-' + id)
  if (!menu) return
  document.querySelectorAll('.work-card-more-popover.open').forEach(function(m) {
    if (m !== menu) {
      m.classList.remove('open')
      m.closest('.work-card')?.classList.remove('menu-open')
    }
  })
  menu.classList.toggle('open')
  menu.closest('.work-card')?.classList.toggle('menu-open', menu.classList.contains('open'))
}

window.closeWorkMenu = function(id) {
  var menu = document.getElementById('workMenu-' + id)
  if (menu) {
    menu.classList.remove('open')
    menu.closest('.work-card')?.classList.remove('menu-open')
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.work-card-more-wrap')) {
    document.querySelectorAll('.work-card-more-popover.open').forEach(function(m) {
      m.classList.remove('open')
      m.closest('.work-card')?.classList.remove('menu-open')
    })
  }
})
// Re-export for dynamic reload
window.renderWorkList = renderWorkList
window.getWorks = getWorks
window.WORK_TYPE = WORK_TYPE
window.escHtml = escHtml
