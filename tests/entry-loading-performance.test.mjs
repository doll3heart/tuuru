import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [appSource, cameraSource, readerSource, readerAppearanceWorkbenchSource] = await Promise.all([
  readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/interactive-scene-camera.js", import.meta.url), "utf8"),
  readFile(new URL("../reader/reader.js", import.meta.url), "utf8"),
  readFile(new URL("../reader/reader-appearance-workbench.js", import.meta.url), "utf8"),
])

test("author routes lazy-load their page modules", () => {
  const pageModules = ["home", "new", "editor", "phone", "resources", "exports"]
  for (const page of pageModules) {
    const path = `./pages/${page}.js`
    const staticImport = new RegExp(`^\\s*import\\s+(?:[\\s\\S]*?\\s+from\\s+)?["']${path.replace(/[./]/g, "\\$&")}["']`, "m")
    assert.doesNotMatch(appSource, staticImport)
    assert.match(appSource, new RegExp(`import\\(\\s*["']${path.replace(/[./]/g, "\\$&")}["']\\s*\\)`))
  }
})

test("MediaPipe loads only when the fallback detector is needed", () => {
  assert.doesNotMatch(cameraSource, /^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']@mediapipe\/tasks-vision["']/m)
  assert.match(cameraSource, /import\(\s*["']@mediapipe\/tasks-vision["']\s*\)/)
})

test("phone-content export loads only when exporting", () => {
  assert.doesNotMatch(readerSource, /^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']\.\/phone-content-export\.js["']/m)
  assert.match(readerSource, /import\(\s*["']\.\/phone-content-export\.js["']\s*\)/)
})

test("reader appearance workbench loads only after its controls are activated", () => {
  assert.doesNotMatch(readerSource, /^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']\.\/reader-appearance-workbench\.js["']/m)
  assert.match(readerSource, /import\(\s*["']\.\/reader-appearance-workbench\.js["']\s*\)/)
  assert.match(readerAppearanceWorkbenchSource, /export\s+function\s+openPhoneAppearance\s*\(/)
  assert.match(readerAppearanceWorkbenchSource, /export\s+function\s+openReaderProfile\s*\(/)
  assert.match(readerAppearanceWorkbenchSource, /export\s+function\s+openPerAppAppearance\s*\(/)
})
