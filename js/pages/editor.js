// Tuuru Works - Article Editor (clean rewrite)
import { getWork, updateWork, addNode, updateNode, deleteNode, addScene, deleteScene, addPlaceholder, deletePlaceholder, updatePlaceholder, uid, WORK_TYPE, PLACEHOLDER_MODE, BUILTIN_FONTS, DEFAULT_EDITOR_SETTINGS, PH_PRESETS, PH_MODES, PHONE_APP_DEFS, addPhoneModule, updatePhoneModule, deletePhoneModule, getPhoneModulesByNode, getPhoneModule } from "../data.js"
import { navigate } from "../router.js"
import { showToast, renderHeader, modal } from "../app.js"
import { createPhoneWorkDraft } from "../phone-work-access.js"
import { createPhoneModuleCloseHandlers, createPhoneModuleDraftData } from "../phone-module-draft.js"
import { applyEditorMobilePane, isBoundedEditorViewport } from "../editor-mobile-pane.js"
import { createEditorOutlineMenuController } from "../editor-outline-menu.js"
import { createEditorPhoneModuleDragController } from "../editor-phone-module-drag.js"
import { createEditorNodeDragController } from "../editor-node-drag.js"
import { reorderArticleNode } from "../article-node-reorder.js"
import { describeArticleTarget, reconcileArticleChoices } from "../article-choice-model.js"
import { openPhoneAppModal } from "./phone.js"
import { activateEditorCustomFonts, editorFontFormat, editorFontValue, installEditorCustomFonts, upsertEditorCustomFont } from "../editor-custom-fonts.js"
import { deleteEditorFontAsset, persistEditorFontAsset, resolveEditorFontAssets } from "../editor-font-storage.js"
import { compressEditorImage } from "../image-compression.js"
import { searchArticleWork } from "../article-work-search.js"
import { createEditorSplitPaneController, readEditorSplitPreference } from "../editor-split-pane.js"

// State
var _workId = null
var _nodeId = null
var _mobilePane = "editor"
var _pendingMobileFocus = null
var _outlineActionMenu = createEditorOutlineMenuController(document)
var _phoneModuleDragController = null
var _nodeDragController = null
var _articleTargetPick = null
var _articleTargetInspect = null
var _splitPaneController = null

