import { AUDIO_CLIP_LIMITS, normalizeAudioRange } from "./audio-clip.js"
import { normalizeInteractiveBgm } from "./interactive-bgm.js"

function button(documentObject, label, className = "") {
  const control = documentObject.createElement("button")
  control.type = "button"
  control.className = className
  control.textContent = label
  return control
}

function guardedClearButton(documentObject, onClear) {
  const control = button(documentObject, "清除音乐", "btn btn-sm btn-ghost audio-clip-clear")
  control.dataset.audioClipClear = ""
  control.dataset.audioClipIdleAction = ""
  let armed = false
  const reset = () => {
    armed = false
    control.classList.remove("is-confirming")
    control.textContent = "清除音乐"
  }
  control.addEventListener("click", () => {
    if (!armed) {
      armed = true
      control.classList.add("is-confirming")
      control.textContent = "再次点击确认清除"
      return
    }
    reset()
    onClear?.()
  })
  control.addEventListener("blur", reset)
  return control
}

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Number(milliseconds || 0) / 1000)
  if (seconds < 60) return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} 秒`
  return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0)
  if (!value) return ""
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MiB`
  return `${Math.max(1, Math.round(value / 1024))} KiB`
}

function localAssetSource(source) {
  return /^asset:\/\/[a-f0-9]{64}$/i.test(String(source || ""))
}

function rangeTrack(track, range) {
  return normalizeInteractiveBgm({
    ...track,
    startMs:range.startMs,
    endMs:range.endMs >= track.durationMs ? null : range.endMs,
  })
}

