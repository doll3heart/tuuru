import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { createInteractiveBgmClipEditor } from "../js/interactive-bgm-clip-editor.js"

test("shared BGM clip editor exposes an accessible range and commits both endpoints", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const changes = []
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{
      source:`asset://${"a".repeat(64)}`,
      fileName:"漫长夜晚.mp3",
      durationMs:180_000,
      bytes:2_880_000,
      startMs:12_000,
      endMs:27_000,
      loop:true,
    },
    onRangeChange(range) { changes.push(range) },
    onTrim:async () => {},
  })
  dom.window.document.body.appendChild(editor.element)

  assert.match(editor.element.textContent, /播放片段/)
  assert.match(editor.element.querySelector("[data-audio-clip-summary]").textContent, /00:12.*00:27.*15 秒/)
  assert.equal(editor.element.querySelector("[data-audio-clip-start]").getAttribute("aria-label"), "片段开始时间")
  assert.equal(editor.element.querySelector("[data-audio-clip-end]").getAttribute("aria-label"), "片段结束时间")
  assert.equal(editor.element.querySelector("[data-audio-clip-start]").getAttribute("aria-valuetext"), "12 秒")
  assert.equal(editor.element.querySelector("[data-audio-clip-end]").getAttribute("aria-valuetext"), "27 秒")
  assert.equal(editor.element.querySelector("[data-audio-clip-trim]").disabled, false)

  const start = editor.element.querySelector("[data-audio-clip-start]")
  start.value = "13000"
  start.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  assert.deepEqual(changes.at(-1), { startMs:13_000, endMs:27_000 })
  assert.equal(start.getAttribute("aria-valuetext"), "13 秒")

  editor.destroy()
  dom.window.close()
})

test("clip editor distinguishes playback-only ranges from physical local trimming", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{
      source:"https://example.test/music.mp3",
      fileName:"",
      durationMs:180_000,
      startMs:10_000,
      endMs:20_000,
    },
    onRangeChange() {},
  })

  assert.equal(editor.element.querySelector("[data-audio-clip-trim]"), null)
  assert.match(editor.element.textContent, /只控制播放区间.*不会缩小远程文件/)
  editor.destroy()
  dom.window.close()
})

test("a full-track import unlocks trimming and reset as soon as the range changes", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const changes = []
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{
      source:`asset://${"c".repeat(64)}`,
      fileName:"完整歌曲.mp3",
      durationMs:180_000,
      bytes:2_880_000,
      startMs:0,
      endMs:null,
    },
    onRangeChange(range) { changes.push(range) },
    onTrim:async () => {},
  })
  dom.window.document.body.appendChild(editor.element)

  const trim = editor.element.querySelector("[data-audio-clip-trim]")
  const reset = editor.element.querySelector("[data-audio-clip-reset]")
  const end = editor.element.querySelector("[data-audio-clip-end]")
  assert.equal(trim.disabled, true)
  assert.equal(reset.disabled, true)

  end.value = "15000"
  end.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  assert.equal(trim.disabled, false)
  assert.equal(reset.disabled, false)

  end.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  assert.deepEqual(changes.at(-1), { startMs:0, endMs:15_000 })

  reset.click()
  assert.deepEqual(changes.at(-1), { startMs:0, endMs:null })
  assert.equal(trim.disabled, true)
  assert.equal(reset.disabled, true)
  editor.destroy()
  dom.window.close()
})

test("clip editor reports encoding progress and leaves failure visible", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  let progress
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{
      source:`asset://${"b".repeat(64)}`,
      fileName:"夜.mp3",
      durationMs:60_000,
      bytes:900_000,
      startMs:5_000,
      endMs:15_000,
    },
    onRangeChange() {},
    async onTrim(range, handlers) {
      progress = range
      handlers.onProgress({ elapsedMs:5_000, durationMs:10_000, ratio:.5 })
      throw new Error("浏览器编码器不可用")
    },
  })
  dom.window.document.body.appendChild(editor.element)
  editor.element.querySelector("[data-audio-clip-trim]").click()
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.deepEqual(progress, { startMs:5_000, endMs:15_000 })
  assert.match(editor.element.querySelector("[data-audio-clip-status]").textContent, /浏览器编码器不可用.*完整音频仍保留/)
  assert.equal(editor.element.querySelector("[data-audio-clip-progress]").value, .5)
  assert.equal(editor.element.querySelector("[data-audio-clip-trim]").disabled, false)
  editor.destroy()
  dom.window.close()
})

test("a failed duration probe never traps an existing track without playback or clear actions", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  let previews = 0
  let clears = 0
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{ source:"https://example.test/legacy.mp3", durationMs:0 },
    onProbe:async () => { throw new Error("无法读取这条旧链接") },
    onPreview() { previews += 1 },
    onClear() { clears += 1 },
  })
  dom.window.document.body.appendChild(editor.element)
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.match(editor.element.querySelector(".audio-clip-note").textContent, /无法读取这条旧链接/)
  editor.element.querySelector("[data-audio-clip-preview]").click()
  editor.element.querySelector("[data-audio-clip-clear]").click()
  assert.equal(previews, 1)
  assert.equal(clears, 0)
  assert.match(editor.element.querySelector("[data-audio-clip-clear]").textContent, /确认/)
  editor.element.querySelector("[data-audio-clip-clear]").click()
  assert.equal(clears, 1)
  editor.destroy()
  dom.window.close()
})

test("an in-progress physical trim exposes an unambiguous cancel action", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual:true })
  const editor = createInteractiveBgmClipEditor({
    documentObject:dom.window.document,
    track:{
      source:`asset://${"9".repeat(64)}`,
      fileName:"长歌.mp3",
      durationMs:180_000,
      startMs:10_000,
      endMs:25_000,
    },
    onPreview() {},
    onStop() {},
    onClear() {},
    onRangeChange() {},
    onTrim:async (range, handlers) => new Promise((resolve, reject) => {
      handlers.signal.addEventListener("abort", () => {
        const error = new Error("cancelled")
        error.name = "AbortError"
        reject(error)
      }, { once:true })
    }),
  })
  dom.window.document.body.appendChild(editor.element)
  editor.element.querySelector("[data-audio-clip-trim]").click()
  await Promise.resolve()

  const cancel = editor.element.querySelector("[data-audio-clip-cancel]")
  assert.equal(cancel.hidden, false)
  assert.equal(editor.element.querySelector("[data-audio-clip-preview]").disabled, true)
  assert.equal(editor.element.querySelector("[data-audio-clip-clear]").disabled, true)
  cancel.click()
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))

  assert.equal(cancel.hidden, true)
  assert.match(editor.element.querySelector("[data-audio-clip-status]").textContent, /已取消裁剪.*完整音频仍保留/)
  assert.equal(editor.element.querySelector("[data-audio-clip-trim]").disabled, false)
  editor.destroy()
  dom.window.close()
})
