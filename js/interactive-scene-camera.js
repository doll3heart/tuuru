const FRONT_CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: { facingMode: { ideal: "user" } },
})

const mediaPipeFilesets = new Map()
let mediaPipeTasksVisionPromise = null

function loadMediaPipeTasksVision() {
  if (!mediaPipeTasksVisionPromise) {
    mediaPipeTasksVisionPromise = import("@mediapipe/tasks-vision").catch(error => {
      mediaPipeTasksVisionPromise = null
      throw error
    })
  }
  return mediaPipeTasksVisionPromise
}

function stopStream(stream) {
  if (!stream || typeof stream.getTracks !== "function") return
  stream.getTracks().forEach(track => {
    try { track.stop() } catch (_) {}
  })
}

function detectorAssetRoot(documentObject, options = {}) {
  if (options.assetRoot) return new URL(String(options.assetRoot))
  const baseHref = documentObject?.baseURI || globalThis.location?.href
  if (!baseHref) throw new Error("detector-assets-unavailable")
  return new URL("../mediapipe/", baseHref)
}

async function createMediaPipeFaceDetector(options = {}) {
  const documentObject = options.documentObject || globalThis.document
  const assetRoot = detectorAssetRoot(documentObject, options)
  const wasmRoot = new URL("wasm/", assetRoot).href
  const modelUrl = new URL("models/blaze_face_short_range.tflite", assetRoot).href
  const mediaPipeTasksVision = await loadMediaPipeTasksVision()
  const { FilesetResolver } = mediaPipeTasksVision
  let filesetPromise = mediaPipeFilesets.get(wasmRoot)
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(wasmRoot)
    mediaPipeFilesets.set(wasmRoot, filesetPromise)
  }
  let fileset
  try {
    fileset = await filesetPromise
  } catch (error) {
    mediaPipeFilesets.delete(wasmRoot)
    throw error
  }
  const { FaceDetector: MediaPipeFaceDetector } = mediaPipeTasksVision
  const detector = await MediaPipeFaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  })
  let lastTimestamp = 0
  return {
    async detect(source) {
      const now = Number(globalThis.performance?.now?.()) || Date.now()
      lastTimestamp = Math.max(lastTimestamp + 1, Math.round(now))
      return detector.detectForVideo(source, lastTimestamp).detections || []
    },
    close() {
      try { detector.close() } catch (_) {}
    },
  }
}

async function createInteractiveFaceDetector(options = {}) {
  const documentObject = options.documentObject || globalThis.document
  const hasConstructorOverride = Object.prototype.hasOwnProperty.call(
    options,
    "FaceDetectorConstructor",
  )
  const FaceDetectorConstructor = hasConstructorOverride
    ? options.FaceDetectorConstructor
    : globalThis.FaceDetector
  if (typeof FaceDetectorConstructor === "function") {
    let detector
    try {
      detector = new FaceDetectorConstructor({ fastMode: true, maxDetectedFaces: 1 })
      const probe = options.probeSource || documentObject?.createElement?.("canvas")
      let probeResult = probe ? await detector.detect(probe) : null
      return {
        detect(source) {
          if (probeResult) {
            const result = probeResult
            probeResult = null
            return result
          }
          return detector.detect(source)
        },
        close() {
          try { detector.close?.() } catch (_) {}
        },
      }
    } catch (_) {
      try { detector?.close?.() } catch (_) {}
    }
  }
  const createFallbackDetector = options.createFallbackDetector === undefined
    ? createMediaPipeFaceDetector
    : options.createFallbackDetector
  if (typeof createFallbackDetector !== "function") {
    throw new Error("detector-unavailable")
  }
  return createFallbackDetector(options)
}

export function createFaceNearSignal() {
  const listeners = new Set()
  return {
    subscribe(listener) {
      if (typeof listener !== "function") return () => {}
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit() {
      listeners.forEach(listener => listener())
    },
    clear() {
      listeners.clear()
    },
  }
}

export async function requestInteractiveCameraPreflight(options = {}) {
  const documentObject = options.documentObject || globalThis.document
  const mediaDevices = options.mediaDevices || globalThis.navigator?.mediaDevices
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    return { granted: false, detectorAvailable: false, reason: "camera-unavailable" }
  }
  let stream
  let detector
  try {
    stream = await mediaDevices.getUserMedia(FRONT_CAMERA_CONSTRAINTS)
    try {
      detector = await createInteractiveFaceDetector({
        ...options,
        documentObject,
      })
    } catch (_) {
      return {
        granted: true,
        detectorAvailable: false,
        reason: "detector-unavailable",
      }
    }
    return {
      granted: true,
      detectorAvailable: true,
      reason: "",
    }
  } catch (error) {
    const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError"
    return {
      granted: false,
      detectorAvailable: false,
      reason: denied ? "permission-denied" : "camera-unavailable",
    }
  } finally {
    try { detector?.close?.() } catch (_) {}
    stopStream(stream)
  }
}

