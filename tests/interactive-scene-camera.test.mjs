import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import {
  requestInteractiveCameraPreflight,
  startInteractiveFaceNearSession,
} from "../js/interactive-scene-camera.js"

test("camera preflight requests only the front camera and immediately stops the permission probe", async () => {
  let requested
  let stopped = 0
  const mediaDevices = {
    async getUserMedia(constraints) {
      requested = constraints
      return { getTracks: () => [{ stop() { stopped += 1 } }] }
    },
  }

  const result = await requestInteractiveCameraPreflight({
    mediaDevices,
    FaceDetectorConstructor: class FaceDetector {
      async detect() { return [] }
    },
  })

  assert.deepEqual(requested, {
    audio: false,
    video: { facingMode: { ideal: "user" } },
  })
  assert.equal(stopped, 1)
  assert.deepEqual(result, { granted: true, detectorAvailable: true, reason: "" })
})

test("denied camera preflight produces an explicit fallback state", async () => {
  const result = await requestInteractiveCameraPreflight({
    mediaDevices: {
      async getUserMedia() {
        const error = new Error("denied")
        error.name = "NotAllowedError"
        throw error
      },
    },
    FaceDetectorConstructor: undefined,
  })

  assert.equal(result.granted, false)
  assert.equal(result.detectorAvailable, false)
  assert.equal(result.reason, "permission-denied")
})

test("camera preflight uses the local detector when native FaceDetector is unavailable", async () => {
  let fallbackCreated = 0
  let fallbackClosed = 0
  const result = await requestInteractiveCameraPreflight({
    documentObject: new JSDOM("<!doctype html><html><body></body></html>").window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() {} }] }
      },
    },
    FaceDetectorConstructor: null,
    async createFallbackDetector() {
      fallbackCreated += 1
      return {
        async detect() { return [] },
        close() { fallbackClosed += 1 },
      }
    },
  })

  assert.equal(fallbackCreated, 1)
  assert.equal(fallbackClosed, 1)
  assert.deepEqual(result, { granted: true, detectorAvailable: true, reason: "" })
})

test("face-near session runs through the local detector when native FaceDetector is unavailable", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const frames = [
    [{ boundingBox: { width: 320, height: 250 } }],
    [{ boundingBox: { width: 520, height: 400 } }],
    [{ boundingBox: { width: 900, height: 580 } }],
    [],
    [],
  ]
  let nearCount = 0
  let detectorClosed = 0
  const video = {
    videoWidth: 1280,
    videoHeight: 720,
    muted: false,
    playsInline: false,
    srcObject: null,
    async play() {},
    pause() {},
    removeAttribute() {},
    load() {},
  }
  const session = await startInteractiveFaceNearSession({
    documentObject: dom.window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() {} }] }
      },
    },
    FaceDetectorConstructor: null,
    async createFallbackDetector() {
      return {
        async detect() { return frames.shift() || [] },
        close() { detectorClosed += 1 },
      }
    },
    videoElement: video,
    schedule(callback) {
      if (frames.length) queueMicrotask(callback)
      return 1
    },
    cancelSchedule() {},
    onNear() { nearCount += 1 },
  })

  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(nearCount, 1)
  session.stop()
  assert.equal(detectorClosed, 1)
  dom.window.close()
})

test("face-near session emits only after a close face drops to zero and stops every track", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const frames = [
    [{ boundingBox: { width: 20, height: 20 } }],
    [{ boundingBox: { width: 50, height: 50 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [],
    [],
  ]
  let stopped = 0
  let nearCount = 0
  class Detector {
    async detect() {
      return frames.shift() || []
    }
  }
  const video = {
    videoWidth: 100,
    videoHeight: 100,
    muted: false,
    playsInline: false,
    srcObject: null,
    async play() {},
    pause() {},
    removeAttribute() {},
    load() {},
  }
  const session = await startInteractiveFaceNearSession({
    documentObject: dom.window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() { stopped += 1 } }] }
      },
    },
    FaceDetectorConstructor: Detector,
    videoElement: video,
    schedule(callback) {
      if (frames.length) queueMicrotask(callback)
      return 1
    },
    cancelSchedule() {},
    onNear() { nearCount += 1 },
  })

  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(nearCount, 1)
  session.stop()
  assert.equal(stopped, 1)
  dom.window.close()
})

