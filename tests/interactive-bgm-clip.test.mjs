import test from "node:test"
import assert from "node:assert/strict"

import {
  importInteractiveBgmFile,
  replaceInteractiveBgmWithCompressedClip,
} from "../js/interactive-bgm-clip.js"

test("imported BGM metadata is stored beside the deduplicated asset reference", async () => {
  const source = `asset://${"c".repeat(64)}`
  const file = new Blob(["long audio"], { type:"audio/mpeg" })
  Object.defineProperty(file, "name", { value:"漫长夜晚.mp3" })
  const track = await importInteractiveBgmFile(file, { volume:48, loop:false }, {
    probeAudio:async () => ({ durationMs:180_000, bytes:file.size, type:file.type }),
    persistAsset:async () => source,
  })

  assert.deepEqual(track, {
    source,
    fileName:"漫长夜晚.mp3",
    volume:48,
    loop:false,
    durationMs:180_000,
    bytes:file.size,
    startMs:0,
    endMs:null,
  })
})

test("physical clipping replaces the original reference and resets playback boundaries", async () => {
  const originalSource = `asset://${"d".repeat(64)}`
  const clippedSource = `asset://${"e".repeat(64)}`
  const original = new Blob(["o".repeat(10_000)], { type:"audio/mpeg" })
  const clipped = new Blob(["clip"], { type:"audio/webm;codecs=opus" })
  const result = await replaceInteractiveBgmWithCompressedClip({
    source:originalSource,
    fileName:"漫长夜晚.mp3",
    volume:64,
    loop:true,
    durationMs:180_000,
    bytes:2_880_000,
    startMs:12_000,
    endMs:27_000,
  }, { startMs:12_000, endMs:27_000 }, {
    loadAsset:async value => {
      assert.equal(value, originalSource)
      return { blob:original, fileName:"漫长夜晚.mp3", type:"audio/mpeg" }
    },
    createClip:async (blob, range) => {
      assert.equal(blob, original)
      assert.deepEqual({ startMs:range.startMs, endMs:range.endMs }, { startMs:12_000, endMs:27_000 })
      return {
        blob:clipped,
        fileName:"漫长夜晚-片段.webm",
        type:clipped.type,
        durationMs:15_100,
        originalBytes:2_880_000,
        bytes:clipped.size,
        mode:"encoded",
      }
    },
    persistAsset:async (blob, metadata) => {
      assert.equal(blob, clipped)
      assert.equal(metadata.fileName, "漫长夜晚-片段.webm")
      return clippedSource
    },
  })

  assert.equal(result.track.source, clippedSource)
  assert.equal(result.track.fileName, "漫长夜晚-片段.webm")
  assert.equal(result.track.durationMs, 15_100)
  assert.equal(result.track.startMs, 0)
  assert.equal(result.track.endMs, null)
  assert.equal(result.result.mode, "encoded")
})

test("cancellation after encoding never persists or returns a replacement track", async () => {
  const controller = new AbortController()
  let persists = 0
  const original = new Blob(["original-audio"], { type:"audio/mpeg" })
  const clipped = new Blob(["clip"], { type:"audio/webm" })
  await assert.rejects(replaceInteractiveBgmWithCompressedClip({
    source:`asset://${"f".repeat(64)}`,
    fileName:"song.mp3",
    durationMs:60_000,
    bytes:original.size,
  }, { startMs:0, endMs:5_000 }, {
    signal:controller.signal,
    loadAsset:async () => ({ blob:original, fileName:"song.mp3" }),
    createClip:async () => {
      controller.abort()
      return {
        blob:clipped,
        fileName:"song-片段.webm",
        type:clipped.type,
        durationMs:5_000,
        originalBytes:original.size,
        bytes:clipped.size,
      }
    },
    persistAsset:async () => { persists += 1; return `asset://${"0".repeat(64)}` },
  }), error => error?.name === "AbortError")
  assert.equal(persists, 0)
})

test("cancellation interrupts a pending asset read and closes the prepared audio session", async () => {
  const controller = new AbortController()
  let closes = 0
  const pending = replaceInteractiveBgmWithCompressedClip({
    source:`asset://${"9".repeat(64)}`,
    fileName:"song.mp3",
    durationMs:60_000,
    bytes:10_000,
  }, { startMs:0, endMs:5_000 }, {
    signal:controller.signal,
    preparedSession:{ async close() { closes += 1 } },
    loadAsset:() => new Promise(() => {}),
  })
  await Promise.resolve()
  controller.abort()
  let deadline
  try {
    await Promise.race([
      assert.rejects(pending, error => error?.name === "AbortError"),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("asset read abort timed out")), 100) }),
    ])
  } finally {
    clearTimeout(deadline)
  }
  assert.equal(closes, 1)
})

test("a lossy replacement must save meaningful space instead of only a few bytes", async () => {
  const original = new Blob(["o".repeat(10_000)], { type:"audio/mpeg" })
  const clipped = new Blob(["c".repeat(9_999)], { type:"audio/webm" })
  let persists = 0
  await assert.rejects(replaceInteractiveBgmWithCompressedClip({
    source:`asset://${"1".repeat(64)}`,
    fileName:"song.mp3",
    durationMs:60_000,
    bytes:original.size,
  }, { startMs:0, endMs:59_000 }, {
    loadAsset:async () => ({ blob:original, fileName:"song.mp3" }),
    createClip:async () => ({
      blob:clipped,
      fileName:"song-片段.webm",
      type:clipped.type,
      durationMs:59_000,
      originalBytes:original.size,
      bytes:clipped.size,
    }),
    persistAsset:async () => { persists += 1; return `asset://${"2".repeat(64)}` },
  }), /没有节省足够空间/)
  assert.equal(persists, 0)
})

test("audio processing permission is prepared synchronously before IndexedDB loading", async () => {
  const events = []
  const original = new Blob(["o".repeat(10_000)], { type:"audio/mpeg" })
  const clipped = new Blob(["c".repeat(1_000)], { type:"audio/webm" })
  const preparedSession = { async close() { events.push("close") } }
  const pending = replaceInteractiveBgmWithCompressedClip({
    source:`asset://${"3".repeat(64)}`,
    fileName:"song.mp3",
    durationMs:60_000,
    bytes:original.size,
  }, { startMs:5_000, endMs:15_000 }, {
    prepareSession() { events.push("prepare"); return preparedSession },
    async loadAsset() { events.push("load"); return { blob:original, fileName:"song.mp3" } },
    async createClip(blob, options) {
      events.push("create")
      assert.equal(options.preparedSession, preparedSession)
      return {
        blob:clipped,
        fileName:"song-片段.webm",
        type:clipped.type,
        durationMs:10_000,
        originalBytes:original.size,
        bytes:clipped.size,
      }
    },
    async persistAsset() { events.push("persist"); return `asset://${"4".repeat(64)}` },
  })

  assert.equal(events[0], "prepare", "the audio context must be resumed in the original click stack")
  await pending
  assert.deepEqual(events, ["prepare", "load", "create", "persist", "close"])
})
