const CACHE_PREFIX = "tuuru-web-"
const BUILD_CACHE_VERSION = /* tuuru-build-version */ "dev"
const CACHE_NAME = `${CACHE_PREFIX}v5-${BUILD_CACHE_VERSION}`
const BUILD_ASSETS = /* tuuru-build-assets */ []
const APP_SHELL = [
  "/",
  "/reader/",
  "/manifest.webmanifest",
  "/icons/tuuru-rabbit-v2-192.png",
  "/icons/tuuru-rabbit-v2-512.png",
  "/icons/tuuru-rabbit-v2-maskable-512.png",
  ...BUILD_ASSETS,
]

self.addEventListener("install", event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
})

function planCacheActivation(names) {
  const previousCacheNames = names
    .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
  const retainedCacheNames = new Set(previousCacheNames.slice(-2))
  retainedCacheNames.add(CACHE_NAME)
  return {
    firstInstall: previousCacheNames.length === 0,
    staleCacheNames: names.filter(name => (
      name.startsWith(CACHE_PREFIX) && !retainedCacheNames.has(name)
    )),
  }
}

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => {
        const activation = planCacheActivation(names)
        return Promise.all(
          activation.staleCacheNames.map(name => caches.delete(name)),
        ).then(() => (
          activation.firstInstall ? self.clients.claim() : undefined
        ))
      }),
  )
})

async function remember(cache, request, response) {
  if (response?.ok && response.type === "basic") {
    await cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    return await remember(cache, request, await fetch(request))
  } catch {
    return (
      await cache.match(request, { ignoreSearch: true }) ||
      await cache.match("/") ||
      new Response("Tuuru 暂时无法离线打开此页面。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    )
  }
}

async function cachedAsset(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    return await remember(cache, request, await fetch(request))
  } catch {
    return new Response("", { status: 504, statusText: "Offline" })
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    return await remember(cache, request, await fetch(request))
  } catch {
    return (
      await cache.match(request, { ignoreSearch: true }) ||
      new Response("", { status: 504, statusText: "Offline" })
    )
  }
}

self.addEventListener("fetch", event => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
    return
  }

  if (request.destination === "style" || request.destination === "script") {
    event.respondWith(
      url.pathname.startsWith("/assets/")
        ? cachedAsset(request)
        : networkFirstAsset(request),
    )
    return
  }

  event.respondWith(cachedAsset(request))
})
