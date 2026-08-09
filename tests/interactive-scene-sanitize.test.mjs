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

test("article sanitizer preserves only exact ordinary interaction anchors", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const safe = sanitizeRichHtml(
    '<div class="article-interaction-anchor" data-article-interaction-group="group-a" contenteditable="false"></div>',
    { windowObject: dom.window },
  )
  const invalid = sanitizeRichHtml(
    '<div class="article-interaction-anchor" data-article-interaction-group=" bad " contenteditable="true"></div>',
    { windowObject: dom.window },
  )

  assert.match(safe, /class="article-interaction-anchor"/)
  assert.match(safe, /data-article-interaction-group="group-a"/)
  assert.match(safe, /contenteditable="false"/)
  assert.doesNotMatch(invalid, /article-interaction-anchor/)
  assert.doesNotMatch(invalid, /data-article-interaction-group/)
  assert.doesNotMatch(invalid, /contenteditable/)
  dom.window.close()
})

test("article sanitizer preserves only exact in-article placeholder anchors", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const safe = sanitizeRichHtml(
    '<span class="article-placeholder-anchor" data-article-placeholder="placeholder-a" contenteditable="false"></span>',
    { windowObject: dom.window },
  )
  const invalid = sanitizeRichHtml(
    '<span class="article-placeholder-anchor" data-article-placeholder=" bad " contenteditable="true"></span>',
    { windowObject: dom.window },
  )

  assert.match(safe, /class="article-placeholder-anchor"/)
  assert.match(safe, /data-article-placeholder="placeholder-a"/)
  assert.match(safe, /contenteditable="false"/)
  assert.doesNotMatch(invalid, /article-placeholder-anchor/)
  assert.doesNotMatch(invalid, /data-article-placeholder/)
  assert.doesNotMatch(invalid, /contenteditable/)
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

test("import sanitizer preserves portable asset references", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  const assetRef = `asset://${"b".repeat(64)}`
  const result = sanitizeImportedWork({
    type: "article",
    nodes: [],
    interactiveScenes: [{
      dialogueStyle: { frameImage: assetRef },
      stages: [{ image: assetRef, characterImage: assetRef, hotspots: [] }],
    }],
  }, dom.window)

  assert.equal(result.interactiveScenes[0].dialogueStyle.frameImage, assetRef)
  assert.equal(result.interactiveScenes[0].stages[0].image, assetRef)
  assert.equal(result.interactiveScenes[0].stages[0].characterImage, assetRef)
  dom.window.close()
})
