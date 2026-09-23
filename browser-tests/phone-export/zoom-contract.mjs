import assert from 'node:assert/strict'

// JSDOM drops the zoom CSS property; exercise this layout boundary in a real
// browser instead of replacing its style implementation with a test double.
export async function verifyExportZoomIsolation(browser, baseUrl) {
  const page = await browser.newPage()
  try {
    await page.goto(baseUrl)
    const results = await page.evaluate(async () => {
      const { capturePhonePanelPages } = await import('/reader/phone-content-export.js')
      const results = []
      for (const [htmlZoom, bodyZoom] of [['', ''], ['0.9', ''], ['1.1', ''], ['1.25', '0.8'], ['110%', '90%']]) {
        document.documentElement.style.zoom = htmlZoom
        document.body.style.zoom = bodyZoom
        const source = document.createElement('section')
        source.innerHTML = '<p style="zoom:1.2">消息</p>'
        document.body.appendChild(source)
        const before = [document.documentElement.getAttribute('style'), document.body.getAttribute('style'), source.outerHTML]
        let captured
        try {
          await capturePhonePanelPages(source, {
            rasterize:async viewport => {
              captured = { width:viewport.getBoundingClientRect().width,
                viewportZoom:viewport.style.zoom, childZoom:viewport.querySelector('p').style.zoom }
              return new Blob(['png'], { type:'image/png' })
            },
          })
          results.push({ htmlZoom, bodyZoom, ...captured,
            unchanged:JSON.stringify(before) === JSON.stringify([
              document.documentElement.getAttribute('style'), document.body.getAttribute('style'), source.outerHTML]),
            cleaned:!document.querySelector('.rd-phone-export-stage') })
        } finally { source.remove() }
      }
      return results
    })
    for (const { htmlZoom, bodyZoom, ...result } of results) {
      assert.deepEqual(result, { width:360, viewportZoom:'', childZoom:'1.2', unchanged:true, cleaned:true },
        `export stage zoom isolation ${htmlZoom}/${bodyZoom}`)
    }
    return results.length
  } finally { await page.close() }
}
