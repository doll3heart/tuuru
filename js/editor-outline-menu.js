const OUTLINE_ACTION_TRIGGER = '[data-a="outline-actions"]'
const OUTLINE_ACTION_HOST = "[data-outline-action-host]"

function closestElement(target, selector) {
  return target && typeof target.closest === "function" ? target.closest(selector) : null
}

export function createEditorOutlineMenuController(doc = globalThis.document) {
  if (!doc) throw new TypeError("An owner document is required")

  let openTrigger = null

  function getPanel(trigger) {
    const panelId = trigger?.getAttribute("aria-controls")
    return panelId ? doc.getElementById(panelId) : null
  }

  function close({ restoreFocus = false } = {}) {
    const trigger = openTrigger
    if (!trigger) return false

    openTrigger = null
    trigger.setAttribute("aria-expanded", "false")
    closestElement(trigger, OUTLINE_ACTION_HOST)?.removeAttribute("data-outline-actions-open")

    if (restoreFocus && trigger.isConnected) trigger.focus()
    return true
  }

  function open(trigger) {
    const panel = getPanel(trigger)
    const host = closestElement(trigger, OUTLINE_ACTION_HOST)
    if (!panel || !host || !host.contains(panel)) return false

    if (openTrigger !== trigger) close({ restoreFocus: false })
    openTrigger = trigger
    trigger.setAttribute("aria-expanded", "true")
    host.setAttribute("data-outline-actions-open", "true")

    const firstAction = panel.querySelector("select:not([disabled]),button:not([disabled])")
    firstAction?.focus()
    return true
  }

  function toggle(trigger) {
    if (openTrigger === trigger && trigger.getAttribute("aria-expanded") === "true") {
      close({ restoreFocus: true })
      return false
    }
    return open(trigger)
  }

  function closeForAction(control) {
    if (!openTrigger) return null
    const panel = getPanel(openTrigger)
    if (!panel?.contains(control)) return null

    const trigger = openTrigger
    close({ restoreFocus: false })
    return trigger
  }

  function handleClick(event) {
    const trigger = closestElement(event.target, OUTLINE_ACTION_TRIGGER)
    if (trigger) {
      toggle(trigger)
      return
    }

    if (!openTrigger) return
    const panel = getPanel(openTrigger)
    if (!panel?.contains(event.target)) close({ restoreFocus: false })
  }

  function handlePointerDown(event) {
    if (!openTrigger) return
    const panel = getPanel(openTrigger)
    if (openTrigger.contains(event.target) || panel?.contains(event.target)) return
    close({ restoreFocus: false })
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !openTrigger) return
    event.preventDefault()
    close({ restoreFocus: true })
  }

  doc.addEventListener("click", handleClick)
  doc.addEventListener("pointerdown", handlePointerDown)
  doc.addEventListener("keydown", handleKeydown)

  return {
    open,
    toggle,
    close,
    closeForAction,
    reset() {
      return close({ restoreFocus: false })
    },
    dispose() {
      close({ restoreFocus: false })
      doc.removeEventListener("click", handleClick)
      doc.removeEventListener("pointerdown", handlePointerDown)
      doc.removeEventListener("keydown", handleKeydown)
    },
  }
}
