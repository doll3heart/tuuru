import test from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_WORK_WATERMARK,
  WORK_WATERMARK_IMAGE_MAX_BYTES,
  hasRenderableWorkWatermark,
  normalizeWorkWatermark,
} from "../js/work-watermark.js"
import { validateWorkForImport } from "../js/work-schema.js"

function articleWork(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "watermark-work",
    type: "article",
    title: "Watermark",
    nodes: [{ id: "start", title: "Start", content: "<p>Text</p>", choices: [] }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    startNode: "start",
    ...overrides,
  }
}

test("work watermark starts from complete detached defaults", () => {
  const first = normalizeWorkWatermark()
  const second = normalizeWorkWatermark()
  assert.deepEqual(first, DEFAULT_WORK_WATERMARK)
  assert.notEqual(first, second)
  first.text = "mutated"
  assert.equal(second.text, "")
})

test("work watermark clamps numbers, text, and layout enums", () => {
  const normalized = normalizeWorkWatermark({
    enabled: true,
    kind: "video",
    text: `  ${"署".repeat(100)}  `,
    opacity: 9,
    coverage: "edge",
    position: "outside",
    pattern: "random",
    spacing: 4,
  })
  assert.equal(normalized.enabled, true)
  assert.equal(normalized.kind, "text")
  assert.equal(normalized.text.length, 80)
  assert.equal(normalized.opacity, 0.45)
  assert.equal(normalized.coverage, "single")
  assert.equal(normalized.position, "bottom-right")
  assert.equal(normalized.pattern, "diagonal")
  assert.equal(normalized.spacing, 80)
})

test("work watermark accepts only bounded embedded raster images", () => {
  const image = "data:image/png;base64,AA=="
  assert.equal(normalizeWorkWatermark({ image }).image, image)
  assert.equal(normalizeWorkWatermark({ image: "https://example.com/mark.png" }).image, null)
  assert.equal(normalizeWorkWatermark({ image: "data:image/svg+xml;base64,AA==" }).image, null)
  const oversized = `data:image/png;base64,${Buffer.alloc(WORK_WATERMARK_IMAGE_MAX_BYTES + 1).toString("base64")}`
  assert.equal(normalizeWorkWatermark({ image: oversized }).image, null)
})

test("renderability follows the enabled content kind", () => {
  assert.equal(hasRenderableWorkWatermark({ enabled: true, kind: "text", text: "禁止偷吃" }), true)
  assert.equal(hasRenderableWorkWatermark({ enabled: true, kind: "text", text: "" }), false)
  assert.equal(hasRenderableWorkWatermark({ enabled: true, kind: "image", image: "data:image/webp;base64,AA==" }), true)
  assert.equal(hasRenderableWorkWatermark({ enabled: false, kind: "text", text: "署名" }), false)
})

test("work import normalizes present watermark data without adding it to legacy works", () => {
  const legacy = validateWorkForImport(articleWork())
  assert.equal(legacy.ok, true)
  assert.equal(Object.hasOwn(legacy.work, "watermark"), false)

  const imported = validateWorkForImport(articleWork({
    watermark: {
      enabled: true,
      kind: "image",
      image: "javascript:alert(1)",
      opacity: -1,
      coverage: "full",
      pattern: "cross",
      spacing: 999,
    },
  }))
  assert.equal(imported.ok, true)
  assert.equal(imported.work.watermark.enabled, true)
  assert.equal(imported.work.watermark.image, null)
  assert.equal(imported.work.watermark.opacity, 0.05)
  assert.equal(imported.work.watermark.pattern, "cross")
  assert.equal(imported.work.watermark.spacing, 260)
})
