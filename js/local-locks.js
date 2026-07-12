export const LIBRARY_SESSION_LOCK_NAME = "tuuru:library-session"
export const DATABASE_WRITE_LOCK_NAME = "tuuru:database-write"

export function getWorkLockName(workId) {
  return `tuuru:work:${encodeURIComponent(String(workId))}`
}

export class LocalLockUnavailableError extends Error {
  constructor(message, code = "mutation-lock-unavailable", cause) {
    super(message)
    this.name = "LocalLockUnavailableError"
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}

function invalidOptions(message) {
  const error = new TypeError(message)
  error.code = "mutation-lock-invalid-options"
  return error
}

function normalizeOptions(options) {
  if (options !== undefined && options !== null && typeof options !== "object") {
    throw invalidOptions("lock options must be an object")
  }

  const source = options ?? {}
  const mode = source.mode ?? "exclusive"
  const ifAvailable = Boolean(source.ifAvailable)
  const steal = Boolean(source.steal)
  const signal = source.signal

  if (ifAvailable && steal) {
    throw invalidOptions("ifAvailable and steal cannot be combined")
  }
  if (steal && mode !== "exclusive") {
    throw invalidOptions("steal requires exclusive mode")
  }
  if (signal !== undefined && (ifAvailable || steal)) {
    throw invalidOptions("signal cannot be combined with ifAvailable or steal")
  }
  if (mode !== "exclusive" && mode !== "shared") {
    throw invalidOptions('mode must be "exclusive" or "shared"')
  }

  const normalized = { ...source, mode }
  if (source.ifAvailable !== undefined) normalized.ifAvailable = ifAvailable
  if (source.steal !== undefined) normalized.steal = steal
  return normalized
}

function isAbortError(error) {
  return error?.name === "AbortError"
}

function unavailableError(name, cause) {
  return new LocalLockUnavailableError(
    `Unable to acquire local lock "${name}"`,
    "mutation-lock-unavailable",
    cause,
  )
}

function pendingAbortError(name, cause) {
  return new LocalLockUnavailableError(
    `Local lock request "${name}" was aborted before acquisition`,
    "mutation-lock-aborted",
    cause,
  )
}

function heldTermination(name, cause) {
  if (isAbortError(cause)) {
    return {
      reason: "stolen",
      error: new LocalLockUnavailableError(
        `Local lock "${name}" was stolen`,
        "mutation-lock-stolen",
        cause,
      ),
    }
  }
  return {
    reason: "aborted",
    error: new LocalLockUnavailableError(
      `Local lock "${name}" ended unexpectedly`,
      "mutation-lock-aborted",
      cause,
    ),
  }
}

function normalizeRequestArguments(options, callback) {
  if (typeof options === "function" && callback === undefined) {
    return { options: {}, callback: options }
  }
  return { options, callback }
}

export function createWebLocksAdapter({
  locks = globalThis.navigator?.locks,
  isSecureContext = globalThis.isSecureContext,
} = {}) {
  const available = isSecureContext === true && typeof locks?.request === "function"

  function ensureAvailable() {
    if (available) return
    throw new LocalLockUnavailableError("Web Locks are unavailable in this context")
  }

  function request(name, options, callback) {
    const args = normalizeRequestArguments(options, callback)
    let stringName
    let normalizedOptions

    try {
      ensureAvailable()
      stringName = String(name)
      normalizedOptions = normalizeOptions(args.options)
      if (typeof args.callback !== "function") {
        throw invalidOptions("lock callback must be a function")
      }
    } catch (error) {
      return Promise.reject(error)
    }

    let callbackStarted = false
    let nativeRequest
    try {
      nativeRequest = locks.request.call(
        locks,
        stringName,
        normalizedOptions,
        lock => {
          callbackStarted = true
          return args.callback(lock)
        },
      )
    } catch (cause) {
      return Promise.reject(unavailableError(stringName, cause))
    }

    return Promise.resolve(nativeRequest).catch(cause => {
      if (callbackStarted) throw cause
      if (isAbortError(cause)) throw pendingAbortError(stringName, cause)
      throw unavailableError(stringName, cause)
    })
  }

  function hold(name, options) {
    let stringName
    let normalizedOptions
    try {
      ensureAvailable()
      stringName = String(name)
      normalizedOptions = normalizeOptions(options)
    } catch (error) {
      return Promise.reject(error)
    }

    return new Promise((resolveAcquisition, rejectAcquisition) => {
      let acquired = false
      let acquisitionSettled = false
      let lostSettled = false
      let releasedSettled = false
      let resolveReleaseGate
      let resolveLost
      let resolveReleased

      const releaseGate = new Promise(resolve => {
        resolveReleaseGate = resolve
      })
      const lost = new Promise(resolve => {
        resolveLost = resolve
      })
      const released = new Promise(resolve => {
        resolveReleased = resolve
      })

      function markLost(reason, error) {
        if (lostSettled) return false
        lostSettled = true
        resolveLost({ reason, error })
        return true
      }

      function finishReleased() {
        if (releasedSettled) return
        releasedSettled = true
        resolveReleased()
      }

      function rejectPending(cause) {
        if (acquisitionSettled) return
        acquisitionSettled = true
        rejectAcquisition(
          isAbortError(cause)
            ? pendingAbortError(stringName, cause)
            : unavailableError(stringName, cause),
        )
      }

      function nativeCallback(lock) {
        if (lock === null) {
          acquisitionSettled = true
          resolveAcquisition(null)
          return null
        }

        acquired = true
        const release = () => {
          if (!markLost("released", null)) return
          resolveReleaseGate()
        }
        const handle = Object.freeze({
          name: lock.name,
          mode: lock.mode,
          isLost: () => lostSettled,
          lost,
          released,
          release,
        })
        acquisitionSettled = true
        resolveAcquisition(handle)
        return releaseGate
      }

      let nativeRequest
      try {
        nativeRequest = locks.request.call(
          locks,
          stringName,
          normalizedOptions,
          nativeCallback,
        )
      } catch (cause) {
        rejectPending(cause)
        return
      }

      Promise.resolve(nativeRequest).then(
        () => {
          if (!acquired) return
          markLost("released", null)
          resolveReleaseGate()
          finishReleased()
        },
        cause => {
          if (!acquired) {
            rejectPending(cause)
            return
          }

          if (!lostSettled) {
            const termination = heldTermination(stringName, cause)
            markLost(termination.reason, termination.error)
          }
          resolveReleaseGate()
          finishReleased()
        },
      )
    })
  }

  return Object.freeze({ available, request, hold })
}
