import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { sanitizeImportedWork, sanitizeRichHtml } from "../js/sanitize.js"

test("article sanitizer preserves only valid interactive scene entry markers", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const safe = sanitizeRichHtml(
    '<div class="interactive-scene-card" data-is-id="scene-1"><span class="interactive-scene-card-copy"><small>互动场景</small><span class="interactive-scene-card-label">掌心</span></span><span class="interactive-scene-card-actions"><button type="button" class="interactive-scene-card-edit">编辑</button><button type="button" class="interactive-scene-card-delete">删除</button></span><script>bad()</script></div>',
    { windowObject: dom.window },
  )
  const invalid = sanitizeRichHtml(
    '<div class="interactive-scene-card" data-is-id="bad id"><span class="interactive-scene-card-label">掌心</span></div>',
    { windowObject: dom.window },
  )

  assert.match(safe, /class="interactive-scene-card"/)
  assert.match(safe, /data-is-id="scene-1"/)
  assert.match(safe, /interactive-scene-card-edit/)
  assert.match(safe, /interactive-scene-card-delete/)
  assert.doesNotMatch(safe, /script/)
  assert.doesNotMatch(invalid, /data-is-id/)
  dom.window.close()
})

test("import sanitizer removes unsafe scene media but keeps HTTPS and GIF data images", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const result = sanitizeImportedWork({
    type: "article",
    nodes: [],
    interactiveScenes: [{
      dialogueStyle: { frameImage: "javascript:alert(1)" },
      stages: [
        { image: "javascript:alert(1)", characterImage: "javascript:alert(2)", hotspots: [] },
        { image: "https://example.test/scene.gif", characterImage: "https://example.test/character.png", hotspots: [] },
        { image: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", hotspots: [] },
      ],
    }],
  }, dom.window)

  assert.equal(result.interactiveScenes[0].stages[0].image, "")
  assert.equal(result.interactiveScenes[0].stages[0].characterImage, "")
  assert.equal(result.interactiveScenes[0].dialogueStyle.frameImage, "")
  assert.equal(result.interactiveScenes[0].stages[1].image, "https://example.test/scene.gif")
  assert.equal(result.interactiveScenes[0].stages[1].characterImage, "https://example.test/character.png")
  assert.match(result.interactiveScenes[0].stages[2].image, /^data:image\/gif/)
  dom.window.close()
})
