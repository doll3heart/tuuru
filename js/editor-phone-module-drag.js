export const PHONE_MODULE_DRAG_PHASE = Object.freeze({
  IDLE: "idle",
  PENDING: "pending",
  DRAGGING: "dragging",
  COMMITTED: "committed",
  CANCELLED: "cancelled",
})

function coordinate(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

export function createPhoneModuleDragLifecycle({ threshold = 4, onTransition } = {}) {
  const dragThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 4
  const notify = typeof onTransition === "function" ? onTransition : function() {}
  let state = idleState()

  function idleState() {
    return {
      phase: PHONE_MODULE_DRAG_PHASE.IDLE,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
    }
  }

  function snapshot() {
    return {
      phase: state.phase,
      pointerId: state.pointerId,
      startX: state.startX,
      startY: state.startY,
      lastX: state.lastX,
      lastY: state.lastY,
    }
  }

  function transition(nextPhase) {
    const previousPhase = state.phase
    state.phase = nextPhase
    notify(previousPhase, nextPhase, snapshot())
  }

  function matchesActivePointer(pointerId) {
    return pointerId === state.pointerId
      && (state.phase === PHONE_MODULE_DRAG_PHASE.PENDING || state.phase === PHONE_MODULE_DRAG_PHASE.DRAGGING)
  }

  function begin(input = {}) {
    if (state.phase !== PHONE_MODULE_DRAG_PHASE.IDLE) return false
    if (input.isPrimary === false || (input.button !== undefined && input.button !== 0)) return false
    if (!Number.isFinite(input.pointerId)) return false

    const startX = coordinate(input.clientX)
    const startY = coordinate(input.clientY)
    state = {
      phase: PHONE_MODULE_DRAG_PHASE.IDLE,
      pointerId: input.pointerId,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
    }
    transition(PHONE_MODULE_DRAG_PHASE.PENDING)
    return true
  }

  function move(input = {}) {
    if (!matchesActivePointer(input.pointerId)) {
      return { accepted: false, started: false, dragging: false }
    }

    const clientX = coordinate(input.clientX, state.lastX)
    const clientY = coordinate(input.clientY, state.lastY)
    const dx = clientX - state.startX
    const dy = clientY - state.startY
    state.lastX = clientX
    state.lastY = clientY

    let started = false
    if (
      state.phase === PHONE_MODULE_DRAG_PHASE.PENDING
      && (Math.abs(dx) >= dragThreshold || Math.abs(dy) >= dragThreshold)
    ) {
      transition(PHONE_MODULE_DRAG_PHASE.DRAGGING)
      started = true
    }

    return {
      accepted: true,
      started,
      dragging: state.phase === PHONE_MODULE_DRAG_PHASE.DRAGGING,
      clientX,
      clientY,
      dx,
      dy,
    }
  }

  function finish(input = {}) {
    const movement = move(input)
    if (!movement.accepted) {
      return { accepted: false, started: false, dragging: false, outcome: null }
    }

    const outcome = state.phase === PHONE_MODULE_DRAG_PHASE.DRAGGING
      ? PHONE_MODULE_DRAG_PHASE.COMMITTED
      : PHONE_MODULE_DRAG_PHASE.CANCELLED
    transition(outcome)
    return { ...movement, outcome }
  }

  function cancel(pointerId) {
    if (
      state.phase !== PHONE_MODULE_DRAG_PHASE.PENDING
      && state.phase !== PHONE_MODULE_DRAG_PHASE.DRAGGING
    ) return false
    if (pointerId !== undefined && pointerId !== state.pointerId) return false

    transition(PHONE_MODULE_DRAG_PHASE.CANCELLED)
    return true
  }

  function settle() {
    if (
      state.phase !== PHONE_MODULE_DRAG_PHASE.COMMITTED
      && state.phase !== PHONE_MODULE_DRAG_PHASE.CANCELLED
    ) return false

    const previousPhase = state.phase
    state = idleState()
    notify(previousPhase, PHONE_MODULE_DRAG_PHASE.IDLE, snapshot())
    return true
  }

  return {
    begin,
    move,
    finish,
    cancel,
    settle,
    get phase() {
      return state.phase
    },
    get current() {
      return snapshot()
    },
  }
}
