// Tuuru Works - Article Editor (clean rewrite)
import { getWork, updateWork, addNode, updateNode, deleteNode, addChoice, updateChoice, deleteChoice, addScene, deleteScene, addPlaceholder, deletePlaceholder, updatePlaceholder, uid, WORK_TYPE, PLACEHOLDER_MODE, BUILTIN_FONTS, DEFAULT_EDITOR_SETTINGS, PH_PRESETS, PH_MODES, PHONE_APP_DEFS, addPhoneModule, updatePhoneModule, deletePhoneModule, getPhoneModulesByNode, getPhoneModule } from "../data.js"
import { navigate } from "../router.js"
import { showToast, renderHeader, modal } from "../app.js"
import { createPhoneWorkDraft } from "../phone-work-access.js"
import { createPhoneModuleCloseHandlers, createPhoneModuleDraftData } from "../phone-module-draft.js"
import { openPhoneAppModal } from "./phone.js"

// State
var _workId = null
var _nodeId = null

function esc(s) {
  if (!s) return ""
  var d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

function showPrompt(title, placeholder, cb) {
  var ov = modal(title, '<div class="form-group"><input id="pI" class="form-input" placeholder="' + esc(placeholder) + '"></div>', '<button id="pK" class="btn btn-primary">\u786e\u5b9a</button>')
  document.getElementById("pK").onclick = function() {
    var v = document.getElementById("pI")?.value?.trim() || ""
    cb(v)
    ov.remove()
  }
}

function showConfirm(title, msg, cb) {
  var ov = modal(title, '<p>' + esc(msg) + '</p>', '<button id="cK" class="btn btn-danger">\u786e\u5b9a</button><button id="cN" class="btn btn-ghost">\u53d6\u6d88</button>')
  document.getElementById("cK").onclick = function() { cb(true); ov.remove() }
  document.getElementById("cN").onclick = function() { ov.remove() }
}


export function renderEditor(wid) {
  _workId = wid
  var w = getWork(wid)
  if (!w) return '<div class="app-main"><div class="empty-state"><h3>作品未找到</h3></div></div>'
  var ns = w.nodes || []
  if (!_nodeId || !ns.find(function(n){ return n.id === _nodeId })) {
    _nodeId = ns.length ? ns[0].id : null
  }
  var L = buildIconbar(wid)
  var E = buildEditor(w, _nodeId)
  var W = buildWorldTree(w)
  return '<div class="editor-page"><div class="editor-body-area">' + L + E + W + '</div></div>'
}

function buildIconbar(wid) {
  var h = '<div class="editor-iconbar">'
  h += '<button data-a="ph" data-w="' + wid + '" title="占位符">{}</button>'
  h += '<button data-a="ch" data-w="' + wid + '" title="选项">⇄</button>'
  h += '<div class="divider"></div>'
  h += '<button data-a="im" title="图片">+</button>'
  h += '<div class="divider"></div>'
  h += '<button data-a="pa-msg" data-w="' + wid + '" title="消息">' + PHONE_APP_DEFS.messages.icon + '</button>'
  h += '<button data-a="pa-forum" data-w="' + wid + '" title="论坛">' + PHONE_APP_DEFS.forum.icon + '</button>'
  h += '<button data-a="pa-memo" data-w="' + wid + '" title="备忘">' + PHONE_APP_DEFS.memo.icon + '</button>'
  h += '<button data-a="pa-gallery" data-w="' + wid + '" title="相册">' + PHONE_APP_DEFS.gallery.icon + '</button>'
  h += '<button data-a="pa-browser" data-w="' + wid + '" title="浏览">' + PHONE_APP_DEFS.browser.icon + '</button>'
  h += '<button data-a="pa-shop" data-w="' + wid + '" title="购物">' + PHONE_APP_DEFS.shopping.icon + '</button>'
  h += '<button data-a="pa-contacts" data-w="' + wid + '" title="联系人">' + PHONE_APP_DEFS.contacts.icon + '</button>'
  h += '</div>'
  return h
}

function buildEditor(w, nid) {
  var n = (w.nodes || []).find(function(x){ return x.id === nid })
  if (!n) return '<div class="editor-area"><div class="editor-empty">选择一个节点开始编辑</div></div>'
  var h = '<div class="editor-area">'
  h += buildHeader(w, n)
  h += buildToolbar(nid)
  h += buildContent(n)
  h += '</div>'
  return h
}

function buildHeader(w, n) {
  var sc = w.scenes || []
  var h = '<div class="editor-header">'
  h += '<input class="node-name" id="nt_' + n.id + '" value="' + esc(n.title || '') + '" placeholder="节点标题" data-a="rn" data-n="' + n.id + '">'
  h += '<div class="editor-actions">'
  h += '<select data-a="ss" data-n="' + n.id + '"><option value="">场景</option>'
  for (var i = 0; i < sc.length; i++) {
    var s = sc[i]
    h += '<option value="' + s.id + '"' + (n.scene === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'
  }
  h += '</select>'
  h += '</div>'
  h += '<span class="word-count" id="wc_' + n.id + '">' + (n.content || '').length + ' 字</span>'
  h += '</div>'
  return h
}

function getSettings(wid) {
  var w = getWork(wid)
  var es = w?.editorSettings
  if (!es) {
    es = Object.assign({}, DEFAULT_EDITOR_SETTINGS)
    if (w) { w.editorSettings = es; updateWork(wid, {editorSettings: es}) }
  }
  return es
}

function buildToolbar(nid) {
  var w = getWork(_workId)
  var es = getSettings(_workId)

  var h = '<div class="editor-toolbar">'
  // Text style buttons
  h += '<button data-a="bold" data-n="' + nid + '" title="加粗"><b>B</b></button>'
  h += '<button data-a="italic" data-n="' + nid + '" title="斜体"><i>I</i></button>'
  h += '<button data-a="underline" data-n="' + nid + '" title="下划线"><u>U</u></button>'
  h += '<div class="tb-divider"></div>'

  // Alignment
  h += '<button data-a="left" data-n="' + nid + '" title="左对齐">左</button>'
  h += '<button data-a="center" data-n="' + nid + '" title="居中">中</button>'
  h += '<button data-a="right" data-n="' + nid + '" title="右对齐">右</button>'
  h += '<div class="tb-divider"></div>'

  // Font family
  h += '<select class="toolbar-setting" data-a="fs-font" title="字体"><option value="">字体</option>'
  // Built-in fonts
  for (var fi = 0; fi < BUILTIN_FONTS.length; fi++) {
    var bf = BUILTIN_FONTS[fi]
    h += '<option value="' + esc(bf.value) + '"' + ((es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily) === bf.value ? ' selected' : '') + '>' + esc(bf.name) + '</option>'
  }
  // Custom fonts
  var cfs = es.customFonts || []
  if (cfs.length > 0) {
    for (var cfi = 0; cfi < cfs.length; cfi++) {
      var cf = cfs[cfi]
      h += '<option value="' + esc(cf.value) + '"' + (es.fontFamily === cf.value ? ' selected' : '') + '>' + esc(cf.name) + '</option>'
    }
  }
  h += '<option value="__custom__">+ 导入字体…</option>'
  h += '</select>'

  // Font size
  h += '<select class="toolbar-setting" data-a="fs-size" title="字号"><option value="">字号</option>'
  var sizes = [12,14,16,18,20,22,24,28,32]
  for (var si = 0; si < sizes.length; si++) {
    var sz = sizes[si]
    h += '<option value="' + sz + '"' + (es.fontSize === sz ? ' selected' : '') + '>' + sz + 'px</option>'
  }
  h += '</select>'

  // Line height
  h += '<select class="toolbar-setting" data-a="fs-lh" title="行间距"><option value="">行距</option>'
  var lhs = [1.4,1.6,1.8,1.9,2.0,2.2,2.5]
  for (var li = 0; li < lhs.length; li++) {
    var lh = lhs[li]
    h += '<option value="' + lh + '"' + (es.lineHeight === lh ? ' selected' : '') + '>' + lh + '</option>'
  }
  h += '</select>'

  // Letter spacing
  h += '<span class="toolbar-setting-group" title="字间距">'
  h += '<span class="toolbar-label">字距</span>'
  h += '<input class="toolbar-number" data-a="fs-ls" type="number" min="0" max="10" step="0.5" value="' + (es.letterSpacing || 0) + '">px'
  h += '</span>'

  // Indent checkbox
  h += '<label class="toolbar-checkbox" title="段首缩进">'
  h += '<input type="checkbox" data-a="fs-indent"' + (es.indentFirstLine ? ' checked' : '') + '> 缩进'
  h += '</label>'

  // Margin toggle button + popover
  h += '<span class="toolbar-margin-wrap">'
  h += '<button data-a="fs-margin-toggle" title="页边距">边距</button>'
  h += '<span class="margin-popover" id="marginPopover">'
  h += '<span class="margin-grid">'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>上</label><input class="margin-num" data-a="fs-mt" type="number" min="0" max="120" value="' + (es.marginTop || 24) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>左</label><input class="margin-num" data-a="fs-ml" type="number" min="0" max="120" value="' + (es.marginLeft || 32) + '"></span>'
  h += '<span class="margin-center">边距</span>'
  h += '<span class="margin-cell"><label>右</label><input class="margin-num" data-a="fs-mr" type="number" min="0" max="120" value="' + (es.marginRight || 32) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>下</label><input class="margin-num" data-a="fs-mb" type="number" min="0" max="120" value="' + (es.marginBottom || 24) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '</span>'
  h += '</span>'
  h += '</span>'

  h += '</div>'
  return h
}

function buildContent(n) {
  var es = getSettings(_workId)
  var style = 'font-family:' + (es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily) + ';'
  style += 'font-size:' + (es.fontSize || DEFAULT_EDITOR_SETTINGS.fontSize) + 'px;'
  style += 'line-height:' + (es.lineHeight || DEFAULT_EDITOR_SETTINGS.lineHeight) + ';'
  style += 'letter-spacing:' + (es.letterSpacing || 0) + 'px;'
  style += 'padding:' + (es.marginTop || 24) + 'px ' + (es.marginRight || 32) + 'px ' + (es.marginBottom || 24) + 'px ' + (es.marginLeft || 32) + 'px;'
  if (es.indentFirstLine) {
    style += 'text-indent:2em;'
  }
  var hasChoices = (n.choices || []).length > 0
  var h = '<div class="editor-content' + (hasChoices ? ' has-choices' : '') + '">'
  h += '<div class="content-editable" id="ce_' + n.id + '" contenteditable="true" data-a="ce" data-n="' + n.id + '" style="' + esc(style) + '">' + (n.content || '') + '</div>'
  // Choice card at bottom
  if (hasChoices) {
    h += '<div class="choice-card" data-a="choice-card" data-w="' + _workId + '" data-n="' + n.id + '">'
    h += '<div class="choice-card-head"><span class="choice-card-title">选项</span></div>'
    h += '<div class="choice-card-btns">'
    for (var ci = 0; ci < n.choices.length; ci++) {
      var c = n.choices[ci]
      h += '<button class="choice-btn" data-a="ch-go" data-w="' + _workId + '" data-n="' + n.id + '" data-cid="' + c.id + '" data-target="' + esc(c.targetId || '') + '">' + esc(c.text || '选项') + '</button>'
    }
    h += '</div>'
    h += '</div>'
  }
  h += '</div>'
  return h
}

function buildWorldTree(w) {
  var ns = w.nodes || []
  var ch = w.chapters || []
  var h = '<div class="world-tree">'
  h += '<div class="wt-header"><span>节点列表</span><div>'
  h += '<button data-a="as" data-w="' + w.id + '">+章</button>'
  h += '<button data-a="an" data-w="' + w.id + '">+</button></div></div>'
  h += '<div class="wt-body">'
  if (ns.length === 0) {
    h += '<div class="wt-empty">暂无节点</div>'
  } else {
    // Group nodes by scene
    var grouped = {}
    var ungrouped = []
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i]
      var cid = n.chapterId || ""
      if (!grouped[cid]) grouped[cid] = []
      grouped[cid].push(n)
    }
    // Render scenes
        for (var ci = 0; ci < ch.length; ci++) {
      var chs = ch[ci]
      var chid = chs.id
      var cNodes = grouped[chid] || []
      h += '<div class="wt-chapter">'
      h += '<div class="wt-chapter-title" data-a="ts" data-w="' + w.id + '" data-sid="' + chid + '"><span class="arrow" id="arr_' + chid + '">\u25b6</span><span class="chapter-name">' + esc(chs.name) + '</span><span class="chapter-actions"><button data-a="chapter-rename" data-w="' + w.id + '" data-sid="' + chid + '" title="重命名章节">\u270e</button><button data-a="chapter-delete" data-w="' + w.id + '" data-sid="' + chid + '" title="删除章节">\u2715</button></span></div>'
      for (var ni = 0; ni < cNodes.length; ni++) {
        h += nodeHTML(w, cNodes[ni])
        var cnode = cNodes[ni]
        if (cnode.choices && cnode.choices.length) {
          for (var cci = 0; cci < cnode.choices.length; cci++) {
            var cc = cnode.choices[cci]
            h += '<div class="wt-choice" data-a="sl" data-w="' + w.id + '" data-n="' + (cc.targetId || '') + '">'
            h += '<span class="wt-choice-arrow">\u21b3</span>'
            h += '<span class="wt-choice-text">' + esc(cc.text || '选项') + '</span>'
            h += '</div>'
          }
        }
      }
      h += '</div>'
    }    var uncid = grouped[""] || []
    for (var ui = 0; ui < uncid.length; ui++) {
      h += nodeHTML(w, uncid[ui])
    }  }
  h += '</div></div>'
  return h
}

