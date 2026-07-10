# Article Editor Mobile Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans`. Complete one task at a time, request review before advancing, and keep the worktree clean between tasks.

**Goal:** Make the article editor usable on narrow portrait and coarse-pointer landscape screens while preserving the local-only data model, the existing content DOM, and the desktop three-column workspace.

**Architecture:** Replace the broken mobile vertical stack with mutually exclusive in-place editor/outline panes, then repair viewport sizing, action-rail geometry, outline semantics, and inline module gestures in separate atomic commits.

**Tech stack:** Vanilla JavaScript ES modules, native CSS, Node.js `node:test`, JSDOM, Vite 6, TypeScript project validation.

## Global constraints

- No server, network storage, upload service, community feature, telemetry, or remote database.
- No work-schema, storage-key, import/export, or reader-payload changes.
- No contenteditable duplication or replacement during a view-only switch.
- No desktop editor redesign.
- Every task starts from a clean worktree and ends in one Conventional Commit.
- Use TDD for every behavioral change.
- Run `npm test`, TypeScript validation, and both `%TEMP%` Vite builds before and after every commit.

---

### Task 1: Separate mobile editing and outline panes

**Files:**
- Create: `js/editor-mobile-pane.js`
- Create: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Write a failing JSDOM test for a pane-state helper that changes the shell state and pressed attributes while retaining the exact `contenteditable` DOM node.
- [ ] Prove invalid pane names fail closed and the helper performs no storage or navigation work.
- [ ] Add failing source contracts for exact UTF-8 visible/access names **正文** and **大纲**, using two native, explicit-type view buttons with `aria-controls` and current-state attributes.
- [ ] Render stable IDs on the editor and outline panes and one mobile view group between the action rail and panes.
- [ ] Keep one module-local pane value per current article: selected node defaults to `editor`, an empty article defaults to `outline`, and changing works resets state.
- [ ] Compare the incoming work ID before overwriting `_workId`, and keep pane state separate from a one-shot pending mobile-focus target (`editor`, `outline`, or null).
- [ ] Make a normal view switch mutate only the existing shell through the helper; do not call `refreshEditor` or replace `innerHTML`.
- [ ] Before existing node-create, node-select, and choice-target refreshes, choose `editor`; deleting the final node forces `outline`, while chapter-only refreshes preserve it.
- [ ] On bounded mobile only, every refresh that automatically changes panes records and then consumes the target switch focus: outline selection and first-node creation target **正文**, while last-node deletion targets **大纲**. Desktop never runs this focus path.
- [ ] A choice jump from the editor pane does not change panes and must not receive forced switch focus.
- [ ] Cover an empty work, creation of its first node, deletion of its last node, cross-work reset, editor-pane choice navigation, and outline-originated selection as separate state/focus cases.
- [ ] Add the combined bounded media query for <=480px portrait and <=480px coarse-pointer height.
- [ ] In that query, make the icon rail horizontal, show the mobile view group, give both panes `min-height:0`, and display exactly the pane selected by `data-mobile-pane`.
- [ ] Give each equal-width mobile view button at least a 44px block size and a visible focus treatment.
- [ ] Leave the switch hidden and both panes visible in the desktop row layout.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): separate mobile editing and outline panes"
```

### Task 2: Track the usable mobile viewport

**Files:**
- Extend: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `css/styles.css`

- [ ] Write a failing contract proving the editor page uses `--app-viewport-height` rather than `100vh` directly.
- [ ] Assert the root token already has a `100vh` fallback and `100dvh` enhancement; do not assume a JavaScript Visual Viewport writer that the repository does not provide for this shell.
- [ ] Introduce one `--app-header-height` token with the existing 56px desktop and 48px narrow values; use it for both `.app-header` and the editor subtraction.
- [ ] Set `min-height:0` on every editor flex ancestor and preserve `.editor-content` / `.wt-body` as the mutually exclusive vertical scroll owners.
- [ ] Add scoped overscroll containment without changing global body overflow.
- [ ] Preserve exact desktop header and editor heights when dynamic viewport units are unavailable.
- [ ] Do not claim software-keyboard correctness from CSS alone; retain iOS/Android keyboard verification in the manual matrix.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): track the mobile viewport"
```

### Task 3: Make mobile action rails touchable

**Files:**
- Extend: `tests/article-editor-mobile-shell.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Add failing contracts for explicit accessible names on ambiguous glyph-only App/action buttons.
- [ ] Add failing CSS coverage for one-row horizontal icon and formatting rails in the bounded mobile query.
- [ ] Give compact icon/format buttons and the margin trigger at least 44x44px targets in bounded mobile mode. Give selects, number inputs, and checkbox labels at least 44px block size while retaining their natural width and the checkbox glyph's normal size.
- [ ] Preserve desktop control density and every existing command.
- [ ] Keep vertical writing gestures available outside the rails; contain only horizontal rail overscroll.
- [ ] Add a toolbar scroll layer, move the margin popover outside that overflow layer as its sibling, and position it within a 320px viewport.
- [ ] Add visible `:focus-visible` treatment that does not rely on hover.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): make mobile action rails touchable"
```

