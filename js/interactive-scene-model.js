import { normalizeCssColor } from "./safe-values.js"

export const INTERACTIVE_SCENE_TRIGGERS = Object.freeze([
  "tap",
  "hold",
  "swipe",
  "face-near",
  "face-near-tap",
  "face-near-hold",
])
export const INTERACTIVE_HOTSPOT_SHAPES = Object.freeze(["rect", "ellipse", "polygon"])
export const DEFAULT_INTERACTIVE_HOTSPOT_REFERENCE_ASPECT_RATIO = 9 / 16
const INTERACTIVE_CAMERA_TRIGGERS = new Set(["face-near", "face-near-tap", "face-near-hold"])

export const DEFAULT_INTERACTIVE_DIALOGUE_STYLE = Object.freeze({
  surfaceColor: "#fffaf9",
  textColor: "#40383b",
  accentColor: "#c7a1aa",
  borderColor: "#c8b6ba",
  opacity: 88,
  borderRadius: 7,
  position: "bottom",
  width: 88,
  height: 14,
  frameImage: "",
  frameOutset: 0,
})

export const DEFAULT_INTERACTIVE_PROMPT_STYLE = Object.freeze({
  surfaceColor: "#40383b",
  textColor: "#fffaf9",
  borderColor: "#c8b6ba",
  opacity: 72,
  borderRadius: 4,
  position: "top",
})

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function string(value, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function numberBetween(value, minimum, maximum, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function identifier(value, fallback) {
  const candidate = string(value).trim()
  return /^[a-z0-9_-]{1,128}$/i.test(candidate) ? candidate : fallback
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function normalizeInteractiveDialogueStyle(value) {
  const source = record(value)
  return {
    surfaceColor: normalizeCssColor(source.surfaceColor, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.surfaceColor),
    textColor: normalizeCssColor(source.textColor, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.textColor),
    accentColor: normalizeCssColor(source.accentColor, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.accentColor),
    borderColor: normalizeCssColor(source.borderColor, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.borderColor),
    opacity: numberBetween(source.opacity, 20, 100, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.opacity),
    borderRadius: numberBetween(source.borderRadius, 0, 24, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.borderRadius),
    position: ["top", "center", "bottom"].includes(source.position)
      ? source.position
      : DEFAULT_INTERACTIVE_DIALOGUE_STYLE.position,
    width: numberBetween(source.width, 40, 100, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.width),
    height: numberBetween(source.height, 8, 45, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.height),
    frameImage: string(source.frameImage).trim(),
    frameOutset: numberBetween(source.frameOutset, 0, 32, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.frameOutset),
  }
}

export function normalizeInteractivePromptStyle(value) {
  const source = record(value)
  return {
    surfaceColor: normalizeCssColor(source.surfaceColor, DEFAULT_INTERACTIVE_PROMPT_STYLE.surfaceColor),
    textColor: normalizeCssColor(source.textColor, DEFAULT_INTERACTIVE_PROMPT_STYLE.textColor),
    borderColor: normalizeCssColor(source.borderColor, DEFAULT_INTERACTIVE_PROMPT_STYLE.borderColor),
    opacity: numberBetween(source.opacity, 20, 100, DEFAULT_INTERACTIVE_PROMPT_STYLE.opacity),
    borderRadius: numberBetween(source.borderRadius, 0, 24, DEFAULT_INTERACTIVE_PROMPT_STYLE.borderRadius),
    position: source.position === "bottom" ? "bottom" : "top",
  }
}

function normalizeDialogue(value) {
  const source = record(value)
  const dialogue = {
    speaker: string(source.speaker).slice(0, 80),
    text: string(source.text).slice(0, 4000),
  }
  if (source.style && Object.keys(record(source.style)).length) {
    dialogue.style = normalizeInteractiveDialogueStyle(source.style)
  }
  return dialogue
}

function normalizeActionFrame(value) {
  const source = record(value)
  return {
    enabled: source.enabled === true,
    source: string(source.source).trim(),
    type: source.type === "video" ? "video" : "image",
    fit: source.fit === "contain" ? "contain" : "cover",
    fileName: string(source.fileName).slice(0, 240),
    durationMs: numberBetween(source.durationMs, 300, 30000, 1800),
    gifDurationMs: numberBetween(source.gifDurationMs, 0, 120000, 0),
  }
}

function normalizeHotspot(value, index, stageIds) {
  const source = record(value)
  const referenceAspectRatio = Number(source.referenceAspectRatio)
  const targetStageId = identifier(source.targetStageId, "")
  const trigger = INTERACTIVE_SCENE_TRIGGERS.includes(source.trigger) ? source.trigger : "tap"
  const fallbackTrigger = ["tap", "hold"].includes(source.fallbackTrigger)
    ? source.fallbackTrigger
    : "tap"
  const shape = INTERACTIVE_HOTSPOT_SHAPES.includes(source.shape) ? source.shape : "ellipse"
  const points = list(source.points).slice(0, 120).map(point => {
    const sourcePoint = record(point)
    return {
      x: numberBetween(sourcePoint.x, 0, 100, 0),
      y: numberBetween(sourcePoint.y, 0, 100, 0),
    }
  })
  return {
    id: identifier(source.id, `hotspot-${index + 1}`),
    label: string(source.label, `互动区域 ${index + 1}`).slice(0, 80),
    x: numberBetween(source.x, 0, 100, 35),
    y: numberBetween(source.y, 0, 100, 35),
    width: numberBetween(source.width, 1, 100, 30),
    height: numberBetween(source.height, 1, 100, 30),
    shape: shape === "polygon" && points.length < 3 ? "ellipse" : shape,
    points: shape === "polygon" && points.length >= 3 ? points : [],
    trigger,
    fallbackTrigger,
    holdMs: numberBetween(source.holdMs, 300, 5000, 900),
    targetStageId: stageIds.has(targetStageId) ? targetStageId : "",
    speaker: string(source.speaker).slice(0, 80),
    dialogue: string(source.dialogue).slice(0, 4000),
    actionFrame: normalizeActionFrame(source.actionFrame),
    referenceAspectRatio: Number.isFinite(referenceAspectRatio) && referenceAspectRatio > 0
      ? numberBetween(referenceAspectRatio, 0.1, 10, DEFAULT_INTERACTIVE_HOTSPOT_REFERENCE_ASPECT_RATIO)
      : DEFAULT_INTERACTIVE_HOTSPOT_REFERENCE_ASPECT_RATIO,
  }
}

function normalizeMediaTransform(value) {
  const source = record(value)
  return {
    scale: numberBetween(source.scale, 0.5, 4, 1),
    x: numberBetween(source.x, -200, 200, 0),
    y: numberBetween(source.y, -200, 200, 0),
  }
}

function normalizeStage(value, index, stageIds) {
  const source = record(value)
  const id = identifier(source.id, `stage-${index + 1}`)
  return {
    id,
    name: string(source.name, `画面 ${index + 1}`).slice(0, 80),
    image: string(source.image || source.imageUrl).trim(),
    alt: string(source.alt).slice(0, 300),
    fit: source.fit === "contain" ? "contain" : "cover",
    mediaTransform: normalizeMediaTransform(source.mediaTransform),
    characterImage: string(source.characterImage).trim(),
    characterAlt: string(source.characterAlt).slice(0, 300),
    characterFit: source.characterFit === "cover" ? "cover" : "contain",
    characterTransform: normalizeMediaTransform(source.characterTransform),
    prompt: string(source.prompt).slice(0, 300),
    dialogue: normalizeDialogue(source.dialogue),
    hotspots: list(source.hotspots).map((hotspot, hotspotIndex) => (
      normalizeHotspot(hotspot, hotspotIndex, stageIds)
    )),
  }
}

export function normalizeInteractiveScene(value) {
  const source = record(value)
  const rawStages = list(source.stages)
  const stageSeeds = rawStages.length ? rawStages : [{ id: "stage-1" }]
  const stageIds = new Set(stageSeeds.map((stage, index) => identifier(stage?.id, `stage-${index + 1}`)))
  const stages = stageSeeds.map((stage, index) => normalizeStage(stage, index, stageIds))
  const requestedStart = identifier(source.startStageId, "")
  return {
    id: identifier(source.id, "interactive-scene"),
    nodeId: identifier(source.nodeId, ""),
    nextNodeId: identifier(source.nextNodeId, ""),
    title: string(source.title, "互动场景").slice(0, 120),
    startStageId: stageIds.has(requestedStart) ? requestedStart : stages[0].id,
    promptStyle: normalizeInteractivePromptStyle(source.promptStyle),
    dialogueStyle: normalizeInteractiveDialogueStyle(source.dialogueStyle),
    stages,
  }
}

export function createInteractiveScene({ id, nodeId, stageId } = {}) {
  return normalizeInteractiveScene({
    id: identifier(id, "interactive-scene"),
    nodeId: identifier(nodeId, ""),
    title: "互动场景",
    startStageId: identifier(stageId, "stage-1"),
    stages: [{
      id: identifier(stageId, "stage-1"),
      name: "初始画面",
      image: "",
      alt: "",
      fit: "cover",
      mediaTransform: { scale: 1, x: 0, y: 0 },
      characterImage: "",
      characterAlt: "",
      characterFit: "contain",
      characterTransform: { scale: 1, x: 0, y: 0 },
      prompt: "点击画面中的互动区域",
      dialogue: { speaker: "", text: "" },
      hotspots: [],
    }],
  })
}

export function resolveInteractiveSceneStage(sceneValue, stageId) {
  const scene = normalizeInteractiveScene(sceneValue)
  return scene.stages.find(stage => stage.id === stageId)
    || scene.stages.find(stage => stage.id === scene.startStageId)
    || scene.stages[0]
}

export function workUsesCameraInteractions(work) {
  return list(work?.interactiveScenes).some(scene => (
    list(scene?.stages).some(stage => (
      list(stage?.hotspots).some(hotspot => INTERACTIVE_CAMERA_TRIGGERS.has(hotspot?.trigger))
    ))
  ))
}

export function applyInteractiveDialogueStyle(sceneValue, style) {
  const scene = normalizeInteractiveScene(sceneValue)
  scene.dialogueStyle = normalizeInteractiveDialogueStyle({
    ...scene.dialogueStyle,
    ...record(style),
  })
  scene.stages = scene.stages.map(stage => ({
    ...stage,
    dialogue: {
      speaker: stage.dialogue.speaker,
      text: stage.dialogue.text,
    },
  }))
  return clone(scene)
}

export function applyWorkInteractiveDialogueStyle(workValue, style) {
  const work = clone(record(workValue))
  const normalized = normalizeInteractiveDialogueStyle({
    ...record(work.interactiveDialogueStyle),
    ...record(style),
  })
  work.interactiveDialogueStyle = normalized
  work.interactiveScenes = list(work.interactiveScenes).map(scene => (
    applyInteractiveDialogueStyle(scene, normalized)
  ))
  return work
}
