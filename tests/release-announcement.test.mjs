import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

import {
  CURRENT_RELEASE_ANNOUNCEMENT,
  RELEASE_ANNOUNCEMENT_STORAGE_KEY,
  acknowledgeReleaseAnnouncement,
  shouldShowReleaseAnnouncement,
  showReleaseAnnouncementOnce,
} from "../js/release-announcement.js"

const authorSource = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const authorCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function announcement(id = "release-a") {
  return {
    id,
    title:"Tuuru 更新公告",
    publishedAt:"2026-07-22",
    intro:"这次更新已经准备好了。",
    items:[
      { title:"新功能", body:"教程与联系人功能已更新。" },
      { title:"数据说明", body:"不会清空本地作品。" },
    ],
  }
}

function createDom() {
  return new JSDOM("<!doctype html><html><body><button id=before>打开页面</button></body></html>", {
    url:"https://tuuru.local/",
  })
}

test("current major announcement covers every user-facing release area", () => {
  assert.equal(CURRENT_RELEASE_ANNOUNCEMENT.id, "2026-07-29-reader-polish-and-release-workflow")
  assert.equal(CURRENT_RELEASE_ANNOUNCEMENT.items.length, 9)
  const copy = [
    CURRENT_RELEASE_ANNOUNCEMENT.intro,
    ...CURRENT_RELEASE_ANNOUNCEMENT.items.flatMap(item => [item.title, item.body]),
  ].join("\n")
  for (const required of [
    "长按管理", "置顶", "系统明暗模式", "占位符", "身份组",
    "稳定身份", "新版本", "较早版本", "版本冲突", "变化摘要",
    "阅读进度", "存档", "书签", "限时撤销", "折叠分区",
    "左侧实时预览", "预览与设置双页工作台", "未保存状态",
    "聊天壁纸", "可读性保护", "加粗", "PNG", "WebP",
    "切片拉伸", "220%", "中线对齐", "取色器", "安全自定义 CSS",
    "不调用 API", "不会把图片发送给 AI", "单步撤销", "修改前效果",
    "发布前体检", "去修改", "保存失败", "全作品批量替换",
    "Escape", "焦点恢复", "JSON", "旧作品", "不会主动清空",
    "首次打开时显示一次",
  ]) assert.match(copy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.doesNotMatch(copy, /\p{Extended_Pictographic}/u)
})

test("an announcement appears once per id and a newer id appears again", () => {
  const dom = createDom()
  const storage = dom.window.localStorage
  const first = announcement("release-a")
  const newer = announcement("release-b")

  assert.equal(shouldShowReleaseAnnouncement({ storage, announcement:first }), true)
  const overlay = showReleaseAnnouncementOnce({ document:dom.window.document, storage, announcement:first })
  assert.ok(overlay)
  assert.equal(overlay.getAttribute("role"), "presentation")
  assert.equal(overlay.querySelector("[role=dialog]").getAttribute("aria-modal"), "true")
  overlay.querySelector("[data-release-announcement-confirm]").click()

  assert.equal(storage.getItem(RELEASE_ANNOUNCEMENT_STORAGE_KEY), "release-a")
  assert.equal(showReleaseAnnouncementOnce({ document:dom.window.document, storage, announcement:first }), null)
  assert.equal(shouldShowReleaseAnnouncement({ storage, announcement:newer }), true)
  assert.ok(showReleaseAnnouncementOnce({ document:dom.window.document, storage, announcement:newer }))
  dom.window.close()
})

test("all dismissal paths acknowledge once and restore focus", () => {
  for (const path of ["close", "escape", "backdrop"]) {
    const dom = createDom()
    const document = dom.window.document
    const storage = dom.window.localStorage
    const trigger = document.getElementById("before")
    trigger.focus()
    const overlay = showReleaseAnnouncementOnce({ document, storage, announcement:announcement(path) })
    assert.equal(document.activeElement, overlay.querySelector("[data-release-announcement-confirm]"))

    if (path === "close") overlay.querySelector("[data-release-announcement-close]").click()
    if (path === "escape") document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key:"Escape", bubbles:true }))
    if (path === "backdrop") overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles:true }))

    assert.equal(document.querySelector(".release-announcement-overlay"), null)
    assert.equal(storage.getItem(RELEASE_ANNOUNCEMENT_STORAGE_KEY), path)
    assert.equal(document.activeElement, trigger)
    dom.window.close()
  }
})

test("storage failures never block or crash the announcement", () => {
  const dom = createDom()
  const storage = {
    getItem() { throw new Error("read unavailable") },
    setItem() { throw new Error("write unavailable") },
  }
  const current = announcement("storage-failure")
  assert.equal(shouldShowReleaseAnnouncement({ storage, announcement:current }), true)
  assert.equal(acknowledgeReleaseAnnouncement({ storage, announcement:current }), false)
  const overlay = showReleaseAnnouncementOnce({ document:dom.window.document, storage, announcement:current })
  assert.doesNotThrow(() => overlay.querySelector("[data-release-announcement-confirm]").click())
  assert.equal(overlay.isConnected, false)
  dom.window.close()
})

test("announcement copy is rendered as text rather than executable markup", () => {
  const dom = createDom()
  const unsafe = announcement("safe-copy")
  unsafe.items = [{ title:"<img src=x>", body:"<script>bad()</script>" }]
  const overlay = showReleaseAnnouncementOnce({
    document:dom.window.document,
    storage:dom.window.localStorage,
    announcement:unsafe,
  })
  assert.equal(overlay.querySelector("img, script"), null)
  assert.match(overlay.textContent, /<img src=x>/)
  overlay.querySelector("[data-release-announcement-confirm]").click()
  dom.window.close()
})

test("author and standalone reader entries call the shared opener", () => {
  assert.match(authorSource, /import\s*\{\s*showReleaseAnnouncementOnce\s*\}\s*from\s*["']\.\/release-announcement\.js["']/)
  assert.match(authorSource, /initRouter\(app\)[\s\S]{0,160}showReleaseAnnouncementOnce\(\)/)
  assert.match(readerSource, /import\s*\{\s*showReleaseAnnouncementOnce\s*\}\s*from\s*["']\.\.\/js\/release-announcement\.js["']/)
  assert.match(readerSource, /if\s*\(!_editorPreviewMode\)[\s\S]{0,160}showReleaseAnnouncementOnce\(\)/)
})

test("author and reader styles share a responsive, touch-safe announcement contract", () => {
  for (const css of [authorCss, readerCss]) {
    assert.match(css, /\.release-announcement-overlay\s*\{/)
    assert.match(css, /\.release-announcement-dialog\s*\{[^}]*max-height\s*:/s)
    assert.match(css, /\.release-announcement-confirm\s*\{[^}]*min-height\s*:\s*44px/s)
    assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.release-announcement-overlay/s)
  }
})
