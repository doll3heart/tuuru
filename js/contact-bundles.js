export const CONTACT_BUNDLE_TYPE = "tuuru-contact-bundle"
export const CONTACT_BUNDLE_VERSION = 1

function defaultId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function sanitizeAccount(account) {
  const source = account && typeof account === "object" ? account : {}
  return {
    id: cleanText(source.id),
    name: cleanText(source.name),
    forumId: cleanText(source.forumId),
    avatarUrl: cleanText(source.avatarUrl),
    forumIpLocation: cleanText(source.forumIpLocation),
  }
}

function sanitizeContact(contact) {
  const source = contact && typeof contact === "object" ? contact : {}
  return {
    id: cleanText(source.id),
    name: cleanText(source.name) || "未命名",
    alias: cleanText(source.alias),
    aliases: Array.isArray(source.aliases)
      ? source.aliases.filter(account => account && typeof account === "object").map(sanitizeAccount)
      : [],
    avatarUrl: cleanText(source.avatarUrl),
    messageAvatarUrl: cleanText(source.messageAvatarUrl),
    forumAvatarUrl: cleanText(source.forumAvatarUrl),
    forumIpLocation: cleanText(source.forumIpLocation),
    pinned: source.pinned === true,
    note: cleanText(source.note),
    faceUrl: cleanText(source.faceUrl),
    msgId: cleanText(source.msgId),
    forumId: cleanText(source.forumId),
  }
}

function sanitizeContacts(contacts) {
  if (!Array.isArray(contacts)) return []
  return contacts.filter(contact => contact && typeof contact === "object").map(sanitizeContact)
}

function clone(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function nextUniqueId(usedIds, idFactory) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = cleanText(String(idFactory() ?? ""))
    if (candidate && !usedIds.has(candidate)) return candidate
  }
  const base = cleanText(String(defaultId())) || "imported"
  let suffix = 0
  let candidate = base
  while (usedIds.has(candidate)) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}

export function serializeContactBundle(contacts, options = {}) {
  const now = options.now ?? Date.now
  return JSON.stringify({
    type: CONTACT_BUNDLE_TYPE,
    version: CONTACT_BUNDLE_VERSION,
    exportedAt: Number(now()),
    contacts: sanitizeContacts(contacts),
  }, null, 2)
}

export function parseContactBundle(input) {
  let parsed
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input
  } catch {
    throw new Error("不是有效的 Tuuru 联系人包")
  }
  if (!parsed || parsed.type !== CONTACT_BUNDLE_TYPE || !Array.isArray(parsed.contacts)) {
    throw new Error("不是有效的 Tuuru 联系人包")
  }
  if (parsed.version !== CONTACT_BUNDLE_VERSION) {
    throw new Error(`不支持的联系人包版本：${String(parsed.version ?? "未知")}`)
  }
  return {
    type: CONTACT_BUNDLE_TYPE,
    version: CONTACT_BUNDLE_VERSION,
    exportedAt: Number.isFinite(Number(parsed.exportedAt)) ? Number(parsed.exportedAt) : 0,
    contacts: sanitizeContacts(parsed.contacts),
  }
}

export function mergeContactBundle(existingContacts, input, options = {}) {
  const idFactory = options.idFactory ?? defaultId
  const bundle = parseContactBundle(input)
  const contacts = Array.isArray(existingContacts) ? clone(existingContacts) : []
  const identityIds = new Set(contacts.flatMap(contact => [
    cleanText(contact?.id),
    ...(Array.isArray(contact?.aliases) ? contact.aliases.map(account => cleanText(account?.id)) : []),
  ]).filter(Boolean))
  let reassignedIds = 0

  for (const source of bundle.contacts) {
    const imported = clone(source)
    if (!imported.id || identityIds.has(imported.id)) {
      imported.id = nextUniqueId(identityIds, idFactory)
      reassignedIds += 1
    }
    identityIds.add(imported.id)
    imported.aliases = imported.aliases.map(account => {
      const next = { ...account }
      if (!next.id || identityIds.has(next.id)) {
        next.id = nextUniqueId(identityIds, idFactory)
        reassignedIds += 1
      }
      identityIds.add(next.id)
      return next
    })
    contacts.push(imported)
  }

  return {
    contacts,
    added: bundle.contacts.length,
    reassignedIds,
  }
}
