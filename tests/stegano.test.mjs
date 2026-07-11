import test from "node:test"
import assert from "node:assert/strict"
import {
  MAX_STEGANO_PAYLOAD_BYTES,
  readSteganoPayload,
  writeSteganoPayload,
} from "../js/stegano.js"

function rgbaPixelsFor(rgbByteCapacity, alpha = 255) {
  const pixels = new Uint8ClampedArray(Math.ceil(rgbByteCapacity / 3) * 4)
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = alpha
  return pixels
}

function writeLengthHeader(pixels, length) {
  const header = [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  ]
  header.forEach((byte, index) => {
    const pixelIndex = Math.floor(index / 3) * 4 + (index % 3)
    pixels[pixelIndex] = byte
  })
}

test("stegano payloads round-trip UTF-8 through RGB without touching alpha", () => {
  const text = JSON.stringify({ title: "RGB 长度头", body: "本地阅读" })
  const payload = new TextEncoder().encode(text)
  const pixels = rgbaPixelsFor(payload.length + 4, 73)

  writeSteganoPayload(pixels, payload)

  assert.equal(pixels[3], 73)
  assert.equal(pixels[4], payload.length & 0xff)
  assert.equal(new TextDecoder().decode(readSteganoPayload(pixels)), text)
  for (let index = 3; index < pixels.length; index += 4) assert.equal(pixels[index], 73)
})

test("stegano payload capacity includes its four-byte header", () => {
  const exactPixels = rgbaPixelsFor(6)
  const exactPayload = new Uint8Array([1, 2])
  writeSteganoPayload(exactPixels, exactPayload)
  assert.deepEqual(readSteganoPayload(exactPixels), exactPayload)

  const truncatedPixels = rgbaPixelsFor(6)
  writeLengthHeader(truncatedPixels, 3)
  assert.equal(readSteganoPayload(truncatedPixels), null)
})

test("stegano payloads reject empty and over-limit length headers", () => {
  const emptyPixels = rgbaPixelsFor(6)
  assert.equal(readSteganoPayload(emptyPixels), null)

  const oversizedPixels = rgbaPixelsFor(MAX_STEGANO_PAYLOAD_BYTES + 5)
  writeLengthHeader(oversizedPixels, MAX_STEGANO_PAYLOAD_BYTES + 1)
  assert.equal(readSteganoPayload(oversizedPixels), null)
})
