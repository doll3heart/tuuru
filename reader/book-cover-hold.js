export function createBookCoverHold({
  delay = 520,
  movementThreshold = 10,
  setTimer = (callback, timeout) => setTimeout(callback, timeout),
  clearTimer = timer => clearTimeout(timer),
  onHold,
} = {}) {
  let current = null
  let suppressClick = false

  function clearCurrentTimer() {
    if (!current || current.timer === null) return
    clearTimer(current.timer)
    current.timer = null
  }

  function reset() {
    clearCurrentTimer()
    current = null
  }

  return {
    begin(event) {
      if (current || !event?.isPrimary || event.button !== 0 || !Number.isFinite(event.pointerId)) {
        return false
      }
      const gesture = {
        pointerId:event.pointerId,
        startX:Number(event.clientX) || 0,
        startY:Number(event.clientY) || 0,
        held:false,
        timer:null,
      }
      gesture.timer = setTimer(() => {
        if (current !== gesture) return
        gesture.timer = null
        gesture.held = true
        suppressClick = true
        if (typeof onHold === "function") onHold()
      }, delay)
      current = gesture
      return true
    },

    move(event) {
      if (!current || event?.pointerId !== current.pointerId) return false
      const deltaX = (Number(event.clientX) || 0) - current.startX
      const deltaY = (Number(event.clientY) || 0) - current.startY
      if (Math.hypot(deltaX, deltaY) <= movementThreshold) return true
      reset()
      return false
    },

    finish(event) {
      if (!current || event?.pointerId !== current.pointerId) return false
      const held = current.held
      reset()
      return held
    },

    cancel(pointerId) {
      if (!current || (pointerId !== undefined && pointerId !== current.pointerId)) return false
      reset()
      return true
    },

    consumeClickSuppression() {
      if (!suppressClick) return false
      suppressClick = false
      return true
    },
  }
}
