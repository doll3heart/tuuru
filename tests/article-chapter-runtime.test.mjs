import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

import {
  appendArticleChoice,
  continueArticleInteraction,
  currentArticleChapterEntries,
  expandArticleChapterPath,
  nextArticleChapterPath,
  previousArticleChapterPath,
} from "../js/article-chapter-runtime.js"

const nodes = [
  { id: "a", chapterId: "chapter-1", choices: [{ id: "from-a" }] },
  { id: "b", chapterId: "chapter-1", choices: [{ id: "from-b" }] },
  { id: "c", chapterId: "chapter-1" },
  { id: "d", chapterId: "chapter-2" },
  { id: "e", chapterId: "chapter-2" },
]

test("no-choice nodes expand in chapter order until the next choice gate", () => {
  const ordered = [
    { id: "start", chapterId: "chapter-1", choices: [] },
    { id: "paragraph", chapterId: "chapter-1", choices: [] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "answer" }] },
    { id: "hidden-until-answer", chapterId: "chapter-1", choices: [] },
    { id: "other-chapter", chapterId: "chapter-2", choices: [] },
  ]

  assert.deepEqual(
    expandArticleChapterPath(ordered, ["start"]),
    ["start", "paragraph", "gate"],
  )
})

test("no-choice expansion stops at the end of the current chapter", () => {
  const ordered = [
    { id: "start", chapterId: "chapter-1", choices: [] },
    { id: "paragraph", chapterId: "chapter-1", choices: [] },
    { id: "other-chapter", chapterId: "chapter-2", choices: [] },
  ]

  assert.deepEqual(
    expandArticleChapterPath(ordered, ["start"]),
    ["start", "paragraph"],
  )
})

test("choice targets stay on their selected branch before both routes merge into unreferenced prose", () => {
  const ordered = [
    {
      id: "node-1",
      chapterId: "chapter-1",
      choices: [
        { id: "choice-a", targetId: "node-2" },
        { id: "choice-b", targetId: "node-3" },
      ],
    },
    { id: "node-2", chapterId: "chapter-1", choices: [] },
    { id: "node-3", chapterId: "chapter-1", choices: [] },
    { id: "node-4", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    expandArticleChapterPath(ordered, ["node-1"], { selectedChoiceIds: new Set() }),
    ["node-1"],
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["node-1"], 0, "node-2", {
      selectedChoiceIds: new Set(["choice-a"]),
    }).path,
    ["node-1", "node-2", "node-4"],
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["node-1"], 0, "node-3", {
      selectedChoiceIds: new Set(["choice-b"]),
    }).path,
    ["node-1", "node-3", "node-4"],
  )
})

test("same-chapter choices append nodes to one visible page", () => {
  let path = ["a"]
  path = appendArticleChoice(nodes, path, 0, "b").path
  path = appendArticleChoice(nodes, path, 1, "c").path

  assert.deepEqual(path, ["a", "b", "c"])
  assert.deepEqual(currentArticleChapterEntries(nodes, path).map(entry => entry.node.id), ["a", "b", "c"])
})

test("an interactive picture splits one chapter into text pages before and after it", () => {
  const ordered = [
    { id: "before-1", chapterId: "chapter-1" },
    { id: "before-2", chapterId: "chapter-1" },
    { id: "interactive", chapterId: "chapter-1", kind: "interactive-scene" },
    { id: "after-1", chapterId: "chapter-1" },
    { id: "after-2", chapterId: "chapter-1" },
  ]

  assert.deepEqual(
    currentArticleChapterEntries(ordered, ["before-1", "before-2"]).map(entry => entry.node.id),
    ["before-1", "before-2"],
  )
  assert.deepEqual(
    currentArticleChapterEntries(ordered, ["before-1", "before-2", "interactive"]).map(entry => entry.node.id),
    ["before-1", "before-2", "interactive"],
  )
  assert.deepEqual(
    currentArticleChapterEntries(
      ordered,
      ["before-1", "before-2", "interactive", "after-1", "after-2"],
    ).map(entry => entry.node.id),
    ["after-1", "after-2"],
  )
})

test("reselecting an earlier choice truncates its old continuation", () => {
  const result = appendArticleChoice(nodes, ["a", "b", "c"], 0, "c")

  assert.equal(result.chapterChanged, false)
  assert.deepEqual(result.path, ["a", "c"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result.path).map(entry => entry.node.id), ["a", "c"])
})

