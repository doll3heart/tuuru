import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const serverDir = resolve("dist/server")
const workerPath = resolve(serverDir, "index.js")

const workerSource = `const FALLBACKS = new Map([
  ["/", "/index.html"],
  ["/reader", "/reader/index.html"],
  ["/reader/", "/reader/index.html"],
])

async function fetchAsset(request, env, pathname) {
  const target = new URL(request.url)
  target.pathname = pathname
  return env.ASSETS.fetch(new Request(target, request))
}

export default {
  async fetch(request, env) {
    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Static asset binding is unavailable", { status: 503 })
    }
    const url = new URL(request.url)
    let response = await env.ASSETS.fetch(request)
    const fallback = FALLBACKS.get(url.pathname)
    if (response.status === 404 && fallback) {
      response = await fetchAsset(request, env, fallback)
    }
    return response
  },
}
`

await mkdir(serverDir, { recursive:true })
await writeFile(workerPath, workerSource, "utf8")
