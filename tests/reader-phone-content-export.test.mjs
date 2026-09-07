import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const forbiddenReaderExportSource = /data-reader-phone-control="export"|downloadBlob|phone-content-export\.js|readerPhoneExportJobs/
const forbiddenReaderExportCss = /\.rd-phone-export-dialog|\.rd-phone-export-modes/

test("reader has no export controls, planner or delivery dependencies", () => {
  assert.match('import "./phone-content-export.js"', forbiddenReaderExportSource)
  assert.match('.rd-phone-export-dialog { display: block }', forbiddenReaderExportCss)
  assert.match('.rd-phone-export-modes { display: grid }', forbiddenReaderExportCss)
  assert.doesNotMatch(readerSource, forbiddenReaderExportSource)
  assert.doesNotMatch(readerCss, forbiddenReaderExportCss)
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

test("static chat visibility is evaluated against the export session map", () => {
  const chatStart = readerSource.indexOf("function openReaderChat(")
  const chatEnd = readerSource.indexOf("// ---- Forum post viewer ----", chatStart)
  const chatSource = readerSource.slice(chatStart, chatEnd)
  const visibilityCalls = [...chatSource.matchAll(/readerPhoneStoryItemVisible\(w,\s*[^,]+,\s*pd(?:,\s*[^)]+)?\)/g)]

  assert.ok(visibilityCalls.length >= 6, "the chat renderer should have all known visibility gates")
  for (const call of visibilityCalls) {
    assert.match(call[0], /phoneChoiceSession\.phoneChoiceSelections/)
  }
  assert.match(
    readerSource,
    /function readerPhoneStoryItemVisible\(work, item, phoneData, selections\)[\s\S]*selections === undefined[\s\S]*selectedPhoneStoryChoiceIds\(selections\)/,
  )
})

test("authored playback pruning also reads its supplied session snapshot", () => {
  const start = readerSource.indexOf("function readerAuthoredPlaybackMessageIsVisible(")
  const end = readerSource.indexOf("function invalidateHiddenReaderAuthoredPlayback(", start)
  const helperSource = readerSource.slice(start, end)
  assert.match(
    helperSource,
    /readerPhoneStoryItemVisible\(work, message, phoneData, session\.phoneChoiceSelections\)/,
  )
})

test("phone screenshot dependencies are production dependencies", () => {
  assert.equal(packageJson.dependencies["html-to-image"], "^1.11.13")
  assert.equal(packageJson.dependencies.fflate, "^0.8.3")
})
