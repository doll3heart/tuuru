import test from "node:test"
import assert from "node:assert/strict"

import {
  getParams,
  initRouter,
  navigate,
  registerNavigationGuard,
  registerRouteCleanup,
  router,
} from "../js/router.js"

let routeSequence = 0

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function nextRoute(label) {
  routeSequence += 1
  return `/router-lifecycle/${routeSequence}/${label}`
}

function flushTasks() {
  return new Promise(resolve => setImmediate(resolve))
}

function createBrowser(initialHash) {
  let hash = initialHash
  let nextHashReadError = null
  const hashAssignments = []
  const replacements = []
  const listeners = new Map()

  const locationObject = {
    get hash() {
      if (nextHashReadError) {
        const error = nextHashReadError
        nextHashReadError = null
        throw error
      }
      return hash
    },
    set hash(value) {
      hash = String(value)
      hashAssignments.push(hash)
    },
  }

  const historyObject = {
    replaceState(state, title, url) {
      replacements.push([state, title, url])
      const value = String(url)
      const hashStart = value.indexOf("#")
      hash = hashStart >= 0 ? value.slice(hashStart) : ""
    },
  }

  const windowObject = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    dispatchHashChange(nextHash = hash, event = {}) {
      hash = String(nextHash)
      for (const listener of [...(listeners.get("hashchange") ?? [])]) {
        listener({ type: "hashchange", ...event })
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0
    },
  }

  return {
    hashAssignments,
    historyObject,
    locationObject,
    replacements,
    throwOnNextHashRead(error) {
      nextHashReadError = error
    },
    windowObject,
  }
}

function createContainer(initialHtml = "") {
  let html = initialHtml
  const writes = []
  return {
    get innerHTML() {
      return html
    },
    set innerHTML(value) {
      html = String(value)
      writes.push(html)
    },
    writes,
  }
}

async function mountAt(path, render, query = {}) {
  router(path, render)
  const queryString = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
  const acceptedHash = `#${path}${queryString ? `?${queryString}` : ""}`
  const browser = createBrowser(acceptedHash)
  const container = createContainer("before-init")
  const dispose = initRouter(container, {
    historyObject: browser.historyObject,
    locationObject: browser.locationObject,
    windowObject: browser.windowObject,
  })
  await flushTasks()
  return { acceptedHash, browser, container, dispose }
}

test("navigate returns Promise<boolean> and commits route params only after a successful render", async () => {
  const start = nextRoute("basic-start")
  const target = nextRoute("basic-target")
  const renderObservations = []
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  }, { retained: "yes" })

  router(target, (container, pathParams, queryParams) => {
    renderObservations.push({
      acceptedParamsDuringRender: { ...getParams() },
      liveHashDuringRender: mounted.browser.locationObject.hash,
      pathParams,
      queryParams,
    })
    container.innerHTML = "target"
  })

  try {
    const result = navigate(target, { q: "a b" })
    assert.ok(result instanceof Promise)
    assert.equal(await result, true)
    assert.equal(mounted.container.innerHTML, "target")
    assert.equal(mounted.browser.locationObject.hash, `#${target}?q=a%20b`)
    assert.deepEqual(getParams(), { q: "a b" })
    assert.deepEqual(renderObservations, [{
      acceptedParamsDuringRender: { q: "a b" },
      liveHashDuringRender: `#${target}?q=a%20b`,
      pathParams: {},
      queryParams: { q: "a b" },
    }])

    assert.equal(await navigate(target, { q: "a b" }), true)
    assert.equal(renderObservations.length, 1)
  } finally {
    await mounted.dispose()
  }
})