function nodeHTML(w, n) {
  var ac = n.id === _nodeId ? ' active' : ''
  var ch = w.chapters || []
  var curCid = n.chapterId || ""
  var h = '<div class="wt-node' + ac + '" data-a="sl" data-w="' + w.id + '" data-n="' + n.id + '">'
  h += '<span class="dot"></span>'
  h += '<span class="node-label">' + esc(n.title || '节点') + '</span>'
  h += '<span class="node-actions">'
  h += '<select class="chapter-move" data-a="mc" data-w="' + w.id + '" data-n="' + n.id + '" title="移动到章节"><option value="">移至…</option>'
  for (var ci = 0; ci < ch.length; ci++) {
    var c = ch[ci]
    if (c.id !== curCid) {
      h += '<option value="' + c.id + '">' + esc(c.name) + '</option>'
    }
  }
  h += '</select>'
  h += '<button data-a="rn2" data-w="' + w.id + '" data-n="' + n.id + '" title="重命名">\u270e</button>'
  h += '<button data-a="up" data-w="' + w.id + '" data-n="' + n.id + '" title="上移">\u25b2</button>'
  h += '<button data-a="dn" data-w="' + w.id + '" data-n="' + n.id + '" title="下移">\u25bc</button>'
  h += '<button data-a="dl" data-w="' + w.id + '" data-n="' + n.id + '" title="删除">\u2715</button>'
  h += '</span></div>'
  return h
}

