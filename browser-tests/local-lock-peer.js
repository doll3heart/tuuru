import { createWebLocksAdapter } from "/js/local-locks.js"

const PEER_COMMAND_TIMEOUT_MS = 5_000
const ID_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,255}$/i
const SUPPORTED_COMMANDS = new Set(["acquire", "release", "state", "dispose"])
const SUPPORTED_OPTION_KEYS = new Set(["mode", "ifAvailable", "steal"])

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requireId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(`${label} is not a valid correlation ID`)
  }
  return value
}

function requireLockName(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    !value.startsWith("tuuru:") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError("lockName is not a supported Tuuru lock name")
  }
  return value
}

function normalizeOptions(value) {
  if (value === undefined) return {}
  if (!isRecord(value)) throw new TypeError("options must be a data object")
  for (const key of Object.keys(value)) {
    if (!SUPPORTED_OPTION_KEYS.has(key)) throw new TypeError(`unsupported lock option: ${key}`)
  }
  if (value.mode !== undefined && value.mode !== "exclusive" && value.mode !== "shared") {
    throw new TypeError("mode must be exclusive or shared")
  }
  for (const key of ["ifAvailable", "steal"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      throw new TypeError(`${key} must be boolean`)
    }
  }
  if (value.ifAvailable === true && value.steal === true) {
    throw new TypeError("ifAvailable and steal cannot be combined")
  }
  if (value.steal === true && value.mode === "shared") {
    throw new TypeError("steal requires exclusive mode")
  }
  return { ...value }
}

function serializeError(error) {
  if (error === null || error === undefined) return null
  return {
    name: typeof error.name === "string" ? error.name : "Error",
    code: typeof error.code === "string" ? error.code : null,
    message: typeof error.message === "string" ? error.message : String(error),
  }
}

function withTimeout(promise, label) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), PEER_COMMAND_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function readIdentity() {
  const parameters = new URLSearchParams(location.search)
  return Object.freeze({
    runId: requireId(parameters.get("runId"), "runId"),
    scenarioId: requireId(parameters.get("scenarioId"), "scenarioId"),
    peerId: requireId(parameters.get("peerId"), "peerId"),
  })
}

function lossKey(peerId, lockName, reason) {
  return JSON.stringify([peerId, lockName, reason])
}

function validateLossCoordination(value) {
  if (!isRecord(value)) throw new TypeError("waitForLoss must be a data object")
  const allowed = new Set(["peerId", "lockName", "reason"])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`unsupported waitForLoss field: ${key}`)
  }
  const peerId = requireId(value.peerId, "waitForLoss.peerId")
  const lockName = requireLockName(value.lockName)
  if (!new Set(["stolen", "released", "aborted"]).has(value.reason)) {
    throw new TypeError("waitForLoss.reason is unsupported")
  }
  return { peerId, lockName, reason: value.reason }
}

function validateCommand(message, identity) {
  if (!isRecord(message) || message.kind !== "command") return null
  if (
    message.runId !== identity.runId ||
    message.scenarioId !== identity.scenarioId ||
    message.targetPeerId !== identity.peerId
  ) {
    return null
  }
  const commandId = requireId(message.commandId, "commandId")
  if (!commandId.startsWith(`${identity.runId}:${identity.scenarioId}:`)) {
    throw new TypeError("commandId does not match this run and scenario")
  }
  if (typeof message.command !== "string" || !SUPPORTED_COMMANDS.has(message.command)) {
    throw new TypeError("unsupported command")
  }
  return { ...message, commandId }
}

