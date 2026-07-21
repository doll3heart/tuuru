// Tuuru Works - Phone Editor
import { uid, PHONE_APP_DEFS, PHONE_READER_OWNED_CONTROL_TYPES, DEFAULT_PHONE_APP_COLORS, DEFAULT_PHONE_SKIN, avatarColor, MOMO_AVATARS, USERXX_AVATARS, randomMomoName, randomUserXXName, randomAvatar } from "../data.js"
import { getPhoneWork as getWork, updatePhoneWork as updateWork } from "../phone-work-access.js"
import { escapeHtmlAttribute, sanitizeCssColor, sanitizeIconHtml } from "../sanitize.js"
import { createPhoneModalCloseController } from "../phone-modal-lifecycle.js"
import {
  PHONE_GRID_METRICS,
  getPhoneGridCell,
  getPhoneGridItemOffset,
  phoneGridContainerStyle,
  phoneGridItemStyle,
} from "../phone-grid.js"
import { showToast, renderHeader, modal } from "../app.js"
import { buildPhoneReadingFlowSequence, expandPhoneReadingFlowSequence } from "../phone-reading-flow.js"
import { contactDisplayName, resolveContactIdentity } from "../contact-identity.js"

var _workId = null
var _dragState = null
var _suppressedClickIcon = null
var _phoneIconSnapTimers = new WeakMap()
var _flowDragItem = null
var _flowDragStartY = 0
var _flowDragOrigIdx = -1
var _flowFrame = null
var _flowWid = null
var _flowPd = null

var PHONE_APP_TYPES_WITH_OWN_HEADER = new Set(['messages', 'forum', 'memo', 'gallery', 'browser', 'shopping'])
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

function openThreadReplyChoiceEditor(owner, options) {
  if (!owner || typeof owner !== 'object') return null
  options = options || {}
  var originalChoices = Array.isArray(owner.choices) ? owner.choices : []
  var groups = originalChoices.map(function(choice) {
    return {
      id: choice.id || '',
      text: choice.text || '',
      replyText: choice.replyText || '',
      followUpLines: Array.isArray(choice.followUpMessages)
        ? choice.followUpMessages.map(function(message) { return message.text || message.content || '' }).join('\n')
        : ''
    }
  })
  if (!groups.length) groups.push({id: '', text: '', replyText: '', followUpLines: ''})

  var body = '<div id="threadChoiceGroups"></div>'
  body += '<button type="button" id="threadChoiceAdd" class="btn btn-sm btn-outline" style="width:100%">+ 添加完整句子</button>'
  var overlay = modal(options.title || '编辑回复选项', body,
    '<button type="button" id="threadChoiceSave" class="btn btn-primary btn-sm">保存</button><button type="button" id="threadChoiceDeleteAll" class="btn btn-ghost btn-sm">删除选项组</button><button type="button" id="threadChoiceCancel" class="btn btn-ghost btn-sm">取消</button>')
  var list = overlay.querySelector('#threadChoiceGroups')

  function collect() {
    var rows = list.querySelectorAll('.thread-choice-row')
    rows.forEach(function(row, index) {
      if (!groups[index]) return
      groups[index].text = row.querySelector('.thread-choice-text')?.value || ''
      groups[index].replyText = row.querySelector('.thread-choice-reply')?.value || ''
      groups[index].followUpLines = row.querySelector('.thread-choice-followups')?.value || ''
    })
  }

  function render() {
    collect()
    list.innerHTML = groups.map(function(group, index) {
      var html = '<div class="thread-choice-row" data-thread-choice-index="' + index + '" style="position:relative;margin-bottom:8px;padding:9px;border:1px solid var(--c-border)">'
      html += '<label class="form-label">读者看到的完整句子</label><input class="thread-choice-text form-input" value="' + escAttr(group.text) + '" placeholder="例如：我知道了。">'
      html += '<label class="form-label" style="margin-top:6px">读者发出的回复</label><input class="thread-choice-reply form-input" value="' + escAttr(group.replyText) + '" placeholder="通常与上面相同">'
      html += '<label class="form-label" style="margin-top:6px">角色后续消息（每行一个气泡）</label><textarea class="thread-choice-followups form-textarea" style="min-height:54px">' + esc(group.followUpLines) + '</textarea>'
      html += '<button type="button" class="thread-choice-remove" data-thread-choice-remove="' + index + '" aria-label="删除这条回复" style="position:absolute;right:5px;top:5px;border:0;background:transparent;color:var(--c-text2);cursor:pointer">×</button></div>'
      return html
    }).join('')
    list.querySelectorAll('[data-thread-choice-remove]').forEach(function(button) {
      button.onclick = function() {
        collect()
        groups.splice(Number(button.dataset.threadChoiceRemove), 1)
        if (!groups.length) groups.push({id: '', text: '', replyText: '', followUpLines: ''})
        render()
      }
    })
  }

  overlay.querySelector('#threadChoiceAdd').onclick = function() {
    collect()
    groups.push({id: '', text: '', replyText: '', followUpLines: ''})
    render()
  }
  overlay.querySelector('#threadChoiceCancel').onclick = function() { overlay.remove() }
  overlay.querySelector('#threadChoiceDeleteAll').onclick = function() {
    if (!confirm('确定删除这组回复选项？')) return
    owner.choices = undefined
    options.onSave?.(undefined)
    overlay.remove()
  }
  overlay.querySelector('#threadChoiceSave').onclick = function() {
    collect()
    var nextChoices = []
    groups.forEach(function(group) {
      var text = group.text.trim()
      if (!text) return
      var previous = originalChoices.find(function(choice) { return group.id && choice.id === group.id })
      var previousFollowUps = Array.isArray(previous?.followUpMessages) ? previous.followUpMessages : []
      var followUpLines = group.followUpLines.split('\n').map(function(line) { return line.trim() }).filter(Boolean)
      var followUpMessages = followUpLines.map(function(line, index) {
        var oldMessage = previousFollowUps[index]
        return Object.assign({}, oldMessage || {}, {
          id: oldMessage?.id || uid(),
          senderId: oldMessage?.senderId || options.defaultFollowUpSenderId || owner.contactId || 'self',
          text: line,
          content: line,
          type: oldMessage?.type || 'text'
        })
      })
      var next = Object.assign({}, previous || {}, {
        id: previous?.id || uid(),
        text: text,
        replyText: group.replyText.trim() || text,
        followUpMessages: followUpMessages
      })
      delete next.used
      nextChoices.push(next)
    })
    owner.choices = nextChoices.length ? nextChoices : undefined
    options.onSave?.(owner.choices)
    overlay.remove()
  }
  render()
  return overlay
}

function applyPhoneGridItemPosition(icon, desktopX, desktopY) {
  var offset = getPhoneGridItemOffset(desktopX, desktopY)
  icon.style.removeProperty('left')
  icon.style.removeProperty('top')
  icon.style.setProperty('--phone-grid-x', offset.left + 'px')
  icon.style.setProperty('--phone-grid-y', offset.top + 'px')
  icon.dataset.desktopX = String(desktopX)
  icon.dataset.desktopY = String(desktopY)
}

function requestPhoneAppModalClose(frame, reason) {
  var requestClose = frame && frame._requestPhoneAppModalClose
  if (typeof requestClose !== 'function') return false
  requestClose(reason)
  return true
}

function exitPhoneAppEditor(frame, wid, beforeExit) {
  var returnAppType = frame && frame.dataset ? frame.dataset._returnAppType || '' : ''
  var active = document.activeElement
  if (active && frame.contains(active) && typeof active.blur === 'function') {
    active.blur()
  }
  if (beforeExit) beforeExit()
  if (requestPhoneAppModalClose(frame, 'app-back')) return

  frame.style.pointerEvents = 'none'
  frame.innerHTML = frame.dataset._origHTML || ''
  delete frame.dataset._origHTML
  delete frame.dataset._returnAppType
  frame.style.transform = 'translateZ(0)'
  void frame.offsetHeight
  requestAnimationFrame(function() {
    frame.style.transform = ''
    frame.style.pointerEvents = ''
    attachDrag(wid)
    if (returnAppType) {
      var icons = frame.querySelectorAll('.phone-app-icon')
      for (var i = 0; i < icons.length; i++) {
        if (icons[i].dataset.appType === returnAppType) {
          icons[i].focus()
          break
        }
      }
    }
  })
}

function bindPhoneAppModalViewport(overlay) {
  var viewport = typeof window !== 'undefined' ? window.visualViewport : null
  if (!viewport) return function() {}

  function syncViewport() {
    var height = Number(viewport.height)
    var offsetTop = Number(viewport.offsetTop)
    if (Number.isFinite(height) && height > 0) {
      overlay.style.setProperty('--phone-app-viewport-height', height + 'px')
    } else {
      overlay.style.removeProperty('--phone-app-viewport-height')
    }
    overlay.style.setProperty(
      '--phone-app-viewport-offset-top',
      (Number.isFinite(offsetTop) ? offsetTop : 0) + 'px'
    )
  }

  var canListen = typeof viewport.addEventListener === 'function' && typeof viewport.removeEventListener === 'function'
  syncViewport()
  if (canListen) {
    viewport.addEventListener('resize', syncViewport)
    viewport.addEventListener('scroll', syncViewport)
  }

  var active = true
  return function releaseViewport() {
    if (!active) return
    active = false
    if (canListen) {
      viewport.removeEventListener('resize', syncViewport)
      viewport.removeEventListener('scroll', syncViewport)
    }
  }
}

function isTopmostModalOverlay(overlay) {
  var overlays = document.querySelectorAll('.modal-overlay')
  return overlays.length > 0 && overlays[overlays.length - 1] === overlay
}

function focusFirstModalControl(container) {
  if (!container) return false
  var target = container.querySelector(
    '.phone-app-modal-close, .cu-header .cu-close-btn, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  if (!target || typeof target.focus !== 'function') return false
  target.focus()
  return document.activeElement === target
}

function focusPhoneAppModal(inner) {
  return focusFirstModalControl(inner)
}

function restorePhoneAppModalFocus(target) {
  if (target && target !== document.body && target.isConnected && typeof target.focus === 'function') {
    target.focus()
    if (document.activeElement === target) return
  }

  var overlays = document.querySelectorAll('.modal-overlay')
  if (overlays.length > 0) focusFirstModalControl(overlays[overlays.length - 1])
}

export function openPhoneAppModal(wid, appType, options = {}) {
  var w = getWork(wid)
  if (!w) { showToast('作品未找到'); return }
  if (!w.phoneData) {
    w.phoneData = {
      contacts: [], chats: [], moments: [], forumPosts: [], forumNpcs: [],
      memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
      skin: JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN)),
      apps: []
    }
    updateWork(wid, { phoneData: w.phoneData })
  }
  var pd = w.phoneData
  var contacts = pd.contacts || []
  var previouslyFocused = document.activeElement

  var labels = { messages: '消息', forum: '论坛', memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物清单', profile: '个人主页', contacts: '联系人' }
  var title = labels[appType] || 'App'

  // Build overlay
  var ov = document.createElement('div')
  ov.className = 'modal-overlay phone-app-modal-overlay'
  var releaseViewport = bindPhoneAppModalViewport(ov)

  var inner = document.createElement('div')
  inner.className = 'phone-app-modal-inner'
  inner.setAttribute('role', 'dialog')
  inner.setAttribute('aria-label', title)

  var topBar = document.createElement('div')
  topBar.className = 'phone-app-modal-header'
  topBar.innerHTML = '<span class="phone-app-modal-title">' + esc(title) + '</span><button class="phone-app-modal-close" type="button" aria-label="关闭">&times;</button>'

  var content = document.createElement('div')
  content.className = 'phone-app-modal-content'

  var usesOwnHeader = PHONE_APP_TYPES_WITH_OWN_HEADER.has(appType)
  if (!usesOwnHeader) inner.appendChild(topBar)
  inner.appendChild(content)
  ov.appendChild(inner)

  // Close button
  var closeBtn = topBar.querySelector('button')
  var releaseKeyboard = function() {}
  var close = createPhoneModalCloseController({
    beforeClose: function(reason) {
      var active = document.activeElement
      if (active && content.contains(active) && typeof active.blur === 'function') {
        active.blur()
      }
      return options.beforeClose ? options.beforeClose(reason) : undefined
    },
    remove: function() {
      releaseKeyboard()
      releaseViewport()
      delete content._requestPhoneAppModalClose
      ov.remove()
      restorePhoneAppModalFocus(previouslyFocused)
    },
    afterClose: options.afterClose
  })
  function requestClose(reason) {
    try {
      var closed = close(reason)
      if (!closed && ov.isConnected) focusPhoneAppModal(inner)
      return closed
    } catch (error) {
      if (ov.isConnected) focusPhoneAppModal(inner)
      console.error('Failed to close phone App modal', error)
      return false
    }
  }

  content._requestPhoneAppModalClose = requestClose
  if (!usesOwnHeader) closeBtn.addEventListener('click', function() { requestClose('button') })
  ov.addEventListener('click', function(e) { if (e.target === ov) requestClose('backdrop') })

  function onKeyDown(e) {
    if (e.defaultPrevented || e.key !== 'Escape' || !isTopmostModalOverlay(ov)) return
    e.preventDefault()
    requestClose('escape')
  }
  document.addEventListener('keydown', onKeyDown)
  releaseKeyboard = function() { document.removeEventListener('keydown', onKeyDown) }

  document.body.appendChild(ov)

  // Render the app inside
  var frame = content

  try {
    switch (appType) {
      case 'messages':
        openMessagesEditor(frame, wid, pd)
        break
      case 'forum':
        openForumEditor(frame, wid, { id: uid(), name: '论坛', avatarUrl: '' }, pd)
        break
      case 'memo':
        openCharacterAccessEditor(frame, wid, 'memo', pd)
        break
      case 'gallery':
        openCharacterAccessEditor(frame, wid, 'gallery', pd)
        break
      case 'browser':
        openCharacterAccessEditor(frame, wid, 'browser', pd)
        break
      case 'shopping':
        openCharacterAccessEditor(frame, wid, 'shopping', pd)
        break
      case 'profile':
        var h = '<div class="cu-panel pf-panel" style="height:100%;position:relative">'
        h += '<div class="cu-body"><div class="cu-section"><div class="cu-section-title">个人主页</div>'
        h += '<div style="text-align:center;padding:20px"><div style="width:60px;height:60px;border-radius:50%;background:var(--c-surface2);display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--c-text2)">' + esc((pd.skin?.readerId || '读者').charAt(0)) + '</div>'
        h += '<div style="font-size:.9rem;color:var(--c-text);margin-top:8px;font-weight:500">' + esc(pd.skin?.readerId || '读者') + '</div></div>'
        h += '</div></div>'
        frame.innerHTML = h
        break
      case 'contacts':
        renderContactsModal(frame, wid, pd)
        break
    }
    focusPhoneAppModal(inner)
  } catch (error) {
    releaseKeyboard()
    releaseViewport()
    delete content._requestPhoneAppModalClose
    ov.remove()
    restorePhoneAppModalFocus(previouslyFocused)
    throw error
  }

  return ov
}

function renderContactsModal(frame, wid, pd) {
  var contacts = pd.contacts || []

  function persist() {
    pd.contacts = contacts
    updateWork(wid, { phoneData: pd })
  }

  function saveAndRefresh() {
    persist()
    renderList()
  }

  function collectField(field, key) {
    var inputs = frame.querySelectorAll('[data-ct-' + field + ']')
    inputs.forEach(function(input) {
      var idx = parseInt(input.dataset.ctIdx)
      if (idx >= 0 && idx < contacts.length) contacts[idx][key] = input.value || ''
    })
  }

  function flushFields() {
    collectField('name', 'name')
    collectField('alias', 'alias')
    collectField('note', 'note')
    collectField('msgid', 'msgId')
    collectField('forum', 'forumId')
    collectField('face', 'faceUrl')
    persist()
  }

  function renderList() {
    var h = '<div class="cu-panel" style="height:100%;position:relative;display:flex;flex-direction:column">'
    h += '<div class="cu-body" style="flex:1;overflow-y:auto">'
    if (contacts.length === 0) {
      h += '<div class="pf-empty">暂无联系人，点击下方按钮添加</div>'
    } else {
      h += renderPfContacts(contacts)
    }
    h += '</div>'
    h += '<div style="padding:8px 10px;border-top:1px solid var(--c-border);background:var(--c-surface);flex-shrink:0">'
    h += '<button id="ctModalAddBtn" class="btn btn-sm btn-primary" style="width:100%">+ 添加联系人</button>'
    h += '</div>'
    h += '</div>'
    frame.innerHTML = h

    // Bind add button
    var addBtn = frame.querySelector('#ctModalAddBtn')
    if (addBtn) {
      addBtn.onclick = function() {
        flushFields()
        var ov = modal('添加联系人', '<div class="form-group"><input id="ctNewNameInput" class="form-input" placeholder="联系人姓名" autofocus></div>', '<button id="ctNewNameOk" class="btn btn-primary btn-sm">确定</button><button id="ctNewNameCancel" class="btn btn-ghost btn-sm">取消</button>')
        var okBtn = ov.querySelector('#ctNewNameOk')
        var cancelBtn2 = ov.querySelector('#ctNewNameCancel')
        var inputEl = ov.querySelector('#ctNewNameInput')
        if (okBtn && inputEl) {
          okBtn.onclick = function() {
            var name = inputEl.value.trim()
            if (!name) return
            contacts.push({ id: uid(), name: name, alias: '', avatarUrl: '', note: '', faceUrl: '', msgId: '', forumId: '' })
            saveAndRefresh()
            ov.remove()
          }
          inputEl.onkeydown = function(e) { if (e.key === 'Enter') okBtn.click() }
        }
        if (cancelBtn2) cancelBtn2.onclick = function() { ov.remove() }
        setTimeout(function() { if (inputEl) inputEl.focus() }, 100)
      }
    }

    var cardInputs = frame.querySelectorAll('[data-ct-name], [data-ct-alias], [data-ct-note], [data-ct-msgid], [data-ct-forum], [data-ct-face]')
    cardInputs.forEach(function(input) {
      input.addEventListener('change', flushFields)
      input.addEventListener('blur', flushFields)
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur() }
      })
    })

    var delBtns = frame.querySelectorAll('[data-ct-del]')
    delBtns.forEach(function(btn) {
      btn.onclick = function() {
        flushFields()
        var idx = parseInt(btn.dataset.ctIdx)
        if (idx >= 0 && idx < contacts.length) {
          contacts.splice(idx, 1)
          saveAndRefresh()
        }
      }
    })

    var avatars = frame.querySelectorAll('[data-ct-avatar]')
    avatars.forEach(function(avatar) {
      avatar.onclick = function() {
        flushFields()
        var idx = parseInt(avatar.dataset.ctIdx)
        if (idx < 0 || idx >= contacts.length) return
        var ov = modal('设置头像', '<div class="form-group"><label class="form-label">图片链接</label><input id="ctAvatarUrlInput" class="form-input" placeholder="输入头像图片 URL" value="' + esc(contacts[idx].avatarUrl || '') + '" autofocus></div>' + IMGHOST_HINT, '<button id="ctAvatarOk" class="btn btn-primary btn-sm">确定</button><button id="ctAvatarCancel" class="btn btn-ghost btn-sm">取消</button>')
        var inputEl = ov.querySelector('#ctAvatarUrlInput')
        var okBtn = ov.querySelector('#ctAvatarOk')
        if (okBtn && inputEl) {
          okBtn.onclick = function() {
            contacts[idx].avatarUrl = inputEl.value.trim()
            saveAndRefresh()
            ov.remove()
          }
          inputEl.onkeydown = function(e) { if (e.key === 'Enter') okBtn.click() }
        }
        var cancelBtn = ov.querySelector('#ctAvatarCancel')
        if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
      }
    })
  }

  renderList()
}

export function renderPhoneEditor(wid) {
  _workId = wid
  var w = getWork(wid)
  if (!w || !w.phoneData) return '<div class="app-main"><div class="empty-state"><h3>手机模块未找到</h3></div></div>'

  var pd = w.phoneData
  if (!pd.skin) pd.skin = JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN))
  var skin = pd.skin
  if (skin.readerId === '旅人' || skin.readerId === '12345678' || !skin.readerId) {
    skin.readerId = '读者'
    updateWork(wid, { phoneData: pd })
  }

  var ensured = ensureApps(pd)
  var apps = pd.apps || []
  var patched = patchApps(apps, pd, wid)
  if (ensured || patched) updateWork(wid, { phoneData: pd })

  var usesDefaultWallpaper = skin.wallpaper === DEFAULT_PHONE_SKIN.wallpaper && skin.wallpaperType !== 'image' && !skin.wallpaperImage
  var h = '<div class="phone-editor-wrap" data-phone-arrange-mode="false">'
  h += '<div class="phone-frame' + (usesDefaultWallpaper ? ' phone-default-wallpaper' : '') + '" id="phoneFrame"'
  h += ' style="--phone-bg:' + sanitizeCssColor(skin.wallpaper, { fallback: DEFAULT_PHONE_SKIN.wallpaper }) + ';'
  h += '--phone-radius:' + skin.borderRadius + 'px;'
  h += '--phone-font:\'' + (skin.fontFamily || '').replace(/'/g,"") + '\', sans-serif;'
  h += '--phone-fontsize:' + skin.fontSize + 'px;'
  h += '--phone-frame:' + skin.frameColor + ';'
  h += '">'

  h += '<div class="phone-editor-controls">'
  h += '<span class="phone-arrange-hint" aria-hidden="true"></span>'
  h += '<span class="phone-arrange-instructions" id="phoneArrangeInstructions"></span>'
  h += '<span class="phone-arrange-status" role="status" aria-live="polite" aria-atomic="true"></span>'
  h += '<button type="button" class="phone-arrange-toggle" aria-pressed="false" aria-controls="phoneArrangeMoveControls" aria-label="排列 App">排列</button>'
  h += '</div>'
  h += '<div class="phone-arrange-move-controls" id="phoneArrangeMoveControls" role="group" aria-label="移动所选 App">'
  h += '<button type="button" class="phone-arrange-move" data-phone-move="left" data-move-x="-1" data-move-y="0" aria-label="向左移动所选 App" disabled>&larr;</button>'
  h += '<button type="button" class="phone-arrange-move" data-phone-move="up" data-move-x="0" data-move-y="-1" aria-label="向上移动所选 App" disabled>&uarr;</button>'
  h += '<button type="button" class="phone-arrange-move" data-phone-move="down" data-move-x="0" data-move-y="1" aria-label="向下移动所选 App" disabled>&darr;</button>'
  h += '<button type="button" class="phone-arrange-move" data-phone-move="right" data-move-x="1" data-move-y="0" aria-label="向右移动所选 App" disabled>&rarr;</button>'
  h += '</div>'

  if (skin.showDynamicIsland) {
    h += '<div class="phone-island"><div class="phone-island-pill"></div></div>'
  }

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

  h += '<div class="phone-desktop" id="phoneDesktop" style="' + phoneGridContainerStyle() + '">'
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    if (!app.enabled) continue
    var desktopX = Number(app.desktopX)
    var desktopY = Number(app.desktopY)
    if (!Number.isFinite(desktopX)) desktopX = 0
    if (!Number.isFinite(desktopY)) desktopY = 0
    var appName = String(app.name ?? '').trim()
    if (!appName) appName = String(PHONE_APP_DEFS[app.type]?.label || 'App')
    h += '<button type="button" class="phone-app-icon" aria-label="' + escAttr(appName) + '" data-app-id="' + escapeHtmlAttribute(app.id || '') + '" data-app-type="' + escapeHtmlAttribute(app.type || '') + '" data-desktop-x="' + desktopX + '" data-desktop-y="' + desktopY + '" onselectstart="return false"'
    h += ' style="' + phoneGridItemStyle(desktopX, desktopY) + 'border:none!important;box-shadow:none!important">'
    h += '<span class="phone-icon-body icon-shadow" style="background:' + sanitizeCssColor(app.color, { fallback: 'var(--c-surface2)' }) + ';">'
    h += '<span class="phone-icon-char">' + (sanitizeIconHtml(app.icon || '?') || '?') + '</span>'
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

  h += '</div></div>'
  setTimeout(function() { attachDrag(wid) }, 50)
  return h
}

function ensureApps(pd) {
  var sourceApps = pd.apps || []
  var apps = sourceApps.filter(function(app) {
    return !PHONE_READER_OWNED_CONTROL_TYPES.includes(app.type)
  })
  var changed = apps.length !== sourceApps.length
  if (changed) pd.apps = apps
  var existingTypes = {}
  for (var i = 0; i < apps.length; i++) existingTypes[apps[i].type] = true
  var keys = Object.keys(PHONE_APP_DEFS).filter(function(t) {
    return !PHONE_READER_OWNED_CONTROL_TYPES.includes(t)
  })
  var added = false
  for (var k = 0; k < keys.length; k++) {
    var t = keys[k]
    if (!existingTypes[t]) {
      var def = PHONE_APP_DEFS[t]
      var slot = apps.length
      apps.push({
        id: uid(), type: t, name: def.label, icon: def.icon, color: DEFAULT_PHONE_APP_COLORS[t] || def.color,
        desktopX: slot % PHONE_GRID_METRICS.columns, desktopY: Math.floor(slot / PHONE_GRID_METRICS.columns), enabled: true
      })
      added = true
    }
  }
  if (added) pd.apps = apps
  return changed || added
}

function patchApps(apps, pd, wid) {
  var dirty = false
  var keptApps = apps.filter(function(app) {
    return !PHONE_READER_OWNED_CONTROL_TYPES.includes(app.type)
  })
  if (keptApps.length !== apps.length) {
    apps.length = 0
    for (var keptIndex = 0; keptIndex < keptApps.length; keptIndex++) {
      apps.push(keptApps[keptIndex])
    }
    pd.apps = apps
    dirty = true
  }
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    if (app.type === 'chat') { app.type = 'messages'; dirty = true }
    var def = PHONE_APP_DEFS[app.type]
    if (def) {
      if (!app.icon || app.icon.indexOf('<svg') < 0) { app.icon = def.icon; dirty = true }
      if (!app.color || app.color === '#f0f0f0') {
        app.color = DEFAULT_PHONE_APP_COLORS[app.type] || def.color
        dirty = true
      }
      if (!app.name) { app.name = def.label; dirty = true }
    }
    if (app.desktopX === undefined || app.desktopY === undefined) {
      app.desktopX = i % PHONE_GRID_METRICS.columns
      app.desktopY = Math.floor(i / PHONE_GRID_METRICS.columns)
      dirty = true
    }
    if (app.enabled === undefined) { app.enabled = true; dirty = true }
  }
  var seen = {}
  var deduped = []
  for (var d = 0; d < apps.length; d++) {
    if (!seen[apps[d].type]) { seen[apps[d].type] = true; deduped.push(apps[d]) }
    else { dirty = true }
  }
  if (deduped.length < apps.length) { pd.apps = deduped; apps = deduped }
  return dirty
}

// ===== Drag-to-reorder =====
var _dragHandlers = null
var PHONE_ICON_DRAG_THRESHOLD = 5
var PHONE_BOUNDED_LAYOUT_QUERY = '(max-width: 480px), (max-height: 480px) and (pointer: coarse)'

function clearSuppressedPhoneIconClick() {
  _suppressedClickIcon = null
}

function phoneArrangeModeEnabled(target) {
  var wrap = target && target.closest ? target.closest('.phone-editor-wrap') : null
  return !!wrap && wrap.dataset.phoneArrangeMode === 'true'
}

function phoneBoundedLayoutMedia() {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_BOUNDED_LAYOUT_QUERY) : null
  } catch (error) {
    return null
  }
}

function boundedPointerNeedsArrangeMode() {
  var media = phoneBoundedLayoutMedia()
  return !!media && media.matches
}

function phoneArrangeIconName(icon) {
  return String(icon && icon.getAttribute('aria-label') || 'App')
}

function setPhoneArrangeStatus(wrap, message) {
  var status = wrap && wrap.querySelector('.phone-arrange-status')
  if (status) status.textContent = message || ''
}

function updatePhoneArrangeMoveControls(wrap, icon) {
  if (!wrap) return
  var active = phoneArrangeModeEnabled(wrap)
  var col = icon ? parseInt(icon.dataset.desktopX) || 0 : 0
  var row = icon ? parseInt(icon.dataset.desktopY) || 0 : 0
  wrap.querySelectorAll('.phone-arrange-move').forEach(function(button) {
    var deltaX = parseInt(button.dataset.moveX) || 0
    var deltaY = parseInt(button.dataset.moveY) || 0
    var nextCol = Math.max(0, Math.min(PHONE_GRID_METRICS.columns - 1, col + deltaX))
    var nextRow = Math.max(0, Math.min(PHONE_GRID_METRICS.rows - 1, row + deltaY))
    button.disabled = !active || !icon || (nextCol === col && nextRow === row)
  })
}

function setPhoneArrangeSelection(wrap, selectedIcon, announce) {
  if (!wrap || !phoneArrangeModeEnabled(wrap)) return
  wrap.querySelectorAll('.phone-app-icon').forEach(function(icon) {
    var selected = icon === selectedIcon
    if (selected) icon.classList.add('arrange-selected')
    else icon.classList.remove('arrange-selected')
    icon.setAttribute('aria-pressed', selected ? 'true' : 'false')
  })
  updatePhoneArrangeMoveControls(wrap, selectedIcon)
  if (selectedIcon && announce !== false) {
    var col = (parseInt(selectedIcon.dataset.desktopX) || 0) + 1
    var row = (parseInt(selectedIcon.dataset.desktopY) || 0) + 1
    setPhoneArrangeStatus(wrap, '已选择' + phoneArrangeIconName(selectedIcon) + '，第' + row + '行第' + col + '列')
  }
}

