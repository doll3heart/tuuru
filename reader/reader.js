import { prepareImportedWork } from '../js/work-import.js'
import { readerWorkImportReview } from './work-import-review.js'
import { workReleaseFingerprintMatches } from '../js/work-release.js'
import { substitutePlaceholders } from '../js/placeholders.js'
import { escapeHtmlAttribute, isSafeImageUrl, sanitizeCssColor, sanitizeIconHtml } from '../js/sanitize.js'
import { shouldUseMotion } from '../js/motion-preference.js'
import { readSteganoPayload } from '../js/stegano.js'
import { decryptWorkPackage, isEncryptedWorkPackage } from '../js/work-package.js'
import { phoneGridContainerStyle, phoneGridItemStyle } from './phone-grid.js'
import { parsePngDimensionsFromDataUrl, readerPngDimensionError } from './png-import-policy.js'
import { buildReaderPhoneModuleTrigger, markReaderPhoneModuleTriggerRead } from './reader-phone-module-trigger.js'
import { advanceCallPlayback, createCallPlaybackState } from './call-playback.js'
import { applyChatChoice, rollbackChatChoice } from '../js/chat-choice-runtime.js'
import { applyThreadChoice, rollbackThreadChoice } from '../js/thread-choice-runtime.js'
import { resolveArticleChoiceTarget } from '../js/article-reader-navigation.js'
import {
  pruneArticleChoiceMemory,
  recordArticleChoice,
  selectedArticleChoiceIds,
} from '../js/article-choice-memory.js'
import {
  pruneArticleInteractionSelections,
  recordArticleInteractionSelection,
  selectedArticleInteractionChoice,
  selectedArticleInteractionChoiceIds,
} from '../js/article-interaction-memory.js'
import { ARTICLE_INTERACTION_MARKER_CLASS } from '../js/article-interaction-group-model.js'
import { articleDisplayConditionMatches } from '../js/article-condition-model.js'
import { resolveAutomaticArticleStartNodeId } from '../js/article-start-node.js'
import {
  appendArticleChoice,
  continueArticleChapterPath,
  continueArticleInteraction,
  currentArticleChapterEntries,
  expandArticleChapterPath,
  nextArticleChapterPath,
  previousArticleChapterPath,
  reconcileArticleConditionalPath,
} from '../js/article-chapter-runtime.js'
import { prepareEditorPreview } from './editor-preview.js'
import { buildAuthorReturnUrl } from '../js/app-entry-links.js'
import { buildTakeawayOpenTarget, safeMessageCardUrl } from '../js/message-card-links.js'
import { orderedForumPosts } from '../js/forum-post-order.js'
import { orderedChats } from '../js/chat-order.js'
import { visiblePhoneModuleContacts } from '../js/phone-module-draft.js'
import { effectiveForbiddenWords } from '../js/forbidden-words.js'
import { shouldShowPhoneTimestamp } from '../js/phone-timestamps.js'
import { normalizeDynamicIslandStyle } from '../js/phone-dynamic-island.js'
import {
  addReaderLocalFont,
  deleteReaderLocalFont,
  readerLocalFontFamily,
  renameReaderLocalFont,
  replaceReaderLocalFont,
} from './local-font-library.js'
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
import { installDialogInteraction } from '../js/dialog-interaction.js'
import { createFeedbackCenter } from '../js/interaction-feedback.js'
import { refreshReorderedContent } from '../js/reorder-motion.js'
import { WORK_COLLECTION_BUNDLE_TYPE } from '../js/work-collections.js'
import { inspectReaderCollectionBundle, installReaderCollection } from './work-collection-import.js'
import { downloadBlob } from '../js/download.js'
import {
  READER_APPEARANCE_PACKAGE_MAX_BYTES,
  inspectReaderAppearancePackage,
  serializeReaderAppearancePackage,
} from './appearance-package.js'
import {
  READER_DATA_PACKAGE_MAX_BYTES,
  inspectReaderDataPackage,
  mergeReaderDataPackage,
  serializeReaderDataPackage,
} from './reader-data-package.js'
import {
  installReaderCacheWithRescue,
  isReaderStorageQuotaError,
  readerStorageRescueCandidates,
} from './reader-storage-rescue.js'
import { workUsesCameraInteractions } from '../js/interactive-scene-model.js'
import { mountInteractiveScene } from '../js/interactive-scene-renderer.js'
import { substituteInteractiveSceneText } from '../js/interactive-scene-placeholders.js'
import {
  interactiveSceneForNode,
  isInteractiveSceneNode,
} from '../js/interactive-scene-node.js'
import {
  createFaceNearSignal,
  requestInteractiveCameraPreflight,
  startInteractiveFaceNearSession,
} from '../js/interactive-scene-camera.js'
import {
  readerInteractiveSceneById,
  replaceInteractiveSceneCards,
} from './interactive-scene-entry.js'
import { createBookCoverHold } from './book-cover-hold.js'
import {
  compareReaderSlots,
  readerJourneyDirectory,
} from './reader-journey-insights.js'
import {
  applyReaderIdentity,
  appendReaderCheckpoint,
  clearReaderProgress,
  createReaderSlot,
  dismissReaderWorkUpdate,
  readReaderLibrary,
  readerActiveSlot,
  readerBook,
  readerBookStatus,
  reconcileReaderWorkUpdate,
  rememberReaderWork,
  removeReaderBook,
  removeReaderBookmark,
  removeReaderIdentity,
  removeReaderSlot,
  renameReaderSlot,
  restoreArticleReadingState,
  restoreReaderBook,
  restoreReaderBookmark,
  saveReaderIdentity,
  saveReaderPlaceholders,
  saveReaderProgress,
  setReaderBookPinned,
  setReaderCompletion,
  switchReaderSlot,
  toggleReaderBookmark,
  updateReaderBookmark,
  writeReaderLibrary,
} from './reader-library-state.js'
import {
  buildUnlockedReaderSearchIndex,
  searchUnlockedReaderIndex,
} from './reader-unlocked-search.js'

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
var _articleChoiceMemory = {}
var _articleInteractionSelections = Object.create(null)
var _articleCheckpoints = []
var _renderedRecentIds = []
var _renderedBookIds = []
var _renderedCollectionIds = []
var _activeReaderCollectionId = ''
var _readerCollectionValues = Object.create(null)
var _readerPhoneChoiceSession = null
var _readerPhoneFlowSession = null
var _editorPreviewMode = false
var _readerPersistenceEnabled = true
var _readerImportOverlay = null
var _readerImportInvoker = null
var _readerImportDialogLifecycle = null
var _readerShelfQuery = ''
var _readerShelfSort = 'recent'
var _readerHomeTab = 'personal'
var _readerHomeScrollY = 0
var _readerHomeRestoreScroll = false
var _readerDataPanelOpen = false
var _readerDataStatusMessage = ''
var _interactiveCameraState = { granted:false, detectorAvailable:false, reason:"", preflighted:false }
var _interactiveSceneCameraSession = null
var _interactiveSceneController = null
var _articleChoiceUndoBar = null
var _articleChoiceUndoTimer = null
var _articleImmersiveScrollHandler = null
var _articleImmersiveKeydownHandler = null
var _readerUnlockedSearchPanel = null
var _readerUnlockedSearchPreview = null
var _readerUnlockedSearchInvoker = null
var _readerUnlockedSearchPosition = null
var _readerPendingReadingPosition = null
var _readerPhoneLocation = null
var _readerPositionSaveTimer = null
var ARTICLE_READING_ANCHOR_SELECTOR = '.article-content > *, .article-choices, [data-interaction-group]'
var ARTICLE_CHOICE_UNDO_DURATION = 5000
var ARTICLE_CHOICE_COMMIT_GUARD_DURATION = 280
var READER_POSITION_SAVE_DELAY = 420

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
  return buildAuthorReturnUrl(globalThis.location?.href ?? globalThis.window?.location?.href)
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

function getReaderLibraryState() {
  return readReaderLibrary(localStorage)
}

function commitReaderLibraryState(library) {
  var saved = writeReaderLibrary(localStorage, library)
  if (!saved) warnReaderStorageFailure()
  return saved
}

function rememberReaderWorkState(work, openedAt) {
  var next = rememberReaderWork(getReaderLibraryState(), work, openedAt || Date.now())
  commitReaderLibraryState(next)
  return readerBook(next, work && work.id)
}

function cloneReaderPlaceholderValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {}
  var cloned = {}
  Object.keys(values).forEach(function(id) {
    var source = values[id]
    var first = Array.isArray(source) ? source[0] : source
    if (typeof first === 'string') cloned[id] = [first]
  })
  return cloned
}

function savedReaderBook(workId) {
  return readerBook(getReaderLibraryState(), workId)
}

function saveReaderWorkPlaceholders(work, values) {
  if (!_readerPersistenceEnabled || !work || !work.id) return !_readerPersistenceEnabled
  var next = saveReaderPlaceholders(getReaderLibraryState(), work.id, values, Date.now())
  return commitReaderLibraryState(next)
}

function saveCurrentReaderProgress() {
  if (!_readerPersistenceEnabled || !_work || !_work.id) return false
  var readingPosition = currentReaderReadingPosition()
  var progress = _work.type === 'phone'
    ? {
      kind:'phone',
      flowIndex:readerPhoneFlowSession(_work).index,
      readingPosition:readingPosition,
    }
    : {
      kind:'article',
      path:_articlePath,
      choiceMemory:_articleChoiceMemory,
      interactionSelections:_articleInteractionSelections,
      checkpoints:_articleCheckpoints,
      readingPosition:readingPosition,
    }
  var next = saveReaderProgress(getReaderLibraryState(), _work.id, progress, Date.now())
  return commitReaderLibraryState(next)
}

function clearReaderWorkProgress(workId) {
  var next = clearReaderProgress(getReaderLibraryState(), workId, Date.now())
  return commitReaderLibraryState(next)
}

function setReaderWorkCompletion(workId, completed) {
  if (!_readerPersistenceEnabled || !workId) return false
  return commitReaderLibraryState(setReaderCompletion(
    getReaderLibraryState(),
    workId,
    completed,
    Date.now(),
  ))
}

function articleBookmarkSignature(bookmark) {
  return JSON.stringify([
    bookmark?.path || [],
    bookmark?.choiceMemory || {},
    bookmark?.interactionSelections || {},
  ])
}

function currentArticleBookmark(book) {
  if (!book || _work?.type === 'phone' || !_articlePath.length) return null
  var signature = articleBookmarkSignature({
    path:_articlePath,
    choiceMemory:_articleChoiceMemory,
    interactionSelections:_articleInteractionSelections,
  })
  return (book.bookmarks || []).find(function(bookmark) {
    return bookmark.kind === 'article' && articleBookmarkSignature(bookmark) === signature
  }) || null
}

function toggleCurrentArticleBookmark(label) {
  if (!_readerPersistenceEnabled || !_work?.id || _work.type === 'phone' || !_articlePath.length) return null
  var bookmark = {
    id:['reader-bookmark', Date.now().toString(36), _articlePath.length].join('-'),
    kind:'article',
    label:label || '阅读位置',
    path:_articlePath,
    choiceMemory:_articleChoiceMemory,
    interactionSelections:_articleInteractionSelections,
  }
  var next = toggleReaderBookmark(getReaderLibraryState(), _work.id, bookmark, Date.now())
  commitReaderLibraryState(next)
  return readerBook(next, _work.id)
}

function captureArticleCheckpoint(sourceNodeId, label, path, memory, interactionSelections) {
  if (!_work || _work.type === 'phone' || !sourceNodeId || !Array.isArray(path) || !path.length) return
  var checkpointId = [
    'reader-checkpoint',
    Date.now().toString(36),
    String(_articleCheckpoints.length + 1),
  ].join('-')
  var progress = appendReaderCheckpoint({
    kind:'article',
    path:_articlePath,
    choiceMemory:_articleChoiceMemory,
    interactionSelections:_articleInteractionSelections,
    checkpoints:_articleCheckpoints,
  }, {
    id:checkpointId,
    sourceNodeId:sourceNodeId,
    label:label || '选择点',
    path:path,
    choiceMemory:memory,
    interactionSelections:interactionSelections,
  }, Date.now())
  if (progress) _articleCheckpoints = progress.checkpoints
}

function syncLegacyReaderBooks() {
  var library = getReaderLibraryState()
  var known = new Set(library.books.map(function(book) { return book.id }))
  var changed = false
  getRecents().slice().reverse().forEach(function(recent) {
    if (!recent || typeof recent.id !== 'string' || !recent.id || known.has(recent.id)) return
    var cached = null
    try { cached = JSON.parse(localStorage.getItem('moirain_work_' + recent.id)) } catch (_) {}
    if (!cached) return
    library = rememberReaderWork(library, cached, recent.importedAt || Date.now())
    known.add(recent.id)
    changed = true
  })
  if (changed) commitReaderLibraryState(library)
  return library
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

function currentReaderScrollY() {
  return Number(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)
}

function captureArticleReadingPosition() {
  if (!document.querySelector('.article-reader')) return null
  var scrollY = currentReaderScrollY()
  var viewportHeight = Number(window.innerHeight || document.documentElement.clientHeight || 0)
  var candidates = Array.from(document.querySelectorAll('.article-node[data-article-path-index]'))
    .flatMap(function(articleNode) {
      return Array.from(articleNode.querySelectorAll(ARTICLE_READING_ANCHOR_SELECTOR))
    })
  var visibleCandidates = candidates.filter(function(candidate) {
    var rect = candidate.getBoundingClientRect()
    return rect.bottom >= 0 && (!viewportHeight || rect.top <= viewportHeight)
  })
  var anchor = (visibleCandidates.length ? visibleCandidates : candidates).sort(function(left, right) {
    return Math.abs(left.getBoundingClientRect().top) - Math.abs(right.getBoundingClientRect().top)
  })[0]
  if (!anchor) return {scrollY:scrollY, pathIndex:null, anchorIndex:null, viewportTop:0, element:null}
  var articleNode = anchor.closest('.article-node[data-article-path-index]')
  var nodeAnchors = articleNode
    ? Array.from(articleNode.querySelectorAll(ARTICLE_READING_ANCHOR_SELECTOR))
    : []
  return {
    scrollY:scrollY,
    pathIndex:articleNode ? Number(articleNode.dataset.articlePathIndex) : null,
    anchorIndex:nodeAnchors.indexOf(anchor),
    viewportTop:Number(anchor.getBoundingClientRect().top || 0),
    element:anchor,
  }
}

function restoreArticleReadingPosition(position) {
  if (!position) return
  requestAnimationFrame(function() {
    var anchor = position.element && position.element.isConnected ? position.element : null
    if (!anchor && Number.isInteger(position.pathIndex) && Number.isInteger(position.anchorIndex)) {
      var articleNode = document.querySelector(
        '.article-node[data-article-path-index="' + position.pathIndex + '"]',
      )
      if (articleNode) {
        anchor = articleNode.querySelectorAll(ARTICLE_READING_ANCHOR_SELECTOR)[position.anchorIndex] || null
      }
    }
    var nextScrollY = Number(position.scrollY || 0)
    if (anchor) {
      nextScrollY = currentReaderScrollY()
        + Number(anchor.getBoundingClientRect().top || 0)
        - Number(position.viewportTop || 0)
    }
    if (Math.abs(nextScrollY - currentReaderScrollY()) < 0.5) return
    window.scrollTo({top:Math.max(0, nextScrollY), left:0, behavior:'auto'})
  })
}

function persistedArticleReadingPosition() {
  var position = captureArticleReadingPosition()
  if (!position || !Number.isInteger(position.pathIndex) || !Number.isInteger(position.anchorIndex)) return null
  return {
    kind:'article',
    pathIndex:position.pathIndex,
    anchorIndex:position.anchorIndex,
    viewportTop:Number(position.viewportTop || 0),
    scrollY:Number(position.scrollY || 0),
  }
}

function phoneReadingScrollContainer() {
  if (_readerPhoneLocation?.view === 'chat') return document.querySelector('#chatMsgArea')
  return document.querySelector('.rd-phone-app-body')
}

function phoneReadingAnchor(container) {
  if (!container || _readerPhoneLocation?.view !== 'chat') return null
  var containerRect = container.getBoundingClientRect()
  var candidates = Array.from(container.querySelectorAll('[data-message-id]'))
  var visible = candidates.filter(function(candidate) {
    var rect = candidate.getBoundingClientRect()
    return rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
  })
  return (visible.length ? visible : candidates).sort(function(left, right) {
    return Math.abs(left.getBoundingClientRect().top - containerRect.top)
      - Math.abs(right.getBoundingClientRect().top - containerRect.top)
  })[0] || null
}

function persistedPhoneReadingPosition() {
  if (!_readerPhoneLocation?.appType) return null
  var container = phoneReadingScrollContainer()
  var anchor = phoneReadingAnchor(container)
  var containerTop = container ? Number(container.getBoundingClientRect().top || 0) : 0
  return {
    kind:'phone',
    appType:_readerPhoneLocation.appType,
    view:_readerPhoneLocation.view === 'chat' ? 'chat' : 'app',
    itemId:_readerPhoneLocation.itemId || '',
    contactIndex:Number.isInteger(_readerPhoneLocation.contactIndex)
      ? _readerPhoneLocation.contactIndex
      : -1,
    scrollTop:container ? Number(container.scrollTop || 0) : 0,
    anchorId:String(anchor?.dataset?.messageId || ''),
    anchorOffset:anchor ? Number(anchor.getBoundingClientRect().top || 0) - containerTop : 0,
  }
}

function currentReaderReadingPosition() {
  if (!_work) return null
  var captured = _work.type === 'phone'
    ? persistedPhoneReadingPosition()
    : persistedArticleReadingPosition()
  if (captured) return captured
  if (_readerPendingReadingPosition?.kind === (_work.type === 'phone' ? 'phone' : 'article')) {
    return _readerPendingReadingPosition
  }
  return null
}

function restorePhoneReadingScroll(position, container) {
  if (!position || !container) return
  requestAnimationFrame(function() {
    var anchor = position.anchorId
      ? Array.from(container.querySelectorAll('[data-message-id]')).find(function(candidate) {
        return candidate.dataset.messageId === position.anchorId
      })
      : null
    var nextScrollTop = Number(position.scrollTop || 0)
    if (anchor) {
      var containerTop = Number(container.getBoundingClientRect().top || 0)
      nextScrollTop = Number(container.scrollTop || 0)
        + Number(anchor.getBoundingClientRect().top || 0)
        - containerTop
        - Number(position.anchorOffset || 0)
    }
    container.scrollTop = Math.max(0, nextScrollTop)
  })
}

function scheduleReaderPositionSave() {
  if (!_readerPersistenceEnabled || !_work?.id) return
  if (_readerPositionSaveTimer) clearTimeout(_readerPositionSaveTimer)
  _readerPositionSaveTimer = setTimeout(function() {
    _readerPositionSaveTimer = null
    saveCurrentReaderProgress()
  }, READER_POSITION_SAVE_DELAY)
  if (_readerPositionSaveTimer && typeof _readerPositionSaveTimer.unref === 'function') {
    _readerPositionSaveTimer.unref()
  }
}

function flushReaderPositionSave() {
  if (_readerPositionSaveTimer) clearTimeout(_readerPositionSaveTimer)
  _readerPositionSaveTimer = null
  if (!_work || !document.querySelector('.article-reader, .phone-reader')) return false
  return saveCurrentReaderProgress()
}

function bindPhoneReadingPosition(container) {
  if (!container || container.dataset.readerPositionBound === 'true') return
  container.dataset.readerPositionBound = 'true'
  container.addEventListener('scroll', scheduleReaderPositionSave, {passive:true})
}

window.addEventListener('scroll', function() {
  if (_work?.type !== 'phone' && document.querySelector('.article-reader')) scheduleReaderPositionSave()
}, {passive:true})
window.addEventListener('pagehide', flushReaderPositionSave)
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') flushReaderPositionSave()
})

function closeReaderUnlockedSearchPreview(restoreFocus) {
  if (!_readerUnlockedSearchPreview) return
  var resultButton = _readerUnlockedSearchPreview._resultButton || null
  _readerUnlockedSearchPreview.remove()
  _readerUnlockedSearchPreview = null
  if (restoreFocus !== false && resultButton && resultButton.isConnected && resultButton.focus) {
    resultButton.focus()
  }
}

function closeReaderUnlockedSearch(options) {
  var settings = options || {}
  closeReaderUnlockedSearchPreview(false)
  if (_readerUnlockedSearchPanel) _readerUnlockedSearchPanel.remove()
  _readerUnlockedSearchPanel = null
  var invoker = _readerUnlockedSearchInvoker
  var readingPosition = _readerUnlockedSearchPosition
  _readerUnlockedSearchInvoker = null
  _readerUnlockedSearchPosition = null
  if (settings.restorePosition !== false) restoreArticleReadingPosition(readingPosition)
  if (settings.restoreFocus !== false && invoker && invoker.isConnected && invoker.focus) invoker.focus()
}

function setArticleImmersiveToolbarVisible(visible) {
  var toolbar = document.querySelector('[data-reader-immersive-toolbar]')
  var reveal = document.querySelector('[data-reader-immersive-reveal]')
  if (!toolbar || !reveal) return
  toolbar.classList.toggle('is-visible', !!visible)
  toolbar.setAttribute('aria-hidden', visible ? 'false' : 'true')
  reveal.hidden = !!visible
  reveal.setAttribute('aria-expanded', visible ? 'true' : 'false')
  toolbar.querySelectorAll('button, [href], input, select, textarea, [tabindex]').forEach(function(control) {
    control.tabIndex = visible ? 0 : -1
  })
}

function cleanupArticleImmersiveToolbar() {
  if (_articleImmersiveScrollHandler) {
    window.removeEventListener('scroll', _articleImmersiveScrollHandler)
    _articleImmersiveScrollHandler = null
  }
  if (_articleImmersiveKeydownHandler) {
    document.removeEventListener('keydown', _articleImmersiveKeydownHandler)
    _articleImmersiveKeydownHandler = null
  }
  closeReaderUnlockedSearch({restoreFocus:false, restorePosition:false})
}

function substitutedReaderSearchWork(sourceWork, sourceValuesMap) {
  var placeholders = sourceWork && Array.isArray(sourceWork.placeholders) ? sourceWork.placeholders : []
  var valuesMap = sourceValuesMap || {}
  function replaceText(value) {
    return typeof value === 'string'
      ? substitutePlaceholders(value, placeholders, {valuesMap:valuesMap, usePlaceholderMode:false})
      : value
  }
  return Object.assign({}, sourceWork, {
    nodes:(sourceWork && Array.isArray(sourceWork.nodes) ? sourceWork.nodes : []).map(function(node) {
      return Object.assign({}, node, {
        title:replaceText(node.title),
        content:replaceText(node.content),
        choices:(Array.isArray(node.choices) ? node.choices : []).map(function(choice) {
          return Object.assign({}, choice, {
            text:replaceText(choice.text),
            selectedText:replaceText(choice.selectedText),
          })
        }),
        interactionGroups:(Array.isArray(node.interactionGroups) ? node.interactionGroups : []).map(function(group) {
          return Object.assign({}, group, {
            choices:(Array.isArray(group.choices) ? group.choices : []).map(function(choice) {
              return Object.assign({}, choice, {
                text:replaceText(choice.text),
                selectedText:replaceText(choice.selectedText),
              })
            }),
          })
        }),
      })
    }),
    phoneModules:(sourceWork && Array.isArray(sourceWork.phoneModules) ? sourceWork.phoneModules : []).map(function(module) {
      return Object.assign({}, module, {
        data:substitutePhoneTextData(module.data || {}, placeholders, {
          valuesMap:valuesMap,
          usePlaceholderMode:false,
        }),
      })
    }),
  })
}

function substitutedUnlockedSearchWork() {
  return substitutedReaderSearchWork(_work, _work && _work.readerPhValues || {})
}

function appendReaderSearchSnippet(container, snippet) {
  container.appendChild(document.createTextNode(snippet.before || ''))
  var mark = document.createElement('mark')
  mark.textContent = snippet.match || ''
  container.appendChild(mark)
  container.appendChild(document.createTextNode(snippet.after || ''))
}

function openReaderUnlockedSearchPreview(entry, resultButton) {
  closeReaderUnlockedSearchPreview(false)
  var overlay = document.createElement('div')
  overlay.className = 'rd-reader-search-preview'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'rdReaderSearchPreviewTitle')
  overlay._resultButton = resultButton

  var card = document.createElement('section')
  card.className = 'rd-reader-search-preview-card'
  var header = document.createElement('header')
  var heading = document.createElement('div')
  var location = document.createElement('span')
  location.className = 'rd-reader-search-preview-location'
  location.textContent = [entry.kindLabel, entry.location].filter(Boolean).join(' · ')
  var title = document.createElement('h2')
  title.id = 'rdReaderSearchPreviewTitle'
  title.textContent = entry.title || entry.kindLabel || '搜索结果'
  heading.append(location, title)
  var closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'rd-reader-search-close'
  closeButton.dataset.readerSearchPreviewClose = ''
  closeButton.setAttribute('aria-label', '关闭预览')
  closeButton.textContent = '×'
  header.append(heading, closeButton)

  var body = document.createElement('div')
  body.className = 'rd-reader-search-preview-body'
  body.textContent = entry.text || ''
  var note = document.createElement('p')
  note.className = 'rd-reader-search-preview-note'
  note.textContent = '仅供回看，不会改变当前路线'
  card.append(header, body, note)
  overlay.appendChild(card)
  document.body.appendChild(overlay)
  _readerUnlockedSearchPreview = overlay
  closeButton.onclick = function() { closeReaderUnlockedSearchPreview(true) }
  overlay.onclick = function(event) {
    if (event.target === overlay) closeReaderUnlockedSearchPreview(true)
  }
  overlay.onkeydown = function(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeReaderUnlockedSearchPreview(true)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      closeButton.focus()
    }
  }
  closeButton.focus()
}

function openReaderUnlockedSearch(trigger) {
  if (!_work || _work.type !== 'article' || !document.querySelector('.article-reader')) return
  if (_readerUnlockedSearchPanel) {
    setArticleImmersiveToolbarVisible(true)
    var existingInput = _readerUnlockedSearchPanel.querySelector('[data-reader-unlocked-search-input]')
    if (existingInput) existingInput.focus()
    return
  }
  _readerUnlockedSearchInvoker = trigger && trigger.isConnected
    ? trigger
    : document.querySelector('[data-reader-search]')
  _readerUnlockedSearchPosition = captureArticleReadingPosition()
  setArticleImmersiveToolbarVisible(true)

  var panel = document.createElement('section')
  panel.className = 'rd-reader-search-panel'
  panel.setAttribute('aria-label', '搜索已解锁内容')
  panel.innerHTML = [
    '<header class="rd-reader-search-header">',
    '<div><strong>搜索已解锁内容</strong><small>不会显示未走过的剧情</small></div>',
    '<button type="button" class="rd-reader-search-close" data-reader-search-close aria-label="关闭搜索">×</button>',
    '</header>',
    '<label class="rd-reader-search-field">',
    '<span class="sr-only">搜索关键词</span>',
    '<input type="search" data-reader-unlocked-search-input autocomplete="off" placeholder="搜索正文、消息、论坛和备忘录">',
    '</label>',
    '<p class="rd-reader-search-status" role="status" aria-live="polite">输入关键词开始搜索</p>',
    '<div class="rd-reader-search-results"></div>',
  ].join('')
  document.body.appendChild(panel)
  _readerUnlockedSearchPanel = panel

  var index = buildUnlockedReaderSearchIndex(substitutedUnlockedSearchWork(), _articlePath, {
    choiceMemory:_articleChoiceMemory,
    interactionSelections:_articleInteractionSelections,
  })
  var input = panel.querySelector('[data-reader-unlocked-search-input]')
  var status = panel.querySelector('.rd-reader-search-status')
  var results = panel.querySelector('.rd-reader-search-results')
  panel.querySelector('[data-reader-search-close]').onclick = function() {
    closeReaderUnlockedSearch({restoreFocus:true, restorePosition:true})
  }
  input.oninput = function() {
    var query = input.value.trim()
    results.replaceChildren()
    if (!query) {
      status.textContent = '输入关键词开始搜索'
      return
    }
    var matches = searchUnlockedReaderIndex(index, query)
    if (!matches.length) {
      status.textContent = '已解锁内容中没有找到“' + query + '”'
      return
    }
    status.textContent = '找到 ' + matches.length + ' 处已解锁内容'
    matches.forEach(function(entry) {
      var button = document.createElement('button')
      button.type = 'button'
      button.className = 'rd-reader-search-result'
      button.dataset.readerSearchResult = ''
      var meta = document.createElement('span')
      meta.className = 'rd-reader-search-result-meta'
      meta.textContent = [entry.kindLabel, entry.location].filter(Boolean).join(' · ')
      var heading = document.createElement('strong')
      heading.textContent = entry.title || entry.kindLabel
      var snippet = document.createElement('span')
      snippet.className = 'rd-reader-search-result-snippet'
      appendReaderSearchSnippet(snippet, entry.snippet || {})
      button.append(meta, heading, snippet)
      button.onclick = function() { openReaderUnlockedSearchPreview(entry, button) }
      results.appendChild(button)
    })
  }
  input.focus()
}

function bindArticleImmersiveToolbar() {
  cleanupArticleImmersiveToolbar()
  var articleReader = document.querySelector('.article-reader')
  var toolbar = document.querySelector('[data-reader-immersive-toolbar]')
  var reveal = document.querySelector('[data-reader-immersive-reveal]')
  if (!articleReader || !toolbar || !reveal) return
  setArticleImmersiveToolbarVisible(true)
  articleReader.onclick = function(event) {
    var selection = window.getSelection && window.getSelection()
    if (selection && String(selection).trim()) return
    if (event.target.closest('button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], .rd-pm-trigger, .rd-interactive-scene-trigger')) return
    setArticleImmersiveToolbarVisible(toolbar.getAttribute('aria-hidden') === 'false' ? false : true)
  }
  reveal.onclick = function() {
    setArticleImmersiveToolbarVisible(true)
    var firstControl = toolbar.querySelector('button')
    if (firstControl) firstControl.focus()
  }
  _articleImmersiveScrollHandler = function() {
    if (!_readerUnlockedSearchPanel && !_readerUnlockedSearchPreview) {
      setArticleImmersiveToolbarVisible(false)
    }
  }
  window.addEventListener('scroll', _articleImmersiveScrollHandler, {passive:true})
  _articleImmersiveKeydownHandler = function(event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'f') {
      event.preventDefault()
      setArticleImmersiveToolbarVisible(true)
      openReaderUnlockedSearch(document.querySelector('[data-reader-search]'))
      return
    }
    if (event.key !== 'Escape') return
    if (_readerUnlockedSearchPreview) {
      event.preventDefault()
      closeReaderUnlockedSearchPreview(true)
      return
    }
    if (_readerUnlockedSearchPanel) {
      event.preventDefault()
      closeReaderUnlockedSearch({restoreFocus:true, restorePosition:true})
      return
    }
    setArticleImmersiveToolbarVisible(false)
  }
  document.addEventListener('keydown', _articleImmersiveKeydownHandler)
}

function cloneArticleReaderValue(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return fallback
  }
}

function captureArticleChoiceUndoSnapshot(choiceButton) {
  return {
    workId:String(_work?.id || ''),
    path:_articlePath.slice(),
    choiceMemory:cloneArticleReaderValue(_articleChoiceMemory, {}),
    interactionSelections:cloneArticleReaderValue(_articleInteractionSelections, {}),
    checkpoints:cloneArticleReaderValue(_articleCheckpoints, []),
    readingPosition:captureArticleReadingPosition(),
    choiceId:String(choiceButton?.dataset.choiceId || ''),
    choiceNodeId:String(choiceButton?.dataset.choiceNodeId || ''),
    choiceMode:String(choiceButton?.dataset.choiceMode || ''),
  }
}

function articleChoiceStateChanged(snapshot) {
  if (!snapshot) return false
  return JSON.stringify([
    snapshot.path,
    snapshot.choiceMemory,
    snapshot.interactionSelections,
  ]) !== JSON.stringify([
    _articlePath,
    _articleChoiceMemory,
    _articleInteractionSelections,
  ])
}

function clearArticleChoiceUndo() {
  if (_articleChoiceUndoTimer) clearTimeout(_articleChoiceUndoTimer)
  _articleChoiceUndoTimer = null
  if (_articleChoiceUndoBar) _articleChoiceUndoBar.remove()
  _articleChoiceUndoBar = null
}

function beginArticleChoiceCommit(choiceButton) {
  if (!choiceButton || choiceButton.dataset.choiceCommitLocked === 'true') return false
  choiceButton.dataset.choiceCommitLocked = 'true'
  var releaseTimer = setTimeout(function() {
    if (choiceButton) delete choiceButton.dataset.choiceCommitLocked
  }, ARTICLE_CHOICE_COMMIT_GUARD_DURATION)
  if (releaseTimer && typeof releaseTimer.unref === 'function') {
    releaseTimer.unref()
  }
  return true
}

function offerArticleChoiceUndo(snapshot, rawLabel) {
  if (!articleChoiceStateChanged(snapshot)) {
    _articleCheckpoints = cloneArticleReaderValue(snapshot?.checkpoints, [])
    saveCurrentReaderProgress()
    return
  }
  clearArticleChoiceUndo()
  var label = String(rawLabel || '这个选择').replace(/\s+/g, ' ').replace(/^\d+\.\s*/, '').trim()
  var bar = document.createElement('div')
  bar.className = 'rd-article-choice-undo'
  bar.setAttribute('role', 'status')
  bar.setAttribute('aria-live', 'polite')
  var message = document.createElement('span')
  message.className = 'rd-article-choice-undo-message'
  message.textContent = label ? '已选择“' + label + '”' : '选择已记录'
  var undoButton = document.createElement('button')
  undoButton.type = 'button'
  undoButton.className = 'rd-article-choice-undo-action'
  undoButton.textContent = '撤回'
  bar.append(message, undoButton)
  document.body.appendChild(bar)
  _articleChoiceUndoBar = bar
  requestAnimationFrame(function() {
    if (bar.isConnected) bar.classList.add('is-visible')
  })
  undoButton.onclick = function() {
    if (!_work || String(_work.id || '') !== snapshot.workId) return clearArticleChoiceUndo()
    _articlePath = snapshot.path.slice()
    _articleChoiceMemory = cloneArticleReaderValue(snapshot.choiceMemory, {})
    _articleInteractionSelections = cloneArticleReaderValue(snapshot.interactionSelections, {})
    _articleCheckpoints = cloneArticleReaderValue(snapshot.checkpoints, [])
    _nodeId = _articlePath[_articlePath.length - 1] || null
    _visitedNodes = _articlePath.slice(0, -1)
    clearArticleChoiceUndo()
    renderArticleReader()
    restoreArticleReadingPosition(snapshot.readingPosition)
    requestAnimationFrame(function() {
      var restoredChoice = Array.from(document.querySelectorAll('.article-choice-btn')).find(function(candidate) {
        return candidate.dataset.choiceNodeId === snapshot.choiceNodeId
          && candidate.dataset.choiceId === snapshot.choiceId
      })
      if (restoredChoice && restoredChoice.focus) restoredChoice.focus()
    })
    showReaderToast('已撤回刚才的选择')
  }
  _articleChoiceUndoTimer = setTimeout(clearArticleChoiceUndo, ARTICLE_CHOICE_UNDO_DURATION)
  if (_articleChoiceUndoTimer && typeof _articleChoiceUndoTimer.unref === 'function') {
    _articleChoiceUndoTimer.unref()
  }
}

function resetArticleReaderSession() {
  cleanupArticleImmersiveToolbar()
  clearArticleChoiceUndo()
  _nodeId = null
  _visitedNodes = []
  _articlePath = []
  _articleChoiceMemory = {}
  _articleInteractionSelections = Object.create(null)
  _articleCheckpoints = []
}

function articleRuntimeOptions(memory, interactionSelections) {
  var selectedIds = new Set([
    ...selectedArticleChoiceIds(memory === undefined ? _articleChoiceMemory : memory),
    ...selectedArticleInteractionChoiceIds(
      interactionSelections === undefined ? _articleInteractionSelections : interactionSelections,
    ),
  ])
  return {
    selectedChoiceIds:selectedIds,
    isNodeVisible:function(node) {
      return node?.kind !== 'conditional'
        || articleDisplayConditionMatches(node.displayCondition, selectedIds)
    },
  }
}

function articlePathIdCounts(path) {
  return (path || []).reduce(function(counts, nodeId) {
    if (typeof nodeId === 'string' && nodeId) counts[nodeId] = (counts[nodeId] || 0) + 1
    return counts
  }, {})
}

function articleRouteStateForPath(previousPath, nextPath) {
  var previousCounts = articlePathIdCounts(previousPath)
  var retainedCounts = articlePathIdCounts(nextPath)
  var memory = pruneArticleChoiceMemory(_articleChoiceMemory, nextPath)
  var interactionSelections = pruneArticleInteractionSelections(_articleInteractionSelections, nextPath)
  var retained = new Set(nextPath)
  Object.keys(previousCounts).forEach(function(sourceNodeId) {
    if (previousCounts[sourceNodeId] <= (retainedCounts[sourceNodeId] || 0)) return
    delete memory[sourceNodeId]
  })
  return {memory:memory, interactionSelections:interactionSelections}
}

function applyArticleRouteState(nextPath, state) {
  _articlePath = nextPath
  _articleChoiceMemory = state.memory
  _articleInteractionSelections = state.interactionSelections
}

function pruneArticleReaderRouteState(previousPath) {
  applyArticleRouteState(_articlePath, articleRouteStateForPath(previousPath, _articlePath))
}

function replaceArticlePath(nextPath) {
  var previousPath = _articlePath.slice()
  _articlePath = nextPath
  pruneArticleReaderRouteState(previousPath)
}

function selectionPrefixState(sourcePathIndex, sourceNodeId) {
  if (!Number.isInteger(sourcePathIndex) || sourcePathIndex < 0 || _articlePath[sourcePathIndex] !== sourceNodeId) return null
  var path = _articlePath.slice(0, sourcePathIndex + 1)
  return {path:path, state:articleRouteStateForPath(_articlePath, path)}
}

function isExactArticleChoiceId(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function canRecordArticleChoice(sourceNodeId, choiceId) {
  if (!isExactArticleChoiceId(sourceNodeId) || !isExactArticleChoiceId(choiceId)) return false
  var sourceMatches = ((_work && _work.nodes) || []).filter(function(node) {
    return node?.id === sourceNodeId
  })
  if (sourceMatches.length !== 1) return false
  var matchingChoices = []
  ;((_work && _work.nodes) || []).forEach(function(node) {
    ;(node?.choices || []).forEach(function(choice) {
      if (choice?.id === choiceId) matchingChoices.push({node:node, choice:choice})
    })
  })
  return matchingChoices.length === 1 && matchingChoices[0].node === sourceMatches[0]
}

function candidateReaderArticleChoiceMemory(memory, sourceNodeId, choiceId) {
  if (!canRecordArticleChoice(sourceNodeId, choiceId)) return null
  return recordArticleChoice(memory, sourceNodeId, choiceId)
}

function readerArticleInteractionGroup(sourceNodeId, groupId) {
  if (!isExactArticleChoiceId(sourceNodeId) || !isExactArticleChoiceId(groupId)) return null
  var sourceMatches = ((_work && _work.nodes) || []).filter(function(node) {
    return node?.id === sourceNodeId
  })
  if (sourceMatches.length !== 1) return null
  var matches = []
  ;((_work && _work.nodes) || []).forEach(function(node) {
    ;(node?.interactionGroups || []).forEach(function(group) {
      if (group?.id === groupId) matches.push({node:node, group:group})
    })
  })
  return matches.length === 1 && matches[0].node === sourceMatches[0] ? matches[0].group : null
}

function canRecordArticleInteraction(sourceNodeId, groupId, choiceId) {
  var group = readerArticleInteractionGroup(sourceNodeId, groupId)
  if (!group || !isExactArticleChoiceId(choiceId)) return false
  var matches = []
  ;((_work && _work.nodes) || []).forEach(function(node) {
    ;(node?.interactionGroups || []).forEach(function(candidateGroup) {
      ;(candidateGroup?.choices || []).forEach(function(choice) {
        if (choice?.id === choiceId) matches.push({group:candidateGroup, choice:choice})
      })
    })
  })
  return matches.length === 1 && matches[0].group === group
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

// ====== HOME ======
function rememberReaderHomeContext(tab) {
  if (tab === 'personal' || tab === 'library' || tab === 'custom') _readerHomeTab = tab
  _readerHomeScrollY = currentReaderScrollY()
}

function restoreReaderHomeContext() {
  if (!_readerHomeRestoreScroll) return
  _readerHomeRestoreScroll = false
  var scrollY = Math.max(0, Number(_readerHomeScrollY) || 0)
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({top:scrollY, left:0, behavior:'auto'})
  } else {
    document.documentElement.scrollTop = scrollY
    document.body.scrollTop = scrollY
  }
}

function renderHome() {
  flushReaderPositionSave()
  _readerPendingReadingPosition = null
  _readerPhoneLocation = null
  _readerPersistenceEnabled = true
  resetArticleReaderSession()
  var activeTab = ['personal', 'library', 'custom'].includes(_readerHomeTab)
    ? _readerHomeTab
    : 'personal'
  var h = '<div class="rd-home">'
  h += '<header class="rd-product-header">'
  h += '<div class="rd-product-brand">Tuuru</div>'
  h += '<nav class="rd-mode-switch" aria-label="应用模式">'
  h += '<a class="rd-mode-link" href="' + escapeHtmlAttribute(editorHomeUrl()) + '">创作端</a>'
  h += '<span class="rd-mode-link active" aria-current="page">读者端</span>'
  h += '</nav></header>'
  // Tabs
  h += '<div class="rd-tabs" role="tablist" aria-label="首页栏目">'
  h += '<button type="button" class="rd-tab' + (activeTab === 'personal' ? ' active' : '') + '" id="rdTabPersonal" role="tab" aria-controls="tabPersonal" aria-selected="' + (activeTab === 'personal') + '" tabindex="' + (activeTab === 'personal' ? '0' : '-1') + '" data-tab="personal">个人主页</button>'
  h += '<button type="button" class="rd-tab' + (activeTab === 'library' ? ' active' : '') + '" id="rdTabLibrary" role="tab" aria-controls="tabLibrary" aria-selected="' + (activeTab === 'library') + '" tabindex="' + (activeTab === 'library' ? '0' : '-1') + '" data-tab="library">书架</button>'
  h += '<button type="button" class="rd-tab' + (activeTab === 'custom' ? ' active' : '') + '" id="rdTabCustom" role="tab" aria-controls="tabCustom" aria-selected="' + (activeTab === 'custom') + '" tabindex="' + (activeTab === 'custom' ? '0' : '-1') + '" data-tab="custom">美化</button>'
  h += '</div>'
  // Tab panels
  h += '<div class="rd-panel" id="tabPersonal" role="tabpanel" aria-labelledby="rdTabPersonal"' + (activeTab === 'personal' ? '' : ' style="display:none" hidden') + '>' + renderPersonalPage() + '</div>'
  h += '<div class="rd-panel"' + (activeTab === 'library' ? '' : ' style="display:none"') + ' id="tabLibrary" role="tabpanel" aria-labelledby="rdTabLibrary"' + (activeTab === 'library' ? '' : ' hidden') + '>' + renderBookshelfPage() + '</div>'
  h += '<div class="rd-panel"' + (activeTab === 'custom' ? '' : ' style="display:none"') + ' id="tabCustom" role="tabpanel" aria-labelledby="rdTabCustom"' + (activeTab === 'custom' ? '' : ' hidden') + '>' + renderCustomPage() + '</div>'
  h += '<div style="text-align:center;padding:16px;margin-top:20px;font-size:.6rem;color:var(--c-text2);opacity:.3"><a href="https://tuuru.chat" target="_blank" style="color:inherit;text-decoration:none">tuuru.chat</a></div>'
  h += '</div>'
  render('app', h)
  bindPersonalPage(document)
  bindBookshelfPage(document)

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
    _readerHomeTab = tab
    if (moveFocus) t.focus()
    if (tab === 'personal') refreshPersonalPage()
    if (tab === 'library') refreshBookshelfPage()
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
  restoreReaderHomeContext()
}

document.addEventListener('click', function(event) {
  var target = event.target && event.target.closest ? event.target : null
  if (!target) return

  var libraryTrigger = target.closest('[data-reader-library]')
  if (libraryTrigger) {
    event.preventDefault()
    _activeReaderCollectionId = ''
    _readerHomeTab = 'library'
    _readerHomeRestoreScroll = true
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
      clearArticleChoiceUndo()
      replaceArticlePath(previousPath)
      _nodeId = _articlePath[_articlePath.length - 1]
      _visitedNodes = _articlePath.slice(0, -1)
      renderArticleReader()
    }
    return
  }

  var nextTrigger = target.closest('[data-reader-next]')
  if (nextTrigger) {
    event.preventDefault()
    var nextChapter = nextArticleChapterPath(
      (_work && _work.nodes) || [],
      (_work && _work.chapters) || [],
      _articlePath,
      articleRuntimeOptions(),
    )
    if (nextChapter.ok) {
      clearArticleChoiceUndo()
      replaceArticlePath(nextChapter.path)
      _nodeId = _articlePath[_articlePath.length - 1]
      _visitedNodes = _articlePath.slice(0, -1)
      renderArticleReader()
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
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
    if (_activeReaderCollectionId) {
      renderReaderCollectionById(_activeReaderCollectionId)
      return
    }
    _readerHomeRestoreScroll = true
    renderHome()
    return
  }

  var recentTrigger = target.closest('[data-reader-recent-index]')
  if (!recentTrigger) return
  if (recentTrigger.hasAttribute('data-reader-book-index')) return
  var recentIndex = Number(recentTrigger.dataset.readerRecentIndex)
  if (!Number.isInteger(recentIndex) || recentIndex < 0 || recentIndex >= _renderedRecentIds.length) return
  event.preventDefault()
  reimportRecent(_renderedRecentIds[recentIndex])
})

// ====== Personal Page ======
function renderPersonalPage() {
  var profile = getProfile()
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

function cachedReaderWork(workId) {
  try { return JSON.parse(localStorage.getItem('moirain_work_' + workId)) } catch (_) { return null }
}

function readerBookProgressLabel(book) {
  if (!book || !book.progress) return '开始阅读'
  if (book.progress.kind === 'phone') {
    return book.progress.flowIndex > 0 ? '继续第 ' + (book.progress.flowIndex + 1) + ' 步' : '继续阅读'
  }
  var visited = Array.isArray(book.progress.path) ? book.progress.path.length : 0
  return visited > 1 ? '继续阅读 · 已走过 ' + visited + ' 段' : '继续阅读'
}

function readerBookStatusLabel(book) {
  return ({
    unread:'未开始',
    reading:'阅读中',
    completed:'已完成',
  })[readerBookStatus(book)] || '未开始'
}

function readerBookPinOrder(left, right) {
  var leftPinnedAt = Number(left?.pinnedAt) || 0
  var rightPinnedAt = Number(right?.pinnedAt) || 0
  if (leftPinnedAt && rightPinnedAt) return rightPinnedAt - leftPinnedAt
  if (leftPinnedAt) return -1
  if (rightPinnedAt) return 1
  return 0
}

function sortedReaderBooks(books) {
  var sorted = (books || []).slice()
  if (_readerShelfSort === 'title') {
    sorted.sort(function(a, b) {
      return readerBookPinOrder(a, b)
        || String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
    })
  } else if (_readerShelfSort === 'added') {
    sorted.sort(function(a, b) {
      return readerBookPinOrder(a, b) || (b.addedAt || 0) - (a.addedAt || 0)
    })
  } else if (_readerShelfSort === 'status') {
    var order = {reading:0, unread:1, completed:2}
    sorted.sort(function(a, b) {
      return readerBookPinOrder(a, b)
        || order[readerBookStatus(a)] - order[readerBookStatus(b)]
        || (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)
    })
  } else {
    sorted.sort(readerBookPinOrder)
  }
  return sorted
}

function currentReaderDataPackageInput() {
  return {
    library:getReaderLibraryState(),
    profile:getProfile(),
    placeholderPresets:getPlaceholders(),
    appearance:{
      article:getReaderSettings(),
      phone:getPhoneCustom(),
    },
  }
}

function installReaderDataPackage(candidate) {
  var merged = mergeReaderDataPackage(currentReaderDataPackageInput(), candidate)
  var values = new Map([
    ['moirain_readerLibrary', JSON.stringify(merged.library)],
    ['moirain_profile', JSON.stringify(merged.profile)],
    ['moirain_placeholders', JSON.stringify(merged.placeholderPresets)],
    ['moirain_readerSettings', JSON.stringify(merged.appearance.article)],
    ['moirain_phoneCustom', JSON.stringify(merged.appearance.phone)],
  ])
  var previous = new Map()
  values.forEach(function(_, key) { previous.set(key, localStorage.getItem(key)) })
  try {
    values.forEach(function(value, key) { localStorage.setItem(key, value) })
  } catch (error) {
    previous.forEach(function(value, key) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch (_) {}
    })
    throw error
  }
  applyReaderCustomFonts(merged.appearance.article)
  applyCompiledReaderStyle(
    merged.appearance.article.customCss,
    '.reader-article-css-scope',
    'reader-article-user-css',
  )
  applyCustomFonts()
  applyPhoneCustomCss(merged.appearance.phone)
  return merged
}

function readerDataPanelMarkup() {
  return '<section id="rdReaderDataPanel" class="rd-reader-data-panel" data-reader-data-panel aria-labelledby="rdReaderDataTitle"' +
    (_readerDataPanelOpen ? '' : ' hidden') + '>' +
    '<div class="rd-reader-data-intro"><div><h3 id="rdReaderDataTitle">阅读数据备份</h3>' +
    '<p>备份阅读进度、身份组、占位符、书签和便携外观设置。</p></div>' +
    '<p class="rd-reader-data-private">不包含作品正文、密码、图片、头像、字体或缓存。</p></div>' +
    '<div class="rd-reader-data-actions">' +
    '<button type="button" class="rd-reader-data-action primary" data-reader-data-export>导出备份</button>' +
    '<button type="button" class="rd-reader-data-action" data-reader-data-import>选择备份</button>' +
    '<input type="file" data-reader-data-file accept=".json,application/json" hidden>' +
    '</div>' +
    '<div class="rd-reader-data-preview" data-reader-data-preview hidden>' +
    '<div><strong data-reader-data-books>0</strong><span>本书</span></div>' +
    '<div><strong data-reader-data-slots>0</strong><span>个存档</span></div>' +
    '<div><strong data-reader-data-identities>0</strong><span>组身份</span></div>' +
    '<div><strong data-reader-data-bookmarks>0</strong><span>个书签</span></div>' +
    '<p>同一存档会保留更新时间较新的版本；昵称、预设与便携外观按备份恢复。</p>' +
    '<button type="button" class="rd-reader-data-action primary" data-reader-data-apply hidden>合并恢复</button>' +
    '</div>' +
    '<p class="rd-reader-data-status" data-reader-data-status role="status" aria-live="polite">' +
    esc(_readerDataStatusMessage) + '</p></section>'
}

function renderBookshelfPage() {
  var library = syncLegacyReaderBooks()
  var collections = getReaderCollections()
  var books = sortedReaderBooks(library.books)
  var normalizedQuery = String(_readerShelfQuery || '').trim().toLocaleLowerCase('zh-CN')
  _renderedBookIds = books.map(function(book) { return book.id })
  _renderedRecentIds = _renderedBookIds.slice()
  _renderedCollectionIds = collections.map(function(collection) { return collection.id })
  var h = '<div class="rd-bookshelf">'
  h += '<div class="rd-bookshelf-head"><div><h2>我的书架</h2><p>阅读进度与本书占位符只保存在这台设备。</p></div>'
  h += '<div class="rd-bookshelf-head-actions">'
  h += '<button type="button" class="rd-reader-data-toggle" data-reader-data-toggle aria-controls="rdReaderDataPanel" aria-expanded="' +
    (_readerDataPanelOpen ? 'true' : 'false') + '">阅读数据</button>'
  h += '<button type="button" class="rd-bookshelf-import" data-reader-open-import>导入作品</button></div></div>'
  h += readerDataPanelMarkup()

  if (library.books.length === 0) {
    h += '<div class="rd-bookshelf-empty"><span class="rd-bookshelf-empty-mark" aria-hidden="true">◇</span>'
    h += '<strong>书架还是空的</strong><p>导入作品后，它会连同阅读进度一起留在这里。</p>'
    h += '<button type="button" class="drop-btn" data-reader-open-import>导入第一本作品</button></div>'
  } else {
    h += '<p class="rd-bookshelf-hint">点按继续阅读；长按封面或使用封面右上角按钮，可修改本书的占位符与进度。</p>'
    if (library.books.length > 6) {
      h += '<div class="rd-bookshelf-tools">'
      h += '<label class="rd-bookshelf-search"><span class="sr-only">搜索书架</span><input type="search" data-reader-shelf-search value="' + escapeHtmlAttribute(_readerShelfQuery) + '" placeholder="搜索书名或作者" autocomplete="off"></label>'
      h += '<label class="rd-bookshelf-sort"><span>排序</span><select data-reader-shelf-sort>'
      ;[
        ['recent', '最近阅读'],
        ['title', '书名'],
        ['added', '导入时间'],
        ['status', '阅读状态'],
      ].forEach(function(option) {
        h += '<option value="' + option[0] + '"' + (_readerShelfSort === option[0] ? ' selected' : '') + '>' + option[1] + '</option>'
      })
      h += '</select></label></div>'
    }
    h += '<div class="rd-bookshelf-grid">'
    books.forEach(function(book, bookIndex) {
      var cached = !!cachedReaderWork(book.id)
      var title = book.title || '无标题作品'
      var searchText = [title, book.author || ''].join(' ').toLocaleLowerCase('zh-CN')
      var hidden = normalizedQuery && !searchText.includes(normalizedQuery)
      h += '<article class="rd-book' + (cached ? '' : ' is-missing') + '" data-reader-book-id="' + escapeHtmlAttribute(book.id) + '" data-reader-book-search="' + escapeHtmlAttribute(searchText) + '"' + (hidden ? ' hidden' : '') + '>'
      h += '<div class="rd-book-cover-wrap">'
      h += '<button type="button" class="rd-book-cover rd-recent-item" data-reader-book-index="' + bookIndex + '" data-reader-recent-index="' + bookIndex + '" data-reader-book-cover-id="' + escapeHtmlAttribute(book.id) + '" aria-label="' + escapeHtmlAttribute((book.pinnedAt ? '已置顶，' : '') + (book.unseenUpdateAt ? '已更新，' : '') + (book.progress ? '继续阅读《' : '打开《') + title + '》') + '">'
      if (book.unseenUpdateAt) h += '<span class="rd-book-updated" aria-hidden="true">已更新</span>'
      h += '<span class="rd-book-cover-type">' + (book.type === 'phone' ? '小手机' : '互动文章') + '</span>'
      h += '<span class="rd-book-cover-title">' + esc(title) + '</span>'
      h += '<span class="rd-book-cover-author">' + esc(book.author || '佚名') + '</span>'
      h += '<span class="rd-book-cover-rule" aria-hidden="true"></span></button>'
      h += '<button type="button" class="rd-book-manage" data-reader-book-manage="' + bookIndex + '" data-reader-book-manage-id="' + escapeHtmlAttribute(book.id) + '" aria-label="' + escapeHtmlAttribute('管理《' + title + '》') + '" title="管理本书">•••</button>'
      h += '</div>'
      h += '<div class="rd-book-meta"><div class="rd-book-title-row"><strong>' + esc(title) + '</strong>'
      if (book.pinnedAt) h += '<span class="rd-book-pinned" aria-hidden="true">置顶</span>'
      h += '</div>'
      h += '<span class="rd-book-status" data-status="' + readerBookStatus(book) + '">' + readerBookStatusLabel(book) + '</span>'
      h += '<span>' + (cached ? readerBookProgressLabel(book) : '正文已清理 · 重新导入') + '</span>'
      h += '<time>' + esc(timeAgo(book.lastOpenedAt)) + '</time></div></article>'
    })
    h += '</div>'
    h += '<p class="rd-bookshelf-no-results"' + (normalizedQuery && !books.some(function(book) {
      return [book.title || '', book.author || ''].join(' ').toLocaleLowerCase('zh-CN').includes(normalizedQuery)
    }) ? '' : ' hidden') + '>没有找到这本书，换个关键词试试。</p>'
  }

  if (collections.length > 0) {
    h += '<section class="rd-bookshelf-collections"><h3>我的作品集</h3><div class="rd-collection-directory-list">'
    collections.forEach(function(collection, collectionIndex) {
      var count = Array.isArray(collection.workIds) ? collection.workIds.length : 0
      h += '<button type="button" class="rd-collection-directory-item" data-reader-collection-index="' + collectionIndex + '">'
      h += '<span class="rd-collection-number">' + String(collectionIndex + 1).padStart(2, '0') + '</span>'
      h += '<span><strong>' + esc(collection.title || '未命名作品集') + '</strong><small>' + esc(collection.description || collection.author || '作品集') + '</small></span>'
      h += '<span>' + count + ' 篇</span></button>'
    })
    h += '</div></section>'
  }
  h += '</div>'
  return h
}

function refreshBookshelfPage() {
  var panel = document.getElementById('tabLibrary')
  if (!panel) return
  refreshReorderedContent({
    container:panel,
    selector:'.rd-book[data-reader-book-id]',
    key:function(element) { return element.dataset.readerBookId },
    animate:shouldUseMotion(true, window),
    update:function() { panel.innerHTML = renderBookshelfPage() },
  })
  bindBookshelfPage(panel)
}

function closeReaderImportDialog(options) {
  options = options || {}
  var overlay = _readerImportOverlay
  var invoker = _readerImportInvoker
  var lifecycle = _readerImportDialogLifecycle
  _readerImportOverlay = null
  _readerImportInvoker = null
  _readerImportDialogLifecycle = null
  if (lifecycle) lifecycle.dispose({restoreFocus:options.restoreFocus !== false})
  if (overlay) overlay.remove()
  document.body.classList.remove('rd-import-open')
  if (!lifecycle && options.restoreFocus !== false && invoker && document.contains(invoker)) invoker.focus()
}

function openReaderImportDialog(invoker, options) {
  closeReaderImportDialog({restoreFocus:false})
  _readerImportInvoker = invoker && typeof invoker.focus === 'function'
    ? invoker
    : document.activeElement
  var recoveryBook = options && options.recoveryBook && options.recoveryBook.id
    ? options.recoveryBook
    : null

  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay rd-import-overlay'
  overlay.dataset.readerRecoveryWorkId = recoveryBook ? recoveryBook.id : ''
  overlay.innerHTML = '<section class="rd-import-dialog" role="dialog" aria-modal="true" aria-labelledby="rdImportTitle" aria-describedby="rdImportDescription" tabindex="-1">' +
    '<header class="rd-import-head"><div><span>' + (recoveryBook ? '恢复书架内容' : '添加到书架') + '</span><h2 id="rdImportTitle">' +
    (recoveryBook ? '重新导入 ' + esc(recoveryBook.title || '无标题作品') : '导入 Tuuru 作品') + '</h2></div>' +
    '<button type="button" class="rd-import-close" aria-label="关闭导入作品">×</button></header>' +
    renderImportPanel(recoveryBook) +
    '</section>'
  document.body.appendChild(overlay)
  document.body.classList.add('rd-import-open')
  _readerImportOverlay = overlay
  setupImport(overlay)

  var dialog = overlay.querySelector('.rd-import-dialog')
  var closeButton = overlay.querySelector('.rd-import-close')
  function close() { closeReaderImportDialog() }
  closeButton.onclick = close
  var primaryAction = overlay.querySelector('#pickFileBtn')
  _readerImportDialogLifecycle = installDialogInteraction({
    overlay:overlay,
    dialog:dialog,
    invoker:_readerImportInvoker,
    initialFocus:primaryAction || dialog,
    onRequestClose:close,
  })
}

function openReaderBookById(workId, options) {
  if (document.querySelector('.rd-home')) rememberReaderHomeContext('library')
  var work = cachedReaderWork(workId)
  if (!work) {
    var missingBook = savedReaderBook(workId)
    showReaderToast('作品正文未保存在浏览器中，请重新导入同一个文件后继续')
    openReaderImportDialog(document.activeElement, {recoveryBook:missingBook})
    return false
  }
  var prepared = prepareImportedWork(work)
  if (!prepared.ok) {
    alert(prepared.message)
    return false
  }
  work = prepared.work
  var book = savedReaderBook(workId)
  if (book?.unseenUpdateAt) {
    commitReaderLibraryState(dismissReaderWorkUpdate(getReaderLibraryState(), workId))
    book = savedReaderBook(workId)
  }
  if (book && Object.keys(book.placeholderValues || {}).length) {
    work.readerPhValues = cloneReaderPlaceholderValues(book.placeholderValues)
  }
  var restart = options && options.restart
  if (restart) clearReaderWorkProgress(workId)
  var hasReaderState = !!(book && (
    book.progress
    || Object.keys(book.placeholderValues || {}).length
  ))
  var canSkipLanding = !String(work.password || '').trim() && hasReaderState
  loadWork(work, {
    cachePrepared:true,
    skipLanding:canSkipLanding,
    resume:!restart,
  })
  return true
}

function readerBookByRenderedIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= _renderedBookIds.length) return null
  return savedReaderBook(_renderedBookIds[index])
}

function readerBookManagerValues(root, definitions) {
  var values = {}
  definitions.forEach(function(definition) {
    var input = Array.from(root.querySelectorAll('[data-reader-book-placeholder]')).find(function(candidate) {
      return candidate.dataset.readerBookPlaceholder === definition.id
    })
    values[definition.id] = [input ? input.value : '']
  })
  return values
}

function readerCachedWorkSize(workId) {
  var raw = localStorage.getItem('moirain_work_' + workId)
  if (!raw) return 0
  try { return new Blob([raw]).size } catch (_) { return raw.length * 2 }
}

function formatReaderStorageSize(bytes) {
  if (!bytes) return '未缓存正文'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function readerLocalStateId(prefix) {
  return [prefix, Date.now().toString(36), Math.random().toString(36).slice(2, 9)].join('-')
}

function readerSlotDisplayName(slot, index) {
  return String(slot?.name || '').trim() || ('存档 ' + (index + 1))
}

function readerSlotStatusLabel(slot) {
  if (slot?.completedAt) return '已完成'
  return slot?.progress ? '阅读中' : '未开始'
}

function readerIdentityValues(root, definitions) {
  var values = {}
  definitions.forEach(function(definition) {
    var key = definition.key || definition.label || definition.id
    var input = Array.from(root.querySelectorAll('[data-reader-identity-value]')).find(function(candidate) {
      return candidate.dataset.readerIdentityValue === key
    })
    values[key] = input ? input.value : ''
  })
  return values
}

function readerRouteComparisonHtml(work, book, leftSlotId, rightSlotId) {
  var leftSlot = (book.slots || []).find(function(slot) { return slot.id === leftSlotId })
  var rightSlot = (book.slots || []).find(function(slot) { return slot.id === rightSlotId })
  var rows = compareReaderSlots(work, leftSlot, rightSlot)
  if (!rows.length) {
    return '<p class="rd-book-manager-empty">这两条路线目前没有可比较的不同选择。</p>'
  }
  var h = '<div class="rd-route-differences">'
  rows.forEach(function(row) {
    h += '<div class="rd-route-difference"><strong>' + esc(row.location || '选择点') + '</strong>'
    h += '<div><span>' + esc(row.leftText) + '</span><span>' + esc(row.rightText) + '</span></div></div>'
  })
  return h + '</div>'
}

function focusReaderBookInvoker(workId, invoker) {
  if (invoker && invoker.isConnected && typeof invoker.focus === 'function') {
    invoker.focus()
    return
  }
  if (!invoker) return
  var manageControl = typeof invoker.hasAttribute === 'function'
    && invoker.hasAttribute('data-reader-book-manage')
  var attribute = manageControl ? 'readerBookManageId' : 'readerBookCoverId'
  var selector = manageControl
    ? '[data-reader-book-manage-id]'
    : '[data-reader-book-cover-id]'
  var replacement = Array.from(document.querySelectorAll(selector)).find(function(candidate) {
    return candidate.dataset?.[attribute] === workId
  })
  if (replacement && typeof replacement.focus === 'function') replacement.focus()
}

function openReaderBookManager(workId, invoker) {
  var book = savedReaderBook(workId)
  if (!book) return
  var work = cachedReaderWork(workId)
  var definitions = book.placeholderDefinitions || []
  var cacheBytes = readerCachedWorkSize(workId)
  var statusKey = readerBookStatus(book)
  var libraryState = getReaderLibraryState()
  var identities = libraryState.identities || []
  var activeSlot = readerActiveSlot(book)
  var activeSlotIndex = (book.slots || []).findIndex(function(slot) { return slot.id === activeSlot?.id })
  var activeIdentity = identities.find(function(identity) { return identity.id === activeSlot?.identityId }) || null
  var journeyDirectory = readerJourneyDirectory(work, activeSlot)
  var journeyPreviewByNodeId = new Map()
  if (work && activeSlot?.progress?.kind === 'article') {
    buildUnlockedReaderSearchIndex(
      substitutedReaderSearchWork(work, book.placeholderValues || {}),
      activeSlot.progress.path,
      {
        choiceMemory:activeSlot.progress.choiceMemory,
        interactionSelections:activeSlot.progress.interactionSelections,
      },
    ).forEach(function(entry) {
      if (entry.kind === 'article' && !journeyPreviewByNodeId.has(entry.nodeId)) {
        journeyPreviewByNodeId.set(entry.nodeId, entry)
      }
    })
  }
  var h = '<section class="rd-book-manager" role="dialog" aria-modal="true" aria-labelledby="rdBookManagerTitle">'
  h += '<header class="rd-book-manager-head"><div><span>书架管理</span><h2 id="rdBookManagerTitle">' + esc(book.title || '无标题作品') + '</h2></div>'
  h += '<button type="button" class="rd-book-manager-close" aria-label="关闭">×</button></header>'
  h += '<div class="rd-book-manager-body">'
  h += '<div class="rd-book-pin-row"><span><strong>书架置顶</strong><small data-reader-book-pin-note>' +
    (book.pinnedAt ? '已固定在其他作品前面' : '固定在其他作品前面') + '</small></span>'
  h += '<button type="button" class="rd-book-secondary" data-reader-book-pin aria-pressed="' +
    (book.pinnedAt ? 'true' : 'false') + '">' + (book.pinnedAt ? '取消置顶' : '置顶') + '</button></div>'
  h += '<section class="rd-book-manager-section"><div class="rd-book-manager-section-head"><h3>阅读存档</h3><span>' + book.slots.length + ' / 5</span></div>'
  h += '<div class="rd-reader-slot-toolbar"><label><span class="sr-only">当前阅读存档</span><select data-reader-slot-select>'
  book.slots.forEach(function(slot, index) {
    h += '<option value="' + escapeHtmlAttribute(slot.id) + '"' + (slot.id === activeSlot?.id ? ' selected' : '') + '>' + esc(readerSlotDisplayName(slot, index)) + ' · ' + readerSlotStatusLabel(slot) + '</option>'
  })
  h += '</select></label><button type="button" class="rd-book-secondary" data-reader-slot-manage aria-expanded="false">管理存档</button></div>'
  h += '<div class="rd-reader-slot-manage" hidden><div class="rd-reader-slot-manage-actions">'
  h += '<button type="button" class="rd-book-secondary" data-reader-slot-rename>重命名</button>'
  h += '<button type="button" class="rd-book-secondary" data-reader-slot-create' + (book.slots.length >= 5 ? ' disabled' : '') + '>新建周目</button>'
  h += '<button type="button" class="rd-book-danger" data-reader-slot-remove' + (book.slots.length <= 1 ? ' disabled' : '') + '>删除当前存档</button></div>'
  h += '<div class="rd-reader-slot-state"><span>当前状态：<strong class="rd-book-manager-state-label" data-status="' + statusKey + '">' + readerBookStatusLabel(book) + '</strong></span>'
  h += '<button type="button" class="rd-book-secondary" data-reader-book-completion>' + (statusKey === 'completed' ? '恢复为阅读中' : '标记已完成') + '</button></div>'
  h += '<div class="rd-reader-slot-editor" data-reader-slot-rename-panel hidden><label><span>存档名称</span><input type="text" data-reader-slot-name value="' + escapeHtmlAttribute(activeSlot?.name || '') + '" maxlength="500" placeholder="存档名称（可留空）"></label><div><button type="button" class="rd-book-secondary" data-reader-slot-edit-cancel>取消</button><button type="button" class="rd-book-primary" data-reader-slot-rename-save>保存</button></div></div>'
  h += '<div class="rd-reader-slot-editor" data-reader-slot-create-panel hidden><label><span>新周目名称</span><input type="text" data-reader-slot-new-name value="" maxlength="500" placeholder="存档名称（可留空）"></label><div><button type="button" class="rd-book-secondary" data-reader-slot-create-cancel>取消</button><button type="button" class="rd-book-primary" data-reader-slot-create-save>创建并切换</button></div></div>'
  h += '<div class="rd-book-remove-confirm" data-reader-slot-remove-confirm hidden><p>删除这个存档会移除它的进度、书签与足迹，其他存档不会受影响。</p><div><button type="button" class="rd-book-secondary" data-reader-slot-remove-cancel>取消</button><button type="button" class="rd-book-danger" data-reader-slot-remove-save>确认删除</button></div></div></div></section>'
  if (definitions.length) {
    h += '<section class="rd-book-manager-section"><div class="rd-book-manager-section-head"><h3>本书占位符</h3><span>自动保存到这本书</span></div>'
    h += '<div class="rd-reader-identity-toolbar">'
    h += '<label><span>阅读身份</span><select data-reader-identity-select><option value="">选择身份组</option>'
    identities.forEach(function(identity) {
      h += '<option value="' + escapeHtmlAttribute(identity.id) + '"' + (identity.id === activeIdentity?.id ? ' selected' : '') + '>' + esc(identity.name) + '</option>'
    })
    h += '<option value="__new__">＋ 新建身份组</option></select></label>'
    if (activeIdentity) {
      h += '<button type="button" class="rd-book-secondary" data-reader-identity-edit>编辑</button>'
    }
    h += '</div>'
    h += '<div class="rd-reader-identity-editor" hidden><label class="rd-book-manager-field"><span>身份组名称</span><input type="text" data-reader-identity-name value="" maxlength="500" placeholder="输入身份组名称"></label>'
    definitions.forEach(function(definition) {
      h += '<label class="rd-book-manager-field"><span>' + esc(definition.label || definition.id) + '</span><input type="text" data-reader-identity-value="' + escapeHtmlAttribute(definition.key || definition.label || definition.id) + '" value="" maxlength="500" placeholder="' + escapeHtmlAttribute(definition.prompt || '') + '"></label>'
    })
    h += '<div class="rd-reader-identity-editor-actions">'
    if (activeIdentity) h += '<button type="button" class="rd-book-danger" data-reader-identity-remove>删除身份组</button>'
    h += '<button type="button" class="rd-book-secondary" data-reader-identity-cancel>取消</button><button type="button" class="rd-book-primary" data-reader-identity-save>保存并应用</button></div></div>'
    definitions.forEach(function(definition) {
      var saved = book.placeholderValues?.[definition.id]?.[0]
      var value = typeof saved === 'string' ? saved : definition.default
      h += '<label class="rd-book-manager-field"><span>' + esc(definition.label || definition.id) + '</span>'
      h += '<input type="text" data-reader-book-placeholder="' + escapeHtmlAttribute(definition.id) + '" value="' + escapeHtmlAttribute(value || '') + '" placeholder="' + escapeHtmlAttribute(definition.prompt || '') + '"></label>'
    })
    h += '</section>'
  }
  if (book.bookmarks?.length) {
    h += '<section class="rd-book-manager-section"><div class="rd-book-manager-section-head"><h3>场景书签</h3><span>' + book.bookmarks.length + ' 个位置</span></div>'
    h += '<div class="rd-book-bookmarks">'
    book.bookmarks.forEach(function(bookmark) {
      h += '<div class="rd-book-bookmark-row"><button type="button" data-reader-book-bookmark="' + escapeHtmlAttribute(bookmark.id) + '"><span><strong>' + esc(bookmark.label || '阅读位置') + '</strong>' + (bookmark.updateStatus === 'moved' ? '<small class="rd-bookmark-update-note">原位置已变动，已定位到附近内容</small>' : '') + (bookmark.note ? '<small>' + esc(bookmark.note) + '</small>' : '') + '</span><time>' + esc(timeAgo(bookmark.savedAt)) + '</time></button>'
      h += '<button type="button" class="rd-book-bookmark-edit" data-reader-book-bookmark-edit="' + escapeHtmlAttribute(bookmark.id) + '" aria-label="' + escapeHtmlAttribute('编辑书签：' + (bookmark.label || '阅读位置')) + '">编辑</button>'
      h += '<button type="button" class="rd-book-bookmark-remove" data-reader-book-bookmark-remove="' + escapeHtmlAttribute(bookmark.id) + '" aria-label="' + escapeHtmlAttribute('删除书签：' + (bookmark.label || '阅读位置')) + '">×</button></div>'
      h += '<div class="rd-book-bookmark-editor" data-reader-book-bookmark-editor="' + escapeHtmlAttribute(bookmark.id) + '" hidden><label><span>书签名称</span><input type="text" data-reader-bookmark-label value="' + escapeHtmlAttribute(bookmark.label || '') + '" maxlength="500"></label><label><span>备注</span><textarea data-reader-bookmark-note maxlength="500" placeholder="写下想记住的内容">' + esc(bookmark.note || '') + '</textarea></label><div><button type="button" class="rd-book-secondary" data-reader-bookmark-edit-cancel>取消</button><button type="button" class="rd-book-primary" data-reader-bookmark-edit-save>保存备注</button></div></div>'
    })
    h += '</div></section>'
  }
  if (book.type === 'article') {
    var footprintCount = book.progress?.checkpoints?.length || 0
    var pathCount = book.progress?.path?.length || 0
    var hasRouteComparison = book.slots.length >= 2
    if (pathCount || journeyDirectory.length || hasRouteComparison) {
      h += '<section class="rd-book-manager-section"><details class="rd-reader-record">'
      h += '<summary><span><strong>阅读记录</strong><small>走过 ' + pathCount + ' 段 · ' + footprintCount + ' 个选择 · ' + journeyDirectory.length + ' 个片段</small></span><span aria-hidden="true">查看</span></summary>'
      h += '<div class="rd-reader-record-body">'
      if (footprintCount) {
        h += '<section><h4>返回选择点</h4><div class="rd-book-checkpoints">'
        book.progress.checkpoints.slice().reverse().forEach(function(checkpoint, index) {
          h += '<button type="button" data-reader-book-checkpoint="' + index + '"><span>' + esc(checkpoint.label || '选择点') + '</span><small>' + esc(timeAgo(checkpoint.savedAt)) + '</small></button>'
        })
        h += '</div></section>'
      }
      if (journeyDirectory.length) {
        h += '<section><h4>互动目录</h4><p class="rd-reader-record-note">只回看当前存档已经走过的片段，不会切换路线。</p>'
        h += '<ol class="rd-reader-journey-directory">'
        journeyDirectory.forEach(function(entry, index) {
          var locationLabel = [entry.chapterTitle || '未分章', entry.title].filter(Boolean).join(' · ')
          var decisionText = entry.decisions.map(function(decision) { return decision.label }).join(' · ')
          h += '<li><button type="button" class="rd-reader-journey-entry" data-reader-journey-entry="' + index + '" aria-label="' + escapeHtmlAttribute('回看第 ' + (index + 1) + ' 段：' + locationLabel) + '">'
          h += '<span class="rd-reader-journey-index" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>'
          h += '<span class="rd-reader-journey-copy"><span>' + esc(entry.chapterTitle || '未分章') + '</span><strong>' + esc(entry.title) + '</strong>'
          if (decisionText) h += '<small>当时选择：' + esc(decisionText) + '</small>'
          h += '</span><span class="rd-reader-journey-open" aria-hidden="true">回看</span></button></li>'
        })
        h += '</ol></section>'
      }
      if (hasRouteComparison) {
        var compareLeft = book.slots[0]
        var compareRight = book.slots[1]
        h += '<section><h4>路线差异</h4><p class="rd-reader-record-note">只比较两条路线已经做过的选择。</p>'
        h += '<div class="rd-route-compare-controls"><label><span>路线一</span><select data-reader-compare-left>'
        book.slots.forEach(function(slot, index) {
          h += '<option value="' + escapeHtmlAttribute(slot.id) + '"' + (slot.id === compareLeft.id ? ' selected' : '') + '>' + esc(readerSlotDisplayName(slot, index)) + '</option>'
        })
        h += '</select></label><label><span>路线二</span><select data-reader-compare-right>'
        book.slots.forEach(function(slot, index) {
          h += '<option value="' + escapeHtmlAttribute(slot.id) + '"' + (slot.id === compareRight.id ? ' selected' : '') + '>' + esc(readerSlotDisplayName(slot, index)) + '</option>'
        })
        h += '</select></label></div><div data-reader-route-comparison>'
        h += readerRouteComparisonHtml(work, book, compareLeft.id, compareRight.id)
        h += '</div></section>'
      }
      h += '</div></details></section>'
    }
  }
  h += '<section class="rd-book-manager-section"><details class="rd-reader-storage"><summary><strong>本地数据</strong><span data-reader-cache-size>' + esc(formatReaderStorageSize(cacheBytes)) + '</span></summary><div class="rd-reader-storage-body">'
  h += '<div class="rd-book-manager-storage"><p>清除正文缓存会保留进度、占位符和书签；下次阅读前需要重新导入原文件。</p>'
  h += '<div><button type="button" class="rd-book-secondary" data-reader-book-clear-cache' + (cacheBytes ? '' : ' disabled') + '>清除正文缓存</button>'
  h += '<button type="button" class="rd-book-danger" data-reader-book-remove>从书架移除</button></div></div>'
  h += '<div class="rd-book-remove-confirm" hidden><p>这会同时移除本书的进度、占位符、书签和正文缓存；完成后可在短时间内撤销。</p><div><button type="button" class="rd-book-secondary" data-reader-book-remove-cancel>取消</button><button type="button" class="rd-book-danger" data-reader-book-remove-confirm>确认移除</button></div></div></div></details></section>'
  h += '<p class="rd-book-manager-status rd-book-manager-global-status" role="status" aria-live="polite"></p>'
  h += '</div><footer class="rd-book-manager-actions">'
  if (book.progress) h += '<button type="button" class="rd-book-secondary" data-reader-book-restart>从头开始</button>'
  if (definitions.length) h += '<button type="button" class="rd-book-secondary" data-reader-book-save>保存修改</button>'
  h += '<button type="button" class="rd-book-primary" data-reader-book-continue>' + (book.progress ? '继续阅读' : '开始阅读') + '</button>'
  h += '</footer></section>'
  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay rd-book-manager-overlay'
  overlay.innerHTML = h
  document.body.appendChild(overlay)

  var status = overlay.querySelector('.rd-book-manager-status')
  var dialogLifecycle = null
  function removeManager(options) {
    options = options || {}
    if (dialogLifecycle) {
      dialogLifecycle.dispose({restoreFocus:options.restoreFocus === true})
      dialogLifecycle = null
    }
    overlay.remove()
  }
  function close() {
    closeReaderUnlockedSearchPreview(false)
    removeManager({restoreFocus:true})
    focusReaderBookInvoker(workId, invoker)
  }
  function saveValues() {
    if (!definitions.length) return true
    var values = readerBookManagerValues(overlay, definitions)
    var sourcePlaceholders = Array.isArray(work?.placeholders) ? work.placeholders : []
    var invalidLabel = ''
    sourcePlaceholders.forEach(function(placeholder) {
      var value = values[placeholder.id]?.[0] || ''
      if (!invalidLabel && placeholderForbiddenWord(placeholder, value, work?.globalForbidden)) {
        invalidLabel = placeholder.label || placeholder.key || placeholder.id
      }
    })
    if (invalidLabel) {
      if (status) status.textContent = '“' + invalidLabel + '”包含作者设置的违禁词，请修改后保存。'
      return false
    }
    if (!saveReaderWorkPlaceholders({id:workId}, values)) {
      if (status) status.textContent = '浏览器未能保存修改，请检查存储空间。'
      return false
    }
    if (status) status.textContent = '已保存；下次打开会自动使用。'
    return true
  }
  function reopenManager() {
    removeManager({restoreFocus:false})
    openReaderBookManager(workId, invoker)
  }
  overlay.querySelector('.rd-book-manager-close').onclick = close
  dialogLifecycle = installDialogInteraction({
    overlay:overlay,
    dialog:overlay.querySelector('.rd-book-manager'),
    invoker:invoker,
    initialFocus:overlay.querySelector('.rd-book-manager-close'),
    onRequestClose:close,
  })
  var slotManageButton = overlay.querySelector('[data-reader-slot-manage]')
  var slotManagePanel = overlay.querySelector('.rd-reader-slot-manage')
  slotManageButton.onclick = function() {
    var expanded = slotManageButton.getAttribute('aria-expanded') === 'true'
    slotManageButton.setAttribute('aria-expanded', String(!expanded))
    slotManagePanel.hidden = expanded
    if (!expanded) slotManagePanel.querySelector('button:not([disabled])')?.focus()
  }
  var slotSelect = overlay.querySelector('[data-reader-slot-select]')
  slotSelect.onchange = function() {
    if (!saveValues()) {
      slotSelect.value = activeSlot?.id || ''
      return
    }
    commitReaderLibraryState(switchReaderSlot(
      getReaderLibraryState(),
      workId,
      slotSelect.value,
      Date.now(),
    ))
    reopenManager()
  }
  var renamePanel = overlay.querySelector('[data-reader-slot-rename-panel]')
  var createPanel = overlay.querySelector('[data-reader-slot-create-panel]')
  overlay.querySelector('[data-reader-slot-rename]').onclick = function() {
    createPanel.hidden = true
    renamePanel.hidden = false
    renamePanel.querySelector('[data-reader-slot-name]').focus()
  }
  overlay.querySelector('[data-reader-slot-edit-cancel]').onclick = function() {
    renamePanel.hidden = true
  }
  overlay.querySelector('[data-reader-slot-rename-save]').onclick = function() {
    var input = renamePanel.querySelector('[data-reader-slot-name]')
    commitReaderLibraryState(renameReaderSlot(
      getReaderLibraryState(),
      workId,
      activeSlot.id,
      input.value,
      Date.now(),
    ))
    reopenManager()
  }
  overlay.querySelector('[data-reader-slot-create]').onclick = function() {
    renamePanel.hidden = true
    createPanel.hidden = false
    var input = createPanel.querySelector('[data-reader-slot-new-name]')
    input.value = ''
    input.focus()
  }
  overlay.querySelector('[data-reader-slot-create-cancel]').onclick = function() {
    createPanel.hidden = true
  }
  overlay.querySelector('[data-reader-slot-create-save]').onclick = function() {
    if (!saveValues()) return
    var input = createPanel.querySelector('[data-reader-slot-new-name]')
    commitReaderLibraryState(createReaderSlot(
      getReaderLibraryState(),
      workId,
      {
        id:readerLocalStateId('reader-slot'),
        name:input.value,
      },
      Date.now(),
    ))
    reopenManager()
  }
  var slotRemoveConfirm = overlay.querySelector('[data-reader-slot-remove-confirm]')
  overlay.querySelector('[data-reader-slot-remove]').onclick = function() {
    slotRemoveConfirm.hidden = false
    overlay.querySelector('[data-reader-slot-remove-save]').focus()
  }
  overlay.querySelector('[data-reader-slot-remove-cancel]').onclick = function() {
    slotRemoveConfirm.hidden = true
    overlay.querySelector('[data-reader-slot-remove]').focus()
  }
  overlay.querySelector('[data-reader-slot-remove-save]').onclick = function() {
    commitReaderLibraryState(removeReaderSlot(
      getReaderLibraryState(),
      workId,
      activeSlot.id,
      Date.now(),
    ))
    reopenManager()
  }
  var identityEditor = overlay.querySelector('.rd-reader-identity-editor')
  var identitySelect = overlay.querySelector('[data-reader-identity-select]')
  function openIdentityEditor(identity) {
    if (!identityEditor) return
    identityEditor.hidden = false
    identityEditor.dataset.identityId = identity?.id || ''
    var nameInput = identityEditor.querySelector('[data-reader-identity-name]')
    nameInput.value = identity?.name || ''
    identityEditor.querySelectorAll('[data-reader-identity-value]').forEach(function(input) {
      input.value = identity?.values?.[input.dataset.readerIdentityValue] || ''
    })
    nameInput.focus()
  }
  if (identitySelect) identitySelect.onchange = function() {
    if (identitySelect.value === '__new__') {
      openIdentityEditor(null)
      identitySelect.value = activeIdentity?.id || ''
      return
    }
    if (!identitySelect.value || !saveValues()) return
    commitReaderLibraryState(applyReaderIdentity(
      getReaderLibraryState(),
      workId,
      identitySelect.value,
      Date.now(),
    ))
    reopenManager()
  }
  var identityEdit = overlay.querySelector('[data-reader-identity-edit]')
  if (identityEdit) identityEdit.onclick = function() { openIdentityEditor(activeIdentity) }
  var identityCancel = overlay.querySelector('[data-reader-identity-cancel]')
  if (identityCancel) identityCancel.onclick = function() { identityEditor.hidden = true }
  var identitySave = overlay.querySelector('[data-reader-identity-save]')
  if (identitySave) identitySave.onclick = function() {
    var nameInput = identityEditor.querySelector('[data-reader-identity-name]')
    var name = nameInput.value.trim()
    if (!name) {
      if (status) status.textContent = '请先填写身份组名称。'
      nameInput.focus()
      return
    }
    var identityId = identityEditor.dataset.identityId || readerLocalStateId('reader-identity')
    var next = saveReaderIdentity(getReaderLibraryState(), {
      id:identityId,
      name:name,
      values:readerIdentityValues(identityEditor, definitions),
    }, Date.now())
    next = applyReaderIdentity(next, workId, identityId, Date.now())
    commitReaderLibraryState(next)
    reopenManager()
  }
  var identityRemove = overlay.querySelector('[data-reader-identity-remove]')
  if (identityRemove) identityRemove.onclick = function() {
    if (identityRemove.dataset.confirm !== 'true') {
      identityRemove.dataset.confirm = 'true'
      identityRemove.textContent = '再次点击确认删除'
      return
    }
    commitReaderLibraryState(removeReaderIdentity(getReaderLibraryState(), activeIdentity.id))
    reopenManager()
  }
  var saveBookButton = overlay.querySelector('[data-reader-book-save]')
  if (saveBookButton) saveBookButton.onclick = saveValues
  overlay.querySelector('[data-reader-book-continue]').onclick = function() {
    if (!saveValues()) return
    removeManager({restoreFocus:false})
    openReaderBookById(workId)
  }
  var restartBookButton = overlay.querySelector('[data-reader-book-restart]')
  if (restartBookButton) restartBookButton.onclick = function() {
      if (!saveValues()) return
      removeManager({restoreFocus:false})
      openReaderBookById(workId, {restart:true})
    }
  overlay.querySelector('[data-reader-book-completion]').onclick = function() {
    var latest = savedReaderBook(workId)
    if (!latest) return
    var complete = readerBookStatus(latest) !== 'completed'
    commitReaderLibraryState(setReaderCompletion(getReaderLibraryState(), workId, complete, Date.now()))
    var nextBook = savedReaderBook(workId)
    var nextStatus = readerBookStatus(nextBook)
    var stateLabel = overlay.querySelector('.rd-book-manager-state-label')
    var stateButton = overlay.querySelector('[data-reader-book-completion]')
    if (stateLabel) {
      stateLabel.dataset.status = nextStatus
      stateLabel.textContent = readerBookStatusLabel(nextBook)
    }
    stateButton.textContent = complete ? '恢复为阅读中' : '标记已完成'
    if (status) status.textContent = complete ? '已标记为完成。' : '已恢复为阅读中。'
    refreshBookshelfPage()
  }
  var pinBookButton = overlay.querySelector('[data-reader-book-pin]')
  var pinBookNote = overlay.querySelector('[data-reader-book-pin-note]')
  pinBookButton.onclick = function() {
    var latest = savedReaderBook(workId)
    if (!latest) return
    var pinned = !latest.pinnedAt
    var nextLibrary = setReaderBookPinned(getReaderLibraryState(), workId, pinned, Date.now())
    if (!commitReaderLibraryState(nextLibrary)) {
      if (status) status.textContent = '无法保存置顶状态，请检查浏览器存储空间。'
      return
    }
    var nextBook = savedReaderBook(workId)
    var isPinned = !!nextBook?.pinnedAt
    pinBookButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false')
    pinBookButton.textContent = isPinned ? '取消置顶' : '置顶'
    if (pinBookNote) {
      pinBookNote.textContent = isPinned ? '已固定在其他作品前面' : '固定在其他作品前面'
    }
    if (status) status.textContent = isPinned ? '已置顶到书架顶部。' : '已取消置顶。'
    refreshBookshelfPage()
    showReaderToast(isPinned ? '已置顶到书架顶部' : '已取消置顶', 'success', {
      actionLabel:'撤销',
      duration:5000,
      onAction:function() {
        var restored = setReaderBookPinned(
          getReaderLibraryState(),
          workId,
          !isPinned,
          Date.now(),
        )
        if (!commitReaderLibraryState(restored)) return
        var restoredBook = savedReaderBook(workId)
        var restoredPinned = !!restoredBook?.pinnedAt
        if (pinBookButton.isConnected) {
          pinBookButton.setAttribute('aria-pressed', restoredPinned ? 'true' : 'false')
          pinBookButton.textContent = restoredPinned ? '取消置顶' : '置顶'
        }
        if (pinBookNote?.isConnected) {
          pinBookNote.textContent = restoredPinned ? '已固定在其他作品前面' : '固定在其他作品前面'
        }
        if (status?.isConnected) status.textContent = '已撤销刚才的书架调整。'
        refreshBookshelfPage()
      },
    })
  }
  var clearCacheButton = overlay.querySelector('[data-reader-book-clear-cache]')
  clearCacheButton.onclick = function() {
    try { localStorage.removeItem('moirain_work_' + workId) } catch (_) {}
    clearCacheButton.disabled = true
    var size = overlay.querySelector('[data-reader-cache-size]')
    if (size) size.textContent = '未缓存正文'
    if (status) status.textContent = '正文缓存已清除；阅读记录和书签仍在。'
    refreshBookshelfPage()
  }
  var removeConfirm = overlay.querySelector('.rd-book-remove-confirm')
  overlay.querySelector('[data-reader-book-remove]').onclick = function() {
    removeConfirm.hidden = false
    overlay.querySelector('[data-reader-book-remove-confirm]').focus()
  }
  overlay.querySelector('[data-reader-book-remove-cancel]').onclick = function() {
    removeConfirm.hidden = true
    overlay.querySelector('[data-reader-book-remove]').focus()
  }
  overlay.querySelector('[data-reader-book-remove-confirm]').onclick = function() {
    var removedBook = savedReaderBook(workId)
    var cacheKey = 'moirain_work_' + workId
    var removedCache = null
    try { removedCache = localStorage.getItem(cacheKey) } catch (_) {}
    var removedRecent = getRecents().find(function(recent) { return recent?.id === workId }) || null
    try { localStorage.removeItem(cacheKey) } catch (_) {}
    try {
      lsSet('recent', getRecents().filter(function(recent) { return recent?.id !== workId }))
    } catch (_) {}
    commitReaderLibraryState(removeReaderBook(getReaderLibraryState(), workId))
    close()
    refreshBookshelfPage()
    if (!removedBook) return
    showReaderToast('已从书架移除', 'success', {
      actionLabel:'撤销',
      duration:6000,
      onAction:function() {
        var restoredLibrary = restoreReaderBook(getReaderLibraryState(), removedBook)
        if (!commitReaderLibraryState(restoredLibrary)) return
        if (removedCache !== null) {
          try {
            if (localStorage.getItem(cacheKey) === null) localStorage.setItem(cacheKey, removedCache)
          } catch (_) {}
        }
        if (removedRecent) {
          try {
            var currentRecents = getRecents()
            if (!currentRecents.some(function(recent) { return recent?.id === workId })) {
              lsSet('recent', [removedRecent].concat(currentRecents))
            }
          } catch (_) {}
        }
        refreshBookshelfPage()
      }
    })
  }
  overlay.querySelectorAll('[data-reader-book-bookmark-remove]').forEach(function(button) {
    button.onclick = function() {
      var latestBook = savedReaderBook(workId)
      var bookmark = latestBook?.bookmarks?.find(function(candidate) {
        return candidate.id === button.dataset.readerBookBookmarkRemove
      })
      if (!bookmark) return
      commitReaderLibraryState(removeReaderBookmark(getReaderLibraryState(), workId, bookmark.id))
      button.closest('.rd-book-bookmark-row')?.remove()
      if (status) status.textContent = '书签已删除。'
      refreshBookshelfPage()
      showReaderToast('书签已删除', 'success', {
        actionLabel:'撤销',
        duration:5000,
        onAction:function() {
          var restored = restoreReaderBookmark(getReaderLibraryState(), workId, bookmark)
          if (!commitReaderLibraryState(restored)) return
          if (overlay.isConnected) reopenManager()
          else refreshBookshelfPage()
        }
      })
    }
  })
  overlay.querySelectorAll('[data-reader-book-bookmark-edit]').forEach(function(button) {
    button.onclick = function() {
      var editor = Array.from(overlay.querySelectorAll('[data-reader-book-bookmark-editor]')).find(function(candidate) {
        return candidate.dataset.readerBookBookmarkEditor === button.dataset.readerBookBookmarkEdit
      })
      if (!editor) return
      editor.hidden = false
      editor.querySelector('[data-reader-bookmark-label]').focus()
    }
  })
  overlay.querySelectorAll('[data-reader-book-bookmark-editor]').forEach(function(editor) {
    var cancelButton = editor.querySelector('[data-reader-bookmark-edit-cancel]')
    var saveButton = editor.querySelector('[data-reader-bookmark-edit-save]')
    cancelButton.onclick = function() { editor.hidden = true }
    saveButton.onclick = function() {
      var bookmarkId = editor.dataset.readerBookBookmarkEditor
      commitReaderLibraryState(updateReaderBookmark(
        getReaderLibraryState(),
        workId,
        bookmarkId,
        {
          label:editor.querySelector('[data-reader-bookmark-label]').value,
          note:editor.querySelector('[data-reader-bookmark-note]').value,
        },
        Date.now(),
      ))
      reopenManager()
    }
  })
  overlay.querySelectorAll('[data-reader-book-bookmark]').forEach(function(button) {
    button.onclick = function() {
      if (!saveValues()) return
      var latestBook = savedReaderBook(workId)
      var bookmark = latestBook?.bookmarks?.find(function(candidate) {
        return candidate.id === button.dataset.readerBookBookmark
      })
      if (!bookmark || bookmark.kind !== 'article') return
      if (!work) {
        if (status) status.textContent = '正文缓存已清除，请重新导入原文件后再回到书签。'
        return
      }
      commitReaderLibraryState(saveReaderProgress(getReaderLibraryState(), workId, {
        kind:'article',
        path:bookmark.path,
        choiceMemory:bookmark.choiceMemory,
        interactionSelections:bookmark.interactionSelections,
        checkpoints:latestBook?.progress?.checkpoints || [],
      }, Date.now()))
      removeManager({restoreFocus:false})
      openReaderBookById(workId)
    }
  })
  overlay.querySelectorAll('[data-reader-book-checkpoint]').forEach(function(button) {
    button.onclick = function() {
      if (!saveValues()) return
      var latestBook = savedReaderBook(workId)
      var checkpoints = latestBook?.progress?.checkpoints || []
      var checkpoint = checkpoints.slice().reverse()[Number(button.dataset.readerBookCheckpoint)]
      if (!checkpoint) return
      var nextProgress = {
        kind:'article',
        path:checkpoint.path,
        choiceMemory:checkpoint.choiceMemory,
        interactionSelections:checkpoint.interactionSelections,
        checkpoints:checkpoints,
      }
      commitReaderLibraryState(saveReaderProgress(
        getReaderLibraryState(),
        workId,
        nextProgress,
        Date.now(),
      ))
      removeManager({restoreFocus:false})
      openReaderBookById(workId)
    }
  })
  overlay.querySelectorAll('[data-reader-journey-entry]').forEach(function(button) {
    button.onclick = function() {
      var directoryEntry = journeyDirectory[Number(button.dataset.readerJourneyEntry)]
      var previewEntry = directoryEntry && journeyPreviewByNodeId.get(directoryEntry.nodeId)
      if (!directoryEntry || !previewEntry) {
        if (status) status.textContent = '正文缓存已清除；重新导入原作品后即可回看。'
        return
      }
      openReaderUnlockedSearchPreview(Object.assign({}, previewEntry, {
        kindLabel:'已读片段',
        title:directoryEntry.title,
        location:[directoryEntry.chapterTitle, directoryEntry.title].filter(Boolean).join(' · '),
      }), button)
    }
  })
  var compareLeftSelect = overlay.querySelector('[data-reader-compare-left]')
  var compareRightSelect = overlay.querySelector('[data-reader-compare-right]')
  var compareOutput = overlay.querySelector('[data-reader-route-comparison]')
  function refreshRouteComparison() {
    if (!compareLeftSelect || !compareRightSelect || !compareOutput) return
    compareOutput.innerHTML = readerRouteComparisonHtml(
      work,
      savedReaderBook(workId),
      compareLeftSelect.value,
      compareRightSelect.value,
    )
  }
  if (compareLeftSelect) compareLeftSelect.onchange = refreshRouteComparison
  if (compareRightSelect) compareRightSelect.onchange = refreshRouteComparison
}

function bindReaderDataPanel(root) {
  var toggle = root.querySelector('[data-reader-data-toggle]')
  var panel = root.querySelector('[data-reader-data-panel]')
  if (!toggle || !panel) return
  var status = panel.querySelector('[data-reader-data-status]')
  var preview = panel.querySelector('[data-reader-data-preview]')
  var applyButton = panel.querySelector('[data-reader-data-apply]')
  var fileInput = panel.querySelector('[data-reader-data-file]')

  function setStatus(message) {
    _readerDataStatusMessage = message
    if (status) status.textContent = message
  }

  function clearCandidate() {
    panel._readerDataCandidate = null
    if (preview) preview.hidden = true
    if (applyButton) applyButton.hidden = true
  }

  toggle.onclick = function() {
    _readerDataPanelOpen = !_readerDataPanelOpen
    toggle.setAttribute('aria-expanded', _readerDataPanelOpen ? 'true' : 'false')
    panel.hidden = !_readerDataPanelOpen
    if (_readerDataPanelOpen) {
      var firstAction = panel.querySelector('[data-reader-data-export]')
      if (firstAction) firstAction.focus()
    }
  }

  var exportButton = panel.querySelector('[data-reader-data-export]')
  if (exportButton) exportButton.onclick = function() {
    try {
      var serialized = serializeReaderDataPackage(currentReaderDataPackageInput())
      downloadBlob(
        new Blob([serialized], {type:'application/json;charset=utf-8'}),
        'Tuuru-reader-data.json',
        {urlApi:window.URL},
      )
      setStatus('备份已导出；作品、密码与图片未包含在内。')
    } catch (error) {
      setStatus(error && error.message ? error.message : '阅读数据导出失败。')
    }
  }

  var importButton = panel.querySelector('[data-reader-data-import]')
  if (importButton) importButton.onclick = function() {
    if (fileInput) fileInput.click()
  }
  if (fileInput) fileInput.onchange = function() {
    var file = fileInput.files && fileInput.files[0]
    fileInput.value = ''
    clearCandidate()
    if (!file) return
    if (file.size > READER_DATA_PACKAGE_MAX_BYTES) {
      setStatus('备份文件过大，无法导入。')
      return
    }
    var reader = new FileReader()
    reader.onload = function() {
      try {
        var candidate = inspectReaderDataPackage(String(reader.result || ''))
        panel._readerDataCandidate = candidate
        ;[
          ['books', '[data-reader-data-books]'],
          ['slots', '[data-reader-data-slots]'],
          ['identities', '[data-reader-data-identities]'],
          ['bookmarks', '[data-reader-data-bookmarks]'],
        ].forEach(function(entry) {
          var output = panel.querySelector(entry[1])
          if (output) output.textContent = String(candidate.summary[entry[0]] || 0)
        })
        if (preview) preview.hidden = false
        if (applyButton) applyButton.hidden = false
        setStatus('已读取备份，请确认后合并恢复。')
      } catch (error) {
        setStatus(error && error.message ? error.message : '无法读取这个备份。')
      }
    }
    reader.onerror = function() { setStatus('备份读取失败，请重新选择。') }
    reader.readAsText(file)
  }
  if (applyButton) applyButton.onclick = function() {
    var candidate = panel._readerDataCandidate
    if (!candidate) return
    try {
      installReaderDataPackage(candidate)
      _readerDataPanelOpen = true
      _readerDataStatusMessage = '阅读数据已恢复；同一存档已保留较新的进度。'
      refreshBookshelfPage()
      var refreshedToggle = document.querySelector('[data-reader-data-toggle]')
      if (refreshedToggle) refreshedToggle.focus()
      showReaderToast('阅读数据已恢复')
    } catch (_) {
      setStatus('恢复失败；浏览器存储空间不足或备份无法写入。')
    }
  }
}

function bindBookshelfPage(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return
  bindReaderDataPanel(root)
  var search = root.querySelector('[data-reader-shelf-search]')
  if (search) {
    search.oninput = function() {
      _readerShelfQuery = search.value
      var query = search.value.trim().toLocaleLowerCase('zh-CN')
      var visible = 0
      root.querySelectorAll('[data-reader-book-search]').forEach(function(book) {
        var matches = !query || String(book.dataset.readerBookSearch || '').includes(query)
        book.hidden = !matches
        if (matches) visible += 1
      })
      var empty = root.querySelector('.rd-bookshelf-no-results')
      if (empty) empty.hidden = visible > 0
    }
  }
  var sort = root.querySelector('[data-reader-shelf-sort]')
  if (sort) {
    sort.onchange = function() {
      _readerShelfSort = sort.value
      refreshBookshelfPage()
      document.querySelector('[data-reader-shelf-sort]')?.focus()
    }
  }
  root.querySelectorAll('[data-reader-open-import]').forEach(function(button) {
    button.onclick = function() { openReaderImportDialog(button) }
  })
  root.querySelectorAll('[data-reader-book-manage]').forEach(function(button) {
    button.onclick = function(event) {
      event.stopPropagation()
      var book = readerBookByRenderedIndex(Number(button.dataset.readerBookManage))
      if (book) openReaderBookManager(book.id, button)
    }
  })
  root.querySelectorAll('[data-reader-book-index]').forEach(function(cover) {
    var index = Number(cover.dataset.readerBookIndex)
    var hold = createBookCoverHold({
      onHold:function() {
        var book = readerBookByRenderedIndex(index)
        if (book) openReaderBookManager(book.id, cover)
      },
    })
    cover.addEventListener('pointerdown', function(event) {
      hold.begin(event)
    })
    cover.addEventListener('pointermove', function(event) {
      hold.move(event)
    })
    cover.addEventListener('pointerup', function(event) {
      hold.finish(event)
    })
    cover.addEventListener('pointercancel', function(event) {
      hold.cancel(event.pointerId)
    })
    cover.addEventListener('lostpointercapture', function(event) {
      hold.cancel(event.pointerId)
    })
    cover.addEventListener('contextmenu', function(event) {
      event.preventDefault()
      var book = readerBookByRenderedIndex(index)
      if (book) openReaderBookManager(book.id, cover)
    })
    cover.addEventListener('click', function(event) {
      if (hold.consumeClickSuppression()) {
        event.preventDefault()
        return
      }
      var book = readerBookByRenderedIndex(index)
      if (book) openReaderBookById(book.id)
    })
  })
}

function reimportRecent(id) {
  // Load work from localStorage
  try {
    var db = JSON.parse(localStorage.getItem('moirain_work_' + id))
    if (!db) { alert('该作品已不在缓存中，请重新导入'); return }
    openReaderBookById(id) || importWork(db)
  } catch(e) {
    alert('加载失败：' + e.message)
  }
}

// ====== Import Dialog ======
function renderImportPanel(recoveryBook) {
  var h = '<div class="drop-zone">'
  h += '<div class="drop-zone-inner" id="dropInner">'
  h += '<div class="drop-icon" aria-hidden="true">↑</div>'
  h += '<div class="drop-title">把作品文件拖到这里</div>'
  h += '<div class="drop-desc" id="rdImportDescription">支持 .tuuru、.json 和 .png，也可以直接选择文件。</div>'
  if (recoveryBook) {
    h += '<p class="rd-import-recovery-note">请选择这本作品的原文件；识别成功后会接回现有阅读记录。</p>'
  }
  h += '<button type="button" class="drop-btn" id="pickFileBtn">选择作品文件</button>'
  h += '<p class="rd-import-local-note">文件仅在当前设备读取，不会上传。</p>'
  h += '<div class="rd-import-status" data-reader-import-status data-state="idle" role="status" aria-live="polite"></div>'
  h += '<input type="file" id="fileInput" accept=".tuuru,.json,.png" style="display:none">'
  h += '</div>'
  h += '<div class="rd-import-review" hidden></div>'
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
  if ((ext === 'tuuru' || ext === 'json') && file.size > MAX_READER_JSON_IMPORT_BYTES) {
    return '作品文件超过 10 MB 安全读取上限'
  }
  if (ext === 'png' && file.size > MAX_READER_PNG_IMPORT_BYTES) {
    return 'PNG 文件超过 25 MB 安全读取上限'
  }
  return ''
}

function setReaderImportStatus(root, state, message) {
  root = root && typeof root.querySelector === 'function' ? root : _readerImportOverlay
  if (!root) return false
  var status = root.querySelector('[data-reader-import-status]')
  var picker = root.querySelector('#pickFileBtn')
  var inner = root.querySelector('#dropInner')
  var busy = state === 'loading'
  if (picker) picker.disabled = busy
  if (inner) inner.setAttribute('aria-busy', busy ? 'true' : 'false')
  if (!status) return false
  status.dataset.state = state || 'idle'
  status.textContent = message || ''
  return true
}

function reportReaderImportError(message, root) {
  if (setReaderImportStatus(root, 'error', message)) return
  alert(message)
}

function setupImport(root) {
  root = root && typeof root.querySelector === 'function' ? root : document
  var inner = root.querySelector('#dropInner')
  var pickBtn = root.querySelector('#pickFileBtn')
  var fileInput = root.querySelector('#fileInput')

  function resetFileInput() {
    if (fileInput) fileInput.value = ''
  }

  function handleFile(file) {
    if (!file) return
    var name = typeof file.name === 'string' ? file.name : ''
    var ext = name.split('.').pop().toLowerCase()
    if (ext !== 'tuuru' && ext !== 'json' && ext !== 'png') {
      reportReaderImportError('请选择 .tuuru、.json 或 .png 文件', root)
      resetFileInput()
      return
    }
    var fileError = readerImportFileError(file, ext)
    if (fileError) {
      reportReaderImportError(fileError, root)
      resetFileInput()
      return
    }
    setReaderImportStatus(root, 'loading', '正在读取作品…')
    var reader
    try {
      reader = new FileReader()
    } catch (error) {
      reportReaderImportError('无法读取文件，请确认文件仍可访问后重试', root)
      resetFileInput()
      return
    }
    var settled = false
    function finishRead(message) {
      if (settled) return false
      settled = true
      resetFileInput()
      if (message) reportReaderImportError(message, root)
      return true
    }
    reader.onload = async function() {
      if (!finishRead()) return
      setReaderImportStatus(root, 'loading', '正在解析作品…')
      if (ext === 'tuuru') {
        try {
          var encryptedBytes = new Uint8Array(reader.result)
          var serialized = await decryptWorkPackage(encryptedBytes)
          importPayload(JSON.parse(serialized), root)
        } catch (e) {
          reportReaderImportError('Tuuru 作品包读取失败：' + e.message, root)
        }
      } else if (ext === 'json') {
        try {
          var work = JSON.parse(reader.result)
          importPayload(work, root)
        } catch (e) {
          reportReaderImportError('JSON 解析失败：' + e.message, root)
        }
      } else {
        // PNG stego decode
        var dimensionError = readerPngDimensionError(parsePngDimensionsFromDataUrl(reader.result))
        if (dimensionError) {
          reportReaderImportError(dimensionError, root)
          return
        }
        decodeSteganoFromDataUrl(reader.result, root)
      }
    }
    reader.onerror = function() {
      finishRead('无法读取文件，请确认文件仍可访问后重试')
    }
    reader.onabort = function() {
      finishRead('文件读取已取消，请重新选择')
    }
    try {
      if (ext === 'tuuru') reader.readAsArrayBuffer(file)
      else if (ext === 'json') reader.readAsText(file)
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
    var file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null
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
      if (fileInput) fileInput.click()
    }
  }
  if (fileInput) {
    fileInput.onchange = function() { handleFile(fileInput.files[0]) }
  }
}

function parseSteganoWork(bytes) {
  if (isEncryptedWorkPackage(bytes)) {
    return decryptWorkPackage(bytes).then(function(json) { return JSON.parse(json) })
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function decodeSteganoFromDataUrl(dataUrl, root) {
  var img = new Image()
  img.onload = function() {
    var canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    var pixels = ctx.getImageData(0, 0, img.width, img.height).data
    var bytes = readSteganoPayload(pixels)
    if (!bytes) { reportReaderImportError('未检测到隐写数据', root); return }
    try {
      var work = parseSteganoWork(bytes)
      if (work && typeof work.then === 'function') {
        work.then(function(payload) { importPayload(payload, root) }).catch(function(error) {
          reportReaderImportError('隐写数据解析失败：' + error.message, root)
        })
      } else {
        importPayload(work, root)
      }
    } catch(e) {
      reportReaderImportError('隐写数据解析失败：' + e.message, root)
    }
  }
  img.onerror = function() { reportReaderImportError('PNG 加载失败', root) }
  img.src = dataUrl
}

function importPayload(payload, root) {
  if (payload && payload.type === WORK_COLLECTION_BUNDLE_TYPE) {
    importWorkCollection(payload, root)
    return
  }
  importWork(payload, root)
}

function importWorkCollection(payload, root) {
  var inspected
  try {
    inspected = inspectReaderCollectionBundle(payload, localStorage, window)
  } catch (error) {
    reportReaderImportError(error instanceof Error ? error.message : '无法检查作品集', root)
    return
  }
  if (!inspected.ok) {
    reportReaderImportError(inspected.message, root)
    return
  }
  var dropInner = root?.querySelector?.('#dropInner')
  var review = root?.querySelector?.('.rd-import-review')
  if (!dropInner || !review) {
    reportReaderImportError('无法打开作品集导入确认，请重新选择文件', root)
    return
  }
  var replacement = inspected.existingWorkCount
    ? inspected.existingWorkCount + ' 篇会更新同名本地缓存'
    : '不会覆盖书架中的同名作品'
  var access = inspected.collection.accessMode === 'unified' ? '统一进入' : '各篇独立进入'
  dropInner.hidden = true
  review.hidden = false
  review.dataset.releaseState = inspected.existingWorkCount ? 'newer' : 'new'
  review.innerHTML = '<p class="rd-import-review-label">作品集导入</p>' +
    '<h3>' + esc(inspected.collection.title || '未命名作品集') + '</h3>' +
    (inspected.collection.author ? '<p class="rd-import-review-author">' + esc(inspected.collection.author) + '</p>' : '') +
    '<dl class="rd-import-review-summary"><div><dt>包含作品</dt><dd>' +
    inspected.works.length + ' 篇</dd></div><div><dt>进入方式</dt><dd>' +
    esc(access) + '</dd></div><div><dt>本地变化</dt><dd>' +
    esc(replacement) + '</dd></div></dl>' +
    '<p class="rd-import-review-note">确认后会把整套作品加入当前设备的书架，阅读记录仍只保存在本机。</p>' +
    '<div class="rd-import-review-actions"><button type="button" class="rd-book-secondary" data-reader-collection-cancel>重新选择</button>' +
    '<button type="button" class="rd-book-primary" data-reader-collection-confirm>导入并打开</button></div>'
  setReaderImportStatus(root, 'review', '')

  var cancelButton = review.querySelector('[data-reader-collection-cancel]')
  var confirmButton = review.querySelector('[data-reader-collection-confirm]')
  cancelButton.onclick = function() {
    review.hidden = true
    review.innerHTML = ''
    delete review.dataset.releaseState
    dropInner.hidden = false
    setReaderImportStatus(root, 'idle', '')
    root.querySelector('#pickFileBtn')?.focus()
  }
  confirmButton.onclick = function() {
    cancelButton.disabled = true
    confirmButton.disabled = true
    confirmButton.setAttribute('aria-busy', 'true')
    confirmButton.textContent = '正在导入…'
    try {
      var installed = installReaderCollection(localStorage, inspected)
      closeReaderImportDialog({restoreFocus:false})
      openReaderCollection(installed.collection.id)
    } catch (error) {
      cancelButton.disabled = false
      confirmButton.disabled = false
      confirmButton.removeAttribute('aria-busy')
      confirmButton.textContent = '导入并打开'
      reportReaderImportError('作品集导入失败：' + (error instanceof Error ? error.message : '本地存储不可用'), root)
    }
  }
  confirmButton.focus()
}

function serializedReaderWorkCache(work) {
  var cachedWork = Object.assign({}, work)
  delete cachedWork.readerPhValues
  return JSON.stringify(cachedWork)
}

function reconcileImportedReaderWork(previousCache, work, loadOptions) {
  if (!previousCache) return loadOptions || {}
  commitReaderLibraryState(reconcileReaderWorkUpdate(
    getReaderLibraryState(),
    previousCache,
    work,
    {
      now:Date.now(),
      markUpdated:loadOptions?.releaseState === 'newer',
    },
  ))
  return Object.assign({}, loadOptions, {
    skipLanding:loadOptions?.resume
      ? canResumeReaderImport(work, savedReaderBook(work.id))
      : loadOptions?.skipLanding,
  })
}

function renderReaderStorageRescue(work, root, serialized, loadOptions) {
  root = root && typeof root.querySelector === 'function' ? root : _readerImportOverlay
  if (!root) return false
  var dropInner = root.querySelector('#dropInner')
  var review = root.querySelector('.rd-import-review')
  if (!dropInner || !review) return false
  var analysis = readerStorageRescueCandidates(localStorage, getReaderLibraryState(), {
    excludeWorkId:work.id,
    incomingSerialized:serialized,
  })
  var selectedBytes = 0
  var candidateRows = ''
  analysis.candidates.forEach(function(candidate) {
    var checked = selectedBytes < analysis.suggestedBytes
    if (checked) selectedBytes += candidate.bytes
    candidateRows += '<label class="rd-storage-rescue-row">' +
      '<input type="checkbox" data-reader-rescue-work value="' + escapeHtmlAttribute(candidate.id) + '"' +
      (checked ? ' checked' : '') + '>' +
      '<span class="rd-storage-rescue-copy"><strong>' + esc(candidate.title) + '</strong>' +
      '<small>' + (candidate.lastOpenedAt ? esc(timeAgo(candidate.lastOpenedAt)) + '读过' : '很久未读') +
      ' · 只清理正文</small></span>' +
      '<span class="rd-storage-rescue-size">' + esc(formatReaderStorageSize(candidate.bytes)) + '</span></label>'
  })
  dropInner.hidden = true
  review.hidden = false
  review.innerHTML = '<section class="rd-storage-rescue" data-reader-storage-rescue aria-labelledby="rdStorageRescueTitle">' +
    '<p class="rd-import-review-label">本地存储</p>' +
    '<h3 id="rdStorageRescueTitle">存储空间不足</h3>' +
    '<p class="rd-storage-rescue-intro">这次作品正文约 ' + esc(formatReaderStorageSize(analysis.incomingBytes)) +
    '。可以清理久未阅读作品的正文缓存，再继续刚才的导入。</p>' +
    '<p class="rd-storage-rescue-safe">阅读进度、身份、占位符和书签都会保留；被清理的旧作下次打开时需要重新导入原文件。</p>' +
    (analysis.candidates.length
      ? '<div class="rd-storage-rescue-list" aria-label="可清理的作品正文">' + candidateRows + '</div>'
      : '<p class="rd-storage-rescue-empty">当前没有可清理的旧作品正文，可以选择仅在本次打开。</p>') +
    '<p class="rd-storage-rescue-total" data-reader-rescue-total></p>' +
    '<p class="rd-storage-rescue-status" data-reader-rescue-status role="status" aria-live="polite"></p>' +
    '<div class="rd-storage-rescue-actions">' +
    '<button type="button" class="rd-book-secondary" data-reader-rescue-memory>仅本次阅读</button>' +
    '<button type="button" class="rd-book-primary" data-reader-rescue-continue>清理并继续</button></div></section>'
  setReaderImportStatus(root, 'idle', '')

  var rescue = review.querySelector('[data-reader-storage-rescue]')
  var checkboxes = Array.from(rescue.querySelectorAll('[data-reader-rescue-work]'))
  var total = rescue.querySelector('[data-reader-rescue-total]')
  var status = rescue.querySelector('[data-reader-rescue-status]')
  var memoryButton = rescue.querySelector('[data-reader-rescue-memory]')
  var continueButton = rescue.querySelector('[data-reader-rescue-continue]')
  function selectedCandidates() {
    return checkboxes.filter(function(checkbox) { return checkbox.checked })
  }
  function refreshSelection() {
    var selected = selectedCandidates()
    var bytes = selected.reduce(function(sum, checkbox) {
      var candidate = analysis.candidates.find(function(item) { return item.id === checkbox.value })
      return sum + (candidate?.bytes || 0)
    }, 0)
    continueButton.disabled = selected.length === 0
    total.textContent = selected.length
      ? '已选择约 ' + formatReaderStorageSize(bytes) + '；建议至少释放约 ' +
        formatReaderStorageSize(analysis.suggestedBytes) + '。'
      : '尚未选择要清理的正文缓存。'
    status.textContent = ''
  }
  checkboxes.forEach(function(checkbox) { checkbox.onchange = refreshSelection })
  refreshSelection()

  memoryButton.onclick = function() {
    closeReaderImportDialog({restoreFocus:false})
    loadWork(work, Object.assign({}, loadOptions, {
      remember:loadOptions?.previousCache ? false : loadOptions?.remember,
      skipCache:true,
    }))
    showReaderToast('这次正文不会保存；关闭后需重新导入')
  }
  continueButton.onclick = function() {
    var selectedIds = selectedCandidates().map(function(checkbox) { return checkbox.value })
    if (!selectedIds.length) return
    memoryButton.disabled = true
    continueButton.disabled = true
    status.textContent = '正在释放正文缓存并继续导入…'
    var result = installReaderCacheWithRescue(localStorage, {
      library:getReaderLibraryState(),
      incomingWorkId:work.id,
      incomingSerialized:serialized,
      clearWorkIds:selectedIds,
    })
    if (!result.ok) {
      memoryButton.disabled = false
      continueButton.disabled = false
      status.textContent = result.rollbackOk
        ? '空间仍然不足，刚才选择的正文缓存已经恢复。请再多选一些后重试。'
        : '空间仍然不足，且部分正文缓存未能恢复；请先导出阅读数据备份。'
      return
    }
    closeReaderImportDialog({restoreFocus:false})
    var reconciledOptions = reconcileImportedReaderWork(
      loadOptions?.previousCache,
      work,
      loadOptions,
    )
    loadWork(work, Object.assign({}, reconciledOptions, {cachePrepared:true}))
    showReaderToast('已释放 ' + formatReaderStorageSize(result.clearedBytes) + '，阅读记录仍保留')
  }
  var initialFocus = checkboxes[0] || memoryButton
  if (initialFocus) initialFocus.focus()
  return true
}

function openImportedReaderWork(work, root, loadOptions) {
  var previousCache = cachedReaderWork(work.id)
  var serialized
  try {
    serialized = serializedReaderWorkCache(work)
    localStorage.setItem('moirain_work_' + work.id, serialized)
  } catch (error) {
    if (isReaderStorageQuotaError(error) && renderReaderStorageRescue(
      work,
      root,
      serialized || '',
      Object.assign({}, loadOptions, {previousCache:previousCache}),
    )) {
      return false
    }
    warnReaderStorageFailure()
    closeReaderImportDialog({restoreFocus:false})
    loadWork(work, Object.assign({}, loadOptions, {
      remember:previousCache ? false : loadOptions?.remember,
      skipCache:true,
    }))
    return true
  }
  loadOptions = reconcileImportedReaderWork(previousCache, work, loadOptions)
  closeReaderImportDialog({restoreFocus:false})
  loadWork(work, Object.assign({}, loadOptions, {cachePrepared:true}))
  return true
}

function canResumeReaderImport(work, book) {
  if (!work || !book || !book.progress || String(work.password || '').trim()) return false
  var savedValues = book.placeholderValues || {}
  return (work.placeholders || []).every(function(definition) {
    return definition
      && typeof definition.id === 'string'
      && Array.isArray(savedValues[definition.id])
      && typeof savedValues[definition.id][0] === 'string'
  })
}

function reviewReaderWorkImport(work, root, releaseIntegrity) {
  root = root && typeof root.querySelector === 'function' ? root : _readerImportOverlay
  var existingBook = work && work.id ? savedReaderBook(work.id) : null
  var existingCache = work && work.id ? cachedReaderWork(work.id) : null
  if (!root || (!existingBook && !existingCache)) return false
  var dropInner = root.querySelector('#dropInner')
  var review = root.querySelector('.rd-import-review')
  if (!dropInner || !review) return false

  var reviewCopy = readerWorkImportReview(work, existingCache, {
    hasBook:!!existingBook,
    releaseIntegrity:releaseIntegrity,
  })
  var recovering = reviewCopy.state === 'recovery'
  var changeSummary = reviewCopy.changeSummary.length
    ? '<section class="rd-import-change-summary" aria-label="本次变化"><span>本次变化</span><ul>' +
      reviewCopy.changeSummary.map(function(item) { return '<li>' + esc(item) + '</li>' }).join('') +
      '</ul></section>'
    : ''
  dropInner.hidden = true
  review.hidden = false
  review.dataset.releaseState = reviewCopy.state
  review.innerHTML = '<p class="rd-import-review-label">' + esc(reviewCopy.label) + '</p>' +
    '<h3>' + esc(work.title || '无标题作品') + '</h3>' +
    (work.author ? '<p class="rd-import-review-author">' + esc(work.author) + '</p>' : '') +
    changeSummary +
    '<dl class="rd-import-review-summary"><div><dt>正文内容</dt><dd>' +
    esc(reviewCopy.contentSummary) + '</dd></div>' +
    '<div><dt>阅读记录</dt><dd>' +
    esc(reviewCopy.readerSummary) + '</dd></div></dl>' +
    '<p class="rd-import-review-note">' + esc(reviewCopy.note) + '</p>' +
    '<div class="rd-import-review-actions"><button type="button" class="rd-book-secondary" data-reader-import-secondary>' + esc(reviewCopy.secondaryLabel) + '</button>' +
    '<button type="button" class="rd-book-primary" data-reader-import-confirm>' + esc(reviewCopy.confirmLabel) + '</button></div>'
  setReaderImportStatus(root, 'review', '')

  var secondaryButton = review.querySelector('[data-reader-import-secondary]')
  var confirmButton = review.querySelector('[data-reader-import-confirm]')
  function returnToPicker() {
    review.hidden = true
    review.innerHTML = ''
    delete review.dataset.releaseState
    dropInner.hidden = false
    setReaderImportStatus(root, 'idle', '')
    var picker = root.querySelector('#pickFileBtn')
    if (picker) picker.focus()
  }
  function replaceCachedWork() {
    openImportedReaderWork(work, root, {
      resume:true,
      skipLanding:canResumeReaderImport(work, existingBook),
      releaseState:reviewCopy.state,
    })
  }
  secondaryButton.onclick = function() {
    if (reviewCopy.secondaryAction === 'preview') {
      closeReaderImportDialog({restoreFocus:false})
      loadWork(work, {remember:false})
      return
    }
    if (reviewCopy.secondaryAction === 'replace') {
      replaceCachedWork()
      return
    }
    returnToPicker()
  }
  confirmButton.onclick = function() {
    if (reviewCopy.primaryAction === 'continue') {
      closeReaderImportDialog({restoreFocus:false})
      openReaderBookById(work.id)
      return
    }
    replaceCachedWork()
  }
  confirmButton.focus()
  return true
}

function importWork(work, root) {
  var releaseIntegrity = workReleaseFingerprintMatches(work)
  var result = prepareImportedWork(work)
  if (!result.ok) {
    reportReaderImportError(result.message, root)
    return
  }
  var expectedWorkId = root && root.dataset ? String(root.dataset.readerRecoveryWorkId || '') : ''
  if (expectedWorkId && result.work.id !== expectedWorkId) {
    var expectedBook = savedReaderBook(expectedWorkId)
    reportReaderImportError(
      '所选文件与“' + (expectedBook?.title || '要恢复的作品') + '”不是同一作品，请重新选择。',
      root,
    )
    return
  }
  if (reviewReaderWorkImport(result.work, root, releaseIntegrity)) return
  openImportedReaderWork(result.work, root)
}

// ====== Landing Page (work info + password + placeholders) ======
function placeholderForbiddenWord(placeholder, value, globalForbidden) {
  var normalized = String(value || '').toLocaleLowerCase()
  return effectiveForbiddenWords(placeholder, globalForbidden).find(function(word) {
    var candidate = String(word || '').trim().toLocaleLowerCase()
    return candidate && normalized.includes(candidate)
  }) || ''
}

async function ensureInteractiveCameraPreflight(statusElement, button) {
  if (!workUsesCameraInteractions(_work)) return _interactiveCameraState
  if (_interactiveCameraState.preflighted) return _interactiveCameraState
  if (button) {
    button.disabled = true
    button.textContent = '正在确认摄像头权限…'
  }
  if (statusElement) statusElement.textContent = '只会在本机判断脸部是否靠近，不录制、不保存、不上传，也不会使用麦克风。'
  var result = await requestInteractiveCameraPreflight()
  _interactiveCameraState = Object.assign({}, result, {preflighted:true})
  if (statusElement) {
    statusElement.textContent = result.granted && result.detectorAvailable
      ? '摄像头互动已就绪。摄像头只会在进入对应互动页时启用。'
      : result.granted
        ? '摄像头权限已开启，但当前浏览器不支持本地靠近识别；靠近互动不会降级成普通点击。'
        : '摄像头互动不可用，作品会使用作者设置的点击或长按备用操作。'
  }
  if (button) {
    button.disabled = false
    button.textContent = '开始阅读'
  }
  return _interactiveCameraState
}

function showLandingPage(work, callback) {
  var phs = work.placeholders || []
  var hasPassword = !!(work.password && work.password.trim())
  var rememberedValues = cloneReaderPlaceholderValues(
    savedReaderBook(work.id)?.placeholderValues || work.readerPhValues || {},
  )

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
      var rememberedValue = rememberedValues[ph.id]?.[0]
      h += '<div class="rd-landing-field">'
      h += '<label>' + esc(ph.label || ph.key) + '</label>'
      h += '<input type="text" class="rd-landing-input" data-ph-id="' + escapeHtmlAttribute(ph.id || '') + '" value="' + escapeHtmlAttribute(typeof rememberedValue === 'string' ? rememberedValue : (ph.default || '')) + '" placeholder="' + escapeHtmlAttribute(ph.prompt || '') + '">'
      h += '<div class="rd-placeholder-error" data-ph-error="' + escapeHtmlAttribute(ph.id || '') + '" role="alert" hidden></div>'
      h += '</div>'
    })
    h += '<button class="rd-landing-preset-btn" id="rdPresetBtn">从预设填入</button>'
    h += '</div>'
  }

  if (workUsesCameraInteractions(work)) {
    h += '<div class="rd-landing-divider"></div>'
    h += '<div class="rd-landing-section rd-camera-preflight">'
    h += '<div class="rd-landing-section-title">沉浸互动权限</div>'
    h += '<p class="rd-landing-desc">本作品含有“脸部靠近”互动。开始时会申请前置摄像头权限；画面只在当前设备处理，不录制、不保存、不上传，也不会使用麦克风。</p>'
    h += '<p class="rd-camera-preflight-status" id="rdCameraPreflightStatus" role="status" aria-live="polite">如果拒绝或设备不支持，剧情会改用作者设置的备用操作。</p>'
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
    saveReaderWorkPlaceholders(work, values)
    function enterWork() {
      if (!overlay.isConnected) return
      overlay.remove()
      callback()
    }
    if (workUsesCameraInteractions(work)) {
      ensureInteractiveCameraPreflight(
        overlay.querySelector('#rdCameraPreflightStatus'),
        overlay.querySelector('#rdStartBtn'),
      ).then(enterWork)
    } else {
      enterWork()
    }
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
  var libraryById = new Map(getReaderLibraryState().books.map(function(book) {
    return [book.id, book]
  }))
  var entries = (collection.workIds || []).map(function(workId, authoredIndex) {
    return {
      workId:workId,
      authoredIndex:authoredIndex,
      work:readerCollectionWork(workId),
    }
  }).filter(function(entry) {
    return !!entry.work
  }).sort(function(left, right) {
    return readerBookPinOrder(
      libraryById.get(left.workId),
      libraryById.get(right.workId),
    ) || left.authoredIndex - right.authoredIndex
  })
  var h = '<main class="rd-collection-directory">'
  h += '<button type="button" class="reader-back" data-reader-library title="返回个人主页" aria-label="返回个人主页">←</button>'
  if (collection.coverImage && isSafeImageUrl(collection.coverImage)) h += '<img class="rd-collection-cover" src="' + escapeHtmlAttribute(collection.coverImage) + '" alt="">'
  h += '<header class="rd-collection-directory-head"><span class="rd-collection-kicker">作品集</span><h1>' + esc(collection.title || '未命名作品集') + '</h1>'
  if (collection.author) h += '<p class="rd-collection-author">' + esc(collection.author) + '</p>'
  if (collection.description) h += '<p>' + esc(collection.description) + '</p>'
  if (collection.authorNote) h += '<div class="rd-collection-note">' + esc(collection.authorNote) + '</div>'
  h += '</header><section class="rd-collection-directory-list" aria-label="作品目录">'
  entries.forEach(function(entry, index) {
    var work = entry.work
    h += '<button type="button" class="rd-collection-directory-item" data-reader-collection-work="' + escapeHtmlAttribute(entry.workId) + '"><span class="rd-collection-number">' + String(index + 1).padStart(2, '0') + '</span><span><strong>' + esc(work.title || '无标题作品') + '</strong><small>' + (work.type === 'phone' ? '小手机' : '互动文章') + '</small></span><span aria-hidden="true">→</span></button>'
  })
  if (!entries.length) h += '<div class="rd-empty">作品内容不在本地，请重新导入这个作品集</div>'
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
  flushReaderPositionSave()
  if (!work.type) { alert('无效的作品文件'); return }
  var rememberWork = !options || options.remember !== false
  _readerPersistenceEnabled = rememberWork
  var incomingReaderValues = cloneReaderPlaceholderValues(work.readerPhValues || {})
  var previousBook = rememberWork && work.id ? savedReaderBook(work.id) : null
  if (previousBook && Object.keys(previousBook.placeholderValues || {}).length) {
    work.readerPhValues = cloneReaderPlaceholderValues(previousBook.placeholderValues)
  }
  _work = work
  resetReaderPhoneChoiceSession(work)
  resetReaderPhoneFlowSession(work)
  resetArticleReaderSession()
  _readerPendingReadingPosition = null
  _readerPhoneLocation = null
  _interactiveSceneCameraSession?.stop()
  _interactiveSceneCameraSession = null
  _interactiveSceneController?.destroy()
  _interactiveSceneController = null
  _interactiveCameraState = { granted:false, detectorAvailable:false, reason:"", preflighted:false }
  _activeReaderCollectionId = options && options.collectionId || ''
  var rememberedBook = rememberWork ? rememberReaderWorkState(work) : null
  if (
    rememberWork
    && rememberedBook
    && !Object.keys(rememberedBook.placeholderValues || {}).length
    && Object.keys(incomingReaderValues).length
  ) {
    saveReaderWorkPlaceholders(work, incomingReaderValues)
    rememberedBook = savedReaderBook(work.id)
  }
  if (rememberWork && options?.resume !== false && rememberedBook?.progress?.kind === 'article') {
    var restoredArticle = restoreArticleReadingState(work, rememberedBook.progress)
    if (restoredArticle) {
      _articlePath = restoredArticle.path
      _articleChoiceMemory = restoredArticle.choiceMemory
      _articleInteractionSelections = restoredArticle.interactionSelections
      _articleCheckpoints = restoredArticle.checkpoints
      _readerPendingReadingPosition = restoredArticle.readingPosition
    }
  }
  if (rememberWork && options?.resume !== false && rememberedBook?.progress?.kind === 'phone') {
    var phoneFlow = readerPhoneFlowSession(work)
    phoneFlow.index = Math.min(rememberedBook.progress.flowIndex, phoneFlow.sequence.length)
    _readerPendingReadingPosition = rememberedBook.progress.readingPosition
  }
  if (rememberWork) {
    var cached = !!options?.cachePrepared
    if (!cached && !options?.skipCache) {
      cached = tryReaderStorageWrite(function() {
        localStorage.setItem('moirain_work_' + work.id, serializedReaderWorkCache(work))
      })
    }
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
  if (options && options.skipLanding && workUsesCameraInteractions(work)) {
    showLandingPage(Object.assign({}, work, {password:"", placeholders:[]}), startReading)
  } else if (options && options.skipLanding) startReading()
  else showLandingPage(work, startReading)
  return true
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
  saveCurrentReaderProgress()
  setReaderWorkCompletion(work?.id, session.sequence.length > 0 && session.index >= session.sequence.length)
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

function readerAppearancePackageTransferMarkup() {
  return '<section class="reader-appearance-transfer" aria-labelledby="readerAppearanceTransferTitle">' +
    '<div class="rs-group-heading"><span id="readerAppearanceTransferTitle">美化包</span><small>文章、手机与 App 外观可一起分享</small></div>' +
    '<p>仅包含外观设置。不会包含昵称 / ID、头像、简介、作品、书架、密码或阅读记录。</p>' +
    '<p class="reader-appearance-transfer-assets">会包含你主动设置的壁纸、个人主页顶部图、字体和图标；分享前请确认这些素材适合公开。</p>' +
    '<div class="reader-appearance-transfer-actions">' +
    '<button type="button" class="rs-action-btn" data-reader-appearance-export>导出美化包</button>' +
    '<button type="button" class="rs-action-btn subtle" data-reader-appearance-import>导入美化包</button>' +
    '</div><p class="reader-appearance-transfer-status" role="status" aria-live="polite"></p></section>'
}

function validateReaderAppearancePackageCss(appearance) {
  var checks = [
    compileScopedReaderCss(appearance.article.customCss || '', '.reader-article-css-scope'),
    compileScopedReaderCss(appearance.phone.customCss || '', '.reader-phone-css-scope'),
  ]
  var appSettings = readerPlainRecord(appearance.phone.appSettings)
  ;['messages', 'forum', 'memo', 'gallery', 'browser', 'shopping', 'contacts'].forEach(function(type) {
    var settings = readerPlainRecord(appSettings[type])
    checks.push(compileScopedReaderCss(settings.customCss || '', '.rd-phone-app-' + type))
  })
  var invalid = checks.find(function(result) { return !result.ok })
  if (invalid) throw new TypeError('美化包中的 CSS 无法安全应用：' + invalid.error)
}

function installReaderAppearancePackage(raw) {
  var appearance = inspectReaderAppearancePackage(raw)
  validateReaderAppearancePackageCss(appearance)
  var article = normalizeReaderAppearance(appearance.article)
  var phone = normalizePhoneCustom(readerOwnDataRecord(getPhoneCustom(), appearance.phone))
  var articleKey = 'moirain_readerSettings'
  var phoneKey = 'moirain_phoneCustom'
  var previousArticle = localStorage.getItem(articleKey)
  var previousPhone = localStorage.getItem(phoneKey)
  try {
    localStorage.setItem(articleKey, JSON.stringify(article))
    localStorage.setItem(phoneKey, JSON.stringify(phone))
  } catch (error) {
    try {
      if (previousArticle === null) localStorage.removeItem(articleKey)
      else localStorage.setItem(articleKey, previousArticle)
      if (previousPhone === null) localStorage.removeItem(phoneKey)
      else localStorage.setItem(phoneKey, previousPhone)
    } catch (_) {}
    throw error
  }
  applyReaderCustomFonts(article)
  applyCompiledReaderStyle(article.customCss, '.reader-article-css-scope', 'reader-article-user-css')
  applyCustomFonts()
  applyPhoneCustomCss(phone)
  document.querySelectorAll('.article-content').forEach(function(content) {
    applyReaderSettings(content, article)
  })
  return { article: article, phone: phone }
}

function bindReaderAppearancePackageTransfer(root, options) {
  var exportButton = root.querySelector('[data-reader-appearance-export]')
  var importButton = root.querySelector('[data-reader-appearance-import]')
  var status = root.querySelector('.reader-appearance-transfer-status')
  var callbacks = options || {}
  if (exportButton) exportButton.onclick = function() {
    try {
      var serialized = serializeReaderAppearancePackage({
        article: getReaderSettings(),
        phone: getPhoneCustom(),
      })
      downloadBlob(
        new Blob([serialized], { type:'application/json;charset=utf-8' }),
        'Tuuru-读者美化包.json',
      )
      if (status) status.textContent = '已导出；个人资料与阅读数据未包含在内。'
    } catch (error) {
      if (status) status.textContent = error && error.message ? error.message : '美化包导出失败'
    }
  }
  if (importButton) importButton.onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      if (file.size > READER_APPEARANCE_PACKAGE_MAX_BYTES) {
        if (status) status.textContent = '美化包过大，无法导入。'
        return
      }
      var reader = new FileReader()
      reader.onload = function() {
        try {
          var installed = installReaderAppearancePackage(reader.result)
          if (status) status.textContent = '美化包已导入；现有昵称、头像等个人资料保持不变。'
          showReaderToast('美化包已导入，个人资料未更改')
          if (typeof callbacks.onImported === 'function') callbacks.onImported(installed)
        } catch (error) {
          if (status) status.textContent = error && error.message ? error.message : '美化包导入失败'
        }
      }
      reader.onerror = function() {
        if (status) status.textContent = '无法读取美化包，请重新选择文件。'
      }
      reader.readAsText(file)
    }
    input.click()
  }
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


function openReaderSettingsPanel(triggerElement, panelOptions) {
  var readingPosition = panelOptions?.readingPosition || captureArticleReadingPosition()
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

  var body = readerAppearancePagerMarkup() +
    '<div class="rs-panel-body appearance-workbench-pages" data-appearance-active-page="preview">'
  body += '<aside class="rs-preview-pane appearance-workbench-page" data-appearance-page="preview"><div class="rs-preview" aria-label="阅读外观实时预览"><div class="rs-preview-copy reader-article-css-preview-scope">'
  body += '<div class="article-progress" aria-hidden="true"><span class="dot visited"></span><span class="dot current"></span><span class="dot"></span></div>'
  body += '<h3 class="article-title">雾色来信</h3><div class="article-meta">试读章节 · 刚刚</div>'
  body += '<div class="article-content"><section class="article-node"><h4 class="article-node-title">窗边</h4><p>晨光落在纸页上，文字与留白会跟随右侧设置实时变化。</p><p>这里也会显示段距、首行缩进和对齐效果。</p>'
  body += '<div class="article-choices"><button type="button" class="article-choice-btn" tabindex="-1"><span class="label">1.</span><span>继续阅读</span></button></div></section></div>'
  body += '</div></div><p class="rs-live-status" id="rsLiveStatus" role="status" aria-live="polite">实时预览 · 修改后自动保存</p></aside>'
  body += '<div class="rs-controls appearance-workbench-page" data-appearance-page="controls">'
  body += cuSettingsSectionStart('rsTypography', '文字排版', true)

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

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsStructure', '标题与结构', false)
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

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsFonts', '字体', false)
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
    body += '<div class="rs-local-font-row"><input class="rd-input" data-rs-font-name="' + cfi2 + '" value="' + escapeHtmlAttribute(customFonts[cfi2].name) + '" aria-label="字体名称"><button type="button" class="rs-action-btn subtle" data-rs-rename-font="' + cfi2 + '">保存名称</button><button type="button" class="rs-action-btn subtle" data-rs-replace-font="' + cfi2 + '">替换文件</button><button type="button" class="rs-delete-font-btn" data-rs-del-font="' + cfi2 + '">删除</button></div>'
  }
  body += '</div>'
  body += '</div>'

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsMedia', '选项与图片', false)
  body += '<div class="rs-section"><div class="rs-group-heading"><span>选项与图片</span><small>让互动按钮和插图融入正文排版</small></div><div class="rs-control-grid">'
  body += '<label class="rs-range-field" for="rsImageRadius"><span>图片圆角 <output id="rsImageRadiusVal">' + rs.imageRadius + 'px</output></span><input type="range" id="rsImageRadius" class="rs-range" min="0" max="24" value="' + rs.imageRadius + '"></label>'
  body += '<label class="rs-range-field" for="rsChoiceGap"><span>选项间距 <output id="rsChoiceGapVal">' + rs.choiceGap + 'px</output></span><input type="range" id="rsChoiceGap" class="rs-range" min="4" max="28" step="2" value="' + rs.choiceGap + '"></label>'
  body += '<label class="rs-range-field" for="rsChoiceRadius"><span>选项圆角 <output id="rsChoiceRadiusVal">' + rs.choiceRadius + 'px</output></span><input type="range" id="rsChoiceRadius" class="rs-range" min="0" max="20" value="' + rs.choiceRadius + '"></label>'
  body += '</div></div>'

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsThemeBackground', '主题与背景', false)
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

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsReadingEffects', '阅读效果', false)
  // Typing effect
  body += '<div class="rs-section">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="rsTyping"' + (rs.typingEffect ? ' checked' : '') + '> 打字机效果</label>'
  body += '<div class="rs-section-title" style="margin-top:8px">速度: <span id="rsTypingSpeedVal">' + (rs.typingSpeed || 50) + '</span>ms</div>'
  body += '<input type="range" id="rsTypingSpeed" class="rs-range" min="10" max="500" step="5" value="' + (rs.typingSpeed || 50) + '"></div>'

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsAdvancedCss', '高级 CSS', false, 'rs-css-section')
  body += '<div class="rs-section rs-css-section"><div class="rs-group-heading"><span>高级 CSS</span><small>只作用于文章区域，输入时即时校验</small></div>'
  body += '<textarea id="rsCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="rsCssHint rsCssError" placeholder=".article-title { letter-spacing: .08em; }">' + esc(rs.customCss || '') + '</textarea>'
  body += '<div class="rs-css-meta"><p class="rs-field-hint" id="rsCssHint">支持普通选择器与属性；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="rsCssCount">' + String((rs.customCss || '').length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>'
  body += '<p class="rs-field-error" id="rsCssError" role="alert" hidden></p><div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="rsCssExample">填入示例</button><button type="button" class="rs-action-btn subtle" id="rsClearCss">清空 CSS</button></div></div>'

  body += cuSettingsSectionEnd()
  body += cuSettingsSectionStart('rsAppearanceTransfer', '外观迁移', false)
  body += readerAppearancePackageTransferMarkup()
  body += cuSettingsSectionEnd()
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
  bindReaderAppearancePager(ov)

  var activeTrigger = triggerElement && triggerElement.isConnected ? triggerElement : document.activeElement
  var dialog = ov.querySelector('.rs-sheet')
  var closeButton = ov.querySelector('#rsClose')
  function closePanel(options) {
    var restoreFocus = !options || options.restoreFocus !== false
    var restorePosition = !options || options.restorePosition !== false
    var previewStyle = document.getElementById('reader-article-preview-user-css')
    if (previewStyle) previewStyle.remove()
    ov.remove()
    if (restorePosition) restoreArticleReadingPosition(readingPosition)
    if (restoreFocus && activeTrigger && activeTrigger.isConnected && activeTrigger.focus) activeTrigger.focus()
  }
  ov.addEventListener('click', function(e) { if (e.target === ov) closePanel() })
  closeButton.onclick = function() { closePanel() }
  bindReaderAppearancePackageTransfer(ov, {
    onImported:function() {
      closePanel({ restoreFocus:false, restorePosition:false })
      openReaderSettingsPanel(activeTrigger, {readingPosition:readingPosition})
    }
  })
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
      if (valEl) { var lbl = ov.querySelector(valEl); if (lbl) setReaderRangeOutput(lbl, format ? format(v) : v) }
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
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      var r = new FileReader()
      r.onload = function() {
        try {
          rs.customFonts = addReaderLocalFont(rs.customFonts, { name: name, data: r.result })
          rs.fontFamily = readerLocalFontFamily(rs.customFonts[rs.customFonts.length - 1].name)
          persistAndPreview()
          closePanel({ restoreFocus: false })
          openReaderSettingsPanel(activeTrigger)
        } catch (error) {
          showReaderToast(error.message || '字体保存失败')
        }
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  ov.querySelectorAll('[data-rs-rename-font]').forEach(function(b) {
    b.onclick = function() {
      var idx = parseInt(b.dataset.rsRenameFont, 10)
      var input = ov.querySelector('[data-rs-font-name="' + idx + '"]')
      var previous = rs.customFonts && rs.customFonts[idx]
      try {
        rs.customFonts = renameReaderLocalFont(rs.customFonts, idx, input && input.value)
        if (previous && rs.fontFamily === readerLocalFontFamily(previous.name)) {
          rs.fontFamily = readerLocalFontFamily(rs.customFonts[idx].name)
        }
        persistAndPreview()
        closePanel({ restoreFocus: false })
        openReaderSettingsPanel(activeTrigger)
      } catch (error) {
        showReaderToast(error.message || '字体改名失败')
      }
    }
  })
  ov.querySelectorAll('[data-rs-replace-font]').forEach(function(b) {
    b.onclick = function() {
      var idx = parseInt(b.dataset.rsReplaceFont, 10)
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = '.ttf,.otf,.woff,.woff2'
      input.onchange = function() {
        var file = input.files && input.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function() {
          try {
            rs.customFonts = replaceReaderLocalFont(rs.customFonts, idx, reader.result)
            persistAndPreview()
            closePanel({ restoreFocus: false })
            openReaderSettingsPanel(activeTrigger)
          } catch (error) {
            showReaderToast(error.message || '字体替换失败')
          }
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  })
  // Font delete buttons
  ov.querySelectorAll('[data-rs-del-font]').forEach(function(b) {
    b.onclick = function() {
      var idx = parseInt(b.dataset.rsDelFont)
      var removedFont = rs.customFonts[idx]
      rs.customFonts = deleteReaderLocalFont(rs.customFonts, idx)
      if (removedFont && rs.fontFamily === readerLocalFontFamily(removedFont.name)) rs.fontFamily = READER_APPEARANCE_DEFAULTS.fontFamily
      persistAndPreview()
      closePanel({ restoreFocus: false })
      openReaderSettingsPanel(activeTrigger)
    }
  })

  function applyArticleAppearanceSnapshot(snapshot) {
    rs = saveReaderSettings(snapshot)
    var rangeValues = {
      rsFontSize:[rs.fontSize, ''],
      rsLineH:[rs.lineHeight, ''],
      rsLetterS:[rs.letterSpacing, ''],
      rsParaS:[rs.paragraphSpacing, ''],
      rsMargin:[rs.marginSize, ''],
      rsContentWidth:[rs.contentWidth, ''],
      rsTitleSize:[rs.titleSize, 'px'],
      rsTitleSpacing:[rs.titleSpacing, 'px'],
      rsMetaSpacing:[rs.metaSpacing, 'px'],
      rsSectionSpacing:[rs.sectionSpacing, 'px'],
      rsImageRadius:[rs.imageRadius, 'px'],
      rsChoiceGap:[rs.choiceGap, 'px'],
      rsChoiceRadius:[rs.choiceRadius, 'px'],
      rsBgOverlay:[rs.backgroundOverlay, ''],
      rsTypingSpeed:[rs.typingSpeed, '']
    }
    Object.keys(rangeValues).forEach(function(id) {
      var range = ov.querySelector('#' + id)
      if (range) range.value = rangeValues[id][0]
      setReaderRangeOutput(ov.querySelector('#' + id + 'Val'), rangeValues[id][0] + rangeValues[id][1])
    })
    ;[['rsBgColor', rs.backgroundColor], ['rsTextColor', rs.textColor], ['rsAccentColor', rs.accentColor]].forEach(function(binding) {
      var input = ov.querySelector('#' + binding[0])
      if (input) input.value = readerColorInputValue(binding[1])
    })
    if (indentCb) indentCb.checked = rs.indentFirstLine
    if (typingCb) typingCb.checked = rs.typingEffect
    syncPressedButtons('[data-rs-align]', 'rsAlign', rs.textAlign)
    syncPressedButtons('[data-rs-title-weight]', 'rsTitleWeight', String(rs.titleWeight))
    syncPressedButtons('[data-rs-theme]', 'rsTheme', rs.theme)
    syncPressedButtons('[data-rs-fit]', 'rsFit', rs.backgroundFit)
    syncPressedButtons('[data-rs-position]', 'rsPosition', rs.backgroundPosition)
    ov.querySelectorAll('[data-rs-font]').forEach(function(button) {
      button.classList.toggle('active', button.dataset.rsFont === rs.fontFamily)
    })
    document.querySelectorAll('.article-content').forEach(function(content) { applyReaderSettings(content, rs) })
    applyReaderSettingsPreview(ov, rs)
  }

  enhanceReaderAppearanceRanges(ov)
  bindReaderAppearanceSectionStates(ov)
  bindReaderAppearanceUndo(ov, {
    capture:function() { return JSON.parse(JSON.stringify(rs)) },
    restore:applyArticleAppearanceSnapshot
  })
  ov.querySelector('.rs-preview-copy').addEventListener('click', function(event) {
    var sectionId = event.target.closest('h3') ? 'rsStructure'
      : (event.target.closest('.rs-preview-choice') ? 'rsMedia'
        : (event.target.closest('p, h4') ? 'rsTypography' : 'rsThemeBackground'))
    var section = ov.querySelector('#' + sectionId)
    if (section) {
      ov.querySelectorAll('.rs-controls > .cu-settings-section').forEach(function(candidate) { candidate.open = candidate === section })
      section.classList.add('is-preview-targeted')
      globalThis.setTimeout(function() { if (section.isConnected) section.classList.remove('is-preview-targeted') }, 650)
      var settingsPage = ov.querySelector('[data-appearance-page-target="controls"]')
      if (settingsPage) settingsPage.click()
    }
  })

  // Reset
  var resetBtn = ov.querySelector('#rsReset')
  if (resetBtn) resetBtn.onclick = function() {
    rs = Object.assign({}, READER_APPEARANCE_DEFAULTS, { customFonts: rs.customFonts || [] })
    persistAndPreview()
    closePanel({ restoreFocus:false, restorePosition:false })
    openReaderSettingsPanel(activeTrigger, {readingPosition:readingPosition})
  }
}

function openReaderInteractiveScene(sceneId, options = {}) {
  var sourceScene = readerInteractiveSceneById(_work, sceneId)
  if (!sourceScene) return
  var nodePage = options.nodePage === true
  var returnReadingPosition = captureArticleReadingPosition()
  var returnFocusSceneId = String(sceneId || '')
  var scene = substituteInteractiveSceneText(sourceScene, _work.placeholders || [], {
    valuesMap:_work.readerPhValues || {},
    usePlaceholderMode:false,
  })
  var signal = createFaceNearSignal()
  var cameraDebugEnabled = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    || new URLSearchParams(window.location.search).get('cameraDebug') === '1'
  var cameraDebugState = {
    state:'waiting',
    samples:0,
    faces:0,
    span:0,
    nearEvents:0,
    hotspotClicks:0,
    activations:0,
    armed:false,
    errors:0,
    lastError:'',
  }
  var sceneCameraState = Object.assign({}, _interactiveCameraState, {
    subscribe:signal.subscribe,
  })

  _interactiveSceneCameraSession?.stop()
  _interactiveSceneCameraSession = null
  _interactiveSceneController?.destroy()
  _interactiveSceneController = null

  var html = '<main class="rd-interactive-scene-page">'
  html += '<button type="button" class="rd-interactive-scene-exit" aria-label="返回文章" title="返回文章">←</button>'
  html += '<div class="rd-interactive-scene-mount"></div>'
  html += '<video class="rd-interactive-camera-feed" muted playsinline aria-hidden="true"></video>'
  if (cameraDebugEnabled) html += '<output class="rd-interactive-camera-debug" aria-live="polite"></output>'
  html += '</main>'
  render('app', html)
  document.body.classList.add('rd-interactive-scene-active')

  var page = document.querySelector('.rd-interactive-scene-page')
  var mount = page?.querySelector('.rd-interactive-scene-mount')
  var cameraVideo = page?.querySelector('.rd-interactive-camera-feed')
  var cameraDebugOutput = page?.querySelector('.rd-interactive-camera-debug')
  if (!page || !mount) return

  function renderCameraDebug(patch) {
    if (!cameraDebugOutput) return
    Object.assign(cameraDebugState, patch || {})
    var spanLabel = Number.isFinite(cameraDebugState.span)
      ? Math.round(cameraDebugState.span * 1000) / 10 + '%'
      : '无'
    cameraDebugOutput.textContent = [
      '摄像头：' + cameraDebugState.state,
      '采样 ' + cameraDebugState.samples
        + '｜人脸 ' + cameraDebugState.faces
        + '｜占屏 ' + spanLabel,
      '靠近事件 ' + cameraDebugState.nearEvents
        + '｜热区点击 ' + cameraDebugState.hotspotClicks
        + '｜成功触发 ' + cameraDebugState.activations,
      '组合状态：' + (cameraDebugState.armed ? '已识别靠近，等待点击' : '未解锁'),
      cameraDebugState.lastError ? '异常：' + cameraDebugState.lastError : '',
    ].filter(Boolean).join('\n')
  }

  _interactiveSceneController = mountInteractiveScene(mount, scene, {
    documentObject:document,
    cameraState:sceneCameraState,
    onInteraction:function() {
      renderCameraDebug({activations:cameraDebugState.activations + 1})
    },
    onSceneComplete:nodePage ? function() {
      closeScene({completed:true})
    } : undefined,
  })
  renderCameraDebug({
    state:sceneCameraState.granted && sceneCameraState.detectorAvailable
      ? '准备启动'
      : '权限或检测器不可用',
  })
  if (cameraDebugOutput) {
    page.addEventListener('click', function(event) {
      var hotspot = event.target instanceof Element
        ? event.target.closest('.interactive-scene-hotspot')
        : null
      if (!hotspot) return
      cameraDebugState.hotspotClicks += 1
      queueMicrotask(function() {
        renderCameraDebug({
          armed:mount.querySelector('.interactive-scene')?.dataset.faceArmed === 'true',
        })
      })
    }, true)
  }
  requestAnimationFrame(function() { page.classList.add('is-visible') })

  function closeScene(closeOptions) {
    var completed = closeOptions?.completed === true
    _interactiveSceneCameraSession?.stop()
    _interactiveSceneCameraSession = null
    _interactiveSceneController?.destroy()
    _interactiveSceneController = null
    signal.clear()
    document.removeEventListener('keydown', handleSceneKeydown)
    document.body.classList.remove('rd-interactive-scene-active')
    if (nodePage) {
      var scenePathIndex = _articlePath.length - 1
      var sceneNodeId = _articlePath[scenePathIndex] || ''
      var branchSourcePathIndex = -1
      for (var pathIndex = scenePathIndex - 1; pathIndex >= 0; pathIndex--) {
        var pathNodeId = _articlePath[pathIndex] || ''
        var pathNode = ((_work && _work.nodes) || []).find(function(candidate) {
          return String(candidate?.id || '') === String(pathNodeId)
        })
        if (pathNode?.kind === 'conditional') continue
        if ((pathNode?.choices || []).some(function(choice) {
          return choice.mode !== 'interaction' && String(choice.targetId || '') === String(sceneNodeId)
        })) branchSourcePathIndex = pathIndex
        break
      }
      var returnPathIndex = branchSourcePathIndex
      if (returnPathIndex < 0) {
        for (var returnIndex = scenePathIndex - 1; returnIndex >= 0; returnIndex--) {
          var returnNode = ((_work && _work.nodes) || []).find(function(candidate) {
            return String(candidate?.id || '') === String(_articlePath[returnIndex] || '')
          })
          if (returnNode?.kind === 'conditional') continue
          returnPathIndex = returnIndex
          break
        }
      }
      if (!completed && returnPathIndex >= 0) {
        replaceArticlePath(_articlePath.slice(0, returnPathIndex + 1))
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
        restoreArticleReadingPosition(returnReadingPosition)
        requestAnimationFrame(function() {
          var returnTrigger = document.querySelector('[data-reader-enter-interactive-scene]')
          if (returnTrigger && returnTrigger.focus) returnTrigger.focus()
        })
        return
      }
      var sceneNodes = (_work && _work.nodes) || []
      var explicitNextNodeId = String(scene?.nextNodeId || "")
      var sceneTransition = explicitNextNodeId
        ? appendArticleChoice(
          sceneNodes,
          _articlePath,
          scenePathIndex,
          explicitNextNodeId,
          articleRuntimeOptions(),
        )
        : continueArticleChapterPath(
          sceneNodes,
          _articlePath,
          scenePathIndex,
          articleRuntimeOptions(),
        )
      if (sceneTransition.ok && sceneTransition.path.length > _articlePath.length) {
        replaceArticlePath(sceneTransition.path)
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
      } else if (explicitNextNodeId) {
        render('app', '<div class="drop-zone"><p>互动图片的后续跳转节点已失效，请联系作者修复。</p><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>')
        var homeButton = document.querySelector('[data-reader-home]')
        if (homeButton) homeButton.onclick = renderHome
      } else {
        renderHome()
      }
      return
    }
    renderArticleReader()
    restoreArticleReadingPosition(returnReadingPosition)
    requestAnimationFrame(function() {
      var returnTrigger = Array.from(document.querySelectorAll('.rd-interactive-scene-trigger')).find(function(trigger) {
        return trigger.dataset.interactiveScene === returnFocusSceneId
      })
      if (returnTrigger && returnTrigger.focus) returnTrigger.focus()
    })
  }
  function handleSceneKeydown(event) {
    if (event.key === 'Escape') closeScene()
  }
  page.querySelector('.rd-interactive-scene-exit').onclick = closeScene
  document.addEventListener('keydown', handleSceneKeydown)

  if (workUsesCameraInteractions({interactiveScenes:[scene]})
      && sceneCameraState.granted
      && sceneCameraState.detectorAvailable) {
    startInteractiveFaceNearSession({
      documentObject:document,
      videoElement:cameraVideo,
      onSample:function(sample) {
        renderCameraDebug({
          state:'正在识别',
          samples:cameraDebugState.samples + 1,
          faces:sample.faceCount,
          span:sample.faceSpanRatio,
        })
      },
      onDetectionError:function(error) {
        renderCameraDebug({
          state:'检测异常',
          errors:cameraDebugState.errors + 1,
          lastError:String(error?.message || error || 'unknown').slice(0, 160),
        })
      },
      onNear:function() {
        cameraDebugState.nearEvents += 1
        signal.emit()
        renderCameraDebug({
          state:'已判定靠近',
          armed:mount.querySelector('.interactive-scene')?.dataset.faceArmed === 'true',
        })
      },
    }).then(function(session) {
      if (!page.isConnected) {
        session.stop()
        return
      }
      _interactiveSceneCameraSession = session
      renderCameraDebug({state:'正在识别'})
    }).catch(function() {
      sceneCameraState.detectorAvailable = false
      sceneCameraState.reason = 'camera-unavailable'
      renderCameraDebug({state:'启动失败', errors:cameraDebugState.errors + 1})
      _interactiveSceneController?.goToStage(_interactiveSceneController.stage.id)
    })
  }
}

function readerInteractionResponseHTML(choice) {
  if (!choice) return ''
  var hasAuthoredSelectedText = Object.prototype.hasOwnProperty.call(choice, 'selectedText')
  var selectedResponse = hasAuthoredSelectedText
    ? (choice.selectedText == null ? '' : String(choice.selectedText))
    : (choice.text || '选项')
  if (selectedResponse === '') return ''
  var h = '<div class="article-interaction-response article-content">'
  selectedResponse.replace(/\r\n?/g, '\n').split('\n').forEach(function(line) {
    h += '<p>' + (line === '' ? '<br>' : esc(line)) + '</p>'
  })
  h += '</div>'
  return h
}

function readerInteractionGroupHTML(group, sourceNodeId, sourcePathIndex) {
  var selectedChoiceId = selectedArticleInteractionChoice(_articleInteractionSelections, group.id)
  var h = '<div class="article-interaction-group article-choices is-interaction" data-interaction-group="' + escapeHtmlAttribute(group.id) + '">'
  if (group.label) h += '<div class="article-interaction-label">' + esc(group.label) + '</div>'
  ;(group.choices || []).forEach(function(choice, choiceIndex) {
    var selected = selectedChoiceId === String(choice.id || '')
    h += '<button class="article-choice-btn' + (selected ? ' is-selected' : '') + '" data-source-path-index="' + sourcePathIndex + '" data-choice-node-id="' + escapeHtmlAttribute(sourceNodeId) + '" data-interaction-group-id="' + escapeHtmlAttribute(group.id) + '" data-choice-id="' + escapeHtmlAttribute(choice.id || '') + '" data-choice-mode="interaction" aria-pressed="' + (selected ? 'true' : 'false') + '"><span class="label">' + (choiceIndex + 1) + '.</span><span>' + esc(choice.text || '选项') + '</span></button>'
  })
  if (selectedChoiceId) {
    var selectedChoice = (group.choices || []).find(function(choice) {
      return String(choice?.id || '') === selectedChoiceId
    })
    h += readerInteractionResponseHTML(selectedChoice)
  }
  h += '</div>'
  return h
}

function replaceArticleInteractionAnchors(content, node, sourcePathIndex) {
  if (typeof content !== 'string' || !content.includes(ARTICLE_INTERACTION_MARKER_CLASS)) return content
  var template = document.createElement('template')
  template.innerHTML = content
  var groups = new Map((node?.interactionGroups || []).map(function(group) { return [group.id, group] }))
  var seen = new Set()
  template.content.querySelectorAll('.' + ARTICLE_INTERACTION_MARKER_CLASS).forEach(function(marker) {
    var groupId = marker.getAttribute('data-article-interaction-group') || ''
    var group = groups.get(groupId)
    if (!group || seen.has(groupId)) {
      marker.remove()
      return
    }
    seen.add(groupId)
    var holder = document.createElement('template')
    holder.innerHTML = readerInteractionGroupHTML(group, node.id, sourcePathIndex)
    marker.replaceWith(holder.content.firstElementChild)
  })
  return template.innerHTML
}

function renderArticleReader() {
  if (!_work || _work.type === 'phone') return renderPhoneReader()
  var nodes = _work.nodes || []
  if (!_articlePath.length) {
    var initialNodeId = resolveAutomaticArticleStartNodeId(_work)
    if (initialNodeId) _articlePath = [initialNodeId]
  }
  replaceArticlePath(expandArticleChapterPath(nodes, _articlePath, articleRuntimeOptions()))
  _nodeId = _articlePath[_articlePath.length - 1] || null
  var node = nodes.find(function(n) { return n.id === _nodeId })
  if (!node) {
    render('app', '<div class="drop-zone"><p>作品内容为空</p><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>')
    return
  }
  var chapterEntries = currentArticleChapterEntries(nodes, _articlePath)
  if (!chapterEntries.length) chapterEntries = [{node:node, pathIndex:_articlePath.length - 1}]
  var sceneEntryPending = false
  var pendingScene = null
  if (isInteractiveSceneNode(node)) {
    var nodeScene = interactiveSceneForNode(_work, node)
    if (!nodeScene) {
      render('app', '<div class="drop-zone"><p>互动页数据不存在</p><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>')
      return
    }
    var sceneEntryCandidates = chapterEntries.filter(function(entry) {
      return entry.pathIndex < _articlePath.length - 1
    })
    var lastBranchBarrierIndex = -1
    sceneEntryCandidates.forEach(function(entry, index) {
      if ((entry.node?.choices || []).some(function(choice) {
        return choice.mode !== 'interaction'
      })) lastBranchBarrierIndex = index
    })
    var hasPreScenePage = sceneEntryCandidates
      .slice(lastBranchBarrierIndex + 1)
      .some(function(entry) {
        return !isInteractiveSceneNode(entry.node)
      })
    if (hasPreScenePage) {
      sceneEntryPending = true
      pendingScene = nodeScene
    } else {
      openReaderInteractiveScene(nodeScene.id, {nodePage:true})
      return
    }
  }

  var phs = _work.placeholders || []
  var currentChapterId = String(node.chapterId || '')
  var chapters = Array.isArray(_work.chapters) ? _work.chapters : []
  var currentChapter = chapters.find(function(chapter) { return String(chapter.id || '') === currentChapterId })
  var chapterTitle = typeof currentChapter?.name === 'string' ? currentChapter.name : ''

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
  h += '<nav class="reader-immersive-toolbar is-visible" data-reader-immersive-toolbar aria-label="阅读工具" aria-hidden="false">'
  if (hasPreviousChapter) {
    h += '<button type="button" class="reader-back" data-reader-previous title="返回上一章" aria-label="返回上一章"><span class="reader-immersive-icon" aria-hidden="true">←</span><span class="reader-immersive-label">上一章</span></button>'
  } else {
    h += '<button type="button" class="reader-back" data-reader-home title="返回首页" aria-label="返回首页"><span class="reader-immersive-icon" aria-hidden="true">←</span><span class="reader-immersive-label">返回</span></button>'
  }
  h += '<button type="button" class="reader-search-btn" data-reader-search title="搜索已解锁内容" aria-label="搜索已解锁内容"><span class="reader-immersive-icon" aria-hidden="true">⌕</span><span class="reader-immersive-label">搜索</span></button>'
  var activeBookmark = currentArticleBookmark(savedReaderBook(_work.id))
  var bookmarkLabel = chapterTitle || String(node.title || '').trim() || ('第 ' + _articlePath.length + ' 段')
  h += '<button type="button" class="reader-bookmark-btn" data-reader-bookmark-current title="' + (activeBookmark ? '移除场景书签' : '收藏当前场景') + '" aria-label="' + (activeBookmark ? '移除当前场景书签' : '收藏当前场景') + '" aria-pressed="' + (activeBookmark ? 'true' : 'false') + '"><span class="reader-immersive-icon" data-reader-bookmark-icon aria-hidden="true">' + (activeBookmark ? '★' : '☆') + '</span><span class="reader-immersive-label">书签</span></button>'
  h += '<button type="button" class="reader-settings-btn" title="文章阅读外观" aria-label="打开文章阅读外观"><span class="reader-immersive-icon reader-immersive-aa" aria-hidden="true">Aa</span><span class="reader-immersive-label">外观</span></button>'
  h += '</nav>'
  h += '<button type="button" class="reader-immersive-reveal" data-reader-immersive-reveal hidden aria-label="显示阅读工具" aria-expanded="true">•••</button>'
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
    if (isInteractiveSceneNode(entryNode)) return
    var content = entryNode.content || ''
    if (phs.length > 0 && _work.readerPhValues) {
      content = substitutePlaceholders(content, phs, {valuesMap:_work.readerPhValues, usePlaceholderMode:false})
    }
    var cleanContent = replaceInteractiveSceneCards(content, _work)
    cleanContent = cleanContent.replace(/<div class="pm-inline-card"[^>]*>[\s\S]*?<\/div>/gi, '<span class="rd-pm-marker"></span>')
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
    cleanContent = replaceArticleInteractionAnchors(cleanContent, entryNode, entry.pathIndex)

    var isActive = entryIndex === chapterEntries.length - 1
    h += '<section class="article-node' + (isActive ? ' is-active' : ' is-resolved') + '" data-article-path-index="' + entry.pathIndex + '">'
    h += '<div class="article-content"' + (isActive ? ' data-active="true"' : '') + '>' + cleanContent + '</div>'
    var choices = (entryNode.choices || []).filter(function(choice) { return choice.mode !== 'interaction' })
    if (choices.length > 0) {
      h += '<div class="article-choices is-branch" data-choice-node-id="' + escapeHtmlAttribute(entryNode.id) + '">'
      choices.forEach(function(c, ci) {
        var targetState = resolveArticleChoiceTarget(nodes, c.targetId)
        var selected = _articleChoiceMemory[entryNode.id] === String(c.id)
        var disabled = targetState.ok ? '' : ' disabled aria-disabled="true" title="这个去向已被删除，请联系作者"'
        var warning = targetState.ok ? '' : '<span class="article-choice-error">去向已失效</span>'
        h += '<button class="article-choice-btn' + (selected ? ' is-selected' : '') + '" data-source-path-index="' + entry.pathIndex + '" data-choice-node-id="' + escapeHtmlAttribute(entryNode.id) + '" data-choice-id="' + escapeHtmlAttribute(c.id || '') + '" data-choice-mode="branch" data-target="' + escapeHtmlAttribute(c.targetId || '') + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' + disabled + '><span class="label">' + (ci + 1) + '.</span><span>' + esc(c.text || '选项') + '</span>' + warning + '</button>'
      })
      h += '</div>'
    }
    h += '</section>'
  })
  if (sceneEntryPending) {
    h += '<div style="text-align:center;padding:24px"><button type="button" class="drop-btn" data-reader-enter-interactive-scene aria-label="进入互动场景">进入互动场景</button></div>'
  }
  var frontierChoices = chapterEntries[chapterEntries.length - 1].node.choices || []
  var frontierBranchChoices = frontierChoices.filter(function(choice) { return choice.mode !== 'interaction' })
  var interactionCanContinue = false
  if (frontierChoices.length > 0 && frontierBranchChoices.length === 0) {
    var frontierPathIndex = chapterEntries[chapterEntries.length - 1].pathIndex
    var continuation = continueArticleInteraction(nodes, _articlePath, frontierPathIndex, articleRuntimeOptions())
    interactionCanContinue = continuation.ok && continuation.path.length > _articlePath.length
  }
  var nextChapter = nextArticleChapterPath(nodes, chapters, _articlePath, articleRuntimeOptions())
  if (!sceneEntryPending && frontierBranchChoices.length === 0 && !interactionCanContinue) {
    if (nextChapter.ok) {
      h += '<div style="text-align:center;padding:24px"><button type="button" class="drop-btn" data-reader-next aria-label="阅读下一章">NEXT</button></div>'
    } else {
      h += '<div style="text-align:center;padding:24px"><button type="button" class="drop-btn" data-reader-home>返回首页</button></div>'
    }
  }
  h += '</div>'

  render('app', h)
  saveCurrentReaderProgress()
  var phoneFlowSession = readerPhoneFlowSession(_work)
  if (phoneFlowSession.enabled && phoneFlowSession.sequence.length) {
    setReaderWorkCompletion(
      _work.id,
      phoneFlowSession.index >= phoneFlowSession.sequence.length,
    )
  }
  var reachedArticleEnding = !sceneEntryPending
    && frontierBranchChoices.length === 0
    && !interactionCanContinue
    && !nextChapter.ok
  setReaderWorkCompletion(_work.id, reachedArticleEnding)

  // Apply reader settings and bind controls as soon as the article enters the DOM.
  var rs = getReaderSettings()
  var articleContents = Array.from(document.querySelectorAll('.article-content'))
  articleContents.forEach(function(contentElement) { applyReaderSettings(contentElement, rs) })
  var ac = document.querySelector('.article-content[data-active="true"]')
  var savedPassage = _readerPendingReadingPosition?.kind === 'article'
    ? _readerPendingReadingPosition
    : null
  if (savedPassage) {
    restoreArticleReadingPosition(savedPassage)
    _readerPendingReadingPosition = null
    scheduleReaderPositionSave()
  }
  var sb = document.querySelector('.reader-settings-btn')
  if (sb) sb.onclick = function() { openReaderSettingsPanel(sb) }
  var readerSearchButton = document.querySelector('[data-reader-search]')
  if (readerSearchButton) readerSearchButton.onclick = function() {
    openReaderUnlockedSearch(readerSearchButton)
  }
  var bookmarkButton = document.querySelector('[data-reader-bookmark-current]')
  if (bookmarkButton) bookmarkButton.onclick = function() {
    var latestBook = toggleCurrentArticleBookmark(bookmarkLabel)
    var selected = !!currentArticleBookmark(latestBook)
    bookmarkButton.setAttribute('aria-pressed', String(selected))
    bookmarkButton.setAttribute('aria-label', selected ? '移除当前场景书签' : '收藏当前场景')
    bookmarkButton.title = selected ? '移除场景书签' : '收藏当前场景'
    var bookmarkIcon = bookmarkButton.querySelector('[data-reader-bookmark-icon]')
    if (bookmarkIcon) bookmarkIcon.textContent = selected ? '★' : '☆'
  }
  bindArticleImmersiveToolbar()
  if (sceneEntryPending) {
    var enterScene = document.querySelector('[data-reader-enter-interactive-scene]')
    if (enterScene) enterScene.onclick = function() { openReaderInteractiveScene(pendingScene.id, {nodePage:true}) }
  }

  // Keep the optional typing effect delayed so layout and settings are already stable.
  setTimeout(function() {
    if (ac && !savedPassage && shouldUseMotion(rs.typingEffect)) {
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

  document.querySelectorAll('.rd-interactive-scene-trigger').forEach(function(trigger) {
    trigger.onclick = function() {
      openReaderInteractiveScene(trigger.dataset.interactiveScene, {triggerElement:trigger})
    }
  })

  // Bind choices
  var btns = document.querySelectorAll('.article-choice-btn')
  btns.forEach(function(btn) {
    btn.onclick = function() {
      if (!beginArticleChoiceCommit(btn)) return
      var choiceUndoSnapshot = captureArticleChoiceUndoSnapshot(btn)
      var choiceUndoLabel = String(btn.textContent || '').replace(/\s+/g, ' ').trim()
      if (btn.dataset.choiceMode === 'interaction') {
        var nodeId = btn.dataset.choiceNodeId || ''
        var interactionGroupId = btn.dataset.interactionGroupId || ''
        var interactionChoiceId = btn.dataset.choiceId || ''
        var interactionSourcePathIndex = Number(btn.dataset.sourcePathIndex)
        if (interactionGroupId) {
          if (!canRecordArticleInteraction(nodeId, interactionGroupId, interactionChoiceId)) return
          var group = readerArticleInteractionGroup(nodeId, interactionGroupId)
          var interactionCheckpoint = selectionPrefixState(interactionSourcePathIndex, nodeId)
          if (interactionCheckpoint) {
            captureArticleCheckpoint(
              nodeId,
              String(btn.textContent || '互动选择').trim(),
              interactionCheckpoint.path,
              interactionCheckpoint.state.memory,
              interactionCheckpoint.state.interactionSelections,
            )
          }
          if (group?.legacyAdvanceOnSelect === true) {
            var legacySelection = selectionPrefixState(interactionSourcePathIndex, nodeId)
            if (!legacySelection) return
            var nextInteractionSelections = recordArticleInteractionSelection(
              legacySelection.state.interactionSelections,
              interactionGroupId,
              nodeId,
              interactionChoiceId,
            )
            legacySelection.state.interactionSelections = nextInteractionSelections
            var legacyTransition = continueArticleInteraction(
              nodes,
              legacySelection.path,
              interactionSourcePathIndex,
              articleRuntimeOptions(legacySelection.state.memory, nextInteractionSelections),
            )
            if (!legacyTransition.ok) return
            applyArticleRouteState(legacyTransition.path, legacySelection.state)
          } else {
            var currentPath = _articlePath.slice()
            var updatedInteractionSelections = recordArticleInteractionSelection(
              _articleInteractionSelections,
              interactionGroupId,
              nodeId,
              interactionChoiceId,
            )
            var reconciledPath = reconcileArticleConditionalPath(
              nodes,
              currentPath,
              articleRuntimeOptions(_articleChoiceMemory, updatedInteractionSelections),
            )
            var reconciledState = articleRouteStateForPath(currentPath, reconciledPath)
            reconciledState.interactionSelections = pruneArticleInteractionSelections(
              updatedInteractionSelections,
              reconciledPath,
            )
            applyArticleRouteState(reconciledPath, reconciledState)
          }
          _nodeId = _articlePath[_articlePath.length - 1]
          _visitedNodes = _articlePath.slice(0, -1)
          renderArticleReader()
          offerArticleChoiceUndo(choiceUndoSnapshot, choiceUndoLabel)
          var selectedGroup = Array.from(document.querySelectorAll('[data-interaction-group]')).find(function(element) {
            return element.dataset.interactionGroup === interactionGroupId
          })
          if (selectedGroup && typeof selectedGroup.scrollIntoView === 'function') {
            selectedGroup.scrollIntoView({block:'nearest'})
          }
          return
        }
        var interactionSelection = selectionPrefixState(interactionSourcePathIndex, nodeId)
        if (!interactionSelection) return
        var interactionMemory = candidateReaderArticleChoiceMemory(interactionSelection.state.memory, nodeId, interactionChoiceId)
        if (!interactionMemory) {
          delete interactionSelection.state.memory[nodeId]
          delete interactionSelection.state.interactionSelections[nodeId]
          applyArticleRouteState(interactionSelection.path, interactionSelection.state)
          _nodeId = _articlePath[_articlePath.length - 1]
          _visitedNodes = _articlePath.slice(0, -1)
          renderArticleReader()
          return
        }
        var interactionTransition = continueArticleInteraction(nodes, interactionSelection.path, interactionSourcePathIndex, articleRuntimeOptions(interactionMemory))
        if (!interactionTransition.ok) return
        interactionSelection.state.memory = interactionMemory
        interactionSelection.state.interactionSelections[nodeId] = interactionChoiceId
        applyArticleRouteState(interactionTransition.path, interactionSelection.state)
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
        offerArticleChoiceUndo(choiceUndoSnapshot, choiceUndoLabel)
        var interactionActiveNode = document.querySelector('.article-node.is-active')
        if (interactionActiveNode && typeof interactionActiveNode.scrollIntoView === 'function') {
          interactionActiveNode.scrollIntoView({block:'start'})
        }
        return
      }
      var sourcePathIndex = Number(btn.dataset.sourcePathIndex)
      var sourceNodeId = btn.dataset.choiceNodeId || ''
      var branchSelection = selectionPrefixState(sourcePathIndex, sourceNodeId)
      if (!branchSelection) return
      var branchMemory = candidateReaderArticleChoiceMemory(branchSelection.state.memory, sourceNodeId, btn.dataset.choiceId || '')
      if (!branchMemory) {
        delete branchSelection.state.memory[sourceNodeId]
        delete branchSelection.state.interactionSelections[sourceNodeId]
        applyArticleRouteState(branchSelection.path, branchSelection.state)
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
        return
      }
      var targetState = resolveArticleChoiceTarget(nodes, btn.dataset.target)
      if (targetState.ok) {
        var transition = appendArticleChoice(nodes, branchSelection.path, sourcePathIndex, targetState.targetId, articleRuntimeOptions(branchMemory))
        if (!transition.ok) return
        captureArticleCheckpoint(
          sourceNodeId,
          String(btn.textContent || '分支选择').replace(/\s+/g, ' ').trim(),
          branchSelection.path,
          branchSelection.state.memory,
          branchSelection.state.interactionSelections,
        )
        branchSelection.state.memory = branchMemory
        applyArticleRouteState(transition.path, branchSelection.state)
        _nodeId = _articlePath[_articlePath.length - 1]
        _visitedNodes = _articlePath.slice(0, -1)
        renderArticleReader()
        offerArticleChoiceUndo(choiceUndoSnapshot, choiceUndoLabel)
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
      var returnReadingPosition = captureArticleReadingPosition()
      var d = pm.data || {}
      var contacts = orderedContacts(visiblePhoneModuleContacts(d), d.contactSortMode)
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
        restoreArticleReadingPosition(returnReadingPosition)
        if (trig.isConnected && trig.focus) trig.focus()
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
  skin.dynamicIslandStyle = normalizeDynamicIslandStyle(rc.dynamicIslandStyle || skin.dynamicIslandStyle)
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
    h += '<div class="phone-island"><div class="phone-island-pill" data-island-style="' + normalizeDynamicIslandStyle(skin.dynamicIslandStyle) + '"></div></div>'
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
  if (_readerPendingReadingPosition?.kind !== 'phone') _readerPhoneLocation = null
  var h = '<button type="button" class="reader-back" data-reader-home title="返回" aria-label="返回首页">←</button>'
  h += '<div class="phone-reader">'
  h += buildPhoneHTML(pd, rc, _work.watermark, flowStep)
  h += '</div>'
  render('app', h)
  saveCurrentReaderProgress()

  var icons = document.querySelectorAll('.phone-app-icon')
  function openSelectedReaderApp(type, readingPosition) {
    var activeStep = currentReaderPhoneFlowStep(_work)
    var selectedStep = activeStep && phoneReadingFlowAppType(activeStep) === type ? activeStep : null
    openReaderApp(
      type,
      Number.isInteger(readingPosition?.contactIndex) && readingPosition.contactIndex >= 0
        ? readingPosition.contactIndex
        : undefined,
      readingPosition ? true : undefined,
      selectedStep,
    )
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
  var savedPhonePosition = _readerPendingReadingPosition?.kind === 'phone'
    ? _readerPendingReadingPosition
    : null
  if (savedPhonePosition) {
    var savedAppIcon = Array.from(icons).find(function(icon) {
      return icon.dataset.appType === savedPhonePosition.appType
    })
    if (savedAppIcon) {
      openSelectedReaderApp(savedPhonePosition.appType, savedPhonePosition)
    } else {
      _readerPendingReadingPosition = null
      _readerPhoneLocation = null
      saveCurrentReaderProgress()
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
  _readerPhoneLocation = {
    appType:String(type || ''),
    view:'app',
    itemId:'',
    contactIndex:Number.isInteger(Number(contactIndex)) ? Number(contactIndex) : -1,
  }
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
    var appBody = phoneFrame.querySelector('.rd-phone-app-body')
    bindPhoneReadingPosition(appBody)
    if (
      _readerPendingReadingPosition?.kind === 'phone'
      && _readerPendingReadingPosition.appType === type
      && _readerPendingReadingPosition.view === 'app'
    ) {
      restorePhoneReadingScroll(_readerPendingReadingPosition, appBody)
      _readerPendingReadingPosition = null
      scheduleReaderPositionSave()
    }
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

    var savedMessagesPosition = _readerPendingReadingPosition?.kind === 'phone'
      && _readerPendingReadingPosition.appType === 'messages'
      ? _readerPendingReadingPosition
      : null
    var savedChatIndex = savedMessagesPosition?.view === 'chat'
      ? chats.findIndex(function(chat) {
        return String(chat.id || '') === String(savedMessagesPosition.itemId || '')
      })
      : -1
    if (savedMessagesPosition?.view === 'chat' && savedChatIndex < 0) {
      _readerPendingReadingPosition = Object.assign({}, savedMessagesPosition, {
        view:'app',
        itemId:'',
        anchorId:'',
        anchorOffset:0,
      })
    }
    if (savedChatIndex >= 0) {
      openReaderChat(phoneFrame, w, pd, chats[savedChatIndex], savedChatIndex, flowStep)
    } else if (flowStep && flowStep.type === 'moments') {
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
  _readerPhoneLocation = {
    appType:'messages',
    view:'chat',
    itemId:String(ch && ch.id || ''),
    contactIndex:-1,
  }
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
    var chatBackgroundImage = ast.chatBgImage ? 'url("' + ast.chatBgImage + '")' : 'none'
    var chatTone = readerChatTonePresentation(ast.chatBgTone)
    var h = '<div class="rd-phone-app-panel rd-phone-app-messages chat-author-shell chat-reader-shell" style="display:flex;flex-direction:column;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;font-size:12px;--chat-editor-screen:' + sanitizeCssColor(ast.chatBg) + ';--chat-editor-image:' + escapeHtmlAttribute(chatBackgroundImage) + ';--chat-bg-size:' + ast.chatBgFit + ';--chat-bg-position:' + ast.chatBgPositionX + '% ' + ast.chatBgPositionY + '%;--chat-bg-overlay-color:' + chatTone.color + ';--chat-bg-overlay-opacity:' + chatTone.opacity + ';--chat-bubble-weight:' + ast.bubbleFontWeight + ';--chat-send-bg:' + sanitizeCssColor(ast.sendButtonBg, { fallback: '#cda9b1' }) + ';--chat-send-ink:' + readerReadableTextColor(ast.sendButtonBg) + ';' + readerBubbleSkinVariables(ast) + readerChatReadabilityVariables(ast) + '">'

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
          h += '<div class="rd-chat-time' + (isFlowTargetMessage(msg, round) ? ' is-flow-target' : '') + '" data-message-id="' + escapeHtmlAttribute(msg.id) + '" style="text-align:center;padding:6px 0;font-size:.62rem;color:var(--chat-time-color,#b0b8c4)">' + esc(msg.time || '') + '</div>'
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
        var bubbleSkinClass = readerBubbleSkinClass(ast, isSelf ? 'self' : 'other')
        var bubbleSkinRowClass = readerMessageUsesBubbleShell(msg) ? bubbleSkinClass : ''
        var reselectRunKey = reselectRunsByReply.get(messageLocationKey(ri, msg.id)) || ''
        h += '<div class="chat-msg rd-chat-message ' + (isSelf ? 'self is-self' : 'other is-other') + bubbleSkinRowClass + (isFlowTargetMessage(msg, round) ? ' is-flow-target' : '') + '" data-message-id="' + escapeHtmlAttribute(msg.id) + '">'
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
          h += '<div class="chat-bubble' + bubbleSkinClass + '" style="' + bubbleStyle + '">'
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
          h += '<div class="chat-bubble' + bubbleSkinClass + '" style="' + bubbleStyle + ';cursor:pointer;min-width:100px" onclick="var t=this.querySelector(\'.cv-text\');t.style.display=t.style.display==\'none\'?\'block\':\'none\'">'
          h += '<svg width="' + (barCount * 5 + 2) + '" height="20" viewBox="0 0 ' + (barCount * 5 + 2) + ' 20" style="fill:currentColor;opacity:.7">' + bars + '</svg>'
          h += '<span style="font-size:.65rem;margin-left:4px;opacity:.6">' + dur + '"</span>'
          h += '<span class="cv-text" style="display:none;font-size:.75rem;margin-top:4px;line-height:1.4">' + esc(resolvedMessageText) + '</span>'
          h += '</div>'
        } else {
          h += '<div class="chat-bubble' + bubbleSkinClass + '" style="' + bubbleStyle + '">'
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
    bindPhoneReadingPosition(chatMessageArea)
    if (
      _readerPendingReadingPosition?.kind === 'phone'
      && _readerPendingReadingPosition.appType === 'messages'
      && _readerPendingReadingPosition.view === 'chat'
      && _readerPendingReadingPosition.itemId === String(ch && ch.id || '')
    ) {
      restorePhoneReadingScroll(_readerPendingReadingPosition, chatMessageArea)
      _readerPendingReadingPosition = null
      scheduleReaderPositionSave()
    }

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
    showDynamicIsland: true, dynamicIslandStyle: 'pill', showHomeIndicator: true, showAppLabels: true,
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
  custom.dynamicIslandStyle = normalizeDynamicIslandStyle(custom.dynamicIslandStyle)
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
    h += '<div class="phone-island"><div class="phone-island-pill" data-island-style="' + normalizeDynamicIslandStyle(ct.dynamicIslandStyle) + '"></div></div>'
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

var _readerFeedbackCenter = null
var _readerFeedbackDocument = null

function readerFeedbackCenter() {
  if (!_readerFeedbackCenter || _readerFeedbackDocument !== document) {
    _readerFeedbackDocument = document
    _readerFeedbackCenter = createFeedbackCenter({
      documentObject:document,
      className:'rd-toast',
      duration:2500,
    })
  }
  return _readerFeedbackCenter
}

function showReaderToast(msg, type, options) {
  return readerFeedbackCenter().show(msg, type || 'success', options || {})
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
  var body = readerAppearancePagerMarkup() +
    '<div class="phone-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">'
  body += '<aside class="phone-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview"><div id="phoneAppearancePreview"></div><p class="phone-appearance-status" id="cuLiveStatus" role="status" aria-live="polite">实时预览 · 保存后保留</p></aside>'
  body += '<div class="phone-appearance-controls appearance-workbench-page" data-appearance-page="controls">'

  body += cuSettingsSectionStart('cuPhoneWallpaper', '壁纸与边框', true)
  body += '<div class="rs-group-heading"><small>颜色会即时映射到左侧手机</small></div>'
  body += '<div class="phone-appearance-swatches" role="group" aria-label="壁纸预设">'
  wallpaperPresets.forEach(function(preset) {
    body += '<button type="button" class="phone-appearance-swatch' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? ' active' : '') + '" data-cu-color="' + preset.color + '" aria-label="' + preset.name + '" aria-pressed="' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? 'true' : 'false') + '"><span style="background:' + preset.color + '"></span></button>'
  })
  body += '</div><div class="rs-color-controls phone-appearance-colors">'
  body += '<label class="rs-color-control">壁纸色<input type="color" class="rs-color-input" id="cuWallpaperColor" value="' + escapeHtmlAttribute(ct.wallpaper) + '"></label>'
  body += '<label class="rs-color-control">边框色<input type="color" class="rs-color-input" id="cuFrameColor" value="' + escapeHtmlAttribute(ct.frameColor) + '"></label>'
  body += '<label class="rs-color-control">系统标记<input type="color" class="rs-color-input" id="cuTimeColor" value="' + escapeHtmlAttribute(ct.timeColor) + '"></label></div>'
  body += '<div class="phone-appearance-image-row"><input type="url" class="rd-input" id="cuWpUrl" value="' + escapeHtmlAttribute(ct.wallpaperType === 'image' && ct.wallpaperImage && !/^data:/i.test(ct.wallpaperImage) ? ct.wallpaperImage : '') + '" placeholder="背景图片地址"><button type="button" class="rs-action-btn" id="cuApplyBg">应用</button><button type="button" class="rs-action-btn" id="cuUploadBg">本地图片</button><button type="button" class="rs-action-btn subtle" id="cuClearBg">清除</button></div>'
  body += '<p id="cuPhoneWallpaperState" class="cu-chat-background-state" aria-live="polite"></p><p class="rs-field-error" id="cuBgError" role="alert" hidden></p>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneDimensions', '尺寸与材质', false)
  body += '<div class="rs-group-heading"><small>边框圆角在宽屏手机框和预览中显示</small></div><div class="phone-appearance-range-grid">'
  body += phoneAppearanceRange('机身圆角', 'cuRadius', 0, 40, 1, ct.borderRadius, 'px')
  body += phoneAppearanceRange('界面字号', 'cuFontSize', 9, 20, 1, ct.fontSize, 'px')
  body += phoneAppearanceRange('图标圆角', 'cuIconRadius', 0, 27, 1, ct.iconBorderRadius, 'px')
  body += phoneAppearanceRange('材质透明度', 'cuMaterialOpacity', 20, 100, 1, ct.materialOpacity, '%')
  body += '</div>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneSystem', '字体与系统组件', false)
  body += '<div class="rs-group-heading"><small>这些设置同时作用于桌面和已接入 App</small></div>'
  body += '<label class="phone-appearance-select-label" for="cuFontFamily">手机字体<select class="rd-input" id="cuFontFamily">' + phoneAppearanceFontOptions(ct) + '</select></label>'
  body += '<div class="phone-appearance-font-actions"><button type="button" class="rs-action-btn subtle" id="cuUploadFont">上传字体</button><div id="cuFontList"></div></div>'
  body += '<div class="phone-appearance-toggles">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuIsland"' + (ct.showDynamicIsland ? ' checked' : '') + '> 灵动岛</label>'
  body += '<label class="phone-appearance-select-label" for="cuIslandStyle">灵动岛形状<select class="rd-input" id="cuIslandStyle"><option value="pill"' + (normalizeDynamicIslandStyle(ct.dynamicIslandStyle) === 'pill' ? ' selected' : '') + '>苹果圆角胶囊</option><option value="circle"' + (normalizeDynamicIslandStyle(ct.dynamicIslandStyle) === 'circle' ? ' selected' : '') + '>小圆形开孔</option></select></label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuLabels"' + (ct.showAppLabels ? ' checked' : '') + '> App 名称</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuHome"' + (ct.showHomeIndicator ? ' checked' : '') + '> Home 指示条</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuShadow"' + (ct.showIconShadow ? ' checked' : '') + '> 图标阴影</label>'
  body += '</div>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneCss', '高级 CSS', false, 'rs-css-section')
  body += '<div class="rs-group-heading"><small>只作用于手机框内部，输入时即时校验</small></div>'
  body += '<textarea id="cuCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuCssHint cuCssError" placeholder=".phone-profile { box-shadow: none; }">' + esc(ct.customCss || '') + '</textarea>'
  body += '<div class="rs-css-meta"><p class="rs-field-hint" id="cuCssHint">支持普通选择器与属性；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuCssCount">' + (ct.customCss || '').length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>'
  body += '<p class="rs-field-error" id="cuCssError" role="alert" hidden></p><div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuCssExample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuClearCss">清空 CSS</button></div>' + cuSettingsSectionEnd()
  body += cuSettingsSection('cuPhoneTransfer', '外观迁移', readerAppearancePackageTransferMarkup(), false)
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
  bindReaderAppearancePager(ov)
  var previewHost = ov.querySelector('#phoneAppearancePreview')
  var saveButton = ov.querySelector('#cuModalSave')
  var cancelButton = ov.querySelector('#cuModalCancel')
  saveButton.id = 'cuSave'
  cancelButton.id = 'cuCancel'
  bindReaderAppearancePackageTransfer(ov, {
    onImported:function() {
      ov.closeReaderModal()
      renderCustomPage()
      var nextTrigger = document.querySelector('[data-reader-phone-control="appearance"]')
      openReaderCustomizePanel(nextTrigger)
    }
  })

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
      return '<div class="rs-local-font-row phone-appearance-font-row"><input class="rd-input" data-cu-font-name="' + index + '" value="' + escapeHtmlAttribute(font.name) + '" aria-label="字体名称"><button type="button" class="rs-action-btn subtle" data-cu-rename-font="' + index + '">保存名称</button><button type="button" class="rs-action-btn subtle" data-cu-replace-font="' + index + '">替换文件</button><button type="button" class="rs-delete-font-btn" data-cu-del-font="' + index + '">删除</button></div>'
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
      if (output) setReaderRangeOutput(output, input.value + (unit || ''))
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
  var islandStyleSelect = ov.querySelector('#cuIslandStyle')
  if (islandStyleSelect) islandStyleSelect.onchange = function() {
    updateDraft(function() { ct.dynamicIslandStyle = normalizeDynamicIslandStyle(islandStyleSelect.value) })
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
        return inspectReaderAppearanceImage(dataUrl, file.size)
      }).then(function(meta) {
        if (!meta || !ov.isConnected) return
        renderReaderAppearanceImageChoice(ov.querySelector('#cuPhoneWallpaperState'), meta, function(nextUrl, nextMeta) {
          applyWallpaperImage(nextUrl)
          renderReaderAppearanceImageChoice(ov.querySelector('#cuPhoneWallpaperState'), nextMeta, null)
          var section = ov.querySelector('#cuPhoneWallpaper')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
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
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      var reader = new FileReader()
      reader.onload = function() {
        try {
          ct.customFonts = addReaderLocalFont(ct.customFonts, { name:name, data:reader.result })
          ct.fontFamily = readerLocalFontFamily(ct.customFonts[ct.customFonts.length - 1].name)
          renderFontList()
          renderDraftPreview()
        } catch (error) {
          showReaderToast(error.message || '字体保存失败')
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
  var fontList = ov.querySelector('#cuFontList')
  if (fontList) fontList.onclick = function(event) {
    var button = event.target.closest('[data-cu-del-font],[data-cu-rename-font],[data-cu-replace-font]')
    if (!button) return
    var rawIndex = button.dataset.cuDelFont ?? button.dataset.cuRenameFont ?? button.dataset.cuReplaceFont
    var index = parseInt(rawIndex, 10)
    var current = ct.customFonts && ct.customFonts[index]
    if (button.dataset.cuRenameFont !== undefined) {
      var nameInput = fontList.querySelector('[data-cu-font-name="' + index + '"]')
      try {
        ct.customFonts = renameReaderLocalFont(ct.customFonts, index, nameInput && nameInput.value)
        if (current && ct.fontFamily === readerLocalFontFamily(current.name)) {
          ct.fontFamily = readerLocalFontFamily(ct.customFonts[index].name)
        }
        renderFontList()
        renderDraftPreview()
      } catch (error) {
        showReaderToast(error.message || '字体改名失败')
      }
      return
    }
    if (button.dataset.cuReplaceFont !== undefined) {
      var replacementInput = document.createElement('input')
      replacementInput.type = 'file'
      replacementInput.accept = '.ttf,.otf,.woff,.woff2'
      replacementInput.onchange = function() {
        var replacementFile = replacementInput.files && replacementInput.files[0]
        if (!replacementFile) return
        var replacementReader = new FileReader()
        replacementReader.onload = function() {
          try {
            ct.customFonts = replaceReaderLocalFont(ct.customFonts, index, replacementReader.result)
            renderDraftPreview()
          } catch (error) {
            showReaderToast(error.message || '字体替换失败')
          }
        }
        replacementReader.readAsDataURL(replacementFile)
      }
      replacementInput.click()
      return
    }
    ct.customFonts = deleteReaderLocalFont(ct.customFonts, index)
    if (current && ct.fontFamily === readerLocalFontFamily(current.name)) ct.fontFamily = readerPhoneCustomDefaults().fontFamily
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
      setReaderRangeOutput(ov.querySelector('#' + item[0] + 'Val'), item[1] + item[2])
    })
    ov.querySelector('#cuIsland').checked = ct.showDynamicIsland
    ov.querySelector('#cuIslandStyle').value = normalizeDynamicIslandStyle(ct.dynamicIslandStyle)
    ov.querySelector('#cuLabels').checked = ct.showAppLabels
    ov.querySelector('#cuHome').checked = ct.showHomeIndicator
    ov.querySelector('#cuShadow').checked = ct.showIconShadow
    ov.querySelector('#cuCustomCss').value = ''
    renderFontList()
    syncPresetButtons()
    setCssDraft('')
  }

  function applyPhoneAppearanceSnapshot(snapshot) {
    ct = normalizePhoneCustom(snapshot)
    ov.querySelector('#cuWallpaperColor').value = ct.wallpaper
    ov.querySelector('#cuFrameColor').value = ct.frameColor
    ov.querySelector('#cuTimeColor').value = ct.timeColor
    ov.querySelector('#cuWpUrl').value = ct.wallpaperType === 'image' && ct.wallpaperImage && !/^data:/i.test(ct.wallpaperImage) ? ct.wallpaperImage : ''
    ;[
      ['cuRadius', ct.borderRadius, 'px'],
      ['cuFontSize', ct.fontSize, 'px'],
      ['cuIconRadius', ct.iconBorderRadius, 'px'],
      ['cuMaterialOpacity', ct.materialOpacity, '%']
    ].forEach(function(item) {
      var range = ov.querySelector('#' + item[0])
      if (range) range.value = item[1]
      setReaderRangeOutput(ov.querySelector('#' + item[0] + 'Val'), item[1] + item[2])
    })
    ov.querySelector('#cuIsland').checked = ct.showDynamicIsland
    ov.querySelector('#cuIslandStyle').value = normalizeDynamicIslandStyle(ct.dynamicIslandStyle)
    ov.querySelector('#cuLabels').checked = ct.showAppLabels
    ov.querySelector('#cuHome').checked = ct.showHomeIndicator
    ov.querySelector('#cuShadow').checked = ct.showIconShadow
    ov.querySelector('#cuCustomCss').value = ct.customCss || ''
    renderFontList()
    syncPresetButtons()
    setCssDraft(ct.customCss || '')
  }

  enhanceReaderAppearanceRanges(ov)
  bindReaderAppearanceSectionStates(ov)
  bindReaderAppearanceUndo(ov, {
    capture:function() { return JSON.parse(JSON.stringify(ct)) },
    restore:applyPhoneAppearanceSnapshot
  })
  previewHost.addEventListener('click', function(event) {
    var sectionId = event.target.closest('.phone-profile') ? 'cuPhoneWallpaper'
      : (event.target.closest('.phone-icon-body, .phone-icon-label') ? 'cuPhoneDimensions'
        : (event.target.closest('.dynamic-island, .phone-home-indicator') ? 'cuPhoneSystem' : 'cuPhoneWallpaper'))
    focusReaderAppearanceSection(ov, sectionId, null, event.detail === 0)
  })
}

function openReaderProfilePanel(triggerElement) {
  var ct = getPhoneCustom()
  var identitySettings = cuRow('昵称',
    '<input class="rd-input" id="rpName" value="' + escapeHtmlAttribute(ct.readerId || '') + '" placeholder="默认使用作品昵称">')
  var avatarSettings = cuRow('头像',
    '<div class="rd-input-row"><input class="rd-input" id="rpAvatarUrl" value="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" placeholder="输入头像 URL"><button type="button" class="rs-action-btn subtle" id="rpUploadAv">上传</button></div>') +
    '<div class="rd-preview-img" id="rpAvatarPreview"' + (ct.readerAvatar ? '' : ' hidden') + '><img id="rpAvatarPreviewImage" src="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" alt="" style="border-radius:50%"><button type="button" class="rs-action-btn subtle" id="rpClearAv">清除</button></div>'
  var coverSettings = cuRow('顶部背景图',
    '<div class="rd-input-row"><input class="rd-input" id="rpTopBgUrl" value="' + escapeHtmlAttribute(ct.topBgImage || '') + '" placeholder="输入图片 URL"><button type="button" class="rs-action-btn subtle" id="rpUploadTop">上传</button></div>') +
    '<div class="rd-preview-img" id="rpTopBgPreview"' + (ct.topBgImage ? '' : ' hidden') + '><img id="rpTopBgPreviewImage" src="' + escapeHtmlAttribute(ct.topBgImage || '') + '" alt=""><button type="button" class="rs-action-btn subtle" id="rpClearTop">清除</button></div>'

  var controls = cuSettingsSection('cuProfileIdentity', '基本信息', identitySettings, true) +
    cuSettingsSection('cuProfileAvatar', '头像', avatarSettings, false) +
    cuSettingsSection('cuProfileCover', '顶部背景', coverSettings, false)
  var body = readerAppearancePagerMarkup() +
    '<div class="profile-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">' +
    '<aside class="profile-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview"><div id="profileAppearancePreview"></div><p class="phone-appearance-status">实时预览 · 保存后应用</p></aside>' +
    '<div class="profile-appearance-controls appearance-workbench-page" data-appearance-page="controls">' + controls + '</div></div>'

  var ov = openCuModal('个人信息', body, function(modal) {
    var nameInput = modal.querySelector('#rpName')
    var avatarInput = modal.querySelector('#rpAvatarUrl')
    var coverInput = modal.querySelector('#rpTopBgUrl')
    ct.readerId = nameInput && nameInput.value.trim() ? nameInput.value.trim() : ct.readerId
    ct.readerAvatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : null
    ct.topBgImage = coverInput && coverInput.value.trim() ? coverInput.value.trim() : null
    savePhoneCustom(ct)
    renderCustomPage()
    showReaderToast('个人信息已保存')
  }, triggerElement)
  var dialog = ov.querySelector('.cu-modal')
  dialog.classList.add('profile-appearance-workbench')
  var saveButton = ov.querySelector('#cuModalSave')
  var cancelButton = ov.querySelector('#cuModalCancel')
  var closeButton = ov.querySelector('.cu-modal-close')
  if (saveButton) saveButton.id = 'rpSave'
  if (cancelButton) cancelButton.id = 'rpCancel'
  if (closeButton) closeButton.id = 'rpCloseX'
  bindReaderAppearancePager(ov)

  function currentProfileDraft() {
    var draft = readerOwnDataRecord(ct)
    var nameInput = ov.querySelector('#rpName')
    var avatarInput = ov.querySelector('#rpAvatarUrl')
    var coverInput = ov.querySelector('#rpTopBgUrl')
    draft.readerId = nameInput && nameInput.value.trim() ? nameInput.value.trim() : ct.readerId
    draft.readerAvatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : null
    draft.topBgImage = coverInput && coverInput.value.trim() ? coverInput.value.trim() : null
    return draft
  }

  function renderProfilePreview() {
    var host = ov.querySelector('#profileAppearancePreview')
    if (!host) return
    host.innerHTML = renderPhonePreview(currentProfileDraft(), {
      scopeClass:'reader-profile-preview-scope',
      applyGlobalCss:false
    })
  }

  ;['#rpName', '#rpAvatarUrl', '#rpTopBgUrl'].forEach(function(selector) {
    var input = ov.querySelector(selector)
    if (input) input.addEventListener('input', renderProfilePreview)
  })
  function setProfileImageDraft(inputId, previewId, imageId, value) {
    var nextValue = String(value || '')
    var input = ov.querySelector(inputId)
    var preview = ov.querySelector(previewId)
    var image = ov.querySelector(imageId)
    if (input) input.value = nextValue
    if (image) image.src = nextValue
    if (preview) preview.hidden = !nextValue
    renderProfilePreview()
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
  renderProfilePreview()
  bindReaderAppearanceSectionStates(ov)
  bindReaderAppearanceUndo(ov, {
    capture:currentProfileDraft,
    restore:function(snapshot) {
      var name = ov.querySelector('#rpName')
      if (name) name.value = snapshot.readerId || ''
      setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', snapshot.readerAvatar)
      setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', snapshot.topBgImage)
    }
  })
  var profilePreview = ov.querySelector('#profileAppearancePreview')
  if (profilePreview) profilePreview.addEventListener('click', function(event) {
    var sectionId = event.target.closest('.phone-avatar') ? 'cuProfileAvatar'
      : (event.target.closest('.phone-profile') ? 'cuProfileCover' : 'cuProfileIdentity')
    focusReaderAppearanceSection(ov, sectionId, 'input', event.detail === 0)
  })
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
var verifiedReaderImageLuminance = new Map()

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
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error('图片没有可用尺寸'))
        return
      }
      var measured = measureReaderImageElementLuminance(image)
      if (Number.isFinite(measured)) verifiedReaderImageLuminance.set(dataUrl, measured)
      resolve(dataUrl)
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

function defaultReaderMessageSettings() {
  return {
    avatarShape: 'circle', avatarSize: 36,
    selfBubbleBg: '#555', selfBubbleText: '#fff', selfBubbleRadius: 8,
    selfBubbleSkinImage: null, selfBubbleSkinMode: 'full', selfBubbleSkinSize: 100,
    selfBubbleSkinSlice: 16, selfBubbleSkinPadding: 12,
    otherBubbleBg: '#fff', otherBubbleText: '#333', otherBubbleRadius: 8,
    otherBubbleSkinImage: null, otherBubbleSkinMode: 'full', otherBubbleSkinSize: 100,
    otherBubbleSkinSlice: 16, otherBubbleSkinPadding: 12,
    bubbleFontSize: 13, bubbleFontWeight: 400,
    timeColor: '#b0b8c4', chatBg: '#f0f0f0', sendButtonBg: '#cda9b1',
    composerAutoReadability: true,
    composerBg: '#f7f0ef', composerInputBg: '#fffafa',
    composerInputText: '#40383b', composerInputBorder: '#8f7b81',
    composerInputRadius: 2,
    chatBgFit: 'cover', chatBgPositionX: 50, chatBgPositionY: 50, chatBgTone: 0,
    chatAutoReadability: true,
    chatBgLuminance: null,
    callBackgroundType: 'preset',
    callBackgroundPreset: 'plain',
    callBackgroundImage: null
  }
}

function normalizedReaderBubbleSkin(settings, side) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var prefix = side === 'self' ? 'self' : 'other'
  var imageCandidate = validatedReaderCallBackgroundCandidate(source[prefix + 'BubbleSkinImage'])
  return {
    image: imageCandidate ? imageCandidate.dataUrl : null,
    mode: source[prefix + 'BubbleSkinMode'] === 'slice' ? 'slice' : 'full',
    size: boundedReaderSetting(source[prefix + 'BubbleSkinSize'], 100, 70, 220),
    slice: boundedReaderSetting(source[prefix + 'BubbleSkinSlice'], 16, 4, 40),
    padding: boundedReaderSetting(source[prefix + 'BubbleSkinPadding'], 12, 4, 32)
  }
}

function readerBubbleSkinClass(settings, side) {
  var skin = normalizedReaderBubbleSkin(settings, side)
  return skin.image ? ' has-bubble-skin bubble-skin-' + skin.mode : ''
}

function readerMessageUsesBubbleShell(message) {
  var type = message && message.type
  return ['time', 'call', 'link', 'redpacket', 'transfer', 'familycard', 'takeaway'].indexOf(type) < 0
}

function readerBubbleSkinVariables(settings) {
  var selfSkin = normalizedReaderBubbleSkin(settings, 'self')
  var otherSkin = normalizedReaderBubbleSkin(settings, 'other')
  var selfMinWidth = Math.min(250, Math.round(116 * selfSkin.size / 100))
  var selfMinHeight = Math.round(56 * selfSkin.size / 100)
  var selfMaxWidth = Math.min(260, Math.round(190 * selfSkin.size / 100))
  var otherMinWidth = Math.min(250, Math.round(116 * otherSkin.size / 100))
  var otherMinHeight = Math.round(56 * otherSkin.size / 100)
  var otherMaxWidth = Math.min(260, Math.round(190 * otherSkin.size / 100))
  return '--chat-self-bubble-skin:' + (selfSkin.image ? "url('" + selfSkin.image + "')" : 'none') + ';' +
    '--chat-self-bubble-min-width:' + selfMinWidth + 'px;' +
    '--chat-self-bubble-min-height:' + selfMinHeight + 'px;' +
    '--chat-self-bubble-max-width:' + selfMaxWidth + 'px;' +
    '--chat-self-bubble-slice:' + selfSkin.slice + ';' +
    '--chat-self-bubble-border:' + selfSkin.slice + 'px;' +
    '--chat-self-bubble-padding:' + selfSkin.padding + 'px;' +
    '--chat-other-bubble-skin:' + (otherSkin.image ? "url('" + otherSkin.image + "')" : 'none') + ';' +
    '--chat-other-bubble-min-width:' + otherMinWidth + 'px;' +
    '--chat-other-bubble-min-height:' + otherMinHeight + 'px;' +
    '--chat-other-bubble-max-width:' + otherMaxWidth + 'px;' +
    '--chat-other-bubble-slice:' + otherSkin.slice + ';' +
    '--chat-other-bubble-border:' + otherSkin.slice + 'px;' +
    '--chat-other-bubble-padding:' + otherSkin.padding + 'px;'
}

function measureReaderImageElementLuminance(image) {
  try {
    var canvasContextType = globalThis.CanvasRenderingContext2D ||
      (globalThis.window && globalThis.window.CanvasRenderingContext2D)
    if (typeof canvasContextType !== 'function') return null
    var canvas = document.createElement('canvas')
    canvas.width = 24
    canvas.height = 24
    var context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    var total = 0
    var count = 0
    for (var index = 0; index < pixels.length; index += 4) {
      var alpha = pixels[index + 3] / 255
      var channels = [
        pixels[index] * alpha + 240 * (1 - alpha),
        pixels[index + 1] * alpha + 240 * (1 - alpha),
        pixels[index + 2] * alpha + 240 * (1 - alpha)
      ]
      total += readerColorLuminance(channels)
      count += 1
    }
    return count ? Math.max(0, Math.min(1, total / count)) : null
  } catch (_) {
    return null
  }
}

function defaultReaderAppSettings(type) {
  var defaults = {
    messages: defaultReaderMessageSettings(),
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
  return readerOwnDataRecord({}, defaults[type] || {})
}

function getAppSettings(type) {
  var ct = getPhoneCustom()
  var defaults = defaultReaderAppSettings(type)
  var stored = ct.appSettings[type]
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {}
  var settings = readerOwnDataRecord(defaults, stored)
  settings.customCss = typeof settings.customCss === 'string'
    ? settings.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : ''
  if (type === 'messages') {
    settings = readerOwnDataRecord(settings, normalizedReaderCallBackgroundSettings(settings))
    settings = readerOwnDataRecord(settings, normalizedReaderChatAppearanceSettings(settings))
    var selfBubbleSkin = normalizedReaderBubbleSkin(settings, 'self')
    var otherBubbleSkin = normalizedReaderBubbleSkin(settings, 'other')
    settings.selfBubbleSkinImage = selfBubbleSkin.image
    settings.selfBubbleSkinMode = selfBubbleSkin.mode
    settings.selfBubbleSkinSize = selfBubbleSkin.size
    settings.selfBubbleSkinSlice = selfBubbleSkin.slice
    settings.selfBubbleSkinPadding = selfBubbleSkin.padding
    settings.otherBubbleSkinImage = otherBubbleSkin.image
    settings.otherBubbleSkinMode = otherBubbleSkin.mode
    settings.otherBubbleSkinSize = otherBubbleSkin.size
    settings.otherBubbleSkinSlice = otherBubbleSkin.slice
    settings.otherBubbleSkinPadding = otherBubbleSkin.padding
    settings.bubbleFontWeight = normalizedReaderBubbleFontWeight(settings.bubbleFontWeight)
    settings.sendButtonBg = sanitizeCssColor(settings.sendButtonBg, { fallback: '#cda9b1' })
    settings.composerAutoReadability = settings.composerAutoReadability !== false
    settings.composerBg = sanitizeCssColor(settings.composerBg, { fallback: '#f7f0ef' })
    settings.composerInputBg = sanitizeCssColor(settings.composerInputBg, { fallback: '#fffafa' })
    settings.composerInputText = sanitizeCssColor(settings.composerInputText, { fallback: '#40383b' })
    settings.composerInputBorder = sanitizeCssColor(settings.composerInputBorder, { fallback: '#8f7b81' })
    settings.composerInputRadius = Math.round(boundedReaderSetting(settings.composerInputRadius, 2, 0, 18))
    var chatBackgroundCandidate = validatedReaderCallBackgroundCandidate(settings.chatBgImage)
    settings.chatBgImage = chatBackgroundCandidate ? chatBackgroundCandidate.dataUrl : null
  }
  return settings
}

// ---- Apply app settings to styles ----
function appStyle(type) {
  var s = getAppSettings(type)
  var gallerySettings = normalizedReaderGallerySettings(s)
  var selfBubbleSkin = normalizedReaderBubbleSkin(s, 'self')
  var otherBubbleSkin = normalizedReaderBubbleSkin(s, 'other')
  var shape = s.avatarShape || 'circle'
  var avRadius = shape === 'circle' ? '50%' : (shape === 'rounded' ? '8px' : '2px')
  return {
    avatarRadius: avRadius,
    avatarSize: s.avatarSize || 36,
    selfBubbleBg: s.selfBubbleBg || '#555',
    selfBubbleText: s.selfBubbleText || '#fff',
    selfBubbleRadius: (s.selfBubbleRadius || 8) + 'px',
    selfBubbleSkinImage: selfBubbleSkin.image,
    selfBubbleSkinMode: selfBubbleSkin.mode,
    selfBubbleSkinSize: selfBubbleSkin.size,
    selfBubbleSkinSlice: selfBubbleSkin.slice,
    selfBubbleSkinPadding: selfBubbleSkin.padding,
    otherBubbleBg: s.otherBubbleBg || '#fff',
    otherBubbleText: s.otherBubbleText || '#333',
    otherBubbleRadius: (s.otherBubbleRadius || 8) + 'px',
    otherBubbleSkinImage: otherBubbleSkin.image,
    otherBubbleSkinMode: otherBubbleSkin.mode,
    otherBubbleSkinSize: otherBubbleSkin.size,
    otherBubbleSkinSlice: otherBubbleSkin.slice,
    otherBubbleSkinPadding: otherBubbleSkin.padding,
    bubbleFontSize: (s.bubbleFontSize || 13) + 'px',
    bubbleFontWeight: normalizedReaderBubbleFontWeight(s.bubbleFontWeight),
    timeColor: s.timeColor || '#b0b8c4',
    chatBg: s.chatBg || '#f0f0f0',
    chatBgImage: s.chatBgImage || null,
    chatBgFit: s.chatBgFit,
    chatBgPositionX: s.chatBgPositionX,
    chatBgPositionY: s.chatBgPositionY,
    chatBgTone: s.chatBgTone,
    chatAutoReadability: s.chatAutoReadability,
    chatBgLuminance: s.chatBgLuminance,
    sendButtonBg: sanitizeCssColor(s.sendButtonBg, { fallback: '#cda9b1' }),
    composerAutoReadability: s.composerAutoReadability !== false,
    composerBg: sanitizeCssColor(s.composerBg, { fallback: '#f7f0ef' }),
    composerInputBg: sanitizeCssColor(s.composerInputBg, { fallback: '#fffafa' }),
    composerInputText: sanitizeCssColor(s.composerInputText, { fallback: '#40383b' }),
    composerInputBorder: sanitizeCssColor(s.composerInputBorder, { fallback: '#8f7b81' }),
    composerInputRadius: Math.round(boundedReaderSetting(s.composerInputRadius, 2, 0, 18)),
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

function normalizedReaderBubbleFontWeight(value) {
  var weight = Number(value)
  if (weight === 500 || weight === 600) return 500
  if (weight === 700 || weight === 800) return 800
  return 400
}

function normalizedReaderChatAppearanceSettings(settings) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var luminance = typeof source.chatBgLuminance === 'number'
    ? source.chatBgLuminance
    : NaN
  return {
    chatBgFit: source.chatBgFit === 'contain' ? 'contain' : 'cover',
    chatBgPositionX: Math.round(boundedReaderSetting(source.chatBgPositionX, 50, 0, 100)),
    chatBgPositionY: Math.round(boundedReaderSetting(source.chatBgPositionY, 50, 0, 100)),
    chatBgTone: Math.round(boundedReaderSetting(source.chatBgTone, 0, -50, 50)),
    chatAutoReadability: source.chatAutoReadability !== false,
    chatBgLuminance: Number.isFinite(luminance) && luminance >= 0 && luminance <= 1
      ? luminance
      : null
  }
}

function readerChatTonePresentation(value) {
  var tone = Math.round(boundedReaderSetting(value, 0, -50, 50))
  return {
    color: tone > 0 ? '#ffffff' : '#000000',
    opacity: Math.abs(tone) / 100
  }
}

function readerHexColorChannels(value) {
  var color = String(value || '').trim()
  var shortMatch = color.match(/^#([\da-f])([\da-f])([\da-f])$/i)
  if (shortMatch) {
    return shortMatch.slice(1).map(function(channel) { return parseInt(channel + channel, 16) })
  }
  var fullMatch = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  return fullMatch ? fullMatch.slice(1).map(function(channel) { return parseInt(channel, 16) }) : null
}

function readerColorLuminance(channels) {
  return channels.map(function(channel) {
    var normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }).reduce(function(total, channel, index) {
    return total + channel * [0.2126, 0.7152, 0.0722][index]
  }, 0)
}

function readerReadableTextColor(background) {
  var backgroundChannels = readerHexColorChannels(background)
  if (!backgroundChannels) return '#241d20'
  var backgroundLuminance = readerColorLuminance(backgroundChannels)
  var darkLuminance = readerColorLuminance([36, 29, 32])
  var lightLuminance = 1
  var darkContrast = (backgroundLuminance + 0.05) / (darkLuminance + 0.05)
  var lightContrast = (lightLuminance + 0.05) / (backgroundLuminance + 0.05)
  return lightContrast > darkContrast ? '#ffffff' : '#241d20'
}

function readerChatReadabilityPresentation(settings) {
  var source = settings && typeof settings === 'object' ? settings : {}
  var manualComposer = {
    composerSurface: sanitizeCssColor(source.composerBg || '#f7f0ef'),
    inputSurface: sanitizeCssColor(source.composerInputBg || '#fffafa'),
    ink: sanitizeCssColor(source.composerInputText || '#40383b'),
    line: sanitizeCssColor(source.composerInputBorder || '#8f7b81'),
    placeholder: sanitizeCssColor(source.composerInputText || '#6d6266')
  }
  var enabled = source.chatAutoReadability !== false && !!source.chatBgImage
  if (!enabled) {
    return {
      time: sanitizeCssColor(source.timeColor || '#b0b8c4'),
      composerSurface: manualComposer.composerSurface,
      inputSurface: manualComposer.inputSurface,
      ink: manualComposer.ink,
      line: manualComposer.line,
      placeholder: manualComposer.placeholder
    }
  }
  var luminance = Number(source.chatBgLuminance)
  if (!Number.isFinite(luminance) || luminance < 0 || luminance > 1) {
    var backgroundChannels = readerHexColorChannels(source.chatBg || '#f0f0f0')
    luminance = backgroundChannels ? readerColorLuminance(backgroundChannels) : 0.72
  }
  var tone = Math.round(boundedReaderSetting(source.chatBgTone, 0, -50, 50)) / 100
  luminance = tone > 0
    ? luminance + (1 - luminance) * tone
    : luminance * (1 + tone)
  if (luminance < 0.46) {
    return {
      time: '#ffffff',
      composerSurface: source.composerAutoReadability !== false ? 'rgba(28,24,29,.92)' : manualComposer.composerSurface,
      inputSurface: source.composerAutoReadability !== false ? 'rgba(50,44,51,.96)' : manualComposer.inputSurface,
      ink: source.composerAutoReadability !== false ? '#ffffff' : manualComposer.ink,
      line: source.composerAutoReadability !== false ? 'rgba(255,255,255,.48)' : manualComposer.line,
      placeholder: source.composerAutoReadability !== false ? '#ded6da' : manualComposer.placeholder
    }
  }
  return {
    time: '#40383b',
    composerSurface: source.composerAutoReadability !== false ? 'rgba(255,250,250,.94)' : manualComposer.composerSurface,
    inputSurface: source.composerAutoReadability !== false ? 'rgba(255,255,255,.97)' : manualComposer.inputSurface,
    ink: source.composerAutoReadability !== false ? '#241d20' : manualComposer.ink,
    line: source.composerAutoReadability !== false ? 'rgba(64,56,59,.42)' : manualComposer.line,
    placeholder: source.composerAutoReadability !== false ? '#5f5358' : manualComposer.placeholder
  }
}

function readerChatReadabilityVariables(settings) {
  var presentation = readerChatReadabilityPresentation(settings)
  return '--chat-time-color:' + presentation.time +
    ';--chat-composer-surface:' + presentation.composerSurface +
    ';--chat-composer-input:' + presentation.inputSurface +
    ';--chat-composer-ink:' + presentation.ink +
    ';--chat-composer-line:' + presentation.line +
    ';--chat-composer-placeholder:' + presentation.placeholder +
    ';--chat-composer-radius:' + Math.round(boundedReaderSetting(settings && settings.composerInputRadius, 2, 0, 18)) + 'px'
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
  var beforeClose = null
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

  function closeModal(reason, force) {
    if (closed) return
    if (!force && beforeClose && beforeClose(reason || 'programmatic') === false) return
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
      closeModal('escape')
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

  ov.closeReaderModal = function() { closeModal('programmatic') }
  ov.forceCloseReaderModal = function() { closeModal('forced', true) }
  ov.setReaderBeforeClose = function(callback) {
    beforeClose = typeof callback === 'function' ? callback : null
  }
  ov.addEventListener('keydown', onModalKeydown)
  ov.addEventListener('click', function(e) { if (e.target === ov) closeModal('backdrop') })
  closeButton.onclick = function() { closeModal('button') }
  ov.querySelector('#cuModalCancel').onclick = function() { closeModal('cancel') }
  var saveButton = ov.querySelector('#cuModalSave')
  saveButton.onclick = function() {
    try {
      if (onSave) onSave(ov)
      closeModal('save', true)
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

function cuSettingsSectionStart(id, title, open, className) {
  return '<details class="cu-settings-section' + (className ? ' ' + escapeHtmlAttribute(className) : '') + '" id="' + escapeHtmlAttribute(id) + '"' + (open ? ' open' : '') + '>' +
    '<summary><span class="cu-settings-section-heading"><span>' + esc(title) + '</span><small data-appearance-summary></small></span><span class="cu-settings-section-modified" aria-label="本次已修改" hidden></span><span class="cu-settings-section-chevron" aria-hidden="true"></span></summary>' +
    '<div class="cu-settings-section-body">'
}

function cuSettingsSectionEnd() {
  return '</div></details>'
}

function cuSettingsSection(id, title, body, open, resetKey) {
  var resetAction = resetKey
    ? '<div class="cu-settings-section-actions"><button type="button" class="cu-settings-section-reset" data-cu-reset-message-section="' + escapeHtmlAttribute(resetKey) + '">仅恢复本组</button></div>'
    : ''
  return cuSettingsSectionStart(id, title, open) + resetAction + body + cuSettingsSectionEnd()
}

function readerAppearancePagerMarkup() {
  return '<nav class="appearance-workbench-pager" aria-label="美化工作台页面">' +
    '<button type="button" data-appearance-page-target="preview" aria-selected="true">预览</button>' +
    '<button type="button" data-appearance-page-target="controls" aria-selected="false">设置</button>' +
    '</nav>'
}

function bindReaderAppearancePager(root) {
  if (!root) return
  var pages = root.querySelector('.appearance-workbench-pages')
  var buttons = Array.from(root.querySelectorAll('[data-appearance-page-target]'))
  if (!pages || buttons.length === 0) return

  function setActivePage(name, shouldScroll) {
    var targetName = name === 'controls' ? 'controls' : 'preview'
    pages.dataset.appearanceActivePage = targetName
    buttons.forEach(function(button) {
      var active = button.dataset.appearancePageTarget === targetName
      button.setAttribute('aria-selected', active ? 'true' : 'false')
      button.tabIndex = active ? 0 : -1
    })
    if (!shouldScroll) return
    var page = pages.querySelector('[data-appearance-page="' + targetName + '"]')
    if (!page) return
    var left = Number(page.offsetLeft) || (targetName === 'controls' ? pages.clientWidth : 0)
    if (typeof pages.scrollTo === 'function') {
      pages.scrollTo({
        left: left,
        behavior: globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      })
    } else {
      pages.scrollLeft = left
    }
  }

  buttons.forEach(function(button) {
    button.addEventListener('click', function() {
      setActivePage(button.dataset.appearancePageTarget, true)
    })
  })

  var scrollFrame = 0
  pages.addEventListener('scroll', function() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    scrollFrame = requestAnimationFrame(function() {
      scrollFrame = 0
      var next = pages.scrollLeft > Math.max(1, pages.clientWidth * .5) ? 'controls' : 'preview'
      setActivePage(next, false)
    })
  }, { passive: true })
  setActivePage(pages.dataset.appearanceActivePage, false)
}

function setReaderRangeOutput(output, formattedValue) {
  if (!output) return
  var textValue = String(formattedValue == null ? '' : formattedValue)
  var exactInput = output.querySelector && output.querySelector('.appearance-range-value-input')
  if (!exactInput) {
    output.textContent = textValue
    return
  }
  var match = textValue.match(/^(-?(?:\d+\.?\d*|\.\d+))(.*)$/)
  exactInput.value = match ? match[1] : textValue
  var unit = output.querySelector('.appearance-range-value-unit')
  if (unit) unit.textContent = match ? match[2] : ''
}

function readerAppearanceRangePrecision(step) {
  var text = String(step || '1')
  return text.includes('.') ? text.split('.')[1].length : 0
}

function normalizedReaderAppearanceRangeValue(range, value) {
  var number = Number(value)
  var min = Number(range.min)
  var max = Number(range.max)
  var step = Number(range.step)
  if (!Number.isFinite(number)) number = Number(range.value)
  if (Number.isFinite(min)) number = Math.max(min, number)
  if (Number.isFinite(max)) number = Math.min(max, number)
  if (Number.isFinite(step) && step > 0) {
    var base = Number.isFinite(min) ? min : 0
    number = base + Math.round((number - base) / step) * step
    number = Number(number.toFixed(readerAppearanceRangePrecision(range.step)))
  }
  return number
}

function enhanceReaderAppearanceRanges(root) {
  if (!root) return
  root.querySelectorAll('input[type="range"]').forEach(function(range) {
    if (!range.id || range.dataset.appearanceExactBound === 'true') return
    var output = root.querySelector('#' + range.id + 'Val')
    if (!output) return
    range.dataset.appearanceExactBound = 'true'
    var currentText = output.textContent.trim()
    var unitMatch = currentText.match(/^-?(?:\d+\.?\d*|\.\d+)(.*)$/)
    var unitText = unitMatch ? unitMatch[1] : ''
    var exact = document.createElement('input')
    exact.type = 'number'
    exact.className = 'appearance-range-value-input'
    exact.dataset.appearanceRangeInput = range.id
    exact.min = range.min
    exact.max = range.max
    exact.step = range.step || '1'
    exact.value = range.value
    exact.inputMode = Number(range.step) < 1 ? 'decimal' : 'numeric'
    var row = range.closest('.cu-row, .rs-range-field, .phone-appearance-range')
    var rowLabel = row && row.querySelector('.cu-row-label, span')
    exact.setAttribute('aria-label', (rowLabel ? rowLabel.textContent.trim() : range.id) + '精确数值')
    var unit = document.createElement('span')
    unit.className = 'appearance-range-value-unit'
    unit.textContent = unitText
    output.textContent = ''
    output.classList.add('appearance-range-exact')
    output.append(exact, unit)

    function syncExact() {
      exact.value = range.value
    }
    range.addEventListener('input', syncExact)
    exact.addEventListener('change', function() {
      var next = normalizedReaderAppearanceRangeValue(range, exact.value)
      range.value = String(next)
      exact.value = range.value
      range.dispatchEvent(new Event('input', { bubbles:true }))
      range.dispatchEvent(new Event('change', { bubbles:true }))
    })
    exact.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        exact.dispatchEvent(new Event('change', { bubbles:true }))
        exact.select()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        exact.value = range.value
        exact.blur()
      }
    })
  })
}

function formatReaderAppearanceBytes(bytes) {
  var value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '大小未知'
  if (value < 1024) return Math.round(value) + ' B'
  if (value < 1024 * 1024) return Math.round(value / 1024) + ' KB'
  return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0) + ' MB'
}

function inspectReaderAppearanceImage(dataUrl, originalBytes) {
  return new Promise(function(resolve) {
    var image = new Image()
    image.onerror = function() {
      resolve({ dataUrl:dataUrl, width:0, height:0, bytes:originalBytes, transparentEdges:null, compressed:null })
    }
    image.onload = function() {
      var result = {
        dataUrl:dataUrl,
        width:Number(image.naturalWidth) || 0,
        height:Number(image.naturalHeight) || 0,
        bytes:Number(originalBytes) || readerCallBackgroundDecodedByteLength(dataUrl),
        transparentEdges:null,
        compressed:null
      }
      try {
        var canvasType = globalThis.CanvasRenderingContext2D || (globalThis.window && globalThis.window.CanvasRenderingContext2D)
        if (typeof canvasType !== 'function' || !result.width || !result.height) {
          resolve(result)
          return
        }
        var sample = document.createElement('canvas')
        sample.width = Math.min(64, result.width)
        sample.height = Math.min(64, result.height)
        var sampleContext = sample.getContext('2d', { willReadFrequently:true })
        if (sampleContext) {
          sampleContext.drawImage(image, 0, 0, sample.width, sample.height)
          var pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data
          var transparent = false
          for (var x = 0; x < sample.width && !transparent; x++) {
            var top = (x * 4) + 3
            var bottom = (((sample.height - 1) * sample.width + x) * 4) + 3
            transparent = pixels[top] < 248 || pixels[bottom] < 248
          }
          for (var y = 0; y < sample.height && !transparent; y++) {
            var left = (y * sample.width * 4) + 3
            var right = ((y * sample.width + sample.width - 1) * 4) + 3
            transparent = pixels[left] < 248 || pixels[right] < 248
          }
          result.transparentEdges = transparent
        }

        if (result.bytes >= 160 * 1024) {
          var scale = Math.min(1, 1600 / Math.max(result.width, result.height))
          var canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(result.width * scale))
          canvas.height = Math.max(1, Math.round(result.height * scale))
          var context = canvas.getContext('2d')
          if (context) {
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            var compressedUrl = canvas.toDataURL(result.transparentEdges ? 'image/webp' : 'image/jpeg', .86)
            var candidate = validatedReaderCallBackgroundCandidate(compressedUrl)
            if (candidate) {
              var compressedBytes = readerCallBackgroundDecodedByteLength(candidate.dataUrl)
              if (compressedBytes > 0 && compressedBytes <= result.bytes * .88) {
                result.compressed = {
                  dataUrl:candidate.dataUrl,
                  bytes:compressedBytes,
                  width:canvas.width,
                  height:canvas.height
                }
              }
            }
          }
        }
      } catch (_) {}
      resolve(result)
    }
    image.src = dataUrl
  })
}

function readerAppearanceImageMetaText(meta) {
  if (!meta) return ''
  var dimensions = meta.width && meta.height ? meta.width + '×' + meta.height : '尺寸未知'
  var edge = meta.transparentEdges === true
    ? '检测到透明边缘'
    : (meta.transparentEdges === false ? '边缘不透明' : '透明边缘未检测')
  return dimensions + ' · ' + formatReaderAppearanceBytes(meta.bytes) + ' · ' + edge
}

function renderReaderAppearanceImageChoice(state, meta, onChoose) {
  if (!state || !meta) return
  state.textContent = '已载入 · ' + readerAppearanceImageMetaText(meta)
  if (!meta.compressed || typeof onChoose !== 'function') return
  var choices = document.createElement('span')
  choices.className = 'appearance-image-storage-choice'
  var original = document.createElement('button')
  original.type = 'button'
  original.className = 'active'
  original.textContent = '保持原图'
  var compressed = document.createElement('button')
  compressed.type = 'button'
  compressed.textContent = '压缩存储 ' + formatReaderAppearanceBytes(meta.compressed.bytes)
  original.onclick = function() {
    original.classList.add('active')
    compressed.classList.remove('active')
    onChoose(meta.dataUrl, meta)
  }
  compressed.onclick = function() {
    compressed.classList.add('active')
    original.classList.remove('active')
    onChoose(meta.compressed.dataUrl, Object.assign({}, meta, {
      dataUrl:meta.compressed.dataUrl,
      bytes:meta.compressed.bytes,
      width:meta.compressed.width,
      height:meta.compressed.height,
      compressed:null
    }))
  }
  choices.append(original, compressed)
  state.append(document.createElement('br'), choices)
}

function readerAppearanceControlSignature(section) {
  var controls = Array.from(section.querySelectorAll('input, select, textarea, button'))
    .filter(function(control) {
      return !control.matches('.cu-settings-section-reset, .appearance-workbench-undo, [data-cu-copy-bubble-style]')
    })
    .map(function(control) {
      if (control.matches('button')) {
        return [control.id || control.textContent.trim(), control.classList.contains('active'), control.getAttribute('aria-pressed')]
      }
      return [control.id || control.name || control.type, control.type === 'checkbox' ? control.checked : control.value]
    })
  controls.push(section.dataset.appearanceManualVersion || '0')
  return JSON.stringify(controls)
}

function readerAppearanceSectionSummary(section) {
  var parts = []
  Array.from(section.querySelectorAll('input[type="range"]')).forEach(function(range) {
    if (parts.length >= 2 || range.dataset.appearanceInitialValue === undefined || range.value === range.dataset.appearanceInitialValue) return
    var output = section.querySelector('#' + range.id + 'Val')
    var exact = output && output.querySelector('.appearance-range-value-input')
    var unit = output && output.querySelector('.appearance-range-value-unit')
    parts.push((exact ? exact.value : range.value) + (unit ? unit.textContent : ''))
  })
  var imageState = Array.from(section.querySelectorAll('.cu-bubble-skin-state, .cu-chat-background-state'))
    .map(function(node) { return node.textContent.trim() })
    .find(function(text) { return /^已/.test(text) })
  if (imageState) parts.push(imageState.replace(/[；。].*$/, ''))

  Array.from(section.querySelectorAll('button.active, button[aria-pressed="true"]')).forEach(function(button) {
    if (parts.length >= 2 || button.closest('.appearance-workbench-pager')) return
    var label = button.textContent.trim()
    if (label && parts.indexOf(label) < 0) parts.push(label)
  })
  Array.from(section.querySelectorAll('.appearance-range-exact')).forEach(function(output) {
    if (parts.length >= 2) return
    var input = output.querySelector('.appearance-range-value-input')
    var unit = output.querySelector('.appearance-range-value-unit')
    if (input) parts.push(input.value + (unit ? unit.textContent : ''))
  })
  if (parts.length === 0) {
    var color = section.querySelector('input[type="color"]')
    if (color) parts.push(color.value.toUpperCase())
  }
  return parts.slice(0, 2).join(' · ') || '默认'
}

function bindReaderAppearanceSectionStates(root) {
  if (!root) return null
  var sections = Array.from(root.querySelectorAll('.cu-settings-section'))
  sections.forEach(function(section) {
    section.querySelectorAll('input, select, textarea').forEach(function(control) {
      control.dataset.appearanceInitialValue = control.type === 'checkbox' ? String(control.checked) : control.value
    })
    section._appearanceInitialSignature = readerAppearanceControlSignature(section)
  })
  function refresh() {
    sections.forEach(function(section) {
      var modified = readerAppearanceControlSignature(section) !== section._appearanceInitialSignature
      section.classList.toggle('is-appearance-modified', modified)
      var marker = section.querySelector(':scope > summary .cu-settings-section-modified')
      if (marker) marker.hidden = !modified
      var summary = section.querySelector(':scope > summary [data-appearance-summary]')
      if (summary) summary.textContent = readerAppearanceSectionSummary(section)
    })
  }
  root.addEventListener('input', refresh)
  root.addEventListener('change', refresh)
  root.addEventListener('click', refresh)
  root._refreshAppearanceSectionStates = refresh
  refresh()
  return { refresh:refresh }
}

function focusReaderAppearanceSection(root, sectionId, controlSelector, moveFocus) {
  if (!root) return
  var section = root.querySelector('#' + sectionId)
  if (!section) return
  var controlsPage = section.closest('[data-appearance-page="controls"]')
  if (controlsPage) {
    controlsPage.querySelectorAll(':scope > .cu-settings-section').forEach(function(candidate) {
      candidate.open = candidate === section
      if (candidate !== section) candidate.classList.remove('is-preview-targeted')
    })
  }
  section.open = true
  section.classList.add('is-preview-targeted')
  globalThis.setTimeout(function() {
    if (section.isConnected) section.classList.remove('is-preview-targeted')
  }, 650)
  var settingsPage = root.querySelector('[data-appearance-page-target="controls"]')
  if (settingsPage) settingsPage.click()
  var focusTarget = controlSelector ? section.querySelector(controlSelector) : section.querySelector('summary')
  if (moveFocus && focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus({ preventScroll:true })
  if (typeof section.scrollIntoView === 'function') {
    section.scrollIntoView({ behavior:shouldUseMotion() ? 'smooth' : 'auto', block:'start' })
  }
}

function bindReaderAppearanceUndo(root, options) {
  if (!root || !options || typeof options.capture !== 'function' || typeof options.restore !== 'function') return null
  var controls = root.querySelector('[data-appearance-page="controls"]')
  if (!controls) return null
  var bar = document.createElement('div')
  bar.className = 'appearance-workbench-history'
  bar.innerHTML = '<span>本次调整</span><button type="button" class="appearance-workbench-undo" disabled>撤销上一步</button>'
  controls.insertBefore(bar, controls.firstChild)
  var undo = bar.querySelector('.appearance-workbench-undo')
  var previous = null
  var restoring = false

  function remember() {
    if (restoring) return
    previous = JSON.parse(JSON.stringify(options.capture()))
    undo.disabled = false
  }
  controls.addEventListener('pointerdown', function(event) {
    if (event.target.closest('input, select, textarea, button') && !event.target.closest('.appearance-workbench-undo')) remember()
  }, true)
  controls.addEventListener('keydown', function(event) {
    if (event.target.closest('input, select, textarea') && !['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) remember()
  }, true)
  controls.addEventListener('click', function(event) {
    if (event.target.closest('button') && !event.target.closest('.appearance-workbench-undo')) remember()
  }, true)
  undo.onclick = function() {
    if (!previous) return
    var snapshot = previous
    previous = null
    undo.disabled = true
    restoring = true
    options.restore(snapshot)
    restoring = false
    if (root._refreshAppearanceSectionStates) root._refreshAppearanceSectionStates()
  }
  return { remember:remember, clear:function() { previous = null; undo.disabled = true } }
}

function cuSettingsSubsection(title, body) {
  return '<section class="cu-settings-subsection"><h3>' + esc(title) + '</h3>' + body + '</section>'
}

function cuCollapsibleSubsection(id, title, body, open) {
  return '<details class="cu-settings-subsection cu-settings-subsection-collapsible" id="' + escapeHtmlAttribute(id) + '"' + (open ? ' open' : '') + '>' +
    '<summary><span>' + esc(title) + '</span><span class="cu-settings-subsection-chevron" aria-hidden="true"></span></summary>' +
    '<div class="cu-settings-subsection-body">' + body + '</div></details>'
}

function cuRow(label, control) {
  return '<div class="cu-row"><span class="cu-row-label">' + esc(label) + '</span><span class="cu-row-ctrl">' + control + '</span></div>'
}

function cuColorBtn(color, cls, dataAttr, dataVal, label) {
  var active = (cls || '').indexOf('active') >= 0
  var accessibleName = (label || '颜色') + ' ' + color
  return '<button type="button" class="cu-color-btn' + (cls || '') + '" data-' + dataAttr + '="' + escapeHtmlAttribute(dataVal) + '" aria-label="' + escapeHtmlAttribute(accessibleName) + '" aria-pressed="' + (active ? 'true' : 'false') + '"><span class="cu-color-swatch" aria-hidden="true" style="background:' + escapeHtmlAttribute(color) + '"></span></button>'
}

function readerColorInputValue(value) {
  var color = String(value || '')
  var shortMatch = color.match(/^#([\da-f])([\da-f])([\da-f])$/i)
  if (shortMatch) return '#' + shortMatch.slice(1).map(function(channel) { return channel + channel }).join('')
  return /^#[\da-f]{6}$/i.test(color) ? color : '#000000'
}

function cuColorRow(label, presetColors, currentColor, dataAttr) {
  var h = '<div class="cu-color-group' + (presetColors.length ? '' : ' is-picker-only') + '">'
  for (var i = 0; i < presetColors.length; i++) {
    h += cuColorBtn(presetColors[i], currentColor === presetColors[i] ? ' active' : '', dataAttr, presetColors[i], label)
  }
  h += '<input type="color" class="cu-color-picker" aria-label="' + escapeHtmlAttribute('自定义' + label) + '" value="' + escapeHtmlAttribute(readerColorInputValue(currentColor)) + '" data-' + dataAttr + '-picker="' + escapeHtmlAttribute(currentColor) + '">'
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
    var chatBgImage = validatedReaderCallBackgroundCandidate(s.chatBgImage)
    var chatImageValue = chatBgImage ? 'url("' + chatBgImage.dataUrl + '")' : 'none'
    var otherBg = sanitizeCssColor(s.otherBubbleBg || '#fff')
    var otherText = sanitizeCssColor(s.otherBubbleText || '#333')
    var selfBg = sanitizeCssColor(s.selfBubbleBg || '#555')
    var selfText = sanitizeCssColor(s.selfBubbleText || '#fff')
    var avatarSize = boundedReaderSetting(s.avatarSize, 36, 24, 56)
    var bubbleSize = boundedReaderSetting(s.bubbleFontSize, 13, 10, 18)
    var bubbleWeight = normalizedReaderBubbleFontWeight(s.bubbleFontWeight)
    var otherBubbleSkinClass = readerBubbleSkinClass(s, 'other')
    var selfBubbleSkinClass = readerBubbleSkinClass(s, 'self')
    var sendButtonBg = sanitizeCssColor(s.sendButtonBg, { fallback: '#cda9b1' })
    var chatAppearance = normalizedReaderChatAppearanceSettings(s)
    var chatTone = readerChatTonePresentation(chatAppearance.chatBgTone)
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
    var h = '<div class="rd-app-preview-chat chat-author-shell chat-reader-shell" data-chat-background-image="' + (chatBgImage ? 'true' : 'false') + '" style="display:flex;flex-direction:column;height:100%;--chat-editor-screen:' + chatBg + ';--chat-editor-image:' + escapeHtmlAttribute(chatImageValue) + ';--chat-bg-size:' + chatAppearance.chatBgFit + ';--chat-bg-position:' + chatAppearance.chatBgPositionX + '% ' + chatAppearance.chatBgPositionY + '%;--chat-bg-overlay-color:' + chatTone.color + ';--chat-bg-overlay-opacity:' + chatTone.opacity + ';--chat-bubble-weight:' + bubbleWeight + ';--chat-editor-pink:' + selfBg + ';--chat-send-bg:' + sendButtonBg + ';--chat-send-ink:' + readerReadableTextColor(sendButtonBg) + ';' + readerBubbleSkinVariables(s) + readerChatReadabilityVariables(readerOwnDataRecord(s, chatAppearance)) + '">'
    h += '<div class="chat-round-header"><span class="chat-round-control" aria-hidden="true">‹</span><div class="chat-round-title"><strong>' + esc(contact.name || '林晚') + '</strong></div><span class="chat-round-control" aria-hidden="true"></span></div>'
    h += '<div class="chat-msg-area">' + (shouldShowPhoneTimestamp(pd, '今天 20:41') ? '<div class="rd-chat-time" style="text-align:center;padding:6px 0;font-size:.62rem;color:var(--chat-time-color,#b0b8c4)">今天 20:41</div>' : '')
    h += '<div class="chat-msg rd-chat-message other is-other' + otherBubbleSkinClass + '"><span class="chat-avatar" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor(contact.id)) + '">' + esc(String(contact.name || '林').charAt(0)) + '</span><div class="rd-chat-message-body"><div class="chat-bubble' + otherBubbleSkinClass + '" style="font-size:' + bubbleSize + 'px;background:' + otherBg + ';color:' + otherText + ';border-radius:' + otherRadius + 'px ' + otherRadius + 'px ' + otherRadius + 'px 2px">' + esc(otherCopy) + '</div></div></div>'
    h += '<div class="chat-msg rd-chat-message self is-self' + selfBubbleSkinClass + '"><span class="chat-avatar rd-reader-chat-avatar" aria-label="' + escapeHtmlAttribute(readerName) + '" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor('reader-' + readerName)) + '">'
    if (readerAvatar) h += '<img src="' + escapeHtmlAttribute(readerAvatar) + '" alt="">'
    else h += esc((readerName || '我').charAt(0))
    h += '</span><div class="rd-chat-message-body"><div class="chat-bubble' + selfBubbleSkinClass + '" style="font-size:' + bubbleSize + 'px;background:' + selfBg + ';color:' + selfText + ';border-radius:' + selfRadius + 'px ' + selfRadius + 'px 2px ' + selfRadius + 'px">' + esc(selfCopy) + '</div></div></div></div>'
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
  h += '<div class="rd-phone-preview"><div class="phone-frame reader-app-preview-frame reader-phone-css-preview-scope" tabindex="0" aria-label="应用效果预览；按住可查看修改前效果" style="' + escapeHtmlAttribute(frameStyle) + '">'
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
    cuSelfBubbleSkinSize: 'selfBubbleSkinSize', cuOtherBubbleSkinSize: 'otherBubbleSkinSize',
    cuSelfBubbleSkinSlice: 'selfBubbleSkinSlice', cuSelfBubbleSkinPadding: 'selfBubbleSkinPadding',
    cuOtherBubbleSkinSlice: 'otherBubbleSkinSlice', cuOtherBubbleSkinPadding: 'otherBubbleSkinPadding',
    cuBubbleFs: 'bubbleFontSize', cuCardRadius: 'cardRadius', cuTitleSize: 'titleSize',
    cuFontSize: 'fontSize', cuLineHeight: 'lineHeight', cuImgRadius: 'imageRadius',
    cuGap: 'gap', cuEntryRadius: 'entryRadius', cuNameSize: 'nameSize',
    cuComposerInputRadius: 'composerInputRadius',
    cuChatBgPosX: 'chatBgPositionX', cuChatBgPosY: 'chatBgPositionY', cuChatBgTone: 'chatBgTone'
  }
  for (var id in sliderMap) {
    var el = modal.querySelector('#' + id)
    if (el) assignFiniteSetting(s, sliderMap[id], el.value)
  }
  // Read active color buttons
  var colorBtnMap = {
    'cu-self-bg': 'selfBubbleBg', 'cu-self-text': 'selfBubbleText',
    'cu-other-bg': 'otherBubbleBg', 'cu-other-text': 'otherBubbleText',
    'cu-chat-bg': 'chatBg', 'cu-time-color': 'timeColor', 'cu-send-bg': 'sendButtonBg',
    'cu-composer-bg': 'composerBg', 'cu-composer-input-bg': 'composerInputBg',
    'cu-composer-input-text': 'composerInputText', 'cu-composer-input-border': 'composerInputBorder',
    'cu-card-bg': 'cardBg', 'cu-title-color': 'titleColor',
    'cu-text-color': 'textColor', 'cu-url-color': 'urlColor',
    'cu-name-color': 'nameColor', 'cu-price-color': 'priceColor'
  }
  for (var attr in colorBtnMap) {
    var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
    if (btn) { s[colorBtnMap[attr]] = btn.getAttribute('data-' + attr); continue }
    var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
    if (picker && picker.value) {
      s[colorBtnMap[attr]] = picker.getAttribute('data-' + attr + '-picker') || picker.value
    }
  }
  // Read active shape button
  var shapeBtn = modal.querySelector('.cu-shape-btn.active')
  if (shapeBtn && shapeBtn.dataset.cuShape) s.avatarShape = shapeBtn.dataset.cuShape
  // Read active style buttons
  var memoStyle = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
  if (memoStyle) s.cardStyle = memoStyle.dataset.cuMemoStyle
  var galleryCol = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
  if (galleryCol) s.columns = parseInt(galleryCol.dataset.cuGalleryCols) || 3
  var bubbleWeight = modal.querySelector('.cu-style-btn.active[data-cu-bubble-weight]')
  if (bubbleWeight) s.bubbleFontWeight = normalizedReaderBubbleFontWeight(bubbleWeight.dataset.cuBubbleWeight)
  modal.querySelectorAll('.cu-style-btn.active[data-cu-bubble-skin-mode]').forEach(function(button) {
    var prefix = button.dataset.cuBubbleSkinSide === 'self' ? 'self' : 'other'
    s[prefix + 'BubbleSkinMode'] = button.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
  })
  var chatBgFit = modal.querySelector('.cu-style-btn.active[data-cu-chat-bg-fit]')
  if (chatBgFit) s.chatBgFit = chatBgFit.dataset.cuChatBgFit === 'contain' ? 'contain' : 'cover'
  var customCss = modal.querySelector('#cuAppCustomCss')
  s.customCss = customCss && typeof customCss.value === 'string'
    ? customCss.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : (typeof s.customCss === 'string' ? s.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH) : '')
  if (type === 'messages' && Object.prototype.hasOwnProperty.call(modal, '_readerChatBgImageDraft')) {
    s.chatBgImage = modal._readerChatBgImageDraft || null
    s.chatBgLuminance = Number.isFinite(modal._readerChatBgLuminanceDraft)
      ? modal._readerChatBgLuminanceDraft
      : null
    var readabilityToggle = modal.querySelector('#cuChatAutoReadability')
    s.chatAutoReadability = readabilityToggle ? readabilityToggle.checked : s.chatAutoReadability !== false
    var composerReadabilityToggle = modal.querySelector('#cuComposerAutoReadability')
    s.composerAutoReadability = composerReadabilityToggle
      ? composerReadabilityToggle.checked
      : s.composerAutoReadability !== false
    if (modal._readerBubbleSkinDraft) {
      s.selfBubbleSkinImage = modal._readerBubbleSkinDraft.self || null
      s.otherBubbleSkinImage = modal._readerBubbleSkinDraft.other || null
    }
  }
  return s
}

function syncReaderAppCssFeedback(modal, type, settings) {
  var rawCss = typeof settings.customCss === 'string' ? settings.customCss : ''
  var result = applyReaderAppCustomCss(type, settings, { preview: true })
  var error = modal.querySelector('#cuAppCssError')
  var count = modal.querySelector('#cuAppCssCount')
  var status = modal.querySelector('#cuAppLiveStatus')
  var save = modal.querySelector('#cuModalSave')
  var dirty = typeof modal._readerAppDraftDirty === 'function'
    ? modal._readerAppDraftDirty(settings)
    : true
  if (count) count.textContent = rawCss.length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
  if (error) {
    error.hidden = result.ok
    error.textContent = result.ok ? '' : result.error
  }
  if (status) {
    status.classList.toggle('is-error', !result.ok)
    status.textContent = result.ok
      ? (dirty
        ? '有未保存修改 · 按住预览可对比原效果'
        : '尚未修改 · 按住预览可查看原效果')
      : 'CSS 有误，已保留上一次可用预览'
  }
  if (save) save.disabled = !dirty || !result.ok || save.dataset.readerAsyncPending === 'true'
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
    '<p id="cuCallBackgroundState" class="cu-chat-background-state" aria-live="polite"></p>' +
    '<p id="cuCallBackgroundError" class="cu-call-background-error" role="alert" hidden></p>'
}

function readerBubbleSkinControls(side, settings) {
  var isSelf = side === 'self'
  var key = isSelf ? 'Self' : 'Other'
  var skin = normalizedReaderBubbleSkin(settings, side)
  return '<div class="cu-bubble-skin-control" data-cu-bubble-skin-side="' + side + '">' +
    '<div class="cu-call-background-actions cu-bubble-skin-actions">' +
      '<button type="button" id="cu' + key + 'BubbleSkinUpload">选择图片</button>' +
      '<input type="file" id="cu' + key + 'BubbleSkinFile" accept="image/png,image/jpeg,image/webp" hidden>' +
      '<button type="button" id="cu' + key + 'BubbleSkinClear"' + (skin.image ? '' : ' disabled') + '>清除</button>' +
    '</div>' +
    '<p id="cu' + key + 'BubbleSkinState" class="cu-bubble-skin-state" aria-live="polite">' +
      (skin.image ? '已使用本地素材，可继续调整显示方式和大小。' : '未使用，继续显示背景色与圆角。') +
    '</p>' +
    '<p id="cu' + key + 'BubbleSkinError" class="cu-call-background-error" role="alert" hidden></p>' +
  '</div>'
}

function readerBubbleSkinModeControls(side, settings) {
  var skin = normalizedReaderBubbleSkin(settings, side)
  return '<div class="cu-shape-group cu-bubble-skin-mode" role="group" aria-label="' + (side === 'self' ? '我方' : '对方') + '气泡素材显示方式">' +
    '<button type="button" class="cu-style-btn' + (skin.mode === 'full' ? ' active' : '') + '" data-cu-bubble-skin-mode="full" data-cu-bubble-skin-side="' + side + '">完整素材</button>' +
    '<button type="button" class="cu-style-btn' + (skin.mode === 'slice' ? ' active' : '') + '" data-cu-bubble-skin-mode="slice" data-cu-bubble-skin-side="' + side + '">切片拉伸</button>' +
  '</div>'
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

function bindReaderAppPreviewAutoScale(overlay) {
  var modal = overlay.querySelector('.app-appearance-workbench')
  var modalBody = modal && modal.querySelector('.cu-modal-body')
  var previewPane = modal && modal.querySelector('.app-appearance-preview-pane')
  var previewWrap = previewPane && previewPane.querySelector('.rd-phone-preview')
  var previewFrame = previewPane && previewPane.querySelector('.reader-app-preview-frame')
  var previewLabel = previewPane && previewPane.querySelector('.cu-preview-label')
  var previewStatus = previewPane && previewPane.querySelector('.phone-appearance-status')
  if (!modal || !modalBody || !previewWrap || !previewFrame) return

  var lastScale = ''
  var lastHeight = ''
  var resizeObserver = null
  var removalObserver = null
  var resizeTarget = globalThis.window && typeof globalThis.window.addEventListener === 'function'
    ? globalThis.window
    : (typeof globalThis.addEventListener === 'function' ? globalThis : null)

  function clearPreviewScale() {
    lastScale = ''
    lastHeight = ''
    modal.style.removeProperty('--reader-app-preview-scale')
    previewWrap.style.removeProperty('height')
    previewWrap.style.removeProperty('overflow')
  }

  function syncPreviewScale() {
    if (!overlay.isConnected) return
    var viewportWidth = Number(resizeTarget && resizeTarget.innerWidth) ||
      Number(globalThis.innerWidth) ||
      document.documentElement.clientWidth ||
      0
    if (viewportWidth <= 860) {
      clearPreviewScale()
      return
    }
    var availableBodyHeight = modalBody.clientHeight
    if (!availableBodyHeight) return
    var naturalHeight = previewFrame.offsetHeight || 640
    var fixedChromeHeight = (previewLabel ? previewLabel.offsetHeight : 0) +
      (previewStatus ? previewStatus.offsetHeight : 0) + 52
    var availablePreviewHeight = Math.max(0, availableBodyHeight - fixedChromeHeight)
    var scale = Math.max(0.42, Math.min(1, availablePreviewHeight / naturalHeight))
    var scaleText = String(Number(scale.toFixed(3)))
    var heightText = Math.round(naturalHeight * scale) + 'px'
    if (scaleText !== lastScale) {
      modal.style.setProperty('--reader-app-preview-scale', scaleText)
      lastScale = scaleText
    }
    if (heightText !== lastHeight) {
      previewWrap.style.height = heightText
      previewWrap.style.overflow = 'hidden'
      lastHeight = heightText
    }
  }

  function cleanupPreviewScale() {
    if (resizeTarget) resizeTarget.removeEventListener('resize', syncPreviewScale)
    if (resizeObserver) resizeObserver.disconnect()
    if (removalObserver) removalObserver.disconnect()
  }

  if (resizeTarget) resizeTarget.addEventListener('resize', syncPreviewScale)
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(syncPreviewScale)
    resizeObserver.observe(modalBody)
  }
  if (typeof MutationObserver === 'function' && document.body) {
    removalObserver = new MutationObserver(function() {
      if (overlay.isConnected) return
      cleanupPreviewScale()
    })
    removalObserver.observe(document.body, { childList: true })
  }
  requestAnimationFrame(syncPreviewScale)
}

// ====== Per-App Settings Panel ======
function openReaderAppSettings(type, trigger) {
  var ct = getPhoneCustom()
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物', contacts:'联系人' }
  var title = '美化 - ' + (labels[type] || 'App')

  var persistedSettings = getAppSettings(type)
  var s = JSON.parse(JSON.stringify(persistedSettings))
  var initialSettingsSnapshot = JSON.parse(JSON.stringify(persistedSettings))
  var appIconDraft = ct.customIcons[type] || ''
  var initialIconSnapshot = appIconDraft
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
    var bubbleSettings =
      cuCollapsibleSubsection('cuMessageAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>') +
      cuSliderRow('尺寸', 'cuMsgAvSize', 24, 56, 2, s.avatarSize, 'px'),
      false
      ) +
      cuCollapsibleSubsection('cuMessageSelfBubble', '我方气泡',
      cuColorRow('背景色', [], s.selfBubbleBg, 'cu-self-bg') +
      cuColorRow('文字色', [], s.selfBubbleText, 'cu-self-text') +
      cuSliderRow('圆角', 'cuSelfRadius', 0, 20, 1, s.selfBubbleRadius, 'px') +
      cuRow('气泡皮肤', readerBubbleSkinControls('self', s)) +
      cuRow('显示方式', readerBubbleSkinModeControls('self', s)) +
      cuSliderRow('整体大小', 'cuSelfBubbleSkinSize', 70, 220, 5, s.selfBubbleSkinSize, '%') +
      '<div data-cu-bubble-skin-slice-row="self"' + (s.selfBubbleSkinMode === 'slice' ? '' : ' hidden') + '>' +
        cuSliderRow('边缘保留', 'cuSelfBubbleSkinSlice', 4, 40, 1, s.selfBubbleSkinSlice, 'px') +
      '</div>' +
      cuSliderRow('文字留白', 'cuSelfBubbleSkinPadding', 4, 32, 1, s.selfBubbleSkinPadding, 'px') +
      '<div class="cu-bubble-copy-row"><button type="button" class="rs-action-btn subtle" data-cu-copy-bubble-style="self-to-other">复制到对方气泡</button></div>',
      true
      ) +
      cuCollapsibleSubsection('cuMessageOtherBubble', '对方气泡',
      cuColorRow('背景色', [], s.otherBubbleBg, 'cu-other-bg') +
      cuColorRow('文字色', [], s.otherBubbleText, 'cu-other-text') +
      cuSliderRow('圆角', 'cuOtherRadius', 0, 20, 1, s.otherBubbleRadius, 'px') +
      cuRow('气泡皮肤', readerBubbleSkinControls('other', s)) +
      cuRow('显示方式', readerBubbleSkinModeControls('other', s)) +
      cuSliderRow('整体大小', 'cuOtherBubbleSkinSize', 70, 220, 5, s.otherBubbleSkinSize, '%') +
      '<div data-cu-bubble-skin-slice-row="other"' + (s.otherBubbleSkinMode === 'slice' ? '' : ' hidden') + '>' +
        cuSliderRow('边缘保留', 'cuOtherBubbleSkinSlice', 4, 40, 1, s.otherBubbleSkinSlice, 'px') +
      '</div>' +
      cuSliderRow('文字留白', 'cuOtherBubbleSkinPadding', 4, 32, 1, s.otherBubbleSkinPadding, 'px') +
      '<p class="cu-settings-hint">完整素材不会裁边；只有专门的九宫格素材才需要切片拉伸。图片只保存在当前浏览器。</p>' +
      '<div class="cu-bubble-copy-row"><button type="button" class="rs-action-btn subtle" data-cu-copy-bubble-style="other-to-self">复制到我方气泡</button></div>',
      false
      ) +
      cuCollapsibleSubsection('cuMessageTypography', '文字与时间',
      cuSliderRow('字号', 'cuBubbleFs', 10, 18, 1, s.bubbleFontSize, 'px') +
      cuRow('字重', '<div class="cu-shape-group">' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 400 ? ' active' : '') + '" data-cu-bubble-weight="400">常规</button>' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 500 ? ' active' : '') + '" data-cu-bubble-weight="500">中等</button>' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 800 ? ' active' : '') + '" data-cu-bubble-weight="800">加粗</button>' +
        '</div>') +
      cuColorRow('时间颜色', [], s.timeColor, 'cu-time-color'),
      false
      )
    body += cuSettingsSection('cuMessageBubbles', '气泡与文字', bubbleSettings, true, 'bubbles')

    var backgroundSettings =
      cuColorRow('背景色', [], s.chatBg, 'cu-chat-bg') +
      cuRow('背景图', '<div class="cu-call-background-actions"><button type="button" id="cuChatBackgroundUpload">选择本地图片</button><input type="file" id="cuChatBackgroundFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="cuChatBackgroundClear">清除图片</button></div><p id="cuChatBackgroundState" class="cu-chat-background-state" aria-live="polite"></p><p id="cuChatBackgroundError" class="cu-call-background-error" role="alert" hidden></p>') +
      cuRow('清晰保护', '<label class="rd-checkbox cu-readability-toggle"><input type="checkbox" id="cuChatAutoReadability"' + (s.chatAutoReadability !== false ? ' checked' : '') + '> 自动保障文字清晰</label>') +
      cuRow('填充方式', '<div class="cu-shape-group">' +
        '<button type="button" class="cu-style-btn' + (s.chatBgFit === 'cover' ? ' active' : '') + '" data-cu-chat-bg-fit="cover">铺满</button>' +
        '<button type="button" class="cu-style-btn' + (s.chatBgFit === 'contain' ? ' active' : '') + '" data-cu-chat-bg-fit="contain">完整显示</button>' +
        '</div>') +
      cuSliderRow('明暗', 'cuChatBgTone', -50, 50, 5, s.chatBgTone, '%') +
      cuSliderRow('水平焦点', 'cuChatBgPosX', 0, 100, 1, s.chatBgPositionX, '%') +
      cuSliderRow('垂直焦点', 'cuChatBgPosY', 0, 100, 1, s.chatBgPositionY, '%') +
      '<p class="cu-settings-hint">负数压暗、正数提亮；上传壁纸后也可以直接拖动左侧预览调整焦点。</p>'
    body += cuSettingsSection('cuMessageBackground', '聊天背景', backgroundSettings, false, 'background')

    body += cuSettingsSection('cuMessageActions', '底部操作',
      cuRow('自动适配', '<label class="rd-checkbox cu-readability-toggle"><input type="checkbox" id="cuComposerAutoReadability"' + (s.composerAutoReadability !== false ? ' checked' : '') + '> 跟随聊天背景自动适配</label>') +
      cuColorRow('操作栏背景', [], s.composerBg, 'cu-composer-bg') +
      cuColorRow('输入框背景', [], s.composerInputBg, 'cu-composer-input-bg') +
      cuColorRow('输入框文字', [], s.composerInputText, 'cu-composer-input-text') +
      cuColorRow('输入框边框', [], s.composerInputBorder, 'cu-composer-input-border') +
      cuSliderRow('输入框圆角', 'cuComposerInputRadius', 0, 18, 1, s.composerInputRadius, 'px') +
      cuColorRow('播放 / 回复按钮', [], s.sendButtonBg, 'cu-send-bg') +
      '<div class="cu-message-css-shortcut"><p class="cu-settings-hint">调节以上任一项会切换为自定义；更细的样式可以继续使用当前消息 App 的高级 CSS。</p><button type="button" class="rs-action-btn subtle" id="cuMessageActionsCss">用 CSS 微调</button></div>'
    , false, 'actions')
    body += cuSettingsSection('cuMessageCall', '通话界面',
      '<div id="cuCallBackgroundCard">' + readerCallBackgroundControls(callBackgroundDraft) + '</div>'
    , false, 'call')
  } else if (type === 'forum') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuSettingsSection('cuForumAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    , true)
    body += cuSettingsSection('cuForumCards', '帖子卡片',
      cuColorRow('背景色', ['#fff', '#f8f8f8', '#e8f0f8', '#fef9e7'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px')
    , false)
    body += cuSettingsSection('cuForumTypography', '标题与时间',
      cuColorRow('颜色', ['#555', '#333', '#1a1a2e', '#6366f1'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 18, 1, s.titleSize, 'px') +
      cuColorRow('时间颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color')
    , false)
  } else if (type === 'memo') {
    body += cuSettingsSection('cuMemoStyle', '卡片风格',
      cuRow('样式', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.cardStyle === 'plain' ? ' active' : '') + '" data-cu-memo-style="plain">简洁</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'sticky' ? ' active' : '') + '" data-cu-memo-style="sticky">便签</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'vintage' ? ' active' : '') + '" data-cu-memo-style="vintage">复古</button>' +
        '</div>')
    , true)
    body += cuSettingsSection('cuMemoAppearance', '外观与文字',
      cuColorRow('背景色', ['#fff', '#fef9e7', '#f5e6c8', '#e8f4e8'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px') +
      cuColorRow('颜色', ['#333', '#555', '#4a3a2a', '#1a1a2e'], s.textColor, 'cu-text-color') +
      cuSliderRow('字号', 'cuFontSize', 10, 16, 1, s.fontSize, 'px') +
      cuSliderRow('行间距', 'cuLineHeight', 1.2, 2.4, 0.1, s.lineHeight, '')
    , false)
  } else if (type === 'gallery') {
    body += cuSettingsSection('cuGalleryGrid', '网格',
      cuRow('列数', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.columns === 2 ? ' active' : '') + '" data-cu-gallery-cols="2">2列</button>' +
        '<button class="cu-style-btn' + (s.columns === 3 ? ' active' : '') + '" data-cu-gallery-cols="3">3列</button>' +
        '<button class="cu-style-btn' + (s.columns === 4 ? ' active' : '') + '" data-cu-gallery-cols="4">4列</button>' +
        '</div>')
    , true)
    body += cuSettingsSection('cuGalleryAppearance', '图片外观',
      cuSliderRow('图片圆角', 'cuImgRadius', 0, 16, 1, s.imageRadius, 'px') +
      cuSliderRow('间距', 'cuGap', 2, 16, 2, s.gap, 'px')
    , false)
  } else if (type === 'browser') {
    body += cuSettingsSection('cuBrowserTypography', '标题与 URL',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 16, 1, s.titleSize, 'px') +
      cuColorRow('URL 颜色', ['#999', '#666', '#888'], s.urlColor, 'cu-url-color')
    , true)
    body += cuSettingsSection('cuBrowserEntries', '时间与条目',
      cuColorRow('时间颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color') +
      cuSliderRow('圆角', 'cuEntryRadius', 0, 12, 1, s.entryRadius, 'px')
    , false)
  } else if (type === 'shopping') {
    body += cuSettingsSection('cuShoppingNames', '商品名称',
      cuColorRow('颜色', ['#333', '#555', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 16, 1, s.nameSize, 'px')
    , true)
    body += cuSettingsSection('cuShoppingPrices', '价格',
      cuColorRow('颜色', ['#a3bded', '#ef4444', '#f59e0b', '#10b981'], s.priceColor, 'cu-price-color')
    , false)
  } else if (type === 'contacts') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuSettingsSection('cuContactsAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    , true)
    body += cuSettingsSection('cuContactsNames', '名称',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 18, 1, s.nameSize, 'px')
    , false)
  }

  // Icon card - for all app types
  ct.customIcons = ct.customIcons || {}
  var curIcon = appIconDraft
  var iconSettings = cuRow('自定义', '<div style="display:flex;gap:6px;align-items:center">' +
      '<input class="rd-input rd-input-sm" id="cuIconUrl" value="' + esc(curIcon) + '" placeholder="输入图标URL或上传...">' +
      '<button style="padding:4px 10px;font-size:.7rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer;white-space:nowrap" id="cuIconUpload">上传</button>' +
      (curIcon ? '<button style="padding:4px 10px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;white-space:nowrap" id="cuIconClear">清除</button>' : '') +
      '</div>')
  if (curIcon) iconSettings += '<div class="rd-preview-img"><img src="' + esc(curIcon) + '" style="max-height:40px;border-radius:4px"></div>'

  var advancedCssSettings = '<div class="rs-css-section">' +
      '<textarea id="cuAppCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuAppCssHint cuAppCssError" placeholder=".rd-phone-app-body { padding: 14px; }">' + esc(s.customCss || '') + '</textarea>' +
      '<div class="rs-css-meta"><p class="rs-field-hint" id="cuAppCssHint">只作用于当前 App；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuAppCssCount">' + String((s.customCss || '').length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>' +
      '<p class="rs-css-error" id="cuAppCssError" role="alert" hidden></p>' +
      '<div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuAppCssSample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuAppCssClear">清空 CSS</button></div>' +
    '</div>'
  if (type === 'messages') {
    body += cuSettingsSection('cuMessageMore', '应用与高级',
      cuSettingsSubsection('应用图标', iconSettings) +
      cuSettingsSubsection('高级 CSS', advancedCssSettings),
    false)
  } else {
    body += cuSettingsSection('cuAppMore', '应用与高级',
      cuSettingsSubsection('应用图标', iconSettings) +
      cuSettingsSubsection('高级 CSS', advancedCssSettings),
    false)
  }

  body += '<div style="text-align:center;padding-top:8px"><button class="cu-reset-btn" id="cuAppReset">恢复默认</button></div>'

  body = readerAppearancePagerMarkup() +
    '<div class="app-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">' +
    '<aside class="app-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview">' +
    renderCuPreview(type, s) +
    '<p class="phone-appearance-status" id="cuAppLiveStatus" role="status" aria-live="polite">实时预览 · 保存后应用到实际 App</p>' +
    '</aside><div class="app-appearance-controls appearance-workbench-page" data-appearance-page="controls">' + body + '</div></div>'

  var ov = openCuModal(title, body, function(modal) {
    // Helper: read color from active button or from picker
    function readColor(attr, key) {
      var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
      if (btn) { s[key] = btn.getAttribute('data-' + attr); return }
      var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
      if (picker && picker.value) {
        s[key] = picker.getAttribute('data-' + attr + '-picker') || picker.value
      }
    }
    readColor('cu-self-bg', 'selfBubbleBg')
    readColor('cu-self-text', 'selfBubbleText')
    readColor('cu-other-bg', 'otherBubbleBg')
    readColor('cu-other-text', 'otherBubbleText')
    readColor('cu-chat-bg', 'chatBg')
    readColor('cu-time-color', 'timeColor')
    readColor('cu-send-bg', 'sendButtonBg')
    readColor('cu-composer-bg', 'composerBg')
    readColor('cu-composer-input-bg', 'composerInputBg')
    readColor('cu-composer-input-text', 'composerInputText')
    readColor('cu-composer-input-border', 'composerInputBorder')
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
    readSlider('cuSelfBubbleSkinSize', 'selfBubbleSkinSize')
    readSlider('cuOtherBubbleSkinSize', 'otherBubbleSkinSize')
    readSlider('cuSelfBubbleSkinSlice', 'selfBubbleSkinSlice')
    readSlider('cuSelfBubbleSkinPadding', 'selfBubbleSkinPadding')
    readSlider('cuOtherBubbleSkinSlice', 'otherBubbleSkinSlice')
    readSlider('cuOtherBubbleSkinPadding', 'otherBubbleSkinPadding')
    readSlider('cuBubbleFs', 'bubbleFontSize')
    readSlider('cuCardRadius', 'cardRadius')
    readSlider('cuTitleSize', 'titleSize')
    readSlider('cuFontSize', 'fontSize')
    readSlider('cuLineHeight', 'lineHeight')
    readSlider('cuImgRadius', 'imageRadius')
    readSlider('cuGap', 'gap')
    readSlider('cuEntryRadius', 'entryRadius')
    readSlider('cuNameSize', 'nameSize')
    readSlider('cuChatBgPosX', 'chatBgPositionX')
    readSlider('cuChatBgPosY', 'chatBgPositionY')
    readSlider('cuChatBgTone', 'chatBgTone')
    readSlider('cuComposerInputRadius', 'composerInputRadius')
    var readabilityToggle = modal.querySelector('#cuChatAutoReadability')
    if (readabilityToggle) s.chatAutoReadability = readabilityToggle.checked
    var composerReadabilityToggle = modal.querySelector('#cuComposerAutoReadability')
    if (composerReadabilityToggle) s.composerAutoReadability = composerReadabilityToggle.checked
    // Style buttons
    var memoStyleBtn = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
    if (memoStyleBtn) s.cardStyle = memoStyleBtn.dataset.cuMemoStyle
    var galleryColBtn = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
    if (galleryColBtn) s.columns = parseInt(galleryColBtn.dataset.cuGalleryCols) || 3
    var bubbleWeightBtn = modal.querySelector('.cu-style-btn.active[data-cu-bubble-weight]')
    if (bubbleWeightBtn) s.bubbleFontWeight = normalizedReaderBubbleFontWeight(bubbleWeightBtn.dataset.cuBubbleWeight)
    modal.querySelectorAll('.cu-style-btn.active[data-cu-bubble-skin-mode]').forEach(function(button) {
      var prefix = button.dataset.cuBubbleSkinSide === 'self' ? 'self' : 'other'
      s[prefix + 'BubbleSkinMode'] = button.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
    })
    var chatBgFitBtn = modal.querySelector('.cu-style-btn.active[data-cu-chat-bg-fit]')
    if (chatBgFitBtn) s.chatBgFit = chatBgFitBtn.dataset.cuChatBgFit === 'contain' ? 'contain' : 'cover'
    var customCssInput = modal.querySelector('#cuAppCustomCss')
    s.customCss = customCssInput && typeof customCssInput.value === 'string'
      ? customCssInput.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
      : ''
    var customCssValidation = compileScopedReaderCss(s.customCss, '.rd-phone-app-' + readerAppCssType(type))
    if (!customCssValidation.ok) throw new Error(customCssValidation.error)
    // Read icon URL
    var iconUrlEl = modal.querySelector('#cuIconUrl')
    appIconDraft = iconUrlEl ? iconUrlEl.value.trim() : appIconDraft
    if (appIconDraft) ct.customIcons[type] = appIconDraft
    else delete ct.customIcons[type]
    if (type === 'messages') {
      Object.assign(s, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
      s.chatBgImage = ov._readerChatBgImageDraft || null
      s.chatBgLuminance = Number.isFinite(ov._readerChatBgLuminanceDraft)
        ? ov._readerChatBgLuminanceDraft
        : null
      s.selfBubbleSkinImage = ov._readerBubbleSkinDraft.self || null
      s.otherBubbleSkinImage = ov._readerBubbleSkinDraft.other || null
    }
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
  if (type === 'messages' && appAppearanceDialog) appAppearanceDialog.classList.add('is-message-appearance')
  bindReaderAppearancePager(ov)
  bindReaderAppPreviewAutoScale(ov)
  if (type === 'messages') {
    ov._readerChatBgImageDraft = s.chatBgImage || null
    ov._readerChatBgLuminanceDraft = Number.isFinite(s.chatBgLuminance)
      ? s.chatBgLuminance
      : null
    ov._readerBubbleSkinDraft = {
      self: s.selfBubbleSkinImage || null,
      other: s.otherBubbleSkinImage || null
    }
  }

  function readerAppDraftSnapshot(settings) {
    var draft = JSON.parse(JSON.stringify(settings || readCurrentSettings(ov, type)))
    if (type === 'messages') {
      Object.assign(draft, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
      draft.chatBgImage = ov._readerChatBgImageDraft || null
      draft.chatBgLuminance = Number.isFinite(ov._readerChatBgLuminanceDraft)
        ? ov._readerChatBgLuminanceDraft
        : null
      draft.selfBubbleSkinImage = ov._readerBubbleSkinDraft.self || null
      draft.otherBubbleSkinImage = ov._readerBubbleSkinDraft.other || null
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      draft.chatAutoReadability = readabilityToggle ? readabilityToggle.checked : draft.chatAutoReadability !== false
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      draft.composerAutoReadability = composerReadabilityToggle
        ? composerReadabilityToggle.checked
        : draft.composerAutoReadability !== false
    }
    var iconInput = ov.querySelector('#cuIconUrl')
    return {
      settings: draft,
      icon: iconInput ? iconInput.value.trim() : appIconDraft
    }
  }

  var initialDraftSignature = JSON.stringify({
    settings: initialSettingsSnapshot,
    icon: initialIconSnapshot
  })
  ov._readerAppDraftDirty = function(settings) {
    return JSON.stringify(readerAppDraftSnapshot(settings)) !== initialDraftSignature
  }
  ov.setReaderBeforeClose(function() {
    if (!ov._readerAppDraftDirty()) return true
    showReaderToast('还有未保存修改', 'info', {
      actionLabel:'放弃修改',
      duration:5000,
      onAction:function() {
        if (ov.isConnected) ov.forceCloseReaderModal()
      }
    })
    return false
  })

  function showOriginalReaderAppPreview() {
    if (!ov.isConnected || appAppearanceDialog.classList.contains('is-comparing-original')) return
    var preview = ov.querySelector('#cuPreview')
    if (!preview) return
    preview.innerHTML = renderCuPreview(type, initialSettingsSnapshot)
      .replace(/^<div class="cu-preview"[^>]*>/, '')
      .replace(/<\/div>$/, '')
    appAppearanceDialog.classList.add('is-comparing-original')
  }

  function restoreReaderAppDraftPreview() {
    if (!appAppearanceDialog.classList.contains('is-comparing-original')) return
    appAppearanceDialog.classList.remove('is-comparing-original')
    updateCuPreview(ov, type)
  }

  var comparisonTimer = null
  var comparisonPointerId = null
  var comparisonStartX = 0
  var comparisonStartY = 0

  function clearComparisonPointer() {
    if (comparisonTimer !== null) globalThis.clearTimeout(comparisonTimer)
    comparisonTimer = null
    comparisonPointerId = null
    document.removeEventListener('pointermove', moveReaderAppComparison)
    document.removeEventListener('pointerup', finishReaderAppComparison)
    document.removeEventListener('pointercancel', finishReaderAppComparison)
  }

  function moveReaderAppComparison(event) {
    if (comparisonPointerId !== null && event.pointerId !== comparisonPointerId) return
    if (appAppearanceDialog.classList.contains('is-comparing-original')) return
    if (Math.max(
      Math.abs(event.clientX - comparisonStartX),
      Math.abs(event.clientY - comparisonStartY)
    ) <= 6) return
    clearComparisonPointer()
  }

  function finishReaderAppComparison(event) {
    if (comparisonPointerId !== null && event.pointerId !== undefined && event.pointerId !== comparisonPointerId) return
    clearComparisonPointer()
    restoreReaderAppDraftPreview()
  }

  ov.addEventListener('pointerdown', function(event) {
    var frame = event.target.closest && event.target.closest('.reader-app-preview-frame')
    if (!frame || event.button !== 0 || comparisonPointerId !== null) return
    comparisonPointerId = event.pointerId
    comparisonStartX = event.clientX
    comparisonStartY = event.clientY
    comparisonTimer = globalThis.setTimeout(function() {
      comparisonTimer = null
      showOriginalReaderAppPreview()
    }, 220)
    document.addEventListener('pointermove', moveReaderAppComparison)
    document.addEventListener('pointerup', finishReaderAppComparison)
    document.addEventListener('pointercancel', finishReaderAppComparison)
  })

  ov.addEventListener('keydown', function(event) {
    if (event.key !== ' ' || event.repeat || !event.target.closest('.reader-app-preview-frame')) return
    event.preventDefault()
    showOriginalReaderAppPreview()
  })
  function releaseReaderAppComparison(event) {
    if (!ov.isConnected) {
      document.removeEventListener('keyup', releaseReaderAppComparison)
      return
    }
    if (event.key !== ' ') return
    restoreReaderAppDraftPreview()
  }
  document.addEventListener('keyup', releaseReaderAppComparison)
  if (typeof MutationObserver === 'function' && document.body) {
    var comparisonRemovalObserver = new MutationObserver(function() {
      if (ov.isConnected) return
      clearComparisonPointer()
      document.removeEventListener('keyup', releaseReaderAppComparison)
      comparisonRemovalObserver.disconnect()
    })
    comparisonRemovalObserver.observe(document.body, { childList:true })
  }

  var messageSettingsSections = Array.from(ov.querySelectorAll('.app-appearance-controls > .cu-settings-section'))

  function revealMessageSettingsSection(sectionId, moveFocus) {
    var section = ov.querySelector('#' + sectionId)
    if (!section) return
    messageSettingsSections.forEach(function(candidate) {
      candidate.open = candidate === section
      if (candidate !== section) candidate.classList.remove('is-preview-targeted')
    })
    section.classList.add('is-preview-targeted')
    globalThis.setTimeout(function() {
      if (section.isConnected) section.classList.remove('is-preview-targeted')
    }, 650)
    var summary = section.querySelector('summary')
    if (moveFocus && summary && typeof summary.focus === 'function') summary.focus({ preventScroll: true })
    if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({
        behavior: shouldUseMotion() ? 'smooth' : 'auto',
        block: 'start'
      })
    }
    var settingsPage = ov.querySelector('[data-appearance-page-target="controls"]')
    if (settingsPage) settingsPage.click()
  }

  function revealMessageBubbleSubsection(subsectionId) {
    var bubbleSection = ov.querySelector('#cuMessageBubbles')
    if (!bubbleSection) return
    bubbleSection.querySelectorAll('.cu-settings-subsection-collapsible').forEach(function(subsection) {
      subsection.open = subsection.id === subsectionId
    })
  }

  messageSettingsSections.forEach(function(section) {
    section.addEventListener('toggle', function() {
      if (!section.open) return
      messageSettingsSections.forEach(function(candidate) {
        if (candidate !== section) candidate.open = false
      })
    })
  })

  if (type === 'messages') {
    ov.addEventListener('click', function(event) {
      var previewChat = event.target.closest && event.target.closest('.rd-app-preview-chat')
      if (!previewChat) return
      if (event.target.closest('#chatSendBtn, .chat-composer')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageActions', event.detail === 0)
        return
      }
      if (event.target.closest('.chat-avatar')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection('cuMessageAvatar')
        return
      }
      if (event.target.closest('.chat-bubble')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection(event.target.closest('.chat-msg.self') ? 'cuMessageSelfBubble' : 'cuMessageOtherBubble')
        return
      }
      if (event.target.closest('.rd-chat-time')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection('cuMessageTypography')
        return
      }
      if (event.target.closest('.chat-msg-area')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBackground', event.detail === 0)
      }
    })

    ov.addEventListener('pointerdown', function(event) {
      var area = event.target.closest && event.target.closest('.rd-app-preview-chat .chat-msg-area')
      if (!area || event.target !== area) return
      var previewChat = area.closest('.rd-app-preview-chat')
      if (!previewChat || previewChat.dataset.chatBackgroundImage !== 'true') return
      var rect = area.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      var startX = event.clientX
      var startY = event.clientY
      var moved = false
      var pointerId = event.pointerId

      function updateWallpaperFocus(pointerEvent) {
        var deltaX = Math.abs(pointerEvent.clientX - startX)
        var deltaY = Math.abs(pointerEvent.clientY - startY)
        if (!moved && Math.max(deltaX, deltaY) < 4) return
        moved = true
        var x = Math.max(0, Math.min(100, Math.round((pointerEvent.clientX - rect.left) / rect.width * 100)))
        var y = Math.max(0, Math.min(100, Math.round((pointerEvent.clientY - rect.top) / rect.height * 100)))
        var positionX = ov.querySelector('#cuChatBgPosX')
        var positionY = ov.querySelector('#cuChatBgPosY')
        var positionXValue = ov.querySelector('#cuChatBgPosXVal')
        var positionYValue = ov.querySelector('#cuChatBgPosYVal')
        if (positionX) positionX.value = String(x)
        if (positionY) positionY.value = String(y)
        setReaderRangeOutput(positionXValue, x + '%')
        setReaderRangeOutput(positionYValue, y + '%')
        previewChat.classList.add('is-wallpaper-dragging')
        previewChat.style.setProperty('--chat-bg-position', x + '% ' + y + '%')
        pointerEvent.preventDefault()
      }

      function finishWallpaperFocus(pointerEvent) {
        if (pointerEvent.pointerId !== undefined && pointerId !== undefined && pointerEvent.pointerId !== pointerId) return
        document.removeEventListener('pointermove', updateWallpaperFocus)
        document.removeEventListener('pointerup', finishWallpaperFocus)
        document.removeEventListener('pointercancel', finishWallpaperFocus)
        previewChat.classList.remove('is-wallpaper-dragging')
        if (moved && ov.isConnected) {
          revealMessageSettingsSection('cuMessageBackground', false)
          updateCuPreview(ov, type)
        }
      }

      document.addEventListener('pointermove', updateWallpaperFocus)
      document.addEventListener('pointerup', finishWallpaperFocus)
      document.addEventListener('pointercancel', finishWallpaperFocus)
    })
  } else {
    var previewSectionTargets = {
      forum:[
        ['.rd-forum-avatar', 'cuForumAvatar'],
        ['.rd-forum-title, .rd-forum-meta', 'cuForumTypography'],
        ['.rd-post-card', 'cuForumCards']
      ],
      memo:[
        ['.rd-memo-note', 'cuMemoAppearance'],
        ['.rd-memo-stack', 'cuMemoStyle']
      ],
      gallery:[
        ['.rd-gallery-photo', 'cuGalleryAppearance'],
        ['.rd-gallery-grid, .gallery-bar', 'cuGalleryGrid']
      ],
      browser:[
        ['.rd-browser-title, .rd-browser-url', 'cuBrowserTypography'],
        ['.rd-browser-entry, .rd-browser-time', 'cuBrowserEntries']
      ],
      shopping:[
        ['.rd-shop-name', 'cuShoppingNames'],
        ['.rd-shop-price', 'cuShoppingPrices']
      ],
      contacts:[
        ['.rd-forum-avatar, .rd-contact-avatar', 'cuContactsAvatar'],
        ['.rd-contact-row, .rd-contact-name', 'cuContactsNames']
      ]
    }
    ov.addEventListener('click', function(event) {
      var previewFrame = event.target.closest && event.target.closest('.reader-app-preview-frame')
      if (!previewFrame) return
      var targets = previewSectionTargets[type] || []
      for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        if (!event.target.closest(targets[targetIndex][0])) continue
        event.preventDefault()
        revealMessageSettingsSection(targets[targetIndex][1], event.detail === 0)
        return
      }
    })
  }

  var bubbleSkinOperationVersion = { self:0, other:0 }
  var bubbleSkinPending = { self:false, other:false }
  var bubbleSkinMeta = { self:null, other:null }

  function readerBubbleSkinKey(side) {
    return side === 'self' ? 'Self' : 'Other'
  }

  function showReaderBubbleSkinError(side, message) {
    var error = ov.querySelector('#cu' + readerBubbleSkinKey(side) + 'BubbleSkinError')
    if (!error) return
    error.hidden = !message
    error.textContent = message || ''
  }

  function syncReaderBubbleSkinControls(side) {
    var key = readerBubbleSkinKey(side)
    var hasImage = !!(ov._readerBubbleSkinDraft && ov._readerBubbleSkinDraft[side])
    var clear = ov.querySelector('#cu' + key + 'BubbleSkinClear')
    var state = ov.querySelector('#cu' + key + 'BubbleSkinState')
    var size = ov.querySelector('#cu' + key + 'BubbleSkinSize')
    var slice = ov.querySelector('#cu' + key + 'BubbleSkinSlice')
    var padding = ov.querySelector('#cu' + key + 'BubbleSkinPadding')
    var modeButtons = ov.querySelectorAll('[data-cu-bubble-skin-mode][data-cu-bubble-skin-side="' + side + '"]')
    var activeMode = ov.querySelector('.active[data-cu-bubble-skin-mode][data-cu-bubble-skin-side="' + side + '"]')
    var mode = activeMode && activeMode.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
    var sliceRow = ov.querySelector('[data-cu-bubble-skin-slice-row="' + side + '"]')
    if (clear) clear.disabled = !hasImage
    if (size) size.disabled = !hasImage
    if (slice) slice.disabled = !hasImage || mode !== 'slice'
    if (padding) padding.disabled = !hasImage
    modeButtons.forEach(function(button) { button.disabled = !hasImage })
    if (sliceRow) sliceRow.hidden = mode !== 'slice'
    if (state) {
      state.textContent = hasImage
        ? (mode === 'full'
          ? '完整显示整张素材；可继续调整大小与文字留白。'
          : '切片拉伸边缘；适合中心区域可以延展的素材。')
        : '未使用，继续显示背景色与圆角。'
      if (hasImage && bubbleSkinMeta[side]) {
        renderReaderAppearanceImageChoice(state, bubbleSkinMeta[side], function(nextUrl, nextMeta) {
          ov._readerBubbleSkinDraft[side] = nextUrl
          bubbleSkinMeta[side] = nextMeta
          var section = ov.querySelector('#cuMessageBubbles')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          syncReaderBubbleSkinControls(side)
          updateCuPreview(ov, type)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }
    }
  }

  function syncReaderBubbleSkinPending() {
    var save = ov.querySelector('#cuModalSave')
    if (!save) return
    if (bubbleSkinPending.self || bubbleSkinPending.other) save.dataset.readerAsyncPending = 'true'
    else delete save.dataset.readerAsyncPending
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  }

  function bindReaderBubbleSkinControls(side) {
    var key = readerBubbleSkinKey(side)
    var upload = ov.querySelector('#cu' + key + 'BubbleSkinUpload')
    var fileInput = ov.querySelector('#cu' + key + 'BubbleSkinFile')
    var clear = ov.querySelector('#cu' + key + 'BubbleSkinClear')
    if (upload && fileInput) {
      upload.onclick = function() { fileInput.click() }
      fileInput.onchange = function() {
        var file = fileInput.files && fileInput.files[0]
        if (!file) return
        fileInput.value = ''
        var operationVersion = ++bubbleSkinOperationVersion[side]
        showReaderBubbleSkinError(side, '')
        bubbleSkinPending[side] = true
        syncReaderBubbleSkinPending()
        readReaderCallBackgroundFile(file).then(function(dataUrl) {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          ov._readerBubbleSkinDraft[side] = dataUrl
          syncReaderBubbleSkinControls(side)
          updateCuPreview(ov, type)
          inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
            if (!meta || !ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
            bubbleSkinMeta[side] = meta
            syncReaderBubbleSkinControls(side)
            var section = ov.querySelector('#cuMessageBubbles')
            if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
            if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
          })
        }).catch(function(error) {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          showReaderBubbleSkinError(side, error && error.message ? error.message : '图片无法使用')
        }).finally(function() {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          bubbleSkinPending[side] = false
          syncReaderBubbleSkinPending()
        })
      }
    }
    if (clear) clear.onclick = function() {
      bubbleSkinOperationVersion[side] += 1
      bubbleSkinPending[side] = false
      ov._readerBubbleSkinDraft[side] = null
      bubbleSkinMeta[side] = null
      showReaderBubbleSkinError(side, '')
      syncReaderBubbleSkinControls(side)
      syncReaderBubbleSkinPending()
      updateCuPreview(ov, type)
    }
    syncReaderBubbleSkinControls(side)
  }

  if (type === 'messages') {
    bindReaderBubbleSkinControls('self')
    bindReaderBubbleSkinControls('other')
  }

  var chatBackgroundSaveButton = ov.querySelector('#cuModalSave')
  var chatBackgroundError = ov.querySelector('#cuChatBackgroundError')
  var chatBackgroundState = ov.querySelector('#cuChatBackgroundState')
  var chatBackgroundClear = ov.querySelector('#cuChatBackgroundClear')
  var chatBackgroundOperationVersion = 0
  var chatBackgroundMeta = null

  function syncReaderChatBackgroundControls() {
    var hasImage = !!ov._readerChatBgImageDraft
    if (chatBackgroundClear) chatBackgroundClear.disabled = !hasImage
    if (chatBackgroundState) {
      chatBackgroundState.textContent = hasImage
        ? '已选择本地图片；可以拖动左侧预览调整壁纸焦点。'
        : '当前使用背景色。'
      if (hasImage && chatBackgroundMeta) {
        renderReaderAppearanceImageChoice(chatBackgroundState, chatBackgroundMeta, function(nextUrl, nextMeta) {
          ov._readerChatBgImageDraft = nextUrl
          chatBackgroundMeta = nextMeta
          var section = ov.querySelector('#cuMessageBackground')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          syncReaderChatBackgroundControls()
          updateCuPreview(ov, type)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }
    }
  }

  function showReaderChatBackgroundError(message) {
    if (!chatBackgroundError) return
    chatBackgroundError.hidden = !message
    chatBackgroundError.textContent = message || ''
  }

  function finishReaderChatBackgroundOperation(version) {
    if (!ov.isConnected || version !== chatBackgroundOperationVersion) return
    if (chatBackgroundSaveButton) {
      delete chatBackgroundSaveButton.dataset.readerAsyncPending
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  }

  var chatBackgroundUpload = ov.querySelector('#cuChatBackgroundUpload')
  var chatBackgroundFile = ov.querySelector('#cuChatBackgroundFile')
  if (chatBackgroundUpload && chatBackgroundFile) {
    chatBackgroundUpload.onclick = function() { chatBackgroundFile.click() }
    chatBackgroundFile.onchange = function() {
      var file = chatBackgroundFile.files && chatBackgroundFile.files[0]
      if (!file) return
      chatBackgroundFile.value = ''
      var operationVersion = ++chatBackgroundOperationVersion
      showReaderChatBackgroundError('')
      if (chatBackgroundSaveButton) {
        chatBackgroundSaveButton.dataset.readerAsyncPending = 'true'
        chatBackgroundSaveButton.disabled = true
      }
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (!ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
        ov._readerChatBgImageDraft = dataUrl
        ov._readerChatBgLuminanceDraft = verifiedReaderImageLuminance.has(dataUrl)
          ? verifiedReaderImageLuminance.get(dataUrl)
          : null
        syncReaderChatBackgroundControls()
        updateCuPreview(ov, type)
        inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
          if (!meta || !ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
          chatBackgroundMeta = meta
          syncReaderChatBackgroundControls()
          var section = ov.querySelector('#cuMessageBackground')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }).catch(function(error) {
        if (!ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
        showReaderChatBackgroundError(error && error.message ? error.message : '图片无法使用')
      }).finally(function() {
        finishReaderChatBackgroundOperation(operationVersion)
      })
    }
  }
  if (chatBackgroundClear) chatBackgroundClear.onclick = function() {
    chatBackgroundOperationVersion += 1
    ov._readerChatBgImageDraft = null
    ov._readerChatBgLuminanceDraft = null
    chatBackgroundMeta = null
    showReaderChatBackgroundError('')
    syncReaderChatBackgroundControls()
    updateCuPreview(ov, type)
  }
  syncReaderChatBackgroundControls()

  var callBackgroundSaveButton = ov.querySelector('#cuModalSave')
  var callBackgroundError = ov.querySelector('#cuCallBackgroundError')
  var callBackgroundState = ov.querySelector('#cuCallBackgroundState')
  var callBackgroundOperationVersion = 0
  var callBackgroundMeta = null

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
      callBackgroundMeta = null
      if (callBackgroundState) callBackgroundState.textContent = ''
      callBackgroundDraft = {
        callBackgroundType: 'preset',
        callBackgroundPreset: button.dataset.cuCallBackgroundPreset,
        callBackgroundImage: null
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  })
  var callBackgroundRestore = ov.querySelector('#cuCallBackgroundRestore')
  if (callBackgroundRestore) callBackgroundRestore.onclick = function() {
    invalidateReaderCallBackgroundOperation()
    clearReaderCallBackgroundError()
    callBackgroundMeta = null
    if (callBackgroundState) callBackgroundState.textContent = ''
    callBackgroundDraft = Object.assign({}, READER_CALL_BACKGROUND_DEFAULT)
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
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
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
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
        syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
        inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
          if (!meta || !ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion) return
          callBackgroundMeta = meta
          renderReaderAppearanceImageChoice(callBackgroundState, meta, function(nextUrl, nextMeta) {
            callBackgroundDraft = {
              callBackgroundType:'image',
              callBackgroundPreset:callBackgroundDraft.callBackgroundPreset,
              callBackgroundImage:nextUrl
            }
            callBackgroundMeta = nextMeta
            syncReaderCallBackgroundControls(ov, callBackgroundDraft)
            renderReaderAppearanceImageChoice(callBackgroundState, nextMeta, null)
            var section = ov.querySelector('#cuMessageCall')
            if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
            if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
          })
          var section = ov.querySelector('#cuMessageCall')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
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

  function readerColorPickerValue(value) {
    return readerColorInputValue(value)
  }

  function setMessageSliderControl(id, value) {
    var input = ov.querySelector('#' + id)
    var output = ov.querySelector('#' + id + 'Val')
    if (input) input.value = String(value)
    if (output) {
      var unitNode = output.querySelector && output.querySelector('.appearance-range-value-unit')
      var unit = unitNode ? unitNode.textContent : output.textContent.replace(/^-?[\d.]+/, '')
      setReaderRangeOutput(output, String(value) + unit)
    }
  }

  function setMessageColorControl(attribute, value) {
    ov.querySelectorAll('.cu-color-btn[data-' + attribute + ']').forEach(function(button) {
      var active = button.getAttribute('data-' + attribute) === value
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
    var picker = ov.querySelector('.cu-color-picker[data-' + attribute + '-picker]')
    if (picker) {
      picker.value = readerColorPickerValue(value)
      picker.setAttribute('data-' + attribute + '-picker', value)
    }
  }

  function setMessageStyleControl(selector, attribute, value) {
    ov.querySelectorAll(selector).forEach(function(button) {
      button.classList.toggle('active', button.getAttribute(attribute) === String(value))
    })
  }

  function applyReaderAppDraftSettings(nextSettings, nextIcon) {
    var next = JSON.parse(JSON.stringify(nextSettings || defaultReaderAppSettings(type)))
    var sliderSettings = {
      cuMsgAvSize:'avatarSize', cuSelfRadius:'selfBubbleRadius', cuOtherRadius:'otherBubbleRadius',
      cuSelfBubbleSkinSize:'selfBubbleSkinSize', cuOtherBubbleSkinSize:'otherBubbleSkinSize',
      cuSelfBubbleSkinSlice:'selfBubbleSkinSlice', cuSelfBubbleSkinPadding:'selfBubbleSkinPadding',
      cuOtherBubbleSkinSlice:'otherBubbleSkinSlice', cuOtherBubbleSkinPadding:'otherBubbleSkinPadding',
      cuBubbleFs:'bubbleFontSize', cuCardRadius:'cardRadius', cuTitleSize:'titleSize',
      cuFontSize:'fontSize', cuLineHeight:'lineHeight', cuImgRadius:'imageRadius',
      cuGap:'gap', cuEntryRadius:'entryRadius', cuNameSize:'nameSize',
      cuChatBgPosX:'chatBgPositionX', cuChatBgPosY:'chatBgPositionY', cuChatBgTone:'chatBgTone',
      cuComposerInputRadius:'composerInputRadius'
    }
    Object.keys(sliderSettings).forEach(function(id) {
      var key = sliderSettings[id]
      if (next[key] !== undefined) setMessageSliderControl(id, next[key])
    })
    var colorSettings = {
      'cu-self-bg':'selfBubbleBg', 'cu-self-text':'selfBubbleText',
      'cu-other-bg':'otherBubbleBg', 'cu-other-text':'otherBubbleText',
      'cu-chat-bg':'chatBg', 'cu-time-color':'timeColor', 'cu-send-bg':'sendButtonBg',
      'cu-composer-bg':'composerBg', 'cu-composer-input-bg':'composerInputBg',
      'cu-composer-input-text':'composerInputText', 'cu-composer-input-border':'composerInputBorder',
      'cu-card-bg':'cardBg', 'cu-title-color':'titleColor', 'cu-text-color':'textColor',
      'cu-url-color':'urlColor', 'cu-name-color':'nameColor', 'cu-price-color':'priceColor'
    }
    Object.keys(colorSettings).forEach(function(attribute) {
      var key = colorSettings[attribute]
      if (next[key] !== undefined) setMessageColorControl(attribute, next[key])
    })
    setMessageStyleControl('.cu-shape-btn[data-cu-shape]', 'data-cu-shape', next.avatarShape)
    setMessageStyleControl('.cu-style-btn[data-cu-memo-style]', 'data-cu-memo-style', next.cardStyle)
    setMessageStyleControl('.cu-style-btn[data-cu-gallery-cols]', 'data-cu-gallery-cols', next.columns)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-weight]', 'data-cu-bubble-weight', normalizedReaderBubbleFontWeight(next.bubbleFontWeight))
    setMessageStyleControl('.cu-style-btn[data-cu-chat-bg-fit]', 'data-cu-chat-bg-fit', next.chatBgFit)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="self"]', 'data-cu-bubble-skin-mode', next.selfBubbleSkinMode)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="other"]', 'data-cu-bubble-skin-mode', next.otherBubbleSkinMode)
    var customCssInput = ov.querySelector('#cuAppCustomCss')
    if (customCssInput) customCssInput.value = next.customCss || ''
    var iconInput = ov.querySelector('#cuIconUrl')
    if (iconInput && nextIcon !== undefined) {
      appIconDraft = nextIcon || ''
      iconInput.value = appIconDraft
    }
    if (type === 'messages') {
      chatBackgroundOperationVersion += 1
      chatBackgroundMeta = null
      bubbleSkinOperationVersion.self += 1
      bubbleSkinOperationVersion.other += 1
      bubbleSkinPending.self = false
      bubbleSkinPending.other = false
      pendingPersistedCallBackground = null
      pendingPersistedFallbackDraft = null
      invalidateReaderCallBackgroundOperation()
      ov._readerChatBgImageDraft = next.chatBgImage || null
      ov._readerChatBgLuminanceDraft = Number.isFinite(next.chatBgLuminance)
        ? next.chatBgLuminance
        : null
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      if (readabilityToggle) readabilityToggle.checked = next.chatAutoReadability !== false
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      if (composerReadabilityToggle) composerReadabilityToggle.checked = next.composerAutoReadability !== false
      ov._readerBubbleSkinDraft.self = next.selfBubbleSkinImage || null
      ov._readerBubbleSkinDraft.other = next.otherBubbleSkinImage || null
      bubbleSkinMeta.self = null
      bubbleSkinMeta.other = null
      callBackgroundDraft = normalizedReaderCallBackgroundSettings(next)
      showReaderBubbleSkinError('self', '')
      showReaderBubbleSkinError('other', '')
      syncReaderBubbleSkinControls('self')
      syncReaderBubbleSkinControls('other')
      syncReaderBubbleSkinPending()
      syncReaderChatBackgroundControls()
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    }
    updateCuPreview(ov, type)
  }

  function resetReaderMessageSection(sectionKey, button) {
    var defaults = defaultReaderMessageSettings()
    if (sectionKey === 'bubbles') {
      bubbleSkinOperationVersion.self += 1
      bubbleSkinOperationVersion.other += 1
      bubbleSkinPending.self = false
      bubbleSkinPending.other = false
      setMessageStyleControl('.cu-shape-btn[data-cu-shape]', 'data-cu-shape', defaults.avatarShape)
      setMessageSliderControl('cuMsgAvSize', defaults.avatarSize)
      setMessageColorControl('cu-self-bg', defaults.selfBubbleBg)
      setMessageColorControl('cu-self-text', defaults.selfBubbleText)
      setMessageSliderControl('cuSelfRadius', defaults.selfBubbleRadius)
      setMessageSliderControl('cuSelfBubbleSkinSize', defaults.selfBubbleSkinSize)
      setMessageSliderControl('cuSelfBubbleSkinSlice', defaults.selfBubbleSkinSlice)
      setMessageSliderControl('cuSelfBubbleSkinPadding', defaults.selfBubbleSkinPadding)
      setMessageColorControl('cu-other-bg', defaults.otherBubbleBg)
      setMessageColorControl('cu-other-text', defaults.otherBubbleText)
      setMessageSliderControl('cuOtherRadius', defaults.otherBubbleRadius)
      setMessageSliderControl('cuOtherBubbleSkinSize', defaults.otherBubbleSkinSize)
      setMessageSliderControl('cuOtherBubbleSkinSlice', defaults.otherBubbleSkinSlice)
      setMessageSliderControl('cuOtherBubbleSkinPadding', defaults.otherBubbleSkinPadding)
      setMessageSliderControl('cuBubbleFs', defaults.bubbleFontSize)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-weight]', 'data-cu-bubble-weight', defaults.bubbleFontWeight)
      setMessageColorControl('cu-time-color', defaults.timeColor)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="self"]', 'data-cu-bubble-skin-mode', defaults.selfBubbleSkinMode)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="other"]', 'data-cu-bubble-skin-mode', defaults.otherBubbleSkinMode)
      ov._readerBubbleSkinDraft.self = null
      ov._readerBubbleSkinDraft.other = null
      bubbleSkinMeta.self = null
      bubbleSkinMeta.other = null
      showReaderBubbleSkinError('self', '')
      showReaderBubbleSkinError('other', '')
      syncReaderBubbleSkinControls('self')
      syncReaderBubbleSkinControls('other')
      syncReaderBubbleSkinPending()
    } else if (sectionKey === 'background') {
      chatBackgroundOperationVersion += 1
      chatBackgroundMeta = null
      ov._readerChatBgImageDraft = null
      ov._readerChatBgLuminanceDraft = null
      showReaderChatBackgroundError('')
      setMessageColorControl('cu-chat-bg', defaults.chatBg)
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      if (readabilityToggle) readabilityToggle.checked = defaults.chatAutoReadability
      setMessageStyleControl('.cu-style-btn[data-cu-chat-bg-fit]', 'data-cu-chat-bg-fit', defaults.chatBgFit)
      setMessageSliderControl('cuChatBgTone', defaults.chatBgTone)
      setMessageSliderControl('cuChatBgPosX', defaults.chatBgPositionX)
      setMessageSliderControl('cuChatBgPosY', defaults.chatBgPositionY)
      syncReaderChatBackgroundControls()
    } else if (sectionKey === 'actions') {
      setMessageColorControl('cu-send-bg', defaults.sendButtonBg)
      setMessageColorControl('cu-composer-bg', defaults.composerBg)
      setMessageColorControl('cu-composer-input-bg', defaults.composerInputBg)
      setMessageColorControl('cu-composer-input-text', defaults.composerInputText)
      setMessageColorControl('cu-composer-input-border', defaults.composerInputBorder)
      setMessageSliderControl('cuComposerInputRadius', defaults.composerInputRadius)
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      if (composerReadabilityToggle) composerReadabilityToggle.checked = defaults.composerAutoReadability
    } else if (sectionKey === 'call') {
      pendingPersistedCallBackground = null
      pendingPersistedFallbackDraft = null
      invalidateReaderCallBackgroundOperation()
      clearReaderCallBackgroundError()
      callBackgroundDraft = normalizedReaderCallBackgroundSettings(defaults)
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    } else {
      return
    }
    updateCuPreview(ov, type)
    if (button) {
      var previousLabel = button.textContent
      button.textContent = '已恢复'
      globalThis.setTimeout(function() {
        if (button.isConnected) button.textContent = previousLabel
      }, 900)
    }
  }

  ov.querySelectorAll('[data-cu-reset-message-section]').forEach(function(button) {
    button.onclick = function() {
      resetReaderMessageSection(button.dataset.cuResetMessageSection, button)
    }
  })

  // Icon upload / clear handlers (need ov to be created)
  var iconUploadBtn = ov.querySelector('#cuIconUpload')
  if (iconUploadBtn) iconUploadBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = function() {
      var file = inp.files[0]; if (!file) return
      var r = new FileReader()
      r.onload = function() {
        appIconDraft = r.result
        ov.querySelector('#cuIconUrl').value = r.result
        updateCuPreview(ov, type)
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  var iconClearBtn = ov.querySelector('#cuIconClear')
  if (iconClearBtn) iconClearBtn.onclick = function() {
    appIconDraft = ''
    var urlEl = ov.querySelector('#cuIconUrl'); if (urlEl) urlEl.value = ''
    var preview = ov.querySelector('.rd-preview-img'); if (preview) preview.remove()
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  }
  var iconDraftInput = ov.querySelector('#cuIconUrl')
  if (iconDraftInput) iconDraftInput.addEventListener('input', function() {
    appIconDraft = iconDraftInput.value.trim()
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  })
  // Read icon URL on save (via onSave callback above already reads from ct.customIcons)
  // Real-time preview updates
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    sl.addEventListener('input', function() {
      if (sl.id === 'cuComposerInputRadius') {
        var composerAuto = ov.querySelector('#cuComposerAutoReadability')
        if (composerAuto) composerAuto.checked = false
      }
      updateCuPreview(ov, type)
    })
  })
  ov.querySelectorAll('.cu-color-picker').forEach(function(p) {
    p.addEventListener('input', function() {
      if (p.closest('#cuMessageActions')) {
        var composerAuto = ov.querySelector('#cuComposerAutoReadability')
        if (composerAuto) composerAuto.checked = false
      }
      Array.from(p.attributes).forEach(function(attribute) {
        if (/^data-cu-.*-picker$/.test(attribute.name)) {
          p.setAttribute(attribute.name, p.value)
        }
      })
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
  var appCssInput = ov.querySelector('#cuAppCustomCss')
  if (appCssInput) {
    appCssInput.addEventListener('input', function() { updateCuPreview(ov, type) })
  }
  var chatAutoReadability = ov.querySelector('#cuChatAutoReadability')
  if (chatAutoReadability) {
    chatAutoReadability.addEventListener('change', function() { updateCuPreview(ov, type) })
  }
  var composerAutoReadability = ov.querySelector('#cuComposerAutoReadability')
  if (composerAutoReadability) {
    composerAutoReadability.addEventListener('change', function() { updateCuPreview(ov, type) })
  }
  var appCssSample = ov.querySelector('#cuAppCssSample')
  if (appCssSample && appCssInput) appCssSample.onclick = function() {
    appCssInput.value = type === 'messages'
      ? '.chat-input-bar { padding: 6px 8px !important; }\n#chatInput { font-size: 11px; }\n#chatSendBtn { border-radius: 8px; }'
      : ':scope { --phone-system-accent: #9f6678; }\n.rd-phone-app-body { padding: 14px; }'
    updateCuPreview(ov, type)
    appCssInput.focus()
  }
  var messageActionsCss = ov.querySelector('#cuMessageActionsCss')
  if (messageActionsCss && appCssInput) messageActionsCss.onclick = function() {
    var moreSection = ov.querySelector('#cuMessageMore')
    if (moreSection) moreSection.open = true
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
      updateCuPreview(ov, type)
    }
  })
  // Bind shape buttons
  ov.querySelectorAll('.cu-shape-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-shape-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
      updateCuPreview(ov, type)
    }
  })
  // Bind style buttons
  ov.querySelectorAll('.cu-style-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-style-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
      if (b.dataset.cuBubbleSkinMode) syncReaderBubbleSkinControls(b.dataset.cuBubbleSkinSide)
      updateCuPreview(ov, type)
    }
  })
  enhanceReaderAppearanceRanges(ov)
  bindReaderAppearanceSectionStates(ov)
  var appearanceUndo = bindReaderAppearanceUndo(ov, {
    capture:function() { return readerAppDraftSnapshot() },
    restore:function(snapshot) {
      applyReaderAppDraftSettings(snapshot.settings, snapshot.icon)
    }
  })
  ov.querySelectorAll('[data-cu-copy-bubble-style]').forEach(function(button) {
    button.onclick = function() {
      var direction = button.dataset.cuCopyBubbleStyle
      var from = direction === 'other-to-self' ? 'other' : 'self'
      var to = from === 'self' ? 'other' : 'self'
      var snapshot = readerAppDraftSnapshot()
      var next = snapshot.settings
      ;['BubbleBg', 'BubbleText', 'BubbleRadius', 'BubbleSkinImage', 'BubbleSkinMode', 'BubbleSkinSize', 'BubbleSkinSlice', 'BubbleSkinPadding'].forEach(function(suffix) {
        next[to + suffix] = next[from + suffix]
      })
      applyReaderAppDraftSettings(next, snapshot.icon)
      revealMessageSettingsSection('cuMessageBubbles', false)
      revealMessageBubbleSubsection(to === 'self' ? 'cuMessageSelfBubble' : 'cuMessageOtherBubble')
      if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
      showReaderToast((from === 'self' ? '我方' : '对方') + '气泡样式已复制')
    }
  })
  syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  // Reset
  var resetBtn = ov.querySelector('#cuAppReset')
  if (resetBtn) resetBtn.onclick = function() {
    var previous = readerAppDraftSnapshot()
    applyReaderAppDraftSettings(defaultReaderAppSettings(type), previous.icon)
    showReaderToast((labels[type] || 'App') + '已恢复默认，保存后生效', 'success', {
      actionLabel:'撤销',
      duration:5000,
      onAction:function() {
        if (ov.isConnected) applyReaderAppDraftSettings(previous.settings, previous.icon)
      }
    })
  }
}

function bindCuSliders(ov) {
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    var valEl = ov.querySelector('#' + sl.id + 'Val')
    sl.oninput = function() {
      if (valEl) {
        var unitNode = valEl.querySelector && valEl.querySelector('.appearance-range-value-unit')
        var unit = unitNode ? unitNode.textContent : (valEl.textContent.replace(/[\d.]+/, '') || '')
        setReaderRangeOutput(valEl, this.value + unit)
      }
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
    if (ownerControl.dataset.readerPhoneControl === 'profile') openReaderProfilePanel(ownerControl)
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
