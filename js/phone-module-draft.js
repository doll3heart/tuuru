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
  forum: ["forumPosts"],
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
  const draft = clone(source)

  if (!Array.isArray(draft.contacts)) {
    const sharedContacts = work?.phoneData?.contacts
    draft.contacts = Array.isArray(sharedContacts) ? clone(sharedContacts) : []
  }

  for (const field of DRAFT_COLLECTIONS) {
    if (!Array.isArray(draft[field])) draft[field] = []
  }
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

  const connection = CONNECTION_TYPES.has(type) ? source.appConnections?.[type] : null
  if (connection && typeof connection === "object") {
    payload.appConnections = { [type]: clone(connection) }
  }

  return payload
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
