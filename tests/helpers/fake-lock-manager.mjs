function createAbortError(message = "The lock request was aborted") {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError")
  }
  const error = new Error(message)
  error.name = "AbortError"
  return error
}

function createNotSupportedError(message) {
  if (typeof DOMException === "function") {
    return new DOMException(message, "NotSupportedError")
  }
  const error = new Error(message)
  error.name = "NotSupportedError"
  return error
}

function normalizeArguments(options, callback) {
  if (typeof options === "function" && callback === undefined) {
    return { options: {}, callback: options }
  }
  return { options: options ?? {}, callback }
}

function validateOptions(options) {
  const mode = options.mode ?? "exclusive"
  const ifAvailable = Boolean(options.ifAvailable)
  const steal = Boolean(options.steal)
  const signal = options.signal

  if (mode !== "exclusive" && mode !== "shared") {
    return new TypeError('mode must be "exclusive" or "shared"')
  }
  if (ifAvailable && steal) {
    return createNotSupportedError("ifAvailable and steal cannot be combined")
  }
  if (steal && mode !== "exclusive") {
    return createNotSupportedError("steal requires exclusive mode")
  }
  if (signal !== undefined && (ifAvailable || steal)) {
    return createNotSupportedError("signal cannot be combined with ifAvailable or steal")
  }
  return null
}

function signalReason(signal) {
  return signal.reason === undefined ? createAbortError() : signal.reason
}

