import test from "node:test"
import assert from "node:assert/strict"

import {
  readerInteractiveSceneById,
  replaceInteractiveSceneCards,
} from "../reader/interactive-scene-entry.js"

test("reader replaces authored scene cards with safe interactive entry buttons", () => {
  const work = {
    interactiveScenes: [{ id: "scene-1", title: '<掌心 & "呼吸">' }],
  }
  const html = replaceInteractiveSceneCards(
    '前文<div class="interactive-scene-card" data-is-id="scene-1"><span>旧标题</span></div>后文',
    work,
  )

  assert.match(html, /^前文<button/)
  assert.match(html, /data-interactive-scene="scene-1"/)
  assert.match(html, /&lt;掌心 &amp; &quot;呼吸&quot;&gt;/)
  assert.match(html, /<\/button>后文$/)
})

test("reader drops dangling scene cards instead of opening unrelated data", () => {
  const html = replaceInteractiveSceneCards(
    '<div class="interactive-scene-card" data-is-id="missing"><span>旧标题</span></div>',
    { interactiveScenes: [] },
  )

  assert.equal(html, "")
  assert.equal(readerInteractiveSceneById({ interactiveScenes: [] }, "missing"), null)
})

test("reader scene entry titles use the collected placeholder value", () => {
  const html = replaceInteractiveSceneCards(
    '<div class="interactive-scene-card" data-is-id="scene-1"><span>旧标题</span></div>',
    {
      placeholders: [{ id: "reader-name", key: "name", values: ["旧值"] }],
      readerPhValues: { "reader-name": ["阿雾"] },
      interactiveScenes: [{ id: "scene-1", title: "给name的互动" }],
    },
  )

  assert.match(html, /给阿雾的互动/)
  assert.doesNotMatch(html, /给name的互动/)
})