function announcePhoneArrangeMove(wrap, icon, position) {
  if (!position) return
  var message = phoneArrangeIconName(icon) + '已移至第' + (position.row + 1) + '行第' + (position.col + 1) + '列'
  if (position.displacedName) message += '，与' + position.displacedName + '交换位置'
  setPhoneArrangeStatus(wrap, message)
}

function setPhoneArrangeMode(wrap, enabled) {
  if (!wrap) return
  cancelPhoneIconDrag()
  clearSuppressedPhoneIconClick()

  var active = enabled === true
  wrap.dataset.phoneArrangeMode = active ? 'true' : 'false'
  var toggle = wrap.querySelector('.phone-arrange-toggle')
  var hint = wrap.querySelector('.phone-arrange-hint')
  var instructions = wrap.querySelector('.phone-arrange-instructions')
  if (toggle) {
    toggle.setAttribute('aria-pressed', active ? 'true' : 'false')
    toggle.setAttribute('aria-label', active ? '完成 App 排列' : '排列 App')
    toggle.textContent = active ? '完成' : '排列'
  }
  if (hint) hint.textContent = active ? '点选 App 后移动 · Esc 完成' : ''
  if (instructions) instructions.textContent = active
    ? '选择 App 后可使用方向按钮移动，也可拖动或使用键盘方向键；按 Esc 完成排列。'
    : ''
  setPhoneArrangeStatus(wrap, '')
  wrap.querySelectorAll('.phone-app-icon').forEach(function(icon) {
    icon.classList.remove('arrange-selected')
    if (active) {
      icon.setAttribute('aria-describedby', 'phoneArrangeInstructions')
      icon.setAttribute('aria-pressed', 'false')
    } else {
      if (icon.getAttribute('aria-describedby') === 'phoneArrangeInstructions') icon.removeAttribute('aria-describedby')
      icon.removeAttribute('aria-pressed')
    }
  })
  updatePhoneArrangeMoveControls(wrap, null)
}

function suppressNextPhoneIconClick(icon) {
  _suppressedClickIcon = icon
}

function consumeSuppressedPhoneIconClick(icon, event) {
  if (_suppressedClickIcon !== icon) return false
  clearSuppressedPhoneIconClick()
  return !event || event.detail !== 0
}

function releasePhoneIconPointer(state) {
  var icon = state && state.icon
  if (!icon || typeof icon.releasePointerCapture !== 'function') return

  try {
    if (typeof icon.hasPointerCapture !== 'function' || icon.hasPointerCapture(state.pointerId)) {
      icon.releasePointerCapture(state.pointerId)
    }
  } catch (error) {
    // Capture may already have been released by the browser.
  }
}

function clearPhoneIconDragAppearance(icon) {
  if (!icon) return
  icon.classList.remove('dragging')
  icon.style.zIndex = ''
  icon.style.transition = ''
}

function cancelPhoneIconSnapCleanup(icon) {
  var pending = icon && _phoneIconSnapTimers.get(icon)
  if (!pending) return
  clearTimeout(pending.timer)
  _phoneIconSnapTimers.delete(icon)
}

function schedulePhoneIconSnapCleanup(icon) {
  cancelPhoneIconSnapCleanup(icon)
  var token = {}
  var timer = setTimeout(function() {
    var pending = _phoneIconSnapTimers.get(icon)
    if (!pending || pending.token !== token) return
    _phoneIconSnapTimers.delete(icon)
    if (!_dragState || _dragState.icon !== icon) clearPhoneIconDragAppearance(icon)
  }, 200)
  _phoneIconSnapTimers.set(icon, { timer: timer, token: token })
}

function cancelPhoneIconDrag(pointerId) {
  if (!_dragState) return false
  if (pointerId !== undefined && pointerId !== _dragState.pointerId) return false

  var state = _dragState
  _dragState = null
  applyPhoneGridItemPosition(state.icon, state.origCol, state.origRow)
  releasePhoneIconPointer(state)
  clearPhoneIconDragAppearance(state.icon)
  return true
}

function removePhoneIconDragHandlers() {
  if (!_dragHandlers) return
  _dragHandlers.forEach(function(handler) {
    handler.el.removeEventListener(handler.type, handler.listener)
  })
  _dragHandlers = null
}

function rememberPhoneIconDragHandler(el, type, listener) {
  el.addEventListener(type, listener)
  _dragHandlers.push({ el: el, type: type, listener: listener })
}

function attachDrag(wid) {
  cancelPhoneIconDrag()
  removePhoneIconDragHandlers()
  var desktop = document.getElementById('phoneDesktop')
  if (!desktop) return

  _dragHandlers = []

  var wrap = desktop.closest('.phone-editor-wrap')
  var arrangeToggle = wrap && wrap.querySelector('.phone-arrange-toggle')
  if (arrangeToggle) {
    setPhoneArrangeMode(wrap, wrap.dataset.phoneArrangeMode === 'true')
    rememberPhoneIconDragHandler(arrangeToggle, 'click', function(event) {
      event.preventDefault()
      setPhoneArrangeMode(wrap, !phoneArrangeModeEnabled(wrap))
    })

    var boundedMedia = phoneBoundedLayoutMedia()
    if (boundedMedia && typeof boundedMedia.addEventListener === 'function') {
      rememberPhoneIconDragHandler(boundedMedia, 'change', function(event) {
        if (!event.matches) setPhoneArrangeMode(wrap, false)
      })
    }

    rememberPhoneIconDragHandler(wrap, 'keydown', function(event) {
      if (event.key !== 'Escape' || !phoneArrangeModeEnabled(wrap)) return
      event.preventDefault()
      setPhoneArrangeMode(wrap, false)
      arrangeToggle.focus()
    })

    wrap.querySelectorAll('.phone-arrange-move').forEach(function(button) {
      rememberPhoneIconDragHandler(button, 'click', function(event) {
        event.preventDefault()
        var selectedIcon = wrap.querySelector('.phone-app-icon.arrange-selected')
        if (!selectedIcon || button.disabled) return
        var position = movePhoneIconByGridStep(
          wid,
          selectedIcon,
          parseInt(button.dataset.moveX) || 0,
          parseInt(button.dataset.moveY) || 0
        )
        if (!position) return
        setPhoneArrangeSelection(wrap, selectedIcon, false)
        announcePhoneArrangeMove(wrap, selectedIcon, position)
      })
    })
  }

  var icons = desktop.querySelectorAll('.phone-app-icon')
  icons.forEach(function(icon) {
    icon.onmouseenter = function() {
      if (!icon.classList.contains('dragging')) icon.classList.add('hover-on')
    }
    icon.onmouseleave = function() {
      icon.classList.remove('hover-on')
    }

    var onPointerDown = function(e) {
      if (_dragState || e.isPrimary === false || e.button !== 0) return
      if (boundedPointerNeedsArrangeMode() && !phoneArrangeModeEnabled(icon)) return
      clearSuppressedPhoneIconClick()
      startDrag(wid, icon, e)
    }
    var onPointerMove = function(e) {
      if (!_dragState || _dragState.icon !== icon || _dragState.pointerId !== e.pointerId) return
      if (moveDrag(e.pointerId, e.clientX, e.clientY)) e.preventDefault()
    }
    var onPointerUp = function(e) {
      if (!_dragState || _dragState.icon !== icon || _dragState.pointerId !== e.pointerId) return
      moveDrag(e.pointerId, e.clientX, e.clientY)
      if (endDrag(e.pointerId)) e.preventDefault()
    }
    var onPointerCancel = function(e) {
      if (_dragState && _dragState.icon === icon) cancelPhoneIconDrag(e.pointerId)
    }
    var onLostPointerCapture = function(e) {
      if (_dragState && _dragState.icon === icon) cancelPhoneIconDrag(e.pointerId)
    }
    var onKeyDown = function(e) {
      if (!phoneArrangeModeEnabled(icon)) return
      var deltas = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1]
      }
      var delta = deltas[e.key]
      if (!delta) return
      e.preventDefault()
      setPhoneArrangeSelection(wrap, icon, false)
      var position = movePhoneIconByGridStep(wid, icon, delta[0], delta[1])
      if (position) {
        updatePhoneArrangeMoveControls(wrap, icon)
        announcePhoneArrangeMove(wrap, icon, position)
      }
    }

    rememberPhoneIconDragHandler(icon, 'pointerdown', onPointerDown)
    rememberPhoneIconDragHandler(icon, 'pointermove', onPointerMove)
    rememberPhoneIconDragHandler(icon, 'pointerup', onPointerUp)
    rememberPhoneIconDragHandler(icon, 'pointercancel', onPointerCancel)
    rememberPhoneIconDragHandler(icon, 'lostpointercapture', onLostPointerCapture)
    rememberPhoneIconDragHandler(icon, 'keydown', onKeyDown)
  })

  rememberPhoneIconDragHandler(window, 'blur', function() { cancelPhoneIconDrag() })
}

function startDrag(wid, icon, event) {
  var rect = icon.getBoundingClientRect()
  var desktop = document.getElementById('phoneDesktop')
  if (!desktop) return
  var deskRect = desktop.getBoundingClientRect()
  var deskScrollLeft = desktop.scrollLeft || 0
  var deskScrollTop = desktop.scrollTop || 0
  cancelPhoneIconSnapCleanup(icon)
  clearPhoneIconDragAppearance(icon)
  _dragState = {
    icon: icon, wid: wid,
    pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
    origLeft: rect.left - deskRect.left + deskScrollLeft,
    origTop: rect.top - deskRect.top + deskScrollTop,
    origCol: parseInt(icon.dataset.desktopX) || 0,
    origRow: parseInt(icon.dataset.desktopY) || 0,
    deskLeft: deskRect.left, deskTop: deskRect.top,
    desktop: desktop,
    containerWidth: deskRect.width,
    didDrag: false
  }

  if (typeof icon.setPointerCapture !== 'function') {
    cancelPhoneIconDrag(event.pointerId)
    return
  }

  try {
    icon.setPointerCapture(event.pointerId)
  } catch (error) {
    cancelPhoneIconDrag(event.pointerId)
    return
  }

  if (typeof icon.hasPointerCapture === 'function' && !icon.hasPointerCapture(event.pointerId)) {
    cancelPhoneIconDrag(event.pointerId)
  }
}

function moveDrag(pointerId, mx, my) {
  if (!_dragState || _dragState.pointerId !== pointerId) return false
  var dx = mx - _dragState.startX
  var dy = my - _dragState.startY
  if (!_dragState.didDrag && Math.abs(dx) < PHONE_ICON_DRAG_THRESHOLD && Math.abs(dy) < PHONE_ICON_DRAG_THRESHOLD) {
    return false
  }

  if (!_dragState.didDrag) {
    _dragState.didDrag = true
    _dragState.icon.classList.add('dragging')
    _dragState.icon.style.zIndex = '100'
    _dragState.icon.style.transition = 'none'
  }

  var icon = _dragState.icon
  var scrollLeft = _dragState.desktop.scrollLeft || 0
  var scrollTop = _dragState.desktop.scrollTop || 0
  icon.style.left = (mx - _dragState.deskLeft - _dragState.offsetX + scrollLeft) + 'px'
  icon.style.top = (my - _dragState.deskTop - _dragState.offsetY + scrollTop) + 'px'
  return true
}

function endDrag(pointerId) {
  if (!_dragState || _dragState.pointerId !== pointerId) return false
  var state = _dragState
  _dragState = null
  releasePhoneIconPointer(state)
  if (!state.didDrag) return false

  suppressNextPhoneIconClick(state.icon)
  commitPhoneIconDrag(state)
  return true
}

function commitPhoneIconDrag(state) {
  var icon = state.icon
  var left = parseFloat(icon.style.left)
  var top = parseFloat(icon.style.top)
  if (!Number.isFinite(left)) left = state.origLeft
  if (!Number.isFinite(top)) top = state.origTop
  var cell = getPhoneGridCell(state.containerWidth, left, top)
  var col = Math.max(0, Math.min(PHONE_GRID_METRICS.columns - 1, cell.x))
  var row = Math.max(0, Math.min(PHONE_GRID_METRICS.rows - 1, cell.y))

  var position = commitPhoneIconGridPosition(state.wid, icon, col, row, state.origCol, state.origRow)
  var wrap = icon.closest('.phone-editor-wrap')
  if (wrap && phoneArrangeModeEnabled(wrap)) {
    var selectedIcon = wrap.querySelector('.phone-app-icon.arrange-selected')
    updatePhoneArrangeMoveControls(wrap, selectedIcon)
    if (selectedIcon === icon) {
      announcePhoneArrangeMove(wrap, icon, position)
    } else if (selectedIcon && position.displacedIcon === selectedIcon) {
      announcePhoneArrangeMove(wrap, selectedIcon, {
        col: position.displacedCol,
        row: position.displacedRow,
        displacedName: phoneArrangeIconName(icon)
      })
    }
  }
}

function movePhoneIconByGridStep(wid, icon, deltaX, deltaY) {
  var origCol = parseInt(icon.dataset.desktopX) || 0
  var origRow = parseInt(icon.dataset.desktopY) || 0
  var col = Math.max(0, Math.min(PHONE_GRID_METRICS.columns - 1, origCol + deltaX))
  var row = Math.max(0, Math.min(PHONE_GRID_METRICS.rows - 1, origRow + deltaY))
  if (col === origCol && row === origRow) return null

  var position = commitPhoneIconGridPosition(wid, icon, col, row, origCol, origRow)
  if (typeof icon.scrollIntoView === 'function') {
    icon.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  return position
}

function commitPhoneIconGridPosition(wid, icon, col, row, origCol, origRow) {
  var position = {
    col: col, row: row, displacedName: '',
    displacedIcon: null, displacedCol: null, displacedRow: null
  }
  var w = getWork(wid)
  if (w && w.phoneData) {
    var apps = w.phoneData.apps || []
    var appId = icon.dataset.appId
    for (var i = 0; i < apps.length; i++) {
      var a = apps[i]
      if (a.id === appId || !a.enabled) continue
      if (a.desktopX === col && a.desktopY === row) {
        var ec = findEmptyCell(apps, appId, origCol, origRow)
        a.desktopX = ec.x; a.desktopY = ec.y
        var oi = document.querySelector('[data-app-id="' + a.id + '"]')
        position.displacedName = oi ? phoneArrangeIconName(oi) : String(a.name || 'App')
        position.displacedIcon = oi
        position.displacedCol = ec.x
        position.displacedRow = ec.y
        if (oi) {
          applyPhoneGridItemPosition(oi, a.desktopX, a.desktopY)
          oi.style.transition = 'left .15s, top .15s'
          schedulePhoneIconSnapCleanup(oi)
        }
        break
      }
    }
    var app = apps.find(function(aa) { return aa.id === appId })
    if (app) { app.desktopX = col; app.desktopY = row; updateWork(wid, { phoneData: w.phoneData }) }
  }

  applyPhoneGridItemPosition(icon, col, row)
  icon.style.transition = 'left .15s, top .15s'
  schedulePhoneIconSnapCleanup(icon)
  return position
}

function findEmptyCell(apps, excludeId, prefX, prefY) {
  var px = Math.max(0, Math.min(PHONE_GRID_METRICS.columns - 1, prefX))
  var py = Math.max(0, Math.min(PHONE_GRID_METRICS.rows - 1, prefY))
  var occupied = false
  for (var i = 0; i < apps.length; i++) {
    var a = apps[i]
    if (a.id === excludeId || !a.enabled) continue
    if (a.desktopX === px && a.desktopY === py) { occupied = true; break }
  }
  if (!occupied) return { x: px, y: py }
  for (var r = 0; r < PHONE_GRID_METRICS.rows + 5; r++) {
    for (var c = 0; c < PHONE_GRID_METRICS.columns; c++) {
      var found = true
      for (var j = 0; j < apps.length; j++) {
        var b = apps[j]
        if (b.id === excludeId || !b.enabled) continue
        if (b.desktopX === c && b.desktopY === r) { found = false; break }
      }
      if (found) return { x: c, y: r }
    }
  }
  return { x: 0, y: 0 }
}

// ===== App click handler =====
document.addEventListener('click', function(e) {
  var icon = e.target.closest('.phone-app-icon')
  if (!icon) return
  if (consumeSuppressedPhoneIconClick(icon, e)) { e.preventDefault(); return }
  if (phoneArrangeModeEnabled(icon)) {
    e.preventDefault()
    clearSuppressedPhoneIconClick()
    setPhoneArrangeSelection(icon.closest('.phone-editor-wrap'), icon, true)
    return
  }
  clearSuppressedPhoneIconClick()

  e.preventDefault()
  if (window.getSelection) window.getSelection().removeAllRanges()

  var type = icon.dataset.appType
  switch (type) {
    case 'settings': openSettingsEditor(_workId); break
    case 'customize': openCustomizePanel(_workId); break
    case 'messages': openCharacterAccessPanel(_workId, 'messages'); break
    case 'forum': openCharacterAccessPanel(_workId, 'forum'); break
    case 'memo': openCharacterAccessPanel(_workId, 'memo'); break
    case 'gallery': openCharacterAccessPanel(_workId, 'gallery'); break
    case 'browser': openCharacterAccessPanel(_workId, 'browser'); break
    case 'shopping': openCharacterAccessPanel(_workId, 'shopping'); break
    case 'profile': openProfilePanel(_workId); break
    case 'contacts': openContactsPanel(_workId); break
    default: showToast('待开发')
  }
})

// ===== Customize Panel =====
var IMGHOST_HINT = '<p class="cu-hint">推荐图床：<a href="http://www.superbed.cn/" target="_blank">聚合图床 superbed.cn</a></p>'

function openCustomizePanel(wid) {
  var w = getWork(wid)
  if (!w || !w.phoneData) return
  var pd = w.phoneData
  if (!pd.skin) pd.skin = JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN))
  var skin = JSON.parse(JSON.stringify(pd.skin))
  var apps = (pd.apps || []).slice()

  var frame = document.getElementById('phoneFrame')
  if (!frame) return
  var origHTML = frame.innerHTML
  frame.dataset._origHTML = origHTML
  frame.dataset._activeTab = 'wallpaper'
  frame.dataset._skin = JSON.stringify(skin)
  frame.dataset._apps = JSON.stringify(apps)
  frame.dataset._wid = wid

  function buildPanel() {
    var h = '<div class="cu-panel cu-panel-embedded" id="cuPanel">'
    h += '<div class="cu-header"><span class="cu-title">美化</span><button id="cuClose" class="cu-close-btn">&times;</button></div>'
    h += '<div class="cu-tabs">'
    var tabs = [
      { id: 'wallpaper', label: '壁纸' },
      { id: 'appIcons', label: 'APP' },
      { id: 'font', label: '字体' },
      { id: 'frame', label: '边框' },
      { id: 'style', label: '风格' }
    ]
    for (var ti = 0; ti < tabs.length; ti++) {
      h += '<button class="cu-tab' + (frame.dataset._activeTab === tabs[ti].id ? ' active' : '') + '" data-cu-tab="' + tabs[ti].id + '">' + tabs[ti].label + '</button>'
    }
    h += '</div>'
    h += '<div class="cu-body" id="cuBody">' + renderTabContent(skin, apps, frame.dataset._activeTab) + '</div>'
    h += '<div class="cu-footer"><button class="btn btn-sm btn-primary" id="cuSave">保存</button><button class="btn btn-sm btn-ghost" id="cuCancel">取消</button></div>'
    h += '</div>'
    return h
  }

  frame.innerHTML = buildPanel()
  bindCuEmbedded(frame, wid, skin, apps)
}

function renderTabContent(skin, apps, activeTab) {
  var h = ''
  if (activeTab === 'wallpaper') h = renderWallpaperTab(skin)
  else if (activeTab === 'appIcons') h = renderAppIconsTab(skin, apps)
  else if (activeTab === 'font') h = renderFontTab(skin)
  else if (activeTab === 'frame') h = renderFrameTab(skin)
  else if (activeTab === 'style') h = renderStyleTab(skin)
  return h
}

// Wallpaper tab
function renderWallpaperTab(skin) {
  var colors = [
    { name: '极昼白', color: '#f5f0e8' }, { name: '水色', color: '#d0e8f5' }, { name: '樱粉', color: '#f5e8f0' }, { name: '薄荷', color: '#e8f5f0' },
    { name: '奶油', color: '#faf5ed' }, { name: '薰衣草', color: '#ede8f5' }, { name: '浅灰', color: '#e8e8e8' }, { name: '暗夜', color: '#1a1a2e' }
  ]
  var h = '<div class="cu-section"><div class="cu-section-title">壁纸颜色</div>'
  h += '<div class="cu-color-grid">'
  for (var i = 0; i < colors.length; i++) {
    var c = colors[i]
    h += '<button class="cu-color-btn' + (skin.wallpaper === c.color ? ' active' : '') + '" data-cu-color="' + c.color + '" style="background:' + c.color + '"></button>'
    h += '<span class="cu-color-label">' + c.name + '</span>'
  }
  h += '</div></div>'

  h += '<div class="cu-section"><div class="cu-section-title">自定义背景</div>'
  h += IMGHOST_HINT
  h += '<div class="cu-input-row"><input class="cu-input" id="cuWpUrl" value="' + esc(skin.wallpaperImage || '') + '" placeholder="输入图片URL...">'
  h += '<button class="btn btn-sm btn-outline" data-cu-upload="wallpaper">上传</button></div>'
  if (skin.wallpaperImage) {
    h += '<div class="cu-preview-img"><img src="' + esc(skin.wallpaperImage) + '" alt=""><button class="btn btn-sm btn-ghost" data-cu-clear="wallpaper">清除</button></div>'
  }
  h += '</div>'
  return h
}

// APP tab
function renderAppIconsTab(skin, apps) {
  var h = '<div class="cu-section"><div class="cu-section-title">APP 图标与名称</div>'
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    var safeColor = sanitizeCssColor(app.color, { fallback: 'var(--c-surface2)' })
    var safeIcon = sanitizeIconHtml(app.icon || '?') || '?'
    h += '<div class="cu-app-row">'
    h += '<div class="cu-app-preview" style="background:' + safeColor + ';"><span style="color: var(--c-text)">' + safeIcon + '</span></div>'
    h += '<div class="cu-app-fields">'
    h += '<input class="cu-input cu-input-sm" data-cu-app="icon" data-cu-idx="' + i + '" value="' + escapeHtmlAttribute(safeIcon) + '" placeholder="图标(SVG/文字)">'
    h += '<input class="cu-input cu-input-sm" data-cu-app="name" data-cu-idx="' + i + '" value="' + escapeHtmlAttribute(app.name || '') + '" placeholder="名称">'
    h += '<input class="cu-input cu-input-sm" data-cu-app="color" data-cu-idx="' + i + '" value="' + escapeHtmlAttribute(safeColor) + '" placeholder="底色 #hex">'
    h += '<label class="cu-checkbox"><input type="checkbox" data-cu-app="enabled" data-cu-idx="' + i + '"' + (app.enabled !== false ? ' checked' : '') + '> 显示</label>'
    h += '</div>'
    h += '</div>'
  }
  h += '</div>'
  return h
}

// Font tab
function renderFontTab(skin) {
  var fonts = [
    { name: '默认', family: "'Noto Sans SC', sans-serif" },
    { name: '圆体', family: "'PingFang SC', sans-serif" },
    { name: '宋体', family: "'Noto Serif SC', serif" },
    { name: '楷体', family: "'KaiTi', serif" },
    { name: '仿宋', family: "'FangSong', serif" },
    { name: '英文衬线', family: "'Georgia', serif" }
  ]
  var h = '<div class="cu-section"><div class="cu-section-title">字体</div>'
  h += '<div class="cu-font-grid">'
  for (var i = 0; i < fonts.length; i++) {
    var f = fonts[i]
    h += '<button class="btn btn-sm' + (skin.fontFamily === f.family ? ' btn-primary' : ' btn-outline') + '" data-cu-font="' + esc(f.family) + '">' + f.name + '</button>'
  }
  h += '</div>'
  h += '<div class="cu-section-title" style="margin-top:16px">导入字体</div>'
  h += '<button class="btn btn-sm btn-outline" data-cu-upload="font">选择 TTF/OTF 文件</button>'
  if (skin.fontFamily && skin.fontFamily.indexOf("CustomFont_") === 0) {
    h += '<span style="font-size:.75rem;color:var(--c-primary-hover);margin-left:8px">自定义字体已应用</span>'
  }
  h += '</div>'
  return h
}

// Frame tab
function renderFrameTab(skin) {
  var fColors = [
    { name: '亮银', color: '#ccc' }, { name: '深空灰', color: '#555' }, { name: '玫瑰金', color: '#e8a0b0' },
    { name: '天峰蓝', color: '#4a7a9a' }, { name: '暗夜紫', color: '#6a4a8a' }, { name: '奶油金', color: '#d4af7a' }
  ]
  var h = '<div class="cu-section"><div class="cu-section-title">边框颜色</div>'
  h += '<div class="cu-color-grid">'
  for (var i = 0; i < fColors.length; i++) {
    var fc = fColors[i]
    h += '<button class="cu-color-btn' + (skin.frameColor === fc.color ? ' active' : '') + '" data-cu-fcolor="' + fc.color + '" style="background:' + fc.color + '"></button>'
    h += '<span class="cu-color-label">' + fc.name + '</span>'
  }
  h += '</div>'
  h += '<div class="cu-section-title" style="margin-top:16px">圆角: ' + skin.borderRadius + 'px</div>'
  h += '<input class="cu-range" data-cu-range="borderRadius" type="range" min="8" max="40" value="' + skin.borderRadius + '">'
  h += '</div>'
  return h
}

// Style tab
function renderStyleTab(skin) {
  var h = '<div class="cu-section">'

  h += '<label class="cu-checkbox"><input type="checkbox" data-cu-cb="showDynamicIsland"' + (skin.showDynamicIsland ? ' checked' : '') + '> 显示灵动岛</label>'

  h += '<div class="cu-section-title" style="margin-top:12px">图标列数: ' + (skin.iconColumns || 4) + '</div>'
  h += '<input class="cu-range" data-cu-range="iconColumns" type="range" min="2" max="4" value="' + (skin.iconColumns || 4) + '">'

  h += '<div class="cu-section-title" style="margin-top:12px">图标圆角: ' + (skin.iconBorderRadius || 14) + 'px</div>'
  h += '<input class="cu-range" data-cu-range="iconBorderRadius" type="range" min="4" max="20" value="' + (skin.iconBorderRadius || 14) + '">'

  h += '<label class="cu-checkbox" style="margin-top:8px"><input type="checkbox" data-cu-cb="showAppLabels"' + (skin.showAppLabels !== false ? ' checked' : '') + '> 显示 APP 名称</label>'
  h += '<label class="cu-checkbox"><input type="checkbox" data-cu-cb="showHomeIndicator"' + (skin.showHomeIndicator !== false ? ' checked' : '') + '> 显示 Home 指示条</label>'
  h += '<label class="cu-checkbox"><input type="checkbox" data-cu-cb="showIconShadow"' + (skin.showIconShadow !== false ? ' checked' : '') + '> 图标阴影</label>'

  h += '</div>'
  return h
}