// ====== Event Delegation ======
document.addEventListener("click", handleClick)
document.addEventListener("change", handleChange)

function handleClick(e) {
  var b = e.target.closest("[data-a]")
  if (!b) return
  var a = b.dataset.a
  var w = b.dataset.w || _workId
  var n = b.dataset.n || _nodeId
  if (a === "an") {
    var nd = addNode(w)
    if (nd) {
      var _w = getWork(w)
      var _s = (_w.scenes || [])[0]
      if (_s) updateNode(w, nd.id, {scene: _s.id})
      _nodeId = nd.id
      refreshEditor(w)
    }
    return
  }
  if (a === "as") {
    var sn = prompt("章节名称:")
    if (sn) { var wo = getWork(w); wo.chapters = wo.chapters || []; wo.chapters.push({id:uid(), name:sn}); updateWork(w, {chapters: wo.chapters}); refreshEditor(w) }
    return
  }
  if (a === "sl") { _nodeId = n; refreshEditor(w); return }
  if (a === "up") {
    moveNode(w, n, -1)
    return
  }
  if (a === "dn") {
    moveNode(w, n, 1)
    return
  }
  if (a === "dl") {
    if (confirm("确定删除?")) { deleteNode(w, n); refreshEditor(w) }
    return
  }
  if (a === "rn2") {
    var nd = getNode(w, n)
    showPrompt("重命名节点", nd ? nd.title : "", function(nn) {
      if (nn) { updateNode(w, n, {title: nn}); refreshEditor(w) }
    })
    return
  }
  if (a === "ss") {
    updateNode(w, n, {scene: b.value})
    return
  }
  if (a === "rn") {
    updateNode(w, n, {title: b.value})
    return
  }
  if (a === "ph") {
    openPlaceholderPanel(w)
    return
  }
  if (a === "ch") {
    openChoicePanel(w, _nodeId)
    return
  }
  if (a === "im") {
    openImagePanel()
    return
  }
  // Phone app shortcuts - create inline cards
  if (a === "pa-msg") { insertPhoneModuleCard(w, _nodeId, 'messages'); return }
  if (a === "pa-forum") { insertPhoneModuleCard(w, _nodeId, 'forum'); return }
  if (a === "pa-memo") { insertPhoneModuleCard(w, _nodeId, 'memo'); return }
  if (a === "pa-gallery") { insertPhoneModuleCard(w, _nodeId, 'gallery'); return }
  if (a === "pa-browser") { insertPhoneModuleCard(w, _nodeId, 'browser'); return }
  if (a === "pa-shop") { insertPhoneModuleCard(w, _nodeId, 'shopping'); return }
  if (a === "pa-contacts") { openPhoneAppModal(w, 'contacts'); return }
  // Phone module card hamburger click
  if (a === "pm-hamburger") {
    var pmid = b.dataset.pmId
    if (pmid) showPhoneModuleMenu(w, _nodeId, pmid, b)
    return
  }
  // Navigate to target node via choice card
  if (a === "ch-go") {
    var target = b.dataset.target
    if (target && getNode(w, target)) {
      _nodeId = target
      refreshEditor(w)
    }
    return
  }
  if (a === "ts") {
    var sid = b.dataset.sid
    if (sid) {
      var arrow = document.getElementById("arr_" + sid)
      if (arrow) arrow.classList.toggle("open")
      var parent = b.parentElement
      if (parent) {
        var nodes = parent.querySelectorAll(".wt-node")
        for (var ni = 0; ni < nodes.length; ni++) {
          nodes[ni].style.display = nodes[ni].style.display === "none" ? "" : "none"
        }
      }
    }
    return
  }
  if (a === "chapter-delete") {
    var sid = b.dataset.sid
    if (sid) { showConfirm("\u5220\u9664\u7ae0\u8282", "\u786e\u5b9a\u5220\u9664\u6b64\u7ae0\u8282\uff1f\u8282\u70b9\u5c06\u79fb\u81f3\u5269\u4f59\u7ae0\u8282", function(ok) { if (ok) { var _w2 = getWork(w); var _rem = (_w2.chapters || []).filter(function(s){return s.id !== sid}); if (_rem.length > 0) { (_w2.nodes || []).forEach(function(node) { if (node.chapterId === sid) { updateNode(w, node.id, {chapterId: _rem[0].id}) } }) } updateWork(_workId, {chapters: _rem}); refreshEditor(w) } }) }
    return
  }
  if (a === "chapter-rename") {
    var sid = b.dataset.sid
    var _w = getWork(_workId)
    var _ch = (_w.chapters || []).find(function(c){ return c.id === sid })
    showPrompt("\u91cd\u547d\u540d\u7ae0\u8282", _ch ? _ch.name : "", function(name) {
      if (name) {
        var _chapters = (getWork(_workId).chapters || []).map(function(c) {
          if (c.id === sid) c.name = name
          return c
        })
        updateWork(_workId, {chapters: _chapters})
        refreshEditor(_workId)
      }
    })
    return
  }
  if (a === "fs-margin-toggle") {
    var popover = document.getElementById("marginPopover")
    if (popover) popover.classList.toggle("open")
    return
  }
  // Formatting
  if (a === "bold") { fmt("bold"); return }
  if (a === "italic") { fmt("italic"); return }
  if (a === "underline") { fmt("underline"); return }
  if (a === "left") { fmt("justifyLeft"); return }
  if (a === "center") { fmt("justifyCenter"); return }
  if (a === "right") { fmt("justifyRight"); return }
}

function getNode(wid, nid) {
  var w = getWork(wid)
  return w ? (w.nodes || []).find(function(x){ return x.id === nid }) : null
}

function handleChange(e) {
  var b = e.target.closest("[data-a]")
  if (!b) return
  var a = b.dataset.a

  // Node title rename (from editor header input)
  if (a === "rn") {
    var w = b.dataset.w || _workId
    var n = b.dataset.n || _nodeId
    updateNode(w, n, {title: b.value})
    return
  }

  // Chapter move
  if (a === "mc") {
    var w = b.dataset.w || _workId
    var n = b.dataset.n || _nodeId
    var targetCid = b.value
    if (targetCid) {
      var _w3 = getWork(w)
      var _ns = _w3.nodes || []
      var _node = _ns.find(function(x) { return x.id === n })
      if (_node) {
        _node.chapterId = targetCid
        var _idx = _ns.findIndex(function(x) { return x.id === n })
        if (_idx >= 0) {
          var _moved = _ns.splice(_idx, 1)[0]
          _ns.push(_moved)
        }
        updateWork(w, {nodes: _ns})
        refreshEditor(w)
      }
    }
    return
  }

  // Layout settings
  if (a === "fs-font") {
    var val = b.value
    if (val === "__custom__") {
      // Open file picker for font
      var input = document.createElement("input")
      input.type = "file"
      input.accept = ".ttf,.otf,.woff,.woff2"
      input.onchange = function() {
        var file = input.files && input.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function() {
          var fontName = file.name.replace(/\.[^.]+$/, "")
          var fontData = reader.result
          // Inject @font-face
          var styleEl = document.createElement("style")
          styleEl.textContent = '@font-face{font-family:"' + fontName + '";src:url(' + fontData + ') format("' + (file.name.endsWith('.ttf')?'truetype':'opentype') + '");}'
          document.head.appendChild(styleEl)
          // Save to editorSettings
          var _es = getSettings(_workId)
          _es.customFonts = _es.customFonts || []
          _es.customFonts.push({name: fontName, value: '"' + fontName + '", sans-serif'})
          _es.fontFamily = '"' + fontName + '", sans-serif'
          updateWork(_workId, {editorSettings: _es})
          refreshEditor(_workId)
        }
        reader.readAsDataURL(file)
      }
      input.click()
      return
    }
    if (val) {
      var _es = getSettings(_workId)
      _es.fontFamily = val
      updateWork(_workId, {editorSettings: _es})
      applyEditorStyle()
    }
    return
  }
  if (a === "fs-size") {
    var val = parseInt(b.value)
    if (val) {
      var _es = getSettings(_workId)
      _es.fontSize = val
      updateWork(_workId, {editorSettings: _es})
      applyEditorStyle()
    }
    return
  }
  if (a === "fs-lh") {
    var val = parseFloat(b.value)
    if (val) {
      var _es = getSettings(_workId)
      _es.lineHeight = val
      updateWork(_workId, {editorSettings: _es})
      applyEditorStyle()
    }
    return
  }
  if (a === "fs-ls") {
    var val = parseFloat(b.value) || 0
    var _es = getSettings(_workId)
    _es.letterSpacing = val
    updateWork(_workId, {editorSettings: _es})
    applyEditorStyle()
    return
  }
  if (a === "fs-indent") {
    var _es = getSettings(_workId)
    _es.indentFirstLine = b.checked
    updateWork(_workId, {editorSettings: _es})
    applyEditorStyle()
    return
  }
  if (a === "fs-mt" || a === "fs-mr" || a === "fs-mb" || a === "fs-ml") {
    var key = { "fs-mt": "marginTop", "fs-mr": "marginRight", "fs-mb": "marginBottom", "fs-ml": "marginLeft" }[a]
    var val = parseInt(b.value) || 0
    var _es = getSettings(_workId)
    _es[key] = val
    updateWork(_workId, {editorSettings: _es})
    applyEditorStyle()
    return
  }
}

