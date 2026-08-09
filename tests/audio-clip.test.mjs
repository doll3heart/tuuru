import test from "node:test"
import assert from "node:assert/strict"

import {
  audioClipDurationToleranceMs,
  chooseAudioRecorderProfile,
  createCompressedAudioClip,
  normalizeAudioRange,
  probeAudioBlob,
} from "../js/audio-clip.js"

test("output duration tolerance stays strict for long clips", () => {
  assert.equal(audioClipDurationToleranceMs(10_000), 750)
  assert.equal(audioClipDurationToleranceMs(300_000), 1_500)
})

test("audio ranges clamp to the source duration and keep a usable selection", () => {
  assert.deepEqual(normalizeAudioRange({ startMs:12_000, endMs:27_000 }, 180_000), {
    startMs:12_000,
    endMs:27_000,
    durationMs:15_000,
  })
  assert.deepEqual(normalizeAudioRange({ startMs:-50, endMs:999_999 }, 180_000), {
    startMs:0,
    endMs:180_000,
    durationMs:180_000,
  })
  assert.deepEqual(normalizeAudioRange({ startMs:179_900, endMs:20 }, 180_000), {
    startMs:179_500,
    endMs:180_000,
    durationMs:500,
  })
  assert.deepEqual(normalizeAudioRange({ startMs:12_000, endMs:10_000 }, 180_000), {
    startMs:12_000,
    endMs:12_500,
    durationMs:500,
  })
})

test("recorder profile selection is capability based and prefers portable Opus", () => {
  class FakeRecorder {
    static isTypeSupported(type) {
      return type === "audio/ogg;codecs=opus" || type === "audio/mp4"
    }
  }
  assert.deepEqual(chooseAudioRecorderProfile(FakeRecorder), {
    mimeType:"audio/ogg;codecs=opus",
    extension:"ogg",
    audioBitsPerSecond:96_000,
  })
  assert.equal(chooseAudioRecorderProfile(null), null)
})

test("a playable WebM without container duration falls back to decoded audio duration", async () => {
  const revoked = []
  const controller = new AbortController()
  const abortTimeout = setTimeout(() => controller.abort(), 100)
  class InfiniteDurationAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = Infinity
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    pause() {}
    removeAttribute() {}
  }
  class DecodeContext {
    async decodeAudioData() { return { duration:15.04 } }
    async close() {}
  }
  let result
  try {
    result = await probeAudioBlob(new Blob(["durationless-webm"], { type:"audio/webm" }), {
      Audio:InfiniteDurationAudio,
      AudioContext:DecodeContext,
      URL:{
        createObjectURL() { return "blob:durationless" },
        revokeObjectURL(value) { revoked.push(value) },
      },
      setTimeout() { return 1 },
      clearTimeout() {},
    }, controller.signal)
  } finally {
    clearTimeout(abortTimeout)
  }

  assert.equal(result.durationMs, 15_040)
  assert.deepEqual(revoked, ["blob:durationless"])
})

test("aborting during metadata loading immediately releases the clipping pipeline", async () => {
  const controller = new AbortController()
  const revoked = []
  let closed = 0
  class PendingAudio {
    constructor() { this.listeners = new Map(); this.duration = NaN }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) { this._src = value }
    load() {}
    pause() {}
    removeAttribute() {}
  }
  class PendingContext {
    async resume() {}
    async close() { closed += 1 }
  }
  class UnusedRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
  }

  const pending = createCompressedAudioClip(
    new Blob(["pending"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000, signal:controller.signal },
    {
      Audio:PendingAudio,
      AudioContext:PendingContext,
      MediaRecorder:UnusedRecorder,
      URL:{
        createObjectURL() { return "blob:pending" },
        revokeObjectURL(value) { revoked.push(value) },
      },
    },
  )
  await Promise.resolve()
  controller.abort()

  await assert.rejects(pending, error => error?.name === "AbortError")
  assert.equal(closed, 1)
  assert.deepEqual(revoked, ["blob:pending"])
})

test("aborting a pending AudioContext resume immediately releases resources", async () => {
  const controller = new AbortController()
  const revoked = []
  let closed = 0
  class ResumeAudio {
    pause() {}
    removeAttribute() {}
    load() {}
  }
  class PendingResumeContext {
    resume() { return new Promise(() => {}) }
    async close() { closed += 1 }
  }
  class ResumeRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
  }

  const pending = createCompressedAudioClip(
    new Blob(["resume-source"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000, signal:controller.signal },
    {
      Audio:ResumeAudio,
      AudioContext:PendingResumeContext,
      MediaRecorder:ResumeRecorder,
      URL:{
        createObjectURL:() => "blob:resume",
        revokeObjectURL(value) { revoked.push(value) },
      },
    },
  )
  await Promise.resolve()
  controller.abort()
  let deadline
  try {
    await Promise.race([
      assert.rejects(pending, error => error?.name === "AbortError"),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("resume abort timed out")), 100) }),
    ])
  } finally {
    clearTimeout(deadline)
  }
  assert.equal(closed, 1)
  assert.deepEqual(revoked, ["blob:resume"])
})

