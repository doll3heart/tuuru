import test from "node:test"
import assert from "node:assert/strict"

import { substituteInteractiveSceneText } from "../js/interactive-scene-placeholders.js"

test("interactive scene visible text uses reader placeholder values without mutating author data", () => {
  const scene = {
    id: "scene-1",
    title: "给name的场景",
    startStageId: "stage-1",
    stages: [{
      id: "stage-1",
      name: "name的画面",
      image: "https://example.test/name.png",
      alt: "name站在窗边",
      prompt: "触碰name",
      dialogue: { speaker: "name", text: "name，水给你。" },
      hotspots: [{
        id: "hotspot-1",
        label: "name的手",
        speaker: "name",
        dialogue: "抓到name了。",
      }],
    }],
  }
  const placeholders = [{ id: "reader-name", key: "name", values: ["旧值"] }]

  const result = substituteInteractiveSceneText(scene, placeholders, {
    valuesMap: { "reader-name": ["阿雾"] },
    usePlaceholderMode: false,
  })

  assert.equal(result.title, "给阿雾的场景")
  assert.equal(result.stages[0].name, "阿雾的画面")
  assert.equal(result.stages[0].alt, "阿雾站在窗边")
  assert.equal(result.stages[0].prompt, "触碰阿雾")
  assert.deepEqual(result.stages[0].dialogue, { speaker: "阿雾", text: "阿雾，水给你。" })
  assert.equal(result.stages[0].hotspots[0].label, "阿雾的手")
  assert.equal(result.stages[0].hotspots[0].speaker, "阿雾")
  assert.equal(result.stages[0].hotspots[0].dialogue, "抓到阿雾了。")
  assert.equal(result.stages[0].image, "https://example.test/name.png")
  assert.equal(scene.stages[0].dialogue.text, "name，水给你。")
})