function bindCuEmbedded(desktop, wid, skin, apps) {
  var panel = desktop.querySelector('#cuPanel')
  if (!panel) return

  function getAt() { return desktop.dataset._activeTab || 'wallpaper' }
  function setAt(v) { desktop.dataset._activeTab = v }
  function reloadPanel() {
    skin = JSON.parse(desktop.dataset._skin)
    apps = JSON.parse(desktop.dataset._apps)
    var body = panel.querySelector('#cuBody')
    if (body) body.innerHTML = renderTabContent(skin, apps, getAt())
    bindCuEmbedded(desktop, wid, skin, apps)
  }

  // Tab switching
  var tabBtns = panel.querySelectorAll('[data-cu-tab]')
  for (var ti = 0; ti < tabBtns.length; ti++) {
    tabBtns[ti].onclick = function() {
      setAt(this.dataset.cuTab)
      reloadPanel()
      var allTabs = panel.querySelectorAll('.cu-tab')
      for (var at = 0; at < allTabs.length; at++) allTabs[at].classList.remove('active')
      this.classList.add('active')
    }
  }

  // Close / Cancel
  var closeBtn = panel.querySelector('#cuClose')
  var cancelBtn = panel.querySelector('#cuCancel')
  var restore = function() {
    if (document.activeElement) document.activeElement.blur()
    desktop.style.pointerEvents = 'none'
    desktop.style.display = 'none'
    desktop.innerHTML = desktop.dataset._origHTML || ''
    desktop.style.overflow = ''
    desktop.style.padding = ''
    delete desktop.dataset._origHTML
    if (document.activeElement) document.activeElement.blur()
    void desktop.offsetHeight
    desktop.style.display = ''
    requestAnimationFrame(function() {
      desktop.style.pointerEvents = ''
      attachDrag(wid)
    })
  }
  if (closeBtn) closeBtn.onclick = restore
  if (cancelBtn) cancelBtn.onclick = restore

  // Save button
  var saveBtn = panel.querySelector('#cuSave')
  if (saveBtn) {
    saveBtn.onclick = function() {
      var w = getWork(wid)
      if (!w) return
      collectSkinData(skin, apps, panel)
      w.phoneData.skin = JSON.parse(JSON.stringify(skin))
      w.phoneData.apps = apps.slice()
      updateWork(wid, { phoneData: w.phoneData })
      showToast('美化设置已保存')
      restore()
    }
  }

  // Color buttons (wallpaper)
  var colorBtns = panel.querySelectorAll('[data-cu-color]')
  for (var ci = 0; ci < colorBtns.length; ci++) {
    colorBtns[ci].onclick = function() {
      skin.wallpaper = this.dataset.cuColor
      skin.wallpaperType = 'color'
      skin.wallpaperImage = null
      desktop.dataset._skin = JSON.stringify(skin)
      this.parentElement.querySelectorAll('.cu-color-btn').forEach(function(b) { b.classList.remove('active') })
      this.classList.add('active')
    }
  }

  // Frame color
  var fBs = panel.querySelectorAll('[data-cu-fcolor]')
  for (var fi = 0; fi < fBs.length; fi++) {
    fBs[fi].onclick = function() {
      skin.frameColor = this.dataset.cuFcolor
      desktop.dataset._skin = JSON.stringify(skin)
      this.parentElement.querySelectorAll('.cu-color-btn').forEach(function(b) { b.classList.remove('active') })
      this.classList.add('active')
    }
  }

  // Font
  var fontBtns = panel.querySelectorAll('[data-cu-font]')
  for (var ffi = 0; ffi < fontBtns.length; ffi++) {
    fontBtns[ffi].onclick = function() {
      skin.fontFamily = this.dataset.cuFont
      desktop.dataset._skin = JSON.stringify(skin)
      this.parentElement.querySelectorAll('.btn').forEach(function(b) { b.classList.remove('btn-primary'); b.classList.add('btn-outline') })
      this.classList.remove('btn-outline'); this.classList.add('btn-primary')
    }
  }

  // Checkbox
  var cbs = panel.querySelectorAll('[data-cu-cb]')
  for (var cbi = 0; cbi < cbs.length; cbi++) {
    cbs[cbi].onchange = function() {
      skin[this.dataset.cuCb] = this.checked
      desktop.dataset._skin = JSON.stringify(skin)
    }
  }

  // Range
  var ranges = panel.querySelectorAll('[data-cu-range]')
  for (var ri = 0; ri < ranges.length; ri++) {
    ranges[ri].oninput = function() {
      skin[this.dataset.cuRange] = parseInt(this.value)
      desktop.dataset._skin = JSON.stringify(skin)
    }
  }

  // Upload buttons
  var uploads = panel.querySelectorAll('[data-cu-upload]')
  for (var ui = 0; ui < uploads.length; ui++) {
    uploads[ui].onclick = function() {
      var target = this.dataset.cuUpload
      if (target === 'font') {
        var input = document.createElement('input')
        input.type = 'file'; input.accept = '.ttf,.otf,.woff,.woff2'
        input.onchange = function() {
          var file = input.files && input.files[0]
          if (!file) return
          var reader = new FileReader()
          reader.onload = function() {
            var fontName = 'CustomFont_' + Date.now()
            var styleEl = document.createElement('style')
            styleEl.textContent = '@font-face{font-family:"' + fontName + '";src:url(' + reader.result + ') format("truetype");}'
            document.head.appendChild(styleEl)
            skin.fontFamily = '"' + fontName + '", sans-serif'
            desktop.dataset._skin = JSON.stringify(skin)
            reloadPanel()
          }
          reader.readAsDataURL(file)
        }
        input.click()
        return
      }
      var input2 = document.createElement('input')
      input2.type = 'file'; input2.accept = 'image/*'
      input2.onchange = function() {
        var file = input2.files && input2.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function() {
          if (target === 'wallpaper') { skin.wallpaperImage = reader.result; skin.wallpaperType = 'image' }
          else if (target === 'avatar') skin.readerAvatar = reader.result
          else if (target === 'topBg') skin.topBgImage = reader.result
          desktop.dataset._skin = JSON.stringify(skin)
          reloadPanel()
        }
        reader.readAsDataURL(file)
      }
      input2.click()
    }
  }

  // Clear buttons
  var clears = panel.querySelectorAll('[data-cu-clear]')
  for (var cli = 0; cli < clears.length; cli++) {
    clears[cli].onclick = function() {
      var target = this.dataset.cuClear
      if (target === 'wallpaper') { skin.wallpaperImage = null; skin.wallpaperType = 'color' }
      else if (target === 'avatar') skin.readerAvatar = null
      else if (target === 'topBg') skin.topBgImage = null
      desktop.dataset._skin = JSON.stringify(skin)
      reloadPanel()
    }
  }
}

function collectSkinData(skin, apps, ov) {
  // readerId
  var rid = ov.querySelector('#cuReaderId')
  if (rid) skin.readerId = rid.value.trim() || '读者'

  // wallpaper URL
  var wpu = ov.querySelector('#cuWpUrl')
  if (wpu && wpu.value.trim()) {
    skin.wallpaperImage = wpu.value.trim()
    skin.wallpaperType = 'image'
  }

  // avatar URL
  var avu = ov.querySelector('#cuAvatarUrl')
  if (avu && avu.value.trim()) skin.readerAvatar = avu.value.trim()

  // topBg URL
  var tbu = ov.querySelector('#cuTopBgUrl')
  if (tbu) skin.topBgImage = tbu.value.trim() || null

  // App data
  var appIcons = ov.querySelectorAll('[data-cu-app="icon"]')
  var appNames = ov.querySelectorAll('[data-cu-app="name"]')
  var appColors = ov.querySelectorAll('[data-cu-app="color"]')
  var appEnabled = ov.querySelectorAll('[data-cu-app="enabled"]')
  for (var ai = 0; ai < appIcons.length; ai++) {
    if (ai < apps.length) {
      apps[ai].icon = appIcons[ai].value || apps[ai].icon
      apps[ai].name = appNames[ai].value || apps[ai].name
      apps[ai].color = appColors[ai].value || apps[ai].color
    }
  }
  for (var ae = 0; ae < appEnabled.length; ae++) {
    if (ae < apps.length) apps[ae].enabled = appEnabled[ae].checked
  }
}

// ===== Profile Panel =====
function openProfilePanel(wid) {
  var w = getWork(wid)
  if (!w || !w.phoneData) return
  var pd = w.phoneData
  if (!pd.skin) pd.skin = JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN))
  var skin = JSON.parse(JSON.stringify(pd.skin))
  var frame = document.getElementById('phoneFrame')
  if (!frame) return
  var origHTML = frame.innerHTML
  frame.dataset._origHTML = origHTML
  frame.dataset._pfSkin = JSON.stringify(skin)
  frame.dataset._wid = wid

  var h = '<div class="cu-panel pf-panel cu-panel-embedded" id="pfPanel">'
  h += '<div class="cu-header"><span class="cu-title">个人主页</span><button id="pfClose" class="cu-close-btn">&times;</button></div>'
  h += '<div class="cu-body">' + renderPfInfo(skin) + '</div>'
  h += '<div class="cu-footer"><button class="btn btn-sm btn-primary" id="pfSave">保存</button><button class="btn btn-sm btn-ghost" id="pfCancel">取消</button></div>'
  h += '</div>'
  frame.innerHTML = h
  bindPfSimple(frame, wid, skin)
}

function renderPfInfo(skin) {
  var h = '<div class="cu-section"><div class="cu-section-title">个人信息</div>'
  h += '<label class="cu-label">读者 ID</label>'
  h += '<input class="cu-input" id="pfReaderId" value="' + esc(skin.readerId || '') + '" placeholder="读者">'
  h += '<label class="cu-label">头像</label>'
  h += IMGHOST_HINT
  h += '<div class="cu-input-row"><input class="cu-input" id="pfAvatarUrl" value="' + esc(skin.readerAvatar || '') + '" placeholder="输入头像URL...">'
  h += '<button class="btn btn-sm btn-outline" data-pf-upload="avatar">上传</button></div>'
  if (skin.readerAvatar) {
    h += '<div class="cu-preview-img"><img src="' + esc(skin.readerAvatar) + '" alt="" style="border-radius:50%"><button class="btn btn-sm btn-ghost" data-pf-clear="avatar">清除</button></div>'
  }
  h += '<label class="cu-label">顶部背景图</label>'
  h += IMGHOST_HINT
  h += '<div class="cu-input-row"><input class="cu-input" id="pfTopBg" value="' + esc(skin.topBgImage || '') + '" placeholder="输入图片URL...">'
  h += '<button class="btn btn-sm btn-outline" data-pf-upload="topBg">上传</button></div>'
  if (skin.topBgImage) {
    h += '<div class="cu-preview-img"><img src="' + esc(skin.topBgImage) + '" alt=""><button class="btn btn-sm btn-ghost" data-pf-clear="topBg">清除</button></div>'
  }
  h += '</div>'
  return h
}

function renderPfContacts(contacts) {
  var h = '<div class="ct-list">'
  h += '<div class="ct-head">联系人 <span class="ct-count">' + contacts.length + ' 人</span></div>'
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i]
    var color = avatarColor(c.id || uid())
    h += '<div class="ct-card">'
    h += '<div class="ct-row" data-ct-idx="' + i + '">'
    h += '<div class="ct-avatar-wrap">'
    h += '<div class="ct-avatar" style="background:' + color + ';' + (c.avatarUrl ? 'background-image:url(' + esc(c.avatarUrl) + ');background-size:cover' : '') + '" data-ct-avatar data-ct-idx="' + i + '" title="点击上传头像">'
    if (!c.avatarUrl) h += '<span>' + esc((c.name || '?').charAt(0)) + '</span>'
    h += '</div>'
    h += '<div class="ct-avatar-badge" data-ct-avatar data-ct-idx="' + i + '">+</div>'
    h += '</div>'
    h += '<input class="ct-name" data-ct-name data-ct-idx="' + i + '" value="' + esc(c.name || '') + '" placeholder="联系人姓名">'
    h += '<button class="ct-del" data-ct-del data-ct-idx="' + i + '" title="删除">\u2715</button>'
    h += '</div>'
    // Name card: row1 alias+note, row2 msgId+forumId
    h += '<div class="ct-sub-row">'
    h += '<span class="ct-sub-label">别名</span>'
    h += '<input class="ct-sub-input" data-ct-alias data-ct-idx="' + i + '" value="' + esc(c.alias || '') + '" placeholder="昵称">'
    h += '<span class="ct-sub-label" style="margin-left:4px">备注</span>'
    h += '<input class="ct-sub-input" data-ct-note data-ct-idx="' + i + '" value="' + esc(c.note || '') + '" placeholder="说明">'
    h += '</div>'
    h += '<div class="ct-sub-row">'
    h += '<span class="ct-sub-label">消息ID</span>'
    h += '<input class="ct-sub-input" data-ct-msgid data-ct-idx="' + i + '" value="' + esc(c.msgId || '') + '" placeholder="消息ID">'
    h += '<span class="ct-sub-label" style="margin-left:4px">论坛ID</span>'
    h += '<input class="ct-sub-input" data-ct-forum data-ct-idx="' + i + '" value="' + esc(c.forumId || '') + '" placeholder="论坛ID">'
    h += '</div>'
    h += '<div class="ct-sub-row">'
    h += '<span class="ct-sub-label">固定脸URL</span>'
    h += '<input class="ct-sub-input" data-ct-face data-ct-idx="' + i + '" value="' + esc(c.faceUrl || '') + '" placeholder="图片链接">'
    h += '</div>'
    h += '</div>'
  }
  h += '</div>'
  return h
}

function bindPfSimple(desktop, wid, skin) {
  var panel = desktop.querySelector('#pfPanel')
  if (!panel) return

  var closeBtn = panel.querySelector('#pfClose')
  var cancelBtn = panel.querySelector('#pfCancel')
  var restore = function() {
    if (document.activeElement) document.activeElement.blur()
    desktop.style.pointerEvents = 'none'
    desktop.innerHTML = desktop.dataset._origHTML || ''
    delete desktop.dataset._origHTML
    desktop.style.transform = 'translateZ(0)'
    void desktop.offsetHeight
    requestAnimationFrame(function() {
      desktop.style.transform = ''
      desktop.style.pointerEvents = ''
      if (document.activeElement) document.activeElement.blur()
      attachDrag(wid)
    })
  }
  if (closeBtn) closeBtn.onclick = restore
  if (cancelBtn) cancelBtn.onclick = restore

  var saveBtn = panel.querySelector('#pfSave')
  if (saveBtn) {
    saveBtn.onclick = function() {
      var w = getWork(wid)
      if (!w) return
      var rid = panel.querySelector('#pfReaderId')
      if (rid) skin.readerId = rid.value.trim() || '读者'
      var avu = panel.querySelector('#pfAvatarUrl')
      if (avu && avu.value.trim()) skin.readerAvatar = avu.value.trim()
      var tbu = panel.querySelector('#pfTopBg')
      if (tbu) skin.topBgImage = tbu.value.trim() || null
      w.phoneData.skin = JSON.parse(JSON.stringify(skin))
      updateWork(wid, { phoneData: w.phoneData })
      showToast('已保存')
      restore()
    }
  }

  // Upload
  var uploads = panel.querySelectorAll('[data-pf-upload]')
  for (var ui = 0; ui < uploads.length; ui++) {
    uploads[ui].onclick = function() {
      var target = this.dataset.pfUpload
      var input2 = document.createElement('input')
      input2.type = 'file'; input2.accept = 'image/*'
      input2.onchange = function() {
        var file = input2.files && input2.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function() {
          if (target === 'avatar') skin.readerAvatar = reader.result
          else if (target === 'topBg') skin.topBgImage = reader.result
        }
        reader.readAsDataURL(file)
      }
      input2.click()
    }
  }

  // Clear
  var clears = panel.querySelectorAll('[data-pf-clear]')
  for (var cli = 0; cli < clears.length; cli++) {
    clears[cli].onclick = function() {
      var target = this.dataset.pfClear
      if (target === 'avatar') skin.readerAvatar = null
      else if (target === 'topBg') skin.topBgImage = null
    }
  }
}

// ===== Contacts Panel =====
function openContactsPanel(wid) {
  var w = getWork(wid)
  if (!w || !w.phoneData) return
  var pd = w.phoneData
  var contacts = JSON.parse(JSON.stringify(pd.contacts || []))

  var frame = document.getElementById('phoneFrame')
  if (!frame) return
  var origHTML = frame.innerHTML
  frame.dataset._origHTML = origHTML
  frame.dataset._ctContacts = JSON.stringify(contacts)
  frame.dataset._wid = wid

  var h = '<div class="cu-panel pf-panel cu-panel-embedded" id="ctPanel">'
  h += '<div class="cu-header"><span class="cu-title">联系人</span><button id="ctClose" class="cu-close-btn">&times;</button></div>'
  h += '<div class="cu-body">' + renderPfContacts(contacts) + '</div>'
  h += '<div class="cu-footer"><button class="btn btn-sm btn-outline" id="ctAddBtn" style="margin-right:auto">+ 添加</button><button class="btn btn-sm btn-primary" id="ctSave">保存</button><button class="btn btn-sm btn-ghost" id="ctCancel">取消</button></div>'
  h += '</div>'
  frame.innerHTML = h
  bindCtEvents(frame, wid, contacts)
}

function bindCtEvents(desktop, wid, contacts) {
  var panel = desktop.querySelector('#ctPanel')
  if (!panel) return

  function getCtAt() { return desktop.dataset._ctContacts ? JSON.parse(desktop.dataset._ctContacts) : contacts }
  function setCtAt(v) { desktop.dataset._ctContacts = JSON.stringify(v) }

  function reloadCt() {
    contacts = getCtAt()
    var body = panel.querySelector('.cu-body')
    if (body) body.innerHTML = renderPfContacts(contacts)
    bindCtEvents(desktop, wid, contacts)
  }

  // Collect current edits into contacts
  function collectField(field, key) {
    var els = panel.querySelectorAll('[data-ct-' + field + ']')
    for (var fi = 0; fi < els.length; fi++) {
      var idx = parseInt(els[fi].dataset.ctIdx)
      if (idx >= 0 && idx < contacts.length) {
        contacts[idx][key] = els[fi].value || ''
      }
    }
  }

  function flushNames() {
    collectField('name', 'name')
    collectField('alias', 'alias')
    collectField('note', 'note')
    collectField('msgid', 'msgId')
    collectField('forum', 'forumId')
    collectField('face', 'faceUrl')
  }

  // Close / Cancel
  var closeBtn = panel.querySelector('#ctClose')
  var cancelBtn = panel.querySelector('#ctCancel')
  var restore = function() {
    if (document.activeElement) document.activeElement.blur()
    desktop.style.pointerEvents = 'none'
    desktop.innerHTML = desktop.dataset._origHTML || ''
    delete desktop.dataset._origHTML
    void desktop.offsetHeight
    setTimeout(function() {
      desktop.style.pointerEvents = ''
      attachDrag(wid)
    }, 80)
  }
  if (closeBtn) closeBtn.onclick = restore
  if (cancelBtn) cancelBtn.onclick = restore

  // Save
  var saveBtn = panel.querySelector('#ctSave')
  if (saveBtn) {
    saveBtn.onclick = function() {
      flushNames()
      var w = getWork(wid)
      if (!w) return
      w.phoneData.contacts = contacts.slice()
      updateWork(wid, { phoneData: w.phoneData })
      showToast('联系人已保存')
      restore()
    }
  }

  // Delete contact (hover-based, already visible via CSS)
  var delBtns = panel.querySelectorAll('[data-ct-del]')
  for (var di = 0; di < delBtns.length; di++) {
    delBtns[di].onclick = function() {
      var idx = parseInt(this.dataset.ctIdx)
      if (idx >= 0 && idx < contacts.length) {
        contacts.splice(idx, 1)
        setCtAt(contacts)
        reloadCt()
      }
    }
  }

  // Avatar URL editor (click avatar to set URL)
  var avatars = panel.querySelectorAll('[data-ct-avatar]')
  for (var ai = 0; ai < avatars.length; ai++) {
    avatars[ai].onclick = function() {
      var idx = parseInt(this.dataset.ctIdx)
      if (idx < 0 || idx >= contacts.length) return
      var ov = modal('设置头像', '<div class="form-group"><label class="form-label">图片链接</label><input id="ctAvatarUrlInput" class="form-input" placeholder="输入头像图片URL" value="' + esc(contacts[idx].avatarUrl || '') + '" autofocus></div>' + IMGHOST_HINT, '<button id="ctAvatarOk" class="btn btn-primary btn-sm">确定</button><button id="ctAvatarCancel" class="btn btn-ghost btn-sm">取消</button>')
      var okBtn = ov.querySelector('#ctAvatarOk')
      var cancelBtn2 = ov.querySelector('#ctAvatarCancel')
      var inputEl = ov.querySelector('#ctAvatarUrlInput')
      if (okBtn && inputEl) {
        okBtn.onclick = function() {
          contacts[idx].avatarUrl = inputEl.value.trim()
          setCtAt(contacts)
          reloadCt()
          ov.remove()
        }
        inputEl.onkeydown = function(e) { if (e.key === 'Enter') okBtn.click() }
      }
      if (cancelBtn2) cancelBtn2.onclick = function() { ov.remove() }
      setTimeout(function() { if (inputEl) inputEl.focus() }, 100)
    }
  }

  // Add contact button (in footer) — custom modal, no browser prompt
  var addBtn = document.getElementById('ctAddBtn')
  if (addBtn) {
    addBtn.onclick = function() {
      flushNames()
      var ov = modal('添加联系人', '<div class="form-group"><input id="ctNewNameInput" class="form-input" placeholder="联系人姓名" autofocus></div>', '<button id="ctNewNameOk" class="btn btn-primary btn-sm">确定</button><button id="ctNewNameCancel" class="btn btn-ghost btn-sm">取消</button>')
      var okBtn = ov.querySelector('#ctNewNameOk')
      var cancelBtn2 = ov.querySelector('#ctNewNameCancel')
      var inputEl = ov.querySelector('#ctNewNameInput')
      if (okBtn && inputEl) {
        okBtn.onclick = function() {
          var name = inputEl.value.trim()
          if (!name) return
          contacts.push({ id: uid(), name: name, alias: '', avatarUrl: '', note: '', forumId: '' })
          setCtAt(contacts)
          reloadCt()
          ov.remove()
        }
        inputEl.onkeydown = function(e) { if (e.key === 'Enter') okBtn.click() }
      }
      if (cancelBtn2) cancelBtn2.onclick = function() { ov.remove() }
      setTimeout(function() { if (inputEl) inputEl.focus() }, 100)
    }
  }
}

function refreshPhone(wid) {
  var a = document.getElementById('app')
  if (a) a.innerHTML = renderHeader() + renderPhoneEditor(wid)
}

var CHARACTER_LOCKED_APP_TYPES = new Set(['memo', 'gallery', 'browser', 'shopping'])
var CHARACTER_APP_LABELS = {
  memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物清单'
}

function characterAppItemCount(pd, type, contactId) {
  var collection = []
  if (type === 'memo') collection = pd.memos || []
  else if (type === 'gallery') collection = (pd.photos || []).concat(pd.albums || [])
  else if (type === 'browser') collection = pd.browserHistory || []
  else if (type === 'shopping') collection = pd.shoppingItems || []
  return collection.filter(function(item) { return item.contactId === contactId }).length
}

function openCharacterAccessPanel(wid, type) {
  var w = getWork(wid)
  if (!w || !w.phoneData) return
  var pd = w.phoneData
  var frame = document.getElementById('phoneFrame')
  if (!frame) return

  frame.dataset._origHTML = frame.innerHTML
  frame.dataset._returnAppType = type
  if (type === 'messages') {
    openMessagesEditor(frame, wid, pd)
    return
  }
  if (type === 'forum') {
    openForumEditor(frame, wid, { id: uid(), name: '论坛', avatarUrl: '' }, pd)
    return
  }
  openCharacterAccessEditor(frame, wid, type, pd)
}

