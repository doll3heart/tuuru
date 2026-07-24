import { prepareImportedWork } from '../js/work-import.js'
import { substitutePlaceholders } from '../js/placeholders.js'
import { escapeHtmlAttribute, isSafeImageUrl, sanitizeCssColor, sanitizeIconHtml } from '../js/sanitize.js'
import { shouldUseMotion } from '../js/motion-preference.js'
import { readSteganoPayload } from '../js/stegano.js'
import { phoneGridContainerStyle, phoneGridItemStyle } from './phone-grid.js'
import { parsePngDimensionsFromDataUrl, readerPngDimensionError } from './png-import-policy.js'
import { buildReaderPhoneModuleTrigger, markReaderPhoneModuleTriggerRead } from './reader-phone-module-trigger.js'
import { advanceCallPlayback, createCallPlaybackState } from './call-playback.js'
import { applyChatChoice, rollbackChatChoice } from '../js/chat-choice-runtime.js'
import { applyThreadChoice, rollbackThreadChoice } from '../js/thread-choice-runtime.js'
import { resolveArticleChoiceTarget } from '../js/article-reader-navigation.js'
import { appendArticleChoice, currentArticleChapterEntries, previousArticleChapterPath } from '../js/article-chapter-runtime.js'
import { prepareEditorPreview } from './editor-preview.js'
import { buildAuthorHomeUrl } from '../js/app-entry-links.js'
import { buildTakeawayOpenTarget, safeMessageCardUrl } from '../js/message-card-links.js'
import { orderedForumPosts } from '../js/forum-post-order.js'
import { orderedChats } from '../js/chat-order.js'
import { effectiveForbiddenWords } from '../js/forbidden-words.js'
import { shouldShowPhoneTimestamp } from '../js/phone-timestamps.js'
import { renderPhoneShoppingList, renderPhoneShoppingTabs } from '../js/phone-shopping-view.js'
import { renderPhoneForumComment, renderPhoneForumPost } from '../js/phone-forum-view.js'
import {
  normalizePhoneReadingFlow,
  phoneReadingFlowAppType,
  resolvePhoneReadingFlowStep,
} from '../js/phone-reading-flow.js'
import {
  READER_APPEARANCE_DEFAULTS,
  READER_APPEARANCE_THEMES,
  normalizeReaderAppearance,
  resolveReaderAppearanceTheme,
} from './article-appearance.js'
import {
  READER_CUSTOM_CSS_MAX_LENGTH,
  compileScopedReaderCss,
} from './custom-style.js'
import {
  hasRenderableWorkWatermark,
  normalizeWorkWatermark,
} from '../js/work-watermark.js'
import { contactDisplayName, listForumIdentities, resolveContactIdentity } from '../js/contact-identity.js'
import { orderedContacts } from '../js/contact-order.js'
import { splitMentionText } from '../js/mention-text.js'
import { forumDisplayCommentCount, forumDisplayFloor } from '../js/forum-display-metrics.js'
import { substitutePhoneTextData } from '../js/phone-placeholder-text.js'
import { showReleaseAnnouncementOnce } from '../js/release-announcement.js'
import { WORK_COLLECTION_BUNDLE_TYPE } from '../js/work-collections.js'
import { inspectReaderCollectionBundle, installReaderCollection } from './work-collection-import.js'

// Tuuru Reader
// 支持导入 .json / .png 文件，阅读文章或体验手机模拟器

// ---- helpers ----
const READER_DEFAULT_APP_ICON_SURFACE = '#f0f0f0'

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

var _readerThreadChoiceId = 0

function cloneReaderThreadItems(items) {
  if (!Array.isArray(items)) return []
  return JSON.parse(JSON.stringify(items))
}

function readerThreadDisplayName(pd, custom) {
  var customName = String(custom && custom.readerId || '').trim()
  var authoredName = String(pd && pd.skin && pd.skin.readerId || '').trim()
  return customName || authoredName || '我'
}

function readerThreadActorName(pd, contactId, authoredName, fallbackName) {
  var name = String(authoredName || '').trim()
  if (name) return name
  var actors = (pd && Array.isArray(pd.contacts) ? pd.contacts : [])
    .concat(pd && Array.isArray(pd.forumNpcs) ? pd.forumNpcs : [])
  var actor = actors.find(function(candidate) { return candidate && candidate.id === contactId })
  return String(actor && actor.name || fallbackName || '角色').trim() || '角色'
}

function readerThreadRuntimeOptions(pd, custom, scope) {
  var readerName = readerThreadDisplayName(pd, custom)
  return {
    idFactory: function() {
      _readerThreadChoiceId += 1
      return 'reader-' + scope + '-' + Date.now().toString(36) + '-' + _readerThreadChoiceId.toString(36)
    },
    createReply: function(context) {
      var text = String(context.choice && context.choice.replyText || '')
      return {
        id: context.id,
        contactId: 'self',
        senderId: 'self',
        contactName: readerName,
        content: text,
        text: text,
        time: ''
      }
    },
    createFollowUp: function(context) {
      var template = context.template || {}
      var owner = context.owner || {}
      var contactId = template.contactId || template.senderId || owner.contactId || owner.senderId || ''
      var content = String(template.content != null ? template.content : (template.text != null ? template.text : ''))
      var contactName = readerThreadActorName(pd, contactId, template.contactName, owner.contactName)
      return Object.assign({}, template, {
        id: context.id,
        contactId: contactId,
        senderId: template.senderId || contactId,
        contactName: contactName,
        content: content,
        text: content,
        time: template.time || ''
      })
    }
  }
}

function resolveReaderThreadOwnerId(items, serializedId) {
  var matches = (Array.isArray(items) ? items : []).filter(function(item) {
    return item && String(item.id) === String(serializedId)
  })
  return matches.length === 1 ? matches[0].id : null
}

function readerThreadRunKey(containerKey, ownerId) {
  return String(containerKey) + '::' + String(ownerId)
}

function readerThreadReplyRun(runs, containerKey, itemId) {
  var found = null
  runs.forEach(function(entry, key) {
    if (found || !entry || entry.containerKey !== containerKey) return
    if (!entry.run) return
    var generatedIds = Array.isArray(entry.run.generatedItemIds) ? entry.run.generatedItemIds : []
    var anchorId = entry.run.replyItemId != null
      ? entry.run.replyItemId
      : (generatedIds.length > 0 ? generatedIds[0] : entry.run.ownerItemId)
    if (anchorId != null && String(anchorId) === String(itemId)) found = { key: key, entry: entry }
  })
  return found
}

function readerThreadGeneratedItem(runs, containerKey, itemId) {
  var generated = false
  runs.forEach(function(entry) {
    if (generated || !entry || entry.containerKey !== containerKey || !entry.run) return
    var ids = Array.isArray(entry.run.generatedItemIds) ? entry.run.generatedItemIds : []
    generated = ids.some(function(id) { return String(id) === String(itemId) })
  })
  return generated
}

function renderReaderThreadChoiceControls(item, scope, containerKey, runs) {
  if (!item || !Array.isArray(item.choices) || item.choices.length === 0) return ''
  var runKey = readerThreadRunKey(containerKey, item.id)
  if (runs.has(runKey)) return ''
  var h = '<div class="rd-thread-choice-list" role="group" aria-label="选择完整回复">'
  item.choices.forEach(function(choice, choiceIndex) {
    var label = String(choice && (choice.text || choice.replyText) || '').trim()
    if (!label) return
    h += '<button type="button" class="rd-thread-choice-option" data-thread-scope="' + escapeHtmlAttribute(scope) + '" data-thread-container="' + escapeHtmlAttribute(containerKey) + '" data-thread-owner-id="' + escapeHtmlAttribute(String(item.id)) + '" data-thread-choice-index="' + choiceIndex + '">' + esc(label) + '</button>'
  })
  h += '</div>'
  return h
}

function renderReaderThreadReselect(item, scope, containerKey, runs) {
  var activeRun = readerThreadReplyRun(runs, containerKey, item && item.id)
  if (!activeRun) return ''
  return '<button type="button" class="rd-thread-choice-reselect" data-thread-scope="' + escapeHtmlAttribute(scope) + '" data-thread-run-key="' + escapeHtmlAttribute(activeRun.key) + '" aria-label="重选这条回复">重选</button>'
}

var _work = null
var _nodeId = null
var _visitedNodes = []
var _articlePath = []
var _articleInteractionSelections = Object.create(null)
var _renderedRecentIds = []
var _renderedCollectionIds = []
var _activeReaderCollectionId = ''
var _readerCollectionValues = Object.create(null)
var _readerPhoneChoiceSession = null
var _readerPhoneFlowSession = null
var _editorPreviewMode = false

function readerPhoneText(value) {
  return substitutePlaceholders(String(value || ''), _work && _work.placeholders || [], {
    valuesMap: _work && _work.readerPhValues || {},
    usePlaceholderMode: false,
  })
}

function readerPhoneData(phoneData) {
  return substitutePhoneTextData(phoneData, _work && _work.placeholders || [], {
    valuesMap: _work && _work.readerPhValues || {},
    usePlaceholderMode: false,
  })
}

function readerPlaceholderMentionNames() {
  return (_work && Array.isArray(_work.placeholders) ? _work.placeholders : []).map(function(placeholder) {
    var pattern = String(placeholder?.key || placeholder?.label || '').trim()
    return pattern ? String(readerPhoneText(pattern) || '').trim() : ''
  }).filter(Boolean)
}

function renderReaderMentionText(value, names) {
  return splitMentionText(value, names).map(function(segment) {
    return segment.mention
      ? '<span class="rd-mention">' + esc(segment.text) + '</span>'
      : esc(segment.text)
  }).join('')
}

function resetReaderPhoneChoiceSession(work) {
  _readerPhoneChoiceSession = {
    workId: String(work && work.id || ''),
    moments: null,
    momentChoiceRuns: new Map(),
    chats: new Map(),
    forumPosts: new Map()
  }
  return _readerPhoneChoiceSession
}

function readerPhoneChoiceSession(work) {
  var workId = String(work && work.id || '')
  if (!_readerPhoneChoiceSession || _readerPhoneChoiceSession.workId !== workId) {
    return resetReaderPhoneChoiceSession(work)
  }
  return _readerPhoneChoiceSession
}

// ---- render ----
function render(el, html) {
  if (typeof el === 'string') el = document.getElementById(el)
  if (el) el.innerHTML = html
}

function editorHomeUrl() {
  return buildAuthorHomeUrl(globalThis.location?.href ?? globalThis.window?.location?.href)
}

function renderEditorPreviewError(message) {
  var h = '<main class="rd-home rd-preview-error">'
  h += '<div class="drop-zone"><div class="drop-zone-inner">'
  h += '<div class="drop-title">无法打开预览</div>'
  h += '<div class="drop-desc">' + esc(message) + '</div>'
  h += '<button type="button" class="drop-btn" data-reader-home>返回创作端</button>'
  h += '</div></div></main>'
  render('app', h)
}

// ---- localStorage helpers ----
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('moirain_' + key)) } catch(e) { return null }
}
function lsSet(key, val) {
  localStorage.setItem('moirain_' + key, JSON.stringify(val))
}

var _readerStorageWarningShown = false

function warnReaderStorageFailure() {
  if (_readerStorageWarningShown) return
  _readerStorageWarningShown = true
  alert('本次作品仍可继续阅读，但浏览器无法保存本地阅读缓存；刷新或关闭页面后需要重新导入。请检查浏览器存储空间。')
}

function tryReaderStorageWrite(write) {
  try {
    write()
    return true
  } catch (error) {
    warnReaderStorageFailure()
    return false
  }
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
function getReaderCollections() {
  var collections = lsGet('collections')
  return Array.isArray(collections) ? collections : []
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
  h += '<header class="rd-product-header">'
  h += '<div class="rd-product-brand">Tuuru</div>'
  h += '<nav class="rd-mode-switch" aria-label="应用模式">'
  h += '<a class="rd-mode-link" href="' + escapeHtmlAttribute(editorHomeUrl()) + '">创作端</a>'
  h += '<span class="rd-mode-link active" aria-current="page">读者端</span>'
  h += '</nav></header>'
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
  bindPersonalPage(document)

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

  var libraryTrigger = target.closest('[data-reader-library]')
  if (libraryTrigger) {
    event.preventDefault()
    _activeReaderCollectionId = ''
    renderHome()
    return
  }

  var collectionWorkTrigger = target.closest('[data-reader-collection-work]')
  if (collectionWorkTrigger) {
    event.preventDefault()
    openReaderCollectionWork(collectionWorkTrigger.dataset.readerCollectionWork)
    return
  }

  var collectionTrigger = target.closest('[data-reader-collection-index]')
  if (collectionTrigger) {
    var collectionIndex = Number(collectionTrigger.dataset.readerCollectionIndex)
    if (!Number.isInteger(collectionIndex) || collectionIndex < 0 || collectionIndex >= _renderedCollectionIds.length) return
    event.preventDefault()
    openReaderCollection(_renderedCollectionIds[collectionIndex])
    return
  }

  var previousTrigger = target.closest('[data-reader-previous]')
  if (previousTrigger) {
    event.preventDefault()
    var previousPath = previousArticleChapterPath((_work && _work.nodes) || [], _articlePath)
    if (previousPath.length && previousPath.length < _articlePath.length) {
      _articlePath = previousPath
      _nodeId = _articlePath[_articlePath.length - 1]
      _visitedNodes = _articlePath.slice(0, -1)
      renderArticleReader()
    }
    return
  }

  var homeTrigger = target.closest('[data-reader-home]')
  if (homeTrigger) {
    event.preventDefault()
    if (_editorPreviewMode) {
      location.assign(editorHomeUrl())
      return
    }
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
  var collections = getReaderCollections()
  _renderedRecentIds = recents.map(function(r) { return r.id })
  _renderedCollectionIds = collections.map(function(collection) { return collection.id })
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
  h += '<div class="rd-preset-field"><label>姓名</label><input type="text" id="ps_name" value="' + esc(placeholders.name || '') + '"></div>'
  h += '<div class="rd-preset-field"><label>昵称</label><input type="text" id="ps_nickname" value="' + esc(placeholders.nickname || '') + '"></div>'
  h += '<div class="rd-preset-field"><label>网名</label><input type="text" id="ps_webname" value="' + esc(placeholders.webname || '') + '"></div>'
  h += '<div class="rd-preset-actions"><button type="button" class="rd-preset-save" id="rdPresetSave">保存到本地</button><span class="rd-preset-status" id="rdPresetStatus" role="status" aria-live="polite"></span></div>'
  h += '</div>'

  // Imported collections
  h += '<div class="rd-section rd-collection-section">'
  h += '<div class="rd-section-title">我的作品集</div>'
  if (collections.length === 0) {
    h += '<div class="rd-empty">导入作品集后会显示在这里</div>'
  } else {
    collections.forEach(function(collection, collectionIndex) {
      var count = Array.isArray(collection.workIds) ? collection.workIds.length : 0
      h += '<button type="button" class="rd-recent-item rd-collection-item" data-reader-collection-index="' + collectionIndex + '">'
      h += '<span class="rd-collection-item-copy"><span class="rd-recent-title">' + esc(collection.title || '未命名作品集') + '</span>'
      h += '<span class="rd-collection-summary">' + esc(collection.description || collection.author || '作品集') + '</span></span>'
      h += '<span class="rd-recent-meta">' + count + ' 篇 · ' + (collection.accessMode === 'unified' ? '统一进入' : '各篇独立') + '</span>'
      h += '</button>'
    })
  }
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
  if (panel) {
    panel.innerHTML = renderPersonalPage()
    bindPersonalPage(panel)
  }
}

function bindPersonalPage(root) {
  var saveButton = root && root.querySelector ? root.querySelector('#rdPresetSave') : null
  if (saveButton) saveButton.onclick = function() { window.savePlaceholderPreset() }
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
  var status = document.getElementById('rdPresetStatus')
  if (status) status.textContent = '已保存到本地'
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

var MAX_READER_JSON_IMPORT_BYTES = 10 * 1024 * 1024
var MAX_READER_PNG_IMPORT_BYTES = 25 * 1024 * 1024

function readerImportFileError(file, ext) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0) {
    return '无法确认文件大小，请重新选择文件'
  }
  if (file.size === 0) return '文件为空，请选择有效的作品文件'
  if (ext === 'json' && file.size > MAX_READER_JSON_IMPORT_BYTES) {
    return 'JSON 文件超过 10 MB 安全读取上限'
  }
  if (ext === 'png' && file.size > MAX_READER_PNG_IMPORT_BYTES) {
    return 'PNG 文件超过 25 MB 安全读取上限'
  }
  return ''
}

function setupImport() {
  var inner = document.getElementById('dropInner')
  var pickBtn = document.getElementById('pickFileBtn')
  var fileInput = document.getElementById('fileInput')

  function resetFileInput() {
    if (fileInput) fileInput.value = ''
  }

  function handleFile(file) {
    if (!file) return
    var name = typeof file.name === 'string' ? file.name : ''
    var ext = name.split('.').pop().toLowerCase()
    if (ext !== 'json' && ext !== 'png') {
      alert('请选择 .json 或 .png 文件')
      resetFileInput()
      return
    }
    var fileError = readerImportFileError(file, ext)
    if (fileError) {
      alert(fileError)
      resetFileInput()
      return
    }
    var reader
    try {
      reader = new FileReader()
    } catch (error) {
      alert('无法读取文件，请确认文件仍可访问后重试')
      resetFileInput()
      return
    }
    var settled = false
    function finishRead(message) {
      if (settled) return false
      settled = true
      resetFileInput()
      if (message) alert(message)
      return true
    }
    reader.onload = function() {
      if (!finishRead()) return
      if (ext === 'json') {
        try {
          var work = JSON.parse(reader.result)
          importPayload(work)
        } catch (e) {
          alert('JSON 解析失败：' + e.message)
        }
      } else {
        // PNG stego decode
        var dimensionError = readerPngDimensionError(parsePngDimensionsFromDataUrl(reader.result))
        if (dimensionError) {
          alert(dimensionError)
          return
        }
        decodeSteganoFromDataUrl(reader.result)
      }
    }
    reader.onerror = function() {
      finishRead('无法读取文件，请确认文件仍可访问后重试')
    }
    reader.onabort = function() {
      finishRead('文件读取已取消，请重新选择')
    }
    try {
      if (ext === 'json') reader.readAsText(file)
      else reader.readAsDataURL(file)
    } catch (error) {
      finishRead('无法读取文件，请确认文件仍可访问后重试')
    }
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
    var bytes = readSteganoPayload(pixels)
    if (!bytes) { alert('未检测到隐写数据'); return }
    try {
      var json = new TextDecoder().decode(bytes)
      var work = JSON.parse(json)
      importPayload(work)
    } catch(e) {
      alert('隐写数据解析失败：' + e.message)
    }
  }
  img.onerror = function() { alert('PNG 加载失败') }
  img.src = dataUrl
}

function importPayload(payload) {
  if (payload && payload.type === WORK_COLLECTION_BUNDLE_TYPE) {
    importWorkCollection(payload)
    return
  }
  importWork(payload)
}

function importWorkCollection(payload) {
  var inspected
  try {
    inspected = inspectReaderCollectionBundle(payload, localStorage, window)
  } catch (error) {
    alert(error instanceof Error ? error.message : '无法检查作品集')
    return
  }
  if (!inspected.ok) {
    alert(inspected.message)
    return
  }
  var replacement = inspected.existingWorkCount
    ? '\n其中 ' + inspected.existingWorkCount + ' 篇会更新同名本地缓存。'
    : ''
  var access = inspected.collection.accessMode === 'unified' ? '统一进入' : '各篇独立进入'
  if (!confirm('导入作品集《' + inspected.collection.title + '》？\n共 ' + inspected.works.length + ' 篇，' + access + '。' + replacement)) return
  try {
    var installed = installReaderCollection(localStorage, inspected)
    openReaderCollection(installed.collection.id)
  } catch (error) {
    alert('作品集导入失败：' + (error instanceof Error ? error.message : '本地存储不可用'))
  }
}

function importWork(work) {
  var result = prepareImportedWork(work)
  if (!result.ok) {
    alert(result.message)
    return
  }
  loadWork(result.work)
}

// ====== Landing Page (work info + password + placeholders) ======
function placeholderForbiddenWord(placeholder, value, globalForbidden) {
  var normalized = String(value || '').toLocaleLowerCase()
  return effectiveForbiddenWords(placeholder, globalForbidden).find(function(word) {
    var candidate = String(word || '').trim().toLocaleLowerCase()
    return candidate && normalized.includes(candidate)
  }) || ''
}

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
      h += '<div class="rd-placeholder-error" data-ph-error="' + escapeHtmlAttribute(ph.id || '') + '" role="alert" hidden></div>'
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
    var forbiddenFound = false
    inputs.forEach(function(inp) {
      var placeholder = phs.find(function(ph) { return String(ph.id || '') === String(inp.dataset.phId || '') })
      var forbidden = placeholderForbiddenWord(placeholder, inp.value, work.globalForbidden)
      var error = inp.parentElement ? inp.parentElement.querySelector('.rd-placeholder-error') : null
      if (error) {
        error.hidden = !forbidden
        error.textContent = forbidden ? '内容包含作者设置的违禁词，请修改后继续。' : ''
      }
      if (forbidden) { forbiddenFound = true; return }
      values[inp.dataset.phId] = [inp.value || '']
    })
    if (forbiddenFound) return
    work.readerPhValues = values
    tryReaderStorageWrite(function() { lsSet('readerPhValues', values) })
    document.body.removeChild(overlay)
    callback()
  }

  // Close on overlay click
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove() })
}

function readerCollectionById(id) {
  return getReaderCollections().find(function(collection) { return collection && collection.id === id }) || null
}

function readerCollectionWork(id) {
  try { return JSON.parse(localStorage.getItem('moirain_work_' + id)) } catch (_) { return null }
}

function collectionPlaceholders(collection) {
  var seen = Object.create(null)
  var placeholders = []
  ;(collection.workIds || []).forEach(function(workId) {
    var work = readerCollectionWork(workId)
    ;(work && Array.isArray(work.placeholders) ? work.placeholders : []).forEach(function(placeholder) {
      var key = String(placeholder.key || placeholder.label || placeholder.id || '').trim()
      if (!key || seen[key]) return
      seen[key] = true
      placeholders.push(Object.assign({}, placeholder, { id: 'collection-placeholder-' + placeholders.length, key: key }))
    })
  })
  return placeholders
}

function openReaderCollection(id) {
  var collection = readerCollectionById(id)
  if (!collection) {
    alert('这个作品集已不在本地，请重新导入')
    return
  }
  _activeReaderCollectionId = collection.id
  if (collection.accessMode !== 'unified' || Object.hasOwn(_readerCollectionValues, collection.id)) {
    renderReaderCollectionById(collection.id)
    return
  }
  var placeholders = collectionPlaceholders(collection)
  var gate = {
    title: collection.title,
    author: collection.author,
    authorNote: collection.authorNote || collection.description,
    password: collection.password || '',
    placeholders: placeholders,
  }
  showLandingPage(gate, function() {
    var values = Object.create(null)
    placeholders.forEach(function(placeholder) {
      values[placeholder.key] = gate.readerPhValues?.[placeholder.id] || ['']
    })
    _readerCollectionValues[collection.id] = values
    renderReaderCollectionById(collection.id)
  })
}

function renderReaderCollectionById(id) {
  var collection = readerCollectionById(id)
  if (!collection) {
    _activeReaderCollectionId = ''
    renderHome()
    return
  }
  _activeReaderCollectionId = id
  var available = 0
  var h = '<main class="rd-collection-directory">'
  h += '<button type="button" class="reader-back" data-reader-library title="返回个人主页" aria-label="返回个人主页">←</button>'
  if (collection.coverImage && isSafeImageUrl(collection.coverImage)) h += '<img class="rd-collection-cover" src="' + escapeHtmlAttribute(collection.coverImage) + '" alt="">'
  h += '<header class="rd-collection-directory-head"><span class="rd-collection-kicker">作品集</span><h1>' + esc(collection.title || '未命名作品集') + '</h1>'
  if (collection.author) h += '<p class="rd-collection-author">' + esc(collection.author) + '</p>'
  if (collection.description) h += '<p>' + esc(collection.description) + '</p>'
  if (collection.authorNote) h += '<div class="rd-collection-note">' + esc(collection.authorNote) + '</div>'
  h += '</header><section class="rd-collection-directory-list" aria-label="作品目录">'
  ;(collection.workIds || []).forEach(function(workId, index) {
    var work = readerCollectionWork(workId)
    if (!work) return
    available += 1
    h += '<button type="button" class="rd-collection-directory-item" data-reader-collection-work="' + escapeHtmlAttribute(workId) + '"><span class="rd-collection-number">' + String(index + 1).padStart(2, '0') + '</span><span><strong>' + esc(work.title || '无标题作品') + '</strong><small>' + (work.type === 'phone' ? '小手机' : '互动文章') + '</small></span><span aria-hidden="true">→</span></button>'
  })
  if (!available) h += '<div class="rd-empty">作品内容不在本地，请重新导入这个作品集</div>'
  h += '</section></main>'
  render('app', h)
}

function openReaderCollectionWork(workId) {
  var collection = readerCollectionById(_activeReaderCollectionId)
  var work = readerCollectionWork(workId)
  if (!collection || !work || !(collection.workIds || []).includes(workId)) return
  if (collection.accessMode === 'unified') {
    var valuesByKey = _readerCollectionValues[collection.id] || {}
    work.readerPhValues = Object.create(null)
    ;(work.placeholders || []).forEach(function(placeholder) {
      var key = String(placeholder.key || placeholder.label || placeholder.id || '').trim()
      work.readerPhValues[placeholder.id] = valuesByKey[key] || ['']
    })
    loadWork(work, { collectionId: collection.id, skipLanding: true })
  } else loadWork(work, { collectionId: collection.id })
}

// ====== Load Work ======
function loadWork(work, options) {
  if (!work.type) { alert('无效的作品文件'); return }
  _work = work
  resetReaderPhoneChoiceSession(work)
  resetReaderPhoneFlowSession(work)
  _nodeId = null
  _visitedNodes = []
  _articlePath = []
  _articleInteractionSelections = Object.create(null)
  _activeReaderCollectionId = options && options.collectionId || ''
  var rememberWork = !options || options.remember !== false
  if (rememberWork) {
    var cached = tryReaderStorageWrite(function() {
      localStorage.setItem('moirain_work_' + work.id, JSON.stringify(work))
    })
    if (cached) {
      tryReaderStorageWrite(function() { addRecent(work) })
    }
  }
  function startReading() {
    if (_work.type === 'phone') {
      renderPhoneReader()
    } else {
      renderArticleReader()
    }
  }
  if (options && options.skipLanding) startReading()
  else showLandingPage(work, startReading)
}

function timeAgo(ts) {
  if (!ts) return ''
  var diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

function resetReaderPhoneFlowSession(work) {
  var normalized = work && work.type === 'phone'
    ? normalizePhoneReadingFlow(work.phoneData)
    : { enabled: false, sequence: [] }
  _readerPhoneFlowSession = {
    workId: String(work && work.id || ''),
    enabled: normalized.enabled,
    sequence: normalized.sequence,
    index: 0
  }
  return _readerPhoneFlowSession
}

function readerPhoneFlowSession(work) {
  var workId = String(work && work.id || '')
  if (!_readerPhoneFlowSession || _readerPhoneFlowSession.workId !== workId) {
    return resetReaderPhoneFlowSession(work)
  }
  return _readerPhoneFlowSession
}

function currentReaderPhoneFlowStep(work) {
  var session = readerPhoneFlowSession(work)
  if (!session.enabled) return null
  return session.sequence[session.index] || null
}

function advanceReaderPhoneFlow(work) {
  var session = readerPhoneFlowSession(work)
  if (!session.enabled) return null
  session.index = Math.min(session.sequence.length, session.index + 1)
  return session.sequence[session.index] || null
}

function renderWorkWatermark(candidate, scope) {
  var watermark = normalizeWorkWatermark(candidate)
  if (!hasRenderableWorkWatermark(watermark)) return ''
  var safeScope = scope === 'phone' ? 'phone' : 'article'
  var item = watermark.kind === 'image'
    ? '<span class="work-watermark-item"><img src="' + escapeHtmlAttribute(watermark.image) + '" alt=""></span>'
    : '<span class="work-watermark-item">' + esc(watermark.text) + '</span>'
  var h = '<div class="work-watermark-layer work-watermark-' + safeScope + '" aria-hidden="true" data-coverage="' + watermark.coverage + '" data-position="' + watermark.position + '" data-pattern="' + watermark.pattern + '" style="--work-watermark-opacity:' + watermark.opacity + ';--work-watermark-spacing:' + watermark.spacing + 'px">'
  if (watermark.coverage === 'full') {
    var fallbackWidth = safeScope === 'phone' ? 480 : 2048
    var fallbackHeight = safeScope === 'phone' ? 900 : 1200
    var viewportWidth = safeScope === 'phone' ? fallbackWidth : Math.max(fallbackWidth, Number(window.innerWidth) || 0)
    var viewportHeight = safeScope === 'phone' ? fallbackHeight : Math.max(fallbackHeight, Number(window.innerHeight) || 0)
    var columnCount = Math.ceil(viewportWidth / watermark.spacing) + 3
    var rowCount = Math.ceil(viewportHeight / watermark.spacing) + 3
    h += '<div class="work-watermark-pattern">'
    for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      var offset = watermark.pattern === 'cross' && rowIndex % 2 === 1 ? 'staggered' : 'base'
      h += '<div class="work-watermark-row" data-offset="' + offset + '">'
      for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) h += item
      h += '</div>'
    }
    h += '</div>'
  } else {
    h += item
  }
  h += '</div>'
  return h
}

// ====== ARTICLE READER ======
// ====== Reader Typography Settings ======
function getReaderSettings() {
  return normalizeReaderAppearance(lsGet('readerSettings'))
}

function saveReaderSettings(data) {
  var normalized = normalizeReaderAppearance(data)
  try {
    lsSet('readerSettings', normalized)
  } catch (error) {
    showReaderToast('设置已在本页生效，但浏览器未能保存；请检查本地存储空间')
  }
  return normalized
}

function applyReaderCustomFonts(settings) {
  var existing = document.getElementById('rs-custom-fonts-style')
  if (existing) existing.remove()
  if (!settings.customFonts.length) return
  var style = document.createElement('style')
  style.id = 'rs-custom-fonts-style'
  style.textContent = settings.customFonts.map(function(font) {
    return '@font-face{font-family:"' + font.name + '";src:url(' + font.data + ');font-display:swap;}'
  }).join('\n')
  document.head.appendChild(style)
}

function applyCompiledReaderStyle(rawCss, scopeSelector, styleId) {
  var result = compileScopedReaderCss(rawCss, scopeSelector)
  var existing = document.getElementById(styleId)
  if (!result.ok) return result
  if (!result.css) {
    if (existing) existing.remove()
    return result
  }
  var style = existing || document.createElement('style')
  style.id = styleId
  style.textContent = result.css
  if (!existing) document.head.appendChild(style)
  return result
}

function setReaderAppearanceVariables(root, settings, theme) {
  if (!root) return
  root.style.setProperty('--rd-reading-bg', theme.backgroundColor)
  root.style.setProperty('--rd-reading-text', theme.textColor)
  root.style.setProperty('--rd-reading-accent', settings.accentColor)
  root.style.setProperty('--rd-font-size', settings.fontSize + 'px')
  root.style.setProperty('--rd-line-height', String(settings.lineHeight))
  root.style.setProperty('--rd-letter-spacing', settings.letterSpacing + 'px')
  root.style.setProperty('--rd-paragraph-spacing', settings.paragraphSpacing + 'px')
  root.style.setProperty('--rd-content-gutter', settings.marginSize + 'px')
  root.style.setProperty('--rd-content-width', settings.contentWidth + 'px')
  root.style.setProperty('--rd-font-family', settings.fontFamily)
  root.style.setProperty('--rd-first-line-indent', settings.indentFirstLine ? '2em' : '0')
  root.style.setProperty('--rd-title-size', settings.titleSize + 'px')
  root.style.setProperty('--rd-title-weight', String(settings.titleWeight))
  root.style.setProperty('--rd-title-spacing', settings.titleSpacing + 'px')
  root.style.setProperty('--rd-meta-spacing', settings.metaSpacing + 'px')
  root.style.setProperty('--rd-section-spacing', settings.sectionSpacing + 'px')
  root.style.setProperty('--rd-image-radius', settings.imageRadius + 'px')
  root.style.setProperty('--rd-choice-gap', settings.choiceGap + 'px')
  root.style.setProperty('--rd-choice-radius', settings.choiceRadius + 'px')
}

