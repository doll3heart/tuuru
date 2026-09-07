import assert from 'node:assert/strict'

const epsilon = 2
const close = (actual, expected) => Math.abs(actual - expected) <= epsilon

export function assertOversizedPagination(pages, commonIds, oversizedIds) {
  assert.ok(pages.length >= 2, 'fixture must actually exercise multipage export')
  assert.equal(pages[0].top, 0, 'pagination must restart at zero for every route')

  const first = pages[0]
  const authoredIds = [...commonIds, 'owner', 'ending']
  for (const id of authoredIds) {
    assert.equal(first.rows.filter(row => row.id === id).length, 1,
      `missing or duplicate authored message: ${id}`)
  }
  for (const id of oversizedIds) {
    assert.equal(first.rows.filter(row => row.id === id).length, 1,
      `missing or duplicate oversized message: ${id}`)
  }

  const rowIds = first.rows.map(row => row.id)
  for (const [index, page] of pages.entries()) {
    assert.ok(Number.isFinite(page.top) && page.top >= 0, `pagination: page ${index} has invalid top`)
    assert.ok(Number.isFinite(page.contentHeight) && page.contentHeight > 0,
      `pagination: page ${index} has non-positive content size`)
    if (index) {
      assert.equal(page.top, pages[index - 1].top + pages[index - 1].contentHeight,
        'pagination gap or repeated content')
    }
    assert.deepEqual(page.rows.map(row => row.id), rowIds, 'route changed while paginating')
    assert.ok(close(page.panelOffset + page.top, first.panelOffset),
      `geometry: panel shifted while paginating`)
    assert.ok(close(page.panelHeight, first.panelHeight),
      `geometry: panel height changed while paginating`)
    for (const [rowIndex, row] of page.rows.entries()) {
      assert.ok(Number.isFinite(row.width) && Number.isFinite(row.height) && row.width > 0 && row.height > 0,
        `geometry: empty message ${row.id}`)
      const reference = first.rows[rowIndex]
      assert.ok(close(row.x, reference.x), `geometry: message ${row.id} shifted horizontally while paginating`)
      assert.ok(close(row.y - page.panelOffset, reference.y - first.panelOffset),
        `geometry: message ${row.id} shifted vertically or reflowed while paginating`)
      assert.ok(close(row.width, reference.width) && close(row.height, reference.height),
        `geometry: message ${row.id} changed size or reflowed while paginating`)
    }
  }

  assert.equal(pages.at(-1).top + pages.at(-1).contentHeight, Math.max(644, first.panelHeight),
    'pagination omitted the end of the panel')

  const oversized = new Set(oversizedIds)
  for (const row of first.rows) {
    const start = row.y - first.panelOffset
    const end = start + row.height
    if (!oversized.has(row.id)) {
      assert.equal(pages.filter(page =>
        start >= page.top - epsilon && end <= page.top + page.contentHeight + epsilon).length,
      1, `page cut: message ${row.id} is split or missing`)
      continue
    }

    assert.ok(row.height > 1600, `oversized message ${row.id} must be taller than 1600 CSS pixels`)
    const intersections = pages.map(page =>
      Math.max(0, Math.min(end, page.top + page.contentHeight) - Math.max(start, page.top)))
      .filter(height => height > 0)
    assert.ok(intersections.length >= 2, `oversized message ${row.id} must be visible on at least two pages`)
    const covered = intersections.reduce((sum, height) => sum + height, 0)
    assert.ok(Math.abs(covered - row.height) <= epsilon,
      `oversized message ${row.id} coverage is incomplete or duplicated`)
  }
}
