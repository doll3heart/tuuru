export const READER_LIBRARY_VERSION = 1
export const READER_LIBRARY_STORAGE_KEY = "moirain_readerLibrary"

const MAX_BOOKS = 100
const MAX_SLOTS = 5
const MAX_IDENTITIES = 20
const MAX_CHECKPOINTS = 8
const MAX_BOOKMARKS = 30
const MAX_PATH_LENGTH = 256
const MAX_TEXT_LENGTH = 500

function ownData(record, key) {
  if (!record || typeof record !== "object") return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_TEXT_LENGTH
    && value.trim() === value
}

function text(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : fallback
}

function timestamp(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

function normalizedDefinition(value) {
  if (!plainRecord(value)) return null
  const id = ownData(value, "id")
  if (!exactId(id)) return null
  return {
    id,
    key:text(ownData(value, "key"), text(ownData(value, "label"), id)),
    label:text(ownData(value, "label"), text(ownData(value, "key"), id)),
    prompt:text(ownData(value, "prompt")),
    default:text(ownData(value, "default")),
  }
}

function normalizedDefinitions(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const definitions = []
  for (const candidate of value) {
    const definition = normalizedDefinition(candidate)
    if (!definition || seen.has(definition.id)) continue
    seen.add(definition.id)
    definitions.push(definition)
    if (definitions.length >= 100) break
  }
  return definitions
}

function normalizedPlaceholderValues(value, definitions) {
  if (!plainRecord(value)) return {}
  const allowed = new Set(definitions.map(definition => definition.id))
  const values = {}
  for (const id of allowed) {
    const candidate = ownData(value, id)
    const first = Array.isArray(candidate) ? candidate[0] : candidate
    if (typeof first !== "string") continue
    values[id] = [first.slice(0, MAX_TEXT_LENGTH)]
  }
  return values
}

function normalizedIdMap(value) {
  if (!plainRecord(value)) return {}
  const result = {}
  for (const key of Object.keys(value)) {
    const candidate = ownData(value, key)
    if (exactId(key) && exactId(candidate)) result[key] = candidate
  }
  return result
}

function normalizedInteractionSelections(value) {
  if (!plainRecord(value)) return {}
  const result = {}
  for (const groupId of Object.keys(value)) {
    const selection = ownData(value, groupId)
    if (!exactId(groupId) || !plainRecord(selection)) continue
    const nodeId = ownData(selection, "nodeId")
    const choiceId = ownData(selection, "choiceId")
    if (!exactId(nodeId) || !exactId(choiceId)) continue
    result[groupId] = { nodeId, choiceId }
  }
  return result
}

function normalizedPath(value) {
  if (!Array.isArray(value) || value.length > MAX_PATH_LENGTH) return []
  const path = []
  for (const candidate of value) {
    if (!exactId(candidate)) return []
    path.push(candidate)
  }
  return path
}

function boundedNumber(value, minimum, maximum, fallback = 0) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizedReadingPosition(value, kind) {
  if (!plainRecord(value) || ownData(value, "kind") !== kind) return null
  if (kind === "article") {
    const pathIndex = ownData(value, "pathIndex")
    const anchorIndex = ownData(value, "anchorIndex")
    if (!Number.isInteger(pathIndex) || pathIndex < 0 || pathIndex >= MAX_PATH_LENGTH) return null
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex > 10_000) return null
    return {
      kind:"article",
      pathIndex,
      anchorIndex,
      viewportTop:boundedNumber(ownData(value, "viewportTop"), -100_000, 100_000),
      scrollY:boundedNumber(ownData(value, "scrollY"), 0, 100_000_000),
    }
  }

  const appType = ownData(value, "appType")
  const view = ownData(value, "view")
  const itemId = ownData(value, "itemId")
  const contactIndex = ownData(value, "contactIndex")
  const anchorId = ownData(value, "anchorId")
  if (!exactId(appType) || (view !== "app" && view !== "chat")) return null
  if (view === "chat" && !exactId(itemId)) return null
  return {
    kind:"phone",
    appType,
    view,
    itemId:exactId(itemId) ? itemId : "",
    contactIndex:Number.isInteger(contactIndex) && contactIndex >= 0
      ? Math.min(contactIndex, 10_000)
      : -1,
    scrollTop:boundedNumber(ownData(value, "scrollTop"), 0, 100_000_000),
    anchorId:exactId(anchorId) ? anchorId : "",
    anchorOffset:boundedNumber(ownData(value, "anchorOffset"), -100_000, 100_000),
  }
}

