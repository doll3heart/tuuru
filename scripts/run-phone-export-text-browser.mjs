import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, webkit } from 'playwright'
import { createServer } from 'vite'
import { unzipSync } from 'fflate'
import { PNG } from 'pngjs'
import { authorFixtureSeed } from '../browser-tests/phone-export/fixture.mjs'
import { openAuthorExport, installExportStorageGuard } from '../browser-tests/phone-export/author-workflow.mjs'
import { exportProbePlugin } from '../browser-tests/phone-export/probe.mjs'
import { phoneExportBrowserOptions } from '../browser-tests/phone-export/browser-options.mjs'
import { compareRaster, assertRaster } from '../browser-tests/phone-export/assertions.mjs'
import { buildTextFixture, measureTextBoxes } from '../browser-tests/phone-export/text-fixture.mjs'
import { verifyExportZoomIsolation } from '../browser-tests/phone-export/zoom-contract.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
for (const arg of args) assert.match(arg, /^--browser=(chromium|webkit)$/u, `Unknown argument: ${arg}`)
const engine = args[0]?.slice(10) || 'chromium'
const scenarios = [0.9, 1, 1.1, 1.25].map(zoom => ({ name:`authored-zoom-${zoom}`, zoom }))
scenarios.push({ name:'fractional-font-zoom-0.9', zoom:0.9, fractional:true },
  { name:'fractional-font-zoom-1.1', zoom:1.1, fractional:true },
  { name:'nested-zoom-fractional-font', zoom:1.1, bodyZoom:0.9, fractional:true },
  { name:'full-skin-zoom-1.1', zoom:1.1, skin:'full' },
  { name:'slice-skin-zoom-0.9', zoom:0.9, skin:'slice' })
const artifacts = path.join(root, 'artifacts/phone-export-browser')
await mkdir(artifacts, { recursive:true })
const output = await mkdtemp(path.join(artifacts, 'text-'))
const report = { engine, platform:process.platform, realDevice:false, cases:[], negativeControls:[], status:'running' }
const stressPlugin = exportProbePlugin()
const server = await createServer({ configFile:path.join(root, 'vite.config.ts'),
  cacheDir:path.join(root, '.vite/phone-export-text'), server:{ host:'127.0.0.1', port:0 }, plugins:[{
    name:'phone-export-text-probe', enforce:'pre', configResolved:stressPlugin.configResolved,
    transform(source, id) {
      const filename = id.replaceAll('\\', '/').split('?')[0]
      if (filename.endsWith('/reader/reader.js')) return stressPlugin.transform(source, id)
      if (!filename.endsWith('/reader/phone-content-export.js')) return
      const original = 'import { toBlob } from "html-to-image"'
      assert.ok(source.includes(original), 'Real html-to-image import probe no longer matches')
      return source.replace(original, `import { toBlob as realToBlob, toSvg } from "html-to-image"
async function toBlob(node, options) {
  const serialized = await toSvg(node, options)
  await node.ownerDocument.defaultView.__phoneExportTextProbe(serialized)
  return realToBlob(node, options)
}`)
    },
  }] })
let browser

function assertTextGeometry(live, clone, expected) {
  assert.equal(live.width, 360, 'ancestor zoom changed the export layout width')
  assert.equal(clone.width, 360, 'serialized viewport width changed')
  assert.equal(clone.bubbles.length, expected.length, 'missing text bubbles')
  assert.equal(live.bubbles.length, expected.length, 'missing source text bubbles')
  for (const [index, bubble] of clone.bubbles.entries()) {
    const source = live.bubbles[index], authored = expected[index]
    assert.equal(bubble.id, authored.id)
    assert.ok(authored.text.trim() && bubble.text.includes(authored.text), `missing expected text: ${bubble.id}`)
    assert.ok(bubble.lines.length > 0, `no measured text: ${bubble.id}`)
    assert.equal(bubble.lines.length, source.lines.length, `serialized line count changed: ${bubble.id} ${authored.text}`)
    assert.equal(bubble.fontSize, source.fontSize, `font changed: ${bubble.id}`)
    assert.ok(bubble.width <= 192, `converted text constraint widened bubble: ${bubble.id}`)
    for (const line of bubble.lines) {
      assert.ok(line.y >= bubble.y - 1 && line.y + line.height <= bubble.y + bubble.height + 1,
        `serialized text escapes bubble vertically: ${bubble.id} ${authored.text}`)
      assert.ok(line.x >= bubble.x - 1 && line.x + line.width <= bubble.x + bubble.width + 1,
        `serialized text escapes bubble horizontally: ${bubble.id} ${authored.text}`)
    }
  }
}