function openCharacterAccessEditor(frame, wid, type, pd) {
  var contacts = pd.contacts || []
  var title = CHARACTER_APP_LABELS[type] || '角色内容'
  var savedConnection = pd.appConnections && pd.appConnections[type]
  var savedTarget = savedConnection && savedConnection.contactId
  var selectedContact = contacts.find(function(contact) { return contact.id === savedTarget }) || contacts[0] || null

  var h = '<div class="cu-panel cu-panel-embedded character-access-panel">'
  h += '<div class="cu-header character-access-header">'
  h += '<button type="button" class="cu-close-btn" id="characterAccessBack" aria-label="返回手机桌面">&larr;</button>'
  h += '<span class="cu-title">' + esc(title) + ' · 接入设置</span><span class="character-access-header-spacer" aria-hidden="true"></span></div>'
  h += '<div class="cu-body character-access-body">'
  h += '<div class="character-access-intro"><span>ROLE SOURCE / AUTHOR</span><strong>这次接入谁的手机？</strong><p>读者不会在这里选择角色。你指定后，打开 App 会先确认，再进入对应内容。</p></div>'

  if (!contacts.length) {
    h += '<div class="character-access-empty"><strong>还没有角色联系人</strong><p>先去联系人 App 添加角色，再回来设置剧情接入。</p></div>'
  } else {
    h += '<div class="character-access-list" role="group" aria-label="选择接入角色">'
    contacts.forEach(function(contact) {
      var selected = selectedContact && selectedContact.id === contact.id
      var count = characterAppItemCount(pd, type, contact.id)
      h += '<button type="button" class="character-access-option' + (selected ? ' selected' : '') + '" data-contact-id="' + escapeHtmlAttribute(contact.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">'
      h += '<span class="character-access-avatar">'
      if (contact.avatarUrl) h += '<img src="' + escapeHtmlAttribute(contact.avatarUrl) + '" alt="">'
      else h += '<span>' + esc((contact.name || '?').charAt(0)) + '</span>'
      h += '</span><span class="character-access-copy"><strong>' + esc(contact.name || '未命名') + '</strong><small>' + count + ' 条内容 · ' + (selected ? '当前接入对象' : '可设为接入对象') + '</small></span><span class="character-access-check" aria-hidden="true">' + (selected ? '✓' : '→') + '</span></button>'
    })
    h += '</div>'
    h += '<label class="character-access-prompt" for="characterAccessPrompt"><span>接入前剧情提示</span><textarea id="characterAccessPrompt" maxlength="160" placeholder="例如：这段信号似乎来自刚才在车站遇见的人。">' + esc(savedConnection && savedConnection.prompt || '') + '</textarea><small>读者确认前会先看到这句话。</small></label>'
    h += '<div class="character-access-actions"><button type="button" id="characterAccessCancel">暂时不设置</button><button type="button" id="characterAccessContinue">保存并编辑内容</button></div>'
  }
  h += '</div></div>'
  frame.innerHTML = h

  function closePanel() { exitPhoneAppEditor(frame, wid) }
  var back = frame.querySelector('#characterAccessBack')
  if (back) back.onclick = closePanel
  var cancel = frame.querySelector('#characterAccessCancel')
  if (cancel) cancel.onclick = closePanel

  var options = frame.querySelectorAll('.character-access-option')
  options.forEach(function(option) {
    option.onclick = function() {
      var id = option.dataset.contactId
      var contact = contacts.find(function(candidate) { return candidate.id === id })
      if (!contact) return
      selectedContact = contact
      options.forEach(function(item) {
        var isSelected = item === option
        item.classList.toggle('selected', isSelected)
        item.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
        var status = item.querySelector('.character-access-copy small')
        var check = item.querySelector('.character-access-check')
        var count = characterAppItemCount(pd, type, item.dataset.contactId)
        if (status) status.textContent = count + ' 条内容 · ' + (isSelected ? '当前接入对象' : '可设为接入对象')
        if (check) check.textContent = isSelected ? '✓' : '→'
      })
    }
  })

  var continueButton = frame.querySelector('#characterAccessContinue')
  if (continueButton) continueButton.onclick = function() {
    if (!selectedContact) return
    var prompt = frame.querySelector('#characterAccessPrompt')
    pd.appConnections = pd.appConnections && typeof pd.appConnections === 'object' ? pd.appConnections : {}
    pd.appConnections[type] = {
      contactId: selectedContact.id,
      prompt: prompt ? prompt.value.trim() : ''
    }
    updateWork(wid, { phoneData: pd })
    openCharacterAppEditor(frame, wid, type, selectedContact)
  }

  if (typeof frame._requestPhoneAppModalClose !== 'function') {
    var initialFocus = frame.querySelector('.character-access-option[aria-pressed="true"]') || back
    if (initialFocus && typeof initialFocus.focus === 'function') initialFocus.focus()
  }
}

function openCharacterAppEditor(frame, wid, type, contact) {
  var w = getWork(wid)
  if (!w || !w.phoneData || !contact || !CHARACTER_LOCKED_APP_TYPES.has(type)) return
  var pd = w.phoneData

  if (type === 'memo') {
    var memos = (pd.memos || []).filter(function(item) { return item.contactId === contact.id })
    openMemoEditor(frame, wid, contact, memos, pd)
    return
  }
  if (type === 'gallery') {
    openGalleryEditor(frame, wid, contact, pd)
    return
  }
  if (type === 'browser') {
    var history = (pd.browserHistory || []).filter(function(item) { return item.contactId === contact.id })
    openBrowserEditor(frame, wid, contact, history, pd)
    return
  }
  if (type === 'shopping') {
    openShoppingEditor(frame, wid, contact, pd)
  }
}
/// ===== BROWSER EDITOR (search history style) =====
function openBrowserEditor(frame, wid, contact, items, pd) {
  var accent = avatarColor(contact.id || uid())

  function saveAll() {
    var rows = frame.querySelectorAll('.browser-row')
    var updated = []
    rows.forEach(function(row) {
      var id = row.dataset.browserId
      var titleEl = row.querySelector('.browser-title')
      var urlEl = row.querySelector('.browser-url')
      var existing = items.find(function(it) { return it.id === id })
      if (existing && titleEl) {
        existing.title = titleEl.value
        existing.url = urlEl ? urlEl.value : ''
        existing.time = new Date().toLocaleString()
        updated.push(existing)
      }
    })
    pd.browserHistory = pd.browserHistory || []
    updated.forEach(function(u) {
      var idx = pd.browserHistory.findIndex(function(it) { return it.id === u.id })
      if (idx >= 0) pd.browserHistory[idx] = u
    })
    updateWork(wid, { phoneData: pd })
  }

  function addNewHistory() {
    var now = new Date().toLocaleString()
    var h = { id: uid(), contactId: contact.id, title: '新搜索', url: '', time: now }
    items.push(h)
    pd.browserHistory = pd.browserHistory || []
    pd.browserHistory.push(h)
    updateWork(wid, { phoneData: pd })
    renderHistory(items)
  }

  function deleteHistory(histId) {
    items = items.filter(function(it) { return it.id !== histId })
    pd.browserHistory = (pd.browserHistory || []).filter(function(it) { return it.id !== histId })
    updateWork(wid, { phoneData: pd })
    renderHistory(items)
  }

  function renderHistory(currentItems) {
    items = currentItems
    var body = frame.querySelector('#browserBody')
    if (!body) return

    var h = ''
    if (items.length === 0) {
      h = '<div class="pf-empty">暂无浏览记录</div>'
    }

    // Sort by most recent first
    var sorted = items.slice().sort(function(a, b) {
      return (b.time || '').localeCompare(a.time || '')
    })

    for (var i = 0; i < sorted.length; i++) {
      var it = sorted[i]
      var timeStr = (it.time || '').replace(/^(\d+\/\d+\/\d+)\s.*$/, '$1')
      h += '<div class="browser-row" data-browser-id="' + it.id + '">'
      h += '<div class="browser-dot" style="background:' + accent + '"></div>'
      h += '<div class="browser-info">'
      h += '<input class="browser-title" value="' + esc(it.title || '') + '" placeholder="搜索关键词">'
      h += '<input class="browser-url" value="' + esc(it.url || '') + '" placeholder="https://...">'
      h += '</div>'
      h += '<div class="browser-right">'
      h += '<span class="browser-time">' + esc(timeStr) + '</span>'
      h += '<button class="browser-del" data-browser-del="' + it.id + '" title="删除">x</button>'
      h += '</div>'
      h += '</div>'
    }
    body.innerHTML = h

    // Bind title/url blur to save
    var titleInputs = body.querySelectorAll('.browser-title')
    var urlInputs = body.querySelectorAll('.browser-url')
    titleInputs.forEach(function(inp) { inp.addEventListener('blur', function() { saveAll() }) })
    urlInputs.forEach(function(inp) { inp.addEventListener('blur', function() { saveAll() }) })

    // Bind delete buttons
    var delBtns = body.querySelectorAll('[data-browser-del]')
    delBtns.forEach(function(btn) {
      btn.onclick = function() {
        var id = this.dataset.browserDel
        deleteHistory(id)
      }
    })
  }

  // Build HTML
  var bh = '<div class="cu-panel cu-panel-embedded" id="browserPanel">'
  bh += '<div class="cu-header" style="justify-content:space-between">'
  bh += '<button type="button" class="cu-close-btn" id="browserBack" aria-label="返回">&larr;</button>'
  bh += '<span class="cu-title" style="flex:1;text-align:center">' + esc(contact.name || '?') + ' \u00b7 浏览记录</span>'
  bh += '<button class="cu-close-btn" id="browserAdd" title="添加">+</button></div>'
  bh += '<div class="browser-search-bar">'
  bh += '<div class="browser-search-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>'
  bh += '<span class="browser-search-placeholder">搜索或输入网址</span>'
  bh += '</div>'
  bh += '<div class="cu-body" id="browserBody" style="padding:8px 12px"></div>'
  bh += '</div>'

  frame.innerHTML = bh
  renderHistory(items)

  // Back button
  var backBtn = frame.querySelector('#browserBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid, saveAll) }
  }

  // Add button
  var addBtn = frame.querySelector('#browserAdd')
  if (addBtn) addBtn.onclick = function() { addNewHistory() }
}

/// ===== GALLERY EDITOR (photos + albums) =====
function openGalleryEditor(frame, wid, contact, pd) {
  var accent = avatarColor(contact.id || uid())
  var photos = pd.photos || []
  var albums = pd.albums || []
  var contactPhotos = photos.filter(function(p) { return p.contactId === contact.id })
  var contactAlbums = albums.filter(function(a) { return a.contactId === contact.id })
  var currentAlbumId = null // null = show all (unsorted + albums list)

  function savePhotoData() {
    pd.photos = photos
    pd.albums = albums
    updateWork(wid, { phoneData: pd })
  }

  function addPhoto() {
    var ov = modal('新建照片',
      '<div class="form-group"><label class="form-label">描述（文字模拟图片）</label><input id="gpDesc" class="form-input" placeholder="例如：蓝色天空下的樱花树"></div>' +
      '<div class="form-group"><label class="form-label">图片URL（可选）</label>' + IMGHOST_HINT + '<input id="gpUrl" class="form-input" placeholder="https://..."></div>' +
      '<div class="form-group"><label class="form-label">放入相册（可选）</label><select id="gpAlbum" class="form-select"><option value="">未归类</option>' +
      contactAlbums.map(function(a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>' }).join('') +
      '</select></div>',
      '<button id="gpSave" class="btn btn-primary btn-sm">保存</button><button id="gpCancel" class="btn btn-ghost btn-sm">取消</button>')

    var saveBtn = ov.querySelector('#gpSave')
    var cancelBtn = ov.querySelector('#gpCancel')
    if (saveBtn) saveBtn.onclick = function() {
      var desc = ov.querySelector('#gpDesc').value.trim()
      var url = ov.querySelector('#gpUrl').value.trim()
      var albumId = ov.querySelector('#gpAlbum').value || null
      if (!desc && !url) return
      var p = { id: uid(), contactId: contact.id, albumId: albumId, caption: desc, imageUrl: url || '', description: desc, time: new Date().toLocaleString() }
      photos.push(p)
      savePhotoData()
      contactPhotos = photos.filter(function(p) { return p.contactId === contact.id })
      ov.remove()
      renderGallery()
    }
    if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
  }

  function addAlbum() {
    var ov = modal('新建相册',
      '<div class="form-group"><label class="form-label">相册名称</label><input id="gaName" class="form-input" placeholder="例如：夏日旅行" autofocus></div>',
      '<button id="gaSave" class="btn btn-primary btn-sm">保存</button><button id="gaCancel" class="btn btn-ghost btn-sm">取消</button>')

    var saveBtn = ov.querySelector('#gaSave')
    var cancelBtn = ov.querySelector('#gaCancel')
    if (saveBtn) saveBtn.onclick = function() {
      var name = ov.querySelector('#gaName').value.trim()
      if (!name) return
      var a = { id: uid(), contactId: contact.id, name: name, coverPhotoId: null, time: new Date().toLocaleString() }
      albums.push(a)
      savePhotoData()
      contactAlbums = albums.filter(function(a) { return a.contactId === contact.id })
      ov.remove()
      renderGallery()
    }
    if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
  }

  function deletePhoto(photoId) {
    photos = photos.filter(function(p) { return p.id !== photoId })
    savePhotoData()
    contactPhotos = photos.filter(function(p) { return p.contactId === contact.id })
    renderGallery()
  }

  function deleteAlbum(albumId) {
    // Move photos in this album to unclassified
    photos.forEach(function(p) { if (p.albumId === albumId) p.albumId = null })
    albums = albums.filter(function(a) { return a.id !== albumId })
    savePhotoData()
    contactAlbums = albums.filter(function(a) { return a.contactId === contact.id })
    contactPhotos = photos.filter(function(p) { return p.contactId === contact.id })
    renderGallery()
  }

  function viewAlbum(albumId) {
    currentAlbumId = albumId
    renderGallery()
  }

  function backToMain() {
    currentAlbumId = null
    renderGallery()
  }

  function renderGallery() {
    var body = frame.querySelector('#galleryBody')
    if (!body) return

    var h = ''

    if (currentAlbumId) {
      // Album detail view
      var album = contactAlbums.find(function(a) { return a.id === currentAlbumId })
      var albumPhotos = contactPhotos.filter(function(p) { return p.albumId === currentAlbumId })

      h += '<div class="gallery-bar">'
      h += '<button class="btn btn-sm btn-ghost" id="gaBackBtn">返回</button>'
      h += '<span class="gallery-bar-title">' + esc(album ? album.name : '相册') + ' (' + albumPhotos.length + ')</span>'
      h += '<button class="btn btn-sm btn-ghost" id="gaDelAlbum" style="color:var(--c-accent3)">删除相册</button>'
      h += '</div>'

      h += '<div class="gallery-grid">'
      if (albumPhotos.length === 0) {
        h += '<div class="pf-empty" style="grid-column:1/-1">暂无照片</div>'
      }
      for (var pi = 0; pi < albumPhotos.length; pi++) {
        h += renderPhotoCard(albumPhotos[pi])
      }
      h += '</div>'
    } else {
      // Main view: actions + albums + unsorted photos
      h += '<div class="gallery-bar">'
      h += '<button class="btn btn-sm btn-outline" id="gaAddPhoto">新建照片</button>'
      h += '<button class="btn btn-sm btn-outline" id="gaAddAlbum">新建相册</button>'
      h += '</div>'

      // Albums section
      if (contactAlbums.length > 0) {
        h += '<div class="gallery-albums">'
        for (var ai = 0; ai < contactAlbums.length; ai++) {
          var a = contactAlbums[ai]
          var count = contactPhotos.filter(function(p) { return p.albumId === a.id }).length
          // Find cover photo
          var cover = contactPhotos.find(function(p) { return p.albumId === a.id && p.imageUrl })
          h += '<div class="gallery-album-card" data-album-id="' + a.id + '">'
          if (cover) {
            h += '<div class="gallery-album-cover" style="background-image:url(' + esc(cover.imageUrl) + ');background-size:cover;background-position:center"></div>'
          } else {
            h += '<div class="gallery-album-cover" style="background:' + accent + ';opacity:.6"></div>'
          }
          h += '<div class="gallery-album-name">' + esc(a.name) + '</div>'
          h += '<div class="gallery-album-count">' + count + ' 张</div>'
          h += '</div>'
        }
        h += '</div>'
      }

      // Unsorted photos
      var unsorted = contactPhotos.filter(function(p) { return !p.albumId })
      if (unsorted.length > 0 || contactPhotos.length === 0) {
        if (contactAlbums.length > 0) {
          h += '<div class="gallery-section-label">未归类</div>'
        }
        h += '<div class="gallery-grid">'
        if (unsorted.length === 0 && contactAlbums.length === 0) {
          h += '<div class="pf-empty" style="grid-column:1/-1">暂无照片</div>'
        }
        for (var ui = 0; ui < unsorted.length; ui++) {
          h += renderPhotoCard(unsorted[ui])
        }
        h += '</div>'
      }
    }

    body.innerHTML = h
    bindGalleryEvents()
  }

  function renderPhotoCard(p) {
    var h = '<div class="gallery-photo-card" data-photo-id="' + p.id + '">'
    if (p.imageUrl) {
      h += '<div class="gallery-photo-img" style="background-image:url(' + esc(p.imageUrl) + ');background-size:cover;background-position:center"></div>'
    } else {
      h += '<div class="gallery-photo-placeholder">'
      h += '<div class="gallery-photo-text">' + esc(p.caption || p.description || '') + '</div>'
      h += '</div>'
    }
    h += '<div class="gallery-photo-cap">' + esc(p.caption || '') + '</div>'
    h += '<button class="gallery-photo-del" data-photo-del="' + p.id + '">x</button>'
    h += '</div>'
    return h
  }

  function bindGalleryEvents() {
    // Add photo button
    var addPhotoBtn = frame.querySelector('#gaAddPhoto')
    if (addPhotoBtn) addPhotoBtn.onclick = function() { addPhoto() }

    // Add album button
    var addAlbumBtn = frame.querySelector('#gaAddAlbum')
    if (addAlbumBtn) addAlbumBtn.onclick = function() { addAlbum() }

    // Back button (in album view)
    var backBtn = frame.querySelector('#gaBackBtn')
    if (backBtn) backBtn.onclick = function() { backToMain() }

    // Delete album button
    var delAlbumBtn = frame.querySelector('#gaDelAlbum')
    if (delAlbumBtn) delAlbumBtn.onclick = function() { deleteAlbum(currentAlbumId) }

    // Album cards
    var albumCards = frame.querySelectorAll('.gallery-album-card')
    albumCards.forEach(function(card) {
      card.onclick = function() { viewAlbum(card.dataset.albumId) }
    })

    // Delete photo buttons
    var delBtns = frame.querySelectorAll('[data-photo-del]')
    delBtns.forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation()
        deletePhoto(btn.dataset.photoDel)
      }
    })
  }

  // Build HTML
  var gh = '<div class="cu-panel cu-panel-embedded" id="galleryPanel">'
  gh += '<div class="cu-header" style="justify-content:space-between">'
  gh += '<button type="button" class="cu-close-btn" id="galleryBack" aria-label="返回">&larr;</button>'
  gh += '<span class="cu-title" style="flex:1;text-align:center">' + esc(contact.name || '?') + ' \u00b7 相册</span>'
  gh += '<div style="width:32px"></div></div>'
  gh += '<div class="cu-body" id="galleryBody" style="padding:8px 12px"></div>'
  gh += '</div>'

  frame.innerHTML = gh
  renderGallery()

  // Back button
  var backBtn = frame.querySelector('#galleryBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid) }
  }
}

/// ===== SHOPPING EDITOR (cart + orders) =====
function openShoppingEditor(frame, wid, contact, pd) {
  var items = pd.shoppingItems || []
  var activeTab = 'cart'

  function saveData() {
    pd.shoppingItems = items
    updateWork(wid, { phoneData: pd })
  }

  function addItem() {
    var ov = modal('添加商品',
      '<div class="form-group"><label class="form-label">商品名称</label><input id="spName" class="form-input" placeholder="商品名"></div>' +
      '<div class="form-group"><label class="form-label">价格</label><input id="spPrice" class="form-input" type="number" step="0.01" placeholder="0.00"></div>' +
      '<div class="form-group"><label class="form-label">款式</label><input id="spStyle" class="form-input" placeholder="例如：白色 / L码"></div>' +
      '<div class="form-group"><label class="form-label">店铺</label><input id="spShop" class="form-input" placeholder="店铺名"></div>' +
      '<div class="form-group"><label class="form-label">图片URL（可选）</label>' + IMGHOST_HINT + '<input id="spImg" class="form-input" placeholder="https://..."></div>',
      '<button id="spSave" class="btn btn-primary btn-sm">保存</button><button id="spCancel" class="btn btn-ghost btn-sm">取消</button>')

    var saveBtn = ov.querySelector('#spSave')
    var cancelBtn = ov.querySelector('#spCancel')
    if (saveBtn) saveBtn.onclick = function() {
      var name = ov.querySelector('#spName').value.trim()
      var price = parseFloat(ov.querySelector('#spPrice').value) || 0
      if (!name) return
      items.push({
        id: uid(), contactId: contact.id, name: name,
        price: Math.round(price * 100) / 100,
        style: ov.querySelector('#spStyle').value.trim(),
        shop: ov.querySelector('#spShop').value.trim(),
        imageUrl: ov.querySelector('#spImg').value.trim(),
        status: 'cart', checked: false, actualPay: 0, logistics: '',
        time: new Date().toLocaleString()
      })
      saveData()
      ov.remove()
      renderShopping()
    }
    if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
  }

  function toggleCheck(itemId) {
    var it = items.find(function(i) { return i.id === itemId })
    if (it) { it.checked = !it.checked; saveData(); renderShopping() }
  }

  function toggleAll() {
    var cartItems = items.filter(function(i) { return i.contactId === contact.id && i.status === 'cart' })
    var allChecked = cartItems.length > 0 && cartItems.every(function(i) { return i.checked })
    cartItems.forEach(function(i) { i.checked = !allChecked })
    saveData()
    renderShopping()
  }

  function checkout() {
    var checked = items.filter(function(i) { return i.contactId === contact.id && i.status === 'cart' && i.checked })
    if (checked.length === 0) { showToast('请先选择商品', 'info'); return }
    var total = checked.reduce(function(s, i) { return s + i.price }, 0)
    total = Math.round(total * 100) / 100
    checked.forEach(function(i) { i.status = 'order'; i.checked = false; i.actualPay = i.price; i.time = new Date().toLocaleString() })
    saveData()
    renderShopping()
    showToast('已结算 \u00a5' + total.toFixed(2), 'success')
  }

  function returnToCart(itemId) {
    var it = items.find(function(i) { return i.id === itemId })
    if (it) { it.status = 'cart'; it.checked = false; it.actualPay = 0; it.logistics = ''; saveData(); renderShopping() }
  }

  function deleteItem(itemId) {
    items = items.filter(function(i) { return i.id !== itemId })
    saveData()
    renderShopping()
  }

  function editItem(itemId) {
    var it = items.find(function(i) { return i.id === itemId })
    if (!it) return
    var ov = modal('编辑商品',
      '<div class="form-group"><label class="form-label">商品名称</label><input id="spName" class="form-input" value="' + esc(it.name || '') + '" placeholder="商品名"></div>' +
      '<div class="form-group"><label class="form-label">价格</label><input id="spPrice" class="form-input" type="number" step="0.01" value="' + fmtPrice(it.price) + '" placeholder="0.00"></div>' +
      '<div class="form-group"><label class="form-label">款式</label><input id="spStyle" class="form-input" value="' + esc(it.style || '') + '" placeholder="例如：白色 / L码"></div>' +
      '<div class="form-group"><label class="form-label">店铺</label><input id="spShop" class="form-input" value="' + esc(it.shop || '') + '" placeholder="店铺名"></div>' +
      '<div class="form-group"><label class="form-label">图片URL（可选）</label>' + IMGHOST_HINT + '<input id="spImg" class="form-input" value="' + esc(it.imageUrl || '') + '" placeholder="https://..."></div>',
      '<button id="spSave" class="btn btn-primary btn-sm">保存</button><button id="spCancel" class="btn btn-ghost btn-sm">取消</button>')

    var saveBtn = ov.querySelector('#spSave')
    var cancelBtn = ov.querySelector('#spCancel')
    if (saveBtn) saveBtn.onclick = function() {
      var name = ov.querySelector('#spName').value.trim()
      if (!name) return
      it.name = name
      it.price = Math.round((parseFloat(ov.querySelector('#spPrice').value) || 0) * 100) / 100
      it.style = ov.querySelector('#spStyle').value.trim()
      it.shop = ov.querySelector('#spShop').value.trim()
      it.imageUrl = ov.querySelector('#spImg').value.trim()
      saveData()
      ov.remove()
      renderShopping()
    }
    if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
  }

  function duplicateItem(itemId) {
    var it = items.find(function(i) { return i.id === itemId })
    if (!it) return
    var copy = JSON.parse(JSON.stringify(it))
    copy.id = uid()
    copy.status = 'cart'
    copy.checked = false
    copy.actualPay = 0
    copy.logistics = ''
    copy.time = new Date().toLocaleString()
    items.push(copy)
    saveData()
    renderShopping()
    showToast('已复制', 'success')
  }

  function openLogistics(itemId) {
    var it = items.find(function(i) { return i.id === itemId })
    if (!it) return
    var ov = modal('查看物流',
      '<div class="form-group"><label class="form-label">物流信息</label><input id="lgInput" class="form-input" value="' + esc(it.logistics || '') + '" placeholder="例如：已发货 顺丰 SF123456"></div>',
      '<button id="lgSave" class="btn btn-primary btn-sm">保存</button><button id="lgCancel" class="btn btn-ghost btn-sm">取消</button>')

    var saveBtn = ov.querySelector('#lgSave')
    var cancelBtn = ov.querySelector('#lgCancel')
    if (saveBtn) saveBtn.onclick = function() {
      it.logistics = ov.querySelector('#lgInput').value.trim()
      saveData()
      ov.remove()
      renderShopping()
    }
    if (cancelBtn) cancelBtn.onclick = function() { ov.remove() }
  }

  function fmtPrice(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2) }

  function renderShopping() {
    var body = frame.querySelector('#shopBody')
    if (!body) return
    var contactItems = items.filter(function(i) { return i.contactId === contact.id })

    var listH = ''

    if (activeTab === 'cart') {
      var cartItems = contactItems.filter(function(i) { return i.status === 'cart' })

      // Group by shop
      var shops = {}
      cartItems.forEach(function(i) {
        var s = i.shop || '未分类'
        if (!shops[s]) shops[s] = []
        shops[s].push(i)
      })

      var shopNames = Object.keys(shops)
      if (shopNames.length === 0) {
        listH += '<div class="pf-empty">购物车为空</div>'
      }
      for (var si = 0; si < shopNames.length; si++) {
        var shop = shopNames[si]
        var group = shops[shop]
        listH += '<div class="shop-group">'
        listH += '<div class="shop-group-head">' + esc(shop) + ' (' + group.length + ')</div>'
        for (var gi = 0; gi < group.length; gi++) {
          listH += renderShopCard(group[gi], 'cart')
        }
        listH += '</div>'
      }

      // Bottom bar: select all + checkout
      var allChecked = cartItems.length > 0 && cartItems.every(function(i) { return i.checked })
      var total = cartItems.filter(function(i) { return i.checked }).reduce(function(s, i) { return s + i.price }, 0)
      var barH = '<div class="shop-bottom-bar">'
      barH += '<div class="shop-sel-all" id="shopSelAll">'
      barH += '<div class="shop-circle' + (allChecked ? ' checked' : '') + '"></div>'
      barH += '<span>全选</span>'
      barH += '</div>'
      barH += '<div class="shop-checkout" id="shopCheckout">结算 \u00a5' + fmtPrice(total) + '</div>'
      barH += '</div>'

      body.innerHTML = '<div class="shop-list-area">' + listH + '</div>' + barH

    } else {
      // Orders tab
      var orderItems = contactItems.filter(function(i) { return i.status === 'order' })
      if (orderItems.length === 0) {
        listH += '<div class="pf-empty">暂无订单</div>'
      }
      // Sort by time desc
      orderItems.sort(function(a, b) { return (b.time || '').localeCompare(a.time || '') })
      for (var oi = 0; oi < orderItems.length; oi++) {
        listH += renderShopCard(orderItems[oi], 'order')
      }
      body.innerHTML = '<div class="shop-list-area">' + listH + '</div>'
    }

    bindShopEvents()
  }

  function renderShopCard(it, mode) {
    var h = '<div class="shop-card-block" data-item-id="' + it.id + '" data-mode="' + mode + '">'

    // Top row: image + info + (optional circle)
    h += '<div class="shop-card-row">'
    h += '<div class="shop-card-img">'
    if (it.imageUrl) {
      h += '<div style="background-image:url(' + esc(it.imageUrl) + ');background-size:cover;background-position:center;width:100%;height:100%"></div>'
    } else {
      h += '<div class="shop-card-img-placeholder"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>'
    }
    h += '</div>'

    h += '<div class="shop-card-info">'
    h += '<div class="shop-card-name">' + esc(it.name || '商品') + '</div>'
    h += '<div class="shop-card-price">\u00a5' + fmtPrice(it.price) + '</div>'
    if (it.style) h += '<div class="shop-card-meta">款式：' + esc(it.style) + '</div>'
    if (it.shop) h += '<div class="shop-card-meta">店铺：' + esc(it.shop) + '</div>'
    if (mode === 'order') {
      h += '<div class="shop-card-meta" style="margin-top:2px">时间：' + esc(it.time || '') + '</div>'
    }
    h += '</div>'

    // Cart: circle on the right
    if (mode === 'cart') {
      h += '<div class="shop-circle' + (it.checked ? ' checked' : '') + '" data-toggle="' + it.id + '"></div>'
    }

    // Order: badge in top-right of card block
    if (mode === 'order') {
      h += '<div class="shop-badge-success">交易成功</div>'
    }

    h += '</div>' // end shop-card-row

    // Order: foot row & logistics (outside the flex row, stacked below)
    if (mode === 'order') {
      h += '<div class="shop-order-foot">'
      h += '<button class="shop-order-btn" data-more="' + it.id + '">更多</button>'
      h += '<button class="shop-order-btn" data-logistics="' + it.id + '">查看物流</button>'
      h += '<span class="shop-order-paid">实付款 \u00a5' + fmtPrice(it.actualPay || it.price) + '</span>'
      h += '</div>'
      if (it.logistics) {
        h += '<div class="shop-logistics">' + esc(it.logistics) + '</div>'
      }
    }

    h += '</div>' // end shop-card-block
    return h
  }

  function bindShopEvents() {
    // Toggle single item
    var circles = frame.querySelectorAll('[data-toggle]')
    circles.forEach(function(c) { c.onclick = function() { toggleCheck(c.dataset.toggle) } })

    // Select all
    var selAll = frame.querySelector('#shopSelAll')
    if (selAll) selAll.onclick = function() { toggleAll() }

    // Checkout
    var checkoutBtn = frame.querySelector('#shopCheckout')
    if (checkoutBtn) checkoutBtn.onclick = function() { checkout() }

    // Order: more -> return to cart or delete
    var moreBtns = frame.querySelectorAll('[data-more]')
    moreBtns.forEach(function(b) {
      b.onclick = function(e) {
        e.stopPropagation()
        var id = b.dataset.more
        var ov = modal('更多操作', '<div style="padding:4px 0"><button id="spReturn" class="btn btn-sm btn-outline w-full" style="display:block;width:100%">恢复至购物车</button><button id="spDelete" class="btn btn-sm btn-ghost w-full" style="display:block;width:100%;margin-top:6px;color:var(--c-accent3)">删除</button></div>', '')
        ov.querySelector('#spReturn').onclick = function() { ov.remove(); returnToCart(id) }
        ov.querySelector('#spDelete').onclick = function() { ov.remove(); deleteItem(id) }
      }
    })

    // Order: logistics
    var lgBtns = frame.querySelectorAll('[data-logistics]')
    lgBtns.forEach(function(b) {
      b.onclick = function(e) { e.stopPropagation(); openLogistics(b.dataset.logistics) }
    })

    // Right-click context menu on cards (edit / duplicate)
    var cards = frame.querySelectorAll('.shop-card-block')
    cards.forEach(function(card) {
      card.oncontextmenu = function(e) {
        e.preventDefault()
        var id = card.dataset.itemId
        var ov = modal('操作',
          '<div style="padding:4px 0"><button id="spEdit" class="btn btn-sm btn-outline w-full" style="display:block;width:100%">编辑</button><button id="spCopy" class="btn btn-sm btn-outline w-full" style="display:block;width:100%;margin-top:6px">复制</button></div>',
          '')
        ov.querySelector('#spEdit').onclick = function() { ov.remove(); editItem(id) }
        ov.querySelector('#spCopy').onclick = function() { ov.remove(); duplicateItem(id) }
      }
    })
  }

  // Switch tab
  function switchTab(tab) {
    activeTab = tab
    renderShopping()
    var ta = frame.querySelector('#shopTabCart')
    var tb = frame.querySelector('#shopTabOrder')
    if (ta) { ta.classList.toggle('active', tab === 'cart') }
    if (tb) { tb.classList.toggle('active', tab === 'order') }
  }

  // Build HTML
  var sh = '<div class="cu-panel cu-panel-embedded" id="shopPanel">'
  sh += '<div class="cu-header" style="justify-content:space-between">'
  sh += '<button type="button" class="cu-close-btn" id="shopBack" aria-label="返回">&larr;</button>'
  sh += '<span class="cu-title" style="flex:1;text-align:center">' + esc(contact.name || '?') + ' \u00b7 购物</span>'
  sh += '<button class="cu-close-btn" id="shopAdd" title="添加商品">+</button></div>'
  sh += '<div class="shop-tabs" id="shopTabs">'
  sh += '<div class="shop-tab active" id="shopTabCart">购物车</div>'
  sh += '<div class="shop-tab" id="shopTabOrder">我的订单</div>'
  sh += '</div>'
  sh += '<div class="shop-body-inner" id="shopBody"></div>'
  sh += '</div>'

  frame.innerHTML = sh
  renderShopping()

  // Tab switching
  var tabCart = frame.querySelector('#shopTabCart')
  var tabOrder = frame.querySelector('#shopTabOrder')
  if (tabCart) tabCart.onclick = function() { switchTab('cart') }
  if (tabOrder) tabOrder.onclick = function() { switchTab('order') }

  // Add button
  var addBtn = frame.querySelector('#shopAdd')
  if (addBtn) addBtn.onclick = function() { addItem() }

  // Back button
  var backBtn = frame.querySelector('#shopBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid) }
  }
}

