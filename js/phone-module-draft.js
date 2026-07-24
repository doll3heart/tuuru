const DRAFT_COLLECTIONS = [
  "contacts",
  "chats",
  "moments",
  "forumPosts",
  "forumNpcs",
  "memos",
  "photos",
  "albums",
  "browserHistory",
  "shoppingItems",
]

const MODULE_FIELDS = {
  messages: ["chats", "contacts"],
  forum: ["forumPosts", "forumNpcs", "contacts"],
  memo: ["memos", "contacts"],
  gallery: ["photos", "albums", "contacts"],
  browser: ["browserHistory", "contacts"],
  shopping: ["shoppingItems", "contacts"],
  contacts: ["contacts"],
}

const CONTENT_FIELDS = {
  messages: ["chats"],
  forum: ["forumPosts"],
  memo: ["memos"],
  gallery: ["photos", "albums"],
  browser: ["browserHistory"],
  shopping: ["shoppingItems"],
  contacts: ["contacts"],
}

const CONNECTION_TYPES = new Set(["memo", "gallery", "browser", "shopping"])

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function createPhoneModuleDraftData(work, moduleData) {
  const source = moduleData && typeof moduleData === "object" ? moduleData : {}
  const isExistingModule = moduleData && typeof moduleData === "object"
  const savedContacts = Array.isArray(source.contacts) ? source.contacts : []
  const draft = clone(source)

  const sharedContacts = work?.phoneData?.contacts
  if (Array.isArray(sharedContacts)) draft.contacts = clone(sharedContacts)
  else if (!Array.isArray(draft.contacts)) draft.contacts = []

  const currentContactIds = new Set(
    draft.contacts.map(contact => String(contact?.id ?? "")).filter(Boolean),
  )
  const initialVisibleIds = Array.isArray(source.visibleContactIds)
    ? source.visibleContactIds
    : (isExistingModule ? savedContacts : draft.contacts).map(contact => contact?.id)
  draft.visibleContactIds = Array.from(new Set(
    initialVisibleIds
      .map(id => String(id ?? ""))
      .filter(id => id && currentContactIds.has(id)),
  ))

  for (const field of DRAFT_COLLECTIONS) {
    if (!Array.isArray(draft[field])) draft[field] = []
  }
  const visibleIds = new Set(draft.visibleContactIds)
  referencedMessageContactIds(draft).forEach(id => {
    if (currentContactIds.has(id)) visibleIds.add(id)
  })
  draft.visibleContactIds = Array.from(visibleIds)
  if (!draft.skin || typeof draft.skin !== "object") draft.skin = {}
  if (!Array.isArray(draft.apps)) draft.apps = []

  return draft
}

export function pickPhoneModuleData(type, phoneData) {
  const source = phoneData && typeof phoneData === "object" ? phoneData : {}
  const fields = MODULE_FIELDS[type] || []
  const payload = {}

  for (const field of fields) {
    payload[field] = clone(Array.isArray(source[field]) ? source[field] : [])
  }

  if (type === "messages") {
    const fallbackIds = Array.isArray(source.contacts)
      ? source.contacts.map(contact => contact?.id)
      : []
    payload.visibleContactIds = Array.from(new Set(
      (Array.isArray(source.visibleContactIds) ? source.visibleContactIds : fallbackIds)
        .map(id => String(id ?? ""))
        .filter(Boolean),
    ))
  }

  const connection = CONNECTION_TYPES.has(type) ? source.appConnections?.[type] : null
  if (connection && typeof connection === "object") {
    payload.appConnections = { [type]: clone(connection) }
  }

  return payload
}

export function referencedMessageContactIds(phoneData) {
  const result = []
  const seen = new Set()

  function add(value) {
    const id = String(value ?? "")
    if (!id || id === "self" || seen.has(id)) return
    seen.add(id)
    result.push(id)
  }

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (key === "contactId" || key === "senderId" || key === "groupOwnerId") {
        add(child)
      } else if (key === "contactIds" || key === "groupAdminIds") {
        if (Array.isArray(child)) child.forEach(add)
      } else {
        visit(child)
      }
    }
  }

  visit(Array.isArray(phoneData?.chats) ? phoneData.chats : [])
  visit(Array.isArray(phoneData?.moments) ? phoneData.moments : [])
  return result
}

export function visiblePhoneModuleContacts(phoneData) {
  const contacts = Array.isArray(phoneData?.contacts) ? phoneData.contacts : []
  if (!Array.isArray(phoneData?.visibleContactIds)) return clone(contacts)
  const visibleIds = new Set(phoneData.visibleContactIds.map(id => String(id ?? "")))
  return clone(contacts.filter(contact => visibleIds.has(String(contact?.id ?? ""))))
}

export function hasPhoneModuleContent(type, data) {
  const fields = CONTENT_FIELDS[type] || []
  return fields.some(field => Array.isArray(data?.[field]) && data[field].length > 0)
}

export function createPhoneModuleCloseHandlers({
  type,
  draft,
  commit,
  commitEmpty = false,
  onSaved,
  onEmpty,
  onError,
}) {
  function reportError(error) {
    if (onError) onError(error)
  }

  function beforeClose() {
    const draftWork = draft.snapshot()
    if (!draftWork) {
      reportError(new Error("Phone module draft is unavailable"))
      return false
    }

    const data = pickPhoneModuleData(type, draftWork.phoneData)
    const isEmpty = !hasPhoneModuleContent(type, data)
    if (isEmpty && !commitEmpty) {
      draft.dispose()
      return { empty: true, savedModule: null }
    }

    let savedModule
    try {
      savedModule = commit(data)
    } catch (error) {
      reportError(error)
      return false
    }
    if (!savedModule) {
      reportError(new Error("Phone module commit failed"))
      return false
    }

    draft.dispose()
    return { empty: false, savedModule }
  }

  function afterClose(result) {
    if (result?.savedModule) {
      if (onSaved) onSaved(result.savedModule)
      return
    }
    if (result?.empty && onEmpty) onEmpty()
  }

  return { beforeClose, afterClose }
}
