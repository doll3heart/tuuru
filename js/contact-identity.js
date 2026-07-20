function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function contactDisplayName(contact, surface = "contacts", fallback = "") {
  if (!contact || typeof contact !== "object") return clean(fallback)

  const channelName = surface === "forum"
    ? clean(contact.forumId)
    : (surface === "messages" ? clean(contact.msgId) : "")

  return channelName || clean(contact.name) || clean(fallback)
}

export function resolveContactIdentity(phoneData, contactId, options = {}) {
  const contacts = Array.isArray(phoneData?.contacts) ? phoneData.contacts : []
  const contact = contacts.find(candidate => candidate && String(candidate.id) === String(contactId)) || null

  return {
    contact,
    name: contact
      ? contactDisplayName(contact, options.surface, options.authoredName)
      : clean(options.authoredName),
    avatar: contact
      ? clean(contact.avatarUrl) || clean(options.authoredAvatar)
      : clean(options.authoredAvatar),
  }
}