function normalizedCheckpoint(value) {
  if (!plainRecord(value)) return null
  const id = ownData(value, "id")
  const sourceNodeId = ownData(value, "sourceNodeId")
  const path = normalizedPath(ownData(value, "path"))
  if (!exactId(id) || !exactId(sourceNodeId) || !path.length) return null
  return {
    id,
    sourceNodeId,
    label:text(ownData(value, "label"), "选择点"),
    savedAt:timestamp(ownData(value, "savedAt")),
    path,
    choiceMemory:normalizedIdMap(ownData(value, "choiceMemory")),
    interactionSelections:normalizedInteractionSelections(ownData(value, "interactionSelections")),
  }
}

function normalizedCheckpoints(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizedCheckpoint)
    .filter(Boolean)
    .slice(-MAX_CHECKPOINTS)
}

function normalizedBookmark(value) {
  if (!plainRecord(value) || ownData(value, "kind") !== "article") return null
  const id = ownData(value, "id")
  const path = normalizedPath(ownData(value, "path"))
  if (!exactId(id) || !path.length) return null
  const bookmark = {
    id,
    kind:"article",
    label:text(ownData(value, "label"), "阅读位置"),
    note:text(ownData(value, "note")),
    savedAt:timestamp(ownData(value, "savedAt")),
    path,
    choiceMemory:normalizedIdMap(ownData(value, "choiceMemory")),
    interactionSelections:normalizedInteractionSelections(ownData(value, "interactionSelections")),
  }
  if (ownData(value, "updateStatus") === "moved") bookmark.updateStatus = "moved"
  return bookmark
}

function normalizedBookmarks(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizedBookmark)
    .filter(Boolean)
    .slice(0, MAX_BOOKMARKS)
}

function normalizedProgress(value) {
  if (!plainRecord(value)) return null
  const kind = ownData(value, "kind")
  if (kind === "phone") {
    const flowIndex = ownData(value, "flowIndex")
    return {
      kind:"phone",
      flowIndex:Number.isInteger(flowIndex) && flowIndex >= 0 ? Math.min(flowIndex, 10_000) : 0,
      readingPosition:normalizedReadingPosition(ownData(value, "readingPosition"), "phone"),
      savedAt:timestamp(ownData(value, "savedAt")),
    }
  }
  if (kind !== "article") return null
  const path = normalizedPath(ownData(value, "path"))
  if (!path.length) return null
  return {
    kind:"article",
    path,
    choiceMemory:normalizedIdMap(ownData(value, "choiceMemory")),
    interactionSelections:normalizedInteractionSelections(ownData(value, "interactionSelections")),
    checkpoints:normalizedCheckpoints(ownData(value, "checkpoints")),
    readingPosition:normalizedReadingPosition(ownData(value, "readingPosition"), "article"),
    savedAt:timestamp(ownData(value, "savedAt")),
  }
}

function normalizedSlot(value, definitions) {
  if (!plainRecord(value)) return null
  const id = ownData(value, "id")
  if (!exactId(id)) return null
  return {
    id,
    name:text(ownData(value, "name")).trim(),
    createdAt:timestamp(ownData(value, "createdAt")),
    updatedAt:timestamp(ownData(value, "updatedAt")),
    identityId:exactId(ownData(value, "identityId")) ? ownData(value, "identityId") : "",
    placeholderValues:normalizedPlaceholderValues(ownData(value, "placeholderValues"), definitions),
    progress:normalizedProgress(ownData(value, "progress")),
    completedAt:timestamp(ownData(value, "completedAt")),
    bookmarks:normalizedBookmarks(ownData(value, "bookmarks")),
  }
}

function legacySlot(value, definitions, fallbackTime) {
  return {
    id:"reader-slot-default",
    name:"",
    createdAt:timestamp(fallbackTime),
    updatedAt:timestamp(fallbackTime),
    identityId:"",
    placeholderValues:normalizedPlaceholderValues(ownData(value, "placeholderValues"), definitions),
    progress:normalizedProgress(ownData(value, "progress")),
    completedAt:timestamp(ownData(value, "completedAt")),
    bookmarks:normalizedBookmarks(ownData(value, "bookmarks")),
  }
}

