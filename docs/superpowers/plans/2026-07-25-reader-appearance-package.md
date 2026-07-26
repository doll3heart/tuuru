# Reader Appearance Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers export and import one portable appearance package without including identity, reading activity, works, or other personal records.

**Architecture:** Add a pure package boundary that serializes only explicit article and phone appearance allowlists. The reader UI calls that boundary from both appearance workbenches, downloads one JSON file, and imports it only after format validation and normalization through the existing appearance models.

**Tech Stack:** Vanilla JavaScript modules, localStorage, Blob/FileReader downloads, CSS, jsdom, Node test runner.

## Global Constraints

- The package must exclude reader nickname/ID, avatar, bio, work data, shelf data, passwords, reading progress, choice history, and device identifiers.
- The reader profile cover (`topBgImage`) is an appearance asset and is included.
- Reader-uploaded wallpaper, font, and icon assets are appearance data and may be included with an explicit sharing reminder.
- Import must ignore unknown fields, reject unsupported versions, and never replace unrelated local reader data.
- Article and phone appearance settings remain reader-owned and never enter a work export.
- Do not commit or push from the existing dirty worktree.

---

### Task 1: Strict appearance package boundary

**Files:**
- Create: `reader/appearance-package.js`
- Create: `tests/reader-appearance-package.test.mjs`

**Interfaces:**
- Produces: `createReaderAppearancePackage({ article, phone })`
- Produces: `serializeReaderAppearancePackage(input)`
- Produces: `inspectReaderAppearancePackage(input)`
- Produces: constants `READER_APPEARANCE_PACKAGE_FORMAT`, `READER_APPEARANCE_PACKAGE_VERSION`, and `READER_APPEARANCE_PACKAGE_MAX_BYTES`

- [ ] Write failing tests proving a complete visual package round-trips and identity/activity fields never appear in serialized output.
- [ ] Write failing tests for unknown-field stripping, malformed JSON, unsupported versions, excessive size, and prototype-like keys.
- [ ] Run `node --test tests/reader-appearance-package.test.mjs` and confirm the tests fail because the module is missing.
- [ ] Implement own-data record copying, exact top-level and nested field allowlists, byte limits, and detached return values.
- [ ] Run `node --test tests/reader-appearance-package.test.mjs` and confirm all package tests pass.

### Task 2: Reader import/export workflow

**Files:**
- Modify: `reader/reader.js`
- Modify: `tests/reader-article-appearance-dialog.test.mjs`
- Modify: `tests/reader-phone-appearance-dialog.test.mjs`

**Interfaces:**
- Consumes: the Task 1 package functions.
- Produces: one export action and one import action in both appearance workbenches.

- [ ] Add failing integration tests for the visible privacy copy, JSON download, file import, and preservation of unrelated `moirain_` storage keys.
- [ ] Import Task 1 helpers and add a shared transfer section labelled “美化包”.
- [ ] Export normalized article plus phone visual settings as `Tuuru-读者美化包.json`.
- [ ] Import a selected `.json`, normalize article and phone settings, save only `moirain_readerSettings` and `moirain_phoneCustom`, reapply live styles, and reopen the active workbench.
- [ ] Surface invalid package errors through the existing reader toast/status vocabulary without clearing current appearance.
- [ ] Run the two focused dialog test files and confirm they pass.

### Task 3: Responsive and privacy verification

**Files:**
- Modify: `reader/reader.css`
- Modify: `tests/reader-appearance-package.test.mjs`

**Interfaces:**
- Consumes: the Task 2 transfer markup.
- Produces: responsive, keyboard-visible transfer controls using existing button vocabulary.

- [ ] Add source-contract tests for 44px touch targets, focus-visible state, narrow wrapping, and privacy/supporting copy.
- [ ] Style the transfer row as a compact utility group inside the existing workbench, without adding another modal.
- [ ] Verify desktop and 390px layouts in the local reader.
- [ ] Run `node --test tests/reader-appearance-package.test.mjs tests/reader-article-appearance-dialog.test.mjs tests/reader-phone-appearance-dialog.test.mjs`.
- [ ] Run `npm run verify` and `git diff --check`.

## Self-Review

- Spec coverage: the package has a strict appearance-only allowlist; identity and activity fields are explicitly excluded; both article and phone workbenches expose import/export.
- Placeholder scan: no deferred implementation steps or unspecified validation remain.
- Type consistency: Task 2 consumes exactly the package APIs defined in Task 1; both settings records are normalized before storage.
