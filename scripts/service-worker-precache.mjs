import { readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"

const BUILD_ASSETS_MARKER = "const BUILD_ASSETS = /* tuuru-build-assets */ []"
const BUILD_VERSION_MARKER = 'const BUILD_CACHE_VERSION = /* tuuru-build-version */ "dev"'

export function buildPrecacheAssetList(bundle = {}) {
  return Object.keys(bundle)
    .filter(fileName => /^assets\/.+\.(?:css|js)$/.test(fileName))
    .sort()
    .map(fileName => `/${fileName}`)
}

export function buildPrecacheVersion(assets) {
  return createHash("sha256")
    .update(assets.join("\n"))
    .digest("hex")
    .slice(0, 12)
}

export function injectServiceWorkerPrecache(source, assets, version = buildPrecacheVersion(assets)) {
  return source
    .replace(BUILD_ASSETS_MARKER, `const BUILD_ASSETS = ${JSON.stringify(assets)}`)
    .replace(BUILD_VERSION_MARKER, `const BUILD_CACHE_VERSION = ${JSON.stringify(version)}`)
}

export function tuuruServiceWorkerPrecache() {
  return {
    name: "tuuru-service-worker-precache",
    apply: "build",
    async writeBundle(outputOptions, bundle) {
      if (!outputOptions.dir) return
      const workerPath = path.join(outputOptions.dir, "sw.js")
      const source = await readFile(workerPath, "utf8")
      const assets = buildPrecacheAssetList(bundle)
      const injected = injectServiceWorkerPrecache(
        source,
        assets,
        buildPrecacheVersion(assets),
      )
      if (injected !== source) await writeFile(workerPath, injected, "utf8")
    },
  }
}