function normalizedSlots(value, definitions, fallback) {
  const candidates = ownData(value, "slots")
  const slots = []
  const seen = new Set()
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const slot = normalizedSlot(candidate, definitions)
      if (!slot || seen.has(slot.id)) continue
      seen.add(slot.id)
      slots.push(slot)
      if (slots.length >= MAX_SLOTS) break
    }
  }
  if (!slots.length) slots.push(legacySlot(value, definitions, fallback))
  return slots
}

function mirrorActiveSlot(book, slots, activeSlotId) {
  const active = slots.find(slot => slot.id === activeSlotId) || slots[0]
  return {
    ...book,
    activeSlotId:active.id,
    slots,
    placeholderValues:active.placeholderValues,
    progress:active.progress,
    completedAt:active.completedAt,
    bookmarks:active.bookmarks,
  }
}

function normalizedIdentityValues(value) {
  if (!plainRecord(value)) return {}
  const result = {}
  for (const key of Object.keys(value)) {
    const normalizedKey = text(key).trim()
    const candidate = ownData(value, key)
    const first = Array.isArray(candidate) ? candidate[0] : candidate
    if (!normalizedKey || typeof first !== "string") continue
    result[normalizedKey] = first.slice(0, MAX_TEXT_LENGTH)
  }
  return result
}

function normalizedIdentity(value) {
  if (!plainRecord(value)) return null
  const id = ownData(value, "id")
  const name = text(ownData(value, "name")).trim()
  if (!exactId(id) || !name) return null
  return {
    id,
    name,
    values:normalizedIdentityValues(ownData(value, "values")),
    createdAt:timestamp(ownData(value, "createdAt")),
    updatedAt:timestamp(ownData(value, "updatedAt")),
  }
}

function normalizedIdentities(value) {
  if (!Array.isArray(value)) return []
  const result = []
  const seen = new Set()
  for (const candidate of value) {
    const identity = normalizedIdentity(candidate)
    if (!identity || seen.has(identity.id)) continue
    seen.add(identity.id)
    result.push(identity)
    if (result.length >= MAX_IDENTITIES) break
  }
  return result
}

function normalizedBook(value) {
  if (!plainRecord(value)) return null
  const id = ownData(value, "id")
  if (!exactId(id)) return null
  const definitions = normalizedDefinitions(ownData(value, "placeholderDefinitions"))
  const fallbackTime = timestamp(ownData(value, "lastOpenedAt"), timestamp(ownData(value, "addedAt")))
  const slots = normalizedSlots(value, definitions, fallbackTime)
  const activeSlotId = ownData(value, "activeSlotId")
  const book = {
    id,
    type:ownData(value, "type") === "phone" ? "phone" : "article",
    title:text(ownData(value, "title"), "无标题作品"),
    author:text(ownData(value, "author")),
    coverColor:text(ownData(value, "coverColor")),
    addedAt:timestamp(ownData(value, "addedAt")),
    lastOpenedAt:timestamp(ownData(value, "lastOpenedAt")),
    placeholderDefinitions:definitions,
  }
  const unseenUpdateAt = timestamp(ownData(value, "unseenUpdateAt"))
  if (unseenUpdateAt) book.unseenUpdateAt = unseenUpdateAt
  const pinnedAt = timestamp(ownData(value, "pinnedAt"))
  if (pinnedAt) book.pinnedAt = pinnedAt
  return mirrorActiveSlot(book, slots, exactId(activeSlotId) ? activeSlotId : slots[0].id)
}

function normalizedLibrary(value) {
  if (!plainRecord(value) || ownData(value, "version") !== READER_LIBRARY_VERSION) {
    return emptyReaderLibrary()
  }
  const candidates = ownData(value, "books")
  if (!Array.isArray(candidates)) return emptyReaderLibrary()
  const books = []
  const seen = new Set()
  for (const candidate of candidates) {
    const book = normalizedBook(candidate)
    if (!book || seen.has(book.id)) continue
    seen.add(book.id)
    books.push(book)
    if (books.length >= MAX_BOOKS) break
  }
  return {
    version:READER_LIBRARY_VERSION,
    identities:normalizedIdentities(ownData(value, "identities")),
    books,
  }
}

export function emptyReaderLibrary() {
  return { version:READER_LIBRARY_VERSION, identities:[], books:[] }
}

export function readReaderLibrary(storage) {
  try {
    const raw = storage?.getItem(READER_LIBRARY_STORAGE_KEY)
    return raw ? normalizedLibrary(JSON.parse(raw)) : emptyReaderLibrary()
  } catch {
    return emptyReaderLibrary()
  }
}

