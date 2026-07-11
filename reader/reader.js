import { validateWorkForImport } from '../js/work-schema.js'
import { substitutePlaceholders } from '../js/placeholders.js'
import { escapeHtmlAttribute, sanitizeImportedWork } from '../js/sanitize.js'
import { shouldUseMotion } from '../js/motion-preference.js'
import { phoneGridContainerStyle, phoneGridItemStyle } from './phone-grid.js'
import { buildReaderPhoneModuleTrigger, markReaderPhoneModuleTriggerRead } from './reader-phone-module-trigger.js'

// Tuuru Reader
// 支持导入 .json / .png 文件，阅读文章或体验手机模拟器

// ---- helpers ----
function esc(s) {
  if (!s) return ''
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function readerAppName(app) {
  var name = String(app && app.name != null ? app.name : '').trim()
  return name || 'App'
}

function readerCustomIconUrl(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function focusReaderAppIcon(root, type) {
  var scope = root && typeof root.querySelectorAll === 'function' ? root : document
  var icons = scope.querySelectorAll('.phone-app-icon[data-app-type]')
  for (var i = 0; i < icons.length; i++) {
    if (icons[i].dataset.appType !== type) continue
    icons[i].focus()
    return true
  }
  return false
}

function focusReaderControl(root, selector) {
  var control = root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null
  if (!control) return false
  control.focus()
  return true
}

function avatarColor(id) {
  var AC = ["#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#64748b","#78716c"]
  if (!id) return AC[0]
  var h = 0
  for (var i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i)
  return AC[Math.abs(h) % AC.length]
}

var _work = null
var _nodeId = null
var _visitedNodes = []
var _renderedRecentIds = []

// ---- render ----
function render(el, html) {
  if (typeof el === 'string') el = document.getElementById(el)
  if (el) el.innerHTML = html
}

// ---- localStorage helpers ----
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('moirain_' + key)) } catch(e) { return null }
}
function lsSet(key, val) {
  localStorage.setItem('moirain_' + key, JSON.stringify(val))
}
function getProfile() {
  return lsGet('profile') || { readerId: '', readerAvatar: '', bio: '' }
}
function getPlaceholders() {
  return lsGet('placeholders') || {}
}
function getRecents() {
  return lsGet('recent') || []
}
function addRecent(work) {
  var recents = getRecents()
  recents = recents.filter(function(r) { return r.id !== work.id })
  recents.unshift({ id: work.id, title: work.title || 'Untitled', type: work.type || 'article', importedAt: Date.now() })
  if (recents.length > 20) recents.length = 20
  lsSet('recent', recents)
}

// ====== HOME (tabs: personal page + import) ======
function renderHome() {
  var h = '<div class="rd-home">'
  // Tabs
  h += '<div class="rd-tabs" role="tablist" aria-label="首页栏目">'
  h += '<button type="button" class="rd-tab active" id="rdTabPersonal" role="tab" aria-controls="tabPersonal" aria-selected="true" tabindex="0" data-tab="personal">个人主页</button>'
  h += '<button type="button" class="rd-tab" id="rdTabCustom" role="tab" aria-controls="tabCustom" aria-selected="false" tabindex="-1" data-tab="custom">美化</button>'
  h += '<button type="button" class="rd-tab" id="rdTabImport" role="tab" aria-controls="tabImport" aria-selected="false" tabindex="-1" data-tab="import">导入</button>'
  h += '</div>'
  // Tab panels
  h += '<div class="rd-panel" id="tabPersonal" role="tabpanel" aria-labelledby="rdTabPersonal">' + renderPersonalPage() + '</div>'
  h += '<div class="rd-panel" style="display:none" id="tabCustom" role="tabpanel" aria-labelledby="rdTabCustom" hidden>' + renderCustomPage() + '</div>'
  h += '<div class="rd-panel" style="display:none" id="tabImport" role="tabpanel" aria-labelledby="rdTabImport" hidden>' + renderImportPanel() + '</div>'
  h += '<div style="text-align:center;padding:16px;margin-top:20px;font-size:.6rem;color:var(--c-text2);opacity:.3"><a href="https://tuuru.chat" target="_blank" style="color:inherit;text-decoration:none">tuuru.chat</a></div>'
  h += '</div>'
  render('app', h)

  // Tab switching
  var tabs = document.querySelectorAll('.rd-tabs .rd-tab')
  function activateTab(t, moveFocus) {
    tabs.forEach(function(x) {
      var active = x === t
      x.classList.toggle('active', active)
      x.setAttribute('aria-selected', active ? 'true' : 'false')
      x.tabIndex = active ? 0 : -1
      var panel = document.getElementById(x.getAttribute('aria-controls'))
      if (panel) {
        panel.hidden = !active
        panel.style.display = active ? 'block' : 'none'
      }
    })
    var tab = t.dataset.tab
    if (moveFocus) t.focus()
    if (tab === 'personal') refreshPersonalPage()
    if (tab === 'custom') renderCustomPage()
  }
  tabs.forEach(function(t, index) {
    t.onclick = function() { activateTab(t, false) }
    t.onkeydown = function(event) {
      var nextIndex = null
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1
      if (nextIndex === null) return
      event.preventDefault()
      activateTab(tabs[nextIndex], true)
    }
  })

  // Setup import
  setupImport()
}

document.addEventListener('click', function(event) {
  var target = event.target && event.target.closest ? event.target : null
  if (!target) return

  var homeTrigger = target.closest('[data-reader-home]')
  if (homeTrigger) {
    event.preventDefault()
    renderHome()
    return
  }

  var recentTrigger = target.closest('[data-reader-recent-index]')
  if (!recentTrigger) return
  var recentIndex = Number(recentTrigger.dataset.readerRecentIndex)
  if (!Number.isInteger(recentIndex) || recentIndex < 0 || recentIndex >= _renderedRecentIds.length) return
  event.preventDefault()
  reimportRecent(_renderedRecentIds[recentIndex])
})

// ====== Personal Page ======
function renderPersonalPage() {
  var profile = getProfile()
  var recents = getRecents()
  _renderedRecentIds = recents.map(function(r) { return r.id })
  var h = '<div class="rd-personal">'
  // Profile card
  h += '<div class="rd-profile-card">'
  h += '<div class="rd-profile-avatar" onclick="document.getElementById(\'rdProfileAvatarInput\').click()" style="cursor:pointer">'
  if (profile.readerAvatar) {
    h += '<img src="' + esc(profile.readerAvatar) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
  }
  h += '</div>'
  h += '<input type="file" id="rdProfileAvatarInput" accept="image/*" style="display:none" onchange="handleProfileAvatar(this)">'
  h += '<div class="rd-profile-id" contenteditable="true" id="rdProfileId" onblur="saveProfileField(\'readerId\',this.textContent)">' + esc(profile.readerId || '点击设置昵称') + '</div>'
  h += '<div class="rd-profile-bio" contenteditable="true" id="rdProfileBio" onblur="saveProfileField(\'bio\',this.textContent)">' + esc(profile.bio || '点击设置简介') + '</div>'
  h += '</div>'

  // Placeholder presets
  var placeholders = getPlaceholders()
  h += '<div class="rd-preset-section">'
  h += '<div class="rd-preset-title">占位符预设</div>'
  h += '<div class="rd-preset-field"><label>姓名</label><input type="text" id="ps_name" value="' + esc(placeholders.name || '') + '" placeholder="对应「某某」" onchange="savePlaceholderPreset()"></div>'
  h += '<div class="rd-preset-field"><label>昵称</label><input type="text" id="ps_nickname" value="' + esc(placeholders.nickname || '') + '" placeholder="对应「小某」" onchange="savePlaceholderPreset()"></div>'
  h += '<div class="rd-preset-field"><label>网名</label><input type="text" id="ps_webname" value="' + esc(placeholders.webname || '') + '" placeholder="对应「wm」" onchange="savePlaceholderPreset()"></div>'
  h += '</div>'

  // Recents
  h += '<div class="rd-section">'
  h += '<div class="rd-section-title">最近阅读</div>'
  if (recents.length === 0) {
    h += '<div class="rd-empty">还没有阅读记录</div>'
  } else {
    recents.forEach(function(r, recentIndex) {
      h += '<button type="button" class="rd-recent-item" data-reader-recent-index="' + recentIndex + '">'
      h += '<span class="rd-recent-title">' + esc(r.title) + '</span>'
      h += '<span class="rd-recent-meta">' + (r.type === 'phone' ? '小手机' : '互动文章') + ' · ' + timeAgo(r.importedAt) + '</span>'
      h += '</button>'
    })
  }
  h += '</div>'
  h += '</div>'
  return h
}

function refreshPersonalPage() {
  var panel = document.getElementById('tabPersonal')
  if (panel) panel.innerHTML = renderPersonalPage()
}

window.saveProfileField = function(field, value) {
  var profile = getProfile()
  profile[field] = value || ''
  lsSet('profile', profile)
}

window.handleProfileAvatar = function(input) {
  var file = input.files[0]
  if (!file) return
  var reader = new FileReader()
  reader.onload = function() {
    var profile = getProfile()
    profile.readerAvatar = reader.result
    lsSet('profile', profile)
    refreshPersonalPage()
  }
  reader.readAsDataURL(file)
}

window.savePlaceholderPreset = function() {
  var presets = {
    name: document.getElementById('ps_name')?.value || '',
    nickname: document.getElementById('ps_nickname')?.value || '',
    webname: document.getElementById('ps_webname')?.value || ''
  }
  lsSet('placeholders', presets)
}

function reimportRecent(id) {
  // Load work from localStorage
  try {
    var db = JSON.parse(localStorage.getItem('moirain_work_' + id))
    if (!db) { alert('该作品已不在缓存中，请重新导入'); return }
    importWork(db)
  } catch(e) {
    alert('加载失败：' + e.message)
  }
}

// ====== Import Panel ======
function renderImportPanel() {
  var h = '<div class="drop-zone">'
  h += '<div class="drop-zone-inner" id="dropInner">'
  h += '<div class="drop-icon">&#128196;</div>'
  h += '<div class="drop-title">导入 Tuuru 作品</div>'
  h += '<div class="drop-desc">拖放 .json 或 .png 文件到此处，或点击下方按钮选择文件</div>'
  h += '<button class="drop-btn" id="pickFileBtn">选择文件</button>'
  h += '<input type="file" id="fileInput" accept=".json,.png" style="display:none">'
  h += '</div>'
  h += '</div>'
  return h
}

function setupImport() {
  var inner = document.getElementById('dropInner')
  var pickBtn = document.getElementById('pickFileBtn')
  var fileInput = document.getElementById('fileInput')

  function handleFile(file) {
    if (!file) return
    var ext = file.name.split('.').pop().toLowerCase()
    if (ext !== 'json' && ext !== 'png') {
      alert('请选择 .json 或 .png 文件')
      return
    }
    var reader = new FileReader()
    reader.onload = function() {
      if (ext === 'json') {
        try {
          var work = JSON.parse(reader.result)
          importWork(work)
        } catch (e) {
          alert('JSON 解析失败：' + e.message)
        }
      } else {
        // PNG stego decode
        decodeSteganoFromDataUrl(reader.result)
      }
    }
    if (ext === 'json') reader.readAsText(file)
    else reader.readAsDataURL(file)
  }

  // Drag & drop
  function onDragOver(e) {
    e.preventDefault()
    if (inner) inner.classList.add('drag-over')
  }
  function onDragLeave(e) {
    e.preventDefault()
    if (inner) inner.classList.remove('drag-over')
  }
  function onDrop(e) {
    e.preventDefault()
    if (inner) inner.classList.remove('drag-over')
    var file = e.dataTransfer.files[0]
    handleFile(file)
  }
  if (inner) {
    inner.addEventListener('dragover', onDragOver)
    inner.addEventListener('dragleave', onDragLeave)
    inner.addEventListener('drop', onDrop)
  }

  // Click to pick
  if (pickBtn) {
    pickBtn.onclick = function() {
      fileInput.click()
    }
  }
  if (fileInput) {
    fileInput.onchange = function() { handleFile(fileInput.files[0]) }
  }
}

function decodeSteganoFromDataUrl(dataUrl) {
  var img = new Image()
  img.onload = function() {
    var canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    var pixels = ctx.getImageData(0, 0, img.width, img.height).data
    // Read 4-byte header
    var header = [pixels[0], pixels[1], pixels[2], pixels[3]]
    var dataLen = (header[0]<<24)|(header[1]<<16)|(header[2]<<8)|header[3]
    if (dataLen <= 0 || dataLen > img.width*img.height*3 || dataLen > 10*1024*1024) { alert('未检测到隐写数据'); return }
    var bytes = new Uint8Array(dataLen)
    for (var i = 0; i < dataLen; i++) {
      var byteIdx = 4 + i
      var pixelIdx = Math.floor(byteIdx / 3) * 4 + (byteIdx % 3)
      bytes[i] = pixels[pixelIdx]
    }
    try {
      var json = new TextDecoder().decode(bytes)
      var work = JSON.parse(json)
      importWork(work)
    } catch(e) {
      alert('隐写数据解析失败：' + e.message)
    }
  }
  img.onerror = function() { alert('PNG 加载失败') }
  img.src = dataUrl
}

function importWork(work) {
  var result = validateWorkForImport(work)
  if (!result.ok) {
    alert(result.message)
    return
  }
  loadWork(sanitizeImportedWork(result.work))
}

