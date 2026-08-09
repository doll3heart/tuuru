import { normalizeInteractiveBgm } from "./interactive-bgm.js"

export const INTERACTIVE_EXPERIENCE_MODE = "interactive"

export function isInteractiveExperienceWork(work) {
  return work?.type === "article" && work?.experienceMode === INTERACTIVE_EXPERIENCE_MODE
}

export function normalizeInteractiveExperienceFields(work) {
  if (!work || typeof work !== "object") return work
  if (work.experienceMode === INTERACTIVE_EXPERIENCE_MODE) {
    work.interactiveBgm = normalizeInteractiveBgm(work.interactiveBgm)
  } else {
    delete work.experienceMode
    delete work.interactiveBgm
  }
  return work
}
