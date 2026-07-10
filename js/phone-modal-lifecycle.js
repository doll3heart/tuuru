export function createPhoneModalCloseController({
  beforeClose,
  remove,
  afterClose,
}) {
  let closed = false

  return function close(reason) {
    if (closed) return false

    const result = beforeClose ? beforeClose(reason) : undefined
    if (result === false) return false

    closed = true
    remove()
    if (afterClose) afterClose(result, reason)
    return true
  }
}