/// ===== FORUM EDITOR (posts + comments + npcs) =====
function openForumEditor(frame, wid, contact, pd) {
  var posts = pd.forumPosts || []
  var npcs = pd.forumNpcs || []

  // Initialize default npcs if empty
  if (npcs.length === 0) {
    npcs.push({
      id: uid(), type: 'momo', name: randomMomoName(),
      avatarUrl: MOMO_AVATARS[Math.floor(Math.random() * MOMO_AVATARS.length)] || '',
      time: new Date().toLocaleString()
    })
    npcs.push({
      id: uid(), type: 'userxx', name: randomUserXXName(),
      avatarUrl: USERXX_AVATARS[Math.floor(Math.random() * USERXX_AVATARS.length)] || '',
      time: new Date().toLocaleString()
    })
    pd.forumNpcs = npcs
    updateWork(wid, { phoneData: pd })
  }

  var currentPostId = null
  var viewMode = 'list' // list | detail | npcs

  function saveData() {
    pd.forumPosts = posts
    pd.forumNpcs = npcs
    updateWork(wid, { phoneData: pd })
  }

  function fmtTime(t) { return t ? t.replace(/\s.*$/, '') : '' }

  function getIdInfo(id) {
    // Check contacts first
    var contacts = pd.contacts || []
    var c = contacts.find(function(x) { return x.id === id })
    if (c) {
      var contactIdentity = resolveContactIdentity(pd, id, { surface: 'forum', authoredName: c.name })
      return { name: contactIdentity.name, avatar: contactIdentity.avatar, isContact: true }
    }

    // Check npcs
    var n = npcs.find(function(x) { return x.id === id })
    if (n) return { name: n.name, avatar: n.avatarUrl || '', isNpc: true, npcType: n.type }

    return { name: '未知用户', avatar: '', isUnknown: true }
  }

  function selectIdentity(callback, searchVal) {
    var contacts = pd.contacts || []
    var h = '<div class="form-group"><label class="form-label">搜索</label><input id="idSearch" class="form-input" placeholder="输入名称搜索..." value="' + esc(searchVal || '') + '"></div>'
    h += '<div class="forum-id-list" id="idList" style="max-height:200px;overflow-y:auto">'
    h += renderIdOptions(contacts, npcs, searchVal || '')
    h += '</div>'

    var ov = modal('选择身份', h, '<button id="idOk" class="btn btn-primary btn-sm">确定</button><button id="idCancel" class="btn btn-ghost btn-sm">取消</button>')

    var search = ov.querySelector('#idSearch')
    var list = ov.querySelector('#idList')

    function refreshList() {
      var v = search ? search.value.trim() : ''
      list.innerHTML = renderIdOptions(contacts, npcs, v)
      // Re-bind radio clicks
      var radios = list.querySelectorAll('[name="forumId"]')
      radios.forEach(function(r) {
        r.onchange = function() {
          list.querySelectorAll('[name="forumId"]').forEach(function(x) { x.checked = false })
          r.checked = true
        }
      })
    }

    if (search) search.oninput = refreshList

    ov.querySelector('#idCancel').onclick = function() { ov.remove() }
    ov.querySelector('#idOk').onclick = function() {
      var sel = list.querySelector('[name="forumId"]:checked')
      if (!sel) { ov.remove(); return }
      var parts = sel.value.split('|')
      callback({ id: parts[0], name: parts[1], avatar: parts[2] || '' })
      ov.remove()
    }

    setTimeout(function() { if (search) search.focus() }, 100)
  }

  function renderIdOptions(contacts, npcs, filter) {
    var h = ''
    var f = (filter || '').toLowerCase()
    // Contacts section
    var filteredContacts = contacts.filter(function(c) {
      var displayName = contactDisplayName(c, 'forum')
      return !f || c.name.toLowerCase().indexOf(f) >= 0 || displayName.toLowerCase().indexOf(f) >= 0
    })
    if (filteredContacts.length > 0) {
      h += '<div class="forum-id-section">联系人</div>'
      filteredContacts.forEach(function(c, i) {
        var displayName = contactDisplayName(c, 'forum')
        h += '<label class="forum-id-opt">'
        h += '<input type="radio" name="forumId" value="' + c.id + '|' + esc(displayName) + '|' + esc(c.avatarUrl || '') + '"' + (i === 0 && !filter ? ' checked' : '') + '>'
        h += '<span>' + esc(displayName) + (displayName !== c.name ? ' <small>' + esc(c.name) + '</small>' : '') + '</span>'
        h += '</label>'
      })
    }
    // NPCs section
    var filteredNpcs = npcs.filter(function(n) { return !f || n.name.toLowerCase().indexOf(f) >= 0 })
    if (filteredNpcs.length > 0) {
      h += '<div class="forum-id-section">NPC</div>'
      filteredNpcs.forEach(function(n, i) {
        h += '<label class="forum-id-opt">'
        var isFirst = !filter && filteredContacts.length === 0 && i === 0
        h += '<input type="radio" name="forumId" value="' + n.id + '|' + esc(n.name) + '|' + esc(n.avatarUrl || '') + '"' + (isFirst ? ' checked' : '') + '>'
        h += '<span>' + esc(n.name) + '</span>'
        h += '</label>'
      })
    }
    return h
  }

  // NPC management
  function addNpc() {
    var ov = modal('新建NPC',
      '<div class="form-group"><label class="form-label">类型</label><select id="npType" class="form-select"><option value="npc">普通NPC</option><option value="momo">momo</option><option value="userxx">用户xxxxx</option></select></div>' +
      '<div class="form-group"><label class="form-label">名称</label><input id="npName" class="form-input" placeholder="名称"></div>' +
      '<div class="form-group"><label class="form-label">头像URL（可选）</label>' + IMGHOST_HINT.replace('推荐图床', '') + '<input id="npAvatar" class="form-input" placeholder="https://..."></div>',
      '<button id="npSave" class="btn btn-primary btn-sm">保存</button><button id="npCancel" class="btn btn-ghost btn-sm">取消</button>')

    var typeSel = ov.querySelector('#npType')
    var nameEl = ov.querySelector('#npName')
    var avatarEl = ov.querySelector('#npAvatar')

    function presetForType() {
      var t = typeSel.value
      if (t === 'momo') {
        nameEl.value = randomMomoName()
        avatarEl.value = MOMO_AVATARS[Math.floor(Math.random() * MOMO_AVATARS.length)]
      } else if (t === 'userxx') {
        nameEl.value = randomUserXXName()
        avatarEl.value = USERXX_AVATARS[Math.floor(Math.random() * USERXX_AVATARS.length)]
      } else {
        nameEl.value = ''
        avatarEl.value = ''
      }
    }
    typeSel.onchange = presetForType

    ov.querySelector('#npSave').onclick = function() {
      var name = nameEl.value.trim()
      if (!name) return
      npcs.push({
        id: uid(), type: typeSel.value, name: name,
        avatarUrl: avatarEl.value.trim(),
        time: new Date().toLocaleString()
      })
      saveData()
      ov.remove()
      renderForum()
    }
    ov.querySelector('#npCancel').onclick = function() { ov.remove() }
  }

  function editNpc(npcId) {
    var n = npcs.find(function(x) { return x.id === npcId })
    if (!n) return
    var ov = modal('编辑NPC',
      '<div class="form-group"><label class="form-label">类型</label><select id="npType" class="form-select"><option value="npc"' + (n.type === 'npc' ? ' selected' : '') + '>普通NPC</option><option value="momo"' + (n.type === 'momo' ? ' selected' : '') + '>momo</option><option value="userxx"' + (n.type === 'userxx' ? ' selected' : '') + '>用户xxxxx</option></select></div>' +
      '<div class="form-group"><label class="form-label">名称</label><input id="npName" class="form-input" value="' + esc(n.name) + '"></div>' +
      '<div class="form-group"><label class="form-label">头像URL</label>' + IMGHOST_HINT.replace('推荐图床', '') + '<input id="npAvatar" class="form-input" value="' + esc(n.avatarUrl || '') + '"></div>',
      '<button id="npSave" class="btn btn-primary btn-sm">保存</button><button id="npCancel" class="btn btn-ghost btn-sm">取消</button>')

    ov.querySelector('#npSave').onclick = function() {
      n.type = ov.querySelector('#npType').value
      n.name = ov.querySelector('#npName').value.trim() || n.name
      n.avatarUrl = ov.querySelector('#npAvatar').value.trim()
      saveData()
      ov.remove()
      renderForum()
    }
    ov.querySelector('#npCancel').onclick = function() { ov.remove() }
  }

  function deleteNpc(npcId) {
    npcs = npcs.filter(function(x) { return x.id !== npcId })
    saveData()
    renderForum()
  }

  // Posts
  function addPost() {
    selectIdentity(function(identity) {
      var ov = modal('发帖',
        '<div class="form-group"><label class="form-label">标题</label><input id="fpTitle" class="form-input" placeholder="帖子标题"></div>' +
        '<div class="form-group"><label class="form-label">内容</label><textarea id="fpContent" class="form-textarea" placeholder="主楼内容" style="min-height:100px"></textarea></div>' +
        '<div class="form-group"><label class="form-label">图片URL（可选）</label><input id="fpImg" class="form-input" placeholder="https://..."></div>' +
        '<div><span style="font-size:.78rem;color:var(--c-text2)">发帖身份：' + esc(identity.name) + '</span></div>',
        '<button id="fpSave" class="btn btn-primary btn-sm">发布</button><button id="fpCancel" class="btn btn-ghost btn-sm">取消</button>')

      ov.querySelector('#fpSave').onclick = function() {
        var title = ov.querySelector('#fpTitle').value.trim()
        var content = ov.querySelector('#fpContent').value.trim()
        var imgUrl = ov.querySelector('#fpImg') ? ov.querySelector('#fpImg').value.trim() : ''
        if (!title) return
        posts.unshift({
          id: uid(), contactId: identity.id, contactName: identity.name,
          contactAvatar: identity.avatar, title: title, content: content, imageUrl: imgUrl || '',
          time: new Date().toLocaleString(), likes: 0, bookmarks: 0, comments: []
        })
        saveData()
        ov.remove()
        renderForum()
      }
      ov.querySelector('#fpCancel').onclick = function() { ov.remove() }
    })
  }

  function editLikes(postId) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var ov = modal('编辑点赞数',
      '<div class="form-group"><label class="form-label">点赞数</label><input id="lkInput" class="form-input" type="number" min="0" value="' + (p.likes || 0) + '"></div>',
      '<button id="lkSave" class="btn btn-primary btn-sm">保存</button><button id="lkCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#lkSave').onclick = function() { p.likes = parseInt(ov.querySelector('#lkInput').value) || 0; saveData(); ov.remove(); renderForum() }
    ov.querySelector('#lkCancel').onclick = function() { ov.remove() }
  }

  function editBookmarks(postId) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var ov = modal('编辑收藏数',
      '<div class="form-group"><label class="form-label">收藏数</label><input id="bmInput" class="form-input" type="number" min="0" value="' + (p.bookmarks || 0) + '"></div>',
      '<button id="bmSave" class="btn btn-primary btn-sm">保存</button><button id="bmCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#bmSave').onclick = function() { p.bookmarks = parseInt(ov.querySelector('#bmInput').value) || 0; saveData(); ov.remove(); renderForum() }
    ov.querySelector('#bmCancel').onclick = function() { ov.remove() }
  }

  function addComment(postId, replyToCommentId) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    selectIdentity(function(identity) {
      var ov = modal(replyToCommentId ? '回复' : '评论',
        '<div class="form-group"><textarea id="fcContent" class="form-textarea" placeholder="内容" style="min-height:60px"></textarea></div>' +
        '<div class="form-group"><label class="form-label">图片URL（可选）</label><input id="fcImg" class="form-input" placeholder="https://..."></div>' +
        '<div><span style="font-size:.78rem;color:var(--c-text2)">身份：' + esc(identity.name) + '</span></div>',
        '<button id="fcSave" class="btn btn-primary btn-sm">发送</button><button id="fcCancel" class="btn btn-ghost btn-sm">取消</button>')

      ov.querySelector('#fcSave').onclick = function() {
        var content = ov.querySelector('#fcContent').value.trim()
        var imgUrl = ov.querySelector('#fcImg') ? ov.querySelector('#fcImg').value.trim() : ''
        if (!content && !imgUrl) return
        var comment = {
          id: uid(), contactId: identity.id, contactName: identity.name,
          contactAvatar: identity.avatar, content: content, imageUrl: imgUrl || '',
          time: new Date().toLocaleString(), replies: []
        }
        if (replyToCommentId) {
          var parent = p.comments.find(function(c) { return c.id === replyToCommentId })
          if (parent) parent.replies.push(comment)
        } else {
          p.comments.push(comment)
        }
        saveData()
        ov.remove()
        renderForum()
      }
      ov.querySelector('#fpCancel') ? ov.querySelector('#fpCancel').onclick = function() { ov.remove() } : null
      if (ov.querySelector('#fcCancel')) ov.querySelector('#fcCancel').onclick = function() { ov.remove() }
    })
  }

  function deletePost(postId) {
    posts = posts.filter(function(p) { return p.id !== postId })
    saveData()
    currentPostId = null
    viewMode = 'list'
    renderForum()
  }

  function viewPost(postId) {
    currentPostId = postId
    viewMode = 'detail'
    renderForum()
  }

  function renderForum() {
    var body = frame.querySelector('#forumBody')
    if (!body) return

    var h = ''

    if (viewMode === 'npcs') {
      h += '<div class="forum-bar">'
      h += '<button class="btn btn-sm btn-ghost" id="fbBack">返回</button>'
      h += '<span class="forum-bar-title">NPC管理</span>'
      h += '<button class="btn btn-sm btn-outline" id="fbAddNpc">+ 新建</button>'
      h += '</div>'

      if (npcs.length === 0) {
        h += '<div class="pf-empty">暂无NPC</div>'
      }
      npcs.forEach(function(n) {
        var typeLabel = n.type === 'momo' ? 'momo' : (n.type === 'userxx' ? '用户xx' : 'NPC')
        h += '<div class="forum-npc-row">'
        h += '<div class="forum-npc-avatar" style="' + (n.avatarUrl ? 'background-image:url(' + esc(n.avatarUrl) + ');background-size:cover' : 'background:' + avatarColor(n.id)) + '">'
        if (!n.avatarUrl) h += '<span>' + esc(n.name.charAt(0)) + '</span>'
        h += '</div>'
        h += '<div class="forum-npc-info">'
        h += '<div class="forum-npc-name">' + esc(n.name) + '</div>'
        h += '<div class="forum-npc-meta">' + typeLabel + '</div>'
        h += '</div>'
        h += '<button class="btn btn-sm btn-ghost" data-npc-edit="' + n.id + '">编辑</button>'
        h += '<button class="btn btn-sm btn-ghost" data-npc-del="' + n.id + '" style="color:var(--c-accent3)">删除</button>'
        h += '</div>'
      })

    } else if (viewMode === 'detail' && currentPostId) {
      var post = posts.find(function(p) { return p.id === currentPostId })
      if (!post) { viewMode = 'list'; renderForum(); return }

      h += '<div class="forum-bar">'
      h += '<button class="btn btn-sm btn-ghost" id="fbBack">返回</button>'
      h += '<span class="forum-bar-title">帖子详情</span>'
      h += '<button class="btn btn-sm btn-ghost" id="fbDelPost" style="color:var(--c-accent3)">删除</button>'
      h += '</div>'

      // Post header
      var author = getIdInfo(post.contactId)
      h += '<div class="forum-post-full">'
      h += '<div class="forum-post-head">'
      h += '<div class="forum-post-avatar" style="' + (author.avatar ? 'background-image:url(' + esc(author.avatar) + ');background-size:cover' : 'background:' + avatarColor(post.contactId)) + '">'
      if (!author.avatar) h += '<span>' + esc((author.name || '?').charAt(0)) + '</span>'
      h += '</div>'
      h += '<div class="forum-post-by">'
      h += '<div class="forum-post-author">' + esc(author.name || post.contactName) + ' <span class="forum-badge-op">楼主</span></div>'
      h += '<div class="forum-post-time">' + fmtTime(post.time) + '</div>'
      h += '</div>'
      h += '</div>'
      h += '<div class="forum-post-title">' + esc(post.title) + '</div>'
      h += '<div class="forum-post-content">' + esc(post.content) + '</div>'
      h += '<div class="forum-post-actions">'
      h += '<span class="forum-action" data-like="' + post.id + '">赞 ' + (post.likes || 0) + '</span>'
      h += '<span class="forum-action" data-bookmark="' + post.id + '">收藏 ' + (post.bookmarks || 0) + '</span>'
      h += '<span class="forum-action">评论 ' + (post.comments ? post.comments.length : 0) + '</span>'
      h += '</div>'
      h += '</div>'

      // Comments
      h += '<div class="divider"></div>'
      h += '<div class="forum-comments-title">评论 (' + (post.comments ? post.comments.length : 0) + ')</div>'
      if (post.comments && post.comments.length > 0) {
        for (var ci = 0; ci < post.comments.length; ci++) {
          h += renderComment(post.comments[ci], ci + 1, post.id)
        }
      }
      h += '<div class="forum-comment-btn-bar">'
      h += '<button class="btn btn-sm btn-outline" id="fbAddComment">添加评论</button>'
      h += '</div>'

    } else {
      // List view
      h += '<div class="forum-bar">'
      h += '<span class="forum-bar-title">帖子列表</span>'
      h += '<button class="btn btn-sm btn-outline" id="fbAddPost">发帖</button>'
      h += '<button class="btn btn-sm btn-ghost" id="fbNpcs">NPC</button>'
      h += '</div>'

      if (posts.length === 0) {
        h += '<div class="pf-empty">暂无帖子</div>'
      }
      for (var pi = 0; pi < posts.length; pi++) {
        var p = posts[pi]
        var a = getIdInfo(p.contactId)
        h += '<div class="forum-list-card" data-post-id="' + p.id + '">'
        h += '<div class="forum-list-avatar" style="' + (a.avatar ? 'background-image:url(' + esc(a.avatar) + ');background-size:cover' : 'background:' + avatarColor(p.contactId)) + '">'
        if (!a.avatar) h += '<span>' + esc((a.name || '?').charAt(0)) + '</span>'
        h += '</div>'
        h += '<div class="forum-list-info">'
        h += '<div class="forum-list-title">' + esc(p.title) + '</div>'
        h += '<div class="forum-list-meta">' + esc(a.name || p.contactName) + ' / ' + fmtTime(p.time) + '</div>'
        h += '<div class="forum-list-stats">'
        h += '<span>赞 ' + (p.likes || 0) + '</span>'
        h += '<span>收藏 ' + (p.bookmarks || 0) + '</span>'
        h += '<span>评论 ' + (p.comments ? p.comments.length : 0) + '</span>'
        h += '</div>'
        h += '</div>'
        h += '</div>'
      }
    }

    body.innerHTML = h
    bindForumEvents()
  }

  function findForumCommentById(items, commentId) {
    var matches = []
    function visit(list) {
      ;(Array.isArray(list) ? list : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return
        if (String(item.id) === String(commentId)) matches.push(item)
        visit(item.replies)
      })
    }
    visit(items)
    return matches.length === 1 ? matches[0] : null
  }

  function renderForumReply(reply, postId, depth) {
    var h = '<div class="forum-reply-item" data-forum-comment-id="' + escAttr(reply.id) + '" style="margin-left:' + Math.min(depth * 10, 30) + 'px">'
    h += '<span class="forum-reply-name">' + esc(reply.contactName || '用户') + '</span>：'
    h += '<span>' + esc(reply.content) + '</span>'
    h += ' <span class="forum-comment-time">' + fmtTime(reply.time) + '</span>'
    h += '<button type="button" class="forum-choice-edit-btn" data-forum-choice-edit="' + escAttr(reply.id) + '" aria-label="编辑这条楼中楼回复的读者回复选项">＋ 回复选项</button>'
    if (Array.isArray(reply.choices) && reply.choices.length) {
      h += '<div class="chat-choices forum-comment-choices">'
      reply.choices.forEach(function(choice, choiceIndex) {
        h += '<button type="button" class="chat-choice-btn" data-forum-comment-id="' + escAttr(reply.id) + '" data-forum-choice-index="' + choiceIndex + '" aria-label="编辑论坛回复选项：' + escAttr(choice.text || '选项') + '">' + esc(choice.text || '选项') + '</button>'
      })
      h += '</div>'
    }
    if (Array.isArray(reply.replies) && reply.replies.length) {
      h += '<div class="forum-replies">'
      reply.replies.forEach(function(child) { h += renderForumReply(child, postId, depth + 1) })
      h += '</div>'
    }
    h += '</div>'
    return h
  }

  function renderComment(comment, floor, postId) {
    var h = '<div class="forum-comment" data-forum-comment-id="' + escAttr(comment.id) + '">'
    h += '<div class="forum-comment-head">'
    h += '<div class="forum-comment-avatar" style="' + (comment.contactAvatar ? 'background-image:url(' + esc(comment.contactAvatar) + ');background-size:cover' : 'background:' + avatarColor(comment.contactId)) + '">'
    if (!comment.contactAvatar) h += '<span>' + esc((comment.contactName || '?').charAt(0)) + '</span>'
    h += '</div>'
    h += '<div class="forum-comment-by">'
    h += '<span class="forum-comment-name">' + esc(comment.contactName || '用户') + '</span>'
    h += '<span class="forum-comment-floor">#' + floor + '</span>'
    h += '</div>'
    h += '</div>'
    h += '<div class="forum-comment-content">' + esc(comment.content) + '</div>'
    h += '<div class="forum-comment-actions">'
    h += '<span class="forum-action-sm" data-reply="' + comment.id + '_' + postId + '">回复</span>'
    h += '<button type="button" class="forum-choice-edit-btn" data-forum-choice-edit="' + escAttr(comment.id) + '" aria-label="编辑这条评论的读者回复选项">＋ 回复选项</button>'
    h += '<span class="forum-comment-time">' + fmtTime(comment.time) + '</span>'
    h += '</div>'

    if (Array.isArray(comment.choices) && comment.choices.length) {
      h += '<div class="chat-choices forum-comment-choices">'
      comment.choices.forEach(function(choice, choiceIndex) {
        h += '<button type="button" class="chat-choice-btn" data-forum-comment-id="' + escAttr(comment.id) + '" data-forum-choice-index="' + choiceIndex + '" aria-label="编辑论坛回复选项：' + escAttr(choice.text || '选项') + '">' + esc(choice.text || '选项') + '</button>'
      })
      h += '</div>'
    }

    // Replies (楼中楼)
    if (comment.replies && comment.replies.length > 0) {
      h += '<div class="forum-replies">'
      for (var ri = 0; ri < comment.replies.length; ri++) {
        h += renderForumReply(comment.replies[ri], postId, 1)
      }
      h += '</div>'
    }
    h += '</div>'
    return h
  }

  function bindForumEvents() {
    function editForumCommentChoices(commentId) {
      var post = posts.find(function(item) { return item.id === currentPostId })
      var comment = findForumCommentById(post?.comments, commentId)
      if (!comment) return
      openThreadReplyChoiceEditor(comment, {
        title: '编辑论坛回复选项',
        defaultFollowUpSenderId: comment.contactId,
        onSave: function() {
          saveData()
          renderForum()
        }
      })
    }

    frame.querySelectorAll('[data-forum-choice-edit]').forEach(function(button) {
      button.onclick = function() { editForumCommentChoices(button.dataset.forumChoiceEdit) }
    })
    frame.querySelectorAll('.chat-choice-btn[data-forum-comment-id]').forEach(function(button) {
      button.onclick = function() { editForumCommentChoices(button.dataset.forumCommentId) }
    })

    // Back button
    var backBtn = frame.querySelector('#fbBack')
    if (backBtn) backBtn.onclick = function() {
      if (viewMode === 'detail') {
        currentPostId = null; viewMode = 'list'; renderForum()
      } else if (viewMode === 'npcs') {
        viewMode = 'list'; renderForum()
      }
    }

    // NPC management
    var addNpcBtn = frame.querySelector('#fbAddNpc')
    if (addNpcBtn) addNpcBtn.onclick = function() { addNpc() }

    var npcEditBtns = frame.querySelectorAll('[data-npc-edit]')
    npcEditBtns.forEach(function(b) { b.onclick = function() { editNpc(b.dataset.npcEdit) } })

    var npcDelBtns = frame.querySelectorAll('[data-npc-del]')
    npcDelBtns.forEach(function(b) { b.onclick = function() { deleteNpc(b.dataset.npcDel) } })

    // NPCs button
    var npcsBtn = frame.querySelector('#fbNpcs')
    if (npcsBtn) npcsBtn.onclick = function() { viewMode = 'npcs'; renderForum() }

    // Add post
    var addPostBtn = frame.querySelector('#fbAddPost')
    if (addPostBtn) addPostBtn.onclick = function() { addPost() }

    // Delete post
    var delPostBtn = frame.querySelector('#fbDelPost')
    if (delPostBtn) delPostBtn.onclick = function() { deletePost(currentPostId) }

    // Like / Bookmark
    var likeBtns = frame.querySelectorAll('[data-like]')
    likeBtns.forEach(function(b) { b.onclick = function() { editLikes(b.dataset.like) } })
    var bmBtns = frame.querySelectorAll('[data-bookmark]')
    bmBtns.forEach(function(b) { b.onclick = function() { editBookmarks(b.dataset.bookmark) } })

    // Add comment
    var addCommentBtn = frame.querySelector('#fbAddComment')
    if (addCommentBtn) addCommentBtn.onclick = function() { addComment(currentPostId) }

    // Reply
    var replyBtns = frame.querySelectorAll('[data-reply]')
    replyBtns.forEach(function(b) {
      b.onclick = function() {
        var parts = b.dataset.reply.split('_')
        addComment(parts[1], parts[0])
      }
    })

    // Post cards
    var cards = frame.querySelectorAll('.forum-list-card')
    cards.forEach(function(c) { c.onclick = function() { viewPost(c.dataset.postId) } })

    // Right-click to edit post title/content
    var postTitle = frame.querySelector('.forum-post-title')
    if (postTitle) postTitle.oncontextmenu = function(e) { e.preventDefault(); editPostField(currentPostId, 'title') }
    var postContent = frame.querySelector('.forum-post-content')
    if (postContent) postContent.oncontextmenu = function(e) { e.preventDefault(); editPostField(currentPostId, 'content') }

    // Right-click on comments to edit
    var commentContents = frame.querySelectorAll('.forum-comment-content')
    commentContents.forEach(function(el) {
      var comment = el.closest('.forum-comment')
      var cid = comment ? comment.querySelector('[data-reply]') : null
      var dataReply = cid ? cid.dataset.reply.split('_')[0] : null
      el.oncontextmenu = function(e) { e.preventDefault(); if (dataReply) editComment(currentPostId, dataReply) }
    })

    // Right-click on replies to edit
    var replyItems = frame.querySelectorAll('.forum-reply-item')
    replyItems.forEach(function(el) {
      el.oncontextmenu = function(e) {
        e.preventDefault()
        var commentEl = el.closest('.forum-comment')
        var replyBtn = commentEl ? commentEl.querySelector('[data-reply]') : null
        var dataReply = replyBtn ? replyBtn.dataset.reply.split('_')[0] : null
        if (dataReply && currentPostId) {
          var post = posts.find(function(p) { return p.id === currentPostId })
          if (post) {
            var parentComment = post.comments.find(function(c) { return c.id === dataReply })
            if (parentComment && parentComment.replies) {
              var replyIdx = Array.from(commentEl.querySelectorAll('.forum-reply-item')).indexOf(el)
              if (replyIdx >= 0 && replyIdx < parentComment.replies.length) {
                editReply(currentPostId, dataReply, replyIdx)
              }
            }
          }
        }
      }
    })

    // Delete buttons on comments — inline at right of actions bar
    var commentBlocks = frame.querySelectorAll('.forum-comment')
    commentBlocks.forEach(function(block) {
      var replyBtn = block.querySelector('[data-reply]')
      if (!replyBtn) return
      var dataReply = replyBtn.dataset.reply.split('_')[0]
      var delBtn = document.createElement('button')
      delBtn.className = 'browser-del'
      delBtn.textContent = 'x'
      delBtn.style.cssText = 'margin-left:auto'
      delBtn.title = '删除评论'
      delBtn.onclick = function() { deleteComment(currentPostId, dataReply) }
      var actions = block.querySelector('.forum-comment-actions')
      if (actions) actions.appendChild(delBtn)
    })

    // Delete buttons on replies
    var replyBlocks = frame.querySelectorAll('.forum-reply-item')
    replyBlocks.forEach(function(el, ri) {
      var delBtn = document.createElement('button')
      delBtn.className = 'browser-del'
      delBtn.textContent = 'x'
      delBtn.style.cssText = 'margin-left:4px;font-size:.55rem'
      delBtn.title = '删除回复'
      delBtn.style.cssText = 'margin-left:4px;float:right;font-size:.55rem'
      delBtn.onclick = function() {
        var commentEl = el.closest('.forum-comment')
        var replyBtn = commentEl ? commentEl.querySelector('[data-reply]') : null
        var cid = replyBtn ? replyBtn.dataset.reply.split('_')[0] : null
        if (cid) {
          var allReplies = Array.from(commentEl.querySelectorAll('.forum-reply-item'))
          var idx = allReplies.indexOf(el)
          if (idx >= 0) deleteReply(currentPostId, cid, idx)
        }
      }
      el.appendChild(delBtn)
    })
  }

  function editPostField(postId, field) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var label = field === 'title' ? '标题' : '内容'
    var isTextarea = field === 'content'
    var val = esc(p[field] || '')
    var inputHtml = isTextarea
      ? '<textarea id="editField" class="form-textarea" style="min-height:80px">' + val + '</textarea>'
      : '<input id="editField" class="form-input" value="' + val + '">'

    var ov = modal('编辑帖子' + label,
      '<div class="form-group"><label class="form-label">' + label + '</label>' + inputHtml + '</div>' +
      '<div class="form-group"><label class="form-label">图片URL</label><input id="editImg" class="form-input" value="' + esc(p.imageUrl || '') + '" placeholder="https://..."></div>',
      '<button id="efSave" class="btn btn-primary btn-sm">保存</button><button id="efCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#efSave').onclick = function() {
      p[field] = ov.querySelector('#editField').value.trim()
      p.imageUrl = ov.querySelector('#editImg').value.trim()
      saveData()
      ov.remove()
      renderForum()
    }
    ov.querySelector('#efCancel').onclick = function() { ov.remove() }
  }

  function editComment(postId, commentId) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var c = p.comments.find(function(x) { return x.id === commentId })
    if (!c) return
    var ov = modal('编辑评论',
      '<div class="form-group"><textarea id="ecText" class="form-textarea" style="min-height:60px">' + esc(c.content || '') + '</textarea></div>' +
      '<div class="form-group"><label class="form-label">图片URL</label><input id="ecImg" class="form-input" value="' + esc(c.imageUrl || '') + '" placeholder="https://..."></div>',
      '<button id="ecSave" class="btn btn-primary btn-sm">保存</button><button id="ecCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#ecSave').onclick = function() {
      c.content = ov.querySelector('#ecText').value.trim()
      c.imageUrl = ov.querySelector('#ecImg').value.trim()
      saveData(); ov.remove(); renderForum()
    }
    ov.querySelector('#ecCancel').onclick = function() { ov.remove() }
  }

  function editReply(postId, commentId, replyIdx) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var c = p.comments.find(function(x) { return x.id === commentId })
    if (!c || !c.replies || replyIdx >= c.replies.length) return
    var r = c.replies[replyIdx]
    var ov = modal('编辑回复',
      '<div class="form-group"><textarea id="erText" class="form-textarea" style="min-height:60px">' + esc(r.content || '') + '</textarea></div>',
      '<button id="erSave" class="btn btn-primary btn-sm">保存</button><button id="erCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#erSave').onclick = function() {
      r.content = ov.querySelector('#erText').value.trim()
      saveData(); ov.remove(); renderForum()
    }
    ov.querySelector('#erCancel').onclick = function() { ov.remove() }
  }

  function deleteComment(postId, commentId) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    p.comments = p.comments.filter(function(c) { return c.id !== commentId })
    saveData()
    renderForum()
  }

  function deleteReply(postId, commentId, replyIdx) {
    var p = posts.find(function(x) { return x.id === postId })
    if (!p) return
    var c = p.comments.find(function(x) { return x.id === commentId })
    if (!c || !c.replies) return
    c.replies.splice(replyIdx, 1)
    saveData()
    renderForum()
  }

  // Build HTML
  var fh = '<div class="cu-panel cu-panel-embedded" id="forumPanel">'
  fh += '<div class="cu-header" style="justify-content:space-between">'
  fh += '<button type="button" class="cu-close-btn" id="forumBack" aria-label="返回">&larr;</button>'
  fh += '<span class="cu-title" style="flex:1;text-align:center">论坛</span>'
  fh += '<div style="width:32px"></div></div>'
  fh += '<div class="cu-body" id="forumBody" style="padding:6px 10px"></div>'
  fh += '</div>'

  frame.innerHTML = fh
  renderForum()

  // Back button (close)
  var backBtn = frame.querySelector('#forumBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid) }
  }
}