function applyEditorStyle() {
  var es = getSettings(_workId)
  var ce = document.getElementById("ce_" + _nodeId)
  if (!ce) return
  ce.style.fontFamily = es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily
  ce.style.fontSize = (es.fontSize || DEFAULT_EDITOR_SETTINGS.fontSize) + 'px'
  ce.style.lineHeight = es.lineHeight || DEFAULT_EDITOR_SETTINGS.lineHeight
  ce.style.letterSpacing = (es.letterSpacing || 0) + 'px'
  ce.style.padding = (es.marginTop || 24) + 'px ' + (es.marginRight || 32) + 'px ' + (es.marginBottom || 24) + 'px ' + (es.marginLeft || 32) + 'px'
  ce.style.textIndent = es.indentFirstLine ? '2em' : '0'
}

// SVG icon for help button: circle with question mark
var HELP_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6.2 5.8c.3-.5.8-.8 1.8-.8s1.5.3 1.5 1c0 .7-.5 1.1-1.2 1.4l-.3.1v1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" fill="none"/><circle cx="8" cy="11.5" r="0.7" fill="currentColor"/></svg>'

var PH_TUTORIAL = '' +
'<div class="ph-tutorial"><b>占位符使用说明</b>' +
'<p>占位符用于在导出 HTML 时替换正文中的特定文字，让每个读者获得个性化的阅读体验。</p>' +
'<p><b>全文替换 (each)：</b>全文所有出现处统一替换为读者所填的同一个值。适合姓名、昵称等。</p>' +
'<p><b>随机替换 (random)：</b>每次出现时从读者填写的值池中随机选一个。适合"喜欢的颜色"这类可能有多个答案的问题。</p>' +
'<p><b>场景锁定 (scene)：</b>每个章节固定一个值，同章节内一致。适合"喜欢的食物"，避免同一场景串味。</p>' +
'<p><b>标记 (key)：</b>正文中要被替换的文字。作者自定义，如"某某"、"1"等，在正文中写入这些标记即可。</p>' +
'<p><b>问题 (prompt)：</b>对读者提出的问题。如"你的名字？"</p>' +
'<p><b>违禁词：</b>设置后读者不可填写这些内容。</p>' +
'<p>点击"添加 NAME 预设"一键创建姓名/昵称/网名三个占位符。</p></div>'

function openPlaceholderPanel(wid) {
  var w = getWork(wid)
  if (!w) return
  var phs = w.placeholders || []
  var body = '<div class="ph-panel" id="phPanel">'

  // Header row
  body += '<div class="ph-header">'
  body += '<span class="ph-header-title">占位符管理</span>'
  body += '<button class="ph-help-btn" id="phHelpBtn" title="使用说明">' + HELP_ICON_SVG + '</button>'
  body += '</div>'

  // Help tutorial (hidden by default)
  body += '<div class="ph-tutorial-wrap" id="phTutorialWrap" style="display:none">' + PH_TUTORIAL + '</div>'

  // Action buttons
  body += '<div class="ph-actions">'
  body += '<button class="btn btn-sm btn-outline" data-ph-a="preset-name">添加 NAME 预设</button>'
  body += '<button class="btn btn-sm btn-primary" data-ph-a="add">添加占位符</button>'
  body += '</div>'

  // List
  body += '<div class="ph-list">'
  if (phs.length === 0) {
    body += '<div class="ph-empty">暂无占位符。点击上方按钮添加。</div>'
  }
  for (var i = 0; i < phs.length; i++) {
    var ph = phs[i]
    body += buildPhCard(ph)
  }
  body += '</div>'

  body += '</div>'

  var ov = modal('', body, '')
  // Remove modal title
  var titleEl = ov.querySelector('.modal-title')
  if (titleEl) titleEl.parentElement.style.display = 'none'

  // Bind panel events
  var panel = ov.querySelector('#phPanel')
  if (panel) {
    panel.addEventListener('click', function(ev) {
      var t = ev.target
      // Help button
      if (t.closest('#phHelpBtn')) {
        var wrap = document.getElementById('phTutorialWrap')
        if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none'
        return
      }
      var btn = t.closest('[data-ph-a]')
      if (!btn) return
      var act = btn.dataset.phA
      var pid = btn.closest('[data-ph-id]')?.dataset?.phId

      if (act === 'preset-name') {
        addPlaceholder(wid, '', '', '', 'name')
        refreshPhList(wid, ov)
        return
      }
      if (act === 'add') {
        addPlaceholder(wid, uid().slice(0,6), '新占位符', '请填写')
        refreshPhList(wid, ov)
        return
      }
      if (act === 'delete' && pid) {
        if (confirm('确定删除此占位符？')) {
          deletePlaceholder(wid, pid)
          refreshPhList(wid, ov)
        }
        return
      }
      if (act === 'save' && pid) {
        savePhCard(wid, pid)
        refreshPhList(wid, ov)
        return
      }
      if (act === 'add-forbidden' && pid) {
        var input = btn.parentElement.querySelector('.ph-forbidden-input')
        var word = (input?.value || '').trim()
        if (word) {
          var phObj = (getWork(wid).placeholders || []).find(function(p){ return p.id === pid })
          if (phObj) {
            phObj.forbidden = phObj.forbidden || []
            phObj.forbidden.push(word)
            updatePlaceholder(wid, pid, {forbidden: phObj.forbidden})
            refreshPhList(wid, ov)
          }
        }
        return
      }
      if (act === 'remove-forbidden' && pid) {
        var idx = parseInt(btn.dataset.phIdx)
        var phObj = (getWork(wid).placeholders || []).find(function(p){ return p.id === pid })
        if (phObj && phObj.forbidden && idx < phObj.forbidden.length) {
          phObj.forbidden.splice(idx, 1)
          updatePlaceholder(wid, pid, {forbidden: phObj.forbidden})
          refreshPhList(wid, ov)
        }
        return
      }
    })
  }

  // Click outside to close
  ov.addEventListener('click', function(ev) {
    if (ev.target === ov) ov.remove()
  })
}

