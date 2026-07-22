import { spawn, spawnSync } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildShowcaseArticleWork } from "./showcase-article-fixture.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(projectRoot, "samples", "showcase", "screenshots")
const vitePort = 8772
const debugPort = 9342
const viewport = Object.freeze({ width: 390, height: 844 })
const work = buildShowcaseArticleWork()

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms))
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex")
  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Edge screenshot is not a valid PNG")
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
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
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ]
  for (const candidate of candidates) {
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
  await new Promise((resolveSocket, rejectSocket) => {
    socket.onopen = resolveSocket
    socket.onerror = rejectSocket
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
      return new Promise((resolveRequest, rejectRequest) => {
        const id = ++sequence
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
  }
}

async function run() {
  const captureProfile = await mkdtemp(join(tmpdir(), "tuuru-showcase-capture-"))
  const vite = spawn(process.execPath, [
    join(projectRoot, "node_modules", "vite", "bin", "vite.js"),
    "--config", join(projectRoot, "vite.config.ts"),
    "--host", "127.0.0.1",
    "--port", String(vitePort),
    "--strictPort",
  ], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let viteError = ""
  vite.stderr.on("data", chunk => { viteError += chunk.toString() })

  let edge
  let cdp
  try {
    await waitForHttp(`http://127.0.0.1:${vitePort}/reader/`)
    edge = spawn(await edgeExecutable(), [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--no-first-run",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${captureProfile}`,
      "about:blank",
    ], { stdio: "ignore" })
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`)
    cdp = await connectCdp()

    await cdp.send("Page.enable")
    await cdp.send("Runtime.enable")
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    })
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
    await cdp.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    })

    async function evaluate(expression, awaitPromise = false) {
      const result = await cdp.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise,
      })
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      }
      return result.result.value
    }

    async function waitFor(expression, description = expression, timeoutMs = 10_000) {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeoutMs) {
        if (await evaluate(`Boolean(${expression})`)) return
        await delay(80)
      }
      throw new Error(`timed out waiting for ${description}`)
    }

    async function navigate(url) {
      await cdp.send("Page.navigate", { url })
      await waitFor("document.readyState === 'complete'", `page load: ${url}`, 20_000)
      await delay(250)
    }

    async function click(selector) {
      const encoded = JSON.stringify(selector)
      await waitFor(`document.querySelector(${encoded})`, selector)
      const clicked = await evaluate(`(() => {
        const element = document.querySelector(${encoded})
        if (!element || element.disabled) return false
        element.scrollIntoView({ block: 'center', inline: 'nearest' })
        element.click()
        return true
      })()`)
      if (!clicked) throw new Error(`could not click ${selector}`)
      await delay(180)
    }

    async function fill(selector, value) {
      const encodedSelector = JSON.stringify(selector)
      const encodedValue = JSON.stringify(value)
      await waitFor(`document.querySelector(${encodedSelector})`, selector)
      await evaluate(`(() => {
        const input = document.querySelector(${encodedSelector})
        input.value = ${encodedValue}
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })()`)
    }

    await rm(outputDirectory, { recursive: true, force: true })
    await mkdir(outputDirectory, { recursive: true })
    const manifest = []

    async function capture(filename, feature, selector, { scroll = false, settleMs = 300 } = {}) {
      const encoded = JSON.stringify(selector)
      await waitFor(`document.querySelector(${encoded})`, selector)
      if (scroll) {
        await evaluate(`document.querySelector(${encoded}).scrollIntoView({ block: 'start', inline: 'nearest' })`)
      }
      await evaluate(`Promise.race([
        Promise.all(Array.from(document.images)
          .filter(image => image.getClientRects().length > 0)
          .map(image => image.complete ? Promise.resolve() : new Promise(resolveImage => {
            image.addEventListener('load', resolveImage, { once:true })
            image.addEventListener('error', resolveImage, { once:true })
          }))),
        new Promise(resolveImages => setTimeout(resolveImages, 3000))
      ])`, true)
      await delay(settleMs)
      const audit = await evaluate(`(() => ({
        title: document.title,
        viewport: [innerWidth, innerHeight],
        scrollWidth: document.documentElement.scrollWidth,
        text: document.querySelector(${encoded})?.textContent?.trim().slice(0, 180) || ''
      }))()`)
      if (audit.scrollWidth > viewport.width + 1) {
        throw new Error(`${filename} has horizontal overflow: ${audit.scrollWidth}px`)
      }
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      })
      const buffer = Buffer.from(screenshot.data, "base64")
      const dimensions = pngDimensions(buffer)
      if (dimensions.width !== viewport.width || dimensions.height !== viewport.height) {
        throw new Error(`${filename} is ${dimensions.width}x${dimensions.height}, expected ${viewport.width}x${viewport.height}`)
      }
      await writeFile(join(outputDirectory, filename), buffer)
      manifest.push({ file: filename, feature, width: dimensions.width, height: dimensions.height, selector, audit })
      process.stdout.write(`captured ${filename}: ${feature}\n`)
    }

    await navigate(`http://127.0.0.1:${vitePort}/reader/`)
    await evaluate(`(() => {
      localStorage.clear()
      sessionStorage.clear()
      const work = ${JSON.stringify(work)}
      localStorage.setItem('moirain_recent', JSON.stringify([{ id: work.id, title: work.title, type: work.type, importedAt: Date.now() }]))
      localStorage.setItem('moirain_work_' + work.id, JSON.stringify(work))
      localStorage.setItem('moirain_readerSettings', JSON.stringify({ typingEffect: false }))
    })()`)
    await navigate(`http://127.0.0.1:${vitePort}/reader/`)

    await capture("01-reader-library.png", "读者端作品库与导入入口", ".rd-recent-item")
    await click(".rd-recent-item")
    await fill("#rdPwdInput", "2026")
    await fill('[data-ph-id="showcase-placeholder-name"]', "小桃")
    await fill('[data-ph-id="showcase-placeholder-nickname"]', "桃桃")
    await fill('[data-ph-id="showcase-placeholder-webname"]', "桃子汽水")
    await evaluate("document.querySelector('.rd-landing-modal').scrollTop = 0")
    await capture("02-password-placeholders.png", "阅读密码与三项占位符填写", ".rd-landing-modal")
    await click("#rdStartBtn")
    await waitFor("document.querySelector('.article-title')?.textContent.includes('节点1')", "showcase start node")
    await evaluate("scrollTo(0, 0)")
    await capture("03-placeholder-result-watermark.png", "占位符替换、封面与全屏交叉水印", ".article-reader")

    await click(".reader-settings-btn")
    await capture("04-reader-appearance.png", "读者字号、行距、页边距、主题与背景设置", ".rs-sheet")
    await click("#rsClose")

    await click('.article-choice-btn[data-target="showcase-formatting"]')
    await capture("05-rich-text-formatting.png", "标题、粗体、斜体、下划线、引用与对齐", ".article-content", { scroll: true })
    await click('.article-choice-btn[data-target="showcase-picture"]')
    await capture("06-inline-image-watermark.png", "正文内嵌图片与文字层之间的作者水印", ".article-content", { scroll: true })
    await click('.article-choice-btn[data-target="showcase-messages"]')
    await capture("07-article-phone-trigger.png", "文章节点中的消息模块通知入口", '.rd-pm-trigger[data-pm-type="messages"]', { scroll: true })

    await click('.rd-pm-trigger[data-pm-type="messages"]')
    await capture("08-messages-chat-list.png", "消息模块聊天列表", ".rd-phone-app-messages")
    await click('.rd-chat-card[data-chat-index="0"]')
    await capture("09-chat-media-and-voice.png", "文字、图片、语音与消息气泡", "#chatMsgArea")
    await click("#chatSendBtn")
    await capture("10-chat-reply-options.png", "完整回复选项面板", "#rdChoiceList")
    await click('.rd-reply-option[data-ci="0"]')
    await waitFor("document.querySelector('.rd-chat-choice-reselect')", "selected chat reply")
    await capture("11-chat-choice-follow-up.png", "读者回复、后续消息与重选", "#chatMsgArea")
    await click(".rd-pm-back")

    await click('.rd-pm-trigger[data-pm-type="messages"]')
    await click('.rd-chat-card[data-chat-index="1"]')
    await waitFor("document.querySelector('.rd-call-scene')", "call scene")
    await click(".rd-call-advance")
    await capture("12-progressive-audio-call.png", "逐句推进的语音通话场景", ".rd-call-scene")
    await click(".rd-pm-back")

    await click('.rd-pm-trigger[data-pm-type="messages"]')
    await click('.rd-chat-card[data-chat-index="2"]')
    await capture("13-transfer-and-redpacket.png", "统一尺寸的转账与红包卡片", "#chatMsgArea")
    await click(".rd-pm-back")

    await click('.article-choice-btn[data-target="showcase-social"]')
    await capture("14-forum-contacts-node.png", "同一节点中的论坛与联系人模块入口", ".article-content", { scroll: true })
    await click('.rd-pm-trigger[data-pm-type="forum"]')
    await click(".rd-post-card")
    await capture("15-forum-post-comments.png", "论坛帖子、图片、评论与嵌套回复", ".rd-forum-post-body")
    await click(".rd-pm-back")
    await click('.rd-pm-trigger[data-pm-type="contacts"]')
    await capture("16-contacts.png", "联系人头像、姓名、别名与备注", ".rd-contact-book")
    await click(".rd-pm-back")

    await click('.article-choice-btn[data-target="showcase-tools"]')
    await click('.rd-pm-trigger[data-pm-type="memo"]')
    await capture("17-memos.png", "多条富文本备忘录", ".rd-memo-stack")
    await click(".rd-pm-back")
    await click('.rd-pm-trigger[data-pm-type="gallery"]')
    await capture("18-gallery-albums.png", "相册列表与照片数量", ".rd-album-list")
    await click(".rd-album")
    await capture("19-gallery-album-detail.png", "相册二级页面与照片说明", ".rd-gallery-album-back")
    await click(".rd-pm-back")

    await click('.article-choice-btn[data-target="showcase-utilities"]')
    await click('.rd-pm-trigger[data-pm-type="browser"]')
    await capture("20-browser-history.png", "带网址与时间的浏览记录", ".rd-browser-history")
    await click(".rd-pm-back")
    await click('.rd-pm-trigger[data-pm-type="shopping"]')
    await capture("21-shopping-cart.png", "购物车商品页", "#rdShopCart")
    await click('#rdShopOrderTab')
    await capture("22-shopping-orders.png", "已购订单页与购物二级切换", "#rdShopOrder")
    await click(".rd-pm-back")

    await click('.article-choice-btn[data-target="showcase-choice-group"]')
    await capture("23-branch-options.png", "双分支选项组", ".article-choices", { scroll: true })
    await click('.article-choice-btn[data-target="showcase-branch-a"]')
    await capture("24-branch-a-and-back.png", "分支A内容与返回上一节按钮", ".article-reader")
    await click('.article-choice-btn[data-target="showcase-merge"]')
    await capture("25-branch-merge.png", "两条路线汇流到公共节点", ".article-reader")
    await click('.article-choice-btn[data-target="showcase-loop"]')
    await capture("26-loop-and-ending-options.png", "回到首节点或进入结束页的回环选项", ".article-choices", { scroll: true })

    const manifestPath = join(outputDirectory, "manifest.json")
    await writeFile(manifestPath, `${JSON.stringify({ viewport, screenshots: manifest }, null, 2)}\n`, "utf8")

    const cards = manifest.map(item => `<article><img src="${item.file}" alt="${item.feature}"><h2>${item.file}</h2><p>${item.feature}</p></article>`).join("")
    const contactSheetHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Tuuru 全功能展示截图</title><style>body{margin:0;padding:32px;background:#2b2829;color:#fff;font-family:system-ui,sans-serif}header{max-width:1280px;margin:0 auto 28px}h1{font-size:32px;margin:0 0 8px}.grid{max-width:1280px;margin:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}article{margin:0;background:#f6eff0;color:#40383b;padding:10px;border-radius:14px;box-shadow:0 12px 30px #0005}img{display:block;width:100%;height:auto;border-radius:8px}h2{font-size:13px;margin:10px 3px 4px;overflow-wrap:anywhere}p{font-size:12px;line-height:1.45;margin:0 3px 5px;color:#66585d}</style></head><body><header><h1>Tuuru 全功能展示 · 移动端截图</h1><p>${manifest.length} 张真实 390×844 阅读器截图</p></header><main class="grid">${cards}</main></body></html>`
    await writeFile(join(outputDirectory, "contact-sheet.html"), contactSheetHtml, "utf8")

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1400,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1400,
      screenHeight: 1200,
    })
    await navigate(`http://127.0.0.1:${vitePort}/samples/showcase/screenshots/contact-sheet.html`)
    await waitFor("document.images.length > 0 && Array.from(document.images).every(image => image.complete)", "contact sheet images", 20_000)
    const metrics = await cdp.send("Page.getLayoutMetrics")
    const contentSize = metrics.cssContentSize || metrics.contentSize
    const sheet = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(contentSize.width), height: Math.ceil(contentSize.height), scale: 1 },
    })
    await writeFile(join(outputDirectory, "contact-sheet.png"), Buffer.from(sheet.data, "base64"))
    process.stdout.write(`captured contact-sheet.png with ${manifest.length} mobile screenshots\n`)
  } finally {
    if (cdp) cdp.close()
    if (edge && edge.pid && process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" })
    } else if (edge && !edge.killed) {
      edge.kill()
    }
    if (vite && !vite.killed) vite.kill()
    await delay(900)
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await rm(captureProfile, { recursive: true, force: true })
        break
      } catch (error) {
        if (attempt === 3) {
          process.stderr.write(`warning: temporary Edge profile remains at ${captureProfile}: ${error.message}\n`)
          break
        }
        await delay(500)
      }
    }
    if (vite.exitCode && vite.exitCode !== 0 && viteError) process.stderr.write(viteError)
  }
}

await run()