export function writeReaderLibrary(storage, library) {
  try {
    storage?.setItem(READER_LIBRARY_STORAGE_KEY, JSON.stringify(normalizedLibrary(library)))
    return true
  } catch {
    return false
  }
}

export function readerBook(library, workId) {
  if (!exactId(workId)) return null
  return normalizedLibrary(library).books.find(book => book.id === workId) || null
}

export function readerActiveSlot(book) {
  const current = normalizedBook(book)
  if (!current) return null
  return current.slots.find(slot => slot.id === current.activeSlotId) || current.slots[0] || null
}

function withBooks(current, books) {
  return { ...current, books }
}

function updateActiveBookSlot(book, update) {
  const slots = book.slots.map(slot => {
    if (slot.id !== book.activeSlotId) return slot
    return normalizedSlot(update(slot), book.placeholderDefinitions) || slot
  })
  return mirrorActiveSlot(book, slots, book.activeSlotId)
}

export function rememberReaderWork(library, work, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!plainRecord(work)) return current
  const id = ownData(work, "id")
  if (!exactId(id)) return current
  const previous = current.books.find(book => book.id === id)
  const placeholderDefinitions = normalizedDefinitions(ownData(work, "placeholders"))
  const openedAt = timestamp(now)
  const previousSlots = previous?.slots.map(slot => ({
    ...slot,
    placeholderValues:normalizedPlaceholderValues(slot.placeholderValues, placeholderDefinitions),
  })) || [{
    id:"reader-slot-default",
    name:"",
    createdAt:openedAt,
    updatedAt:openedAt,
    identityId:"",
    placeholderValues:{},
    progress:null,
    completedAt:0,
    bookmarks:[],
  }]
  const nextBook = {
    id,
    type:ownData(work, "type") === "phone" ? "phone" : "article",
    title:text(ownData(work, "title"), "无标题作品"),
    author:text(ownData(work, "author")),
    coverColor:text(ownData(work, "coverColor")),
    addedAt:previous?.addedAt || openedAt,
    lastOpenedAt:openedAt,
    placeholderDefinitions,
  }
  if (previous?.unseenUpdateAt) nextBook.unseenUpdateAt = previous.unseenUpdateAt
  if (previous?.pinnedAt) nextBook.pinnedAt = previous.pinnedAt
  const next = mirrorActiveSlot(nextBook, previousSlots, previous?.activeSlotId || previousSlots[0].id)
  return withBooks(current, [
    next,
    ...current.books.filter(book => book.id !== id),
  ].slice(0, MAX_BOOKS))
}

export function createReaderSlot(library, workId, candidate, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!plainRecord(candidate)) return current
  const id = ownData(candidate, "id")
  if (!exactId(id)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId || book.slots.length >= MAX_SLOTS || book.slots.some(slot => slot.id === id)) {
      return book
    }
    const active = readerActiveSlot(book)
    const savedAt = timestamp(now)
    const slot = {
      id,
      name:text(ownData(candidate, "name")).trim(),
      createdAt:savedAt,
      updatedAt:savedAt,
      identityId:active?.identityId || "",
      placeholderValues:normalizedPlaceholderValues(active?.placeholderValues, book.placeholderDefinitions),
      progress:null,
      completedAt:0,
      bookmarks:[],
    }
    return mirrorActiveSlot({
      ...book,
      lastOpenedAt:savedAt,
    }, [...book.slots, slot], id)
  }))
}

export function switchReaderSlot(library, workId, slotId, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(slotId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId || !book.slots.some(slot => slot.id === slotId)) return book
    return mirrorActiveSlot({
      ...book,
      lastOpenedAt:timestamp(now, book.lastOpenedAt),
    }, book.slots, slotId)
  }))
}

export function renameReaderSlot(library, workId, slotId, name, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(slotId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    const slots = book.slots.map(slot => slot.id === slotId ? {
      ...slot,
      name:text(name).trim(),
      updatedAt:timestamp(now, slot.updatedAt),
    } : slot)
    return mirrorActiveSlot(book, slots, book.activeSlotId)
  }))
}

export function removeReaderSlot(library, workId, slotId, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(slotId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId || book.slots.length <= 1) return book
    const slots = book.slots.filter(slot => slot.id !== slotId)
    if (slots.length === book.slots.length) return book
    const activeSlotId = book.activeSlotId === slotId ? slots[0].id : book.activeSlotId
    return mirrorActiveSlot({
      ...book,
      lastOpenedAt:timestamp(now, book.lastOpenedAt),
    }, slots, activeSlotId)
  }))
}

