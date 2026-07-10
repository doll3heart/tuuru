# Phone Editor Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Implement one task at a time and request review before advancing.

**Goal:** Make the phone authoring surface usable on narrow touch devices while preserving local-only architecture, App behavior, persisted grid coordinates, and desktop presentation.

**Architecture:** Flush blur-backed edits before the article draft snapshot, route every visible modal Back control through one close lifecycle, bound and label the modal, centralize reader/editor grid geometry, and replace the mouse-only App arranger with a cancel-safe pointer state machine followed by keyboard activation.

**Tech Stack:** Vanilla JavaScript ES modules, native CSS, Node.js `node:test`, JSDOM, Vite 6, TypeScript build validation.

## Global constraints

- No server, network storage, upload service, community feature, telemetry, or remote database.
- No work-schema or persisted-coordinate migration.
- No whole-file phone module rewrite.
- Every task begins from a clean worktree and ends with one Conventional Commit.
- Use TDD for every functional or behavioral change.
- Run `npm test`, TypeScript validation, and both temporary Vite builds before and after each commit.
- Build outputs go to `%TEMP%`, never tracked `dist-editor` or workspace `dist-reader`.

---

### Task 1: Flush the focused App field before close

**Files:**
- Extend: `tests/phone-app-modal.test.mjs`
- Modify: `js/pages/phone.js`

- [ ] Write a failing integration test that edits a focused contact field, closes through the backdrop, and proves `beforeClose` currently snapshots the old value.
- [ ] Add one narrow modal-owned flush step that blurs only an active descendant before invoking the external `beforeClose` callback.
- [ ] Prove blur handlers run synchronously and the snapshot sees the final value.
- [ ] Prove a vetoed or throwing close leaves the overlay connected and can be retried with the flushed value intact.
- [ ] Do not synthesize input/change events or add App-specific save branches to the modal shell.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): flush app edits before close"
```

### Task 2: Route embedded App Back through the modal lifecycle

**Files:**
- Extend: `tests/phone-app-modal.test.mjs`
- Modify: `js/pages/phone.js`

- [ ] Write failing integration tests for at least Messages and Memo proving their visible Back controls currently leave a blank connected overlay and skip `afterClose`.
- [ ] Give modal-hosted App editors a narrow close request without changing their standalone phone-editor host behavior.
- [ ] Preserve each App's existing synchronous save step before requesting `close("app-back")`.
- [ ] Prove Back settles exactly once, removes the overlay directly, passes reason `app-back`, and still honors a close veto.
- [ ] Do not expose a second header merely by changing the absolute panel containing block.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): route app back through modal lifecycle"
```

### Task 3: Bound the phone App modal to the dynamic viewport

**Files:**
- Create: `tests/phone-app-modal-layout.test.mjs`
- Modify: `css/styles.css`
- Modify: `js/pages/phone.js`

- [ ] Write a failing contract test for a `100vh` application token upgraded to `100dvh`, named modal shell elements, bounded mobile geometry, and one App-panel scroll owner.
- [ ] Assert the close control is a semantic button with an accessible label and a 44x44px target.
- [ ] Replace only `openPhoneAppModal`'s geometry/header/content inline styles with scoped classes.
- [ ] Keep `.phone-app-modal-content` at `min-height: 0; overflow: hidden` so existing `.cu-body` elements remain the scroll owners.
- [ ] At 480px and below, let the shell fill the dynamic viewport and remove only its decorative radius; keep the 360x640px maximum on larger screens.
- [ ] Make both the outer close control and scoped `.cu-close-btn` shells at least 44x44px without enlarging their glyphs.
- [ ] Add scoped overscroll containment without introducing global body-overflow mutation.
- [ ] Preserve the existing close controller, veto behavior, overlay click, callback ordering, render-failure cleanup, and article-draft isolation.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): adapt app modal to mobile viewport"
```

### Task 4: Add dialog semantics and keyboard closure

**Files:**
- Extend: `tests/phone-app-modal.test.mjs`
- Modify: `js/pages/phone.js`

- [ ] Write failing tests for labelled dialog semantics, an accessible explicit-type close button, and Escape using the existing close controller.
- [ ] Capture the previously focused element before opening and restore it only after a successful close.
- [ ] Register one Escape listener per open modal and remove it on every successful close and render-failure path.
- [ ] Prove a vetoed Escape leaves the overlay connected and retryable without restoring background focus.
- [ ] Do not introduce a partial focus trap while nested global modals remain stack-unaware.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): make app modal keyboard accessible"
```

