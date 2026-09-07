import assert from "node:assert/strict"
import test from "node:test"

import { JSDOM } from "jsdom"
import { strFromU8, unzipSync } from "fflate"

import {
  capturePhonePanelPages,
  createPhoneContentArchive,
  maskPhoneExportClone,
  maskPhoneExportText,
  phoneExportArchiveName,
  phoneExportBaseName,
  phoneExportBranchLabel,
  phoneExportPageWindows,
  placeholderMaskValues,
  safePhoneExportSegment,
} from "../reader/phone-content-export.js"

const TRANSPARENT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="

test("phone image export filenames remain portable and descriptive", () => {
  assert.equal(safePhoneExportSegment(' 夏夜/回声:*?"<>| '), "夏夜-回声")
  assert.equal(safePhoneExportSegment("...", "未命名"), "未命名")
  assert.equal(
    phoneExportBaseName({ workTitle:"夏夜/回声", moduleLabel:"消息", itemLabel:"林檎:夜聊" }),
    "夏夜-回声-消息-林檎-夜聊",
  )
  assert.equal(phoneExportArchiveName("夏夜/回声"), "夏夜-回声-小手机图片.zip")
  assert.equal(phoneExportArchiveName("夏夜/回声", "current"), "夏夜-回声-小手机图片.zip")
  assert.equal(phoneExportArchiveName("夏夜/回声", "all"), "夏夜-回声-小手机全部分支图片.zip")
})

test("phone branch labels begin with a deterministic ordinal and preserve authored option order", () => {
  assert.equal(
    phoneExportBranchLabel([
      { ownerOrder:0, choiceIndex:1, label:"去码头" },
      { ownerOrder:1, choiceIndex:0, label:"等雨停" },
    ], 0, 3),
    "分支01-选项1.2-去码头→选项2.1-等雨停",
  )
  assert.equal(phoneExportBranchLabel([], 0, 3), "")
  assert.equal(
    phoneExportBranchLabel([
      { ownerOrder:8, choiceIndex:4, label:"😀甲😀乙😀丙😀丁😀戊😀己😀庚" },
    ], 123, 124),
    "分支124-选项9.5-😀甲😀乙😀丙😀丁😀戊😀己",
  )
})

test("phone branch labels bound readable labels by Unicode code points before filename sanitizing", () => {
  const label = phoneExportBranchLabel([
    { ownerOrder:0, choiceIndex:0, label:"😀😀😀😀😀😀😀😀😀😀😀😀😀/码头" },
  ], 0, 1)

  assert.equal(label, "分支01-选项1.1-😀😀😀😀😀😀😀😀😀😀😀😀")
})

test("phone branch labels mask complete placeholder values before truncation and sanitizing", () => {
  const label = phoneExportBranchLabel([
    { ownerOrder:0, choiceIndex:0, label:"ABCDEFGHIJKLMNO小雨/长名字" },
  ], 0, 1, { maskValues:["ABCDEFGHIJKLMNO", "小雨/长名字"] })

  assert.doesNotMatch(label, /ABCDEFGHIJKLMNO|ABCDEFGHIJKL|小雨\/长名字|小雨-长名字/)
  assert.match(label, /▖▜▖▗/)
})

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1
        continue
      }
      return true
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return true
  }
  return false
}

test("branch-only filename truncation never splits a surrogate pair at the 80-unit boundary", () => {
  const path = Array.from({ length:4 }, (_, ownerOrder) => ({
    ownerOrder,
    choiceIndex:0,
    label:"😀".repeat(12),
  }))
  const branchLabel = phoneExportBranchLabel(path, 0, 1)
  const baseName = phoneExportBaseName({
    workTitle:"作品",
    moduleLabel:"消息",
    itemLabel:`${branchLabel}-聊天`,
    unicodeSafeItemLabel:true,
  })

  assert.ok(branchLabel.length <= 80)
  assert.equal(hasLoneSurrogate(branchLabel), false)
  assert.equal(hasLoneSurrogate(baseName), false)
})

test("placeholder masks cover reader values, defaults, authored variants, and scene values", () => {
  const placeholders = [{
    id:"reader-name",
    key:"NAME",
    default:"小雨",
    values:["阿雾", "阿雾同学"],
    sceneMap:{ night:"夜行者" },
  }]
  const values = placeholderMaskValues(placeholders, { "reader-name":["宝宝"] })
  assert.deepEqual(values, ["阿雾同学", "NAME", "夜行者", "阿雾", "宝宝", "小雨"])
  assert.equal(
    maskPhoneExportText("宝宝和阿雾同学都看见了 NAME。", values),
    "▖▜▖▗和▖▜▖▗都看见了 ▖▜▖▗。",
  )
})