function esc(s) {
  if (!s) return ""
  var d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

function countEditorCharacters(value) {
  if (typeof value === "string") {
    var template = document.createElement("template")
    template.innerHTML = value
    return (template.content.textContent || "").length
  }
  return (value?.textContent || "").length
}

function formatEditorCharacterCount(value) {
  return countEditorCharacters(value) + " 字"
}

function showPrompt(title, placeholder, cb, onCancel) {
  var ov = modal(title, '<div class="form-group"><input id="pI" class="form-input" placeholder="' + esc(placeholder) + '"></div>', '<button id="pK" class="btn btn-primary">\u786e\u5b9a</button>', function() { onCancel?.() })
  document.getElementById("pK").onclick = function() {
    var v = document.getElementById("pI")?.value?.trim() || ""
    if (!v) {
      ov.remove()
      onCancel?.()
      return
    }
    cb(v)
    ov.remove()
  }
  document.getElementById("pI")?.focus()
}

function showConfirm(title, msg, cb, onCancel) {
  var ov = modal(title, '<p>' + esc(msg) + '</p>', '<button id="cK" class="btn btn-danger">\u786e\u5b9a</button><button id="cN" class="btn btn-ghost">\u53d6\u6d88</button>', function() { onCancel?.() })
  document.getElementById("cK").onclick = function() { cb(true); ov.remove() }
  document.getElementById("cN").onclick = function() { ov.remove(); onCancel?.() }
  document.getElementById("cN")?.focus()
}


export function renderEditor(wid) {
  _phoneModuleDragController?.reset("refresh")
  _nodeDragController?.reset("refresh")
  _outlineActionMenu.reset()
  if (_workId !== wid) {
    _mobilePane = "editor"
    _pendingMobileFocus = null
    _articleTargetPick = null
    _articleTargetInspect = null
  }
  _workId = wid
  var w = getWork(wid)
  if (!w) return '<div class="app-main"><div class="empty-state"><h3>作品未找到</h3></div></div>'
  loadEditorCustomFonts(wid, w.editorSettings?.customFonts)
  var ns = w.nodes || []
  if (!_nodeId || !ns.find(function(n){ return n.id === _nodeId })) {
    _nodeId = ns.length ? ns[0].id : null
  }
  if (!_nodeId) _mobilePane = "outline"
  var L = buildIconbar(wid)
  var E = buildEditor(w, _nodeId)
  var W = buildWorldTree(w)
  var M = buildMobileCommandbar(wid, _nodeId)
  var split = readEditorSplitPreference(globalThis.localStorage)
  var splitState = split.collapsed ? ' data-outline-collapsed="true"' : ''
  if (split.collapsed && _articleTargetPick) splitState += ' data-outline-overlay="true"'
  var divider = '<div class="editor-splitter" data-editor-splitter role="separator" aria-label="调整正文与作品结构宽度" aria-orientation="vertical" aria-valuemin="180" aria-valuemax="520" aria-valuenow="' + split.width + '" tabindex="0"><span aria-hidden="true"></span></div>'
  var reopen = '<button type="button" class="editor-outline-reopen" data-editor-outline-reopen data-a="outline-reopen" aria-label="打开作品结构">结构</button>'
  return '<div class="editor-page"><div class="editor-body-area" data-mobile-pane="' + _mobilePane + '"' + splitState + ' style="--editor-outline-width:' + split.width + 'px">' + L + buildMobileViewSwitch() + E + divider + W + reopen + M + '</div></div>'
}

function buildMobileViewSwitch() {
  var editorPressed = _mobilePane === "editor" ? "true" : "false"
  var outlinePressed = _mobilePane === "outline" ? "true" : "false"
  var h = '<div class="editor-mobile-view-switch" role="group" aria-label="编辑器视图">'
  h += '<button type="button" data-a="mobile-pane" data-pane="editor" aria-controls="articleEditorPane" aria-pressed="' + editorPressed + '">正文</button>'
  h += '<button type="button" data-a="mobile-pane" data-pane="outline" aria-controls="articleOutlinePane" aria-pressed="' + outlinePressed + '">结构</button>'
  h += '</div>'
  return h
}

function buildMobileCommandbar(wid, nid) {
  var es = getSettings(wid)
  var editorToolsDisabled = _mobilePane === "editor" && nid ? "" : " disabled"
  var h = '<div class="editor-mobile-commandbar" aria-label="移动端编辑工具">'
  h += '<div class="editor-mobile-dock" role="group" aria-label="写作工具">'
  h += '<button type="button" data-a="mobile-tools" data-panel="format" data-mobile-editor-tool aria-label="文字格式" aria-controls="mobileFormatPanel" aria-expanded="false"' + editorToolsDisabled + '><span aria-hidden="true">Aa</span></button>'
  h += '<button type="button" data-a="mobile-tools" data-panel="insert" data-mobile-editor-tool aria-label="插入内容" aria-controls="mobileInsertPanel" aria-expanded="false"' + editorToolsDisabled + '><span aria-hidden="true">＋</span></button>'
  h += '<button type="button" data-a="undo" data-n="' + nid + '" aria-label="撤回" title="撤回"' + editorToolsDisabled + '><span aria-hidden="true">↶</span></button>'
  h += '<button type="button" data-a="redo" data-n="' + nid + '" aria-label="重做" title="重做"' + editorToolsDisabled + '><span aria-hidden="true">↷</span></button>'
  h += '<span class="editor-mobile-save-state" aria-live="polite">已保存</span>'
  h += '</div>'

  h += '<section class="editor-mobile-tool-panel" id="mobileInsertPanel" data-mobile-tool-panel="insert" aria-label="插入内容" hidden>'
  h += '<div class="editor-mobile-tool-head"><strong>插入内容</strong><button type="button" data-a="mobile-tools-close" data-panel="insert">完成</button></div>'
  h += '<div class="editor-mobile-insert-grid">'
  h += '<button type="button" data-a="ph" data-w="' + wid + '"><span aria-hidden="true">{}</span><span>占位符</span></button>'
  h += '<button type="button" data-a="ch" data-w="' + wid + '"><span aria-hidden="true">⇄</span><span>选项</span></button>'
  h += '<button type="button" data-a="im"><span aria-hidden="true">＋</span><span>图片</span></button>'
  h += '<button type="button" data-a="pa-msg" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.messages.icon + '</span><span>消息</span></button>'
  h += '<button type="button" data-a="pa-forum" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.forum.icon + '</span><span>论坛</span></button>'
  h += '<button type="button" data-a="pa-memo" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.memo.icon + '</span><span>备忘</span></button>'
  h += '<button type="button" data-a="pa-gallery" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.gallery.icon + '</span><span>相册</span></button>'
  h += '<button type="button" data-a="pa-browser" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.browser.icon + '</span><span>浏览器</span></button>'
  h += '<button type="button" data-a="pa-shop" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.shopping.icon + '</span><span>购物</span></button>'
  h += '<button type="button" data-a="pa-contacts" data-w="' + wid + '"><span aria-hidden="true">' + PHONE_APP_DEFS.contacts.icon + '</span><span>联系人</span></button>'
  h += '</div></section>'

  h += '<section class="editor-mobile-tool-panel" id="mobileFormatPanel" data-mobile-tool-panel="format" aria-label="文字格式" hidden>'
  h += '<div class="editor-mobile-tool-head"><strong>文字格式</strong><button type="button" data-a="mobile-tools-close" data-panel="format">完成</button></div>'
  h += '<div class="editor-mobile-format-buttons" role="group" aria-label="文字样式与对齐">'
  h += '<button type="button" data-a="bold" data-n="' + nid + '" aria-label="加粗"><b>B</b></button>'
  h += '<button type="button" data-a="italic" data-n="' + nid + '" aria-label="斜体"><i>I</i></button>'
  h += '<button type="button" data-a="underline" data-n="' + nid + '" aria-label="下划线"><u>U</u></button>'
  h += '<button type="button" data-a="left" data-n="' + nid + '" aria-label="左对齐">左</button>'
  h += '<button type="button" data-a="center" data-n="' + nid + '" aria-label="居中对齐">中</button>'
  h += '<button type="button" data-a="right" data-n="' + nid + '" aria-label="右对齐">右</button>'
  h += '</div>'
  h += '<div class="editor-mobile-format-settings">'
  h += '<label class="editor-mobile-setting-field is-wide"><span>字体</span><select class="toolbar-setting" data-a="fs-font" aria-label="字体"><option value="">字体</option>'
  for (var fi = 0; fi < BUILTIN_FONTS.length; fi++) {
    var bf = BUILTIN_FONTS[fi]
    h += '<option value="' + esc(bf.value) + '"' + ((es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily) === bf.value ? ' selected' : '') + '>' + esc(bf.name) + '</option>'
  }
  var customFonts = es.customFonts || []
  for (var cfi = 0; cfi < customFonts.length; cfi++) {
    var customFont = customFonts[cfi]
    h += '<option value="' + esc(customFont.value) + '"' + (es.fontFamily === customFont.value ? ' selected' : '') + '>' + esc(customFont.name) + '</option>'
  }
  h += '<option value="__custom__">+ 导入字体…</option></select></label>'
  h += '<label class="editor-mobile-setting-field"><span>字号</span><select class="toolbar-setting" data-a="fs-size" aria-label="字号">'
  var sizes = [12,14,16,18,20,22,24,28,32]
  for (var si = 0; si < sizes.length; si++) {
    h += '<option value="' + sizes[si] + '"' + (es.fontSize === sizes[si] ? ' selected' : '') + '>' + sizes[si] + 'px</option>'
  }
  h += '</select></label>'
  h += '<label class="editor-mobile-setting-field"><span>行距</span><select class="toolbar-setting" data-a="fs-lh" aria-label="行间距">'
  var lineHeights = [1.4,1.6,1.8,1.9,2.0,2.2,2.5]
  for (var li = 0; li < lineHeights.length; li++) {
    h += '<option value="' + lineHeights[li] + '"' + (es.lineHeight === lineHeights[li] ? ' selected' : '') + '>' + lineHeights[li] + '</option>'
  }
  h += '</select></label>'
  h += '<label class="editor-mobile-setting-field"><span>字距</span><input class="toolbar-number" data-a="fs-ls" type="number" min="0" max="10" step="0.5" aria-label="字间距" value="' + (es.letterSpacing || 0) + '"></label>'
  h += '<label class="editor-mobile-setting-field editor-mobile-indent"><input type="checkbox" data-a="fs-indent"' + (es.indentFirstLine ? ' checked' : '') + '><span>段首缩进</span></label>'
  h += '<fieldset class="editor-mobile-margin-settings"><legend>页边距</legend>'
  h += '<label><span>上</span><input class="margin-num" data-a="fs-mt" type="number" min="0" max="120" aria-label="上边距" value="' + (es.marginTop || 24) + '"></label>'
  h += '<label><span>右</span><input class="margin-num" data-a="fs-mr" type="number" min="0" max="120" aria-label="右边距" value="' + (es.marginRight || 32) + '"></label>'
  h += '<label><span>下</span><input class="margin-num" data-a="fs-mb" type="number" min="0" max="120" aria-label="下边距" value="' + (es.marginBottom || 24) + '"></label>'
  h += '<label><span>左</span><input class="margin-num" data-a="fs-ml" type="number" min="0" max="120" aria-label="左边距" value="' + (es.marginLeft || 32) + '"></label>'
  h += '</fieldset></div></section></div>'
  return h
}

function closeMobileToolPanels(shell, restoreFocus) {
  if (!shell) return false
  var openPanel = shell.querySelector('[data-mobile-tool-panel]:not([hidden])')
  var panelName = openPanel?.dataset.mobileToolPanel
  shell.querySelectorAll('[data-mobile-tool-panel]').forEach(function(panel) { panel.hidden = true })
  shell.querySelectorAll('[data-a="mobile-tools"]').forEach(function(trigger) { trigger.setAttribute("aria-expanded", "false") })
  shell.removeAttribute("data-mobile-tools")
  if (restoreFocus && panelName) shell.querySelector('[data-a="mobile-tools"][data-panel="' + panelName + '"]')?.focus()
  return Boolean(openPanel)
}

function toggleMobileToolPanel(shell, panelName) {
  if (!shell || (panelName !== "insert" && panelName !== "format")) return false
  var panel = shell.querySelector('[data-mobile-tool-panel="' + panelName + '"]')
  var trigger = shell.querySelector('[data-a="mobile-tools"][data-panel="' + panelName + '"]')
  if (!panel || !trigger || trigger.disabled) return false
  var shouldOpen = panel.hidden
  closeMobileToolPanels(shell, false)
  if (shouldOpen) {
    panel.hidden = false
    trigger.setAttribute("aria-expanded", "true")
    shell.dataset.mobileTools = panelName
  }
  return true
}

function updateMobileEditorToolAvailability(shell, pane) {
  shell?.querySelectorAll('[data-mobile-editor-tool]').forEach(function(control) {
    control.disabled = pane !== "editor" || !_nodeId
  })
}

function prepareMobilePaneRefresh(pane, restoreFocus) {
  _mobilePane = pane
  _pendingMobileFocus = restoreFocus && isBoundedEditorViewport() ? pane : null
}

function restorePendingMobilePaneFocus(root) {
  var pane = _pendingMobileFocus
  _pendingMobileFocus = null
  if (!pane || !isBoundedEditorViewport()) return
  var control = root?.querySelector('[data-a="mobile-pane"][data-pane="' + pane + '"]')
  if (control) control.focus()
}

function restoreOutlineActionFocus(disclosure, actionControl) {
  var target = disclosure?.isConnected ? disclosure : actionControl?.isConnected ? actionControl : null
  target?.focus()
}

function buildIconbar(wid) {
  var h = '<div class="editor-iconbar">'
  h += '<button type="button" data-a="ph" data-w="' + wid + '" title="占位符" aria-label="插入占位符">{}</button>'
  h += '<button type="button" data-a="ch" data-w="' + wid + '" title="选项" aria-label="编辑选项">⇄</button>'
  h += '<div class="divider"></div>'
  h += '<button type="button" data-a="im" title="图片" aria-label="插入图片">+</button>'
  h += '<div class="divider"></div>'
  h += '<button type="button" data-a="pa-msg" data-w="' + wid + '" title="消息" aria-label="插入消息模块">' + PHONE_APP_DEFS.messages.icon + '</button>'
  h += '<button type="button" data-a="pa-forum" data-w="' + wid + '" title="论坛" aria-label="插入论坛模块">' + PHONE_APP_DEFS.forum.icon + '</button>'
  h += '<button type="button" data-a="pa-memo" data-w="' + wid + '" title="备忘" aria-label="插入备忘模块">' + PHONE_APP_DEFS.memo.icon + '</button>'
  h += '<button type="button" data-a="pa-gallery" data-w="' + wid + '" title="相册" aria-label="插入相册模块">' + PHONE_APP_DEFS.gallery.icon + '</button>'
  h += '<button type="button" data-a="pa-browser" data-w="' + wid + '" title="浏览" aria-label="插入浏览器模块">' + PHONE_APP_DEFS.browser.icon + '</button>'
  h += '<button type="button" data-a="pa-shop" data-w="' + wid + '" title="购物" aria-label="插入购物模块">' + PHONE_APP_DEFS.shopping.icon + '</button>'
  h += '<button type="button" data-a="pa-contacts" data-w="' + wid + '" title="联系人" aria-label="编辑联系人">' + PHONE_APP_DEFS.contacts.icon + '</button>'
  h += '</div>'
  return h
}

function buildEditor(w, nid) {
  var n = (w.nodes || []).find(function(x){ return x.id === nid })
  if (!n) return '<div class="editor-area" id="articleEditorPane"><div class="editor-empty">选择一个节点开始编辑</div></div>'
  var h = '<div class="editor-area" id="articleEditorPane">'
  if (_articleTargetInspect && _articleTargetInspect.workId === w.id) {
    var inspected = describeArticleTarget(w, n.id)
    h += '<div class="article-target-return"><span><b>正在查看目标</b>' + esc(inspected.ok ? inspected.pathLabel : (n.title || '节点')) + '</span><button type="button" data-a="target-return" data-w="' + w.id + '">返回选项设置</button></div>'
  }
  h += buildHeader(w, n)
  h += buildToolbar(nid)
  h += buildContent(n)
  h += '</div>'
  return h
}

function buildHeader(w, n) {
  var sc = w.scenes || []
  var h = '<div class="editor-header">'
  h += '<input class="node-name" id="nt_' + n.id + '" value="' + esc(n.title || '') + '" placeholder="节点标题" aria-label="节点标题" data-a="rn" data-n="' + n.id + '">'
  h += '<div class="editor-actions">'
  h += '<select data-a="ss" data-n="' + n.id + '" aria-label="节点场景"><option value="">场景</option>'
  for (var i = 0; i < sc.length; i++) {
    var s = sc[i]
    h += '<option value="' + s.id + '"' + (n.scene === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'
  }
  h += '</select>'
  h += '</div>'
  h += '<span class="word-count" id="wc_' + n.id + '">' + formatEditorCharacterCount(n.content || '') + '</span>'
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

  var h = '<div class="editor-toolbar"><div class="editor-toolbar-scroll">'
  // Editing history
  h += '<button type="button" data-a="undo" data-n="' + nid + '" title="撤回" aria-label="撤回"><span aria-hidden="true">↶</span></button>'
  h += '<button type="button" data-a="redo" data-n="' + nid + '" title="重做" aria-label="重做"><span aria-hidden="true">↷</span></button>'
  h += '<div class="tb-divider"></div>'
  // Text style buttons
  h += '<button type="button" data-a="bold" data-n="' + nid + '" title="加粗" aria-label="加粗"><b>B</b></button>'
  h += '<button type="button" data-a="italic" data-n="' + nid + '" title="斜体" aria-label="斜体"><i>I</i></button>'
  h += '<button type="button" data-a="underline" data-n="' + nid + '" title="下划线" aria-label="下划线"><u>U</u></button>'
  h += '<div class="tb-divider"></div>'

  // Alignment
  h += '<button type="button" data-a="left" data-n="' + nid + '" title="左对齐" aria-label="左对齐">左</button>'
  h += '<button type="button" data-a="center" data-n="' + nid + '" title="居中" aria-label="居中对齐">中</button>'
  h += '<button type="button" data-a="right" data-n="' + nid + '" title="右对齐" aria-label="右对齐">右</button>'
  h += '<div class="tb-divider"></div>'

  // Font family
  h += '<select class="toolbar-setting" data-a="fs-font" title="字体" aria-label="字体"><option value="">字体</option>'
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
  h += '<select class="toolbar-setting" data-a="fs-size" title="字号" aria-label="字号"><option value="">字号</option>'
  var sizes = [12,14,16,18,20,22,24,28,32]
  for (var si = 0; si < sizes.length; si++) {
    var sz = sizes[si]
    h += '<option value="' + sz + '"' + (es.fontSize === sz ? ' selected' : '') + '>' + sz + 'px</option>'
  }
  h += '</select>'

  // Line height
  h += '<select class="toolbar-setting" data-a="fs-lh" title="行间距" aria-label="行间距"><option value="">行距</option>'
  var lhs = [1.4,1.6,1.8,1.9,2.0,2.2,2.5]
  for (var li = 0; li < lhs.length; li++) {
    var lh = lhs[li]
    h += '<option value="' + lh + '"' + (es.lineHeight === lh ? ' selected' : '') + '>' + lh + '</option>'
  }
  h += '</select>'

  // Letter spacing
  h += '<span class="toolbar-setting-group" title="字间距">'
  h += '<span class="toolbar-label">字距</span>'
  h += '<input class="toolbar-number" data-a="fs-ls" type="number" min="0" max="10" step="0.5" aria-label="字间距" value="' + (es.letterSpacing || 0) + '">px'
  h += '</span>'

  // Indent checkbox
  h += '<label class="toolbar-checkbox" title="段首缩进">'
  h += '<input type="checkbox" data-a="fs-indent"' + (es.indentFirstLine ? ' checked' : '') + '> 缩进'
  h += '</label>'

  // Margin trigger stays in the horizontal rail; its panel is a sibling outside the clipping layer.
  h += '<button type="button" class="toolbar-margin-trigger" data-a="fs-margin-toggle" title="页边距" aria-label="页边距" aria-controls="marginPopover" aria-expanded="false">边距</button>'
  h += '</div>'
  h += '<div class="margin-popover" id="marginPopover" role="group" aria-label="页边距设置">'
  h += '<span class="margin-grid">'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>上</label><input class="margin-num" data-a="fs-mt" type="number" min="0" max="120" aria-label="上边距" value="' + (es.marginTop || 24) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>左</label><input class="margin-num" data-a="fs-ml" type="number" min="0" max="120" aria-label="左边距" value="' + (es.marginLeft || 32) + '"></span>'
  h += '<span class="margin-center">边距</span>'
  h += '<span class="margin-cell"><label>右</label><input class="margin-num" data-a="fs-mr" type="number" min="0" max="120" aria-label="右边距" value="' + (es.marginRight || 32) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '<span class="margin-cell"><label>下</label><input class="margin-num" data-a="fs-mb" type="number" min="0" max="120" aria-label="下边距" value="' + (es.marginBottom || 24) + '"></span>'
  h += '<span class="margin-empty"></span>'
  h += '</span>'
  h += '</div>'
  h += '</div>'
  return h
}

function positionMarginPopover(trigger, popover) {
  var toolbar = trigger?.closest(".editor-toolbar")
  if (!toolbar || !popover) return
  var triggerRect = trigger.getBoundingClientRect()
  var toolbarRect = toolbar.getBoundingClientRect()
  var edge = 8
  var maxLeft = Math.max(edge, toolbarRect.width - popover.offsetWidth - edge)
  var left = Math.min(Math.max(triggerRect.left - toolbarRect.left, edge), maxLeft)
  popover.style.setProperty("--margin-popover-left", Math.round(left) + "px")
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
  var targetPick = _articleTargetPick && _articleTargetPick.workId === w.id ? _articleTargetPick : null
  var h = '<div class="world-tree' + (targetPick ? ' target-pick-mode' : '') + '" id="articleOutlinePane"' + (targetPick ? ' data-target-purpose="' + esc(targetPick.purpose) + '"' : '') + '>'
  if (targetPick) {
    h += '<div class="target-picker-head"><div><strong>选择目标节点</strong><small>' + (targetPick.purpose === 'start' ? '设置故事起点' : '给当前选项指定去向') + '</small></div>'
    h += '<button type="button" data-a="target-cancel" data-w="' + w.id + '" aria-label="取消选择目标">取消</button></div>'
    h += '<div class="target-picker-search-wrap"><input type="search" class="target-picker-search" aria-label="搜索目标节点" placeholder="搜索章节或节点"></div>'
  } else {
    h += '<div class="wt-header"><span>节点列表</span><div>'
    h += '<button type="button" data-a="outline-overlay-close" aria-label="收起作品结构" title="收起作品结构" class="wt-overlay-close">×</button>'
    h += '<button type="button" data-a="pick-start" data-w="' + w.id + '" aria-label="选择故事起点" title="选择故事起点">起点</button>'
    h += '<button type="button" data-a="as" data-w="' + w.id + '" aria-label="添加章节"><span class="wt-action-label-desktop">+章</span><span class="wt-action-label-mobile">+章节</span></button>'
    h += '<button type="button" data-a="an" data-w="' + w.id + '" aria-label="添加节点"><span class="wt-action-label-desktop">+</span><span class="wt-action-label-mobile">+节点</span></button></div></div>'
    h += '<div class="wt-chapter-create" hidden>'
    h += '<input type="text" maxlength="40" aria-label="新章节名称" placeholder="输入章节名称">'
    h += '<button type="button" data-a="chapter-create-confirm" data-w="' + w.id + '">添加</button>'
    h += '<button type="button" data-a="chapter-create-cancel">取消</button>'
    h += '</div>'
    h += '<div class="work-search"><label><span class="sr-only">搜索当前作品</span><input type="search" data-work-search autocomplete="off" placeholder="搜索标题、正文或选项" aria-label="搜索当前作品"></label><div class="work-search-results" data-work-search-results hidden></div></div>'
  }
  h += '<div class="wt-body">'
  if (ns.length === 0) {
    h += '<div class="wt-empty">暂无节点</div>'
  } else {
    // Group nodes by scene
    var grouped = {}
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i]
      var cid = n.chapterId || ""
      if (!grouped[cid]) grouped[cid] = []
      grouped[cid].push(n)
    }
    var nodeActionIndex = 0
    // Render scenes
    for (var ci = 0; ci < ch.length; ci++) {
      var chs = ch[ci]
      var chid = chs.id
      var cNodes = grouped[chid] || []
      var chapterContentId = 'wtChapterContent_' + ci
      var chapterActionPanelId = 'wtChapterActions_' + ci
      var chapterActionLabel = '章节操作：' + (chs.name || '未命名章节')
      h += '<div class="wt-chapter" data-node-drop-chapter data-chapter-id="' + esc(chid) + '">'
      h += '<div class="wt-chapter-title" data-outline-action-host>'
      h += '<button type="button" class="wt-chapter-toggle" data-a="ts" data-w="' + w.id + '" data-sid="' + chid + '" aria-expanded="true" aria-controls="' + chapterContentId + '">'
      h += '<span class="arrow open" id="arr_' + chid + '" aria-hidden="true">\u25b6</span><span class="chapter-name">' + esc(chs.name) + '</span><span class="chapter-count">' + cNodes.length + ' 节</span></button>'
      h += '<button type="button" class="wt-action-disclosure" data-a="outline-actions" aria-expanded="false" aria-controls="' + chapterActionPanelId + '" aria-label="' + esc(chapterActionLabel) + '"><span aria-hidden="true">\u22ef</span></button>'
      h += '<span class="chapter-actions wt-action-panel" id="' + chapterActionPanelId + '" role="group" aria-label="' + esc(chapterActionLabel) + '"><button type="button" data-a="chapter-rename" data-w="' + w.id + '" data-sid="' + chid + '" title="重命名章节" aria-label="重命名章节">\u270e</button><button type="button" data-a="chapter-delete" data-w="' + w.id + '" data-sid="' + chid + '" title="删除章节" aria-label="删除章节">\u2715</button></span></div>'
      h += '<div class="wt-chapter-content" id="' + chapterContentId + '" data-node-drop-chapter data-chapter-id="' + esc(chid) + '">'
      for (var ni = 0; ni < cNodes.length; ni++) {
        h += nodeHTML(w, cNodes[ni], nodeActionIndex++, targetPick)
        var cnode = cNodes[ni]
        if (!targetPick && cnode.choices && cnode.choices.length) {
          for (var cci = 0; cci < cnode.choices.length; cci++) {
            var cc = cnode.choices[cci]
            h += '<button type="button" class="wt-choice" data-a="sl" data-w="' + w.id + '" data-n="' + (cc.targetId || '') + '">'
            h += '<span class="wt-choice-arrow" aria-hidden="true">\u21b3</span>'
            h += '<span class="wt-choice-text">' + esc(cc.text || '选项') + '</span>'
            h += '</button>'
          }
        }
      }
      h += '</div></div>'
    }
    var uncid = grouped[""] || []
    if (uncid.length) h += '<div class="wt-ungrouped" data-node-drop-chapter data-chapter-id="">'
    for (var ui = 0; ui < uncid.length; ui++) {
      h += nodeHTML(w, uncid[ui], nodeActionIndex++, targetPick)
    }
    if (uncid.length) h += '</div>'
  }
  h += '</div></div>'
  return h
}