function buildPhCard(ph) {
  var fw = ph.forbidden || []
  var h = '<div class="ph-card" data-ph-id="' + ph.id + '">'
  h += '<div class="ph-card-head">'
  h += '<span class="ph-card-label">' + esc(ph.label || '占位符') + '</span>'
  h += '<button class="ph-card-del" data-ph-a="delete" title="删除">\u2715</button>'
  h += '</div>'
  h += '<div class="ph-card-body">'
  // Row 1: key + prompt
  h += '<div class="ph-row">'
  h += '<label>标记</label><input class="ph-input" id="ph_key_' + ph.id + '" value="' + esc(ph.key || '') + '" placeholder="正文中要替换的文字">'
  h += '<label>问题</label><input class="ph-input" id="ph_prompt_' + ph.id + '" value="' + esc(ph.prompt || '') + '" placeholder="对读者的问题">'
  h += '</div>'
  // Row 2: mode
  h += '<div class="ph-row">'
  h += '<label>模式</label><select class="ph-select" id="ph_mode_' + ph.id + '">'
  for (var mi = 0; mi < PH_MODES.length; mi++) {
    var m = PH_MODES[mi]
    h += '<option value="' + m.value + '"' + (ph.mode === m.value ? ' selected' : '') + '>' + m.label + '</option>'
  }
  h += '</select>'
  h += '</div>'
  // Row 3: forbidden words
  h += '<div class="ph-row">'
  h += '<label>违禁词</label>'
  h += '<span class="ph-forbidden-tags">'
  for (var fi = 0; fi < fw.length; fi++) {
    h += '<span class="ph-fw-tag">' + esc(fw[fi]) + '<button data-ph-a="remove-forbidden" data-ph-idx="' + fi + '" title="移除">\u2715</button></span>'
  }
  h += '</span>'
  h += '<input class="ph-input ph-forbidden-input" placeholder="添加违禁词">'
  h += '<button class="btn btn-sm btn-ghost" data-ph-a="add-forbidden">添加</button>'
  h += '</div>'
  // Save button
  h += '<div class="ph-row ph-row-end">'
  h += '<button class="btn btn-sm btn-primary" data-ph-a="save">保存</button>'
  h += '</div>'
  h += '</div>'
  h += '</div>'
  return h
}

function savePhCard(wid, pid) {
  var keyEl = document.getElementById('ph_key_' + pid)
  var promptEl = document.getElementById('ph_prompt_' + pid)
  var modeEl = document.getElementById('ph_mode_' + pid)
  updatePlaceholder(wid, pid, {
    key: (keyEl?.value || '').trim(),
    prompt: (promptEl?.value || '').trim(),
    mode: modeEl?.value || 'each'
  })
  showToast('已保存')
}

function refreshPhList(wid, overlay) {
  var w = getWork(wid)
  var phs = w.placeholders || []
  var listEl = overlay.querySelector('.ph-list')
  if (!listEl) return
  var h = ''
  if (phs.length === 0) {
    h = '<div class="ph-empty">暂无占位符。点击上方按钮添加。</div>'
  }
  for (var i = 0; i < phs.length; i++) {
    h += buildPhCard(phs[i])
  }
  listEl.innerHTML = h
}

function openChoicePanel(wid, nid) {
  var w = getWork(wid)
  if (!w) return
  var node = getNode(wid, nid)
  if (!node) return
  var choices = node.choices || []
  var allNodes = w.nodes || []

  var body = '<div class="ch-panel" id="chPanel">'
  body += '<div class="ch-header"><span class="ch-header-title">选项编辑 -- ' + esc(node.title || '节点') + '</span></div>'
  body += '<div class="ch-list" id="chList">'

  for (var i = 0; i < choices.length; i++) {
    var c = choices[i]
    body += '<div class="ch-item" data-ch-idx="' + i + '">'
    body += '<span class="ch-num">#' + (i + 1) + '</span>'
    body += '<input class="ch-text" id="ch_text_' + i + '" value="' + esc(c.text || '') + '" placeholder="选项文字">'
    body += '<select class="ch-target" id="ch_target_' + i + '">'
    body += '<option value="">选择目标节点</option>'
    for (var ni = 0; ni < allNodes.length; ni++) {
      var tn = allNodes[ni]
      if (tn.id !== nid) {
        body += '<option value="' + tn.id + '"' + (c.targetId === tn.id ? ' selected' : '') + '>' + esc(tn.title || '节点') + '</option>'
      }
    }
    body += '</select>'
    body += '<button class="ch-del-btn" data-ch-a="del-choice" data-ch-idx="' + i + '" title="删除选项">\u2715</button>'
    body += '</div>'
  }

  body += '</div>'
  body += '<div class="ch-footer">'
  body += '<button class="btn btn-sm btn-outline" data-ch-a="add-choice">+ 添加选项</button>'
  body += '<button class="btn btn-sm btn-primary" data-ch-a="save">保存</button>'
  body += '<button class="btn btn-sm btn-ghost" data-ch-a="delete-all">删除选项组</button>'
  body += '</div>'
  body += '</div>'

  var ov = modal('', body, '')
  var titleEl = ov.querySelector('.modal-title')
  if (titleEl) titleEl.parentElement.style.display = 'none'

  var panel = ov.querySelector('#chPanel')
  var listEl = ov.querySelector('#chList')

  if (panel) {
    panel.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ch-a]')
      if (!btn) return
      var act = btn.dataset.chA

      if (act === 'add-choice') {
        // DOM only: append empty row, no localStorage write
        var dummy = { id: uid(), text: '', targetId: '' }
        appendChRow(listEl, wid, nid, dummy, listEl.children.length)
        return
      }
      if (act === 'del-choice') {
        var item = btn.closest('.ch-item')
        if (item) {
          if (listEl.children.length <= 2) {
            showToast('至少需要 2 个选项', 'error')
            return
          }
          item.remove()
          reindexChRows(listEl)
        }
        return
      }
      if (act === 'save') {
        saveChoicesFromDOM(wid, nid, listEl)
        refreshEditor(wid)
        return
      }
      if (act === 'delete-all') {
        if (confirm('确定删除此节点的选项组？')) {
          // DOM only: clear list, save will handle rest
          listEl.innerHTML = ''
          ov.remove()
        }
        return
      }
    })
  }

  ov.addEventListener('click', function(ev) {
    if (ev.target === ov) ov.remove()
  })
}

function saveChoicesFromDOM(wid, nid, listEl) {
  var rows = listEl.querySelectorAll('.ch-item')
  if (rows.length < 2) {
    showToast('至少需要 2 个选项', 'error')
    return
  }
  var texts = []
  var targets = []
  for (var i = 0; i < rows.length; i++) {
    var textEl = rows[i].querySelector('.ch-text')
    var targetEl = rows[i].querySelector('.ch-target')
    var txt = (textEl?.value || '').trim()
    var tgt = targetEl?.value || ''
    if (!txt) {
      showToast('选项 #' + (i + 1) + ' 未填写文字', 'error')
      return
    }
    if (!tgt) {
      showToast('选项 #' + (i + 1) + ' 未选择目标节点', 'error')
      return
    }
    texts.push(txt)
    targets.push(tgt)
  }

  // Sync: clear all existing choices, then add back from DOM
  var curNode = getNode(wid, nid)
  if (!curNode) return
  while (curNode.choices && curNode.choices.length) {
    deleteChoice(wid, nid, curNode.choices[0].id)
    curNode = getNode(wid, nid)
  }
  // Now add fresh choices from DOM
  for (var i2 = 0; i2 < texts.length; i2++) {
    var tgtId = targets[i2]
    if (tgtId) {
      addChoice(wid, nid, tgtId)
      var newNode = getNode(wid, nid)
      if (newNode && newNode.choices && newNode.choices.length) {
        var last = newNode.choices[newNode.choices.length - 1]
        updateChoice(wid, nid, last.id, { text: texts[i2] })
      }
    } else {
      addChoice(wid, nid, '')
      var newNode2 = getNode(wid, nid)
      if (newNode2 && newNode2.choices && newNode2.choices.length) {
        var last2 = newNode2.choices[newNode2.choices.length - 1]
        updateChoice(wid, nid, last2.id, { text: texts[i2] })
      }
    }
  }
  showToast('已保存')
}

