// Verify a prepared static preview, without modifying its upload directory.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright'
import { unzipSync } from 'fflate'
import { PNG } from 'pngjs'
import { openAuthorExport, installExportStorageGuard, assertReaderBoundaries } from './author-workflow.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const target = process.argv[2]
assert.ok(target, 'Pass the prepared output directory or verified HTTPS preview origin')
const evidence = await mkdtemp(path.join(root, 'artifacts/phone-export-browser/preview-check-'))
let server, browser
try {
  let origin
  if (target.startsWith('https://')) {
    const url = new URL(target)
    assert.ok(url.hostname.endsWith('.tuuru.pages.dev') && !url.username && !url.password)
    origin = url.origin
  } else {
    const output = path.resolve(target)
    assert.ok(output.startsWith(path.join(root, 'artifacts/phone-export-browser/preview-')))
    server = await preview({ configFile:path.join(root, 'vite.config.ts'), build:{outDir:output}, preview:{host:'127.0.0.1',port:0} })
    origin = `http://127.0.0.1:${server.httpServer.address().port}`
  }
  browser = await chromium.launch({headless:true})
  const context = await browser.newContext({viewport:{width:820,height:1180},deviceScaleFactor:2,hasTouch:true,acceptDownloads:true,serviceWorkers:'block'})
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const errors=[]
  const renderRequests=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',request=>{if(request.url().includes('/author-phone-render.html'))renderRequests.push(request.url())})
  await context.addInitScript(installExportStorageGuard)
  await page.goto(`${origin}/phone-export-test.html`)
  assert.equal(await page.locator('h1').textContent(),'作者小手机图片导出验收')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:path.join(evidence,'starter.png'),fullPage:true})
  await page.locator('#start').click()
  await page.waitForURL(`${origin}/`)
  const seeded = await page.evaluate(()=>JSON.parse(localStorage.getItem('tuuru_works')))
  assert.equal(seeded.works.length,1)
  assert.equal(seeded.works[0].title,'iPad 作者图片导出测试')
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('moirain_'))),[],'starter created reader data')
  await openAuthorExport(page, seeded.works[0].id, 'all')
  await page.setViewportSize({width:390,height:640})
  await page.locator('.author-phone-export-dialog').waitFor()
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const footer = await page.locator('[data-author-phone-export-start]').boundingBox()
  assert.ok(footer.y>=0&&footer.y+footer.height<=640,'short-viewport export action is outside viewport')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:path.join(evidence,'author-dialog-short.png')})
  const exportStorageBefore=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
  await page.evaluate(()=>{window.__phoneExportStorageGuard.active=true})
  const downloadPromise=page.waitForEvent('download',{timeout:120000})
  await page.locator('[data-author-phone-export-start]').click()
  const download=await downloadPromise
  assert.equal(await download.failure(),null)
  await page.waitForFunction(()=>document.querySelector('#authorPhoneExportProgress')?.dataset.state==='done'&&!document.querySelector('iframe[data-author-phone-render-frame]'),null,{timeout:120000})
  assert.equal(renderRequests.length,1,'production export did not load its real iframe entry')
  assert.deepEqual(await page.evaluate(()=>window.__phoneExportStorageGuard.violations),[])
  assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))),exportStorageBefore)
  await download.saveAs(path.join(evidence,'export.zip'))
  const entries=unzipSync(await readFile(await download.path()))
  const files=Object.keys(entries)
  for(const bytes of Object.values(entries)) {
    const png=PNG.sync.read(Buffer.from(bytes))
    assert.equal(png.width,720)
    assert.ok(png.height>0&&png.height<=3200)
  }
  assert.equal(files.filter(name=>name.endsWith('.png')).length,7)
  for(const route of ['分支01','分支02','分支03'])assert.ok(files.some(name=>name.includes(route)))
  assert.equal(files.filter(name=>name.includes('联系人')).length,1)
  const storageBefore=await page.evaluate(()=>JSON.stringify({...localStorage}))
  await page.goto(`${origin}/phone-export-test.html`)
  await page.locator('#start').click()
  await page.getByRole('status').filter({hasText:'已检测到预览数据'}).waitFor()
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storageBefore)
  const isolated=await browser.newPage()
  await isolated.goto(`${origin}/phone-export-test.html`)
  await isolated.evaluate(()=>{
    const set=Storage.prototype.setItem;let writes=0
    Storage.prototype.setItem=function(key,value){if(++writes===2)throw new Error('simulated quota error');return set.call(this,key,value)}
  })
  await isolated.locator('#start').click()
  await isolated.getByRole('status').filter({hasText:'simulated quota error'}).waitFor()
  assert.equal(await isolated.evaluate(()=>localStorage.length),0,'partial fixture writes must roll back')
  await isolated.close()
  assert.deepEqual(errors,[])
  const readerBoundaries=await assertReaderBoundaries(browser,origin)
  await writeFile(path.join(evidence,'report.json'),JSON.stringify({origin,files,errors,renderRequests,readerBoundaries,authorOnlySeed:true,shortViewportFooter:true,storageIsolation:true,existingLibraryPreserved:true,quotaRollback:true},null,2))
  console.log(`PASS author preview: production iframe, 7 PNGs/3 branches, reader boundaries, existing data refusal, quota rollback; ${evidence}`)
} finally {
  await browser?.close()
  if(server)await new Promise(resolve=>server.httpServer.close(resolve))
}
