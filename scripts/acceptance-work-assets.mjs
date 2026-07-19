import { deflateSync, inflateSync } from "node:zlib"

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const STEGANO_MAX_BYTES = 10 * 1024 * 1024

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii")
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function hashSeed(seed) {
  let hash = 2166136261
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rgb(hex) {
  const value = hex.replace("#", "")
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function setPixel(rgba, width, height, x, y, color, alpha = 255) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= width || py >= height) return
  const offset = (py * width + px) * 4
  rgba[offset] = color[0]
  rgba[offset + 1] = color[1]
  rgba[offset + 2] = color[2]
  rgba[offset + 3] = alpha
}

function fillRect(rgba, width, height, x, y, rectWidth, rectHeight, color, alpha = 255) {
  const left = Math.max(0, Math.floor(x))
  const top = Math.max(0, Math.floor(y))
  const right = Math.min(width, Math.ceil(x + rectWidth))
  const bottom = Math.min(height, Math.ceil(y + rectHeight))
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) setPixel(rgba, width, height, px, py, color, alpha)
  }
}

function fillCircle(rgba, width, height, cx, cy, radius, color, alpha = 255) {
  const radiusSquared = radius * radius
  for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px += 1) {
      const dx = px - cx
      const dy = py - cy
      if ((dx * dx) + (dy * dy) <= radiusSquared) setPixel(rgba, width, height, px, py, color, alpha)
    }
  }
}

function fillGradient(rgba, width, height, start, end) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mix = Math.min(1, Math.max(0, (x / width * 0.35) + (y / height * 0.65)))
      const color = start.map((channel, index) => Math.round(channel + ((end[index] - channel) * mix)))
      setPixel(rgba, width, height, x, y, color)
    }
  }
}

function drawLandscape(rgba, width, height, seed) {
  const palettes = [
    ["#f3d9d4", "#8ca6b4", "#34495a", "#f7c77f"],
    ["#c7d8ea", "#6e7692", "#30384b", "#f5df9d"],
    ["#f1d5c8", "#8d9e8c", "#465d56", "#f7a98b"],
    ["#ded7ef", "#7886aa", "#313852", "#f1c6a8"],
  ]
  const palette = palettes[seed % palettes.length].map(rgb)
  fillGradient(rgba, width, height, palette[0], palette[1])
  fillCircle(rgba, width, height, width * (0.22 + ((seed % 31) / 100)), height * 0.26, Math.max(7, width * 0.07), palette[3])

  const horizon = Math.floor(height * 0.6)
  for (let x = 0; x < width; x += 1) {
    const wave = Math.sin((x + (seed % 47)) / Math.max(12, width / 7)) * height * 0.06
    const ridge = horizon + wave
    for (let y = Math.floor(ridge); y < height; y += 1) {
      const color = y > height * 0.78 ? palette[2] : palette[1]
      setPixel(rgba, width, height, x, y, color)
    }
  }

  const buildingCount = 7
  for (let index = 0; index < buildingCount; index += 1) {
    const buildingWidth = Math.max(5, Math.floor(width / (buildingCount * 1.45)))
    const x = Math.floor((index + 0.35) * width / buildingCount)
    const buildingHeight = Math.floor(height * (0.11 + (((seed >>> index) & 7) / 45)))
    fillRect(rgba, width, height, x, height - buildingHeight, buildingWidth, buildingHeight, palette[2])
    fillRect(rgba, width, height, x + 2, height - buildingHeight + 4, 2, 2, palette[3])
  }
}

