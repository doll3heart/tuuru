import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const readerSource = await readFile(new URL("../reader/reader.js", import.meta.url), "utf8")
const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const workExportSource = await readFile(new URL("../js/work-export.js", import.meta.url), "utf8")
const collectionsSource = await readFile(new URL("../js/pages/home-collections.js", import.meta.url), "utf8")

test("reader accepts encrypted Tuuru packages while retaining legacy transports", () => {
  assert.match(readerSource, /accept="\.tuuru,\.json,\.png"/)
  assert.match(readerSource, /ext !== 'tuuru' && ext !== 'json' && ext !== 'png'/)
  assert.match(readerSource, /reader\.readAsArrayBuffer\(file\)/)
  assert.match(readerSource, /reader\.readAsText\(file\)/)
  assert.match(readerSource, /reader\.readAsDataURL\(file\)/)
})

test("reader decrypts dedicated packages and encrypted PNG payloads", () => {
  assert.match(readerSource, /await decryptWorkPackage\(encryptedBytes\)/)
  assert.match(readerSource, /isEncryptedWorkPackage\(bytes\)/)
  assert.match(readerSource, /return decryptWorkPackage\(bytes\)\.then/)
  assert.match(readerSource, /JSON\.parse\(new TextDecoder\(\)\.decode\(bytes\)\)/)
})

test("author exports dedicated and PNG works through the encrypted package", () => {
  assert.match(homeSource, /createWorkArtifact\(id, \{format:'tuuru'\}\)/)
  assert.match(homeSource, /createWorkArtifact\(id, \{format:'png'/)
  assert.match(workExportSource, /await encrypt\(serialized\)/)
  assert.match(workExportSource, /application\/vnd\.tuuru\.work/)
  assert.match(workExportSource, /`\$\{baseName\}\.tuuru`/)
  assert.doesNotMatch(homeSource, /a\.download = \(w \? w\.title : '作品'\) \+ '\.json'/)
  assert.match(collectionsSource, /const encrypted = await encryptWorkPackage\(json\)/)
  assert.match(collectionsSource, /application\/vnd\.tuuru\.work/)
  assert.doesNotMatch(collectionsSource, /\.tuuru\.json/)
})
