import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { inlinePhoneExportImages } from '../reader/phone-export-assets.js'
import { capturePhonePanelPages } from '../reader/phone-content-export.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/p8AAAAASUVORK5CYII=', 'base64')
function fixture(html) {
  const dom = new JSDOM(`<body><section id="source">${html}</section></body>`, { url:'https://reader.test/book/' })
  const { window } = dom
  const source = window.document.querySelector('#source')
  const clone = source.cloneNode(true)
  window.document.body.append(clone)
  const requests = []
  window.fetch = async (url, options) => {
    requests.push({ url, options })
    return { ok:true, blob:async () => new window.Blob([png], { type:'image/png' }) }
  }
  window.HTMLImageElement.prototype.decode = async function () {}
  return { dom, window, source, clone, requests }
}

test('inlines duplicate image and CSS resources once, preserving exact signed URLs and the live source', async () => {
  const url = 'https://images.test/photo.png?token=secret&amp;width=120'
  const f = fixture(`<img src="${url}" srcset="other.png 2x"><div style='background-image:url("https://images.test/photo.png?token=secret&width=120")'></div>`)
  const original = f.source.outerHTML
  await inlinePhoneExportImages(f.clone)
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].url, 'https://images.test/photo.png?token=secret&width=120')
  assert.equal(f.requests[0].options.mode, 'cors')
  assert.equal(f.requests[0].options.credentials, 'same-origin')
  assert.match(f.clone.querySelector('img').src, /^data:image\/png;base64,/)
  assert.equal(f.clone.querySelector('img').hasAttribute('srcset'), false)
  assert.match(f.clone.querySelector('div').style.backgroundImage, /data:image\/png;base64,/)
  assert.equal(f.source.outerHTML, original)
  f.dom.window.close()
})

test('handles relative and blob image URLs while leaving embedded images and local SVG fragments alone', async () => {
  const f = fixture('<img src="../photo.png?v=1"><img src="blob:https://reader.test/123"><img src="data:image/png;base64,AAA="><svg><image href="#local"/></svg>')
  await inlinePhoneExportImages(f.clone)
  assert.deepEqual(f.requests.map(request => request.url).sort(), ['blob:https://reader.test/123', 'https://reader.test/photo.png?v=1'].sort())
  assert.equal(f.clone.querySelector('svg image').getAttribute('href'), '#local')
  f.dom.window.close()
})

test('returns synchronously when there are no external resources', () => {
  const f = fixture('<p>content</p><img src="data:image/png;base64,AAA=">')
  assert.equal(inlinePhoneExportImages(f.clone), null)
  assert.equal(f.requests.length, 0)
  f.dom.window.close()
})

test('does not fetch images from controls explicitly excluded from export', () => {
  const f = fixture('<footer data-phone-export-ignore="true"><img src="https://images.test/composer.png"></footer>')
  assert.equal(inlinePhoneExportImages(f.clone), null)
  assert.equal(f.requests.length, 0)
  f.dom.window.close()
})