test("aborting while recording preserves AbortError and stops the media pipeline", async () => {
  const controller = new AbortController()
  let recorderInstance = null
  let closed = 0
  class RecordingAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = 10
      this.currentTime = 0
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    async play() {}
    pause() {}
    removeAttribute() {}
  }
  class RecordingContext {
    async resume() {}
    createMediaElementSource() { return { connect() {}, disconnect() {} } }
    createMediaStreamDestination() { return { stream:{ getTracks:() => [] } } }
    async close() { closed += 1 }
  }
  class RecordingRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor() {
      recorderInstance = this
      this.listeners = new Map()
      this.state = "inactive"
      this.mimeType = "audio/webm;codecs=opus"
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() {
      this.state = "inactive"
      queueMicrotask(() => this.listeners.get("stop")?.())
    }
  }

  const pending = createCompressedAudioClip(
    new Blob(["recording-source"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000, signal:controller.signal },
    {
      Audio:RecordingAudio,
      AudioContext:RecordingContext,
      MediaRecorder:RecordingRecorder,
      URL:{ createObjectURL:() => "blob:recording", revokeObjectURL() {} },
      setTimeout() { return 1 },
      clearTimeout() {},
      setInterval() { return 1 },
      clearInterval() {},
    },
  )
  for (let index = 0; index < 16 && recorderInstance?.state !== "recording"; index += 1) await Promise.resolve()
  assert.equal(recorderInstance?.state, "recording")

  controller.abort()
  await assert.rejects(pending, error => error?.name === "AbortError")
  assert.equal(recorderInstance.state, "inactive")
  assert.equal(closed, 1)
})

test("aborting a pending audio play does not leave the recording pipeline open", async () => {
  const controller = new AbortController()
  let recorderInstance = null
  let closed = 0
  class PendingPlayAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = 10
      this.currentTime = 0
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    play() { return new Promise(() => {}) }
    pause() {}
    removeAttribute() {}
  }
  class PendingPlayContext {
    async resume() {}
    createMediaElementSource() { return { connect() {}, disconnect() {} } }
    createMediaStreamDestination() { return { stream:{ getTracks:() => [] } } }
    async close() { closed += 1 }
  }
  class PendingPlayRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor() {
      recorderInstance = this
      this.listeners = new Map()
      this.state = "inactive"
      this.mimeType = "audio/webm;codecs=opus"
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() {
      this.state = "inactive"
      queueMicrotask(() => this.listeners.get("stop")?.())
    }
  }

  const pending = createCompressedAudioClip(
    new Blob(["play-source"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000, signal:controller.signal },
    {
      Audio:PendingPlayAudio,
      AudioContext:PendingPlayContext,
      MediaRecorder:PendingPlayRecorder,
      URL:{ createObjectURL:() => "blob:play", revokeObjectURL() {} },
      setTimeout() { return 1 },
      clearTimeout() {},
      setInterval() { return 1 },
      clearInterval() {},
    },
  )
  for (let index = 0; index < 16 && recorderInstance?.state !== "recording"; index += 1) await Promise.resolve()
  assert.equal(recorderInstance?.state, "recording")
  controller.abort()
  let deadline
  try {
    await Promise.race([
      assert.rejects(pending, error => error?.name === "AbortError"),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("play abort timed out")), 100) }),
    ])
  } finally {
    clearTimeout(deadline)
  }
  assert.equal(recorderInstance.state, "inactive")
  assert.equal(closed, 1)
})

test("aborting duration decode preserves AbortError instead of the earlier metadata error", async () => {
  const controller = new AbortController()
  let closed = 0
  class BrokenMetadataAudio {
    constructor() { this.listeners = new Map(); this.duration = Infinity }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    pause() {}
    removeAttribute() {}
  }
  class PendingDecodeContext {
    decodeAudioData() { return new Promise(() => {}) }
    async close() { closed += 1 }
  }
  const pending = probeAudioBlob(new Blob(["pending-decode"], { type:"audio/webm" }), {
    Audio:BrokenMetadataAudio,
    AudioContext:PendingDecodeContext,
    URL:{ createObjectURL() { return "blob:decode" }, revokeObjectURL() {} },
  }, controller.signal)
  await new Promise(resolve => setTimeout(resolve, 0))
  controller.abort()

  await assert.rejects(pending, error => error?.name === "AbortError")
  assert.equal(closed, 1)
})

