import { orderedChats } from './chat-order.js'
import { orderedForumPosts } from './forum-post-order.js'
import { enumeratePhoneStoryChatChoiceBranches } from './phone-story-state.js'
import { assertAuthorPhoneExportSnapshot, authorPhoneExportWork } from './author-phone-snapshot.js'
import { createAuthorPhoneRenderAdapter } from './author-phone-render.js'
import { downloadBlob } from './download.js'
import { waitForPhoneExportLayout } from '../reader/phone-export-layout.js'

const PHONE_EXPORT_MAX_CHAT_BRANCHES = 64

export function throwIfAuthorPhoneExportAborted(signal) {
  if (signal?.aborted) throw new DOMException('已取消图片导出', 'AbortError')
}

export function waitForAuthorPhoneLayout(frame, signal, scheduler = globalThis.window || globalThis) {
  return waitForPhoneExportLayout(frame?.ownerDocument, signal, scheduler)
}

function authorPhoneExportContactTargets(pd, items) {
  var contacts = Array.isArray(pd?.contacts) ? pd.contacts : []
  var itemList = Array.isArray(items) ? items : []
  if (!contacts.length) return itemList.length ? [{ contactIndex:undefined, contact:null, label:'全部' }] : []
  return contacts.map(function(contact, contactIndex) {
    return {
      contactIndex:contactIndex,
      contact:contact,
      label:String(contact?.name || '未命名').trim() || '未命名',
      count:itemList.filter(function(item) { return String(item?.contactId || '') === String(contact?.id || '') }).length,
    }
  }).filter(function(target) { return target.count > 0 })
}

function authorPhoneExportUniqueBaseName(work, descriptor, usedNames, maskValues, filenameHelpers) {
  var phoneExportBaseName = filenameHelpers.phoneExportBaseName
  var maskPhoneExportText = filenameHelpers.maskPhoneExportText
  var baseName = phoneExportBaseName({
    workTitle:maskPhoneExportText(work?.title || '作品', maskValues),
    moduleLabel:maskPhoneExportText(descriptor.moduleLabel, maskValues),
    itemLabel:maskPhoneExportText(descriptor.itemLabel, maskValues),
    unicodeSafeItemLabel:Array.isArray(descriptor.branchPath) && descriptor.branchPath.length > 0,
  })
  var count = (usedNames.get(baseName) || 0) + 1
  usedNames.set(baseName, count)
  return count === 1 ? baseName : baseName + '-' + count
}

export function authorPhoneExportJobs(adapter, snapshot, options) {
  assertAuthorPhoneExportSnapshot(snapshot)
  var pd = adapter.phoneData
  var exportFrame = adapter.frame
  var jobs = []
  var contacts = Array.isArray(pd.contacts) ? pd.contacts : []
  var chats = orderedChats(pd.chats || [])
  var branchMode = options?.branchMode === 'all' ? 'all' : 'current'
  var phoneExportBranchLabel = options?.phoneExportBranchLabel
  var liveSelections = new Map()
  var alternateChatJobCount = 0
  function throwChatBranchLimitError() {
    throw new Error('可导出的消息选项分支超过 64 条，请减少选项后重试，或改用“默认分支”。')
  }
  chats.forEach(function(chat) {
    var chatIndex = (pd.chats || []).indexOf(chat)
    var contact = chat.type === 'group'
      ? null
      : contacts.find(function(candidate) { return String(candidate.id) === String(chat.contactIds?.[0]) })
    var chatLabel = chat.type === 'group' ? (chat.groupName || '群聊') : (contact?.name || '未知联系人')
    if (branchMode === 'current') {
      jobs.push({
        moduleLabel:'消息',
        itemLabel:chatLabel,
        render:function() {
          adapter.renderChat(chat, chatIndex)
        },
      })
      return
    }

    var branchResult = enumeratePhoneStoryChatChoiceBranches(
      pd,
      chatIndex,
      liveSelections,
      { maxBranches:PHONE_EXPORT_MAX_CHAT_BRANCHES },
    )
    alternateChatJobCount += branchResult.branches.length
    if (
      branchResult.truncated === true
      || branchResult.reason === 'state-limit'
      || alternateChatJobCount > PHONE_EXPORT_MAX_CHAT_BRANCHES
    ) throwChatBranchLimitError()
    branchResult.branches.forEach(function(branch, branchIndex) {
      var branchLabel = typeof phoneExportBranchLabel === 'function'
        ? phoneExportBranchLabel(branch.path, branchIndex, branchResult.branches.length)
        : ''
      jobs.push({
        moduleLabel:'消息',
        itemLabel:branchLabel ? branchLabel + '-' + chatLabel : chatLabel,
        branchPath:branch.path,
        branchIndex:branchIndex,
        branchTotal:branchResult.branches.length,
        render:function() {
          adapter.renderChat(chat, chatIndex, branch.selections)
        },
      })
    })
  })

  if (Array.isArray(pd.moments) && pd.moments.length) {
    jobs.push({
      moduleLabel:'动态',
      itemLabel:'全部动态',
      render:function() {
        adapter.renderApp('messages', undefined)
        exportFrame.querySelector('[data-message-section="moments"]')?.click()
      },
    })
  }

  orderedForumPosts(pd.forumPosts || []).forEach(function(post) {
    var postIndex = (pd.forumPosts || []).indexOf(post)
    jobs.push({
      moduleLabel:'论坛',
      itemLabel:post.title || ('帖子-' + (postIndex + 1)),
      render:function() {
        adapter.renderForum(post.id, postIndex)
      },
    })
  })

  authorPhoneExportContactTargets(pd, pd.memos).forEach(function(target) {
    jobs.push({
      moduleLabel:'备忘录',
      itemLabel:target.label,
      render:function() {
        adapter.renderApp('memo', target.contactIndex)
      },
    })
  })

  authorPhoneExportContactTargets(pd, (pd.photos || []).concat(pd.albums || [])).forEach(function(target) {
    jobs.push({
      moduleLabel:'相册',
      itemLabel:target.label + '-总览',
      render:function() {
        adapter.renderApp('gallery', target.contactIndex)
      },
    })
    ;(pd.albums || []).filter(function(album) {
      return !target.contact || String(album?.contactId || '') === String(target.contact.id || '')
    }).forEach(function(album, albumIndex) {
      jobs.push({
        moduleLabel:'相册',
        itemLabel:target.label + '-' + (album.name || ('相册-' + (albumIndex + 1))),
        render:function() {
          adapter.renderApp('gallery', target.contactIndex)
          var albumButton = exportFrame.querySelectorAll('.rd-album[data-album-index]')[albumIndex]
          if (albumButton) albumButton.click()
        },
      })
    })
  })

  authorPhoneExportContactTargets(pd, pd.browserHistory).forEach(function(target) {
    jobs.push({
      moduleLabel:'浏览记录',
      itemLabel:target.label,
      render:function() {
        adapter.renderApp('browser', target.contactIndex)
      },
    })
  })

  authorPhoneExportContactTargets(pd, pd.shoppingItems).forEach(function(target) {
    var targetItems = (pd.shoppingItems || []).filter(function(item) {
      return !target.contact || String(item?.contactId || '') === String(target.contact.id || '')
    })
    if (targetItems.some(function(item) { return item.status !== 'order' })) {
      jobs.push({
        moduleLabel:'购物',
        itemLabel:target.label + '-购物车',
        render:function() {
          adapter.renderApp('shopping', target.contactIndex)
        },
      })
    }
    if (targetItems.some(function(item) { return item.status === 'order' })) {
      jobs.push({
        moduleLabel:'购物',
        itemLabel:target.label + '-订单',
        render:function() {
          adapter.renderApp('shopping', target.contactIndex)
          exportFrame.querySelector('#rdShopOrderTab')?.click()
        },
      })
    }
  })

  if (contacts.length) {
    jobs.push({
      moduleLabel:'联系人',
      itemLabel:'全部联系人',
      render:function() {
        adapter.renderApp('contacts', undefined)
      },
    })
  }
  return jobs
}


