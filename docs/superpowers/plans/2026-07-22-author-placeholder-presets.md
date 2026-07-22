# Author Placeholder Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authors save, reuse, and delete named local placeholder sets from both article and phone editors without adding them to exported works.

**Architecture:** Store sanitized preset definitions under a dedicated localStorage key in a focused module. Both editors call the same module, clone preset fields with new IDs when applying them, and keep work data separate from author-only preferences.

**Tech Stack:** Browser ES modules, localStorage, existing modal UI, Node test runner, JSDOM.

## Global Constraints

- Never use browser `prompt`, `confirm`, or `alert` for preset management.
- Presets remain local to the author device and are not embedded in work exports.
- Applying a preset appends new placeholders and never overwrites existing work fields.
- Reader-entered `values` and `default` values are not persisted in author presets.

---

### Task 1: Local preset store

**Files:**
- Create: `js/author-placeholder-presets.js`
- Create: `tests/author-placeholder-presets.test.mjs`

**Interfaces:**
- Produces: `readAuthorPlaceholderPresets(storage)`, `saveAuthorPlaceholderPreset(name, placeholders, options)`, `deleteAuthorPlaceholderPreset(id, storage)`, and `instantiateAuthorPlaceholderPreset(preset, idFactory)`.

- [ ] Write failing tests covering malformed storage, field sanitization, same-name replacement, deletion, and fresh IDs when applying.
- [ ] Run `node --test tests/author-placeholder-presets.test.mjs` and confirm failure before implementation.
- [ ] Implement the local-only versioned preset store with guarded storage reads/writes.
- [ ] Re-run the test and confirm all cases pass.

### Task 2: Shared editor UX

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-message-editor.test.mjs`
- Create: `tests/author-placeholder-preset-ui.test.mjs`

**Interfaces:**
- Consumes: the Task 1 preset store.
- Produces: named preset save/apply/delete controls in both author surfaces.

- [ ] Write failing source/UI assertions for both editor entry points and modal-only naming.
- [ ] Add compact preset controls to the article and phone placeholder panels.
- [ ] Save current placeholder definitions after collecting visible edits; append cloned fields with fresh IDs when applying.
- [ ] Confirm deleting a local preset does not mutate either work.
- [ ] Run focused tests, `npm run build:verify`, and `git diff --check`.
