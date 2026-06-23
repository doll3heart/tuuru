import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork, WORK_TYPE, uid } from "../data.js"
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
      <div class="work-card-cover" style="background:${w.coverColor||"#6366f1"}">${w.type===WORK_TYPE.PHONE?"N":"N"}
      </div>
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
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();navigate('/edit/${w.id}')">编辑</button>
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();navigate('/read/${w.id}')">阅读</button>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();prompt('复制作品ID:', '${w.id}')"></button>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();dupWork('${w.id}')"></button>
        <button class="btn btn-sm btn-ghost" style="color:var(--c-danger)" onclick="event.stopPropagation();delWork('${w.id}')"></button>
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

window.dupWork = function(id){
  duplicateWork(id)
  showToast("已复制","info")
  const list = document.getElementById("workList")
  if(list) list.innerHTML = renderWorkList(getWorks())
}

// Re-export for dynamic reload
window.renderWorkList = renderWorkList
window.getWorks = getWorks
window.WORK_TYPE = WORK_TYPE
window.escHtml = escHtml
