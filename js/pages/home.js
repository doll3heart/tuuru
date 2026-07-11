import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork, updateWork, exportWorkAsJSON, encodeSteganoPNG, WORK_TYPE, uid } from "../data.js"
import { navigate } from "../router.js"
import { modal, showToast } from "../app.js"
import { downloadBlob } from "../download.js"
import { startLocalLibraryRestore } from "../library-restore-ui.js"
import { serializeLocalDatabaseBackup } from "../storage.js"

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
    <div class="flex-between mb-4">
      <h2 style="font-size:1.2rem;font-weight:600">我的作品</h2>
      <div class="flex-row">
        <button class="btn btn-outline" onclick="backupLibrary()" title="包含密码、私密内容、编辑设置与作者配置，仅下载到本机">备份全部作品</button>
        <button class="btn btn-outline" id="backupInspectBtn" onclick="restoreLibraryBackup()" title="检查备份并可在确认后替换整个本地创作库；所有操作仅在当前浏览器内完成">检查 / 恢复备份</button>
        <button class="btn btn-primary" onclick="navigate('/new')"> 新建作品</button>
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
    return `<div class="empty-state"><div class="icon"></div><h3>还没有作品</h3><p>点击右上角「新建作品」开始创作</p></div>`
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
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();delWork('${w.id}')">删除</button>
        </div>
        <div class="work-card-more-wrap">
          <button class="btn btn-sm btn-ghost work-card-more-btn" onclick="event.stopPropagation();toggleWorkMenu(event,'${w.id}')">更多</button>
          <div class="work-card-more-popover" id="workMenu-${w.id}">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();editWorkInfo('${w.id}');closeWorkMenu('${w.id}')">作品信息</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();dupWork('${w.id}');closeWorkMenu('${w.id}')">复制作品</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();expWork('${w.id}');closeWorkMenu('${w.id}')">导出 JSON</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();expPNG('${w.id}');closeWorkMenu('${w.id}')">导出 PNG</button>
          </div>
        </div>
      </div>
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

window.delWork = function(id){
  if(!confirm("确定删除这个作品吗？")) return
  deleteWork(id)
  showToast("已删除","info")
  const list = document.getElementById("workList")
  if(list) list.innerHTML = renderWorkList(getWorks())
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
  duplicateWork(id)
  showToast("已复制","info")
  const list = document.getElementById("workList")
  if(list) list.innerHTML = renderWorkList(getWorks())
}

window.editWorkInfo = function(id){
  var w = getWorks().find(function(x){ return x.id === id })
  if (!w) return
  var body = '<div class="wi-form">'
  body += '<div class="wi-row"><label class="wi-label">作品标题</label><input class="wi-input" id="wiTitle" value="' + escHtml(w.title || '') + '" placeholder="作品标题"></div>'
  body += '<div class="wi-row"><label class="wi-label">作者署名</label><input class="wi-input" id="wiAuthor" value="' + escHtml(w.author || '') + '" placeholder="作者署名"></div>'
  body += '<div class="wi-row"><label class="wi-label">作者有话说</label><textarea class="wi-textarea" id="wiNote" rows="3" placeholder="想对读者说的话...">' + escHtml(w.authorNote || '') + '</textarea></div>'
  body += '<div class="wi-row"><label class="wi-label">阅读密码（选填）</label><input class="wi-input" id="wiPwd" value="' + escHtml(w.password || '') + '" placeholder="设置后读者需输入密码"><div class="wi-help">阅读密码仅限制通过阅读界面进入，不会加密导出的 JSON 或 PNG 文件。</div></div>'
  body += '</div>'
  var ov = document.createElement('div')
  ov.className = 'modal-overlay'
  ov.style.cssText = 'z-index:2000'
  ov.innerHTML = '<div class="modal" style="max-width:480px"><div class="modal-header"><span class="modal-title">作品信息</span><button class="btn-icon" style="font-size:1.2rem;cursor:pointer;border:none;background:transparent;color:var(--c-text2)" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="modal-body">' + body + '</div><div class="modal-footer"><button class="btn btn-primary" id="wiSaveBtn">保存</button><button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">取消</button></div></div>'
  document.body.appendChild(ov)
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#wiSaveBtn').onclick = function(){
    var password = (document.getElementById('wiPwd')?.value || '').trim()
    var updated = updateWork(id, {
      title: (document.getElementById('wiTitle')?.value || '').trim() || w.title,
      author: (document.getElementById('wiAuthor')?.value || '').trim(),
      authorNote: (document.getElementById('wiNote')?.value || '').trim(),
      password: password,
      locked: !!password
    })
    if (!updated) { ov.remove(); return }
    showToast('作品信息已更新')
    ov.remove()
    var list = document.getElementById('workList')
    if (list) list.innerHTML = renderWorkList(getWorks())
  }
}


// Work card dropdown menu handlers
window.toggleWorkMenu = function(event, id) {
  var menu = document.getElementById('workMenu-' + id)
  if (!menu) return
  document.querySelectorAll('.work-card-more-popover.open').forEach(function(m) {
    if (m !== menu) m.classList.remove('open')
  })
  menu.classList.toggle('open')
}

window.closeWorkMenu = function(id) {
  var menu = document.getElementById('workMenu-' + id)
  if (menu) menu.classList.remove('open')
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.work-card-more-wrap')) {
    document.querySelectorAll('.work-card-more-popover.open').forEach(function(m) {
      m.classList.remove('open')
    })
  }
})
// Re-export for dynamic reload
window.renderWorkList = renderWorkList
window.getWorks = getWorks
window.WORK_TYPE = WORK_TYPE
window.escHtml = escHtml