function applyReaderSettings(el, candidate) {
  if (!el) return
  var rs = normalizeReaderAppearance(candidate || getReaderSettings())
  var theme = resolveReaderAppearanceTheme(rs)
  var articleReader = el.closest('.article-reader')
  var backdrop = document.querySelector('.article-reading-backdrop')
  var watermarkLayer = document.querySelector('.work-watermark-article')
  applyReaderCustomFonts(rs)
  applyCompiledReaderStyle(rs.customCss, '.reader-article-css-scope', 'reader-article-user-css')
  el.style.fontSize = rs.fontSize + 'px'
  el.style.lineHeight = rs.lineHeight
  el.style.letterSpacing = rs.letterSpacing + 'px'
  el.style.padding = '0 ' + rs.marginSize + 'px'
  el.style.textAlign = rs.textAlign
  el.querySelectorAll('p').forEach(function(p) {
    p.style.marginBottom = rs.paragraphSpacing + 'px'
    p.style.textIndent = rs.indentFirstLine ? '2em' : ''
  })
  el.style.fontFamily = rs.fontFamily

  if (articleReader) {
    articleReader.classList.add('reader-article-css-scope')
    articleReader.style.maxWidth = rs.contentWidth + 'px'
    setReaderAppearanceVariables(articleReader, rs, theme)
  }
  if (watermarkLayer) watermarkLayer.style.setProperty('--work-watermark-ink', theme.textColor)

  document.body.className = (document.body.className || '').replace(/\s*rd-theme-\S+/g, '')
  document.body.classList.add('rd-reading-active')
  if (backdrop) {
    backdrop.style.setProperty('--rd-reading-bg', theme.backgroundColor)
    backdrop.style.setProperty('--rd-reading-overlay', String(rs.backgroundOverlay / 100))
    backdrop.style.backgroundColor = theme.backgroundColor
    backdrop.style.backgroundPosition = rs.backgroundPosition
    if (rs.backgroundImage) {
      backdrop.dataset.hasImage = 'true'
      backdrop.style.backgroundImage = 'url("' + rs.backgroundImage + '")'
      backdrop.style.backgroundSize = rs.backgroundFit === 'tile' ? 'auto' : rs.backgroundFit
      backdrop.style.backgroundRepeat = rs.backgroundFit === 'tile' ? 'repeat' : 'no-repeat'
    } else {
      delete backdrop.dataset.hasImage
      backdrop.style.backgroundImage = ''
      backdrop.style.backgroundSize = ''
      backdrop.style.backgroundRepeat = ''
    }
  }
}
function applyReaderSettingsPreview(root, candidate) {
  if (!root) return
  var rs = normalizeReaderAppearance(candidate)
  var theme = resolveReaderAppearanceTheme(rs)
  var preview = root.querySelector('.rs-preview')
  var copy = root.querySelector('.rs-preview-copy')
  if (!preview || !copy) return
  copy.classList.add('reader-article-css-preview-scope')
  setReaderAppearanceVariables(copy, rs, theme)
  applyCompiledReaderStyle(rs.customCss, '.reader-article-css-preview-scope', 'reader-article-preview-user-css')
  preview.style.setProperty('--rs-preview-bg', theme.backgroundColor)
  preview.style.setProperty('--rs-preview-text', theme.textColor)
  preview.style.setProperty('--rs-preview-overlay', String(rs.backgroundOverlay / 100))
  preview.style.backgroundColor = theme.backgroundColor
  preview.style.backgroundPosition = rs.backgroundPosition
  if (rs.backgroundImage) {
    preview.dataset.hasImage = 'true'
    preview.style.backgroundImage = 'url("' + rs.backgroundImage + '")'
    preview.style.backgroundSize = rs.backgroundFit === 'tile' ? 'auto' : rs.backgroundFit
    preview.style.backgroundRepeat = rs.backgroundFit === 'tile' ? 'repeat' : 'no-repeat'
  } else {
    delete preview.dataset.hasImage
    preview.style.backgroundImage = ''
    preview.style.backgroundSize = ''
    preview.style.backgroundRepeat = ''
  }
  copy.style.fontSize = rs.fontSize + 'px'
  copy.style.lineHeight = rs.lineHeight
  copy.style.letterSpacing = rs.letterSpacing + 'px'
  copy.style.padding = '0 ' + Math.min(rs.marginSize, 32) + 'px'
  copy.style.maxWidth = Math.min(rs.contentWidth, 480) + 'px'
  copy.style.fontFamily = rs.fontFamily
  copy.style.textAlign = rs.textAlign
  copy.querySelectorAll('p').forEach(function(paragraph) {
    paragraph.style.marginBottom = rs.paragraphSpacing + 'px'
    paragraph.style.textIndent = rs.indentFirstLine ? '2em' : ''
  })
}


function openReaderSettingsPanel(triggerElement) {
  var rs = getReaderSettings()
  var fonts = [
    { name: '默认', family: "'Noto Sans SC', sans-serif" },
    { name: '宋体', family: "'Noto Serif SC', serif" },
    { name: '黑体', family: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { name: '楷体', family: "'KaiTi', serif" },
    { name: '圆体', family: "'PingFang SC', sans-serif" },
    { name: '英文衬线', family: "'Georgia', serif" }
  ]
  var themes = READER_APPEARANCE_THEMES

  var body = '<div class="rs-panel-body">'
  body += '<aside class="rs-preview-pane"><div class="rs-preview" aria-label="阅读外观实时预览"><div class="rs-preview-copy reader-article-css-preview-scope">'
  body += '<div class="article-progress" aria-hidden="true"><span class="dot visited"></span><span class="dot current"></span><span class="dot"></span></div>'
  body += '<h3 class="article-title">雾色来信</h3><div class="article-meta">试读章节 · 刚刚</div>'
  body += '<div class="article-content"><section class="article-node"><h4 class="article-node-title">窗边</h4><p>晨光落在纸页上，文字与留白会跟随右侧设置实时变化。</p><p>这里也会显示段距、首行缩进和对齐效果。</p>'
  body += '<div class="article-choices"><button type="button" class="article-choice-btn" tabindex="-1"><span class="label">1.</span><span>继续阅读</span></button></div></section></div>'
  body += '</div></div><p class="rs-live-status" id="rsLiveStatus" role="status" aria-live="polite">实时预览 · 修改后自动保存</p></aside>'
  body += '<div class="rs-controls">'

  // Font size
  body += '<div class="rs-section"><div class="rs-section-title">字号 <span id="rsFontSizeVal">' + rs.fontSize + '</span>px</div>'
  body += '<input type="range" id="rsFontSize" class="rs-range" min="12" max="36" value="' + rs.fontSize + '"></div>'

  // Line height
  body += '<div class="rs-section"><div class="rs-section-title">行间距 <span id="rsLineHVal">' + rs.lineHeight.toFixed(1) + '</span></div>'
  body += '<input type="range" id="rsLineH" class="rs-range" min="1.2" max="3.0" step="0.1" value="' + rs.lineHeight + '"></div>'

  // Letter spacing
  body += '<div class="rs-section"><div class="rs-section-title">字间距 <span id="rsLetterSVal">' + rs.letterSpacing + '</span>px</div>'
  body += '<input type="range" id="rsLetterS" class="rs-range" min="-1" max="10" step="0.5" value="' + rs.letterSpacing + '"></div>'

  // Paragraph spacing
  body += '<div class="rs-section"><div class="rs-section-title">段间距 <span id="rsParaSVal">' + rs.paragraphSpacing + '</span>px</div>'
  body += '<input type="range" id="rsParaS" class="rs-range" min="0" max="48" step="2" value="' + rs.paragraphSpacing + '"></div>'

  // Margin
  body += '<div class="rs-section"><div class="rs-section-title">水平页边距 <span id="rsMarginVal">' + rs.marginSize + '</span>px</div>'
  body += '<input type="range" id="rsMargin" class="rs-range" min="0" max="64" step="2" value="' + rs.marginSize + '"></div>'
  body += '<div class="rs-section"><div class="rs-section-title">内容宽度 <span id="rsContentWidthVal">' + rs.contentWidth + '</span>px</div>'
  body += '<input type="range" id="rsContentWidth" class="rs-range" min="420" max="1080" step="20" value="' + rs.contentWidth + '"></div>'

  body += '<div class="rs-section"><div class="rs-group-heading"><span>标题与结构</span><small>控制标题、作者信息和章节之间的节奏</small></div><div class="rs-control-grid">'
  body += '<label class="rs-range-field" for="rsTitleSize"><span>标题字号 <output id="rsTitleSizeVal">' + rs.titleSize + 'px</output></span><input type="range" id="rsTitleSize" class="rs-range" min="18" max="44" value="' + rs.titleSize + '"></label>'
  body += '<label class="rs-range-field" for="rsTitleSpacing"><span>标题下方 <output id="rsTitleSpacingVal">' + rs.titleSpacing + 'px</output></span><input type="range" id="rsTitleSpacing" class="rs-range" min="0" max="40" step="2" value="' + rs.titleSpacing + '"></label>'
  body += '<label class="rs-range-field" for="rsMetaSpacing"><span>信息下方 <output id="rsMetaSpacingVal">' + rs.metaSpacing + 'px</output></span><input type="range" id="rsMetaSpacing" class="rs-range" min="12" max="72" step="2" value="' + rs.metaSpacing + '"></label>'
  body += '<label class="rs-range-field" for="rsSectionSpacing"><span>章节间距 <output id="rsSectionSpacingVal">' + rs.sectionSpacing + 'px</output></span><input type="range" id="rsSectionSpacing" class="rs-range" min="16" max="96" step="2" value="' + rs.sectionSpacing + '"></label>'
  body += '</div><div class="rs-section-title rs-subtitle">标题粗细</div><div class="rs-segment" role="group" aria-label="标题粗细">'
  ;[400,500,600,700].forEach(function(weight) {
    body += '<button type="button" id="rsTitleWeight' + weight + '" class="rs-align-btn' + (rs.titleWeight === weight ? ' active' : '') + '" data-rs-title-weight="' + weight + '" aria-pressed="' + (rs.titleWeight === weight ? 'true' : 'false') + '">' + ({400:'常规',500:'中等',600:'半粗',700:'粗体'}[weight]) + '</button>'
  })
  body += '</div></div>'

  body += '<div class="rs-section"><div class="rs-section-title">文字对齐</div><div class="rs-segment" role="group" aria-label="文字对齐方式">'
  ;['left','justify','center','right'].forEach(function(alignment) { var label = {left:'左对齐',justify:'两端对齐',center:'居中',right:'右对齐'}[alignment]; body += '<button type="button" class="rs-align-btn' + (rs.textAlign === alignment ? ' active' : '') + '" data-rs-align="' + alignment + '" aria-pressed="' + (rs.textAlign === alignment ? 'true' : 'false') + '">' + label + '</button>' })
  body += '</div><label class="rd-checkbox"><input type="checkbox" id="rsIndent"' + (rs.indentFirstLine ? ' checked' : '') + '> 段落首行缩进</label></div>'

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
  body += '<div style="padding:4px 0;margin-top:6px"><button class="rs-upload-font-btn" style="padding:5px 14px;font-size:.72rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer;border-radius:4px" id="rsUploadFont">上传字体 (.ttf/.woff)</button></div>'
  body += '<div id="rsFontList" style="padding:4px 0">'
  for (var cfi2 = 0; cfi2 < customFonts.length; cfi2++) {
    body += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><span style="font-size:.7rem;color:#555;flex:1">' + esc(customFonts[cfi2].name) + '</span><button class="rs-delete-font-btn" style="padding:2px 8px;font-size:.65rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;border-radius:3px" data-rs-del-font="' + cfi2 + '">删除</button></div>'
  }
  body += '</div>'
  body += '</div>'

  body += '<div class="rs-section"><div class="rs-group-heading"><span>选项与图片</span><small>让互动按钮和插图融入正文排版</small></div><div class="rs-control-grid">'
  body += '<label class="rs-range-field" for="rsImageRadius"><span>图片圆角 <output id="rsImageRadiusVal">' + rs.imageRadius + 'px</output></span><input type="range" id="rsImageRadius" class="rs-range" min="0" max="24" value="' + rs.imageRadius + '"></label>'
  body += '<label class="rs-range-field" for="rsChoiceGap"><span>选项间距 <output id="rsChoiceGapVal">' + rs.choiceGap + 'px</output></span><input type="range" id="rsChoiceGap" class="rs-range" min="4" max="28" step="2" value="' + rs.choiceGap + '"></label>'
  body += '<label class="rs-range-field" for="rsChoiceRadius"><span>选项圆角 <output id="rsChoiceRadiusVal">' + rs.choiceRadius + 'px</output></span><input type="range" id="rsChoiceRadius" class="rs-range" min="0" max="20" value="' + rs.choiceRadius + '"></label>'
  body += '</div></div>'

  // Theme
  body += '<div class="rs-section"><div class="rs-section-title">主题</div>'
  body += '<div class="rs-theme-grid">'
  for (var ti = 0; ti < themes.length; ti++) {
    var th = themes[ti]
    body += '<button type="button" class="rs-theme-btn' + (rs.theme === th.id ? ' active' : '') + '" data-rs-theme="' + th.id + '" aria-pressed="' + (rs.theme === th.id ? 'true' : 'false') + '" style="background:' + th.backgroundColor + ';color:' + th.textColor + '">' + th.name + '</button>'
  }
  body += '</div></div>'
  body += '<div class="rs-section"><div class="rs-section-title">自定义颜色</div><div class="rs-color-controls">'
  body += '<label class="rs-color-control">背景色<input type="color" class="rs-color-input" id="rsBgColor" value="' + escapeHtmlAttribute(rs.backgroundColor) + '"></label>'
  body += '<label class="rs-color-control">文字色<input type="color" class="rs-color-input" id="rsTextColor" value="' + escapeHtmlAttribute(rs.textColor) + '"></label>'
  body += '<label class="rs-color-control">强调色<input type="color" class="rs-color-input" id="rsAccentColor" value="' + escapeHtmlAttribute(rs.accentColor) + '"></label>'
  body += '</div></div>'
  var backgroundUrlValue = rs.backgroundImage && !/^data:/i.test(rs.backgroundImage) ? rs.backgroundImage : ''
  body += '<div class="rs-section"><div class="rs-section-title">阅读背景图</div>'
  body += '<div class="rs-background-row"><input type="url" class="rd-input" id="rsBgUrl" value="' + escapeHtmlAttribute(backgroundUrlValue) + '" placeholder="输入 HTTPS 图片地址"><button type="button" class="rs-action-btn" id="rsApplyBgUrl">应用</button><button type="button" class="rs-action-btn" id="rsUploadBg">本地图片</button><button type="button" class="rs-action-btn subtle" id="rsClearBg">清除</button></div>'
  if (rs.backgroundImage && !backgroundUrlValue) body += '<p class="rs-field-hint">当前已使用本地背景图；更换地址或点击清除即可替换。</p>'
  body += '<p class="rs-field-error" id="rsBgError" role="alert" hidden></p>'
  body += '<div class="rs-section-title">铺放方式</div><div class="rs-segment" role="group" aria-label="背景图铺放方式">'
  ;['cover','contain','tile'].forEach(function(fit) { var label = {cover:'铺满',contain:'完整显示',tile:'平铺'}[fit]; body += '<button type="button" class="rs-align-btn' + (rs.backgroundFit === fit ? ' active' : '') + '" data-rs-fit="' + fit + '" aria-pressed="' + (rs.backgroundFit === fit ? 'true' : 'false') + '">' + label + '</button>' })
  body += '</div>'
  body += '<div class="rs-section-title rs-subtitle">背景位置</div><div class="rs-segment" role="group" aria-label="背景图位置">'
  ;['center','top','bottom','left','right'].forEach(function(position) { var label = {center:'居中',top:'顶部',bottom:'底部',left:'靠左',right:'靠右'}[position]; body += '<button type="button" class="rs-align-btn' + (rs.backgroundPosition === position ? ' active' : '') + '" data-rs-position="' + position + '" aria-pressed="' + (rs.backgroundPosition === position ? 'true' : 'false') + '">' + label + '</button>' })
  body += '</div>'
  body += '<div class="rs-section-title rs-subtitle">背景遮罩 <span id="rsBgOverlayVal">' + rs.backgroundOverlay + '</span>%</div>'
  body += '<input type="range" id="rsBgOverlay" class="rs-range" min="0" max="90" step="5" value="' + rs.backgroundOverlay + '">'
  body += '</div>'

  // Typing effect
  body += '<div class="rs-section">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="rsTyping"' + (rs.typingEffect ? ' checked' : '') + '> 打字机效果</label>'
  body += '<div class="rs-section-title" style="margin-top:8px">速度: <span id="rsTypingSpeedVal">' + (rs.typingSpeed || 50) + '</span>ms</div>'
  body += '<input type="range" id="rsTypingSpeed" class="rs-range" min="10" max="500" step="5" value="' + (rs.typingSpeed || 50) + '"></div>'

  body += '<div class="rs-section rs-css-section"><div class="rs-group-heading"><span>高级 CSS</span><small>只作用于文章区域，输入时即时校验</small></div>'
  body += '<textarea id="rsCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="rsCssHint rsCssError" placeholder=".article-title { letter-spacing: .08em; }">' + esc(rs.customCss || '') + '</textarea>'
  body += '<div class="rs-css-meta"><p class="rs-field-hint" id="rsCssHint">支持普通选择器与属性；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="rsCssCount">' + String((rs.customCss || '').length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>'
  body += '<p class="rs-field-error" id="rsCssError" role="alert" hidden></p><div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="rsCssExample">填入示例</button><button type="button" class="rs-action-btn subtle" id="rsClearCss">清空 CSS</button></div></div>'

  body += '<div class="rs-reset-wrap"><button class="rs-reset-btn" id="rsReset">恢复默认</button></div>'
  body += '</div></div>'

  // Build overlay + bottom sheet
  var ov = document.createElement('div')
  ov.className = 'rs-overlay'
  ov.innerHTML = '<section class="rs-sheet" role="dialog" aria-modal="true" aria-labelledby="rsSheetTitle" tabindex="-1">' +
    '<header class="rs-sheet-header">' +
    '<h2 class="rs-sheet-title" id="rsSheetTitle">文章阅读外观</h2>' +
    '<button type="button" class="rs-close-btn" aria-label="关闭文章阅读外观" id="rsClose">×</button>' +
    '</header>' +
    '<div class="rs-sheet-scroll">' + body + '</div>' +
    '</section>'
  document.body.appendChild(ov)

  var activeTrigger = triggerElement && triggerElement.isConnected ? triggerElement : document.activeElement
  var dialog = ov.querySelector('.rs-sheet')
  var closeButton = ov.querySelector('#rsClose')
  function closePanel(options) {
    var restoreFocus = !options || options.restoreFocus !== false
    var previewStyle = document.getElementById('reader-article-preview-user-css')
    if (previewStyle) previewStyle.remove()
    ov.remove()
    if (restoreFocus && activeTrigger && activeTrigger.isConnected && activeTrigger.focus) activeTrigger.focus()
  }
  ov.addEventListener('click', function(e) { if (e.target === ov) closePanel() })
  closeButton.onclick = function() { closePanel() }
  dialog.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePanel()
      return
    }
    if (e.key !== 'Tab') return
    var focusable = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    if (!focusable.length) return
    var first = focusable[0]
    var last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  })
  applyReaderSettingsPreview(ov, rs)
  closeButton.focus()

  // Slider binds
  function persistAndPreview() {
    rs = saveReaderSettings(rs)
    document.querySelectorAll('.article-content').forEach(function(content) {
      applyReaderSettings(content, rs)
    })
    applyReaderSettingsPreview(ov, rs)
    var liveStatus = ov.querySelector('#rsLiveStatus')
    if (liveStatus) liveStatus.textContent = '实时预览 · 已自动保存'
    return rs
  }

  function syncPressedButtons(selector, dataKey, value) {
    ov.querySelectorAll(selector).forEach(function(button) {
      var active = button.dataset[dataKey] === value
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
  }

  function setBackgroundError(message) {
    var error = ov.querySelector('#rsBgError')
    if (!error) return
    error.textContent = message || ''
    error.hidden = !message
  }

  function bindSlider(id, key, valEl, format) {
    var el = ov.querySelector(id)
    if (!el) return
    el.oninput = function() {
      var v = parseFloat(this.value)
      rs[key] = v
      if (valEl) { var lbl = ov.querySelector(valEl); if (lbl) lbl.textContent = format ? format(v) : v }
      persistAndPreview()
    }
  }
  bindSlider('#rsFontSize', 'fontSize', '#rsFontSizeVal', function(v){return v})
  bindSlider('#rsLineH', 'lineHeight', '#rsLineHVal', function(v){return v.toFixed(1)})
  bindSlider('#rsLetterS', 'letterSpacing', '#rsLetterSVal', function(v){return v})
  bindSlider('#rsParaS', 'paragraphSpacing', '#rsParaSVal', function(v){return v})
  bindSlider('#rsMargin', 'marginSize', '#rsMarginVal', function(v){return v})
  bindSlider('#rsContentWidth', 'contentWidth', '#rsContentWidthVal', function(v){return v})
  bindSlider('#rsTitleSize', 'titleSize', '#rsTitleSizeVal', function(v){return v + 'px'})
  bindSlider('#rsTitleSpacing', 'titleSpacing', '#rsTitleSpacingVal', function(v){return v + 'px'})
  bindSlider('#rsMetaSpacing', 'metaSpacing', '#rsMetaSpacingVal', function(v){return v + 'px'})
  bindSlider('#rsSectionSpacing', 'sectionSpacing', '#rsSectionSpacingVal', function(v){return v + 'px'})
  bindSlider('#rsImageRadius', 'imageRadius', '#rsImageRadiusVal', function(v){return v + 'px'})
  bindSlider('#rsChoiceGap', 'choiceGap', '#rsChoiceGapVal', function(v){return v + 'px'})
  bindSlider('#rsChoiceRadius', 'choiceRadius', '#rsChoiceRadiusVal', function(v){return v + 'px'})
  bindSlider('#rsBgOverlay', 'backgroundOverlay', '#rsBgOverlayVal', function(v){return v})
  bindSlider('#rsTypingSpeed', 'typingSpeed', '#rsTypingSpeedVal', function(v){return v})

  // Font buttons
  ov.querySelectorAll('[data-rs-font]').forEach(function(b) {
    b.onclick = function() {
      rs.fontFamily = b.dataset.rsFont
      ov.querySelectorAll('[data-rs-font]').forEach(function(x){x.classList.remove('active')})
      b.classList.add('active')
      persistAndPreview()
    }
  })

  ov.querySelectorAll('[data-rs-align]').forEach(function(b) {
    b.onclick = function() {
      rs.textAlign = b.dataset.rsAlign
      syncPressedButtons('[data-rs-align]', 'rsAlign', rs.textAlign)
      persistAndPreview()
    }
  })
  ov.querySelectorAll('[data-rs-title-weight]').forEach(function(b) {
    b.onclick = function() {
      rs.titleWeight = parseInt(b.dataset.rsTitleWeight, 10)
      syncPressedButtons('[data-rs-title-weight]', 'rsTitleWeight', String(rs.titleWeight))
      persistAndPreview()
    }
  })
  var indentCb = ov.querySelector('#rsIndent')
  if (indentCb) indentCb.onchange = function() {
    rs.indentFirstLine = this.checked
    persistAndPreview()
  }

  // Typing checkbox
  var typingCb = ov.querySelector('#rsTyping')
  if (typingCb) typingCb.onchange = function() {
    rs.typingEffect = this.checked
    persistAndPreview()
  }

  // Theme buttons
  ov.querySelectorAll('[data-rs-theme]').forEach(function(b) {
    b.onclick = function() {
      rs.theme = b.dataset.rsTheme
      var selectedTheme = themes.find(function(theme){ return theme.id === rs.theme })
      if (selectedTheme) {
        rs.backgroundColor = selectedTheme.backgroundColor
        rs.textColor = selectedTheme.textColor
        var bgColor = ov.querySelector('#rsBgColor')
        var textColor = ov.querySelector('#rsTextColor')
        if (bgColor) bgColor.value = selectedTheme.backgroundColor
        if (textColor) textColor.value = selectedTheme.textColor
      }
      syncPressedButtons('[data-rs-theme]', 'rsTheme', rs.theme)
      persistAndPreview()
    }
  })

  var backgroundColorInput = ov.querySelector('#rsBgColor')
  if (backgroundColorInput) backgroundColorInput.oninput = function() {
    rs.theme = 'custom'
    rs.backgroundColor = sanitizeCssColor(this.value, { fallback: rs.backgroundColor })
    syncPressedButtons('[data-rs-theme]', 'rsTheme', rs.theme)
    persistAndPreview()
  }
  var textColorInput = ov.querySelector('#rsTextColor')
  if (textColorInput) textColorInput.oninput = function() {
    rs.theme = 'custom'
    rs.textColor = sanitizeCssColor(this.value, { fallback: rs.textColor })
    syncPressedButtons('[data-rs-theme]', 'rsTheme', rs.theme)
    persistAndPreview()
  }
  var accentColorInput = ov.querySelector('#rsAccentColor')
  if (accentColorInput) accentColorInput.oninput = function() {
    rs.accentColor = sanitizeCssColor(this.value, { fallback: rs.accentColor })
    persistAndPreview()
  }

  ov.querySelectorAll('[data-rs-fit]').forEach(function(b) {
    b.onclick = function() {
      rs.backgroundFit = b.dataset.rsFit
      syncPressedButtons('[data-rs-fit]', 'rsFit', rs.backgroundFit)
      persistAndPreview()
    }
  })
  ov.querySelectorAll('[data-rs-position]').forEach(function(b) {
    b.onclick = function() {
      rs.backgroundPosition = b.dataset.rsPosition
      syncPressedButtons('[data-rs-position]', 'rsPosition', rs.backgroundPosition)
      persistAndPreview()
    }
  })

  function applyBackgroundUrl(value) {
    var raw = String(value || '').trim()
    if (raw && !isSafeImageUrl(raw)) {
      setBackgroundError('请选择本地图片，或输入安全的 HTTPS / 相对图片地址。')
      return false
    }
    rs.backgroundImage = raw || null
    setBackgroundError('')
    persistAndPreview()
    return true
  }
  var backgroundUrlInput = ov.querySelector('#rsBgUrl')
  var applyBackgroundButton = ov.querySelector('#rsApplyBgUrl')
  if (applyBackgroundButton) applyBackgroundButton.onclick = function() {
    applyBackgroundUrl(backgroundUrlInput && backgroundUrlInput.value)
  }
  if (backgroundUrlInput) backgroundUrlInput.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyBackgroundUrl(this.value)
    }
  }
  var clearBackgroundButton = ov.querySelector('#rsClearBg')
  if (clearBackgroundButton) clearBackgroundButton.onclick = function() {
    if (backgroundUrlInput) backgroundUrlInput.value = ''
    applyBackgroundUrl('')
  }
  var uploadBackgroundButton = ov.querySelector('#rsUploadBg')
  if (uploadBackgroundButton) uploadBackgroundButton.onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (backgroundUrlInput) backgroundUrlInput.value = ''
        applyBackgroundUrl(dataUrl)
      }).catch(function(error) {
        setBackgroundError((error && error.message) || '图片读取失败，请换一张再试。')
      })
    }
    input.click()
  }

  function setCssFeedback(result) {
    var error = ov.querySelector('#rsCssError')
    var status = ov.querySelector('#rsLiveStatus')
    if (error) {
      error.textContent = result && !result.ok ? result.error : ''
      error.hidden = !result || result.ok
    }
    if (status) {
      status.textContent = result && !result.ok
        ? 'CSS 暂未应用 · 请按提示修改'
        : '实时预览 · 已自动保存'
    }
  }

  function updateCustomCss(rawCss) {
    var count = ov.querySelector('#rsCssCount')
    if (count) count.textContent = String(rawCss.length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
    var previewResult = compileScopedReaderCss(rawCss, '.reader-article-css-preview-scope')
    var actualResult = compileScopedReaderCss(rawCss, '.reader-article-css-scope')
    if (!previewResult.ok || !actualResult.ok) {
      setCssFeedback(!previewResult.ok ? previewResult : actualResult)
      return false
    }
    rs.customCss = rawCss
    persistAndPreview()
    setCssFeedback(previewResult)
    return true
  }

  var customCssInput = ov.querySelector('#rsCustomCss')
  if (customCssInput) customCssInput.oninput = function() {
    updateCustomCss(this.value)
  }
  var cssExampleButton = ov.querySelector('#rsCssExample')
  if (cssExampleButton) cssExampleButton.onclick = function() {
    if (!customCssInput) return
    customCssInput.value = ':scope { --rd-reading-accent: #a06b7b; }\n.article-title { letter-spacing: .08em; }\n.article-choice-btn { border-style: solid; }'
    updateCustomCss(customCssInput.value)
    customCssInput.focus()
  }
  var clearCssButton = ov.querySelector('#rsClearCss')
  if (clearCssButton) clearCssButton.onclick = function() {
    if (!customCssInput) return
    customCssInput.value = ''
    updateCustomCss('')
    customCssInput.focus()
  }

  // Font upload button
  var rsUploadFontBtn = ov.querySelector('#rsUploadFont')
  if (rsUploadFontBtn) rsUploadFontBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2'
    inp.onchange = function() {
      var file = inp.files && inp.files[0]; if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        showReaderToast('字体文件请控制在 2MB 以内，避免占满浏览器本地空间')
        return
      }
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      name = name.replace(/["'\\;{}<>]/g, '').trim().slice(0, 64)
      if (!name) return
      var r = new FileReader()
      r.onload = function() {
        rs.customFonts = rs.customFonts || []
        rs.customFonts.push({ name: name, data: r.result })
        persistAndPreview()
        closePanel({ restoreFocus: false })
        openReaderSettingsPanel(activeTrigger)
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
      var removedFont = rs.customFonts[idx]
      rs.customFonts.splice(idx, 1)
      if (rs.fontFamily === '"' + (removedFont && removedFont.name) + '"') rs.fontFamily = READER_APPEARANCE_DEFAULTS.fontFamily
      persistAndPreview()
      closePanel({ restoreFocus: false })
      openReaderSettingsPanel(activeTrigger)
    }
  })

  // Reset
  var resetBtn = ov.querySelector('#rsReset')
  if (resetBtn) resetBtn.onclick = function() {
    rs = Object.assign({}, READER_APPEARANCE_DEFAULTS, { customFonts: rs.customFonts || [] })
    persistAndPreview()
    closePanel({ restoreFocus: false })
    openReaderSettingsPanel(activeTrigger)
  }
}

