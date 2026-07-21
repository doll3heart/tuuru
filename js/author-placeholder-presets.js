export const AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY = "tuuru_author_placeholder_presets"

function defaultId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function sanitizeField(field) {
  const source = field && typeof field === "object" ? field : {}
  return {
    key: cleanText(source.key),
    label: cleanText(source.label) || cleanText(source.key) || "占位符",
    prompt: cleanText(source.prompt) || "请填写",
    mode: cleanText(source.mode) || "each",
    forbidden: Array.isArray(source.forbidden)
      ? source.forbidden.map(value => String(value ?? "").trim()).filter(Boolean)
      : [],
  }
}

function sanitizePreset(preset) {
  if (!preset || typeof preset !== "object") return null
  const id = cleanText(preset.id)
  const name = cleanText(preset.name)
  if (!id || !name || !Array.isArray(preset.fields)) return null
  const updatedAt = Number.isFinite(Number(preset.updatedAt)) ? Number(preset.updatedAt) : 0
  return { id, name, fields: preset.fields.map(sanitizeField), updatedAt }
}

function writePresets(storage, presets) {
  try {
    storage.setItem(AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY, JSON.stringify({ version: 1, presets }))
    return true
  } catch {
    return false
  }
}

export function readAuthorPlaceholderPresets(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY) || "null")
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.presets)) return []
    return parsed.presets.map(sanitizePreset).filter(Boolean)
  } catch {
    return []
  }
}

export function saveAuthorPlaceholderPreset(name, placeholders, options = {}) {
  const storage = options.storage ?? globalThis.localStorage
  const now = options.now ?? Date.now
  const idFactory = options.idFactory ?? defaultId
  const cleanName = cleanText(name)
  if (!cleanName || !Array.isArray(placeholders) || placeholders.length === 0) return null

  const presets = readAuthorPlaceholderPresets(storage)
  const existingIndex = presets.findIndex(preset => preset.name === cleanName)
  const existing = existingIndex >= 0 ? presets[existingIndex] : null
  const next = {
    id: existing?.id || String(idFactory()),
    name: cleanName,
    fields: placeholders.map(sanitizeField),
    updatedAt: Number(now()),
  }
  if (existingIndex >= 0) presets.splice(existingIndex, 1, next)
  else presets.push(next)
  return writePresets(storage, presets) ? next : null
}

export function deleteAuthorPlaceholderPreset(id, storage = globalThis.localStorage) {
  const presets = readAuthorPlaceholderPresets(storage)
  const next = presets.filter(preset => preset.id !== String(id))
  if (next.length === presets.length) return false
  return writePresets(storage, next)
}

export function instantiateAuthorPlaceholderPreset(preset, idFactory = defaultId) {
  const clean = sanitizePreset(preset)
  if (!clean) return []
  return clean.fields.map(field => ({
    id: String(idFactory()),
    key: field.key,
    label: field.label,
    prompt: field.prompt,
    mode: field.mode,
    forbidden: field.forbidden.slice(),
    values: [],
    default: "",
  }))
}
