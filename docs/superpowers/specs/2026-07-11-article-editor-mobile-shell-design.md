# Article Editor Mobile Shell Design

## Context and goal

Tuuru's article editor still uses the three-column Reverie desktop shell: an App/action rail, the article editor, and a world-tree outline. At 480px and below the stylesheet changes that row into a column but keeps a fixed, clipped viewport. The outline has no bounded block size and refuses to shrink, so a sufficiently large tree can consume the editor's remaining height. Low-height touch landscape never enters that mobile layout, leaving part of the vertical action rail outside a clipped 334px work area.

This phase makes the article authoring shell dependable at 320x568, 360x640, 390x844, and 844x390 coarse-pointer landscape. It preserves the article schema, content DOM, local persistence, desktop three-column presentation, and every existing editor command.

## Product constraints

- Keep all authoring frontend-only and local-only. Add no upload, server, database, community feature, telemetry, or remote asset pipeline.
- Preserve article, node, chapter, choice, placeholder, and phone-module data formats.
- Keep the desktop action rail, editor, and outline visible together.
- Do not duplicate or remount the `contenteditable` merely to change mobile views.
- Do not use a modal or off-canvas drawer for the outline while the shared modal stack lacks a complete focus/inert boundary.
- Keep each behavioral change independently reviewable and revertible.
- Do not combine input-persistence throttling with layout work; save timing has data-loss risk and needs a separate design.

## Design read

Reading this as: a structural repair of a dense local-first writing tool, not a cosmetic redesign. The mobile shell should give the current writing task most of the screen, keep structural navigation one deliberate action away, and preserve Tuuru's quiet editorial character.

- `DESIGN_VARIANCE: 3`: evolve the existing shell without introducing a new visual language.
- `MOTION_INTENSITY: 1`: pane changes are immediate; no sliding drawer or decorative transition.
- `VISUAL_DENSITY: 5`: controls remain compact, but primary touch targets reach 44px.

## Architecture decision: mutually exclusive in-place panes

On a narrow or low-height coarse-pointer viewport, the editor and outline become two views of the same workspace. A persistent, native view switch chooses **正文** or **大纲**. Only the selected pane participates in layout and the accessibility tree; the hidden pane remains the same DOM instance, preserving editor DOM state and each pane's scroll position. Browser caret/selection retention across `display:none` is not assumed and remains part of the real-device matrix.

This is preferable to a drawer because the outline is primary navigation, not temporary secondary content. A drawer would require an overlay, scroll lock, Escape/back handling, focus containment, and coordination with phone App and generic nested modals. The in-place switch needs none of those systems and leaves desktop behavior untouched.

The bounded responsive scope is:

```css
(max-width: 480px),
(max-height: 480px) and (pointer: coarse)
```

The second branch covers 844x390 phone landscape without applying the mobile shell to ordinary short desktop windows with a precise mouse.

## Pane state and DOM rules

- The editor body owns a `data-mobile-pane="editor|outline"` state.
- A work with a selected node starts in the editor. An empty work starts in the outline.
- Switching views mutates only that state and the switch's current-state attributes. It does not call `renderEditor`, replace `innerHTML`, navigate, or write storage.
- Any bounded-mobile operation that both changes the pane automatically and performs the existing refresh records the target pane as a one-shot focus destination. Choosing a node or creating the first node targets the rebuilt **正文** switch; deleting the final node forces `outline` and targets **大纲**. Desktop never runs this mobile focus path.
- A choice followed from the editor pane does not change panes, so it stays in normal reading/editing focus flow without a forced switch focus.
- Chapter-only operations preserve the outline state across their existing refresh.
- The module keeps only the currently loaded article's transient pane state. Changing works resets it rather than caching a separate state for every article.
- The switch uses native `button type="button"` controls with an accessible group name, explicit current state, `aria-controls`, and at least a 44px block size; its two equal columns naturally exceed 44px in width. It deliberately uses pressed-state buttons instead of an incomplete ARIA tabs implementation that would also require roving arrow-key behavior and desktop-only role removal.

## Layout and scroll ownership

Desktop keeps the current row layout and scroll owners.

In the bounded mobile mode:

- the root header, horizontal action rail, and view switch remain outside the scrolling pane;
- `.editor-area` and `.world-tree` each fill the same remaining block size, but only one is displayed;
- `.editor-content` is the sole vertical scroll owner while editing;
- `.wt-body` is the sole vertical scroll owner while browsing the outline;
- every flex ancestor in this chain has `min-height: 0`, preventing intrinsic content from forcing a pane beyond the clipped shell;
- the editor shell uses the existing dynamic viewport-height token and a shared header-height token instead of a hard-coded `100vh - 56px` calculation;
- document/body scrolling is not introduced as a competing third scroll owner.

