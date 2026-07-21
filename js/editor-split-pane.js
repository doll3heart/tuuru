const STORAGE_KEY = "tuuru_editor_split"
const DEFAULT_WIDTH = 280
const MIN_WIDTH = 180
const MAX_WIDTH = 520
const COLLAPSE_THRESHOLD = 56

function clampWidth(value) {
  var number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_WIDTH
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(number)))
}

export function readEditorSplitPreference(storage = globalThis.localStorage) {
  try {
    var parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null")
    if (!parsed || typeof parsed !== "object") throw new Error("missing")
    return {width:clampWidth(parsed.width), collapsed:parsed.collapsed === true}
  } catch {
    return {width:DEFAULT_WIDTH, collapsed:false}
  }
}

export function outlineWidthFromPointer(bounds, clientX) {
  return Math.max(0, Math.round(Number(bounds?.right || 0) - Number(clientX || 0)))
}

export function createEditorSplitPaneController(documentObject = document, storage = globalThis.localStorage) {
  var active = null

  function persist(shell, collapsed) {
    var width = parseInt(shell.style.getPropertyValue("--editor-outline-width"), 10) || DEFAULT_WIDTH
    try { storage.setItem(STORAGE_KEY, JSON.stringify({width:clampWidth(width), collapsed:collapsed === true})) } catch {}
  }

  function collapse(shell) {
    shell.dataset.outlineCollapsed = "true"
    delete shell.dataset.outlineOverlay
    persist(shell, true)
  }

  function resize(shell, requestedWidth) {
    if (!shell) return
    if (requestedWidth <= COLLAPSE_THRESHOLD) {
      collapse(shell)
      return
    }
    var bounds = shell.getBoundingClientRect?.()
    var responsiveMax = bounds?.width > 0 ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(bounds.width * 0.55))) : MAX_WIDTH
    var width = Math.max(MIN_WIDTH, Math.min(responsiveMax, Math.round(requestedWidth)))
    shell.style.setProperty("--editor-outline-width", width + "px")
    delete shell.dataset.outlineCollapsed
    delete shell.dataset.outlineOverlay
    persist(shell, false)
    var separator = shell.querySelector("[data-editor-splitter]")
    separator?.setAttribute("aria-valuenow", String(width))
  }

  function openOverlay(shell) {
    if (!shell) return
    shell.dataset.outlineCollapsed = "true"
    shell.dataset.outlineOverlay = "true"
  }

  function closeOverlay(shell) {
    if (!shell) return
    delete shell.dataset.outlineOverlay
  }

  documentObject.addEventListener("pointerdown", function(event) {
    var separator = event.target?.closest?.("[data-editor-splitter]")
    if (!separator) return
    var shell = separator.closest(".editor-body-area")
    if (!shell) return
    event.preventDefault()
    active = {shell:shell, separator:separator, pointerId:event.pointerId}
    shell.dataset.outlineResizing = "true"
    try { separator.setPointerCapture?.(event.pointerId) } catch {}
  })
  documentObject.addEventListener("pointermove", function(event) {
    if (!active || (active.pointerId !== undefined && event.pointerId !== active.pointerId)) return
    resize(active.shell, outlineWidthFromPointer(active.shell.getBoundingClientRect(), event.clientX))
  })
  function finish(event) {
    if (!active || (active.pointerId !== undefined && event.pointerId !== active.pointerId)) return
    delete active.shell.dataset.outlineResizing
    active = null
  }
  documentObject.addEventListener("pointerup", finish)
  documentObject.addEventListener("pointercancel", finish)
  documentObject.addEventListener("keydown", function(event) {
    var separator = event.target?.closest?.("[data-editor-splitter]")
    if (!separator) return
    var shell = separator.closest(".editor-body-area")
    var width = parseInt(shell?.style.getPropertyValue("--editor-outline-width"), 10) || DEFAULT_WIDTH
    if (event.key === "ArrowLeft") { event.preventDefault(); resize(shell, width + 16) }
    if (event.key === "ArrowRight") { event.preventDefault(); resize(shell, width - 16) }
    if (event.key === "End") { event.preventDefault(); collapse(shell) }
  })

  return {resize:resize, collapse:collapse, openOverlay:openOverlay, closeOverlay:closeOverlay}
}