test("a rejected native hash keeps DOM, params, focus, and cleanup while restoring the exact accepted hash once", async () => {
  const start = nextRoute("veto-start")
  const target = nextRoute("veto-target")
  const activeElement = { id: "still-focused" }
  let cleanupCalls = 0
  let guardCalls = 0
  let targetRenders = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "accepted-dom"
    registerNavigationGuard(async () => {
      guardCalls += 1
      return false
    })
    registerRouteCleanup(() => {
      cleanupCalls += 1
    })
  }, { keep: "old" })
  router(target, () => {
    targetRenders += 1
  })

  try {
    mounted.browser.windowObject.activeElement = activeElement
    mounted.browser.windowObject.dispatchHashChange(`#${target}?drop=new`)
    await flushTasks()

    assert.equal(mounted.container.innerHTML, "accepted-dom")
    assert.deepEqual(getParams(), { keep: "old" })
    assert.equal(mounted.browser.windowObject.activeElement, activeElement)
    assert.equal(cleanupCalls, 0)
    assert.equal(targetRenders, 0)
    assert.equal(guardCalls, 1)
    assert.deepEqual(mounted.browser.replacements, [[null, "", mounted.acceptedHash]])
    assert.equal(mounted.browser.locationObject.hash, mounted.acceptedHash)

    mounted.browser.windowObject.dispatchHashChange(mounted.acceptedHash)
    await flushTasks()
    assert.equal(guardCalls, 1)
  } finally {
    await mounted.dispose()
  }
  assert.equal(cleanupCalls, 1)
})

test("one pending departure guard coalesces three targets and only the latest Promise succeeds", async () => {
  const start = nextRoute("latest-start")
  const first = nextRoute("latest-first")
  const second = nextRoute("latest-second")
  const third = nextRoute("latest-third")
  const guardGate = createDeferred()
  const guardEntered = createDeferred()
  const events = []
  let guardCalls = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
    registerNavigationGuard(() => {
      guardCalls += 1
      guardEntered.resolve()
      return guardGate.promise
    })
    registerRouteCleanup(() => events.push("cleanup"))
  })
  for (const [path, label] of [[first, "first"], [second, "second"], [third, "third"]]) {
    router(path, container => {
      events.push(`render:${label}`)
      container.innerHTML = label
    })
  }

  try {
    const firstResult = navigate(first)
    await guardEntered.promise
    const secondResult = navigate(second)
    const thirdResult = navigate(third)

    assert.equal(await firstResult, false)
    assert.equal(await secondResult, false)
    assert.equal(mounted.container.innerHTML, "start")
    assert.equal(guardCalls, 1)

    guardGate.resolve(true)
    assert.equal(await thirdResult, true)
    assert.deepEqual(events, ["cleanup", "render:third"])
    assert.equal(mounted.container.innerHTML, "third")
    assert.equal(mounted.browser.locationObject.hash, `#${third}`)
  } finally {
    await mounted.dispose()
  }
})

test("native URL pollution is restored even when a programmatic latest target receives the veto", async () => {
  const start = nextRoute("mixed-start")
  const nativeTarget = nextRoute("mixed-native")
  const programmaticTarget = nextRoute("mixed-programmatic")
  const guardGate = createDeferred()
  const guardEntered = createDeferred()
  let renders = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "accepted"
    registerNavigationGuard(() => {
      guardEntered.resolve()
      return guardGate.promise
    })
  })
  router(nativeTarget, () => { renders += 1 })
  router(programmaticTarget, () => { renders += 1 })

  try {
    mounted.browser.windowObject.dispatchHashChange(`#${nativeTarget}`)
    await guardEntered.promise
    const result = navigate(programmaticTarget)
    guardGate.resolve(false)

    assert.equal(await result, false)
    assert.equal(renders, 0)
    assert.equal(mounted.container.innerHTML, "accepted")
    assert.equal(mounted.browser.locationObject.hash, mounted.acceptedHash)
    assert.deepEqual(mounted.browser.replacements, [[null, "", mounted.acceptedHash]])
  } finally {
    await mounted.dispose()
  }
})

