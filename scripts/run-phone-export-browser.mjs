import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, webkit, devices } from 'playwright'
import { createServer } from 'vite'
import { unzipSync } from 'fflate'
import { PNG } from 'pngjs'
import { CASES, buildFixture, authorFixtureSeed, readerPoisonWork } from '../browser-tests/phone-export/fixture.mjs'
import { EDGE_CASES, EDGE_IMAGE_QUERY, buildEdgeFixture, isExpectedCorsDiagnostic, loadFixtureFont, startEdgeAssetServer } from '../browser-tests/phone-export/edge-fixture.mjs'
import { assertOversizedPagination } from '../browser-tests/phone-export/edge-assertions.mjs'
import { exportProbePlugin, measureExportPage } from '../browser-tests/phone-export/probe.mjs'
import { phoneExportBrowserOptions } from '../browser-tests/phone-export/browser-options.mjs'
import { assertGeometry, assertPagination, compareRaster, assertRaster } from '../browser-tests/phone-export/assertions.mjs'
import { emptyReaderLibrary, rememberReaderWork, saveReaderProgress } from '../reader/reader-library-state.js'
import { openAuthorExport, installExportStorageGuard, assertReaderBoundaries, assertAuthorCancellation, assertAuthorMasking } from '../browser-tests/phone-export/author-workflow.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const keep = args.includes('--keep-artifacts')
const caseArg = args.find(arg => arg.startsWith('--case='))?.slice(7)
const suite = args.find(arg => arg.startsWith('--suite='))?.slice(8) || 'core'
const engine = args.find(arg => arg.startsWith('--browser='))?.slice(10) || 'chromium'
for (const arg of args) if (arg !== '--keep-artifacts' && !['--case=', '--suite=', '--browser='].some(prefix => arg.startsWith(prefix))) throw new Error(`Unknown argument: ${arg}`)
assert.ok(['core', 'edge', 'all'].includes(suite), `Unknown suite: ${suite}`)
assert.ok(['chromium', 'webkit'].includes(engine), `Unknown browser: ${engine}`)
const available = suite === 'all' ? [...CASES, ...EDGE_CASES] : suite === 'edge' ? EDGE_CASES : CASES
const scenarios = caseArg ? available.filter(item => item.name === caseArg) : available
if (!scenarios.length) throw new Error(`Unknown case: ${caseArg}`)
const artifactsRoot = path.join(root, 'artifacts', 'phone-export-browser')
await mkdir(artifactsRoot, { recursive:true })
const output = await mkdtemp(path.join(artifactsRoot, 'run-'))
const report = { engine, suite, emulatedMobile:engine === 'webkit', cases:[], negativeControls:[], status:'running' }
let server, browser, assetServer, fixtureFont
let success = false

function checkRoute(pages, branch) {
  const text = pages[0].rows.map(row => row.text).join('\n')
  assert.equal(pages[0].rows.filter(row => row.id === 'owner-2').length, branch.startsWith('A') ? 1 : 0,
    `wrong nested choice owner: ${branch}`)
  for (const marker of ['A', 'A1', 'A2', 'B']) {
    const expected = branch === marker || (marker === 'A' && branch.startsWith('A'))
    assert.equal(text.includes(`ROUTE_${marker} `), expected, `wrong branch content: ${branch}/${marker}`)
    assert.equal(pages[0].rows.filter(row => row.text.includes(`ROUTE_${marker} `)).length, expected ? 1 : 0, 'duplicate follow-up')
    assert.equal(pages[0].rows.filter(row => row.text.includes(`REPLY_${marker}`) && !row.text.includes(`REPLY_${marker}1`) && !row.text.includes(`REPLY_${marker}2`)).length,
      expected ? 1 : 0, `wrong reader reply: ${branch}/${marker}`)
  }
}

