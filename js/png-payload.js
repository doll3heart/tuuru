import { MAX_STEGANO_PAYLOAD_BYTES, assertSteganoPayloadSize } from "./stegano.js"

export const MAX_WORK_PNG_FILE_BYTES = 25 * 1024 * 1024

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const PAYLOAD_CHUNK_TYPE = new Uint8Array([116, 117, 85, 114]) // tuUr
const IEND_CHUNK_TYPE = new Uint8Array([73, 69, 78, 68])

let crcTable = null

function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    crcTable[index] = value >>> 0
  }
  return crcTable
}

function crc32(parts) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      crc = table[(crc ^ part[index]) & 0xff] ^ (crc >>> 8)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  ) >>> 0
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function bytesEqual(bytes, offset, expected) {
  if (offset < 0 || offset + expected.length > bytes.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected[index]) return false
  }
  return true
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  throw new TypeError("PNG 数据无效")
}

function findIendOffset(bytes) {
  if (!bytesEqual(bytes, 0, PNG_SIGNATURE)) return -1
  let offset = PNG_SIGNATURE.length
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const chunkEnd = offset + 12 + length
    if (chunkEnd > bytes.length) return -1
    if (bytesEqual(bytes, offset + 4, IEND_CHUNK_TYPE) && length === 0) {
      return chunkEnd === bytes.length ? offset : -1
    }
    offset = chunkEnd
  }
  return -1
}

export function embedPngPayload(pngBytes, payloadBytes) {
  const source = asBytes(pngBytes)
  const payload = asBytes(payloadBytes)
  assertSteganoPayloadSize(payload.length)

  const iendOffset = findIendOffset(source)
  if (iendOffset < 0) throw new TypeError("PNG 文件结构无效")

  const chunk = new Uint8Array(payload.length + 12)
  writeUint32(chunk, 0, payload.length)
  chunk.set(PAYLOAD_CHUNK_TYPE, 4)
  chunk.set(payload, 8)
  writeUint32(chunk, payload.length + 8, crc32([PAYLOAD_CHUNK_TYPE, payload]))

  const encoded = new Uint8Array(source.length + chunk.length)
  encoded.set(source.slice(0, iendOffset), 0)
  encoded.set(chunk, iendOffset)
  encoded.set(source.slice(iendOffset), iendOffset + chunk.length)
  return encoded
}

export function readPngPayload(pngBytes) {
  let bytes
  try {
    bytes = asBytes(pngBytes)
  } catch {
    return null
  }
  if (!bytesEqual(bytes, 0, PNG_SIGNATURE)) return null

  let offset = PNG_SIGNATURE.length
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const dataOffset = offset + 8
    const crcOffset = dataOffset + length
    const chunkEnd = crcOffset + 4
    if (chunkEnd > bytes.length) return null

    if (bytesEqual(bytes, offset + 4, PAYLOAD_CHUNK_TYPE)) {
      if (length <= 0 || length > MAX_STEGANO_PAYLOAD_BYTES) return null
      const payload = bytes.slice(dataOffset, crcOffset)
      const expectedCrc = readUint32(bytes, crcOffset)
      if (crc32([PAYLOAD_CHUNK_TYPE, payload]) !== expectedCrc) return null
      return payload
    }
    if (bytesEqual(bytes, offset + 4, IEND_CHUNK_TYPE)) return null
    offset = chunkEnd
  }
  return null
}

export function pngBytesFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/png;base64,([a-z0-9+/=]+)$/i)
  if (!match || typeof globalThis.atob !== "function") throw new TypeError("PNG 数据链接无效")
  const binary = globalThis.atob(match[1])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function pngBytesToDataUrl(pngBytes) {
  const bytes = asBytes(pngBytes)
  if (typeof globalThis.btoa !== "function") throw new TypeError("当前环境无法生成 PNG 数据链接")
  const parts = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }
  return `data:image/png;base64,${globalThis.btoa(parts.join(""))}`
}
