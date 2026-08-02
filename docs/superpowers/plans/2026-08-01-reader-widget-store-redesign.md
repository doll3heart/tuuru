# Reader Widget Store Redesign

**Goal:** Replace the opaque desktop-widget checkbox list with a visual store where readers preview real widget styles before adding them, then manage only the widgets on their desktop.

**Architecture:** Keep `desktopWidgets.items` as the persisted source of truth and treat each item's `enabled` field as whether it is installed. Preserve the legacy top-level `enabled` field for data compatibility, but stop using it as a render gate. Reuse the production widget renderer for store thumbnails so store, phone preview, and runtime cannot drift visually.

**Tech Stack:** Vanilla JavaScript modules, DOM event delegation, CSS, Node test runner, jsdom.

---

## Task 1: Lock the preview-state regression

- [x] Change defaults so a fresh reader desktop contains no installed widgets.
- [x] Add a regression test proving an explicitly installed item renders even when legacy `enabled` is false.
- [x] Run the focused widget test and confirm it fails before the implementation change.

## Task 2: Replace the checklist with a visual store

- [x] Render an empty/installed desktop summary with a clear `打开组件商店` action.
- [x] Show all content types as real widget previews with name, purpose, style label, and add state.
- [x] Make adding/removing a widget update the phone preview immediately.
- [x] Keep ordering controls only for installed widgets.

## Task 3: Make appearance choices visible

- [x] Replace skin dropdowns with a visual style chooser rendered from the real widget component.
- [x] Replace width dropdowns with a direct half-width/full-width segmented control.
- [x] Preserve palette, local note, and transparent-PNG decoration settings without crowding the store.

## Task 4: Polish responsive behavior and verify

- [x] Adapt store and installed-widget management to the existing preview/settings page pattern on mobile.
- [x] Verify focus states, labels, disabled/add states, reduced motion, and readable touch targets.
- [x] Update appearance dialog tests and run focused tests.
- [x] Run the full verification suite and visually inspect the dialog at desktop and mobile widths.