test("cleanup settles after guard acceptance and before metadata changes, clearing, or rendering", async () => {
  const start = nextRoute("ordering-start")
  const target = nextRoute("ordering-target")
  const events = []
  const cleanupGate = createDeferred()
  const cleanupEntered = createDeferred()
  const mounted = await mountAt(start, container => {
    container.innerHTML = "old"
    registerNavigationGuard(() => {
      events.push(`guard:${getParams().version}`)
      return true
    })
    registerRouteCleanup(async () => {
      events.push(`cleanup-start:${getParams().version}:${container.innerHTML}`)
      cleanupEntered.resolve()
      await cleanupGate.promise
      events.push(`cleanup-end:${getParams().version}:${container.innerHTML}`)
    })
  }, { version: "old" })
  router(target, container => {
    events.push(`render:${getParams().version}:${container.innerHTML}`)
    container.innerHTML = "new"
  })

  try {
    const result = navigate(target, { version: "new" })
    await cleanupEntered.promise
    assert.equal(mounted.container.innerHTML, "old")
    assert.deepEqual(getParams(), { version: "old" })

    cleanupGate.resolve()
    assert.equal(await result, true)
    assert.deepEqual(events, [
      "guard:old",
      "cleanup-start:old:old",
      "cleanup-end:old:old",
      "render:new:",
    ])
  } finally {
    await mounted.dispose()
  }
})

test("async render is awaited and failure drains its partial lifecycle before a later route becomes active", async () => {
  const start = nextRoute("render-start")
  const broken = nextRoute("render-broken")
  const recovered = nextRoute("render-recovered")
  const renderGate = createDeferred()
  const renderEntered = createDeferred()
  const expectedError = new Error("route render failed")
  let oldCleanupCalls = 0
  let brokenCleanupCalls = 0
  let recoveredCleanupCalls = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "old"
    registerRouteCleanup(() => { oldCleanupCalls += 1 })
  }, { route: "old" })
  router(broken, async container => {
    container.innerHTML = "partial"
    registerRouteCleanup(() => { brokenCleanupCalls += 1 })
    renderEntered.resolve()
    await renderGate.promise
    throw expectedError
  })
  router(recovered, container => {
    registerRouteCleanup(() => { recoveredCleanupCalls += 1 })
    container.innerHTML = "recovered"
  })

  try {
    let settled = false
    const brokenResult = navigate(broken, { route: "broken" }).finally(() => {
      settled = true
    })
    await renderEntered.promise
    assert.equal(settled, false)
    assert.deepEqual(getParams(), { route: "broken" })
    assert.equal(oldCleanupCalls, 1)

    renderGate.resolve()
    await assert.rejects(brokenResult, expectedError)
    assert.equal(brokenCleanupCalls, 1)
    assert.deepEqual(getParams(), { route: "old" })
    assert.equal(mounted.browser.locationObject.hash, mounted.acceptedHash)

    assert.equal(await navigate(recovered, { route: "recovered" }), true)
    assert.equal(mounted.container.innerHTML, "recovered")
    assert.deepEqual(getParams(), { route: "recovered" })
  } finally {
    await mounted.dispose()
  }
  assert.equal(oldCleanupCalls, 1)
  assert.equal(brokenCleanupCalls, 1)
  assert.equal(recoveredCleanupCalls, 1)
})

test("the disposer removes its listener and de-duplicates cleanup identity across repeated disposal", async () => {
  const start = nextRoute("dispose-start")
  const ignored = nextRoute("dispose-ignored")
  let cleanupCalls = 0
  let ignoredRenders = 0
  const cleanup = () => { cleanupCalls += 1 }
  const mounted = await mountAt(start, container => {
    container.innerHTML = "active"
    registerRouteCleanup(cleanup)
    registerRouteCleanup(cleanup)
  })
  router(ignored, () => { ignoredRenders += 1 })

  assert.equal(mounted.browser.windowObject.listenerCount("hashchange"), 1)
  const firstDisposal = mounted.dispose()
  const secondDisposal = mounted.dispose()
  await Promise.all([firstDisposal, secondDisposal])

  assert.equal(cleanupCalls, 1)
  assert.equal(mounted.browser.windowObject.listenerCount("hashchange"), 0)
  mounted.browser.windowObject.dispatchHashChange(`#${ignored}`)
  await flushTasks()
  assert.equal(ignoredRenders, 0)
})

