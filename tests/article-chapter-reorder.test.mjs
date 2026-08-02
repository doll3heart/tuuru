import test from "node:test"
import assert from "node:assert/strict"

import { reorderArticleChapter } from "../js/article-chapter-reorder.js"

const chapters = [
  { id: "chapter-a", name: "A", accent: "rose" },
  { id: "chapter-b", name: "B", collapsed: true },
  { id: "chapter-c", name: "C", notes: ["keep"] },
]

test("moves a chapter before or after another chapter without cloning metadata", () => {
  const before = reorderArticleChapter(chapters, {
    draggedId: "chapter-c",
    targetId: "chapter-a",
    placement: "before",
  })
  const after = reorderArticleChapter(chapters, {
    draggedId: "chapter-a",
    targetId: "chapter-c",
    placement: "after",
  })

  assert.equal(before.ok, true)
  assert.equal(before.changed, true)
  assert.deepEqual(before.chapters.map(chapter => chapter.id), ["chapter-c", "chapter-a", "chapter-b"])
  assert.equal(before.chapters[0], chapters[2])
  assert.equal(before.chapters[0].notes, chapters[2].notes)

  assert.equal(after.ok, true)
  assert.equal(after.changed, true)
  assert.deepEqual(after.chapters.map(chapter => chapter.id), ["chapter-b", "chapter-c", "chapter-a"])
  assert.equal(after.chapters[2], chapters[0])
})

test("reports self, adjacent, and boundary placements as stable no-ops", () => {
  const cases = [
    { draggedId: "chapter-a", targetId: "chapter-a", placement: "before" },
    { draggedId: "chapter-a", targetId: "chapter-b", placement: "before" },
    { draggedId: "chapter-b", targetId: "chapter-a", placement: "after" },
    { draggedId: "chapter-a", targetId: "chapter-a", placement: "after" },
    { draggedId: "chapter-c", targetId: "chapter-c", placement: "after" },
  ]

  for (const options of cases) {
    const result = reorderArticleChapter(chapters, options)
    assert.equal(result.ok, true)
    assert.equal(result.changed, false)
    assert.deepEqual(result.chapters, chapters)
    assert.notEqual(result.chapters, chapters)
  }
})

test("does not mutate the source chapter array or objects", () => {
  const snapshot = structuredClone(chapters)
  const result = reorderArticleChapter(chapters, {
    draggedId: "chapter-b",
    targetId: "chapter-c",
    placement: "after",
  })

  assert.deepEqual(chapters, snapshot)
  assert.equal(result.chapters[2], chapters[1])
})

test("rejects malformed input, invalid placement, missing ids, and ambiguous ids", () => {
  assert.deepEqual(reorderArticleChapter(null, {}), {
    ok: false,
    reason: "chapters-invalid",
    chapters: null,
  })
  assert.equal(reorderArticleChapter(chapters, {
    draggedId: "chapter-a",
    targetId: "chapter-b",
    placement: "inside",
  }).reason, "placement-invalid")
  assert.equal(reorderArticleChapter(chapters, {
    draggedId: "missing",
    targetId: "chapter-a",
    placement: "before",
  }).reason, "dragged-chapter-not-found")
  assert.equal(reorderArticleChapter(chapters, {
    draggedId: "chapter-a",
    targetId: "missing",
    placement: "after",
  }).reason, "target-chapter-not-found")

  const duplicate = chapters.concat({ id: "chapter-a", name: "Duplicate" })
  assert.equal(reorderArticleChapter(duplicate, {
    draggedId: "chapter-a",
    targetId: "chapter-b",
    placement: "before",
  }).reason, "dragged-chapter-ambiguous")
  assert.equal(reorderArticleChapter(duplicate, {
    draggedId: "chapter-b",
    targetId: "chapter-a",
    placement: "before",
  }).reason, "target-chapter-ambiguous")
})
