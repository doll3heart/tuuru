const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",")

function visibleFocusableControls(dialog) {
  if (!dialog?.querySelectorAll) return []
  return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(control => (
    !control.hidden
    && !control.closest("[hidden]")
    && control.getAttribute("aria-hidden") !== "true"
    && control.tabIndex !== -1
  ))
}

export function installDialogInteraction({
  overlay,
  dialog,
  invoker = null,
  initialFocus = null,
  onRequestClose,
  closeOnBackdrop = true,
} = {}) {
  if (!overlay?.addEventListener || !dialog?.addEventListener) {
    throw new TypeError("dialog interaction requires an overlay and dialog")
  }
  if (typeof onRequestClose !== "function") {
    throw new TypeError("dialog interaction requires an onRequestClose callback")
  }
  let disposed = false

  function requestClose(reason, event) {
    if (disposed) return
    event?.preventDefault?.()
    onRequestClose(reason)
  }

  function onOverlayClick(event) {
    if (closeOnBackdrop && event.target === overlay) requestClose("backdrop", event)
  }

  function onDialogKeydown(event) {
    if (event.key === "Escape") {
      requestClose("escape", event)
      return
    }
    if (event.key !== "Tab") return
    const focusables = visibleFocusableControls(dialog)
    if (!focusables.length) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && (dialog.ownerDocument.activeElement === first || dialog.ownerDocument.activeElement === dialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && dialog.ownerDocument.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  overlay.addEventListener("click", onOverlayClick)
  dialog.addEventListener("keydown", onDialogKeydown)
  if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1

  const preferred = typeof initialFocus === "string"
    ? dialog.querySelector(initialFocus)
    : initialFocus
  const firstFocus = preferred || visibleFocusableControls(dialog)[0] || dialog
  firstFocus?.focus?.()

  return {
    dispose(options = {}) {
      if (disposed) return false
      disposed = true
      overlay.removeEventListener("click", onOverlayClick)
      dialog.removeEventListener("keydown", onDialogKeydown)
      if (options.restoreFocus !== false && invoker?.isConnected) invoker.focus?.()
      return true
    },
  }
}
