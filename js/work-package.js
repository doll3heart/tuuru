const PACKAGE_PREFIX = Uint8Array.of(0x54, 0x55, 0x55, 0x52, 0x55, 0x00)
const PACKAGE_HEADER_V1 = Uint8Array.of(...PACKAGE_PREFIX, 0x01)
const PACKAGE_HEADER_V2 = Uint8Array.of(...PACKAGE_PREFIX, 0x02)
const PORTABLE_BUNDLE_HEADER = Uint8Array.of(0x54, 0x55, 0x55, 0x52, 0x55, 0x42, 0x00, 0x01)
const PACKAGE_IV_BYTES = 12
const PACKAGE_TAG_BYTES = 16
export const MAX_ENCRYPTED_WORK_PACKAGE_BYTES = 10 * 1024 * 1024
export const ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES = PACKAGE_HEADER_V1.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES
export const MAX_ENCRYPTED_WORK_PLAINTEXT_BYTES = MAX_ENCRYPTED_WORK_PACKAGE_BYTES - ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES
const MAX_PORTABLE_ASSETS = 256
const SHA256_PATTERN = /^[a-f0-9]{64}$/

// This application key keeps exported work data out of ordinary file viewers.
// Because the offline reader must also contain it, this is not a DRM boundary
// against a determined person who reverse-engineers the reader.
const PACKAGE_KEY_BYTES = Uint8Array.of(
  0x8e, 0x3b, 0x6f, 0x14, 0x55, 0xc2, 0xa9, 0x7d,
  0x21, 0xe4, 0x90, 0x38, 0xb7, 0x62, 0x0d, 0xf1,
  0x43, 0xac, 0x79, 0x26, 0xd8, 0x05, 0xbe, 0x6a,
  0x9c, 0x31, 0xf7, 0x4b, 0x02, 0xe5, 0x88, 0xd3,
)

function bytesOf(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  return null
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function bytesEqual(bytes, offset, expected) {
  if (!bytes || offset < 0 || offset + expected.length > bytes.length) return false
  return expected.every((value, index) => bytes[offset + index] === value)
}

function uint32Bytes(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError("作品包长度无效")
  }
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  )
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  ) >>> 0
}

function cryptoOrThrow(cryptoObject) {
  if (!cryptoObject || typeof cryptoObject.getRandomValues !== "function" || !cryptoObject.subtle) {
    throw new Error("当前环境不支持安全的作品加密")
  }
  return cryptoObject
}

export function assertEncryptedWorkPackageSize(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new TypeError("作品包大小无效")
  }
  if (byteLength > MAX_ENCRYPTED_WORK_PACKAGE_BYTES) {
    throw new RangeError("加密作品包超过 10 MB 导出与读取上限，请精简作品内容后重试")
  }
  return byteLength
}

async function importPackageKey(cryptoObject) {
  return cryptoObject.subtle.importKey(
    "raw",
    PACKAGE_KEY_BYTES,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  )
}

function packageHeader(bytes) {
  if (!bytesEqual(bytes, 0, PACKAGE_PREFIX) || bytes.length < PACKAGE_HEADER_V1.length) return null
  if (bytes[PACKAGE_PREFIX.length] === 1) return PACKAGE_HEADER_V1
  if (bytes[PACKAGE_PREFIX.length] === 2) return PACKAGE_HEADER_V2
  return null
}

async function encryptBytes(plaintext, header, cryptoObject) {
  if (!plaintext.length) throw new RangeError("作品内容不能为空")
  assertEncryptedWorkPackageSize(header.length + PACKAGE_IV_BYTES + plaintext.length + PACKAGE_TAG_BYTES)
  const safeCrypto = cryptoOrThrow(cryptoObject)
  const iv = safeCrypto.getRandomValues(new Uint8Array(PACKAGE_IV_BYTES))
  const key = await importPackageKey(safeCrypto)
  const encrypted = await safeCrypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header },
    key,
    plaintext,
  )
  const packed = concatBytes(header, iv, new Uint8Array(encrypted))
  assertEncryptedWorkPackageSize(packed.length)
  return packed
}

async function decryptBytes(input, cryptoObject) {
  const bytes = bytesOf(input)
  const header = packageHeader(bytes)
  if (!header || bytes.length < header.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES) {
    throw new TypeError("不是有效的 Tuuru 加密作品包")
  }
  assertEncryptedWorkPackageSize(bytes.length)
  const ciphertextStart = header.length + PACKAGE_IV_BYTES
  const ciphertext = bytes.slice(ciphertextStart)
  try {
    const safeCrypto = cryptoOrThrow(cryptoObject)
    const key = await importPackageKey(safeCrypto)
    const plaintext = await safeCrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(header.length, ciphertextStart),
        additionalData: header,
      },
      key,
      ciphertext,
    )
    return { version: header[header.length - 1], bytes: new Uint8Array(plaintext) }
  } catch {
    throw new Error("作品包已损坏或不是由当前版本的 Tuuru 导出")
  }
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}