export function saveReaderIdentity(library, candidate, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!plainRecord(candidate)) return current
  const id = ownData(candidate, "id")
  const previous = current.identities.find(identity => identity.id === id)
  const identity = normalizedIdentity({
    id,
    name:ownData(candidate, "name"),
    values:ownData(candidate, "values"),
    createdAt:previous?.createdAt || timestamp(now),
    updatedAt:timestamp(now),
  })
  if (!identity) return current
  const identities = [
    identity,
    ...current.identities.filter(item => item.id !== identity.id),
  ].slice(0, MAX_IDENTITIES)
  return { ...current, identities }
}

export function removeReaderIdentity(library, identityId) {
  const current = normalizedLibrary(library)
  if (!exactId(identityId)) return current
  const books = current.books.map(book => {
    const slots = book.slots.map(slot => slot.identityId === identityId
      ? { ...slot, identityId:"" }
      : slot)
    return mirrorActiveSlot(book, slots, book.activeSlotId)
  })
  return {
    ...current,
    identities:current.identities.filter(identity => identity.id !== identityId),
    books,
  }
}

export function applyReaderIdentity(library, workId, identityId, now = Date.now()) {
  const current = normalizedLibrary(library)
  const identity = current.identities.find(item => item.id === identityId)
  if (!identity) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    return updateActiveBookSlot(book, slot => {
      const values = { ...slot.placeholderValues }
      for (const definition of book.placeholderDefinitions) {
        const key = definition.key || definition.label || definition.id
        if (Object.hasOwn(identity.values, key)) values[definition.id] = [identity.values[key]]
      }
      return {
        ...slot,
        identityId:identity.id,
        placeholderValues:values,
        updatedAt:timestamp(now, slot.updatedAt),
      }
    })
  }))
}

export function saveReaderPlaceholders(library, workId, values, now = Date.now()) {
  const current = normalizedLibrary(library)
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot({
      ...book,
      lastOpenedAt:timestamp(now, book.lastOpenedAt),
    }, slot => ({
      ...slot,
      placeholderValues:normalizedPlaceholderValues(values, book.placeholderDefinitions),
      updatedAt:timestamp(now, slot.updatedAt),
    }))
    : book))
}

export function saveReaderProgress(library, workId, progress, now = Date.now()) {
  const current = normalizedLibrary(library)
  const normalized = normalizedProgress({
    ...progress,
    savedAt:timestamp(now),
  })
  if (!normalized) return current
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot({
      ...book,
      lastOpenedAt:timestamp(now, book.lastOpenedAt),
    }, slot => ({
      ...slot,
      progress:normalized,
      updatedAt:timestamp(now, slot.updatedAt),
    }))
    : book))
}

export function clearReaderProgress(library, workId, now = Date.now()) {
  const current = normalizedLibrary(library)
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot({
      ...book,
      lastOpenedAt:timestamp(now, book.lastOpenedAt),
    }, slot => ({
      ...slot,
      progress:null,
      completedAt:0,
      updatedAt:timestamp(now, slot.updatedAt),
    }))
    : book))
}

export function readerBookStatus(book) {
  const current = normalizedBook(book)
  if (!current) return "unread"
  if (current.completedAt > 0) return "completed"
  return current.progress ? "reading" : "unread"
}

export function setReaderCompletion(library, workId, completed, now = Date.now()) {
  const current = normalizedLibrary(library)
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot(book, slot => ({
      ...slot,
      completedAt:completed ? timestamp(now) : 0,
      updatedAt:timestamp(now, slot.updatedAt),
    }))
    : book))
}

export function setReaderBookPinned(library, workId, pinned, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(workId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    if (pinned === true) {
      if (book.pinnedAt) return book
      const pinnedAt = timestamp(now)
      return pinnedAt ? { ...book, pinnedAt } : book
    }
    if (!book.pinnedAt) return book
    const { pinnedAt, ...next } = book
    return next
  }))
}

function bookmarkSignature(bookmark) {
  return JSON.stringify([
    bookmark.kind,
    bookmark.path,
    bookmark.choiceMemory,
    bookmark.interactionSelections,
  ])
}

