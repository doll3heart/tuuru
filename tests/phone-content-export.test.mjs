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
  phoneExportPageWindows,
  placeholderMaskValues,
  safePhoneExportSegment,
} from "../reader/phone-content-export.js"

test("phone image export filenames remain portable and descriptive", () => {
  assert.equal(safePhoneExportSegment(' 夏夜/回声:*?"<>| '), "夏夜-回声")
  assert.equal(safePhoneExportSegment("...", "未命名"), "未命名")
  assert.equal(
    phoneExportBaseName({ workTitle:"夏夜/回声", moduleLabel:"消息", itemLabel:"林檎:夜聊" }),
    "夏夜-回声-消息-林檎-夜聊",
  )
  assert.equal(phoneExportArchiveName("夏夜/回声"), "夏夜-回声-小手机图片.zip")
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
