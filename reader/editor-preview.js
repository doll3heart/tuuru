import { inspectLocalDatabase } from '../js/storage.js'
import { prepareImportedWork } from '../js/work-import.js'

function previewFailure(code, message) {
  return { preview: true, ok: false, code, message }
}

export function prepareEditorPreview({
  search = globalThis.location?.search || globalThis.window?.location?.search || '',
  storage = globalThis.localStorage,
  windowObject = globalThis.window,
} = {}) {
  const params = new URLSearchParams(search)
  if (!params.has('preview')) return { preview: false, ok: true }

  const workId = String(params.get('preview') || '').trim()
  if (!workId) {
    return previewFailure('missing-preview-id', '找不到要预览的作品。请返回创作端重新打开。')
  }

  const database = inspectLocalDatabase(storage)
  if (!database.ok) {
    return previewFailure('invalid-author-database', '无法读取当前创作库。请返回创作端检查本地作品数据。')
  }

  const matchingWorks = database.data.works.filter(work => work.id === workId)
  if (matchingWorks.length !== 1) {
    return previewFailure('preview-work-not-found', '找不到要预览的作品。它可能已被删除。')
  }
  const sourceWork = matchingWorks[0]

  const prepared = prepareImportedWork(sourceWork, windowObject)
  if (!prepared.ok) {
    return previewFailure('invalid-preview-work', '当前作品格式无法在阅读器中打开。')
  }

  return { preview: true, ok: true, work: prepared.work }
}
