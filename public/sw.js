const CACHE_PREFIX = "tuuru-web-"
const CACHE_NAME = `${CACHE_PREFIX}v1`
const APP_SHELL = [
  "/",
  "/reader/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
]

self.addEventListener("install", event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
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

self.addEventListener("fetch", event => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(cachedAsset(request))
})
