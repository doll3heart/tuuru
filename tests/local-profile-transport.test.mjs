import test from "node:test"
import assert from "node:assert/strict"

import {
  LOCAL_PROFILE_FORMAT,
  inspectLocalProfile,
  mergeLocalProfile,
  serializeLocalProfile,
} from "../js/local-profile-transport.js"

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)) }
  get length() { return this.map.size }
  key(index) { return Array.from(this.map.keys())[index] ?? null }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(String(key), String(value)) }
  removeItem(key) { this.map.delete(String(key)) }
}

function database(works = [], collections) {
  return JSON.stringify({ version: 1, works, contacts: [], groups: [], ...(collections ? { collections } : {}) })
}

test("local profile package round-trips author works, author settings, and reader data", () => {
  const source = new MemoryStorage({
    tuuru_works: database([{ id: "author-1", type: "article", title: "作品", nodes: [], chapters: [] }]),
    tuuru_theme: "tuuru",
    tuuru_author_placeholder_presets: JSON.stringify({ version: 1, presets: [] }),
    moirain_profile: JSON.stringify({ readerId: "小雨" }),
    moirain_work_reader1: JSON.stringify({ id: "reader1", type: "phone", title: "读者作品" }),
    unrelated_secret: "must-not-export",
  })

  const raw = serializeLocalProfile(source, new Date("2026-07-22T12:00:00.000Z"))
  const inspected = inspectLocalProfile(raw)
  assert.equal(inspected.ok, true)
  assert.equal(inspected.profile.format, LOCAL_PROFILE_FORMAT)
  assert.equal(inspected.summary.authorWorkCount, 1)
  assert.equal(inspected.summary.readerEntryCount, 2)
  assert.equal(raw.includes("unrelated_secret"), false)

  const target = new MemoryStorage({ tuuru_works: database([]) })
  const result = mergeLocalProfile(target, inspected.profile)
  assert.equal(result.importedAuthorWorks, 1)
  assert.equal(result.importedReaderEntries, 2)
  assert.equal(JSON.parse(target.getItem("moirain_profile")).readerId, "小雨")
  assert.equal(JSON.parse(target.getItem("moirain_work_reader1")).title, "读者作品")
})

test("local profile inspection rejects malformed and unsupported packages", () => {
  assert.equal(inspectLocalProfile("not json").ok, false)
  assert.equal(inspectLocalProfile(JSON.stringify({ format: LOCAL_PROFILE_FORMAT, version: 99 })).ok, false)
})

test("local profile import preserves conflicts and remaps conflicting work ids", () => {
  const existingAuthor = { id: "same", type: "article", title: "保留", nodes: [], chapters: [] }
  const importedAuthor = { id: "same", type: "article", title: "导入", nodes: [], chapters: [] }
  const target = new MemoryStorage({
    tuuru_works: database([existingAuthor]),
    tuuru_theme: "sky",
    moirain_profile: JSON.stringify({ readerId: "现有读者" }),
    moirain_work_same: JSON.stringify({ id: "same", type: "article", title: "现有阅读作品" }),
  })
  const source = new MemoryStorage({
    tuuru_works: database([importedAuthor]),
    tuuru_theme: "tuuru",
    moirain_profile: JSON.stringify({ readerId: "导入读者" }),
    moirain_work_same: JSON.stringify({ id: "same", type: "article", title: "导入阅读作品" }),
  })

  const profile = inspectLocalProfile(serializeLocalProfile(source, new Date("2026-07-22T12:00:00.000Z"))).profile
  const result = mergeLocalProfile(target, profile)
  const works = JSON.parse(target.getItem("tuuru_works")).works
  assert.equal(works.length, 2)
  assert.notEqual(works[1].id, "same")
  assert.equal(target.getItem("tuuru_theme"), "sky")
  assert.equal(JSON.parse(target.getItem("moirain_profile")).readerId, "现有读者")
  assert.equal(result.preservedConflicts >= 2, true)
  assert.equal(Array.from(target.map.keys()).some(key => key.startsWith("moirain_work_same-imported-")), true)
})

test("local profile import remaps author and reader collection members with conflicting works", () => {
  const target = new MemoryStorage({
    tuuru_works: database([{ id: "same", type: "article", title: "现有", nodes: [], chapters: [] }]),
    moirain_work_same: JSON.stringify({ id: "same", type: "article", title: "现有阅读作品" }),
    moirain_collections: JSON.stringify([]),
  })
  const collection = { id: "c1", title: "导入集", workIds: ["same"] }
  const source = new MemoryStorage({
    tuuru_works: database([{ id: "same", type: "article", title: "导入", nodes: [], chapters: [] }], [collection]),
    moirain_work_same: JSON.stringify({ id: "same", type: "article", title: "导入阅读作品" }),
    moirain_collections: JSON.stringify([collection]),
  })
  const profile = inspectLocalProfile(serializeLocalProfile(source, new Date("2026-07-22T12:00:00.000Z"))).profile
  mergeLocalProfile(target, profile)

  const authorDatabase = JSON.parse(target.getItem("tuuru_works"))
  assert.match(authorDatabase.collections[0].workIds[0], /^same-imported-/)
  const readerCollections = JSON.parse(target.getItem("moirain_collections"))
  assert.match(readerCollections[0].workIds[0], /^same-imported-/)
})
