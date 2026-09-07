// Temporary, bounded startup-only diagnostics; no export or user profile access.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import path from 'node:path'
import { webkit, devices } from 'playwright'
import { createServer } from 'vite'
import { CASES, buildFixture, authorFixtureSeed } from './fixture.mjs'
import { EDGE_CASES, buildEdgeFixture, startEdgeAssetServer } from './edge-fixture.mjs'
import { exportProbePlugin } from './probe.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const scenario = EDGE_CASES.find(item => item.name === (process.argv[2] || 'image-all-failed'))
const externalOnly = process.argv.includes('--external-only')
const noWatch = process.argv.includes('--no-watch')
if (!scenario) throw new Error('Unknown diagnostic scenario')
const artifacts = path.join(root, 'artifacts/phone-export-browser')
await mkdir(artifacts, { recursive:true })
const output = await mkdtemp(path.join(artifacts, 'startup-'))
const started = Date.now(), events = [], pending = new Map()
const loopDelay = monitorEventLoopDelay({ resolution:20 })
loopDelay.enable()
const record = (type, details = {}) => {
  const item = { ms:Date.now() - started, type, ...details }
  events.push(item)
  if (!['server-request', 'server-finish', 'browser-request', 'browser-finished', 'browser-response', 'route-start', 'route-continued', 'document-state'].includes(type)) console.log(JSON.stringify(item))
}
let server, browser, context, assetServer
try {
  const probePlugin = exportProbePlugin()
  // Keep this diagnostic's before/after switch independent of the harness fix.
  delete probePlugin.configResolved
  server = await createServer({ root, configFile:path.join(root, 'vite.config.ts'),
    plugins:[{ name:'startup-server-observer', configResolved(config) {
      // Vite's mergeConfig skips null inline overrides when configFile is used.
      if (noWatch) config.server.watch = null
    }, configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        const ms = Date.now()
        record('server-request', { url:req.url })
        res.on('finish', () => record('server-finish', { url:req.url, status:res.statusCode, duration:Date.now() - ms }))
        res.on('close', () => { if (!res.writableFinished) record('server-abandoned', { url:req.url, duration:Date.now() - ms }) })
        next()
      })
    } }, probePlugin], server:{ host:'127.0.0.1', port:0, open:false, ...(noWatch ? { watch:null } : {}) }, logLevel:'warn' })
  await server.listen()
  record('watcher-config', { watch:server.config.server.watch, watcher:server.watcher.constructor.name })
  const image = buildFixture(CASES[0]).work.phoneData.chats[0].rounds[0].messages.find(item => item.id === 'image').image
  assetServer = await startEdgeAssetServer(Buffer.from(image.split(',')[1], 'base64'))
  const { work } = buildEdgeFixture(scenario, { assetOrigin:assetServer.origin })
  browser = await webkit.launch({ headless:true })
  record('browser-launched', { version:browser.version() })
  context = await browser.newContext({ viewport:{ width:scenario.width, height:1800 }, deviceScaleFactor:2,
    locale:'zh-CN', timezoneId:'Asia/Shanghai', colorScheme:'light', reducedMotion:'reduce', serviceWorkers:'block',
    acceptDownloads:true, userAgent:devices['iPhone 13'].userAgent, isMobile:true, hasTouch:true })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.on('request', request => {
    pending.set(request, { url:request.url(), resourceType:request.resourceType(), start:Date.now() - started })
    record('browser-request', pending.get(request))
  })
  page.on('response', response => record('browser-response', { url:response.url(), status:response.status() }))
  page.on('requestfinished', request => { record('browser-finished', { ...pending.get(request), timing:request.timing() }); pending.delete(request) })
  page.on('requestfailed', request => { record('browser-failed', { ...pending.get(request), failure:request.failure() }); pending.delete(request) })
  page.on('pageerror', error => record('pageerror', { message:error.message, stack:error.stack }))
  page.on('console', message => record('console', { kind:message.type(), text:message.text() }))
  page.on('domcontentloaded', () => record('domcontentloaded'))
  page.on('load', () => record('load'))
  page.on('crash', () => record('crash'))
  const isExternal = url => url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)
  await context.route(externalOnly ? isExternal : '**/*', async route => {
    const url = new URL(route.request().url())
    record('route-start', { url:url.href, eventLoopMaxMs:loopDelay.max / 1e6 })
    if (isExternal(url)) {
      record('external-blocked', { url:url.href })
      return route.abort()
    }
    await route.continue()
    record('route-continued', { url:url.href, eventLoopMaxMs:loopDelay.max / 1e6 })
  })
  await context.addInitScript(seed => {
    if(window===window.top)for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value)
  }, authorFixtureSeed(work))
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`
  record('goto-start', { url, scenario:scenario.name, externalOnly, noWatch })
  try {
    await page.goto(url, { waitUntil:'domcontentloaded' })
    record('goto-success')
  } catch (error) {
    record('goto-error', { message:error.message, pending:[...pending.values()] })
  }
  const state = await Promise.race([
    page.evaluate(() => ({ readyState:document.readyState, url:location.href, htmlLength:document.documentElement.outerHTML.length,
      appLength:document.querySelector('#app')?.innerHTML.length, scripts:[...document.scripts].map(script => ({ src:script.src, type:script.type })),
      performance:performance.getEntriesByType('navigation').map(entry => entry.toJSON()), resources:performance.getEntriesByType('resource').map(entry => entry.toJSON()) })),
    new Promise(resolve => setTimeout(() => resolve({ evaluateTimedOut:true }), 3000)),
  ])
  record('document-state', state)
  record('pending-at-end', { requests:[...pending.values()], assetRequests:assetServer.requests })
  record('event-loop-delay', { maxMs:loopDelay.max / 1e6, meanMs:loopDelay.mean / 1e6 })
} catch (error) {
  record('fatal', { message:error.message, stack:error.stack })
  process.exitCode = 1
} finally {
  loopDelay.disable()
  await context?.close()
  await browser?.close()
  await server?.close()
  await assetServer?.close()
  await writeFile(path.join(output, 'startup.json'), JSON.stringify({ scenario:scenario.name, externalOnly, noWatch, events }, null, 2))
  console.log(`Startup diagnostics: ${output}`)
}
