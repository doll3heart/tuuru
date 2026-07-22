const EXCLUDED_INPUT_TYPES = new Set([
  "button", "checkbox", "color", "date", "datetime-local", "file", "hidden",
  "month", "number", "password", "radio", "range", "reset", "submit", "time", "url", "week",
])

export function isPhoneMentionInput(target) {
  if (!target || target.disabled || target.readOnly) return false
  const tag = String(target.tagName || "").toLowerCase()
  if (tag === "textarea") return true
  if (tag !== "input") return false
  return !EXCLUDED_INPUT_TYPES.has(String(target.type || "text").toLowerCase())
}

export function bindPhoneMentionTrigger(root, openPicker) {
  if (!root || typeof root.addEventListener !== "function" || typeof openPicker !== "function") return () => {}
  const composing = new WeakSet()
  const openedAt = new WeakMap()
  let released = false

  function onCompositionStart(event) {
    if (isPhoneMentionInput(event.target)) composing.add(event.target)
  }
  function maybeOpen(input) {
    if (!isPhoneMentionInput(input) || input.closest?.(".phone-mention-picker")) return
    const caret = Number.isInteger(input.selectionStart) ? input.selectionStart : String(input.value || "").length
    if (caret < 1 || String(input.value || "").charAt(caret - 1) !== "@") return
    const marker = String(input.value || "") + "::" + caret
    if (openedAt.get(input) === marker) return
    openedAt.set(input, marker)
    openPicker(input)
  }
  function onCompositionEnd(event) {
    composing.delete(event.target)
    maybeOpen(event.target)
  }
  function onBeforeInput(event) {
    const input = event.target
    if (!isPhoneMentionInput(input) || composing.has(input) || event.isComposing) return
    if (!String(event.data || "").includes("@")) return
    const view = input.ownerDocument?.defaultView
    const defer = view?.setTimeout?.bind(view) || setTimeout
    defer(function() { if (!released) maybeOpen(input) }, 0)
  }
  function onInput(event) {
    const input = event.target
    if (!isPhoneMentionInput(input) || composing.has(input) || event.isComposing) return
    maybeOpen(input)
  }
  function onKeyUp(event) {
    const input = event.target
    if (!isPhoneMentionInput(input) || composing.has(input) || event.isComposing) return
    maybeOpen(input)
  }

  root.addEventListener("compositionstart", onCompositionStart, true)
  root.addEventListener("compositionend", onCompositionEnd, true)
  root.addEventListener("beforeinput", onBeforeInput, true)
  root.addEventListener("input", onInput, true)
  root.addEventListener("keyup", onKeyUp, true)
  return function releasePhoneMentionTrigger() {
    released = true
    root.removeEventListener("compositionstart", onCompositionStart, true)
    root.removeEventListener("compositionend", onCompositionEnd, true)
    root.removeEventListener("beforeinput", onBeforeInput, true)
    root.removeEventListener("input", onInput, true)
    root.removeEventListener("keyup", onKeyUp, true)
  }
}

export function insertPhoneMention(input, token) {
  if (!input) return
  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : String(input.value || "").length
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start
  const value = String(token || "").trim()
  input.value = String(input.value || "").slice(0, start) + value + " " + String(input.value || "").slice(end)
  const cursor = start + value.length + 1
  input.setSelectionRange?.(cursor, cursor)
  const EventConstructor = input.ownerDocument?.defaultView?.Event || Event
  input.dispatchEvent(new EventConstructor("input", { bubbles:true }))
  input.focus?.()
}
