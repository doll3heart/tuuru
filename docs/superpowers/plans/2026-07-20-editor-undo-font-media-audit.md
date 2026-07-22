# Editor Undo, Custom Font, and Media Export Audit Implementation Plan

> **For agentic workers:** Execute this plan in the current session. Do not deploy, push, or commit.

**Goal:** Add editor undo/redo controls, make imported TTF/OTF/WOFF fonts actually persist and apply, and verify how embedded images affect exported works.

**Architecture:** Reuse the browser's contenteditable history for undo/redo and explicitly persist the resulting HTML. Store custom font Data URLs in author-local editor settings and rebuild one managed `@font-face` stylesheet whenever the editor renders. Keep author appearance data excluded from reader work exports.

**Tech Stack:** Vanilla JavaScript, contenteditable, localStorage, Node test runner, JSDOM, Vite.

### Task 1: Lock undo/redo behavior with tests

- Extend the editor shell test to require compact undo and redo controls on desktop and mobile.
- Verify clicks call the native editing commands and persist the resulting node HTML.

### Task 2: Persist and install imported fonts

- Add focused tests for font format detection, safe CSS generation, installation, and same-name replacement.
- Store the font Data URL and format alongside its display name.
- Reinstall saved fonts on every editor render and report storage/quota failures clearly.

### Task 3: Verify regressions and document media limits

- Run focused editor/font tests plus the existing article, phone, reader, and data tests.
- Run the production build and `git diff --check`.
- Report the current Base64 export path, size expansion, hard limits, and failure modes without changing deployment state.
