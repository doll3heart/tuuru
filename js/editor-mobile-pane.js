export const ARTICLE_EDITOR_MOBILE_QUERY = "(max-width: 480px), (max-height: 480px) and (pointer: coarse)"

const VALID_PANES = new Set(["editor", "outline"])

export function applyEditorMobilePane(root, pane) {
  if (!root || !VALID_PANES.has(pane) || typeof root.querySelectorAll !== "function") {
    return false
  }

  root.dataset.mobilePane = pane
  const controls = root.querySelectorAll('[data-a="mobile-pane"][data-pane]')
  for (const control of controls) {
    control.setAttribute("aria-pressed", String(control.dataset.pane === pane))
  }
  return true
}

export function isBoundedEditorViewport(windowObject = globalThis.window) {
  return Boolean(
    windowObject &&
    typeof windowObject.matchMedia === "function" &&
    windowObject.matchMedia(ARTICLE_EDITOR_MOBILE_QUERY).matches,
  )
}
