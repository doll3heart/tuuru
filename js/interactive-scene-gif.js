function bytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return new Uint8Array()
}

function skipSubBlocks(data, start) {
  let offset = start
  while (offset < data.length) {
    const size = data[offset]
    offset += 1
    if (size === 0) return offset
    offset += size
  }
  return data.length
}

export function gifDurationMs(value) {
  const data = bytes(value)
  if (data.length < 13) return 0
  const signature = String.fromCharCode(...data.slice(0, 6))
  if (signature !== "GIF87a" && signature !== "GIF89a") return 0

  let offset = 13
  if (data[10] & 0x80) offset += 3 * (2 ** ((data[10] & 0x07) + 1))
  let pendingDelay = 10
  let total = 0
  let frameCount = 0

  while (offset < data.length) {
    const marker = data[offset]
    if (marker === 0x3b) break
    if (marker === 0x21) {
      const label = data[offset + 1]
      if (label === 0xf9 && data[offset + 2] === 0x04 && offset + 7 < data.length) {
        pendingDelay = data[offset + 4] | (data[offset + 5] << 8)
        offset += 8
      } else {
        offset = skipSubBlocks(data, offset + 2)
      }
      continue
    }
    if (marker === 0x2c) {
      if (offset + 9 >= data.length) break
      const packed = data[offset + 9]
      offset += 10
      if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1))
      offset += 1
      offset = skipSubBlocks(data, offset)
      total += Math.max(2, pendingDelay) * 10
      pendingDelay = 10
      frameCount += 1
      continue
    }
    break
  }

  return frameCount > 1 ? Math.min(total, 120000) : 0
}

export function isGifMedia(source, fileName = "") {
  const value = `${String(source || "").trim()}\n${String(fileName || "").trim()}`
  return /^data:image\/gif;base64,/i.test(String(source || "").trim())
    || /\.gif(?:$|[?#])/i.test(value)
}
