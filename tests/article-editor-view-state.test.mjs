import test from "node:test"
import assert from "node:assert/strict"

import {
  readArticleEditorViewState,
  writeArticleEditorViewState,
} from "../js/article-editor-view-state.js"

function memoryStorage(initial = null) {
  const values = new Map()
  if (initial !== null) values.set("tuuru_article_editor_view", initial)
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

const emptyState = {
  nodeId:"",
  collapsedChapterIds:[],
  collapsedChoiceNodeIds:[],
  editorTextColor:"",
  sidePane:"outline",
  noteSection:"outline",
}

test("view state is isolated by work and normalizes identifiers", () => {
  const storage = memoryStorage()
  writeArticleEditorViewState("work-a", {
    nodeId:" node-a ",
    collapsedChapterIds:["chapter-a", "chapter-a", 7, ""],
    collapsedChoiceNodeIds:["node-a"],
  }, storage)

  assert.deepEqual(readArticleEditorViewState("work-a", storage), {
    nodeId:"node-a",
    collapsedChapterIds:["chapter-a"],
    collapsedChoiceNodeIds:["node-a"],
    editorTextColor:"",
    sidePane:"outline",
    noteSection:"outline",
  })
  assert.deepEqual(readArticleEditorViewState("work-b", storage), emptyState)
})

test("malformed and outdated records fall back safely", () => {
  assert.deepEqual(readArticleEditorViewState("work", memoryStorage("broken")), emptyState)
  assert.deepEqual(
    readArticleEditorViewState("work", memoryStorage(JSON.stringify({version:2, works:{work:{nodeId:"old"}}}))),
    emptyState,
  )
})

test("partial writes preserve other fields and tolerate denied storage", () => {
  const storage = memoryStorage()
  writeArticleEditorViewState("work", {nodeId:"node-a", collapsedChapterIds:["chapter-a"]}, storage)
  const next = writeArticleEditorViewState("work", {nodeId:"node-b"}, storage)
  assert.deepEqual(next, {
    nodeId:"node-b",
    collapsedChapterIds:["chapter-a"],
    collapsedChoiceNodeIds:[],
    editorTextColor:"",
    sidePane:"outline",
    noteSection:"outline",
  })

  assert.doesNotThrow(() => writeArticleEditorViewState("work", {nodeId:"node-c"}, {
    getItem() { throw new Error("denied") },
    setItem() { throw new Error("denied") },
  }))
})

test("local color and notes pane values normalize without accepting CSS or unknown panes", () => {
  const storage = memoryStorage()
  assert.deepEqual(
    writeArticleEditorViewState("work", {
      editorTextColor:"#5A3344",
      sidePane:"notes",
      noteSection:"foreshadowing",
    }, storage),
    {
      nodeId:"",
      collapsedChapterIds:[],
      collapsedChoiceNodeIds:[],
      editorTextColor:"#5a3344",
      sidePane:"notes",
      noteSection:"foreshadowing",
    },
  )
  assert.deepEqual(
    writeArticleEditorViewState("work", {
      editorTextColor:"red; background:url(x)",
      sidePane:"future",
      noteSection:"future",
    }, storage),
    emptyState,
  )
})
