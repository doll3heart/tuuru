// Tuuru Works - Article Editor (clean rewrite)
import { getWork, updateWork, addNode, createConditionalArticleNode, updateNode, deleteNode, addScene, deleteScene, addPlaceholder, deletePlaceholder, updatePlaceholder, uid, WORK_TYPE, PLACEHOLDER_MODE, BUILTIN_FONTS, DEFAULT_EDITOR_SETTINGS, PH_PRESETS, PH_MODES, PHONE_APP_DEFS, addPhoneModule, updatePhoneModule, deletePhoneModule, getPhoneModulesByNode, getPhoneModule, migrateInteractiveSceneWork } from "../data.js"
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
import { articleNodeIsConditional, buildArticleChoiceCatalog, normalizeArticleDisplayCondition } from "../article-condition-model.js"
import { openPhoneAppModal } from "./phone.js"
import { activateEditorCustomFonts, editorFontFormat, editorFontValue, installEditorCustomFonts, removeEditorCustomFont, renameEditorCustomFont, upsertEditorCustomFont } from "../editor-custom-fonts.js"
import { deleteEditorFontAsset, persistEditorFontAsset, resolveEditorFontAssets } from "../editor-font-storage.js"
import { compressEditorImage } from "../image-compression.js"
import { searchArticleWork } from "../article-work-search.js"
import { createEditorSplitPaneController, readEditorSplitPreference } from "../editor-split-pane.js"
import { readArticleEditorViewState, writeArticleEditorViewState } from "../article-editor-view-state.js"
import { readArticleAuthorNotes, writeArticleAuthorNotes } from "../article-author-notes.js"
import { deleteAuthorPlaceholderPreset, importAuthorPlaceholderPresetBundle, instantiateAuthorPlaceholderPreset, readAuthorPlaceholderPresets, saveAuthorPlaceholderPreset, serializeAuthorPlaceholderPresetBundle } from "../author-placeholder-presets.js"
import { downloadBlob } from "../download.js"
import { dedupeForbiddenWords, parseForbiddenWords } from "../forbidden-words.js"
import { openInteractiveSceneEditor } from "../interactive-scene-editor.js"
import { createEditorPersistenceBuffer } from "../editor-persistence-buffer.js"
import { createArticleEditorRenderIndex } from "../article-editor-render-index.js"
import {
  createInteractiveSceneNodeDraft,
  interactiveSceneForNode,
  isInteractiveSceneNode,
} from "../interactive-scene-node.js"
import {
  ARTICLE_INTERACTION_MARKER_CLASS,
  articleInteractionMarkerHTML,
  articleInteractionMarkerIds,
  reconcileArticleInteractionGroup,
} from "../article-interaction-group-model.js"
import { findWorkReferences } from "../work-references.js"
import { openDeletionImpactDialog } from "../deletion-impact-ui.js"

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
var _movingInteractionGroup = null
var _splitPaneController = null
var _editorPersistenceState = {state:"saved", pendingCount:0, error:null}
var _editorPersistence = createEditorPersistenceBuffer({onStateChange:updateEditorPersistenceState})
var FORMAT_COMMANDS = { bold:'bold', italic:'italic', underline:'underline', left:'justifyLeft', center:'justifyCenter', right:'justifyRight' }
var AUTHOR_NOTE_GROUPS = [
  {
    id:"story",
    label:"剧情",
    sections:[
      {id:"outline", label:"故事总纲", hint:"主线与阶段目标", placeholder:"记录故事主线、阶段目标、核心冲突与结局方向……"},
      {id:"chapterPlans", label:"章节规划", hint:"章节节奏与场次", placeholder:"按章节记录事件顺序、场次安排、情绪节奏与待写内容……"},
      {id:"foreshadowing", label:"伏笔回收", hint:"线索与兑现进度", placeholder:"记录伏笔、首次出现位置、提示次数、计划回收位置与完成状态……"},
    ],
  },
  {
    id:"world",
    label:"世界",
    sections:[
      {id:"worldbuilding", label:"世界规则", hint:"时代与运行规则", placeholder:"记录时代背景、能力体系、制度、禁忌、日常规则与例外……"},
      {id:"locations", label:"地点与组织", hint:"空间、阵营与资源", placeholder:"记录地点氛围、地理关系、组织结构、阵营立场与关键资源……"},
    ],
  },
  {
    id:"people",
    label:"人物",
    sections:[
      {id:"characters", label:"人物档案", hint:"动机、秘密与成长", placeholder:"记录人物身份、外貌、习惯、动机、秘密、弱点与成长线……"},
      {id:"relationships", label:"人物关系", hint:"关系变化与称呼", placeholder:"记录人物之间的关系、称呼、共同经历、矛盾与变化节点……"},
    ],
  },
  {
    id:"scratch",
    label:"随记",
    sections:[
      {id:"ideas", label:"灵感碎片", hint:"对白、画面与待整理想法", placeholder:"随手记下暂时还没归类的对白、画面、动作、标题与零散想法……"},
    ],
  },
]
var AUTHOR_NOTE_SECTIONS = AUTHOR_NOTE_GROUPS.flatMap(function(group) { return group.sections })
var AUTHOR_NOTE_SECTION_IDS = AUTHOR_NOTE_SECTIONS.map(function(section) { return section.id })

function editorPersistenceCopy(snapshot) {
  if (snapshot?.state === "editing") return "编辑中"
  if (snapshot?.state === "saving") return "保存中"
  if (snapshot?.state === "error") return "保存失败"
  return "已保存"
}

function updateEditorPersistenceState(snapshot) {
  _editorPersistenceState = snapshot || {state:"saved", pendingCount:0, error:null}
  var copy = editorPersistenceCopy(_editorPersistenceState)
  document.querySelectorAll(".editor-mobile-save-state,[data-author-notes-status]").forEach(function(status) {
    status.textContent = copy
    status.dataset.saveState = _editorPersistenceState.state
  })
}

