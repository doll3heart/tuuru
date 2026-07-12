import {
  DATABASE_WRITE_LOCK_NAME,
  LocalLockUnavailableError,
  createWebLocksAdapter,
  getWorkLockName,
} from "/js/local-locks.js"

export const SCENARIO_IDS = Object.freeze([
  "same-work-exclusion",
  "different-work-concurrency",
  "database-write-serialization",
  "explicit-stale-takeover",
  "context-destruction-release",
  "resume-reacquire",
  "missing-locks-fail-closed"
])

const COMMAND_TIMEOUT_MS = 5_000
const READY_TIMEOUT_MS = 5_000
const PENDING_OBSERVATION_MS = 150
const RUN_ID = createRunId()
const LOCK_SUFFIX = encodeURIComponent(RUN_ID)
const rows = new Map()
const liveResults = []
let finalResult = null

function createRunId() {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 16)
  return `run-${timestamp}-${random}`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function serializeLocalError(error) {
  return {
    name: typeof error?.name === "string" ? error.name : "Error",
    code: typeof error?.code === "string" ? error.code : null,
    message: typeof error?.message === "string" ? error.message : String(error),
  }
}

function remoteError(value, fallback) {
  const error = new Error(value?.message ?? fallback)
  error.name = value?.name ?? "RemotePeerError"
  if (typeof value?.code === "string") error.code = value.code
  return error
}

function workLock(label) {
  return getWorkLockName(`browser-harness/${label}/${RUN_ID}`)
}

function databaseLock() {
  return `${DATABASE_WRITE_LOCK_NAME}:${LOCK_SUFFIX}`
}

class PeerClient {
  constructor(session, peerId, frame) {
    this.session = session
    this.peerId = peerId
    this.frame = frame
    this.active = true
  }

  acquire(lockName, options = {}, waitForLoss) {
    return this.session.send(this, "acquire", {
      lockName,
      options,
      ...(waitForLoss === undefined ? {} : { waitForLoss }),
    })
  }

  release(handleId) {
    return this.session.send(this, "release", { handleId })
  }

  state(handleId) {
    return this.session.send(this, "state", { handleId })
  }

  async dispose() {
    if (!this.active) return
    try {
      await this.session.send(this, "dispose", {})
    } finally {
      this.session.removePeer(this, "disposed")
    }
  }

  destroy() {
    if (!this.active) return
    this.session.removePeer(this, "context-destroyed")
  }
}

class ScenarioSession {
  constructor(scenarioId) {
    this.scenarioId = scenarioId
    this.channel = new BroadcastChannel(
      `tuuru-local-lock-harness:${RUN_ID}:${scenarioId}`,
    )
    this.commandSequence = 0
    this.pending = new Map()
    this.peers = new Map()
    this.readyWaiters = new Map()
    this.lossEvents = new Map()
    this.lossWaiters = new Map()
    this.requestEvents = new Map()
    this.requestWaiters = new Map()
    this.closing = false
    this.closed = false
    this.onMessage = event => this.receive(event.data)
    this.channel.addEventListener("message", this.onMessage)
  }

