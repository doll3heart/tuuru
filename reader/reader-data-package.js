import {
  READER_LIBRARY_STORAGE_KEY,
  emptyReaderLibrary,
  readReaderLibrary,
} from "./reader-library-state.js"
import { createReaderAppearancePackage } from "./appearance-package.js"

export const READER_DATA_PACKAGE_FORMAT = "tuuru-reader-data"
export const READER_DATA_PACKAGE_VERSION = 1
export const READER_DATA_PACKAGE_MAX_BYTES = 2 * 1024 * 1024

const MAX_TEXT_LENGTH = 500
const MAX_OBJECT_NODES = 50_000
const PRESET_KEYS = Object.freeze(["name", "nickname", "webname"])
const PHONE_APP_TYPES = Object.freeze([
  "messages",
  "forum",
  "memo",
  "gallery",
  "browser",
  "shopping",
  "contacts",
])

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownData(record, key) {
  if (!isRecord(record)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
}

function safeClone(value, state = { count:0 }, depth = 0) {
  state.count += 1
  if (state.count > MAX_OBJECT_NODES || depth > 32) {
    throw new TypeError("Reader data package is too complex")
  }
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "string") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new TypeError("Reader data package contains too many items")
    const result = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !Object.hasOwn(descriptor, "value")) {
        throw new TypeError("Reader data package contains unreadable data")
      }
      result.push(safeClone(descriptor.value, state, depth + 1))
    }
    return result
  }
  if (!isRecord(value)) throw new TypeError("Reader data package contains unsupported data")
  const result = {}
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("Reader data package contains unreadable data")
    }
    result[key] = safeClone(descriptor.value, state, depth + 1)
  }
  return result
}

function utf8Size(value) {
  return new TextEncoder().encode(value).byteLength
}

function cleanText(value, maximum = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.slice(0, maximum) : ""
}

function normalizedReaderLibrary(candidate) {
  if (!isRecord(candidate)) return emptyReaderLibrary()
  const serialized = JSON.stringify(safeClone(candidate))
  return readReaderLibrary({
    getItem(key) {
      return key === READER_LIBRARY_STORAGE_KEY ? serialized : null
    },
  })
}

function portableProfile(candidate) {
  return {
    readerId:cleanText(ownData(candidate, "readerId"), 80),
    bio:cleanText(ownData(candidate, "bio"), 1000),
  }
}

function portablePresets(candidate) {
  const result = {}
  for (const key of PRESET_KEYS) result[key] = cleanText(ownData(candidate, key))
  return result
}

function portableAppearance(candidate) {
  const appearance = createReaderAppearancePackage(candidate).appearance
  const article = { ...appearance.article }
  delete article.backgroundImage
  delete article.customFonts

  const phone = { ...appearance.phone }
  delete phone.wallpaperImage
  delete phone.topBgImage
  delete phone.customFonts
  delete phone.customIcons
  delete phone.appBgs
  const appSettings = {}
  for (const type of PHONE_APP_TYPES) {
    const settings = { ...(phone.appSettings?.[type] || {}) }
    delete settings.callBackgroundImage
    appSettings[type] = settings
  }
  phone.appSettings = appSettings
  return { article, phone }
}

function canonicalExportTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  const iso = date.toISOString()
  if (new Date(iso).toISOString() !== iso) throw new TypeError("Reader data export time is invalid")
  return iso
}

function summaryForLibrary(library) {
  const books = Array.isArray(library?.books) ? library.books : []
  const slots = books.flatMap(book => Array.isArray(book.slots) ? book.slots : [])
  return {
    books:books.length,
    slots:slots.length,
    identities:Array.isArray(library?.identities) ? library.identities.length : 0,
    bookmarks:slots.reduce((total, slot) => total + (Array.isArray(slot.bookmarks) ? slot.bookmarks.length : 0), 0),
  }
}

function createReaderDataPackage(input, exportedAt) {
  const source = isRecord(input) ? input : {}
  const library = normalizedReaderLibrary(ownData(source, "library"))
  return {
    format:READER_DATA_PACKAGE_FORMAT,
    version:READER_DATA_PACKAGE_VERSION,
    exportedAt:canonicalExportTime(exportedAt),
    library,
    profile:portableProfile(ownData(source, "profile")),
    placeholderPresets:portablePresets(ownData(source, "placeholderPresets")),
    appearance:portableAppearance(ownData(source, "appearance")),
  }
}

function parsePackage(input) {
  if (typeof input === "string") {
    if (utf8Size(input) > READER_DATA_PACKAGE_MAX_BYTES) {
      throw new TypeError("Reader data package is too large")
    }
    try {
      return JSON.parse(input)
    } catch {
      throw new TypeError("Reader data package JSON cannot be parsed")
    }
  }
  if (!isRecord(input)) throw new TypeError("Reader data package format is invalid")
  return safeClone(input)
}

export function serializeReaderDataPackage(input, exportedAt = new Date()) {
  const serialized = JSON.stringify(createReaderDataPackage(input, exportedAt), null, 2)
  if (utf8Size(serialized) > READER_DATA_PACKAGE_MAX_BYTES) {
    throw new TypeError("Reader data package is too large")
  }
  return serialized
}

