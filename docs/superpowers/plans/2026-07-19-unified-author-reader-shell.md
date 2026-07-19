# Unified Author and Reader Shell Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current session; do not delegate or commit unless the user asks.

**Goal:** Ship the author studio and reader as two isolated pages of one Tuuru application on port 8765, with one production artifact and accessible two-way product navigation.

**Architecture:** `vite.config.ts` remains the single multi-page Vite configuration and emits both `index.html` and `reader/index.html` into one `dist` directory. The author and reader retain separate runtime modules and local-storage namespaces; a small pure URL helper supplies subdirectory-safe links between their home surfaces.

**Tech Stack:** Vite 6, TypeScript 5.7, native ES modules, Node test runner, JSDOM.

## Global Constraints

- Preserve the existing uncommitted canonical-root change in `vite.config.ts`.
- Do not merge author and reader storage or expose author drafts in the reader library.
- Keep import/export as the publication boundary between authors and readers.
- Do not change editor preview behavior in this phase.
- Keep controls keyboard-visible, touch-safe, responsive, and consistent with the existing gray-pink shell.
- Do not commit or push without explicit user authorization.

---

### Task 1: One reproducible application build

**Files:** `package.json`, `package-lock.json`, `tsconfig.node.json`, `vite.config.ts`, `scripts/verify-builds.mjs`, `tests/build-verification.test.mjs`, `tests/editor-reader-preview.test.mjs`, obsolete `vite.reader.config.ts`, and tracked `dist-editor/` output.

- [x] Require one Vite config, one application build, explicit Node types, and unified `dist` output in tests.
- [x] Run the focused tests and confirm the duplicated build structure fails.
- [x] Implement the unified build and remove obsolete generated output.
- [x] Run focused tests and TypeScript build verification.

### Task 2: Product-level author/reader switching

**Files:** create `js/app-entry-links.js` and `tests/app-entry-links.test.mjs`; modify `js/app.js`, `reader/reader.js`, `css/styles.css`, `reader/reader.css`, `tests/author-shell-visual.test.mjs`, and `tests/reader-home-navigation.test.mjs`.

- [x] Add failing URL, shell, accessibility, and storage-boundary assertions.
- [x] Implement subdirectory-safe author/reader home links and two restrained mode switches.
- [x] Add responsive, focus-visible, current-page, and 44px touch-target styles.
- [x] Run focused navigation and visual tests.

### Task 3: Full application acceptance

- [x] Run `npm run verify` with zero failures.
- [x] Run `npm run build` and inspect both HTML entries under `dist`.
- [x] Serve `dist` on one temporary port and confirm both endpoints return HTTP 200.
- [x] Confirm the temporary server exits and the worktree contains only intended changes.
