// Isolated diagnostic: distinguish clone/style loss from SVG-image painting.
// Scaling variants and a resolution sentinel are evidence, not production fixes.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { chromium, webkit } from 'playwright'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const root = fileURLToPath(new URL('../../', import.meta.url))
const artifacts = path.join(root, 'artifacts/phone-export-browser')
await mkdir(artifacts, { recursive:true })
const output = await mkdtemp(path.join(artifacts, 'raster-probe-'))
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box} body{margin:0}
#fixture{width:360px;height:510px;background:#f0f0f0;padding:12px;font:13px/19.5px Consolas,"Microsoft YaHei",monospace}
.bubble{width:180px;border:1px solid #8f7b81;border-radius:13px 5px 0 13px;padding:10px 12px;background:#fff;box-shadow:2px 2px 0 #baa9ad}
.avatar{margin-top:8px;width:36px;height:36px;border-radius:50%;background:#d747ef;box-shadow:2px 2px 0 #baa9ad;display:grid;place-items:center}
.shadow{margin-top:12.25px;width:180px;padding:12px;border-radius:12px;background:#e7d8dc;box-shadow:2px 3px 4px #ba939f;font-size:15.75px;line-height:23.625px;text-shadow:.25px .25px #bb7788}
</style><div id="fixture"><div class="bubble">中英文长消息：雨停之后再出发，先确认转账和行程。Layout 123，标点与换行都应留在气泡里面。中英文长消息：雨停之后再出发，先确认转账和行程。</div><div class="avatar">林</div><div class="shadow">阴影与圆角<br>Font 15.75 中文<br>Shadow ABC 123</div></div>`
const server = await createServer({ root, configFile:false, logLevel:'warn', server:{host:'127.0.0.1',port:0,watch:null},
  plugins:[{name:'raster-probe-page',configureServer(s){s.middlewares.use('/__raster_probe',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)})}}],
})
const report = []
try {
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [name, engine] of Object.entries({chromium,webkit})) {
    const browser = await engine.launch({headless:true})
    try {
      const page = await browser.newPage({viewport:{width:600,height:800},deviceScaleFactor:2})
      await page.goto(`${origin}/__raster_probe`,{waitUntil:'domcontentloaded',timeout:20000})
      const result = await page.evaluate(async () => {
        const {toSvg,toCanvas} = await import('/node_modules/html-to-image/es/index.js')
        // Keep this independent of computed-style cloning: the same CSS must
        // be evaluated by the live page and by the internal SVG-image page.
        const sentinelMarkup = '<style>#resolution-sentinel{width:10px;height:10px;background:rgb(255,0,0)}@media(min-resolution:1.5dppx){#resolution-sentinel{background:rgb(0,255,0)}}</style><div id="resolution-sentinel"></div>'
        const sentinel = document.createElement('div')
        sentinel.innerHTML = sentinelMarkup
        document.body.append(sentinel)
        const resolution = {devicePixelRatio:window.devicePixelRatio,
          nativeHighResolution:matchMedia('(min-resolution:1.5dppx)').matches,
          nativeColor:getComputedStyle(sentinel.querySelector('#resolution-sentinel')).backgroundColor}
        sentinel.remove()
        const sentinelImage = new Image()
        sentinelImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">' + sentinelMarkup + '</div></foreignObject></svg>')
        await sentinelImage.decode()
        const sentinelCanvas = document.createElement('canvas')
        sentinelCanvas.width=20;sentinelCanvas.height=20
        const sentinelContext = sentinelCanvas.getContext('2d')
        sentinelContext.drawImage(sentinelImage,0,0,20,20)
        resolution.svgRgba = [...sentinelContext.getImageData(10,10,1,1).data]
        const node = document.querySelector('#fixture')
        const cssTextLength = getComputedStyle(node).cssText.length
        const options = {width:360,height:510,pixelRatio:2,skipFonts:true,includeStyleProperties:Array.from(getComputedStyle(document.documentElement)).filter(p=>p!=='font-size')}
        for(const element of [node,...node.querySelectorAll('*')]) element.style.setProperty('font-size',getComputedStyle(element).fontSize,'important')
        const svg = await toSvg(node,options)
        const normal = (await toCanvas(node,options)).toDataURL()
        const parsed = new DOMParser().parseFromString(decodeURIComponent(svg.split(',')[1]),'image/svg+xml')
        const markup = new XMLSerializer().serializeToString(parsed.querySelector('foreignObject').firstElementChild)
        const sourceStyles = ['.bubble','.avatar','.shadow'].map(selector => ({selector,
          boxShadow:getComputedStyle(node.querySelector(selector)).boxShadow,
          radius:getComputedStyle(node.querySelector(selector)).borderRadius,
          lineHeight:getComputedStyle(node.querySelector(selector)).lineHeight,
        }))
        parsed.documentElement.setAttribute('width','720')
        parsed.documentElement.setAttribute('height','1020')
        const enlargedSvg = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(parsed))
        const image = new Image()
        image.src = enlargedSvg
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width=720;canvas.height=1020
        canvas.getContext('2d').drawImage(image,0,0,720,1020)
        const intrinsic = canvas.toDataURL()
        // Unlike enlarging an SVG viewBox, CSS zoom makes the foreign HTML
        // perform its layout/paint at output-pixel scale before SVG rendering.
        parsed.documentElement.setAttribute('viewBox','0 0 720 1020')
        parsed.querySelector('#fixture').style.setProperty('zoom','2','important')
        const zoomImage = new Image()
        zoomImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(parsed))
        await zoomImage.decode()
        canvas.getContext('2d').clearRect(0,0,720,1020)
        canvas.getContext('2d').drawImage(zoomImage,0,0,720,1020)
        return {cssTextLength,svg,normal,markup,sourceStyles,intrinsic,zoom:canvas.toDataURL(),resolution}
      })
      const nativeBytes = await page.locator('#fixture').screenshot()
      await writeFile(path.join(output,`${name}-native.png`),nativeBytes)
      await writeFile(path.join(output,`${name}-original.svg`),decodeURIComponent(result.svg.split(',')[1]))
      const cloneStyles = await page.evaluate(markup => {
        document.head.querySelectorAll('style,link').forEach(element=>element.remove())
        document.body.innerHTML=markup
        document.body.style.margin='0'
        return ['.bubble','.avatar','.shadow'].map(selector => ({selector,
          boxShadow:getComputedStyle(document.querySelector(selector)).boxShadow,
          radius:getComputedStyle(document.querySelector(selector)).borderRadius,
          lineHeight:getComputedStyle(document.querySelector(selector)).lineHeight,
        }))
      },result.markup)
      const cloneBytes = await page.locator('#fixture').screenshot()
      result.clone = `data:image/png;base64,${cloneBytes.toString('base64')}`
      const reference=PNG.sync.read(nativeBytes)
      const ratios={}
      for(const mode of ['normal','intrinsic','clone','zoom']) {
        const bytes=Buffer.from(result[mode].split(',')[1],'base64')
        const png=PNG.sync.read(bytes), diff=new PNG({width:png.width,height:png.height})
        ratios[mode]=pixelmatch(reference.data,png.data,diff.data,png.width,png.height,{threshold:.15})/(png.width*png.height)
        await writeFile(path.join(output,`${name}-${mode}.png`),bytes)
        await writeFile(path.join(output,`${name}-${mode}-diff.png`),PNG.sync.write(diff))
      }
      report.push({name,cssTextLength:result.cssTextLength,ratios,sourceStyles:result.sourceStyles,cloneStyles,resolution:result.resolution})
      console.log(JSON.stringify(report.at(-1)))
    } finally {await browser.close()}
  }
} finally {
  await server.close()
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))
  console.log(output)
}