export function toggleReaderBookmark(library, workId, bookmark, now = Date.now()) {
  const current = normalizedLibrary(library)
  const next = normalizedBookmark({ ...bookmark, savedAt:timestamp(now) })
  if (!next) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    return updateActiveBookSlot(book, slot => {
      const signature = bookmarkSignature(next)
      const matches = slot.bookmarks.some(candidate => bookmarkSignature(candidate) === signature)
      return {
        ...slot,
        bookmarks:matches
          ? slot.bookmarks.filter(candidate => bookmarkSignature(candidate) !== signature)
          : [next, ...slot.bookmarks].slice(0, MAX_BOOKMARKS),
        updatedAt:timestamp(now, slot.updatedAt),
      }
    })
  }))
}

export function removeReaderBookmark(library, workId, bookmarkId) {
  const current = normalizedLibrary(library)
  if (!exactId(bookmarkId)) return current
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot(book, slot => ({
      ...slot,
      bookmarks:slot.bookmarks.filter(bookmark => bookmark.id !== bookmarkId),
    }))
    : book))
}

export function restoreReaderBookmark(library, workId, bookmark) {
  const current = normalizedLibrary(library)
  const restored = normalizedBookmark(bookmark)
  if (!exactId(workId) || !restored) return current
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot(book, slot => {
      if (slot.bookmarks.some(candidate => candidate.id === restored.id)) return slot
      return {
        ...slot,
        bookmarks:[restored, ...slot.bookmarks].slice(0, MAX_BOOKMARKS),
      }
    })
    : book))
}

export function updateReaderBookmark(library, workId, bookmarkId, changes, now = Date.now()) {
  const current = normalizedLibrary(library)
  if (!exactId(bookmarkId) || !plainRecord(changes)) return current
  return withBooks(current, current.books.map(book => book.id === workId
    ? updateActiveBookSlot(book, slot => ({
      ...slot,
      bookmarks:slot.bookmarks.map(bookmark => bookmark.id === bookmarkId ? {
        ...bookmark,
        label:text(ownData(changes, "label"), bookmark.label).trim() || "阅读位置",
        note:text(ownData(changes, "note"), bookmark.note),
        savedAt:timestamp(now, bookmark.savedAt),
      } : bookmark),
      updatedAt:timestamp(now, slot.updatedAt),
    }))
    : book))
}

export function removeReaderBook(library, workId) {
  const current = normalizedLibrary(library)
  if (!exactId(workId)) return current
  return withBooks(current, current.books.filter(book => book.id !== workId))
}

export function restoreReaderBook(library, book) {
  const current = normalizedLibrary(library)
  const restored = normalizedBook(book)
  if (!restored || current.books.some(candidate => candidate.id === restored.id)) return current
  return withBooks(current, [restored, ...current.books].slice(0, MAX_BOOKS))
}

function normalizedMatchToken(value) {
  return text(value).trim().toLocaleLowerCase("zh-CN")
}

function uniqueDefinitionLookup(definitions, field) {
  const groups = new Map()
  for (const definition of definitions) {
    const token = normalizedMatchToken(definition[field])
    if (!token) continue
    const matches = groups.get(token) || []
    matches.push(definition)
    groups.set(token, matches)
  }
  return new Map(
    [...groups.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([token, matches]) => [token, matches[0]]),
  )
}

function migratePlaceholderValues(values, previousDefinitions, incomingDefinitions) {
  const previousValues = normalizedPlaceholderValues(values, previousDefinitions)
  const previousById = new Map(previousDefinitions.map(definition => [definition.id, definition]))
  const previousByKey = uniqueDefinitionLookup(previousDefinitions, "key")
  const previousByLabel = uniqueDefinitionLookup(previousDefinitions, "label")
  const incomingByKey = uniqueDefinitionLookup(incomingDefinitions, "key")
  const incomingByLabel = uniqueDefinitionLookup(incomingDefinitions, "label")
  const usedPreviousIds = new Set()
  const result = {}

  for (const incoming of incomingDefinitions) {
    let previous = previousById.get(incoming.id)
    if (!previous) {
      const key = normalizedMatchToken(incoming.key)
      if (key && incomingByKey.get(key)?.id === incoming.id) previous = previousByKey.get(key)
    }
    if (!previous) {
      const label = normalizedMatchToken(incoming.label)
      if (label && incomingByLabel.get(label)?.id === incoming.id) previous = previousByLabel.get(label)
    }
    if (!previous || usedPreviousIds.has(previous.id) || !previousValues[previous.id]) continue
    usedPreviousIds.add(previous.id)
    result[incoming.id] = previousValues[previous.id].slice()
  }
  return result
}