  receive(message) {
    if (
      message === null ||
      typeof message !== "object" ||
      message.runId !== RUN_ID ||
      message.scenarioId !== this.scenarioId ||
      typeof message.peerId !== "string"
    ) {
      return
    }

    if (message.kind === "ready") {
      const waiter = this.readyWaiters.get(message.peerId)
      if (!waiter) return
      clearTimeout(waiter.timeoutId)
      this.readyWaiters.delete(message.peerId)
      waiter.resolve(message)
      return
    }

    if (message.kind === "response") {
      const pending = this.pending.get(message.commandId)
      if (
        !pending ||
        pending.peerId !== message.peerId ||
        pending.command !== message.command
      ) {
        return
      }
      clearTimeout(pending.timeoutId)
      this.pending.delete(message.commandId)
      if (message.ok === true) pending.resolve(message.data)
      else pending.reject(remoteError(message.error, `${message.command} failed`))
      return
    }

    if (
      message.kind === "event" &&
      message.event === "request-started" &&
      typeof message.eventId === "string" &&
      message.data !== null &&
      typeof message.data === "object" &&
      typeof message.data.commandId === "string" &&
      typeof message.data.lockName === "string"
    ) {
      const key = JSON.stringify([message.peerId, message.data.lockName])
      const value = { ...message.data, peerId: message.peerId, eventId: message.eventId }
      this.requestEvents.set(key, value)
      const waiter = this.requestWaiters.get(key)
      if (waiter) {
        clearTimeout(waiter.timeoutId)
        this.requestWaiters.delete(key)
        waiter.resolve(value)
      }
      return
    }

    if (
      message.kind === "event" &&
      message.event === "loss" &&
      typeof message.eventId === "string" &&
      message.data !== null &&
      typeof message.data === "object" &&
      typeof message.data.lockName === "string" &&
      typeof message.data.reason === "string"
    ) {
      const key = JSON.stringify([
        message.peerId,
        message.data.lockName,
        message.data.reason,
      ])
      const value = { ...message.data, peerId: message.peerId, eventId: message.eventId }
      this.lossEvents.set(key, value)
      const waiter = this.lossWaiters.get(key)
      if (waiter) {
        clearTimeout(waiter.timeoutId)
        this.lossWaiters.delete(key)
        waiter.resolve(value)
      }
    }
  }

  createPeer(peerId) {
    if (this.closing || this.closed) throw new Error("scenario session is closing")
    if (this.peers.has(peerId)) throw new Error(`peer already exists: ${peerId}`)

    const frame = document.createElement("iframe")
    frame.title = `Local lock test peer ${peerId}`
    frame.tabIndex = -1
    const url = new URL("/browser-tests/local-lock-peer.html", location.origin)
    url.searchParams.set("runId", RUN_ID)
    url.searchParams.set("scenarioId", this.scenarioId)
    url.searchParams.set("peerId", peerId)
    frame.src = url.href
    const peer = new PeerClient(this, peerId, frame)
    this.peers.set(peerId, peer)

    const ready = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.readyWaiters.delete(peerId)
        reject(new Error(`peer ready handshake timed out: ${peerId}`))
      }, READY_TIMEOUT_MS)
      this.readyWaiters.set(peerId, { resolve, reject, timeoutId })
    })
    document.getElementById("peer-contexts").append(frame)

    return ready.then(message => {
      assert(message.readyId === `${RUN_ID}:${this.scenarioId}:${peerId}:ready`, "ready ID mismatch")
      assert(message.available === true, `Web Locks unavailable in peer ${peerId}`)
      return peer
    }, error => {
      this.removePeer(peer, "ready-failed")
      throw error
    })
  }

  send(peer, command, data) {
    if (this.closing || this.closed || !peer.active) {
      return Promise.reject(new Error(`cannot send ${command} to an inactive peer`))
    }
    this.commandSequence += 1
    const commandId = `${RUN_ID}:${this.scenarioId}:${peer.peerId}:command-${String(this.commandSequence).padStart(3, "0")}`
    const envelope = {
      kind: "command",
      runId: RUN_ID,
      scenarioId: this.scenarioId,
      targetPeerId: peer.peerId,
      commandId,
      command,
      ...data,
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(commandId)
        reject(new Error(`${command} timed out for ${peer.peerId}`))
      }, COMMAND_TIMEOUT_MS)
      this.pending.set(commandId, {
        peerId: peer.peerId,
        command,
        resolve,
        reject,
        timeoutId,
      })
      try {
        this.channel.postMessage(envelope)
      } catch (error) {
        clearTimeout(timeoutId)
        this.pending.delete(commandId)
        reject(error)
      }
    })
  }

  waitForLoss(peerId, lockName, reason) {
    const key = JSON.stringify([peerId, lockName, reason])
    if (this.lossEvents.has(key)) return Promise.resolve(this.lossEvents.get(key))
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.lossWaiters.delete(key)
        reject(new Error(`loss notification timed out for ${peerId}`))
      }, COMMAND_TIMEOUT_MS)
      this.lossWaiters.set(key, { resolve, reject, timeoutId })
    })
  }

  waitForRequestStarted(peerId, lockName) {
    const key = JSON.stringify([peerId, lockName])
    if (this.requestEvents.has(key)) return Promise.resolve(this.requestEvents.get(key))
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.requestWaiters.delete(key)
        reject(new Error(`request-started notification timed out for ${peerId}`))
      }, COMMAND_TIMEOUT_MS)
      this.requestWaiters.set(key, { resolve, reject, timeoutId })
    })
  }

  removePeer(peer, reason) {
    if (!peer.active) return
    peer.active = false
    peer.frame.remove()
    this.peers.delete(peer.peerId)
    const ready = this.readyWaiters.get(peer.peerId)
    if (ready) {
      clearTimeout(ready.timeoutId)
      this.readyWaiters.delete(peer.peerId)
      ready.reject(new Error(`peer removed before ready: ${reason}`))
    }
    for (const [commandId, pending] of this.pending) {
      if (pending.peerId !== peer.peerId) continue
      clearTimeout(pending.timeoutId)
      this.pending.delete(commandId)
      pending.reject(new Error(`peer removed during ${pending.command}: ${reason}`))
    }
  }

  async dispose() {
    if (this.closed) return
    const peers = [...this.peers.values()]
    await Promise.allSettled(peers.map(peer => peer.dispose()))
    this.closing = true
    for (const peer of [...this.peers.values()]) this.removePeer(peer, "session-cleanup")
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error("scenario session disposed"))
    }
    this.pending.clear()
    for (const ready of this.readyWaiters.values()) {
      clearTimeout(ready.timeoutId)
      ready.reject(new Error("scenario session disposed"))
    }
    this.readyWaiters.clear()
    for (const waiter of this.lossWaiters.values()) {
      clearTimeout(waiter.timeoutId)
      waiter.reject(new Error("scenario session disposed"))
    }
    this.lossWaiters.clear()
    this.lossEvents.clear()
    for (const waiter of this.requestWaiters.values()) {
      clearTimeout(waiter.timeoutId)
      waiter.reject(new Error("scenario session disposed"))
    }
    this.requestWaiters.clear()
    this.requestEvents.clear()
    this.channel.removeEventListener("message", this.onMessage)
    this.channel.close()
    this.closed = true
  }
}