test("cross-chapter choices retain history but show only the new chapter page", () => {
  const result = appendArticleChoice(nodes, ["a", "b"], 1, "d")

  assert.equal(result.chapterChanged, true)
  assert.deepEqual(result.path, ["a", "b", "d", "e"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result.path).map(entry => entry.node.id), ["d", "e"])
})

test("ordinary interactions continue into following chapter segments", () => {
  const ordered = [
    { id: "reaction", chapterId: "chapter-1", choices: [{ id: "nod", mode: "interaction" }] },
    { id: "paragraph", chapterId: "chapter-1", choices: [] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "branch" }] },
  ]

  const result = continueArticleInteraction(ordered, ["reaction"], 0)

  assert.equal(result.ok, true)
  assert.equal(result.chapterChanged, false)
  assert.deepEqual(result.path, ["reaction", "paragraph", "gate"])
})

test("back from a chapter removes that chapter and restores the prior chapter path", () => {
  const result = previousArticleChapterPath(nodes, ["a", "b", "d", "e"])

  assert.deepEqual(result, ["a", "b"])
  assert.deepEqual(currentArticleChapterEntries(nodes, result).map(entry => entry.node.id), ["a", "b"])
})

test("next chapter follows chapter order, skips empty chapters, and expands its paragraph nodes", () => {
  const ordered = [
    { id: "chapter-1-end", chapterId: "chapter-1", choices: [] },
    { id: "chapter-3-first", chapterId: "chapter-3", choices: [] },
    { id: "chapter-3-second", chapterId: "chapter-3", choices: [] },
  ]
  const chapters = [
    { id: "chapter-1" },
    { id: "chapter-2" },
    { id: "chapter-3" },
  ]

  assert.deepEqual(
    nextArticleChapterPath(ordered, chapters, ["chapter-1-end"]),
    {
      ok: true,
      path: ["chapter-1-end", "chapter-3-first", "chapter-3-second"],
      chapterChanged: true,
    },
  )
  assert.deepEqual(
    nextArticleChapterPath(
      ordered,
      chapters,
      ["chapter-1-end", "chapter-3-first", "chapter-3-second"],
    ),
    {
      ok: false,
      path: ["chapter-1-end", "chapter-3-first", "chapter-3-second"],
      chapterChanged: false,
    },
  )
})

function visibleConditionalIds(ids) {
  return {
    isNodeVisible(node) {
      return !node || node.kind !== "conditional" || ids.includes(node.id)
    },
  }
}

test("branch targets include visible contiguous conditional preludes in structure order", () => {
  const ordered = [
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go", targetId: "target" }] },
    { id: "prelude-1", chapterId: "chapter-1", kind: "conditional" },
    { id: "prelude-2", chapterId: "chapter-1", kind: "conditional" },
    { id: "target", chapterId: "chapter-1", choices: [] },
    { id: "after", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target", visibleConditionalIds(["prelude-1", "prelude-2"])).path,
    ["source", "prelude-1", "prelude-2", "target", "after"],
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target", visibleConditionalIds(["prelude-2"])).path,
    ["source", "prelude-2", "target", "after"],
  )
})

test("conditional nodes keep their structure position after a branch target and never form barriers", () => {
  const ordered = [
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go", targetId: "target" }] },
    { id: "target", chapterId: "chapter-1", choices: [] },
    { id: "after-target", chapterId: "chapter-1", kind: "conditional", choices: [{ id: "invalid-choice" }] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "stop" }] },
  ]

  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target", visibleConditionalIds(["after-target"])).path,
    ["source", "target", "after-target", "gate"],
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target", visibleConditionalIds([])).path,
    ["source", "target", "gate"],
  )
})

test("interaction continuation skips unmet conditionals and stops at the next ordinary choice barrier", () => {
  const ordered = [
    { id: "reaction", chapterId: "chapter-1", choices: [{ id: "nod", mode: "interaction" }] },
    { id: "hidden", chapterId: "chapter-1", kind: "conditional" },
    { id: "paragraph", chapterId: "chapter-1", choices: [] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "branch" }] },
    { id: "after-gate", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    continueArticleInteraction(ordered, ["reaction"], 0, visibleConditionalIds([])).path,
    ["reaction", "paragraph", "gate"],
  )
})

