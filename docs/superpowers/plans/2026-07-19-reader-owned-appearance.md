# Reader-Owned Appearance Implementation Plan

> **For agentic workers:** Execute inline in the current session. Do not delegate, commit, or push unless the user explicitly asks.

**Goal:** Give readers durable control over article typography, colors, layout, and backgrounds without allowing authors or imported works to override those preferences.

**Architecture:** A small pure appearance model owns defaults, validation, migration, and theme resolution. `reader/reader.js` consumes the normalized model, exposes one accessible article-appearance sheet from both the beauty hub and live reading view, and applies settings to a dedicated background layer below reading content.

**Tech Stack:** Native ES modules, localStorage, JSDOM, Node test runner, Vite 6.

## Global Constraints

- Do not add author-controlled reading appearance.
- Do not change import/export work schemas or reader/author storage isolation.
- Do not implement watermarking in this phase.
- Keep every setting local to the reader and resilient to corrupt legacy storage.
- Keep controls keyboard-visible, mobile touch-safe, and usable with reduced motion.
- Preserve all existing uncommitted work and do not commit or push.

---

### Task 1: Safe article appearance model

**Files:** Create `reader/article-appearance.js` and `tests/reader-article-appearance.test.mjs`; modify `reader/reader.js`.

**Interfaces:**

```js
normalizeReaderAppearance(candidate) // -> complete detached settings object
resolveReaderAppearanceTheme(settings) // -> { backgroundColor, textColor }
```

- [x] Write tests for defaults, numeric clamps, enum fallbacks, unsafe images, custom colors, and detached custom-font arrays.
- [x] Run the model test and confirm the missing module fails.
- [x] Implement the pure model and route `getReaderSettings()` through it.
- [x] Run the model test and existing reader setting tests.

### Task 2: Reader beauty hub and article sheet

**Files:** Modify `reader/reader.js`, `reader/reader.css`, `tests/phone-reader-owned-controls.test.mjs`, and create `tests/reader-article-appearance-dialog.test.mjs`.

**Required controls:**

```text
Typography: font, size, line height, letter spacing, paragraph spacing
Layout: content width, horizontal margin, alignment, first-line indent
Surface: preset/custom colors, background image, fit, overlay strength
Motion: typing effect and speed
```

- [x] Add failing integration assertions for the third beauty-hub entry, accessible dialog semantics, live preview, persistence, reset, and Escape/focus restoration.
- [x] Add a dedicated article background layer and apply normalized settings below content.
- [x] Expand the sheet with the required controls and safe local-image/URL handling.
- [x] Add desktop and bounded-phone styles with 44px controls and visible focus.
- [x] Run the focused appearance, beauty-hub, viewport, and contrast tests.

### Task 3: Acceptance

**Files:** Final review of all modified files.

- [x] Run `npm run verify` and require zero failures.
- [x] Run `npm run build` and inspect both unified HTML entries.
- [x] Request both `http://127.0.0.1:8765/` and `/reader/index.html` from the already-running development server.
- [x] Run `git diff --check`, confirm port 8765 remains listening, and review only intended changes.
