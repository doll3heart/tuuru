function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`)
}

function assertIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function disposedError() {
  return new Error("The article body input has been disposed")
}

function isThenable(value) {
  return value !== null
    && (typeof value === "object" || typeof value === "function")
    && typeof value.then === "function"
}

export function createArticleBodyInput(options) {
  assertRecord(options, "options")
  assertIdentifier(options.nodeId, "nodeId")
  assertFunction(options.readValue, "readValue")
  assertFunction(options.stageValue, "stageValue")

  let disposed = false
  let composing = false
  let frozen = false
  let freezeRequested = false
  let freezeDeferred = null
  let latestCandidate
  let hasCandidate = false
  let unresolved = false
  let needsRead = false

  function captureCandidate() {
    unresolved = true
    needsRead = true
    const candidate = options.readValue()
    latestCandidate = candidate
    hasCandidate = true
    needsRead = false
    return candidate
  }

  function stageCandidate() {
    try {
      const result = options.stageValue(options.nodeId, latestCandidate)
      if (isThenable(result)) {
        throw new TypeError("stageValue must be a synchronous admission boundary")
      }
      unresolved = false
      return true
    } catch (error) {
      unresolved = true
      throw error
    }
  }

  function input() {
    if (disposed || frozen || (freezeRequested && !composing)) return false
    captureCandidate()
    if (composing) return true
    return stageCandidate()
  }

  function compositionStart() {
    if (disposed || frozen || freezeRequested || composing) return false
    composing = true
    unresolved = true
    return true
  }

  function rejectFreeze(error) {
    if (freezeDeferred === null) return
    const deferred = freezeDeferred
    freezeDeferred = null
    freezeRequested = false
    deferred.reject(error)
  }

  function resolveFreeze() {
    freezeRequested = false
    frozen = true
    freezeDeferred?.resolve()
  }

  function compositionEnd() {
    if (disposed || !composing) return false
    composing = false
    try {
      captureCandidate()
      stageCandidate()
      if (freezeRequested) resolveFreeze()
      return true
    } catch (error) {
      if (freezeRequested) rejectFreeze(error)
      throw error
    }
  }

  function isComposing() {
    return composing
  }

  function hasUnresolvedInput() {
    return composing || unresolved
  }

  function freeze() {
    if (disposed) return Promise.reject(disposedError())
    if (freezeDeferred !== null) return freezeDeferred.promise
    if (frozen) return Promise.resolve()

    const deferred = createDeferred()
    freezeDeferred = deferred
    freezeRequested = true
    if (composing) return deferred.promise

    try {
      if (unresolved) {
        if (needsRead || !hasCandidate) captureCandidate()
        stageCandidate()
      }
      resolveFreeze()
    } catch (error) {
      rejectFreeze(error)
    }
    return deferred.promise
  }

  function dispose() {
    if (disposed) return false
    disposed = true
    composing = false
    frozen = false
    if (freezeRequested) rejectFreeze(disposedError())
    return true
  }

  return Object.freeze({
    input,
    compositionStart,
    compositionEnd,
    isComposing,
    hasUnresolvedInput,
    freeze,
    dispose,
  })
}
