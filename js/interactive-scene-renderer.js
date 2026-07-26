import {
  normalizeInteractiveDialogueStyle,
  normalizeInteractivePromptStyle,
  normalizeInteractiveScene,
  resolveInteractiveSceneStage,
} from "./interactive-scene-model.js"
import { projectHotspotToMediaViewport } from "./interactive-scene-geometry.js"

function appendTextElement(documentObject, parent, tag, className, text) {
  const element = documentObject.createElement(tag)
  element.className = className
  element.textContent = text
  parent.appendChild(element)
  return element
}

function safeImageSource(value) {
  const source = String(value || "").trim()
  if (/^https:\/\//i.test(source)) return source
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source
  if (source && !/^[a-z][a-z0-9+.-]*:/i.test(source)) return source
  return ""
}

function safeVideoSource(value) {
  const source = String(value || "").trim()
  if (/^https:\/\//i.test(source)) return source
  if (/^data:video\/(?:mp4|webm);base64,/i.test(source)) return source
  if (source && !/^[a-z][a-z0-9+.-]*:/i.test(source)) return source
  return ""
}

function setOptionalImageSource(element, value) {
  const source = safeImageSource(value)
  if (!source) {
    element.removeAttribute("src")
    element.hidden = true
    return false
  }
  element.src = source
  element.hidden = false
  return true
}

function triggerLabel(trigger) {
  if (trigger === "hold") return "长按互动"
  if (trigger === "swipe") return "滑动互动"
  if (trigger === "face-near") return "靠近互动"
  if (trigger === "face-near-tap") return "靠近后点击"
  if (trigger === "face-near-hold") return "靠近后长按"
  return "点击互动"
}

function isCameraTrigger(trigger) {
  return trigger === "face-near"
    || trigger === "face-near-tap"
    || trigger === "face-near-hold"
}

function polygonClipPath(points) {
  if (!Array.isArray(points) || points.length < 3) return ""
  return `polygon(${points.map(point => `${point.x}% ${point.y}%`).join(", ")})`
}

export function mountInteractiveScene(container, sceneValue, options = {}) {
  if (!container) throw new TypeError("interactive scene container is required")
  const documentObject = options.documentObject || container.ownerDocument || document
  let scene = options.normalized === true ? sceneValue : normalizeInteractiveScene(sceneValue)
  const cameraState = options.cameraState || {}
  let stage = scene.stages.find(candidate => candidate.id === options.stageId)
    || scene.stages.find(candidate => candidate.id === scene.startStageId)
    || scene.stages[0]
  let holdTimer = null
  let faceArmed = false
  let usingFallback = false
  let destroyed = false
  let resizeObserver = null
  let pendingCombinationTap = null
  let faceArmTimer = null
  let faceArmedUntil = 0
  let actionFrameActive = false
  let actionFrameTimer = null
  let explorationNotice = ""
  let sceneCompleted = false
  const exploredHotspotsByStage = new Map()
  const combinationLeadWindowMs = Number.isFinite(options.combinationLeadWindowMs)
    ? Math.max(0, options.combinationLeadWindowMs)
    : 900
  const combinationFollowWindowMs = Number.isFinite(options.combinationFollowWindowMs)
    ? Math.max(0, options.combinationFollowWindowMs)
    : 3000
  const readNow = typeof options.now === "function" ? options.now : Date.now
  const scheduleTimeout = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout
  const cancelTimeout = typeof options.clearTimeout === "function" ? options.clearTimeout : clearTimeout

  container.replaceChildren()
  const root = documentObject.createElement("section")
  root.className = "interactive-scene"
  root.dataset.sceneId = scene.id
  root.setAttribute("aria-label", scene.title || "互动场景")
  container.appendChild(root)

  const media = documentObject.createElement("div")
  media.className = "interactive-scene-media"
  root.appendChild(media)

  const backgroundImage = documentObject.createElement("img")
  backgroundImage.className = "interactive-scene-background"
  backgroundImage.decoding = "async"
  backgroundImage.draggable = false
  media.appendChild(backgroundImage)

  const characterImage = documentObject.createElement("img")
  characterImage.className = "interactive-scene-character"
  characterImage.decoding = "async"
  characterImage.draggable = false
  media.appendChild(characterImage)

  const actionFrame = documentObject.createElement("div")
  actionFrame.className = "interactive-scene-action-frame"
  actionFrame.hidden = true
  const actionImage = documentObject.createElement("img")
  actionImage.className = "interactive-scene-action-image"
  actionImage.alt = ""
  actionImage.decoding = "async"
  actionImage.draggable = false
  actionImage.hidden = true
  const actionVideo = documentObject.createElement("video")
  actionVideo.className = "interactive-scene-action-video"
  actionVideo.muted = true
  actionVideo.loop = false
  actionVideo.playsInline = true
  actionVideo.autoplay = true
  actionVideo.preload = "auto"
  actionVideo.hidden = true
  actionFrame.append(actionImage, actionVideo)
  media.appendChild(actionFrame)

  const hotspotLayer = documentObject.createElement("div")
  hotspotLayer.className = "interactive-scene-hotspots"
  media.appendChild(hotspotLayer)

  const prompt = appendTextElement(documentObject, root, "div", "interactive-scene-prompt", "")
  prompt.setAttribute("aria-live", "polite")

  const dialogue = documentObject.createElement("div")
  dialogue.className = "interactive-scene-dialogue"
  const dialogueFrame = documentObject.createElement("img")
  dialogueFrame.className = "interactive-scene-dialogue-frame"
  dialogueFrame.alt = ""
  dialogueFrame.draggable = false
  dialogue.appendChild(dialogueFrame)
  const dialogueContent = documentObject.createElement("div")
  dialogueContent.className = "interactive-scene-dialogue-content"
  const speaker = appendTextElement(documentObject, dialogueContent, "strong", "interactive-scene-dialogue-speaker", "")
  const dialogueText = appendTextElement(documentObject, dialogueContent, "p", "interactive-scene-dialogue-text", "")
  dialogue.appendChild(dialogueContent)
  root.appendChild(dialogue)

  const status = appendTextElement(documentObject, root, "div", "interactive-scene-status", "")
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")

  function effectiveTrigger(hotspot) {
    if (!isCameraTrigger(hotspot.trigger)) return hotspot.trigger
    return cameraState.granted ? hotspot.trigger : hotspot.fallbackTrigger
  }

  function renderStatus() {
    if (faceArmed) {
      status.textContent = "已检测到靠近，请点击或长按对应互动位置。"
    } else if (explorationNotice) {
      status.textContent = explorationNotice
    } else if (cameraState.granted && !cameraState.detectorAvailable) {
      status.textContent = "摄像头已授权，但当前浏览器无法进行靠近识别；靠近互动不会降级为普通点击。"
    } else {
      status.textContent = usingFallback ? "摄像头互动不可用，已启用作者设置的备用互动。" : ""
    }
    status.hidden = !status.textContent
  }

  function nextStage() {
    const currentIndex = scene.stages.findIndex(candidate => candidate.id === stage.id)
    return currentIndex >= 0 ? scene.stages[currentIndex + 1] || null : null
  }

  function exploredHotspots() {
    let explored = exploredHotspotsByStage.get(stage.id)
    if (!explored) {
      explored = new Set()
      exploredHotspotsByStage.set(stage.id, explored)
    }
    return explored
  }

  function syncExplorationState() {
    const explored = exploredHotspots()
    const remaining = stage.hotspots.filter(hotspot => !explored.has(hotspot.id)).length
    const followingStage = nextStage()
    const canFinish = !followingStage && typeof options.onSceneComplete === "function"
    const canAdvance = (Boolean(followingStage) || canFinish) && options.interactive !== false
    const ready = canAdvance && remaining === 0
    root.dataset.exploredHotspots = String(stage.hotspots.length - remaining)
    root.dataset.totalHotspots = String(stage.hotspots.length)
    root.dataset.explorationComplete = String(remaining === 0)
    dialogue.dataset.hasNext = String(canAdvance)
    dialogue.dataset.completesScene = String(canFinish)
    dialogue.dataset.advanceReady = String(ready)
    dialogue.tabIndex = canAdvance ? 0 : -1
    if (canAdvance) {
      dialogue.setAttribute("role", "button")
      dialogue.setAttribute(
        "aria-label",
        ready
          ? (canFinish ? "已探索最后一个画面，继续阅读正文" : "已探索当前画面，进入下一画面")
          : `当前画面还有 ${remaining} 个互动位置尚未探索`,
      )
    } else {
      dialogue.removeAttribute("role")
      dialogue.removeAttribute("aria-label")
    }
    hotspotLayer.querySelectorAll(".interactive-scene-hotspot").forEach(button => {
      button.dataset.explored = String(explored.has(button.dataset.hotspotId))
    })
    if (ready && !speaker.textContent && !dialogueText.textContent) dialogue.hidden = false
    return { remaining, followingStage, canFinish, ready }
  }

  function attemptDialogueAdvance() {
    if (destroyed || options.interactive === false) return
    const progress = syncExplorationState()
    if (actionFrameActive) {
      clearActionFrame({ restoreDialogue: true })
      if (!progress.followingStage || progress.remaining > 0) {
        explorationNotice = ""
        root.dataset.advanceBlocked = "false"
        renderStatus()
        return
      }
    }
    if (progress.remaining > 0) {
      explorationNotice = `还有 ${progress.remaining} 个互动位置尚未探索。`
      root.dataset.advanceBlocked = "true"
      renderStatus()
      return
    }
    if (!progress.followingStage) {
      if (!progress.canFinish || sceneCompleted) return
      sceneCompleted = true
      options.onSceneComplete?.({ scene, stage })
      return
    }
    const previousStage = stage
    stage = progress.followingStage
    explorationNotice = ""
    root.dataset.advanceBlocked = "false"
    renderStage()
    options.onStageChange?.({ scene, stage, previousStage })
  }

  function setFaceArmed(value) {
    if (faceArmTimer !== null) {
      cancelTimeout(faceArmTimer)
      faceArmTimer = null
    }
    faceArmed = Boolean(value)
    if (faceArmed) {
      const timestamp = Number(readNow())
      faceArmedUntil = (Number.isFinite(timestamp) ? timestamp : Date.now()) + combinationFollowWindowMs
      faceArmTimer = scheduleTimeout(() => {
        faceArmTimer = null
        setFaceArmed(false)
      }, combinationFollowWindowMs)
    } else {
      faceArmedUntil = 0
    }
    root.dataset.faceArmed = String(faceArmed)
    hotspotLayer.querySelectorAll(".interactive-scene-hotspot").forEach(button => {
      const hotspot = stage.hotspots.find(candidate => candidate.id === button.dataset.hotspotId)
      const combination = hotspot?.trigger === "face-near-tap" || hotspot?.trigger === "face-near-hold"
      button.dataset.faceArmed = String(faceArmed && combination)
    })
    renderStatus()
  }

  function updateDialogue(speakerText, text) {
    if (speakerText !== undefined) speaker.textContent = speakerText
    if (text !== undefined) dialogueText.textContent = text
    speaker.hidden = !speaker.textContent
    dialogue.hidden = !speaker.textContent && !dialogueText.textContent
  }

  function clearActionFrame({ restoreDialogue = false } = {}) {
    if (actionFrameTimer !== null) {
      cancelTimeout(actionFrameTimer)
      actionFrameTimer = null
    }
    actionFrameActive = false
    root.dataset.actionFrameActive = "false"
    actionFrame.hidden = true
    actionImage.hidden = true
    actionImage.removeAttribute("src")
    actionVideo.hidden = true
    if (!actionVideo.paused) {
      try { actionVideo.pause() } catch (_) {}
    }
    actionVideo.removeAttribute("src")
    if (restoreDialogue) updateDialogue(stage.dialogue.speaker, stage.dialogue.text)
  }

  function finishActionFrame() {
    if (!actionFrameActive) return
    clearActionFrame({ restoreDialogue: true })
    renderStatus()
    options.onActionFrameEnd?.({ scene, stage })
  }

  function showActionFrame(hotspot) {
    const frame = hotspot?.actionFrame
    if (!frame?.enabled) {
      clearActionFrame()
      return false
    }
    const source = frame.type === "video"
      ? safeVideoSource(frame.source)
      : safeImageSource(frame.source)
    if (!source) {
      clearActionFrame()
      return false
    }

    actionFrameActive = true
    root.dataset.actionFrameActive = "true"
    actionFrame.hidden = false
    actionImage.hidden = frame.type === "video"
    actionVideo.hidden = frame.type !== "video"
    if (frame.type === "video") {
      actionImage.removeAttribute("src")
      actionVideo.src = source
      actionVideo.style.objectFit = frame.fit
      if (options.playActionMedia !== false) {
        try {
          const playback = actionVideo.play()
          playback?.catch?.(() => {})
        } catch (_) {}
      }
    } else {
      actionVideo.removeAttribute("src")
      actionImage.src = source
      actionImage.style.objectFit = frame.fit
      const duration = frame.gifDurationMs > 0 ? frame.gifDurationMs : frame.durationMs
      actionFrameTimer = scheduleTimeout(() => {
        actionFrameTimer = null
        finishActionFrame()
      }, duration)
    }
    return true
  }

  function showHotspotReaction(hotspot) {
    showActionFrame(hotspot)
    const reactionSpeaker = hotspot.speaker
    const reactionDialogue = hotspot.dialogue
    if (reactionSpeaker || reactionDialogue) {
      updateDialogue(
        reactionSpeaker || stage.dialogue.speaker,
        reactionDialogue || dialogueText.textContent,
      )
    }
  }

  function activate(hotspot) {
    if (destroyed) return
    pendingCombinationTap = null
    setFaceArmed(false)
    exploredHotspots().add(hotspot.id)
    explorationNotice = ""
    root.dataset.advanceBlocked = "false"
    options.onInteraction?.({ scene, stage, hotspot })
    showHotspotReaction(hotspot)
    const progress = syncExplorationState()
    if (progress.ready) explorationNotice = "本画面已探索完毕，点击对话框继续。"
    renderStatus()
    options.onComplete?.({ scene, stage, hotspot })
  }

  function bindHotspot(button, hotspot) {
    const trigger = effectiveTrigger(hotspot)
    button.dataset.activeTrigger = trigger
    button.setAttribute("aria-label", `${hotspot.label}，${triggerLabel(trigger)}`)

    const canUseCombination = () => {
      if (trigger !== "face-near-tap" && trigger !== "face-near-hold") return true
      const timestamp = Number(readNow())
      if (faceArmed && faceArmedUntil < (Number.isFinite(timestamp) ? timestamp : Date.now())) {
        setFaceArmed(false)
      }
      return faceArmed
    }

    if (trigger === "tap") {
      button.addEventListener("click", () => activate(hotspot))
      return
    }
    if (trigger === "hold" || trigger === "face-near-hold") {
      const cancel = () => {
        if (holdTimer !== null) clearTimeout(holdTimer)
        holdTimer = null
      }
      button.addEventListener("pointerdown", event => {
        if (!canUseCombination(event)) return
        event.preventDefault()
        cancel()
        button.classList.add("is-holding")
        holdTimer = setTimeout(() => {
          button.classList.remove("is-holding")
          holdTimer = null
          if (canUseCombination()) activate(hotspot)
        }, hotspot.holdMs)
      })
      for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
        button.addEventListener(eventName, () => {
          button.classList.remove("is-holding")
          cancel()
        })
      }
      button.addEventListener("click", event => {
        if (event.detail === 0 && canUseCombination()) activate(hotspot)
      })
      return
    }
    if (trigger === "swipe") {
      let startPoint = null
      button.addEventListener("pointerdown", event => {
        event.preventDefault()
        startPoint = { x: event.clientX, y: event.clientY }
        try { button.setPointerCapture?.(event.pointerId) } catch (_) {}
      })
      button.addEventListener("pointerup", event => {
        if (!startPoint) return
        const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)
        startPoint = null
        try { button.releasePointerCapture?.(event.pointerId) } catch (_) {}
        if (distance >= 36) activate(hotspot)
      })
      button.addEventListener("pointercancel", () => { startPoint = null })
      button.addEventListener("click", event => {
        if (event.detail === 0) activate(hotspot)
      })
      return
    }
    if (trigger === "face-near-tap") {
      button.addEventListener("click", event => {
        if (canUseCombination()) {
          activate(hotspot)
          return
        }
        const timestamp = Number(readNow())
        pendingCombinationTap = {
          hotspotId: hotspot.id,
          expiresAt: (Number.isFinite(timestamp) ? timestamp : Date.now()) + combinationLeadWindowMs,
        }
      })
      return
    }
    button.addEventListener("click", event => {
      if (event.detail === 0) activate(hotspot)
    })
  }

  function renderMediaImage(element, source, alt, fit, transform) {
    const hasSource = setOptionalImageSource(element, source)
    element.alt = alt
    element.style.objectFit = fit
    element.style.setProperty("--interactive-media-scale", String(transform.scale))
    element.style.setProperty("--interactive-media-x", `${transform.x}%`)
    element.style.setProperty("--interactive-media-y", `${transform.y}%`)
    return hasSource
  }

  function layoutHotspots() {
    const rect = hotspotLayer.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const sourceImage = backgroundImage.naturalWidth && backgroundImage.naturalHeight
      ? backgroundImage
      : characterImage.naturalWidth && characterImage.naturalHeight
        ? characterImage
        : null
    if (!sourceImage) return
    const usingBackground = sourceImage === backgroundImage
    const fit = usingBackground ? stage.fit : stage.characterFit
    const transform = usingBackground ? stage.mediaTransform : stage.characterTransform

    hotspotLayer.querySelectorAll(".interactive-scene-hotspot").forEach(button => {
      const hotspot = stage.hotspots.find(candidate => candidate.id === button.dataset.hotspotId)
      if (!hotspot) return
      const projected = projectHotspotToMediaViewport(hotspot, {
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        sourceWidth: sourceImage.naturalWidth,
        sourceHeight: sourceImage.naturalHeight,
        fit,
        transform,
      })
      button.style.left = `${projected.x}%`
      button.style.top = `${projected.y}%`
      button.style.width = `${projected.width}%`
      button.style.height = `${projected.height}%`
    })
  }

  function renderStage({ preserveHotspots = false } = {}) {
    root.dataset.stageId = stage.id
    setFaceArmed(false)
    clearActionFrame()
    pendingCombinationTap = null
    explorationNotice = ""
    root.dataset.advanceBlocked = "false"
    const hasBackground = renderMediaImage(
      backgroundImage,
      stage.image,
      stage.alt,
      stage.fit,
      stage.mediaTransform,
    )
    const hasCharacter = renderMediaImage(
      characterImage,
      stage.characterImage,
      stage.characterAlt,
      stage.characterFit,
      stage.characterTransform,
    )
    media.classList.toggle("is-empty", !hasBackground && !hasCharacter)

    prompt.textContent = stage.prompt
    prompt.hidden = !stage.prompt
    const promptStyle = normalizeInteractivePromptStyle(scene.promptStyle)
    prompt.style.setProperty("--interactive-prompt-surface", promptStyle.surfaceColor)
    prompt.style.setProperty("--interactive-prompt-text", promptStyle.textColor)
    prompt.style.setProperty("--interactive-prompt-border", promptStyle.borderColor)
    prompt.style.setProperty("--interactive-prompt-opacity", `${promptStyle.opacity}%`)
    prompt.style.setProperty("--interactive-prompt-radius", `${promptStyle.borderRadius}px`)
    prompt.dataset.position = promptStyle.position

    const style = normalizeInteractiveDialogueStyle({
      ...scene.dialogueStyle,
      ...(stage.dialogue.style || {}),
    })
    dialogue.style.setProperty("--interactive-dialogue-surface", style.surfaceColor)
    dialogue.style.setProperty("--interactive-dialogue-text", style.textColor)
    dialogue.style.setProperty("--interactive-dialogue-accent", style.accentColor)
    dialogue.style.setProperty("--interactive-dialogue-border", style.borderColor)
    dialogue.style.setProperty("--interactive-dialogue-opacity", `${style.opacity}%`)
    dialogue.style.setProperty("--interactive-dialogue-radius", `${style.borderRadius}px`)
    dialogue.style.setProperty("--interactive-dialogue-width", `${style.width}%`)
    dialogue.style.setProperty("--interactive-dialogue-height", `${style.height}%`)
    dialogue.dataset.position = style.position
    setOptionalImageSource(dialogueFrame, style.frameImage)
    dialogueFrame.style.setProperty("--interactive-dialogue-frame-outset", `${style.frameOutset}px`)
    updateDialogue(stage.dialogue.speaker, stage.dialogue.text)

    if (!preserveHotspots) {
      hotspotLayer.replaceChildren()
      usingFallback = false
      stage.hotspots.forEach(hotspot => {
        const button = documentObject.createElement("button")
        button.type = "button"
        button.className = "interactive-scene-hotspot"
        button.dataset.hotspotId = hotspot.id
        button.style.left = `${hotspot.x}%`
        button.style.top = `${hotspot.y}%`
        button.style.width = `${hotspot.width}%`
        button.style.height = `${hotspot.height}%`
        button.dataset.shape = hotspot.shape
        const clipPath = hotspot.shape === "polygon" ? polygonClipPath(hotspot.points) : ""
        button.style.clipPath = clipPath
        button.style.setProperty("--interactive-hotspot-clip", clipPath || "none")
        if (isCameraTrigger(hotspot.trigger) && effectiveTrigger(hotspot) !== hotspot.trigger) usingFallback = true
        if (options.interactive !== false) bindHotspot(button, hotspot)
        hotspotLayer.appendChild(button)
      })
    }
    layoutHotspots()
    root.dataset.faceArmed = "false"
    syncExplorationState()
    renderStatus()

    const followingStage = nextStage()
    if (followingStage) {
      for (const source of [followingStage.image, followingStage.characterImage]) {
        if (!safeImageSource(source)) continue
        const preload = new documentObject.defaultView.Image()
        preload.src = safeImageSource(source)
      }
    }
  }

  function handleFaceNear() {
    const direct = stage.hotspots.find(candidate => (
      candidate.trigger === "face-near" && effectiveTrigger(candidate) === "face-near"
    ))
    if (direct) {
      activate(direct)
      return
    }
    const combinations = stage.hotspots.filter(candidate => (
      (candidate.trigger === "face-near-tap" || candidate.trigger === "face-near-hold")
      && effectiveTrigger(candidate) === candidate.trigger
    ))
    if (!combinations.length) return

    const timestamp = Number(readNow())
    const pendingTap = pendingCombinationTap
    pendingCombinationTap = null
    const pendingHotspot = pendingTap
      && pendingTap.expiresAt >= (Number.isFinite(timestamp) ? timestamp : Date.now())
      ? combinations.find(candidate => (
        candidate.trigger === "face-near-tap" && candidate.id === pendingTap.hotspotId
      ))
      : null
    if (pendingHotspot) {
      activate(pendingHotspot)
      return
    }
    setFaceArmed(true)
  }

  const unsubscribe = typeof cameraState.subscribe === "function"
    ? cameraState.subscribe(handleFaceNear)
    : null
  dialogue.addEventListener("click", attemptDialogueAdvance)
  dialogue.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    attemptDialogueAdvance()
  })
  backgroundImage.addEventListener("load", layoutHotspots)
  characterImage.addEventListener("load", layoutHotspots)
  actionVideo.addEventListener("ended", finishActionFrame)
  const ResizeObserverConstructor = documentObject.defaultView?.ResizeObserver
    || globalThis.ResizeObserver
  if (typeof ResizeObserverConstructor === "function") {
    resizeObserver = new ResizeObserverConstructor(layoutHotspots)
    resizeObserver.observe(hotspotLayer)
  } else {
    documentObject.defaultView?.addEventListener("resize", layoutHotspots)
  }

  renderStage()

  return {
    get scene() { return scene },
    get stage() { return stage },
    goToStage(stageId) {
      sceneCompleted = false
      stage = resolveInteractiveSceneStage(scene, stageId)
      renderStage()
      return stage
    },
    updateScene(nextSceneValue, stageId, updateOptions = {}) {
      sceneCompleted = false
      const previousStage = stage
      scene = updateOptions.normalized === true
        ? nextSceneValue
        : normalizeInteractiveScene(nextSceneValue)
      stage = scene.stages.find(candidate => candidate.id === stageId)
        || scene.stages.find(candidate => candidate.id === scene.startStageId)
        || scene.stages[0]
      renderStage({
        preserveHotspots:previousStage?.id === stage?.id
          && previousStage?.hotspots === stage?.hotspots,
      })
      return stage
    },
    previewHotspotReaction(hotspotId) {
      const hotspot = stage.hotspots.find(candidate => candidate.id === hotspotId)
      if (!hotspot) return false
      showHotspotReaction(hotspot)
      return true
    },
    clearHotspotReaction() {
      clearActionFrame({ restoreDialogue: true })
    },
    signalFaceNear: handleFaceNear,
    destroy() {
      destroyed = true
      clearActionFrame()
      pendingCombinationTap = null
      if (faceArmTimer !== null) cancelTimeout(faceArmTimer)
      if (holdTimer !== null) clearTimeout(holdTimer)
      if (typeof unsubscribe === "function") unsubscribe()
      resizeObserver?.disconnect()
      documentObject.defaultView?.removeEventListener("resize", layoutHotspots)
      container.replaceChildren()
    },
  }
}
