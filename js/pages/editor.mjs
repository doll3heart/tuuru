// Tuuru Works - Article Editor (clean rewrite)
import { getWork, updateWork, addNode, updateNode, deleteNode, addChoice, updateChoice, deleteChoice, addScene, deleteScene, addPlaceholder, deletePlaceholder, uid, WORK_TYPE, PLACEHOLDER_MODE } from "../data.js"
import { navigate } from "../router.js"
import { showToast, renderHeader } from "../app.js"

// State
var _workId = null
var _nodeId = null

function esc(s) {
  if (!s) return ""
  var d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
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
  h += '<button data-a="im" title="图片">▣</button>'
  h += '<button data-a="au" title="音乐">♪</button>'
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

function buildToolbar(nid) {
  var h = '<div class="editor-toolbar">'
  var btns = [
    {a:"bold",l:"<b>B</b>"},{a:"italic",l:"<i>I</i>"},{a:"underline",l:"<u>U</u>"},{d:1},
    {a:"h2",l:"H2"},{a:"h3",l:"H3"},{a:"para",l:"P"},{d:1},
    {a:"ul",l:"UL"},{a:"ol",l:"OL"},{a:"hr",l:"HR"},{d:1},
    {a:"left",l:"左"},{a:"center",l:"中"},{a:"right",l:"右"}
  ]
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i]
    if (b.d) { h += '<div class="tb-divider"></div>'; continue }
    h += '<button data-a="' + b.a + '" data-n="' + nid + '">' + b.l + '</button>'
  }
  h += '</div>'
  return h
}

function buildContent(n) {
  var h = '<div class="editor-content">'
  h += '<div class="content-editable" id="ce_' + n.id + '" contenteditable="true" data-a="ce" data-n="' + n.id + '">' + (n.content || '') + '</div>'
  h += '</div>'
  return h
}

function buildWorldTree(w) {
  var ns = w.nodes || []
  var sc = w.scenes || []
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
      if (n.scene) {
        if (!grouped[n.scene]) grouped[n.scene] = []
        grouped[n.scene].push(n)
      } else {
        ungrouped.push(n)
      }
    }
    // Render scenes
    for (var si = 0; si < sc.length; si++) {
      var s = sc[si]
      var sceneNodes = grouped[s.id] || []
      h += '<div class="wt-chapter">'
      h += '<div class="wt-chapter-title" data-a="ts" data-w="+ w.id + " data-sid="' + s.id + '"><span class="arrow" id="arr_' + s.id + '">▶</span>' + esc(s.name) + '<button class='scene-del' data-a='ds' data-w="'+w.id+'" data-sid="'+s.id+'">X</button></div>'
      for (var ni = 0; ni < sceneNodes.length; ni++) {
        h += nodeHTML(w, sceneNodes[ni])
      }
      h += '</div>'
    }
    // Render ungrouped nodes
    if (ungrouped.length > 0) {
      h += '<div class="wt-chapter">'
      h += '<div class="wt-chapter-title"><span class="arrow">▶</span>默认</div>'
      for (var ui = 0; ui < ungrouped.length; ui++) {
        h += nodeHTML(w, ungrouped[ui])
      }
      h += '</div>'
    }
  }
  h += '</div></div>'
  return h
}

function nodeHTML(w, n) {
  var ac = n.id === _nodeId ? ' active' : ''
  var h = '<div class="wt-node' + ac + '" data-a="sl" data-w="' + w.id + '" data-n="' + n.id + '">'
  h += '<span class="dot"></span>'
  h += '<span class="node-label">' + esc(n.title || '节点') + '</span>'
  h += '<span class="node-actions">'
  h += '<button data-a="rn2" data-w="' + w.id + '" data-n="' + n.id + '" title="重命名">N</button>'
  h += '<button data-a="up" data-w="' + w.id + '" data-n="' + n.id + '" title="上移">▲</button>'
  h += '<button data-a="dn" data-w="' + w.id + '" data-n="' + n.id + '" title="下移">▼</button>'
  h += '<button data-a="dl" data-w="' + w.id + '" data-n="' + n.id + '" title="删除">X</button>'
  h += '</span></div>'
  return h
}

// ====== Event Delegation ======
document.addEventListener("click", handleClick)

function handleClick(e) {
  var b = e.target.closest("[data-a]")
  if (!b) return
  var a = b.dataset.a
  var w = b.dataset.w || _workId
  var n = b.dataset.n || _nodeId
  if (a === "an") {
    var nd = addNode(w)
    if (nd) { _nodeId = nd.id; refreshEditor(w) }
    return
  }
  if (a === "as") {
    var sn = prompt("章节名称:")
    if (sn) { addScene(w, sn); refreshEditor(w) }
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
    var nn = prompt("新名称:", nd ? nd.title : "")
    if (nn) { updateNode(w, n, {title: nn}); refreshEditor(w) }
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
  if (a === "ph" || a === "ch" || a === "im" || a === "au") {
    showToast("待开发")
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
  if (a === "ds") {
    var sid = b.dataset.sid
    if (sid && confirm("\u5220\u9664\u6b64\u573a\u666f\uff1f\u573a\u666f\u5185\u7684\u8282\u70b9\u5c06\u53d8\u4e3a\u672a\u5206\u7ec4")) {
      deleteScene(w, sid)
      refreshEditor(w)
    }
    return
  }
  // Formatting
  if (a === "bold") { fmt("bold"); return }
  if (a === "italic") { fmt("italic"); return }
  if (a === "underline") { fmt("underline"); return }
  if (a === "h2") { fmt("formatBlock", "<h2>"); return }
  if (a === "h3") { fmt("formatBlock", "<h3>"); return }
  if (a === "para") { fmt("formatBlock", "<p>"); return }
  if (a === "ul") { fmt("insertUnorderedList"); return }
  if (a === "ol") { fmt("insertOrderedList"); return }
  if (a === "hr") { fmt("insertHorizontalRule"); return }
  if (a === "left") { fmt("justifyLeft"); return }
  if (a === "center") { fmt("justifyCenter"); return }
  if (a === "right") { fmt("justifyRight"); return }
}

function getNode(wid, nid) {
  var w = getWork(wid)
  return w ? (w.nodes || []).find(function(x){ return x.id === nid }) : null
}

function moveNode(wid, nid, dir) {
  var w = getWork(wid)
  if (!w || !w.nodes) return
  var ns = w.nodes
  var i = ns.findIndex(function(x){ return x.id === nid })
  var t = i + dir
  if (t < 0 || t >= ns.length) return
  var tmp = ns[i]
  ns[i] = ns[t]
  ns[t] = tmp
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
