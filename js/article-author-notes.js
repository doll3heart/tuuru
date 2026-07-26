const STORAGE_KEY = "tuuru_article_author_notes"
const MAX_SECTION_LENGTH = 200_000
const SECTION_KEYS = Object.freeze([
  "outline",
  "chapterPlans",
  "foreshadowing",
  "worldbuilding",
  "locations",
  "characters",
  "relationships",
  "ideas",
])

const EMPTY_NOTES = Object.freeze({
  outline:"",
  chapterPlans:"",
  foreshadowing:"",
  worldbuilding:"",
  locations:"",
  characters:"",
  relationships:"",
  ideas:"",
})

function identifier(value) {
  return typeof value === "string" ? value.trim() : ""
}

function sectionText(value) {
  return typeof value === "string" ? value.slice(0, MAX_SECTION_LENGTH) : ""
}

function normalizeNotes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {...EMPTY_NOTES}
  }
  return {
    outline:sectionText(value.outline),
    chapterPlans:sectionText(value.chapterPlans),
    foreshadowing:sectionText(value.foreshadowing),
    worldbuilding:sectionText(value.worldbuilding),
    locations:sectionText(value.locations),
    characters:sectionText(value.characters),
    relationships:sectionText(value.relationships),
    ideas:sectionText(value.ideas),
  }
}

function readAll(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")
    if (!parsed || ![1, 2].includes(parsed.version) || !parsed.works || typeof parsed.works !== "object") {
      throw new Error("invalid")
    }
    return {version:2, works:{...parsed.works}}
  } catch {
    return {version:2, works:{}}
  }
}

export function readArticleAuthorNotes(workId, storage = globalThis.localStorage) {
  return normalizeNotes(readAll(storage).works[identifier(workId)])
}

export function writeArticleAuthorNotes(workId, patch, storage = globalThis.localStorage) {
  const key = identifier(workId)
  const all = readAll(storage)
  const current = normalizeNotes(all.works[key])
  const acceptedPatch = {}
  if (patch && typeof patch === "object") {
    for (const section of SECTION_KEYS) {
      if (Object.hasOwn(patch, section)) acceptedPatch[section] = sectionText(patch[section])
    }
  }
  const next = normalizeNotes({...current, ...acceptedPatch})
  if (!key) return next
  all.works[key] = next
  try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(all)) } catch {}
  return next
}
