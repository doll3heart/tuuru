const MIN_VOICE_DURATION_SECONDS = 1
const MAX_VOICE_DURATION_SECONDS = 359999

function normalizedDurationMs(durationSeconds) {
  const parsed = Number(durationSeconds)
  const seconds = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_VOICE_DURATION_SECONDS, Math.max(MIN_VOICE_DURATION_SECONDS, Math.round(parsed)))
    : MIN_VOICE_DURATION_SECONDS
  return seconds * 1000
}

export function createVoicePlaybackState(durationSeconds) {
  return {
    durationMs: normalizedDurationMs(durationSeconds),
    elapsedMs: 0,
    status: "idle",
    transcriptVisible: false,
  }
}

export function playVoicePlayback(state) {
  const replay = state.status === "completed"
  return {
    ...state,
    elapsedMs: replay ? 0 : state.elapsedMs,
    status: "playing",
  }
}

export function pauseVoicePlayback(state) {
  if (state.status !== "playing") return { ...state }
  return { ...state, status: "paused" }
}

export function advanceVoicePlayback(state, deltaMs) {
  if (state.status !== "playing") return { ...state }
  const safeDelta = Math.max(0, Number(deltaMs) || 0)
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + safeDelta)
  return {
    ...state,
    elapsedMs,
    status: elapsedMs >= state.durationMs ? "completed" : "playing",
  }
}

export function resetVoicePlayback(state) {
  return {
    ...state,
    elapsedMs: 0,
    status: "idle",
  }
}

export function toggleVoiceTranscript(state) {
  return {
    ...state,
    transcriptVisible: !state.transcriptVisible,
  }
}

export function voicePlaybackProgress(state) {
  if (!state || !Number.isFinite(state.durationMs) || state.durationMs <= 0) return 0
  return Math.min(1, Math.max(0, (Number(state.elapsedMs) || 0) / state.durationMs))
}

export function voicePlaybackRemainingLabel(state) {
  const durationMs = Number(state && state.durationMs) || 0
  const elapsedMs = Number(state && state.elapsedMs) || 0
  const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  return String(minutes) + ":" + String(seconds).padStart(2, "0")
}