function startPeer() {
  const identity = readIdentity()
  const adapter = createWebLocksAdapter()
  const channelName = `tuuru-local-lock-harness:${identity.runId}:${identity.scenarioId}`
  const channel = new BroadcastChannel(channelName)
  const handles = new Map()
  const observedLosses = new Map()
  const lossWaiters = new Map()
  let channelClosed = false

  function post(message) {
    if (channelClosed) return
    channel.postMessage({ ...identity, ...message })
  }

  function recordPeerLoss(message) {
    if (
      !isRecord(message) ||
      message.kind !== "event" ||
      message.event !== "loss" ||
      message.runId !== identity.runId ||
      message.scenarioId !== identity.scenarioId ||
      message.peerId === identity.peerId ||
      !isRecord(message.data)
    ) {
      return
    }
    try {
      const sourcePeerId = requireId(message.peerId, "loss peerId")
      const lockName = requireLockName(message.data.lockName)
      const reason = message.data.reason
      if (!new Set(["stolen", "released", "aborted"]).has(reason)) return
      const key = lossKey(sourcePeerId, lockName, reason)
      const loss = { ...message.data, peerId: sourcePeerId }
      observedLosses.set(key, loss)
      const waiter = lossWaiters.get(key)
      if (waiter) {
        clearTimeout(waiter.timeoutId)
        lossWaiters.delete(key)
        waiter.resolve(loss)
      }
    } catch {
      // Invalid peer events are ignored without affecting a command.
    }
  }

  function waitForObservedLoss(coordination) {
    const key = lossKey(coordination.peerId, coordination.lockName, coordination.reason)
    if (observedLosses.has(key)) return Promise.resolve(observedLosses.get(key))
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        lossWaiters.delete(key)
        reject(new Error("correlated peer loss timed out"))
      }, PEER_COMMAND_TIMEOUT_MS)
      lossWaiters.set(key, { resolve, reject, timeoutId })
    })
  }

  function monitorHandle(record) {
    void record.handle.lost.then(loss => {
      record.loss = {
        reason: loss.reason,
        error: serializeError(loss.error),
        isLost: record.handle.isLost(),
      }
      post({
        kind: "event",
        event: "loss",
        eventId: `${record.handleId}:loss`,
        data: {
          handleId: record.handleId,
          lockName: record.lockName,
          ...record.loss,
        },
      })
    })
    void record.handle.released.then(() => {
      record.released = true
      post({
        kind: "event",
        event: "released",
        eventId: `${record.handleId}:released`,
        data: {
          handleId: record.handleId,
          lockName: record.lockName,
          isLost: record.handle.isLost(),
        },
      })
    })
  }

  async function releaseRecord(record) {
    record.handle.release()
    const [loss] = await Promise.all([
      withTimeout(record.handle.lost, "handle loss acknowledgement"),
      withTimeout(record.handle.released, "handle release acknowledgement"),
    ])
    record.released = true
    if (record.loss === null) {
      record.loss = {
        reason: loss.reason,
        error: serializeError(loss.error),
        isLost: record.handle.isLost(),
      }
    }
    return {
      handleId: record.handleId,
      lockName: record.lockName,
      released: true,
      isLost: record.handle.isLost(),
      loss: record.loss,
    }
  }

  async function releaseAll() {
    const records = [...handles.values()]
    await Promise.allSettled(records.map(record => releaseRecord(record)))
    return records.length
  }

  function releaseAllNow() {
    for (const record of handles.values()) record.handle.release()
  }

  async function executeCommand(message) {
    if (message.command === "acquire") {
      const lockName = requireLockName(message.lockName)
      const options = normalizeOptions(message.options)
      const acquisition = adapter.hold(lockName, options)
      post({
        kind: "event",
        event: "request-started",
        eventId: `${message.commandId}:request-started`,
        data: { commandId: message.commandId, lockName },
      })
      const handle = await acquisition
      if (handle === null) {
        return { acquired: false, nullLock: true, lockName, handleId: null }
      }
      const handleId = `${message.commandId}:handle`
      const record = {
        handle,
        handleId,
        lockName,
        loss: null,
        released: false,
      }
      handles.set(handleId, record)
      monitorHandle(record)

      let observedLoss = null
      if (message.waitForLoss !== undefined) {
        try {
          observedLoss = await waitForObservedLoss(validateLossCoordination(message.waitForLoss))
        } catch (error) {
          await releaseRecord(record)
          throw error
        }
      }
      const isLost = handle.isLost()
      return {
        acquired: true,
        nullLock: false,
        usable: !isLost,
        handleId,
        lockName: handle.name,
        mode: handle.mode,
        isLost,
        observedLoss,
      }
    }

    if (message.command === "release") {
      const handleId = requireId(message.handleId, "handleId")
      const record = handles.get(handleId)
      if (!record) throw new Error("unknown handleId")
      return releaseRecord(record)
    }

    if (message.command === "state") {
      const handleId = requireId(message.handleId, "handleId")
      const record = handles.get(handleId)
      if (!record) return { known: false, handleId }
      return {
        known: true,
        handleId,
        lockName: record.lockName,
        mode: record.handle.mode,
        isLost: record.handle.isLost(),
        released: record.released,
        loss: record.loss,
      }
    }

    if (message.command === "dispose") {
      return { disposed: true, releasedHandles: await releaseAll() }
    }

    throw new TypeError("unsupported command")
  }

  function closeChannel() {
    if (channelClosed) return
    channelClosed = true
    for (const waiter of lossWaiters.values()) {
      clearTimeout(waiter.timeoutId)
      waiter.reject(new Error("peer disposed before correlated loss"))
    }
    lossWaiters.clear()
    observedLosses.clear()
    channel.close()
  }

  channel.addEventListener("message", event => {
    recordPeerLoss(event.data)
    let command
    try {
      command = validateCommand(event.data, identity)
    } catch (error) {
      const commandId = typeof event.data?.commandId === "string"
        ? event.data.commandId
        : `${identity.runId}:${identity.scenarioId}:${identity.peerId}:invalid`
      post({
        kind: "response",
        commandId,
        command: String(event.data?.command ?? "invalid"),
        ok: false,
        error: serializeError(error),
      })
      return
    }
    if (command === null) return

    void executeCommand(command).then(
      data => {
        post({
          kind: "response",
          commandId: command.commandId,
          command: command.command,
          ok: true,
          data,
        })
        if (command.command === "dispose") setTimeout(closeChannel, 0)
      },
      error => {
        post({
          kind: "response",
          commandId: command.commandId,
          command: command.command,
          ok: false,
          error: serializeError(error),
        })
      },
    )
  })

  window.addEventListener("pagehide", () => {
    releaseAllNow()
    closeChannel()
  }, { once: true })

  document.documentElement.dataset.peerState = "ready"
  document.getElementById("peer-status").textContent = `Ready: ${identity.peerId}`
  post({
    kind: "ready",
    readyId: `${identity.runId}:${identity.scenarioId}:${identity.peerId}:ready`,
    available: adapter.available,
  })
}

try {
  startPeer()
} catch (error) {
  document.documentElement.dataset.peerState = "fail"
  document.getElementById("peer-status").textContent = `Peer failed: ${error?.message ?? error}`
}