function drawPortrait(rgba, width, height, seed) {
  const palettes = [
    ["#d9b8b0", "#7d5962", "#f3d6bd", "#39404f"],
    ["#b8ccd7", "#4e6876", "#e7c5ad", "#323f49"],
    ["#c9c1de", "#66587c", "#f1d0b4", "#3d354b"],
  ]
  const palette = palettes[seed % palettes.length].map(rgb)
  fillGradient(rgba, width, height, palette[0], palette[1])
  const cx = width / 2
  const faceRadius = Math.min(width, height) * 0.22
  fillCircle(rgba, width, height, cx, height * 0.39, faceRadius * 1.08, palette[3])
  fillCircle(rgba, width, height, cx, height * 0.43, faceRadius, palette[2])
  fillCircle(rgba, width, height, cx - faceRadius * 0.38, height * 0.4, Math.max(1, faceRadius * 0.07), palette[3])
  fillCircle(rgba, width, height, cx + faceRadius * 0.38, height * 0.4, Math.max(1, faceRadius * 0.07), palette[3])
  fillRect(rgba, width, height, width * 0.2, height * 0.68, width * 0.6, height * 0.32, palette[3])
  fillCircle(rgba, width, height, cx, height * 0.77, width * 0.3, palette[3])
}

function drawProduct(rgba, width, height, seed) {
  const palettes = [
    ["#f3eee5", "#ddd0bd", "#9c6870", "#3f4b5b"],
    ["#e8eef0", "#c8d6d9", "#5f7889", "#c27b68"],
    ["#eee8f2", "#d5c8de", "#79618a", "#4f6570"],
  ]
  const palette = palettes[seed % palettes.length].map(rgb)
  fillGradient(rgba, width, height, palette[0], palette[1])
  const cell = Math.max(8, Math.floor(Math.min(width, height) / 8))
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) fillRect(rgba, width, height, x, y, cell, cell, palette[0], 255)
    }
  }
  fillRect(rgba, width, height, width * 0.24, height * 0.18, width * 0.52, height * 0.65, palette[3])
  fillRect(rgba, width, height, width * 0.29, height * 0.23, width * 0.42, height * 0.55, palette[0])
  fillCircle(rgba, width, height, width * 0.5, height * 0.48, Math.min(width, height) * 0.15, palette[2])
}

function drawWallpaper(rgba, width, height, seed) {
  const palettes = [
    ["#27364a", "#798e9c", "#f2c8a8"],
    ["#433a59", "#9a7892", "#f0d8b4"],
    ["#2f4b4a", "#779183", "#f3c38f"],
  ]
  const palette = palettes[seed % palettes.length].map(rgb)
  fillGradient(rgba, width, height, palette[0], palette[1])
  const orbitCount = 5
  for (let orbit = 0; orbit < orbitCount; orbit += 1) {
    const cx = width * (0.18 + (((seed >>> orbit) & 15) / 24))
    const cy = height * (0.14 + (((seed >>> (orbit + 3)) & 15) / 22))
    const radius = Math.max(2, Math.min(width, height) * (0.012 + orbit * 0.004))
    fillCircle(rgba, width, height, cx, cy, radius, palette[2])
  }
  for (let stripe = -height; stripe < width; stripe += Math.max(22, Math.floor(width / 9))) {
    for (let offset = 0; offset < 2; offset += 1) {
      for (let y = 0; y < height; y += 1) setPixel(rgba, width, height, stripe + y + offset, y, palette[2], 255)
    }
  }
}

function drawSeal(rgba, width, height) {
  rgba.fill(0)
  const ink = rgb("#7a3346")
  const cx = width / 2
  const cy = height / 2
  const outer = Math.min(width, height) * 0.42
  const inner = outer * 0.72
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - cx, y - cy)
      const diamond = Math.abs(x - cx) + Math.abs(y - cy)
      if ((distance > outer - 3 && distance < outer) || (distance > inner - 2 && distance < inner + 1)) {
        setPixel(rgba, width, height, x, y, ink, 255)
      } else if (diamond < inner * 0.82 && Math.abs(x - cx) < 4) {
        setPixel(rgba, width, height, x, y, ink, 235)
      } else if (diamond < inner * 0.82 && Math.abs(y - cy) < 4) {
        setPixel(rgba, width, height, x, y, ink, 235)
      }
    }
  }
}