export async function exportAuthorPhoneContentImages(snapshot, options = {}) {
  const session = assertAuthorPhoneExportSnapshot(snapshot)
  const work = authorPhoneExportWork(snapshot)
  const check = () => {
    session.assertCurrent()
    throwIfAuthorPhoneExportAborted(options.signal)
  }
  check()
  const helpers = options.helpers || await import('../reader/phone-content-export.js')
  check()
  const adapter = await (options.createAdapter || createAuthorPhoneRenderAdapter)(snapshot, {signal:options.signal})
  const files = []
  const failures = []
  const usedNames = new Map()
  const maskValues = helpers.placeholderMaskValues(work.placeholders || [], {})
  try {
    check()
    const jobs = authorPhoneExportJobs(adapter, snapshot, {
      branchMode:options.branchMode,
      phoneExportBranchLabel:(path,index,total) => helpers.phoneExportBranchLabel(path,index,total,{maskValues}),
    })
    if (!jobs.length) throw new Error('当前作品还没有可导出的消息、帖子或记录')
    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      check()
      const job = jobs[jobIndex]
      const progress = {current:jobIndex + 1,total:jobs.length,label:job.moduleLabel + ' · ' + job.itemLabel}
      options.onProgress?.({...progress,phase:'render',files:files.length})
      check()
      try {
        job.render()
        await waitForAuthorPhoneLayout(adapter.frame, options.signal)
        check()
        const panel = adapter.frame.querySelector('.rd-phone-app-panel, .rd-forum-detail')
        if (!panel) throw new Error('模块没有生成可截图的内容')
        const pages = await helpers.capturePhonePanelPages(panel, {
          baseName:authorPhoneExportUniqueBaseName(work, job, usedNames, maskValues, helpers),
          maskValues,
          signal:options.signal,
          layoutScheduler:globalThis.window || globalThis,
          onPage:page => options.onProgress?.({...progress,phase:'capture',page:page.page,pages:page.total,files:files.length + page.page}),
        })
        check()
        files.push(...pages)
      } catch (error) {
        // A changed/deleted work is fatal, including when an asset failed concurrently.
        check()
        if (error?.name === 'AbortError' || error?.name === 'AuthorPhoneContextError') throw error
        failures.push({label:progress.label,message:error?.message || '生成失败'})
      }
    }
  } finally {
    adapter.dispose()
  }
  check()
  if (!files.length) throw new Error(failures[0]?.message || '没有成功生成任何小手机图片')
  options.onProgress?.({phase:'archive',current:files.length,total:files.length,label:'正在整理 ZIP',files:files.length})
  check()
  const blob = await helpers.createPhoneContentArchive(files)
  check()
  return {blob,filename:helpers.phoneExportArchiveName(helpers.maskPhoneExportText(work.title,maskValues),options.branchMode),files,failures}
}

export function downloadAuthorPhoneContentImages(snapshot, result, {signal, download = downloadBlob} = {}) {
  assertAuthorPhoneExportSnapshot(snapshot)
  throwIfAuthorPhoneExportAborted(signal)
  download(result.blob, result.filename)
}