function refreshChPanel(overlay, wid, nid) {
  var listEl = overlay.querySelector('#chList')
  if (!listEl) return
  var node = getNode(wid, nid)
  if (!node) return
  var choices = node.choices || []
  var allNodes = (getWork(wid).nodes || [])

  var h = ''
  for (var i = 0; i < choices.length; i++) {
    var c = choices[i]
    h += chRowHTML(wid, nid, c, i, allNodes)
  }
  listEl.innerHTML = h
}

function chRowHTML(wid, nid, choice, idx, allNodes) {
  var h = '<div class="ch-item" data-ch-idx="' + idx + '">'
  h += '<span class="ch-num">#' + (idx + 1) + '</span>'
  h += '<input class="ch-text" id="ch_text_' + idx + '" value="' + esc(choice.text || '') + '" placeholder="选项文字">'
  h += '<select class="ch-target" id="ch_target_' + idx + '">'
  h += '<option value="">选择目标节点</option>'
  for (var ni2 = 0; ni2 < (allNodes || []).length; ni2++) {
    var tn = allNodes[ni2]
    if (tn.id !== nid) {
      h += '<option value="' + tn.id + '"' + (choice.targetId === tn.id ? ' selected' : '') + '>' + esc(tn.title || '节点') + '</option>'
    }
  }
  h += '</select>'
  h += '<button class="ch-del-btn" data-ch-a="del-choice" data-ch-idx="' + idx + '" title="删除选项">\u2715</button>'
  h += '</div>'
  return h
}

function appendChRow(listEl, wid, nid, choice, idx) {
  var allNodes = (getWork(wid).nodes || [])
  var div = document.createElement('div')
  div.innerHTML = chRowHTML(wid, nid, choice, idx, allNodes)
  listEl.appendChild(div.firstElementChild)
}

function reindexChRows(listEl) {
  var rows = listEl.querySelectorAll('.ch-item')
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    row.dataset.chIdx = i
    var num = row.querySelector('.ch-num')
    if (num) num.textContent = '#' + (i + 1)
    var text = row.querySelector('.ch-text')
    if (text) text.id = 'ch_text_' + i
    var target = row.querySelector('.ch-target')
    if (target) target.id = 'ch_target_' + i
    var delBtn = row.querySelector('.ch-del-btn')
    if (delBtn) delBtn.dataset.chIdx = i
  }
}

