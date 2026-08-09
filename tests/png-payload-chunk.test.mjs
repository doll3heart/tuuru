import test from "node:test"
import assert from "node:assert/strict"

import {
  embedPngPayload,
  pngBytesFromDataUrl,
  pngBytesToDataUrl,
  readPngPayload,
} from "../js/png-payload.js"

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

test("PNG payload chunks preserve every byte of the visible source image", () => {
  const source = pngBytesFromDataUrl(ONE_PIXEL_PNG)
  const payload = new TextEncoder().encode("封面不会再被改成乱码")
  const encoded = embedPngPayload(source, payload)

  assert.deepEqual(readPngPayload(encoded), payload)
  assert.deepEqual(encoded.slice(0, source.length - 12), source.slice(0, -12))
  assert.deepEqual(encoded.slice(-12), source.slice(-12))
})

test("PNG payload data URLs survive a binary round trip", () => {
  const payload = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
  const encoded = embedPngPayload(pngBytesFromDataUrl(ONE_PIXEL_PNG), payload)
  const restored = pngBytesFromDataUrl(pngBytesToDataUrl(encoded))

  assert.deepEqual(restored, encoded)
  assert.deepEqual(readPngPayload(restored), payload)
})

test("PNG payload readers reject a corrupted private chunk", () => {
  const encoded = embedPngPayload(
    pngBytesFromDataUrl(ONE_PIXEL_PNG),
    new Uint8Array([10, 20, 30]),
  )
  encoded[encoded.length - 13] ^= 0xff

  assert.equal(readPngPayload(encoded), null)
})
