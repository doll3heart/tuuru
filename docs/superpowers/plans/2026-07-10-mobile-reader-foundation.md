# Mobile Reader Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Implement one task at a time and request review before advancing.

**Goal:** Make the existing standalone and embedded phone reader usable on real mobile viewports while preserving local-only storage, work schemas, and desktop behavior.

**Architecture:** Establish semantic viewport contracts, restore the standalone reader's missing scoped App-panel layout, assign one scroll owner to every phone context, and route persisted logical icon coordinates through a pure responsive layout helper.

**Tech Stack:** Vanilla JavaScript ES modules, native CSS, Node.js `node:test`, JSDOM, Vite 6, TypeScript build validation.

## Global constraints

- No server, network storage, upload workflow, community feature, telemetry, or remote database.
- No work-schema or persisted-coordinate migration.
- No whole-file reader rewrite.
- Every task begins from a clean worktree and ends with one Conventional Commit.
- Use TDD for every functional or behavioral change.
- Run `npm test`, TypeScript validation, and both temporary Vite builds before and after each commit.
- Build outputs go to `%TEMP%`, never tracked `dist-editor` or workspace `dist-reader`.

---

### Task 1: Restore embedded App panel layout

**Files:**
- Create: `tests/reader-app-panel-layout.test.mjs`
- Modify: `reader/reader.css`

- [ ] Write a failing CSS contract test proving `reader/reader.js` injects an embedded panel while `reader/reader.css` lacks a scoped direct-child layout rule.
- [ ] Add only the scoped `.phone-frame > .cu-panel.cu-panel-embedded` shell, header, and body rules.
- [ ] Make the panel a bounded flex column, keep the header fixed in flow, and make the body the only panel scroll container.
- [ ] Set panel text to the reader ink token so content does not inherit `.phone-frame`'s decorative pale color.
- [ ] Assert that no new bare `.cu-panel`, `.cu-header`, or `.cu-body` rule leaks across customization UI.
- [ ] Run focused test, full validation, request review, and commit:

```bash
git commit -m "fix(reader): restore embedded app panels"
```

### Task 2: Restore zoom and establish the safe mobile viewport

**Files:**
- Create: `tests/reader-mobile-viewport.test.mjs`
- Modify: `index.html`
- Modify: `reader/index.html`
- Modify: `reader/reader.css`

- [ ] Write failing semantic viewport-meta tests for both HTML entries: both allow zoom, while only the standalone reader requires `viewport-fit=cover` in this phase.
- [ ] Assert a `100vh` fallback, `100dvh` enhancement, and all four safe-area tokens in reader CSS.
- [ ] Remove zoom restrictions in both entries. Add `viewport-fit=cover` only to `reader/index.html`; defer root cutout coverage until `css/styles.css` receives its own safe-area layout phase.
- [ ] Activate the bounded phone at `max-width: 480px`, plus `max-height: 480px` with a coarse pointer for mobile landscape.
- [ ] Bound only the standalone `.phone-reader > .phone-frame`; do not apply the rule to `.phone-frame.custom-preview`.
- [ ] Give `body` and `#app` the dynamic viewport token, then make `.phone-reader` fixed and bounded with safe-area padding and no outer scrolling.
- [ ] Override `#phoneDesktopReader` to `min-height: 0 !important` and make it the home screen scroll owner inside the bounded phone.
- [ ] Move standalone reader controls inside safe-area offsets and expand changed coarse-pointer targets to at least 44px. The article overlay back control is deferred to Task 3.
- [ ] Keep the legacy 375px desktop frame behavior outside the mobile breakpoint.
- [ ] Run focused test, full validation, request review, and commit:

```bash
git commit -m "fix(reader): stabilize the mobile viewport"
```

### Task 3: Contain the article phone overlay and customization scroll

**Files:**
- Extend: `tests/reader-mobile-viewport.test.mjs`
- Modify: `reader/reader.css`
- Modify: `reader/reader.js`

- [ ] Write a failing source/CSS contract for explicit phone overlay and wrapper classes.
- [ ] Replace only the overlay's inline geometry and scroll styles with named classes; retain its close behavior and rendering path.
- [ ] Bound the overlay to the dynamic viewport and safe area without allowing the overlay itself to scroll.
- [ ] Bound its phone wrapper to available height, apply the bounded `#phoneDesktopReader` contract, and let the current phone screen own scrolling.
- [ ] Make only the per-App `.cu-modal` shell non-scrolling and `.cu-modal-body` its single scroll owner. Keep the separate reader-settings bottom sheet unchanged.
- [ ] Assert the overlay does not mutate body overflow or body classes and leaves no wrapper after close. Verify actual document scrolling manually before and after the overlay.
- [ ] Run focused test, full validation, request review, and commit:

```bash
git commit -m "fix(reader): contain phone overlay scrolling"
```

### Task 4: Adapt the four-column phone desktop to 320px

**Files:**
- Create: `reader/phone-grid.js`
- Create: `tests/reader-phone-grid.test.mjs`
- Modify: `reader/reader.css`
- Modify: `reader/reader.js`

- [ ] Write failing pure-function and CSS-contract tests for 320px, 350px, and 365px desktop containers.
- [ ] At 320px, assert four increasing, non-overlapping 72px icon boxes remain in bounds with approximately symmetric outer margins.
- [ ] At 350px and 365px inner widths, representing the existing bordered 360px preview and 375px standalone frame, preserve column positions `[20, 100, 180, 260]`.
- [ ] Preserve row spacing and logical `desktopX`/`desktopY` semantics.
- [ ] Implement a pure helper that emits logical row/column CSS offsets and shares the existing grid constants without DOM reads or data mutation.
- [ ] Resolve the horizontal origin from the actual `.phone-desktop` container using `clamp(4px, calc(100% - 330px), 20px)`, so resize and rotation require no JavaScript lifecycle.
- [ ] In the existing bounded mobile media contract, remove article-overlay outer padding and phone-frame borders so a 320px viewport supplies a full 320px icon containing block. Preserve the framed desktop overlay.
- [ ] Use the helper in both `buildPhoneHTML` and `renderPhonePreview`; add wiring and container-formula assertions to prevent drift back to hard-coded absolute positions or `window.innerWidth`.
- [ ] Do not change App ordering, payloads, icons, or drag behavior.
- [ ] Run focused test, full validation, request review, and commit:

```bash
git commit -m "fix(reader): fit phone apps on narrow screens"
```

### Task 5: Foundation review and handoff

**Files:**
- Review only. Any correction receives its own narrow commit.

- [ ] Request a specification and code-quality review across all four tasks.
- [ ] Resolve every Critical or Important finding and request re-review.
- [ ] Run the full test suite, TypeScript validation, and both temporary Vite builds.
- [ ] Confirm the working tree is clean.
- [ ] Record the manual mobile matrix that still needs the user's real-device check.

## Validation commands

```powershell
npm test
$node=(Get-Command node.exe).Source
$tsc=(Resolve-Path '.\node_modules\typescript\bin\tsc').Path
& $node $tsc -b --pretty false
```

Editor and reader Vite builds use programmatic `vite.build` with `configFile: false` and write to `%TEMP%`, matching the established repository validation workflow.