async function runCase(scenario) {
  const { work, rendererStress, commonIds, oversizedIds } = scenario.edge
    ? buildEdgeFixture(scenario, { assetOrigin:assetServer.origin, fontData:fixtureFont?.data }) : buildFixture(scenario)
  const firstRequest = assetServer.requests.length
  const directory = path.join(output, scenario.name)
  await mkdir(directory)
  const result = { name:scenario.name, coverage:Object.keys(rendererStress).length ? 'authored content with test-only renderer stress' : 'authored capability', rendererStress:Object.keys(rendererStress), pages:[], failures:[], status:'running' }
  const check = (label, assertion) => {
    try { assertion() } catch (error) { result.failures.push(`${label}: ${error.message}`) }
  }
  report.cases.push(result)
  const context = await browser.newContext({
    viewport:{ width:scenario.width, height:1800 }, deviceScaleFactor:2,
    locale:'zh-CN', timezoneId:'Asia/Shanghai', colorScheme:'light', reducedMotion:'reduce',
    serviceWorkers:'block', acceptDownloads:true,
    ...(engine === 'webkit' ? {
      userAgent:devices['iPhone 13'].userAgent,
      isMobile:true,
      hasTouch:true,
    } : {}),
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const errors = [], unexpectedRequests = [], captures = [], downloads = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('download', download => downloads.push(download))
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) {
      unexpectedRequests.push(url.origin)
      return route.abort()
    }
    return route.continue()
  })
  let library = rememberReaderWork(emptyReaderLibrary(), work, 1788739200000)
  library = saveReaderProgress(library, work.id, {
    kind:'phone', flowIndex:0, phoneChoiceSelections:{ owner:'A', 'owner-2':'A1' },
  }, 1788739200001)
  await context.addInitScript(({ work, library, seed, rendererStress, readerPoison }) => {
    // Seed once, in the parent only. Frame startup must never reset storage.
    if (window.top !== window) { window.__phoneExportRendererStress = rendererStress; return }
    for (const [key,value] of Object.entries(seed)) localStorage.setItem(key,value)
    localStorage.setItem('moirain_recent', JSON.stringify([{ id:work.id, title:work.title, type:work.type, importedAt:1788739200000 }]))
    localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(readerPoison))
    localStorage.setItem('moirain_readerLibrary', JSON.stringify(library))
    localStorage.setItem('moirain_phoneCustom', JSON.stringify({readerId:'PRIVATE_READER_ID',customCss:'.chat-bubble{font-size:99px!important}'}))
  }, { work, library, seed:authorFixtureSeed(work), rendererStress, readerPoison:readerPoisonWork(work) })
  await context.addInitScript(installExportStorageGuard)

  // Diagnostic only: distinguish style-copy drift from SVG-image painting on
  // the two desktop chat pages. Keep the original native-vs-export oracle.
  if (scenario.name === 'desktop-current') await page.exposeBinding('__phoneExportSerializedProbe', async (_source, serialized) => {
    if (captures.length > 2) return
    const ordinal = String(captures.length).padStart(2, '0')
    const capture = captures.at(-1)
    const clonePage = await context.newPage()
    try {
      await clonePage.setContent('<body style="margin:0;background:#fffafa"></body>')
      await clonePage.evaluate(async serialized => {
        const svg = new DOMParser().parseFromString(decodeURIComponent(serialized.split(',')[1]), 'image/svg+xml')
        document.body.appendChild(document.importNode(svg.querySelector('foreignObject').firstElementChild, true))
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode()))
      }, serialized)
      const reference = await readFile(capture.referencePath)
      const cloneBytes = await clonePage.locator('.rd-phone-export-viewport').screenshot()
      const cloned = compareRaster(cloneBytes, reference, capture.geometry)
      capture.serializedNative = cloneBytes
      result.serializationDiagnostics ||= []
      result.serializationDiagnostics.push({ ordinal, nativeToClone:cloned.ratio, regions:cloned.regions,
        cloneGeometry:await clonePage.evaluate(measureExportPage) })
      await writeFile(path.join(directory, `${ordinal}-serialized.svg`), decodeURIComponent(serialized.split(',')[1]))
      await writeFile(path.join(directory, `${ordinal}-serialized-native.png`), cloneBytes)
      console.log(`DIAGNOSTIC ${scenario.name}/${ordinal}: native-to-serialized ${(cloned.ratio * 100).toFixed(3)}%`)
    } finally { await clonePage.close() }
  })

  await page.exposeBinding('__phoneExportBeforeRaster', async ({ frame }) => {
    assert.notEqual(frame, page.mainFrame(), 'observer must originate in the captured DOM frame')
    assert.match(frame.url(), /author-phone-render\.html/)
    const geometry = await frame.evaluate(measureExportPage)
    // A negative control changes the real staged DOM, checks the oracle, then restores it.
    if (!report.negativeControls.includes('payment-overlap') && geometry.rows.some(row => row.id === 'transfer')) {
      assertGeometry(geometry)
      const rejected = await frame.evaluate(() => {
        const node = document.querySelector('.rd-phone-export-viewport .chat-payment-transfer')
        const original = node.getAttribute('style')
        node.style.setProperty('transform', 'translateY(-100px)', 'important')
        node.style.setProperty('transition', 'none', 'important')
        return original
      })
      try {
        const broken = await frame.evaluate(measureExportPage)
        assert.throws(() => assertGeometry(broken), /overlap|escapes/, 'payment overlap detector did not reject damaged DOM')
        report.negativeControls.push('payment-overlap')
      } finally {
        await frame.evaluate(original => {
          const node = document.querySelector('.rd-phone-export-viewport .chat-payment-transfer')
          if (original === null) node.removeAttribute('style')
          else node.setAttribute('style', original)
          // Do not start a transition back from the deliberately damaged position.
          node.style.setProperty('transition', 'none', 'important')
          node.getBoundingClientRect()
          if (original === null) node.removeAttribute('style')
          else node.setAttribute('style', original)
        }, rejected)
      }
    }
    const iframe = await frame.frameElement()
    const frameStyle = await iframe.evaluate((node, height) => {
      const style = node.getAttribute('style')
      Object.assign(node.style,{left:'0px',top:'0px',height:`${height}px`,zIndex:'2147483647'})
      return style
    }, geometry.height)
    const original = await frame.evaluate(() => {
      const stage = document.querySelector('.rd-phone-export-stage')
      const style = stage.getAttribute('style')
      stage.style.setProperty('left', '0px', 'important')
      stage.style.setProperty('top', '0px', 'important')
      stage.style.setProperty('z-index', '2147483647', 'important')
      stage.style.setProperty('background-color', '#fffafa', 'important')
      return style
    })
    const referencePath = path.join(directory, `${String(captures.length + 1).padStart(2, '0')}-native.png`)
    try {
      // WebKit's compositor may still show the old offscreen layer immediately
      // after moving the stage; let the visible style reach a painted frame.
      await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      // The viewport fits in this test window, so screenshotting cannot resize or scroll it.
      const clip = await frame.locator('.rd-phone-export-viewport').boundingBox()
      assert.equal(clip.width, geometry.width)
      assert.equal(clip.height, geometry.height)
      await page.screenshot({ path:referencePath, clip })
    } finally {
      await frame.evaluate(style => document.querySelector('.rd-phone-export-stage').setAttribute('style', style), original)
      await iframe.evaluate((node, style) => node.setAttribute('style', style), frameStyle)
    }
    captures.push({ geometry, referencePath })
  })
  try {
    const port = server.httpServer.address().port
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' })
    await openAuthorExport(page, work.id, scenario.mode)
    const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
    await page.evaluate(() => { window.__phoneExportStorageGuard.active = true })
    const expectedState = scenario.expect || 'done'
    // Subscribe before starting successful/partial exports so a fast download event cannot be missed.
    const downloadOutcomePromise = expectedState === 'error' ? null : page.waitForEvent('download', { timeout:120_000 })
      .then(value => ({ value }), error => ({ error }))
    await page.locator('[data-author-phone-export-start]').click()
    const startedAt = Date.now()
    await page.waitForFunction(() => ['done', 'warning', 'error'].includes(document.querySelector('#authorPhoneExportProgress')?.dataset.state)
      && !document.querySelector('iframe[data-author-phone-render-frame]')
      && !document.querySelector('[data-author-phone-export-start]')?.disabled, null, { timeout:120_000 })
    const terminalState = await page.locator('#authorPhoneExportProgress').getAttribute('data-state')
    assert.equal(terminalState, expectedState, await page.locator('.author-phone-export-dialog').textContent())
    result.durationMs = Date.now() - startedAt
    const downloadOutcome = downloadOutcomePromise ? await downloadOutcomePromise : null
    if (downloadOutcome?.error) throw downloadOutcome.error
    const download = downloadOutcome?.value || null
    assert.equal(downloads.length, expectedState === 'error' ? 0 : 1, 'terminal state produced the wrong number of downloads')
    const dialogText = await page.locator('.author-phone-export-dialog').innerText()
    if (expectedState !== 'done') {
      assert.match(dialogText, /图片无法读取/, 'failure must identify an unreadable image')
      assert.match(dialogText, /重新上传/, 'failure must give the re-upload action')
      if (expectedState === 'warning') assert.match(dialogText, /部分导出/, 'partial export copy is not explicit')
      assert.doesNotMatch(dialogText, /127\.0\.0\.1|fixture%|token=/, 'failure copy exposed the resource URL or token')
      const details = page.locator('#authorPhoneExportFailures')
      assert.equal(await details.count(), 1, 'failure details are missing')
      if (expectedState === 'warning') {
        assert.equal(await details.getAttribute('hidden'), null, 'warning failure details remain hidden')
        assert.equal(await details.getAttribute('open'), '', 'warning failure details were not opened by the product')
        assert.ok((await details.locator('li').count()) > 0, 'warning failure details are empty')
      } else {
        assert.notEqual(await details.getAttribute('hidden'), null, 'all-failed flow unexpectedly exposed a partial-failure list')
        assert.equal(await details.locator('li').count(), 0, 'all-failed flow populated partial-failure items')
      }
      const feedback = page.locator('[data-feedback-root]').last()
      assert.equal(await feedback.getAttribute('data-feedback-type'), expectedState, 'feedback semantic type is wrong')
      assert.ok((await feedback.getAttribute('class')).split(/\s+/).includes(expectedState), 'feedback type class is missing')
      assert.match(await feedback.locator('[data-feedback-copy]').innerText(), expectedState === 'warning' ? /部分导出|未导出/ : /图片无法读取/)
    }
    assert.equal(await page.locator('[data-author-phone-export-start]').isEnabled(), true, 'export button was not re-enabled')
    assert.deepEqual(await page.evaluate(() => window.__phoneExportStorageGuard.violations), [], 'export accessed reader data or wrote storage')
    result.assetRequests = assetServer.requests.slice(firstRequest)
    if (['404', 'timeout', 'cors', 'cors-allowed'].includes(scenario.edge)) {
      const expectedUrl = `/${scenario.edge}/message.png?${EDGE_IMAGE_QUERY}`
      assert.ok(result.assetRequests.length >= 2, 'external image did not exercise native load and CORS fetch')
      assert.ok(result.assetRequests.every(request => request.url === expectedUrl), 'image URL changed or gained a cache-buster')
      assert.ok(result.assetRequests.some(request => request.origin) && result.assetRequests.some(request => !request.origin), 'image request modes are incomplete')
    }
    if (['css-cors', 'css-cors-allowed'].includes(scenario.edge)) {
      const expectedUrl = `/${scenario.edge}/wallpaper.png?${EDGE_IMAGE_QUERY}`
      assert.ok(result.assetRequests.length >= 2, 'CSS image did not exercise native load and CORS fetch')
      assert.ok(result.assetRequests.every(request => request.url === expectedUrl), 'CSS image URL changed or gained a cache-buster')
      assert.ok(result.assetRequests.some(request => request.origin) && result.assetRequests.some(request => !request.origin), 'CSS image request modes are incomplete')
    }
    const knownCorsErrors = errors.filter(message => isExpectedCorsDiagnostic(message,
      { engine, edge:scenario.edge, assetOrigin:assetServer.origin }))
    result.securityDiagnostics = knownCorsErrors
    const unexpectedBrowserErrors = errors.filter(message => !knownCorsErrors.includes(message))
    if (expectedState === 'error') {
      assert.equal(captures.length, 0, 'all-failed export reached rasterization')
      assert.equal(await page.locator('iframe[data-author-phone-render-frame], .rd-phone-export-stage').count(), 0, 'export staging tree leaked')
      assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))), before, 'export changed reader storage')
      assert.deepEqual(unexpectedBrowserErrors, [], 'unexpected browser errors')
      assert.deepEqual(unexpectedRequests, [], 'fixture unexpectedly fetched external content')
      result.status = 'passed'
      console.log(`PASS ${scenario.name}: actionable error, no download`)
      return
    }
    assert.equal(download, downloads[0], 'observed download does not match the awaited event')
    assert.equal(await download.failure(), null, 'export download failed')
    const archivePath = path.join(directory, 'export.zip')
    await download.saveAs(archivePath)
    const entries = Object.entries(unzipSync(await readFile(archivePath)))
    assert.equal(entries.length, captures.length, 'downloaded ZIP does not match captured pages')
    if (expectedState === 'done') assert.ok(entries.length > 1, 'ZIP contains no multipage export')
    assert.equal(download.suggestedFilename().includes('全部分支'), scenario.mode === 'all')
    const routes = new Map()
    for (const [index, [filename, bytes]] of entries.entries()) {
      const { geometry, referencePath } = captures[index]
      assert.equal(geometry.width, 360, 'export width changed')
      assert.ok(geometry.height <= 1600, 'export page exceeds height limit')
      const ordinal = String(index + 1).padStart(2, '0')
      await writeFile(path.join(directory, `${ordinal}-export.png`), bytes)
      const raster = compareRaster(bytes, await readFile(referencePath), geometry)
      if (captures[index].serializedNative) {
        const cloned = compareRaster(bytes, captures[index].serializedNative, geometry)
        result.serializationDiagnostics[index].cloneToExport = cloned.ratio
        console.log(`DIAGNOSTIC ${scenario.name}/${ordinal}: serialized-to-export ${(cloned.ratio * 100).toFixed(3)}%`)
      }
      await writeFile(path.join(directory, `${ordinal}-diff.png`), raster.diff)
      const pageResult = { filename, ...geometry, mismatch:raster.ratio, regions:raster.regions }
      result.pages.push(pageResult)
      check(filename, () => assertGeometry(geometry))
      check(filename, () => assertRaster(raster))
      if (geometry.rows.length) {
        const label = scenario.mode === 'all' ? filename.match(/分支\d+/)?.[0] : 'current'
        assert.ok(label, `missing branch label: ${filename}`)
        if (!routes.has(label)) routes.set(label, [])
        routes.get(label).push({ ...geometry, filename })
      }
      if (!report.negativeControls.includes('raster-shift') && geometry.rows.length) {
        // Start from a known-good reference, so a real export defect cannot make this control pass accidentally.
        const reference = await readFile(referencePath)
        assertRaster(compareRaster(reference, reference, geometry))
        const png = PNG.sync.read(reference), shifted = new PNG({ width:png.width, height:png.height })
        PNG.bitblt(png, shifted, 0, 0, png.width, png.height - 40, 0, 40)
        const broken = compareRaster(PNG.sync.write(shifted), reference, geometry)
        assert.throws(() => assertRaster(broken), /raster mismatch/, 'PNG drift detector did not reject shifted content')
        report.negativeControls.push('raster-shift')
      }
    }
    assert.equal(routes.size, expectedState === 'warning' ? 0 : (scenario.mode === 'all' ? 3 : 1), 'incorrect terminal route count')
    assert.equal(entries.filter(([name]) => name.includes('-联系人-')).length, 1, 'Contacts must export once')
    if (expectedState === 'warning') assert.ok(entries.every(([name]) => name.includes('-联系人-')), 'partial ZIP contains files from the failed chat')
    for (const [index, pages] of [...routes.values()].entries()) {
      check('pagination', () => oversizedIds
        ? assertOversizedPagination(pages, commonIds, oversizedIds) : assertPagination(pages, commonIds))
      if (oversizedIds) check('oversized contents', () => {
        const text = pages[0].rows.find(row => row.id === 'long-self').text
        for (let line = 1; line <= 180; line++) assert.equal(text.split(`LINE_${String(line).padStart(3, '0')}`).length - 1, 1, 'missing/duplicate oversized text line')
      })
      check('route content', () => checkRoute(pages, scenario.mode === 'all' ? ['A1', 'A2', 'B'][index] : 'default'))
      assert.ok(!pages.some(item => item.rows.some(row => /PRIVATE_READER/.test(row.text))), 'reader private content leaked')
      pages.forEach((item, i) => assert.ok(item.filename.endsWith(`-${String(i + 1).padStart(2, '0')}.png`), 'page numbering must restart per route'))
      if (!report.negativeControls.includes('page-cut')) {
        const broken = structuredClone(pages)
        // Move a boundary into a real message while keeping both pages contiguous.
        const row = broken[0].rows.find(item => item.id === (oversizedIds ? 'system' : 'transfer'))
        const cut = Math.round(row.y - broken[0].panelOffset + row.height / 2)
        const end = broken[1].top + broken[1].contentHeight
        broken[0].contentHeight = cut
        const oldTop = broken[1].top
        broken[1].top = cut
        broken[1].panelOffset += oldTop - cut
        for (const item of broken[1].rows) item.y += oldTop - cut
        broken[1].contentHeight = end - cut
        assert.throws(() => oversizedIds ? assertOversizedPagination(broken, commonIds, oversizedIds)
          : assertPagination(broken, commonIds), /page cut/, 'pagination detector did not reject a split message')
        report.negativeControls.push('page-cut')
      }
    }
    if (scenario.skin) assert.ok(captures.some(item => item.geometry.skinCount > 0), 'custom bubble fixture did not apply')
    if (['404', 'timeout', 'cors', 'cors-allowed'].includes(scenario.edge)) check('external image exercised', () => {
      result.assetRequests = assetServer.requests.slice(firstRequest)
      assert.ok(result.assetRequests.some(request => request.kind === scenario.edge), 'external-image route was never requested')
      const image = captures.flatMap(item => item.geometry.images).find(item => item.messageId === 'image')
      if (scenario.edge === 'cors-allowed') {
        assert.ok(image, 'external image message is missing')
        assert.equal(image.width, 120, 'CORS fixture must display a real image before rasterization')
        assert.match(image.source, /^data:image\/png/, 'allowed external image was not embedded before rasterization')
      }
      if (scenario.edge === 'timeout') assert.ok(result.durationMs >= 2500, 'loading timeout was not exercised')
    })
    if (scenario.edge === 'css-cors-allowed') check('external CSS image exercised', () => {
      result.assetRequests = assetServer.requests.slice(firstRequest)
      assert.ok(captures.some(item => item.geometry.backgroundImages.some(value => value.startsWith('url("data:image/png'))), 'CSS image was not embedded before rasterization')
    })
    if (scenario.edge === 'font-css') check('font and supported CSS applied', () => {
      assert.ok(captures.some(item => item.geometry.fonts.some(font => font.family.replaceAll('"', '') === 'ExportFixtureFont' && font.status === 'loaded')), 'imported font was not loaded')
      const bubble = captures[0].geometry.rows.find(row => row.id === 'long-self').bubbles[0]
      assert.match(bubble.fontFamily, /ExportFixtureFont/)
      assert.equal(bubble.fontSize, '15.75px')
      assert.equal(bubble.letterSpacing, '0.35px')
      assert.match(bubble.backgroundImage, /linear-gradient/)
      assert.notEqual(bubble.boxShadow, 'none')
      assert.notEqual(bubble.textShadow, 'none')
      assert.equal(bubble.beforeSize, '8.5px')
      assert.equal(bubble.beforeContent, '"DECOR_START"')
      assert.equal(bubble.afterSize, '9.25px')
      assert.equal(bubble.afterContent, '"DECOR_END"')
    })
    assert.equal(await page.locator('iframe[data-author-phone-render-frame], .rd-phone-export-stage').count(), 0, 'export staging tree leaked')
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))), before, 'export changed reader storage')
    assert.deepEqual(unexpectedBrowserErrors, [], 'unexpected browser errors')
    assert.deepEqual(unexpectedRequests, [], 'fixture unexpectedly fetched external content')
    assert.deepEqual(result.failures, [], 'real exported images failed acceptance')
    result.status = 'passed'
    console.log(`PASS ${scenario.name}: ${entries.length} real PNGs, ${routes.size} routes, max pixel mismatch ${(Math.max(...result.pages.map(p => p.mismatch)) * 100).toFixed(3)}%`)
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack
    result.browserErrors = errors
    result.dialog = await page.locator('.author-phone-export-dialog').textContent().catch(() => null)
    result.observedPages = captures.map(item => item.geometry)
    await page.screenshot({ path:path.join(directory, 'failure-screen.png') }).catch(() => {})
    throw error
  } finally {
    result.assetRequests = assetServer.requests.slice(firstRequest)
    await context.close()
  }
}

