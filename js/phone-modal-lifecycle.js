export function createPhoneModalCloseController({
  beforeClose,
  remove,
  afterClose,
}) {
  let state = "open"

  return function close(reason) {
    if (state !== "open") return false
    state = "closing"

    let result
    try {
      result = beforeClose ? beforeClose(reason) : undefined
    } catch (error) {
      state = "open"
      throw error
    }
    if (result === false) {
      state = "open"
      return false
    }

    state = "closed"
    remove()
    if (afterClose) afterClose(result, reason)
    return true
  }
}
