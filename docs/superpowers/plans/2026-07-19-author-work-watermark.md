# Author Work Watermark Implementation Plan

> **For agentic workers:** Execute inline in the current session. Do not delegate, commit, or push unless the user explicitly asks.

**Goal:** Let authors attach an attribution watermark to a work that survives JSON/PNG sharing and renders below reader content without restoring author control over reading appearance.

**Architecture:** `js/work-watermark.js` owns defaults, limits, and normalization. The author work-info dialog edits one normalized `watermark` field through the existing atomic metadata mutation. Import validation sanitizes that field, while the reader renders a pointer-inert layer for article and phone works beneath interactive content.

**Tech Stack:** Native ES modules, localStorage, FileReader, JSDOM, Node test runner, Vite 6.

## Global Constraints

- Keep the project pure local with no backend or remote upload.
- Do not let watermark settings override reader typography, margins, colors, or backgrounds.
- Carry watermark data through both JSON and PNG exports.
- Do not expose a reader-side watermark disable control.
- Accept embedded PNG, JPEG, or WebP images up to 1 MiB.
- Keep the work schema backward-compatible with works that have no watermark.
- Preserve all existing uncommitted work and do not commit or push.

---

### Task 1: Safe watermark model and work persistence

**Files:** Create `js/work-watermark.js`, `tests/work-watermark.test.mjs`; modify `js/work-schema.js`, `js/home-work-mutations.js`, `tests/home-work-mutations.test.mjs`.

**Interfaces:**

```js
normalizeWorkWatermark(candidate) // -> complete detached settings
hasRenderableWorkWatermark(candidate) // -> boolean
WORK_WATERMARK_IMAGE_MAX_BYTES // 1048576
```

- [x] Write failing tests for defaults, enum fallbacks, numeric clamps, text limits, embedded-image limits, detachment, import normalization, and atomic metadata persistence.
- [x] Run the focused tests and confirm the model is missing.
- [x] Implement the model and normalize optional watermark data during work validation.
- [x] Add `watermark` to the guarded home-info patch and rerun focused tests.

### Task 2: Author work-info controls

**Files:** Modify `js/pages/home.js`, `css/styles.css`; create `tests/work-watermark-ui.test.mjs`.

- [x] Add failing assertions for named controls, 44px touch targets, visible focus, preview, image errors, and the normalized save patch.
- [x] Add progressive controls for enable, text/image, opacity, single/full coverage, position, full-screen pattern, and spacing.
- [x] Add an inline preview and safe local-image selection/clearing without placing large Data URLs in form HTML.
- [x] Keep the work-info dialog scrollable and usable at 320–480px widths.
- [x] Run the author watermark UI and mutation tests.

### Task 3: Reader watermark layer and acceptance

**Files:** Modify `reader/reader.js`, `reader/reader.css`; create `tests/reader-work-watermark.test.mjs`.

- [x] Add failing article and phone reader assertions for text/image, single/full layout, opacity, placement, pattern, spacing, and pointer-inert layering.
- [x] Render the normalized watermark below article content and inside phone frames, including App panels and return-to-desktop flows.
- [x] Confirm reader appearance changes do not remove or restyle the watermark.
- [x] Run focused reader, import/export, viewport, and contrast tests.
- [x] Run `npm run verify`, `npm run build`, exact 8765 endpoint checks, and `git diff --check`.
