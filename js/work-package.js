const PACKAGE_HEADER = Uint8Array.of(0x54, 0x55, 0x55, 0x52, 0x55, 0x00, 0x01)
const PACKAGE_IV_BYTES = 12
const PACKAGE_TAG_BYTES = 16
const MAX_PACKAGE_PLAINTEXT_BYTES = 10 * 1024 * 1024

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
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
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

function cryptoOrThrow(cryptoObject) {
  if (
    !cryptoObject ||
    typeof cryptoObject.getRandomValues !== "function" ||
    !cryptoObject.subtle
  ) {
    throw new Error("当前环境不支持安全的作品加密")
  }
  return cryptoObject
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

export function isEncryptedWorkPackage(input) {
  const bytes = bytesOf(input)
  if (!bytes || bytes.length < PACKAGE_HEADER.length + PACKAGE_IV_BYTES + PACKAGE_TAG_BYTES) {
    return false
  }
  return PACKAGE_HEADER.every((value, index) => bytes[index] === value)
}

export async function encryptWorkPackage(serialized, cryptoObject = globalThis.crypto) {
  if (typeof serialized !== "string") throw new TypeError("作品内容必须是字符串")
  if (!serialized) throw new RangeError("作品内容不能为空")

  const plaintext = new TextEncoder().encode(serialized)
  if (plaintext.length > MAX_PACKAGE_PLAINTEXT_BYTES) {
    throw new RangeError("作品内容超过 10 MB 加密导出上限，请精简作品内容后重试")
  }

  const safeCrypto = cryptoOrThrow(cryptoObject)
  const iv = safeCrypto.getRandomValues(new Uint8Array(PACKAGE_IV_BYTES))
  const key = await importPackageKey(safeCrypto)
  const encrypted = await safeCrypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: PACKAGE_HEADER },
    key,
    plaintext,
  )
  return concatBytes(PACKAGE_HEADER, iv, new Uint8Array(encrypted))
}

export async function decryptWorkPackage(input, cryptoObject = globalThis.crypto) {
  const bytes = bytesOf(input)
  if (!isEncryptedWorkPackage(bytes)) {
    throw new TypeError("不是有效的 Tuuru 加密作品包")
  }

  const safeCrypto = cryptoOrThrow(cryptoObject)
  const ivStart = PACKAGE_HEADER.length
  const ciphertextStart = ivStart + PACKAGE_IV_BYTES
  const iv = bytes.slice(ivStart, ciphertextStart)
  const ciphertext = bytes.slice(ciphertextStart)
  if (ciphertext.length > MAX_PACKAGE_PLAINTEXT_BYTES + PACKAGE_TAG_BYTES) {
    throw new RangeError("Tuuru 加密作品包超过 10 MB 读取上限")
  }

  try {
    const key = await importPackageKey(safeCrypto)
    const plaintext = await safeCrypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: PACKAGE_HEADER },
      key,
      ciphertext,
    )
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext)
  } catch {
    throw new Error("作品包已损坏或不是由当前版本的 Tuuru 导出")
  }
}
