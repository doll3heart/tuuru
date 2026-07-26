# Article Chapter Linear Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the article model where a chapter is one reader page and its ordinary nodes are ordered text segments that continue automatically until the next choice gate.

**Architecture:** Keep `_articlePath` as the active route, but expand each route entry through following nodes in the same chapter while the current node has no choices. Branch choices jump to an anchor node and then expand; ordinary interactions record the response and continue from the next ordered node. Reader output uses the chapter name as its only structural heading.

**Tech Stack:** Browser ES modules, vanilla JavaScript, Node.js test runner, JSDOM.

## Global Constraints

- Preserve the existing authored `nodes` array as the canonical chapter order.
- Automatic continuation never crosses a chapter boundary.
- Stop automatic continuation at a node with any option group or at an interactive-scene node.
- Preserve earlier route truncation when a reader reselects an earlier option.
- Do not display author-facing node titles in the reader.
- Do not commit because the shared worktree contains unrelated user changes.

---

### Task 1: Chapter path expansion

**Files:**
- Modify: `js/article-chapter-runtime.js`
- Test: `tests/article-chapter-runtime.test.mjs`

**Interfaces:**
- Produces: `expandArticleChapterPath(nodes, path) -> Array<string>`
- Produces: `continueArticleInteraction(nodes, path, sourcePathIndex) -> { ok, path, chapterChanged }`
- Updates: `appendArticleChoice(nodes, path, sourcePathIndex, targetId)` so its returned path includes automatic same-chapter continuation.

- [ ] **Step 1: Write failing traversal tests**

Add tests proving that `["a"]` expands through following no-choice nodes, stops after including the next choice-bearing node, never crosses into another chapter, and that an ordinary interaction continues from its source to the next segment.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/article-chapter-runtime.test.mjs`

Expected: FAIL because `expandArticleChapterPath` and `continueArticleInteraction` are not exported.

- [ ] **Step 3: Implement ordered same-chapter expansion**

Use the node order inside each chapter. Beginning at the last valid path entry, append the next same-chapter node while the current node has no choices. Include the next node before checking whether it is a choice or interactive-scene barrier.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/article-chapter-runtime.test.mjs`

Expected: all chapter runtime tests pass.

### Task 2: Reader integration and heading semantics

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: `expandArticleChapterPath` and `continueArticleInteraction` from Task 1.
- Produces: automatic initial chapter expansion, automatic continuation after ordinary interaction, and chapter-only headings.

- [ ] **Step 1: Write failing reader tests**

Add a work containing two no-choice nodes in one chapter and assert that both contents render immediately, only the chapter title is rendered, `.article-node-title` is absent, and the home action appears only after the final same-chapter node has been included. Update the ordinary-interaction test to include a following node and require that clicking an option reveals it.

- [ ] **Step 2: Run the reader test and verify failure**

Run: `node --test tests/reader-critical-flow.test.mjs`

Expected: FAIL because only the first node renders and its node title remains visible.

- [ ] **Step 3: Integrate path expansion**

Expand `_articlePath` before resolving the active node, use `continueArticleInteraction` after an ordinary interaction selection, remove the `<h2 class="article-node-title">` emission, and retain the chapter `<h1 class="article-title">`.

- [ ] **Step 4: Run focused reader and runtime tests**

Run: `node --test tests/article-chapter-runtime.test.mjs tests/reader-critical-flow.test.mjs`

Expected: all focused tests pass.

### Task 3: Regression verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed runtime and reader behavior from Tasks 1 and 2.

- [ ] **Step 1: Run related article suites**

Run: `node --test tests/article-chapter-runtime.test.mjs tests/article-reader-navigation.test.mjs tests/reader-critical-flow.test.mjs tests/acceptance-sample-works.test.mjs tests/reader-interactive-scene-node.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run the full repository test command**

Run: `npm test`

Expected: exit code 0 with no failing tests.

- [ ] **Step 3: Run whitespace validation**

Run: `git diff --check`

Expected: no whitespace errors in the changed files.