test("masking an export clone never mutates the live reader panel", () => {
  const dom = new JSDOM(`<!doctype html><div id="panel" aria-label="和宝宝聊天"><p>宝宝：晚安</p><img alt="宝宝头像"><input value="宝宝"></div>`)
  const source = dom.window.document.querySelector("#panel")
  const clone = maskPhoneExportClone(source, ["宝宝"])

  assert.equal(source.textContent, "宝宝：晚安")
  assert.equal(source.getAttribute("aria-label"), "和宝宝聊天")
  assert.equal(clone.textContent, "▖▜▖▗：晚安")
  assert.equal(clone.getAttribute("aria-label"), "和▖▜▖▗聊天")
  assert.equal(clone.querySelector("img").getAttribute("alt"), "▖▜▖▗头像")
  assert.equal(clone.querySelector("input").value, "▖▜▖▗")
})

test("export clones mask only reader-owned avatars and preserve character avatars", () => {
  const dom = new JSDOM(`<!doctype html><section id="panel">
    <div class="chat-avatar rd-reader-chat-avatar" style="background-image:url(reader.png)"><img src="reader.png" alt=""></div>
    <div class="chat-avatar npc-avatar"><img src="character.png" alt=""></div>
    <span class="rd-forum-account-avatar"><img src="reader-account.png" alt=""></span>
    <article class="forum-comment is-reader"><div class="forum-comment-row">
      <span class="forum-comment-avatar" style="background-image:url(reader-comment.png)"><img src="reader-comment.png" alt=""></span>
      <div><article class="forum-reply-item"><div class="forum-reply-line"><span class="forum-reply-avatar"><img src="character-reply.png" alt=""></span></div></article></div>
    </div></article>
    <article class="forum-reply-item is-reader"><div class="forum-reply-line">
      <span class="forum-reply-avatar"><img src="reader-reply.png" alt=""></span>
    </div></article>
  </section>`)
  const source = dom.window.document.querySelector("#panel")
  const clone = maskPhoneExportClone(source, [])

  assert.equal(source.querySelectorAll("img").length, 6)
  assert.equal(clone.querySelectorAll('[data-phone-export-reader-avatar="masked"] img').length, 0)
  assert.equal(clone.querySelectorAll('[data-phone-export-reader-avatar="masked"]').length, 4)
  assert.equal(clone.querySelector(".rd-reader-chat-avatar").textContent, "▖▜▖▗")
  assert.equal(clone.querySelector(".forum-comment.is-reader > .forum-comment-row > .forum-comment-avatar").style.backgroundImage, "none")
  assert.equal(clone.querySelector(".npc-avatar img").getAttribute("src"), "character.png")
  assert.equal(clone.querySelector(".forum-comment.is-reader .forum-reply-item:not(.is-reader) img").getAttribute("src"), "character-reply.png")
})

test("long phone panels split into bounded windows near whole-item boundaries", () => {
  assert.deepEqual(phoneExportPageWindows(900, 1200, []), [
    { top:0, height:900, page:1, total:1 },
  ])
  assert.deepEqual(phoneExportPageWindows(3100, 1200, [400, 1100, 1900, 2700]), [
    { top:0, height:1100, page:1, total:3 },
    { top:1100, height:800, page:2, total:3 },
    { top:1900, height:1200, page:3, total:3 },
  ])
})

test("separate branch captures restart pagination and filename suffixes independently", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame">
    <section id="branch-a" class="rd-phone-app-panel" data-height="2500"></section>
    <section id="branch-b" class="rd-phone-app-panel" data-height="1700"></section>
  </div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const height = Number(this.dataset.height || 0)
    return { top:0, bottom:height, left:0, right:360, width:360, height, x:0, y:0, toJSON(){} }
  }
  const capturedPages = []
  const rasterize = async () => new dom.window.Blob(["png"], { type:"image/png" })

  const branchAFiles = await capturePhonePanelPages(dom.window.document.querySelector("#branch-a"), {
    baseName:"作品-消息-分支01",
    maximumPageHeight:1200,
    rasterize,
    onPage:page => capturedPages.push(["a", page.page, page.total]),
  })
  const branchBFiles = await capturePhonePanelPages(dom.window.document.querySelector("#branch-b"), {
    baseName:"作品-消息-分支02",
    maximumPageHeight:1200,
    rasterize,
    onPage:page => capturedPages.push(["b", page.page, page.total]),
  })

  assert.deepEqual(branchAFiles.map(file => file.filename), [
    "作品-消息-分支01-01.png",
    "作品-消息-分支01-02.png",
    "作品-消息-分支01-03.png",
  ])
  assert.deepEqual(branchBFiles.map(file => file.filename), [
    "作品-消息-分支02-01.png",
    "作品-消息-分支02-02.png",
  ])
  assert.deepEqual(capturedPages, [
    ["a", 1, 3], ["a", 2, 3], ["a", 3, 3],
    ["b", 1, 2], ["b", 2, 2],
  ])
})

