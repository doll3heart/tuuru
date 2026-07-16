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
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

export function createFormDraftRegistry(options) {
  assertRecord(options, "options")
  assertFunction(options.choose, "choose")

  const registrations = new Map()
  let disposed = false
  let confirmation = null
  let callbackDepth = 0

  function isLive(entry) {
    return registrations.get(entry.id) === entry
  }

  function invoke(callback) {
    callbackDepth += 1
    try {
      return callback()
    } finally {
      callbackDepth -= 1
    }
  }

  function inspect(entries = registrations.values()) {
    const dirty = []
    for (const entry of entries) {
      if (!isLive(entry)) continue
      let result
      try {
        result = invoke(entry.isDirty)
      } catch (error) {
        return { dirty, failure: { entry, error } }
      }
      if (typeof result !== "boolean") {
        return {
          dirty,
          failure: {
            entry,
            error: new TypeError(`isDirty for form draft "${entry.id}" must return a boolean`),
          },
        }
      }
      if (result) dirty.push(entry)
    }
    return { dirty, failure: null }
  }

  function focus(entry) {
    if (!entry || !isLive(entry)) return
    try {
      invoke(entry.focus)
    } catch {
      // Focus remains best effort while the guard still fails closed.
    }
  }

  function focusBlocked(result, preferred = null) {
    if (preferred && isLive(preferred)) {
      const preferredState = inspect([preferred])
      if (preferredState.failure !== null || preferredState.dirty.length > 0) {
        focus(preferred)
        return
      }
    }
    const current = inspectCurrent()
    focus(current.failure?.entry ?? current.dirty[0] ?? result?.failure?.entry ?? result?.dirty?.[0])
  }

  function inspectCurrent() {
    if (disposed) return { dirty: [], failure: null }
    return inspect()
  }

  function isClean(result) {
    return result.failure === null && result.dirty.length === 0
  }

  function hasDirtyDrafts() {
    return !isClean(inspectCurrent())
  }

  function register(registration) {
    if (disposed) throw new Error("The form draft registry has been disposed")
    assertRecord(registration, "registration")
    assertIdentifier(registration.id, "registration.id")
    for (const callback of ["isDirty", "validate", "save", "discard", "focus"]) {
      assertFunction(registration[callback], `registration.${callback}`)
    }
    if (registrations.has(registration.id)) {
      throw new Error(`A form draft with id "${registration.id}" is already registered`)
    }

    const entry = Object.freeze({
      id: registration.id,
      isDirty: registration.isDirty,
      validate: registration.validate,
      save: registration.save,
      discard: registration.discard,
      focus: registration.focus,
    })
    registrations.set(entry.id, entry)
    let registered = true

    return function unregister() {
      if (!registered) return false
      registered = false
      if (!isLive(entry)) return false
      registrations.delete(entry.id)
      return true
    }
  }

  function discardAll() {
    if (disposed) return true
    const inspected = inspectCurrent()
    if (inspected.failure !== null) {
      focusBlocked(inspected)
      return false
    }
    for (const entry of inspected.dirty) {
      if (!isLive(entry)) continue
      const current = inspect([entry])
      if (current.failure !== null) {
        focusBlocked(current)
        return false
      }
      if (current.dirty.length === 0) continue
      try {
        invoke(entry.discard)
      } catch {
        focusBlocked(null, entry)
        return false
      }
    }
    const finalState = inspectCurrent()
    if (!isClean(finalState)) focusBlocked(finalState)
    return isClean(finalState)
  }

  async function invokeGuardCallback(entry, callback) {
    const result = invoke(callback)
    if (confirmation !== null && result === confirmation.promise) {
      return false
    }
    return result
  }

  async function finishFromCurrentState() {
    const finalState = inspectCurrent()
    if (!isClean(finalState)) focusBlocked(finalState)
    return isClean(finalState)
  }

  async function performConfirmation(snapshot) {
    let choice
    try {
      choice = await invokeGuardCallback(null, options.choose)
    } catch {
      focusBlocked(inspectCurrent())
      return false
    }

    if (disposed) return true
    if (choice === "continue-editing") {
      focusBlocked(inspectCurrent())
      return false
    }
    if (choice !== "save" && choice !== "discard") {
      focusBlocked(inspectCurrent())
      return false
    }

    const actionable = inspect(snapshot)
    if (actionable.failure !== null) {
      focusBlocked(actionable)
      return false
    }

    if (choice === "discard") {
      for (const entry of actionable.dirty) {
        if (!isLive(entry)) continue
        const current = inspect([entry])
        if (current.failure !== null) {
          focusBlocked(current)
          return false
        }
        if (current.dirty.length === 0) continue
        try {
          await invokeGuardCallback(entry, entry.discard)
        } catch {
          focusBlocked(null, entry)
          return false
        }
        if (disposed) return true
      }
      return finishFromCurrentState()
    }

    for (const entry of actionable.dirty) {
      if (!isLive(entry)) continue
      const current = inspect([entry])
      if (current.failure !== null) {
        focusBlocked(current)
        return false
      }
      if (current.dirty.length === 0) continue
      let valid
      try {
        valid = await invokeGuardCallback(entry, entry.validate)
      } catch {
        focusBlocked(null, entry)
        return false
      }
      if (disposed) return true
      if (!isLive(entry)) continue
      if (valid !== true) {
        focusBlocked(null, entry)
        return false
      }
    }

    const readyToSave = inspect(snapshot)
    if (readyToSave.failure !== null) {
      focusBlocked(readyToSave)
      return false
    }
    for (const entry of readyToSave.dirty) {
      if (!isLive(entry)) continue
      const current = inspect([entry])
      if (current.failure !== null) {
        focusBlocked(current)
        return false
      }
      if (current.dirty.length === 0) continue
      let result
      try {
        result = await invokeGuardCallback(entry, entry.save)
      } catch {
        focusBlocked(null, entry)
        return false
      }
      if (result === false) {
        focusBlocked(null, entry)
        return false
      }
      if (disposed) return true
    }
    return finishFromCurrentState()
  }

  function confirmNavigation() {
    if (callbackDepth > 0) return Promise.resolve(false)
    if (confirmation !== null) return confirmation.promise
    if (disposed) return Promise.resolve(true)

    const initialState = inspectCurrent()
    if (initialState.failure !== null) {
      focusBlocked(initialState)
      return Promise.resolve(false)
    }
    if (initialState.dirty.length === 0) return Promise.resolve(true)

    const deferred = createDeferred()
    confirmation = deferred
    void performConfirmation([...initialState.dirty]).then(
      deferred.resolve,
      () => deferred.resolve(false),
    )
    void deferred.promise.finally(() => {
      if (confirmation === deferred) confirmation = null
    })
    return deferred.promise
  }

  function dispose() {
    if (disposed) return false
    disposed = true
    registrations.clear()
    confirmation?.resolve(true)
    return true
  }

  return Object.freeze({
    register,
    confirmNavigation,
    hasDirtyDrafts,
    discardAll,
    dispose,
  })
}
