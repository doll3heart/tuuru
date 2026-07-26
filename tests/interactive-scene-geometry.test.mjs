import test from "node:test"
import assert from "node:assert/strict"

import {
  freehandPointsToHotspot,
  moveInteractiveHotspot,
  projectHotspotToMediaViewport,
  resizeInteractiveHotspot,
} from "../js/interactive-scene-geometry.js"

test("hotspots move inside the canvas without changing their size", () => {
  const moved = moveInteractiveHotspot(
    { x: 70, y: 10, width: 25, height: 30 },
    20,
    -30,
  )

  assert.deepEqual(moved, { x: 75, y: 0, width: 25, height: 30 })
})

test("corner resizing is clamped to the canvas and minimum hotspot size", () => {
  const resized = resizeInteractiveHotspot(
    { x: 20, y: 20, width: 30, height: 40 },
    "nw",
    40,
    50,
  )

  assert.deepEqual(resized, { x: 47, y: 57, width: 3, height: 3 })
})

test("freehand canvas points become a normalized irregular hotspot", () => {
  const hotspot = freehandPointsToHotspot([
    { x: 20, y: 30 },
    { x: 40, y: 20 },
    { x: 70, y: 80 },
  ], { id: "hotspot-1", label: "掌心" })

  assert.equal(hotspot.shape, "polygon")
  assert.deepEqual(
    { x: hotspot.x, y: hotspot.y, width: hotspot.width, height: hotspot.height },
    { x: 20, y: 20, width: 50, height: 60 },
  )
  assert.deepEqual(hotspot.points, [
    { x: 0, y: 16.67 },
    { x: 40, y: 0 },
    { x: 100, y: 100 },
  ])
})

test("image-aligned hotspots remain unchanged when author and reader use the same aspect ratio", () => {
  const projected = projectHotspotToMediaViewport(
    { x: 25, y: 30, width: 20, height: 18, referenceAspectRatio: 9 / 16 },
    {
      viewportWidth: 900,
      viewportHeight: 1600,
      sourceWidth: 1600,
      sourceHeight: 900,
      fit: "cover",
      transform: { scale: 1.4, x: 12, y: -8 },
    },
  )

  assert.deepEqual(projected, { x: 25, y: 30, width: 20, height: 18 })
})

test("image-aligned hotspots follow the same source pixels from a portrait author canvas to a landscape reader", () => {
  const projected = projectHotspotToMediaViewport(
    { x: 75, y: 40, width: 10, height: 20, referenceAspectRatio: 9 / 16 },
    {
      viewportWidth: 1600,
      viewportHeight: 900,
      sourceWidth: 1600,
      sourceHeight: 900,
      fit: "cover",
      transform: { scale: 1, x: 0, y: 0 },
    },
  )

  assert.deepEqual(projected, {
    x: 57.91,
    y: 40,
    width: 3.16,
    height: 20,
  })
})

test("legacy hotspots without an author canvas ratio retain their old screen coordinates", () => {
  const hotspot = { x: 75, y: 40, width: 10, height: 20 }
  assert.deepEqual(projectHotspotToMediaViewport(hotspot, {
    viewportWidth: 1600,
    viewportHeight: 900,
    sourceWidth: 1600,
    sourceHeight: 900,
    fit: "cover",
    transform: { scale: 1, x: 0, y: 0 },
  }), hotspot)
})
