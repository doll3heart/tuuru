export const NPC_PACK_STORAGE_KEY = "tuuru_author_npc_packs"
export const NPC_PACK_TYPE = "tuuru-npc-pack"
export const NPC_PACK_LIBRARY_TYPE = "tuuru-npc-pack-library"
export const NPC_PACK_VERSION = 1

function defaultId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function clone(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function sanitizeNpc(npc) {
  const source = npc && typeof npc === "object" ? npc : {}
  return {
    id: cleanText(source.id),
    type: ["npc", "momo", "userxx"].includes(source.type) ? source.type : "npc",
    name: cleanText(source.name) || "未命名 NPC",
    avatarUrl: cleanText(source.avatarUrl),
    ipLocation: cleanText(source.ipLocation),
    time: cleanText(source.time),
  }
}

function sanitizeNpcs(npcs) {
  if (!Array.isArray(npcs)) return []
  return npcs.filter(npc => npc && typeof npc === "object").map(sanitizeNpc)
}

function sanitizePack(pack, options = {}) {
  const source = pack && typeof pack === "object" ? pack : {}
  const now = Number(options.now ?? Date.now())
  const createdAt = Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : now
  const updatedAt = Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : createdAt
  return {
    id: cleanText(source.id),
    name: cleanText(source.name),
    sourceWorkTitle: cleanText(source.sourceWorkTitle),
    createdAt,
    updatedAt,
    npcs: sanitizeNpcs(source.npcs),
  }
}

function requirePack(pack, options = {}) {
  const clean = sanitizePack(pack, options)
  if (!clean.name || !Array.isArray(pack?.npcs)) throw new Error("不是有效的 Tuuru NPC 包")
  return clean
}

function storageOrDefault(storage) {
  return storage ?? globalThis.localStorage
}

function writeNpcPacks(packs, storage) {
  const target = storageOrDefault(storage)
  if (!target?.setItem) return false
  target.setItem(NPC_PACK_STORAGE_KEY, JSON.stringify({
    version:NPC_PACK_VERSION,
    packs:packs.map(pack => sanitizePack(pack)),
  }))
  return true
}

function nextUniqueId(usedIds, idFactory) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = cleanText(String(idFactory() ?? ""))
    if (candidate && !usedIds.has(candidate)) return candidate
  }
  let candidate = cleanText(String(defaultId())) || "imported"
  let suffix = 0
  while (usedIds.has(candidate)) {
    suffix += 1
    candidate = `${candidate}-${suffix}`
  }
  return candidate
}

export function readNpcPacks(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storageOrDefault(storage)?.getItem?.(NPC_PACK_STORAGE_KEY) || "null")
    if (!parsed || parsed.version !== NPC_PACK_VERSION || !Array.isArray(parsed.packs)) return []
    return parsed.packs.map(pack => sanitizePack(pack)).filter(pack => pack.id && pack.name)
  } catch {
    return []
  }
}

export function saveNpcPack(pack, options = {}) {
  const storage = storageOrDefault(options.storage)
  const idFactory = options.idFactory ?? defaultId
  const now = Number((options.now ?? Date.now)())
  const clean = requirePack(pack, { now })
  const packs = readNpcPacks(storage)
  const matchIndex = packs.findIndex(candidate =>
    (clean.id && candidate.id === clean.id)
    || candidate.name.toLocaleLowerCase() === clean.name.toLocaleLowerCase())
  const existing = matchIndex >= 0 ? packs[matchIndex] : null
  const next = {
    ...clean,
    id:existing?.id || clean.id || String(idFactory()),
    createdAt:existing?.createdAt || now,
    updatedAt:now,
  }
  if (matchIndex >= 0) packs.splice(matchIndex, 1, next)
  else packs.push(next)
  writeNpcPacks(packs, storage)
  return clone(next)
}

export function deleteNpcPack(id, storage = globalThis.localStorage) {
  const packs = readNpcPacks(storage)
  const next = packs.filter(pack => pack.id !== String(id))
  if (next.length === packs.length) return false
  writeNpcPacks(next, storage)
  return true
}

export function serializeNpcPack(pack, options = {}) {
  const now = options.now ?? Date.now
  const exportedAt = Number(now())
  const clean = requirePack(pack, { now:exportedAt })
  return JSON.stringify({
    type:NPC_PACK_TYPE,
    version:NPC_PACK_VERSION,
    exportedAt,
    ...clean,
  }, null, 2)
}

export function parseNpcPack(input) {
  let parsed
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input
  } catch {
    throw new Error("不是有效的 Tuuru NPC 包")
  }
  if (!parsed || parsed.type !== NPC_PACK_TYPE || parsed.version !== NPC_PACK_VERSION || !Array.isArray(parsed.npcs)) {
    throw new Error("不是有效的 Tuuru NPC 包")
  }
  return {
    ...requirePack(parsed),
    exportedAt:Number.isFinite(Number(parsed.exportedAt)) ? Number(parsed.exportedAt) : 0,
  }
}

export function serializeNpcPackLibrary(packs, options = {}) {
  const now = options.now ?? Date.now
  const exportedAt = Number(now())
  return JSON.stringify({
    type:NPC_PACK_LIBRARY_TYPE,
    version:NPC_PACK_VERSION,
    exportedAt,
    packs:(Array.isArray(packs) ? packs : []).map(pack => requirePack(pack, { now:exportedAt })),
  }, null, 2)
}

function parseNpcPackLibrary(input) {
  let parsed
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input
  } catch {
    throw new Error("不是有效的 Tuuru NPC 包合集")
  }
  if (!parsed || parsed.type !== NPC_PACK_LIBRARY_TYPE || parsed.version !== NPC_PACK_VERSION || !Array.isArray(parsed.packs)) {
    throw new Error("不是有效的 Tuuru NPC 包合集")
  }
  return parsed.packs.map(pack => requirePack(pack))
}

export function importNpcPackLibrary(input, options = {}) {
  const storage = storageOrDefault(options.storage)
  const idFactory = options.idFactory ?? defaultId
  const now = options.now ?? Date.now
  const incoming = parseNpcPackLibrary(input)
  const packs = readNpcPacks(storage)
  let added = 0
  let updated = 0
  for (const pack of incoming) {
    const index = packs.findIndex(candidate =>
      candidate.name.toLocaleLowerCase() === pack.name.toLocaleLowerCase())
    if (index >= 0) {
      packs[index] = {
        ...pack,
        id:packs[index].id,
        createdAt:packs[index].createdAt,
        updatedAt:Number(now()),
      }
      updated += 1
    } else {
      packs.push({
        ...pack,
        id:String(idFactory()),
        createdAt:Number(now()),
        updatedAt:Number(now()),
      })
      added += 1
    }
  }
  writeNpcPacks(packs, storage)
  return { packs:clone(packs), added, updated }
}

export function mergeNpcPack(existingNpcs, input, options = {}) {
  const pack = input?.type === NPC_PACK_TYPE ? parseNpcPack(input) : requirePack(input)
  const idFactory = options.idFactory ?? defaultId
  const npcs = Array.isArray(existingNpcs) ? clone(existingNpcs) : []
  const usedIds = new Set(npcs.map(npc => cleanText(npc?.id)).filter(Boolean))
  let reassignedIds = 0
  for (const source of pack.npcs) {
    const imported = clone(source)
    if (!imported.id || usedIds.has(imported.id)) {
      imported.id = nextUniqueId(usedIds, idFactory)
      reassignedIds += 1
    }
    usedIds.add(imported.id)
    npcs.push(imported)
  }
  return { npcs, added:pack.npcs.length, reassignedIds }
}
