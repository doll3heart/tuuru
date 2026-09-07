import assert from 'node:assert/strict'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const epsilon = 2
const right = r => r.x + r.width
const bottom = r => r.y + r.height
const overlaps = (a, b) => Math.min(right(a), right(b)) - Math.max(a.x, b.x) > epsilon
  && Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > epsilon

export function assertGeometry(page) {
  for (const [index, row] of page.rows.entries()) {
    assert.ok(row.width > 0 && row.height > 0, `geometry: empty message ${row.id}`)
    for (const earlier of page.rows.slice(0, index)) {
      assert.ok(!overlaps(row, earlier), `overlap: ${row.id} row overlaps ${earlier.id}`)
    }
    for (const child of row.contents) {
      assert.ok(child.y >= row.y - epsilon && bottom(child) <= bottom(row) + epsilon,
        `geometry: ${row.id} content escapes its message row`)
      assert.ok(child.x >= -epsilon && right(child) <= page.width + epsilon,
        `geometry: ${row.id} content escapes page width`)
      for (const earlier of page.rows.slice(0, index)) {
        assert.ok(!overlaps(child, earlier), `overlap: ${row.id} overlaps ${earlier.id}`)
      }
    }
    for (const bubble of row.bubbles) for (const line of bubble.lines) {
      assert.ok(line.y >= bubble.y - epsilon && bottom(line) <= bottom(bubble) + epsilon,
        `text clipping: ${row.id} line escapes bubble`)
      assert.ok(line.x >= bubble.x - epsilon && right(line) <= right(bubble) + epsilon,
        `text clipping: ${row.id} line escapes bubble width`)
    }
  }
  for (const image of page.images) assert.ok(image.complete && image.width > 0, 'image asset failed to decode')
}

export function assertPagination(pages, commonIds) {
  assert.ok(pages.length >= 2, 'fixture must actually exercise multipage export')
  assert.equal(pages[0].top, 0, 'pagination must restart at zero for every route')
  const first = pages[0]
  for (const id of [...commonIds, 'owner', 'ending']) {
    assert.equal(first.rows.filter(row => row.id === id).length, 1, `missing or duplicate authored message: ${id}`)
  }
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    if (index) assert.equal(page.top, pages[index - 1].top + pages[index - 1].contentHeight, 'pagination gap or repeated content')
    assert.deepEqual(page.rows.map(row => row.id), first.rows.map(row => row.id), 'route changed while paginating')
  }
  assert.equal(pages.at(-1).top + pages.at(-1).contentHeight, Math.max(644, first.panelHeight), 'pagination omitted the end of the panel')
  for (const row of first.rows) {
    const y = row.y - first.panelOffset
    assert.ok(row.height <= 1500, `fixture message ${row.id} exceeds whole-message test bound`)
    assert.equal(pages.filter(page => y >= page.top - epsilon && y + row.height <= page.top + page.contentHeight + epsilon).length,
      1, `page cut: message ${row.id} is split or missing`)
  }
}

function crop(png, box) {
  const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y))
  const width = Math.min(png.width, Math.ceil(right(box))) - x
  const height = Math.min(png.height, Math.ceil(bottom(box))) - y
  if (width <= 0 || height <= 0) return null
  const result = new PNG({ width, height })
  PNG.bitblt(png, result, x, y, width, height, 0, 0)
  return result
}

export function compareRaster(actualBytes, referenceBytes, geometry) {
  const actual = PNG.sync.read(Buffer.from(actualBytes)), reference = PNG.sync.read(Buffer.from(referenceBytes))
  assert.equal(actual.width, Math.round(geometry.width * 2), 'PNG output width')
  assert.equal(actual.height, Math.round(geometry.height * 2), 'PNG output height')
  assert.equal(actual.width, reference.width, 'native/export widths differ')
  assert.equal(actual.height, reference.height, 'native/export heights differ')
  const diff = new PNG({ width:actual.width, height:actual.height })
  const mismatch = pixelmatch(actual.data, reference.data, diff.data, actual.width, actual.height, { threshold:0.15 })
  const ratio = mismatch / (actual.width * actual.height)
  const regions = geometry.rows.map(row => {
    const box = { x:row.x * 2, y:row.y * 2, width:row.width * 2, height:row.height * 2 }
    const a = crop(actual, box), b = crop(reference, box)
    if (!a || !b) return null
    const count = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold:0.15 })
    return { id:row.id, ratio:count / (a.width * a.height) }
  }).filter(Boolean)
  return { ratio, regions, diff:PNG.sync.write(diff) }
}

export function assertRaster(result) {
  assert.ok(result.ratio <= 0.01, `raster mismatch: ${(result.ratio * 100).toFixed(2)}% of page differs from native browser`)
  for (const region of result.regions) assert.ok(region.ratio <= 0.025,
    `raster mismatch: message ${region.id} differs by ${(region.ratio * 100).toFixed(2)}%`)
}
