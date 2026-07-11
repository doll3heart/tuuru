import { navigate, initRouter, router } from "./router.js"
import { getWorks, getWorksByType, createWork, deleteWork, duplicateWork } from "./data.js"
import { discardCorruptLocalDatabase, inspectLocalDatabase } from "./storage.js"
import { pickReadableColor } from "./color-contrast.js"
import { startLocalLibraryRestore } from "./library-restore-ui.js"
import { downloadBlob } from "./download.js"

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


// ==================== Theme ====================

// ---- Color utilities ----
function hexToRgb(h) {
  var r=0,g=0,b=0
  if(h.length===4){r=parseInt(h[1]+h[1],16);g=parseInt(h[2]+h[2],16);b=parseInt(h[3]+h[3],16)}
  else{r=parseInt(h.substring(1,3),16);g=parseInt(h.substring(3,5),16);b=parseInt(h.substring(5,7),16)}
  return{r:r,g:g,b:b}
}
function rgbToHex(r,g,b){return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}
function luminance(h){var c=hexToRgb(h);return 0.299*c.r+0.587*c.g+0.114*c.b}
function mix(a,b,t){var ca=hexToRgb(a),cb=hexToRgb(b);return rgbToHex(Math.round(ca.r+(cb.r-ca.r)*t),Math.round(ca.g+(cb.g-ca.g)*t),Math.round(ca.b+(cb.b-ca.b)*t))}
function rgba(h,a){var c=hexToRgb(h);return'rgba('+c.r+','+c.g+','+c.b+','+a+')'}

// ---- Preset definitions ----
export var THEME_PRESETS = [
  {id:'sky',name:'水色',dot:'#A4C6EB'},
  {id:'sakura',name:'樱花',dot:'#F0D9E4',bg:'#F0D9E4',text:'#16131F',primary:'#C1A0AC',accent3:'#4A3F4B'},
  {id:'deep',name:'苍闇',dot:'#07080C',bg:'#07080C',surface:'#333C50',text:'#CAD9F5',primary:'#546282',text2:'#9CB2E8'},
  {id:'coastal',name:'海岸',dot:'#E3D6BF',bg:'#E3D6BF',text:'#933B5B',primary:'#B5728A',surface2:'#AABAAE',text2:'#9F9679'},
  {id:'fairisle',name:'费尔岛',dot:'#DEC6A7',bg:'#DEC6A7',text:'#352C29',primary:'#258986',accent3:'#143247'},
  {id:'mint',name:'薄荷生巧',dot:'#D5EAE3',bg:'#D5EAE3',text:'#775C55',primary:'#F8F4E9',accent3:'#FDD3D5'}
]

// ---- Generate all 15 CSS variables from a preset ----
export function generateVars(p) {
  if (!p.bg) return null
  var isLight = luminance(p.bg) > 128
  var s = p.surface || mix(p.bg,'#ffffff',isLight?0.15:0.06)
  var s2 = p.surface2 || mix(s,p.bg,0.5)
  var t2 = p.text2 || rgba(p.text,0.5)
  var ph = luminance(p.primary)>128 ? mix(p.primary,'#000000',0.08) : mix(p.primary,'#ffffff',0.15)
  var b = p.border || mix(s,'#000000',isLight?0.12:0.25)
  var b2 = mix(b,'#000000',0.08)
  var a3 = p.accent3 || (isLight?'#b04040':'#d07070')
  var a = mix(p.bg,a3,0.08)
  var a2 = mix(p.bg,a3,0.04)
  return {
    '--c-bg':p.bg, '--c-surface':s, '--c-surface2':s2,
    '--c-primary':p.primary, '--c-primary-hover':ph,
    '--c-text':p.text, '--c-text2':t2,
    '--c-border':b, '--c-border2':b2,
    '--c-accent':a, '--c-accent2':a2, '--c-accent3':a3,
    '--c-msg-self':isLight?'#555':'#3a3a3a', '--c-msg-other':s,
    '--shadow':isLight?'0 1px 3px rgba(0,0,0,.08)':'0 1px 4px rgba(0,0,0,.5)',
    '--shadow-md':isLight?'0 4px 12px rgba(0,0,0,.1)':'0 4px 16px rgba(0,0,0,.45)',
    '--c-btn-text':pickReadableColor(p.primary,[p.text]),
    '--c-btn-hover-text':pickReadableColor(ph,[p.text])
  }
}

// ---- Apply a preset by key ----
function getTheme() {
  try { return localStorage.getItem('tuuru_theme') || 'sky' }
  catch { return 'sky' }
}
function applyTheme(key) {
  var p = THEME_PRESETS.find(function(x){return x.id===key})
  var vars = p ? generateVars(p) : null
  var root = document.documentElement
  root.removeAttribute('data-theme')
  THEME_PRESETS.forEach(function(pr){
    if(!pr.bg)return
    var v=generateVars(pr)
    if(v)Object.keys(v).forEach(function(k){root.style.removeProperty(k)})
  })
  if (vars) {
    Object.keys(vars).forEach(function(k){root.style.setProperty(k,vars[k])})
  }
}
applyTheme(getTheme())

window.setTheme = function(key) {
  localStorage.setItem('tuuru_theme', key)
  applyTheme(key)
  var pop = document.getElementById('themePopover')
  if (pop) pop.classList.remove('open')
  setTimeout(function(){
    var btns = document.querySelectorAll('.theme-option')
    btns.forEach(function(b){b.classList.toggle('active',b.dataset.theme===key)})
  },50)
}

window.toggleThemePopover = function(e) {
  e.stopPropagation()
  var pop = document.getElementById('themePopover')
  if(pop)pop.classList.toggle('open')
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.theme-wrap')) {
    var pop = document.getElementById('themePopover')
    if (pop) pop.classList.remove('open')
  }
})

