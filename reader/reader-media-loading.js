const readerImageDecodeCache = new Map()

export function readerImageAttributes(options = {}) {
  const eager = options.eager === true
  return eager
    ? ' loading="eager" decoding="async" fetchpriority="high"'
    : ' loading="lazy" decoding="async" fetchpriority="low"'
}

export function predecodeReaderImage(url, ImageCtor = globalThis.Image) {
  const source = typeof url === "string" ? url.trim() : ""
  if (!source || typeof ImageCtor !== "function") return Promise.resolve(false)

  return new Promise(resolve => {
    let settled = false
    const image = new ImageCtor()
    const finish = value => {
      if (settled) return
      settled = true
      image.onload = null
      image.onerror = null
      resolve(value)
    }
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = source

    if (typeof image.decode === "function") {
      Promise.resolve()
        .then(() => image.decode())
        .then(() => finish(true))
        .catch(() => {
          if (image.complete) finish(Number(image.naturalWidth || 0) > 0)
        })
    }
  })
}

export function scheduleReaderImagePredecode(url, ImageCtor = globalThis.Image) {
  const source = typeof url === "string" ? url.trim() : ""
  if (!source) return Promise.resolve(false)
  if (!readerImageDecodeCache.has(source)) {
    readerImageDecodeCache.set(
      source,
      predecodeReaderImage(source, ImageCtor).catch(() => false),
    )
  }
  return readerImageDecodeCache.get(source)
}
