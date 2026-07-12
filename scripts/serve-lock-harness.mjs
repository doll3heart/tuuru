import { readFile, realpath, stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const LOCK_HARNESS_HOST = "127.0.0.1"
export const DEFAULT_LOCK_HARNESS_PORT = 4177
export const DEFAULT_LOCK_HARNESS_TIMEOUT = 180_000

const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const MAX_TIMEOUT = 2_147_483_647
const ALLOWED_FILES = new Set([
  "/browser-tests/local-lock-harness.html",
  "/browser-tests/local-lock-peer.html",
  "/browser-tests/local-lock-harness.js",
  "/browser-tests/local-lock-peer.js",
  "/js/local-locks.js",
])
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
])

function parseInteger(value, label, { minimum, maximum }) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new TypeError(`${label} must be an integer`)
  }
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new TypeError(`${label} must be between ${minimum} and ${maximum}`)
  }
  return number
}

export function parseCliArgs(args) {
  if (!Array.isArray(args)) throw new TypeError("CLI arguments must be an array")
  const result = {
    port: DEFAULT_LOCK_HARNESS_PORT,
    timeout: DEFAULT_LOCK_HARNESS_TIMEOUT,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const value = args[index + 1]
    if (argument === "--port") {
      result.port = parseInteger(value, "port", { minimum: 1, maximum: 65_535 })
      index += 1
      continue
    }
    if (argument === "--timeout") {
      result.timeout = parseInteger(value, "timeout", { minimum: 1, maximum: MAX_TIMEOUT })
      index += 1
      continue
    }
    throw new TypeError(`Unsupported argument: ${String(argument)}`)
  }

  return result
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

export function decodeRequestPath(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.startsWith("/") || rawUrl.includes("#")) {
    return { status: 400, pathname: null }
  }
  const queryIndex = rawUrl.indexOf("?")
  const rawPathname = rawUrl.slice(0, queryIndex === -1 ? undefined : queryIndex)
  const rawQuery = queryIndex === -1 ? "" : rawUrl.slice(queryIndex + 1)

  function decodeComponent(component) {
    let decoded = component
    for (let attempt = 0; attempt <= component.length; attempt += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
    throw new URIError("encoding did not converge")
  }

  let decoded

  try {
    decoded = decodeComponent(rawPathname)
    decodeComponent(rawQuery)
  } catch {
    return { status: 400, pathname: null }
  }

  if (decoded.includes("\\") || decoded.includes("\0")) {
    return { status: 403, pathname: null }
  }
  const segments = decoded.split("/")
  if (segments.some(segment => (
    segment === "." ||
    segment === ".." ||
    segment.startsWith(".") ||
    segment.includes(":")
  ))) {
    return { status: 403, pathname: null }
  }

  return { status: 200, pathname: `/${segments.filter(Boolean).join("/")}` }
}

function sendText(response, status, body, headers = {}) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
    ...headers,
  })
  response.end(body)
}

async function serveAllowedFile(response, repositoryRoot, pathname, method) {
  if (!ALLOWED_FILES.has(pathname)) {
    sendText(response, 404, "Not Found\n")
    return
  }

  const segments = pathname.slice(1).split("/")
  const candidate = path.resolve(repositoryRoot, ...segments)
  if (!isWithinRoot(repositoryRoot, candidate)) {
    sendText(response, 403, "Forbidden\n")
    return
  }

  try {
    const canonicalCandidate = await realpath(candidate)
    if (!isWithinRoot(repositoryRoot, canonicalCandidate)) {
      sendText(response, 403, "Forbidden\n")
      return
    }
    const fileStats = await stat(canonicalCandidate)
    if (!fileStats.isFile()) {
      sendText(response, 404, "Not Found\n")
      return
    }
    const contentType = CONTENT_TYPES.get(path.extname(canonicalCandidate).toLowerCase())
    if (!contentType) {
      sendText(response, 403, "Forbidden\n")
      return
    }
    const body = await readFile(canonicalCandidate)
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": body.byteLength,
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    })
    response.end(method === "HEAD" ? undefined : body)
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      sendText(response, 404, "Not Found\n")
      return
    }
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      sendText(response, 403, "Forbidden\n")
      return
    }
    throw error
  }
}

