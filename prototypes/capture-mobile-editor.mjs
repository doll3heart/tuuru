import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...parts] = argument.replace(/^--/, "").split("=")
  return [key, parts.join("=")]
}))
const port = Number(options.port || 9333)
const width = Number(options.width || 390)
const height = Number(options.height || 844)
const pane = options.pane === "outline" ? "outline" : "editor"
const creator = options.creator === "1" ? "&creator=1" : ""
const output = options.output
if (!output) throw new Error("--output is required")

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
const target = targets.find(item => item.type === "page")
if (!target?.webSocketDebuggerUrl) throw new Error("No debuggable page target")

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once:true })
  socket.addEventListener("error", reject, { once:true })
})

let nextId = 1
const pending = new Map()
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})

function send(method, params = {}) {
  const id = nextId++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue:true, awaitPromise:true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed")
  return result.result.value
}

await send("Page.enable")
await send("Runtime.enable")
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor:1,
  mobile:true,
  screenWidth:width,
  screenHeight:height,
})
await send("Page.navigate", {
  url:`http://127.0.0.1:8766/prototypes/mobile-editor-5d-live.html?pane=${pane}${creator}`,
})

const deadline = Date.now() + 10000
while (Date.now() < deadline) {
  const ready = await evaluate('document.documentElement?.dataset?.editorReady === "true"').catch(() => false)
  if (ready) break
  await new Promise(resolve => setTimeout(resolve, 100))
}
if (!await evaluate('document.documentElement?.dataset?.editorReady === "true"')) {
  const diagnostic = await evaluate(`({
    href:location.href,
    ready:document.readyState,
    title:document.title,
    appText:document.getElementById('app')?.textContent?.slice(0,160) || '',
    bodyText:document.body?.textContent?.slice(0,160) || '',
  })`).catch(error => ({ evaluationError:error.message }))
  throw new Error(`Editor did not become ready: ${JSON.stringify(diagnostic)}`)
}

const audit = await evaluate(`(() => {
  const shell = document.querySelector('.editor-body-area')
  const handles = [...document.querySelectorAll('.wt-node-drag-handle')]
  const tabs = [...document.querySelectorAll('.editor-mobile-view-switch button')]
  const rects = handles.map(handle => handle.getBoundingClientRect())
  return {
    viewport:[innerWidth, innerHeight],
    pane:shell?.dataset.mobilePane,
    noHorizontalOverflow:document.documentElement.scrollWidth <= innerWidth && shell.scrollWidth <= shell.clientWidth,
    tabLabels:tabs.map(button => button.textContent.trim()),
    tabTargetsAtLeast44:tabs.every(button => { const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44 }),
    visibleDragHandles:handles.filter(handle => handle.offsetParent).length,
    dragTargetsAtLeast44:rects.every(rect => rect.width >= 44 && rect.height >= 44),
    commandbarDisplay:getComputedStyle(document.querySelector('.editor-mobile-commandbar')).display,
  }
})()`)

await mkdir(dirname(output), { recursive:true })
const screenshot = await send("Page.captureScreenshot", { format:"png", fromSurface:true })
await writeFile(output, Buffer.from(screenshot.data, "base64"))
socket.close()
process.stdout.write(`${JSON.stringify(audit)}\n`)
