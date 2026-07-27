# Encrypted Work Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export Tuuru works as authenticated ciphertext so ordinary file readers cannot inspect the work body or reading password, while the Tuuru reader can import it locally.

**Architecture:** Add a small transport module that wraps UTF-8 work JSON in a versioned binary envelope encrypted with Web Crypto AES-256-GCM. Use the envelope for the dedicated `.tuuru` export and for new PNG steganography payloads; retain the existing JSON validator/sanitizer after decryption and keep legacy JSON and plaintext PNG imports compatible.

**Tech Stack:** Browser Web Crypto API, JavaScript ES modules, Node test runner, existing PNG steganography transport.

## Global Constraints

- Do not change the work schema or local author database representation.
- Do not claim offline client-side encryption prevents a determined reverse engineer from recovering the bundled reader key.
- Preserve import compatibility for legacy `.json` works and legacy plaintext PNG works.
- Authenticate encrypted data before parsing it as JSON.

---

### Task 1: Versioned encrypted work envelope

**Files:**
- Create: `js/work-package.js`
- Create: `tests/work-package.test.mjs`

**Interfaces:**
- Produces: `encryptWorkPackage(serialized: string, cryptoObject?: Crypto): Promise<Uint8Array>`
- Produces: `decryptWorkPackage(input: ArrayBuffer|ArrayBufferView, cryptoObject?: Crypto): Promise<string>`
- Produces: `isEncryptedWorkPackage(input: ArrayBuffer|ArrayBufferView): boolean`

- [ ] **Step 1: Write failing round-trip, confidentiality, tamper, and format-detection tests**

```js
test("encrypted packages round-trip without exposing password or body", async () => {
  const source = JSON.stringify({ title:"Secret", password:"2468", body:"hidden prose" })
  const packed = await encryptWorkPackage(source)
  assert.equal(isEncryptedWorkPackage(packed), true)
  assert.doesNotMatch(Buffer.from(packed).toString("utf8"), /2468|hidden prose/)
  assert.equal(await decryptWorkPackage(packed), source)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/work-package.test.mjs`
Expected: FAIL because `js/work-package.js` does not exist.

- [ ] **Step 3: Implement a magic/version header, random 96-bit IV, AES-256-GCM encryption, and authenticated decryption**

```js
const HEADER = Uint8Array.of(0x54, 0x55, 0x55, 0x52, 0x55, 0x00, 0x01)
const IV_BYTES = 12

export async function encryptWorkPackage(serialized, cryptoObject = globalThis.crypto) {
  const iv = cryptoObject.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await importPackageKey(cryptoObject)
  const ciphertext = await cryptoObject.subtle.encrypt(
    { name:"AES-GCM", iv, additionalData:HEADER },
    key,
    new TextEncoder().encode(serialized),
  )
  return concatBytes(HEADER, iv, new Uint8Array(ciphertext))
}
```

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/work-package.test.mjs`
Expected: PASS.

### Task 2: Encrypted author exports

**Files:**
- Modify: `js/data.js`
- Modify: `js/pages/home.js`
- Modify: `js/pages/home-collections.js`
- Modify: `tests/work-transport-parity.test.mjs`
- Modify: `tests/png-export-limit.test.mjs`

**Interfaces:**
- Consumes: `encryptWorkPackage`
- Changes: `encodeSteganoPNG` accepts either a JSON string or encrypted `Uint8Array`.
- Changes: individual works and work collections share the encrypted transport.

- [ ] **Step 1: Add tests proving dedicated and PNG exports use encrypted bytes**

```js
const encrypted = await encryptWorkPackage(exportWorkAsJSON(fixture.id))
assert.equal(JSON.parse(await decryptWorkPackage(encrypted)).password, fixture.password)
assert.doesNotMatch(Buffer.from(encrypted).toString("utf8"), new RegExp(fixture.password))
```

- [ ] **Step 2: Run focused tests and confirm the new expectations fail**

Run: `node --test tests/work-package.test.mjs tests/work-transport-parity.test.mjs tests/png-export-limit.test.mjs`
Expected: FAIL until export call sites encrypt.

- [ ] **Step 3: Make `.tuuru` the work-file export and encrypt PNG payloads before steganography**

```js
const packed = await encryptWorkPackage(json)
downloadBlob(new Blob([packed], {type:"application/vnd.tuuru.work"}), `${title}.tuuru`)
encodeSteganoPNG(packed, coverUrl, onComplete, onError)
```

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/work-package.test.mjs tests/work-transport-parity.test.mjs tests/png-export-limit.test.mjs`
Expected: PASS.

### Task 3: Tuuru reader import and backward compatibility

**Files:**
- Modify: `reader/reader.js`
- Create: `tests/encrypted-reader-import.test.mjs`

**Interfaces:**
- Consumes: `decryptWorkPackage`, `isEncryptedWorkPackage`.
- Preserves: legacy JSON parsing and legacy plaintext PNG payload parsing.

- [ ] **Step 1: Add source/contract tests for `.tuuru`, binary FileReader use, encrypted PNG dispatch, and legacy fallback**

```js
assert.match(readerSource, /accept="\.tuuru,\.json,\.png"/)
assert.match(readerSource, /reader\.readAsArrayBuffer\(file\)/)
assert.match(readerSource, /isEncryptedWorkPackage\(bytes\)/)
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/encrypted-reader-import.test.mjs`
Expected: FAIL because the reader only accepts JSON and PNG.

- [ ] **Step 3: Decrypt `.tuuru` buffers and encrypted PNG payloads before JSON parsing; retain plaintext decoding for old PNG files**

```js
async function parseWorkBytes(bytes) {
  const json = isEncryptedWorkPackage(bytes)
    ? await decryptWorkPackage(bytes)
    : new TextDecoder().decode(bytes)
  return JSON.parse(json)
}
```

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/encrypted-reader-import.test.mjs tests/work-package.test.mjs tests/work-transport-parity.test.mjs`
Expected: PASS.

Run: `npm run verify`
Expected: all tests and build verification pass.
