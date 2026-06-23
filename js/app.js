import { navigate, initRouter, router } from "./router.js"
import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork } from "./data.js"

// ==================== Render helpers ====================
export function h(tag, attrs={}, ...children){
  const el = document.createElement(tag)
  for(const [k,v] of Object.entries(attrs)){
    if(k==="className") el.className=v
    else if(k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v)
    else if(k==="style"&&typeof v==="object") Object.assign(el.style, v)
    else if(k==="html") el.innerHTML=v
    else if(k==="dataset") Object.assign(el.dataset, v)
    else el.setAttribute(k, v)
  }
  for(const c of children.flat()){
    if(c!=null&&c!==false) el.append(typeof c==="string"?document.createTextNode(c):c)
  }
  return el
}

export function empty(el){while(el.firstChild) el.removeChild(el.firstChild)}

export function showToast(msg, type="success"){
  const t = document.createElement("div")
  t.className = "toast "+type
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(()=>t.remove(), 3000)
}

export function modal(title, bodyHtml, footerHtml, onClose){
  const overlay = document.createElement("div")
  overlay.className = "modal-overlay"
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><span class="modal-title">${title}</span><span class="btn-ghost btn-icon" style="cursor:pointer;font-size:1.2rem" id="modalClose">&times;</span></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml?`<div class="modal-footer">${footerHtml}</div>`:""}
    </div>`
  document.body.appendChild(overlay)
  overlay.querySelector("#modalClose")?.addEventListener("click",()=>{overlay.remove();onClose?.()})
  overlay.addEventListener("click",e=>{if(e.target===overlay){overlay.remove();onClose?.()}})
  return overlay
}

// ==================== Toast system ====================
window.__toast = showToast

// ==================== Header ====================
function renderHeader(){
  const path = location.hash.slice(1).split("?")[0]||"/"
  return `<header class="app-header">
    <a class="logo" href="#/" onclick="event.preventDefault();navigate('/')">RW Tuuru</a>
    <nav>
      <a href="#/" class="${path==="/"?"active":""}">首页</a>
      <a href="#/new" class="${path==="/new"?"active":""}">新建</a>
    </nav>
  </header>`
}

// ==================== Pages ====================
import { renderHome } from "./pages/home.js"
import { renderNew } from "./pages/new.js"
import { renderEditor } from "./pages/editor.js"
import { renderReader } from "./pages/reader.js"

// ==================== Init ====================
export function init(){
  const app = document.getElementById("app")
  
  router("/", (container) => {
    app.innerHTML = renderHeader() + '<main class="app-main">'+renderHome()+'</main>'
  })
  
  router("/new", (container) => {
    app.innerHTML = renderHeader() + '<main class="app-main narrow">'+renderNew()+'</main>'
  })
  
  router("/edit/:id", (container, p) => {
    app.innerHTML = renderHeader() + renderEditor(p.id)
  })
  
  router("/read/:id", (container, p) => {
    app.innerHTML = renderHeader() + '<main class="app-main narrow">'+renderReader(p.id)+'</main>'
  })
  
  // Expose navigate globally
  window.navigate = navigate
  window.showToast = showToast
  
  initRouter(app)
}

// Auto-init
document.addEventListener("DOMContentLoaded", init)
