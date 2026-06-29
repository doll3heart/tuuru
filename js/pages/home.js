import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork, exportWorkAsJSON, encodeSteganoPNG, WORK_TYPE, uid } from "../data.js"
import { navigate } from "../router.js"
import { showToast } from "../app.js"

export function renderHome(){
  const works = getWorks()
  const articles = works.filter(w=>w.type===WORK_TYPE.ARTICLE)
  const phones = works.filter(w=>w.type===WORK_TYPE.PHONE)
  
  return `
    <div class="flex-between mb-4">
      <h2 style="font-size:1.2rem;font-weight:600">我的作品</h2>
      <div class="flex-row">
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
          ${w.locked?`<span style="color:var(--c-accent)">🔒 已加密</span>`:""}
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
    ov.querySelector('#pngExportBtn').onclick = function() {
      ov.querySelector('#pngExportBtn').textContent = '编码中...'
      ov.querySelector('#pngExportBtn').disabled = true
      encodeSteganoPNG(json, coverUrl, function(dataUrl) {
        var a = document.createElement('a')
        a.href = dataUrl
        a.download = title + '.png'
        a.click()
        showToast('PNG 已导出', 'success')
        ov.remove()
      })
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
  var title = prompt('作品标题:', w.title || '')
  if (title === null) return
  var desc = prompt('作品简介:', w.desc || '')
  if (desc === null) return
  var author = prompt('作者署名:', w.author || '')
  if (author === null) return
  w.title = title
  w.desc = desc
  w.author = author
  w.updatedAt = Date.now()
  var db = JSON.parse(localStorage.getItem('tuuru_works'))
  var idx = db.works.findIndex(function(x){ return x.id === id })
  if (idx >= 0) { db.works[idx] = w; localStorage.setItem('tuuru_works', JSON.stringify(db)) }
  showToast('作品信息已更新')
  var list = document.getElementById('workList')
  if (list) list.innerHTML = renderWorkList(getWorks())
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
