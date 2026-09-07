import { assertAuthorPhoneExportSnapshot, authorPhoneExportWork } from './author-phone-snapshot.js'
import { resolveEditorFontAssets } from './editor-font-storage.js'

// The controller owns a one-use capability on its iframe element, never a URL flag.
export async function createAuthorPhoneRenderAdapter(snapshot, {signal} = {}) {
  const session = assertAuthorPhoneExportSnapshot(snapshot)
  const work = authorPhoneExportWork(snapshot)
  delete work.readerPhValues
  const fontUrls = []
  let iframe
  let active = true
  let abort
  let timer
  const dispose = () => {
    active = false
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    iframe?.remove()
    fontUrls.forEach(url => URL.revokeObjectURL(url))
  }
  const check = () => {
    session.assertCurrent()
    if (signal?.aborted || !active) throw new DOMException('已取消图片导出','AbortError')
  }
  try {
    check()
    const fonts = work.editorSettings?.customFonts || []
    const resolvedFonts = await resolveEditorFontAssets(work.id, fonts)
    resolvedFonts.forEach(font => fontUrls.push(font.url))
    check()
    if (fonts.some(font => font.id && !font.data && !resolvedFonts.some(candidate => candidate.id === font.id))) {
      throw new Error('作品本地字体缺失，请回到编辑器检查字体后重试。')
    }
    iframe = document.createElement('iframe')
    iframe.setAttribute('data-author-phone-render-frame','')
    iframe.setAttribute('aria-hidden','true')
    iframe.tabIndex = -1
    iframe.title = '作者小手机图片渲染'
    iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:360px;height:800px;border:0;pointer-events:none'
    const ready = new Promise((resolve,reject) => {
      abort = () => {dispose();reject(new DOMException('已取消图片导出','AbortError'))}
      signal?.addEventListener('abort',abort,{once:true})
      timer = setTimeout(() => {dispose();reject(new Error('小手机渲染页加载超时，请重试。'))},30000)
      iframe.__tuuruAuthorPhoneRenderContext = Object.freeze({
        work, fonts:resolvedFonts.concat(fonts.filter(font => font.data)), assertCurrent:check,
        ready:adapter => {
          try {
            check()
            clearTimeout(timer)
            signal?.removeEventListener('abort',abort)
            resolve({...adapter,dispose})
          } catch (error) {dispose();reject(error)}
        },
        fail:error => {dispose();reject(error)},
      })
      iframe.src = new URL('./author-phone-render.html', window.location.href).href
      document.body.appendChild(iframe)
    })
    return await ready
  } catch (error) {
    dispose()
    throw error
  }
}