test("later export pages settle their translated layout before html-to-image cloning", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame">
    <section class="rd-phone-app-panel" data-height="2100">content</section>
  </div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const height = Number(this.dataset.height || 0)
    return { top:0, bottom:height, left:0, right:360, width:360, height, x:0, y:0, toJSON(){} }
  }
  const offsets = []
  let layoutFrames = 0
  dom.window.requestAnimationFrame = callback => {
    layoutFrames += 1
    queueMicrotask(() => callback(layoutFrames))
    return layoutFrames
  }

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    rasterize:async viewport => {
      const panel = viewport.querySelector(".rd-phone-export-panel")
      offsets.push({
        layoutFrames,
        top:panel.style.getPropertyValue("top"),
        transform:panel.style.getPropertyValue("transform"),
        transformOrigin:panel.style.getPropertyValue("transform-origin"),
      })
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.deepEqual(offsets, [
    { layoutFrames:4, top:"auto", transform:"translateY(-0px)", transformOrigin:"top left" },
    { layoutFrames:6, top:"auto", transform:"translateY(-1200px)", transformOrigin:"top left" },
  ])
})

test("capture settles the staged layout before measuring whole-item breakpoints", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame">
    <section class="rd-phone-app-panel" data-kind="panel"><div class="rd-chat-message" data-kind="message">content</div></section>
  </div></body>`)
  let layoutFrames = 0
  dom.window.requestAnimationFrame = callback => {
    layoutFrames += 1
    queueMicrotask(() => callback(layoutFrames))
    return layoutFrames
  }
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const isPanel = this.dataset.kind === "panel"
    const height = isPanel ? 2100 : (layoutFrames >= 2 ? 1100 : 900)
    return { top:0, bottom:height, left:0, right:360, width:360, height, x:0, y:0, toJSON(){} }
  }
  const pages = []

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    onPage:page => pages.push({ top:page.top, height:page.height }),
    rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
  })

  assert.deepEqual(pages, [
    { top:0, height:1100 },
    { top:1100, height:1000 },
  ])
})

test("capture keeps the phone frame border outside every content page slice", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame" style="border:3px solid #000">
    <section class="rd-phone-app-panel" data-kind="panel">content</section>
  </div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const height = this.dataset.kind === "panel" ? 2100 : 0
    return { top:0, bottom:height, left:0, right:360, width:360, height, x:0, y:0, toJSON(){} }
  }
  const captures = []
  const pages = []

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    onPage:page => pages.push({ top:page.top, height:page.height }),
    rasterize:async (viewport, options) => {
      captures.push({
        boxSizing:viewport.style.getPropertyValue("box-sizing"),
        viewportHeight:viewport.style.getPropertyValue("height"),
        contentWidth:viewport.querySelector(".rd-phone-export-panel").style.getPropertyValue("width"),
        outputWidth:options.width,
        outputHeight:options.height,
      })
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.deepEqual(pages, [
    { top:0, height:1194 },
    { top:1194, height:906 },
  ])
  assert.deepEqual(captures, [
    { boxSizing:"border-box", viewportHeight:"1200px", contentWidth:"100%", outputWidth:360, outputHeight:1200 },
    { boxSizing:"border-box", viewportHeight:"912px", contentWidth:"100%", outputWidth:360, outputHeight:912 },
  ])
})

test("capture preserves computed heights for stylesheet-sized cards, headers and avatars", async () => {
  const dom = new JSDOM(`<!doctype html><html style="height:100px;block-size:100px;color:red"><body><div class="phone-frame">
    <section class="rd-phone-app-panel">content</section>
  </div></body></html>`)
  let includedProperties

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    rasterize:async (_viewport, options) => {
      includedProperties = options.includeStyleProperties
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.ok(Array.isArray(includedProperties))
  assert.ok(includedProperties.includes("color"))
  assert.equal(includedProperties.includes("height"), true)
  assert.equal(includedProperties.includes("block-size"), true)
})

test("capture gives chat clones an explicit CJK fallback font without mutating the live panel", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame">
    <section class="rd-phone-app-panel chat-author-shell"><div class="chat-bubble">长消息换行</div></section>
  </div></body>`)
  const source = dom.window.document.querySelector(".rd-phone-app-panel")
  let exportedFont = ""

  await capturePhonePanelPages(source, {
    rasterize:async viewport => {
      exportedFont = viewport.querySelector(".chat-author-shell").style.getPropertyValue("font-family")
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.equal(source.style.getPropertyValue("font-family"), "")
  assert.match(exportedFont, /PingFang SC/)
  assert.match(exportedFont, /Microsoft YaHei/)
  assert.match(exportedFont, /Noto Sans SC/)
})

test("capture preserves exact fractional font sizes without the rasterizer rounding them down", async () => {
  const dom = new JSDOM(`<!doctype html><html style="font-size:16px"><head><style>
    .phone-frame { font-size:16px }
    .sample-copy, .sample-copy span { font-size:13.5px }
  </style></head><body><div class="phone-frame"><section class="rd-phone-app-panel">
    <p class="sample-copy">中文 Mixed 123<span>nested</span></p>
  </section></div></body></html>`)
  const source = dom.window.document.querySelector(".rd-phone-app-panel")
  const before = source.outerHTML
  await capturePhonePanelPages(source, {
    rasterize:async (viewport, options) => {
      assert.equal(options.includeStyleProperties.includes("font-size"), false)
      assert.equal(viewport.querySelector(".sample-copy").style.fontSize, "13.5px")
      assert.equal(viewport.querySelector(".sample-copy span").style.fontSize, "13.5px")
      assert.equal(viewport.style.fontSize, "16px")
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })
  assert.equal(source.outerHTML, before)
  dom.window.close()
})

test("capture retains stylesheet paint and geometry inside deep-cloned SVG icons", async () => {
  const dom = new JSDOM(`<!doctype html><head><style>
    .sample-wave rect { fill:rgb(120, 130, 140); opacity:.4; transform:translateY(2px) }
  </style></head><body><div class="phone-frame"><section class="rd-phone-app-panel">
    <svg class="sample-wave" width="30" height="20"><rect x="1" y="2" width="3" height="10"/></svg>
  </section></div></body>`)
  const source = dom.window.document.querySelector(".rd-phone-app-panel")
  const before = source.outerHTML
  await capturePhonePanelPages(source, {
    rasterize:async viewport => {
      const rect = viewport.querySelector("svg rect")
      assert.equal(rect.style.fill, "rgb(120, 130, 140)")
      assert.equal(rect.style.opacity, "0.4")
      assert.equal(rect.style.transform, "translateY(2px)")
      assert.equal(rect.getAttribute("width"), "3")
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })
  assert.equal(source.outerHTML, before)
  dom.window.close()
})

test("capture preserves independent pseudo-element font sizes in the exported clone", async () => {
  const dom = new JSDOM(`<!doctype html><body><section class="rd-phone-app-panel">
    <div class="chat-bubble" style="font-size:13px">text</div>
  </section></body>`)
  const source = dom.window.document.querySelector(".rd-phone-app-panel")
  const before = source.outerHTML
  const computedStyle = dom.window.getComputedStyle.bind(dom.window)
  // JSDOM cannot resolve pseudo styles; supply only this browser boundary.
  dom.window.CSS = {}
  dom.window.getComputedStyle = (element, pseudo) => {
    if (!pseudo) return computedStyle(element)
    const style = dom.window.document.createElement("span").style
    style.content = element.matches(".chat-bubble, .rd-phone-export-viewport") ? '"label"' : "none"
    style.fontSize = pseudo === "::before" ? "8px" : "9px"
    return style
  }
  await capturePhonePanelPages(source, {
    rasterize:async viewport => {
      const bubble = viewport.querySelector(".chat-bubble")
      const key = bubble.getAttribute("data-phone-export-font")
      assert.ok(key)
      const stylesheet = viewport.querySelector("style[data-phone-export-fonts]")
      assert.ok(stylesheet)
      assert.ok(stylesheet.textContent.includes(`[data-phone-export-font="${key}"]::before{font-size:8px!important}`))
      assert.ok(stylesheet.textContent.includes(`[data-phone-export-font="${key}"]::after{font-size:9px!important}`))
      const rootKey = viewport.getAttribute("data-phone-export-font")
      assert.ok(stylesheet.textContent.includes(`[data-phone-export-font="${rootKey}"]::before{font-size:8px!important}`))
      assert.equal(viewport.firstElementChild.classList.contains("rd-phone-app-panel"), true)
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })
  assert.equal(source.outerHTML, before)
  dom.window.close()
})

test("capture constrains every direct chat timeline breakpoint selector independently", async () => {
  async function capturedWindows(candidateClass) {
    const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel" data-top="0" data-height="2100"><div class="rd-phone-app-body"><div class="${candidateClass}" data-top="0" data-height="1000">candidate</div></div></section></div></body>`)
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      const top = Number(this.dataset.top || 0)
      const height = Number(this.dataset.height || 0)
      return { top, bottom:top + height, left:0, right:360, width:360, height, x:0, y:top, toJSON(){} }
    }
    const pages = []

    await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
      maximumPageHeight:1200,
      onPage:page => pages.push({ top:page.top, height:page.height }),
      rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
    })
    return pages
  }

  const withoutCandidate = await capturedWindows("not-an-export-breakpoint")
  assert.deepEqual(withoutCandidate, [
    { top:0, height:1200 },
    { top:1200, height:900 },
  ])
  for (const candidateClass of [
    "rd-chat-message",
    "rd-chat-time",
    "rd-chat-system",
    "rd-call-card",
    "rd-chat-story-event",
  ]) {
    const withCandidate = await capturedWindows(candidateClass)
    assert.notDeepEqual(withCandidate, withoutCandidate, `${candidateClass} must independently change the page boundary`)
    assert.deepEqual(withCandidate, [
      { top:0, height:1000 },
      { top:1000, height:1100 },
    ], candidateClass)
  }
})

test("capture includes item bottom margins in safe page breakpoints", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel" data-top="0" data-height="2100">
    <div class="rd-chat-message" data-top="0" data-height="1000" style="margin-bottom:20px">message</div>
  </section></div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = Number(this.dataset.top || 0)
    const height = Number(this.dataset.height || 0)
    return { top, bottom:top + height, left:0, right:360, width:360, height, x:0, y:top, toJSON(){} }
  }
  const pages = []

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    onPage:page => pages.push({ top:page.top, height:page.height }),
    rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
  })

  assert.deepEqual(pages, [
    { top:0, height:1020 },
    { top:1020, height:1080 },
  ])
})