async function withSession(scenarioId, callback) {
  const session = new ScenarioSession(scenarioId)
  try {
    return await callback(session)
  } finally {
    await session.dispose()
  }
}

function createPair(session) {
  return Promise.all([
    session.createPeer(`${session.scenarioId}:peer-a`),
    session.createPeer(`${session.scenarioId}:peer-b`),
  ])
}

async function sameWorkExclusion() {
  return withSession("same-work-exclusion", async session => {
    const [peerA, peerB] = await createPair(session)
    const lockName = workLock("same-work")
    const held = await peerA.acquire(lockName, { mode: "exclusive" })
    assert(held.acquired === true && held.isLost === false, "peer A did not hold the work lock")
    const conditional = await peerB.acquire(lockName, { ifAvailable: true })
    assert(conditional.acquired === false && conditional.nullLock === true, "peer B did not receive null")
    const state = await peerA.state(held.handleId)
    assert(state.known === true && state.isLost === false, "peer A lost ownership unexpectedly")
    return { lockName, peerAHandle: held.handleId, peerBResult: "null", peerAStillHeld: true }
  })
}

async function differentWorkConcurrency() {
  return withSession("different-work-concurrency", async session => {
    const [peerA, peerB] = await createPair(session)
    const firstLock = workLock("different-a")
    const secondLock = workLock("different-b")
    const [first, second] = await Promise.all([
      peerA.acquire(firstLock, { mode: "exclusive" }),
      peerB.acquire(secondLock, { mode: "exclusive" }),
    ])
    assert(first.acquired === true && second.acquired === true, "different locks did not overlap")
    const [firstState, secondState] = await Promise.all([
      peerA.state(first.handleId),
      peerB.state(second.handleId),
    ])
    assert(!firstState.isLost && !secondState.isLost, "a concurrent holder was lost")
    return { lockNames: [firstLock, secondLock], simultaneousHolders: 2 }
  })
}

