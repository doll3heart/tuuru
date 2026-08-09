import test from "node:test"
import assert from "node:assert/strict"

import {
  createInteractiveBgmController,
  normalizeInteractiveBgm,
} from "../js/interactive-bgm.js"

class FakeAudio {
  constructor() {
    this.src = ""
    this.currentTime = 0
    this.paused = true
    this.playCount = 0
    this.pauseCount = 0
  }
  async play() { this.paused = false; this.playCount += 1 }
  pause() { this.paused = true; this.pauseCount += 1 }
  removeAttribute(name) { if (name === "src") this.src = "" }
}

test("interactive BGM normalization bounds volume and defaults to looping", () => {
  assert.deepEqual(normalizeInteractiveBgm({ source:" https://example.test/a.mp3 ", volume:120 }), {
    source:"https://example.test/a.mp3",
    fileName:"",
    volume:100,
    loop:true,
    durationMs:0,
    bytes:0,
    startMs:0,
    endMs:null,
  })
  assert.equal(normalizeInteractiveBgm({ volume:-4, loop:false }).volume, 0)
  assert.equal(normalizeInteractiveBgm({ loop:false }).loop, false)
})

test("interactive BGM normalization keeps a bounded playback segment", () => {
  assert.deepEqual(normalizeInteractiveBgm({
    source:"https://example.test/a.mp3",
    durationMs:180_000,
    bytes:2_880_000,
    startMs:12_345.6,
    endMs:27_890.2,
  }), {
    source:"https://example.test/a.mp3",
    fileName:"",
    volume:70,
    loop:true,
    durationMs:180_000,
    bytes:2_880_000,
    startMs:12_346,
    endMs:27_890,
  })
  assert.equal(normalizeInteractiveBgm({ durationMs:5_000, startMs:4_900, endMs:1_000 }).endMs, null)
  assert.deepEqual(
    normalizeInteractiveBgm({ durationMs:5_000, startMs:0, endMs:1, loop:true }),
    {
      source:"",
      fileName:"",
      volume:70,
      loop:true,
      durationMs:5_000,
      bytes:0,
      startMs:0,
      endMs:null,
    },
    "an imported one-millisecond loop must fall back to the full track",
  )
})

test("stage music replaces the global BGM and leaving the stage restores it", async () => {
  const controller = createInteractiveBgmController({
    Audio:FakeAudio,
    globalBgm:{ source:"https://example.test/default.mp3", volume:60 },
  })
  assert.equal(controller.setStage({ bgm:{} }), "global")
  await controller.unlock()
  assert.equal(controller.audio.src, "https://example.test/default.mp3")
  assert.equal(controller.audio.volume, .6)
  controller.audio.currentTime = 12

  assert.equal(controller.setStage({ bgm:{ source:"https://example.test/special.ogg", volume:35 } }), "special")
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(controller.audio.src, "https://example.test/special.ogg")
  assert.equal(controller.audio.currentTime, 0)
  assert.equal(controller.audio.volume, .35)

  assert.equal(controller.setStage({ bgm:{} }), "global")
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(controller.audio.src, "https://example.test/default.mp3")
  assert.equal(controller.audio.currentTime, 12, "the default BGM resumes instead of restarting")
  controller.destroy()
  assert.equal(controller.audio.src, "")
})

test("embedded audio assets are resolved only when selected", async () => {
  const requested = []
  const source = `asset://${"a".repeat(64)}`
  const controller = createInteractiveBgmController({
    Audio:FakeAudio,
    resolveAssetUrl(value) { requested.push(value); return "blob:audio-1" },
  })
  controller.setStage({ bgm:{ source } })
  await controller.unlock()
  assert.deepEqual(requested, [source, source])
  assert.equal(controller.audio.src, "blob:audio-1")
})

test("a selected BGM segment starts at its in-point and loops inside its boundary", async () => {
  class EventAudio extends FakeAudio {
    constructor() {
      super()
      this.listeners = new Map()
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    emit(type) { this.listeners.get(type)?.({ type }) }
  }
  const scheduled = []
  const controller = createInteractiveBgmController({
    Audio:EventAudio,
    globalBgm:{
      source:"https://example.test/segment.mp3",
      startMs:12_000,
      endMs:27_000,
      loop:true,
    },
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length },
    clearTimeout() {},
  })
  controller.setStage({ bgm:{} })
  await controller.unlock()

  assert.equal(controller.audio.currentTime, 12)
  assert.equal(controller.audio.loop, false, "native looping would incorrectly jump to zero")
  assert.equal(scheduled.at(-1).delay, 15_000)
  controller.audio.currentTime = 27
  scheduled.at(-1).callback()
  assert.equal(controller.audio.currentTime, 12)
  assert.equal(controller.audio.paused, false)

  controller.destroy()
})