/// ===== MESSAGES EDITOR (chats + contacts + moments) =====
function openMessagesEditor(frame, wid, pd) {
  var chats = pd.chats || []
  var contacts = pd.contacts || []
  var moments = pd.moments || []
  var activeTab = 'chats'

  function saveData() {
    pd.chats = chats
    pd.moments = moments
    updateWork(wid, { phoneData: pd })
  }

  function addSingleChat() {
    selectContacts(function(selContact) {
      chats.push({ id: uid(), type: 'single', contactIds: [selContact.id], groupName: '', messages: [], rounds: [] })
      saveData()
      renderMessages()
    }, false)
  }

  function addGroupFromContacts() {
    if (contacts.length === 0) { showToast('请先添加联系人'); return }
    selectContacts(function(selContactIds) {
      if (selContactIds.length === 0) return
      var ov2 = modal('群聊名称',
        '<div class="form-group"><input id="gnInput" class="form-input" placeholder="群聊名称" value="群聊(' + (selContactIds.length + 1) + '人)"></div>',
        '<button id="gnOk" class="btn btn-primary btn-sm">确定</button><button id="gnCancel" class="btn btn-ghost btn-sm">取消</button>')
      ov2.querySelector('#gnOk').onclick = function() {
        var name = ov2.querySelector('#gnInput').value.trim()
        if (!name) name = '群聊(' + (selContactIds.length + 1) + '人)'
        chats.push({ id: uid(), type: 'group', contactIds: selContactIds, groupName: name, messages: [], rounds: [] })
        saveData()
        ov2.remove()
        renderMessages()
      }
      ov2.querySelector('#gnCancel').onclick = function() { ov2.remove() }
    }, true)
  }

  function selectContacts(callback, multi) {
    var inputType = multi ? 'checkbox' : 'radio'
    var h = '<div class="form-group"><label class="form-label">搜索</label><input id="scSearch" class="form-input" placeholder="输入名称..."></div>'
    h += '<div id="scList" style="max-height:200px;overflow-y:auto">'
    h += renderContactCheckboxes('', inputType)
    h += '</div>'
    var ov = modal(multi ? '选择群成员' : '选择联系人', h,
      '<button id="scOk" class="btn btn-primary btn-sm">确定</button><button id="scCancel" class="btn btn-ghost btn-sm">取消</button>')

    var search = ov.querySelector('#scSearch')
    var list = ov.querySelector('#scList')
    if (search) search.oninput = function() { list.innerHTML = renderContactCheckboxes(search.value.trim(), inputType) }

    ov.querySelector('#scCancel').onclick = function() { ov.remove() }
    ov.querySelector('#scOk').onclick = function() {
      var sel = list.querySelectorAll('[name="scCb"]:checked')
      if (multi) {
        var ids = Array.from(sel).map(function(cb) { return cb.value })
        ov.remove()
        if (ids.length > 0) callback(ids)
      } else {
        if (sel.length > 0) { ov.remove(); callback({ id: sel[0].value, name: sel[0].dataset.name }) }
      }
    }
  }

  function renderContactCheckboxes(filter, inputType) {
    var h = ''
    var f = (filter || '').toLowerCase()
    var it = inputType || 'radio'
    contacts.forEach(function(c) {
      if (f && c.name.toLowerCase().indexOf(f) < 0) return
      h += '<label class="forum-id-opt">'
      h += '<input type="' + it + '" name="scCb" value="' + c.id + '" data-name="' + esc(c.name) + '">'
      h += '<span>' + esc(c.name) + '</span>'
      h += '</label>'
    })
    return h || '<div class="pf-empty">无匹配联系人</div>'
  }

  function deleteChat(cid) {
    chats = chats.filter(function(ch) { return ch.id !== cid })
    saveData()
    renderMessages()
  }

  function addMoment() {
    var senderOptions = contacts.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>' }).join('')
    var ov = modal('发动\u6001',
      '<div class="form-group"><textarea id="moContent" class="form-textarea" placeholder="内容"></textarea></div>' +
      '<div class="form-group"><label class="form-label">图片URL（多个用换行分隔）</label><textarea id="moImgs" class="form-textarea" style="min-height:50px" placeholder="https://..."></textarea></div>' +
      '<div class="form-group"><label class="form-label">发送者</label><select id="moSender" class="form-select">' + senderOptions + '</select></div>' +
      '<div class="form-group"><label class="form-label">时间（可修改）</label><input id="moTime" class="form-input" value="' + esc(new Date().toLocaleString()) + '"></div>',
      '<button id="moSave" class="btn btn-primary btn-sm">发布</button><button id="moCancel" class="btn btn-ghost btn-sm">取消</button>')
    ov.querySelector('#moSave').onclick = function() {
      var content = ov.querySelector('#moContent').value.trim()
      if (!content) return
      var senderId = ov.querySelector('#moSender').value
      var imgs = (ov.querySelector('#moImgs').value || '').split('\n').filter(function(l) { return l.trim() })
      var timeVal = ov.querySelector('#moTime').value.trim() || new Date().toLocaleString()
      moments.unshift({
        id: uid(), contactId: senderId, content: content,
        images: imgs, time: timeVal, likes: [], comments: []
      })
      saveData()
      ov.remove()
      renderMessages()
    }
    ov.querySelector('#moCancel').onclick = function() { ov.remove() }
  }

  function deleteMoment(mid) {
    moments = moments.filter(function(m) { return m.id !== mid })
    saveData()
    renderMessages()
  }

  function getChatName(ch) {
    if (ch.type === 'group') return ch.groupName || '群聊'
    var c = contacts.find(function(x) { return x.id === ch.contactIds[0] })
    return c ? contactDisplayName(c, 'messages') : '未知'
  }

  function renderMessages() {
    var body = frame.querySelector('#msgBody')
    if (!body) return

    var h = ''
    if (activeTab === 'chats') {
      h += '<div class="forum-bar">'
      h += '<span class="forum-bar-title">消息列表</span>'
      h += '<button class="btn btn-sm btn-outline" id="msgAddChat">+ 新建</button>'
      h += '</div>'
      if (chats.length === 0) h += '<div class="pf-empty">暂无对话</div>'
      chats.forEach(function(ch) {
        var name = getChatName(ch)
        var chatContact = ch.type === 'single' ? contacts.find(function(x) { return x.id === ch.contactIds[0] }) : null
        var chatAvatarStyle = ch.type === 'group'
          ? 'background:#10b981'
          : (chatContact && chatContact.avatarUrl
              ? 'background-image:url(' + chatContact.avatarUrl + ');background-size:cover'
              : 'background:' + avatarColor((chatContact && chatContact.id) || ch.id))
        h += '<div class="forum-list-card" data-chat-id="' + escapeHtmlAttribute(ch.id) + '" style="position:relative">'
        h += '<div class="forum-list-avatar" style="' + escapeHtmlAttribute(chatAvatarStyle) + '">'
        if (ch.type === 'group' || !chatContact || !chatContact.avatarUrl) h += '<span>' + esc(name.charAt(0)) + '</span>'
        h += '</div>'
        h += '<div class="forum-list-info">'
        h += '<div class="forum-list-title">' + esc(name) + '</div>'
        h += '<div style="font-size:.68rem;color:var(--c-text2)">' + (ch.type === 'group' ? '群聊 ' + (ch.contactIds.length + 1) + '人' : '') + '</div>'
        h += '</div>'
        h += '<button class="browser-del" style="position:absolute;top:8px;right:4px" data-chat-del="' + escapeHtmlAttribute(ch.id) + '">x</button>'
        h += '</div>'
      })
    } else if (activeTab === 'contacts') {
      h += '<div class="forum-bar"><span class="forum-bar-title">联系人</span><button class="btn btn-sm btn-outline" id="msgAddGroup">新建群聊</button></div>'
      if (contacts.length === 0) h += '<div class="pf-empty">暂无联系人，请先在联系人面板中添加</div>'
      contacts.forEach(function(c) {
        h += '<div class="forum-npc-row">'
        var contactAvatarStyle = c.avatarUrl ? 'background-image:url(' + c.avatarUrl + ');background-size:cover' : 'background:' + avatarColor(c.id)
        h += '<div class="forum-npc-avatar" style="' + escapeHtmlAttribute(contactAvatarStyle) + '">'
        if (!c.avatarUrl) h += '<span>' + esc(c.name.charAt(0)) + '</span>'
        h += '</div><div class="forum-npc-name">' + esc(c.name) + '</div>'
        h += '</div>'
      })
    } else {
      h += '<div class="forum-bar">'
      h += '<span class="forum-bar-title">动态</span>'
      h += '<button class="btn btn-sm btn-outline" id="msgAddMoment">+ 发布</button>'
      h += '</div>'
      if (moments.length === 0) h += '<div class="pf-empty">暂无动态</div>'
      moments.forEach(function(m) {
        var c = contacts.find(function(x) { return x.id === m.contactId })
        h += '<div class="moment-card" style="position:relative">'
        h += '<div class="moment-header"><div class="moment-avatar" style="background:' + avatarColor(m.contactId || '0') + '">' + esc((c ? c.name : '?').charAt(0)) + '</div>'
        h += '<div><div class="moment-user">' + esc(c ? c.name : '未知') + '</div><input class="moment-time-edit" data-moment-time="' + m.id + '" value="' + esc(m.time || '') + '" style="font-size:.7rem;color:var(--c-text2);border:none;background:transparent;outline:none;width:100%"></div></div>'
        h += '<div class="moment-content">' + esc(m.content || '') + '</div>'
        if (m.images && m.images.length) {
          h += '<div class="moment-images">'
          m.images.forEach(function(img) { h += '<img src="' + esc(img) + '" onerror="this.style.display=\'none\'">' })
          h += '</div>'
        }
        var mComments = m.comments || []
        if (mComments.length > 0) {
          h += '<div class="forum-replies" style="margin:4px 0;padding:4px 8px;background:var(--c-surface2);border-left:2px solid var(--c-primary)">'
          mComments.forEach(function(mc, mci) {
            var mcContact = contacts.find(function(x) { return x.id === mc.contactId })
            h += '<div class="forum-reply-item" style="font-size:.7rem;line-height:1.5;padding:2px 0">'
            h += '<span class="forum-reply-name" style="color:var(--c-primary-hover);font-weight:500">' + esc(mcContact ? mcContact.name : mc.contactName || '用户') + '</span>：'
            h += '<span>' + esc(mc.content || '') + '</span>'
            h += ' <span class="forum-comment-time" style="font-size:.6rem;color:var(--c-text2)">' + esc(mc.time || '') + '</span>'
            h += '<button class="moment-choice-edit-btn" data-moment-id="' + m.id + '" data-moment-ci="' + mci + '" style="margin-left:4px;border:none;background:transparent;color:var(--c-text2);cursor:pointer;font-size:.6rem" title="添加选项">+</button>'
            h += '</div>'
            if (mc.choices && mc.choices.length > 0) {
              h += '<div class="chat-choices" style="margin-left:8px;margin-top:2px">'
              mc.choices.forEach(function(c, cidx) {
                h += '<button type="button" class="chat-choice-btn" data-moment-cid="' + escAttr(m.id) + '" data-moment-ci="' + mci + '" data-moment-coi="' + cidx + '" aria-label="编辑动态回复选项：' + escAttr(c.text || '选项') + '">' + esc(c.text || '选项') + '</button>'
              })
              h += '</div>'
            }
          })
          h += '</div>'
        }
        h += '<div class="moment-actions" style="display:flex;gap:16px;font-size:.75rem;color:var(--c-text2);padding-top:6px;border-top:1px solid var(--c-border)">'
        h += '<span class="moment-reply-btn" data-moment-reply="' + m.id + '" style="cursor:pointer">回复</span>'
        h += '</div>'
        h += '<button class="browser-del" style="position:absolute;top:4px;right:4px" data-moment-del="' + m.id + '">x</button>'
        h += '</div>'
      })
    }

    body.innerHTML = h
    bindMsgEvents()
  }

function bindMsgEvents() {
    var addGroupBtn = frame.querySelector('#msgAddGroup')
    if (addGroupBtn) addGroupBtn.onclick = function() { addGroupFromContacts() }

    var addChatBtn = frame.querySelector('#msgAddChat')
    if (addChatBtn) addChatBtn.onclick = function() { addSingleChat() }

    var addMomentBtn = frame.querySelector('#msgAddMoment')
    if (addMomentBtn) addMomentBtn.onclick = function() { addMoment() }

    var delBtns = frame.querySelectorAll('[data-chat-del]')
    delBtns.forEach(function(b) { b.onclick = function(e) { e.stopPropagation(); deleteChat(b.dataset.chatDel) } })

    var moDelBtns = frame.querySelectorAll('[data-moment-del]')
    moDelBtns.forEach(function(b) { b.onclick = function(e) { e.stopPropagation(); deleteMoment(b.dataset.momentDel) } })

    // Moment reply buttons
    var replyBtns = frame.querySelectorAll('[data-moment-reply]')
    replyBtns.forEach(function(b) {
      b.onclick = function() {
        var mid = b.dataset.momentReply
        var m = moments.find(function(x) { return x.id === mid })
        if (!m) return
        var senderOptions = contacts.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>' }).join('')
        var ov = modal('回复动态',
          '<div class="form-group"><textarea id="mrContent" class="form-textarea" placeholder="回复内容" style="min-height:60px"></textarea></div>' +
          '<div class="form-group"><label class="form-label">回复身份</label><select id="mrSender" class="form-select">' + senderOptions + '</select></div>',
          '<button id="mrSave" class="btn btn-primary btn-sm">发送</button><button id="mrCancel" class="btn btn-ghost btn-sm">取消</button>')
        ov.querySelector('#mrSave').onclick = function() {
          var content = ov.querySelector('#mrContent').value.trim()
          if (!content) return
          var senderId = ov.querySelector('#mrSender').value
          var sc = contacts.find(function(x) { return x.id === senderId })
          m.comments = m.comments || []
          m.comments.push({ id: uid(), contactId: senderId, contactName: sc ? sc.name : '', content: content, time: new Date().toLocaleString() })
          saveData()
          ov.remove()
          renderMessages()
        }
        ov.querySelector('#mrCancel').onclick = function() { ov.remove() }
      }
    })

    // Moment time edit — save on blur
    var timeInputs = frame.querySelectorAll('[data-moment-time]')
    timeInputs.forEach(function(inp) {
      inp.addEventListener('blur', function() {
        var mid = inp.dataset.momentTime
        var m = moments.find(function(x) { return x.id === mid })
        if (m) {
          m.time = inp.value.trim() || ''
          saveData()
        }
      })
    })

    // Moment choice button clicks
    var body = frame.querySelector('#msgBody')
    if (body) {
      body.onclick = function(e) {
        // Moment choice click
        var choiceBtn = e.target.closest('.chat-choice-btn[data-moment-cid]')
        if (choiceBtn) {
          e.preventDefault()
          var mid = choiceBtn.dataset.momentCid
          var mci = parseInt(choiceBtn.dataset.momentCi)
          var localEditor = Array.from(frame.querySelectorAll('.moment-choice-edit-btn')).find(function(button) {
            return button.dataset.momentId === mid && Number(button.dataset.momentCi) === mci
          })
          localEditor?.click()
          return
        }

        // Moment "+" button click to add choices
        var editBtn = e.target.closest('.moment-choice-edit-btn')
        if (editBtn) {
          e.preventDefault()
          var mid = editBtn.dataset.momentId
          var mci = parseInt(editBtn.dataset.momentCi)
          var m = moments.find(function(x) { return x.id === mid })
          if (!m || !m.comments || !m.comments[mci]) return
          var mc = m.comments[mci]
          var choiceGroups = []
          if (mc.choices && mc.choices.length) {
            mc.choices.forEach(function(c) {
              choiceGroups.push({ id: c.id || '', text: c.text || '', replyText: c.replyText || '', followUpLines: c.followUpMessages ? c.followUpMessages.map(function(fm) { return fm.text || fm.content || '' }).join('\n') : '' })
            })
          }
          if (choiceGroups.length === 0) choiceGroups.push({ id: '', text: '', replyText: '', followUpLines: '' })

          function renderGroups() {
            var listEl = document.getElementById('mcGroupsList')
            if (!listEl) return
            var curTexts = listEl.querySelectorAll('.ch-grp-text')
            var curReplies = listEl.querySelectorAll('.ch-grp-reply')
            var curFollows = listEl.querySelectorAll('.ch-grp-follow')
            for (var si = 0; si < curTexts.length && si < choiceGroups.length; si++) {
              choiceGroups[si].text = curTexts[si].value || ''
              choiceGroups[si].replyText = curReplies[si] ? curReplies[si].value : ''
              choiceGroups[si].followUpLines = curFollows[si] ? curFollows[si].value : ''
            }
            var h = ''
            for (var gi = 0; gi < choiceGroups.length; gi++) {
              var g = choiceGroups[gi]
              h += '<div style="border:1px solid var(--c-border);padding:8px;margin-bottom:6px;position:relative">'
              h += '<div style="font-size:.7rem;color:var(--c-text2);margin-bottom:4px">选项组 ' + (gi + 1) + '</div>'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">选项文本</label>'
              h += '<input class="ch-grp-text" value="' + esc(g.text) + '" placeholder="选项描述" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);margin-bottom:4px">'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">读者回复</label>'
              h += '<input class="ch-grp-reply" value="' + esc(g.replyText) + '" placeholder="选中后读者的回复" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);margin-bottom:4px">'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">角色后续回复（每行=一个气泡）</label>'
              h += '<textarea class="ch-grp-follow" placeholder="每行一条消息" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);min-height:50px">' + esc(g.followUpLines) + '</textarea>'
              h += '<button class="ch-grp-del" data-ch-grp-idx="' + gi + '" style="position:absolute;top:4px;right:4px;border:none;background:transparent;color:var(--c-text2);cursor:pointer;font-size:.7rem">x</button>'
              h += '</div>'
            }
            listEl.innerHTML = h
            var dels = listEl.querySelectorAll('.ch-grp-del')
            dels.forEach(function(btn) {
              btn.onclick = function() {
                var idx = parseInt(btn.dataset.chGrpIdx)
                if (choiceGroups.length > 1) {
                  choiceGroups.splice(idx, 1)
                  renderGroups()
                }
              }
            })
          }

          var h2 = '<div id="mcGroupsList" style="max-height:50vh;overflow-y:auto;margin-bottom:8px"></div>'
          h2 += '<button id="mcAddGroup" class="btn btn-sm btn-outline" style="width:100%">+ 添加选项组</button>'
          var ov = modal('添加分支选项', h2,
            '<button id="mcSave" class="btn btn-primary btn-sm">保存</button><button id="mcCancel" class="btn btn-ghost btn-sm">取消</button>')
          renderGroups()
          ov.querySelector('#mcAddGroup').onclick = function() { choiceGroups.push({ id: '', text: '', replyText: '', followUpLines: '' }); renderGroups() }
          ov.querySelector('#mcSave').onclick = function() {
            var listEl = ov.querySelector('#mcGroupsList')
            if (!listEl) return
            var texts = listEl.querySelectorAll('.ch-grp-text')
            var replies = listEl.querySelectorAll('.ch-grp-reply')
            var follows = listEl.querySelectorAll('.ch-grp-follow')
            var previousChoices = Array.isArray(mc.choices) ? mc.choices : []
            var nextChoices = []
            for (var i = 0; i < texts.length; i++) {
              var grpText = (texts[i].value || '').trim()
              if (!grpText) continue
              var replyText = (replies[i] ? replies[i].value : '').trim()
              var followLines = (follows[i] ? follows[i].value : '').split('\n').filter(function(l) { return l.trim() })
              var groupId = choiceGroups[i]?.id || ''
              var previousChoice = previousChoices.find(function(choice) { return groupId && choice.id === groupId })
              var previousFollowUps = Array.isArray(previousChoice?.followUpMessages) ? previousChoice.followUpMessages : []
              var fms = followLines.map(function(line, lineIndex) {
                var previousFollowUp = previousFollowUps[lineIndex]
                return Object.assign({}, previousFollowUp || {}, {
                  id: previousFollowUp?.id || uid(),
                  senderId: previousFollowUp?.senderId || mc.contactId || 'self',
                  text: line.trim(),
                  content: line.trim(),
                  type: previousFollowUp?.type || 'text',
                  time: previousFollowUp?.time || new Date().toLocaleString()
                })
              })
              var nextChoice = Object.assign({}, previousChoice || {}, {
                id: previousChoice?.id || uid(),
                text: grpText,
                replyText: replyText || grpText,
                followUpMessages: fms
              })
              delete nextChoice.used
              nextChoices.push(nextChoice)
            }
            mc.choices = nextChoices.length ? nextChoices : undefined
            saveData(); ov.remove(); renderMessages()
          }
          ov.querySelector('#mcCancel').onclick = function() { ov.remove() }
        }
      }
    }

    var chatCards = frame.querySelectorAll('[data-chat-id]')
    chatCards.forEach(function(card) {
      card.onclick = function() { openChatEditor(frame, wid, card.dataset.chatId, pd) }
    })
  }

  // Build HTML
  var mh = '<div class="cu-panel cu-panel-embedded" id="msgPanel">'
  mh += '<div class="cu-header" style="justify-content:space-between">'
  mh += '<button type="button" class="cu-close-btn" id="msgBack" aria-label="返回">&larr;</button>'
  mh += '<span class="cu-title" style="flex:1;text-align:center">消息</span>'
  mh += '<div style="width:32px"></div></div>'
  mh += '<div class="cu-body" id="msgBody" style="padding:6px 10px;flex:1"></div>'
  mh += '<div class="shop-tabs" id="msgTabs" style="flex-shrink:0">'
  mh += '<div class="shop-tab active" id="msgTabChats">消息</div>'
  mh += '<div class="shop-tab" id="msgTabContacts">联系人</div>'
  mh += '<div class="shop-tab" id="msgTabMoments">动态</div>'
  mh += '</div>'
  mh += '</div>'

  frame.innerHTML = mh
  renderMessages()

  var tabChats = frame.querySelector('#msgTabChats')
  var tabContacts = frame.querySelector('#msgTabContacts')
  var tabMoments = frame.querySelector('#msgTabMoments')
  if (tabChats) tabChats.onclick = function() { activeTab = 'chats'; refreshTabs(); renderMessages() }
  if (tabContacts) tabContacts.onclick = function() { activeTab = 'contacts'; refreshTabs(); renderMessages() }
  if (tabMoments) tabMoments.onclick = function() { activeTab = 'moments'; refreshTabs(); renderMessages() }

  function refreshTabs() {
    var tabs = frame.querySelectorAll('#msgTabs .shop-tab')
    tabs.forEach(function(t) { t.classList.remove('active') })
    if (activeTab === 'chats') frame.querySelector('#msgTabChats').classList.add('active')
    else if (activeTab === 'contacts') frame.querySelector('#msgTabContacts').classList.add('active')
    else frame.querySelector('#msgTabMoments').classList.add('active')
  }

  var backBtn = frame.querySelector('#msgBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid) }
  }
}

