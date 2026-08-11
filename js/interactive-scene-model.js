import { normalizeCssColor } from "./safe-values.js"
import { normalizeInteractiveBgm } from "./interactive-bgm.js"

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
export const DEFAULT_INTERACTIVE_PROMPT_TEXT = "点击画面中的互动区域"
export const DEFAULT_INTERACTIVE_CANVAS = Object.freeze({
  width: 1080,
  height: 1920,
  backgroundColor: "#40383b",
})
export const INTERACTIVE_TEXT_FONTS = Object.freeze([
  "system-ui, sans-serif",
  "Georgia, serif",
  "ui-monospace, monospace",
  "KaiTi, STKaiti, serif",
])
const INTERACTIVE_CAMERA_TRIGGERS = new Set(["face-near", "face-near-tap", "face-near-hold"])

export const DEFAULT_INTERACTIVE_DIALOGUE_STYLE = Object.freeze({
  surfaceColor: "#fffaf9",
  textColor: "#40383b",
  accentColor: "#c7a1aa",
  borderColor: "#c8b6ba",
  opacity: 88,
  borderRadius: 7,
  position: "bottom",
  x: 50,
  y: 82,
  width: 88,
  height: 14,
  fontFamily: "system-ui, sans-serif",
  fontSize: 16,
  lineHeight: 1.65,
  letterSpacing: 0,
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
  x: 50,
  y: 5,
  width: 72,
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  lineHeight: 1.45,
  letterSpacing: 0,
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

function normalizeTextFont(value, fallback) {
  return INTERACTIVE_TEXT_FONTS.includes(value) ? value : fallback
}

export function normalizeInteractiveCanvas(value) {
  const source = record(value)
  return {
    width: Math.round(numberBetween(source.width, 320, 3840, DEFAULT_INTERACTIVE_CANVAS.width)),
    height: Math.round(numberBetween(source.height, 320, 3840, DEFAULT_INTERACTIVE_CANVAS.height)),
    backgroundColor: normalizeCssColor(source.backgroundColor, DEFAULT_INTERACTIVE_CANVAS.backgroundColor),
  }
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
    position: ["top", "center", "bottom", "free"].includes(source.position)
      ? source.position
      : DEFAULT_INTERACTIVE_DIALOGUE_STYLE.position,
    x: numberBetween(source.x, 0, 100, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.x),
    y: numberBetween(source.y, 0, 100, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.y),
    width: numberBetween(source.width, 40, 100, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.width),
    height: numberBetween(source.height, 8, 45, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.height),
    fontFamily: normalizeTextFont(source.fontFamily, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.fontFamily),
    fontSize: numberBetween(source.fontSize, 10, 48, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.fontSize),
    lineHeight: numberBetween(source.lineHeight, 1, 2.5, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.lineHeight),
    letterSpacing: numberBetween(source.letterSpacing, -1, 12, DEFAULT_INTERACTIVE_DIALOGUE_STYLE.letterSpacing),
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
    position: ["top", "bottom", "free"].includes(source.position) ? source.position : "top",
    x: numberBetween(source.x, 0, 100, DEFAULT_INTERACTIVE_PROMPT_STYLE.x),
    y: numberBetween(source.y, 0, 100, DEFAULT_INTERACTIVE_PROMPT_STYLE.y),
    width: numberBetween(source.width, 20, 100, DEFAULT_INTERACTIVE_PROMPT_STYLE.width),
    fontFamily: normalizeTextFont(source.fontFamily, DEFAULT_INTERACTIVE_PROMPT_STYLE.fontFamily),
    fontSize: numberBetween(source.fontSize, 9, 36, DEFAULT_INTERACTIVE_PROMPT_STYLE.fontSize),
    lineHeight: numberBetween(source.lineHeight, 1, 2.5, DEFAULT_INTERACTIVE_PROMPT_STYLE.lineHeight),
    letterSpacing: numberBetween(source.letterSpacing, -1, 12, DEFAULT_INTERACTIVE_PROMPT_STYLE.letterSpacing),
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

function normalizeDialogueBox(value, index) {
  const source = record(value)
  return {
    id: identifier(source.id, `dialogue-${index + 1}`),
    speaker: string(source.speaker).slice(0, 80),
    text: string(source.text).slice(0, 4000),
    style: normalizeInteractiveDialogueStyle({
      ...DEFAULT_INTERACTIVE_DIALOGUE_STYLE,
      position:"free",
      x:50,
      y:Math.min(92, 28 + index * 18),
      ...(source.style || {}),
    }),
  }
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
    transform: normalizeMediaTransform(source.transform),
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

function normalizeStageChoice(value, index, stageIds) {
  const source = record(value)
  const targetStageId = identifier(source.targetStageId, "")
  return {
    id: identifier(source.id, `choice-${index + 1}`),
    label: string(source.label, `选项 ${index + 1}`).slice(0, 120),
    targetStageId: stageIds.has(targetStageId) ? targetStageId : "",
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

function normalizeMediaLayer(value, index) {
  const source = record(value)
  return {
    id: identifier(source.id, `layer-${index + 1}`),
    name: string(source.name, `图层 ${index + 1}`).slice(0, 80),
    source: string(source.source || source.image).trim(),
    alt: string(source.alt).slice(0, 300),
    fit: source.fit === "cover" ? "cover" : "contain",
    transform: normalizeMediaTransform(source.transform),
    opacity: numberBetween(source.opacity, 0, 100, 100),
    visible: source.visible !== false,
  }
}

function normalizeStage(value, index, stageIds, legacyPromptStyle) {
  const source = record(value)
  const id = identifier(source.id, `stage-${index + 1}`)
  const prompt = string(source.prompt).slice(0, 300)
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
    layers: list(source.layers).slice(0, 24).map(normalizeMediaLayer),
    bgm: normalizeInteractiveBgm(source.bgm),
    prompt,
    promptEnabled: typeof source.promptEnabled === "boolean" ? source.promptEnabled : Boolean(prompt),
    promptStyle: normalizeInteractivePromptStyle({
      ...legacyPromptStyle,
      ...record(source.promptStyle),
    }),
    dialogue: normalizeDialogue(source.dialogue),
    dialogues: list(source.dialogues).slice(0, 12).map(normalizeDialogueBox),
    choices: list(source.choices).slice(0, 6).map((choice, choiceIndex) => (
      normalizeStageChoice(choice, choiceIndex, stageIds)
    )),
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
  const promptStyle = normalizeInteractivePromptStyle(source.promptStyle)
  const stages = stageSeeds.map((stage, index) => normalizeStage(stage, index, stageIds, promptStyle))
  const requestedStart = identifier(source.startStageId, "")
  return {
    id: identifier(source.id, "interactive-scene"),
    nodeId: identifier(source.nodeId, ""),
    nextNodeId: identifier(source.nextNodeId, ""),
    title: string(source.title, "互动场景").slice(0, 120),
    canvas: normalizeInteractiveCanvas(source.canvas),
    startStageId: stageIds.has(requestedStart) ? requestedStart : stages[0].id,
    promptStyle,
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
      fit: "contain",
      mediaTransform: { scale: 1, x: 0, y: 0 },
      characterImage: "",
      characterAlt: "",
      characterFit: "contain",
      characterTransform: { scale: 1, x: 0, y: 0 },
      bgm: normalizeInteractiveBgm(),
      prompt: DEFAULT_INTERACTIVE_PROMPT_TEXT,
      promptEnabled: true,
      dialogue: { speaker: "", text: "" },
      dialogues: [],
      choices: [],
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