async function databaseWriteSerialization() {
  return withSession("database-write-serialization", async session => {
    const [peerA, peerB] = await createPair(session)
    const lockName = databaseLock()
    const first = await peerA.acquire(lockName, { mode: "exclusive" })
    let settled = false
    const requestStarted = session.waitForRequestStarted(peerB.peerId, lockName)
    const secondOutcome = peerB.acquire(lockName, { mode: "exclusive" }).then(
      value => {
        settled = true
        return { ok: true, value }
      },
      error => {
        settled = true
        return { ok: false, error }
      },
    )
    const requestEvent = await requestStarted
    assert(requestEvent.lockName === lockName, "peer B request-started correlation was invalid")
    await delay(PENDING_OBSERVATION_MS)
    assert(settled === false, "peer B acquired before peer A released")
    const release = await peerA.release(first.handleId)
    assert(release.released === true, "peer A release was not acknowledged")
    const second = await secondOutcome
    if (!second.ok) throw second.error
    assert(second.value.acquired === true, "peer B did not acquire after release")
    return { lockName, pendingBeforeRelease: true, acquiredAfterRelease: true }
  })
}

async function explicitStaleTakeover() {
  return withSession("explicit-stale-takeover", async session => {
    const [peerA, peerB] = await createPair(session)
    const lockName = workLock("explicit-takeover")
    const original = await peerA.acquire(lockName, { mode: "exclusive" })
    const lossPromise = session.waitForLoss(peerA.peerId, lockName, "stolen")
    const replacementPromise = peerB.acquire(
      lockName,
      { mode: "exclusive", steal: true },
      { peerId: peerA.peerId, lockName, reason: "stolen" },
    )
    const [loss, replacement] = await Promise.all([lossPromise, replacementPromise])
    assert(loss.isLost === true, "peer A did not synchronously observe a lost handle")
    assert(loss.error?.name === "LocalLockUnavailableError", "peer A loss error type was unstable")
    assert(loss.error?.code === "mutation-lock-stolen", "peer A loss was not classified as stolen")
    assert(
      replacement.acquired === true && replacement.usable === true && replacement.isLost === false,
      "peer B ownership was not usable",
    )
    assert(replacement.observedLoss?.reason === "stolen", "peer B reported before observing peer A loss")
    const [originalState, replacementState] = await Promise.all([
      peerA.state(original.handleId),
      peerB.state(replacement.handleId),
    ])
    assert(originalState.isLost === true, "peer A state retained a usable stale handle")
    assert(
      replacementState.known === true &&
      replacementState.isLost === false &&
      replacementState.loss === null,
      "peer B state did not confirm live replacement ownership",
    )
    return {
      lockName,
      lossReason: loss.reason,
      lossCode: loss.error.code,
      synchronousIsLost: loss.isLost,
      replacementReportedAfterLoss: true,
    }
  })
}

async function contextDestructionRelease() {
  return withSession("context-destruction-release", async session => {
    const [peerA, peerB] = await createPair(session)
    const lockName = workLock("context-destruction")
    const original = await peerA.acquire(lockName, { mode: "exclusive" })
    assert(original.acquired === true, "destroyed peer never acquired")
    peerA.destroy()
    const survivor = await peerB.acquire(lockName, { mode: "exclusive" })
    assert(survivor.acquired === true && survivor.isLost === false, "surviving peer could not acquire normally")
    return { lockName, destroyedPeer: peerA.peerId, acquiredWithoutSteal: true }
  })
}

async function resumeReacquire() {
  return withSession("resume-reacquire", async session => {
    const peerId = `${session.scenarioId}:peer-a`
    const lockName = workLock("resume-reacquire")
    const originalPeer = await session.createPeer(peerId)
    const original = await originalPeer.acquire(lockName, { mode: "exclusive" })
    const released = await originalPeer.release(original.handleId)
    assert(released.loss?.reason === "released", "suspended ownership did not release cleanly")
    await originalPeer.dispose()

    const resumedPeer = await session.createPeer(peerId)
    const reacquired = await resumedPeer.acquire(lockName, { mode: "exclusive" })
    const state = await resumedPeer.state(reacquired.handleId)
    assert(reacquired.handleId !== original.handleId, "resumed peer reused a stale handle ID")
    assert(state.known === true && state.isLost === false && state.loss === null, "resumed handle was stale")
    return {
      lockName,
      releasedReason: released.loss.reason,
      recreatedPeerId: peerId,
      newHandle: true,
      staleHandle: false,
    }
  })
}

