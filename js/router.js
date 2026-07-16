// ==================== Serialized Hash Router ====================
let routes = {}
let currentRoute = null
let currentParams = {}
let activeRouter = null
let retiringRouters = 0

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseHash(hashValue = location.hash) {
  const hash = (hashValue.startsWith("#") ? hashValue.slice(1) : hashValue) || "/"
  const queryStart = hash.indexOf("?")
  const path = queryStart >= 0 ? hash.slice(0, queryStart) : hash
  const query = queryStart >= 0 ? hash.slice(queryStart + 1) : ""
  const params = {}
  if (query) {
    query.split("&").forEach(part => {
      if (!part) return
      const separator = part.indexOf("=")
      const rawKey = separator >= 0 ? part.slice(0, separator) : part
      const rawValue = separator >= 0 ? part.slice(separator + 1) : ""
      const key = safeDecode(rawKey)
      if (key) params[key] = safeDecode(rawValue)
    })
  }
  return { path: path || "/", params }
}

export function router(path, fn) {
  routes[path] = fn
}

function buildHash(path, params = {}) {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
  return `#${path}${query ? `?${query}` : ""}`
}

export async function navigate(path, params = {}) {
  if (activeRouter) return activeRouter.navigate(path, params)
  return false
}

export function matchRoutePattern(pattern, path) {
  const parts = pattern.split("/")
  const pathParts = path.split("/")
  if (parts.length !== pathParts.length) return null
  const params = {}
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index].startsWith(":")) {
      params[parts[index].slice(1)] = safeDecode(pathParts[index])
    } else if (parts[index] !== pathParts[index]) {
      return null
    }
  }
  return params
}

function matchRoute(path) {
  if (routes[path]) return { route: routes[path], params: {} }
  for (const [pattern, fn] of Object.entries(routes)) {
    const params = matchRoutePattern(pattern, path)
    if (params) return { route: fn, params }
  }
  return null
}

function createLifecycle() {
  return {
    guards: [],
    cleanups: new Map(),
    sealed: false,
    cleanupPromise: null,
  }
}

function registerCleanupCallback(lifecycle, callback) {
  if (!lifecycle || lifecycle.sealed) return () => {}

  const callbacks = lifecycle.cleanups
  callbacks.set(callback, (callbacks.get(callback) ?? 0) + 1)
  let registered = true
  return () => {
    if (!registered) return
    registered = false
    const count = callbacks.get(callback)
    if (count === 1) callbacks.delete(callback)
    else if (count > 1) callbacks.set(callback, count - 1)
  }
}

async function cleanupLifecycle(lifecycle) {
  if (!lifecycle) return
  if (lifecycle.cleanupPromise) return lifecycle.cleanupPromise

  lifecycle.sealed = true
  lifecycle.guards.length = 0
  const cleanups = [...lifecycle.cleanups.keys()]
  lifecycle.cleanups.clear()
  lifecycle.cleanupPromise = (async () => {
    let firstError = null
    for (const cleanup of cleanups) {
      try {
        await cleanup()
      } catch (error) {
        firstError ??= error
      }
    }
    if (firstError) throw firstError
  })()
  return lifecycle.cleanupPromise
}

function createTarget(hash, source) {
  const parsed = parseHash(hash)
  let resolvePromise
  let rejectPromise
  const target = {
    hash,
    path: parsed.path,
    params: parsed.params,
    source,
    settled: false,
    promise: new Promise((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    }),
    resolve(value) {
      if (target.settled) return
      target.settled = true
      resolvePromise(value)
    },
    reject(error) {
      if (target.settled) return
      target.settled = true
      rejectPromise(error)
    },
  }
  return target
}

function reportUnhandledRouterError(error) {
  console.error("Router transition failed", error)
}

