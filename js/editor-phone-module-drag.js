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

export function resolveEditorPhoneModuleDropRange({ documentObject, clientX, clientY }) {
  if (typeof documentObject?.caretRangeFromPoint === "function") {
    return documentObject.caretRangeFromPoint(clientX, clientY)
  }
  if (typeof documentObject?.caretPositionFromPoint === "function") {
    const position = documentObject.caretPositionFromPoint(clientX, clientY)
    if (!position) return null
    const range = documentObject.createRange()
    range.setStart(position.offsetNode, position.offset)
    range.collapse(true)
    return range
  }
  return null
}

function closestElement(target, selector) {
  return target && typeof target.closest === "function" ? target.closest(selector) : null
}

export function createEditorPhoneModuleDragController({
  documentObject = globalThis.document,
  windowObject = documentObject?.defaultView || globalThis.window,
  lifecycle = createPhoneModuleDragLifecycle(),
  getWorkId = function() { return null },
  resolveDropRange = resolveEditorPhoneModuleDropRange,
  requestFrame = windowObject?.requestAnimationFrame?.bind(windowObject) || function(callback) { callback(); return 0 },
  cancelFrame = windowObject?.cancelAnimationFrame?.bind(windowObject) || function() {},
  onCommit = function() {},
  cardSelector = ".pm-inline-card",
  ignoreSelector = ".pm-card-hamburger",
  editableSelector = ".content-editable",
} = {}) {
  if (!documentObject || !windowObject) throw new TypeError("A document and window are required")

  let activeGesture = null
  let suppressedClickCard = null
  let indicator = null
  let disposed = false

  function ensureIndicator() {
    if (indicator?.isConnected) return indicator
    indicator = documentObject.createElement("div")
    indicator.className = "pm-drop-indicator"
    indicator.style.display = "none"
    documentObject.body.appendChild(indicator)
    return indicator
  }

  function hideIndicator() {
    if (indicator) indicator.style.display = "none"
  }

  function getDropRange(gesture, clientX, clientY) {
    try {
      return resolveDropRange({
        documentObject,
        editable: gesture.editable,
        card: gesture.card,
        clientX,
        clientY,
      })
    } catch (error) {
      return null
    }
  }

  function updateIndicator(gesture, clientX, clientY) {
    const range = getDropRange(gesture, clientX, clientY)
    if (!range || !gesture.editable.contains(range.startContainer)) {
      hideIndicator()
      return
    }

    try {
      const rect = range.getBoundingClientRect()
      const marker = ensureIndicator()
      marker.style.display = "block"
      marker.style.left = rect.left + "px"
      marker.style.top = (rect.top + 2) + "px"
      marker.style.height = Math.max(0, rect.height - 4) + "px"
    } catch (error) {
      hideIndicator()
    }
  }

  function rememberListener(gesture, element, type, listener) {
    element.addEventListener(type, listener)
    gesture.listeners.push({ element, type, listener })
  }

  function removeGestureListeners(gesture) {
    gesture.listeners.forEach(function(entry) {
      entry.element.removeEventListener(entry.type, entry.listener)
    })
    gesture.listeners = []
  }

  function releasePointer(gesture) {
    const card = gesture.card
    if (!gesture.captured || typeof card.releasePointerCapture !== "function") return
    try {
      if (typeof card.hasPointerCapture !== "function" || card.hasPointerCapture(gesture.pointerId)) {
        card.releasePointerCapture(gesture.pointerId)
      }
    } catch (error) {
      // The browser may already have released capture.
    }
  }

  function restoreCardAppearance(gesture) {
    const card = gesture.card
    card.classList.toggle("pm-card-dragging", gesture.hadDraggingClass)
    if (gesture.originalStyle === null) card.removeAttribute("style")
    else card.setAttribute("style", gesture.originalStyle)
  }

  function cancelPendingFrame(gesture) {
    if (gesture.rafId === null) return
    cancelFrame(gesture.rafId)
    gesture.rafId = null
  }

  function clearSelection() {
    const selection = typeof windowObject.getSelection === "function" ? windowObject.getSelection() : null
    if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges()
  }

  function restoreOriginalPosition(gesture) {
    cancelPendingFrame(gesture)
    restoreCardAppearance(gesture)
    hideIndicator()

    gesture.preview?.remove()
    gesture.preview = null
    if (gesture.originalParent?.isConnected) {
      if (gesture.originalNextSibling?.parentNode === gesture.originalParent) {
        gesture.originalParent.insertBefore(gesture.card, gesture.originalNextSibling)
      } else {
        gesture.originalParent.appendChild(gesture.card)
      }
    } else if (gesture.card.parentNode !== gesture.originalParent) {
      gesture.card.remove()
    }

    if (gesture.didDrag) clearSelection()
  }

  function beginDomDrag(gesture) {
    if (gesture.didDrag) return true
    const parent = gesture.card.parentNode
    if (!parent) return false

    gesture.didDrag = true
    const preview = gesture.card.cloneNode(true)
    preview.classList.add("pm-card-drag-preview", "pm-card-dragging")
    preview.removeAttribute("data-pm-id")
    preview.removeAttribute("data-pm-type")
    preview.removeAttribute("id")
    preview.setAttribute("aria-hidden", "true")
    preview.querySelectorAll("[id],[data-a],[data-pm-id],[data-pm-type]").forEach(function(element) {
      element.removeAttribute("id")
      element.removeAttribute("data-a")
      element.removeAttribute("data-pm-id")
      element.removeAttribute("data-pm-type")
    })
    preview.querySelectorAll("button,input,select,textarea,a,[tabindex]").forEach(function(control) {
      control.setAttribute("tabindex", "-1")
    })
    preview.style.position = "fixed"
    preview.style.left = "0"
    preview.style.top = "0"
    preview.style.zIndex = "9999"
    preview.style.pointerEvents = "none"
    preview.style.willChange = "transform"
    documentObject.body.appendChild(preview)
    gesture.preview = preview
    gesture.card.classList.add("pm-card-dragging")
    gesture.card.style.opacity = "0.35"
    gesture.card.style.cursor = "grabbing"
    return true
  }

  function moveDomCard(gesture, clientX, clientY) {
    cancelPendingFrame(gesture)
    gesture.rafId = requestFrame(function() {
      gesture.rafId = null
      if (activeGesture !== gesture || !gesture.didDrag) return
      gesture.preview.style.transform = `translate3d(${clientX - 70}px,${clientY - 16}px,0) scale(0.95)`
      updateIndicator(gesture, clientX, clientY)
    })
  }

  function cardNearRange(range, gesture) {
    const container = range.startContainer
    const element = container?.nodeType === 1 ? container : container?.parentElement
    const nearby = closestElement(element, cardSelector)
    return nearby && nearby !== gesture.card && gesture.editable.contains(nearby) ? nearby : null
  }

  function commitDomDrag(gesture, clientX, clientY) {
    cancelPendingFrame(gesture)
    restoreCardAppearance(gesture)
    hideIndicator()
    gesture.preview?.remove()
    gesture.preview = null

    const range = getDropRange(gesture, clientX, clientY)
    let placed = false
    if (gesture.editable.isConnected && range && gesture.editable.contains(range.startContainer)) {
      try {
        const nearbyCard = cardNearRange(range, gesture)
        if (nearbyCard) nearbyCard.parentNode.insertBefore(gesture.card, nearbyCard.nextSibling)
        else range.insertNode(gesture.card)
        placed = gesture.editable.contains(gesture.card)
      } catch (error) {
        placed = false
      }
    }

    if (!placed) {
      restoreOriginalPosition(gesture)
      return false
    }

    clearSelection()

    const content = gesture.editable.innerHTML
    if (content === gesture.originalHtml) return false
    onCommit({
      workId: gesture.workId,
      nodeId: gesture.nodeId,
      content,
      editable: gesture.editable,
      card: gesture.card,
    })
    return true
  }

  function cancelGesture(reason, pointerId) {
    const gesture = activeGesture
    if (!gesture || !lifecycle.cancel(pointerId)) return false

    activeGesture = null
    removeGestureListeners(gesture)
    releasePointer(gesture)
    restoreOriginalPosition(gesture)
    lifecycle.settle()
    return true
  }

  function handlePointerMove(event) {
    const gesture = activeGesture
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const movement = lifecycle.move(event)
    if (!movement.accepted) return
    if (movement.started && !beginDomDrag(gesture)) {
      cancelGesture("detached", event.pointerId)
      return
    }
    if (!movement.dragging) return
    event.preventDefault()
    moveDomCard(gesture, movement.clientX, movement.clientY)
  }

  function handlePointerUp(event) {
    const gesture = activeGesture
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const finished = lifecycle.finish(event)
    if (!finished.accepted) return

    const committed = finished.outcome === PHONE_MODULE_DRAG_PHASE.COMMITTED
    activeGesture = null
    if (committed) suppressedClickCard = gesture.card
    removeGestureListeners(gesture)
    releasePointer(gesture)

    try {
      if (committed) {
        event.preventDefault()
        commitDomDrag(gesture, finished.clientX, finished.clientY)
      } else {
        hideIndicator()
      }
    } finally {
      lifecycle.settle()
    }
  }

  function handlePointerCancel(event) {
    cancelGesture("pointercancel", event.pointerId)
  }

  function handleLostPointerCapture(event) {
    cancelGesture("lostpointercapture", event.pointerId)
  }

  function handleWindowBlur() {
    cancelGesture("blur")
  }

  function attachGestureListeners(gesture) {
    const target = gesture.captured ? gesture.card : documentObject
    rememberListener(gesture, target, "pointermove", handlePointerMove)
    rememberListener(gesture, target, "pointerup", handlePointerUp)
    rememberListener(gesture, target, "pointercancel", handlePointerCancel)
    if (gesture.captured) {
      rememberListener(gesture, gesture.card, "lostpointercapture", handleLostPointerCapture)
    }
    rememberListener(gesture, windowObject, "blur", handleWindowBlur)
  }

  function tryPointerCapture(card, pointerId) {
    if (typeof card.setPointerCapture !== "function") return false
    try {
      card.setPointerCapture(pointerId)
      return typeof card.hasPointerCapture !== "function" || card.hasPointerCapture(pointerId)
    } catch (error) {
      return false
    }
  }

  function handlePointerDown(event) {
    if (disposed || activeGesture) return
    const card = closestElement(event.target, cardSelector)
    if (!card || closestElement(event.target, ignoreSelector)) return
    const editable = closestElement(card, editableSelector)
    if (!editable || !lifecycle.begin(event)) return

    suppressedClickCard = null
    const gesture = {
      card,
      editable,
      workId: getWorkId(),
      nodeId: editable.dataset.n || null,
      pointerId: event.pointerId,
      originalHtml: editable.innerHTML,
      originalParent: card.parentNode,
      originalNextSibling: card.nextSibling,
      originalStyle: card.getAttribute("style"),
      hadDraggingClass: card.classList.contains("pm-card-dragging"),
      preview: null,
      listeners: [],
      rafId: null,
      didDrag: false,
      captured: false,
    }
    activeGesture = gesture
    gesture.captured = tryPointerCapture(card, event.pointerId)
    attachGestureListeners(gesture)
  }

  documentObject.addEventListener("pointerdown", handlePointerDown)

  return {
    cancel(reason = "cancelled") {
      return cancelGesture(reason)
    },
    reset(reason = "reset") {
      suppressedClickCard = null
      return cancelGesture(reason)
    },
    consumeClick(card, event) {
      if (suppressedClickCard !== card) return false
      suppressedClickCard = null
      return !event || event.detail !== 0
    },
    dispose() {
      if (disposed) return
      disposed = true
      suppressedClickCard = null
      cancelGesture("dispose")
      documentObject.removeEventListener("pointerdown", handlePointerDown)
      indicator?.remove()
      indicator = null
    },
    get phase() {
      return lifecycle.phase
    },
  }
}
