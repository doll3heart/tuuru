import test from "node:test"
import assert from "node:assert/strict"

import {
  ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES,
  MAX_ENCRYPTED_WORK_PACKAGE_BYTES,
  MAX_ENCRYPTED_WORK_PLAINTEXT_BYTES,
  assertEncryptedWorkPackageSize,
  decryptWorkPackage,
  decryptPortableWorkPackage,
  encryptWorkPackage,
  encryptPortableWorkPackage,
  isEncryptedWorkPackage,
} from "../js/work-package.js"

test("encrypted work package limits apply to the final encrypted payload", () => {
  assert.equal(ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES, 35)
  assert.equal(
    MAX_ENCRYPTED_WORK_PLAINTEXT_BYTES + ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES,
    MAX_ENCRYPTED_WORK_PACKAGE_BYTES,
  )
  assert.equal(
    assertEncryptedWorkPackageSize(MAX_ENCRYPTED_WORK_PACKAGE_BYTES),
    MAX_ENCRYPTED_WORK_PACKAGE_BYTES,
  )
  assert.throws(
    () => assertEncryptedWorkPackageSize(MAX_ENCRYPTED_WORK_PACKAGE_BYTES + 1),
    /10 MB/,
  )
})

test("encrypted work packages round-trip without exposing work secrets", async () => {
  const source = JSON.stringify({
    title: "Secret work",
    password: "2468",
    body: "hidden prose",
  })

  const packed = await encryptWorkPackage(source)

  assert.equal(packed.length, new TextEncoder().encode(source).length + ENCRYPTED_WORK_PACKAGE_OVERHEAD_BYTES)
  assert.equal(isEncryptedWorkPackage(packed), true)
  assert.equal(isEncryptedWorkPackage(packed.buffer), true)
  assert.doesNotMatch(Buffer.from(packed).toString("utf8"), /2468|hidden prose/)
  assert.equal(await decryptWorkPackage(packed), source)
})

test("portable work packages carry deduplicated binary media beside JSON", async () => {
  const serialized = JSON.stringify({
    id: "work-assets",
    image: `asset://${"a".repeat(64)}`,
  })
  const packed = await encryptPortableWorkPackage(serialized, [{
    id: "a".repeat(64),
    type: "image/png",
    fileName: "cover.png",
    blob: new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])], { type: "image/png" }),
  }])
  const portable = await decryptPortableWorkPackage(packed)

  assert.equal(await decryptWorkPackage(packed), serialized)
  assert.equal(portable.serialized, serialized)
  assert.equal(portable.assets.length, 1)
  assert.deepEqual(portable.assets[0], {
    id: "a".repeat(64),
    type: "image/png",
    fileName: "cover.png",
    bytes: new Uint8Array([0, 1, 2, 253, 254, 255]),
  })
  assert.doesNotMatch(Buffer.from(packed).toString("utf8"), /cover\.png|work-assets/)
})

test("portable package readers keep version-one exports compatible", async () => {
  const serialized = JSON.stringify({ id: "legacy-work" })
  const packed = await encryptWorkPackage(serialized)

  assert.deepEqual(await decryptPortableWorkPackage(packed), {
    serialized,
    assets: [],
  })
})

test("portable work packages reject more than 256 unique assets before reading bytes", async () => {
  const assets = Array.from({ length:257 }, (_, index) => ({
    id:index.toString(16).padStart(64, "0"),
    type:"image/png",
    bytes:new Uint8Array(),
  }))

  await assert.rejects(
    encryptPortableWorkPackage("{}", assets),
    /256/,
  )
})

test("encrypted work packages use a fresh nonce for every export", async () => {
  const source = JSON.stringify({ password: "same input" })
  const first = await encryptWorkPackage(source)
  const second = await encryptWorkPackage(source)

  assert.notDeepEqual(first, second)
  assert.equal(await decryptWorkPackage(first), source)
  assert.equal(await decryptWorkPackage(second), source)
})

test("encrypted work packages reject tampering and unrelated input", async () => {
  const packed = await encryptWorkPackage(JSON.stringify({ password: "2468" }))
  const tampered = packed.slice()
  tampered[tampered.length - 1] ^= 1

  await assert.rejects(
    decryptWorkPackage(tampered),
    /作品包已损坏或不是由当前版本的 Tuuru 导出/,
  )
  assert.equal(isEncryptedWorkPackage(new TextEncoder().encode('{"password":"2468"}')), false)
  await assert.rejects(
    decryptWorkPackage(new Uint8Array([1, 2, 3])),
    /不是有效的 Tuuru 加密作品包/,
  )
})

test("encrypted work packages validate plaintext and input types", async () => {
  await assert.rejects(encryptWorkPackage(""), /作品内容不能为空/)
  await assert.rejects(encryptWorkPackage(null), /作品内容必须是字符串/)
  assert.equal(isEncryptedWorkPackage(null), false)
})
