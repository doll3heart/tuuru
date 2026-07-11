export const MAX_READER_PNG_EDGE = 4096
export const MAX_READER_PNG_PIXELS = 4 * 1024 * 1024

var PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
var IHDR_TYPE = [73, 72, 68, 82]

function readUint32(bytes, offset) {
  return (((bytes[offset] * 256 + bytes[offset + 1]) * 256 + bytes[offset + 2]) * 256) + bytes[offset + 3]
}

function decodePngHeader(dataUrl) {
  if (typeof dataUrl !== 'string') return null
  var commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return null
  var metadata = dataUrl.slice(0, commaIndex).toLowerCase()
  if (metadata.indexOf('data:') !== 0 || !metadata.endsWith(';base64')) return null

  var encodedHeader = dataUrl.slice(commaIndex + 1, commaIndex + 33)
  if (encodedHeader.length < 32 || typeof globalThis.atob !== 'function') return null
  try {
    var binaryHeader = globalThis.atob(encodedHeader)
    if (binaryHeader.length < 24) return null
    var bytes = new Uint8Array(24)
    for (var index = 0; index < bytes.length; index++) bytes[index] = binaryHeader.charCodeAt(index)
    return bytes
  } catch (error) {
    return null
  }
}

export function parsePngDimensionsFromDataUrl(dataUrl) {
  var bytes = decodePngHeader(dataUrl)
  if (!bytes) return null

  for (var signatureIndex = 0; signatureIndex < PNG_SIGNATURE.length; signatureIndex++) {
    if (bytes[signatureIndex] !== PNG_SIGNATURE[signatureIndex]) return null
  }
  if (readUint32(bytes, 8) !== 13) return null
  for (var typeIndex = 0; typeIndex < IHDR_TYPE.length; typeIndex++) {
    if (bytes[12 + typeIndex] !== IHDR_TYPE[typeIndex]) return null
  }

  var width = readUint32(bytes, 16)
  var height = readUint32(bytes, 20)
  if (width <= 0 || height <= 0) return null
  return { width: width, height: height }
}

export function readerPngDimensionError(dimensions) {
  if (!dimensions) return 'PNG 文件头无效，请选择完整的 PNG 文件'
  var width = dimensions.width
  var height = dimensions.height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    return 'PNG 文件头无效，请选择完整的 PNG 文件'
  }
  if (width > MAX_READER_PNG_EDGE || height > MAX_READER_PNG_EDGE) {
    return 'PNG 尺寸过大，单边不能超过 4096 像素'
  }
  if (width * height > MAX_READER_PNG_PIXELS) {
    return 'PNG 像素过多，最多允许 419 万像素'
  }
  return ''
}