try {
  server = await createServer({
    root, configFile:path.join(root, 'vite.config.ts'), plugins:[exportProbePlugin()],
    server:{ host:'127.0.0.1', port:0, open:false }, logLevel:'warn',
  })
  await server.listen()
  const asset = buildFixture(CASES[0]).work.phoneData.chats[0].rounds[0].messages.find(message => message.id === 'image').image
  assetServer = await startEdgeAssetServer(Buffer.from(asset.split(',')[1], 'base64'))
  if (scenarios.some(scenario => scenario.edge === 'font-css')) {
    fixtureFont = await loadFixtureFont()
    report.fixtureFont = fixtureFont.filename
  }
  const launchOptions = phoneExportBrowserOptions(engine)
  browser = await ({ chromium, webkit }[engine]).launch(launchOptions)
  report.launchOptions = launchOptions
  report.browserVersion = browser.version()
  report.contractFailures = []
  for (const [name,verify] of Object.entries({readerBoundaries:assertReaderBoundaries,cancellation:assertAuthorCancellation,masking:assertAuthorMasking})) {
    try {
      report[name] = await verify(browser, `http://127.0.0.1:${server.httpServer.address().port}`, path.join(output, `${name}-contract`))
      console.log(`PASS ${name}`)
    } catch(error) {
      report.contractFailures.push({name,error:error.stack})
      console.error(`FAIL ${name}: ${error.message}`)
    }
  }
  for (const scenario of scenarios) {
    try { await runCase(scenario) } catch (error) { console.error(`FAIL ${scenario.name}: ${error.message}`) }
  }
  if (!caseArg && ['core', 'all'].includes(suite)) assert.equal(report.negativeControls.length, 3, 'all three negative controls must run')
  assert.ok(report.cases.every(item => item.status === 'passed'), 'one or more browser export scenarios failed; see report.json')
  assert.deepEqual(report.contractFailures, [], 'one or more author/reader boundary contracts failed')
  report.status = 'passed'
  success = true
  if (report.negativeControls.length === 3) console.log('PASS negative controls: payment overlap, raster drift, pagination damage were all rejected')
} catch (error) {
  report.status = 'failed'
  report.error = error.stack
  console.error(error.stack)
  process.exitCode = 1
} finally {
  await browser?.close()
  await server?.close()
  await assetServer?.close()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  if (success && !keep) {
    // Only this process's mkdtemp directory, never a caller-supplied path.
    assert.equal(path.dirname(output), artifactsRoot)
    await rm(output, { recursive:true })
    console.log('Successful-run images removed (use --keep-artifacts to retain them).')
  } else console.log(`Export acceptance artifacts: ${output}`)
}
