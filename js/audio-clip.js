const MIN_AUDIO_CLIP_MS = 500
const MAX_AUDIO_CLIP_MS = 5 * 60 * 1000
const DEFAULT_AUDIO_BITRATE = 96_000

function finiteInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeAudioRange(value, sourceDurationMs) {
  const total = Math.max(0, finiteInteger(sourceDurationMs))
  if (!total) return { startMs:0, endMs:0, durationMs:0 }
  if (total <= MIN_AUDIO_CLIP_MS) return { startMs:0, endMs:total, durationMs:total }

  let startMs = clamp(finiteInteger(value?.startMs), 0, total)
  let endMs = value?.endMs === null || value?.endMs === undefined || value?.endMs === ""
    ? total
    : clamp(finiteInteger(value.endMs, total), 0, total)
  if (endMs - startMs < MIN_AUDIO_CLIP_MS) {
    endMs = Math.min(total, startMs + MIN_AUDIO_CLIP_MS)
    if (endMs - startMs < MIN_AUDIO_CLIP_MS) startMs = Math.max(0, endMs - MIN_AUDIO_CLIP_MS)
  }
  return { startMs, endMs, durationMs:endMs - startMs }
}

const RECORDER_PROFILES = Object.freeze([
  Object.freeze({ mimeType:"audio/webm;codecs=opus", extension:"webm", audioBitsPerSecond:DEFAULT_AUDIO_BITRATE }),
  Object.freeze({ mimeType:"audio/ogg;codecs=opus", extension:"ogg", audioBitsPerSecond:DEFAULT_AUDIO_BITRATE }),
  Object.freeze({ mimeType:"audio/mp4;codecs=mp4a.40.2", extension:"m4a", audioBitsPerSecond:DEFAULT_AUDIO_BITRATE }),
  Object.freeze({ mimeType:"audio/mp4", extension:"m4a", audioBitsPerSecond:DEFAULT_AUDIO_BITRATE }),
])

export function chooseAudioRecorderProfile(MediaRecorderConstructor = globalThis.MediaRecorder) {
  if (typeof MediaRecorderConstructor !== "function") return null
  if (typeof MediaRecorderConstructor.isTypeSupported !== "function") {
    return { mimeType:"", extension:"webm", audioBitsPerSecond:DEFAULT_AUDIO_BITRATE }
  }
  const profile = RECORDER_PROFILES.find(candidate => {
    try { return MediaRecorderConstructor.isTypeSupported(candidate.mimeType) }
    catch { return false }
  })
  return profile ? { ...profile } : null
}

export function audioClipDurationToleranceMs(durationMs) {
  return Math.max(750, Math.min(1_500, Math.round(Math.max(0, Number(durationMs) || 0) * .02)))
}

function extensionForMimeType(value, fallback = "webm") {
  const type = String(value || "").toLowerCase()
  if (type.includes("ogg")) return "ogg"
  if (type.includes("mp4") || type.includes("aac")) return "m4a"
  if (type.includes("webm")) return "webm"
  return fallback
}

function clippedFileName(value, extension) {
  const source = String(value || "BGM").replace(/\.[^.]+$/, "").trim() || "BGM"
  return `${source}-片段.${extension}`
}

function audioConstructor(environment) {
  return environment.Audio || globalThis.Audio
}

function createAudio(environment) {
  const AudioConstructor = audioConstructor(environment)
  const audio = typeof AudioConstructor === "function"
    ? new AudioConstructor()
    : environment.documentObject?.createElement?.("audio")
  if (!audio) throw new Error("当前浏览器无法读取音频")
  audio.preload = "metadata"
  return audio
}

function timerApi(environment) {
  const timer = name => {
    const owner = typeof environment[name] === "function" ? environment : globalThis
    return (...args) => owner[name](...args)
  }
  return {
    setTimeout:timer("setTimeout"),
    clearTimeout:timer("clearTimeout"),
    setInterval:timer("setInterval"),
    clearInterval:timer("clearInterval"),
  }
}