function nodeHTML(w, n, actionIndex, targetPick) {
  var ac = n.id === _nodeId ? ' active' : ''
  var current = n.id === _nodeId ? ' aria-current="true"' : ''
  var ch = w.chapters || []
  var curCid = n.chapterId || ""
  var canMoveChapter = ch.some(function(c) { return c.id !== curCid })
  var siblings = (w.nodes || []).filter(function(node) { return (node.chapterId || "") === curCid })
  var siblingIndex = siblings.findIndex(function(node) { return node.id === n.id })
  var canMoveUp = siblingIndex > 0
  var canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1
  var actionPanelId = 'wtNodeActions_' + actionIndex
  var actionLabel = '节点操作：' + (n.title || '未命名节点')
  var targetDescription = describeArticleTarget(w, n.id)
  var targetPath = targetDescription.ok ? targetDescription.pathLabel : (n.title || '未命名节点')
  var h = '<div class="wt-node' + ac + '" data-outline-action-host data-node-id="' + esc(n.id) + '" data-chapter-id="' + esc(curCid) + '">'
  if (targetPick) {
    h += '<button type="button" class="wt-node-target-select" data-a="target-select" data-w="' + w.id + '" data-n="' + esc(n.id) + '" data-target-path="' + esc(targetPath.toLowerCase()) + '">'
    h += '<span class="dot" aria-hidden="true"></span><span class="node-label">' + esc(targetPath) + '</span>'
    if (w.startNode === n.id) h += '<span class="wt-start-badge">起点</span>'
    h += '</button></div>'
    return h
  }
  h += '<button type="button" class="wt-node-drag-handle" aria-label="拖动节点「' + esc(n.title || '节点') + '」排序" title="拖动排序"><span aria-hidden="true">⠿</span></button>'
  h += '<button type="button" class="wt-node-select" data-a="sl" data-w="' + w.id + '" data-n="' + n.id + '"' + current + '>'
  h += '<span class="dot" aria-hidden="true"></span>'
  h += '<span class="node-label">' + esc(n.title || '节点') + '</span>'
  if (w.startNode === n.id) h += '<span class="wt-start-badge">起点</span>'
  h += '</button>'
  h += '<button type="button" class="wt-action-disclosure" data-a="outline-actions" aria-expanded="false" aria-controls="' + actionPanelId + '" aria-label="' + esc(actionLabel) + '"><span aria-hidden="true">\u22ef</span></button>'
  h += '<span class="node-actions wt-action-panel" id="' + actionPanelId + '" role="group" aria-label="' + esc(actionLabel) + '">'
  h += '<select class="chapter-move" data-a="mc" data-w="' + w.id + '" data-n="' + n.id + '" title="移动到章节" aria-label="移动节点到章节"' + (canMoveChapter ? '' : ' disabled') + '><option value="">移至…</option>'
  for (var ci = 0; ci < ch.length; ci++) {
    var c = ch[ci]
    if (c.id !== curCid) {
      h += '<option value="' + c.id + '">' + esc(c.name) + '</option>'
    }
  }
  h += '</select>'
  h += '<button type="button" data-a="rn2" data-w="' + w.id + '" data-n="' + n.id + '" title="重命名" aria-label="重命名节点">\u270e</button>'
  h += '<button type="button" data-a="up" data-w="' + w.id + '" data-n="' + n.id + '" title="上移" aria-label="上移节点"' + (canMoveUp ? '' : ' disabled') + '>\u25b2</button>'
  h += '<button type="button" data-a="dn" data-w="' + w.id + '" data-n="' + n.id + '" title="下移" aria-label="下移节点"' + (canMoveDown ? '' : ' disabled') + '>\u25bc</button>'
  h += '<button type="button" data-a="dl" data-w="' + w.id + '" data-n="' + n.id + '" title="删除" aria-label="删除节点">\u2715</button>'
  h += '</span></div>'
  return h
}

