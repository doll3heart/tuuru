import test from "node:test"
import assert from "node:assert/strict"

import {
  advanceVoicePlayback,
  createVoicePlaybackState,
  pauseVoicePlayback,
  playVoicePlayback,
  resetVoicePlayback,
  toggleVoiceTranscript,
  voicePlaybackProgress,
  voicePlaybackRemainingLabel,
} from "../reader/voice-playback.js"

test("voice playback normalizes duration without mutating prior states", () => {
  const idle = createVoicePlaybackState(6)
  const playing = playVoicePlayback(idle)
  const advanced = advanceVoicePlayback(playing, 2500)

  assert.deepEqual(idle, {
    durationMs: 6000,
    elapsedMs: 0,
    status: "idle",
    transcriptVisible: false,
  })
  assert.equal(playing.status, "playing")
  assert.equal(advanced.elapsedMs, 2500)
  assert.equal(advanced.status, "playing")
  assert.equal(idle.elapsedMs, 0)
  assert.equal(voicePlaybackProgress(advanced), 2500 / 6000)
  assert.equal(voicePlaybackRemainingLabel(advanced), "0:04")
})

test("voice playback pauses, completes, and replays from the beginning", () => {
  const playing = playVoicePlayback(createVoicePlaybackState(1))
  const paused = pauseVoicePlayback(advanceVoicePlayback(playing, 400))
  const unchanged = advanceVoicePlayback(paused, 900)
  const completed = advanceVoicePlayback(playVoicePlayback(paused), 900)
  const replaying = playVoicePlayback(completed)

  assert.equal(paused.status, "paused")
  assert.equal(unchanged.elapsedMs, 400)
  assert.equal(completed.status, "completed")
  assert.equal(completed.elapsedMs, 1000)
  assert.equal(voicePlaybackProgress(completed), 1)
  assert.equal(voicePlaybackRemainingLabel(completed), "0:00")
  assert.equal(replaying.status, "playing")
  assert.equal(replaying.elapsedMs, 0)
})

test("reset stops playback while transcript disclosure remains independent", () => {
  const visible = toggleVoiceTranscript(createVoicePlaybackState(65))
  const playing = advanceVoicePlayback(playVoicePlayback(visible), 3000)
  const reset = resetVoicePlayback(playing)

  assert.equal(visible.transcriptVisible, true)
  assert.equal(reset.status, "idle")
  assert.equal(reset.elapsedMs, 0)
  assert.equal(reset.transcriptVisible, true)
  assert.equal(voicePlaybackRemainingLabel(reset), "1:05")
  assert.equal(toggleVoiceTranscript(reset).transcriptVisible, false)
})

test("invalid duration and elapsed values fail closed to bounded playback", () => {
  assert.equal(createVoicePlaybackState(0).durationMs, 1000)
  assert.equal(createVoicePlaybackState(Number.POSITIVE_INFINITY).durationMs, 1000)
  assert.equal(createVoicePlaybackState(999999).durationMs, 359999000)

  const playing = playVoicePlayback(createVoicePlaybackState(2))
  assert.equal(advanceVoicePlayback(playing, -100).elapsedMs, 0)
  assert.equal(advanceVoicePlayback(playing, Number.NaN).elapsedMs, 0)
})