function rasterGeometry(geometry) {
  return { ...geometry, rows:geometry.bubbles.filter(bubble => bubble.y >= 0 && bubble.y + bubble.height + 16 <= geometry.height)
    .flatMap(bubble => [
      { id:bubble.id, x:bubble.x - 2, y:bubble.y - 2, width:bubble.width + 4, height:bubble.height + 18 },
      { id:`${bubble.id}-spill`, x:bubble.x, y:bubble.y + bubble.height, width:bubble.width, height:16 },
    ]) }
}

function assertGlyphControl(reference, geometry) {
  const bubble = geometry.bubbles.find(item => item.id === 'npc-5' && item.y >= 0)
  if (!bubble) return false
  const png = PNG.sync.read(reference), damaged = PNG.sync.read(reference)
  const line = bubble.lines[0], size = Math.ceil(parseFloat(bubble.fontSize) * 2)
  const x = Math.floor(line.x * 2), y = Math.floor(line.y * 2), targetY = Math.ceil((bubble.y + bubble.height + 1) * 2)
  // Move an actual glyph-sized text patch below its bubble, replacing its old
  // position with a same-sized background patch. Page-only thresholds dilute it.
  PNG.bitblt(png, damaged, x, targetY, size, size, x, y)
  PNG.bitblt(png, damaged, x, y, size, size, x, targetY)
  const result = compareRaster(PNG.sync.write(damaged), reference, rasterGeometry(geometry))
  assert.ok(result.ratio <= 0.01, 'negative control must evade the whole-page threshold')
  assert.throws(() => assertRaster(result), /message .* differs/, 'tight bubble/spill oracle accepted glyph damage')
  return true
}

