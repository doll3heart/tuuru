import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import {
  MAX_READER_PNG_EDGE,
  MAX_READER_PNG_PIXELS,
  parsePngDimensionsFromDataUrl,
  readerPngDimensionError,
} from "../reader/png-import-policy.js"

function pngHeaderDataUrl(width, height, mutate) {
  const bytes = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write("IHDR", 12, "ascii")
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  if (mutate) mutate(bytes)
  return `data:image/png;base64,${bytes.toString("base64")}`
}

test("PNG data URLs expose dimensions from a valid IHDR", () => {
  assert.deepEqual(parsePngDimensionsFromDataUrl(pngHeaderDataUrl(1870, 1870)), {
    width: 1870,
    height: 1870,
  })
  assert.deepEqual(
    parsePngDimensionsFromDataUrl(pngHeaderDataUrl(240, 320).replace("data:image/png", "data:")),
    { width: 240, height: 320 },
  )
})

test("PNG header parsing rejects malformed signatures and IHDR chunks", () => {
  assert.equal(parsePngDimensionsFromDataUrl(""), null)
  assert.equal(parsePngDimensionsFromDataUrl("data:image/png,not-base64"), null)
  assert.equal(parsePngDimensionsFromDataUrl("data:;base64,%%%%"), null)
  assert.equal(parsePngDimensionsFromDataUrl(`data:;base64,${Buffer.alloc(8).toString("base64")}`), null)
  assert.equal(parsePngDimensionsFromDataUrl(pngHeaderDataUrl(240, 240, bytes => { bytes[0] = 0 })), null)
  assert.equal(parsePngDimensionsFromDataUrl(pngHeaderDataUrl(240, 240, bytes => { bytes[11] = 12 })), null)
  assert.equal(parsePngDimensionsFromDataUrl(pngHeaderDataUrl(240, 240, bytes => { bytes.write("IDAT", 12, "ascii") })), null)
  assert.equal(parsePngDimensionsFromDataUrl(pngHeaderDataUrl(0, 240)), null)
})

test("reader PNG limits accept their exact edge and pixel boundaries", () => {
  assert.equal(MAX_READER_PNG_EDGE, 4096)
  assert.equal(MAX_READER_PNG_PIXELS, 4 * 1024 * 1024)
  assert.equal(readerPngDimensionError({ width: 4096, height: 1024 }), "")
  assert.equal(readerPngDimensionError({ width: 2048, height: 2048 }), "")
})

test("reader PNG limits reject excessive edges, pixels, and invalid headers", () => {
  assert.match(readerPngDimensionError(null), /PNG/)
  assert.match(readerPngDimensionError({ width: 4097, height: 1 }), /4096/)
  assert.match(readerPngDimensionError({ width: 2049, height: 2048 }), /像素/)
  const unsignedDimensions = parsePngDimensionsFromDataUrl(pngHeaderDataUrl(0x80000000, 1))
  assert.deepEqual(unsignedDimensions, { width: 0x80000000, height: 1 })
  assert.match(readerPngDimensionError(unsignedDimensions), /4096/)
})