test("each guard registration keeps its own ordered call even when callback identity repeats", async () => {
  const start = nextRoute("duplicate-guard-start")
  const target = nextRoute("duplicate-guard-target")
  let guardCalls = 0
  const guard = () => {
    guardCalls += 1
    return true
  }
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
    registerNavigationGuard(guard)
    registerNavigationGuard(guard)
  })
  router(target, container => { container.innerHTML = "target" })

  try {
    assert.equal(await navigate(target), true)
    assert.equal(guardCalls, 2)
  } finally {
    await mounted.dispose()
  }
})

test("disposal waits for the failed renderer's already-running async cleanup", async () => {
  const start = nextRoute("dispose-failed-render-start")
  const broken = nextRoute("dispose-failed-render-broken")
  const cleanupEntered = createDeferred()
  const cleanupGate = createDeferred()
  let cleanupCalls = 0
  let cleanupFinished = false
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  })
  router(broken, () => {
    registerRouteCleanup(async () => {
      cleanupCalls += 1
      cleanupEntered.resolve()
      await cleanupGate.promise
      cleanupFinished = true
    })
    throw new Error("broken renderer")
  })

  const navigationResult = navigate(broken)
  await cleanupEntered.promise
  let disposerSettled = false
  const disposal = mounted.dispose().then(() => {
    disposerSettled = true
  })
  await flushTasks()

  assert.equal(disposerSettled, false)
  assert.equal(cleanupFinished, false)
  cleanupGate.resolve()
  assert.equal(await navigationResult, false)
  await disposal
  assert.equal(cleanupCalls, 1)
  assert.equal(cleanupFinished, true)
})

test("a delayed internal hashchange cannot replace the next target while its guard is pending", async () => {
  const start = nextRoute("delayed-start")
  const committed = nextRoute("delayed-committed")
  const latest = nextRoute("delayed-latest")
  const guardGate = createDeferred()
  const guardEntered = createDeferred()
  const renders = []
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  })
  router(committed, container => {
    renders.push("committed")
    container.innerHTML = "committed"
    registerNavigationGuard(() => {
      guardEntered.resolve()
      return guardGate.promise
    })
  })
  router(latest, container => {
    renders.push("latest")
    container.innerHTML = "latest"
  })

  try {
    assert.equal(await navigate(committed), true)
    assert.equal(mounted.browser.locationObject.hash, `#${committed}`)

    const latestResult = navigate(latest)
    await guardEntered.promise
    mounted.browser.windowObject.dispatchHashChange(`#${committed}`, {
      newURL: `https://example.test/#${committed}`,
    })
    await flushTasks()
    guardGate.resolve(true)

    assert.equal(await latestResult, true)
    assert.deepEqual(renders, ["committed", "latest"])
    assert.equal(mounted.browser.locationObject.hash, `#${latest}`)
  } finally {
    await mounted.dispose()
  }
})