try {
  await server.listen()
  const launchOptions = phoneExportBrowserOptions(engine)
  browser = await ({ chromium, webkit })[engine].launch(launchOptions)
  report.launchOptions = launchOptions
  report.zoomContracts = await verifyExportZoomIsolation(browser, `http://127.0.0.1:${server.httpServer.address().port}/`)
  console.log(`PASSED export zoom isolation: ${report.zoomContracts} ancestor combinations`)
  for (const scenario of scenarios) {
    const directory = path.join(output, scenario.name)
    await mkdir(directory)
    const { work, rendererStress, expected } = buildTextFixture(scenario)
    const result = { ...scenario, coverage:scenario.fractional || scenario.skin ? 'test-only renderer stress' : 'authored capability', failures:[], pages:[] }
    report.cases.push(result)
    const check = (label, assertion) => { try { assertion() } catch (error) { result.failures.push(`${label}: ${error.message}`) } }
    const context = await browser.newContext({ viewport:{ width:900, height:1800 }, deviceScaleFactor:2,
      locale:'zh-CN', reducedMotion:'reduce', serviceWorkers:'block', acceptDownloads:true })
    try {
      const page = await context.newPage(), captures = [], errors = []
      page.on('pageerror', error => errors.push(error.message))
      await context.addInitScript(({ seed, zoom, bodyZoom, rendererStress }) => {
        if (window.top === window) for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)
        else {
          window.__phoneExportRendererStress = rendererStress
          document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.style.zoom = String(zoom)
            if (bodyZoom) document.body.style.zoom = String(bodyZoom)
          })
        }
      }, { seed:authorFixtureSeed(work), zoom:scenario.zoom, bodyZoom:scenario.bodyZoom, rendererStress })
      await context.addInitScript(installExportStorageGuard)
      await page.exposeBinding('__phoneExportTextProbe', async ({ frame }, serialized) => {
        assert.match(frame.url(), /author-phone-render\.html/u)
        const live = await frame.evaluate(measureTextBoxes)
        const ordinal = String(captures.length + 1).padStart(2, '0')
        await writeFile(path.join(directory, `${ordinal}.svg`), decodeURIComponent(serialized.split(',')[1]))
        const clonePage = await context.newPage()
        try {
          await clonePage.setContent('<body style="margin:0;background:#fffafa"></body>')
          await clonePage.evaluate(async serialized => {
            const svg = new DOMParser().parseFromString(decodeURIComponent(serialized.split(',')[1]), 'image/svg+xml')
            document.body.appendChild(document.importNode(svg.querySelector('foreignObject').firstElementChild, true))
            await document.fonts.ready
            await Promise.all([...document.images].map(image => image.decode()))
          }, serialized)
          const geometry = await clonePage.evaluate(measureTextBoxes)
          check(`${ordinal} geometry`, () => assertTextGeometry(live, geometry, live.bubbles.length ? expected : []))
          const reference = await clonePage.locator('.rd-phone-export-viewport').screenshot()
          await writeFile(path.join(directory, `${ordinal}-serialized-native.png`), reference)
          captures.push({ live, geometry, reference })
        } finally { await clonePage.close() }
      })
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
      await openAuthorExport(page, work.id, 'current')
      const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
      await page.evaluate(() => { window.__phoneExportStorageGuard.active = true })
      const pending = page.waitForEvent('download', { timeout:120_000 }).then(value => ({ value }), error => ({ error }))
      await page.locator('[data-author-phone-export-start]').click()
      const download = await pending
      if (download.error) throw download.error
      await download.value.saveAs(path.join(directory, 'export.zip'))
      const entries = Object.entries(unzipSync(await readFile(await download.value.path())))
      assert.equal(entries.length, captures.length)
      assert.ok(entries.length > 0, 'no actual exported PNG')
      assert.ok(captures.some(capture => capture.live.bubbles.length === expected.length), 'authored chat was not captured')
      for (const [index, [filename, bytes]] of entries.entries()) {
        const { live, geometry, reference } = captures[index], ordinal = String(index + 1).padStart(2, '0')
        const raster = compareRaster(bytes, reference, rasterGeometry(geometry))
        await writeFile(path.join(directory, `${ordinal}-export.png`), bytes)
        await writeFile(path.join(directory, `${ordinal}-diff.png`), raster.diff)
        check(`${ordinal} PNG`, () => assertRaster(raster))
        result.pages.push({ filename, live, geometry, mismatch:raster.ratio, regions:raster.regions })
        if (!report.negativeControls.includes('glyph-spill') && assertGlyphControl(reference, geometry)) report.negativeControls.push('glyph-spill')
      }
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.__phoneExportStorageGuard.violations), [])
      assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))), before)
      result.status = result.failures.length ? 'failed' : 'passed'
      console.log(`${result.status.toUpperCase()} ${scenario.name}: ${entries.length} PNG; ${result.failures.join('; ')}`)
    } finally { await context.close() }
  }
  assert.deepEqual(report.negativeControls, ['glyph-spill'])
  report.status = report.cases.every(item => item.status === 'passed') ? 'passed' : 'failed'
  if (report.status !== 'passed') process.exitCode = 1
} catch (error) {
  report.status = 'error'; report.error = error.stack; process.exitCode = 1
  console.error(error)
} finally {
  await browser?.close()
  await server.close()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`Text export evidence: ${output}`)
}
