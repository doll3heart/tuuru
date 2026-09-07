const IMAGE_PROPERTIES = ['background-image', 'border-image-source', 'mask-image', '-webkit-mask-image', 'list-style-image', 'content']
const CSS_URL = /url\(\s*(?:"((?:\\[\s\S]|[^"\\])*)"|'((?:\\[\s\S]|[^'\\])*)'|((?:\\[\s\S]|[^)\\])*?))\s*\)/iy

function cssURLMatches(value) {
  const matches = []
  for (let index = 0; index < value.length;) {
    const character = value[index]
    // Quoted generated content is text, even when it contains "url(...)".
    if (character === '"' || character === "'") {
      index++
      while (index < value.length) {
        if (value[index] === '\\') { index += 2; continue }
        if (value[index++] === character) break
      }
      continue
    }
    CSS_URL.lastIndex = index
    const match = /[\w-]/.test(value[index - 1] || '') ? null : CSS_URL.exec(value)
    if (match) { matches.push(match); index += match[0].length }
    else index++
  }
  return matches
}

function imageError() {
  const error = new Error('图片无法读取，可能已失效、加载超时或不允许跨站读取。请检查网络，或将图片保存后重新上传，再重试。')
  error.name = 'PhoneExportImageError'
  return error
}

function abortError() {
  const error = new Error('已取消图片导出')
  error.name = 'AbortError'
  return error
}

function resourceURL(value, baseURI) {
  if (!value || /^(?:data:|#)/i.test(value)) return null
  try {
    const url = new URL(value, baseURI)
    return ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function decodeCssURL(value) {
  return value.replace(/\\([\da-f]{1,6})\s?|\\([\s\S])/gi, (_match, hex, character) => {
    if (!hex) return character
    const code = parseInt(hex, 16)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd'
  })
}

// The deadline covers the response body, FileReader and image decoding as well
// as the request. It rejects even if a browser operation ignores abort signals.
function readImage(url, doc, signal, timeoutMs) {
  const ownerWindow = doc.defaultView
  const controller = new AbortController()
  let reader, image, timer, onAbort
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (value, error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(value)
    }
    onAbort = () => {
      finish(null, abortError())
      controller.abort()
    }
    signal?.addEventListener('abort', onAbort, { once:true })
    if (signal?.aborted) { onAbort(); return }
    timer = setTimeout(() => {
      finish(null, imageError())
      controller.abort()
    }, timeoutMs)
    ;(async () => {
      try {
        const response = await ownerWindow.fetch(url, {
          mode:'cors', credentials:'same-origin', signal:controller.signal,
        })
        if (!response.ok) throw imageError()
        const blob = await response.blob()
        if (settled) return
        if (!blob.size) throw imageError()
        const content = await new Promise((resolveData, rejectData) => {
          reader = new ownerWindow.FileReader()
          reader.onload = () => resolveData(reader.result)
          reader.onerror = reader.onabort = () => rejectData(imageError())
          reader.readAsDataURL(blob)
        })
        if (settled) return
        const data = content + new URL(url).hash
        image = doc.createElement('img')
        if (typeof image.decode === 'function') {
          image.src = data
          await image.decode()
        } else {
          await new Promise((resolveImage, rejectImage) => {
            image.onload = resolveImage
            image.onerror = () => rejectImage(imageError())
            image.src = data
          })
        }
        finish(data)
      } catch {
        finish(null, signal?.aborted ? abortError() : imageError())
      }
    })()
  }).finally(() => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    controller.abort()
    if (reader?.readyState === 1) reader.abort()
    if (reader) reader.onload = reader.onerror = reader.onabort = null
    if (image) {
      image.onload = image.onerror = null
      image.removeAttribute('src')
    }
  })
}

// This function only receives the disposable, masked export viewport. It never
// edits document stylesheets or the live reader tree and keeps no global cache.
export function inlinePhoneExportImages(root, { signal, timeoutMs = 2500 } = {}) {
  if (signal?.aborted) throw abortError()
  const doc = root.ownerDocument
  const ownerWindow = doc.defaultView
  const targets = [], resources = new Set()
  const elements = [root, ...root.querySelectorAll('*')]
  for (const element of elements) {
    if (element.closest('[data-phone-export-ignore="true"]')) continue
    if (element.matches('img, svg image')) {
      const isHtml = element.tagName.toLowerCase() === 'img'
      const raw = isHtml ? (element.currentSrc || element.getAttribute('src'))
        : (element.getAttribute('href') || element.getAttribute('xlink:href'))
      const url = resourceURL(raw, doc.baseURI)
      if (url) {
        resources.add(url)
        targets.push({ apply(data) {
          if (isHtml) {
            element.removeAttribute('srcset')
            element.removeAttribute('sizes')
            // The live reader's inline onerror hides broken images. The export
            // has already decoded these bytes; it must not hide future errors.
            element.removeAttribute('onerror')
            element.setAttribute('src', data.get(url))
          } else {
            element.removeAttribute('xlink:href')
            element.setAttribute('href', data.get(url))
          }
        } })
      }
    }
    if (!element.style || typeof ownerWindow.getComputedStyle !== 'function') continue
    for (const pseudo of ownerWindow.CSS ? [null, '::before', '::after'] : [null]) {
      const style = ownerWindow.getComputedStyle(element, pseudo)
      if (pseudo && ['none', 'normal', ''].includes(style.getPropertyValue('content'))) continue
      for (const property of IMAGE_PROPERTIES) {
        const value = style.getPropertyValue(property)
        const matches = cssURLMatches(value).map(match => ({ match,
          url:resourceURL(decodeCssURL((match[1] ?? match[2] ?? match[3]).trim()), doc.baseURI),
        })).filter(item => item.url)
        if (!matches.length) continue
        for (const { url } of matches) resources.add(url)
        targets.push({ element, pseudo, property, apply(data) {
          let result = value
          for (const { match, url } of matches.reverse()) {
            result = result.slice(0, match.index) + `url("${data.get(url)}")` + result.slice(match.index + match[0].length)
          }
          return result
        } })
      }
    }
  }
  if (!resources.size) return null
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once:true })
  return (async () => {
    try {
      const data = new Map()
      const remaining = [...resources]
      // Avoid opening an unbounded number of fetches for an image-heavy panel.
      await Promise.all(Array.from({ length:Math.min(4, remaining.length) }, async () => {
        while (remaining.length) {
          const url = remaining.shift()
          data.set(url, await readImage(url, doc, controller.signal, timeoutMs))
        }
      }))
      if (signal?.aborted) throw abortError()
      const rules = []
      for (const [index, target] of targets.entries()) {
        const value = target.apply(data)
        if (!target.property) continue
        if (!target.pseudo) target.element.style.setProperty(target.property, value, 'important')
        else {
          const name = `data-phone-export-image-${index}`
          target.element.setAttribute(name, '')
          rules.push(`[${name}]${target.pseudo}{${target.property}:${value}!important}`)
        }
      }
      if (rules.length) {
        const style = doc.createElement('style')
        style.setAttribute('data-phone-export-images', '')
        style.textContent = rules.join('\n')
        root.appendChild(style)
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      controller.abort()
    }
  })()
}