test("a real hash return to the accepted URL cancels a native target whose guard is still pending", async () => {
  const start = nextRoute("native-cancel-start")
  const abandoned = nextRoute("native-cancel-abandoned")
  const guardGate = createDeferred()
  const guardEntered = createDeferred()
  let abandonedRenders = 0
  let cleanupCalls = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "accepted"
    registerNavigationGuard(() => {
      guardEntered.resolve()
      return guardGate.promise
    })
    registerRouteCleanup(() => { cleanupCalls += 1 })
  })
  router(abandoned, () => { abandonedRenders += 1 })

  try {
    mounted.browser.windowObject.dispatchHashChange(`#${abandoned}`)
    await guardEntered.promise
    mounted.browser.windowObject.dispatchHashChange(mounted.acceptedHash)
    guardGate.resolve(true)
    await flushTasks()

    assert.equal(abandonedRenders, 0)
    assert.equal(cleanupCalls, 0)
    assert.equal(mounted.container.innerHTML, "accepted")
    assert.equal(mounted.browser.locationObject.hash, mounted.acceptedHash)
  } finally {
    await mounted.dispose()
  }
  assert.equal(cleanupCalls, 1)
})

test("a native target queued during programmatic rendering finishes with matching DOM and URL", async () => {
  const start = nextRoute("render-native-start")
  const programmatic = nextRoute("render-native-programmatic")
  const nativeTarget = nextRoute("render-native-final")
  const programmaticGate = createDeferred()
  const programmaticEntered = createDeferred()
  const nativeRendered = createDeferred()
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  })
  router(programmatic, async container => {
    container.innerHTML = "programmatic-pending"
    programmaticEntered.resolve()
    await programmaticGate.promise
    container.innerHTML = "programmatic"
  })
  router(nativeTarget, container => {
    container.innerHTML = "native-final"
    nativeRendered.resolve()
  })

  try {
    const programmaticResult = navigate(programmatic)
    await programmaticEntered.promise
    mounted.browser.windowObject.dispatchHashChange(`#${nativeTarget}`)
    programmaticGate.resolve()

    assert.equal(await programmaticResult, true)
    await nativeRendered.promise
    await flushTasks()
    assert.equal(mounted.container.innerHTML, "native-final")
    assert.equal(mounted.browser.locationObject.hash, `#${nativeTarget}`)
  } finally {
    await mounted.dispose()
  }
})

test("a delayed native event keeps its observed target after an internal commit changed the live hash", async () => {
  const start = nextRoute("delayed-native-start")
  const programmatic = nextRoute("delayed-native-programmatic")
  const nativeTarget = nextRoute("delayed-native-final")
  const programmaticGate = createDeferred()
  const programmaticEntered = createDeferred()
  const nativeRendered = createDeferred()
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  })
  router(programmatic, async container => {
    programmaticEntered.resolve()
    await programmaticGate.promise
    container.innerHTML = "programmatic"
  })
  router(nativeTarget, container => {
    container.innerHTML = "native-observed"
    nativeRendered.resolve()
  })

  try {
    const programmaticResult = navigate(programmatic)
    await programmaticEntered.promise
    mounted.browser.locationObject.hash = `#${nativeTarget}`
    programmaticGate.resolve()
    assert.equal(await programmaticResult, true)
    assert.equal(mounted.browser.locationObject.hash, `#${nativeTarget}`)

    mounted.browser.windowObject.dispatchHashChange(`#${nativeTarget}`, {
      newURL: `https://example.test/#${nativeTarget}`,
    })
    await nativeRendered.promise
    await flushTasks()
    assert.equal(mounted.container.innerHTML, "native-observed")
    assert.equal(mounted.browser.locationObject.hash, `#${nativeTarget}`)
  } finally {
    await mounted.dispose()
  }
})

test("a stale native event corrects its history entry without adding another hash assignment", async () => {
  const start = nextRoute("stale-native-start")
  const committed = nextRoute("stale-native-committed")
  const observed = nextRoute("stale-native-observed")
  const observedRendered = createDeferred()
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  })
  router(committed, container => { container.innerHTML = "committed" })
  router(observed, container => {
    container.innerHTML = "observed"
    observedRendered.resolve()
  })

  try {
    assert.equal(await navigate(committed), true)
    const assignmentsBeforeNative = mounted.browser.hashAssignments.length
    mounted.browser.windowObject.dispatchHashChange(`#${committed}`, {
      newURL: `https://example.test/#${observed}`,
    })
    await observedRendered.promise

    assert.equal(mounted.browser.locationObject.hash, `#${observed}`)
    assert.equal(mounted.browser.hashAssignments.length, assignmentsBeforeNative)
    assert.deepEqual(mounted.browser.replacements, [[null, "", `#${observed}`]])
  } finally {
    await mounted.dispose()
  }
})

