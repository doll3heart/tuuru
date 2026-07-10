# Phone Editor Mobile Foundation Design

## Context and goal

Tuuru is a frontend-only, local-only interactive fiction editor. Its phone module was designed as a fixed 360px desktop preview and still assumes a mouse for arranging Apps. The reader foundation now supports narrow mobile screens, but the authoring surface does not yet share those guarantees.

The current phone editor has five independent mobile failures:

1. Several App editors persist the active field only on `blur`. The article module's external `beforeClose` handler snapshots its virtual work before a backdrop close blurs that field, so the final focused edit can be silently omitted from the saved card.
2. Six Apps render an embedded full-size panel whose visible Back button restores an absent `_origHTML` snapshot instead of entering the modal close controller. The result is a blank modal, delayed callback, and a different save path from the backdrop/outer close button.
3. `openPhoneAppModal` builds a 360x640px shell with inline `90vh` sizing. It can exceed a 320px viewport, does not track the visual viewport when a software keyboard opens, and exposes a close target smaller than 44px.
4. The editor renderer and drag inverse mapping use separate hard-coded grid constants. A 320px viewport produces a 314px inner frame after its mobile border, while the legacy four-column span and 4px minimum origin require 316px.
5. App rearrangement listens only to mouse events, installs document-global move/up handlers, removes every focus outline in the phone desktop, has no pointer-cancel recovery, and runs collision/persistence even for a normal tap that never crossed the drag threshold.

This phase makes the phone authoring surface dependable from 320px upward without changing App payloads, persisted coordinates, work schemas, storage, or the existing visual language.

## Approved product constraints

- Keep all authoring and reading frontend-only and local-only. Add no server, upload endpoint, community feature, telemetry, or remote database.
- Preserve every existing phone App and its current editor behavior.
- Preserve `desktopX` and `desktopY` as persisted logical grid coordinates; introduce no migration.
- Keep the current 360px framed preview on desktop.
- Do not rewrite `js/pages/phone.js` or convert all App editors to a new component system in this phase.
- Do not enable `viewport-fit=cover` for the root editor until the root header and article editor consume safe-area insets together.
- Keep every behavioral change independently reviewable and revertible.

## Design read

Reading this as: a targeted mobile hardening of a dense local-first authoring tool, preserving Tuuru's quiet editorial character while making touch, keyboard, and narrow viewport behavior predictable.

- `DESIGN_VARIANCE: 3`: retain familiar App-editor structure and phone metaphor.
- `MOTION_INTENSITY: 2`: movement communicates drag state only.
- `VISUAL_DENSITY: 5`: preserve compact authoring controls while enforcing usable touch targets at the shell level.

## Architecture

### 1. Flush focused edits before the external close snapshot

The phone App modal owns the ordering boundary between its App-specific blur handlers and the caller's `beforeClose` snapshot. Every close attempt first checks whether `document.activeElement` is a descendant of the modal content and, when possible, calls its native `blur()` synchronously. Browser `blur` handlers run before the external close callback, so contacts, browser rows, memos, and other blur-backed editors update the virtual draft before it is copied into an article card.

The flush is deliberately narrow: it does not synthesize `change` or `input`, does not write storage itself, and does not blur elements outside this modal. If the external close vetoes or throws, the modal remains open with the already-flushed value intact and can be retried.

### 2. One close lifecycle for modal-native Back controls

The modal content exposes a narrow close request to App editors. When a top-level App is hosted by `openPhoneAppModal`, its visible Back control performs any existing App-specific synchronous save step and requests `close("app-back")`. The modal then flushes focus, runs the external snapshot/commit hook, removes once, and reports the same reason through `afterClose`.

When the same App editor is hosted inside the standalone phone editor, no modal close request exists and its current restore-to-desktop behavior remains. This context check prevents a broad rewrite of the six App editors while eliminating the blank intermediate modal and lifecycle bypass.

### 3. Root dynamic-viewport token

The root stylesheet defines an application viewport-height token with a `100vh` fallback and a `100dvh` enhancement. This phase uses it only for the phone App modal. The rest of the root shell keeps its current document-scrolling behavior, avoiding a broad height or safe-area rewrite.

The root entry continues to omit `viewport-fit=cover`. Safe-area environment values are therefore not introduced piecemeal into this modal; the later root-shell phase must adapt the sticky header and article editor as one coherent change before extending content into display cutouts.

### 4. Bounded phone App modal

`openPhoneAppModal` keeps its existing close controller and App rendering dispatch, but replaces geometry-heavy inline styles with named, scoped classes:

- `.phone-app-modal-overlay`
- `.phone-app-modal-inner`
- `.phone-app-modal-header`
- `.phone-app-modal-title`
- `.phone-app-modal-close`
- `.phone-app-modal-content`

The overlay is a fixed flex container whose height follows the dynamic viewport. The modal is at most 360x640px on larger screens and fills the available viewport at 480px and below. Its header remains fixed in flex flow, its content has `min-height: 0` and `overflow: hidden`, and each existing `.cu-panel` keeps ownership of App-editor scrolling through `.cu-body`.

The outer close button and scoped `.cu-close-btn` controls become 44x44px targets while their visible glyphs remain compact. Existing close veto, overlay-click close, callback ordering, render-failure cleanup, and draft isolation remain unchanged.

