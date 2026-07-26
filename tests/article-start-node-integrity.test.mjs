import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage

const { addNode, createConditionalArticleNode, deleteNode, getWork, updateWork } = await import("../js/data.js")

function seed(nodes, startNode, schemaVersion = 1) {
  localStorage.setItem("tuuru_works", JSON.stringify({
    works: [{
      id: "work-a",
      schemaVersion,
      type: "article",
      title: "Article",
      chapters: [{ id: "chapter-a", name: "Chapter" }],
      scenes: [],
      placeholders: [],
      phoneModules: [],
      nodes,
      startNode,
    }],
    contacts: [],
    groups: [],
  }))
}

function node(id, choices = []) {
  return {
    id,
    title: id,
    content: "",
    scene: "",
    chapterId: "chapter-a",
    choices,
  }
}

test("deleting the final node clears startNode and the next node repairs it", () => {
  seed([node("node-a")], "node-a")

  deleteNode("work-a", "node-a")
  assert.equal(getWork("work-a").startNode, "")

  const created = addNode("work-a")
  assert.ok(created?.id)
  assert.equal(getWork("work-a").startNode, created.id)
})

test("adding a node repairs a dangling startNode to the first stable node", () => {
  seed([node("node-a")], "missing-node")

  addNode("work-a")

  assert.equal(getWork("work-a").startNode, "node-a")
})

test("creating a conditional node in an empty article does not create an invalid start", () => {
  seed([], "")

  const created = createConditionalArticleNode("work-a", "chapter-a")

  assert.equal(created, null)
  assert.deepEqual(getWork("work-a").nodes, [])
  assert.equal(getWork("work-a").startNode, "")
})

test("deleting the ordinary start never promotes a conditional node", () => {
  seed([
    { ...node("memory"), kind: "conditional" },
    node("ordinary"),
  ], "ordinary", 3)

  deleteNode("work-a", "ordinary")

  assert.equal(getWork("work-a").startNode, "")
})

test("saving the only node makes it the start node", () => {
  seed([], "")

  const updated = updateWork("work-a", {
    nodes: [{
      ...node("interactive-node"),
      kind: "interactive-scene",
      interactiveSceneId: "scene-a",
    }],
  })

  assert.equal(updated.startNode, "interactive-node")
  assert.equal(getWork("work-a").startNode, "interactive-node")
})

test("adding a node can target a chosen chapter without changing legacy fallback", () => {
  seed([node("node-a")], "node-a")
  const work = getWork("work-a")
  work.chapters.push({ id: "chapter-b", name: "第二章" })
  localStorage.setItem("tuuru_works", JSON.stringify({ works:[work], contacts:[], groups:[] }))

  const targeted = addNode("work-a", undefined, "chapter-b")
  const fallback = addNode("work-a")

  assert.equal(targeted.chapterId, "chapter-b")
  assert.equal(fallback.chapterId, "chapter-a")
})

test("deleting a non-start node preserves the valid start and removes incoming choices", () => {
  seed([
    node("node-a", [
      { id: "choice-a", text: "Stay", targetId: "node-a" },
      { id: "choice-b", text: "Leave", targetId: "node-b" },
    ]),
    node("node-b"),
  ], "node-a")

  deleteNode("work-a", "node-b")

  const work = getWork("work-a")
  assert.equal(work.startNode, "node-a")
  assert.deepEqual(work.nodes[0].choices.map(choice => choice.id), ["choice-a"])
})
