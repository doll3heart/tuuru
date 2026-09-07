import { readAuthorPhoneExportSnapshot } from './author-phone-snapshot.js'
import { exportAuthorPhoneContentImages, downloadAuthorPhoneContentImages } from './author-phone-export.js'

export function openAuthorPhoneExportDialog(workId, {modal:openModal, showToast, returnFocus} = {}) {
  let snapshot
  try { snapshot = readAuthorPhoneExportSnapshot(workId) }
  catch (error) { showToast(error.message, 'error'); return null }

  var body = '<div class="author-phone-export-intro">'
  body += '<span class="author-phone-export-mark" aria-hidden="true">PNG</span><div><strong>一次整理成可发布的图片包</strong><p>消息、动态、论坛、备忘录、相册、浏览记录、购物与联系人会按内容分别生成 PNG；过长内容自动分页。</p></div></div>'
  body += '<div class="author-phone-export-privacy"><span aria-hidden="true">▖▜▖▗</span><p><strong>仅导出当前创作库的作品</strong><br>不读取读者书架、回复进度或美化设置；占位符内容和主角头像自动打码，NPC 与角色头像保持原样。</p></div>'
  body += '<p class="author-phone-export-note">图片将打包为一个 ZIP，文件名采用“作品名-模块-内容名”。图片失效、超时或禁止跨站读取时，会跳过受影响的聊天或模块并列出原因，其余内容仍可导出；选择全部分支时，非聊天模块仍各导出一次。</p>'
  body += '<fieldset class="author-phone-export-modes"><legend>聊天回复分支</legend>'
  body += '<label class="author-phone-export-mode"><input type="radio" name="authorPhoneExportBranchMode" value="current" checked><span><strong>默认分支</strong><small>使用作者内容和默认选择，不读取读者的进度。</small></span></label>'
  body += '<label class="author-phone-export-mode"><input type="radio" name="authorPhoneExportBranchMode" value="all"><span><strong>全部分支</strong><small>每个聊天的可达回复路线分别成图、各自分页；最多 64 条。</small></span></label>'
  body += '</fieldset>'
  body += '<div class="author-phone-export-progress" id="authorPhoneExportProgress" data-author-phone-export-progress role="status" aria-live="polite"><span class="author-phone-export-progress-label">准备就绪</span><span class="author-phone-export-progress-count">尚未开始</span><span class="author-phone-export-progress-track"><span></span></span></div>'
  body += '<details class="author-phone-export-failures" id="authorPhoneExportFailures" data-author-phone-export-failures hidden><summary>查看未导出的项目</summary><ul></ul></details>'
  var modal = openModal('导出小手机图片', body,
    '<button type="button" class="btn btn-outline" data-author-phone-export-cancel>关闭</button><button type="button" class="btn btn-primary" data-author-phone-export-start>开始导出</button>',
    function() { if (controller) controller.abort() },
  )
  modal.querySelector('.modal')?.classList.add('author-phone-export-dialog')
  var exportButton = modal.querySelector('[data-author-phone-export-start]')
  var cancelButton = modal.querySelector('[data-author-phone-export-cancel]')
  var progress = modal.querySelector('#authorPhoneExportProgress')
  var progressLabel = progress?.querySelector('.author-phone-export-progress-label')
  var progressCount = progress?.querySelector('.author-phone-export-progress-count')
  var progressBar = progress?.querySelector('.author-phone-export-progress-track span')
  var failureDetails = modal.querySelector('#authorPhoneExportFailures')
  var failureList = failureDetails?.querySelector('ul')
  var modeInputs = Array.from(modal.querySelectorAll('input[name="authorPhoneExportBranchMode"]'))
  var controller = null
  var busy = false
  cancelButton.textContent = '关闭'

  function updateExportButtonLabel() {
    var selectedMode = modeInputs.find(function(input) { return input.checked })
    exportButton.textContent = selectedMode?.value === 'all'
      ? '导出全部分支'
      : '导出默认分支'
  }

  modeInputs.forEach(function(input) {
    input.addEventListener('change', updateExportButtonLabel)
  })
  updateExportButtonLabel()

  function updateProgress(event) {
    if (!progress || !event) return
    var percent = event.phase === 'archive' ? 100 : Math.max(4, Math.round(event.current / Math.max(1, event.total) * 92))
    progress.dataset.state = event.phase
    if (progressLabel) progressLabel.textContent = event.label || '正在生成图片'
    if (progressCount) {
      progressCount.textContent = event.phase === 'capture' && event.pages > 1
        ? event.current + ' / ' + event.total + ' · 第 ' + event.page + ' / ' + event.pages + ' 页'
        : event.current + ' / ' + event.total
    }
    if (progressBar) progressBar.style.width = percent + '%'
  }

  cancelButton.onclick = function() {
    if (busy && controller) controller.abort()
    modal.closeModal?.('cancel')
  }
  exportButton.onclick = async function() {
    if (busy) return
    var branchMode = modeInputs.find(function(input) { return input.checked })?.value === 'all' ? 'all' : 'current'
    busy = true
    controller = new AbortController()
    exportButton.disabled = true
    modeInputs.forEach(function(input) { input.disabled = true })
    exportButton.textContent = '正在生成…'
    cancelButton.textContent = '取消导出'
    progress.dataset.state = 'render'
    if (failureDetails) failureDetails.hidden = true
    if (failureList) failureList.replaceChildren()
    try {
      var result = await exportAuthorPhoneContentImages(snapshot, {
        branchMode:branchMode,
        signal:controller.signal,
        onProgress:updateProgress,
      })
      downloadAuthorPhoneContentImages(snapshot, result, {signal:controller.signal})
      progress.dataset.state = result.failures.length ? 'warning' : 'done'
      if (progressLabel) progressLabel.textContent = result.failures.length
        ? '部分导出：' + result.failures.length + ' 项未包含在图片包中'
        : '图片包已生成并开始下载'
      if (progressCount) progressCount.textContent = result.files.length + ' 张 PNG'
      if (progressBar) progressBar.style.width = '100%'
      if (result.failures.length && failureDetails && failureList) {
        result.failures.forEach(function(failure) {
          var item = document.createElement('li')
          item.textContent = failure.label + '：' + failure.message
          failureList.appendChild(item)
        })
        failureDetails.hidden = false
        failureDetails.open = true
      }
      if (result.failures.length) showToast('部分导出：已保存 ' + result.files.length + ' 张图片，' + result.failures.length + ' 项未导出，请查看原因', 'warning')
      else showToast('已导出 ' + result.files.length + ' 张小手机图片')
    } catch (error) {
      var cancelled = error?.name === 'AbortError'
      progress.dataset.state = cancelled ? 'cancelled' : 'error'
      if (progressLabel) progressLabel.textContent = cancelled ? '已取消导出' : (error?.message || '图片导出失败')
      if (progressCount) progressCount.textContent = cancelled ? '没有保存文件' : '请重试'
      if (progressBar) progressBar.style.width = '0%'
      if (!cancelled) showToast(error?.message || '小手机图片导出失败', 'error')
    } finally {
      busy = false
      controller = null
      exportButton.disabled = false
      modeInputs.forEach(function(input) { input.disabled = false })
      updateExportButtonLabel()
      cancelButton.textContent = '关闭'
    }
  }
  return modal
}
