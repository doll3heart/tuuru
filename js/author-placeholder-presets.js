export const AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY = "tuuru_author_placeholder_presets"
export const AUTHOR_PLACEHOLDER_PRESET_BUNDLE_TYPE = "tuuru-placeholder-presets"

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
    forbidden: parseForbiddenWords(source.forbidden),
  }
}

function sanitizePreset(preset) {
  if (!preset || typeof preset !== "object") return null
  const id = cleanText(preset.id)
  const name = cleanText(preset.name)
  if (!id || !name || !Array.isArray(preset.fields)) return null
  const updatedAt = Number.isFinite(Number(preset.updatedAt)) ? Number(preset.updatedAt) : 0
  return {
    id,
    name,
    fields:preset.fields.map(sanitizeField),
    globalForbidden:parseForbiddenWords(preset.globalForbidden),
    updatedAt,
  }
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
    globalForbidden:parseForbiddenWords(options.globalForbidden),
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

export function serializeAuthorPlaceholderPresetBundle(presets = readAuthorPlaceholderPresets(), options = {}) {
  const now = options.now ?? Date.now
  const cleanPresets = (Array.isArray(presets) ? presets : []).map(sanitizePreset).filter(Boolean)
  return JSON.stringify({ type:AUTHOR_PLACEHOLDER_PRESET_BUNDLE_TYPE, version:1, exportedAt:Number(now()), presets:cleanPresets }, null, 2)
}

export function parseAuthorPlaceholderPresetBundle(input) {
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : input
    if (!parsed || parsed.type !== AUTHOR_PLACEHOLDER_PRESET_BUNDLE_TYPE || parsed.version !== 1 || !Array.isArray(parsed.presets)) throw new Error()
    return {
      type:AUTHOR_PLACEHOLDER_PRESET_BUNDLE_TYPE,
      version:1,
      exportedAt:Number.isFinite(Number(parsed.exportedAt)) ? Number(parsed.exportedAt) : 0,
      presets:parsed.presets.map(sanitizePreset).filter(Boolean),
    }
  } catch {
    throw new Error("不是有效的 Tuuru 占位符预设文件")
  }
}

export function importAuthorPlaceholderPresetBundle(input, options = {}) {
  const storage = options.storage ?? globalThis.localStorage
  const idFactory = options.idFactory ?? defaultId
  const parsed = parseAuthorPlaceholderPresetBundle(input)
  const result = readAuthorPlaceholderPresets(storage)
  for (const imported of parsed.presets) {
    const normalizedName = imported.name.toLocaleLowerCase()
    const existingIndex = result.findIndex(preset => preset.name.toLocaleLowerCase() === normalizedName)
    if (existingIndex >= 0) {
      result.splice(existingIndex, 1, { ...imported, id:result[existingIndex].id })
      continue
    }
    var importedId = imported.id
    if (!importedId || result.some(preset => preset.id === importedId)) importedId = String(idFactory())
    result.push({ ...imported, id:importedId })
  }
  if (!writePresets(storage, result)) throw new Error("占位符预设导入失败，浏览器无法写入本地存储")
  return result
}
import { parseForbiddenWords } from "./forbidden-words.js"
