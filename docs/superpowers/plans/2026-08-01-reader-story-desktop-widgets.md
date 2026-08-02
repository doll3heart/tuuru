# Reader Story Desktop Widgets Implementation Plan

**Goal:** Add a reader-side story desktop widget system that turns existing work content and reader progress into configurable phone-home components without copying a single reference layout.

**Architecture:** Keep widget content (`kind`) independent from its visual shell (`skin`). Store the reader's local widget order, visibility, shell and palette inside the existing normalized phone appearance record, render the same model in the live appearance preview and imported-work runtime, and route interactive widgets through the existing phone app opener. Use one focused pure module for schema normalization, content resolution and safe widget markup so the large reader runtime only owns integration and event binding.

**Tech Stack:** Vanilla ES modules, existing reader HTML/CSS, localStorage appearance drafts, Node test runner, JSDOM, Vite.

---

### Task 1: Define the widget model and content resolver

**Files:**
- Create: `reader/phone-desktop-widgets.js`
- Test: `tests/reader-phone-desktop-widgets.test.mjs`

1. Write failing tests covering all 12 content kinds, all 11 visual skins, stable normalization, invalid-data stripping, bounded reader text, automatic story-source resolution and app targets.
2. Implement immutable kind/skin catalogs and default configuration.
3. Implement normalization for enabled state, order, skin, size and palette.
4. Implement story-source resolution from phone data and reader context, with graceful empty states.
5. Implement accessible, escaped widget markup shared by preview and runtime.
6. Run the focused test.

### Task 2: Persist widgets through reader appearance

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/appearance-package.js`
- Modify: `tests/reader-appearance-package.test.mjs`

1. Add failing package tests for widget configuration round-tripping and removal of unknown keys, unsafe images and private activity.
2. Add normalized widget configuration to phone defaults and phone appearance normalization.
3. Whitelist the bounded, visual-only widget configuration in appearance export/import.
4. Preserve widget configuration during reset and draft restore.
5. Run package and draft-session tests.

### Task 3: Render widgets on the phone desktop

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `css/styles.css`
- Test: `tests/reader-phone-desktop-widgets.test.mjs`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`

1. Add failing runtime tests for enabled widget rendering and app routing.
2. Render story widgets above the app grid in the standalone phone using resolved work content.
3. Render deterministic sample content in the appearance preview.
4. Implement all visual shells: polaroid stack, film strip, torn note, envelope, ticket, cassette/record, acrylic, folder tab, capsule, floating text and transparent decoration.
5. Add responsive layout, keyboard focus, reduced-motion and high-contrast-safe states.
6. Keep the existing app icon grid usable and avoid overlap by flowing widgets before the icon desktop area.

### Task 4: Add the appearance workbench controls

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-phone-appearance-dialog.test.mjs`

1. Add a failing dialog test for the new `桌面组件` collapsible section.
2. Add master visibility and palette controls.
3. Add a compact ordered widget list with per-item visibility, shell selector, width selector and move controls.
4. Add a focused editor for the reader note and optional transparent PNG decoration, without exposing arbitrary positioning or CSS per widget.
5. Bind all controls into live preview, undo, draft restore, reset and save.
6. Make the preview click focus the widget section.
7. Run appearance dialog and accessibility/touch-target tests.

### Task 5: Update reader guidance

**Files:**
- Modify: `js/pages/resources.js`
- Modify or create the closest resource-page test under `tests/`

1. Add a concise reader tutorial entry explaining automatic story content, local-only settings, visibility/order, and independent content/skin selection.
2. Add or update the resource assertion.
3. Run the focused resource test.

### Task 6: Verify the complete change

1. Run focused widget, package, appearance-dialog, accessibility and touch-target tests.
2. Run `npm run verify`.
3. Inspect `git diff --check` and `git status --short`.
4. Review desktop and mobile CSS breakpoints for clipping, overlap and touch targets.
5. Report delivered behavior and any intentionally bounded behavior; do not commit or push unless requested.
