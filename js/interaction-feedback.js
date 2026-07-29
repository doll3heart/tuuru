const pendingButtons = new WeakMap()

function callable(value) {
  return typeof value === "function"
}

export function createFeedbackCenter(options = {}) {
  const documentObject = options.documentObject ?? globalThis.document
  if (!documentObject?.body) throw new TypeError("feedback center requires a document body")
  const className = String(options.className || "toast")
  const defaultDuration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 3000
  const setTimer = options.setTimer ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const clearTimer = options.clearTimer ?? (timer => globalThis.clearTimeout(timer))
  let root = null
  let timer = null
  let actionConsumed = false

  function clearDismissTimer() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  function dismiss() {
    clearDismissTimer()
    root?.remove()
    root = null
  }

  function ensureRoot() {
    if (root?.isConnected) return root
    root = documentObject.createElement("div")
    root.dataset.feedbackRoot = ""
    root.setAttribute("role", "status")
    root.setAttribute("aria-live", "polite")
    root.setAttribute("aria-atomic", "true")
    documentObject.body.appendChild(root)
    return root
  }

  function show(message, type = "success", config = {}) {
    const element = ensureRoot()
    clearDismissTimer()
    actionConsumed = false
    element.className = `${className} ${type}`.trim()
    element.dataset.feedbackType = String(type)
    if (config.key) element.dataset.feedbackKey = String(config.key)
    else delete element.dataset.feedbackKey
    element.replaceChildren()

    const copy = documentObject.createElement("span")
    copy.dataset.feedbackCopy = ""
    copy.textContent = String(message ?? "")
    element.appendChild(copy)

    if (config.actionLabel && callable(config.onAction)) {
      const action = documentObject.createElement("button")
      action.type = "button"
      action.dataset.feedbackAction = ""
      action.textContent = String(config.actionLabel)
      action.addEventListener("click", () => {
        if (actionConsumed) return
        actionConsumed = true
        try {
          config.onAction()
        } finally {
          dismiss()
        }
      })
      element.appendChild(action)
    }

    const duration = Number.isFinite(config.duration)
      ? Math.max(0, config.duration)
      : defaultDuration
    if (duration > 0) timer = setTimer(dismiss, duration)
    return element
  }

  return {
    show,
    dismiss,
    get element() {
      return root?.isConnected ? root : null
    },
  }
}

export function runButtonAction(button, action, options = {}) {
  if (!button || !callable(action)) throw new TypeError("button action requires a control and callback")
  if (pendingButtons.has(button)) return Promise.resolve(undefined)

  const previous = {
    disabled:Boolean(button.disabled),
    text:button.textContent,
  }
  button.disabled = true
  button.setAttribute("aria-busy", "true")
  if (options.pendingText) button.textContent = String(options.pendingText)

  let outcome
  try {
    outcome = action()
  } catch (error) {
    outcome = Promise.reject(error)
  }
  const task = Promise.resolve(outcome)
    .finally(() => {
      if (pendingButtons.get(button) !== task) return
      pendingButtons.delete(button)
      button.disabled = previous.disabled
      button.removeAttribute("aria-busy")
      button.textContent = previous.text
    })
  pendingButtons.set(button, task)
  return task
}
