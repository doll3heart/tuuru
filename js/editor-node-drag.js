import {
  PHONE_MODULE_DRAG_PHASE,
  createPhoneModuleDragLifecycle,
} from "./editor-phone-module-drag.js"

const DRAGGING_CLASS = "dragging"
const DROP_CLASSES = ["drop-before", "drop-after", "drop-inside"]

function closestWithin(root, target, selector) {
  if (!target || typeof target.closest !== "function") return null
  const match = target.closest(selector)
  return match && typeof root.contains === "function" && root.contains(match) ? match : null
}

function chapterIdFor(element) {
  if (typeof element?.dataset?.chapterId === "string") return element.dataset.chapterId
  const chapter = typeof element?.closest === "function" ? element.closest("[data-chapter-id]") : null
  return typeof chapter?.dataset?.chapterId === "string" ? chapter.dataset.chapterId : null
}

function removeDropClasses(element) {
  if (!element?.classList) return
  element.classList.remove(...DROP_CLASSES)
}

export function createEditorNodeDragController({ root, threshold = 6, onCommit } = {}) {
  if (!root || typeof root.addEventListener !== "function") {
    throw new TypeError("A node tree root is required")
  }

  const documentObject = root.ownerDocument || globalThis.document
  const windowObject = documentObject?.defaultView || globalThis.window
  const commit = typeof onCommit === "function" ? onCommit : function() {}
  const lifecycle = createPhoneModuleDragLifecycle({ threshold })
  let activeGesture = null
  let activeDrop = null
  let destroyed = false

  function clearDrop() {
    if (activeDrop) removeDropClasses(activeDrop.element)
    activeDrop = null
  }

  function resolveDrop(clientX, clientY, draggedId) {
    let hit = null
    try {
      hit = documentObject?.elementFromPoint?.(clientX, clientY) || null
    } catch (error) {
      hit = null
    }
    if (!hit || (typeof root.contains === "function" && !root.contains(hit))) return null

    const node = closestWithin(root, hit, ".wt-node[data-node-id]")
    if (node) {
      const targetId = node.dataset.nodeId
      const targetChapterId = chapterIdFor(node)
      if (typeof targetId !== "string" || targetChapterId === null) return null

      const rect = typeof node.getBoundingClientRect === "function"
        ? node.getBoundingClientRect()
        : { top: clientY, bottom: clientY }
      const top = Number.isFinite(rect?.top) ? rect.top : clientY
      const bottom = Number.isFinite(rect?.bottom) ? rect.bottom : top
      const placement = clientY < top + (bottom - top) / 2 ? "before" : "after"
      return {
        element: node,
        className: placement === "before" ? "drop-before" : "drop-after",
        payload: { draggedId, targetId, targetChapterId, placement },
      }
    }

    const chapter = closestWithin(root, hit, "[data-node-drop-chapter][data-chapter-id]")
    const targetChapterId = chapterIdFor(chapter)
    if (!chapter || targetChapterId === null) return null
    return {
      element: chapter,
      className: "drop-inside",
      payload: { draggedId, targetChapterId, placement: "inside" },
    }
  }

  function updateDrop(clientX, clientY, gesture) {
    clearDrop()
    const nextDrop = resolveDrop(clientX, clientY, gesture.draggedId)
    if (!nextDrop) return null
    nextDrop.element.classList.add(nextDrop.className)
    activeDrop = nextDrop
    return nextDrop
  }

  function rememberFallbackListener(gesture, type, listener) {
    if (!documentObject || typeof documentObject.addEventListener !== "function") return
    documentObject.addEventListener(type, listener)
    gesture.fallbackListeners.push({ type, listener })
  }

  function attachFallbackListeners(gesture) {
    if (documentObject === root) return
    rememberFallbackListener(gesture, "pointermove", handlePointerMove)
    rememberFallbackListener(gesture, "pointerup", handlePointerUp)
    rememberFallbackListener(gesture, "pointercancel", handlePointerCancel)
  }

  function removeFallbackListeners(gesture) {
    if (!documentObject || typeof documentObject.removeEventListener !== "function") return
    gesture.fallbackListeners.forEach(({ type, listener }) => {
      documentObject.removeEventListener(type, listener)
    })
    gesture.fallbackListeners = []
  }

  function tryPointerCapture(handle, pointerId) {
    if (typeof handle.setPointerCapture !== "function") return false
    try {
      handle.setPointerCapture(pointerId)
      return typeof handle.hasPointerCapture !== "function" || handle.hasPointerCapture(pointerId)
    } catch (error) {
      return false
    }
  }

  function releasePointer(gesture) {
    if (!gesture.captured || typeof gesture.handle.releasePointerCapture !== "function") return
    try {
      if (
        typeof gesture.handle.hasPointerCapture !== "function"
        || gesture.handle.hasPointerCapture(gesture.pointerId)
      ) {
        gesture.handle.releasePointerCapture(gesture.pointerId)
      }
    } catch (error) {
      // Pointer capture may already have been released by the browser.
    }
  }

  function cleanGesture(gesture) {
    gesture.node.classList.remove(DRAGGING_CLASS)
    clearDrop()
    removeFallbackListeners(gesture)
    releasePointer(gesture)
  }

  function cancelGesture(pointerId) {
    const gesture = activeGesture
    if (!gesture || !lifecycle.cancel(pointerId)) return false
    activeGesture = null
    cleanGesture(gesture)
    lifecycle.settle()
    return true
  }

  function handlePointerDown(event) {
    if (destroyed || activeGesture) return
    const handle = closestWithin(root, event.target, ".wt-node-drag-handle")
    if (!handle) return
    const node = closestWithin(root, handle, ".wt-node[data-node-id]")
    const draggedId = node?.dataset?.nodeId
    if (!node || typeof draggedId !== "string" || !lifecycle.begin(event)) return

    const gesture = {
      handle,
      node,
      draggedId,
      pointerId: event.pointerId,
      captured: false,
      fallbackListeners: [],
    }
    activeGesture = gesture
    gesture.captured = tryPointerCapture(handle, event.pointerId)
    if (!gesture.captured) attachFallbackListeners(gesture)
  }

  function handlePointerMove(event) {
    const gesture = activeGesture
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const movement = lifecycle.move(event)
    if (!movement.accepted || !movement.dragging) return

    gesture.node.classList.add(DRAGGING_CLASS)
    event.preventDefault?.()
    updateDrop(movement.clientX, movement.clientY, gesture)
  }

  function handlePointerUp(event) {
    const gesture = activeGesture
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const finished = lifecycle.finish(event)
    if (!finished.accepted) return

    let payload = null
    if (finished.outcome === PHONE_MODULE_DRAG_PHASE.COMMITTED) {
      gesture.node.classList.add(DRAGGING_CLASS)
      payload = updateDrop(finished.clientX, finished.clientY, gesture)?.payload || null
      event.preventDefault?.()
    }

    activeGesture = null
    cleanGesture(gesture)
    lifecycle.settle()
    if (payload) commit(payload)
  }

  function handlePointerCancel(event) {
    cancelGesture(event.pointerId)
  }

  function handleLostPointerCapture(event) {
    cancelGesture(event.pointerId)
  }

  function handleWindowBlur() {
    cancelGesture()
  }

  root.addEventListener("pointerdown", handlePointerDown)
  root.addEventListener("pointermove", handlePointerMove)
  root.addEventListener("pointerup", handlePointerUp)
  root.addEventListener("pointercancel", handlePointerCancel)
  root.addEventListener("lostpointercapture", handleLostPointerCapture)
  windowObject?.addEventListener?.("blur", handleWindowBlur)

  return {
    reset() {
      return cancelGesture()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelGesture()
      root.removeEventListener("pointerdown", handlePointerDown)
      root.removeEventListener("pointermove", handlePointerMove)
      root.removeEventListener("pointerup", handlePointerUp)
      root.removeEventListener("pointercancel", handlePointerCancel)
      root.removeEventListener("lostpointercapture", handleLostPointerCapture)
      windowObject?.removeEventListener?.("blur", handleWindowBlur)
      clearDrop()
    },
  }
}
