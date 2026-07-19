import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { exportWorkAsJSON } from "../js/data.js"
import { readSteganoPayload, writeSteganoPayload } from "../js/stegano.js"
import { prepareImportedWork } from "../js/work-import.js"

function rgbaPixelsFor(byteLength) {
  return new Uint8ClampedArray(Math.ceil((byteLength + 4) / 3) * 4)
}

function throughReaderContract(serialized, windowObject) {
  const result = prepareImportedWork(JSON.parse(serialized), windowObject)
  assert.equal(result.ok, true)
  return result.work
}

function throughStegano(serialized, windowObject) {
  const payload = new TextEncoder().encode(serialized)
  const pixels = rgbaPixelsFor(payload.length)
  writeSteganoPayload(pixels, payload)
  const decoded = new TextDecoder().decode(readSteganoPayload(pixels))
  return throughReaderContract(decoded, windowObject)
}

test("current article and phone exports have identical JSON and PNG reader semantics", t => {
  const originalStorage = globalThis.localStorage
  const windowObject = new JSDOM("<!doctype html><html><body></body></html>").window
  const fixtures = [
    {
      id: "article-golden",
      schemaVersion: 1,
      type: "article",
      title: "Article",
      nodes: [{ id: "start", content: '<b>safe</b><img src="javascript:bad">', choices: [] }],
      chapters: [],
      scenes: [],
      placeholders: [],
      phoneModules: [{ id: "module", type: "memo", data: { memos: [] } }],
      editorSettings: { fontSize: 18 },
      futureField: { preserved: true },
      watermark: {
        enabled: true, kind: "text", text: "作者署名", image: null,
        opacity: 0.16, coverage: "full", position: "bottom-right",
        pattern: "cross", spacing: 160,
      },
    },
    {
      id: "phone-golden",
      schemaVersion: 1,
      type: "phone",
      title: "Phone",
      placeholders: [],
      scenes: [],
      phoneData: {
        contacts: [{ id: "contact", name: "A" }],
        chats: [], moments: [], forumPosts: [], forumNpcs: [],
        apps: [
          { id: "settings", type: "settings" },
          { id: "customize", type: "customize" },
          { id: "profile", type: "profile" },
          { id: "messages", type: "messages", icon: "<svg></svg>" },
        ],
        memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
        futurePhoneField: { preserved: true },
      },
      editorSettings: { fontSize: 12 },
      watermark: {
        enabled: true, kind: "image", text: "", image: "data:image/png;base64,AA==",
        opacity: 0.12, coverage: "single", position: "top-left",
        pattern: "diagonal", spacing: 140,
      },
    },
  ]
  globalThis.localStorage = {
    getItem() { return JSON.stringify({ works: fixtures, contacts: [], groups: [] }) },
    setItem() { throw new Error("export must not write") },
  }
  t.after(() => { globalThis.localStorage = originalStorage })

  for (const fixture of fixtures) {
    const serialized = exportWorkAsJSON(fixture.id)
    const jsonWork = throughReaderContract(serialized, windowObject)
    const pngWork = throughStegano(serialized, windowObject)

    assert.deepEqual(pngWork, jsonWork)
    assert.deepEqual(jsonWork.watermark, fixture.watermark)
    assert.equal(jsonWork.editorSettings, undefined)
    if (fixture.type === "article") assert.deepEqual(jsonWork.futureField, { preserved: true })
    if (fixture.type === "phone") {
      assert.equal(jsonWork.phoneData.apps.some(app => app.type === "settings"), false)
      assert.equal(jsonWork.phoneData.apps.some(app => app.type === "customize"), false)
      assert.equal(jsonWork.phoneData.apps.some(app => app.type === "profile"), false)
      assert.deepEqual(jsonWork.phoneData.futurePhoneField, { preserved: true })
    }
  }
})
