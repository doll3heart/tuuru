// Loaded only by the acceptance Vite server; never imported by the reader build.
export function exportProbePlugin() {
  return {
    name:'phone-export-browser-probe', enforce:'pre',
    configResolved(config) {
      // One-shot acceptance never edits source. Watching the whole workspace
      // (including local toolchains/artifacts) can block Node during navigation.
      // Set this after config-file merging, which drops null inline overrides.
      config.server.watch = null
    },
    transform(source, id) {
      const filename = id.replaceAll('\\', '/').split('?')[0]
      if (filename.endsWith('/reader/reader.js')) {
        const original = 'if (authorPhoneRenderDocument) return normalizePhoneCustom(authorPhoneRenderCustom)'
        if (!source.includes(original)) throw new Error('Author-only renderer stress probe no longer matches')
        return source.replace(original, `if (authorPhoneRenderDocument) return normalizePhoneCustom(Object.assign({}, authorPhoneRenderCustom, window.__phoneExportRendererStress || {}))`)
      }
      if (!filename.endsWith('/reader/phone-content-export.js')) return
      const original = 'import { toBlob } from "html-to-image"'
      if (!source.includes(original)) throw new Error('Export probe no longer matches the real html-to-image import')
      return source.replace(original, `import { toBlob as realToBlob } from "html-to-image"
async function toBlob(node, options) {
  const ownerWindow = node.ownerDocument.defaultView
  if (typeof ownerWindow.__phoneExportBeforeRaster !== 'function') throw new Error('Missing browser export observer')
  await ownerWindow.__phoneExportBeforeRaster()
  return realToBlob(node, options)
}`)
    },
  }
}

// Executed in the isolated test page, not in Node.
export function measureExportPage() {
  const viewport = document.querySelector('.rd-phone-export-viewport')
  const panel = viewport.firstElementChild
  const phoneFrame = viewport.closest('.phone-frame')
  const rect = viewport.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const style = getComputedStyle(viewport)
  const top = Math.max(0, -new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42)
  const relative = element => {
    const r = element.getBoundingClientRect()
    return { x:r.left - rect.left, y:r.top - rect.top, width:r.width, height:r.height }
  }
  const nodes = [...panel.querySelectorAll('[data-message-id]')].filter(node => !node.parentElement.closest('[data-message-id]'))
  const rows = nodes.map(node => ({
    id:node.dataset.messageId, ...relative(node), text:node.textContent,
    contents:[...node.querySelectorAll('.rd-chat-message-body > *, .chat-avatar')].map(relative),
    bubbles:[...node.querySelectorAll('.chat-bubble:not(.rd-voice-message)')].map(bubble => {
      const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT)
      const lines = []
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const r of range.getClientRects()) if (r.width && r.height) lines.push({ x:r.left - rect.left, y:r.top - rect.top, width:r.width, height:r.height })
      }
      const css = getComputedStyle(bubble)
      const before = getComputedStyle(bubble, '::before')
      const after = getComputedStyle(bubble, '::after')
      return { ...relative(bubble), lines, fontFamily:css.fontFamily, fontSize:css.fontSize,
        letterSpacing:css.letterSpacing, backgroundImage:css.backgroundImage,
        boxShadow:css.boxShadow, textShadow:css.textShadow,
        beforeSize:before.fontSize, beforeContent:before.content,
        afterSize:after.fontSize, afterContent:after.content }
    }),
  }))
  return {
    width:rect.width, height:rect.height, top,
    contentHeight:rect.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth),
    panelHeight:panel.scrollHeight, panelOffset:panelRect.top - rect.top,
    borderTop:parseFloat(style.borderTopWidth), rows,
    skinCount:panel.querySelectorAll('.bubble-skin-full, .bubble-skin-slice').length,
    fonts:[...document.fonts].map(font => ({ family:font.family, status:font.status })),
    images:[...panel.querySelectorAll('img')].map(image => ({ complete:image.complete, width:image.naturalWidth,
      messageId:image.closest('[data-message-id]')?.dataset.messageId || null,
      source:image.src.startsWith('data:') ? image.src.slice(0, 32) : image.src,
      rect:relative(image) })),
    backgroundImages:[phoneFrame, ...panel.querySelectorAll('*')].filter(Boolean).map(element => getComputedStyle(element).backgroundImage)
      .filter(value => value && value !== 'none'),
  }
}
