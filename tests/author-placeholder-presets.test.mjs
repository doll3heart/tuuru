import test from "node:test"
import assert from "node:assert/strict"

import {
  AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY,
  importAuthorPlaceholderPresetBundle,
  deleteAuthorPlaceholderPreset,
  instantiateAuthorPlaceholderPreset,
  parseAuthorPlaceholderPresetBundle,
  readAuthorPlaceholderPresets,
  saveAuthorPlaceholderPreset,
  serializeAuthorPlaceholderPresetBundle,
} from "../js/author-placeholder-presets.js"

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

test("author placeholder presets tolerate malformed local storage", () => {
  const storage = memoryStorage({ [AUTHOR_PLACEHOLDER_PRESET_STORAGE_KEY]: "{bad json" })
  assert.deepEqual(readAuthorPlaceholderPresets(storage), [])
})

test("placeholder preset libraries round-trip and merge by preset name", () => {
  const storage = memoryStorage()
  saveAuthorPlaceholderPreset("常用称呼", [
    { key:"某某", label:"姓名", prompt:"名字？", mode:"each", forbidden:["偷吃", "代餐"] },
  ], { storage, now:() => 100, idFactory:() => "preset-a" })
  const serialized = serializeAuthorPlaceholderPresetBundle(readAuthorPlaceholderPresets(storage), { now:() => 123 })
  const bundle = parseAuthorPlaceholderPresetBundle(serialized)
  assert.equal(bundle.version, 1)
  assert.equal(bundle.exportedAt, 123)
  assert.equal(bundle.presets[0].name, "常用称呼")
  assert.deepEqual(bundle.presets[0].fields[0].forbidden, ["偷吃", "代餐"])

  const target = memoryStorage()
  saveAuthorPlaceholderPreset("常用称呼", [{ key:"旧标记" }], { storage:target, now:() => 1, idFactory:() => "target-id" })
  const merged = importAuthorPlaceholderPresetBundle(serialized, { storage:target, idFactory:() => "created" })
  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, "target-id")
  assert.equal(merged[0].fields[0].key, "某某")
})

test("placeholder preset import rejects unrelated or malformed files", () => {
  assert.throws(() => parseAuthorPlaceholderPresetBundle('{"version":1}'), /占位符预设文件/)
  assert.throws(() => parseAuthorPlaceholderPresetBundle('not json'), /占位符预设文件/)
})

test("saving a preset keeps author fields but excludes work and reader state", () => {
  const storage = memoryStorage()
  const saved = saveAuthorPlaceholderPreset(" 常用称呼 ", [{
    id: "work-placeholder",
    key: "某某",
    label: "姓名",
    prompt: "你的名字？",
    mode: "each",
    forbidden: ["偷吃", "", 7],
    values: ["读者填写值"],
    default: "不能带走",
    future: { secret: true },
  }], { storage, now: () => 100, idFactory: () => "preset-a" })

  assert.equal(saved.name, "常用称呼")
  assert.deepEqual(saved.fields, [{
    key: "某某",
    label: "姓名",
    prompt: "你的名字？",
    mode: "each",
    forbidden: ["偷吃", "7"],
  }])
  assert.equal(readAuthorPlaceholderPresets(storage).length, 1)
})

test("saving the same preset name updates it instead of creating a duplicate", () => {
  const storage = memoryStorage()
  saveAuthorPlaceholderPreset("常用", [{ key: "A" }], { storage, now: () => 1, idFactory: () => "preset-a" })
  saveAuthorPlaceholderPreset(" 常用 ", [{ key: "B" }], { storage, now: () => 2, idFactory: () => "preset-b" })
  const presets = readAuthorPlaceholderPresets(storage)
  assert.equal(presets.length, 1)
  assert.equal(presets[0].id, "preset-a")
  assert.equal(presets[0].fields[0].key, "B")
  assert.equal(presets[0].updatedAt, 2)
})

test("applying a preset creates fresh work placeholders and deletion stays local", () => {
  const storage = memoryStorage()
  const preset = saveAuthorPlaceholderPreset("常用", [{ key: "某某", label: "姓名", prompt: "名字？", mode: "scene", forbidden: ["禁用"] }], {
    storage,
    idFactory: () => "preset-a",
  })
  const created = instantiateAuthorPlaceholderPreset(preset, () => "work-placeholder-a")
  assert.deepEqual(created, [{
    id: "work-placeholder-a",
    key: "某某",
    label: "姓名",
    prompt: "名字？",
    mode: "scene",
    forbidden: ["禁用"],
    values: [],
    default: "",
  }])
  assert.equal(deleteAuthorPlaceholderPreset("preset-a", storage), true)
  assert.deepEqual(readAuthorPlaceholderPresets(storage), [])
})
