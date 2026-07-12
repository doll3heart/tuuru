export const FEATURE_FLAGS = Object.freeze({ reliableLocalWrites: false })

export function featureEnabled(name, flags = FEATURE_FLAGS) {
  return flags?.[name] === true
}