export function createFakeLockManager() {
  const resources = new Map()

  function getResource(name) {
    let resource = resources.get(name)
    if (!resource) {
      resource = { name, held: [], queue: [] }
      resources.set(name, resource)
    }
    return resource
  }

  function removeAbortListener(record) {
    if (!record.signal || !record.abortHandler) return
    record.signal.removeEventListener("abort", record.abortHandler)
    record.abortHandler = null
  }

  function cleanupResource(resource) {
    if (resource.held.length === 0 && resource.queue.length === 0) {
      resources.delete(resource.name)
    }
  }

  function canGrant(resource, mode) {
    if (mode === "exclusive") return resource.held.length === 0
    return resource.held.every(record => record.mode === "shared")
  }

  function removeHeld(record) {
    const index = record.resource.held.indexOf(record)
    if (index !== -1) record.resource.held.splice(index, 1)
  }

  function completeHeld(record, fulfilled, result) {
    if (record.state !== "held") return
    removeHeld(record)
    record.state = "settled"
    processQueue(record.resource)
    if (fulfilled) record.resolve(result)
    else record.reject(result)
    cleanupResource(record.resource)
  }

  function invokeGrantedCallback(record) {
    queueMicrotask(() => {
      if (record.state !== "held" && record.state !== "terminated") return

      let callbackResult
      try {
        callbackResult = record.callback(Object.freeze({
          name: record.name,
          mode: record.mode,
        }))
      } catch (error) {
        completeHeld(record, false, error)
        return
      }

      Promise.resolve(callbackResult).then(
        value => completeHeld(record, true, value),
        error => completeHeld(record, false, error),
      )
    })
  }

  function grant(record) {
    record.state = "held"
    removeAbortListener(record)
    record.resource.held.push(record)
    invokeGrantedCallback(record)
  }

  function processQueue(resource) {
    while (resource.queue.length > 0) {
      const record = resource.queue[0]
      if (!canGrant(resource, record.mode)) return

      resource.queue.shift()
      grant(record)
      if (record.mode === "exclusive") return
    }
  }

  function finishUnavailable(record, fulfilled, result) {
    if (record.state !== "conditional") return
    record.state = "settled"
    if (fulfilled) record.resolve(result)
    else record.reject(result)
    cleanupResource(record.resource)
  }

  function invokeUnavailableCallback(record) {
    record.state = "conditional"
    queueMicrotask(() => {
      if (record.state !== "conditional") return

      let callbackResult
      try {
        callbackResult = record.callback(null)
      } catch (error) {
        finishUnavailable(record, false, error)
        return
      }

      Promise.resolve(callbackResult).then(
        value => finishUnavailable(record, true, value),
        error => finishUnavailable(record, false, error),
      )
    })
  }

  function terminateRecord(record, cause, processAfter = true) {
    if (record.state !== "held") return false
    removeHeld(record)
    removeAbortListener(record)
    record.state = "terminated"
    record.reject(cause)
    if (processAfter) {
      processQueue(record.resource)
      cleanupResource(record.resource)
    }
    return true
  }

  function abortPending(record, cause) {
    if (record.state !== "created" && record.state !== "pending") return

    if (record.state === "pending") {
      const index = record.resource.queue.indexOf(record)
      if (index !== -1) record.resource.queue.splice(index, 1)
    }
    record.state = "aborted"
    removeAbortListener(record)
    record.reject(cause)
    if (record.resource) {
      processQueue(record.resource)
      cleanupResource(record.resource)
    }
  }

  function submit(record) {
    if (record.state !== "created") return
    if (record.signal?.aborted) {
      abortPending(record, signalReason(record.signal))
      return
    }

    const resource = getResource(record.name)
    record.resource = resource

    if (record.steal) {
      const abortError = createAbortError(`Lock "${record.name}" was stolen`)
      for (const heldRecord of [...resource.held]) {
        terminateRecord(heldRecord, abortError, false)
      }
      record.state = "pending"
      resource.queue.unshift(record)
      processQueue(resource)
      return
    }

    if (record.ifAvailable && (
      resource.queue.length > 0 || !canGrant(resource, record.mode)
    )) {
      removeAbortListener(record)
      invokeUnavailableCallback(record)
      return
    }

    record.state = "pending"
    resource.queue.push(record)
    processQueue(resource)
  }

  function request(name, options, callback) {
    const normalized = normalizeArguments(options, callback)
    const stringName = String(name)
    const requestOptions = normalized.options
    const requestCallback = normalized.callback

    if (typeof requestCallback !== "function") {
      return Promise.reject(new TypeError("callback must be a function"))
    }
    if (stringName.startsWith("-")) {
      return Promise.reject(createNotSupportedError("lock names cannot start with a hyphen"))
    }

    const optionError = validateOptions(requestOptions)
    if (optionError) return Promise.reject(optionError)

    const mode = requestOptions.mode ?? "exclusive"
    const ifAvailable = Boolean(requestOptions.ifAvailable)
    const steal = Boolean(requestOptions.steal)
    const signal = requestOptions.signal
    if (signal?.aborted) return Promise.reject(signalReason(signal))

    return new Promise((resolve, reject) => {
      const record = {
        name: stringName,
        mode,
        ifAvailable,
        steal,
        signal,
        callback: requestCallback,
        resolve,
        reject,
        resource: null,
        abortHandler: null,
        state: "created",
      }

      if (signal) {
        record.abortHandler = () => {
          const cause = signalReason(signal)
          queueMicrotask(() => abortPending(record, cause))
        }
        signal.addEventListener("abort", record.abortHandler, { once: true })
      }

      queueMicrotask(() => submit(record))
    })
  }

  function snapshot() {
    const held = []
    const pending = []
    for (const resource of resources.values()) {
      for (const record of resource.held) {
        held.push({ name: record.name, mode: record.mode })
      }
      for (const record of resource.queue) {
        pending.push({ name: record.name, mode: record.mode })
      }
    }
    return { held, pending }
  }

  function terminateHeld(name, cause = new Error("Held lock terminated")) {
    const resource = resources.get(String(name))
    if (!resource) return false

    let terminated = false
    for (const record of [...resource.held]) {
      terminated = terminateRecord(record, cause, false) || terminated
    }
    if (!terminated) return false

    processQueue(resource)
    cleanupResource(resource)
    return true
  }

  return Object.freeze({ request, snapshot, terminateHeld })
}