function renderArticleReader() {
  if (!_work || _work.type === 'phone') return renderPhoneReader()
  var nodes = _work.nodes || []
  if (!_articlePath.length) {
    var initialNodeId = _work.startNode || (nodes.length ? nodes[0].id : null)
    if (initialNodeId) _articlePath = [initialNodeId]
  }
  _nodeId = _articlePath[_articlePath.length - 1] || null
  var node = nodes.find(function(n) { return n.id === _nodeId })
  if (!node) {
    render('app', '<div class="drop-zone"><p>作品内容为空</p><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>')
    return
  }

  var phs = _work.placeholders || []
  var chapterEntries = currentArticleChapterEntries(nodes, _articlePath)
  if (!chapterEntries.length) chapterEntries = [{node:node, pathIndex:_articlePath.length - 1}]
  var currentChapterId = String(node.chapterId || '')
  var chapters = Array.isArray(_work.chapters) ? _work.chapters : []
  var currentChapter = chapters.find(function(chapter) { return String(chapter.id || '') === currentChapterId })
  var chapterTitle = currentChapter?.name || chapterEntries[0].node.title || _work.title || ''

  // Progress dots
  var visitedSet = {}
  _articlePath.forEach(function(id) {
    var pathNode = nodes.find(function(candidate) { return candidate.id === id })
    if (pathNode) visitedSet[String(pathNode.chapterId || '')] = true
  })
  var chapterDots = chapters.length ? chapters : nodes.reduce(function(list, candidate) {
    var chapterId = String(candidate.chapterId || '')
    if (!list.some(function(item) { return item.id === chapterId })) list.push({id:chapterId})
    return list
  }, [])
  var previousChapterPath = previousArticleChapterPath(nodes, _articlePath)
  var hasPreviousChapter = previousChapterPath.length > 0 && previousChapterPath.length < _articlePath.length
  var h = '<div class="article-reading-backdrop" aria-hidden="true"></div>'
  h += renderWorkWatermark(_work.watermark, 'article')
  if (hasPreviousChapter) {
    h += '<button type="button" class="reader-back" data-reader-previous title="返回上一章" aria-label="返回上一章">←</button>'
  } else {
    h += '<button type="button" class="reader-back" data-reader-home title="返回首页" aria-label="返回首页">←</button>'
  }
  h += '<button type="button" class="reader-settings-btn" title="文章阅读外观" aria-label="打开文章阅读外观">⚙</button>'
  h += '<div class="article-reader reader-article-css-scope">'
  h += '<div class="article-progress">'
  for (var ni = 0; ni < chapterDots.length; ni++) {
    var dotChapterId = String(chapterDots[ni].id || '')
    h += '<span class="dot' + (dotChapterId === currentChapterId ? ' current' : '') + (visitedSet[dotChapterId] ? ' visited' : '') + '"></span>'
  }
  h += '</div>'

  var pmTriggers = []
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

  h += '<h1 class="article-title">' + esc(chapterTitle) + '</h1>'
  h += '<div class="article-meta">' + esc(_work.author || '') + '</div>'
  chapterEntries.forEach(function(entry, entryIndex) {
    var entryNode = entry.node
    var content = entryNode.content || ''
    if (phs.length > 0 && _work.readerPhValues) {
      content = substitutePlaceholders(content, phs, {valuesMap:_work.readerPhValues, usePlaceholderMode:false})
    }
    var cleanContent = content.replace(/<div class="pm-inline-card"[^>]*>[\s\S]*?<\/div>/gi, '<span class="rd-pm-marker"></span>')
    var pmCards = content.match(/<div class="pm-inline-card"[^>]*data-pm-id="([^"]*)"[^>]*data-pm-type="([^"]*)"[^>]*>/gi) || []
    var entryTriggers = []
    pmCards.forEach(function(card) {
      var idMatch = card.match(/data-pm-id="([^"]*)"/)
      var typeMatch = card.match(/data-pm-type="([^"]*)"/)
      if (idMatch && typeMatch) entryTriggers.push({pmid:idMatch[1], type:typeMatch[1]})
    })
    var triggerIndex = 0
    cleanContent = cleanContent.replace(/<span class="rd-pm-marker"><\/span>/g, function() {
      if (triggerIndex >= entryTriggers.length) return ''
      var pt = entryTriggers[triggerIndex++]
      var def = PH_APP_DEFS[pt.type] || PH_APP_DEFS.messages
      return buildReaderPhoneModuleTrigger({pmid:pt.pmid, type:pt.type, label:def.label, trustedIconHtml:def.icon, hasUnread:!visitedPm[pt.pmid]})
    })

    var isActive = entryIndex === chapterEntries.length - 1
    h += '<section class="article-node' + (isActive ? ' is-active' : ' is-resolved') + '" data-article-path-index="' + entry.pathIndex + '">'
    if (entryNode.title && (chapterEntries.length > 1 || entryNode.title !== chapterTitle)) {
      h += '<h2 class="article-node-title">' + esc(entryNode.title) + '</h2>'
    }
    h += '<div class="article-content"' + (isActive ? ' data-active="true"' : '') + '>' + cleanContent + '</div>'
    var choices = entryNode.choices || []
    if (choices.length > 0) {
      var selectedTarget = _articlePath[entry.pathIndex + 1] || ''
      var interactionGroup = choices.every(function(choice) { return choice.mode === 'interaction' })
      var selectedInteraction = _articleInteractionSelections[entryNode.id] || ''
      h += '<div class="article-choices' + (interactionGroup ? ' is-interaction' : '') + '" data-choice-node-id="' + escapeHtmlAttribute(entryNode.id) + '">'
      choices.forEach(function(c, ci) {
        var interaction = c.mode === 'interaction'
        var targetState = interaction ? { ok:true } : resolveArticleChoiceTarget(nodes, c.targetId)
        var selected = interaction ? selectedInteraction === String(c.id) : Boolean(selectedTarget && selectedTarget === c.targetId)
        var disabled = targetState.ok ? '' : ' disabled aria-disabled="true" title="这个去向已被删除，请联系作者"'
        var warning = targetState.ok ? '' : '<span class="article-choice-error">去向已失效</span>'
        h += '<button class="article-choice-btn' + (selected ? ' is-selected' : '') + '" data-source-path-index="' + entry.pathIndex + '" data-choice-node-id="' + escapeHtmlAttribute(entryNode.id) + '" data-choice-id="' + escapeHtmlAttribute(c.id || '') + '" data-choice-mode="' + (interaction ? 'interaction' : 'branch') + '" data-target="' + escapeHtmlAttribute(c.targetId || '') + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' + disabled + '><span class="label">' + (ci + 1) + '.</span><span>' + esc(c.text || '选项') + '</span>' + warning + '</button>'
      })
      h += '</div>'
    }
    h += '</section>'
  })
  var frontierChoices = chapterEntries[chapterEntries.length - 1].node.choices || []
  var frontierBranchChoices = frontierChoices.filter(function(choice) { return choice.mode !== 'interaction' })
  if (frontierBranchChoices.length === 0) {
    h += '<div style="text-align:center;padding:24px"><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>'
  }
  h += '</div>'

  render('app', h)

  // Apply reader settings and bind controls as soon as the article enters the DOM.
  var rs = getReaderSettings()
  var articleContents = Array.from(document.querySelectorAll('.article-content'))
  articleContents.forEach(function(contentElement) { applyReaderSettings(contentElement, rs) })
  var ac = document.querySelector('.article-content[data-active="true"]')
  var sb = document.querySelector('.reader-settings-btn')
  if (sb) sb.onclick = function() { openReaderSettingsPanel(sb) }

  // Keep the optional typing effect delayed so layout and settings are already stable.
  setTimeout(function() {
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
  }, 0)

  // Bind choices
  var btns = document.querySelectorAll('.article-choice-btn')
  btns.forEach(function(btn) {
    btn.onclick = function() {
      if (btn.dataset.choiceMode === 'interaction') {
        var nodeId = btn.dataset.choiceNodeId || ''
        _articleInteractionSelections[nodeId] = btn.dataset.choiceId || ''
        document.querySelectorAll('.article-choice-btn[data-choice-mode="interaction"]').forEach(function(option) {
          if (String(option.dataset.choiceNodeId || '') !== String(nodeId)) return
          var selected = option === btn
          option.classList.toggle('is-selected', selected)
          option.setAttribute('aria-pressed', String(selected))
        })
        return
      }
      var targetState = resolveArticleChoiceTarget(nodes, btn.dataset.target)
      if (targetState.ok) {
        var sourcePathIndex = Number(btn.dataset.sourcePathIndex)
        var transition = appendArticleChoice(nodes, _articlePath, sourcePathIndex, targetState.targetId)
        if (!transition.ok) return
        _articlePath = transition.path
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
        if (transition.chapterChanged) {
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
        } else {
          var activeNode = document.querySelector('.article-node.is-active')
          if (activeNode && typeof activeNode.scrollIntoView === 'function') activeNode.scrollIntoView({block:'start'})
        }
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
      var contacts = (_work.phoneData && Array.isArray(_work.phoneData.contacts))
        ? _work.phoneData.contacts
        : (d.contacts || [])
      contacts = orderedContacts(contacts, d.contactSortMode)
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
        displaySettings: (_work.phoneData && _work.phoneData.displaySettings) || d.displaySettings || {},
        contacts: contacts,
        chats: d.chats || [],
        moments: [],
        forumPosts: d.forumPosts || [],
        forumNpcs: d.forumNpcs || [],
        memos: d.memos || [],
        photos: photos,
        albums: albums,
        browserHistory: d.browserHistory || [],
        shoppingItems: d.shoppingItems || [],
        appConnections: d.appConnections || {},
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
      function closeOverlay() {
        if (_work._overlayWrapper === phoneWrapper) {
          _work._overlayWrapper = null
          _work._inOverlay = false
          _work._directOverlayClose = null
          if (hadPhoneData) _work.phoneData = previousPhoneData
          else delete _work.phoneData
        }
        overlay.remove()
      }
      backBtn.onclick = closeOverlay
      overlay.appendChild(backBtn)
      // Set phoneData and overlay context for back navigation
      _work.phoneData = pd
      var phoneWrapper = document.createElement('div')
      phoneWrapper.className = 'rd-pm-phone-wrap'
      phoneWrapper.innerHTML = buildPhoneHTML(readerPhoneData(pd), rc, _work && _work.watermark)
      overlay.appendChild(phoneWrapper)
      document.body.appendChild(overlay)
      _work._overlayWrapper = phoneWrapper
      _work._inOverlay = true
      _work._directOverlayClose = closeOverlay
      bindOverlayApps(phoneWrapper)
      openReaderApp(type)
    }
  })
}

function readerPhoneFlowCueHtml(work, step, showAction) {
  if (!step) return ''
  var session = readerPhoneFlowSession(work)
  var position = Math.min(session.index + 1, session.sequence.length)
  var h = '<aside class="rd-flow-cue" aria-label="作者阅读引导">'
  h += '<span class="rd-flow-cue-step">阅读引导 ' + position + ' / ' + session.sequence.length + '</span>'
  h += '<strong>' + esc(step.label || '查看当前内容') + '</strong>'
  if (showAction !== false) h += '<button type="button" class="rd-flow-next">看完了，提示下一项</button>'
  h += '</aside>'
  return h
}

function finishReaderPhoneFlowStep(work) {
  var nextStep = advanceReaderPhoneFlow(work)
  renderPhoneReader()
  if (nextStep) focusReaderAppIcon(document, phoneReadingFlowAppType(nextStep))
}

function bindReaderPhoneFlowCue(root, work, onFinish) {
  var button = root && root.querySelector ? root.querySelector('.rd-flow-next') : null
  if (!button) return
  button.onclick = function() {
    if (typeof onFinish === 'function') onFinish()
    else finishReaderPhoneFlowStep(work)
  }
}

function readerPhoneFlowNotificationHtml(phoneData, step) {
  if (!step) return ''
  var appType = phoneReadingFlowAppType(step)
  var target = resolvePhoneReadingFlowStep(phoneData, step)
  if (!appType || !target) return ''
  var apps = Array.isArray(phoneData && phoneData.apps) ? phoneData.apps : []
  var app = apps.find(function(item) { return item && item.type === appType })
  var fallbackLabels = {
    messages: '消息',
    moments: '动态',
    memo: '备忘录',
    shopping: '购物',
    forum: '论坛',
    gallery: '相册',
    browser: '浏览器',
  }
  var appLabel = step.type === 'moments'
    ? fallbackLabels.moments
    : (app ? readerAppName(app) : (fallbackLabels[step.type] || 'App'))
  var safeIcon = sanitizeIconHtml(app && app.icon || appLabel.charAt(0)) || esc(appLabel.charAt(0))
  var headline = String(step.label || appLabel).trim()
  var detailLabels = {
    memo: '有一条备忘录等待查看',
    shopping: '有一条购物记录等待查看',
    forum: '有一篇帖子等待查看',
    moments: '有一条动态等待查看',
    gallery: '有一张照片等待查看',
    browser: '有一条浏览记录等待查看',
  }
  var detail = detailLabels[step.type] || '有一段新内容，点击查看'

  var contacts = Array.isArray(phoneData && phoneData.contacts) ? phoneData.contacts : []
  if (step.type === 'messages' && target.chat) {
    var chat = target.chat
    var contact = contacts.find(function(item) {
      return Array.isArray(chat.contactIds) && chat.contactIds.some(function(id) { return String(id) === String(item && item.id) })
    })
    headline = chat.type === 'group' ? (chat.groupName || '群聊') : (contact && contact.name || '新消息')
    detail = '有一段新对话，点击查看'
  }

  var h = '<button type="button" class="phone-flow-notification" data-flow-notification-app="' + escapeHtmlAttribute(appType) + '" aria-label="打开' + escapeHtmlAttribute(appLabel + '：' + headline) + '">'
  h += '<span class="phone-flow-notification-icon" aria-hidden="true">' + safeIcon + '</span>'
  h += '<span class="phone-flow-notification-copy">'
  h += '<span class="phone-flow-notification-meta"><strong>' + esc(appLabel) + '</strong><span>刚刚</span></span>'
  h += '<b>' + esc(headline) + '</b>'
  h += '<span>' + esc(detail) + '</span>'
  h += '</span>'
  h += '</button>'
  return h
}

