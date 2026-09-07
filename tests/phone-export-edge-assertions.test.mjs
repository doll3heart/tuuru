import test from 'node:test'
import assert from 'node:assert/strict'
import { assertOversizedPagination } from '../browser-tests/phone-export/edge-assertions.mjs'

const row = (id, y, height) => ({ id, x:10, y, width:340, height, contents:[], bubbles:[] })

function fixture() {
  const sourceRows = [row('owner', 0, 100), row('long', 100, 3300), row('ending', 3400, 100)]
  const page = (top, contentHeight) => ({
    width:360, height:contentHeight, top, contentHeight, panelHeight:3600, panelOffset:-top,
    rows:sourceRows.map(item => ({ ...item, y:item.y - top })), images:[],
  })
  return [page(0, 1600), page(1600, 1600), page(3200, 400)]
}

test('accepts a 3300-pixel row spanning three continuous page windows', () => {
  assertOversizedPagination(fixture(), [], ['long'])
})

test('rejects a gap between page windows', () => {
  const pages = fixture()
  pages[1] = { ...pages[1], top:1601, contentHeight:1599 }
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /gap or repeated/)
})

test('rejects a duplicate page window', () => {
  const pages = fixture()
  pages.splice(1, 0, { ...pages[0] })
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /gap or repeated/)
})

test('rejects an omitted final page independently of row coverage', () => {
  const pages = fixture().slice(0, 2)
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /omitted the end/)
})

test('rejects a wrong declared oversized ID', () => {
  assert.throws(() => assertOversizedPagination(fixture(), [], ['not-long']), /oversized message: not-long/)
})

test('rejects a normal row split across otherwise continuous pages', () => {
  const pages = fixture()
  const rows = [row('owner', 0, 1700), row('long', 1700, 1700), row('ending', 3400, 100)]
  for (const page of pages) page.rows = rows.map(item => ({ ...item, y:item.y - page.top }))
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /page cut: message owner/)
})

test('rejects missing authored messages', () => {
  const pages = fixture()
  for (const page of pages) page.rows = page.rows.filter(item => item.id !== 'ending')
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /authored message: ending/)
})

test('rejects a normalized row position shift on a later page', () => {
  const pages = fixture()
  pages[1].rows[1].y += 100
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /shifted vertically or reflowed/)
})

test('rejects later-page dimension reflow', () => {
  const pages = fixture()
  pages[1].rows[1].height += 10
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /changed size or reflowed/)
})

test('rejects a full-panel shift that preserves row coordinates relative to the panel', () => {
  const pages = fixture()
  pages[1].panelOffset += 100
  for (const item of pages[1].rows) item.y += 100
  assert.throws(() => assertOversizedPagination(pages, [], ['long']), /panel shifted/)
})