function openChatEditor(frame, wid, chatId, pd) {
  var chats = pd.chats || []
  var contacts = pd.contacts || []
  var ch = chats.find(function(c) { return c.id === chatId })
  if (!ch) return
  var legacyMessages = Array.isArray(ch.messages) ? ch.messages : []
  var migratedChatShape = false
  if (!Array.isArray(ch.rounds) || !ch.rounds.length) {
    ch.rounds = [{ id: uid(), label: '第1轮', messages: legacyMessages.slice() }]
    ch.messages = []
    migratedChatShape = true
  } else if (legacyMessages.length) {
    var migrationRound = ch.rounds[ch.rounds.length - 1]
    migrationRound.messages = (Array.isArray(migrationRound.messages) ? migrationRound.messages : []).concat(legacyMessages)
    ch.messages = []
    migratedChatShape = true
  }
  if (migratedChatShape) updateWork(wid, { phoneData: pd })
  var activeSpeakerId = (ch.contactIds && ch.contactIds[0]) || 'self'

  function save() {
    pd.chats = chats
    updateWork(wid, { phoneData: pd })
  }

  function getChatName() {
    if (ch.type === 'group') return ch.groupName || '群聊'
    var c = contacts.find(function(x) { return x.id === ch.contactIds[0] })
    return c ? contactDisplayName(c, 'messages') : '未知'
  }

  function addMsg(type) {
    var senderIds = ch.type === 'group' ? ch.contactIds.concat(['self']) : [ch.contactIds[0], 'self']
    var optionsHtml = senderIds.map(function(id) {
      if (id === 'self') return '<option value="self">读者</option>'
      var c = contacts.find(function(x) { return x.id === id })
      return '<option value="' + escapeHtmlAttribute(id) + '">' + esc(c ? c.name : '未知') + '</option>'
    }).join('')

    var typeLabel = type === 'text' ? '文字' : (type === 'image' ? '图片' : (type === 'link' ? '链接' : (type === 'redpacket' ? '红包' : (type === 'transfer' ? '转账' : '亲属卡'))))
    var extraHtml = ''
    if (type === 'image') extraHtml = '<div class="form-group"><label class="form-label">图片URL</label><input id="amImg" class="form-input" placeholder="https://..."></div>'
    else if (type === 'link') extraHtml = '<div class="form-group"><label class="form-label">链接标题</label><input id="amLinkTitle" class="form-input" placeholder="标题"><label class="form-label">链接URL</label><input id="amLinkUrl" class="form-input" placeholder="https://..."></div>'
    else if (type === 'redpacket') extraHtml = '<div class="form-group"><label class="form-label">金额</label><input id="amRpAmt" class="form-input" type="number" step="0.01" placeholder="0.00"><label class="form-label">祝福语</label><input id="amRpMsg" class="form-input" placeholder="恭喜发财"></div>'
    else if (type === 'transfer') extraHtml = '<div class="form-group"><label class="form-label">金额</label><input id="amTrAmt" class="form-input" type="number" step="0.01" placeholder="0.00"><label class="form-label">备注</label><input id="amTrNote" class="form-input" placeholder="转账"></div>'
    else if (type === 'familycard') extraHtml = '<div class="form-group"><label class="form-label">亲属关系</label><input id="amFcRel" class="form-input" placeholder="例如：爸爸/妈妈/姐姐"><label class="form-label">金额</label><input id="amFcAmt" class="form-input" type="number" step="0.01" placeholder="0.00"></div>'

    var ov = modal('添加' + typeLabel,
      (type !== 'image' && type !== 'redpacket' && type !== 'transfer' && type !== 'familycard' ? '<div class="form-group"><textarea id="amText" class="form-textarea" placeholder="消息内容" style="min-height:60px"></textarea></div>' : '') +
      extraHtml +
      '<div class="form-group"><label class="form-label">发送者</label><select id="amSender" class="form-select">' + optionsHtml + '</select></div>',
      '<button id="amSave" class="btn btn-primary btn-sm">添加</button><button id="amCancel" class="btn btn-ghost btn-sm">取消</button>')

    ov.querySelector('#amSave').onclick = function() {
      var msg = {
        id: uid(), senderId: ov.querySelector('#amSender').value,
        text: ov.querySelector('#amText') ? ov.querySelector('#amText').value.trim() : '',
        time: new Date().toLocaleString(), type: type
      }
      if (type === 'image') msg.image = ov.querySelector('#amImg').value.trim()
      if (type === 'link') { msg.linkTitle = ov.querySelector('#amLinkTitle').value.trim(); msg.linkUrl = ov.querySelector('#amLinkUrl').value.trim() }
      if (type === 'redpacket') { msg.redpacketAmount = parseFloat(ov.querySelector('#amRpAmt').value) || 0; msg.redpacketMsg = ov.querySelector('#amRpMsg').value.trim() || '恭喜发财' }
      if (type === 'transfer') { msg.transferAmount = parseFloat(ov.querySelector('#amTrAmt').value) || 0; msg.transferNote = ov.querySelector('#amTrNote').value.trim() || '转账' }
      if (type === 'familycard') { msg.fcRelation = ov.querySelector('#amFcRel').value.trim() || '亲人'; msg.fcAmount = parseFloat(ov.querySelector('#amFcAmt').value) || 0 }
      var currentRound = ch.rounds[ch.rounds.length - 1]
      if (!currentRound) { currentRound = { id: uid(), label: '第1轮', messages: [] }; ch.rounds.push(currentRound) }
      currentRound.messages.push(msg)
      save()
      ov.remove()
      renderChat()
    }
    ov.querySelector('#amCancel').onclick = function() { ov.remove() }
  }

  function addVoiceMessage() {
    var senderIds = ch.type === 'group' ? ch.contactIds.concat(['self']) : [ch.contactIds[0], 'self']
    var optionsHtml = senderIds.map(function(id) {
      if (id === 'self') return '<option value="self">读者</option>'
      var c = contacts.find(function(x) { return x.id === id })
      return '<option value="' + escapeHtmlAttribute(id) + '">' + esc(c ? c.name : '未知') + '</option>'
    }).join('')

    var ov = modal('语音消息',
      '<div class="form-group"><label class="form-label">语音内容（文字）</label><textarea id="vmText" class="form-textarea" placeholder="填写语音对应的文字内容" style="min-height:60px"></textarea></div>' +
      '<div class="form-group"><label class="form-label">发送者</label><select id="vmSender" class="form-select">' + optionsHtml + '</select></div>',
      '<button id="vmSave" class="btn btn-primary btn-sm">添加</button><button id="vmCancel" class="btn btn-ghost btn-sm">取消</button>')

    ov.querySelector('#vmSave').onclick = function() {
      var text = ov.querySelector('#vmText').value.trim()
      if (!text) return
      var duration = Math.max(1, Math.round(text.length * 0.3))
      var msg = {
        id: uid(), senderId: ov.querySelector('#vmSender').value,
        text: text, time: new Date().toLocaleString(), type: 'voice',
        duration: duration
      }
      var currentRound = ch.rounds[ch.rounds.length - 1]
      if (!currentRound) { currentRound = { id: uid(), label: '第1轮', messages: [] }; ch.rounds.push(currentRound) }
      currentRound.messages.push(msg)
      save()
      ov.remove()
      renderChat()
    }
    ov.querySelector('#vmCancel').onclick = function() { ov.remove() }
  }

  function showCallEditor(mode) {
    var shell = frame.querySelector('.chat-author-shell')
    if (!shell) return
    var existing = shell.querySelector('.chat-tool-sheet')
    if (existing) existing.remove()
    var defaultSender = activeSpeakerId !== 'self' && activeSpeakerId !== 'system'
      ? activeSpeakerId
      : ((ch.contactIds && ch.contactIds[0]) || 'self')
    var senderIds = (ch.contactIds || []).concat(['self'])
    var senderOptions = senderIds.map(function(senderId) {
      return '<option value="' + escapeHtmlAttribute(senderId) + '"' + (senderId === defaultSender ? ' selected' : '') + '>' + esc(getSpeakerName(senderId)) + '</option>'
    }).join('')
    var callLabel = mode === 'video' ? '视频通话' : '语音通话'
    var h = '<section class="chat-tool-sheet chat-call-editor" aria-label="编辑' + callLabel + '">'
    h += '<div class="chat-tool-head"><div><strong>' + callLabel + '</strong><small>每行是一句台词</small></div><button type="button" id="chatCallClose" aria-label="关闭通话编辑">×</button></div>'
    h += '<label class="chat-call-field"><span>通话角色</span><select id="chatCallSender">' + senderOptions + '</select></label>'
    h += '<label class="chat-call-field grow"><span>通话台词</span><textarea id="chatCallLines" placeholder="你先别说话，听我讲。&#10;那家花店今天开门了。"></textarea></label>'
    h += '<div class="chat-call-actions"><button type="button" id="chatCallCancel">取消</button><button type="button" id="chatCallSave">添加通话</button></div>'
    h += '</section>'
    shell.insertAdjacentHTML('beforeend', h)
    var panel = shell.querySelector('.chat-call-editor')
    panel.querySelector('#chatCallClose').onclick = function() { panel.remove() }
    panel.querySelector('#chatCallCancel').onclick = function() { panel.remove() }
    panel.querySelector('#chatCallSave').onclick = function() {
      var lines = panel.querySelector('#chatCallLines').value.split('\n').map(function(line) { return line.trim() }).filter(Boolean)
      if (!lines.length) {
        panel.querySelector('#chatCallLines').focus()
        return
      }
      var senderId = panel.querySelector('#chatCallSender').value || defaultSender
      currentRound().messages.push({
        id: uid(), type: 'call', callMode: mode, senderId: senderId,
        text: callLabel, callLines: lines, allowHangup: true,
        time: new Date().toLocaleString()
      })
      save()
      renderChat()
    }
    panel.querySelector('#chatCallLines').focus()
  }

  function showInlineStoryEditor(type, title, placeholder) {
    var shell = frame.querySelector('.chat-author-shell')
    if (!shell) return
    var existing = shell.querySelector('.chat-tool-sheet')
    if (existing) existing.remove()
    var h = '<section class="chat-tool-sheet chat-story-editor" aria-label="' + escapeHtmlAttribute(title) + '">'
    h += '<div class="chat-tool-head"><div><strong>' + esc(title) + '</strong><small>作者专用</small></div><button type="button" id="chatStoryClose" aria-label="关闭">×</button></div>'
    h += '<label class="chat-call-field grow"><span>内容</span><textarea id="chatStoryText" placeholder="' + escapeHtmlAttribute(placeholder) + '"></textarea></label>'
    h += '<div class="chat-call-actions"><button type="button" id="chatStoryCancel">取消</button><button type="button" id="chatStorySave">添加</button></div>'
    h += '</section>'
    shell.insertAdjacentHTML('beforeend', h)
    var panel = shell.querySelector('.chat-story-editor')
    panel.querySelector('#chatStoryClose').onclick = function() { panel.remove() }
    panel.querySelector('#chatStoryCancel').onclick = function() { panel.remove() }
    panel.querySelector('#chatStorySave').onclick = function() {
      var value = panel.querySelector('#chatStoryText').value.trim()
      if (!value) return
      var msg = type === 'time'
        ? { id: uid(), type: 'time', time: value }
        : { id: uid(), type: type, senderId: activeSpeakerId === 'system' ? 'self' : activeSpeakerId, text: value, time: new Date().toLocaleString() }
      if (type === 'location') msg.locationName = value
      currentRound().messages.push(msg)
      save()
      renderChat()
    }
    panel.querySelector('#chatStoryText').focus()
  }

  function showPlusMenu(page) {
    var shell = frame.querySelector('.chat-author-shell')
    if (!shell) return
    var existing = shell.querySelector('.chat-tool-sheet')
    if (existing) existing.remove()
    page = page === 1 ? 1 : 0
    var firstPage = [
      ['image', '▧', '图片'], ['voice-call', '☎', '语音通话'], ['video-call', '▣', '视频通话'], ['voice', '♪', '语音消息'],
      ['transfer', '¥', '转账'], ['location', '⌖', '位置'], ['time', '◷', '日期时间'], ['system', '!', '系统消息']
    ]
    var secondPage = [
      ['link', '↗', '链接'], ['redpacket', '封', '红包'], ['familycard', '卡', '亲属卡'], ['round', 'Ⅱ', '结束此轮']
    ]
    var tools = page === 0 ? firstPage : secondPage
    var h = '<section class="chat-tool-sheet" aria-label="添加剧情内容">'
    h += '<div class="chat-tool-head"><div><strong>＋ 添加剧情内容</strong><small>作者专用</small></div><button type="button" id="chatToolClose" aria-label="关闭剧情工具">×</button></div>'
    h += '<div class="chat-tool-grid">'
    tools.forEach(function(tool) {
      h += '<button type="button" class="chat-tool" data-chat-tool="' + tool[0] + '"><span class="chat-tool-icon">' + tool[1] + '</span><span>' + tool[2] + '</span></button>'
    })

    h += '</div>'
    h += '<div class="chat-tool-pager"><button type="button" id="chatToolPrev"' + (page === 0 ? ' disabled' : '') + ' aria-label="上一页">‹</button><span><b>' + (page === 0 ? '●' : '○') + '</b> ' + (page === 1 ? '●' : '○') + '</span><button type="button" id="chatToolNext"' + (page === 1 ? ' disabled' : '') + ' aria-label="下一页">›</button></div>'
    h += '</section>'
    shell.insertAdjacentHTML('beforeend', h)
    var sheet = shell.querySelector('.chat-tool-sheet')
    sheet.querySelector('#chatToolClose').onclick = function() { sheet.remove() }
    sheet.querySelector('#chatToolPrev').onclick = function() { showPlusMenu(0) }
    sheet.querySelector('#chatToolNext').onclick = function() { showPlusMenu(1) }

    function closeAnd(run) {
      sheet.remove()
      run()
    }
    function bindTool(name, handler) {
      var button = sheet.querySelector('[data-chat-tool="' + name + '"]')
      if (button) button.onclick = handler
    }
    bindTool('image', function() { closeAnd(function() { addMsg('image') }) })
    bindTool('voice-call', function() { showCallEditor('voice') })
    bindTool('video-call', function() { showCallEditor('video') })
    bindTool('voice', function() { closeAnd(addVoiceMessage) })
    bindTool('transfer', function() { closeAnd(function() { addMsg('transfer') }) })
    bindTool('location', function() { showInlineStoryEditor('location', '添加位置', '例如：旧城区 · 白石街 17 号') })
    bindTool('time', function() { showInlineStoryEditor('time', '添加日期时间', '例如：今天 09:38') })
    bindTool('system', function() {
      activeSpeakerId = 'system'
      renderChat()
      var input = frame.querySelector('#chatInput')
      if (input) input.focus()
    })
    bindTool('link', function() { closeAnd(function() { addMsg('link') }) })
    bindTool('redpacket', function() { closeAnd(function() { addMsg('redpacket') }) })
    bindTool('familycard', function() { closeAnd(function() { addMsg('familycard') }) })
    bindTool('round', function() {
      var num = ch.rounds.length + 1
      ch.rounds.push({ id: uid(), label: '第' + num + '轮', messages: [] })
      save()
      renderChat()
    })
  }

  function deleteRound(roundIdx) {
    ch.rounds.splice(roundIdx, 1)
    save()
    renderChat()
  }

  function deleteMessage(roundIdx, msgIdx) {
    ch.rounds[roundIdx].messages.splice(msgIdx, 1)
    if (ch.rounds[roundIdx].messages.length === 0 && ch.rounds.length > 1) {
      ch.rounds.splice(roundIdx, 1)
    }
    save()
    renderChat()
  }

  function getSpeakerName(senderId) {
    if (senderId === 'self') return '读者'
    if (senderId === 'system') return '系统'
    var contact = contacts.find(function(c) { return c.id === senderId })
    return contact ? contactDisplayName(contact, 'messages') : '未知'
  }

  function currentRound() {
    var round = ch.rounds[ch.rounds.length - 1]
    if (!round) {
      round = { id: uid(), label: '第1轮', messages: [] }
      ch.rounds.push(round)
    }
    return round
  }

  function renderChat() {
    var body = frame.querySelector('#chatContent')
    if (!body) return

    if (!ch.bgImage && frame.querySelector('#chatContent')) {
      var curBg = frame.querySelector('#chatContent').style.backgroundImage
      if (curBg && curBg !== 'none') ch.bgImage = curBg.replace(/url\(['"]?([^'"\)]*)['"]?\)/, '$1')
    }
    body.className = 'cu-body chat-panel-flex chat-author-shell'
    body.style.padding = ''
    body.style.background = ''
    if (ch.bgImage) body.style.backgroundImage = 'url(' + esc(ch.bgImage) + ')'
    else body.style.backgroundImage = ''
    body.style.backgroundSize = 'cover'
    body.style.backgroundPosition = 'center'

    var activeRound = currentRound()
    var roundLabel = activeRound.label || ('第' + ch.rounds.length + '轮')
    var h = '<div class="chat-author-status"><span>AUTHOR EDIT</span><span class="chat-save-state" id="chatSaveState">已保存</span></div>'
    h += '<div class="chat-round-header">'
    h += '<button id="chatBack" class="chat-round-control" type="button" aria-label="返回消息列表">‹</button>'
    h += '<div class="chat-round-title"><strong>' + esc(getChatName()) + '</strong><span>· ' + esc(roundLabel) + '</span></div>'
    h += '<button id="chatBgBtn" class="chat-round-control" type="button" aria-label="聊天外观与气泡样式">···</button>'
    h += '</div>'

    h += '<div class="chat-msg-area" id="chatMsgArea">'
    var messageCount = 0
    for (var ri = 0; ri < ch.rounds.length; ri++) {
      var round = ch.rounds[ri]
      if (round.messages.length === 0) continue
      messageCount += round.messages.length
      h += '<div class="chat-round-card" data-round-idx="' + ri + '"><div class="chat-round-body">'
      round.messages.forEach(function(msg, mi) {
        h += renderMessageBubble(msg, mi, ri)
      })
      h += '</div></div>'
      if (ri < ch.rounds.length - 1) {
        var nextRound = ch.rounds[ri + 1]
        h += '<div class="chat-round-divider" data-round-del="' + (ri + 1) + '">'
        h += '<div class="chat-round-divider-line"><span>' + esc(nextRound.label) + (nextRound.triggerer ? ' ' + esc(nextRound.triggerer) : '') + '</span></div>'
        h += '</div>'
      }
    }
    if (messageCount === 0) h += '<div class="chat-empty-cue"><span>01</span><p>选择发言人，写下这一轮的第一句。</p></div>'
    h += '</div>'

    h += '<div class="chat-author-controls">'
    h += '<div class="chat-speaker-strip" role="toolbar" aria-label="选择发言人">'
    h += '<button type="button" class="chat-speaker-btn' + (activeSpeakerId === 'self' ? ' active' : '') + '" data-speaker="reader" data-sender-id="self">读者</button>'
    ;(ch.contactIds || []).forEach(function(contactId) {
      h += '<button type="button" class="chat-speaker-btn' + (activeSpeakerId === contactId ? ' active' : '') + '" data-speaker="contact" data-sender-id="' + escapeHtmlAttribute(contactId) + '">' + esc(getSpeakerName(contactId)) + '</button>'
    })
    h += '<button type="button" class="chat-speaker-btn' + (activeSpeakerId === 'system' ? ' active' : '') + '" data-speaker="system" data-sender-id="system">系统</button>'
    h += '<button type="button" class="chat-speaker-btn add" data-speaker="add" aria-label="更多发言人">＋</button>'
    h += '</div>'
    h += '<div class="chat-input-bar chat-composer">'
    h += '<button class="chat-btn-icon" id="chatPlusBtn" type="button" aria-label="添加剧情内容">＋</button>'
    h += '<input id="chatInput" aria-label="消息内容" placeholder="' + escapeHtmlAttribute('以「' + getSpeakerName(activeSpeakerId) + '」添加消息…') + '">'
    h += '<button class="chat-send-btn" id="chatSendBtn" type="button">添加</button>'
    h += '</div>'
    h += '</div>'

    h += '<div class="chat-editor-modebar">'
    h += '<button type="button" id="chatModeBack" aria-label="返回消息列表">↶</button>'
    h += '<span>WYSIWYG EDITOR</span>'
    h += '<button type="button" id="chatModeSave" aria-label="确认保存">✓</button>'
    h += '</div>'

    body.innerHTML = h
    bindChatEvents()
  }

  function renderMessageBubble(msg, mi, ri) {
    if (msg.type === 'time') {
      return '<div class="chat-time-stamp">' + esc(msg.time || '') + '</div>'
    }
    var isSelf = msg.senderId === 'self'
    var showAsSelf = isSelf
    var senderName = isSelf ? '读者' : (contacts.find(function(c) { return c.id === msg.senderId }) || {}).name || '未知'
    var h = '<div class="chat-msg ' + (showAsSelf ? 'self' : 'other') + (msg.failed ? ' failed' : '') + '" data-ri="' + ri + '" data-mi="' + mi + '" style="position:relative">'
    if (msg.senderId !== 'self') {
      var sc = contacts.find(function(c) { return c.id === msg.senderId })
      var avatarBg = sc ? (sc.avatarUrl ? 'background-image:url(' + sc.avatarUrl + ');background-size:cover' : 'background:' + avatarColor(msg.senderId)) : 'background:var(--c-border)'
      h += '<div class="chat-avatar" style="' + escapeHtmlAttribute(avatarBg) + '">'
      if (!sc || !sc.avatarUrl) h += '<span>' + esc(senderName.charAt(0)) + '</span>'
      h += '</div>'
    }
    h += '<div style="min-width:0;max-width:100%">'
    if (msg.type === 'image') {
      h += '<div class="chat-bubble"><img src="' + escapeHtmlAttribute(msg.image || '') + '" style="max-width:120px;border-radius:4px" onerror="this.style.display=\'none\'"></div>'
    } else if (msg.type === 'link') {
      h += '<div class="chat-bubble" style="background:#e8f4e8;border:1px solid #b8d8b8"><div style="font-size:.72rem;font-weight:500">' + esc(msg.linkTitle || '链接') + '</div><div style="font-size:.62rem;color:var(--c-text2)">' + esc(msg.linkUrl || '') + '</div></div>'
    } else if (msg.type === 'redpacket') {
      h += '<div class="chat-bubble chat-payment-card chat-payment-redpacket rp-card"><div class="chat-payment-main rp-top"><div class="chat-payment-type">红包</div><div class="chat-payment-amount rp-amount">&yen;' + (msg.redpacketAmount || 0).toFixed(2) + '</div><div class="chat-payment-note rp-label">' + esc(msg.redpacketMsg || '恭喜发财') + '</div></div><div class="chat-payment-footer rp-bottom">微信红包</div></div>'
    } else if (msg.type === 'transfer') {
      h += '<div class="chat-bubble chat-payment-card chat-payment-transfer tf-card"><div class="chat-payment-main tf-row"><div class="chat-payment-type tf-type">转账</div><div class="chat-payment-amount tf-amount">&yen;' + (msg.transferAmount || 0).toFixed(2) + '</div><div class="chat-payment-note tf-note">' + esc(msg.transferNote || '请确认收款') + '</div></div><div class="chat-payment-footer">转账记录</div></div>'
    } else if (msg.type === 'familycard') {
      h += '<div class="chat-bubble fc-card">'
      h += '<div class="fc-head"><div class="fc-badge">亲属卡</div></div>'
      h += '<div class="fc-body"><div class="fc-rel">' + esc(msg.fcRelation || '亲人') + '</div><div class="fc-amount">&yen;' + ((msg.fcAmount || 0)).toFixed(2) + '</div></div>'
      h += '</div>'
    } else if (msg.type === 'call') {
      var callModeLabel = msg.callMode === 'video' ? 'VIDEO CALL' : 'VOICE CALL'
      h += '<div class="chat-bubble chat-call-card">'
      h += '<span class="chat-call-card-tag">' + callModeLabel + '</span>'
      h += '<strong>' + esc(senderName) + '</strong>'
      h += '<small>' + esc((msg.callLines && msg.callLines[0]) || '通话剧情') + '</small>'
      h += '</div>'
    } else if (msg.type === 'voice') {
      var dur = msg.duration || Math.max(1, Math.round((msg.text || '').length * 0.3))
      var barCount = Math.min(20, Math.max(4, Math.round(dur * 3)))
      var bars = ''
      for (var bi = 0; bi < barCount; bi++) {
        var bh = 4 + Math.abs(Math.sin(bi * 0.7 + 1.5)) * 14
        bars += '<rect x="' + (bi * 5) + '" y="' + (20 - bh) / 2 + '" width="3" height="' + bh + '" rx="1.5"/>'
      }
      h += '<div class="chat-bubble chat-voice-bubble" onclick="var t=this.querySelector(\'.chat-voice-text\');t.style.display=t.style.display==\'none\'?\'block\':\'none\'" style="cursor:pointer;min-width:100px">'
      h += '<svg class="chat-voice-wave" width="' + (barCount * 5 + 2) + '" height="20" viewBox="0 0 ' + (barCount * 5 + 2) + ' 20" style="fill:currentColor;opacity:.7">' + bars + '</svg>'
      h += '<span class="chat-voice-dur" style="font-size:.65rem;margin-left:4px;opacity:.6">' + dur + '"</span>'
      h += '<span class="chat-voice-text" style="display:none;font-size:.75rem;margin-top:4px;line-height:1.4">' + esc(msg.text || '') + '</span>'
      h += '</div>'
    } else {
      h += '<div class="chat-bubble">'
      if (msg.quoteId && msg.quoteText) {
        h += '<div style="font-size:.65rem;color:var(--c-text2);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--c-border)"><span style="opacity:.6">引用：</span>' + esc(msg.quoteText.substring(0, 50)) + '</div>'
      }
      h += esc(msg.text || '') + '</div>'
    }
    h += '</div>'
    if (msg.choices && msg.choices.length > 0) {
      h += '<div class="chat-choices">'
      msg.choices.forEach(function(c, cidx) {
        h += '<button type="button" class="chat-choice-btn" data-choice-ri="' + ri + '" data-choice-mi="' + mi + '" data-choice-ci="' + cidx + '" aria-label="编辑回复选项：' + escapeHtmlAttribute(c.text || '选项') + '">' + esc(c.text || '选项') + '</button>'
      })
      h += '</div>'
    }
    if (msg.failed) {
      h += '<svg class="chat-failed-icon" viewBox="0 0 20 20" width="16" height="16" style="flex-shrink:0;align-self:center;margin:0 2px;color:#DC2626"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="6" x2="10" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg>'
    }
    h += '</div>'
    return h
  }

  function bindChatEvents() {
    var backBtn = frame.querySelector('#chatBack')
    if (backBtn) backBtn.onclick = function() { openMessagesEditor(frame, wid, pd) }
    var modeBackBtn = frame.querySelector('#chatModeBack')
    if (modeBackBtn) modeBackBtn.onclick = function() { openMessagesEditor(frame, wid, pd) }
    var modeSaveBtn = frame.querySelector('#chatModeSave')
    if (modeSaveBtn) modeSaveBtn.onclick = function() {
      save()
      var state = frame.querySelector('#chatSaveState')
      if (state) state.textContent = '已保存'
    }

    var speakerButtons = frame.querySelectorAll('.chat-speaker-btn[data-sender-id]')
    speakerButtons.forEach(function(button) {
      button.onclick = function() {
        activeSpeakerId = button.dataset.senderId || 'self'
        speakerButtons.forEach(function(item) { item.classList.toggle('active', item === button) })
        var input = frame.querySelector('#chatInput')
        if (input) {
          input.placeholder = '以「' + getSpeakerName(activeSpeakerId) + '」添加消息…'
          input.focus()
        }
      }
    })

    var addSpeakerBtn = frame.querySelector('.chat-speaker-btn[data-speaker="add"]')
    if (addSpeakerBtn) addSpeakerBtn.onclick = function() {
      var available = ['self'].concat(ch.contactIds || [])
      var choices = available.map(function(senderId) {
        return '<button type="button" class="btn btn-sm btn-outline w-full chat-speaker-pick" data-sender-id="' + escapeHtmlAttribute(senderId) + '" style="display:block;width:100%;margin-bottom:6px">' + esc(getSpeakerName(senderId)) + '</button>'
      }).join('')
      choices += '<button type="button" class="btn btn-sm btn-outline w-full chat-speaker-pick" data-sender-id="system" style="display:block;width:100%">系统</button>'
      var ov = modal('选择发言人', choices, '<button type="button" id="speakerPickCancel" class="btn btn-ghost btn-sm">取消</button>')
      ov.querySelectorAll('.chat-speaker-pick').forEach(function(choice) {
        choice.onclick = function() {
          activeSpeakerId = choice.dataset.senderId || 'self'
          ov.remove()
          renderChat()
        }
      })
      ov.querySelector('#speakerPickCancel').onclick = function() { ov.remove() }
    }

    // Left plus button — opens the add-message-type menu
    var plusBtn = frame.querySelector('#chatPlusBtn')
    if (plusBtn) plusBtn.onclick = function() { showPlusMenu() }

    // Right add button — adds one complete authored message for the selected speaker.
    var sendBtn = frame.querySelector('#chatSendBtn')
    var chatInput = frame.querySelector('#chatInput')
    function sendTextMessage() {
      if (!chatInput) return
      var text = chatInput.value.trim()
      if (!text) return
      var msg = activeSpeakerId === 'system'
        ? { id: uid(), type: 'time', time: text }
        : { id: uid(), senderId: activeSpeakerId, text: text, time: new Date().toLocaleString(), type: 'text' }
      currentRound().messages.push(msg)
      save()
      chatInput.value = ''
      renderChat()
    }
    if (sendBtn) sendBtn.onclick = function() { sendTextMessage() }
    if (chatInput) {
      chatInput.addEventListener('input', function() {
        var state = frame.querySelector('#chatSaveState')
        if (state) state.textContent = chatInput.value.trim() ? '编辑中' : '已保存'
      })
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); sendTextMessage() }
      })
    }

    // Background / Bubble style button — SVG gear icon, opens style panel
    var bgBtn = frame.querySelector('#chatBgBtn')
    if (bgBtn) bgBtn.onclick = function() {
      if (!ch.bubbleStyle) ch.bubbleStyle = {}
      var bs = ch.bubbleStyle
      var h = '<div class="form-group"><label class="form-label">聊天背景图URL</label><input id="bgUrl" class="form-input" value="' + esc(ch.bgImage || '') + '" placeholder="https://..."></div>'
      h += '<div class="cu-section-title" style="margin-top:12px">我方气泡颜色</div>'
      h += '<input id="bsSelfColor" class="form-input" value="' + esc(bs.selfColor || '') + '" placeholder="#CEE5F6">'
      h += '<div class="cu-section-title" style="margin-top:8px">对方气泡颜色</div>'
      h += '<input id="bsOtherColor" class="form-input" value="' + esc(bs.otherColor || '') + '" placeholder="#F1DEEC">'
      h += '<div class="cu-section-title" style="margin-top:8px">气泡透明度 (0-1)</div>'
      h += '<input id="bsOpacity" class="form-input" type="number" min="0" max="1" step="0.05" value="' + (bs.opacity !== undefined ? bs.opacity : '1') + '" placeholder="1">'
      h += '<div class="cu-section-title" style="margin-top:8px">气泡圆角 (px)</div>'
      h += '<input id="bsRadius" class="form-input" type="number" min="0" max="30" value="' + (bs.borderRadius !== undefined ? bs.borderRadius : '8') + '" placeholder="8">'
      h += '<div class="cu-section-title" style="margin-top:8px">气泡字体颜色</div>'
      h += '<input id="bsTextColor" class="form-input" value="' + esc(bs.textColor || '') + '" placeholder="inherit">'
      var ov = modal('气泡样式 & 背景', h,
        '<button id="bsSave" class="btn btn-primary btn-sm">保存</button><button id="bsCancel" class="btn btn-ghost btn-sm">取消</button>')
      ov.querySelector('#bsSave').onclick = function() {
        ch.bgImage = ov.querySelector('#bgUrl').value.trim()
        bs.selfColor = ov.querySelector('#bsSelfColor').value.trim()
        bs.otherColor = ov.querySelector('#bsOtherColor').value.trim()
        bs.opacity = parseFloat(ov.querySelector('#bsOpacity').value)
        bs.borderRadius = parseInt(ov.querySelector('#bsRadius').value)
        bs.textColor = ov.querySelector('#bsTextColor').value.trim()
        if (isNaN(bs.opacity) || bs.opacity < 0) bs.opacity = 1
        if (isNaN(bs.borderRadius) || bs.borderRadius < 0) bs.borderRadius = 8
        save()
        ov.remove()
        applyBubbleStyle()
        renderChat()
      }
      ov.querySelector('#bsCancel').onclick = function() { ov.remove() }
    }

    // Context menu for messages (PC right-click / mobile long-press)
    var msgArea = frame.querySelector('#chatMsgArea')
    if (msgArea) {
      msgArea.addEventListener('contextmenu', function(e) {
        var msgEl = e.target.closest('.chat-msg')
        if (!msgEl) return
        e.preventDefault()
        var ri = parseInt(msgEl.dataset.ri)
        var mi = parseInt(msgEl.dataset.mi)
        if (isNaN(ri) || isNaN(mi)) return
        var round = ch.rounds[ri]
        if (!round) return
        var msg = round.messages[mi]
        if (!msg) return

        // Remove any existing popup
        var existing = frame.querySelector('.chat-ctx-menu')
        if (existing) existing.remove()

        var menu = document.createElement('div')
        menu.className = 'chat-ctx-menu'
        menu.style.cssText = 'position:fixed;z-index:2000;background:var(--c-surface);border:1px solid var(--c-border);box-shadow:0 2px 8px rgba(0,0,0,.15);min-width:130px;padding:2px 0;font-size:.75rem'
        menu.style.left = e.clientX + 'px'
        menu.style.top = e.clientY + 'px'

        function addItem(label, cb) {
          var el = document.createElement('div')
          el.textContent = label
          if (label.indexOf('选项') >= 0) el.dataset.chatAction = 'choices'
          el.style.cssText = 'padding:5px 14px;cursor:pointer;color:var(--c-text)'
          el.onmouseenter = function() { el.style.background = 'var(--c-surface2)' }
          el.onmouseleave = function() { el.style.background = '' }
          el.onclick = function() { menu.remove(); cb() }
          menu.appendChild(el)
          return el
        }

        addItem('编辑', function() {
          var ov = modal('编辑消息', '<div class="form-group"><textarea id="editMsgText" class="form-textarea" style="min-height:60px">' + esc(msg.text || '') + '</textarea></div>',
            '<button id="editMsgSave" class="btn btn-primary btn-sm">保存</button><button id="editMsgCancel" class="btn btn-ghost btn-sm">取消</button>')
          ov.querySelector('#editMsgSave').onclick = function() { msg.text = ov.querySelector('#editMsgText').value.trim(); save(); ov.remove(); renderChat() }
          ov.querySelector('#editMsgCancel').onclick = function() { ov.remove() }
        })

        addItem('引用', function() {
          var qId = msg.id
          var qText = msg.text || ''
          if (msg.type === 'image') qText = '[图片]'
          var ov = modal('引用消息', '<div style="font-size:.7rem;color:var(--c-text2);padding:4px 8px;background:var(--c-surface2);margin-bottom:8px">引用：' + esc(qText.substring(0, 40)) + '</div><div class="form-group"><textarea id="quoteMsgText" class="form-textarea" placeholder="回复内容" style="min-height:60px"></textarea></div>',
            '<button id="quoteMsgSave" class="btn btn-primary btn-sm">发送</button><button id="quoteMsgCancel" class="btn btn-ghost btn-sm">取消</button>')
          ov.querySelector('#quoteMsgSave').onclick = function() {
            var text = ov.querySelector('#quoteMsgText').value.trim()
            if (!text) return
            var newMsg = { id: uid(), senderId: msg.senderId, text: text, time: new Date().toLocaleString(), type: 'text', quoteId: qId, quoteText: qText }
            round.messages.push(newMsg)
            save(); ov.remove(); renderChat()
          }
          ov.querySelector('#quoteMsgCancel').onclick = function() { ov.remove() }
        })

        addItem('在前插入时间', function() {
          var ov = modal('插入时间', '<div class="form-group"><input id="insTimeVal" class="form-input" value="' + esc(new Date().toLocaleString().replace(/:\d{2}$/, '')) + '" placeholder="时间文本"></div>',
            '<button id="insTimeSave" class="btn btn-primary btn-sm">插入</button><button id="insTimeCancel" class="btn btn-ghost btn-sm">取消</button>')
          ov.querySelector('#insTimeSave').onclick = function() {
            var timeText = ov.querySelector('#insTimeVal').value.trim()
            if (!timeText) return
            var timeMsg = { id: uid(), senderId: 'system', text: '', time: timeText, type: 'time' }
            round.messages.splice(mi, 0, timeMsg)
            save(); ov.remove(); renderChat()
          }
          ov.querySelector('#insTimeCancel').onclick = function() { ov.remove() }
        })

        addItem('在前插入消息', function() {
          var ov = modal('插入消息', '<div class="form-group"><textarea id="insMsgText" class="form-textarea" placeholder="消息内容" style="min-height:60px"></textarea></div>',
            '<button id="insMsgSave" class="btn btn-primary btn-sm">插入</button><button id="insMsgCancel" class="btn btn-ghost btn-sm">取消</button>')
          ov.querySelector('#insMsgSave').onclick = function() {
            var text = ov.querySelector('#insMsgText').value.trim()
            if (!text) return
            var newMsg = { id: uid(), senderId: msg.senderId, text: text, time: new Date().toLocaleString(), type: 'text' }
            round.messages.splice(mi, 0, newMsg)
            save(); ov.remove(); renderChat()
          }
          ov.querySelector('#insMsgCancel').onclick = function() { ov.remove() }
        })

        addItem('添加选项', function() {
          var choiceGroups = []
          if (msg.choices && msg.choices.length) {
            msg.choices.forEach(function(c) {
              choiceGroups.push({
                id: c.id || '',
                text: c.text || '',
                replyText: c.replyText || '',
                followUpLines: c.followUpMessages ? c.followUpMessages.map(function(fm) { return fm.text || fm.content || '' }).join('\n') : ''
              })
            })
          }
          if (choiceGroups.length === 0) choiceGroups.push({ id: '', text: '', replyText: '', followUpLines: '' })

          function renderGroups() {
            var listEl = document.getElementById('chGroupsList')
            if (!listEl) return
            // Collect current values from DOM before rebuilding
            var curTexts = listEl.querySelectorAll('.ch-grp-text')
            var curReplies = listEl.querySelectorAll('.ch-grp-reply')
            var curFollows = listEl.querySelectorAll('.ch-grp-follow')
            for (var si = 0; si < curTexts.length && si < choiceGroups.length; si++) {
              choiceGroups[si].text = curTexts[si].value || ''
              choiceGroups[si].replyText = curReplies[si] ? curReplies[si].value : ''
              choiceGroups[si].followUpLines = curFollows[si] ? curFollows[si].value : ''
            }
            var h = ''
            for (var gi = 0; gi < choiceGroups.length; gi++) {
              var g = choiceGroups[gi]
              h += '<div style="border:1px solid var(--c-border);padding:8px;margin-bottom:6px;position:relative">'
              h += '<div style="font-size:.7rem;color:var(--c-text2);margin-bottom:4px">选项组 ' + (gi + 1) + '</div>'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">选项文本</label>'
              h += '<input class="ch-grp-text" value="' + esc(g.text) + '" placeholder="选项描述" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);margin-bottom:4px">'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">读者回复</label>'
              h += '<input class="ch-grp-reply" value="' + esc(g.replyText) + '" placeholder="选中后读者的回复" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);margin-bottom:4px">'
              h += '<label style="font-size:.7rem;color:var(--c-text2)">角色后续回复（每行=一个气泡）</label>'
              h += '<textarea class="ch-grp-follow" placeholder="每行一条消息" style="width:100%;padding:4px 8px;font-size:.75rem;border:1px solid var(--c-border);min-height:50px">' + esc(g.followUpLines) + '</textarea>'
              h += '<button class="ch-grp-del" data-ch-grp-idx="' + gi + '" style="position:absolute;top:4px;right:4px;border:none;background:transparent;color:var(--c-text2);cursor:pointer;font-size:.7rem">x</button>'
              h += '</div>'
            }
            listEl.innerHTML = h
            // Re-bind delete buttons
            var dels = listEl.querySelectorAll('.ch-grp-del')
            dels.forEach(function(btn) {
              btn.onclick = function() {
                var idx = parseInt(btn.dataset.chGrpIdx)
                if (choiceGroups.length > 1) {
                  choiceGroups.splice(idx, 1)
                  renderGroups()
                }
              }
            })
          }

          var h2 = '<div id="chGroupsList" style="max-height:50vh;overflow-y:auto;margin-bottom:8px"></div>'
          h2 += '<button id="chAddGroup" class="btn btn-sm btn-outline" style="width:100%">+ 添加选项组</button>'
          var ov = modal('添加分支选项', h2,
            '<button id="chSave" class="btn btn-primary btn-sm">保存</button><button id="chCancel" class="btn btn-ghost btn-sm">取消</button>')
          renderGroups()

          ov.querySelector('#chAddGroup').onclick = function() {
            choiceGroups.push({ id: '', text: '', replyText: '', followUpLines: '' })
            renderGroups()
          }

          ov.querySelector('#chSave').onclick = function() {
            // Collect from DOM
            var listEl = ov.querySelector('#chGroupsList')
            if (!listEl) return
            var texts = listEl.querySelectorAll('.ch-grp-text')
            var replies = listEl.querySelectorAll('.ch-grp-reply')
            var follows = listEl.querySelectorAll('.ch-grp-follow')
            var previousChoices = Array.isArray(msg.choices) ? msg.choices : []
            var nextChoices = []
            for (var i = 0; i < texts.length; i++) {
              var grpText = (texts[i].value || '').trim()
              if (!grpText) continue
              var replyText = (replies[i] ? replies[i].value : '').trim()
              var followLines = (follows[i] ? follows[i].value : '').split('\n').filter(function(l) { return l.trim() })
              var groupId = choiceGroups[i]?.id || ''
              var previousChoice = previousChoices.find(function(choice) { return groupId && choice.id === groupId })
              var previousFollowUps = Array.isArray(previousChoice?.followUpMessages) ? previousChoice.followUpMessages : []
              var fms = followLines.map(function(line, lineIndex) {
                var previousFollowUp = previousFollowUps[lineIndex]
                return Object.assign({}, previousFollowUp || {}, {
                  id: previousFollowUp?.id || uid(),
                  senderId: previousFollowUp?.senderId || ch.contactIds[0] || 'self',
                  text: line.trim(),
                  content: line.trim(),
                  type: previousFollowUp?.type || 'text',
                  time: previousFollowUp?.time || new Date().toLocaleString()
                })
              })
              var nextChoice = Object.assign({}, previousChoice || {}, {
                id: previousChoice?.id || uid(),
                text: grpText,
                replyText: replyText,
                followUpMessages: fms
              })
              delete nextChoice.used
              nextChoices.push(nextChoice)
            }
            msg.choices = nextChoices.length ? nextChoices : undefined
            save(); ov.remove(); renderChat()
          }
          ov.querySelector('#chCancel').onclick = function() { ov.remove() }
        })

        var failItem = addItem(msg.failed ? '✓ 取消失败' : '发送失败', function() {
          msg.failed = !msg.failed
          save(); renderChat()
        })

        var delItem = addItem('删除', function() {
          deleteMessage(ri, mi)
        })
        delItem.style.color = '#DC2626'

        document.body.appendChild(menu)
        // Auto-remove on outside click
        setTimeout(function() {
          document.addEventListener('click', function dismiss() { menu.remove(); document.removeEventListener('click', dismiss) })
        }, 0)
      })
    }

    // Choice button clicks (delegate from msgArea)
    msgArea.addEventListener('click', function(e) {
      var btn = e.target.closest('.chat-choice-btn')
      if (!btn) return
      e.preventDefault()
      var messageElement = btn.closest('.chat-msg')
      if (!messageElement) return
      messageElement.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX || 0,
        clientY: e.clientY || 0
      }))
      document.querySelector('.chat-ctx-menu [data-chat-action="choices"]')?.click()
    })

    var dividers = frame.querySelectorAll('.chat-round-divider')
    dividers.forEach(function(d) {
      d.onclick = function() { deleteRound(parseInt(d.dataset.roundDel)) }
    })

    applyBubbleStyle()
  }

  function applyBubbleStyle() {
    // Apply saved bubble styles to CSS variables via a <style> element
    var styleId = 'chatBubbleStyle_' + chatId
    var existing = document.getElementById(styleId)
    if (existing) existing.remove()
    if (!ch.bubbleStyle) return
    var bs = ch.bubbleStyle
    var css = ''
    if (bs.selfColor) css += '.chat-msg.self .chat-bubble{background:' + bs.selfColor + '!important;}'
    if (bs.otherColor) css += '.chat-msg.other .chat-bubble{background:' + bs.otherColor + '!important;}'
    if (bs.opacity !== undefined && bs.opacity !== 1) css += '.chat-bubble{opacity:' + bs.opacity + '!important;}'
    if (bs.borderRadius !== undefined && bs.borderRadius !== 8) {
      css += '.chat-msg.other .chat-bubble{border-radius:' + bs.borderRadius + 'px ' + bs.borderRadius + 'px ' + bs.borderRadius + 'px 2px!important;}'
      css += '.chat-msg.self .chat-bubble{border-radius:' + bs.borderRadius + 'px ' + bs.borderRadius + 'px 2px ' + bs.borderRadius + 'px!important;}'
    }
    if (bs.textColor) css += '.chat-bubble{color:' + bs.textColor + '!important;}'
    if (!css) return
    var styleEl = document.createElement('style')
    styleEl.id = styleId
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }

  var chatHtml = '<div class="cu-panel cu-panel-embedded" id="chatPanel">'
  chatHtml += '<div class="cu-body" id="chatContent"></div>'
  chatHtml += '</div>'
  frame.innerHTML = chatHtml
  renderChat()
}

