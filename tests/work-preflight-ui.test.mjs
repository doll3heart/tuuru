import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const preflightUiSource = await readFile(new URL("../js/pages/home-preflight.js", import.meta.url), "utf8")
const editorSource = await readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const authorCss = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("every work card exposes publish inspection from its existing menu", () => {
  assert.match(homeSource, /发布前体检/)
  assert.match(homeSource, /data-work-preflight/)
  assert.match(homeSource, /openWorkPreflight/)
})

test("the report distinguishes blocking findings, reminders, and a clean result", () => {
  assert.match(preflightUiSource, /需要处理/)
  assert.match(preflightUiSource, /建议检查/)
  assert.match(preflightUiSource, /未发现需要处理的问题/)
  assert.match(preflightUiSource, /issue\.location/)
  assert.match(preflightUiSource, /issue\.action/)
})

test("the report uses accessible, responsive list styling", () => {
  assert.match(preflightUiSource, /role="status"/)
  assert.match(preflightUiSource, /aria-labelledby="workPreflightResultsTitle"/)
  assert.match(authorCss, /\.work-preflight-summary/)
  assert.match(authorCss, /\.work-preflight-list/)
  assert.match(authorCss, /\.work-preflight-level-error/)
  assert.match(authorCss, /@media\(max-width:480px\)[\s\S]*\.work-preflight-summary/s)
})

test("article reports run deep route inspection in the same dialog", () => {
  assert.match(preflightUiSource, /深度路线检查/)
  assert.match(preflightUiSource, /正在遍历作品路线/)
  assert.match(preflightUiSource, /inspectArticleRoutes/)
  assert.match(preflightUiSource, /data-route-preflight-node/)
  assert.match(preflightUiSource, /writeArticleEditorViewState/)
  assert.match(authorCss, /\.work-route-preflight/)
  assert.match(authorCss, /\.work-route-preflight-coverage/)
})

test("publish inspection forms one repair, preview, and export flow", () => {
  assert.match(preflightUiSource, /data-work-preflight-issue/)
  assert.match(preflightUiSource, /去修改/)
  assert.match(preflightUiSource, /预览作品/)
  assert.match(preflightUiSource, /导出加密作品/)
  assert.match(preflightUiSource, /runButtonAction/)
  assert.match(editorSource, /data-a="return-preflight"/)
  assert.match(editorSource, /重新体检/)
})

test("publish inspection shows package size risk and locatable embedded assets", () => {
  assert.match(preflightUiSource, /inspectWorkSize/)
  assert.match(preflightUiSource, /inspectWorkSizeWithAssets\(prepareWorkForExport\(work\)/)
  assert.match(preflightUiSource, /work-size-report/)
  assert.match(preflightUiSource, /data-work-size-locate/)
  assert.match(preflightUiSource, /encryptedPackageBytes/)
  assert.match(preflightUiSource, /9–10 MiB/)
  assert.match(preflightUiSource, /6 MiB/)
  assert.match(authorCss, /\.work-size-report/)
  assert.match(authorCss, /\.work-size-asset-list/)
})
