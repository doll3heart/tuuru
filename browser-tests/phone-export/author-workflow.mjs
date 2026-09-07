import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { CASES, buildFixture, authorFixtureSeed } from './fixture.mjs'
import { emptyReaderLibrary, rememberReaderWork } from '../../reader/reader-library-state.js'

export async function openAuthorExport(page, workId, mode = 'all') {
  await page.waitForFunction(() => typeof window.openWorkExport === 'function')
  await page.evaluate(id => window.openWorkExport(id), workId)
  await page.locator('[data-work-phone-images]').click()
  await page.locator(`input[name="authorPhoneExportBranchMode"][value="${mode}"]`).check()
}

// Installs in every realm. Frame violations are retained in the parent after
// the disposable render frame is removed. Ordinary startup remains unaffected.
export function installExportStorageGuard() {
  if (window === window.top) window.__phoneExportStorageGuard = {active:false,violations:[]}
  const guard = () => window.top.__phoneExportStorageGuard
  for (const method of ['getItem','setItem','removeItem','clear']) {
    const original = Storage.prototype[method]
    Storage.prototype[method] = function(...args) {
      const state = guard()
      if (state?.active && (method !== 'getItem' || String(args[0]).startsWith('moirain_'))) {
        const violation = `${window === window.top ? 'parent' : 'frame'}:${method}:${args[0] || ''}`
        state.violations.push(violation)
        throw new Error(`Export storage isolation violation: ${violation}`)
      }
      return original.apply(this,args)
    }
  }
}

const exportControls = '[data-reader-data-export], [data-reader-appearance-export], [data-reader-phone-control="export"], [data-author-phone-export-start], [data-work-phone-images]'

export async function assertReaderBoundaries(browser, origin) {
  const results = []
  const {work} = buildFixture(CASES[0])
  for (const preview of [false,true]) {
    const context = await browser.newContext({acceptDownloads:true,serviceWorkers:'block'})
    const page = await context.newPage()
    const downloads = [], errors = [], loaded = []
    page.on('download',item=>downloads.push(item))
    page.on('pageerror',error=>errors.push(error.message))
    page.on('request',request=>loaded.push(request.url()))
    await context.addInitScript(({seed,work,library})=>{
      for (const [key,value] of Object.entries(seed)) localStorage.setItem(key,value)
      localStorage.setItem('moirain_readerLibrary',JSON.stringify(library))
      localStorage.setItem(`moirain_work_${work.id}`,JSON.stringify(work))
      localStorage.setItem('moirain_recent',JSON.stringify([{id:work.id,title:work.title,type:work.type}]))
    },{seed:authorFixtureSeed(work),work,library:rememberReaderWork(emptyReaderLibrary(),work,1788739200000)})
    try {
      await page.goto(`${origin}/reader/?${preview ? `preview=${work.id}&` : ''}authorPhoneExport=1&exportMode=1&render=1`)
      if (!preview) {
        await page.locator('[data-tab="library"]').click()
        assert.equal(await page.locator('[data-reader-data-import]').count(),1,'reader restore remains available')
        await page.locator('.rd-recent-item').first().click()
      }
      // Normal reading (including author reading-preview) retains its landing
      // gate. Finish it rather than bypassing it with export state.
      await page.locator('#rdStartBtn').click()
      await page.locator('.phone-frame').waitFor()
      assert.equal(await page.locator(exportControls).count(),0,'reading UI exposed export')
      if (!preview) {
        await page.locator('.reader-back[data-reader-home]').click()
        await page.locator('[data-tab="custom"]').click()
        assert.equal(await page.locator(exportControls).count(),0,'reader customization exposed export')
        await page.locator('[data-reader-phone-control="appearance"]').click()
        await page.locator('[data-reader-appearance-import]').waitFor({state:'attached'})
        assert.equal(await page.locator('[data-reader-appearance-import]').count(),1)
        assert.equal(await page.locator(exportControls).count(),0)
        await page.keyboard.press('Escape')
      }
      const before = await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
      const bridges = await page.evaluate(()=>{
        const names=['openReaderPhoneExportDialog','readerPhoneExportJobs','exportReaderPhoneContentImages','downloadBlob','serializeReaderDataPackage','serializeReaderAppearancePackage','openWorkExport']
        const exposed=names.filter(name=>typeof window[name]==='function')
        const host=document.createElement('div')
        host.id='stale-export-controls'
        host.innerHTML='<button data-reader-data-export>stale data</button><button data-reader-appearance-export>stale appearance</button><button data-reader-phone-control="export">stale image</button><button data-author-phone-export-start>forged author</button>'
        document.body.append(host)
        for(const button of host.querySelectorAll('button'))button.click()
        return exposed
      })
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      assert.deepEqual(bridges,[],'reading surface exposed a callable delivery bridge')
      assert.equal(await page.locator('iframe[data-author-phone-render-frame], .author-phone-export-dialog, .rd-phone-export-dialog').count(),0)
      assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))),before)
      assert.equal(downloads.length,0,'stale reading controls triggered download')
      assert.ok(!loaded.some(url=>/phone-content-export\.js|author-phone-export(?:-ui)?\.js/.test(url)),'reading page loaded exporter')
      assert.deepEqual(errors,[])
      results.push({surface:preview?'author-reading-preview':'ordinary-reader',forgedFlags:true,staleControls:true,noDownloads:true,noDeliveryBridge:true,storageUnchanged:true})
    } finally {await context.close()}
  }
  return results
}