async function missingLocksFailClosed() {
  const adapter = createWebLocksAdapter({ locks: null, isSecureContext: true })
  assert(adapter.available === false, "missing locks reported available")
  const lockName = `${databaseLock()}:missing`
  let requestError = null
  let holdError = null
  let callbackCalls = 0
  try {
    await adapter.request(lockName, { mode: "exclusive" }, () => { callbackCalls += 1 })
  } catch (error) {
    requestError = error
  }
  try {
    await adapter.hold(lockName, { mode: "exclusive" })
  } catch (error) {
    holdError = error
  }
  for (const error of [requestError, holdError]) {
    assert(error instanceof LocalLockUnavailableError, "missing locks used an unstable error type")
    assert(error.code === "mutation-lock-unavailable", "missing locks used an unstable error code")
  }
  assert(callbackCalls === 0, "unavailable request invoked its callback")
  return {
    available: adapter.available,
    requestError: serializeLocalError(requestError),
    holdError: serializeLocalError(holdError),
    callbackCalls,
  }
}

const SCENARIO_RUNNERS = Object.freeze([
  sameWorkExclusion,
  differentWorkConcurrency,
  databaseWriteSerialization,
  explicitStaleTakeover,
  contextDestructionRelease,
  resumeReacquire,
  missingLocksFailClosed,
])

function initializeRows() {
  const body = document.getElementById("scenario-results")
  for (const scenarioId of SCENARIO_IDS) {
    const row = [...body.querySelectorAll("tr[data-scenario-id]")]
      .find(candidate => candidate.dataset.scenarioId === scenarioId)
    assert(row, `missing static result row: ${scenarioId}`)
    const [idCell, statusCell, detailsCell] = row.children
    assert(idCell && statusCell && detailsCell, `invalid static result row: ${scenarioId}`)
    statusCell.textContent = "PENDING"
    detailsCell.textContent = "Waiting to run."
    row.removeAttribute("data-status")
    rows.set(scenarioId, { row, statusCell, detailsCell })
  }
}

function updateRow(result) {
  const entry = rows.get(result.id)
  if (!entry) return
  entry.row.dataset.status = result.status
  entry.statusCell.textContent = result.status.toUpperCase()
  entry.detailsCell.textContent = JSON.stringify(result.details)
}

function finalize(results, topLevelError = null) {
  if (finalResult !== null) return finalResult
  const byId = new Map(results.map(result => [result.id, result]))
  const orderedResults = SCENARIO_IDS.map(id => byId.get(id) ?? {
    id,
    status: "fail",
    details: {
      error: serializeLocalError(topLevelError ?? new Error("scenario did not run")),
    },
  })
  for (const result of orderedResults) updateRow(result)
  const passed = topLevelError === null && orderedResults.every(result => result.status === "pass")
  finalResult = {
    runId: RUN_ID,
    status: passed ? "pass" : "fail",
    results: orderedResults,
    ...(topLevelError === null ? {} : { topLevelError: serializeLocalError(topLevelError) }),
  }
  document.documentElement.dataset.result = finalResult.status
  document.getElementById("harness-status").textContent = passed
    ? "All seven Web Locks scenarios passed."
    : "One or more Web Locks scenarios failed."
  document.getElementById("result").textContent = JSON.stringify(finalResult, null, 2)
  return finalResult
}

async function runHarness() {
  assert(SCENARIO_IDS.length === SCENARIO_RUNNERS.length, "scenario runner count mismatch")
  for (let index = 0; index < SCENARIO_IDS.length; index += 1) {
    const id = SCENARIO_IDS[index]
    document.getElementById("harness-status").textContent = `Running ${id}.`
    let result
    try {
      result = { id, status: "pass", details: await SCENARIO_RUNNERS[index]() }
    } catch (error) {
      result = { id, status: "fail", details: { error: serializeLocalError(error) } }
    }
    liveResults.push(result)
    updateRow(result)
  }
  finalize(liveResults)
}

initializeRows()
window.addEventListener("error", event => finalize(liveResults, event.error ?? new Error(event.message)))
window.addEventListener("unhandledrejection", event => finalize(liveResults, event.reason))
void runHarness().catch(error => finalize(liveResults, error))
