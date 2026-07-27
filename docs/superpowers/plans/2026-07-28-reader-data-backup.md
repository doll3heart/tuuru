# Reader Data Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers export and safely merge a small backup containing reader-owned progress and portable settings without including works, passwords, caches, images, or fonts.

**Architecture:** Add a focused package module that sanitizes and serializes reader-library metadata, identity groups, profile text, placeholder presets, and portable appearance values. Import first inspects the package, shows a bounded summary, and only installs after an explicit inline confirmation. Library conflicts merge per work and slot by `updatedAt`; personal text and portable appearance values come from the selected backup while existing local binary assets remain untouched.

**Tech Stack:** Vanilla JavaScript, existing reader library/appearance normalizers, localStorage, Blob download helper, Node test runner, JSDOM, Vite.

## Global Constraints

- Never include cached work bodies, collection passwords, work passwords, media, avatars, wallpapers, icons, embedded fonts, or other binary assets.
- Keep the serialized package below 2 MiB.
- Import must be atomic and restore previous storage values if any write fails.
- Existing progress wins when its slot `updatedAt` is newer than the backup.
- Do not add a new top-level page; use a collapsible inline panel in the existing bookshelf header.
- Selecting a file only previews it; importing requires a second explicit action.

---

### Task 1: Define the portable backup package

**Files:**
- Create: `reader/reader-data-package.js`
- Test: `tests/reader-data-package.test.mjs`

**Interfaces:**
- Produces: `serializeReaderDataPackage(input, exportedAt)`, `inspectReaderDataPackage(input)`, and `mergeReaderDataPackage(current, incoming)`.

- [ ] Write failing tests covering round trips, excluded sensitive fields, malformed versions, size limits, and accessor-safe inspection.
- [ ] Run `node --test tests/reader-data-package.test.mjs` and confirm it fails before implementation.
- [ ] Implement bounded profile/preset/appearance projection and reader-library normalization.
- [ ] Implement per-book/per-slot timestamp merging and portable appearance asset preservation.
- [ ] Run the focused test and confirm it passes.

### Task 2: Install packages atomically

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-data-backup-ui.test.mjs`

**Interfaces:**
- Consumes: the package module and existing localStorage helpers.
- Produces: one atomic storage update for library, profile text, presets, article settings, and phone settings.

- [ ] Write a failing test that imports a package and verifies progress merge, profile/settings restore, asset preservation, and rollback on storage failure.
- [ ] Add the storage snapshot/rollback installer in the reader runtime.
- [ ] Run focused package and UI tests.

### Task 3: Add the refined bookshelf control

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-data-backup-ui.test.mjs`

**Interfaces:**
- Produces: a `阅读数据` header action and an inline, keyboard-accessible export/import panel.

- [ ] Add a compact secondary header action beside `导入作品`.
- [ ] Add the inline explanation, export/import actions, hidden file input, preview summary, and explicit `合并恢复` action.
- [ ] Refresh the bookshelf after successful import and return focus to the panel trigger.
- [ ] Add mobile wrapping, focus-visible, dark-theme-compatible, and status styles using existing tokens.
- [ ] Verify export filenames, accepted file type, Escape/close behavior, and no nested-card styling.

### Task 4: Verify compatibility and production output

**Files:**
- Verify only.

**Interfaces:**
- Produces: fresh test, browser, and build evidence.

- [ ] Run `node --test tests/reader-data-package.test.mjs tests/reader-data-backup-ui.test.mjs tests/reader-library-state.test.mjs`.
- [ ] Verify the inline panel at desktop and 390 px widths, including a real export and import preview.
- [ ] Run `npm test`.
- [ ] Run `npm run build:verify`.
- [ ] Run `git diff --check` for all scoped files and confirm temporary test files are absent.