function waitForAudioMetadata(audio, environment, timeoutMs = 10_000, signal) {
  const timers = timerApi(environment)
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    let settled = false
    let timeout = null
    const cleanup = () => {
      if (timeout !== null) timers.clearTimeout(timeout)
      audio.removeEventListener?.("loadedmetadata", loaded)
      audio.removeEventListener?.("durationchange", loaded)
      audio.removeEventListener?.("error", failed)
      signal?.removeEventListener?.("abort", aborted)
    }
    const finish = callback => value => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    const loaded = () => {
      const duration = Number(audio.duration)
      if (duration === Infinity) {
        const error = new Error("音频容器没有提供有限时长")
        error.name = "AudioDurationUnavailableError"
        finish(reject)(error)
        return
      }
      if (!Number.isFinite(duration) || duration <= 0) return
      finish(resolve)(Math.round(duration * 1000))
    }
    const failed = finish(() => reject(new Error("音频无法播放或格式不受支持")))
    const timedOut = finish(() => {
      const error = new Error("音频时长读取超时")
      error.name = "AudioMetadataTimeoutError"
      reject(error)
    })
    const aborted = finish(() => reject(abortError()))
    audio.addEventListener?.("loadedmetadata", loaded)
    audio.addEventListener?.("durationchange", loaded)
    audio.addEventListener?.("error", failed)
    signal?.addEventListener?.("abort", aborted, { once:true })
    timeout = timers.setTimeout(timedOut, timeoutMs)
  })
}

function revokeAudio(audio, sourceUrl, URLObject) {
  try { audio.pause?.() } catch {}
  try {
    audio.removeAttribute?.("src")
    audio.load?.()
  } catch {}
  if (sourceUrl && typeof URLObject?.revokeObjectURL === "function") {
    try { URLObject.revokeObjectURL(sourceUrl) } catch {}
  }
}

function decodeAudioData(context, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = callback => value => {
      if (settled) return
      settled = true
      callback(value)
    }
    try {
      const pending = context.decodeAudioData(bytes, finish(resolve), finish(reject))
      pending?.then?.(finish(resolve), finish(reject))
    } catch (error) {
      finish(reject)(error)
    }
  })
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError()
}

function raceWithAbort(promise, signal) {
  if (!signal) return Promise.resolve(promise)
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = callback => value => {
      if (settled) return
      settled = true
      signal.removeEventListener?.("abort", aborted)
      callback(value)
    }
    const aborted = finish(() => reject(abortError()))
    signal.addEventListener?.("abort", aborted, { once:true })
    Promise.resolve(promise).then(finish(resolve), finish(reject))
  })
}

async function decodeAudioBlobDuration(blob, environment, signal) {
  throwIfAborted(signal)
  const ContextConstructor = audioContextConstructor(environment)
  if (typeof ContextConstructor !== "function") throw new Error("当前浏览器无法确认音频时长")
  const context = new ContextConstructor()
  try {
    const bytes = await raceWithAbort(blob.arrayBuffer(), signal)
    throwIfAborted(signal)
    const decoded = await raceWithAbort(decodeAudioData(context, bytes), signal)
    throwIfAborted(signal)
    const durationMs = Math.round(Number(decoded?.duration) * 1000)
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("音频时长无效")
    return durationMs
  } finally {
    try { await context.close?.() } catch {}
  }
}

async function resolveAudioBlobDuration(blob, metadataPromise, environment, signal) {
  try {
    return await metadataPromise
  } catch (metadataError) {
    if (metadataError?.name === "AbortError") throw metadataError
    if (!["AudioDurationUnavailableError", "AudioMetadataTimeoutError"].includes(metadataError?.name)) throw metadataError
    try {
      return await decodeAudioBlobDuration(blob, environment, signal)
    } catch (decodeError) {
      if (decodeError?.name === "AbortError") throw decodeError
      throw metadataError
    }
  }
}

