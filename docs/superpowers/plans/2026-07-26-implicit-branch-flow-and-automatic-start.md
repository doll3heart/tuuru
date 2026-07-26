# Implicit Branch Flow And Automatic Start Implementation Plan

**Goal:** Make article nodes follow authored reading routes: choice targets are implicitly gated by the selected choice, unreferenced nodes after a branch act as merge/mainline nodes, and the first ordinary node of the earliest chapter is always the story start.

**Architecture:** Keep `startNode` in stored/exported data for compatibility, but derive it from chapter and node order whenever a work is normalized or mutated. In the reader runtime, build an index of incoming branch choices and use the current stable choice-memory IDs to skip unselected sibling targets while continuing to the next unreferenced merge node.

**Tech Stack:** Vanilla JavaScript ES modules, Node test runner, jsdom reader/editor integration tests.

---

### Task 1: Specify implicit branch routing

**Files:**
- Modify: `tests/article-chapter-runtime.test.mjs`
- Modify: `tests/reader-hidden-node-memory.test.mjs`

1. Add a failing runtime test for node 1 with choices A/B targeting nodes 2/3 and an unreferenced node 4.
2. Assert initial rendering stops at node 1.
3. Assert selecting A produces nodes 1, 2, 4 and selecting B produces nodes 1, 3, 4.
4. Add reader coverage so preview/import runtime behavior uses the same selected-choice memory.

### Task 2: Implement implicit route gates

**Files:**
- Modify: `js/article-chapter-runtime.js`
- Modify: `reader/reader.js`

1. Index valid non-interaction choice targets by stable choice ID.
2. During same-chapter continuation, skip incoming targets whose choices were not selected.
3. Continue past skipped sibling targets to the first unreferenced mainline node.
4. Pass the reader's selected choice-ID set into every runtime transition.
5. Preserve explicit hidden-node AND-of-OR conditions and interaction choice behavior.

### Task 3: Specify and implement the automatic start

**Files:**
- Create: `js/article-start-node.js`
- Create: `tests/article-start-node.test.mjs`
- Modify: `js/data.js`
- Modify: `js/article-save-adapter.js`
- Modify: `js/work-schema.js`
- Modify: `reader/reader.js`
- Modify: `js/pages/editor.js`
- Modify: affected start-node integration tests

1. Add failing tests that the start is the first ordinary node of the earliest non-empty authored chapter, regardless of the stored legacy `startNode`.
2. Skip hidden conditional nodes when deriving a start; fall through empty chapters.
3. Canonicalize `startNode` on load, mutation, save, and export/import normalization.
4. Make the reader derive the initial node instead of trusting a manually stored value.
5. Remove the standalone “set start” picker; node/chapter reordering becomes the supported way to change the start.
6. Keep the automatic start badge visible in the structure tree.

### Task 4: Documentation and verification

**Files:**
- Modify: `js/pages/resources.js`

1. Explain automatic start ordering, implicit choice targets, and post-branch merge nodes in the existing tutorial style.
2. Run focused runtime, reader, schema, persistence, save-adapter, and editor tests.
3. Run the full repository test suite and build/type checks.