export function createIllustrationRgba(seed, { width = 240, height = 150, kind = "landscape" } = {}) {
  const rgba = new Uint8Array(width * height * 4)
  const hashedSeed = hashSeed(seed)
  if (kind === "portrait") drawPortrait(rgba, width, height, hashedSeed)
  else if (kind === "product") drawProduct(rgba, width, height, hashedSeed)
  else if (kind === "wallpaper") drawWallpaper(rgba, width, height, hashedSeed)
  else if (kind === "seal") drawSeal(rgba, width, height)
  else drawLandscape(rgba, width, height, hashedSeed)
  return rgba
}

export function encodeRgbaPng(width, height, rgba) {
  if (!(rgba instanceof Uint8Array) || rgba.length !== width * height * 4) {
    throw new TypeError("RGBA buffer size does not match PNG dimensions")
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const rows = Buffer.alloc(height * ((width * 4) + 1))
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * ((width * 4) + 1)
    rows[rowOffset] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + (y * width * 4), width * 4).copy(rows, rowOffset + 1)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows, { level: 9 })),
    pngChunk("IEND"),
  ])
}

export function createIllustrationDataUrl(seed, options = {}) {
  const width = options.width ?? 240
  const height = options.height ?? 150
  const rgba = createIllustrationRgba(seed, { ...options, width, height })
  return `data:image/png;base64,${encodeRgbaPng(width, height, rgba).toString("base64")}`
}

export function decodeRgbaPng(pngBuffer) {
  const buffer = Buffer.from(pngBuffer)
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Invalid PNG signature")
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString("ascii", offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6) throw new Error("Only 8-bit RGBA PNGs are supported")
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const rowLength = (width * 4) + 1
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength
    if (raw[rowOffset] !== 0) throw new Error("Only unfiltered fixture PNGs are supported")
    rgba.set(raw.subarray(rowOffset + 1, rowOffset + rowLength), y * width * 4)
  }
  return { width, height, rgba }
}

function rgbByteOffset(byteIndex) {
  const pixelIndex = Math.floor(byteIndex / 3)
  return (pixelIndex * 4) + (byteIndex % 3)
}

export function encodeSteganoPngBuffer(jsonText, seed = "tuuru-acceptance") {
  const payload = new TextEncoder().encode(jsonText)
  if (payload.length > STEGANO_MAX_BYTES) throw new RangeError("Steganographic payload exceeds 10 MiB")
  const totalBytes = payload.length + 4
  const pixelCount = Math.ceil(totalBytes / 3)
  const size = Math.max(240, Math.ceil(Math.sqrt(pixelCount)))
  const rgba = createIllustrationRgba(seed, { width: size, height: size, kind: "wallpaper" })
  const bytes = new Uint8Array(totalBytes)
  new DataView(bytes.buffer).setUint32(0, payload.length, false)
  bytes.set(payload, 4)
  for (let index = 0; index < bytes.length; index += 1) rgba[rgbByteOffset(index)] = bytes[index]
  return encodeRgbaPng(size, size, rgba)
}

export function decodeSteganoJsonFromPng(pngBuffer) {
  const { rgba } = decodeRgbaPng(pngBuffer)
  const readByte = index => rgba[rgbByteOffset(index)]
  const payloadLength = (
    (readByte(0) * 0x1000000)
    + (readByte(1) << 16)
    + (readByte(2) << 8)
    + readByte(3)
  ) >>> 0
  if (payloadLength > STEGANO_MAX_BYTES || payloadLength + 4 > (rgba.length / 4) * 3) {
    throw new RangeError("Invalid steganographic payload length")
  }
  const payload = new Uint8Array(payloadLength)
  for (let index = 0; index < payloadLength; index += 1) payload[index] = readByte(index + 4)
  return new TextDecoder().decode(payload)
}
