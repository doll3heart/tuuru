# Interactive Scene Flow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an in-chapter interactive-picture node behave as a standalone page separator that advances through every picture and then resumes at the following ordinary node.

**Architecture:** The shared interactive renderer remains responsible for per-picture exploration and ordered progression. It will expose one explicit `onSceneComplete` boundary when the final picture is ready and its dialogue is activated; the reader owns translating that completion into the existing article-path continuation. The editor and tutorial will describe the limitation that interactive pictures do not own branch choices.

**Tech Stack:** Vanilla JavaScript ES modules, JSDOM integration tests, Node test runner.

## Global Constraints

- A picture with interaction points advances only after every point on that picture has been explored.
- A picture with no interaction points advances on dialogue activation.
- The final ready picture completes the interactive page and resumes at the following article node.
- Interactive-picture nodes do not contain or own story branch choices; authors place branching choices on the following ordinary node.
- Nodes before the interactive picture, the interactive picture, and nodes after it remain in one chapter while rendering as three reader pages.
- Shipped system and tutorial copy must not use gendered relationship metaphors such as “父节点” or “兄弟节点”; use “来源节点”, “并行节点”, or “分流节点”.

---

### Task 1: Shared interactive-scene completion boundary

**Files:**
- Modify: `js/interactive-scene-renderer.js`
- Test: `tests/interactive-scene-renderer.test.mjs`

**Interfaces:**
- Consumes: normalized `scene.stages`, per-stage explored hotspot state, existing dialogue activation.
- Produces: optional `onSceneComplete({ scene, stage })` callback fired once after the final stage is ready.

- [ ] **Step 1: Write failing renderer tests**

Add tests proving a final stage with unexplored points cannot complete, a final empty stage completes on dialogue click, and completion fires only once.

- [ ] **Step 2: Run the focused renderer test**

Run: `node --test tests/interactive-scene-renderer.test.mjs`
Expected: FAIL because final-stage dialogue currently has no completion action.

- [ ] **Step 3: Implement final-stage readiness**

Treat an available `onSceneComplete` callback as a valid dialogue destination on the final stage. Reuse the existing remaining-hotspot calculation and guard callback delivery with a scene-completed flag.

- [ ] **Step 4: Re-run the focused renderer test**

Run: `node --test tests/interactive-scene-renderer.test.mjs`
Expected: PASS.

### Task 2: Full article route through the interactive page

**Files:**
- Modify: `reader/reader.js`
- Modify: `tests/reader-interactive-scene-node.test.mjs`

**Interfaces:**
- Consumes: `onSceneComplete` from Task 1 and `continueArticleChapterPath(nodes, path, scenePathIndex, options)`.
- Produces: the route `1 → selected 2/3 → 4 → interactive 5 → 6`, with page boundaries before and after node 5.

- [ ] **Step 1: Write a failing reader integration test**

Build one chapter containing nodes 1–6, choices A/B to nodes 2/3, merge node 4, interactive node 5 with three pictures, and ordinary node 6. Assert the initial page, selected branch page, blocked and allowed picture progression, and final node-6 page.

- [ ] **Step 2: Run the focused reader test**

Run: `node --test tests/reader-interactive-scene-node.test.mjs`
Expected: FAIL when the final picture dialogue does not leave the interactive page.

- [ ] **Step 3: Connect completion to reader continuation**

Pass `onSceneComplete: closeScene` when mounting a node-owned interactive scene. Keep the top-left exit action as an explicit escape path while final dialogue becomes the narrative completion path.

- [ ] **Step 4: Re-run focused reader tests**

Run: `node --test tests/reader-interactive-scene-node.test.mjs tests/reader-hidden-node-memory.test.mjs`
Expected: PASS.

### Task 3: Author guidance and neutral terminology

**Files:**
- Modify: `js/interactive-scene-editor.js`
- Modify: `js/pages/resources.js`
- Modify: `tests/interactive-scene-editor.test.mjs`
- Modify: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: the completed runtime behavior from Tasks 1–2.
- Produces: editor guidance for ordered completion and branch placement; neutral system terminology.

- [ ] **Step 1: Write failing copy-contract tests**

Assert that the editor explains final-picture continuation to the following ordinary node, explicitly says interactive pictures do not currently carry story branches, and directs branch choices to the following ordinary node. Assert shipped tutorial/system copy contains neither “父节点” nor “兄弟节点”.

- [ ] **Step 2: Run the focused copy tests**

Run: `node --test tests/interactive-scene-editor.test.mjs tests/resources-page.test.mjs`
Expected: FAIL until the new guidance and terminology are present.

- [ ] **Step 3: Update editor and tutorial copy**

Add a concise progression note in the existing picture panel. Replace “兄弟节点” with “并行节点” in route explanations, and document the three-page split created by an interactive-picture node.

- [ ] **Step 4: Re-run focused copy tests**

Run: `node --test tests/interactive-scene-editor.test.mjs tests/resources-page.test.mjs`
Expected: PASS.

### Task 4: Complete verification

**Files:**
- Verify all modified source and tests.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: fresh evidence for the complete repository.

- [ ] **Step 1: Run focused route verification**

Run: `node --test tests/article-chapter-runtime.test.mjs tests/interactive-scene-renderer.test.mjs tests/reader-interactive-scene-node.test.mjs tests/interactive-scene-editor.test.mjs tests/resources-page.test.mjs`
Expected: PASS with zero failures.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with zero failures.

- [ ] **Step 3: Run production verification**

Run: `npm run build:verify`
Expected: TypeScript and both Vite production builds complete successfully.