export async function startInteractiveFaceNearSession(options = {}) {
  const documentObject = options.documentObject || document
  const mediaDevices = options.mediaDevices || globalThis.navigator?.mediaDevices
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    throw new Error("camera-unavailable")
  }

  let stream
  let detector
  const video = options.videoElement || documentObject.createElement("video")
  try {
    stream = await mediaDevices.getUserMedia(FRONT_CAMERA_CONSTRAINTS)
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    detector = await createInteractiveFaceDetector({
      ...options,
      documentObject,
      probeSource: video,
    })
  } catch (error) {
    try { detector?.close?.() } catch (_) {}
    try {
      video.srcObject = null
      video.removeAttribute("src")
      video.load()
    } catch (_) {}
    stopStream(stream)
    throw error
  }

  const schedule = options.schedule || (callback => setTimeout(callback, 140))
  const cancelSchedule = options.cancelSchedule || clearTimeout
  const onNear = typeof options.onNear === "function" ? options.onNear : () => {}
  const onSample = typeof options.onSample === "function" ? options.onSample : () => {}
  const onDetectionError = typeof options.onDetectionError === "function"
    ? options.onDetectionError
    : () => {}
  const closeFaceSpanRatio = Number.isFinite(options.closeFaceSpanRatio)
    ? options.closeFaceSpanRatio
    : 0.75
  const terminalFaceSpanRatio = Number.isFinite(options.terminalFaceSpanRatio)
    ? options.terminalFaceSpanRatio
    : 0.05
  const minimumApproachGrowthRatio = Number.isFinite(options.minimumApproachGrowthRatio)
    ? options.minimumApproachGrowthRatio
    : 0.30
  const terminalFramesForNear = Number.isFinite(options.terminalFramesForNear)
    ? Math.max(1, Math.round(options.terminalFramesForNear))
    : 2
  const closeSequenceMemoryFrames = Number.isFinite(options.closeSequenceMemoryFrames)
    ? Math.max(1, Math.round(options.closeSequenceMemoryFrames))
    : 10
  const retreatFaceSpanRatio = Number.isFinite(options.retreatFaceSpanRatio)
    ? options.retreatFaceSpanRatio
    : 0.55
  const retreatFramesForReset = Number.isFinite(options.retreatFramesForReset)
    ? Math.max(1, Math.round(options.retreatFramesForReset))
    : 3
  let minimumObservedFaceSpan = null
  let approachSampleCount = 0
  let closeSequenceFramesRemaining = 0
  let terminalFrames = 0
  let retreatFrames = 0
  let nearLatched = false
  let stopped = false
  let scheduled = null

  function resetApproach(faceSpanRatio = null) {
    minimumObservedFaceSpan = Number.isFinite(faceSpanRatio) && faceSpanRatio > terminalFaceSpanRatio
      ? faceSpanRatio
      : null
    approachSampleCount = minimumObservedFaceSpan === null ? 0 : 1
    closeSequenceFramesRemaining = 0
    terminalFrames = 0
  }

  function emitNear() {
    if (nearLatched) return
    nearLatched = true
    closeSequenceFramesRemaining = 0
    terminalFrames = 0
    onNear()
  }

  async function inspectFrame() {
    if (stopped) return
    try {
      const faces = await detector.detect(video)
      const face = Array.isArray(faces) ? faces[0] : null
      const bounds = face?.boundingBox
      const frameWidth = Number(video.videoWidth)
      const frameHeight = Number(video.videoHeight)
      const measuredFaceWidth = Number(bounds?.width)
      const measuredFaceHeight = Number(bounds?.height)
      const faceWidth = Number.isFinite(measuredFaceWidth) ? Math.max(0, measuredFaceWidth) : 0
      const faceHeight = Number.isFinite(measuredFaceHeight) ? Math.max(0, measuredFaceHeight) : 0
      const hasFrameDimensions = frameWidth > 0 && frameHeight > 0
      const faceSpanRatio = hasFrameDimensions
        ? Math.max(faceWidth / frameWidth, faceHeight / frameHeight)
        : 0
      onSample({
        faceCount: Array.isArray(faces) ? faces.length : 0,
        faceSpanRatio,
        frameWidth,
        frameHeight,
      })

      const terminalFrame = hasFrameDimensions && faceSpanRatio <= terminalFaceSpanRatio
      if (nearLatched) {
        retreatFrames = faceSpanRatio <= retreatFaceSpanRatio
          && faceSpanRatio > terminalFaceSpanRatio
          ? retreatFrames + 1
          : 0
        if (retreatFrames >= retreatFramesForReset) {
          nearLatched = false
          retreatFrames = 0
          resetApproach(faceSpanRatio)
        }
      } else if (terminalFrame) {
        if (closeSequenceFramesRemaining > 0) {
          closeSequenceFramesRemaining -= 1
          terminalFrames += 1
          if (terminalFrames >= terminalFramesForNear) emitNear()
        } else {
          terminalFrames = 0
        }
      } else {
        terminalFrames = 0
        approachSampleCount += 1
        minimumObservedFaceSpan = minimumObservedFaceSpan === null
          ? faceSpanRatio
          : Math.min(minimumObservedFaceSpan, faceSpanRatio)
        const completedApproach = approachSampleCount >= 2
          && faceSpanRatio >= closeFaceSpanRatio
          && faceSpanRatio - minimumObservedFaceSpan >= minimumApproachGrowthRatio - 0.000001
        if (completedApproach) {
          closeSequenceFramesRemaining = closeSequenceMemoryFrames
        } else if (closeSequenceFramesRemaining > 0) {
          closeSequenceFramesRemaining -= 1
          if (closeSequenceFramesRemaining === 0) resetApproach(faceSpanRatio)
        }
      }
    } catch (error) {
      onDetectionError(error)
      retreatFrames = 0
      resetApproach()
    }
    if (!stopped) scheduled = schedule(inspectFrame)
  }

  scheduled = schedule(inspectFrame)

  return {
    stream,
    video,
    stop() {
      if (stopped) return
      stopped = true
      if (scheduled !== null) cancelSchedule(scheduled)
      try { video.pause() } catch (_) {}
      try {
        video.srcObject = null
        video.removeAttribute("src")
        video.load()
      } catch (_) {}
      try { detector.close?.() } catch (_) {}
      stopStream(stream)
    },
  }
}
