# Reader Phone Multi-Screen Home Layout Implementation Plan

**Goal:** Repair V7 widget composition drift and turn the phone appearance preview into a persistent, accessible multi-screen home editor where every App and installed widget can be moved, reordered, and dragged across screens.

**Architecture:** Add a small pure layout module that normalizes the reader-owned home layout, assigns footprints, resolves collisions, and moves items across pages. Render Apps and widgets through one paged desktop shell in both the appearance preview and the real reader phone; attach pointer/keyboard editing only inside the appearance workbench so normal App/widget activation remains intact elsewhere.

**Tech Stack:** Vanilla ES modules, DOM Pointer Events, CSS grid-position variables, Node test runner, JSDOM, Vite browser QA.

---

### Task 1: Lock the V7 positioning regression

- [x] Add a focused CSS regression assertion proving structural V7 text layers are not overridden by a generic descendant rule.
- [x] Correct the generic V7 text-layer selector without changing approved product compositions.
- [x] Verify the countdown, player, date, and schedule wrappers compute to their intended positioning mode in the real browser.

### Task 2: Introduce a safe reader-owned home layout model

- [x] Add pure helpers for layout defaults, legacy migration, page normalization, item footprints, collision-safe placement, and cross-page movement.
- [x] Key Apps by stable App type/id and widgets by stable V7 product id; reject duplicate, unknown, and unsafe persisted entries.
- [x] Preserve all enabled items by placing collisions and newly installed widgets into the first available page, creating a page when necessary.
- [x] Cover same-page swap/reflow, cross-page move, edge-page creation, removal, and malformed data with unit tests.

### Task 3: Render one paged desktop for Apps and widgets

- [x] Replace the separate widget flow and App grid in the appearance preview with a shared horizontal page track.
- [x] Use the same page layout in the standalone/overlay reader phone, with a non-editing page switcher and unchanged App/widget activation behavior.
- [x] Add screen dots, previous/next controls, page labels, selected/dragging states, and restrained 150–250 ms motion.
- [x] Keep photo slots reader-supplied only and retain every V7 product's canonical half/wide dimensions.

### Task 4: Add direct manipulation in the appearance workbench

- [x] Bind pointer dragging to every App and installed widget, with pointer capture, a movement threshold, grid snapping, collision resolution, and a visible drop target.
- [x] Switch screens while dragging over the left/right edge and allow creating the next screen from the final right edge.
- [x] Add keyboard movement and explicit screen navigation so the editor is usable without drag gestures.
- [x] Persist each accepted move into the draft, support the existing undo stack, and rerender without losing the active screen.

### Task 5: Persist, migrate, and verify the complete flow

- [x] Include the home layout in reader appearance save/restore/export/import while continuing to omit private photos.
- [x] Add JSDOM integration coverage for App movement, widget movement, multi-screen persistence, undo, and saved reader parity.
- [x] Run focused tests, the full verification suite, and production build.
- [x] Browser-test desktop and narrow layouts: add a V7 component, drag an App, drag a widget to screen 2, save, reopen, and activate a functional widget.
