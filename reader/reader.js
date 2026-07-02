// Tuuru Reader
// 支持导入 .json / .png 文件，阅读文章或体验手机模拟器

// ---- helpers ----
function esc(s) {
  if (!s) return ''
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
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
  h += '<div class="rd-tabs">'
  h += '<div class="rd-tab active" data-tab="personal">个人主页</div>'
  h += '<div class="rd-tab" data-tab="custom">美化</div>'
  h += '<div class="rd-tab" data-tab="import">导入</div>'
  h += '</div>'
  // Tab panels
  h += '<div class="rd-panel" id="tabPersonal">' + renderPersonalPage() + '</div>'
  h += '<div class="rd-panel" style="display:none" id="tabCustom">' + renderCustomPage() + '</div>'
  h += '<div class="rd-panel" style="display:none" id="tabImport">' + renderImportPanel() + '</div>'
  h += '<div style="text-align:center;padding:16px;margin-top:20px;font-size:.6rem;color:var(--c-text2);opacity:.3"><a href="https://tuuru.chat" target="_blank" style="color:inherit;text-decoration:none">tuuru.chat</a></div>'
  h += '</div>'
  render('app', h)

  // Tab switching
  var tabs = document.querySelectorAll('.rd-tab')
  tabs.forEach(function(t) {
    t.onclick = function() {
      tabs.forEach(function(x) { x.classList.remove('active') })
      t.classList.add('active')
      var tab = t.dataset.tab
      var p = document.getElementById('tabPersonal')
      var c = document.getElementById('tabCustom')
      var i = document.getElementById('tabImport')
      if (p) p.style.display = tab === 'personal' ? 'block' : 'none'
      if (c) c.style.display = tab === 'custom' ? 'block' : 'none'
      if (i) i.style.display = tab === 'import' ? 'block' : 'none'
      if (tab === 'personal') refreshPersonalPage()
      if (tab === 'custom') renderCustomPage()
    }
  })

  // Setup import
  setupImport()
}