test("face-near session recognizes the approach-loss trajectory in a landscape camera frame", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const frames = [
    [{ boundingBox: { width: 320, height: 250 } }],
    [{ boundingBox: { width: 520, height: 400 } }],
    [{ boundingBox: { width: 900, height: 580 } }],
    [],
    [],
  ]
  let nearCount = 0
  class Detector {
    async detect() {
      return frames.shift() || []
    }
  }
  const video = {
    videoWidth: 1280,
    videoHeight: 720,
    muted: false,
    playsInline: false,
    srcObject: null,
    async play() {},
    pause() {},
    removeAttribute() {},
    load() {},
  }
  const session = await startInteractiveFaceNearSession({
    documentObject: dom.window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() {} }] }
      },
    },
    FaceDetectorConstructor: Detector,
    videoElement: video,
    schedule(callback) {
      if (frames.length) queueMicrotask(callback)
      return 1
    },
    cancelSchedule() {},
    onNear() { nearCount += 1 },
  })

  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(nearCount, 1)
  session.stop()
  dom.window.close()
})

test("face-near session never treats frames without real video dimensions as near", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  let inspections = 0
  let nearCount = 0
  const video = {
    videoWidth: 0,
    videoHeight: 0,
    muted: false,
    playsInline: false,
    srcObject: null,
    async play() {},
    pause() {},
    removeAttribute() {},
    load() {},
  }
  class Detector {
    async detect() {
      inspections += 1
      if (inspections === 4) {
        video.videoWidth = 100
        video.videoHeight = 100
      }
      return [{ boundingBox: { width: 10, height: 10 } }]
    }
  }

  const session = await startInteractiveFaceNearSession({
    documentObject: dom.window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() {} }] }
      },
    },
    FaceDetectorConstructor: Detector,
    videoElement: video,
    schedule(callback) {
      if (inspections < 6) queueMicrotask(callback)
      return 1
    },
    cancelSchedule() {},
    onNear() { nearCount += 1 },
  })

  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(nearCount, 0)
  session.stop()
  dom.window.close()
})

async function runFaceSequence(frames) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  let nearCount = 0
  const video = {
    videoWidth: 100,
    videoHeight: 100,
    muted: false,
    playsInline: false,
    srcObject: null,
    async play() {},
    pause() {},
    removeAttribute() {},
    load() {},
  }
  class Detector {
    async detect() {
      return frames.shift() || []
    }
  }
  const session = await startInteractiveFaceNearSession({
    documentObject: dom.window.document,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop() {} }] }
      },
    },
    FaceDetectorConstructor: Detector,
    videoElement: video,
    schedule(callback) {
      if (frames.length) queueMicrotask(callback)
      return 1
    },
    cancelSchedule() {},
    onNear() { nearCount += 1 },
  })

  await new Promise(resolve => setTimeout(resolve, 20))
  session.stop()
  dom.window.close()
  return nearCount
}

test("face-near session requires growth to roughly eighty percent before detector loss", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 55, height: 55 } }],
    [{ boundingBox: { width: 78, height: 78 } }],
    [],
    [],
  ])

  assert.equal(nearCount, 1)
})

test("face-near session accepts a gradual approach to the strict close threshold", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 42, height: 42 } }],
    [{ boundingBox: { width: 50, height: 50 } }],
    [{ boundingBox: { width: 60, height: 60 } }],
    [{ boundingBox: { width: 70, height: 70 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [],
    [],
  ])

  assert.equal(nearCount, 1)
})

test("face-near session does not unlock while the close face stays detectable", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 50, height: 50 } }],
    [{ boundingBox: { width: 65, height: 65 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [{ boundingBox: { width: 82, height: 82 } }],
  ])

  assert.equal(nearCount, 0)
})

test("face-near session does not unlock from a modest approach followed by black frames", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 45, height: 45 } }],
    [{ boundingBox: { width: 60, height: 60 } }],
    [],
    [],
    [],
  ])

  assert.equal(nearCount, 0)
})

test("face-near session ignores ordinary seated PC-camera jitter", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 38, height: 39 } }],
    [{ boundingBox: { width: 40, height: 39 } }],
    [{ boundingBox: { width: 41, height: 40 } }],
    [{ boundingBox: { width: 39, height: 41 } }],
    [{ boundingBox: { width: 42, height: 40 } }],
    [{ boundingBox: { width: 40, height: 42 } }],
  ])

  assert.equal(nearCount, 0)
})

test("face-near session can detect another approach after the reader pulls back", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 55, height: 55 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [],
    [],
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 55, height: 55 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [],
    [],
  ])

  assert.equal(nearCount, 2)
})

test("face-near session accepts a detected face shrinking to five percent after extreme proximity", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 35, height: 35 } }],
    [{ boundingBox: { width: 58, height: 58 } }],
    [{ boundingBox: { width: 80, height: 80 } }],
    [{ boundingBox: { width: 5, height: 5 } }],
    [{ boundingBox: { width: 4, height: 4 } }],
  ])

  assert.equal(nearCount, 1)
})

test("face-near session does not unlock when the first visible face is already close", async () => {
  const nearCount = await runFaceSequence([
    [{ boundingBox: { width: 80, height: 80 } }],
    [{ boundingBox: { width: 82, height: 82 } }],
    [],
    [],
  ])

  assert.equal(nearCount, 0)
})