test("capture can break immediately before the next top-level item", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel" data-top="0" data-height="2100">
    <div class="rd-chat-message" data-top="0" data-height="1000">first</div>
    <div class="rd-chat-message" data-top="1100" data-height="300">second</div>
  </section></div></body>`)
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = Number(this.dataset.top || 0)
    const height = Number(this.dataset.height || 0)
    return { top, bottom:top + height, left:0, right:360, width:360, height, x:0, y:top, toJSON(){} }
  }
  const pages = []

  await capturePhonePanelPages(dom.window.document.querySelector(".rd-phone-app-panel"), {
    maximumPageHeight:1200,
    onPage:page => pages.push({ top:page.top, height:page.height }),
    rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
  })

  assert.deepEqual(pages, [
    { top:0, height:1100 },
    { top:1100, height:1000 },
  ])
})

test("capture masks only the off-screen copy and always removes its staging tree", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame" style="--phone-bg:#fff"><section class="rd-phone-app-panel"><div class="rd-phone-app-header">消息</div><div class="rd-phone-app-body"><p>宝宝晚安</p></div></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  const calls = []
  const files = await capturePhonePanelPages(panel, {
    baseName:"测试作品-消息-夜聊",
    maskValues:["宝宝"],
    pixelRatio:1,
    rasterize:async node => {
      calls.push(node.textContent)
      return new dom.window.Blob(["png"], { type:"image/png" })
    },
  })

  assert.deepEqual(calls, ["消息▖▜▖▗晚安"])
  assert.equal(files[0].filename, "测试作品-消息-夜聊.png")
  assert.equal(panel.textContent, "消息宝宝晚安")
  assert.equal(dom.window.document.querySelector(".rd-phone-export-stage"), null)
})

test("capture eagerly lays out every optimized export surface and removes ignored controls from measurement", async () => {
  const messageTypes = [
    "text", "image", "voice", "link", "redpacket", "transfer", "familycard",
    "takeaway", "location", "contact-card", "file", "music", "forward", "schedule",
    "unknown",
  ]
  const messageRows = messageTypes
    .map(type => `<article class="rd-chat-message chat-msg" data-message-type="${type}">${type}</article>`)
    .join("")
  const directRows = '<div class="rd-chat-time">time</div><div class="rd-chat-system">system</div><div class="rd-call-card">call</div><div class="rd-chat-story-event">event</div>'
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><div class="rd-phone-app-body">${messageRows}${directRows}<article class="rd-post-card">post</article><article class="rd-memo-note">memo</article><article class="rd-gallery-photo">photo</article><article class="rd-browser-entry">browser</article><img loading="lazy" decoding="async"><footer class="chat-composer">composer</footer></div></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  const stylePrototype = dom.window.CSSStyleDeclaration.prototype
  const originalSetProperty = stylePrototype.setProperty
  const contentVisibilityCalls = []
  let inspected = false

  stylePrototype.setProperty = function(name, value, priority) {
    if (name === "content-visibility" && value === "visible") contentVisibilityCalls.push({ name, value, priority })
    return originalSetProperty.call(this, name, value, priority)
  }
  try {
    await capturePhonePanelPages(panel, {
      rasterize:async viewport => {
        inspected = true
        for (const node of viewport.querySelectorAll(".rd-chat-message, .rd-chat-time, .rd-post-card, .rd-memo-note, .rd-gallery-photo, .rd-browser-entry")) {
          assert.equal(node.style.getPropertyValue("content-visibility"), "visible")
          assert.equal(node.style.getPropertyValue("contain-intrinsic-size"), "none")
        }
        assert.equal(viewport.querySelector(".chat-composer").style.getPropertyValue("display"), "none")
        assert.equal(viewport.querySelector("img").getAttribute("loading"), "eager")
        assert.equal(viewport.querySelector("img").getAttribute("decoding"), "sync")
        return new dom.window.Blob(["png"], { type:"image/png" })
      },
    })
  } finally {
    stylePrototype.setProperty = originalSetProperty
  }

  assert.equal(inspected, true)
  assert.ok(contentVisibilityCalls.length > 0)
  assert.ok(contentVisibilityCalls.some(call => call.priority === "important"))
  assert.equal(panel.querySelector(".chat-composer").style.display, "")
  assert.equal(panel.querySelector("img").getAttribute("loading"), "lazy")
  assert.equal(panel.querySelector("img").getAttribute("decoding"), "async")
})

test("capture settles load, error, and timeout image waits with complete cleanup", async t => {
  for (const scenario of [
    { name:"load", eventType:"load", expectPlaceholder:false, width:96, height:54 },
    { name:"error with a zero-height border box", eventType:"error", expectPlaceholder:true, width:220, height:0 },
    { name:"timeout with a zero-size border box", eventType:null, expectPlaceholder:true, width:0, height:0 },
  ]) {
    await t.test(scenario.name, async () => {
      const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><img src="original.png" srcset="original-2x.png 2x" sizes="96px" loading="lazy" decoding="async"></section></div></body>`)
      const panel = dom.window.document.querySelector(".rd-phone-app-panel")
      const sourceImage = panel.querySelector("img")
      const controller = new AbortController()
      const prototype = dom.window.HTMLImageElement.prototype
      const stylePrototype = dom.window.CSSStyleDeclaration.prototype
      const originalComplete = Object.getOwnPropertyDescriptor(prototype, "complete")
      const originalAddEventListener = prototype.addEventListener
      const originalRemoveEventListener = prototype.removeEventListener
      const originalSetProperty = stylePrototype.setProperty
      const originalSignalAddEventListener = controller.signal.addEventListener.bind(controller.signal)
      const originalSignalRemoveEventListener = controller.signal.removeEventListener.bind(controller.signal)
      const originalSetTimeout = globalThis.setTimeout
      const originalClearTimeout = globalThis.clearTimeout
      const timers = []
      const clearedTimers = []
      const addedImageListeners = []
      const removedImageListeners = []
      const addedSignalListeners = []
      const removedSignalListeners = []
      const liveSignalListeners = new Map()
      const layoutSignalListeners = []
      let layoutFrames = 0
      const boxSizingCalls = []
      let eventScheduled = false
      let placeholderLoaded = false

      Object.defineProperty(prototype, "complete", { configurable:true, get:() => false })
      stylePrototype.setProperty = function(name, value, priority) {
        if (name === "box-sizing") boxSizingCalls.push({ name, value, priority })
        return originalSetProperty.call(this, name, value, priority)
      }
      prototype.getBoundingClientRect = function() {
        const frozenWidth = Number.parseFloat(this.style.getPropertyValue("width"))
        const frozenHeight = Number.parseFloat(this.style.getPropertyValue("height"))
        const width = Number.isFinite(frozenWidth) ? frozenWidth : (placeholderLoaded ? 1 : scenario.width)
        const height = Number.isFinite(frozenHeight) ? frozenHeight : (placeholderLoaded ? 1 : scenario.height)
        return { top:0, bottom:height, left:0, right:width, width, height, x:0, y:0, toJSON(){} }
      }
      prototype.addEventListener = function(type, listener, options) {
        const result = originalAddEventListener.call(this, type, listener, options)
        if (this.closest(".rd-phone-export-stage")) {
          addedImageListeners.push(type)
          if (type === scenario.eventType && !eventScheduled) {
            eventScheduled = true
            queueMicrotask(() => this.dispatchEvent(new dom.window.Event(type)))
          }
        }
        return result
      }
      prototype.removeEventListener = function(type, listener, options) {
        if (this.closest(".rd-phone-export-stage")) removedImageListeners.push(type)
        return originalRemoveEventListener.call(this, type, listener, options)
      }
      controller.signal.addEventListener = function(type, listener, options) {
        const record = {type,listener}
        assert.equal(liveSignalListeners.has(listener),false,'listener was registered twice')
        addedSignalListeners.push(record)
        liveSignalListeners.set(listener,record)
        return originalSignalAddEventListener(type, listener, options)
      }
      controller.signal.removeEventListener = function(type, listener, options) {
        const record = liveSignalListeners.get(listener)
        assert.ok(record,'removed unknown or already-removed abort listener')
        assert.equal(record.type,type,'removed listener with different event type')
        removedSignalListeners.push(record)
        liveSignalListeners.delete(listener)
        return originalSignalRemoveEventListener(type, listener, options)
      }
      globalThis.setTimeout = (callback, delay) => {
        const timer = { callback, delay }
        timers.push(timer)
        if (!scenario.eventType) queueMicrotask(callback)
        return timer
      }
      globalThis.clearTimeout = timer => {
        clearedTimers.push(timer)
      }

      try {
        await capturePhonePanelPages(panel, {
          signal:controller.signal,
          layoutScheduler:{requestAnimationFrame(callback) {
            // One image wait finishes before two separate two-frame layout
            // waits. Identify each active layout listener, not just its count.
            if(layoutFrames % 2 === 0) {
              assert.equal(liveSignalListeners.size,1)
              const record=[...liveSignalListeners.values()][0]
              assert.notEqual(record,addedSignalListeners[0],'image listener leaked into layout')
              layoutSignalListeners.push(record)
            }
            layoutFrames++
            queueMicrotask(callback)
            return layoutFrames
          }},
          rasterize:async viewport => {
            const cloneImage = viewport.querySelector("img")
            assert.equal(cloneImage.getAttribute("loading"), "eager")
            assert.equal(cloneImage.getAttribute("decoding"), "sync")
            if (scenario.expectPlaceholder) {
              assert.equal(cloneImage.getAttribute("src"), TRANSPARENT_IMAGE)
              assert.equal(cloneImage.hasAttribute("srcset"), false)
              assert.equal(cloneImage.hasAttribute("sizes"), false)
              assert.equal(cloneImage.style.getPropertyValue("width"), `${scenario.width}px`)
              assert.equal(cloneImage.style.getPropertyValue("height"), `${scenario.height}px`)
              assert.equal(cloneImage.style.getPropertyPriority("width"), "important")
              assert.equal(cloneImage.style.getPropertyPriority("height"), "important")
              assert.equal(cloneImage.style.getPropertyValue("box-sizing"), "border-box")
              assert.ok(boxSizingCalls.some(call => call.value === "border-box" && call.priority === "important"))
              placeholderLoaded = true
              cloneImage.dispatchEvent(new dom.window.Event("load"))
              const lateRect = cloneImage.getBoundingClientRect()
              assert.equal(lateRect.width, scenario.width)
              assert.equal(lateRect.height, scenario.height)
            } else {
              assert.equal(cloneImage.getAttribute("src"), "original.png")
              assert.equal(cloneImage.getAttribute("srcset"), "original-2x.png 2x")
            }
            return new dom.window.Blob(["png"], { type:"image/png" })
          },
        })
        assert.deepEqual(addedImageListeners.sort(), ["error", "load"])
        assert.deepEqual(removedImageListeners.sort(), ["error", "load"])
        assert.equal(layoutFrames,4)
        assert.equal(layoutSignalListeners.length,2)
        assert.equal(addedSignalListeners[0].type,'abort','image wait must install an abort listener')
        assert.deepEqual(addedSignalListeners,[addedSignalListeners[0],...layoutSignalListeners])
        assert.equal(new Set(addedSignalListeners.map(record=>record.listener)).size,3,'image and layout waits must have distinct listeners')
        assert.ok(addedSignalListeners.every(record=>record.type==='abort'))
        assert.deepEqual(removedSignalListeners,addedSignalListeners,'every exact registered listener must be removed')
        assert.equal(liveSignalListeners.size,0,'capture leaked an active abort listener')
        assert.equal(timers.length, 1)
        assert.deepEqual(clearedTimers, timers)
        assert.equal(dom.window.document.querySelector(".rd-phone-export-stage"), null)
        assert.equal(sourceImage.getAttribute("src"), "original.png")
        assert.equal(sourceImage.getAttribute("srcset"), "original-2x.png 2x")
        assert.equal(sourceImage.getAttribute("sizes"), "96px")
        assert.equal(sourceImage.getAttribute("loading"), "lazy")
        assert.equal(sourceImage.getAttribute("decoding"), "async")
        assert.equal(sourceImage.style.cssText, "")
      } finally {
        if (originalComplete) Object.defineProperty(prototype, "complete", originalComplete)
        else delete prototype.complete
        prototype.addEventListener = originalAddEventListener
        prototype.removeEventListener = originalRemoveEventListener
        stylePrototype.setProperty = originalSetProperty
        globalThis.setTimeout = originalSetTimeout
        globalThis.clearTimeout = originalClearTimeout
      }
    })
  }
})

