import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("the author app registers the export-center route", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8")
  assert.match(source, /router\("\/exports", async/)
  assert.match(source, /import\("\.\/pages\/exports\.js"\)/)
  assert.match(
    source,
    /router\("\/exports", async[\s\S]*?Promise\.all\(\[[\s\S]*?import\("\.\/pages\/exports\.js"\)[\s\S]*?import\("\.\/pages\/home\.js"\)[\s\S]*?\]\)/,
  )
  assert.match(source, /renderExportCenter\(\)/)
  assert.match(source, /bindExportCenter\(\)/)
})