export async function probeAudioBlob(blob, environment = {}, signal) {
  if (!blob || typeof blob.arrayBuffer !== "function") throw new TypeError("本地音频文件无效")
  const URLObject = environment.URL || globalThis.URL
  if (typeof URLObject?.createObjectURL !== "function") throw new Error("当前浏览器无法读取本地音频")
  const audio = createAudio(environment)
  const sourceUrl = URLObject.createObjectURL(blob)
  try {
    const metadata = waitForAudioMetadata(audio, environment, 10_000, signal)
    audio.src = sourceUrl
    audio.load?.()
    const durationMs = await resolveAudioBlobDuration(blob, metadata, environment, signal)
    return {
      durationMs,
      bytes:Number(blob.size) || 0,
      type:String(blob.type || "application/octet-stream"),
    }
  } finally {
    revokeAudio(audio, sourceUrl, URLObject)
  }
}

export async function probeAudioUrl(source, environment = {}) {
  const url = String(source || "").trim()
  if (!url) throw new TypeError("音频链接为空")
  if (!/^https:\/\//i.test(url)) throw new TypeError("请填写 HTTPS 音频直链")
  const audio = createAudio(environment)
  try {
    const metadata = waitForAudioMetadata(audio, environment)
    audio.src = url
    audio.load?.()
    try {
      return { durationMs:await metadata, bytes:0, type:"" }
    } catch (error) {
      if (error?.name === "AudioMetadataTimeoutError") {
        throw new Error("音乐链接读取超时，请确认它是公开可访问的 HTTPS 音频直链，而不是分享页")
      }
      throw new Error("无法读取音乐链接，请确认它是公开可访问的 HTTPS 音频直链")
    }
  } finally {
    revokeAudio(audio, "", null)
  }
}

function recorderOptions(profile) {
  const options = { audioBitsPerSecond:profile.audioBitsPerSecond }
  if (profile.mimeType) options.mimeType = profile.mimeType
  return options
}

function audioContextConstructor(environment) {
  return environment.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext
}

function waitForSeek(audio, targetSeconds, environment, signal) {
  if (signal?.aborted) return Promise.reject(abortError())
  try { audio.currentTime = targetSeconds } catch (error) { return Promise.reject(error) }
  if (!audio.seeking && Math.abs(Number(audio.currentTime) - targetSeconds) <= .05) return Promise.resolve()
  const timers = timerApi(environment)
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = callback => value => {
      if (settled) return
      settled = true
      timers.clearTimeout(timeout)
      audio.removeEventListener?.("seeked", seeked)
      audio.removeEventListener?.("error", failed)
      signal?.removeEventListener?.("abort", aborted)
      callback(value)
    }
    const seeked = finish(resolve)
    const failed = finish(() => reject(new Error("无法定位到所选音频片段")))
    const aborted = finish(() => reject(abortError()))
    const timeout = timers.setTimeout(failed, 10_000)
    audio.addEventListener?.("seeked", seeked)
    audio.addEventListener?.("error", failed)
    signal?.addEventListener?.("abort", aborted, { once:true })
  })
}

function stopMediaTracks(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try { track.stop?.() } catch {}
  }
}

function abortError() {
  const error = new Error("已取消音频裁剪")
  error.name = "AbortError"
  return error
}

function audioPermissionError(error) {
  if (error?.name !== "NotAllowedError") return error
  const wrapped = new Error("浏览器需要授权音频处理，请再次点击“裁剪并只保留这段”")
  wrapped.name = "NotAllowedError"
  return wrapped
}

export function prepareAudioClipSession(environment = {}) {
  const ContextConstructor = audioContextConstructor(environment)
  if (typeof ContextConstructor !== "function") {
    throw new Error("当前浏览器不支持压缩音频裁剪；仍可只设置播放片段")
  }
  const context = new ContextConstructor()
  let closed = false
  let resumePromise
  try { resumePromise = Promise.resolve(context.resume?.()) }
  catch (error) { resumePromise = Promise.reject(error) }
  resumePromise.catch(() => {})
  return Object.freeze({
    context,
    resumePromise,
    async close() {
      if (closed) return
      closed = true
      try { await context.close?.() } catch {}
    },
  })
}