// ====== Landing Page (work info + password + placeholders) ======
function showLandingPage(work, callback) {
  var phs = work.placeholders || []
  var hasPassword = !!(work.password && work.password.trim())

  var h = '<div class="rd-landing">'

  // Work info section
  h += '<div class="rd-landing-info">'
  h += '<div class="rd-landing-title">' + esc(work.title || '无标题') + '</div>'
  if (work.author) h += '<div class="rd-landing-author">' + esc(work.author) + '</div>'
  if (work.authorNote) h += '<div class="rd-landing-note">' + esc(work.authorNote) + '</div>'
  h += '</div>'

  // Password section
  if (hasPassword) {
    h += '<div class="rd-landing-section">'
    h += '<div class="rd-landing-section-title">阅读密码</div>'
    h += '<input type="password" id="rdPwdInput" class="rd-landing-input" placeholder="请输入密码">'
    h += '<div id="rdPwdError" style="color:var(--c-accent3);font-size:.75rem;margin-top:4px;display:none">密码错误</div>'
    h += '</div>'
  }

  // Divider
  if (phs.length > 0) {
    h += '<div class="rd-landing-divider"></div>'
    h += '<div class="rd-landing-section">'
    h += '<div class="rd-landing-section-title">占位符</div>'
    h += '<p class="rd-landing-desc">以下信息将替换作品中对应的占位文字</p>'
    phs.forEach(function(ph) {
      h += '<div class="rd-landing-field">'
      h += '<label>' + esc(ph.label || ph.key) + '</label>'
      h += '<input type="text" class="rd-landing-input" data-ph-id="' + escapeHtmlAttribute(ph.id || '') + '" value="' + escapeHtmlAttribute(ph.default || '') + '" placeholder="' + escapeHtmlAttribute(ph.prompt || '') + '">'
      h += '</div>'
    })
    h += '<button class="rd-landing-preset-btn" id="rdPresetBtn">从预设填入</button>'
    h += '</div>'
  }

  // Start button
  h += '<div class="rd-landing-actions">'
  h += '<button class="rd-landing-start-btn" id="rdStartBtn">开始阅读</button>'
  h += '</div>'

  h += '</div>'

  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px'
  overlay.innerHTML = '<div class="rd-landing-modal">' + h + '</div>'
  document.body.appendChild(overlay)

  // Preset inject
  if (phs.length > 0) {
    var presetBtn = overlay.querySelector('#rdPresetBtn')
    presetBtn.onclick = function() {
      var presets = getPlaceholders()
      var keyMap = { '某某': presets.name || '', '小某': presets.nickname || '', 'wm': presets.webname || '' }
      var customVal = presets.custom || ''
      var inputs = overlay.querySelectorAll('.rd-landing-input[data-ph-id]')
      inputs.forEach(function(inp) {
        var label = (inp.parentElement.querySelector('label')?.textContent || '').replace(/[\s:：]/g, '')
        if (keyMap[label] !== undefined) inp.value = keyMap[label]
        else if (label.indexOf('某某') >= 0 || label.indexOf('姓名') >= 0) inp.value = presets.name || ''
        else if (label.indexOf('小某') >= 0 || label.indexOf('昵称') >= 0) inp.value = presets.nickname || ''
        else if (label.toLowerCase().indexOf('wm') >= 0 || label.indexOf('网名') >= 0) inp.value = presets.webname || ''
        else if (customVal) inp.value = customVal
      })
    }
  }

  // Start button
  overlay.querySelector('#rdStartBtn').onclick = function() {
    // Check password
    if (hasPassword) {
      var pwdInput = overlay.querySelector('#rdPwdInput')
      var pwdError = overlay.querySelector('#rdPwdError')
      if ((pwdInput.value || '').trim() !== work.password.trim()) {
        if (pwdError) pwdError.style.display = 'block'
        return
      }
    }
    // Collect placeholders
    var values = {}
    var inputs = overlay.querySelectorAll('.rd-landing-input[data-ph-id]')
    inputs.forEach(function(inp) {
      values[inp.dataset.phId] = [inp.value || '']
    })
    work.readerPhValues = values
    lsSet('readerPhValues', values)
    document.body.removeChild(overlay)
    callback()
  }

  // Close on overlay click
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove() })
}

// ====== Load Work ======
function loadWork(work) {
  if (!work.type) { alert('无效的作品文件'); return }
  _work = work
  _nodeId = null
  _visitedNodes = []
  try { localStorage.setItem('moirain_work_' + work.id, JSON.stringify(work)) } catch(e) {}
  addRecent(work)
  showLandingPage(work, function() {
    if (_work.type === 'phone') {
      renderPhoneReader()
    } else {
      renderArticleReader()
    }
  })
}

