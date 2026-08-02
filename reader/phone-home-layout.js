export const PHONE_HOME_COLUMNS = 8
export const PHONE_HOME_ROWS = 13
export const PHONE_HOME_MAX_PAGES = 9
export const PHONE_HOME_CELL_WIDTH = 40
export const PHONE_HOME_CELL_HEIGHT = 42

export const PHONE_HOME_APP_TYPES = Object.freeze([
  "messages", "forum", "memo", "gallery", "browser", "shopping", "contacts",
])

const APP_TYPE_SET = new Set(PHONE_HOME_APP_TYPES)

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null ? value : {}
}

function integer(value, fallback = 0) {
  const number = Number(value)
  return Number.isInteger(number) ? number : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function safeProductId(value) {
  const id = typeof value === "string" ? value.trim() : ""
  return /^v7-[a-z0-9-]{1,64}$/.test(id) ? id : ""
}

function safeCustomDecorationId(value) {
  const id = typeof value === "string" ? value.trim() : ""
  return /^custom-[a-z0-9-]{8,80}$/.test(id) ? id : ""
}

export function phoneHomeItemKey(kind, id) {
  if (kind === "profile" && id === "identity") return "profile:identity"
  if (kind === "app" && APP_TYPE_SET.has(id)) return `app:${id}`
  const customId = kind === "custom" ? safeCustomDecorationId(id) : ""
  if (customId) return `custom:${customId}`
  const productId = kind === "widget" ? safeProductId(id) : ""
  return productId ? `widget:${productId}` : ""
}

export function phoneHomeFootprint(definition) {
  if (definition?.kind === "profile") return { width:8, height:3 }
  if (definition?.kind === "custom") {
    if (definition.size === "small") return { width:2, height:2 }
    return definition.size === "wide" ? { width:8, height:3 } : { width:4, height:3 }
  }
  if (definition?.kind === "widget") {
    return definition.size === "wide" ? { width:8, height:3 } : { width:4, height:3 }
  }
  return { width:2, height:2 }
}

export function phoneHomeDefinitions(desktopWidgets, appTypes = PHONE_HOME_APP_TYPES) {
  const definitions = [{ key:"profile:identity", kind:"profile", id:"identity", size:"wide", initial:{ page:0, x:0, y:0 } }]
  const seen = new Set(["profile:identity"])
  for (const type of Array.isArray(appTypes) ? appTypes : []) {
    const key = phoneHomeItemKey("app", type)
    if (!key || seen.has(key)) continue
    const index = PHONE_HOME_APP_TYPES.indexOf(type)
    definitions.push({
      key,
      kind:"app",
      id:type,
      size:"app",
      initial:{ page:0, x:(index % 4) * 2, y:3 + Math.floor(index / 4) * 2 },
    })
    seen.add(key)
  }
  const items = Array.isArray(desktopWidgets?.items) ? desktopWidgets.items : []
  for (const item of items) {
    if (!item?.enabled) continue
    const key = phoneHomeItemKey("widget", item.productId)
    if (!key || seen.has(key)) continue
    definitions.push({ key, kind:"widget", id:item.productId, size:item.size === "wide" ? "wide" : "half" })
    seen.add(key)
  }
  const customDecorations = Array.isArray(desktopWidgets?.customDecorations) ? desktopWidgets.customDecorations : []
  for (const item of customDecorations) {
    const key = phoneHomeItemKey("custom", item?.id)
    if (!key || seen.has(key)) continue
    definitions.push({
      key,
      kind:"custom",
      id:item.id,
      size:item.size === "small" || item.size === "wide" ? item.size : "half",
    })
    seen.add(key)
  }
  return definitions
}

export function defaultPhoneHomeLayout() {
  return normalizePhoneHomeLayout(null, phoneHomeDefinitions(null))
}

function fits(position, footprint) {
  return position.page >= 0
    && position.page < PHONE_HOME_MAX_PAGES
    && position.x >= 0
    && position.y >= 0
    && position.x + footprint.width <= PHONE_HOME_COLUMNS
    && position.y + footprint.height <= PHONE_HOME_ROWS
}

function overlaps(a, aFootprint, b, bFootprint) {
  return a.page === b.page
    && a.x < b.x + bFootprint.width
    && a.x + aFootprint.width > b.x
    && a.y < b.y + bFootprint.height
    && a.y + aFootprint.height > b.y
}

function occupied(position, footprint, placed, definitionsByKey, ignoredKeys = new Set()) {
  return placed.some(item => {
    if (ignoredKeys.has(item.key)) return false
    const definition = definitionsByKey.get(item.key)
    return definition && overlaps(position, footprint, item, phoneHomeFootprint(definition))
  })
}

function scanPositions(footprint, startPage = 0) {
  const positions = []
  const stepX = footprint.width === 8 ? 8 : (footprint.width === 4 ? 4 : 2)
  const stepY = 1
  for (let offset = 0; offset < PHONE_HOME_MAX_PAGES; offset += 1) {
    const page = (startPage + offset) % PHONE_HOME_MAX_PAGES
    for (let y = 0; y <= PHONE_HOME_ROWS - footprint.height; y += stepY) {
      for (let x = 0; x <= PHONE_HOME_COLUMNS - footprint.width; x += stepX) {
        positions.push({ page, x, y })
      }
    }
  }
  return positions
}

function firstAvailable(definition, placed, definitionsByKey, startPage = 0) {
  const footprint = phoneHomeFootprint(definition)
  return scanPositions(footprint, startPage).find(position => (
    !occupied(position, footprint, placed, definitionsByKey)
  )) || null
}

function candidatePosition(raw) {
  const item = plainRecord(raw)
  return {
    page:clamp(integer(item.page), 0, PHONE_HOME_MAX_PAGES - 1),
    x:integer(item.x, -1),
    y:integer(item.y, -1),
  }
}

export function normalizePhoneHomeLayout(candidate, definitions) {
  const source = plainRecord(candidate)
  const safeDefinitions = Array.isArray(definitions) ? definitions.filter(definition => (
    definition && typeof definition === "object" && typeof definition.key === "string"
  )) : []
  const definitionsByKey = new Map(safeDefinitions.map(definition => [definition.key, definition]))
  const sourceItems = Array.isArray(source.items) ? source.items : []
  const sourceByKey = new Map()
  for (const raw of sourceItems) {
    const item = plainRecord(raw)
    if (definitionsByKey.has(item.key) && !sourceByKey.has(item.key)) sourceByKey.set(item.key, item)
  }
  const placed = []
  for (const definition of safeDefinitions) {
    const desired = sourceByKey.has(definition.key)
      ? candidatePosition(sourceByKey.get(definition.key))
      : (definition.initial ? candidatePosition(definition.initial) : null)
    const footprint = phoneHomeFootprint(definition)
    let position = desired && fits(desired, footprint)
      && !occupied(desired, footprint, placed, definitionsByKey)
      ? desired
      : null
    if (!position) position = firstAvailable(definition, placed, definitionsByKey, desired?.page || 0)
    if (position) placed.push({ key:definition.key, ...position })
  }
  const highestUsedPage = placed.reduce((highest, item) => Math.max(highest, item.page), 0)
  const requestedPages = clamp(integer(source.pageCount, 1), 1, PHONE_HOME_MAX_PAGES)
  return {
    pageCount:Math.max(requestedPages, highestUsedPage + 1),
    items:placed,
  }
}

export function movePhoneHomeItem(candidate, definitions, key, target) {
  const layout = normalizePhoneHomeLayout(candidate, definitions)
  const definitionsByKey = new Map(definitions.map(definition => [definition.key, definition]))
  const definition = definitionsByKey.get(key)
  const current = layout.items.find(item => item.key === key)
  if (!definition || !current) return layout
  const footprint = phoneHomeFootprint(definition)
  const desired = {
    page:clamp(integer(target?.page), 0, PHONE_HOME_MAX_PAGES - 1),
    x:clamp(integer(target?.x), 0, PHONE_HOME_COLUMNS - footprint.width),
    y:clamp(integer(target?.y), 0, PHONE_HOME_ROWS - footprint.height),
  }
  const others = layout.items.filter(item => item.key !== key)
  const collisions = others.filter(item => {
    const otherDefinition = definitionsByKey.get(item.key)
    return otherDefinition && overlaps(desired, footprint, item, phoneHomeFootprint(otherDefinition))
  })
  if (collisions.length === 1) {
    const other = collisions[0]
    const otherDefinition = definitionsByKey.get(other.key)
    const otherFootprint = phoneHomeFootprint(otherDefinition)
    if (otherFootprint.width === footprint.width && otherFootprint.height === footprint.height) {
      other.page = current.page
      other.x = current.x
      other.y = current.y
      current.page = desired.page
      current.x = desired.x
      current.y = desired.y
      layout.pageCount = Math.max(layout.pageCount, desired.page + 1)
      return normalizePhoneHomeLayout(layout, definitions)
    }
  }
  const collisionKeys = new Set(collisions.map(item => item.key))
  const retained = others.filter(item => !collisionKeys.has(item.key))
  const moved = { key, ...desired }
  const placed = [...retained, moved]
  for (const displaced of collisions) {
    const displacedDefinition = definitionsByKey.get(displaced.key)
    const next = firstAvailable(displacedDefinition, placed, definitionsByKey, displaced.page)
    if (next) placed.push({ key:displaced.key, ...next })
  }
  const highestUsedPage = placed.reduce((highest, item) => Math.max(highest, item.page), 0)
  return normalizePhoneHomeLayout({
    pageCount:Math.max(layout.pageCount, desired.page + 1, highestUsedPage + 1),
    items:placed,
  }, definitions)
}

export function setPhoneHomePageCount(candidate, definitions, pageCount) {
  const layout = normalizePhoneHomeLayout(candidate, definitions)
  const highestUsedPage = layout.items.reduce((highest, item) => Math.max(highest, item.page), 0)
  layout.pageCount = clamp(Math.max(integer(pageCount, 1), highestUsedPage + 1), 1, PHONE_HOME_MAX_PAGES)
  return layout
}

export function phoneHomeItemStyle(item) {
  return `--phone-home-left:${integer(item?.x) * PHONE_HOME_CELL_WIDTH}px;--phone-home-top:${integer(item?.y) * PHONE_HOME_CELL_HEIGHT}px;`
}
