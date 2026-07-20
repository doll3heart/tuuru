import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), "utf8")
}

test("the shared web manifest installs Tuuru and exposes author and reader shortcuts", async () => {
  const manifest = JSON.parse(await text("public/manifest.webmanifest"))

  assert.equal(manifest.id, "/")
  assert.equal(manifest.name, "Tuuru")
  assert.equal(manifest.short_name, "Tuuru")
  assert.equal(manifest.start_url, "/")
  assert.equal(manifest.scope, "/")
  assert.equal(manifest.display, "standalone")
  assert.equal(manifest.theme_color, "#C7A1AA")
  assert.equal(manifest.background_color, "#EEE6E7")

  const icons = new Map(manifest.icons.map(icon => [icon.sizes, icon]))
  assert.equal(icons.get("192x192")?.src, "/icons/icon-192.png")
  assert.equal(icons.get("512x512")?.src, "/icons/icon-512.png")
  assert.ok(manifest.icons.some(icon => icon.src === "/icons/icon-maskable-512.png" && /maskable/.test(icon.purpose)))
  assert.deepEqual(manifest.shortcuts.map(shortcut => shortcut.url), ["/#/new", "/reader/"])
})

test("both production entries share root-scoped install metadata and registration", async () => {
  for (const path of ["index.html", "reader/index.html"]) {
    const html = await text(path)
    assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/)
    assert.match(html, /name="theme-color"\s+content="#C7A1AA"/)
    assert.match(html, /src="(?:\.\.\/)?js\/pwa-register\.js"/)
  }
})

test("the service worker follows web deployments without forcing an editor reload", async () => {
  const [registration, worker, headers] = await Promise.all([
    text("js/pwa-register.js"),
    text("public/sw.js"),
    text("public/_headers"),
  ])

  assert.match(registration, /serviceWorker\.register\("\/sw\.js",\s*\{\s*scope:\s*"\/"\s*\}\)/s)
  assert.doesNotMatch(registration, /location\.reload/)
  assert.match(worker, /self\.skipWaiting\(\)/)
  assert.match(worker, /self\.clients\.claim\(\)/)
  assert.match(worker, /request\.mode\s*===\s*"navigate"/)
  assert.match(worker, /url\.origin\s*!==\s*self\.location\.origin/)
  assert.match(worker, /caches\.delete/)
  assert.match(headers, /\/sw\.js\s*\n\s+Cache-Control:\s*public,\s*no-cache,\s*must-revalidate/i)
  assert.match(headers, /\/manifest\.webmanifest\s*\n\s+Cache-Control:\s*public,\s*no-cache,\s*must-revalidate/i)
})

test("the TWA contract remains bound to tuuru.chat and excludes signing secrets", async () => {
  const [config, gitignore, gradle, assetLinks] = await Promise.all([
    text("android/twa-manifest.json").then(JSON.parse),
    text(".gitignore"),
    text("android/app/build.gradle"),
    text("public/.well-known/assetlinks.json").then(JSON.parse),
  ])

  assert.equal(config.packageId, "chat.tuuru.app")
  assert.equal(config.host, "tuuru.chat")
  assert.equal(config.startUrl, "/")
  assert.equal(config.name, "Tuuru")
  assert.equal(config.launcherName, "Tuuru")
  assert.equal(config.appVersionCode, 1)
  assert.equal(config.appVersion, "1.0.0")
  assert.equal(config.iconUrl, "https://tuuru.chat/icons/icon-512.png")
  assert.equal(config.fingerprints.length, 1)
  assert.match(gitignore, /android\/.*\.keystore/)
  assert.match(gitignore, /android\/.*\.apk/)
  assert.match(gradle, /hostName:\s*'tuuru\.chat'/)
  assert.match(gradle, /webManifestUrl[^\n]*https:\/\/tuuru\.chat\/manifest\.webmanifest/)
  assert.doesNotMatch(gradle, /127\.0\.0\.1/)
  assert.equal(assetLinks[0].target.package_name, config.packageId)
  assert.deepEqual(assetLinks[0].target.sha256_cert_fingerprints, [config.fingerprints[0].value])
  assert.deepEqual(assetLinks[0].relation, ["delegate_permission/common.handle_all_urls"])

  await access(new URL("public/icons/icon-192.png", root))
  await access(new URL("public/icons/icon-512.png", root))
  await access(new URL("public/icons/icon-maskable-512.png", root))
})
