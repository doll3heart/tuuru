import test from "node:test"
import assert from "node:assert/strict"

import {
  PHONE_MODULE_DRAG_PHASE,
  createPhoneModuleDragLifecycle,
} from "../js/editor-phone-module-drag.js"

test("phone module drag lifecycle commits before returning to idle", () => {
  const transitions = []
  const lifecycle = createPhoneModuleDragLifecycle({
    threshold: 4,
    onTransition(previous, next, state) {
      transitions.push([previous, next, state.pointerId])
    },
  })

  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  assert.equal(lifecycle.begin({ pointerId: 7, isPrimary: true, button: 0, clientX: 10, clientY: 20 }), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  const belowThreshold = lifecycle.move({ pointerId: 7, clientX: 13, clientY: 23 })
  assert.equal(belowThreshold.accepted, true)
  assert.equal(belowThreshold.started, false)
  assert.equal(belowThreshold.dragging, false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  const started = lifecycle.move({ pointerId: 7, clientX: 14, clientY: 23 })
  assert.equal(started.accepted, true)
  assert.equal(started.started, true)
  assert.equal(started.dragging, true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.DRAGGING)

  const finished = lifecycle.finish({ pointerId: 7, clientX: 18, clientY: 25 })
  assert.equal(finished.accepted, true)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.deepEqual(lifecycle.current, {
    phase: PHONE_MODULE_DRAG_PHASE.COMMITTED,
    pointerId: 7,
    startX: 10,
    startY: 20,
    lastX: 18,
    lastY: 25,
  })

  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
  assert.deepEqual(transitions, [
    [PHONE_MODULE_DRAG_PHASE.IDLE, PHONE_MODULE_DRAG_PHASE.PENDING, 7],
    [PHONE_MODULE_DRAG_PHASE.PENDING, PHONE_MODULE_DRAG_PHASE.DRAGGING, 7],
    [PHONE_MODULE_DRAG_PHASE.DRAGGING, PHONE_MODULE_DRAG_PHASE.COMMITTED, 7],
    [PHONE_MODULE_DRAG_PHASE.COMMITTED, PHONE_MODULE_DRAG_PHASE.IDLE, null],
  ])
})

test("pointer-up consumes its final coordinates before deciding whether to drag", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 11, isPrimary: true, button: 0, clientX: 2, clientY: 2 })
  const finished = lifecycle.finish({ pointerId: 11, clientX: 6, clientY: 2 })

  assert.equal(finished.accepted, true)
  assert.equal(finished.started, true)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.COMMITTED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.COMMITTED)
})

test("tap and below-threshold movement cancel without becoming a drag", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 3, isPrimary: true, button: 0, clientX: 8, clientY: 9 })
  lifecycle.move({ pointerId: 3, clientX: 11, clientY: 12 })
  const finished = lifecycle.finish({ pointerId: 3, clientX: 11, clientY: 12 })

  assert.equal(finished.accepted, true)
  assert.equal(finished.started, false)
  assert.equal(finished.outcome, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
})

test("wrong pointers and non-primary starts cannot mutate the active lifecycle", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  assert.equal(lifecycle.begin({ pointerId: 1, isPrimary: false, button: 0, clientX: 0, clientY: 0 }), false)
  assert.equal(lifecycle.begin({ pointerId: 1, isPrimary: true, button: 2, clientX: 0, clientY: 0 }), false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)

  assert.equal(lifecycle.begin({ pointerId: 5, isPrimary: true, button: 0, clientX: 1, clientY: 1 }), true)
  assert.equal(lifecycle.begin({ pointerId: 6, isPrimary: true, button: 0, clientX: 1, clientY: 1 }), false)
  assert.equal(lifecycle.move({ pointerId: 6, clientX: 20, clientY: 20 }).accepted, false)
  assert.equal(lifecycle.cancel(6), false)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.PENDING)

  assert.equal(lifecycle.cancel(5), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.finish({ pointerId: 5, clientX: 20, clientY: 20 }).accepted, false)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.IDLE)
})

test("blur-style cancellation can terminate the current pointer without its id", () => {
  const lifecycle = createPhoneModuleDragLifecycle({ threshold: 4 })

  lifecycle.begin({ pointerId: 21, isPrimary: true, button: 0, clientX: 0, clientY: 0 })
  lifecycle.move({ pointerId: 21, clientX: 8, clientY: 0 })

  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.DRAGGING)
  assert.equal(lifecycle.cancel(), true)
  assert.equal(lifecycle.phase, PHONE_MODULE_DRAG_PHASE.CANCELLED)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.current.pointerId, null)
})

test("terminal operations are idempotent and cancellation snapshots stay complete", () => {
  const transitions = []
  const lifecycle = createPhoneModuleDragLifecycle({
    threshold: 4,
    onTransition(previous, next, state) {
      transitions.push({ previous, next, state })
    },
  })

  lifecycle.begin({ pointerId: 31, isPrimary: true, button: 0, clientX: 9, clientY: 9 })
  lifecycle.move({ pointerId: 31, clientX: 9, clientY: 5 })
  assert.equal(lifecycle.cancel(31), true)
  assert.equal(lifecycle.cancel(31), false)
  assert.equal(lifecycle.finish({ pointerId: 31, clientX: 0, clientY: 0 }).accepted, false)
  assert.equal(lifecycle.settle(), true)
  assert.equal(lifecycle.settle(), false)

  assert.deepEqual(transitions, [
    {
      previous: PHONE_MODULE_DRAG_PHASE.IDLE,
      next: PHONE_MODULE_DRAG_PHASE.PENDING,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.PENDING,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 9,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.PENDING,
      next: PHONE_MODULE_DRAG_PHASE.DRAGGING,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.DRAGGING,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 5,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.DRAGGING,
      next: PHONE_MODULE_DRAG_PHASE.CANCELLED,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.CANCELLED,
        pointerId: 31,
        startX: 9,
        startY: 9,
        lastX: 9,
        lastY: 5,
      },
    },
    {
      previous: PHONE_MODULE_DRAG_PHASE.CANCELLED,
      next: PHONE_MODULE_DRAG_PHASE.IDLE,
      state: {
        phase: PHONE_MODULE_DRAG_PHASE.IDLE,
        pointerId: null,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
      },
    },
  ])
})
