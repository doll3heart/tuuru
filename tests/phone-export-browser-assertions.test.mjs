import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { PNG } from 'pngjs'
import { assertGeometry, assertPagination, compareRaster, assertRaster } from '../browser-tests/phone-export/assertions.mjs'
import { buildFixture, CASES } from '../browser-tests/phone-export/fixture.mjs'
import { exportProbePlugin } from '../browser-tests/phone-export/probe.mjs'

const row = (id, y, height = 30) => ({ id, x:10, y, width:100, height, contents:[], bubbles:[] })
const geometry = rows => ({ width:360, height:650, top:0, contentHeight:644, panelHeight:644, panelOffset:0, rows, images:[] })

test('browser oracle rejects displaced cards and overlapping rows, including rows without bubbles', () => {
  const a = row('text', 20), b = row('transfer', 70)
  b.contents.push({ x:10, y:70, width:100, height:30 })
  assertGeometry(geometry([a, b]))
  b.contents[0].y = 0
  assert.throws(() => assertGeometry(geometry([a, b])), /escapes/)
  assert.throws(() => assertGeometry(geometry([a, row('call', 25)])), /overlap/)
})

test('browser oracle rejects text escaping the bubble and undecoded images', () => {
  const a = row('text', 20)
  a.bubbles.push({ x:10, y:20, width:100, height:30, lines:[{ x:10, y:21, width:99, height:20 }] })
  assertGeometry(geometry([a]))
  a.bubbles[0].lines[0].width = 130
  assert.throws(() => assertGeometry(geometry([a])), /text clipping/)
  assert.throws(() => assertGeometry({ ...geometry([]), images:[{ complete:true, width:0 }] }), /decode/)
})

test('browser pagination oracle rejects a split message even when page windows remain continuous', () => {
  const rows = [row('owner', 0), row('transfer', 580, 60), row('ending', 700)]
  const pages = [
    { ...geometry(rows), contentHeight:650, panelHeight:900 },
    { ...geometry(rows), top:650, contentHeight:250, panelHeight:900 },
  ]
  assertPagination(pages, ['transfer'])
  pages[0].contentHeight = 610
  pages[1].top = 610
  pages[1].contentHeight = 290
  assert.throws(() => assertPagination(pages, ['transfer']), /page cut/)
  pages[1].top = 615
  assert.throws(() => assertPagination(pages, ['transfer']), /gap/)
})

test('browser raster oracle decodes ZIP Uint8Array input and detects local damage below the page-wide threshold', () => {
  const baseline = new PNG({ width:720, height:1300 })
  baseline.data.fill(255)
  const reference = PNG.sync.write(baseline)
  const layout = geometry([{ ...row('card', 200, 30), width:30 }])
  assertRaster(compareRaster(new Uint8Array(reference), reference, layout))
  for (let y = 402; y < 450; y++) for (let x = 22; x < 70; x++) {
    baseline.data.set([0, 0, 0, 255], (y * baseline.width + x) * 4)
  }
  const damaged = compareRaster(PNG.sync.write(baseline), reference, layout)
  assert.ok(damaged.ratio < 0.01)
  assert.throws(() => assertRaster(damaged), /message card differs/)
})

test('browser fixture covers all message families, nested branches and both bubble skin modes', () => {
  const { work, commonIds } = buildFixture(CASES[0])
  const rounds = work.phoneData.chats[0].rounds
  assert.equal(new Set(commonIds).size, commonIds.length)
  assert.deepEqual([...new Set(rounds[0].messages.map(item => item.type))].sort(), [
    'time', 'system', 'text', 'transfer', 'redpacket', 'image', 'voice', 'link', 'familycard', 'takeaway',
    'location', 'contact-card', 'file', 'music', 'forward', 'schedule', 'call', 'system-event', 'contact-event',
  ].sort())
  assert.equal(rounds[1].messages[0].choices[1].endRound, true)
  assert.equal(rounds[1].messages[1].visibleAfterChoiceId, 'A')
  for (const mode of ['full', 'slice']) {
    const custom = buildFixture(CASES.find(item => item.skin === mode)).rendererStress.appSettings.messages
    assert.equal(custom.selfBubbleSkinMode, mode)
    assert.match(custom.otherBubbleSkinImage, /^data:image\/png;base64,/)
  }
})

test('browser observer wraps only the real exporter import and fails loudly if the hook becomes stale', () => {
  const plugin = exportProbePlugin()
  const source = 'import { toBlob } from "html-to-image"\nexport const capture = () => toBlob()'
  assert.equal(plugin.transform(source, '/unrelated.js'), undefined)
  const instrumented = plugin.transform(source, 'D:\\Projects\\Tuuru\\reader\\phone-content-export.js')
  assert.match(instrumented, /return realToBlob\(node, options\)/)
  assert.match(instrumented, /Missing browser export observer/)
  assert.match(instrumented, /node.ownerDocument.defaultView/)
  assert.match(instrumented, /ownerWindow.__phoneExportBeforeRaster\(\)/)
  assert.throws(() => plugin.transform('changed', '/reader/phone-content-export.js'), /no longer matches/)
})

test('renderer stress is author-frame-only instrumentation and absent from production sources', async () => {
  const source = await readFile(new URL('../reader/reader.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /__phoneExportRendererStress/)
  const instrumented = exportProbePlugin().transform(source, '/reader/reader.js')
  assert.match(instrumented, /if \(authorPhoneRenderDocument\) return normalizePhoneCustom\(Object.assign/)
  assert.match(instrumented, /window.__phoneExportRendererStress/)
  assert.throws(() => exportProbePlugin().transform('changed', '/reader/reader.js'), /stress probe no longer matches/)
})

test('one-shot export acceptance disables the resolved Vite watcher without changing app config', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const server = await createServer({ root, configFile:fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    plugins:[exportProbePlugin()], server:{ host:'127.0.0.1', port:0, open:false }, logLevel:'silent' })
  try {
    // A null inline config override is dropped by Vite's config-file merge.
    // Verify the final server, not merely a plugin's returned options.
    assert.equal(server.config.server.watch, null)
    assert.equal(server.watcher.constructor.name, 'NoopWatcher')
    assert.deepEqual(server.watcher.getWatched(), {})
  } finally {
    await server.close()
  }
})
