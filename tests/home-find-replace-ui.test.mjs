import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const dialogSource = await readFile(new URL("../js/pages/home-find-replace.js", import.meta.url), "utf8")
const mutationSource = await readFile(new URL("../js/home-work-mutations.js", import.meta.url), "utf8")
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("every work card exposes whole-work find and replace from its existing menu", () => {
  assert.match(homeSource, /全作品查找替换/)
  assert.match(homeSource, /data-work-find-replace/)
  assert.match(homeSource, /openWorkFindReplace/)
  assert.match(homeSource, /replaceHomeWorkText/)
})

test("the dialog previews literal visible-text matches before enabling replacement", () => {
  assert.match(dialogSource, /全作品查找替换/)
  assert.match(dialogSource, /id="workFindSearch"/)
  assert.match(dialogSource, /id="workFindReplacement"/)
  assert.match(dialogSource, /id="workFindCaseSensitive"/)
  assert.match(dialogSource, /findWorkTextMatches/)
  assert.match(dialogSource, /data-find-match/)
  assert.match(dialogSource, /selectedMatchIds/)
  assert.match(dialogSource, /createJsonToken/)
  assert.match(dialogSource, /确认替换/)
  assert.match(dialogSource, /disabled/)
})

test("replacement is wired through the guarded home mutation and modal write state", () => {
  assert.match(mutationSource, /export async function replaceHomeWorkText/)
  assert.match(homeSource, /replaceTextReliable/)
  assert.match(homeSource, /workFindReplaceConfirm/)
  assert.match(homeSource, /workFindReplaceStatus/)
})

test("find and replace results remain bounded and usable on phones", () => {
  assert.match(styles, /\.work-find-replace/)
  assert.match(styles, /\.work-find-replace-results/)
  assert.match(styles, /\.work-find-replace-item/)
  assert.match(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*\.work-find-replace-fields\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
})