function createRouterController(container, { windowObject, locationObject, historyObject }) {
  let phase = "idle"
  let acceptedHash = String(locationObject.hash ?? "")
  let activeLifecycle = null
  let renderingLifecycle = null
  let cleaningLifecycle = null
  let drainingLifecycle = null
  let survivingTarget = null
  let queuedTarget = null
  let frozenTarget = null
  let disposed = false
  let pumpPromise = null
  let disposePromise = null
  const internallyCommittedHashes = []

  function registrationLifecycle() {
    if (disposed) return null
    return renderingLifecycle ?? activeLifecycle
  }

  function registerGuard(guard) {
    if (typeof guard !== "function") throw new TypeError("Navigation guard must be a function")
    const lifecycle = registrationLifecycle()
    if (!lifecycle || lifecycle.sealed) return () => {}
    const registration = { active: true, guard }
    lifecycle.guards.push(registration)
    return () => {
      if (!registration.active) return
      registration.active = false
    }
  }

  function registerCleanup(cleanup) {
    if (typeof cleanup !== "function") throw new TypeError("Route cleanup must be a function")
    return registerCleanupCallback(registrationLifecycle(), cleanup)
  }

  function restoreAcceptedHash() {
    try {
      if (String(locationObject.hash ?? "") === acceptedHash) return null
      historyObject.replaceState(null, "", acceptedHash)
      return null
    } catch (error) {
      return error
    }
  }

  function replaceTarget(slot, target) {
    const previous = slot === "surviving" ? survivingTarget : queuedTarget
    previous?.resolve(false)
    if (slot === "surviving") survivingTarget = target
    else queuedTarget = target
  }

  function startPump() {
    if (pumpPromise || disposed) return
    pumpPromise = pump()
      .catch(reportUnhandledRouterError)
      .finally(() => {
        pumpPromise = null
        if (!disposed && (survivingTarget || queuedTarget)) startPump()
      })
  }

  function enqueue(target) {
    if (disposed) {
      target.resolve(false)
      return target.promise
    }

    if (phase === "idle" && activeLifecycle && target.hash === acceptedHash) {
      target.resolve(true)
      return target.promise
    }

    if (phase === "guarding") {
      replaceTarget("surviving", target)
      return target.promise
    }

    if (phase === "cleaning" || phase === "rendering") {
      replaceTarget("queued", target)
      return target.promise
    }

    survivingTarget = target
    startPump()
    return target.promise
  }

  async function evaluateGuards(lifecycle) {
    const guards = lifecycle ? [...lifecycle.guards] : []
    for (const registration of guards) {
      if (registration.active && await registration.guard() === false) return false
    }
    return true
  }

  function commitTargetHash(target) {
    try {
      if (String(locationObject.hash ?? "") === target.hash) return null
      if (target.source === "native") {
        historyObject.replaceState(null, "", target.hash)
        return null
      }

      internallyCommittedHashes.push(target.hash)
      try {
        locationObject.hash = target.hash
      } catch (error) {
        const markerIndex = internallyCommittedHashes.lastIndexOf(target.hash)
        if (markerIndex >= 0) internallyCommittedHashes.splice(markerIndex, 1)
        throw error
      }
      return null
    } catch (error) {
      return error
    }
  }

  async function rejectGuardedTarget(error = null) {
    const target = survivingTarget
    survivingTarget = null
    const restorationError = restoreAcceptedHash()
    phase = "idle"
    if (!target) return
    if (error) target.reject(error)
    else if (restorationError) target.reject(restorationError)
    else target.resolve(false)
  }

  async function processTransition() {
    phase = "guarding"
    try {
      const guardsAccepted = await evaluateGuards(activeLifecycle)
      if (disposed) {
        survivingTarget?.resolve(false)
        survivingTarget = null
        return
      }
      if (!guardsAccepted) {
        await rejectGuardedTarget()
        return
      }
    } catch (error) {
      if (disposed) {
        survivingTarget?.resolve(false)
        survivingTarget = null
        return
      }
      await rejectGuardedTarget(error)
      return
    }

    const target = survivingTarget
    survivingTarget = null
    if (!target) {
      phase = "idle"
      return
    }

    if (activeLifecycle && target.hash === acceptedHash) {
      const restorationError = restoreAcceptedHash()
      phase = "idle"
      if (restorationError) target.reject(restorationError)
      else target.resolve(true)
      return
    }

    frozenTarget = target
    phase = "cleaning"
    const previousRoute = currentRoute
    const previousParams = currentParams
    cleaningLifecycle = activeLifecycle
    activeLifecycle = null
    try {
      await cleanupLifecycle(cleaningLifecycle)
    } catch (error) {
      cleaningLifecycle = null
      if (disposed) {
        target.resolve(false)
        frozenTarget = null
        return
      }
      const restorationError = restoreAcceptedHash()
      phase = "idle"
      frozenTarget = null
      target.reject(error ?? restorationError)
      return
    }
    cleaningLifecycle = null

    if (disposed) {
      target.resolve(false)
      frozenTarget = null
      return
    }

    const commitError = commitTargetHash(target)
    if (commitError) {
      restoreAcceptedHash()
      phase = "idle"
      frozenTarget = null
      target.reject(commitError)
      return
    }

    phase = "rendering"
    currentRoute = target.path
    currentParams = target.params
    const nextLifecycle = createLifecycle()
    renderingLifecycle = nextLifecycle
    let renderError = null
    try {
      container.innerHTML = ""
      const matched = matchRoute(target.path)
      if (matched) {
        await matched.route(container, matched.params, target.params)
      } else {
        container.innerHTML = `<div class="empty-state"><div class="icon"></div><h3>页面不存在</h3><p>请检查链接是否正确</p></div>`
      }
    } catch (error) {
      renderError = error
    }
    if (renderError) {
      drainingLifecycle = nextLifecycle
      renderingLifecycle = null
      try {
        await cleanupLifecycle(nextLifecycle)
      } catch {
        // The renderer error remains the primary transition failure.
      }
      drainingLifecycle = null
      if (disposed) {
        target.resolve(false)
        frozenTarget = null
        return
      }
      currentRoute = previousRoute
      currentParams = previousParams
      const restorationError = restoreAcceptedHash()
      phase = "idle"
      frozenTarget = null
      target.reject(renderError ?? restorationError)
      return
    }

    renderingLifecycle = null
    if (disposed) {
      drainingLifecycle = nextLifecycle
      try {
        await cleanupLifecycle(nextLifecycle)
      } catch {
        // Disposal owns cleanup error reporting.
      }
      drainingLifecycle = null
      target.resolve(false)
      frozenTarget = null
      return
    }

    activeLifecycle = nextLifecycle
    acceptedHash = target.hash
    phase = "idle"
    frozenTarget = null
    target.resolve(true)
  }

  async function pump() {
    while (!disposed) {
      if (!survivingTarget) {
        if (!queuedTarget) break
        survivingTarget = queuedTarget
        queuedTarget = null
      }

      if (activeLifecycle && survivingTarget.hash === acceptedHash) {
        survivingTarget.resolve(true)
        survivingTarget = null
        phase = "idle"
        continue
      }
      await processTransition()
    }
    if (!disposed) phase = "idle"
  }

  function onHashChange(event) {
    if (disposed) return
    let liveHash
    try {
      liveHash = String(locationObject.hash ?? "")
    } catch (error) {
      reportUnhandledRouterError(error)
      return
    }
    const newUrl = typeof event?.newURL === "string" ? event.newURL : ""
    const hashStart = newUrl.indexOf("#")
    const eventHash = newUrl ? (hashStart >= 0 ? newUrl.slice(hashStart) : "") : liveHash
    const internalIndex = internallyCommittedHashes.indexOf(eventHash)
    if (internalIndex >= 0) {
      internallyCommittedHashes.splice(internalIndex, 1)
      return
    }
    if (phase === "idle" && activeLifecycle && eventHash === acceptedHash) return
    enqueue(createTarget(eventHash, "native")).catch(reportUnhandledRouterError)
  }

  function navigateTo(path, params) {
    return enqueue(createTarget(buildHash(path, params), "programmatic"))
  }

  function start() {
    windowObject.addEventListener("hashchange", onHashChange)
    const initialTarget = createTarget(String(locationObject.hash ?? ""), "initial")
    enqueue(initialTarget).catch(reportUnhandledRouterError)
  }

  function dispose() {
    if (disposePromise) return disposePromise

    disposed = true
    phase = "disposed"
    windowObject.removeEventListener("hashchange", onHashChange)
    if (activeRouter === controller) activeRouter = null

    const restorationError = restoreAcceptedHash()
    survivingTarget?.resolve(false)
    queuedTarget?.resolve(false)
    frozenTarget?.resolve(false)
    survivingTarget = null
    queuedTarget = null
    frozenTarget = null
    internallyCommittedHashes.length = 0

    const lifecycles = [...new Set([
      activeLifecycle,
      cleaningLifecycle,
      renderingLifecycle,
      drainingLifecycle,
    ].filter(Boolean))]
    activeLifecycle = null
    currentRoute = null
    currentParams = {}
    const pumpAtDisposal = pumpPromise
    let cleanupSettled = false
    let pumpSettled = !pumpAtDisposal
    let retirementFinished = false
    retiringRouters += 1

    const finishRetirement = () => {
      if (retirementFinished || !cleanupSettled || !pumpSettled) return
      retirementFinished = true
      retiringRouters -= 1
    }

    if (pumpAtDisposal) {
      pumpAtDisposal.then(
        () => {
          pumpSettled = true
          finishRetirement()
        },
        () => {
          pumpSettled = true
          finishRetirement()
        },
      )
    }

    disposePromise = (async () => {
      try {
        let firstError = restorationError
        for (const lifecycle of lifecycles) {
          try {
            await cleanupLifecycle(lifecycle)
          } catch (error) {
            firstError ??= error
          }
        }
        if (firstError) throw firstError
      } finally {
        cleanupSettled = true
        finishRetirement()
      }
    })()
    return disposePromise
  }

  const controller = {
    dispose,
    navigate: navigateTo,
    registerCleanup,
    registerGuard,
    start,
  }
  return controller
}

export function registerNavigationGuard(guard) {
  if (typeof guard !== "function") throw new TypeError("Navigation guard must be a function")
  return activeRouter?.registerGuard(guard) ?? (() => {})
}

export function registerRouteCleanup(cleanup) {
  if (typeof cleanup !== "function") throw new TypeError("Route cleanup must be a function")
  return activeRouter?.registerCleanup(cleanup) ?? (() => {})
}

export function initRouter(container, dependencies = {}) {
  const windowObject = dependencies.windowObject ?? globalThis.window
  const locationObject = dependencies.locationObject ?? windowObject?.location ?? globalThis.location
  const historyObject = dependencies.historyObject ?? windowObject?.history ?? globalThis.history
  if (!windowObject || !locationObject || !historyObject) {
    throw new Error("Router requires window, location, and history objects")
  }

  if (activeRouter) throw new Error("Router is already initialized")
  if (retiringRouters > 0) throw new Error("The previous router is still retiring")
  const controller = createRouterController(container, {
    historyObject,
    locationObject,
    windowObject,
  })
  activeRouter = controller
  controller.start()
  return controller.dispose
}

export function getParams() {
  return currentParams
}