test("an explicit media playback error is never rescued by decoder-only support", async () => {
  let decodeCount = 0
  class MediaErrorAudio {
    constructor() { this.listeners = new Map(); this.duration = Number.NaN }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("error")?.({ type:"error" }))
    }
    load() {}
    pause() {}
    removeAttribute() {}
  }
  class DecoderOnlyContext {
    async decodeAudioData() { decodeCount += 1; return { duration:15 } }
    async close() {}
  }

  await assert.rejects(probeAudioBlob(new Blob(["decoder-only"], { type:"audio/x-unsupported" }), {
    Audio:MediaErrorAudio,
    AudioContext:DecoderOnlyContext,
    URL:{ createObjectURL:() => "blob:decoder-only", revokeObjectURL() {} },
  }), /无法播放|不受支持/)
  assert.equal(decodeCount, 0)
})

test("compressed clipping records only the selected interval and validates the result", async () => {
  const urls = []
  const revoked = []
  const scheduled = []
  const tracks = [{ stopCount:0, stop() { this.stopCount += 1 } }]
  let audioIndex = 0

  class FakeAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = audioIndex++ === 0 ? Infinity : 15
      this.currentTime = 0
      this.preload = ""
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    dispatch(type) { this.listeners.get(type)?.({ type }) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.dispatch("loadedmetadata"))
    }
    get src() { return this._src || "" }
    load() {}
    async play() {
      this.played = true
      this.currentTime = 27
    }
    pause() { this.paused = true }
    removeAttribute(name) { if (name === "src") this._src = "" }
  }

  class FakeAudioContext {
    constructor() { this.state = "suspended" }
    async resume() { this.state = "running" }
    async decodeAudioData() { return { duration:180 } }
    createMediaElementSource(audio) {
      return { audio, connect() {}, disconnect() {} }
    }
    createMediaStreamDestination() {
      return { stream:{ getTracks:() => tracks } }
    }
    async close() { this.state = "closed" }
  }

  class FakeMediaRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor(stream, options) {
      this.stream = stream
      this.mimeType = options.mimeType
      this.state = "inactive"
      this.listeners = new Map()
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() {
      this.state = "inactive"
      this.listeners.get("dataavailable")?.({ data:new Blob(["compressed"], { type:this.mimeType }) })
      queueMicrotask(() => this.listeners.get("stop")?.())
    }
  }

  const result = await createCompressedAudioClip(
    new Blob(["source-audio"], { type:"audio/mpeg" }),
    { startMs:12_000, endMs:27_000, fileName:"漫长夜晚.mp3" },
    {
      Audio:FakeAudio,
      AudioContext:FakeAudioContext,
      MediaRecorder:FakeMediaRecorder,
      URL:{
        createObjectURL(value) { const url = `blob:test-${urls.length}`; urls.push({ url, value }); return url },
        revokeObjectURL(value) { revoked.push(value) },
      },
      setTimeout(callback, delay) {
        scheduled.push(delay)
        if (delay === 15_000) queueMicrotask(callback)
        return scheduled.length
      },
      clearTimeout() {},
      setInterval(callback) { queueMicrotask(callback); return 1 },
      clearInterval() {},
    },
  )

  assert.ok(scheduled.includes(1_000))
  assert.equal(result.durationMs, 15_000)
  assert.equal(result.type, "audio/webm;codecs=opus")
  assert.equal(result.fileName, "漫长夜晚-片段.webm")
  assert.equal(result.mode, "encoded")
  assert.ok(result.bytes > 0)
  assert.equal(tracks[0].stopCount, 1)
  assert.deepEqual(revoked.sort(), ["blob:test-0", "blob:test-1"])
})

