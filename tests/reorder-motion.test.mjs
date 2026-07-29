import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { refreshReorderedContent } from "../js/reorder-motion.js"

test("reordered content animates only items whose visual position changed", () => {
  const dom = new JSDOM('<div id="list"><div data-id="a"></div><div data-id="b"></div></div>')
  const list = dom.window.document.getElementById("list")
  const positions = {
    a:{left:0, top:0},
    b:{left:0, top:50},
  }
  const animations = []
  Array.from(list.children).forEach(element => {
    element.getBoundingClientRect = () => positions[element.dataset.id]
    element.animate = (frames, options) => animations.push({id:element.dataset.id, frames, options})
  })

  const count = refreshReorderedContent({
    container:list,
    selector:"[data-id]",
    animate:true,
    update() {
      positions.a = {left:0, top:50}
      positions.b = {left:0, top:0}
    },
  })

  assert.equal(count, 2)
  assert.deepEqual(animations.map(animation => animation.id), ["a", "b"])
  assert.equal(animations[0].options.duration, 180)
  dom.window.close()
})

test("reordered content skips motion when animation is disabled", () => {
  const dom = new JSDOM('<div id="list"><div data-id="a"></div></div>')
  const list = dom.window.document.getElementById("list")
  let animated = false
  list.firstElementChild.animate = () => { animated = true }
  const count = refreshReorderedContent({
    container:list,
    selector:"[data-id]",
    animate:false,
    update() {},
  })
  assert.equal(count, 0)
  assert.equal(animated, false)
  dom.window.close()
})
