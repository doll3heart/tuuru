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

test("phone export dialog offers accessible current and all-branch modes", () => {
  assert.match(readerSource, /<fieldset class="rd-phone-export-modes">/)
  assert.match(readerSource, /<legend>聊天回复分支<\/legend>/)
  assert.match(readerSource, /name="readerPhoneExportBranchMode" value="current" checked/)
  assert.match(readerSource, /<strong>当前阅读分支<\/strong><small>按你现在已经选择的聊天回复导出，速度更快。<\/small>/)
  assert.match(readerSource, /name="readerPhoneExportBranchMode" value="all"/)
  assert.match(readerSource, /<strong>所有选项分支<\/strong><small>每个聊天的可达回复路线分别成图、各自分页；最多 64 条。<\/small>/)
  assert.match(readerSource, /非聊天模块仍各导出一次/)
})

test("phone export mode is read once, passed through, and restored after busy state", () => {
  const dialogStart = readerSource.indexOf("function openReaderPhoneExportDialog(")
  const dialogEnd = readerSource.indexOf("function renderPhoneOwnerHome", dialogStart)
  const dialogSource = readerSource.slice(dialogStart, dialogEnd)

  assert.match(dialogSource, /querySelectorAll\(['"]input\[name="readerPhoneExportBranchMode"\]['"]\)/)
  assert.match(dialogSource, /addEventListener\(['"]change['"]/)
  assert.match(dialogSource, /导出当前阅读分支/)
  assert.match(dialogSource, /导出所有选项分支/)
  assert.match(dialogSource, /var branchMode = [^\n]+\.value === ['"]all['"] \? ['"]all['"] : ['"]current['"]/)
  assert.match(dialogSource, /exportReaderPhoneContentImages\(\{\s*branchMode:branchMode,/)
  assert.match(dialogSource, /modeInputs\.forEach\(function\(input\) \{ input\.disabled = true \}\)/)
  assert.match(dialogSource, /finally \{[\s\S]*modeInputs\.forEach\(function\(input\) \{ input\.disabled = false \}\)/)
})

test("all-mode branch labels are masked after the lazy export module loads and before naming", () => {
  assert.doesNotMatch(readerSource, /from ['"]\.\/phone-content-export\.js['"]/)
  assert.match(readerSource, /var phoneExportBranchLabel = phoneContentExport\.phoneExportBranchLabel/)
  assert.match(readerSource, /var maskedPhoneExportBranchLabel = function\(path, zeroBasedIndex, total\) \{[\s\S]*phoneExportBranchLabel\(path, zeroBasedIndex, total, \{ maskValues:maskValues \}\)/)
  assert.match(readerSource, /readerPhoneExportJobs\(pd, exportFrame, \{[\s\S]*phoneExportBranchLabel:maskedPhoneExportBranchLabel/)

  const plannerStart = readerSource.indexOf("function readerPhoneExportJobs(")
  const plannerEnd = readerSource.indexOf("function readerPhoneExportAnimationFrame(", plannerStart)
  const plannerSource = readerSource.slice(plannerStart, plannerEnd)
  assert.match(plannerSource, /phoneExportBranchLabel\(branch\.path, branchIndex, branchResult\.branches\.length\)/)
  assert.match(plannerSource, /itemLabel:branchLabel \? branchLabel \+ ['"]-['"] \+ chatLabel : chatLabel/)

  const exportStart = readerSource.indexOf("async function exportReaderPhoneContentImages(")
  const progressStart = readerSource.indexOf("options.onProgress({ phase:'render'", exportStart)
  const namingCallStart = readerSource.indexOf("readerPhoneExportUniqueBaseName(job", exportStart)
  assert.ok(plannerStart < progressStart)
  assert.ok(plannerStart < namingCallStart)

  const uniqueStart = readerSource.indexOf("function readerPhoneExportUniqueBaseName(")
  const namingEnd = readerSource.indexOf("function readerPhoneExportJobs", uniqueStart)
  const namingSource = readerSource.slice(uniqueStart, namingEnd)
  assert.match(namingSource, /unicodeSafeItemLabel:Array\.isArray\(descriptor\.branchPath\) && descriptor\.branchPath\.length > 0/)
})

test("branch mode cards cover checked, keyboard focus, disabled, and reduced motion states", () => {
  assert.match(readerCss, /\.rd-phone-export-modes/)
  assert.match(readerCss, /\.rd-phone-export-mode/)
  assert.match(readerCss, /\.rd-phone-export-mode:has\(input:checked\)/)
  assert.match(readerCss, /\.rd-phone-export-mode:has\(input:focus-visible\)/)
  assert.match(readerCss, /\.rd-phone-export-mode:has\(input:disabled\)/)
  assert.match(readerCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rd-phone-export-mode/)
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

test("all-branch chat jobs inject detached selection snapshots before capture", () => {
  assert.match(
    readerSource,
    /enumeratePhoneStoryChatChoiceBranches/,
  )
  assert.match(
    readerSource,
    /openReaderChat\(exportFrame, _work, pd, chat, chatIndex, undefined, \{\s*exportMode:true,\s*exportChoiceSelections:branch\.selections,?\s*\}\)/,
  )
  assert.match(
    readerSource,
    /runtimeOptions\?\.exportChoiceSelections instanceof Map[\s\S]*phoneChoiceSession\.phoneChoiceSelections = new Map\(runtimeOptions\.exportChoiceSelections\)[\s\S]*phoneChoiceSession\.phonePendingChoicePlaybacks = new Map\(\)/,
  )
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

test("all-branch planning enforces the global chat job safety limit", () => {
  assert.match(readerSource, /PHONE_EXPORT_MAX_CHAT_BRANCHES\s*=\s*64/)
  assert.match(readerSource, /function readerPhoneExportJobs\(pd, exportFrame, options\)/)
  assert.match(readerSource, /branchMode\s*===\s*['"]all['"]/)
  assert.match(
    readerSource,
    /throw new Error\(['"]可导出的消息选项分支超过 64 条，请减少选项后重试，或改用“当前阅读分支”。['"]\)/,
  )
  assert.match(readerSource, /readerPhoneExportJobs\(pd, exportFrame, options\)/)
})

test("current branch planning does not initialize the live choice session", () => {
  const start = readerSource.indexOf("function readerPhoneExportJobs(")
  const end = readerSource.indexOf("function readerPhoneExportAnimationFrame(", start)
  const plannerSource = readerSource.slice(start, end)
  assert.match(
    plannerSource,
    /var liveSelections = null\s+if \(branchMode === ['"]all['"]\) \{\s+liveSelections = readerPhoneChoiceSession\(_work\)\.phoneChoiceSelections\s+\}/,
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

test("reader export rechecks cancellation around archive creation and before download", () => {
  const exportStart = readerSource.indexOf("async function exportReaderPhoneContentImages(")
  const exportEnd = readerSource.indexOf("function openReaderPhoneExportDialog(", exportStart)
  const exportSource = readerSource.slice(exportStart, exportEnd)
  const archiveCall = exportSource.indexOf("await createPhoneContentArchive(files)")
  const checks = [...exportSource.matchAll(/readerPhoneExportThrowIfAborted\(options\?\.signal\)/g)].map(match => match.index)

  assert.ok(archiveCall >= 0)
  assert.ok(checks.some(index => index < archiveCall), "cancellation should be checked before archiving")
  assert.ok(checks.some(index => index > archiveCall), "cancellation should be checked after archiving")

  const dialogStart = readerSource.indexOf("function openReaderPhoneExportDialog(")
  const dialogEnd = readerSource.indexOf("function renderPhoneOwnerHome", dialogStart)
  const dialogSource = readerSource.slice(dialogStart, dialogEnd)
  assert.match(
    dialogSource,
    /readerPhoneExportThrowIfAborted\(controller\.signal\)\s+downloadBlob\(result\.blob, result\.filename\)/,
  )
})

test("phone screenshot dependencies are production dependencies", () => {
  assert.equal(packageJson.dependencies["html-to-image"], "^1.11.13")
  assert.equal(packageJson.dependencies.fflate, "^0.8.3")
})