function visibleNodeText(value) {
  return text(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("zh-CN")
}

function workNodes(work) {
  return Array.isArray(work?.nodes) ? work.nodes.filter(plainRecord) : []
}

function workChapters(work) {
  return Array.isArray(work?.chapters) ? work.chapters.filter(plainRecord) : []
}

function uniqueRecordBy(records, selector, expected) {
  if (!expected) return null
  const matches = records.filter(record => selector(record) === expected)
  return matches.length === 1 ? matches[0] : null
}

function correspondingChapterId(previousWork, incomingWork, chapterId) {
  const incomingChapters = workChapters(incomingWork)
  if (incomingChapters.some(chapter => ownData(chapter, "id") === chapterId)) return chapterId
  const previousChapter = workChapters(previousWork).find(chapter => ownData(chapter, "id") === chapterId)
  const previousName = normalizedMatchToken(ownData(previousChapter, "name"))
  return ownData(uniqueRecordBy(
    incomingChapters,
    chapter => normalizedMatchToken(ownData(chapter, "name")),
    previousName,
  ), "id") || ""
}

function nearbyIncomingNode(previousWork, incomingWork, previousNode) {
  if (!previousNode) return null
  const previousChapterId = ownData(previousNode, "chapterId")
  const incomingChapterId = correspondingChapterId(previousWork, incomingWork, previousChapterId)
  const incomingNodes = workNodes(incomingWork)
  const chapterCandidates = incomingNodes.filter(node => (
    !incomingChapterId || ownData(node, "chapterId") === incomingChapterId
  ))
  const title = normalizedMatchToken(ownData(previousNode, "title"))
  const byTitle = uniqueRecordBy(
    chapterCandidates,
    node => normalizedMatchToken(ownData(node, "title")),
    title,
  )
  if (byTitle) return byTitle
  const content = visibleNodeText(ownData(previousNode, "content"))
  const byContent = uniqueRecordBy(
    chapterCandidates,
    node => visibleNodeText(ownData(node, "content")),
    content,
  )
  if (byContent) return byContent

  const previousChapterNodes = workNodes(previousWork).filter(node => (
    ownData(node, "chapterId") === previousChapterId
  ))
  const previousIndex = previousChapterNodes.indexOf(previousNode)
  if (previousIndex >= 0 && chapterCandidates.length) {
    return chapterCandidates[Math.min(previousIndex, chapterCandidates.length - 1)]
  }
  return null
}

function repairBookmarkForWork(bookmark, previousWork, incomingWork) {
  if (bookmark.kind !== "article") return bookmark
  const incomingNodes = workNodes(incomingWork)
  const incomingById = new Map(incomingNodes.map(node => [ownData(node, "id"), node]))
  const previousById = new Map(workNodes(previousWork).map(node => [ownData(node, "id"), node]))
  let moved = false
  const path = []
  for (const nodeId of bookmark.path) {
    let nextId = incomingById.has(nodeId) ? nodeId : ""
    if (!nextId) {
      const nearby = nearbyIncomingNode(previousWork, incomingWork, previousById.get(nodeId))
      nextId = ownData(nearby, "id") || ""
      moved = true
    }
    if (nextId && !path.includes(nextId)) path.push(nextId)
  }
  if (!path.length) {
    const fallbackId = ownData(incomingWork, "startNode") || ownData(incomingNodes[0], "id")
    if (exactId(fallbackId)) path.push(fallbackId)
    moved = true
  }
  if (!moved) return bookmark
  return {
    ...bookmark,
    path,
    updateStatus:"moved",
  }
}

export function reconcileReaderWorkUpdate(
  library,
  previousWork,
  incomingWork,
  options = {},
) {
  const current = normalizedLibrary(library)
  const workId = ownData(incomingWork, "id")
  if (
    !plainRecord(previousWork)
    || !plainRecord(incomingWork)
    || !exactId(workId)
    || ownData(previousWork, "id") !== workId
  ) {
    return current
  }
  const previousDefinitions = normalizedDefinitions(ownData(previousWork, "placeholders"))
  const incomingDefinitions = normalizedDefinitions(ownData(incomingWork, "placeholders"))
  const updatedAt = timestamp(options.now, Date.now())
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId) return book
    const slots = book.slots.map(slot => ({
      ...slot,
      placeholderValues:migratePlaceholderValues(
        slot.placeholderValues,
        previousDefinitions,
        incomingDefinitions,
      ),
      bookmarks:slot.bookmarks.map(bookmark => (
        repairBookmarkForWork(bookmark, previousWork, incomingWork)
      )),
    }))
    const nextBook = {
      ...book,
      type:ownData(incomingWork, "type") === "phone" ? "phone" : "article",
      title:text(ownData(incomingWork, "title"), book.title),
      author:text(ownData(incomingWork, "author"), book.author),
      coverColor:text(ownData(incomingWork, "coverColor"), book.coverColor),
      placeholderDefinitions:incomingDefinitions,
    }
    if (options.markUpdated === true) nextBook.unseenUpdateAt = updatedAt
    return mirrorActiveSlot(nextBook, slots, book.activeSlotId)
  }))
}

