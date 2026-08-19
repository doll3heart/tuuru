import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  buildPrecacheAssetList,
  buildPrecacheVersion,
  injectServiceWorkerPrecache,
  tuuruServiceWorkerPrecache,
} from "../scripts/service-worker-precache.mjs"

test("the production worker precaches every emitted hashed script and stylesheet", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  const bundle = {
    "assets/reader-def.js": { type:"chunk" },
    "assets/main-abc.js": { type:"chunk" },
    "assets/main-abc.css": { type:"asset" },
    "icons/tuuru.png": { type:"asset" },
    "index.html": { type:"asset" },
  }

  const assets = buildPrecacheAssetList(bundle)
  assert.deepEqual(assets, [
    "/assets/main-abc.css",
    "/assets/main-abc.js",
    "/assets/reader-def.js",
  ])
  const version = buildPrecacheVersion(assets)
  assert.match(version, /^[a-f0-9]{12}$/)
  assert.notEqual(version, buildPrecacheVersion(assets.concat("/assets/later-ghi.js")))

  const injected = injectServiceWorkerPrecache(worker, assets, version)
  assert.match(injected, /const BUILD_ASSETS = \["\/assets\/main-abc\.css","\/assets\/main-abc\.js","\/assets\/reader-def\.js"\]/)
  assert.match(injected, new RegExp(`const BUILD_CACHE_VERSION = "${version}"`))
  assert.match(injected, /\.\.\.BUILD_ASSETS/)
  assert.equal(injectServiceWorkerPrecache(injected, assets, version), injected)
})

test("the Vite build installs the service-worker precache injector", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8")
  const plugin = tuuruServiceWorkerPrecache()

  assert.equal(plugin.name, "tuuru-service-worker-precache")
  assert.equal(plugin.apply, "build")
  assert.equal(typeof plugin.writeBundle, "function")
  assert.match(config, /tuuruServiceWorkerPrecache\(\)/)
})
