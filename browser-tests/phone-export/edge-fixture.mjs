import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { buildFixture } from './fixture.mjs'

export const EDGE_CASES = [
  { name:'oversized-message', width:390, mode:'current', group:true, edge:'oversized' },
  { name:'image-404', width:390, mode:'current', group:false, edge:'404', expect:'warning' },
  { name:'image-timeout', width:390, mode:'current', group:false, edge:'timeout', expect:'warning' },
  { name:'image-cors', width:390, mode:'current', group:false, edge:'cors', expect:'warning' },
  { name:'image-cors-allowed', width:390, mode:'current', group:false, edge:'cors-allowed' },
  { name:'image-all-failed', width:390, mode:'current', group:false, edge:'cors', expect:'error', chatOnly:true },
  { name:'css-image-cors', width:390, mode:'current', group:false, edge:'css-cors', expect:'error' },
  { name:'css-image-cors-allowed', width:390, mode:'current', group:false, edge:'css-cors-allowed' },
  { name:'font-complex-css', width:390, mode:'current', group:true, edge:'font-css' },
]

export const EDGE_IMAGE_QUERY = 'token=fixture%2Bvalue&part=one%20two'

export function isExpectedCorsDiagnostic(message, { engine, edge, assetOrigin }) {
  if (engine !== 'webkit' || !['cors', 'css-cors'].includes(edge)) return false
  const filename = edge === 'css-cors' ? 'wallpaper.png' : 'message.png'
  const diagnostic = `${assetOrigin}/${edge}/${filename}?${EDGE_IMAGE_QUERY} due to access control checks.`
  // Playwright may split the error at the URL's first colon, leaving /host/path.
  // Match known full messages, never the word "cors" inside an arbitrary URL.
  return [diagnostic, `Fetch API cannot load ${diagnostic}`, diagnostic.replace(/^http:\//, '')].includes(message)
}

export async function loadFixtureFont() {
  // Read a locally installed font, never redistribute it or fetch a public CDN.
  const candidates = process.platform === 'win32' ? ['C:/Windows/Fonts/arial.ttf']
    : process.platform === 'darwin' ? ['/System/Library/Fonts/Supplemental/Arial.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']
  for (const filename of candidates) {
    try { return { filename, data:`data:font/ttf;base64,${(await readFile(filename)).toString('base64')}` } }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error(`Install a fixture font at one of: ${candidates.join(', ')}`)
}

export function buildEdgeFixture(scenario, { assetOrigin, fontData } = {}) {
  const fixture = buildFixture(scenario)
  const common = fixture.work.phoneData.chats[0].rounds[0].messages
  if (scenario.edge === 'oversized') {
    common.find(message => message.id === 'long-self').text = Array.from({ length:180 }, (_, index) =>
      `LINE_${String(index + 1).padStart(3, '0')} 跨页内容连续，不能丢行。`).join('\n')
    fixture.oversizedIds = ['long-self']
  }
  if (['404', 'timeout', 'cors', 'cors-allowed'].includes(scenario.edge)) {
    assert.ok(assetOrigin, 'image edge fixture requires a second loopback origin')
    common.find(message => message.id === 'image').image = `${assetOrigin}/${scenario.edge}/message.png?${EDGE_IMAGE_QUERY}`
    // Keep a meaningful slot even when the native <img> never finishes loading.
    fixture.rendererStress.customCss = '.chat-bubble img { width:120px; height:84px; object-fit:cover; }'
  }
  if (['css-cors', 'css-cors-allowed'].includes(scenario.edge)) {
    assert.ok(assetOrigin, 'CSS image fixture requires a second loopback origin')
    fixture.work.phoneData.skin.wallpaperType = 'image'
    fixture.work.phoneData.skin.wallpaperImage = `${assetOrigin}/${scenario.edge}/wallpaper.png?${EDGE_IMAGE_QUERY}`
  }
  if (scenario.chatOnly) {
    // Export job discovery keys Contacts off contact records, not the desktop app list.
    // The chat deliberately retains its now-unresolved contact id and still renders
    // with the reader fallback identity, while no independent Contacts job is added.
    fixture.work.phoneData.contacts = []
    fixture.work.phoneData.apps = fixture.work.phoneData.apps.filter(app => app.type === 'messages')
  }
  if (scenario.edge === 'font-css') {
    assert.ok(fontData, 'font fixture requires real imported font bytes')
    fixture.work.editorSettings = {customFonts:[{ name:'ExportFixtureFont', data:fontData }]}
    fixture.work.phoneData.skin.fontFamily = '"ExportFixtureFont", serif'
    fixture.rendererStress.customCss = `
      .chat-bubble:not(.rd-voice-message) {
        font-family:"ExportFixtureFont", serif; font-size:15.75px !important; line-height:1.65 !important;
        letter-spacing:0.35px; border:2px solid #73517e; border-radius:13px 5px 17px 9px;
        background:linear-gradient(135deg, #f5e9fb, #e2eff9) !important; color:#30213b;
        box-shadow:2px 3px 0 #c9b7d0; text-shadow:0.25px 0.25px 0 #e1cde9;
      }
      .chat-bubble:not(.rd-voice-message)::before { content:"DECOR_START"; display:block; font-size:8.5px; line-height:13px; letter-spacing:1px; }
      .chat-bubble:not(.rd-voice-message)::after { content:"DECOR_END"; display:block; font-size:9.25px; line-height:14px; }
    `
  }
  return fixture
}

export async function startEdgeAssetServer(imageBytes) {
  const requests = []
  const server = createServer((request, response) => {
    const parsed = new URL(request.url, 'http://127.0.0.1')
    const pathname = parsed.pathname
    const kind = pathname.split('/')[1]
    requests.push({ kind, pathname, search:parsed.search, url:`${pathname}${parsed.search}`, origin:request.headers.origin || null, time:Date.now() })
    if (kind === 'timeout') return // Deliberately pending until context/server cleanup.
    response.writeHead(kind === '404' ? 404 : 200, { 'Content-Type':'image/png', 'Cache-Control':'no-store',
      // Exercise HTTP failure separately from the explicit CORS-denial cases.
      ...(kind === '404' || kind.endsWith('cors-allowed') ? { 'Access-Control-Allow-Origin':'*' } : {}) })
    response.end(kind === '404' ? undefined : imageBytes)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    origin:`http://127.0.0.1:${server.address().port}`, requests,
    async close() {
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
