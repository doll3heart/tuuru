# Resizable Editor Outline and Work Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the article canvas visually centered on iPad/desktop with a resizable, collapsible outline and add work-wide node search.

**Architecture:** Add a small split-pane controller that owns pointer/keyboard resizing and local UI preference persistence without touching work data. Add a pure search index over chapter names, node titles, visible body text, and choice text; render results inside the outline and reuse the existing node-selection path.

**Tech Stack:** Vanilla JavaScript, Pointer Events, localStorage UI preferences, Node test runner, JSDOM, responsive CSS.

## Global Constraints

- Phone layout at 480px and below keeps the existing 正文/结构 switch.
- Touch targets remain at least 44px; the visual divider may be narrower than its hit area.
- Outline width and collapsed state are device-local UI preferences, not work data.
- Collapsed outline reopens as an overlay and does not shift the centered editor canvas.
- Search never mutates author content.

---

### Task 1: Split-pane interaction

**Files:** Create `js/editor-split-pane.js`; modify `js/pages/editor.js`, `css/styles.css`; test `tests/editor-split-pane.test.mjs` and `tests/article-editor-mobile-shell.test.mjs`.

**Interfaces:** `createEditorSplitPaneController(document, storage)` binds a separator and shell; dragging/arrow keys update `--editor-outline-width`; reaching the collapse threshold marks the shell collapsed.

- [ ] Write failing controller and rendered-shell tests.
- [ ] Run focused tests and confirm the missing divider/collapse behavior fails.
- [ ] Implement pointer capture, keyboard resizing, overlay reopen, and local preference restore.
- [ ] Run focused tests and confirm pass.

### Task 2: Work-wide search

**Files:** Create `js/article-work-search.js`; modify `js/pages/editor.js`, `css/styles.css`; test `tests/article-work-search.test.mjs` and `tests/article-target-picker-integration.test.mjs`.

**Interfaces:** `searchArticleWork(work, query)` returns ranked `{nodeId, title, chapterName, excerpt}` records; selecting a result uses the existing `sl` command.

- [ ] Write failing indexing, HTML-to-text, ranking, empty-query, and click-navigation tests.
- [ ] Run focused tests and confirm failure.
- [ ] Implement the pure search helper and accessible outline search UI.
- [ ] Run focused tests and confirm pass.

### Task 3: Release verification

**Files:** Only the scoped source and tests above.

**Interfaces:** A production build with unchanged work schema and existing phone behavior.

- [ ] Run `npm test`, `npm run build:verify`, and `git diff --check`.
- [ ] Review the staged file list before any commit or deployment.