### Task 5: Extract shared phone grid geometry without changing layout

**Files:**
- Create: `js/phone-grid.js`
- Modify or replace with compatibility export: `reader/phone-grid.js`
- Modify: `reader/reader.js` only if its import path must change
- Modify: `tests/reader-phone-grid.test.mjs`

- [ ] Give reader and editor one metrics implementation while preserving every current reader coordinate and style string.
- [ ] Keep a small compatibility export at `reader/phone-grid.js` if that avoids an unnecessary reader import-surface change.
- [ ] Prove there is one implementation of `PHONE_GRID_METRICS`, coordinate conversion, and style generation.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "refactor(phone): share desktop grid geometry"
```

### Task 6: Fit the editor grid on narrow screens

**Files:**
- Modify: `js/phone-grid.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Modify: `tests/reader-phone-grid.test.mjs`
- Create: `tests/phone-editor-grid.test.mjs`

- [ ] Add failing coverage for the editor's 314px bordered mobile container while retaining exact reader positions at 320px and legacy positions at 350px/365px.
- [ ] Change the minimum origin clamp to 0px; prove the centered term still yields a 1px margin at 314px and 4px at 320px.
- [ ] Render editor icons from logical coordinates through the shared CSS-variable style helper.
- [ ] Remove editor-local `CELL_W`, `CELL_H`, `OFFSET_X`, and `OFFSET_Y` constants; retain four-by-four logical limits from the shared metrics.
- [ ] Route drag inverse mapping and snap-back through shared conversion helpers without changing collision or persistence behavior.
- [ ] Clear temporary pixel offsets after snap/cancel so resize returns control to container-relative CSS.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): fit the editor grid on narrow screens"
```

### Task 7: Migrate App arrangement to Pointer Events

**Files:**
- Create: `tests/phone-icon-pointer-drag.test.mjs`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`

- [ ] Write failing behavioral tests for primary-pointer down/move/up, the existing drag threshold, App-scoped click suppression, collision persistence, and re-render cleanup.
- [ ] Prove a tap or below-threshold movement performs zero collision work and zero `updateWork` calls.
- [ ] Add failing cancel tests proving `pointercancel` and lost capture restore the original logical position without a storage write.
- [ ] Replace only the App-icon mouse drag path with Pointer Events and guarded pointer capture.
- [ ] Keep at most one active pointer, ignore non-primary buttons, and release listeners/capture on every terminal path.
- [ ] Restrict `touch-action: none` to draggable icons; do not disable scrolling on the whole phone desktop.
- [ ] Preserve click-to-open, App ordering, collision rules, and mouse behavior.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): support touch app arrangement"
```

### Task 8: Restore keyboard discovery and activation

**Files:**
- Create: `tests/phone-icon-accessibility.test.mjs`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`

- [ ] Write failing semantics tests for a button-like accessible name, keyboard focus, and Enter/Space activation.
- [ ] Prefer a native `button type="button"` when it does not disturb delegated click behavior; otherwise document and test the equivalent role/tabindex contract.
- [ ] Remove the focus-forcing `blur()` path and narrow the blanket outline reset.
- [ ] Add a Tuuru-themed `:focus-visible` indicator that survives existing `!important` resets.
- [ ] Do not imply that keyboard activation alone is a non-drag sorting alternative; record that cell/directional movement remains a later UX task.
- [ ] Run focused tests, full validation, request review, and commit:

```bash
git commit -m "fix(phone): restore app icon keyboard access"
```

### Task 9: Foundation review and handoff

**Files:**
- Review only. Any correction receives its own narrow commit.

- [ ] Request specification and code-quality review across all phone-editor foundation commits.
- [ ] Resolve every Critical or Important finding and request re-review.
- [ ] Run the full test suite, TypeScript validation, and both temporary Vite builds.
- [ ] Confirm the working tree is clean.
- [ ] Record the real-device matrix still awaiting manual verification.
- [ ] Reassess the next phase: an explicit non-drag App move control, App-specific long-press alternatives, or the article editor mobile shell. Update the plan before editing any of them.
- [ ] Record the nested global modal keyboard/viewport hardening and per-App coarse-pointer target audit as later atomic work, not hidden scope in this foundation.

## Validation commands

```powershell
npm test
$node=(Get-Command node.exe).Source
$tsc=(Resolve-Path '.\node_modules\typescript\bin\tsc').Path
& $node $tsc -b --pretty false
```

Editor and reader Vite builds use programmatic `vite.build` with `configFile: false` and write to `%TEMP%`, matching the established repository validation workflow.
