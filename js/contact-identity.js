function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function contactAvatar(contact, surface = "contacts") {
  if (!contact || typeof contact !== "object") return ""
  if (surface === "messages") return clean(contact.messageAvatarUrl) || clean(contact.avatarUrl)
  if (surface === "forum") return clean(contact.forumAvatarUrl) || clean(contact.avatarUrl)
  return clean(contact.avatarUrl)
}

export function contactDisplayName(contact, surface = "contacts", fallback = "") {
  if (!contact || typeof contact !== "object") return clean(fallback)

  const channelName = surface === "forum"
    ? clean(contact.forumId)
    : (surface === "messages" ? clean(contact.msgId) : "")

  return channelName || clean(contact.name) || clean(fallback)
}

export function listForumIdentities(phoneData) {
  const contacts = Array.isArray(phoneData?.contacts) ? phoneData.contacts : []
  const identities = []
  contacts.forEach(contact => {
    if (!contact || typeof contact !== "object" || contact.id == null) return
    identities.push({
      contactId: String(contact.id),
      aliasId: "",
      name: contactDisplayName(contact, "forum", "未命名联系人"),
      avatar: contactAvatar(contact, "forum"),
      ipLocation: clean(contact.forumIpLocation),
      parentName: clean(contact.name),
    })
    const aliases = Array.isArray(contact.aliases) ? contact.aliases : []
    aliases.forEach(alias => {
      if (!alias || typeof alias !== "object" || alias.id == null) return
      identities.push({
        contactId: String(contact.id),
        aliasId: String(alias.id),
        name: clean(alias.forumId) || clean(alias.name) || contactDisplayName(contact, "forum", "未命名小号"),
        avatar: clean(alias.avatarUrl) || contactAvatar(contact, "forum"),
        ipLocation: clean(alias.forumIpLocation) || clean(contact.forumIpLocation),
        parentName: clean(contact.name),
      })
    })
  })
  return identities
}

export function resolveContactIdentity(phoneData, contactId, options = {}) {
  const contacts = Array.isArray(phoneData?.contacts) ? phoneData.contacts : []
  const contact = contacts.find(candidate => candidate && String(candidate.id) === String(contactId)) || null
  const npcs = Array.isArray(phoneData?.forumNpcs) ? phoneData.forumNpcs : []
  const npc = !contact && options.surface === "forum"
    ? npcs.find(candidate => candidate && String(candidate.id) === String(contactId)) || null
    : null
  const aliasId = clean(options.aliasId)
  const alias = contact && aliasId
    ? (Array.isArray(contact.aliases) ? contact.aliases : []).find(candidate => candidate && String(candidate.id) === aliasId) || null
    : null

  const result = {
    contact,
    name: alias
      ? clean(alias.forumId) || clean(alias.name) || clean(options.authoredName)
      : contact
      ? contactDisplayName(contact, options.surface, options.authoredName)
      : npc
      ? clean(npc.name) || clean(options.authoredName)
      : clean(options.authoredName),
    avatar: alias
      ? clean(alias.avatarUrl) || contactAvatar(contact, "forum") || clean(options.authoredAvatar)
      : contact
      ? contactAvatar(contact, options.surface) || clean(options.authoredAvatar)
      : npc
      ? clean(npc.avatarUrl) || clean(options.authoredAvatar)
      : clean(options.authoredAvatar),
    ipLocation: alias
      ? clean(alias.forumIpLocation) || clean(contact.forumIpLocation) || clean(options.authoredIpLocation)
      : contact
      ? clean(contact.forumIpLocation) || clean(options.authoredIpLocation)
      : npc
      ? clean(npc.ipLocation) || clean(options.authoredIpLocation)
      : clean(options.authoredIpLocation),
  }
  if (npc) result.npc = npc
  return result
}