function createRequestHandler({ repositoryRoot, requestShutdown }) {
  return async function handleRequest(request, response) {
    if (!new Set(["GET", "HEAD", "POST"]).has(request.method)) {
      sendText(response, 405, "Method Not Allowed\n", { allow: "GET, HEAD, POST" })
      return
    }

    const decoded = decodeRequestPath(request.url)
    if (decoded.status === 400) {
      sendText(response, 400, "Bad Request\n")
      return
    }
    if (decoded.status === 403) {
      sendText(response, 403, "Forbidden\n")
      return
    }

    if (request.method === "POST") {
      if (decoded.pathname !== "/__shutdown" || request.socket.remoteAddress !== LOCK_HARNESS_HOST) {
        sendText(response, 405, "Method Not Allowed\n", { allow: "GET, HEAD, POST" })
        return
      }
      const body = Buffer.from(`${JSON.stringify({ status: "shutting-down" })}\n`)
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": body.byteLength,
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      })
      response.end(body, requestShutdown)
      return
    }

    if (decoded.pathname === "/__shutdown") {
      sendText(response, 405, "Method Not Allowed\n", { allow: "POST" })
      return
    }
    await serveAllowedFile(response, repositoryRoot, decoded.pathname, request.method)
  }
}

function validateServerOptions({ port, timeout }) {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError("port must be an integer between 0 and 65535")
  }
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT) {
    throw new TypeError(`timeout must be an integer between 1 and ${MAX_TIMEOUT}`)
  }
}

export async function startLockHarnessServer({
  port = DEFAULT_LOCK_HARNESS_PORT,
  timeout = DEFAULT_LOCK_HARNESS_TIMEOUT,
} = {}) {
  validateServerOptions({ port, timeout })
  const repositoryRoot = await realpath(REPOSITORY_ROOT)
  let closeReason = null
  let timeoutId = null
  let resolveClosed
  const closed = new Promise(resolve => { resolveClosed = resolve })
  let closeSettled = false

  const settleClosed = () => {
    if (closeSettled) return
    closeSettled = true
    if (timeoutId !== null) clearTimeout(timeoutId)
    resolveClosed(closeReason ?? "closed")
  }

  let close = reason => {
    if (closeReason === null) closeReason = String(reason ?? "manual")
    if (timeoutId !== null) clearTimeout(timeoutId)
    return closed
  }
  const server = createServer((request, response) => {
    const handler = createRequestHandler({
      repositoryRoot,
      requestShutdown: () => { void close("shutdown") },
    })
    void handler(request, response).catch(() => {
      if (!response.headersSent) sendText(response, 500, "Internal Server Error\n")
      else response.destroy()
    })
  })

  await new Promise((resolve, reject) => {
    const onError = error => {
      server.off("listening", onListening)
      reject(error)
    }
    const onListening = () => {
      server.off("error", onError)
      resolve()
    }
    server.once("error", onError)
    server.once("listening", onListening)
    server.listen(port, LOCK_HARNESS_HOST)
  })

  server.once("close", settleClosed)
  close = reason => {
    if (closeReason === null) closeReason = String(reason ?? "manual")
    if (timeoutId !== null) clearTimeout(timeoutId)
    if (server.listening) {
      server.close()
      server.closeAllConnections()
    }
    else settleClosed()
    return closed
  }
  timeoutId = setTimeout(() => { void close("timeout") }, timeout)

  const address = server.address()
  if (!address || typeof address === "string") {
    await close("invalid-address")
    throw new Error("Lock harness did not receive an IPv4 address")
  }

  return Object.freeze({
    host: LOCK_HARNESS_HOST,
    port: address.port,
    address: Object.freeze({
      address: address.address,
      family: address.family,
      port: address.port,
    }),
    closed,
    close,
  })
}

const isDirectExecution = Boolean(process.argv[1]) && (
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)

if (isDirectExecution) {
  try {
    const options = parseCliArgs(process.argv.slice(2))
    const instance = await startLockHarnessServer(options)
    console.log(`Lock harness listening at http://${instance.host}:${instance.port}`)
    const reason = await instance.closed
    console.log(`Lock harness closed (${reason})`)
  } catch (error) {
    console.error(error?.message ?? error)
    process.exitCode = 1
  }
}
