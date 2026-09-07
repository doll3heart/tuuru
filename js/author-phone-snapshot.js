import { inspectLocalDatabase } from './storage.js'

const sessions = new WeakMap()
export class AuthorPhoneContextError extends Error {
  constructor(message = '作品已改变或不在当前创作库中，请关闭后重新导出。') {
    super(message)
    this.name = 'AuthorPhoneContextError'
  }
}

function readCanonical(workId, storage) {
  let database
  try { database = inspectLocalDatabase(storage) } catch { throw new AuthorPhoneContextError() }
  if (!database.ok) throw new AuthorPhoneContextError('作品数据无效，无法导出。')
  // Use raw canonical JSON for the token: normalization must not hide edits.
  let raw
  try { raw = JSON.parse(database.raw) } catch { throw new AuthorPhoneContextError() }
  const matches = raw?.works?.filter(work => work?.id === workId) || []
  if (matches.length !== 1) throw new AuthorPhoneContextError()
  const work = database.data.works.find(work => work.id === workId)
  if (!work?.phoneData || typeof work.phoneData !== 'object' || Array.isArray(work.phoneData)) {
    throw new AuthorPhoneContextError('当前作品没有可导出的小手机内容。')
  }
  return {work, token:JSON.stringify(matches[0])}
}

export function readAuthorPhoneExportSnapshot(workId, {storage = globalThis.localStorage} = {}) {
  if (typeof workId !== 'string' || !workId.trim()) throw new AuthorPhoneContextError()
  const initial = readCanonical(workId, storage)
  const assertCurrent = () => {
    if (readCanonical(workId, storage).token !== initial.token) throw new AuthorPhoneContextError()
  }
  const snapshot = Object.freeze({work:JSON.parse(JSON.stringify(initial.work)),token:initial.token,assertCurrent})
  sessions.set(snapshot, {assertCurrent, work:JSON.parse(JSON.stringify(initial.work))})
  return snapshot
}

export function assertAuthorPhoneExportSnapshot(snapshot) {
  const session = sessions.get(snapshot)
  if (!session) throw new AuthorPhoneContextError('作品导出需要有效的创作库上下文。')
  session.assertCurrent()
  return Object.freeze({assertCurrent:session.assertCurrent})
}

export function authorPhoneExportWork(snapshot) {
  assertAuthorPhoneExportSnapshot(snapshot)
  return JSON.parse(JSON.stringify(sessions.get(snapshot).work))
}
