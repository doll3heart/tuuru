# Reader Appearance Workbench Implementation Plan

> For agentic workers: execute this plan incrementally, preserve unrelated dirty-worktree changes, and do not commit or push unless the user asks.

**Goal:** Turn the existing reader-side article and phone appearance controls into detailed, live-preview workbenches, including safely scoped reader-authored CSS.

**Architecture:** Keep the existing `readerSettings` and `phoneCustom` local-storage records as the single sources of truth. Extend their normalized fields, express built-in appearance choices through scoped CSS variables, and compile reader CSS through a small pure allowlist-style transformer before injecting it into either the article or phone scope. Article controls continue auto-saving; phone controls remain a draft until the reader chooses Save.

**Tech Stack:** Vanilla JavaScript modules, CSS custom properties, jsdom integration tests, Node test runner.

**Global constraints:**

- Preserve the shared author/reader phone UI and only add reader-owned overrides.
- Do not store reader appearance in work exports.
- Keep article and phone custom CSS isolated from the rest of the reader shell.
- Reject external URLs, at-rules, fixed/sticky positioning, z-index, pointer-event overrides, and malformed CSS.
- Keep every existing reader setting backward compatible.
- Do not commit or push from this dirty worktree.

## Task 1: Add a scoped reader CSS compiler

**Files:**

- Create: `reader/custom-style.js`
- Create: `tests/reader-custom-style.test.mjs`

**Steps:**

1. Add failing tests for selector scoping, `:scope`, selector lists, comments and strings.
2. Add failing tests for malformed rules, nested blocks, external URLs, at-rules, forbidden declarations, and length limits.
3. Implement a dependency-free parser for ordinary selector/declaration rules.
4. Return structured validation results for UI status messages and preserve the raw valid CSS for storage.
5. Run the focused test file.

## Task 2: Extend the article appearance model and CSS variables

**Files:**

- Modify: `reader/article-appearance.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-article-appearance-dialog.test.mjs`

**Steps:**

1. Add normalized fields for title size/weight/spacing, metadata spacing, section spacing, image radius, choice spacing/radius, accent color, and custom CSS.
2. Add model boundary and invalid-value tests.
3. Replace matching hardcoded article values with backward-compatible CSS variable fallbacks.
4. Ensure every article root carries a stable custom-CSS scope class.
5. Run the focused model and dialog tests.

## Task 3: Upgrade the article settings sheet into a live workbench

**Files:**

- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-article-appearance-dialog.test.mjs`

**Steps:**

1. Replace the miniature paragraph preview with a compact article preview using the real article component classes.
2. Split controls into readable groups for type, layout, title/structure, choices/images, colors/background, and advanced CSS.
3. Apply every built-in control to both the preview and the open article in real time.
4. Validate and scope custom CSS before saving or injecting it; keep the last valid style when the draft is invalid.
5. Make the preview sticky in a two-column desktop sheet and single-column on narrow screens.
6. Verify keyboard dismissal, focus restoration, touch targets, and live status announcements.

## Task 4: Upgrade phone appearance into a draft-safe live workbench

**Files:**

- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-phone-appearance-dialog.test.mjs`

**Steps:**

1. Add a defensive phone-custom normalizer for visual fields and custom CSS.
2. Apply existing icon radius, material opacity, font size, and system toggles consistently in the real phone and preview.
3. Replace the inline modal with the same accessible workbench shell and a live phone preview.
4. Keep edits local to the dialog until Save; Cancel, overlay dismissal, and Escape must restore the exact prior stored data and active CSS.
5. Add scoped CSS editing, validation status, a starter snippet, and a one-click clear action.
6. Test live preview, save, cancel, invalid CSS, and scope isolation.

## Task 5: Responsive polish and full verification

**Files:**

- Modify as needed: `reader/reader.css`
- Verify: all changed reader files and tests

**Steps:**

1. Check desktop, phone-width, short-height, and reduced-motion layouts.
2. Run focused reader appearance tests.
3. Run the full Node test suite.
4. Run `npm run build:verify`.
5. Review the final diff for unrelated changes and summarize only the files touched by this work.