### Task 4: Make outline destinations semantic

**Files:**
- Create: `tests/article-outline-accessibility.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Write failing renderer/source tests proving node selection and choice navigation use native named buttons.
- [ ] Split each node row into a selection control and its existing actions so no interactive element is nested in another button.
- [ ] Preserve delegated command names, active-node visuals, choice targets, and desktop hover actions.
- [ ] Add visible keyboard focus and at least 44px coarse-pointer targets without enlarging every desktop row.
- [ ] Prove Enter/Space use native activation and no document-global keyboard shim is required.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): make outline destinations accessible"
```

### Task 5: Make chapter disclosure semantic

**Files:**
- Extend: `tests/article-outline-accessibility.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Write failing tests proving every chapter heading has a native named disclosure button with accurate `aria-expanded` and `aria-controls`.
- [ ] Keep chapter rename/delete controls as siblings rather than nesting them inside the disclosure button.
- [ ] Give each chapter a stable-ID content container that wraps all of its nodes and their choice rows; the disclosure controls that entire container through `aria-controls` and `hidden`.
- [ ] Keep `aria-expanded`, the content container's hidden state, and the arrow treatment synchronized while preserving delegated command names.
- [ ] Add visible keyboard focus and a 44px coarse-pointer target without changing desktop density.
- [ ] Prove native Enter/Space activation updates both visibility and expanded state.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): make chapter disclosure accessible"
```

### Task 6: Expose outline actions without hover

**Files:**
- Create: `js/editor-outline-menu.js`
- Extend: `tests/article-outline-accessibility.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Add failing tests proving every node and chapter exposes a named 44px action disclosure in coarse-pointer mode.
- [ ] Reuse the existing rename, move, reorder, and delete commands; do not duplicate business logic.
- [ ] Keep the current direct hover actions on desktop and expose only one reachable action presentation per responsive mode.
- [ ] Add a small testable controller with exactly one open item; use a local disclosure/menu surface, not long press and not a modal.
- [ ] Give the trigger `aria-expanded`/`aria-controls`; render the move `<select>` and command buttons as sibling controls in the associated panel, keep it within a 320px outline pane, and focus the first action on open.
- [ ] Close after an action, on Escape, outside press, another disclosure opening, pane/work changes, and editor refresh.
- [ ] Restore trigger focus only for an ordinary close with no refresh or focus handoff. A rename/delete command that opens a prompt or confirmation closes without reclaiming focus; add explicit tests for both paths.
- [ ] Prove destructive confirmations and outline-state preservation still follow their existing paths.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): expose outline actions on touch"
```

### Task 7: Support touch arrangement for inline phone modules

**Files:**
- Create: `js/editor-phone-module-drag.js`
- Create: `tests/article-phone-module-pointer-drag.test.mjs`
- Modify: `js/pages/editor.js`
- Modify: `css/styles.css`

- [ ] Reproduce the mouse-only inline-card arranger with failing primary-pointer tests.
- [ ] Prove tap remains click-to-open, hamburger interaction remains independent, and below-threshold movement performs no reorder write.
- [ ] Extract and unit-test the explicit `idle -> pending -> dragging -> committed|cancelled -> idle` lifecycle, then migrate only the inline phone-module card arranger to Pointer Events.
- [ ] Mark pointer-up committed before releasing capture so its normal `lostpointercapture` cannot roll back or write twice.
- [ ] On unexpected lost capture, pointer cancel, blur, or editor refresh, restore the original position/order without writing.
- [ ] When Pointer Capture is unavailable, use temporary document-level Pointer Event listeners scoped to the active pointer and remove them on every terminal path.
- [ ] Scope synthetic-click suppression to the dragged card and consume it once.
- [ ] Keep `touch-action:none` on the draggable card affordance only, leaving article scrolling available elsewhere.
- [ ] Preserve desktop mouse behavior, selection cleanup, card payloads, and draft isolation.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(editor): support touch module arrangement"
```

### Task 8: Review and handoff

- [ ] Request specification, code-quality, accessibility, and regression review across the mobile shell commits.
- [ ] Resolve every Critical and Important finding in its own atomic commit and request re-review.
- [ ] Run the full test suite, TypeScript validation, and both temporary Vite builds.
- [ ] Confirm the worktree is clean.
- [ ] Record the real-device matrix still awaiting manual verification.
- [ ] Reassess article input persistence only after profiling a large local work; do not introduce a debounce without synchronous blur/navigation/export/unload flush guarantees.

## Validation commands

```powershell
npm test
$node=(Get-Command node.exe).Source
$tsc=(Resolve-Path '.\node_modules\typescript\bin\tsc').Path
& $node $tsc -b --pretty false
```

Editor and reader builds use programmatic `vite.build` with `configFile:false` and write to `%TEMP%`, matching the repository's established validation workflow.