function openImagePanel() {
  var body = '<div class="im-panel">'
  body += '<div class="im-header">插入图片</div>'
  body += '<div class="im-body">'
  body += '<div class="im-section">'
  body += '<div class="im-section-title">上传本地图片</div>'
  body += '<p class="im-hint">图片将转为 base64 嵌入 HTML。大图建议使用外链。</p>'
  body += '<button class="btn btn-sm btn-primary" id="imUploadBtn">选择图片</button>'
  body += '</div>'
  body += '<div class="im-divider"><span>或</span></div>'
  body += '<div class="im-section">'
  body += '<div class="im-section-title">粘贴图片链接</div>'
  body += '<p class="im-hint">推荐图床：<a href="http://www.superbed.cn/" target="_blank">聚合图床 superbed.cn</a></p>'
  body += '<div class="flex-row gap-sm">'
  body += '<input class="form-input" id="imUrlInput" placeholder="https://...">'
  body += '<button class="btn btn-sm btn-outline" id="imUrlBtn">插入</button>'
  body += '</div>'
  body += '</div>'
  body += '</div>'
  body += '</div>'

  var ov = modal('', body, '')
  var titleEl = ov.querySelector('.modal-title')
  if (titleEl) titleEl.parentElement.style.display = 'none'

  // Upload button
  var uploadBtn = ov.querySelector('#imUploadBtn')
  if (uploadBtn) {
    uploadBtn.onclick = function() {
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = function() {
        var file = input.files && input.files[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
          showToast('图片超过 2MB，建议压缩后上传或使用外链', 'error')
          return
        }
        var reader = new FileReader()
        reader.onload = function() {
          var dataUrl = reader.result
          insertImageAtCursor(dataUrl)
          ov.remove()
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  }

  // URL button
  var urlBtn = ov.querySelector('#imUrlBtn')
  if (urlBtn) {
    urlBtn.onclick = function() {
      var url = (document.getElementById('imUrlInput')?.value || '').trim()
      if (!url) {
        showToast('请输入图片链接', 'error')
        return
      }
      insertImageAtCursor(url)
      ov.remove()
    }
  }

  // Enter key in URL input
  var urlInput = ov.querySelector('#imUrlInput')
  if (urlInput) {
    urlInput.onkeydown = function(e) {
      if (e.key === 'Enter' && urlBtn) urlBtn.click()
    }
  }

  ov.addEventListener('click', function(ev) {
    if (ev.target === ov) ov.remove()
  })
}

function insertImageAtCursor(src) {
  var ce = document.getElementById('ce_' + _nodeId)
  if (!ce) {
    showToast('请先选择一个节点', 'error')
    return
  }
  ce.focus()
  // Restore selection or place at end
  var sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    // Try to see if the selection is within ce
    var range = sel.getRangeAt(0)
    if (ce.contains(range.commonAncestorContainer)) {
      // Selection is valid inside ce
    } else {
      // Move cursor to end of ce
      range = document.createRange()
      range.selectNodeContents(ce)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } else {
    var range2 = document.createRange()
    range2.selectNodeContents(ce)
    range2.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range2)
  }
  document.execCommand('insertImage', false, src)
  // Trigger auto-save
  updateNode(_workId, _nodeId, {content: ce.innerHTML})
}

function moveNode(wid, nid, dir) {
  var w = getWork(wid)
  if (!w || !w.nodes || !w.nodes.length) return
  var ns = w.nodes

  var node = ns.find(function(x) { return x.id === nid })
  if (!node) return
  var cid = node.chapterId || ""

  // Collect sibling nodes in same chapter (preserving global order)
  var siblings = []
  for (var i = 0; i < ns.length; i++) {
    if ((ns[i].chapterId || "") === cid) {
      siblings.push(ns[i])
    }
  }
  if (siblings.length < 2) return

  var si = siblings.findIndex(function(x) { return x.id === nid })
  var st = si + dir
  if (st < 0 || st >= siblings.length) return

  // Swap in global array
  var gi = ns.findIndex(function(x) { return x.id === nid })
  var gt = ns.findIndex(function(x) { return x.id === siblings[st].id })
  var tmp = ns[gi]
  ns[gi] = ns[gt]
  ns[gt] = tmp
  updateWork(wid, {nodes: ns})
  refreshEditor(wid)
}

function refreshEditor(wid) {
  var a = document.getElementById("app")
  if (a) {
    a.innerHTML = renderHeader() + '<div id="editorMain">' + renderEditor(wid) + '</div>'
  }
}

function fmt(cmd, val) {
  var ce = document.getElementById("ce_" + _nodeId)
  if (!ce) return
  ce.focus()
  if (val !== undefined) {
    document.execCommand(cmd, false, val)
  } else {
    document.execCommand(cmd, false, null)
  }
}

// Handle backspace/delete for hr elements
document.addEventListener("keydown", function(e) {
  if (e.key !== "Backspace" && e.key !== "Delete") return
  var sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  var range = sel.getRangeAt(0)
  var ce = range.startContainer.closest ? range.startContainer.closest(".content-editable") : null
  if (!ce) {
    // May be inside the content-editable itself
    if (range.startContainer.classList && range.startContainer.classList.contains("content-editable")) {
      ce = range.startContainer
    } else {
      return
    }
  }

  if (e.key === "Backspace") {
    // Check if selection is collapsed and there's an hr before the cursor
    if (range.collapsed) {
      var node = range.startContainer
      var offset = range.startOffset
      // Walk backward to find hr
      var prev = node.previousSibling
      if (prev && prev.nodeName === "HR") {
        e.preventDefault()
        prev.remove()
        return
      }
      // If at start of a text node / element, check parent's child before
      if (offset === 0 && node.parentNode === ce) {
        var siblings = Array.from(ce.childNodes)
        var idx = siblings.indexOf(node)
        if (idx > 0 && siblings[idx - 1].nodeName === "HR") {
          e.preventDefault()
          siblings[idx - 1].remove()
          return
        }
      }
    } else {
      // Selection is not collapsed — let default behavior handle it
      // But check if selection contains hr
      var frag = range.cloneContents()
      var hrs = frag.querySelectorAll ? frag.querySelectorAll("hr") : []
      if (hrs.length > 0) {
        // Default delete + extra cleanup
        setTimeout(function() {
          var remaining = ce.querySelectorAll("hr")
          // Don't auto-clean, just let it go
        }, 0)
      }
    }
  }

  if (e.key === "Delete") {
    if (range.collapsed) {
      var node = range.startContainer
      var offset = range.startOffset
      // Check next sibling
      var next = node.nextSibling
      if (next && next.nodeName === "HR") {
        e.preventDefault()
        next.remove()
        return
      }
      // If at end of text node / element
      if (node.nodeType === 3 && offset >= node.textContent.length && node.parentNode === ce) {
        var _siblings = Array.from(ce.childNodes)
        var _idx = _siblings.indexOf(node)
        if (_idx >= 0 && _idx < _siblings.length - 1 && _siblings[_idx + 1].nodeName === "HR") {
          e.preventDefault()
          _siblings[_idx + 1].remove()
          return
        }
      }
    } else {
      // Selection covers content, let default handle it
    }
  }
})

// ====== Phone Module Inline Cards ======

function buildPhoneModuleCardHTML(pm) {
  var def = PHONE_APP_DEFS[pm.type] || PHONE_APP_DEFS.messages
  var h = '<div class="pm-inline-card" contenteditable="false" data-pm-id="' + pm.id + '" data-pm-type="' + pm.type + '" draggable="false">'
  h += '<span class="pm-card-icon">' + (def.icon || '?') + '</span>'
  h += '<span class="pm-card-label">' + esc(def.label || '模块') + '</span>'
  h += '<button class="pm-card-hamburger" data-a="pm-hamburger" data-pm-id="' + pm.id + '" title="编辑/删除">\u2261</button>'
  h += '</div>'
  return h
}

function insertPhoneModuleCard(wid, nid, type) {
  var ce = document.getElementById('ce_' + nid)
  if (!ce) { showToast('请先选择一个节点', 'error'); return }

  var def = PHONE_APP_DEFS[type] || PHONE_APP_DEFS.messages
  // Step 1: Open modal FIRST. Card will be inserted AFTER the modal closes.
  openPhoneAppModalForCard(wid, nid, null, type, def, function(savedPm) {
    // Step 2: Modal closed → insert card into contenteditable
    var ce2 = document.getElementById('ce_' + nid)
    if (!ce2) return

    var cardHTML = buildPhoneModuleCardHTML(savedPm)
    ce2.focus()

    var sel = window.getSelection()
    var range
    if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0)
      if (!ce2.contains(range.commonAncestorContainer)) {
        range = document.createRange()
        range.selectNodeContents(ce2)
        range.collapse(false)
      }
    } else {
      range = document.createRange()
      range.selectNodeContents(ce2)
      range.collapse(false)
    }

    var frag = range.createContextualFragment(cardHTML)
    range.insertNode(frag)

    range.setStartAfter(ce2.querySelector('[data-pm-id="' + savedPm.id + '"]'))
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    updateNode(_workId, nid, {content: ce2.innerHTML})
    showToast(def.label + ' 卡片已创建')
  })
}

function openPhoneAppModalForCard(wid, nid, pmid, type, def, onClose) {
  var w = getWork(wid)
  if (!w) return

  var existingPm = pmid ? getPhoneModule(wid, pmid) : null
  var tempPd = createPhoneModuleDraftData(w, existingPm ? existingPm.data : null)
  var draft = createPhoneWorkDraft(Object.assign({}, w, { phoneData: tempPd }))

  var handlers = createPhoneModuleCloseHandlers({
    type: type,
    draft: draft,
    commit: function(pmData) {
      if (pmid) {
        var updatedPm = updatePhoneModule(wid, pmid, { data: pmData })
        if (updatedPm) showToast(def.label + ' 已保存')
        return updatedPm
      }
      return addPhoneModule(wid, { type: type, nodeId: nid, data: pmData })
    },
    onSaved: function(savedPm) {
      if (onClose) onClose(savedPm)
    },
    onEmpty: function() {
      if (!pmid) showToast('未添加内容，卡片未创建', 'info')
    },
    onError: function(error) {
      console.error('Failed to save phone module', error)
      showToast('保存失败，请重试', 'error')
    }
  })

  try {
    var overlay = openPhoneAppModal(draft.id, type, {
      beforeClose: handlers.beforeClose,
      afterClose: handlers.afterClose
    })
    if (!overlay) {
      draft.dispose()
      showToast('手机模块编辑器打开失败', 'error')
    }
  } catch (error) {
    draft.dispose()
    console.error('Failed to open phone module editor', error)
    showToast('手机模块编辑器打开失败', 'error')
  }
}

function showPhoneModuleMenu(wid, nid, pmid, btnEl) {
  // Remove any existing menu
  var existing = document.querySelector('.pm-context-menu')
  if (existing) existing.remove()

  var menu = document.createElement('div')
  menu.className = 'pm-context-menu'
  menu.innerHTML = '<button class="pm-menu-item" data-pm-act="edit">编辑</button><button class="pm-menu-item pm-menu-danger" data-pm-act="delete">删除</button>'
  menu.style.position = 'absolute'
  menu.style.zIndex = '9999'

  // Position near the hamburger button
  var rect = btnEl.getBoundingClientRect()
  menu.style.left = rect.left + 'px'
  menu.style.top = (rect.bottom + 4) + 'px'
  document.body.appendChild(menu)

  menu.addEventListener('click', function(ev) {
    var act = ev.target.dataset.pmAct
    if (act === 'edit') {
      menu.remove()
      var pm = getPhoneModule(wid, pmid)
      if (pm) {
        var type = pm.type
        var def = PHONE_APP_DEFS[type] || PHONE_APP_DEFS.messages
        openPhoneAppModalForCard(wid, nid, pmid, type, def, function(updatedPm) {
          // Update card label in content if still exists
          var card = document.querySelector('[data-pm-id="' + pmid + '"]')
          if (card) {
            var label = card.querySelector('.pm-card-label')
            if (label) label.textContent = (PHONE_APP_DEFS[type] || PHONE_APP_DEFS.messages).label || '模块'
          }
        })
      }
    } else if (act === 'delete') {
      menu.remove()
      if (confirm('确定删除此手机模块？')) {
        deletePhoneModule(wid, pmid)
        var card = document.querySelector('[data-pm-id="' + pmid + '"]')
        if (card) {
          card.parentNode.removeChild(card)
          var ce = document.getElementById('ce_' + nid)
          if (ce) updateNode(_workId, nid, {content: ce.innerHTML})
        }
        showToast('已删除')
      }
    }
  })

  // Close menu on outside click
  setTimeout(function() {
    document.addEventListener('click', function closeMenu(ev2) {
      if (!menu.contains(ev2.target)) {
        menu.remove()
        document.removeEventListener('click', closeMenu)
      }
    })
  }, 0)
}