function esc(s) {
  if (!s) return ""
  var d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

function locateEditorReference(wid, reference) {
  if (reference?.sourceNodeId) {
    _nodeId = reference.sourceNodeId
    writeArticleEditorViewState(wid, {
      nodeId:reference.sourceNodeId,
      collapsedChapterIds:[],
    }, globalThis.localStorage)
    prepareMobilePaneRefresh("editor", true)
    refreshEditor(wid)
    return
  }
  if (reference?.appType) openPhoneAppModal(wid, reference.appType)
}

function confirmReferencedDeletion({
  wid,
  kind,
  id,
  title,
  itemName,
  fallbackMessage,
  onConfirm,
  onCancel,
  onLocate,
}) {
  const references = findWorkReferences(getWork(wid), {kind, id})
  if (!references.length) {
    showConfirm(title, fallbackMessage, onConfirm, onCancel)
    return null
  }
  return openDeletionImpactDialog({
    title,
    itemName,
    references,
    onConfirm,
    onCancel,
    onLocate:reference => {
      if (onLocate) onLocate(reference)
      else locateEditorReference(wid, reference)
    },
  })
}

function openEditorFontManager(workId) {
  var settings = getSettings(workId)
  var fonts = settings.customFonts || []
  var body = '<div class="editor-font-manager"><p class="text-muted">字体文件只保存在当前设备，不会随作品导出或分享。</p>'
  if (!fonts.length) body += '<p>还没有本地字体。</p>'
  fonts.forEach(function(font) {
    body += '<div class="editor-font-manager-row" data-editor-font-row="' + esc(font.id) + '">'
    body += '<input class="input" data-editor-font-name value="' + esc(font.name) + '" aria-label="字体名称">'
    body += '<button type="button" class="btn btn-ghost" data-editor-font-rename>保存名称</button>'
    body += '<button type="button" class="btn btn-ghost" data-editor-font-replace>替换文件</button>'
    body += '<button type="button" class="btn btn-danger" data-editor-font-delete>删除</button></div>'
  })
  body += '</div>'
  var overlay = modal('管理本机字体', body, '<button type="button" class="btn btn-primary" id="editorFontManagerDone">完成</button>')
  overlay.querySelector('#editorFontManagerDone').onclick = function() { overlay.remove() }

  overlay.querySelector('.editor-font-manager').onclick = async function(event) {
    var button = event.target.closest('[data-editor-font-rename],[data-editor-font-replace],[data-editor-font-delete]')
    if (!button) return
    var row = button.closest('[data-editor-font-row]')
    var fontId = row && row.dataset.editorFontRow
    var currentSettings = getSettings(workId)
    var currentFont = (currentSettings.customFonts || []).find(function(font) { return font.id === fontId })
    if (!currentFont) return

    if (button.hasAttribute('data-editor-font-rename')) {
      try {
        var renamed = renameEditorCustomFont(currentSettings.customFonts, fontId, row.querySelector('[data-editor-font-name]').value)
        var nextFont = renamed.find(function(font) { return font.id === fontId })
        if (currentSettings.fontFamily === currentFont.value) currentSettings.fontFamily = nextFont.value
        currentSettings.customFonts = renamed
        updateWork(workId, {editorSettings:currentSettings})
        overlay.remove()
        refreshEditor(workId)
        showToast('字体名称已保存')
      } catch (error) {
        showToast(error.message || '字体改名失败', 'error')
      }
      return
    }

    if (button.hasAttribute('data-editor-font-delete')) {
      await deleteEditorFontAsset(workId, fontId).catch(function() {})
      currentSettings.customFonts = removeEditorCustomFont(currentSettings.customFonts, fontId)
      if (currentSettings.fontFamily === currentFont.value) currentSettings.fontFamily = DEFAULT_EDITOR_SETTINGS.fontFamily
      updateWork(workId, {editorSettings:currentSettings})
      overlay.remove()
      refreshEditor(workId)
      showToast('本机字体已删除')
      return
    }

    var input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ttf,.otf,.woff,.woff2'
    input.onchange = async function() {
      var file = input.files && input.files[0]
      if (!file) return
      try {
        var replacement = await persistEditorFontAsset({
          workId:workId,
          fontId:fontId,
          name:currentFont.name,
          value:currentFont.value,
          format:editorFontFormat(file.name),
          blob:file,
        })
        var nextFonts = (currentSettings.customFonts || []).map(function(font) {
          return font.id === fontId ? replacement : font
        })
        var resolved = await resolveEditorFontAssets(workId, nextFonts)
        await activateEditorCustomFonts(document, resolved)
        currentSettings.customFonts = nextFonts
        updateWork(workId, {editorSettings:currentSettings})
        overlay.remove()
        refreshEditor(workId)
        showToast('字体文件已替换')
      } catch (error) {
        showToast(error.message || '字体替换失败', 'error')
      }
    }
    input.click()
  }
}


export function renderEditor(wid) {
  _editorPersistence.flush()
  _phoneModuleDragController?.reset("refresh")
  _nodeDragController?.reset("refresh")
  _outlineActionMenu.reset()
  var workChanged = _workId !== wid
  if (workChanged) {
    _mobilePane = "editor"
    _pendingMobileFocus = null
    _articleTargetPick = null
    _articleTargetInspect = null
    _nodeId = null
  }
  _workId = wid
  var w = migrateInteractiveSceneWork(wid) || getWork(wid)
  if (!w) return '<div class="app-main"><div class="empty-state"><h3>作品未找到</h3></div></div>'
  loadEditorCustomFonts(wid, w.editorSettings?.customFonts)
  var ns = w.nodes || []
  if (workChanged) {
    var savedView = readArticleEditorViewState(wid, globalThis.localStorage)
    if (savedView.nodeId && ns.some(function(n) { return n.id === savedView.nodeId })) {
      _nodeId = savedView.nodeId
    }
  }
  if (!_nodeId || !ns.find(function(n){ return n.id === _nodeId })) {
    _nodeId = ns.length ? ns[0].id : null
  }
  if (_nodeId) writeArticleEditorViewState(wid, {nodeId:_nodeId}, globalThis.localStorage)
  if (!_nodeId) _mobilePane = "outline"
  var L = buildIconbar(wid, _nodeId)
  var E = buildEditor(w, _nodeId)
  var W = buildWorldTree(w)
  var M = buildMobileCommandbar(wid, _nodeId)
  var split = readEditorSplitPreference(globalThis.localStorage)
  var splitState = split.collapsed ? ' data-outline-collapsed="true"' : ''
  if (split.collapsed && _articleTargetPick) splitState += ' data-outline-overlay="true"'
  var divider = '<div class="editor-splitter" data-editor-splitter role="separator" aria-label="调整正文与作品结构宽度" aria-orientation="vertical" aria-valuemin="180" aria-valuemax="520" aria-valuenow="' + split.width + '" tabindex="0"><span aria-hidden="true"></span></div>'
  var reopen = '<button type="button" class="editor-outline-reopen" data-editor-outline-reopen data-a="outline-reopen" aria-label="打开作品结构">结构</button>'
  return '<div class="editor-page">' + buildPreflightReturnBar(wid) + '<div class="editor-body-area" data-mobile-pane="' + _mobilePane + '"' + splitState + ' style="--editor-outline-width:' + split.width + 'px">' + L + buildMobileViewSwitch() + E + divider + W + reopen + M + '</div></div>'
}

function buildPreflightReturnBar(wid) {
  var pending = null
  try {
    pending = JSON.parse(sessionStorage.getItem("tuuru_preflight_return") || "null")
  } catch {}
  if (!pending || pending.workId !== wid) return ""
  return '<div class="editor-preflight-return" role="status"><span><strong>正在修复发布前体检问题</strong><small>修改会自动保存，完成后重新检查即可。</small></span><button type="button" class="btn btn-sm btn-primary" data-a="return-preflight" data-w="' + escAttr(wid) + '">重新体检</button></div>'
}

function buildMobileViewSwitch() {
  var editorPressed = _mobilePane === "editor" ? "true" : "false"
  var notesPressed = _mobilePane === "notes" ? "true" : "false"
  var outlinePressed = _mobilePane === "outline" ? "true" : "false"
  var h = '<div class="editor-mobile-view-switch" role="group" aria-label="编辑器视图">'
  h += '<button type="button" data-a="mobile-pane" data-pane="editor" aria-controls="articleEditorPane" aria-pressed="' + editorPressed + '">正文</button>'
  h += '<button type="button" data-a="mobile-pane" data-pane="notes" aria-controls="articleNotesPane" aria-pressed="' + notesPressed + '">设定</button>'
  h += '<button type="button" data-a="mobile-pane" data-pane="outline" aria-controls="articleOutlinePane" aria-pressed="' + outlinePressed + '">结构</button>'
  h += '</div>'
  return h
}

function buildMobileCommandbar(wid, nid) {
  var es = getSettings(wid)
  var conditional = articleNodeIsConditional(getNode(wid, nid))
  var viewState = readArticleEditorViewState(wid, globalThis.localStorage)
  var localTextColor = viewState.editorTextColor || "#40383b"
  var editorToolsDisabled = _mobilePane === "editor" && nid ? "" : " disabled"
  var h = '<div class="editor-mobile-commandbar" aria-label="移动端编辑工具">'
  h += '<div class="editor-mobile-dock" role="group" aria-label="写作工具">'
  h += '<button type="button" data-a="mobile-tools" data-panel="format" data-mobile-editor-tool aria-label="文字格式" aria-controls="mobileFormatPanel" aria-expanded="false"' + editorToolsDisabled + '><span aria-hidden="true">Aa</span></button>'
  h += '<button type="button" data-a="mobile-tools" data-panel="insert" data-mobile-editor-tool aria-label="插入内容" aria-controls="mobileInsertPanel" aria-expanded="false"' + editorToolsDisabled + '><span aria-hidden="true">＋</span></button>'
  h += '<button type="button" data-a="undo" data-n="' + nid + '" aria-label="撤回" title="撤回"' + editorToolsDisabled + '><span aria-hidden="true">↶</span></button>'
  h += '<button type="button" data-a="redo" data-n="' + nid + '" aria-label="重做" title="重做"' + editorToolsDisabled + '><span aria-hidden="true">↷</span></button>'
  h += '<span class="editor-mobile-save-state" data-save-state="' + escAttr(_editorPersistenceState.state) + '" aria-live="polite">' + editorPersistenceCopy(_editorPersistenceState) + '</span>'
  h += '</div>'

  h += '<section class="editor-mobile-tool-panel" id="mobileInsertPanel" data-mobile-tool-panel="insert" aria-label="插入内容" hidden>'
  h += '<div class="editor-mobile-tool-head"><strong>插入内容</strong><button type="button" data-a="mobile-tools-close" data-panel="insert">完成</button></div>'
  h += '<div class="editor-mobile-insert-grid">'
  h += '<button type="button" data-a="ph" data-w="' + wid + '"><span aria-hidden="true">{}</span><span>占位符</span></button>'
  if (!conditional) {
    h += '<button type="button" data-a="ig" data-w="' + wid + '"><span aria-hidden="true">◇</span><span>普通互动</span></button>'
    h += '<button type="button" data-a="ch" data-w="' + wid + '"><span aria-hidden="true">⇄</span><span>剧情分支</span></button>'
  }
  h += '<button type="button" data-a="im"><span aria-hidden="true">＋</span><span>图片</span></button>'
  if (!conditional) h += '<button type="button" data-a="is"><span aria-hidden="true">◎</span><span>互动页</span></button>'
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
  h += '<button type="button" data-a="bold" data-n="' + nid + '" aria-label="加粗" aria-pressed="false"><b>B</b></button>'
  h += '<button type="button" data-a="italic" data-n="' + nid + '" aria-label="斜体" aria-pressed="false"><i>I</i></button>'
  h += '<button type="button" data-a="underline" data-n="' + nid + '" aria-label="下划线" aria-pressed="false"><u>U</u></button>'
  h += '<button type="button" data-a="left" data-n="' + nid + '" aria-label="左对齐" aria-pressed="false">左</button>'
  h += '<button type="button" data-a="center" data-n="' + nid + '" aria-label="居中对齐" aria-pressed="false">中</button>'
  h += '<button type="button" data-a="right" data-n="' + nid + '" aria-label="右对齐" aria-pressed="false">右</button>'
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
  if (customFonts.length) h += '<option value="__manage__">管理本机字体…</option>'
  h += '<option value="__custom__">+ 导入字体…</option></select></label>'
  h += '<label class="editor-mobile-setting-field editor-mobile-color-setting"><span>字色</span><input type="color" data-a="fs-color" aria-label="作者正文颜色" value="' + localTextColor + '"></label>'
  h += '<button type="button" class="editor-mobile-color-reset" data-a="fs-color-reset">恢复默认字色</button>'
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

function buildIconbar(wid, nid) {
  var node = getNode(wid, nid)
  var conditional = articleNodeIsConditional(node)
  var h = '<div class="editor-iconbar">'
  h += '<button type="button" data-a="ph" data-w="' + wid + '" title="占位符" aria-label="插入占位符">{}</button>'
  if (!conditional) {
    h += '<button type="button" data-a="ig" data-w="' + wid + '" title="普通互动" aria-label="在正文中插入普通互动">◇</button>'
    h += '<button type="button" data-a="ch" data-w="' + wid + '" title="剧情分支" aria-label="编辑末尾剧情分支">⇄</button>'
  }
  h += '<div class="divider"></div>'
  h += '<button type="button" data-a="im" title="图片" aria-label="插入图片">+</button>'
  if (!conditional) h += '<button type="button" data-a="is" title="互动页" aria-label="在本章添加互动页">◎</button>'
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
  if (isInteractiveSceneNode(n)) return buildInteractiveNodeEditor(w, n)
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
  var conditional = articleNodeIsConditional(n)
  var h = '<div class="editor-header">'
  h += '<input class="node-name" id="nt_' + n.id + '" value="' + esc(n.title || '') + '" placeholder="节点标题" aria-label="节点标题" data-a="rn" data-n="' + n.id + '">'
  h += '<div class="editor-actions">'
  if (conditional) {
    h += '<span class="conditional-node-kind">隐藏段落</span>'
    h += '<button type="button" class="btn btn-sm btn-outline" data-a="edit-display-condition" data-w="' + w.id + '" data-n="' + n.id + '">显示条件</button>'
  }
  h += '<select data-a="ss" data-n="' + n.id + '" aria-label="当前节点所属场景；打开可新建场景"><option value="">不使用场景</option>'
  for (var i = 0; i < sc.length; i++) {
    var s = sc[i]
    h += '<option value="' + s.id + '"' + (n.scene === s.id ? ' selected' : '') + '>场景：' + esc(s.name) + '</option>'
  }
  h += '<option value="__add_scene__">＋ 新建场景…</option>'
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
  var viewState = readArticleEditorViewState(_workId, globalThis.localStorage)
  var localTextColor = viewState.editorTextColor || "#40383b"

  var h = '<div class="editor-toolbar"><div class="editor-toolbar-scroll">'
  // Editing history
  h += '<button type="button" data-a="undo" data-n="' + nid + '" title="撤回" aria-label="撤回"><span aria-hidden="true">↶</span></button>'
  h += '<button type="button" data-a="redo" data-n="' + nid + '" title="重做" aria-label="重做"><span aria-hidden="true">↷</span></button>'
  h += '<div class="tb-divider"></div>'
  // Text style buttons
  h += '<button type="button" data-a="bold" data-n="' + nid + '" title="加粗" aria-label="加粗" aria-pressed="false"><b>B</b></button>'
  h += '<button type="button" data-a="italic" data-n="' + nid + '" title="斜体" aria-label="斜体" aria-pressed="false"><i>I</i></button>'
  h += '<button type="button" data-a="underline" data-n="' + nid + '" title="下划线" aria-label="下划线" aria-pressed="false"><u>U</u></button>'
  h += '<div class="tb-divider"></div>'

  // Alignment
  h += '<button type="button" data-a="left" data-n="' + nid + '" title="左对齐" aria-label="左对齐" aria-pressed="false">左</button>'
  h += '<button type="button" data-a="center" data-n="' + nid + '" title="居中" aria-label="居中对齐" aria-pressed="false">中</button>'
  h += '<button type="button" data-a="right" data-n="' + nid + '" title="右对齐" aria-label="右对齐" aria-pressed="false">右</button>'
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
  if (cfs.length) h += '<option value="__manage__">管理本机字体…</option>'
  h += '<option value="__custom__">+ 导入字体…</option>'
  h += '</select>'
  h += '<label class="toolbar-color-setting" title="仅改变作者本机的正文颜色"><span>字色</span><input type="color" data-a="fs-color" aria-label="作者正文颜色" value="' + localTextColor + '"></label>'
  h += '<button type="button" class="toolbar-color-reset" data-a="fs-color-reset" title="恢复默认正文颜色" aria-label="恢复默认正文颜色">重置字色</button>'

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

function buildInteractiveNodeEditor(w, n) {
  var scene = interactiveSceneForNode(w, n)
  var stage = scene?.stages?.find(function(candidate) {
    return candidate.id === scene.startStageId
  }) || scene?.stages?.[0]
  var stageCount = scene?.stages?.length || 0
  var background = stage?.image || ""
  var character = stage?.characterImage || ""
  var h = '<div class="editor-area interactive-node-editor-area" id="articleEditorPane">'
  h += '<div class="editor-header interactive-node-header">'
  h += '<input class="node-name" id="nt_' + n.id + '" value="' + esc(n.title || scene?.title || '互动场景') + '" placeholder="互动页标题" aria-label="互动页标题" data-a="rn" data-n="' + n.id + '">'
  h += '<span class="interactive-node-kind">◎ 互动页</span>'
  h += '<span class="word-count">' + stageCount + ' 画面</span>'
  h += '</div>'
  h += '<div class="interactive-node-workspace">'
  h += '<div class="interactive-node-preview" aria-label="互动页预览">'
  if (background) h += '<img class="interactive-node-preview-background" src="' + esc(background) + '" alt="">'
  if (character) h += '<img class="interactive-node-preview-character" src="' + esc(character) + '" alt="">'
  h += '<div class="interactive-node-preview-copy"><span>INTERACTIVE PAGE</span><strong>' + esc(scene?.title || n.title || '互动场景') + '</strong><small>' + stageCount + ' 个画面 · 独立阅读页面</small></div>'
  h += '</div>'
  h += '<div class="interactive-node-actions">'
  h += '<p>这个节点在读者端会直接打开全屏互动页，不会显示成正文卡片。</p>'
  h += '<button type="button" class="btn btn-primary" data-a="edit-interactive-node" data-w="' + w.id + '" data-n="' + n.id + '">编辑互动页</button>'
  h += '</div></div></div>'
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
  var viewState = readArticleEditorViewState(_workId, globalThis.localStorage)
  var style = 'font-family:' + (es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily) + ';'
  style += 'font-size:' + (es.fontSize || DEFAULT_EDITOR_SETTINGS.fontSize) + 'px;'
  style += 'line-height:' + (es.lineHeight || DEFAULT_EDITOR_SETTINGS.lineHeight) + ';'
  style += 'letter-spacing:' + (es.letterSpacing || 0) + 'px;'
  style += 'padding:' + (es.marginTop || 24) + 'px ' + (es.marginRight || 32) + 'px ' + (es.marginBottom || 24) + 'px ' + (es.marginLeft || 32) + 'px;'
  if (viewState.editorTextColor) style += 'color:' + viewState.editorTextColor + ';'
  if (es.indentFirstLine) {
    style += 'text-indent:2em;'
  }
  var hasChoices = !articleNodeIsConditional(n) && (n.choices || []).length > 0
  var groups = articleNodeIsConditional(n) ? [] : (n.interactionGroups || [])
  var markerIds = articleInteractionMarkerIds(n.content || '')
  var placedGroupIds = new Set(markerIds)
  var editorContent = buildInteractionEditorContent(n.content || '', groups)
  var h = '<div class="editor-content' + (hasChoices ? ' has-choices' : '') + '">'
  h += '<div class="content-editable" id="ce_' + n.id + '" contenteditable="true" data-a="ce" data-n="' + n.id + '" style="' + esc(style) + '">' + editorContent + '</div>'
  var unplacedGroups = groups.filter(function(group) { return !placedGroupIds.has(group.id) })
  if (unplacedGroups.length) {
    h += '<section class="interaction-unplaced" aria-label="未放置的普通互动"><div><strong>未放置的普通互动</strong><small>内容仍已保存，可放回正文光标处。</small></div>'
    for (var gi = 0; gi < unplacedGroups.length; gi++) {
      var unplaced = unplacedGroups[gi]
      h += '<div class="interaction-unplaced-row" data-unplaced-interaction-group="' + escAttr(unplaced.id) + '"><span>' + esc(unplaced.label || ('普通互动 ' + (gi + 1))) + '</span><button type="button" data-a="place-ig" data-gid="' + escAttr(unplaced.id) + '">放到光标处</button><button type="button" data-a="delete-ig" data-gid="' + escAttr(unplaced.id) + '" aria-label="删除这组普通互动">删除</button></div>'
    }
    h += '</section>'
  }
  // Choice card at bottom
  if (hasChoices) {
    h += '<div class="choice-card" data-a="choice-card" data-w="' + _workId + '" data-n="' + n.id + '">'
    h += '<div class="choice-card-head"><span class="choice-card-title">选项</span></div>'
    h += '<div class="choice-card-btns">'
    for (var ci = 0; ci < n.choices.length; ci++) {
      var c = n.choices[ci]
      var interaction = c.mode === 'interaction'
      h += '<button class="choice-btn" data-a="ch-go" data-w="' + _workId + '" data-n="' + n.id + '" data-cid="' + c.id + '" data-choice-mode="' + (interaction ? 'interaction' : 'branch') + '" data-target="' + esc(c.targetId || '') + '"' + (interaction ? ' aria-pressed="false"' : '') + '><span class="choice-btn-text">' + esc(c.text || '选项') + '</span>' + (interaction ? '<span class="choice-btn-state" aria-hidden="true">已选择</span>' : '') + '</button>'
    }
    h += '</div>'
    h += '</div>'
  }
  h += '</div>'
  return h
}

function interactionGroupById(node, groupId) {
  var matches = (node?.interactionGroups || []).filter(function(group) { return group?.id === groupId })
  return matches.length === 1 ? matches[0] : null
}

function buildInteractionEditorCardHTML(group, index) {
  var count = (group?.choices || []).length
  var label = group?.label || ('普通互动 ' + (index + 1))
  var h = '<div class="' + ARTICLE_INTERACTION_MARKER_CLASS + ' article-interaction-editor-card" contenteditable="false" data-article-interaction-group="' + escAttr(group.id) + '" data-interaction-group-card>'
  h += '<span class="interaction-card-mark" aria-hidden="true">◇</span>'
  h += '<span class="interaction-card-copy"><strong>' + esc(label) + '</strong><small>' + count + ' 个选项 · 阅读时显示在这里</small></span>'
  h += '<span class="interaction-card-actions">'
  h += '<button type="button" data-a="edit-ig" data-gid="' + escAttr(group.id) + '">编辑</button>'
  h += '<button type="button" data-a="move-ig" data-gid="' + escAttr(group.id) + '">移动</button>'
  h += '<button type="button" data-a="delete-ig" data-gid="' + escAttr(group.id) + '" aria-label="删除' + escAttr(label) + '">删除</button>'
  h += '</span></div>'
  return h
}

function buildInteractionEditorContent(content, groups) {
  var template = document.createElement('template')
  template.innerHTML = String(content || '')
  var groupsById = new Map((groups || []).map(function(group, index) { return [group.id, {group:group, index:index}] }))
  var seen = new Set()
  template.content.querySelectorAll('.' + ARTICLE_INTERACTION_MARKER_CLASS).forEach(function(marker) {
    var groupId = marker.getAttribute('data-article-interaction-group') || ''
    var entry = groupsById.get(groupId)
    if (!entry || seen.has(groupId)) {
      marker.remove()
      return
    }
    seen.add(groupId)
    var holder = document.createElement('template')
    holder.innerHTML = buildInteractionEditorCardHTML(entry.group, entry.index)
    marker.replaceWith(holder.content.firstElementChild)
  })
  return template.innerHTML
}

function serializeInteractionEditorContent(editable) {
  if (!editable) return ''
  var clone = editable.cloneNode(true)
  clone.querySelectorAll('.article-interaction-editor-card').forEach(function(card) {
    var marker = document.createElement('template')
    marker.innerHTML = articleInteractionMarkerHTML(card.dataset.articleInteractionGroup || '')
    if (marker.content.firstElementChild) card.replaceWith(marker.content.firstElementChild)
    else card.remove()
  })
  return clone.innerHTML
}

function rangeInsideEditable(editable) {
  var selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  if (selection && selection.rangeCount > 0) {
    var selectedRange = selection.getRangeAt(0)
    if (editable.contains(selectedRange.commonAncestorContainer)) return {selection:selection, range:selectedRange}
  }
  if (!selection) return null
  var range = document.createRange()
  range.selectNodeContents(editable)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return {selection:selection, range:range}
}

function insertInteractionCardAtRange(editable, group, groupIndex, selectedRange) {
  var holder = document.createElement('template')
  holder.innerHTML = buildInteractionEditorCardHTML(group, groupIndex)
  var card = holder.content.firstElementChild
  selectedRange.range.deleteContents()
  selectedRange.range.insertNode(card)
  selectedRange.range.setStartAfter(card)
  selectedRange.range.collapse(true)
  selectedRange.selection.removeAllRanges()
  selectedRange.selection.addRange(selectedRange.range)
  return card
}

function insertArticleInteractionGroup(wid, nid) {
  var work = getWork(wid)
  var node = getNode(wid, nid)
  var editable = document.getElementById('ce_' + nid)
  if (!work || !node || !editable || articleNodeIsConditional(node) || isInteractiveSceneNode(node)) return
  var selectedRange = rangeInsideEditable(editable)
  if (!selectedRange) {
    showToast('请先把光标放在正文中', 'error')
    return
  }
  var group = {
    id:uid(),
    label:'普通互动 ' + ((node.interactionGroups || []).length + 1),
    choices:[
      {id:uid(), text:'', selectedText:''},
      {id:uid(), text:'', selectedText:''},
    ],
    legacyAdvanceOnSelect:false,
  }
  var groups = (node.interactionGroups || []).concat([group])
  insertInteractionCardAtRange(editable, group, groups.length - 1, selectedRange)
  updateNode(wid, nid, {
    content:serializeInteractionEditorContent(editable),
    interactionGroups:groups,
  })
  refreshEditor(wid)
  openInteractionGroupPanel(wid, nid, group.id)
}

function removeInteractionMarkers(content, groupId) {
  var template = document.createElement('template')
  template.innerHTML = String(content || '')
  template.content.querySelectorAll('.' + ARTICLE_INTERACTION_MARKER_CLASS).forEach(function(marker) {
    if (marker.getAttribute('data-article-interaction-group') === groupId) marker.remove()
  })
  return template.innerHTML
}

function placeArticleInteractionGroupAtSelection(wid, nid, groupId) {
  var node = getNode(wid, nid)
  var group = interactionGroupById(node, groupId)
  var editable = document.getElementById('ce_' + nid)
  if (!node || !group || !editable) return
  var selectedRange = rangeInsideEditable(editable)
  if (!selectedRange) return
  editable.querySelectorAll('.article-interaction-editor-card').forEach(function(card) {
    if (card.dataset.articleInteractionGroup === groupId) card.remove()
  })
  insertInteractionCardAtRange(
    editable,
    group,
    (node.interactionGroups || []).findIndex(function(candidate) { return candidate.id === groupId }),
    selectedRange,
  )
  updateNode(wid, nid, {content:serializeInteractionEditorContent(editable)})
  refreshEditor(wid)
  showToast('普通互动已移动')
}

function deleteArticleInteractionGroup(wid, nid, groupId) {
  var node = getNode(wid, nid)
  var group = interactionGroupById(node, groupId)
  if (!node || !group) return
  showConfirm('删除普通互动', '确定删除“' + (group.label || '这组普通互动') + '”？选项记忆条件也会失效。', function() {
    updateNode(wid, nid, {
      content:removeInteractionMarkers(node.content, groupId),
      interactionGroups:(node.interactionGroups || []).filter(function(candidate) { return candidate.id !== groupId }),
    })
    refreshEditor(wid)
    showToast('普通互动已删除')
  })
}

function interactionChoiceRowHTML(choice, index) {
  var h = '<div class="interaction-group-choice-row" data-choice-id="' + escAttr(choice?.id || '') + '">'
  h += '<span class="interaction-choice-order" aria-hidden="true">' + (index + 1) + '</span>'
  h += '<label><span>选项文本</span><input type="text" value="' + escAttr(choice?.text || '') + '" data-interaction-choice-text placeholder="显示在按钮上"></label>'
  h += '<label><span>选择后内容</span><textarea rows="3" data-interaction-selected-text placeholder="选择后插入正文，可分行">' + esc(choice?.selectedText || '') + '</textarea></label>'
  h += '<span class="interaction-choice-actions"><button type="button" data-interaction-action="up" aria-label="上移这个选项">↑</button><button type="button" data-interaction-action="down" aria-label="下移这个选项">↓</button><button type="button" data-interaction-action="remove" aria-label="删除这个选项">删除</button></span>'
  h += '</div>'
  return h
}

function reindexInteractionChoiceRows(list) {
  list.querySelectorAll('.interaction-group-choice-row').forEach(function(row, index) {
    var order = row.querySelector('.interaction-choice-order')
    if (order) order.textContent = String(index + 1)
    var up = row.querySelector('[data-interaction-action="up"]')
    var down = row.querySelector('[data-interaction-action="down"]')
    if (up) up.disabled = index === 0
    if (down) down.disabled = index === list.children.length - 1
  })
}

function openInteractionGroupPanel(wid, nid, groupId) {
  var node = getNode(wid, nid)
  var group = interactionGroupById(node, groupId)
  if (!node || !group) return
  var body = '<div class="interaction-group-panel" data-group-id="' + escAttr(group.id) + '">'
  body += '<header class="interaction-group-head"><div><strong>普通互动</strong><small>放在正文当前位置；每组记住一个选择，不负责剧情跳转。</small></div><label><span>组名称</span><input type="text" data-interaction-group-label value="' + escAttr(group.label || '') + '" placeholder="例如：听到消息后的反应"></label></header>'
  body += '<div class="interaction-group-choice-list">'
  for (var index = 0; index < (group.choices || []).length; index++) {
    body += interactionChoiceRowHTML(group.choices[index], index)
  }
  body += '</div><footer class="interaction-group-footer"><button type="button" class="btn btn-sm btn-outline" data-interaction-action="add">＋ 添加选项</button><span></span><button type="button" class="btn btn-sm btn-ghost" data-interaction-action="move">移动位置</button><button type="button" class="btn btn-sm btn-primary" data-interaction-action="save">保存</button></footer></div>'
  var overlay = modal('', body, '')
  var title = overlay.querySelector('.modal-title')
  if (title) title.parentElement.style.display = 'none'
  var panel = overlay.querySelector('.interaction-group-panel')
  var list = panel.querySelector('.interaction-group-choice-list')
  reindexInteractionChoiceRows(list)

  panel.onclick = function(event) {
    var button = event.target.closest('[data-interaction-action]')
    if (!button) return
    var action = button.dataset.interactionAction
    if (action === 'add') {
      var holder = document.createElement('template')
      holder.innerHTML = interactionChoiceRowHTML({id:'', text:'', selectedText:''}, list.children.length)
      list.appendChild(holder.content.firstElementChild)
      reindexInteractionChoiceRows(list)
      list.lastElementChild.querySelector('[data-interaction-choice-text]')?.focus()
      return
    }
    var row = button.closest('.interaction-group-choice-row')
    if (action === 'remove' && row) {
      if (list.children.length <= 2) {
        showToast('每组普通互动至少需要 2 个选项', 'error')
        return
      }
      row.remove()
      reindexInteractionChoiceRows(list)
      return
    }
    if ((action === 'up' || action === 'down') && row) {
      var sibling = action === 'up' ? row.previousElementSibling : row.nextElementSibling
      if (!sibling) return
      if (action === 'up') list.insertBefore(row, sibling)
      else list.insertBefore(sibling, row)
      reindexInteractionChoiceRows(list)
      row.querySelector('[data-interaction-choice-text]')?.focus()
      return
    }
    if (action === 'move') {
      overlay.remove()
      _movingInteractionGroup = {workId:wid, nodeId:nid, groupId:groupId}
      showToast('请在正文中点击新的放置位置；按 Esc 取消', 'info')
      return
    }
    if (action !== 'save') return
    var drafts = Array.from(list.querySelectorAll('.interaction-group-choice-row')).map(function(choiceRow) {
      return {
        id:choiceRow.dataset.choiceId || '',
        text:choiceRow.querySelector('[data-interaction-choice-text]')?.value?.trim() || '',
        selectedText:choiceRow.querySelector('[data-interaction-selected-text]')?.value || '',
      }
    })
    var emptyIndex = drafts.findIndex(function(choice) { return !choice.text })
    if (emptyIndex >= 0) {
      showToast('选项 #' + (emptyIndex + 1) + ' 未填写文字', 'error')
      return
    }
    var reconciled = reconcileArticleInteractionGroup(group, {
      id:group.id,
      label:panel.querySelector('[data-interaction-group-label]')?.value?.trim() || '',
      choices:drafts,
      legacyAdvanceOnSelect:false,
    }, uid)
    if (!reconciled.ok) {
      showToast('普通互动保存失败，请重新打开后再试', 'error')
      return
    }
    var latestNode = getNode(wid, nid)
    updateNode(wid, nid, {
      interactionGroups:(latestNode.interactionGroups || []).map(function(candidate) {
        return candidate.id === groupId ? reconciled.group : candidate
      }),
    })
    overlay.remove()
    refreshEditor(wid)
    showToast('普通互动已保存')
  }
}

function buildWorldTree(w) {
  var ns = w.nodes || []
  var ch = w.chapters || []
  var renderIndex = createArticleEditorRenderIndex(w)
  var targetPick = _articleTargetPick && _articleTargetPick.workId === w.id ? _articleTargetPick : null
  var viewState = readArticleEditorViewState(w.id, globalThis.localStorage)
  var sidePane = targetPick ? "outline" : viewState.sidePane
  var h = '<aside class="world-tree' + (targetPick ? ' target-pick-mode' : '') + '" data-side-pane="' + sidePane + '" data-work-id="' + esc(w.id) + '"' + (targetPick ? ' data-target-purpose="' + esc(targetPick.purpose) + '"' : '') + '>'
  if (!targetPick) {
    h += '<div class="editor-side-tabs" role="group" aria-label="右侧创作面板">'
    h += '<button type="button" data-a="side-pane" data-pane="outline" aria-controls="articleOutlinePane" aria-pressed="' + (sidePane === "outline" ? "true" : "false") + '">结构</button>'
    h += '<button type="button" data-a="side-pane" data-pane="notes" aria-controls="articleNotesPane" aria-pressed="' + (sidePane === "notes" ? "true" : "false") + '">设定</button>'
    h += '</div>'
  }
  h += '<section class="editor-side-view editor-outline-view" id="articleOutlinePane"' + (sidePane === "outline" ? '' : ' hidden') + '>'
  if (targetPick) {
    h += '<div class="target-picker-head"><div><strong>选择目标节点</strong><small>给当前选项指定去向</small></div>'
    h += '<button type="button" data-a="target-cancel" data-w="' + w.id + '" aria-label="取消选择目标">取消</button></div>'
    h += '<div class="target-picker-search-wrap"><input type="search" class="target-picker-search" aria-label="搜索目标节点" placeholder="搜索章节或节点"></div>'
  } else {
    h += '<div class="wt-header"><span>节点列表</span><div>'
    h += '<button type="button" data-a="outline-overlay-close" aria-label="收起作品结构" title="收起作品结构" class="wt-overlay-close">×</button>'
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
    var nodeActionIndex = 0
    // Render scenes
    for (var ci = 0; ci < ch.length; ci++) {
      var chs = ch[ci]
      var chid = chs.id
      var cNodes = renderIndex.nodesByChapterId.get(chid) || []
      var chapterContentId = 'wtChapterContent_' + ci
      var chapterActionPanelId = 'wtChapterActions_' + ci
      var chapterActionLabel = '章节操作：' + (chs.name || '未命名章节')
      var chapterCollapsed = !targetPick && viewState.collapsedChapterIds.includes(chid)
      h += '<div class="wt-chapter" data-node-drop-chapter data-chapter-id="' + esc(chid) + '">'
      h += '<div class="wt-chapter-title" data-outline-action-host>'
      h += '<button type="button" class="wt-chapter-toggle" data-a="ts" data-w="' + w.id + '" data-sid="' + chid + '" aria-expanded="' + (chapterCollapsed ? 'false' : 'true') + '" aria-controls="' + chapterContentId + '">'
      h += '<span class="arrow' + (chapterCollapsed ? '' : ' open') + '" id="arr_' + chid + '" aria-hidden="true">\u25b6</span><span class="chapter-name">' + esc(chs.name) + '</span><span class="chapter-count">' + cNodes.length + ' 节</span></button>'
      h += '<button type="button" class="wt-action-disclosure" data-a="outline-actions" aria-expanded="false" aria-controls="' + chapterActionPanelId + '" aria-label="' + esc(chapterActionLabel) + '"><span aria-hidden="true">\u22ef</span></button>'
      h += '<span class="chapter-actions wt-action-panel" id="' + chapterActionPanelId + '" role="group" aria-label="' + esc(chapterActionLabel) + '"><button type="button" data-a="chapter-add-node" data-w="' + w.id + '" data-sid="' + chid + '" title="在本章添加正文节点" aria-label="在本章添加正文节点">＋</button><button type="button" data-a="chapter-add-conditional" data-w="' + w.id + '" data-sid="' + chid + '" title="在本章添加隐藏节点" aria-label="在本章添加隐藏节点">隐</button><button type="button" data-a="chapter-add-interactive" data-w="' + w.id + '" data-sid="' + chid + '" title="在本章添加互动页" aria-label="在本章添加互动页">◎</button><button type="button" data-a="chapter-rename" data-w="' + w.id + '" data-sid="' + chid + '" title="重命名章节" aria-label="重命名章节">\u270e</button><button type="button" data-a="chapter-delete" data-w="' + w.id + '" data-sid="' + chid + '" title="删除章节" aria-label="删除章节">\u2715</button></span></div>'
      h += '<div class="wt-chapter-content" id="' + chapterContentId + '" data-node-drop-chapter data-chapter-id="' + esc(chid) + '"' + (chapterCollapsed ? ' hidden' : '') + '>'
      for (var ni = 0; ni < cNodes.length; ni++) {
        var currentActionIndex = nodeActionIndex++
        h += nodeHTML(w, cNodes[ni], currentActionIndex, targetPick, renderIndex)
        var cnode = cNodes[ni]
        var branchChoices = (cnode.choices || []).filter(function(choice) { return choice.mode !== 'interaction' })
        if (!targetPick && branchChoices.length) {
          var choiceContentId = 'wtChoiceList_' + currentActionIndex
          var choicesCollapsed = viewState.collapsedChoiceNodeIds.includes(cnode.id)
          h += '<div class="wt-choice-group" data-choice-source-node="' + esc(cnode.id) + '">'
          h += '<button type="button" class="wt-choice-toggle" data-a="tc" data-w="' + w.id + '" data-n="' + esc(cnode.id) + '" aria-expanded="' + (choicesCollapsed ? 'false' : 'true') + '" aria-controls="' + choiceContentId + '"><span aria-hidden="true">↳</span><span>' + branchChoices.length + ' 个跳转选项</span></button>'
          h += '<div class="wt-choice-list" id="' + choiceContentId + '"' + (choicesCollapsed ? ' hidden' : '') + '>'
          for (var cci = 0; cci < branchChoices.length; cci++) {
            var cc = branchChoices[cci]
            h += '<button type="button" class="wt-choice" data-a="sl" data-w="' + w.id + '" data-n="' + (cc.targetId || '') + '">'
            h += '<span class="wt-choice-arrow" aria-hidden="true">\u21b3</span>'
            h += '<span class="wt-choice-text">' + esc(cc.text || '选项') + '</span>'
            h += '</button>'
          }
          h += '</div></div>'
        }
      }
      h += '</div></div>'
    }
    var uncid = renderIndex.nodesByChapterId.get("") || []
    if (uncid.length) h += '<div class="wt-ungrouped" data-node-drop-chapter data-chapter-id="">'
    for (var ui = 0; ui < uncid.length; ui++) {
      h += nodeHTML(w, uncid[ui], nodeActionIndex++, targetPick, renderIndex)
    }
    if (uncid.length) h += '</div>'
  }
  h += '</div></section>'
  h += buildAuthorNotesPane(w.id, viewState, sidePane === "notes")
  h += '</aside>'
  return h
}

function buildAuthorNotesPane(workId, viewState, active) {
  var notes = readArticleAuthorNotes(workId, globalThis.localStorage)
  var activeSection = viewState.noteSection || "outline"
  if (!AUTHOR_NOTE_SECTION_IDS.includes(activeSection)) activeSection = "outline"
  var h = '<section class="editor-side-view author-notes-pane" id="articleNotesPane"' + (active ? '' : ' hidden') + '>'
  h += '<div class="author-notes-head"><div><strong>作品设定</strong><small>写作时随手查阅的私人资料库</small></div><span data-author-notes-status data-save-state="' + escAttr(_editorPersistenceState.state) + '" role="status" aria-live="polite">' + editorPersistenceCopy(_editorPersistenceState) + '</span></div>'
  h += '<p class="author-notes-privacy"><span aria-hidden="true">◇</span>仅保存在作者端，不进入作品预览与导出文件</p>'
  h += '<label class="author-notes-search"><span class="sr-only">搜索作品设定</span><input type="search" data-author-notes-search aria-label="搜索作品设定" placeholder="搜索分类或已记录内容"><output data-author-notes-search-status aria-live="polite">8 个分类</output></label>'
  h += '<nav class="author-notes-directory" aria-label="设定分类">'
  for (var gi = 0; gi < AUTHOR_NOTE_GROUPS.length; gi++) {
    var group = AUTHOR_NOTE_GROUPS[gi]
    h += '<section class="author-notes-group" data-note-group="' + group.id + '"><h3>' + group.label + '</h3><div>'
    for (var i = 0; i < group.sections.length; i++) {
      var section = group.sections[i]
      var sectionCount = String(notes[section.id] || "").length
      h += '<button type="button" data-a="note-section" data-section="' + section.id + '" aria-controls="authorNote_' + section.id + '" aria-pressed="' + (section.id === activeSection ? "true" : "false") + '">'
      h += '<span><strong>' + section.label + '</strong><small>' + section.hint + '</small></span><span data-note-count aria-label="' + sectionCount + ' 字">' + sectionCount + '</span></button>'
    }
    h += '</div></section>'
  }
  h += '<p class="author-notes-empty" data-author-notes-empty hidden>没有找到相关分类或内容</p></nav>'
  for (var si = 0; si < AUTHOR_NOTE_SECTIONS.length; si++) {
    var item = AUTHOR_NOTE_SECTIONS[si]
    var itemCount = String(notes[item.id] || "").length
    h += '<label class="author-note-editor" id="authorNote_' + item.id + '"' + (item.id === activeSection ? '' : ' hidden') + '>'
    h += '<span class="author-note-editor-head"><span><strong>' + item.label + '</strong><small>' + item.hint + '</small></span><output data-note-editor-count>' + itemCount + ' 字</output></span>'
    h += '<textarea data-author-note="' + item.id + '" maxlength="200000" placeholder="' + item.placeholder + '">' + esc(notes[item.id]) + '</textarea></label>'
  }
  h += '</section>'
  return h
}

function filterAuthorNoteSections(notesPane, query) {
  if (!notesPane) return
  var normalized = String(query || "").trim().toLowerCase()
  var visibleCount = 0
  notesPane.querySelectorAll('[data-a="note-section"]').forEach(function(button) {
    var section = button.dataset.section
    var editor = notesPane.querySelector('[data-author-note="' + section + '"]')
    var haystack = (button.textContent + " " + (editor?.value || "")).toLowerCase()
    var visible = !normalized || haystack.includes(normalized)
    button.hidden = !visible
    if (visible) visibleCount += 1
  })
  notesPane.querySelectorAll("[data-note-group]").forEach(function(group) {
    group.hidden = Array.from(group.querySelectorAll('[data-a="note-section"]')).every(function(button) { return button.hidden })
  })
  var empty = notesPane.querySelector("[data-author-notes-empty]")
  if (empty) empty.hidden = visibleCount !== 0
  var status = notesPane.querySelector("[data-author-notes-search-status]")
  if (status) status.textContent = normalized ? "找到 " + visibleCount + " 个分类" : AUTHOR_NOTE_SECTION_IDS.length + " 个分类"
}

function setEditorSidePane(sidePanel, pane) {
  if (!sidePanel || (pane !== "outline" && pane !== "notes")) return false
  sidePanel.dataset.sidePane = pane
  sidePanel.querySelectorAll('[data-a="side-pane"][data-pane]').forEach(function(control) {
    control.setAttribute("aria-pressed", String(control.dataset.pane === pane))
  })
  var outlinePane = sidePanel.querySelector("#articleOutlinePane")
  var notesPane = sidePanel.querySelector("#articleNotesPane")
  if (outlinePane) outlinePane.hidden = pane !== "outline"
  if (notesPane) notesPane.hidden = pane !== "notes"
  return true
}

function describeDisplayCondition(work, node, renderIndex) {
  var condition = normalizeArticleDisplayCondition(node?.displayCondition)
  if (!condition.all.length) return "未设置条件"
  var labelsById = renderIndex?.conditionLabelByChoiceId
  if (!labelsById) {
    labelsById = new Map()
    buildArticleChoiceCatalog(work).forEach(function(item) {
      if (!item.disabled && !labelsById.has(item.choiceId)) labelsById.set(item.choiceId, item.choiceText)
    })
  }
  return condition.all.map(function(group) {
    return "(" + group.anyChoiceIds.map(function(choiceId) {
      return labelsById.get(choiceId) || "条件已失效"
    }).join(" 或 ") + ")"
  }).join(" 且 ")
}

function nodeHTML(w, n, actionIndex, targetPick, renderIndex) {
  var ac = n.id === _nodeId ? ' active' : ''
  var current = n.id === _nodeId ? ' aria-current="true"' : ''
  var ch = w.chapters || []
  var curCid = n.chapterId || ""
  var canMoveChapter = ch.some(function(c) { return c.id !== curCid })
  var actionPanelId = 'wtNodeActions_' + actionIndex
  var targetDescription = {
    ok:Boolean(renderIndex?.targetPathByNodeId.has(n.id)),
    pathLabel:renderIndex?.targetPathByNodeId.get(n.id),
  }
  var actionLabel = '节点操作：' + (n.title || '未命名节点')
  var targetPath = targetDescription.ok ? targetDescription.pathLabel : (n.title || '未命名节点')
  var conditional = articleNodeIsConditional(n)
  var conditionSummary = conditional ? describeDisplayCondition(w, n, renderIndex) : ""
  var h = '<div class="wt-node' + ac + '" data-outline-action-host data-node-id="' + esc(n.id) + '" data-chapter-id="' + esc(curCid) + '">'
  if (targetPick) {
    h += '<button type="button" class="wt-node-target-select" data-a="target-select" data-w="' + w.id + '" data-n="' + esc(n.id) + '" data-target-path="' + esc(targetPath.toLowerCase()) + '"' + (conditional ? ' disabled aria-disabled="true" title="隐藏节点不能作为起点或选项去向"' : '') + '>'
    h += '<span class="dot" aria-hidden="true"></span><span class="node-label">' + esc(targetPath) + '</span>'
    if (isInteractiveSceneNode(n)) h += '<span class="wt-node-kind-badge">互动</span>'
    if (conditional) h += '<span class="wt-node-kind-badge is-conditional">隐藏</span>'
    if (w.startNode === n.id) h += '<span class="wt-start-badge">起点</span>'
    h += '</button></div>'
    return h
  }
  h += '<button type="button" class="wt-node-drag-handle" aria-label="拖动节点「' + esc(n.title || '节点') + '」排序" title="拖动排序"><span aria-hidden="true">⠿</span></button>'
  h += '<button type="button" class="wt-node-select" data-a="sl" data-w="' + w.id + '" data-n="' + n.id + '"' + current + '>'
  h += '<span class="dot" aria-hidden="true"></span>'
  h += '<span class="node-label">' + esc(n.title || '节点') + '</span>'
  if (isInteractiveSceneNode(n)) h += '<span class="wt-node-kind-badge">互动</span>'
  if (conditional) h += '<span class="wt-node-kind-badge is-conditional">隐藏</span><span class="wt-condition-summary" title="' + esc(conditionSummary) + '">' + esc(conditionSummary) + '</span>'
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
  if (conditional) h += '<button type="button" data-a="edit-display-condition" data-w="' + w.id + '" data-n="' + n.id + '" title="编辑显示条件" aria-label="编辑显示条件">条件</button>'
  h += '<button type="button" data-a="rn2" data-w="' + w.id + '" data-n="' + n.id + '" title="重命名" aria-label="重命名节点">\u270e</button>'
  h += '<button type="button" data-a="dl" data-w="' + w.id + '" data-n="' + n.id + '" title="删除" aria-label="删除节点">\u2715</button>'
  h += '</span></div>'
  return h
}

// ====== Event Delegation ======
document.addEventListener("click", handleClick)
document.addEventListener("change", handleChange)
document.addEventListener("pointerdown", function(event) {
  var button = event.target.closest?.('[data-a]')
  if (button && (FORMAT_COMMANDS[button.dataset.a] || button.dataset.a === "ig" || button.dataset.a === "place-ig")) event.preventDefault()
})
document.addEventListener("selectionchange", syncEditorFormatButtons)
document.addEventListener("keyup", function(event) { if (event.target.closest?.('.content-editable')) syncEditorFormatButtons() })
document.addEventListener("mouseup", function(event) { if (event.target.closest?.('.content-editable')) syncEditorFormatButtons() })

function syncEditorFormatButtons() {
  var editable = document.getElementById('ce_' + _nodeId)
  var selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  var insideEditor = false
  if (editable && selection && selection.rangeCount > 0) {
    insideEditor = editable.contains(selection.getRangeAt(0).commonAncestorContainer)
  }
  Object.keys(FORMAT_COMMANDS).forEach(function(action) {
    var active = false
    if (insideEditor && typeof document.queryCommandState === 'function') {
      try { active = Boolean(document.queryCommandState(FORMAT_COMMANDS[action])) } catch (_) { active = false }
    }
    document.querySelectorAll('[data-a="' + action + '"]').forEach(function(button) {
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  })
}

function handleClick(e) {
  _editorPersistence.flush()
  if (_movingInteractionGroup) {
    var placementEditor = e.target.closest?.(".content-editable")
    if (placementEditor && !e.target.closest(".article-interaction-editor-card")) {
      e.preventDefault()
      placeArticleInteractionGroupAtSelection(
        _movingInteractionGroup.workId,
        _movingInteractionGroup.nodeId,
        _movingInteractionGroup.groupId,
      )
      _movingInteractionGroup = null
      return
    }
  }
  var interactionCard = e.target.closest?.(".article-interaction-editor-card")
  if (interactionCard && !e.target.closest("[data-a]")) {
    openInteractionGroupPanel(_workId, interactionCard.closest(".content-editable")?.dataset.n || _nodeId, interactionCard.dataset.articleInteractionGroup)
    return
  }
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
  if (a === "return-preflight") {
    _editorPersistence.flush()
    globalThis.openWorkPreflight?.(w)
    return
  }
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
      if (_mobilePane === "notes" || _mobilePane === "outline") {
        var mobileSidePanel = mobileShell.querySelector(".world-tree")
        setEditorSidePane(mobileSidePanel, _mobilePane)
        writeArticleEditorViewState(w, {sidePane:_mobilePane}, globalThis.localStorage)
      }
      updateMobileEditorToolAvailability(mobileShell, _mobilePane)
    }
    return
  }
  if (a === "side-pane") {
    var sidePanel = b.closest(".world-tree")
    if (setEditorSidePane(sidePanel, b.dataset.pane)) {
      writeArticleEditorViewState(w, {sidePane:b.dataset.pane}, globalThis.localStorage)
    }
    return
  }
  if (a === "note-section") {
    var notesPane = b.closest("#articleNotesPane")
    var noteSection = b.dataset.section
    if (!notesPane || !AUTHOR_NOTE_SECTION_IDS.includes(noteSection)) return
    notesPane.querySelectorAll('[data-a="note-section"]').forEach(function(control) {
      control.setAttribute("aria-pressed", String(control === b))
    })
    notesPane.querySelectorAll(".author-note-editor").forEach(function(editor) {
      editor.hidden = editor.id !== "authorNote_" + noteSection
    })
    writeArticleEditorViewState(w, {sidePane:"notes", noteSection:noteSection}, globalThis.localStorage)
    notesPane.querySelector('[data-author-note="' + noteSection + '"]')?.focus()
    return
  }
  if (a === "fs-color-reset") {
    writeArticleEditorViewState(w, {editorTextColor:""}, globalThis.localStorage)
    var localColorEditable = document.getElementById("ce_" + _nodeId)
    localColorEditable?.style.removeProperty("color")
    mobileShell?.querySelectorAll('[data-a="fs-color"]').forEach(function(input) { input.value = "#40383b" })
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
    var selectedTargetNode = getNode(w, n)
    if (!targetPickState || targetPickState.workId !== w || !selectedTargetNode || articleNodeIsConditional(selectedTargetNode)) return
    _articleTargetPick = null
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
  if (a === "dl") {
    var deletingNode = getNode(w, n)
    confirmReferencedDeletion({
      wid:w,
      kind:"node",
      id:n,
      title:"删除节点",
      itemName:"节点“" + (deletingNode?.title || "未命名节点") + "”",
      fallbackMessage:"确定删除此节点？",
      onConfirm:function() {
      deleteNode(w, n)
      var remainingNodes = (getWork(w)?.nodes || []).length
      if (remainingNodes === 0) prepareMobilePaneRefresh("outline", true)
      refreshEditor(w)
      },
      onCancel:function() { restoreOutlineActionFocus(outlineActionTrigger, b) },
    })
    return
  }
  if (a === "rn2") {
    var nd = getNode(w, n)
    showPrompt("重命名节点", nd ? nd.title : "", function(nn) {
      if (nn) { renameArticleNode(w, n, nn); refreshEditor(w) }
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
    if (articleNodeIsConditional(getNode(w, _nodeId))) {
      showToast("隐藏节点不能设置选项", "error")
      return
    }
    openChoicePanel(w, _nodeId)
    return
  }
  if (a === "ig") {
    if (articleNodeIsConditional(getNode(w, _nodeId))) {
      showToast("隐藏节点不能设置普通互动", "error")
      return
    }
    insertArticleInteractionGroup(w, _nodeId)
    return
  }
  if (a === "edit-ig") {
    openInteractionGroupPanel(w, n, b.dataset.gid)
    return
  }
  if (a === "move-ig") {
    _movingInteractionGroup = {workId:w, nodeId:n, groupId:b.dataset.gid}
    showToast("请在正文中点击新的放置位置；按 Esc 取消", "info")
    return
  }
  if (a === "place-ig") {
    placeArticleInteractionGroupAtSelection(w, n, b.dataset.gid)
    return
  }
  if (a === "delete-ig") {
    deleteArticleInteractionGroup(w, n, b.dataset.gid)
    return
  }
  if (a === "im") {
    openImagePanel()
    return
  }
  if (a === "is") {
    if (articleNodeIsConditional(getNode(w, _nodeId))) {
      showToast("隐藏节点不能转换为互动页", "error")
      return
    }
    createInteractiveSceneNode(w, _nodeId)
    return
  }
  if (a === "edit-display-condition") {
    openDisplayConditionPanel(w, n)
    return
  }
  if (a === "edit-interactive-node") {
    openInteractiveSceneForNode(w, n)
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
    if (b.dataset.choiceMode === 'interaction') {
      b.closest('.choice-card-btns')?.querySelectorAll('[data-choice-mode="interaction"]').forEach(function(option) {
        var selected = option === b
        option.classList.toggle('is-selected', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      return
    }
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
    var chapterView = readArticleEditorViewState(w, globalThis.localStorage)
    var collapsedChapters = chapterView.collapsedChapterIds.filter(function(id) { return id !== b.dataset.sid })
    if (!nextExpanded) collapsedChapters.push(b.dataset.sid)
    writeArticleEditorViewState(w, {collapsedChapterIds:collapsedChapters}, globalThis.localStorage)
    return
  }
  if (a === "tc") {
    var choicesExpanded = b.getAttribute("aria-expanded") === "true"
    var nextChoicesExpanded = !choicesExpanded
    var choiceList = document.getElementById(b.getAttribute("aria-controls"))
    b.setAttribute("aria-expanded", String(nextChoicesExpanded))
    if (choiceList) choiceList.hidden = !nextChoicesExpanded
    var choiceView = readArticleEditorViewState(w, globalThis.localStorage)
    var collapsedChoiceNodes = choiceView.collapsedChoiceNodeIds.filter(function(id) { return id !== n })
    if (!nextChoicesExpanded) collapsedChoiceNodes.push(n)
    writeArticleEditorViewState(w, {collapsedChoiceNodeIds:collapsedChoiceNodes}, globalThis.localStorage)
    return
  }
  if (a === "chapter-add-node") {
    var sid = b.dataset.sid
    var chapterNode = addNode(w, undefined, sid)
    if (chapterNode) {
      var chapterNodeWork = getWork(w)
      var defaultScene = (chapterNodeWork.scenes || [])[0]
      if (defaultScene) updateNode(w, chapterNode.id, {scene: defaultScene.id})
      _nodeId = chapterNode.id
      prepareMobilePaneRefresh("editor", true)
      refreshEditor(w)
    }
    return
  }
  if (a === "chapter-add-conditional") {
    var conditionalChapterId = b.dataset.sid
    var conditionalWork = getWork(w)
    var conditionalChapterNodes = (conditionalWork?.nodes || []).filter(function(node) {
      return String(node.chapterId || "") === String(conditionalChapterId || "")
    })
    if (!conditionalChapterNodes.some(function(node) { return !articleNodeIsConditional(node) })) {
      showToast("请先在本章添加正文节点", "error")
      return
    }
    var conditionalNode = createConditionalArticleNode(
      w,
      conditionalChapterId,
      conditionalChapterNodes[conditionalChapterNodes.length - 1]?.id,
    )
    if (!conditionalNode) {
      showToast("请先在本章添加正文节点", "error")
      return
    }
    _nodeId = conditionalNode.id
    prepareMobilePaneRefresh("editor", true)
    refreshEditor(w)
    openDisplayConditionPanel(w, conditionalNode.id)
    return
  }
  if (a === "chapter-add-interactive") {
    var interactiveChapterId = b.dataset.sid
    var interactiveChapterWork = getWork(w)
    var interactiveChapterNodes = (interactiveChapterWork?.nodes || []).filter(function(node) {
      return String(node.chapterId || "") === String(interactiveChapterId || "")
    })
    createInteractiveSceneNode(
      w,
      interactiveChapterNodes[interactiveChapterNodes.length - 1]?.id || null,
      interactiveChapterId,
    )
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
  _editorPersistence.flush()
  var b = e.target.closest("[data-a]")
  if (!b) return
  var mobileShell = b.closest(".editor-body-area")
  var outlineActionTrigger = _outlineActionMenu.closeForAction(b)
  var a = b.dataset.a
  var w = b.dataset.w || _workId
  var n = b.dataset.n || _nodeId

  // Node title rename (from editor header input)
  if (a === "rn") {
    renameArticleNode(w, n, b.value)
    return
  }

  // Native select controls reliably commit through change on touch and keyboard.
  if (a === "ss") {
    if (b.value === "__add_scene__") {
      var currentScene = getNode(w, n)?.scene || ""
      b.value = currentScene
      showPrompt("新建场景", "例如：雨夜", function(sceneName) {
        var scene = addScene(w, sceneName)
        if (!scene) {
          showToast("场景添加失败，请重试", "error")
          return
        }
        updateNode(w, n, {scene:scene.id})
        refreshEditor(w)
      }, function() {
        b.focus()
      })
      return
    }
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
  if (a === "fs-color") {
    var localTextColor = /^#[0-9a-f]{6}$/i.test(b.value) ? b.value.toLowerCase() : ""
    writeArticleEditorViewState(w, {editorTextColor:localTextColor}, globalThis.localStorage)
    var localTextEditable = document.getElementById("ce_" + _nodeId)
    if (localTextEditable) localTextEditable.style.color = localTextColor
    mobileShell?.querySelectorAll('[data-a="fs-color"]').forEach(function(input) {
      input.value = localTextColor || "#40383b"
    })
    return
  }
  if (a === "fs-font") {
    var val = b.value
    if (val === "__manage__") {
      openEditorFontManager(_workId)
      return
    }
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
  var viewState = readArticleEditorViewState(_workId, globalThis.localStorage)
  var ce = document.getElementById("ce_" + _nodeId)
  if (!ce) return
  ce.style.fontFamily = es.fontFamily || DEFAULT_EDITOR_SETTINGS.fontFamily
  ce.style.fontSize = (es.fontSize || DEFAULT_EDITOR_SETTINGS.fontSize) + 'px'
  ce.style.lineHeight = es.lineHeight || DEFAULT_EDITOR_SETTINGS.lineHeight
  ce.style.letterSpacing = (es.letterSpacing || 0) + 'px'
  ce.style.padding = (es.marginTop || 24) + 'px ' + (es.marginRight || 32) + 'px ' + (es.marginBottom || 24) + 'px ' + (es.marginLeft || 32) + 'px'
  ce.style.textIndent = es.indentFirstLine ? '2em' : '0'
  ce.style.color = viewState.editorTextColor || ''
}

// SVG icon for help button: circle with question mark
var HELP_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6.2 5.8c.3-.5.8-.8 1.8-.8s1.5.3 1.5 1c0 .7-.5 1.1-1.2 1.4l-.3.1v1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" fill="none"/><circle cx="8" cy="11.5" r="0.7" fill="currentColor"/></svg>'

var PH_TUTORIAL = '' +
'<div class="ph-tutorial"><b>占位符使用说明</b>' +
'<p>占位符用于在导出 HTML 时替换正文中的特定文字，让每个读者获得个性化的阅读体验。</p>' +
'<p><b>全文替换 (each)：</b>全文所有出现处统一替换为读者所填的同一个值。适合姓名、昵称等。</p>' +
'<p><b>随机替换 (random)：</b>每次出现时从读者填写的值池中随机选一个。适合"喜欢的颜色"这类可能有多个答案的问题。</p>' +
'<p><b>场景锁定 (scene)：</b>每个“场景标签”固定一个值。节点顶部选择同一个场景时会保持一致；它与作品结构里的章节不是同一项。</p>' +
'<p><b>标记 (key)：</b>正文中要被替换的文字。作者自定义，如"某某"、"1"等，在正文中写入这些标记即可。</p>' +
'<p><b>问题 (prompt)：</b>对读者提出的问题。如"你的名字？"</p>' +
'<p><b>违禁词：</b>设置后读者不可填写这些内容。</p>' +
'<p>点击"添加 NAME 预设"一键创建姓名/昵称/网名三个占位符。</p></div>'

function openPlaceholderPanel(wid) {
  var w = getWork(wid)
  if (!w) return
  var phs = w.placeholders || []
  var globalForbidden = parseForbiddenWords(w.globalForbidden)
  var authorPresets = readAuthorPlaceholderPresets()
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
  body += '<label class="placeholder-tool-search"><span class="sr-only">搜索占位符或违禁词</span><input type="search" class="ph-input" data-placeholder-search placeholder="搜索名称、标记、问题或违禁词"><span data-placeholder-search-status aria-live="polite"></span></label>'
  body += '<section class="placeholder-global-forbidden"><div><strong>全局违禁词</strong><small>对当前作品的所有占位符生效</small></div><textarea id="phGlobalForbidden" class="ph-input" placeholder="可用换行、逗号、顿号、分号或斜杠分隔">' + esc(globalForbidden.join('\n')) + '</textarea><button type="button" class="btn btn-sm btn-outline" data-ph-a="cleanup-forbidden">整理全部词库</button></section>'
  body += '<div class="ph-author-presets"><select class="ph-select" id="phAuthorPreset"><option value="">我的预设</option>'
  body += '</select><button class="btn btn-sm btn-outline" data-ph-a="apply-author-preset">套用预设</button><details class="placeholder-preset-management"><summary>管理预设</summary><div><button class="btn btn-sm btn-ghost" data-ph-a="save-author-preset">保存当前为预设</button><button class="btn btn-sm btn-ghost" data-ph-a="delete-author-preset">删除预设</button><button class="btn btn-sm btn-ghost" data-ph-a="export-author-presets">导出预设</button><button class="btn btn-sm btn-ghost" data-ph-a="import-author-presets">导入预设</button></div></details><input type="file" id="phAuthorPresetFile" accept=".json,application/json" hidden></div>'

  // List
  body += '<div class="ph-list">'
  if (phs.length === 0) {
    body += '<div class="ph-empty">暂无占位符。点击上方按钮添加。</div>'
  }
  for (var i = 0; i < phs.length; i++) {
    var ph = phs[i]
    body += buildPhCard(ph, globalForbidden)
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
    function refreshAuthorPresetSelect(selectedId) {
      authorPresets = readAuthorPlaceholderPresets()
      var select = panel.querySelector('#phAuthorPreset')
      if (!select) return
      select.innerHTML = '<option value="">我的预设</option>'
      authorPresets.forEach(function(preset) {
        var option = document.createElement('option')
        option.value = preset.id
        option.textContent = preset.name
        select.appendChild(option)
      })
      if (selectedId) select.value = selectedId
    }

    function collectVisiblePlaceholders() {
      var latest = getWork(wid)
      return (latest && latest.placeholders || []).map(function(ph) {
        var card = Array.from(panel.querySelectorAll('[data-ph-id]')).find(function(item) { return String(item.dataset.phId) === String(ph.id) })
        if (!card) return ph
        return Object.assign({}, ph, {
          label: document.getElementById('ph_label_' + ph.id)?.value?.trim() || ph.label || '占位符',
          key: document.getElementById('ph_key_' + ph.id)?.value?.trim() || ph.key || '',
          prompt: document.getElementById('ph_prompt_' + ph.id)?.value?.trim() || ph.prompt || '',
          mode: document.getElementById('ph_mode_' + ph.id)?.value || ph.mode || 'each',
          forbidden: parseForbiddenWords(card.querySelector('[data-ph-forbidden]')?.value)
        })
      })
    }

    function applyPlaceholderSearch() {
      var query = String(panel.querySelector('[data-placeholder-search]')?.value || '').trim().toLocaleLowerCase()
      var visible = 0
      panel.querySelectorAll('[data-ph-id]').forEach(function(card) {
        var haystack = Array.from(card.querySelectorAll('input,textarea,select')).map(function(field) {
          return field.value || ''
        }).join(' ') + ' ' + (card.textContent || '')
        haystack = haystack.toLocaleLowerCase()
        card.hidden = Boolean(query) && !haystack.includes(query)
        if (!card.hidden) visible += 1
      })
      var status = panel.querySelector('[data-placeholder-search-status]')
      if (status) status.textContent = query ? visible + ' 个结果' : ''
    }
    panel.querySelector('[data-placeholder-search]').oninput = applyPlaceholderSearch
    panel.querySelector('#phGlobalForbidden').onchange = function() {
      globalForbidden = parseForbiddenWords(this.value)
      this.value = globalForbidden.join('\n')
      updateWork(wid, { globalForbidden:globalForbidden })
      panel.querySelectorAll('[data-global-forbidden-summary]').forEach(function(summary) {
        summary.outerHTML = buildInheritedForbiddenSummary(globalForbidden)
      })
      showToast('全局违禁词已保存')
    }

    refreshAuthorPresetSelect('')

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
      if (act === 'cleanup-forbidden') {
        var current = collectVisiblePlaceholders()
        globalForbidden = parseForbiddenWords(panel.querySelector('#phGlobalForbidden')?.value)
        current.forEach(function(placeholder) {
          updatePlaceholder(wid, placeholder.id, {
            label:placeholder.label,
            key:placeholder.key,
            prompt:placeholder.prompt,
            mode:placeholder.mode,
            forbidden:dedupeForbiddenWords(placeholder.forbidden),
          })
        })
        updateWork(wid, { globalForbidden:globalForbidden })
        panel.querySelector('#phGlobalForbidden').value = globalForbidden.join('\n')
        refreshPhList(wid, ov)
        applyPlaceholderSearch()
        showToast('词库已整理并应用')
        return
      }
      if (act === 'export-author-presets') {
        var presets = readAuthorPlaceholderPresets()
        if (!presets.length) { showToast('请先保存一套作者预设'); return }
        var presetBundle = serializeAuthorPlaceholderPresetBundle(presets)
        downloadBlob(new Blob([presetBundle], { type:'application/json;charset=utf-8' }), 'tuuru-placeholder-presets.json')
        showToast('占位符预设已导出')
        return
      }
      if (act === 'import-author-presets') {
        panel.querySelector('#phAuthorPresetFile')?.click()
        return
      }
      if (act === 'save-author-preset') {
        var current = collectVisiblePlaceholders()
        if (!current.length) { showToast('请先添加占位符'); return }
        showPrompt('保存当前为预设', '给这套预设起个名字', function(name) {
          var saved = saveAuthorPlaceholderPreset(name, current, {
            globalForbidden:parseForbiddenWords(panel.querySelector('#phGlobalForbidden')?.value),
          })
          if (!saved) { showToast('预设保存失败'); return }
          refreshAuthorPresetSelect(saved.id)
          showToast('作者预设已保存在本机')
        })
        return
      }
      if (act === 'apply-author-preset') {
        var presetId = panel.querySelector('#phAuthorPreset')?.value || ''
        var preset = authorPresets.find(function(item) { return item.id === presetId })
        if (!preset) { showToast('请先选择预设'); return }
        var currentWork = getWork(wid)
        var created = instantiateAuthorPlaceholderPreset(preset, uid)
        globalForbidden = dedupeForbiddenWords([
          ...parseForbiddenWords(panel.querySelector('#phGlobalForbidden')?.value || currentWork.globalForbidden),
          ...(preset.globalForbidden || []),
        ])
        updateWork(wid, {
          placeholders:(currentWork.placeholders || []).concat(created),
          globalForbidden:globalForbidden,
        })
        panel.querySelector('#phGlobalForbidden').value = globalForbidden.join('\n')
        refreshPhList(wid, ov)
        showToast('已套用预设')
        return
      }
      if (act === 'delete-author-preset') {
        var selectedId = panel.querySelector('#phAuthorPreset')?.value || ''
        var selectedPreset = authorPresets.find(function(item) { return item.id === selectedId })
        if (!selectedPreset) { showToast('请先选择预设'); return }
        showConfirm('删除作者预设', '确定删除“' + selectedPreset.name + '”吗？不会影响已经使用它的作品。', function() {
          deleteAuthorPlaceholderPreset(selectedId)
          refreshAuthorPresetSelect('')
          showToast('预设已删除')
        })
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
    })

    var authorPresetFileInput = panel.querySelector('#phAuthorPresetFile')
    if (authorPresetFileInput) authorPresetFileInput.onchange = async function() {
      var file = authorPresetFileInput.files?.[0]
      authorPresetFileInput.value = ''
      if (!file) return
      try {
        importAuthorPlaceholderPresetBundle(await file.text())
        refreshAuthorPresetSelect('')
        showToast('占位符预设已导入本机')
      } catch (error) {
        showToast(error?.message || '占位符预设文件无法读取')
      }
    }
  }

  // Click outside to close
  ov.addEventListener('click', function(ev) {
    if (ev.target === ov) ov.remove()
  })
}

function buildInheritedForbiddenSummary(words) {
  var inherited = parseForbiddenWords(words)
  var h = '<div class="placeholder-inherited-forbidden" data-global-forbidden-summary aria-label="全局生效的违禁词"' + (inherited.length ? '' : ' hidden') + '>'
  h += '<span class="placeholder-inherited-label">全局生效</span><span class="placeholder-inherited-words">'
  inherited.forEach(function(word) {
    h += '<span class="placeholder-inherited-word">' + esc(word) + '</span>'
  })
  h += '</span></div>'
  return h
}

function buildPhCard(ph, globalForbidden) {
  var fw = parseForbiddenWords(ph.forbidden)
  var h = '<div class="ph-card" data-ph-id="' + ph.id + '">'
  h += '<div class="ph-card-head">'
  h += '<label class="sr-only" for="ph_label_' + ph.id + '">显示名称</label>'
  h += '<input class="ph-card-label" id="ph_label_' + ph.id + '" value="' + esc(ph.label || '占位符') + '" placeholder="显示名称，例如：外号">'
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
  h += '<textarea class="ph-input ph-forbidden-input" id="ph_forbidden_' + ph.id + '" data-ph-forbidden placeholder="多个词可用逗号、顿号或换行分隔">' + esc(fw.join('\n')) + '</textarea>'
  h += '</div>'
  h += buildInheritedForbiddenSummary(globalForbidden)
  // Save button
  h += '<div class="ph-row ph-row-end">'
  h += '<button class="btn btn-sm btn-primary" data-ph-a="save">保存</button>'
  h += '</div>'
  h += '</div>'
  h += '</div>'
  return h
}

function savePhCard(wid, pid) {
  var labelEl = document.getElementById('ph_label_' + pid)
  var keyEl = document.getElementById('ph_key_' + pid)
  var promptEl = document.getElementById('ph_prompt_' + pid)
  var modeEl = document.getElementById('ph_mode_' + pid)
  var forbiddenEl = document.getElementById('ph_forbidden_' + pid)
  updatePlaceholder(wid, pid, {
    label: (labelEl?.value || '').trim() || '占位符',
    key: (keyEl?.value || '').trim(),
    prompt: (promptEl?.value || '').trim(),
    mode: modeEl?.value || 'each',
    forbidden: parseForbiddenWords(forbiddenEl?.value),
  })
  showToast('已保存')
}

function refreshPhList(wid, overlay) {
  var w = getWork(wid)
  var phs = w.placeholders || []
  var globalForbidden = parseForbiddenWords(w.globalForbidden)
  var listEl = overlay.querySelector('.ph-list')
  if (!listEl) return
  var h = ''
  if (phs.length === 0) {
    h = '<div class="ph-empty">暂无占位符。点击上方按钮添加。</div>'
  }
  for (var i = 0; i < phs.length; i++) {
    h += buildPhCard(phs[i], globalForbidden)
  }
  listEl.innerHTML = h
}

function openChoicePanel(wid, nid, options) {
  var w = getWork(wid)
  if (!w) return
  var node = getNode(wid, nid)
  if (!node) return
  if (articleNodeIsConditional(node)) {
    showToast("隐藏节点不能设置选项", "error")
    return
  }
  var choices = Array.isArray(options?.draftChoices)
    ? JSON.parse(JSON.stringify(options.draftChoices))
    : JSON.parse(JSON.stringify(node.choices || []))
  var allNodes = w.nodes || []
  var choiceMode = choices.length > 0 && choices.every(function(choice) { return choice.mode === 'interaction' }) ? 'interaction' : 'branch'

  var body = '<div class="ch-panel" id="chPanel" data-choice-mode="branch">'
  body += '<div class="ch-header"><span class="ch-header-title">剧情分支 -- ' + esc(node.title || '节点') + '</span><select id="chMode" hidden aria-hidden="true" tabindex="-1"><option value="branch"' + (choiceMode === 'branch' ? ' selected' : '') + '>剧情分支</option><option value="interaction"' + (choiceMode === 'interaction' ? ' selected' : '') + '>旧版普通互动</option></select><small class="ch-mode-hint">剧情分支固定显示在节点正文末尾，每个选项都必须连接目标节点。正文中的普通互动请使用“普通互动”工具添加。</small></div>'
  body += '<div class="ch-list" id="chList">'

  for (var i = 0; i < choices.length; i++) {
    body += chRowHTML(wid, nid, choices[i], i, allNodes)
  }

  body += '</div>'
  body += '<div class="ch-footer">'
  body += '<button class="btn btn-sm btn-outline" data-ch-a="add-choice">+ 添加选项</button>'
  body += '<button class="btn btn-sm btn-primary" data-ch-a="save">保存</button>'
  body += '<button class="btn btn-sm btn-ghost" data-ch-a="delete-all">删除剧情分支</button>'
  body += '</div>'
  body += '</div>'

  var ov = modal('', body, '')
  var titleEl = ov.querySelector('.modal-title')
  if (titleEl) titleEl.parentElement.style.display = 'none'

  var panel = ov.querySelector('#chPanel')
  var listEl = ov.querySelector('#chList')

  function applyChoiceMode(mode) {
    var interaction = mode === 'interaction'
    panel.dataset.choiceMode = interaction ? 'interaction' : 'branch'
    listEl.querySelectorAll('.ch-target-pick,.ch-target-inspect').forEach(function(control) { control.hidden = interaction })
    listEl.querySelectorAll('.ch-selected-field').forEach(function(field) {
      field.hidden = !interaction
      var selectedInput = field.querySelector('.ch-selected-text')
      var optionInput = field.closest('.ch-item')?.querySelector('.ch-text')
      if (interaction && selectedInput && selectedInput.dataset.selectedAuthored !== 'true') {
        selectedInput.value = optionInput?.value || ''
      }
    })
  }
  applyChoiceMode(choiceMode)
  var modeSelect = panel.querySelector('#chMode')
  if (modeSelect) modeSelect.onchange = function() { applyChoiceMode(modeSelect.value) }
  listEl.addEventListener('input', function(ev) {
    var selectedInput = ev.target.closest('.ch-selected-text')
    if (selectedInput) {
      selectedInput.dataset.selectedAuthored = 'true'
      selectedInput.dataset.selectedDirty = 'true'
    }
  })

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
        applyChoiceMode(modeSelect?.value || choiceMode)
        return
      }
      if (act === 'del-choice') {
        var item = btn.closest('.ch-item')
        if (item) {
          if (listEl.children.length <= 2) {
            showToast('至少需要 2 个选项', 'error')
            return
          }
          var removeChoiceRow = function() {
            item.remove()
            reindexChRows(listEl)
          }
          var deletingChoiceId = item.dataset.choiceId || ''
          if (!deletingChoiceId) {
            removeChoiceRow()
            return
          }
          var deletingChoiceText = item.querySelector('.ch-text')?.value?.trim() || '未命名选项'
          var choiceReferences = findWorkReferences(getWork(wid), {kind:"choice", id:deletingChoiceId})
          if (!choiceReferences.length) {
            removeChoiceRow()
            return
          }
          openDeletionImpactDialog({
            title:'删除选项',
            itemName:'选项“' + deletingChoiceText + '”',
            references:choiceReferences,
            onConfirm:removeChoiceRow,
            onLocate:function(reference) {
              ov.remove()
              locateEditorReference(wid, reference)
            },
          })
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
        showConfirm('删除剧情分支', '确定删除此节点末尾的剧情分支？', function() {
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
  var mode = listEl.closest('.ch-panel')?.querySelector('#chMode')?.value === 'interaction' ? 'interaction' : 'branch'
  return Array.from(listEl.querySelectorAll('.ch-item')).map(function(row) {
    var selectedInput = row.querySelector('.ch-selected-text')
    var draft = {
      id: row.dataset.choiceId || '',
      text: row.querySelector('.ch-text')?.value || '',
      targetId: row.querySelector('.ch-target-pick')?.dataset.targetId || '',
      mode: mode
    }
    if (selectedInput?.dataset.selectedAuthored === 'true') draft.selectedText = selectedChoiceTextDraft(selectedInput)
    return draft
  })
}

function selectedChoiceTextDraft(input) {
  if (!input || input.dataset.selectedDirty === 'true') return input?.value || ''
  try {
    var original = JSON.parse(input.dataset.selectedOriginal || '')
    if (typeof original === 'string') return original
  } catch (_) {}
  return input.value || ''
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
    if (drafts[i].mode !== 'interaction' && !drafts[i].targetId) {
      showToast('选项 #' + (i + 1) + ' 未选择目标节点', 'error')
      return false
    }
    if (drafts[i].mode !== 'interaction' && !describeArticleTarget(work, drafts[i].targetId).ok) {
      showToast('选项 #' + (i + 1) + ' 的目标节点已不存在，请重新选择', 'error')
      return false
    }
    if (drafts[i].mode === 'interaction') {
      drafts[i].targetId = ''
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
  var hasAuthoredSelectedText = Object.prototype.hasOwnProperty.call(choice || {}, 'selectedText')
  var selectedText = hasAuthoredSelectedText ? (choice.selectedText ?? '') : (choice.text ?? '')
  var selectedTextOriginal = JSON.stringify(selectedText)
  var h = '<div class="ch-item" data-ch-idx="' + idx + '" data-choice-id="' + escAttr(choice.id || '') + '">'
  h += '<span class="ch-num">#' + (idx + 1) + '</span>'
  h += '<label class="ch-field ch-choice-text"><span class="ch-field-copy"><span class="ch-field-label">选项文本</span><small class="ch-field-help">显示在读者点击的按钮上</small></span><input class="ch-text" id="ch_text_' + idx + '" value="' + escAttr(choice.text || '') + '" placeholder="读者按钮上的文字" aria-label="选项文本"></label>'
  h += '<label class="ch-field ch-selected-field"><span class="ch-field-copy"><span class="ch-field-label">选择后内容</span><small class="ch-field-help">点击后插入正文，每行显示为独立正文段落</small></span><textarea class="ch-selected-text" id="ch_selected_text_' + idx + '" rows="3" placeholder="读者选择后显示的内容" aria-label="选择后内容" data-selected-authored="' + (hasAuthoredSelectedText ? 'true' : 'false') + '" data-selected-dirty="false" data-selected-original="' + escAttr(selectedTextOriginal) + '">' + esc(selectedText) + '</textarea></label>'
  h += '<button type="button" class="ch-target-pick' + (choice.targetId && !target.ok ? ' invalid' : '') + '" data-ch-a="pick-target" data-target-id="' + escAttr(choice.targetId || '') + '"><span>' + esc(targetLabel) + '</span><b aria-hidden="true">›</b></button>'
  if (target.ok) h += '<button type="button" class="ch-target-inspect" data-ch-a="inspect-target" data-target-id="' + escAttr(choice.targetId) + '" title="查看目标节点" aria-label="查看目标节点">查看</button>'
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
    var selectedText = row.querySelector('.ch-selected-text')
    if (selectedText) selectedText.id = 'ch_selected_text_' + i
    var delBtn = row.querySelector('.ch-del-btn')
    if (delBtn) delBtn.dataset.chIdx = i
  }
}

function openDisplayConditionPanel(wid, nid) {
  var work = getWork(wid)
  var node = getNode(wid, nid)
  if (!work || !articleNodeIsConditional(node)) return
  var normalized = normalizeArticleDisplayCondition(node.displayCondition)
  var groups = normalized.all.map(function(group) { return group.anyChoiceIds.slice() })
  if (!groups.length) groups.push([])

  var ov = modal('', '<div class="condition-panel" id="conditionPanel"></div>', '')
  var titleEl = ov.querySelector('.modal-title')
  if (titleEl) titleEl.parentElement.style.display = 'none'
  var panel = ov.querySelector('#conditionPanel')
  if (!panel) {
    ov.remove()
    return
  }

  function catalog() {
    return buildArticleChoiceCatalog(getWork(wid), {excludeNodeId:nid})
  }

  function choiceById(choiceId) {
    var matches = catalog().filter(function(item) { return item.choiceId === choiceId })
    return matches.length === 1 ? matches[0] : null
  }

  function choiceLabel(item) {
    var source = item.choiceMode === "interaction"
      ? "普通互动「" + (item.interactionGroupLabel || "未命名") + "」"
      : "剧情分支"
    return item.chapterName + " · " + item.sourceNodeTitle + " · " + source + " · " + item.choiceText
  }

  function resultHTML(item, groupIndex) {
    var disabled = item.disabled || groups[groupIndex].includes(item.choiceId)
    var h = '<button type="button" class="condition-choice-result' + (item.disabled ? ' is-invalid' : '') + '" data-condition-a="add-choice" data-group-index="' + groupIndex + '" data-choice-id="' + escAttr(item.choiceId) + '"' + (disabled ? ' disabled' : '') + '>'
    h += '<span>' + esc(choiceLabel(item)) + '</span>'
    h += '<small>ID ' + esc(item.choiceId) + (item.disabled ? ' · 不可引用' : '') + '</small>'
    h += '</button>'
    return h
  }

  function renderResults(groupElement, groupIndex, query) {
    var results = buildArticleChoiceCatalog(getWork(wid), {query:query, excludeNodeId:nid}).slice(0, 50)
    var resultsElement = groupElement.querySelector('.condition-choice-results')
    if (!resultsElement) return
    resultsElement.innerHTML = results.length
      ? results.map(function(item) { return resultHTML(item, groupIndex) }).join('')
      : '<p class="condition-empty">没有找到相关选项</p>'
  }

  function renderPanel() {
    var selectedTotal = groups.reduce(function(total, group) { return total + group.length }, 0)
    var h = '<div class="condition-head"><div><strong>隐藏节点显示条件</strong><p>以下条件全部满足时显示；同一组内满足任一项即可。</p><span class="condition-rule-summary">' + groups.length + ' 组条件 · 已引用 ' + selectedTotal + ' 个选项</span></div><button type="button" data-condition-a="cancel" aria-label="关闭显示条件编辑">×</button></div>'
    h += '<div class="condition-groups">'
    groups.forEach(function(choiceIds, groupIndex) {
      if (groupIndex > 0) h += '<div class="condition-group-join" aria-hidden="true"><span>并且</span></div>'
      h += '<section class="condition-group" data-group-index="' + groupIndex + '" aria-label="条件组 ' + (groupIndex + 1) + '">'
      h += '<div class="condition-group-head"><div class="condition-group-title"><span class="condition-group-index" aria-hidden="true">' + (groupIndex + 1) + '</span><span><strong>条件组 ' + (groupIndex + 1) + '</strong><small>' + (groupIndex === 0 ? '基础条件' : '附加条件') + '</small></span></div><div><output data-condition-selected-count>' + choiceIds.length + ' 项</output><button type="button" data-condition-a="remove-group" data-group-index="' + groupIndex + '" aria-label="删除条件 ' + (groupIndex + 1) + '">删除</button></div></div>'
      h += '<div class="condition-logic"><strong>任一项（或）</strong><span>满足其中一项即可</span></div><div class="condition-selected">'
      if (!choiceIds.length) h += '<span class="condition-empty">还没有引用选项，请从下方搜索结果中添加。</span>'
      choiceIds.forEach(function(choiceId) {
        var item = choiceById(choiceId)
        if (!item || item.disabled) {
          h += '<span class="condition-reference is-invalid"><span>条件已失效 · ' + esc(choiceId) + '</span><button type="button" data-condition-a="remove-choice" data-group-index="' + groupIndex + '" data-choice-id="' + escAttr(choiceId) + '" aria-label="移除失效条件 ' + escAttr(choiceId) + '">×</button></span>'
          return
        }
        h += '<span class="condition-reference"><span>' + esc(choiceLabel(item)) + '</span><small>ID ' + esc(choiceId) + '</small><button type="button" data-condition-a="remove-choice" data-group-index="' + groupIndex + '" data-choice-id="' + escAttr(choiceId) + '" aria-label="移除条件 ' + escAttr(item.choiceText) + '">×</button></span>'
      })
      h += '</div>'
      h += '<label class="condition-search"><span>搜索相关选项</span><input type="search" data-condition-search data-group-index="' + groupIndex + '" placeholder="搜索选项文字、节点、章节或 ID" autocomplete="off"></label>'
      h += '<div class="condition-choice-results">'
      h += catalog().slice(0, 50).map(function(item) { return resultHTML(item, groupIndex) }).join('')
      h += '</div></section>'
    })
    h += '</div><div class="condition-actions"><button type="button" class="btn btn-sm btn-outline" data-condition-a="add-group">+ 添加附加条件（且）</button><button type="button" class="btn btn-sm btn-primary" data-condition-a="save">保存显示条件</button></div>'
    panel.innerHTML = h
  }

  panel.addEventListener('input', function(event) {
    var input = event.target.closest('[data-condition-search]')
    if (!input) return
    var groupIndex = Number(input.dataset.groupIndex)
    var groupElement = input.closest('.condition-group')
    if (!Number.isInteger(groupIndex) || !groups[groupIndex] || !groupElement) return
    renderResults(groupElement, groupIndex, input.value)
  })

  panel.addEventListener('click', function(event) {
    var button = event.target.closest('[data-condition-a]')
    if (!button) return
    var action = button.dataset.conditionA
    var groupIndex = Number(button.dataset.groupIndex)
    if (action === 'cancel') {
      ov.remove()
      return
    }
    if (action === 'add-group') {
      groups.push([])
      renderPanel()
      return
    }
    if (action === 'remove-group') {
      if (!Number.isInteger(groupIndex) || !groups[groupIndex]) return
      if (groups.length === 1) groups[0] = []
      else groups.splice(groupIndex, 1)
      renderPanel()
      return
    }
    if (action === 'add-choice') {
      var choiceId = button.dataset.choiceId || ''
      var item = choiceById(choiceId)
      if (!Number.isInteger(groupIndex) || !groups[groupIndex] || !item || item.disabled) return
      if (!groups[groupIndex].includes(choiceId)) groups[groupIndex].push(choiceId)
      renderPanel()
      return
    }
    if (action === 'remove-choice') {
      if (!Number.isInteger(groupIndex) || !groups[groupIndex]) return
      groups[groupIndex] = groups[groupIndex].filter(function(choiceId) { return choiceId !== button.dataset.choiceId })
      renderPanel()
      return
    }
    if (action === 'save') {
      if (!groups.length || groups.some(function(group) { return !group.length })) {
        showToast('每一组条件都需要至少选择一个选项', 'error')
        return
      }
      if (groups.some(function(group) {
        return group.some(function(choiceId) {
          var item = choiceById(choiceId)
          return !item || item.disabled
        })
      })) {
        showToast('请先移除或替换已失效的条件', 'error')
        return
      }
      var displayCondition = normalizeArticleDisplayCondition({
        all: groups.map(function(anyChoiceIds) { return {anyChoiceIds:anyChoiceIds} }),
      })
      updateNode(wid, nid, {displayCondition:displayCondition, choices:[]})
      ov.remove()
      refreshEditor(wid)
      showToast('显示条件已保存')
    }
  })

  ov.addEventListener('click', function(event) {
    if (event.target === ov) ov.remove()
  })
  renderPanel()
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

function refreshEditor(wid) {
  _editorPersistence.flush()
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
  syncEditorFormatButtons()
}

// Handle backspace/delete for hr elements
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    if (_movingInteractionGroup) {
      _movingInteractionGroup = null
      showToast("已取消移动普通互动", "info")
      e.preventDefault()
      return
    }
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

// ====== Interactive Scene Nodes ======

function saveInteractiveScene(wid, scene, syncResult) {
  var work = getWork(wid)
  if (!work) return
  var scenes = (work.interactiveScenes || []).slice()
  var index = scenes.findIndex(function(candidate) { return candidate.id === scene.id })
  if (index >= 0) scenes[index] = scene
  else scenes.push(scene)
  if (syncResult?.interactiveScenes) scenes = syncResult.interactiveScenes
  updateWork(wid, {
    interactiveScenes:scenes,
    interactiveDialogueStyle:syncResult?.interactiveDialogueStyle || work.interactiveDialogueStyle,
  })
}

function buildInteractiveSceneContinuationGroups(work, sourceNodeId) {
  var nodes = Array.isArray(work?.nodes) ? work.nodes : []
  var idCounts = new Map()
  nodes.forEach(function(node) {
    var id = String(node?.id || "")
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1)
  })
  var groups = (Array.isArray(work?.chapters) ? work.chapters : []).map(function(chapter) {
    return {
      chapterId:String(chapter?.id || ""),
      chapterName:String(chapter?.name || "未命名章节"),
      nodes:[],
    }
  })
  var firstGroupByChapterId = new Map()
  groups.forEach(function(group) {
    if (!firstGroupByChapterId.has(group.chapterId)) {
      firstGroupByChapterId.set(group.chapterId, group)
    }
  })
  var ungrouped = null
  nodes.forEach(function(node) {
    var id = String(node?.id || "")
    if (
      !id
      || id === String(sourceNodeId || "")
      || idCounts.get(id) !== 1
      || node?.kind === "conditional"
      || isInteractiveSceneNode(node)
    ) return
    var group = firstGroupByChapterId.get(String(node?.chapterId || ""))
    if (!group) {
      if (!ungrouped) {
        ungrouped = {chapterId:"", chapterName:"未分组", nodes:[]}
        groups.push(ungrouped)
      }
      group = ungrouped
    }
    group.nodes.push({
      nodeId:id,
      title:String(node?.title || "未命名节点"),
    })
  })
  return groups
}

function createInteractiveSceneNode(wid, afterNodeId, chapterId) {
  var work = getWork(wid)
  if (!work) return
  var afterNode = (work.nodes || []).find(function(node) { return node.id === afterNodeId })
  var resolvedChapterId = chapterId || afterNode?.chapterId || work.chapters?.[0]?.id || ""
  var draftRecords = createInteractiveSceneNodeDraft({
    nodeId:uid(),
    sceneId:uid(),
    stageId:uid(),
    chapterId:resolvedChapterId,
    title:"互动场景",
  })
  openInteractiveSceneEditor({
    scene:draftRecords.scene,
    workStyle:work.interactiveDialogueStyle,
    allScenes:(work.interactiveScenes || []).concat([draftRecords.scene]),
    targetGroups:buildInteractiveSceneContinuationGroups(work, draftRecords.node.id),
    idFactory:uid,
    allowDelete:false,
    onSave:function(scene, syncResult) {
      var latest = getWork(wid)
      if (!latest) return
      var node = Object.assign({}, draftRecords.node, {
        title:scene.title || draftRecords.node.title,
        chapterId:resolvedChapterId,
      })
      var nodes = (latest.nodes || []).slice()
      var afterIndex = nodes.findIndex(function(candidate) { return candidate.id === afterNodeId })
      if (afterIndex < 0) {
        afterIndex = nodes.reduce(function(lastIndex, candidate, index) {
          return String(candidate.chapterId || "") === String(resolvedChapterId) ? index : lastIndex
        }, -1)
      }
      nodes.splice(afterIndex + 1, 0, node)
      var scenes = (latest.interactiveScenes || []).concat([
        Object.assign({}, scene, {nodeId:node.id}),
      ])
      if (syncResult?.interactiveScenes) {
        scenes = syncResult.interactiveScenes.map(function(candidate) {
          return candidate.id === scene.id ? Object.assign({}, candidate, {nodeId:node.id}) : candidate
        })
      }
      updateWork(wid, {
        nodes:nodes,
        interactiveScenes:scenes,
        interactiveDialogueStyle:syncResult?.interactiveDialogueStyle || latest.interactiveDialogueStyle,
      })
      _nodeId = node.id
      prepareMobilePaneRefresh("editor", true)
      refreshEditor(wid)
      showToast('互动页已添加到章节')
    },
  })
}

function openInteractiveSceneForNode(wid, nid) {
  var work = getWork(wid)
  var node = (work?.nodes || []).find(function(candidate) { return candidate.id === nid })
  var scene = interactiveSceneForNode(work, node)
  if (!work || !node || !scene) {
    showToast('互动页数据不存在', 'error')
    return
  }
  openInteractiveSceneEditor({
    scene:scene,
    workStyle:work.interactiveDialogueStyle,
    allScenes:work.interactiveScenes || [],
    targetGroups:buildInteractiveSceneContinuationGroups(work, nid),
    idFactory:uid,
    onSave:function(updatedScene, syncResult) {
      var linkedScene = Object.assign({}, updatedScene, {nodeId:nid})
      saveInteractiveScene(wid, linkedScene, syncResult)
      updateNode(wid, nid, {title:linkedScene.title || node.title})
      refreshEditor(wid)
      showToast('互动页已保存')
    },
    onDelete:function() {
      confirmReferencedDeletion({
        wid:wid,
        kind:"node",
        id:nid,
        title:"删除互动页",
        itemName:"互动页“" + (scene.title || node.title || "未命名互动页") + "”",
        fallbackMessage:"确定删除这个互动节点和它的全部画面吗？",
        onConfirm:function() {
          deleteNode(wid, nid)
          refreshEditor(wid)
          showToast('互动页已删除')
        },
      })
    },
  })
}

function renameArticleNode(wid, nid, title) {
  updateNode(wid, nid, {title:title})
  var work = getWork(wid)
  var node = (work?.nodes || []).find(function(candidate) { return candidate.id === nid })
  if (!isInteractiveSceneNode(node)) return
  updateWork(wid, {
    interactiveScenes:(work.interactiveScenes || []).map(function(scene) {
      return scene.id === node.interactiveSceneId ? Object.assign({}, scene, {title:title}) : scene
    }),
  })
}

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
      matchStandalonePhone: true,
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
  var authorNote = e.target.closest?.("[data-author-note]")
  if (authorNote) {
    var section = authorNote.dataset.authorNote
    if (!AUTHOR_NOTE_SECTION_IDS.includes(section) || !_workId) return
    var noteWorkId = _workId
    var noteValue = authorNote.value
    _editorPersistence.schedule("note:" + noteWorkId + ":" + section, function() {
      writeArticleAuthorNotes(noteWorkId, {[section]:noteValue}, globalThis.localStorage)
    })
    var notesPane = authorNote.closest("#articleNotesPane")
    var count = authorNote.value.length
    var sectionCount = notesPane?.querySelector('[data-a="note-section"][data-section="' + section + '"] [data-note-count]')
    if (sectionCount) {
      sectionCount.textContent = String(count)
      sectionCount.setAttribute("aria-label", count + " 字")
    }
    var editorCount = authorNote.closest(".author-note-editor")?.querySelector("[data-note-editor-count]")
    if (editorCount) editorCount.textContent = count + " 字"
    var notesSearch = notesPane?.querySelector("[data-author-notes-search]")
    if (notesSearch?.value) filterAuthorNoteSections(notesPane, notesSearch.value)
    return
  }
  var authorNotesSearch = e.target.closest?.("[data-author-notes-search]")
  if (authorNotesSearch) {
    filterAuthorNoteSections(authorNotesSearch.closest("#articleNotesPane"), authorNotesSearch.value)
    return
  }
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
  var contentWorkId = _workId
  var contentValue = serializeInteractionEditorContent(ce)
  _editorPersistence.schedule("node:" + contentWorkId + ":" + nid, function() {
    updateNode(contentWorkId, nid, {content:contentValue})
  })
  var wc = document.getElementById("wc_" + nid)
  if (wc) wc.textContent = formatEditorCharacterCount(ce)
})

globalThis.addEventListener?.("pagehide", function() {
  _editorPersistence.flush()
})

document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") _editorPersistence.flush()
})