async function buildPortableBundle(serialized, assets) {
  if (typeof serialized !== "string") throw new TypeError("作品内容必须是字符串")
  if (!serialized) throw new RangeError("作品内容不能为空")
  const serializedBytes = new TextEncoder().encode(serialized)
  assertEncryptedWorkPackageSize(
    PACKAGE_HEADER_V2.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES
      + PORTABLE_BUNDLE_HEADER.length + 8 + serializedBytes.length,
  )
  const uniqueAssets = []
  const seen = new Set()
  for (const asset of Array.isArray(assets) ? assets : []) {
    const id = String(asset?.id || "").toLowerCase()
    if (!SHA256_PATTERN.test(id)) throw new TypeError("作品素材 ID 无效")
    if (seen.has(id)) continue
    seen.add(id)
    if (seen.size > MAX_PORTABLE_ASSETS) throw new RangeError("单个作品最多包含 256 个本地素材")
    const assetBytes = asset?.bytes ? bytesOf(asset.bytes) : null
    const bytes = assetBytes || (asset?.blob?.arrayBuffer
      ? new Uint8Array(await asset.blob.arrayBuffer())
      : null)
    if (!bytes) throw new TypeError("作品素材数据无效")
    uniqueAssets.push({
      id,
      type: String(asset.type || asset.blob?.type || "application/octet-stream").slice(0, 120),
      fileName: String(asset.fileName || "").slice(0, 240),
      bytes,
    })
  }
  const manifestBytes = new TextEncoder().encode(JSON.stringify({
    assets: uniqueAssets.map(asset => ({
      id: asset.id,
      type: asset.type,
      fileName: asset.fileName,
      length: asset.bytes.length,
    })),
  }))
  assertEncryptedWorkPackageSize(
    PACKAGE_HEADER_V2.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES
      + PORTABLE_BUNDLE_HEADER.length + 8 + serializedBytes.length + manifestBytes.length
      + uniqueAssets.reduce((sum, asset) => sum + asset.bytes.length, 0),
  )
  return concatBytes(
    PORTABLE_BUNDLE_HEADER,
    uint32Bytes(serializedBytes.length),
    uint32Bytes(manifestBytes.length),
    serializedBytes,
    manifestBytes,
    ...uniqueAssets.map(asset => asset.bytes),
  )
}

function parsePortableBundle(bytes) {
  if (!bytesEqual(bytes, 0, PORTABLE_BUNDLE_HEADER) || bytes.length < PORTABLE_BUNDLE_HEADER.length + 8) {
    throw new Error("作品素材包结构无效")
  }
  const serializedLength = readUint32(bytes, PORTABLE_BUNDLE_HEADER.length)
  const manifestLength = readUint32(bytes, PORTABLE_BUNDLE_HEADER.length + 4)
  const serializedStart = PORTABLE_BUNDLE_HEADER.length + 8
  const manifestStart = serializedStart + serializedLength
  const assetStart = manifestStart + manifestLength
  if (manifestStart < serializedStart || assetStart < manifestStart || assetStart > bytes.length) {
    throw new Error("作品素材包长度无效")
  }
  let manifest
  try {
    manifest = JSON.parse(decodeUtf8(bytes.slice(manifestStart, assetStart)))
  } catch {
    throw new Error("作品素材清单无效")
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length > MAX_PORTABLE_ASSETS) {
    throw new Error("作品素材清单无效")
  }
  let offset = assetStart
  const assets = manifest.assets.map(asset => {
    const id = String(asset?.id || "").toLowerCase()
    const length = Number(asset?.length)
    if (!SHA256_PATTERN.test(id) || !Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length) {
      throw new Error("作品素材清单无效")
    }
    const result = {
      id,
      type: String(asset.type || "application/octet-stream").slice(0, 120),
      fileName: String(asset.fileName || "").slice(0, 240),
      bytes: bytes.slice(offset, offset + length),
    }
    offset += length
    return result
  })
  if (offset !== bytes.length) throw new Error("作品素材包包含未声明数据")
  return {
    serialized: decodeUtf8(bytes.slice(serializedStart, manifestStart)),
    assets,
  }
}

export function isEncryptedWorkPackage(input) {
  const bytes = bytesOf(input)
  const header = packageHeader(bytes)
  return Boolean(header && bytes.length >= header.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES)
}

export async function encryptWorkPackage(serialized, cryptoObject = globalThis.crypto) {
  if (typeof serialized !== "string") throw new TypeError("作品内容必须是字符串")
  return encryptBytes(new TextEncoder().encode(serialized), PACKAGE_HEADER_V1, cryptoObject)
}

export async function encryptPortableWorkPackage(serialized, assets, cryptoObject = globalThis.crypto) {
  return encryptBytes(await buildPortableBundle(serialized, assets), PACKAGE_HEADER_V2, cryptoObject)
}

export async function decryptPortableWorkPackage(input, cryptoObject = globalThis.crypto) {
  const decrypted = await decryptBytes(input, cryptoObject)
  if (decrypted.version === 1) return { serialized: decodeUtf8(decrypted.bytes), assets: [] }
  return parsePortableBundle(decrypted.bytes)
}

export async function decryptWorkPackage(input, cryptoObject = globalThis.crypto) {
  return (await decryptPortableWorkPackage(input, cryptoObject)).serialized
}
