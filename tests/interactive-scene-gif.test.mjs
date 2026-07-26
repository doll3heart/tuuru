import test from "node:test"
import assert from "node:assert/strict"

import { gifDurationMs, isGifMedia } from "../js/interactive-scene-gif.js"

function gifWithDelays(...delays) {
  const bytes = [
    ...Buffer.from("GIF89a", "ascii"),
    1, 0, 1, 0, 0, 0, 0,
  ]
  for (const delay of delays) {
    bytes.push(
      0x21, 0xf9, 0x04, 0x00, delay & 0xff, (delay >> 8) & 0xff, 0x00, 0x00,
      0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0,
      0x02, 0x02, 0x4c, 0x01, 0x00,
    )
  }
  bytes.push(0x3b)
  return Uint8Array.from(bytes)
}

test("GIF duration sums the delays in one animation loop", () => {
  assert.equal(gifDurationMs(gifWithDelays(5, 10)), 150)
})

test("GIF media detection uses MIME data or the persisted filename", () => {
  assert.equal(isGifMedia("data:image/gif;base64,AA==", ""), true)
  assert.equal(isGifMedia("https://cdn.example.test/file", "reaction.GIF"), true)
  assert.equal(isGifMedia("https://cdn.example.test/reaction.png", ""), false)
})
