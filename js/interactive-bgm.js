const DEFAULT_VOLUME = 70
const MAX_TRACK_DURATION_MS = 24 * 60 * 60 * 1000
const MIN_TRACK_RANGE_MS = 500

function boundedVolume(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : DEFAULT_VOLUME
}

function boundedInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(0, Math.round(parsed))) : 0
}

export function normalizeInteractiveBgm(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const durationMs = boundedInteger(source.durationMs, MAX_TRACK_DURATION_MS)
  const bytes = boundedInteger(source.bytes)
  let startMs = Math.min(durationMs || MAX_TRACK_DURATION_MS, boundedInteger(source.startMs, MAX_TRACK_DURATION_MS))
  const rawEndMs = source.endMs === null || source.endMs === undefined || source.endMs === ""
    ? null
    : Math.min(durationMs || MAX_TRACK_DURATION_MS, boundedInteger(source.endMs, MAX_TRACK_DURATION_MS))
  let endMs = rawEndMs !== null && rawEndMs - startMs >= MIN_TRACK_RANGE_MS ? rawEndMs : null
  if (rawEndMs !== null && endMs === null) startMs = 0
  return {
    source:String(source.source || source.url || "").trim().slice(0, 2_000_000),
    fileName:String(source.fileName || "").trim().slice(0, 240),
    volume:boundedVolume(source.volume),
    loop:source.loop !== false,
    durationMs,
    bytes,
    startMs,
    endMs,
  }
}

export function interactiveBgmHasSource(value) {
  return Boolean(normalizeInteractiveBgm(value).source)
}