export function createInteractiveBgmClipEditor(options = {}) {
  const documentObject = options.documentObject || globalThis.document
  if (!documentObject?.createElement) throw new Error("当前环境无法显示音频片段编辑器")
  const element = documentObject.createElement("section")
  element.className = `audio-clip-editor${options.compact ? " is-compact" : ""}`
  element.dataset.audioClipEditor = ""
  element.setAttribute("aria-label", options.label || "BGM 播放片段")
  let track = normalizeInteractiveBgm(options.track)
  let destroyed = false
  let trimController = null

  function commitRange(range) {
    track = rangeTrack(track, range)
    options.onRangeChange?.({ startMs:track.startMs, endMs:track.endMs })
  }

  function render() {
    if (destroyed) return
    element.replaceChildren()
    const header = documentObject.createElement("header")
    header.className = "audio-clip-header"
    const heading = documentObject.createElement("div")
    const title = documentObject.createElement("strong")
    title.textContent = "播放片段"
    const metadata = documentObject.createElement("small")
    metadata.dataset.audioClipMetadata = ""
    const metadataBits = []
    if (track.durationMs) metadataBits.push(`全曲 ${formatClock(track.durationMs)}`)
    if (track.bytes) metadataBits.push(formatBytes(track.bytes))
    metadata.textContent = metadataBits.join(" · ") || "正在读取音频时长…"
    heading.append(title, metadata)
    const summary = documentObject.createElement("output")
    summary.dataset.audioClipSummary = ""
    header.append(heading, summary)
    element.appendChild(header)

    if (!track.durationMs) {
      const loading = documentObject.createElement("p")
      loading.className = "audio-clip-note"
      loading.textContent = "音频时长读取完成后，就能选择开始与结束位置。"
      element.appendChild(loading)
      const fallbackActions = documentObject.createElement("div")
      fallbackActions.className = "audio-clip-actions"
      if (typeof options.onPreview === "function") {
        const preview = button(documentObject, "试听全曲", "btn btn-sm btn-outline")
        preview.dataset.audioClipPreview = ""
        preview.dataset.audioClipIdleAction = ""
        preview.addEventListener("click", () => options.onPreview?.())
        fallbackActions.appendChild(preview)
      }
      if (typeof options.onStop === "function") {
        const stop = button(documentObject, "停止", "btn btn-sm btn-ghost")
        stop.dataset.audioClipIdleAction = ""
        stop.addEventListener("click", () => options.onStop?.())
        fallbackActions.appendChild(stop)
      }
      if (typeof options.onClear === "function") {
        fallbackActions.appendChild(guardedClearButton(documentObject, options.onClear))
      }
      if (fallbackActions.childElementCount) element.appendChild(fallbackActions)
      return
    }

    let range = normalizeAudioRange(track, track.durationMs)
    const timeline = documentObject.createElement("div")
    timeline.className = "audio-clip-timeline"
    const rail = documentObject.createElement("div")
    rail.className = "audio-clip-rail"
    rail.setAttribute("aria-hidden", "true")
    const selection = documentObject.createElement("span")
    rail.appendChild(selection)
    timeline.appendChild(rail)

    const controls = documentObject.createElement("div")
    controls.className = "audio-clip-range-controls"
    const startControl = documentObject.createElement("input")
    startControl.type = "range"
    startControl.min = "0"
    startControl.max = String(Math.max(0, track.durationMs - AUDIO_CLIP_LIMITS.minimumMs))
    startControl.step = "100"
    startControl.value = String(range.startMs)
    startControl.dataset.audioClipStart = ""
    startControl.setAttribute("aria-label", "片段开始时间")
    const endControl = documentObject.createElement("input")
    endControl.type = "range"
    endControl.min = String(Math.min(track.durationMs, AUDIO_CLIP_LIMITS.minimumMs))
    endControl.max = String(track.durationMs)
    endControl.step = "100"
    endControl.value = String(range.endMs)
    endControl.dataset.audioClipEnd = ""
    endControl.setAttribute("aria-label", "片段结束时间")

    function labelledRange(labelText, control, outputKey) {
      const label = documentObject.createElement("label")
      const copy = documentObject.createElement("span")
      copy.textContent = labelText
      const value = documentObject.createElement("output")
      value.dataset[outputKey] = ""
      label.append(copy, control, value)
      return label
    }
    controls.append(
      labelledRange("开始", startControl, "audioClipStartValue"),
      labelledRange("结束", endControl, "audioClipEndValue"),
    )
    timeline.appendChild(controls)
    element.appendChild(timeline)

    let trimButton = null
    let resetButton = null
    let cancelTrimButton = null
    const syncRangeActionState = () => {
      const busy = Boolean(trimController)
      const isFullTrack = range.startMs === 0 && range.endMs === track.durationMs
      startControl.disabled = busy
      endControl.disabled = busy
      element.querySelectorAll("[data-audio-clip-idle-action]").forEach(control => { control.disabled = busy })
      if (trimButton) trimButton.disabled = busy || isFullTrack
      if (resetButton) resetButton.disabled = busy || isFullTrack
      if (cancelTrimButton) cancelTrimButton.hidden = !busy
    }

    const updateRangeView = () => {
      range = normalizeAudioRange({ startMs:Number(startControl.value), endMs:Number(endControl.value) }, track.durationMs)
      startControl.value = String(range.startMs)
      endControl.value = String(range.endMs)
      startControl.max = String(Math.max(0, range.endMs - AUDIO_CLIP_LIMITS.minimumMs))
      endControl.min = String(Math.min(track.durationMs, range.startMs + AUDIO_CLIP_LIMITS.minimumMs))
      startControl.setAttribute("aria-valuetext", formatDuration(range.startMs))
      endControl.setAttribute("aria-valuetext", formatDuration(range.endMs))
      controls.querySelector("[data-audio-clip-start-value]").textContent = formatClock(range.startMs)
      controls.querySelector("[data-audio-clip-end-value]").textContent = formatClock(range.endMs)
      summary.textContent = `${formatClock(range.startMs)} — ${formatClock(range.endMs)} · ${formatDuration(range.durationMs)}`
      const startPercent = range.startMs / track.durationMs * 100
      const endPercent = range.endMs / track.durationMs * 100
      rail.style.setProperty("--audio-clip-start", `${startPercent}%`)
      rail.style.setProperty("--audio-clip-end", `${100 - endPercent}%`)
      syncRangeActionState()
    }
    startControl.addEventListener("input", updateRangeView)
    endControl.addEventListener("input", updateRangeView)
    startControl.addEventListener("change", () => { updateRangeView(); commitRange(range) })
    endControl.addEventListener("change", () => { updateRangeView(); commitRange(range) })
    updateRangeView()

    const actions = documentObject.createElement("div")
    actions.className = "audio-clip-actions"
    const canTrim = localAssetSource(track.source) && typeof options.onTrim === "function"
    if (canTrim) {
      trimButton = button(documentObject, "裁剪并只保留这段", "btn btn-sm btn-primary")
      trimButton.dataset.audioClipTrim = ""
      actions.appendChild(trimButton)
      cancelTrimButton = button(documentObject, "取消裁剪", "btn btn-sm btn-outline")
      cancelTrimButton.dataset.audioClipCancel = ""
      cancelTrimButton.hidden = true
      cancelTrimButton.addEventListener("click", () => trimController?.abort())
      actions.appendChild(cancelTrimButton)
    }
    if (typeof options.onPreview === "function") {
      const preview = button(documentObject, "试听片段", "btn btn-sm btn-outline")
      preview.dataset.audioClipPreview = ""
      preview.dataset.audioClipIdleAction = ""
      preview.addEventListener("click", () => options.onPreview?.())
      actions.appendChild(preview)
    }
    if (typeof options.onStop === "function") {
      const stop = button(documentObject, "停止", "btn btn-sm btn-ghost")
      stop.dataset.audioClipIdleAction = ""
      stop.addEventListener("click", () => options.onStop?.())
      actions.appendChild(stop)
    }
    resetButton = button(documentObject, "恢复全曲", "btn btn-sm btn-ghost")
    resetButton.dataset.audioClipReset = ""
    resetButton.dataset.audioClipIdleAction = ""
    resetButton.addEventListener("click", () => {
      startControl.value = "0"
      endControl.value = String(track.durationMs)
      updateRangeView()
      commitRange(range)
      render()
    })
    actions.appendChild(resetButton)
    if (typeof options.onClear === "function") {
      actions.appendChild(guardedClearButton(documentObject, options.onClear))
    }
    element.appendChild(actions)
    syncRangeActionState()

    const progress = documentObject.createElement("progress")
    progress.max = 1
    progress.value = 0
    progress.hidden = true
    progress.dataset.audioClipProgress = ""
    element.appendChild(progress)
    const status = documentObject.createElement("p")
    status.className = "audio-clip-note"
    status.dataset.audioClipStatus = ""
    status.setAttribute("role", "status")
    status.setAttribute("aria-live", "polite")
    status.textContent = canTrim
      ? "裁剪会按所选时长实时处理并重新编码；成功后，导出包只携带新片段。"
      : "这里只控制播放区间，不会缩小远程文件；改用本地音频后可裁剪瘦身。"
    element.appendChild(status)

    trimButton?.addEventListener("click", async () => {
      if (trimController || destroyed) return
      trimController = new AbortController()
      options.onStop?.()
      syncRangeActionState()
      progress.hidden = false
      status.classList.remove("is-error", "is-success")
      status.textContent = `正在裁剪 ${formatDuration(range.durationMs)}，请保持页面开启…`
      try {
        await options.onTrim(
          { startMs:range.startMs, endMs:range.endMs },
          {
            signal:trimController.signal,
            onProgress(value) {
              const ratio = Math.min(1, Math.max(0, Number(value?.ratio) || 0))
              progress.value = ratio
              status.textContent = `正在裁剪 ${Math.round(ratio * 100)}% · 请保持页面开启…`
            },
          },
        )
        if (destroyed) return
        progress.value = 1
        status.classList.add("is-success")
        status.textContent = "裁剪完成，作品现在只引用所选片段。"
      } catch (error) {
        if (destroyed) return
        if (error?.name === "AbortError") {
          progress.hidden = true
          status.textContent = "已取消裁剪；完整音频仍保留，并继续按所选区间播放。"
          return
        }
        status.classList.add("is-error")
        status.textContent = `${String(error?.message || "裁剪失败")}；完整音频仍保留，并继续按所选区间播放。`
      } finally {
        trimController = null
        if (!destroyed) syncRangeActionState()
      }
    })
  }

  render()
  if (!track.durationMs && typeof options.onProbe === "function") {
    Promise.resolve(options.onProbe()).then(metadata => {
      if (destroyed || !metadata?.durationMs) return
      track = normalizeInteractiveBgm({ ...track, ...metadata })
      options.onMetadata?.({ durationMs:track.durationMs, bytes:track.bytes })
      render()
    }).catch(error => {
      if (destroyed) return
      const metadata = element.querySelector("[data-audio-clip-metadata]")
      if (metadata) metadata.textContent = "音频时长读取失败"
      const note = element.querySelector(".audio-clip-note")
      if (note) {
        note.classList.add("is-error")
        note.textContent = String(error?.message || "无法读取音频时长")
      }
    })
  }

  return Object.freeze({
    element,
    destroy() {
      destroyed = true
      trimController?.abort()
      trimController = null
      element.replaceChildren()
    },
  })
}