// ====== Event Delegation ======
document.addEventListener("click", handleClick)
document.addEventListener("change", handleChange)

function handleClick(e) {
  var phoneModuleCard = e.target.closest(".pm-inline-card")
  if (phoneModuleCard && !e.target.closest(".pm-card-hamburger")) {
    if (_phoneModuleDragController?.consumeClick(phoneModuleCard, e)) {
      e.preventDefault()
      return
    }
    var phoneModuleId = phoneModuleCard.dataset.pmId
    var phoneModuleType = phoneModuleCard.dataset.pmType
    var phoneModuleEditable = phoneModuleCard.closest(".content-editable")
    var phoneModuleNodeId = phoneModuleEditable?.dataset.n || _nodeId
    if (phoneModuleId && phoneModuleType && phoneModuleNodeId) {
      openPhoneAppModalForCard(_workId, phoneModuleNodeId, phoneModuleId, phoneModuleType, PHONE_APP_DEFS[phoneModuleType] || PHONE_APP_DEFS.messages, function() {
        var updatedCard = document.querySelector('[data-pm-id="' + phoneModuleId + '"]')
        var updatedLabel = updatedCard?.querySelector(".pm-card-label")
        if (updatedLabel) updatedLabel.textContent = (PHONE_APP_DEFS[phoneModuleType] || PHONE_APP_DEFS.messages).label || "模块"
      })
    }
    return
  }
  var b = e.target.closest("[data-a]")
  if (!b) return
  var outlineActionTrigger = b.tagName === "BUTTON" ? _outlineActionMenu.closeForAction(b) : null
  var a = b.dataset.a
  var w = b.dataset.w || _workId
  var n = b.dataset.n || _nodeId
  var mobileShell = b.closest(".editor-body-area")
  if (a === "outline-reopen") {
    _splitPaneController?.openOverlay(mobileShell)
    mobileShell?.querySelector("[data-work-search]")?.focus()
    return
  }
  if (a === "outline-overlay-close") {
    _splitPaneController?.closeOverlay(mobileShell)
    mobileShell?.querySelector("[data-editor-outline-reopen]")?.focus()
    return
  }
  if (a === "search-node") {
    if (!getNode(w, n)) return
    _nodeId = n
    _mobilePane = "editor"
    _splitPaneController?.closeOverlay(mobileShell)
    prepareMobilePaneRefresh("editor", true)
    refreshEditor(w)
    return
  }
  if (a === "mobile-tools") {
    toggleMobileToolPanel(mobileShell, b.dataset.panel)
    return
  }
  if (a === "mobile-tools-close") {
    closeMobileToolPanels(mobileShell, true)
    return
  }
  if (a === "mobile-pane") {
    closeMobileToolPanels(mobileShell, false)
    if (applyEditorMobilePane(mobileShell, b.dataset.pane)) {
      _mobilePane = b.dataset.pane
      _pendingMobileFocus = null
      updateMobileEditorToolAvailability(mobileShell, _mobilePane)
    }
    return
  }
  if (b.closest('[data-mobile-tool-panel="insert"]')) closeMobileToolPanels(mobileShell, false)
  if (a === "outline-actions") return
  if (a === "target-return") {
    var inspectState = _articleTargetInspect
    if (!inspectState || inspectState.workId !== w) return
    _articleTargetInspect = null
    _nodeId = inspectState.sourceNodeId
    refreshEditor(w)
    openChoicePanel(w, inspectState.sourceNodeId, {
      draftChoices: inspectState.drafts,
      focusIndex: inspectState.focusIndex
    })
    return
  }
  if (a === "pick-start") {
    _articleTargetInspect = null
    _articleTargetPick = {purpose: "start", workId: w, sourceNodeId: _nodeId}
    prepareMobilePaneRefresh("outline", true)
    refreshEditor(w)
    return
  }
  if (a === "target-cancel") {
    var cancelledTargetPick = _articleTargetPick
    _articleTargetPick = null
    if (cancelledTargetPick?.sourceNodeId) _nodeId = cancelledTargetPick.sourceNodeId
    refreshEditor(w)
    if (cancelledTargetPick?.purpose === "choice") {
      openChoicePanel(w, cancelledTargetPick.sourceNodeId, {draftChoices: cancelledTargetPick.drafts})
    }
    return
  }
  if (a === "target-select") {
    var targetPickState = _articleTargetPick
    if (!targetPickState || targetPickState.workId !== w || !getNode(w, n)) return
    _articleTargetPick = null
    if (targetPickState.purpose === "start") {
      updateWork(w, {startNode: n})
      _nodeId = n
      prepareMobilePaneRefresh("editor", true)
      refreshEditor(w)
      return
    }
    if (targetPickState.purpose === "choice" && targetPickState.drafts?.[targetPickState.draftIndex]) {
      targetPickState.drafts[targetPickState.draftIndex].targetId = n
      _nodeId = targetPickState.sourceNodeId
      refreshEditor(w)
      openChoicePanel(w, targetPickState.sourceNodeId, {
        draftChoices: targetPickState.drafts,
        focusIndex: targetPickState.draftIndex
      })
    }
    return
  }
  if (a === "an") {
    var nd = addNode(w)
    if (nd) {
      var _w = getWork(w)
      var _s = (_w.scenes || [])[0]
      if (_s) updateNode(w, nd.id, {scene: _s.id})
      _nodeId = nd.id
      prepareMobilePaneRefresh("editor", true)
      refreshEditor(w)
    }
    return
  }
  if (a === "as") {
    var chapterCreator = b.closest(".world-tree")?.querySelector(".wt-chapter-create")
    if (chapterCreator) {
      chapterCreator.hidden = false
      chapterCreator.querySelector("input")?.focus()
    }
    return
  }
  if (a === "chapter-create-cancel") {
    var cancelledCreator = b.closest(".wt-chapter-create")
    var cancelledInput = cancelledCreator?.querySelector("input")
    if (cancelledInput) cancelledInput.value = ""
    if (cancelledCreator) cancelledCreator.hidden = true
    cancelledCreator?.parentElement?.querySelector('[data-a="as"]')?.focus()
    return
  }
  if (a === "chapter-create-confirm") {
    var confirmedCreator = b.closest(".wt-chapter-create")
    var chapterInput = confirmedCreator?.querySelector("input")
    var chapterName = chapterInput?.value?.trim() || ""
    if (!chapterName) {
      chapterInput?.focus()
      return
    }
    var chapterWork = getWork(w)
    var chapters = (chapterWork.chapters || []).slice()
    chapters.push({id:uid(), name:chapterName})
    updateWork(w, {chapters:chapters})
    prepareMobilePaneRefresh("outline", true)
    refreshEditor(w)
    return
  }
  if (a === "sl") { _nodeId = n; _splitPaneController?.closeOverlay(mobileShell); prepareMobilePaneRefresh("editor", true); refreshEditor(w); return }
  if (a === "up") {
    if (!moveNode(w, n, -1)) restoreOutlineActionFocus(outlineActionTrigger, b)
    return
  }
  if (a === "dn") {
    if (!moveNode(w, n, 1)) restoreOutlineActionFocus(outlineActionTrigger, b)
    return
  }
  if (a === "dl") {
    showConfirm("删除节点", "确定删除此节点？", function() {
      deleteNode(w, n)
      var remainingNodes = (getWork(w)?.nodes || []).length
      if (remainingNodes === 0) prepareMobilePaneRefresh("outline", true)
      refreshEditor(w)
    }, function() { restoreOutlineActionFocus(outlineActionTrigger, b) })
    return
  }
  if (a === "rn2") {
    var nd = getNode(w, n)
    showPrompt("重命名节点", nd ? nd.title : "", function(nn) {
      if (nn) { updateNode(w, n, {title: nn}); refreshEditor(w) }
    }, function() { restoreOutlineActionFocus(outlineActionTrigger, b) })
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
      prepareMobilePaneRefresh("editor", false)
      refreshEditor(w)
    }
    return
  }
  if (a === "ts") {
    var expanded = b.getAttribute("aria-expanded") === "true"
    var nextExpanded = !expanded
    var chapterContent = document.getElementById(b.getAttribute("aria-controls"))
    b.setAttribute("aria-expanded", String(nextExpanded))
    if (chapterContent) chapterContent.hidden = !nextExpanded
    var arrow = b.querySelector(".arrow")
    if (arrow) arrow.classList.toggle("open", nextExpanded)
    return
  }
  if (a === "chapter-delete") {
    var sid = b.dataset.sid
    if (sid) {
      showConfirm("\u5220\u9664\u7ae0\u8282", "\u786e\u5b9a\u5220\u9664\u6b64\u7ae0\u8282\uff1f\u8282\u70b9\u5c06\u79fb\u81f3\u5269\u4f59\u7ae0\u8282", function(ok) {
        if (ok) {
          var _w2 = getWork(w)
          var _rem = (_w2.chapters || []).filter(function(s){ return s.id !== sid })
          if (_rem.length > 0) {
            (_w2.nodes || []).forEach(function(node) {
              if (node.chapterId === sid) updateNode(w, node.id, {chapterId: _rem[0].id})
            })
          }
          updateWork(_workId, {chapters: _rem})
          refreshEditor(w)
        }
      }, function() { restoreOutlineActionFocus(outlineActionTrigger, b) })
    }
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
    }, function() { restoreOutlineActionFocus(outlineActionTrigger, b) })
    return
  }
  if (a === "fs-margin-toggle") {
    var popover = document.getElementById("marginPopover")
    if (popover) {
      var isOpen = popover.classList.toggle("open")
      b.setAttribute("aria-expanded", String(isOpen))
      if (isOpen) positionMarginPopover(b, popover)
    }
    return
  }
  // Formatting
  if (a === "undo") { runHistoryCommand("undo"); return }
  if (a === "redo") { runHistoryCommand("redo"); return }
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
  var outlineActionTrigger = _outlineActionMenu.closeForAction(b)
  var a = b.dataset.a
  var w = b.dataset.w || _workId
  var n = b.dataset.n || _nodeId

  // Node title rename (from editor header input)
  if (a === "rn") {
    updateNode(w, n, {title: b.value})
    return
  }

  // Native select controls reliably commit through change on touch and keyboard.
  if (a === "ss") {
    updateNode(w, n, {scene: b.value})
    return
  }

  // Chapter move
  if (a === "mc") {
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
        return
      }
    }
    restoreOutlineActionFocus(outlineActionTrigger, b)
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
      input.onchange = async function() {
        var file = input.files && input.files[0]
        if (!file) return
        try {
          var fontName = file.name.replace(/\.[^.]+$/, "")
          var fontValue = editorFontValue(fontName)
          var _es = getSettings(_workId)
          var previous = (_es.customFonts || []).find(function(font) { return font.name === fontName })
          var fontId = uid()
          var customFont = await persistEditorFontAsset({workId:_workId, fontId:fontId, name:fontName, value:fontValue, format:editorFontFormat(file.name), blob:file})
          try {
            var loadedFont = await resolveEditorFontAssets(_workId, [customFont])
            if (!loadedFont.length) throw new Error("字体文件没有成功写入本地资产库")
            await activateEditorCustomFonts(document, loadedFont)
            _es.customFonts = upsertEditorCustomFont(_es.customFonts, customFont)
            _es.fontFamily = fontValue
            updateWork(_workId, {editorSettings: _es})
            if (previous?.id) await deleteEditorFontAsset(_workId, previous.id).catch(function() {})
            refreshEditor(_workId)
            showToast("字体已导入并应用")
          } catch (error) {
            await deleteEditorFontAsset(_workId, fontId).catch(function() {})
            showToast("字体无法加载，请确认文件完整且格式受支持", "error")
          }
        } catch (error) {
          showToast(error?.message || "字体保存失败：浏览器本地空间不足", "error")
        }
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
        showConfirm('删除占位符', '确定删除此占位符？', function() {
          deletePlaceholder(wid, pid)
          refreshPhList(wid, ov)
        })
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

function openChoicePanel(wid, nid, options) {
  var w = getWork(wid)
  if (!w) return
  var node = getNode(wid, nid)
  if (!node) return
  var choices = Array.isArray(options?.draftChoices)
    ? JSON.parse(JSON.stringify(options.draftChoices))
    : JSON.parse(JSON.stringify(node.choices || []))
  var allNodes = w.nodes || []

  var body = '<div class="ch-panel" id="chPanel">'
  body += '<div class="ch-header"><span class="ch-header-title">选项编辑 -- ' + esc(node.title || '节点') + '</span></div>'
  body += '<div class="ch-list" id="chList">'

  for (var i = 0; i < choices.length; i++) {
    body += chRowHTML(wid, nid, choices[i], i, allNodes)
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

      if (act === 'pick-target') {
        var targetItem = btn.closest('.ch-item')
        var targetIndex = Array.from(listEl.querySelectorAll('.ch-item')).indexOf(targetItem)
        if (targetIndex < 0) return
        var targetDrafts = collectChoiceDrafts(listEl)
        _articleTargetInspect = null
        _articleTargetPick = {
          purpose: 'choice',
          workId: wid,
          sourceNodeId: nid,
          draftIndex: targetIndex,
          drafts: targetDrafts
        }
        ov.remove()
        prepareMobilePaneRefresh('outline', true)
        refreshEditor(wid)
        return
      }
      if (act === 'inspect-target') {
        var inspectItem = btn.closest('.ch-item')
        var inspectIndex = Array.from(listEl.querySelectorAll('.ch-item')).indexOf(inspectItem)
        var inspectTargetId = btn.dataset.targetId || ''
        if (inspectIndex < 0 || !getNode(wid, inspectTargetId)) return
        _articleTargetPick = null
        _articleTargetInspect = {
          workId: wid,
          sourceNodeId: nid,
          targetNodeId: inspectTargetId,
          focusIndex: inspectIndex,
          drafts: collectChoiceDrafts(listEl)
        }
        ov.remove()
        _nodeId = inspectTargetId
        prepareMobilePaneRefresh('editor', true)
        refreshEditor(wid)
        return
      }
      if (act === 'add-choice') {
        // DOM only: append empty row, no localStorage write
        var dummy = { id: '', text: '', targetId: '' }
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
        if (saveChoicesFromDOM(wid, nid, listEl)) {
          ov.remove()
          refreshEditor(wid)
        }
        return
      }
      if (act === 'delete-all') {
        showConfirm('删除选项组', '确定删除此节点的选项组？', function() {
          updateNode(wid, nid, {choices: []})
          ov.remove()
          refreshEditor(wid)
        })
        return
      }
    })
  }

  ov.addEventListener('click', function(ev) {
    if (ev.target === ov) ov.remove()
  })
  if (Number.isInteger(options?.focusIndex)) {
    listEl.querySelectorAll('.ch-target-pick')[options.focusIndex]?.focus()
  }
}