function safeAudioSource(value) {
  const source = String(value || "").trim()
  if (/^https:\/\//i.test(source)) return source
  if (/^blob:/i.test(source)) return source
  if (/^data:audio\//i.test(source)) return source
  if (source && !/^[a-z][a-z0-9+.-]*:/i.test(source)) return source
  return ""
}

export function createInteractiveBgmController(options = {}) {
  const documentObject = options.documentObject || globalThis.document
  const AudioConstructor = options.Audio || documentObject?.defaultView?.Audio || globalThis.Audio
  const resolveAssetUrl = options.resolveAssetUrl
  const globalBgm = normalizeInteractiveBgm(options.globalBgm)
  let masterVolume = boundedVolume(options.masterVolume ?? 100) / 100
  let muted = options.muted === true
  let unlocked = false
  let destroyed = false
  let requestedTrack = null
  let requestedIsSpecial = false
  let activeKey = ""
  let requestVersion = 0
  let boundaryTimer = null
  let runtimeDurationSeconds = null
  const positions = new Map()
  const schedule = options.setTimeout || globalThis.setTimeout
  const cancelSchedule = options.clearTimeout || globalThis.clearTimeout

  function createAudio() {
    const audio = typeof AudioConstructor === "function" ? new AudioConstructor() : documentObject?.createElement?.("audio")
    if (!audio) throw new Error("audio-unavailable")
    audio.preload = "auto"
    return audio
  }

  const audio = createAudio()

  function trackBounds(track) {
    let start = Math.max(0, Number(track?.startMs || 0) / 1000)
    const value = Number(track?.endMs)
    let end = Number.isFinite(value) && value > Number(track?.startMs || 0) ? value / 1000 : null
    const actualDuration = track === requestedTrack && Number.isFinite(runtimeDurationSeconds) && runtimeDurationSeconds > 0
      ? runtimeDurationSeconds
      : null
    if (actualDuration !== null) {
      if (start >= actualDuration || actualDuration - start < MIN_TRACK_RANGE_MS / 1000) start = 0
      if (end !== null) end = Math.min(end, actualDuration)
      if (end !== null && end - start < MIN_TRACK_RANGE_MS / 1000) {
        start = 0
        end = null
      }
    }
    return { start, end }
  }

  function trackStartSeconds(track) {
    return trackBounds(track).start
  }

  function trackEndSeconds(track) {
    return trackBounds(track).end
  }

  function usesManualLoop(track) {
    return trackStartSeconds(track) > 0 || trackEndSeconds(track) !== null
  }

  function boundedPosition(track, value) {
    const start = trackStartSeconds(track)
    const end = trackEndSeconds(track)
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < start || (end !== null && parsed >= end)) return start
    return parsed
  }

  function clearBoundaryTimer() {
    if (boundaryTimer !== null) cancelSchedule(boundaryTimer)
    boundaryTimer = null
  }

  function currentTimeOr(fallback = 0) {
    const currentTime = Number(audio.currentTime)
    return Number.isFinite(currentTime) ? currentTime : fallback
  }

  function applyLevel(track) {
    audio.muted = muted
    audio.volume = Math.min(1, Math.max(0, (track?.volume ?? DEFAULT_VOLUME) / 100 * masterVolume))
    audio.loop = track?.loop !== false && !usesManualLoop(track)
  }

  function pause({ reset = false } = {}) {
    clearBoundaryTimer()
    audio.pause?.()
    if (reset) {
      try { audio.currentTime = 0 } catch {}
    }
  }

  function scheduleBoundary(track = requestedTrack) {
    clearBoundaryTimer()
    const end = trackEndSeconds(track)
    if (end === null || !track?.source) return
    const remainingMs = Math.max(0, Math.round((end - currentTimeOr(trackStartSeconds(track))) * 1000))
    boundaryTimer = schedule(() => {
      boundaryTimer = null
      handleBoundary(track)
    }, remainingMs)
  }

  function handleBoundary(track = requestedTrack, { force = false } = {}) {
    if (destroyed || track !== requestedTrack || !track?.source) return
    const start = trackStartSeconds(track)
    const end = trackEndSeconds(track)
    if (!force && end !== null && currentTimeOr(start) < end - .08) {
      scheduleBoundary(track)
      return
    }
    if (track.loop !== false) {
      try { audio.currentTime = start } catch {}
      Promise.resolve(audio.play?.()).then(() => scheduleBoundary(track)).catch(() => {})
      return
    }
    if (end !== null) {
      try { audio.currentTime = end } catch {}
    }
    pause()
  }

  function handleLoadedMetadata() {
    if (!requestedTrack) return
    const actualDuration = Number(audio.duration)
    runtimeDurationSeconds = Number.isFinite(actualDuration) && actualDuration > 0 ? actualDuration : null
    const currentTime = Number(audio.currentTime)
    const next = boundedPosition(requestedTrack, currentTime)
    if (!Number.isFinite(currentTime) || next !== currentTime) {
      try { audio.currentTime = next } catch {}
    }
    if (unlocked && audio.paused !== true) scheduleBoundary(requestedTrack)
  }

  function handleTimeUpdate() {
    const end = trackEndSeconds(requestedTrack)
    const currentTime = Number(audio.currentTime)
    if (end !== null && Number.isFinite(currentTime) && currentTime >= end) handleBoundary(requestedTrack)
  }

  function handleEnded() {
    if (requestedTrack && usesManualLoop(requestedTrack)) handleBoundary(requestedTrack, { force:true })
  }

  audio.addEventListener?.("loadedmetadata", handleLoadedMetadata)
  audio.addEventListener?.("timeupdate", handleTimeUpdate)
  audio.addEventListener?.("ended", handleEnded)

  async function resolvedSource(source) {
    if (/^asset:\/\//i.test(source) && typeof resolveAssetUrl === "function") {
      return safeAudioSource(await resolveAssetUrl(source))
    }
    return safeAudioSource(source)
  }

  async function syncPlayback({ restart = false } = {}) {
    const version = ++requestVersion
    if (destroyed || !requestedTrack?.source) {
      activeKey = ""
      runtimeDurationSeconds = null
      pause({ reset:true })
      audio.removeAttribute?.("src")
      audio.load?.()
      return false
    }
    const track = requestedTrack
    const isSpecial = requestedIsSpecial
    const key = `${track.source}\u0000${track.fileName}\u0000${track.startMs}\u0000${track.endMs ?? ""}`
    if (key !== activeKey) pause()
    const source = await resolvedSource(track.source).catch(() => "")
    if (destroyed || version !== requestVersion) return false
    if (!source) {
      activeKey = ""
      runtimeDurationSeconds = null
      pause({ reset:true })
      audio.removeAttribute?.("src")
      audio.load?.()
      return false
    }
    const changed = key !== activeKey || audio.src !== source
    if (changed) {
      if (activeKey && Number.isFinite(Number(audio.currentTime))) {
        positions.set(activeKey, Math.max(0, Number(audio.currentTime)))
      }
      pause()
      activeKey = key
      runtimeDurationSeconds = null
      audio.src = source
      try {
        audio.currentTime = isSpecial && restart
          ? trackStartSeconds(track)
          : boundedPosition(track, positions.get(key))
      } catch {}
    } else if (restart) {
      try { audio.currentTime = trackStartSeconds(track) } catch {}
    }
    applyLevel(track)
    if (!unlocked) return false
    try {
      await audio.play?.()
      scheduleBoundary(track)
      return true
    } catch {
      return false
    }
  }

  function chooseTrack(stage) {
    const special = normalizeInteractiveBgm(stage?.bgm)
    return special.source ? special : (globalBgm.source ? globalBgm : null)
  }

  function setStage(stage, stageOptions = {}) {
    const specialTrack = normalizeInteractiveBgm(stage?.bgm)
    const next = chooseTrack(stage)
    const previousSource = requestedTrack?.source || ""
    requestedTrack = next
    const special = Boolean(specialTrack.source)
    requestedIsSpecial = special
    syncPlayback({ restart:special && (stageOptions.restart !== false || previousSource !== next?.source) })
    return special ? "special" : (next ? "global" : "silent")
  }

  function unlock() {
    if (destroyed) return Promise.resolve(false)
    unlocked = true
    return syncPlayback()
  }

  function setMuted(value) {
    muted = Boolean(value)
    applyLevel(requestedTrack)
    return muted
  }

  function setMasterVolume(value) {
    masterVolume = boundedVolume(value) / 100
    applyLevel(requestedTrack)
    return Math.round(masterVolume * 100)
  }

  function destroy() {
    destroyed = true
    requestVersion += 1
    pause({ reset:true })
    audio.removeEventListener?.("loadedmetadata", handleLoadedMetadata)
    audio.removeEventListener?.("timeupdate", handleTimeUpdate)
    audio.removeEventListener?.("ended", handleEnded)
    audio.removeAttribute?.("src")
    audio.load?.()
  }

  return Object.freeze({
    audio,
    setStage,
    unlock,
    setMuted,
    setMasterVolume,
    destroy,
    get mode() {
      if (!requestedTrack) return "silent"
      return requestedIsSpecial ? "special" : "global"
    },
  })
}
