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
  h += '<div class="rd-tab" data-tab="import">导入</div>'
  h += '</div>'
  // Tab panels
  h += '<div class="rd-panel" id="tabPersonal">' + renderPersonalPage() + '</div>'
  h += '<div class="rd-panel" style="display:none" id="tabImport">' + renderImportPanel() + '</div>'
  h += '</div>'
  render('app', h)

  // Tab switching
  var tabs = document.querySelectorAll('.rd-tab')
  tabs.forEach(function(t) {
    t.onclick = function() {
      tabs.forEach(function(x) { x.classList.remove('active') })
      t.classList.add('active')
      var tab = t.dataset.tab
      document.getElementById('tabPersonal').style.display = tab === 'personal' ? 'block' : 'none'
      document.getElementById('tabImport').style.display = tab === 'import' ? 'block' : 'none'
      if (tab === 'personal') refreshPersonalPage()
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
  h += '<div class="rd-preset-field"><label>自定义</label><input type="text" id="ps_custom" value="' + esc(placeholders.custom || '') + '" placeholder="其他占位符" onchange="savePlaceholderPreset()"></div>'
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
    webname: document.getElementById('ps_webname')?.value || '',
    custom: document.getElementById('ps_custom')?.value || ''
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

// ====== Placeholder Form ======
function showPlaceholderForm(work, callback) {
  var phs = work.placeholders || []
  if (!phs.length) { callback(); return }

  var h = '<div class="rd-ph-form">'
  h += '<h3>填写占位符</h3>'
  h += '<p class="rd-ph-desc">以下信息将替换作品中对应的占位文字</p>'
  phs.forEach(function(ph) {
    h += '<div class="rd-ph-field">'
    h += '<label>' + esc(ph.label || ph.key) + '</label>'
    h += '<input type="text" class="rd-ph-input" data-ph-id="' + ph.id + '" value="' + esc(ph.default || '') + '" placeholder="' + esc(ph.prompt || '') + '">'
    h += '</div>'
  })
  h += '<div class="rd-ph-actions" style="display:flex;justify-content:space-between;align-items:center">'
  h += '<button class="rd-preset-save" onclick="injectPresets()" style="margin-top:0">📝 从预设填入</button>'
  h += '<button class="drop-btn" onclick="submitPlaceholders()">开始阅读</button>'
  h += '</div>'
  h += '</div>'

  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px'
  overlay.innerHTML = '<div class="modal" style="background:#fff;max-width:440px;width:100%;padding:24px;border-radius:8px;max-height:80vh;overflow-y:auto">' + h + '</div>'
  document.body.appendChild(overlay)

  window.injectPresets = function() {
    var presets = getPlaceholders()
    var keyMap = { '某某': presets.name || '', '小某': presets.nickname || '', 'wm': presets.webname || '' }
    var customVal = presets.custom || ''
    var inputs = overlay.querySelectorAll('.rd-ph-input')
    inputs.forEach(function(inp) {
      var label = (inp.parentElement.querySelector('label')?.textContent || '').replace(/[\s:：]/g, '')
      // Try to match by label/key hint in the placeholder text
      var phLabel = label
      if (keyMap[phLabel] !== undefined) {
        inp.value = keyMap[phLabel]
      } else if (phLabel.indexOf('某某') >= 0 || phLabel.indexOf('姓名') >= 0) {
        inp.value = presets.name || ''
      } else if (phLabel.indexOf('小某') >= 0 || phLabel.indexOf('昵称') >= 0) {
        inp.value = presets.nickname || ''
      } else if (phLabel.toLowerCase().indexOf('wm') >= 0 || phLabel.indexOf('网名') >= 0) {
        inp.value = presets.webname || ''
      } else if (customVal) {
        inp.value = customVal
      }
    })
  }

  window.submitPlaceholders = function() {
    var values = {}
    var inputs = overlay.querySelectorAll('.rd-ph-input')
    inputs.forEach(function(inp) {
      values[inp.dataset.phId] = [inp.value || '']
    })
    work.readerPhValues = values
    document.body.removeChild(overlay)
    lsSet('placeholders', values)
    callback()
  }
}

// ====== Load Work ======
function loadWork(work) {
  if (!work.type) { alert('无效的作品文件'); return }
  _work = work
  _nodeId = null
  _visitedNodes = []
  // Cache in localStorage
  try {
    localStorage.setItem('moirain_work_' + work.id, JSON.stringify(work))
  } catch(e) {}
  addRecent(work)
  // Show placeholder form, then render
  showPlaceholderForm(work, function() {
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

  h += '<h1 class="article-title">' + esc(node.title || '') + '</h1>'
  h += '<div class="article-meta">' + esc(_work.author || '') + '</div>'
  h += '<div class="article-content">' + content + '</div>'

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
  var apps = pd.apps || []

  var h = '<button class="reader-back" onclick="renderHome()" title="返回">←</button>'
  h += '<div class="phone-reader">'
  h += '<div class="phone-frame"'
  h += ' style="--phone-bg:' + ((skin.wallpaper && skin.wallpaper !== '#d0e8f5') ? skin.wallpaper : '') + ';'
  h += '--phone-radius:' + (skin.borderRadius || 28) + 'px;'
  h += '--phone-font:\'' + (skin.fontFamily || 'Noto Sans SC').replace(/'/g, '') + '\', sans-serif;'
  h += '--phone-fontsize:' + (skin.fontSize || 12) + 'px;'
  h += '--phone-frame:' + (skin.frameColor || '#ccc') + ';">'

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
    if (app.type === 'settings') continue
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

// ---- Init ----
renderHome()