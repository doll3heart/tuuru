import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

test("reader customization exposes one accessible all-content image export action", () => {
  assert.match(readerSource, /data-reader-phone-control="export"/)
  assert.match(readerSource, /<strong>图片导出<\/strong>/)
  assert.match(readerSource, /全部内容[^<]*自动打码/)
  assert.match(readerSource, /openReaderPhoneExportDialog\(ownerControl\)/)
  assert.match(readerCss, /\.rd-phone-export-dialog/)
  assert.match(readerCss, /\.rd-phone-export-progress/)
  assert.match(readerCss, /\.rd-phone-export-failures/)
})

test("reader export workflow covers every authored phone content surface", () => {
  assert.match(readerSource, /capturePhonePanelPages/)
  assert.match(readerSource, /createPhoneContentArchive/)
  assert.match(readerSource, /placeholderMaskValues/)
  assert.match(readerSource, /phoneExportArchiveName/)
  assert.match(readerSource, /\.rd-phone-app-panel, \.rd-forum-detail/)
  assert.match(readerSource, /查看未导出的项目/)
  assert.match(readerSource, /读者本人头像不会出现在导出图片中/)
  assert.match(readerSource, /NPC 与角色头像保持原样/)
  for (const label of ["消息", "动态", "论坛", "备忘录", "相册", "浏览记录", "购物", "联系人"]) {
    assert.match(readerSource, new RegExp(`moduleLabel:["']${label}["']`))
  }
})

test("export rendering is isolated from visible reader navigation", () => {
  assert.match(readerSource, /navigationContext\?\.exportFrame/)
  assert.match(readerSource, /navigationContext\?\.exportMode === true/)
  assert.match(readerSource, /runtimeOptions\?\.exportMode === true/)
})

test("static export chat rendering never installs bottom-tracking ResizeObserver", () => {
  const chatStart = readerSource.indexOf("function openReaderChat(")
  const chatEnd = readerSource.indexOf("function openReaderForumAccountDialog", chatStart)
  const chatSource = readerSource.slice(chatStart, chatEnd)
  assert.match(
    chatSource,
    /if \(!exportMode && typeof globalThis\.ResizeObserver === ['"]function['"]\)/,
  )
})

test("static export chat rendering cannot advance transient reader state", () => {
  const chatStart = readerSource.indexOf("function openReaderChat(")
  const chatEnd = readerSource.indexOf("function openReaderForumAccountDialog", chatStart)
  const chatSource = readerSource.slice(chatStart, chatEnd)
  assert.match(chatSource, /if \(exportMode\) return \{ key:key, settled:kind === ['"]recall['"] \}/)
  assert.match(chatSource, /if \(!exportMode\) transientRowsToSchedule\.forEach/)
  assert.match(chatSource, /if \(!exportMode\) startCurrentChatFlowMessage\(\)/)
  assert.match(chatSource, /cloneReaderPhoneChoiceSessionForExport/)
})

test("static export uses detached moments and forum sessions", () => {
  const cloneStart = readerSource.indexOf("function cloneReaderPhoneChoiceSessionForExport(")
  const cloneEnd = readerSource.indexOf("function readerPhoneStoryChoiceIds", cloneStart)
  const cloneSource = readerSource.slice(cloneStart, cloneEnd)
  assert.match(cloneSource, /moments:session\?\.moments === null/)
  assert.match(cloneSource, /cloneReaderThreadItems\(session\?\.moments \|\| \[\]\)/)
  assert.match(cloneSource, /forumPosts:new Map\(\)/)

  const appStart = readerSource.indexOf("function openReaderApp(")
  const appEnd = readerSource.indexOf("function openReaderChat(", appStart)
  const appSource = readerSource.slice(appStart, appEnd)
  assert.match(appSource, /phoneChoiceSession = exportMode\s*\? cloneReaderPhoneChoiceSessionForExport\(livePhoneChoiceSession\)/)

  const forumStart = readerSource.indexOf("function openReaderForumPost(")
  const forumEnd = readerSource.indexOf("function openReaderForumAccountDialog", forumStart)
  const forumSource = readerSource.slice(forumStart, forumEnd)
  assert.match(forumSource, /phoneChoiceSession = exportMode\s*\? cloneReaderPhoneChoiceSessionForExport\(livePhoneChoiceSession\)/)
})

test("phone screenshot dependencies are production dependencies", () => {
  assert.equal(packageJson.dependencies["html-to-image"], "^1.11.13")
  assert.equal(packageJson.dependencies.fflate, "^0.8.3")
})
