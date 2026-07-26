const STORAGE_KEY = "tuuru_article_editor_view"
const MAX_IDS = 500

const EMPTY_STATE = Object.freeze({
  nodeId:"",
  collapsedChapterIds:[],
  collapsedChoiceNodeIds:[],
  editorTextColor:"",
  sidePane:"outline",
  noteSection:"outline",
})
const NOTE_SECTIONS = new Set([
  "outline",
  "chapterPlans",
  "foreshadowing",
  "worldbuilding",
  "locations",
  "characters",
  "relationships",
  "ideas",
])

function identifier(value) {
  return typeof value === "string" ? value.trim() : ""
}

function identifierList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(identifier).filter(Boolean))].slice(0, MAX_IDS)
}

function color(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : ""
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {...EMPTY_STATE}
  }
  return {
    nodeId:identifier(value.nodeId),
    collapsedChapterIds:identifierList(value.collapsedChapterIds),
    collapsedChoiceNodeIds:identifierList(value.collapsedChoiceNodeIds),
    editorTextColor:color(value.editorTextColor),
    sidePane:value.sidePane === "notes" ? "notes" : "outline",
    noteSection:NOTE_SECTIONS.has(value.noteSection) ? value.noteSection : "outline",
  }
}

function readAll(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")
    if (!parsed || parsed.version !== 1 || !parsed.works || typeof parsed.works !== "object") {
      throw new Error("invalid")
    }
    return {version:1, works:{...parsed.works}}
  } catch {
    return {version:1, works:{}}
  }
}

export function readArticleEditorViewState(workId, storage = globalThis.localStorage) {
  return normalizeState(readAll(storage).works[identifier(workId)])
}

export function writeArticleEditorViewState(workId, patch, storage = globalThis.localStorage) {
  const key = identifier(workId)
  const all = readAll(storage)
  const current = normalizeState(all.works[key])
  const next = normalizeState({...current, ...(patch && typeof patch === "object" ? patch : {})})
  if (!key) return next
  all.works[key] = next
  try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(all)) } catch {}
  return next
}
