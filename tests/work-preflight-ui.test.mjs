import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const preflightUiSource = await readFile(new URL("../js/pages/home-preflight.js", import.meta.url), "utf8")
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
