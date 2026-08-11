import { substitutePlaceholders } from "./placeholders.js"

function substitute(value, placeholders, options) {
  return substitutePlaceholders(String(value || ""), placeholders, options)
}

export function substituteInteractiveSceneText(sceneValue, placeholders, options = {}) {
  const scene = sceneValue && typeof sceneValue === "object" ? sceneValue : {}
  const placeholderList = Array.isArray(placeholders) ? placeholders : []
  return {
    ...scene,
    title: substitute(scene.title, placeholderList, options),
    stages: (Array.isArray(scene.stages) ? scene.stages : []).map(stage => ({
      ...stage,
      name: substitute(stage?.name, placeholderList, options),
      alt: substitute(stage?.alt, placeholderList, options),
      characterAlt: substitute(stage?.characterAlt, placeholderList, options),
      prompt: substitute(stage?.prompt, placeholderList, options),
      dialogue: {
        ...(stage?.dialogue || {}),
        speaker: substitute(stage?.dialogue?.speaker, placeholderList, options),
        text: substitute(stage?.dialogue?.text, placeholderList, options),
      },
      dialogues: (Array.isArray(stage?.dialogues) ? stage.dialogues : []).map(dialogue => ({
        ...dialogue,
        speaker: substitute(dialogue?.speaker, placeholderList, options),
        text: substitute(dialogue?.text, placeholderList, options),
      })),
      choices: (Array.isArray(stage?.choices) ? stage.choices : []).map(choice => ({
        ...choice,
        label: substitute(choice?.label, placeholderList, options),
      })),
      hotspots: (Array.isArray(stage?.hotspots) ? stage.hotspots : []).map(hotspot => ({
        ...hotspot,
        label: substitute(hotspot?.label, placeholderList, options),
        speaker: substitute(hotspot?.speaker, placeholderList, options),
        dialogue: substitute(hotspot?.dialogue, placeholderList, options),
      })),
    })),
  }
}
