import test from "node:test"
import assert from "node:assert/strict"

import {
  addReaderLocalFont,
  deleteReaderLocalFont,
  readerLocalFontFamily,
  renameReaderLocalFont,
  replaceReaderLocalFont,
} from "../reader/local-font-library.js"

test("reader local fonts can be added, renamed, replaced and deleted", () => {
  const added = addReaderLocalFont([], { name: "My Font", data: "data:font/ttf;base64,AA==" })
  assert.equal(added[0].name, "My Font")
  assert.equal(readerLocalFontFamily(added[0].name), '"My Font"')

  const renamed = renameReaderLocalFont(added, 0, "New Font")
  assert.equal(renamed[0].name, "New Font")
  assert.equal(renamed[0].data, added[0].data)

  const replaced = replaceReaderLocalFont(renamed, 0, "data:font/woff2;base64,BB==")
  assert.equal(replaced[0].data, "data:font/woff2;base64,BB==")
  assert.deepEqual(deleteReaderLocalFont(replaced, 0), [])
})

test("reader local font names reject real duplicates but allow saving the current name", () => {
  const fonts = [
    { name: "First", data: "data:font/ttf;base64,AA==" },
    { name: "Second", data: "data:font/ttf;base64,BB==" },
  ]

  assert.deepEqual(renameReaderLocalFont(fonts, 0, "First"), fonts)
  assert.throws(() => renameReaderLocalFont(fonts, 0, "Second"), /已存在/)
  assert.throws(
    () => addReaderLocalFont(fonts, { name: "Second", data: "data:font/ttf;base64,CC==" }),
    /已存在/,
  )
})