test("capture aborts an in-flight image wait immediately and removes its stage", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><img src="pending.png"></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  const controller = new AbortController()
  const prototype = dom.window.HTMLImageElement.prototype
  const originalComplete = Object.getOwnPropertyDescriptor(prototype, "complete")
  const originalRemoveEventListener = prototype.removeEventListener
  const originalSignalRemoveEventListener = controller.signal.removeEventListener.bind(controller.signal)
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = []
  const clearedTimers = []
  const removedImageListeners = []
  const removedSignalListeners = []

  Object.defineProperty(prototype, "complete", { configurable:true, get:() => false })
  prototype.removeEventListener = function(type, listener, options) {
    if (this.closest(".rd-phone-export-stage")) removedImageListeners.push(type)
    return originalRemoveEventListener.call(this, type, listener, options)
  }
  controller.signal.removeEventListener = function(type, listener, options) {
    removedSignalListeners.push(type)
    return originalSignalRemoveEventListener(type, listener, options)
  }
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay }
    timers.push(timer)
    return timer
  }
  globalThis.clearTimeout = timer => {
    clearedTimers.push(timer)
  }

  let observed
  try {
    const capture = capturePhonePanelPages(panel, {
      signal:controller.signal,
      rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
    })
    observed = capture.then(
      () => ({ status:"fulfilled" }),
      error => ({ status:"rejected", error }),
    )
    controller.abort()
    const outcome = await Promise.race([
      observed,
      new Promise(resolve => originalSetTimeout(() => resolve({ status:"pending" }), 25)),
    ])

    assert.equal(outcome.status, "rejected")
    assert.equal(outcome.error?.name, "AbortError")
    assert.equal(dom.window.document.querySelector(".rd-phone-export-stage"), null)
    assert.deepEqual(removedImageListeners.sort(), ["error", "load"])
    assert.deepEqual(removedSignalListeners, ["abort"])
    assert.equal(timers.length, 1)
    assert.deepEqual(clearedTimers, timers)
  } finally {
    const stagedImage = dom.window.document.querySelector(".rd-phone-export-stage img")
    if (stagedImage) stagedImage.dispatchEvent(new dom.window.Event("load"))
    await observed
    if (originalComplete) Object.defineProperty(prototype, "complete", originalComplete)
    else delete prototype.complete
    prototype.removeEventListener = originalRemoveEventListener
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test("capture bounds stalled image decoding and suppresses a late rejection", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><img src="ready.png"></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  const controller = new AbortController()
  const prototype = dom.window.HTMLImageElement.prototype
  const originalComplete = Object.getOwnPropertyDescriptor(prototype, "complete")
  const originalNaturalWidth = Object.getOwnPropertyDescriptor(prototype, "naturalWidth")
  const originalDecode = prototype.decode
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = []
  const clearedTimers = []
  let rejectDecode
  let decodeCalls = 0

  Object.defineProperty(prototype, "complete", { configurable:true, get:() => true })
  Object.defineProperty(prototype, "naturalWidth", { configurable:true, get:() => 120 })
  prototype.decode = function() {
    decodeCalls += 1
    return new Promise((resolve, reject) => {
      rejectDecode = reject
    })
  }
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay }
    timers.push(timer)
    queueMicrotask(callback)
    return timer
  }
  globalThis.clearTimeout = timer => {
    clearedTimers.push(timer)
  }

  let observed
  try {
    const capture = capturePhonePanelPages(panel, {
      signal:controller.signal,
      rasterize:async () => new dom.window.Blob(["png"], { type:"image/png" }),
    })
    observed = capture.then(
      files => ({ status:"fulfilled", files }),
      error => ({ status:"rejected", error }),
    )
    const outcome = await Promise.race([
      observed,
      new Promise(resolve => originalSetTimeout(() => resolve({ status:"pending" }), 25)),
    ])

    assert.equal(outcome.status, "fulfilled")
    assert.equal(outcome.files.length, 1)
    assert.equal(decodeCalls, 1)
    assert.equal(timers.length, 1)
    assert.equal(timers[0].delay, 2500)
    assert.deepEqual(clearedTimers, timers)
    assert.equal(dom.window.document.querySelector(".rd-phone-export-stage"), null)
    rejectDecode(new Error("late decode rejection"))
    await Promise.resolve()
    await Promise.resolve()
  } finally {
    if (dom.window.document.querySelector(".rd-phone-export-stage") && rejectDecode) {
      rejectDecode(new Error("release current implementation"))
    }
    await observed
    if (originalComplete) Object.defineProperty(prototype, "complete", originalComplete)
    else delete prototype.complete
    if (originalNaturalWidth) Object.defineProperty(prototype, "naturalWidth", originalNaturalWidth)
    else delete prototype.naturalWidth
    prototype.decode = originalDecode
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test("capture discards a rasterized page when cancellation arrives during rasterization", async () => {
  const dom = new JSDOM(`<!doctype html><body><div class="phone-frame"><section class="rd-phone-app-panel"><p>最后一页</p></section></div></body>`)
  const panel = dom.window.document.querySelector(".rd-phone-app-panel")
  const controller = new AbortController()
  let pageNotifications = 0

  await assert.rejects(
    capturePhonePanelPages(panel, {
      signal:controller.signal,
      onPage:() => { pageNotifications += 1 },
      rasterize:async () => {
        controller.abort()
        return new dom.window.Blob(["png"], { type:"image/png" })
      },
    }),
    error => error?.name === "AbortError",
  )

  assert.equal(pageNotifications, 0)
  assert.equal(dom.window.document.querySelector(".rd-phone-export-stage"), null)
})

test("captured PNG files are packaged into one UTF-8 ZIP archive", async () => {
  const files = [
    { filename:"作品-消息-夜聊.png", blob:new Blob(["chat"], { type:"image/png" }) },
    { filename:"作品-论坛-帖子.png", blob:new Blob(["forum"], { type:"image/png" }) },
  ]
  const archive = await createPhoneContentArchive(files)
  const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))

  assert.deepEqual(Object.keys(entries), files.map(file => file.filename))
  assert.equal(strFromU8(entries[files[0].filename]), "chat")
  assert.equal(strFromU8(entries[files[1].filename]), "forum")
})