export function dismissReaderWorkUpdate(library, workId) {
  const current = normalizedLibrary(library)
  if (!exactId(workId)) return current
  return withBooks(current, current.books.map(book => {
    if (book.id !== workId || !book.unseenUpdateAt) return book
    const { unseenUpdateAt, ...next } = book
    return next
  }))
}

function checkpointSignature(checkpoint) {
  return JSON.stringify([
    checkpoint.sourceNodeId,
    checkpoint.path,
    checkpoint.choiceMemory,
    checkpoint.interactionSelections,
  ])
}

export function appendReaderCheckpoint(progress, checkpoint, now = Date.now()) {
  const current = normalizedProgress(progress)
  const next = normalizedCheckpoint({ ...checkpoint, savedAt:timestamp(now) })
  if (!current || current.kind !== "article" || !next) return current
  const signature = checkpointSignature(next)
  const checkpoints = current.checkpoints
    .filter(candidate => checkpointSignature(candidate) !== signature)
    .concat(next)
    .slice(-MAX_CHECKPOINTS)
  return { ...current, checkpoints }
}

function uniqueNodes(work) {
  const nodes = Array.isArray(work?.nodes) ? work.nodes : []
  const byId = new Map()
  const duplicates = new Set()
  for (const node of nodes) {
    const id = ownData(node, "id")
    if (!exactId(id)) continue
    if (byId.has(id)) duplicates.add(id)
    else byId.set(id, node)
  }
  for (const id of duplicates) byId.delete(id)
  return byId
}

function validChoiceMemory(byId, memory) {
  const result = {}
  for (const [nodeId, choiceId] of Object.entries(normalizedIdMap(memory))) {
    const node = byId.get(nodeId)
    const choices = Array.isArray(ownData(node, "choices")) ? ownData(node, "choices") : []
    const matches = choices.filter(choice => ownData(choice, "id") === choiceId)
    if (matches.length === 1) result[nodeId] = choiceId
  }
  return result
}

function validInteractionSelections(byId, selections) {
  const result = {}
  for (const [groupId, selection] of Object.entries(normalizedInteractionSelections(selections))) {
    const node = byId.get(selection.nodeId)
    const groups = Array.isArray(ownData(node, "interactionGroups"))
      ? ownData(node, "interactionGroups")
      : []
    const matchingGroups = groups.filter(group => ownData(group, "id") === groupId)
    if (matchingGroups.length !== 1) continue
    const choices = Array.isArray(ownData(matchingGroups[0], "choices"))
      ? ownData(matchingGroups[0], "choices")
      : []
    if (choices.filter(choice => ownData(choice, "id") === selection.choiceId).length !== 1) continue
    result[groupId] = selection
  }
  return result
}

export function restoreArticleReadingState(work, progress) {
  if (!plainRecord(work) || ownData(work, "type") === "phone") return null
  const current = normalizedProgress(progress)
  if (!current || current.kind !== "article") return null
  const byId = uniqueNodes(work)
  if (!current.path.length || current.path.some(nodeId => !byId.has(nodeId))) return null
  const checkpoints = current.checkpoints.flatMap(checkpoint => {
    if (!byId.has(checkpoint.sourceNodeId) || checkpoint.path.some(nodeId => !byId.has(nodeId))) return []
    return [{
      ...checkpoint,
      choiceMemory:validChoiceMemory(byId, checkpoint.choiceMemory),
      interactionSelections:validInteractionSelections(byId, checkpoint.interactionSelections),
    }]
  })
  return {
    kind:"article",
    path:current.path.slice(),
    choiceMemory:validChoiceMemory(byId, current.choiceMemory),
    interactionSelections:validInteractionSelections(byId, current.interactionSelections),
    checkpoints,
    readingPosition:current.readingPosition
      && current.readingPosition.pathIndex < current.path.length
      ? current.readingPosition
      : null,
    savedAt:current.savedAt,
  }
}
