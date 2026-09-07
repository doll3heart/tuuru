import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { escapeHtmlAttribute } from '../js/sanitize.js'

const source = readFileSync(new URL('../reader/reader.js', import.meta.url), 'utf8')

function imageCssUrl(value) {
  const start = source.indexOf('function readerPhoneImageCssUrl(')
  assert.ok(start >= 0, 'wallpaper URL serializer is missing')
  const end = source.indexOf('\n}', start) + 2
  return new Function(`${source.slice(start, end)}; return readerPhoneImageCssUrl`)()(value)
}

test('phone wallpaper URLs survive CSS and HTML serialization with exact signed query parameters', () => {
  const url = 'https://images.test/photo(1).png?token=fixture%2Bvalue&part=one%20two'
  const css = `background-image:${imageCssUrl(url)};background-size:cover`
  const dom = new JSDOM(`<div style="${escapeHtmlAttribute(css)}"></div>`)
  const element = dom.window.document.querySelector('div')
  assert.equal(element.style.backgroundImage, `url("${url}")`)
  assert.equal(element.style.backgroundSize, 'cover')
  assert.doesNotMatch(element.getAttribute('style'), /&amp;/)
  dom.window.close()
})

test('phone wallpaper serialization quotes CSS metacharacters without treating the URL as declarations', () => {
  assert.equal(imageCssUrl('https://images.test/a"\\\n\r\f.png'), 'url("https://images.test/a\\22 \\5c \\a \\d \\c .png")')
})

test('reader and export-preview wallpaper paths escape HTML only after URL serialization', () => {
  assert.match(source, /readerBgStyle \+= ';background-image:' \+ readerPhoneImageCssUrl\(skin\.wallpaperImage\)/)
  assert.match(source, /frameBgStyle \+= ';background-image:' \+ readerPhoneImageCssUrl\(ct\.wallpaperImage\)/)
  assert.doesNotMatch(source, /background-image:url\('\s*\+ esc\((?:skin|ct)\.wallpaperImage\)/)
})
