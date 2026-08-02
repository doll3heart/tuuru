import test from "node:test"
import assert from "node:assert/strict"

import {
  PHONE_HOME_CELL_HEIGHT,
  PHONE_HOME_MAX_PAGES,
  PHONE_HOME_ROWS,
  defaultPhoneHomeLayout,
  movePhoneHomeItem,
  normalizePhoneHomeLayout,
  phoneHomeDefinitions,
  phoneHomeFootprint,
  setPhoneHomePageCount,
} from "../reader/phone-home-layout.js"

function widgetConfig(...items) {
  return { items:items.map(([productId, size]) => ({ productId, size, enabled:true })) }
}

test("default phone home treats the identity card as a wide movable component", () => {
  const layout = defaultPhoneHomeLayout()
  assert.equal(layout.pageCount, 1)
  assert.deepEqual(layout.items.map(item => [item.key, item.page, item.x, item.y]), [
    ["profile:identity", 0, 0, 0],
    ["app:messages", 0, 0, 3], ["app:forum", 0, 2, 3],
    ["app:memo", 0, 4, 3], ["app:gallery", 0, 6, 3],
    ["app:browser", 0, 0, 5], ["app:shopping", 0, 2, 5],
    ["app:contacts", 0, 4, 5],
  ])
})

test("the home grid uses the lower phone screen before overflowing to another page", () => {
  const widgets = widgetConfig(
    ["v7-resume-dessert", "wide"],
    ["v7-date-picture", "wide"],
    ["v7-photo-double", "wide"],
  )
  const definitions = phoneHomeDefinitions(widgets)
  const layout = normalizePhoneHomeLayout(null, definitions)
  assert.equal(layout.items.length, 11)
  assert.deepEqual(layout.items.find(item => item.key === "widget:v7-resume-dessert"), {
    key:"widget:v7-resume-dessert", page:0, x:0, y:7,
  })
  assert.deepEqual(layout.items.find(item => item.key === "widget:v7-date-picture"), {
    key:"widget:v7-date-picture", page:0, x:0, y:10,
  })
  assert.deepEqual(layout.items.find(item => item.key === "widget:v7-photo-double"), {
    key:"widget:v7-photo-double", page:1, x:0, y:0,
  })
  assert.equal(layout.pageCount, 2)
  assert.equal(PHONE_HOME_ROWS, 13)
  assert.equal(PHONE_HOME_ROWS * PHONE_HOME_CELL_HEIGHT, 546)
})

test("moving like-sized Apps swaps them while moving a widget displaces collisions safely", () => {
  const widgets = widgetConfig(["v7-countdown-cherry", "half"])
  const definitions = phoneHomeDefinitions(widgets)
  let layout = normalizePhoneHomeLayout(null, definitions)
  layout = movePhoneHomeItem(layout, definitions, "app:messages", { page:0, x:2, y:3 })
  assert.deepEqual(layout.items.find(item => item.key === "app:messages"), { key:"app:messages", page:0, x:2, y:3 })
  assert.deepEqual(layout.items.find(item => item.key === "app:forum"), { key:"app:forum", page:0, x:0, y:3 })

  layout = movePhoneHomeItem(layout, definitions, "widget:v7-countdown-cherry", { page:0, x:0, y:0 })
  assert.deepEqual(layout.items.find(item => item.key === "widget:v7-countdown-cherry"), {
    key:"widget:v7-countdown-cherry", page:0, x:0, y:0,
  })
  assert.notDeepEqual(layout.items.find(item => item.key === "app:forum"), { key:"app:forum", page:0, x:0, y:0 })
})

test("custom decorations use their exact 2 by 2, 4 by 3, and 8 by 3 footprints", () => {
  const definitions = phoneHomeDefinitions({
    items:[],
    customDecorations:[
      { id:"custom-square01", size:"small", image:"data:image/png;base64,YQ==" },
      { id:"custom-half0001", size:"half", image:"data:image/png;base64,YQ==" },
      { id:"custom-wide0001", size:"wide", image:"data:image/png;base64,YQ==" },
    ],
  })
  const custom = definitions.filter(definition => definition.kind === "custom")

  assert.deepEqual(custom.map(definition => definition.key), [
    "custom:custom-square01", "custom:custom-half0001", "custom:custom-wide0001",
  ])
  assert.deepEqual(custom.map(phoneHomeFootprint), [
    { width:2, height:2 }, { width:4, height:3 }, { width:8, height:3 },
  ])

  const layout = normalizePhoneHomeLayout(null, definitions)
  assert.equal(layout.items.filter(item => item.key.startsWith("custom:")).length, 3)
})

test("an item can move to an arbitrary later screen and malformed layout is bounded", () => {
  const definitions = phoneHomeDefinitions(null)
  const malformed = normalizePhoneHomeLayout({
    pageCount:999,
    items:[
      { key:"app:messages", page:999, x:-4, y:99 },
      { key:"app:messages", page:2, x:2, y:2 },
      { key:"widget:unknown", page:0, x:0, y:0 },
    ],
  }, definitions)
  assert.equal(malformed.pageCount, PHONE_HOME_MAX_PAGES)
  assert.equal(malformed.items.length, 8)

  const moved = movePhoneHomeItem(malformed, definitions, "app:messages", { page:4, x:6, y:7 })
  assert.deepEqual(moved.items.find(item => item.key === "app:messages"), {
    key:"app:messages", page:4, x:6, y:7,
  })
  assert.equal(moved.pageCount, PHONE_HOME_MAX_PAGES)
  assert.equal(setPhoneHomePageCount(moved, definitions, 1).pageCount, 5)
})