/// ===== MEMO EDITOR (Apple‑Notes style, rich editing) =====
function openMemoEditor(frame, wid, contact, memos, pd) {
  var accent = avatarColor(contact.id || uid())
  var _activeEditor = null   // tracks which card was last focused

  function saveAll() {
    var cards = frame.querySelectorAll('.memo-card')
    var updated = []
    cards.forEach(function(card) {
      var editor = card.querySelector('.memo-editor')
      var id = card.dataset.memoId
      var existing = memos.find(function(m) { return m.id === id })
      if (editor && existing) {
        existing.content = editor.innerHTML
        existing.time = new Date().toLocaleString()
        updated.push(existing)
      }
    })
    pd.memos = pd.memos || []
    updated.forEach(function(u) {
      var idx = pd.memos.findIndex(function(m) { return m.id === u.id })
      if (idx >= 0) pd.memos[idx] = u
    })
    updateWork(wid, { phoneData: pd })
  }

  function addNewMemo() {
    var m = { id: uid(), contactId: contact.id, content: '', time: new Date().toLocaleString() }
    memos.push(m)
    pd.memos = pd.memos || []
    pd.memos.push(m)
    updateWork(wid, { phoneData: pd })
    renderMemos(memos)
  }

  function deleteMemo(memoId) {
    memos = memos.filter(function(m) { return m.id !== memoId })
    pd.memos = (pd.memos || []).filter(function(m) { return m.id !== memoId })
    updateWork(wid, { phoneData: pd })
    renderMemos(memos)
  }

  function toggleCheck(dot, line) {
    dot.classList.toggle('checked')
    line.classList.toggle('checked')
    saveAll()
  }

  function insertChecklist(editor) {
    editor.focus()
    var line = document.createElement('div')
    line.className = 'check-line'
    var dot = document.createElement('span')
    dot.className = 'check-dot'
    dot.setAttribute('contenteditable', 'false')
    dot.textContent = '\u2713'
    dot.addEventListener('mousedown', function(e) {
      e.preventDefault()
      toggleCheck(dot, line)
    })
    line.appendChild(dot)
    // Append a text node so the cursor can land right after the dot
    line.appendChild(document.createTextNode('\u200B'))
    editor.appendChild(line)
    // Place cursor after the zero‑width space
    var sel = document.getSelection()
    var r = document.createRange()
    r.setStartAfter(dot)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    saveAll()
  }

  function insertNumbered(editor, startNum) {
    editor.focus()
    var line = document.createElement('div')
    line.className = 'num-line'
    var label = document.createElement('span')
    label.className = 'num-label'
    label.setAttribute('contenteditable', 'false')
    label.textContent = startNum + '.'
    var text = document.createElement('span')
    text.className = 'num-text'
    line.appendChild(label)
    line.appendChild(text)
    editor.appendChild(line)
    text.focus()
    var sel = document.getSelection()
    var r = document.createRange()
    r.setStart(text, 0)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    saveAll()
  }

  function renderMemos(currentMemos) {
    memos = currentMemos
    var panel = frame.querySelector('#memoPanel')
    var body = panel ? panel.querySelector('.cu-body') : null
    if (!body) return

    var h = ''
    if (memos.length === 0) {
      h = '<div class="pf-empty">\u6682\u65e0\u5907\u5fd8\u5f55</div>'
    }
    for (var i = 0; i < memos.length; i++) {
      var m = memos[i]
      h += '<div class="memo-card" data-memo-id="' + m.id + '" style="--memo-accent:' + accent + '">'
      h += '<div class="memo-editor" contenteditable="true" data-memo-id="' + m.id + '">'
      h += (m.content || '')
      h += '</div>'
      h += '<div class="memo-card-foot">'
      h += '<span>' + esc(m.time || '') + '</span>'
      h += '<button data-memo-del="' + m.id + '">\u2715 \u5220\u9664</button>'
      h += '</div>'
      h += '</div>'
    }
    body.innerHTML = h

    // Re-apply contenteditable=false and bind mousedown on all non-editable bits
    body.querySelectorAll('.check-dot, .num-label').forEach(function(el) {
      el.setAttribute('contenteditable', 'false')
    })
    body.querySelectorAll('.check-dot').forEach(function(dot) {
      dot.addEventListener('mousedown', function(e) {
        e.preventDefault()
        var line = dot.parentElement
        if (line && line.classList.contains('check-line')) {
          toggleCheck(dot, line)
        }
      })
    })

    // Bind editors – blur saves, focus tracks active editor
    var editors = body.querySelectorAll('.memo-editor')
    editors.forEach(function(ed) {
      ed.addEventListener('blur', function() { saveAll() })
      ed.addEventListener('focus', function() { _activeEditor = ed })
    })

    // Backspace helper: delete empty check‑line / num‑line naturally
    body.addEventListener('keydown', function(e) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      var sel = document.getSelection()
      if (!sel.rangeCount) return
      var range = sel.getRangeAt(0)
      var node = range.startContainer
      var line = node.nodeType === 3
        ? node.parentElement && node.parentElement.closest('.check-line, .num-line')
        : node.closest && node.closest('.check-line, .num-line')
      if (!line) return
      // Check if the line is effectively empty
      var textContent = line.textContent.replace(/\u200B/g, '').trim()
      if (textContent.length === 0 || textContent === '\u2713' || /^\d+\.$/.test(textContent)) {
        e.preventDefault()
        line.remove()
        saveAll()
      }
    })

    // Bind delete buttons
    var delBtns = body.querySelectorAll('[data-memo-del]')
    delBtns.forEach(function(btn) {
      btn.onclick = function() {
        var id = this.dataset.memoDel
        deleteMemo(id)
      }
    })
  }

  // Build initial HTML
  var h = '<div class="cu-panel cu-panel-embedded" id="memoPanel">'
  h += '<div class="cu-header" style="justify-content:space-between">'
  h += '<button type="button" class="cu-close-btn" id="memoBack" aria-label="返回">&larr;</button>'
  h += '<span class="cu-title" style="flex:1;text-align:center">' + esc(contact.name || '?') + ' \u00b7 \u5907\u5fd8\u5f55</span>'
  h += '<button class="cu-close-btn" id="memoAdd" title="\u65b0\u5efa">+</button></div>'
  h += '<div class="cu-body" id="memoBody" style="padding:10px 12px"></div>'
  h += '<div class="memo-toolbar" id="memoToolbar">'
  h += '<button data-memo-tool="check">\u2610 \u6e05\u5355</button>'
  h += '<button data-memo-tool="number">1. \u5e8f\u53f7</button>'
  h += '</div>'
  h += '</div>'

  frame.innerHTML = h
  renderMemos(memos)

  // Back button
  var backBtn = frame.querySelector('#memoBack')
  if (backBtn) {
    backBtn.onclick = function() { exitPhoneAppEditor(frame, wid, saveAll) }
  }

  // Add button
  var addBtn = frame.querySelector('#memoAdd')
  if (addBtn) addBtn.onclick = function() { addNewMemo() }

  // Toolbar buttons
  var toolbar = frame.querySelector('#memoToolbar')
  if (toolbar) {
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-memo-tool]')
      if (!btn) return
      var editor = _activeEditor || frame.querySelector('.memo-editor')
      if (!editor) return
      var tool = btn.dataset.memoTool
      if (tool === 'check') {
        insertChecklist(editor)
      } else if (tool === 'number') {
        // Show small inline popover for continue / restart numbering
        var existingPop = frame.querySelector('.num-choice-popover')
        if (existingPop) existingPop.remove()
        var pop = document.createElement('div')
        pop.className = 'num-choice-popover'
        pop.style.cssText = 'position:absolute;bottom:38px;left:10px;background:var(--c-surface);border:1px solid var(--c-border);padding:4px 0;z-index:50;box-shadow:var(--shadow-md);min-width:110px;font-size:.72rem;border-radius:0'
        var hasNumLines = editor.querySelector('.num-line')
        var maxN = 1
        if (hasNumLines) {
          var labels = editor.querySelectorAll('.num-label')
          maxN = labels.length + 1
        }
        pop.innerHTML =
          '<div data-num-act="continue" style="padding:5px 12px;cursor:pointer;color:var(--c-text)">\u7ee7\u7eed\u7f16\u53f7 (' + maxN + '.)</div>' +
          '<div data-num-act="restart" style="padding:5px 12px;cursor:pointer;color:var(--c-text)">\u91cd\u65b0\u7f16\u53f7 (1.)</div>' +
          '<div data-num-act="cancel" style="padding:5px 12px;cursor:pointer;color:var(--c-text2)">\u53d6\u6d88</div>'
        btn.parentNode.appendChild(pop)
        pop.addEventListener('click', function(pe) {
          var act = pe.target.dataset.numAct
          if (!act) return
          pop.remove()
          if (act === 'cancel') return
          var n = act === 'continue' ? maxN : 1
          insertNumbered(editor, n)
        })
        // Auto-dismiss on outside click
        setTimeout(function() {
          document.addEventListener('click', function dismiss(ev) {
            if (!pop.contains(ev.target) && ev.target !== btn) {
              pop.remove()
              document.removeEventListener('click', dismiss)
            }
          })
        }, 0)
      }
    })
  }
}


// ===== Settings Editor - Reading Flow (exact same pattern as Customize panel) =====
function openSettingsEditor(wid) {
  var w = getWork(wid)
  if (!w || !w.phoneData) return
  var pd = w.phoneData
  if (!pd.readingFlow) pd.readingFlow = { enabled: false, sequence: [] }
  pd.readingFlow.sequence = expandPhoneReadingFlowSequence(pd, pd.readingFlow.sequence)
  var flow = pd.readingFlow

  var frame = document.getElementById('phoneFrame')
  if (!frame) return
  var origHTML = frame.innerHTML
  frame.dataset._origHTML = origHTML
  frame.dataset._wid = wid

  function buildPanel() {
    // Build sequence from actual data
    var seq = flow.sequence.length > 0 ? flow.sequence : []
    if (seq.length === 0) {
      seq = flow.sequence = buildPhoneReadingFlowSequence(pd)
    }

    var typeLabels = { messages: '消息', forum: '论坛', memo: '备忘录', gallery: '相册', browser: '浏览记录', shopping: '购物', moments: '动态' }
    var typeColors = { messages: '#6366f1', forum: '#10b981', memo: '#f59e0b', gallery: '#ec4899', browser: '#3b82f6', shopping: '#f97316', moments: '#8b5cf6' }

    var h = '<div class="cu-panel cu-panel-embedded" id="settingsPanel">'
    h += '<div class="cu-header"><span class="cu-title">设置</span><button id="settingsClose" class="cu-close-btn">&times;</button></div>'
    h += '<div class="cu-body">'
    h += '<div class="st-row"><div><div class="st-label">阅读节奏控制</div><div class="st-desc">启用后可拖拽排序卡片，导出后读者将按序浏览</div></div>'
    h += '<label class="tgl-switch"><input type="checkbox" id="flowToggle"' + (flow.enabled ? ' checked' : '') + '><span class="tgl-slider"></span></label></div>'
    h += '<div style="margin-top:12px"><div style="font-size:.8rem;font-weight:500;margin-bottom:6px;color:var(--c-text)">卡片序列 (' + seq.length + ')</div>'
    h += '<div class="flow-list" id="flowList">'
    if (seq.length === 0) {
      h += '<div class="flow-empty">暂无卡片，请先在各子 App 中添加内容</div>'
    } else {
      for (var si = 0; si < seq.length; si++) {
        var item = seq[si]
        var color = typeColors[item.type] || '#64748b'
        var typeLabel = typeLabels[item.type] || item.type
        h += '<div class="flow-item" data-flow-idx="' + si + '" draggable="true">'
        h += '<div class="flow-icon" style="background:' + color + '">' + typeLabel.charAt(0) + '</div>'
        h += '<div class="flow-label"><div class="flow-title">' + esc(item.label || '') + '</div>'
        h += '<div class="flow-meta">' + typeLabel + '</div></div>'
        h += '<div class="flow-handle" draggable="true"></div></div>'
      }
    }
    h += '</div></div>'
    h += '</div>'
    h += '<div class="cu-footer"><button class="btn btn-sm btn-outline" id="flowRebuild">重建序列</button><button class="btn btn-sm btn-primary" id="flowSave">保存</button><button class="btn btn-sm btn-ghost" id="flowCancel">取消</button></div>'
    h += '</div>'
    return h
  }

  function buildFlowSequence() {
    var seq = []
    ;(pd.memos || []).forEach(function(m) {
      var c = (pd.contacts || []).find(function(x) { return x.id === m.contactId })
      seq.push({ type: 'memo', itemId: m.id, contactId: m.contactId, label: (c ? c.name + ' - ' : '') + (m.content || '').replace(/<[^>]*>/g, '').substring(0, 30) })
    })
    ;(pd.shoppingItems || []).forEach(function(s) {
      var c = (pd.contacts || []).find(function(x) { return x.id === s.contactId })
      seq.push({ type: 'shopping', itemId: s.id, contactId: s.contactId, label: (c ? c.name + ' - ' : '') + (s.name || '') })
    })
    ;(pd.forumPosts || []).forEach(function(p) {
      seq.push({ type: 'forum', itemId: p.id, contactId: p.contactId, label: (p.contactName || '') + ' - ' + (p.title || '').substring(0, 30) })
    })
    ;(pd.moments || []).forEach(function(m) {
      seq.push({ type: 'moments', itemId: m.id, contactId: m.contactId, label: (m.content || '').substring(0, 30) })
    })
    ;(pd.chats || []).forEach(function(ch) {
      if (ch.rounds) ch.rounds.forEach(function(round, ri) {
        var c = (pd.contacts || []).find(function(x) { return x.id === ch.contactIds[0] })
        seq.push({ type: 'messages', itemId: round.id, chatId: ch.id, contactId: ch.contactIds[0], label: (c ? c.name : '') + ' - 第' + (ri + 1) + '轮' })
      })
    })
    ;(pd.photos || []).forEach(function(p) {
      var c = (pd.contacts || []).find(function(x) { return x.id === p.contactId })
      seq.push({ type: 'gallery', itemId: p.id, contactId: p.contactId, label: (c ? c.name + ' - ' : '') + (p.caption || '').substring(0, 30) })
    })
    ;(pd.browserHistory || []).forEach(function(h) {
      var c = (pd.contacts || []).find(function(x) { return x.id === h.contactId })
      seq.push({ type: 'browser', itemId: h.id, contactId: h.contactId, label: (c ? c.name + ' - ' : '') + (h.title || '').substring(0, 30) })
    })
    return seq
  }

  frame.innerHTML = buildPanel()

  // ---- Bind all events (reusable after DOM rebuild) ----
  var restore = function() {
    if (document.activeElement) document.activeElement.blur()
    frame.style.pointerEvents = 'none'
    frame.style.display = 'none'
    frame.innerHTML = frame.dataset._origHTML || ''
    delete frame.dataset._origHTML
    frame.style.overflow = ''
    frame.style.padding = ''
    void frame.offsetHeight
    frame.style.display = ''
    requestAnimationFrame(function() {
      frame.style.pointerEvents = ''
      attachDrag(wid)
    })
  }

  _flowFrame = frame
  _flowWid = wid
  _flowPd = pd
  _flowDragItem = null

  function bindAll() {
    var toggle = frame.querySelector('#flowToggle')
    if (toggle) toggle.onchange = function() { flow.enabled = this.checked }

    var rebuildBtn = frame.querySelector('#flowRebuild')
    if (rebuildBtn) rebuildBtn.onclick = function() {
      flow.sequence = buildPhoneReadingFlowSequence(pd)
      frame.innerHTML = buildPanel()
      bindAll()
    }

    var closeBtn = frame.querySelector('#settingsClose')
    var cancelBtn = frame.querySelector('#flowCancel')
    if (closeBtn) closeBtn.onclick = restore
    if (cancelBtn) cancelBtn.onclick = restore

    var saveBtn = frame.querySelector('#flowSave')
    if (saveBtn) saveBtn.onclick = function() {
      pd.readingFlow = flow
      updateWork(wid, { phoneData: pd })
      showToast('设置已保存')
      restore()
    }

    // Drag handles
    var list = frame.querySelector('#flowList')
    if (list) {
      var items = list.querySelectorAll('.flow-item')
      items.forEach(function(item) {
        item.onmousedown = function(e) {
          if (e.button !== 0) return
          if (!flow.enabled) return
          e.preventDefault()
          _flowDragItem = item
          _flowDragStartY = e.clientY
          _flowDragOrigIdx = parseInt(item.dataset.flowIdx)
          item.classList.add('dragging')
          item.style.zIndex = '10'
        }
      })
    }
  }
  bindAll()

  // Global move/up handlers — only registered once
  if (!window.__flowDragInit) {
    window.__flowDragInit = true
    document.addEventListener('mousemove', function(e) {
      if (!_flowDragItem || !_flowFrame || !_flowPd) return
      var dy = e.clientY - _flowDragStartY
      if (Math.abs(dy) > 5) {
        _flowDragItem.style.transform = 'translateY(' + dy + 'px)'
        var list = _flowFrame.querySelector('#flowList')
        if (!list) return
        var itemHeight = _flowDragItem.offsetHeight + 4
        var offset = Math.round(dy / itemHeight)
        var fl = _flowPd.readingFlow
        if (!fl) return
        var targetIdx = Math.max(0, Math.min(fl.sequence.length - 1, _flowDragOrigIdx + offset))
        var allItems = list.querySelectorAll('.flow-item')
        allItems.forEach(function(it, i) {
          if (i === _flowDragOrigIdx) return
          var shift = false
          if (dy > 0 && i > _flowDragOrigIdx && i <= targetIdx) shift = true
          if (dy < 0 && i < _flowDragOrigIdx && i >= targetIdx) shift = true
          if (shift) {
            it.style.transform = 'translateY(' + (dy > 0 ? -itemHeight : itemHeight) + 'px)'
            it.style.transition = 'transform .15s'
          } else {
            it.style.transform = ''
            it.style.transition = ''
          }
        })
      }
    })
    document.addEventListener('mouseup', function() {
      if (!_flowDragItem || !_flowFrame || !_flowPd) return
      var actualDy = 0
      if (_flowDragItem.style.transform) {
        var match = _flowDragItem.style.transform.match(/translateY\((-?\d+)px\)/)
        if (match) actualDy = parseInt(match[1])
      }
      var list = _flowFrame.querySelector('#flowList')
      if (list) {
        var allItems = list.querySelectorAll('.flow-item')
        allItems.forEach(function(it) {
          it.style.transform = ''
          it.style.transition = ''
          it.classList.remove('dragging')
          it.style.zIndex = ''
        })
      }
      var fl = _flowPd.readingFlow
      if (fl && Math.abs(actualDy) > 5 && _flowDragOrigIdx >= 0) {
        var itemHeight = _flowDragItem.offsetHeight + 4
        var targetIdx = Math.round(actualDy / itemHeight) + _flowDragOrigIdx
        targetIdx = Math.max(0, Math.min(fl.sequence.length - 1, targetIdx))
        if (targetIdx !== _flowDragOrigIdx) {
          var moved = fl.sequence.splice(_flowDragOrigIdx, 1)[0]
          fl.sequence.splice(targetIdx, 0, moved)
        }
        _flowFrame.innerHTML = buildPanel()
        bindAll()
      }
      _flowDragItem = null
      _flowDragOrigIdx = -1
    })
  }
}


