// Layout still belongs to the rendered document. Only its scheduling clock may
// be supplied by a visible parent: WebKit suspends rAF in offscreen iframes.
export function waitForPhoneExportLayout(ownerDocument, signal, scheduler = ownerDocument?.defaultView) {
  return new Promise((resolve, reject) => {
    let first, second, settled = false
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      if (first !== undefined) scheduler?.cancelAnimationFrame?.(first)
      if (second !== undefined) scheduler?.cancelAnimationFrame?.(second)
      const error = new Error('已取消图片导出')
      error.name = 'AbortError'
      reject(error)
    }
    if (signal?.aborted) { abort(); return }
    const schedule = typeof scheduler?.requestAnimationFrame === 'function'
      ? scheduler.requestAnimationFrame.bind(scheduler)
      : callback => queueMicrotask(callback)
    signal?.addEventListener('abort', abort, { once:true })
    first = schedule(() => {
      if (settled) return
      second = schedule(() => {
        if (settled) return
        settled = true
        cleanup()
        resolve()
      })
    })
  })
}
