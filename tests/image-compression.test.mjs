import test from "node:test"
import assert from "node:assert/strict"

import {
  IMAGE_HARD_LIMIT_BYTES,
  IMAGE_SOURCE_LIMIT_BYTES,
  IMAGE_TARGET_BYTES,
  compressEditorImage,
} from "../js/image-compression.js"

function file(size, type = "image/jpeg", name = "photo.jpg") {
  return { size, type, name }
}

test("editor image policy uses a 500KB target, 1MB hard limit, and 10MB source limit", () => {
  assert.equal(IMAGE_TARGET_BYTES, 500 * 1024)
  assert.equal(IMAGE_HARD_LIMIT_BYTES, 1024 * 1024)
  assert.equal(IMAGE_SOURCE_LIMIT_BYTES, 10 * 1024 * 1024)
})

test("small supported images pass through without lossy decoding", async () => {
  const source = file(300 * 1024)
  const result = await compressEditorImage(source, {
    readBlobAsDataURL: async () => "data:image/jpeg;base64,AA==",
    decodeImageFile: async () => { throw new Error("must not decode") },
  })

  assert.equal(result.dataUrl, "data:image/jpeg;base64,AA==")
  assert.equal(result.outputBytes, source.size)
  assert.equal(result.compressed, false)
})

test("oversized source files fail before reading", async () => {
  await assert.rejects(
    compressEditorImage(file(IMAGE_SOURCE_LIMIT_BYTES + 1)),
    error => error.code === "source-too-large",
  )
})

test("animated GIFs remain intact up to 1MB and reject larger files", async () => {
  const safeGif = file(700 * 1024, "image/gif", "loop.gif")
  const result = await compressEditorImage(safeGif, {
    readBlobAsDataURL: async () => "data:image/gif;base64,AA==",
  })
  assert.equal(result.compressed, false)

  await assert.rejects(
    compressEditorImage(file(IMAGE_HARD_LIMIT_BYTES + 1, "image/gif", "loop.gif")),
    error => error.code === "animated-image-too-large",
  )
})

test("large raster images use the smallest generated result and stop at the target", async () => {
  const generated = [800 * 1024, 480 * 1024]
  const calls = []
  const result = await compressEditorImage(file(2 * 1024 * 1024), {
    decodeImageFile: async () => ({ source: {}, width: 3000, height: 2000, close() {} }),
    encodeImage: async (_source, options) => {
      calls.push(options)
      return { size: generated.shift(), type: options.type }
    },
    readBlobAsDataURL: async blob => `data:${blob.type};base64,AA==`,
  })

  assert.equal(result.outputBytes, 480 * 1024)
  assert.equal(result.compressed, true)
  assert.equal(calls[0].width, 1920)
  assert.equal(calls[0].height, 1280)
  assert.ok(calls[1].quality < calls[0].quality)
})

test("compression rejects a result that cannot get below the 1MB hard limit", async () => {
  await assert.rejects(
    compressEditorImage(file(2 * 1024 * 1024), {
      decodeImageFile: async () => ({ source: {}, width: 1200, height: 800, close() {} }),
      encodeImage: async (_source, options) => ({ size: 1.2 * 1024 * 1024, type: options.type }),
    }),
    error => error.code === "output-too-large",
  )
})