// ====== Build Phone HTML (shared by article overlay and standalone phone) ======
function buildPhoneHTML(pd, custom, watermark, flowStep) {
  var skin = readerOwnDataRecord(pd.skin)
  var rc = normalizePhoneCustom(custom || getPhoneCustom())
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
  skin.showIconShadow = rc.showIconShadow
  skin.iconBorderRadius = rc.iconBorderRadius
  skin.materialOpacity = rc.materialOpacity
  skin.timeColor = rc.timeColor
  applyPhoneCustomCss(rc)
  var apps = pd.apps || []

  var h = ''
  var usesDefaultWallpaper = (skin.wallpaper || '#eee6e7').toLowerCase() === '#eee6e7' && skin.wallpaperType !== 'image' && !skin.wallpaperImage
  var readerBgStyle = '--phone-bg:' + sanitizeCssColor(skin.wallpaper || '#eee6e7') + ';'
  readerBgStyle += '--phone-radius:' + (skin.borderRadius ?? 18) + 'px;'
  readerBgStyle += '--phone-font:' + safePhoneCustomFontFamily(skin.fontFamily, readerPhoneCustomDefaults().fontFamily) + ';'
  readerBgStyle += '--phone-fontsize:' + (skin.fontSize || 12) + 'px;'
  readerBgStyle += '--phone-frame:' + (skin.frameColor || '#8f7b81')
  readerBgStyle += ';--phone-icon-radius:' + (skin.iconBorderRadius ?? 6) + 'px'
  readerBgStyle += ';--phone-material-opacity:' + (skin.materialOpacity ?? 65) + '%'
  readerBgStyle += ';--phone-time-color:' + sanitizeCssColor(skin.timeColor || '#ffffff')
  readerBgStyle += ';--phone-notification-top:' + (skin.showDynamicIsland === false ? 10 : 36) + 'px'
  if (skin.wallpaperType === 'image' && skin.wallpaperImage) {
    readerBgStyle += ';background-image:url(' + esc(skin.wallpaperImage) + ');background-size:cover;background-position:center'
  }
  h += '<div class="phone-frame reader-phone-css-scope' + (usesDefaultWallpaper ? ' phone-default-wallpaper' : '') + '" style="' + escapeHtmlAttribute(readerBgStyle) + '">'
  h += renderWorkWatermark(watermark, 'phone')

  if (skin.showDynamicIsland !== false) {
    h += '<div class="phone-island"><div class="phone-island-pill"></div></div>'
  }
  h += readerPhoneFlowNotificationHtml(pd, flowStep)

  var coverBg = skin.topBgImage || skin.wallpaperImage || ''
  h += '<div class="phone-profile"'
  if (coverBg) h += ' style="background-image:url(' + esc(coverBg) + ');background-size:cover;background-position:center"'
  h += '>'
  h += '<div class="phone-profile-overlay"></div>'
  h += '<div class="phone-widget-copy">'
  h += '<div class="phone-widget-kicker">MY POCKET / READER</div>'
  h += '<div class="phone-profile-id">' + esc(skin.readerId || '读者') + '</div>'
  h += '<div class="phone-widget-status"><span></span> LOCAL PROFILE</div>'
  h += '</div>'
  h += '<div class="phone-avatar">'
  if (skin.readerAvatar) h += '<img src="' + esc(skin.readerAvatar) + '" alt="">'
  h += '</div>'
  h += '</div>'

  h += '<div id="phoneDesktopReader" class="phone-desktop" style="flex:1;position:relative;min-height:420px;padding:10px 20px;' + phoneGridContainerStyle() + '">'
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    if (app.enabled === false) continue
    if (app.type === 'settings' || app.type === 'customize' || app.type === 'profile') continue
    var gridStyle = phoneGridItemStyle(app.desktopX || 0, app.desktopY || 0)
    var appName = readerAppName(app)
    var isFlowApp = !!flowStep && phoneReadingFlowAppType(flowStep) === app.type
    h += '<button type="button" class="phone-app-icon" aria-label="' + escapeHtmlAttribute(appName) + '" data-app-type="' + escapeHtmlAttribute(app.type || '') + '" style="' + gridStyle + 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:absolute;width:72px;border:none!important;box-shadow:none!important">'
    var customIcon = readerCustomIconUrl(rc.customIcons && rc.customIcons[app.type])
    h += '<span class="phone-icon-body' + (skin.showIconShadow === false ? '' : ' icon-shadow') + '" style="background:' + READER_DEFAULT_APP_ICON_SURFACE + ';position:relative">'
    var safeAppIcon = sanitizeIconHtml(app.icon || '?') || '?'
    if (customIcon) {
      h += '<img src="' + escapeHtmlAttribute(customIcon) + '" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:var(--phone-icon-radius,6px)" onerror="this.style.display=\'none\'">'
      h += '<span class="phone-icon-char" style="width:36px;height:36px;display:none;align-items:center;justify-content:center;color:#333;line-height:1">' + safeAppIcon + '</span>'
    } else {
      h += '<span class="phone-icon-char" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#333;line-height:1">' + safeAppIcon + '</span>'
    }
    if (app.hasUpdate || isFlowApp) {
      h += '<span class="phone-flow-badge" aria-hidden="true"></span>'
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
  var pd = readerPhoneData(_work.phoneData)
  var rc = getPhoneCustom()
  var flowStep = currentReaderPhoneFlowStep(_work)
  var h = '<button type="button" class="reader-back" data-reader-home title="返回" aria-label="返回首页">←</button>'
  h += '<div class="phone-reader">'
  h += buildPhoneHTML(pd, rc, _work.watermark, flowStep)
  h += '</div>'
  render('app', h)

  var icons = document.querySelectorAll('.phone-app-icon')
  function openSelectedReaderApp(type) {
    var activeStep = currentReaderPhoneFlowStep(_work)
    var selectedStep = activeStep && phoneReadingFlowAppType(activeStep) === type ? activeStep : null
    openReaderApp(type, undefined, undefined, selectedStep)
  }
  icons.forEach(function(icon) {
    icon.onclick = function() {
      openSelectedReaderApp(icon.dataset.appType)
    }
  })
  var flowNotification = document.querySelector('.phone-flow-notification[data-flow-notification-app]')
  if (flowNotification) {
    flowNotification.onclick = function() {
      openSelectedReaderApp(flowNotification.dataset.flowNotificationApp)
    }
  }
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

function readerCharacterAppItemCount(pd, type, contactId) {
  var collection = []
  if (type === 'memo') collection = pd.memos || []
  else if (type === 'gallery') collection = (pd.photos || []).concat(pd.albums || [])
  else if (type === 'browser') collection = pd.browserHistory || []
  else if (type === 'shopping') collection = pd.shoppingItems || []
  return collection.filter(function(item) { return item && item.contactId === contactId }).length
}

function readerRichTextHasContent(value) {
  var shell = document.createElement('div')
  shell.innerHTML = String(value || '')
  return shell.textContent.replace(/\u00a0/g, ' ').trim().length > 0
}

// ---- Reader App Panels ----
function openReaderApp(type, contactIndex, connectionConfirmed, flowStep) {
  var inOverlay = _work._inOverlay
  var phoneFrame = document.querySelector('.phone-frame')
  if (!phoneFrame) return
  applyReaderAppCustomCss(type, getAppSettings(type))
  var pd = readerPhoneData(_work.phoneData)
  var flowTarget = flowStep ? resolvePhoneReadingFlowStep(pd, flowStep) : null
  var contacts = pd.contacts || []
  var w = _work
  var rc = getPhoneCustom()
  var lockedApp = type === 'memo' || type === 'gallery' || type === 'browser' || type === 'shopping'
  var appConnections = pd.appConnections && typeof pd.appConnections === 'object' ? pd.appConnections : null
  var hasConfiguredConnection = lockedApp && !!appConnections && Object.prototype.hasOwnProperty.call(appConnections, type)
  var connection = hasConfiguredConnection ? appConnections[type] : null
  var configuredContactMatches = []
  if (connection && typeof connection.contactId === 'string') {
    contacts.forEach(function(contact, index) {
      if (contact.id === connection.contactId) configuredContactMatches.push(index)
    })
  }
  var configuredContactIndex = configuredContactMatches.length === 1 ? configuredContactMatches[0] : -1
  var hasAuthoredConnection = hasConfiguredConnection && configuredContactIndex >= 0
  var hasBrokenConnection = hasConfiguredConnection && !hasAuthoredConnection
  var requestedContactIndex = Number(contactIndex)
  if (flowStep && flowStep.contactId != null && contactIndex == null) {
    requestedContactIndex = contacts.findIndex(function(contact) { return String(contact.id) === String(flowStep.contactId) })
  }
  var activeContactIndex = -1
  if (hasAuthoredConnection) {
    activeContactIndex = configuredContactIndex
  } else if (!hasBrokenConnection && contacts.length > 0) {
    var hasRequestedContact = Number.isInteger(requestedContactIndex)
      && requestedContactIndex >= 0
      && requestedContactIndex < contacts.length
    activeContactIndex = hasRequestedContact ? requestedContactIndex : 0
  }
  var activeContact = activeContactIndex >= 0 ? contacts[activeContactIndex] : null

  function belongsToActiveContact(item) {
    return !activeContact || item.contactId === activeContact.id
  }

  function backToDesktop() {
    if (inOverlay && typeof _work._directOverlayClose === 'function') {
      _work._directOverlayClose()
      return
    }
    if (inOverlay && _work._overlayWrapper) {
      _work._overlayWrapper.innerHTML = buildPhoneHTML(pd, rc, _work.watermark)
      bindOverlayApps(_work._overlayWrapper)
      focusReaderAppIcon(_work._overlayWrapper, type)
    } else {
      renderPhoneReader()
      focusReaderAppIcon(document, type)
    }
  }

  function wrapPanel(title, bodyHtml) {
    var panelType = String(type || '').replace(/[^a-z0-9_-]/gi, '')
    var h = '<div class="cu-panel cu-panel-embedded rd-phone-app-panel rd-phone-app-' + panelType + '" style="z-index:10">'
    h += renderWorkWatermark(_work && _work.watermark, 'phone')
    h += '<div class="cu-header rd-phone-app-header">'
    h += '<button type="button" class="rd-back-btn" aria-label="返回手机桌面" style="color:var(--c-text2)">←</button>'
    h += '<span class="cu-title" style="flex:1;text-align:center">' + esc(title) + '</span>'
    h += '<span class="rd-back-spacer" aria-hidden="true"></span>'
    h += '</div>'
    h += '<div class="cu-body rd-phone-app-body">' + readerPhoneFlowCueHtml(w, flowStep) + bodyHtml + '</div>'
    h += '</div>'
    phoneFrame.innerHTML = h
    var backBtn = phoneFrame.querySelector('.rd-back-btn')
    if (backBtn) {
      backBtn.onclick = backToDesktop
      backBtn.focus()
    }
    bindReaderPhoneFlowCue(phoneFrame, w)
  }

  function contactContextHtml() {
    if (hasAuthoredConnection && activeContact) {
      return '<div class="rd-contact-source"><span>EXTERNAL SOURCE</span><strong>' + esc((activeContact.name || '未命名') + '的手机') + '</strong></div>'
    }
    if (contacts.length < 2) return ''
    var h = '<div class="rd-contact-context">'
    h += '<label for="rdContactSelect">联系人</label>'
    h += '<select class="rd-contact-select" id="rdContactSelect" aria-label="内容联系人">'
    contacts.forEach(function(contact, index) {
      h += '<option value="' + index + '"' + (index === activeContactIndex ? ' selected' : '') + '>' + esc(contact.name || '未命名') + '</option>'
    })
    h += '</select></div>'
    return h
  }

  function wrapContactPanel(title, bodyHtml) {
    if (lockedApp && activeContact) {
      wrapPanel((activeContact.name || '未命名') + ' · ' + title, bodyHtml)
      return
    }
    wrapPanel(title, contactContextHtml() + bodyHtml)
    var select = phoneFrame.querySelector('.rd-contact-select')
    if (!select) return
    select.onchange = function() {
      var nextIndex = Number(select.value)
      if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= contacts.length) return
      openReaderApp(type, nextIndex, undefined, flowStep)
      focusReaderControl(phoneFrame, '.rd-contact-select')
    }
  }

  function showConnectionGate() {
    if (!activeContact) return
    var appLabels = { memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物清单' }
    var appDescriptions = {
      memo: '设备中包含一组可查看的备忘记录。',
      gallery: '设备中包含一组可查看的照片与相册。',
      browser: '设备中保留了一段可查看的浏览记录。',
      shopping: '设备中包含一组购物与订单记录。'
    }
    var appLabel = appLabels[type] || '角色记录'
    var prompt = String(connection && connection.prompt || '').trim() || '剧情中出现了一段来自对方设备的信号。'
    var name = activeContact.name || '未命名'
    var h = '<section class="rd-connection-gate" aria-label="' + escapeHtmlAttribute('确认接入' + name + '的手机') + '">'
    h += '<div class="rd-connection-status"><span>UNKNOWN LINK</span><span>' + esc(appLabel) + ' / WAITING</span></div>'
    h += '<div class="rd-connection-card">'
    h += '<div class="rd-connection-device">'
    h += '<span class="rd-connection-avatar">'
    if (activeContact.avatarUrl) h += '<img src="' + escapeHtmlAttribute(activeContact.avatarUrl) + '" alt="">'
    else h += '<span>' + esc(name.charAt(0)) + '</span>'
    h += '</span><span><strong>' + esc(name) + '的手机</strong><small>来源已由剧情指定</small></span></div>'
    h += '<div class="rd-connection-prompt">' + esc(prompt) + '</div>'
    h += '<p>' + esc(appDescriptions[type] || '设备中包含一组可查看的角色记录。') + '<br>对方似乎没有察觉这次连接。</p>'
    h += '<div class="rd-connection-actions"><button type="button" class="rd-connection-action" data-connection-action="cancel">暂时不要</button><button type="button" class="rd-connection-action primary" data-connection-action="confirm">接入看看</button></div>'
    h += '</div><div class="rd-connection-footer"><span>× DISCONNECT</span><span>✓ CONNECT</span></div></section>'
    phoneFrame.innerHTML = h

    var cancel = phoneFrame.querySelector('[data-connection-action="cancel"]')
    var confirm = phoneFrame.querySelector('[data-connection-action="confirm"]')
    if (cancel) cancel.onclick = backToDesktop
    if (confirm) {
      confirm.onclick = function() { openReaderApp(type, activeContactIndex, true, flowStep) }
      confirm.focus()
    }
  }

  function showConnectionPicker() {
    if (!lockedApp || contacts.length === 0) return
    var appLabels = { memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物清单' }
    var appLabel = appLabels[type] || '角色记录'
    var selectedIndex = activeContactIndex >= 0 ? activeContactIndex : 0
    var h = '<section class="rd-connection-gate" data-connection-state="choose" aria-label="' + escapeHtmlAttribute('选择' + appLabel + '的接入来源') + '">'
    h += '<div class="rd-connection-status"><span>DEVICE LINKS</span><span>' + esc(appLabel) + ' / SELECT</span></div>'
    h += '<div class="rd-connection-picker">'
    h += '<div class="rd-connection-picker-intro"><strong>选择要接入的手机</strong><p>选中角色后确认接入，再查看对应内容。</p></div>'
    h += '<div class="rd-connection-source-list" role="group" aria-label="选择接入角色">'
    contacts.forEach(function(contact, index) {
      var selected = index === selectedIndex
      var count = readerCharacterAppItemCount(pd, type, contact.id)
      h += '<button type="button" class="rd-connection-source' + (selected ? ' selected' : '') + '" data-connection-source-index="' + index + '" aria-pressed="' + (selected ? 'true' : 'false') + '">'
      h += '<span class="rd-connection-source-avatar">'
      if (contact.avatarUrl) h += '<img src="' + escapeHtmlAttribute(contact.avatarUrl) + '" alt="">'
      else h += '<span>' + esc((contact.name || '?').charAt(0)) + '</span>'
      h += '</span><span class="rd-connection-source-copy"><strong>' + esc(contact.name || '未命名') + '</strong><small>' + count + ' 条内容</small></span>'
      h += '<span class="rd-connection-source-check" aria-hidden="true">' + (selected ? '✓' : '→') + '</span></button>'
    })
    h += '</div>'
    h += '<div class="rd-connection-actions"><button type="button" class="rd-connection-action" data-connection-action="cancel">暂时不要</button><button type="button" class="rd-connection-action primary" data-connection-action="confirm">接入看看</button></div>'
    h += '</div><div class="rd-connection-footer"><span>× DISCONNECT</span><span>✓ CONNECT</span></div></section>'
    phoneFrame.innerHTML = h

    var sourceButtons = phoneFrame.querySelectorAll('[data-connection-source-index]')
    sourceButtons.forEach(function(button) {
      button.onclick = function() {
        var nextIndex = Number(button.dataset.connectionSourceIndex)
        if (!Number.isInteger(nextIndex) || !contacts[nextIndex]) return
        selectedIndex = nextIndex
        sourceButtons.forEach(function(item) {
          var selected = item === button
          item.classList.toggle('selected', selected)
          item.setAttribute('aria-pressed', selected ? 'true' : 'false')
          var check = item.querySelector('.rd-connection-source-check')
          if (check) check.textContent = selected ? '✓' : '→'
        })
      }
    })

    var cancel = phoneFrame.querySelector('[data-connection-action="cancel"]')
    var confirm = phoneFrame.querySelector('[data-connection-action="confirm"]')
    if (cancel) cancel.onclick = backToDesktop
    if (confirm) confirm.onclick = function() { openReaderApp(type, selectedIndex, true, flowStep) }
    var selectedSource = phoneFrame.querySelector('.rd-connection-source.selected')
    if (selectedSource) selectedSource.focus()
  }

  function showUnavailableConnection() {
    var appLabels = { memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物清单' }
    var appLabel = appLabels[type] || '角色记录'
    var h = '<section class="rd-connection-gate" data-connection-state="unavailable" aria-label="角色来源已失效">'
    h += '<div class="rd-connection-status"><span>LINK ERROR</span><span>' + esc(appLabel) + ' / UNAVAILABLE</span></div>'
    h += '<div class="rd-connection-card">'
    h += '<div class="rd-connection-device"><span class="rd-connection-avatar"><span>!</span></span><span><strong>暂时无法接入</strong><small>作者指定的角色来源已失效</small></span></div>'
    h += '<div class="rd-connection-prompt">这位联系人可能已被作者删除或更换。</div>'
    h += '<p>为了避免显示错误角色的内容，这里不会自动切换到其他联系人。</p>'
    h += '<div class="rd-connection-actions"><button type="button" class="rd-connection-action primary" data-connection-action="cancel">返回手机</button></div>'
    h += '</div><div class="rd-connection-footer"><span>× DISCONNECTED</span><span>— SOURCE LOST</span></div></section>'
    phoneFrame.innerHTML = h

    var cancel = phoneFrame.querySelector('[data-connection-action="cancel"]')
    if (cancel) {
      cancel.onclick = backToDesktop
      cancel.focus()
    }
  }

  if (hasBrokenConnection) {
    showUnavailableConnection()
    return
  }

  if (lockedApp && contacts.length > 0 && connectionConfirmed !== true) {
    if (hasAuthoredConnection) showConnectionGate()
    else showConnectionPicker()
    return
  }

  if (type === 'messages') {
    var chats = pd.chats || []
    var phoneChoiceSession = readerPhoneChoiceSession(w)
    if (phoneChoiceSession.moments === null) phoneChoiceSession.moments = cloneReaderThreadItems(pd.moments)
    var moments = phoneChoiceSession.moments
    var momentChoiceRuns = phoneChoiceSession.momentChoiceRuns
    var momentMentionNames = listForumIdentities(pd).map(function(identity) { return identity.name })
      .concat((pd.forumNpcs || []).map(function(npc) { return npc.name }))
      .concat([readerThreadDisplayName(pd, rc)])
      .concat(readerPlaceholderMentionNames())
      .filter(Boolean)

    function renderMomentComment(moment, comment) {
      var containerKey = String(moment.id)
      var isReader = comment && (comment.contactId === 'self' || comment.senderId === 'self')
      var name = String(comment && comment.contactName || (isReader ? readerThreadDisplayName(pd, rc) : '角色')).trim() || (isReader ? '我' : '角色')
      var content = String(comment && (comment.content != null ? comment.content : comment.text) || '')
      var h = '<div class="rd-thread-comment' + (isReader ? ' is-reader' : '') + '" data-thread-item-id="' + escapeHtmlAttribute(String(comment.id)) + '">'
      h += '<div class="rd-thread-comment-meta"><span class="rd-thread-comment-name">' + esc(name) + '</span>'
      if (shouldShowPhoneTimestamp(pd, comment.time)) h += '<time>' + esc(comment.time) + '</time>'
      h += '</div>'
      h += '<div class="rd-thread-comment-content">' + renderReaderMentionText(content, momentMentionNames) + '</div>'
      h += renderReaderThreadReselect(comment, 'moment', containerKey, momentChoiceRuns)
      h += renderReaderThreadChoiceControls(comment, 'moment', containerKey, momentChoiceRuns)
      h += '</div>'
      return h
    }

    function renderMessagesHome(section, moveFocus) {
      var activeSection = section === 'moments' ? 'moments' : 'chats'
      var h = '<div class="rd-message-section-tabs" role="tablist" aria-label="消息内容">'
      h += '<button type="button" class="rd-message-section-tab' + (activeSection === 'chats' ? ' active' : '') + '" role="tab" aria-selected="' + (activeSection === 'chats' ? 'true' : 'false') + '" aria-controls="rdMessageChats" tabindex="' + (activeSection === 'chats' ? '0' : '-1') + '" data-message-section="chats">聊天</button>'
      h += '<button type="button" class="rd-message-section-tab' + (activeSection === 'moments' ? ' active' : '') + '" role="tab" aria-selected="' + (activeSection === 'moments' ? 'true' : 'false') + '" aria-controls="rdMessageMoments" tabindex="' + (activeSection === 'moments' ? '0' : '-1') + '" data-message-section="moments">动态</button>'
      h += '</div>'

      if (activeSection === 'chats') {
        h += '<div id="rdMessageChats" class="rd-message-section" role="tabpanel">'
        if (chats.length === 0) h += '<div class="rd-app-empty">暂无对话</div>'
        orderedChats(chats).forEach(function(ch) {
          var chatIndex = chats.indexOf(ch)
          var name = ''
          var chatIdentity = null
          if (ch.type === 'group') name = ch.groupName || '群聊'
          else {
            var cc = contacts.find(function(x) { return x.id === ch.contactIds[0] })
            chatIdentity = resolveContactIdentity(pd, ch.contactIds[0], { surface: 'messages', authoredName: '未知' })
            name = chatIdentity.name || '未知'
          }
          h += '<button type="button" class="rd-chat-card" data-chat-index="' + chatIndex + '" aria-label="' + escapeHtmlAttribute('打开与 ' + name + ' 的对话') + '">'
          h += '<span class="rd-message-avatar" style="--rd-avatar-bg:' + sanitizeCssColor(ch.type === 'group' ? '#769b8f' : avatarColor(ch.contactIds && ch.contactIds[0])) + '">'
          if (ch.type === 'group' && ch.groupAvatarUrl) h += '<img src="' + escapeHtmlAttribute(ch.groupAvatarUrl) + '" alt="">'
          else if (chatIdentity && chatIdentity.avatar) h += '<img src="' + escapeHtmlAttribute(chatIdentity.avatar) + '" alt="">'
          else h += esc(name.charAt(0))
          h += '</span>'
          h += '<span class="rd-message-card-copy"><strong>' + esc(name) + '</strong><small>' + (ch.pinned === true ? '置顶 · ' : '') + '打开聊天</small></span>'
          h += '</button>'
        })
        h += '</div>'
      } else {
        h += '<div id="rdMessageMoments" class="rd-message-section rd-moment-feed" role="tabpanel">'
        if (moments.length === 0) h += '<div class="rd-app-empty">暂无动态</div>'
        moments.forEach(function(moment) {
          var momentIdentity = resolveContactIdentity(pd, moment.contactId, { surface: 'messages', authoredName: moment.contactName || '' })
          var momentName = String(momentIdentity.name || readerThreadActorName(pd, moment.contactId, '', '角色'))
          h += '<article class="rd-moment-card' + (flowStep && String(moment.id) === String(flowStep.itemId) ? ' is-flow-target' : '') + '" data-moment-id="' + escapeHtmlAttribute(String(moment.id)) + '">'
          h += '<header class="rd-moment-head"><span class="rd-moment-avatar" style="--rd-avatar-bg:' + sanitizeCssColor(avatarColor(moment.contactId)) + '">'
          if (momentIdentity.avatar) h += '<img src="' + escapeHtmlAttribute(momentIdentity.avatar) + '" alt="">'
          else h += esc(momentName.charAt(0))
          h += '</span>'
          h += '<span><strong>' + esc(momentName) + '</strong>' + (shouldShowPhoneTimestamp(pd, moment.time) ? '<time>' + esc(moment.time) + '</time>' : '') + '</span></header>'
          h += '<div class="rd-moment-content">' + renderReaderMentionText(moment.content || '', momentMentionNames) + '</div>'
          if (Array.isArray(moment.images) && moment.images.length > 0) {
            h += '<div class="rd-moment-images">'
            moment.images.forEach(function(image) {
              var src = typeof image === 'string' ? image : (image && (image.url || image.src) || '')
              if (src) h += '<img src="' + escapeHtmlAttribute(src) + '" alt="" onerror="this.style.display=\'none\'">'
            })
            h += '</div>'
          }
          h += '<div class="rd-moment-comments">'
          var comments = Array.isArray(moment.comments) ? moment.comments : []
          comments.forEach(function(comment) { h += renderMomentComment(moment, comment) })
          h += '</div></article>'
        })
        h += '</div>'
      }

      wrapPanel('消息', h)

      var sectionTabs = phoneFrame.querySelectorAll('.rd-message-section-tab')
      sectionTabs.forEach(function(tab) {
        tab.onclick = function() { renderMessagesHome(tab.dataset.messageSection, true) }
        tab.onkeydown = function(event) {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          renderMessagesHome(activeSection === 'chats' ? 'moments' : 'chats', true)
        }
      })
      if (moveFocus) focusReaderControl(phoneFrame, '[data-message-section="' + activeSection + '"]')

      if (activeSection === 'chats') {
        phoneFrame.querySelectorAll('.rd-chat-card').forEach(function(card) {
          card.onclick = function() {
            var index = Number(card.dataset.chatIndex)
            if (!Number.isInteger(index) || !chats[index]) return
            openReaderChat(phoneFrame, w, pd, chats[index], index)
          }
        })
        return
      }

      phoneFrame.querySelectorAll('.rd-thread-choice-option[data-thread-scope="moment"]').forEach(function(button) {
        button.onclick = function() {
          var moment = moments.find(function(candidate) { return String(candidate.id) === String(button.dataset.threadContainer) })
          if (!moment || !Array.isArray(moment.comments)) return
          var ownerId = resolveReaderThreadOwnerId(moment.comments, button.dataset.threadOwnerId)
          if (ownerId === null) return
          var runKey = readerThreadRunKey(String(moment.id), ownerId)
          if (momentChoiceRuns.has(runKey)) return
          var choiceIndex = Number(button.dataset.threadChoiceIndex)
          var result = applyThreadChoice(moment.comments, ownerId, choiceIndex, readerThreadRuntimeOptions(pd, rc, 'moment'))
          if (!result.ok) return
          moment.comments = result.items
          momentChoiceRuns.set(runKey, { containerKey: String(moment.id), momentId: moment.id, run: result.run })
          renderMessagesHome('moments')
          var reselectButtons = phoneFrame.querySelectorAll('.rd-thread-choice-reselect')
          for (var i = 0; i < reselectButtons.length; i++) {
            if (reselectButtons[i].dataset.threadRunKey !== runKey) continue
            reselectButtons[i].focus()
            break
          }
        }
      })

      phoneFrame.querySelectorAll('.rd-thread-choice-reselect[data-thread-scope="moment"]').forEach(function(button) {
        button.onclick = function() {
          var runKey = button.dataset.threadRunKey
          var entry = momentChoiceRuns.get(runKey)
          if (!entry) return
          var moment = moments.find(function(candidate) { return candidate.id === entry.momentId })
          if (!moment || !Array.isArray(moment.comments)) return
          moment.comments = rollbackThreadChoice(moment.comments, entry.run)
          momentChoiceRuns.delete(runKey)
          renderMessagesHome('moments')
          var choiceButtons = phoneFrame.querySelectorAll('.rd-thread-choice-option')
          for (var i = 0; i < choiceButtons.length; i++) {
            if (choiceButtons[i].dataset.threadOwnerId !== String(entry.run.ownerItemId)) continue
            choiceButtons[i].focus()
            break
          }
        }
      })
    }

    if (flowStep && flowStep.type === 'moments') {
      renderMessagesHome('moments')
    } else if (flowTarget && flowTarget.chat) {
      var flowChatIndex = chats.findIndex(function(chat) { return String(chat.id) === String(flowTarget.chat.id) })
      if (flowChatIndex >= 0) openReaderChat(phoneFrame, w, pd, chats[flowChatIndex], flowChatIndex, flowStep)
      else renderMessagesHome('chats')
    } else {
      renderMessagesHome('chats')
    }
  } else if (type === 'forum') {
    var posts = orderedForumPosts(pd.forumPosts)
    var forumVisual = appStyle('forum')
    var h = ''
    if (posts.length === 0) h += '<div class="rd-app-empty">暂无帖子</div>'
    posts.forEach(function(p, postIndex) {
      var forumIdentity = resolveContactIdentity(pd, p.contactId, { surface: 'forum', aliasId:p.aliasId, authoredName: p.contactName, authoredAvatar: p.contactAvatar })
      var forumVars = '--rd-forum-card:' + sanitizeCssColor(forumVisual.cardBg) + ';--rd-forum-radius:' + boundedReaderSetting(getAppSettings('forum').cardRadius, 0, 0, 16) + 'px;--rd-forum-avatar-radius:' + forumVisual.avatarRadius + ';--rd-forum-title:' + sanitizeCssColor(forumVisual.titleColor) + ';--rd-forum-title-size:' + boundedReaderSetting(getAppSettings('forum').titleSize, 13, 10, 18) + 'px;--rd-forum-time:' + sanitizeCssColor(forumVisual.timeColor)
      h += '<button type="button" class="rd-post-card' + (flowStep && String(p.id) === String(flowStep.itemId) ? ' is-flow-target' : '') + '" data-post-index="' + postIndex + '" aria-label="' + escapeHtmlAttribute('查看帖子 ' + (p.title || '')) + '" style="' + forumVars + '">'
      h += '<span class="rd-forum-avatar" style="--rd-avatar-bg:' + sanitizeCssColor(avatarColor(p.contactId)) + '">'
      if (forumIdentity.avatar) h += '<img src="' + escapeHtmlAttribute(forumIdentity.avatar) + '" alt="">'
      else h += esc((forumIdentity.name || '?').charAt(0))
      h += '</span>'
      h += '<span class="rd-forum-copy"><span class="rd-forum-title-line"><span class="rd-forum-title">' + esc(p.title) + '</span><span class="rd-forum-post-states">'
      if (p.pinned === true) h += '<span class="rd-forum-post-state rd-forum-post-pinned">置顶</span>'
      if (p.featured === true) h += '<span class="rd-forum-post-state rd-forum-post-featured">精华</span>'
      h += '</span></span><span class="rd-forum-meta">' + esc(forumIdentity.name) + (shouldShowPhoneTimestamp(pd, p.time) ? ' / ' + esc(p.time) : '') + '</span></span>'
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
    var memos = (pd.memos || []).filter(belongsToActiveContact).filter(function(memo) {
      return readerRichTextHasContent(memo && memo.content) || String(memo && memo.time || '').trim()
    })
    var memoSettings = getAppSettings('memo')
    var memoVisual = appStyle('memo')
    var memoStyleName = ['plain', 'sticky', 'vintage'].includes(memoVisual.cardStyle) ? memoVisual.cardStyle : 'plain'
    var memoBg = memoStyleName === 'sticky' ? '#fef9e7' : (memoStyleName === 'vintage' ? '#f5e6c8' : memoVisual.cardBg)
    var memoBorder = memoStyleName === 'sticky' ? '#e8d5a0' : (memoStyleName === 'vintage' ? '#d4c4a0' : memoVisual.cardBorder)
    var memoRadius = memoStyleName === 'vintage' ? 2 : boundedReaderSetting(memoSettings.cardRadius, 4, 0, 16)
    var memoVars = '--rd-memo-bg:' + sanitizeCssColor(memoBg) + ';--rd-memo-border:' + sanitizeCssColor(memoBorder) + ';--rd-memo-radius:' + memoRadius + 'px;--rd-memo-text:' + sanitizeCssColor(memoVisual.textColor) + ';--rd-memo-font-size:' + boundedReaderSetting(memoSettings.fontSize, 12, 10, 16) + 'px;--rd-memo-line-height:' + boundedReaderSetting(memoSettings.lineHeight, 1.6, 1.2, 2.4)
    var memoAccent = sanitizeCssColor(activeContact ? avatarColor(activeContact.id) : memoVisual.cardBorder)
    var h = '<div class="rd-memo-stack rd-memo-style-' + memoStyleName + '" style="' + memoVars + '">'
    if (memos.length === 0) h += '<div class="rd-app-empty rd-scoped-empty"><strong>还没有备忘</strong><small>这台设备里暂时没有留下记录</small></div>'
    memos.forEach(function(m) {
      h += '<article class="memo-card rd-memo-note' + (flowStep && String(m.id) === String(flowStep.itemId) ? ' is-flow-target' : '') + '" data-memo-id="' + escapeHtmlAttribute(m.id) + '" style="--memo-accent:' + memoAccent + '">'
      h += '<div class="memo-card-inner"><div class="memo-editor" contenteditable="false">' + (m.content || '') + '</div>'
      if (shouldShowPhoneTimestamp(pd, m.time)) h += '<div class="memo-card-foot"><time class="memo-time-reader">' + esc(m.time) + '</time></div>'
      h += '</div></article>'
    })
    h += '</div>'
    wrapContactPanel('备忘录', h)
  } else if (type === 'gallery') {
    var primaryContact = activeContact && typeof activeContact === 'object' ? activeContact : null
    var galleryStyle = readerGalleryStyleVariables()
    var photos = (Array.isArray(pd.photos) ? pd.photos : []).filter(function(p) {
      return p && typeof p === 'object' && (!primaryContact || p.contactId === primaryContact.id)
    })
    var albums = (Array.isArray(pd.albums) ? pd.albums : []).filter(function(a) {
      return a && typeof a === 'object' && (!primaryContact || a.contactId === primaryContact.id)
    })
    var albumIds = new Set(albums.map(function(a) { return a.id }))

    function renderGalleryPhotoGrid(items) {
      var grid = '<div class="gallery-bar"><span class="gallery-bar-title">最近项目 (' + items.length + ')</span></div><div class="gallery-grid rd-gallery-grid" style="' + galleryStyle + '">'
      if (items.length === 0) grid += '<div class="rd-gallery-empty rd-app-empty rd-scoped-empty"><strong>还没有照片</strong><small>这台设备的相册暂时为空</small></div>'
      items.forEach(function(p) {
        grid += '<button type="button" class="gallery-photo-card rd-gallery-photo' + (flowStep && String(p.id) === String(flowStep.itemId) ? ' is-flow-target' : '') + '" data-photo-id="' + escapeHtmlAttribute(p.id) + '" aria-pressed="false">'
        if (p.imageUrl) {
          grid += '<img src="' + escapeHtmlAttribute(p.imageUrl) + '" alt="' + escapeHtmlAttribute(p.caption || '') + '" onerror="this.style.display=\'none\'">'
        } else {
          grid += '<span class="gallery-photo-placeholder rd-gallery-photo-placeholder"><span class="gallery-photo-text">' + esc(p.caption || '照片') + '</span></span>'
        }
        if (shouldShowPhoneTimestamp(pd, p.time)) grid += '<span class="gallery-photo-cap">' + esc(String(p.time).replace(/\s.*$/, '')) + '</span>'
        grid += '</button>'
      })
      grid += '</div>'
      return grid
    }

    function bindGalleryPhotoButtons() {
      phoneFrame.querySelectorAll('.gallery-photo-card').forEach(function(photoButton) {
        photoButton.onclick = function() {
          var selected = photoButton.getAttribute('aria-pressed') === 'true'
          photoButton.setAttribute('aria-pressed', selected ? 'false' : 'true')
          photoButton.classList.toggle('is-reader-selected', !selected)
        }
      })
    }

    function renderGalleryAlbum(albumIndex) {
      var album = albums[albumIndex]
      if (!album) return
      var albumPhotos = photos.filter(function(p) { return p.albumId === album.id })
      var body = '<button type="button" class="rd-gallery-album-back" aria-label="返回相册列表">← 返回相册</button>'
      body += renderGalleryPhotoGrid(albumPhotos)
      wrapContactPanel(album.name || '相册', body)
      var albumBack = phoneFrame.querySelector('.rd-gallery-album-back')
      if (albumBack) {
        albumBack.onclick = function() { renderGalleryMain(albumIndex) }
        albumBack.focus()
      }
      bindGalleryPhotoButtons()
    }

    function renderGalleryMain(restoreAlbumIndex) {
      var body = ''
      if (albums.length > 0) {
        body += '<div class="gallery-bar"><span class="gallery-bar-title">相册 (' + albums.length + ')</span></div>'
        body += '<div class="gallery-albums rd-album-list">'
        albums.forEach(function(a, albumIndex) {
          var count = photos.filter(function(p) { return p.albumId === a.id }).length
          var cover = photos.find(function(p) { return p.albumId === a.id && p.imageUrl })
          var name = a.name || '相册'
          var accessibleName = '打开相册 ' + name + '，' + count + ' 张'
          body += '<button type="button" class="gallery-album-card rd-album" data-album-index="' + albumIndex + '" aria-label="' + escapeHtmlAttribute(accessibleName) + '">'
          body += '<span class="gallery-album-cover rd-album-cover" aria-hidden="true"' + (cover ? ' style="background-image:url(' + escapeHtmlAttribute(cover.imageUrl) + ');background-size:cover;background-position:center"' : ' style="--gallery-album-accent:' + sanitizeCssColor(activeContact ? avatarColor(activeContact.id) : '#c7a1aa') + '"') + '></span>'
          body += '<span class="gallery-album-name rd-album-name">' + esc(name) + '</span>'
          body += '<span class="gallery-album-count rd-album-count">' + count + ' 张</span>'
          body += '</button>'
        })
        body += '</div>'
      }
      var ungrouped = photos.filter(function(p) { return !p.albumId || !albumIds.has(p.albumId) })
      body += renderGalleryPhotoGrid(ungrouped)
      wrapContactPanel('相册', body)

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
      bindGalleryPhotoButtons()
    }

    var flowPhoto = flowTarget && flowTarget.kind === 'gallery' ? flowTarget.item : null
    var flowAlbumIndex = flowPhoto && flowPhoto.albumId
      ? albums.findIndex(function(album) { return String(album.id) === String(flowPhoto.albumId) })
      : -1
    if (flowAlbumIndex >= 0) renderGalleryAlbum(flowAlbumIndex)
    else renderGalleryMain()
  } else if (type === 'browser') {
    var history = (pd.browserHistory || []).filter(belongsToActiveContact)
    var browserSettings = getAppSettings('browser')
    var browserVisual = appStyle('browser')
    var browserVars = '--rd-browser-entry:' + sanitizeCssColor(browserSettings.entryBg) + ';--rd-browser-radius:' + boundedReaderSetting(browserSettings.entryRadius, 0, 0, 12) + 'px;--rd-browser-title:' + sanitizeCssColor(browserVisual.titleColor) + ';--rd-browser-title-size:' + boundedReaderSetting(browserSettings.titleSize, 12, 10, 16) + 'px;--rd-browser-url:' + sanitizeCssColor(browserVisual.urlColor) + ';--rd-browser-time:' + sanitizeCssColor(browserVisual.timeColor)
    var h = '<div class="browser-search-bar rd-browser-address"><span class="browser-search-icon rd-browser-search" aria-hidden="true">⌕</span><span class="browser-search-placeholder">搜索或输入网址</span></div>'
    h += '<div class="browser-demo-body rd-browser-history" style="' + browserVars + '">'
    if (history.length === 0) h += '<div class="rd-app-empty rd-scoped-empty"><strong>暂无浏览记录</strong><small>这台设备还没有留下访问痕迹</small></div>'
    history.forEach(function(it) {
      h += '<div class="browser-row rd-browser-entry' + (flowStep && String(it.id) === String(flowStep.itemId) ? ' is-flow-target' : '') + '" data-history-id="' + escapeHtmlAttribute(it.id) + '">'
      h += '<span class="browser-dot rd-browser-marker" style="--rd-marker:' + sanitizeCssColor(avatarColor(it.contactId)) + '"></span>'
      h += '<span class="browser-info rd-browser-copy"><span class="browser-title rd-browser-title">' + esc(it.title || '') + '</span><span class="browser-url rd-browser-url">' + esc(it.url || '') + '</span></span>'
      if (shouldShowPhoneTimestamp(pd, it.time)) h += '<span class="browser-right"><time class="browser-time rd-browser-time">' + esc(it.time.replace(/\s.*$/, '')) + '</time></span>'
      h += '</div>'
    })
    h += '</div>'
    wrapContactPanel('浏览记录', h)
  } else if (type === 'shopping') {
    var items = (pd.shoppingItems || []).filter(belongsToActiveContact)
    var shopSettings = getAppSettings('shopping')
    var shopVisual = appStyle('shopping')
    var shopVars = '--rd-shop-card:' + sanitizeCssColor(shopVisual.cardBg) + ';--rd-shop-radius:' + boundedReaderSetting(shopSettings.cardRadius, 0, 0, 16) + 'px;--rd-shop-name:' + sanitizeCssColor(shopVisual.nameColor) + ';--rd-shop-name-size:' + boundedReaderSetting(shopSettings.nameSize, 12, 10, 16) + 'px;--rd-shop-price:' + sanitizeCssColor(shopVisual.priceColor)
    var cartItems = items.filter(function(s) { return s.status !== 'order' })
    var orderItems = items.filter(function(s) { return s.status === 'order' })
    var h = renderPhoneShoppingTabs({
      activeTab: 'cart',
      idPrefix: 'rdShop',
      cartTabId: 'rdShopCartTab',
      orderTabId: 'rdShopOrderTab',
      cartPanelId: 'rdShopCart',
      orderPanelId: 'rdShopOrder',
      tabListClass: 'rd-shop-tabs',
      tabClass: 'rd-shop-tab'
    })
    var flowShopItemId = flowStep && flowStep.itemId
    h += '<div class="shop-body-inner"><div class="rd-shop-panel" id="rdShopCart" role="tabpanel" aria-labelledby="rdShopCartTab">' + renderPhoneShoppingList(cartItems, {
      mode: 'cart',
      surface: 'reader',
      style: shopVars,
      flowItemId: flowShopItemId,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    }) + '</div>'
    h += '<div class="rd-shop-panel" id="rdShopOrder" role="tabpanel" aria-labelledby="rdShopOrderTab" style="display:none" hidden>' + renderPhoneShoppingList(orderItems, {
      mode: 'order',
      surface: 'reader',
      style: shopVars,
      flowItemId: flowShopItemId,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    }) + '</div></div>'
    wrapContactPanel('购物清单', h)

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
    phoneFrame.querySelectorAll('[data-logistics-view]').forEach(function(button) {
      button.onclick = function() {
        var content = Array.from(phoneFrame.querySelectorAll('[data-logistics-content]')).find(function(item) {
          return String(item.dataset.logisticsContent) === String(button.dataset.logisticsView)
        })
        if (!content) return
        var expanded = button.getAttribute('aria-expanded') === 'true'
        button.setAttribute('aria-expanded', expanded ? 'false' : 'true')
        content.hidden = expanded
      }
    })
    if (flowTarget && flowTarget.kind === 'shopping' && flowTarget.item && flowTarget.item.status === 'order') {
      var orderTab = phoneFrame.querySelector('#rdShopOrderTab')
      if (orderTab) activateShopTab(orderTab, false)
    }
  } else if (type === 'profile') {
    var profileName = rc.readerId || pd.skin?.readerId || '读者'
    var profileAvatar = rc.readerAvatar || pd.skin?.readerAvatar || ''
    var h = '<div class="rd-profile-card-phone">'
    h += '<div class="rd-profile-card-avatar">'
    if (profileAvatar) h += '<img src="' + escapeHtmlAttribute(profileAvatar) + '" alt="">'
    else h += '<span>' + esc(profileName.charAt(0)) + '</span>'
    h += '</div>'
    h += '<div class="rd-profile-card-copy"><div class="rd-profile-card-label">READER ID</div><div class="rd-profile-card-name">' + esc(profileName) + '</div></div>'
    h += '</div>'
    wrapPanel('个人主页', h)
  } else if (type === 'contacts') {
    var contactSettings = getAppSettings('contacts')
    var contactVisual = appStyle('contacts')
    var contactVars = '--rd-contact-radius:' + contactVisual.avatarRadius + ';--rd-contact-name:' + sanitizeCssColor(contactVisual.nameColor) + ';--rd-contact-name-size:' + boundedReaderSetting(contactSettings.nameSize, 13, 10, 18) + 'px;--rd-contact-name-weight:' + (contactVisual.nameWeight === '600' || contactVisual.nameWeight === '700' ? contactVisual.nameWeight : '500')
    var h = '<div class="rd-contact-book" style="' + contactVars + '">'
    if (contacts.length === 0) h += '<div class="rd-app-empty">暂无联系人</div>'
    contacts.forEach(function(c) {
      h += '<div class="rd-contact-entry">'
      h += '<div class="rd-contact-avatar" style="--rd-avatar-bg:' + sanitizeCssColor(avatarColor(c.id)) + '">'
      if (c.avatarUrl) h += '<img src="' + escapeHtmlAttribute(c.avatarUrl) + '" alt="">'
      else h += esc((c.name || '?').charAt(0))
      h += '</div>'
      h += '<div class="rd-contact-name">' + esc(c.name || '未命名') + '</div>'
      h += '</div>'
    })
    h += '</div>'
    wrapPanel('联系人', h)
  }
}

// ---- Chat reader ----
function openReaderChat(frame, w, pd, ch, chatIndex, flowStep) {
  var contacts = pd.contacts || []
  var readerCustom = getPhoneCustom()
  var readerChatName = readerThreadDisplayName(pd, readerCustom)
  var authoredReaderAvatar = pd.skin && typeof pd.skin.readerAvatar === 'string' && isSafeImageUrl(pd.skin.readerAvatar)
    ? pd.skin.readerAvatar.trim()
    : ''
  var readerChatAvatar = readerCustom.readerAvatar || authoredReaderAvatar
  var chatMentionNames = ch.type === 'group'
    ? [readerChatName].concat((ch.contactIds || []).map(function(contactId) {
        var contact = contacts.find(function(candidate) { return candidate.id === contactId })
        return contactDisplayName(contact, 'messages', contact?.name || '')
      })).concat(readerPlaceholderMentionNames()).filter(Boolean)
    : []
  var flowSession = readerPhoneFlowSession(w)
  var flowEnabled = flowSession.enabled
  var flowTarget = null
  var chatFlowTypingTimer = null
  var chatFlowAdvanceTimer = null
  var chatFlowRenderToken = 0
  var CHAT_FLOW_CHARACTER_DELAY = 110
  var CHAT_FLOW_MESSAGE_GAP = 800

  function clearChatFlowTimers() {
    if (chatFlowTypingTimer !== null) clearTimeout(chatFlowTypingTimer)
    if (chatFlowAdvanceTimer !== null) clearTimeout(chatFlowAdvanceTimer)
    chatFlowTypingTimer = null
    chatFlowAdvanceTimer = null
  }

  function targetBelongsToChat(target) {
    return !!target && !!target.chat && String(target.chat.id) === String(ch && ch.id)
  }

  function refreshChatFlowContext() {
    var activeStep = currentReaderPhoneFlowStep(w)
    var activeTarget = activeStep ? resolvePhoneReadingFlowStep(pd, activeStep) : null
    if (activeStep && activeStep.type === 'messages' && targetBelongsToChat(activeTarget)) {
      flowStep = activeStep
      flowTarget = activeTarget
    } else {
      flowStep = null
      flowTarget = null
    }
  }

  refreshChatFlowContext()

  function openInlineForumPost(postId, trigger) {
    var post = (pd.forumPosts || []).find(function(item) { return String(item.id) === String(postId) })
    if (!post) return
    var previous = frame.querySelector('.rd-inline-forum-pip')
    if (previous) previous.remove()
    var postIdentity = resolveContactIdentity(pd, post.contactId, { surface:'forum', aliasId:post.aliasId, authoredName:post.contactName, authoredAvatar:post.contactAvatar, authoredIpLocation:post.contactIpLocation })
    var postImages = Array.isArray(post.images) ? post.images.slice() : []
    if (post.imageUrl) postImages.unshift(post.imageUrl)
    var h = '<section class="rd-inline-forum-pip" role="dialog" aria-label="帖子画中画">'
    h += '<header class="rd-inline-forum-pip-head"><strong>内联帖子</strong><button type="button" class="rd-inline-forum-close" aria-label="关闭帖子画中画">×</button></header>'
    h += '<div class="rd-inline-forum-pip-scroll"><div class="rd-inline-forum-author"><span class="rd-inline-forum-avatar" style="--rd-avatar-bg:' + sanitizeCssColor(avatarColor(post.contactId)) + '">'
    if (postIdentity.avatar) h += '<img src="' + escapeHtmlAttribute(postIdentity.avatar) + '" alt="">'
    else h += esc((postIdentity.name || '?').charAt(0))
    h += '</span><span><strong>' + esc(postIdentity.name || '匿名') + '</strong>' + (shouldShowPhoneTimestamp(pd, post.time) ? '<time>' + esc(post.time) + '</time>' : '') + (pd.forumSettings?.showIpLocation === true && postIdentity.ipLocation ? '<small class="rd-forum-ip">IP 属地：' + esc(postIdentity.ipLocation) + '</small>' : '') + '</span></div>'
    var inlineMentionNames = listForumIdentities(pd).map(function(identity) { return identity.name }).concat((pd.forumNpcs || []).map(function(npc) { return npc.name })).concat(readerPlaceholderMentionNames())
    h += '<h3>' + esc(post.title || '未命名帖子') + '</h3><div class="rd-inline-forum-content">' + renderReaderMentionText(post.content || '', inlineMentionNames) + '</div>'
    if (postImages.length) {
      h += '<div class="rd-inline-forum-images">'
      postImages.forEach(function(image) {
        var src = typeof image === 'string' ? image : (image && (image.url || image.src) || '')
        if (src) h += '<img src="' + escapeHtmlAttribute(src) + '" alt="" onerror="this.style.display=\'none\'">'
      })
      h += '</div>'
    }
    h += '</div></section>'
    var chatRoot = frame.firstElementChild || frame
    chatRoot.insertAdjacentHTML('beforeend', h)
    var pip = chatRoot.querySelector('.rd-inline-forum-pip')
    var close = pip.querySelector('.rd-inline-forum-close')
    close.onclick = function() { pip.remove(); if (trigger && trigger.isConnected) trigger.focus() }
    close.focus()
  }

  function isFlowTargetMessage(message, round) {
    if (!flowStep) return false
    var playbackId = currentFlowPlaybackMessageId()
    if (playbackId) return String(message && message.id) === playbackId
    return String(round && round.id) === String(flowStep.itemId)
  }

  function isFlowTargetCall(message, round) {
    return message && message.type === 'call' && isFlowTargetMessage(message, round)
  }

  // Keep reader choices for this reading session without mutating the authored work.
  var phoneChoiceSession = readerPhoneChoiceSession(w)
  var chatSessionKey = String(chatIndex) + '::' + String(ch && ch.id || '')
  var chatSession = phoneChoiceSession.chats.get(chatSessionKey)
  if (!chatSession) {
    chatSession = {
      chat: JSON.parse(JSON.stringify(ch)),
      choiceRuns: new Map(),
      flowTypedMessageIds: new Set(),
      claimedMessageIds: new Set(),
      flowGeneratedPlayback: null,
    }
    phoneChoiceSession.chats.set(chatSessionKey, chatSession)
  }
  if (!(chatSession.flowTypedMessageIds instanceof Set)) chatSession.flowTypedMessageIds = new Set()
  if (!(chatSession.claimedMessageIds instanceof Set)) chatSession.claimedMessageIds = new Set()
  ch = chatSession.chat
  var openedCallScenes = Object.create(null)
  var mayAutoOpenCall = true
  var choiceRuns = chatSession.choiceRuns
  var knownMessageIds = new Set()
  var generatedMessageSequence = 0
  var generatedMessagePrefix = 'reader-choice-' + Date.now().toString(36) + '-'

  function nextReaderChoiceMessageId() {
    var id = ''
    do {
      generatedMessageSequence += 1
      id = generatedMessagePrefix + generatedMessageSequence.toString(36)
    } while (knownMessageIds.has(id))
    knownMessageIds.add(id)
    return id
  }

  function ensureReaderChatMessageIds(rounds) {
    var seen = new Set()
    rounds.forEach(function(round) {
      var messages = Array.isArray(round && round.messages) ? round.messages : []
      messages.forEach(function(message) {
        var id = message && typeof message.id === 'string' ? message.id : ''
        if (!id || seen.has(id)) {
          id = nextReaderChoiceMessageId()
          message.id = id
        }
        seen.add(id)
        knownMessageIds.add(id)
      })
    })
  }

  function choiceRunKey(roundIndex, ownerMessageId) {
    return String(roundIndex) + ':' + String(ownerMessageId)
  }

  function activeGeneratedPlaybackId() {
    var playback = chatSession.flowGeneratedPlayback
    if (!playback || !Array.isArray(playback.ids)) return ''
    return playback.ids[playback.index] == null ? '' : String(playback.ids[playback.index])
  }

  function currentFlowPlaybackMessageId() {
    return activeGeneratedPlaybackId() || (flowStep && flowStep.itemId != null ? String(flowStep.itemId) : '')
  }

  function messageLocationKey(roundIndex, messageId) {
    return String(roundIndex) + ':' + String(messageId)
  }

  function flowVisibleMessageIds() {
    if (!flowEnabled) return null
    var visible = new Set()
    for (var stepIndex = 0; stepIndex <= flowSession.index && stepIndex < flowSession.sequence.length; stepIndex++) {
      var step = flowSession.sequence[stepIndex]
      if (!step || step.type !== 'messages') continue
      var target = resolvePhoneReadingFlowStep(pd, step)
      if (!targetBelongsToChat(target)) continue
      if (stepIndex === flowSession.index && !flowStep) continue
      if (target.kind === 'message' && target.message) visible.add(String(target.message.id))
      if (target.kind === 'round' && target.round) {
        ;(target.round.messages || []).forEach(function(message) { visible.add(String(message.id)) })
      }
    }
    choiceRuns.forEach(function(entry) {
      if (!entry || !entry.run) return
      var ownerId = entry.run.ownerMessageId != null ? entry.run.ownerMessageId : entry.run.ownerItemId
      if (!visible.has(String(ownerId))) return
      var runKey = choiceRunKey(entry.roundIndex, ownerId)
      var playback = chatSession.flowGeneratedPlayback
      ;(entry.run.generatedMessageIds || []).forEach(function(id, generatedIndex) {
        if (!playback || playback.runKey !== runKey || generatedIndex <= playback.index) visible.add(String(id))
      })
    })
    return visible
  }

  function isMessageVisible(message, visibleIds) {
    return !visibleIds || visibleIds.has(String(message && message.id))
  }

  function currentFlowChoicePending(rounds) {
    if (!flowStep) return false
    for (var roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
      var messages = Array.isArray(rounds[roundIndex] && rounds[roundIndex].messages) ? rounds[roundIndex].messages : []
      for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
        var message = messages[messageIndex]
        if (String(message.id) !== String(flowStep.itemId)) continue
        return Array.isArray(message.choices) && message.choices.length > 0 && !choiceRuns.has(choiceRunKey(roundIndex, message.id))
      }
    }
    return false
  }

  function finishChatFlowStep() {
    clearChatFlowTimers()
    var nextStep = advanceReaderPhoneFlow(w)
    refreshChatFlowContext()
    if (flowStep && flowTarget) {
      mayAutoOpenCall = true
      renderChat()
      return
    }
    renderPhoneReader()
    if (nextStep) focusReaderAppIcon(document, phoneReadingFlowAppType(nextStep))
  }

  function backToList() {
    clearChatFlowTimers()
    openReaderApp('messages')
    focusReaderControl(frame, '.rd-chat-card[data-chat-index="' + chatIndex + '"]')
  }

  function getChatName() {
    if (ch.type === 'group') return ch.groupName || '群聊'
    return resolveContactIdentity(pd, ch.contactIds[0], { surface: 'messages', authoredName: '未知' }).name || '未知'
  }

  function openCallScene(msg, callKey) {
    clearChatFlowTimers()
    mayAutoOpenCall = false
    openedCallScenes[callKey] = true
    var caller = contacts.find(function(contact) { return contact.id === msg.senderId })
    var callerIdentity = resolveContactIdentity(pd, msg.senderId, { surface: 'messages', authoredName: getChatName() })
    var callerName = callerIdentity.name || getChatName()
    var modeLabel = msg.callMode === 'video' ? '视频通话' : '语音通话'
    var playback = createCallPlaybackState(
      Array.isArray(msg.callLines) ? msg.callLines.map(readerPhoneText) : msg.callLines,
      readerPhoneText(msg.text),
    )

    function renderCallPlayback(advanced) {
      var callBackgroundSettings = normalizedReaderCallBackgroundSettings(getAppSettings('messages'))
      var background = readerCallBackgroundPresentation(callBackgroundSettings)
      var contactVideoBackground = msg.callMode === 'video' && caller && isSafeImageUrl(caller.faceUrl)
        ? String(caller.faceUrl).trim()
        : ''
      if (contactVideoBackground) {
        background = {
          className: ' has-call-background-image has-contact-video-background',
          attribute: 'contact-image',
          style: '--rd-call-image:url("' + contactVideoBackground + '")'
        }
      }
      var currentLine = playback.currentIndex >= 0 ? playback.lines[playback.currentIndex] : ''
      var h = '<section class="rd-call-scene' + background.className + '" data-call-background="' + background.attribute + '"' + (background.style ? ' style="' + escapeHtmlAttribute(background.style) + '"' : '') + ' aria-label="' + escapeHtmlAttribute('与' + callerName + '的' + modeLabel) + '">'
      h += '<div class="rd-call-status"><span>' + (msg.callMode === 'video' ? 'VIDEO CALL' : 'VOICE CALL') + '</span><span>' + (playback.isComplete ? '通话内容已结束' : '剧情进行中') + '</span></div>'
      h += '<div class="rd-call-tag">' + esc(callerName) + '打来的' + modeLabel + '</div>'
      h += '<div class="rd-call-portrait">'
      if (callerIdentity.avatar) h += '<img src="' + escapeHtmlAttribute(callerIdentity.avatar) + '" alt="">'
      else h += '<span>' + esc((callerName || '?').charAt(0)) + '</span>'
      h += '</div><h3>' + esc(callerName) + '</h3><div class="rd-call-duration">正在通话</div>'

      if (playback.isEmpty) {
        h += '<div class="rd-call-transcript is-complete"><p class="rd-call-empty" role="status">本次通话没有台词</p></div>'
      } else {
        var transcriptTag = playback.isComplete ? 'div' : 'button'
        var transcriptAttributes = playback.isComplete
          ? ' class="rd-call-transcript is-complete"'
          : ' type="button" class="rd-call-transcript rd-call-advance" aria-label="显示下一句通话台词（' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '）"'
        h += '<' + transcriptTag + transcriptAttributes + '>'
        h += '<span class="rd-call-progress" aria-label="通话进度 ' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '">' + (playback.currentIndex + 1) + ' / ' + playback.lines.length + '</span>'
        h += '<span class="rd-call-lines">'
        for (var index = 0; index < playback.currentIndex; index++) {
          h += '<span class="rd-call-line old">' + esc(playback.lines[index]) + '</span>'
        }
        h += '<span class="rd-call-line current' + (advanced && shouldUseMotion(true) ? ' is-entering' : '') + '" aria-live="polite" aria-atomic="true">' + esc(currentLine) + '</span>'
        h += '</span>'
        if (playback.isComplete) h += '<span class="rd-call-complete" role="status">通话内容已结束</span>'
        else h += '<span class="rd-call-hint">点击、按 Enter 或空格显示下一句</span>'
        h += '</' + transcriptTag + '>'
      }

      h += '<button type="button" class="rd-call-hangup" aria-label="挂断通话">挂断</button>'
      h += '</section>'
      frame.innerHTML = h

      var renderedCallScene = frame.querySelector('.rd-call-scene')
      if (!contactVideoBackground && callBackgroundSettings.callBackgroundType === 'image' &&
          !verifiedReaderCallBackgroundImages.has(callBackgroundSettings.callBackgroundImage)) {
        verifyReaderCallBackgroundDataUrl(callBackgroundSettings.callBackgroundImage).then(function(dataUrl) {
          if (!renderedCallScene || !renderedCallScene.isConnected) return
          renderedCallScene.classList.add('has-call-background-image')
          renderedCallScene.dataset.callBackground = 'image'
          renderedCallScene.style.setProperty('--rd-call-image', 'url("' + dataUrl + '")')
        }).catch(function() {
          // The already-rendered selected preset remains authoritative.
        })
      }

      var advance = frame.querySelector('.rd-call-advance')
      var hangup = frame.querySelector('.rd-call-hangup')
      if (advance) {
        advance.onclick = function() {
          playback = advanceCallPlayback(playback)
          renderCallPlayback(true)
        }
        advance.focus()
      } else {
        hangup.focus()
      }
      hangup.onclick = function() {
        if (flowTarget && flowTarget.kind !== 'round' && String(flowTarget.item && flowTarget.item.id) === String(msg.id)) {
          finishChatFlowStep()
          return
        }
        if (flowTarget && flowTarget.kind === 'round' && String(flowTarget.round && flowTarget.round.id) === String(flowStep && flowStep.itemId)) {
          finishChatFlowStep()
          return
        }
        renderChat()
        focusReaderControl(frame, '.rd-call-card[data-call-key="' + callKey + '"]')
      }
      var transcript = frame.querySelector('.rd-call-lines')
      if (transcript) transcript.scrollTop = transcript.scrollHeight
    }

    renderCallPlayback(false)
  }

  function renderChat() {
    clearChatFlowTimers()
    chatFlowRenderToken += 1
    var renderToken = chatFlowRenderToken
    var chatName = getChatName()
    var ast = appStyle('messages')
    var rounds = Array.isArray(ch.rounds) ? ch.rounds : []
    var legacyMessages = Array.isArray(ch.messages) ? ch.messages : []
    if (rounds.length === 0 && legacyMessages.length) {
      rounds = [{ id: 'd', label: '', messages: legacyMessages.slice() }]
      ch.rounds = rounds
      ch.messages = []
    } else if (rounds.length > 0 && legacyMessages.length) {
      var migrationRound = rounds[rounds.length - 1]
      migrationRound.messages = (Array.isArray(migrationRound.messages) ? migrationRound.messages : []).concat(legacyMessages)
      ch.messages = []
    }
    ensureReaderChatMessageIds(rounds)
    var visibleMessageIds = flowVisibleMessageIds()

    // The latest authored choice group stays active until it has produced a run.
    // While that run exists, older groups do not resurface underneath it.
    var allChoices = []
    choiceScan:
    for (var lri = rounds.length - 1; lri >= 0; lri--) {
      if (rounds[lri].messages) {
        for (var lmi = rounds[lri].messages.length - 1; lmi >= 0; lmi--) {
          var lm = rounds[lri].messages[lmi]
          if (!isMessageVisible(lm, visibleMessageIds)) continue
          if (lm.choices && lm.choices.length > 0) {
            var ownerRunKey = choiceRunKey(lri, lm.id)
            if (!choiceRuns.has(ownerRunKey)) {
              for (var lci = 0; lci < lm.choices.length; lci++) {
                allChoices.push({
                  roundIdx: lri,
                  ownerMessageId: lm.id,
                  choiceIdx: lci,
                  text: lm.choices[lci].text || lm.choices[lci].replyText || '',
                })
              }
            }
            break choiceScan
          }
        }
      }
    }

    var reselectRunsByReply = new Map()
    choiceRuns.forEach(function(entry, key) {
      if (!entry || !entry.run) return
      var generatedIds = Array.isArray(entry.run.generatedMessageIds) ? entry.run.generatedMessageIds : []
      var anchorId = entry.run.replyMessageId != null
        ? entry.run.replyMessageId
        : (generatedIds.length > 0 ? generatedIds[0] : entry.run.ownerMessageId)
      if (anchorId == null) return
      reselectRunsByReply.set(messageLocationKey(entry.roundIndex, anchorId), key)
    })

    var avSz = ast.avatarSize + 'px'

    var callMessages = []
    var autoCall = null

    // ---- BUILD HTML ----
    var h = '<div class="rd-phone-app-panel rd-phone-app-messages chat-author-shell chat-reader-shell" style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px">'

    // Top bar
    h += '<div class="chat-round-header">'
    h += '<button id="chatBack" class="chat-round-control" type="button" aria-label="返回消息列表">‹</button>'
    h += '<div class="chat-round-title"><strong>' + esc(chatName) + '</strong></div>'
    h += '<span class="chat-round-control" aria-hidden="true"></span>'
    h += '</div>'

    // Message area
    h += '<div id="chatMsgArea" class="chat-msg-area">'
    var renderedVisibleCount = 0
    for (var ri = 0; ri < rounds.length; ri++) {
      var round = rounds[ri]
      if (!round.messages || round.messages.length === 0) continue
      for (var mi = 0; mi < round.messages.length; mi++) {
        var msg = round.messages[mi]
        if (!isMessageVisible(msg, visibleMessageIds)) continue
        renderedVisibleCount++
        if (msg.type === 'time') {
          if (!shouldShowPhoneTimestamp(pd, msg.time)) continue
          h += '<div class="rd-chat-time' + (isFlowTargetMessage(msg, round) ? ' is-flow-target' : '') + '" data-message-id="' + escapeHtmlAttribute(msg.id) + '" style="text-align:center;padding:6px 0;font-size:.62rem;color:#b0b8c4">' + esc(msg.time || '') + '</div>'
          continue
        }
        if (msg.type === 'call') {
          var callKey = ri + '-' + mi
          var callIdentity = resolveContactIdentity(pd, msg.senderId, { surface: 'messages', authoredName: chatName })
          var callName = callIdentity.name || chatName
          var callLabel = msg.callMode === 'video' ? '视频通话' : '语音通话'
          callMessages.push({ key: callKey, message: msg })
          if (mayAutoOpenCall && !openedCallScenes[callKey] && !autoCall && (!flowEnabled || isFlowTargetCall(msg, round))) autoCall = { key: callKey, message: msg }
          h += '<button type="button" class="rd-call-card' + (isFlowTargetCall(msg, round) ? ' is-flow-target' : '') + '" data-call-key="' + callKey + '" data-message-id="' + escapeHtmlAttribute(msg.id) + '" aria-label="' + escapeHtmlAttribute('打开与' + callName + '的' + callLabel) + '">'
          h += '<span>' + (msg.callMode === 'video' ? '▣' : '☎') + '</span><span><strong>' + esc(callName) + '</strong><small>' + callLabel + '</small></span><b>›</b></button>'
          continue
        }
        var isSelf = msg.senderId === 'self'
        var reselectRunKey = reselectRunsByReply.get(messageLocationKey(ri, msg.id)) || ''
        h += '<div class="chat-msg rd-chat-message ' + (isSelf ? 'self is-self' : 'other is-other') + (isFlowTargetMessage(msg, round) ? ' is-flow-target' : '') + '" data-message-id="' + escapeHtmlAttribute(msg.id) + '">'
        if (isSelf) {
          h += '<div class="chat-avatar rd-reader-chat-avatar" aria-label="' + escapeHtmlAttribute(readerChatName) + '" style="width:' + avSz + ';height:' + avSz + ';flex-basis:' + avSz + ';border-radius:' + ast.avatarRadius + ';background:' + sanitizeCssColor(avatarColor('reader-' + readerChatName)) + '">'
          if (readerChatAvatar) h += '<img src="' + escapeHtmlAttribute(readerChatAvatar) + '" alt="">'
          else h += '<span>' + esc((readerChatName || '我').charAt(0)) + '</span>'
          h += '</div>'
        } else {
          var sc = contacts.find(function(c) { return c.id === msg.senderId })
          var messageIdentity = resolveContactIdentity(pd, msg.senderId, { surface:'messages', authoredName:sc?.name || '?' })
          var messageAvatar = messageIdentity.avatar || ''
          var avBg = sc ? (messageAvatar ? 'background-image:url(' + escapeHtmlAttribute(messageAvatar) + ');background-size:cover' : 'background:' + avatarColor(msg.senderId)) : 'background:#ccc'
          h += '<div class="chat-avatar" style="width:' + avSz + ';height:' + avSz + ';flex-basis:' + avSz + ';border-radius:' + ast.avatarRadius + ';' + avBg + '">'
          if (!messageAvatar) h += '<span>' + esc((messageIdentity.name || '?').charAt(0)) + '</span>'
          h += '</div>'
        }
        // Bubble content
        h += '<div class="rd-chat-message-body">'
        if (ch.type === 'group' && !isSelf) {
          var groupLabels = []
          if (ch.groupOwnerId === msg.senderId) groupLabels.push('群主')
          else if (Array.isArray(ch.groupAdminIds) && ch.groupAdminIds.includes(msg.senderId)) groupLabels.push('管理员')
          if (ch.groupTitles && ch.groupTitles[msg.senderId]) groupLabels.push(ch.groupTitles[msg.senderId])
          if (groupLabels.length) h += '<div class="rd-chat-group-role">' + esc(groupLabels.join(' · ')) + '</div>'
        }
        var bubbleStyle = isSelf
          ? 'max-width:180px;padding:8px 12px;font-size:' + ast.bubbleFontSize + ';line-height:1.5;overflow-wrap:break-word;background:' + ast.selfBubbleBg + ';color:' + ast.selfBubbleText + ';border-radius:' + ast.selfBubbleRadius + ' ' + ast.selfBubbleRadius + ' 2px ' + ast.selfBubbleRadius
          : 'max-width:180px;padding:8px 12px;font-size:' + ast.bubbleFontSize + ';line-height:1.5;overflow-wrap:break-word;background:' + ast.otherBubbleBg + ';color:' + ast.otherBubbleText + ';border-radius:' + ast.otherBubbleRadius + ' ' + ast.otherBubbleRadius + ' ' + ast.otherBubbleRadius + ' 2px'
        if (msg.type === 'image') {
          h += '<div class="chat-bubble" style="' + bubbleStyle + '">'
          h += '<img src="' + esc(msg.image || '') + '" style="max-width:120px;border-radius:4px" onerror="this.style.display=\'none\'">'
          h += '</div>'
        } else if (msg.type === 'link') {
          var inlineForumPost = msg.forumPostId && (pd.forumPosts || []).find(function(post) { return String(post.id) === String(msg.forumPostId) })
          if (inlineForumPost) h += '<button type="button" class="chat-link-card rd-inline-forum-card" data-inline-forum-post-id="' + escapeHtmlAttribute(msg.forumPostId) + '"><strong>' + esc(msg.linkTitle || inlineForumPost.title || '帖子') + '</strong><span>论坛帖子 · 点击查看</span></button>'
          else if (msg.forumPostId) h += '<div class="chat-link-card is-unavailable"><strong>' + esc(msg.linkTitle || '帖子') + '</strong><span>关联帖子已不存在</span></div>'
          else {
            var cardLinkUrl = safeMessageCardUrl(msg.linkUrl)
            if (cardLinkUrl) h += '<a class="chat-link-card" href="' + escapeHtmlAttribute(cardLinkUrl) + '" target="_blank" rel="noopener noreferrer"><strong>' + esc(msg.linkTitle || '链接') + '</strong><span>' + esc(msg.linkUrl || '') + '</span></a>'
            else h += '<div class="chat-link-card"><strong>' + esc(msg.linkTitle || '链接') + '</strong><span>' + esc(msg.linkUrl || '') + '</span></div>'
          }
        } else if (msg.type === 'redpacket') {
          var redpacketClaimed = chatSession.claimedMessageIds.has(String(msg.id))
          h += '<div class="chat-payment-card chat-payment-redpacket rd-claimable-card' + (redpacketClaimed ? ' is-claimed' : '') + '"><div class="chat-payment-main"><div class="chat-payment-type">红包</div><div class="chat-payment-amount">¥' + (msg.redpacketAmount || 0).toFixed(2) + '</div><div class="chat-payment-note">' + esc(msg.redpacketMsg || '恭喜发财') + '</div></div><div class="chat-payment-footer"><span>红包</span>' + (!isSelf ? '<button type="button" class="rd-card-claim" data-claim-message-id="' + escapeHtmlAttribute(msg.id) + '" data-claimed-label="已领取"' + (redpacketClaimed ? ' disabled' : '') + '>' + (redpacketClaimed ? '已领取' : '领取') + '</button>' : '') + '</div></div>'
        } else if (msg.type === 'transfer') {
          var transferClaimed = chatSession.claimedMessageIds.has(String(msg.id))
          h += '<div class="chat-payment-card chat-payment-transfer rd-claimable-card' + (transferClaimed ? ' is-claimed' : '') + '"><div class="chat-payment-main"><div class="chat-payment-type">转账</div><div class="chat-payment-amount">¥' + (msg.transferAmount || 0).toFixed(2) + '</div><div class="chat-payment-note">' + esc(msg.transferNote || '请确认收款') + '</div></div><div class="chat-payment-footer"><span>转账记录</span>' + (!isSelf ? '<button type="button" class="rd-card-claim" data-claim-message-id="' + escapeHtmlAttribute(msg.id) + '" data-claimed-label="已收款"' + (transferClaimed ? ' disabled' : '') + '>' + (transferClaimed ? '已收款' : '收款') + '</button>' : '') + '</div></div>'
        } else if (msg.type === 'familycard') {
          var familyCardClaimed = chatSession.claimedMessageIds.has(String(msg.id))
          h += '<div class="chat-family-card rd-claimable-card' + (familyCardClaimed ? ' is-claimed' : '') + '"><div class="chat-family-card-copy"><div>亲属卡</div><strong>' + esc(msg.fcRelation || '亲人') + '</strong><b>¥' + (msg.fcAmount || 0).toFixed(2) + '</b></div>' + (!isSelf ? '<button type="button" class="rd-card-claim" data-claim-message-id="' + escapeHtmlAttribute(msg.id) + '" data-claimed-label="已领取"' + (familyCardClaimed ? ' disabled' : '') + '>' + (familyCardClaimed ? '已领取' : '领取') + '</button>' : '') + '</div>'
        } else if (msg.type === 'takeaway') {
          var takeawayTarget = buildTakeawayOpenTarget(msg.takeawayShop, msg.takeawayOrder)
          var takeawayExternalAttrs = takeawayTarget.opensApp ? '' : ' target="_blank" rel="noopener noreferrer"'
          var takeawayClaimed = chatSession.claimedMessageIds.has(String(msg.id))
          h += '<div class="rd-claimable-takeaway rd-claimable-card' + (takeawayClaimed ? ' is-claimed' : '') + '"><a class="chat-takeaway-card" href="' + escapeHtmlAttribute(takeawayTarget.href) + '"' + takeawayExternalAttrs + '><span class="chat-takeaway-type">外卖</span><strong>' + esc(msg.takeawayShop || '外卖订单') + '</strong><span>' + esc(msg.takeawayOrder || '') + '</span><b>¥' + (msg.takeawayAmount || 0).toFixed(2) + '</b><small>' + esc(msg.takeawayStatus || '订单进行中') + ' · 点击查看</small></a>' + (!isSelf ? '<button type="button" class="rd-card-claim rd-takeaway-claim" data-claim-message-id="' + escapeHtmlAttribute(msg.id) + '" data-claimed-label="已领取"' + (takeawayClaimed ? ' disabled' : '') + '>' + (takeawayClaimed ? '已领取' : '领取') + '</button>' : '') + '</div>'
        } else if (msg.type === 'voice') {
          var resolvedMessageText = readerPhoneText(msg.text)
          var dur = msg.duration || Math.max(1, Math.round(resolvedMessageText.length * 0.3))
          var barCount = Math.min(20, Math.max(4, Math.round(dur * 3)))
          var bars = ''
          for (var bi = 0; bi < barCount; bi++) {
            var bh = 4 + Math.abs(Math.sin(bi * 0.7 + 1.5)) * 14
            bars += '<rect x="' + (bi * 5) + '" y="' + (20 - bh) / 2 + '" width="3" height="' + bh + '" rx="1.5"/>'
          }
          h += '<div class="chat-bubble" style="' + bubbleStyle + ';cursor:pointer;min-width:100px" onclick="var t=this.querySelector(\'.cv-text\');t.style.display=t.style.display==\'none\'?\'block\':\'none\'">'
          h += '<svg width="' + (barCount * 5 + 2) + '" height="20" viewBox="0 0 ' + (barCount * 5 + 2) + ' 20" style="fill:currentColor;opacity:.7">' + bars + '</svg>'
          h += '<span style="font-size:.65rem;margin-left:4px;opacity:.6">' + dur + '"</span>'
          h += '<span class="cv-text" style="display:none;font-size:.75rem;margin-top:4px;line-height:1.4">' + esc(resolvedMessageText) + '</span>'
          h += '</div>'
        } else {
          h += '<div class="chat-bubble" style="' + bubbleStyle + '">'
          if (msg.quoteId && msg.quoteText) {
            h += '<div style="font-size:.6rem;opacity:.7;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,.1)">引用：' + esc(msg.quoteText.substring(0, 40)) + '</div>'
          }
          var streamsCurrentText = isFlowTargetMessage(msg, round) && !chatSession.flowTypedMessageIds.has(String(msg.id))
          if (streamsCurrentText) {
            h += '<span class="rd-flow-stream-text" aria-live="polite" aria-atomic="true"></span>'
          } else {
            h += renderReaderMentionText(readerPhoneText(msg.text), chatMentionNames)
          }
          h += '</div>'
        }
        if (reselectRunKey) {
          h += '<button type="button" class="rd-chat-choice-reselect" data-choice-run-key="' + escapeHtmlAttribute(reselectRunKey) + '" aria-label="重选这条回复">重选</button>'
        }
        h += '</div>'
        h += '</div>'
      }
    }
    if (renderedVisibleCount === 0 && flowEnabled) {
      h += '<div class="rd-chat-flow-empty">还没有按作者顺序解锁的消息</div>'
    }
    h += '</div>'

    // Choice popup panel
    if (allChoices.length > 0) {
      h += '<div id="rdChoiceList" class="rd-chat-choice-list" role="listbox" aria-label="选择回复" hidden>'
      for (var ac = 0; ac < allChoices.length; ac++) {
        var acv = allChoices[ac]
        h += '<button type="button" class="rd-reply-option" role="option" data-ri="' + acv.roundIdx + '" data-owner-id="' + escapeHtmlAttribute(acv.ownerMessageId) + '" data-ci="' + acv.choiceIdx + '">' + esc(readerPhoneText(acv.text)) + '</button>'
      }
      h += '</div>'
    }

    // Bottom input bar
    h += '<div class="chat-input-bar chat-composer rd-chat-composer' + (allChoices.length > 0 ? ' has-choices' : '') + '">'
    h += '<input id="chatInput" class="rd-chat-choice-trigger" readonly aria-label="' + (allChoices.length > 0 ? '选择一条完整回复' : '暂无可用回复') + '" aria-haspopup="listbox" aria-expanded="false"' + (allChoices.length > 0 ? ' aria-controls="rdChoiceList"' : ' disabled') + ' placeholder="' + (allChoices.length > 0 ? '点击选择回复...' : '暂无可用选项') + '" value="">'
    h += '<button type="button" id="chatSendBtn" class="chat-send-btn rd-chat-choice-toggle" aria-label="打开回复选项"' + (allChoices.length > 0 ? ' aria-controls="rdChoiceList" aria-expanded="false"' : ' disabled') + '>▶</button>'
    h += '</div>'

    h += '</div>'
    frame.innerHTML = h
    var chatMessageArea = frame.querySelector('#chatMsgArea')
    if (chatMessageArea) chatMessageArea.scrollTop = chatMessageArea.scrollHeight

    if (autoCall) {
      openCallScene(autoCall.message, autoCall.key)
      return
    }

    // ---- Bind events ----
    frame.querySelector('#chatBack').onclick = backToList

    frame.querySelectorAll('.rd-call-card').forEach(function(card) {
      card.onclick = function() {
        var call = callMessages.find(function(entry) { return entry.key === card.dataset.callKey })
        if (call) openCallScene(call.message, call.key)
      }
    })

    frame.querySelectorAll('.rd-card-claim').forEach(function(button) {
      button.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        chatSession.claimedMessageIds.add(String(button.dataset.claimMessageId || ''))
        button.textContent = button.dataset.claimedLabel || '已领取'
        button.disabled = true
        button.closest('.rd-claimable-card')?.classList.add('is-claimed')
      }
    })

    frame.querySelectorAll('.rd-inline-forum-card').forEach(function(card) {
      card.onclick = function() { openInlineForumPost(card.dataset.inlineForumPostId, card) }
    })

    var chatInput = frame.querySelector('#chatInput')
    var sendBtn = frame.querySelector('#chatSendBtn')
    var choiceList = frame.querySelector('#rdChoiceList')

    function setChoiceListOpen(open) {
      if (!choiceList) return
      choiceList.hidden = !open
      if (chatInput) chatInput.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (sendBtn) sendBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    function setChoiceAvailability(available) {
      if (allChoices.length === 0) return
      if (chatInput) chatInput.disabled = !available
      if (sendBtn) sendBtn.disabled = !available
      if (!available) setChoiceListOpen(false)
      if (choiceList) {
        choiceList.querySelectorAll('.rd-reply-option').forEach(function(option) {
          option.disabled = !available
        })
      }
    }

    function findFlowPlaybackMessage(messageId) {
      for (var roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
        var messages = Array.isArray(rounds[roundIndex] && rounds[roundIndex].messages) ? rounds[roundIndex].messages : []
        for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
          if (String(messages[messageIndex] && messages[messageIndex].id) === String(messageId)) return messages[messageIndex]
        }
      }
      return null
    }

    function renderedChatFlowIsCurrent() {
      return chatFlowRenderToken === renderToken && frame.isConnected
    }

    function scheduleNextChatFlowMessage() {
      if (!flowStep) return
      chatFlowAdvanceTimer = setTimeout(function() {
        chatFlowAdvanceTimer = null
        if (!renderedChatFlowIsCurrent()) return
        var playback = chatSession.flowGeneratedPlayback
        if (playback && Array.isArray(playback.ids)) {
          if (playback.index + 1 < playback.ids.length) {
            playback.index += 1
            renderChat()
            return
          }
          chatSession.flowGeneratedPlayback = null
        }
        finishChatFlowStep()
      }, CHAT_FLOW_MESSAGE_GAP)
    }

    function finishCurrentChatFlowMessage(messageId) {
      chatSession.flowTypedMessageIds.add(String(messageId))
      if (currentFlowChoicePending(rounds)) {
        setChoiceAvailability(true)
        return
      }
      scheduleNextChatFlowMessage()
    }

    function startCurrentChatFlowMessage() {
      if (!flowStep || autoCall) return
      var messageId = currentFlowPlaybackMessageId()
      if (!messageId) return
      var message = findFlowPlaybackMessage(messageId)
      if (!message) return
      var alreadyComplete = chatSession.flowTypedMessageIds.has(String(messageId))
      setChoiceAvailability(!currentFlowChoicePending(rounds) || alreadyComplete)
      if (alreadyComplete) {
        if (!currentFlowChoicePending(rounds)) scheduleNextChatFlowMessage()
        return
      }

      var stream = null
      frame.querySelectorAll('[data-message-id]').forEach(function(element) {
        if (!stream && String(element.dataset.messageId) === String(messageId)) {
          stream = element.querySelector('.rd-flow-stream-text')
        }
      })
      var streamsText = !message.type || message.type === 'text'
      if (!streamsText || !stream) {
        finishCurrentChatFlowMessage(messageId)
        return
      }

      var characters = Array.from(readerPhoneText(message.text))
      if (!shouldUseMotion(true) || characters.length === 0) {
        stream.textContent = characters.join('')
        stream.classList.add('is-complete')
        finishCurrentChatFlowMessage(messageId)
        return
      }

      var characterIndex = 0
      function typeNextCharacter() {
        if (!renderedChatFlowIsCurrent()) return
        stream.textContent += characters[characterIndex]
        characterIndex += 1
        if (chatMessageArea) chatMessageArea.scrollTop = chatMessageArea.scrollHeight
        if (characterIndex >= characters.length) {
          stream.classList.add('is-complete')
          finishCurrentChatFlowMessage(messageId)
          return
        }
        chatFlowTypingTimer = setTimeout(typeNextCharacter, CHAT_FLOW_CHARACTER_DELAY)
      }
      chatFlowTypingTimer = setTimeout(typeNextCharacter, CHAT_FLOW_CHARACTER_DELAY)
    }

    function pickChoice(ri, ownerMessageId, ci) {
      if (!rounds[ri]) return
      var runKey = choiceRunKey(ri, ownerMessageId)
      if (choiceRuns.has(runKey)) return
      if (flowStep && String(flowStep.itemId) === String(ownerMessageId) && !chatSession.flowTypedMessageIds.has(String(ownerMessageId))) return
      var result = applyChatChoice(rounds[ri], ownerMessageId, ci, {
        idFactory: nextReaderChoiceMessageId,
      })
      if (!result.ok) return
      rounds[ri] = result.round
      choiceRuns.set(runKey, { roundIndex: ri, run: result.run })
      var generatedIds = Array.isArray(result.run.generatedMessageIds) ? result.run.generatedMessageIds.slice() : []
      var playsInsideCurrentFlow = flowStep && String(flowStep.itemId) === String(ownerMessageId)
      chatSession.flowGeneratedPlayback = playsInsideCurrentFlow && generatedIds.length > 0
        ? { runKey: runKey, ids: generatedIds, index: 0 }
        : null
      setChoiceListOpen(false)
      renderChat()
    }

    // Input bar toggle
    if (chatInput) chatInput.onclick = function(e) { e.stopPropagation(); setChoiceListOpen(choiceList && choiceList.hidden) }
    if (sendBtn) sendBtn.onclick = function(e) { e.stopPropagation(); setChoiceListOpen(choiceList && choiceList.hidden) }

    // Option clicks
    if (choiceList) {
      choiceList.querySelectorAll('.rd-reply-option').forEach(function(opt) {
        opt.onclick = function(e) {
          e.stopPropagation()
          pickChoice(parseInt(opt.dataset.ri), opt.dataset.ownerId, parseInt(opt.dataset.ci))
        }
      })
    }

    frame.querySelectorAll('.rd-chat-choice-reselect').forEach(function(button) {
      button.onclick = function(e) {
        e.stopPropagation()
        var key = button.dataset.choiceRunKey
        var entry = choiceRuns.get(key)
        if (!entry || !rounds[entry.roundIndex]) return
        rounds[entry.roundIndex] = rollbackChatChoice(rounds[entry.roundIndex], entry.run)
        ;(entry.run.generatedMessageIds || []).forEach(function(id) {
          chatSession.flowTypedMessageIds.delete(String(id))
        })
        if (chatSession.flowGeneratedPlayback && chatSession.flowGeneratedPlayback.runKey === key) {
          chatSession.flowGeneratedPlayback = null
        }
        choiceRuns.delete(key)
        renderChat()
        var reopenedList = frame.querySelector('#rdChoiceList')
        var reopenedInput = frame.querySelector('#chatInput')
        var reopenedToggle = frame.querySelector('#chatSendBtn')
        if (reopenedList) {
          reopenedList.hidden = false
          if (reopenedInput) reopenedInput.setAttribute('aria-expanded', 'true')
          if (reopenedToggle) reopenedToggle.setAttribute('aria-expanded', 'true')
          var firstOption = reopenedList.querySelector('.rd-reply-option')
          if (firstOption) firstOption.focus()
        }
      }
    })

    frame.onclick = function(e) {
      if (choiceList && !choiceList.hidden && !choiceList.contains(e.target) && e.target !== chatInput && e.target !== sendBtn) {
        setChoiceListOpen(false)
      }
    }

    startCurrentChatFlowMessage()
  }

  renderChat()
}

// ---- Forum post viewer ----
function openReaderForumPost(frame, w, pd, postId, postIndex) {
  var posts = pd.forumPosts || []
  var sourcePost = posts.find(function(p) { return p.id === postId })
  if (!sourcePost) return
  var phoneChoiceSession = readerPhoneChoiceSession(w)
  var forumSessionKey = String(postIndex) + '::' + String(postId)
  var forumSession = phoneChoiceSession.forumPosts.get(forumSessionKey)
  if (!forumSession) {
    forumSession = { post: cloneReaderThreadItems([sourcePost])[0], choiceRuns: new Map(), likedCommentIds: new Set(), sort: 'hot' }
    phoneChoiceSession.forumPosts.set(forumSessionKey, forumSession)
  }
  if (!(forumSession.likedCommentIds instanceof Set)) forumSession.likedCommentIds = new Set()
  if (forumSession.sort !== 'latest') forumSession.sort = 'hot'
  var post = forumSession.post
  var custom = getPhoneCustom()
  var forumVisual = appStyle('forum')
  var forumChoiceRuns = forumSession.choiceRuns
  var forumLikedCommentIds = forumSession.likedCommentIds
  var showForumIpLocation = pd.forumSettings?.showIpLocation === true
  var forumMentionNames = listForumIdentities(pd).map(function(identity) { return identity.name })
    .concat((pd.forumNpcs || []).map(function(npc) { return npc.name }))
    .concat([readerThreadDisplayName(pd, getPhoneCustom())])
    .concat(readerPlaceholderMentionNames())
    .filter(Boolean)

  function forumIpLabel(identity, authoredIpLocation) {
    var location = String(identity?.ipLocation || authoredIpLocation || '').trim()
    return showForumIpLocation && location ? '<span class="rd-forum-ip">IP 属地：' + esc(location) + '</span>' : ''
  }

  function forumCommentTimestamp(comment) {
    var explicit = Number(comment?.createdAt)
    if (Number.isFinite(explicit) && explicit > 0) return explicit
    var parsed = Date.parse(String(comment?.time || ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  function forumCommentHotScore(comment) {
    return Math.max(0, Number(comment?.likes) || 0) + (Array.isArray(comment?.replies) ? comment.replies.length * 2 : 0)
  }

  function sortedForumComments(comments) {
    return comments.map(function(comment, index) { return { comment:comment, index:index } }).sort(function(left, right) {
      if (forumSession.sort === 'latest') {
        return forumCommentTimestamp(right.comment) - forumCommentTimestamp(left.comment) || right.index - left.index
      }
      return forumCommentHotScore(right.comment) - forumCommentHotScore(left.comment) || left.index - right.index
    }).map(function(entry) { return entry.comment })
  }

  function backToList() {
    openReaderApp('forum')
    focusReaderControl(frame, '.rd-post-card[data-post-index="' + postIndex + '"]')
  }

  function findForumCommentsById(items, serializedId, matches) {
    ;(Array.isArray(items) ? items : []).forEach(function(comment) {
      if (!comment || typeof comment !== 'object') return
      if (String(comment.id) === String(serializedId)) matches.push(comment)
      findForumCommentsById(comment.replies, serializedId, matches)
    })
  }

  function getForumContainer(containerKey) {
    if (containerKey === 'root') {
      if (!Array.isArray(post.comments)) post.comments = []
      return { items: post.comments, set: function(items) { post.comments = items } }
    }
    var prefix = 'replies::'
    if (String(containerKey).indexOf(prefix) !== 0) return null
    var matches = []
    findForumCommentsById(post.comments, String(containerKey).slice(prefix.length), matches)
    if (matches.length !== 1) return null
    var parent = matches[0]
    if (!Array.isArray(parent.replies)) parent.replies = []
    return { items: parent.replies, set: function(items) { parent.replies = items } }
  }

  function renderForumComment(comment, floor, depth, containerKey, parentComment) {
    var generated = readerThreadGeneratedItem(forumChoiceRuns, containerKey, comment.id)
    return renderPhoneForumComment(comment, {
      floor:floor,
      depth:depth,
      containerKey:containerKey,
      parentComment:parentComment,
      generated:generated,
    }, {
      resolveIdentity:function(item) {
        var isReader = item.contactId === 'self' || item.senderId === 'self'
        if (isReader) {
          return {
            name:readerThreadDisplayName(pd, custom),
            avatar:custom.readerAvatar || pd.skin?.readerAvatar || '',
            isReader:true,
          }
        }
        var identity = resolveContactIdentity(pd, item.contactId || item.senderId, {
          surface:'forum',
          aliasId:item.aliasId,
          authoredName:item.contactName,
          authoredAvatar:item.contactAvatar,
          authoredIpLocation:item.contactIpLocation,
        })
        return {
          name:identity.name || item.contactName || '角色',
          avatar:identity.avatar || item.contactAvatar || '',
          ipLocation:identity.ipLocation || item.contactIpLocation || '',
        }
      },
      avatarColor:function(item) { return sanitizeCssColor(avatarColor(item.contactId || item.senderId || 'self')) },
      renderText:function(value) { return renderReaderMentionText(value, forumMentionNames) },
      renderIp:function(identity) { return identity.isReader ? '' : forumIpLabel(identity, identity.ipLocation) },
      displayFloor:forumDisplayFloor,
      formatTime:function(value) { return value },
      showTimestamp:function(item) { return shouldShowPhoneTimestamp(pd, item.time, post.hideReplyTimes === true) },
      isLiked:function(item) { return forumLikedCommentIds.has(String(item.id)) },
      isGenerated:function(item, childContainerKey) { return readerThreadGeneratedItem(forumChoiceRuns, childContainerKey, item.id) },
      renderChoices:function(item, context) {
        return renderReaderThreadReselect(item, 'forum', context.containerKey, forumChoiceRuns) +
          renderReaderThreadChoiceControls(item, 'forum', context.containerKey, forumChoiceRuns)
      },
    })
  }

  function focusForumThreadControl(selector, datasetName, value) {
    var controls = frame.querySelectorAll(selector)
    for (var i = 0; i < controls.length; i++) {
      if (String(controls[i].dataset[datasetName]) !== String(value)) continue
      controls[i].focus()
      return
    }
  }

  function renderForumPost() {
    var postIdentity = resolveContactIdentity(pd, post.contactId, { surface: 'forum', aliasId:post.aliasId, authoredName: post.contactName, authoredAvatar: post.contactAvatar, authoredIpLocation:post.contactIpLocation })
    var h = '<div class="rd-forum-detail" style="--rd-forum-avatar-radius:' + forumVisual.avatarRadius + '">'
    h += '<header class="rd-forum-detail-header"><button type="button" class="rd-back-btn" aria-label="返回论坛列表">←</button><strong>帖子详情</strong><span class="rd-back-spacer" aria-hidden="true"></span></header>'
    h += '<div class="rd-forum-detail-scroll">'
    h += renderPhoneForumPost(post, {
      resolveIdentity:function() {
        return {
          name:postIdentity.name || post.contactName || '匿名',
          avatar:postIdentity.avatar || post.contactAvatar || '',
          ipLocation:postIdentity.ipLocation || post.contactIpLocation || '',
        }
      },
      avatarColor:function(item) { return sanitizeCssColor(avatarColor(item.contactId)) },
      renderText:function(value) { return renderReaderMentionText(value, forumMentionNames) },
      renderIp:function(identity) { return forumIpLabel(identity, identity.ipLocation) },
      showTimestamp:function(item) { return shouldShowPhoneTimestamp(pd, item.time) },
      formatTime:function(value) { return value },
      renderActions:function(item) {
        return '<span class="forum-action">赞 ' + (item.likes || 0) + '</span>' +
          '<span class="forum-action">收藏 ' + (item.bookmarks || 0) + '</span>' +
          '<span class="forum-action">评论 ' + forumDisplayCommentCount(item) + '</span>'
      },
    })
    h += '<section class="rd-forum-thread" aria-label="帖子评论"><div class="rd-forum-thread-head"><h4>评论 <span>' + forumDisplayCommentCount(post) + '</span></h4><div class="rd-forum-sort" role="group" aria-label="评论排序"><button type="button" data-forum-sort="hot" aria-pressed="' + (forumSession.sort === 'hot' ? 'true' : 'false') + '">热门</button><button type="button" data-forum-sort="latest" aria-pressed="' + (forumSession.sort === 'latest' ? 'true' : 'false') + '">最新</button></div></div>'
    var comments = Array.isArray(post.comments) ? post.comments : []
    if (comments.length === 0) h += '<div class="rd-app-empty">暂无评论</div>'
    var floorByCommentId = new Map(comments.map(function(comment, commentIndex) { return [String(comment.id), commentIndex + 1] }))
    sortedForumComments(comments).forEach(function(comment) {
      h += renderForumComment(comment, floorByCommentId.get(String(comment.id)) || 1, 0, 'root')
    })
    h += '</section></div></div>'
    frame.innerHTML = h

    var backBtn = frame.querySelector('.rd-back-btn')
    if (backBtn) backBtn.onclick = backToList

    frame.querySelectorAll('[data-forum-sort]').forEach(function(button) {
      button.onclick = function() {
        forumSession.sort = button.dataset.forumSort === 'latest' ? 'latest' : 'hot'
        renderForumPost()
        frame.querySelector('[data-forum-sort="' + forumSession.sort + '"]')?.focus()
      }
    })

    frame.querySelectorAll('[data-forum-comment-like]').forEach(function(button) {
      button.onclick = function() {
        var commentId = String(button.dataset.forumCommentLike)
        if (forumLikedCommentIds.has(commentId)) forumLikedCommentIds.delete(commentId)
        else forumLikedCommentIds.add(commentId)
        renderForumPost()
        focusForumThreadControl('[data-forum-comment-like]', 'forumCommentLike', commentId)
      }
    })

    frame.querySelectorAll('.rd-thread-choice-option[data-thread-scope="forum"]').forEach(function(button) {
      button.onclick = function() {
        var containerKey = button.dataset.threadContainer
        var container = getForumContainer(containerKey)
        if (!container) return
        var ownerId = resolveReaderThreadOwnerId(container.items, button.dataset.threadOwnerId)
        if (ownerId === null) return
        var runKey = readerThreadRunKey(containerKey, ownerId)
        if (forumChoiceRuns.has(runKey)) return
        var choiceIndex = Number(button.dataset.threadChoiceIndex)
        var result = applyThreadChoice(container.items, ownerId, choiceIndex, readerThreadRuntimeOptions(pd, custom, 'forum'))
        if (!result.ok) return
        container.set(result.items)
        forumChoiceRuns.set(runKey, { containerKey: containerKey, run: result.run })
        renderForumPost()
        focusForumThreadControl('.rd-thread-choice-reselect', 'threadRunKey', runKey)
      }
    })

    frame.querySelectorAll('.rd-thread-choice-reselect[data-thread-scope="forum"]').forEach(function(button) {
      button.onclick = function() {
        var runKey = button.dataset.threadRunKey
        var entry = forumChoiceRuns.get(runKey)
        if (!entry) return
        var container = getForumContainer(entry.containerKey)
        if (!container) return
        container.set(rollbackThreadChoice(container.items, entry.run))
        forumChoiceRuns.delete(runKey)
        renderForumPost()
        focusForumThreadControl('.rd-thread-choice-option', 'threadOwnerId', entry.run.ownerItemId)
      }
    })
  }

  renderForumPost()
  var initialBack = frame.querySelector('.rd-back-btn')
  if (initialBack) initialBack.focus()
}

// ====== Reader Phone Custom (Beautification Panel) ======
function readerPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function readerSetOwnData(target, key, value) {
  Object.defineProperty(target, key, {
    value: value,
    writable: true,
    enumerable: true,
    configurable: true
  })
  return target
}

function readerOwnDataRecord() {
  var record = {}
  for (var sourceIndex = 0; sourceIndex < arguments.length; sourceIndex++) {
    var source = readerPlainRecord(arguments[sourceIndex])
    Object.keys(source).forEach(function(key) {
      readerSetOwnData(record, key, source[key])
    })
  }
  return record
}

function readerPhoneCustomDefaults() {
  return {
    wallpaper: '#eee6e7', wallpaperType: 'color', wallpaperImage: null,
    frameColor: '#8f7b81', borderRadius: 18, fontFamily: "'Noto Sans SC', sans-serif",
    fontSize: 12, readerId: '', readerAvatar: null, topBgImage: null,
    showDynamicIsland: true, showHomeIndicator: true, showAppLabels: true,
    showIconShadow: true, iconBorderRadius: 6, iconColumns: 4, materialType: 'glass',
    materialOpacity: 65, timeColor: '#ffffff',
    customCss: '', appBgs: {}, appSettings: {}, customFonts: [], customIcons: {}
  }
}

function boundedPhoneCustomNumber(value, fallback, min, max) {
  var number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function safePhoneCustomFontFamily(value, fallback) {
  if (typeof value !== 'string') return fallback
  var family = value.trim()
  return family && family.length <= 200 && !/[{};]/.test(family) ? family : fallback
}

function normalizePhoneCustom(candidate) {
  var defaults = readerPhoneCustomDefaults()
  var stored = readerOwnDataRecord(candidate)
  var custom = readerOwnDataRecord(defaults, stored)
  custom.wallpaper = sanitizeCssColor(custom.wallpaper, { fallback: defaults.wallpaper })
  custom.frameColor = sanitizeCssColor(custom.frameColor, { fallback: defaults.frameColor })
  custom.timeColor = sanitizeCssColor(custom.timeColor, { fallback: defaults.timeColor })
  custom.wallpaperType = custom.wallpaperType === 'image' ? 'image' : 'color'
  custom.wallpaperImage = typeof custom.wallpaperImage === 'string' && isSafeImageUrl(custom.wallpaperImage)
    ? custom.wallpaperImage.trim()
    : null
  custom.readerAvatar = typeof custom.readerAvatar === 'string' && isSafeImageUrl(custom.readerAvatar)
    ? custom.readerAvatar.trim()
    : null
  custom.topBgImage = typeof custom.topBgImage === 'string' && isSafeImageUrl(custom.topBgImage)
    ? custom.topBgImage.trim()
    : null
  custom.borderRadius = boundedPhoneCustomNumber(custom.borderRadius, defaults.borderRadius, 0, 40)
  custom.fontSize = boundedPhoneCustomNumber(custom.fontSize, defaults.fontSize, 9, 20)
  custom.iconBorderRadius = boundedPhoneCustomNumber(custom.iconBorderRadius, defaults.iconBorderRadius, 0, 27)
  custom.materialOpacity = boundedPhoneCustomNumber(custom.materialOpacity, defaults.materialOpacity, 20, 100)
  custom.fontFamily = safePhoneCustomFontFamily(custom.fontFamily, defaults.fontFamily)
  custom.readerId = typeof custom.readerId === 'string' ? custom.readerId.slice(0, 80) : ''
  ;['showDynamicIsland', 'showHomeIndicator', 'showAppLabels', 'showIconShadow'].forEach(function(key) {
    custom[key] = typeof custom[key] === 'boolean' ? custom[key] : defaults[key]
  })
  custom.customCss = typeof custom.customCss === 'string'
    ? custom.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : ''
  custom.appBgs = readerOwnDataRecord(stored.appBgs)
  custom.appSettings = readerOwnDataRecord(stored.appSettings)
  custom.customIcons = readerOwnDataRecord(stored.customIcons)
  if (!Array.isArray(custom.customFonts)) custom.customFonts = []
  return custom
}

function getPhoneCustom() {
  return normalizePhoneCustom(lsGet('phoneCustom'))
}

function savePhoneCustom(data) {
  var cur = getPhoneCustom()
  for (var k in data) {
    if (Object.prototype.hasOwnProperty.call(data, k)) readerSetOwnData(cur, k, data[k])
  }
  cur = normalizePhoneCustom(cur)
  lsSet('phoneCustom', cur)
  return cur
}

function applyPhoneCustomCss(candidate) {
  var custom = normalizePhoneCustom(candidate)
  return applyCompiledReaderStyle(custom.customCss, '.reader-phone-css-scope', 'reader-phone-user-css')
}

function readerAppCssType(type) {
  var safeType = String(type || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return ['messages', 'forum', 'memo', 'gallery', 'browser', 'shopping', 'contacts'].includes(safeType)
    ? safeType
    : ''
}

function applyReaderAppCustomCss(type, settings, options) {
  var safeType = readerAppCssType(type)
  if (!safeType) return { ok: true, css: '', ruleCount: 0 }
  var appSettings = readerPlainRecord(settings)
  var rawCss = typeof appSettings.customCss === 'string'
    ? appSettings.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : ''
  var styleOptions = readerPlainRecord(options)
  var preview = styleOptions.preview === true
  var scope = preview ? '.reader-app-preview-scope' : '.rd-phone-app-' + safeType
  var styleId = preview ? 'reader-app-preview-user-css' : 'reader-app-' + safeType + '-user-css'
  return applyCompiledReaderStyle(rawCss, scope, styleId)
}

// ====== Phone Preview ======
function renderPhonePreview(ct, options) {
  ct = normalizePhoneCustom(ct)
  var previewOptions = readerPlainRecord(options)
  var scopeClass = previewOptions.scopeClass || 'reader-phone-css-scope'
  if (previewOptions.applyGlobalCss !== false) applyPhoneCustomCss(ct)
  var h = '<div class="rd-phone-preview" style="display:flex;justify-content:center;align-items:flex-start">'
  var frameBgStyle = 'width:360px;--phone-bg:' + sanitizeCssColor(ct.wallpaper || '#eee6e7') + ';--phone-radius:' + (ct.borderRadius ?? 18) + 'px;--phone-font:' + ct.fontFamily + ';--phone-fontsize:' + (ct.fontSize || 12) + 'px;--phone-frame:' + sanitizeCssColor(ct.frameColor || '#8f7b81')
  frameBgStyle += ';--phone-icon-radius:' + (ct.iconBorderRadius ?? 6) + 'px;--phone-material-opacity:' + (ct.materialOpacity ?? 65) + '%;--phone-time-color:' + sanitizeCssColor(ct.timeColor || '#ffffff')
  if (ct.wallpaperType === 'image' && ct.wallpaperImage) {
    frameBgStyle += ';background-image:url(' + esc(ct.wallpaperImage) + ');background-size:cover;background-position:center'
  }
  h += '<div class="phone-frame ' + escapeHtmlAttribute(scopeClass) + ((ct.wallpaper || '#eee6e7').toLowerCase() === '#eee6e7' && ct.wallpaperType !== 'image' ? ' phone-default-wallpaper' : '') + '" style="' + escapeHtmlAttribute(frameBgStyle) + '">'
  if (ct.showDynamicIsland !== false) {
    h += '<div class="phone-island"><div class="phone-island-pill"></div></div>'
  }
  var coverBg = ct.topBgImage || ct.wallpaperImage || ''
  h += '<div class="phone-profile"'
  if (coverBg) h += ' style="background-image:url(' + esc(coverBg) + ');background-size:cover;background-position:center"'
  h += '>'
  h += '<div class="phone-profile-overlay"></div>'
  h += '<div class="phone-widget-copy">'
  h += '<div class="phone-widget-kicker">MY POCKET / READER</div>'
  h += '<div class="phone-profile-id">' + esc(ct.readerId || '访客') + '</div>'
  h += '<div class="phone-widget-status"><span></span> LOCAL PROFILE</div>'
  h += '</div>'
  h += '<div class="phone-avatar">'
  if (ct.readerAvatar) h += '<img src="' + esc(ct.readerAvatar) + '" alt="">'
  h += '</div>'
  h += '</div>'

  h += '<div class="phone-desktop" style="position:relative;min-height:260px;' + phoneGridContainerStyle() + '">'
  var apps = [
    { type: 'messages', name: '消息',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    { type: 'forum',    name: '论坛',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>' },
    { type: 'memo',     name: '备忘',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
    { type: 'gallery',  name: '相册',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
    { type: 'browser',  name: '浏览',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
    { type: 'shopping', name: '购物',  color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' },
    { type: 'contacts', name: '联系人', color: '#f0f0f0', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>' }
  ]
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    var customIcon = readerCustomIconUrl(ct.customIcons && ct.customIcons[app.type])
    var appName = readerAppName(app)
    h += '<button type="button" class="phone-app-icon rd-app-icon" aria-label="' + escapeHtmlAttribute(appName) + '" data-app="' + escapeHtmlAttribute(app.type || '') + '"'
    h += ' style="' + phoneGridItemStyle(i % 4, Math.floor(i / 4)) + 'border:none!important;box-shadow:none!important">'
    h += '<span class="phone-icon-body' + (ct.showIconShadow === false ? '' : ' icon-shadow') + '" style="background:' + READER_DEFAULT_APP_ICON_SURFACE + ';">'
    if (customIcon) {
      h += '<img src="' + escapeHtmlAttribute(customIcon) + '" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:var(--phone-icon-radius,6px)" onerror="this.style.display=\'none\'">'
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
function openReaderCustomizePanelLegacy() {
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
  body += '<div class="rd-input-row"><input class="rd-input" id="cuWpUrl" value="' + esc(ct.wallpaperImage || '') + '" placeholder="输入图片URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer" id="cuUploadBg">上传</button></div>'
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
  body += '<div style="padding:4px 0"><button style="padding:5px 14px;font-size:.72rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer;border-radius:4px" id="cuUploadFont">上传字体 (.ttf/.woff)</button></div>'
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

function phoneAppearanceFontOptions(custom) {
  var fonts = [
    { label: '默认黑体', value: "'Noto Sans SC', sans-serif" },
    { label: '系统黑体', value: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { label: '正文宋体', value: "'Noto Serif SC', serif" },
    { label: '手写楷体', value: "'KaiTi', serif" },
    { label: '英文衬线', value: "'Georgia', serif" }
  ]
  ;(custom.customFonts || []).forEach(function(font) {
    fonts.push({ label: font.name, value: '"' + font.name + '"' })
  })
  return fonts.map(function(font) {
    return '<option value="' + escapeHtmlAttribute(font.value) + '"' + (custom.fontFamily === font.value ? ' selected' : '') + '>' + esc(font.label) + '</option>'
  }).join('')
}

function phoneAppearanceRange(label, id, min, max, step, value, unit) {
  return '<label class="phone-appearance-range" for="' + id + '"><span>' + esc(label) + '<output id="' + id + 'Val">' + value + esc(unit || '') + '</output></span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></label>'
}

function openReaderCustomizePanel(triggerElement) {
  var ct = getPhoneCustom()
  var wallpaperPresets = [
    { name:'极昼白', color:'#f5f0e8' }, { name:'水色', color:'#d0e8f5' },
    { name:'樱粉', color:'#f5e8f0' }, { name:'薄荷', color:'#e8f5f0' },
    { name:'奶油', color:'#faf5ed' }, { name:'薰衣草', color:'#ede8f5' },
    { name:'浅灰', color:'#e8e8e8' }, { name:'暗夜', color:'#1a1a2e' }
  ]
  var body = '<div class="phone-appearance-layout">'
  body += '<aside class="phone-appearance-preview-pane"><div id="phoneAppearancePreview"></div><p class="phone-appearance-status" id="cuLiveStatus" role="status" aria-live="polite">实时预览 · 保存后保留</p></aside>'
  body += '<div class="phone-appearance-controls">'

  body += '<section class="phone-appearance-group"><div class="rs-group-heading"><span>壁纸与边框</span><small>颜色会即时映射到左侧手机</small></div>'
  body += '<div class="phone-appearance-swatches" role="group" aria-label="壁纸预设">'
  wallpaperPresets.forEach(function(preset) {
    body += '<button type="button" class="phone-appearance-swatch' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? ' active' : '') + '" data-cu-color="' + preset.color + '" aria-label="' + preset.name + '" aria-pressed="' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? 'true' : 'false') + '"><span style="background:' + preset.color + '"></span></button>'
  })
  body += '</div><div class="rs-color-controls phone-appearance-colors">'
  body += '<label class="rs-color-control">壁纸色<input type="color" class="rs-color-input" id="cuWallpaperColor" value="' + escapeHtmlAttribute(ct.wallpaper) + '"></label>'
  body += '<label class="rs-color-control">边框色<input type="color" class="rs-color-input" id="cuFrameColor" value="' + escapeHtmlAttribute(ct.frameColor) + '"></label>'
  body += '<label class="rs-color-control">系统标记<input type="color" class="rs-color-input" id="cuTimeColor" value="' + escapeHtmlAttribute(ct.timeColor) + '"></label></div>'
  body += '<div class="phone-appearance-image-row"><input type="url" class="rd-input" id="cuWpUrl" value="' + escapeHtmlAttribute(ct.wallpaperType === 'image' && ct.wallpaperImage && !/^data:/i.test(ct.wallpaperImage) ? ct.wallpaperImage : '') + '" placeholder="背景图片地址"><button type="button" class="rs-action-btn" id="cuApplyBg">应用</button><button type="button" class="rs-action-btn" id="cuUploadBg">本地图片</button><button type="button" class="rs-action-btn subtle" id="cuClearBg">清除</button></div>'
  body += '<p class="rs-field-error" id="cuBgError" role="alert" hidden></p></section>'

  body += '<section class="phone-appearance-group"><div class="rs-group-heading"><span>尺寸与材质</span><small>边框圆角在宽屏手机框和预览中显示</small></div><div class="phone-appearance-range-grid">'
  body += phoneAppearanceRange('机身圆角', 'cuRadius', 0, 40, 1, ct.borderRadius, 'px')
  body += phoneAppearanceRange('界面字号', 'cuFontSize', 9, 20, 1, ct.fontSize, 'px')
  body += phoneAppearanceRange('图标圆角', 'cuIconRadius', 0, 27, 1, ct.iconBorderRadius, 'px')
  body += phoneAppearanceRange('材质透明度', 'cuMaterialOpacity', 20, 100, 1, ct.materialOpacity, '%')
  body += '</div></section>'

  body += '<section class="phone-appearance-group"><div class="rs-group-heading"><span>字体与系统组件</span><small>这些设置同时作用于桌面和已接入 App</small></div>'
  body += '<label class="phone-appearance-select-label" for="cuFontFamily">手机字体<select class="rd-input" id="cuFontFamily">' + phoneAppearanceFontOptions(ct) + '</select></label>'
  body += '<div class="phone-appearance-font-actions"><button type="button" class="rs-action-btn subtle" id="cuUploadFont">上传字体</button><div id="cuFontList"></div></div>'
  body += '<div class="phone-appearance-toggles">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuIsland"' + (ct.showDynamicIsland ? ' checked' : '') + '> 灵动岛</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuLabels"' + (ct.showAppLabels ? ' checked' : '') + '> App 名称</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuHome"' + (ct.showHomeIndicator ? ' checked' : '') + '> Home 指示条</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuShadow"' + (ct.showIconShadow ? ' checked' : '') + '> 图标阴影</label>'
  body += '</div></section>'

  body += '<section class="phone-appearance-group rs-css-section"><div class="rs-group-heading"><span>高级 CSS</span><small>只作用于手机框内部，输入时即时校验</small></div>'
  body += '<textarea id="cuCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuCssHint cuCssError" placeholder=".phone-profile { box-shadow: none; }">' + esc(ct.customCss || '') + '</textarea>'
  body += '<div class="rs-css-meta"><p class="rs-field-hint" id="cuCssHint">支持普通选择器与属性；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuCssCount">' + (ct.customCss || '').length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>'
  body += '<p class="rs-field-error" id="cuCssError" role="alert" hidden></p><div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuCssExample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuClearCss">清空 CSS</button></div></section>'
  body += '<div class="phone-appearance-reset"><button type="button" class="rs-reset-btn" id="cuAppearanceReset">恢复手机外观默认值</button></div>'
  body += '</div></div>'

  var ov = openCuModal('手机外观', body, function() {
    var cssDraft = ov.querySelector('#cuCustomCss')
    var validation = compileScopedReaderCss(cssDraft ? cssDraft.value : ct.customCss, '.reader-phone-css-scope')
    if (!validation.ok) throw new Error(validation.error)
    ct.customCss = cssDraft ? cssDraft.value : ct.customCss
    ct = savePhoneCustom(ct)
    applyCustomFonts()
    applyPhoneCustomCss(ct)
    renderCustomPage()
    showReaderToast('手机外观已保存')
  }, triggerElement)
  var dialog = ov.querySelector('.cu-modal')
  dialog.classList.add('phone-appearance-workbench')
  var previewHost = ov.querySelector('#phoneAppearancePreview')
  var saveButton = ov.querySelector('#cuModalSave')
  var cancelButton = ov.querySelector('#cuModalCancel')
  saveButton.id = 'cuSave'
  cancelButton.id = 'cuCancel'

  function renderFontList() {
    var select = ov.querySelector('#cuFontFamily')
    if (select) {
      var selected = ct.fontFamily
      select.innerHTML = phoneAppearanceFontOptions(ct)
      select.value = selected
    }
    var list = ov.querySelector('#cuFontList')
    if (!list) return
    list.innerHTML = (ct.customFonts || []).map(function(font, index) {
      return '<span class="phone-appearance-font-chip"><span>' + esc(font.name) + '</span><button type="button" data-cu-del-font="' + index + '" aria-label="删除字体 ' + escapeHtmlAttribute(font.name) + '">×</button></span>'
    }).join('')
  }

  function setSaveEnabled(enabled) {
    saveButton.disabled = !enabled
    saveButton.setAttribute('aria-disabled', enabled ? 'false' : 'true')
  }

  function renderDraftPreview() {
    var result = compileScopedReaderCss(ct.customCss || '', '.reader-phone-css-preview-scope')
    var style = result.ok && result.css
      ? '<style id="reader-phone-preview-user-css">' + result.css + '</style>'
      : '<style id="reader-phone-preview-user-css"></style>'
    previewHost.innerHTML = renderPhonePreview(ct, {
      scopeClass: 'reader-phone-css-preview-scope',
      applyGlobalCss: false
    }) + style
  }

  function setLiveMessage(message, isError) {
    var status = ov.querySelector('#cuLiveStatus')
    if (status) {
      status.textContent = message
      status.classList.toggle('is-error', !!isError)
    }
  }

  function setCssDraft(rawCss) {
    var count = ov.querySelector('#cuCssCount')
    var error = ov.querySelector('#cuCssError')
    if (count) count.textContent = rawCss.length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
    var previewResult = compileScopedReaderCss(rawCss, '.reader-phone-css-preview-scope')
    var actualResult = compileScopedReaderCss(rawCss, '.reader-phone-css-scope')
    var result = previewResult.ok ? actualResult : previewResult
    if (!result.ok) {
      if (error) {
        error.textContent = result.error
        error.hidden = false
      }
      setSaveEnabled(false)
      setLiveMessage('CSS 暂未应用 · 请按提示修改', true)
      return false
    }
    if (error) {
      error.textContent = ''
      error.hidden = true
    }
    ct.customCss = rawCss
    setSaveEnabled(true)
    renderDraftPreview()
    setLiveMessage('实时预览 · 保存后保留', false)
    return true
  }

  function syncPresetButtons() {
    ov.querySelectorAll('[data-cu-color]').forEach(function(button) {
      var active = ct.wallpaperType !== 'image' && button.dataset.cuColor === ct.wallpaper
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
  }

  function updateDraft(callback) {
    if (callback) callback()
    ct = normalizePhoneCustom(ct)
    renderDraftPreview()
    setLiveMessage('实时预览 · 保存后保留', false)
  }

  renderFontList()
  renderDraftPreview()

  ov.querySelectorAll('[data-cu-color]').forEach(function(button) {
    button.onclick = function() {
      updateDraft(function() {
        ct.wallpaper = button.dataset.cuColor
        ct.wallpaperType = 'color'
        ct.wallpaperImage = null
      })
      var colorInput = ov.querySelector('#cuWallpaperColor')
      if (colorInput) colorInput.value = ct.wallpaper
      syncPresetButtons()
    }
  })
  var wallpaperColor = ov.querySelector('#cuWallpaperColor')
  if (wallpaperColor) wallpaperColor.oninput = function() {
    updateDraft(function() {
      ct.wallpaper = wallpaperColor.value
      ct.wallpaperType = 'color'
      ct.wallpaperImage = null
    })
    syncPresetButtons()
  }
  var frameColor = ov.querySelector('#cuFrameColor')
  if (frameColor) frameColor.oninput = function() {
    updateDraft(function() { ct.frameColor = frameColor.value })
  }
  var timeColor = ov.querySelector('#cuTimeColor')
  if (timeColor) timeColor.oninput = function() {
    updateDraft(function() { ct.timeColor = timeColor.value })
  }

  function bindAppearanceRange(id, key, unit) {
    var input = ov.querySelector('#' + id)
    var output = ov.querySelector('#' + id + 'Val')
    if (!input) return
    input.oninput = function() {
      updateDraft(function() { ct[key] = Number(input.value) })
      if (output) output.textContent = input.value + (unit || '')
    }
  }
  bindAppearanceRange('cuRadius', 'borderRadius', 'px')
  bindAppearanceRange('cuFontSize', 'fontSize', 'px')
  bindAppearanceRange('cuIconRadius', 'iconBorderRadius', 'px')
  bindAppearanceRange('cuMaterialOpacity', 'materialOpacity', '%')

  var fontSelect = ov.querySelector('#cuFontFamily')
  if (fontSelect) fontSelect.onchange = function() {
    updateDraft(function() { ct.fontFamily = fontSelect.value })
  }
  ;[
    ['cuIsland', 'showDynamicIsland'],
    ['cuLabels', 'showAppLabels'],
    ['cuHome', 'showHomeIndicator'],
    ['cuShadow', 'showIconShadow']
  ].forEach(function(binding) {
    var input = ov.querySelector('#' + binding[0])
    if (input) input.onchange = function() {
      updateDraft(function() { ct[binding[1]] = input.checked })
    }
  })

  function setBackgroundError(message) {
    var error = ov.querySelector('#cuBgError')
    if (!error) return
    error.textContent = message || ''
    error.hidden = !message
  }
  function applyWallpaperImage(value) {
    var raw = String(value || '').trim()
    if (raw && !isSafeImageUrl(raw)) {
      setBackgroundError('请选择本地图片，或输入安全的 HTTPS / 相对图片地址。')
      return false
    }
    setBackgroundError('')
    updateDraft(function() {
      ct.wallpaperImage = raw || null
      ct.wallpaperType = raw ? 'image' : 'color'
    })
    syncPresetButtons()
    return true
  }
  var backgroundUrl = ov.querySelector('#cuWpUrl')
  ov.querySelector('#cuApplyBg').onclick = function() {
    applyWallpaperImage(backgroundUrl && backgroundUrl.value)
  }
  ov.querySelector('#cuClearBg').onclick = function() {
    if (backgroundUrl) backgroundUrl.value = ''
    applyWallpaperImage('')
  }
  ov.querySelector('#cuUploadBg').onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (backgroundUrl) backgroundUrl.value = ''
        applyWallpaperImage(dataUrl)
      }).catch(function(error) {
        setBackgroundError((error && error.message) || '图片读取失败，请换一张再试。')
      })
    }
    input.click()
  }

  var cssInput = ov.querySelector('#cuCustomCss')
  if (cssInput) cssInput.oninput = function() { setCssDraft(cssInput.value) }
  ov.querySelector('#cuCssExample').onclick = function() {
    cssInput.value = ':scope { --phone-system-accent: #c58fa0; }\n.phone-profile { box-shadow: none; }\n.phone-icon-label { letter-spacing: .04em; }'
    setCssDraft(cssInput.value)
    cssInput.focus()
  }
  ov.querySelector('#cuClearCss').onclick = function() {
    cssInput.value = ''
    setCssDraft('')
    cssInput.focus()
  }

  ov.querySelector('#cuUploadFont').onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ttf,.otf,.woff,.woff2'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        showReaderToast('字体文件请控制在 2MB 以内')
        return
      }
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      name = name.replace(/["'\\;{}<>]/g, '').trim().slice(0, 64)
      if (!name) return
      var reader = new FileReader()
      reader.onload = function() {
        ct.customFonts = (ct.customFonts || []).concat([{ name:name, data:reader.result }])
        ct.fontFamily = '"' + name + '"'
        renderFontList()
        renderDraftPreview()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
  var fontList = ov.querySelector('#cuFontList')
  if (fontList) fontList.onclick = function(event) {
    var button = event.target.closest('[data-cu-del-font]')
    if (!button) return
    var index = parseInt(button.dataset.cuDelFont, 10)
    var removed = ct.customFonts && ct.customFonts[index]
    ct.customFonts = (ct.customFonts || []).filter(function(_, fontIndex) { return fontIndex !== index })
    if (removed && ct.fontFamily === '"' + removed.name + '"') ct.fontFamily = readerPhoneCustomDefaults().fontFamily
    renderFontList()
    renderDraftPreview()
  }

  ov.querySelector('#cuAppearanceReset').onclick = function() {
    var defaults = readerPhoneCustomDefaults()
    ct = normalizePhoneCustom(Object.assign({}, defaults, {
      readerId: ct.readerId,
      readerAvatar: ct.readerAvatar,
      topBgImage: ct.topBgImage,
      appBgs: ct.appBgs,
      appSettings: ct.appSettings,
      customFonts: ct.customFonts,
      customIcons: ct.customIcons
    }))
    ov.querySelector('#cuWallpaperColor').value = ct.wallpaper
    ov.querySelector('#cuFrameColor').value = ct.frameColor
    ov.querySelector('#cuTimeColor').value = ct.timeColor
    ov.querySelector('#cuWpUrl').value = ''
    ;[
      ['cuRadius', ct.borderRadius, 'px'],
      ['cuFontSize', ct.fontSize, 'px'],
      ['cuIconRadius', ct.iconBorderRadius, 'px'],
      ['cuMaterialOpacity', ct.materialOpacity, '%']
    ].forEach(function(item) {
      ov.querySelector('#' + item[0]).value = item[1]
      ov.querySelector('#' + item[0] + 'Val').textContent = item[1] + item[2]
    })
    ov.querySelector('#cuIsland').checked = ct.showDynamicIsland
    ov.querySelector('#cuLabels').checked = ct.showAppLabels
    ov.querySelector('#cuHome').checked = ct.showHomeIndicator
    ov.querySelector('#cuShadow').checked = ct.showIconShadow
    ov.querySelector('#cuCustomCss').value = ''
    renderFontList()
    syncPresetButtons()
    setCssDraft('')
  }
}

function openReaderProfilePanel() {
  var ct = getPhoneCustom()
  var body = '<div class="cu-section"><div class="cu-section-title">个人信息</div>'
  body += '<label class="cu-label">昵称</label><input class="rd-input" id="rpName" value="' + escapeHtmlAttribute(ct.readerId || '') + '" placeholder="默认使用作品昵称">'
  body += '<label class="cu-label">头像</label>'
  body += '<div class="rd-input-row"><input class="rd-input" id="rpAvatarUrl" value="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" placeholder="输入头像URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer" id="rpUploadAv">上传</button></div>'
  body += '<div class="rd-preview-img" id="rpAvatarPreview"' + (ct.readerAvatar ? '' : ' hidden') + '><img id="rpAvatarPreviewImage" src="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" alt="" style="border-radius:50%"><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="rpClearAv">清除</button></div>'
  body += '<label class="cu-label">顶部背景图</label>'
  body += '<div class="rd-input-row"><input class="rd-input" id="rpTopBgUrl" value="' + escapeHtmlAttribute(ct.topBgImage || '') + '" placeholder="输入图片URL..."><button style="padding:5px 12px;font-size:.75rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer" id="rpUploadTop">上传</button></div>'
  body += '<div class="rd-preview-img" id="rpTopBgPreview"' + (ct.topBgImage ? '' : ' hidden') + '><img id="rpTopBgPreviewImage" src="' + escapeHtmlAttribute(ct.topBgImage || '') + '" alt=""><button style="padding:4px 8px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer" id="rpClearTop">清除</button></div>'
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
    var avu = ov.querySelector('#rpAvatarUrl')
    var tbu = ov.querySelector('#rpTopBgUrl')
    ct.readerAvatar = avu && avu.value.trim() ? avu.value.trim() : null
    ct.topBgImage = tbu && tbu.value.trim() ? tbu.value.trim() : null
    savePhoneCustom(ct)
    ov.remove()
    renderCustomPage()
    showReaderToast('个人信息已保存')
  }
  function setProfileImageDraft(inputId, previewId, imageId, value) {
    var nextValue = String(value || '')
    var input = ov.querySelector(inputId)
    var preview = ov.querySelector(previewId)
    var image = ov.querySelector(imageId)
    if (input) input.value = nextValue
    if (image) image.src = nextValue
    if (preview) preview.hidden = !nextValue
  }
  // Upload buttons
  function bindUpload(btnId, setter) {
    var btn = ov.querySelector(btnId); if (!btn) return
    btn.onclick = function() {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
      inp.onchange = function() { var file = inp.files[0]; if (!file) return; var r = new FileReader(); r.onload = function() { setter(r.result) }; r.readAsDataURL(file) }; inp.click()
    }
  }
  bindUpload('#rpUploadAv', function(v) { setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', v) })
  bindUpload('#rpUploadTop', function(v) { setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', v) })
  var clearAv = ov.querySelector('#rpClearAv'); if (clearAv) clearAv.onclick = function() { setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', null) }
  var clearTop = ov.querySelector('#rpClearTop'); if (clearTop) clearTop.onclick = function() { setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', null) }
}

// ---- App Settings defaults ----
var READER_CALL_BACKGROUND_DEFAULT = Object.freeze({
  callBackgroundType: 'preset',
  callBackgroundPreset: 'plain',
  callBackgroundImage: null
})
var READER_CALL_BACKGROUND_PRESETS = Object.freeze({
  plain: '素灰粉',
  rose: '暮玫瑰',
  water: '雾水蓝',
  cream: '奶咖'
})
var READER_CALL_BACKGROUND_MAX_BYTES = 2 * 1024 * 1024
var READER_CALL_BACKGROUND_MIME_PREFIXES = Object.freeze({
  'image/png': 'data:image/png;base64,',
  'image/jpeg': 'data:image/jpeg;base64,',
  'image/webp': 'data:image/webp;base64,'
})
var READER_CALL_BACKGROUND_DATA_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/
var verifiedReaderCallBackgroundImages = new Set()

function canonicalReaderCallBackgroundDataUrl(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function readerCallBackgroundMime(dataUrl) {
  var mimeTypes = Object.keys(READER_CALL_BACKGROUND_MIME_PREFIXES)
  for (var mimeIndex = 0; mimeIndex < mimeTypes.length; mimeIndex++) {
    var mime = mimeTypes[mimeIndex]
    if (dataUrl.startsWith(READER_CALL_BACKGROUND_MIME_PREFIXES[mime])) return mime
  }
  return ''
}

function readerCallBackgroundBinary(dataUrl) {
  try {
    return globalThis.atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  } catch (error) {
    return ''
  }
}

function readerCallBackgroundDecodedByteLength(dataUrl) {
  var base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  var padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0)
  return (base64.length / 4 * 3) - padding
}

function readerCallBackgroundUint32BigEndian(binary, offset) {
  return (
    (binary.charCodeAt(offset) * 0x1000000) +
    (binary.charCodeAt(offset + 1) << 16) +
    (binary.charCodeAt(offset + 2) << 8) +
    binary.charCodeAt(offset + 3)
  ) >>> 0
}

function readerCallBackgroundUint32LittleEndian(binary, offset) {
  return (
    binary.charCodeAt(offset) +
    (binary.charCodeAt(offset + 1) << 8) +
    (binary.charCodeAt(offset + 2) << 16) +
    (binary.charCodeAt(offset + 3) * 0x1000000)
  ) >>> 0
}

function readerCallBackgroundHasSupportedSignature(mime, binary) {
  if (mime === 'image/png') return binary.slice(0, 8) === '\x89PNG\r\n\x1a\n'
  if (mime === 'image/jpeg') {
    return binary.length >= 3 &&
      binary.charCodeAt(0) === 0xff &&
      binary.charCodeAt(1) === 0xd8 &&
      binary.charCodeAt(2) === 0xff
  }
  if (mime === 'image/webp') {
    return binary.length >= 12 && binary.slice(0, 4) === 'RIFF' && binary.slice(8, 12) === 'WEBP'
  }
  return false
}

function readerCallBackgroundPngIsStaticAndWellFormed(binary) {
  if (binary.length === 8) return true
  for (var offset = 8; offset < binary.length;) {
    if (binary.length - offset < 12) return false
    var size = readerCallBackgroundUint32BigEndian(binary, offset)
    if (size > binary.length - offset - 12) return false
    if (binary.slice(offset + 4, offset + 8) === 'acTL') return false
    offset += 12 + size
  }
  return true
}

function readerCallBackgroundWebpIsStaticAndWellFormed(binary) {
  if (readerCallBackgroundUint32LittleEndian(binary, 4) !== binary.length - 8) return false
  for (var offset = 12; offset < binary.length;) {
    if (binary.length - offset < 8) return false
    var chunk = binary.slice(offset, offset + 4)
    var size = readerCallBackgroundUint32LittleEndian(binary, offset + 4)
    if (chunk === 'ANIM' || chunk === 'ANMF') return false
    if (size > binary.length - offset - 8) return false
    if (chunk === 'VP8X' && size > 0 && (binary.charCodeAt(offset + 8) & 0x02)) return false
    var nextOffset = offset + 8 + size
    if (size % 2) {
      if (nextOffset >= binary.length || binary.charCodeAt(nextOffset) !== 0) return false
      nextOffset += 1
    }
    if (nextOffset > binary.length) return false
    offset = nextOffset
  }
  return true
}

function validatedReaderCallBackgroundCandidate(input) {
  var value = canonicalReaderCallBackgroundDataUrl(input)
  if (!READER_CALL_BACKGROUND_DATA_PATTERN.test(value) || !isSafeImageUrl(value)) return null
  var dataUrl = value
  var decodedBytes = readerCallBackgroundDecodedByteLength(dataUrl)
  if (!Number.isFinite(decodedBytes) || decodedBytes <= 0 || decodedBytes > READER_CALL_BACKGROUND_MAX_BYTES) return null
  var binary = readerCallBackgroundBinary(dataUrl)
  if (!binary || binary.length !== decodedBytes || binary.length > READER_CALL_BACKGROUND_MAX_BYTES) return null
  try {
    if (globalThis.btoa(binary) !== dataUrl.slice(dataUrl.indexOf(',') + 1)) return null
  } catch (error) {
    return null
  }
  var mime = readerCallBackgroundMime(dataUrl)
  if (!readerCallBackgroundHasSupportedSignature(mime, binary)) return null
  if (mime === 'image/png' && !readerCallBackgroundPngIsStaticAndWellFormed(binary)) return null
  if (mime === 'image/webp' && !readerCallBackgroundWebpIsStaticAndWellFormed(binary)) return null
  return { dataUrl: dataUrl, mime: mime, binary: binary }
}

function isSafeReaderCallBackgroundDataUrl(value) {
  return Boolean(validatedReaderCallBackgroundCandidate(value))
}

function decodeReaderCallBackgroundImage(dataUrl) {
  return new Promise(function(resolve, reject) {
    var image = new Image()
    image.onload = function() {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(dataUrl)
      else reject(new Error('图片没有可用尺寸'))
    }
    image.onerror = function() { reject(new Error('图片无法解码')) }
    image.src = dataUrl
  })
}

function verifyReaderCallBackgroundDataUrl(dataUrl) {
  var candidate = validatedReaderCallBackgroundCandidate(dataUrl)
  if (!candidate) return Promise.reject(new Error('图片格式无效、过大或包含动画'))
  return decodeReaderCallBackgroundImage(candidate.dataUrl).then(function(verified) {
    verifiedReaderCallBackgroundImages.add(verified)
    return verified
  })
}

function readReaderCallBackgroundFile(file) {
  return new Promise(function(resolve, reject) {
    var fileType = file && file.type
    var expectedPrefix = Object.prototype.hasOwnProperty.call(READER_CALL_BACKGROUND_MIME_PREFIXES, fileType)
      ? READER_CALL_BACKGROUND_MIME_PREFIXES[fileType]
      : ''
    if (!expectedPrefix) {
      reject(new Error('请选择 PNG、JPEG 或 WebP 图片'))
      return
    }
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > READER_CALL_BACKGROUND_MAX_BYTES) {
      reject(new Error('图片不能超过 2 MiB'))
      return
    }
    var reader = new FileReader()
    reader.onerror = function() { reject(new Error('图片读取失败')) }
    reader.onload = function() {
      var dataUrl = canonicalReaderCallBackgroundDataUrl(reader.result)
      if (!dataUrl.startsWith(expectedPrefix)) {
        reject(new Error('图片格式与文件类型不一致'))
        return
      }
      verifyReaderCallBackgroundDataUrl(dataUrl).then(resolve, reject)
    }
    try {
      reader.readAsDataURL(file)
    } catch (error) {
      reject(new Error('图片读取失败'))
    }
  })
}

function normalizedReaderCallBackgroundSettings(settings) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var preset = typeof source.callBackgroundPreset === 'string' && Object.prototype.hasOwnProperty.call(READER_CALL_BACKGROUND_PRESETS, source.callBackgroundPreset)
    ? source.callBackgroundPreset
    : READER_CALL_BACKGROUND_DEFAULT.callBackgroundPreset
  var imageCandidate = validatedReaderCallBackgroundCandidate(source.callBackgroundImage)
  var image = imageCandidate ? imageCandidate.dataUrl : null
  var useImage = source.callBackgroundType === 'image' && image
  return {
    callBackgroundType: useImage ? 'image' : 'preset',
    callBackgroundPreset: preset,
    callBackgroundImage: useImage ? image : null
  }
}

function readerCallBackgroundPresentation(settings) {
  var background = normalizedReaderCallBackgroundSettings(settings)
  if (background.callBackgroundType === 'image' && verifiedReaderCallBackgroundImages.has(background.callBackgroundImage)) {
    return {
      className: ' has-call-background-image',
      attribute: 'image',
      style: '--rd-call-image:url("' + background.callBackgroundImage + '")'
    }
  }
  return {
    className: '',
    attribute: background.callBackgroundPreset,
    style: ''
  }
}

function getAppSettings(type) {
  var ct = getPhoneCustom()
  var defaults = {
    messages: {
      avatarShape: 'circle', avatarSize: 36,
      selfBubbleBg: '#555', selfBubbleText: '#fff', selfBubbleRadius: 8,
      otherBubbleBg: '#fff', otherBubbleText: '#333', otherBubbleRadius: 8,
      bubbleFontSize: 13, timeColor: '#b0b8c4', chatBg: '#f0f0f0',
      callBackgroundType: 'preset',
      callBackgroundPreset: 'plain',
      callBackgroundImage: null
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
  var stored = ct.appSettings[type]
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {}
  var settings = readerOwnDataRecord(defaults[type] || {}, stored)
  settings.customCss = typeof settings.customCss === 'string'
    ? settings.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : ''
  if (type === 'messages') settings = readerOwnDataRecord(settings, normalizedReaderCallBackgroundSettings(settings))
  return settings
}

// ---- Apply app settings to styles ----
function appStyle(type) {
  var s = getAppSettings(type)
  var gallerySettings = normalizedReaderGallerySettings(s)
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
    columns: gallerySettings.columns,
    imageRadius: gallerySettings.imageRadius + 'px',
    gap: gallerySettings.gap + 'px',
    urlColor: s.urlColor || '#999',
    entryRadius: (s.entryRadius || 0) + 'px',
    nameColor: s.nameColor || '#333',
    nameSize: (s.nameSize || 12) + 'px',
    priceColor: s.priceColor || '#a3bded',
    nameWeight: s.nameWeight || '500',
    cardStyle: s.cardStyle || 'plain'
  }
}

function boundedReaderSetting(value, fallback, min, max) {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  var number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) return fallback
  return number
}

function normalizedReaderGallerySettings(settings) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var columns = Number(source.columns)
  if (columns !== 2 && columns !== 3 && columns !== 4) columns = 3
  return {
    columns: columns,
    imageRadius: boundedReaderSetting(source.imageRadius, 4, 0, 16),
    gap: boundedReaderSetting(source.gap, 6, 2, 16)
  }
}

function readerGalleryStyleVariables() {
  var settings = normalizedReaderGallerySettings(getAppSettings('gallery'))
  return '--rd-gallery-columns:' + settings.columns + ';--rd-gallery-radius:' + settings.imageRadius + 'px;--rd-gallery-gap:' + settings.gap + 'px'
}

// ---- Modal wrapper ----
function openCuModal(title, bodyHtml, onSave, returnFocus) {
  var ov = document.createElement('div')
  ov.className = 'cu-modal-overlay'
  ov.innerHTML = '<div class="cu-modal" role="dialog" aria-modal="true" aria-labelledby="cuModalTitle" tabindex="-1"><div class="cu-modal-header"><span class="cu-modal-title" id="cuModalTitle">' + esc(title) + '</span><button type="button" class="cu-modal-close" id="cuModalClose" aria-label="' + escapeHtmlAttribute('关闭 ' + title) + '">\u00d7</button></div><div class="cu-modal-body">' + bodyHtml + '</div><div class="cu-modal-footer"><button type="button" class="cu-btn-save" id="cuModalSave">保存</button><button type="button" class="cu-btn-cancel" id="cuModalCancel">取消</button></div></div>'
  document.body.appendChild(ov)
  var dialog = ov.querySelector('.cu-modal')
  var closeButton = ov.querySelector('#cuModalClose')
  var closed = false
  var returnAppType = returnFocus && returnFocus.getAttribute ? returnFocus.getAttribute('data-app') : ''
  var returnOwnerControl = returnFocus && returnFocus.getAttribute ? returnFocus.getAttribute('data-reader-phone-control') : ''

  function restoreModalFocus() {
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
      returnFocus.focus()
      return
    }
    if (returnAppType) {
      var appButtons = document.querySelectorAll('#tabCustom .rd-app-icon[data-app]')
      for (var appIndex = 0; appIndex < appButtons.length; appIndex++) {
        if (appButtons[appIndex].getAttribute('data-app') !== returnAppType) continue
        appButtons[appIndex].focus()
        return
      }
    }
    if (returnOwnerControl) {
      var ownerButton = document.querySelector('#tabCustom [data-reader-phone-control="' + returnOwnerControl + '"]')
      if (ownerButton) {
        ownerButton.focus()
        return
      }
    }
    var customTab = document.querySelector('.rd-tab[data-tab="custom"]')
    if (customTab) customTab.focus()
  }

  function closeModal() {
    if (closed) return
    closed = true
    ov.removeEventListener('keydown', onModalKeydown)
    ov.remove()
    restoreModalFocus()
  }

  function modalFocusables() {
    return Array.prototype.filter.call(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'), function(control) {
      return !control.hidden && control.getAttribute('aria-hidden') !== 'true'
    })
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }
    if (event.key !== 'Tab') return
    var focusables = modalFocusables()
    if (!focusables.length) {
      event.preventDefault()
      dialog.focus()
      return
    }
    var first = focusables[0]
    var last = focusables[focusables.length - 1]
    var active = document.activeElement
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  ov.closeReaderModal = closeModal
  ov.addEventListener('keydown', onModalKeydown)
  ov.addEventListener('click', function(e) { if (e.target === ov) closeModal() })
  closeButton.onclick = closeModal
  ov.querySelector('#cuModalCancel').onclick = closeModal
  var saveButton = ov.querySelector('#cuModalSave')
  saveButton.onclick = function() {
    try {
      if (onSave) onSave(ov)
      closeModal()
    } catch (error) {
      alert('设置保存失败，浏览器无法写入本地存储。请检查存储空间后重试。')
      saveButton.focus()
    }
  }
  closeButton.focus()
  return ov
}

function cuCard(title, body) {
  return '<div class="cu-card"><div class="cu-card-title">' + esc(title) + '</div><div class="cu-card-body">' + body + '</div></div>'
}

function cuRow(label, control) {
  return '<div class="cu-row"><span class="cu-row-label">' + esc(label) + '</span><span class="cu-row-ctrl">' + control + '</span></div>'
}

function cuColorBtn(color, cls, dataAttr, dataVal, label) {
  var active = (cls || '').indexOf('active') >= 0
  var accessibleName = (label || '颜色') + ' ' + color
  return '<button type="button" class="cu-color-btn' + (cls || '') + '" data-' + dataAttr + '="' + escapeHtmlAttribute(dataVal) + '" aria-label="' + escapeHtmlAttribute(accessibleName) + '" aria-pressed="' + (active ? 'true' : 'false') + '"><span class="cu-color-swatch" aria-hidden="true" style="background:' + escapeHtmlAttribute(color) + '"></span></button>'
}

function cuColorRow(label, presetColors, currentColor, dataAttr) {
  var h = '<div class="cu-color-group">'
  for (var i = 0; i < presetColors.length; i++) {
    h += cuColorBtn(presetColors[i], currentColor === presetColors[i] ? ' active' : '', dataAttr, presetColors[i], label)
  }
  h += '<input type="color" class="cu-color-picker" aria-label="' + escapeHtmlAttribute('自定义' + label) + '" value="' + escapeHtmlAttribute(currentColor) + '" data-' + dataAttr + '-picker="' + escapeHtmlAttribute(currentColor) + '">'
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
function renderCuPreviewLegacy(type, s) {
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
    var gallerySettings = normalizedReaderGallerySettings(s)
    var cols = gallerySettings.columns
    var imgRad = gallerySettings.imageRadius + 'px'
    var gap = gallerySettings.gap + 'px'
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

function readerAppPreviewFrameStyle(custom) {
  var ct = normalizePhoneCustom(custom)
  var style = '--phone-bg:' + sanitizeCssColor(ct.wallpaper) +
    ';--phone-radius:' + ct.borderRadius + 'px' +
    ';--phone-font:' + safePhoneCustomFontFamily(ct.fontFamily, readerPhoneCustomDefaults().fontFamily) +
    ';--phone-fontsize:' + ct.fontSize + 'px' +
    ';--phone-frame:' + sanitizeCssColor(ct.frameColor) +
    ';--phone-icon-radius:' + ct.iconBorderRadius + 'px' +
    ';--phone-material-opacity:' + ct.materialOpacity + '%' +
    ';--phone-time-color:' + sanitizeCssColor(ct.timeColor)
  if (ct.wallpaperType === 'image' && ct.wallpaperImage) {
    style += ';background-image:url("' + escapeHtmlAttribute(ct.wallpaperImage) + '");background-size:cover;background-position:center'
  }
  return style
}

function readerAppPreviewData() {
  var pd = readerPhoneData(_work && _work.phoneData)
  var contacts = Array.isArray(pd.contacts) ? pd.contacts : []
  var contact = contacts[0] || { id: 'preview-contact', name: '林晚', avatarUrl: '' }
  return { phone: pd, contacts: contacts, contact: contact, hasWork: !!(_work && _work.phoneData) }
}

function readerAppPreviewAvatar(contact, className, fallbackColor) {
  var name = String(contact && contact.name || '林晚')
  var h = '<span class="' + className + '" style="--rd-avatar-bg:' + sanitizeCssColor(fallbackColor || avatarColor(contact && contact.id || 'preview-contact')) + '">'
  if (contact && contact.avatarUrl) h += '<img src="' + escapeHtmlAttribute(contact.avatarUrl) + '" alt="">'
  else h += esc(name.charAt(0) || '林')
  return h + '</span>'
}

function readerAppPreviewBody(type, settings) {
  var data = readerAppPreviewData()
  var pd = data.phone
  var contact = data.contact
  var s = readerOwnDataRecord(settings)
  var shape = s.avatarShape === 'square' ? '2px' : (s.avatarShape === 'rounded' ? '8px' : '50%')

  if (type === 'messages') {
    var chatBg = sanitizeCssColor(s.chatBg || '#f0f0f0')
    var otherBg = sanitizeCssColor(s.otherBubbleBg || '#fff')
    var otherText = sanitizeCssColor(s.otherBubbleText || '#333')
    var selfBg = sanitizeCssColor(s.selfBubbleBg || '#555')
    var selfText = sanitizeCssColor(s.selfBubbleText || '#fff')
    var avatarSize = boundedReaderSetting(s.avatarSize, 36, 24, 56)
    var bubbleSize = boundedReaderSetting(s.bubbleFontSize, 13, 10, 18)
    var otherRadius = boundedReaderSetting(s.otherBubbleRadius, 8, 0, 20)
    var selfRadius = boundedReaderSetting(s.selfBubbleRadius, 8, 0, 20)
    var chat = Array.isArray(pd.chats) && pd.chats[0] ? pd.chats[0] : null
    var rounds = chat && Array.isArray(chat.rounds) ? chat.rounds : []
    var messages = rounds.flatMap(function(round) { return Array.isArray(round.messages) ? round.messages : [] })
      .filter(function(message) { return message && message.type !== 'time' && message.type !== 'call' })
    var otherMessage = messages.find(function(message) { return message.senderId !== 'self' && typeof message.text === 'string' })
    var selfMessage = messages.find(function(message) { return message.senderId === 'self' && typeof message.text === 'string' })
    var otherCopy = otherMessage ? readerPhoneText(otherMessage.text) : '我到天台了，你慢慢来。'
    var selfCopy = selfMessage ? readerPhoneText(selfMessage.text) : '风是不是很大？'
    var readerCustom = getPhoneCustom()
    var readerName = readerThreadDisplayName(pd, readerCustom)
    var authoredReaderAvatar = pd.skin && typeof pd.skin.readerAvatar === 'string' && isSafeImageUrl(pd.skin.readerAvatar)
      ? pd.skin.readerAvatar.trim()
      : ''
    var readerAvatar = readerCustom.readerAvatar || authoredReaderAvatar
    var h = '<div class="rd-app-preview-chat chat-author-shell chat-reader-shell" style="display:flex;flex-direction:column;height:100%;--chat-editor-screen:' + chatBg + '">'
    h += '<div class="chat-round-header"><span class="chat-round-control" aria-hidden="true">‹</span><div class="chat-round-title"><strong>' + esc(contact.name || '林晚') + '</strong></div><span class="chat-round-control" aria-hidden="true"></span></div>'
    h += '<div class="chat-msg-area">' + (shouldShowPhoneTimestamp(pd, '今天 20:41') ? '<div class="rd-chat-time" style="text-align:center;padding:6px 0;font-size:.62rem;color:' + sanitizeCssColor(s.timeColor || '#b0b8c4') + '">今天 20:41</div>' : '')
    h += '<div class="chat-msg rd-chat-message other is-other"><span class="chat-avatar" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor(contact.id)) + '">' + esc(String(contact.name || '林').charAt(0)) + '</span><div class="rd-chat-message-body"><div class="chat-bubble" style="font-size:' + bubbleSize + 'px;background:' + otherBg + ';color:' + otherText + ';border-radius:' + otherRadius + 'px ' + otherRadius + 'px ' + otherRadius + 'px 2px">' + esc(otherCopy) + '</div></div></div>'
    h += '<div class="chat-msg rd-chat-message self is-self"><span class="chat-avatar rd-reader-chat-avatar" aria-label="' + escapeHtmlAttribute(readerName) + '" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor('reader-' + readerName)) + '">'
    if (readerAvatar) h += '<img src="' + escapeHtmlAttribute(readerAvatar) + '" alt="">'
    else h += esc((readerName || '我').charAt(0))
    h += '</span><div class="rd-chat-message-body"><div class="chat-bubble" style="font-size:' + bubbleSize + 'px;background:' + selfBg + ';color:' + selfText + ';border-radius:' + selfRadius + 'px ' + selfRadius + 'px 2px ' + selfRadius + 'px">' + esc(selfCopy) + '</div></div></div></div>'
    h += '<div class="chat-input-bar chat-composer rd-chat-composer has-choices"><input id="chatInput" class="rd-chat-choice-trigger" readonly value="" placeholder="点击选择回复..."><button type="button" id="chatSendBtn" class="chat-send-btn rd-chat-choice-toggle" tabindex="-1">▶</button></div></div>'
    return h
  }

  if (type === 'forum') {
    var posts = orderedForumPosts(pd.forumPosts).slice(0, 3)
    if (posts.length === 0) posts = [
      { id: 'preview-post-1', title: '今晚观星天气', contactName: contact.name || '林晚', time: '20:14', pinned: true },
      { id: 'preview-post-2', title: '夏季大三角', contactName: 'MAY', time: '昨天' }
    ]
    var forumVars = '--rd-forum-card:' + sanitizeCssColor(s.cardBg || '#fff') +
      ';--rd-forum-radius:' + boundedReaderSetting(s.cardRadius, 0, 0, 16) + 'px' +
      ';--rd-forum-avatar-radius:' + shape +
      ';--rd-forum-title:' + sanitizeCssColor(s.titleColor || '#555') +
      ';--rd-forum-title-size:' + boundedReaderSetting(s.titleSize, 13, 10, 18) + 'px' +
      ';--rd-forum-time:' + sanitizeCssColor(s.timeColor || '#999')
    return posts.map(function(post, index) {
      var postContact = data.contacts.find(function(candidate) { return candidate.id === post.contactId }) || { id: post.contactId || 'preview-' + index, name: post.contactName || contact.name || '林晚' }
      var row = '<button type="button" class="rd-post-card" tabindex="-1" style="' + forumVars + '">'
      row += readerAppPreviewAvatar(postContact, 'rd-forum-avatar')
      row += '<span class="rd-forum-copy"><span class="rd-forum-title-line"><span class="rd-forum-title">' + esc(post.title || '未命名帖子') + '</span><span class="rd-forum-post-states">'
      if (post.pinned) row += '<span class="rd-forum-post-state rd-forum-post-pinned">置顶</span>'
      row += '</span></span><span class="rd-forum-meta">' + esc(postContact.name || '角色') + (shouldShowPhoneTimestamp(pd, post.time) ? ' / ' + esc(post.time) : '') + '</span></span></button>'
      return row
    }).join('')
  }

  if (type === 'memo') {
    var memos = (Array.isArray(pd.memos) ? pd.memos : []).slice(0, 2)
    if (memos.length === 0) memos = [{ content: '记得带上相机和备用电池。' }, { content: '周三下午三点，小组会议。' }]
    var memoStyle = ['plain', 'sticky', 'vintage'].includes(s.cardStyle) ? s.cardStyle : 'plain'
    var memoBg = memoStyle === 'sticky' ? '#fef9e7' : (memoStyle === 'vintage' ? '#f5e6c8' : sanitizeCssColor(s.cardBg || '#fff'))
    var memoBorder = memoStyle === 'sticky' ? '#e8d5a0' : (memoStyle === 'vintage' ? '#d4c4a0' : sanitizeCssColor(s.cardBorder || '#eee'))
    var memoVars = '--rd-memo-bg:' + memoBg +
      ';--rd-memo-border:' + memoBorder +
      ';--rd-memo-radius:' + (memoStyle === 'vintage' ? 2 : boundedReaderSetting(s.cardRadius, 4, 0, 16)) + 'px' +
      ';--rd-memo-text:' + sanitizeCssColor(s.textColor || '#333') +
      ';--rd-memo-font-size:' + boundedReaderSetting(s.fontSize, 12, 10, 16) + 'px' +
      ';--rd-memo-line-height:' + boundedReaderSetting(s.lineHeight, 1.6, 1.2, 2.4)
    return '<div class="rd-memo-stack rd-memo-style-' + memoStyle + '" style="' + memoVars + '">' + memos.map(function(memo) {
      var foot = shouldShowPhoneTimestamp(pd, memo.time) ? '<div class="memo-card-foot"><time class="memo-time-reader">' + esc(memo.time) + '</time></div>' : ''
      return '<article class="memo-card rd-memo-note"><div class="memo-card-inner"><div class="memo-editor" contenteditable="false">' + (memo.content || '空白备忘') + '</div>' + foot + '</div></article>'
    }).join('') + '</div>'
  }

  if (type === 'gallery') {
    var photos = (Array.isArray(pd.photos) ? pd.photos : []).slice(0, 6)
    if (photos.length === 0) photos = [
      { caption: '天台' }, { caption: '晚霞' }, { caption: '街灯' },
      { caption: '云层' }, { caption: '车窗' }, { caption: '海面' }
    ]
    var gallerySettings = normalizedReaderGallerySettings(s)
    var galleryVars = '--rd-gallery-columns:' + gallerySettings.columns + ';--rd-gallery-radius:' + gallerySettings.imageRadius + 'px;--rd-gallery-gap:' + gallerySettings.gap + 'px'
    return '<div class="gallery-bar"><span class="gallery-bar-title">最近项目 (' + photos.length + ')</span></div><div class="gallery-grid rd-gallery-grid" style="' + galleryVars + '">' + photos.map(function(photo) {
      var cell = '<button type="button" class="gallery-photo-card rd-gallery-photo" tabindex="-1" aria-pressed="false">'
      if (photo.imageUrl) cell += '<img src="' + escapeHtmlAttribute(photo.imageUrl) + '" alt="">'
      else cell += '<span class="gallery-photo-placeholder rd-gallery-photo-placeholder"><span class="gallery-photo-text">' + esc(photo.caption || '照片') + '</span></span>'
      return cell + '</button>'
    }).join('') + '</div>'
  }

  if (type === 'browser') {
    var history = (Array.isArray(pd.browserHistory) ? pd.browserHistory : []).slice(0, 3)
    if (history.length === 0) history = [
      { id: 'preview-history-1', contactId: contact.id, title: '今晚观星天气', url: 'weather.local/tonight', time: '20:14' },
      { id: 'preview-history-2', contactId: contact.id, title: '夏季大三角', url: 'stars.local/guide', time: '昨天' }
    ]
    var browserVars = '--rd-browser-entry:' + sanitizeCssColor(s.entryBg || 'transparent') +
      ';--rd-browser-radius:' + boundedReaderSetting(s.entryRadius, 0, 0, 12) + 'px' +
      ';--rd-browser-title:' + sanitizeCssColor(s.titleColor || '#555') +
      ';--rd-browser-title-size:' + boundedReaderSetting(s.titleSize, 12, 10, 16) + 'px' +
      ';--rd-browser-url:' + sanitizeCssColor(s.urlColor || '#999') +
      ';--rd-browser-time:' + sanitizeCssColor(s.timeColor || '#999')
    var browser = '<div class="browser-search-bar rd-browser-address"><span class="browser-search-icon rd-browser-search" aria-hidden="true">⌕</span><span class="browser-search-placeholder">搜索或输入网址</span></div><div class="browser-demo-body rd-browser-history" style="' + browserVars + '">'
    history.forEach(function(item) {
      browser += '<div class="browser-row rd-browser-entry"><span class="browser-dot rd-browser-marker" style="--rd-marker:' + sanitizeCssColor(avatarColor(item.contactId || contact.id)) + '"></span><span class="browser-info rd-browser-copy"><span class="browser-title rd-browser-title">' + esc(item.title || '未命名记录') + '</span><span class="browser-url rd-browser-url">' + esc(item.url || '') + '</span></span>' + (shouldShowPhoneTimestamp(pd, item.time) ? '<span class="browser-right"><time class="browser-time rd-browser-time">' + esc(String(item.time).replace(/\s.*$/, '')) + '</time></span>' : '') + '</div>'
    })
    return browser + '</div>'
  }

  if (type === 'shopping') {
    var items = (Array.isArray(pd.shoppingItems) ? pd.shoppingItems : []).slice(0, 3)
    if (!data.hasWork && items.length === 0) items = [{ name: '热饮', price: 18, style: '热', shop: '天台便利店' }, { name: '星图册', price: 42, shop: '旧书店' }]
    var previewCartItems = items.filter(function(item) { return item.status !== 'order' })
    var previewOrderItems = items.filter(function(item) { return item.status === 'order' })
    var previewActiveTab = previewCartItems.length > 0 || previewOrderItems.length === 0 ? 'cart' : 'order'
    var shopVars = '--rd-shop-card:' + sanitizeCssColor(s.cardBg || 'transparent') +
      ';--rd-shop-radius:' + boundedReaderSetting(s.cardRadius, 0, 0, 16) + 'px' +
      ';--rd-shop-name:' + sanitizeCssColor(s.nameColor || '#333') +
      ';--rd-shop-name-size:' + boundedReaderSetting(s.nameSize, 12, 10, 16) + 'px' +
      ';--rd-shop-price:' + sanitizeCssColor(s.priceColor || '#a3bded')
    var previewTabs = renderPhoneShoppingTabs({
      activeTab: previewActiveTab,
      idPrefix: 'rdShopPreview',
      cartPanelId: 'rdShopPreviewCart',
      orderPanelId: 'rdShopPreviewOrder',
      tabListClass: 'rd-shop-tabs',
      tabClass: 'rd-shop-tab'
    })
    var previewCart = renderPhoneShoppingList(previewCartItems, {
      mode: 'cart',
      surface: 'reader',
      style: shopVars,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    })
    var previewOrders = renderPhoneShoppingList(previewOrderItems, {
      mode: 'order',
      surface: 'reader',
      style: shopVars,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    })
    return previewTabs + '<div class="shop-body-inner">' +
      '<div class="rd-shop-panel" id="rdShopPreviewCart"' + (previewActiveTab === 'cart' ? '' : ' hidden') + '>' + previewCart + '</div>' +
      '<div class="rd-shop-panel" id="rdShopPreviewOrder"' + (previewActiveTab === 'order' ? '' : ' hidden') + '>' + previewOrders + '</div></div>'
  }

  var contacts = data.contacts.slice(0, 4)
  if (contacts.length === 0) contacts = [contact, { id: 'preview-contact-2', name: 'MAY' }, { id: 'preview-contact-3', name: '陈泊' }]
  var contactVars = '--rd-contact-radius:' + shape +
    ';--rd-contact-name:' + sanitizeCssColor(s.nameColor || '#555') +
    ';--rd-contact-name-size:' + boundedReaderSetting(s.nameSize, 13, 10, 18) + 'px' +
    ';--rd-contact-name-weight:' + (['600', '700'].includes(String(s.nameWeight)) ? s.nameWeight : '500')
  return '<div class="rd-contact-book" style="' + contactVars + '">' + contacts.map(function(item) {
    return '<div class="rd-contact-entry">' + readerAppPreviewAvatar(item, 'rd-contact-avatar') + '<div class="rd-contact-name">' + esc(item.name || '未命名') + '</div></div>'
  }).join('') + '</div>'
}

function renderCuPreview(type, settings) {
  var safeType = readerAppCssType(type) || 'browser'
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物清单', contacts:'联系人' }
  var previewData = readerAppPreviewData()
  var scopedTypes = ['memo', 'gallery', 'browser', 'shopping']
  var previewTitle = labels[safeType]
  if (scopedTypes.includes(safeType) && previewData.contact) {
    previewTitle = (previewData.contact.name || '未命名') + ' · ' + previewTitle
  }
  var custom = getPhoneCustom()
  applyCompiledReaderStyle(custom.customCss, '.reader-phone-css-preview-scope', 'reader-app-phone-preview-user-css')
  var frameStyle = readerAppPreviewFrameStyle(custom)
  var body = readerAppPreviewBody(safeType, settings)
  var h = '<div class="cu-preview" id="cuPreview">'
  h += '<div class="cu-preview-label"><span>实时预览</span><small>使用当前作品与实际 App 组件</small></div>'
  h += '<div class="rd-phone-preview"><div class="phone-frame reader-app-preview-frame reader-phone-css-preview-scope" style="' + escapeHtmlAttribute(frameStyle) + '">'
  h += '<div class="cu-panel cu-panel-embedded rd-phone-app-panel rd-phone-app-' + safeType + ' reader-app-preview-scope">'
  h += '<div class="cu-header rd-phone-app-header"><span class="rd-back-btn" aria-hidden="true">←</span><span class="cu-title">' + esc(previewTitle) + '</span><span class="rd-back-spacer" aria-hidden="true"></span></div>'
  h += '<div class="cu-body rd-phone-app-body">' + body + '</div></div></div></div></div>'
  return h
}

function assignFiniteSetting(settings, key, value) {
  var number = Number(value)
  if (Number.isFinite(number)) settings[key] = number
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
    if (el) assignFiniteSetting(s, sliderMap[id], el.value)
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
  var customCss = modal.querySelector('#cuAppCustomCss')
  s.customCss = customCss && typeof customCss.value === 'string'
    ? customCss.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : (typeof s.customCss === 'string' ? s.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH) : '')
  return s
}

function syncReaderAppCssFeedback(modal, type, settings) {
  var rawCss = typeof settings.customCss === 'string' ? settings.customCss : ''
  var result = applyReaderAppCustomCss(type, settings, { preview: true })
  var error = modal.querySelector('#cuAppCssError')
  var count = modal.querySelector('#cuAppCssCount')
  var status = modal.querySelector('#cuAppLiveStatus')
  var save = modal.querySelector('#cuModalSave')
  if (count) count.textContent = rawCss.length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
  if (error) {
    error.hidden = result.ok
    error.textContent = result.ok ? '' : result.error
  }
  if (status) {
    status.classList.toggle('is-error', !result.ok)
    status.textContent = result.ok ? '实时预览 · 保存后应用到实际 App' : 'CSS 有误，已保留上一次可用预览'
  }
  if (save) save.disabled = !result.ok || save.dataset.readerAsyncPending === 'true'
  return result
}

function updateCuPreview(modal, type) {
  var preview = modal.querySelector('#cuPreview')
  if (!preview) return
  var s = readCurrentSettings(modal, type)
  preview.innerHTML = renderCuPreview(type, s).replace(/^<div class="cu-preview"[^>]*>/, '').replace(/<\/div>$/, '')
  syncReaderAppCssFeedback(modal, type, s)
}

function readerCallBackgroundPreviewMarkup(background) {
  var presentation = readerCallBackgroundPresentation(background)
  return '<div id="cuCallBackgroundPreview" class="cu-call-background-preview' + presentation.className + '" data-call-background="' + presentation.attribute + '"' + (presentation.style ? ' style="' + escapeHtmlAttribute(presentation.style) + '"' : '') + '><span>通话背景预览</span></div>'
}

function readerCallBackgroundControls(background) {
  var buttons = Object.keys(READER_CALL_BACKGROUND_PRESETS).map(function(key) {
    var pressed = background.callBackgroundType === 'preset' && background.callBackgroundPreset === key
    return '<button type="button" class="cu-call-background-preset' + (pressed ? ' active' : '') + '" data-cu-call-background-preset="' + key + '" aria-label="选择' + READER_CALL_BACKGROUND_PRESETS[key] + '通话背景" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + READER_CALL_BACKGROUND_PRESETS[key] + '</button>'
  }).join('')
  return '<div class="cu-call-background-presets" role="group" aria-label="通话背景预设">' + buttons + '</div>' +
    readerCallBackgroundPreviewMarkup(background) +
    '<div class="cu-call-background-actions"><button type="button" id="cuCallBackgroundUpload">选择本地图片</button><input type="file" id="cuCallBackgroundFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="cuCallBackgroundRestore">恢复默认</button></div>' +
    '<p id="cuCallBackgroundError" class="cu-call-background-error" role="alert" hidden></p>'
}

function syncReaderCallBackgroundControls(modal, background) {
  modal.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
    var pressed = background.callBackgroundType === 'preset' && button.dataset.cuCallBackgroundPreset === background.callBackgroundPreset
    button.classList.toggle('active', pressed)
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false')
  })
  var preview = modal.querySelector('#cuCallBackgroundPreview')
  if (preview) preview.outerHTML = readerCallBackgroundPreviewMarkup(background)
}

// ====== Per-App Settings Panel ======
function openReaderAppSettings(type, trigger) {
  var ct = getPhoneCustom()
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物', contacts:'联系人' }
  var title = '美化 - ' + (labels[type] || 'App')

  var persistedSettings = getAppSettings(type)
  var s = JSON.parse(JSON.stringify(persistedSettings))
  var callBackgroundDraft = type === 'messages'
    ? normalizedReaderCallBackgroundSettings(s)
    : null
  var pendingPersistedCallBackground = null
  var pendingPersistedFallbackDraft = null
  if (type === 'messages') {
    var storedMessageSettings = readerPlainRecord(readerPlainRecord(ct.appSettings).messages)
    if (storedMessageSettings.callBackgroundType === 'image' && typeof storedMessageSettings.callBackgroundImage === 'string') {
      var storedImageUrl = canonicalReaderCallBackgroundDataUrl(storedMessageSettings.callBackgroundImage)
      if (!verifiedReaderCallBackgroundImages.has(storedImageUrl)) {
        pendingPersistedCallBackground = {
          callBackgroundType: 'image',
          callBackgroundPreset: callBackgroundDraft.callBackgroundPreset,
          callBackgroundImage: storedMessageSettings.callBackgroundImage
        }
        callBackgroundDraft = {
          callBackgroundType: 'preset',
          callBackgroundPreset: pendingPersistedCallBackground.callBackgroundPreset,
          callBackgroundImage: null
        }
        pendingPersistedFallbackDraft = callBackgroundDraft
      }
    }
  }
  if (type === 'gallery') {
    var normalizedGallery = normalizedReaderGallerySettings(s)
    s.columns = normalizedGallery.columns
    s.imageRadius = normalizedGallery.imageRadius
    s.gap = normalizedGallery.gap
  }
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
    body += '<div id="cuCallBackgroundCard">' + cuCard('通话背景', readerCallBackgroundControls(callBackgroundDraft)) + '</div>'
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
      '<button style="padding:4px 10px;font-size:.7rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer;white-space:nowrap" id="cuIconUpload">上传</button>' +
      (curIcon ? '<button style="padding:4px 10px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;white-space:nowrap" id="cuIconClear">清除</button>' : '') +
      '</div>')
  )
  if (curIcon) body += '<div class="rd-preview-img"><img src="' + esc(curIcon) + '" style="max-height:40px;border-radius:4px"></div>'

  body += cuCard('高级 CSS',
    '<div class="rs-css-section">' +
      '<textarea id="cuAppCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuAppCssHint cuAppCssError" placeholder=".rd-phone-app-body { padding: 14px; }">' + esc(s.customCss || '') + '</textarea>' +
      '<div class="rs-css-meta"><p class="rs-field-hint" id="cuAppCssHint">只作用于当前 App；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuAppCssCount">' + String((s.customCss || '').length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>' +
      '<p class="rs-css-error" id="cuAppCssError" role="alert" hidden></p>' +
      '<div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuAppCssSample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuAppCssClear">清空 CSS</button></div>' +
    '</div>'
  )

  body += '<div style="text-align:center;padding-top:8px"><button class="cu-reset-btn" id="cuAppReset">恢复默认</button></div>'

  body = '<div class="app-appearance-layout"><aside class="app-appearance-preview-pane">' +
    renderCuPreview(type, s) +
    '<p class="phone-appearance-status" id="cuAppLiveStatus" role="status" aria-live="polite">实时预览 · 保存后应用到实际 App</p>' +
    '</aside><div class="app-appearance-controls">' + body + '</div></div>'

  var ov = openCuModal(title, body, function(modal) {
    // Helper: read color from active button or from picker
    function readColor(attr, key) {
      var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
      if (btn) { s[key] = btn.getAttribute('data-' + attr); return }
      var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
      if (picker && picker.value) s[key] = picker.value
    }
    readColor('cu-self-bg', 'selfBubbleBg')
    readColor('cu-self-text', 'selfBubbleText')
    readColor('cu-other-bg', 'otherBubbleBg')
    readColor('cu-other-text', 'otherBubbleText')
    readColor('cu-chat-bg', 'chatBg')
    readColor('cu-time-color', 'timeColor')
    readColor('cu-card-bg', 'cardBg')
    readColor('cu-title-color', 'titleColor')
    readColor('cu-text-color', 'textColor')
    readColor('cu-url-color', 'urlColor')
    readColor('cu-name-color', 'nameColor')
    readColor('cu-price-color', 'priceColor')
    var shapeBtns = modal.querySelectorAll('.cu-shape-btn.active')
    shapeBtns.forEach(function(b) {
      if (b.dataset.cuShape) s.avatarShape = b.dataset.cuShape
    })
    // Sliders
    function readSlider(id, key) {
      var el = modal.querySelector('#' + id)
      if (el) assignFiniteSetting(s, key, el.value)
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
    var customCssInput = modal.querySelector('#cuAppCustomCss')
    s.customCss = customCssInput && typeof customCssInput.value === 'string'
      ? customCssInput.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
      : ''
    var customCssValidation = compileScopedReaderCss(s.customCss, '.rd-phone-app-' + readerAppCssType(type))
    if (!customCssValidation.ok) throw new Error(customCssValidation.error)
    // Read icon URL
    var iconUrlEl = modal.querySelector('#cuIconUrl'); if (iconUrlEl && iconUrlEl.value.trim()) ct.customIcons[type] = iconUrlEl.value.trim()
    if (type === 'messages') Object.assign(s, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
    ct.appSettings[type] = s
    try {
      savePhoneCustom(ct)
    } catch (error) {
      var callBackgroundStorageError = modal.querySelector('#cuCallBackgroundError')
      if (callBackgroundStorageError) {
        callBackgroundStorageError.textContent = '通话背景保存失败，请检查浏览器存储空间后重试。'
        callBackgroundStorageError.hidden = false
      }
      throw error
    }
    applyReaderAppCustomCss(type, s)
    renderCustomPage()
    showReaderToast((labels[type] || 'App') + '美化已保存')
  }, trigger)
  var appAppearanceDialog = ov.querySelector('.cu-modal')
  if (appAppearanceDialog) appAppearanceDialog.classList.add('app-appearance-workbench')

  var callBackgroundSaveButton = ov.querySelector('#cuModalSave')
  var callBackgroundError = ov.querySelector('#cuCallBackgroundError')
  var callBackgroundOperationVersion = 0

  function clearReaderCallBackgroundError() {
    if (!callBackgroundError) return
    callBackgroundError.hidden = true
    callBackgroundError.textContent = ''
  }

  function showReaderCallBackgroundError(message) {
    if (!callBackgroundError) return
    callBackgroundError.textContent = message
    callBackgroundError.hidden = false
  }

  function invalidateReaderCallBackgroundOperation() {
    callBackgroundOperationVersion += 1
    if (callBackgroundSaveButton) {
      delete callBackgroundSaveButton.dataset.readerAsyncPending
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  }

  ov.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
    button.onclick = function() {
      invalidateReaderCallBackgroundOperation()
      clearReaderCallBackgroundError()
      callBackgroundDraft = {
        callBackgroundType: 'preset',
        callBackgroundPreset: button.dataset.cuCallBackgroundPreset,
        callBackgroundImage: null
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    }
  })
  var callBackgroundRestore = ov.querySelector('#cuCallBackgroundRestore')
  if (callBackgroundRestore) callBackgroundRestore.onclick = function() {
    invalidateReaderCallBackgroundOperation()
    clearReaderCallBackgroundError()
    callBackgroundDraft = Object.assign({}, READER_CALL_BACKGROUND_DEFAULT)
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
  }

  if (pendingPersistedCallBackground) {
    var persistedOperationVersion = ++callBackgroundOperationVersion
    if (callBackgroundSaveButton) {
      callBackgroundSaveButton.dataset.readerAsyncPending = 'true'
      callBackgroundSaveButton.disabled = true
    }
    clearReaderCallBackgroundError()
    verifyReaderCallBackgroundDataUrl(pendingPersistedCallBackground.callBackgroundImage).then(function(dataUrl) {
      if (!ov.isConnected || persistedOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== pendingPersistedFallbackDraft) return
      callBackgroundDraft = {
        callBackgroundType: 'image',
        callBackgroundPreset: pendingPersistedCallBackground.callBackgroundPreset,
        callBackgroundImage: dataUrl
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    }).catch(function() {
      if (!ov.isConnected || persistedOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== pendingPersistedFallbackDraft) return
      showReaderCallBackgroundError('之前保存的通话背景无法使用，已改用安全预设。')
    }).finally(function() {
      if (ov.isConnected && persistedOperationVersion === callBackgroundOperationVersion && callBackgroundSaveButton) {
        delete callBackgroundSaveButton.dataset.readerAsyncPending
        syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
      }
    })
  }

  var callBackgroundUpload = ov.querySelector('#cuCallBackgroundUpload')
  var callBackgroundFile = ov.querySelector('#cuCallBackgroundFile')
  if (callBackgroundUpload && callBackgroundFile) {
    callBackgroundUpload.onclick = function() { callBackgroundFile.click() }
    callBackgroundFile.onchange = function() {
      var file = callBackgroundFile.files && callBackgroundFile.files[0]
      if (!file) return
      callBackgroundFile.value = ''
      var draftBeforeUpload = callBackgroundDraft
      var uploadOperationVersion = ++callBackgroundOperationVersion
      clearReaderCallBackgroundError()
      if (callBackgroundSaveButton) {
        callBackgroundSaveButton.dataset.readerAsyncPending = 'true'
        callBackgroundSaveButton.disabled = true
      }
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (!ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== draftBeforeUpload) return
        callBackgroundDraft = {
          callBackgroundType: 'image',
          callBackgroundPreset: draftBeforeUpload.callBackgroundPreset,
          callBackgroundImage: dataUrl
        }
        syncReaderCallBackgroundControls(ov, callBackgroundDraft)
      }).catch(function(error) {
        if (!ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== draftBeforeUpload) return
        showReaderCallBackgroundError(error && error.message ? error.message : '图片无法使用')
      }).finally(function() {
        if (ov.isConnected && uploadOperationVersion === callBackgroundOperationVersion) {
          if (callBackgroundSaveButton) {
            delete callBackgroundSaveButton.dataset.readerAsyncPending
            syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
          }
          callBackgroundFile.value = ''
        }
      })
    }
  }

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
    p.addEventListener('input', function() {
      var group = p.parentElement
      if (group) {
        group.querySelectorAll('.cu-color-btn').forEach(function(button) {
          button.classList.remove('active')
          button.setAttribute('aria-pressed', 'false')
        })
      }
      updateCuPreview(ov, type)
    })
  })
  ov.querySelectorAll('.cu-shape-btn').forEach(function(b) {
    b.addEventListener('click', function() { setTimeout(function() { updateCuPreview(ov, type) }, 50) })
  })
  ov.querySelectorAll('.cu-style-btn').forEach(function(b) {
    b.addEventListener('click', function() { setTimeout(function() { updateCuPreview(ov, type) }, 50) })
  })
  var appCssInput = ov.querySelector('#cuAppCustomCss')
  if (appCssInput) {
    appCssInput.addEventListener('input', function() { updateCuPreview(ov, type) })
  }
  var appCssSample = ov.querySelector('#cuAppCssSample')
  if (appCssSample && appCssInput) appCssSample.onclick = function() {
    appCssInput.value = ':scope { --phone-system-accent: #9f6678; }\n.rd-phone-app-body { padding: 14px; }'
    updateCuPreview(ov, type)
    appCssInput.focus()
  }
  var appCssClear = ov.querySelector('#cuAppCssClear')
  if (appCssClear && appCssInput) appCssClear.onclick = function() {
    appCssInput.value = ''
    updateCuPreview(ov, type)
    appCssInput.focus()
  }
  // Bind color buttons
  ov.querySelectorAll('.cu-color-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-color-btn').forEach(function(x) {
        x.classList.remove('active')
        x.setAttribute('aria-pressed', 'false')
      })
      b.classList.add('active')
      b.setAttribute('aria-pressed', 'true')
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
  syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  // Reset
  var resetBtn = ov.querySelector('#cuAppReset')
  if (resetBtn) resetBtn.onclick = function() {
    delete ct.appSettings[type]
    try {
      savePhoneCustom(ct)
    } catch (error) {
      alert('恢复默认失败，浏览器无法写入本地存储。请检查存储空间后重试。')
      resetBtn.focus()
      return
    }
    applyReaderAppCustomCss(type, getAppSettings(type))
    renderCustomPage()
    ov.closeReaderModal()
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
  h += '<div class="rd-phone-owner-controls" aria-label="阅读器手机设置">'
  h += '<button type="button" class="rd-phone-owner-control" data-reader-phone-control="reading">'
  h += '<span class="rd-phone-owner-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12H7.5A2.5 2.5 0 0 1 5 16.5v-12Z"/><path d="M7.5 19A2.5 2.5 0 0 1 5 16.5 2.5 2.5 0 0 1 7.5 14H17"/><path d="M9 8h4"/></svg></span>'
  h += '<span><strong>文章阅读</strong><small>文字、留白、颜色与背景</small></span>'
  h += '</button>'
  h += '<button type="button" class="rd-phone-owner-control" data-reader-phone-control="appearance">'
  h += '<span class="rd-phone-owner-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h16"/><path d="M6 16.5 16.5 6a2.1 2.1 0 0 1 3 3L9 19.5 4 20l.5-5Z"/><path d="m14.5 8 3 3"/></svg></span>'
  h += '<span><strong>手机外观</strong><small>壁纸、边框与字体</small></span>'
  h += '</button>'
  h += '<button type="button" class="rd-phone-owner-control" data-reader-phone-control="profile">'
  h += '<span class="rd-phone-owner-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6"/></svg></span>'
  h += '<span><strong>个人信息</strong><small>昵称、头像与封面</small></span>'
  h += '</button>'
  h += '</div>'
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
  var ownerControl = el && el.closest ? el.closest('[data-reader-phone-control]') : null
  if (ownerControl && ownerControl.closest('#tabCustom')) {
    e.preventDefault()
    if (ownerControl.dataset.readerPhoneControl === 'reading') openReaderSettingsPanel(ownerControl)
    if (ownerControl.dataset.readerPhoneControl === 'appearance') openReaderCustomizePanel(ownerControl)
    if (ownerControl.dataset.readerPhoneControl === 'profile') openReaderProfilePanel()
    return
  }
  // Walk up the DOM tree to find .rd-app-icon inside #tabCustom
  while (el && el !== document.body) {
    if (el.classList && el.classList.contains('rd-app-icon')) {
      // Verify we're inside the custom panel
      if (!el.closest('#tabCustom')) return
      var type = el.getAttribute('data-app')
      if (!type) return
      e.preventDefault()
      e.stopPropagation()
      openReaderAppSettings(type, el)
      return
    }
    el = el.parentElement
  }
})

// ---- Init ----
function startReader() {
  var preview = prepareEditorPreview()
  _editorPreviewMode = preview.preview
  if (!preview.preview) {
    if (_activeReaderCollectionId) renderReaderCollectionById(_activeReaderCollectionId)
    else renderHome()
    if (!_editorPreviewMode) showReleaseAnnouncementOnce()
    return
  }
  if (!preview.ok) {
    renderEditorPreviewError(preview.message)
    return
  }
  loadWork(preview.work, { remember: false })
}

startReader()