// ====== Personal Page ======
function renderPersonalPage() {
  var profile = getProfile()
  var recents = getRecents()
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
    recents.forEach(function(r) {
      h += '<div class="rd-recent-item" onclick="reimportRecent(\'' + r.id + '\')">'
      h += '<div class="rd-recent-title">' + esc(r.title) + '</div>'
      h += '<div class="rd-recent-meta">' + (r.type === 'phone' ? '小手机' : '互动文章') + ' · ' + timeAgo(r.importedAt) + '</div>'
      h += '</div>'
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

window.reimportRecent = function(id) {
  // Load work from localStorage
  try {
    var db = JSON.parse(localStorage.getItem('moirain_work_' + id))
    if (!db) { alert('该作品已不在缓存中，请重新导入'); return }
    loadWork(db)
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
          loadWork(work)
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
  document.addEventListener('dragover', function(e) { e.preventDefault(); if (inner) inner.classList.add('drag-over') })
  document.addEventListener('dragleave', function(e) { e.preventDefault(); if (inner) inner.classList.remove('drag-over') })
  document.addEventListener('drop', function(e) {
    e.preventDefault()
    if (inner) inner.classList.remove('drag-over')
    var file = e.dataTransfer.files[0]
    handleFile(file)
  })

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
      loadWork(work)
    } catch(e) {
      alert('隐写数据解析失败：' + e.message)
    }
  }
  img.onerror = function() { alert('PNG 加载失败') }
  img.src = dataUrl
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
      h += '<input type="text" class="rd-landing-input" data-ph-id="' + ph.id + '" value="' + esc(ph.default || '') + '" placeholder="' + esc(ph.prompt || '') + '">'
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
    lsSet('placeholders', values)
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
function renderArticleReader() {
  if (!_work || _work.type === 'phone') return renderPhoneReader()
  var nodes = _work.nodes || []
  if (!_nodeId || !nodes.find(function(n) { return n.id === _nodeId })) {
    _nodeId = _work.startNode || (nodes.length ? nodes[0].id : null)
  }
  var node = nodes.find(function(n) { return n.id === _nodeId })
  if (!node) {
    render('app', '<div class="drop-zone"><p>作品内容为空</p><button class="drop-btn" onclick="renderHome()">返回首页</button></div>')
    return
  }

  // Substitute placeholders
  var content = node.content || ''
  var phs = _work.placeholders || []
  if (phs.length > 0 && _work.readerPhValues) {
    content = substituteText(content, phs, _work.readerPhValues)
  }

  // Progress dots
  var visitedSet = {}
  _visitedNodes.forEach(function(id) { visitedSet[id] = true })
  visitedSet[_nodeId] = true
  var h = '<button class="reader-back" onclick="renderHome()" title="返回">←</button>'
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
    return '<div class="rd-pm-trigger" data-pm-id="' + pt.pmid + '" data-pm-type="' + pt.type + '" style="cursor:pointer">' +
      '<span class="rd-pm-dot' + (hasUnread ? ' has-unread' : '') + '"></span>' +
      '<span class="rd-pm-trigger-icon">' + (def.icon || '?') + '</span>' +
      '<span class="rd-pm-trigger-label">查看' + (def.label || '模块') + '</span></div>'
  })

  h += '<h1 class="article-title">' + esc(node.title || '') + '</h1>'
  h += '<div class="article-meta">' + esc(_work.author || '') + '</div>'
  h += '<div class="article-content">' + cleanContent + '</div>'

  // Choices
  var choices = node.choices || []
  if (choices.length > 0) {
    h += '<div class="article-choices">'
    choices.forEach(function(c, ci) {
      h += '<button class="article-choice-btn" data-target="' + esc(c.targetId || '') + '"><span class="label">' + (ci + 1) + '.</span>' + esc(c.text || '选项') + '</button>'
    })
    h += '</div>'
  } else {
    h += '<div style="text-align:center;padding:24px"><button class="drop-btn" onclick="renderHome()">返回首页</button></div>'
  }

  render('app', h)

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

  // Bind phone module triggers
  var triggers = document.querySelectorAll('.rd-pm-trigger')
  triggers.forEach(function(trig) {
    trig.onclick = function() {
      var pmid = trig.dataset.pmId
      var type = trig.dataset.pmType
      // Mark as visited
      visitedPm[pmid] = true
      try { sessionStorage.setItem('rd_pm_visited_' + _work.id, JSON.stringify(visitedPm)) } catch(e) {}
      // Hide red dot
      var dot = trig.querySelector('.rd-pm-dot')
      if (dot) dot.classList.remove('has-unread')

      // Show the phone app content in a modal overlay
      openReaderPhoneModal(pmid, type)
    }
  })
}

function substituteText(text, phs, valuesMap) {
  if (!text || !phs || !phs.length) return text
  var r = text
  for (var i = 0; i < phs.length; i++) {
    var ph = phs[i]
    var vals = (valuesMap && valuesMap[ph.id]) ? valuesMap[ph.id] : (ph.values || [])
    var pats = ph.key ? [ph.key] : [ph.label]
    var v = vals.length ? vals[Math.floor(Math.random() * vals.length)] : (ph.default || '')
    pats.forEach(function(p) { r = r.replaceAll(p, v) })
  }
  return r
}

// ====== PHONE READER ======
function renderPhoneReader() {
  if (!_work || !_work.phoneData) {
    render('app', '<div class="drop-zone"><p>手机数据为空</p><button class="drop-btn" onclick="renderHome()">返回</button></div>')
    return
  }
  var pd = _work.phoneData
  var skin = pd.skin || {}
  // Merge reader's custom settings on top of author's skin
  var rc = getPhoneCustom()
  if (rc.wallpaper) {
    skin.wallpaper = rc.wallpaper
  }
  if (rc.wallpaperType === 'image' && rc.wallpaperImage) {
    skin.wallpaperImage = rc.wallpaperImage
    skin.wallpaperType = rc.wallpaperType
  }
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

  var h = '<button class="reader-back" onclick="renderHome()" title="返回">←</button>'
  h += '<div class="phone-reader">'
  var readerBgStyle = '--phone-bg:' + ((skin.wallpaper && skin.wallpaper !== '#d0e8f5') ? skin.wallpaper : '') + ';'
  readerBgStyle += '--phone-radius:' + (skin.borderRadius || 28) + 'px;'
  readerBgStyle += '--phone-font:\'' + (skin.fontFamily || 'Noto Sans SC').replace(/'/g, '') + '\', sans-serif;'
  readerBgStyle += '--phone-fontsize:' + (skin.fontSize || 12) + 'px;'
  readerBgStyle += '--phone-frame:' + (skin.frameColor || '#ccc')
  if (skin.wallpaperType === 'image' && skin.wallpaperImage) {
    readerBgStyle += ';background-image:url(' + esc(skin.wallpaperImage) + ');background-size:cover;background-position:center'
  }
  h += '<div class="phone-frame"'
  h += ' style="' + readerBgStyle + '">'

  // Dynamic Island
  if (skin.showDynamicIsland !== false) {
    h += '<div style="display:flex;justify-content:center;padding:10px 0 4px"><div style="width:100px;height:24px;background:#000;border-radius:14px"></div></div>'
  }

  // Profile section
  var coverBg = skin.topBgImage || skin.wallpaperImage || ''
  h += '<div style="position:relative;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:#fff;margin:12px 12px 0;border-radius:16px;'
  if (coverBg) h += 'background-image:url(' + esc(coverBg) + ');background-size:cover;background-position:center;'
  h += '">'
  h += '<div style="position:absolute;inset:0;background:rgba(0,0,0,.05)"></div>'
  h += '<div style="width:60px;height:60px;border-radius:50%;border:2px solid rgba(0,0,0,.15);overflow:hidden;background:rgba(0,0,0,.04);display:flex;align-items:center;justify-content:center;z-index:1;position:relative">'
  if (skin.readerAvatar) h += '<img src="' + esc(skin.readerAvatar) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
  h += '</div>'
  h += '<div style="font-size:12px;color:#555;z-index:1;margin-top:6px;font-weight:500">' + esc(skin.readerId || '读者') + '</div>'
  h += '</div>'

  // Desktop area
  h += '<div id="phoneDesktopReader" style="flex:1;position:relative;min-height:420px;padding:10px 20px">'

  var CELL_W = 80, CELL_H = 95, OFFSET_X = 20, OFFSET_Y = 36
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    if (app.enabled === false) continue
    if (app.type === 'settings' || app.type === 'customize') continue
    var x = OFFSET_X + (app.desktopX || 0) * CELL_W
    var y = OFFSET_Y + (app.desktopY || 0) * CELL_H
    h += '<div class="phone-app-icon" data-app-type="' + app.type + '"'
    h += ' style="left:' + x + 'px;top:' + y + 'px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:absolute;width:72px;outline:none;border:none!important;box-shadow:none!important">'
    h += '<div class="phone-icon-body icon-shadow" style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:14px;margin:0 auto;background:' + (app.color || '#f0f0f0') + ';">'
    h += '<span class="phone-icon-char" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#333;line-height:1">' + (app.icon || '?') + '</span>'
    h += '</div>'
    if (skin.showAppLabels !== false) {
      h += '<span style="font-size:10px;color:#555;text-align:center;width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3">' + esc(app.name || 'App') + '</span>'
    }
    h += '</div>'
  }
  h += '</div>'

  if (skin.showHomeIndicator !== false) {
    h += '<div style="display:flex;justify-content:center;padding:8px 0 14px"><div style="width:40%;height:4px;background:rgba(255,255,255,.3);border-radius:3px"></div></div>'
  }

  h += '</div></div>'
  render('app', h)

  var icons = document.querySelectorAll('.phone-app-icon')
  icons.forEach(function(icon) {
    icon.onclick = function() {
      var type = icon.dataset.appType
      openReaderApp(type)
    }
  })
}

// ---- Reader App Panels ----
function openReaderApp(type) {
  var frame = document.getElementById('phoneDesktopReader')
  if (!frame) return
  var pd = _work.phoneData
  var contacts = pd.contacts || []
  var w = _work

  function backToDesktop() { renderPhoneReader() }

  function wrapPanel(title, bodyHtml) {
    var h = '<div style="display:flex;flex-direction:column;height:100%;background:var(--c-bg);position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;color:#333">'
    h += '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #ddd;background:#fff;flex-shrink:0">'
    h += '<button class="rd-back-btn" style="border:none;background:transparent;font-size:1rem;cursor:pointer;color:#888;padding:4px 8px">←</button>'
    h += '<span style="font-size:.85rem;font-weight:600;flex:1;text-align:center;color:#555">' + esc(title) + '</span>'
    h += '<span style="width:36px"></span>'
    h += '</div>'
    h += '<div style="flex:1;overflow-y:auto;padding:8px 10px">' + bodyHtml + '</div>'
    h += '</div>'
    frame.innerHTML = h
    var backBtn = frame.querySelector('.rd-back-btn')
    if (backBtn) backBtn.onclick = backToDesktop
  }

  if (type === 'messages') {
    var chats = pd.chats || []
    var h = ''
    if (chats.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无对话</div>'
    chats.forEach(function(ch) {
      var name = ''
      if (ch.type === 'group') name = ch.groupName || '群聊'
      else {
        var cc = contacts.find(function(x) { return x.id === ch.contactIds[0] })
        name = cc ? cc.name : '未知'
      }
      h += '<div class="rd-chat-card" data-chat-idx="' + chats.indexOf(ch) + '" style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;cursor:pointer;align-items:center">'
      h += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;flex-shrink:0;background:' + (ch.type === 'group' ? '#10b981' : '#6366f1') + '">' + esc(name.charAt(0)) + '</div>'
      h += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(name) + '</div></div>'
      h += '</div>'
    })
    wrapPanel('消息', h)
    var cards = frame.querySelectorAll('.rd-chat-card')
    cards.forEach(function(card) {
      card.onclick = function() {
        var idx = parseInt(card.dataset.chatIdx)
        openReaderChat(frame, w, pd, chats[idx])
      }
    })
  } else if (type === 'forum') {
    var posts = pd.forumPosts || []
    var h = ''
    if (posts.length === 0) h += '<div style="text-align:center;padding:20px;color:#999">暂无帖子</div>'
    posts.forEach(function(p) {
      h += '<div class="rd-post-card" data-post-id="' + p.id + '" style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;cursor:pointer">'
      h += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;flex-shrink:0;background:' + avatarColor(p.contactId) + '">' + esc((p.contactName || '?').charAt(0)) + '</div>'
      h += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(p.title) + '</div><div style="font-size:.68rem;color:#999">' + esc(p.contactName || '') + ' / ' + esc(p.time || '') + '</div></div>'
      h += '</div>'
    })
    wrapPanel('论坛', h)
    var postCards = frame.querySelectorAll('.rd-post-card')
    postCards.forEach(function(card) {
      card.onclick = function() {
        openReaderForumPost(frame, w, pd, card.dataset.postId)
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
    var photos = (pd.photos || []).filter(function(p) { return contacts.length > 0 ? p.contactId === contacts[0].id : true })
    var albums = (pd.albums || []).filter(function(a) { return contacts.length > 0 ? a.contactId === contacts[0].id : true })
    var h = ''
    if (albums.length > 0) {
      h += '<div style="display:flex;gap:10px;overflow-x:auto;padding:4px 0 10px">'
      albums.forEach(function(a) {
        var count = photos.filter(function(p) { return p.albumId === a.id }).length
        h += '<div style="flex-shrink:0;width:80px;text-align:center;cursor:pointer" class="rd-album" data-album-id="' + a.id + '">'
        h += '<div style="width:80px;height:80px;border:1px solid #ddd;background:#f0f0f0;margin-bottom:4px"></div>'
        h += '<div style="font-size:.7rem">' + esc(a.name) + ' (' + count + ')</div>'
        h += '</div>'
      })
      h += '</div>'
    }
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
    var ungrouped = photos.filter(function(p) { return !p.albumId })
    if (ungrouped.length === 0 && photos.length === 0) h += '<div style="grid-column:1/-1;text-align:center;color:#999;padding:20px">暂无照片</div>'
    ungrouped.forEach(function(p) {
      if (p.imageUrl) {
        h += '<div style="aspect-ratio:1;overflow:hidden;border:1px solid #eee"><img src="' + esc(p.imageUrl) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'"></div>'
      } else {
        h += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#f8f8f8;border:1px solid #eee;font-size:.7rem;color:#999;padding:4px;text-align:center">' + esc(p.caption || '') + '</div>'
      }
    })
    h += '</div>'
    wrapPanel('相册', h)
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
    var h = '<div style="display:flex;border-bottom:1px solid #ddd;margin-bottom:8px"><div class="rd-shop-tab active" data-tab="cart" style="flex:1;text-align:center;padding:8px;font-size:.75rem;cursor:pointer;border-bottom:2px solid transparent">购物车</div><div class="rd-shop-tab" data-tab="order" style="flex:1;text-align:center;padding:8px;font-size:.75rem;cursor:pointer;border-bottom:2px solid transparent">订单</div></div>'
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
    h += '<div id="rdShopCart">' + shopList(cartItems) + '</div>'
    h += '<div id="rdShopOrder" style="display:none">' + shopList(orderItems) + '</div>'
    wrapPanel('购物清单', h)

    var tabs = frame.querySelectorAll('.rd-shop-tab')
    tabs.forEach(function(t) {
      t.onclick = function() {
        tabs.forEach(function(x) { x.classList.remove('active'); x.style.borderBottomColor = 'transparent' })
        t.classList.add('active')
        t.style.borderBottomColor = 'var(--c-primary-hover)'
        document.getElementById('rdShopCart').style.display = t.dataset.tab === 'cart' ? 'block' : 'none'
        document.getElementById('rdShopOrder').style.display = t.dataset.tab === 'order' ? 'block' : 'none'
      }
    })
    if (tabs[0]) tabs[0].style.borderBottomColor = 'var(--c-primary-hover)'
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
function openReaderChat(frame, w, pd, ch) {
  var contacts = pd.contacts || []

  function backToList() { openReaderApp('messages') }

  function getChatName() {
    if (ch.type === 'group') return ch.groupName || '群聊'
    var c = contacts.find(function(x) { return x.id === ch.contactIds[0] })
    return c ? c.name : '未知'
  }

  function renderChat() {
    var chatName = getChatName()
    var bg = ch.bgImage || ''
    var h = '<div style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;color:#333;' + (bg ? 'background-image:url(' + esc(bg) + ');background-size:cover;background-position:center' : 'background:#f0f0f0') + '">'
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-bottom:1px solid #ddd;flex-shrink:0">'
    h += '<button class="rd-back-btn" style="border:none;background:transparent;font-size:1rem;cursor:pointer;color:#888;padding:4px 8px">←</button>'
    h += '<span style="flex:1;text-align:center;font-size:.8rem;font-weight:500;color:#555">' + esc(chatName) + '</span>'
    h += '<span style="width:36px"></span>'
    h += '</div>'
    h += '<div style="flex:1;overflow-y:auto;padding:6px 10px" id="rdChatMsgs">'
    var rounds = ch.rounds || []
    if (rounds.length === 0 && ch.messages && ch.messages.length) {
      rounds = [{ id: 'd', label: '', messages: ch.messages }]
    }
    rounds.forEach(function(round) {
      (round.messages || []).forEach(function(msg) {
        if (msg.type === 'time') {
          h += '<div style="text-align:center;padding:6px 0;font-size:.62rem;color:#b0b8c4">' + esc(msg.time || '') + '</div>'
          return
        }
        var isSelf = msg.senderId === 'self'
        h += '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-start;' + (isSelf ? 'flex-direction:row-reverse' : '') + '">'
        if (!isSelf) {
          var sc = contacts.find(function(c) { return c.id === msg.senderId })
          var avBg = sc ? (sc.avatarUrl ? 'background-image:url(' + esc(sc.avatarUrl) + ');background-size:cover' : 'background:' + avatarColor(msg.senderId)) : 'background:#ccc'
          h += '<div style="width:36px;height:36px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;' + avBg + '">'
          if (!sc || !sc.avatarUrl) h += '<span>' + esc((sc ? sc.name : '?').charAt(0)) + '</span>'
          h += '</div>'
        }
        var bubbleStyle = isSelf ? 'background:#555;color:#fff;border-radius:8px 8px 2px 8px' : 'background:#fff;color:#333;border-radius:8px 8px 8px 2px'
        h += '<div style="max-width:180px;padding:8px 12px;font-size:.82rem;line-height:1.5;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow-wrap:break-word;' + bubbleStyle + '">'
        if (msg.type === 'image') {
          h += '<img src="' + esc(msg.image || '') + '" style="max-width:120px;border-radius:4px" onerror="this.style.display=\'none\'">'
        } else if (msg.type === 'redpacket') {
          h += '<div style="background:#C46060;padding:8px;border-radius:4px;color:#fff;text-align:center"><div style="font-size:.85rem;font-weight:700">' + (msg.redpacketAmount || 0).toFixed(2) + '</div><div style="font-size:.6rem;opacity:.8">' + esc(msg.redpacketMsg || '恭喜发财') + '</div></div>'
        } else if (msg.type === 'transfer') {
          h += '<div style="background:#D4915A;padding:10px;border-radius:4px;color:#fff"><div style="font-size:.6rem;opacity:.8">转账</div><div style="font-size:.85rem;font-weight:700">¥' + (msg.transferAmount || 0).toFixed(2) + '</div></div>'
        } else if (msg.type === 'familycard') {
          h += '<div style="background:#8B7AAA;padding:10px;border-radius:4px;color:#fff;text-align:center"><div style="font-size:.6rem;opacity:.8">亲属卡</div><div style="font-size:.75rem">' + esc(msg.fcRelation || '亲人') + '</div><div style="font-size:.85rem;font-weight:700">¥' + (msg.fcAmount || 0).toFixed(2) + '</div></div>'
        } else if (msg.type === 'voice') {
          var dur = msg.duration || Math.max(1, Math.round((msg.text || '').length * 0.3))
          var barCount = Math.min(20, Math.max(4, Math.round(dur * 3)))
          var bars = ''
          for (var bi = 0; bi < barCount; bi++) {
            var bh = 4 + Math.abs(Math.sin(bi * 0.7 + 1.5)) * 14
            bars += '<rect x="' + (bi * 5) + '" y="' + (20 - bh) / 2 + '" width="3" height="' + bh + '" rx="1.5"/>'
          }
          var voiceClick = "var t=this.querySelector('.chat-voice-text');t.style.display=t.style.display=='none'?'block':'none';var w=this.querySelector('.chat-voice-wave');w.style.display=t.style.display=='block'?'none':''"
          bubbleStyle = isSelf ? 'background:#555;color:#fff;border-radius:8px 8px 2px 8px' : 'background:#fff;color:#333;border-radius:8px 8px 8px 2px'
          h += '<div style="max-width:180px;padding:8px 12px;font-size:.82rem;line-height:1.5;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow-wrap:break-word;cursor:pointer;min-width:100px;' + bubbleStyle + '" onclick="' + esc(voiceClick) + '">'
          h += '<svg class="chat-voice-wave" width="' + (barCount * 5 + 2) + '" height="20" viewBox="0 0 ' + (barCount * 5 + 2) + ' 20" style="fill:currentColor;opacity:.7;display:inline">' + bars + '</svg>'
          h += '<span style="font-size:.65rem;margin-left:4px;opacity:.6">' + dur + '"</span>'
          h += '<span class="chat-voice-text" style="display:none;font-size:.75rem;margin-top:4px;line-height:1.4">' + esc(msg.text || '') + '</span>'
          h += '</div>'
        } else {
          if (msg.quoteId && msg.quoteText) {
            h += '<div style="font-size:.6rem;opacity:.7;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,.1)">引用：' + esc(msg.quoteText.substring(0, 40)) + '</div>'
          }
          h += esc(msg.text || '')
        }
        h += '</div>'
        if (msg.choices && msg.choices.length > 0) {
          h += '<div style="width:100%;display:flex;flex-direction:column;gap:3px;margin-top:4px">'
          msg.choices.forEach(function(c, cidx) {
            h += '<button class="rd-choice-btn" data-ri="' + rounds.indexOf(round) + '" data-mi="' + round.messages.indexOf(msg) + '" data-ci="' + cidx + '" style="padding:5px 12px;font-size:.7rem;border:1px solid var(--c-primary);background:rgba(164,198,235,.12);color:var(--c-primary-hover);cursor:pointer;border-radius:4px;text-align:center;' + (c.used ? 'opacity:.5;cursor:default' : '') + '">' + esc(c.text || '选项') + '</button>'
          })
          h += '</div>'
        }
        h += '</div>'
      })
    })
    h += '</div>'
    h += '</div>'
    frame.innerHTML = h

    var backBtn = frame.querySelector('.rd-back-btn')
    if (backBtn) backBtn.onclick = backToList

    var choiceBtns = frame.querySelectorAll('.rd-choice-btn')
    choiceBtns.forEach(function(btn) {
      btn.onclick = function() {
        if (btn.style.opacity === '0.5') return
        var ri = parseInt(btn.dataset.ri)
        var mi = parseInt(btn.dataset.mi)
        var ci = parseInt(btn.dataset.ci)
        var rounds = ch.rounds || []
        if (!rounds[ri]) return
        var round = rounds[ri]
        var msg = round.messages[mi]
        if (!msg || !msg.choices) return
        var choice = msg.choices[ci]
        if (!choice || choice.used) return
        choice.used = true
        if (choice.replyText) {
          round.messages.push({ id: 'r' + Date.now(), senderId: 'self', text: choice.replyText, type: 'text', time: new Date().toLocaleString() })
        }
        if (choice.followUpMessages) {
          choice.followUpMessages.forEach(function(fm) {
            round.messages.push(Object.assign({}, fm, { id: 'r' + Date.now() + Math.random() }))
          })
        }
        renderChat()
      }
    })
  }

  renderChat()
}

// ---- Forum post viewer ----
function openReaderForumPost(frame, w, pd, postId) {
  var posts = pd.forumPosts || []
  var post = posts.find(function(p) { return p.id === postId })
  if (!post) return

  function backToList() { openReaderApp('forum') }

  var h = '<div style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;color:#333;background:#fff">'
  h += '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #ddd;flex-shrink:0">'
  h += '<button class="rd-back-btn" style="border:none;background:transparent;font-size:1rem;cursor:pointer;color:#888;padding:4px 8px">←</button>'
  h += '<span style="font-size:.85rem;font-weight:600;flex:1;text-align:center;color:#555">帖子详情</span>'
  h += '<span style="width:36px"></span>'
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
  if (backBtn) backBtn.onclick = backToList
}

// ====== Reader Phone Module Modal ======
function openReaderPhoneModal(pmid, type) {
  var pm = null
  var pms = _work.phoneModules || []
  for (var i = 0; i < pms.length; i++) {
    if (pms[i].id === pmid) { pm = pms[i]; break }
  }
  if (!pm) return

  var data = pm.data || {}
  var contacts = data.contacts || []

  // Build the modal
  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay rd-pm-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'

  var inner = document.createElement('div')
  inner.className = 'rd-pm-modal'
  inner.style.cssText = 'background:#fff;max-width:380px;width:100%;max-height:85vh;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.3);position:relative'

  var topBar = document.createElement('div')
  topBar.style.cssText = 'display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #eee;flex-shrink:0'
  var labels = {messages:'消息',forum:'论坛',memo:'备忘录',gallery:'相册',browser:'浏览记录',shopping:'购物',contacts:'联系人'}
  var iconSvgs = {
    messages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    forum:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>',
    memo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    gallery:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    browser:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    shopping:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    contacts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>'
  }
  topBar.innerHTML = '<span style="color:#666;flex-shrink:0">' + (iconSvgs[type] || '') + '</span><span style="font-size:.85rem;font-weight:600;flex:1;text-align:center;color:#555">' + esc(labels[type] || '模块') + '</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.2rem;color:#999;padding:4px 8px">&times;</button>'

  var content = document.createElement('div')
  content.style.cssText = 'flex:1;overflow-y:auto;padding:10px 12px;font-size:13px;color:#333;background:#f8f8f8'

  // Render content based on type
  var bodyHtml = ''
  if (type === 'messages') {
    var chats = data.chats || []
    if (chats.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无对话</div>'
    else {
      chats.forEach(function(ch) {
        var name = ch.type === 'group' ? (ch.groupName || '群聊') : ((contacts.find(function(c){return c.id===ch.contactIds[0]}) || {}).name || '未知')
        bodyHtml += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;align-items:center;cursor:pointer" onclick="this.querySelector(\'.rd-pm-chat-detail\').style.display=this.querySelector(\'.rd-pm-chat-detail\').style.display==\'none\'?\'block\':\'none\'">'
        bodyHtml += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;background:' + (ch.type==='group'?'#10b981':'#6366f1') + '">' + esc(name.charAt(0)) + '</div>'
        bodyHtml += '<div style="flex:1"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(name) + '</div>'
        bodyHtml += '<div style="font-size:.68rem;color:#999">' + (ch.messages ? ch.messages.length + '条消息' : '0条消息') + '</div></div></div>'
        // Chat messages detail
        bodyHtml += '<div class="rd-pm-chat-detail" style="display:none;padding:6px 10px;background:#f0f0f0;margin-bottom:4px">'
        var msgs = ch.messages || []
        var rounds = ch.rounds || []
        if (rounds.length > 0) {
          rounds.forEach(function(r) { (r.messages||[]).forEach(function(m) {
            if (m.type === 'time') return
            bodyHtml += '<div style="margin:4px 0;padding:5px 8px;font-size:.72rem;background:' + (m.senderId==='self'?'#555;color:#fff':'#fff;color:#333') + ';border-radius:6px;max-width:80%">' + esc(m.text || '') + '</div>'
          })})
        } else {
          msgs.forEach(function(m) {
            bodyHtml += '<div style="margin:4px 0;padding:5px 8px;font-size:.72rem;background:' + (m.senderId==='self'?'#555;color:#fff':'#fff;color:#333') + ';border-radius:6px;max-width:80%">' + esc(m.text || '') + '</div>'
          })
        }
        bodyHtml += '</div>'
      })
    }
  } else if (type === 'forum') {
    var posts = data.forumPosts || []
    if (posts.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无帖子</div>'
    else {
      posts.forEach(function(p) {
        bodyHtml += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;cursor:pointer" onclick="var d=this.nextElementSibling;d.style.display=d.style.display==\'none\'?\'block\':\'none\'">'
        bodyHtml += '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:600;background:' + avatarColor(p.contactId) + '">' + esc((p.contactName||'?').charAt(0)) + '</div>'
        bodyHtml += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;font-weight:500;color:#555">' + esc(p.title) + '</div><div style="font-size:.68rem;color:#999">' + esc(p.contactName||'') + ' / ' + esc(p.time||'') + '</div></div>'
        bodyHtml += '</div>'
        bodyHtml += '<div style="display:none;padding:8px 10px;font-size:.75rem;color:#555;line-height:1.6;background:#f0f0f0;margin-bottom:4px">' + esc(p.content||'') + '</div>'
      })
    }
  } else if (type === 'memo') {
    var memos = data.memos || []
    if (memos.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无备忘</div>'
    else {
      memos.forEach(function(m) {
        bodyHtml += '<div style="padding:10px 12px;margin-bottom:6px;background:#fff;border:1px solid #eee;font-size:.78rem;line-height:1.6;border-radius:4px">' + esc(m.content || '') + '</div>'
      })
    }
  } else if (type === 'gallery') {
    var photos = data.photos || []
    if (photos.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无照片</div>'
    else {
      bodyHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
      photos.forEach(function(p) {
        bodyHtml += '<div style="aspect-ratio:1;overflow:hidden;border:1px solid #eee;border-radius:4px;background:#f0f0f0;display:flex;align-items:center;justify-content:center">'
        if (p.imageUrl) bodyHtml += '<img src="' + esc(p.imageUrl) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">'
        else bodyHtml += '<span style="font-size:.65rem;color:#999;padding:4px;text-align:center">' + esc(p.caption||'') + '</span>'
        bodyHtml += '</div>'
      })
      bodyHtml += '</div>'
    }
  } else if (type === 'browser') {
    var history = data.browserHistory || []
    if (history.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无记录</div>'
    else {
      history.forEach(function(h) {
        bodyHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eee">'
        bodyHtml += '<div style="width:8px;height:8px;border-radius:50%;background:#6366f1;flex-shrink:0"></div>'
        bodyHtml += '<div style="flex:1"><div style="font-size:.78rem;font-weight:500;color:#555">' + esc(h.title||'') + '</div><div style="font-size:.68rem;color:#999">' + esc(h.url||'') + '</div></div>'
        bodyHtml += '<span style="font-size:.65rem;color:#999">' + esc((h.time||'').replace(/\s.*$/,'')) + '</span>'
        bodyHtml += '</div>'
      })
    }
  } else if (type === 'shopping') {
    var items = data.shoppingItems || []
    if (items.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无商品</div>'
    else {
      items.forEach(function(s) {
        bodyHtml += '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #eee">'
        bodyHtml += '<div style="width:50px;height:50px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #eee;border-radius:4px">'
        if (s.imageUrl) bodyHtml += '<img src="' + esc(s.imageUrl) + '" style="width:100%;height:100%;object-fit:cover">'
        bodyHtml += '</div>'
        bodyHtml += '<div style="flex:1"><div style="font-size:.78rem;font-weight:500">' + esc(s.name) + '</div><div style="font-size:.75rem;color:#a3bded">¥' + (s.price||0).toFixed(2) + '</div></div>'
        bodyHtml += '</div>'
      })
    }
  } else if (type === 'contacts') {
    var ct = data.contacts || []
    if (ct.length === 0) bodyHtml = '<div style="text-align:center;padding:30px;color:#999">暂无联系人</div>'
    else {
      ct.forEach(function(c) {
        bodyHtml += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eee">'
        bodyHtml += '<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;background:' + avatarColor(c.id) + '">' + esc(c.name.charAt(0)) + '</div>'
        bodyHtml += '<div style="font-size:.82rem;font-weight:500;color:#555">' + esc(c.name) + '</div>'
        bodyHtml += '</div>'
      })
    }
  }

  content.innerHTML = bodyHtml
  inner.appendChild(topBar)
  inner.appendChild(content)
  overlay.appendChild(inner)
  document.body.appendChild(overlay)

  // Close
  var closeBtn = topBar.querySelector('button')
  closeBtn.onclick = function() { overlay.remove() }
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove() })
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
    appBgs: {}
  }
}

function savePhoneCustom(data) {
  var cur = getPhoneCustom()
  for (var k in data) { if (data.hasOwnProperty(k)) cur[k] = data[k] }
  lsSet('phoneCustom', cur)
}

// ====== Phone Preview ======
function renderPhonePreview(ct) {
  var CELL_W = 80, CELL_H = 95, OFFSET_X = 20, OFFSET_Y = 36
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

  h += '<div class="phone-desktop" style="position:relative;min-height:260px">'
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
    var xx = OFFSET_X + (i % 4) * CELL_W
    var yy = OFFSET_Y + Math.floor(i / 4) * CELL_H
    h += '<div class="phone-app-icon rd-app-icon" data-app="' + app.type + '"'
    h += ' style="left:' + xx + 'px;top:' + yy + 'px;border:none!important;outline:none!important;box-shadow:none!important">'
    h += '<div class="phone-icon-body icon-shadow" style="background:' + (app.color || '#f0f0f0') + ';">'
    h += '<span class="phone-icon-char" style="font-size:22px;color:#333;width:36px;height:36px;display:flex;align-items:center;justify-content:center">' + app.icon + '</span>'
    h += '</div>'
    if (ct.showAppLabels !== false) {
      h += '<span class="phone-icon-label">' + esc(app.name) + '</span>'
    }
    h += '</div>'
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
  var fonts = [
    { name:'默认', family:"'Noto Sans SC', sans-serif" },
    { name:'圆体', family:"'PingFang SC', sans-serif" },
    { name:'宋体', family:"'Noto Serif SC', serif" },
    { name:'楷体', family:"'KaiTi', serif" },
    { name:'仿宋', family:"'FangSong', serif" },
    { name:'英文衬线', family:"'Georgia', serif" }
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

  body += '<div class="cu-section"><div class="cu-section-title">字体</div><div class="rd-font-grid">'
  for (var ffi = 0; ffi < fonts.length; ffi++) {
    body += '<button class="btn btn-sm' + (ct.fontFamily === fonts[ffi].family ? ' btn-primary' : ' btn-outline') + '" data-cu-font="' + esc(fonts[ffi].family) + '">' + fonts[ffi].name + '</button>'
  }
  body += '</div></div>'

  body += '<div class="cu-section">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuIsland"' + (ct.showDynamicIsland !== false ? ' checked' : '') + '> 灵动岛</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuLabels"' + (ct.showAppLabels !== false ? ' checked' : '') + '> App名称</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuHome"' + (ct.showHomeIndicator !== false ? ' checked' : '') + '> Home指示条</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuShadow"' + (ct.showIconShadow !== false ? ' checked' : '') + '> 图标阴影</label>'
  body += '</div>'

  var ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'
  ov.innerHTML = '<div style="background:#fff;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ddd"><span style="font-size:1rem;font-weight:600;color:#333">美化</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="cuCloseX">×</button></div><div style="padding:14px 16px">' + body + '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #ddd"><button style="padding:6px 16px;font-size:.8rem;border:none;background:#A4C6EB;color:#fff;cursor:pointer;border-radius:4px" id="cuSave">保存</button><button style="padding:6px 16px;font-size:.8rem;border:1px solid #ddd;background:#fff;color:#666;cursor:pointer;border-radius:4px" id="cuCancel">取消</button></div></div>'
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
  fontBtns.forEach(function(b) { b.onclick = function() { ct.fontFamily = b.dataset.cuFont; ov.querySelectorAll('[data-cu-font]').forEach(function(x){x.classList.remove('btn-primary');x.classList.add('btn-outline')}); b.classList.remove('btn-outline');b.classList.add('btn-primary') } })
  var radiusEl = ov.querySelector('#cuRadius')
  if (radiusEl) radiusEl.oninput = function() { ct.borderRadius = parseInt(this.value); var lbl = ov.querySelector('#cuRadiusLabel'); if (lbl) lbl.textContent = ct.borderRadius }

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
  ov.innerHTML = '<div style="background:#fff;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ddd"><span style="font-size:1rem;font-weight:600;color:#333">个人信息</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="rpCloseX">×</button></div><div style="padding:14px 16px">' + body + '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #ddd"><button style="padding:6px 16px;font-size:.8rem;border:none;background:#A4C6EB;color:#fff;cursor:pointer;border-radius:4px" id="rpSave">保存</button><button style="padding:6px 16px;font-size:.8rem;border:1px solid #ddd;background:#fff;color:#666;cursor:pointer;border-radius:4px" id="rpCancel">取消</button></div></div>'
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

function openReaderAppBgEditor(type) {
  var ct = getPhoneCustom()
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物' }
  var title = (labels[type] || 'App') + ' - 背景'
  ct.appBgs = ct.appBgs || {}
  var cur = ct.appBgs[type] || ''

  var body = '<div class="cu-section"><div class="cu-section-title">背景颜色</div>'
  body += '<input type="color" id="abColor" value="' + esc(cur || '#ffffff') + '" style="width:40px;height:32px">'
  body += '</div>'
  body += '<div class="cu-section"><div class="cu-section-title">背景图片</div>'
  body += '<div class="rd-input-row"><input class="rd-input" id="abImgUrl" value="' + esc(cur.indexOf('data:')===0 ? '' : cur) + '" placeholder="输入图片URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid #A4C6EB;background:transparent;color:#A4C6EB;cursor:pointer" id="abUpload">上传</button></div>'
  if (cur && cur.indexOf('data:') === 0) body += '<div class="rd-preview-img"><img src="' + esc(cur) + '" style="max-width:120px;max-height:80px"><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="abClear">清除</button></div>'
  body += '</div>'

  var ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'
  ov.innerHTML = '<div style="background:#fff;max-width:380px;width:100%;max-height:85vh;overflow-y:auto;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ddd"><span style="font-size:1rem;font-weight:600;color:#333">' + esc(title) + '</span><button style="border:none;background:transparent;cursor:pointer;font-size:1.3rem;color:#888;padding:0 4px" id="abCloseX">×</button></div><div style="padding:14px 16px">' + body + '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #ddd"><button style="padding:6px 16px;font-size:.8rem;border:none;background:#A4C6EB;color:#fff;cursor:pointer;border-radius:4px" id="abSave">保存</button><button style="padding:6px 16px;font-size:.8rem;border:1px solid #ddd;background:#fff;color:#666;cursor:pointer;border-radius:4px" id="abCancel">取消</button></div></div>'
  document.body.appendChild(ov)
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove() })
  ov.querySelector('#abCloseX').onclick = function() { ov.remove() }
  ov.querySelector('#abCancel').onclick = function() { ov.remove() }

  ov.querySelector('#abSave').onclick = function() {
    var color = ov.querySelector('#abColor').value
    var url = ov.querySelector('#abImgUrl')?.value?.trim() || ''
    ct.appBgs[type] = url || color
    savePhoneCustom(ct)
    ov.remove()
    showReaderToast(title + '已保存')
  }
  var abUpload = ov.querySelector('#abUpload')
  if (abUpload) abUpload.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = function() { var file = inp.files[0]; if (!file) return; var r = new FileReader(); r.onload = function() { ct.appBgs[type] = r.result; ov.querySelector('#abColor').value = '#ffffff' }; r.readAsDataURL(file) }; inp.click()
  }
  var abClear = ov.querySelector('#abClear')
  if (abClear) abClear.onclick = function() { ct.appBgs[type] = ''; ov.querySelector('#abColor').value = '#ffffff'; delete ct.appBgs[type] }
}

function renderCustomPage() {
  var ct = getPhoneCustom()
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
      openReaderAppBgEditor(type)
      return
    }
    el = el.parentElement
  }
})

// ---- Init ----
renderHome()
