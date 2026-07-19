import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import http from "node:http"
import net from "node:net"

const ASSET_URLS = [
  new URL("../browser-tests/local-lock-harness.html", import.meta.url),
  new URL("../browser-tests/local-lock-peer.html", import.meta.url),
  new URL("../browser-tests/local-lock-harness.js", import.meta.url),
  new URL("../browser-tests/local-lock-peer.js", import.meta.url),
  new URL("../scripts/serve-lock-harness.mjs", import.meta.url),
  new URL("./local-lock-browser-harness.test.mjs", import.meta.url),
]

const SCENARIO_IDS = [
  "same-work-exclusion",
  "different-work-concurrency",
  "database-write-serialization",
  "explicit-stale-takeover",
  "context-destruction-release",
  "resume-reacquire",
  "missing-locks-fail-closed",
]

const serverModuleUrl = new URL("../scripts/serve-lock-harness.mjs", import.meta.url)

async function read(url) {
  return readFile(url, "utf8")
}

function rawRequest({ port, path = "/", method = "GET" }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method,
    }, response => {
      const chunks = []
      response.on("data", chunk => chunks.push(chunk))
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      })
    })
    request.on("error", reject)
    request.end()
  })
}

async function startTestServer(t, options = {}) {
  const { startLockHarnessServer } = await import(serverModuleUrl)
  const instance = await startLockHarnessServer({
    port: 0,
    timeout: 5_000,
    ...options,
  })
  t.after(() => instance.close("test-cleanup"))
  return instance
}

test("all six browser harness and server assets exist", async () => {
  const missing = []
  for (const url of ASSET_URLS) {
    try {
      await access(url)
    } catch {
      missing.push(url.pathname.split("/Tuuru/").at(-1))
    }
  }
  assert.deepEqual(missing, [], `missing Task 3 assets: ${missing.join(", ")}`)
})

