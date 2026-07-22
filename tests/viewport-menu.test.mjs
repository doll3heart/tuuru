import test from "node:test"
import assert from "node:assert/strict"

import { computeFixedMenuPosition } from "../js/viewport-menu.js"

test("fixed menu keeps its preferred position when it fits", () => {
  assert.deepEqual(computeFixedMenuPosition(
    { x: 40, y: 60 },
    { width: 130, height: 180 },
    { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 },
  ), { left: 40, top: 60 })
})

test("fixed menu flips and clamps away from the right and bottom edges", () => {
  assert.deepEqual(computeFixedMenuPosition(
    { x: 380, y: 830 },
    { width: 150, height: 220 },
    { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 },
  ), { left: 222, top: 602 })
})

test("fixed menu respects a shifted visual viewport", () => {
  assert.deepEqual(computeFixedMenuPosition(
    { x: 105, y: 205 },
    { width: 200, height: 300 },
    { offsetLeft: 100, offsetTop: 200, width: 320, height: 480 },
  ), { left: 108, top: 208 })
})