test('does not treat literal CSS content containing url(...) as an image', () => {
  const f = fixture('<span style=\'content:"url(https://not-an-image.test/help)"\'>label</span>')
  assert.match(f.window.getComputedStyle(f.clone.querySelector('span')).content, /url\(/)
  assert.equal(inlinePhoneExportImages(f.clone), null)
  assert.equal(f.requests.length, 0)
  f.dom.window.close()
})

test('preserves SVG image fragments when embedding image bytes', async () => {
  const f = fixture('<img src="https://images.test/art.svg#view-box">')
  await inlinePhoneExportImages(f.clone)
  assert.match(f.clone.querySelector('img').src, /^data:image\/png;base64,.*#view-box$/)
  f.dom.window.close()
})

for (const failure of ['cors', '404', 'empty', 'decode']) test(`rejects ${failure} without leaking image URL credentials`, async () => {
  const f = fixture('<img src="https://images.test/private.png?secret-token=123">')
  if (failure === 'cors') f.window.fetch = async () => { throw new TypeError('denied https://images.test/private.png?secret-token=123') }
  if (failure === '404') f.window.fetch = async () => ({ ok:false, status:404 })
  if (failure === 'empty') f.window.fetch = async () => ({ ok:true, blob:async () => new f.window.Blob([]) })
  if (failure === 'decode') f.window.HTMLImageElement.prototype.decode = async () => { throw new Error('decode failed') }
  await assert.rejects(inlinePhoneExportImages(f.clone), error => {
    assert.equal(error.name, 'PhoneExportImageError')
    assert.match(error.message, /图片无法读取/)
    assert.match(error.message, /重新上传/)
    assert.doesNotMatch(error.message, /secret-token|images.test/)
    return true
  })
  assert.match(f.clone.querySelector('img').src, /https:/, 'failed image must not be replaced with transparent success')
  f.dom.window.close()
})

test('bounds a hung response body and aborts its underlying request', async () => {
  const f = fixture('<img src="https://images.test/pending.png">')
  let requestSignal
  f.window.fetch = async (_url, options) => {
    requestSignal = options.signal
    return { ok:true, blob:() => new Promise(() => {}) }
  }
  await assert.rejects(inlinePhoneExportImages(f.clone, { timeoutMs:15 }), { name:'PhoneExportImageError' })
  assert.equal(requestSignal.aborted, true)
  f.dom.window.close()
})

test('bounds a hung decode and cleans the temporary decoder', async () => {
  const f = fixture('<img src="https://images.test/valid.png">')
  let decoder
  f.window.HTMLImageElement.prototype.decode = function () { decoder = this; return new Promise(() => {}) }
  await assert.rejects(inlinePhoneExportImages(f.clone, { timeoutMs:25 }), { name:'PhoneExportImageError' })
  assert.equal(decoder.hasAttribute('src'), false)
  f.dom.window.close()
})

test('aborts sibling requests on one failure and never applies a partial image rewrite', async () => {
  const f = fixture('<img src="https://images.test/bad.png"><img src="https://images.test/pending.png">')
  const original = f.clone.outerHTML
  let siblingSignal
  f.window.fetch = async (url, options) => {
    if (url.endsWith('bad.png')) throw new TypeError('denied')
    siblingSignal = options.signal
    return new Promise(() => {})
  }
  await assert.rejects(inlinePhoneExportImages(f.clone), { name:'PhoneExportImageError' })
  assert.equal(siblingSignal.aborted, true)
  assert.equal(f.clone.outerHTML, original)
  f.dom.window.close()
})

test('cancels in-flight preparation promptly and leaves the clone/source unchanged', async () => {
  const f = fixture('<img src="https://images.test/pending.png">')
  const controller = new AbortController()
  const original = f.clone.outerHTML
  let requestSignal
  f.window.fetch = (_url, options) => { requestSignal = options.signal; return new Promise(() => {}) }
  const pending = inlinePhoneExportImages(f.clone, { signal:controller.signal })
  controller.abort()
  await assert.rejects(pending, { name:'AbortError' })
  assert.equal(requestSignal.aborted, true)
  assert.equal(f.clone.outerHTML, original)
  f.dom.window.close()
})

test('inlines CSS border/mask and generated image content on clone-local rules', async () => {
  const f = fixture('<div class="skin" style="border-image-source:url(https://images.test/border.png);mask-image:url(https://images.test/mask.png)"></div>')
  const nativeStyle = f.window.getComputedStyle.bind(f.window)
  f.window.CSS = {}
  f.window.getComputedStyle = (node, pseudo) => {
    if (!pseudo) return nativeStyle(node)
    const style = f.window.document.createElement('span').style
    style.content = node.matches('.skin') && pseudo === '::before' ? 'url("https://images.test/decor.png")' : 'none'
    return style
  }
  await inlinePhoneExportImages(f.clone)
  const skin = f.clone.querySelector('.skin')
  assert.match(skin.style.getPropertyValue('border-image-source'), /data:image\/png/)
  assert.match(skin.style.getPropertyValue('mask-image'), /data:image\/png/)
  assert.match(f.clone.querySelector('style[data-phone-export-images]').textContent, /::before\{content:url\("data:image\/png/)
  assert.equal(f.requests.length, 3)
  assert.equal(f.source.querySelector('style'), null)
  f.dom.window.close()
})

test('a fresh preparation retries a formerly blocked resource instead of caching an empty placeholder', async () => {
  const f = fixture('<img src="https://images.test/retry.png">')
  const succeedingFetch = f.window.fetch
  f.window.fetch = async () => { throw new TypeError('blocked') }
  await assert.rejects(inlinePhoneExportImages(f.clone), { name:'PhoneExportImageError' })
  f.window.fetch = succeedingFetch
  await inlinePhoneExportImages(f.clone)
  assert.match(f.clone.querySelector('img').src, /^data:image\/png/)
  f.dom.window.close()
})

test('capture rejects external image failure before rasterizing and always removes its stage', async () => {
  const f = fixture('<img src="https://images.test/denied.png">')
  f.window.fetch = async () => { throw new TypeError('CORS') }
  let rasterCalls = 0
  await assert.rejects(capturePhonePanelPages(f.source, {
    rasterize:async () => { rasterCalls++; return new f.window.Blob(['png']) },
  }), { name:'PhoneExportImageError' })
  assert.equal(rasterCalls, 0)
  assert.equal(f.window.document.querySelector('.rd-phone-export-stage'), null)
  assert.match(f.source.querySelector('img').src, /https:/)
  f.dom.window.close()
})