// ====== Phone Module Card Event Delegation (document-level) ======
var _pmDragState = null
var _pmIndicator = null

function ensureDropIndicator() {
  if (!_pmIndicator) {
    _pmIndicator = document.createElement('div')
    _pmIndicator.className = 'pm-drop-indicator'
    _pmIndicator.style.display = 'none'
    document.body.appendChild(_pmIndicator)
  }
  return _pmIndicator
}

function updateDropIndicator(x, y) {
  var ce = document.getElementById('ce_' + _nodeId)
  if (!ce) ce = document.querySelector('.content-editable')
  if (!ce) return
  var ind = ensureDropIndicator()
  var dropRange = null
  if (document.caretRangeFromPoint) {
    dropRange = document.caretRangeFromPoint(x, y)
  } else if (document.caretPositionFromPoint) {
    var pos = document.caretPositionFromPoint(x, y)
    if (pos) { dropRange = document.createRange(); dropRange.setStart(pos.offsetNode, pos.offset); dropRange.collapse(true) }
  }
  if (dropRange && ce.contains(dropRange.startContainer)) {
    var rect = dropRange.getBoundingClientRect()
    ind.style.display = 'block'
    ind.style.left = rect.left + 'px'
    ind.style.top = (rect.top + 2) + 'px'
    ind.style.height = (rect.height - 4) + 'px'
  } else {
    ind.style.display = 'none'
  }
}

document.addEventListener('mousedown', function(e) {
  var card = e.target.closest('.pm-inline-card')
  if (!card) { _pmDragState = null; return }
  if (e.target.closest('.pm-card-hamburger')) { _pmDragState = null; return }
  e.preventDefault()

  _pmDragState = {
    card: card,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    rafId: null
  }
})

document.addEventListener('mousemove', function(e) {
  if (!_pmDragState) return
  var dx = e.clientX - _pmDragState.startX
  var dy = e.clientY - _pmDragState.startY
  if (!_pmDragState.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return

  if (!_pmDragState.moved) {
    _pmDragState.moved = true
    var card = _pmDragState.card
    card.classList.add('pm-card-dragging')
    card.style.opacity = '0.7'
    card.style.cursor = 'grabbing'
    // Remove from contenteditable, attach to body for smooth fixed-position tracking
    _pmDragState.placeholder = document.createComment('pm-placeholder')
    card.parentNode.insertBefore(_pmDragState.placeholder, card)
    card.parentNode.removeChild(card)
    document.body.appendChild(card)
    card.style.position = 'fixed'
    card.style.zIndex = '9999'
    card.style.pointerEvents = 'none'
    card.style.willChange = 'transform'
    card.style.left = '0'
    card.style.top = '0'
  }

  // Use rAF + translate3d for GPU-accelerated smooth movement
  if (_pmDragState.rafId) cancelAnimationFrame(_pmDragState.rafId)
  var self = _pmDragState
  _pmDragState.rafId = requestAnimationFrame(function() {
    self.card.style.transform = 'translate3d(' + (e.clientX - 70) + 'px,' + (e.clientY - 16) + 'px,0) scale(0.95)'
    updateDropIndicator(e.clientX, e.clientY)
  })
})

document.addEventListener('mouseup', function(e) {
  if (!_pmDragState) return
  if (_pmDragState.rafId) cancelAnimationFrame(_pmDragState.rafId)
  var card = _pmDragState.card
  var moved = _pmDragState.moved

  // Hide indicator
  if (_pmIndicator) _pmIndicator.style.display = 'none'

  // Restore card styles
  card.classList.remove('pm-card-dragging')
  card.style.opacity = ''
  card.style.cursor = ''
  card.style.position = ''
  card.style.left = ''
  card.style.top = ''
  card.style.zIndex = ''
  card.style.pointerEvents = ''
  card.style.willChange = ''
  card.style.transform = ''

  if (moved) {
    var ce = document.getElementById('ce_' + _nodeId)
    if (!ce) ce = document.querySelector('.content-editable')
    if (ce) {
      var dropRange = null
      if (document.caretRangeFromPoint) {
        dropRange = document.caretRangeFromPoint(e.clientX, e.clientY)
      } else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(e.clientX, e.clientY)
        if (pos) { dropRange = document.createRange(); dropRange.setStart(pos.offsetNode, pos.offset); dropRange.collapse(true) }
      }

      // Clean up placeholder
      if (_pmDragState.placeholder && _pmDragState.placeholder.parentNode) {
        _pmDragState.placeholder.parentNode.removeChild(_pmDragState.placeholder)
      }

      if (dropRange && ce.contains(dropRange.startContainer)) {
        // Anti-overlap: check if dropping inside another card
        var nearbyCard = dropRange.startContainer.nodeType === 1
          ? dropRange.startContainer.closest('.pm-inline-card')
          : dropRange.startContainer.parentElement?.closest?.('.pm-inline-card')
        if (nearbyCard && nearbyCard !== card) {
          nearbyCard.parentNode.insertBefore(card, nearbyCard.nextSibling)
        } else {
          dropRange.insertNode(card)
        }
      } else {
        // Fallback: put card back at original placeholder position
        if (_pmDragState.placeholder && _pmDragState.placeholder.parentNode) {
          // placeholder already removed above, use ce as fallback
        }
        ce.appendChild(card)
      }
      updateNode(_workId, ce.dataset.n, {content: ce.innerHTML})
    } else {
      if (_pmDragState.placeholder && _pmDragState.placeholder.parentNode) {
        _pmDragState.placeholder.parentNode.insertBefore(card, _pmDragState.placeholder.nextSibling)
        _pmDragState.placeholder.parentNode.removeChild(_pmDragState.placeholder)
      }
    }
    if (window.getSelection) window.getSelection().removeAllRanges()
  } else {
    if (!e.target.closest('.pm-card-hamburger')) {
      var pmid = card.dataset.pmId
      var type = card.dataset.pmType
      openPhoneAppModalForCard(_workId, _nodeId, pmid, type, PHONE_APP_DEFS[type] || PHONE_APP_DEFS.messages, function() {
        var card2 = document.querySelector('[data-pm-id="' + pmid + '"]')
        if (card2) {
          var label = card2.querySelector('.pm-card-label')
          if (label) label.textContent = (PHONE_APP_DEFS[type] || PHONE_APP_DEFS.messages).label || '模块'
        }
      })
    }
  }

  _pmDragState = null
})

// Auto-save content on input
document.addEventListener("input", function(e) {
  var ce = e.target.closest(".content-editable")
  if (!ce) return
  var nid = ce.dataset.n
  if (!nid || !_workId) return
  updateNode(_workId, nid, {content: ce.innerHTML})
  var wc = document.getElementById("wc_" + nid)
  if (wc) wc.textContent = ce.innerText.length
})
