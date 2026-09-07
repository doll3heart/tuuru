import test from 'node:test'
import assert from 'node:assert/strict'
import { EDGE_CASES, EDGE_IMAGE_QUERY, buildEdgeFixture, isExpectedCorsDiagnostic, startEdgeAssetServer } from '../browser-tests/phone-export/edge-fixture.mjs'

test('expected CORS diagnostics match only the exact fixture resource and browser error', () => {
  const config = { engine:'webkit', edge:'cors', assetOrigin:'http://127.0.0.1:3456' }
  const resource = `${config.assetOrigin}/cors/message.png?${EDGE_IMAGE_QUERY}`
  const diagnostic = `${resource} due to access control checks.`
  assert.equal(isExpectedCorsDiagnostic(diagnostic, config), true)
  assert.equal(isExpectedCorsDiagnostic(`Fetch API cannot load ${diagnostic}`, config), true)
  assert.equal(isExpectedCorsDiagnostic(diagnostic.replace('http:/', ''), config), true)
  assert.equal(isExpectedCorsDiagnostic(`TypeError: rendering failed for ${resource}`, config), false, 'a /cors/ path is not an error marker')
  for (const invalid of [
    diagnostic.replace(':3456/', ':34560/'), diagnostic.replace('message.png', 'other.png'),
    diagnostic.replace(EDGE_IMAGE_QUERY, 'token=wrong'), `${diagnostic} Unexpected crash`,
  ]) assert.equal(isExpectedCorsDiagnostic(invalid, config), false, invalid)
  for (const changes of [{ engine:'chromium' }, { edge:'404' }, { edge:'cors-allowed' }, { edge:undefined }]) {
    assert.equal(isExpectedCorsDiagnostic(diagnostic, { ...config, ...changes }), false)
  }
  const cssDiagnostic = `${config.assetOrigin}/css-cors/wallpaper.png?${EDGE_IMAGE_QUERY} due to access control checks.`
  assert.equal(isExpectedCorsDiagnostic(cssDiagnostic, { ...config, edge:'css-cors' }), true)
  assert.equal(isExpectedCorsDiagnostic(cssDiagnostic, config), false)
})

test('edge fixtures contain numbered oversized content, external URLs and a real import configuration', () => {
  const scenario = name => EDGE_CASES.find(item => item.name === name)
  const oversized = buildEdgeFixture(scenario('oversized-message'))
  const text = oversized.work.phoneData.chats[0].rounds[0].messages.find(item => item.id === 'long-self').text
  assert.equal(text.split('\n').length, 180)
  assert.match(text, /LINE_001 /)
  assert.match(text, /LINE_180 /)
  for (const edge of ['404', 'timeout', 'cors', 'cors-allowed']) {
    const fixture = buildEdgeFixture(EDGE_CASES.find(item => item.edge === edge), { assetOrigin:'http://127.0.0.1:3456' })
    assert.equal(fixture.work.phoneData.chats[0].rounds[0].messages.find(item => item.id === 'image').image,
      `http://127.0.0.1:3456/${edge}/message.png?${EDGE_IMAGE_QUERY}`)
  }
  const failedOnly = buildEdgeFixture(scenario('image-all-failed'), { assetOrigin:'http://127.0.0.1:3456' })
  assert.deepEqual(failedOnly.work.phoneData.apps.map(app => app.type), ['messages'])
  assert.deepEqual(failedOnly.work.phoneData.contacts, [])
  for (const edge of ['css-cors', 'css-cors-allowed']) {
    const fixture = buildEdgeFixture(EDGE_CASES.find(item => item.edge === edge), { assetOrigin:'http://127.0.0.1:3456' })
    assert.equal(fixture.work.phoneData.skin.wallpaperType, 'image')
    assert.equal(fixture.work.phoneData.skin.wallpaperImage, `http://127.0.0.1:3456/${edge}/wallpaper.png?${EDGE_IMAGE_QUERY}`)
  }
  assert.throws(() => buildEdgeFixture(scenario('font-complex-css')), /real imported font bytes/)
  const font = buildEdgeFixture(scenario('font-complex-css'), { fontData:'data:font/ttf;base64,Zml4dHVyZQ==' })
  assert.equal(font.work.editorSettings.customFonts[0].name, 'ExportFixtureFont')
  assert.match(font.work.editorSettings.customFonts[0].data, /^data:font\/ttf/)
  assert.match(font.rendererStress.customCss, /DECOR_START/)
  assert.match(font.rendererStress.customCss, /DECOR_END/)
})

test('loopback fixture serves controlled 404 and CORS headers and closes pending requests', async () => {
  const bytes = Buffer.from('fixture-image')
  const server = await startEdgeAssetServer(bytes)
  try {
    const missing = await fetch(`${server.origin}/404/message.png`)
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('access-control-allow-origin'), '*', 'HTTP failure must remain readable independently of CORS denial')
    const denied = await fetch(`${server.origin}/cors/message.png`)
    assert.equal(denied.headers.get('access-control-allow-origin'), null)
    assert.deepEqual(Buffer.from(await denied.arrayBuffer()), bytes)
    const allowed = await fetch(`${server.origin}/cors-allowed/message.png`)
    assert.equal(allowed.headers.get('access-control-allow-origin'), '*')
    assert.deepEqual(Buffer.from(await allowed.arrayBuffer()), bytes)
    const cssAllowed = await fetch(`${server.origin}/css-cors-allowed/wallpaper.png?token=fixture%2Bvalue&part=one%20two`)
    assert.equal(cssAllowed.headers.get('access-control-allow-origin'), '*')
    assert.equal(server.requests.at(-1).url, '/css-cors-allowed/wallpaper.png?token=fixture%2Bvalue&part=one%20two')
    const controller = new AbortController()
    const pending = fetch(`${server.origin}/timeout/message.png`, { signal:controller.signal }).catch(error => error)
    // Wait for the request to reach the fixture, not an arbitrary multi-second sleep.
    const deadline = Date.now() + 2000
    while (!server.requests.some(request => request.kind === 'timeout') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    assert.ok(server.requests.some(request => request.kind === 'timeout'))
    controller.abort()
    assert.equal((await pending).name, 'AbortError')
  } finally {
    await server.close()
  }
})
