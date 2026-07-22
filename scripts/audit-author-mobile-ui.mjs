import { spawn } from "node:child_process"
import { access, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const vitePort = 18_000 + Math.floor(Math.random() * 500)
const debugPort = 19_000 + Math.floor(Math.random() * 500)
const baseUrlArgIndex = process.argv.indexOf("--base-url")
const externalBaseUrl = baseUrlArgIndex >= 0 ? process.argv[baseUrlArgIndex + 1]?.replace(/\/$/, "") : ""
const baseUrl = externalBaseUrl || `http://127.0.0.1:${vitePort}`

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(100)
  }
  throw new Error(`timed out waiting for ${url}`)
}

async function edgeExecutable() {
  for (const candidate of [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ]) {
    try {
      await access(candidate)
      return candidate
    } catch {}
  }
  throw new Error("Microsoft Edge executable was not found")
}

async function connectCdp() {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()
  const target = targets.find(item => item.type === "page")
  if (!target) throw new Error("Edge did not expose a page target")
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  let sequence = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  }
  return {
    close() { socket.close() },
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
  }
}

async function run() {
  const profile = await mkdtemp(join(tmpdir(), "tuuru-author-audit-"))
  const vite = externalBaseUrl ? null : spawn(process.execPath, [
    join(projectRoot, "node_modules", "vite", "bin", "vite.js"),
    "--config", join(projectRoot, "vite.config.ts"),
    "--host", "127.0.0.1",
    "--port", String(vitePort),
    "--strictPort",
  ], { cwd:projectRoot, stdio:["ignore", "pipe", "pipe"] })
  let edge
  let cdp
  try {
    await waitForHttp(`${baseUrl}/`)
    edge = spawn(await edgeExecutable(), [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ], { stdio:"ignore" })
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`)
    cdp = await connectCdp()
    await cdp.send("Page.enable")
    await cdp.send("Runtime.enable")
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width:390,
      height:844,
      deviceScaleFactor:1,
      mobile:true,
      screenWidth:390,
      screenHeight:844,
    })
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled:true, maxTouchPoints:5 })

    async function evaluate(expression, awaitPromise = false) {
      const result = await cdp.send("Runtime.evaluate", { expression, returnByValue:true, awaitPromise })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result.value
    }
    async function waitFor(expression, timeoutMs = 10_000) {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeoutMs) {
        if (await evaluate(`Boolean(${expression})`)) return
        await delay(80)
      }
      throw new Error(`timed out waiting for ${expression}`)
    }
    async function navigate(url) {
      const navigation = await cdp.send("Page.navigate", { url })
      if (navigation.errorText) throw new Error(navigation.errorText)
      await waitFor("document.body && document.readyState !== 'loading'", 20_000)
      await delay(250)
    }
    async function click(selector) {
      const encoded = JSON.stringify(selector)
      await waitFor(`document.querySelector(${encoded})`)
      await evaluate(`document.querySelector(${encoded}).click()`)
      await delay(120)
    }
    async function realType(selector, text) {
      const encoded = JSON.stringify(selector)
      await waitFor(`document.querySelector(${encoded})`)
      await evaluate(`document.querySelector(${encoded}).focus()`)
      await cdp.send("Input.insertText", { text })
      await delay(250)
    }

    await navigate(`${baseUrl}/`)
    await evaluate(`(async () => {
      localStorage.clear()
      const data = await import('/js/data.js')
      const phone = data.createWork({ type:'phone', title:'手机验收' })
      phone.placeholders = [{ id:'reader-placeholder', key:'某某', label:'读者姓名', prompt:'你的名字？', mode:'each', values:[], default:'读者' }]
      phone.phoneData.contacts = [{ id:'contact-1', name:'顾逢川', msgId:'我推某某', forumId:'某某命', aliases:[], avatarUrl:'' }]
      phone.phoneData.chats = [{ id:'chat-1', type:'single', contactIds:['contact-1'], rounds:[{ id:'round-1', label:'第一轮', messages:[] }] }]
      phone.phoneData.forumPosts = []
      data.updateWork(phone.id, { placeholders:phone.placeholders, phoneData:phone.phoneData })
      data.createWork({ type:'article', title:'文章验收', desc:'用于卡片对齐' })
      window.__auditPhoneId = phone.id
      const phonePage = await import('/js/pages/phone.js')
      window.__auditOpenPhoneApp = phonePage.openPhoneAppModal
      phonePage.openPhoneAppModal(phone.id, 'forum')
    })()`, true)
    await click("#fbAddPost")
    await click("#idOk")
    await realType("#fpContent", "@")
    const forum = await evaluate(`(() => {
      const picker = document.querySelector('.phone-mention-picker')
      const overlay = picker?.closest('.modal-overlay')
      const rect = picker?.getBoundingClientRect()
      return {
        value:document.querySelector('#fpContent')?.value,
        picker:Boolean(picker),
        pickerVisible:Boolean(rect && rect.width > 0 && rect.height > 0),
        pickerZIndex:overlay ? getComputedStyle(overlay).zIndex : '',
        options:Array.from(document.querySelectorAll('.phone-mention-picker-option span')).map(node => node.textContent),
        modalTitles:Array.from(document.querySelectorAll('.modal-title')).map(node => node.textContent),
      }
    })()`)
    await evaluate(`Array.from(document.querySelectorAll('.phone-mention-picker-option')).find(button => button.querySelector('span')?.textContent === '某某')?.click()`)
    forum.insertedValue = await evaluate(`document.querySelector('#fpContent')?.value`)

    await evaluate(`document.querySelectorAll('.modal-overlay').forEach(node => node.remove()); window.__auditOpenPhoneApp(window.__auditPhoneId, 'messages')`)
    await click("[data-chat-id='chat-1']")
    await realType("#chatInput", "@")
    const chat = await evaluate(`(() => {
      const picker = document.querySelector('.phone-mention-picker')
      const overlay = picker?.closest('.modal-overlay')
      const rect = picker?.getBoundingClientRect()
      return {
        value:document.querySelector('#chatInput')?.value,
        picker:Boolean(picker),
        pickerVisible:Boolean(rect && rect.width > 0 && rect.height > 0),
        pickerZIndex:overlay ? getComputedStyle(overlay).zIndex : '',
        options:Array.from(document.querySelectorAll('.phone-mention-picker-option span')).map(node => node.textContent),
        modalTitles:Array.from(document.querySelectorAll('.modal-title')).map(node => node.textContent),
      }
    })()`)
    await evaluate(`Array.from(document.querySelectorAll('.phone-mention-picker-option')).find(button => button.querySelector('span')?.textContent === '我推某某')?.click()`)
    chat.insertedValue = await evaluate(`document.querySelector('#chatInput')?.value`)

    await navigate(`${baseUrl}/`)
    await waitFor("document.querySelectorAll('.work-card-more-btn').length >= 2")
    const cards = await evaluate(`Array.from(document.querySelectorAll('.work-card')).slice(0, 2).map(card => ({
      title:card.querySelector('.work-card-title')?.textContent,
      cardTop:card.getBoundingClientRect().top,
      cardHeight:card.getBoundingClientRect().height,
      actionsTop:card.querySelector('.work-card-actions-left')?.getBoundingClientRect().top,
      actionsHeight:card.querySelector('.work-card-actions-left')?.getBoundingClientRect().height,
      moreTop:card.querySelector('.work-card-more-btn')?.getBoundingClientRect().top,
      footerHeight:card.querySelector('.work-card-actions')?.getBoundingClientRect().height,
    }))`)
    process.stdout.write(JSON.stringify({ forum, chat, cards }, null, 2) + "\n")
    if (!forum.pickerVisible || !chat.pickerVisible || forum.pickerZIndex !== '2200' || chat.pickerZIndex !== '2200') process.exitCode = 1
    if (!forum.options.includes('某某') || forum.insertedValue !== '@某某 ' || chat.insertedValue !== '@我推某某 ') process.exitCode = 1
    if (cards.length === 2 && Math.abs(cards[0].moreTop - cards[1].moreTop) > 0.5) process.exitCode = 1
  } finally {
    cdp?.close()
    if (edge && !edge.killed) edge.kill()
    if (vite && !vite.killed) vite.kill()
    await delay(800)
    await rm(profile, { recursive:true, force:true }).catch(() => {})
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