test("an unavailable media clock schedules a segment from its authored start", async () => {
  class MissingClockAudio extends FakeAudio {
    async play() {
      await super.play()
      this.currentTime = Number.NaN
    }
  }
  const scheduled = []
  const controller = createInteractiveBgmController({
    Audio:MissingClockAudio,
    globalBgm:{
      source:"https://example.test/segment.mp3",
      startMs:12_000,
      endMs:27_000,
      loop:true,
    },
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length },
    clearTimeout() {},
  })
  controller.setStage({ bgm:{} })
  await controller.unlock()

  assert.equal(scheduled.at(-1).delay, 15_000)
  controller.destroy()
})

test("an early natural end loops immediately instead of waiting on a stale configured endpoint", async () => {
  class EarlyEndAudio extends FakeAudio {
    constructor() {
      super()
      this.listeners = new Map()
      this.duration = 20
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    emit(type) { this.listeners.get(type)?.({ type }) }
  }
  const scheduled = []
  const controller = createInteractiveBgmController({
    Audio:EarlyEndAudio,
    globalBgm:{
      source:"https://example.test/replaced.mp3",
      startMs:12_000,
      endMs:27_000,
      loop:true,
    },
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length },
    clearTimeout() {},
  })
  controller.setStage({ bgm:{} })
  await controller.unlock()
  controller.audio.currentTime = 20
  controller.audio.emit("ended")
  await Promise.resolve()

  assert.equal(controller.audio.currentTime, 12)
  assert.equal(controller.audio.playCount, 2)
  controller.destroy()
})

test("loaded metadata clamps stale authored bounds to the actual replacement file", async () => {
  class ShortReplacementAudio extends FakeAudio {
    constructor() {
      super()
      this.listeners = new Map()
      this.duration = 20
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    emit(type) { this.listeners.get(type)?.({ type }) }
  }
  const scheduled = []
  const controller = createInteractiveBgmController({
    Audio:ShortReplacementAudio,
    globalBgm:{
      source:"https://example.test/short.mp3",
      durationMs:180_000,
      startMs:25_000,
      endMs:27_000,
      loop:true,
    },
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length },
    clearTimeout() {},
  })
  controller.setStage({ bgm:{} })
  await controller.unlock()
  controller.audio.emit("loadedmetadata")

  assert.equal(controller.audio.currentTime, 0)
  assert.equal(scheduled.at(-1).delay, 20_000)
  controller.destroy()
})

test("metadata loading before reader unlock never starts a segment boundary timer", async () => {
  class LockedAudio extends FakeAudio {
    constructor() {
      super()
      this.listeners = new Map()
      this.duration = 60
    }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    removeEventListener(type) { this.listeners.delete(type) }
    emit(type) { this.listeners.get(type)?.({ type }) }
  }
  const scheduled = []
  const controller = createInteractiveBgmController({
    Audio:LockedAudio,
    globalBgm:{ source:"https://example.test/locked.mp3", startMs:5_000, endMs:15_000 },
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length },
    clearTimeout() {},
  })
  controller.setStage({ bgm:{} })
  await Promise.resolve()
  controller.audio.emit("loadedmetadata")

  assert.equal(controller.audio.paused, true)
  assert.equal(scheduled.length, 0)
  controller.destroy()
})

test("a missing replacement asset pauses the old BGM instead of playing the wrong track", async () => {
  const missing = `asset://${"f".repeat(64)}`
  const controller = createInteractiveBgmController({
    Audio:FakeAudio,
    globalBgm:{ source:"https://example.test/default.mp3" },
    resolveAssetUrl:async value => value === missing ? "" : value,
  })
  controller.setStage({ bgm:{} })
  await controller.unlock()
  assert.equal(controller.audio.paused, false)

  controller.setStage({ bgm:{ source:missing } })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(controller.audio.paused, true)
  assert.equal(controller.audio.src, "")
  controller.destroy()
})