test("browser modules use the real adapter and expose exactly seven result scenarios", async () => {
  const [harnessHtml, peerHtml, harnessSource, peerSource] = await Promise.all([
    read(ASSET_URLS[0]),
    read(ASSET_URLS[1]),
    read(ASSET_URLS[2]),
    read(ASSET_URLS[3]),
  ])

  assert.match(harnessSource, /from\s+["']\/js\/local-locks\.js["']/)
  assert.match(peerSource, /from\s+["']\/js\/local-locks\.js["']/)
  const scenarioDeclaration = harnessSource.match(
    /export const SCENARIO_IDS = Object\.freeze\(\s*(\[[\s\S]*?\])\s*\)/,
  )
  assert.ok(scenarioDeclaration, "harness must expose its exact scenario ID list")
  assert.deepEqual(JSON.parse(scenarioDeclaration[1]), SCENARIO_IDS)

  assert.match(harnessHtml, /<pre\s+id=["']result["'][^>]*>/)
  assert.match(harnessHtml, /<tbody\s+id=["']scenario-results["'][^>]*>/)
  assert.equal((harnessHtml.match(/<tr\s+data-scenario-id=/g) ?? []).length, 7)
  assert.match(harnessHtml, /window\.__tuuruLockHarnessFail/)
  assert.match(harnessHtml, /import\(["']\/browser-tests\/local-lock-harness\.js["']\)/)
  assert.match(harnessHtml, /document\.documentElement\.dataset\.result\s*=\s*["']fail["']/)
  assert.match(peerHtml, /<script\s+type=["']module["']\s+src=["']\/browser-tests\/local-lock-peer\.js["']/)
  assert.match(harnessSource, /document\.documentElement\.dataset\.result\s*=/)
  assert.match(harnessSource, /row\.dataset\.status\s*=/)
  assert.match(harnessSource, /status\.toUpperCase\(\)/)
  assert.match(harnessSource, /JSON\.stringify\(finalResult/)
})

test("browser protocol is local-only, data-only, bounded, and cleanup-aware", async () => {
  const [harnessSource, peerSource] = await Promise.all([
    read(ASSET_URLS[2]),
    read(ASSET_URLS[3]),
  ])
  const combined = `${harnessSource}\n${peerSource}`

  assert.match(harnessSource, /new BroadcastChannel\(/)
  assert.match(peerSource, /new BroadcastChannel\(/)
  for (const [pattern, description] of [
    [/(?:https?|wss?):\/\//i, "external URL"],
    [/\bfetch\s*\(/, "fetch"],
    [/\bWebSocket\b/, "WebSocket"],
    [/\bEventSource\b/, "EventSource"],
    [/serviceWorker/, "service worker"],
    [/\b(?:localStorage|sessionStorage|indexedDB)\b/, "persistence"],
  ]) {
    assert.doesNotMatch(combined, pattern, `browser harness must not use ${description}`)
  }
  assert.doesNotMatch(peerSource, /\beval\s*\(|new\s+Function\b|\.innerHTML\s*=/)

  for (const token of [
    "runId",
    "peerId",
    "commandId",
    "lockName",
    "acquire",
    "release",
    "released",
    "loss",
    "isLost",
    "dispose",
  ]) {
    assert.ok(combined.includes(token), `missing peer protocol token: ${token}`)
  }
  assert.match(harnessSource, /COMMAND_TIMEOUT_MS/)
  assert.match(harnessSource, /finally\s*{/)
  assert.match(peerSource, /pagehide/)
  assert.match(peerSource, /event:\s*["']request-started["']/)
  assert.match(harnessSource, /waitForRequestStarted/)
  assert.match(peerSource, /usable:\s*!isLost/)
  assert.match(harnessSource, /replacement\.isLost\s*===\s*false/)
  assert.match(harnessSource, /peerB\.state\(replacement\.handleId\)/)
})

test("package adds only the exact browser-lock script and no dependency", async () => {
  const packageJson = JSON.parse(await read(new URL("../package.json", import.meta.url)))

  assert.deepEqual(packageJson.scripts, {
    dev: "vite --config vite.config.ts",
    build: "tsc -b && vite build --config vite.config.ts",
    "build:verify": "tsc -b --pretty false && node scripts/verify-builds.mjs",
    verify: "npm test && npm run build:verify",
    test: "node --test",
    preview: "vite preview --config vite.config.ts",
    "test:locks:browser": "node scripts/serve-lock-harness.mjs --port 4177 --timeout 180000",
  })
  assert.deepEqual(packageJson.dependencies, {
    dompurify: "^3.4.11",
  })
  assert.deepEqual(packageJson.devDependencies, {
    "@types/node": "^24.13.3",
    jsdom: "^27.0.1",
    typescript: "~5.7.0",
    vite: "^6.0.0",
  })
})

test("server binds an imported ephemeral instance only to literal IPv4 loopback", async t => {
  const instance = await startTestServer(t)
  assert.equal(instance.host, "127.0.0.1")
  assert.equal(instance.address.address, "127.0.0.1")
  assert.equal(instance.address.family, "IPv4")
  assert.ok(Number.isInteger(instance.port) && instance.port > 0)
})

test("server serves known files with deterministic content types", async t => {
  const instance = await startTestServer(t)
  const response = await rawRequest({ port: instance.port, path: "/js/local-locks.js" })

  assert.equal(response.status, 200)
  assert.match(response.headers["content-type"], /^text\/javascript; charset=utf-8$/)
  assert.equal(response.headers["cache-control"], "no-store")
  assert.equal(response.body, await read(new URL("../js/local-locks.js", import.meta.url)))

  const missing = await rawRequest({ port: instance.port, path: "/not-a-real-file.js" })
  assert.deepEqual(
    { status: missing.status, body: missing.body },
    { status: 404, body: "Not Found\n" },
  )
})

test("server rejects raw, encoded, double-encoded, and backslash traversal", async t => {
  const instance = await startTestServer(t)
  const traversalPaths = [
    "/../package.json",
    "/%2e%2e/package.json",
    "/%2E%2E%2Fpackage.json",
    "/%252e%252e/package.json",
    "/..%5cpackage.json",
  ]

  for (const path of traversalPaths) {
    const response = await rawRequest({ port: instance.port, path })
    assert.equal(response.status, 403, `expected traversal rejection for ${path}`)
    assert.equal(response.body, "Forbidden\n")
  }
})

test("server rejects malformed encodings, hidden paths, and unsupported methods", async t => {
  const instance = await startTestServer(t)

  const malformed = await rawRequest({ port: instance.port, path: "/%E0%A4%A" })
  assert.deepEqual(
    { status: malformed.status, body: malformed.body },
    { status: 400, body: "Bad Request\n" },
  )

  const malformedQuery = await rawRequest({
    port: instance.port,
    path: "/js/local-locks.js?value=%E0%A4%A",
  })
  assert.deepEqual(
    { status: malformedQuery.status, body: malformedQuery.body },
    { status: 400, body: "Bad Request\n" },
  )

  const hidden = await rawRequest({ port: instance.port, path: "/.git/config" })
  assert.deepEqual(
    { status: hidden.status, body: hidden.body },
    { status: 403, body: "Forbidden\n" },
  )

  const unsupported = await rawRequest({
    port: instance.port,
    path: "/js/local-locks.js",
    method: "PUT",
  })
  assert.equal(unsupported.status, 405)
  assert.equal(unsupported.headers.allow, "GET, HEAD, POST")
  assert.equal(unsupported.body, "Method Not Allowed\n")
})

test("local POST shutdown closes only its own server and clears its timer", async t => {
  const first = await startTestServer(t)
  const second = await startTestServer(t)

  const shutdown = await rawRequest({
    port: first.port,
    path: "/__shutdown",
    method: "POST",
  })
  assert.equal(shutdown.status, 200)
  assert.equal(shutdown.headers["content-type"], "application/json; charset=utf-8")
  assert.deepEqual(JSON.parse(shutdown.body), { status: "shutting-down" })
  assert.equal(await first.closed, "shutdown")

  const survivor = await rawRequest({ port: second.port, path: "/js/local-locks.js" })
  assert.equal(survivor.status, 200)
  await second.close("manual")
  assert.equal(await second.closed, "manual")
})

test("server auto-closes after its bounded timeout", async t => {
  const instance = await startTestServer(t, { timeout: 40 })
  assert.equal(await instance.closed, "timeout")
})

test("server timeout forcibly closes an open local connection", async t => {
  const instance = await startTestServer(t, { timeout: 40 })
  const socket = net.createConnection({ host: "127.0.0.1", port: instance.port })
  t.after(() => socket.destroy())
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve)
    socket.once("error", reject)
  })

  const outcome = await Promise.race([
    instance.closed.then(reason => ({ reason })),
    new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250)),
  ])
  assert.deepEqual(outcome, { reason: "timeout" })
  if (!socket.destroyed) {
    await new Promise(resolve => socket.once("close", resolve))
  }
  assert.equal(socket.destroyed, true)
})

test("CLI parsing validates port and timeout while keeping host non-configurable", async () => {
  const { parseCliArgs } = await import(serverModuleUrl)

  assert.deepEqual(parseCliArgs([]), { port: 4177, timeout: 180_000 })
  assert.deepEqual(
    parseCliArgs(["--port", "4311", "--timeout", "9000"]),
    { port: 4311, timeout: 9000 },
  )
  for (const args of [
    ["--host", "0.0.0.0"],
    ["--host", "127.0.0.1"],
    ["--port"],
    ["--port", "0"],
    ["--port", "65536"],
    ["--port", "1.5"],
    ["--timeout"],
    ["--timeout", "0"],
    ["--timeout", "soon"],
    ["--unknown", "value"],
  ]) {
    assert.throws(() => parseCliArgs(args), TypeError, args.join(" "))
  }
})