test("conditional targets are rejected and visibility failures fail closed", () => {
  const ordered = [
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go" }] },
    { id: "conditional", chapterId: "chapter-1", kind: "conditional" },
    { id: "target", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "conditional", visibleConditionalIds(["conditional"])),
    { ok: false, path: ["source"], chapterChanged: false },
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target", {
      isNodeVisible() { throw new Error("condition failed") },
    }).path,
    ["source", "target"],
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["missing"], 0, "target"),
    { ok: false, path: ["missing"], chapterChanged: false },
  )
  assert.deepEqual(
    appendArticleChoice(ordered, ["source"], 0, "target").path,
    ["source", "conditional", "target"],
    "omitting options keeps the legacy all-visible behavior",
  )
  assert.deepEqual(
    expandArticleChapterPath(ordered, ["conditional"], { isNodeVisible() { return "yes" } }),
    ["conditional", "target"],
    "a malformed existing path is retained, while a non-true visibility result does not block following prose",
  )
})

test("NEXT starts with a visible conditional and skips chapters with no visible content", () => {
  const ordered = [
    { id: "chapter-1-end", chapterId: "chapter-1", choices: [] },
    { id: "chapter-2-hidden", chapterId: "chapter-2", kind: "conditional" },
    { id: "chapter-3-prelude", chapterId: "chapter-3", kind: "conditional" },
    { id: "chapter-3-first", chapterId: "chapter-3", choices: [] },
  ]
  const chapters = [{ id: "chapter-1" }, { id: "chapter-2" }, { id: "chapter-3" }]

  assert.deepEqual(
    nextArticleChapterPath(ordered, chapters, ["chapter-1-end"], visibleConditionalIds(["chapter-3-prelude"])),
    {
      ok: true,
      path: ["chapter-1-end", "chapter-3-prelude", "chapter-3-first"],
      chapterChanged: true,
    },
  )
})

test("conditional preludes are not duplicated when the retained route already contains one", () => {
  const ordered = [
    { id: "prelude", chapterId: "chapter-1", kind: "conditional" },
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go", targetId: "target" }] },
    { id: "target-prelude", chapterId: "chapter-1", kind: "conditional" },
    { id: "target", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    appendArticleChoice(ordered, ["prelude", "source"], 1, "target", visibleConditionalIds(["prelude", "target-prelude"])).path,
    ["prelude", "source", "target-prelude", "target"],
  )
})

test("duplicate structure IDs are skipped by a bounded forward scan", { timeout: 2000 }, () => {
  const runtimeUrl = new URL("../js/article-chapter-runtime.js", import.meta.url).href
  const duplicateCases = [
    [
      { id: "start", chapterId: "chapter-1" },
      { id: "duplicate", chapterId: "chapter-1" },
      { id: "duplicate", chapterId: "chapter-1" },
      { id: "end", chapterId: "chapter-1" },
    ],
    [
      { id: "start", chapterId: "chapter-1" },
      { id: "duplicate", chapterId: "chapter-1" },
      { id: "middle", chapterId: "chapter-1" },
      { id: "duplicate", chapterId: "chapter-1" },
      { id: "end", chapterId: "chapter-1" },
    ],
  ]
  const script = `
    import { expandArticleChapterPath } from ${JSON.stringify(runtimeUrl)}
    const cases = ${JSON.stringify(duplicateCases)}
    const actual = cases.map(nodes => expandArticleChapterPath(nodes, ["start"]))
    if (JSON.stringify(actual) !== JSON.stringify([["start"], ["start"]])) process.exit(1)
  `
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    timeout: 3000,
  })

  assert.equal(result.error, undefined, result.stderr)
  assert.equal(result.status, 0, result.stderr)
})