function collectChoiceDrafts(listEl) {
  return Array.from(listEl.querySelectorAll('.ch-item')).map(function(row) {
    return {
      id: row.dataset.choiceId || '',
      text: row.querySelector('.ch-text')?.value || '',
      targetId: row.querySelector('.ch-target-pick')?.dataset.targetId || ''
    }
  })
}

function saveChoicesFromDOM(wid, nid, listEl) {
  var drafts = collectChoiceDrafts(listEl)
  if (drafts.length < 2) {
    showToast('至少需要 2 个选项', 'error')
    return false
  }
  var work = getWork(wid)
  var curNode = getNode(wid, nid)
  if (!work || !curNode) return false
  for (var i = 0; i < drafts.length; i++) {
    drafts[i].text = drafts[i].text.trim()
    if (!drafts[i].text) {
      showToast('选项 #' + (i + 1) + ' 未填写文字', 'error')
      return false
    }
    if (!drafts[i].targetId) {
      showToast('选项 #' + (i + 1) + ' 未选择目标节点', 'error')
      return false
    }
    if (!describeArticleTarget(work, drafts[i].targetId).ok) {
      showToast('选项 #' + (i + 1) + ' 的目标节点已不存在，请重新选择', 'error')
      return false
    }
  }
  var reconciled = reconcileArticleChoices(curNode.choices || [], drafts, uid)
  if (!reconciled.ok) {
    showToast('选项保存失败，请重新打开后再试', 'error')
    return false
  }
  updateNode(wid, nid, {choices: reconciled.choices})
  showToast('已保存')
  return true
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
  var work = getWork(wid)
  var target = choice.targetId ? describeArticleTarget(work, choice.targetId) : {ok: false}
  var targetLabel = target.ok ? target.pathLabel : (choice.targetId ? '目标已删除 · 请重新选择' : '选择目标节点')
  var h = '<div class="ch-item" data-ch-idx="' + idx + '" data-choice-id="' + esc(choice.id || '') + '">'
  h += '<span class="ch-num">#' + (idx + 1) + '</span>'
  h += '<input class="ch-text" id="ch_text_' + idx + '" value="' + esc(choice.text || '') + '" placeholder="选项文字">'
  h += '<button type="button" class="ch-target-pick' + (choice.targetId && !target.ok ? ' invalid' : '') + '" data-ch-a="pick-target" data-target-id="' + esc(choice.targetId || '') + '"><span>' + esc(targetLabel) + '</span><b aria-hidden="true">›</b></button>'
  if (target.ok) h += '<button type="button" class="ch-target-inspect" data-ch-a="inspect-target" data-target-id="' + esc(choice.targetId) + '" title="查看目标节点" aria-label="查看目标节点">查看</button>'
  h += '<button type="button" class="ch-del-btn" data-ch-a="del-choice" data-ch-idx="' + idx + '" title="删除选项" aria-label="删除选项">\u2715</button>'
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
  body += '<p class="im-hint">图片会自动压缩至约 500KB，再以 base64 嵌入作品（压缩后最多 1MB）。</p>'
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
      input.accept = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif'
      input.onchange = async function() {
        var file = input.files && input.files[0]
        if (!file) return
        try {
          showToast('正在处理图片…', 'info')
          var result = await compressEditorImage(file)
          insertImageAtCursor(result.dataUrl)
          ov.remove()
          if (result.compressed) {
            showToast('图片已压缩至 ' + Math.max(1, Math.round(result.outputBytes / 1024)) + 'KB')
          }
        } catch (error) {
          showToast(error?.message || '图片处理失败，请换一张重试', 'error')
        }
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
  if (!w || !w.nodes || !w.nodes.length) return false
  var ns = w.nodes

  var node = ns.find(function(x) { return x.id === nid })
  if (!node) return false
  var cid = node.chapterId || ""

  // Collect sibling nodes in same chapter (preserving global order)
  var siblings = []
  for (var i = 0; i < ns.length; i++) {
    if ((ns[i].chapterId || "") === cid) {
      siblings.push(ns[i])
    }
  }
  if (siblings.length < 2) return false

  var si = siblings.findIndex(function(x) { return x.id === nid })
  var st = si + dir
  if (st < 0 || st >= siblings.length) return false

  // Swap in global array
  var gi = ns.findIndex(function(x) { return x.id === nid })
  var gt = ns.findIndex(function(x) { return x.id === siblings[st].id })
  var tmp = ns[gi]
  ns[gi] = ns[gt]
  ns[gt] = tmp
  updateWork(wid, {nodes: ns})
  refreshEditor(wid)
  return true
}

function refreshEditor(wid) {
  var a = document.getElementById("app")
  if (a) {
    a.innerHTML = renderHeader() + '<div id="editorMain">' + renderEditor(wid) + '</div>'
    restorePendingMobilePaneFocus(a.querySelector(".editor-body-area"))
  }
}

function loadEditorCustomFonts(wid, fonts) {
  var legacyFonts = (fonts || []).filter(function(font) { return font?.data })
  installEditorCustomFonts(document, legacyFonts)
  return resolveEditorFontAssets(wid, fonts).then(function(storedFonts) {
    if (_workId === wid) return activateEditorCustomFonts(document, legacyFonts.concat(storedFonts))
    return []
  }).catch(function() {
    // Legacy Base64 fonts remain usable; missing local assets fall back safely.
    return []
  })
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
  if (e.key === "Escape") {
    var mobileShell = document.querySelector('.editor-body-area[data-mobile-tools]')
    if (mobileShell && closeMobileToolPanels(mobileShell, true)) e.preventDefault()
    return
  }
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
  h += '<button class="pm-card-hamburger" data-a="pm-hamburger" data-pm-id="' + pm.id + '" type="button" aria-label="编辑或删除手机模块" title="编辑/删除">\u2261</button>'
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
    commitEmpty: Boolean(existingPm),
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

function persistEditableContent(ce) {
  if (!ce || !_workId || !_nodeId) return
  updateNode(_workId, _nodeId, {content: ce.innerHTML})
  var wc = document.getElementById("wc_" + _nodeId)
  if (wc) wc.textContent = formatEditorCharacterCount(ce)
}

function runHistoryCommand(cmd) {
  var ce = document.getElementById("ce_" + _nodeId)
  if (!ce) return
  ce.focus()
  document.execCommand(cmd, false, null)
  persistEditableContent(ce)
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
      showConfirm('删除手机模块', '确定删除此手机模块？', function() {
        deletePhoneModule(wid, pmid)
        var card = document.querySelector('[data-pm-id="' + pmid + '"]')
        if (card) {
          card.parentNode.removeChild(card)
          var ce = document.getElementById('ce_' + nid)
          if (ce) updateNode(_workId, nid, {content: ce.innerHTML})
        }
        showToast('已删除')
      })
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

// ====== Phone Module Card Pointer Events ======
_nodeDragController = createEditorNodeDragController({
  root: document,
  onCommit: function(payload) {
    var work = getWork(_workId)
    if (!work) return
    var result = reorderArticleNode(work.nodes || [], payload)
    if (!result.ok || !result.changed) return
    updateWork(_workId, {nodes: result.nodes})
    refreshEditor(_workId)
  }
})

_phoneModuleDragController = createEditorPhoneModuleDragController({
  documentObject: document,
  windowObject: window,
  getWorkId: function() { return _workId },
  onCommit: function({workId, nodeId, content}) {
    updateNode(workId, nodeId, {content: content})
  }
})

_splitPaneController = createEditorSplitPaneController(document, globalThis.localStorage)

function renderWorkSearchResults(input) {
  var panel = input.closest(".work-search")?.querySelector("[data-work-search-results]")
  if (!panel) return
  var query = input.value.trim()
  panel.replaceChildren()
  if (!query) {
    panel.hidden = true
    return
  }
  var results = searchArticleWork(getWork(_workId), query)
  panel.hidden = false
  if (!results.length) {
    var empty = document.createElement("div")
    empty.className = "work-search-empty"
    empty.textContent = "没有找到相关内容"
    panel.appendChild(empty)
    return
  }
  results.forEach(function(result) {
    var button = document.createElement("button")
    button.type = "button"
    button.className = "work-search-result"
    button.dataset.a = "search-node"
    button.dataset.w = _workId
    button.dataset.n = result.nodeId
    var path = document.createElement("strong")
    path.textContent = result.chapterName + " / " + result.title
    var excerpt = document.createElement("span")
    excerpt.textContent = result.excerpt || "匹配节点标题或选项"
    button.append(path, excerpt)
    panel.appendChild(button)
  })
}

// Auto-save content on input
document.addEventListener("input", function(e) {
  var workSearch = e.target.closest?.("[data-work-search]")
  if (workSearch) {
    renderWorkSearchResults(workSearch)
    return
  }
  var targetSearch = e.target.closest?.(".target-picker-search")
  if (targetSearch) {
    var tree = targetSearch.closest(".world-tree.target-pick-mode")
    var query = targetSearch.value.trim().toLowerCase()
    tree?.querySelectorAll('.wt-node').forEach(function(row) {
      var targetButton = row.querySelector('[data-a="target-select"]')
      var path = targetButton?.dataset.targetPath || targetButton?.textContent?.toLowerCase() || ""
      row.hidden = Boolean(query) && !path.includes(query)
    })
    tree?.querySelectorAll('.wt-chapter').forEach(function(chapter) {
      var rows = Array.from(chapter.querySelectorAll('.wt-node'))
      chapter.hidden = rows.length > 0 && rows.every(function(row) { return row.hidden })
      if (query && !chapter.hidden) {
        var content = chapter.querySelector('.wt-chapter-content')
        var toggle = chapter.querySelector('.wt-chapter-toggle')
        if (content) content.hidden = false
        if (toggle) toggle.setAttribute('aria-expanded', 'true')
      }
    })
    return
  }
  var ce = e.target.closest(".content-editable")
  if (!ce) return
  var nid = ce.dataset.n
  if (!nid || !_workId) return
  updateNode(_workId, nid, {content: ce.innerHTML})
  var wc = document.getElementById("wc_" + nid)
  if (wc) wc.textContent = formatEditorCharacterCount(ce)
})