export async function assertAuthorCancellation(browser, origin) {
  const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'})
  const page=await context.newPage()
  const {work}=buildFixture(CASES[0])
  const downloads=[],errors=[]
  page.on('download',item=>downloads.push(item))
  page.on('pageerror',error=>errors.push(error.message))
  await context.addInitScript(seed=>{if(window===window.top)for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value)},authorFixtureSeed(work))
  await context.addInitScript(installExportStorageGuard)
  let entered,release,timer
  const atRaster=new Promise(resolve=>{entered=resolve})
  const hold=new Promise(resolve=>{release=resolve})
  await page.exposeBinding('__phoneExportBeforeRaster',async({frame})=>{assert.notEqual(frame,page.mainFrame());entered();await hold})
  try {
    await page.goto(origin)
    await openAuthorExport(page,work.id,'all')
    const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
    await page.evaluate(()=>{window.__phoneExportStorageGuard.active=true})
    await page.locator('[data-author-phone-export-start]').click()
    await Promise.race([atRaster,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Cancellation probe did not reach raster boundary')),20000)})])
    clearTimeout(timer)
    await page.locator('[data-author-phone-export-cancel]').click()
    release()
    await page.waitForFunction(()=>!document.querySelector('iframe[data-author-phone-render-frame]'))
    assert.equal(downloads.length,0)
    assert.deepEqual(errors,[])
    assert.deepEqual(await page.evaluate(()=>window.__phoneExportStorageGuard.violations),[])
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))),before)
    return {cancelledAt:'real raster boundary',noDownload:true,frameDisposed:true,storageUnchanged:true}
  } catch(error) {
    error.message += `; dialog=${await page.locator('.author-phone-export-dialog').textContent().catch(()=>null)}; browserErrors=${JSON.stringify(errors)}; storage=${JSON.stringify(await page.evaluate(()=>window.__phoneExportStorageGuard.violations).catch(()=>[]))}`
    throw error
  } finally {clearTimeout(timer);release();await context.close()}
}

export async function assertAuthorMasking(browser, origin, evidence) {
  const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'})
  const page=await context.newPage()
  const {work}=buildFixture(CASES[0])
  const secret='AUTHOR_MASK_SENTINEL'
  work.title=secret
  work.placeholders=[{id:'name',key:'name',default:secret,values:[secret],fillMode:'inline'}]
  work.phoneData.contacts[0].name=secret
  work.phoneData.chats[0].rounds=[{id:'mask',messages:[
    {id:'mask-self',type:'text',senderId:'self',text:secret},
    {id:'mask-owner',type:'text',senderId:'npc',text:'choose',choices:[
      {id:'left',text:`${secret} left`,replyText:'left reply'},
      {id:'right',text:`${secret} right`,replyText:'right reply'},
    ]},
  ]}]
  const errors=[], observed=[]
  page.on('pageerror',error=>errors.push(error.message))
  await context.addInitScript(seed=>{if(window===window.top)for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value)},authorFixtureSeed(work))
  await context.addInitScript(installExportStorageGuard)
  await page.exposeBinding('__phoneExportBeforeRaster',async({frame})=>{
    assert.notEqual(frame,page.mainFrame())
    observed.push(await frame.evaluate(()=>{
      const viewport=document.querySelector('.rd-phone-export-viewport')
      return {text:viewport.textContent,avatars:[...viewport.querySelectorAll('[data-phone-export-reader-avatar]')].map(node=>({text:node.textContent,background:getComputedStyle(node).backgroundImage}))}
    }))
  })
  try {
    await page.goto(origin)
    await openAuthorExport(page,work.id,'all')
    const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
    await page.evaluate(()=>{window.__phoneExportStorageGuard.active=true})
    const delivery=page.waitForEvent('download',{timeout:30000}).then(value=>({value}),error=>({error}))
    await page.locator('[data-author-phone-export-start]').click()
    const outcome=await delivery
    if(outcome.error)throw outcome.error
    const download=outcome.value
    await page.waitForFunction(()=>document.querySelector('#authorPhoneExportProgress')?.dataset.state==='done'&&!document.querySelector('iframe[data-author-phone-render-frame]'))
    assert.equal(await download.failure(),null)
    const entries=Object.keys(unzipSync(await readFile(await download.path())))
    if(evidence){await mkdir(evidence,{recursive:true});await download.saveAs(path.join(evidence,'export.zip'))}
    assert.equal(entries.length,3,'two masked branches and Contacts must export exactly once each')
    for(const name of [download.suggestedFilename(),...entries]) {
      assert.ok(!name.includes(secret),'placeholder leaked in delivery filename')
      assert.match(name,/▖▜▖▗/,'masked filename has no mosaic')
    }
    assert.equal(observed.length,3)
    assert.ok(observed.every(item=>!item.text.includes(secret)))
    assert.ok(observed.some(item=>item.text.includes('▖▜▖▗')))
    const avatars=observed.flatMap(item=>item.avatars)
    assert.ok(avatars.length>=2,'self-avatar masking was not exercised')
    assert.ok(avatars.every(item=>item.text==='▖▜▖▗'&&item.background==='none'))
    assert.deepEqual(errors,[])
    assert.deepEqual(await page.evaluate(()=>window.__phoneExportStorageGuard.violations),[])
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))),before)
    return {pages:entries.length,filenames:entries,placeholderTextMasked:true,readerAvatarsMasked:true,storageUnchanged:true}
  } finally {await context.close()}
}
