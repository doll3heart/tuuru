function keyedMap(entries = []) {
  return new Map([...entries].map(([key, value]) => [String(key), value]))
}

export function createKeyedStorage(initialEntries = [], options = {}) {
  const entries = new Map([...initialEntries].map(([key, value]) => [String(key), String(value)]))
  const getErrors = keyedMap(options.getErrors)
  const setErrors = keyedMap(options.setErrors)
  const removeErrors = keyedMap(options.removeErrors)
  const getSequences = new Map(
    [...(options.getSequences ?? [])].map(([key, values]) => [String(key), [...values]]),
  )
  const calls = []

  const controls = Object.freeze({
    set(key, value) {
      entries.set(String(key), String(value))
    },
    remove(key) {
      entries.delete(String(key))
    },
  })

  function record(method, key, value) {
    calls.push({ method, key, value })
  }

  const storage = {
    calls,

    getItem(key) {
      const normalizedKey = String(key)
      if (getErrors.has(normalizedKey)) {
        record("getItem", normalizedKey, undefined)
        throw getErrors.get(normalizedKey)
      }

      const sequence = getSequences.get(normalizedKey)
      let value
      if (sequence?.length > 0) {
        value = sequence.shift()
        if (value instanceof Error) {
          record("getItem", normalizedKey, undefined)
          throw value
        }
        value = value === null ? null : String(value)
      } else {
        value = entries.has(normalizedKey) ? entries.get(normalizedKey) : null
      }
      record("getItem", normalizedKey, value)
      return value
    },

    setItem(key, value) {
      const normalizedKey = String(key)
      const normalizedValue = String(value)
      record("setItem", normalizedKey, normalizedValue)
      if (setErrors.has(normalizedKey)) throw setErrors.get(normalizedKey)
      entries.set(normalizedKey, normalizedValue)
      options.afterSet?.(normalizedKey, normalizedValue, controls)
    },

    removeItem(key) {
      const normalizedKey = String(key)
      record("removeItem", normalizedKey, null)
      if (removeErrors.has(normalizedKey)) throw removeErrors.get(normalizedKey)
      entries.delete(normalizedKey)
    },

    clear() {
      record("clear", null, null)
      if (options.clearError) throw options.clearError
      entries.clear()
    },

    key(index) {
      const numericIndex = Number(index)
      if (options.keyErrors?.has(numericIndex)) {
        record("key", numericIndex, undefined)
        throw options.keyErrors.get(numericIndex)
      }
      if (options.keyError) {
        record("key", numericIndex, undefined)
        throw options.keyError
      }
      const value = Number.isInteger(numericIndex) && numericIndex >= 0
        ? [...entries.keys()][numericIndex] ?? null
        : null
      record("key", numericIndex, value)
      return value
    },

    get length() {
      if (options.lengthError) {
        record("length", null, undefined)
        throw options.lengthError
      }
      const value = entries.size
      record("length", null, value)
      return value
    },

    snapshot() {
      return new Map(entries)
    },

    peek(key) {
      const normalizedKey = String(key)
      return entries.has(normalizedKey) ? entries.get(normalizedKey) : null
    },

    count(method, key) {
      const hasKey = arguments.length >= 2
      const normalizedKey = hasKey && ["getItem", "setItem", "removeItem"].includes(method)
        ? String(key)
        : key
      return calls.filter(call => call.method === method && (!hasKey || call.key === normalizedKey)).length
    },
  }

  return storage
}