## Mobile action rails

The App/action rail and formatting toolbar remain feature-complete. In bounded mobile mode they become single-row horizontal scrollers instead of wrapping into several rows or extending below a landscape viewport. Compact icon/format buttons receive at least 44x44px targets; selects, number fields, and labelled controls keep their natural width but reach at least 44px in block size. All receive visible keyboard focus and explicit accessible names where a glyph alone is ambiguous.

The margin editor is rendered as a sibling of the horizontal toolbar scroller so overflow clipping cannot make it unreachable. Its trigger remains in the rail, while the toolbar shell positions the popover within a 320px viewport. The checkbox keeps its normal visual size and receives a 44px hit area through its label. This work is isolated from the pane architecture because it changes control geometry rather than workspace ownership.

## Outline navigation and actions

Outline nodes, choices, and chapter toggles become native controls instead of click-only `div` elements. Each chapter disclosure controls one stable-ID content container that wraps both its nodes and those nodes' choices; collapsed content uses `hidden`, so visibility, focusability, `aria-expanded`, and the arrow cannot disagree. Focus-visible treatment mirrors the active-node treatment without conflating focus with selection.

Desktop hover actions remain available. Coarse-pointer mode receives one 44px overflow disclosure per node or chapter, containing the existing rename, move, and delete operations. One controller owns a single open item. Its trigger exposes `aria-expanded` and `aria-controls`; the action panel is a sibling, and its move `<select>` and command buttons are sibling controls rather than nested interactive content. Opening places focus on the first action. Escape and outside press close it, while pane changes, article changes, and editor refresh dispose the controller and reset all disclosure state. An ordinary close with no refresh or focus handoff restores the trigger. Commands that open a prompt/confirmation or otherwise hand focus to another surface close without reclaiming focus; refresh-driven commands rely on the destination focus rule instead. Desktop and mobile action presentations may share event commands but only one presentation is exposed at a time. No long-press-only command is introduced.

## Inline phone-module arrangement

Article phone-module cards now use a cancel-safe Pointer Events controller while preserving click-to-open and menu behavior. Its explicit lifecycle is `idle -> pending -> dragging -> committed|cancelled -> idle`. The original card remains in the editable DOM as the Pointer Capture target while a separate inert preview follows the pointer. A successful pointer-up marks the gesture committed before releasing capture, so the resulting `lostpointercapture` is a no-op; an unexpected capture loss while pending or dragging cancels and restores without writing. When Pointer Capture is unavailable or unconfirmed, temporary document-level Pointer Event listeners scoped to the active pointer provide the fallback and are removed on every terminal path.

## Compatibility boundaries

This phase does not:

- alter local-storage keys, work versions, import/export, reader payloads, or phone-module drafts;
- redesign the desktop editor or activate a server-backed workflow;
- add root `viewport-fit=cover` before the complete app header consumes safe areas;
- rewrite deprecated formatting commands or the full 1500-line editor module;
- debounce article persistence without a separately proven flush boundary;
- introduce a new mobile-only editing feature or visual theme.

## Automated test strategy

- Add a JSDOM-tested pane-state helper proving a view change retains the exact `contenteditable` node and causes no storage write.
- Add source and CSS contracts for exact UTF-8 **正文** / **大纲** labels, native named view controls, state preservation, node-selection return, the combined portrait/landscape query, mutually exclusive panes, and desktop coexistence.
- Prove the dynamic viewport and header-height tokens replace the hard-coded editor height without changing desktop pixel geometry.
- Test horizontal action rails, 44px controls, focus visibility, and reachable margin controls.
- Test native outline navigation and ensure coarse-pointer action disclosures do not duplicate reachable desktop controls.
- Exercise pointer tap, drag, commit-before-release, unexpected lost capture, no-capture fallback, cancel, click suppression, re-render cleanup, and storage-write counts for inline phone-module cards.
- After every commit, run all Node tests, TypeScript validation, and both temporary Vite production builds.

## Manual verification matrix

At 320x568, 360x640, 390x844, and 844x390 coarse-pointer landscape, verify:

- the editor and outline each fill the same remaining space and never appear stacked;
- switching views preserves draft content, selection where the browser permits it, and pane scroll positions;
- selecting a node returns to editing without automatically opening the keyboard;
- only the visible pane scrolls vertically;
- action rails scroll horizontally without trapping vertical page gestures;
- the software keyboard leaves the node header, toolbar, active line, and view switch reachable;
- touch and keyboard users can reach every outline action;
- rotation and pointer cancellation never persist a partial module move.
