import test from "node:test"
import assert from "node:assert/strict"

import {
  decryptWorkPackage,
  encryptWorkPackage,
  isEncryptedWorkPackage,
} from "../js/work-package.js"

test("encrypted work packages round-trip without exposing work secrets", async () => {
  const source = JSON.stringify({
    title: "Secret work",
    password: "2468",
    body: "hidden prose",
  })

  const packed = await encryptWorkPackage(source)

  assert.equal(isEncryptedWorkPackage(packed), true)
  assert.equal(isEncryptedWorkPackage(packed.buffer), true)
  assert.doesNotMatch(Buffer.from(packed).toString("utf8"), /2468|hidden prose/)
  assert.equal(await decryptWorkPackage(packed), source)
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