test("an injected hash read failure rejects the exact navigation without stranding the pump", async () => {
  const start = nextRoute("hash-read-start")
  const failed = nextRoute("hash-read-failed")
  const recovered = nextRoute("hash-read-recovered")
  const expectedError = new Error("hash getter failed")
  let failedRenders = 0
  const mounted = await mountAt(start, container => {
    container.innerHTML = "start"
  }, { retained: "yes" })
  router(failed, () => { failedRenders += 1 })
  router(recovered, container => { container.innerHTML = "recovered" })

  try {
    mounted.browser.throwOnNextHashRead(expectedError)
    await assert.rejects(navigate(failed), expectedError)
    assert.equal(failedRenders, 0)
    assert.equal(mounted.container.innerHTML, "start")
    assert.deepEqual(getParams(), { retained: "yes" })
    assert.equal(await navigate(recovered), true)
    assert.equal(mounted.container.innerHTML, "recovered")
  } finally {
    await mounted.dispose()
  }
})

test("the baseline hash can render a fresh lifecycle after an exceptional render removed the old one", async () => {
  const start = nextRoute("baseline-recovery-start")
  const broken = nextRoute("baseline-recovery-broken")
  const recoveredRender = createDeferred()
  const expectedError = new Error("broken target")
  let startRenders = 0
  const mounted = await mountAt(start, container => {
    startRenders += 1
    container.innerHTML = `start-${startRenders}`
    if (startRenders === 2) recoveredRender.resolve()
  })
  router(broken, () => { throw expectedError })

  try {
    await assert.rejects(navigate(broken), expectedError)
    assert.equal(mounted.browser.locationObject.hash, mounted.acceptedHash)
    mounted.browser.windowObject.dispatchHashChange(mounted.acceptedHash)
    await recoveredRender.promise

    assert.equal(startRenders, 2)
    assert.equal(mounted.container.innerHTML, "start-2")
  } finally {
    await mounted.dispose()
  }
})

test("a replacement router cannot start while a disposed async renderer is still retiring", async () => {
  const oldStart = nextRoute("retiring-old")
  const newStart = nextRoute("retiring-new")
  const oldRenderEntered = createDeferred()
  const oldRenderGate = createDeferred()
  const oldBrowser = createBrowser(`#${oldStart}`)
  const oldContainer = createContainer()
  router(oldStart, async container => {
    oldRenderEntered.resolve()
    await oldRenderGate.promise
    container.innerHTML = "old-late"
    registerNavigationGuard(() => false)
    registerRouteCleanup(() => {})
  })
  router(newStart, container => { container.innerHTML = "new" })
  const oldDispose = initRouter(oldContainer, {
    historyObject: oldBrowser.historyObject,
    locationObject: oldBrowser.locationObject,
    windowObject: oldBrowser.windowObject,
  })
  await oldRenderEntered.promise
  const oldDisposal = oldDispose()

  const newBrowser = createBrowser(`#${newStart}`)
  const newContainer = createContainer()
  let unexpectedDispose = null
  try {
    assert.throws(() => {
      unexpectedDispose = initRouter(newContainer, {
        historyObject: newBrowser.historyObject,
        locationObject: newBrowser.locationObject,
        windowObject: newBrowser.windowObject,
      })
    }, /still retiring/)
  } finally {
    oldRenderGate.resolve()
    await oldDisposal
    await flushTasks()
    if (unexpectedDispose) await unexpectedDispose()
  }
})