export async function createCompressedAudioClip(blob, options = {}, environment = {}) {
  if (!blob || typeof blob.arrayBuffer !== "function") throw new TypeError("本地音频文件无效")
  if (options.signal?.aborted) throw abortError()
  const MediaRecorderConstructor = environment.MediaRecorder || globalThis.MediaRecorder
  const ContextConstructor = audioContextConstructor(environment)
  const preparedSession = options.preparedSession
  const profile = chooseAudioRecorderProfile(MediaRecorderConstructor)
  if (!profile || (!preparedSession?.context && typeof ContextConstructor !== "function")) {
    throw new Error("当前浏览器不支持压缩音频裁剪；仍可只设置播放片段")
  }

  const URLObject = environment.URL || globalThis.URL
  const BlobConstructor = environment.Blob || globalThis.Blob
  if (typeof URLObject?.createObjectURL !== "function" || typeof BlobConstructor !== "function") {
    throw new Error("当前浏览器无法生成裁剪音频")
  }

  const timers = timerApi(environment)
  const audio = createAudio(environment)
  const sourceUrl = URLObject.createObjectURL(blob)
  const context = preparedSession?.context || new ContextConstructor()
  let mediaSource = null
  let destination = null
  let recorder = null
  let stopTimer = null
  let progressTimer = null
  let recorderStopTimer = null
  let abortListener = null
  let endedListener = null
  let recordingSettled = false
  let stopRequested = false
  let rejectRecording = null
  let cleanupRecorderListeners = () => {}
  const stopRecording = error => {
    try { audio.pause?.() } catch {}
    if (error) rejectRecording?.(error)
    if (!recorder || stopRequested) return
    if (recorder.state === "inactive") {
      if (!error && !recordingSettled) rejectRecording?.(new Error("浏览器提前停止了音频编码，请重试"))
      return
    }
    stopRequested = true
    try {
      recorder.stop()
      if (!error && !recordingSettled) {
        if (recorderStopTimer !== null) timers.clearTimeout(recorderStopTimer)
        recorderStopTimer = timers.setTimeout(() => {
          rejectRecording?.(new Error("浏览器没有完成音频编码，请重试"))
        }, 3_000)
      }
    } catch (stopError) {
      rejectRecording?.(stopError)
    }
  }
  abortListener = () => stopRecording(abortError())
  options.signal?.addEventListener?.("abort", abortListener, { once:true })
  try {
    throwIfAborted(options.signal)
    try { await raceWithAbort(preparedSession?.resumePromise || context.resume?.(), options.signal) }
    catch (error) { throw audioPermissionError(error) }
    throwIfAborted(options.signal)
    const sourceMetadata = waitForAudioMetadata(audio, environment, 10_000, options.signal)
    audio.src = sourceUrl
    audio.load?.()
    const sourceDurationMs = await resolveAudioBlobDuration(blob, sourceMetadata, environment, options.signal)
    throwIfAborted(options.signal)
    const range = normalizeAudioRange(options, sourceDurationMs)
    if (range.durationMs > MAX_AUDIO_CLIP_MS) {
      throw new RangeError("单次最多裁剪 5 分钟音频，请缩短所选片段")
    }
    await waitForSeek(audio, range.startMs / 1000, environment, options.signal)
    throwIfAborted(options.signal)

    mediaSource = context.createMediaElementSource(audio)
    destination = context.createMediaStreamDestination()
    mediaSource.connect(destination)
    recorder = new MediaRecorderConstructor(destination.stream, recorderOptions(profile))
    const chunks = []
    const recording = new Promise((resolve, reject) => {
      cleanupRecorderListeners = () => {
        recorder.removeEventListener?.("dataavailable", onData)
        recorder.removeEventListener?.("stop", onStop)
        recorder.removeEventListener?.("error", onError)
      }
      const settle = callback => value => {
        if (recordingSettled) return
        recordingSettled = true
        if (recorderStopTimer !== null) timers.clearTimeout(recorderStopTimer)
        recorderStopTimer = null
        cleanupRecorderListeners()
        callback(value)
      }
      const onData = event => {
        if (event?.data?.size) chunks.push(event.data)
      }
      const onStop = settle(resolve)
      const onError = event => settle(reject)(event?.error || new Error("音频编码失败"))
      rejectRecording = settle(reject)
      recorder.addEventListener?.("dataavailable", onData)
      recorder.addEventListener?.("stop", onStop)
      recorder.addEventListener?.("error", onError)
    })
    recording.catch(() => {})
    endedListener = () => stopRecording()
    audio.addEventListener?.("ended", endedListener, { once:true })
    recorder.start()
    try { await raceWithAbort(audio.play?.(), options.signal) }
    catch (error) { throw audioPermissionError(error) }
    const endSeconds = range.endMs / 1000
    let lastMediaTime = Number(audio.currentTime || range.startMs / 1000)
    let lastAdvanceAt = Date.now()
    const checkMediaBoundary = () => {
      const currentTime = Number(audio.currentTime)
      if (Number.isFinite(currentTime) && currentTime > lastMediaTime + .005) {
        lastMediaTime = currentTime
        lastAdvanceAt = Date.now()
      }
      const effectiveCurrentTime = Number.isFinite(currentTime) ? currentTime : lastMediaTime
      const elapsedMs = Math.min(range.durationMs, Math.max(0, (effectiveCurrentTime - range.startMs / 1000) * 1000))
      options.onProgress?.({ elapsedMs, durationMs:range.durationMs, ratio:elapsedMs / range.durationMs })
      if (Number.isFinite(currentTime) && currentTime >= endSeconds - .02) stopRecording()
    }
    const watchdog = () => {
      stopTimer = null
      if (recordingSettled || recorder?.state === "inactive") return
      checkMediaBoundary()
      if (recordingSettled || recorder?.state === "inactive") return
      const documentObject = environment.documentObject || globalThis.document
      if (documentObject?.visibilityState === "hidden") {
        stopRecording(new Error("页面进入后台，裁剪已停止；原音频仍保留"))
        return
      }
      if (Date.now() - lastAdvanceAt > 5_000) {
        stopRecording(new Error("音频播放中断，裁剪已停止；原音频仍保留"))
        return
      }
      stopTimer = timers.setTimeout(watchdog, 1_000)
    }
    progressTimer = timers.setInterval(checkMediaBoundary, 100)
    stopTimer = timers.setTimeout(watchdog, 1_000)
    await recording
    if (options.signal?.aborted) throw abortError()

    const recordedType = String(recorder.mimeType || chunks[0]?.type || profile.mimeType || "audio/webm")
    const output = new BlobConstructor(chunks, { type:recordedType })
    if (!output.size) throw new Error("浏览器没有生成有效的裁剪音频")
    const verified = await probeAudioBlob(output, environment, options.signal)
    throwIfAborted(options.signal)
    const toleranceMs = audioClipDurationToleranceMs(range.durationMs)
    if (Math.abs(verified.durationMs - range.durationMs) > toleranceMs) {
      throw new Error("裁剪结果时长异常，已保留原音频")
    }
    const extension = extensionForMimeType(recordedType, profile.extension)
    options.onProgress?.({ elapsedMs:range.durationMs, durationMs:range.durationMs, ratio:1 })
    return Object.freeze({
      blob:output,
      type:recordedType,
      fileName:clippedFileName(options.fileName, extension),
      durationMs:verified.durationMs,
      originalBytes:Number(blob.size) || 0,
      bytes:Number(output.size) || 0,
      mode:"encoded",
    })
  } finally {
    if (stopTimer !== null) timers.clearTimeout(stopTimer)
    if (progressTimer !== null) timers.clearInterval(progressTimer)
    if (recorderStopTimer !== null) timers.clearTimeout(recorderStopTimer)
    if (abortListener) options.signal?.removeEventListener?.("abort", abortListener)
    if (endedListener) audio.removeEventListener?.("ended", endedListener)
    try {
      if (recorder && !stopRequested && recorder.state !== "inactive") {
        stopRequested = true
        recorder.stop()
      }
    } catch {}
    cleanupRecorderListeners()
    revokeAudio(audio, sourceUrl, URLObject)
    try { mediaSource?.disconnect?.() } catch {}
    stopMediaTracks(destination?.stream)
    if (preparedSession?.close) await preparedSession.close()
    else try { await context.close?.() } catch {}
  }
}

export const AUDIO_CLIP_LIMITS = Object.freeze({
  minimumMs:MIN_AUDIO_CLIP_MS,
  maximumMs:MAX_AUDIO_CLIP_MS,
  bitrate:DEFAULT_AUDIO_BITRATE,
})
