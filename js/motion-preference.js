export function prefersReducedMotion(environment = globalThis) {
  const matchMedia = environment && environment.matchMedia
  if (typeof matchMedia !== "function") return false

  try {
    return matchMedia.call(environment, "(prefers-reduced-motion: reduce)").matches === true
  } catch {
    return false
  }
}

export function shouldUseMotion(enabled, environment = globalThis) {
  return Boolean(enabled) && !prefersReducedMotion(environment)
}
