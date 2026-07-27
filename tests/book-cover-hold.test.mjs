import test from "node:test"
import assert from "node:assert/strict"
import { createBookCoverHold } from "../reader/book-cover-hold.js"

function harness() {
  const timers = new Map()
  let nextTimer = 0
  let held = 0
  const hold = createBookCoverHold({
    delay:520,
    movementThreshold:10,
    setTimer(callback) {
      nextTimer += 1
      timers.set(nextTimer, callback)
      return nextTimer
    },
    clearTimer(id) {
      timers.delete(id)
    },
    onHold() {
      held += 1
    },
  })
  return {
    hold,
    held:() => held,
    fire() {
      for (const callback of [...timers.values()]) callback()
      timers.clear()
    },
    timerCount:() => timers.size,
  }
}

test("book cover hold fires once and suppresses the release click", () => {
  const fixture = harness()
  assert.equal(fixture.hold.begin({
    pointerId:1,
    isPrimary:true,
    button:0,
    clientX:20,
    clientY:30,
  }), true)
  fixture.fire()
  assert.equal(fixture.held(), 1)
  assert.equal(fixture.hold.finish({ pointerId:1, clientX:20, clientY:30 }), true)
  assert.equal(fixture.hold.consumeClickSuppression(), true)
  assert.equal(fixture.hold.consumeClickSuppression(), false)
})

test("movement, cancellation, wrong pointers, and early release never trigger hold", () => {
  const moved = harness()
  moved.hold.begin({ pointerId:2, isPrimary:true, button:0, clientX:0, clientY:0 })
  moved.hold.move({ pointerId:2, clientX:11, clientY:0 })
  assert.equal(moved.timerCount(), 0)
  moved.fire()
  assert.equal(moved.held(), 0)

  const released = harness()
  released.hold.begin({ pointerId:3, isPrimary:true, button:0, clientX:0, clientY:0 })
  assert.equal(released.hold.finish({ pointerId:3, clientX:0, clientY:0 }), false)
  released.fire()
  assert.equal(released.held(), 0)

  const cancelled = harness()
  cancelled.hold.begin({ pointerId:4, isPrimary:true, button:0, clientX:0, clientY:0 })
  cancelled.hold.cancel(4)
  cancelled.fire()
  assert.equal(cancelled.held(), 0)

  assert.equal(cancelled.hold.begin({
    pointerId:5,
    isPrimary:false,
    button:0,
    clientX:0,
    clientY:0,
  }), false)
  assert.equal(cancelled.hold.begin({
    pointerId:6,
    isPrimary:true,
    button:2,
    clientX:0,
    clientY:0,
  }), false)
})

test("stale pointer events cannot finish or cancel a newer gesture", () => {
  const fixture = harness()
  fixture.hold.begin({ pointerId:7, isPrimary:true, button:0, clientX:0, clientY:0 })
  assert.equal(fixture.hold.finish({ pointerId:8, clientX:0, clientY:0 }), false)
  fixture.hold.cancel(8)
  assert.equal(fixture.timerCount(), 1)
  fixture.fire()
  assert.equal(fixture.held(), 1)
})