test("ambiguous or malformed ordinary nodes stop flow and conditional-prelude scanning", () => {
  const duplicateBarrier = [
    { id: "start", chapterId: "chapter-1", choices: [] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "wait" }] },
    { id: "gate", chapterId: "chapter-1", choices: [{ id: "wait" }] },
    { id: "after", chapterId: "chapter-1", choices: [] },
  ]
  const malformedBarrier = [
    { id: "start", chapterId: "chapter-1", choices: [] },
    { chapterId: "chapter-1", choices: [{ id: "wait" }] },
    { id: "after", chapterId: "chapter-1", choices: [] },
  ]
  const preludeSeparator = [
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go", targetId: "target" }] },
    { id: "prelude", chapterId: "chapter-1", kind: "conditional" },
    { id: "separator", chapterId: "chapter-1", choices: [{ id: "block" }] },
    { id: "separator", chapterId: "chapter-1", choices: [{ id: "block" }] },
    { id: "target", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(expandArticleChapterPath(duplicateBarrier, ["start"]), ["start"])
  assert.deepEqual(expandArticleChapterPath(malformedBarrier, ["start"]), ["start"])
  assert.deepEqual(
    appendArticleChoice(preludeSeparator, ["source"], 0, "target", visibleConditionalIds(["prelude"])).path,
    ["source", "target"],
  )
})

test("chapter boundaries do not make ambiguous chapter content transparent to NEXT or preludes", () => {
  const ordered = [
    { id: "chapter-1-end", chapterId: "chapter-1", choices: [] },
    { id: "chapter-2-gate", chapterId: "chapter-2", choices: [{ id: "block" }] },
    { id: "chapter-2-gate", chapterId: "chapter-2", choices: [{ id: "block" }] },
    { id: "chapter-2-after", chapterId: "chapter-2", choices: [] },
    { id: "chapter-3-first", chapterId: "chapter-3", choices: [] },
  ]
  const crossBoundaryPrelude = [
    { id: "source", chapterId: "chapter-1", choices: [{ id: "go", targetId: "target" }] },
    { id: "other-chapter-prelude", chapterId: "chapter-2", kind: "conditional" },
    { id: "target", chapterId: "chapter-1", choices: [] },
  ]

  assert.deepEqual(
    nextArticleChapterPath(
      ordered,
      [{ id: "chapter-1" }, { id: "chapter-2" }, { id: "chapter-3" }],
      ["chapter-1-end"],
    ).path,
    ["chapter-1-end", "chapter-3-first"],
  )
  assert.deepEqual(
    appendArticleChoice(crossBoundaryPrelude, ["source"], 0, "target", visibleConditionalIds(["other-chapter-prelude"])).path,
    ["source", "target"],
  )
})

test("branch and interaction routes may revisit earlier nodes, including self-loops", () => {
  const loopNodes = [
    { id: "self", chapterId: "chapter-1", choices: [{ id: "again", targetId: "self" }] },
    { id: "later", chapterId: "chapter-1", choices: [{ id: "back", targetId: "self" }] },
  ]

  assert.deepEqual(
    appendArticleChoice(loopNodes, ["self"], 0, "self").path,
    ["self", "self"],
  )
  assert.deepEqual(
    appendArticleChoice(loopNodes, ["self", "later"], 1, "self").path,
    ["self", "later", "self"],
  )
  assert.deepEqual(
    continueArticleInteraction(
      [
        { id: "reaction", chapterId: "chapter-1", choices: [{ id: "continue", mode: "interaction" }] },
        { id: "branch", chapterId: "chapter-1", choices: [{ id: "return", targetId: "reaction" }] },
      ],
      ["reaction", "branch", "reaction"],
      2,
    ).path,
    ["reaction", "branch", "reaction", "branch"],
  )
})

test("expand and NEXT recover from the last valid entry while retaining malformed path tails", () => {
  const ordered = [
    { id: "start", chapterId: "chapter-1", choices: [] },
    { id: "end", chapterId: "chapter-1", choices: [] },
    { id: "ambiguous", chapterId: "chapter-1", choices: [] },
    { id: "ambiguous", chapterId: "chapter-1", choices: [] },
    { id: "next", chapterId: "chapter-2", choices: [] },
  ]
  const rawExpandPath = ["start", "missing"]
  const rawNextPath = ["end", "ambiguous"]

  assert.deepEqual(expandArticleChapterPath(ordered, rawExpandPath), ["start", "missing", "end"])
  assert.deepEqual(rawExpandPath, ["start", "missing"])
  assert.deepEqual(
    nextArticleChapterPath(ordered, [{ id: "chapter-1" }, { id: "chapter-2" }], rawNextPath),
    { ok: true, path: ["end", "ambiguous", "next"], chapterChanged: true },
  )
  assert.deepEqual(rawNextPath, ["end", "ambiguous"])
})
