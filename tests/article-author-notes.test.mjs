import test from "node:test"
import assert from "node:assert/strict"

import {
  readArticleAuthorNotes,
  writeArticleAuthorNotes,
} from "../js/article-author-notes.js"

function memoryStorage(initial = null) {
  const values = new Map()
  if (initial !== null) values.set("tuuru_article_author_notes", initial)
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

const emptyNotes = {
  outline:"",
  chapterPlans:"",
  foreshadowing:"",
  worldbuilding:"",
  locations:"",
  characters:"",
  relationships:"",
  ideas:"",
}

test("private writing material is isolated by work and unknown fields are dropped", () => {
  const storage = memoryStorage()
  const notes = writeArticleAuthorNotes("work-a", {
    outline:"第一幕",
    worldbuilding:"雨季持续三个月",
    future:"drop",
  }, storage)
  assert.deepEqual(notes, {
    outline:"第一幕",
    chapterPlans:"",
    foreshadowing:"",
    worldbuilding:"雨季持续三个月",
    locations:"",
    characters:"",
    relationships:"",
    ideas:"",
  })
  assert.deepEqual(readArticleAuthorNotes("work-a", storage), notes)
  assert.deepEqual(readArticleAuthorNotes("work-b", storage), emptyNotes)
})

test("partial updates preserve other sections and bound oversized text", () => {
  const storage = memoryStorage()
  writeArticleAuthorNotes("work", {outline:"开场"}, storage)
  const notes = writeArticleAuthorNotes("work", {
    characters:"A".repeat(200_100),
  }, storage)
  assert.equal(notes.outline, "开场")
  assert.equal(notes.characters.length, 200_000)
})

test("version 1 notes migrate into the refined section set without losing authored text", () => {
  const storage = memoryStorage(JSON.stringify({
    version:1,
    works:{
      work:{
        outline:"主线",
        worldbuilding:"规则",
        characters:"人物",
        ideas:"灵感",
      },
    },
  }))

  assert.deepEqual(readArticleAuthorNotes("work", storage), {
    outline:"主线",
    chapterPlans:"",
    foreshadowing:"",
    worldbuilding:"规则",
    locations:"",
    characters:"人物",
    relationships:"",
    ideas:"灵感",
  })

  const notes = writeArticleAuthorNotes("work", {
    chapterPlans:"第一章",
    foreshadowing:"旧信",
    locations:"北港",
    relationships:"A → B",
  }, storage)
  assert.equal(notes.chapterPlans, "第一章")
  assert.equal(notes.foreshadowing, "旧信")
  assert.equal(notes.locations, "北港")
  assert.equal(notes.relationships, "A → B")
  assert.equal(JSON.parse(storage.getItem("tuuru_article_author_notes")).version, 2)
})

test("malformed records and denied storage fail safely", () => {
  assert.deepEqual(readArticleAuthorNotes("work", memoryStorage("broken")), emptyNotes)
  assert.doesNotThrow(() => writeArticleAuthorNotes("work", {ideas:"记下来"}, {
    getItem() { throw new Error("denied") },
    setItem() { throw new Error("denied") },
  }))
})
