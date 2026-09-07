import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { CASES, buildFixture, authorFixtureSeed, readerPoisonWork } from '../browser-tests/phone-export/fixture.mjs'
import { installExportStorageGuard } from '../browser-tests/phone-export/author-workflow.mjs'

const starterSource = async () => readFile(new URL('../browser-tests/phone-export/preview-starter.mjs', import.meta.url), 'utf8')

test('author seed uses canonical author library only and stress fields never become authored fields', () => {
  for (const scenario of CASES) {
    const fixture = buildFixture(scenario)
    const seed = authorFixtureSeed(fixture.work)
    assert.equal(Object.keys(seed).length, 2)
    assert.ok(Object.keys(seed).every(key => !key.startsWith('moirain_')))
    assert.equal(JSON.parse(seed.tuuru_works).works[0].id, fixture.work.id)
    for (const key of ['appSettings', 'customCss', 'customFonts']) assert.equal(fixture.work.phoneData.skin[key], undefined)
    assert.equal(fixture.custom, undefined, 'reader custom must not masquerade as author fixture')
    assert.ok(fixture.rendererStress)
  }
})

test('reader poison remains distinct and small even when authored work contains large local fonts',()=>{
  const {work}=buildFixture(CASES[0])
  work.editorSettings={customFonts:[{name:'Large font',data:'a'.repeat(2_000_000)}]}
  const poison=readerPoisonWork(work)
  assert.equal(poison.id,work.id)
  assert.match(JSON.stringify(poison),/PRIVATE_READER_CONTENT/)
  assert.equal(poison.editorSettings,undefined)
  assert.ok(JSON.stringify(poison).length<1000)
})

test('starter is explicitly author-test only and navigates author home', async () => {
  const { previewStarterHtml } = await import('../browser-tests/phone-export/preview-starter.mjs')
  const html = previewStarterHtml()
  assert.match(html, /作者测试库/)
  assert.match(html, /默认分支/)
  assert.doesNotMatch(html, /href="\/reader\/"|assign\('\/reader\/'/)
  assert.match(html, /location.assign\('\/'\)/)
})

async function runStarter({ existing = {}, seed, failAt, hostname = '127.0.0.1' } = {}) {
  await starterSource()
  const { previewStarterHtml } = await import('../browser-tests/phone-export/preview-starter.mjs')
  const dom = new JSDOM(previewStarterHtml(), { url:`https://${hostname}/phone-export-test.html`, runScripts:'dangerously' })
  const { window } = dom
  for (const [key,value] of Object.entries(existing)) window.localStorage.setItem(key,value)
  window.fetch = async () => ({ok:true,json:async()=>seed || authorFixtureSeed(buildFixture(CASES[0]).work)})
  let writes = 0
  const set = window.Storage.prototype.setItem
  window.Storage.prototype.setItem = function(key,value) {
    if (++writes === failAt) throw new Error('simulated quota error')
    return set.call(this,key,value)
  }
  window.document.querySelector('#start').click()
  await new Promise(resolve=>setTimeout(resolve,20))
  const result = {status:window.document.querySelector('#status').textContent, storage:{...window.localStorage}, writes}
  dom.window.close()
  return result
}

test('starter refuses any existing author DB or reader creative data without overwriting', async () => {
  for (const key of ['tuuru_works','moirain_work_existing','moirain_readerLibrary','moirain_phoneCustom']) {
    const existing = {[key]:'private sentinel'}
    const result = await runStarter({existing})
    assert.match(result.status,/已检测到/)
    assert.deepEqual(result.storage,existing)
    assert.equal(result.writes,0)
  }
})

test('starter rolls back after a real first write and restores pre-existing announcement', async () => {
  const seed = authorFixtureSeed(buildFixture(CASES[0]).work)
  const announcement = Object.keys(seed).find(key=>key!=='tuuru_works')
  const existing = {[announcement]:'previous announcement','unrelated':'keep'}
  const result = await runStarter({existing,failAt:2})
  assert.match(result.status,/simulated quota error/)
  assert.ok(result.writes>=2)
  assert.deepEqual(result.storage,existing)
})

test('starter rejects production origin and unexpected seed keys before any write', async () => {
  for (const config of [{hostname:'tuuru.chat'}, {seed:{moirain_work_fake:'{}'}}]) {
    const result = await runStarter(config)
    assert.match(result.status,/仅供独立|无效/)
    assert.deepEqual(result.storage,{})
    assert.equal(result.writes,0)
  }
})

test('browser export storage guard catches reads and all mutations in parent and iframe realms', () => {
  const dom = new JSDOM('<iframe></iframe>',{url:'https://127.0.0.1/',runScripts:'dangerously'})
  try {
    const parent=dom.window, frame=parent.document.querySelector('iframe').contentWindow
    for(const view of [parent,frame])view.eval(`(${installExportStorageGuard.toString()})()`)
    parent.localStorage.setItem('tuuru_works','canonical')
    parent.localStorage.setItem('moirain_private','reader')
    parent.__phoneExportStorageGuard.active=true
    assert.equal(parent.localStorage.getItem('tuuru_works'),'canonical')
    for(const view of [parent,frame]) {
      assert.throws(()=>view.localStorage.getItem('moirain_private'),/storage isolation/)
      assert.throws(()=>view.localStorage.setItem('tuuru_works','changed'),/storage isolation/)
      assert.throws(()=>view.localStorage.removeItem('tuuru_works'),/storage isolation/)
      assert.throws(()=>view.localStorage.clear(),/storage isolation/)
    }
    assert.equal(parent.__phoneExportStorageGuard.violations.length,8)
    assert.equal(parent.localStorage.getItem('tuuru_works'),'canonical')
  } finally {dom.window.close()}
})
