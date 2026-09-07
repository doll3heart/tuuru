import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
const source = readFileSync(new URL('../reader/reader.js',import.meta.url),'utf8')
test('reader has no delivery dependency or batch planner', () => {
  assert.doesNotMatch(source,/downloadBlob|serializeReaderDataPackage|serializeReaderAppearancePackage|phone-content-export\.js|readerPhoneExportJobs|openReaderPhoneExportDialog/)
})
test('reader keeps import controls and removes all export controls', async t => {
  const dom = new JSDOM('<div id="app"></div>',{url:'http://localhost/reader/'})
  for (const key of ['window','document','localStorage','sessionStorage','Element','HTMLElement','Node','Event','MouseEvent','MutationObserver','FileReader']) globalThis[key] = key === 'window' ? dom.window : dom.window[key]
  globalThis.requestAnimationFrame = callback => {callback();return 1}
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  await import('../reader/reader.js?author-boundary')
  document.querySelector('[data-tab="library"]').click()
  assert.equal(document.querySelector('[data-reader-data-export]'),null)
  assert.equal(document.querySelector('[data-reader-phone-control="export"]'),null)
  assert.ok(document.querySelector('[data-reader-data-import]'))
  assert.doesNotMatch(source,/data-reader-appearance-export/)
  assert.match(source,/data-reader-appearance-import/)
})
