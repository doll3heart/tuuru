export const MAX_STEGANO_PAYLOAD_BYTES = 10 * 1024 * 1024

function rgbChannelIndex(byteIndex) {
  return Math.floor(byteIndex / 3) * 4 + (byteIndex % 3)
}

function rgbByteCapacity(pixels) {
  if (!pixels || !Number.isSafeInteger(pixels.length) || pixels.length < 0) return 0
  return Math.floor(pixels.length / 4) * 3
}

export function assertSteganoPayloadSize(dataLength) {
  if (!Number.isSafeInteger(dataLength) || dataLength < 0 || dataLength > 0xffffffff) {
    throw new TypeError('Invalid stegano payload')
  }
  if (dataLength === 0) throw new RangeError('Stegano payload is empty')
  if (dataLength > MAX_STEGANO_PAYLOAD_BYTES) {
    throw new RangeError('PNG 隐写数据超过 10 MB 上限，请精简作品内容后重试')
  }
  return dataLength
}

export function writeSteganoPayload(pixels, payload) {
  var dataLength = assertSteganoPayloadSize(payload && payload.length)

  var capacity = rgbByteCapacity(pixels)
  if (dataLength + 4 > capacity) throw new RangeError('Stegano payload exceeds pixel capacity')

  var header = [
    (dataLength >>> 24) & 0xff,
    (dataLength >>> 16) & 0xff,
    (dataLength >>> 8) & 0xff,
    dataLength & 0xff,
  ]
  for (var headerIndex = 0; headerIndex < header.length; headerIndex++) {
    pixels[rgbChannelIndex(headerIndex)] = header[headerIndex]
  }
  for (var payloadIndex = 0; payloadIndex < dataLength; payloadIndex++) {
    pixels[rgbChannelIndex(payloadIndex + 4)] = payload[payloadIndex]
  }
  return pixels
}

export function readSteganoPayload(pixels) {
  var capacity = rgbByteCapacity(pixels)
  if (capacity < 4) return null

  var dataLength = 0
  for (var headerIndex = 0; headerIndex < 4; headerIndex++) {
    dataLength = dataLength * 256 + pixels[rgbChannelIndex(headerIndex)]
  }
  if (
    dataLength <= 0 ||
    dataLength > MAX_STEGANO_PAYLOAD_BYTES ||
    dataLength > capacity - 4
  ) {
    return null
  }

  var payload = new Uint8Array(dataLength)
  for (var payloadIndex = 0; payloadIndex < dataLength; payloadIndex++) {
    payload[payloadIndex] = pixels[rgbChannelIndex(payloadIndex + 4)]
  }
  return payload
}