export function inspectReaderDataPackage(input) {
  const parsed = parsePackage(input)
  if (ownData(parsed, "format") !== READER_DATA_PACKAGE_FORMAT) {
    throw new TypeError("This is not a Tuuru reader data package")
  }
  if (ownData(parsed, "version") !== READER_DATA_PACKAGE_VERSION) {
    throw new TypeError("Reader data package version is not supported")
  }
  const exportedAt = ownData(parsed, "exportedAt")
  const librarySource = ownData(parsed, "library")
  const profileSource = ownData(parsed, "profile")
  const presetsSource = ownData(parsed, "placeholderPresets")
  const appearanceSource = ownData(parsed, "appearance")
  if (!isRecord(librarySource)
    || !isRecord(profileSource)
    || !isRecord(presetsSource)
    || !isRecord(appearanceSource)) {
    throw new TypeError("Reader data package is missing required data")
  }
  const normalized = createReaderDataPackage({
    library:librarySource,
    profile:profileSource,
    placeholderPresets:presetsSource,
    appearance:appearanceSource,
  }, exportedAt)
  return {
    ...normalized,
    summary:summaryForLibrary(normalized.library),
  }
}

function mergeByUpdatedAt(currentItems, incomingItems) {
  const merged = new Map()
  for (const item of currentItems) merged.set(item.id, item)
  for (const item of incomingItems) {
    const current = merged.get(item.id)
    if (!current || Number(item.updatedAt || 0) > Number(current.updatedAt || 0)) {
      merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}

function mergeBook(currentBook, incomingBook) {
  if (!currentBook) return incomingBook
  const incomingIsNewer = Number(incomingBook.lastOpenedAt || 0) > Number(currentBook.lastOpenedAt || 0)
  const preferred = incomingIsNewer ? incomingBook : currentBook
  const slots = mergeByUpdatedAt(currentBook.slots || [], incomingBook.slots || [])
  const activeSlotId = slots.some(slot => slot.id === preferred.activeSlotId)
    ? preferred.activeSlotId
    : slots[0]?.id
  const merged = {
    ...preferred,
    addedAt:Math.min(
      Number(currentBook.addedAt || Number.MAX_SAFE_INTEGER),
      Number(incomingBook.addedAt || Number.MAX_SAFE_INTEGER),
    ),
    lastOpenedAt:Math.max(
      Number(currentBook.lastOpenedAt || 0),
      Number(incomingBook.lastOpenedAt || 0),
    ),
    slots,
    activeSlotId,
  }
  if (currentBook.pinnedAt) merged.pinnedAt = currentBook.pinnedAt
  else delete merged.pinnedAt
  return merged
}

function mergeLibraries(currentCandidate, incomingCandidate) {
  const current = normalizedReaderLibrary(currentCandidate)
  const incoming = normalizedReaderLibrary(incomingCandidate)
  const byId = new Map(current.books.map(book => [book.id, book]))
  for (const book of incoming.books) byId.set(book.id, mergeBook(byId.get(book.id), book))
  const books = [...byId.values()]
    .sort((left, right) => Number(right.lastOpenedAt || 0) - Number(left.lastOpenedAt || 0))
    .slice(0, 100)
  return normalizedReaderLibrary({
    version:current.version,
    identities:mergeByUpdatedAt(current.identities || [], incoming.identities || []),
    books,
  })
}

function mergedAppearance(currentCandidate, incomingCandidate) {
  const current = createReaderAppearancePackage(currentCandidate).appearance
  const incoming = portableAppearance(incomingCandidate)
  const article = {
    ...current.article,
    ...incoming.article,
    backgroundImage:current.article.backgroundImage,
    customFonts:current.article.customFonts,
  }
  const phoneAppSettings = {}
  for (const type of PHONE_APP_TYPES) {
    const currentSettings = current.phone.appSettings?.[type] || {}
    const incomingSettings = incoming.phone.appSettings?.[type] || {}
    phoneAppSettings[type] = {
      ...currentSettings,
      ...incomingSettings,
    }
    if (Object.hasOwn(currentSettings, "callBackgroundImage")) {
      phoneAppSettings[type].callBackgroundImage = currentSettings.callBackgroundImage
    }
  }
  const phone = {
    ...current.phone,
    ...incoming.phone,
    wallpaperImage:current.phone.wallpaperImage,
    topBgImage:current.phone.topBgImage,
    customFonts:current.phone.customFonts,
    customIcons:current.phone.customIcons,
    appBgs:current.phone.appBgs,
    appSettings:phoneAppSettings,
  }
  return createReaderAppearancePackage({ article, phone }).appearance
}

export function mergeReaderDataPackage(currentInput, incomingInput) {
  const current = isRecord(currentInput) ? currentInput : {}
  const incoming = inspectReaderDataPackage(incomingInput)
  const currentProfile = isRecord(ownData(current, "profile")) ? ownData(current, "profile") : {}
  return {
    library:mergeLibraries(ownData(current, "library"), incoming.library),
    profile:{
      ...portableProfile(incoming.profile),
      readerAvatar:cleanText(ownData(currentProfile, "readerAvatar"), READER_DATA_PACKAGE_MAX_BYTES),
    },
    placeholderPresets:portablePresets(incoming.placeholderPresets),
    appearance:mergedAppearance(ownData(current, "appearance"), incoming.appearance),
    summary:summaryForLibrary(incoming.library),
  }
}
