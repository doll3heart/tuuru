import {
  PHONE_MODULE_DRAG_PHASE,
  createPhoneModuleDragLifecycle,
} from "./editor-phone-module-drag.js"

const DRAGGING_CLASS = "dragging"
const DROP_CLASSES = ["drop-before", "drop-after"]

function closestWithin(root, target, selector) {
  if (!target || typeof target.closest !== "function") return null
  const match = target.closest(selector)
  return match && typeof root.contains === "function" && root.contains(match) ? match : null
}

function removeDropClasses(element) {
  element?.classList?.remove(...DROP_CLASSES)
}

export function createEditorChapterDragController({ root, threshold = 6, onCommit } = {}) {
  if (!root || typeof root.addEventListener !== "function") {
    throw new TypeError("A chapter tree root is required")
  }

  const documentObject = root.ownerDocument || (root.nodeType === 9 ? root : globalThis.document)
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

    const chapter = closestWithin(root, hit, ".wt-chapter[data-chapter-id]")
    const targetId = chapter?.dataset?.chapterId
    if (!chapter || typeof targetId !== "string" || targetId === draggedId) return null

    const title = chapter.querySelector?.(":scope > .wt-chapter-title")
    const titleRect = typeof title?.getBoundingClientRect === "function"
      ? title.getBoundingClientRect()
      : null
    const chapterRect = typeof chapter.getBoundingClientRect === "function"
      ? chapter.getBoundingClientRect()
      : null
    const rect = Number.isFinite(titleRect?.top)
      && Number.isFinite(titleRect?.bottom)
      && titleRect.bottom > titleRect.top
      ? titleRect
      : (chapterRect || { top: clientY, bottom: clientY })
    const top = Number.isFinite(rect?.top) ? rect.top : clientY
    const bottom = Number.isFinite(rect?.bottom) ? rect.bottom : top
    const placement = clientY < top + (bottom - top) / 2 ? "before" : "after"
    return {
      element: chapter,
      className: placement === "before" ? "drop-before" : "drop-after",
      payload: { draggedId, targetId, placement, inputMode: "pointer" },
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
    if (!documentObject || documentObject === root || typeof documentObject.addEventListener !== "function") return
    documentObject.addEventListener(type, listener)
    gesture.fallbackListeners.push({ type, listener })
  }

  function attachFallbackListeners(gesture) {
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
    gesture.chapter.classList.remove(DRAGGING_CLASS)
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
    const handle = closestWithin(root, event.target, ".wt-chapter-drag-handle")
    if (!handle) return
    const chapter = closestWithin(root, handle, ".wt-chapter[data-chapter-id]")
    const draggedId = chapter?.dataset?.chapterId
    if (!chapter || typeof draggedId !== "string" || !lifecycle.begin(event)) return

    const gesture = {
      handle,
      chapter,
      draggedId,
      pointerId: event.pointerId,
      captured: false,
      fallbackListeners: [],
    }
    activeGesture = gesture
    gesture.captured = tryPointerCapture(handle, event.pointerId)
    attachFallbackListeners(gesture)
  }

  function handlePointerMove(event) {
    const gesture = activeGesture
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const movement = lifecycle.move(event)
    if (!movement.accepted || !movement.dragging) return

    gesture.chapter.classList.add(DRAGGING_CLASS)
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
      gesture.chapter.classList.add(DRAGGING_CLASS)
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

  function handleKeyDown(event) {
    if (event.key === "Escape" && activeGesture) {
      if (cancelGesture()) event.preventDefault?.()
      return
    }
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return

    const handle = closestWithin(root, event.target, ".wt-chapter-drag-handle")
    const chapter = closestWithin(root, handle, ".wt-chapter[data-chapter-id]")
    if (!handle || !chapter) return
    event.preventDefault?.()

    const chapters = Array.from(root.querySelectorAll?.(".wt-chapter[data-chapter-id]") || [])
    const index = chapters.indexOf(chapter)
    const direction = event.key === "ArrowUp" ? -1 : 1
    const target = chapters[index + direction]
    const draggedId = chapter.dataset.chapterId
    const targetId = target?.dataset?.chapterId
    if (index < 0 || typeof draggedId !== "string" || typeof targetId !== "string") return

    commit({
      draggedId,
      targetId,
      placement: direction < 0 ? "before" : "after",
      inputMode: "keyboard",
    })
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== "Escape" || !activeGesture) return
    if (cancelGesture()) event.preventDefault?.()
  }

  root.addEventListener("pointerdown", handlePointerDown)
  root.addEventListener("pointermove", handlePointerMove)
  root.addEventListener("pointerup", handlePointerUp)
  root.addEventListener("pointercancel", handlePointerCancel)
  root.addEventListener("lostpointercapture", handleLostPointerCapture)
  root.addEventListener("keydown", handleKeyDown)
  if (documentObject !== root) documentObject?.addEventListener?.("keydown", handleDocumentKeyDown)
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
      root.removeEventListener("keydown", handleKeyDown)
      if (documentObject !== root) documentObject?.removeEventListener?.("keydown", handleDocumentKeyDown)
      windowObject?.removeEventListener?.("blur", handleWindowBlur)
      clearDrop()
    },
  }
}