### 5. Dialog semantics and keyboard closure

The bounded shell is an actual labelled dialog with `role="dialog"` and `aria-modal="true"`. Its outer close button has an accessible name and explicit button type. Escape requests the same close controller, successful close removes its document listener and restores the element focused before opening, and a veto leaves the dialog connected for retry. A full focus trap is deferred until the nested global modal system can be handled with the same stack-aware contract.

### 6. One shared logical grid

The reader grid helper becomes the single source of phone grid metrics for reader and editor code. A compatibility module may remain at the reader path so the reader import surface does not change abruptly, but metrics and calculations have one implementation.

The horizontal origin remains container-relative. Its lower clamp is reduced from 4px to 0px, while the centered term still resolves to 4px at a full 320px container. This preserves reader positions `[4, 84, 164, 244]` and lets the bordered editor's 314px inner container resolve to `[1, 81, 161, 241]`, fitting four 72px icons without removing the phone frame.

Renderers express persisted logical coordinates through CSS variables. Temporary drag movement may use pixel `left`/`top`, but completing or cancelling a drag restores variable-based positioning. Resize and rotation therefore cannot leave an icon stranded at a stale pixel offset.

### 7. Pointer-based drag state machine

The desktop App drag path moves from mouse-only document listeners to Pointer Events with a single active primary pointer.

- `pointerdown` records the original logical and rendered position.
- `setPointerCapture` keeps movement bound to the icon when supported.
- `pointermove` crosses the existing movement threshold before entering drag state and suppressing only that icon's following synthetic click.
- `pointerup` snaps through the existing collision and persistence rules.
- `pointercancel` and unexpected capture loss restore the original logical position without writing data.

A press released before crossing the threshold is a tap: it performs no collision search and no `updateWork` call. Click suppression is scoped to the dragged App and expires after the corresponding synthetic click, replacing the stale module-global boolean that can currently swallow an unrelated later click.

Only draggable App icons use `touch-action: none`; the surrounding phone desktop remains scrollable from its gaps. Mouse hover remains optional feedback, not a functional requirement.

### 8. Restored keyboard affordance

Phone App icons become focusable button-like controls with an accessible name. Enter and Space activate the same App-opening path as click. The blanket rule that removes outlines from the entire phone desktop is narrowed, and icons receive a visible `:focus-visible` treatment that matches Tuuru's existing primary color.

This follows the drag migration in its own atomic task. The first accessibility step covers discovery and activation. A non-drag sorting alternative requires a separately designed cell picker or directional move control and is not disguised as part of the pointer refactor.

## Scroll ownership

- Root phone editor page: document scrolls as it does today.
- Phone App modal shell: never scrolls.
- Phone App modal content viewport: clips layout but does not create a second scrollbar.
- Existing App panel: `.cu-body` remains the single vertical scroll owner; header/footer stay in flow.
- Nested generic confirmation/input modal: retains the existing global modal behavior and is outside this phase.

## Compatibility boundaries

This phase does not:

- change App data models, serialization, imports, exports, or local storage;
- change App order, collision semantics, or the four-by-four logical grid;
- activate the currently stored `skin.iconColumns` value; doing so would require an explicit coordinate/migration policy;
- replace App-specific `dblclick` or `contextmenu` interactions elsewhere in the 4400-line module;
- redesign the article editor toolbar/tree on mobile;
- enable root cutout coverage or refactor the global modal system;
- harden nested generic add/edit forms that still use the global `modal()` shell;
- introduce new gestures such as swipe navigation or long-press menus.

Those remaining touch-only App interactions and the article editor mobile shell become later, separately reviewed phases.

## Test strategy

- Reproduce the focused-field backdrop-close failure and assert the external snapshot observes the final value before adding layout work.
- Prove representative embedded-App Back controls settle the modal exactly once through reason `app-back` instead of leaving a blank shell.
- Add a CSS/source contract test for dynamic viewport sizing, named modal structure, one scroll owner, and the 44px close target.
- Test dialog labelling, Escape cleanup, veto behavior, and focus restoration independently from geometry.
- Preserve the existing lifecycle tests for close veto, callback ordering, overlay click, and render-failure cleanup.
- Move grid metrics behind one shared implementation and test 314px, 320px, 350px, and 365px containers.
- Add renderer wiring tests proving reader and editor consume the same grid contract and no fixed editor offset constants remain.
- Exercise pointer down/move/up/cancel with JSDOM-compatible events, including zero-write taps, icon-scoped click suppression, persistence, collision behavior, and cleanup.
- Assert keyboard activation and a visible focus contract.
- After every commit, run the full Node test suite, TypeScript validation, and both Vite production builds into temporary directories.

## Manual verification matrix

When a real browser/device is available, verify at 320x568, 360x640, 390x844, and 844x390:

- every phone App modal fits without horizontal clipping;
- opening the software keyboard keeps the active field and modal header reachable;
- each App panel has only one vertical scrollbar;
- all four icon columns remain visible before and after rotation;
- touch drag snaps and collides exactly like mouse drag;
- a cancelled gesture does not move or persist an App;
- tapping an icon still opens it, and keyboard focus is visible on desktop.