test("recording stops at the selected media time instead of an early wall-clock callback", async () => {
  let sourceAudio = null
  let audioIndex = 0
  let recorderInstance = null
  let progressTick = null
  const progress = []
  const timers = []
  class ClockAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = audioIndex++ === 0 ? 10 : 2
      this.currentTime = 0
      this.paused = true
      if (!sourceAudio) sourceAudio = this
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    async play() { this.paused = false }
    pause() { this.paused = true }
    removeAttribute() {}
  }
  class ClockContext {
    async resume() {}
    createMediaElementSource() { return { connect() {}, disconnect() {} } }
    createMediaStreamDestination() { return { stream:{ getTracks:() => [] } } }
    async close() {}
  }
  class ClockRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor() {
      recorderInstance = this
      this.listeners = new Map()
      this.state = "inactive"
      this.mimeType = "audio/webm;codecs=opus"
      this.stopCount = 0
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() {
      this.stopCount += 1
      this.state = "inactive"
      this.listeners.get("dataavailable")?.({ data:new Blob(["clip"], { type:this.mimeType }) })
      queueMicrotask(() => this.listeners.get("stop")?.())
    }
  }

  const pending = createCompressedAudioClip(
    new Blob(["long-source"], { type:"audio/mpeg" }),
    {
      startMs:2_000,
      endMs:4_000,
      onProgress(value) { progress.push(value) },
    },
    {
      Audio:ClockAudio,
      AudioContext:ClockContext,
      MediaRecorder:ClockRecorder,
      URL:{ createObjectURL:() => "blob:clock", revokeObjectURL() {} },
      setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length },
      clearTimeout() {},
      setInterval(callback) { progressTick = callback; return 1 },
      clearInterval() {},
    },
  )
  for (let index = 0; index < 16 && !timers.some(timer => timer.delay < 5_000); index += 1) await Promise.resolve()
  assert.equal(recorderInstance.state, "recording")

  sourceAudio.currentTime = Number.NaN
  progressTick()
  assert.ok(Number.isFinite(progress.at(-1).elapsedMs))
  assert.ok(Number.isFinite(progress.at(-1).ratio))

  sourceAudio.currentTime = 2.5
  timers.find(timer => timer.delay < 5_000).callback()
  assert.equal(recorderInstance.stopCount, 0, "a delayed page timer must not cut the selected content short")

  sourceAudio.currentTime = 4
  progressTick()
  const result = await pending
  assert.equal(recorderInstance.stopCount, 1)
  assert.equal(result.durationMs, 2_000)
})

test("a recorder stop exception settles once and releases media resources", async () => {
  let stopCount = 0
  let closed = 0
  const tracks = [{ stopCount:0, stop() { this.stopCount += 1 } }]
  class StopErrorAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = 10
      this.currentTime = 0
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    async play() { this.currentTime = 5 }
    pause() {}
    removeAttribute() {}
  }
  class StopErrorContext {
    async resume() {}
    createMediaElementSource() { return { connect() {}, disconnect() {} } }
    createMediaStreamDestination() { return { stream:{ getTracks:() => tracks } } }
    async close() { closed += 1 }
  }
  class StopErrorRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor() {
      this.listeners = new Map()
      this.state = "inactive"
      this.mimeType = "audio/webm;codecs=opus"
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() { stopCount += 1; throw new Error("stop exploded") }
  }

  await assert.rejects(createCompressedAudioClip(
    new Blob(["stop-error"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000 },
    {
      Audio:StopErrorAudio,
      AudioContext:StopErrorContext,
      MediaRecorder:StopErrorRecorder,
      URL:{ createObjectURL:() => "blob:stop-error", revokeObjectURL() {} },
      setTimeout() { return 1 },
      clearTimeout() {},
      setInterval(callback) { queueMicrotask(callback); return 1 },
      clearInterval() {},
    },
  ), /stop exploded/)
  assert.equal(stopCount, 1)
  assert.equal(tracks[0].stopCount, 1)
  assert.equal(closed, 1)
})

test("a recorder missing its stop event rejects after the confirmation timeout", async () => {
  let closed = 0
  const tracks = [{ stopCount:0, stop() { this.stopCount += 1 } }]
  const timers = []
  class MissingStopAudio {
    constructor() {
      this.listeners = new Map()
      this.duration = 10
      this.currentTime = 0
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    set src(value) {
      this._src = value
      queueMicrotask(() => this.listeners.get("loadedmetadata")?.({ type:"loadedmetadata" }))
    }
    load() {}
    async play() { this.currentTime = 5 }
    pause() {}
    removeAttribute() {}
  }
  class MissingStopContext {
    async resume() {}
    createMediaElementSource() { return { connect() {}, disconnect() {} } }
    createMediaStreamDestination() { return { stream:{ getTracks:() => tracks } } }
    async close() { closed += 1 }
  }
  class MissingStopRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus" }
    constructor() {
      this.listeners = new Map()
      this.state = "inactive"
      this.mimeType = "audio/webm;codecs=opus"
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    start() { this.state = "recording" }
    stop() { this.state = "inactive" }
  }

  const pending = createCompressedAudioClip(
    new Blob(["missing-stop"], { type:"audio/mpeg" }),
    { startMs:0, endMs:5_000 },
    {
      Audio:MissingStopAudio,
      AudioContext:MissingStopContext,
      MediaRecorder:MissingStopRecorder,
      URL:{ createObjectURL:() => "blob:missing-stop", revokeObjectURL() {} },
      setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length },
      clearTimeout() {},
      setInterval(callback) { queueMicrotask(callback); return 1 },
      clearInterval() {},
    },
  )
  for (let index = 0; index < 16 && !timers.some(timer => timer.delay === 3_000); index += 1) await Promise.resolve()
  timers.find(timer => timer.delay === 3_000).callback()

  await assert.rejects(pending, /没有完成音频编码/)
  assert.equal(tracks[0].stopCount, 1)
  assert.equal(closed, 1)
})