function timeAgo(ts) {
  if (!ts) return ''
  var diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

// ====== ARTICLE READER ======
// ====== Reader Typography Settings ======
function getReaderSettings() {
  return lsGet('readerSettings') || {
    fontSize: 18,
    lineHeight: 1.9,
    letterSpacing: 0,
    paragraphSpacing: 16,
    marginSize: 20,
    fontFamily: "'Noto Sans SC', sans-serif",
    theme: 'light',
    typingEffect: false,
    typingSpeed: 50,
    customFonts: []
  }
}

function saveReaderSettings(data) {
  lsSet('readerSettings', data)
}

function applyReaderSettings(el) {
  if (!el) return
  var rs = getReaderSettings()
  el.style.fontSize = rs.fontSize + 'px'
  el.style.lineHeight = rs.lineHeight
  el.style.letterSpacing = (rs.letterSpacing || 0) + 'px'
  el.style.padding = '0 ' + (rs.marginSize || 20) + 'px'
  // Paragraph spacing
  el.querySelectorAll('p').forEach(function(p) {
    p.style.marginBottom = (rs.paragraphSpacing || 16) + 'px'
  })
  // Font family
  if (rs.fontFamily && rs.fontFamily !== "'Noto Sans SC', sans-serif") {
    el.style.fontFamily = rs.fontFamily
  } else {
    el.style.fontFamily = ''
  }
  // Theme
  document.body.className = (document.body.className || '').replace(/\s*rd-theme-\S+/g, '')
  if (rs.theme && rs.theme !== 'light') {
    document.body.classList.add('rd-theme-' + rs.theme)
  }
}

function openReaderSettingsPanel() {
  var rs = getReaderSettings()
  var fonts = [
    { name: '默认', family: "'Noto Sans SC', sans-serif" },
    { name: '宋体', family: "'Noto Serif SC', serif" },
    { name: '黑体', family: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { name: '楷体', family: "'KaiTi', serif" },
    { name: '圆体', family: "'PingFang SC', sans-serif" },
    { name: '英文衬线', family: "'Georgia', serif" }
  ]
  var themes = [
    { id: 'light', name: '白色', bg: '#f5f5f5', text: '#333' },
    { id: 'dark', name: '暗夜', bg: '#1a1a2e', text: '#ccc' },
    { id: 'green', name: '护眼', bg: '#c8dcc8', text: '#333' },
    { id: 'parchment', name: '羊皮纸', bg: '#f5e6c8', text: '#4a3a2a' },
    { id: 'gray', name: '浅灰', bg: '#e8e8e8', text: '#333' }
  ]

  var body = '<div class="rs-panel-body">'

  // Font size
  body += '<div class="rs-section"><div class="rs-section-title">字号 <span id="rsFontSizeVal">' + rs.fontSize + '</span>px</div>'
  body += '<input type="range" id="rsFontSize" class="rs-range" min="12" max="32" value="' + rs.fontSize + '"></div>'

  // Line height
  body += '<div class="rs-section"><div class="rs-section-title">行间距 <span id="rsLineHVal">' + rs.lineHeight.toFixed(1) + '</span></div>'
  body += '<input type="range" id="rsLineH" class="rs-range" min="1.4" max="3.0" step="0.1" value="' + rs.lineHeight + '"></div>'

  // Letter spacing
  body += '<div class="rs-section"><div class="rs-section-title">字间距 <span id="rsLetterSVal">' + (rs.letterSpacing || 0) + '</span>px</div>'
  body += '<input type="range" id="rsLetterS" class="rs-range" min="0" max="10" step="0.5" value="' + (rs.letterSpacing || 0) + '"></div>'

  // Paragraph spacing
  body += '<div class="rs-section"><div class="rs-section-title">段间距 <span id="rsParaSVal">' + (rs.paragraphSpacing || 16) + '</span>px</div>'
  body += '<input type="range" id="rsParaS" class="rs-range" min="0" max="40" step="2" value="' + (rs.paragraphSpacing || 16) + '"></div>'

  // Margin
  body += '<div class="rs-section"><div class="rs-section-title">页边距 <span id="rsMarginVal">' + (rs.marginSize || 20) + '</span>px</div>'
  body += '<input type="range" id="rsMargin" class="rs-range" min="4" max="40" step="2" value="' + (rs.marginSize || 20) + '"></div>'

  // Font
  body += '<div class="rs-section"><div class="rs-section-title">字体</div>'
  body += '<div class="rs-font-grid">'
  for (var fi = 0; fi < fonts.length; fi++) {
    var f = fonts[fi]
    body += '<button class="rs-font-btn' + (rs.fontFamily === f.family ? ' active' : '') + '" data-rs-font="' + esc(f.family) + '">' + f.name + '</button>'
  }
  // Custom uploaded fonts
  var customFonts = rs.customFonts || []
  for (var cfi = 0; cfi < customFonts.length; cfi++) {
    var cf = customFonts[cfi]
    body += '<button class="rs-font-btn' + (rs.fontFamily === '"' + cf.name + '"' ? ' active' : '') + '" data-rs-font="' + esc('"' + cf.name + '"') + '">' + esc(cf.name) + '</button>'
  }
  body += '</div>'
  body += '<div style="padding:4px 0;margin-top:6px"><button class="rs-upload-font-btn" style="padding:5px 14px;font-size:.72rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer;border-radius:4px" id="rsUploadFont">上传字体 (.ttf/.woff)</button></div>'
  body += '<div id="rsFontList" style="padding:4px 0">'
  for (var cfi2 = 0; cfi2 < customFonts.length; cfi2++) {
    body += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><span style="font-size:.7rem;color:#555;flex:1">' + esc(customFonts[cfi2].name) + '</span><button class="rs-delete-font-btn" style="padding:2px 8px;font-size:.65rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;border-radius:3px" data-rs-del-font="' + cfi2 + '">删除</button></div>'
  }
  body += '</div>'
  body += '</div>'

  // Theme
  body += '<div class="rs-section"><div class="rs-section-title">主题</div>'
  body += '<div class="rs-theme-grid">'
  for (var ti = 0; ti < themes.length; ti++) {
    var th = themes[ti]
    body += '<button class="rs-theme-btn' + (rs.theme === th.id ? ' active' : '') + '" data-rs-theme="' + th.id + '" style="background:' + th.bg + ';color:' + th.text + '">' + th.name + '</button>'
  }
  body += '</div></div>'

  // Typing effect
  body += '<div class="rs-section">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="rsTyping"' + (rs.typingEffect ? ' checked' : '') + '> 打字机效果</label>'
  body += '<div class="rs-section-title" style="margin-top:8px">速度: <span id="rsTypingSpeedVal">' + (rs.typingSpeed || 50) + '</span>ms</div>'
  body += '<input type="range" id="rsTypingSpeed" class="rs-range" min="10" max="500" step="5" value="' + (rs.typingSpeed || 50) + '"></div>'

  body += '<div class="rs-reset-wrap"><button class="rs-reset-btn" id="rsReset">恢复默认</button></div>'
  body += '</div>'

  // Build overlay + bottom sheet
  var ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2000;display:flex;align-items:flex-end;justify-content:center'
  ov.innerHTML = '<div style="background:#fff;max-width:520px;width:100%;max-height:75vh;border-radius:16px 16px 0 0;overflow-y:auto;box-shadow:0 -4px 24px rgba(0,0,0,.15);padding:0 0 env(safe-area-inset-bottom)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;z-index:1">' +
    '<span style="font-size:1rem;font-weight:600;color:#333">排版设置</span>' +
    '<button class="rs-close-btn" aria-label="关闭排版设置" style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="rsClose">×</button>' +
    '</div>' +
    body +
    '</div>'
  document.body.appendChild(ov)

  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#rsClose').onclick = function() { ov.remove() }

  // Slider binds
  function bindSlider(id, key, valEl, format) {
    var el = ov.querySelector(id)
    if (!el) return
    el.oninput = function() {
      var v = parseFloat(this.value)
      rs[key] = v
      if (valEl) { var lbl = ov.querySelector(valEl); if (lbl) lbl.textContent = format ? format(v) : v }
      saveReaderSettings(rs)
      var content = document.querySelector('.article-content')
      if (content) applyReaderSettings(content)
    }
  }
  bindSlider('#rsFontSize', 'fontSize', '#rsFontSizeVal', function(v){return v})
  bindSlider('#rsLineH', 'lineHeight', '#rsLineHVal', function(v){return v.toFixed(1)})
  bindSlider('#rsLetterS', 'letterSpacing', '#rsLetterSVal', function(v){return v})
  bindSlider('#rsParaS', 'paragraphSpacing', '#rsParaSVal', function(v){return v})
  bindSlider('#rsMargin', 'marginSize', '#rsMarginVal', function(v){return v})

  // Font buttons
  var fontBtns = ov.querySelectorAll('[data-rs-font]')
  fontBtns.forEach(function(b) {
    b.onclick = function() {
      rs.fontFamily = b.dataset.rsFont
      saveReaderSettings(rs)
      ov.querySelectorAll('[data-rs-font]').forEach(function(x){x.classList.remove('active')})
      b.classList.add('active')
      var content = document.querySelector('.article-content')
      if (content) applyReaderSettings(content)
    }
  })

  // Typing checkbox
  var typingCb = ov.querySelector('#rsTyping')
  if (typingCb) typingCb.onchange = function() {
    rs.typingEffect = this.checked
    saveReaderSettings(rs)
  }
  bindSlider('#rsTypingSpeed', 'typingSpeed', '#rsTypingSpeedVal', function(v){return v})

  // Theme buttons
  var themeBtns = ov.querySelectorAll('[data-rs-theme]')
  themeBtns.forEach(function(b) {
    b.onclick = function() {
      rs.theme = b.dataset.rsTheme
      saveReaderSettings(rs)
      ov.querySelectorAll('[data-rs-theme]').forEach(function(x){x.classList.remove('active')})
      b.classList.add('active')
      var content = document.querySelector('.article-content')
      if (content) applyReaderSettings(content)
    }
  })

  // Font upload button
  var rsUploadFontBtn = ov.querySelector('#rsUploadFont')
  if (rsUploadFontBtn) rsUploadFontBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2'
    inp.onchange = function() {
      var file = inp.files[0]; if (!file) return
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      var r = new FileReader()
      r.onload = function() {
        rs.customFonts = rs.customFonts || []
        rs.customFonts.push({ name: name, data: r.result })
        saveReaderSettings(rs)
        // Inject @font-face
        var style = document.createElement('style')
        style.textContent = '@font-face{font-family:"' + name.replace(/"/g,'') + '";src:url(' + r.result + ');font-display:swap;}'
        document.head.appendChild(style)
        ov.remove()
        openReaderSettingsPanel()
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  // Font delete buttons
  ov.querySelectorAll('[data-rs-del-font]').forEach(function(b) {
    b.onclick = function() {
      var idx = parseInt(b.dataset.rsDelFont)
      rs.customFonts = rs.customFonts || []
      rs.customFonts.splice(idx, 1)
      saveReaderSettings(rs)
      ov.remove()
      openReaderSettingsPanel()
    }
  })

  // Reset
  var resetBtn = ov.querySelector('#rsReset')
  if (resetBtn) resetBtn.onclick = function() {
    var defaults = { fontSize: 18, lineHeight: 1.9, letterSpacing: 0, paragraphSpacing: 16, marginSize: 20, fontFamily: "'Noto Sans SC', sans-serif", theme: 'light', customFonts: [] }
    saveReaderSettings(defaults)
    ov.remove()
    var content = document.querySelector('.article-content')
    if (content) applyReaderSettings(content)
    renderArticleReader()
  }
}

function renderArticleReader() {
  if (!_work || _work.type === 'phone') return renderPhoneReader()
  var nodes = _work.nodes || []
  if (!_nodeId || !nodes.find(function(n) { return n.id === _nodeId })) {
    _nodeId = _work.startNode || (nodes.length ? nodes[0].id : null)
  }
  var node = nodes.find(function(n) { return n.id === _nodeId })
  if (!node) {
    render('app', '<div class="drop-zone"><p>作品内容为空</p><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>')
    return
  }

  // Substitute placeholders
  var content = node.content || ''
  var phs = _work.placeholders || []
  if (phs.length > 0 && _work.readerPhValues) {
    content = substitutePlaceholders(content, phs, {
      valuesMap: _work.readerPhValues,
      usePlaceholderMode: false
    })
  }

  // Progress dots
  var visitedSet = {}
  _visitedNodes.forEach(function(id) { visitedSet[id] = true })
  visitedSet[_nodeId] = true
  var h = '<button type="button" class="reader-back" data-reader-home title="返回" aria-label="返回首页">←</button>'
  h += '<button class="reader-settings-btn" title="排版设置">⚙</button>'
  h += '<div class="article-reader">'
  h += '<div class="article-progress">'
  for (var ni = 0; ni < nodes.length; ni++) {
    var nid = nodes[ni].id
    h += '<span class="dot' + (nid === _nodeId ? ' current' : '') + (visitedSet[nid] ? ' visited' : '') + '"></span>'
  }
  h += '</div>'

  // Phone module cards in content - render as notification buttons
  var cleanContent = content.replace(/<div class="pm-inline-card"[^>]*>[\s\S]*?<\/div>/gi, '<span class="rd-pm-marker"></span>')
  var pmCards = content.match(/<div class="pm-inline-card"[^>]*data-pm-id="([^"]*)"[^>]*data-pm-type="([^"]*)"[^>]*>/gi)
  var pmTriggers = []
  if (pmCards) {
    for (var pmi = 0; pmi < pmCards.length; pmi++) {
      var idMatch = pmCards[pmi].match(/data-pm-id="([^"]*)"/)
      var typeMatch = pmCards[pmi].match(/data-pm-type="([^"]*)"/)
      if (idMatch && typeMatch) pmTriggers.push({ pmid: idMatch[1], type: typeMatch[1] })
    }
  }
  var visitedPm = {}
  try { visitedPm = JSON.parse(sessionStorage.getItem('rd_pm_visited_' + _work.id) || '{}') } catch(e) { visitedPm = {} }

  var PH_APP_DEFS = {
    messages:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',label:'消息'},
    forum:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>',label:'论坛'},
    memo:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',label:'备忘录'},
    gallery:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',label:'相册'},
    browser:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',label:'浏览器'},
    shopping:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',label:'购物'},
    contacts:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',label:'联系人'}
  }

  var triggerIndex = 0
  cleanContent = cleanContent.replace(/<span class="rd-pm-marker"><\/span>/g, function() {
    if (triggerIndex >= pmTriggers.length) return ''
    var pt = pmTriggers[triggerIndex]
    var def = PH_APP_DEFS[pt.type] || PH_APP_DEFS.messages
    var hasUnread = !visitedPm[pt.pmid]
    triggerIndex++
    return buildReaderPhoneModuleTrigger({
      pmid: pt.pmid,
      type: pt.type,
      label: def.label,
      trustedIconHtml: def.icon,
      hasUnread: hasUnread
    })
  })

  h += '<h1 class="article-title">' + esc(node.title || '') + '</h1>'
  h += '<div class="article-meta">' + esc(_work.author || '') + '</div>'
  h += '<div class="article-content">' + cleanContent + '</div>'

  // Choices
  var choices = node.choices || []
  if (choices.length > 0) {
    h += '<div class="article-choices">'
    choices.forEach(function(c, ci) {
      h += '<button class="article-choice-btn" data-target="' + escapeHtmlAttribute(c.targetId || '') + '"><span class="label">' + (ci + 1) + '.</span>' + esc(c.text || '选项') + '</button>'
    })
    h += '</div>'
  } else {
    h += '<div style="text-align:center;padding:24px"><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>'
  }

  render('app', h)

  // Apply reader settings + typing effect + bind settings button
  setTimeout(function() {
    var rs = getReaderSettings()
    var ac = document.querySelector('.article-content')
    if (ac) applyReaderSettings(ac)
    var sb = document.querySelector('.reader-settings-btn')
    if (sb) sb.onclick = function() { openReaderSettingsPanel() }

    // Typing effect
    if (ac && shouldUseMotion(rs.typingEffect)) {
      var fullHTML = ac.innerHTML
      ac.innerHTML = ''
      var i = 0
      var textLen = fullHTML.length
      var speed = rs.typingSpeed || 50

      function typeNext() {
        if (i >= textLen) return
        // Find next chunk: if we're at a '<', skip to the matching '>'
        if (fullHTML.charAt(i) === '<') {
          var end = fullHTML.indexOf('>', i)
          if (end >= 0) {
            ac.insertAdjacentHTML('beforeend', fullHTML.substring(i, end + 1))
            i = end + 1
            setTimeout(typeNext, 5)
            return
          }
        }
        // Type one character
        ac.insertAdjacentHTML('beforeend', fullHTML.charAt(i))
        i++
        setTimeout(typeNext, speed)
      }
      typeNext()
    }
  }, 50)

  // Bind choices
  var btns = document.querySelectorAll('.article-choice-btn')
  btns.forEach(function(btn) {
    btn.onclick = function() {
      var target = btn.dataset.target
      if (target) {
        _visitedNodes.push(_nodeId)
        _nodeId = target
        renderArticleReader()
      }
    }
  })

  // Bind phone module triggers — render as glass overlay
  var triggers = document.querySelectorAll('.rd-pm-trigger')
  triggers.forEach(function(trig) {
    trig.onclick = function() {
      var pmid = trig.dataset.pmId
      var type = trig.dataset.pmType
      visitedPm[pmid] = true
      try { sessionStorage.setItem('rd_pm_visited_' + _work.id, JSON.stringify(visitedPm)) } catch(e) {}
      markReaderPhoneModuleTriggerRead(trig)

      var pm = null
      var pms = _work.phoneModules || []
      for (var i = 0; i < pms.length; i++) { if (pms[i].id === pmid) { pm = pms[i]; break } }
      if (!pm) return
      var d = pm.data || {}
      var contacts = d.contacts || []
      var photos = Array.isArray(d.photos) ? d.photos : []
      var albums = Array.isArray(d.albums) ? d.albums : []

      // All 7 apps always displayed, some with red dot
      var APP_ICONS = {
        messages:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        forum:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>',
        memo:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        gallery:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        browser:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        shopping:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
        contacts:'<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>'
      }
      var APP_NAMES = {messages:'消息',forum:'论坛',memo:'备忘',gallery:'相册',browser:'浏览',shopping:'购物',contacts:'联系人'}
      
      var hasData = {}
      hasData.messages = !!(d.chats && d.chats.length)
      hasData.forum = !!(d.forumPosts && d.forumPosts.length)
      hasData.memo = !!(d.memos && d.memos.length)
      hasData.gallery = photos.length > 0 || albums.length > 0
      hasData.browser = !!(d.browserHistory && d.browserHistory.length)
      hasData.shopping = !!(d.shoppingItems && d.shoppingItems.length)
      hasData.contacts = !!(d.contacts && d.contacts.length)

      var appTypes = ['messages','forum','memo','gallery','browser','shopping','contacts']
      var apps = []
      for (var ai = 0; ai < appTypes.length; ai++) {
        var at = appTypes[ai]
        apps.push({ type: at, name: APP_NAMES[at], icon: APP_ICONS[at], color: '#f0f0f0', desktopX: ai % 4, desktopY: Math.floor(ai / 4), hasUpdate: hasData[at] })
      }

      var rc = getPhoneCustom()
      var pd = {
        contacts: contacts,
        chats: d.chats || [],
        moments: [],
        forumPosts: d.forumPosts || [],
        forumNpcs: [],
        memos: d.memos || [],
        photos: photos,
        albums: albums,
        browserHistory: d.browserHistory || [],
        shoppingItems: d.shoppingItems || [],
        skin: rc,
        apps: apps
      }
      var hadPhoneData = Object.prototype.hasOwnProperty.call(_work, 'phoneData')
      var previousPhoneData = _work.phoneData
      // Create glass overlay
      var overlay = document.createElement('div')
      overlay.className = 'rd-pm-modal'
      var backBtn = document.createElement('button')
      backBtn.className = 'reader-back rd-pm-back'
      backBtn.textContent = '←'
      backBtn.title = '返回'
      backBtn.onclick = function() {
        if (_work._overlayWrapper === phoneWrapper) {
          _work._overlayWrapper = null
          _work._inOverlay = false
          if (hadPhoneData) _work.phoneData = previousPhoneData
          else delete _work.phoneData
        }
        overlay.remove()
      }
      overlay.appendChild(backBtn)
      // Set phoneData and overlay context for back navigation
      _work.phoneData = pd
      var phoneWrapper = document.createElement('div')
      phoneWrapper.className = 'rd-pm-phone-wrap'
      phoneWrapper.innerHTML = buildPhoneHTML(pd, rc)
      overlay.appendChild(phoneWrapper)
      document.body.appendChild(overlay)
      _work._overlayWrapper = phoneWrapper
      _work._inOverlay = true
      // Bind app icon clicks
      bindOverlayApps(phoneWrapper)
    }
  })
}

// ====== Build Phone HTML (shared by article overlay and standalone phone) ======
function buildPhoneHTML(pd, custom) {
  var skin = pd.skin || {}
  var rc = custom || getPhoneCustom()
  if (rc.wallpaper) skin.wallpaper = rc.wallpaper
  if (rc.wallpaperType === 'image' && rc.wallpaperImage) { skin.wallpaperImage = rc.wallpaperImage; skin.wallpaperType = rc.wallpaperType }
  if (rc.frameColor) skin.frameColor = rc.frameColor
  if (rc.borderRadius !== undefined) skin.borderRadius = rc.borderRadius
  if (rc.readerId) skin.readerId = rc.readerId
  if (rc.readerAvatar) skin.readerAvatar = rc.readerAvatar
  if (rc.topBgImage) skin.topBgImage = rc.topBgImage
  if (rc.showDynamicIsland !== undefined) skin.showDynamicIsland = rc.showDynamicIsland
  if (rc.showHomeIndicator !== undefined) skin.showHomeIndicator = rc.showHomeIndicator
  if (rc.showAppLabels !== undefined) skin.showAppLabels = rc.showAppLabels
  if (rc.fontFamily) skin.fontFamily = rc.fontFamily
  if (rc.fontSize) skin.fontSize = rc.fontSize
  var apps = pd.apps || []

  var h = ''
  var readerBgStyle = '--phone-bg:transparent;'
  readerBgStyle += '--phone-radius:' + (skin.borderRadius || 28) + 'px;'
  readerBgStyle += '--phone-font:\'' + (skin.fontFamily || 'Noto Sans SC').replace(/'/g, '') + '\', sans-serif;'
  readerBgStyle += '--phone-fontsize:' + (skin.fontSize || 12) + 'px;'
  readerBgStyle += '--phone-frame:' + (skin.frameColor || '#ccc')
  if (skin.wallpaperType === 'image' && skin.wallpaperImage) {
    readerBgStyle += ';background-image:url(' + esc(skin.wallpaperImage) + ');background-size:cover;background-position:center'
  }
  h += '<div class="phone-frame" style="' + readerBgStyle + '">'

  if (skin.showDynamicIsland !== false) {
    h += '<div class="phone-island"><div class="phone-island-pill"></div></div>'
  }

  var coverBg = skin.topBgImage || skin.wallpaperImage || ''
  h += '<div class="phone-profile"'
  if (coverBg) h += ' style="background-image:url(' + esc(coverBg) + ');background-size:cover;background-position:center"'
  h += '>'
  h += '<div class="phone-profile-overlay"></div>'
  h += '<div class="phone-avatar">'
  if (skin.readerAvatar) h += '<img src="' + esc(skin.readerAvatar) + '" alt="">'
  h += '</div>'
  h += '<div class="phone-profile-id">' + esc(skin.readerId || '读者') + '</div>'
  h += '</div>'

  h += '<div id="phoneDesktopReader" class="phone-desktop" style="flex:1;position:relative;min-height:420px;padding:10px 20px;' + phoneGridContainerStyle() + '">'
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    if (app.enabled === false) continue
    if (app.type === 'settings' || app.type === 'customize') continue
    var gridStyle = phoneGridItemStyle(app.desktopX || 0, app.desktopY || 0)
    var appName = readerAppName(app)
    h += '<button type="button" class="phone-app-icon" aria-label="' + escapeHtmlAttribute(appName) + '" data-app-type="' + escapeHtmlAttribute(app.type || '') + '" style="' + gridStyle + 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:absolute;width:72px;border:none!important;box-shadow:none!important">'
    var customIcon = readerCustomIconUrl(rc.customIcons && rc.customIcons[app.type])
    h += '<span class="phone-icon-body icon-shadow" style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:14px;margin:0 auto;background:' + (app.color || '#f0f0f0') + ';position:relative">'
    if (customIcon) {
      h += '<img src="' + escapeHtmlAttribute(customIcon) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:14px" onerror="this.style.display=\'none\'">'
      h += '<span class="phone-icon-char" style="width:36px;height:36px;display:none;align-items:center;justify-content:center;color:#333;line-height:1">' + (app.icon || '?') + '</span>'
    } else {
      h += '<span class="phone-icon-char" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#333;line-height:1">' + (app.icon || '?') + '</span>'
    }
    if (app.hasUpdate) {
      h += '<span style="position:absolute;top:2px;right:2px;width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff"></span>'
    }
    h += '</span>'
    if (skin.showAppLabels !== false) {
      h += '<span class="phone-icon-label">' + esc(appName) + '</span>'
    }
    h += '</button>'
  }
  h += '</div>'
  if (skin.showHomeIndicator !== false) {
    h += '<div class="phone-home-bar"><div class="phone-home-indicator"></div></div>'
  }
  h += '</div>'
  return h
}

// ====== PHONE READER (standalone imported phone) ======
function renderPhoneReader() {
  if (!_work || !_work.phoneData) {
    render('app', '<div class="drop-zone"><p>手机数据为空</p><button type="button" class="drop-btn" data-reader-home>返回</button></div>')
    return
  }
  var pd = _work.phoneData
  var rc = getPhoneCustom()
  var h = '<button type="button" class="reader-back" data-reader-home title="返回" aria-label="返回首页">←</button>'
  h += '<div class="phone-reader">'
  h += buildPhoneHTML(pd, rc)
  h += '</div>'
  render('app', h)

  var icons = document.querySelectorAll('.phone-app-icon')
  icons.forEach(function(icon) {
    icon.onclick = function() {
      var type = icon.dataset.appType
      openReaderApp(type)
    }
  })
}

function bindOverlayApps(wrapper) {
  var rc = getPhoneCustom()
  wrapper.querySelectorAll('.phone-app-icon').forEach(function(icon) {
    icon.onclick = function() {
      var type = icon.dataset.appType
      openReaderApp(type)
    }
  })
}

// ---- Reader App Panels ----
function openReaderApp(type) {
  var inOverlay = _work._inOverlay
  var phoneFrame = document.querySelector('.phone-frame')
  if (!phoneFrame) return
  var pd = _work.phoneData
  var contacts = pd.contacts || []
  var w = _work
  var rc = getPhoneCustom()

  function backToDesktop() {
    if (inOverlay && _work._overlayWrapper) {
      _work._overlayWrapper.innerHTML = buildPhoneHTML(pd, rc)
      bindOverlayApps(_work._overlayWrapper)
      focusReaderAppIcon(_work._overlayWrapper, type)
    } else {
      renderPhoneReader()
      focusReaderAppIcon(document, type)
    }
  }

  function wrapPanel(title, bodyHtml) {
    var h = '<div class="cu-panel cu-panel-embedded" style="z-index:10">'
    h += '<div class="cu-header" style="justify-content:flex-start;gap:8px">'
    h += '<button type="button" class="rd-back-btn" aria-label="返回手机桌面" style="color:var(--c-text2)">←</button>'
    h += '<span class="cu-title" style="flex:1;text-align:center">' + esc(title) + '</span>'
    h += '<span class="rd-back-spacer" aria-hidden="true"></span>'
    h += '</div>'
    h += '<div class="cu-body" style="padding:8px 10px">' + bodyHtml + '</div>'
    h += '</div>'
    phoneFrame.innerHTML = h
    var backBtn = phoneFrame.querySelector('.rd-back-btn')
    if (backBtn) {
      backBtn.onclick = backToDesktop
      backBtn.focus()
    }
  }

  if (type === 'messages') {
    var chats = pd.chats || []
    var h = ''
    if (chats.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无对话</div>'
    chats.forEach(function(ch, chatIndex) {
      var name = ''
      if (ch.type === 'group') name = ch.groupName || '群聊'
      else {
        var cc = contacts.find(function(x) { return x.id === ch.contactIds[0] })
        name = cc ? cc.name : '未知'
      }
      h += '<button type="button" class="rd-chat-card" data-chat-index="' + chatIndex + '" aria-label="' + escapeHtmlAttribute('打开与 ' + name + ' 的对话') + '">'
      h += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;flex-shrink:0;background:' + (ch.type === 'group' ? '#10b981' : '#6366f1') + '">' + esc(name.charAt(0)) + '</div>'
      h += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(name) + '</div></div>'
      h += '</button>'
    })
    wrapPanel('消息', h)
    var cards = phoneFrame.querySelectorAll('.rd-chat-card')
    cards.forEach(function(card) {
      card.onclick = function() {
        var index = Number(card.dataset.chatIndex)
        if (!Number.isInteger(index) || !chats[index]) return
        openReaderChat(phoneFrame, w, pd, chats[index], index)
      }
    })
  } else if (type === 'forum') {
    var posts = pd.forumPosts || []
    var h = ''
    if (posts.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无帖子</div>'
    posts.forEach(function(p, postIndex) {
      h += '<button type="button" class="rd-post-card" data-post-index="' + postIndex + '" aria-label="' + escapeHtmlAttribute('查看帖子 ' + (p.title || '')) + '">'
      h += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;flex-shrink:0;background:' + avatarColor(p.contactId) + '">' + esc((p.contactName || '?').charAt(0)) + '</div>'
      h += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(p.title) + '</div><div style="font-size:.68rem;color:#999">' + esc(p.contactName || '') + ' / ' + esc(p.time || '') + '</div></div>'
      h += '</button>'
    })
    wrapPanel('论坛', h)
    var postCards = phoneFrame.querySelectorAll('.rd-post-card')
    postCards.forEach(function(card) {
      card.onclick = function() {
        var index = Number(card.dataset.postIndex)
        if (!Number.isInteger(index) || !posts[index]) return
        openReaderForumPost(phoneFrame, w, pd, posts[index].id, index)
      }
    })
  } else if (type === 'memo') {
    var memos = (pd.memos || []).filter(function(m) { return contacts.length > 0 ? m.contactId === contacts[0].id : true })
    var h = ''
    if (memos.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无备忘</div>'
    memos.forEach(function(m) {
      h += '<div style="padding:10px 12px;margin-bottom:8px;background:#fff;border:1px solid #eee;font-size:.8rem;line-height:1.6">' + (m.content || '') + '</div>'
    })
    wrapPanel('备忘录', h)
  } else if (type === 'gallery') {
    var primaryContact = contacts.length > 0 && contacts[0] && typeof contacts[0] === 'object' ? contacts[0] : null
    var photos = (Array.isArray(pd.photos) ? pd.photos : []).filter(function(p) {
      return p && typeof p === 'object' && (!primaryContact || p.contactId === primaryContact.id)
    })
    var albums = (Array.isArray(pd.albums) ? pd.albums : []).filter(function(a) {
      return a && typeof a === 'object' && (!primaryContact || a.contactId === primaryContact.id)
    })
    var albumIds = new Set(albums.map(function(a) { return a.id }))

    function renderGalleryPhotoGrid(items) {
      var grid = '<div class="rd-gallery-grid">'
      if (items.length === 0) grid += '<div class="rd-gallery-empty">暂无照片</div>'
      items.forEach(function(p) {
        grid += '<div class="rd-gallery-photo">'
        if (p.imageUrl) {
          grid += '<img src="' + escapeHtmlAttribute(p.imageUrl) + '" alt="' + escapeHtmlAttribute(p.caption || '') + '" onerror="this.style.display=\'none\'">'
        } else {
          grid += '<div class="rd-gallery-photo-placeholder">' + esc(p.caption || '') + '</div>'
        }
        grid += '</div>'
      })
      grid += '</div>'
      return grid
    }

    function renderGalleryAlbum(albumIndex) {
      var album = albums[albumIndex]
      if (!album) return
      var albumPhotos = photos.filter(function(p) { return p.albumId === album.id })
      var body = '<button type="button" class="rd-gallery-album-back" aria-label="返回相册列表">← 返回相册</button>'
      body += renderGalleryPhotoGrid(albumPhotos)
      wrapPanel(album.name || '相册', body)
      var albumBack = phoneFrame.querySelector('.rd-gallery-album-back')
      if (albumBack) {
        albumBack.onclick = function() { renderGalleryMain(albumIndex) }
        albumBack.focus()
      }
    }

    function renderGalleryMain(restoreAlbumIndex) {
      var body = ''
      if (albums.length > 0) {
        body += '<div class="rd-album-list">'
        albums.forEach(function(a, albumIndex) {
          var count = photos.filter(function(p) { return p.albumId === a.id }).length
          var name = a.name || '相册'
          var accessibleName = '打开相册 ' + name + '，' + count + ' 张'
          body += '<button type="button" class="rd-album" data-album-index="' + albumIndex + '" aria-label="' + escapeHtmlAttribute(accessibleName) + '">'
          body += '<span class="rd-album-cover" aria-hidden="true"></span>'
          body += '<span class="rd-album-name">' + esc(name) + '</span>'
          body += '<span class="rd-album-count">' + count + ' 张</span>'
          body += '</button>'
        })
        body += '</div>'
      }
      var ungrouped = photos.filter(function(p) { return !p.albumId || !albumIds.has(p.albumId) })
      body += renderGalleryPhotoGrid(ungrouped)
      wrapPanel('相册', body)

      var albumButtons = phoneFrame.querySelectorAll('.rd-album[data-album-index]')
      albumButtons.forEach(function(button) {
        button.onclick = function() {
          var albumIndex = Number(button.dataset.albumIndex)
          if (Number.isInteger(albumIndex)) renderGalleryAlbum(albumIndex)
        }
      })
      if (Number.isInteger(restoreAlbumIndex) && albumButtons[restoreAlbumIndex]) {
        albumButtons[restoreAlbumIndex].focus()
      }
    }

    renderGalleryMain()
  } else if (type === 'browser') {
    var history = (pd.browserHistory || []).filter(function(h) { return contacts.length > 0 ? h.contactId === contacts[0].id : true })
    var h = '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:8px;background:#fff;border:1px solid #ddd"><span style="color:#999">🔍</span><span style="font-size:.78rem;color:#999">搜索或输入网址</span></div>'
    if (history.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无记录</div>'
    history.forEach(function(it) {
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eee">'
      h += '<div style="width:8px;height:8px;border-radius:50%;background:' + avatarColor(it.contactId) + '"></div>'
      h += '<div style="flex:1"><div style="font-size:.78rem;font-weight:500">' + esc(it.title || '') + '</div><div style="font-size:.68rem;color:#999">' + esc(it.url || '') + '</div></div>'
      h += '<span style="font-size:.65rem;color:#999">' + esc((it.time || '').replace(/\s.*$/, '')) + '</span>'
      h += '</div>'
    })
    wrapPanel('浏览记录', h)
  } else if (type === 'shopping') {
    var items = (pd.shoppingItems || []).filter(function(s) { return contacts.length > 0 ? s.contactId === contacts[0].id : true })
    var cartItems = items.filter(function(s) { return s.status !== 'order' })
    var orderItems = items.filter(function(s) { return s.status === 'order' })
    var h = '<div class="rd-shop-tabs" role="tablist" aria-label="购物内容">'
    h += '<button type="button" class="rd-shop-tab active" id="rdShopCartTab" role="tab" aria-controls="rdShopCart" aria-selected="true" tabindex="0" data-tab="cart">购物车</button>'
    h += '<button type="button" class="rd-shop-tab" id="rdShopOrderTab" role="tab" aria-controls="rdShopOrder" aria-selected="false" tabindex="-1" data-tab="order">订单</button>'
    h += '</div>'
    function shopList(list) {
      var r = ''
      if (list.length === 0) r += '<div style="text-align:center;padding:20px;color:#999">暂无</div>'
      list.forEach(function(s) {
        r += '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #eee;align-items:flex-start">'
        r += '<div style="width:50px;height:50px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #eee">'
        if (s.imageUrl) r += '<img src="' + esc(s.imageUrl) + '" style="width:100%;height:100%;object-fit:cover">'
        r += '</div>'
        r += '<div style="flex:1"><div style="font-size:.78rem;font-weight:500">' + esc(s.name) + '</div><div style="font-size:.75rem;color:var(--c-primary-hover)">¥' + (s.price || 0).toFixed(2) + '</div></div>'
        r += '</div>'
      })
      return r
    }
    h += '<div class="rd-shop-panel" id="rdShopCart" role="tabpanel" aria-labelledby="rdShopCartTab">' + shopList(cartItems) + '</div>'
    h += '<div class="rd-shop-panel" id="rdShopOrder" role="tabpanel" aria-labelledby="rdShopOrderTab" style="display:none" hidden>' + shopList(orderItems) + '</div>'
    wrapPanel('购物清单', h)

    var tabs = phoneFrame.querySelectorAll('.rd-shop-tab')
    function activateShopTab(tab, moveFocus) {
      tabs.forEach(function(item) {
        var active = item === tab
        item.classList.toggle('active', active)
        item.setAttribute('aria-selected', active ? 'true' : 'false')
        item.tabIndex = active ? 0 : -1
        var panel = phoneFrame.querySelector('#' + item.getAttribute('aria-controls'))
        if (panel) {
          panel.hidden = !active
          panel.style.display = active ? 'block' : 'none'
        }
      })
      if (moveFocus) tab.focus()
    }
    tabs.forEach(function(tab, index) {
      tab.onclick = function() { activateShopTab(tab, false) }
      tab.onkeydown = function(event) {
        var nextIndex = null
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
        if (event.key === 'Home') nextIndex = 0
        if (event.key === 'End') nextIndex = tabs.length - 1
        if (nextIndex === null) return
        event.preventDefault()
        activateShopTab(tabs[nextIndex], true)
      }
    })
  } else if (type === 'profile') {
    var h = '<div style="text-align:center;padding:30px">'
    h += '<div style="width:70px;height:70px;border-radius:50%;background:#eee;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;color:#999;margin-bottom:12px">' + esc((pd.skin?.readerId || '读者').charAt(0)) + '</div>'
    h += '<div style="font-size:1rem;font-weight:600;color:#555">' + esc(pd.skin?.readerId || '读者') + '</div>'
    h += '</div>'
    wrapPanel('个人主页', h)
  } else if (type === 'contacts') {
    var h = ''
    if (contacts.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无联系人</div>'
    contacts.forEach(function(c) {
      h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eee">'
      h += '<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;flex-shrink:0;background:' + avatarColor(c.id) + '">' + esc(c.name.charAt(0)) + '</div>'
      h += '<div style="font-size:.82rem;font-weight:500;color:#555">' + esc(c.name) + '</div>'
      h += '</div>'
    })
    wrapPanel('联系人', h)
  }
}

// ---- Chat reader ----
function openReaderChat(frame, w, pd, ch, chatIndex) {
  var contacts = pd.contacts || []

  // Deep clone chat data so we don't mutate the original work object
  ch = JSON.parse(JSON.stringify(ch))

  function backToList() {
    openReaderApp('messages')
    focusReaderControl(frame, '.rd-chat-card[data-chat-index="' + chatIndex + '"]')
  }

  function getChatName() {
    if (ch.type === 'group') return ch.groupName || '群聊'
    var c = contacts.find(function(x) { return x.id === ch.contactIds[0] })
    return c ? c.name : '未知'
  }

  function renderChat() {
    var chatName = getChatName()
    var ast = appStyle('messages')
    var rounds = ch.rounds || []
    if (rounds.length === 0 && ch.messages && ch.messages.length) {
      rounds = [{ id: 'd', label: '', messages: ch.messages }]
      ch.rounds = rounds
    }

    // Collect all choices from all messages (used or not — reader can replay)
    var allChoices = []
    for (var lri = rounds.length - 1; lri >= 0; lri--) {
      if (rounds[lri].messages) {
        for (var lmi = rounds[lri].messages.length - 1; lmi >= 0; lmi--) {
          var lm = rounds[lri].messages[lmi]
          if (lm.choices && lm.choices.length > 0) {
            for (var lci = 0; lci < lm.choices.length; lci++) {
              allChoices.push({ roundIdx: lri, msgIdx: lmi, choiceIdx: lci, text: lm.choices[lci].text })
            }
            if (allChoices.length > 0) break
          }
        }
        if (allChoices.length > 0) break
      }
    }

    var avSz = ast.avatarSize + 'px'

    // ---- BUILD HTML ----
    var h = '<div style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;color:#333;background:#f0f0f0">'

    // Top bar
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-bottom:1px solid #ddd;flex-shrink:0">'
    h += '<button id="chatBack" style="border:none;background:#eee;color:#555;cursor:pointer;font-size:.75rem;padding:5px 10px;border-radius:6px">← 返回</button>'
    h += '<span style="flex:1;text-align:center;font-size:.8rem;font-weight:500;color:#555">' + esc(chatName) + '</span>'
    h += '<span style="width:56px"></span>'
    h += '</div>'

    // Message area
    h += '<div id="chatMsgArea" style="flex:1;overflow-y:auto;padding:6px 10px">'
    for (var ri = 0; ri < rounds.length; ri++) {
      var round = rounds[ri]
      if (!round.messages || round.messages.length === 0) continue
      for (var mi = 0; mi < round.messages.length; mi++) {
        var msg = round.messages[mi]
        if (msg.type === 'time') {
          h += '<div style="text-align:center;padding:6px 0;font-size:.62rem;color:#b0b8c4">' + esc(msg.time || '') + '</div>'
          continue
        }
        var isSelf = msg.senderId === 'self'
        h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:flex-start;' + (isSelf ? 'flex-direction:row-reverse' : '') + '">'
        // Avatar for others
        if (!isSelf) {
          var sc = contacts.find(function(c) { return c.id === msg.senderId })
          var avBg = sc ? (sc.avatarUrl ? 'background-image:url(' + esc(sc.avatarUrl) + ');background-size:cover' : 'background:' + avatarColor(msg.senderId)) : 'background:#ccc'
          h += '<div style="width:' + avSz + ';height:' + avSz + ';flex-shrink:0;border-radius:' + ast.avatarRadius + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:.65rem;font-weight:600;' + avBg + '">'
          if (!sc || !sc.avatarUrl) h += '<span>' + esc((sc ? sc.name : '?').charAt(0)) + '</span>'
          h += '</div>'
        }
        // Bubble content
        h += '<div style="min-width:0;max-width:75%">'
        var bubbleStyle = isSelf
          ? 'max-width:180px;padding:8px 12px;font-size:' + ast.bubbleFontSize + ';line-height:1.5;overflow-wrap:break-word;background:' + ast.selfBubbleBg + ';color:' + ast.selfBubbleText + ';border-radius:' + ast.selfBubbleRadius + ' ' + ast.selfBubbleRadius + ' 2px ' + ast.selfBubbleRadius
          : 'max-width:180px;padding:8px 12px;font-size:' + ast.bubbleFontSize + ';line-height:1.5;overflow-wrap:break-word;background:' + ast.otherBubbleBg + ';color:' + ast.otherBubbleText + ';border-radius:' + ast.otherBubbleRadius + ' ' + ast.otherBubbleRadius + ' ' + ast.otherBubbleRadius + ' 2px'
        if (msg.type === 'image') {
          h += '<div style="' + bubbleStyle + '">'
          h += '<img src="' + esc(msg.image || '') + '" style="max-width:120px;border-radius:4px" onerror="this.style.display=\'none\'">'
          h += '</div>'
        } else if (msg.type === 'redpacket') {
          h += '<div style="max-width:180px;padding:8px 12px;background:#C46060;color:#fff;border-radius:8px;text-align:center"><div style="font-size:.85rem;font-weight:700">' + (msg.redpacketAmount || 0).toFixed(2) + '</div><div style="font-size:.6rem;opacity:.8">' + esc(msg.redpacketMsg || '恭喜发财') + '</div></div>'
        } else if (msg.type === 'transfer') {
          h += '<div style="max-width:180px;padding:10px 12px;background:#D4915A;color:#fff;border-radius:8px"><div style="font-size:.6rem;opacity:.8">转账</div><div style="font-size:.85rem;font-weight:700">¥' + (msg.transferAmount || 0).toFixed(2) + '</div></div>'
        } else if (msg.type === 'familycard') {
          h += '<div style="max-width:180px;padding:10px 12px;background:#8B7AAA;color:#fff;border-radius:8px;text-align:center"><div style="font-size:.6rem;opacity:.8">亲属卡</div><div style="font-size:.75rem">' + esc(msg.fcRelation || '亲人') + '</div><div style="font-size:.85rem;font-weight:700">¥' + (msg.fcAmount || 0).toFixed(2) + '</div></div>'
        } else if (msg.type === 'voice') {
          var dur = msg.duration || Math.max(1, Math.round((msg.text || '').length * 0.3))
          var barCount = Math.min(20, Math.max(4, Math.round(dur * 3)))
          var bars = ''
          for (var bi = 0; bi < barCount; bi++) {
            var bh = 4 + Math.abs(Math.sin(bi * 0.7 + 1.5)) * 14
            bars += '<rect x="' + (bi * 5) + '" y="' + (20 - bh) / 2 + '" width="3" height="' + bh + '" rx="1.5"/>'
          }
          h += '<div style="' + bubbleStyle + ';cursor:pointer;min-width:100px" onclick="var t=this.querySelector(\'.cv-text\');t.style.display=t.style.display==\'none\'?\'block\':\'none\'">'
          h += '<svg width="' + (barCount * 5 + 2) + '" height="20" viewBox="0 0 ' + (barCount * 5 + 2) + ' 20" style="fill:currentColor;opacity:.7">' + bars + '</svg>'
          h += '<span style="font-size:.65rem;margin-left:4px;opacity:.6">' + dur + '"</span>'
          h += '<span class="cv-text" style="display:none;font-size:.75rem;margin-top:4px;line-height:1.4">' + esc(msg.text || '') + '</span>'
          h += '</div>'
        } else {
          h += '<div style="' + bubbleStyle + '">'
          if (msg.quoteId && msg.quoteText) {
            h += '<div style="font-size:.6rem;opacity:.7;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,.1)">引用：' + esc(msg.quoteText.substring(0, 40)) + '</div>'
          }
          h += esc(msg.text || '') + '</div>'
        }
        h += '</div>'
        h += '</div>'
      }
    }
    h += '</div>'

    // Choice popup panel
    if (allChoices.length > 0) {
      h += '<div id="rdChoiceList" style="display:none;position:absolute;bottom:42px;left:0;right:0;background:#fff;border:1px solid #CAD3E0;border-radius:4px;max-height:200px;overflow-y:auto;z-index:30;box-shadow:0 -4px 12px rgba(0,0,0,.15);margin:0 6px">'
      for (var ac = 0; ac < allChoices.length; ac++) {
        var acv = allChoices[ac]
        h += '<div class="rd-reply-option" data-ri="' + acv.roundIdx + '" data-mi="' + acv.msgIdx + '" data-ci="' + acv.choiceIdx + '" style="padding:10px 14px;font-size:.78rem;color:#4a5568;cursor:pointer;border-bottom:1px solid #eee">' + esc(acv.text) + '</div>'
      }
      h += '</div>'
    }

    // Bottom input bar
    h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f6f8;border-top:1px solid #d8dce4;flex-shrink:0">'
    h += '<input id="chatInput" readonly style="flex:1;padding:7px 12px;border:1px solid #d8dce4;border-radius:18px;font-size:.76rem;outline:none;background:' + (allChoices.length > 0 ? '#fff' : '#e8e8e8') + ';color:' + (allChoices.length > 0 ? '#4a5568' : '#aaa') + ';cursor:' + (allChoices.length > 0 ? 'pointer' : 'default') + '" placeholder="' + (allChoices.length > 0 ? '点击选择回复...' : '暂无可用选项') + '" value="">'
    h += '<button id="chatSendBtn" style="width:30px;height:30px;border:none;background:#222;color:#fff;cursor:pointer;border-radius:50%;font-size:.7rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">▶</button>'
    h += '</div>'

    h += '</div>'
    frame.innerHTML = h

    // ---- Bind events ----
    frame.querySelector('#chatBack').onclick = backToList

    var chatInput = frame.querySelector('#chatInput')
    var sendBtn = frame.querySelector('#chatSendBtn')
    var choiceList = frame.querySelector('#rdChoiceList')

    function pickChoice(ri, mi, ci) {
      if (!rounds[ri] || !rounds[ri].messages[mi]) return
      var m = rounds[ri].messages[mi]
      if (!m.choices || !m.choices[ci]) return
      var choice = m.choices[ci]
      if (choice.replyText) {
        rounds[ri].messages.push({ id: 'r' + Date.now(), senderId: 'self', text: choice.replyText, type: 'text', time: new Date().toLocaleString() })
      }
      if (choice.followUpMessages) {
        choice.followUpMessages.forEach(function(fm) {
          rounds[ri].messages.push(Object.assign({}, fm, { id: 'r' + Date.now() + Math.random() }))
        })
      }
      if (choiceList) choiceList.style.display = 'none'
      renderChat()
    }

    // Input bar toggle
    if (chatInput) chatInput.onclick = function(e) { e.stopPropagation(); if (choiceList) choiceList.style.display = (choiceList.style.display === 'block' ? 'none' : 'block') }
    if (sendBtn) sendBtn.onclick = function(e) { e.stopPropagation(); if (choiceList) choiceList.style.display = (choiceList.style.display === 'block' ? 'none' : 'block') }

    // Option clicks
    if (choiceList) {
      choiceList.querySelectorAll('.rd-reply-option').forEach(function(opt) {
        opt.onclick = function(e) {
          e.stopPropagation()
          pickChoice(parseInt(opt.dataset.ri), parseInt(opt.dataset.mi), parseInt(opt.dataset.ci))
        }
        opt.onmouseenter = function() { opt.style.background = '#f5f5f5' }
        opt.onmouseleave = function() { opt.style.background = '' }
      })
      frame.addEventListener('click', function(e) {
        if (choiceList.style.display === 'block' && !choiceList.contains(e.target) && e.target !== chatInput && e.target !== sendBtn) {
          choiceList.style.display = 'none'
        }
      })
    }
  }

  renderChat()
}

// ---- Forum post viewer ----
function openReaderForumPost(frame, w, pd, postId, postIndex) {
  var posts = pd.forumPosts || []
  var post = posts.find(function(p) { return p.id === postId })
  if (!post) return

  function backToList() {
    openReaderApp('forum')
    focusReaderControl(frame, '.rd-post-card[data-post-index="' + postIndex + '"]')
  }

  var h = '<div style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;color:#333;background:#fff">'
  h += '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #ddd;flex-shrink:0">'
  h += '<button type="button" class="rd-back-btn" aria-label="返回论坛列表" style="color:#888">←</button>'
  h += '<span style="font-size:.85rem;font-weight:600;flex:1;text-align:center;color:#555">帖子详情</span>'
  h += '<span class="rd-back-spacer" aria-hidden="true"></span>'
  h += '</div>'
  h += '<div style="flex:1;overflow-y:auto;padding:12px">'
  h += '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px">'
  h += '<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.85rem;font-weight:600;flex-shrink:0;background:' + avatarColor(post.contactId) + '">' + (post.contactName || '?').charAt(0) + '</div>'
  h += '<div style="flex:1"><div style="font-size:.82rem;font-weight:600;color:#555">' + esc(post.contactName || '匿名') + '</div><div style="font-size:.68rem;color:#999">' + esc(post.time || '') + '</div></div>'
  h += '</div>'
  h += '<div style="font-size:.9rem;font-weight:600;color:#555;margin-bottom:8px">' + esc(post.title || '') + '</div>'
  h += '<div style="font-size:.8rem;color:#333;line-height:1.6">' + esc(post.content || '') + '</div>'
  if (post.images && post.images.length > 0) {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">'
    post.images.forEach(function(img) {
      h += '<img src="' + esc(img) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border:1px solid #eee" onerror="this.style.display=\'none\'">'
    })
    h += '</div>'
  }
  h += '</div>'
  h += '</div>'
  frame.innerHTML = h
  var backBtn = frame.querySelector('.rd-back-btn')
  if (backBtn) {
    backBtn.onclick = backToList
    backBtn.focus()
  }
}

// ====== Reader Phone Custom (Beautification Panel) ======
function getPhoneCustom() {
  return lsGet('phoneCustom') || {
    wallpaper: '#d0e8f5', wallpaperType: 'color', wallpaperImage: null,
    frameColor: '#ccc', borderRadius: 28, fontFamily: "'Noto Sans SC', sans-serif",
    fontSize: 12, readerId: '', readerAvatar: null, topBgImage: null,
    showDynamicIsland: true, showHomeIndicator: true, showAppLabels: true,
    showIconShadow: true, iconBorderRadius: 14, iconColumns: 4, materialType: 'glass',
    materialOpacity: 65, timeColor: '#ffffff',
    appBgs: {},
    appSettings: {},
    customFonts: [],
    customIcons: {}
  }
}

function savePhoneCustom(data) {
  var cur = getPhoneCustom()
  for (var k in data) { if (data.hasOwnProperty(k)) cur[k] = data[k] }
  lsSet('phoneCustom', cur)
}

// ====== Phone Preview ======
function renderPhonePreview(ct) {
  var h = '<div class="rd-phone-preview" style="display:flex;justify-content:center;align-items:flex-start">'
  var frameBgStyle = 'width:360px;--phone-bg:' + esc(ct.wallpaper || '#d0e8f5') + ';--phone-radius:' + (ct.borderRadius || 28) + 'px;--phone-font:\'' + (ct.fontFamily || 'Noto Sans SC').replace(/'/g,'') + '\', sans-serif;--phone-fontsize:' + (ct.fontSize || 12) + 'px;--phone-frame:' + esc(ct.frameColor || '#ccc')
  if (ct.wallpaperType === 'image' && ct.wallpaperImage) {
    frameBgStyle += ';background-image:url(' + esc(ct.wallpaperImage) + ');background-size:cover;background-position:center'
  }
  h += '<div class="phone-frame" style="' + frameBgStyle + '">'
  if (ct.showDynamicIsland !== false) {
    h += '<div class="phone-island"><div class="phone-island-pill"></div></div>'
  }
  var coverBg = ct.topBgImage || ct.wallpaperImage || ''
  h += '<div class="phone-profile"'
  if (coverBg) h += ' style="background-image:url(' + esc(coverBg) + ');background-size:cover;background-position:center"'
  h += '>'
  h += '<div class="phone-profile-overlay"></div>'
  h += '<div class="phone-avatar">'
  if (ct.readerAvatar) h += '<img src="' + esc(ct.readerAvatar) + '" alt="">'
  h += '</div>'
  h += '<div class="phone-profile-id">' + esc(ct.readerId || '访客') + '</div>'
  h += '</div>'

  h += '<div class="phone-desktop" style="position:relative;min-height:260px;' + phoneGridContainerStyle() + '">'
  for (var i = 0; i < 8; i++) {
    // Use simple text-based icons — no SVG
    var apps = [
      { type: 'messages', name: '消息',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
      { type: 'forum',    name: '论坛',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>' },
      { type: 'memo',     name: '备忘',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
      { type: 'gallery',  name: '相册',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
      { type: 'browser',  name: '浏览',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
      { type: 'shopping', name: '购物',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' },
      { type: 'customize',name: '美化',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
      { type: 'profile',  name: '个人',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }
    ]
    var app = apps[i]
    if (!app) continue
    var customIcon = readerCustomIconUrl(ct.customIcons && ct.customIcons[app.type])
    var appName = readerAppName(app)
    h += '<button type="button" class="phone-app-icon rd-app-icon" aria-label="' + escapeHtmlAttribute(appName) + '" data-app="' + escapeHtmlAttribute(app.type || '') + '"'
    h += ' style="' + phoneGridItemStyle(i % 4, Math.floor(i / 4)) + 'border:none!important;box-shadow:none!important">'
    h += '<span class="phone-icon-body icon-shadow" style="background:' + (app.color || '#f0f0f0') + ';">'
    if (customIcon) {
      h += '<img src="' + escapeHtmlAttribute(customIcon) + '" alt="" style="width:36px;height:36px;object-fit:contain" onerror="this.style.display=\'none\'">'
      h += '<span class="phone-icon-char" style="font-size:22px;color:#333;width:36px;height:36px;display:none;align-items:center;justify-content:center">' + app.icon + '</span>'
    } else {
      h += '<span class="phone-icon-char" style="font-size:22px;color:#333;width:36px;height:36px;display:flex;align-items:center;justify-content:center">' + app.icon + '</span>'
    }
    h += '</span>'
    if (ct.showAppLabels !== false) {
      h += '<span class="phone-icon-label">' + esc(app.name) + '</span>'
    }
    h += '</button>'
  }
  h += '</div>'

  if (ct.showHomeIndicator !== false) {
    h += '<div class="phone-home-bar"><div class="phone-home-indicator"></div></div>'
  }
  h += '</div></div>'
  return h
}

function showReaderToast(msg) {
  var t = document.createElement('div')
  t.className = 'rd-toast'
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(function() { t.remove() }, 2500)
}

// ====== Custom Font Engine ======
function applyCustomFonts() {
  var ct = getPhoneCustom()
  var existing = document.getElementById('cu-custom-fonts-style')
  if (existing) existing.remove()
  var fonts = ct.customFonts || []
  if (!fonts.length) return
  var css = ''
  fonts.forEach(function(f, i) {
    css += '@font-face{font-family:"' + f.name.replace(/"/g,'') + '";src:url(' + f.data + ');font-display:swap;}\n'
  })
  var style = document.createElement('style')
  style.id = 'cu-custom-fonts-style'
  style.textContent = css
  document.head.appendChild(style)
}

// ====== Beautification Panel ======
function openReaderCustomizePanel() {
  var ct = getPhoneCustom()
  var colors = [
    { name:'极昼白', color:'#f5f0e8' }, { name:'水色', color:'#d0e8f5' }, { name:'樱粉', color:'#f5e8f0' },
    { name:'薄荷', color:'#e8f5f0' }, { name:'奶油', color:'#faf5ed' }, { name:'薰衣草', color:'#ede8f5' },
    { name:'浅灰', color:'#e8e8e8' }, { name:'暗夜', color:'#1a1a2e' }
  ]
  var fColors = [
    { name:'亮银', color:'#ccc' }, { name:'深空灰', color:'#555' }, { name:'玫瑰金', color:'#e8a0b0' },
    { name:'天峰蓝', color:'#4a7a9a' }, { name:'暗夜紫', color:'#6a4a8a' }, { name:'奶油金', color:'#d4af7a' }
  ]
  var body = '<div class="cu-section"><div class="cu-section-title">壁纸颜色</div><div class="rd-color-grid">'
  for (var ci = 0; ci < colors.length; ci++) {
    body += '<button class="rd-cu-color-btn' + (ct.wallpaper === colors[ci].color ? ' active' : '') + '" data-cu-color="' + colors[ci].color + '" style="background:' + colors[ci].color + '" title="' + colors[ci].name + '"></button>'
  }
  body += '</div></div>'

  body += '<div class="cu-section"><div class="cu-section-title">自定义背景图</div>'
  body += '<div class="rd-input-row"><input class="rd-input" id="cuWpUrl" value="' + esc(ct.wallpaperImage || '') + '" placeholder="输入图片URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer" id="cuUploadBg">上传</button></div>'
  if (ct.wallpaperImage) body += '<div class="rd-preview-img"><img src="' + esc(ct.wallpaperImage) + '" alt=""><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="cuClearBg">清除</button></div>'
  body += '</div>'

  body += '<div class="cu-section"><div class="cu-section-title">边框颜色</div><div class="rd-color-grid">'
  for (var fi = 0; fi < fColors.length; fi++) {
    body += '<button class="rd-cu-color-btn' + (ct.frameColor === fColors[fi].color ? ' active' : '') + '" data-cu-fcolor="' + fColors[fi].color + '" style="background:' + fColors[fi].color + '" title="' + fColors[fi].name + '"></button>'
  }
  body += '</div></div>'

  body += '<div class="cu-section"><div class="cu-section-title">圆角: <span id="cuRadiusLabel">' + (ct.borderRadius || 28) + '</span>px</div>'
  body += '<input class="rd-range" id="cuRadius" type="range" min="0" max="40" value="' + (ct.borderRadius || 28) + '"></div>'

  var customFonts = ct.customFonts || []
  body += '<div class="cu-section"><div class="cu-section-title">字体</div><div class="rd-font-grid">'
  for (var cfi = 0; cfi < customFonts.length; cfi++) {
    var cf = customFonts[cfi]
    var ffn = '"' + cf.name + '"'
    body += '<button class="btn btn-sm' + (ct.fontFamily === ffn ? ' btn-primary' : ' btn-outline') + '" data-cu-font="' + esc(cf.name) + '">' + esc(cf.name) + '</button>'
  }
  body += '</div>'
  body += '<div style="padding:4px 0"><button style="padding:5px 14px;font-size:.72rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer;border-radius:4px" id="cuUploadFont">上传字体 (.ttf/.woff)</button></div>'
  body += '<div id="cuFontList" style="padding:4px 0">'
  for (var cfi2 = 0; cfi2 < customFonts.length; cfi2++) {
    body += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><span style="font-size:.7rem;color:#555;flex:1">' + esc(customFonts[cfi2].name) + '</span><button style="padding:2px 8px;font-size:.65rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;border-radius:3px" data-cu-del-font="' + cfi2 + '">删除</button></div>'
  }
  body += '</div>'
  body += '</div>'

  body += '<div class="cu-section">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuIsland"' + (ct.showDynamicIsland !== false ? ' checked' : '') + '> 灵动岛</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuLabels"' + (ct.showAppLabels !== false ? ' checked' : '') + '> App名称</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuHome"' + (ct.showHomeIndicator !== false ? ' checked' : '') + '> Home指示条</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuShadow"' + (ct.showIconShadow !== false ? ' checked' : '') + '> 图标阴影</label>'
  body += '</div>'

  var ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'
ov.innerHTML = '<div style="background:#fff;max-width:420px;max-width:min(420px,calc(100vw - 40px));width:100%;max-height:85vh;overflow-y:auto;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ddd"><span style="font-size:1rem;font-weight:600;color:#333">美化</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="cuCloseX">×</button></div><div style="padding:14px 16px">' + body + '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #ddd"><button style="padding:6px 16px;font-size:.8rem;border:none;background:var(--c-primary);color:var(--c-btn-text);cursor:pointer;border-radius:4px" id="cuSave">保存</button><button style="padding:6px 16px;font-size:.8rem;border:1px solid #ddd;background:#fff;color:#666;cursor:pointer;border-radius:4px" id="cuCancel">取消</button></div></div>'
  document.body.appendChild(ov)
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#cuCloseX').onclick = function() { ov.remove() }
  ov.querySelector('#cuCancel').onclick = function() { ov.remove() }

  // ---- bind events ----
  var colorBtns = ov.querySelectorAll('[data-cu-color]')
  colorBtns.forEach(function(b) { b.onclick = function() { ct.wallpaper = b.dataset.cuColor; ct.wallpaperType = 'color'; ct.wallpaperImage = null; ov.querySelectorAll('[data-cu-color]').forEach(function(x){x.classList.remove('active')}); b.classList.add('active') } })
  var fcolorBtns = ov.querySelectorAll('[data-cu-fcolor]')
  fcolorBtns.forEach(function(b) { b.onclick = function() { ct.frameColor = b.dataset.cuFcolor; ov.querySelectorAll('[data-cu-fcolor]').forEach(function(x){x.classList.remove('active')}); b.classList.add('active') } })
  var fontBtns = ov.querySelectorAll('[data-cu-font]')
  fontBtns.forEach(function(b) { b.onclick = function() { ct.fontFamily = '"' + b.dataset.cuFont + '"'; ov.querySelectorAll('[data-cu-font]').forEach(function(x){x.classList.remove('btn-primary');x.classList.add('btn-outline')}); b.classList.remove('btn-outline');b.classList.add('btn-primary') } })
  var radiusEl = ov.querySelector('#cuRadius')
  if (radiusEl) radiusEl.oninput = function() { ct.borderRadius = parseInt(this.value); var lbl = ov.querySelector('#cuRadiusLabel'); if (lbl) lbl.textContent = ct.borderRadius }

  // Font upload
  var fontUpload = ov.querySelector('#cuUploadFont')
  if (fontUpload) fontUpload.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2'
    inp.onchange = function() {
      var file = inp.files[0]; if (!file) return
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      var r = new FileReader()
      r.onload = function() {
        ct.customFonts = ct.customFonts || []
        ct.customFonts.push({ name: name, data: r.result })
        savePhoneCustom(ct)
        ov.querySelector('#cuCloseX').click()
        openReaderCustomizePanel()
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  // Font delete buttons (delegation won't work here, add IDs)
  ov.querySelectorAll('[data-cu-del-font]').forEach(function(b) {
    b.onclick = function() {
      var idx = parseInt(b.dataset.cuDelFont)
      ct.customFonts = ct.customFonts || []
      ct.customFonts.splice(idx, 1)
      savePhoneCustom(ct)
      ov.querySelector('#cuCloseX').click()
      openReaderCustomizePanel()
    }
  })

  var wpUpload = ov.querySelector('#cuUploadBg')
  if (wpUpload) wpUpload.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = function() { var file = inp.files[0]; if (!file) return; var r = new FileReader(); r.onload = function() { ct.wallpaperImage = r.result; ct.wallpaperType = 'image'; ov.querySelector('#cuWpUrl').value = r.result }; r.readAsDataURL(file) }; inp.click()
  }
  var clearBg = ov.querySelector('#cuClearBg')
  if (clearBg) clearBg.onclick = function() { ct.wallpaperImage = null; ct.wallpaperType = 'color'; ov.querySelector('#cuWpUrl').value = ''; ov.querySelector('.rd-preview-img')?.remove() }

  ov.querySelector('#cuSave').onclick = function() {
    var wpu = ov.querySelector('#cuWpUrl'); if (wpu && wpu.value.trim()) { ct.wallpaperImage = wpu.value.trim(); ct.wallpaperType = 'image' }
    ct.showDynamicIsland = ov.querySelector('#cuIsland').checked
    ct.showAppLabels = ov.querySelector('#cuLabels').checked
    ct.showHomeIndicator = ov.querySelector('#cuHome').checked
    ct.showIconShadow = ov.querySelector('#cuShadow').checked
    savePhoneCustom(ct)
    ov.remove()
    renderCustomPage()
    showReaderToast('美化设置已保存')
  }
}

function openReaderProfilePanel() {
  var ct = getPhoneCustom()
  var body = '<div class="cu-section"><div class="cu-section-title">个人信息</div>'
  body += '<label class="cu-label">昵称</label><input class="rd-input" id="rpName" value="' + esc(ct.readerId || '') + '" placeholder="默认使用作品昵称">'
  body += '<label class="cu-label">头像</label>'
  body += '<div class="rd-input-row"><input class="rd-input" id="rpAvatarUrl" value="' + esc(ct.readerAvatar || '') + '" placeholder="输入头像URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer" id="rpUploadAv">上传</button></div>'
  if (ct.readerAvatar) body += '<div class="rd-preview-img"><img src="' + esc(ct.readerAvatar) + '" alt="" style="border-radius:50%"><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="rpClearAv">清除</button></div>'
  body += '<label class="cu-label">顶部背景图</label>'
  body += '<div class="rd-input-row"><input class="rd-input" id="rpTopBgUrl" value="' + esc(ct.topBgImage || '') + '" placeholder="输入图片URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer" id="rpUploadTop">上传</button></div>'
  if (ct.topBgImage) body += '<div class="rd-preview-img"><img src="' + esc(ct.topBgImage) + '" alt=""><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="rpClearTop">清除</button></div>'
  body += '</div>'

  var ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'
  ov.innerHTML = '<div style="background:#fff;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ddd"><span style="font-size:1rem;font-weight:600;color:#333">个人信息</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="rpCloseX">×</button></div><div style="padding:14px 16px">' + body + '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #ddd"><button style="padding:6px 16px;font-size:.8rem;border:none;background:var(--c-primary);color:var(--c-btn-text);cursor:pointer;border-radius:4px" id="rpSave">保存</button><button style="padding:6px 16px;font-size:.8rem;border:1px solid #ddd;background:#fff;color:#666;cursor:pointer;border-radius:4px" id="rpCancel">取消</button></div></div>'
  document.body.appendChild(ov)
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#rpCloseX').onclick = function() { ov.remove() }
  ov.querySelector('#rpCancel').onclick = function() { ov.remove() }

  ov.querySelector('#rpSave').onclick = function() {
    ct.readerId = ov.querySelector('#rpName').value.trim() || ct.readerId
    var avu = ov.querySelector('#rpAvatarUrl'); if (avu && avu.value.trim()) ct.readerAvatar = avu.value.trim()
    var tbu = ov.querySelector('#rpTopBgUrl'); if (tbu && tbu.value.trim()) ct.topBgImage = tbu.value.trim()
    savePhoneCustom(ct)
    ov.remove()
    renderCustomPage()
    showReaderToast('个人信息已保存')
  }
  // Upload buttons
  function bindUpload(btnId, setter) {
    var btn = ov.querySelector(btnId); if (!btn) return
    btn.onclick = function() {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
      inp.onchange = function() { var file = inp.files[0]; if (!file) return; var r = new FileReader(); r.onload = function() { setter(r.result) }; r.readAsDataURL(file) }; inp.click()
    }
  }
  bindUpload('#rpUploadAv', function(v) { ct.readerAvatar = v })
  bindUpload('#rpUploadTop', function(v) { ct.topBgImage = v })
  var clearAv = ov.querySelector('#rpClearAv'); if (clearAv) clearAv.onclick = function() { ct.readerAvatar = null }
  var clearTop = ov.querySelector('#rpClearTop'); if (clearTop) clearTop.onclick = function() { ct.topBgImage = null }
}

// ---- App Settings defaults ----
function getAppSettings(type) {
  var ct = getPhoneCustom()
  ct.appSettings = ct.appSettings || {}
  var defaults = {
    messages: {
      avatarShape: 'circle', avatarSize: 36,
      selfBubbleBg: '#555', selfBubbleText: '#fff', selfBubbleRadius: 8,
      otherBubbleBg: '#fff', otherBubbleText: '#333', otherBubbleRadius: 8,
      bubbleFontSize: 13, timeColor: '#b0b8c4', chatBg: '#f0f0f0'
    },
    forum: {
      avatarShape: 'circle',
      cardBg: '#fff', cardBorder: '#eee', cardRadius: 0,
      titleColor: '#555', titleSize: 13, titleWeight: '500',
      contentColor: '#333', contentSize: 13, timeColor: '#999'
    },
    memo: {
      cardStyle: 'plain',
      cardBg: '#fff', cardBorder: '#eee', cardRadius: 4,
      textColor: '#333', fontSize: 12, lineHeight: 1.6
    },
    gallery: {
      columns: 3, imageRadius: 4, gap: 6
    },
    browser: {
      entryBg: 'transparent', entryRadius: 0,
      titleColor: '#555', titleSize: 12, urlColor: '#999', timeColor: '#999'
    },
    shopping: {
      cardBg: 'transparent', cardRadius: 0,
      nameColor: '#333', nameSize: 12, priceColor: '#a3bded'
    },
    contacts: {
      avatarShape: 'circle',
      nameColor: '#555', nameSize: 13, nameWeight: '500'
    }
  }
  if (!ct.appSettings[type]) ct.appSettings[type] = JSON.parse(JSON.stringify(defaults[type] || {}))
  return ct.appSettings[type]
}

// ---- Apply app settings to styles ----
function appStyle(type) {
  var s = getAppSettings(type)
  var shape = s.avatarShape || 'circle'
  var avRadius = shape === 'circle' ? '50%' : (shape === 'rounded' ? '8px' : '2px')
  return {
    avatarRadius: avRadius,
    avatarSize: s.avatarSize || 36,
    selfBubbleBg: s.selfBubbleBg || '#555',
    selfBubbleText: s.selfBubbleText || '#fff',
    selfBubbleRadius: (s.selfBubbleRadius || 8) + 'px',
    otherBubbleBg: s.otherBubbleBg || '#fff',
    otherBubbleText: s.otherBubbleText || '#333',
    otherBubbleRadius: (s.otherBubbleRadius || 8) + 'px',
    bubbleFontSize: (s.bubbleFontSize || 13) + 'px',
    timeColor: s.timeColor || '#b0b8c4',
    chatBg: s.chatBg || '#f0f0f0',
    cardBg: s.cardBg || '#fff',
    cardBorder: s.cardBorder || '#eee',
    cardRadius: (s.cardRadius || 0) + 'px',
    titleColor: s.titleColor || '#555',
    titleSize: (s.titleSize || 13) + 'px',
    titleWeight: s.titleWeight || '500',
    textColor: s.textColor || '#333',
    fontSize: (s.fontSize || 12) + 'px',
    lineHeight: s.lineHeight || 1.6,
    columns: s.columns || 3,
    imageRadius: (s.imageRadius || 4) + 'px',
    gap: (s.gap || 6) + 'px',
    urlColor: s.urlColor || '#999',
    entryRadius: (s.entryRadius || 0) + 'px',
    nameColor: s.nameColor || '#333',
    nameSize: (s.nameSize || 12) + 'px',
    priceColor: s.priceColor || '#a3bded',
    nameWeight: s.nameWeight || '500',
    cardStyle: s.cardStyle || 'plain'
  }
}

// ---- Modal wrapper ----
function openCuModal(title, bodyHtml, onSave) {
  var ov = document.createElement('div')
  ov.className = 'cu-modal-overlay'
  ov.innerHTML = '<div class="cu-modal"><div class="cu-modal-header"><span class="cu-modal-title">' + esc(title) + '</span><button class="cu-modal-close" id="cuModalClose">\u00d7</button></div><div class="cu-modal-body">' + bodyHtml + '</div><div class="cu-modal-footer"><button class="cu-btn-save" id="cuModalSave">保存</button><button class="cu-btn-cancel" id="cuModalCancel">取消</button></div></div>'
  document.body.appendChild(ov)
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#cuModalClose').onclick = function() { ov.remove() }
  ov.querySelector('#cuModalCancel').onclick = function() { ov.remove() }
  ov.querySelector('#cuModalSave').onclick = function() {
    if (onSave) onSave(ov)
    ov.remove()
  }
  return ov
}

function cuCard(title, body) {
  return '<div class="cu-card"><div class="cu-card-title">' + esc(title) + '</div><div class="cu-card-body">' + body + '</div></div>'
}

function cuRow(label, control) {
  return '<div class="cu-row"><span class="cu-row-label">' + esc(label) + '</span><span class="cu-row-ctrl">' + control + '</span></div>'
}

function cuColorBtn(color, cls, dataAttr, dataVal) {
  return '<button class="cu-color-btn' + (cls || '') + '" style="background:' + color + '" data-' + dataAttr + '="' + dataVal + '"></button>'
}

function cuColorRow(label, presetColors, currentColor, dataAttr) {
  var h = '<div class="cu-color-group">'
  for (var i = 0; i < presetColors.length; i++) {
    h += cuColorBtn(presetColors[i], currentColor === presetColors[i] ? ' active' : '', dataAttr, presetColors[i])
  }
  h += '<input type="color" class="cu-color-picker" value="' + currentColor + '" data-' + dataAttr + '-picker="' + currentColor + '">'
  h += '</div>'
  return cuRow(label, h)
}

function cuShapeBtn(shape, active) {
  var labels = { circle: '圆形', rounded: '圆角方形', square: '方形' }
  var css = shape === 'circle' ? 'border-radius:50%' : (shape === 'rounded' ? 'border-radius:8px' : 'border-radius:2px')
  return '<button class="cu-shape-btn' + (active ? ' active' : '') + '" data-cu-shape="' + shape + '"><span style="display:block;width:24px;height:24px;background:#c4c8d4;' + css + '"></span><small>' + esc(labels[shape] || shape) + '</small></button>'
}

function cuSliderRow(label, id, min, max, step, val, unit) {
  return cuRow(label, '<input type="range" class="cu-slider" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><span class="cu-slider-val" id="' + id + 'Val">' + val + (unit || '') + '</span>')
}

// ====== Preview Panel ======
function renderCuPreview(type, s) {
  var h = '<div class="cu-preview" id="cuPreview">'
  h += '<div class="cu-preview-label">预览</div>'

  if (type === 'messages') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    var avSz = (s.avatarSize || 36) + 'px'
    var selfBg = s.selfBubbleBg || '#555'
    var selfText = s.selfBubbleText || '#fff'
    var selfRad = (s.selfBubbleRadius || 8) + 'px'
    var otherBg = s.otherBubbleBg || '#fff'
    var otherText = s.otherBubbleText || '#333'
    var otherRad = (s.otherBubbleRadius || 8) + 'px'
    var fs = (s.bubbleFontSize || 13) + 'px'
    var tc = s.timeColor || '#b0b8c4'
    h += '<div class="cu-preview-msg" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 消息</span></div>'
    h += '<div style="display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid #eee;align-items:center">'
    h += '<div style="width:' + avSz + ';height:' + avSz + ';border-radius:' + avRadius + ';background:#6366f1;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">A</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:.6rem;font-weight:500;color:#555">示例联系人</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:5px 8px;align-items:center">'
    h += '<div style="width:' + avSz + ';height:' + avSz + ';border-radius:' + avRadius + ';background:#10b981;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">群</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:.6rem;font-weight:500;color:#555">示例群聊</div></div>'
    h += '</div>'
    h += '<div style="background:' + (s.chatBg || '#f0f0f0') + ';padding:4px 8px">'
    h += '<div style="text-align:center;font-size:.48rem;color:' + tc + ';padding:2px 0">12:30</div>'
    h += '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:flex-start">'
    h += '<div style="width:24px;height:24px;border-radius:' + avRadius + ';background:#6366f1;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem">A</div>'
    h += '<div style="max-width:65%;padding:4px 7px;font-size:' + fs + ';line-height:1.4;background:' + otherBg + ';color:' + otherText + ';border-radius:' + otherRad + ' ' + otherRad + ' ' + otherRad + ' 2px;word-break:break-word">你好！</div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;align-items:flex-start;flex-direction:row-reverse">'
    h += '<div style="max-width:65%;padding:4px 7px;font-size:' + fs + ';line-height:1.4;background:' + selfBg + ';color:' + selfText + ';border-radius:' + selfRad + ' ' + selfRad + ' 2px ' + selfRad + ';word-break:break-word">周末见！</div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'forum') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    h += '<div class="cu-preview-forum" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 论坛</span></div>'
    h += '<div style="padding:6px 8px;background:' + (s.cardBg || '#fff') + '">'
    h += '<div style="display:flex;gap:6px;padding:4px 0;border-bottom:1px solid #eee;align-items:center">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:#8b5cf6;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem;font-weight:600">B</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 13) + 'px;font-weight:' + (s.titleWeight || '500') + ';color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">示例帖子标题</div><div style="font-size:.45rem;color:' + (s.timeColor || '#999') + '">用户A · 12:30</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:4px 0;align-items:center">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:#d946ef;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem;font-weight:600">C</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 13) + 'px;font-weight:' + (s.titleWeight || '500') + ';color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">另一个话题</div><div style="font-size:.45rem;color:' + (s.timeColor || '#999') + '">用户B · 11:20</div></div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'memo') {
    var memoBg = s.cardBg || '#fff'
    var memoBorder = s.cardBorder || '#eee'
    var memoRad = (s.cardRadius || 4) + 'px'
    if (s.cardStyle === 'sticky') { memoBg = '#fef9e7'; memoBorder = '#e8d5a0' }
    if (s.cardStyle === 'vintage') { memoBg = '#f5e6c8'; memoBorder = '#d4c4a0'; memoRad = '2px' }
    h += '<div class="cu-preview-memo" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 备忘录</span></div>'
    h += '<div style="padding:6px 8px">'
    h += '<div style="padding:6px 8px;margin-bottom:4px;background:' + memoBg + ';border:1px solid ' + memoBorder + ';border-radius:' + memoRad + ';font-size:' + (s.fontSize || 12) + 'px;color:' + (s.textColor || '#333') + ';line-height:' + (s.lineHeight || 1.6) + '">记得买牛奶和面包</div>'
    h += '<div style="padding:6px 8px;background:' + memoBg + ';border:1px solid ' + memoBorder + ';border-radius:' + memoRad + ';font-size:' + (s.fontSize || 12) + 'px;color:' + (s.textColor || '#333') + ';line-height:' + (s.lineHeight || 1.6) + '">周三下午三点小组会议</div>'
    h += '</div></div>'
  } else if (type === 'gallery') {
    var cols = s.columns || 3
    var imgRad = (s.imageRadius || 4) + 'px'
    var gap = (s.gap || 6) + 'px'
    var swatches = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b', '#10b981']
    h += '<div class="cu-preview-gallery" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 相册</span></div>'
    h += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:' + gap + ';padding:6px">'
    for (var gi = 0; gi < (cols * 2); gi++) {
      h += '<div style="aspect-ratio:1;background:' + swatches[gi % swatches.length] + ';border-radius:' + imgRad + ';opacity:.6"></div>'
    }
    h += '</div></div>'
  } else if (type === 'browser') {
    h += '<div class="cu-preview-browser" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 浏览记录</span></div>'
    h += '<div style="padding:2px 8px">'
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #eee">'
    h += '<div style="width:6px;height:6px;border-radius:50%;background:#6366f1;flex-shrink:0"></div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 12) + 'px;font-weight:500;color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">示例网页标题</div><div style="font-size:.48rem;color:' + (s.urlColor || '#999') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">https://example.com</div></div>'
    h += '<span style="font-size:.45rem;color:' + (s.timeColor || '#999') + ';white-space:nowrap">12:30</span>'
    h += '</div>'
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0">'
    h += '<div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0"></div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 12) + 'px;font-weight:500;color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">另一个记录</div><div style="font-size:.48rem;color:' + (s.urlColor || '#999') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">https://example.org</div></div>'
    h += '<span style="font-size:.45rem;color:' + (s.timeColor || '#999') + ';white-space:nowrap">11:05</span>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'shopping') {
    h += '<div class="cu-preview-shop" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 购物清单</span></div>'
    h += '<div style="padding:4px 8px">'
    h += '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #eee;align-items:flex-start">'
    h += '<div style="width:34px;height:34px;background:#e8ebf0;border:1px solid #eee;flex-shrink:0"></div>'
    h += '<div style="flex:1"><div style="font-size:' + (s.nameSize || 12) + 'px;font-weight:500;color:' + (s.nameColor || '#333') + '">示例商品A</div><div style="font-size:.6rem;color:' + (s.priceColor || '#a3bded') + '">¥99.00</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:3px 0;align-items:flex-start">'
    h += '<div style="width:34px;height:34px;background:#e8ebf0;border:1px solid #eee;flex-shrink:0"></div>'
    h += '<div style="flex:1"><div style="font-size:' + (s.nameSize || 12) + 'px;font-weight:500;color:' + (s.nameColor || '#333') + '">示例商品B</div><div style="font-size:.6rem;color:' + (s.priceColor || '#a3bded') + '">¥199.00</div></div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'contacts') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    h += '<div class="cu-preview-contact" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 联系人</span></div>'
    h += '<div style="padding:4px 8px">'
    h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:' + avatarColor('demo1') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">C</div>'
    h += '<div style="font-size:' + (s.nameSize || 13) + 'px;font-weight:' + (s.nameWeight || '500') + ';color:' + (s.nameColor || '#555') + '">示例联系人A</div>'
    h += '</div>'
    h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:' + avatarColor('demo2') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">D</div>'
    h += '<div style="font-size:' + (s.nameSize || 13) + 'px;font-weight:' + (s.nameWeight || '500') + ';color:' + (s.nameColor || '#555') + '">示例联系人B</div>'
    h += '</div>'
    h += '</div></div>'
  }
  h += '</div>'
  return h
}

function readCurrentSettings(modal, type) {
  var s = getAppSettings(type)
  // Read sliders
  var sliderMap = {
    cuMsgAvSize: 'avatarSize', cuSelfRadius: 'selfBubbleRadius', cuOtherRadius: 'otherBubbleRadius',
    cuBubbleFs: 'bubbleFontSize', cuCardRadius: 'cardRadius', cuTitleSize: 'titleSize',
    cuFontSize: 'fontSize', cuLineHeight: 'lineHeight', cuImgRadius: 'imageRadius',
    cuGap: 'gap', cuEntryRadius: 'entryRadius', cuNameSize: 'nameSize'
  }
  for (var id in sliderMap) {
    var el = modal.querySelector('#' + id)
    if (el) s[sliderMap[id]] = parseFloat(el.value) || s[sliderMap[id]]
  }
  // Read active color buttons
  var colorBtnMap = {
    'cu-self-bg': 'selfBubbleBg', 'cu-self-text': 'selfBubbleText',
    'cu-other-bg': 'otherBubbleBg', 'cu-other-text': 'otherBubbleText',
    'cu-chat-bg': 'chatBg', 'cu-time-color': 'timeColor',
    'cu-card-bg': 'cardBg', 'cu-title-color': 'titleColor',
    'cu-text-color': 'textColor', 'cu-url-color': 'urlColor',
    'cu-name-color': 'nameColor', 'cu-price-color': 'priceColor'
  }
  for (var attr in colorBtnMap) {
    var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
    if (btn) { s[colorBtnMap[attr]] = btn.getAttribute('data-' + attr); continue }
    var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
    if (picker && picker.value) s[colorBtnMap[attr]] = picker.value
  }
  // Read active shape button
  var shapeBtn = modal.querySelector('.cu-shape-btn.active')
  if (shapeBtn && shapeBtn.dataset.cuShape) s.avatarShape = shapeBtn.dataset.cuShape
  // Read active style buttons
  var memoStyle = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
  if (memoStyle) s.cardStyle = memoStyle.dataset.cuMemoStyle
  var galleryCol = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
  if (galleryCol) s.columns = parseInt(galleryCol.dataset.cuGalleryCols) || 3
  return s
}

function updateCuPreview(modal, type) {
  var preview = modal.querySelector('#cuPreview')
  if (!preview) return
  var s = readCurrentSettings(modal, type)
  preview.innerHTML = renderCuPreview(type, s).replace(/^<div class="cu-preview"[^>]*>/, '').replace(/<\/div>$/, '')
}

// ====== Per-App Settings Panel ======
function openReaderAppSettings(type) {
  var ct = getPhoneCustom()
  ct.appSettings = ct.appSettings || {}
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物', contacts:'联系人' }
  var title = '美化 - ' + (labels[type] || 'App')

  var s = getAppSettings(type)
  var body = ''

  if (type === 'messages') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuCard('头像设置',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>') +
      cuSliderRow('尺寸', 'cuMsgAvSize', 24, 56, 2, s.avatarSize, 'px')
    )
    body += cuCard('我方气泡',
      cuColorRow('背景色', ['#555', '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'], s.selfBubbleBg, 'cu-self-bg') +
      cuColorRow('文字色', ['#fff', '#333', '#1a1a2e', '#4a3a2a'], s.selfBubbleText, 'cu-self-text') +
      cuSliderRow('圆角', 'cuSelfRadius', 0, 20, 1, s.selfBubbleRadius, 'px')
    )
    body += cuCard('对方气泡',
      cuColorRow('背景色', ['#fff', '#f0f0f0', '#e8f4e8', '#fef9e7', '#f0e8f4', '#e8f0f8'], s.otherBubbleBg, 'cu-other-bg') +
      cuColorRow('文字色', ['#333', '#555', '#1a1a2e', '#4a3a2a'], s.otherBubbleText, 'cu-other-text') +
      cuSliderRow('圆角', 'cuOtherRadius', 0, 20, 1, s.otherBubbleRadius, 'px')
    )
    body += cuCard('文字',
      cuSliderRow('字号', 'cuBubbleFs', 10, 18, 1, s.bubbleFontSize, 'px')
    )
    body += cuCard('聊天背景',
      cuColorRow('背景色', ['#f0f0f0', '#fff', '#e8e8e8', '#1a1a2e', '#c8dcc8'], s.chatBg, 'cu-chat-bg')
    )
    body += cuCard('时间标签',
      cuColorRow('颜色', ['#b0b8c4', '#999', '#666', '#333'], s.timeColor, 'cu-time-color')
    )
  } else if (type === 'forum') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuCard('头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    )
    body += cuCard('帖子卡片',
      cuColorRow('背景色', ['#fff', '#f8f8f8', '#e8f0f8', '#fef9e7'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px')
    )
    body += cuCard('标题',
      cuColorRow('颜色', ['#555', '#333', '#1a1a2e', '#6366f1'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 18, 1, s.titleSize, 'px')
    )
    body += cuCard('时间标签',
      cuColorRow('颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color')
    )
  } else if (type === 'memo') {
    body += cuCard('卡片风格',
      cuRow('样式', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.cardStyle === 'plain' ? ' active' : '') + '" data-cu-memo-style="plain">简洁</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'sticky' ? ' active' : '') + '" data-cu-memo-style="sticky">便签</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'vintage' ? ' active' : '') + '" data-cu-memo-style="vintage">复古</button>' +
        '</div>')
    )
    body += cuCard('外观',
      cuColorRow('背景色', ['#fff', '#fef9e7', '#f5e6c8', '#e8f4e8'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px')
    )
    body += cuCard('文字',
      cuColorRow('颜色', ['#333', '#555', '#4a3a2a', '#1a1a2e'], s.textColor, 'cu-text-color') +
      cuSliderRow('字号', 'cuFontSize', 10, 16, 1, s.fontSize, 'px') +
      cuSliderRow('行间距', 'cuLineHeight', 1.2, 2.4, 0.1, s.lineHeight, '')
    )
  } else if (type === 'gallery') {
    body += cuCard('网格',
      cuRow('列数', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.columns === 2 ? ' active' : '') + '" data-cu-gallery-cols="2">2列</button>' +
        '<button class="cu-style-btn' + (s.columns === 3 ? ' active' : '') + '" data-cu-gallery-cols="3">3列</button>' +
        '<button class="cu-style-btn' + (s.columns === 4 ? ' active' : '') + '" data-cu-gallery-cols="4">4列</button>' +
        '</div>')
    )
    body += cuCard('外观',
      cuSliderRow('图片圆角', 'cuImgRadius', 0, 16, 1, s.imageRadius, 'px') +
      cuSliderRow('间距', 'cuGap', 2, 16, 2, s.gap, 'px')
    )
  } else if (type === 'browser') {
    body += cuCard('标题',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 16, 1, s.titleSize, 'px')
    )
    body += cuCard('URL',
      cuColorRow('颜色', ['#999', '#666', '#888'], s.urlColor, 'cu-url-color')
    )
    body += cuCard('时间标签',
      cuColorRow('颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color')
    )
    body += cuCard('条目',
      cuSliderRow('圆角', 'cuEntryRadius', 0, 12, 1, s.entryRadius, 'px')
    )
  } else if (type === 'shopping') {
    body += cuCard('商品名称',
      cuColorRow('颜色', ['#333', '#555', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 16, 1, s.nameSize, 'px')
    )
    body += cuCard('价格',
      cuColorRow('颜色', ['#a3bded', '#ef4444', '#f59e0b', '#10b981'], s.priceColor, 'cu-price-color')
    )
  } else if (type === 'contacts') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuCard('头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    )
    body += cuCard('名称',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 18, 1, s.nameSize, 'px')
    )
  }

  // Icon card - for all app types
  ct.customIcons = ct.customIcons || {}
  var curIcon = ct.customIcons[type] || ''
  body += cuCard('应用图标',
    cuRow('自定义', '<div style="display:flex;gap:6px;align-items:center">' +
      '<input class="rd-input rd-input-sm" id="cuIconUrl" value="' + esc(curIcon) + '" placeholder="输入图标URL或上传...">' +
      '<button style="padding:4px 10px;font-size:.7rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer;white-space:nowrap" id="cuIconUpload">上传</button>' +
      (curIcon ? '<button style="padding:4px 10px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;white-space:nowrap" id="cuIconClear">清除</button>' : '') +
      '</div>')
  )
  if (curIcon) body += '<div class="rd-preview-img"><img src="' + esc(curIcon) + '" style="max-height:40px;border-radius:4px"></div>'

  body += '<div style="text-align:center;padding-top:8px"><button class="cu-reset-btn" id="cuAppReset">恢复默认</button></div>'

  // Prepend preview
  body = renderCuPreview(type, s) + body

  var ov = openCuModal(title, body, function(modal) {
    // Helper: read color from active button or from picker
    function readColor(attr, key) {
      var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
      if (btn) { s[key] = btn.getAttribute('data-' + attr); return }
      var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
      if (picker && picker.value) s[key] = picker.value
    }
    readColor('cuSelfBg', 'selfBubbleBg')
    readColor('cuSelfText', 'selfBubbleText')
    readColor('cuOtherBg', 'otherBubbleBg')
    readColor('cuOtherText', 'otherBubbleText')
    readColor('cuChatBg', 'chatBg')
    readColor('cuTimeColor', 'timeColor')
    readColor('cuCardBg', 'cardBg')
    readColor('cuTitleColor', 'titleColor')
    readColor('cuTextColor', 'textColor')
    readColor('cuUrlColor', 'urlColor')
    readColor('cuNameColor', 'nameColor')
    readColor('cuPriceColor', 'priceColor')
    var shapeBtns = modal.querySelectorAll('.cu-shape-btn.active')
    shapeBtns.forEach(function(b) {
      if (b.dataset.cuShape) s.avatarShape = b.dataset.cuShape
    })
    // Sliders
    function readSlider(id, key) {
      var el = modal.querySelector('#' + id); if (el) s[key] = parseFloat(el.value) || s[key]
    }
    readSlider('cuMsgAvSize', 'avatarSize')
    readSlider('cuSelfRadius', 'selfBubbleRadius')
    readSlider('cuOtherRadius', 'otherBubbleRadius')
    readSlider('cuBubbleFs', 'bubbleFontSize')
    readSlider('cuCardRadius', 'cardRadius')
    readSlider('cuTitleSize', 'titleSize')
    readSlider('cuFontSize', 'fontSize')
    readSlider('cuLineHeight', 'lineHeight')
    readSlider('cuImgRadius', 'imageRadius')
    readSlider('cuGap', 'gap')
    readSlider('cuEntryRadius', 'entryRadius')
    readSlider('cuNameSize', 'nameSize')
    // Style buttons
    var memoStyleBtn = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
    if (memoStyleBtn) s.cardStyle = memoStyleBtn.dataset.cuMemoStyle
    var galleryColBtn = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
    if (galleryColBtn) s.columns = parseInt(galleryColBtn.dataset.cuGalleryCols) || 3
    // Read icon URL
    var iconUrlEl = modal.querySelector('#cuIconUrl'); if (iconUrlEl && iconUrlEl.value.trim()) ct.customIcons[type] = iconUrlEl.value.trim()
    ct.appSettings[type] = s
    savePhoneCustom(ct)
    renderCustomPage()
    showReaderToast((labels[type] || 'App') + '美化已保存')
  })

  // Bind slider displays
  bindCuSliders(ov)
  // Icon upload / clear handlers (need ov to be created)
  var iconUploadBtn = ov.querySelector('#cuIconUpload')
  if (iconUploadBtn) iconUploadBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = function() {
      var file = inp.files[0]; if (!file) return
      var r = new FileReader()
      r.onload = function() { ct.customIcons[type] = r.result; ov.querySelector('#cuIconUrl').value = r.result }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  var iconClearBtn = ov.querySelector('#cuIconClear')
  if (iconClearBtn) iconClearBtn.onclick = function() {
    ct.customIcons[type] = ''
    var urlEl = ov.querySelector('#cuIconUrl'); if (urlEl) urlEl.value = ''
    var preview = ov.querySelector('.rd-preview-img'); if (preview) preview.remove()
  }
  // Read icon URL on save (via onSave callback above already reads from ct.customIcons)
  // Real-time preview updates
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    sl.addEventListener('input', function() { updateCuPreview(ov, type) })
  })
  ov.querySelectorAll('.cu-color-btn').forEach(function(b) {
    b.addEventListener('click', function() { setTimeout(function() { updateCuPreview(ov, type) }, 50) })
  })
  ov.querySelectorAll('.cu-color-picker').forEach(function(p) {
    p.addEventListener('input', function() { updateCuPreview(ov, type) })
  })
  ov.querySelectorAll('.cu-shape-btn').forEach(function(b) {
    b.addEventListener('click', function() { setTimeout(function() { updateCuPreview(ov, type) }, 50) })
  })
  ov.querySelectorAll('.cu-style-btn').forEach(function(b) {
    b.addEventListener('click', function() { setTimeout(function() { updateCuPreview(ov, type) }, 50) })
  })
  // Bind color buttons
  ov.querySelectorAll('.cu-color-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-color-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
    }
  })
  // Bind shape buttons
  ov.querySelectorAll('.cu-shape-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-shape-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
    }
  })
  // Bind style buttons
  ov.querySelectorAll('.cu-style-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-style-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
    }
  })
  // Reset
  var resetBtn = ov.querySelector('#cuAppReset')
  if (resetBtn) resetBtn.onclick = function() {
    delete ct.appSettings[type]
    savePhoneCustom(ct)
    ov.remove()
    renderCustomPage()
    showReaderToast((labels[type] || 'App') + '已恢复默认')
  }
}

function bindCuSliders(ov) {
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    var valEl = ov.querySelector('#' + sl.id + 'Val')
    sl.oninput = function() {
      if (valEl) valEl.textContent = this.value + (valEl.textContent.replace(/[\d.]+/, '') || '')
    }
  })
}

function renderCustomPage() {
  var ct = getPhoneCustom()
  applyCustomFonts()
  var panel = document.getElementById('tabCustom')
  if (!panel) return
  var h = '<div class="rd-custom">'
  h += '<div style="display:flex;justify-content:center;padding:10px 0">'
  h += renderPhonePreview(ct)
  h += '</div>'
  h += '<div style="text-align:center;font-size:.72rem;color:var(--c-text2);padding:8px 0">点击手机图标即可设置对应模块的外观</div>'
  h += '</div>'
  panel.innerHTML = h
}

// ---- Global click handler for beautification app icons (document-level delegation) ----
document.addEventListener('click', function(e) {
  var el = e.target
  // Walk up the DOM tree to find .rd-app-icon inside #tabCustom
  while (el && el !== document.body) {
    if (el.classList && el.classList.contains('rd-app-icon')) {
      // Verify we're inside the custom panel
      if (!el.closest('#tabCustom')) return
      var type = el.getAttribute('data-app')
      if (!type) return
      e.preventDefault()
      e.stopPropagation()
      if (type === 'customize') { openReaderCustomizePanel(); return }
      if (type === 'profile') { openReaderProfilePanel(); return }
      openReaderAppSettings(type)
      return
    }
    el = el.parentElement
  }
})

// ---- Init ----
renderHome()
