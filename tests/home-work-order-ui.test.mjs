import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const home = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8")

test("work cards expose dedicated drag and pin controls without duplicate step movement", () => {
  assert.match(home, /class="work-card-drag-handle"/)
  assert.match(home, /draggable="true"/)
  assert.match(home, /aria-label="拖动作品/)
  assert.match(home, /置顶作品/)
  assert.match(home, /取消置顶/)
  assert.doesNotMatch(home, /上移一位/)
  assert.doesNotMatch(home, /下移一位/)
})

test("work shelf drag stays within its pin group and persists through the model", () => {
  assert.match(home, /function bindWorkShelfOrdering\(\)/)
  assert.match(home, /target\.dataset\.workPinned/)
  assert.match(home, /moveWorkByOffset\(shelfDrag\.id,\s*offset\)/)
  assert.match(home, /orderedWorks\(getWorks\(\)\)/)
  assert.match(home, /作品顺序已更新/)
})

test("drag affordances use current UI tokens and disappear for coarse pointers", () => {
  assert.match(css, /\.work-card-drag-handle\{[^}]*border-radius:3px[^}]*color:var\(--c-text2\)/s)
  assert.match(css, /\.work-card-drag-handle\{[^}]*top:11px[^}]*right:11px[^}]*left:auto/s)
  assert.match(css, /\.collection-selection-active \.work-card-drag-handle\{[^}]*visibility:hidden[^}]*pointer-events:none/s)
  assert.match(css, /\.work-card-title\{[^}]*padding-left:0[^}]*padding-right:30px/s)
  assert.match(css, /\.work-card-drag-handle:focus-visible\{[^}]*outline:2px solid var\(--c-primary-hover\)/s)
  assert.match(css, /@media \(pointer:coarse\)\{[\s\S]*\.work-card-drag-handle\{display:none\}/s)
  assert.match(css, /@media \(pointer:coarse\)\{[\s\S]*\.work-card-title\{padding-left:0;padding-right:0\}/s)
  assert.match(css, /\.work-card\.drag-before::after/)
  assert.doesNotMatch(css, /\.work-card-drag-handle\{[^}]*border-radius:(?:2[4-9]|[3-9]\d)px/s)
})
