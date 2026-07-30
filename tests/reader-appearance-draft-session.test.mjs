import test from "node:test"
import assert from "node:assert/strict"
import {
  APPEARANCE_DRAFT_TTL_MS,
  createAppearanceDraftSession,
} from "../reader/appearance-draft-session.js"

test("appearance drafts are cloned on write and read", () => {
  let now = 100
  const session = createAppearanceDraftSession({ now:() => now })
  const source = { wallpaper:"#fff", nested:{ radius:8 } }

  assert.equal(session.write("phone", source), true)
  source.nested.radius = 16
  const firstRead = session.read("phone")
  assert.deepEqual(firstRead, { wallpaper:"#fff", nested:{ radius:8 } })

  firstRead.nested.radius = 24
  assert.equal(session.read("phone").nested.radius, 8)
})

test("appearance drafts expire and can be cleared explicitly", () => {
  let now = 0
  const session = createAppearanceDraftSession({ now:() => now })
  session.write("messages", { bubbleSize:100 })
  now = APPEARANCE_DRAFT_TTL_MS
  assert.deepEqual(session.read("messages"), { bubbleSize:100 })
  now += 1
  assert.equal(session.read("messages"), null)

  session.write("messages", { bubbleSize:110 })
  assert.equal(session.clear("messages"), true)
  assert.equal(session.read("messages"), null)
})

test("appearance draft keys and values fail closed", () => {
  const session = createAppearanceDraftSession()
  assert.equal(session.write("", { value:1 }), false)
  assert.equal(session.write("phone", null), false)
  assert.equal(session.read(""), null)
  assert.equal(session.clear(""), false)
})
