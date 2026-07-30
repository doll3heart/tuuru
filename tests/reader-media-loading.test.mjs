import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  predecodeReaderImage,
  readerImageAttributes,
  scheduleReaderImagePredecode,
} from "../reader/reader-media-loading.js"

test("reader image attributes defer offscreen media and prioritize current media", () => {
  assert.equal(
    readerImageAttributes(),
    ' loading="lazy" decoding="async" fetchpriority="low"',
  )
  assert.equal(
    readerImageAttributes({ eager:true }),
    ' loading="eager" decoding="async" fetchpriority="high"',
  )
})

test("reader image predecode resolves successful decode and load-only fallbacks", async () => {
  class DecodedImage {
    set src(value) { this.currentSrc = value }
    decode() { return Promise.resolve() }
  }
  assert.equal(await predecodeReaderImage("https://example.test/wallpaper.webp", DecodedImage), true)

  class LoadedImage {
    set src(value) {
      this.currentSrc = value
      queueMicrotask(() => this.onload?.())
    }
  }
  assert.equal(await predecodeReaderImage("data:image/png;base64,AA==", LoadedImage), true)
})

test("reader image predecode fails harmlessly and scheduled work is shared", async () => {
  let creations = 0
  class BrokenImage {
    constructor() { creations += 1 }
    set src(value) {
      this.currentSrc = value
      queueMicrotask(() => this.onerror?.())
    }
  }
  const first = scheduleReaderImagePredecode("https://example.test/broken.webp", BrokenImage)
  const second = scheduleReaderImagePredecode("https://example.test/broken.webp", BrokenImage)
  assert.equal(first, second)
  assert.equal(await first, false)
  assert.equal(creations, 1)
  assert.equal(await predecodeReaderImage("", BrokenImage), false)
})

test("reader runtime defers offscreen feed painting and gallery image decoding", () => {
  const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
  const source = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
  assert.match(css, /@supports \(content-visibility: auto\)/)
  assert.match(css, /\.rd-chat-message,[\s\S]*content-visibility: auto/)
  assert.match(source, /readerImageAttributes\(\)/)
  assert.match(source, /scheduleReaderImagePredecode\(skin\.wallpaperImage\)/)
})
