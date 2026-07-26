# Hidden Node Reselection And Tutorial Implementation Plan

> **For Codex:** Implement each task in order and verify the reader behavior before updating explanatory copy.

**Goal:** Make hidden-node visibility follow the reader's current selections immediately, then make the tutorial explain placement, movement, conditions, reselection, and troubleshooting precisely.

**Architecture:** Keep route choices and ordinary-interaction selections as the source of truth. When an ordinary choice is changed, rebuild only the conditional-node portions of the current article path while preserving its ordinary and interactive-image route. The tutorial will describe the same runtime model and distinguish default creation position from actual movable reading position.

**Tech Stack:** Browser JavaScript modules, Node test runner, DOM integration fixtures.

---

### Task 1: Reproduce the stale hidden-node bug

- [x] Extend `tests/reader-inline-interaction-groups.test.mjs` with a reader flow that reveals a hidden node, changes the triggering ordinary choice, and expects the hidden node to disappear without losing the later route.
- [x] Change the choice back and expect the hidden node to return.
- [x] Run the focused test and confirm the new assertion fails before implementation.

### Task 2: Reconcile conditional prose after ordinary-choice changes

- [x] Add a pure path-reconciliation helper to `js/article-chapter-runtime.js`.
- [x] Preserve ordinary nodes, interactive-image nodes, branch-choice memory, and the reader's current destination.
- [x] Remove conditional nodes whose conditions are no longer true and reinsert newly eligible conditional nodes at their authored structure positions.
- [x] Invoke the helper when a non-legacy ordinary interaction is reselected.
- [x] Add focused pure-runtime coverage for removal, reinsertion, and route preservation.

### Task 3: Refine hidden-node guidance

- [x] Expand the hidden-node feature entry in `js/pages/resources.js` with creation position, structure-tree movement, placement semantics, and current-selection behavior.
- [x] Add a dedicated hidden-node step and checklist items to the branching tutorial.
- [x] Add detailed FAQ answers for “appears at the end”, moving nodes, reselection, condition timing, and common non-display causes.
- [x] Keep terminology neutral and use “分流节点 / 并行节点” where relationships need names.

### Task 4: Verify the complete change

- [x] Run the focused runtime, reader, tutorial, and release-copy tests.
- [x] Run the full test suite.
- [x] Inspect the working tree and ensure no personal data, local samples, or unrelated files are included.
- [x] Verify the running `127.0.0.1:8765` page is serving the updated assets.
