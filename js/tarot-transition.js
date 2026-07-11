import { shouldUseMotion } from "./motion-preference.js"

export const TAROT_TRANSITION_DURATION_MS = 550

export function runTarotTransition({
  start,
  midpoint,
  complete,
  environment = globalThis,
  schedule = setTimeout,
}) {
  if (!shouldUseMotion(true, environment)) {
    try {
      midpoint()
    } finally {
      complete()
    }
    return false
  }

  start()
  schedule(midpoint, Math.round(TAROT_TRANSITION_DURATION_MS / 2))
  schedule(complete, TAROT_TRANSITION_DURATION_MS + 80)
  return true
}
