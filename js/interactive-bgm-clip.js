import { createCompressedAudioClip, prepareAudioClipSession, probeAudioBlob } from "./audio-clip.js"
import {
  loadEditorMediaAsset,
  persistEditorMediaAsset,
} from "./editor-media-storage.js"
import { normalizeInteractiveBgm } from "./interactive-bgm.js"

function cancellationError() {
  const error = new Error("已取消音频裁剪")
  error.name = "AbortError"
  return error
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return
  throw cancellationError()
}

function raceWithCancellation(promise, signal) {
  if (!signal) return Promise.resolve(promise)
  if (signal.aborted) return Promise.reject(cancellationError())
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = callback => value => {
      if (settled) return
      settled = true
      signal.removeEventListener?.("abort", cancelled)
      callback(value)
    }
    const cancelled = finish(() => reject(cancellationError()))
    signal.addEventListener?.("abort", cancelled, { once:true })
    Promise.resolve(promise).then(finish(resolve), finish(reject))
  })
}

export async function importInteractiveBgmFile(file, currentTrack = {}, dependencies = {}) {
  if (!file || typeof file !== "object" || !Number.isFinite(Number(file.size))) {
    throw new TypeError("请选择有效的本地音频")
  }
  const probeAudio = dependencies.probeAudio || probeAudioBlob
  const persistAsset = dependencies.persistAsset || persistEditorMediaAsset
  const metadata = await probeAudio(file, dependencies.environment || {})
  const source = await persistAsset(file, {
    fileName:String(file.name || "BGM"),
    type:String(file.type || metadata.type || "application/octet-stream"),
  })
  return normalizeInteractiveBgm({
    ...currentTrack,
    source,
    fileName:String(file.name || "BGM"),
    durationMs:Number(metadata.durationMs) || 0,
    bytes:Number(metadata.bytes || file.size) || 0,
    startMs:0,
    endMs:null,
  })
}

export async function replaceInteractiveBgmWithCompressedClip(trackValue, range, dependencies = {}) {
  throwIfCancelled(dependencies.signal)
  const track = normalizeInteractiveBgm(trackValue)
  if (!/^asset:\/\//i.test(track.source)) {
    throw new Error("远程音乐只能设置播放区间；请先导入本地音频再裁剪")
  }
  const loadAsset = dependencies.loadAsset || loadEditorMediaAsset
  const persistAsset = dependencies.persistAsset || persistEditorMediaAsset
  const createClip = dependencies.createClip || createCompressedAudioClip
  const prepareSession = dependencies.prepareSession
    || (!dependencies.createClip ? prepareAudioClipSession : null)
  const preparedSession = dependencies.preparedSession
    || prepareSession?.(dependencies.environment || {})
  try {
    const sourceAsset = await raceWithCancellation(loadAsset(track.source), dependencies.signal)
    throwIfCancelled(dependencies.signal)
    const result = await raceWithCancellation(createClip(sourceAsset.blob, {
      startMs:Number(range?.startMs) || 0,
      endMs:Number(range?.endMs) || track.durationMs || null,
      fileName:sourceAsset.fileName || track.fileName || "BGM",
      signal:dependencies.signal,
      onProgress:dependencies.onProgress,
      preparedSession,
    }, dependencies.environment || {}), dependencies.signal)
    throwIfCancelled(dependencies.signal)
    const originalBytes = Number(sourceAsset.blob.size || track.bytes)
    const outputBytes = Number(result.bytes)
    if (!Number.isFinite(outputBytes) || outputBytes <= 0) {
      throw new Error("裁剪结果大小无效，已保留原音频")
    }
    const requiredSavings = Math.max(4 * 1024, Math.ceil(originalBytes * .01))
    if (!Number.isFinite(originalBytes) || originalBytes <= 0 || originalBytes - outputBytes < requiredSavings) {
      throw new Error("裁剪结果没有节省足够空间，已保留原音频")
    }
    const source = await raceWithCancellation(persistAsset(result.blob, {
      fileName:result.fileName,
      type:result.type,
    }), dependencies.signal)
    throwIfCancelled(dependencies.signal)
    return Object.freeze({
      track:normalizeInteractiveBgm({
        ...track,
        source,
        fileName:result.fileName,
        durationMs:result.durationMs,
        bytes:result.bytes,
        startMs:0,
        endMs:null,
      }),
      result,
    })
  } finally {
    await preparedSession?.close?.()
  }
}