// ==================== Header ====================
export function renderHeader(){
  const path = location.hash.slice(1).split("?")[0]||"/"
  return `<header class="app-header">
    <a class="logo" href="#/" onclick="event.preventDefault();navigate('/')">Tuuru<span style="font-size:.55rem;color:var(--c-text2);opacity:.35;margin-left:6px;font-weight:400;white-space:nowrap">moirain.com</span></a>
    <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
      <div class="theme-wrap">
        <button class="btn btn-sm btn-ghost" onclick="toggleThemePopover(event)" title="外观">外观</button>
        <div class="theme-popover" id="themePopover">
          <button class="theme-option active" data-theme="sky" onclick="event.preventDefault();setTheme('sky')"><span class="dot" style="background:#A4C6EB"></span>水色</button>
          <button class="theme-option" data-theme="sakura" onclick="event.preventDefault();setTheme('sakura')"><span class="dot" style="background:#F0D9E4"></span>樱花</button>
          <button class="theme-option" data-theme="deep" onclick="event.preventDefault();setTheme('deep')"><span class="dot" style="background:#07080C"></span>苍闇</button>
          <button class="theme-option" data-theme="coastal" onclick="event.preventDefault();setTheme('coastal')"><span class="dot" style="background:#E3D6BF"></span>海岸</button>
          <button class="theme-option" data-theme="fairisle" onclick="event.preventDefault();setTheme('fairisle')"><span class="dot" style="background:#DEC6A7"></span>费尔岛</button>
          <button class="theme-option" data-theme="mint" onclick="event.preventDefault();setTheme('mint')"><span class="dot" style="background:#F8F4E9"></span>薄荷生巧</button>
        </div>
      </div>
      <nav>
        <a href="#/" class="${path==="/"?"active":""}">首页</a>
        <a href="#/new" class="${path==="/new"?"active":""}">新建</a>
      </nav>
    </div>
  </header>`
}

// ==================== Pages ====================
import { renderHome } from "./pages/home.js"
import { renderNew } from "./pages/new.js"
import { renderEditor } from "./pages/editor.js"
import { renderReader } from "./pages/reader.js"
import { renderPhoneEditor } from "./pages/phone.js"

// ==================== Init ====================
export function renderStorageRecovery(container, status, {
  startRestore = startLocalLibraryRestore,
  download = downloadBlob,
  notify = showToast,
  now = () => new Date(),
} = {}) {
  empty(container)

  const title = h("h1", {}, "本地作品数据需要恢复")
  const summary = h(
    "p",
    { className: "text-muted" },
    "Tuuru 检测到本地作品数据无法安全读取。为防止覆盖原始内容，编辑和保存功能已暂停。",
  )
  const detail = h("pre", {
    style: {
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      padding: "12px",
      borderRadius: "8px",
      background: "var(--c-surface2)",
      color: "var(--c-text2)",
      fontSize: ".8rem",
    },
  }, status.message)
  const actions = h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" } })

  if (status.raw !== null) {
    actions.append(h("button", {
      className: "btn btn-primary",
      onClick: () => {
        try {
          const timestamp = now().toISOString().replace(/[:.]/g, "-")
          const blob = new Blob([status.raw], { type: "text/plain;charset=utf-8" })
          download(blob, `tuuru-recovery-${timestamp}.txt`)
        } catch (error) {
          const detail = error instanceof Error ? error.message : "无法发起下载"
          notify(`原始数据下载失败：${detail}`, "error")
          return
        }
        notify("原始数据下载已发起；请确认文件可用后再恢复或重置。", "success")
      },
    }, "下载原始数据"))
  }

  if (status.raw !== null && (status.code === "invalid-json" || status.code === "invalid-structure")) {
    actions.append(h("button", {
      className: "btn btn-outline",
      onClick: event => {
        const controller = startRestore({
          modal,
          notify,
          reload: () => location.reload(),
        })
        controller.pickFile(event.currentTarget)
      },
    }, "从完整备份恢复"))
  }

  actions.append(h("button", {
    className: "btn btn-ghost",
    onClick: () => location.reload(),
  }, "重新检测"))

  if (status.raw !== null && (status.code === "invalid-json" || status.code === "invalid-structure")) {
    actions.append(h("button", {
      className: "btn btn-danger",
      onClick: () => {
        const answer = prompt("重置会永久删除当前损坏的数据。请先下载原始数据，然后输入 RESET 继续：")
        if (answer !== "RESET") return

        try {
          discardCorruptLocalDatabase()
          location.reload()
        } catch (error) {
          notify(error instanceof Error ? error.message : "重置失败", "error")
        }
      },
    }, "重置本地数据库"))
  }

  const card = h("section", { className: "card", style: { padding: "24px", marginTop: "24px" } },
    title,
    summary,
    detail,
    h("p", { className: "text-muted", style: { marginTop: "12px", fontSize: ".8rem" } },
      "所有恢复操作都在当前浏览器内完成，数据不会上传。",
    ),
    actions,
  )
  container.append(h("main", { className: "app-main narrow" }, card))
}

export function init(){
  const app = document.getElementById("app")
  const storageStatus = inspectLocalDatabase()
  if (!storageStatus.ok) {
    renderStorageRecovery(app, storageStatus)
    return
  }
  
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

  router("/phone/:id", (container, p) => {
    app.innerHTML = renderHeader() + renderPhoneEditor(p.id)
  })
  
  // Expose navigate globally
  window.navigate = navigate
  window.showToast = showToast
  
  initRouter(app)
}

// Auto-init
document.addEventListener("DOMContentLoaded", init)
